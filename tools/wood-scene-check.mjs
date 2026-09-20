// Focused forest render: actual chapter, camera, trees, terrain, rocks, embers and post chain.
// Uses SwiftShader without occupying the hardware-GPU capture slot. Full-game pointer QA remains wood-check.mjs.
// node tools/wood-scene-check.mjs [portrait] [plane]; add inspect for a daylight geometry diagnostic.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const portrait=process.argv.includes('portrait'), planeMode=process.argv.includes('plane'), prefix=`/tmp/updraft-wood-scene-${portrait?'portrait':'desktop'}${planeMode?'-plane':''}`;
const width=portrait?390:1000,height=portrait?844:650;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
process.once('SIGTERM',async()=>{await browser.close();process.exit(143)});
const page=await browser.newPage({viewport:{width,height}}),errors=[],shots=[];
page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text())}else if(m.text().startsWith('scene:'))console.log(m.text())});page.on('pageerror',e=>errors.push(e.message));
const source=`
import * as THREE from '/node_modules/three/build/three.module.js';
import {Cygnet} from '/src/creatures/cygnet.ts';
import {Traveller} from '/src/traveller/traveller.ts';
import {Carry} from '/src/companion/carry.ts';
import {WoodChapter} from '/src/story/wood.ts';
import {DarkWood} from '/src/world/wood.ts';
import {Terrain} from '/src/world/terrain.ts';
import {CameraRig} from '/src/camera.ts';
import {Post} from '/src/post/post.ts';
import {Embers} from '/src/fx/embers.ts';
import {EmberInvitation} from '/src/fx/ember-invitation.ts';
import {applyPalette} from '/src/world/palette.ts';
import {heightAt} from '/src/world/island.ts';
import {StormWeather} from '/src/fx/storm.ts';
import {Foley} from '/src/audio/foley.ts';
import {Glider} from '/src/glider/glider.ts';
const wind={breeze:new THREE.Vector2(2,-1),calm:3,addSplat(){},sample(x,z,out){return Object.assign(out,{x:2,z:-1,energy:0,lift:0})}};
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(${width},${height});document.body.appendChild(renderer.domElement);document.body.style.margin='0';
const scene=new THREE.Scene();scene.background=new THREE.Color('#020409');
const rig=new CameraRig();rig.resize(${width},${height});const camera=rig.camera;
const child=new Traveller(wind),bird=new Cygnet(),carry=new Carry(child,bird),embers=new Embers(wind),wood=new DarkWood(wind),terrain=new Terrain(wind.breeze,false),plane=new Glider(wind,[]);
// Read the material-owned uniform set: a running Vite server can version dependency URLs after HMR.
const atmo={uniforms:plane.group.children[0].material.uniforms};
if(wood.uniforms.uEmberLight!==atmo.uniforms.uEmberLight)throw Error('Fixture imported mismatched atmosphere modules');
bird.mount=child;child.place(-18,-1786,Math.PI);bird.rideIn('satchel');
const chapter=new WoodChapter({child,cygnet:bird,carry,embers,plane,wind,boat:{beach(){},grounded:true}});
const invitation=new EmberInvitation(),idleInput={present:false,muted:false,ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};scene.add(invitation.batch.mesh);
child.stop();child.place(-18,-1786,Math.PI);chapter.beat='walk';chapter.leg=2;chapter.chainAt=108;chapter.ahead=null;chapter.glow.copy(child.position);chapter.layHearth();
child.objects.forEach(o=>scene.add(o));bird.objects.forEach(o=>scene.add(o));wood.objects.forEach(o=>scene.add(o));scene.add(embers.mesh,terrain.mesh,plane.group,plane.trails.mesh);
const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;atmo.uniforms.uCloudTex.value=white;
const originZ=${planeMode?-1890:-1840};
const data=new Float32Array(128*128*4);for(let z=0;z<128;z++)for(let x=0;x<128;x++)data[(z*128+x)*4]=heightAt(-70+(x+.5),originZ+(z+.5));
const ht=new THREE.DataTexture(data,128,128,THREE.RGBAFormat,THREE.FloatType);ht.needsUpdate=true;
atmo.uniforms.uHeightTex.value=ht;atmo.uniforms.uDomain.value.set(-70,originZ,1/128,1/128);
atmo.uniforms.uVeil.value.set(55,0.9);atmo.uniforms.uSeason.value=.84;
const post=new Post(renderer,scene,camera,0),light=new THREE.Vector3();
const earned=embers.lay(-21,-1783);embers.blow(earned,.8);embers.takeCaught();
let time=0,ready=false;const audioEvents=[];const weather=new StormWeather((strength,pan,close)=>audioEvents.push({kind:'thunder',time,strength,close}));
function state(){return {beat:chapter.beat,t:chapter.t,child:child.position.toArray(),bird:bird.seating.shown.p.toArray(),reveal:chapter.hearth?.reveal,carry:carry.playing,coaxing:chapter.coaxing,comingOut:chapter.comingOut,gathering:chapter.gathering,frame:camera.position.toArray(),plane:plane.position.toArray(),work:chapter.planeWork,landed:plane.landed,light:atmo.uniforms.uEmberLight.value.toArray()}}
function step(n,story=true){for(let i=0;i<n;i++){
 time+=1/60;if(story)chapter.update(1/60,time);else {chapter.frame();if(${planeMode}){chapter.now=time;chapter.poseCaughtPlane();}}child.update(1/60);plane.update(1/60,time);carry.update(1/60);bird.update(1/60,time,child.position,wind.sample(0,0,{}));carry.after();
 for(const h of bird.heard)if(h.kind==='scramble')audioEvents.push({kind:'scramble',time});bird.heard.length=0;
 applyPalette(1,2,1,1);atmo.uniforms.uTime.value=time;weather.update(1/60,1,child.yaw,.28,1,chapter.stormStrike);
 rig.update(1/60,time,chapter.shot,chapter.pace);chapter.afterCamera(camera);wood.update(1/60,time,camera,1,chapter.shot.subjects);
 invitation.update(1/60,camera,chapter.windInvitation,idleInput);
 embers.update(1/60,child.position,1);const power=embers.illumination(light);atmo.uniforms.uEmberLight.value.set(light.x,light.y,light.z,Math.min(2.6,power*.5));
 }return state()}
// Only this forest patch is needed; retain Terrain's real geometry template, height lookup and shading.
const nodes=terrain.mesh.geometry.attributes.aNode;for(let z=0;z<4;z++)for(let x=0;x<4;x++)nodes.setXYZ(z*4+x,-70+x*32,originZ+z*32,32);nodes.needsUpdate=true;terrain.mesh.geometry.instanceCount=16;
function render(){post.render(time)}
if(${planeMode}){embers.clearCoals();chapter.hearth=null;chapter.bolted=true;child.stop();child.place(-37,-1842,Math.PI);chapter.toPlane();}
chapter.frame();rig.cut(chapter.shot);step(120,false);chapter.now=time;
console.log('scene: compiling forest materials');await renderer.compileAsync(scene,camera);console.log('scene: rendering');render();
window.stage={step,state,render,chapter,child,bird,plane,embers,renderer,scene,camera,audioEvents,
 idleSway(){let lo=Infinity,hi=-Infinity,gap=0;for(let i=0;i<540;i++){step(1);lo=Math.min(lo,plane.group.rotation.z);hi=Math.max(hi,plane.group.rotation.z);
   const sway=scene.getObjectByName('wood-plane-tree').material.uniforms.uSnagSway.value;
   gap=Math.max(gap,plane.position.clone().sub(chapter.snagAt).distanceTo(sway));}
   return {range:hi-lo,gap,work:chapter.planeWork,beat:chapter.beat,invitation:invitation.batch.mesh.visible};},
 inspect(){applyPalette(1,.6,0,0);post.render(time)},
 sweep(offset=0){const p=plane.position.clone().project(camera),input={present:true,muted:false,ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};
   input.ndc.set(p.x-.25/camera.aspect,p.y+offset);
   for(let i=1;i<=60;i++){input.prevNdc.copy(input.ndc);input.ndc.set(p.x+(-.25+.5*i/60)/camera.aspect,p.y+offset);
     chapter.brushDry(embers.brush(camera,input,chapter.windInvitation,1/60));step(1);}render();return state();},
 async soundCheck(){const results=[];for(const name of ['flutter','scramble']){const ctx=new OfflineAudioContext(1,44100*2,44100),bus=ctx.createGain(),wet=ctx.createGain();bus.connect(ctx.destination);const f=new Foley();f.setOutput({ctx,bus,reverb:wet});if(name==='scramble')f.scramble(0);else f.flutter(6,1,0);const buffer=await ctx.startRendering(),samples=buffer.getChannelData(0);let energy=0,peak=0;for(const v of samples){energy+=v*v;peak=Math.max(peak,Math.abs(v))}results.push({name,rms:Math.sqrt(energy/samples.length),peak})}return results}
};window.ready=true;
`;
await page.route('**/__wood-scene',r=>r.fulfill({contentType:'text/html',body:`<html><body><script type="module">${source}</script></body></html>`}));
await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
try{
 await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}__wood-scene`,{waitUntil:'commit',timeout:60000});await page.waitForFunction(()=>window.ready,null,{timeout:180000});
 async function shot(name,condition){
  if(condition)await page.evaluate(condition=>{const test=new Function('s','return '+condition);for(let i=0;i<3600;i++){stage.step(1);if(test(stage.state())){stage.render();return}}throw Error('Missing scene: '+condition+' '+JSON.stringify(stage.state()))},condition);
  const state=await page.evaluate(()=>stage.state());shots.push({name,...state});await page.screenshot({path:prefix+'-'+name+'.png',timeout:60000});console.log(name,JSON.stringify(state));
 }
 if(planeMode){
   await shot('caught');await page.evaluate(()=>stage.embers.blow(stage.chapter.ahead,1));
   await shot('waiting',`s.beat==='snag'&&s.t>7`);assert.equal(shots.at(-1).work,0);
   const idle=await page.evaluate(()=>stage.idleSway());assert(idle.range>.02&&idle.range<.15,'a gentle visible idle rock');
   assert(idle.gap<.001,'caught paper follows its branch');assert.equal(idle.work,0);assert.equal(idle.beat,'snag');assert(idle.invitation);
   console.log('Idle sway and invitation',JSON.stringify(idle));await page.evaluate(()=>stage.render());await shot('idle-rock');
   if(process.argv.includes('inspect')){await page.evaluate(()=>stage.inspect());await shot('inspection');}
   const miss=await page.evaluate(()=>stage.sweep(.6));assert.equal(miss.work,0,'a distant gesture cannot release the snag');
   await page.evaluate(()=>stage.sweep());await shot('tugged');assert(shots.at(-1).work>0&&shots.at(-1).work<.8);
   await page.evaluate(()=>{for(let i=0;i<10&&stage.state().beat==='snag';i++)stage.sweep();});
   await shot('falling',`s.beat==='fall'&&s.t>.6`);
   await shot('ground',`s.beat==='pickup'&&s.t>.2`);
   await shot('retrieved',`s.beat==='dry'`);
   assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(prefix+'-report.json',JSON.stringify({shots,errors},null,2));
   console.log('Tree snag: idle/missed strokes hold, direct sweeps loosen, paper falls and is retrieved.');
 }else{
 await shot('before');await page.evaluate(()=>stage.chapter.bolt());
 await shot('compose',`s.beat==='compose'&&s.t>1.8`);
 await shot('flash',`s.beat==='fright'&&s.t>0.18`);
 await shot('recoil',`s.beat==='fright'&&s.t>1.1`);
 await shot('jump',`s.beat==='bolt'&&s.t>0.6`);
 await shot('landing',`s.beat==='bolt'&&s.t>1.4`);
 await shot('run',`s.beat==='bolt'&&s.t>3.5`);
 await shot('entrance',`s.beat==='lost'&&s.reveal>0.95`);
 await page.evaluate(()=>{stage.embers.blow(stage.chapter.hearth,1)});
 await shot('coax',`s.coaxing&&!s.comingOut`);
 await shot('emerging',`s.comingOut&&!s.gathering&&s.bird[0]<-10`);
 await shot('pickup',`s.carry==='gather:step-up'`);
 await shot('held',`s.beat==='walk'`);
 const sounds=await page.evaluate(()=>stage.soundCheck()),audioEvents=await page.evaluate(()=>stage.audioEvents);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(shots[0].reveal,0);
 assert(shots.find(s=>s.name==='entrance').reveal>.95);
 assert(shots.find(s=>s.name==='pickup').child[0]<-12);
 assert.equal(audioEvents.filter(e=>e.kind==='scramble').length,1);
 assert(sounds[1].rms>sounds[0].rms*3,'feather scramble must be distinct from the quiet handling flutter');
 fs.writeFileSync(prefix+'-report.json',JSON.stringify({shots,sounds,audioEvents,errors},null,2));
 console.log('Forest staging, shelter reveal, outside pickup and audible scramble passed.');
 }
}catch(error){fs.writeFileSync(prefix+'-report.json',JSON.stringify({shots,errors,failure:String(error)},null,2));throw error}finally{await browser.close()}
