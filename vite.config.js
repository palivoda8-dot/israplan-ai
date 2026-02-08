import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/commute': {
        target: 'https://israplan-ai-backend.vercel.app',
        changeOrigin: true,
      }
    }
  }
})