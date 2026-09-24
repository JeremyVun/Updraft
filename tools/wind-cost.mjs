// Where the wind step's GPU cost comes from (perf-bakes design F). Loads a chapter like frame-profile.mjs, pauses
// the loop, then:
//   census    counts what one synthetic step submits (ticks, passes, framebuffer binds, clears, readbacks), what the
//             scene submits, and what `wind.step` submits in each of five frames of the real loop.
//   variants  interleaved batches of synthetic draws, per round in ABC…CBA order, each timed to GPU completion:
//             full       step, rebind the wind textures, draw the scene (frame-profile's baseline)
//             scene      the scene alone (frame-profile's `wind` ablation)
//             step       the step alone, STEP_DRAWS per batch
//             snap       the step, then the scene reading snapshot copies: no read of what the step just wrote,
//                        and no overwrite of what the previous scene read
//             scene-snap the scene alone, reading the snapshots
//             switch21   the step's 21 materials, each into its own scratch target, reading only snapshots
//                        (same render passes, no chain), then scene-snap
//             flat21     the same 21 draws into one scratch target (one render pass), then scene-snap
//             copy3      no step: copy the live textures into the snapshots (3 passes), then the scene reads those,
//                        so one short dependency each way stands in for the step's chain
//             copy3-alt  the same, alternating two snapshot sets: the copy never overwrites what the last scene read
//             raw        the step, copied into alternating snapshot sets that the scene reads: the scene still waits
//                        for the step, but the step never overwrites what the last scene read
//             full-itN   full, with N pressure iterations instead of 24 (N/2 fused passes): a shorter chain of the same
//                        kind, to see whether the cost follows the chain's length. snap-itN and step-itN likewise.
//             calib      a fixed ALU-bound pass: its time tracks the GPU's clock and contention, not the scene
//   proc      long batches of each variant: wall time to completion per draw, and the CPU time per draw of this
//             run's Chrome GPU process and renderer (ps), to tell GPU-process command work from GPU execution.
//             A variant suffixed :drain waits for the GPU after every draw, as a frame boundary would, so no draw
//             overlaps the next.
//   loop      the real frame loop at RATIO, alternating LOOP_MS windows with and without `wind.step`, reporting
//             the mean rAF interval of each window.
// A variant suffixed @t polls the completion fence with setTimeout(0) (clamped to about 4 ms once nested, as
// frame-profile.mjs's complete() polls), @m with a MessageChannel; POLL sets the default.
// CONTEND=<iterations> adds another process's GPU load; UNCAPPED=1 runs the real loop without vsync (see below).
// Before every round the page is idle for 300 ms and the machine's GPU utilisation (ioreg) is sampled: that is
// other processes' GPU load. A round whose `scene` time is over 1.4x the chapter minimum is marked slow.
// node tools/wind-cost.mjs [washing wood sleeping ...]
// env: BASE, MODES=census,variants,loop VARIANTS=full,scene,step,snap,scene-snap,switch21,flat21,calib ROUNDS=6
//      CONTEND=<loop iterations> UNCAPPED=1 PROC_DRAWS=120
//      DRAWS=10 STEP_DRAWS=60 POLL=timeout|message RATIO=1.5 LOOP_MS=3000 LOOP_WINDOWS=8 OUT=/tmp/updraft-wind-cost
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { openBrowser } from './lib/browser.mjs';

const env = process.env;
const out = env.OUT ?? '/tmp/updraft-wind-cost';
const modes = (env.MODES ?? 'census,variants').split(',');
const variants = (env.VARIANTS ?? 'full,scene,step,snap,scene-snap,switch21,flat21,calib').split(',');
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const gpuBusy = () => {
  try { return Number(execFileSync('ioreg', ['-r', '-c', 'IOAccelerator', '-d', '1']).toString().match(/"Device Utilization %"=(\d+)/)?.[1]); }
  catch { return null; }
};
const busyProcesses = () => execFileSync('ps', ['-Ao', 'pcpu,comm']).toString().trim().split('\n').slice(1)
  .map(l => l.trim().split(/\s+/)).map(([cpu, ...c]) => ({ cpu: Number(cpu), comm: c.join(' ').split('/').pop() }))
  .sort((a, b) => b.cpu - a.cpu).slice(0, 6);

// CPU seconds so far of this run's own Chrome GPU process and renderers (children of the browser this node launched).
function ownCpu() {
  const rows = execFileSync('ps', ['-Ao', 'pid=,ppid=,time=,command=']).toString().trim().split('\n').map(l => {
    const [pid, ppid, time, ...c] = l.trim().split(/\s+/);
    const [m, sec] = time.split(':'); return { pid: +pid, ppid: +ppid, cpu: +m * 60 + +sec, command: c.join(' ') };
  });
  const browsers = new Set(rows.filter(r => r.ppid === process.pid).map(r => r.pid));
  const kids = rows.filter(r => browsers.has(r.ppid));
  const sum = type => kids.filter(r => r.command.includes('--type=' + type)).reduce((a, r) => a + r.cpu, 0);
  return { gpu: sum('gpu-process'), renderer: sum('renderer') };
}

const injection = `
window.__wind = {
  bindLive() { const u=atmo.uniforms;u.uWindTex.value=wind.texture;u.uBendTex.value=wind.bendTexture;u.uSwayTex.value=wind.swayTexture; },
  bindSnap() { this.ensure(); const u=atmo.uniforms;[u.uWindTex.value,u.uBendTex.value,u.uSwayTex.value]=this.snaps.map(t=>t.texture); },
  target(filter=THREE.LinearFilter) {
    return new THREE.WebGLRenderTarget(wind.res,wind.res,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:filter,magFilter:filter,
      wrapS:THREE.ClampToEdgeWrapping,wrapT:THREE.ClampToEdgeWrapping,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  },
  ensure() {
    if (this.snaps) return;
    this.snaps=[wind.texture,wind.bendTexture,wind.swayTexture].map(t=>{
      const rt=this.target();wind.scaleMat.uniforms.uSrc.value=t;wind.scaleMat.uniforms.uScale.value=1;wind.gpu.run(wind.scaleMat,rt);return rt;});
    this.snaps2=[0,1,2].map(()=>this.target());this.flip=0;
    this.copyMat=new THREE.ShaderMaterial({vertexShader:wind.forceMat.vertexShader,fragmentShader:'uniform sampler2D uSrc; in vec2 vUv; void main(){ gl_FragColor=texture(uSrc,vUv); }',
      uniforms:{uSrc:{value:null}},depthTest:false,depthWrite:false});
    this.scratch=Array.from({length:21},()=>this.target(THREE.NearestFilter));
    this.sequence=[wind.forceMat,wind.curlMat,wind.vorticityMat,wind.divergenceMat,wind.scaleMat,
      ...Array(12).fill(wind.pressure2Mat),wind.gradientMat,wind.advectMat,wind.bendMat,wind.swayMat];
    this.calibMat=new THREE.ShaderMaterial({vertexShader:wind.forceMat.vertexShader,depthTest:false,depthWrite:false,
      fragmentShader:'in vec2 vUv; void main(){ vec2 p=vUv; for(int i=0;i<400;i++){ p=fract(p*1.37+vec2(sin(p.y*7.1),cos(p.x*5.3))); } gl_FragColor=vec4(p,0.0,1.0); }'});
    this.calibTarget=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:false});
  },
  scene() {
    const rooms=visibleRooms(story.name,boat.position.z);setJourneyRooms(rooms);drawJourneyRooms(rooms,roomObjects,drawRooms);
  },
  step(iterations=wind.iterations) { const it=wind.iterations;wind.iterations=iterations;try{wind.step(1/60,time,false);}finally{wind.iterations=it;} },
  copy(alternate) {
    const set=alternate&&(this.flip^=1)?this.snaps2:this.snaps;
    [wind.texture,wind.bendTexture,wind.swayTexture].forEach((t,i)=>{this.copyMat.uniforms.uSrc.value=t;wind.gpu.run(this.copyMat,set[i]);});
    const u=atmo.uniforms;[u.uWindTex.value,u.uBendTex.value,u.uSwayTex.value]=set.map(t=>t.texture);
  },
  detached(separate) {
    const saved=[];const snap=this.snaps[0].texture;
    for(const m of new Set(this.sequence))for(const [k,u] of Object.entries(m.uniforms))
      if(['uVel','uCurl','uPressure','uDivergence','uBend','uSway','uSrc'].includes(k)){saved.push([u,u.value]);u.value=snap;}
    try {
      const prev=renderer.getRenderTarget();
      if(!separate){renderer.setRenderTarget(this.scratch[0]);for(const m of this.sequence){wind.gpu.quad.material=m;wind.gpu.quad.render(renderer);}}
      else for(let i=0;i<this.sequence.length;i++){renderer.setRenderTarget(this.scratch[i]);wind.gpu.quad.material=this.sequence[i];wind.gpu.quad.render(renderer);}
      renderer.setRenderTarget(prev);
    } finally { for(const [u,v] of saved)u.value=v; }
  },
  run(v) {
    renderer.info.reset();this.ensure();
    if(v==='full'){this.step();this.bindLive();this.scene();}
    else if(v==='scene'){this.bindLive();this.scene();}
    else if(v==='step'){this.step();this.bindLive();}
    else if(v==='snap'){this.step();this.bindSnap();this.scene();}
    else if(v==='scene-snap'){this.bindSnap();this.scene();}
    else if(v==='switch21'){this.detached(true);this.bindSnap();this.scene();}
    else if(v==='flat21'){this.detached(false);this.bindSnap();this.scene();}
    else if(v==='copy3'){this.copy(false);this.scene();}
    else if(v==='copy3-alt'){this.copy(true);this.scene();}
    else if(v==='raw'){this.step();this.copy(true);this.scene();}
    else if(v.startsWith('full-it')){this.step(Number(v.slice(7)));this.bindLive();this.scene();}
    else if(v.startsWith('snap-it')){this.step(Number(v.slice(7)));this.bindSnap();this.scene();}
    else if(v.startsWith('step-it')){this.step(Number(v.slice(7)));this.bindLive();}
    else if(v==='calib'){wind.gpu.run(this.calibMat,this.calibTarget);}
    else throw Error('unknown variant '+v);
  },
  count(fn) {
    const gl=renderer.getContext(),names=['bindFramebuffer','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','clear',
      'readPixels','fenceSync','clientWaitSync','getBufferSubData','useProgram','bindTexture','texImage2D','texSubImage2D','invalidateFramebuffer','blitFramebuffer','flush','finish'];
    {
      const counts={},orig={};let bound=null,lastDrawn=undefined,passes=0,targets=new Set();
      for(const n of names){orig[n]=gl[n];gl[n]=function(...a){counts[n]=(counts[n]||0)+1;
        if(n==='bindFramebuffer'&&(a[0]===gl.FRAMEBUFFER||a[0]===gl.DRAW_FRAMEBUFFER))bound=a[1];
        if(n.startsWith('draw')||n==='clear'){if(bound!==lastDrawn){passes++;lastDrawn=bound;}targets.add(bound);}
        return orig[n].apply(gl,a);};}
      let ticks=0;const substep=wind.substep;wind.substep=function(...a){ticks++;return substep.apply(this,a);};
      try{fn();}finally{for(const n of names)gl[n]=orig[n];wind.substep=substep;}
      return {ticks,renderPasses:passes,distinctTargets:targets.size,calls:counts};
    }
  },
  async censusReal(n) {
    const results=[],step=wind.step,self=this;
    wind.step=function(...a){let r;results.push(self.count(()=>{r=step.apply(this,a);}));return r;};
    window.__paused=false;
    try{await new Promise(done=>{let k=0;const f=()=>{if(++k>n)done();else requestAnimationFrame(f);};requestAnimationFrame(f);});}
    finally{window.__paused=true;wind.step=step;}
    return results;
  },
  census() {
    const count=fn=>this.count(fn);
    this.ensure();
    const texBefore=[wind.texture,wind.bendTexture,wind.swayTexture].map(t=>t.uuid);
    const step=count(()=>this.step());
    const texAfter=[wind.texture,wind.bendTexture,wind.swayTexture].map(t=>t.uuid);
    const scene=count(()=>{this.bindLive();this.scene();});
    const infoScene=(()=>{this.run('scene');return {...renderer.info.render,blades:grass.bladesDrawn};})();
    const infoFull=(()=>{this.run('full');return {...renderer.info.render,blades:grass.bladesDrawn};})();
    return {step,scene,sameTextureAfterStep:texBefore.map((u,i)=>u===texAfter[i]),infoScene,infoFull};
  },
};
`;

// UNCAPPED=1 lifts vsync and the frame-rate limit, so the real loop runs as fast as the GPU completes frames and its
// rAF interval measures throughput rather than landing on 16.7 ms multiples. Same shared lock as openBrowser.
async function openUncapped() {
  const held = await openBrowser(); await held.browser.close();
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  return { browser, close: async () => { try { await browser.close(); } finally { await held.close().catch(() => {}); } } };
}
const { browser, close } = env.UNCAPPED === '1' ? await openUncapped() : await openBrowser();
// CONTEND=<iterations> runs a second Chrome process that keeps the GPU busy with an uncapped loop of a fixed ALU-bound
// pass, standing in for another app's GPU work (a simulator, another browser): the suspected slow state.
let contender = null;
if (env.CONTEND) {
  contender = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const load = await contender.newPage({ viewport: { width: 1024, height: 1024 } });
  await load.setContent('<canvas width=1024 height=1024></canvas>');
  await load.evaluate(iterations => {
    const gl = document.querySelector('canvas').getContext('webgl2'), sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 v=vec2(gl_VertexID&1,gl_VertexID>>1)*4.0-1.0; gl_Position=vec4(v,0,1); }'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float; out vec4 o; void main(){ vec2 q=gl_FragCoord.xy/1024.0; for(int i=0;i<${iterations};i++) q=fract(q*1.37+vec2(sin(q.y*7.1),cos(q.x*5.3))); o=vec4(q,0,1); }`));
    gl.linkProgram(p); gl.useProgram(p);
    const loop = () => { gl.drawArrays(gl.TRIANGLES, 0, 3); requestAnimationFrame(loop); }; loop();
  }, Number(env.CONTEND));
}
const report = [];
try {
  for (const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['washing', 'wood', 'sleeping']) {
    const page = await browser.newPage({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(); let source = await response.text();
      source = source.replace('function frame(now) {', 'function frame(now) { if (window.__paused) { requestAnimationFrame(frame); return; }');
      assert(source.includes('window.__paused'), 'Missing pause hook');
      assert.equal(source.split('wind.step(dt, time, finalStep);').length, 2, 'Missing or ambiguous wind step');
      source = source.replace('wind.step(dt, time, finalStep);', 'if (!window.__windSkip) wind.step(dt, time, finalStep); else if (finalStep) window.__skippedTicks = (window.__skippedTicks || 0) + 1;');
      source = source.replace('frames++;', 'window.__loopFrames = (window.__loopFrames || 0) + 1; frames++;');
      await route.fulfill({ response, body: source + injection });
    });
    const ratio = env.RATIO ?? '1.5';
    await page.goto((env.BASE ?? 'http://127.0.0.1:5230/') + `?shot&start=1&ratio=${ratio}&msaa=2&analytics=0&progress=0` + (chapter === 'island' ? '' : '&chapter=' + chapter));
    await page.waitForSelector('#veil.ready', { timeout: 120000 }); await page.locator('#begin').click();
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const row = { chapter, ratio, busyBefore: busyProcesses(), gpuBusyBefore: gpuBusy() };

    if (modes.includes('loop')) {
      const windows = [];
      for (let w = 0; w < Number(env.LOOP_WINDOWS ?? 8); w++) {
        const skip = w % 4 === 1 || w % 4 === 2;
        const result = await page.evaluate(async ({ skip, ms }) => {
          window.__windSkip = skip; await new Promise(r => setTimeout(r, 500));
          const stamps = []; let on = true;
          const tick = t => { stamps.push(t); if (on) requestAnimationFrame(tick); };
          requestAnimationFrame(tick); await new Promise(r => setTimeout(r, ms)); on = false;
          const d = stamps.slice(1).map((t, i) => t - stamps[i]);
          return { skip, frames: d.length, meanMs: d.reduce((a, b) => a + b, 0) / d.length, p50: [...d].sort((a, b) => a - b)[d.length >> 1] };
        }, { skip, ms: Number(env.LOOP_MS ?? 3000) });
        result.gpuBusyAfter = gpuBusy(); windows.push(result); console.log(JSON.stringify({ chapter, loop: result }));
      }
      await page.evaluate(() => { window.__windSkip = false; });
      const mean = s => windows.filter(w => w.skip === s).map(w => w.meanMs);
      row.loop = { windows, withStep: median(mean(false)), withoutStep: median(mean(true)) };
    }

    await page.evaluate(() => { window.__paused = true; });
    await page.waitForTimeout(300);
    if (modes.includes('census')) {
      row.census = await page.evaluate(() => __wind.census());
      row.census.realFrames = await page.evaluate(() => __wind.censusReal(5));
      console.log(JSON.stringify({ chapter, census: row.census }));
    }

    if (modes.includes('proc')) {
      // Long batches, so the GPU process's CPU time (10 ms resolution in ps) resolves per draw.
      const draws = Number(env.PROC_DRAWS ?? 120), rounds = [];
      await page.evaluate(() => {
        const gl = __game.renderer.getContext(); const channel = new MessageChannel(); let wake = null; channel.port1.onmessage = () => wake?.();
        __wind.complete = async () => { const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
          try { for (;;) { const s = gl.clientWaitSync(fence, 0, 0); if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) return;
            await new Promise(r => { wake = r; channel.port2.postMessage(0); }); } } finally { gl.deleteSync(fence); } };
      });
      for (let round = 0; round < Number(env.ROUNDS ?? 6); round++) {
        const r = {};
        for (const v of round % 2 ? [...variants].reverse() : variants) {
          await page.evaluate(async v => { for (let i = 0; i < 3; i++) __wind.run(v.split(':')[0]); await __wind.complete(); }, v);
          const before = ownCpu();
          const wall = await page.evaluate(async ({ v, draws }) => {
            const [name, drain] = v.split(':'), t = performance.now();
            for (let i = 0; i < draws; i++) { __wind.run(name); if (drain) await __wind.complete(); }
            await __wind.complete(); return (performance.now() - t) / draws;
          }, { v, draws });
          const after = ownCpu();
          r[v] = { wall: +wall.toFixed(3), gpuProcess: +((after.gpu - before.gpu) * 1000 / draws).toFixed(3), renderer: +((after.renderer - before.renderer) * 1000 / draws).toFixed(3) };
        }
        rounds.push(r); console.log(JSON.stringify({ chapter, round, ...r }));
      }
      row.proc = { draws, rounds, median: Object.fromEntries(variants.map(v => [v, Object.fromEntries(['wall', 'gpuProcess', 'renderer'].map(k => [k, median(rounds.map(r => r[v][k]))]))])) };
      console.log(JSON.stringify({ chapter, proc: row.proc.median }));
    }

    if (modes.includes('variants')) {
      const rounds = [];
      for (let round = 0; round < Number(env.ROUNDS ?? 6); round++) {
        await page.waitForTimeout(300);
        const idleGpu = gpuBusy();
        const order = round % 2 ? [...variants].reverse() : variants;
        const times = await page.evaluate(async ({ order, draws, stepDraws, poll }) => {
          const gl = __game.renderer.getContext();
          const channel = new MessageChannel(); let wake = null; channel.port1.onmessage = () => wake?.();
          const byMessage = () => new Promise(r => { wake = r; channel.port2.postMessage(0); }), byTimeout = () => new Promise(r => setTimeout(r, 0));
          let yieldOnce = poll === 'message' ? byMessage : byTimeout;
          async function complete() {
            const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); const end = performance.now() + 20000;
            try { for (;;) { const s = gl.clientWaitSync(fence, 0, 0); if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) return;
              if (s === gl.WAIT_FAILED || performance.now() > end) throw Error('GPU completion timeout'); await yieldOnce(); } }
            finally { gl.deleteSync(fence); }
          }
          const t = {};
          for (const name of order) {
            const [v, how] = name.split('@');
            yieldOnce = how === 't' ? byTimeout : how === 'm' ? byMessage : poll === 'message' ? byMessage : byTimeout;
            const n = v.startsWith('step') ? stepDraws : v === 'calib' ? 20 : draws;
            for (let i = 0; i < 3; i++) __wind.run(v); await complete();
            const start = performance.now(); for (let i = 0; i < n; i++) __wind.run(v); await complete();
            t[name] = (performance.now() - start) / n;
          }
          const idle = performance.now(); await complete(); t.idleFence = performance.now() - idle;
          return t;
        }, { order, draws: Number(env.DRAWS ?? 10), stepDraws: Number(env.STEP_DRAWS ?? 60), poll: env.POLL ?? 'timeout' });
        rounds.push({ idleGpu, ...times });
        console.log(JSON.stringify({ chapter, round, idleGpu, ...Object.fromEntries(Object.entries(times).map(([k, v]) => [k, +v.toFixed(2)])) }));
      }
      const key = variants.find(v => v.startsWith('scene')) ?? variants[0];
      const floor = Math.min(...rounds.map(r => r[key]));
      for (const r of rounds) r.state = r[key] > floor * 1.4 ? 'slow' : 'fast';
      const summary = {};
      for (const state of ['fast', 'slow']) {
        const rs = rounds.filter(r => r.state === state); if (!rs.length) continue;
        summary[state] = { rounds: rs.length, ...Object.fromEntries([...variants, 'idleFence'].map(v => [v, +median(rs.map(r => r[v])).toFixed(3)])) };
      }
      row.variants = { rounds, summary };
      console.log(JSON.stringify({ chapter, summary }));
    }
    row.errors = errors; report.push(row);
    await fs.writeFile(out + '.json', JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'Browser errors invalidate the run');
    await page.close();
  }
} finally { await contender?.close(); await close(); }
