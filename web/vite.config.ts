import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/gamehub': {
        target: 'http://localhost:5197',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
