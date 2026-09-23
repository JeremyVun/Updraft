// CPU contact checks for the fork and the finite birch support. No renderer/browser lock required.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';

globalThis.location={search:'?lite=0'};
const {BirchScarf,SCARF_SNAGS,SCARF_PERCHES}=await import('../src/world/birch-scarf.ts');
const {heightAt,setHeightGrid}=await import('../src/world/island.ts');
const res=400,size=200,minX=-100,minZ=-1230,data=new Float32Array(res*res);
for(let z=0;z<res;z++)for(let x=0;x<res;x++)data[z*res+x]=heightAt(minX+(x+.5)/res*size,minZ+(z+.5)/res*size);
setHeightGrid({data,res,size,minX,minZ,stride:1});
const scarf=new BirchScarf();
scarf.setTrees([...SCARF_SNAGS.filter(s=>s.kind!=='unwind'&&s.kind!=='pull').map(s=>({x:s.treeX,z:s.treeZ})),...SCARF_PERCHES].map(s=>({...s,y:heightAt(s.x,s.z)-.25,scale:16})));
const wind={sample(x,z,out){Object.assign(out,{x:0,z:0,lift:0,energy:0});return out;}};
let supportGap=0,stretch=1;
for(const work of [0,.25,.5,.75,.95]){
  scarf.snags[0].target=work;
  for(let i=0;i<60;i++){
    scarf.update(1/60,wind);
    const c=scarf.firstCloth;stretch=Math.max(stretch,c.report().stretch);
    for(const pin of c.supports){
      if(pin%2)continue;
      const center=c.positions[pin].clone().add(c.positions[pin+1]).multiplyScalar(.5),rail=c.supportRail,axis=rail.b.clone().sub(rail.a);
      const t=Math.max(0,Math.min(1,center.clone().sub(rail.a).dot(axis)/axis.lengthSq()));
      supportGap=Math.max(supportGap,center.distanceTo(rail.a.clone().addScaledVector(axis,t)));
    }
  }
}
assert.ok(supportGap<.21,`Fork supports floating: ${supportGap}`);
assert.ok(stretch<1.15,`Fork stretched: ${stretch}`);
// A solved loop must stay off the branch, including after restoring a solved checkpoint.
const fork=scarf.firstCloth, rail=fork.supportRail;
const branch=fork.capsules.find(c=>c.b.distanceTo(rail.b)<.01);
function branchGap(){
  const axis=branch.b.clone().sub(branch.a);
  return Math.min(...fork.positions.map(p=>{
    const t=Math.max(0,Math.min(1,p.clone().sub(branch.a).dot(axis)/axis.lengthSq()));
    return p.distanceTo(branch.a.clone().addScaledVector(axis,t))-branch.radius;
  }));
}
const releaseGaps=[];
fork.setPull(1,0);fork.release();
for(let i=0;i<1200;i++){
  fork.update(1/60);
  if([239,599,1199].includes(i))releaseGaps.push(branchGap());
}
const firstRelease=fork.report();
scarf.restore(1);
const restoredGap=branchGap();
console.log(JSON.stringify({releaseGaps,restoredGap,firstRelease}));
assert.ok(releaseGaps.every(g=>g>.35), 'Solved scarf settled back onto its branch');
assert.ok(restoredGap>.35, 'Restored scarf was caught on its old branch');
const stump=scarf.stump,top=heightAt(stump.x,stump.z)+stump.height;
let clearance=Infinity;
for(const work of [0,.1,.25,.4,.55,.7,.8,.9,.99]){
  scarf.snags[1].work=scarf.snags[1].target=work;
  scarf.update(1/60,wind);
  const p=scarf.mesh.geometry.attributes.position;
  for(let row=scarf.owner.indexOf(1);row<=scarf.owner.lastIndexOf(1);row++)for(let j=0;j<24;j++){
    const i=row*24+j;
    if(p.getY(i)<top+.02)clearance=Math.min(clearance,Math.hypot(p.getX(i)-stump.x,p.getZ(i)-stump.z)-stump.radius);
  }
}
assert.ok(clearance>.05,`Scarf went through stump: ${clearance}`);
scarf.snags[1].work=scarf.snags[1].target=1;
for(let i=0;i<360;i++)scarf.update(1/60,wind);
const release=scarf.releasedCloth.get(1).cloth.report();
assert.ok(release.penetration<.02&&release.stretch<1.15,JSON.stringify(release));
console.log(JSON.stringify({supportGap,stretch,stumpClearance:clearance,secondRelease:release}));

// The new slipped loop is its own physical span, attached to the trees on either side.
scarf.snags[2].work=scarf.snags[2].target=1;
for(let i=0;i<300;i++)scarf.update(1/60,wind);
const loop=scarf.releasedCloth.get(2), before=SCARF_PERCHES[6],after=SCARF_PERCHES[7];
assert.ok(Math.hypot(scarf.tied[loop.start].x-before.x,scarf.tied[loop.start].z-before.z)<1.05);
assert.ok(Math.hypot(scarf.tied[loop.end].x-after.x,scarf.tied[loop.end].z-after.z)<1.05);
assert.ok(loop.cloth.report().penetration<.02);
assert.equal(scarf.finished,false,'Three releases must not finish the four-knot scarf');

// Both late knots bear on real limbs through partial pulls, including their full-width hems.
const vertex=scarf.snags[3].center.clone();
for(const index of [2,3]){
  scarf.restore(0);
  const start=scarf.owner.indexOf(index),end=scarf.owner.lastIndexOf(index);
  const branches=index===2?scarf.slipBranch:scarf.bowBranch;
  const branchGap=p=>Math.min(...branches.map(b=>{
    const axis=b.b.clone().sub(b.a);
    const t=Math.max(0,Math.min(1,p.clone().sub(b.a).dot(axis)/axis.lengthSq()));
    return p.distanceTo(b.a.clone().addScaledVector(axis,t))-b.radius;
  }));
  let clearance=Infinity;
  for(const work of [0,.25,.5,.7,.85,.95]){
    scarf.snags[index].work=scarf.snags[index].target=work;
    scarf.update(1/60,wind);
    let nearest=Infinity;
    const p=scarf.mesh.geometry.attributes.position;
    for(let row=start;row<=end;row++)for(let j=0;j<24;j++){
      const i=row*24+j,gap=branchGap(vertex.set(p.getX(i),p.getY(i),p.getZ(i)));
      nearest=Math.min(nearest,gap);clearance=Math.min(clearance,gap);
    }
    if(work<=.7)assert.ok(nearest<.06,`Knot ${index} floated off its support at ${work}: ${nearest}`);
  }
  assert.ok(clearance>.02,`Knot ${index} hem cut through its branch: ${clearance}`);
  scarf.snags[index].work=scarf.snags[index].target=1;
  for(let i=0;i<600;i++)scarf.update(1/60,wind);
  const cloth=scarf.releasedCloth.get(index).cloth,release=cloth.report();
  assert.ok(release.penetration<.02&&release.stretch<1.15,JSON.stringify(release));
  assert.ok(Math.min(...cloth.positions.map(branchGap))>.35,`Released knot ${index} caught on its old branch`);
  console.log(JSON.stringify({knot:index,clearance,release}));
}

const {BirchesChapter}=await import('../src/story/birches.ts');
const saved={cast:{birches:{scarf},boat:{scarfSail:0},child:{stop(){}}}};
BirchesChapter.prototype.restoreCheckpoint.call(saved,'scarf-3',[4,0,.65,3]);
assert.equal(scarf.completed,4);assert.equal(saved.cast.boat.scarfSail,1);
BirchesChapter.prototype.restoreCheckpoint.call(saved,'scarf4-3',[4,0,.65,3]);
assert.equal(scarf.completed,3);assert.equal(saved.cast.boat.scarfSail,0);
console.log('Fourth knot attachments and old/new checkpoint migration passed.');
