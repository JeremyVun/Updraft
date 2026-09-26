// Isolated production Web Audio, without booting the game or using the GPU.
import { chromium } from 'playwright-core';

export async function audioPage(base = process.env.BASE ?? 'http://127.0.0.1:5230/') {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await browser.newPage();
    await page.route('**/__audio_review', r => r.fulfill({ contentType: 'text/html', body: '<title>Audio review</title>' }));
    await page.goto(new URL('__audio_review', base).href);
    await page.evaluate(async () => {
      // Vite may add HMR timestamps to dependencies. Reuse their exact URL so singleton cues/piano agree.
      window.productionModule = file => import(performance.getEntriesByType('resource')
        .findLast(r => new URL(r.name).pathname === file)?.name ?? file);
      window.audioModule = await import('/src/audio/audio.ts');
      window.baseState = { gust: 0, pan: 0, rise: 1, charge: 0, overLand: true,
        breeze: 0.3, gliderLift: 0, life: 1, night: 0, sea: 0.6, meadow: 0, land: 1, cold: 0,
        shower: 0, hush: 0, piano: 0, music: 'meadow', scripted: false, silence: false, cues: [] };
      window.offlineSound = seconds => {
        const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 24000), 24000);
        const Native = window.AudioContext;
        window.AudioContext = function () { return ctx; };
        const sound = new audioModule.Soundscape();
        try { sound.start(); } finally { window.AudioContext = Native; }
        Object.defineProperty(sound, 'running', { get: () => true });
        return { ctx, sound };
      };
      // The background alone: its dry sound and its send into the shared reverb, each after its gate.
      window.backgroundOnly = (ctx, sound) => {
        sound.master.disconnect(); sound.backgroundGate.disconnect();
        sound.backgroundGate.connect(ctx.destination); sound.wetDuck.connect(ctx.destination);
      };
      window.encodeAudio = buffer => {
        const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
        const pcm = new Int16Array(buffer.length * 2);
        let peak = 0, power = 0, clipped = 0;
        for (let i = 0; i < buffer.length; i++) for (let ch = 0; ch < 2; ch++) {
          const v = channels[ch][i];
          peak = Math.max(peak, Math.abs(v)); power += v * v;
          if (Math.abs(v) >= 1) clipped++;
          pcm[i * 2 + ch] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        return { pcm: btoa(binary), peakDbFS: 20 * Math.log10(peak),
          rmsDbFS: 10 * Math.log10(power / pcm.length), clipped };
      };
    });
    return { browser, page };
  } catch (error) { await browser.close(); throw error; }
}

export function wav(samples, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + samples.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}
