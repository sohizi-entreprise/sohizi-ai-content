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

const config = defineConfig({
  resolve: {
    alias: {
      '@hyperframes/core': hyperframesCoreClient,
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
