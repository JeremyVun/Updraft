// Capture natural final-approach handoffs and discrete rendering state changes in Chrome for Testing.
// BASE=<frozen QA> CASE=toLines OUT=/tmp/<dir> node tools/rendering-continuity-audit.mjs
// MODE=departure CASE=sleeping|meadow|wood starts before boarding instead of on the incoming crossing.
// Seeds the last route leg, then lets the real chapter/boat/main loop perform the arrival.
// Evidence is frame pairs and state traces, not a full playthrough or motion review.
// AFTER=720 retains twelve seconds after the handoff; W/H change the viewport.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const name = process.env.CASE ?? 'toLines';
const departure = process.env.MODE === 'departure';
const tag = `${name}${departure ? '-departure' : ''}`;
const out = process.env.OUT ?? fs.mkdtempSync('/tmp/updraft-continuity-');
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
const errors = [];
try {
  const width = Number(process.env.W ?? 1280), height = Number(process.env.H ?? 800);
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=${name}&ratio=1&msaa=2&progress=0&analytics=0`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 }).catch(async error => {
    console.log(JSON.stringify({name,errors,body:await page.locator('body').innerText()}));
    await page.screenshot({path:`${out}/${tag}-boot.png`}); throw error;
  });
  console.log(`${tag}: ready`);
  await page.evaluate(({name,departure,afterFrames}) => {
    const g = __game, c = g.story.current, b = g.boat;
    if (departure) {
      if (name === 'sleeping') {
        c.atTheTop();
        const beside = b.boardingPoint(b.position.clone());
        g.child.dismount(); g.child.stop(); g.child.place(beside.x + 5, beside.z, -Math.PI / 2);
        g.cygnet.rideIn('satchel');
        c.restoreCheckpoint('morning', []);
      }
      else if (name === 'meadow' || name === 'wood') {
        if (name === 'meadow') { c.skipAhead(); c.crestDone = true; c.holdUntil = Infinity; }
        else { c.restoreCheckpoint('dry', [999, 999]); c.storm = .15; c.shower = 0; }
        c.update(0, __stats.time);
        const beside = b.boardingPoint(b.position.clone());
        g.child.dismount(); g.child.stop(); g.child.place(beside.x + 6, beside.z, -Math.PI / 2);
        g.cygnet.rideIn('satchel'); c.board();
      }
      else throw new Error(`Unsupported departure: ${name}`);
      c.update(0, __stats.time);
      g.rig.cut(c.shot);
    } else {
      let leg = c.route.length - 1, remaining = 85;
      while (leg > 1 && c.route[leg].distanceTo(c.route[leg-1]) < remaining) {
        remaining -= c.route[leg].distanceTo(c.route[leg-1]); leg--;
      }
      const end = c.route[leg], prev = c.route[leg-1];
      const length = end.distanceTo(prev), distance = Math.min(remaining, length * .8);
      b.position.x = end.x + (prev.x - end.x) * distance / length;
      b.position.z = end.y + (prev.y - end.y) * distance / length;
      b.yaw = Math.atan2(end.x - b.position.x, end.y - b.position.z);
      b.speed = 4;
      c.restoreCheckpoint(name === 'toMirror' ? 'whale-gone' : 'swim', [leg, 150]);
      c.update(0);
      g.rig.cut(c.shot);
    }
    const oldRender = g.post.render.bind(g.post);
    const previous = document.createElement('canvas'); previous.width = innerWidth; previous.height = innerHeight;
    const ctx = previous.getContext('2d');
    const small = document.createElement('canvas'); small.width = 160; small.height = 100;
    const sample = small.getContext('2d', { willReadFrequently: true });
    const value = x => x?.toArray ? x.toArray() : ArrayBuffer.isView(x) ? Array.from(x) : x;
    let last = null, lastPixels = null, count = 0, after = 0;
    window.audit = { name, events: [], trace: [], peaks: [], samples: [], done: false };
    const keys = ['uJourneyRooms','uRoom','uDomain','uMirrorOn','uSeaState','uSwell','uSquall','uVeil',
      'uSunDir','uSunColor','uSkyZenith','uStormCover','uSkyMirrorAppearance','uCloudDeck','uSeaFogShape','uHorizonMist','uIsleMistRange',
      'uJourneyVeilAmounts','uSeaEffects','uWaterRooms'];
    g.post.render = (...args) => {
      oldRender(...args);
      const u = g.water.mesh.material.uniforms;
      const state = { frame: __stats.frame, chapter: g.story.name, beat: g.story.current.beat,
        eye: g.rig.camera.position.toArray(), boat: b.position.toArray(),
        reflectionSize: [g.water.reflectionTarget.width,g.water.reflectionTarget.height],
        quality: g.quality.level.name,
        fireflyShelter: g.fireflies.mesh.material.uniforms.uShelter.value,
        mirrorKite: g.departureKites.markers.mirror.group.visible,
        ...Object.fromEntries(keys.filter(k=>u[k]).map(k=>[k,value(u[k].value)])) };
      sample.drawImage(g.renderer.domElement, 0, 0, 160, 100);
      const pixels = sample.getImageData(0, 0, 160, 100).data;
      let diff = 0, changed = 0;
      if (lastPixels) for (let i = 0; i < pixels.length; i += 4) {
        const d = (Math.abs(pixels[i]-lastPixels[i])+Math.abs(pixels[i+1]-lastPixels[i+1])+Math.abs(pixels[i+2]-lastPixels[i+2]))/3;
        diff += d; changed += d > 12 ? 1 : 0;
      }
      state.diff = diff / 16000; state.changed = changed / 16000;
      if (last && count > 1) {
        const switches = ['chapter','uJourneyRooms','uRoom','uDomain','uMirrorOn','reflectionSize','quality','mirrorKite']
          .filter(k => JSON.stringify(state[k]) !== JSON.stringify(last[k]));
        const event = switches.length || count > 120 && state.diff > 2 && state.diff > last.diff * 3;
        if (event && audit.events.length < 100) {
          const entry = { switches, before: last, after: state,
            beforeImage: previous.toDataURL('image/jpeg', .91), afterImage: g.renderer.domElement.toDataURL('image/jpeg', .91) };
          if (last.uMirrorOn === 0 && state.uMirrorOn === 1) {
            u.uMirrorOn.value = 0; oldRender(...args);
            entry.withoutReflectionImage = g.renderer.domElement.toDataURL('image/jpeg', .91);
            u.uMirrorOn.value = 1; oldRender(...args);
          }
          audit.events.push(entry);
        }
        if (count > 120 && (audit.peaks.length < 8 || state.diff > audit.peaks.at(-1).after.diff)) {
          audit.peaks.push({ before:last, after:state, beforeImage:previous.toDataURL('image/jpeg',.91),
            afterImage:g.renderer.domElement.toDataURL('image/jpeg',.91) });
          audit.peaks.sort((a,b)=>b.after.diff-a.after.diff); audit.peaks.length=Math.min(8,audit.peaks.length);
        }
      }
      audit.trace.push(state); count++;
      ctx.drawImage(g.renderer.domElement,0,0);
      last = state; lastPixels = pixels;
      if (g.story.name !== name) after++;
      if (after > 0 && after % 60 === 0) audit.samples.push({ after:state,
        afterImage:g.renderer.domElement.toDataURL('image/jpeg',.91) });
      if (after >= afterFrames || count > 7200) audit.done = true;
    };
  }, {name,departure,afterFrames:Number(process.env.AFTER ?? 360)});
  await page.waitForFunction(() => audit.done, null, { timeout: 240000, polling: 200 });
  const result = await page.evaluate(() => audit);
  for (const group of ['events','peaks','samples']) for (const [index,event] of result[group].entries()) {
    for (const side of ['before','after','withoutReflection'].filter(side => event[`${side}Image`])) {
      const file = `${tag}-${group}-${String(index).padStart(2,'0')}-${side}.jpg`;
      fs.writeFileSync(`${out}/${file}`, Buffer.from(event[`${side}Image`].split(',')[1], 'base64'));
      event[`${side}Image`] = file;
    }
  }
  fs.writeFileSync(`${out}/${tag}.json`,JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({name,out,errors,frames:result.trace.length,arrived:result.trace.at(-1).chapter,
    events:result.events.map(e=>({switches:e.switches,frame:e.after.frame,diff:e.after.diff,changed:e.after.changed})),
    peaks:result.peaks.map(e=>({frame:e.after.frame,diff:e.after.diff,chapter:e.after.chapter}))}));
} finally { await close(); }
