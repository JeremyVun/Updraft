// Usage: node tools/progress-schema-check.mjs. Compare current/legacy save validation with BASELINE_REF.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import { importBaseline, baselineRevision } from './lib/baseline.mjs';
globalThis.location={search:'?shot'};
const before=await importBaseline('src/story/progress.ts');
const after=await import('../src/story/progress.ts');
for(const [chapter,checkpoints] of Object.entries(before.CHECKPOINTS))for(const [point,count] of Object.entries(checkpoints))
 assert.equal(after.CHECKPOINTS[chapter]?.[point],count,`${chapter}/${point} keeps its exact arity (checkpoints may be added, never changed or dropped)`);
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
assert.equal(after.hasFinished(), false);
const completed = {version:1,chapter:'home',point:'complete',data:[],child:[1,2,3,0,0],boat:[1,2,0,0,0],bird:[1,2,3,0,1,2,0],plane:[0,0],seat:null,life:[[1,2,3,1],[4,5,6,1],[7,8,9,1]]};
const storage = new Map([[after.PROGRESS_KEY, JSON.stringify(completed)]]);
globalThis.localStorage = {
 getItem: key => storage.get(key) ?? null,
 setItem() { throw new Error('quota exceeded'); },
 removeItem: key => storage.delete(key),
};
assert.equal(after.hasFinished(), true, 'a completed legacy save still unlocks chapters when the flag cannot be written');
localStorage.setItem = (key, value) => storage.set(key, value);
assert.equal(after.hasFinished(), true);
after.clearProgress();
assert.equal(after.hasFinished(), true, 'Play again keeps the chapter unlock');
storage.delete(after.FINISHED_KEY);
for (const invalid of [{point:'complete'}, {...completed,chapter:'unknown'}, {...completed,data:[1]}]) {
 storage.set(after.PROGRESS_KEY, JSON.stringify(invalid));
 assert.equal(after.hasFinished(), false, 'a malformed completion is not a finished journey');
}
console.log(`Checkpoint schema: ${points} current/legacy layouts and ${cases} decode cases match ${baselineRevision}; corrupt/unavailable storage passes.`);
