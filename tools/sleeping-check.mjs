// Sleeping island: idle gates, real pillow sweeps, gentle circles, dawn and boarding.
// Usage: node tools/sleeping-check.mjs [prefix]; TOUCH=1 for 390x844; ADVERSARIAL=1 tests wrong input and interrupted progress.
// VIDEO=1 records the real canvas and game audio as WebM. W/H override dimensions; shared GPU lock; captures in /tmp.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const prefix = process.argv[2] ?? '/tmp/updraft-sleeping';
const touch=process.env.TOUCH==='1',width=Number(process.env.W??(touch?390:1600)),height=Number(process.env.H??(touch?844:900));
const adversarial=process.env.ADVERSARIAL==='1',video=process.env.VIDEO==='1',markers=[];
const {browser,close}=await openBrowser();
console.log('Graphics acquired; starting sleeping chapter');
let finishRecording;
try {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  if(video)await page.exposeFunction('saveVideoChunk',chunk=>fs.appendFileSync(prefix+'.webm',Buffer.from(chunk,'base64')));
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
  if(video)await page.addInitScript(()=>{
    // Capture at 30 rendered frames per second, leaving headroom for the encoder. Story time remains real.
    const raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window);
    let next=0,last=-Infinity,pumpId=0;const pending=new Map();
    const pump=at=>{
      pumpId=0;
      if(at-last>=1000/30-1){
        last=at;const batch=[...pending.values()];pending.clear();
        for(const callback of batch)callback(at);
      }
      if(pending.size&&!pumpId)pumpId=raf(pump);
    };
    window.requestAnimationFrame=callback=>{const id=++next;pending.set(id,callback);if(!pumpId)pumpId=raf(pump);return id;};
    window.cancelAnimationFrame=id=>{pending.delete(id);if(!pending.size&&pumpId){caf(pumpId);pumpId=0;}};
  });
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot=1&chapter=sleeping'+(video?'&ratio=1':'')+(process.env.QUERY?'&'+process.env.QUERY:'' ));
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[width,height]);
  assert.deepEqual(errors,[],'initial shader compilation');
  const heightParity=await page.evaluate(()=>__stats.heightParity);
  assert(heightParity<0.02,'rendered hill and walking surface must agree');
  await page.evaluate(async()=>{(await import('/src/params.ts')).params.shot=false;});
  await page.evaluate(()=>{
    window.sleepMotion=[];
    let last=performance.now();
    function sample(){
      const g=__game,c=g.story.current,now=performance.now();
      if(g.story.name!=='sleeping')return;
      const k=g.cygnet,bill=k.billTip(k.position.clone());
      const head=k.nodes[6].localToWorld(k.position.clone().set(0,.08,.01));k.nodes[1].worldToLocal(head);
      const headClearance=Math.sqrt((head.x/.245)**2+((head.y-.02)/.22)**2+((head.z+.01)/.31)**2);
      window.sleepMotion.push({at:now,dt:(now-last)/1000,beat:c.beat,t:c.t,
        camera:g.rig.camera.position.toArray(),rotation:g.rig.camera.quaternion.toArray(),
        bird:k.position.toArray(),rootUp:k.nodes[0].matrixWorld.elements[5],act:k.mind.act,curtains:g.sleeping.curtains,opening:g.sleeping.curtainOpening,ribbonHeld:g.sleeping.ribbon.held,ribbonGap:k.billGrip?bill.distanceTo(k.billGrip):null,cold:g.sleeping.cold,frost:g.sleeping.frost,
        hearthFlame:g.sleeping.hearth.flame.value,hearthEmbers:g.sleeping.hearth.embers.value,clockRock:g.sleeping.clockBody.rotation.z,alarmAge:g.sleeping.alarmAge,headClearance,preenWeight:k.preenWeight,bandage:k.wing.manualUnroll,billGap:k.preenAt?bill.distanceTo(k.preenAt):null,
        featherHeld:!!g.sleeping.feather.heldBy,
        snowDepth:g.sleeping.trail.snowDepthAt(k.position.x,k.position.z)});
      last=now;requestAnimationFrame(sample);
    }sample();
  });
  if(video){
    fs.writeFileSync(prefix+'.webm',Buffer.alloc(0));
    await page.evaluate(async()=>{
      __game.sound.start();
      const output=__game.sound.output;
      if(!output)throw Error('Recording requires live chapter audio');
      const audio=output.ctx.createMediaStreamDestination(),compressor=output.ctx.createDynamicsCompressor();
      compressor.threshold.value=-18;compressor.ratio.value=3;output.bus.connect(compressor);compressor.connect(audio);
      const canvas=document.querySelector('canvas'),stream=canvas.captureStream(30);
      for(const track of audio.stream.getAudioTracks())stream.addTrack(track);
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:6000000});
      let pending=Promise.resolve();
      recorder.ondataavailable=event=>{pending=pending.then(async()=>{
        const bytes=new Uint8Array(await event.data.arrayBuffer());let binary='';
        for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
        await window.saveVideoChunk(btoa(binary));
      });};
      let finished;
      window.finishVideo=()=>finished??=(new Promise(resolve=>{recorder.onstop=()=>pending.then(resolve);recorder.stop();}));
      window.recordStarted=performance.now();recorder.start(1000);
    });
    finishRecording=()=>page.evaluate(()=>window.finishVideo());
  }
  const shot=async name=>{
    if(video){
      const time=await page.evaluate(()=>(performance.now()-window.recordStarted)/1000);
      markers.push({name,time});console.log('Recorded',name,time.toFixed(1)+'s');
    }else{await page.screenshot({path:prefix+'-'+name+'.png'});console.log(prefix+'-'+name+'.png');}
  };
  const beat=async name=>page.waitForFunction(name=>__game.story.current.beat===name,name,{timeout:100000});
  const point=async kind=>page.evaluate(kind=>{const g=__game;const p=(kind!=='bird'?g.story.current.windInvitation:g.cygnet.position).clone().project(g.rig.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},kind);
  const gesture=async(kind,scale=1)=>{
    const p=await point(kind),circle=kind==='bird',count=circle?100:28,rad=height*0.06;
    for(let i=0;i<=count;i++){
      const a=i/count*Math.PI*4;
      const x=p.x+(circle?Math.cos(a)*rad:(i/count-0.5)*Math.min(170,width*0.4)*scale);
      const y=p.y+(circle?Math.sin(a)*rad:Math.sin(i/count*Math.PI)*8);
      assert(x>0&&x<width&&y>0&&y<height,'wind target is outside the viewport');
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(circle?25:22);
      if(circle && i%5===0 && await page.evaluate(()=>__game.story.current.beat!=='hilltop'))break;
    }
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const noShortcut=async kind=>{
    const read=()=>page.evaluate(()=>({beat:__game.story.current.beat,progress:__game.story.current.beat==='asleep'?__game.story.current.pillowStroke:__game.story.current.encounterStroke}));
    if(!touch){
      // Place the pointer in sky without counting the setup move across the bank as a test stroke.
      await page.evaluate(()=>{__game.input.muted=true;});
      await page.mouse.move(width*.47,height*.025);await page.waitForTimeout(80);
      await page.evaluate(()=>{__game.input.prevNdc.copy(__game.input.ndc);__game.input.muted=false;});
    }
    const before=await read();
    // Wind in empty sky must not clear snow, fog or release the pillow's feather.
    for(let i=0;i<40;i++){
      const x=width*(.47+(i%2)*.06),y=height*.025;
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});
      else await page.mouse.move(x,y);
      await page.waitForTimeout(35);
    }
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    let after=await read();
    assert.equal(after.beat,before.beat,'off-target wind skipped a gate');
    assert(Math.abs(after.progress-before.progress)<.005,'off-target wind advanced a gate');
    // Positioning over a target may contribute one short stroke; a stationary hold cannot keep charging it.
    const p=await point(kind);
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
    else {await page.mouse.move(p.x,p.y);await page.mouse.down();}
    await page.waitForTimeout(400);const held=await read();await page.waitForTimeout(2200);after=await read();
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    assert.equal(after.beat,before.beat,'holding skipped a gate');
    assert(Math.abs(after.progress-held.progress)<.005,'stationary holding kept advancing the gate');
    console.log('Adversarial empty-sky and stationary-hold checks:',before.beat);
  };
  if(process.env.SUMMIT==='1') {
    await page.evaluate(async()=>{
      const g=__game,c=g.story.current,{SLEEP_LEDGE,BED}=await import('/src/world/sleeping.ts');
      c.moored=true;c.laid=true;g.child.stop();g.child.position.copy(BED);g.child.abed=g.child.eyesShut=1;
      g.cygnet.release(SLEEP_LEDGE);g.cygnet.stay=true;g.cygnet.errand=null;g.cygnet.wing.recovery=1;
      c.leapFrom.copy(SLEEP_LEDGE);c.to('unbinding');
    });
    await page.waitForTimeout(4500);await shot('ledge');
  } else {
  if(process.env.CLIMB==='1') await page.evaluate(()=>__game.story.current.restoreCheckpoint('feather'));
  else {
  await beat('tuckIn');await page.waitForTimeout(8500);await shot('sitting');
  await page.waitForTimeout(5000);await shot('drowsy');
  await page.waitForTimeout(5500);await shot('tucking');
  await beat('asleep');await page.waitForFunction(()=>!!__game.story.current.windInvitation,null,{timeout:40000});await page.waitForTimeout(1000);await shot('bed');
  assert.equal(await page.evaluate(()=>__game.story.current.beat),'asleep');
  assert(await page.evaluate(()=>!!__game.story.current.windInvitation),'pillow must invite a sweep');
  if(adversarial)await noShortcut('pillow');
  for(let i=0;i<5 && await page.evaluate(()=>__game.story.current.beat==='asleep');i++)await gesture('pillow');
  await beat('feather');await shot('feather');
  }
  await beat('climb');await page.waitForTimeout(2500);await shot('climb');
  // Deliberately broad, imperfect sweeps across the actual feather; the path should assist them.
  const seen=new Set();
  for(let j=0;j<140&&await page.evaluate(()=>['climb','snow','mist','catchFeather'].includes(__game.story.current.beat));j++){
    const current=await page.evaluate(()=>__game.story.current.beat);
    if(current==='catchFeather'){await page.waitForTimeout(300);continue;}
    if(['snow','mist'].includes(current)){
      if(!seen.has(current)){
        seen.add(current);await page.waitForTimeout(200);
        const onArrival=await page.evaluate(()=>__game.story.current.encounterStroke);
        console.log('Encounter arrival',current,onArrival);
        await page.waitForTimeout(3500);await shot(current+'-closed');
        assert(Math.abs(await page.evaluate(()=>__game.story.current.encounterStroke)-onArrival)<.005,'idle cannot keep clearing the obstacle');
        if(adversarial){
          await noShortcut('encounter');await gesture('encounter',.18);
          const earned=await page.evaluate(()=>__game.story.current.encounterStroke);
          await page.waitForTimeout(1800);
          assert(Math.abs(await page.evaluate(()=>__game.story.current.encounterStroke)-earned)<.005,'interrupted progress did not hold');
          await shot(current+'-partial');
        }
      }
      await gesture('encounter');
      if(await page.evaluate(current=>__game.story.current.beat!==current,current)){await page.waitForTimeout(1800);await shot(current+'-open');}
    } else {
      if(await page.evaluate(()=>[3,7].includes(__game.story.current.routeIndex))){await page.waitForTimeout(350);continue;}
      const p=await page.evaluate(()=>{const g=__game,p=g.sleeping.feather.position.clone().project(g.rig.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
      for(let i=0;i<=24;i++){if(i%4===0&&await page.evaluate(()=>__game.story.current.beat!=='climb'))break;const x=Math.max(8,Math.min(width-8,p.x+(i/24-.5)*width*.42)),y=Math.max(8,Math.min(height-8,p.y+22-Math.sin(i/24*Math.PI)*50));
        if(touch)await cdp.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,id:1}]});else await page.mouse.move(x,y);await page.waitForTimeout(25);}
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await page.waitForTimeout(500);
  }
  assert(seen.has('snow')&&seen.has('mist'),'both winter encounters were played');
  }
  await beat('hilltop');await page.waitForTimeout(7000);await shot('hilltop');
  const at=await page.evaluate(async()=>{const g=__game; const {WINDOW}=await import('/src/world/sleeping.ts'); const w=WINDOW.clone().project(g.rig.camera); return {time:g.story.current.now,dusk:g.story.current.dusk,wing:g.cygnet.wing.state,curtains:g.sleeping.curtains,window:w.toArray()};});
  assert(at.dusk>1.8 && at.wing==='free' && at.curtains===0,'the healed wing waits at the closed summit window');
  assert(Math.abs(at.window[0])<0.8 && Math.abs(at.window[1])<0.8 && at.window[2]<1,'summit window must be visible beside the bird');
  for(let i=0;i<4&&await page.evaluate(()=>__game.story.current.beat==='hilltop');i++)await gesture('bird');
  assert.equal(await page.evaluate(()=>__game.story.current.beat),'reachRibbon','gentle repeated circles must launch the reach');
  await page.waitForTimeout(800);await shot('leap');
  await beat('pullRibbon');await page.waitForTimeout(450);await shot('tug');
  const grip=await page.evaluate(async()=>{const k=__game.cygnet;return {gap:k.billTip(k.position.clone()).distanceTo(k.billGrip),nudge:k.mat.uniforms.uNudge.value,curtains:__game.sleeping.curtains};});
  assert(grip.gap<0.02&&grip.nudge<0.01&&grip.curtains===0,'the bird must grip the ribbon before the curtains can open');
  assert(await page.evaluate(async()=>{const {WINDOW,CURTAIN_END}=await import('/src/world/sleeping.ts');return [WINDOW,CURTAIN_END].every(at=>{const p=at.clone().project(__game.rig.camera);return Math.abs(p.x)<.85&&Math.abs(p.y)<.85&&p.z<1;});}),'both knot and free end remain visible during the tug');
  await beat('glide');
  assert(await page.evaluate(()=>__game.sleeping.curtainOpening>=.28),'the curtain must visibly open before release');
  const liftSeconds=await page.evaluate(at=>__game.story.current.now-at,at.time);
  // Sample the actual reveal frames. A screenshot can take longer than the remaining camera hold.
  await page.evaluate(async()=>{
    const {WINDOW}=await import('/src/world/sleeping.ts'),{tuning}=await import('/src/tuning.ts');
    window.revealSamples=[];
    const sample=()=>{
      const g=__game,c=g.story.current;
      if(c.beat!=='glide'||c.t>=tuning.sleeping.windowRevealFor)return;
      if(c.t>=tuning.sleeping.curtainsFor){
        const p=WINDOW.clone().project(g.rig.camera);
        window.revealSamples.push({time:c.t,window:p.toArray(),curtains:g.sleeping.curtains,lane:g.sleeping.laneOpen});
      }
      requestAnimationFrame(sample);
    };sample();
  });
  await page.waitForTimeout(3200);await shot('window-open');
  const reveal=await page.evaluate(()=>window.revealSamples);
  assert(reveal.length>=3,'the opening-window hold was not observed');
  assert(reveal.every(s=>Math.abs(s.window[0])<.9&&Math.abs(s.window[1])<.9&&s.window[2]<1),
    'the camera lost the opening window during the reveal: '+JSON.stringify(reveal));
  assert(reveal.every(s=>s.curtains>.8&&s.lane<.5),'curtains open while the light is still in the upper half of the descent');
  await page.waitForTimeout(2800);await shot('glide');
  await beat('waking');await page.waitForTimeout(2500);await shot('morning');
  await beat('lap');await page.waitForTimeout(2200);await shot('together');
  assert(await page.evaluate(()=>!__game.glider.visible),'the paper stays tucked away through the embrace');
  await beat('toBoat');
  // The old midpoint shot abandoned the child for empty ground on the walk back. Sample the real transition.
  const departure=[];
  for(let i=0;i<20;i++) {
    await page.waitForTimeout(150);
    departure.push(await page.evaluate(()=>{
      const g=__game,p=g.child.position.clone();p.y+=1.2;p.project(g.rig.camera);return p.toArray();
    }));
    if(i===11)await shot('leaving-bed');
  }
  assert(departure.every(p=>Math.abs(p[0])<0.9&&Math.abs(p[1])<0.9&&p[2]<1),
    'the child stays in frame throughout the departure: '+JSON.stringify(departure));
  await page.waitForFunction(()=>__game.story.name==='toMirror',null,{timeout:60000});
  const result=await page.evaluate(()=>({chapter:__game.story.name,carried:__game.cygnet.carried,riding:__game.child.riding,coat:__game.child.rig.coat.scale.toArray(),dawn:__game.sleeping.dawn,curtains:__game.sleeping.curtains}));
  assert(result.carried&&result.riding&&result.dawn===1&&result.curtains===1);
  assert.deepEqual(result.coat,[1,1,1]);assert.deepEqual(errors,[]);
  if(video){await page.evaluate(()=>window.finishVideo());console.log(prefix+'.webm');}
  const motion=await page.evaluate(()=>window.sleepMotion);
  fs.writeFileSync(prefix+'-motion.json',JSON.stringify(motion));
  const ribbonHold=motion.filter(m=>m.beat==='pullRibbon');
  assert(ribbonHold.some(m=>m.opening>.2 && m.ribbonHeld),'the bird must remain attached through the visible opening');
  assert(ribbonHold.every(m=>m.ribbonGap!==null && m.ribbonGap<.025),'the bill must hold the ribbon through the reveal');
  const reach=motion.filter(m=>m.beat==='reachRibbon');
  assert(reach.every(m=>m.act!=='bowled'),'a guided leap must not be bowled sideways');
  const snowWalking=motion.filter(m=>m.beat==='climb'&&m.snowDepth>.13);
  assert.equal(snowWalking.length,0,'walking intersects the visible snow surface');
  const pulling=motion.filter(m=>m.bandage>.03&&m.bandage<.97&&m.billGap!==null);
  assert(pulling.length>10 && pulling.every(m=>m.billGap<.055),'bandage pull must stay within bill reach');
  assert(motion.filter(m=>m.preenWeight>.2).every(m=>m.headClearance>1.1),'the face intersected the chest during the bandage sequence');
  const wakeClock=motion.filter(m=>m.alarmAge>=0&&m.alarmAge<3.2);
  assert(wakeClock.some(m=>Math.abs(m.clockRock)>.08),'the alarm should visibly rock during waking');
  assert(motion.filter(m=>m.alarmAge>3.3).every(m=>Math.abs(m.clockRock)<.001),'the alarm must settle');
  assert(motion.filter(m=>m.beat==='waking'||m.beat==='lap').every(m=>m.hearthFlame===0&&m.hearthEmbers===0),'morning must not relight the hearth');
  fs.writeFileSync(prefix+'-motion.json',JSON.stringify(motion));
  fs.writeFileSync(prefix+'.json',JSON.stringify({touch,adversarial,liftSeconds,heightParity,result,markers,errors},null,2));
  console.log(JSON.stringify({touch,liftSeconds,heightParity,result,errors}));
} finally {
  try {await finishRecording?.();} finally {await close();}
}
