// Shared start for storm captures and performance checks: the page loads with `?chapter=storm` (her just seated aboard
// at the nave, the fog closed round), and this logs each story beat and every roll of thunder from there on.
export const STORM_QUERY = 'chapter=storm&ratio=1&msaa=2';

export function setup() {
  const g = __game;
  g.sound.start();
  window.stormLog = [];
  window.thunderLog = [];
  const thunder = g.sound.thunder.bind(g.sound);
  g.sound.thunder = (...args) => {
    window.thunderLog.push({ time: __stats.time, args, running: g.sound.running });
    thunder(...args);
  };
  const update = g.story.update.bind(g.story);
  let last = '';
  g.story.update = (dt, t) => {
    update(dt, t);
    const tag = g.story.name + ':' + g.story.current.beat;
    if (tag !== last) {
      window.stormLog.push({ beat: tag, time: __stats.time, pos: g.boat.position.toArray() });
      last = tag;
    }
  };
  return 'ready';
}
