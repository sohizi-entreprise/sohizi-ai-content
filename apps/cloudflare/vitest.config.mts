import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * The routes are exercised with fake bindings in plain Node rather than the
 * workers pool: containers need a Docker daemon, which no CI runner for this
 * package provides. The `cloudflare:*` built-ins are stubbed instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': path.resolve(
        rootDir,
        'test/stubs/cloudflare-workers.ts',
      ),
      'cloudflare:workflows': path.resolve(
        rootDir,
        'test/stubs/cloudflare-workflows.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
})
