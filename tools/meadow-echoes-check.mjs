// Real pointer play of Meadow; FROM=meadow includes arrival and piano, FULL=1 continues through the pond.
// BASE=http://127.0.0.1:5244/ OUT=/tmp/meadow W=1600 H=900 node tools/meadow-echoes-check.mjs
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const out = process.env.OUT ?? '/tmp/updraft-meadow-echoes';
fs.mkdirSync(out, { recursive: true });
const width = +(process.env.W ?? 1600), height = +(process.env.H ?? 900);
const { browser, close } = await openBrowser();
const report = { states: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: process.env.TOUCH === '1' });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5244/'}?shot=1&chapter=${process.env.FROM ?? 'echoes'}&progress=0`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.mouse.click(8, 8);
  const touch = process.env.TOUCH === '1' ? await context.newCDPSession(page) : null;
  const state = () => page.evaluate(() => {
    const g = __game, c = g.story.current, e = g.meadowEchoes;
    const p = v => { const q = v.clone().project(g.rig.camera); return [(q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2,q.z]; };
    return { time: __stats.time, chapter: g.story.name, beat: c.beat, pianoBeat: c.piano?.at, song: c.song?.beat,
      count: e.seeds.completed, progress: e.seeds.progress, active: e.seeds.active,
      seed: p(e.seed), target: p(e.receiver), child: p(g.child.position.clone().add({x:0,y:1.5,z:0})),
      feet: p(g.child.position), head: p(g.child.position.clone().add({x:0,y:2.8,z:0})),
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
  const sweep = async (a,b,ms=1000) => {
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
  let idleChecked = false, last = '', count = 0, shotsAt = -10;
  const end = Date.now() + 9 * 60000;
  while(Date.now() < end) {
    const s = await state();
    if (s.chapter !== 'meadow') { await shot('departed'); break; }
    const phase = `${s.beat}-${s.pianoBeat}-${s.song}-${s.count}`;
    if(phase !== last) { await shot(phase); last = phase; }
    if(s.song === 'done' && !process.env.FULL) {
      await page.waitForTimeout(4000); await shot('walk-resumes'); break;
    }
    if(s.piano) {
      const forward = s.piano.expect.at(-1)>s.piano.expect[0];
      await sweep(s.piano.path[forward?0:1],s.piano.path[forward?1:0],1500);
      await page.waitForTimeout(1500);
    } else if(s.active) {
      if(!idleChecked) {
        await page.mouse.move(4,4); await page.waitForTimeout(6500);
        assert.equal((await state()).count,0,'idle must not solve the first transfer');
        assert((await state()).progress < .02, 'ambient wind must not carry the seeds');
        await sweep([width*.8,height*.12],[width*.95,height*.12]);
        assert((await state()).progress < .02, 'off-target motion must not carry the seeds');
        idleChecked = true; await shot('waiting-for-wind'); continue;
      }
      for(const p of [s.seed,s.target,s.head,s.feet]) {
        assert(p[0]>12&&p[0]<width-12&&p[1]>12&&p[1]<height-12&&p[2]<1,`playable subject clipped: ${JSON.stringify(s)}`);
      }
      const dx=s.target[0]-s.seed[0],dy=s.target[1]-s.seed[1],n=Math.hypot(dx,dy)||1;
      const reach=Math.min(height*.21,n+height*.03);
      const a=[s.seed[0]-dx/n*height*.05,s.seed[1]-dy/n*height*.05];
      const b=[s.seed[0]+dx/n*reach,s.seed[1]+dy/n*reach].map((v,i)=>Math.max(15,Math.min((i?height:width)-15,v)));
      await sweep(a,b);
      if(s.time-shotsAt>3) { await shot('carrying'); shotsAt=s.time; }
      if(++count>80) throw new Error('Seed transfer did not finish after broad real strokes');
    } else if(s.beat === 'pond' && s.invitation) {
      const a=s.invitation,angle=s.heading??0;
      await sweep([a[0]-Math.cos(angle)*height*.04,a[1]+Math.sin(angle)*height*.04],
        [a[0]+Math.cos(angle)*height*.12,a[1]-Math.sin(angle)*height*.12],800);
    } else await page.waitForTimeout(800);
  }
  const final = await state();
  assert.equal(final.count,2,'both transfers must be completed');
  if(process.env.FULL) assert.equal(final.chapter,'toBirches','full play must depart Meadow');
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  console.log('PASS: player gestures, visible subjects, idle/off-target, transfers and onward story.');
} finally {
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  await close();
}
