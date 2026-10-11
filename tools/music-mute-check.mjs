// Render both background routes and effects through the production graph; no GPU needed.
import assert from 'node:assert/strict';
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const checks = [];
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const rms = (buffer, from, to) => {
      const data = buffer.getChannelData(0);
      let sum = 0;
      const a = Math.floor(from * buffer.sampleRate), b = Math.floor(to * buffer.sampleRate);
      for (let i = a; i < b; i++) sum += data[i] ** 2;
      return Math.sqrt(sum / (b - a));
    };
    for (const route of ['backgroundBus', 'backgroundDry', 'backgroundWet', 'musicBus', 'master', 'reverb']) {
      const { ctx, sound } = offlineSound(12);
      while (sound.synthesis.length) sound.synthesise(1);
      const tone = ctx.createOscillator(), level = ctx.createGain();
      level.gain.value = .1;
      tone.connect(level).connect(sound[route]);
      tone.start();
      const off = ctx.suspend(2).then(() => { sound.setMusicMuted(true); return ctx.resume(); });
      const on = ctx.suspend(9).then(() => { sound.setMusicMuted(false); return ctx.resume(); });
      const buffer = await ctx.startRendering();
      await Promise.all([off, on]);
      const before = rms(buffer, 1, 2), muted = rms(buffer, 8, 9), after = rms(buffer, 11, 12);
      check(before > 1e-4 && after > 1e-4, `${route}: audible before mute and after unmute`);
      check(route.startsWith('background') ? muted < 1e-7 : muted > before * .5,
        `${route}: ${route.startsWith('background') ? 'music and its reverb fade to silence' : 'effects remain audible'}`);
    }

    const sound = new audioModule.Soundscape();
    sound.setMusicMuted(true);
    sound.start();
    const ctx = sound.ctx;
    await ctx.resume();
    check(sound.musicDryGain.gain.value === 0 && sound.musicWetGain.gain.value === 0,
      'Music muted before Begin starts with both routes silent');
    const output = sound.output;
    sound.update(.1, { ...baseState, music: 'boats' });
    const score = sound.boatsScore;
    sound.update(.1, { ...baseState, music: 'boats' });
    check(!score && !sound.boatsScore && !sound.preparedScore && sound.running && sound.output === output,
      'Music disabled before entry skips recording preparation while audio clock and effects remain running');
    sound.update(.1, { ...baseState, music: 'forest' });
    check(sound.musicDryGain.gain.value === 0 && sound.musicWetGain.gain.value === 0,
      'A chapter change cannot override music mute');
    sound.setMuted(true);
    await ctx.suspend();
    sound.setMusicMuted(false);
    check(!sound.running && ctx.state === 'suspended', 'Music toggle does not override mute-all');
    sound.setMusicMuted(true);
    sound.setMuted(false);
    await ctx.resume();
    check(sound.musicMuted && sound.running, 'Unmuting all sound preserves music mute');
    await ctx.close();
    return checks;
  });
  assert(checks.length > 0);
  console.log(`${checks.length} music mute checks passed:\n${checks.join('\n')}`);
} finally { await browser.close(); }
