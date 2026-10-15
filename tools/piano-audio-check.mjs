// Check the real piano entry state machine and its single background fade without a renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { PianoStop } = await import('/src/story/piano.ts');
    const { MeadowChapter } = await import('/src/story/meadow.ts');
    const { piano } = await productionModule('/src/world/piano.ts');
    const { windBough } = await productionModule('/src/world/wind-bough.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const results = [];
    for (const fps of [10, 30, 60, 144]) for (const walkFor of [2, 12]) {
      const stop = new PianoStop(), notes = [], trace = [];
      const child = { position: piano.stand.clone(), yaw: 0, moving: true, lookAt: null, lean: 0,
        faceToward() {}, reachFor() {}, ride(at, yaw) { this.position.copy(at); this.yaw = yaw; } };
      const cast = { child };
      // Hand/companion geometry does not decide the audio handover.
      stop.playHands = stop.onTheKeys = () => {};
      stop.to('walking');
      piano.expect = null; piano.matched = 0;
      // The bough's first call is the demonstration now: the piano waits for her answer.
      windBough.reset();
      const call = windBough.play.bind(windBough);
      windBough.play = (phrase, time, finale) => {
        notes.push({ kind: 'demonstration', time: stop.now, mix: stop.hush });
        return call(phrase, time, finale);
      };
      for (let i = 1; i <= (walkFor + 8) * fps; i++) {
        const time = i / fps;
        if (stop.at === 'walking' && time >= walkFor) stop.to('looking');
        const before = stop.at;
        stop.hold(1 / fps, time, cast);
        trace.push({ time, beat: before, mix: stop.hush });
        if (notes.length >= 1) break;
      }
      if (trace.some(s => ['walking', 'looking'].includes(s.beat) && s.mix !== 0)) throw Error('Approach lost background music');
      const demo = notes.find(n => n.kind === 'demonstration');
      if (!demo || demo.mix !== 1) throw Error('The background has not faded by the bough\'s first call');
      if (piano.log.length) throw Error('The piano sounded before the bough\'s first call');
      const fades = trace.filter(s => s.mix > 0);
      for (let i = 1; i < fades.length; i++) {
        if (fades[i].mix < fades[i - 1].mix || fades[i].mix - fades[i - 1].mix > 0.075) throw Error('Abrupt or reversing entry fade');
      }
      const room = Object.assign(Object.create(MeadowChapter.prototype), { beatHush: 0.2, piano: stop, song: { hush: 0 } });
      if (room.hush !== 0.2 || room.pianoMix !== 1) throw Error('Piano was ducked twice');
      // Resume the walk: score fades back without changing the separately held gesture ownership gate.
      stop.to('done'); child.position.x += 100;
      for (let i = 0; i < fps * (tuning.piano.fadeIn + 0.2); i++) stop.hold(1 / fps, stop.now + 1 / fps, cast);
      if (stop.hush !== 0 || piano.engaged) throw Error('Background failed to return on departure');
      stop.hushed = stop.hushProgress = 1; stop.restoreDone();
      if (stop.hush !== 0) throw Error('Completed checkpoint retained piano ducking');
      results.push({ fps, walkFor, fadeStarts: fades[0].time, demo });
    }
    return results;
  });
  assert.equal(report.length, 8);
  fs.writeFileSync('/tmp/updraft-piano-audio-check.json', JSON.stringify(report, null, 2));
  console.log('Piano approach, one fade before the bough\'s first call, a silent piano, departure and restoration passed at 10–144 Hz.');
  console.log(JSON.stringify(report.filter(r => r.fps === 60)));
} finally { await browser.close(); }
