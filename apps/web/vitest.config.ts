import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, '../..')
const require = createRequire(import.meta.url)

/**
 * Unit tests run without the TanStack Start / Nitro plugins from
 * `vite.config.ts`: those build a server environment where React's hook
 * dispatcher is unavailable. The aliases below mirror the app config.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@hyperframes/core': path.resolve(
        path.dirname(require.resolve('@hyperframes/core/package.json')),
        'dist/core.types.js',
      ),
      '@sohizi/video-composition': path.resolve(
        repoRoot,
        'packages/video-composition/src/index.ts',
      ),
    },
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/captions'],
  },
  plugins: [viteTsConfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
