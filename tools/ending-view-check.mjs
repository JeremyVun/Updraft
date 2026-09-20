// Ending order, rendered-camera gates, continuous framing, resume and completion without a GPU.
// Usage: node tools/ending-view-check.mjs
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
globalThis.window={innerWidth:1600,innerHeight:800,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {CameraRig}=await import('../src/camera.ts');
const {tuning}=await import('../src/tuning.ts');
const {Soundscape}=await import('../src/audio/audio.ts');


const { HomeChapter } = await import('../src/story/home.ts');
const { heightAt } = await import('../src/world/island.ts');
const { grassHeightAt } = await import('../src/world/grass.ts');
const { Drawing } = await import('../src/traveller/drawing.ts');
const { Cottage } = await import('../src/world/cottage.ts');
const { takeCues } = await import('../src/story/cues.ts');
function make(width,height,restore) {
 window.innerWidth=width;window.innerHeight=height;
 const air={x:0,z:0,energy:0,lift:0};
 const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
 const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),boat=new Boat(wind),plane=new Glider(wind,[]);
 cygnet.mount=child;
 const carry=new Carry(child,cygnet),rig=new CameraRig();rig.resize(width,height);
 const drawing=new Drawing(),cottage=new Cottage(wind);
 const cast={child,cygnet,flock,boat,plane,carry,wind,drawing,cottage,input:{present:false,muted:true},nearby:()=>false};
 const chapter=new HomeChapter(cast);
 if(restore)chapter.restoreCheckpoint(restore);else chapter.skipToDrawing();
 chapter.frame();
 if(!restore){chapter.beat='gone';chapter.frame();rig.cut(chapter.shot);chapter.beat='crest';chapter.frame();}
 else rig.cut(chapter.shot);
 takeCues();
 return {chapter,child,cygnet,flock,plane,carry,rig,drawing,cottage,air};
}
function step(g,dt,time,obscure=false) {
 const {chapter,child,cygnet,flock,plane,carry,rig,air}=g;
 chapter.update(dt,time);child.update(dt);carry.update(dt);plane.update(dt,time);flock.update(dt,time);
 cygnet.update(dt,time,child.position,air);carry.after();rig.update(dt,time,chapter.shot,chapter.pace);
 if(obscure)rig.camera.lookAt(rig.camera.position.clone().add(new THREE.Vector3(0,100,0)));
 chapter.afterCamera(rig.camera);
 return takeCues();
}
// The lower facade must clear the foreground vegetation, not just the bare terrain at the roof's centre.
function assertFacade(g) {
 for (const x of [-4,0,4]) {
  const point=new THREE.Vector3(x,.6,2.4).applyMatrix4(g.cottage.group.matrixWorld);
  const screen=point.clone().project(g.rig.camera);
  assert(Math.abs(screen.x)<.9 && Math.abs(screen.y)<.9 && Math.abs(screen.z)<1,'lower house left the frame');
  for(let i=1;i<100;i++) {
   const p=g.rig.camera.position.clone().lerp(point,i/100);
   const canopy=heightAt(p.x,p.z)+grassHeightAt(p.x,p.z)*1.35;
   assert(p.y>canopy,`foreground hides the lower house at x=${x}, ray=${i}%`);
  }
 }
}
// The centre can be visible while the sheet still hides the left wall or roof.
function assertPaperBesideHouse(g) {
 const {drawing,cottage,rig}=g;
 const paper=[-1.65,1.65].flatMap(x=>[-1.225,1.225].map(y=>drawing.point(x,y,new THREE.Vector3()).project(rig.camera)));
 const house=[-4.75,4.75].flatMap(x=>[0,5.9].flatMap(y=>[-2.95,2.95].map(z=>
  new THREE.Vector3(x,y,z).applyMatrix4(cottage.group.matrixWorld).project(rig.camera))));
 const gap=Math.min(...house.map(p=>p.x))-Math.max(...paper.map(p=>p.x));
 assert(gap>.025,`the whole house must sit beside the open paper, gap=${gap}`);
}
const cases=[];
for(const [w,h] of [[1600,900],[390,844],[320,900]])for(const fps of [30,60,120])cases.push({w,h,fps});
cases.push({w:2048,h:1045,fps:60},{w:900,h:900,fps:60},{w:1200,h:900,fps:60});
cases.push({w:1600,h:900,fps:60,resize:true},{w:390,h:844,fps:60,restore:'drawing'},{w:1600,h:900,fps:60,restore:'reunion'});
for(const {w,h,fps,resize,restore} of cases.filter(c=>!process.env.ONLY || `${c.w}x${c.h}`===process.env.ONLY)) {
 const g=make(w,h,restore),{chapter,drawing,rig,child}=g,dt=1/fps;
 let motifs=0,fullAt=null,recognised=null,houseAt=null,foldAt=null,changed=false,previousOpen=0,maxCameraStep=0;
 let checkedFacade=false;
 const beats=[],lastEye=rig.camera.position.clone();
 for(let frame=0;frame<fps*160;frame++) {
  const time=frame*dt;
  if(resize&&!changed&&chapter.beat==='unfold'&&drawing.open>.5){
   window.innerWidth=390;window.innerHeight=844;rig.resize(390,844);changed=true;
  }
  const cues=step(g,dt,time);
  maxCameraStep=Math.max(maxCameraStep,lastEye.distanceTo(rig.camera.position));lastEye.copy(rig.camera.position);
  if(beats.at(-1)!==chapter.beat)beats.push(chapter.beat);
  if(chapter.beat==='brow'&&chapter.houseInFrame&&houseAt===null)houseAt=time;
  if(chapter.beat==='unfold') {
   if(!checkedFacade){assertFacade(g);checkedFacade=true;}
   assert(drawing.open+1e-8>=previousOpen,'opening must not reverse');previousOpen=drawing.open;
   assert(!child.sitting,'the child stays standing after finding the house');
   if(!restore)assert(houseAt!==null&&time-houseAt>=1,'house must precede the unfold');
  }
  if(drawing.open>=.999&&fullAt===null){fullAt=time;
  }
  if(cues.includes('unfold')) {
   assertFacade(g);
   motifs++;recognised=time;
   assert(drawing.open>=.999&&drawing.drawn>.97,'motif requires the open, readable drawing');
   assert(chapter.houseInFrame&&chapter.paperInFrame,'motif requires both in the rendered frame');
   // Check the actual meshes too: an on-screen drawing hidden by the child's head is no reveal.
   for(const [label,point,objects] of [
    ['drawn house',drawing.point(.594,0,new THREE.Vector3()),child.objects],
    ['real house',g.cottage.position.clone().add(new THREE.Vector3(0,2.6,0)),[...child.objects,drawing.mesh]],
   ]) {
    objects.forEach(o=>o.updateMatrixWorld(true));
    const direction=point.clone().sub(rig.camera.position),distance=direction.length();
    const ray=new THREE.Raycaster(rig.camera.position,direction.normalize(),0,distance-.05);
    assert.equal(ray.intersectObjects(objects,true).length,0,`${label} must not be occluded by the child or paper`);
   }
   assert(time-fullAt<.2,`no pause between the completed unfold and recognition: ${w}x${h} ${fps}fps delay=${time-fullAt}`);
  }
  if(chapter.beat==='fold'&&foldAt===null){foldAt=time;assert(restore==='drawing'||time-recognised>=tuning.homeReveal.recogniseFor);}
  if(chapter.beat==='gaze'&&chapter.recognisedAt>=0&&time-fullAt>.2)assertPaperBesideHouse(g);
  if(chapter.finished)break;
 }
 assert(chapter.finished,'ending must reach credits without input');
 assert.equal(motifs,restore==='drawing'?0:1,'recognition plays once; resume never repeats it');
 if(!restore)assert.deepEqual(beats.slice(0,7),['crest','brow','settle','unfold','gaze','fold','release']);
 console.log(`ok ${w}x${h} ${fps}fps${resize?' resize':''}${restore?' resume '+restore:''}; recognition=${recognised?.toFixed(2)??'saved'}, camera step=${maxCameraStep.toFixed(3)}`);
}
// A late camera cannot let the motif play early. Once the view returns, it must progress.
{
 const g=make(1600,900),{chapter,drawing,rig}=g;
 chapter.skipToDrawing(1);chapter.frame();rig.cut(chapter.shot);chapter.houseInFrame=false;chapter.paperInFrame=false;
 for(let i=0;i<120;i++)assert(!step(g,1/60,i/60,true).includes('unfold'));
 assert.equal(chapter.beat,'gaze');assert.equal(chapter.recognisedAt,-1);
 let heard=0;
 for(let i=120;i<300;i++)heard+=step(g,1/60,i/60).filter(c=>c==='unfold').length;
 assert.equal(heard,1);assert.equal(drawing.drawn,1);
 console.log('ok camera occlusion delays recognition, then recovers');
}
// Recognition is scheduled from the reveal, never from the next musical beat.
{
 const notes=[];
 const sound={ctx:{currentTime:10},recognitionUntil:0,nextPulse:()=>100,chime:(...note)=>notes.push(note)};
 Soundscape.prototype.phrase.call(sound,'unfold');
 assert.equal(notes[0][3],10.02);
 const count=notes.length;
 Soundscape.prototype.phrase.call(sound,'release');assert.equal(notes.length,count,'early release must not layer another melody');
 sound.ctx.currentTime=sound.recognitionUntil+1;
 Soundscape.prototype.phrase.call(sound,'release');assert(notes.length>count);
 console.log('ok immediate motif scheduling and early-release music');
}
