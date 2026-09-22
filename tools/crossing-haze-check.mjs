// The first farewell stays clear; approach haze follows shore distance and the farewell's release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s,c,next) { return next(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c); },
  load(u,c,next) { return u.endsWith('.ts')?{format:'module',shortCircuit:true,
    source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:next(u,c); },
});
globalThis.location={search:'?shot'};
const { CrossingChapter }=await import('../src/story/crossing.ts');
const { tuning }=await import('../src/tuning.ts');
const k=tuning.world;
const boat={position:new THREE.Vector3(0,0,350),sailSide:1};
const cast={boat,plane:{}};
const opts={route:[new THREE.Vector2(0,0)],haze:.35,lookBack:new THREE.Vector3(0,8,380),farewell:30,
  arrivalHaze:{strength:k.linesCrossingHaze,from:k.linesHazeFrom,to:k.linesHazeTo}};
const chapter=new CrossingChapter(cast,opts);
for(const distance of [350,260,220,180,0]) {
  boat.position.z=distance;
  for(const time of [0,20,30]) {
    chapter.time=time;
    assert.equal(chapter.haze,.35,'even a fast boat must preserve the farewell');
  }
}
chapter.time=60;boat.position.z=350;
assert.equal(chapter.haze,.35,'elapsed time alone cannot fog a slow boat still offshore');
boat.position.z=180;
assert.equal(chapter.haze,k.linesCrossingHaze,'the approach reaches the shared distance haze');
for(const fps of [10,30,60,120]) {
  let last=.35;
  for(let i=0;i<=60*fps;i++) {
    chapter.time=i/fps;boat.position.z=350-5*i/fps;
    assert(chapter.haze>=last && chapter.haze-last<.012,'the combined camera and distance transition is continuous');
    last=chapter.haze;
  }
}
const ordinary=new CrossingChapter(cast,{route:opts.route,haze:.9});
assert.equal(ordinary.haze,.9,'other crossings retain their authored haze');
console.log('Crossing haze: clear farewell, slow/fast approaches, continuous 10–120 Hz blend and other crossings passed.');
