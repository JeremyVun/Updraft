// Shared underway start for storm captures and performance checks.
// This fixture skips the earlier village and becalming. Boat, weather, animation and arrival run normally.
export function setup() {
  const g = __game, c = g.story.current;
  g.boat.beach(4, -1479, Math.PI);
  g.boat.afloat = true;
  g.boat.pushingFor = -1;
  g.boat.speed = 5.4;
  g.boat.speedLimit = 5.8;
  c.beat = 'drift'; c.stirred = true; c.leg = 4;
  g.boat.steerFor = g.boat.steerFor.clone().set(8, -1496);
  c.update(0, 0);
  g.rig.cut(g.story.shot);
  g.sound.start();
  window.stormLog = [];
  window.thunderLog = [];
  const thunder = g.sound.thunder.bind(g.sound);
  g.sound.thunder = (...args) => {
    window.thunderLog.push({ time: __stats.frame / 60, args, running: g.sound.running });
    thunder(...args);
  };
  const update = g.story.update.bind(g.story);
  let last = '';
  g.story.update = (dt, t) => {
    update(dt, t);
    const tag = g.story.name + ':' + g.story.current.beat;
    if (tag !== last) {
      window.stormLog.push({ beat: tag, time: t, pos: g.boat.position.toArray() });
      last = tag;
    }
  };
  return 'ready';
}

