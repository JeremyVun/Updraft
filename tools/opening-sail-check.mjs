// Sail checkpoints for tools/play.mjs: real cursor gusts, relaxation, then the opening push-off.
// node tools/play.mjs /tmp/updraft-sail "$(node tools/opening-sail-check.mjs)"
// Fixture: hold the opening story and camera while testing cloth in an otherwise living island;
// then place the child at the boat and resume the actual push beat. The rescue is checked separately.
const sample = label => ({
  eval: `(() => {
    const b = __game.boat;
    const result = {label:${JSON.stringify(label)}, ...b.sailWind, shelter:b.shelter,
      droop:b.sailMat.uniforms.uDroop.value, fill:b.sailMat.uniforms.uFill.value, speed:b.speed};
    __sailResults.push(result);
    return result;
  })()`,
});
const steps = [
  { wait: 1200 },
  { eval: `(() => {
    const g = __game, s = g.story.current;
    window.__sailResults = [];
    window.__storyUpdate = s.update.bind(s);
    s.update = () => {};
    s.breeze = s.worldLife = 1;
    g.life.regions.island.w = 1;
  })()` },
  { wait: 7000 }, sample('ambient'), { shot: 'ambient' },
  { swipe: [[0.71, 0.63], [0.82, 0.64], [0.96, 0.63]], ms: 700 },
  { swipe: [[0.74, 0.62], [0.84, 0.63], [0.95, 0.63]], ms: 600 },
  { wait: 400 }, sample('cursor'), { shot: 'cursor' },
  { wait: 8000 }, sample('relaxed'), { shot: 'relaxed' },
  { eval: `(() => {
    const g = __game, s = g.story.current;
    s.update = __storyUpdate;
    s.beat = 'push';
    s.now = s.beatStart = g.boat.time;
    const beside = g.boat.boardingPoint(g.child.position);
    g.child.place(beside.x, beside.z, 0.95);
    g.child.board(g.boat, () => { s.beat = 'aboard'; s.beatStart = s.now; });
    g.boat.canGround = false;
  })()` },
  { wait: 1700 }, sample('gust-arriving'), { shot: 'departure' },
  { wait: 5000 }, sample('sailing'), { shot: 'sailing' },
  { eval: `(() => {
    const [ambient, cursor, relaxed, depart, sailing] = __sailResults;
    if (ambient.droop < 0.95 || cursor.blowing < ambient.blowing + 0.1 || relaxed.droop < 0.9 ||
        sailing.shelter > 0.2 || sailing.taken < 0.5 || depart.blowing > 5) {
      throw Error('Sail response failed: ' + JSON.stringify(__sailResults));
    }
    return 'Sail checks passed';
  })()` },
];
process.stdout.write(JSON.stringify(steps));
