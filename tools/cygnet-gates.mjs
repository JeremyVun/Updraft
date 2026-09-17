// Numeric gates for the cygnet and the child: plays every shared moment and way of moving on the QA stage
// (?chapter=stage) and fails if anything pops, slides or lets go. "Seamless" as numbers, from src/companion/probe.ts.
// Usage: node tools/cygnet-gates.mjs            (needs a dev server; BASE as for tools/play.mjs)
//   jerk  worst change in the cygnet's body velocity in one frame, world units (a pop is a spike)
//   turn  worst change in which way its body faces in one frame, radians
//   gap   worst distance from a mitten to the place on the cygnet it is holding, once the hands have arrived
//   slip  worst distance a planted foot moved in one frame
//   sunk  worst depth of its feet below the ground
// A landing and a face-plant are meant to be abrupt, so `try` allows more jerk than anything else.
import { spawnSync } from 'node:child_process';

const LIMITS = {
  gather: { jerk: 0.02, turn: 0.07, gap: 0.06, sunk: 0.005 },
  stow: { jerk: 0.02, turn: 0.08, gap: 0.06, sunk: 0.005 },
  unstow: { jerk: 0.02, turn: 0.08, gap: 0.08, sunk: 0.005 },
  down: { jerk: 0.02, turn: 0.07, gap: 0.06, sunk: 0.005 },
  walk: { jerk: 0.02, turn: 0.08, slip: 0.02, sunk: 0.005 },
  try: { jerk: 0.1, turn: 0.16, sunk: 0.005 },
  idle: { jerk: 0.012, turn: 0.06, slip: 0.012, sunk: 0.005 },
};

const stage = '__game.story.current';
const measure = (name, play, wait) => [
  { eval: `__game.probe.reset(); ${play}` },
  { wait },
  { eval: `'GATE ${name} ' + __game.probe.report()` },
];
const steps = [
  { wait: 2500 },
  ...measure('idle', '1', 9000),
  ...measure('gather', `${stage}.play('gather')`, 10500),
  ...measure('stow', `${stage}.play('stow')`, 3200),
  ...measure('unstow', `${stage}.play('unstow')`, 3200),
  ...measure('down', `${stage}.play('down')`, 5200),
  ...measure('walk', `${stage}.play('walk')`, 7000),
  ...measure('try', `${stage}.play('try')`, 4500),
];

const run = spawnSync('node', ['tools/play.mjs', '/tmp/cygnet-gates', JSON.stringify(steps)], {
  env: { ...process.env, QUERY: 'chapter=stage&grass=0' },
  encoding: 'utf8',
  maxBuffer: 1 << 24,
});
let failed = 0;
let seen = 0;
for (const line of (run.stdout + run.stderr).split('\n')) {
  const m = line.match(/GATE (\S+) (\{.*\})/);
  if (!m) continue;
  seen++;
  const worst = JSON.parse(m[2].replace(/\\"/g, '"'));
  for (const [key, limit] of Object.entries(LIMITS[m[1]])) {
    const [value, where] = worst[key].split(' @ ');
    const ok = Number(value) <= limit;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${m[1].padEnd(7)} ${key.padEnd(5)} ${value} (limit ${limit})${ok ? '' : `  at ${where}`}`);
  }
}
if (seen !== Object.keys(LIMITS).length) {
  console.error(`only ${seen} of ${Object.keys(LIMITS).length} measurements came back`);
  process.exit(2);
}
process.exit(failed ? 1 : 0);
