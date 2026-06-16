import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const remote = 'http://134.115.48.123'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/remote': {
        target: remote,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/remote/, ''),
      },
    },
  },
})
