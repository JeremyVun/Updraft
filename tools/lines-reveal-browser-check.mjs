// Sail through the whale reveal and approach; sample the production horizon veil on the GPU.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=crossing&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ATMO_GLSL } = await import('/src/world/atmosphere.ts');
    const { ISLES, worldHeight } = await import('/src/world/heightfield.ts');
    const { heightAt } = await import('/src/world/island.ts');
    const isle = ISLES.lines, points = [];
    for (let z = isle.z - 90; z <= isle.z + 90; z += 10) for (let x = isle.x - 90; x <= isle.x + 90; x += 10) {
      const y = worldHeight(x, z);
      if (y > 0) points.push(new THREE.Vector3(x, y + 1, z));
    }
    const landCount = points.length;
    for (let i = 0; i < 12; i++) points.push(new THREE.Vector3());
    const shore = points.slice(0, landCount).reduce((a, b) => a.z > b.z ? a : b);
    const shader = ATMO_GLSL.slice(ATMO_GLSL.indexOf('float coastCover('), ATMO_GLSL.indexOf('/** rgb: haze colour'));
    const uniforms = __game.terrain.mesh.material.uniforms;
    const material = new THREE.ShaderMaterial({ uniforms: { ...uniforms, uPoints: { value: points } },
      vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: `uniform vec4 uIsleMist; uniform vec4 uIsleMistRange; uniform vec3 uHorizonMist;
        uniform vec4 uJourneyVeils[2]; uniform vec2 uJourneyVeilAmounts;
        uniform vec3 uPoints[${points.length}]; ${shader}
        void main(){gl_FragColor=vec4(journeyVeilAt(uPoints[int(gl_FragCoord.x)]));}`,
      depthTest: false, depthWrite: false });
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false; scene.add(mesh);
    const target = new THREE.WebGLRenderTarget(points.length, 1, { type: THREE.FloatType });
    const pixels = new Float32Array(points.length * 4);
    window.sampleLines = () => {
      const g = __game, previous = g.renderer.getRenderTarget();
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, distance = uniforms.uHorizonMist.value.y + 1;
        points[landCount + i].copy(g.rig.camera.position).add(new THREE.Vector3(Math.sin(a) * distance, 0, Math.cos(a) * distance));
      }
      g.renderer.setRenderTarget(target); g.renderer.render(scene, g.rig.camera);
      g.renderer.readRenderTargetPixels(target, 0, 0, points.length, 1, pixels);
      g.renderer.setRenderTarget(previous);
      const petalData = new Float32Array(128 * 64 * 4);
      g.renderer.readRenderTargetPixels(g.petals.pos.read, 0, 0, 128, 64, petalData);
      let airborne = 0, visiblePetals = 0;
      const p = new THREE.Vector3();
      for (let i = 0; i < petalData.length; i += 4) {
        const [x, y, z] = petalData.subarray(i, i + 3);
        if (Math.abs(x) > 1e4 || Math.hypot(x, z - 188) > 65 || y < heightAt(x, z) + 1) continue;
        airborne++;
        p.set(x, y, z).project(g.rig.camera);
        if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1) visiblePetals++;
      }
      const title = document.querySelector('#journey-title'), child = g.child.position.clone();
      child.y += 1.7; child.project(g.rig.camera);
      return { time: g.story.current.time, chapter: g.story.name,
        airborne, visiblePetals, gust: g.story.current.gustFront?.strength ?? 0,
        title: Number(title.style.opacity), font: getComputedStyle(title.querySelector('p')).fontSize,
        child: child.toArray(),
        leastCovered: Math.min(...points.slice(0, landCount).map((_, i) => pixels[i * 4])),
        horizonCovered: Math.min(...points.slice(landCount).map((_, i) => pixels[(i + landCount) * 4])),
        shoreCover: pixels[points.indexOf(shore) * 4], shoreDistance: shore.distanceTo(g.rig.camera.position),
        mist: uniforms.uHorizonMist.value.toArray(), samples: points.length };
    };
  });
  const results = [];
  for (const time of [2, 20, 30, 33, 35, 37.5, 39.5, 41, 45, 48, 52, 57, 65, 80, 95, 105, 115]) {
    await page.waitForFunction(t => __game.story.current.time >= t, time, { timeout: 60000 });
    const sample = await page.evaluate(() => sampleLines()); results.push(sample);
    if (time <= 80) assert(sample.leastCovered > .999, `Lines stays fully concealed through the whale pan: ${JSON.stringify(sample)}`);
    assert(sample.horizonCovered > .999, 'Concealment spreads across the whole horizon, with no island-shaped patch');
    if ([33, 35, 37.5, 39.5, 45, 65, 105].includes(time)) await page.screenshot({ path: `/tmp/updraft-horizon-${time}.png` });
    console.log(JSON.stringify(sample));
  }
  assert(results.some(r => r.time > 33 && r.time < 38 && r.visiblePetals > 20), 'The title gust lifts visible petals above the island');
  assert(results.some(r => r.time > 37 && r.time < 38 && r.title === 1), 'The title reaches its brief full-opacity hold');
  assert(results.find(r => r.time >= 41).title > 0, 'The extended title is still fading at second 41');
  assert(results.find(r => r.time >= 45).title === 0, 'The title clears before the whale camera');
  assert(results.some(r => r.shoreDistance < 100 && r.shoreCover < .8), 'The near shoreline gradually becomes visible');
  assert(results.at(-1).shoreCover < .05, 'The landing shore clears at close range');
  assert.deepEqual(errors, []);
} finally { await close(); }
