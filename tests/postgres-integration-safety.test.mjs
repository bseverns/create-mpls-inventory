import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const integrationTestUrl = new URL("./postgres.integration.test.mjs", import.meta.url);

test("integration reset is guarded before a database pool is created", async () => {
  const source = await readFile(integrationTestUrl, "utf8");
  const guardIndex = source.indexOf("assertSafePostgresTestTarget(databaseUrl");
  const poolIndex = source.indexOf("new pg.Pool");

  assert.ok(guardIndex >= 0, "integration test must validate its target");
  assert.ok(poolIndex >= 0, "integration test must create a PostgreSQL pool");
  assert.ok(guardIndex < poolIndex, "target validation must precede database access");
});

test("reset guard rejects unsafe targets and accepts an explicit test target", async () => {
  const { assertSafePostgresTestTarget } = await import("./postgres-test-target.mjs");

  assert.throws(
    () => assertSafePostgresTestTarget("postgres://localhost/inventory_test"),
    /POSTGRES_TEST_CONFIRM_RESET=DROP_PUBLIC_SCHEMA/,
  );
  assert.throws(
    () => assertSafePostgresTestTarget("postgres://localhost/inventory", "DROP_PUBLIC_SCHEMA"),
    /must end in _test/,
  );
  assert.doesNotThrow(() =>
    assertSafePostgresTestTarget("postgresql://localhost/create_mpls_inventory_test", "DROP_PUBLIC_SCHEMA"),
  );
});
