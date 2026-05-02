import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'
import devServer from '@hono/vite-dev-server'

export default defineConfig({
  plugins: [
    pages(),
    devServer({
      entry: 'src/index.tsx',
    }),
  ],
  build: {
    outDir: 'dist',
    minify: true,
  },
})
