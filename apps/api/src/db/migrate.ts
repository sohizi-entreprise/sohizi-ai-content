import "dotenv/config"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { syncCatalog } from "@/catalog/populate"
import { db, pool } from "@/db"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? "/app/migrations"

try {
  await migrate(db, { migrationsFolder })
  await syncCatalog("populate")
  await pool.end()
  process.exit(0)
} catch (error) {
  console.error("Migration failed:", error)
  if (error instanceof Error && error.cause) {
    console.error("Cause:", error.cause)
  }
  await pool.end().catch(() => undefined)
  process.exit(1)
}
