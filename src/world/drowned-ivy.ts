import * as THREE from 'three';
import { mulberry32 } from './noise';
import { IVY, TOWER } from './drowned-way';

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

const STEM = lin(0.06, 0.045, 0.03);
const LEAVES = [lin(0.13, 0.18, 0.05), lin(0.18, 0.23, 0.06), lin(0.1, 0.145, 0.045), lin(0.23, 0.25, 0.075)];

/** A broad pointed leaf with two rounded shoulders, as a child would draw ivy: flat, in the plane z = 0, stalk at the origin. */
const LEAF = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-0.55, 0.05, -0.5, 0.42);
  s.quadraticCurveTo(-0.28, 0.62, 0, 1);
  s.quadraticCurveTo(0.28, 0.62, 0.5, 0.42);
  s.quadraticCurveTo(0.55, 0.05, 0, 0);
  return new THREE.ShapeGeometry(s, 3);
})();

/**
 * The ivy on the church tower's south face: one stem from the water up beside the belfry's west opening, the way the
 * cat climbs, and a few bold leaves along it in loose clusters, broad near the foot and the sill, thin between. Built
 * in world space, for the village's merged mesh; each part with its colour.
 */
export function ivyParts(): [THREE.BufferGeometry, THREE.Color][] {
  const rand = mulberry32(1558);
  const face = TOWER.z + TOWER.half;
  const parts: [THREE.BufferGeometry, THREE.Color][] = [];
  const line = new THREE.CatmullRomCurve3(IVY.map((p) => p.clone().setZ(face + 0.03)));
  parts.push([new THREE.TubeGeometry(line, 40, 0.035, 5, false), STEM]);
  const sprig = (from: number, dx: number, rise: number) => {
    const a = line.getPoint(from);
    const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(a.x + dx * 0.6, a.y + rise * 0.3, face + 0.03),
      new THREE.Vector3(a.x + dx, a.y + rise, face + 0.03));
    parts.push([new THREE.TubeGeometry(curve, 8, 0.022, 4, false), STEM]);
    return curve;
  };
  const sprigs = [sprig(0.12, -0.55, 0.5), sprig(0.3, 0.6, 0.7), sprig(0.55, 0.5, 0.9), sprig(0.86, -0.15, 0.6)];
  const at = new THREE.Vector3();
  const leaf = (p: THREE.Vector3, size: number) => {
    const g = LEAF.clone();
    g.translate(0, -0.08, 0);
    g.rotateZ(rand() * 2.4 - 1.2 + (rand() < 0.5 ? Math.PI : 0) * 0.25);
    g.rotateX(-0.12 - rand() * 0.22);
    g.rotateY(rand() * 0.6 - 0.3);
    g.scale(size, size, size);
    g.translate(p.x, p.y, face + 0.05 + rand() * 0.08);
    parts.push([g, LEAVES[Math.floor(rand() * LEAVES.length)]]);
  };
  for (let i = 0; i < 40; i++) {
    const u = i / 39;
    line.getPoint(u, at);
    /** Fuller at the foot and round the sill than up the bare stone between. */
    const full = 0.35 + 0.65 * Math.max(Math.exp(-((u - 0.1) ** 2) / 0.02), Math.exp(-((u - 0.8) ** 2) / 0.014));
    const spread = 0.22 + 0.45 * full;
    const n = 2 + Math.round(full * 2);
    for (let k = 0; k < n; k++) {
      leaf(line.getPoint(u).add(new THREE.Vector3((rand() * 2 - 1) * spread, (rand() - 0.5) * 0.25, 0)), (0.36 + rand() * 0.18) * (0.85 + 0.35 * full));
    }
  }
  for (const curve of sprigs) {
    for (let i = 1; i <= 5; i++) leaf(curve.getPoint(i / 5, at), 0.32 + rand() * 0.14);
  }
  return parts;
}
