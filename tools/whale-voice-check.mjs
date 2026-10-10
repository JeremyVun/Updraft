// Production whale calls through WorldFoley and the shared audio output; no GPU.
// MUTATE=thin / motor prove the speaker-band / rapid-pulsing guards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.env.OUT ?? '/tmp/updraft-whale-voice';
const { browser, page } = await audioPage();
try {
  if (process.env.MUTATE === 'thin') await page.route('**/src/audio/whale-voice.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert(source.includes('const PARTIALS ='));
    await route.fulfill({ response, body: source.replace(/const PARTIALS = [^;]+;/,
      'const PARTIALS = [[0.04, 0.08, 0.04]];') });
  });
  if (process.env.MUTATE === 'motor') await page.route('**/src/audio/whale-voice.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert(source.includes('sum.connect(muffle)'));
    await route.fulfill({ response, body: source.replace('sum.connect(muffle)', `
      const motor = keep(ctx.createOscillator()), depth = keep(ctx.createGain()), gate = keep(ctx.createGain());
      motor.frequency.value = 18; depth.gain.value = .3; gate.gain.value = .65;
      motor.connect(depth).connect(gate.gain); oscillators.push(motor); sum.connect(gate).connect(muffle)`)});
  });
  const report = [];
  const spacing=await page.evaluate(async()=>{
    const {callLength}=await import('/src/audio/whale-voice.ts');
    const {SONG_AT,GOODBYE_AT}=await import('/src/fx/sealife/sleeper.ts');
    return GOODBYE_AT-SONG_AT-callLength('whale-song');
  });
  assert(spacing>=.05,'the freed song finishes before the flipper goodbye begins');
  for (const kind of ['whale-moan', 'whale-near', 'whale-song', 'whale-goodbye', 'whale-deep', 'whale-greet', 'whale-echo']) {
    const r = await page.evaluate(async kind => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { Foley } = await import('/src/audio/foley.ts');
      const { WorldFoley } = await import('/src/audio/world-foley.ts');
      const { ctx, sound } = offlineSound(14);
      await sound.ready;
      sound.master.gain.cancelScheduledValues(0);
      sound.master.gain.setValueAtTime(0.9, 0);
      const foley = new Foley(); foley.setOutput(sound.output);
      const camera = new THREE.PerspectiveCamera();
      camera.updateMatrixWorld();
      const world = new WorldFoley(foley, camera), at = new THREE.Vector3(0, 0, kind==='whale-moan'?-165:-40);
      if(kind==='whale-greet')world.net('whale-call',at,1);
      else if(kind==='whale-echo')world.farCall(at);
      else world.whale(kind,at);
      const buffer = await ctx.startRendering();
      const speaker = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
      const source = speaker.createBufferSource(); source.buffer = buffer;
      const highpass = speaker.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 180; highpass.Q.value = Math.SQRT1_2;
      source.connect(highpass).connect(speaker.destination); source.start();
      const band = encodeAudio(await speaker.startRendering());
      const envelope = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
      const signal = envelope.createBufferSource(); signal.buffer = buffer;
      const rectify = envelope.createWaveShaper();
      rectify.curve = Float32Array.from({length:4097}, (_,i) => Math.abs(i/2048-1));
      const high = envelope.createBiquadFilter(); high.type='highpass'; high.frequency.value=5; high.Q.value=Math.SQRT1_2;
      const low = [envelope.createBiquadFilter(),envelope.createBiquadFilter()];
      for(const f of low){f.type='lowpass';f.frequency.value=30;f.Q.value=Math.SQRT1_2;}
      signal.connect(rectify).connect(high).connect(low[0]).connect(low[1]).connect(envelope.destination);signal.start();
      const pulse = (await envelope.startRendering()).getChannelData(0);
      let pulsePower=0,power=0;
      const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
      for(let i=0;i<pulse.length;i++){pulsePower+=pulse[i]**2;power+=((left[i]+right[i])*.5)**2;}
      return { ...encodeAudio(buffer), speakerRms: band.rmsDbFS, modulation:Math.sqrt(pulsePower/power) };
    }, kind);
    fs.writeFileSync(`${out}-${kind}.wav`, wav(Buffer.from(r.pcm, 'base64')));
    delete r.pcm; report.push({ kind, ...r });
  }
  fs.writeFileSync(`${out}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  for (const r of report) {
    assert.equal(r.clipped, 0, `${r.kind} clips`);
    assert(r.peakDbFS > (r.kind==='whale-echo'?-52:-30) && r.peakDbFS < -12, `${r.kind} retains an audible, controlled level`);
    assert(r.modulation < .045, `${r.kind} contains rapid engine-like pulsing (${r.modulation})`);
  }
  assert(report[0].speakerRms > -33, 'the distant first moan must retain body above 180 Hz for small speakers');
} finally {
  await browser.close();
}
