// Begin -> every chapter -> credits -> reload completed save -> Play again, in one fresh browser.
// Real pointer gestures and natural story transitions only: never assigns beats, actors or puzzle progress. In the
// drowned village it brings the tub to the cat and back, fells the tree, turns the mill, pumps the swing and brings
// the boat to the nave, and fails if any of the room's safety valves carries it on instead.
// Usage: node tools/playthrough.mjs [output-prefix]. BASE supports dev, preview or production.
// Up to 60 minutes; uses the shared GPU lock. Screenshots and structured failure/progress evidence go to /tmp.
// REVIEW=1 records video and one-second frames. UNTIL=<chapter> ends a focused replay on entering that chapter.
// SAVE_FILE=<checkpoint.json> continues through the normal Continue button after a repaired failure.
// TRACE=1 writes every camera step (eye, gaze, subject and the rig's corrections) to <prefix>-camera.jsonl.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openBrowser} from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-playthrough';
const base=process.env.BASE??'http://127.0.0.1:5230/';
const review=process.env.REVIEW==='1';
const trace=process.env.TRACE==='1';
const expected=['island','toLines','lines','toBoats','boats','toMeadow','meadow','toBirches','birches','toStairs','stairs','drowned','wood','toSleeping','sleeping','toMirror','mirror','toHarbour','home'];
const until=process.env.UNTIL;
if(until)assert(expected.includes(until),'UNTIL must be a journey chapter');
const saved=process.env.SAVE_FILE?JSON.parse(fs.readFileSync(process.env.SAVE_FILE,'utf8')):null;
if(saved)assert(expected.includes(saved.chapter),'Saved chapter must be part of the journey');
const route=saved?expected.slice(expected.indexOf(saved.chapter)):expected;
const {browser,close}=await openBrowser();
const width=1280,height=800;
const context=await browser.newContext({viewport:{width,height},
  ...(saved?{storageState:{cookies:[],origins:[{origin:new URL(base).origin,
    localStorage:[{name:'updraft.progress.v1',value:JSON.stringify(saved)}]}]}}:{}),
  ...(review?{recordVideo:{dir:prefix+'-video',size:{width,height}}}:{})});
const page=await context.newPage();
const report={chapters:[],beats:[],checkpoints:[],errors:[],completed:false,replayed:false};
if(saved)report.startCheckpoint={chapter:saved.chapter,point:saved.point};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))report.errors.push(m.text())});
await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
const snapshot=()=>page.evaluate(()=>{
  const g=__game,c=g.story.current, project=p=>{if(!p)return null;const q=p.clone().project(g.rig.camera);return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2,z:q.z}};
  const snag=g.birches.scarf.snags.findIndex(s=>!s.freed);
  const bubble=g.skyMirror.carried??g.skyMirror.bubbles.find(b=>!b.pop);
  const piece=g.story.name==='stairs'?g.cloudStairs.waiting:null;
  const home=piece?.flight.bottom.clone().lerp(piece.flight.landing,.5);
  let direction=null;
  if(bubble && !g.skyMirror.carried && g.skyMirror.stars[c.target]) {
    const a=project(bubble.position),b=project(g.skyMirror.stars[c.target].origin.clone().setY(bubble.position.y));direction={x:b.x-a.x,y:b.y-a.y};
  }
  return {chapter:g.story.name,beat:c.beat,life:g.story.worldLife,scripted:c.scripted,finished:!!c.finished,
    checkpoint:JSON.parse(localStorage.getItem('updraft.progress.v1')??'null')?.point,
    trodden:c.trodden?.toArray()??null,
    bird:project(g.cygnet.position),coax:project(c.coax?.at),wind:project(c.windInvitation),
    fleet:project(g.littleBoats.invitation),feather:project(g.sleeping.feather.position),
    snag,scarf:snag>=0?project(g.birches.scarf.snags[snag].center):null,
    bubble:project(bubble?.position),carried:!!g.skyMirror.carried,wand:project(g.skyMirror.wand),direction,
    flight:piece?{at:project(g.cloudStairs.pointOn(piece,home.clone(),home.clone())),to:project(home),settling:piece.settling}:null,
    piano:g.piano.expect && c.piano?.at==='seated' ? {expect:g.piano.expect,path:[0,1].map(t=>project(g.piano.guideAlong(t,g.piano.keys.clone())))} : null,
    sail:project(g.boat.sailPoint(g.boat.position.clone())),drowned:g.story.name==='drowned'?drownedGesture(c,project):null,
    valves:window.__drownedValves??[],stats:__stats};
});
/** What the drowned village asks of the wind now, on screen: the tub, the run's tree, mill and swing, and the boat at the church. */
const drownedGestures=()=>page.evaluate(()=>{
  window.drownedGesture=(c,project)=>{
    const g=__game,cam=g.rig.camera,r=c.run,ch=c.church,b=g.boat;
    const heading=(from,to)=>{const a=from.clone().project(cam),z=to.project(cam);return {x:(z.x-a.x)*cam.aspect,y:-(z.y-a.y)}};
    if(['waiting','ferried'].includes(c.cat.step)){
      const tub=g.village.tub.position.clone().setY(g.village.tub.position.y+.15),at=project(tub),to=project(c.cat.goal);
      return {kind:'tub',at,dx:to.x-at.x,dy:to.y-at.y};
    }
    if(r&&r.stage==='tree'&&r.tree.tree.state==='standing'){
      const h=r.tree.tree.fallHeading(cam);return {kind:'tree',at:project(r.tree.tree.trunkAt(.5,cam.position.clone())),dx:Math.cos(h),dy:-Math.sin(h)};
    }
    if(r&&r.stage==='mill')return {kind:'mill',at:project(r.mill.mill.hub)};
    if(r&&r.swing.phase==='riding'){
      const s=r.swing.swing,seat=s.seat(cam.position.clone());
      return {kind:'swing',at:project(seat),...(({x,y})=>({dx:x,dy:y}))(heading(seat,seat.clone().set(seat.x+s.toward.x*2,seat.y,seat.z+s.toward.y*2)))};
    }
    if(ch&&ch.step==='bring'&&!b.grounded){
      const at=b.sailPoint(cam.position.clone());
      return {kind:'bring',at:project(at),...(({x,y})=>({dx:x,dy:y}))(heading(at,at.clone().set(at.x+Math.sin(b.yaw)*2,at.y,at.z+Math.cos(b.yaw)*2)))};
    }
    return null;
  };
  /** Each of the room's safety valves, should one ever carry it on in place of the player's wind. */
  const fired=window.__drownedValves=[];
  const watch=()=>{
    const g=__game,c=g.story.current;
    if(g.story.name==='drowned'){
      const r=c.run,valves={tub:!!g.village.tub.carry,tree:!!r?.tree.valving,mill:!!r?.mill.valving,swing:!!r?.swing.valving,church:!!c.church?.carrying};
      for(const [name,on] of Object.entries(valves))if(on&&!fired.includes(name))fired.push(name);
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
});
/**
 * The drowned room's gestures move the pointer once a rendered frame, as its own check does, so a stroke has the same
 * speed in the game's time however fast the browser draws; between them the pointer goes the long way round along the
 * foot of the screen, too slowly to make wind.
 */
const nextFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r())));
const gameSeconds=async(t)=>{const end=(await page.evaluate(()=>__stats.time))+t;while(await page.evaluate(()=>__stats.time)<end)await nextFrame()};
let pointer={x:width/2,y:height-4};
async function goTo(x,y){
  for(const [ax,ay] of [[pointer.x,height-4],[x,height-4],[x,y]]){await page.mouse.move(ax,ay);await nextFrame()}
  pointer={x,y};
}
async function stroke(p,dx,dy,length,frames) {
  if(!visible(p))return false;
  const n=Math.hypot(dx,dy)||1;dx*=length/n;dy*=length/n;
  await goTo(p.x-dx/2,p.y-dy/2);
  for(let i=1;i<=frames;i++){pointer={x:p.x-dx/2+dx*i/frames,y:p.y-dy/2+dy*i/frames};await page.mouse.move(pointer.x,pointer.y);await nextFrame()}
  strokes++;return true;
}
/** Circles round p on screen, clockwise as the mill's sails turn: a turn every 78 frames. */
async function clockwise(p,radius,turns) {
  if(!visible(p))return false;
  for(let i=0;i<turns*78;i++){
    const a=i/78*Math.PI*2,rr=radius*(1+.18*Math.sin(a*1.7));pointer={x:p.x+Math.cos(a)*rr,y:p.y+Math.sin(a)*rr*1.1};
    await page.mouse.move(pointer.x,pointer.y);await nextFrame();
  }
  strokes++;return true;
}
const visible=p=>p&&p.z<1&&p.x>8&&p.x<width-8&&p.y>8&&p.y<height-8;
let reviewTimer,reviewPending=Promise.resolve(),reviewBusy=false,reviewFrame=0;
if(review)fs.mkdirSync(prefix+'-frames',{recursive:true});
function startReview(){
  if(!review)return;
  reviewTimer=setInterval(()=>{
    if(reviewBusy)return;
    reviewBusy=true;
    reviewPending=(async()=>{
      const s=await snapshot(),index=reviewFrame++,file=String(index).padStart(5,'0')+'.jpg';
      await page.screenshot({path:prefix+'-frames/'+file,type:'jpeg',quality:75});
      fs.appendFileSync(prefix+'-frames.jsonl',JSON.stringify({index,file,chapter:s.chapter,beat:s.beat,
        time:s.stats.time,wall:Date.now(),scripted:s.scripted})+'\n');
    })().catch(e=>report.errors.push('Review capture: '+e.message)).finally(()=>{reviewBusy=false});
  },1000);
}
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
  assert.equal(await page.locator('#begin').innerText(),saved?'Continue':'Begin');await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  await drownedGestures();
  startReview();
  if(trace){fs.writeFileSync(prefix+'-camera.jsonl','');await page.evaluate(()=>{
    const g=__game,rig=g.rig,original=rig.update.bind(rig),r=v=>v?[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]:null;
    let label='';window.__cameraTrace=[];
    rig.update=(dt,time,shot,pace,hold)=>{
      original(dt,time,shot,pace,hold);
      const now=g.story.name+'/'+g.story.current.beat;
      window.__cameraTrace.push({t:+time.toFixed(4),dt,...(now!==label?{at:(label=now)}:{}),eye:r(rig.camera.position),look:r(rig.look),
        target:r(shot.target),want:shot.eye?r(shot.eye):null,primary:r(shot.subjects?.primary),focus:r(g.story.focus),child:r(g.child.position),
        fit:+rig.fitBack.toFixed(3),pull:+rig.pull.toFixed(3),lift:+rig.lift.toFixed(3),rise:+rig.sceneryRise.toFixed(3),
        side:r(rig.sceneryOffset),offset:+rig.direction.offset.toFixed(4),pace,hold,placed:rig.placed,transition:!!g.story.transitionView});
    };
  });}
  const started=Date.now();let chapterAt=started,lastBeat='',lastSave='';
  while(Date.now()-started<60*60*1000){
    const s=await snapshot();
    if(trace)fs.appendFileSync(prefix+'-camera.jsonl',(await page.evaluate(()=>window.__cameraTrace.splice(0).map(e=>JSON.stringify(e)).join('\n')+'\n')).replace(/^\n$/,''));
    report.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('updraft.progress.v1')??'null'));
    assert.equal(report.errors.length,0,report.errors.slice(0,5).join('\n'));
    assert.deepEqual(s.valves,[],`A drowned safety valve carried the room on: ${s.valves.join(', ')} (${s.chapter}/${s.beat})`);
    if(s.trodden)assert(s.trodden.every(Number.isFinite)&&s.trodden[1]>0,
      `Invalid grass patch (x, radius, z): ${s.chapter} ${s.trodden}`);
    if(report.chapters.at(-1)?.name!==s.chapter){
      const index=report.chapters.length;assert.equal(s.chapter,route[index],`Unexpected chapter after ${report.chapters.at(-1)?.name}`);
      chapterAt=Date.now();report.chapters.push({name:s.chapter,seconds:(Date.now()-started)/1000,gameSeconds:s.stats?.time,frame:s.stats?.frame});
      console.log(JSON.stringify({entered:s.chapter,seconds:report.chapters.at(-1).seconds}));
      await page.screenshot({path:`${prefix}-${String(index).padStart(2,'0')}-${s.chapter}.png`});
    }
    if(lastBeat!==s.chapter+'/'+s.beat){lastBeat=s.chapter+'/'+s.beat;report.beats.push({name:lastBeat,seconds:(Date.now()-started)/1000,gameSeconds:s.stats?.time});console.log(JSON.stringify({beat:lastBeat,life:s.life}));}
    if(lastSave!==s.chapter+'/'+s.checkpoint){lastSave=s.chapter+'/'+s.checkpoint;report.checkpoints.push(lastSave);}
    report.last=s;report.strokes=strokes;fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));
    if(until&&s.chapter===until){report.reached=until;break;}
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
    else if(s.chapter==='stairs'&&s.beat==='waiting'&&s.flight&&!s.flight.settling){
      const {at,to}=s.flight,dx=to.x-at.x,dy=to.y-at.y,length=Math.hypot(dx,dy);
      if(visible(to))acted=await sweep(at,dx,dy,length,500+Math.min(900,length*2.5),true);
    }
    else if(s.chapter==='stairs'&&s.beat==='loop')acted=await sweep(s.wind,1,-.2,340,450);
    else if(s.chapter==='drowned'&&s.drowned){
      const d=s.drowned;
      const pause={tub:.6,tree:1.8,swing:.8,bring:.7}[d.kind];
      if(d.kind==='mill')acted=await clockwise(d.at,height*.22,1);
      else acted=await stroke(d.at,d.dx,d.dy,height*{tub:.18,tree:.62,swing:.5,bring:.35}[d.kind],{tub:14,tree:15,swing:12,bring:12}[d.kind]);
      if(acted&&pause)await gameSeconds(pause);
    }
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
  if(until){
    assert.equal(report.reached,until,'Focused replay did not reach its final chapter');
    assert.deepEqual(report.chapters.map(c=>c.name),route.slice(0,route.indexOf(until)+1));
    console.log(`Focused replay reached ${until}.`);
  }else{
  assert(report.completed,'Playthrough did not reach the ending');
  assert.deepEqual(report.chapters.map(c=>c.name),route);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('updraft.progress.v1')??'null')?.point==='complete');
  await page.waitForSelector('#ending.visible');await page.waitForTimeout(6500);
  await page.screenshot({path:prefix+'-credits.png'});
  // The journey capture ends here; reload intentionally has no game object until boot completes.
  clearInterval(reviewTimer);await reviewPending;
  await page.reload();await page.waitForSelector('#veil.ready',{timeout:60000});
  assert.equal(await page.locator('#begin').innerText(),'Continue');await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__game?.story.current.finished,null,{timeout:60000});
  await page.locator('#again').click({timeout:180000});
  await page.waitForSelector('#veil.ready',{timeout:60000});assert.equal(await page.locator('#begin').innerText(),'Begin');
  await page.locator('#begin').click();await page.waitForFunction(()=>window.__ready===true);
  assert.equal((await snapshot()).chapter,'island');report.replayed=true;
  assert.equal(report.errors.length,0);console.log(`${saved?'Continued journey':'Full journey'}, completed-save reload and Play again passed.`);
  }
} catch(error) {
  report.failure=String(error);await page.screenshot({path:prefix+'-failure.png'}).catch(()=>{});throw error;
} finally {
  clearInterval(reviewTimer);await reviewPending;
  fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));
  await context.close();await close();
}
