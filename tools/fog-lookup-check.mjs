// Real GPU cache invalidation at fixed time, camera rebinding and texture release. BASE selects Vite.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/__fog_lookup_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fog cache check</title>' }));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '__fog_lookup_probe__');
  const result = await page.evaluate(async negative => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { FogLookup } = await import('/src/world/fog-lookup.ts');
    const { atmo } = await import('/src/world/atmosphere.ts');
    const { fogLookupUniforms: uniforms, FOG_LOOKUP_GLSL } = await import('/src/world/fog-lookup-uniforms.ts');
    const { GpuRunner, simMaterial, simTarget } = await import('/src/gl/gpu.ts');
    const renderer = new THREE.WebGLRenderer();
    renderer.info.autoReset = false;
    const fog = new FogLookup(renderer), runner = new GpuRunner(renderer), target = simTarget(1, 1, THREE.FloatType);
    const ray = new THREE.Vector3();
    const material = simMaterial(`${FOG_LOOKUP_GLSL}
      uniform vec3 uRay;
      void main() { gl_FragColor = sampleFog(uMistLookup, uRay, 40.0); }`, { ...uniforms, uRay: { value: ray } }, target);
    const camera = new THREE.PerspectiveCamera(60, 1, .1, 1000);
    camera.position.set(0, 1, 0); camera.lookAt(0, 1, 20);
    const other = camera.clone(); other.position.x = 10;
    const u = atmo.uniforms;
    u.uCloudDeck.value.w = 0;
    u.uSeaFog.value.set(0, 100, 0, 1);
    u.uSeaFogShape.value.set(3, 0, .15, 1);
    u.uSeaFogRelief.value = 0;
    u.uSeaFogBody.value.set(.025, .029, .039, .019);
    u.uSeaFogTop.value.setRGB(.067, .069, .077);
    u.uSeaFogClear.value.set(0, 0, 0, 0);
    fog.active = true;
    const bake = view => {
      const before = renderer.info.render.calls;
      fog.bake(view);
      return renderer.info.render.calls - before;
    };
    const read = () => {
      camera.getWorldDirection(ray);
      runner.run(material, target);
      const pixels = new Float32Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
      return Array.from(pixels);
    };
    fog.beginFrame();
    const first = bake(camera), opaque = read(), texture = uniforms.uMistLookup.value;
    const reused = bake(camera), secondCamera = bake(other), secondTexture = uniforms.uMistLookup.value;
    const rebound = bake(camera), restoredTexture = uniforms.uMistLookup.value === texture;
    camera.position.x++;
    const moved = bake(camera);
    camera.lookAt(20, 4, 20);
    const turned = bake(camera);
    camera.aspect = .5; camera.updateProjectionMatrix();
    const resized = bake(camera);
    u.uMirrorPass.value = 1;
    const reflected = bake(camera);
    u.uMirrorPass.value = 0;
    bake(camera);
    u.uSeaFogClear.value.set(camera.position.x, camera.position.z, 1000, -20);
    if (!negative) fog.beginFrame();
    const changedAtFixedTime = bake(camera), cleared = read();
    const texturesBefore = renderer.info.memory.textures;
    u.uSeaFogShape.value.w = 0;
    fog.beginFrame();
    const inactive = bake(camera), unbound = uniforms.uMistLookup.value === null;
    const disposed = texturesBefore - renderer.info.memory.textures;
    target.dispose(); material.dispose(); renderer.dispose();
    return { first, reused, secondCamera, rebound, restoredTexture, distinctTextures: texture !== secondTexture, moved, turned, resized, reflected,
      changedAtFixedTime, opaque, cleared, inactive, unbound, disposed };
  }, !!process.env.NEGATIVE);
  assert.deepEqual(errors, []);
  for (const key of ['first', 'secondCamera', 'moved', 'turned', 'resized', 'reflected', 'changedAtFixedTime']) assert.equal(result[key], 1, key);
  for (const key of ['reused', 'rebound', 'inactive']) assert.equal(result[key], 0, key);
  assert(result.restoredTexture && result.distinctTextures && result.unbound);
  assert.equal(result.disposed, 2);
  assert(result.opaque.every(Number.isFinite) && result.cleared.every(Number.isFinite));
  assert(result.opaque[3] > .1 && result.cleared[3] < result.opaque[3] * .1, 'fixed-time clearing must change the actual GPU result');
  console.log(JSON.stringify(result, null, 2));
} finally { await close(); }
