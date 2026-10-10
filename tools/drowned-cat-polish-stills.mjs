import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const folder=process.argv[2];fs.mkdirSync(folder,{recursive:true});
const {browser,close}=await openBrowser();
try {
  const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(!window.__frozen)cb(t);});});
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=roofs&ratio=1`);
  await page.waitForFunction(()=>window.__ready,null,{timeout:90000});
  await page.evaluate(()=>{window.__frozen=true;});await page.waitForTimeout(100);
  await page.evaluate(async()=>{
    const W=await import('/src/world/drowned-way.ts');
    const {StrandedCat}=await import('/src/story/drowned-cat.ts');
    const {MillCrossing}=await import('/src/world/crossings/mill-crossing.ts');
    const {tuning}=await import('/src/tuning.ts');
    const {atmo}=await import('/src/world/atmosphere.ts');
    const g=__game,c=g.cat, camera=g.rig.camera;
    window.__polish={
      W, case:'', frame:0, rescue:g.story.current.cat,
      setup(kind){
        this.case=kind;this.frame=0;c.visible=true;c.unease=.7;c.look(null);c.curious=null;
        atmo.uniforms.uSeaFogShape.value.w=0;
        if(kind==='bow') {this.rescue.aboard();c.unease=0;}
        if(kind==='roof') {this.rescue.aboard();this.rescue.to('bolting');}
        if(kind==='waiting') {this.rescue.begin();this.rescue.to('waiting');}
        if(kind==='mill') {
          const m=g.village.mill, crossing=new MillCrossing(m,{},g), step=crossing.catWay()[2];
          m.angle=tuning.crossings.mill.rest;m.pose();c.place(step.hop,step.yaw,{frame:step.frame,upright:step.upright,pose:'crouch'});
        }
        if(kind!=='roof')for(let i=0;i<600;i++){if(kind==='waiting')this.rescue.update(1/60,__stats.time+i/60);c.update(1/60);}
      },
      draw(frames){
        for(let i=0;i<frames;i++) {
          this.frame++;
          if(this.case==='roof')this.rescue.update(1/60,__stats.time+this.frame/60);
          if(this.case==='mill'){g.village.mill.angle=tuning.crossings.mill.rest+this.frame/360*1.5;g.village.mill.pose();}
          c.update(1/60);
        }
        const at=c.position.clone().add({x:0,y:.25,z:0}), side=at.clone().set(Math.cos(c.yaw),0,-Math.sin(c.yaw));
        camera.fov=48;camera.updateProjectionMatrix();
        camera.position.copy(at).addScaledVector(side,2.4).add({x:0,y:.6,z:0});
        if(this.case==='mill')camera.position.copy(at).add({x:-1.5,y:.4,z:3});
        if(this.case==='waiting')camera.position.copy(at).addScaledVector(side,4).add({x:0,y:1,z:0});
        camera.lookAt(at);camera.updateMatrixWorld(true);g.post.render(__stats.time+this.frame/60);
        return {frame:this.frame,doing:c.doing,air:c.air,at:c.position.toArray(),step:this.rescue.step};
      }
    };
  });
  for(const kind of ['bow','waiting','roof','mill']) {
    await page.evaluate(k=>__polish.setup(k),kind);
    const count=kind==='roof'?18:kind==='mill'?8:1;
    for(let i=0;i<count;i++) {
      const state=await page.evaluate(f=>__polish.draw(f),kind==='roof'?30:kind==='mill'?40:0);
      await page.screenshot({path:`${folder}/${kind}-${String(i).padStart(2,'0')}.png`});
      fs.appendFileSync(`${folder}/states.jsonl`,JSON.stringify({kind,...state})+'\n');
    }
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(folder);
} finally {await close();}
