import * as THREE from 'three';
import { LOOP, LOOP_BACK, LOOP_FAR, LOOP_GAP, STEP, along, flight, landingOf } from './stairs-layout';

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

/** The loop's last flight as drawn in, up its middle from the foot to where it comes onto the copy. */
const drawnLine = Array.from({ length: 25 }, (_, i) => drawIn(LOOP_BACK.bottom.clone().lerp(LOOP_BACK.top, i / 24)));

/**
 * How far up the loop's last flight, as drawn in, something standing on it is: 0 at its foot, 1 at its top, and
 * more than 1 once it is past the top onto the copy of the corner.
 */
export function upBack(p: THREE.Vector3): number {
  let best = 0, near = Infinity;
  drawnLine.forEach((q, i) => {
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < near) { near = d; best = i; }
  });
  const top = drawnLine[24], before = drawnLine[23];
  const past = ((p.x - top.x) * (top.x - before.x) + (p.z - top.z) * (top.z - before.z)) / Math.max(1e-4, before.distanceToSquared(top));
  return best === 24 && past > 0 ? 1 + past / 24 : best / 24;
}

/** How big anything on the loop's last flight has to be drawn so that from the eye it is the size it would be on the corner. */
export function sizeOnBack(p: THREE.Vector3): number {
  return THREE.MathUtils.lerp(1, LOOP_SHRINK, Math.min(1, upBack(p)));
}
