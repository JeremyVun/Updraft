// Transport failures, privacy, event cardinality, lifecycle dedup and QA isolation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {transformSync} from 'rolldown/utils';
const load=(name,source)=>import('data:text/javascript;base64,'+Buffer.from(transformSync(name,source).code).toString('base64'));
const {Analytics}=await load('client.ts',fs.readFileSync('src/analytics/client.ts','utf8'));
const requests=[];let mode='ok';
globalThis.fetch=(url,options)=>{
  if(mode==='throw')throw Error('network unavailable');
  requests.push({url,...options});
  return mode==='reject'?Promise.reject(Error('offline')):Promise.resolve({status:204});
};
const client=new Analytics({endpoint:'https://analytics.invalid',project:'updraft',flushIntervalMs:1e8});
client.count('loading_finished',{d:{duration:'2_5s'}});client.flush();
assert.equal(requests.length,1);assert.equal(requests[0].credentials,'omit');assert.equal(requests[0].referrerPolicy,'no-referrer');
const event=JSON.parse(requests[0].body)[0];assert.equal(event.p,'updraft');assert(!('u' in event)&&!('sid' in event));
for(mode of ['throw','reject']) {assert.doesNotThrow(()=>{client.count('game_failed');client.flush();});}
client.stop();
mode='ok';const off=new Analytics({endpoint:'',project:'updraft'});const count=requests.length;
off.count('game_started');off.stop();assert.equal(requests.length,count);
await new Promise(r=>setTimeout(r,0));

const recorded=[];
class FakeClient {constructor(o){this.o=o;}enabled(){return !!this.o.endpoint;} count(t,o){if(this.enabled())recorded.push({t,...o});}flush(){}}
globalThis.TestAnalytics=FakeClient;
globalThis.location={search:''};globalThis.document={hidden:false};
Object.defineProperty(globalThis,'navigator',{value:{doNotTrack:'0'},configurable:true});
const source=fs.readFileSync('src/analytics/telemetry.ts','utf8')
  .replace("import { Analytics } from './client';","const Analytics = globalThis.TestAnalytics;")
  .replace("import { publicConfig } from '../public-config';","const publicConfig = {analyticsUrl:'https://analytics.invalid',analyticsProject:'updraft'};")
  .replace("import { QA } from '../qa';", 'const QA = globalThis.testQa;')
  .replaceAll('import.meta.env','({DEV:false})').replace('declare const __BUILD_ID__: string;',"const __BUILD_ID__ = 'test-build';");
globalThis.testQa=false;
const {telemetry:t}=await load('telemetry.ts',source);
t.loadingFinished(2300,933);t.start('island',false);t.start('island',false);t.chapter('island');t.chapter('lines');
t.quality('high');for(let i=0;i<7201;i++)t.frame(1000/60);
assert.equal(recorded.filter(e=>e.t==='performance_sampled').length,0);
t.quality('low');
t.failure('runtime',new TypeError('secret email user@example.invalid'));t.failure('runtime',new TypeError('another error'));
t.complete();t.complete();t.flush();
assert.equal(recorded.filter(e=>e.t==='game_started').length,1);
assert.equal(recorded.filter(e=>e.t==='chapter_entered').length,2);
assert.equal(recorded.filter(e=>e.t==='game_completed').length,1);
assert.equal(recorded.filter(e=>e.t==='game_failed').length,1);
assert.equal(recorded.find(e=>e.t==='loading_finished').d.stall,'500ms_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d.fps,'55_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d['chapter.fps'],'lines.55_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d['level.fps'],'high.55_plus');
assert.deepEqual(recorded.filter(e=>e.t==='quality_changed').map(e=>[e.d.level,e.d.direction]),[['high','initial'],['low','changed']]);
assert.equal(recorded[0].d.environment,'production');
assert(!JSON.stringify(recorded).includes('secret'));assert(!JSON.stringify(recorded).includes('@'));
const expected=new Set(['build','environment','chapter','duration','stall','mode','level','direction','fps','hitches','chapter.fps','level.fps','phase','kind']);
for(const event of recorded) {assert(Object.keys(event.d).every(k=>expected.has(k)));assert(Object.values(event.d).every(v=>v.length<=64));}
for (const search of ['?shot&chapter=stage', '?shot&chapter=stage&analytics=1', '?analytics=0']) {
  location.search=search;
  const {telemetry:production}=await load('telemetry-production.ts',source+'\n// '+search);
  assert.equal(production.enabled(), !search.endsWith('analytics=0'));
}
location.search='';const dirtyAt=recorded.length;
const {telemetry:dirty}=await load('telemetry-dirty.ts',source.replace("'test-build'","'test-build-dirty'"));
dirty.start('island',false);assert.equal(recorded[dirtyAt].d.environment,'qa');
globalThis.testQa=true;
location.search='?shot';const before=recorded.length;
const {telemetry:qa}=await load('telemetry-qa.ts',source+'\n// qa');qa.start('island',false);assert.equal(recorded.length,before);
location.search='?shot&analytics=1';const {telemetry:finished}=await load('telemetry-complete.ts',source+'\n// complete');
finished.start('home',true,true);finished.complete();assert.equal(recorded.filter(e=>e.t==='game_completed').length,1);
assert.equal(recorded.at(-1).d.environment,'qa');
for (const testQa of [false,true]) {
  globalThis.testQa=testQa;
  navigator.doNotTrack='1';location.search='?analytics=1';
  const {telemetry:privatePlay}=await load('telemetry-private.ts',source+'\n// '+testQa);
  assert.equal(privatePlay.enabled(),false);
}
globalThis.testQa=false;navigator.doNotTrack='0';location.search='';
const chapterType=fs.readFileSync('src/story/journey.ts','utf8').match(/export type ChapterName =([\s\S]*?);/)[1];
const chapters=[...chapterType.matchAll(/'([^']+)'/g)].map(m=>m[1]);
const {telemetry:journey}=await load('telemetry-journey.ts',source+'\n// full journey');
const enteredAt=recorded.length;
journey.start(chapters[0],false);
for(const chapter of chapters.slice(1))journey.chapter(chapter);
journey.chapter('constructor');journey.chapter('unrecognised');
assert.deepEqual(recorded.slice(enteredAt).filter(e=>e.t==='chapter_entered').map(e=>e.d.chapter),chapters);
for(const direct of [false,true]){
  const {telemetry:stairs}=await load('telemetry-stairs.ts',source+'\n// stairs '+direct);
  if(direct)stairs.start('stairs',true);
  else {stairs.start('birches',false);stairs.chapter('toStairs');stairs.chapter('stairs');}
  for(let i=0;i<601;i++)stairs.frame(1000/60);
  const from=recorded.length;
  stairs.performance();stairs.failure('runtime',new TypeError());
  assert.deepEqual(recorded.slice(from).map(e=>[e.t,e.d.chapter]),[['performance_sampled','stairs'],['game_failed','stairs']]);
}
console.log('Analytics transport, privacy, lifecycle, QA isolation, dirty builds, every chapter and stairs attribution passed.');
