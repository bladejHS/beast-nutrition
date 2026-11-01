import { defineConfig } from 'vite';

// Served from https://bladejhs.github.io/beast-nutrition/
export default defineConfig({
  base: '/beast-nutrition/',
  build: { target: 'es2022', assetsInlineLimit: 0 },
  // The version shown in Plan: the commit on GitHub, "local" on this machine.
  define: { __BUILD__: JSON.stringify(process.env['GITHUB_SHA']?.slice(0, 7) ?? 'local') },
});
