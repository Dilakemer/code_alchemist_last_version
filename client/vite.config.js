import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 4000
  },
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.dev',
      '.ngrok.io'
    ]
  }
})
