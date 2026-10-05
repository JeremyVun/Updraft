import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { AudioOut } from '../creatures/voices';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { WAY } from './fields';
import { heightAt } from './island';

/**
 * The bells, low to high along the walk: the meadow's own scale, so a sweep either way is a run of the lullaby's
 * notes. When one sweep rings all of them in order the row answers by itself, back the other way.
 */
const NOTES = [74, 76, 78, 81, 83];
/** Where along the walk down from the pond the row stands (metres along the way), and how far to its left. */
const ALONG = [8, 12, 16, 20, 24];
const ASIDE = [3.1, 2.7, 3.4, 2.8, 3.2];
const STEMS = 5;
/** How long a whole run may take to count as one phrase, and how soon after it the row answers. */
const PHRASE_WITHIN = 3;
const ANSWER_AFTER = 0.7;
const ANSWER_GAP = 0.42;
/** A bell rung again too soon only swings; it does not sound twice over itself. */
const REST = 0.3;
/** Screen radius a stroke has to pass within (screen heights), and how near the child walks to brush one. */
const BRUSH = 0.12;
const BRUSHED = 1.2;

const VERT = /* glsl */ `
${ATMO_GLSL}
out vec3 vWorld;
out vec3 vNormal;
out float vY;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(m) * normal);
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Thin enough that the low sun comes through the bell from behind; deeper blue at the shoulder, pale at the lip. */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uDeep;
uniform vec3 uPale;
uniform float uFrom;
uniform float uTo;
uniform float uGlow;
in vec3 vWorld;
in vec3 vNormal;
in float vY;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float ndl = dot(N, uSunDir);
  vec3 alb = mix(uDeep, uPale, smoothstep(uFrom, uTo, vY));
  vec3 col = alb * (uSkyAmbient * 1.45 + uSunColor * (max(ndl, 0.0) * 0.6 + max(-ndl, 0.0) * uGlow));
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(col, f.rgb, f.a), 1.0);
}`;

function material(deep: string, pale: string, from: number, to: number, glow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...atmo.uniforms,
      uDeep: { value: new THREE.Color(deep) },
      uPale: { value: new THREE.Color(pale) },
      uFrom: { value: from },
      uTo: { value: to },
      uGlow: { value: glow },
    },
    side: THREE.DoubleSide,
  });
}

/** A wiry stem a unit tall that arches over at the top, so the bell on the end of it nods. */
const STEM_PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.45, 0.015),
  new THREE.Vector3(0.02, 0.85, 0.05),
  new THREE.Vector3(0.07, 1, 0.1),
  new THREE.Vector3(0.12, 0.98, 0.14),
]);
const TIP = STEM_PATH.getPoint(1);

/** A bell hanging mouth down from its top, flaring to five shallow lobes at the lip. */
function bellGeometry(): THREE.BufferGeometry {
  const profile = [
    [0.012, 0], [0.04, -0.02], [0.06, -0.06], [0.07, -0.11], [0.08, -0.16], [0.1, -0.2], [0.115, -0.215],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 30);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lobe = 1 + 0.13 * Math.cos(5 * Math.atan2(z, x)) * THREE.MathUtils.smoothstep(-y, 0.12, 0.215);
    p.setXYZ(i, x * lobe, y, z * lobe);
  }
  geo.computeVertexNormals();
  return geo;
}

interface Stem {
  x: number;
  y: number;
  z: number;
  yaw: number;
  height: number;
  /** The stem leaning on the wind, and the bell swinging on its end: angles about x and z with their speeds. */
  lean: THREE.Vector2;
  leanSpeed: THREE.Vector2;
  swing: THREE.Vector2;
  swingSpeed: THREE.Vector2;
  phase: number;
}

interface Clump {
  x: number;
  z: number;
  note: number;
  stems: Stem[];
  rangAt: number;
  /** Rung by the player (not brushed by the child), for telling whether a sweep went down the whole row. */
  sweptAt: number;
  /** The child or the plane is in among it: it rang as they came in, and does not again until they have left it. */
  brushed: boolean;
}

/** A row of harebells, grown far too tall, beside the walk from the pond. The wind rings them. */
export class Harebells {
  readonly group = new THREE.Group();
  private readonly clumps: Clump[] = [];
  private readonly stems: THREE.InstancedMesh;
  private readonly bells: THREE.InstancedMesh;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly turn = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly at = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly size = new THREE.Vector3();
  private answerAt = -1;
  private answered = 0;
  /** Which way the row sings back: the other way from the sweep. */
  private answerDown = false;
  private now = 0;
  /** The last bell to ring, for whoever wants to look at it, and when. */
  readonly heard = new THREE.Vector3();
  heardAt = -Infinity;

  constructor() {
    const a = WAY[5];
    const b = WAY[6];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / length;
    const dz = (b.z - a.z) / length;
    let seed = 7;
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ALONG.forEach((d, i) => {
      const x = a.x + dx * d + dz * ASIDE[i];
      const z = a.z + dz * d - dx * ASIDE[i];
      const stems: Stem[] = [];
      for (let s = 0; s < STEMS; s++) {
        const r = 0.2 + rand() * 0.5;
        const t = rand() * Math.PI * 2;
        const sx = x + Math.cos(t) * r;
        const sz = z + Math.sin(t) * r;
        stems.push({
          x: sx, y: heightAt(sx, sz) - 0.05, z: sz, yaw: rand() * Math.PI * 2, height: 1.8 + rand() * 0.6,
          lean: new THREE.Vector2(), leanSpeed: new THREE.Vector2(), swing: new THREE.Vector2(), swingSpeed: new THREE.Vector2(),
          phase: rand() * 10,
        });
      }
      this.clumps.push({ x, z, note: NOTES[i], stems, rangAt: -Infinity, sweptAt: -Infinity, brushed: false });
    });
    const count = ALONG.length * STEMS;
    this.stems = new THREE.InstancedMesh(new THREE.TubeGeometry(STEM_PATH, 24, 0.011, 5), material('#4f6a3a', '#6f8a4a', 0, 1, 0.25), count);
    this.bells = new THREE.InstancedMesh(bellGeometry(), material('#6c78cf', '#b9c2f4', -0.02, -0.2, 0.7), count);
    for (const mesh of [this.stems, this.bells]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
    }
    this.group.name = 'harebells';
  }

  /** The middle of the row, for whoever wants to know where it is. */
  get middle(): { x: number; z: number } {
    const c = this.clumps[Math.floor(this.clumps.length / 2)];
    return { x: c.x, z: c.z };
  }

  update(dt: number, time: number, camera: THREE.Camera, wind: WindField, input: PointerInput,
    out: AudioOut | null, brushers: readonly (THREE.Vector3 | null)[], active: boolean): void {
    this.now = time;
    if (active) this.listen(camera, input, out, brushers);
    if (this.answerAt > 0 && time > this.answerAt) {
      const i = this.clumps.length - 1 - this.answered;
      const order = this.answerDown ? i : this.answered;
      this.ring(this.clumps[order], out, 0.75, camera);
      this.answerAt = ++this.answered < this.clumps.length ? time + ANSWER_GAP : -1;
    }
    let n = 0;
    for (const c of this.clumps) {
      const w = wind.sample(c.x, c.z, this.sample);
      for (const s of c.stems) {
        // The stem leans with the air and springs back; the bell on it swings on its own, a little behind.
        const sway = Math.sin(time * 1.3 + s.phase) * 0.03 * (0.4 + Math.min(1, Math.hypot(w.x, w.z) * 0.2));
        spring(s.lean, s.leanSpeed, THREE.MathUtils.clamp(w.z * 0.035, -0.4, 0.4) + sway,
          THREE.MathUtils.clamp(-w.x * 0.035, -0.4, 0.4) + sway * 0.6, 26, 4, dt);
        spring(s.swing, s.swingSpeed, s.lean.x * 0.8, s.lean.y * 0.8, 40, 2.2, dt);
        this.e.set(s.lean.x, 0, s.lean.y, 'XYZ');
        this.q.setFromEuler(this.e);
        this.e.set(0, s.yaw, 0, 'YXZ');
        this.q.multiply(this.turn.setFromEuler(this.e));
        this.at.set(s.x, s.y, s.z);
        this.size.setScalar(s.height);
        this.m.compose(this.at, this.q, this.size);
        this.stems.setMatrixAt(n, this.m);
        this.tip.copy(TIP).applyMatrix4(this.m);
        this.e.set(s.swing.x, s.yaw, s.swing.y, 'YXZ');
        this.q.setFromEuler(this.e);
        this.size.copy(this.one).multiplyScalar(1.3 + s.height * 0.4);
        this.m.compose(this.tip, this.q, this.size);
        this.bells.setMatrixAt(n, this.m);
        n++;
      }
    }
    this.stems.instanceMatrix.needsUpdate = true;
    this.bells.instanceMatrix.needsUpdate = true;
  }

  /** A stroke crossing a clump on screen rings it; so does the child walking through it, or the plane coming down in it. */
  private listen(camera: THREE.Camera, input: PointerInput, out: AudioOut | null, brushers: readonly (THREE.Vector3 | null)[]): void {
    const stroke = input.present && !input.muted && input.gust > tuning.pointer.minGust;
    for (const c of this.clumps) {
      const ground = heightAt(c.x, c.z);
      const brushed = brushers.some((b) => !!b && b.y < ground + 2.6 && Math.hypot(b.x - c.x, b.z - c.z) < BRUSHED);
      const entered = brushed && !c.brushed;
      c.brushed = brushed;
      if (this.now - c.rangAt < REST) continue;
      this.at.set(c.x, ground + 1, c.z);
      if (stroke && screenBrush(camera, this.at, input.prevNdc, input.ndc, BRUSH) > 0.02) {
        c.sweptAt = this.now;
        this.ring(c, out, Math.min(1, 0.55 + input.gust * 0.04), camera);
        this.phrase();
      } else if (entered) {
        this.ring(c, out, 0.4, camera);
      }
    }
  }

  /** All of them, one after another along the row, inside one breath: the row sings it back the other way. */
  private phrase(): void {
    if (this.answerAt > 0) return;
    const times = this.clumps.map((c) => c.sweptAt);
    if (times.some((t) => this.now - t > PHRASE_WITHIN)) return;
    const up = times.every((t, i) => i === 0 || t >= times[i - 1]);
    const down = times.every((t, i) => i === 0 || t <= times[i - 1]);
    if (!up && !down) return;
    for (const c of this.clumps) c.sweptAt = -Infinity;
    this.answerDown = up;
    this.answered = 0;
    this.answerAt = this.now + ANSWER_AFTER;
  }

  private ring(c: Clump, out: AudioOut | null, level: number, camera: THREE.Camera): void {
    c.rangAt = this.now;
    for (const s of c.stems) {
      s.swingSpeed.x += (Math.random() - 0.5) * 6 * level;
      s.swingSpeed.y += (Math.random() - 0.3) * 6 * level;
    }
    this.heard.set(c.x, heightAt(c.x, c.z) + 1.2, c.z);
    this.heardAt = this.now;
    if (!out) return;
    const at = this.at.set(c.x, heightAt(c.x, c.z) + 1, c.z).project(camera);
    chime(out, c.note, level, THREE.MathUtils.clamp(at.x, -0.8, 0.8));
  }
}

function spring(v: THREE.Vector2, speed: THREE.Vector2, tx: number, ty: number, stiffness: number, damping: number, dt: number): void {
  speed.x += ((tx - v.x) * stiffness - speed.x * damping) * dt;
  speed.y += ((ty - v.y) * stiffness - speed.y * damping) * dt;
  v.x += speed.x * dt;
  v.y += speed.y * dt;
}

/** A small glassy bell: a clear fundamental, a high inharmonic shimmer, and a long soft tail into the reverb. */
function chime(out: AudioOut, midi: number, level: number, pan: number): void {
  const { ctx } = out;
  const when = ctx.currentTime + 0.01;
  const f = 440 * 2 ** ((midi - 69) / 12);
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  panner.connect(out.bus);
  panner.connect(wet).connect(out.reverb);
  const partials: [number, number, number][] = [[1, 1, 2.6], [2.76, 0.16, 0.9], [5.4, 0.05, 0.4]];
  let left = partials.length;
  for (const [ratio, amp, decay] of partials) {
    const o = ctx.createOscillator();
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level * amp * 0.07, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    o.connect(g).connect(panner);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      if (--left === 0) { panner.disconnect(); wet.disconnect(); }
    };
    o.start(when);
    o.stop(when + decay + 0.05);
  }
}

export const harebells = new Harebells();
