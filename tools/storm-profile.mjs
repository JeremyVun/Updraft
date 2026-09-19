// Profile the full storm without screenshots or recording overhead. BASE/W/H use perf.mjs defaults.
// Usage: node tools/storm-profile.mjs. Reports stalls, lighting discontinuities and story boundaries.
import { spawn } from 'node:child_process';
import { setup } from './storm-fixture.mjs';

function instrument() {
  const g = __game, u = g.boat.sailMat.uniforms;
  window.stormProfile = { stalls: [], lightJumps: [], boundaries: [], nativeStalls: [], flashes: [] };
  const rows = window.stormProfile;
  let last = performance.now(), sun = u.uSunDir.value.clone(), lastBeat = '', lit = false;
  const start = last;
  const tick = g.rig.update.bind(g.rig);
  const sample = () => ({ elapsed: +(performance.now() - start).toFixed(1),
    storm: +(g.story.current.stormTime ?? 0).toFixed(3), frame: __stats.frame,
    chapter: g.story.name, beat: g.story.current.beat });
  g.rig.update = (...args) => {
    const now = performance.now(), gap = now - last;
    if (gap > 25) rows.stalls.push({ ...sample(), ms: +gap.toFixed(1) });
    const angle = sun.angleTo(u.uSunDir.value);
    if (angle > 0.005) rows.lightJumps.push({ ...sample(), degrees: angle * 180 / Math.PI });
    sun.copy(u.uSunDir.value);
    if (u.uLightning.value.w > 0 && !lit) rows.flashes.push(sample());
    lit = u.uLightning.value.w > 0;
    const beat = g.story.name + ':' + g.story.current.beat;
    if (beat !== lastBeat) rows.boundaries.push({ ...sample(), tag: beat });
    lastBeat = beat; last = now;
    return tick(...args);
  };
  const gl = g.renderer.getContext();
  for (const name of ['getBufferSubData', 'readPixels', 'bufferData', 'texImage2D', 'getProgramParameter', 'drawElements', 'drawElementsInstanced']) {
    const original = gl[name].bind(gl);
    gl[name] = (...args) => {
      const t = performance.now(), result = original(...args), ms = performance.now() - t;
      if (ms > 5) rows.nativeStalls.push({ ...sample(), name, ms: +ms.toFixed(1) });
      return result;
    };
  }
  window.__frames.length = 0;
  window.__long.length = 0;
  return 'profiling storm without captures';
}

const steps = [
  { eval: `(${setup.toString()})(); (${instrument.toString()})();` },
  { wait: 46000 },
  { eval: 'window.stormProfile' },
];
const child = spawn(process.execPath, ['tools/perf.mjs', 'frames', '46', 'chapter=drowned&ratio=1&msaa=2', JSON.stringify(steps)], {
  stdio: 'inherit', env: process.env,
});
child.on('exit', code => process.exit(code ?? 1));
