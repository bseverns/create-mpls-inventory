import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const database = await readFile(
  new URL("../src/lib/database.ts", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../src/lib/actions.ts", import.meta.url),
  "utf8",
);
const compose = await readFile(
  new URL("../docker-compose.yml", import.meta.url),
  "utf8",
);
const itemForm = await readFile(
  new URL("../src/components/item-form-fields.tsx", import.meta.url),
  "utf8",
);
const addMenu = await readFile(
  new URL(
    "../src/components/add-new-item-category-owner-or-status-menu.tsx",
    import.meta.url,
  ),
  "utf8",
);
const itemCard = await readFile(
  new URL("../src/components/item-card.tsx", import.meta.url),
  "utf8",
);
const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
const catalog = await readFile(
  new URL("../src/lib/catalog.ts", import.meta.url),
  "utf8",
);

test("database setup retries after a transient failure", () => {
  assert.match(database, /globalStore\.setup = undefined/);
});

test("owner names are unique regardless of case", () => {
  assert.match(database, /UNIQUE INDEX[\s\S]*owners[\s\S]*lower\(name\)/i);
  assert.match(database, /UPDATE items[\s\S]*owner_id[\s\S]*DELETE FROM owners/i);
  assert.match(actions, /23505/);
});

test("Compose passes PostgreSQL credentials without building a URL", () => {
  assert.doesNotMatch(compose, /DATABASE_URL:\s*postgres:/);
  for (const variable of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) {
    assert.match(compose, new RegExp(`\\b${variable}:`));
  }
});

test("an existing item photo can be removed", () => {
  assert.match(itemForm, /name="remove_image"/);
  assert.match(actions, /remove_image/);
  assert.match(actions, /image_url = NULL, image_data = NULL, image_type = NULL/);
});

test("Add Item reports form-options failures", () => {
  assert.match(addMenu, /toast\.error/);
  assert.match(addMenu, /disabled=\{isLoadingItem\}/);
  assert.match(addMenu, /isLoadingItem\s*\?\s*"Loading item/);
  assert.doesNotMatch(addMenu, /useEffect/);
});

test("rapid quantity changes accumulate in local state", () => {
  assert.match(itemCard, /setQuantity\(\(current\) => current \+ amount\)/);
});

test("Docker checks the upstream catalog instead of caching a fetch script forever", () => {
  assert.doesNotMatch(dockerfile, /RUN node scripts\/fetch-catalog\.mjs/);
  assert.match(dockerfile, /ADD https:\/\/cdn\.rebrickable\.com\/media\/downloads\/sets\.csv\.gz \/app\/data\/sets\.csv\.gz/);
  assert.match(dockerfile, /ADD https:\/\/cdn\.rebrickable\.com\/media\/downloads\/themes\.csv\.gz \/app\/data\/themes\.csv\.gz/);
});

test("catalog refresh removes sets missing upstream", () => {
  assert.match(catalog, /LOCK TABLE lego_sets IN EXCLUSIVE MODE/);
  assert.match(catalog, /DELETE FROM lego_sets/);
  assert.match(catalog, /NOT IN \(SELECT/);
});

test("startup catalog emptiness is checked after taking the import lock", () => {
  assert.match(
    catalog,
    /LOCK TABLE lego_sets IN EXCLUSIVE MODE[\s\S]*if \(onlyIfEmpty\)[\s\S]*SELECT count\(\*\)::int AS set_count/,
  );
  assert.match(catalog, /importCatalog\(pool, false, true\)/);
});
