import * as THREE from 'three';
import { LOOP, LOOP_BACK, LOOP_FAR, LOOP_GAP, RAIL_HEIGHT, STEP, along, flight, landingOf } from './stairs-layout';

/**
 * The loop that seems to climb for ever, and where it has to be seen from. The loop's last flight is built going on
 * up as far as a whole round higher than the corner it seems to come back to, and nearer the eye along the line from
 * the eye through that corner. There it is drawn in to a copy of the corner, shrunk about the eye until, from the eye,
 * it lies exactly over the real one. Anywhere else, the trick shows.
 */

/** How far from the loop's near corner the eye stands, back along the line the join lies on. */
const EYE_DISTANCE = 30;
/** The lens it is seen through from there. */
export const LOOP_ZOOM = 2.2;

const corner = landingOf(LOOP.corner);
export const LOOP_EYE = corner.centre.clone().addScaledVector(LOOP_GAP.clone().normalize(), EYE_DISTANCE);
/** How much smaller the copy of the corner is than the corner itself. */
export const LOOP_SHRINK = (EYE_DISTANCE - LOOP_GAP.length()) / EYE_DISTANCE;
/** The copy's middle, which from the eye lies exactly in front of the corner's middle. */
export const LOOP_COPY = corner.centre.clone().add(LOOP_GAP);
/**
 * The heap of cloud over the way on, sitting on its first treads just past the far corner, so that the bird going
 * round the corner passes in front of it rather than through it.
 */
export const LOOP_BANK = (() => {
  const on = flight(LOOP.onward + 1);
  return on.bottom.clone().lerp(on.top, 0.4).addScaledVector(along(on.yaw), 0.3).setY(THREE.MathUtils.lerp(on.bottom.y, on.top.y, 0.4) + 0.6);
})();
/** Where the eye looks: the middle of the loop, drawn a little toward the heap so that it is in the frame too. */
export const LOOP_LOOK = [corner.centre, landingOf(LOOP.wait).centre, landingOf(LOOP.onward).centre, LOOP_FAR.landing.centre]
  .reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25).lerp(LOOP_BANK, 0.22)
  .setY(landingOf(LOOP.wait).centre.y + 0.4);

/** From a point on the near corner to the same point on its copy, and back. */
export function toCopy(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(p).sub(LOOP_EYE).multiplyScalar(LOOP_SHRINK).add(LOOP_EYE);
}
export function fromCopy(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(p).sub(LOOP_EYE).divideScalar(LOOP_SHRINK).add(LOOP_EYE);
}

const backWay = along(LOOP_BACK.yaw);
const backRun = STEP.going * (LOOP_BACK.risers - 1);

/** How far up the loop's last flight a point is: 0 at its foot, 1 where it comes onto the copy of the corner. */
export function alongBack(p: THREE.Vector3): number {
  return THREE.MathUtils.clamp(((p.x - LOOP_BACK.bottom.x) * backWay.x + (p.z - LOOP_BACK.bottom.z) * backWay.z) / backRun, 0, 1);
}

/** A point of the loop's last flight as built, drawn in toward the copy the nearer it is to it, until at its top it is the copy's size. */
export function drawIn(v: THREE.Vector3): THREE.Vector3 {
  const s = alongBack(v);
  const shrunk = toCopy(v.clone().sub(LOOP_GAP));
  return v.lerp(shrunk, s);
}

/**
 * `alongBack` worked back from a point of the flight as drawn in, for sorting it a pixel at a time. Drawn in, a
 * point is v·(1 − a·s) + s·c (`drawIn`, a = 1 − LOOP_SHRINK), so its distance t along the flight's way from where the
 * foot's line crosses it solves aRun·s² − k·s + t = 0.
 */
export const ALONG_DRAWN = (() => {
  const a = 1 - LOOP_SHRINK;
  const c = LOOP_EYE.clone().multiplyScalar(a).addScaledVector(LOOP_GAP, -LOOP_SHRINK);
  const base = LOOP_BACK.bottom.x * backWay.x + LOOP_BACK.bottom.z * backWay.z;
  return { way: new THREE.Vector2(backWay.x, backWay.z), base, aRun: a * backRun, k: backRun + c.x * backWay.x + c.z * backWay.z - a * base };
})();

/**
 * The slope of the loop's last flight as drawn in, as a plane (its normal and its distance from the origin): on its
 * treads at its foot, where it must stay in front of the landing it leaves, and at the height of its rail at its top,
 * where the rail must go behind the corner's newel.
 */
export const DRAWN_SLOPE = (() => {
  const foot = drawIn(LOOP_BACK.bottom.clone()), head = drawIn(LOOP_BACK.top.clone()).setY(drawIn(LOOP_BACK.top.clone()).y + RAIL_HEIGHT * LOOP_SHRINK);
  const n = head.clone().sub(foot).cross(new THREE.Vector3(backWay.z, 0, -backWay.x)).normalize();
  return new THREE.Vector4(n.x, n.y, n.z, n.dot(foot));
})();

/** The loop's last flight as drawn in, up its middle from the foot to where it comes onto the copy. */
const drawnLine = Array.from({ length: 25 }, (_, i) => drawIn(LOOP_BACK.bottom.clone().lerp(LOOP_BACK.top, i / 24)));

/**
 * How far up the loop's last flight, as drawn in, something standing on it is: 0 at its foot, 1 at its top, and
 * more than 1 once it is past the top onto the copy of the corner.
 */
export function upBack(p: THREE.Vector3): number {
  let best = 0, near = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = drawnLine[i], b = drawnLine[i + 1];
    const ex = b.x - a.x, ez = b.z - a.z;
    const t = THREE.MathUtils.clamp(((p.x - a.x) * ex + (p.z - a.z) * ez) / Math.max(1e-8, ex * ex + ez * ez), 0, i === 23 ? Infinity : 1);
    const d = Math.hypot(p.x - a.x - ex * t, p.z - a.z - ez * t);
    if (d < near) { near = d; best = (i + t) / 24; }
  }
  return best;
}

/** How big anything on the loop's last flight has to be drawn so that from the eye it is the size it would be on the corner. */
export function sizeOnBack(p: THREE.Vector3): number {
  return THREE.MathUtils.lerp(1, LOOP_SHRINK, Math.min(1, upBack(p)));
}
