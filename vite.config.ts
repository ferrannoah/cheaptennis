import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5199 },
  preview: { port: 4199 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
