// Integrate the actual shader along the same world sightline from either end and from a moved eye.
// OLD_SHADER=<saved atmosphere.ts> proves the former camera-dependent layers fail these checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/__mist_probe__', route => route.fulfill({ contentType: 'text/html', body: '<title>Mist field check</title>' }));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}__mist_probe__?villagefog=mist`);
  const result = await page.evaluate(async old => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ATMO_GLSL, atmo, SEA_FOG_TOP } = await import('/src/world/atmosphere.ts');
    const { tuning } = await import('/src/tuning.ts');
    const renderer = new THREE.WebGLRenderer();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: false });
    let source = ATMO_GLSL, expression = 'mistOptical(eye, direction, reach)';
    if (old) {
      const text = old.slice(old.indexOf('float mistBelow('), old.indexOf('vec4 seaFog(vec3 ro', old.indexOf('float mistBelow(')));
      const glsl = n => Number.isInteger(n) ? `${n}.0` : String(n);
      const legacy = new Function('glsl', 'tuning', 'SEA_FOG_TOP', `return \`${text}\`;`)(glsl,
        { ...tuning, drowned: { ...tuning.drowned, fog: { ...tuning.drowned.fog, mistRelief: .16, mistSoftness: 1.8 } } }, SEA_FOG_TOP)
        .replace('return vec4(colour, alpha);', 'return vec4(optical);');
      source = source.slice(0, source.indexOf('float mistDensityAt(')) + legacy + source.slice(source.indexOf('vec4 seaFog(vec3 ro'));
      expression = 'seaMist(eye, direction, reach, false).x';
    }
    const u = atmo.uniforms;
    u.uSeaFog.value.set(0, 0, 0, 1);
    u.uSeaFogSides.value.set(170, 306, 60, 128);
    u.uSeaFogRelief.value = 1;
    u.uTime.value = 12;
    const material = new THREE.ShaderMaterial({
      uniforms: { ...u, eye: { value: new THREE.Vector3() }, direction: { value: new THREE.Vector3() }, reach: { value: 0 } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `${source}\nuniform vec3 eye; uniform vec3 direction; uniform float reach;
        void main() { float d = ${expression}; gl_FragColor = vec4(d, d, d, 1.0); }`,
    });
    const scene = new THREE.Scene(), camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; scene.add(mesh); renderer.setRenderTarget(target);
    const pixel = new Float32Array(4);
    const read = (a, b) => {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
      material.uniforms.eye.value.copy(from);
      material.uniforms.direction.value.subVectors(to, from).normalize();
      material.uniforms.reach.value = from.distanceTo(to);
      renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      return pixel[0];
    };
    const cases = [];
    for (const clearing of [0, 17, 46]) {
      u.uSeaFogClear.value.set(12, -18, clearing, .3);
      for (const closed of [0, .65, 1]) {
        u.uSeaFogShape.value.set(5, 30 / 170 ** 2, closed, 1);
        for (const [a, b] of [
          [[-4, 5, 24], [2, .2, -90]], [[-50, 2.2, 12], [52, 2.8, -60]],
          [[-145, 4.2, 30], [165, 1.2, -90]], [[-4, 3.3, -20], [6, 3.3, -65]],
          [[12, 9, -18], [12, .1, -18]], [[-6, .2, -40], [10, 3, -8]],
        ]) {
          const mid = a.map((v, i) => v + (b[i] - v) * .37);
          const whole = read(a, b), split = read(a, mid) + read(mid, b), reverse = read(b, a);
          cases.push({ clearing, closed, whole, splitError: Math.abs(whole - split), reverseError: Math.abs(whole - reverse) });
        }
      }
    }
    u.uSeaFogClear.value.z = 0;
    u.uSeaFogShape.value.set(5, 30 / 170 ** 2, 0, 1);
    let last = null, maxJump = 0;
    for (let y = 2; y < 7; y += .002) {
      const d = read([-3, y, -20], [5, y, -75]);
      const alpha = 1 - Math.exp(-d * tuning.drowned.fog.mistDensity);
      if (last !== null) maxJump = Math.max(maxJump, Math.abs(alpha - last));
      last = alpha;
    }
    u.uSeaFogShape.value.z = 1;
    const vertical = read([12, 9, -18], [12, .1, -18]);
    u.uSeaFogClear.value.z = 46;
    const clearedVertical = read([12, 9, -18], [12, .1, -18]);
    const empty = read([12, 9, -18], [14, 9, -18]);
    geometry.dispose(); material.dispose(); target.dispose(); renderer.dispose();
    return { cases, maxJump, vertical, expectedVertical: 5 * SEA_FOG_TOP.middle - .1, clearedVertical, empty };
  }, process.env.OLD_SHADER ? fs.readFileSync(process.env.OLD_SHADER, 'utf8') : null);
  const worstSplit = Math.max(...result.cases.map(c => c.splitError));
  const worstReverse = Math.max(...result.cases.map(c => c.reverseError));
  console.log(JSON.stringify({ cases: result.cases.length, worstSplit, worstReverse, maxOpacityStep: result.maxJump, errors }));
  assert.equal(errors.length, 0, 'shader must compile');
  assert(result.cases.every(c => Number.isFinite(c.whole) && c.whole >= 0), 'finite optical depths');
  assert(worstSplit < .003 && worstReverse < .003, 'moving the eye must retain the same world density');
  assert(result.maxJump < .01, 'no discrete fog layers across a 2 mm height change');
  assert(Math.abs(result.vertical - result.expectedVertical) < .001, 'the bank retains its authored height and density');
  assert(Math.abs(result.clearedVertical - .2) < .001, 'the bell leaves the thin water-level mist');
  assert.equal(result.empty, 0, 'clear air above the bank');
  console.log('world-anchored continuous mist passed');
} finally { await close(); }
