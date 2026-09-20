// Usage: node tools/progress-schema-check.mjs. Compare current/legacy save validation with BASELINE_REF.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import { importBaseline, baselineRevision } from './lib/baseline.mjs';
globalThis.location={search:'?shot'};
const before=await importBaseline('src/story/progress.ts');
const after=await import('../src/story/progress.ts');
assert.deepEqual(after.CHECKPOINTS,before.CHECKPOINTS,'every current and legacy checkpoint keeps its exact arity');
let stored=null;
globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value},removeItem:()=>{stored=null}};
let cases=0,points=0;
function compare(value){
 stored=JSON.stringify(value);
 assert.deepEqual(after.readProgress(),before.readProgress(),`decode differs: ${stored}`);cases++;
}
for(const [chapter,checkpoints] of Object.entries(before.CHECKPOINTS))for(const [point,count] of Object.entries(checkpoints)){
 const save={version:1,chapter,point,data:Array.from({length:count},(_,i)=>i+.25),child:[1,2,3,.2,0],boat:[1,2,.3,1,0],bird:[1,2,3,.4,.5,2,1],plane:[1,.3],seat:null,life:[[1,2,3,1],[4,5,6,.5],[7,8,9,.2]]};
 compare(save);assert.deepEqual(after.decodeProgress(save),save);points++;
 for(const field of ['data','child','boat','bird','plane'])for(const change of ['short','long','nan','string']){
  const modified=structuredClone(save),values=modified[field];
  if(change==='short')values.pop();if(change==='long')values.push(0);if(change==='nan')values[0]=NaN;if(change==='string')values[0]='0';compare(modified);
 }
 for(const seat of ['cradle','satchel','lap','unknown',undefined,0])compare({...save,seat});
 for(const chapter of ['__proto__','constructor','stage','unknown'])compare({...save,chapter});
 for(const point of ['__proto__','constructor','unknown'])compare({...save,point});
 for(const value of [999999,-999999,1e6,-1e6,Infinity])compare({...save,child:[value,2,3,.2,0]});
}
for(const value of [null,false,0,'',[],{}, {version:99}])compare(value);
for(const raw of ['{bad','null','']){stored=raw;assert.equal(after.readProgress(),null);}
globalThis.localStorage={getItem(){throw new Error('storage unavailable')}};assert.equal(after.readProgress(),null);
console.log(`Checkpoint schema: ${points} current/legacy layouts and ${cases} decode cases match ${baselineRevision}; corrupt/unavailable storage passes.`);
