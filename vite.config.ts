import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxied = [
  { prefix: '/github-raw', target: 'https://raw.githubusercontent.com' },
  { prefix: '/github-api', target: 'https://api.github.com' },
]

const proxy = Object.fromEntries(
  proxied.map((entry) => [
    entry.prefix,
    {
      target: entry.target,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(entry.prefix, ''),
    },
  ]),
)

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/ion-beam/' : '/',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy,
  },
})
