import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5230, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
});
