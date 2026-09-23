import { tuning } from '../tuning';
import { ALONE, Sliced, slices, type Pace } from './sliced';

/** The horn's breath and diffuse field. `diffuse` is analysed ahead of time and serves one call. */
export interface FoghornParts { impulse: AudioBuffer; air: AudioBuffer; diffuse: ConvolverNode | null }

/** Seeded, so parts prepared ahead of the storm are identical to a call's own. */
export function* foghornParts(ctx: BaseAudioContext): Generator<Pace, FoghornParts> {
  const t=tuning.audio.foghorn;
  // Independent stereo channels have no discrete taps or repeated horn calls.
  const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*t.diffuseSeconds),ctx.sampleRate);
  for(let ch=0;ch<2;ch++){
    let seed=1831+ch*3571,power=0;const data=impulse.getChannelData(ch);
    for(const [from,to] of slices(data.length)){
      for(let i=from;i<to;i++){
        const time=i/ctx.sampleRate-t.predelay;
        seed=Math.imul(seed,1664525)+1013904223|0;
        const envelope=time<=0?0:Math.min(1,time/.22)*Math.exp(-time/1.25)*Math.min(1,(data.length-i)/(.65*ctx.sampleRate));
        data[i]=((seed>>>0)/2147483648-1)*envelope;power+=data[i]*data[i];
      }
      yield;
    }
    const scale=1/Math.sqrt(power);
    for(const [from,to] of slices(data.length)){for(let i=from;i<to;i++)data[i]*=scale;yield;}
  }
  const air=ctx.createBuffer(1,Math.ceil((t.duration+.1)*ctx.sampleRate),ctx.sampleRate);
  let seed=7919;const data=air.getChannelData(0);
  for(const [from,to] of slices(data.length)){
    for(let i=from;i<to;i++){seed=Math.imul(seed,1664525)+1013904223|0;data[i]=(seed>>>0)/2147483648-1;}
    yield;
  }
  yield ALONE;
  return {impulse,air,diffuse:diffuseField(ctx,impulse)};
}

function diffuseField(ctx: BaseAudioContext, impulse: AudioBuffer): ConvolverNode {
  const diffuse=ctx.createConvolver();diffuse.normalize=false;diffuse.buffer=impulse;
  return diffuse;
}

/** Approved distant ship call. Its generated diffuse field drains before all local nodes disconnect. */
export function playFoghorn(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, at = ctx.currentTime,
  parts = new Sliced(foghornParts(ctx)).finish()) {
  const t=tuning.audio.foghorn,end=at+t.duration;
  const pan=ctx.createStereoPanner();pan.pan.value=t.pan;
  const direct=ctx.createGain();direct.gain.value=t.dryLevel;pan.connect(direct).connect(dry);
  const send=ctx.createGain();send.gain.value=t.reverbSend;pan.connect(send).connect(wet);
  // A separate, slowly building diffuse field replaces the close source plus short room reverb.
  const diffuse=parts.diffuse??diffuseField(ctx,parts.impulse);parts.diffuse=null;
  const diffuseGain=ctx.createGain();diffuseGain.gain.value=t.diffuseLevel;
  const diffuseFilter=ctx.createBiquadFilter();diffuseFilter.type='lowpass';diffuseFilter.frequency.value=850;diffuseFilter.Q.value=.5;
  diffuse.connect(diffuseFilter).connect(diffuseGain).connect(dry);
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.6;
  filter.frequency.setValueAtTime(500,at);filter.frequency.linearRampToValueAtTime(1000,at+1.3);
  filter.frequency.setValueAtTime(1000,at+t.hold);filter.frequency.linearRampToValueAtTime(450,end);
  const lowCut=ctx.createBiquadFilter();lowCut.type='highpass';lowCut.frequency.value=65;lowCut.Q.value=.55;
  filter.connect(lowCut).connect(pan);lowCut.connect(diffuse);
  const env=ctx.createGain();env.connect(filter);env.gain.setValueAtTime(0,at);
  env.gain.setValueCurveAtTime(new Float32Array([0,.038,.146,.309,.5,.691,.854,.962,1]).map(v=>v*t.level),at,t.attack);
  env.gain.linearRampToValueAtTime(t.level*.96,at+1.8);
  env.gain.linearRampToValueAtTime(t.level*.9,at+t.hold);
  env.gain.exponentialRampToValueAtTime(t.level*.035,end-.45);env.gain.linearRampToValueAtTime(0,end);
  const sources=new Set<AudioScheduledSourceNode>(),localNodes=[lowCut,direct,diffuse,diffuseGain,diffuseFilter];let left=t.partials.length+2;
  const track=(source: AudioScheduledSourceNode,gain: GainNode,stop=end+.02)=>{
    sources.add(source);source.start(at);source.stop(stop);
    source.onended=()=>{sources.delete(source);source.disconnect();gain.disconnect();
      if(--left===0){env.disconnect();filter.disconnect();pan.disconnect();send.disconnect();
        for(const node of localNodes)node.disconnect();}};
  };
  // A silent audio-clock marker keeps the diffuse tail connected until it has fully drained.
  const tail=ctx.createConstantSource(),silent=ctx.createGain();silent.gain.value=0;
  tail.connect(silent).connect(dry);track(tail,silent,end+t.diffuseSeconds+.05);
  for(const [ratio,level] of t.partials){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.frequency.value=440*2**((t.midi-69)/12)*ratio;
    // Pressure builds into a held brass/reed tone, then relaxes as the call ends.
    osc.detune.setValueAtTime(-18,at);osc.detune.linearRampToValueAtTime(0,at+.8);
    osc.detune.setValueAtTime(0,at+t.hold);osc.detune.linearRampToValueAtTime(-22,end);
    gain.gain.value=level;osc.connect(gain).connect(env);track(osc,gain);
  }
  // Restrained air texture inside the same envelope; no separate hiss or impact.
  const air=ctx.createBufferSource();air.buffer=parts.air;
  const breath=ctx.createBiquadFilter();breath.type='bandpass';breath.frequency.value=780;breath.Q.value=.65;
  const airGain=ctx.createGain();airGain.gain.value=.18;
  air.connect(breath).connect(airGain).connect(env);localNodes.push(breath);track(air,airGain);
  return {sources,end};
}
