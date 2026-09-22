// Real village, boat and camera: landmark framing, sail interaction, storm handoff and frame-rate parity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import {transformSync} from 'rolldown/utils';
import * as THREE from 'three';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);},
  load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,
    source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c);}});
globalThis.location={search:'?shot'};
const {Boat}=await import('../src/traveller/boat.ts');
const {DrownedChapter}=await import('../src/story/drowned.ts');
const {CameraRig}=await import('../src/camera.ts');
const {BIRCHES_BERTH}=await import('../src/world/birches.ts');
const {SPIRE,LIGHTHOUSE,DrownedVillage}=await import('../src/world/drowned.ts');
const {LIGHTHOUSE_TOP_Y}=await import('../src/world/lighthouse.ts');
const {tuning}=await import('../src/tuning.ts');
const {sceneryLift}=await import('../src/camera-obstacles.ts');
const results=[];
for(const [fps,portrait,gust] of [[30,false,0],[60,true,0],[30,true,8]]) {
  let push=gust;
  const base=new THREE.Vector2(Math.cos(-Math.PI/10),Math.sin(-Math.PI/10)).multiplyScalar(tuning.wind.breeze);
  const wind={breeze:base.clone(),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,
    {x:this.breeze.x+push,z:this.breeze.y-push,energy:push?.8:0,lift:0});}};
  const boat=new Boat(wind);boat.beach(BIRCHES_BERTH.x,BIRCHES_BERTH.z,Math.PI);boat.launch();
  const child={position:new THREE.Vector3(),ride(p){this.position.copy(p);},handPosition(out){return out.copy(this.position);},reach(){}};
  const plane={held:true,position:new THREE.Vector3(),hold(){},launch(p){this.position.copy(p);this.held=false;},depart(){}};
  const cygnet={mind:{perform(){},startle(){}},eye(out){return out.copy(child.position);}};
  const village=new DrownedVillage(wind);
  const c=new DrownedChapter({boat,child,plane,cygnet,wind,village}),rig=new CameraRig();
  rig.resize(portrait?390:1600,portrait?844:900);c.update(0,0);rig.cut(c.shot);
  let lighthouseAt=null;let churchAt=null;let worstAt=null;let worstChild=0,churchEdge=0,churchFrames=0,sailEdge=0,lighthouseEdge=0,minArc=Infinity,maxArc=-Infinity;
  let obscured=0,streak=0,worstStreak=0,blockedAt,maxTurn=0,turnAt,worstHull=0;
  let maxElevation=0,elevationAt;
  const lastView=new THREE.Vector3(),view=new THREE.Vector3();rig.camera.getWorldDirection(lastView);
  const ray=new THREE.Ray(),hit=new THREE.Vector3();
  for(let i=1;i<fps*210;i++){
    const dt=1/fps,t=i*dt;
    push=gust||(c.beat==='still'&&c.t>8?8:0);
    wind.breeze.copy(base).multiplyScalar(c.breeze);wind.calm=wind.breeze.length()*tuning.wind.calm;
    c.update(dt,t);boat.update(dt,t);rig.update(dt,t,c.shot,c.pace);
    rig.camera.getWorldDirection(view);
    const turn=lastView.angleTo(view);
    if(turn>maxTurn){maxTurn=turn;turnAt={t,beat:c.beat,eye:rig.camera.position.toArray(),portrait,fps};}
    lastView.copy(view);
    ray.origin.copy(rig.camera.position);ray.direction.subVectors(c.shot.subjects.primary,ray.origin);
    const reach=ray.direction.length();ray.direction.normalize();
    const blocked=village.cameraObstacles.some(box=>ray.intersectBox(box,hit)&&hit.distanceTo(ray.origin)<reach-1);
    if(blocked){
      obscured++;streak+=dt;
      if(streak>worstStreak){
        worstStreak=streak;
        blockedAt={t,eye:rig.camera.position.toArray(),subject:c.shot.subjects.primary.toArray(),
          boxes:village.cameraObstacles.filter(box=>ray.intersectBox(box,hit)&&hit.distanceTo(ray.origin)<reach-1)
            .map(b=>[b.min.toArray(),b.max.toArray()])};
      }
    }else streak=0;
    const edge=point=>{const p=point.clone().project(rig.camera);assert(p.z<1);return Math.max(Math.abs(p.x),Math.abs(p.y));};
    const childEdge=edge(child.position.clone().add(new THREE.Vector3(0,1.2,0)));
    const elevation=Math.atan2(rig.camera.position.y-c.shot.subjects.primary.y,
      Math.hypot(rig.camera.position.x-c.shot.subjects.primary.x,rig.camera.position.z-c.shot.subjects.primary.z));
    if(elevation>maxElevation){maxElevation=elevation;elevationAt={t,beat:c.beat,eye:rig.camera.position.toArray()};}
    worstHull=Math.max(worstHull,...c.shot.subjects.points.map(edge));
    if(childEdge>worstChild){worstChild=childEdge;worstAt={t,beat:c.beat,boat:boat.position.toArray(),eye:rig.camera.position.toArray()};}
    if(c.beat==='drift'){
      const bearing=c.villageBearing-boat.yaw-Math.PI;
      const arc=Math.atan2(Math.sin(bearing),Math.cos(bearing));minArc=Math.min(minArc,arc);maxArc=Math.max(maxArc,arc);
      if(c.shot.attention?.strength>.9&&c.t>2){const e=edge(SPIRE);if(e>churchEdge){churchEdge=e;churchAt={t,beatTime:c.t,stirred:c.stirred,eye:rig.camera.position.toArray(),boat:boat.position.toArray(),screen:SPIRE.clone().project(rig.camera).toArray()};}churchFrames++;}
    }
    if(c.beat==='still'&&c.t>4)sailEdge=Math.max(sailEdge,edge(boat.sailPoint(new THREE.Vector3())));
    if(c.beat==='gather'&&c.stormTime>6&&c.stormTime<19.5){const e=edge(LIGHTHOUSE.clone().setY(LIGHTHOUSE_TOP_Y));if(e>lighthouseEdge){lighthouseEdge=e;lighthouseAt={time:c.stormTime,portrait,eye:rig.camera.position.toArray()};}}
    if(c.done)break;
  }
  assert(c.done,'village and storm complete');assert(worstChild<1,`child: ${worstChild}, ${JSON.stringify(worstAt)}, portrait ${portrait}`);
  assert(worstHull<.95,`hull needs breathing room below the child: ${worstHull}, portrait ${portrait}`);
  assert(churchFrames>fps*2&&churchEdge<1,`spire visible during its approach reveal: ${churchEdge}, ${churchFrames} frames, ${fps}Hz gust=${gust}, ${JSON.stringify(churchAt)}`);
  assert(sailEdge<.85,`sail gesture target: ${sailEdge}`);assert(lighthouseEdge<1,`lighthouse: ${lighthouseEdge}, ${JSON.stringify(lighthouseAt)}`);
  assert(Math.max(Math.abs(minArc),Math.abs(maxArc))<.2,'village camera travels behind the boat through the channel');
  assert(worstStreak<.35,`scenery hides child for ${worstStreak}s: ${JSON.stringify(blockedAt)}`);
  assert(maxTurn<.1,`obstruction correction must stay continuous: ${maxTurn}, ${JSON.stringify(turnAt)}`);
  assert(maxElevation<.4,`sailing camera looks steeply down at the child: ${maxElevation*180/Math.PI} degrees, ${JSON.stringify(elevationAt)}`);
  const before=performance.now();
  for(let i=0;i<10000;i++)sceneryLift(rig.camera.position,c.shot.subjects.primary,village.cameraObstacles,tuning.cinematography.obstacleAhead);
  const obstacleMs=(performance.now()-before)/10000;
  results.push({fps,portrait,gust,maxTurn,maxElevation,obstacles:village.cameraObstacles.length,obstacleMs,worstChild,worstHull,churchEdge,sailEdge,lighthouseEdge,arc:maxArc-minArc,obscured,worstStreak});
}
fs.writeFileSync('/tmp/updraft-drowned-camera.json',JSON.stringify(results,null,2));
console.log('Village camera: astern travel, approaching spire, sail and lighthouse coverage, child visibility and passage completion pass at 30/60fps, calm/gust and both aspects.');
