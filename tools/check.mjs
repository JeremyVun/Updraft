// Discoverable local gates. Browser groups run sequentially and use the shared GPU capture lock.
// Usage: node tools/check.mjs quick|mechanics|browser|release. BASE selects the running dev server.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const quick = [
  'shader', 'water-texture', 'progress-schema', 'nearby', 'camera-parity', 'pointer-contact',
  'chapter-view', 'flock-audio', 'frame-time', 'wind-clock', 'wind-gesture-logic', 'quality',
  'boot-cloth', 'analytics',
];
const mechanics = [
  ...quick, 'bandage-cost', 'boat', 'boat-ground', 'flock-flight', 'journey-pacing', 'kite-logic',
  'little-boats-logic', 'meadow-plane', 'meadow-route', 'piano-frame', 'pond-view', 'sail-flutter',
  'scarf-geometry', 'sea-logic', 'sky-mirror-logic', 'sky-mirror-pointer', 'sky-mirror-touch',
  'sleeping-logic', 'wing-care', 'wood-logic', 'ending-view',
];
const browser = [
  'shader-browser', 'touch-viewport', 'chapter-view-browser', 'context-loss', 'start',
  'progress', 'frame-time-browser', 'journey-view',
];
const groups = { quick, mechanics, browser, release: [...mechanics, ...browser, 'playthrough'] };
const group = process.argv[2] ?? 'quick';
if (!Object.hasOwn(groups, group)) {
  throw new Error(`Unknown group ${group}; choose ${Object.keys(groups).join(', ')}`);
}
const output = process.env.CHECK_OUTPUT ?? `/tmp/updraft-${group}-${Date.now()}`;
fs.mkdirSync(output, { recursive: true });
const report = [];
let child;
let interrupted = 0;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  interrupted = signal === 'SIGINT' ? 130 : 143;
  if (child) child.kill(signal);
  else process.exit(interrupted);
});

console.log(`Running ${group}; evidence: ${output}`);
for (const name of groups[group]) {
  const stem = name === 'sky-mirror-touch' ? 'sky-mirror-pointer' : name;
  const file = name === 'playthrough' ? 'playthrough.mjs' : `${stem}-check.mjs`;
  const log = path.join(output, `${name}.log`);
  const fd = fs.openSync(log, 'w');
  const started = performance.now();
  const args = [path.join(root, 'tools', file)];
  if (['playthrough', 'journey-view'].includes(name)) args.push(path.join(output, name));
  const env = { ...process.env };
  if (name === 'sky-mirror-touch') env.TOUCH = '1';
  else if (name === 'sky-mirror-pointer') env.TOUCH = '0';

  console.log(`START ${name}`);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', fd, fd], env });
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
  } finally {
    fs.closeSync(fd);
    child = null;
  }
  if (interrupted) process.exit(interrupted);
  const result = { name, exitCode: code, seconds: Math.round((performance.now() - started) / 10) / 100, log };
  report.push(result);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(result));
  if (code) {
    console.error(fs.readFileSync(log, 'utf8').slice(-5000));
    process.exitCode = 1;
  }
}
