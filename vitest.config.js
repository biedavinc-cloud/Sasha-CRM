import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// UI tests: renders the real <App/> in jsdom against a running `npm run cf:dev` (API + local D1).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:8788/' } },
    globals: true,
    setupFiles: ['tests/ui/setup.js'],
    include: ['tests/ui/**/*.test.jsx'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
