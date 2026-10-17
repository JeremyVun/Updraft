// Real plane physics, meadow framing and camera, with repeatable extreme wind.
// node tools/meadow-plane-check.mjs
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {Glider}=await import('../src/glider/glider.ts');
const {Traveller}=await import('../src/traveller/traveller.ts');
const {MeadowChapter,ROUTE,FAR_SHORE}=await import('../src/story/meadow.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {CameraRig}=await import('../src/camera.ts');
const {heightAt}=await import('../src/world/island.ts');
const {tuning}=await import('../src/tuning.ts');
const {POND,POND_LEVEL,pondOut}=await import('../src/world/heightfield.ts');
function fixture(portrait,leg=2) {
  const air={x:0,z:-2,energy:0,lift:0};
  const wind={breeze:new THREE.Vector2(0,-2),sample(_x,_z,out){return Object.assign(out,air);},addSplat(){}};
  const child=new Traveller(wind),plane=new Glider(wind,[]),rig=new CameraRig();
  rig.resize(portrait?390:1600,portrait?844:900);
  const cast={swanFeather:new Feather(wind),child,plane,wind,cygnet:{flying:false,position:new THREE.Vector3()},flock:{rest(){},clear(){},active:false},
    life:{at:()=>1,bloom(){},regions:{wave:new THREE.Vector4(),waiting:new THREE.Vector4()}},
    boat:{position:new THREE.Vector3(),beach(x,z){this.position.set(x,0,z);}},nearby:()=>false};
  const chapter=new MeadowChapter(cast);
  child.stop();child.place(ROUTE[leg].x,ROUTE[leg].y+25,Math.PI);
  chapter.beat='walk';chapter.leg=leg;chapter.play='watch';chapter.piano.restoreDone();chapter.song.restore(2);chapter.crestDone=true;
  plane.launch(child.position.clone().add(new THREE.Vector3(0,3,0)),new THREE.Vector3(0,5,-10));
  plane.home.copy(child.position).z-=tuning.meadowPlane.lead;plane.homeRadius=tuning.meadowPlane.reach;
  plane.companion=child.position;chapter.frame();rig.cut(chapter.shot);
  return {air,wind,child,plane,rig,chapter};
}
const results=[];
// Reproduced during the full journey: paper resting on the elevated pond was treated as dry land,
// so the child kept fetching an unreachable point. Calm water must recover it without another gesture.
for(const fps of [30,60,120]){
 const {air,child,plane,chapter}=fixture(false,5);
 child.stop();child.place(24.9125,-875.0955,Math.PI);
 plane.launch(new THREE.Vector3(POND.x,POND_LEVEL+.45,POND.z),new THREE.Vector3());
 Object.assign(air,{x:0,z:0,energy:0,lift:0});
 let dry=false,maxStep=0;
 for(let i=0;i<fps*45;i++){
  const before=plane.position.clone();chapter.update(1/fps,i/fps);child.update(1/fps);plane.update(1/fps,i/fps);
  maxStep=Math.max(maxStep,before.distanceTo(plane.position));
  const wet=pondOut(plane.position.x,plane.position.z)<1&&heightAt(plane.position.x,plane.position.z)<POND_LEVEL-.15;
  assert(!wet||!plane.landed,'pond water must never become a fetchable landing');
  if(!wet&&i>fps){dry=true;break;}
 }
 assert(dry,'paper must return to a reachable bank in calm air');
 assert(maxStep<1,'pond recovery must fly continuously');
}
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
}
// Boarding on the north beach must remain visible from the water, not behind the inland bank.
for(const portrait of [false,true]){
 const {child,rig,chapter}=fixture(portrait,6),boat=chapter.cast.boat;
 boat.position.copy(FAR_SHORE);child.place(FAR_SHORE.x,FAR_SHORE.z+14,Math.PI);
 chapter.frame();rig.cut(chapter.shot);chapter.beat='toBoat';
 for(let i=0;i<600;i++){
  child.place(FAR_SHORE.x,FAR_SHORE.z+14*Math.max(0,1-i/480),Math.PI);
  chapter.frame();rig.update(1/60,i/60,chapter.shot,chapter.pace,true);
  const subject=child.position.clone().add(new THREE.Vector3(0,1.2,0)),p=subject.clone().project(rig.camera);
  assert(p.z<1&&Math.abs(p.x)<.96&&Math.abs(p.y)<.96,'boarding child left frame');
  if(i>240)for(let j=1;j<32;j++){
   const ray=rig.camera.position.clone().lerp(subject,j/32);
   assert(heightAt(ray.x,ray.z)-ray.y<.25,'far-shore bank hides boarding child');
  }
 }
}
// At the piano the paper flies nose first into the bough's fork and sticks there, its wings caught against both pipes,
// then comes back out to her hand; on the way it passes through neither the piano's case nor the bough.
const lodged={};
{
  const {piano}=await import('../src/world/piano.ts');
  const {windBough,BOUGH_PIPES,boughRadius}=await import('../src/world/wind-bough.ts');
  const {PAPER_TRIANGLES}=await import('../src/glider/glider.ts');
  const {PianoStop}=await import('../src/story/piano.ts');
  // The pipes' outer surfaces, as the bough builds them (its wall bulges by up to 5% round each ring).
  const pipes=BOUGH_PIPES.map(({points,radius})=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p).add(windBough.foot)));
    return Array.from({length:193},(_,i)=>({p:curve.getPointAt(i/192),r:boughRadius(radius,i/192)*1.05}));
  });
  const line=new THREE.Line3(),near=new THREE.Vector3();
  const clearOf=(p,pipe)=>{let best=Infinity;for(let i=0;i<pipe.length-1;i++){line.set(pipe[i].p,pipe[i+1].p);const u=line.closestPointToPointParameter(p,true);
    best=Math.min(best,p.distanceTo(line.at(u,near))-(pipe[i].r+(pipe[i+1].r-pipe[i].r)*u));}return best;};
  const paper=[];
  for(const [a,b,c] of PAPER_TRIANGLES)for(let i=0;i<=8;i++)for(let j=0;j<=8-i;j++){const u=i/8,v=j/8,w=1-u-v;
    paper.push(new THREE.Vector3(...a).multiplyScalar(w).addScaledVector(new THREE.Vector3(...b),u).addScaledVector(new THREE.Vector3(...c),v).multiplyScalar(tuning.paperCarry.scale));}
  const placed=(at,rotation)=>{const q=new THREE.Quaternion().setFromEuler(rotation);return paper.map(p=>p.clone().applyQuaternion(q).add(at));};
  const at=new THREE.Vector3(),turn=new THREE.Euler();
  windBough.planeRest(at,turn);
  const points=placed(at,turn),gaps=pipes.map(pipe=>Math.min(...points.map(p=>clearOf(p,pipe))));
  assert(gaps.every(g=>g>0),`the paper is inside a pipe: ${gaps}`);
  // It rests a few centimetres off the wood, room for its tremble, which at the lens's distance is a pixel or two.
  assert(Math.min(...gaps)<0.06&&Math.max(...gaps)<0.15,`the paper is not caught in the fork between the pipes: ${gaps}`);
  lodged.gaps=gaps.map(g=>+g.toFixed(3));
  // The case, the propped lid and the keys, in the piano's own units.
  const inverse=piano.group.matrix.clone().invert(),local=new THREE.Vector3();
  const inCase=p=>{local.copy(p).applyMatrix4(inverse);return Math.abs(local.x)<0.95&&local.y>-0.1&&local.y<2.05&&local.z>-0.6&&local.z<0.85;};
  // In the strongest wind, so the paper trembles its most in the fork: it must stay clear of both pipes all the while.
  const gale={sample:(x,z,out)=>Object.assign(out,{x:20,z:0,energy:1,lift:0})};
  const fly=(from,to,hand,stay=0)=>{
    const stop=new PianoStop(),pinned={at:new THREE.Vector3(),rotation:new THREE.Euler()};
    const plane={position:from.clone(),group:{quaternion:new THREE.Quaternion()},visible:true,keptSmall:false,
      pin(a,r){pinned.at.copy(a);pinned.rotation.copy(r);this.position.copy(a);},hold(){}};
    const child={yaw:Math.PI,handPosition:out=>out.copy(hand)};
    const cast={plane,child,wind:gale};
    stop.now=0;stop.glidePlane(to,cast);
    let closest=Infinity,hit=0,lowest=Infinity,jump=0,trembled=0,left=Infinity;
    const last=new THREE.Vector3(),before=new THREE.Vector3(),tip=new THREE.Vector3(),q=new THREE.Quaternion();
    for(let t=0,f=0;t<30;t+=1/60,f++){
      stop.now=t;stop.tendPlane(cast,1/60);
      // The wing tip, which moves most, never changes speed at once: no pop on arrival, while it trembles, or as it leaves.
      tip.set(1.15,0.16,-0.95).multiplyScalar(tuning.paperCarry.scale).applyQuaternion(q.setFromEuler(pinned.rotation)).add(pinned.at);
      if(f>1&&pinned.at.distanceTo(at)<1)jump=Math.max(jump,tip.clone().sub(last).sub(last).add(before).length());before.copy(last);last.copy(tip);
      const pts=placed(pinned.at,pinned.rotation);
      for(const p of pts){
        if(inCase(p))hit++;
        lowest=Math.min(lowest,p.y-heightAt(p.x,p.z));
        if(p.distanceTo(windBough.foot)<6)closest=Math.min(closest,...pipes.map(pipe=>clearOf(p,pipe)));
      }
      if(!stop.planeGlide){
        if(to==='hand')break;
        if(left===Infinity)left=t+stay;
        trembled=Math.max(trembled,pinned.at.distanceTo(at));
        if(t>left)break;
      }
    }
    return {closest,hit,lowest,jump,trembled};
  };
  // From wherever she is on her way up when she notices the piano, and back to her hand at the stool and round its end.
  const ground=(x,z,up=1)=>new THREE.Vector3(x,heightAt(x,z)+up,z);
  const flights=[];
  for(const bearing of [-0.9,-0.5,-0.2,0,0.3,0.6])
    flights.push(['fork',ground(piano.stand.x+Math.sin(bearing)*24,piano.stand.z+Math.cos(bearing)*24),null]);
  flights.push(['fork',ground(piano.stand.x,piano.stand.z),null,8]);
  for(const hand of [ground(piano.seat.x,piano.seat.z,1.1),ground(piano.stand.x,piano.stand.z),ground(piano.wayRound[0].x,piano.wayRound[0].z)])
    flights.push(['hand',at.clone(),hand]);
  for(const [to,from,hand,stay] of flights){
    const r=fly(from,to,hand??new THREE.Vector3(),stay);
    assert(r.jump<0.01,`the paper's wing tip jerks by ${r.jump} m in a frame near the fork`);
    if(stay)assert(r.trembled>0.003&&r.trembled<0.08,`a gale shakes the caught paper a little: ${r.trembled}`);
    lodged.jump=Math.max(lodged.jump??0,+r.jump.toFixed(4));if(stay)lodged.trembled=+r.trembled.toFixed(3);
    assert.equal(r.hit,0,`the paper flies through the piano on its way ${to==='fork'?'in':'out'} from ${from.toArray().map(v=>v.toFixed(1))}`);
    assert(r.closest>0,`the paper passes through the bough on its way ${to==='fork'?'in':'out'}: ${r.closest}`);
    assert(r.lowest>0.05,`the paper skims through the ground: ${r.lowest}`);
    lodged.closest=Math.min(lodged.closest??Infinity,+r.closest.toFixed(3));
  }
}
console.log(`Lodged in the fork ${JSON.stringify(lodged.gaps)} m from the two pipes; nearest to a pipe in or out of it, trembling in a gale, ${lodged.closest} m; largest wing-tip jerk near it ${lodged.jump} m a frame²; a gale moves it ${lodged.trembled} m.`);
console.log(JSON.stringify(results.filter(r=>r.walkingFps),null,2));
console.log(`Strong-gust maximum gap ${Math.max(...results.filter(r=>r.gap).map(r=>r.gap))}; worst projected edge ${Math.max(...results.filter(r=>r.edge).map(r=>r.edge))}.`);
console.log('PASS: paper caught in the bough\'s fork clear of case and pipes, wider flight and higher updrafts, 30/60/120fps, desktop/portrait child framing, return to view after gusts, continuous runaway recovery, free departure, pursuit detours.');
