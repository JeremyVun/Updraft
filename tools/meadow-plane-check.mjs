// Real plane physics, meadow framing and camera, with repeatable extreme wind.
// node tools/meadow-plane-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({
  resolve(s,c,n) { return n(s.startsWith('.') && !/\.[a-z]+$/i.test(s) ? s+'.ts' : s,c); },
  load(u,c,n) { return u.endsWith('.ts') ? {format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code} : n(u,c); },
});
globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {Glider}=await import('../src/glider/glider.ts');
const {Traveller}=await import('../src/traveller/traveller.ts');
const {MeadowChapter,ROUTE}=await import('../src/story/meadow.ts');
const {CameraRig}=await import('../src/camera.ts');
const {heightAt}=await import('../src/world/island.ts');
const {tuning}=await import('../src/tuning.ts');
function fixture(portrait,leg=2) {
  const air={x:0,z:-2,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(0,-2),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),plane=new Glider(wind,[]),rig=new CameraRig();
  rig.resize(portrait?390:1600,portrait?844:900);
  const cast={child,plane,wind,cygnet:{flying:false,position:new THREE.Vector3()},flock:{rest(){},clear(){},active:false},
    life:{regions:{wave:new THREE.Vector4(),waiting:new THREE.Vector4()}},
    boat:{position:new THREE.Vector3(),beach(x,z){this.position.set(x,0,z);}},nearby:()=>false};
  const chapter=new MeadowChapter(cast);
  child.stop();child.place(ROUTE[leg].x,ROUTE[leg].y+25,Math.PI);
  chapter.beat='walk';chapter.leg=leg;chapter.play='watch';chapter.piano.restoreDone();chapter.crestDone=true;
  plane.launch(child.position.clone().add(new THREE.Vector3(0,3,0)),new THREE.Vector3(0,5,-10));
  plane.home.copy(child.position).z-=tuning.meadowPlane.lead;plane.homeRadius=tuning.meadowPlane.reach;
  plane.companion=child.position;chapter.frame();rig.cut(chapter.shot);
  return {air,wind,child,plane,rig,chapter};
}
const results=[];
for(const fps of [30,60,120]) for(const portrait of [false,true]) for(const dir of [[26,0],[-26,0],[0,-26],[0,26]]) {
  const f=fixture(portrait),{air,child,plane,rig,chapter}=f;
  Object.assign(air,{x:dir[0],z:dir[1],energy:1,lift:1});
  let gap=0,edge=0,childEdge=0,altitude=0;
  for(let i=0;i<fps*15;i++) {
    plane.update(1/fps,i/fps);chapter.frame();rig.update(1/fps,i/fps,chapter.shot,chapter.pace);
    gap=Math.max(gap,Math.hypot(plane.position.x-child.position.x,plane.position.z-child.position.z));
    altitude=Math.max(altitude,plane.position.y-child.position.y);
    for(const [name,p] of [['child',child.position.clone().add(new THREE.Vector3(0,1.2,0))],['plane',plane.position]]) {
      const screen=p.clone().project(rig.camera),e=Math.max(Math.abs(screen.x),Math.abs(screen.y));
      if(name==='child')childEdge=Math.max(childEdge,e);else edge=Math.max(edge,e);
      // Wide flight may briefly leave the viewport; it must never take the child with it.
      if(name==='child') assert(e<0.96&&screen.z<1,`${fps}fps ${portrait?'portrait':'wide'} ${dir} child clipped ${screen.toArray()} at ${i/fps}`);
    }
  }
  assert(gap>32&&gap<43,`flight should use the larger area without escaping: ${gap}`);
  assert(altitude>22&&altitude<29,`updraft should have more room above the child: ${altitude}`);
  Object.assign(air,{x:0,z:0,energy:0,lift:0});
  for(let i=0;i<fps*20;i++) {
    plane.update(1/fps,15+i/fps);chapter.frame();rig.update(1/fps,15+i/fps,chapter.shot,chapter.pace);
  }
  const returned=plane.position.clone().project(rig.camera);
  assert(Math.abs(returned.x)<0.96&&Math.abs(returned.y)<0.96&&returned.z<1,'paper did not return to view after the gust');
  results.push({fps,portrait,dir,gap:+gap.toFixed(2),edge:+edge.toFixed(2),childEdge:+childEdge.toFixed(2)});
}
// Previously runaway paper recovers by flying, without moving the child/camera into empty space.
for(const portrait of [false,true]) {
  const {air,child,plane,rig,chapter}=fixture(portrait);
  plane.position.x+=100;plane.position.y+=45;
  Object.assign(air,{x:26,z:0,energy:1,lift:1});
  let biggestStep=0;
  for(let i=0;i<60*35;i++) {
    const before=plane.position.clone();plane.update(1/60,i/60);chapter.frame();rig.update(1/60,i/60,chapter.shot,chapter.pace);
    biggestStep=Math.max(biggestStep,before.distanceTo(plane.position));
    const c=child.position.clone().add(new THREE.Vector3(0,1.2,0)).project(rig.camera);
    assert(Math.max(Math.abs(c.x),Math.abs(c.y))<0.96,'child lost during recovery');
  }
  assert(Math.hypot(plane.position.x-child.position.x,plane.position.z-child.position.z)<43,'runaway paper did not return');
  assert(biggestStep<1,'paper snapped during recovery');
  plane.depart(new THREE.Vector3(1,0,0));
  for(let i=0;i<60*10;i++)plane.update(1/60,35+i/60);
  assert(plane.position.distanceTo(child.position)>50,'authored departure must remain free');
}
// Changing the goal keeps the existing detour and watchdog history.
{
  const {child}=fixture(false);child.walkTo(child.position.x+30,child.position.z);
  child.goal.detour={x:child.position.x+4,z:child.position.z+3};child.goal.since=1;
  const detour=child.goal.detour;child.retargetWalk(child.position.x+30,child.position.z-5);
  assert.equal(child.goal.detour,detour);assert.equal(child.goal.since,1);
}
// Coupled walking keeps making progress with a moving target, including intermittent gusts.
for (const fps of [30,60]) {
  const {air,child,plane,rig,chapter}=fixture(true,1);
  const start=child.position.clone();let maxGap=0,occlusion=0;
  for(let i=0;i<fps*60;i++) {
    const time=i/fps;
    Object.assign(air,{x:2,z:time%12<2?-18:-2,energy:time%12<2?0.3:0,lift:0});
    chapter.update(1/fps,time);child.update(1/fps);plane.update(1/fps,time);
    rig.update(1/fps,time,chapter.shot,chapter.pace);
    maxGap=Math.max(maxGap,Math.hypot(plane.position.x-child.position.x,plane.position.z-child.position.z));
    if(i%fps===0) for(let j=1;j<20;j++) {
      const ray=rig.camera.position.clone().lerp(child.position.clone().add(new THREE.Vector3(0,1.2,0)),j/20);
      occlusion=Math.max(occlusion,heightAt(ray.x,ray.z)-ray.y);
    }
    assert(Math.hypot(plane.home.x-child.position.x,plane.home.z-child.position.z)<25,'destination escaped moving lead');
    for(const subject of [child.position.clone().add(new THREE.Vector3(0,1.2,0)),plane.position]) {
      const p=subject.clone().project(rig.camera);
      assert(Math.abs(p.x)<0.96&&Math.abs(p.y)<0.96,`walking subject clipped at ${time}: ${p.toArray()}`);
    }
  }
  assert(start.z-child.position.z>45,`walk stalled: advanced ${start.z-child.position.z}`);
  assert(maxGap<44,`moving companion gap ${maxGap}`);
  assert(occlusion<0.25,`terrain hides child by ${occlusion}`);
  results.push({walkingFps:fps,advanced:+(start.z-child.position.z).toFixed(1),maxGap:+maxGap.toFixed(1)});
}
for(const leg of [0,3,6]) {
  const {chapter,plane,child}=fixture(false,leg);
  chapter.crestDone=leg>=4;chapter.update(1/60,1);
  assert(Math.hypot(plane.home.x-child.position.x,plane.home.z-child.position.z)<=24.001,'piano/pond/boat lead unbounded');
  chapter.beat='toBoat';chapter.update(1/60,2);
  assert.equal(plane.companion,null,'scripted scene retained flight constraint');
  assert.equal(chapter.shot.subjects,undefined,'scripted scene retained playable framing');
}
console.log(JSON.stringify(results.filter(r=>r.walkingFps),null,2));
console.log(`Strong-gust maximum gap ${Math.max(...results.filter(r=>r.gap).map(r=>r.gap))}; worst projected edge ${Math.max(...results.filter(r=>r.edge).map(r=>r.edge))}.`);
console.log('PASS: wider flight and higher updrafts, 30/60/120fps, desktop/portrait child framing, return to view after gusts, continuous runaway recovery, free departure, pursuit detours.');
