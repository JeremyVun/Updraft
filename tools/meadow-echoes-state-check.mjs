import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {meadowEchoes:garden}=await import('../src/world/meadow-echoes.ts');
const {atmo}=await import('../src/world/atmosphere.ts');
for(const mesh of garden.group.children)for(const [name,uniform] of Object.entries(atmo.uniforms)) {
  if(name==='uTime')continue;
  assert.equal(mesh.material.uniforms[name],uniform,`${mesh.uuid}: ${name} must follow the world's live colour and atmosphere`);
}
const {MeadowChapter}=await import('../src/story/meadow.ts');
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {Carry}=await import('../src/companion/carry.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {decodeProgress,CHECKPOINTS}=await import('../src/story/progress.ts');
const air={x:0,z:0,energy:0,lift:0};
const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air)},addSplat(){}};
const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),plane=new Glider(wind,[]),boat=new Boat(wind);
cygnet.mount=child;
const cast={child,cygnet,flock,plane,boat,wind,carry:new Carry(child,cygnet),swanFeather:new Feather(wind),nearby:()=>false,
  life:{at:()=>1,bloom(){},regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}}};
const chapter=new MeadowChapter(cast);
for(const [point,completed,done] of [['piano',0,false],['echoes-1',1,false],['echoes-2',2,false],['pond',2,true]]) {
  const data=[2,300,0,0,0];
  const save={version:1,chapter:'meadow',point,data,child:[-25,20,-770,0,0],boat:[0,0,0,0,0],
    bird:[0,0,0,0,1,0,1],plane:[1,0],seat:'satchel',life:[[0,0,0,0],[0,0,0,0],[0,0,0,0]]};
  assert.equal(CHECKPOINTS.meadow[point],5);assert(decodeProgress(save));
  chapter.restoreCheckpoint(point,data);
  assert.equal(garden.seeds.completed,completed);assert.equal(chapter.song.beat==='done',done);
  assert.equal(chapter.pianoMix,0);
  if(!done)assert(chapter.song.goal.equals(garden.stands[completed]));
  assert.equal(chapter.checkpoint,point);
}
chapter.song.restore(1);
const stand=garden.stands[1];
child.stop(); child.place(stand.x,stand.z,Math.PI);
cygnet.mayFly=true;
chapter.song.hold(1/60,1,cast);
assert.equal(cygnet.mayFly,false,'seed updrafts must not lift the companion after restoring a ground checkpoint');
const camera=new THREE.PerspectiveCamera(45,16/9,.1,1000);
const input={present:true,muted:false,gust:1,charge:0,updraftAt:new THREE.Vector3(),ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};
for(const fps of [30,60,120]) for(const stage of [0,1]) {
  camera.position.copy(garden.patches[stage]).add(new THREE.Vector3(-8,8,22));
  camera.lookAt(garden.patches[stage]);camera.updateMatrixWorld();
  for(const mode of ['idle','muted','absent','disabled','off-target','stroke',...(stage===1?['lift']:[])]) {
    garden.reset(stage);garden.enabled=mode!=='disabled';garden.release(0);
    input.muted=mode==='muted';input.present=mode!=='absent';input.charge=mode==='lift'?1:0;
    const dt=1/fps;
    for(let i=0;i<fps*22;i++) {
      const target=stage===0?garden.sectors[Math.floor(i/fps/2)%3]:garden.seed;
      const p=target.clone().project(camera);
      input.prevNdc.set(p.x,p.y);
      input.ndc.copy(input.prevNdc).add(new THREE.Vector2(stage===0?dt*.4:0,stage===1?dt*.2:0));
      if(mode==='idle')input.ndc.copy(input.prevNdc);
      if(mode==='off-target'){input.prevNdc.set(-.98,.98);input.ndc.set(-.95,.98);}
      input.updraftAt.copy(garden.patches[stage]);
      garden.update(dt,i*dt,camera,input,null,true,wind);
      if(garden.seeds.completed>stage)break;
    }
    assert.equal(garden.seeds.completed,stage+(['stroke','lift'].includes(mode)?1:0),`${fps}fps stage${stage} ${mode}`);
  }
  garden.reset(stage);garden.release(0);
  if(stage===0)garden.seeds.sweep(0,.04);else garden.seeds.lift(.02);
  for(let i=0;i<fps*120;i++)garden.seeds.update(1/fps);
  assert.equal(garden.seeds.completed,stage,'one accidental gesture cannot complete the play');
  if(stage===0)assert(garden.seeds.blooms[0]>0,'played flowers remember their opening');
  else assert.equal(garden.seeds.progress,0,'unattended seeds settle back onto their stems');
}
console.log('PASS: saved play, route ownership, input gating, broad strokes, lift, idle and recovery at 30/60/120 Hz.');
