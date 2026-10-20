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
});
