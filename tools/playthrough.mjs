// Begin -> every chapter -> credits -> reload completed save -> Play again, in one fresh browser.
// Real pointer gestures and natural story transitions only: never assigns beats, actors or puzzle progress.
// Usage: node tools/playthrough.mjs [output-prefix]. BASE supports dev, preview or production.
// Up to 60 minutes; uses the shared GPU lock. Screenshots and structured failure/progress evidence go to /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-playthrough';
const base=process.env.BASE??'http://127.0.0.1:5230/';
const expected=['island','toLines','lines','toBoats','boats','toMeadow','meadow','toBirches','birches','drowned','wood','toSleeping','sleeping','toMirror','mirror','toHarbour','home'];
const {browser,close}=await openBrowser();
const width=1280,height=800;
const context=await browser.newContext({viewport:{width,height}});
const page=await context.newPage();
const report={chapters:[],beats:[],checkpoints:[],errors:[],completed:false,replayed:false};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))report.errors.push(m.text())});
await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
const snapshot=()=>page.evaluate(()=>{
  const g=__game,c=g.story.current, project=p=>{if(!p)return null;const q=p.clone().project(g.rig.camera);return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2,z:q.z}};
  const snag=g.birches.scarf.snags.findIndex(s=>!s.freed);
  const bubble=g.skyMirror.carried??g.skyMirror.bubbles.find(b=>!b.pop);
  let direction=null;
  if(bubble && !g.skyMirror.carried && g.skyMirror.stars[c.target]) {
    const a=project(bubble.position),b=project(g.skyMirror.stars[c.target].origin.clone().setY(bubble.position.y));direction={x:b.x-a.x,y:b.y-a.y};
  }
  return {chapter:g.story.name,beat:c.beat,life:g.story.worldLife,scripted:c.scripted,finished:!!c.finished,
    checkpoint:JSON.parse(localStorage.getItem('updraft.progress.v1')??'null')?.point,
    bird:project(g.cygnet.position),coax:project(c.coax?.at),wind:project(c.windInvitation),
    fleet:project(g.littleBoats.invitation),feather:project(g.sleeping.feather.position),
    snag,scarf:snag>=0?project(g.birches.scarf.snags[snag].center):null,
    bubble:project(bubble?.position),carried:!!g.skyMirror.carried,wand:project(g.skyMirror.wand),direction,
    piano:g.piano.expect && c.piano?.at==='seated' ? {expect:g.piano.expect,path:[0,1].map(t=>project(g.piano.guideAlong(t,g.piano.keys.clone())))} : null,
    sail:project(g.boat.sailPoint(g.boat.position.clone())),stats:__stats};
});
const visible=p=>p&&p.z<1&&p.x>8&&p.x<width-8&&p.y>8&&p.y<height-8;
let strokes=0;
async function sweep(p,dx=1,dy=0,length=190,ms=550,fromCenter=false) {
  if(!visible(p))return false;
  const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;
  const clamp=(v,max)=>Math.max(5,Math.min(max-5,v));
  const from={x:clamp(p.x-dx*length*(fromCenter?0:.5),width),y:clamp(p.y-dy*length*(fromCenter?0:.5),height)};
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  for(let i=1;i<=24;i++){await page.mouse.move(clamp(from.x+dx*length*i/24,width),clamp(from.y+dy*length*i/24,height));await page.waitForTimeout(ms/24)}
  await page.mouse.up();strokes++;return true;
}
async function circle(p,radius=50,ms=850,track=null) {
  if(!visible(p))return false;
  const r=Math.min(radius,p.x-8,width-p.x-8,p.y-8,height-p.y-8);if(r<6)return false;
  await page.mouse.move(p.x+r,p.y);await page.mouse.down();
  const start=Date.now();let a=0;
  while(a<Math.PI*2){if(track){const current=(await snapshot())[track];if(!visible(current))break;p=current}a=Math.min(Math.PI*2,(Date.now()-start)/ms*Math.PI*2);await page.mouse.move(p.x+Math.cos(a)*r,p.y-Math.sin(a)*r);await page.waitForTimeout(8)}
  await page.mouse.up();strokes++;return true;
}
try {
  await page.goto(base+'?shot=1&start=1&progress=1');
  await page.waitForSelector('#veil.ready',{timeout:60000});
  assert.equal(await page.locator('#begin').innerText(),'Begin');await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  const started=Date.now();let chapterAt=started,lastBeat='',lastSave='';
  while(Date.now()-started<60*60*1000){
    const s=await snapshot();
    report.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('updraft.progress.v1')??'null'));
    assert.equal(report.errors.length,0,report.errors.slice(0,5).join('\n'));
    if(report.chapters.at(-1)?.name!==s.chapter){
      const index=report.chapters.length;assert.equal(s.chapter,expected[index],`Unexpected chapter after ${report.chapters.at(-1)?.name}`);
      chapterAt=Date.now();report.chapters.push({name:s.chapter,seconds:(Date.now()-started)/1000});
      console.log(JSON.stringify({entered:s.chapter,seconds:report.chapters.at(-1).seconds}));
      await page.screenshot({path:`${prefix}-${String(index).padStart(2,'0')}-${s.chapter}.png`});
    }
    if(lastBeat!==s.chapter+'/'+s.beat){lastBeat=s.chapter+'/'+s.beat;report.beats.push({name:lastBeat,seconds:(Date.now()-started)/1000});console.log(JSON.stringify({beat:lastBeat,life:s.life}));}
    if(lastSave!==s.chapter+'/'+s.checkpoint){lastSave=s.chapter+'/'+s.checkpoint;report.checkpoints.push(lastSave);}
    report.last=s;report.strokes=strokes;fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));
    assert(Date.now()-chapterAt<15*60*1000,`Chapter stalled: ${JSON.stringify(s)}`);
    if(s.finished){report.completed=true;break;}
    let acted=false;
    if(s.chapter==='island'&&['still','play'].includes(s.beat)&&s.life<.99)acted=await sweep({x:width*.5,y:height*(.38+(strokes%8)*.055),z:0},strokes%2?-1:1,0,width*.65,850);
    else if(s.chapter==='lines'&&s.beat==='curtain')acted=await sweep({x:width*.5,y:height*(.37+(strokes%3)*.08),z:0},strokes%2?-1:1,0,width*.56,600);
    else if(s.chapter==='boats'&&s.beat==='sailing')acted=await sweep(s.fleet,1,0,200,500);
    else if(s.chapter==='meadow'&&s.piano){
      const forward=s.piano.expect.at(-1)>s.piano.expect[0],a=s.piano.path[forward?0:1],b=s.piano.path[forward?1:0];
      assert(visible(a)&&visible(b),'Piano guide must fit on screen');
      await page.mouse.move(a.x,a.y);await page.waitForTimeout(160);
      for(let i=1;i<=40;i++){await page.mouse.move(a.x+(b.x-a.x)*i/40,a.y+(b.y-a.y)*i/40);await page.waitForTimeout(30)}
      strokes++;acted=true;await page.waitForTimeout(900);
    }
    else if(s.chapter==='birches'&&s.beat==='scarf'&&s.snag>=0)acted=s.snag===1?await circle(s.scarf,height*.078):await sweep(s.scarf,s.snag===0?0:s.snag===3&&strokes%2?-1:1,s.snag===0?-1:0,150,400,s.snag===3);
    else if(s.chapter==='drowned'&&s.beat==='still')acted=await sweep(s.sail,0,-1,240,500);
    else if(s.chapter==='wood'&&visible(s.wind))acted=await sweep(s.wind,strokes%2?-1:1,0,height*.15,950);
    else if(s.chapter==='sleeping'){
      if(['asleep','snow','mist'].includes(s.beat))acted=await sweep(s.wind,1,0,170,600);
      else if(s.beat==='climb')acted=await sweep(s.feather,1,-.3,width*.35,600);
      else if(s.beat==='hilltop')acted=await circle(s.bird,height*.06,1200);
    }else if(s.chapter==='mirror'&&s.beat==='play'){
      if(s.carried)acted=await circle(s.bubble,28,900,'bubble');
      else if(s.bubble&&s.direction)acted=await sweep(s.bubble,s.direction.x,s.direction.y,110,450);
      else acted=await sweep(s.wand,1,0,140,450);
    }else if(s.chapter==='home'&&['tries','flying'].includes(s.beat))acted=await circle(s.bird,height*.065,850,'bird');
    else if(visible(s.coax))acted=await circle(s.coax,height*.065,850);
    if(!acted)await page.waitForTimeout(500);
  }
  assert(report.completed,'Playthrough did not reach the ending');
  assert.deepEqual(report.chapters.map(c=>c.name),expected);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('updraft.progress.v1')??'null')?.point==='complete');
  await page.waitForSelector('#credits.rolling');await page.waitForTimeout(6500);
  await page.screenshot({path:prefix+'-credits.png'});
  await page.reload();await page.waitForSelector('#veil.ready',{timeout:60000});
  assert.equal(await page.locator('#begin').innerText(),'Continue');await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__game?.story.current.finished,null,{timeout:60000});
  await page.locator('#again').click({timeout:180000});
  await page.waitForSelector('#veil.ready',{timeout:60000});assert.equal(await page.locator('#begin').innerText(),'Begin');
  await page.locator('#begin').click();await page.waitForFunction(()=>window.__ready===true);
  assert.equal((await snapshot()).chapter,'island');report.replayed=true;
  assert.equal(report.errors.length,0);console.log('Full journey, completed-save reload and Play again passed.');
} catch(error) {
  report.failure=String(error);await page.screenshot({path:prefix+'-failure.png'}).catch(()=>{});throw error;
} finally {fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));await close();}
