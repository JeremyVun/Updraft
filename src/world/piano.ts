import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PianoStrings } from '../audio/audio';
import type { AudioOut } from '../creatures/voices';
import { MEADOW_STEPS, type MeadowAnswer } from '../audio/meadow-duet';
import { meadowMusic } from '../audio/meadow-music';
import { KeyLine } from '../fx/keyline';
import { NoteTraces } from '../fx/notetraces';
import { PianoWave } from '../fx/piano-wave';
import type { LifeField } from './life';
import { glsl, tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { mulberry32 } from './noise';
import type { PointerInput } from '../input/pointer';
import { PianoStroke } from './piano-stroke';

/**
 * An upright piano standing in the meadow grass with nobody at it. It is another piece of home the dream has left in
 * the wrong place. It sounds only in the duet: her answers to the bough, which the player's wind starts along the
 * guide, and the cygnet's steps on its keys under the finale.
 */

/**
 * The near knoll beyond the landing bank, in the sleeping island's one patch of colour.
 */
export const PLACE = { x: tuning.piano.place[0], z: tuning.piano.place[1] };
/** How far the colour round it reaches while the island is still grey, and how soft that edge is. */
export const PATCH = { radius: tuning.piano.initialRadius, soft: tuning.piano.initialSoft };
/** Turned toward the camera, which looks north from a little east of south, so the keys face the walk. */
const YAW = -0.12;

const WIDTH = 1.85;
const DEPTH = 0.72;
const TOP = 1.6;
/** The keybed the keys lie on. */
const KEY_Y = 0.8;
/** Where a key is hinged, back under the case, and how far it reaches out from there. */
const KEY_BACK = 0.3;
const KEY_LEN = 0.46;
/** The stool, far enough back that a child sits at the keyboard with their knees under it, not on top of it. */
const STOOL_Z = 1.5;
const STOOL_TOP = 0.5;
/**
 * Where the child's own origin goes for them to be sitting on the stool rather than hovering over it: their pose
 * drops half a unit when they sit, and the rest of the difference is the height of a child's hip. By eye.
 */
const SEAT_LIFT = -0.1;
/**
 * How big it is. It was built to an upright's own measurements and came out a toy beside the child, who then sat
 * over the keyboard instead of at it. Everything else in here is in the piano's own units and scales with this.
 */
const SCALE = 1.42;

/** The keyboard runs from C3 to C7. A key's index is its midi note less this. */
const LOW_MIDI = 48;
const KEY_COUNT = 49;
const WHITE_TONES = [0, 2, 4, 5, 7, 9, 11];

const KEYS_VERT = /* glsl */ `
in vec3 aTint;
in float aKey;
uniform float uDip[${KEY_COUNT}];
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
out float vGloss;
void main() {
  vec3 p = position;
  /** A key is a lever hinged at the back, so how far it drops is how far out along it you are. */
  float along = clamp((p.z - ${glsl(KEY_BACK)}) / ${glsl(KEY_LEN)}, 0.0, 1.0);
  p.y -= uDip[int(aKey)] * ${glsl(tuning.piano.dip)} * along;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = aTint;
  vGloss = 0.5;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CASE_VERT = /* glsl */ `
in vec3 aTint;
in float aGloss;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
out float vGloss;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = aTint;
  vGloss = aGloss;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PIANO_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uFoot;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
in float vGloss;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);

  float grain = vnoise(vec2(vWorld.x * 2.3 + vWorld.z * 2.3, vWorld.y * 34.0));
  vec3 albedo = vTint * (0.85 + 0.3 * grain);
  /** Whatever faces the sky has had a summer of it: the lid and the top have gone grey and chalky. Only what
      has colour in it to lose, though — ebony that came up chalky read as another piece of pale wood. */
  float chalk = smoothstep(0.015, 0.08, dot(albedo, vec3(0.33)));
  albedo = mix(albedo, albedo * 1.3 + vec3(0.035, 0.032, 0.026) * chalk, smoothstep(0.25, 0.9, N.y) * 0.28);
  /** And whatever is down in the grass has gone green and damp at the foot. */
  albedo = mix(albedo, mix(albedo, vec3(0.1, 0.13, 0.06), 0.5), 1.0 - smoothstep(0.0, 0.45, vWorld.y - uFoot));
  albedo *= 0.78 + 0.22 * abs(N.y);

  vec3 H = halfVector(uSunDir, V);
  float spec = pow(max(dot(N, H), 0.0), 34.0) * vGloss;
  /** It stands with its back to a low sun like everything else here, so its edge is where the light is. */
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6) * max(dot(-V, uSunDir), 0.0);
  /** And the face turned away from the sun is not black: bare wood in a field takes the light off the grass. */
  float wrap = pow(clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 1.7);
  vec3 col = albedo * (hemiLight(N) * 1.12 + uGroundBounce * 0.75) + (albedo * uSunColor * wrap * 0.9 + uSunColor * (spec + rim * 0.85)) * sun;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface Key {
  midi: number;
  /** Where the key sits along the keyboard, in world units either side of the middle. */
  x: number;
  black: boolean;
}

function keyboard(): Key[] {
  const keys: Key[] = [];
  let whites = 0;
  for (let i = 0; i < KEY_COUNT; i++) {
    const midi = LOW_MIDI + i;
    if (WHITE_TONES.includes(midi % 12)) keys.push({ midi, x: whites++ + 0.5, black: false });
    else keys.push({ midi, x: whites, black: true });
  }
  const span = WIDTH - 0.12;
  const pitch = span / whites;
  for (const k of keys) k.x = k.x * pitch - span / 2;
  return keys;
}

const KEYBOARD = keyboard();
const KEY_PITCH = (WIDTH - 0.12) / KEYBOARD.filter((k) => !k.black).length;

/** Gives a part its colour, and either its sheen (the case) or which key it is (the keyboard). */
function tinted(geo: THREE.BufferGeometry, colour: THREE.Color, name: 'aGloss' | 'aKey', value: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const tint = new Float32Array(n * 3);
  const rest = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    tint[i * 3] = colour.r;
    tint[i * 3 + 1] = colour.g;
    tint[i * 3 + 2] = colour.b;
    rest[i] = value;
  }
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  geo.setAttribute(name, new THREE.BufferAttribute(rest, 1));
  return geo;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** A summer of weather has taken it back to bare wood: warm, dry and bleached, never the varnish it once had. */
const WOOD = new THREE.Color('#a8865c');
const WOOD_DARK = new THREE.Color('#7f6544');
const WOOD_WORN = new THREE.Color('#c0a47c');
const BRASS = new THREE.Color('#a8872f');
const CAVITY = new THREE.Color('#120d0a');
const IVORY = new THREE.Color('#ece0be');
const EBONY = new THREE.Color('#1c1815');

/** The case, the stool and everything that is not a key: one mesh, tinted part by part. */
function caseGeometry(): THREE.BufferGeometry {
  const rand = mulberry32(713);
  const parts: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, colour: THREE.Color, gloss = 0.3) => parts.push(tinted(geo, colour, 'aGloss', gloss));
  const back = -DEPTH / 2;
  const front = KEY_BACK + 0.12;
  const keyFront = KEY_BACK + KEY_LEN;
  const keybed = KEY_Y - 0.07;
  /** Between the sides is exactly the keyboard's width, so the end keys run up against them. */
  const inner = WIDTH - 0.12;
  const well = TOP - 0.14;

  /** Each side is one board from the grass to the top, running on beside the keys as an arm with a leg under it. */
  for (const side of [-1, 1]) {
    const x = side * (WIDTH / 2 - 0.03);
    add(box(0.06, TOP, front - back, x, 0, (front + back) / 2), WOOD);
    add(box(0.06, 0.13, keyFront + 0.04 - front, x, KEY_Y, (front + keyFront + 0.04) / 2), WOOD);
    add(box(0.06, keybed, 0.06, x, 0, keyFront - 0.02), WOOD_DARK);
  }
  /** The back is one board between the sides, from the grass to the top. */
  const inside = back + 0.06;
  add(box(inner, TOP, 0.06, 0, 0, back + 0.03), WOOD);
  /** The lower panel, set back under the keys, and three pedals out of the toe board below it. */
  add(box(inner, 0.12, KEY_BACK + 0.04 - inside, 0, 0, (KEY_BACK + 0.04 + inside) / 2), WOOD_DARK);
  add(box(inner, keybed - 0.12, KEY_BACK - inside, 0, 0.12, (KEY_BACK + inside) / 2), WOOD_WORN);
  for (let i = -1; i <= 1; i++) add(box(0.05, 0.022, 0.2, i * 0.12, 0.06, KEY_BACK + 0.1), BRASS, 0.9);
  /** The keybed, inside the case and then out across the arms to the legs. */
  add(box(inner, 0.07, front - inside, 0, keybed, (front + inside) / 2), WOOD);
  add(box(WIDTH, 0.07, keyFront + 0.08 - front, 0, keybed, (front + keyFront + 0.08) / 2), WOOD);

  /** The top is open under the lid: a dark well with the tuning pins standing in it. */
  add(box(inner, well - KEY_Y, KEY_BACK - inside, 0, KEY_Y, (KEY_BACK + inside) / 2), WOOD);
  add(box(inner, 0.01, front - inside - 0.06, 0, well, (front - 0.06 + inside) / 2), CAVITY, 0);
  add(box(inner, TOP - 1.0, 0.06, 0, 1.0, front - 0.03), WOOD);
  add(box(inner - 0.1, 0.035, 0.06, 0, well + 0.01, -0.02), BRASS, 0.8);
  for (let i = 0; i < 11; i++) {
    add(box(0.02, 0.075, 0.02, (i / 10 - 0.5) * (inner - 0.2), well + 0.01, -0.02 + (rand() - 0.5) * 0.03), BRASS, 0.9);
  }
  /** The fallboard, folded back over the ends of the keys where they run into the case. */
  add(box(inner, 0.12, 0.16, 0, 0.88, front - 0.04), WOOD_DARK);
  /** The music desk, leaning back with nothing on it, on its ledge. */
  add(box(WIDTH * 0.7, 0.035, 0.12, 0, 1.0, front + 0.06), WOOD_WORN);
  const desk = box(WIDTH * 0.66, 0.42, 0.03, 0, 0, 0);
  desk.rotateX(-0.11);
  add(desk.translate(0, 1.035, front + 0.07), WOOD_WORN, 0.5);

  /** The lid is hinged at the back and propped part way up, as whoever tuned it last left it. */
  const lid = box(WIDTH + 0.04, 0.04, front - back + 0.04, 0, 0, (front - back + 0.04) / 2);
  lid.rotateX(-0.5);
  add(lid.translate(0, TOP, back - 0.02), WOOD, 0.55);

  /** The stool, left standing a little askew, as if somebody had got up from it and not come back. */
  const stool: THREE.BufferGeometry[] = [box(0.68, 0.09, 0.48, 0, 0.41, 0)];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.028, 0.036, 0.43, 6).translate(0, 0.215, 0);
      leg.rotateX(sz * 0.07);
      leg.rotateZ(-sx * 0.07);
      stool.push(leg.translate(sx * 0.26, 0, sz * 0.16));
    }
  }
  const placed = mergeGeometries(stool).rotateY(0.14);
  add(placed.translate(0.06, 0, STOOL_Z), WOOD_DARK, 0.25);

  return mergeGeometries(parts);
}

function keysGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(21);
  KEYBOARD.forEach((k, i) => {
    const geo = k.black
      ? box(KEY_PITCH * 0.54, 0.036, KEY_LEN * 0.66, k.x, KEY_Y + 0.03, KEY_BACK + KEY_LEN * 0.33)
      : box(KEY_PITCH * 0.86, 0.03, KEY_LEN, k.x, KEY_Y, KEY_BACK + KEY_LEN / 2);
    /** Ivory yellows unevenly, and the odd key has gone browner than the ones either side of it. */
    const colour = (k.black ? EBONY : IVORY).clone().multiplyScalar(k.black ? 1 : 0.88 + rand() * 0.18);
    parts.push(tinted(geo, colour, 'aKey', i));
  });
  return mergeGeometries(parts);
}

type Source = 'answer' | 'bird';

interface Scheduled {
  at: number;
  midi: number;
  /** The key that goes down, which for the cygnet is the one under its foot. */
  key: number;
  velocity: number;
  source: Source;
  /** Which of the cygnet's recorded steps it is. */
  step: number;
  /** An answer note to sound on the piano's own strings, because its recording could not play. */
  voiced: boolean;
  active: boolean;
}

export interface NoteLog {
  t: number;
  midi: number;
  key: number;
  src: Source;
  recorded: boolean;
}

const QUEUE = 48;
/** The cygnet's footfalls, as indices into its recorded steps: two rising A♭-major arpeggios, C, A♭, E♭. */
const FOOTFALLS = [0, 1, 2, 0, 1, 2];

export class Piano {
  readonly group = new THREE.Group();
  /** Where the keyboard is, where the stool is, and which way the piano faces. */
  readonly keys = new THREE.Vector3();
  readonly seat = new THREE.Vector3();
  readonly stand = new THREE.Vector3();
  /** Her way round the end away from the bough and out behind the case, leaving the stool. */
  readonly wayRound = [new THREE.Vector3(), new THREE.Vector3()] as const;
  readonly yaw = YAW;
  /** The last few notes it has played, for tuning it by eye when nobody can listen. */
  readonly log: NoteLog[] = [];

  private readonly dip = new Float32Array(KEY_COUNT);
  private readonly dipUniform = { value: this.dip };
  private readonly queue: Scheduled[] = [];
  /** Its own voice, for when the duet's recording has not been decoded. */
  private readonly strings = new PianoStrings();
  /** The wind line that invites her answer and shows how far the player has followed it. */
  private readonly line = new KeyLine();
  private readonly path = (t: number, out: THREE.Vector3): THREE.Vector3 => this.guideAlong(t, out);
  /** What every note does to the meadow: a trace off its key and colour where it runs. */
  private readonly traces = new NoteTraces();
  readonly wave = new PianoWave();
  private readonly back = new THREE.Vector2();
  private readonly keyAt = new THREE.Vector3();
  private readonly guideA = new THREE.Vector3();
  private readonly guideB = new THREE.Vector3();
  private now = 0;
  private out: AudioOut | null = null;
  /** On a tall screen the scene is small, so the guide reaches further across it. */
  private portrait = false;
  /**
   * The answer the player's wind can start: while this is set, following the guide far enough plays it, whole and at
   * its own tempo, and `matched` counts it.
   */
  private expected: MeadowAnswer | null = null;
  /** The answer the guide is drawn for, kept while the line fades after it. */
  private shape: MeadowAnswer | null = null;
  /** The answer sounding now, whose notes her hands and the keys follow. */
  private playing: MeadowAnswer | null = null;
  readonly gesture = new PianoStroke();
  engaged = false;
  finale = false;
  performedAt = -1000;
  performedKey = 0.5;
  /** When the answer she last played has rung down, on the story clock. */
  answerEnds = 0;
  matched = 0;
  get expect(): MeadowAnswer | null { return this.expected; }
  set expect(answer: MeadowAnswer | null) {
    this.expected = answer;
    if (answer) this.shape = answer;
    this.gesture.reset();
  }

  constructor() {
    const foot = Math.max(heightAt(PLACE.x, PLACE.z), 0);
    /** Settled into the ground, and leaning the way a thing left standing in a field for a long time leans. */
    this.group.position.set(PLACE.x, foot - 0.14, PLACE.z);
    this.group.rotation.set(0.016, YAW, -0.022);
    this.group.scale.setScalar(SCALE);
    this.group.updateMatrix();
    this.group.matrixAutoUpdate = false;
    this.group.updateMatrixWorld(true);

    const uniforms = { ...atmo.uniforms, uFoot: { value: foot } };
    const shell = new THREE.Mesh(
      caseGeometry(),
      new THREE.ShaderMaterial({ uniforms, vertexShader: CASE_VERT, fragmentShader: PIANO_FRAG }),
    );
    const keys = new THREE.Mesh(
      keysGeometry(),
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uDip: this.dipUniform },
        vertexShader: KEYS_VERT,
        fragmentShader: PIANO_FRAG,
      }),
    );
    /** The streak is built in world coordinates and drawn there, so the group's own transform never reaches it. */
    this.group.add(shell, keys, this.line.batch.mesh, this.traces.batch.mesh, this.wave.batch.mesh);

    this.local(0, KEY_Y + 0.03, KEY_BACK + KEY_LEN * 0.5, this.keys);
    /** The way up the hill behind the case, which is where every note goes. */
    this.local(0, 0, -1, this.keyAt);
    this.back.set(this.keyAt.x - this.group.position.x, this.keyAt.z - this.group.position.z).normalize();
    /** The lift is a fact about how the child's own pose sits, so it is added in world units, after the scale. */
    this.local(0.06, STOOL_TOP, STOOL_Z, this.seat).y += SEAT_LIFT;
    this.local(0.16, 0, 1.9, this.stand);
    this.local(-1.5, 0, 1.3, this.wayRound[0]);
    this.local(-1.5, 0, -0.9, this.wayRound[1]);
    for (let i = 0; i < QUEUE; i++) {
      this.queue.push({ at: 0, midi: 60, key: 0, velocity: 0, source: 'answer', step: -1, voiced: false, active: false });
    }
  }

  private local(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(x, y, z).applyMatrix4(this.group.matrix);
  }

  /** How much of the grass around its feet is pressed away, so nothing grows through the case or over the keys. */
  get clearing(): { x: number; z: number; radius: number } {
    return { x: this.group.position.x, z: this.group.position.z + 0.45, radius: 1.5 * SCALE };
  }

  /**
   * The cygnet walking the keys from `from` to `to` (shares of the keyboard) over `seconds` from `at`: each footfall
   * presses the key under it and sounds the next of its recorded steps, softly, under the bough's finale.
   */
  walkKeys(from: number, to: number, seconds: number, at = this.now): void {
    FOOTFALLS.forEach((step, i) => {
      const along = (i + 0.5) / FOOTFALLS.length;
      const key = Math.round(THREE.MathUtils.clamp(from + (to - from) * along, 0, 1) * (KEY_COUNT - 1));
      this.schedule(at + along * seconds, MEADOW_STEPS[step].midi, key, tuning.meadowMusic.stepVelocity, 'bird', step);
    });
  }

  /** A point standing on the keys, `t` from the bottom note to the top, for something small enough to walk them. */
  alongKeys(t: number, out: THREE.Vector3): THREE.Vector3 {
    return this.local(THREE.MathUtils.clamp(t - 0.5, -0.5, 0.5) * (WIDTH - 0.12), KEY_Y + 0.05, KEY_BACK + KEY_LEN * 0.6, out);
  }

  /**
   * The guide, a straight line low over the grass in front of her and wider than the piano, so it reads against the
   * land; `t` runs from its low-keys end to its high-keys end, where it rises or falls with the answer's melody.
   */
  guideAlong(t: number, out: THREE.Vector3): THREE.Vector3 {
    const g = tuning.piano;
    this.local((t - 0.5) * (WIDTH - 0.12) * g.guideSpan * (this.portrait ? g.guidePortraitSpan : 1), 0, STOOL_Z + g.guideAhead, out);
    out.y = this.group.position.y + g.guideOver + (t - 0.5) * 2 * (this.shape?.tilt ?? 0) * g.guideTilt;
    return out;
  }

  /** Which way something walking the keys faces: along them, toward the top of the keyboard. */
  get alongYaw(): number {
    return YAW + Math.PI / 2;
  }

  /** Where the paper plane waits while she plays: on the music desk's ledge, leaning back like sheet music. */
  planeRest(at: THREE.Vector3, rotation: THREE.Euler): void {
    const [x, y, z] = tuning.piano.planeRest;
    this.local(x, y, z, at);
    rotation.set(-tuning.piano.planeLean, YAW + tuning.piano.planeTurn, tuning.piano.planeRoll, 'YXZ');
  }

  update(dt: number, time: number, camera: THREE.Camera, wind: WindField, out: AudioOut | null, input: PointerInput | null = null, life: LifeField | null = null): void {
    this.now = time;
    this.out = out;
    this.portrait = camera instanceof THREE.PerspectiveCamera && camera.aspect < 1;
    this.strings.setOutput(out);
    this.group.visible = camera.position.distanceTo(this.keys) < 240;
    if (!this.group.visible) return;
    this.traces.update(dt, wind, life);
    if (this.engaged && input) this.answer(input, camera);
    this.fire();
    this.line.update(dt, time, this.path, camera, this.expect ? 1 : 0, this.gesture.progress);

    const fade = dt / tuning.piano.dipRelease;
    for (let i = 0; i < KEY_COUNT; i++) this.dip[i] = Math.max(0, this.dip[i] - fade);
  }

  /**
   * The player's wind along the guide, from its low-keys end: a broad stroke near it counts, effort is kept across
   * strokes, and following it far enough plays her answer. Nothing but the pointer's own motion moves it.
   */
  private answer(input: PointerInput, camera: THREE.Camera): void {
    const reply = this.expect;
    if (!reply || !input.present || input.muted || input.ndc.equals(input.prevNdc)) return;
    this.guideAlong(0, this.guideA).project(camera);
    this.guideAlong(1, this.guideB).project(camera);
    if (this.guideA.z > 1 || this.guideB.z > 1) return;
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
    const ax = this.guideA.x * aspect * 0.5, ay = this.guideA.y * 0.5;
    const dx = (this.guideB.x - this.guideA.x) * aspect * 0.5, dy = (this.guideB.y - this.guideA.y) * 0.5;
    const length2 = dx * dx + dy * dy;
    if (length2 < 0.0001) return;
    const px = input.prevNdc.x * aspect * 0.5 - ax, py = input.prevNdc.y * 0.5 - ay;
    const qx = input.ndc.x * aspect * 0.5 - ax, qy = input.ndc.y * 0.5 - ay;
    const previous = (px * dx + py * dy) / length2, current = (qx * dx + qy * dy) / length2;
    const distance = Math.max(Math.abs(px * dy - py * dx), Math.abs(qx * dy - qy * dx)) / Math.sqrt(length2);
    if (this.gesture.step(previous, current, distance, tuning.piano.guideTolerance) < 1) return;
    this.matched++;
    this.expect = null;
    this.perform(reply);
  }

  /** Her answer, whole and at its own tempo: the recording, with her hands and the keys on its onsets. */
  private perform(reply: MeadowAnswer): void {
    const recorded = !!this.out && meadowMusic.duet(reply.clip, 0, `answer ${reply.index + 1}`, tuning.meadowMusic.answerDb);
    this.playing = reply;
    for (const note of reply.notes) {
      this.schedule(this.now + note.at, note.midi, note.midi - LOW_MIDI, tuning.piano.answerVelocity, 'answer', -1, !recorded);
    }
    this.answerEnds = this.now + reply.end;
  }

  private schedule(at: number, midi: number, key: number, velocity: number, source: Source, step = -1, voiced = false): void {
    for (const slot of this.queue) {
      if (slot.active) continue;
      Object.assign(slot, { at, midi, key, velocity: Math.min(1, velocity), source, step, voiced, active: true });
      return;
    }
  }

  private fire(): void {
    for (const slot of this.queue) {
      if (!slot.active || slot.at > this.now) continue;
      slot.active = false;
      this.play(slot);
    }
  }

  private play({ midi, key, velocity, source, step, voiced }: Scheduled): void {
    if (key >= 0 && key < KEY_COUNT) this.dip[key] = 1;
    // The cygnet's steps are recorded too; either voice falls back on the strings until the recording is decoded.
    const recorded = source === 'bird'
      ? !!this.out && meadowMusic.duet(MEADOW_STEPS[step], 0, `step ${midi}`, tuning.meadowMusic.stepDb)
      : !voiced;
    if (key >= 0 && key < KEY_COUNT && (source === 'answer' || this.finale)) {
      const notes = this.playing?.notes;
      const low = notes ? Math.min(...notes.map(n => n.midi)) : 0, high = notes ? Math.max(...notes.map(n => n.midi)) : 0;
      const pitch = source === 'answer' && notes ? (midi - low) / Math.max(1, high - low) : key / (KEY_COUNT - 1);
      this.traces.spawn(this.alongKeys(key / (KEY_COUNT - 1), this.keyAt), this.back, pitch,
        THREE.MathUtils.clamp(velocity * 2, 0.25, 1), true);
    }
    if (source === 'answer') {
      this.performedAt = this.now;
      this.performedKey = key / (KEY_COUNT - 1);
    }
    if (!recorded) this.strings.note(midi, velocity, (KEYBOARD[key]?.x ?? 0) * 0.5, tuning.piano.loudness);
    this.log.push({ t: Math.round(this.now * 100) / 100, midi, key, src: source, recorded });
    if (this.log.length > 90) this.log.shift();
  }
}

/** There is one piano and one place it stands. `main.ts` puts it in the world; the meadow's story finds it here. */
export const piano = new Piano();
