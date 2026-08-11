import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  base: '/ub/',
  build: {
    outDir: '../build/ub',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        fisica3: fileURLToPath(new URL('./fisica3/index.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://jpg.computer',
        changeOrigin: true,
      },
    },
  },
})
