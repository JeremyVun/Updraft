// Leaving the Sky Mirror: the seam each leave time chooses, the scheduled Home start, and an offline render that the
// Mirror is silent from its seam and Home begins `homeStartAfter` after leaving. Recorded Home lifecycle too.
// node tools/homeward-audio-check.mjs (Vite on 5230, or BASE).
import { audioPage } from './lib/audio-render.mjs';
import { checkRecordedScore } from './lib/recorded-score-check.mjs';
const { browser, page } = await audioPage();
try {
  const { checks, renders } = await page.evaluate(async () => {
    const { ArrivalTransition } = await import('/src/audio/arrival-music.ts');
    const { mirrorEnding, MIRROR_SEAMS } = await import('/src/audio/mirror-seams.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;
    const length = 214.884;
    const audio = { ...tuning.audio };
    Object.assign(tuning.audio, { homeStartAfter: 12.5, mirrorSeamLead: 5, mirrorSeamSoonest: .3, mirrorSeamRelease: 1.2, mirrorSeamLatest: 1, mirrorFallbackFade: 3 });
    try {
      check(MIRROR_SEAMS.every((seam, i) => seam >= 0 && seam < length && (i === 0 || seam > MIRROR_SEAMS[i - 1])), 'Seams are ordered within the recording');
      const end = (position, homeIn = 12.5) => mirrorEnding(position, homeIn, length);
      check(near(end(0).at, 7.22), 'From the top: the latest seam five seconds before Home');
      check(near(end(60, 40).at, 31.34), 'A later Home lets the Mirror play on to a later seam');
      check(near(end(211).at, length - 211 + .32), 'Across the loop: the piece rings out to its end');
      check(near(end(205).at, 4.71), 'Before the loop: its last rest');
      check(near(end(100).at, .42) && near(end(100).release, .42), 'A seam just ahead still counts, its release shortened');
      check(near(end(100.2).at, 10.52), 'Too close to schedule: the next seam, still a second before Home');
      check(near(end(145).at, 9.71), 'No seam five seconds ahead: the earliest still a second before Home');
      const fallback = end(140);
      check(near(fallback.at, 3) && near(fallback.release, 3), 'No seam in time: a three-second fade at once');
      check(near(end(140, 2).at, 2), 'The fallback fade never runs past Home');

      // Stages: the Mirror keeps playing to its seam, silence, then Home exactly on time.
      const mirror = { ...baseState, music: 'mirror', mirrorScore: 'depart', hush: .5, flockChatter: false };
      const leaving = t => ({ ...mirror, arrivalMusic: 'home', homewardTime: t });
      const t = new ArrivalTransition(); t.update(mirror, 10);
      const first = t.update(leaving(0), 20, 20, false, { position: 0, length });
      check(first.stage === 'wait' && near(first.handoffAt, 27.22) && near(first.release, 1.2), 'Leaving holds the Mirror to its seam');
      check(t.update(leaving(7.2), 27.2).stage === 'wait' && t.update(leaving(7.3), 27.3).stage === 'gap', 'Silence from the seam');
      check(t.update(leaving(12.49), 32.49).stage === 'gap' && t.update(leaving(12.5), 32.5).stage === 'incoming', 'Home on the crossing clock');
      const late = new ArrivalTransition(); late.update(mirror, 0);
      check(late.update(leaving(0), 1).stage === 'gap', 'A Mirror not yet sounding leaves silence at once');
      check(late.update(leaving(2), 3).stage === 'gap', 'Still silent before Home');
      // Suspended audio (mute-all): the crossing clock ran on, so Home is not late for the boat.
      check(late.update(leaving(12.6), 3.1).stage === 'incoming', 'Home follows the crossing through suspended audio');
      const qa = new ArrivalTransition();
      check(qa.update(leaving(3), 50).homeAt === 59.5, 'A QA or restored crossing counts from its own start');
      const home = { ...baseState, music: 'home', summitScore: 'approach' };
      tuning.audio.homeStartAfter = 60;
      const long = new ArrivalTransition(); long.update(mirror, 0); long.update(leaving(0), 0);
      check(long.update(leaving(41.9), 41.9).stage === 'gap' && long.update(home, 59.9).stage === 'gap'
        && long.update(home, 60.01).stage === 'incoming', 'Home keeps its time from leaving across landing');
      check(long.update(home, 61).stage === 'none', 'The handoff finishes once landed');
      tuning.audio.homeStartAfter = 12.5;

      // Rendered: the Mirror from a set point, leaving two seconds in, the background alone.
      const render = async (offset, expectSilent) => {
        const seconds = 17, leave = 2, { ctx, sound } = offlineSound(seconds);
        backgroundOnly(ctx, sound);
        const state = tick => tick / 8 < leave ? mirror : leaving(tick / 8 - leave);
        sound.update(.125, state(0)); sound.mirrorScore.offset = offset;
        await sound.mirrorScore.ready;
        const mirrorEpoch = sound.mirrorScore.epoch;
        let homeEpoch = null, ending = null;
        let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
        for (let tick = 1; tick < seconds * 8; tick++) {
          await pause;
          const before = sound.mirrorScore;
          sound.update(.125, state(tick));
          if (tick / 8 === leave) ending = { stage: sound.arrivalTransition.stage, seam: before && before.endsAt };
          await sound.preparedScore?.ready; await sound.summitScore?.ready;
          if (homeEpoch === null && sound.summitScore?.source) homeEpoch = sound.summitScore.epoch;
          if (tick + 1 < seconds * 8) pause = ctx.suspend((tick + 1) / 8);
          await ctx.resume();
        }
        const buffer = await rendering, rate = buffer.sampleRate;
        const peak = (from, to) => {
          let p = 0;
          for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = Math.ceil(from * rate); i < Math.min(data.length, Math.floor(to * rate)); i++) p = Math.max(p, Math.abs(data[i]));
          }
          return p;
        };
        const position = offset + leave - mirrorEpoch, silentFrom = Math.min(ending.seam, leave + 12.5);
        return { offset, position, seam: ending.seam, homeEpoch, expectSilent, 
          before: peak(silentFrom - 1.6, silentFrom - 1.2), tail: peak(silentFrom - .3, silentFrom),
          gap: peak(silentFrom + 1 / rate, homeEpoch), home: peak(homeEpoch, homeEpoch + 1) };
      };
      const renders = [await render(93, 100.42 - 95), await render(209, length + .32 - 211), await render(138, 3)];
      for (const r of renders) {
        check(Math.abs(r.seam - 2 - r.expectSilent) < .01, `Mirror at ${r.position.toFixed(2)} s: silent ${(r.seam - 2).toFixed(2)} s after leaving`);
        check(r.position > 200 || r.before > 1e-3, `Mirror at ${r.position.toFixed(2)} s: heard as it fades`);
        check(r.gap === 0, `Mirror at ${r.position.toFixed(2)} s: nothing sounds from then until Home`);
        check(Math.abs(r.homeEpoch - 14.5) <= .006, `Home begins ${(r.homeEpoch - 2).toFixed(3)} s after leaving`);
        check(r.home > 1e-3, 'Home is heard at once');
      }
      return { checks, renders };
    } finally { Object.assign(tuning.audio, audio); }
  });
  // A dropped download is fetched again rather than silencing Home for the session.
  let requests = 0;
  await page.route(/\/home(?:-[\w-]+)?\.ogg/, route => ++requests === 1 ? route.abort('connectionreset') : route.continue());
  const retried = await page.evaluate(async () => {
    const { decodeMusic } = await import('/src/audio/music-loading.ts');
    return (await decodeMusic(new OfflineAudioContext(2, 24000, 24000), 'home', new AbortController().signal)).duration;
  });
  await page.unroute(/\/home(?:-[\w-]+)?\.ogg/);
  if (!(retried > 170 && requests === 2)) throw Error('A failed Home download is retried');
  checks.push('A failed Home download is retried');
  checks.push(...await checkRecordedScore(page, 'home'));
  console.log(JSON.stringify({ renders, checks }, null, 2));
} finally { await browser.close(); }
