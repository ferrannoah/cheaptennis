import { defineConfig } from '@playwright/test';

const port = process.env.PREVIEW ? 4199 : 5199;
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 1,
    channel: process.env.PW_CHANNEL ?? 'msedge',
  },
  webServer: process.env.PREVIEW
    ? { command: 'npx vite preview --port 4199 --strictPort', port: 4199, reuseExistingServer: true }
    : { command: 'npx vite --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
});
