import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Also register the service worker in `npm run dev`, so the install prompt can be tested locally
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/crypto/',
        name: 'Coin Analysis',
        short_name: 'CoinAnalysis',
        description: 'Multi-timeframe crypto signals, autopilot and backtesting.',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        categories: ['finance', 'utilities'],
        start_url: '/crypto/',
        scope: '/crypto/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Backtest', url: '/crypto/#/backtest', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Only the built app shell is precached; market data and Telegram/Worker
        // calls always go to the network so nothing stale is ever traded on
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/crypto/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  base: '/crypto',
  build: {
    rollupOptions: {
      output: {
        // Vendor libraries in their own long-lived chunks so app updates stay small
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          charts: ['lightweight-charts'],
          hyperliquid: ['@nktkas/hyperliquid', 'viem'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
