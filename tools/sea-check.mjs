// Capture the complete sea passage with real simulation and verify the swimmer's framing, then the whale in the net:
// the pod's lead, the rest beside its head, real circles over the blowhole (the stand-in for the net's first step),
// its eye, the spout, the flukes and the arrival at the mirror.
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
      // Out among the toys and back, never further from its place beside the hull than it dares.
      log.maxGap = Math.max(log.maxGap, g.cygnet.position.distanceTo(c.water.clone().setY(g.cygnet.position.y)));
    }
  };
}

const wait = (condition, seconds = 60) => ({ eval: `new Promise((resolve,reject)=>{
  const until=performance.now()+${seconds * 1000};
  const id=setInterval(()=>{
    if(${condition}) {clearInterval(id);resolve({chapter:__game.story.name,time:__game.story.current.time,swim:__game.story.current.swim,whale:__game.story.current.whale?.step});}
    else if(performance.now()>until) {clearInterval(id);reject(new Error('Sea capture timed out: '+${JSON.stringify(condition)}));}
  },30);
})` });
const whale = '__game.story.current.whale';
/** The blowhole on screen, as fractions of the viewport, a little above it where the column stands. */
const blowhole = `(()=>{const p=__game.sealife.sleeper.blowhole.clone();p.y+=1.2;p.project(__game.rig.camera);return [p.x*0.5+0.5,0.5-p.y*0.5]})()`;

const steps = [
  { eval: `(${observe.toString()})()` },
  wait('__game.story.current.time>12'), { shot: 'arrival' },
  wait("__game.sealife.pod.stunt?.phase==='act' && __game.sealife.pod.stunt.kind==='leap'"),
  { burst: 'leap', n: 6, every: 180 },
  wait('__game.story.current.time>24'), { shot: 'open-water' },
  wait("['restless','side','in'].includes(__game.story.current.swim)", 90), { shot: 'curious' },
  wait("__game.story.current.swim==='in' && __game.story.current.swimT>4"), { shot: 'swim' },
  wait("__game.story.current.swim==='in' && __game.story.current.swimT>9"), { shot: 'alongside' },
  wait("['drying','done'].includes(__game.story.current.swim)"), { shot: 'return' },
  wait("__game.story.current.swim==='done'"), { shot: 'together' },
  { eval: `(() => {const s=window.seaLog;if(!s.swimFrames||s.clipped>0||s.maxGap>11.5)throw Error(JSON.stringify(s));return s;})()` },
  wait(`${whale}.led`, 60), { shot: 'lead' },
  wait(`${whale}.step==='breath' && ${whale}.stepTime>3`, 90), { shot: 'beside' },
  { circle: blowhole, until: `${whale}.progress>=1`, radius: 0.06, seconds: 60 },
  { move: [0.98, 0.04] },
  wait('__game.sealife.sleeper.awake && __game.sealife.sleeper.time>3', 30), { shot: 'eye' },
  wait('__game.sealife.sleeper.spouting', 30), { shot: 'spout' },
  wait('__game.sealife.sleeper.fluking && __game.sealife.sleeper.time>15', 40), { shot: 'flukes' },
  wait(`${whale}.step==='gone'`, 40), { shot: 'gone' },
  wait("__game.story.name==='mirror'", 120), { shot: 'mirror-arrival' },
  { eval: 'window.seaLog' },
];
const child = spawn(process.execPath, ['tools/play.mjs', process.argv[2] ?? '/tmp/updraft-sea', JSON.stringify(steps)], {
  stdio: 'inherit',
  env: { ...process.env, BASE: process.env.BASE ?? 'http://127.0.0.1:5230/', QUERY: 'chapter=sea&ratio=1&msaa=2', VIDEO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
