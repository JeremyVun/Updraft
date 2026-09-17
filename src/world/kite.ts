import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';

/** Where the kite is now, so the story can have the child look up at it without having to own one. */
export const KITE_AT = new THREE.Vector3();

const PAPER_VERT = /* glsl */ `
in vec3 aPaper;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vPaper;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPaper = aPaper;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The same notebook page the paper plane is folded from: faint rules, and one red line down the margin. */
const PAPER_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vPaper;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vec3(0.96, 0.93, 0.87);
  float rule = 1.0 - smoothstep(0.004, 0.02, abs(fract(vPaper.y * 8.0) - 0.5));
  alb = mix(alb, vec3(0.62, 0.72, 0.9), rule * 0.45);
  float margin = 1.0 - smoothstep(0.004, 0.018, abs(vPaper.x - 0.7));
  alb = mix(alb, vec3(0.71, 0.21, 0.17), max(margin * 0.85, vPaper.z));
  float ndl = dot(N, uSunDir);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float through = max(-ndl, 0.0) * 0.5;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = alb * (hemiLight(N) * 1.05 + uSunColor * (max(ndl, 0.0) * 0.65 + through * 0.8) * sun) + uSunColor * rim * 0.18;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const DRIFT_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const DRIFT_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  vec3 wood = vec3(0.55, 0.51, 0.45) * (0.76 + vnoise(vWorld.xz * 9.0 + vWorld.y * 16.0) * 0.46);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = wood * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.7 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** A line of one thickness in the air, kept at least a pixel wide so it never breaks up at distance. */
const CORD_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTangent;
in float aEdge;
out vec3 vWorld;
void main() {
  vec3 toCam = cameraPosition - position;
  float away = length(toCam);
  vec3 c = cross(aTangent, toCam / max(away, 0.001));
  vec3 side = c / max(length(c), 1e-4);
  vWorld = position + side * aEdge * max(0.02, away * 0.0016);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const CORD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
void main() {
  vec3 col = vec3(0.84, 0.8, 0.72) * (hemiLight(vec3(0.0, 1.0, 0.0)) + uSunColor * 0.35);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Local space: +y is the nose, +z the face the wind pushes on. The paper is bowed back off its two spars. */
const NOSE = 1.45;
const FOOT = 1.25;
const HALF = 0.82;
const SHOULDER = 0.2;
const BOWS = 6;
const TAIL_POINTS = 14;
const TAIL_LENGTH = 5.2;
const CORD_POINTS = 18;
const UP = new THREE.Vector3(0, 1, 0);

function sailGeometry(): THREE.BufferGeometry {
  const nose: [number, number, number] = [0, NOSE, 0];
  const left: [number, number, number] = [-HALF, SHOULDER, 0];
  const right: [number, number, number] = [HALF, SHOULDER, 0];
  const foot: [number, number, number] = [0, -FOOT, 0];
  const belly: [number, number, number] = [0, SHOULDER, -0.19];
  const tris = [nose, left, belly, nose, belly, right, left, foot, belly, belly, foot, right];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  geo.setAttribute('aPaper', new THREE.BufferAttribute(new Float32Array(tris.flatMap(([x, y]) => [0.5 + x * 0.42, 0.5 + y * 0.3, 0])), 3));
  geo.computeVertexNormals();
  return geo;
}

/** The two sticks the paper is stretched over, standing a little proud of it. */
function sparGeometry(): THREE.BufferGeometry {
  const spine = new THREE.BoxGeometry(0.035, NOSE + FOOT, 0.03).translate(0, (NOSE - FOOT) / 2, 0.025);
  const cross = new THREE.BoxGeometry(HALF * 2, 0.03, 0.03).translate(0, SHOULDER, 0.025);
  return mergeGeometries([spine, cross]);
}

/** A camera-facing strip rebuilt on the CPU each frame: the kite's string. */
class Cord {
  readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly tangents: Float32Array;
  private readonly geo = new THREE.BufferGeometry();
  private readonly tmp = new THREE.Vector3();

  constructor(count: number) {
    this.positions = new Float32Array(count * 6);
    this.tangents = new Float32Array(count * 6);
    const edges = new Float32Array(count * 2);
    const index = new Uint16Array((count - 1) * 6);
    for (let i = 0; i < count; i++) {
      edges[i * 2] = -1;
      edges[i * 2 + 1] = 1;
    }
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aTangent', new THREE.BufferAttribute(this.tangents, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
    this.geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: CORD_VERT, fragmentShader: CORD_FRAG, side: THREE.DoubleSide }),
    );
    this.mesh.frustumCulled = false;
  }

  update(points: readonly THREE.Vector3[]): void {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      this.tmp.subVectors(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]).normalize();
      for (let s = 0; s < 2; s++) {
        const o = (i * 2 + s) * 3;
        this.positions[o] = p.x;
        this.positions[o + 1] = p.y;
        this.positions[o + 2] = p.z;
        this.tangents[o] = this.tmp.x;
        this.tangents[o + 1] = this.tmp.y;
        this.tangents[o + 2] = this.tmp.z;
      }
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('aTangent').needsUpdate = true;
  }
}

/**
 * One kite, flying with nobody holding it, its string tied off to driftwood beside the boat on the far beach.
 * A sky full of kites would be a festival, and a festival has people at it; one is a child who has gone.
 *
 * It flies on the live wind sampled where it is: the breeze holds it out over the water, a gust lifts it and
 * hardens the string, and a dead calm only lets it sink and hang on what there is. It cannot crash, tangle or
 * need fetching, because the string is both its floor and its ceiling, so the player can shove it as hard as
 * they like. From the crest and from down in the alley it stands over the far beach, which is how the way on
 * is marked without anybody being told.
 */
export class Kite {
  readonly group = new THREE.Group();
  private readonly anchor = new THREE.Vector3();
  private readonly sail = new THREE.Group();
  private readonly cord = new Cord(CORD_POINTS);
  private readonly cordPoints: THREE.Vector3[] = [];
  private readonly tailBatch = new RibbonBatch(TAIL_POINTS, '#f0e7d4', 0.95);
  private readonly ribbon: Ribbon;
  private readonly bows: THREE.Mesh;
  private readonly bowPos: Float32Array;
  private readonly bowNormals: Float32Array;
  private readonly tail: THREE.Vector3[] = [];
  private readonly was: THREE.Vector3[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly basis = new THREE.Matrix4();
  private readonly xAxis = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3();
  private readonly zAxis = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly c = new THREE.Vector3();
  private azimuth = 1.9;
  private elev = 0.57;
  private elevVel = 0;
  private reach = 0.75;
  private roll = 0;
  private phase = 0;
  private asleep = true;

  constructor(
    private readonly wind: WindField,
    berth: THREE.Vector3,
  ) {
    /** West of the boat and a little south of it, where the sand goes over into grass. */
    const x = berth.x - 11;
    const z = berth.z + 3;
    const ground = Math.max(heightAt(x, z), 0);
    this.anchor.set(x, ground + 1.05, z);

    const drift = new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: DRIFT_VERT, fragmentShader: DRIFT_FRAG });
    const post = new THREE.CylinderGeometry(0.075, 0.095, 1.3, 6).rotateZ(0.16).translate(x, ground + 0.52, z);
    const log = new THREE.CylinderGeometry(0.16, 0.13, 1.8, 6).rotateZ(Math.PI / 2).rotateY(0.6).translate(x + 0.8, ground + 0.12, z + 0.55);
    this.group.add(new THREE.Mesh(mergeGeometries([post, log]), drift));

    const paper = new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: PAPER_VERT, fragmentShader: PAPER_FRAG, side: THREE.DoubleSide });
    this.sail.add(new THREE.Mesh(sailGeometry(), paper));
    this.sail.add(new THREE.Mesh(sparGeometry(), drift));
    this.group.add(this.sail);
    this.group.add(this.cord.mesh);
    this.group.add(this.tailBatch.mesh);

    for (let i = 0; i < CORD_POINTS; i++) this.cordPoints.push(new THREE.Vector3());
    for (let i = 0; i < TAIL_POINTS; i++) {
      this.tail.push(new THREE.Vector3());
      this.was.push(new THREE.Vector3());
    }
    this.ribbon = { points: this.tail, alpha: 1, width: 0.09 };

    this.bowPos = new Float32Array(BOWS * 18);
    this.bowNormals = new Float32Array(BOWS * 18);
    const paperOf = new Float32Array(BOWS * 18);
    for (let i = 0; i < BOWS * 6; i++) {
      /** Every third bow is cut from the red the door is painted, and the rest are plain page. */
      paperOf[i * 3] = 0.25;
      paperOf[i * 3 + 1] = 0.3 + ((i / 6) | 0) * 0.09;
      paperOf[i * 3 + 2] = ((i / 6) | 0) % 3 === 1 ? 0.8 : 0;
    }
    const bowGeo = new THREE.BufferGeometry();
    bowGeo.setAttribute('position', new THREE.BufferAttribute(this.bowPos, 3).setUsage(THREE.DynamicDrawUsage));
    bowGeo.setAttribute('normal', new THREE.BufferAttribute(this.bowNormals, 3).setUsage(THREE.DynamicDrawUsage));
    bowGeo.setAttribute('aPaper', new THREE.BufferAttribute(paperOf, 3));
    bowGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.bows = new THREE.Mesh(bowGeo, paper);
    this.bows.frustumCulled = false;
    this.group.add(this.bows);
    KITE_AT.copy(this.anchor).add(this.a.set(0, 14, -6));
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const away = Math.hypot(camera.position.x - this.anchor.x, camera.position.z - this.anchor.z);
    this.group.visible = away < 300;
    if (!this.group.visible || dt < 1e-4) {
      this.asleep = this.asleep || !this.group.visible;
      return;
    }
    const k = tuning.linesToys;
    const air = this.wind.sample(KITE_AT.x, KITE_AT.z, this.sample);
    const speed = Math.hypot(air.x, air.z);
    const strength = THREE.MathUtils.smoothstep(speed, 0.4, 9);

    if (speed > 0.25) {
      const turn = Math.atan2(air.x, air.z) - this.azimuth;
      this.azimuth += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-dt * 0.55));
    }
    /** A kite never hangs still: it wanders a slow figure of eight, and the harder it blows the wider it swings. */
    const rate = k.swoopRate + strength * 0.22;
    this.phase += dt * rate;
    const swing = k.swoop * (0.35 + 0.65 * strength);
    const bank = Math.cos(this.phase) * swing * rate;

    /** Gust energy is the pull you feel in the string: it climbs on it, overshoots, and settles back. */
    const want = 0.52 + 0.24 * strength + Math.min(0.26, air.energy * k.gustClimb + air.lift * 0.08) + Math.cos(this.phase * 2) * swing * 0.3;
    this.elevVel += (want - this.elev) * k.climbSpring * dt;
    this.elevVel *= Math.exp(-dt * k.climbDamping);
    this.elev = THREE.MathUtils.clamp(this.elev + this.elevVel * dt, 0.12, 1.05);
    const taut = 0.72 + 0.25 * THREE.MathUtils.smoothstep(speed + air.energy * 4, 1, 12);
    this.reach += (taut - this.reach) * (1 - Math.exp(-dt * 1.4));
    this.roll += (bank - this.roll) * (1 - Math.exp(-dt * 2.5));

    const flown = this.azimuth + Math.sin(this.phase) * swing;
    const span = k.stringLength * this.reach;
    const flat = Math.cos(this.elev) * span;
    KITE_AT.set(this.anchor.x + Math.sin(flown) * flat, this.anchor.y + Math.sin(this.elev) * span, this.anchor.z + Math.cos(flown) * flat);
    /** Whatever the player does to it, it stays in the air: the string is the only thing holding it down. */
    KITE_AT.y = Math.max(KITE_AT.y, Math.max(heightAt(KITE_AT.x, KITE_AT.z), 0) + 2.5);

    this.face();
    if (this.asleep) {
      this.asleep = false;
      this.settle(air.x, air.z);
    }
    this.streamTail(dt, time, air, speed);
    this.runCord(time, span, speed);
  }

  /** Nose up the string, belly into the wind, banked into whichever way it is swinging. */
  private face(): void {
    this.yAxis.subVectors(KITE_AT, this.anchor).normalize();
    this.xAxis.copy(this.yAxis).cross(UP).normalize();
    this.zAxis.crossVectors(this.xAxis, this.yAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    this.sail.position.copy(KITE_AT);
    this.sail.quaternion.setFromRotationMatrix(this.basis);
    this.sail.rotateY(this.roll * 0.6);
    this.sail.rotateZ(-this.roll);
    this.sail.updateMatrixWorld();
  }

  /** Lays the tail out downwind, for the first frame after the island comes back into view. */
  private settle(wx: number, wz: number): void {
    const step = TAIL_LENGTH / (TAIL_POINTS - 1);
    this.a.set(wx, -2.5, wz).normalize().multiplyScalar(step);
    this.tail[0].copy(this.sail.localToWorld(this.b.set(0, -FOOT, 0)));
    this.was[0].copy(this.tail[0]);
    for (let i = 1; i < TAIL_POINTS; i++) {
      this.tail[i].copy(this.tail[i - 1]).add(this.a);
      this.was[i].copy(this.tail[i]);
    }
  }

  /**
   * The tail streams where the air is going, falls where it is not, and snaps across itself as it goes. Verlet
   * with the links pulled straight after: it cannot stretch, and it cannot blow up either.
   */
  private streamTail(dt: number, time: number, air: WindSample, speed: number): void {
    const step = TAIL_LENGTH / (TAIL_POINTS - 1);
    this.tail[0].copy(this.sail.localToWorld(this.b.set(0, -FOOT, 0)));
    this.was[0].copy(this.tail[0]);
    this.c.set(-air.z, 0, air.x);
    if (this.c.lengthSq() < 1e-6) this.c.set(1, 0, 0);
    this.c.normalize();
    const lash = 0.8 + speed * 0.55;
    for (let i = 1; i < TAIL_POINTS; i++) {
      const p = this.tail[i];
      const q = this.was[i];
      const vx = (p.x - q.x) / dt;
      const vy = (p.y - q.y) / dt;
      const vz = (p.z - q.z) / dt;
      const wag = Math.sin(time * 7 + i * 0.9) * lash;
      q.copy(p);
      p.x += vx * dt * 0.99 + ((air.x - vx) * 3.4 + this.c.x * wag) * dt * dt;
      p.y += vy * dt * 0.99 + ((air.lift * 1.6 - vy) * 3.4 - 5.4) * dt * dt;
      p.z += vz * dt * 0.99 + ((air.z - vz) * 3.4 + this.c.z * wag) * dt * dt;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < TAIL_POINTS; i++) {
        this.a.subVectors(this.tail[i], this.tail[i - 1]);
        const d = this.a.length() || 1;
        this.tail[i].copy(this.tail[i - 1]).addScaledVector(this.a, step / d);
      }
    }
    this.tailBatch.update([this.ribbon]);
    this.dressTail();
  }

  /** Paper bows pinched onto the tail at intervals, turned to the eye so they flash as the tail turns over. */
  private dressTail(): void {
    for (let i = 0; i < BOWS; i++) {
      const at = 1 + i * 2;
      const p = this.tail[at];
      this.a.subVectors(this.tail[Math.min(TAIL_POINTS - 1, at + 1)], this.tail[at - 1]).normalize();
      this.b.crossVectors(UP, this.a);
      if (this.b.lengthSq() < 1e-6) this.b.set(1, 0, 0);
      this.b.normalize();
      this.c.crossVectors(this.a, this.b).normalize();
      const o = i * 18;
      for (let s = 0; s < 2; s++) {
        const dir = s === 0 ? -1 : 1;
        for (let v = 0; v < 3; v++) {
          const j = o + s * 9 + v * 3;
          const out = v === 2 ? 0 : 0.23 * dir;
          const along = v === 0 ? 0.15 : v === 1 ? -0.15 : 0;
          this.bowPos[j] = p.x + this.b.x * out + this.a.x * along;
          this.bowPos[j + 1] = p.y + this.b.y * out + this.a.y * along;
          this.bowPos[j + 2] = p.z + this.b.z * out + this.a.z * along;
          this.bowNormals[j] = this.c.x;
          this.bowNormals[j + 1] = this.c.y;
          this.bowNormals[j + 2] = this.c.z;
        }
      }
    }
    this.bows.geometry.getAttribute('position').needsUpdate = true;
    this.bows.geometry.getAttribute('normal').needsUpdate = true;
  }

  /** The string hangs in its own weight and comes straight as the kite pulls: the slack is the whole story. */
  private runCord(time: number, span: number, speed: number): void {
    this.b.copy(this.sail.localToWorld(this.c.set(0, 0.05, -0.12)));
    const sag = Math.max(0, tuning.linesToys.stringLength - span) * 0.42;
    const shiver = Math.min(0.09, speed * 0.008);
    for (let i = 0; i < CORD_POINTS; i++) {
      const t = i / (CORD_POINTS - 1);
      const p = this.cordPoints[i];
      p.lerpVectors(this.anchor, this.b, t);
      const bow = Math.pow(Math.sin(t * Math.PI), 1.15);
      p.y -= sag * bow;
      p.x += Math.sin(t * 9 - time * 4.2) * shiver * bow;
      p.z += Math.cos(t * 9 - time * 4.2) * shiver * bow;
    }
    this.cord.update(this.cordPoints);
  }
}
