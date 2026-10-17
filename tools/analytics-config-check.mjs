// Build the real telemetry and deployment headers together, without a game renderer or network requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fs.mkdtempSync(path.join(tmpdir(), 'updraft-analytics-config-'));
fs.writeFileSync(path.join(fixture, 'index.html'), '<script type="module" src="/entry.js"></script>');
fs.writeFileSync(path.join(fixture, 'entry.js'), `import { telemetry } from ${JSON.stringify(path.join(root, 'src/analytics/telemetry.ts'))}; globalThis.telemetry = telemetry;`);
const original = process.env.VITE_ANALYTICS_URL;
try {
  for (const [name, url] of [['default', undefined], ['disabled', ''], ['blank', '  '], ['custom', ' https://metrics.example.invalid/collect ']]) {
    if (url === undefined) delete process.env.VITE_ANALYTICS_URL;
    else process.env.VITE_ANALYTICS_URL = url;
    const outDir = path.join(fixture, name);
    const built = await build({
      root: fixture, configFile: path.join(root, 'vite.config.ts'), envDir: false, publicDir: false, logLevel: 'silent',
      build: { outDir, modulePreload: false },
    });
    const requests = [];
    const context = vm.createContext({
      URLSearchParams, AbortController, TextEncoder, location: { search: '' }, navigator: { doNotTrack: '0' }, document: { hidden: false },
      setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
      fetch: (url, options) => { requests.push({ url, ...options }); return Promise.resolve({ status: 204 }); },
    });
    for (const item of built.output) if (item.type === 'chunk') vm.runInContext(item.code, context);
    const { telemetry } = context;
    telemetry.start('stairs', false);telemetry.flush();
    const headers = fs.readFileSync(path.join(outDir, '_headers'), 'utf8');
    const connect = headers.match(/connect-src ([^;\n]+)/)[1];
    if (name === 'disabled' || name === 'blank') {
      assert.equal(telemetry.enabled(), false);
      assert.equal(requests.length, 0);
      assert.equal(connect, "'self'");
    } else {
      assert.equal(telemetry.enabled(), true);
      assert.equal(requests.length, 1);
      assert.equal(connect, `'self' ${new URL(requests[0].url).origin}`);
      if (name === 'custom') assert.equal(requests[0].url, 'https://metrics.example.invalid/collect/e');
    }
    console.log(`${name}: build, runtime delivery and connect-src agree`);
  }
} finally {
  if (original === undefined) delete process.env.VITE_ANALYTICS_URL;
  else process.env.VITE_ANALYTICS_URL = original;
}
console.log(`Analytics configuration evidence: ${fixture}`);
