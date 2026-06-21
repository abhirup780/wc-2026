import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { exec } from 'child_process';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we manage manifest.json in /public manually
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
    {
      name: 'simulate-api',
      configureServer(server) {
        server.middlewares.use('/api/simulate', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
          res.setHeader('Content-Type', 'application/json');
          exec(
            'npm run simulate',
            { cwd: path.resolve(__dirname, '..') },
            (err, _stdout, stderr) => {
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, error: stderr || err.message }));
              } else {
                res.end(JSON.stringify({ ok: true }));
              }
            },
          );
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@wc2026/shared': path.resolve(__dirname, '../shared/src/types.ts'),
    },
  },
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
});
