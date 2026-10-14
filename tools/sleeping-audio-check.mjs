// The sleeping climb's night wind and the bird's climb sounds, rendered offline through the production Soundscape and
// Foley along a scripted climb (edge → crest → summit), against the same climb with the previous wind and foley.
// Checks the wind rises with height and settles at the summit, the wind answers the fog's call, and nothing on the
// climb is louder than the summit's moment. node tools/sleeping-audio-check.mjs [out.json] (BASE selects Vite).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-sleeping-audio.json';
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { tuning } = await productionModule('/src/tuning.ts');
    const { Foley } = await productionModule('/src/audio/foley.ts');
    const { SleepingFoley } = await productionModule('/src/audio/sleeping-foley.ts');
    const { NIGHT_WIND, nightWindSound, sleepingGust } = await productionModule('/src/world/sleeping-wind.ts');
    const T = tuning.sleeping, rate = 24000, step = 1 / 60, seconds = 92;
    const smooth = (x, a, b) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    const segments = [
      ['edge', 0, 8, 0, .65], ['climb', 8, 16, .25, .7], ['snow', 16, 30, .4, .75], ['step', 30, 42, .6, .85],
      ['mist', 42, 58, .9, .95], ['crest', 58, 70, 1, 1], ['summit', 70, 92, 0, 1],
    ];
    const at = t => segments.find(s => t >= s[1] && t < s[2]) ?? segments.at(-1);
    const callAt = 42 + T.mistCallAt;
    const events = [];
    const walk = (from, to, every, snow = () => 0) => { for (let t = from; t < to; t += every) events.push({ t, kind: 'step', amount: .8, snow: snow(t) }); };
    walk(.5, 16, .32);
    walk(16, 19, .38, t => .05 + .27 * smooth(t, 16, 19));
    events.push({ t: 19.5, kind: 'scramble', amount: 1, snow: .32 }, { t: 20.1, kind: 'scramble', amount: 1, snow: .32 }, { t: 21.5, kind: 'shake', amount: 1, snow: 0 });
    walk(27, 31, .32);
    events.push({ t: 31.5, kind: 'scramble', amount: 1, snow: 0 });
    for (let t = 34; t < 38; t += .2) events.push({ t, kind: 'flap', amount: .5 + .4 * smooth(t, 34, 38), snow: 0, hope: 1 });
    events.push({ t: 38.5, kind: 'scramble', amount: 1, snow: 0, hope: 1 }, { t: 38.5, kind: 'flutter', amount: .9, snow: 0, hope: 1 }, { t: 39.8, kind: 'shake', amount: 1, snow: 0, hope: 1 });
    walk(40.5, 43, .32);
    walk(58, 70, .42);
    events.sort((a, b) => a.t - b.t);

    // K-weighting (BS.1770's head shelf and low cut) at this rate, so the levels read as loudness, not raw power.
    const biquad = (x, [b0, b1, b2, a1, a2]) => {
      const y = new Float32Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
      return y;
    };
    const coefficients = (type, f, q, gainDb = 0) => {
      const w = 2 * Math.PI * f / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = 10 ** (gainDb / 40);
      const c = type === 'highpass' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha]
        : [A * ((A + 1) + (A - 1) * cos + 2 * Math.sqrt(A) * alpha), -2 * A * ((A - 1) + (A + 1) * cos), A * ((A + 1) + (A - 1) * cos - 2 * Math.sqrt(A) * alpha),
          (A + 1) - (A - 1) * cos + 2 * Math.sqrt(A) * alpha, 2 * ((A - 1) - (A + 1) * cos), (A + 1) - (A - 1) * cos - 2 * Math.sqrt(A) * alpha];
      return [c[0] / c[3], c[1] / c[3], c[2] / c[3], c[4] / c[3], c[5] / c[3]];
    };
    const kWeight = x => biquad(biquad(x, coefficients('highshelf', 1682, .707, 4)), coefficients('highpass', 38, .5));
    async function render({ climb, music, wind, breeze = true, foley: withFoley, cued = true }) {
      let seed = 515151;
      const random = Math.random;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      try {
        const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
        const Native = window.AudioContext;
        window.AudioContext = function () { return ctx; };
        const sound = new audioModule.Soundscape();
        try { sound.start(); } finally { window.AudioContext = Native; }
        Object.defineProperty(sound, 'running', { get: () => true });
        if (!music) sound.setMusicMuted(true);
        if (!wind) for (const k of ['breezeGain', 'gustGain', 'whistleGain', 'rustleGain', 'seaGain', 'liftGain']) sound[k].disconnect();
        if (!breeze) for (const k of ['breezeGain', 'seaGain']) sound[k].disconnect();
        const foley = new Foley(), climbing = new SleepingFoley(foley), bird = { wing: { state: 'wrapped' }, hopeBeats: 0 };
        let next = 0, rise = 0, lull = 0;
        const update = tick => {
          const t = tick * step, [name, , , exposure, cold] = at(t), summit = name === 'summit';
          const settle = Math.exp(-step / T.nightWindSettles);
          rise = !climb ? 0 : summit ? rise * settle : exposure;
          lull = !climb ? 0 : summit ? T.summitLull + (lull - T.summitLull) * settle : T.fogLull * smooth(t, 42, 43.4) * (1 - smooth(t, 52, 54));
          const after = t - callAt - T.windAnswersAfter;
          NIGHT_WIND.rise = rise; NIGHT_WIND.lull = lull;
          NIGHT_WIND.answer = climb && name === 'mist' ? smooth(after, 0, T.windAnswerRises) * (1 - smooth(after, T.windAnswerRises, T.windAnswerRises + T.windAnswerFades)) : 0;
          const gust = sleepingGust(t, cold, 0), hill = summit ? 0 : exposure;
          const charge = cued && summit ? smooth(t, 76, 80) * (1 - smooth(t, 84, 85)) : 0;
          const cues = [];
          if (cued && Math.abs(t - callAt) < step / 2) cues.push('calling');
          if (cued && Math.abs(t - 86) < step / 2) cues.push('lifted');
          sound.update(step, { ...baseState, music: 'wood', hush: .5, land: 1, sea: .2, meadow: 0, night: 1, life: 0,
            sleepingScore: summit ? 'summit' : 'climb', sleepingWind: !summit, cold, charge,
            winterGust: nightWindSound(t, cold, 0),
            breeze: Math.min(1, tuning.wind.breeze * (.3 + hill * T.climbWind + cold * T.winterBreeze + gust * .65) / 6), cues });
          if (!withFoley) return;
          foley.setOutput(sound.output);
          while (next < events.length && events[next].t <= t) {
            const e = events[next++];
            bird.hopeBeats = e.hope ?? 0;
            if (climb && climbing.heard(e, bird, e.snow, 0)) continue;
            if (e.kind === 'step') foley.step('grass', e.amount, 0);
            else if (e.kind === 'flap') foley.flap(e.amount, 0);
            else if (e.kind === 'scramble') foley.scramble(0);
            else if (e.kind === 'flutter') foley.flutter(6, e.amount, 0);
            else if (e.kind === 'shake') foley.shake(0, 0);
          }
        };
        update(0);
        const ticks = Math.floor(seconds / step);
        let pause = ctx.suspend(step);
        const rendering = ctx.startRendering();
        for (let tick = 1; tick < ticks; tick++) {
          await pause; update(tick);
          if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * step);
          await ctx.resume();
        }
        const buffer = await rendering;
        const l = kWeight(buffer.getChannelData(0)), r = kWeight(buffer.getChannelData(1)), win = Math.round(.4 * rate);
        const db = p => p > 0 ? +(10 * Math.log10(p)).toFixed(1) : -Infinity;
        const measure = (from, to) => {
          const a = Math.round(from * rate), b = Math.min(l.length, Math.round(to * rate));
          let power = 0, loudest = 0, peak = 0;
          for (let i = a; i < b; i++) { power += l[i] * l[i] + r[i] * r[i]; peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i])); }
          for (let w = a; w + win <= b; w += win / 4) {
            let p = 0;
            for (let i = w; i < w + win; i++) p += l[i] * l[i] + r[i] * r[i];
            loudest = Math.max(loudest, p / (2 * win));
          }
          return { rms: +(db(power / (2 * (b - a))) - .691).toFixed(1), loudest: +(db(loudest) - .691).toFixed(1), peak: db(peak * peak) };
        };
        const bySegment = Object.fromEntries(segments.map(([name, from, to]) => [name, measure(from, to)]));
        bySegment.summitSettled = measure(84, 92);
        bySegment.moment = measure(76, 92);
        bySegment.beforeCall = measure(callAt - 2.5, callAt);
        bySegment.windAnswer = measure(callAt + T.windAnswersAfter + .4, callAt + T.windAnswersAfter + 2.4);
        return bySegment;
      } finally { Math.random = random; }
    }
    return {
      windNew: await render({ climb: true, music: false, wind: true, foley: false, cued: false }),
      windOld: await render({ climb: false, music: false, wind: true, foley: false, cued: false }),
      gustsNew: await render({ climb: true, music: false, wind: true, breeze: false, foley: false, cued: false }),
      gustsOld: await render({ climb: false, music: false, wind: true, breeze: false, foley: false, cued: false }),
      foleyNew: await render({ climb: true, music: false, wind: false, foley: true }),
      foleyOld: await render({ climb: false, music: false, wind: false, foley: true }),
      mixNew: await render({ climb: true, music: true, wind: true, foley: true }),
      mixOld: await render({ climb: false, music: true, wind: true, foley: true }),
    };
  });
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  const rows = ['edge', 'climb', 'snow', 'step', 'mist', 'crest', 'summit', 'summitSettled'];
  console.log('K-weighted loudness by stretch, LKFS ungated (whole stretch / loudest 0.4 s; foley also its sample peak in dBFS)');
  console.log(['stretch', 'wind before', 'wind now', 'gusts before', 'gusts now', 'foley before', 'foley now', 'mix before', 'mix now'].join('\t'));
  for (const k of [...rows, 'moment']) console.log([k, ...['windOld', 'windNew', 'gustsOld', 'gustsNew', 'foleyOld', 'foleyNew', 'mixOld', 'mixNew'].map(r => `${result[r][k].rms} / ${result[r][k].loudest}` + (r.startsWith('foley') ? ` / ${result[r][k].peak}` : ''))].join('\t'));
  const w = result.windNew, old = result.windOld, mix = result.mixNew, foley = result.foleyNew, gusts = result.gustsNew;
  console.log(`call into the fog: wind before it ${w.beforeCall.rms} (gusts ${gusts.beforeCall.rms}), the wind's answer ${w.windAnswer.rms} (gusts ${gusts.windAnswer.rms})`);
  const climb = ['edge', 'climb', 'snow', 'step', 'mist', 'crest'];
  for (let i = 1; i < climb.length; i++) assert(w[climb[i]].rms > w[climb[i - 1]].rms - .5, `the night wind falls from ${climb[i - 1]} to ${climb[i]}`);
  assert(w.crest.rms - w.edge.rms >= 6, 'the crest is at least 6 dB windier than the bed\'s edge');
  assert(Math.abs(w.edge.rms - old.edge.rms) < .5, 'the bed\'s edge keeps its wind');
  assert(w.crest.rms - w.summitSettled.rms >= 3, 'the wind gives way at the summit');
  assert(w.summitSettled.rms < old.summitSettled.rms - 2, 'the summit\'s wind makes room for its moment');
  assert(gusts.windAnswer.rms - gusts.beforeCall.rms >= 4, 'the wind answers the call into the fog');
  const moment = mix.moment.loudest;
  for (const k of climb) assert(mix[k].loudest <= moment, `${k} (${mix[k].loudest}) is louder than the summit's moment (${moment})`);
  for (const k of climb) assert(foley[k].loudest < moment - 6, `the bird's sounds at ${k} (${foley[k].loudest}) crowd the summit's moment (${moment})`);
  console.log(`sleeping-audio-check: passed (${out})`);
} finally { await browser.close(); }
