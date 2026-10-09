import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { heightAt } from '../world/island';
import { REFLECTION_LAYER } from '../world/water/reflection';
import { tuning } from '../tuning';
import { Belfry, BELFRY, faceOut } from '../world/belfry';
import { BELL_SOUNDS, Bell, BellWaves } from '../world/crossings/bell';
import { IvyFace } from '../world/ivy-face';
import { Kittens } from '../creatures/cat/kittens';
import { Climb } from '../traveller/climb';
import { drownedHouse, OVERHANG, yardMesh, type AddPart, type Roof } from './crossings-yard';
import type { Cast } from './cast';

/**
 * The yard, in the world's own axes round the tower's middle, the water at 0, laid as the room's church is: the
 * nave's ridge running west into the tower's west face at the room's height, the belfry over it at the room's
 * height, the ivy up the west face from the ridge to the west opening's north light, toward the low sun.
 */
const NAVE: Roof = { x: -BELFRY.half - 6, z: 0, len: 12, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, stacks: [] };
const RIDGE = NAVE.wall + NAVE.rise + 0.04 - NAVE.sink;
const EAVE = NAVE.wall - 0.1 - NAVE.sink;
const FACE: 'west' = 'west';
const WASH = new THREE.Color().setRGB(0.45, 0.405, 0.33);
const QUOIN = new THREE.Color().setRGB(0.5, 0.46, 0.385);
const DRESSING = new THREE.Color().setRGB(0.34, 0.31, 0.26);
const SLATE = new THREE.Color().setRGB(0.07, 0.075, 0.085);

/** Seconds the lens takes to settle on a new frame: slow, so a change of view is a move and never a cut. */
const LENS_GLIDE = 1.6;

/** A critically damped glide of `at` toward `to` over about `time` seconds, carrying its speed in `speed`. */
function glide(at: THREE.Vector3, speed: THREE.Vector3, to: THREE.Vector3, time: number, dt: number): void {
  if (dt <= 0) return;
  const w = 2 / time, x = w * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const k of ['x', 'y', 'z'] as const) {
    const change = at[k] - to[k];
    const temp = (speed[k] + w * change) * dt;
    speed[k] = (speed[k] - w * temp) * decay;
    at[k] = to[k] + (change + temp) * decay;
  }
}

/** The cat curls with the open side of its ring, where the kittens lie, toward the opening beside its own. */
const CURL_YAW = -2.21;

export type BellYardView = 'play' | 'wide' | 'nest' | 'kittens' | 'bell' | 'ivy' | 'climb-near' | 'climb-far' | 'climb-side' | 'climb-down' | 'climb-profile';

/**
 * QA only: the drowned village's refuge and its bell, set out on the sea off the QA stage (`?chapter=stage&gap=bell`,
 * or `play('crossing:bell')`): the climb up the ivy into the belfry, the cat curled round its kittens in the straw,
 * and the bell rung by the player's strokes, its rings rolling out over the water. `&bell=ring` starts her in the
 * opening with the bell to ring, `&bell=down` starts her climbing down.
 */
export class BellYard {
  readonly group = new THREE.Group();
  readonly belfry: Belfry;
  readonly bell: Bell;
  readonly waves: BellWaves;
  readonly ivy: IvyFace;
  readonly kittens = new Kittens();
  readonly climb: Climb;
  readonly decks: Deck[];
  playing = false;
  phase: 'waiting' | 'climbing' | 'nest' | 'ringing' | 'leaving' | 'down' | 'below' = 'waiting';
  /** QA: hold the lens on one view for stills. */
  view: BellYardView = 'play';
  private t = 0;
  private catDone = false;
  private readonly timers: { at: number; go: () => void }[] = [];
  private readonly centre = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly down = new THREE.Vector3();
  private readonly inviteAt = new THREE.Vector3();
  private readonly inviteDir = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly herY = { value: RIDGE };
  /** The lens as it is, gliding toward where the frame wants it; cut there when she is set somewhere new. */
  private readonly eyeNow = new THREE.Vector3();
  private readonly orbitNow = new THREE.Vector3();
  private readonly orbitWant = new THREE.Vector3();
  private readonly targetNow = new THREE.Vector3();
  private readonly eyeSpeed = new THREE.Vector3();
  private readonly targetSpeed = new THREE.Vector3();
  private cut = true;
  private inside = false;
  private dt = 0;
  private readonly floor: () => number;

  constructor(private readonly cast: Cast, near: THREE.Vector3) {
    this.centre.copy(this.findWater(near));
    this.group.position.copy(this.centre);
    this.belfry = new Belfry(this.centre);
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.bell = new Bell({ pivot: this.belfry.pivot(), toward: new THREE.Vector2(1, 0), half: BELFRY.bearing }, crossingCast, this.belfry.light);
    this.bell.onEvent = (kind, at, strength) => cast.knock?.(BELL_SOUNDS[kind], at, strength);
    this.waves = new BellWaves(this.centre, 0.12, BELFRY.half + 0.5);
    this.bell.onRing = (strength) => this.waves.emit(strength);
    const out = faceOut(FACE);
    const foot = this.at(-BELFRY.half, RIDGE, 0);
    this.ivy = new IvyFace({
      from: foot, to: this.belfry.sill(FACE, 0), out,
      roof: (across) => THREE.MathUtils.lerp(RIDGE, EAVE, Math.min(1, Math.abs(across) / (NAVE.depth / 2 + OVERHANG))),
      spread: 1.45,
    });
    this.climb = new Climb(cast.child, { wall: foot, out, holds: this.ivy.holds, sill: this.belfry.sill(FACE, 0), depth: BELFRY.wall });
    const scenery = yardMesh((add) => this.tower(add));
    scenery.layers.enable(REFLECTION_LAYER);
    this.group.add(scenery);
    this.floor = () => this.belfry.floor;
    const a = this.belfry.sill(FACE, 0.05), b = this.belfry.sill(FACE, -BELFRY.wall - 0.08);
    const sill: Deck = { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: BELFRY.arch.width / 2 - 0.06, height: BELFRY.sill };
    const ridge = { x0: this.centre.x - 14, z0: this.centre.z, x1: foot.x - 0.15, z1: this.centre.z, halfWidth: 0.45, height: RIDGE };
    this.decks = [sill, ...this.belfry.decks, ridge];
  }

  get objects(): THREE.Object3D[] {
    return [this.group, ...this.belfry.objects, ...this.bell.objects, this.waves.mesh, ...this.ivy.objects, this.kittens.straw,
      ...this.kittens.cats.flatMap((k) => k.objects)];
  }

  get tuning(): typeof tuning.crossings.bell {
    return tuning.crossings.bell;
  }

  /** The drawn stroke's place: across the bell, brought out in front of the stone between it and the lens. */
  invitationAt(camera: THREE.Camera | null): THREE.Vector3 | null {
    const at = this.bell.invitation;
    if (!at || !camera) return at;
    const toward = this.inviteDir.copy(camera.position).sub(at).normalize();
    return this.inviteAt.copy(at).addScaledVector(toward, Math.min(at.distanceTo(camera.position) * 0.5, 2.9));
  }

  /** For the capture tools: where everything has got to. */
  get state(): Record<string, unknown> {
    const b = this.bell, c = this.cast.child, w = this.climb.worst;
    return {
      playing: this.playing, phase: this.phase, t: +this.t.toFixed(2), tuning: { ringAt: tuning.crossings.bell.ringAt },
      bell: { angle: +b.angle.toFixed(4), speed: +b.speed.toFixed(4), clapper: +b.clapper.toFixed(3), rings: b.rings, touches: b.touches,
        peak: +b.peak.toFixed(3), ask: +b.ask.toFixed(3), quiet: +Math.min(999, b.quiet).toFixed(2), sinceRing: +Math.min(999, b.sinceRing).toFixed(2),
        valving: b.valving, invitation: b.invitation !== null },
      waves: this.waves.count,
      climb: { phase: this.climb.phase, t: +this.climb.t.toFixed(2), length: +this.climb.length.toFixed(2),
        hand: +w.hand.toFixed(4), foot: +w.foot.toFixed(4), handAt: w.handAt, footAt: w.footAt },
      nestSun: this.belfry.sunAt(this.belfry.nest().setY(this.belfry.floor + 0.2), this.sunDir()),
      cat: { done: this.catDone, at: this.cast.cat.position.toArray().map((v) => +v.toFixed(2)) },
      child: c.position.toArray().map((v) => +v.toFixed(3)), yaw: +c.yaw.toFixed(3), climbing: c.climbing,
    };
  }

  /** `from`: where to start, the foot of the ivy (the default), in the opening with the bell to ring, or about to go down. */
  play(from: 'climb' | 'ring' | 'down' = 'climb'): void {
    const c = this.cast.child;
    this.playing = true;
    this.timers.length = 0;
    this.view = (new URLSearchParams(location.search).get('bellView') as BellYardView | null) ?? 'play';
    this.cut = true;
    this.t = 0;
    this.climb.stop();
    this.climb.resetWorst();
    this.bell.reset();
    this.waves.reset();
    c.decks = this.decks;
    c.dismount();
    c.stop();
    c.balance = 0;
    c.lean = 0;
    c.stroll = 0.75;
    c.hang = 0;
    c.kneeling = 0;
    c.lookAt = null;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.standUp();
    c.stowPlane(true, true);
    /** The plane is tucked inside her coat for the climb and the belfry. */
    this.cast.plane.visible = false;
    const k = this.cast.cygnet;
    k.visible = true;
    k.rideIn('satchel');
    this.kittens.visible = true;
    this.kittens.lay(this.belfry.nest().setY(this.belfry.floor));
    const cat = this.cast.cat;
    cat.visible = true;
    if (from === 'climb') {
      const start = this.climb.start();
      c.place(start.x, start.z, this.climb.facing);
      this.kittens.nestle();
      cat.place(start.clone().add(new THREE.Vector3(-0.3, 0, 0.75)), this.climb.facing, { pose: 'stand', floor: () => RIDGE });
      cat.look(null);
      this.catDone = false;
      this.phase = 'waiting';
      this.catClimbs();
    } else {
      this.curlCat();
      this.catDone = true;
      const stand = this.standInOpening();
      c.place(stand.x, stand.z, from === 'ring' ? this.outward : this.climb.facing);
      this.phase = from === 'ring' ? 'ringing' : 'leaving';
      if (from === 'down') this.goDown();
    }
  }

  stop(): void {
    if (this.playing) this.cast.plane.visible = true;
    this.playing = false;
    this.climb.stop();
    this.cast.child.decks = [];
    this.cast.child.kneeling = 0;
  }

  /** QA: from wherever she is in the belfry, back out of the opening and down the ivy. */
  goDown(): void {
    const c = this.cast.child;
    const stand = this.standInOpening();
    this.phase = 'leaving';
    c.kneeling = 0;
    c.lookAt = null;
    c.walkTo(stand.x, stand.z, false, () => {
      c.yaw = this.climb.facing;
      this.later(0.7, () => {
        this.phase = 'down';
        this.climb.down(() => {
          this.phase = 'below';
          c.lookAt = this.look.copy(this.belfry.sill(FACE, 0)).setY(BELFRY.sill + 0.3);
        });
      });
    }, 0.08);
  }

  update(dt: number, camera: THREE.PerspectiveCamera | null): void {
    if (!camera || !this.playing) return;
    const c = this.cast.child;
    this.t += dt;
    this.dt = dt;
    this.kittens.update(dt);
    for (const h of this.kittens.heard) if (h.kind === 'mew') this.cast.cat.heard.push(h);
    this.kittens.heard.length = 0;
    for (const due of this.timers.filter((timer) => timer.at <= this.t)) {
      this.timers.splice(this.timers.indexOf(due), 1);
      due.go();
    }
    this.climb.update(dt);
    this.belfry.shadeBell(this.bell.pivot, this.bell.down(this.down));
    this.bell.live = this.phase === 'ringing';
    this.bell.update(dt, camera);
    this.waves.update(dt);
    this.herY.value += (c.position.y - this.herY.value) * (1 - Math.exp(-dt * 3.5));

    if (this.phase === 'waiting') {
      c.lookAt = this.look.copy(this.cast.cat.position).setY(this.cast.cat.position.y + 0.2);
      if (this.cast.cat.position.y > RIDGE + 2.6 || this.t > 4) {
        this.phase = 'climbing';
        c.lookAt = null;
        this.climb.up(() => this.arrive());
      }
    } else if (this.phase === 'nest') {
      c.lookAt = this.look.copy(this.cast.cat.position).setY(this.cast.cat.position.y + 0.15);
    } else if (this.phase === 'ringing') {
      c.lookAt = this.look.set(this.centre.x - 14, 3, this.centre.z - 30);
    }
  }

  /**
   * In over the sill, she kneels there in the opening and looks down at the straw just inside, where the cat is
   * curled round its kittens; then she stands in the opening, looking out.
   */
  private arrive(): void {
    const c = this.cast.child;
    this.phase = 'nest';
    c.faceToward(this.kittens.centre.x, this.kittens.centre.z, 1);
    c.kneeling = 1;
    this.later(3.8, () => {
      c.kneeling = 0;
      this.later(0.8, () => {
        c.yaw = this.outward;
        this.phase = 'ringing';
      });
    });
  }

  /**
   * Up the ivy ahead of her, in over the sill and across the boards to the straw where its kittens are asleep, and
   * round them: it comes in on the heading it lies down on, so that it curls without turning.
   */
  private catClimbs(): void {
    const cat = this.cast.cat;
    const ledge = this.belfry.sill(FACE, -0.24).add(new THREE.Vector3(0, 0, 0.25));
    this.later(0.25, () => cat.climb([...this.ivy.catWay(), ledge], faceOut(FACE), { then: 'stand', speed: 1.2 }, () => {
      const down = this.belfry.inside(FACE, 0.3).add(new THREE.Vector3(0, 0, 0.3));
      cat.hop(down, { then: 'stand', floor: this.floor }, () => {
        const at = this.curlAt();
        const before = at.clone().add(new THREE.Vector3(-Math.sin(CURL_YAW), 0, -Math.cos(CURL_YAW)).multiplyScalar(0.35));
        cat.run([before, at], this.floor, { pace: 'walk', speed: 0.8, then: 'stand' }, () => {
          cat.chirrup();
          cat.rest('curl', null);
          this.later(1.2, () => {
            this.kittens.nestle(cat);
            this.catDone = true;
          });
        });
      });
    }));
  }

  /** Where the cat lies so that the hollow of its curl is round the kittens' heap in the middle of the straw. */
  private curlAt(): THREE.Vector3 {
    const fx = Math.sin(CURL_YAW), fz = Math.cos(CURL_YAW), k = this.cast.cat.scale;
    return this.belfry.nest().setY(this.belfry.floor + 0.03).add(new THREE.Vector3(-fz * 0.1 * k - fx * 0.01 * k, 0, fx * 0.1 * k - fz * 0.01 * k));
  }

  private curlCat(): void {
    const cat = this.cast.cat;
    const at = this.curlAt();
    cat.place(at, CURL_YAW, { pose: 'curl', floor: () => at.y });
    cat.look(null);
    this.kittens.nestle(cat);
  }

  private later(seconds: number, go: () => void): void {
    this.timers.push({ at: this.t + seconds, go });
  }

  /** On the sill in the opening she climbed in by, halfway through the wall. */
  private standInOpening(): THREE.Vector3 {
    return this.belfry.sill(FACE, -BELFRY.wall * 0.45);
  }

  /** Standing in the opening she faces out and a little round toward the last of the sun. */
  private get outward(): number {
    const o = faceOut(FACE);
    return Math.atan2(o.x, o.z) - 0.85;
  }

  private sunDir(): THREE.Vector3 {
    return (this.belfry.mesh.material as THREE.ShaderMaterial).uniforms.uSunDir.value as THREE.Vector3;
  }

  /**
   * The lens, framed for a person: from the side of the face as she climbs, rising with her, the water below and the
   * ivy going up ahead of her (from the north going up, the south coming down, so she is seen looking up or down and
   * never at it); round to the other light to look in at the nest while she kneels over it; and while the bell is hers
   * to ring, out beside the tower so the bell in its opening, her in the other and the water the rings go out over
   * are in one frame. It glides round the tower, never through it, and cuts only into the belfry.
   */
  frame(shot: Shot): number {
    const upright = window.innerWidth / window.innerHeight < 0.9;
    shot.free = false;
    shot.exact = true;
    shot.zoom = undefined;
    shot.from = undefined;
    shot.fitWidth = false;
    shot.subjects = undefined;
    const y = this.view === 'play' ? this.herY.value : this.cast.child.position.y;
    const view = this.view === 'play' ? this.playView() : this.view;
    /** In and out of the belfry the lens cuts; it never glides through the stone. */
    const inside = view === 'wide';
    if (inside !== this.inside) this.cut = true;
    this.inside = inside;
    const S = BELFRY.sill;
    switch (view) {
      case 'climb-far':
        this.eye.set(-8.6, y + 1.2, -10.2);
        this.target.set(-3.6, y + 1.55, -1.0);
        break;
      case 'climb-near':
        this.eye.set(-5.3, y + 1.3, -4.4);
        this.target.set(-3.05, y + 1.4, -0.6);
        break;
      case 'climb-down':
        this.eye.set(upright ? -8.4 : -9.6, y + 1.4, upright ? 7.2 : 8.6);
        this.target.set(upright ? -3.2 : -3.7, y + (upright ? 2.1 : 1.45), upright ? -0.2 : 0.1);
        break;
      case 'climb-profile':
        this.eye.set(-3.4, y + 1.4, -5.4);
        this.target.set(-2.85, y + 1.35, -0.4);
        break;
      case 'climb-side':
        this.eye.set(upright ? -7.8 : -8.6, y + 1.2, upright ? -8.6 : -10.2);
        this.target.set(upright ? -3.2 : -3.6, y + (upright ? 2.3 : 1.55), upright ? -0.7 : -1.0);
        break;
      case 'ivy':
        this.eye.set(-13.5, RIDGE + 3.4, 2.2);
        this.target.set(-2.4, RIDGE + 2.8, -0.2);
        break;
      case 'wide':
        this.eye.set(-1.78, this.belfry.floor + 1.55, 1.78);
        this.target.set(0.35, this.belfry.floor + 1.25, -0.35);
        shot.zoom = 0.6;
        break;
      case 'nest':
        this.eye.set(-3.75, this.belfry.floor + 1.25, 1.55);
        this.target.set(-1.75, this.belfry.floor + 0.45, 0.05);
        break;
      case 'kittens':
        this.eye.set(-2.72, this.belfry.floor + 0.72, 0.98);
        this.target.set(-1.56, this.belfry.floor + 0.15, 0.24);
        break;
      default:
        this.eye.set(upright ? -13.6 : -9.8, S + (upright ? 5.2 : 2.9), upright ? 3.6 : 3.8);
        this.target.set(upright ? -2.2 : -1.9, S + (upright ? -1.5 : 0.45), upright ? 0.1 : -0.15);
    }
    /** The eye goes round the tower, never through it: it glides in its bearing, distance and height about the middle. */
    const want = this.orbitWant.set(Math.atan2(this.eye.z, this.eye.x), Math.hypot(this.eye.x, this.eye.z), this.eye.y);
    this.target.add(this.centre);
    if (this.cut || this.view !== 'play') {
      this.orbitNow.copy(want);
      this.targetNow.copy(this.target);
      this.eyeSpeed.set(0, 0, 0);
      this.targetSpeed.set(0, 0, 0);
      this.cut = false;
    } else {
      want.x = this.orbitNow.x + Math.atan2(Math.sin(want.x - this.orbitNow.x), Math.cos(want.x - this.orbitNow.x));
      glide(this.orbitNow, this.eyeSpeed, want, LENS_GLIDE, this.dt);
      glide(this.targetNow, this.targetSpeed, this.target, LENS_GLIDE * 0.8, this.dt);
    }
    const o = this.orbitNow;
    this.eyeNow.set(this.centre.x + Math.cos(o.x) * o.y, o.z, this.centre.z + Math.sin(o.x) * o.y);
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eyeNow);
    shot.target.copy(this.targetNow);
    shot.distance = this.eyeNow.distanceTo(this.targetNow);
    shot.height = this.eyeNow.y - this.targetNow.y;
    return 0.7;
  }

  private playView(): BellYardView {
    if (this.phase === 'waiting' || this.phase === 'climbing') return 'climb-side';
    if (this.phase === 'down' || this.phase === 'below') return 'climb-down';
    if (this.phase === 'nest') return 'nest';
    return 'bell';
  }

  /** The tower below the belfry, a string course, the cornice's roof above, and the nave's roof up to its west face. */
  private tower(add: AddPart): void {
    const { half } = BELFRY;
    const top = this.belfry.floor - 0.4;
    add(new THREE.BoxGeometry(2 * half, top + 3, 2 * half).translate(0, (top - 3) / 2, 0), WASH, 0);
    add(new THREE.BoxGeometry(2 * half + 0.3, 0.26, 2 * half + 0.3).translate(0, 5.4, 0), DRESSING, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let i = 0, y = -2.5; y < top - 0.2; i++, y += 0.62) {
          const long = i % 2 === 0;
          const wx = long ? 1.0 : 0.62, wz = long ? 0.62 : 1.0;
          add(new THREE.BoxGeometry(wx, 0.5, wz).translate(sx * (half + 0.03 - wx / 2), y + 0.25, sz * (half + 0.03 - wz / 2)), QUOIN, 0);
        }
      }
    }
    add(new THREE.ConeGeometry(3.55, 4.2, 4, 1).rotateY(Math.PI / 4).translate(0, BELFRY.top + 0.32 + 2.1, 0), SLATE, 1);
    drownedHouse(NAVE, add);
  }

  private at(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(this.centre.x + x, y, this.centre.z + z);
  }

  /** Out from `near` toward the low sun until the whole yard is over open water, clear of the island's long shadows. */
  private findWater(near: THREE.Vector3): THREE.Vector3 {
    const wet = (x: number, z: number) => {
      for (let dx = -26; dx <= 18; dx += 2) {
        for (let dz = -18; dz <= 18; dz += 2) if (heightAt(x + dx, z + dz) > -2.5) return false;
      }
      return true;
    };
    for (let reach = 60; reach < 700; reach += 4) {
      for (const [x, z] of [[near.x - reach, near.z], [near.x - reach, near.z + 50]]) if (wet(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(near.x - 160, 0, near.z);
  }
}
