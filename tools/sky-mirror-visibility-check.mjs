// The sea starts blue, the mirror develops on arrival, and Home excludes the distant mirror region.
// BASE selects a built preview. Uses the shared GPU lock. Captures in /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-mirror-visibility';
const {browser,close}=await openBrowser();
const results=[];
try {
 for(const [chapter,width,height] of [['mirror',1600,900],['sea',1600,900],['washing',1600,900],['summit',1600,900],['summit',390,844]]) {
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}`);
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  if(chapter==='summit') {
   await page.evaluate(()=>{const g=__game;g.story.current.skipToDrawing(0);g.story.current.frame();g.rig.cut(g.story.current.shot);});
   await page.waitForFunction(()=>__game.story.current.t>1,null,{timeout:30000});
  }
  await page.screenshot({path:`${prefix}-${chapter}-${width}.png`});
  const result=await page.evaluate(()=>{
   const g=__game,mat=g.water.mesh.material;
   // The draw scope has ended, but the shader retains the journey's room pair.
   // Changing only the mirror appearance must have no effect once Home excludes that room.
   g.renderer.render(g.scene,g.rig.camera);
   const current=g.renderer.domElement.toDataURL(), amount=mat.uniforms.uSkyMirrorAppearance.value;
   mat.uniforms.uSkyMirrorAppearance.value=1-amount;
   g.renderer.render(g.scene,g.rig.camera);
   const opposite=g.renderer.domElement.toDataURL();
   mat.uniforms.uSkyMirrorAppearance.value=amount;
   return {chapter:g.story.name,amount,identical:current===opposite,rooms:mat.uniforms.uJourneyRooms.value.toArray()};
  });
  assert.equal(result.amount,chapter==='summit'||chapter==='sea'?0:1,`${chapter}: wrong appearance weight`);
  if(chapter==='summit')assert(result.identical,'Home excludes the mirror even when its appearance is forced on');
  if(chapter==='mirror')assert(!result.identical,'The active mirror contributes its reflected surface');
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({...result,width,height});console.log(results.at(-1));
  await page.close();
 }
 fs.writeFileSync(`${prefix}.json`,JSON.stringify(results,null,2));
}finally{await close();}
