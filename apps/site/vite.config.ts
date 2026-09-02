import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, "../..")
const uiDir = path.resolve(repoRoot, "packages/ui")

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "")
  process.env.APP_URL ??= env.APP_URL

  return {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    server: {
      fs: {
        allow: [repoRoot, rootDir, uiDir],
      },
    },
    plugins: [
      nitro(),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})
