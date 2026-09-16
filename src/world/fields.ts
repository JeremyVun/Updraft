/**
 * The meadow's fields: a warped Voronoi patchwork, each field with its own character, unwalled and unfenced, read only as
 * variation in the sward. Written in TypeScript (for placing things) and GLSL (for grass and terrain). Needs
 * HEIGHTFIELD_GLSL for the hash and the coastline.
 */
import { gnoise, hash2, pcg, meadowInset } from './heightfield';

/** Field size in world units. */
export const FIELD = 56;
/** No fields this close to the coast. */
const SHORE = 34;

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
  out.wall = u01(pair) < 0.84 && out.presence > 0;
  return out;
}

export const FIELDS_GLSL = /* glsl */ `
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
  float wall = float(pair & 0xffffu) / 65535.0 < 0.84 ? 1.0 : 0.0;
  return vec4(md * ${FIELD}.0, kind, wall, presence);
}
`;
