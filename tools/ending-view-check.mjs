// Ending order, rendered-camera gates, continuous framing, resume and completion without a GPU.
// Usage: node tools/ending-view-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

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
// Retained cues mark narrative events in this geometry fixture; audio-check covers their disabled mix.
tuning.audio.homeEndingSounds=true;
const {Soundscape}=await import('../src/audio/audio.ts');

const { HomeChapter } = await import('../src/story/home.ts');
const { heightAt } = await import('../src/world/island.ts');
const { grassHeightAt } = await import('../src/world/grass.ts');
const { Drawing } = await import('../src/traveller/drawing.ts');
const { Cottage } = await import('../src/world/cottage.ts');
const { takeCues } = await import('../src/story/cues.ts');
const { applyPalette, sunDirection } = await import('../src/world/palette.ts');
const { atmo } = await import('../src/world/atmosphere.ts');
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
  assert(Math.abs(screen.x)<.9 && Math.abs(screen.y)<.9 && Math.abs(screen.z)<1,`lower house left the frame: ${screen.toArray()}`);
  for(let i=1;i<100;i++) {
   const p=g.rig.camera.position.clone().lerp(point,i/100);
   const canopy=heightAt(p.x,p.z)+grassHeightAt(p.x,p.z)*1.35;
   assert(p.y>canopy,`foreground hides the lower house at x=${x}, ray=${i}%`);
  }
 }
}
// The centre can be visible while the sheet still hides the left wall or roof.
function assertPaperClearOfHouse(g) {
 const {drawing,cottage,rig}=g;
 const paper=[-1.65,1.65].flatMap(x=>[-1.225,1.225].map(y=>drawing.point(x,y,new THREE.Vector3()).project(rig.camera)));
 const house=[-4.75,4.75].flatMap(x=>[0,5.9].flatMap(y=>[-2.95,2.95].map(z=>
  new THREE.Vector3(x,y,z).applyMatrix4(cottage.group.matrixWorld).project(rig.camera))));
 const gapX=Math.min(...house.map(p=>p.x))-Math.max(...paper.map(p=>p.x));
 const gapY=Math.min(...house.map(p=>p.y))-Math.max(...paper.map(p=>p.y));
 assert(Math.max(gapX,gapY)>.025,`the whole house must clear the open paper, gap=${gapX},${gapY}`);
}
function assertDrawnSunClear(g) {
 const {drawing,child,rig}=g;
 child.objects.forEach(o=>o.updateMatrixWorld(true));
 // Sample the disc's centre and edges: one visible point is not enough to read a sun.
 for(const [dx,dy] of [[0,0],[-.22,0],[.22,0],[0,-.22],[0,.22]]) {
  const point=drawing.point(-.99+dx,.735+dy,new THREE.Vector3());
  const direction=point.sub(rig.camera.position),distance=direction.length();
  const ray=new THREE.Raycaster(rig.camera.position,direction.normalize(),0,distance-.05);
  assert.equal(ray.intersectObjects(child.objects,true).length,0,'the drawn sun must stay clear of the child throughout recognition');
 }
}
function assertPaperHeld(g) {
 const {drawing,child}=g;
 for(const [hand,x] of [[0,-.71],[1,.71]]) {
  const edge=drawing.point(x,-1.2,new THREE.Vector3());
  const gap=child.mitten(hand,new THREE.Vector3()).distanceTo(edge);
  assert(gap<.3,`the open sheet must stay at the mittens, gap=${gap.toFixed(3)}`);
 }
}
const cases=[];
for(const [w,h] of [[1600,900],[390,844],[320,900]])for(const fps of [30,60,120])cases.push({w,h,fps});
cases.push({w:2048,h:1045,fps:60},{w:900,h:900,fps:60},{w:1200,h:900,fps:60});
cases.push({w:1600,h:900,fps:60,resize:true},{w:390,h:844,fps:60,restore:'drawing'},{w:1600,h:900,fps:60,restore:'reunion'});
for(const {w,h,fps,resize,restore} of cases.filter(c=>!process.env.ONLY || `${c.w}x${c.h}`===process.env.ONLY)) {
 const g=make(w,h,restore),{chapter,drawing,rig,child}=g,dt=1/fps;
 let motifs=0,fullAt=null,recognised=null,houseAt=null,foldAt=null,changed=false,previousOpen=0,maxCameraStep=0;
 let checkedFacade=false, previousDusk=chapter.dusk, descent=false, insideDusk=null, silenceAt=null;
 let renderedDusk=chapter.dusk;
 const beats=[],lastEye=rig.camera.position.clone();
 let farewellEye=null;
 const lastRotation=rig.camera.quaternion.clone();
 for(let frame=0;frame<fps*160;frame++) {
  const time=frame*dt;
  if(resize&&!changed&&chapter.beat==='unfold'&&drawing.open>.5){
   window.innerWidth=390;window.innerHeight=844;rig.resize(390,844);changed=true;
  }
  const cues=step(g,dt,time);
  if(chapter.silence&&silenceAt===null)silenceAt=chapter.homeEndingTime;
  // main.ts eases the chapter's light once more before applying the world palette.
  renderedDusk+=(chapter.dusk-renderedDusk)*(1-Math.exp(-dt*.5));
  if(['home','inside','credits'].includes(chapter.beat)) {
   farewellEye??=lastEye.clone();
   assert(rig.camera.position.distanceTo(farewellEye)<1e-7,
    'the goodbye camera must remain at the crest through the walk, entry and credits');
   assert(lastRotation.angleTo(rig.camera.quaternion)<.035,
    'the house and credits pans must join without an angular jump');
  }
  lastRotation.copy(rig.camera.quaternion);
  assert(chapter.dusk>=previousDusk-1e-8,'the ending must never turn its clock backwards');
  previousDusk=chapter.dusk;
  const released=chapter.beat==='release'&&!g.plane.held&&chapter.wentAt>0;
  if(!released&&!['home','inside','credits'].includes(chapter.beat))assert.equal(chapter.dusk,tuning.homeLight.daylight,
   'daylight must hold through the cygnet farewell and drawing, regardless of waiting');
  if(cues.includes('home')) {
   applyPalette(1,renderedDusk,0,0,1);
   assert(chapter.dusk>1.9&&atmo.uniforms.uNight.value>.7,
    `the door must open into darkness with the fireflies lit: rendered dusk=${renderedDusk}`);
  }
  if(chapter.beat==='release' && chapter.wentAt>0) {
   const shown=child.position.clone().add(new THREE.Vector3(0,1.2,0)).project(rig.camera);
   assert(Math.abs(shown.x)<.94&&Math.abs(shown.y)<.94,`released paper must not pull child offscreen: ${shown.toArray()}, t=${chapter.t}, since=${chapter.now-chapter.wentAt}, fit=${rig.fitBack}, pair=${!!chapter.shot.subjects}`);
  }
  if(chapter.beat==='home'){
   descent=true;assert(!child.sitting,'sunset belongs to the walk, not a seated wait');
   const shown=child.position.clone().add(new THREE.Vector3(0,1.5,0)).project(rig.camera);
   assert(Math.abs(shown.x)<.95&&Math.abs(shown.y)<.95&&Math.abs(shown.z)<1,
    `the camera must keep the child during the descent: t=${chapter.t} ${shown.toArray()} eye=${rig.camera.position.toArray()} child=${child.position.toArray()}`);
   const roof=g.cottage.position.clone().add(new THREE.Vector3(0,6,0)).project(rig.camera);
   assert(Math.abs(roof.x)<.95&&Math.abs(roof.y)<.95,'the whole cottage stays in view during the descent');
   const head=child.position.clone().add(new THREE.Vector3(0,2.4,0));
   for(let sample=1;sample<20;sample++){
    const ray=rig.camera.position.clone().lerp(head,sample/20);
    assert(ray.y>heightAt(ray.x,ray.z)+grassHeightAt(ray.x,ray.z)*1.35,
     `the descent must keep the child's head above the foreground: t=${chapter.t} ray=${sample}`);
   }
  }
  if(chapter.beat==='inside'&&insideDusk===null)insideDusk=chapter.dusk;
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
   // Both drawn landmarks must read above the shoulder, alongside the real cottage.
   for(const [label,point,objects] of [
    ['drawn house',drawing.point(.594,0,new THREE.Vector3()),child.objects],
    ['drawn sun',drawing.point(-.99,.735,new THREE.Vector3()),child.objects],
    ['real house',g.cottage.position.clone().add(new THREE.Vector3(0,2.6,0)),[...child.objects,drawing.mesh]],
   ]) {
    objects.forEach(o=>o.updateMatrixWorld(true));
    const direction=point.clone().sub(rig.camera.position),distance=direction.length();
    const ray=new THREE.Raycaster(rig.camera.position,direction.normalize(),0,distance-.05);
    assert.equal(ray.intersectObjects(objects,true).length,0,`${label} must not be occluded by the child or paper`);
   }
   // Rotating the screen during opening gives the shoulder camera a short moment to settle.
   assert(time-fullAt<(resize ? .5 : .2),`recognition must follow the completed unfold promptly: ${w}x${h} ${fps}fps delay=${time-fullAt}`);
  }
  if(chapter.beat==='fold'&&foldAt===null){foldAt=time;assert(restore==='drawing'||time-recognised>=tuning.homeReveal.recogniseFor);}
  if(chapter.beat==='gaze'&&chapter.recognisedAt>=0&&time-fullAt>.2) {
   assertPaperClearOfHouse(g);
   assertDrawnSunClear(g);
   if(time-chapter.recognisedAt>1)assertPaperHeld(g);
   const front=new THREE.Vector3(0,0,1).applyQuaternion(g.cottage.group.quaternion);
   const toCamera=rig.camera.position.clone().sub(g.cottage.position).setY(0).normalize();
   assert(front.dot(toCamera)>.98,'the cottage front should echo the drawing with only a slight angle');
   assert(chapter.houseInFrame,'the house remains in view throughout the reading hold');
   assert(chapter.paperInFrame,'the whole sheet remains in frame throughout the reading hold');
   if(time-chapter.recognisedAt>2){
    const sun=sunDirection(tuning.homeLight.sunAzimuth,tuning.homeLight.sunElevation)
     .multiplyScalar(2000).add(rig.camera.position).project(rig.camera);
    const house=g.cottage.position.clone().project(rig.camera);
    assert(Math.abs(sun.x)<.92&&Math.abs(sun.y)<.92&&sun.z<1,`the real sun must be visible with the drawing: ${w}x${h} t=${time} sun=${sun.toArray()}`);
    assert(sun.x<house.x&&sun.y>house.y,'the sun belongs above and left of the cottage, as drawn');
   }
  }
  if(chapter.finished)break;
 }
 assert(chapter.finished,'ending must reach credits without input');
 assert(Math.abs(chapter.homeEndingTime-116.5)<=1/fps+.001,'credits share the ending score clock');
 assert(Math.abs(chapter.homeEndingTime-silenceAt-2)<=1/fps+.001,'credits leave two seconds after the music cut');
 assert(maxCameraStep<1,'the reveal-to-descent camera must move continuously');
 assert(descent&&insideDusk>1.94,'night must be established before the child enters');
 applyPalette(1,chapter.dusk,0,0,1);
 assert(atmo.uniforms.uStarlight.value>.99,'the credits retain full night and reflected stars');
 assert.equal(motifs,restore==='drawing'?0:1,'recognition plays once; resume never repeats it');
 if(!restore)assert.deepEqual(beats.slice(0,7),['crest','brow','settle','unfold','gaze','fold','release']);
 console.log(`ok ${w}x${h} ${fps}fps${resize?' resize':''}${restore?' resume '+restore:''}; recognition=${recognised?.toFixed(2)??'saved'}, camera step=${maxCameraStep.toFixed(3)}`);
}
// Helping the bird has no timeout and must not consume the daylight needed for the picture.
{
 const g=make(1600,900);
 g.cygnet.visible=true;g.cygnet.rideIn('satchel');g.chapter.skipToSummit();
 for(let i=0;i<600;i++)step(g,.1,i*.1);
 assert.equal(g.chapter.beat,'flying','the bird must still be waiting for the player');
 assert.equal(g.chapter.homeEndingTime,undefined,'the ending score waits for a successful updraft');
 assert.equal(g.chapter.dusk,tuning.homeLight.daylight);
 const complete=make(1600,900,'complete');
 assert(complete.chapter.finished&&complete.chapter.dusk===2,'completed saves stay at night');
 console.log('ok unhurried daylight farewell and completed-save night');
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
