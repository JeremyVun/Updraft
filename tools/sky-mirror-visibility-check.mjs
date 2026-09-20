// Home suppresses only the sky mirror's surface appearance; earlier rooms render the legacy water identically.
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
   const g=__game,mat=g.water.mesh.material,source=mat.fragmentShader;
   // Both renders use the same camera, geometry, uniforms and simulation instant. Only the fragment
   // expression differs, giving a pixel comparison against the water before this change.
   g.renderer.render(g.scene,g.rig.camera);
   const current=g.renderer.domElement.toDataURL();
   mat.fragmentShader=source.replace('mirrorWater(xz) * uSkyMirrorAppearance','mirrorWater(xz)');
   mat.needsUpdate=true;g.renderer.render(g.scene,g.rig.camera);
   const legacy=g.renderer.domElement.toDataURL();
   mat.fragmentShader=source;mat.needsUpdate=true;
   return {chapter:g.story.name,amount:mat.uniforms.uSkyMirrorAppearance.value,identical:current===legacy};
  });
  assert.equal(result.amount,chapter==='summit'?0:1,`${chapter}: wrong appearance weight`);
  assert.equal(result.identical,chapter!=='summit',`${chapter}: unexpected difference from legacy water`);
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({...result,width,height});console.log(results.at(-1));
  await page.close();
 }
 fs.writeFileSync(`${prefix}.json`,JSON.stringify(results,null,2));
}finally{await close();}
