import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // `npm run dev` (Vite) proxies the API to `npm run cf:dev` (Pages Functions + local D1)
    proxy: { '/api': 'http://localhost:8788' },
  },
})
