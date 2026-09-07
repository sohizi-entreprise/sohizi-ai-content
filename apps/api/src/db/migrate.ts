import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? "/app/migrations"

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle(pool)

try {
  await migrate(db, { migrationsFolder })
  await pool.end()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await pool.end().catch(() => undefined)
  process.exit(1)
}
