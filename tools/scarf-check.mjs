// Real pointer strokes, idle gates, checkpoint restoration, and the one-time swing.
// Run against Vite: BASE=http://127.0.0.1:5232/ node tools/scarf-check.mjs
// NATURAL=1 follows the walk; CAPTURE=1 captures the four tangles; W/H and OUT control screenshots.
// PHYSICS=1 also checks the first length's fall, settling, stretch, terrain contact and frame-rate independence.
// FROM/TO restrict tangle indices; TOUCH=1 exercises the wrapped trunk with real touch events (use W=390 H=844).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const lock = '/tmp/updraft-chromium.lock';
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let pid = 0; try { pid = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    if (pid && !alive(pid)) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(r => setTimeout(r, 400));
  }
}
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const prefix = process.env.OUT ?? '/tmp/updraft-scarf';
try {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1600), height: Number(process.env.H ?? 900) }, hasTouch: !!process.env.TOUCH });
  const touch = process.env.TOUCH ? await page.context().newCDPSession(page) : null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=birches`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => !__game.carry.busy && !__game.child.acting);
  if (process.env.PHYSICS) await page.evaluate(() => {
    const s=__game.birches.scarf, physics=s.firstCloth;
    window.__clothChecks={peakStretch:1, penetration:0, releasedAt:0, releasedHeight:0, finalHeight:0};
    const original=physics.update.bind(physics);
    window.__clothChecks.supportGap=0;
    physics.update=(dt,wind)=>{
      original(dt,wind);
      const r=physics.report(),checks=window.__clothChecks;
      if(r.stretch>checks.peakStretch){checks.peakStretch=r.stretch;checks.peakAt=s.snags[0].work;}
      checks.penetration=Math.max(checks.penetration,r.penetration);
      if(!physics.releaseRequested){
        for(const pin of physics.supports){
          if(pin%2)continue;
          const center=physics.positions[pin].clone().add(physics.positions[pin+1]).multiplyScalar(.5);
          const rail=physics.supportRail,axis=rail.b.clone().sub(rail.a);
          const t=Math.max(0,Math.min(1,center.clone().sub(rail.a).dot(axis)/axis.lengthSq()));
          checks.supportGap=Math.max(checks.supportGap,center.distanceTo(rail.a.clone().addScaledVector(axis,t)));
        }
      }
      const p=s.snags[0].center.clone();physics.sample(physics.length*.72,p);
      if(s.snags[0].work>=1&&!checks.releasedAt){checks.releasedAt=performance.now();checks.releasedHeight=p.y;}
      checks.finalHeight=p.y;
    };
  });
  for (let index = Number(process.env.FROM ?? 0); index < Number(process.env.TO ?? 4); index++) {
    if (process.env.NATURAL) {
      await page.waitForFunction(index => __game.story.current.beat === 'scarf' && __game.birches.scarf.active === index, index, { timeout: 120000 });
    } else await page.evaluate(index => {
      const g = __game, c = g.story.current, scarf = g.birches.scarf;
      scarf.restore(index);
      g.child.stop();
      const before = scarf.snags[index].before;
      g.child.place(before.x, before.z, Math.PI);
      g.glider.hold(g.child);
      g.cygnet.rideIn('satchel');
      c.leg = [1, 3, 4, 4][index];
      c.toScarf(); c.update(0, c.now); g.rig.cut(c.shot);
    }, index);
    if (process.env.PHYSICS && index === 0) await page.evaluate(() => {
      // Restore settles synchronously before anything renders; measure only visible simulation frames.
      window.__clothChecks.peakStretch=1;window.__clothChecks.supportGap=0;
    });
    await page.waitForTimeout(2200);
    const idle = await page.evaluate(index => ({ work: __game.birches.scarf.snags[index].work, beat: __game.story.current.beat }), index);
    assert.equal(idle.work, 0, `Tangle ${index + 1} solved itself`);
    await page.waitForFunction(index => index === 1
      ? __game.scarfInvitation.coax?.urgency > .6 && __game.swirl.glow > .3
      : __game.scarfInvitation.batch.mesh.visible && __game.scarfInvitation.strokes.some(r => r.alpha > .35), index, {timeout:8000});
    await page.screenshot({ path: `${prefix}-${index + 1}-tied.png` });
    if (process.env.CAPTURE) continue;
    // Distant gestures must not count either.
    await page.evaluate(() => { __game.input.present = false; });
    await page.waitForTimeout(50);
    await page.mouse.move(30, 50); await page.waitForTimeout(50);
    await page.mouse.move(130, 50, { steps: 10 }); await page.waitForTimeout(50);
    assert.equal(await page.evaluate(index => __game.birches.scarf.snags[index].work, index), 0);
    if (index === 1) {
      // Crossing the centre used to be counted as half a turn. Straight fanning must never unwrap the trunk.
      const p = await page.evaluate(() => {
        const p = __game.birches.scarf.snags[1].center.clone().project(__game.rig.camera);
        return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
      });
      for (let stroke = 0; stroke < 6; stroke++) {
        const direction = stroke % 2 ? -1 : 1;
        for (let step = 0; step <= 24; step++) {
          await page.mouse.move(p.x + (step / 24 - .5) * 150 * direction, p.y);
          await page.waitForTimeout(16);
        }
      }
      assert.equal(await page.evaluate(() => __game.birches.scarf.snags[1].target), 0,
        'Straight sweeps must not count as an updraft');
      await page.waitForTimeout(1000);
    }
    let strokes = 0;
    while (strokes < 24) {
      const state = await page.evaluate(index => {
        const g = __game, snag = g.birches.scarf.snags[index];
        const p = snag.center.clone().project(g.rig.camera);
        return { work: snag.target, x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
      }, index);
      if (state.work >= 1) break;
      if (index === 1) {
        const radius = Number(process.env.H ?? 900) * .078;
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: state.x + radius, y: state.y }] });
        else { await page.mouse.move(state.x + radius, state.y); await page.mouse.down(); }
        // Keep the gesture at human circling speed even when DevTools round-trips are slow.
        const began = Date.now(); let angle = 0;
        while (angle < Math.PI * 2) {
          angle = Math.min(Math.PI * 2, (Date.now() - began) / 850 * Math.PI * 2);
          const x = state.x + Math.cos(angle) * radius, y = state.y - Math.sin(angle) * radius;
          if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
          else await page.mouse.move(x, y);
          await page.waitForTimeout(8);
        }
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.mouse.up();
        strokes++;
        console.log(JSON.stringify(await page.evaluate(strokes => ({ circle: strokes, charge: __game.input.charge,
          target: __game.birches.scarf.snags[1].target, active: __game.birches.scarf.active, gust: __game.input.gust,
          beat: __game.story.current.beat }), strokes)));
        continue;
      }
      const dir = index === 0 ? [0, -1] : index === 2 ? [1, 0] : [strokes % 2 ? -1 : 1, 0];
      const start = index === 3 ? [state.x, state.y] : [state.x - dir[0] * 75, state.y - dir[1] * 75];
      const end = [state.x + dir[0] * 75, state.y + dir[1] * 75];
      await page.mouse.move(...start);
      await page.mouse.down();
      for (let j = 1; j <= 16; j++) {
        await page.mouse.move(start[0] + (end[0] - start[0]) * j / 16, start[1] + (end[1] - start[1]) * j / 16);
        await page.waitForTimeout(24);
      }
      await page.mouse.up();
      strokes++;
    }
    await page.waitForFunction(index => __game.birches.scarf.snags[index].freed, index, { timeout: 10000 });
    assert.ok(strokes <= 5, `Tangle ${index + 1} needed ${strokes} strokes`);
    console.log(JSON.stringify({ tangle: index + 1, strokes, idle: 'held', released: true }));
    await page.screenshot({ path: `${prefix}-${index + 1}-free.png` });
    if (process.env.PHYSICS && index === 0) {
      await page.waitForTimeout(6500);
      const result=await page.evaluate(()=>({...window.__clothChecks,...__game.birches.scarf.firstCloth.report()}));
      assert.ok(result.releasedHeight-result.finalHeight>1, `Released scarf did not fall: ${JSON.stringify(result)}`);
      assert.ok(result.peakStretch<1.15, `Cloth stretched too far: ${JSON.stringify(result)}`);
      assert.ok(result.penetration<.02, 'Cloth passed through the ground');
      assert.ok(result.supportGap<.21, 'Loop left its branch before slipping off');
      assert.ok(result.speed<.7, `Cloth did not settle: ${JSON.stringify(result)}`);
      console.log(JSON.stringify({physicalRelease:result}));
      const rates=await page.evaluate(()=>{
        const original=__game.birches.scarf.firstCloth;
        const points=original.home.filter((_,i)=>i%2===0).map((p,i)=>p.clone().add(original.home[i*2+1]).multiplyScalar(.5));
        const run=(fps)=>{
          const cloth=new original.constructor(points,.765,[],[points.length-1],original.floor);
          cloth.capsules=original.capsules;cloth.release();
          for(let i=0;i<fps*5;i++)cloth.update(1/fps);
          return cloth;
        };
        const a=run(30),b=run(60);
        return {difference:Math.max(...a.positions.map((p,i)=>p.distanceTo(b.positions[i]))),at30:a.report(),at60:b.report()};
      });
      assert.ok(rates.difference<.001,`Cloth changed with frame rate: ${JSON.stringify(rates)}`);
      console.log(JSON.stringify({frameRates:rates}));
      await page.screenshot({path:`${prefix}-settled.png`});
    }
    if (index < 3) {
      const point = await page.evaluate(() => ({ name: __game.story.current.checkpoint, data: __game.story.current.saveCheckpoint() }));
      await page.evaluate(point => {
        const g = __game; g.birches.scarf.restore(0); g.story.current.restoreCheckpoint(point.name, point.data);
      }, point);
      assert.equal(await page.evaluate(() => __game.birches.scarf.completed), index + 1);
    }
  }
  if (!process.env.CAPTURE && !process.env.TO) {
  await page.waitForFunction(() => __game.birches.scarf.finished, null, { timeout: 18000 });
  assert.equal(await page.evaluate(() => __game.boat.scarfSail), 1);
  await page.screenshot({ path: `${prefix}-sail.png` });
  // Finished three-knot saves keep their earned sail; new three-of-four saves still have the bow to do.
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    c.restoreCheckpoint('scarf-3',[4,0,.65,3]);
    if(g.birches.scarf.completed!==4||g.boat.scarfSail!==1)throw Error('Old completed scarf save regressed');
    c.restoreCheckpoint('scarf4-3',[4,0,.65,3]);
    if(g.birches.scarf.completed!==3||g.boat.scarfSail!==0)throw Error('New partial scarf save skipped the bow');
    g.birches.scarf.restore(4);
  });
  // Restore by the swing, then test that sustained input can continue past the old fixed timeout.
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(3,-1107,0);g.glider.hold(g.child);
    c.swings=0;c.swingOffered=false;c.resumeWalk();c.update(0,c.now);g.rig.cut(c.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'swingOffer');
  await page.waitForTimeout(1400);
  await page.screenshot({path:`${prefix}-swing-offer.png`});
  const seat = await page.evaluate(() => {
    const g=__game,p=g.child.position.clone();g.birches.swing.seat(p);p.project(g.rig.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  await page.mouse.move(seat.x-65,seat.y);await page.mouse.down();
  for(let i=1;i<=16;i++){await page.mouse.move(seat.x-65+i*8,seat.y);await page.waitForTimeout(24);}
  await page.mouse.up();
  await page.waitForFunction(() => __game.story.current.beat === 'swinging');
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${prefix}-swing-riding.png`});
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    c.beatStart=c.now-60; c.lastSwingInput=c.now; g.input.present=true;g.input.gust=3;
    c.update(1/60,c.now+1/60);
    if(c.beat!=='swinging'||c.leavingSwing)throw Error('Fixed timeout still ends ride');
    g.input.present=false;g.input.gust=0;g.input.charge=0;
  });
  await page.waitForFunction(() => __game.story.current.beat === 'walk', null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => __game.story.current.swings), 1);
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(3,-1116,0);c.play='hold';c.holdUntil=c.now+20;
    g.wind.addSplat({ax:2.6,az:-1118,bx:2.6,bz:-1118,vx:20,vz:0,radius:5,energy:1,lift:0,swirl:0});
  });
  await page.waitForTimeout(1000);
  assert.notEqual(await page.evaluate(() => __game.story.current.beat), 'toSwing');
  assert.notEqual(await page.evaluate(() => __game.story.current.beat), 'swinging');
  console.log('Checkpoints, red sail, controlled swing exit, and one-time swing passed.');
  // The independent bird must be gathered before the scarf's departure reward can continue.
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(-3,-1183,Math.PI);g.glider.hold(g.child);
    c.leg=4;c.resumeWalk();c.lastLegAt=c.now-50;
    g.cygnet.release(g.child.position.clone().add({x:2,y:0,z:1}));
  });
  await page.waitForFunction(() => __game.story.name !== 'birches', null, { timeout: 90000 });
  assert.equal(await page.evaluate(() => __game.cygnet.carried), true);
  assert.equal(await page.evaluate(() => __game.boat.scarfSail), 1);
  console.log('Cygnet gathered and departure continued with the red sail.');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  try { if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); } catch {}
}
