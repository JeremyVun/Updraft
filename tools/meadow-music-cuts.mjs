// Cuts the meadow's recorded music from its source takes, per `src/audio/meadow-cuts.ts`, into `assets/music/` and
// writes the measurements the game plays them by to `src/audio/meadow-cuts-measured.ts`: loudness and gain to the room
// reference, where each call's flute begins and ends, each answer's note onsets with the melody note of each (her
// hands play along to them) and its overall rise or fall, where the finale's colour front
// starts, the decay the answers ring out at, and where the warm bed can go over into its close.
// SOURCES=<dir> finds the takes (default: this checkout's assets/music). Needs ffmpeg with libopus.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { MEADOW_CUTS, MEADOW_SOURCES, MEADOW_REFERENCE_LUFS } from '../src/audio/meadow-cuts.ts';

const root = path.resolve(import.meta.dirname, '..');
const sources = path.resolve(process.env.SOURCES ?? path.join(root, 'assets/music'));
const RATE = 48000;
const EDGE = 0.02;
/** Silence between packed items, so a decoder's few samples of offset never reach a neighbour. */
const GAP = 0.25;
/** The top voice holds through inner notes struck within this long of it. */
const TOP_HOLD = 0.3;
/** Semitones of overall rise or fall that tilt the guide fully. */
const FULL_TILT = 12;
/** Kept clear before the next phrase's attack, so none of it reaches a cut that ends there (codec smear is under 20 ms). */
const HANDOVER = 0.06;
/** A ring-out's analysis frame, which is also its crossfade out of the take, and the hop over which each partial's phase turns. */
const RING = 16384, RING_HOP = 480;
/** Partials this far under the loudest are left to the noise under them; at most this many are carried. */
const PARTIAL_FLOOR = 1e-3, MAX_PARTIALS = 160;
/** A ring-out's last second, already at the take's silence, fades to nothing. */
const RING_END = 1;
/** A notch's Q: about 11 Hz wide at 215 Hz, clear of the semitones either side. */
const NOTCH_Q = 20;
/** A warm-bed phrase end goes over into the close when its chord and level match those leading into the close this well. */
const SEAM_CHORD = 0.9, SEAM_LEAD = 0.85, SEAM_LEVEL = 3;

const run = (args, input) => {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 30 });
  if (out.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${out.stderr}`);
  return out;
};
const interleave = ([l, r]) => { const out = new Float32Array(l.length * 2); for (let i = 0; i < l.length; i++) { out[2 * i] = l[i]; out[2 * i + 1] = r[i]; } return Buffer.from(out.buffer); };
const split = buffer => {
  const data = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  const l = new Float32Array(data.length / 2), r = new Float32Array(data.length / 2);
  for (let i = 0; i < l.length; i++) { l[i] = data[2 * i]; r[i] = data[2 * i + 1]; }
  return [l, r];
};
const decoded = new Map();
function decode(source) {
  if (!decoded.has(source)) {
    const file = path.join(sources, MEADOW_SOURCES[source]);
    if (!fs.existsSync(file)) throw new Error(`Missing source ${file}; set SOURCES to the folder holding the takes`);
    decoded.set(source, split(run(['-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-']).stdout));
  }
  return decoded.get(source);
}
const length = audio => audio[0].length;
const slice = (audio, from, to) => audio.map(ch => ch.slice(Math.max(0, Math.round(from * RATE)), Math.min(ch.length, Math.round(to * RATE))));
const silence = seconds => [new Float32Array(Math.round(seconds * RATE)), new Float32Array(Math.round(seconds * RATE))];
const concat = parts => {
  const total = parts.reduce((n, p) => n + length(p), 0), out = [new Float32Array(total), new Float32Array(total)];
  let at = 0;
  for (const p of parts) { out[0].set(p[0], at); out[1].set(p[1], at); at += length(p); }
  return out;
};
/** Raised-cosine fades at both ends. */
function fade(audio, fadeIn, fadeOut) {
  const n = length(audio), a = Math.round(fadeIn * RATE), b = Math.round(fadeOut * RATE);
  for (const ch of audio) for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < a) g *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
    if (i >= n - b) g *= 0.5 - 0.5 * Math.cos(Math.PI * (n - 1 - i) / b);
    ch[i] *= g;
  }
  return audio;
}
/** Varispeed: pitch and tempo move together, which keeps the instrument's own sound. */
function retune(audio, cents) {
  if (!cents) return audio;
  const ratio = 2 ** (cents / 1200);
  return split(run(['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-af',
    `asetrate=${RATE * ratio},aresample=${RATE}:filter_size=96:cutoff=0.97`, '-f', 'f32le', '-'], interleave(audio)).stdout);
}
function lufs(audio) {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-',
    '-af', 'ebur128', '-f', 'null', '-'], { input: interleave(audio), maxBuffer: 1 << 30 });
  const found = /Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(out.stderr.toString());
  if (!found) throw new Error('No loudness measured');
  return Number(found[1]);
}
const mono = audio => { const out = new Float32Array(length(audio)); for (let i = 0; i < out.length; i++) out[i] = (audio[0][i] + audio[1][i]) / 2; return out; };

function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = (inverse ? 2 : -2) * Math.PI / size;
    for (let start = 0; start < n; start += size) for (let k = 0; k < size / 2; k++) {
      const wr = Math.cos(step * k), wi = Math.sin(step * k), a = start + k, b = a + size / 2;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const hann = n => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
function spectrum(signal, start, n, window) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { const s = start + i; re[i] = s >= 0 && s < signal.length ? signal[s] * window[i] : 0; }
  fft(re, im);
  return { re, im };
}
const magnitude = ({ re, im }) => Float64Array.from({ length: re.length / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k]));
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const noteName = midi => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const rms = (signal, from, to) => { let s = 0; for (let i = from; i < to; i++) s += signal[i] * signal[i]; return Math.sqrt(s / Math.max(1, to - from)); };
const db = v => 20 * Math.log10(v + 1e-12);

/** First rise and last fall of a phrase, by its 20 ms level against its loudest. */
function extent(signal) {
  const hop = Math.round(0.02 * RATE), levels = [];
  for (let i = 0; i + hop <= signal.length; i += hop) levels.push(db(rms(signal, i, i + hop)));
  const peak = Math.max(...levels);
  const attack = levels.findIndex(v => v > peak - 30) * 0.02;
  let end = levels.length - 1;
  while (end > 0 && levels[end] < peak - 40) end--;
  return { attack, end: Math.min(signal.length / RATE, (end + 1) * 0.02 + 0.05) };
}

/** Note onsets by spectral flux, each with the top note it newly sounds (harmonics of a lower new note set aside). */
function onsets(signal) {
  const N = 2048, H = 240, window = hann(N), bins = [];
  const lo = Math.ceil(150 * N / RATE), hi = Math.floor(5000 * N / RATE);
  for (let start = 0; start + N <= signal.length; start += H) {
    const m = magnitude(spectrum(signal, start, N, window));
    bins.push(Float64Array.from({ length: hi - lo }, (_, k) => Math.log1p(m[lo + k] * 100)));
  }
  const flux = bins.map((b, i) => i === 0 ? 0 : b.reduce((s, v, k) => s + Math.max(0, v - bins[i - 1][k]), 0));
  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const found = [];
  for (let i = 2; i < flux.length - 2; i++) {
    const near = flux.slice(Math.max(0, i - 50), i + 50).sort((a, b) => a - b), median = near[near.length >> 1];
    if (flux[i] === Math.max(...flux.slice(Math.max(0, i - 8), i + 9)) && flux[i] > median * 1.5 + mean * 0.5) {
      found.push({ at: (i * H + N / 2) / RATE - 0.015, strength: flux[i] });
    }
  }
  const M = 8192, wide = hann(M);
  return found.map(o => {
    const i0 = Math.round(o.at * RATE);
    const post = magnitude(spectrum(signal, i0 + 240, M, wide)), pre = magnitude(spectrum(signal, i0 - M - 240, M, wide));
    const energy = new Map();
    for (let m = 36; m < 96; m++) {
      const k = hz(m) * M / RATE;
      let e = 0;
      for (let b = Math.floor(k) - 1; b <= Math.floor(k) + 2; b++) e = Math.max(e, post[b] - pre[b]);
      energy.set(m, Math.max(0, e));
    }
    const top = Math.max(...energy.values());
    const kept = [];
    for (let m = 36; m < 96; m++) {
      const e = energy.get(m);
      if (e <= top * 0.25 || e < (energy.get(m - 1) ?? 0) || e < (energy.get(m + 1) ?? 0)) continue;
      if (kept.some(k => [12, 19, 24].includes(m - k) && energy.get(k) > e * 0.6)) continue;
      kept.push(m);
    }
    return { ...o, midi: Math.max(...kept), notes: kept };
  });
}

/** The flute's pitch, frame by frame: the strongest harmonic series, raised an octave where its fundamental is weak. */
function melodyNotes(signal) {
  const M = 4096, H = 480, window = hann(M), frames = [];
  for (let c = M / 2; c + M / 2 < signal.length; c += H) {
    const level = db(rms(signal, c - M / 2, c + M / 2));
    const m = magnitude(spectrum(signal, c - M / 2, M, window));
    const at = midi => { const k = hz(midi) * M / RATE; return Math.max(m[Math.floor(k) - 1], m[Math.floor(k)], m[Math.floor(k) + 1]); };
    let best = 52, score = -1;
    for (let midi = 52; midi < 100; midi++) {
      const s = at(midi) + 0.5 * at(midi + 12) + 0.3 * at(midi + 19);
      if (s > score) { score = s; best = midi; }
    }
    if (at(best + 12) > 1.5 * at(best)) best += 12;
    frames.push({ t: c / RATE, level, midi: best });
  }
  const peak = Math.max(...frames.map(f => f.level)), notes = [];
  for (const f of frames) {
    const last = notes[notes.length - 1];
    if (f.level < peak - 30) { if (last && last.midi !== null) notes.push({ start: f.t, end: f.t, midi: null, level: -Infinity }); continue; }
    if (last && last.midi === f.midi) { last.end = f.t; last.level = Math.max(last.level, f.level); }
    else notes.push({ start: f.t, end: f.t, midi: f.midi, level: f.level });
  }
  return { peak, notes: notes.filter(n => n.midi !== null && n.end - n.start >= 0.08) };
}

/** The top of the opening arpeggio: the first strong note after which the line falls again. */
function highArrival(signal) {
  const { peak, notes } = melodyNotes(signal);
  const strong = notes.filter(n => n.level > peak - 20);
  for (let i = 1; i < strong.length - 1; i++) {
    if (strong[i].midi > strong[0].midi && strong[i + 1].midi < strong[i].midi) return { at: strong[i].start, midi: strong[i].midi, line: strong.slice(0, i + 2) };
  }
  throw new Error('The finale has no rising arpeggio to arrive on');
}

/**
 * The melody's overall rise or fall, −1..1: the top voice (held through inner notes, a lone note's spike or dip
 * smoothed by a three-note median) from its first note to the average of its last two.
 */
function rise(found) {
  const held = found.map((o, k) => Math.max(...found.filter((p, j) => j <= k && o.at - p.at <= TOP_HOLD).map(p => p.midi)));
  const top = held.map((m, k) => k === 0 || k === held.length - 1 ? m : [held[k - 1], m, held[k + 1]].sort((a, b) => a - b)[1]);
  const semitones = (top.at(-1) + top.at(-2)) / 2 - top[0];
  return { top, tilt: Math.max(-1, Math.min(1, semitones / FULL_TILT)) };
}

const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places;
const files = new Map();
const pack = (file, audio) => {
  const parts = files.get(file) ?? [];
  const at = parts.reduce((n, p) => n + length(p), 0) / RATE;
  parts.push(audio, silence(GAP));
  files.set(file, parts);
  return { at: round(at, 4), duration: round(length(audio) / RATE, 4) };
};
/** Where a cut that ends at its take's next phrase hands over, in seconds of the cut as retuned. */
const handoverOf = cut => (cut.to - HANDOVER - cut.from) / 2 ** ((cut.cents ?? 0) / 1200);
/** The take up to where the cut leaves it: its end, or just before the next phrase's attack. */
const kept = cut => {
  const to = cut.ringOut || cut.release ? cut.to - HANDOVER : cut.to;
  const filters = [
    ...cut.highpass ? [0.5412, 1.3066].map(q => `highpass=f=${cut.highpass}:width_type=q:width=${q}`) : [],
    ...(cut.notch ?? []).map(hz => `bandreject=f=${hz}:width_type=q:width=${NOTCH_Q}`),
  ];
  if (!filters.length) return retune(slice(decode(cut.source), cut.from, to), cut.cents ?? 0);
  // A second of pre-roll settles the filters before the cut begins.
  const preRoll = Math.min(1, cut.from), audio = slice(decode(cut.source), cut.from - preRoll, to);
  const filtered = split(run(['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-af', filters.join(','), '-f', 'f32le', '-'], interleave(audio)).stdout);
  return retune(filtered.map(ch => ch.slice(Math.round(preRoll * RATE))), cut.cents ?? 0);
};
const rung = new Map();
function cutAudio(cut) {
  if (cut.ringOut) {
    if (!rung.has(cut)) rung.set(cut, ringOut(kept(cut), roomOf(cut.source).decay, silenceOf(cut.source), rung.size + 1));
    return fade(rung.get(cut).map(ch => ch.slice()), EDGE, cut.fadeOut ?? RING_END);
  }
  const audio = kept(cut);
  if (cut.release) ending(audio, cut.release, releaseOf(cut.source, cut.release).shape);
  return fade(audio, EDGE, cut.fadeOut ?? EDGE);
}
const level = audio => { const l = lufs(audio); return { lufs: round(l, 1), gainDb: round(MEADOW_REFERENCE_LUFS - l, 1) }; };
const measured = {}, report = [];

for (const beat of ['walk', 'after']) {
  const { file, cuts: [cut], rest = 0, loop, close } = MEADOW_CUTS[beat], audio = cutAudio(cut);
  const looped = loop ? bakeLoop(audio, cut, loop) : {};
  measured[beat] = { ...level(audio), rest, ...looped, ...pack(file, audio) };
  report.push(`${beat}: ${measured[beat].duration}s ${measured[beat].lufs} LUFS → ${measured[beat].gainDb} dB`
    + (loop ? `, loops ${looped.loopEnd}s → ${looped.loopStart}s in the file` : ''));
  if (close) {
    const seams = closeSeams(cut, loop, close), lead = loop.crossfade;
    const tail = fade(slice(decode(cut.source), close.from - lead, close.to), EDGE, close.fadeOut);
    measured[beat] = { ...measured[beat], crossfade: lead, close: { ...pack(file, tail), entry: lead }, seams: seams.map(s => round(s.at, 4)) };
    report.push(`  close: ${cut.source} ${close.from}–${close.to} (${round(length(tail) / RATE - lead, 2)}s), entered from ${seams.length} phrase ends: `
      + seams.map(s => `${round(cut.from + s.at, 2)} (chord ${s.chord.toFixed(2)}, lead ${s.lead.toFixed(2)}, ${s.level.toFixed(1)} dB)`).join(', '));
    const looping = seams.map(s => s.at).filter(at => at >= looped.loopStart);
    const waits = looping.map((at, i) => i ? at - looping[i - 1] : at - looped.loopStart + looped.loopEnd - looping.at(-1));
    report.push(`  longest wait for a phrase end once it loops: ${round(Math.max(...waits), 2)}s`);
  }
}

/**
 * A native loop from the cut's end back to `loop.from` in the source: the last `crossfade` seconds become the cut's
 * own end fading out (equal power) under the source's lead into `loop.from` fading in, so the jump lands mid-phrase
 * on exactly the music it continues. Returns the loop points in seconds of the cut.
 */
function bakeLoop(audio, cut, loop) {
  const source = decode(cut.source), n = Math.round(loop.crossfade * RATE), end = length(audio);
  const lead = Math.round((loop.from - loop.crossfade) * RATE);
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    audio[ch][end - n + i] = audio[ch][end - n + i] * Math.cos(x * Math.PI / 2) + source[ch][lead + i] * Math.sin(x * Math.PI / 2);
  }
  return { loopStart: round((Math.round(loop.from * RATE) - Math.round(cut.from * RATE)) / RATE, 6), loopEnd: round(end / RATE, 6) };
}
/**
 * The take's sound carried on past `audio`'s end, falling `decay` dB a second to `floor` dBFS: its partials and the
 * noise left under them. Each partial's frequency comes from its phase turning over `RING_HOP` in the channels' mid,
 * so both channels keep one pitch and a steady image, and each channel's amplitude and phase from its last `RING`
 * samples. The take crossfades into it over those samples, where it was measured.
 */
function ringOut(audio, decay, floor, seed) {
  const n = RING, window = hann(n), end = length(audio), from = end - n, centre = end - n / 2;
  const total = centre + Math.round((db(rms(mono(audio), from, end)) - floor) / decay * RATE);
  const fall = 10 ** (-decay / 20 / RATE), gainAt = i => 10 ** (-decay * (i - centre) / RATE / 20);
  const voices = partials(mono(audio), end, window);
  let state = seed;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  return audio.map(x => {
    const ring = new Float64Array(total - from), heard = centred(x, end, window);
    for (const { hz, k, wr, wi } of voices) {
      const xr = heard.re[k], xi = heard.im[k], w2 = wr * wr + wi * wi;
      const pr = 2 * (xr * wr + xi * wi) / w2, pi = 2 * (xi * wr - xr * wi) / w2;
      const w = 2 * Math.PI * hz / RATE, c = Math.cos(w) * fall, s = Math.sin(w) * fall, turn = w * (from - centre);
      let re = gainAt(from) * (pr * Math.cos(turn) - pi * Math.sin(turn)), im = gainAt(from) * (pr * Math.sin(turn) + pi * Math.cos(turn));
      for (let i = 0; i < ring.length; i++) {
        ring[i] += re;
        const next = re * c - im * s;
        im = re * s + im * c; re = next;
      }
    }
    const residual = Float64Array.from({ length: n }, (_, i) => x[from + i] - ring[i]);
    const noise = shapedNoise(residual, ring.length, random);
    const out = new Float32Array(total);
    out.set(x.subarray(0, from));
    for (let i = 0; i < ring.length; i++) {
      const into = i < n ? 0.5 - 0.5 * Math.cos(Math.PI * i / n) : 1, tail = ring[i] + noise[i] * gainAt(from + i);
      out[from + i] = (i < n ? x[from + i] * (1 - into) : 0) + tail * into;
    }
    return out;
  });
}

/** The zero-phase spectrum of the window's length of samples before `end`, referred to their centre. */
function centred(x, end, window) {
  const n = window.length, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[(i + n / 2) % n] = x[end - n + i] * window[i];
  fft(re, im);
  return { re, im };
}

/**
 * The partials sounding over the `RING` samples before `end`: each one's frequency, and its bin with the window's
 * response there, so a channel's bin divided by it gives the partial's amplitude and phase at the centre.
 */
function partials(x, end, window) {
  const n = RING, now = centred(x, end, window), before = centred(x, end - RING_HOP, window);
  const mag = k => Math.hypot(now.re[k], now.im[k]), angle = (a, k) => Math.atan2(a.im[k], a.re[k]);
  let top = 0;
  for (let k = 1; k < n / 2; k++) top = Math.max(top, mag(k));
  const found = [];
  for (let k = Math.ceil(40 * n / RATE); k < 10000 * n / RATE; k++) {
    const m = mag(k);
    if (m < top * PARTIAL_FLOOR || m < mag(k - 1) || m <= mag(k + 1) || m < mag(k - 2) || m <= mag(k + 2)) continue;
    const turn = angle(now, k) - angle(before, k) - 2 * Math.PI * k * RING_HOP / n;
    const offset = (turn - 2 * Math.PI * Math.round(turn / (2 * Math.PI))) * n / (2 * Math.PI * RING_HOP);
    if (Math.abs(offset) > 1) continue;
    let wr = 0, wi = 0;
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * offset * (i - n / 2) / n; wr += window[i] * Math.cos(a); wi += window[i] * Math.sin(a); }
    found.push({ m, hz: (k + offset) * RATE / n, k, wr, wi });
  }
  // Two peaks of one beating partial can land on almost one frequency, and would beat on, deeply, for ever: the
  // weaker is left to the noise.
  const distinct = [];
  for (const p of found.sort((a, b) => b.m - a.m)) if (!distinct.some(q => Math.abs(q.hz - p.hz) < 1.5 * RATE / n)) distinct.push(p);
  return distinct.slice(0, MAX_PARTIALS);
}

/** `count` samples of noise with the spectrum and level of `residual`. */
function shapedNoise(residual, count, random) {
  const m = 4096, hop = m / 4, window = hann(m), power = new Float64Array(m / 2 + 1);
  let frames = 0;
  for (let s = 0; s + m <= residual.length; s += hop, frames++) {
    const p = magnitude(spectrum(residual, s, m, window));
    for (let k = 0; k < p.length; k++) power[k] += p[k] * p[k];
  }
  const out = new Float64Array(count + m);
  for (let s = 0; s < count; s += hop) {
    const re = new Float64Array(m), im = new Float64Array(m);
    for (let k = 1; k < m / 2; k++) {
      const a = 2 * Math.PI * random(), v = Math.sqrt(power[k] / frames);
      re[k] = re[m - k] = v * Math.cos(a); im[k] = v * Math.sin(a); im[m - k] = -im[k];
    }
    fft(re, im, true);
    for (let i = 0; i < m; i++) out[s + i] += re[i] * window[i];
  }
  const scale = rms(residual, residual.length / 4, residual.length * 3 / 4) / rms(out, m, Math.max(m + 1, count));
  return out.subarray(0, count).map(v => v * scale);
}

/** How fast the take's sound falls between its phrases, dB a second: from 0.4 s after each ringing cut's last attack to its handover. */
const rooms = new Map();
function roomOf(source) {
  if (!rooms.has(source)) {
    const gaps = Object.values(MEADOW_CUTS).flatMap(beat => beat.cuts).filter(cut => cut.ringOut && cut.source === source).map(cut => {
      const signal = mono(kept(cut)), last = onsets(signal).at(-1).at, hop = Math.round(0.02 * RATE), t = [], v = [];
      for (let i = Math.round((last + 0.4) * RATE); i + hop <= signal.length - 0.05 * RATE; i += hop) { t.push(i / RATE); v.push(db(rms(signal, i, i + hop))); }
      const mt = t.reduce((a, b) => a + b) / t.length, mv = v.reduce((a, b) => a + b) / v.length;
      return -t.reduce((sum, ti, i) => sum + (ti - mt) * (v[i] - mv), 0) / t.reduce((sum, ti) => sum + (ti - mt) ** 2, 0);
    });
    const sorted = [...gaps].sort((a, b) => a - b), mid = sorted.length / 2;
    rooms.set(source, { gaps, decay: sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2 });
  }
  return rooms.get(source);
}

/** The take's silence: its quietest tenth of a second, dBFS. */
function silenceOf(source) {
  const signal = mono(decode(source)), hop = Math.round(0.1 * RATE);
  let quiet = Infinity;
  for (let i = 0; i + hop <= signal.length; i += hop) quiet = Math.min(quiet, db(rms(signal, i, i + hop)));
  return quiet;
}

/**
 * How the take's phrases end into silence: its level over the `seconds` before it falls to within 8 dB of its floor
 * (the median of its 50 ms frames 40 dB or more under its peak), in dB from where that began, the median over every
 * such ending, never rising again.
 */
const releases = new Map();
function releaseOf(source, seconds) {
  const key = `${source} ${seconds}`;
  if (!releases.has(key)) {
    const signal = mono(decode(source)), hop = Math.round(0.05 * RATE), levels = [];
    for (let i = 0; i + hop <= signal.length; i += hop) levels.push(db(rms(signal, i, i + hop)));
    const peak = Math.max(...levels), floor = median(levels.filter(v => v < peak - 40)), steps = Math.round(seconds / 0.05), endings = [];
    for (let i = steps; i + 10 < levels.length; i++) {
      if (levels[i] < floor + 8 && levels[i - 1] >= floor + 8 && levels[i - steps] > floor + 25 && Math.max(...levels.slice(i, i + 10)) < floor + 15) endings.push(i);
    }
    if (endings.length < 3) throw new Error(`${source} has only ${endings.length} phrase endings to learn its release from`);
    const shape = Array.from({ length: steps + 1 }, (_, k) => median(endings.map(i => levels[i - steps + k] - levels[i - steps])));
    for (let k = 1; k < shape.length; k++) shape[k] = Math.min(shape[k], shape[k - 1]);
    releases.set(key, { shape, endings: endings.map(i => i * 0.05) });
  }
  return releases.get(key);
}

/** The cut's last `seconds` shaped by `shape` (dB, evenly spaced from where the ending starts to the cut's end). */
function ending(audio, seconds, shape) {
  const n = length(audio), span = Math.round(seconds * RATE), steps = shape.length - 1;
  for (const ch of audio) for (let i = 0; i < span; i++) {
    const x = i / span * steps, k = Math.min(steps - 1, Math.floor(x));
    ch[n - span + i] *= 10 ** ((shape[k] + (shape[k + 1] - shape[k]) * (x - k)) / 20);
  }
  return audio;
}

/** Whether anything of the next phrase reaches the handover: the level of its last 50 ms against the quarter second before. */
function leak(cut) {
  const signal = mono(kept(cut)), n = signal.length, step = Math.round(0.05 * RATE);
  const rise = db(rms(signal, n - step, n)) - db(rms(signal, n - 6 * step, n - step));
  if (rise > 1.5) throw new Error(`${cut.source} ${cut.from}–${cut.to}: the next phrase reaches the handover (+${rise.toFixed(1)} dB)`);
  return `last 50 ms before the handover ${rise >= 0 ? '+' : ''}${rise.toFixed(1)} dB on the quarter second before`;
}

/** Pitch-class energy (unit length) and level every tenth of a second over `from`–`to` seconds of `signal`. */
function chroma(signal, from, to) {
  const n = 8192, window = hann(n), bins = [];
  for (let k = 1; k < n / 2; k++) { const f = k * RATE / n; if (f > 55 && f < 4000) bins.push([k, ((Math.round(12 * Math.log2(f / 440)) + 69) % 12 + 12) % 12]); }
  const frames = new Map();
  for (let t = round(from, 1); t <= to; t = round(t + 0.1, 1)) {
    const m = magnitude(spectrum(signal, Math.round(t * RATE) - n / 2, n, window)), v = new Float64Array(12);
    let energy = 0;
    for (const [k, pc] of bins) { v[pc] += m[k] * m[k]; energy += m[k] * m[k]; }
    const norm = Math.hypot(...v.map(Math.sqrt)) || 1;
    frames.set(t, { v: v.map(e => Math.sqrt(e) / norm), level: 10 * Math.log10(energy + 1e-20) });
  }
  return frames;
}

/**
 * Where the warm bed can go over into its close: the dips between its phrases whose chord and level over the crossfade
 * before them, and chord over the second before that, match the close's lead; clear of the loop's own crossfade, each
 * brought up to 0.4 s earlier to its best match. Seconds into the cut.
 */
function closeSeams(cut, loop, close) {
  const signal = mono(decode(cut.source)), bed = chroma(signal, cut.from - 1.6, cut.to), into = chroma(signal, close.from - 1.6, close.from + 0.4);
  const frame = (frames, t) => frames.get(round(t, 1));
  const match = (b, offsets) => offsets.reduce((sum, o) => sum + frame(bed, b + o).v.reduce((d, x, i) => d + x * frame(into, close.from + o).v[i], 0), 0) / offsets.length;
  const steps = (from, to) => Array.from({ length: Math.round((to - from) * 10) + 1 }, (_, i) => round(from + i * 0.1, 1));
  const around = steps(-loop.crossfade, 0), lead = steps(-loop.crossfade - 1, -loop.crossfade - 0.1);
  const level = b => around.reduce((sum, o) => sum + Math.abs(frame(bed, b + o).level - frame(into, close.from + o).level), 0) / around.length;
  const times = [...bed.keys()], smooth = times.map((t, i) => (bed.get(times[Math.max(0, i - 1)]).level + bed.get(t).level + bed.get(times[Math.min(times.length - 1, i + 1)]).level) / 3);
  const seams = [];
  for (let i = 15; i < times.length - 15; i++) {
    const near = smooth.slice(i - 7, i + 8), wide = smooth.slice(i - 15, i + 16);
    if (smooth[i] !== Math.min(...near) || Math.max(...wide) - smooth[i] < 5) continue;
    let best = null;
    for (let d = -0.4; d <= 0.001; d += 0.1) {
      const b = round(times[i] + d, 1);
      if (b - cut.from < loop.crossfade + 1 || b > cut.to - loop.crossfade - 0.4) continue;
      const chord = match(b, around);
      if (!best || chord > best.chord) best = { b, chord };
    }
    if (!best) continue;
    const found = { at: best.b - cut.from, chord: best.chord, lead: match(best.b, lead), level: level(best.b) };
    if (found.chord >= SEAM_CHORD && found.lead >= SEAM_LEAD && found.level <= SEAM_LEVEL && !seams.some(s => Math.abs(s.at - found.at) < 1)) seams.push(found);
  }
  return seams;
}

measured.calls = MEADOW_CUTS.calls.cuts.map((cut, i) => {
  const audio = cutAudio(cut), { attack, end } = extent(mono(audio));
  const call = { ...level(audio), attack: round(attack), end: round(end), ...pack(MEADOW_CUTS.calls.file, audio) };
  report.push(`call ${i + 1}: flute ${cut.from}–${cut.to}${cut.cents ? ` (+${cut.cents} cents)` : ''}, ${call.lufs} LUFS → ${call.gainDb} dB, sounds ${call.attack}–${call.end}s`
    + (cut.release ? `; ends over ${cut.release}s as ${releaseOf(cut.source, cut.release).endings.length} of the take's phrases do, ${leak(cut)}` : ''));
  return call;
});
for (const cut of MEADOW_CUTS.calls.cuts.filter(cut => cut.release)) {
  const { shape, endings } = releaseOf(cut.source, cut.release);
  report.push(`  ${cut.source}'s phrase endings (${endings.map(t => round(t, 2)).join(', ')}s), dB every 50 ms: ${shape.map(v => round(v, 1)).join(' ')}`);
}
measured.answers = MEADOW_CUTS.answers.cuts.map((cut, i) => {
  const audio = cutAudio(cut), handover = handoverOf(cut), take = audio.map(ch => ch.slice(0, Math.round(handover * RATE)));
  const found = onsets(mono(take)), shape = rise(found);
  const answer = { ...level(take), end: round(handover), tilt: round(shape.tilt), notes: found.map(o => ({ at: round(o.at), midi: o.midi })),
    ...pack(MEADOW_CUTS.answers.file, audio) };
  const signal = mono(audio), tailFrom = Math.round(handover * RATE);
  const peak = Math.max(...Array.from({ length: Math.floor(tailFrom / 960) }, (_, k) => db(rms(signal, k * 960, k * 960 + 960))));
  const at = s => db(rms(signal, Math.round(s * RATE) - 960, Math.round(s * RATE))) - peak;
  report.push(`answer ${i + 1}: B ${cut.from}–${cut.to}, ${answer.lufs} LUFS → ${answer.gainDb} dB, the take until ${answer.end}s `
    + `(${at(handover).toFixed(1)} dB under its peak), then ${round(answer.duration - handover, 2)}s ringing to ${at(answer.duration - 0.03).toFixed(1)} dB; `
    + `${leak(cut)}; tilt ${answer.tilt}; ` + found.map(o => `${noteName(o.midi)}@${o.at.toFixed(2)}`).join(' '));
  return answer;
});
{
  const room = roomOf('B');
  report.push(`  B's decay between its phrases: ${room.gaps.map(g => round(g, 2)).join(', ')} dB/s; rings out at their median, `
    + `${round(room.decay, 2)} dB/s (RT60 ${round(60 / room.decay, 1)}s), down to its silence at ${round(silenceOf('B'), 1)} dBFS`);
}
{
  const cut = MEADOW_CUTS.finale.cuts[0], audio = cutAudio(cut), signal = mono(audio), { attack, end } = extent(signal);
  const arrival = highArrival(signal);
  const greenAt = MEADOW_CUTS.finale.greenAt !== undefined ? MEADOW_CUTS.finale.greenAt - cut.from : arrival.at;
  measured.finale = { ...level(audio), attack: round(attack), end: round(end), greenAt: round(greenAt), ...pack(MEADOW_CUTS.finale.file, audio) };
  report.push(`finale: flute ${cut.from}–${cut.to}, ${measured.finale.lufs} LUFS → ${measured.finale.gainDb} dB; arpeggio `
    + `${arrival.line.map(n => `${noteName(n.midi)}@${round(cut.from + n.start, 2)}`).join(' ')}; colour front at ${round(cut.from + greenAt, 2)}s`
    + ` (${measured.finale.greenAt}s in)`);
}
const answerTuning = (() => {
  const cents = [];
  for (const cut of MEADOW_CUTS.answers.cuts) cents.push(...partialCents(mono(kept(cut))));
  return median(cents);
})();
for (const [i, cut] of MEADOW_CUTS.calls.cuts.entries()) {
  const raw = median(partialCents(mono(fade(slice(decode(cut.source), cut.from, cut.to), EDGE, EDGE))));
  report.push(`call ${i + 1} tuning ${round(raw, 0)} cents against the answers' ${round(answerTuning, 0)}; set ${cut.cents ?? 0}`);
}
function partialCents(signal) {
  const M = 16384, window = hann(M), out = [];
  for (let start = 0; start + M <= signal.length; start += Math.round(0.25 * RATE)) {
    if (rms(signal, start, start + M) < 0.01) continue;
    const m = magnitude(spectrum(signal, start, M, window));
    const lo = Math.ceil(180 * M / RATE), hi = Math.floor(2500 * M / RATE);
    let top = 0;
    for (let k = lo; k < hi; k++) top = Math.max(top, m[k]);
    for (let k = lo; k < hi; k++) {
      if (m[k] < top * 0.3 || m[k] < m[k - 1] || m[k] < m[k + 1] || m[k] < m[k - 2] || m[k] < m[k + 2]) continue;
      const a = Math.log(m[k - 1]), b = Math.log(m[k]), c = Math.log(m[k + 1]);
      const midi = 69 + 12 * Math.log2((k + 0.5 * (a - c) / (a - 2 * b + c)) * RATE / M / 440);
      out.push((midi - Math.round(midi)) * 100);
    }
  }
  return out;
}
function median(values) { const s = [...values].sort((a, b) => a - b); return s[s.length >> 1] ?? 0; }

for (const [file, parts] of files) {
  const audio = concat(parts), target = path.join(root, 'assets/music', file);
  run(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-c:a', 'libopus', '-b:a', '160k', '-vbr', 'on',
    '-application', 'audio', '-map_metadata', '-1', target], interleave(audio));
  const back = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target]).stdout.toString().trim();
  report.push(`${file}: ${round(length(audio) / RATE, 2)}s written, ${back}s read back, ${(fs.statSync(target).size / 1e6).toFixed(2)} MB`);
}
// The loop seam, decoded from the written file: its level and spectral steps against those of the second either side.
{
  const after = measured.after, written = split(run(['-i', path.join(root, 'assets/music', MEADOW_CUTS.after.file), '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-']).stdout);
  const at = s => Math.round((after.at + s) * RATE), m = mono(written);
  const span = m.slice(at(after.loopEnd) - 2.5 * RATE, at(after.loopEnd));
  const across = new Float32Array(5 * RATE);
  across.set(span); across.set(m.slice(at(after.loopStart), at(after.loopStart) + 2.5 * RATE), span.length);
  report.push(`warm bed loop seam: ${seamSteps(across)}`);
  const source = mono(decode(MEADOW_CUTS.after.cuts[0].source)), from = Math.round(MEADOW_CUTS.after.loop.from * RATE);
  report.push(`  the source's own continuation at the loop start, for comparison: ${seamSteps(source.slice(from - 2.5 * RATE, from + 2.5 * RATE))}`);
  // Each way into the close as the game plays it: the bed fading out (equal power) over the close's lead fading in.
  const { close, crossfade, seams } = after, fadeFor = Math.round(crossfade * RATE), entry = Math.round((close.at + close.entry) * RATE);
  for (const seam of seams) {
    const b = at(seam), over = new Float32Array(5 * RATE), half = 2.5 * RATE;
    for (let i = 0; i < half; i++) {
      const j = i - (half - fadeFor), x = Math.max(0, (j + 0.5) / fadeFor);
      over[i] = j < 0 ? m[b - half + i] : m[b - half + i] * Math.cos(x * Math.PI / 2) + m[entry - fadeFor + j] * Math.sin(x * Math.PI / 2);
    }
    over.set(m.slice(entry, entry + half), half);
    report.push(`  into the close from ${round(MEADOW_CUTS.after.cuts[0].from + seam, 2)}: ${seamSteps(over)}`);
  }
  const into = Math.round(MEADOW_CUTS.after.close.from * RATE);
  report.push(`  the source's own continuation into the close, for comparison: ${seamSteps(source.slice(into - 2.5 * RATE, into + 2.5 * RATE))}`);
}
/** The 50 ms level step and spectral flux at the middle of five seconds, against the largest of the second either side. */
function seamSteps(signal) {
  const hop = Math.round(0.05 * RATE), N = 2048, window = hann(N), levels = [], spectra = [];
  for (let i = 0; i + hop <= signal.length; i += hop) {
    levels.push(db(rms(signal, i, i + hop)));
    spectra.push(magnitude(spectrum(signal, i + hop / 2 - N / 2, N, window)).map(v => Math.log1p(v * 100)));
  }
  const seam = levels.length / 2, flux = k => spectra[k].reduce((s, v, b) => s + Math.max(0, v - spectra[k - 1][b]), 0);
  const near = [];
  for (let k = seam - 20; k <= seam + 20; k++) if (k !== seam && k > 0 && k < levels.length) near.push({ step: Math.abs(levels[k] - levels[k - 1]), flux: flux(k) });
  const top = (key) => Math.max(...near.map(x => x[key]));
  return `level step ${Math.abs(levels[seam] - levels[seam - 1]).toFixed(1)} dB (largest nearby ${top('step').toFixed(1)}), `
    + `spectral flux ${flux(seam).toFixed(0)} (largest nearby ${top('flux').toFixed(0)})`;
}
const fileNames = Object.fromEntries(Object.entries(MEADOW_CUTS).map(([beat, b]) => [beat, b.file]));
fs.writeFileSync(path.join(root, 'src/audio/meadow-cuts-measured.ts'),
  `// Written by tools/meadow-music-cuts.mjs from meadow-cuts.ts; rerun it rather than editing this.\n`
  + `export const MEADOW_FILES = ${JSON.stringify(fileNames)} as const;\n`
  + `export const MEADOW_MEASURED = ${JSON.stringify(measured)} as const;\n`);
console.log(report.join('\n'));
