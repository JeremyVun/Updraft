// Headless storm camera trace: real chapter, cast and rig from her seated aboard at the nave to the forest beach.
// Usage: node tools/storm-camera-trace.mjs [portrait]. Prints per-second framing and the passage's smoothness.
import * as THREE from 'three';
const {stormCast}=await import('./lib/storm-cast.mjs');
const {CameraRig}=await import('../src/camera.ts');
const {LIGHTHOUSE}=await import('../src/world/drowned.ts');
const {LIGHTHOUSE_TOP_Y,LIGHTHOUSE_BASE_Y}=await import('../src/world/lighthouse.ts');
const {tuning}=await import('../src/tuning.ts');
const portrait=process.argv.includes('portrait'),fps=60,dt=1/fps;
const base=new THREE.Vector2(Math.cos(-Math.PI/10),Math.sin(-Math.PI/10)).multiplyScalar(tuning.wind.breeze);
const wind={breeze:base.clone(),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,{x:this.breeze.x,z:this.breeze.y,energy:0,lift:0});}};
const {cast,chapter:c}=stormCast(wind),{boat,child}=cast,rig=new CameraRig();
rig.resize(portrait?390:1600,portrait?844:900);c.afterCamera(rig.camera);c.update(0,0);rig.cut(c.shot);
const crown=LIGHTHOUSE.clone().setY(LIGHTHOUSE_TOP_Y),foot=LIGHTHOUSE.clone().setY(LIGHTHOUSE_BASE_Y);
const view=new THREE.Vector3(),last=new THREE.Vector3(),eyes=[],rows=[];
let t=0,reversals=0,rate=0,lastRate=0,peakSince=0,kink=0,kinkAt=0,worstChild=0;
const heading=()=>{rig.camera.getWorldDirection(view);return Math.atan2(view.x,view.z);};
let prevHead=heading();
for(let i=0;i<fps*80&&!c.done;i++){
  t+=dt;wind.breeze.copy(base).multiplyScalar(c.breeze);c.update(dt,t);boat.swell=c.storm;boat.update(dt,t);rig.update(dt,t,c.shot,c.pace);c.afterCamera(rig.camera);
  const h=heading();rate=Math.atan2(Math.sin(h-prevHead),Math.cos(h-prevHead))/dt;prevHead=h;
  if(Math.abs(rate)>peakSince)peakSince=Math.abs(rate);
  if(Math.sign(rate)!==Math.sign(lastRate)&&Math.abs(rate)>0.02){if(peakSince>0.1)reversals++;peakSince=0;}
  if(Math.abs(rate)>0.02)lastRate=rate;
  eyes.push(rig.camera.position.clone().sub(boat.position));
  if(eyes.length>2){const [a,b,e]=eyes.slice(-3);const k=e.clone().sub(b).sub(b.clone().sub(a)).length();if(c.stormTime>0&&k>kink){kink=k;kinkAt=c.stormTime;}}
  const p=v=>{const s=v.clone().project(rig.camera);return s.z<1?[+s.x.toFixed(2),+s.y.toFixed(2)]:'behind';};
  const ch=child.position.clone().setY(child.position.y+1.2).project(rig.camera);
  if(c.stormTime>0)worstChild=Math.max(worstChild,Math.abs(ch.x),Math.abs(ch.y));
  if(c.stormTime>0&&i%fps===0)rows.push(`${c.stormTime.toFixed(0).padStart(3)} ${c.beat.padEnd(7)} dist ${Math.hypot(eyes.at(-1).x,eyes.at(-1).z).toFixed(1).padStart(5)} eyeY ${rig.camera.position.y.toFixed(1).padStart(5)} pan ${(rate*180/Math.PI).toFixed(1).padStart(6)}°/s child ${JSON.stringify(p(child.position.clone().setY(child.position.y+1.2)))} crown ${JSON.stringify(p(crown))} foot ${JSON.stringify(p(foot))} fit ${rig.fitBack.toFixed(1)} tower ${Math.hypot(boat.position.x-LIGHTHOUSE.x,boat.position.z-LIGHTHOUSE.z).toFixed(0)}`);
}
console.log(rows.join('\n'));
console.log(JSON.stringify({portrait,panReversals:reversals,worstKink:+kink.toFixed(3),kinkAt:+kinkAt.toFixed(2),worstChild:+worstChild.toFixed(2),done:c.done,stormTime:+c.stormTime.toFixed(1)}));
