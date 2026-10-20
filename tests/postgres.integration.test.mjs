import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

const databaseUrl = process.env.POSTGRES_TEST_URL;

async function setupSql() {
  const source = await readFile(new URL("../src/lib/database.ts", import.meta.url), "utf8");
  const match = source.match(/const SETUP_SQL = `([\s\S]*?)`;/);
  assert.ok(match, "database.ts must contain SETUP_SQL");
  return match[1];
}

async function catalogImportSql() {
  const source = await readFile(new URL("../src/lib/catalog.ts", import.meta.url), "utf8");
  const match = source.match(
    /await client\.query\(\s*`(WITH entries[\s\S]*?)`,\s*\[JSON\.stringify\(sets\)\]/,
  );
  assert.ok(match, "catalog.ts must contain the catalog import SQL");
  return match[1];
}

async function importCatalog(pool, sets, onlyIfEmpty = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE lego_sets IN EXCLUSIVE MODE");
    if (onlyIfEmpty) {
      const result = await client.query(
        "SELECT count(*)::int AS set_count FROM lego_sets",
      );
      if (result.rows[0].set_count !== 0) {
        await client.query("COMMIT");
        return;
      }
    }
    await client.query(await catalogImportSql(), [JSON.stringify(sets)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetDatabase(pool) {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await pool.query(await setupSql());
}

async function deleteOwner(client, ownerId) {
  await client.query("BEGIN");
  try {
    const target = await client.query(
      "SELECT id FROM owners WHERE id = $1 AND lower(name) <> 'unassigned' FOR UPDATE",
      [ownerId],
    );
    if (target.rowCount === 0) {
      await client.query("COMMIT");
      return false;
    }
    await client.query(
      `UPDATE items SET owner_id = (SELECT id FROM owners WHERE lower(name) = 'unassigned')
       WHERE owner_id = $1`,
      [ownerId],
    );
    await client.query("DELETE FROM owners WHERE id = $1", [ownerId]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function deleteCategory(client, categoryId) {
  await client.query("BEGIN");
  try {
    const target = await client.query(
      "SELECT id FROM categories WHERE id = $1 AND slug <> 'uncategorized' FOR UPDATE",
      [categoryId],
    );
    if (target.rowCount === 0) {
      await client.query("COMMIT");
      return false;
    }
    await client.query(
      `UPDATE items SET category_id = (SELECT id FROM categories WHERE slug = 'uncategorized')
       WHERE category_id = $1`,
      [categoryId],
    );
    await client.query("DELETE FROM categories WHERE id = $1", [categoryId]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

test("PostgreSQL invariants", { skip: !databaseUrl }, async (t) => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  await t.test("restores and protects built-in records", async () => {
    await resetDatabase(pool);
    await pool.query("DELETE FROM categories WHERE slug = 'uncategorized'");
    await pool.query(await setupSql());

    const category = await pool.query(
      "SELECT id, name FROM categories WHERE slug = 'uncategorized'",
    );
    assert.equal(category.rowCount, 1);
    assert.equal(category.rows[0].name, "Uncategorized");

    const ownerUpdate = await pool.query(
      "UPDATE owners SET name = 'Renamed' WHERE lower(name) <> 'unassigned' RETURNING id",
    );
    const categoryUpdate = await pool.query(
      "UPDATE categories SET name = 'Renamed' WHERE slug = 'uncategorized' AND slug <> 'uncategorized' RETURNING id",
    );
    const ownerDeleteTarget = await pool.query(
      "SELECT id FROM owners WHERE lower(name) = 'unassigned' AND lower(name) <> 'unassigned' FOR UPDATE",
    );
    const categoryDeleteTarget = await pool.query(
      "SELECT id FROM categories WHERE slug = 'uncategorized' AND slug <> 'uncategorized' FOR UPDATE",
    );
    assert.equal(ownerUpdate.rowCount, 0);
    assert.equal(categoryUpdate.rowCount, 0);
    assert.equal(ownerDeleteTarget.rowCount, 0);
    assert.equal(categoryDeleteTarget.rowCount, 0);
  });

  await t.test("rolls back owner reassignment when deletion fails", async () => {
    await resetDatabase(pool);
    const owner = await pool.query("INSERT INTO owners (name) VALUES ('Rollback owner') RETURNING id");
    const category = await pool.query("SELECT id FROM categories WHERE slug = 'uncategorized'");
    const item = await pool.query(
      "INSERT INTO items (category_id, owner_id, name) VALUES ($1, $2, 'Rollback item') RETURNING id",
      [category.rows[0].id, owner.rows[0].id],
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM owners WHERE id = $1 FOR UPDATE", [owner.rows[0].id]);
      await client.query(
        "UPDATE items SET owner_id = (SELECT id FROM owners WHERE lower(name) = 'unassigned') WHERE owner_id = $1",
        [owner.rows[0].id],
      );
      await assert.rejects(client.query("SELECT 1/0"), /division by zero/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const state = await pool.query(
      "SELECT i.owner_id, o.name FROM items i JOIN owners o ON o.id = i.owner_id WHERE i.id = $1",
      [item.rows[0].id],
    );
    assert.equal(state.rows[0].owner_id, owner.rows[0].id);
    assert.equal(state.rows[0].name, "Rollback owner");
  });

  await t.test("serializes a racing insert with owner deletion", async () => {
    await resetDatabase(pool);
    const owner = await pool.query("INSERT INTO owners (name) VALUES ('Race owner') RETURNING id");
    const category = await pool.query("SELECT id FROM categories WHERE slug = 'uncategorized'");
    const inserter = await pool.connect();
    const deleter = await pool.connect();
    try {
      await inserter.query("BEGIN");
      const item = await inserter.query(
        "INSERT INTO items (category_id, owner_id, name) VALUES ($1, $2, 'Racing item') RETURNING id",
        [category.rows[0].id, owner.rows[0].id],
      );

      const deletion = deleteOwner(deleter, owner.rows[0].id);
      await inserter.query("COMMIT");
      assert.equal(await deletion, true);

      const state = await pool.query(
        "SELECT i.owner_id, o.name FROM items i JOIN owners o ON o.id = i.owner_id WHERE i.id = $1",
        [item.rows[0].id],
      );
      assert.equal(state.rows[0].name, "Unassigned");
      assert.equal((await pool.query("SELECT 1 FROM owners WHERE id = $1", [owner.rows[0].id])).rowCount, 0);
    } finally {
      if (!inserter.released) {
        await inserter.query("ROLLBACK").catch(() => {});
        inserter.release();
      }
      deleter.release();
    }
  });

  await t.test("serializes a racing insert with category deletion", async () => {
    await resetDatabase(pool);
    const category = await pool.query(
      "INSERT INTO categories (name, slug) VALUES ('Race category', 'race-category') RETURNING id",
    );
    const owner = await pool.query("SELECT id FROM owners WHERE lower(name) = 'unassigned'");
    const inserter = await pool.connect();
    const deleter = await pool.connect();
    try {
      await inserter.query("BEGIN");
      const item = await inserter.query(
        "INSERT INTO items (category_id, owner_id, name) VALUES ($1, $2, 'Racing item') RETURNING id",
        [category.rows[0].id, owner.rows[0].id],
      );

      const deletion = deleteCategory(deleter, category.rows[0].id);
      await inserter.query("COMMIT");
      assert.equal(await deletion, true);

      const state = await pool.query(
        "SELECT i.category_id, c.slug FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id = $1",
        [item.rows[0].id],
      );
      assert.equal(state.rows[0].slug, "uncategorized");
      assert.equal(
        (await pool.query("SELECT 1 FROM categories WHERE id = $1", [category.rows[0].id])).rowCount,
        0,
      );
    } finally {
      await inserter.query("ROLLBACK").catch(() => {});
      inserter.release();
      deleter.release();
    }
  });

  await t.test("does not reuse a deleted owner id", async () => {
    await resetDatabase(pool);
    const first = await pool.query("INSERT INTO owners (name) VALUES ('First owner') RETURNING id");
    await pool.query("DELETE FROM owners WHERE id = $1", [first.rows[0].id]);
    const second = await pool.query("INSERT INTO owners (name) VALUES ('Second owner') RETURNING id");
    assert.ok(second.rows[0].id > first.rows[0].id);
  });

  await t.test("rejects case-variant owner names", async () => {
    await resetDatabase(pool);
    const results = await Promise.allSettled([
      pool.query("INSERT INTO owners (name) VALUES ('BOB')"),
      pool.query("INSERT INTO owners (name) VALUES ('bob')"),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );
  });

  await t.test("consolidates existing case-variant owners before adding uniqueness", async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await pool.query(`
      CREATE TABLE owners (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE items (id SERIAL PRIMARY KEY, owner_id INT NOT NULL REFERENCES owners(id));
      INSERT INTO owners (name) VALUES ('Bob'), ('bob');
      INSERT INTO items (owner_id) SELECT id FROM owners;
    `);
    await pool.query(await setupSql());

    const owners = await pool.query("SELECT id, name FROM owners WHERE lower(name) = 'bob'");
    const itemOwners = await pool.query("SELECT DISTINCT owner_id FROM items");
    assert.equal(owners.rowCount, 1);
    assert.deepEqual(itemOwners.rows, [{ owner_id: owners.rows[0].id }]);
  });

  await t.test("catalog refresh exactly mirrors its input", async () => {
    await resetDatabase(pool);
    await pool.query(
      "INSERT INTO lego_sets (set_num, name) VALUES ('stale-1', 'Stale set')",
    );
    await pool.query(`
      INSERT INTO items (category_id, owner_id, name, quantity, catalog_ref)
      SELECT categories.id, owners.id, 'Kept inventory item', 3, 'stale-1'
      FROM categories, owners
      WHERE categories.slug = 'other' AND lower(owners.name) = 'unassigned'
    `);
    const sets = [["current-1", "Current set", "2025", "Test theme", "10", ""]];
    await importCatalog(pool, sets);

    const rows = await pool.query("SELECT set_num, name FROM lego_sets ORDER BY set_num");
    const items = await pool.query(
      "SELECT name, quantity, catalog_ref FROM items WHERE name = 'Kept inventory item'",
    );
    assert.deepEqual(rows.rows, [{ set_num: "current-1", name: "Current set" }]);
    assert.deepEqual(items.rows, [
      { name: "Kept inventory item", quantity: 3, catalog_ref: "stale-1" },
    ]);
  });

  await t.test("concurrent catalog refreshes each leave an exact mirror", async () => {
    await resetDatabase(pool);
    const first = Array.from({ length: 5000 }, (_, index) => [
      `old-${index}`,
      `Old ${index}`,
      "2024",
      "Old",
      "1",
      "",
    ]);
    const second = [["current-1", "Current set", "2025", "Current", "2", ""]];
    await Promise.all([importCatalog(pool, first), importCatalog(pool, second)]);
    const rows = await pool.query("SELECT set_num FROM lego_sets ORDER BY set_num");
    assert.ok(
      rows.rows.length === first.length ||
        (rows.rows.length === 1 && rows.rows[0].set_num === "current-1"),
    );
  });

  await t.test("startup import does not overwrite a completed refresh", async () => {
    await resetDatabase(pool);
    const refresh = await pool.connect();
    await refresh.query("BEGIN");
    await refresh.query("LOCK TABLE lego_sets IN EXCLUSIVE MODE");

    const startup = importCatalog(
      pool,
      [["bundled-1", "Bundled set", "2024", "Bundled", "1", ""]],
      true,
    );
    await refresh.query(
      "INSERT INTO lego_sets (set_num, name) VALUES ('current-1', 'Current set')",
    );
    await refresh.query("COMMIT");
    refresh.release();
    await startup;

    const rows = await pool.query("SELECT set_num, name FROM lego_sets");
    assert.deepEqual(rows.rows, [{ set_num: "current-1", name: "Current set" }]);
  });
});
