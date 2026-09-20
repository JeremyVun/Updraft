// Real GPU camera sequence, with the house visible before any fold opens.
// Usage: node tools/ending-check.mjs /tmp/updraft-ending; W/H selects one viewport, otherwise checks desktop + phone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix=process.argv[2]??'/tmp/updraft-ending';
const width=Number(process.env.W??1600),height=Number(process.env.H??900);
const {browser,close}=await openBrowser();
try {
 for(const [w,h] of process.env.W?[[width,height]]:[[1600,900],[390,844]]) {
 const label=`${prefix}-${w}x${h}`;
 const page=await browser.newPage({viewport:{width:w,height:h},recordVideo:{dir:`${prefix}-video`,size:{width:w,height:h}}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot=1&chapter=summit`);
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
 await page.evaluate(()=>{const g=__game;g.story.current.skipToDrawing();g.story.current.beat='gone';g.story.current.frame();g.rig.cut(g.story.current.shot);g.story.current.beat='crest';g.story.current.frame();});
 const marks=[['house',()=>__game.story.current.beat==='brow'],['plane',()=>__game.story.current.beat==='unfold'],['wings',()=>__game.story.current.beat==='unfold'&&__game.story.current.cast.drawing.open>.28],['opening',()=>__game.story.current.beat==='unfold'&&__game.story.current.cast.drawing.open>.7],['recognition',()=>__game.story.current.recognisedAt>=0],['held',()=>__game.story.current.recognisedAt>=0&&__game.story.current.now-__game.story.current.recognisedAt>1.5],['release',()=>__game.story.current.beat==='release']];
 const results=[];
 for(const [name,condition] of marks){
  await page.waitForFunction(condition,null,{timeout:60000});
  await page.screenshot({path:`${label}-${name}.png`});
  results.push(await page.evaluate(name=>{const m=__game.story.current,d=m.cast.drawing;return {name,beat:m.beat,time:m.now,open:d.open,drawn:d.drawn,house:m.houseInFrame,paper:m.paperInFrame};},name));
  console.log(`${label}-${name}.png`);
 }
 assert.equal(errors.length,0,errors.join('\n'));
 const parity=await page.evaluate(()=>__stats.heightParity);
 assert(parity<.03,`terrain CPU/GPU mismatch: ${parity}`);
 console.log(`height parity ${parity}`);
 fs.writeFileSync(`${label}.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
 await page.close();
 await page.video().saveAs(`${label}.webm`);
 }
} finally {await close();}
