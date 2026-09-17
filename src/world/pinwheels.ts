import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AudioOut } from '../creatures/voices';
import { glsl, tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { mulberry32 } from './noise';

/**
 * Paper wheels on sticks. Every wheel is one instance of the same six sails; the CPU keeps its spin phase, how
 * far it has smeared and which way it has turned to face the wind, and the vertex shader does the rest.
 *
 * The smear is what makes the wind visible: a sail is swept back through the angle it turned during a shutter's
 * worth of time, so a wheel that has just been caught by a gust blurs into a disc while the one beside it is
 * still crisp. That is a gust travelling, drawn one wheel at a time.
 */
const WHEEL_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aPos;
in vec4 aState;
in vec3 aTint;
in float aSweep;
in float aTone;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vPaper;
out float vCover;
out float vRadius;

void main() {
  float ang = aState.x - aState.y * (1.0 - aSweep);
  float ca = cos(ang);
  float sa = sin(ang);
  vec3 spun = vec3(position.x * ca - position.y * sa, position.x * sa + position.y * ca, position.z);
  vec3 spunN = vec3(normal.x * ca - normal.y * sa, normal.x * sa + normal.y * ca, normal.z);

  float cy = cos(aState.z);
  float sy = sin(aState.z);
  vec3 face = vec3(sy, 0.0, cy);
  vec3 side = vec3(cy, 0.0, -sy);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vWorld = aPos + (side * spun.x + up * spun.y + face * spun.z) * aState.w;
  vNormal = side * spunN.x + up * spunN.y + face * spunN.z;
  vPaper = mix(vec3(0.95, 0.92, 0.86), aTint, aTone);
  /** A sail swept over a wider angle than it covers is that much thinner on the eye. */
  vCover = ${glsl(Math.PI / 3)} / (${glsl(Math.PI / 3)} + aState.y);
  vRadius = length(position.xy);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const WHEEL_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vPaper;
in float vCover;
in float vRadius;

/** Interleaved gradient noise: a dither that holds still on screen instead of crawling. */
float wheelDither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  if (vCover < 0.999 && wheelDither(gl_FragCoord.xy) > max(vCover, 0.6)) discard;
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);

  vec3 paper = vPaper * (0.94 + vnoise(vWorld.xz * 40.0 + vWorld.y * 9.0) * 0.12);
  /** Creased where the paper was folded in to the pin, and grubby where a hand held it. */
  paper *= 0.72 + 0.28 * smoothstep(0.12, 0.42, vRadius);
  float through = max(-ndl, 0.0) * 0.5;
  vec3 col = paper * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.6 + through * 0.75) * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const STICK_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vWorld = position;
  vNormal = normalize(normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const STICK_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  vec3 wood = vec3(0.47, 0.39, 0.29) * (0.82 + vnoise(vWorld.xz * 20.0 + vWorld.y * 14.0) * 0.36);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = wood * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.7 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const SAILS = 6;
const SECTOR = (Math.PI * 2) / SAILS;
/** The gap between one sail and the next, so the wheel reads as folded paper rather than a disc. */
const GAP = 0.13;
const HUB = 0.09;

/**
 * One wheel: six sails, each a square of paper with a corner folded in to the pin, so it is flat at the hub and
 * scooped at the rim. The scoop is what the wind pushes on, and it is what catches the low sun on one side.
 */
function wheelGeometry(radius: number, pitch: number): THREE.BufferGeometry {
  const steps = 2;
  const verts: number[] = [];
  const sweeps: number[] = [];
  const tones: number[] = [];
  const index: number[] = [];
  for (let s = 0; s < SAILS; s++) {
    const base = s * SECTOR;
    const start = (verts.length / 3) | 0;
    for (let u = 0; u <= steps; u++) {
      const uu = u / steps;
      const r = HUB + (radius - HUB) * uu;
      for (let v = 0; v <= steps; v++) {
        const vv = v / steps;
        const ang = base + (SECTOR - GAP) * vv;
        const z = pitch * (vv - 0.5) * 2 * Math.pow(uu, 1.3);
        verts.push(Math.cos(ang) * r, Math.sin(ang) * r, z);
        sweeps.push(vv);
        tones.push(s % 2);
      }
    }
    for (let u = 0; u < steps; u++) {
      for (let v = 0; v < steps; v++) {
        const a = start + u * (steps + 1) + v;
        index.push(a, a + steps + 1, a + 1, a + 1, a + steps + 1, a + steps + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('aSweep', new THREE.BufferAttribute(new Float32Array(sweeps), 1));
  geo.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(tones), 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Where a row stands: how far along the walk, which side of it, how far out, and how many wheels are in it. */
interface Row {
  t: number;
  side: number;
  out: number;
  count: number;
}

/**
 * Four short rows down the open ground the walk takes, none of them joined to the next. They edge the alley the
 * washing already leaves without ever reading as a path: somebody's child pushed them in and went off.
 */
const ROWS: Row[] = [
  { t: 0.2, side: 1, out: 3.5, count: 7 },
  { t: 0.37, side: -1, out: 3.3, count: 5 },
  { t: 0.55, side: 1, out: 4.8, count: 9 },
  { t: 0.76, side: -1, out: 3.6, count: 6 },
];

/** Faded reds and a dusty ochre: the door's red at its strongest, and nothing at all at a fairground. */
const SAIL_TINTS = ['#c4695c', '#e6dac2', '#b5362c', '#d8c6a8', '#c98d7c', '#efe7d8'];

/** The point a fraction `t` along the path, and the direction the path runs there. */
function pointAt(path: readonly THREE.Vector2[], t: number, out: THREE.Vector2, dir: THREE.Vector2): void {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
  let want = t * total;
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].distanceTo(path[i - 1]) || 1;
    if (want <= seg || i === path.length - 1) {
      out.lerpVectors(path[i - 1], path[i], THREE.MathUtils.clamp(want / seg, 0, 1));
      dir.subVectors(path[i], path[i - 1]).divideScalar(seg);
      return;
    }
    want -= seg;
  }
}

interface Wheel {
  x: number;
  z: number;
  /** How quickly it turns: a big wheel on a long pin is lazier than a small one. */
  ease: number;
  yaw: number;
  omega: number;
  phase: number;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Paper pinwheels along the walk over the island of lines. The washing is the grown-up who is not there; these
 * are the child who is not. Each wheel reads the wind where it is standing, turns on its stick to face it and
 * spins with real inertia, so a gust the player throws runs down a row one wheel at a time.
 */
export class Pinwheels {
  readonly group = new THREE.Group();
  private readonly wheels: Wheel[] = [];
  private readonly state: Float32Array;
  private readonly stateAttr: THREE.InstancedBufferAttribute;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly centre = new THREE.Vector3();
  private flutter: Flutter | null = null;

  constructor(
    private readonly wind: WindField,
    path: readonly THREE.Vector2[],
  ) {
    const rand = mulberry32(713);
    const on = new THREE.Vector2();
    const dir = new THREE.Vector2();
    const positions: number[] = [];
    const states: number[] = [];
    const tints: number[] = [];
    const sticks: THREE.BufferGeometry[] = [];
    const tint = new THREE.Color();

    for (const row of ROWS) {
      pointAt(path, row.t, on, dir);
      const nx = dir.y * row.side;
      const nz = -dir.x * row.side;
      /** Set well apart: the wind is read per wheel off a coarse grid, and a gust has to arrive one at a time. */
      const spacing = 1.7 + rand() * 0.45;
      const lean = (rand() - 0.5) * 0.35;
      for (let i = 0; i < row.count; i++) {
        const along = (i - (row.count - 1) / 2) * spacing;
        const out = row.out + lean * (i / Math.max(1, row.count - 1) - 0.5) * 2 + (rand() - 0.5) * 0.5;
        const x = on.x + dir.x * along + nx * out;
        const z = on.y + dir.y * along + nz * out;
        const ground = heightAt(x, z);
        if (ground < 2) continue;
        /** Long enough to stand the wheel clear of grass this deep, and all of them a little out of true. */
        const top = 1.8 + rand() * 0.4;
        this.wheels.push({ x, z, ease: 0.8 + rand() * 0.5, yaw: rand() * 6.28, omega: 0, phase: rand() * 6.28 });
        positions.push(x, ground + top, z);
        states.push(0, 0, 0, 0.29 + rand() * 0.07);
        tint.set(SAIL_TINTS[Math.floor(rand() * SAIL_TINTS.length)]);
        tints.push(tint.r, tint.g, tint.b);
        sticks.push(stickGeometry(x, z, ground, top, rand));
      }
    }

    const wheel = wheelGeometry(1, 0.34);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = wheel.index;
    geo.attributes.position = wheel.attributes.position;
    geo.attributes.normal = wheel.attributes.normal;
    geo.attributes.aSweep = wheel.attributes.aSweep;
    geo.attributes.aTone = wheel.attributes.aTone;
    geo.instanceCount = this.wheels.length;
    this.state = new Float32Array(states);
    this.stateAttr = new THREE.InstancedBufferAttribute(this.state, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('aState', this.stateAttr);
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tints), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.group.add(
      new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: WHEEL_VERT, fragmentShader: WHEEL_FRAG, side: THREE.DoubleSide }),
      ),
    );
    this.group.add(
      new THREE.Mesh(mergeGeometries(sticks), new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: STICK_VERT, fragmentShader: STICK_FRAG })),
    );
    let cx = 0;
    let cz = 0;
    for (const w of this.wheels) {
      cx += w.x / this.wheels.length;
      cz += w.z / this.wheels.length;
    }
    this.centre.set(cx, 0, cz);
  }

  update(dt: number, camera: THREE.Camera, audio: AudioOut | null): void {
    const away = Math.hypot(camera.position.x - this.centre.x, camera.position.z - this.centre.z);
    this.group.visible = away < 220;
    if (!this.group.visible) {
      this.flutter?.silence();
      return;
    }
    const k = tuning.linesToys;
    let loudest = 0;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const air = this.wind.sample(w.x, w.z, this.sample);
      const speed = Math.hypot(air.x, air.z);
      /** It weathercocks: the sails are a sail, and the stick is behind them. */
      if (speed > 0.3) w.yaw += wrap(Math.atan2(air.x, air.z) - w.yaw) * (1 - Math.exp(-dt * k.veerRate * w.ease * Math.min(2, 0.5 + speed * 0.2)));
      const into = Math.max(0, air.x * Math.sin(w.yaw) + air.z * Math.cos(w.yaw));
      const want = into * k.spinPerSpeed * w.ease;
      /** Light paper takes the wind at once and gives it up slowly, which is why a gust stays visible in a row. */
      w.omega += (want - w.omega) * (1 - Math.exp(-dt * (want > w.omega ? k.spinUp : k.spinDown)));
      w.phase += w.omega * dt;
      if (w.phase > 6.283185) w.phase -= 6.283185;
      const o = i * 4;
      this.state[o] = w.phase;
      /** A wheel only smears once it is really going: turning gently it stays crisp paper. */
      this.state[o + 1] = THREE.MathUtils.clamp(w.omega * k.smearSeconds - 0.14, 0, SECTOR);
      this.state[o + 2] = w.yaw;
      if (w.omega > loudest) loudest = w.omega;
    }
    this.stateAttr.needsUpdate = true;
    if (audio && !this.flutter) this.flutter = new Flutter(audio);
    this.flutter?.update(loudest, away);
  }
}

/** A stick shoved into the ground, leaning however it was left, with the pin's bead on top. */
function stickGeometry(x: number, z: number, ground: number, top: number, rand: () => number): THREE.BufferGeometry {
  const lean = 0.05 + rand() * 0.14;
  const spin = rand() * 6.28;
  const stick = new THREE.CylinderGeometry(0.018, 0.026, top + 0.3, 5).translate(0, (top + 0.3) / 2 - 0.3, 0);
  const bead = new THREE.SphereGeometry(0.038, 6, 4).translate(0, top, 0);
  const g = mergeGeometries([stick, bead]);
  g.rotateZ(lean * Math.cos(spin));
  g.rotateX(lean * Math.sin(spin));
  return g.translate(x, ground, z);
}

/**
 * The dry tick and rustle of paper going round. One voice for the whole row, opened by the fastest wheel near
 * the camera, with the blade rate under it so it speeds up when they do.
 */
class Flutter {
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private readonly band: BiquadFilterNode;
  private readonly rate: OscillatorNode;

  constructor(out: AudioOut) {
    const { ctx } = out;
    this.ctx = ctx;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    this.band = ctx.createBiquadFilter();
    this.band.type = 'bandpass';
    this.band.frequency.value = 2600;
    this.band.Q.value = 1.1;
    const trem = ctx.createGain();
    trem.gain.value = 0.55;
    this.rate = ctx.createOscillator();
    this.rate.type = 'triangle';
    this.rate.frequency.value = 12;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    this.rate.connect(depth).connect(trem.gain);
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    src.connect(this.band).connect(trem).connect(this.gain);
    this.gain.connect(out.bus);
    this.gain.connect(out.reverb);
    src.start();
    this.rate.start();
  }

  update(omega: number, away: number): void {
    const near = 1 - THREE.MathUtils.smoothstep(away, 14, 60);
    const level = THREE.MathUtils.smoothstep(omega, 2.5, 22) * near * 0.05;
    this.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.12);
    this.band.frequency.setTargetAtTime(2100 + omega * 90, this.ctx.currentTime, 0.2);
    this.rate.frequency.setTargetAtTime(Math.max(4, (omega * SAILS) / (Math.PI * 2)), this.ctx.currentTime, 0.15);
  }

  silence(): void {
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }
}
