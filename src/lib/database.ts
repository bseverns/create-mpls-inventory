import { Pool, type PoolClient } from "pg";
import { importCatalogFromFilesIfEmpty } from "@/lib/catalog";

const globalStore = globalThis as unknown as {
  pool?: Pool;
  setup?: Promise<void>;
};
if (!globalStore.pool) {
  globalStore.pool = new Pool({ connectionString: process.env.DATABASE_URL });
}
const pool: Pool = globalStore.pool;

// Runs when the website starts
const SETUP_SQL = `
BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS statuses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'slate'
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id),
  owner_id INT NOT NULL REFERENCES owners(id),
  status_id INT REFERENCES statuses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  notes TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  image_data BYTEA,
  image_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  catalog_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lego_sets (
  set_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INT,
  theme TEXT NOT NULL DEFAULT '',
  num_parts INT,
  img_url TEXT
);

-- Older databases allowed owner names that differed only by case. Keep the
-- oldest owner and preserve every item's assignment before enforcing the rule.
WITH owner_copies AS (
  SELECT id, min(id) OVER (PARTITION BY lower(name)) AS canonical_id
  FROM owners
), moved_items AS (
  UPDATE items
  SET owner_id = owner_copies.canonical_id
  FROM owner_copies
  WHERE items.owner_id = owner_copies.id
    AND owner_copies.id <> owner_copies.canonical_id
)
DELETE FROM owners
USING owner_copies
WHERE owners.id = owner_copies.id
  AND owner_copies.id <> owner_copies.canonical_id;

CREATE UNIQUE INDEX IF NOT EXISTS owners_name_lower_key ON owners (lower(name));

-- Starter rows, added only to a brand new database
-- (WHERE NOT EXISTS is used instead of ON CONFLICT so no id numbers are skipped)
INSERT INTO categories (name, slug, description)
SELECT starter.* FROM (VALUES
  ('LEGO Sets', 'lego-sets', 'Complete sets and robotics kits'),
  ('LEGO Pieces', 'lego-pieces', 'Loose bricks, elements and parts'),
  ('Electronics & Tools', 'electronics-tools', 'Laptops, chargers, tools and supplies'),
  ('Other', 'other', 'Everything else')
) AS starter(name, slug, description)
WHERE NOT EXISTS (SELECT 1 FROM categories);

-- Uncategorized is the built-in category for items without a category
INSERT INTO categories (name, slug, description)
SELECT 'Uncategorized', 'uncategorized', 'Items without a category'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'uncategorized');

INSERT INTO statuses (name, slug, color)
SELECT starter.* FROM (VALUES
  ('Complete', 'complete', 'green'),
  ('Needs sorting', 'needs-sorting', 'amber'),
  ('Incomplete', 'incomplete', 'red'),
  ('Needs repair', 'needs-repair', 'purple'),
  ('Retired', 'retired', 'slate')
) AS starter(name, slug, color)
WHERE NOT EXISTS (SELECT 1 FROM statuses);

-- Unassigned is the built-in owner for items that have no owner
INSERT INTO owners (name)
SELECT 'Unassigned'
WHERE NOT EXISTS (SELECT 1 FROM owners WHERE lower(name) = 'unassigned');

COMMIT;
`;

// Creates the tables the first time, and starts loading the LEGO catalog in the background
export async function prepareDatabase() {
  if (!globalStore.setup) {
    globalStore.setup = pool
      .query(SETUP_SQL)
      .then(() => {
        importCatalogFromFilesIfEmpty(pool);
      })
      .catch((error) => {
        globalStore.setup = undefined;
        throw error;
      });
  }
  await globalStore.setup;
  return pool;
}

// Runs one SQL query and returns the rows
export async function queryDatabase<Row = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) {
  const readyPool = await prepareDatabase();
  const result = await readyPool.query(sql, values);
  return result.rows as Row[];
}

export async function withTransaction<Result>(
  work: (client: PoolClient) => Promise<Result>,
) {
  const readyPool = await prepareDatabase();
  const client = await readyPool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
