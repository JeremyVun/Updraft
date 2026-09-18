import * as THREE from 'three';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { ease, range, wrapAngle } from './motion';
import { Instances } from './shapes';
import { swanGeometry } from './swan/body';
import { stroke, swanMaterial, wakeMaterial, wakeQuad } from './swan/shader';

const MAX = 26;
const WAKES = MAX * 4;
/** Wingbeats a second. Slow for a bird, which is most of what makes a swan look as heavy as it is. */
const BEAT = 2.15;
const CRUISE = 19;
/** How fast they fly the circuit before they go: slower than travelling, but still a swan's flying speed. */
const WHEEL = 12;
/** How high the widest part of a swan floats: the rest of the body is under the water and the water hides it. */
const FLOAT = 0.03;
/** How long a ring goes out from a swan that has settled or shifted its weight, and how far it opens. */
const RING_FOR = 2.6;
const RING_TO = 2.4;
/** The run before a swan is airborne, and how fast it is going by the end of it. */
const RUN = 2.9;
const RUN_SPEED = 15;
/** A pond is not the sea: there is only so much water to run along, so the run is shorter and slower on one. */
const POND_RUN = 2.2;
const POND_RUN_SPEED = 11;

/** The neck's pitch at its root, middle and head, how far it leans to one side, and the head's own pitch on top. */
type Neck = readonly [number, number, number, number, number];
const FLY: Neck = [0.06, 0.0, -0.03, 0, 0.02];
const REACH: Neck = [0.55, 1.2, 1.05, 0, 0.75];
const ALERT: Neck = [0.8, 1.8, 1.15, 0, 1.2];
const CURVE: Neck = [1.85, 1.5, -0.08, 0, 0.2];
const TUCK: Neck = [1.4, 3.0, 4.1, 0.55, 0.5];
const PREEN: Neck = [2.2, 1.0, -1.4, 1.3, 0.5];
const DIP: Neck = [1.2, 0.2, -1.3, 0.5, 0.55];

type Pose = 'alert' | 'curve' | 'preen' | 'dip' | 'tuck' | 'stretch';
type Mode = 'idle' | 'skein' | 'wheel' | 'raft';

interface Bird {
  /** The station it holds in the skein; unused on the water, where `at` is the whole truth. */
  offset: THREE.Vector3;
  /** Its place on the wheel: where it stands on the circle, how wide its own orbit is, and how high it rides. */
  arc: THREE.Vector3;
  at: THREE.Vector3;
  seed: number;
  yaw: number;
  pitch: number;
  roll: number;
  beat: number;
  /** How far the body is riding above its line on this beat; kept apart from `at` so a station stays a station. */
  bob: number;
  flap: number;
  neck: THREE.Vector4;
  headYaw: number;
  headAim: number;
  headPitch: number;
  fold: number;
  feet: number;
  /** 0 once it has fallen out of the skein, so nothing draws it and nothing looks for it. */
  fade: number;
  /** How far gone the one at the back of the V is, 0 to 1. */
  labour: number;
  speed: number;
  turn: number;
  pose: Pose;
  until: number;
  /** Seconds before this one starts its take-off run, and how far through the run it is. */
  delay: number;
  run: number;
  step: number;
  /** Which way it prefers to turn its head and tuck its bill. */
  side: number;
  /** Its own wingbeat, a little off everyone else's: a flock of swans is never a metronome. */
  rate: number;
  /** How closely it is holding its station: 0 straight after a take-off, 1 once the skein has formed. */
  hold: number;
  /** How far through a ring of its own it is, or negative when it is not making one. */
  ring: number;
}

const tmp = new THREE.Vector3();
const tmp4 = new THREE.Vector4();

/**
 * The cygnet's family: a skein of white swans going over, a wheel of them coming round to land, and a raft of them
 * resting on open water. The reason the whole journey happens is the one at the back of the V that cannot keep up.
 */
export class SwanFlock {
  readonly mesh: THREE.Mesh;
  readonly wake: THREE.Mesh;
  private readonly wakeUniforms: Record<string, THREE.IUniform>;
  readonly objects: THREE.Object3D[];
  private readonly swans: Instances;
  private readonly wakes: Instances;
  private readonly birds: Bird[] = [];
  private readonly lead = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, -1);
  private mode: Mode = 'idle';
  /** Centre and radius of the wheel they are turning, or of the water they are sitting on. */
  private pool = { x: 0, z: 0, r: 0, base: 0 };
  /**
   * The surface a raft is floating on: the sea at y = 0, or a pond's still water further up the hill. Still water
   * carries no swell, so the wakes lie flat on it instead of riding one.
   */
  private level = 0;
  /** How long the take-off run is on the water they are sitting on, and how fast they are going by the end of it. */
  private runFor = RUN;
  private runSpeed = RUN_SPEED;
  private turn = 0;
  /** How fast the wheel is coming round, and the bank that speed and radius ask for. */
  private spin = 0;
  private bank = 0;
  private bearing = 0;
  /** Counts up from the moment a raft is told to go, and is negative while it is still a raft. */
  private launched = -1;
  private lost = false;
  private speed = CRUISE;
  /** How fast the air is carrying the whole flock upward: a thermal lifts it, a line climbs out on it. */
  private climb = 0;
  /** Set when a bird has dropped out, so the story knows where it came down. */
  readonly dropped = new THREE.Vector3();

  constructor() {
    this.swans = new Instances(swanGeometry(), MAX, ['iPos', 'iAir', 'iNeck', 'iBody', 'iSteady']);
    this.swans.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mesh = new THREE.Mesh(this.swans.geometry, swanMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.layers.enable(REFLECTION_LAYER);
    this.wakes = new Instances(wakeQuad(), WAKES, ['iWake', 'iWash']);
    this.wakes.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.wake = new THREE.Mesh(this.wakes.geometry, wakeMaterial());
    this.wakeUniforms = (this.wake.material as THREE.ShaderMaterial).uniforms;
    this.wake.frustumCulled = false;
    this.wake.visible = false;
    this.wake.renderOrder = 3;
    this.objects = [this.mesh, this.wake];
  }

  get active(): boolean {
    return this.mode !== 'idle';
  }

  get wheeling(): boolean {
    return this.mode === 'wheel';
  }

  /** The heading of the V, for anyone flying at the back of it. */
  get direction(): THREE.Vector3 {
    return this.dir;
  }

  /** The bearing the skein is flying, so a bird that falls out of it keeps its line for a moment. */
  get heading(): number {
    return Math.atan2(this.dir.x, this.dir.z);
  }

  /** What to watch the flock by: the head of the skein, or the foot of the column a gathering is turning up. */
  get head(): THREE.Vector3 {
    return this.lead;
  }

  /** Where the bird at the back of the V is: the one that will fall out. */
  tail(out: THREE.Vector3): THREE.Vector3 {
    const last = this.birds[this.birds.length - 1];
    if (!last) return out.copy(this.lead);
    return out.set(last.at.x, last.at.y + last.bob, last.at.z);
  }

  /**
   * The empty place at the very back of the V, for one more: the far end of the arm the last of them is not on.
   * It is a station in the formation rather than a spot beside a bird, so it holds still while the V is forming.
   */
  nextSlot(out: THREE.Vector3): THREE.Vector3 {
    const i = this.birds.length;
    if (!i) return out.copy(this.lead);
    const side = i % 2 === 0 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const ox = side * rank * 2.4;
    const oz = -rank * 5.0 - 1.4;
    return out.set(this.lead.x + ox * Math.cos(yaw) + oz * Math.sin(yaw), this.lead.y + 0.3, this.lead.z - ox * Math.sin(yaw) + oz * Math.cos(yaw));
  }

  /**
   * Where the i-th bird flies in the V: the leader in front, the rest falling back from it in pairs. Long and
   * narrow rather than square, because a skein going away from you is only a V while its arms are still pointed.
   */
  private slot(i: number): THREE.Vector3 {
    const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    return new THREE.Vector3(side * (rank * 2.4 + range(Math.random, -0.4, 0.4)), range(Math.random, -0.5, 0.5), -rank * 5.0 - Math.random() * 1.4);
  }

  /** Sends a skein over, passing above (x, z) at the given height on the given bearing, from `from` units back. */
  pass(x: number, z: number, height: number, bearing: number, count = 15, from = 115, ailing = !this.lost): void {
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    this.dir.set(Math.sin(bearing), 0, Math.cos(bearing));
    this.lead.set(x, height, z).addScaledVector(this.dir, -from);
    this.bearing = bearing;
    for (let i = 0; i < c; i++) {
      const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1;
      const rank = Math.ceil(i / 2);
      const b = this.blank(bearing);
      /** A skein is never a drawn line: each of them sits wide of its rank and a little forward or back of it. */
      b.offset.set(side * (rank * 3.1 + range(Math.random, -0.7, 0.9)), range(Math.random, -0.9, 0.9), -rank * 4.4 - range(Math.random, -1.4, 1.6));
      b.hold = 1;
      b.at.set(
        this.lead.x + b.offset.x * Math.cos(bearing) + b.offset.z * Math.sin(bearing),
        this.lead.y + b.offset.y,
        this.lead.z - b.offset.x * Math.sin(bearing) + b.offset.z * Math.cos(bearing),
      );
      this.birds.push(b);
    }
    if (ailing && this.birds.length) this.birds[this.birds.length - 1].labour = 1e-4;
    this.level = 0;
    this.speed = CRUISE;
    this.climb = 0;
    /** The skein is put away once it has flown far enough from where it came in, not from wherever one last fell. */
    this.dropped.copy(this.lead);
    this.start('skein');
  }

  /**
   * A wheel of them turning low over a place, banked into the turn, the way swans come round before they put down.
   * `rise` is how far the column is strung out in height — wide and tall seen from across a meadow, short and
   * close for one that has come down over your head — and `climb` is how fast a thermal carries the whole column up.
   */
  circle(x: number, z: number, base: number, radius: number, count = 26, rise = 46, climb = 0): void {
    const c = Math.min(count, MAX);
    /** Any of them already in the air keep their place in the sky and swing into the wheel rather than cutting to it. */
    const flying = this.mode === 'skein' || this.mode === 'wheel' ? this.birds.filter((b) => b.fade > 0) : [];
    this.birds.length = 0;
    for (let i = 0; i < c; i++) {
      const b = flying[i] ?? this.blank(0);
      /** Strung round the circle in ones and twos rather than evenly, so it is a family and not a fairground. */
      const a = (i / c) * Math.PI * 2 + range(Math.random, -0.24, 0.24);
      b.arc.set(a, range(Math.random, -0.3, 0.3) + ((i % 3) - 1) * rise * 0.42 + (i / c) * rise * 0.5, 0.88 + Math.random() * 0.24);
      b.hold = flying[i] ? 0 : 1;
      if (!flying[i]) {
        b.at.set(x + Math.cos(a) * radius * b.arc.z, base + b.arc.y, z + Math.sin(a) * radius * b.arc.z);
        b.yaw = -a;
      }
      this.birds.push(b);
    }
    this.level = 0;
    this.pool = { x, z, r: radius, base };
    /** A swan's circuit is flown, not floated: the wheel turns at the speed it would take to fly round it. */
    this.spin = WHEEL / Math.max(radius, 4);
    this.bank = Math.atan2(WHEEL * WHEEL / Math.max(radius, 4), 19);
    this.lead.set(x, base, z);
    this.turn = 0;
    this.climb = climb;
    this.start('wheel');
  }

  /**
   * The gathering goes on without the one it left behind. Each bird glides out of the wheel into its place in
   * the V, and turns onto the new heading as it gets there, so the family never cuts from one shape to the other.
   */
  goOn(bearing: number, climb: number, speed: number): void {
    if (this.mode !== 'wheel') return;
    const flying = this.birds.filter((b) => b.fade > 0);
    if (!flying.length) return;
    this.bearing = bearing;
    this.dir.set(Math.sin(bearing), 0, Math.cos(bearing));
    /** Whoever is furthest along the new heading already leads, so nobody flies back through the flock. */
    flying.sort((a, b) => b.at.dot(this.dir) - a.at.dot(this.dir));
    this.lead.copy(flying[0].at);
    this.dropped.copy(this.lead);
    /**
     * They do not all break together. The one already pointing the way straightens out of the turn first and the
     * rest come off the wheel behind it, each after the one in front, which is what leaving looks like.
     */
    flying.forEach((b, i) => {
      b.offset.copy(this.slot(i));
      b.delay = i * 0.2 + range(Math.random, 0.04, 0.16);
    });
    this.birds.length = 0;
    this.birds.push(...flying);
    this.speed = speed;
    this.climb = climb;
    this.start('skein');
  }

  /**
   * A raft of them resting on open water, drifting and turning, most with their necks up, one or two asleep with
   * their heads on their backs. Sea level is y = 0; they sit in it and the sea hides everything below the waterline.
   */
  rest(x: number, z: number, radius: number, count = 14, level = 0): void {
    this.level = level;
    this.runFor = level > 0 ? POND_RUN : RUN;
    this.runSpeed = level > 0 ? POND_RUN_SPEED : RUN_SPEED;
    this.birds.length = 0;
    const c = Math.min(count, MAX);
    const bearing = Math.random() * Math.PI * 2;
    for (let i = 0; i < c; i++) {
      const b = this.blank(bearing + (Math.random() - 0.5) * 2.2);
      /** A raft is a loose huddle, never a lattice: scattered, but never two swans in the same piece of water. */
      for (let tries = 0; tries < 24; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() ** 0.8 * radius;
        b.at.set(x + Math.cos(a) * d * 1.15, level + FLOAT, z + Math.sin(a) * d * 0.75);
        if (this.birds.every((o) => o.at.distanceToSquared(b.at) > 2.1)) break;
      }
      b.fold = 1;
      b.feet = 1;
      b.speed = range(Math.random, 0.04, 0.22);
      b.turn = range(Math.random, -0.12, 0.12);
      b.pose = i % 6 === 0 ? 'tuck' : i % 3 === 0 ? 'alert' : 'curve';
      const p = this.posture(b.pose);
      b.neck.set(p[0], p[1], p[2], p[3] * b.side);
      b.until = range(Math.random, 3, 12);
      this.birds.push(b);
    }
    this.pool = { x, z, r: radius, base: level };
    this.bearing = bearing;
    this.launched = -1;
    this.lead.set(x, level + FLOAT, z);
    this.start('raft');
  }

  /**
   * The raft goes: the long pattering run across the water, one after another, and then they are up and gathering
   * into a skein on `bearing`. Nothing else stops them, so this is also how a raft puts itself away.
   */
  lift(bearing = this.bearing, speed = CRUISE, climb = 0): void {
    if (this.mode !== 'raft' || this.launched >= 0) return;
    this.launched = 0;
    this.bearing = bearing;
    this.dir.set(Math.sin(bearing), 0, Math.cos(bearing));
    /** Whoever is furthest downwind has clear water ahead of it, so it is the one that goes first. */
    const order = [...this.birds].sort((a, b) => b.at.dot(this.dir) - a.at.dot(this.dir));
    order.forEach((b, i) => {
      b.delay = i * 0.42 + Math.random() * 0.25;
      b.offset.set(0, 0, 0);
    });
    this.birds.length = 0;
    this.birds.push(...order);
    for (let i = 0; i < this.birds.length; i++) {
      const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1;
      const rank = Math.ceil(i / 2);
      this.birds[i].offset.set(side * rank * 3.1, (Math.random() - 0.5) * 1.6, -rank * 4.4 - Math.random() * 1.2);
    }
    this.lead.set(this.pool.x, this.level + FLOAT, this.pool.z);
    this.dropped.copy(this.lead);
    this.speed = speed;
    this.climb = climb;
  }

  /** Stops whatever the flock is doing and puts it away. */
  clear(): void {
    this.mode = 'idle';
    this.level = 0;
    this.launched = -1;
    this.mesh.visible = false;
    this.wake.visible = false;
    this.swans.commit(0);
    this.wakes.commit(0);
  }

  /**
   * The last bird in the skein loses the formation. Returns where it was when it fell out, so the cygnet can take
   * over from exactly that point in the sky and come down in view.
   */
  dropOne(out: THREE.Vector3): boolean {
    const last = this.birds[this.birds.length - 1];
    if (!last || last.fade <= 0) return false;
    out.set(last.at.x, last.at.y + last.bob, last.at.z);
    last.fade = 0;
    this.lost = true;
    this.dropped.copy(out);
    return true;
  }

  update(dt: number, time: number): void {
    if (this.mode === 'idle') return;
    if (this.mode === 'wheel') this.wheel(dt, time);
    else if (this.mode === 'raft' && this.launched < 0) this.afloat(dt, time);
    else if (this.mode === 'raft') this.takeOff(dt, time);
    else this.skein(dt, time);
    this.draw();
  }

  private blank(yaw: number): Bird {
    return {
      offset: new THREE.Vector3(),
      arc: new THREE.Vector3(),
      at: new THREE.Vector3(),
      seed: Math.random() * 100,
      yaw,
      pitch: 0,
      roll: 0,
      beat: Math.random(),
      bob: 0,
      flap: 1,
      neck: new THREE.Vector4(FLY[0], FLY[1], FLY[2], FLY[3]),
      headYaw: 0,
      headAim: 0,
      headPitch: 0,
      fold: 0,
      feet: 0,
      fade: 1,
      labour: 0,
      speed: 0,
      turn: 0,
      pose: 'alert',
      until: 0,
      delay: 0,
      run: 0,
      step: 0,
      side: Math.random() < 0.5 ? -1 : 1,
      rate: range(Math.random, 0.93, 1.07),
      hold: 0,
      ring: -1,
    };
  }

  private start(mode: Mode): void {
    this.mode = mode;
    this.wakeUniforms.uLevel.value = this.level;
    this.wakeUniforms.uStill.value = this.level > 0 ? 1 : 0;
    this.mesh.visible = true;
    this.wake.visible = mode === 'raft';
  }

  private posture(pose: Pose): Neck {
    if (pose === 'curve') return CURVE;
    if (pose === 'tuck') return TUCK;
    if (pose === 'preen') return PREEN;
    if (pose === 'dip') return DIP;
    if (pose === 'stretch') return REACH;
    return ALERT;
  }

  /** The skein under way: stations breathing, the beat travelling down the line, and the back of the V struggling. */
  private skein(dt: number, time: number): void {
    this.lead.addScaledVector(this.dir, this.speed * dt);
    this.lead.y += this.climb * dt;
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    let anyVisible = false;
    let circling = false;
    for (const b of this.birds) {
      if (b.fade <= 0) continue;
      anyVisible = true;
      /** Still on the wheel, waiting its turn to break out of it: nothing about it changes until it does. */
      if (b.delay > 0) {
        b.delay -= dt;
        circling = true;
        this.circling(b, dt, time);
        /** The moment it lets go of the circle it is holding nothing, and has to find its station from there. */
        if (b.delay <= 0) b.hold = 0;
        continue;
      }
      if (b.labour > 0) b.labour = Math.min(1, b.labour + dt * 0.15);
      /** Nobody holds a perfect station: they drift a little fore and aft and settle back, and the V breathes. */
      const wx = Math.sin(time * 0.31 + b.seed) * 0.5 + Math.sin(time * 0.17 + b.seed * 3) * 0.35;
      const wz = Math.sin(time * 0.23 + b.seed * 2) * 0.8;
      const sag = b.labour * (0.55 + 0.45 * Math.sin(time * 1.55 + b.seed));
      const ox = (b.offset.x + wx) * cy + (b.offset.z + wz - b.labour * 5.5) * sy;
      const oz = -(b.offset.x + wx) * sy + (b.offset.z + wz - b.labour * 5.5) * cy;
      b.beat += dt * BEAT * b.rate * (1 + b.labour * 0.22);
      b.flap = 1 - sag * 0.5;
      b.bob = stroke(b.beat) * -0.055 * b.flap;
      const to = tmp.set(
        this.lead.x + ox,
        this.lead.y + b.offset.y + Math.sin(time * 0.5 + b.seed) * 0.35 - b.labour * 2.6 - sag * 0.7,
        this.lead.z + oz,
      );
      b.hold = ease(b.hold, 1, 0.45, dt);
      b.at.lerp(to, 1 - Math.exp(-dt * (0.9 + 14 * b.hold * b.hold)));
      b.yaw = yaw + wrapAngle(b.yaw - yaw) * Math.exp(-dt * (0.9 + 3 * b.hold));
      b.roll = ease(b.roll, wrapAngle(b.yaw - yaw) * -1.6 + Math.sin(time * 0.43 + b.seed * 5) * 0.05, 2, dt);
      b.pitch = ease(b.pitch, -0.03 + sag * 0.16, 2, dt);
      b.neck.lerp(tmp4.set(FLY[0], FLY[1] + sag * 0.12, FLY[2] - sag * 0.2, 0), 1 - Math.exp(-dt * 2));
      b.headYaw = ease(b.headYaw, 0, 1.5, dt);
      b.headPitch = ease(b.headPitch, FLY[4], 2, dt);
      b.fold = ease(b.fold, 0, 4, dt);
      b.feet = ease(b.feet, 0, 3, dt);
    }
    if (circling) this.turn += dt * this.spin;
    if (!anyVisible || this.lead.distanceToSquared(this.dropped) > 1400 * 1400) this.clear();
  }

  /** Birds strung round a wheel: angle in arc.x, height in arc.y, radius scale in arc.z. */
  private wheel(dt: number, time: number): void {
    const t = this.pool;
    this.turn += dt * this.spin;
    t.base += this.climb * dt;
    this.lead.set(t.x, t.base, t.z);
    for (const b of this.birds) {
      if (b.fade <= 0) continue;
      this.circling(b, dt, time);
      b.hold = ease(b.hold, 1, 0.35, dt);
    }
  }

  /** One bird flying the circuit: heavy wings, a held bank, and the head looking in toward the rest of them. */
  private circling(b: Bird, dt: number, time: number): void {
    const t = this.pool;
    const a = b.arc.x + this.turn;
    const r = t.r * b.arc.z;
    b.beat += dt * BEAT * b.rate * 0.96;
    b.flap = ease(b.flap, 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(time * 0.29 + b.seed * 4)), 1.2, dt);
    b.bob = stroke(b.beat) * -0.055 * b.flap;
    const to = tmp.set(t.x + Math.cos(a) * r, t.base + b.arc.y + Math.sin(time * 0.3 + b.seed) * 0.8, t.z + Math.sin(a) * r);
    b.at.lerp(to, 1 - Math.exp(-dt * (0.6 + 7 * b.hold)));
    /** The wheel runs against its own angle, so they face along it and hold a bank into the turn. */
    b.yaw = -a + wrapAngle(b.yaw + a) * (1 - b.hold);
    b.roll = ease(b.roll, (this.bank + 0.04 * Math.sin(time * 0.7 + b.seed)) * b.hold, 1.5, dt);
    b.pitch = ease(b.pitch, -0.04, 2, dt);
    b.neck.lerp(tmp4.set(FLY[0], FLY[1], FLY[2], 0), 1 - Math.exp(-dt * 2));
    /** Round the turn each of them is looking in at the others, which is what makes a wheel a family gathering. */
    b.headYaw = ease(b.headYaw, -0.34 * b.hold, 1.5, dt);
    b.headPitch = ease(b.headPitch, FLY[4], 2, dt);
    b.fold = ease(b.fold, 0, 4, dt);
    b.feet = ease(b.feet, 0, 3, dt);
  }

  /** The raft: each swan drifting and turning on its own, and changing its mind about what to do every so often. */
  private afloat(dt: number, time: number): void {
    const t = this.pool;
    for (const b of this.birds) {
      b.until -= dt;
      if (b.until <= 0) this.choose(b);
      const stretching = b.pose === 'stretch';
      /** Rearing up to beat its wings, then folding back down: the one thing in a raft that moves fast. */
      const rear = stretching ? Math.min(1, Math.min(b.until / 0.55, (2.8 - b.until) / 0.45)) : 0;
      b.fold = ease(b.fold, 1 - rear * 0.92, stretching ? 7 : 3, dt);
      b.flap = ease(b.flap, rear, 8, dt);
      b.beat += dt * BEAT * (0.9 + 0.5 * rear);
      const target = this.posture(b.pose);
      const rate = b.pose === 'tuck' || b.pose === 'curve' ? 0.7 : 1.3;
      b.neck.lerp(tmp4.set(target[0], target[1], target[2], target[3] * b.side), 1 - Math.exp(-dt * rate));
      b.headPitch = ease(b.headPitch, target[4], 1.2, dt);

      if (b.pose !== 'tuck' && Math.random() < dt * 0.4) b.headAim = range(Math.random, -0.85, 0.85);
      b.headYaw = ease(b.headYaw, b.pose === 'tuck' ? 0 : b.headAim, 2.2, dt);

      b.turn = ease(b.turn, Math.sin(time * 0.11 + b.seed) * 0.16, 0.5, dt);
      const home = Math.atan2(t.x - b.at.x, t.z - b.at.z);
      const out = Math.hypot(b.at.x - t.x, b.at.z - t.z) / Math.max(t.r, 1);
      b.yaw += (b.turn + wrapAngle(home - b.yaw) * Math.max(0, out - 0.9) * 0.6) * dt;
      const push = b.speed * (1 + rear * 3.5);
      b.at.x += Math.sin(b.yaw) * push * dt;
      b.at.z += Math.cos(b.yaw) * push * dt;
      b.at.y = this.level + FLOAT + rear * 0.16 + Math.sin(time * 0.87 + b.seed) * 0.022 + Math.sin(time * 1.43 + b.seed * 1.7) * 0.012;
      b.roll = ease(b.roll, Math.sin(time * 0.64 + b.seed * 2) * 0.05, 1, dt);
      b.pitch = ease(b.pitch, -rear * 0.3 + Math.sin(time * 0.93 + b.seed * 3) * 0.03, 2.5, dt);
      b.feet = 1;
      b.step = 0;
      /** Every shift of a swan's weight goes out across still water as a ring, which is how you know it is still. */
      if (b.ring < 0) {
        if (Math.random() < dt * (0.1 + rear * 1.6 + b.speed)) b.ring = 0;
      } else {
        b.ring += dt;
        if (b.ring > RING_FOR) b.ring = -1;
      }
    }
  }

  private choose(b: Bird): void {
    const r = Math.random();
    if (b.pose === 'tuck') {
      b.pose = r < 0.6 ? 'curve' : 'alert';
      b.until = range(Math.random, 5, 12);
      return;
    }
    if (r < 0.08) {
      b.pose = 'stretch';
      b.until = 2.8;
    } else if (r < 0.2) {
      b.pose = 'preen';
      b.until = range(Math.random, 4, 9);
    } else if (r < 0.28) {
      b.pose = 'dip';
      b.until = range(Math.random, 2, 4.5);
    } else if (r < 0.38) {
      b.pose = 'tuck';
      b.until = range(Math.random, 18, 45);
    } else if (r < 0.68) {
      b.pose = 'alert';
      b.until = range(Math.random, 4, 10);
    } else {
      b.pose = 'curve';
      b.until = range(Math.random, 6, 15);
    }
  }

  /** The take-off: a long run with the feet slapping the water, and then the climb into a skein on the bearing. */
  private takeOff(dt: number, time: number): void {
    this.launched += dt;
    const yaw = this.bearing;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    let airborne = 0;
    for (const b of this.birds) {
      const t = this.launched - b.delay;
      if (t <= 0) {
        this.afloatOne(b, dt, time);
        continue;
      }
      b.run = t;
      const running = t < this.runFor;
      if (running) {
        const k = Math.min(1, t / this.runFor);
        b.speed = ease(b.speed, this.runSpeed * (0.15 + 0.85 * k), 2.5, dt);
        b.fold = ease(b.fold, 0, 8, dt);
        b.flap = ease(b.flap, 1, 6, dt);
        /** The run is not cruising: the wings go hard and shallow until it has the speed to fly. */
        b.beat += dt * BEAT * 2.3;
        b.yaw = yaw + wrapAngle(b.yaw - yaw) * Math.exp(-dt * 2.2);
        b.at.x += Math.sin(b.yaw) * b.speed * dt;
        b.at.z += Math.cos(b.yaw) * b.speed * dt;
        b.step += dt * 5.4;
        b.at.y = this.level + FLOAT + k * 0.3 + Math.max(0, Math.sin(b.step * Math.PI)) * 0.06;
        b.pitch = ease(b.pitch, -0.16, 3, dt);
        b.roll = ease(b.roll, 0, 3, dt);
        /** The legs stay down the whole run: the feet are what it is running on. */
        b.feet = ease(b.feet, 1, 4, dt);
        b.neck.lerp(tmp4.set(0.3, 0.1, -0.1, 0), 1 - Math.exp(-dt * 2.5));
        b.headYaw = ease(b.headYaw, 0, 3, dt);
        b.headPitch = ease(b.headPitch, 0.1, 3, dt);
        continue;
      }
      airborne++;
      const climb = Math.min(1, (t - this.runFor) / 7);
      b.speed = ease(b.speed, this.speed, 0.6, dt);
      b.beat += dt * BEAT * (1 + 0.4 * (1 - climb));
      b.flap = 1;
      b.feet = ease(b.feet, 0, 1.2, dt);
      b.neck.lerp(tmp4.set(FLY[0], FLY[1], FLY[2], 0), 1 - Math.exp(-dt * 1.5));
      b.headPitch = ease(b.headPitch, FLY[4], 2, dt);
      /** They gather into the V as they climb, so nothing ever snaps into formation. */
      b.hold = ease(b.hold, 1, 0.16, dt);
      const ox = b.offset.x * cy + b.offset.z * sy;
      const oz = -b.offset.x * sy + b.offset.z * cy;
      const to = tmp.set(this.lead.x + ox, this.lead.y + b.offset.y, this.lead.z + oz);
      b.at.x += Math.sin(b.yaw) * b.speed * dt;
      b.at.z += Math.cos(b.yaw) * b.speed * dt;
      b.at.y += (2.6 - b.at.y * 0.02) * dt * (1 - climb * 0.6);
      b.at.lerp(to, 1 - Math.exp(-dt * 2.2 * b.hold * b.hold));
      const want = Math.atan2(to.x - b.at.x, to.z - b.at.z);
      const steer = wrapAngle(want - b.yaw) * (1 - b.hold) * 0.5 + wrapAngle(yaw - b.yaw) * (0.6 + b.hold);
      b.yaw += THREE.MathUtils.clamp(steer, -0.8, 0.8) * dt;
      b.roll = ease(b.roll, THREE.MathUtils.clamp(-steer * 0.9, -0.5, 0.5), 2, dt);
      b.pitch = ease(b.pitch, -0.1 + climb * 0.07, 2, dt);
      b.bob = stroke(b.beat) * -0.055;
    }
    /** The V's apex only starts running once the first of them is up, and then it climbs out ahead of the rest. */
    if (airborne > 0) {
      this.lead.x += Math.sin(yaw) * this.speed * dt;
      this.lead.z += Math.cos(yaw) * this.speed * dt;
      this.lead.y = Math.min(this.lead.y + (2.4 + this.climb) * dt, this.level + 46);
    }
    if (airborne === this.birds.length && this.lead.distanceToSquared(this.dropped) > 300 * 300) {
      this.mode = 'skein';
      /** The run's stagger is spent; in the air `delay` means something else, so nobody carries one over. */
      for (const b of this.birds) b.delay = 0;
      this.dir.set(Math.sin(yaw), 0, Math.cos(yaw));
      this.wake.visible = false;
      this.wakes.commit(0);
    }
  }

  /** One bird still waiting its turn while the rest of the raft is already running. */
  private afloatOne(b: Bird, dt: number, time: number): void {
    b.fold = ease(b.fold, 1, 3, dt);
    b.flap = ease(b.flap, 0, 5, dt);
    b.neck.lerp(tmp4.set(ALERT[0], ALERT[1], ALERT[2], 0), 1 - Math.exp(-dt * 1.4));
    b.headPitch = ease(b.headPitch, ALERT[4], 2, dt);
    b.headYaw = ease(b.headYaw, 0, 2, dt);
    b.yaw += wrapAngle(this.bearing - b.yaw) * Math.min(1, dt * 1.2);
    b.at.y = this.level + FLOAT + Math.sin(time * 0.87 + b.seed) * 0.022;
    b.at.x += Math.sin(b.yaw) * b.speed * dt;
    b.at.z += Math.cos(b.yaw) * b.speed * dt;
    b.feet = 1;
  }

  private draw(): void {
    let drawn = 0;
    for (const b of this.birds) {
      if (b.fade <= 0) continue;
      this.swans.set(0, drawn, b.at.x, b.at.y + b.bob, b.at.z, b.yaw);
      this.swans.set(1, drawn, b.pitch, b.roll, b.beat, b.flap);
      this.swans.set(2, drawn, b.neck.x, b.neck.y, b.neck.z, b.neck.w);
      this.swans.set(3, drawn, b.fold, b.headYaw, b.headPitch, b.feet);
      this.swans.set(4, drawn, b.bob, 0, 0, 0);
      drawn++;
    }
    this.swans.commit(drawn);
    if (this.wake.visible) this.drawWakes();
  }

  /** What the water says about them: the bright smudge a sitting swan lays on it, and the slap of a running foot. */
  private drawWakes(): void {
    let n = 0;
    for (const b of this.birds) {
      if (n + 3 > WAKES) break;
      const moving = b.run > 0 && b.run < this.runFor + 0.6;
      /** Water a bird has just left goes on being disturbed: the wash stays under it for a moment after it lifts. */
      const left = b.run > this.runFor ? Math.max(0, 1 - (b.run - this.runFor) / 0.6) : 1;
      const wash = (moving ? 0.5 : 0.34) * (b.run > 0 ? left : Math.max(0, 1 - Math.max(0, b.at.y - this.level - 0.1) * 4));
      this.wakes.set(0, n, b.at.x - Math.sin(b.yaw) * (moving ? 0.9 : 0.25), b.at.z - Math.cos(b.yaw) * (moving ? 0.9 : 0.25), 0.86 + (moving ? 1.3 : 0), 0.36);
      this.wakes.set(1, n, b.yaw, wash, 0, 0);
      n++;
      if (b.ring >= 0 && n < WAKES) {
        const k = b.ring / RING_FOR;
        const r = 0.5 + k * RING_TO;
        this.wakes.set(0, n, b.at.x, b.at.z, r, r);
        this.wakes.set(1, n, 0, (1 - k) * (1 - k) * 0.5 * Math.min(1, k * 6), 2, 0);
        n++;
      }
      if (!moving) continue;
      for (let i = 0; i < 2; i++) {
        const k = b.step - i * 0.5;
        const age = k - Math.floor(k);
        const back = (age + i * 0.5) * (b.speed / 5.4) * 1.5 + 0.3;
        const spread = 0.3 + age * 0.52;
        this.wakes.set(0, n, b.at.x - Math.sin(b.yaw) * back, b.at.z - Math.cos(b.yaw) * back, spread, spread);
        this.wakes.set(1, n, b.yaw, (1 - age) * (1 - age) * 0.8, 1, 0);
        n++;
      }
    }
    this.wakes.commit(n);
  }
}
