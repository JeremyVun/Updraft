import * as THREE from 'three';
import { LEAF_SHAPE_GLSL, LEAF_TINT_GLSL } from '../fx/leaves';
import { fixInPlace } from '../gl/fixed';
import { tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { grassHeightAt } from './grass';
import { heightAt } from './island';
import { mulberry32 } from './noise';
import { STAIRS_ARRIVAL, STAIRS_FOOT, STAIRS_LANDING, STEP, STRING, along, flight, leftOf } from './stairs-layout';

/** Sand below this is the tide's. */
const TIDE = 0.6;
/** How far every leaf keeps from where the child and the cygnet walk. */
const CLEAR = 2.5;

const VERT = /* glsl */ `
in vec4 aSpot;
in vec4 aQuat;
in vec2 aLook;
out vec2 vCorner;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSide;
out vec2 vLook;
vec3 turn(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
void main() {
  vec2 c = position.xy;
  float across = c.x * 1.45;
  float curl = 0.28 * across * across + 0.12 * max(c.y, 0.0) * max(c.y, 0.0);
  vec3 local = vec3(across, curl, c.y) * aSpot.w;
  vWorld = aSpot.xyz + turn(aQuat, local);
  vNormal = turn(aQuat, vec3(0.0, 1.0, 0.0));
  vSide = turn(aQuat, vec3(1.0, 0.0, 0.0));
  vCorner = c;
  vLook = aLook;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${LEAF_TINT_GLSL}
${LEAF_SHAPE_GLSL}
in vec2 vCorner;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSide;
in vec2 vLook;
void main() {
  float seed = vLook.x;
  if (birchLeafEdge(vCorner, seed) < 0.0) discard;
  vec3 N = leafCurl(normalize(vNormal), normalize(vSide), vCorner, 0.55);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 alb = leafVeins(birchLeaf(0.25 + 0.75 * fract(seed * 7.13), 1.0), vCorner);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float wrap = abs(dot(N, uSunDir)) * 0.4 + 0.42;
  vec3 col = alb * (hemiLight(N) * 0.8 + uSunColor * wrap * sun * 0.6) * vLook.y;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface Leaf {
  x: number;
  y: number;
  z: number;
  /** Half its length. */
  size: number;
  normal: THREE.Vector3;
  /** Which way its tip points, about its normal. */
  yaw: number;
  seed: number;
  /** How much light reaches it down among the blades. */
  shade: number;
}

function segmentDistance(px: number, pz: number, a: THREE.Vector2, b: THREE.Vector2): number {
  const dx = b.x - a.x, dz = b.y - a.y;
  const t = THREE.MathUtils.clamp(((px - a.x) * dx + (pz - a.y) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - a.x - dx * t, pz - a.y - dz * t);
}

function groundNormal(x: number, z: number): THREE.Vector3 {
  const e = 0.25;
  return new THREE.Vector3(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}

/** The leaves round `seat` (the swing's seat lying on the arrival beach), up the grass and on the first steps. */
function lay(seat: THREE.Vector3): Leaf[] {
  const rand = mulberry32(71);
  const first = flight(1);
  const up = along(first.yaw);
  const side = leftOf(first.yaw);
  /** Where she steps off the bow, then the walk up to the stair. */
  const ashore = new THREE.Vector2(STAIRS_LANDING.x + 5.5, STAIRS_LANDING.y);
  const walk = [STAIRS_LANDING, ashore, STAIRS_ARRIVAL, new THREE.Vector2(STAIRS_FOOT.x, STAIRS_FOOT.z), new THREE.Vector2(first.top.x, first.top.z)];
  const offWalk = (x: number, z: number) => walk.every((a, i) => i === 0 || segmentDistance(x, z, walk[i - 1], a) > CLEAR);
  const size = () => tuning.birches.leafSize * 0.5 * (1.2 + 0.85 * rand());
  const leaves: Leaf[] = [];
  const onGround = (x: number, z: number, tilt: number, toward?: THREE.Vector3) => {
    const grass = grassHeightAt(x, z);
    const normal = groundNormal(x, z);
    const lean = toward ?? new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize();
    normal.addScaledVector(lean, tilt).normalize();
    leaves.push({
      x, y: heightAt(x, z) + 0.03 + 0.02 * rand(), z, size: size(), normal, yaw: rand() * Math.PI * 2,
      seed: rand(), shade: 1 - 0.35 * THREE.MathUtils.smoothstep(grass, 0.15, 0.6),
    });
  };

  const lee = first.bottom.clone().addScaledVector(up, 0.6).addScaledVector(side, 1.15);
  const landward = new THREE.Vector3(lee.x - seat.x, 0, lee.z - seat.z).normalize();
  for (let tries = 0; leaves.length < 52 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = 0.72 + 2.2 * rand() ** 2.2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    if (rand() > 0.3 + 0.7 * Math.max(0, dir.dot(landward))) continue;
    const x = seat.x + dir.x * r, z = seat.z + dir.z * r;
    if (heightAt(x, z) < TIDE || !offWalk(x, z)) continue;
    onGround(x, z, r < 1.0 ? 0.35 : rand() * 0.25, r < 1.0 ? dir : undefined);
  }

  /** Bowed away from the walk, so the scatter runs up the grass beside it rather than across it. */
  const bow = new THREE.Vector3((seat.x + lee.x) / 2, 0, (seat.z + lee.z) / 2).addScaledVector(new THREE.Vector3(landward.z, 0, -landward.x), 3.5);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(seat.x, 0, seat.z), bow, new THREE.Vector3(lee.x, 0, lee.z));
  const p = new THREE.Vector3();
  for (let tries = 0, laid = 0; laid < 30 && tries < 2000; tries++) {
    const t = 0.1 + 0.85 * rand();
    if (rand() > (1 - t) ** 1.4 + 0.12) continue;
    curve.getPoint(t, p);
    const spread = 2.6 - 1.4 * t;
    const x = p.x + (rand() - 0.5) * 2 * spread, z = p.z + (rand() - 0.5) * 2 * spread;
    if (heightAt(x, z) < TIDE || !offWalk(x, z)) continue;
    onGround(x, z, rand() * 0.3);
    laid++;
  }

  for (let i = 0; i < 7; i++) {
    const at = first.bottom.clone().addScaledVector(up, 0.1 + 1.4 * rand()).addScaledVector(side, STEP.width / 2 + STRING.thick + 0.12 + 0.35 * rand());
    onGround(at.x, at.z, 0.4, side);
  }
  /** Against the next riser, by the string on the climber's left. */
  for (const tread of [1, 2, 4]) {
    const at = first.bottom.clone().addScaledVector(up, tread * STEP.going - 0.17).addScaledVector(side, 0.55 + 0.05 * rand());
    leaves.push({
      x: at.x, y: first.bottom.y + tread * STEP.rise + 0.035, z: at.z, size: tuning.birches.leafSize * 0.5 * 1.15,
      normal: new THREE.Vector3(0, 1, 0).addScaledVector(up, -0.55).normalize(), yaw: first.yaw + Math.PI / 2 + (rand() - 0.5) * 0.6,
      seed: rand(), shade: 1,
    });
  }
  return leaves;
}

/**
 * A handful of the birches' gold come on after the child to the stairs island: a drift banked on the landward side
 * of the swing's seat, thinning up the grass toward the stair, and a few caught against the first steps. They lie
 * where the afternoon left them; nothing moves them.
 */
export function echoLeaves(seatEcho: THREE.Object3D): THREE.Mesh {
  const seat = new THREE.Box3().setFromObject(seatEcho).getCenter(new THREE.Vector3());
  const leaves = lay(seat);
  const card = new THREE.PlaneGeometry(2, 2, 4, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = card.index;
  geo.setAttribute('position', card.getAttribute('position'));
  const spot = new Float32Array(leaves.length * 4);
  const quat = new Float32Array(leaves.length * 4);
  const look = new Float32Array(leaves.length * 2);
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const y = new THREE.Vector3(0, 1, 0);
  const box = new THREE.Box3();
  leaves.forEach((l, i) => {
    q.setFromUnitVectors(y, l.normal).multiply(spin.setFromAxisAngle(y, l.yaw));
    spot.set([l.x, l.y, l.z, l.size], i * 4);
    quat.set([q.x, q.y, q.z, q.w], i * 4);
    look.set([l.seed, l.shade], i * 2);
    box.expandByPoint(new THREE.Vector3(l.x, l.y, l.z));
  });
  geo.setAttribute('aSpot', new THREE.InstancedBufferAttribute(spot, 4));
  geo.setAttribute('aQuat', new THREE.InstancedBufferAttribute(quat, 4));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 2));
  geo.instanceCount = leaves.length;
  geo.boundingSphere = box.expandByScalar(0.5).getBoundingSphere(new THREE.Sphere());
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  }));
  mesh.name = 'echo-stairs-leaves';
  fixInPlace(mesh);
  return mesh;
}
