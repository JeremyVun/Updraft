// Opening story checkpoints for tools/play.mjs. Skips colouring only; the climb, flight, fall and rescue run normally.
// node tools/play.mjs /tmp/updraft-opening "$(node tools/opening-check.mjs)"
// W=900 H=1200 repeats the same sequence in a portrait viewport.
const steps = [{ wait: 1200 }, { shot: 'sheltered' }, {
  eval: `(() => {
    const g = __game, s = g.story.current;
    s.restored = true; s.restoredAt = s.now;
    s.breeze = s.breezeTarget = 1; g.life.regions.island.w = 1;
    g.child.stop(); g.glider.hold(g.child); s.farewell();
    window.__opening = [];
    let previous = null;
    const sample = () => {
      const c = g.story.current;
      if (g.story.name !== 'island' || c.beat === 'leaving') return;
      const camera = g.rig.camera;
      const p = g.cygnet.position.clone().project(camera);
      const q = camera.quaternion.clone();
      window.__opening.push({ beat: c.beat, t: c.now - c.beatStart,
        state: g.cygnet.state, visible: g.cygnet.visible, ndc: p.toArray(),
        position: g.cygnet.position.toArray(), direction: g.flock.direction.toArray(),
        turn: previous ? previous.angleTo(q) * 180 / Math.PI : 0,
        calls: g.cygnet.callMarks.sprite.visible });
      previous = q;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })()`,
}];
const at = (condition, name) => steps.push({
  eval: `new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      const g = __game, s = g.story.current, t = s.now - s.beatStart;
      if (${condition}) return resolve({beat:s.beat,t,state:g.cygnet.state});
      if (performance.now() - started > 60000) return reject(new Error('Opening checkpoint timed out: ${name}'));
      requestAnimationFrame(check);
    }; check();
  })`,
}, { shot: name });
at("s.beat === 'atTree' && t > 3", 'outlook');
at("s.beat === 'skein' && t > 1.5", 'arrival');
at("s.beat === 'skein' && t > 2.5", 'family');
at("s.beat === 'skein' && t > 4.5", 'struggling');
at("g.cygnet.state === 'falling' && s.now - s.fallAt > 0.5", 'separation');
at("g.cygnet.state === 'falling' && s.now - s.fallAt > 2.5", 'descent');
at("g.cygnet.grounded && g.cygnet.callMarks.sprite.material.opacity > 0.4", 'calling');
at("s.beat === 'kneel'", 'rescue');
at("s.beat === 'leaving'", 'together');
steps.push({ eval: `(() => {
  const rows = __opening;
  const air = rows.filter(r => r.visible && r.beat === 'skein' && r.t > 2.5);
  const outside = air.filter(r => Math.abs(r.ndc[0]) > 0.94 || Math.abs(r.ndc[1]) > 0.94 || r.ndc[2] > 1);
  const falling = rows.filter(r => r.state === 'falling');
  const first = falling[0], last = falling.at(-1);
  const forward = (a, b) => (b.position[0] - a.position[0]) * first.direction[0]
    + (b.position[2] - a.position[2]) * first.direction[2];
  const backwards = falling.slice(1).filter((r, i) => forward(falling[i], r) < -0.001);
  const report = {samples:rows.length, trackedAir:air.length, outside:outside.length,
    fallForward: first && last ? forward(first, last) : 0, backwardsFrames: backwards.length,
    northbound: first?.direction[2] < -0.5, flightSeconds: first?.t, fallSeconds: falling.length / 60,
    worstTurnDegrees:Math.max(...rows.filter(r=>['toTree','atTree','skein'].includes(r.beat)).map(r=>r.turn)),
    callFrames:rows.filter(r=>r.calls).length, state:__game.story.current.beat};
  if (air.length < 100 || outside.length || report.worstTurnDegrees > 1 || !report.callFrames
    || report.fallForward < 18 || !report.northbound || backwards.length
    || report.flightSeconds < 5 || report.flightSeconds > 5.1 || Math.abs(report.fallSeconds - 5) > 0.05) {
    throw new Error('Opening framing failed: ' + JSON.stringify(report));
  }
  return report;
})()` });
process.stdout.write(JSON.stringify(steps));
