import * as THREE from 'three';
import { BAG, COAT_TOP, FACE, HOOD, KNOT_THETA, buildGarments, coatAt, hemY, wrapPath } from './child/garments';
import { childMaterial, PALETTE } from './child/shader';
import { BONE, buildBones, restPositions, UPPER_ARM, FOREARM, PALM } from './child/skeleton';

export { PALETTE, UPPER_ARM, FOREARM, BONE };

export type SocketName = 'cradle' | 'satchel' | 'shoulder' | 'lap';

export interface Rig {
  root: THREE.Group;
  bones: THREE.Bone[];
  mesh: THREE.SkinnedMesh;
  /**
   * The frame the story places things in: its origin at the height of the hips when standing, carried by the chest,
   * so whatever is held against the child or reached for in their frame leans and breathes with them.
   */
  body: THREE.Object3D;
  /** The same frame carried by the hips instead, for what sits in the lap. */
  seat: THREE.Object3D;
  /** The middle of each mitten, where a hand holds things. Left is the child's own left, +x. */
  gripL: THREE.Object3D;
  gripR: THREE.Object3D;
  /** The middle of the face. */
  face: THREE.Object3D;
  /** Where the scarf's ends come out of its knot. */
  knot: THREE.Object3D;
  /** Places on the child where a companion rides. They belong to the bones they sit on, so a passenger gets every lean, breath and step for free. */
  sockets: Record<SocketName, THREE.Object3D>;
  material: THREE.ShaderMaterial;
  /** Every bone's position in the root's frame in the pose the mesh was modelled in. */
  rest: THREE.Vector3[];
}

/** The story's frame: the child's middle at the height of the hips, as the whole game has always measured them. */
export const BODY_ORIGIN = new THREE.Vector3(0, 0.62, 0);

/** An empty placed on a bone at a point given in the root's rest frame. */
function on(bone: THREE.Bone, rest: THREE.Vector3, at: THREE.Vector3): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.copy(at).sub(rest);
  bone.add(o);
  return o;
}

/**
 * The child, about 2.8 units tall: a mustard hooded coat to the knee, a chunky red scarf, mittens, wellingtons and a
 * leather bag on the back for the cygnet. One skinned mesh; the story poses it through `bones`.
 */
export function buildChild(): Rig {
  const root = new THREE.Group();
  const bones = buildBones();
  root.add(bones[BONE.hips]);
  root.updateMatrixWorld(true);
  const rest = restPositions(bones);
  const bind = bones.map((b) => b.matrixWorld.clone());
  const geometry = buildGarments(rest, bind).geometry();
  const material = childMaterial();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(bones));

  const frame = (bone: number) => on(bones[bone], rest[bone], BODY_ORIGIN);
  const body = frame(BONE.chest);
  const seat = frame(BONE.hips);
  const bagFrame = frame(BONE.bag);
  const socket = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const sockets: Record<SocketName, THREE.Object3D> = {
    /** In against the chest, and near enough that both mittens can rest on it without the arms running out of reach. */
    cradle: socket(body, 0, 0.79, 0.5),
    /**
     * Down inside the bag, not on it: its flanks and folded wings are in the pouch and the rim closes round them,
     * with the breast against the child's back and the shoulders clear of the low far edge of the mouth. It hangs
     * on the bag's own bone, so the bird sways with the bag.
     */
    satchel: socket(bagFrame, 0, BAG.c.y - BODY_ORIGIN.y + 0.115, BAG.c.z + 0.02),
    shoulder: socket(body, -0.3, 1.04, -0.02),
    lap: socket(seat, 0, 0.16, 0.52),
  };
  const grip = (hand: number) => {
    const o = new THREE.Object3D();
    o.position.set(0, -PALM, 0.005);
    bones[hand].add(o);
    return o;
  };
  const rig: Rig = {
    root,
    bones,
    mesh,
    body,
    seat,
    gripL: grip(BONE.handL),
    gripR: grip(BONE.handR),
    face: on(bones[BONE.head], rest[BONE.head], FACE.c),
    knot: on(bones[BONE.chest], rest[BONE.chest], wrapPath(KNOT_THETA).add(new THREE.Vector3(0.03, -0.05, 0.03))),
    sockets,
    material,
    rest,
  };
  root.scale.setScalar(1.12);
  return rig;
}

const HOOD_AT = HOOD.c.clone().sub(BODY_ORIGIN);
const HOOD_KEEP = HOOD.r.clone().addScalar(0.04);
const BAG_AT = new THREE.Vector3(BAG.c.x, BAG.c.y - BODY_ORIGIN.y, BAG.c.z - 0.02);
const BAG_KEEP = new THREE.Vector3(0.35, 0.36, 0.33);
const sample = { p: new THREE.Vector3(), n: new THREE.Vector3(), fold: 0 };
const away = new THREE.Vector3();

function outOfEllipsoid(p: THREE.Vector3, centre: THREE.Vector3, r: THREE.Vector3): void {
  away.subVectors(p, centre).divide(r);
  const d = away.length();
  if (d < 1) p.copy(centre).add(away.multiplyScalar(1 / Math.max(d, 1e-4)).multiply(r));
}

/**
 * Moves a point in the body's frame to the outside of the child: the coat, the scarf's wrap, the hood and the bag.
 * The scarf's ends hang on this, so they lie over the coat instead of through it.
 */
export function keepOffChild(p: THREE.Vector3): void {
  const y = p.y + BODY_ORIGIN.y;
  const a = Math.atan2(p.x, p.z);
  if (y > hemY(a) - 0.05 && y < COAT_TOP + 0.08) {
    coatAt(a, THREE.MathUtils.clamp(y, hemY(a), COAT_TOP), sample);
    /** Further out low down, where the hem swings out beyond its resting shape. */
    const r = Math.max(Math.hypot(sample.p.x, sample.p.z) + 0.045 + 0.1 * THREE.MathUtils.smoothstep(y, 1.05, 0.6), y > 1.5 ? 0.31 : 0);
    const d = Math.hypot(p.x, p.z);
    if (d < r) {
      p.x = d > 1e-4 ? (p.x * r) / d : 0;
      p.z = d > 1e-4 ? (p.z * r) / d : r;
    }
  }
  outOfEllipsoid(p, HOOD_AT, HOOD_KEEP);
  outOfEllipsoid(p, BAG_AT, BAG_KEEP);
}
