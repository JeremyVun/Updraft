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

const { HomeChapter, HOME_JETTY }=await import('../src/story/home.ts');
const home=Object.create(HomeChapter.prototype),child={position:new THREE.Vector3(HOME_JETTY.x,.7,HOME_JETTY.endZ)};
home.cast={child};
assert.equal(home.haze,tuning.homeApproach.dockHaze,'docking inherits the softened approach mist');
assert.equal(home.openSea,1,'far hills remain dissolved at docking');
assert.equal(home.hazeFalloff,tuning.homeApproach.falloff,'docking preserves the broad haze gradient');
let last=home.haze;
for(let walked=0;walked<30;walked+=.05){
  child.position.z=HOME_JETTY.endZ-walked;
  assert(home.haze<=last&&last-home.haze<.003,'the walk clears the mist continuously');
  last=home.haze;
}
assert.equal(home.haze,tuning.homeApproach.clearHaze,'the shore has clear afternoon air');
assert.equal(home.openSea,0,'the ending has no offshore concealment');
assert.equal(home.hazeFalloff,1,'the ending restores the standard distance gradient');
child.position.z=HOME_JETTY.shoreZ-80;
assert.equal(home.haze,tuning.homeApproach.clearHaze,'resumed summit and later ending keep their light');
const homeward=new CrossingChapter(cast,{route:opts.route,homeward:true,haze:tuning.homeApproach.haze});
boat.position.z=150;
assert.equal(homeward.haze,tuning.homeApproach.haze,'offshore hill stays concealed');
boat.position.z=60;
assert(homeward.haze>tuning.homeApproach.dockHaze&&homeward.haze<tuning.homeApproach.haze,'mist thins before docking');
boat.position.z=20;
assert.equal(homeward.haze,tuning.homeApproach.dockHaze,'nearby shore is clear before docking');
assert.equal(homeward.openSea,1,'home approach uses the sky-colour distance veil');
assert.equal(ordinary.openSea,0,'other ordinary passages keep their own fog colour');
assert.equal(ordinary.hazeFalloff,1,'other crossings retain their distance gradient');
assert.equal(homeward.hazeFalloff,tuning.homeApproach.falloff,'the homeward veil spreads over a longer depth');
console.log('Home haze: continuous docking, distance-based clearing on the planks, and clear summit passed.');
