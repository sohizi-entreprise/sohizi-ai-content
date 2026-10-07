import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite"
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
    ssr: {
      external: ["@sentry/tanstackstart-react"],
    },
    server: {
      fs: {
        allow: [repoRoot, rootDir, uiDir],
      },
    },
    plugins: [
      nitro({
        // Nitro/Rollup cannot bundle the Sentry server package; trace it into .output.
        rollupConfig: { external: [/^@sentry\//] },
        traceDeps: ["@sentry/tanstackstart-react*"],
      }),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      sentryTanstackStart({
        // Request and function middleware are installed in src/start.ts.
        autoInstrumentMiddleware: false,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT_SITE,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.SENTRY_RELEASE },
      }),
    ],
  }
})
