import { defineConfig } from "@sohizi/eslint-config/node"

export default defineConfig({
  ignores: ["eslint.config.js", "src/db/migrations/**"],
})
