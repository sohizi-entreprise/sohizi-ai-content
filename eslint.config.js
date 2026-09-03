import node from "@sohizi/eslint-config/node"
import react from "@sohizi/eslint-config/react"

const reactFiles = [
  "apps/web/**/*.{js,ts,tsx}",
  "apps/site/**/*.{js,ts,tsx}",
  "packages/ui/**/*.{js,ts,tsx}",
  "packages/video-composition/**/*.{js,ts,tsx}",
]

const nodeFiles = [
  "apps/api/**/*.{js,ts,tsx}",
  "apps/cloudflare/**/*.{js,ts,tsx}",
]

/** @param {import('eslint').Linter.Config[]} preset */
function applyTo(preset, files) {
  return preset.map((config) => {
    if (config.ignores && !config.files && !config.rules) {
      return config
    }
    return { ...config, files }
  })
}

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.wrangler/**",
      "**/.output/**",
      "**/.tanstack/**",
      "**/.nitro/**",
      "**/.vinxi/**",
      "**/eslint.config.js",
      "**/routeTree.gen.ts",
      "apps/cloudflare/worker-configuration.d.ts",
      "apps/api/src/db/migrations/**",
    ],
  },
  ...applyTo(react, reactFiles),
  ...applyTo(node, nodeFiles),
]
