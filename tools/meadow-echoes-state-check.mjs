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
const input={present:true,muted:false,gust:1,charge:0,updraftAt:new THREE.Vector3(),gustDir:new THREE.Vector2(1,0),ndc:new THREE.Vector2(),prevNdc:new THREE.Vector2()};
const ndcOf=v=>{const p=v.clone().project(camera);return new THREE.Vector2(p.x,p.y);};
const down=()=>{const g=garden,out=[];for(let i=0;i<g.phase.length;i++)if(g.phase[i]===1)out.push([i,g.pos[i*3],g.pos[i*3+1],g.pos[i*3+2],g.vel[i*3],g.vel[i*3+1],g.vel[i*3+2]]);return out;};
for(const fps of [30,60,120]) for(const stage of [0,1]) {
  camera.position.copy(garden.patches[stage]).add(new THREE.Vector3(-8,8,22));
  camera.lookAt(garden.patches[stage]);camera.updateMatrixWorld();
  for(const mode of ['idle','muted','absent','disabled','off-target','stroke',...(stage===1?['lift','far-lift']:[])]) {
    garden.reset(stage);garden.enabled=mode!=='disabled';garden.release();
    input.muted=mode==='muted';input.present=mode!=='absent';input.charge=['lift','far-lift'].includes(mode)?1:0;
    input.gust=mode==='lift'||mode==='far-lift'?0:5;
    const dt=1/fps;let woke=-1,steps=0;
    for(let i=0;i<fps*30;i++) {
      // A player following the invitation: a broad sweep across wherever the bed still sleeps, or across the seed heads.
      const phase=(i*dt)%1.2, at=ndcOf(stage===0?garden.invitation:garden.patches[1]);
      input.prevNdc.set(at.x-.35+phase*.6,at.y);
      input.ndc.set(at.x-.35+(phase+dt)*.6,at.y);
      if(mode==='idle'||phase>1)input.ndc.copy(input.prevNdc);
      if(mode==='off-target'){input.prevNdc.set(-.98,.98);input.ndc.set(-.95,.98);}
      input.updraftAt.copy(garden.patches[1]);
      if(mode==='far-lift')input.updraftAt.x+=40;
      garden.update(dt,i*dt,camera,input,true,wind);
      if(stage===0&&woke<0&&garden.flowers.some(f=>f.shown>.45))woke=i*dt;
      steps=i;
      if(garden.seeds.completed>stage)break;
    }
    const passes=['stroke','lift'].includes(mode)&&!(stage===1&&mode==='stroke');
    assert.equal(garden.seeds.completed,stage+(passes?1:0),`${fps}fps stage${stage} ${mode}`);
    if(stage===0&&mode==='stroke') {
      assert(woke>=0&&woke<1.5,`a first sweep visibly wakes flowers (${woke})`);
      if(process.env.VERBOSE)console.log({fps,woke,took:steps*dt});
      assert(steps*dt<20,`broad sweeps wake the whole bed in a few passes (${(steps*dt).toFixed(1)} s)`);
    }
    if(stage===1&&mode==='stroke') {
      assert.equal(garden.seeds.progress,0,'sweeps stir the seed heads but lift no down');
      assert(garden.seedHeads.some(h=>h.lean.length()>.01||h.leanSpeed.length()>.01),'a sweep over the seed heads stirs them');
    }
  }
  if(stage===1) {
    garden.reset(1);garden.enabled=true;garden.release();
    input.present=true;input.muted=false;input.gust=0;input.updraftAt.copy(garden.patches[1]);
    const dt=1/fps;let last=new Map(),worstA=0,sank=0,jump=0,lifted=0;
    for(let i=0;i<fps*24;i++) {
      input.charge=i*dt<1.2||i*dt>9&&i*dt<9.6?1:0;
      garden.update(dt,i*dt,camera,input,true,wind);
      for(const [k,x,y,z,vx,vy,vz] of down()) {
        const was=last.get(k);
        if(was) {
          worstA=Math.max(worstA,Math.hypot(vx-was[3],vy-was[4],vz-was[5])/dt);
          sank=Math.max(sank,was[1]-y);
          jump=Math.max(jump,Math.hypot(x-was[0],y-was[1],z-was[2])-Math.hypot(vx,vy,vz)*dt);
        }
        last.set(k,[x,y,z,vx,vy,vz]);
      }
      if(i*dt<8.9)lifted=garden.seeds.progress;
    }
    assert(lifted>.2&&lifted<.9,`a short updraft lifts part of the down (${lifted})`);
    assert(garden.seeds.progress>=lifted,'lifted down is kept');
    assert.equal(sank,0,'lifted down never sinks');
    assert(jump<1e-4,`down moves continuously (${jump})`);
    assert(worstA<12,`down eases between gusts rather than stepping (${worstA.toFixed(2)} m/s²)`);
    if(process.env.VERBOSE)console.log({fps,lifted,worstA,jump,flying:down().length});
  }
  garden.reset(stage);garden.release();
  if(stage===0)garden.seeds.stir(0,.04);else garden.seeds.lift(.02);
  for(let i=0;i<fps*120;i++)garden.seeds.update(1/fps);
  assert.equal(garden.seeds.completed,stage,'one accidental gesture cannot complete the play');
  if(stage===0)assert(garden.seeds.wake[0]>0,'woken flowers remember their opening');
  else assert.equal(garden.seeds.progress,.02,'lifted down stays lifted');
}
console.log('PASS: saved play, route ownership, input gating, broad strokes, updraft only for seeds, smooth unsinking down, idle and recovery at 30/60/120 Hz.');
