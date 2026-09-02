import { defineConfig } from '@sohizi/eslint-config/react'

export default defineConfig({
  ignores: [
    'eslint.config.js',
    '**/routeTree.gen.ts',
    '**/.tanstack/**',
    '**/.output/**',
    '**/.nitro/**',
  ],
})
