// Shared GPU ownership for local browser checks; never run two capture browsers together.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const lock = '/tmp/updraft-chromium.lock';
export async function openBrowser({ allowAutoplay = true, angle = 'metal' } = {}) {
  for (;;) {
    try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let pid = 0, alive = true;
      try { pid = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
      if (pid) { try { process.kill(pid, 0); } catch { alive = false; } }
      let stale = !alive;
      if (!pid) { try { stale = Date.now() - fs.statSync(lock).mtimeMs > 10000; } catch { continue; } }
      if (stale) fs.rmSync(lock, {recursive: true, force: true});
      else await new Promise(r => setTimeout(r, 400));
    }
  }
  const release = () => { try { if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, {recursive:true,force:true}); } catch {} };
  process.once('exit', release);
  let browser;
  try { browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-gpu',`--use-angle=${angle}`,'--ignore-gpu-blocklist',...(allowAutoplay ? ['--autoplay-policy=no-user-gesture-required'] : [])]}); }
  catch (error) { release(); throw error; }
  const close = async () => { try { await browser.close(); } finally { release(); } };
  process.once('SIGTERM', () => void close().finally(() => process.exit(143)));
  process.once('SIGINT', () => void close().finally(() => process.exit(130)));
  return {browser,close};
}
