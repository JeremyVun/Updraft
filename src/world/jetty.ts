import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOME_JETTY } from '../story/home';
import { glsl } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { mulberry32, smoothstep } from './noise';

/**
 * The jetty on the home island's south beach. Every other island is arrived at by running the bow up a beach;
 * this is the one landing in the journey that somebody built, and keeps: a tarred pile every few feet, planks
 * gone silver in the weather, a bollard with the cottage's paint on it, a lantern for a boat coming in late,
 * and a coil of rope, a bucket and a creel left where they were last put down.
 */

const MID_Z = (HOME_JETTY.shoreZ + HOME_JETTY.endZ) / 2;
const HALF_LENGTH = (HOME_JETTY.endZ - HOME_JETTY.shoreZ) / 2;
const DECK = HOME_JETTY.deck;

const PLANK = { pitch: 0.305, width: 0.256, thick: 0.075 };
/** The walking strip's half-width, and the head at the seaward end the boat lies against. */
const SHAFT_HALF = HOME_JETTY.halfWidth + 0.22;
const HEAD = { from: 8.4, half: 2.05 };
const BENTS = 10;
/** Where the working things stand: clear of the strip the child walks, out on the widened head. */
const POST_X = 1.6;
const POST_Z = 12.85;

/** Local z of the seaward end, so the whole jetty can be laid out about its middle. */
const END = HALF_LENGTH;
/** Where the head's own stringers start: the first point out where the deck is already wide enough to hide them. */
const HEAD_STRINGER = 9;

function halfAt(lz: number): number {
  return SHAFT_HALF + (HEAD.half - SHAFT_HALF) * smoothstep(HEAD.from - 1, HEAD.from + 0.7, lz);
}

const VERT = /* glsl */ `
in vec3 color;
in float aGlow;
in float aWet;
out vec3 vColor;
out vec3 vWorld;
out vec3 vLocal;
out vec3 vNormal;
out float vGlow;
out float vWet;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vGlow = aGlow;
  vWet = aWet;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vLocal;
in vec3 vNormal;
in float vGlow;
in float vWet;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 alb = vColor;
  /** Grain runs the length of a piece: across the jetty on the deck boards, and up the piles and posts. */
  float boards = vnoise(vec2(vLocal.x * 1.2, vLocal.z * 26.0));
  float posts = vnoise(vec2(vLocal.y * 1.4, (vLocal.x + vLocal.z) * 22.0));
  alb *= 0.86 + 0.26 * mix(posts, boards, smoothstep(0.3, 0.9, abs(n.y)));
  /** Whatever faces the weather has silvered; the undersides and the faces of the planks have kept their colour. */
  alb = mix(alb, alb * 1.1 + vec3(0.05, 0.048, 0.044), smoothstep(0.35, 0.95, n.y) * 0.55);

  if (vWet > 0.5) {
    /** How high above the water the fragment is, with the sea breathing up and down the pile as it laps. */
    float lap = sin(uTime * 1.15 + vWorld.z * 0.8 + vWorld.x) * 0.035 + (vnoise(vec2(vWorld.x * 2.2 + uTime * 0.5, vWorld.z * 2.2)) - 0.5) * 0.07;
    float above = vWorld.y - lap;
    alb = mix(alb, vec3(0.115, 0.135, 0.075), (1.0 - smoothstep(0.02, 0.34, above)) * 0.85);
    alb *= mix(0.5, 1.0, smoothstep(-0.1, 0.22, above));
    /** The barnacled ring the tide leaves, patchy round the pile the way weed and shell grow. */
    float ring = exp(-pow((above - 0.04) / 0.05, 2.0)) * (0.5 + 0.5 * vnoise(vWorld.xz * 9.0 + vWorld.y * 3.0));
    alb = mix(alb, vec3(0.9, 0.88, 0.82), ring * 0.4);
  }

  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * mix(ndl, wrap, 0.3) * sun);
  /** Kept under the cottage windows: the light the child is walking toward is the one that should carry. */
  vec3 lamp = vec3(1.0, 0.62, 0.28) * (0.3 + 3.1 * uNight);
  col = mix(col, lamp, vGlow);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const SHADE_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/**
 * The jetty's own shadow on the sea. Traced the other way round: from each patch of water back up the sunbeam
 * to the height of the deck, and darkened if the deck is over it. A low sun throws it a long way off the piles,
 * which is what makes the thing look like it is standing in the water rather than laid on top of it.
 */
const SHADE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
void main() {
  /** The sea's mirror is drawn from under the surface, where a shadow laid on top of it has no business. */
  if (uMirrorPass > 0.5) discard;
  float up = max(uSunDir.y, 0.12);
  vec2 q = vWorld.xz + uSunDir.xz * (${glsl(DECK)} / up);
  float lz = q.y - ${glsl(MID_Z)};
  float wide = ${glsl(SHAFT_HALF)} + ${glsl(HEAD.half - SHAFT_HALF)} * smoothstep(${glsl(HEAD.from - 1)}, ${glsl(HEAD.from + 0.7)}, lz);
  /** The further the sun has to carry it, the softer its edge. */
  float pen = 0.16 + 0.1 * (${glsl(DECK)} / up);
  float cover = (1.0 - smoothstep(wide - pen, wide + pen, abs(q.x - ${glsl(HOME_JETTY.x)})))
    * smoothstep(${glsl(-HALF_LENGTH)} - pen, ${glsl(-HALF_LENGTH)} + pen, lz)
    * (1.0 - smoothstep(${glsl(HALF_LENGTH)} - pen, ${glsl(HALF_LENGTH)} + pen, lz));
  float shade = cover * 0.55 * smoothstep(0.0, 0.14, uSunDir.y) * cloudShadow(vWorld.xz) * (1.0 - fogOf(vWorld).a);
  if (shade < 0.004) discard;
  gl_FragColor = vec4(mix(vec3(1.0), vec3(0.42, 0.55, 0.68), shade), 1.0);
}`;

type Part = [THREE.BufferGeometry, THREE.Color, number, number];

function part(geo: THREE.BufferGeometry, color: THREE.Color, glow = 0, wet = 0): Part {
  return [geo, color, glow, wet];
}

function build(parts: Part[]): THREE.BufferGeometry {
  return mergeGeometries(
    parts.map(([g, c, glow, wet]) => {
      const geo = (g.index ? g.toNonIndexed() : g).clone();
      geo.deleteAttribute('uv');
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
      geo.setAttribute('aWet', new THREE.BufferAttribute(new Float32Array(n).fill(wet), 1));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      return geo;
    }),
  );
}

const WOOD = {
  plank: new THREE.Color('#8a8378'),
  worn: new THREE.Color('#6b6459'),
  frame: new THREE.Color('#5e5245'),
  tar: new THREE.Color('#4b4038'),
  white: new THREE.Color('#e3dac9'),
  red: new THREE.Color('#b5362c'),
  rope: new THREE.Color('#b6a382'),
  withy: new THREE.Color('#9c8150'),
  fresh: new THREE.Color('#a79579'),
  zinc: new THREE.Color('#61808a'),
  iron: new THREE.Color('#38312a'),
  glass: new THREE.Color('#ffcf85'),
};

/** A plank deck laid across the run, board by board, so no two boards sit at quite the same height. */
function planks(rand: () => number): Part[] {
  const out: Part[] = [];
  const count = Math.floor((HALF_LENGTH * 2 - 0.1) / PLANK.pitch);
  for (let i = 0; i <= count; i++) {
    const lz = -HALF_LENGTH + 0.08 + i * PLANK.pitch;
    const len = halfAt(lz) * 2 + (rand() - 0.5) * 0.06;
    const geo = new THREE.BoxGeometry(len, PLANK.thick, PLANK.width - 0.04 * rand());
    geo.rotateZ((rand() - 0.5) * 0.016);
    geo.rotateY((rand() - 0.5) * 0.01);
    geo.translate((rand() - 0.5) * 0.04, DECK - PLANK.thick / 2 + (rand() - 0.5) * 0.02, lz);
    /** Here and there a board has been taken up and put back in wood that has not had its weather yet. */
    out.push(part(geo, rand() < 0.07 ? WOOD.fresh : WOOD.plank.clone().lerp(WOOD.worn, rand() * 0.8)));
  }
  return out;
}

/** Piles driven in pairs, with a tie across each pair above the water and a stringer running the length on top. */
function frame(rand: () => number): Part[] {
  const out: Part[] = [];
  const top = DECK - PLANK.thick;
  for (let i = 0; i < BENTS; i++) {
    const lz = -HALF_LENGTH + 0.9 + (i * (HALF_LENGTH * 2 - 1.9)) / (BENTS - 1);
    const x = halfAt(lz) - 0.19;
    for (const side of [-1, 1]) {
      const wx = HOME_JETTY.x + side * x;
      const wz = MID_Z + lz;
      const foot = Math.min(heightAt(wx, wz), DECK - 0.5) - 0.3;
      const height = top - foot;
      const pile = new THREE.CylinderGeometry(0.115, 0.15, height, 8);
      pile.rotateY(rand() * 3);
      pile.translate(side * x + (rand() - 0.5) * 0.05, foot + height / 2, lz + (rand() - 0.5) * 0.05);
      out.push(part(pile, WOOD.tar, 0, 1));
    }
    /** A tie across each pair above the water, except inshore where it would only be buried in the sand. */
    if (heightAt(HOME_JETTY.x, MID_Z + lz) < 0.15) {
      const tie = new THREE.BoxGeometry(x * 2 + 0.24, 0.1, 0.1);
      tie.translate(0, 0.34 + (rand() - 0.5) * 0.04, lz);
      out.push(part(tie, WOOD.frame, 0, 1));
    }
  }
  for (const side of [-1, 1]) {
    const shaft = new THREE.BoxGeometry(0.15, 0.27, HALF_LENGTH * 2 - 0.6);
    shaft.translate(side * (SHAFT_HALF - 0.28), top - 0.135, 0);
    out.push(part(shaft, WOOD.frame, 0, 1));
    const head = new THREE.BoxGeometry(0.15, 0.25, END - HEAD_STRINGER);
    head.translate(side * (HEAD.half - 0.24), top - 0.125, (HEAD_STRINGER + END) / 2);
    out.push(part(head, WOOD.frame, 0, 1));
  }
  /** The rubbing board a hull comes to rest against, worn down to bare wood where boats have leaned on it. */
  out.push(part(new THREE.BoxGeometry(HEAD.half * 2 + 0.1, 0.24, 0.13).translate(0, 0.33, END + 0.06), WOOD.worn, 0, 1));
  return out;
}

/** A ring of rope laid flat, turn inside turn, the way a line is coiled down on a deck. */
function coil(x: number, z: number, turns: number, outer: number): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < turns; i++) {
    const r = outer - i * 0.095;
    const geo = new THREE.TorusGeometry(r, 0.035, 5, 14);
    geo.rotateX(Math.PI / 2);
    geo.translate(x, DECK + 0.036 + i * 0.012, z);
    out.push(part(geo, WOOD.rope));
  }
  return out;
}

/** A creel: a withy frame bent over a flat base, with the slats that keep the lobsters in. */
function creel(x: number, z: number, yaw: number): Part[] {
  const parts: Part[] = [part(new THREE.BoxGeometry(0.74, 0.07, 0.52).translate(0, 0.035, 0), WOOD.withy)];
  for (let i = 0; i < 4; i++) {
    const hoop = new THREE.TorusGeometry(0.26, 0.022, 4, 10, Math.PI);
    hoop.translate(0, 0.07, -0.19 + i * 0.127);
    parts.push(part(hoop, WOOD.withy));
  }
  for (const a of [0.4, Math.PI / 2, Math.PI - 0.4]) {
    const rod = new THREE.BoxGeometry(0.04, 0.04, 0.5);
    rod.translate(Math.cos(a) * 0.26, 0.07 + Math.sin(a) * 0.26, 0);
    parts.push(part(rod, WOOD.iron));
  }
  return parts.map(([geo, color]) => part(geo.rotateY(yaw).translate(x, DECK, z), color));
}

/** A galvanised bucket with a wire handle, standing where it was set down. */
function bucket(x: number, z: number): Part[] {
  const body = new THREE.CylinderGeometry(0.19, 0.155, 0.3, 10);
  const rim = new THREE.TorusGeometry(0.19, 0.018, 4, 12);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.15, 0);
  const handle = new THREE.TorusGeometry(0.19, 0.014, 4, 10, Math.PI);
  handle.rotateY(Math.PI / 2);
  handle.translate(0, 0.15, 0);
  return [part(body, WOOD.zinc), part(rim, WOOD.zinc), part(handle, WOOD.iron)].map(([g, c]) => {
    g.translate(x, DECK + 0.15, z);
    return part(g, c);
  });
}

/** The bollard the boat's line goes round: painted in the cottage's own white and red, and two turns still on it. */
function bollard(x: number, z: number): Part[] {
  const out: Part[] = [];
  const height = 0.72;
  out.push(part(new THREE.CylinderGeometry(0.145, 0.17, height, 10).translate(x, DECK + height / 2 - 0.05, z), WOOD.white));
  out.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 10).translate(x, DECK + height - 0.01, z), WOOD.red));
  for (const y of [0.3, 0.375]) {
    const turn = new THREE.TorusGeometry(0.175, 0.035, 5, 14);
    turn.rotateX(Math.PI / 2 + 0.06);
    turn.translate(x, DECK + y, z);
    out.push(part(turn, WOOD.rope));
  }
  return out;
}

/**
 * The lantern on the tall post. It is out at dawn, as it has been all the way up the bay; at night the same glass
 * takes the light the cottage windows take, so the last thing standing out in the water is lit.
 */
function lampPost(x: number, z: number): Part[] {
  const out: Part[] = [];
  const height = 2.05;
  out.push(part(new THREE.CylinderGeometry(0.1, 0.13, height, 8).translate(x, DECK + height / 2 - 0.06, z), WOOD.frame));
  const top = DECK + height - 0.06;
  out.push(part(new THREE.BoxGeometry(0.06, 0.06, 0.34).translate(x, top, z - 0.14), WOOD.iron));
  const hang = z - 0.28;
  out.push(part(new THREE.BoxGeometry(0.2, 0.26, 0.2).translate(x, top - 0.2, hang), WOOD.glass, 1));
  out.push(part(new THREE.BoxGeometry(0.24, 0.05, 0.24).translate(x, top - 0.05, hang), WOOD.iron));
  out.push(part(new THREE.BoxGeometry(0.22, 0.04, 0.22).translate(x, top - 0.35, hang), WOOD.iron));
  out.push(part(new THREE.ConeGeometry(0.19, 0.12, 4).rotateY(Math.PI / 4).translate(x, top + 0.05, hang), WOOD.iron));
  return out;
}

/** The plane the shadow is drawn on: the water the jetty stands in, out to as far as a low sun can throw it. */
function shadow(): THREE.Mesh {
  const reach = 7;
  const geo = new THREE.PlaneGeometry(HEAD.half * 2 + reach * 2, HALF_LENGTH * 2 + reach * 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(HOME_JETTY.x, 0.03, MID_Z);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: SHADE_VERT,
      fragmentShader: SHADE_FRAG,
      uniforms: { ...atmo.uniforms },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
    }),
  );
  mesh.renderOrder = 3;
  return mesh;
}

/** The whole jetty: all its timber merged into one mesh, with its shadow on the water under it. */
export function createJetty(): THREE.Object3D {
  const rand = mulberry32(4711);
  const geo = build([
    ...frame(rand),
    ...planks(rand),
    ...bollard(POST_X, POST_Z),
    ...lampPost(-POST_X, POST_Z),
    ...coil(POST_X, 11.4, 4, 0.38),
    ...bucket(-POST_X - 0.06, 11.4),
    ...creel(POST_X - 0.05, 9.7, 0.3),
  ]);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide }));
  mesh.position.set(HOME_JETTY.x, 0, MID_Z);
  const group = new THREE.Group();
  group.add(mesh, shadow());
  return group;
}
