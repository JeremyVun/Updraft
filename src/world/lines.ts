import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mulberry32, smoothstep } from './noise';
import { heightAt } from './island';
import { glsl, tuning } from '../tuning';

/** Washing hung out on a line: pegged along its top edge, swinging up and fluttering in the live wind. */
const CLOTH_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aAnchor;
in vec3 aAlong;
in vec4 aShape;
in vec3 aColor;
in float aKind;
in float aRole;
uniform vec2 uFamily;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out float vSwing;

/**
 * Not everything on a line is a bedsheet. The pegged edge is uv.y 1 and the hem is 0, so a silhouette is a
 * width profile down the drop and, for a pair of trousers, a hem that rides up in the middle into two legs.
 */
vec2 clothProfile(float kind, float up01, float x) {
  if (kind > 2.5) return vec2(0.92, 1.0 - max(0.0, 1.0 - abs(x) * 2.6) * 0.46);
  if (kind > 1.5) return vec2(mix(1.16, 0.7, up01), 1.0);
  if (kind > 0.5) return vec2(1.0 + 0.3 * smoothstep(0.5, 0.82, up01) * (1.0 - smoothstep(0.86, 1.0, up01)), 1.0);
  return vec2(1.0, 1.0);
}

/**
 * The three on the crest. For as long as a steady wind along their line holds them, they are people: the cloth
 * fills into a chest and shoulders, and once it has held a while the big ones' sleeves lift toward the small
 * one's and the small one's lift to theirs. When the wind drops they are washing again. uFamily.x is how far
 * they are filled and uFamily.y how far the hands have reached; aRole is 0 for the father, 1 for the mother, 2
 * for the child, and below zero for every ordinary piece on the hill.
 */
void family(vec3 along, vec3 side, vec3 up, float hang) {
  float fill = uFamily.x;
  float chest = sin(uv.x * 3.14159) * (1.0 - smoothstep(0.1, 0.75, hang)) * smoothstep(0.0, 0.12, hang);
  vWorld += side * chest * fill * ${glsl(tuning.family.chest)} * aShape.x;
  float shoulder = smoothstep(0.84, 1.0, uv.y) * smoothstep(0.25, 0.5, abs(position.x));
  vWorld += along * sign(position.x) * shoulder * fill * ${glsl(tuning.family.shoulders)} * aShape.x;
  float band = smoothstep(0.42, 0.58, uv.y) * (1.0 - smoothstep(0.84, 0.96, uv.y));
  float arm = smoothstep(0.26, 0.5, abs(position.x)) * band;
  float toward = aRole < 0.5 ? 1.0 : (aRole < 1.5 ? -1.0 : 0.0);
  float lifts = aRole > 1.5 ? 1.0 : step(0.0, position.x * toward);
  float hands = uFamily.y * arm * lifts;
  vWorld += (up * ${glsl(tuning.family.reachUp)} + along * sign(position.x) * ${glsl(tuning.family.reachOut)}) * hands * aShape.x;
}

void main() {
  vUv = uv;
  vec2 cut = clothProfile(aKind, uv.y, position.x);
  float hang = (1.0 - uv.y) * cut.y;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 along = normalize(aAlong);
  vec3 side = normalize(cross(up, along));

  vec3 pegged = aAnchor + along * (position.x * aShape.x * cut.x);
  /**
   * Dropped only once it is far enough out to sea to be long gone in the veil. It used to be culled against the
   * veil itself, which moves while a chapter settles, so whole bands of washing blinked in and out of the frame.
   */
  if (distance(aAnchor, cameraPosition) > 430.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vWorld = pegged;
    vNormal = up;
    vColor = aColor;
    vSwing = 0.0;
    return;
  }
  /**
   * It swings on the wind a hanging thing feels, not on the raw air: a gust reaches it when the gust arrives, it
   * takes it late, overshoots and swings back. The hem takes it later than the pegs, so a gust runs down the cloth.
   */
  vec4 sway = swayAt(pegged.xz);
  float room = length(sway.xy) * 0.6 + 0.5;
  vec2 w = sway.xy - clamp(sway.zw * (${glsl(tuning.washing.hemLag)} * hang), -room, room);
  float speed = length(w);
  /**
   * Which side it swings to follows the wind across the line smoothly. Taken as a bare sign, neighbouring
   * columns of one sheet chose opposite sides whenever the wind ran along the line, and the fold between them
   * showed as a thin seam of sky down the cloth.
   */
  float across = dot(vec3(w.x, 0.0, w.y), side);
  float lean = across / sqrt(across * across + 0.12 * speed * speed + 0.04);

  /** Still wind hangs it straight down; a full gust lifts it toward horizontal. */
  float swing = clamp(speed / ${glsl(tuning.washing.fullSwingSpeed)}, 0.0, 1.0);
  /** The harder it blows the more it shakes: a slow breathing in a breeze, a shiver running down it in a gust. */
  float flutter = smoothstep(${glsl(tuning.washing.flutterFrom)}, ${glsl(tuning.washing.flutterFull)}, speed);
  float run = clamp(dot(vec3(w.x, 0.0, w.y), along) * 0.3, -1.0, 1.0);
  float phase = uTime * (3.2 + aShape.z + 7.0 * flutter) + position.x * 6.5 * run - hang * (4.0 + 5.0 * flutter) + aShape.w;
  float ripple = sin(phase) + 0.45 * flutter * sin(phase * 2.3 + hang * 9.0);
  float shake = mix(${glsl(tuning.washing.rippleQuiet)}, ${glsl(tuning.washing.rippleFull)}, flutter);
  swing = clamp(swing + ripple * shake * (0.3 + swing), 0.0, 1.05);

  /**
   * The cloth fills rather than hinging: pegged along its top it hangs nearly straight under the pegs and bellies
   * out down its drop, so the drop is an arc from the line and not a fan of straight rays out of it. The angle
   * grows down the cloth and the position is the integral of that, which for a linear angle is a circular arc.
   */
  float full = swing * 1.5708 * lean;
  float base = ${glsl(tuning.washing.belly)};
  float theta0 = full * base;
  float k = full * (1.0 - base);
  float theta1 = theta0 + k * hang;
  float dropDown;
  float dropSide;
  if (abs(k) > 1e-3) {
    dropDown = (sin(theta1) - sin(theta0)) / k;
    dropSide = (cos(theta0) - cos(theta1)) / k;
  } else {
    dropDown = cos(theta0) * hang;
    dropSide = sin(theta0) * hang;
  }
  vec3 down = -up * cos(theta1) + side * sin(theta1);
  vWorld = pegged - up * (dropDown * aShape.y) + side * (dropSide * aShape.y);
  vWorld += side * lean * ripple * shake * 1.2 * aShape.y * hang;

  vNormal = normalize(cross(down, along));
  if (aRole > -0.5) family(along, side, up, hang);
  vColor = aColor;
  vSwing = swing;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const CLOTH_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec4 uSubject;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in float vSwing;

/** Interleaved gradient noise: a dither pattern that holds still on screen instead of crawling. */
float clothDither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  /**
   * Washing standing between the camera and the child dissolves out of the way. On a hill strung with two
   * hundred lines they would otherwise lose sight of who they are playing, which is the one thing this game
   * must never let happen.
   */
  if (uSubject.w > 0.5) {
    vec3 toSubject = uSubject.xyz - cameraPosition;
    float reach = length(toSubject);
    vec3 dir = toSubject / max(reach, 0.001);
    vec3 toHere = vWorld - cameraPosition;
    float along = dot(toHere, dir);
    if (along > 0.4 && along < reach - 1.0) {
      float side = length(toHere - dir * along);
      float hide = 1.0 - smoothstep(1.1, 3.2, side);
      if (hide > 0.02 && clothDither(gl_FragCoord.xy) < hide) discard;
    }
  }
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (!gl_FrontFacing) N = -N;
  float ndl = dot(N, uSunDir);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);

  vec3 cloth = vColor;
  float weave = sin(vUv.x * 240.0) * sin(vUv.y * 190.0) * 0.03;
  cloth *= 1.0 + weave;
  float hem = smoothstep(0.0, 0.02, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  cloth *= 0.86 + hem * 0.14;

  /** Cloth is thin: the sun comes through the back of a sheet as much as it bounces off the front. */
  float through = max(-ndl, 0.0) * 0.55 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.3;
  vec3 col = cloth * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.55 + through * 0.7) * sun);
  col += cloth * cloth * uSunColor * through * 0.4 * sun;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const WOOD_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WOOD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  vec3 wood = vec3(0.42, 0.33, 0.25) * (0.85 + vnoise(vWorld.xz * 8.0 + vWorld.y * 3.0) * 0.3);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = wood * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.8 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Washed-out linen, not bunting. Mostly whites and creams gone grey with use, with a few faded colours among
 * them; anything saturated reads as flags at a festival rather than somebody's laundry.
 */
const CLOTH_COLOURS = [
  new THREE.Color('#f4efe4'),
  new THREE.Color('#ece6d8'),
  new THREE.Color('#e2dccd'),
  new THREE.Color('#f7f3ea'),
  new THREE.Color('#d9d2c4'),
  new THREE.Color('#efe9dc'),
  new THREE.Color('#e6e0d2'),
  new THREE.Color('#f2ece0'),
  new THREE.Color('#ded7c8'),
  new THREE.Color('#c08a7e'),
  new THREE.Color('#d8bb84'),
  new THREE.Color('#9fb0bd'),
  new THREE.Color('#a9b79a'),
  new THREE.Color('#e0bdb6'),
];

export interface LineSpec {
  /** The two pole tops the line runs between. */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** How far the middle of the line dips below a straight run. */
  sag: number;
  /** How long the pieces on it hang, when the line is strung somewhere they have to hang clear of. */
  drop?: number;
}

/** A point on the catenary between the two ends, t from 0 to 1. */
function onLine(spec: LineSpec, t: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(spec.a, spec.b, t);
  out.y -= Math.sin(t * Math.PI) * spec.sag;
  return out;
}

function poleGeometry(foot: THREE.Vector3, top: number): THREE.BufferGeometry {
  const height = top - foot.y;
  return new THREE.CylinderGeometry(0.05, 0.075, height, 6).translate(foot.x, foot.y + height / 2, foot.z);
}

/** A peg over the line at a piece's corner. */
function pegGeometry(on: THREE.Vector3, along: THREE.Vector3, offset: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(0.035, 0.1, 0.05).translate(
    on.x + along.x * offset,
    on.y + along.y * offset + 0.015,
    on.z + along.z * offset,
  );
}

/** A forked pole shoved under a sagging line to hold it up. */
function propGeometry(under: THREE.Vector3, foot: number, r: number): THREE.BufferGeometry {
  const height = under.y - foot;
  const lean = 0.12 + r * 0.16;
  const g = new THREE.CylinderGeometry(0.035, 0.055, height, 5);
  g.rotateZ(lean);
  return g.translate(under.x - Math.sin(lean) * height * 0.5, foot + height / 2, under.z + (r - 0.5) * 0.3);
}

function ropeGeometry(spec: LineSpec): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= 10; i++) points.push(onLine(spec, i / 10, p).clone());
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.022, 4, false);
}

/**
 * A line strung between two poles standing in open water, miles from any island, with somebody's washing on it.
 * It is the same nonsense as the door: the dream repeating a piece of home where there is nothing to hang it on.
 * They are placed on the crossings, where the player has nothing to do but look at the sea.
 */
export function seaLines(): LineSpec[] {
  const rand = mulberry32(404);
  const at: [number, number, number][] = [
    [128, -118, 0.9],
    [-298, -1962, 2.3],
  ];
  return at.map(([x, z, yaw]) => {
    const run = 7.5 + rand() * 3;
    const top = 3.6 + rand() * 0.8;
    return {
      a: new THREE.Vector3(x - Math.sin(yaw) * run * 0.5, top, z - Math.cos(yaw) * run * 0.5),
      b: new THREE.Vector3(x + Math.sin(yaw) * run * 0.5, top * (0.9 + rand() * 0.2), z + Math.cos(yaw) * run * 0.5),
      sag: 0.3 + rand() * 0.25,
    };
  });
}

const PAINT_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uPaint;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 paint = uPaint * (0.92 + vnoise(vWorld.xz * 6.0 + vWorld.y * 9.0) * 0.16);
  vec3 col = paint * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.75 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** A shared material for the painted and woven things that are not cloth, rope or pole. */
function painted(colour: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uPaint: { value: new THREE.Color(colour) } },
    vertexShader: WOOD_VERT,
    fragmentShader: PAINT_FRAG,
  });
}

/**
 * Washing baskets left on the sand where the boat comes in — one on its side, the rest waiting. Nothing is in
 * them and nobody comes back for them. They are on the beach and not up in the grass because everything smaller
 * than a child drowns in that grass, and the first thing this island has to say is that somebody was here.
 */
export function baskets(x: number, z: number): THREE.Mesh {
  const rand = mulberry32(57);
  const parts: THREE.BufferGeometry[] = [];
  const at: [number, number, number][] = [
    [0, 0, 0],
    [2.6, -1.4, 1.1],
    [-3.1, 1.2, 2.4],
  ];
  at.forEach(([dx, dz, spin], i) => {
    const r = 0.5 + rand() * 0.12;
    const h = 0.42 + rand() * 0.1;
    const wall = new THREE.CylinderGeometry(r, r * 0.78, h, 11, 1, true);
    const base = new THREE.CircleGeometry(r * 0.78, 11).rotateX(-Math.PI / 2).translate(0, -h / 2, 0);
    const rim = new THREE.TorusGeometry(r, 0.035, 5, 12).rotateX(Math.PI / 2).translate(0, h / 2, 0);
    const basket = mergeGeometries([wall, base, rim]);
    /** One of them has been knocked over and nobody has stood it up again. */
    if (i === 1) basket.rotateX(Math.PI * 0.46);
    basket.rotateY(spin);
    const foot = Math.max(heightAt(x + dx, z + dz), 0);
    parts.push(basket.translate(x + dx, foot + (i === 1 ? r * 0.58 : h / 2), z + dz));
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), painted('#b89a5e'));
  mesh.material.side = THREE.DoubleSide;
  return mesh;
}

/**
 * A door standing in the grass with nothing behind it and nothing on the other side of it. Nobody remarks on it
 * and nothing happens if you walk round it; it is only the dream handing over another piece of home, and it
 * gives the top of the hill something to be the top of. It is shut until the three on the line beside it have
 * been held up as people long enough, and then it swings open on the far beach and the boat.
 */
export class RedDoor {
  readonly group = new THREE.Group();
  /** How far it is asked to stand open, 0 to 1; it swings there on its own hinge speed. */
  open = 0;
  private swung = 0;
  private readonly panel = new THREE.Group();

  constructor(x: number, z: number, yaw: number) {
    const foot = Math.max(heightAt(x, z), 0);
    const frame = (w: number, h: number, dy: number, dx: number) =>
      new THREE.BoxGeometry(w, h, 0.22).translate(dx, dy + h / 2, 0);
    const jambs = mergeGeometries([frame(0.17, 3.05, 0, -0.66), frame(0.17, 3.05, 0, 0.66), frame(1.49, 0.2, 3.05, 0)]);
    /** Hinged on one jamb: the panel and its knob swing together about the edge that stays put. */
    const panel = new THREE.BoxGeometry(1.15, 2.9, 0.1).translate(0.575, 1.47, 0.02);
    const paint = painted;
    /** The same white and the same red as the cottage at the end of the journey. Nobody is told that either. */
    this.group.add(new THREE.Mesh(jambs, paint('#ebe4d4')));
    this.panel.add(new THREE.Mesh(panel, paint('#b5362c')));
    const knob = new THREE.SphereGeometry(0.06, 8, 6).translate(0.975, 1.5, 0.08);
    this.panel.add(new THREE.Mesh(knob, paint('#b99a52')));
    this.panel.position.x = -0.575;
    this.group.add(this.panel);
    this.group.position.set(x, foot - 0.1, z);
    this.group.rotation.y = yaw;
  }

  get opened(): boolean {
    return this.open > 0.5;
  }

  update(dt: number): void {
    this.swung += (this.open - this.swung) * (1 - Math.exp(-dt * 1.4));
    this.panel.rotation.y = this.swung * 1.8;
  }
}

/** The door on the crest of the island of lines, and the line beside it with the three of them on it. */
export const door = new RedDoor(23, -357, 0.32);

/**
 * Strung high across the way just short of the door, so the child walks in under it: a man's shirt, a small
 * jumper in the child's own yellow, and a woman's blouse. Hanging, they are washing; see `family` in the shader.
 */
export const FAMILY_LINE: LineSpec = (() => {
  const a = new THREE.Vector3(23.2, 0, -350.6);
  const b = new THREE.Vector3(32.6, 0, -356.4);
  a.y = Math.max(heightAt(a.x, a.z), 0) + 5.9;
  b.y = Math.max(heightAt(b.x, b.z), 0) + 5.7;
  return { a, b, sag: 0.3, drop: 2.4 };
})();
/** Which side of the line the walk's camera should stand to see the three of them square on. */
export const FAMILY_FACE = new THREE.Vector3(0.53, 0, 0.85).normalize();
/** How far the wind has made them people (x) and how far their hands have reached (y): the story writes it. */
export const family = new THREE.Vector2(0, 0);
const FAMILY_PIECES = [
  { at: 0.2, width: 2.1, drop: 2.4, colour: '#9fb0bd', role: 0 },
  { at: 0.5, width: 1.05, drop: 1.25, colour: '#e6c25a', role: 2 },
  { at: 0.8, width: 1.85, drop: 2.5, colour: '#e0bdb6', role: 1 },
];

/**
 * Lines of washing hung out with nobody there: the first piece of home the dream hands over. Poles and rope are
 * ordinary geometry; every sheet is one instance of a quad that reads the wind field in its vertex shader, so a
 * single gust fills a hundred of them at once.
 */
export class WashingLines {
  readonly group = new THREE.Group();
  /** Who must stay in sight: x, y, z and 1 while it applies. The washing in front of them gives way. */
  readonly subject = new THREE.Vector4();
  private readonly clothMat: THREE.ShaderMaterial;

  constructor(specs: readonly LineSpec[], seed = 91, familyLine: LineSpec | null = null) {
    const rand = mulberry32(seed);
    const woodMat = new THREE.ShaderMaterial({
      uniforms: atmo.uniforms,
      vertexShader: WOOD_VERT,
      fragmentShader: WOOD_FRAG,
    });
    this.clothMat = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uSubject: { value: this.subject }, uFamily: { value: family } },
      vertexShader: CLOTH_VERT,
      fragmentShader: CLOTH_FRAG,
      side: THREE.DoubleSide,
    });

    const posts: THREE.BufferGeometry[] = [];
    const ropes: THREE.BufferGeometry[] = [];
    const anchors: number[] = [];
    const alongs: number[] = [];
    const shapes: number[] = [];
    const colors: number[] = [];
    const kinds: number[] = [];
    const roles: number[] = [];

    const point = new THREE.Vector3();
    const next = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const seen = new Set<string>();

    for (const spec of specs) {
      for (const end of [spec.a, spec.b]) {
        const key = `${end.x.toFixed(1)},${end.z.toFixed(1)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        posts.push(poleGeometry(new THREE.Vector3(end.x, Math.max(heightAt(end.x, end.z), 0), end.z), end.y));
      }
      ropes.push(ropeGeometry(spec));
      /** Every eighth line sags enough that somebody has put a prop under it, the way they always do. */
      if (rand() < 0.13) {
        onLine(spec, 0.35 + rand() * 0.3, point);
        const foot = Math.max(heightAt(point.x, point.z), 0);
        posts.push(propGeometry(point, foot, rand()));
      }

      const span = spec.a.distanceTo(spec.b);
      let t = 0.05 + rand() * 0.06;
      while (t < 0.94) {
        /** Mostly sheets, wide and long; a third of the pieces are small things pegged up between them. */
        const high = spec.drop !== undefined;
        const small = !high && rand() < 0.3;
        /** On the lines over the walk the pieces are wide: a row of little ones up there reads as bunting. */
        const width = high ? 1.7 + rand() * 1.6 : small ? 0.5 + rand() * 0.6 : 1.8 + rand() * 1.8;
        const drop = high ? spec.drop! * (0.85 + rand() * 0.3) : small ? 0.5 + rand() * 0.55 : 1.4 + rand() * 1.3;
        const step = (width + 0.35 + rand() * 0.9) / span;
        if (t + step > 0.96) break;
        onLine(spec, t, point);
        onLine(spec, t + step, next);
        dir.subVectors(next, point).normalize();
        onLine(spec, t + step * 0.5, point);
        anchors.push(point.x, point.y, point.z);
        alongs.push(dir.x, dir.y, dir.z);
        shapes.push(width, drop, rand() * 3, rand() * 6.28);
        /** Two pegs at the corners of every piece: the detail that says washing rather than flags, up close. */
        posts.push(pegGeometry(point, dir, width * 0.46), pegGeometry(point, dir, -width * 0.46));
        const c = CLOTH_COLOURS[Math.floor(rand() * CLOTH_COLOURS.length)];
        colors.push(c.r, c.g, c.b);
        /** Mostly sheets, and then a shirt, a nightgown or a pair of trousers among them, the way a line is. */
        const roll = rand();
        kinds.push(small ? (roll < 0.5 ? 1 : 0) : roll < 0.16 ? 1 : roll < 0.3 ? 2 : roll < 0.4 ? 3 : 0);
        roles.push(-1);
        t += step;
      }
    }

    if (familyLine) {
      for (const end of [familyLine.a, familyLine.b]) {
        posts.push(poleGeometry(new THREE.Vector3(end.x, Math.max(heightAt(end.x, end.z), 0), end.z), end.y));
      }
      ropes.push(ropeGeometry(familyLine));
      for (const piece of FAMILY_PIECES) {
        onLine(familyLine, piece.at - 0.02, point);
        onLine(familyLine, piece.at + 0.02, next);
        dir.subVectors(next, point).normalize();
        onLine(familyLine, piece.at, point);
        anchors.push(point.x, point.y, point.z);
        alongs.push(dir.x, dir.y, dir.z);
        shapes.push(piece.width, piece.drop, rand() * 3, rand() * 6.28);
        posts.push(pegGeometry(point, dir, piece.width * 0.46), pegGeometry(point, dir, -piece.width * 0.46));
        const c = new THREE.Color(piece.colour);
        colors.push(c.r, c.g, c.b);
        kinds.push(1);
        roles.push(piece.role);
      }
    }

    const sheet = new THREE.PlaneGeometry(1, 1, 5, 7).translate(0, 0.5, 0);
    const cloth = new THREE.InstancedBufferGeometry();
    cloth.index = sheet.index;
    cloth.attributes.position = sheet.attributes.position;
    cloth.attributes.uv = sheet.attributes.uv;
    cloth.instanceCount = shapes.length / 4;
    cloth.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(new Float32Array(anchors), 3));
    cloth.setAttribute('aAlong', new THREE.InstancedBufferAttribute(new Float32Array(alongs), 3));
    cloth.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shapes), 4));
    cloth.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));
    cloth.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(kinds), 1));
    cloth.setAttribute('aRole', new THREE.InstancedBufferAttribute(new Float32Array(roles), 1));
    cloth.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.group.add(new THREE.Mesh(mergeGeometries(posts), woodMat));
    this.group.add(new THREE.Mesh(mergeGeometries(ropes), woodMat));
    this.group.add(new THREE.Mesh(cloth, this.clothMat));
    this.count = cloth.instanceCount;
  }

  readonly count: number;
}

/** Where a point sits against the walk: how far off it is, how far along it, and which way the walk runs there. */
interface Along {
  side: number;
  t: number;
  dir: THREE.Vector2;
}

const alongSeg = new THREE.Vector2();
const alongRel = new THREE.Vector2();

function against(x: number, z: number, path: readonly THREE.Vector2[], out: Along): Along {
  out.side = Infinity;
  out.t = 0;
  let walked = 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    alongSeg.subVectors(b, a);
    const len = alongSeg.length() || 1;
    alongRel.set(x - a.x, z - a.y);
    const along = THREE.MathUtils.clamp(alongRel.dot(alongSeg) / (len * len), 0, 1);
    const dx = x - (a.x + alongSeg.x * along);
    const dz = z - (a.y + alongSeg.y * along);
    const d = Math.hypot(dx, dz);
    if (d < out.side) {
      out.side = d;
      out.t = total > 0 ? (walked + along * len) / total : 0;
      out.dir.copy(alongSeg).divideScalar(len);
    }
    walked += len;
  }
  return out;
}

/**
 * Two lines hung side by side in nearly the same plane put one sheet through the other, and the one behind shows
 * as a moving seam down the one in front. Lines may cross as steeply as they like; they may not run together.
 */
const CROWDED_WITHIN = 1.4;
const CROWDED_ANGLE = THREE.MathUtils.degToRad(25);

function cross2(ax: number, az: number, bx: number, bz: number): number {
  return ax * bz - az * bx;
}

function pointToRun(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const ex = bx - ax;
  const ez = bz - az;
  const t = THREE.MathUtils.clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez || 1), 0, 1);
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}

/** Whether a line from a to b would run alongside one already hung, seen from above. */
function crowds(ax: number, az: number, bx: number, bz: number, hung: readonly LineSpec[]): boolean {
  for (const { a: c, b: d } of hung) {
    const between = Math.abs(Math.atan2(cross2(bx - ax, bz - az, d.x - c.x, d.z - c.z), (bx - ax) * (d.x - c.x) + (bz - az) * (d.z - c.z)));
    if (Math.min(between, Math.PI - between) > CROWDED_ANGLE) continue;
    const straddles =
      cross2(bx - ax, bz - az, c.x - ax, c.z - az) * cross2(bx - ax, bz - az, d.x - ax, d.z - az) < 0 &&
      cross2(d.x - c.x, d.z - c.z, ax - c.x, az - c.z) * cross2(d.x - c.x, d.z - c.z, bx - c.x, bz - c.z) < 0;
    if (straddles) return true;
    const gap = Math.min(
      pointToRun(ax, az, c.x, c.z, d.x, d.z),
      pointToRun(bx, bz, c.x, c.z, d.x, d.z),
      pointToRun(c.x, c.z, ax, az, bx, bz),
      pointToRun(d.x, d.z, ax, az, bx, bz),
    );
    if (gap < CROWDED_WITHIN) return true;
  }
  return false;
}

/**
 * A hillside of washing with a way through it. Lines are hung everywhere except along the walk, so the open
 * ground is always the way on and the view to either side is cloth — a funnel nobody has to be told about. The
 * lines nearest the walk run with it, the way washing is hung along a path, and further out they lie across the
 * prevailing wind like any other line. The alley wanders, opens out at the crest where the far shore comes into
 * view, and the washing thins at both beaches so the landing and the boat waiting on the far side read clearly.
 */
export function lineField(
  centre: THREE.Vector2,
  count: number,
  spread = 24,
  seed = 17,
  path: readonly THREE.Vector2[] = [],
  hung: readonly LineSpec[] = [],
): LineSpec[] {
  const rand = mulberry32(seed);
  /** Lines strung by hand first, so the field keeps clear of them; they are not returned, only respected. */
  const specs: LineSpec[] = [...hung];
  const at: Along = { side: Infinity, t: 0, dir: new THREE.Vector2() };
  const ends = path.length ? [path[0], path[path.length - 1]] : [];
  /**
   * The walk itself is hung across first, pole to pole over the top of it, high enough to pass under. The
   * alley keeps the ground open so the way on is obvious; these keep the sky closed so it is still somebody's
   * washing the child is lost in, and a gust coming through lifts the whole passage at once.
   */
  if (path.length > 1) {
    const on = new THREE.Vector2();
    for (let t = 0.05; t < 0.95; t += 0.05 + rand() * 0.035) {
      pointAt(path, t, on, at.dir);
      const across = Math.atan2(at.dir.y, -at.dir.x) + (rand() - 0.5) * 0.5;
      const half = 8 + rand() * 3;
      const shift = (rand() - 0.5) * 5;
      const ax = on.x + Math.sin(across) * (-half + shift);
      const az = on.y + Math.cos(across) * (-half + shift);
      const bx = on.x + Math.sin(across) * (half + shift);
      const bz = on.y + Math.cos(across) * (half + shift);
      if (heightAt(ax, az) < 1.6 || heightAt(bx, bz) < 1.6) continue;
      if (crowds(ax, az, bx, bz, specs)) continue;
      const top = 6 + rand() * 0.9;
      specs.push({
        a: new THREE.Vector3(ax, Math.max(heightAt(ax, az), 0) + top, az),
        b: new THREE.Vector3(bx, Math.max(heightAt(bx, bz), 0) + top * (0.92 + rand() * 0.16), bz),
        sag: 0.3 + rand() * 0.4,
        /** Short drops: the hems have to clear a child's head, and the camera's, by a good margin. */
        drop: 1.1 + rand() * 0.7,
      });
    }
  }
  const field = specs.length + count;
  for (let i = 0; i < count * 40 && specs.length < field; i++) {
    const angle = rand() * Math.PI * 2;
    const reach = spread * Math.sqrt(rand());
    const x = centre.x + Math.cos(angle) * reach;
    const z = centre.y + Math.sin(angle) * reach * 0.8;
    if (heightAt(x, z) < 2.5) continue;

    /** Lines run roughly across the prevailing wind, the way you would hang washing to dry. */
    let bearing = 1.1 + (rand() - 0.5) * 1.1;
    if (path.length) {
      against(x, z, path, at);
      /** The alley breathes between four and eight paces wide, and opens out at the top of the hill. */
      const alley = 4.2 + Math.sin(at.t * 11 + 1.3) * 1.6 + 3.4 * Math.exp(-(((at.t - 0.5) * 5) ** 2));
      if (at.side < alley) continue;
      /** Its edge is ragged, not a wall: the odds of a line rise with the ground it is standing back from. */
      if (rand() > 0.3 + 0.7 * smoothstep(alley, alley + 13, at.side)) continue;
      if (at.side < 17) bearing = Math.atan2(at.dir.x, at.dir.y) + (rand() - 0.5) * 0.7;
      /** Both beaches are left bare, so arriving and leaving are the two clearest sights on the island. */
      if (ends.some((e) => Math.hypot(x - e.x, z - e.y) < 15)) continue;
    }

    const run = 9 + rand() * 11;
    const ax = x - Math.sin(bearing) * run * 0.5;
    const az = z - Math.cos(bearing) * run * 0.5;
    const bx = x + Math.sin(bearing) * run * 0.5;
    const bz = z + Math.cos(bearing) * run * 0.5;
    /** Hung high, and at every height: the hems clear the grass and the child walks in under the sheets. */
    const top = 4.2 + rand() * 1.7;
    if (heightAt(ax, az) < 1.6 || heightAt(bx, bz) < 1.6) continue;
    if (path.length && Math.min(against(ax, az, path, at).side, against(bx, bz, path, at).side) < 4) continue;
    if (crowds(ax, az, bx, bz, specs)) continue;
    specs.push({
      a: new THREE.Vector3(ax, Math.max(heightAt(ax, az), 0) + top, az),
      b: new THREE.Vector3(bx, Math.max(heightAt(bx, bz), 0) + top * (0.85 + rand() * 0.3), bz),
      sag: 0.18 + rand() * 0.3,
    });
  }

  return specs.slice(hung.length);
}

/** The point a fraction `t` of the way along the path, and the direction it runs there. */
function pointAt(path: readonly THREE.Vector2[], t: number, out: THREE.Vector2, dir: THREE.Vector2): void {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
  let want = t * total;
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].distanceTo(path[i - 1]) || 1;
    if (want <= seg || i === path.length - 1) {
      const k = THREE.MathUtils.clamp(want / seg, 0, 1);
      out.lerpVectors(path[i - 1], path[i], k);
      dir.subVectors(path[i], path[i - 1]).divideScalar(seg);
      return;
    }
    want -= seg;
  }
}
