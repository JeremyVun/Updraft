// Capture the complete sea passage with real simulation and verify the swimmer's framing.
// Usage: node tools/sea-check.mjs [out-prefix]. BASE selects a stable dev server; W/H select the viewport.
// Reuses play.mjs's machine-wide GPU lock. All captures belong in /tmp.
import { spawn } from 'node:child_process';

function observe() {
  const g = __game;
  window.seaLog = { swimFrames: 0, clipped: 0, maxGap: 0, beats: [], last: '' };
  const log = window.seaLog;
  const update = g.sealife.pod.update.bind(g.sealife.pod);
  g.sealife.pod.update = (dt, time) => {
    update(dt, time);
    const c = g.story.current;
    const beat = `${g.story.name}:${c.swim}`;
    if (beat !== log.last) { log.beats.push({ beat, time: c.time, boat: g.boat.position.toArray() }); log.last = beat; }
    if (c.swim === 'in' && c.swimT > 3) {
      const p = g.cygnet.position.clone().project(g.rig.camera);
      log.swimFrames++;
      if (Math.abs(p.x) > 0.82 || Math.abs(p.y) > 0.82 || p.z > 1) log.clipped++;
      log.maxGap = Math.max(log.maxGap, g.cygnet.astern);
    }
  };
}

const wait = (condition, seconds = 60) => ({ eval: `new Promise((resolve,reject)=>{
  const until=performance.now()+${seconds * 1000};
  const id=setInterval(()=>{
    if(${condition}) {clearInterval(id);resolve({chapter:__game.story.name,time:__game.story.current.time,swim:__game.story.current.swim});}
    else if(performance.now()>until) {clearInterval(id);reject(new Error('Sea capture timed out: '+${JSON.stringify(condition)}));}
  },30);
})` });

const steps = [
  { eval: `(${observe.toString()})()` },
  wait('__game.story.current.time>12'), { shot: 'arrival' },
  wait("__game.sealife.pod.stunt?.phase==='act' && __game.sealife.pod.stunt.kind==='leap'"),
  { burst: 'leap', n: 6, every: 180 },
  wait('__game.story.current.time>24'), { shot: 'open-water' },
  wait("['restless','side','in'].includes(__game.story.current.swim)", 90), { shot: 'curious' },
  wait("__game.story.current.swim==='in' && __game.story.current.swimT>4"), { shot: 'swim' },
  wait("__game.story.current.swim==='in' && __game.story.current.swimT>17"), { shot: 'alongside' },
  wait("['drying','done'].includes(__game.story.current.swim)"), { shot: 'return' },
  wait("__game.story.current.swim==='done'"), { shot: 'together' },
  { eval: `(() => {const s=window.seaLog;if(!s.swimFrames||s.clipped>0||s.maxGap>3.5)throw Error(JSON.stringify(s));return s;})()` },
  wait("__game.story.current.time>105 || __game.story.name==='mirror'"), { shot: 'farewell' },
  wait("__game.story.name==='mirror'", 110), { shot: 'mirror-arrival' },
  { eval: 'window.seaLog' },
];
const child = spawn(process.execPath, ['tools/play.mjs', process.argv[2] ?? '/tmp/updraft-sea', JSON.stringify(steps)], {
  stdio: 'inherit',
  env: { ...process.env, BASE: process.env.BASE ?? 'http://127.0.0.1:5230/', QUERY: 'chapter=sea&ratio=1&msaa=2', VIDEO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
