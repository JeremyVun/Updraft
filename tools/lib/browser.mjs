// GPU access for local browser checks. Captures run on fixed steps, so several share the GPU (GPU_SLOTS browsers at
// once, for memory); tools that time real frames pass `exclusive` and wait until nothing else is capturing.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
// Checkouts on older tools still take the gate as a plain mutex, so they and exclusive runs keep out of each other.
const gate = '/tmp/updraft-chromium.lock', holders = '/tmp/updraft-gpu-holders';
const slots = Number(process.env.GPU_SLOTS ?? 4);
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.random() * 200));
// A dead tool's pid can be reused by an unrelated process, which would hold the GPU forever; its start time tells them apart.
const started = pid => { try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'}).trim() || null; } catch { return null; } };
const me = started(process.pid) ?? '';
const alive = (pid, since) => {
  try { process.kill(pid, 0); } catch (error) { if (error.code !== 'EPERM') return false; }
  return !since || started(pid) === since;
};
let serial = 0;

function gateHolder() {
  let pid = 0, since = '';
  try { [pid, since = ''] = fs.readFileSync(`${gate}/pid`, 'utf8').split('\n'); pid = Number(pid); } catch {}
  let stale;
  try { stale = pid ? !alive(pid, since) : Date.now() - fs.statSync(gate).mtimeMs > 10000; } catch { return null; }
  if (stale) { fs.rmSync(gate, {recursive: true, force: true}); return null; }
  return {pid, exclusive: fs.existsSync(`${gate}/exclusive`)};
}

function liveHolders() {
  const live = [];
  for (const name of fs.readdirSync(holders)) {
    const pid = Number(name.split('-')[0]);
    let since = '';
    try { since = fs.readFileSync(`${holders}/${name}`, 'utf8'); } catch {}
    if (alive(pid, since)) live.push(pid); else fs.rmSync(`${holders}/${name}`, {force: true});
  }
  return live;
}

async function share() {
  const mine = `${holders}/${process.pid}-${serial++}`;
  for (let told = false;;) {
    const before = gateHolder();
    if (!before?.exclusive) {
      fs.writeFileSync(mine, me);
      const owner = gateHolder(), count = liveHolders().length;
      if (!owner?.exclusive && count <= slots) return () => fs.rmSync(mine, {force: true});
      fs.rmSync(mine, {force: true});
      if (!told && !owner?.exclusive) { told = true; console.error(`Waiting for one of ${slots} GPU slots (GPU_SLOTS)`); }
    }
    if (!told && before?.exclusive) { told = true; console.error(`Waiting for the GPU: a timing run (pid ${before.pid}) has it alone`); }
    await sleep(400);
  }
}

async function own() {
  for (let told = false;;) {
    try { fs.mkdirSync(gate); fs.writeFileSync(`${gate}/exclusive`, ''); fs.writeFileSync(`${gate}/pid`, `${process.pid}\n${me}`); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = gateHolder();
      if (holder && !told) { told = true; console.error(`Waiting for the GPU: pid ${holder.pid} has it alone`); }
      await sleep(400);
    }
  }
  for (let told = false, live; (live = liveHolders()).length; await sleep(400))
    if (!told) { told = true; console.error(`Waiting for the GPU to itself: captures running (pids ${[...new Set(live)].join(', ')})`); }
  return () => { try { if (Number(fs.readFileSync(`${gate}/pid`, 'utf8').split('\n')[0]) === process.pid) fs.rmSync(gate, {recursive: true, force: true}); } catch {} };
}

// For tools that launch their own browser: resolves once the GPU is theirs, with the function that gives it back.
export async function holdGpu({ exclusive = false } = {}) {
  fs.mkdirSync(holders, {recursive: true});
  const release = exclusive ? await own() : await share();
  process.once('exit', release);
  return release;
}

export async function openBrowser({ allowAutoplay = true, exclusive = false, angle = process.env.ANGLE ?? (process.platform === 'darwin' ? 'metal' : 'default') } = {}) {
  const release = await holdGpu({exclusive});
  let browser;
  try { browser = await chromium.launch({channel:'chromium',headless:true,args:['--enable-gpu',...(angle === 'default' ? [] : [`--use-angle=${angle}`]),...(allowAutoplay ? ['--autoplay-policy=no-user-gesture-required'] : [])]}); }
  catch (error) { release(); throw error; }
  const close = async () => { try { await browser.close(); } finally { release(); } };
  process.once('SIGTERM', () => void close().finally(() => process.exit(143)));
  process.once('SIGINT', () => void close().finally(() => process.exit(130)));
  return {browser,close};
}
