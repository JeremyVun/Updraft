// Capture the storm through landing, starting underway just before the squall.
// Usage: node tools/storm-check.mjs [out-prefix]. BASE defaults to the dev server; W/H select the viewport.
// Uses play.mjs for the shared browser lock, screenshots, console errors and a silent video.
import { spawn } from 'node:child_process';
import { setup } from './storm-fixture.mjs';

const wait = condition => ({ eval: `new Promise((resolve,reject)=>{
  const until=performance.now()+60000;
  const id=setInterval(()=>{
    if(${condition}) {
      clearInterval(id);
      resolve({chapter:__game.story.name,time:__game.story.current.stormTime,act:__game.cygnet.mind.act});
    } else if(performance.now()>until) {
      clearInterval(id);reject(new Error('Storm capture timed out'));
    }
  },16);
})` });


function verify() {
  const start = window.stormLog.find(b => b.beat === 'drowned:gather');
  const end = window.stormLog.find(b => b.beat === 'wood:ashore');
  const seconds = end.time - start.time;
  if (__game.glider.group.visible) throw new Error('Lost plane still visible at shore');
  if (seconds < 38 || seconds > 44) throw new Error(`Storm-to-shore took ${seconds}s`);
  if (window.thunderLog.length < 3 || window.thunderLog.some(t => !t.running)) throw new Error('Missing audible thunder event');
  if (window.thunderLog.some(t => t.time - start.time < 17)) throw new Error('Thunder before the storm is established');
  return { seconds, log: window.stormLog, thunder: window.thunderLog, chapter: __game.story.name };
}

const steps = [
  { eval: `(${setup.toString()})()` },
  wait('__game.story.current.stormTime>3'), { shot: 'lighthouse' },
  wait('__game.story.current.stormTime>7.7'), { shot: 'shake' },
  { eval: `({state:__game.cygnet.state,seat:__game.cygnet.seat,visible:__game.cygnet.visible,act:__game.cygnet.mind.act})` },
  wait('__game.story.current.stormTime>12'), { shot: 'beam' },
  { eval: `(() => {const g=__game;const p=g.boat.position.clone().set(65,11.35,-1580).project(g.rig.camera);if(Math.abs(p.x)>0.85||Math.abs(p.y)>0.95)throw new Error('Lighthouse outside frame: '+p.toArray());return {lighthouse:p.toArray()};})()` },
  wait('__game.story.current.stormTime>17'), { shot: 'passing' },
  wait('__game.story.current.stormTime>19.5'), { shot: 'comfort' },
  wait('__game.boat.sailMat.uniforms.uLightning.value.w>0.2'), { shot: 'lightning' },
  wait("__game.story.current.beat==='snatch'"), { wait: 800 }, { shot: 'plane' },
  wait('__game.story.current.stormTime>35'), { shot: 'shore' },
  { eval: `(() => {if(__game.glider.group.visible)throw new Error('Plane did not disappear into the storm');return 'plane lost';})()` },
  wait("__game.story.name==='wood'"), { shot: 'landed' },
  { eval: `(${verify.toString()})()` },
];
const child = spawn(process.execPath, ['tools/play.mjs', process.argv[2] ?? '/tmp/updraft-storm', JSON.stringify(steps)], {
  stdio: 'inherit',
  env: { ...process.env, BASE: process.env.BASE ?? 'http://127.0.0.1:5230/', QUERY: 'chapter=drowned&ratio=1&msaa=2', VIDEO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
