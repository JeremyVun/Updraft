// Build both variants and check the shipped code, plus query handling without a browser or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = execFileSync('mktemp', ['-d', '/tmp/updraft-production-check.XXXXXX'], { encoding: 'utf8' }).trim();
const entry = path.join(output, 'params.mjs');
fs.writeFileSync(entry, `import { params } from ${JSON.stringify(path.join(root, 'src/params.ts'))}; globalThis.result = params;`);
const overrides = '?shot&chapter=stage&progress=0&debug=wind&ratio=3&cam=1,2,3,4,5,6&sun=90,30'
  + '&grass=0&msaa=0&dusk=2&shower=1&storm=1&lite&mirror=0&mirrorlod=full&blades=direct'
  + '&heights=direct&grasslod=0&hold=1&stats&whale&lines&coldshaders&depth=1&stale=0&start=0';
const variants = {};
for (const qa of [false, true]) {
  const fixture = await build({
    root, configFile: false, envDir: false, publicDir: false, logLevel: 'silent',
    define: { __QA__: qa },
    build: { write: false, minify: true, lib: { entry, name: 'Parameters', formats: ['iife'] } },
  });
  const code = [fixture].flat().flatMap(result => result.output).find(item => item.type === 'chunk').code;
  const read = search => {
    const context = { URLSearchParams, location: { get search() {
      assert(qa, 'production must not even read the game query string');
      return search;
    } } };
    vm.runInNewContext(code, context);
    return JSON.parse(JSON.stringify(context.result));
  };
  const defaults = read('');
  const changed = read(overrides);
  if (qa) {
    assert.deepEqual(defaults, variants.production.defaults);
    assert.equal(changed.chapter, 'stage');
    assert.equal(changed.shot, true);
    assert.equal(changed.progress, false);
    assert.deepEqual(changed.cam, [1, 2, 3, 4, 5, 6]);
    assert.equal(changed.ratio, 3);
    assert.equal(changed.hold, 1);
    assert.equal(changed.blades, 'direct');
    assert.equal(changed.stats, true);
    assert.equal(changed.coldshaders, true);
  } else {
    assert.deepEqual(changed, defaults);
    assert.equal(defaults.chapter, null);
    assert.equal(defaults.shot, false);
    assert.equal(defaults.progress, true);
  }
  const mode = qa ? 'qa' : 'production';
  const built = await build({
    root, envDir: false, mode, logLevel: 'warn',
    build: { outDir: path.join(output, mode), emptyOutDir: true },
  });
  const js = built.output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  const css = built.output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
  for (const marker of ['__game', '__stats', '__ready', 'uScalars', 'k-above', 'footWas', 'frame p50', 'uPoints[', 'pondBankAt(root2)) * widthAt(dist) * stand;']) {
    assert.equal(js.includes(marker), qa, `${mode}: QA code marker ${marker}`);
  }
  assert.equal(css.includes('body.shot'), qa, `${mode}: QA styles`);
  assert.equal(/\.get\([`'"](?:chapter|shot|depth|stale|start|blades|heights)[`'"]\)/.test(js), qa, `${mode}: game query parser`);
  assert(!js.includes('__QA__'), 'build switch must be replaced at compile time');
  assert(built.output.some(item => item.type === 'chunk' && item.fileName.includes('chapter-select')), 'player chapter select must remain');
  variants[mode] = { defaults, jsBytes: Buffer.byteLength(js), cssBytes: Buffer.byteLength(css) };
}
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(variants, null, 2));
console.log(`Production ignores all game overrides; QA retains them. QA tools/styles are absent from production. Evidence: ${output}`);
console.log(`JavaScript: production ${variants.production.jsBytes} bytes; QA ${variants.qa.jsBytes} bytes.`);
