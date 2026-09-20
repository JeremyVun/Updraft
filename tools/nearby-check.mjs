// Usage: node tools/nearby-check.mjs. Check lookup parity and actual creature-position liveness.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from 'three';
globalThis.location = {search:'?shot'};
const { nearestCreature } = await import('../src/creatures/nearby.ts');
const { Rabbits } = await import('../src/creatures/rabbits.ts');
const { Songbirds } = await import('../src/creatures/songbirds.ts');
const populations = [[{x:1,y:1,z:0}], [{x:-1,y:9,z:0}], [], []], out=new Vector3(9,9,9);
assert(nearestCreature(populations,0,0,2,out)); assert.deepEqual(out.toArray(),[1,1.35,0],'first population wins ties');
assert(!nearestCreature(populations,0,0,1,out),'radius boundary stays exclusive');
assert.deepEqual(out.toArray(),[1,1.35,0],'a miss preserves the output');
populations[3].push({x:0,y:2,z:0});
assert(nearestCreature(populations,0,0,1,out));assert.deepEqual(out.toArray(),[0,2.35,0],'later spawns remain visible');
function previous(x,z,radius,out) {
 let best=radius*radius,found=false;
 for(const animal of [...populations[0],...populations[1],...populations[2],...populations[3]]){
  const d=(animal.x-x)**2+(animal.z-z)**2;
  if(d<best){best=d;out.set(animal.x,animal.y+.35,animal.z);found=true;}
 }
 return found;
}
for(let i=0;i<2000;i++){
 const x=Math.sin(i)*7,z=Math.cos(i*.73)*5,r=i%8,a=new Vector3(9,9,9),b=a.clone();
 assert.equal(nearestCreature(populations,x,z,r,a),previous(x,z,r,b));assert.deepEqual(a.toArray(),b.toArray());
}
console.log('Nearest creature: 2,000 parity cases, ties, exclusive bounds, output preservation and live populations passed.');

// The real `state` getters return detached snapshots. Cached gameplay queries must use live positions.
const habitat = {ground:()=>2, grassHeight:()=>.5, meadow:()=>true, forage:()=>true,
  flowers:[], perches:[], canopy:[], treeBase:new Vector3()};
const rabbits = new Rabbits(habitat), birds = new Songbirds(habitat);
const live = [rabbits.positions,birds.positions];
assert(rabbits.add(0,0,123)); birds.addFlock(3,3,4,5,456);
assert.equal(live[0].length,1); assert.equal(live[1].length,4,'spawns appear through the cached live arrays');
const before = JSON.stringify([rabbits.state,birds.state]);
const stimuli = {
  camera:new PerspectiveCamera(), input:{}, gustAt:null, updraft:{x:0,z:0,strength:0},
  glider:null, walker:new Vector3(), life:()=>1, breeze:.5, night:0,
  sample:{x:0,z:0,energy:0,lift:0},
  wind:{sample(_x,_z,out){return Object.assign(out,{x:1,z:0,energy:0,lift:0});}},
  voices:{cheep(){}},
};
for(let i=0;i<600;i++){
  rabbits.update(1/60,i/60,stimuli); birds.update(1/60,i/60,stimuli);
  const snapshots=[rabbits.state,birds.state];
  const a=new Vector3(),b=new Vector3();
  assert.equal(nearestCreature(live,0,0,100,a),nearestCreature(snapshots,0,0,100,b));
  assert.deepEqual(a.toArray(),b.toArray(),'cached positions follow actual movement');
}
assert.notEqual(JSON.stringify([rabbits.state,birds.state]),before,'the fixture actually moves animals');
const snapshot=rabbits.state;snapshot[0].x=999;
assert.notEqual(rabbits.positions[0].x,999,'QA snapshots remain detached');
console.log('Actual rabbit/songbird getters: spawn, movement and detached inspection snapshots passed over 600 frames.');
