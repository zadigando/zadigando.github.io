import { defineConfig } from 'vite';

// Servido em /orbital/ (GitHub Pages serve subpastas); o site da raiz não é tocado.
export default defineConfig({
  base: '/orbital/',
  build: { outDir: 'dist', target: 'es2022', assetsInlineLimit: 0, cssCodeSplit: false },
  server: { port: 5180, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4180, strictPort: true, host: '127.0.0.1' },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
