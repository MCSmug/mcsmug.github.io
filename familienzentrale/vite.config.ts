import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        name: 'Familienzentrale',
        short_name: 'Familie',
        description: 'Kalender, Aufgaben und Einkaufsliste für die ganze Familie.',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F4EF',
        theme_color: '#F6F4EF',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only precache the latin font subsets; others load on demand.
        globIgnores: ['**/*-{cyrillic,greek,vietnamese}*.woff2'],
        navigateFallback: '/index.html',
        // Push handling lives in a plain file that the generated worker loads.
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
})
