// Run real boat/chapter code on the CPU: route completion, storm timing and hard-turn regressions.
// No renderer or browser. The wind fixture covers no input, sustained gusts and different frame rates.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { Boat } = await import('../src/traveller/boat.ts');
const { DrownedChapter } = await import('../src/story/drowned.ts');
const { CrossingChapter } = await import('../src/story/crossing.ts');
const { LIGHTHOUSE } = await import('../src/world/drowned.ts');
const { BIRCHES_BERTH } = await import('../src/world/birches.ts');
const { roundedWaypoint } = await import('../src/traveller/navigation.ts');
const { BOATS_BERTH } = await import('../src/world/little-boats-layout.ts');
const { ROUTES } = await import('../src/story/journey.ts');
const { LINES_BERTH } = await import('../src/story/lines.ts');
const { FAR_SHORE } = await import('../src/story/meadow.ts');
const { HOME_MOORING } = await import('../src/story/home.ts');
const { tuning } = await import('../src/tuning.ts');

function fixture(gust = 0) {
  const wind = { breeze: new THREE.Vector2(2.47, -0.80), calm: 3,
    sample(_x, _z, out) { return Object.assign(out, { x: this.breeze.x + gust, z: this.breeze.y - gust, energy: gust !== 0 ? 0.8 : 0, lift: 0 }); } };
  const boat = new Boat(wind);
  const child = { position: new THREE.Vector3(), ride(p) { this.position.copy(p); },
    handPosition(out) { return out.copy(this.position).add(new THREE.Vector3(0, 1, 0)); }, reach() {}, wave() {} };
  const plane = { held: true, position: new THREE.Vector3(), hold() {},
    launch(p) { this.position.copy(p); this.held = false; }, depart() {} };
  return { wind, boat, child, plane, cygnet: { carried: true, mind: { perform() {}, startle() {} }, eye: out => out.copy(child.position) },
    lines: { gust() {} }, sealife: { fishNear() {}, dolphinsWith() {}, whale: null, dolphinShow: null } };
}
const { drownedCast, stormCast } = await import('./lib/storm-cast.mjs');
/** The drowned village's wind for the storm checks: its breeze plus a steady push. */
const drownedWind = (gust) => ({ breeze: new THREE.Vector2(2.47, -0.80), calm: 3, addSplat() {},
  sample(_x, _z, out) { return Object.assign(out, { x: this.breeze.x + gust, z: this.breeze.y - gust, energy: gust !== 0 ? 0.8 : 0, lift: 0 }); } });
// The storm from her seated aboard at the nave to the forest beach: the look back at the cat, out round the church on
// the first air, past the lighthouse's side as its light goes out, the plane lost in the dark and the landing about 49 s
// after casting off, whatever the player's wind and the frame rate.
const report = [];
for (const [gust, fps] of [[0,60], [8,60], [0,30], [8,30], [40,60], [-40,60]]) {
  const wind = drownedWind(gust);
  const { cast, chapter } = stormCast(wind), boat = cast.boat;
  let snatch = null, lastBeat = '', turns = 0, lastYaw = boat.yaw, lightGap = Infinity, outAt = null;
  let turnLeg = -1, legTurn = 0, mostLegTurn = 0, sailingSpeed = 0, sailingFrames = 0;
  const gusts = [];
  cast.lines.gust = (...args) => gusts.push({ time: chapter.stormTime, count: args[4] });
  const beats = [];
  for (let frame = 0; frame < fps * 120; frame++) {
    const dt = 1 / fps, time = frame * dt;
    wind.breeze.set(2.47, -0.80).multiplyScalar(chapter.breeze);
    wind.calm = wind.breeze.length() * tuning.wind.calm;
    lightGap = Math.min(lightGap, Math.hypot(boat.position.x - LIGHTHOUSE.x, boat.position.z - LIGHTHOUSE.z));
    chapter.update(dt, time); boat.swell = chapter.storm; boat.update(dt, time);
    if (chapter.beat !== lastBeat) { beats.push([chapter.beat, +time.toFixed(2)]); lastBeat = chapter.beat; }
    if (chapter.beat === 'snatch' && snatch === null) snatch = time;
    if (outAt === null && chapter.stormTime >= tuning.storm.lighthouseOutAt) outAt = Math.hypot(boat.position.x - LIGHTHOUSE.x, boat.position.z - LIGHTHOUSE.z);
    const turned = Math.abs(Math.atan2(Math.sin(boat.yaw - lastYaw), Math.cos(boat.yaw - lastYaw)));
    if (chapter.out !== turnLeg) { legTurn = 0; turnLeg = chapter.out; }
    legTurn += turned;
    mostLegTurn = Math.max(mostLegTurn, legTurn);
    turns += turned;
    lastYaw = boat.yaw;
    if (chapter.stormTime > 15 && chapter.stormTime < 35) { sailingSpeed += boat.speed; sailingFrames++; }
    if (chapter.stormTime > 0) assert.equal(chapter.church.catAt, 'sill', 'cat stays at the window after cast-off');
    if (chapter.done) {
      report.push({ gust, fps, stormToShore: +time.toFixed(2), stormTurns: +(turns / (2 * Math.PI)).toFixed(3), lightGap: +lightGap.toFixed(1),
        lightOutFrom: +outAt.toFixed(1), beats });
      assert(snatch !== null, 'must lose the plane before landing');
      const castOff = tuning.drowned.church.lookUpFor;
      assert(snatch > castOff + tuning.storm.lighthouseOutAt + 4 && snatch < time - 7,
        `the plane must be taken in the dark, with the last stretch still to go: ${snatch} of ${time}`);
      assert.equal(cast.plane.visible, false, 'plane must be gone before shore');
      assert(time >= castOff + 44 && time <= castOff + 62, `storm duration ${time}`);
      assert(mostLegTurn < Math.PI, `boat circles a waypoint: ${mostLegTurn}`);
      assert(sailingSpeed / sailingFrames > 4.5, `ordinary sailing speed: ${sailingSpeed / sailingFrames}`);
      assert.equal(gusts.reduce((sum, g) => sum + g.count, 0), 2, 'two wind traces across the release');
      assert(gusts[1].time - gusts[0].time >= 0.6, 'wind traces arrive separately');
      assert(outAt < 115, `the light must remain near enough to see: ${outAt}`);
      assert(lightGap > 15 && lightGap < 40, `must pass the lighthouse safely and closely: ${lightGap}`);
      break;
    }
    assert(frame < fps * 120 - 1, `failed to arrive: ${JSON.stringify({beat:chapter.beat,leg:chapter.leg,position:boat.position})}`);
  }
}
const { takeCues } = await import('../src/story/cues.ts');
const { CAT_HOLD, CAT_HOLD_YAW, STRAND } = await import('../src/world/drowned-way.ts');
// Old route payloads must resume after the rescue without replaying it or its sound.
for (const leg of [0, 3, 99]) {
  const cast=drownedCast(drownedWind(0)), b=cast.boat;
  b.beach(-4,-1203,Math.PI);b.afloat=true;
  const c=new DrownedChapter(cast);
  b.beach(-20,-1390,Math.PI);b.afloat=true;
  takeCues();
  c.restoreCheckpoint('sail',[leg]);
  assert.equal(c.beat,'still');
  assert.equal(c.checkpoint,'sail');
  assert.equal(c.cat.step,'aboard');
  assert.equal(cast.village.tub.visible,false);
  assert.equal(b.position.x,CAT_HOLD.x);
  assert.equal(b.position.z,CAT_HOLD.y);
  assert.equal(b.yaw,CAT_HOLD_YAW);
  assert.equal(b.steerFor,null);
  assert.deepEqual(takeCues(),[]);
  for(let i=0;i<60*90&&c.beat!=='becalmed';i++) {
    cast.wind.breeze.set(2.47,-0.80).multiplyScalar(c.breeze);
    cast.wind.calm=cast.wind.breeze.length()*tuning.wind.calm;
    c.update(1/60,i/60);b.update(1/60,i/60);
  }
  assert.equal(c.beat,'becalmed','restored boat reaches the stranded roof');
  assert(Math.hypot(b.position.x-STRAND.x,b.position.z-STRAND.y)<tuning.drowned.stuck.touch);
}
// A target directly astern, at full speed, used to be inside an unchanging turning circle.
for (const distance of [6, 20, 40]) {
  const cast = fixture(8), b = cast.boat;
  b.beach(-600, -1500, 0); b.afloat = true; b.speed = 12; b.canGround = false;
  b.steerFor = new THREE.Vector2(-600, -1500-distance);
  b.mooring = { x: -600, z: -1500-distance, yaw: Math.PI };
  let nearest = Infinity;
  for (let i=0;i<60*60;i++) { b.update(1/60,i/60); nearest=Math.min(nearest,Math.hypot(b.position.x+600,b.position.z+1500+distance)); if(nearest<2.6) break; }
  assert(nearest < 2.6, `missed target ${distance} astern: ${nearest}`);
}
assert(roundedWaypoint(8, -22, 0, 0, 0, -20, 5), 'passed within corridor');
assert(!roundedWaypoint(30, -22, 0, 0, 0, -20, 5), 'must not skip from another channel');
const starts = { toLines: [16.5,29.5,0.95], toBoats: [LINES_BERTH.x,LINES_BERTH.z,0.1], toMeadow: [BOATS_BERTH.x,BOATS_BERTH.z,Math.PI],
  toBirches: [FAR_SHORE.x,FAR_SHORE.z,0.2], toWood: [-14,-1614,Math.PI],
  toSleeping: [-34,-1908,0.2], toHome: [-219.5,-1928,-1.76] };
const crossings = [];
for (const [name, start] of Object.entries(starts)) for (const gust of [0,8]) {
  const cast=fixture(gust), b=cast.boat;
  b.beach(...start); b.launch();
  const c=new CrossingChapter(cast,{route:ROUTES[name],arrivalSpeed:name==='toMeadow'?tuning.sail.meadowArrivalSpeed:undefined,...(name==='toHome'?{moor:HOME_MOORING}:{})});
  let reached=false, lastLeg=0, turn=0, yaw=b.yaw, worst=0;
  for(let i=0;i<600*60;i++) {
    c.update(1/60); b.update(1/60,i/60);
    if(c.leg!==lastLeg) {worst=Math.max(worst,turn);turn=0;lastLeg=c.leg;}
    turn+=Math.abs(Math.atan2(Math.sin(b.yaw-yaw),Math.cos(b.yaw-yaw)));yaw=b.yaw;
    if(c.done){reached=true;crossings.push({name,gust,seconds:+(i/60).toFixed(1),maxTurnsOnLeg:+(Math.max(worst,turn)/(2*Math.PI)).toFixed(2)});break;}
  }
  assert(reached, `crossing stranded: ${name}, gust ${gust}, leg ${c.leg}, position ${b.position.toArray()}`);
  assert(Math.max(worst,turn)<Math.PI*2, `circle on ${name}`);
  if (name === 'toMeadow') assert(Math.abs(b.position.x - 10) < 12, `meadow landing missed hill path: gust=${gust}, position=${b.position.toArray()}`);
}
// Every cloud flash has one delayed report; leaving the storm does not schedule new flashes.
const { StormWeather } = await import('../src/fx/storm.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
const { applyPalette } = await import('../src/world/palette.ts');
let clock=0, wasFlash=false;
const flashes=[],thunder=[];
const weather=new StormWeather(() => thunder.push(clock));
for(let i=0;i<47*60;i++) {
  clock=i/60;
  const strength=clock<43?THREE.MathUtils.smoothstep(clock,0,20):0;
  applyPalette(1,1.8,strength,strength);
  weather.update(1/60,strength,Math.PI);
  const lit=atmo.uniforms.uLightning.value.w>0;
  if(lit&&!wasFlash) flashes.push(clock);
  wasFlash=lit;
}
assert.equal(flashes.length,3);assert.equal(thunder.length,3);
assert(flashes[0] >= 16, `early lightning: ${flashes[0]}`);
for(let i=0;i<3;i++)assert(thunder[i]-flashes[i]>1.3&&thunder[i]-flashes[i]<1.9);
assert.equal(atmo.uniforms.uLightning.value.w,0);
// Shelter dims the light while preserving strike and thunder timing.
const peaks = [];
for (const scale of [1, tuning.wood.lightningScale]) {
  let peak = 0, reports = 0;
  const sheltered = new StormWeather(() => reports++);
  for (let i = 0; i < 32 * 60; i++) {
    applyPalette(1, 2, 1, 1);
    sheltered.update(1 / 60, 1, Math.PI, scale);
    peak = Math.max(peak, atmo.uniforms.uLightning.value.w);
  }
  peaks.push({ peak, reports });
}
assert(Math.abs(peaks[1].peak / peaks[0].peak - tuning.wood.lightningScale) < 0.005);
assert.equal(peaks[1].reports, peaks[0].reports);
// No lightning in dry weather or daylight, even if the storm timer is already overdue.
for (const [dusk, rain] of [[1, 1], [2, 0]]) {
  let reports = 0;
  const guarded = new StormWeather(() => reports++);
  for (let i = 0; i < 30 * 60; i++) {
    applyPalette(1, dusk, rain, 1);
    guarded.update(1 / 60, 1, Math.PI);
    assert.equal(atmo.uniforms.uLightning.value.w, 0);
  }
  assert.equal(reports, 0);
}
// The sunset/moon seam used to rotate the key light by 71 degrees in one frame.
applyPalette(1, 1.4999, 1, 1);
const beforeMoon = atmo.uniforms.uSunDir.value.clone();
applyPalette(1, 1.5001, 1, 1);
assert(beforeMoon.angleTo(atmo.uniforms.uSunDir.value) < 0.001, 'sun-to-moon discontinuity');
let previousSun = beforeMoon;
for (let dusk = 1.5; dusk <= 2; dusk += 0.001) {
  applyPalette(1, dusk, 1, 1);
  assert(previousSun.angleTo(atmo.uniforms.uSunDir.value) < 0.006, 'abrupt key-light turn');
  previousSun = atmo.uniforms.uSunDir.value.clone();
}
// The lamp goes out as they pass it; its light cannot turn itself back on in the forest, nor be lit there at all.
const { LighthouseLight } = await import('../src/world/lighthouse.ts');
const lighthouse = new LighthouseLight(new THREE.Vector3(65,0,-1580));
lighthouse.update(0,0);
assert(atmo.uniforms.uHarbourLight.value.w > 0.9);
for(let i=0;i<Math.ceil((tuning.storm.lighthouseOutAt-tuning.storm.lighthouseFadeFor)*60)-1;i++) lighthouse.update(1/60,0.3);
assert(atmo.uniforms.uHarbourLight.value.w > 0.9, 'the light holds until it fails');
for(let i=0;i<Math.ceil(tuning.storm.lighthouseFadeFor*60)+1;i++) lighthouse.update(1/60,1);
assert.equal(atmo.uniforms.uHarbourLight.value.w,0);
assert.equal(lighthouse.beam.visible,false);
const inTheWood = new LighthouseLight(new THREE.Vector3(65,0,-1580));
inTheWood.update(1/60,1);
assert.equal(atmo.uniforms.uHarbourLight.value.w,0);
console.log(JSON.stringify({storm:report,crossings,weather:{flashes,thunder}}, null, 2));
console.log('Boat steering and storm pacing passed.');
