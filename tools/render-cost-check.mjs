// Compare optimized work against full work in one frozen GPU frame, without motion/readback drift.
// Uses play.mjs's shared Chrome lock. Usage: node tools/render-cost-check.mjs [chapter] [prefix]
import { spawnSync } from 'node:child_process';

async function compare() {
  const source = await (await fetch('/src/world/atmosphere.ts')).text();
  const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
  const { renderer, scene, rig, grass, terrain } = __game;
  const target = new THREE.WebGLRenderTarget(800, 450, { type: THREE.HalfFloatType, depthBuffer: true });
  const read = camera => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const data = new Uint16Array(800 * 450 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 800, 450, data);
    renderer.setRenderTarget(null);
    return data;
  };
  const diff = (a, b, label) => {
    let changed = 0, max = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
      changed++;
      const delta = Math.abs(THREE.DataUtils.fromHalfFloat(a[i]) - THREE.DataUtils.fromHalfFloat(b[i]));
      if (!Number.isFinite(delta)) throw new Error(label + ': non-finite pixel');
      max = Math.max(max, delta);
    }
    if (max > .004) throw new Error(`${label}: ${changed} changed channels, max HDR delta ${max}`);
    return { label, changed, max };
  };
  const results = [];
  const eye = rig.camera.position.clone();
  const setTarget = renderer.setRenderTarget;
  try {
    // Moving the eye changes row populations and checks newly exposed rows after a smaller bake.
    for (const offset of [0, 30, -15]) {
      rig.camera.position.copy(eye); rig.camera.position.x += offset;
      rig.camera.updateMatrixWorld(); grass.update(rig.camera);
      const calls = renderer.info.render.calls;
      grass.bake(renderer);
      const tableDraws = renderer.info.render.calls - calls;
      const optimized = read(rig.camera);
      const tables = new Set(grass.lods.map(l => l.table));
      renderer.setRenderTarget = function (target, ...rest) {
        if (tables.has(target)) target.scissorTest = false;
        return setTarget.call(this, target, ...rest);
      };
      for (const l of grass.lods) l.dirty = true;
      grass.bake(renderer);
      renderer.setRenderTarget = setTarget;
      results.push(diff(optimized, read(rig.camera), `grass eye ${offset}`));
      results.at(-1).rows = grass.lods.map(l => ({ used: l.count ? Math.ceil(l.count*l.spec.cols*l.spec.rows/l.table.width) : 0, allocated: l.table.height }));
      results.at(-1).tableDraws = tableDraws;
    }
    rig.camera.position.copy(eye); rig.camera.updateMatrixWorld(); grass.update(rig.camera); grass.bake(renderer);
    const uniforms = grass.lods[0].tableMat.uniforms;
    const season = uniforms.uSeason.value, trodden = uniforms.uTrodden.value.clone(), tint = uniforms.uTipLush.value.clone();
    for (const change of ['unchanged', 'season', 'tint', 'trodden', 'ground']) {
      if (change === 'season') uniforms.uSeason.value += .1;
      if (change === 'tint') uniforms.uTipLush.value.multiplyScalar(.8);
      if (change === 'trodden') uniforms.uTrodden.value.set(eye.x, eye.z-8, 15, 1);
      if (change === 'ground') {
        const { followWindow, windowCentre } = await import('/src/world/window.ts');
        followWindow(...windowCentre(), true);
      }
      const calls = renderer.info.render.calls;
      grass.bake(renderer);
      const tableDraws = renderer.info.render.calls - calls;
      // Where no blade grows (the sky mirror) there is no table to rebuild.
      if (grass.lods.some(l => l.count) && (change === 'unchanged') !== (tableDraws === 0)) throw new Error(`Wrong grass invalidation: ${change}, draws ${tableDraws}`);
      const optimized = read(rig.camera);
      for (const l of grass.lods) l.dirty = true;
      grass.bake(renderer);
      results.push({ ...diff(optimized, read(rig.camera), `grass ${change}`), tableDraws });
    }
    uniforms.uSeason.value = season; uniforms.uTrodden.value.copy(trodden); uniforms.uTipLush.value.copy(tint); grass.bake(renderer);
    // The starlings are skipped only where their bounding sphere is out of view: sweep the view across the flock at
    // full presence, in the air and at the roost, and draw it unculled for comparison.
    const { starlings } = __game;
    if (starlings) {
      const mesh = starlings.mesh, u = mesh.material.uniforms, sphere = mesh.geometry.boundingSphere;
      const saved = { visible: mesh.visible, presence: u.uPresence.value, roost: u.uRoost.value, quaternion: rig.camera.quaternion.clone() };
      const frustum = new THREE.Frustum();
      let culled = 0, drawn = 0;
      try {
        mesh.visible = true; u.uPresence.value = 1;
        for (const roost of [0, 0.6, 1]) {
          u.uRoost.value = roost;
          for (let yaw = -70; yaw <= 70; yaw += 2.5) for (const pitch of [-24, 0, 24]) {
            rig.camera.position.copy(eye);
            rig.camera.lookAt(sphere.center);
            rig.camera.rotateY(THREE.MathUtils.degToRad(yaw)); rig.camera.rotateX(THREE.MathUtils.degToRad(pitch));
            rig.camera.updateMatrixWorld();
            frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(rig.camera.projectionMatrix, rig.camera.matrixWorldInverse));
            if (frustum.intersectsSphere(sphere)) { drawn++; continue; }
            culled++;
            const optimized = read(rig.camera);
            mesh.frustumCulled = false;
            const full = read(rig.camera);
            mesh.frustumCulled = true;
            diff(optimized, full, `starlings yaw ${yaw} pitch ${pitch} roost ${roost}`);
          }
        }
        if (!culled || !drawn) throw new Error(`starlings: the sweep never crossed the edge of the view (culled ${culled}, drawn ${drawn})`);
        results.push({ label: 'starlings out of view', culled, drawn });
      } finally {
        mesh.frustumCulled = true; mesh.visible = saved.visible; u.uPresence.value = saved.presence; u.uRoost.value = saved.roost;
        rig.camera.position.copy(eye); rig.camera.quaternion.copy(saved.quaternion); rig.camera.updateMatrixWorld();
      }
    }
    // The sky mirror leaves its constellation lines at opacity 0 and its unlit guide undrawn: drawn, they add nothing.
    const mirror = __game.skyMirror;
    if (mirror?.group.visible) {
      const dark = [];
      mirror.group.traverse(o => {
        if (o.isMesh && !o.visible && (o.material.opacity === 0 || o.material.uniforms?.uLit?.value.toArray().every(v => v === 0))) dark.push(o);
      });
      if (!dark.length) throw new Error('sky mirror: nothing dark is left undrawn here');
      const optimized = read(rig.camera);
      for (const o of dark) o.visible = true;
      try { results.push({ ...diff(optimized, read(rig.camera), 'sky mirror dark pieces'), pieces: dark.length }); }
      finally { for (const o of dark) o.visible = false; }
    }
    const material = terrain.mesh.material, fragment = material.fragmentShader;
    for (const mirror of [false, true]) {
      const camera = mirror ? __game.water.reflection.mirrorCamera : rig.camera;
      if (mirror) terrain.beginMirror(camera);
      material.uniforms.uMirrorPass.value = +mirror;
      const optimized = read(camera);
      material.fragmentShader = fragment.replace('if (fog.a == 1.0)', 'if (false)'); material.needsUpdate = true;
      results.push(diff(optimized, read(camera), mirror ? 'terrain reflection' : 'terrain main'));
      material.fragmentShader = fragment; material.needsUpdate = true;
      material.uniforms.uMirrorPass.value = 0;
      if (mirror) terrain.endMirror();
    }
    return results;
  } finally {
    renderer.setRenderTarget = setTarget;
    renderer.setRenderTarget(null);
    rig.camera.position.copy(eye); rig.camera.updateMatrixWorld();
    grass.update(rig.camera); grass.bake(renderer);
    target.dispose();
  }
}
const chapter = process.argv[2] ?? 'meadow';
const prefix = process.argv[3] ?? `/tmp/updraft-render-cost-${chapter}`;
const steps = [
  { eval: 'new Promise(resolve => { const check = () => __stats.frame >= 120 ? resolve() : requestAnimationFrame(check); check(); })' },
  { eval: `(${compare.toString()})()` },
  { shot: 'checked' },
];
const run = spawnSync(process.execPath, ['tools/play.mjs', prefix, JSON.stringify(steps)], {
  env: { ...process.env, QUERY: `chapter=${chapter}&hold=120&ratio=1&msaa=2${process.env.EXTRA_QUERY ? '&'+process.env.EXTRA_QUERY : ''}` }, stdio: 'inherit',
});
process.exit(run.status ?? 1);
