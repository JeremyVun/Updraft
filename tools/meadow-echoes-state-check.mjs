import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location={search:'?shot'};
globalThis.window={innerWidth:1600,innerHeight:900,matchMedia:()=>({matches:false})};
globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}})})};
const {meadowEchoes:garden}=await import('../src/world/meadow-echoes.ts');
const {MeadowChapter}=await import('../src/story/meadow.ts');
const {MeadowSong}=await import('../src/story/meadow-song.ts');
const {Traveller}=await import('../src/traveller/traveller.ts');
const {Cygnet}=await import('../src/creatures/cygnet.ts');
const {SwanFlock}=await import('../src/creatures/flock.ts');
const {Glider}=await import('../src/glider/glider.ts');
const {Boat}=await import('../src/traveller/boat.ts');
const {Feather}=await import('../src/fx/feather.ts');
const {decodeProgress,CHECKPOINTS}=await import('../src/story/progress.ts');
const air={x:0,z:0,energy:0,lift:0};
const wind={breeze:new THREE.Vector2(),sample(_x,_z,out){return Object.assign(out,air)},addSplat(){}};
const child=new Traveller(wind),cygnet=new Cygnet(),flock=new SwanFlock(),plane=new Glider(wind,[]),boat=new Boat(wind);
cygnet.mount=child;
const cast={child,cygnet,flock,plane,boat,wind,swanFeather:new Feather(wind),nearby:()=>false,
  life:{at:()=>1,regions:{island:new THREE.Vector4(),wave:new THREE.Vector4(),waiting:new THREE.Vector4()}}};
const chapter=new MeadowChapter(cast);
for(const [point,completed,done] of [['piano',0,false],['echoes-1',1,false],['echoes-2',2,false],['pond',2,true]]) {
  const data=[2,300,0,0,0];
  const save={version:1,chapter:'meadow',point,data,child:[-25,20,-770,0,0],boat:[0,0,0,0,0],
    bird:[0,0,0,0,1,0,1],plane:[1,0],seat:'satchel',life:[[0,0,0,0],[0,0,0,0],[0,0,0,0]]};
  assert.equal(CHECKPOINTS.meadow[point],5);
  assert(decodeProgress(save),`${point} must decode`);
  chapter.restoreCheckpoint(point,data);
  assert.equal(garden.seeds.completed,completed);
  assert.equal(chapter.song.beat==='done',done);
  assert.equal(chapter.pianoMix,0,'reload never retains a stale audio fade');
  if(!done) assert(chapter.song.goal.equals(garden.flowers[completed].stand),'remaining flower owns route');
  assert.equal(chapter.checkpoint,point);
}

const camera=new THREE.PerspectiveCamera(45,16/9,.1,1000);
camera.position.copy(garden.flowers[0].mouth).add(new THREE.Vector3(0,10,30));
camera.lookAt(garden.flowers[1].mouth);camera.updateMatrixWorld();
const input={present:true,muted:false,gust:1,charge:0,updraftAt:new THREE.Vector3(),ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};
for(const fps of [30,60,120]) {
  const dt=1/fps;
  for(const mode of ['muted','absent','disabled','wrong','lift','stroke']) {
    garden.reset();garden.enabled=mode!=='disabled';garden.release(0);
    input.muted=mode==='muted';input.present=mode!=='absent';input.charge=mode==='lift'?1:0;
    let previous=garden.seed.clone(),worstStep=0;
    for(let i=0;i<fps*14;i++) {
      const a=garden.seed.clone().project(camera),b=garden.receiver.clone().project(camera);
      const direction=new THREE.Vector2(b.x-a.x,b.y-a.y).normalize().multiplyScalar(dt*.2*(mode==='wrong'?-1:1));
      input.prevNdc.set(a.x,a.y);input.ndc.copy(input.prevNdc).add(direction);
      input.updraftAt.copy(garden.seed);
      garden.update(dt,i*dt,camera,input,null,true);
      worstStep=Math.max(worstStep,garden.seed.distanceTo(previous));previous.copy(garden.seed);
      if(garden.seeds.completed && i*dt-garden.receivedAt>1.5)break;
    }
    assert.equal(garden.seeds.completed,['lift','stroke'].includes(mode)?1:0,`${fps}fps ${mode}`);
    assert(worstStep<1,`${fps}fps ${mode}: seed jumped ${worstStep}`);
    if(garden.seeds.completed) assert(garden.seed.distanceTo(garden.source)<.15,'plume visibly settles at receiver');
  }
  for (const index of [0,1]) {
    const song=new MeadowSong();song.restore(index,false);
    const f=garden.flowers[index],hand=new THREE.Vector3();
    child.stop();child.place(f.stand.x,f.stand.z,Math.PI);
    input.present=false;
    for(let i=0;i<fps;i++)child.update(dt);
    let contactFor=0;
    for(let i=0;i<fps*5;i++) {
      song.hold(dt,i*dt,cast);child.update(dt);
      garden.update(dt,i*dt,camera,input,null,true);
      if(f.bow>.99 && child.mitten(1,hand).distanceTo(f.contact)<.08)contactFor+=dt;
    }
    assert(contactFor>.6,`${fps}fps flower ${index}: mitten never rests on the petal (${contactFor}s)`);
    assert(garden.seeds.active,'the touch releases the plume');
    assert.equal(garden.seeds.completed,index,'the touch cannot solve the wind exchange');
  }
}
console.log('PASS: saved transfers, route ownership, fade reset, input gating, strokes/lift, continuous receipt and sustained mitten–petal contact at 30/60/120 Hz.');
