// Capture the storm from her seated aboard at the nave through the landing at the forest beach.
// Usage: node tools/storm-check.mjs [out-prefix]. BASE defaults to the dev server; W/H select the viewport.
// Uses play.mjs for the shared browser lock, screenshots, console errors and a silent video.
import { spawn } from 'node:child_process';
import { setup, STORM_QUERY } from './storm-fixture.mjs';

const wait = condition => ({ eval: `new Promise((resolve,reject)=>{
  const until=performance.now()+90000;
  const id=setInterval(()=>{
    if(${condition}) {
      clearInterval(id);
      resolve({chapter:__game.story.name,time:__game.story.current.stormTime,act:__game.cygnet.mind.act});
    } else if(performance.now()>until) {
      clearInterval(id);reject(new Error('Storm capture timed out'));
    }
  },16);
})` });

/** Whether a point is inside the frame now: the lighthouse's lamp, or the plane. */
const inFrame = (what, point) => ({ eval: `(async () => {
  const {LIGHTHOUSE}=await import('/src/world/drowned.ts');const {LIGHTHOUSE_LANTERN_Y}=await import('/src/world/lighthouse.ts');
  const p=(${point}).clone().project(__game.rig.camera);
  if(p.z>1||Math.abs(p.x)>0.95||Math.abs(p.y)>0.95)throw new Error('${what} outside frame: '+p.toArray());
  return {${what.replace(/\W/g, '')}:p.toArray()};
})()` });

function verify() {
  const start = window.stormLog.find(b => b.beat === 'drowned:gather');
  const end = window.stormLog.find(b => b.beat === 'wood:ashore');
  const seconds = end.time - start.time;
  if (__game.glider.group.visible) throw new Error('Lost plane still visible at shore');
  if (seconds < 40 || seconds > 52) throw new Error(`Storm-to-shore took ${seconds}s`);
  if (window.thunderLog.length < 3 || window.thunderLog.some(t => !t.running)) throw new Error('Missing audible thunder event');
  // The foghorn's tail has gone before the first thunder.
  if (window.thunderLog.some(t => t.time - start.time < 15)) throw new Error('Thunder before the storm is established');
  return { seconds, log: window.stormLog, thunder: window.thunderLog, chapter: __game.story.name };
}

const LAMP = 'LIGHTHOUSE.clone().setY(LIGHTHOUSE_LANTERN_Y)';
const steps = [
  { eval: `(${setup.toString()})()` },
  wait('__game.story.current.stormTime>2.5'), { shot: 'look-back' }, inFrame('lighthouse lamp', LAMP),
  wait('__game.story.current.stormTime>5'), { shot: 'light-failing' }, inFrame('lighthouse lamp', LAMP),
  wait('__game.story.current.stormTime>8'), { shot: 'light-out' },
  { eval: `(()=>{if(__game.village.lighthouse.strength.value>0)throw new Error('The light is still on');return 'out';})()` },
  wait('__game.story.current.stormTime>14.2'), { shot: 'shake' },
  { eval: `({state:__game.cygnet.state,seat:__game.cygnet.seat,visible:__game.cygnet.visible,act:__game.cygnet.mind.act})` },
  wait('__game.boat.sailMat.uniforms.uLightning.value.w>0.2'), { shot: 'lightning' },
  wait("__game.story.current.beat==='snatch'"), { wait: 800 }, { shot: 'plane' }, inFrame('plane', '__game.glider.group.position'),
  wait('__game.story.current.stormTime>38'), { shot: 'shore' },
  { eval: `(() => {if(__game.glider.group.visible)throw new Error('Plane did not disappear into the storm');return 'plane lost';})()` },
  wait("__game.story.name==='wood'"), { shot: 'landed' },
  { eval: `(${verify.toString()})()` },
];
const child = spawn(process.execPath, ['tools/play.mjs', process.argv[2] ?? '/tmp/updraft-storm', JSON.stringify(steps)], {
  stdio: 'inherit',
  env: { ...process.env, BASE: process.env.BASE ?? 'http://127.0.0.1:5230/', QUERY: STORM_QUERY, VIDEO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
