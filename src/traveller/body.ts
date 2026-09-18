import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

export const PALETTE = {
  coat: new THREE.Color('#e0a93c'),
  coatShade: new THREE.Color('#b9832a'),
  scarf: new THREE.Color('#c8372d'),
  skin: new THREE.Color('#f3c9a4'),
  cheek: new THREE.Color('#ee9d8e'),
  eye: new THREE.Color('#2a1a14'),
  boot: new THREE.Color('#4a3326'),
  trousers: new THREE.Color('#3e4a5c'),
};

const VERT = /* glsl */ `
in vec3 color;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Soft, warm, slightly toy-like shading: wrap light, a low-sun rim and a little ambient occlusion toward the ground. */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uGroundPos;
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float sun = groundAt(uGroundPos.xz).w * cloudShadow(uGroundPos.xz);
  float ao = mix(0.55, 1.0, smoothstep(0.0, 1.2, vWorld.y - uGroundPos.y));
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * (0.35 + 0.65 * max(dot(-V, uSunDir), 0.0));
  vec3 col = vColor * (hemiLight(N) * 1.05 * ao + uSunColor * wrap * wrap * sun * 0.95);
  col += uSunColor * vColor * rim * 0.55 * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  return geo;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  /** The elbows: each forearm hangs off its upper arm and carries the mitten. */
  foreL: THREE.Group;
  foreR: THREE.Group;
  handL: THREE.Object3D;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Mesh;
  handR: THREE.Object3D;
  neck: THREE.Object3D;
  /** Places on the child where a companion rides. They belong to the bones they sit on, so a passenger gets every lean, breath and step for free. */
  sockets: Record<SocketName, THREE.Object3D>;
  material: THREE.ShaderMaterial;
}

export type SocketName = 'cradle' | 'satchel' | 'shoulder' | 'lap';

export const UPPER_ARM = 0.29;
export const FOREARM = 0.32;

/**
 * A small child about 2.3 units tall: bell-shaped mustard raincoat, pointed hood, red mittens and scarf knot,
 * dark boots. Pivots sit at hips, shoulders and neck so poses are just rotations.
 */
export function buildChild(): Rig {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms, uGroundPos: { value: new THREE.Vector3() } },
    side: THREE.DoubleSide,
  });
  const mesh = (parts: THREE.BufferGeometry[]) => new THREE.Mesh(mergeGeometries(parts), material);

  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  const body = new THREE.Group();
  body.position.y = 0.62;
  root.add(body);

  const coatProfile = [
    [0.0, -0.08], [0.58, -0.08], [0.62, 0.0], [0.56, 0.18], [0.46, 0.5], [0.37, 0.78], [0.3, 0.94], [0.2, 1.02], [0.0, 1.04],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const coat = paint(new THREE.LatheGeometry(coatProfile, 20), PALETTE.coat);
  const hem = paint(at(new THREE.TorusGeometry(0.585, 0.045, 6, 24).rotateX(Math.PI / 2), 0, 0.02, 0), PALETTE.coatShade);
  /**
   * The satchel is the cygnet's seat, and the game is played from behind the child, so it is an open-topped basket of
   * a bag with its lid folded back: four low walls and a floor round the `satchel` socket, deep enough to hold a bird
   * by the flanks and shallow enough that all of it above the wing is in shot.
   */
  const LEATHER = new THREE.Color('#7d5738');
  const RIM = new THREE.Color('#9c7248');
  const bag: THREE.BufferGeometry[] = [];
  const panel = (w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color) =>
    bag.push(paint(at(new THREE.BoxGeometry(w, h, d), x, y, z), color));
  panel(0.44, 0.05, 0.3, 0, 0.605, -0.55, LEATHER);
  panel(0.44, 0.24, 0.045, 0, 0.72, -0.695, LEATHER);
  panel(0.44, 0.2, 0.045, 0, 0.7, -0.405, LEATHER);
  for (const s of [-1, 1]) panel(0.045, 0.24, 0.3, s * 0.2, 0.72, -0.55, LEATHER);
  /** A rolled rim all the way round the mouth, so the opening reads as an opening from any angle. */
  panel(0.48, 0.05, 0.055, 0, 0.845, -0.7, RIM);
  panel(0.48, 0.05, 0.055, 0, 0.81, -0.4, RIM);
  for (const s of [-1, 1]) panel(0.055, 0.05, 0.31, s * 0.21, 0.845, -0.55, RIM);
  /** The lid, unbuckled and hanging down the back: what makes an open bag read as a satchel and not as a crate. */
  bag.push(paint(at(new THREE.BoxGeometry(0.42, 0.26, 0.04).rotateX(-0.16), 0, 0.72, -0.75), RIM));
  bag.push(paint(at(new THREE.SphereGeometry(0.04, 8, 6), 0, 0.61, -0.775, 1, 1, 0.6), PALETTE.coatShade));
  /** Two straps over the shoulders, which is what holds it where it is and ties it into the coat. */
  for (const s of [-1, 1]) bag.push(paint(at(new THREE.BoxGeometry(0.075, 0.03, 0.95).rotateX(-0.42), s * 0.17, 0.98, -0.16), LEATHER));
  const satchel = mergeGeometries(bag)!;
  const buttons = [0.35, 0.58, 0.8].map((y) =>
    paint(at(new THREE.SphereGeometry(0.035, 6, 4), 0, y, 0.43 - y * 0.12), PALETTE.coatShade),
  );
  const collar = paint(at(new THREE.TorusGeometry(0.22, 0.11, 8, 16).rotateX(Math.PI / 2), 0, 1.02, 0), PALETTE.scarf);
  const knot = paint(at(new THREE.SphereGeometry(0.12, 10, 8), 0.12, 0.98, 0.18, 1, 0.85, 0.9), PALETTE.scarf);
  body.add(mesh([coat, hem, satchel, ...buttons, collar, knot]));

  const neck = new THREE.Object3D();
  neck.position.set(0.12, 1.0, 0.16);
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.38;
  body.add(head);
  const face = paint(at(new THREE.SphereGeometry(0.37, 20, 14), 0, 0, 0.05), PALETTE.skin);
  const hood = paint(at(new THREE.SphereGeometry(0.45, 20, 14), 0, 0.05, -0.07), PALETTE.coat);
  const tip = paint(at(new THREE.ConeGeometry(0.22, 0.5, 12).rotateX(-1.05), 0, 0.36, -0.36), PALETTE.coat);
  const tipEnd = paint(at(new THREE.ConeGeometry(0.1, 0.34, 10).rotateX(-1.9), 0, 0.42, -0.66), PALETTE.coat);
  const pompom = paint(at(new THREE.SphereGeometry(0.1, 10, 8), 0, 0.32, -0.83), PALETTE.scarf);
  const rim = paint(at(new THREE.TorusGeometry(0.34, 0.06, 8, 20), 0, 0.02, 0.3, 1, 1.08, 1), PALETTE.coatShade);
  const cheeks = [-1, 1].map((s) => paint(at(new THREE.SphereGeometry(0.06, 8, 6), s * 0.19, -0.1, 0.36, 1, 0.6, 0.5), PALETTE.cheek));
  head.add(mesh([face, hood, tip, tipEnd, pompom, rim, ...cheeks]));
  const eyes = mesh([-1, 1].map((s) => paint(at(new THREE.SphereGeometry(0.04, 8, 6), s * 0.12, 0.0, 0.405, 1, 1.25, 0.6), PALETTE.eye)));
  head.add(eyes);

  const arm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.34, 0.88, 0.02);
    /** A gathered, puffed sleeve: fullest at the shoulder, drawn in toward the elbow, the way a child's coat is cut. */
    const puff = paint(at(new THREE.SphereGeometry(0.138, 12, 10), 0, -0.035, 0, 1, 0.95, 1), PALETTE.coat);
    const upper = paint(at(new THREE.CapsuleGeometry(0.093, UPPER_ARM - 0.1, 4, 10), 0, -UPPER_ARM / 2 - 0.02, 0), PALETTE.coat);
    g.add(mesh([puff, upper]));
    const fore = new THREE.Group();
    fore.position.set(0, -UPPER_ARM, 0);
    /** The elbow is its own soft ball on the forearm, so a bent arm creases instead of breaking into two sticks. */
    const elbow = paint(at(new THREE.SphereGeometry(0.096, 10, 8), 0, 0.005, 0), PALETTE.coat);
    const sleeve = paint(at(new THREE.CapsuleGeometry(0.09, FOREARM - 0.16, 4, 10), 0, -(FOREARM - 0.1) / 2, 0), PALETTE.coat);
    const cuff = paint(at(new THREE.TorusGeometry(0.087, 0.028, 6, 12).rotateX(Math.PI / 2), 0, -FOREARM + 0.1, 0), PALETTE.coatShade);
    const mitten = paint(at(new THREE.SphereGeometry(0.1, 10, 8), 0, -FOREARM + 0.02, 0.01, 1, 1.15, 1), PALETTE.scarf);
    /** A thumb on the inner edge of each mitten, which is what lets a hand read as holding rather than as touching. */
    const thumb = paint(
      at(new THREE.CapsuleGeometry(0.042, 0.06, 4, 8).rotateZ(side * 0.7).rotateX(-0.35), -side * 0.072, -FOREARM + 0.02, 0.045),
      PALETTE.scarf,
    );
    fore.add(mesh([elbow, sleeve, cuff, mitten, thumb]));
    g.add(fore);
    const hand = new THREE.Object3D();
    hand.position.set(0, -FOREARM, 0.02);
    fore.add(hand);
    return { g, fore, hand };
  };
  const left = arm(-1);
  const right = arm(1);
  body.add(left.g, right.g);

  const leg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.15, 0.62, 0);
    const trouser = paint(at(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), 0, -0.3, 0), PALETTE.trousers);
    const boot = paint(at(new THREE.SphereGeometry(0.13, 10, 8), 0, -0.56, 0.06, 1, 0.75, 1.45), PALETTE.boot);
    g.add(mesh([trouser, boot]));
    root.add(g);
    return g;
  };

  const socket = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const sockets = {
    cradle: socket(body, 0, 0.8, 0.56),
    satchel: socket(body, 0, 0.8, -0.56),
    shoulder: socket(body, -0.3, 1.04, -0.02),
    lap: socket(body, 0, 0.16, 0.52),
  };

  return {
    root,
    body,
    head,
    armL: left.g,
    armR: right.g,
    foreL: left.fore,
    foreR: right.fore,
    handL: left.hand,
    sockets,
    legL: leg(-1),
    legR: leg(1),
    eyes,
    handR: right.hand,
    neck,
    material,
  };
}
