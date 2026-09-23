// Literal bounds in all shader templates, including unmarked inline materials. Expression bounds also need range review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { shaderTemplates, smoothstepCalls, literalNumber } from './lib/glsl.mjs';
const failures = []; let calls = 0, dynamic = 0;
for (const file of execFileSync('rg', ['--files', 'src'], {encoding:'utf8'}).trim().split('\n').filter(p => p.endsWith('.ts'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const template of shaderTemplates(source, file)) for (const call of smoothstepCalls(template.text)) {
    calls++;
    const [a,b] = call.args.map(literalNumber);
    if (a === null || b === null) { dynamic++; continue; }
    if (a >= b) failures.push(`${file}:${source.slice(0,template.start+call.start).split('\n').length} smoothstep(${call.args.join(', ')})`);
  }
}
assert.deepEqual(failures, [], 'GLSL smoothstep requires ascending, distinct bounds');
// Algebraic equivalence to the existing reversible CPU helper, through and outside the transition.
const smooth = (a,b,x) => { const t = Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
for (const [lo,hi] of [[-14,10],[0,.9],[-660,-600],[.55,1.05]]) {
  for (let i=-100;i<=200;i++) {
    const x=lo+(hi-lo)*i/100;
    assert(Math.abs(smooth(hi,lo,x)-(1-smooth(lo,hi,x)))<1e-14);
  }
}
const fixture = 'const js = smoothstep(1, 0, x); const shader = `float x = smoothstep(1.0, 0.0, length(vec2(a,b)));`;';
assert.equal(shaderTemplates(fixture,'fixture.ts').length,1);
assert.deepEqual(smoothstepCalls(shaderTemplates(fixture,'fixture.ts')[0].text)[0].args,['1.0','0.0','length(vec2(a,b))']);
console.log(`Shader bounds: ${calls} calls scanned; literal bounds pass, ${dynamic} expression-bound calls require runtime/contract coverage. Descending-ramp equivalence passed.`);
