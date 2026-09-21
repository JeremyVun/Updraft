// Chronological visual evidence for focused browser checks. Does not change the game state.
import fs from 'node:fs';

export function reviewCapture(page, prefix) {
  fs.mkdirSync(prefix+'-frames',{recursive:true});
  fs.writeFileSync(prefix+'-frames.jsonl','');
  let index=0,busy=false,pending=Promise.resolve();
  const errors=[];
  const timer=setInterval(()=>{
    if(busy)return;
    busy=true;
    pending=(async()=>{
      const s=await page.evaluate(()=>({chapter:__game.story.name,beat:__game.story.current.beat,time:__stats.time}));
      const file=String(index).padStart(5,'0')+'.jpg';
      await page.screenshot({path:prefix+'-frames/'+file,type:'jpeg',quality:75});
      fs.appendFileSync(prefix+'-frames.jsonl',JSON.stringify({index:index++,file,...s})+'\n');
    })().catch(e=>errors.push(e.message)).finally(()=>{busy=false});
  },1000);
  return async()=>{clearInterval(timer);await pending;if(errors.length)throw new Error(errors.join('\n'));};
}
