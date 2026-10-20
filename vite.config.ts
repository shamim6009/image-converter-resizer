import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/image-converter-resizer/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5173,
    open: false,
  },
  worker: {
    format: 'es',
  },
});