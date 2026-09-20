// Batched startup must produce exactly the same settled cloth and give the browser paint opportunities.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import {transformSync} from 'rolldown/utils';
registerHooks({
 resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c)},
 load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c)}
});
globalThis.location={search:'?shot'};
let paints=0;globalThis.requestAnimationFrame=fn=>setTimeout(()=>{paints++;fn(performance.now())},0);
const {BirchScarf,SCARF_SNAGS,SCARF_PERCHES}=await import('../src/world/birch-scarf.ts');
const {heightAt}=await import('../src/world/island.ts');
const {prepareInBatches}=await import('../src/gl/boot.ts');
const trees=[...SCARF_SNAGS.filter(s=>s.kind!=='unwind').map(s=>({x:s.treeX,z:s.treeZ})),...SCARF_PERCHES].map(s=>({...s,y:heightAt(s.x,s.z)-.25,scale:16}));
const original=new BirchScarf(),batched=new BirchScarf();
original.setTrees(trees);batched.setTrees(trees,false);
await prepareInBatches(batched.settle());
assert(paints>5,'preparation must yield repeatedly');
assert.deepEqual(batched.firstCloth.positions,original.firstCloth.positions);
assert.deepEqual(batched.firstCloth.previous,original.firstCloth.previous);
console.log(`Batched cloth is numerically identical; yielded ${paints} paint opportunities.`);
