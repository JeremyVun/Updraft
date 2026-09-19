import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import { tuning } from '../tuning';
import { Sway, feltWind, type WindField, type WindSample } from '../wind/field';
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

/**
 * Notebook paper on two sticks. `vPaper.xy` is the place on the kite itself, so the sail carries the one thing
 * that says kite and not paper plane at any distance: a cross of spars, and the foot of it cut from the faded
 * red the door is painted. `vPaper.z` marks the bows on the tail that are cut from the same red.
 */
const PAPER_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vPaper;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vec3(0.93, 0.89, 0.81);
  float rule = 1.0 - smoothstep(0.006, 0.03, abs(fract(vPaper.y * 2.4) - 0.5));
  alb = mix(alb, vec3(0.62, 0.72, 0.9), rule * 0.4);
  float red = max(smoothstep(0.06, -0.12, vPaper.y), vPaper.z);
  alb = mix(alb, vec3(0.56, 0.17, 0.13), red);
  float spine = 1.0 - smoothstep(0.045, 0.085, abs(vPaper.x));
  float cross = 1.0 - smoothstep(0.045, 0.085, abs(vPaper.y));
  alb = mix(alb, vec3(0.40, 0.34, 0.26), max(spine, cross) * 0.8 * (1.0 - vPaper.z));
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
  vWorld = position + side * aEdge * max(0.012, away * 0.0007);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const CORD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
void main() {
  vec3 col = vec3(0.7, 0.66, 0.58) * (hemiLight(vec3(0.0, 1.0, 0.0)) + uSunColor * 0.3);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Local space: the origin is where the two spars cross, +y is the nose, +z the face the wind pushes on. Short
 * above the cross and long below it, which is the shape everybody draws when they draw a kite.
 */
const NOSE = 1.6;
const FOOT = 2.9;
const HALF = 1.72;
const BOWS = 7;
const TAIL_POINTS = 16;
const TAIL_LENGTH = 9;
const CORD_POINTS = 18;
const UP = new THREE.Vector3(0, 1, 0);

function sailGeometry(): THREE.BufferGeometry {
  const nose: [number, number, number] = [0, NOSE, 0];
  const left: [number, number, number] = [-HALF, 0, 0];
  const right: [number, number, number] = [HALF, 0, 0];
  const foot: [number, number, number] = [0, -FOOT, 0];
  const belly: [number, number, number] = [0, 0, -0.26];
  const tris = [nose, left, belly, nose, belly, right, left, foot, belly, belly, foot, right];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  geo.setAttribute('aPaper', new THREE.BufferAttribute(new Float32Array(tris.flatMap(([x, y]) => [x, y, 0])), 3));
  geo.computeVertexNormals();
  return geo;
}

/** The two sticks the paper is stretched over, standing a little proud of it. */
function sparGeometry(): THREE.BufferGeometry {
  const spine = new THREE.BoxGeometry(0.05, NOSE + FOOT, 0.04).translate(0, (NOSE - FOOT) / 2, 0.035);
  const cross = new THREE.BoxGeometry(HALF * 2, 0.045, 0.04).translate(0, 0, 0.035);
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
  private readonly ribbons: Ribbon[];
  private readonly bows: THREE.Mesh;
  private readonly bowPos: Float32Array;
  private readonly bowNormals: Float32Array;
  private readonly tail: THREE.Vector3[] = [];
  private readonly was: THREE.Vector3[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  /** It flies on the wind it feels, on the same spring as the washing, so a gust reaches it when the gust does. */
  private readonly sway = new Sway();
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
  /** How far round its string it has swung to show its face, in radians. */
  private shown = 0;
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
    this.ribbon = { points: this.tail, alpha: 1, width: 0.16 };
    this.ribbons = [this.ribbon];

    this.bowPos = new Float32Array(BOWS * 18);
    this.bowNormals = new Float32Array(BOWS * 18);
    const paperOf = new Float32Array(BOWS * 18);
    for (let i = 0; i < BOWS * 6; i++) {
      /** Every other bow is cut from the red the door is painted, and the rest are plain page. */
      paperOf[i * 3] = 0.6;
      paperOf[i * 3 + 1] = 1;
      paperOf[i * 3 + 2] = ((i / 6) | 0) % 2 === 1 ? 1 : 0;
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

  /** Where it is in the sky, for the story and for QA. */
  get position(): THREE.Vector3 {
    return KITE_AT;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const away = Math.hypot(camera.position.x - this.anchor.x, camera.position.z - this.anchor.z);
    this.group.visible = away < 300;
    if (!this.group.visible) {
      this.asleep = true;
      return;
    }
    if (dt < 1e-4) return;
    const k = tuning.linesToys;
    const air = feltWind(this.wind.sample(KITE_AT.x, KITE_AT.z, this.sample), this.wind.calm);
    this.sway.update(air.x, air.z, dt);
    air.x = this.sway.x;
    air.z = this.sway.z;
    const speed = Math.hypot(air.x, air.z);
    const strength = THREE.MathUtils.smoothstep(speed, 0.5, 5);

    if (speed > 0.25) {
      const turn = Math.atan2(air.x, air.z) - this.azimuth;
      this.azimuth += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-dt * 0.55));
    }
    /** A kite never hangs still: it wanders a slow figure of eight, and the harder it blows the wider it swings. */
    const rate = k.swoopRate + strength * 0.22;
    this.phase += dt * rate;
    const swing = k.swoop * (0.55 + 0.45 * strength);
    const bank = Math.cos(this.phase) * swing * rate;

    /**
     * Gust energy is the pull you feel in the string: it climbs on it, overshoots and settles back. And in a
     * real calm nothing is holding it up at all, so it sinks and hangs on whatever breeze is left.
     */
    const holding = 0.4 + 0.6 * THREE.MathUtils.smoothstep(speed, 0.05, 0.5);
    const want = (k.flyAngle + 0.1 * strength + Math.min(0.26, air.energy * k.gustClimb + air.lift * 0.08)) * holding + Math.cos(this.phase * 2) * swing * 0.18;
    this.elevVel += (want - this.elev) * k.climbSpring * dt;
    this.elevVel *= Math.exp(-dt * k.climbDamping);
    this.elev = THREE.MathUtils.clamp(this.elev + this.elevVel * dt, 0.12, 1.0);
    const taut = 0.72 + 0.25 * THREE.MathUtils.smoothstep(speed + air.energy * 4, 1, 12);
    this.reach += (taut - this.reach) * (1 - Math.exp(-dt * 1.4));
    this.roll += (bank - this.roll) * (1 - Math.exp(-dt * 2.5));

    const flown = this.azimuth + Math.sin(this.phase) * swing;
    const span = k.stringLength * this.reach;
    const flat = Math.cos(this.elev) * span;
    KITE_AT.set(this.anchor.x + Math.sin(flown) * flat, this.anchor.y + Math.sin(this.elev) * span, this.anchor.z + Math.cos(flown) * flat);
    /** Whatever the player does to it, it stays in the air: the string is the only thing holding it down. */
    KITE_AT.y = Math.max(KITE_AT.y, Math.max(heightAt(KITE_AT.x, KITE_AT.z), 0) + FOOT + 1.2);

    this.face(dt, camera);
    if (this.asleep) {
      this.asleep = false;
      this.settle(air.x, air.z);
    }
    this.streamTail(dt, time, air, speed);
    this.runCord(time, span, speed);
  }

  /** Nose up the string, belly into the wind, banked into whichever way it is swinging. */
  private face(dt: number, camera: THREE.Camera): void {
    this.yAxis.subVectors(KITE_AT, this.anchor).normalize();
    this.xAxis.copy(this.yAxis).cross(UP).normalize();
    this.zAxis.crossVectors(this.xAxis, this.yAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    /**
     * And it swings round on its string until it is showing its face to whoever is watching. A kite edge-on is a
     * white sliver, which is the one thing this one must never be: it is here to be recognised from the crest.
     */
    this.a.subVectors(camera.position, KITE_AT);
    const want = Math.atan2(this.a.dot(this.xAxis), Math.max(this.a.dot(this.zAxis), 0.001));
    this.shown += (THREE.MathUtils.clamp(want, -0.95, 0.95) - this.shown) * (1 - Math.exp(-dt * 0.9));
    this.sail.position.copy(KITE_AT);
    this.sail.quaternion.setFromRotationMatrix(this.basis);
    this.sail.rotateY(this.shown + this.roll * 0.6);
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
    /** Paper on a string has almost no weight and all drag: it goes where the air goes, and quickly. */
    const lash = 2 + speed * 1.2;
    for (let i = 1; i < TAIL_POINTS; i++) {
      const p = this.tail[i];
      const q = this.was[i];
      const vx = (p.x - q.x) / dt;
      const vy = (p.y - q.y) / dt;
      const vz = (p.z - q.z) / dt;
      const wag = Math.sin(time * 6 + i * 0.9) * lash;
      q.copy(p);
      p.x += vx * dt * 0.99 + ((air.x - vx) * 8 + this.c.x * wag) * dt * dt;
      p.y += vy * dt * 0.99 + ((air.lift * 1.6 - vy) * 8 - 3.4) * dt * dt;
      p.z += vz * dt * 0.99 + ((air.z - vz) * 8 + this.c.z * wag) * dt * dt;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < TAIL_POINTS; i++) {
        this.a.subVectors(this.tail[i], this.tail[i - 1]);
        const d = this.a.length() || 1;
        this.tail[i].copy(this.tail[i - 1]).addScaledVector(this.a, step / d);
      }
    }
    this.tailBatch.update(this.ribbons);
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
          const out = v === 2 ? 0 : 0.52 * dir;
          const along = v === 0 ? 0.3 : v === 1 ? -0.3 : 0;
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
