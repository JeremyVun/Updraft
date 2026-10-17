export interface ScoreNote { voice: 'pad' | 'soft' | 'pluck'; midi: number; at: number; duration: number; level: number; pan: number }

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Shared meadow and sea instruments; the scores retain their own notes and transitions. */
export function playScoreNote(
  ctx: BaseAudioContext, part: { bus: GainNode; voices: Set<OscillatorNode> },
  note: ScoreNote, at: number, onEnded: () => void,
): void {
  const pluck = note.voice === 'pluck', pad = note.voice === 'pad';
  const pan = ctx.createStereoPanner(); pan.pan.value = note.pan; pan.connect(part.bus);
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = pluck ? 0.45 : 0.35;
  filter.frequency.setValueAtTime(pluck ? 3200 : pad ? 1000 : 1600, at);
  if (pluck) filter.frequency.exponentialRampToValueAtTime(900, at + 0.35);
  filter.connect(pan);
  const release = pad ? 2.4 : 2.2;
  const envelope = pluck ? null : ctx.createGain();
  if (envelope) {
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(note.level, at + (pad ? 1.8 : 1.4));
    envelope.gain.setValueAtTime(note.level, at + note.duration);
    envelope.gain.exponentialRampToValueAtTime(0.00001, at + note.duration + release);
    envelope.connect(filter);
  }
  const partials: [number, number, OscillatorType, number][] = pluck
    ? [[1, 1, 'sine', 0], [2, 0.24, 'sine', 0], [3, 0.07, 'sine', 0], [4.015, 0.025, 'sine', 0]]
    : pad ? [[1, 0.65, 'triangle', -3], [1, 0.35, 'sine', 3]]
    : [[1, 1, 'sine', 0], [2, 0.08, 'sine', 0], [3, 0.014, 'sine', 0]];
  let remaining = partials.length;
  for (const [ratio, amplitude, type, detune] of partials) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.value = hz(note.midi) * ratio; osc.detune.value = detune;
    if (pluck) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(note.level * amplitude, at + 0.009);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.00002, note.level * amplitude * 0.35), at + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.00001, at + note.duration / Math.sqrt(ratio));
    } else gain.gain.value = amplitude;
    osc.connect(gain).connect(envelope ?? filter);
    part.voices.add(osc);
    osc.onended = () => {
      osc.disconnect(); gain.disconnect(); part.voices.delete(osc);
      if (--remaining === 0) { envelope?.disconnect(); filter.disconnect(); pan.disconnect(); }
      onEnded();
    };
    osc.start(at); osc.stop(at + note.duration + (pluck ? 0.05 : release + 0.1));
  }
}
