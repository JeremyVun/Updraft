// No GPU: exercise event budgets and render production voices. Requires the Vite dev server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { BirchesFoley } = await import('/src/audio/birches-foley.ts');
    const { Foley } = await import('/src/audio/foley.ts');
    const { tuning } = await import('/src/tuning.ts');
    const checks = [], runs = [], renders = [];
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const camera = new THREE.PerspectiveCamera(50, 1.6, .1, 1000);
    camera.position.set(0, 6, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const at = new THREE.Vector3(4, 0, 0), far = new THREE.Vector3(0, 0, -200);
    for (const fps of [10, 30, 60, 144]) {
      let time = 0;
      const calls = [], controller = new BirchesFoley({ material: (kind, level, pan) => calls.push({ kind, level, pan, time }) }, camera);
      // Many potential disturbances still share one budget with walking.
      for (let i = 0; i < fps * 20; i++) {
        time = i / fps; controller.update(1 / fps);
        controller.step(at, Math.floor(time * 3), 1, true);
        for (let source = 0; source < 100; source++) controller.scuff(at, 1, true);
        const phase = time * Math.PI / 2;
        controller.swing(at, .65 * Math.sin(phase), .65 * Math.PI / 2 * Math.cos(phase), 1, true);
      }
      for (const [kind, every] of [['leaf-scuff', tuning.audio.leafScuffEvery], ['swing-creak', tuning.audio.swingCreakEvery]]) {
        const events = calls.filter(c => c.kind === kind);
        check(events.length > 2 && events.length <= Math.ceil(20 / every), `${fps} Hz: ${kind} stays within its room-wide budget`);
        check(events.every((e, i) => !i || e.time - events[i - 1].time >= every - .00001), `${fps} Hz: no burst between allowed ${kind} events`);
        check(events.every(e => e.pan > 0 && e.level <= .5), `${fps} Hz: ${kind} is quiet and follows its source`);
      }
      runs.push({ fps, leaves: calls.filter(c => c.kind === 'leaf-scuff').length,
        creaks: calls.filter(c => c.kind === 'swing-creak').length });
    }

    const calls = [], c = new BirchesFoley({ material: (...a) => calls.push(a) }, camera);
    c.step(at, 200, 1, true); c.swing(at, .6, -.4, 1, true);
    check(!calls.length, 'Entering a checkpoint establishes baselines without phantom steps or creaks');
    for (let i = 0; i < 100; i++) {
      c.update(.1); c.step(at, 200, 1, true);
      c.swing(at, .6, i % 2 ? .04 : -.04, 1, true);
    }
    check(!calls.length, 'Standing still and speed jitter without swing travel are silent');
    c.step(at, 201, .1, true);
    c.scuff(far, 1, true); c.scuff(at, 1, false);
    check(!calls.length, 'Bare ground, distant piles and muted kicks are silent');
    c.step(at, 202, 1, false); c.swing(at, -.6, .4, 1, false);
    c.update(5); c.step(at, 230, 1, true); c.swing(at, .6, -.4, 1, true);
    check(!calls.length, 'Mute/resume discards missed steps and swing reversals');
    c.step(at, 231, 1, true);
    check(calls.length === 1, 'A new real contact after resume sounds normally');
    c.update(2); c.step(at, 0, 1, true);
    check(calls.length === 1, 'Resetting a walking phase cannot emit a footstep');
    const quiet = new BirchesFoley({ material: (...a) => calls.push(a) }, camera);
    for (let i = 0; i < 600; i++) {
      quiet.update(1 / 60); quiet.swing(at, .05 * Math.sin(i / 30), .1 * Math.cos(i / 30), 0, true);
    }
    check(calls.length === 1, 'Tiny idle swing oscillations never creak');

    for (const kind of ['leaf-scuff', 'swing-creak']) {
      const { ctx, sound } = offlineSound(3);
      sound.master.gain.cancelScheduledValues(0); sound.master.gain.value = .9;
      const foley = new Foley(); foley.setOutput(sound.output);
      let made = 0, ended = 0;
      const create = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = () => {
        made++; const source = create(), disconnect = source.disconnect.bind(source);
        source.disconnect = (...args) => { ended++; return disconnect(...args); }; return source;
      };
      foley.material(kind, kind === 'leaf-scuff' ? .4 : .5, .6);
      const count = made; foley.setOutput(null); foley.material(kind, 1, 0);
      check(count === made, `${kind}: no voice queues while output is disabled`);
      const buffer = await ctx.startRendering();
      check(made > 0 && made === ended, `${kind}: all source nodes disconnect`);
      const { pcm: _, ...metrics } = encodeAudio(buffer); renders.push({ kind, ...metrics });
    }

    // Isolated audition at game gain: walking/pile scuffs, then a loaded swing, with real spacing.
    const { ctx, sound } = offlineSound(19);
    const foley = new Foley(); foley.setOutput(sound.output);
    const events = [[1,'leaf-scuff',.24],[2.8,'leaf-scuff',.21],[4.7,'leaf-scuff',.4],
      [9,'swing-creak',.3],[13,'swing-creak',.5],[17,'swing-creak',.38]];
    for (const [time, kind, level] of events) {
      Object.defineProperty(ctx, 'currentTime', { configurable: true, value: time });
      foley.material(kind, level, time < 8 ? -.2 : .2);
    }
    delete ctx.currentTime;
    return { checks, runs, renders, audition: encodeAudio(await ctx.startRendering()) };
  });
  for (const render of [...report.renders, report.audition]) {
    assert.equal(render.clipped, 0); assert(Number.isFinite(render.peakDbFS));
    assert(render.peakDbFS < -30 && render.peakDbFS > -65,
      `${render.kind ?? 'audition'} must remain restrained but nonzero: ${render.peakDbFS} dBFS`);
  }
  fs.writeFileSync('/tmp/updraft-birches-foley.wav', wav(Buffer.from(report.audition.pcm, 'base64')));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', '/tmp/updraft-birches-foley.wav',
    '-c:a', 'libmp3lame', '-b:a', '192k', '/tmp/updraft-birches-foley.mp3']);
  delete report.audition.pcm;
  fs.writeFileSync('/tmp/updraft-birches-foley.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, runs: report.runs, renders: report.renders }));
} finally { await browser.close(); }
