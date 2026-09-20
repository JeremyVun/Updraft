import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

const revision = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(revision + (dirty ? '-dirty' : '')) },
  server: { host: '127.0.0.1', port: 5230, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
});
