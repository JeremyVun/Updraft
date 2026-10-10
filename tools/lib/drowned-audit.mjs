import fs from 'node:fs';

export async function beginDrownedAudit(page) {
  page.on('console', message => { if (message.text().startsWith('rescue timing:')) console.log(message.text()); });
  await page.evaluate(async () => {
    const g = __game, sound = g.sound;
    let uniforms;
    g.scene.traverse(object => {
      if (object.material?.uniforms?.uSeaFog) uniforms = object.material.uniforms;
    });
    if (!uniforms) throw new Error('Live fog uniforms not found');
    sound.start();
    await sound.ctx.resume();
    const output = sound.ctx.createMediaStreamDestination();
    sound.master.connect(output);
    const recorder = new MediaRecorder(output.stream), chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    const audit = window.__drownedAudit = { samples: [], events: [], recorder, chunks, output };
    const phrase = sound.phrase.bind(sound);
    const chime = sound.chime.bind(sound);
    let currentCue = null;
    sound.chime = function(...args) {
      if (currentCue === 'becalmed') audit.events.push({ event: 'tone-note', game: __stats.time, at: args[3], midi: args[0] });
      return chime(...args);
    };
    sound.phrase = function(name) {
      if (name === 'becalmed') audit.events.push({ event: 'tone', game: __stats.time, audio: sound.ctx.currentTime });
      currentCue = name;
      try { return phrase(name); } finally { currentCue = null; }
    };
    let previous = '', sampled = -1;
    const tick = () => {
      const chapter = g.story.current, rescue = chapter.cat, bank = g.village.dark;
      const state = { game: __stats.time, audio: sound.ctx.currentTime, beat: chapter.beat,
        catStep: rescue?.step, rescuing: rescue?.rescuing, released: rescue?.released, sailingFrom: chapter.sailingFrom,
        shaking: g.cat.shaking, busy: g.cat.busy, quiet: chapter.drownedQuiet,
        speed: g.boat.speed, becalmed: g.boat.becalmed, breeze: chapter.breeze,
        boat: g.boat.position.toArray(), child: g.child.position.toArray(), camera: g.rig.camera.position.toArray(),
        fog: uniforms.uSeaFog.value.toArray(), shape: uniforms.uSeaFogShape.value.toArray(),
        clearing: uniforms.uSeaFogClear.value.toArray(), front: bank.front, stage: chapter.run?.stage };
      const key = [state.beat, state.catStep, state.rescuing, state.released, state.shaking, state.quiet, state.sailingFrom].join('/');
      if (key !== previous) {
        previous = key;
        audit.events.push({ event: key, ...state });
        console.log(`rescue timing: ${JSON.stringify(state)}`);
      }
      if (state.game - sampled >= .1) { audit.samples.push(state); sampled = state.game; }
      audit.frame = requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function endDrownedAudit(page, prefix) {
  const result = await page.evaluate(async () => {
    const audit = window.__drownedAudit;
    if (!audit) return null;
    cancelAnimationFrame(audit.frame);
    await new Promise(resolve => { audit.recorder.onstop = resolve; audit.recorder.stop(); });
    const bytes = new Uint8Array(await new Blob(audit.chunks).arrayBuffer());
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { samples: audit.samples, events: audit.events, audio: btoa(text) };
  });
  if (!result) return;
  fs.writeFileSync(`${prefix}.webm`, Buffer.from(result.audio, 'base64'));
  delete result.audio;
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(result));
}
