/**
 * Remove build-only packages that Nitro traces into `.output/server/node_modules`
 * because `@sentry/tanstackstart-react` depends on `@sentry/bundler-plugins`.
 *
 * Usage: bun scripts/prune-nitro-trace.mjs [path/to/.output]
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"

const outputDir = resolve(process.argv[2] ?? ".output")
const nm = resolve(outputDir, "server/node_modules")

const prune = new Set([
  "vite",
  "esbuild",
  "rollup",
  "tsx",
  "postcss",
  "jiti",
  "lightningcss",
  "fsevents",
  "yaml",
  "glob",
  "dotenv",
  "magic-string",
  "tinyglobby",
  "picomatch",
  "picocolors",
  "fdir",
  "es-module-lexer",
  "cjs-module-lexer",
  "detect-libc",
  "source-map-js",
  "nanoid",
  "oxc-parser",
  "@esbuild",
  "@rollup",
  "@oxc-parser",
  "@jridgewell",
  // npm package "sentry" is the CLI; runtime SDK lives under @sentry/*
  "sentry",
])

if (!existsSync(nm)) {
  process.exit(0)
}

for (const name of readdirSync(nm)) {
  if (name === "package.json") continue
  if (prune.has(name) || name.startsWith("lightningcss-")) {
    rmSync(resolve(nm, name), { recursive: true, force: true })
  }
}

// Nested under @sentry/ after Nitro flattens the traced tree
const nestedBuildOnly = [resolve(nm, "@sentry/bundler-plugins")]
for (const path of nestedBuildOnly) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
}

const pkgPath = resolve(nm, "package.json")
if (existsSync(pkgPath)) {
  const data = JSON.parse(readFileSync(pkgPath, "utf8"))
  const deps = data.dependencies ?? {}
  for (const key of Object.keys(deps)) {
    if (
      prune.has(key) ||
      key.startsWith("lightningcss-") ||
      key === "@sentry/bundler-plugins"
    ) {
      delete deps[key]
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(data, null, 2)}\n`)
}
