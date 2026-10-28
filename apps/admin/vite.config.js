import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  preview: { port: 4174 },
  // Internal dashboard: one bundle (~160 kB gzip incl. Uppy + dnd-kit) is fine.
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 800 },
});
