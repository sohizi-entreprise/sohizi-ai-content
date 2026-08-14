import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// @hyperframes/core's main entry re-exports compiler modules that import `path.posix`,
// which is undefined in the browser. Client code only needs types + variable guards.
const hyperframesCoreClient = path.resolve(
  rootDir,
  'node_modules/@hyperframes/core/dist/core.types.js',
)

// One composition definition drives both the editor preview and the Cloudflare
// renderer. The package lives outside this app, so Vite needs the explicit
// alias plus permission to read from the repository root.
const repoRoot = path.resolve(rootDir, '..')
const videoCompositionDir = path.resolve(
  repoRoot,
  'cloudflare/packages/video-composition',
)
const videoCompositionEntry = path.resolve(videoCompositionDir, 'src/index.ts')

const config = defineConfig({
  resolve: {
    alias: {
      '@hyperframes/core': hyperframesCoreClient,
      '@sohizi/video-composition': videoCompositionEntry,
    },
    // The composition package resolves React and Remotion from its own
    // directory, so they have to collapse onto this app's copies.
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/captions'],
  },
  server: {
    fs: {
      allow: [rootDir, videoCompositionDir],
    },
  },
  ssr: {
    // Bundle so Vite resolves extensionless relative imports (Node ESM requires .js)
    noExternal: ['tiptap-pagination-plus', '@cyntler/react-doc-viewer'],
  },
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
