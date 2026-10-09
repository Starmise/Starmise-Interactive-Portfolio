import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el sitio se sirve desde https://starmise.github.io/Starmise-Interactive-Portfolio/
  base: './',
  build: {
    outDir: 'dist',
    // Los modelos y texturas ya son pequeños; no incrustarlos como base64 en el JS.
    assetsInlineLimit: 0,
    // Three.js por sí solo ronda los 600 kB minificado.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    open: true,
  },
});
