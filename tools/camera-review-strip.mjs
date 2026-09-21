// Time-ordered visual evidence from REVIEW=1 playthrough captures. No gameplay manipulation.
// node tools/camera-review-strip.mjs <prefix> <first-index> [count=30] [stride=2]
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const [prefix,first='0',count='30',stride='2']=process.argv.slice(2);
if(!prefix)throw new Error('Supply the playthrough output prefix');
const start=Number(first),requested=Number(count),step=Number(stride);
if(![start,requested,step].every(Number.isInteger)||start<0||requested<1||step<1)throw new Error('Use a nonnegative frame and positive count/stride');
const rows=fs.readFileSync(prefix+'-frames.jsonl','utf8').trim().split('\n').map(s=>JSON.parse(s));
const n=Math.min(requested,Math.floor((rows.at(-1).index-start)/step)+1);
if(n<1)throw new Error(`Frame ${start} is not captured yet`);
const selected=Array.from({length:n},(_,i)=>rows.find(r=>r.index===start+i*step)).filter(Boolean);
if(selected.length!==n)throw new Error(`Need frames through ${start+(n-1)*step}; capture not ready`);
const out=`${prefix}-strip-${String(start).padStart(5,'0')}.jpg`;
const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height',
 '-of','json',prefix+'-frames/'+selected[0].file],{encoding:'utf8'});
if(probe.status!==0)throw new Error(probe.stderr);
const size=JSON.parse(probe.stdout).streams[0],portrait=size.height>size.width;
const columns=portrait?4:5,w=portrait?240:384,h=portrait?520:240;
const filter=`select=lt(n\\,${n*step})*not(mod(n\\,${step})),scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,tile=${columns}x${Math.ceil(n/columns)}`;
const run=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','1','-start_number',String(start),
 '-i',prefix+'-frames/%05d.jpg','-vf',filter,'-frames:v','1',out],{encoding:'utf8'});
if(run.status!==0)throw new Error(run.stderr);
console.log(JSON.stringify({file:out,columns,requested,captured:n,frames:selected.map(r=>({index:r.index,time:+r.time.toFixed(1),chapter:r.chapter,beat:r.beat}))}));
