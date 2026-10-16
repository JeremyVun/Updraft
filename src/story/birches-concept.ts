import * as THREE from 'three';
import { birchesAt } from '../world/birches-layout';
import { fallenBole, fallenRadius, FALLEN_BIRCH } from '../world/birches';
import { heightAt } from '../world/island';
import { birchesPoint } from './checkpoint-data';
import { overLimb, type Limb } from './birches-rounds';

/**
 * STAGING (birches-uplift-concept), QA only: poses the birches room by hand for concept stills
 * (`tools/birches-concept.mjs`). The chapter's own update is stood down while a scene is posed; nothing here is the build.
 */

type Game = any;
type Stage = number | { until: string; timeout?: number; after?: number };
const ground = (x: number, z: number): number => Math.max(0, heightAt(x, z));

let posing: ((dt: number) => void) | null = null;
/** Seconds of the scene so far, by the game's clock; the cast's own time stops once `frozen`. */
let clock = 0;
let frozen = false;

/** Stands the chapter down: the scarf and the swing still move, the camera takes `shot` as set, and `posing` runs each frame. */
function standDown(game: Game): void {
  const c = game.story.current;
  if (!c.__played) {
    c.__played = c.update.bind(c);
    for (const who of [game.child, game.cygnet, game.squirrel]) {
      const own = who.update.bind(who);
      who.update = (dt: number, ...rest: unknown[]) => own(frozen ? 0 : dt, ...rest);
    }
  }
  c.update = (dt: number, time: number) => {
    c.now = time;
    clock += dt;
    game.birches.scarf.update(dt, game.wind);
    game.birches.swing.update(dt, game.wind);
    posing?.(dt);
  };
}

/** Hands the room back to its chapter. */
function playOn(game: Game): void {
  const c = game.story.current;
  standDown(game);
  c.update = c.__played;
  posing = null;
  frozen = false;
}

/** A band-local point at `lift` above the ground. */
const at = (x: number, z: number, lift = 0): THREE.Vector3 => {
  const p = birchesAt(x, z);
  return new THREE.Vector3(p.x, ground(p.x, p.z) + lift, p.z);
};

function lens(game: Game, target: THREE.Vector3, from: { x: number; z: number }, distance: number, height: number, zoom?: number): void {
  const s = game.story.current.shot;
  s.eye = undefined;
  s.free = false;
  s.target.copy(target);
  s.from = new THREE.Vector3(from.x, 0, from.z).normalize();
  s.distance = distance;
  s.height = height;
  s.zoom = zoom;
  s.attention = undefined;
  s.fitWidth = false;
  game.rig.cut(s);
}

const tall = (): boolean => window.innerWidth < window.innerHeight;

/** The fallen birch's bole as a limb for paws, between `t` and `u` of its length. */
const bole = (t: number, u: number): Limb => {
  const a = fallenBole(t), b = fallenBole(u);
  return { a, b, r0: fallenRadius(t), r1: fallenRadius(u) };
};
/** On top of the bole `t` of the way along, `lift` above its top. */
const onBole = (t: number, lift = 0): THREE.Vector3 => fallenBole(t).add(new THREE.Vector3(0, fallenRadius(t) + lift, 0));
/** How far along the bole is straight across from the swing. */
const underSwing = (game: Game): number => {
  const p = game.birches.swing.pivot, root = birchesAt(FALLEN_BIRCH.root.x, FALLEN_BIRCH.root.z), crown = birchesAt(FALLEN_BIRCH.crown.x, FALLEN_BIRCH.crown.z);
  return (p.x - root.x) / (crown.x - root.x);
};
/** Beyond the bole, on the ride, where her feet come down. */
const LANDING = { x: 1.4, z: -1127 };

/**
 * The swing's lens: three-quarters on from the south-east, low, into the low sun, holding the arc from its back top to
 * where she lands; portrait from nearer the south, so the arc runs away from the lens toward the bole.
 */
function swingLens(game: Game, landed = 0): void {
  const p = game.birches.swing.pivot;
  const mid = new THREE.Vector3(p.x - 0.6, 0, p.z - 3.4 - landed * 4);
  mid.y = ground(mid.x, mid.z) + 2.4 - landed;
  const [fx, fz, d, h, zoom, lift] = (window as any).__swingLens ?? (tall() ? [0.22, 0.97, 24, 4.5, 1.2, 2.2] : [0.6, 0.8, 20, 4.8, 0, 0]);
  mid.y += lift ?? 0;
  const lifted = (window as any).__landedLift ?? 3;
  lens(game, mid, { x: fx, z: fz }, d, h + landed * lifted, zoom || undefined);
}

function seatHer(game: Game, angle: number): void {
  const swing = game.birches.swing, child = game.child;
  swing.rider = 1;
  swing.braking = false;
  posing = () => {
    swing.angle = angle;
    swing.speed = 0;
    swing.group.rotation.x = -angle;
    const seat = swing.seat(new THREE.Vector3());
    child.ride(seat, Math.PI);
    child.swing = 1;
    child.kick = THREE.MathUtils.clamp(-angle / 0.5, -1, 1);
    child.lookAt = at(LANDING.x, LANDING.z, 1);
  };
  posing(0);
}

/** The cygnet on the ground on the near side of the bole, watching her swing. */
function birdWatching(game: Game, target: THREE.Vector3): void {
  const b = game.cygnet, spot = at(-1.6, -1118.4);
  if (b.carried) b.release(spot);
  b.standAt(spot.x, spot.y, spot.z, Math.atan2(target.x - spot.x, target.z - spot.z));
  b.stay = true;
  b.errand = null;
  b.watch(target);
}

function squirrelSits(game: Game, t: number, toward: THREE.Vector3, action: 'sit' | 'scold' | 'bound' = 'sit'): void {
  const s = game.squirrel, on = onBole(t);
  s.visible = true;
  s.act(action, { at: on, yaw: Math.atan2(toward.x - on.x, toward.z - on.z), floor: overLimb(bole(Math.max(0, t - 0.15), Math.min(1, t + 0.15))) });
  s.look(toward);
}

export function stageScene(game: Game, name: string, arg?: string): Stage {
  /** Beats of the round being played: the chapter keeps playing, the still waits for the moment. */
  if (name === 'r3-dare') {
    /** It sits up between the heaps and chatters at her, before the first dive. */
    return { until: `__game.story.current.squirrel.mode === 'shuffling' && !__game.story.current.squirrel.shuffle`, timeout: 240000, after: Number(arg ?? 900) };
  }
  if (name === 'r3-air') {
    /** Out of one heap and in the air on its way to the next, clear of both. */
    return { until: `(() => { const q = __game.story.current.squirrel, s = __game.squirrel, r = __sq.ROUNDS[2];
      if (!q.shuffle || q.shuffle.move < ${Number(arg ?? 1)} || s.visible === false) return false;
      const clear = r.heaps.every((i) => { const p = __sq.BIRCH_PILES[i]; return Math.hypot(s.position.x - p.x, s.position.z - p.z) > p.r * 1.02; });
      return clear && s.mode !== 'hold'; })()`, timeout: 240000 };
  }
  if (name === 'wait') return Number(arg ?? 3000);
  if (name === 'r3-settled') {
    /** Hidden for good, she watching the heap it went into last. */
    return { until: `__game.story.current.beat === 'round' && __game.story.current.squirrel.mode === 'hidden'`, timeout: 240000, after: Number(arg ?? 1500) };
  }
  if (name === 'lens') {
    /** Sets the swing's lens for the scenes after it, `fx,fz,distance,height`; no still. */
    (window as any).__swingLens = arg?.split(',').map(Number);
    return -1;
  }
  const child = game.child, swing = game.birches.swing;
  standDown(game);
  posing = null;
  frozen = false;
  clock = 0;
  if (name === 'top') {
    /** Down over a band-local point, `x,z,height`, north at the top of the frame. */
    const [x, z, h] = (arg ?? '0,-1118,60').split(',').map(Number);
    const s = game.story.current.shot;
    s.eye = at(x, z + h * 0.08, h);
    s.target.copy(at(x, z));
    s.free = true;
    s.zoom = undefined;
    game.rig.cut(s);
    return 3000;
  }
  if (name === 'approach') {
    /** The real walk from round 2's heaps up the ride, the real walking lens: she is let go and the still is taken as she nears the swing. */
    playOn(game);
    const c = game.story.current;
    child.stop();
    const from = at(4.6, -1099.5);
    child.place(from.x, from.z, Math.PI);
    game.glider.hold(child);
    if (!game.cygnet.carried) game.cygnet.rideIn('satchel');
    c.restoreCheckpoint(birchesPoint(2, 1, false), [2, 0, 0.62, 1, 2]);
    c.update(0, c.now);
    game.rig.cut(c.shot);
    const stop = Number(arg ?? 11.5);
    return { until: `Math.hypot(__game.child.position.x - __game.birches.swing.pivot.x, __game.child.position.z - __game.birches.swing.pivot.z) < ${stop}`, timeout: 120000, after: 0 };
  }
  if (name === 'r3') {
    /** Round 3 played for real from the walk in after the second tangle: the still is taken as she comes up to her stand. */
    playOn(game);
    const c = game.story.current;
    child.stop();
    const from = at(-7.2, -1149.5);
    child.place(from.x, from.z, Math.PI);
    game.glider.hold(child);
    if (!game.cygnet.carried) game.cygnet.rideIn('satchel');
    c.restoreCheckpoint(birchesPoint(2, 2, true), [4, 1, 0.62, 2, 2]);
    c.update(0, c.now);
    game.rig.cut(c.shot);
    return { until: `(() => { const c = __game.story.current, r = __sq.ROUNDS[2], p = __game.child.position; return c.round === 2 && Math.hypot(p.x - r.stand.x, p.z - r.stand.z) < ${Number(arg ?? 2.5)}; })()`, timeout: 240000 };
  }
  const t = underSwing(game);
  if (name === 'back') {
    /** On the swing at the back of the arc, the bole ahead of her. */
    seatHer(game, 0.92);
    birdWatching(game, swing.seat(new THREE.Vector3()));
    squirrelSits(game, t - 0.2, swing.seat(new THREE.Vector3()));
    swingLens(game);
    return 2500;
  }
  if (name === 'release') {
    /** At the top of a forward swing, the moment she lets go: just off the seat, over the bole. */
    seatHer(game, -1.06);
    birdWatching(game, onBole(t, 2));
    squirrelSits(game, t - 0.2, onBole(t, 2));
    swingLens(game);
    const seat = swing.seat(new THREE.Vector3()), landing = at(LANDING.x, LANDING.z);
    const after = Number(arg ?? 0.34);
    let gone = false;
    const hold = posing!;
    posing = (dt) => {
      if (!gone && clock > 1.2) {
        gone = true;
        swing.rider = 0;
        child.leap(new THREE.Vector3(0, 1.6, -3.4), landing, 7.5, () => {}, () => {});
        posing = () => {
          swing.angle = -1.06 + Math.min(0.12, (clock - 1.2) * 0.4);
          swing.group.rotation.x = -swing.angle;
          if (clock > 1.2 + after) frozen = true;
        };
        return;
      }
      if (!gone) hold(dt);
    };
    void seat;
    return { until: '__game.child.action?.kind === "leap" && __sq.isFrozen()', timeout: 180000, after: 600 };
  }
  if (name === 'landed') {
    /** On her feet beyond it, looking back at the swing going on without her; the cygnet up on the bole, the squirrel running on along it. */
    swing.rider = 0;
    posing = () => {
      swing.angle = -0.35;
      swing.speed = 0;
      swing.group.rotation.x = 0.35;
    };
    const landing = at(LANDING.x, LANDING.z);
    child.dismount();
    child.swing = 0;
    child.kick = 0;
    child.place(landing.x, landing.z, 0);
    child.lookAt = at(-0.4, -1120.6, 1.8);
    const b = game.cygnet, perch = onBole(t - 0.17);
    if (b.carried) b.release(perch);
    b.perch(perch, Math.atan2(landing.x - perch.x, landing.z - perch.z));
    b.watch(landing.clone().setY(landing.y + 1.6));
    squirrelSits(game, Math.min(0.97, t + 0.06), at(9, -1121.5), 'bound');
    swingLens(game, 1);
    return 3000;
  }
  return 2000;
}

export const isFrozen = (): boolean => frozen;

/** The ground along the ride and every place the wool crosses it, band-local, near the swing. */
export function probeRide(game: Game, z0 = -1104, z1 = -1140, x = 2): Record<string, unknown> {
  const tied: THREE.Vector3[] = game.birches.scarf.tied;
  const rows: unknown[] = [];
  for (let z = z0; z >= z1; z -= 1) {
    const p = birchesAt(x, z);
    const near = tied.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.8);
    rows.push([z, +ground(p.x, p.z).toFixed(2), near.length ? +(Math.min(...near.map((q) => q.y)) - ground(p.x, p.z)).toFixed(2) : null]);
  }
  return { rows };
}

export function sceneReport(game: Game): Record<string, unknown> {
  const s = game.birches.swing, c = game.child, r = (v: THREE.Vector3) => v.toArray().map((n: number) => +n.toFixed(2));
  const seat = s.seat(new THREE.Vector3());
  return { pivot: r(s.pivot), length: +s.length.toFixed(2), angle: +s.angle.toFixed(2), seatAboveGround: +(seat.y - ground(seat.x, seat.z)).toFixed(2),
    child: r(c.position), beat: game.story.current.beat, busy: c.busy, squirrel: { mode: game.story.current.squirrel?.mode, step: game.story.current.squirrel?.shuffle?.step,
      move: game.story.current.squirrel?.shuffle?.move, order: game.story.current.squirrel?.shuffle?.order, action: game.squirrel.action, own: game.squirrel.mode, at: r(game.squirrel.position) } };
}
