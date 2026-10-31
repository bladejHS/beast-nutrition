import { defineConfig } from 'vite';

// Served from https://bladejhs.github.io/beast-nutrition/
export default defineConfig({
  base: '/beast-nutrition/',
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
