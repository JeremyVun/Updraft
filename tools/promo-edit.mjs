// Cut a promo edit from filmed shots (tools/promo-film.mjs), text cards (tools/promo-text.mjs) and a score bed
// (tools/promo-score.mjs). Usage: node tools/promo-edit.mjs <edit> [out.mp4]. Edits live in tools/promo/edits.mjs.
// env: FOOTAGE (default /tmp/updraft-promo-footage), TEXT (default /tmp/updraft-promo-text), SCORE (default
//      /tmp/updraft-promo-score). Loudness is set to -14 LUFS with peaks under -1 dBTP, as the feeds play it.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { edits } from './promo/edits.mjs';

const [name, outArg] = process.argv.slice(2);
const edit = edits[name];
if (!edit) { console.error(`usage: node tools/promo-edit.mjs <${Object.keys(edits).join('|')}> [out.mp4]`); process.exit(1); }
const FOOTAGE = process.env.FOOTAGE ?? '/tmp/updraft-promo-footage', TEXT = process.env.TEXT ?? '/tmp/updraft-promo-text';
const SCORE = process.env.SCORE ?? '/tmp/updraft-promo-score';
const out = outArg ?? `/tmp/updraft-promo-cuts/${name}.mp4`;
fs.mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
const [W, H] = edit.format === 'portrait' ? [1080, 1920] : [1920, 1080];
const FPS = edit.fps ?? 60, xf = edit.crossfade ?? 0.5, clips = edit.clips, end = edit.end;
const f3 = x => x.toFixed(3);

const inputs = [], graph = [], agraph = [];
const input = (...args) => { inputs.push(...args); return inputs.filter(a => a === '-i').length - 1; };
const lengths = clips.map((c, i) => (i + 1 < clips.length ? clips[i + 1].at : end) - c.at + (i + 1 < clips.length ? xf : 0));

clips.forEach((c, i) => {
  const dir = `${FOOTAGE}/${edit.format}`, len = lengths[i];
  const v = input('-ss', f3(c.from), '-t', f3(len), '-i', `${dir}/${c.shot}.mp4`);
  const a = input('-ss', f3(c.from), '-t', f3(len), '-i', `${dir}/${c.shot}-world.wav`);
  // Frames were filmed as full-range JPEG colour; the edit works in standard HD colour.
  graph.push(`[${v}:v]settb=AVTB,fps=${FPS},setpts=PTS-STARTPTS,scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=pc:out_range=tv,${c.grade ? `${c.grade},` : ''}format=yuv420p[v${i}]`);
  agraph.push(`[${a}:a]aresample=48000,asetpts=PTS-STARTPTS,volume=${c.world ?? 1}[w${i}]`);
});
let v = 'v0', w = 'w0';
for (let i = 1; i < clips.length; i++) {
  graph.push(`[${v}][v${i}]xfade=transition=fade:duration=${xf}:offset=${f3(clips[i].at)}[vx${i}]`);
  agraph.push(`[${w}][w${i}]acrossfade=d=${xf}:c1=qsin:c2=qsin[wx${i}]`);
  v = `vx${i}`; w = `wx${i}`;
}

// The end card: the picture softens and dims behind the title, which fades in over it.
if (edit.card) {
  const { png, at, fade = 1.2, blur = edit.format === 'portrait' ? 14 : 18 } = edit.card;
  const t = input('-loop', '1', '-framerate', String(FPS), '-t', f3(end), '-i', `${TEXT}/${png}.png`);
  graph.push(`[${v}]split[vs][vb]`,
    `[vb]boxblur=${blur}:2,eq=brightness=-0.07:saturation=0.9,format=yuva420p,fade=in:st=${f3(at)}:d=${f3(fade)}:alpha=1[vbl]`,
    `[vs][vbl]overlay=format=auto[vcb]`,
    `[${t}:v]format=rgba,fade=in:st=${f3(at + 0.4)}:d=${f3(fade)}:alpha=1[card]`,
    `[vcb][card]overlay=format=auto:shortest=1[vc]`);
  v = 'vc';
}
(edit.text ?? []).forEach(({ png, at, dur, fade = 0.6 }, i) => {
  const t = input('-loop', '1', '-framerate', String(FPS), '-t', f3(dur), '-i', `${TEXT}/${png}.png`);
  graph.push(`[${t}:v]format=rgba,fade=in:st=0:d=${fade}:alpha=1,fade=out:st=${f3(dur - fade)}:d=${fade}:alpha=1,setpts=PTS+${f3(at)}/TB[t${i}]`,
    `[${v}][t${i}]overlay=format=auto:eof_action=pass[vt${i}]`);
  v = `vt${i}`;
});
graph.push(`[${v}]trim=duration=${f3(end)},setpts=PTS-STARTPTS,format=yuv420p[vout]`);

const m = edit.music;
const s = input('-ss', f3(m.from), '-t', f3(end - (m.at ?? 0)), '-i', m.path ?? `${SCORE}/${m.file}`);
agraph.push(`[${s}:a]aresample=48000,volume=${m.gain ?? 1},afade=in:d=${m.fadeIn ?? 0.8},afade=out:st=${f3(end - (m.at ?? 0) - (m.fadeOut ?? 2))}:d=${m.fadeOut ?? 2},adelay=${Math.round((m.at ?? 0) * 1000)}:all=1[music]`);
agraph.push(`[${w}]volume=${edit.worldGain ?? 1},afade=in:d=0.4,afade=out:st=${f3(end - 1.5)}:d=1.5[world]`);
// A gain envelope in dB over the edit's time, [[seconds, dB], ...], straight lines between the points.
const envelope = pts => {
  if (!pts?.length) return '';
  let e = `${pts.at(-1)[1]}`;
  for (let i = pts.length - 2; i >= 0; i--) {
    const [t0, d0] = pts[i], [t1, d1] = pts[i + 1];
    e = `if(lt(t\\,${t1})\\,${d0}+(${d1 - d0})*(t-${t0})/${Math.max(1e-3, t1 - t0)}\\,${e})`;
  }
  return `,volume='pow(10\\,(${e})/20)':eval=frame`;
};
agraph.push(`[music][world]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${f3(end)}${envelope(edit.envelope)}[mix]`);

const run = (extra, audioTail) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', [...graph, ...agraph, audioTail].join(';'), ...extra],
  { maxBuffer: 1 << 26, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// Measure the mix first, then set its level in one linear gain so the music's dynamics survive.
const probe = spawnSync('ffmpeg', ['-v', 'info', '-y', ...inputs, '-filter_complex', [...agraph, '[mix]loudnorm=I=-14:TP=-1:print_format=json[aout]'].join(';'),
  '-map', '[aout]', '-f', 'null', '-'], { maxBuffer: 1 << 28, encoding: 'utf8' });
if (probe.status !== 0) throw new Error(`ffmpeg could not mix ${name}:\n${probe.stderr.slice(-2000)}`);
const json = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
const gain = -14 - Number(json.input_i);
run(['-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(edit.crf ?? 17), '-profile:v', 'high',
  '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(FPS), '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out],
  `[mix]volume=${gain.toFixed(2)}dB,alimiter=limit=0.85:level=false[aout]`);
console.log(JSON.stringify({ out, seconds: end, inputLoudness: Number(json.input_i), gainDb: +gain.toFixed(2) }));
