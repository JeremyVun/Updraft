import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import type { Deck } from './decks';

/**
 * The belfry storey of the drowned church's tower, cheated larger than the tower's real size so that she, the cat, the
 * kittens and the bell fit in it with room between: its outside half-width, its walls' thickness, the top of its sills
 * (the floor inside stands `step` below them), the height of the room to its ceiling boards and the top of its walls.
 * Each face has one wide pointed arch over its sill: its width, the spring of its arch above the sill and the rise of
 * the point. The bell hangs `hang` above the floor from a headstock whose gudgeons rest on two oak beams `bearing`
 * east and west of it, high across the room over the arches' points, and swings north and south between them. The
 * kittens' nest, where she stands by the bell and the trap lie at these places off the middle of the room (x east,
 * z south).
 */
export const BELFRY = {
  half: 3.6, wall: 0.5, sill: 8.27, step: 0.12, height: 4.35, top: 13.1,
  arch: { width: 3.0, spring: 2.4, point: 1.1 },
  hang: 3.95, bearing: 1.0,
  nest: new THREE.Vector2(-1.75, 0.05),
  stand: new THREE.Vector2(-1.35, -1.75),
  trap: new THREE.Vector2(2.1, 2.1),
} as const;

export type Face = 'south' | 'east' | 'north' | 'west';
const TURN: Record<Face, number> = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
export const FACES = Object.keys(TURN) as Face[];
const INNER = BELFRY.half - BELFRY.wall;
const FLOOR = BELFRY.sill - BELFRY.step;
const CEILING = FLOOR + BELFRY.height;
/** Where the belfry storey stands on the tower below it. */
export const BELFRY_FOOT = FLOOR - 0.4;

/** Out of a face, level. */
export function faceOut(face: Face, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(Math.sin(TURN[face]), 0, Math.cos(TURN[face]));
}

/** Along a face, to the right as it is seen from outside. */
export function faceAlong(face: Face, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(Math.cos(TURN[face]), 0, -Math.sin(TURN[face]));
}

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);
const WASH = lin(0.45, 0.405, 0.33);
const DRESSING = lin(0.34, 0.31, 0.26);
const QUOIN = lin(0.5, 0.46, 0.385);
const OAK = lin(0.15, 0.095, 0.055);
const BOARDS = lin(0.22, 0.155, 0.095);
const IRON = lin(0.05, 0.048, 0.05);
const STRAW = lin(0.42, 0.31, 0.13);
const GREY_STRAW = lin(0.25, 0.21, 0.15);

const PLAIN = 0;
const STONE = 1;
const WOOD = 2;
const PLANKS = 3;
const STALKS = 4;
const METAL = 5;

/**
 * The belfry's light, shared with whatever hangs in it: where the room is, its arches, and the bell's axis, so that
 * inside only the low sun that comes in through an arch reaches anything, and the bell throws its shadow.
 */
export const BELFRY_GLSL = /* glsl */ `
uniform vec4 uBelfry;
uniform vec4 uBelfrySize;
uniform vec3 uBelfryArch;
uniform vec3 uBellPivot;
uniform vec3 uBellDown;

/** Inside a face's arch: u along the face from its middle, v above the sill; soft at the edges. */
float belfryLight(float u, float v) {
  float h = uBelfryArch.x;
  float du = abs(u);
  float t = sqrt(clamp(1.0 - du / h, 0.0, 1.0));
  float top = uBelfryArch.y + uBelfryArch.z * (1.4 * t - 0.4 * t * t);
  return (1.0 - smoothstep(h - 0.05, h + 0.02, du)) * smoothstep(-0.03, 0.02, v) * (1.0 - smoothstep(top - 0.06, top + 0.02, v));
}

/** How far into the room a point is: 0 out in the open, 1 within its walls. */
float belfryInside(vec3 world) {
  vec2 p = abs(world.xz - uBelfry.xz);
  float wall = max(p.x, p.y);
  return (1.0 - smoothstep(uBelfrySize.x + 0.03, uBelfrySize.x + 0.3, wall))
    * smoothstep(uBelfry.y - 0.45, uBelfry.y - 0.15, world.y) * (1.0 - smoothstep(uBelfrySize.z + 0.15, uBelfrySize.z + 0.45, world.y));
}

/** How much of the bell stands between a point and the sun. */
float bellShade(vec3 world) {
  vec3 d = uSunDir;
  vec3 c0 = uBellPivot + uBellDown * 0.22;
  vec3 e = uBellDown * 1.8;
  vec3 w = world - c0;
  float b = dot(d, e), c = dot(e, e), dd = dot(d, w), ee = dot(e, w);
  float t = clamp((ee - b * dd) / max(c - b * b, 1e-4), 0.0, 1.0);
  float s = t * b - dd;
  if (s < 0.0) return 1.0;
  float gap = length(world + d * s - (c0 + e * t));
  float r = mix(0.5, 0.97, pow(t, 1.4));
  return smoothstep(r - 0.07, r + 0.07, gap);
}

/** Whether a ray from a point inside the room leaves it through an arch, through the thickness of its wall. */
float belfryOpen(vec3 world, vec3 d) {
  vec3 p = world - vec3(uBelfry.x, 0.0, uBelfry.z);
  float inner = uBelfrySize.x, outer = uBelfrySize.y;
  float tx = abs(d.x) > 1e-4 ? (sign(d.x) * inner - p.x) / d.x : 1e6;
  float tz = abs(d.z) > 1e-4 ? (sign(d.z) * inner - p.z) / d.z : 1e6;
  bool across = tx < tz;
  float t0 = max(0.0, min(tx, tz));
  float t1 = across ? (sign(d.x) * outer - p.x) / d.x : (sign(d.z) * outer - p.z) / d.z;
  vec3 a = p + d * t0, b = p + d * max(t1, t0);
  return belfryLight(across ? a.z : a.x, a.y - uBelfry.w) * belfryLight(across ? b.z : b.x, b.y - uBelfry.w);
}

/** The low sun inside the room: only what comes in through an arch. */
float belfrySun(vec3 world) {
  return belfryOpen(world, uSunDir);
}
`;

export type BelfryLight = {
  uBelfry: { value: THREE.Vector4 };
  uBelfrySize: { value: THREE.Vector4 };
  uBelfryArch: { value: THREE.Vector3 };
  uBellPivot: { value: THREE.Vector3 };
  uBellDown: { value: THREE.Vector3 };
};

const BELFRY_VERT = /* glsl */ `
in vec3 color;
in vec3 aLocal;
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vLocal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vColor = color;
  vLocal = aLocal;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const BELFRY_FRAG = /* glsl */ `
${ATMO_GLSL}
${BELFRY_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 alb = vColor;
  float rough = vnoise(vLocal.xy * 2.1 + vLocal.z * 1.7) * 0.6 + vnoise(vLocal.zy * 5.3 + vLocal.x) * 0.4;
  if (kind == ${PLAIN}) {
    /** Old lime over rubble: blotched, and the stones' shapes showing through where it has worn. */
    float course = vLocal.y * 3.1;
    float run = (vLocal.x + vLocal.z) * 1.7 + fract(floor(course) * 0.37) * 3.0;
    float joint = max(1.0 - smoothstep(0.0, 0.1, fract(course)), 1.0 - smoothstep(0.0, 0.08, fract(run)));
    float worn = smoothstep(0.45, 0.8, fbm(vLocal.xy * 0.7 + vLocal.zx * 0.5));
    alb *= (0.84 + 0.22 * rough) * (1.0 - 0.3 * joint * worn);
    alb *= mix(1.0, 0.72, (1.0 - smoothstep(uBelfry.y, uBelfry.y + 1.4, vWorld.y)) * belfryInside(vWorld));
  } else if (kind == ${STONE}) {
    alb *= 0.86 + 0.2 * rough;
  } else if (kind == ${WOOD}) {
    float grain = vnoise(vec2(vLocal.z * 1.3, (vLocal.x + vLocal.y) * 26.0)) * 0.6 + vnoise(vec2(vLocal.z * 7.0, (vLocal.x - vLocal.y) * 60.0)) * 0.4;
    alb *= 0.74 + 0.42 * grain;
  } else if (kind == ${PLANKS}) {
    float row = vLocal.z / 0.24;
    float plank = floor(row);
    float gap = 1.0 - smoothstep(0.0, 0.06, min(fract(row), 1.0 - fract(row)));
    float grain = vnoise(vec2(vLocal.x * 1.6 + plank * 7.1, row * 9.0));
    alb *= (0.8 + 0.3 * hash12(vec2(plank, 3.1))) * (0.85 + 0.25 * grain) * (1.0 - 0.6 * gap);
  } else if (kind == ${STALKS}) {
    alb *= 0.9 + 0.2 * rough;
  }
  float inside = belfryInside(vWorld);
  float sunIn = belfrySun(vWorld) * bellShade(vWorld);
  float sun = mix(cloudShadow(vWorld.xz), sunIn, inside);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  /** Inside it is close and warm: the sky comes in only through the arches, and the sunlit straw throws light back. */
  vec3 warm = uSunColor * vec3(1.0, 0.76, 0.48) * 0.075;
  vec3 ambient = hemiLight(n) * mix(1.0, 0.3, inside) + warm * inside * (0.7 + 0.3 * n.y);
  vec3 col = alb * (ambient + uSunColor * mix(ndl, wrap * wrap, 0.2) * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  float edge = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  col += uSunColor * edge * back * sun * 0.14 * (0.35 + alb) * (1.0 - inside);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

type Add = (geo: THREE.BufferGeometry, colour: THREE.Color, kind: number, m?: THREE.Matrix4) => void;

function built(build: (add: Add) => void): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  build((geo, colour, kind, m) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    g.setAttribute('aLocal', new THREE.BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) col.set([colour.r, colour.g, colour.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(count).fill(kind), 1));
    if (m) g.applyMatrix4(m);
    parts.push(g);
  });
  return mergeGeometries(parts);
}

/** A pointed arch `w` wide, its sides rising `spring` from y0 and its point `point` higher, as the tower's arches are drawn. */
function arch(cx: number, y0: number, w: number, spring: number, point: number, path: THREE.Path): THREE.Path {
  const h = w / 2;
  path.moveTo(cx - h, y0);
  path.lineTo(cx + h, y0);
  path.lineTo(cx + h, y0 + spring);
  path.quadraticCurveTo(cx + h, y0 + spring + point * 0.7, cx, y0 + spring + point);
  path.quadraticCurveTo(cx - h, y0 + spring + point * 0.7, cx - h, y0 + spring);
  path.lineTo(cx - h, y0);
  return path;
}

/** A squared timber from a to b, its length along its own z, so its grain runs with it. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number): [THREE.BufferGeometry, THREE.Matrix4] {
  const len = a.distanceTo(b);
  const up = Math.abs(b.y - a.y) > 0.9 * len ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4().lookAt(a, b, up).setPosition(a.clone().lerp(b, 0.5));
  return [new THREE.BoxGeometry(w, h, len), m];
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * The belfry: four walls each with one wide pointed arch over its sill, the dressed stone round it and a ledge outside
 * under it; boards for a floor with old straw over them, the trap in one corner down into the tower; joists and boards
 * overhead; the two oak beams the bell's headstock rests on. Laid round the tower's middle (`at`, its height ignored)
 * at the room's own heights, square to the world like the tower. The bell itself is its own piece
 * (`crossings/bell.ts`), hung from `pivot`, and shares this room's light.
 */
export class Belfry {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly centre = new THREE.Vector3();
  readonly floor = FLOOR;
  readonly light: BelfryLight;
  /** Her floor inside. */
  readonly decks: Deck[];

  constructor(at: THREE.Vector3) {
    this.centre.set(at.x, 0, at.z);
    const { arch } = BELFRY;
    this.light = {
      uBelfry: { value: new THREE.Vector4(at.x, FLOOR, at.z, BELFRY.sill) },
      uBelfrySize: { value: new THREE.Vector4(INNER, BELFRY.half, CEILING, 0) },
      uBelfryArch: { value: new THREE.Vector3(arch.width / 2, arch.spring, arch.point) },
      uBellPivot: { value: new THREE.Vector3(at.x, FLOOR + BELFRY.hang, at.z) },
      uBellDown: { value: new THREE.Vector3(0, -1, 0) },
    };
    this.mesh = new THREE.Mesh(built((add) => this.build(add)), new THREE.ShaderMaterial({
      vertexShader: BELFRY_VERT, fragmentShader: BELFRY_FRAG, uniforms: { ...atmo.uniforms, ...this.light }, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.position.copy(this.centre);
    this.mesh.layers.enable(REFLECTION_LAYER);
    this.group.add(this.mesh);
    const r = INNER - 0.32;
    this.decks = [{ x0: at.x - r, z0: at.z, x1: at.x + r, z1: at.z, halfWidth: r, height: FLOOR }];
  }

  get objects(): THREE.Object3D[] {
    return [this.group];
  }

  /** The middle of the line the bell swings about, between its gudgeons. */
  pivot(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.centre.x, FLOOR + BELFRY.hang, this.centre.z);
  }

  /** The middle of the nest on the floor. */
  nest(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.centre.x + BELFRY.nest.x, FLOOR, this.centre.z + BELFRY.nest.y);
  }

  /** On a face's sill, `out` metres from the wall's outer face (negative is inside it) and `along` from the arch's middle. */
  sill(face: Face, out: number, along = 0, into = new THREE.Vector3()): THREE.Vector3 {
    const n = faceOut(face), u = faceAlong(face);
    return into.copy(this.centre).addScaledVector(n, BELFRY.half + out).addScaledVector(u, along).setY(BELFRY.sill);
  }

  /** On the floor just inside a face's arch, `inward` metres in from the inner face of its wall and `along` from its middle. */
  inside(face: Face, inward: number, along = 0, into = new THREE.Vector3()): THREE.Vector3 {
    const n = faceOut(face), u = faceAlong(face);
    return into.copy(this.centre).addScaledVector(n, INNER - inward).addScaledVector(u, along).setY(FLOOR);
  }

  /** On the floor at a place off the middle of the room, x east and z south. */
  onFloor(x: number, z: number, into = new THREE.Vector3()): THREE.Vector3 {
    return into.set(this.centre.x + x, FLOOR, this.centre.z + z);
  }

  /** Whether a point is within the room's walls, above its floor and under its ceiling. */
  holds(p: THREE.Vector3, margin = 0): boolean {
    return Math.abs(p.x - this.centre.x) < INNER - margin && Math.abs(p.z - this.centre.z) < INNER - margin && p.y > FLOOR - 0.3 && p.y < CEILING;
  }

  /** Whether a point in the thickness of a wall is in its arch's opening, so a line through it passes. */
  static open(u: number, v: number): boolean {
    const { arch } = BELFRY;
    const h = arch.width / 2, du = Math.abs(u);
    const k = Math.sqrt(THREE.MathUtils.clamp(1 - du / h, 0, 1));
    return du < h && v > 0 && v < arch.spring + arch.point * (1.4 * k - 0.4 * k * k);
  }

  /** Where the bell is, so the room's light can find its shadow. */
  shadeBell(pivot: THREE.Vector3, down: THREE.Vector3): void {
    this.light.uBellPivot.value.copy(pivot);
    this.light.uBellDown.value.copy(down);
  }

  /** How much of the low sun from `sun` (toward it) gets in through an arch to a point inside, as the shader has it. */
  sunAt(world: THREE.Vector3, sun: THREE.Vector3): number {
    const p = new THREE.Vector3(world.x - this.centre.x, world.y, world.z - this.centre.z);
    const tx = Math.abs(sun.x) > 1e-4 ? (Math.sign(sun.x) * INNER - p.x) / sun.x : 1e6;
    const tz = Math.abs(sun.z) > 1e-4 ? (Math.sign(sun.z) * INNER - p.z) / sun.z : 1e6;
    const across = tx < tz;
    const t0 = Math.max(0, Math.min(tx, tz));
    const t1 = across ? (Math.sign(sun.x) * BELFRY.half - p.x) / sun.x : (Math.sign(sun.z) * BELFRY.half - p.z) / sun.z;
    const open = (t: number) => {
      const q = p.clone().addScaledVector(sun, t);
      return Belfry.open(across ? q.z : q.x, q.y - BELFRY.sill) ? 1 : 0;
    };
    return open(t0) * open(Math.max(t0, t1));
  }

  private build(add: Add): void {
    const { half, wall, sill, arch: a } = BELFRY;
    const y0 = BELFRY_FOOT;
    for (const face of FACES) {
      const turn = new THREE.Matrix4().makeRotationY(TURN[face]);
      const reach = face === 'south' || face === 'north' ? half : INNER;
      const shape = new THREE.Shape([new THREE.Vector2(-reach, y0), new THREE.Vector2(reach, y0), new THREE.Vector2(reach, BELFRY.top),
        new THREE.Vector2(-reach, BELFRY.top)]);
      shape.holes.push(arch(0, sill, a.width, a.spring, a.point, new THREE.Path()) as THREE.Path);
      add(new THREE.ExtrudeGeometry(shape, { depth: wall, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, INNER), WASH, PLAIN, turn);
      const ring = arch(0, sill - 0.02, a.width + 0.36, a.spring + 0.02, a.point + 0.16, new THREE.Shape()) as THREE.Shape;
      ring.holes.push(arch(0, sill - 0.02, a.width, a.spring + 0.02, a.point, new THREE.Path()) as THREE.Path);
      add(new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, half), DRESSING, STONE, turn);
      for (const side of [-1, 1]) {
        add(new THREE.BoxGeometry(0.34, 0.16, wall + 0.14).translate(side * (a.width / 2 + 0.1), sill + a.spring - 0.06, INNER + wall / 2), DRESSING, STONE, turn);
      }
      add(new THREE.BoxGeometry(a.width + 0.7, 0.18, 0.3).translate(0, sill - 0.09, half + 0.04), DRESSING, STONE, turn);
      add(new THREE.BoxGeometry(2 * half - 1.1, 0.12, 0.2).translate(0, BELFRY.top - 0.5, half + 0.06), DRESSING, STONE, turn);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let i = 0, y = y0 + 0.05; y < BELFRY.top - 0.3; i++, y += 0.62) {
          const long = i % 2 === 0;
          const wx = long ? 1.0 : 0.62, wz = long ? 0.62 : 1.0;
          add(new THREE.BoxGeometry(wx, 0.5, wz).translate(sx * (half + 0.03 - wx / 2), y + 0.25, sz * (half + 0.03 - wz / 2)), QUOIN, STONE);
        }
      }
    }
    add(new THREE.BoxGeometry(2 * half + 0.5, 0.34, 2 * half + 0.5).translate(0, BELFRY.top + 0.15, 0), DRESSING, STONE);
    add(new THREE.BoxGeometry(2 * INNER, 0.1, 2 * INNER).translate(0, FLOOR - 0.05, 0), BOARDS, PLANKS);
    add(new THREE.BoxGeometry(2 * INNER, 0.08, 2 * INNER).translate(0, CEILING + 0.04, 0), BOARDS, PLANKS);
    for (const z of [-2.2, -0.75, 0.75, 2.2]) {
      const [g, m] = beam(new THREE.Vector3(-INNER, CEILING - 0.11, z), new THREE.Vector3(INNER, CEILING - 0.11, z), 0.18, 0.22);
      add(g, OAK, WOOD, m);
    }
    this.frame(add);
    this.trap(add);
    this.straw(add);
  }

  /**
   * The two great oak beams across the room from wall to wall east and west of the bell, set into the stone over the
   * arches' points, with an iron bearing on each for a gudgeon; the bell swings north and south between them.
   */
  private frame(add: Add): void {
    const top = FLOOR + BELFRY.hang, b = BELFRY.bearing;
    for (const x of [-b, b]) {
      const [g, m] = beam(new THREE.Vector3(x, top - 0.19, -INNER - 0.2), new THREE.Vector3(x, top - 0.19, INNER + 0.2), 0.26, 0.28);
      add(g, OAK, WOOD, m);
      add(new THREE.BoxGeometry(0.3, 0.09, 0.3).translate(x, top - 0.005, 0), IRON, METAL);
    }
  }

  /** A square of boards in the floor with strap hinges and a ring: the way down into the tower. */
  private trap(add: Add): void {
    const at = new THREE.Matrix4().makeTranslation(BELFRY.trap.x, FLOOR, BELFRY.trap.y);
    add(new THREE.BoxGeometry(0.98, 0.022, 0.98).translate(0, 0.004, 0), IRON, METAL, at);
    add(new THREE.BoxGeometry(0.9, 0.04, 0.9).translate(0, 0.012, 0).rotateY(Math.PI / 2), lin(0.19, 0.13, 0.08), PLANKS, at);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.012, 0.42).translate(s * 0.28, 0.038, 0.22), IRON, METAL, at);
    add(new THREE.TorusGeometry(0.075, 0.013, 6, 14).rotateX(Math.PI / 2).translate(0, 0.04, -0.3), IRON, METAL, at);
  }

  /** Old straw blown about the boards: thick round the nest and under the bell, drifted against the walls. */
  private straw(add: Add): void {
    const rand = seeded(4093);
    const n = BELFRY.nest;
    for (let i = 0; i < 2600; i++) {
      let x: number, z: number;
      const r = rand();
      if (r < 0.4) {
        const a = rand() * Math.PI * 2, d = 0.4 + Math.sqrt(rand()) * 0.9;
        x = n.x + Math.cos(a) * d;
        z = n.y + Math.sin(a) * d;
      } else if (r < 0.65) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 1.8;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      } else {
        const side = Math.floor(rand() * 4), along = (rand() * 2 - 1) * (INNER - 0.1), off = INNER - 0.05 - rand() ** 2 * 0.6;
        x = side < 2 ? (side ? off : -off) : along;
        z = side < 2 ? along : (side === 2 ? off : -off);
      }
      x = THREE.MathUtils.clamp(x, -INNER + 0.04, INNER - 0.04);
      z = THREE.MathUtils.clamp(z, -INNER + 0.04, INNER - 0.04);
      if (Math.abs(x - BELFRY.trap.x) < 0.5 && Math.abs(z - BELFRY.trap.y) < 0.5) continue;
      const len = 0.07 + rand() * 0.16, shade = 0.62 + rand() * 0.55;
      const g = new THREE.BoxGeometry(0.007, 0.005, len).rotateX((rand() - 0.5) * 0.4).rotateY(rand() * Math.PI)
        .translate(x, FLOOR + 0.006 + rand() * 0.03, z);
      add(g, STRAW.clone().lerp(GREY_STRAW, rand() * 0.6).multiplyScalar(shade), STALKS);
    }
    for (const [x, z, rx, rz] of [[-INNER + 0.4, 0.9, 0.55, 0.9], [0.9, INNER - 0.35, 0.95, 0.45], [INNER - 0.4, -1.6, 0.45, 0.7]] as const) {
      add(new THREE.SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(rx, 0.12, rz).translate(x, FLOOR, z), STRAW.clone().multiplyScalar(0.8), STALKS);
    }
  }
}
