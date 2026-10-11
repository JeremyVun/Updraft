// The released sheet must settle over its rope without stretching a jagged crown into the fold.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
globalThis.location = { search: '?shot' };
const { CURTAINS } = await import('../src/world/lines-passage.ts');
const curtain = CURTAINS[2];
function checkCloth(label) {
  const cloth = curtain.sheets[0].cloth;
  let stretch = 1;
  for (let row = 0; row < cloth.rows; row++) for (let col = 0; col < cloth.cols; col++) {
    const a = row * cloth.cols + col;
    for (const b of [col + 1 < cloth.cols ? a + 1 : -1, row + 1 < cloth.rows ? a + cloth.cols : -1]) {
      if (b < 0) continue;
      const distance = Math.hypot(...[0, 1, 2].map(d => cloth.pos[a * 3 + d] - cloth.pos[b * 3 + d]));
      stretch = Math.max(stretch, distance / cloth.flatDistance(a, b));
    }
  }
  assert(stretch < 1.12, `${label}: settled cloth stretched ${(stretch * 100 - 100).toFixed(1)}%`);
  assert(curtain.passable, `${label}: the sheet leaves a passage`);
  console.log(`PASS ${label}: worst settled edge ${(stretch * 100 - 100).toFixed(1)}% stretch`);
}
for (const fps of [30, 60, 120]) for (const bearing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  curtain.reset();
  if (process.env.NEGATIVE) for (let i = 6; i < curtain.foldedRails.length; i += 7) curtain.foldedRails[i] = .42 * .55;
  const wind = { calm: 0, sample(x, z, out) {
    return Object.assign(out, { x: Math.cos(bearing) * 18, z: Math.sin(bearing) * 18, energy: .7, lift: 0 });
  } };
  for (let frame = 0; frame < fps * 16; frame++) {
    curtain.touched = true;
    curtain.update(1 / fps, wind, true);
  }
  checkCloth(`${fps} Hz / ${bearing.toFixed(2)}`);
}
curtain.reset(true);
checkCloth('restored checkpoint');
