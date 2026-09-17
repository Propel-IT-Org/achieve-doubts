import { resolve } from "node:path";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { createDatabase } from ".";

/**
 * Applies the SQL in drizzle/ using drizzle-orm's runtime migrator, so the
 * release image needs neither drizzle-kit nor node_modules. Applied
 * migrations are recorded in the same `drizzle.__drizzle_migrations` table
 * drizzle-kit uses, so either tool can be used against the same database.
 *
 * The folder resolves against the working directory — /app in the image,
 * backend/ locally. MIGRATIONS_DIR overrides it.
 */
export async function runMigrations() {
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "drizzle");
  const db = createDatabase();

  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] done");
  } finally {
    await db.$client.close();
  }
}
