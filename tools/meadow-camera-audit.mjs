// Read a TRACE=1 meadow-echoes-check capture; this checks continuity and framing, not cinematic quality.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const path=process.argv[2];
if(!path)throw new Error('Supply the audit-camera.jsonl capture');
const rows=fs.readFileSync(path,'utf8').trim().split('\n').map(JSON.parse);
let label='',checked=0,margin=1,departureBack=0,seenPond=false;
const phases=new Set();
for(const row of rows) {
  if(row.at)label=row.at;
  const [chapter,beat,piano,song]=label.split('/');
  if(chapter!=='meadow')continue;
  if(beat==='pond')seenPond=true;
  if(seenPond||piano!=='done'||song==='ahead'||row.t<2)continue;
  if(!['walk','crest','down'].includes(beat))continue;
  phases.add(song);checked++;
  for(const point of [row.head,row.feet,...(song!=='done'?[row.bird]:[])]) {
    const space=Math.min(point[0],1-point[0],point[1],1-point[1]);
    margin=Math.min(margin,space);
    assert(space>.012&&point[2]<1,`Character cropped at ${row.t.toFixed(2)}s ${label}: ${point}`);
  }
  if(beat==='walk'&&song==='done')departureBack=Math.max(departureBack,Math.hypot(...row.eye.map((x,i)=>x-row.child[i])));
}
assert(checked>3000&&phases.has('play')&&phases.has('listen')&&seenPond,'Capture must cover the encounter through entry to the pond');
assert(departureBack<32,`The flower departure retreated to ${departureBack.toFixed(1)}m before the crest`);
console.log(JSON.stringify({pass:true,frames:checked,characterMargin:+margin.toFixed(3),departureDistance:+departureBack.toFixed(2)}));
