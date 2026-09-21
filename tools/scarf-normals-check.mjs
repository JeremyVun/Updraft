// Exact lighting parity with Three.js on the real animated scarf, plus paired CPU timings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
registerHooks({
  resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);},
  load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c);},
});
globalThis.location = { search: '?shot' };
const { BirchScarf } = await import('../src/world/birch-scarf.ts');
const { indexedNormals } = await import('../src/gl/indexed-normals.ts');
const { heightAt, setHeightGrid } = await import('../src/world/island.ts');
const res=400,size=200,minX=-100,minZ=-1230,data=new Float32Array(res*res);
for(let z=0;z<res;z++)for(let x=0;x<res;x++)data[z*res+x]=heightAt(minX+(x+.5)/res*size,minZ+(z+.5)/res*size);
setHeightGrid({data,res,size,minX,minZ,stride:1});
const scarf = new BirchScarf(), geometry = scarf.mesh.geometry;
const reference = geometry.clone();
let poses = 0;
for (const released of [0, 1, 2, 3, 4]) {
  scarf.restore(released);
  for (const strength of [0, 12, 60]) {
    const wind = {sample(x,z,out){Object.assign(out,{x:strength,z:-strength,lift:strength/10,energy:strength/60});return out;}};
    for (let i=0;i<5;i++) scarf.update(1/60,wind);
    reference.attributes.position.array.set(geometry.attributes.position.array);
    reference.computeVertexNormals();
    assert.deepEqual(geometry.attributes.normal.array,reference.attributes.normal.array,`Lighting changed: ${released} releases, wind ${strength}`);
    poses++;
  }
}
const position=geometry.attributes.position.array, normal=geometry.attributes.normal.array, index=geometry.index.array;
const fast=()=>indexedNormals(position,normal,index), original=()=>geometry.computeVertexNormals();
for(let i=0;i<100;i++){fast();original();}
const measure=fn=>{const start=performance.now();for(let i=0;i<100;i++)fn();return (performance.now()-start)/100;};
const runs=[];
for(let i=0;i<8;i++){
  const order=i%2?[fast,original,original,fast]:[original,fast,fast,original];
  const old=[],current=[];
  for(const fn of order)(fn===original?old:current).push(measure(fn));
  runs.push({originalMs:(old[0]+old[1])/2,currentMs:(current[0]+current[1])/2});
}
const report={poses,vertices:position.length/3,triangles:index.length/3,exact:true,runs};
fs.writeFileSync('/tmp/updraft-scarf-normals.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
