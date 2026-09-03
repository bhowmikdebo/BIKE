import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.RIDEON_PORT || 4173}`, changeOrigin: false } },
  },
})
