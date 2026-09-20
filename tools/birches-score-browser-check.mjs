// Live score routing with a real swing brush and real scarf circles; positions/final bow are fixtures.
// node tools/birches-score-browser-check.mjs (Vite on 5230, or BASE; shared GPU lock).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=birches&ratio=1&msaa=2');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.mouse.click(10, 10);
  await page.evaluate(() => {
    const g = __game;
    window.birchesAudio = { phases: [], wrong: [], frames: 0, chimes: 0, updrafts: 0, wrongChords: [], maxVoices: 0 };
    const original = g.sound.update.bind(g.sound), chime = g.sound.chime.bind(g.sound);
    g.sound.chime = (...args) => {
      birchesAudio.chimes++;
      if (args[4] === 1.6 && g.sound.birchesScore) {
        birchesAudio.updrafts++;
        const pitches = g.sound.birchesScore.chordAt(args[3]).map(m => m % 12);
        if (!pitches.includes(args[0] % 12)) birchesAudio.wrongChords.push(args[0]);
      }
      chime(...args);
    };
    g.sound.update = (dt, state) => {
      original(dt, state); if (!g.sound.running) return;
      const score = g.sound.birchesScore, phase = score?.current?.phase ?? 'off';
      if (score) window.lastBirchesScore = score;
      if (phase !== (g.story.current.birchesScore ?? 'off')) birchesAudio.wrong.push({ phase, expected: g.story.current.birchesScore });
      if (birchesAudio.phases.at(-1)?.phase !== phase) birchesAudio.phases.push({ phase, beat: g.story.current.beat, time: g.story.current.now });
      birchesAudio.maxVoices = Math.max(birchesAudio.maxVoices, score ? [...score.parts].reduce((n,p) => n+p.voices.size,0) : 0);
      birchesAudio.frames++;
    };
    g.sound.start();
  });
  await page.waitForFunction(() => __game.sound.birchesScore?.current.phase === 'walk' && !__game.carry.busy && !__game.child.acting, null, { timeout: 60000 });
  await page.evaluate(() => { window.beforeMute = __game.sound.birchesScore; __game.sound.setMuted(true); });
  await page.waitForFunction(() => __game.sound.ctx.state === 'suspended');
  const frozen = await page.evaluate(() => __game.sound.ctx.currentTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => __game.sound.ctx.currentTime), frozen, 'Mute freezes the phrase clock');
  await page.evaluate(() => __game.sound.setMuted(false));
  await page.waitForFunction(() => __game.sound.running);
  assert(await page.evaluate(() => __game.sound.birchesScore === beforeMute), 'Unmute keeps the score instance');

  await page.evaluate(() => {
    const g = __game, c = g.story.current;
    g.birches.scarf.restore(1); g.child.stop(); g.child.place(3,-1107,0); g.glider.hold(g.child);
    g.cygnet.rideIn('satchel'); c.swings=0; c.swingOffered=false;
    c.resumeWalk(); c.update(0,c.now); g.rig.cut(c.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'swingOffer');
  await page.waitForTimeout(1400);
  const seat = await page.evaluate(() => {
    const g=__game,p=g.child.position.clone();g.birches.swing.seat(p);p.project(g.rig.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  await page.mouse.move(seat.x-65,seat.y); await page.mouse.down();
  for(let i=1;i<=16;i++){await page.mouse.move(seat.x-65+i*8,seat.y);await page.waitForTimeout(24);}
  await page.mouse.up();
  await page.waitForFunction(() => __game.story.current.beat === 'swinging' && __game.sound.birchesScore?.current.phase === 'swing', null, { timeout: 30000 });
  await page.waitForFunction(() => !['toSwing','swinging'].includes(__game.story.current.beat) && __game.sound.birchesScore?.current.phase === 'scarf', null, { timeout: 30000 });
  console.log('The real swing brush starts its phrase; a quiet exit returns to the scarf accompaniment.');

  await page.evaluate(() => {
    const g=__game,c=g.story.current,s=g.birches.scarf;
    s.restore(1);g.child.stop();const p=s.snags[1].before;g.child.place(p.x,p.z,Math.PI);
    g.glider.hold(g.child);g.cygnet.rideIn('satchel');c.leg=3;c.toScarf();c.update(0,c.now);g.rig.cut(c.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'scarf');
  await page.waitForTimeout(1800);
  const initial = await page.evaluate(() => birchesAudio.updrafts);
  for(let turn=0;turn<3;turn++){
    const p=await page.evaluate(()=>{const p=__game.birches.scarf.snags[1].center.clone().project(__game.rig.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    const radius=800*.078;await page.mouse.move(p.x+radius,p.y);await page.mouse.down();
    const began=Date.now();let angle=0;
    while(angle<Math.PI*2){angle=Math.min(Math.PI*2,(Date.now()-began)/850*Math.PI*2);await page.mouse.move(p.x+Math.cos(angle)*radius,p.y-Math.sin(angle)*radius);await page.waitForTimeout(8);}
    await page.mouse.up();
  }
  assert(await page.evaluate(n=>birchesAudio.updrafts>n && __game.birches.scarf.snags[1].target>0,initial), 'Real scarf circles create chimes and puzzle progress');
  assert.equal(await page.evaluate(()=>__game.sound.birchesScore.current.phase),'scarf');
  console.log('Real circling keeps the scarf accompaniment quiet and produces harmonically matched updraft chimes.');

  // Arrange the last bow at full gesture progress, then let the real release/gathering logic run.
  await page.evaluate(() => {
    const g=__game,c=g.story.current,s=g.birches.scarf;
    s.restore(3);g.child.stop();const p=s.snags[3].before;g.child.place(p.x,p.z,Math.PI);
    g.glider.hold(g.child);g.cygnet.rideIn('satchel');c.leg=4;c.toScarf();
    s.snags[3].target=1;c.update(0,c.now);g.rig.cut(c.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'unravelling',null,{timeout:15000});
  assert.equal(await page.evaluate(()=>__game.sound.birchesScore.current.phase),'scarf');
  await page.waitForFunction(() => __game.birches.scarf.finished && __game.sound.birchesScore?.current.phase === 'return',null,{timeout:20000});
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.cygnet.rideIn('satchel');const p=g.boat.boardingPoint(g.child.position.clone());
    g.child.place(p.x,p.z,g.boat.yaw);c.board();
  });
  await page.waitForFunction(() => !__game.sound.birchesScore && lastBirchesScore.parts.size===0 && __game.sound.padGain.gain.value>.04,null,{timeout:15000});
  const report=await page.evaluate(()=>({...birchesAudio,remainingParts:lastBirchesScore.parts.size,chapter:__game.story.name,beat:__game.story.current.beat}));
  assert.deepEqual(report.wrong,[]);assert.deepEqual(report.wrongChords,[]);assert.deepEqual(errors,[]);
  assert(['walk','swing','scarf','return','off'].every(phase=>report.phases.some(p=>p.phase===phase)));
  assert(report.maxVoices<100 && report.remainingParts===0);
  fs.writeFileSync('/tmp/updraft-birches-score-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally { await close(); }
