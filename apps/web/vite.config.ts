import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, "../..")
const require = createRequire(import.meta.url)

// @hyperframes/core's main entry re-exports compiler modules that import `path.posix`,
// which is undefined in the browser. Client code only needs types + variable guards.
const hyperframesCoreClient = path.resolve(
  path.dirname(require.resolve("@hyperframes/core/package.json")),
  "dist/core.types.js",
)

// One composition definition drives both the editor preview and the Cloudflare
// renderer. Resolve the workspace package as source and collapse React/Remotion
// onto this app's copies.
const videoCompositionDir = path.resolve(repoRoot, "packages/video-composition")
const videoCompositionEntry = path.resolve(videoCompositionDir, "src/index.ts")
const uiDir = path.resolve(repoRoot, "packages/ui")

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "")
  process.env.SITE_URL ??= env.SITE_URL
  process.env.MEDIA_CDN_URL ??= env.MEDIA_CDN_URL

  return {
    resolve: {
      alias: {
        "@hyperframes/core": hyperframesCoreClient,
        "@sohizi/video-composition": videoCompositionEntry,
      },
      dedupe: ["react", "react-dom", "remotion", "@remotion/captions"],
    },
    server: {
      fs: {
        allow: [repoRoot, rootDir, videoCompositionDir, uiDir],
      },
      proxy: {
        "/api": {
          target: "http://localhost:3030",
          changeOrigin: true,
          rewrite: (proxyPath) =>
            proxyPath.startsWith("/api/auth") ||
            proxyPath.startsWith("/api/inngest")
              ? proxyPath
              : proxyPath.replace(/^\/api/, "") || "/",
        },
      },
    },
    ssr: {
      // Bundle so Vite resolves extensionless relative imports (Node ESM requires .js)
      noExternal: ["@cyntler/react-doc-viewer"],
    },
    plugins: [
      devtools(),
      nitro({
        routeRules: {
          "/api/auth": { proxy: "http://localhost:3030/api/auth" },
          "/api/auth/**": { proxy: "http://localhost:3030/api/auth/**" },
          "/api/inngest": { proxy: "http://localhost:3030/api/inngest" },
          "/api/inngest/**": { proxy: "http://localhost:3030/api/inngest/**" },
          "/api/**": { proxy: "http://localhost:3030/**" },
        },
      }),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
