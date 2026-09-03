import { defineConfig } from "@sohizi/eslint-config/node"

export default defineConfig({
  ignores: [
    "eslint.config.js",
    "worker-configuration.d.ts",
    "**/.wrangler/**",
    "**/dist/**",
  ],
})
