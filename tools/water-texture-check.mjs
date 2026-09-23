// Exact packed-byte parity with the original generators at commit 188c9fa, including odd resolutions.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
const { rippleTexture, laceTexture } = await import('../src/world/water/textures.ts');
const fixtures = JSON.parse(fs.readFileSync(new URL('./lib/water-texture-hashes.json', import.meta.url), 'utf8'));
const timings = [];
for (const {name, res, hash} of fixtures) {
  const start = performance.now();
  const texture = (name === 'rippleTexture' ? rippleTexture : laceTexture)(res);
  timings.push({name, res, ms: Math.round((performance.now() - start) * 100) / 100});
  assert.equal(createHash('sha256').update(texture.image.data).digest('hex'), hash, `${name} ${res}: pixel bytes changed`);
  assert.equal(texture.image.width, res); assert.equal(texture.image.height, res);
  assert.equal(texture.wrapS, THREE.RepeatWrapping); assert.equal(texture.wrapT, THREE.RepeatWrapping);
  assert.equal(texture.magFilter, THREE.LinearFilter); assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(texture.generateMipmaps, true); assert.equal(texture.anisotropy, 8);
  texture.dispose();
}
console.log(JSON.stringify({checks: fixtures.length, timings}));
