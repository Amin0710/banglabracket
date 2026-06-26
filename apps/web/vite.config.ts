import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + auth to the backend so the session cookie stays same-origin.
// The app is served under /wc2026/app so the brand can host future tournaments
// (e.g. /euro2028/app) on the same domain.
export default defineConfig({
  base: process.env.VITE_APP_BASE || '/wc2026/app/',
  // Emit into dist/wc2026/app so the physical file paths match the request paths
  // (Vercel serves dist/ at the domain root → /wc2026/app/assets/* resolve directly,
  // no rewrites needed for assets).
  build: { outDir: 'dist/wc2026/app', emptyOutDir: true },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/auth': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
