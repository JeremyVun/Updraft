import * as THREE from 'three';
import { sagging, spiral, type Floor, type Squirrel, type SquirrelAction, type SquirrelPoint } from '../creatures/squirrel';
import { CREATURE_GLSL } from '../creatures/shading';
import { LEAF_SHAPE_GLSL, LEAF_TINT_GLSL } from '../fx/leaves';
import { mulberry32 } from '../world/noise';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

const PROP_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
in vec2 aBark;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
out vec2 vBark;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = aTint;
  vBark = aBark;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Birch bark where `vBark` runs along a limb and round it: white, with dark lenticels across it and a darker knot here and there. */
const PROP_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
in vec2 vBark;
void main() {
  vec3 N = normalize(vNormal);
  vec3 alb = vTint;
  if (vBark.x > -50.0) {
    float bands = smoothstep(0.8, 0.92, vnoise(vec2(vBark.x * 5.0, vBark.y * 1.1)) * vnoise(vec2(vBark.x * 1.7 + 7.0, vBark.y * 0.5)) * 2.2);
    float dash = smoothstep(0.7, 0.8, vnoise(vec2(vBark.x * 30.0, vBark.y * 5.0))) * smoothstep(0.45, 0.65, vnoise(vec2(vBark.x * 2.5, vBark.y * 0.8)));
    alb = mix(alb * (0.92 + 0.12 * vnoise(vBark * vec2(40.0, 9.0))), vec3(0.06, 0.055, 0.05), max(bands, dash * 0.85));
  }
  vec3 col = shadeCreature(alb, N, vWorld, 1.0, 0.0, 0.0, 0.4) + alb * uSkyAmbient * 0.5;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

const LEAF_VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 aAt;
in vec4 aTurn;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSide;
out vec2 vCard;
out float vSeed;
void main() {
  vec3 n = normalize(aTurn.xyz);
  float a = aTurn.w;
  vec3 t1 = normalize(cross(n, vec3(cos(a), 0.0, sin(a))));
  vec3 t2 = normalize(cross(n, t1));
  float size = aAt.w;
  vWorld = aAt.xyz + (t1 * position.x * 1.45 + t2 * position.y) * size;
  vNormal = n;
  vSide = t1;
  vCard = position.xy * 2.0;
  vSeed = fract(aAt.x * 13.1 + aAt.z * 7.7);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/** The birches' own floor of leaves, lit as theirs are, for the squirrel to sit among and hide under. */
const LEAF_FRAG = /* glsl */ `
${ATMO_GLSL}
${LEAF_TINT_GLSL}
${LEAF_SHAPE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSide;
in vec2 vCard;
in float vSeed;
void main() {
  if (birchLeafEdge(vCard, vSeed) < 0.0) discard;
  vec3 N = leafCurl(normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0), normalize(vSide), vCard, 0.7);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = leafVeins(birchLeaf(mix(0.22, 1.0, fract(vSeed * 7.13 + 0.25)), 0.95) * (0.86 + 0.26 * vSeed), vCard);
  float sun = max(groundAt(vWorld.xz).w * cloudShadow(vWorld.xz), 0.35);
  float through = pow(max(dot(-V, uSunDir), 0.0), 2.0) * (0.35 + 0.65 * (1.0 - abs(dot(N, uSunDir))));
  vec3 col = alb * (hemiLight(N) * vec3(1.2, 1.08, 0.86) + uSunColor * max(dot(N, uSunDir), 0.0) * sun * 0.9 + uGroundBounce * 0.9);
  col += alb * alb * uSunColor * through * sun * 0.9;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

type Tint = [number, number, number];
const BIRCH: Tint = [0.78, 0.76, 0.7];
const OLD_BIRCH: Tint = [0.6, 0.6, 0.53];
const MOUND: Tint = [0.42, 0.22, 0.07];
const EARTH: Tint = [0.2, 0.13, 0.08];
const RED: Tint = [0.62, 0.08, 0.06];

/** The yard's floor: a round of leaf-strewn earth standing out of the sea, its top this high above the water. */
const FLOOR = { x: 0.5, z: 4.5, r: 6.2, top: 0.5 };
/** Everything built stands on the sea floor, well under the surface. */
const BED = -6;
/** The places in the yard, in its own space: x to its left (east), z ahead (south, out to sea), y up off its floor. */
const HEAP = { x: 0.9, z: 4.1, r: 1.2, top: 0.42 };
const LOG = { a: [-1.6, 5.5], b: [2.4, 5.8], r: 0.26 } as const;
const TRUNK = { x: 2.7, z: 6.9, r: 0.21, top: 6 };
/** A second birch across the yard, the wool tied between the two. */
const TRUNK_B = { x: -2.4, z: 7.6, r: 0.19, top: 5.5 };
/** A low limb off the trunk: how high it leaves it, where it reaches to in the yard's space, and its girth. */
const BRANCH = { y: 2.3, rise: 0.1, out: [-1.45, -0.35], r: 0.075 } as const;
/** The scarf's wool, hung from the second birch to the first: the height it is tied at on each, its sag and girth. */
const WOOL = { from: 1.7, to: 1.9, sag: 0.24, r: 0.026 };
const OPEN = { x: -1.5, z: 3.3 };
/** Where the child would stand to watch, at the yard's near edge: what the squirrel looks at. */
const WATCHER = { x: 0, z: -0.8, y: 1.1 };
const LITTER = { x: 0.4, z: 4.4, r: 5, count: 1400 };

/** A tapering round length of birch from `a` to `b`. */
interface Limb {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r0: number;
  r1: number;
  tint: Tint;
}

/**
 * QA only: a corner of the autumn birches out on the sea beyond the QA stage's beach, west of the cat's yard (a
 * round of earth strewn with the birches' own leaves, a heap banked against a fallen birch, two standing birches
 * with a length of the scarf's red wool hung between them, and a low limb), so that every one of the squirrel's
 * actions can be played by name and judged in the birches' light, held or on the move. Its play beside the child
 * and the cygnet is judged in the birches themselves (`tools/squirrel-check.mjs`).
 */
export class SquirrelYard {
  readonly group = new THREE.Group();
  playing = false;
  /** Where the child's head would be, watching from the yard's near edge: what the squirrel looks at. */
  readonly watcher = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly turn = 0;
  private readonly ground: Floor;
  private readonly top = FLOOR.top;
  private readonly heapAt = new THREE.Vector3();
  private readonly log: Limb;
  private readonly trunk: Limb;
  private readonly trunkB: Limb;
  private readonly branch: Limb;
  /** The wool's centre line, and the same line along its top, where paws go. */
  private readonly wool: THREE.Vector3[];
  private readonly woolTop: THREE.Vector3[];
  /** Things to do a while after a play began, in seconds of game time. */
  private script: { at: number; run: () => void }[] = [];
  private clock = 0;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  constructor(from: THREE.Vector3) {
    /** Out from the beach until the whole floor stands in open water, well west of where the cat's yard goes. */
    const x = from.x - 18;
    const wet = (z: number) => {
      for (let a = 0; a < 16; a++) {
        const r = FLOOR.r + 1;
        if (heightAt(x + FLOOR.x + Math.cos(a) * r, z + FLOOR.z + Math.sin(a) * r) > -1) return false;
      }
      return heightAt(x + FLOOR.x, z + FLOOR.z) < -1;
    };
    let z = from.z;
    while (!wet(z) && z < from.z + 300) z += 2;
    this.origin.set(x, FLOOR.top, z);
    const top = this.top;
    this.ground = () => top;
    this.heapAt.copy(this.at(HEAP.x, HEAP.z));
    this.watcher.copy(this.at(WATCHER.x, WATCHER.z)).setY(top + WATCHER.y);
    const base = this.at(TRUNK.x, TRUNK.z);
    this.log = {
      a: this.at(LOG.a[0], LOG.a[1]).setY(top + LOG.r * 0.8),
      b: this.at(LOG.b[0], LOG.b[1]).setY(top + LOG.r * 0.7),
      r0: LOG.r, r1: LOG.r * 0.85, tint: OLD_BIRCH,
    };
    this.trunk = { a: base.clone().setY(top - 0.3), b: base.clone().setY(top + TRUNK.top), r0: TRUNK.r * 1.1, r1: TRUNK.r * 0.6, tint: BIRCH };
    const baseB = this.at(TRUNK_B.x, TRUNK_B.z);
    this.trunkB = { a: baseB.clone().setY(top - 0.3), b: baseB.clone().setY(top + TRUNK_B.top), r0: TRUNK_B.r * 1.1, r1: TRUNK_B.r * 0.6, tint: BIRCH };
    this.branch = {
      a: base.clone().setY(top + BRANCH.y),
      b: this.at(TRUNK.x + BRANCH.out[0], TRUNK.z + BRANCH.out[1]).setY(top + BRANCH.y + BRANCH.rise),
      r0: BRANCH.r * 1.3, r1: BRANCH.r * 0.6, tint: BIRCH,
    };
    const across = this.w.subVectors(base, baseB).setY(0).normalize().clone();
    const tieB = baseB.clone().addScaledVector(across, this.radiusAt(this.trunkB, top + WOOL.from)).setY(top + WOOL.from);
    const tieA = base.clone().addScaledVector(across, -this.radiusAt(this.trunk, top + WOOL.to)).setY(top + WOOL.to);
    this.wool = sagging(tieB, tieA, WOOL.sag, 24);
    this.woolTop = this.wool.map((p) => p.clone().setY(p.y + WOOL.r));
    this.group.add(this.props(), this.leaves());
  }

  get yaw(): number {
    return this.turn;
  }

  /** Runs what a play left to do later. */
  update(dt: number): void {
    this.clock += dt;
    while (this.script.length && this.script[0].at <= this.clock) this.script.shift()!.run();
  }

  private later(steps: [number, () => void][]): void {
    this.clock = 0;
    this.script = steps.map(([at, run]) => ({ at, run }));
  }

  /**
   * Each action from its own place: on the log, on the limb, in the heap, up the trunk, out on the open leaves; and
   * the motions, each from where it starts: `run` across the yard, `dive` into the heap, `dive-burst` into it and out
   * again to scold, `burst` out of it, `climb-up` and `climb-down` the first birch, `run-line` along the wool, and
   * `follow`, the whole way round: over the ground, up the second birch, along the wool, down the first and home.
   */
  play(name: string, squirrel: Squirrel): boolean {
    this.playing = true;
    this.script = [];
    squirrel.visible = true;
    const look = this.watcher;
    const toward = (at: THREE.Vector3) => Math.atan2(look.x - at.x, look.z - at.z);
    const action = name.replace(/-in$|-out$/, '') as SquirrelAction;
    const inHeap = this.at(HEAP.x + 0.1, HEAP.z + 0.05);
    const edge = this.at(HEAP.x - HEAP.r - 1.1, HEAP.z - 0.3);
    /** Out of the heap toward whoever is watching, landing on the leaves at its foot. */
    const out = this.at(HEAP.x - 0.2, HEAP.z - HEAP.r - 0.3);
    switch (name) {
      case 'sit':
      case 'freeze': {
        const at = this.onTop(this.log, 0.42);
        squirrel.act(action, { at, yaw: toward(at) - 0.5, floor: this.over(this.log), look: name === 'freeze' ? look : null, nut: true });
        break;
      }
      case 'scold':
      case 'stand':
      case 'bound': {
        const at = this.at(OPEN.x, OPEN.z);
        squirrel.act(action, { at, yaw: name === 'bound' ? this.turn + Math.PI / 2 : toward(at), floor: this.ground, look: name === 'bound' ? null : look });
        break;
      }
      case 'perch': {
        const at = this.onTop(this.branch, 0.62);
        const along = this.w.subVectors(this.branch.a, this.branch.b);
        squirrel.perchAt(at, Math.atan2(along.x, along.z), { floor: this.over(this.branch) });
        squirrel.look(look);
        break;
      }
      case 'buried':
      case 'buried-out':
      case 'buried-in':
        squirrel.hide(inHeap, { tailOut: name !== 'buried-in', yaw: toward(inHeap) + 1, floor: this.ground });
        break;
      case 'peek':
        squirrel.hide(inHeap, { tailOut: true, yaw: toward(inHeap) + 0.4, floor: this.ground });
        squirrel.look(look);
        this.later([[0.5, () => squirrel.act('peek', { for: 2.2 })]]);
        break;
      case 'climb': {
        const base = this.trunk.a;
        const out = this.v.subVectors(look, base).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).clone();
        const at = base.clone().setY(this.top + 1.1);
        const r = this.radiusAt(this.trunk, at.y);
        at.addScaledVector(out, r);
        squirrel.act('climb', { at, up: out, forward: new THREE.Vector3(0, 1, 0), radius: r, look });
        break;
      }
      case 'burst':
        squirrel.hide(inHeap, { tailOut: true, yaw: toward(inHeap), floor: this.ground });
        squirrel.look(look);
        this.later([[0.4, () => squirrel.act('burst', { at: out, look })]]);
        break;
      case 'run': {
        const a = this.at(-3.4, 2.0), b = this.at(0, 1.8), c = this.at(3.6, 2.0);
        squirrel.act('stand', { at: a, yaw: Math.atan2(b.x - a.x, b.z - a.z), floor: this.ground, look: null });
        this.later([[0.3, () => squirrel.follow([a, b, c].map((at) => ({ at, on: 'ground' as const })), undefined, { floor: this.ground })]]);
        break;
      }
      case 'dive':
      case 'dive-burst': {
        squirrel.act('stand', { at: edge, yaw: Math.atan2(inHeap.x - edge.x, inHeap.z - edge.z), floor: this.ground, look: null });
        const steps: [number, () => void][] = [[0.5, () => squirrel.act('dive', { at: inHeap, tailOut: true, floor: this.ground })]];
        if (name === 'dive-burst') {
          steps.push([2.3, () => squirrel.act('burst', { at: out, look })]);
          steps.push([3.2, () => squirrel.act('scold', { look })]);
        }
        this.later(steps);
        break;
      }
      case 'climb-up': {
        const { foot, way } = this.climbUp(this.trunk, -3.0, 0.3, WOOL.to - 0.05, 0, -1.1);
        squirrel.act('stand', { at: foot.at, yaw: Math.atan2(way[1].at.x - foot.at.x, way[1].at.z - foot.at.z), floor: this.ground, look: null });
        this.later([[0.3, () => squirrel.follow(way, undefined, { floor: this.ground })]]);
        break;
      }
      case 'climb-down': {
        const { way } = this.climbUp(this.trunk, -3.0, 0.6, WOOL.to - 0.25, 0, -1.1);
        const down = way.slice().reverse();
        const start = down[0];
        squirrel.act('climb', { at: start.at, up: start.up, forward: new THREE.Vector3(0, -1, 0), radius: start.radius, look: null });
        this.later([[0.4, () => squirrel.follow(down, undefined, { floor: this.ground })]]);
        break;
      }
      case 'run-line': {
        const way = this.woolTop.slice(2, -2);
        squirrel.act('run-line', { at: way[0], yaw: Math.atan2(way[1].x - way[0].x, way[1].z - way[0].z), floor: this.alongWool(), look: null });
        this.later([[0.3, () => squirrel.follow(way.map((at) => ({ at, on: 'line' as const })), undefined, { floor: this.ground })]]);
        break;
      }
      case 'follow': {
        const start = this.at(-1.2, 3.4);
        squirrel.act('sit', { at: start, yaw: toward(start), floor: this.ground, look, nut: false });
        this.later([[0.6, () => squirrel.follow(this.roundTheYard(start), () => squirrel.act('scold', { look }), { floor: this.ground })]]);
        break;
      }
      default:
        return false;
    }
    return true;
  }

  /**
   * The way round the yard: over the leaves to the second birch, up it round to where the wool is tied, along the
   * wool, round and down the first birch, and back over the leaves to the heap's edge.
   */
  private roundTheYard(start: THREE.Vector3): SquirrelPoint[] {
    const tieAngle = (limb: Limb, toward: THREE.Vector3) => Math.atan2(toward.z - limb.a.z, toward.x - limb.a.x);
    const angleB = tieAngle(this.trunkB, this.trunk.a);
    const angleA = tieAngle(this.trunk, this.trunkB.a);
    const upB = this.climbUp(this.trunkB, angleB - 2.4, 0.3, WOOL.from + 0.12, 0, angleB);
    const downA = this.climbUp(this.trunk, angleA + 2.6, 0.6, WOOL.to - 0.12, 0, angleA);
    const wool = this.woolTop.slice(3, -3).map((at) => ({ at, on: 'line' as const }));
    const home = this.at(HEAP.x + 1, HEAP.z - 1.1);
    return [
      { at: start, on: 'ground' },
      { at: this.at(-2.4, 4.8), on: 'ground' },
      ...upB.way,
      ...wool,
      ...downA.way.slice().reverse(),
      { at: home, on: 'ground' },
    ];
  }

  /**
   * A way up `limb` from the ground: a point on the leaves out from its foot at `from` radians round it, then the
   * bark spiralling up from `low` to `high` metres, `turns` of a turn round (or to `to` radians, if given). Coming
   * down head first, it leaves the bark at least its own length up, or its nose goes into the ground as it turns.
   */
  private climbUp(limb: Limb, from: number, low: number, high: number, turns: number, to?: number): { foot: SquirrelPoint; way: SquirrelPoint[] } {
    const base = limb.a.clone().setY(this.top);
    const radius = (h: number) => this.radiusAt(limb, this.top + h);
    const out = new THREE.Vector3(Math.cos(from), 0, Math.sin(from));
    const foot: SquirrelPoint = { at: base.clone().addScaledVector(out, radius(0) + 0.42), on: 'ground' };
    const bark = spiral(base, radius, { height: low, angle: from }, { height: high, angle: to ?? from + turns * Math.PI * 2 });
    return { foot, way: [foot, ...bark] };
  }

  /** The top of the wool as a floor: its height at the nearest point along it. */
  private alongWool(): Floor {
    const top = this.woolTop;
    return (x, z) => {
      let best = Infinity, y = top[0].y;
      for (let i = 0; i + 1 < top.length; i++) {
        const a = top[i], b = top[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
        if (d < best) {
          best = d;
          y = a.y + (b.y - a.y) * t;
        }
      }
      return y;
    };
  }

  /** A point in the yard's own space in the world, on its floor. */
  at(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const c = Math.cos(this.turn);
    const s = Math.sin(this.turn);
    return out.set(this.origin.x + x * c + z * s, this.top, this.origin.z - x * s + z * c);
  }

  /**
   * QA: how far a point of the world is outside the nearest solid thing in the yard (its floor, the log, the trunks,
   * the limb, the wool), negative inside it. The heap is leaves, which the squirrel is meant to be in.
   */
  gap(p: THREE.Vector3): number {
    let gap = p.y - this.top;
    for (const limb of [this.log, this.trunk, this.trunkB, this.branch]) {
      const axis = this.w.subVectors(limb.b, limb.a);
      const t = THREE.MathUtils.clamp(this.v.subVectors(p, limb.a).dot(axis) / axis.lengthSq(), 0, 1);
      const d = this.v.copy(limb.a).addScaledVector(axis, t).distanceTo(p);
      gap = Math.min(gap, d - this.radius(limb, t));
    }
    for (let i = 0; i + 1 < this.wool.length; i++) {
      const a = this.wool[i];
      const axis = this.w.subVectors(this.wool[i + 1], a);
      const t = THREE.MathUtils.clamp(this.v.subVectors(p, a).dot(axis) / axis.lengthSq(), 0, 1);
      gap = Math.min(gap, this.v.copy(a).addScaledVector(axis, t).distanceTo(p) - WOOL.r);
    }
    return gap;
  }

  private radius(limb: Limb, t: number): number {
    return limb.r0 + (limb.r1 - limb.r0) * t;
  }

  /** The girth of a standing limb at a height in the world. */
  private radiusAt(limb: Limb, y: number): number {
    return this.radius(limb, (y - limb.a.y) / (limb.b.y - limb.a.y));
  }

  /** The top of a lying limb, `t` of the way along it. */
  private onTop(limb: Limb, t: number): THREE.Vector3 {
    return new THREE.Vector3().lerpVectors(limb.a, limb.b, t).setY(limb.a.y + (limb.b.y - limb.a.y) * t + this.radius(limb, t));
  }

  /** The upper surface of a lying limb as a floor: round over its top, and falling away past its sides. */
  private over(limb: Limb): Floor {
    const axis = new THREE.Vector2(limb.b.x - limb.a.x, limb.b.z - limb.a.z);
    const span = axis.lengthSq();
    return (x, z) => {
      const t = THREE.MathUtils.clamp(((x - limb.a.x) * axis.x + (z - limb.a.z) * axis.y) / span, 0, 1);
      const d = Math.hypot(x - (limb.a.x + axis.x * t), z - (limb.a.z + axis.y * t));
      const r = this.radius(limb, t);
      return limb.a.y + (limb.b.y - limb.a.y) * t + Math.sqrt(Math.max(0, r * r - d * d)) - Math.max(0, d - r) * 4;
    };
  }

  private props(): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = [];
    const wool = this.wool.slice(1).map((b, i): Limb => ({ a: this.wool[i], b, r0: WOOL.r, r1: WOOL.r, tint: RED }));
    for (const { a, b, r0, r1, tint } of [this.log, this.trunk, this.trunkB, this.branch, ...wool]) {
      const len = a.distanceTo(b);
      const geo = new THREE.CylinderGeometry(r1, r0, len, 16, Math.max(1, Math.round(len * 4)), false);
      const pos = geo.attributes.position;
      const bark = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) bark.set(tint === RED ? [-100, 0] : [pos.getY(i) + len / 2, Math.atan2(pos.getZ(i), pos.getX(i)) * 3], i * 2);
      geo.setAttribute('aBark', new THREE.BufferAttribute(bark, 2));
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.v.subVectors(b, a).normalize()));
      geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      parts.push(tinted(geo, tint));
    }
    const floor = new THREE.CylinderGeometry(FLOOR.r, FLOOR.r + 0.3, FLOOR.top - BED, 48, 1);
    floor.translate(this.origin.x + FLOOR.x, (FLOOR.top + BED) / 2, this.origin.z + FLOOR.z);
    floor.setAttribute('aBark', new THREE.BufferAttribute(new Float32Array(floor.attributes.position.count * 2).fill(-100), 2));
    parts.push(tinted(floor, EARTH));
    /** Under the heap's leaves, a mound of the same leaves gone dark, so nothing shows through the gaps between them. */
    const mound = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    mound.scale(HEAP.r * 0.92, HEAP.top * 0.88, HEAP.r * 0.92);
    mound.translate(this.heapAt.x, this.heapAt.y - 0.01, this.heapAt.z);
    mound.setAttribute('aBark', new THREE.BufferAttribute(new Float32Array(mound.attributes.position.count * 2).fill(-100), 2));
    parts.push(tinted(mound, MOUND));
    for (const g of parts) g.deleteAttribute('uv');
    const mat = new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: PROP_VERT, fragmentShader: PROP_FRAG });
    return new THREE.Mesh(mergeAll(parts), mat);
  }

  /** The floor of leaves, and the heap: leaves heaped through its height and lying every way but flat. */
  private leaves(): THREE.Mesh {
    const rand = mulberry32(17);
    const card = new THREE.PlaneGeometry(0.5, 0.5);
    const heap = 900;
    const n = LITTER.count + heap;
    const atArr = new Float32Array(n * 4);
    const turnArr = new Float32Array(n * 4);
    const centre = this.at(LITTER.x, LITTER.z);
    for (let i = 0; i < n; i++) {
      let x: number, z: number, y: number;
      let nx = (rand() - 0.5) * 0.3, ny = 1, nz = (rand() - 0.5) * 0.3;
      let size = 0.22 * (1.0 + 0.7 * rand());
      if (i < LITTER.count) {
        const r = LITTER.r * Math.sqrt(rand());
        const a = rand() * Math.PI * 2;
        x = centre.x + Math.cos(a) * r;
        z = centre.z + Math.sin(a) * r;
        y = this.ground(x, z) + 0.02 + rand() * 0.03;
      } else {
        const r = HEAP.r * Math.sqrt(rand());
        const a = rand() * Math.PI * 2;
        x = this.heapAt.x + Math.cos(a) * r;
        z = this.heapAt.z + Math.sin(a) * r;
        const dome = HEAP.top * Math.sqrt(Math.max(0, 1 - (r / HEAP.r) ** 2));
        y = this.ground(x, z) + dome * (0.7 + 0.35 * rand());
        nx = (rand() - 0.5) * 1.6;
        ny = 0.3 + rand();
        nz = (rand() - 0.5) * 1.6;
        size *= 1.1;
      }
      atArr.set([x, y, z, size], i * 4);
      turnArr.set([nx, ny, nz, rand() * Math.PI * 2], i * 4);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = card.index;
    geo.setAttribute('position', card.attributes.position);
    geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(atArr, 4));
    geo.setAttribute('aTurn', new THREE.InstancedBufferAttribute(turnArr, 4));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }
}

function tinted(geo: THREE.BufferGeometry, tint: Tint): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(tint, i * 3);
  g.setAttribute('aTint', new THREE.BufferAttribute(c, 3));
  return g;
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const total = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'aTint', 'aBark']) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of parts) {
      arr.set(g.attributes[name].array as Float32Array, o);
      o += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
