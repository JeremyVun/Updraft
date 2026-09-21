// A single distant ship call, for listening approval before runtime integration.
// Reference-informed harmonic balance, generated entirely from oscillators and seeded noise.
// D3 anchors the horn to the storm; its strongest partials sit above the score's bass.
export const foghornProposal = { midi:50, level:.036, pan:.24, attack:1.1, duration:4.6,
  hold:2.65, dryLevel:.22, reverbSend:.35, predelay:.18, diffuseLevel:.8, diffuseSeconds:4.4,
  gatherAt:8, partials:[[1,.8],[2,.72],[3,.6],[4,.85],[5,.3],[6,.4],
    [7,.18],[8,.08],[9,.22],[10,.055],[11,.035],[12,.025]] };

export function foghorn(ctx,dry,wet,at=ctx.currentTime) {
  const t=foghornProposal,end=at+t.duration;
  const pan=ctx.createStereoPanner();pan.pan.value=t.pan;
  const direct=ctx.createGain();direct.gain.value=t.dryLevel;pan.connect(direct).connect(dry);
  const send=ctx.createGain();send.gain.value=t.reverbSend;pan.connect(send).connect(wet);
  // A separate, slowly building diffuse field replaces the close source plus short room reverb.
  // Independent stereo channels have no discrete taps or repeated horn calls.
  const diffuse=ctx.createConvolver();diffuse.normalize=false;
  const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*t.diffuseSeconds),ctx.sampleRate);
  for(let ch=0;ch<2;ch++){
    let seed=1831+ch*3571,power=0;const data=impulse.getChannelData(ch);
    for(let i=0;i<data.length;i++){
      const time=i/ctx.sampleRate-t.predelay;
      seed=Math.imul(seed,1664525)+1013904223|0;
      const envelope=time<=0?0:Math.min(1,time/.22)*Math.exp(-time/1.25)*Math.min(1,(data.length-i)/(.65*ctx.sampleRate));
      data[i]=((seed>>>0)/2147483648-1)*envelope;power+=data[i]*data[i];
    }
    const scale=1/Math.sqrt(power);for(let i=0;i<data.length;i++)data[i]*=scale;
  }
  diffuse.buffer=impulse;
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
  const sources=new Set(),localNodes=[lowCut,direct,diffuse,diffuseGain,diffuseFilter];let left=t.partials.length+2;
  const track=(source,gain,stop=end+.02)=>{
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
  const air=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil((t.duration+.1)*ctx.sampleRate),ctx.sampleRate);
  let seed=7919;const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){seed=Math.imul(seed,1664525)+1013904223|0;data[i]=(seed>>>0)/2147483648-1;}
  air.buffer=buffer;
  const breath=ctx.createBiquadFilter();breath.type='bandpass';breath.frequency.value=780;breath.Q.value=.65;
  const airGain=ctx.createGain();airGain.gain.value=.18;
  air.connect(breath).connect(airGain).connect(env);localNodes.push(breath);track(air,airGain);
  return {sources,end};
}
