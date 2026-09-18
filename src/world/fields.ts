/**
 * The meadow's fields: a warped Voronoi patchwork, each field with its own character, unwalled and unfenced, read only as
 * variation in the sward. Written in TypeScript (for placing things) and GLSL (for grass and terrain). Needs
 * HEIGHTFIELD_GLSL for the hash and the coastline.
 */
import { BANK, gnoise, hash2, pcg, meadowInset, meadowPoint } from './heightfield';

/** Field size in world units. */
export const FIELD = 56;
/** No fields this close to the coast. */
const SHORE = 34;

/**
 * The way across the meadow, from the top of the bank over the landing to the far shore, in the coordinates the
 * meadow was sculpted in. The story walks it and the walls are built around it; both read it from here.
 */
export const WAY = [
  [10, -640],
  [6, -660],
  [-18, -740],
  [-40, -830],
  [-4, -930],
  [30, -1020],
  [12, -1100],
  [-6, -1148],
].map(([x, z]) => meadowPoint(x, z));

/**
 * How near the way a wall is taken down. A wall lying across a walk says "stop, go round", and this is what makes
 * sure every one of them has an open gate exactly where the path goes: the same gap on the ground, in the grass
 * and in the line the terrain paints, because they all ask `fieldAt`.
 */
const GATE = 8;
/**
 * And nothing at all lies across the first view. Coming over the bank the player has to read the way on in one
 * look, so for the first stretch the gap is wide enough to be a gateway rather than a gap in a wall.
 */
const BROW = { x: BANK.x, z: BANK.crest };
const WIDE_GATE = 24;

function gateWidth(x: number, z: number): number {
  const d = Math.hypot(x - BROW.x, z - BROW.z);
  const near = Math.max(0, Math.min(1, (100 - d) / 40));
  return GATE + (WIDE_GATE - GATE) * near * near * (3 - 2 * near);
}

/** How far (x, z) lies from the way, in world units. */
export function offWay(x: number, z: number): number {
  let best = 1e9;
  for (let i = 1; i < WAY.length; i++) {
    const a = WAY[i - 1];
    const b = WAY[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

const u01 = (h: number) => (h & 0xffff) / 65535;
const v01 = (h: number) => (h >>> 16) / 65535;

export interface FieldSample {
  /** Distance to the nearest field boundary, in world units. */
  edge: number;
  /** A stable random number for the field, 0..1. */
  kind: number;
  /** Whether the nearest boundary carries a wall. */
  wall: boolean;
  /** 0 off the mainland's fields, 1 well inside them. */
  presence: number;
}

function warp(x: number, z: number): [number, number] {
  return [x + gnoise(x * 0.011, z * 0.011) * 9, z + gnoise(x * 0.011 + 5.2, z * 0.011 - 3.7) * 9];
}

export function fieldAt(x: number, z: number, out: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 }): FieldSample {
  const inland = meadowInset(x, z);
  out.presence = Math.min(1, Math.max(0, (inland - SHORE) / 30));
  const [wx, wz] = warp(x, z);
  const px = wx / FIELD;
  const pz = wz / FIELD;
  const nx = Math.floor(px);
  const nz = Math.floor(pz);
  const fx = px - nx;
  const fz = pz - nz;
  let md = 8;
  let mrx = 0;
  let mrz = 0;
  let mgx = 0;
  let mgz = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const h = hash2(nx + i, nz + j);
      const rx = i + 0.15 + 0.7 * u01(h) - fx;
      const rz = j + 0.15 + 0.7 * v01(h) - fz;
      const d = rx * rx + rz * rz;
      if (d < md) {
        md = d;
        mrx = rx;
        mrz = rz;
        mgx = i;
        mgz = j;
      }
    }
  }
  md = 8;
  let ox = 0;
  let oz = 0;
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      const gx = mgx + i;
      const gz = mgz + j;
      const h = hash2(nx + gx, nz + gz);
      const rx = gx + 0.15 + 0.7 * u01(h) - fx;
      const rz = gz + 0.15 + 0.7 * v01(h) - fz;
      const dx = rx - mrx;
      const dz = rz - mrz;
      const len = Math.hypot(dx, dz);
      if (len < 1e-5) continue;
      const d = (0.5 * (mrx + rx) * dx + 0.5 * (mrz + rz) * dz) / len;
      if (d < md) {
        md = d;
        ox = nx + gx;
        oz = nz + gz;
      }
    }
  }
  const ax = nx + mgx;
  const az = nz + mgz;
  out.edge = md * FIELD;
  out.kind = u01(pcg(hash2(ax, az) ^ 0x9e3779b9));
  const lo = ax < ox || (ax === ox && az < oz);
  const pair = lo ? pcg(hash2(ax, az) + hash2(ox, oz) * 3) : pcg(hash2(ox, oz) + hash2(ax, az) * 3);
  /** The gate is only asked about where there is a wall to take down, and only near where it would stand. */
  out.wall = u01(pair) < 0.84 && out.presence > 0;
  if (out.wall && out.edge < WIDE_GATE + FIELD * 0.5) out.wall = offWay(x, z) > gateWidth(x, z);
  return out;
}

const glslNum = (x: number): string => x.toFixed(2);

const WAY_GLSL = WAY.map((p) => `vec2(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).join(', ');

export const FIELDS_GLSL = /* glsl */ `
const vec2 FL_WAY[${WAY.length}] = vec2[${WAY.length}](${WAY_GLSL});
/** How far a point lies from the way across the meadow; mirrors offWay in TypeScript. */
float offWay(vec2 p) {
  float best = 1e9;
  for (int i = 1; i < ${WAY.length}; i++) {
    vec2 a = FL_WAY[i - 1];
    vec2 d = FL_WAY[i] - a;
    float t = clamp(dot(p - a, d) / dot(d, d), 0.0, 1.0);
    best = min(best, length(p - a - d * t));
  }
  return best;
}
float fl_gate(vec2 p) {
  float d = length(p - vec2(${glslNum(BROW.x)}, ${glslNum(BROW.z)}));
  float near = clamp((100.0 - d) / 40.0, 0.0, 1.0);
  return ${GATE}.0 + ${WIDE_GATE - GATE}.0 * near * near * (3.0 - 2.0 * near);
}
vec2 fl_warp(vec2 p) {
  return p + vec2(gnoise(p * 0.011), gnoise(p * 0.011 + vec2(5.2, -3.7))) * 9.0;
}
vec2 fl_site(ivec2 c) {
  uint h = hf_hash2(c);
  return vec2(float(h & 0xffffu), float(h >> 16u)) / 65535.0 * 0.7 + 0.15;
}
/** x: distance to the nearest boundary (world units), y: field kind 0..1, z: 1 if walled, w: presence on the mainland. */
vec4 fieldAt(vec2 p) {
  float inland = meadowInset(p);
  float presence = clamp((inland - ${SHORE}.0) / 30.0, 0.0, 1.0);
  if (presence <= 0.0) return vec4(99.0, 0.0, 0.0, 0.0);
  vec2 q = fl_warp(p) / ${FIELD}.0;
  vec2 n = floor(q);
  vec2 f = q - n;
  ivec2 ni = ivec2(n);
  float md = 8.0;
  vec2 mr = vec2(0.0);
  ivec2 mg = ivec2(0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 g = ivec2(i, j);
      vec2 r = vec2(g) + fl_site(ni + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  md = 8.0;
  ivec2 other = ni;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      ivec2 g = mg + ivec2(i, j);
      vec2 r = vec2(g) + fl_site(ni + g) - f;
      vec2 dr = r - mr;
      float len = length(dr);
      if (len < 1e-5) continue;
      float d = dot(0.5 * (mr + r), dr) / len;
      if (d < md) { md = d; other = ni + g; }
    }
  }
  ivec2 a = ni + mg;
  float kind = float(hf_pcg(hf_hash2(a) ^ 0x9e3779b9u) & 0xffffu) / 65535.0;
  bool lo = a.x < other.x || (a.x == other.x && a.y < other.y);
  uint pair = lo ? hf_pcg(hf_hash2(a) + hf_hash2(other) * 3u) : hf_pcg(hf_hash2(other) + hf_hash2(a) * 3u);
  float edge = md * ${FIELD}.0;
  float wall = float(pair & 0xffffu) / 65535.0 < 0.84 ? 1.0 : 0.0;
  /** The gate is only asked about where there is a wall to take down, and only near where it would stand. */
  if (wall > 0.0 && edge < ${(WIDE_GATE + FIELD * 0.5).toFixed(1)}) wall = offWay(p) > fl_gate(p) ? 1.0 : 0.0;
  return vec4(edge, kind, wall, presence);
}
`;
