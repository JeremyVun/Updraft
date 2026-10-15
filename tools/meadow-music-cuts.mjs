// Cuts the meadow's recorded music from its source takes, per `src/audio/meadow-cuts.ts`, into `assets/music/` and
// writes the measurements the game plays them by to `src/audio/meadow-cuts-measured.ts`: loudness and gain to the room
// reference, where each call's flute begins and ends, each answer's note onsets with the melody note of each and the
// outline they trace, the ringing tail each answer slice carries, and where the finale's colour front starts.
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
/** A slice starts this long before its measured onset, so the hammer's attack is whole. */
const PREROLL = 0.025;
/** The tail's decay while it waits for the next note, and how it crossfades out of the slice. */
const RING_DECAY_DB = 6;
const RING_CROSS = 0.04;
/** The top voice holds through inner notes struck within this long of it. */
const TOP_HOLD = 0.3;

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
 * Phase-vocoder freeze of the sound just before `end`: every partial carries on at its own measured frequency, so
 * a slice cut before the next note's attack keeps ringing like a pedalled piano. Returns the tail from `end - cross`.
 */
function ring(channel, end, earliest, seconds) {
  let N = 4096;
  while (N > 1024 && end - N - 256 < earliest) N >>= 1;
  const Ha = 256, Hs = N / 4, window = hann(N);
  const s1 = end - N, f0 = spectrum(channel, s1 - Ha, N, window), f1 = spectrum(channel, s1, N, window);
  const bins = N / 2 + 1, mag = new Float64Array(bins), phase = new Float64Array(bins), omega = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    mag[k] = Math.hypot(f1.re[k], f1.im[k]);
    phase[k] = Math.atan2(f1.im[k], f1.re[k]);
    const expected = 2 * Math.PI * k * Ha / N;
    let d = phase[k] - Math.atan2(f0.im[k], f0.re[k]) - expected;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    omega[k] = (expected + d) / Ha;
  }
  const cross = Math.round(RING_CROSS * RATE), total = Math.round(seconds * RATE) + cross;
  const origin = end - cross, before = Math.ceil((origin - s1 + N) / Hs), frames = Math.ceil((total + N) / Hs) + 1;
  const out = new Float64Array(total), norm = new Float64Array(total);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let j = -before; j < frames; j++) {
    const start = s1 + j * Hs;
    if (start + N <= origin || start >= origin + total) continue;
    for (let k = 0; k < bins; k++) {
      const p = phase[k] + omega[k] * j * Hs;
      re[k] = mag[k] * Math.cos(p); im[k] = mag[k] * Math.sin(p);
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) {
      const o = start + i - origin;
      if (o < 0 || o >= total) continue;
      out[o] += re[i] * window[i]; norm[o] += window[i] * window[i];
    }
  }
  const tail = new Float32Array(total), last = Math.round(0.4 * RATE);
  for (let i = 0; i < total; i++) {
    const after = Math.max(0, i - cross) / RATE;
    const decay = 10 ** (-RING_DECAY_DB * after / 20) * (i >= total - last ? 0.5 - 0.5 * Math.cos(Math.PI * (total - 1 - i) / last) : 1);
    tail[i] = (norm[i] > 1e-6 ? out[i] / norm[i] : 0) * decay;
  }
  return tail;
}

/** The answer's notes as slices: its own sound from just before each onset to just before the next, then a ring. */
function answerSlices(audio, found, seconds) {
  const n = length(audio), first = found[0].at, last = found[found.length - 1].at;
  return found.map((o, k) => {
    const from = Math.max(0, Math.round((o.at - PREROLL) * RATE));
    if (k === found.length - 1) return { onset: o.at, audio: audio.map(ch => ch.slice(from, n)), natural: (n - from) / RATE };
    const end = Math.round((found[k + 1].at - PREROLL) * RATE), cross = Math.round(RING_CROSS * RATE);
    const earliest = Math.round((o.at + 0.04) * RATE);
    const parts = audio.map(ch => {
      const tail = ring(ch, end, earliest, seconds), own = ch.slice(from, end - cross);
      const out = new Float32Array(own.length + tail.length);
      out.set(own);
      for (let i = 0; i < tail.length; i++) {
        const x = i < cross ? i / cross : 1;
        out[own.length + i] = (i < cross ? ch[end - cross + i] * (1 - x) : 0) + tail[i] * x;
      }
      return out;
    });
    return { onset: o.at, audio: parts, natural: (end - from) / RATE };
  }).map((s, k) => ({ ...s, share: 0.05 + 0.9 * (found[k].at - first) / Math.max(1e-6, last - first) }));
}

/**
 * The melody's shape over the trace: the top voice, held through inner notes, with a lone note's spike or dip
 * smoothed out (a three-note median), scaled to −1..1.
 */
function outline(found, shares, fallback) {
  const held = found.map((o, k) => Math.max(...found.filter((p, j) => j <= k && o.at - p.at <= TOP_HOLD).map(p => p.midi)));
  const top = held.map((m, k) => k === 0 || k === held.length - 1 ? m : [held[k - 1], m, held[k + 1]].sort((a, b) => a - b)[1]);
  const lo = Math.min(...top), hi = Math.max(...top);
  let turns = 0;
  for (let k = 2; k < top.length; k++) if (Math.sign(top[k] - top[k - 1]) * Math.sign(top[k - 1] - top[k - 2]) < 0) turns++;
  if (hi - lo < 3 || turns > 4) {
    const a = Math.min(...fallback), b = Math.max(...fallback);
    return { from: 'steps', top, points: fallback.map((s, i) => [i / (fallback.length - 1), (s - a) / Math.max(1, b - a) * 2 - 1]) };
  }
  return { from: 'melody', top, points: top.map((m, k) => [shares[k], (m - lo) / (hi - lo) * 2 - 1]) };
}
/** The outlines the answers traced before they were recorded, for a phrase whose pitches do not settle. */
const STEPS = [[0, 1, 2, 4], [5, 4, 2, 1], [0, 2, 4, 5], [4, 2, 1, 0]];

const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places;
const files = new Map();
const pack = (file, audio) => {
  const parts = files.get(file) ?? [];
  const at = parts.reduce((n, p) => n + length(p), 0) / RATE;
  parts.push(audio, silence(GAP));
  files.set(file, parts);
  return { at: round(at, 4), duration: round(length(audio) / RATE, 4) };
};
const cutAudio = cut => fade(retune(slice(decode(cut.source), cut.from, cut.to), cut.cents ?? 0), EDGE, cut.fadeOut ?? EDGE);
const level = audio => { const l = lufs(audio); return { lufs: round(l, 1), gainDb: round(MEADOW_REFERENCE_LUFS - l, 1) }; };
const measured = {}, report = [];

for (const beat of ['walk', 'after', 'ending']) {
  const audio = cutAudio(MEADOW_CUTS[beat].cuts[0]);
  measured[beat] = { ...level(audio), rest: MEADOW_CUTS[beat].rest ?? 0, ...pack(MEADOW_CUTS[beat].file, audio) };
  report.push(`${beat}: ${measured[beat].duration}s ${measured[beat].lufs} LUFS → ${measured[beat].gainDb} dB`);
}
measured.calls = MEADOW_CUTS.calls.cuts.map((cut, i) => {
  const audio = cutAudio(cut), { attack, end } = extent(mono(audio));
  const call = { ...level(audio), attack: round(attack), end: round(end), ...pack(MEADOW_CUTS.calls.file, audio) };
  report.push(`call ${i + 1}: flute ${cut.from}–${cut.to}${cut.cents ? ` (+${cut.cents} cents)` : ''}, ${call.lufs} LUFS → ${call.gainDb} dB, sounds ${call.attack}–${call.end}s`);
  return call;
});
measured.answers = MEADOW_CUTS.answers.cuts.map((cut, i) => {
  const audio = cutAudio(cut), found = onsets(mono(audio)), slices = answerSlices(audio, found, MEADOW_CUTS.answers.ring);
  const shape = outline(found, slices.map(s => s.share), STEPS[i]);
  const answer = { ...level(audio), outline: shape.from, points: shape.points.map(([s, v]) => [round(s), round(v)]),
    slices: slices.map((s, k) => ({ onset: round(s.onset), share: round(s.share), midi: found[k].midi, top: shape.top[k],
      natural: round(s.natural, 4), ...pack(MEADOW_CUTS.answers.file, s.audio) })) };
  report.push(`answer ${i + 1}: B ${cut.from}–${cut.to}, ${answer.lufs} LUFS → ${answer.gainDb} dB, outline from ${shape.from}`);
  for (const s of answer.slices) report.push(`  ${s.onset.toFixed(3)}s share ${s.share.toFixed(2)} ${noteName(s.midi).padEnd(4)} top ${noteName(s.top)}`);
  return answer;
});
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
  for (const cut of MEADOW_CUTS.answers.cuts) cents.push(...partialCents(mono(cutAudio(cut))));
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
const fileNames = Object.fromEntries(Object.entries(MEADOW_CUTS).map(([beat, b]) => [beat, b.file]));
fs.writeFileSync(path.join(root, 'src/audio/meadow-cuts-measured.ts'),
  `// Written by tools/meadow-music-cuts.mjs from meadow-cuts.ts; rerun it rather than editing this.\n`
  + `export const MEADOW_FILES = ${JSON.stringify(fileNames)} as const;\n`
  + `export const MEADOW_MEASURED = ${JSON.stringify(measured)} as const;\n`);
console.log(report.join('\n'));
