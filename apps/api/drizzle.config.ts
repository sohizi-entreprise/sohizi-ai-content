import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./src/db/migrations",
  // Import the public schema only. A glob here also picks up leftover
  // copies (e.g. copy-auth.ts) and Drizzle will treat those as extra tables.
  schema: "./src/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
