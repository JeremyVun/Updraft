import * as THREE from 'three';

/**
 * The child's bones, in the order the mesh is bound to them. Left is the child's own left, +x, the side the paper is
 * held on. Everything is authored in the frame of the root (feet on y = 0, facing +z) before its 1.12 scale.
 */
export const BONE = {
  hips: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  hood: 5,
  clavL: 6,
  upperL: 7,
  foreL: 8,
  handL: 9,
  clavR: 10,
  upperR: 11,
  foreR: 12,
  handR: 13,
  thighL: 14,
  shinL: 15,
  footL: 16,
  thighR: 17,
  shinR: 18,
  footR: 19,
  bag: 20,
  hem: 21,
  /** The bag's flap: hinged along the top of its outer face, rolling over the hinge in two bones, then its free half. */
  flap: 29,
  flapRoll: 30,
  flapTip: 31,
  /** The pigtails, each hung from its tie below the ear. */
  pigL: 32,
  pigR: 33,
} as const;

/** The coat's hem hangs off a ring of bones round the waist, one every eighth of a turn from the front. */
export const HEM_BONES = 8;
export const BONES = BONE.pigR + 1;

/** Where the left pigtail is tied (the right mirrors it): below the ear, just inside the hood's opening. */
export const PIGTAIL_TIE: [number, number, number] = [0.26, 1.8, 0.19];

export const UPPER_ARM = 0.29;
/** Elbow to wrist, and wrist to the middle of the mitten: a reach is measured to the mitten, as one straight forearm. */
export const WRIST = 0.25;
export const PALM = 0.07;
export const FOREARM = WRIST + PALM;
export const THIGH = 0.32;
export const SHIN = 0.32;
/** The ankle's height over the sole. */
export const ANKLE = 0.1;
/** How far the arms stand out from the sides in the pose the mesh is modelled in. */
export const A_POSE = 0.3;

/** Where the hem ring's bones hang from, and the coat's half-width and half-depth there. */
export const WAIST = { y: 1.02, w: 0.37, d: 0.31 };

export const hemAngle = (i: number) => (i / HEM_BONES) * Math.PI * 2;

type Joint = [bone: number, parent: number, at: [number, number, number]];

/** Each joint's rest position on its parent, arms hanging straight down. */
const JOINTS: Joint[] = [
  [BONE.spine, BONE.hips, [0, 0.22, -0.01]],
  [BONE.chest, BONE.spine, [0, 0.26, 0.01]],
  [BONE.neck, BONE.chest, [0, 0.34, 0]],
  [BONE.head, BONE.neck, [0, 0.14, 0.02]],
  [BONE.hood, BONE.head, [0, 0, 0]],
  [BONE.clavL, BONE.chest, [0.06, 0.25, 0.05]],
  [BONE.upperL, BONE.clavL, [0.23, -0.02, 0.03]],
  [BONE.foreL, BONE.upperL, [0, -UPPER_ARM, 0]],
  [BONE.handL, BONE.foreL, [0, -WRIST, 0]],
  [BONE.clavR, BONE.chest, [-0.06, 0.25, 0.05]],
  [BONE.upperR, BONE.clavR, [-0.23, -0.02, 0.03]],
  [BONE.foreR, BONE.upperR, [0, -UPPER_ARM, 0]],
  [BONE.handR, BONE.foreR, [0, -WRIST, 0]],
  [BONE.thighL, BONE.hips, [0.15, 0, 0]],
  [BONE.shinL, BONE.thighL, [0, -THIGH, 0]],
  [BONE.footL, BONE.shinL, [0, -SHIN, 0]],
  [BONE.thighR, BONE.hips, [-0.15, 0, 0]],
  [BONE.shinR, BONE.thighR, [0, -THIGH, 0]],
  [BONE.footR, BONE.shinR, [0, -SHIN, 0]],
  [BONE.bag, BONE.chest, [0, 0.24, -0.27]],
  [BONE.flap, BONE.bag, [0, -0.03, -0.425]],
  [BONE.flapRoll, BONE.flap, [0, 0.012, 0.03]],
  [BONE.flapTip, BONE.flapRoll, [0, 0.02, 0.19]],
  [BONE.pigL, BONE.head, [PIGTAIL_TIE[0], PIGTAIL_TIE[1] - 1.7, PIGTAIL_TIE[2] - 0.02]],
  [BONE.pigR, BONE.head, [-PIGTAIL_TIE[0], PIGTAIL_TIE[1] - 1.7, PIGTAIL_TIE[2] - 0.02]],
];
for (let i = 0; i < HEM_BONES; i++) {
  const a = hemAngle(i);
  JOINTS.push([BONE.hem + i, BONE.hips, [Math.sin(a) * WAIST.w, WAIST.y - 0.74, Math.cos(a) * WAIST.d]]);
}

export const HIPS_AT = new THREE.Vector3(0, 0.74, 0);

/**
 * How far the head (face, hair and hood) is posed below where it is modelled, so it sits down on the shoulders the way
 * a small child's does. Applied when posing, so everything painted on the head keeps its modelled frame.
 */
export const HEAD_SINK = 0.04;

/** The bones as a hierarchy under the hips, in the pose the mesh is bound in: arms out a little from the sides. */
export function buildBones(): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  for (let i = 0; i < BONES; i++) bones.push(new THREE.Bone());
  bones[BONE.hips].position.copy(HIPS_AT);
  for (const [bone, parent, at] of JOINTS) {
    bones[bone].position.set(...at);
    bones[parent].add(bones[bone]);
  }
  bindPose(bones);
  return bones;
}

export function bindPose(bones: THREE.Bone[]): void {
  for (const b of bones) b.quaternion.identity();
  bones[BONE.upperL].rotation.z = A_POSE;
  bones[BONE.upperR].rotation.z = -A_POSE;
}

/** Every bone's rest position in the root's frame, in the bind pose. */
export function restPositions(bones: THREE.Bone[]): THREE.Vector3[] {
  bones[BONE.hips].updateMatrixWorld(true);
  const parentInverse = new THREE.Matrix4();
  if (bones[BONE.hips].parent) parentInverse.copy(bones[BONE.hips].parent!.matrixWorld).invert();
  return bones.map((b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(parentInverse));
}
