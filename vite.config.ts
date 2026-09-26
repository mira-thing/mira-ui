import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3678'

// Daemon API proxy
const apiProxy = {
  '/observer': API_TARGET,
  '/connect': API_TARGET,
  '/lyrics': API_TARGET,
  '/player': API_TARGET,
  '/web-api': API_TARGET,
  '/token': API_TARGET,
  '/auth': API_TARGET,
  '/bluetooth': API_TARGET,
  '/network': API_TARGET,
  '/system': API_TARGET,
  '/settings': API_TARGET,
  '/debug': API_TARGET,
  '/events': { target: API_TARGET, ws: true, changeOrigin: true },
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // car thing runs on chrome 69
    legacy({
      targets: ['chrome 69'],
      renderModernChunks: false,
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;\n@use "@/styles/mixins" as *;\n`,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    assetsInlineLimit: 4096,
  },
})
