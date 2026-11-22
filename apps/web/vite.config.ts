import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import type { Plugin } from "vite"

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

// Heavy client-only packages. Stubbed during SSR so Nitro/Vite do not walk
// mermaid/remotion/shiki/etc (TanStack still emits ssr:false route chunks).
const heavyClientPackages = [
  "remotion",
  "@remotion/player",
  "@remotion/captions",
  "@hyperframes/core",
  "@hyperframes/player",
  "@sohizi/video-composition",
  "streamdown",
  "@streamdown/cjk",
  "@streamdown/code",
  "@streamdown/math",
  "@streamdown/mermaid",
  "mermaid",
  "@cyntler/react-doc-viewer",
  "react-player",
  "wavesurfer.js",
  "@xzdarcy/react-timeline-editor",
  "@xzdarcy/timeline-engine",
  "@tsparticles/engine",
  "@tsparticles/react",
  "@tsparticles/slim",
  "recharts",
  "shiki",
  "@shikijs/core",
  "@shikijs/langs",
  "@shikijs/themes",
  "@shikijs/engine-javascript",
  "@shikijs/engine-oniguruma",
  "@shikijs/types",
  "@shikijs/vscode-textmate",
  "katex",
  "cytoscape",
  "hls.js",
  "dashjs",
] as const

function isHeavyClientId(id: string): boolean {
  const bare = id.split("?")[0] ?? id
  if (
    bare === videoCompositionEntry ||
    bare === hyperframesCoreClient ||
    bare.startsWith(`${videoCompositionDir}${path.sep}`)
  ) {
    return true
  }

  for (const pkg of heavyClientPackages) {
    if (bare === pkg || bare.startsWith(`${pkg}/`)) return true
    const normalized = bare.replaceAll("\\", "/")
    if (
      normalized.includes(`/node_modules/${pkg}/`) ||
      normalized.includes(`/node_modules/${pkg}@`)
    ) {
      return true
    }
  }
  return false
}

/**
 * Replace heavy browser-only packages with tiny stubs during the SSR/Nitro
 * build. `ssr.external` alone is not enough: Nitro still bundles these into
 * `.output/server/_libs` for `ssr: false` route chunks.
 */
function stubHeavyClientSsr(): Plugin {
  return {
    name: "stub-heavy-client-ssr",
    enforce: "pre",
    apply: "build",
    resolveId(id, _importer, options) {
      if (!options.ssr) return
      if (!isHeavyClientId(id)) return
      return {
        id: `\0heavy-ssr-stub:${id}`,
        syntheticNamedExports: true,
      }
    },
    load(id) {
      if (!id.startsWith("\0heavy-ssr-stub:")) return
      const source = id.slice("\0heavy-ssr-stub:".length).split("?")[0] ?? ""
      // CSS/asset imports must not receive a JS stub (Tailwind/Vite parse them).
      if (
        /\.(css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|woff2?|ttf|eot)$/i.test(
          source,
        )
      ) {
        return "/* heavy client asset stubbed for SSR */"
      }
      return `
        const noop = () => null;
        const stub = new Proxy(noop, {
          get(target, prop) {
            if (prop === "__esModule") return true;
            if (prop === "then") return undefined;
            if (prop === "default") return stub;
            if (prop === Symbol.toStringTag) return "Module";
            return stub;
          },
          apply() {
            return null;
          },
        });
        export default stub;
      `
    },
  }
}

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "")
  process.env.SITE_URL ??= env.SITE_URL
  process.env.MEDIA_CDN_URL ??= env.MEDIA_CDN_URL
  const apiUrl = env.API_URL || process.env.API_URL || "http://localhost:3030"

  // Skip source maps in constrained Docker builds unless Sentry upload is enabled.
  const enableSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN)

  return {
    build: {
      sourcemap: enableSourceMaps,
    },
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
          target: apiUrl,
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
      // Keep Sentry external: bundling @sentry/node OOMs the Vite/Nitro build.
      external: ["@sentry/tanstackstart-react"],
    },
    plugins: [
      stubHeavyClientSsr(),
      ...(mode === "development" ? [devtools()] : []),
      nitro({
        // Nitro cannot safely bundle the Sentry server SDK (OOM). Trace the
        // runtime package into .output; Dockerfiles prune build-only transitive
        // deps (@sentry/bundler-plugins → vite/esbuild/rollup/sentry-cli).
        rollupConfig: { external: [/^@sentry\//] },
        traceDeps: ["@sentry/tanstackstart-react*"],
        routeRules: {
          "/api/auth": { proxy: `${apiUrl}/api/auth` },
          "/api/auth/**": { proxy: `${apiUrl}/api/auth/**` },
          "/api/inngest": { proxy: `${apiUrl}/api/inngest` },
          "/api/inngest/**": { proxy: `${apiUrl}/api/inngest/**` },
          "/api/**": { proxy: `${apiUrl}/**` },
        },
      }),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackStart({
        router: {
          // Split route components into separate chunks so heavy editor/media
          // code is not eagerly pulled into the SSR server entry.
          autoCodeSplitting: true,
        },
      }),
      viteReact(),
      sentryTanstackStart({
        // Request and function middleware are installed in src/start.ts.
        autoInstrumentMiddleware: false,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT_WEB,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.SENTRY_RELEASE },
        // Avoid generating/uploading maps when no auth token is present.
        sourcemaps: enableSourceMaps
          ? undefined
          : {
              disable: true,
            },
      }),
    ],
  }
})

export default config
