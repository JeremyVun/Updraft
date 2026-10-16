// Real pointer play of Meadow; FROM=meadow includes arrival and piano, FULL=1 continues through the pond.
// BASE=http://127.0.0.1:5244/ OUT=/tmp/meadow W=1600 H=900 node tools/meadow-echoes-check.mjs
// TRACE=1 samples every camera frame; AUDIT=1 captures the intervening walk. These are not a motion review.
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import './lib/typescript.mjs';
const { tuning: { meadowEchoes: tuning } } = await import('../src/tuning.ts');

const out = process.env.OUT ?? '/tmp/updraft-meadow-echoes';
fs.mkdirSync(out, { recursive: true });
if (process.env.TRACE === '1') fs.writeFileSync(`${out}/audit-camera.jsonl`,'');
const width = +(process.env.W ?? 1600), height = +(process.env.H ?? 900);
const { browser, close } = await openBrowser();
const report = { states: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: process.env.TOUCH === '1' });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) report.errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5244/'}?shot=1&chapter=${process.env.FROM ?? 'echoes'}&progress=0`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.mouse.click(8, 8);
  if (process.env.TRACE === '1') await page.evaluate(() => {
    const g = __game, rig = g.rig, original = rig.update.bind(rig);
    const r = v => v ? v.toArray().map(x => +x.toFixed(4)) : null;
    const project = v => { const q = v.clone().project(rig.camera); return [(q.x+1)/2,(1-q.y)/2,q.z]; };
    let label = '';
    window.__cameraTrace = [];
    rig.update = (dt,time,shot,pace,hold) => {
      original(dt,time,shot,pace,hold);
      const c = g.story.current, garden = g.meadowEchoes;
      const now = `${g.story.name}/${c.beat}/${c.piano?.at}/${c.song?.beat}/${garden.seeds.completed}`;
      window.__cameraTrace.push({t:+time.toFixed(4),dt,...(now!==label?{at:(label=now)}:{}),
        eye:r(rig.camera.position),look:r(rig.look),child:r(g.child.position),
        fit:rig.fitBack,pull:rig.pull,lift:rig.lift,rise:rig.sceneryRise,side:r(rig.sceneryOffset),
        offset:rig.direction.offset,pace,hold,placed:rig.placed,transition:!!g.story.transitionView,
        head:project(g.child.position.clone().add({x:0,y:2.8,z:0})),feet:project(g.child.position),
        sectors:garden.sectors.map(project),bird:project(g.cygnet.position),
      });
    };
  });
  const touch = process.env.TOUCH === '1' ? await context.newCDPSession(page) : null;
  const state = () => page.evaluate(() => {
    const g = __game, c = g.story.current, e = g.meadowEchoes;
    const p = v => { const q = v.clone().project(g.rig.camera); return [(q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2,q.z]; };
    return { time: __stats.time, chapter: g.story.name, beat: c.beat, pianoBeat: c.piano?.at, song: c.song?.beat,
      count: e.seeds.completed, progress: e.seeds.progress, active: e.seeds.active, matched: g.piano.matched,
      seed: p(e.seed), target: p(e.receiver), child: p(g.child.position.clone().add({x:0,y:1.5,z:0})),
      feet: p(g.child.position), head: p(g.child.position.clone().add({x:0,y:2.8,z:0})),
      sectors: e.sectors.map(p), patch: p(e.patches[1]), finishing: e.seeds.finishing, bird: p(g.cygnet.position),
      opened: e.flowers.filter(f => f.seen && f.shown > .6).length, flying: e.down.count,
      invitation: c.windInvitation ? p(c.windInvitation) : null, heading: c.invitationHeading,
      piano: g.piano.expect && c.piano?.at === 'seated'
        ? { expect: g.piano.expect, path: [0,1].map(t=>p(g.piano.guideAlong(t,g.piano.keys.clone()))) } : null,
      camera: g.rig.camera.position.toArray(), at: g.child.position.toArray() };
  });
  const shot = async label => {
    const s = await state(); report.states.push({ label, ...s });
    await page.screenshot({ path: `${out}/${String(report.states.length).padStart(3,'0')}-${label}.png` });
    console.log(JSON.stringify({ label, time: s.time, beat: s.beat, song: s.song, count: s.count, progress:s.progress }));
  };
  const circle = async (centre, loops, r = height * .08) => {
    const at = a => [centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r];
    if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at(0)[0],y:at(0)[1]}]});
    else await page.mouse.move(...at(0));
    for(let i=1;i<=loops*24;i++) {
      const [x,y]=at(i*Math.PI*2/24);
      if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(30);
    }
    if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const sweep = async (a,b,ms=1000) => {
    a = [Math.max(16,Math.min(width-16,a[0])),Math.max(16,Math.min(height-16,a[1]))];
    b = [Math.max(16,Math.min(width-16,b[0])),Math.max(16,Math.min(height-16,b[1]))];
    if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1]}]});
    else { await page.mouse.move(2,2); await page.waitForTimeout(80); await page.mouse.move(a[0],a[1]); }
    await page.waitForTimeout(130);
    for(let i=1;i<=40;i++) {
      const x=a[0]+(b[0]-a[0])*i/40,y=a[1]+(b[1]-a[1])*i/40;
      if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(ms/40);
    }
    if(touch) await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await shot('entry');
  const idleChecked = new Set(); let last = '', count = 0, shotsAt = -10, auditAt = -10, matched = 0;
  let sweeps = 0, loops = 0, swept = false, lifted = 0;
  const end = Date.now() + 9 * 60000;
  while(Date.now() < end) {
    const s = await state();
    if (process.env.TRACE === '1') {
      const rows = await page.evaluate(() => window.__cameraTrace.splice(0).map(r=>JSON.stringify(r)).join('\n'));
      if (rows) fs.appendFileSync(`${out}/audit-camera.jsonl`,rows+'\n');
    }
    if (process.env.AUDIT === '1' && s.time-auditAt>1 && s.beat==='walk' && s.pianoBeat==='done') {
      await shot(`audit-${s.time.toFixed(1)}`); auditAt=s.time;
    }
    if (s.chapter !== 'meadow') { await shot('departed'); break; }
    const phase = `${s.beat}-${s.pianoBeat}-${s.song}-${s.count}`;
    if(phase !== last) { await shot(phase); last = phase; }
    if(s.matched > matched) { matched = s.matched; await shot(`piano-answer-${matched}`); }
    if(s.song === 'done' && !process.env.FULL) {
      await page.waitForTimeout(4000); await shot('walk-resumes'); break;
    }
    if(s.piano) {
      const forward = s.piano.expect.at(-1)>s.piano.expect[0];
      await sweep(s.piano.path[forward?0:1],s.piano.path[forward?1:0],1500);
      await page.waitForTimeout(1500);
    } else if(s.active) {
      if(!idleChecked.has(s.count)) {
        const stage=s.count;
        await page.mouse.move(4,4); await page.waitForTimeout(6500);
        assert.equal((await state()).count,stage,'idle must not complete the play');
        assert((await state()).progress < .02, 'ambient wind must not wake the bed or lift the down');
        await sweep([width*.8,height*.12],[width*.95,height*.12]);
        assert((await state()).progress < .02, 'off-target motion must not play');
        idleChecked.add(stage); await shot(`waiting-for-wind-${stage}`); continue;
      }
      for(const p of [s.head,s.feet,s.bird,...(s.count===0?s.sectors:[s.patch])]) {
        assert(p[0]>12&&p[0]<width-12&&p[1]>12&&p[1]<height-12&&p[2]<1,`playable subject clipped: ${JSON.stringify(s)}`);
      }
      if(s.count===0) {
        const at=s.invitation??s.sectors[1];
        await sweep([at[0]-height*.3,at[1]],[at[0]+height*.3,at[1]],1000);
        sweeps++;
        if(sweeps===1) {
          await page.waitForTimeout(900);
          assert((await state()).opened>4,'one sweep must visibly wake flowers along its track');
        }
        const after=await state();
        if(after.finishing>=0) {
          const from=after.time;
          await page.waitForFunction(()=>__game.meadowEchoes.seeds.completed>0,null,{timeout:20000});
          const took=(await state()).time-from;
          assert(took<tuning.bedFinish+.6,`the bed's last sleepers rise at once, not after a hidden wait (${took.toFixed(2)} s)`);
          console.log(JSON.stringify({bed:'awake',sweeps,finish:+took.toFixed(2)}));
        }
      } else {
        if(!swept) {
          await sweep([s.patch[0]-height*.25,s.patch[1]],[s.patch[0]+height*.25,s.patch[1]-height*.08],900);
          await page.waitForTimeout(1500);
          assert.equal((await state()).progress,0,'a sweep stirs the seed heads but lifts no down');
          swept=true; continue;
        }
        await circle([s.patch[0],s.patch[1]-height*.02],1); loops++;
        const now=await state();
        assert(now.progress>=lifted||now.count===2,'lifted down is never lost');
        lifted=now.progress;
        if(now.count===2) console.log(JSON.stringify({seeds:'lifted',loops}));
      }
      if(s.time-shotsAt>3) { await shot(s.count === 0 ? 'flower-strokes' : 'lifting-seeds'); shotsAt=s.time; }
      if(++count>80) throw new Error('Meadow play did not finish after broad real strokes');
    } else if(s.beat === 'pond' && s.invitation) {
      const a=s.invitation,angle=s.heading??0;
      await sweep([a[0]-Math.cos(angle)*height*.04,a[1]+Math.sin(angle)*height*.04],
        [a[0]+Math.cos(angle)*height*.12,a[1]-Math.sin(angle)*height*.12],800);
    } else await page.waitForTimeout(800);
  }
  const final = await state();
  assert.equal(final.count,2,'both meadow play moments must be completed');
  if(process.env.FULL) assert.equal(final.chapter,'toBirches','full play must depart Meadow');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('PASS: player gestures, visible subjects, idle/off-target, flower phrases, seed lift and onward story.');
} finally {
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  await close();
}
