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
t.quality('high',1.25,2);for(let i=0;i<3601;i++)t.frame(1000/60);t.quality('low',.72,2);
t.failure('runtime',new TypeError('secret email user@example.invalid'));t.failure('runtime',new TypeError('another error'));
t.complete();t.complete();t.flush();
assert.equal(recorded.filter(e=>e.t==='game_started').length,1);
assert.equal(recorded.filter(e=>e.t==='chapter_entered').length,2);
assert.equal(recorded.filter(e=>e.t==='game_completed').length,1);
assert.equal(recorded.filter(e=>e.t==='game_failed').length,1);
assert.equal(recorded.find(e=>e.t==='loading_finished').d.stall,'500ms_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d.fps,'55_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d['chapter.fps'],'lines.55_plus');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d.level,'high');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d['chapter.level'],'lines.high');
assert.equal(recorded.find(e=>e.t==='performance_sampled').d['level.fps'],'high.55_plus');
assert.deepEqual(recorded.filter(e=>e.t==='quality_changed').map(e=>[e.d.level,e.d.scale,e.d.samples,e.d.direction]),[['high','1_1_3','2','initial'],['low','under_0_8','2','changed']]);
assert(!JSON.stringify(recorded).includes('secret'));assert(!JSON.stringify(recorded).includes('@'));
const expected=new Set(['build','environment','chapter','duration','stall','mode','level','scale','samples','direction','fps','hitches','chapter.level','chapter.fps','level.fps','phase','kind']);
for(const event of recorded) {assert(Object.keys(event.d).every(k=>expected.has(k)));assert(Object.values(event.d).every(v=>v.length<=64));}
for (const search of ['?shot&chapter=stage', '?shot&chapter=stage&analytics=1', '?analytics=0']) {
  location.search=search;
  const {telemetry:production}=await load('telemetry-production.ts',source+'\n// '+search);
  assert.equal(production.enabled(), !search.endsWith('analytics=0'));
}
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
console.log('Analytics transport failures, anonymous bounded payloads, event dedup, completed resumes and QA isolation passed.');
