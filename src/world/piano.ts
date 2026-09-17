import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PianoStrings, moodScale } from '../audio/audio';
import type { AudioOut } from '../creatures/voices';
import { glsl, tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { meadowPoint } from './heightfield';
import { heightAt } from './island';
import { mulberry32 } from './noise';
import { WINDOW } from './window';

/**
 * An upright piano standing in the meadow grass with nobody at it, which the wind plays. It is another piece of
 * home the dream has left in the wrong place, and it is the only thing in the game the player can make music with
 * on purpose: gusts run up and down the keys, a held updraft rolls a chord, and the breeze finds a note now and
 * then by itself. Every note comes out of the meadow's own scale, so nothing anyone does can sound wrong.
 */

/** Where it stands: a little east of the walk, on the leg before the crest, in a patch of shorter grass. */
const PLACE = meadowPoint(16, -676);
/** Turned toward the camera, which looks north from a little east of south, so the keys face the walk. */
const YAW = 0.34;

const WIDTH = 1.85;
const DEPTH = 0.72;
const TOP = 1.6;
/** The underside of the case above the keyboard, and the keybed the keys lie on. */
const CASE_Y = 0.95;
const KEY_Y = 0.8;
/** Where a key is hinged, back under the case, and how far it reaches out from there. */
const KEY_BACK = 0.3;
const KEY_LEN = 0.46;

/** The keyboard runs from C3 to C7. A key's index is its midi note less this. */
const LOW_MIDI = 48;
const KEY_COUNT = 49;
const WHITE_TONES = [0, 2, 4, 5, 7, 9, 11];
/** The lowest and highest note the wind ever finds, a little over three octaves of the meadow's scale. */
const LOW_NOTE = 50;
const HIGH_NOTE = 88;

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
  /** Whatever faces the sky has had a summer of it: the lid and the top have gone grey and chalky. */
  albedo = mix(albedo, albedo * 1.3 + vec3(0.035, 0.032, 0.026), smoothstep(0.25, 0.9, N.y) * 0.28);
  /** And whatever is down in the grass has gone green and damp at the foot. */
  albedo = mix(albedo, mix(albedo, vec3(0.1, 0.13, 0.06), 0.5), 1.0 - smoothstep(0.0, 0.45, vWorld.y - uFoot));
  albedo *= 0.78 + 0.22 * abs(N.y);

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 34.0) * vGloss;
  /** It stands with its back to a low sun like everything else here, so its edge is where the light is. */
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6) * max(dot(-V, uSunDir), 0.0);
  vec3 col = albedo * hemiLight(N) + (albedo * uSunColor * max(dot(N, uSunDir), 0.0) * 0.75 + uSunColor * (spec + rim * 0.3)) * sun;
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

const WOOD = new THREE.Color('#6a4a2e');
const WOOD_DARK = new THREE.Color('#4f3724');
const BRASS = new THREE.Color('#a8872f');
const CAVITY = new THREE.Color('#120d0a');
const IVORY = new THREE.Color('#e9e0c8');
const EBONY = new THREE.Color('#231f1c');

/** The case, the stool and everything that is not a key: one mesh, tinted part by part. */
function caseGeometry(): THREE.BufferGeometry {
  const rand = mulberry32(713);
  const parts: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, colour: THREE.Color, gloss = 0.3) => parts.push(tinted(geo, colour, 'aGloss', gloss));
  const front = DEPTH / 2 + 0.06;

  add(box(WIDTH, 0.17, DEPTH, 0, 0, 0), WOOD_DARK);
  /** The lower front panel, set back between the two leg posts, with the pedals coming out under it. */
  add(box(WIDTH * 0.88, 0.6, DEPTH * 0.78, 0, 0.17, -0.05), WOOD);
  for (const side of [-1, 1]) add(box(0.15, 0.78, DEPTH, side * (WIDTH / 2 - 0.075), 0, 0), WOOD);
  add(box(0.3, 0.22, 0.12, 0, 0.16, 0.3), WOOD_DARK);
  for (const side of [-1, 1]) add(box(0.09, 0.022, 0.26, side * 0.08, 0.22, 0.44), BRASS, 0.9);

  /** The keybed the keys lie on, out past the case at both ends, and the blocks that close the keyboard off. */
  add(box(WIDTH, 0.07, DEPTH + 0.48, 0, KEY_Y - 0.07, 0.24), WOOD);
  for (const side of [-1, 1]) add(box(0.08, 0.13, 0.32, side * (WIDTH / 2 - 0.04), KEY_Y, 0.42), WOOD);
  /** The case above the keyboard, and the lip under its front that the key backs run away into. */
  add(box(WIDTH, TOP - CASE_Y, DEPTH + 0.12, 0, CASE_Y, front - (DEPTH + 0.12) / 2), WOOD);
  add(box(WIDTH, 0.16, 0.1, 0, 0.9, front - 0.05), WOOD_DARK);
  /** The music desk, leaning back with nothing on it, on the ledge above the keys. */
  const desk = box(WIDTH * 0.66, 0.42, 0.03, 0, 0, 0);
  desk.rotateX(-0.11);
  add(desk.translate(0, 1.06, front + 0.07), WOOD_DARK, 0.5);
  add(box(WIDTH * 0.7, 0.035, 0.11, 0, 1.04, front + 0.05), WOOD);

  /** The top stands open: a dark slot with the tuning pins in it, and the lid up over the back of the case. */
  add(box(WIDTH - 0.16, 0.14, DEPTH - 0.14, 0, TOP - 0.15, 0), CAVITY, 0);
  add(box(WIDTH - 0.26, 0.035, 0.06, 0, TOP - 0.1, -0.1), BRASS, 0.8);
  for (let i = 0; i < 11; i++) {
    add(box(0.02, 0.075, 0.02, (i / 10 - 0.5) * (WIDTH - 0.32), TOP - 0.11, -0.1 + (rand() - 0.5) * 0.03), BRASS, 0.9);
  }
  const lid = box(WIDTH + 0.06, 0.05, DEPTH + 0.1, 0, 0, (DEPTH + 0.1) / 2);
  lid.rotateX(-1.28);
  add(lid.translate(0, TOP, -DEPTH / 2), WOOD, 0.55);

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
  const placed = mergeGeometries(stool).rotateY(0.3);
  add(placed.translate(0.06, 0, 1.28), WOOD_DARK, 0.25);

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

type Source = 'gust' | 'lift' | 'breeze' | 'child' | 'bird';

interface Scheduled {
  at: number;
  midi: number;
  velocity: number;
  source: Source;
  active: boolean;
}

export interface NoteLog {
  t: number;
  midi: number;
  /** Which step of the meadow's scale it is, counting from the lowest note the piano ever plays. */
  step: number;
  v: number;
  src: Source;
}

const QUEUE = 48;

/** The notes of the meadow's own scale, over the three and a bit octaves the wind can reach. */
function notePool(): number[] {
  const tones = new Set(moodScale('meadow').map((m) => ((m % 12) + 12) % 12));
  const pool: number[] = [];
  for (let m = LOW_NOTE; m <= HIGH_NOTE; m++) if (tones.has(m % 12)) pool.push(m);
  return pool;
}

export class Piano {
  readonly group = new THREE.Group();
  /** Where the keyboard is, where the stool is, and which way the piano faces. */
  readonly keys = new THREE.Vector3();
  readonly seat = new THREE.Vector3();
  readonly stand = new THREE.Vector3();
  readonly yaw = YAW;
  /** The last few notes it has played, for tuning it by eye when nobody can listen. */
  readonly log: NoteLog[] = [];

  private readonly pool = notePool();
  private readonly dip = new Float32Array(KEY_COUNT);
  private readonly dipUniform = { value: this.dip };
  private readonly queue: Scheduled[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  /** Which way along the keyboard the wind has to blow for a run to climb: up the keys is to the right on screen. */
  private readonly axis = new THREE.Vector2(Math.cos(YAW), -Math.sin(YAW));
  private readonly rand = mulberry32(5150);
  private readonly strings = new PianoStrings();
  private level = 0;
  private prevEnergy = 0;
  private runUntil = 0;
  private nextChord = 0;
  private nextBreeze = 0;
  private lastPlayed = -1e3;
  private lastGesture = -1e3;
  private now = 0;

  constructor() {
    const foot = Math.max(heightAt(PLACE.x, PLACE.z), 0);
    /** Settled into the ground, and leaning the way a thing left standing in a field for a long time leans. */
    this.group.position.set(PLACE.x, foot - 0.12, PLACE.z);
    this.group.rotation.set(0.016, YAW, -0.022);
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
    this.group.add(shell, keys);

    this.local(0, KEY_Y + 0.03, KEY_BACK + KEY_LEN * 0.5, this.keys);
    this.local(0.06, 0.46, 1.26, this.seat);
    this.local(0.16, 0, 2.25, this.stand);
    for (let i = 0; i < QUEUE; i++) this.queue.push({ at: 0, midi: 60, velocity: 0, source: 'breeze', active: false });
  }

  private local(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(x, y, z).applyMatrix4(this.group.matrix);
  }

  /** How much of the grass around its feet is pressed away, so nothing grows through the case or over the keys. */
  get clearing(): { x: number; z: number; radius: number } {
    return { x: this.group.position.x, z: this.group.position.z + 0.35, radius: 1.5 };
  }

  /** The last time the player's own wind rang a note out of it. */
  get lastGestureNote(): number {
    return this.lastGesture;
  }

  /** One key pressed by a finger: the child's single note, and the only note nobody had to be the wind for. */
  press(): void {
    const midi = this.pool[Math.floor(this.pool.length * 0.42)];
    this.schedule(this.now, midi, 0.34, 'child');
  }

  /**
   * Something small walking up the keys from one note to another, plinking as it goes. The companion is being
   * rebuilt elsewhere, so nothing drives this yet; the piano's half of that moment is here and working.
   */
  walkKeys(from: number, to: number, seconds: number): void {
    const a = this.nearestStep(from);
    const b = this.nearestStep(to);
    const steps = Math.abs(b - a);
    if (steps === 0) return;
    const dir = Math.sign(b - a);
    for (let i = 0; i <= steps; i++) {
      const hop = (i / steps) * seconds;
      this.schedule(this.now + hop, this.pool[a + dir * i], 0.2 + this.rand() * 0.1, 'bird');
    }
  }

  private nearestStep(midi: number): number {
    let best = 0;
    for (let i = 1; i < this.pool.length; i++) {
      if (Math.abs(this.pool[i] - midi) < Math.abs(this.pool[best] - midi)) best = i;
    }
    return best;
  }

  update(dt: number, time: number, camera: THREE.Camera, wind: WindField, out: AudioOut | null): void {
    this.now = time;
    this.strings.setOutput(out);
    const reach = camera.position.distanceTo(this.keys);
    this.group.visible = reach < 240;
    if (!this.group.visible) return;

    const { heardWithin, heardFully, dipRelease } = tuning.piano;
    this.level = 1 - THREE.MathUtils.smoothstep(reach, heardFully, heardWithin);
    if (this.level > 0 && this.inWindow()) this.listen(wind);
    this.fire();

    const fade = dt / dipRelease;
    for (let i = 0; i < KEY_COUNT; i++) this.dip[i] = Math.max(0, this.dip[i] - fade);
  }

  /** The wind readback only covers a window around the camera; outside it a sample is the window's edge. */
  private inWindow(): boolean {
    const p = this.keys;
    return p.x > WINDOW.minX + 2 && p.x < WINDOW.minX + WINDOW.size - 2 && p.z > WINDOW.minZ + 2 && p.z < WINDOW.minZ + WINDOW.size - 2;
  }

  /** What the air over the keyboard is doing, and what the piano makes of it. */
  private listen(wind: WindField): void {
    const t = tuning.piano;
    const w = wind.sample(this.keys.x, this.keys.z, this.sample);
    const speed = Math.hypot(w.x, w.z);
    const energy = w.energy;

    if (energy > t.gustFrom && energy > this.prevEnergy + 0.008 && speed > 3 && this.now > this.runUntil) {
      this.run(THREE.MathUtils.clamp((energy - t.gustFrom) / (t.gustFull - t.gustFrom), 0, 1), (w.x * this.axis.x + w.z * this.axis.y) / Math.max(speed, 1e-4), speed);
    }
    this.prevEnergy = energy;

    if (w.lift > t.liftFrom && this.now > this.nextChord && this.now > this.runUntil) {
      this.chord(THREE.MathUtils.clamp((w.lift - t.liftFrom) / 1.2, 0, 1));
      this.nextChord = this.now + t.chordEvery;
    }

    /** And when nothing is being done to it at all, the prevailing breeze still finds a note every so often. */
    if (this.now > this.nextBreeze) {
      if (speed > t.breezeSpeed && this.now - this.lastPlayed > 3.5) {
        const step = Math.floor(this.pool.length * (0.3 + this.rand() * 0.45));
        this.schedule(this.now, this.pool[step], 0.1 + Math.min(0.1, speed * 0.02), 'breeze');
      }
      this.nextBreeze = this.now + t.breezeLeast + this.rand() * (t.breezeMost - t.breezeLeast);
    }
  }

  /**
   * A gust crossing the keys, played as the run of notes it looks like: up the keyboard if it is travelling that
   * way and down if it is not, faster and longer the harder it blows, and never quite even, because nothing the
   * wind does is even.
   */
  private run(strength: number, along: number, speed: number): void {
    const t = tuning.piano;
    const crossing = Math.min(1, Math.abs(along) * 2.2);
    const count = Math.round(THREE.MathUtils.lerp(t.runLeast, t.runMost, strength * (0.45 + 0.55 * crossing)));
    const dir = along >= 0 ? 1 : -1;
    const room = this.pool.length - count;
    /** It starts where the gust comes in: low notes if it is going up the keys, high ones if it is coming down. */
    const bias = Math.pow(this.rand(), 1.5) * room * 0.8;
    let step = dir > 0 ? Math.floor(bias) : this.pool.length - 1 - Math.floor(bias);
    const spacing = THREE.MathUtils.lerp(t.spaceSlow, t.spaceFast, Math.min(1, strength * 0.7 + speed / 40));
    let at = this.now;
    for (let i = 0; i < count; i++) {
      if (step < 0 || step >= this.pool.length) break;
      const fade = 1 - (i / count) * 0.35;
      this.schedule(at, this.pool[step], (0.3 + 0.55 * strength) * fade * (0.75 + this.rand() * 0.45), 'gust');
      at += spacing * (0.78 + this.rand() * 0.5);
      /** A hand running up a keyboard skips a note now and then; so does a gust. */
      step += dir * (this.rand() < 0.22 ? 2 : 1);
    }
    this.runUntil = at + 0.1;
  }

  /** Rising air held over the keyboard: the notes come up under each other and stay. */
  private chord(strength: number): void {
    const root = Math.floor(this.rand() * (this.pool.length - 7));
    let at = this.now;
    for (let i = 0; i < 4; i++) {
      this.schedule(at, this.pool[root + i * 2], 0.16 + 0.14 * strength + i * 0.02, 'lift');
      at += 0.065 + this.rand() * 0.055;
    }
  }

  private schedule(at: number, midi: number, velocity: number, source: Source): void {
    for (const slot of this.queue) {
      if (slot.active) continue;
      slot.at = at;
      slot.midi = midi;
      slot.velocity = Math.min(1, velocity);
      slot.source = source;
      slot.active = true;
      return;
    }
  }

  private fire(): void {
    for (const slot of this.queue) {
      if (!slot.active || slot.at > this.now) continue;
      slot.active = false;
      this.play(slot.midi, slot.velocity, slot.source);
    }
  }

  private play(midi: number, velocity: number, source: Source): void {
    const key = midi - LOW_MIDI;
    if (key >= 0 && key < KEY_COUNT) this.dip[key] = 1;
    this.lastPlayed = this.now;
    if (source === 'gust' || source === 'lift') this.lastGesture = this.now;
    this.strings.note(midi, velocity, (KEYBOARD[key]?.x ?? 0) * 0.5, this.level);
    this.log.push({ t: Math.round(this.now * 100) / 100, midi, step: this.pool.indexOf(midi), v: Math.round(velocity * 100) / 100, src: source });
    if (this.log.length > 90) this.log.shift();
  }
}

/** There is one piano and one place it stands. `main.ts` puts it in the world; the meadow's story finds it here. */
export const piano = new Piano();
