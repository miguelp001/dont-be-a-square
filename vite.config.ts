/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  test: {
    environment: 'happy-dom',
    coverage: {
      include: ['src/engine/**'],
      reporter: ['text', 'json', 'html']
    }
  }
});

