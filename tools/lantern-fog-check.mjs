// Render the real fog shader on either side of a surface passing the lantern's closest sightline point.
// BASE selects Vite; NEGATIVE=1 or reflection restores a former cutoff to prove the continuity gates catch it.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage();
  await page.route('**/__lantern_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Lantern fog check</title>' }));
  await page.goto(`${base}__lantern_probe__`);
  const results = await page.evaluate(async negative => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ATMO_GLSL, atmo } = await import('/src/world/atmosphere.ts');
    const renderer = new THREE.WebGLRenderer();
    const target = new THREE.WebGLRenderTarget(3, 1, { type: THREE.FloatType, depthBuffer: false });
    const u = atmo.uniforms;
    u.uSeaFog.value.set(0, 100, 0, 1);
    u.uSeaFogShape.value.set(3, 0, 0.15, 1);
    u.uSeaFogRelief.value = 0;
    u.uSeaFogBody.value.set(0.025, 0.029, 0.039, 0.019);
    u.uSeaFogTop.value.setRGB(0.067, 0.069, 0.077);
    u.uSeaFogCrest.value.set(0, 0, 0, 0);
    u.uLantern.value.set(2, 1.25, 14, 1.34);
    const source = negative === '1' ? ATMO_GLSL
      .replace('clamp(dot(uLantern.xyz - ro, rd), 0.0, far)', 'dot(uLantern.xyz - ro, rd)')
      .replace('tc >= ta && tc <= tb', 'tc >= ta && tc < tb') : negative === 'reflection' ? ATMO_GLSL
      .replace('seaSurface && rd.y < 0.0 && far < 200.0', 'rd.y < 0.0 && far < 200.0 && abs(ro.y + rd.y * far) < 0.4') : ATMO_GLSL;
    if (negative && source === ATMO_GLSL) throw new Error('Negative control did not change the shader');
    const material = new THREE.ShaderMaterial({
      uniforms: { ...u, probeHeight: { value: 3 }, probeEpsilon: { value: 0.001 }, probeMode: { value: 0 } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `${source}
        uniform float probeHeight;
        uniform float probeEpsilon;
        uniform int probeMode;
        void main() {
          float offset = (gl_FragCoord.x - 1.5) * probeEpsilon;
          vec3 ro = vec3(0.0, probeHeight, 0.0), rd = normalize(vec3(0.0, -0.2, 1.0));
          float far = dot(uLantern.xyz - ro, rd) + offset;
          if (probeMode == 1) {
            ro.y = 3.0;
            vec3 surface = vec3(1.0, probeHeight + offset, 12.0);
            far = distance(ro, surface); rd = normalize(surface - ro);
          }
          if (probeMode == 2) { ro.y = 1.0 + offset; far = 14.0; }
          vec4 fog = seaFog(ro, rd, far, probeMode == 1);
          gl_FragColor = vec4(fog.rgb * fog.a, fog.a);
        }`,
    });
    const scene = new THREE.Scene(), camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; scene.add(mesh);
    renderer.setRenderTarget(target);
    const rows = [], pixels = new Float32Array(12);
    const cases = [2, 3, 5].flatMap(height => [0.01, 0.001].map(epsilon => ({ mode: 0, height, epsilon })));
    cases.push(...[-0.4, 0.4, 1].map(height => ({ mode: 1, height, epsilon: 0.001 })), { mode: 2, height: 1, epsilon: 0.001 });
    for (const { mode, height, epsilon } of cases) {
      material.uniforms.probeHeight.value = height;
      material.uniforms.probeEpsilon.value = epsilon;
      material.uniforms.probeMode.value = mode;
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 3, 1, pixels);
      let jump = 0;
      for (let channel = 0; channel < 3; channel++) {
        jump = Math.max(jump, Math.abs(pixels[channel] - pixels[channel + 4]), Math.abs(pixels[channel + 4] - pixels[channel + 8]));
      }
      rows.push({ mode, height, epsilon, jump, light: pixels[4], finite: pixels.every(Number.isFinite) });
    }
    geometry.dispose(); material.dispose(); target.dispose(); renderer.dispose();
    return rows;
  }, process.env.NEGATIVE ?? '');
  for (const row of results) {
    console.log(JSON.stringify(row));
    assert(row.finite && row.light > 0.001, 'fog shader must render finite, nonzero light');
    assert(row.jump < 0.001, `lantern glow has a hard boundary in mode ${row.mode}, height ${row.height}: ${row.jump}`);
  }
  console.log('lantern fog continuity passed');
} finally { await close(); }
