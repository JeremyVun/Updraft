import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicConfig } from './src/public-config.ts';

const revision = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * Writes dist/_headers: long-lived caching for hashed assets, and a Content-Security-Policy whose
 * inline-script hashes are computed from the built index.html itself, so they cannot drift from its
 * actual content (Cloudflare Workers static assets read this file the same way Pages does).
 */
function deploymentHeaders(): Plugin {
  let outDir = 'dist';
  return {
    name: 'updraft-deployment-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const hashes = Array.from(html.matchAll(INLINE_SCRIPT), match =>
        `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
      const analyticsOrigin = new URL(process.env.VITE_ANALYTICS_URL ?? publicConfig.analyticsUrl).origin;
      const csp = [
        `default-src 'self'`,
        `script-src 'self' ${hashes.join(' ')}`.trim(),
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob:`,
        `connect-src 'self' ${analyticsOrigin}`,
        `frame-ancestors 'none'`,
        `base-uri 'none'`,
        `form-action 'none'`,
      ].join('; ');
      const body = [
        '/*',
        `  Content-Security-Policy: ${csp}`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self)',
        '',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ].join('\n');
      writeFileSync(resolve(outDir, '_headers'), body);
    },
  };
}

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(revision + (dirty ? '-dirty' : '')) },
  server: { host: '127.0.0.1', port: 5230, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
  plugins: [deploymentHeaders()],
});
