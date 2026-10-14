import assert from 'node:assert/strict';
import fs from 'node:fs';
import {audioPage,wav} from './lib/audio-render.mjs';

const {browser,page}=await audioPage();
try {
  const result=await page.evaluate(async()=>{
    const {meadowBreath}=await import('/src/audio/meadow-breath.ts');
    const ctx=new OfflineAudioContext(2,24000*7,24000);
    const bus=ctx.createGain(),reverb=ctx.createGain();
    bus.connect(ctx.destination);
    const out={ctx,bus,reverb};
    for(const midi of [62,64,66,69,71]) meadowBreath(out,midi,(midi-66)/8,.6);
    const rendered=await ctx.startRendering();
    let tail=0,early=0;
    for(const channel of [0,1]) {
      const a=rendered.getChannelData(channel);
      for(let i=24000*3;i<a.length;i++)tail=Math.max(tail,Math.abs(a[i]));
      for(let i=0;i<24000*.1;i++)early=Math.max(early,Math.abs(a[i]));
    }
    return {...encodeAudio(rendered),tail,early};
  });
  assert.equal(result.clipped,0,'overlapping answers must not clip');
  assert(result.peakDbFS>-28&&result.peakDbFS<-8,'foreground voice must have usable headroom');
  assert.equal(result.tail,0,'finished voices must fall silent');
  assert(result.early>0,'voice must speak promptly');
  fs.writeFileSync('/tmp/updraft-meadow-breath.wav',wav(Buffer.from(result.pcm,'base64')));
  delete result.pcm;
  console.log('PASS: procedural voice attack, overlap headroom and silent tail.',result);
} finally {await browser.close();}
