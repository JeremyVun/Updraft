// Finds indecisive camera motion in a TRACE=1 playthrough capture (<prefix>-camera.jsonl).
// node tools/camera-intent-report.mjs <prefix> [--json]
// Flags: stalls (the lens stops while its subject keeps moving, then starts again), dolly reversals (in then out,
// or out then in, within a few seconds), turn reversals (pans one way then back) and jerks (sudden changes of
// acceleration). Each finding names the chapter/beat and the rig correction that moved most across it.
import fs from 'node:fs';
const [prefix, flag] = process.argv.slice(2);
if (!prefix) throw new Error('Supply the playthrough output prefix');
const all = fs.readFileSync(prefix + '-camera.jsonl', 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
// The opening glide from the title view is a designed move; the first two seconds are not measured.
const rows = all.filter(r => r.t > all[0].t + 2);
if (all[0].at && !rows[0].at) rows[0].at = all.filter(r => r.at && r.t <= rows[0].t).at(-1).at;
let label = '';
for (const r of rows) { if (r.at) label = r.at; r.label = label; }
const n = rows.length;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = v => Math.hypot(v[0], v[1], v[2]);
const smooth = (values, radius) => values.map((_, i) => {
  let sum = 0, count = 0;
  for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) { sum += values[j]; count++; }
  return sum / count;
});
// The child is the one the lens must stay with; chapter focus points switch between subjects and would read as moves.
const subject = r => r.child;
const eyeSpeed = [], lookSpeed = [], subjectSpeed = [], distance = [], yaw = [], pitch = [];
for (let i = 0; i < n; i++) {
  const r = rows[i], p = rows[Math.max(0, i - 1)], dt = Math.max(1e-4, r.t - p.t);
  const jump = i === 0 || r.t - p.t > 0.2;
  eyeSpeed.push(jump ? 0 : len(sub(r.eye, p.eye)) / dt);
  lookSpeed.push(jump ? 0 : len(sub(r.look, p.look)) / dt);
  subjectSpeed.push(jump ? 0 : len(sub(subject(r), subject(p))) / dt);
  const s = subject(r);
  distance.push(Math.hypot(r.eye[0] - s[0], r.eye[1] - s[1], r.eye[2] - s[2]));
  const d = sub(r.look, r.eye);
  yaw.push(Math.atan2(d[0], -d[2]));
  pitch.push(Math.atan2(d[1], Math.hypot(d[0], d[2])));
}
const unwrap = a => { const out = [a[0]]; for (let i = 1; i < a.length; i++) { let d = a[i] - a[i - 1]; d = Math.atan2(Math.sin(d), Math.cos(d)); out.push(out[i - 1] + d); } return out; };
const yawU = unwrap(yaw);
const deriv = (a, i, w = 6) => {
  const lo = Math.max(0, i - w), hi = Math.min(n - 1, i + w), dt = rows[hi].t - rows[lo].t;
  return dt > 0 ? (a[hi] - a[lo]) / dt : 0;
};
const eyeS = smooth(eyeSpeed, 8), subjS = smooth(subjectSpeed, 8), distS = smooth(distance, 15), yawS = smooth(yawU, 15);
const distRate = distS.map((_, i) => deriv(distS, i)), yawRate = yawS.map((_, i) => deriv(yawS, i));
// Speed of the eye relative to the subject: carrying with a boat is not motion the viewer reads as a camera move.
const relSpeed = smooth(rows.map((r, i) => {
  if (i === 0) return 0;
  const p = rows[i - 1], dt = Math.max(1e-4, r.t - p.t);
  if (r.t - p.t > 0.2) return 0;
  return len(sub(sub(r.eye, p.eye), sub(subject(r), subject(p)))) / dt;
}), 8);
const components = ['fit', 'pull', 'lift', 'rise', 'offset'];
function blame(a, b) {
  const out = {};
  for (const c of components) {
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) { lo = Math.min(lo, rows[i][c]); hi = Math.max(hi, rows[i][c]); }
    if (hi - lo > (c === 'offset' ? 0.02 : 0.3)) out[c] = +(hi - lo).toFixed(2);
  }
  let side = 0;
  for (let i = a; i <= b; i++) side = Math.max(side, len(sub(rows[i].side, rows[a].side)));
  if (side > 0.3) out.side = +side.toFixed(2);
  const labels = [...new Set(rows.slice(a, b + 1).map(r => r.label))];
  if (labels.length > 1) out.beats = labels.join(' > ');
  if (rows.slice(a, b + 1).some(r => r.transition !== rows[a].transition)) out.transition = true;
  if (rows.slice(a, b + 1).some(r => r.placed !== rows[a].placed)) out.placedChange = true;
  if (rows.slice(a, b + 1).some(r => r.hold !== rows[a].hold)) out.holdChange = true;
  return out;
}
const findings = [];
const at = i => ({ t: +rows[i].t.toFixed(1), beat: rows[i].label });
// Dolly reversals: extrema in subject distance with a meaningful swing on both sides.
{
  let lastExt = 0, lastSign = 0;
  const ext = [];
  for (let i = 1; i < n; i++) {
    const sign = Math.sign(distRate[i]);
    if (sign && lastSign && sign !== lastSign) ext.push(i);
    if (sign) lastSign = sign;
  }
  for (let k = 1; k < ext.length - 1; k++) {
    const a = ext[k - 1], m = ext[k], b = ext[k + 1];
    if (rows[b].t - rows[a].t > 12 || rows[b].t - rows[a].t < 0) continue;
    const before = distS[m] - distS[a], after = distS[b] - distS[m];
    const scale = Math.max(4, distS[m]);
    if (Math.abs(before) / scale > 0.1 && Math.abs(after) / scale > 0.1 && Math.sign(before) !== Math.sign(after))
      findings.push({ kind: before > 0 ? 'out-then-in' : 'in-then-out', ...at(m), span: +(rows[b].t - rows[a].t).toFixed(1),
        swing: [+before.toFixed(1), +after.toFixed(1)], distance: +distS[m].toFixed(1), blame: blame(a, b) });
  }
}
// Turn reversals: pan one way then the other, both substantial.
{
  const ext = [];let lastSign = 0;
  for (let i = 1; i < n; i++) {
    const sign = Math.abs(yawRate[i]) < 0.005 ? 0 : Math.sign(yawRate[i]);
    if (sign && lastSign && sign !== lastSign) ext.push(i);
    if (sign) lastSign = sign;
  }
  for (let k = 1; k < ext.length - 1; k++) {
    const a = ext[k - 1], m = ext[k], b = ext[k + 1];
    if (rows[b].t - rows[a].t > 10 || rows[b].t - rows[a].t < 0) continue;
    const before = yawS[m] - yawS[a], after = yawS[b] - yawS[m];
    if (Math.abs(before) > 0.12 && Math.abs(after) > 0.12)
      findings.push({ kind: 'pan-reversal', ...at(m), span: +(rows[b].t - rows[a].t).toFixed(1),
        degrees: [+(before * 57.3).toFixed(0), +(after * 57.3).toFixed(0)], blame: blame(a, b) });
  }
}
// Stalls: the lens (relative to its subject) was moving, nearly stops while the subject is still moving, then moves again.
{
  for (let i = 60; i < n - 60; i++) {
    if (!(relSpeed[i] < 0.15 * Math.max(relSpeed[i - 45], 0.01) && relSpeed[i - 45] > 1)) continue;
    if (subjS[i] < 0.6) continue;
    let j = i; while (j < n - 1 && rows[j].t - rows[i].t < 4 && relSpeed[j] < 0.4 * relSpeed[i - 45]) j++;
    if (rows[j].t - rows[i].t >= 4 || rows[j].t - rows[i].t < 0.3) { i = j; continue; }
    findings.push({ kind: 'stall', ...at(i), stopped: +(rows[j].t - rows[i].t).toFixed(1),
      speedBefore: +relSpeed[i - 45].toFixed(1), subjectSpeed: +subjS[i].toFixed(1), blame: blame(i - 45, j) });
    i = j + 60;
  }
}
// Jerks: the eye's acceleration changes sharply (a move starting or stopping without easing).
{
  const vel = rows.map((r, i) => i === 0 || r.t - rows[i - 1].t > 0.2 ? [0, 0, 0] : sub(r.eye, rows[i - 1].eye).map(v => v / Math.max(1e-4, r.t - rows[i - 1].t)));
  const rel = rows.map((r, i) => i === 0 || r.t - rows[i - 1].t > 0.2 ? [0, 0, 0] : sub(vel[i], sub(subject(r), subject(rows[i - 1])).map(v => v / Math.max(1e-4, r.t - rows[i - 1].t))));
  const w = 6;
  let last = -Infinity;
  for (let i = 2 * w; i < n - 2 * w; i++) {
    const avg = (a, b) => { const s = [0, 0, 0]; for (let j = a; j < b; j++) for (let k = 0; k < 3; k++) s[k] += vel[j][k] / (b - a); return s; };
    const dt = rows[i + w].t - rows[i - w].t;
    if (dt <= 0 || dt > 0.5) continue;
    const a0 = sub(avg(i - w, i), avg(i - 2 * w, i - w)).map(v => v / (dt / 2));
    const a1 = sub(avg(i + w, i + 2 * w), avg(i, i + w)).map(v => v / (dt / 2));
    const jerk = len(sub(a1, a0)) / (dt / 2);
    const scale = Math.max(6, distance[i]);
    if (jerk / scale > 1.2 && rows[i].t - last > 2) {
      last = rows[i].t;
      findings.push({ kind: 'jerk', ...at(i), jerk: +(jerk / scale).toFixed(2), blame: blame(i - 2 * w, i + 2 * w) });
    }
  }
}
findings.sort((a, b) => a.t - b.t);
if (flag === '--json') console.log(JSON.stringify(findings, null, 1));
else {
  const byBeat = new Map();
  for (const f of findings) byBeat.set(f.beat, [...(byBeat.get(f.beat) ?? []), f]);
  for (const [beat, list] of byBeat) {
    console.log(`\n${beat}`);
    for (const f of list) {
      const { kind, t, beat: _, blame: b, ...rest } = f;
      console.log(`  ${t.toFixed(1).padStart(7)}s ${kind.padEnd(12)} ${JSON.stringify(rest)} ${JSON.stringify(b)}`);
    }
  }
  const counts = {};
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  console.log('\n', counts, `${(rows.at(-1).t - rows[0].t).toFixed(0)} s traced`);
}
