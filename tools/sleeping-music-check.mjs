// Sleeping's recordings, offline: `sleeping.ogg`'s end, `cygnet_brave.ogg`'s parts and `sleeping_morning.ogg`'s entry,
// and every seam, on the decoded samples; the lullaby from bedtime, the frost waiting for its end (bounded), its early
// end at a seam; the climb's parts starting at their gates, never overlapping, never cut but for the climb theme at its
// seam once the fog closes and the part sounding as the curtains open, queued and skipped, joining unbroken; the morning
// from its second phrase as the curtains open; restores; and the arrival, gestures, mute and silence through the
// soundscape. Prints each player's timeline. The real game: `sleeping-music-browser-check.mjs`. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

// Seconds after the feather is freed that each gate is reached, measured in the game with prompt gestures
// (`sleeping-music-browser-check.mjs climb`): main's former climb, and the rebuilt climb from the feather save; the slow player
// takes every stop 2.5 times as long, and a long while over the pillow. `asleep` is seconds after the lullaby's top
// (65.5 measured from the wood's handoff, 49 from `?chapter=sleeping`); `summit` is the bird reaching the top (`unbinding`),
// `glide` the ribbon released as the curtains begin to open.
const MAIN = { mist: 52, catch: 55.3, summit: 64.4, glide: 86 };
const PLAYERS = [
  { name: 'main, prompt', asleep: 65.5, free: 2.9, climb: MAIN },
  { name: 'rebuilt climb, prompt', asleep: 65.5, free: 2.9, climb: { mist: 68.5, catch: 81.5, summit: 95.2, glide: 115 } },
  { name: 'main, slow', asleep: 65.5, free: 20, climb: Object.fromEntries(Object.entries(MAIN).map(([gate, at]) => [gate, at * 2.5])) },
  { name: '?chapter=sleeping', asleep: 49, free: 2.9, climb: MAIN },
  { name: 'asleep early', asleep: 20, free: 2, climb: MAIN },
];

const { browser, page } = await audioPage();
let result;
try {
  result = await page.evaluate(async ({ PLAYERS }) => {
    const { SleepingMusic, LULLABY_END, LULLABY_SEAMS, BRAVE_SEAMS, BRAVE_PARTS, MORNING_SEAMS, MORNING_FROM, winterHold } =
      await productionModule('/src/audio/sleeping-music.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const T = tuning.sleeping, A = tuning.audio, RATE = 24000, STEP = 1 / 8;
    const near = (a, b, within = STEP + 1e-6) => Math.abs(a - b) <= within;

    // The recordings as the game decodes them, measured at 48 kHz.
    const meter = buffer => {
      const rate = buffer.sampleRate, left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      const sum = new Float64Array(buffer.length + 1);
      for (let i = 0; i < buffer.length; i++) sum[i + 1] = sum[i] + (left[i] ** 2 + right[i] ** 2) / 2;
      const db = (a, b) => {
        const i = Math.max(0, Math.floor(a * rate)), j = Math.min(buffer.length, Math.floor(b * rate));
        return 10 * Math.log10((j > i ? (sum[j] - sum[i]) / (j - i) : 0) + 1e-20);
      };
      const frames = [];
      for (let t = 0; t + .05 < buffer.duration; t += .05) frames.push(db(t, t + .05));
      const sounding = frames.filter(v => v > -80).sort((a, b) => a - b);
      return { db, median: sounding[sounding.length >> 1], duration: buffer.duration };
    };
    const decode = async file => meter(await new OfflineAudioContext(2, 48000, 48000)
      .decodeAudioData(await (await fetch(`/assets/music/${file}`)).arrayBuffer()));
    const lullaby = await decode('sleeping.ogg'), brave = await decode('cygnet_brave.ogg'), morning = await decode('sleeping_morning.ogg');
    check(near(lullaby.duration, 143.6, .05) && near(brave.duration, 174.2, .05) && near(morning.duration, 123.7, .05),
      `the recordings decode whole (${lullaby.duration.toFixed(2)} s, ${brave.duration.toFixed(2)} s, ${morning.duration.toFixed(2)} s)`);
    // A seam: 30 ms before an attack out of a rest at least 5 dB under the median, not rising into it, the attack's
    // loudest 50 ms at least 9 dB over it, and nothing begun by the seam itself (within 3 dB of the rest, or under −40 dB).
    const seam = (m, at) => {
      const attack = at + .03, rest = m.db(attack - .3, attack);
      let peak = -Infinity;
      for (let s = attack; s < attack + .3; s += .01) peak = Math.max(peak, m.db(s, s + .05));
      return { rest, under: m.median - rest, rise: peak - rest, falling: m.db(attack - .6, attack - .3) - rest,
        early: Math.min(m.db(at - .03, at) - rest, m.db(at - .03, at) + 43) };
    };
    const seamsHold = (m, seams, name) => {
      const failing = seams.map(at => ({ at, ...seam(m, at) })).filter(s => !(s.under >= 5 && s.falling >= -3 && s.rise >= 9 && s.early < 3));
      check(!failing.length, `${name}: every seam is 30 ms before an attack out of a rest (${JSON.stringify(failing)})`);
      check(seams.every((at, i) => !i || at - seams[i - 1] >= 2), `${name}: seams ordered and at least 2 s apart`);
    };
    seamsHold(lullaby, LULLABY_SEAMS, 'sleeping.ogg');
    seamsHold(brave, BRAVE_SEAMS, 'cygnet_brave.ogg');
    seamsHold(morning, MORNING_SEAMS, 'sleeping_morning.ogg');
    // A clean cut: the last note rung right down, and the next attack rising straight after the seam.
    const clean = (m, at) => ({ rest: m.db(at - .27, at + .03), rise: m.db(at + .035, at + .15) - m.db(at - .04, at) });
    const end = clean(lullaby, LULLABY_END);
    check(LULLABY_SEAMS.at(-1) === LULLABY_END && end.rest < -44 && end.rise > 20,
      `the lullaby ends at its seam before the second half, the note from 60.8 s rung down to ${end.rest.toFixed(1)} dB and the next attack ${end.rise.toFixed(1)} dB up`);
    check(BRAVE_PARTS.length === 3 && BRAVE_PARTS[0][0] === 0 && BRAVE_SEAMS.includes(BRAVE_PARTS.at(-1)[1])
      && BRAVE_PARTS.every((part, i) => !i || part[0] === BRAVE_PARTS[i - 1][1] && BRAVE_SEAMS.includes(part[0])),
      'the climb\'s three parts lie back to back in the recording, each boundary a seam, the coda unused');
    const cuts = [...BRAVE_PARTS.slice(1).map(([from]) => from), BRAVE_PARTS.at(-1)[1]].map(from => ({ from, ...clean(brave, from) }));
    check(cuts.every(cut => cut.rest < -38 && cut.rise > 18), `each part begins and the summit ends at one of the piece's clean rests (${JSON.stringify(cuts.map(c => [c.from, +c.rest.toFixed(1), +c.rise.toFixed(1)]))})`);
    const phrase = MORNING_SEAMS.find(at => at > MORNING_FROM), entry = clean(morning, phrase), lead = morning.db(MORNING_FROM, phrase - .03);
    check(MORNING_FROM === 11 && phrase === 12.02 && lead < -35 && entry.rise > 20,
      `the morning enters at 11 s in the rest (${lead.toFixed(1)} dB) before its second phrase's seam at ${phrase} s, the attack ${entry.rise.toFixed(1)} dB up`);
    check(morning.db(122.5, 123.7) < -40, 'the morning rings out before the file ends');
    check(winterHold(T.triesFrom + 20, 100, 0) === T.frostWaitMost && winterHold(T.triesFrom + 1, 100, T.frostWaitMost) === 0
      && winterHold(T.triesFrom + 1, -Infinity, 0) === 0 && winterHold(T.triesFrom - .01, 100, 0) === 0,
      `winter waits before the first try, only for a lullaby, and no more than ${T.frostWaitMost} s`);

    // Drive one SleepingMusic through a story, logging every clip and what was heard.
    const sources = new WeakMap(), nativeStart = AudioBufferSourceNode.prototype.start, nativeStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const [when = 0, offset = 0, duration = Infinity] = args, length = this.buffer?.duration ?? 0;
      const track = Math.abs(length - 174.2) < .1 ? 'brave' : Math.abs(length - 143.6) < .1 ? 'lullaby'
        : Math.abs(length - 123.7) < .1 ? 'morning' : null;
      if (track) sources.get(this.context)?.push({ node: this, when, offset, end: when + duration, track });
      return nativeStart.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      const clip = sources.get(this.context)?.find(clip => clip.node === this);
      if (clip) clip.end = Math.min(clip.end, Math.max(args[0] ?? 0, clip.when));
      return nativeStop.apply(this, args);
    };
    const power = (buffer, from, to) => {
      let sum = 0, n = 0;
      for (let ch = 0; ch < 2; ch++) { const data = buffer.getChannelData(ch); for (let i = Math.ceil(from * RATE); i < Math.floor(to * RATE); i++) { sum += data[i] ** 2; n++; } }
      return 10 * Math.log10(sum / Math.max(1, n) + 1e-20);
    };
    const render = async (seconds, gate, { music: given } = {}) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE), log = [];
      sources.set(ctx, log);
      const music = given?.(ctx) ?? new SleepingMusic(ctx, ctx.destination);
      const update = tick => { const now = tick * STEP; music.update(gate(now, music.lullabyLeft(now)), 1); };
      const decoded = async () => { for (const r of [music.lullaby, music.brave, music.morning]) if (r) await r.ready; };
      await decoded(); update(0); await decoded();
      let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
      for (let tick = 1; tick < seconds / STEP; tick++) {
        await pause; update(tick); await decoded();
        if (tick + 1 < seconds / STEP) pause = ctx.suspend((tick + 1) * STEP);
        await ctx.resume();
      }
      return { music, buffer: await rendering, clips: log.map(({ node, ...clip }) => ({ ...clip,
        part: clip.track === 'brave' ? BRAVE_PARTS.findIndex(([from]) => Math.abs(from - clip.offset) < 1e-6) : null })) };
    };
    // Bedtime to the morning, the story's winter held by the same rule the chapter uses (`winterHold`).
    const sleeper = ({ asleep, free, climb, from = 'bedtime' }) => {
      const at = { asleep }, hold = { waited: 0 };
      let feather = null;
      const gate = (now, left) => {
        if (from !== 'bedtime') { feather ??= at.feather = 0; }
        else if (now < asleep) return 'bedtime';
        if (feather === null) {
          let t = now - asleep - hold.waited;
          const held = winterHold(t, left, hold.waited);
          hold.waited += held; t -= held;
          if (t > T.triesFrom) at.firstTry ??= now;
          if (t >= T.winterBeginsAt) at.frost ??= now;
          const call = T.triesFrom + 3 * T.triesEvery;
          if (t > call) at.call ??= now;
          if (t > call + 11) at.offered ??= now;
          if (t > call + 11 + free) feather = at.feather = now;
          else return 'asleep';
        }
        let reached = from === 'bedtime' ? 'feather' : from;
        for (const name of ['mist', 'catch', 'summit', 'glide']) if (now - feather >= climb[name]) { reached = name; at[name] ??= now; }
        return reached;
      };
      return { gate, at, hold };
    };
    const PART_NAMES = ['climb theme', 'commitment', 'summit'];
    const MORNING_LENGTH = morning.duration - MORNING_FROM, GIVE_WAY = Math.max(A.curtainsFade, A.mirrorSeamRelease);
    // Parts never overlap, play in order and at most once, start at their gate or as the part before ends, the latest
    // reached and the rest passed over, and never from the curtains on; only the climb theme ends early, at its next seam
    // once the fog has closed, and whatever sounds as the curtains open, at its next seam within `mirrorSeamRelease` or
    // over `curtainsFade`.
    const partsHold = (name, run, at) => {
      const parts = run.clips.filter(c => c.track === 'brave' && c.end > c.when).sort((a, b) => a.when - b.when);
      check(parts.every((c, i) => !i || c.when >= parts[i - 1].end - 1e-6 && c.part > parts[i - 1].part),
        `${name}: parts never overlap, and play in order at most once`);
      for (const [i, c] of parts.entries()) {
        const [from, to, gate] = BRAVE_PARTS[c.part], previous = parts[i - 1];
        const due = Math.max(at[gate], previous?.end ?? -Infinity);
        check(near(c.when, due), `${name}: the ${PART_NAMES[c.part]} begins at ${c.when.toFixed(2)} s, ${previous && previous.end > at[gate] ? 'as the part before it ends' : 'as its gate is reached'}`);
        const later = BRAVE_PARTS.findIndex((part, p) => p > c.part && at[part[2]] !== undefined && at[part[2]] <= c.when - STEP);
        check(later < 0, `${name}: the ${PART_NAMES[c.part]} is the latest part reached when it begins`);
        check(!(c.when >= at.glide), `${name}: the ${PART_NAMES[c.part]} does not begin once the curtains have opened`);
        const length = Math.min(to, brave.duration) - from;
        if (at.glide < c.when + length - STEP && !(c.part === 0 && at.mist < at.glide)) {
          const position = at.glide - c.when, cut = c.end - c.when;
          const next = [...BRAVE_SEAMS.map(s => s - from).filter(s => s > position - STEP && s < length - 1e-6), length][0];
          const seamed = next - position <= A.mirrorSeamRelease;
          const atSeam = near(cut, next, STEP * 2), faded = near(c.end - at.glide, A.curtainsFade, STEP * 2);
          check(Math.abs(next - position - A.mirrorSeamRelease) <= STEP * 2 ? atSeam || faded : seamed ? atSeam : faded,
            `${name}: the curtains end the ${PART_NAMES[c.part]} ${seamed ? 'at its next seam' : `over a ${A.curtainsFade} s fade, no seam within ${A.mirrorSeamRelease} s`} (${(from + cut).toFixed(2)} s in the recording, ${(c.end - at.glide).toFixed(2)} s after they open)`);
        } else if (c.part > 0 || !(at.mist < c.when + length)) check(near(c.end - c.when, length, 1e-3), `${name}: the ${PART_NAMES[c.part]} plays whole`);
        else {
          const position = at.mist - c.when, next = BRAVE_SEAMS.find(s => s - position >= A.mirrorSeamSoonest - STEP);
          const cut = c.end - c.when;
          const wait = next === undefined ? Infinity : next - position, seamed = wait <= A.fogSeamWithin;
          const atSeam = BRAVE_SEAMS.includes(+cut.toFixed(2)) && near(cut, next, STEP * 2) || near(cut, length, 1e-3);
          const faded = near(c.end - at.mist, A.fogFade, STEP * 2);
          // Within a frame of the window's edge either ending is right.
          check(Math.abs(wait - A.fogSeamWithin) <= STEP * 2 ? atSeam || faded : seamed ? atSeam : faded,
            `${name}: the fog ends the climb theme ${seamed ? 'at its next seam' : `over a ${A.fogFade} s fade, no seam within ${A.fogSeamWithin} s`} (${cut.toFixed(2)} s, ${(c.end - at.mist).toFixed(2)} s after it closes)`);
        }
      }
      const played = new Set(parts.map(c => c.part));
      for (let p = 0; p < BRAVE_PARTS.length; p++) {
        if (played.has(p) || at[BRAVE_PARTS[p][2]] === undefined) continue;
        const waiting = parts.some(c => c.end > at[BRAVE_PARTS[p][2]] && c.when < at.glide);
        check(parts.some(c => c.part > p) || at.glide >= at[BRAVE_PARTS[p][2]] && waiting,
          `${name}: the ${PART_NAMES[p]} is passed over only for a later part or the curtains`);
      }
      return parts;
    };
    // The morning: once, from its second phrase, as the curtains open, to its end; nothing from the climb after it but
    // the release of the part it ends; both recordings released.
    const morningHolds = (name, run, at, parts) => {
      const dawn = run.clips.filter(c => c.track === 'morning');
      check(dawn.length === 1 && near(dawn[0].offset, MORNING_FROM, 1e-6) && near(dawn[0].when, at.glide)
        && near(dawn[0].end - dawn[0].when, MORNING_LENGTH, 1e-3),
        `${name}: the morning plays once from ${MORNING_FROM} s as the curtains open (${dawn[0]?.when.toFixed(2)} s, gate ${at.glide?.toFixed(2)} s), to its end`);
      check(parts.every(c => c.end <= at.glide + GIVE_WAY + STEP), `${name}: the climb has given way within ${GIVE_WAY} s of the curtains`);
      check(run.music.brave === null && run.music.morning === null, `${name}: the climb's and the morning's recordings are released`);
      return dawn[0];
    };
    const tables = [];
    for (const player of PLAYERS) {
      const story = sleeper(player), climbEnd = player.free + 11 + 15 + Math.max(...Object.values(player.climb)) + MORNING_LENGTH + 5;
      const seconds = Math.ceil(player.asleep + climbEnd + T.frostWaitMost);
      // The lullaby is decoded during the wood's handoff, before bedtime begins.
      const music = ctx => { const m = new SleepingMusic(ctx, ctx.destination); void m.prepare('sleeping'); return m; };
      const run = await render(seconds, story.gate, { music }), at = story.at;
      const tune = run.clips.filter(c => c.track === 'lullaby');
      check(tune.length === 1 && tune[0].when === 0 && tune[0].offset === 0, `${player.name}: the lullaby plays once, from its top at bedtime`);
      const latest = player.asleep + T.winterBeginsAt + T.frostWaitMost - T.frostRest;
      const position = Math.ceil(player.asleep / STEP) * STEP;
      const expected = LULLABY_END <= latest ? LULLABY_END : LULLABY_SEAMS.find(s => s - position >= A.mirrorSeamSoonest);
      check(near(tune[0].end, expected), `${player.name}: the lullaby ends at ${tune[0].end.toFixed(2)} s, ${expected === LULLABY_END ? 'its own end' : 'its next seam after she falls asleep'}`);
      check(at.frost >= tune[0].end + T.frostRest - STEP && at.frost <= player.asleep + T.winterBeginsAt + T.frostWaitMost + STEP
        && (tune[0].end + T.frostRest > player.asleep + T.winterBeginsAt || near(at.frost, player.asleep + T.winterBeginsAt)),
        `${player.name}: the frost comes ${(at.frost - tune[0].end).toFixed(2)} s after the lullaby, ${story.hold.waited.toFixed(2)} s late`);
      check(near(at.frost - at.firstTry, T.winterBeginsAt - T.triesFrom, 2 * STEP), `${player.name}: the bird's tries wait with the frost`);
      check(power(run.buffer, tune[0].end + .05, at.feather - .05) < -90, `${player.name}: silence from the lullaby's end until the feather`);
      const parts = partsHold(player.name, run, at);
      check(parts[0]?.part === 0 && near(parts[0].when, at.feather), `${player.name}: the climb theme enters with the freed feather`);
      check(parts.at(-1).part === 2, `${player.name}: the summit is the climb's last part`);
      const dawn = morningHolds(player.name, run, at, parts);
      check(power(run.buffer, dawn.end + .05, seconds - .05) < -90, `${player.name}: no music after the morning`);
      check(run.music.lullaby === null, `${player.name}: the lullaby's recording is released after it ends`);
      tables.push({ name: player.name, at, waited: story.hold.waited, lullaby: tune[0], parts, morning: dawn });
    }

    // Restores and late starts: a feather save resumes the climb theme at once; music switched on after she falls asleep
    // never plays the lullaby; a start past a part's gate stays silent until the next; the morning stays silent.
    const restored = async (from, gates, seconds = 40) => {
      const story = sleeper({ asleep: 0, free: 0, climb: gates, from });
      // A feather save has the climb's recording decoded before play begins; nothing else prepares any.
      const music = ctx => { const m = new SleepingMusic(ctx, ctx.destination); if (from === 'feather' || from === 'catch') void m.prepare('cygnetBrave'); return m; };
      return { run: await render(seconds, story.gate, { music }), at: story.at };
    };
    const feather = await restored('feather', { mist: 30, catch: 32, summit: 34, glide: 36 });
    check(feather.run.clips[0]?.part === 0 && feather.run.clips[0].when === 0 && feather.run.clips[0].offset === 0
      && !feather.run.clips.some(c => c.track === 'lullaby'), 'feather save: the climb theme from its top as the restored climb begins, no lullaby');
    const fog = await restored('mist', { catch: 6, summit: 50, glide: 60 });
    check(fog.run.clips.length === 1 && fog.run.clips[0].part === 1 && near(fog.run.clips[0].when, 6), 'starting in the fog: silent until the catch, then the commitment');
    const morningSave = await restored('glide', { mist: 0, catch: 0, summit: 0, glide: 0 });
    check(morningSave.run.clips.length === 0 && morningSave.run.music.brave === null && morningSave.run.music.morning === null
      && power(morningSave.run.buffer, 0, 39.9) < -100, 'morning save: silence, and no recording is decoded');
    // `?chapter=ribbon`: a step below the summit with the feather caught, so the summit part at the top, the morning at
    // the curtains.
    const ribbon = await restored('catch', { summit: 3, glide: 30 }, 30 + MORNING_LENGTH + 5);
    const ribbonParts = partsHold('ribbon start', ribbon.run, ribbon.at);
    check(ribbonParts.map(c => c.part).join() === '2' && near(ribbonParts[0].when, 3), 'ribbon start: the summit part at the top, the commitment never');
    morningHolds('ribbon start', ribbon.run, ribbon.at, ribbonParts);
    const late = await render(60, now => now < 5 ? 'asleep' : 'feather', { music: ctx => new SleepingMusic(ctx, ctx.destination) });
    check(late.clips.length === 1 && late.clips[0].part === 0 && near(late.clips[0].when, 5), 'music on after she falls asleep: no lullaby; the climb at the feather');

    // A quick climb: the fog cuts the theme at its next seam; the catch and the summit both come before it has ended, so
    // the commitment is passed over and the summit follows the seam; the curtains open with no seam near, so the summit
    // fades as the morning begins.
    const quick = sleeper({ asleep: 0, free: 0, climb: { mist: 11, catch: 12, summit: 14, glide: 20 }, from: 'feather' });
    const decodedClimb = ctx => { const m = new SleepingMusic(ctx, ctx.destination); void m.prepare('cygnetBrave'); return m; };
    const skip = await render(20 + MORNING_LENGTH + 5, quick.gate, { music: decodedClimb });
    const skipParts = partsHold('quick', skip, quick.at);
    check(skipParts.map(c => c.part).join() === '0,2' && near(skipParts[0].end, 16.1, .01) && near(skipParts[1].when, 16.1, .01)
      && near(skipParts[1].end, 20 + A.curtainsFade, STEP),
      `quick: the climb theme stops at its 16.1 s seam, the summit follows at once, the commitment passed over, and the summit fades over ${A.curtainsFade} s as the curtains open`);
    morningHolds('quick', skip, quick.at, skipParts);
    // Gates each reached while the part before still plays carry the recording on unbroken until the curtains, which
    // open 0.56 s before the summit's 126.67 s seam: it ends there.
    const curtains = 126.67 - .56;
    const steady = sleeper({ asleep: 0, free: 0, climb: { mist: 93, catch: 94, summit: 100, glide: curtains }, from: 'feather' });
    const whole = await render(curtains + MORNING_LENGTH + 5, steady.gate, { music: decodedClimb });
    const wholeParts = partsHold('steady', whole, steady.at);
    morningHolds('steady', whole, steady.at, wholeParts);
    check(near(wholeParts.at(-1).end, 126.67, STEP), `steady: the summit ends at its 126.67 s seam as the curtains open (${wholeParts.at(-1).end.toFixed(2)} s)`);
    const reference = await new OfflineAudioContext(2, RATE, RATE).decodeAudioData(await (await fetch('/assets/music/cygnet_brave.ogg')).arrayBuffer());
    const gain = 10 ** (A.recordedMusicDb.cygnetBrave / 20);
    let error = 0, total = 0;
    for (let ch = 0; ch < 2; ch++) {
      const out = whole.buffer.getChannelData(ch), ref = reference.getChannelData(ch);
      for (let i = RATE; i < Math.floor((curtains - 1) * RATE); i++) { error += (out[i] - gain * ref[i]) ** 2; total += (gain * ref[i]) ** 2; }
    }
    check(wholeParts.length === 3 && error / total < 1e-4, `steady: each part joins the last where it ends, the recording unbroken until the curtains (error ${(error / total).toExponential(1)})`);

    // Through the soundscape: the wood's handoff opens on the lullaby from its top at full level; the pad stays silent;
    // the climb's gestures play no chimes; music mute and silence; the frost's channel.
    const { ctx, sound } = offlineSound(48);
    sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
    const log = []; sources.set(ctx, log);
    const chimes = [];
    const chime = sound.chime.bind(sound);
    sound.chime = (...args) => { if (args[6]) chimes.push(args[0]); chime(...args); };
    const crossing = { ...baseState, music: 'wood', hush: .55, night: 1, arrivalMusic: 'sleeping', arrivalReady: true };
    const bedtime = { ...baseState, music: 'wood', sleepingScore: 'shelter', sleepingMusic: 'bedtime', hush: .5, night: 1 };
    let opened = null, padMax = 0, leftAt = {};
    const state = t => t < 12 ? crossing : t < 30 ? bedtime
      : { ...baseState, music: 'wood', sleepingScore: 'climb', sleepingMusic: 'feather', night: 1,
        gust: t % 2 < .5 ? 14 : 0, charge: t % 2 >= 1 && t % 2 < 1.5 ? .7 : 0, silence: t >= 44 };
    const step = t => {
      if (t === 20) sound.setMusicMuted(true);
      if (t === 24) sound.setMusicMuted(false);
      sound.update(STEP, state(t));
      // A gate's new value shows once the next quantum has rendered.
      if (opened === null && log.some(c => c.track === 'lullaby')) opened = { t };
      else if (opened && opened.gate === undefined) opened.gate = sound.backgroundGate.gain.value;
      if (t >= 12 && t < 44) padMax = Math.max(padMax, sound.padGain.gain.value);
      if (t === 16 || t === 21) leftAt[t] = sound.lullabyLeft;
    };
    step(0);
    let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
    for (let tick = 1; tick < 48 / STEP; tick++) {
      await pause; step(tick * STEP);
      if (sound.sleepingMusic) for (const r of [sound.sleepingMusic.lullaby, sound.sleepingMusic.brave, sound.sleepingMusic.morning]) if (r) await r.ready;
      if (tick + 1 < 48 / STEP) pause = ctx.suspend((tick + 1) * STEP);
      await ctx.resume();
    }
    const mix = await rendering;
    const rest = A.arrivalFadeOut + A.sleepingArrivalQuiet;
    const tunes = log.filter(c => c.track === 'lullaby');
    check(tunes.length === 1 && tunes[0].offset === 0 && near(tunes[0].when, 1 * 0 + rest, STEP * 2),
      `arrival: the wood fades and rests ${rest} s, then the lullaby from its top (at ${tunes[0]?.when.toFixed(2)} s)`);
    check(opened?.gate > .99, `arrival: the gates are open at full level as the lullaby begins (${opened?.gate})`);
    check(padMax < 1e-4, 'the generic pad stays silent in Sleeping');
    check(near(leftAt[16], LULLABY_END - (16 - tunes[0].when), .2) && leftAt[21] === -Infinity,
      'the frost hears how long the lullaby has left, and nothing while music is off');
    const muted = [power(mix, tunes[0].when + 1, 19.9), power(mix, 22, 23.9), power(mix, 25, 29)];
    check(muted[0] > -60 && muted[1] < muted[0] - 50 && muted[2] > -60,
      `music mute silences the lullaby without stopping its clock (${muted.map(v => v.toFixed(1)).join(', ')} dB)`);
    check(chimes.length === 0, `the climb's gestures play no chimes (${[...new Set(chimes)].join(', ')})`);
    check(log.some(c => c.track === 'brave' && c.offset === 0 && near(c.when, 30, STEP * 2)),
      `the climb theme enters with the feather through the soundscape (${JSON.stringify(log.map(({ node, ...c }) => c))})`);
    check(power(mix, 45, 47.9) < -100 && !sound.sleepingMusic, 'permanent silence retires both recordings');
    return { checks, tables, seams: { lullaby: LULLABY_SEAMS, brave: BRAVE_SEAMS, morning: MORNING_SEAMS } };
  }, { PLAYERS });
} finally { await browser.close(); }

const f = n => n === undefined ? '—' : n.toFixed(1).padStart(6);
for (const { name, at, waited, lullaby, parts, morning } of result.tables) {
  console.log(`\n${name} (seconds from the lullaby's top)`);
  console.log(`  lullaby ${f(lullaby.when)} → ${f(lullaby.end)}   asleep ${f(at.asleep)}   first try ${f(at.firstTry)}   frost ${f(at.frost)} (waited ${waited.toFixed(1)} s)   call ${f(at.call)}   offered ${f(at.offered)}   feather ${f(at.feather)}`);
  console.log(`  gates from the feather: mist ${f(at.mist - at.feather)}  catch ${f(at.catch - at.feather)}  summit ${f(at.summit - at.feather)}  curtains ${f(at.glide - at.feather)}`);
  console.log('  part           gate at   starts     ends   recording        silence before');
  const names = ['climb theme', 'commitment', 'summit'], gates = ['feather', 'catch', 'summit'];
  let last = lullaby.end;
  for (const p of parts) {
    const from = p.offset, to = from + p.end - p.when;
    console.log(`  ${names[p.part].padEnd(14)} ${f(at[gates[p.part]])}   ${f(p.when)}   ${f(p.end)}   ${from.toFixed(2).padStart(6)}–${to.toFixed(2).padEnd(7)}  ${(p.when - last).toFixed(1).padStart(6)}`);
    last = p.end;
  }
  console.log(`  ${'morning'.padEnd(14)} ${f(at.glide)}   ${f(morning.when)}   ${f(morning.end)}   ${morning.offset.toFixed(2).padStart(6)}–${(morning.offset + morning.end - morning.when).toFixed(2).padEnd(7)}  ${(morning.when - last).toFixed(1).padStart(6)}`);
  const skipped = names.filter((_, i) => !parts.some(p => p.part === i));
  if (skipped.length) console.log(`  passed over: ${skipped.join(', ')}`);
}
console.log('\n' + JSON.stringify({ checks: result.checks.length, passed: result.checks, seams: result.seams }, null, 2));
