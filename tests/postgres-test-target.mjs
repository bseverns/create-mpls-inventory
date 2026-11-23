const RESET_CONFIRMATION = "DROP_PUBLIC_SCHEMA";
const TEST_DATABASE_NAME = /^[a-z0-9][a-z0-9_-]*_test$/i;

export function assertSafePostgresTestTarget(databaseUrl, confirmation) {
  if (confirmation !== RESET_CONFIRMATION) {
    throw new Error(`Set POSTGRES_TEST_CONFIRM_RESET=${RESET_CONFIRMATION} before resetting a database.`);
  }

  let target;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("POSTGRES_TEST_URL must be a valid PostgreSQL connection URL.");
  }

  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
    throw new Error("POSTGRES_TEST_URL must use the postgres or postgresql protocol.");
  }

  const databaseName = target.pathname.slice(1);
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error("POSTGRES_TEST_URL database name must end in _test.");
  }
}
