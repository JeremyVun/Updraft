import { mirrorWater } from '../world/sky-mirror-layout';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glsl, tuning } from '../tuning';
import { Sway, feltWind, type WindField, type WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { FOAM, Marks } from '../fx/sealife/marks';
import { heightAt } from '../world/island';
import { type Swell, swellAt } from '../world/water/swell';

const LENGTH = 4.8;
const BEAM = 0.95;
const DEPTH = 0.62;
/** Floorboards, laid across the ribs. They sit above the waterline, so the sea is never seen inside the hull. */
const FLOOR_Y = -0.24;
/** How deep the hull floats: local y 0 rides this far above the sea, putting the waterline below the floorboards. */
const DRAFT = 0.42;
/**
 * Pushed off a beach, a boat goes out the way the sand slopes, whichever way its bow is pointing, and is brought
 * round by hand before the sail can take it: how fast it drifts out, how fast it comes round, how nearly it has
 * to be pointing the right way before it is sailed, and the longest it is ever held like that.
 */
const PUSH_OFF_SPEED = 1.4;
const PUSH_OFF_TURN = 0.55;
const PUSH_OFF_UNTIL = 0.7;
const PUSH_OFF_LONGEST = 8;
/** How fast it can be steered round under sail: nimble with no way on, and a wide slow curve at speed. */
const TURN_SLOW = 0.5;
const TURN_FAST = 0.25;
/**
 * How the sail is cut: the foot from mast to clew, the luff from tack to head, how far it narrows toward the
 * head, how far the foot rises to the clew and how high the tack sits. The shader cuts the same cloth from these
 * numbers, so the mesh only has to carry the uv and a shape to be measured for.
 */
const SAIL_SPAN = 2.7;
const SAIL_HOIST = 3.7;
const SAIL_TAPER = 0.55;
const SAIL_RISE = 0.35;
const SAIL_TACK = 0.75;

const HULL_VERT = /* glsl */ `
in vec3 color;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HULL_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float plank = (1.0 - smoothstep(0.0, 0.02, abs(fract(vLocal.y * 5.5 + 0.5) - 0.5) - 0.44));
  float grain = vnoise(vec2(vLocal.z * 3.0, vLocal.y * 22.0)) * 0.18;
  vec3 alb = vColor * (0.9 + grain) * (1.0 - plank * 0.35) * (gl_FrontFacing ? 1.0 : 0.72);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float sun = cloudShadow(vWorld.xz);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0) * max(dot(-V, uSunDir), 0.0);
  vec3 col = alb * (harbourLight(vWorld) + hemiLight(N) + uSunColor * wrap * wrap * sun * 0.9) + uSunColor * rim * 0.12 * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The patchwork sail: quilt squares in faded colours, stitched, billowing with the wind and glowing when backlit. */
const SAIL_VERT = /* glsl */ `
uniform float uFill;
uniform float uFlutter;
uniform float uRipplePhase;
uniform float uLuff;
uniform float uDroop;
uniform float uShelter;
uniform float uTime;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;

/**
 * Where a point of the cloth is, across the sail from the mast (s) and up it from the boom (t). With wind in it
 * the sail bellies and a ripple travels out to the leech; with none the leech falls in toward the mast and the
 * cloth it gives up hangs in slow vertical folds.
 */
vec3 cloth(vec2 st) {
  float s = st.x;
  float t = st.y;
  float cut = s * (1.0 - uDroop * s * mix(${glsl(tuning.sail.gather)}, ${glsl(tuning.opening.sailGather)}, uShelter));
  vec3 p = vec3(
    -cut * ${glsl(SAIL_SPAN)} * (1.0 - t * ${glsl(SAIL_TAPER)}),
    ${glsl(SAIL_TACK)} + t * ${glsl(SAIL_HOIST)} + cut * ${glsl(SAIL_RISE)},
    0.0);
  p.y -= uDroop * s * (0.4 + 0.6 * sin(t * 3.14159)) * mix(${glsl(tuning.sail.sag)}, ${glsl(tuning.opening.sailSag)}, uShelter);
  float folds = sin(s * ${glsl(tuning.sail.folds)} * 6.28318 + 1.1 + t * 0.7) * smoothstep(0.0, 0.2, s) * (0.3 + 0.7 * sin(t * 3.14159));
  float breathe = 0.7 + 0.3 * sin(uTime * 0.55 + t * 1.5);
  p.z += uDroop * (folds * breathe * ${glsl(tuning.sail.fold)} + s * sin(uTime * 0.4) * 0.08);
  /** A gust crossing the sail breaks along the free edge first: the leech shakes, then the belly fills again. */
  float leech = smoothstep(0.15, 1.0, s) * (0.4 + 0.6 * t);
  float belly = sin(s * 3.14159) * sin(t * 3.14159 * 0.9) * (1.0 - 0.3 * uLuff * leech);
  float ripple = sin(uRipplePhase - s * 6.5 + t * 3.0) * uFlutter * (0.25 + 0.75 * s * s);
  float shake = (uLuff + uFlutter * 0.35) * leech;
  p.z += belly * uFill + ripple * ${glsl(tuning.sail.ripple)} + sin(uTime * 19.0 - s * 12.0 + t * 4.0) * shake * ${glsl(tuning.sail.shake)};
  return p;
}

void main() {
  vec3 p = cloth(uv);
  /** The cloth is what it is doing, so the light on it is taken from the shape itself rather than guessed at. */
  vec3 pu = cloth(uv + vec2(0.012, 0.0));
  vec3 pv = cloth(uv + vec2(0.0, 0.012));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vUv = uv;
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normalize(cross(pv - p, pu - p)));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SAIL_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uScarf;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec2 cell = floor(vUv * vec2(4.0, 5.0));
  float pick = hash12(cell + 7.0);
  vec3 cloth = pick < 0.3 ? vec3(0.93, 0.88, 0.76) : pick < 0.52 ? vec3(0.82, 0.38, 0.3) : pick < 0.74 ? vec3(0.9, 0.7, 0.3) : pick < 0.9 ? vec3(0.5, 0.66, 0.78) : vec3(0.62, 0.74, 0.5);
  vec2 f = fract(vUv * vec2(4.0, 5.0));
  float seam = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  float stitch = seam * step(0.5, fract((vUv.x + vUv.y) * 60.0));
  cloth *= 1.0 - seam * 0.18 - stitch * 0.1;
  // The impossible scarf gathers into the sail, its red wool carried into the colder chapters.
  float woven = smoothstep(vUv.y * 0.75, vUv.y * 0.75 + 0.25, uScarf);
  vec3 wool = vec3(0.57, 0.023, 0.036) * (0.94 + 0.06 * sin(vUv.y * 100.0));
  cloth = mix(cloth, wool, woven);
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.45 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.25;
  float sun = cloudShadow(vWorld.xz);
  vec3 col = cloth * (harbourLight(vWorld) + hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.6 + through * 0.6) * sun);
  col += cloth * cloth * uSunColor * through * 0.35 * sun;
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

/** Hull shell: U-shaped sections along the length, a flat transom at the stern, rising to a point at the bow. */
function hull(): THREE.BufferGeometry {
  const U = 18;
  const T = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const width = (u: number) => BEAM * (1 - Math.pow(u, 3.2)) * (0.7 + 0.3 * Math.sin(u * Math.PI));
  const depth = (u: number) => DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI));
  const sheer = (u: number) => 0.28 * u * u;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const z = (u - 0.45) * LENGTH;
    for (let j = 0; j <= T; j++) {
      const th = (j / T) * Math.PI;
      const x = width(u) * Math.cos(th);
      const y = sheer(u) - depth(u) * Math.pow(Math.sin(th), 0.7) * (1 - 0.5 * u * u);
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = a + T + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const centre = pos.length / 3;
  pos.push(0, sheer(0) - depth(0) * 0.45, -0.45 * LENGTH);
  for (let j = 0; j < T; j++) idx.push(centre, j, j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The floorboards: a flat deck lofted to the inside of the hull at the height the boards are laid. */
function floorboards(): THREE.BufferGeometry {
  const U = 18;
  const pos: number[] = [];
  const idx: number[] = [];
  const width = (u: number) => BEAM * (1 - Math.pow(u, 3.2)) * (0.7 + 0.3 * Math.sin(u * Math.PI));
  const depth = (u: number) => DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI));
  const sheer = (u: number) => 0.28 * u * u;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    // At the narrow bow the shell rises above the main floor level. Follow it inside the hull.
    const floor = Math.max(FLOOR_Y, sheer(u) - depth(u) * (1 - 0.5 * u * u) + 0.02);
    const drop = (sheer(u) - floor) / (depth(u) * (1 - 0.5 * u * u));
    const sin = Math.min(1, Math.max(0, drop)) ** (1 / 0.7);
    const half = width(u) * Math.sqrt(Math.max(0, 1 - sin * sin));
    const z = (u - 0.45) * LENGTH;
    pos.push(-half, floor, z, half, floor, z);
  }
  for (let i = 0; i < U; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Enough of a grid for the cloth to hang in folds; the shader moves every point of it from its uv. */
function sailGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 18, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i) + 0.5;
    const t = pos.getY(i) + 0.5;
    pos.setXYZ(i, -s * SAIL_SPAN * (1 - t * SAIL_TAPER), SAIL_TACK + t * SAIL_HOIST + s * SAIL_RISE, 0);
  }
  return geo;
}

/**
 * The child's little boat. It waits on a beach, is pushed into the water, and then sails where it is steered,
 * driven by whatever wind fills its patchwork sail.
 */
export class Boat {
  scarfSail = 0;
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  /** A narrow passage can spill surplus wind without making its sail look becalmed. */
  speedLimit = Infinity;
  afloat = false;
  /** Where the child steers for; null lets it drift with the wind. */
  steerFor: THREE.Vector2 | null = null;
  /** True once the bow has run up onto a shore while sailing. */
  grounded = false;
  /** False while the route still passes close to land, so rounding a headland is not mistaken for arriving. */
  canGround = true;
  /** A berth to come alongside instead of a beach to run up: where the hull stops, and the way it lies there. */
  mooring: { x: number; z: number; yaw: number } | null = null;
  /**
   * How far the world's own wind has gone out of the sails, 0 normal to 1 dead calm. At 1 the boat has no way
   * of its own at all and only the wind the player makes moves it.
   */
  becalmed = 0;
  /** The opening cove shelters the sail from weather, while the player's gusts still reach it. */
  shelter = 0;
  /** How hard the sea is running under the hull, 0 calm to 1 the full squall; the boat rocks and drives on it. */
  swell = 0;
  /**
   * The wind the sail has, smoothed, and the only reading the cloth and the hull are allowed: `blowing` is the
   * air moving in the cloth, `taken` the part of it the sail is holding (an eased sheet spills the rest), `along`
   * how much of what it holds pushes the way the boat is pointing, and `made` how much of it the player put there.
   */
  readonly sailWind = { blowing: 0, taken: 0, along: 0, made: 0 };
  private readonly sailPivot = new THREE.Group();
  private readonly sailMat: THREE.ShaderMaterial;
  /** The actual shell vertices, before merging, so every part of the hull clears the sand. */
  private readonly hullContacts: THREE.BufferAttribute;
  private readonly contact = new THREE.Vector3();
  private nearShore = true;
  private readonly seatLocal = new THREE.Vector3(0, 0.02, -0.25);
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  /** The wind the sail feels, on the hanging things' spring: it fills when a gust arrives, not when the air moves. */
  private readonly sway = new Sway();
  /** Foam left on the water behind the hull. */
  private readonly wake = new Marks();
  private wakeIn = 0;
  private readonly boardA = new THREE.Vector3();
  private readonly boardB = new THREE.Vector3();
  private readonly sea: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  /** How the hull is lying, for whoever is riding it. */
  roll = 0;
  pitch = 0;
  private boom = 0;
  /** The wind the sail has settled to, against which a new gust reads as an arrival. */
  private settled = 0;
  private luff = 0;
  private time = 0;
  /** A shove against the hull, signed by the side it came from, and how long ago it landed. */
  private shove = 0;
  private shoveAge = 1e3;
  /** Which way the beach lets it go while it is being pushed off, and how long that has been going on. */
  private readonly pushDir = new THREE.Vector2();
  private pushingFor = -1;
  /** While a foot is still crossing the gunwale, the hull may drift from the shove but the sail may not take it. */
  private boardingPush = false;

  constructor(private readonly wind: WindField) {
    const hullMat = new THREE.ShaderMaterial({
      vertexShader: HULL_VERT,
      fragmentShader: HULL_FRAG,
      uniforms: { ...atmo.uniforms },
      side: THREE.DoubleSide,
    });
    const wood = new THREE.Color('#9a6a42');
    const trim = new THREE.Color('#5d3d27');
    const shellGeometry = hull();
    this.hullContacts = shellGeometry.getAttribute('position') as THREE.BufferAttribute;
    const shell = paint(shellGeometry, wood);
    const deck = paint(floorboards(), trim);
    const thwart = paint(new THREE.BoxGeometry(1.7, 0.08, 0.34).translate(0, 0.02, -0.25), trim);
    const mast = paint(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8).translate(0, 2.2, 0.55), trim);
    const boomBar = paint(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6).rotateZ(Math.PI / 2).translate(-1.35, 0.78, 0.55), trim);
    this.group.add(new THREE.Mesh(mergeGeometries([shell, deck, thwart, mast]), hullMat));

    this.sailMat = new THREE.ShaderMaterial({
      vertexShader: SAIL_VERT,
      fragmentShader: SAIL_FRAG,
      uniforms: { ...atmo.uniforms, uScarf: { value: 0 }, uFill: { value: 0 }, uFlutter: { value: 0 }, uRipplePhase: { value: 0 }, uLuff: { value: 0 }, uDroop: { value: 1 }, uShelter: { value: 0 } },
      side: THREE.DoubleSide,
    });
    this.sailPivot.position.set(0, 0, 0.55);
    this.sailPivot.add(new THREE.Mesh(sailGeometry(), this.sailMat));
    this.sailPivot.add(new THREE.Mesh(boomBar.translate(0, 0, -0.55), hullMat));
    this.group.add(this.sailPivot);
  }

  get objects(): THREE.Object3D[] {
    return [this.group, this.wake.mesh];
  }

  beach(x: number, z: number, yaw: number): void {
    this.speedLimit = Infinity;
    this.shelter = 0;
    this.position.set(x, Math.max(heightAt(x, z), 0) + DRAFT, z);
    this.yaw = yaw;
    this.afloat = false;
    this.speed = 0;
    this.lieOnShore(1, 0);
    this.pose(0);
  }

  launch(holdForBoarding = false): void {
    this.afloat = true;
    this.grounded = false;
    this.speed = 0;
    this.pushingFor = 0;
    this.boardingPush = holdForBoarding;
    /** Out is downhill off the sand; on open water, where there is no slope, it is astern. */
    const p = this.position;
    const gx = heightAt(p.x + 3, p.z) - heightAt(p.x - 3, p.z);
    const gz = heightAt(p.x, p.z + 3) - heightAt(p.x, p.z - 3);
    if (Math.hypot(gx, gz) > 0.05) this.pushDir.set(-gx, -gz).normalize();
    else this.pushDir.set(-Math.sin(this.yaw), -Math.cos(this.yaw));
  }

  /** The child has settled: the shove may now give way to the wind already waiting in the sail. */
  finishBoarding(): void {
    this.boardingPush = false;
  }

  private get pushingOff(): boolean {
    return this.pushingFor >= 0;
  }

  /** Which side the sail is swung out to: +1 to starboard, -1 to port. */
  get sailSide(): number {
    return this.boom >= 0 ? 1 : -1;
  }

  /** The droop actually drawn by the cloth, 0 full to 1 hanging dead. */
  get sailDroop(): number { return this.sailMat.uniforms.uDroop.value; }
  get sailFlutter(): number { return this.sailMat.uniforms.uLuff.value; }

  /** World position of the middle of the sail, for anyone who needs to look at it. */
  sailPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.set(0, 2.2, 0.55).applyMatrix4(this.group.matrixWorld);
  }

  /** The visible hull's ends, so landmark framing keeps the whole boat within the screen. */
  hullEnds(bow: THREE.Vector3, stern: THREE.Vector3): void {
    this.group.updateMatrixWorld(true);
    bow.set(0, 0.28, LENGTH * 0.55).applyMatrix4(this.group.matrixWorld);
    stern.set(0, 0, -LENGTH * 0.45).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Something in the water leans on the hull from `side` (+1 for the hull's own +x, the side a crossing calls
   * left), `strength` 1 being about a dolphin's shoulder: the boat heels away from the shove, its head is knocked
   * round and it is given a surge, all three easing out over a couple of seconds.
   */
  nudge(side: number, strength = 1): void {
    this.shove = side * strength;
    this.shoveAge = 0;
  }

  /** World position of the seat, where the child rides. */
  seat(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.copy(this.seatLocal).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * The shoreward place beside the thwart. Choosing the higher of the two sides keeps the child on sand when the
   * boat is lying at an angle to a beach, and gives every departure the same measured last step to the gunwale.
   */
  boardingPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    this.boardA.set(-1.45, 0, 0.3).applyMatrix4(this.group.matrixWorld);
    this.boardB.set(1.45, 0, 0.3).applyMatrix4(this.group.matrixWorld);
    const a = heightAt(this.boardA.x, this.boardA.z);
    const b = heightAt(this.boardB.x, this.boardB.z);
    return out.copy(a >= b ? this.boardA : this.boardB);
  }

  update(dt: number, time: number): void {
    this.time += dt;
    const p = this.position;
    if (this.afloat) this.shelter *= Math.exp(-dt * tuning.opening.departureRate);
    const w = this.readWind(dt);
    const air = this.sailWind;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const along = w.x * fx + w.z * fz;
    const across = w.x * fz - w.z * fx;

    this.shoveAge += dt;
    const u = this.shoveAge / tuning.dolphins.shovePeak;
    const kick = this.shove * u * Math.exp(1 - u);

    if (this.afloat && !this.grounded) {
      let dy = 0;
      if (this.steerFor) {
        const want = Math.atan2(this.steerFor.x - p.x, this.steerFor.y - p.z);
        dy = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      }
      if (this.pushingOff) {
        this.pushingFor += dt;
        const out = PUSH_OFF_SPEED * Math.max(0.35, 1 - this.pushingFor / PUSH_OFF_LONGEST);
        p.x += this.pushDir.x * out * dt;
        p.z += this.pushDir.y * out * dt;
        this.yaw += THREE.MathUtils.clamp(dy, -dt * PUSH_OFF_TURN, dt * PUSH_OFF_TURN);
        if (!this.boardingPush && ((this.steerFor && Math.abs(dy) < PUSH_OFF_UNTIL) || this.pushingFor > PUSH_OFF_LONGEST)) {
          this.pushingFor = -1;
        }
      } else {
        /**
         * A small boat sails on any point of wind, so what drives it is how much wind the sail is holding, with
         * a little more for a following one. Nobody is ever left stuck head to wind waiting for a shift.
         */
        const distance = this.steerFor ? Math.hypot(this.steerFor.x - p.x, this.steerFor.y - p.z) : Infinity;
        // Ease the sheet before a tight turn. A fixed turning circle can orbit a point forever.
        const aligned = THREE.MathUtils.smoothstep(Math.cos(dy), 0, tuning.sail.turnAligned);
        const turnLimit = this.steerFor
          ? THREE.MathUtils.lerp(Math.max(tuning.sail.minimumWay, distance * TURN_FAST * tuning.sail.turnBrake), tuning.sail.topSpeed, aligned)
          : Infinity;
        const berthDistance = this.mooring ? Math.hypot(this.mooring.x - p.x, this.mooring.z - p.z) : Infinity;
        const approach = Math.max(tuning.sail.minimumWay, berthDistance * tuning.sail.mooringDrive);
        const drive = Math.min(
          air.taken * tuning.sail.drive + Math.max(0, air.along) * tuning.sail.following,
          tuning.sail.topSpeed,
          this.speedLimit,
          turnLimit,
          approach,
        );
        const gathering = drive > this.speed ? tuning.sail.gathers : tuning.sail.carries;
        this.speed += (drive - this.speed) * (1 - Math.exp(-dt * gathering));
        this.speed = Math.min(tuning.sail.topSpeed, this.speed + Math.abs(kick) * tuning.dolphins.shoveSurge * dt);
        this.yaw += kick * tuning.dolphins.shoveYaw * dt;
        const turn = THREE.MathUtils.lerp(TURN_SLOW, TURN_FAST, Math.min(1, this.speed / 5));
        this.yaw += THREE.MathUtils.clamp(dy, -dt * turn, dt * turn);
        // The child takes a line as the berth approaches; sideways drift must not defeat the last turn.
        const leeway = Math.min(0.06, this.speedLimit * tuning.sail.passageDrift / Math.max(1, Math.hypot(w.x, w.z)));
        const drift = leeway * (this.mooring ? THREE.MathUtils.smoothstep(berthDistance, 2.6, tuning.sail.mooringShelter) : 1);
        p.x += (fx * this.speed + w.x * drift) * dt;
        p.z += (fz * this.speed + w.z * drift) * dt;
      }
      const ahead = heightAt(p.x + fx * 2.2, p.z + fz * 2.2);
      if (this.canGround && ahead > -0.25) {
        this.grounded = true;
        this.speed = 0;
      }
      if (this.mooring && Math.hypot(this.mooring.x - p.x, this.mooring.z - p.z) < 2.6) {
        this.grounded = true;
        this.speed = 0;
      }
    } else if (this.afloat && this.mooring) {
      /** Made fast: it settles against the jetty and lies along it. */
      const m = this.mooring;
      const k = 1 - Math.exp(-dt * 0.8);
      p.x += (m.x - p.x) * k;
      p.z += (m.z - p.z) * k;
      this.yaw += Math.atan2(Math.sin(m.yaw - this.yaw), Math.cos(m.yaw - this.yaw)) * k;
    }

    const heel = this.afloat ? THREE.MathUtils.clamp(across * 0.018, -0.22, 0.22) : 0;
    /**
     * The hull lies along the swell it is floating on, the same waves the water mesh is displaced by, so the
     * boat rises over a crest and heels to the face of it instead of rocking to a rhythm of its own.
     */
    const t = this.time;
    const lift = this.swellUnder(p.x, p.z, time);
    const bow = this.sea.slopeX * fx + this.sea.slopeZ * fz;
    const beam = this.sea.slopeX * fz - this.sea.slopeZ * fx;
    const settle = 1 - Math.exp(-dt * 3.5);
    const waterRoll = heel + kick * tuning.dolphins.shoveHeel + Math.sin(t * 1.3) * (this.afloat ? 0.05 : 0.0) + beam;
    const waterPitch = this.afloat ? Math.sin(t * 0.9 + 1) * 0.04 - this.speed * 0.004 - bow : -0.05;
    this.lieOnShore(settle, lift, waterRoll, waterPitch);
    const bob = this.afloat ? Math.sin(t * 1.1) * 0.045 + Math.sin(t * 2.3) * 0.02 : 0;
    p.y = this.afloat ? bob + lift + DRAFT : Math.max(heightAt(p.x, p.z), 0) + DRAFT + 0.1;

    const sail = this.sailMat.uniforms;
    sail.uScarf.value = this.scarfSail;
    sail.uShelter.value = this.shelter;
    /** With nothing moving in it the cloth is dead weight: the leech falls in and it hangs off the mast in folds. */
    const hang = 1 - THREE.MathUtils.smoothstep(air.blowing, 0, tuning.sail.hangsBelow);
    sail.uDroop.value = hang;
    /** Nothing holds a dead sail out: the boom comes back amidships and swings with whatever the hull is doing. */
    const set = THREE.MathUtils.clamp(Math.atan2(across, Math.max(along, 0.5)) * 0.6, -1.1, 1.1);
    const targetBoom = set * (1 - hang * 0.85) + hang * Math.sin(this.time * 0.35) * 0.05;
    this.boom += (targetBoom - this.boom) * (1 - Math.exp(-dt * 1.5));
    const fill = (1 - Math.exp(-air.taken / tuning.sail.bellyAt)) * (this.afloat ? 1 : 0.4);
    // Cloth bellies along the sail's local +z, rotated by the boom and hull. Crosswind alone can
    // change sign in a following breeze and turn the belly astern while the wind still drives us forward.
    const normalYaw = this.yaw + this.boom;
    const pressure = w.x * Math.sin(normalYaw) + w.z * Math.cos(normalYaw);
    sail.uFill.value += ((pressure >= 0 ? 1 : -1) * fill * tuning.sail.belly - sail.uFill.value) * (1 - Math.exp(-dt * 3));
    /** The harder it blows, the more there is for the cloth to do: a lazy ripple in a light air, a lively one in a gust. */
    sail.uFlutter.value = Math.min(1, air.blowing / tuning.sail.livelyAt);
    /** Integrate the changing frequency: multiplying it by elapsed time makes every gust jump the cloth. */
    sail.uRipplePhase.value = (sail.uRipplePhase.value
      + dt * (tuning.sail.rippleRate + tuning.sail.rippleGustRate * sail.uFlutter.value)) % (Math.PI * 2);
    /**
     * A gust does not simply fill the sail: it breaks over it. The cloth shakes along the leech the moment the
     * wind changes, hard for a gust the sail was not already carrying, and goes quiet again as it fills.
     */
    const pressing = Math.min(1, w.energy * 1.5 + air.made / 12);
    this.settled += (pressing - this.settled) * (1 - Math.exp(-dt * 1.1));
    const arriving = Math.max(0, pressing - this.settled) / Math.max(1 - this.settled, 0.2);
    this.luff = Math.max(this.luff * Math.exp(-dt / tuning.sail.luffFade), Math.min(1, Math.max(0, arriving - tuning.sail.luffFrom) * 2.4));
    /** An eased sheet spills its wind instead of holding it: the sail flaps on while the boat loses way. */
    const spilling = this.becalmed * Math.min(1, (air.blowing - air.made) / tuning.sail.hangsBelow);
    const squallLuff = this.swell * tuning.sail.squallLuff * (0.58 + 0.42 * Math.sin(this.time * 2.7) ** 2);
    sail.uLuff.value = Math.max(this.luff, spilling, squallLuff) * (this.afloat ? 1 : 0.5);
    this.pose(dt);
    this.updateWake(dt, time);
  }

  /** The air the sail is standing in: the one place the boat reads the wind field. */
  private airOnSail(out: WindSample, dt: number): WindSample {
    feltWind(this.wind.sample(this.position.x, this.position.z, out), this.wind.calm);
    this.sway.update(out.x, out.z, dt);
    out.x = this.sway.x;
    out.z = this.sway.z;
    return out;
  }

  /**
   * What the sail has this frame, smoothed into `sailWind`. The world's share is the prevailing breeze the
   * chapter is running, which is steady and dies when the chapter means it to; the field itself is read for what
   * the player has added to it and for which way the wind is lying. `becalmed` takes the world's wind out of the
   * sail and leaves the player's. The squall is no stronger in the field, so its weight comes from the sea.
   */
  private readWind(dt: number): WindSample {
    const w = this.airOnSail(this.sample, dt);
    const speed = Math.hypot(w.x, w.z);
    const world = this.wind.breeze.length();
    /** Told by the gust it carries and by standing well clear of the breeze and of the field's own stirring. */
    const made = Math.max(0, speed - Math.max(world, tuning.sail.stirs)) + w.energy * tuning.sail.gustPress;
    const weather = this.swell * tuning.sail.squallPress;
    const exposed = 1 - this.shelter;
    const blowing = made + (world + weather) * exposed;
    const taken = made + (world + weather * tuning.sail.squallHolds) * exposed * (1 - this.becalmed);
    /** Which way it is lying is the field's to say, however little of it there is. */
    const heading = speed > 1e-3 ? (w.x * Math.sin(this.yaw) + w.z * Math.cos(this.yaw)) / speed : 0;
    const along = heading * taken;
    const air = this.sailWind;
    air.blowing = this.takesUp(air.blowing, blowing, dt);
    air.taken = this.takesUp(air.taken, taken, dt);
    air.made = this.takesUp(air.made, made, dt);
    air.along += (along - air.along) * (1 - Math.exp(-dt * tuning.sail.fills));
    return w;
  }

  /** Cloth takes wind up faster than it lets it go. */
  private takesUp(was: number, now: number, dt: number): number {
    const rate = now > was ? tuning.sail.fills : tuning.sail.empties;
    return was + (now - was) * (1 - Math.exp(-dt * rate));
  }

  /**
   * The swell under a point, damped in the shallows exactly as the water mesh damps it, so a boat coming in
   * over the sand settles onto a flat sea rather than bobbing on a swell that is no longer drawn.
   */
  private swellUnder(x: number, z: number, time: number): number {
    swellAt(x, z, time, this.sea);
    const damp = this.afloat ? THREE.MathUtils.smoothstep(Math.max(-heightAt(x, z), 0), 0.6, 4.5) * (1 - mirrorWater(x, z)) : 0;
    this.sea.height *= damp;
    this.sea.slopeX *= damp;
    this.sea.slopeZ *= damp;
    return this.sea.height;
  }

  /** A short tail of foam behind the hull while it is under way; it spreads and fades. */
  private updateWake(dt: number, time: number): void {
    this.wake.update(time);
    this.wakeIn -= dt;
    if (!this.afloat || this.grounded || this.speed < 0.6 || this.wakeIn > 0) return;
    this.wakeIn = 0.15;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const strength = Math.min(0.7, this.speed * 0.13);
    // Two broken trails peel off the quarters; a small curl at each shoulder anchors the waterline.
    for (const side of [-1, 1]) {
      this.wake.add(FOAM, this.position.x - fx * 1.6 + fz * side * 0.5,
        this.position.z - fz * 1.6 - fx * side * 0.5, 0.22, 5.5, time,
        strength, 0.22, Math.PI / 2 - this.yaw + side * 0.18, 1.65);
      this.wake.add(FOAM, this.position.x + fx * 0.6 + fz * side * 0.78,
        this.position.z + fz * 0.6 - fx * side * 0.78, 0.13, 1.4, time,
        strength * 0.8, 0.09, Math.PI / 2 - this.yaw, 2.4);
    }
  }

  private pose(_dt: number): void {
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.yaw);
    this.group.rotateX(this.pitch);
    this.group.rotateZ(this.roll);
    // Floating height alone lets an arriving bow, or a departing stern, pass through the beach.
    // Resolve the shell against the ground after applying its complete pitch and roll.
    let supported = -Infinity;
    for (let i = 0; this.nearShore && i < this.hullContacts.count; i++) {
      const p = this.contact.fromBufferAttribute(this.hullContacts, i).applyQuaternion(this.group.quaternion);
      supported = Math.max(supported, heightAt(this.position.x + p.x, this.position.z + p.z) - p.y);
    }
    this.position.y = Math.max(this.position.y, supported + tuning.sail.hullClearance);
    this.group.position.copy(this.position);
    this.sailPivot.rotation.y = this.boom;
    this.group.updateMatrixWorld(true);
  }

  /** Rest along a sloping beach instead of holding a level hull on its highest corner. */
  private lieOnShore(settle: number, sea: number, waterRoll = 0, waterPitch = -0.05): void {
    const p = this.position, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const fore = heightAt(p.x + fx * 2, p.z + fz * 2);
    const aft = heightAt(p.x - fx * 2, p.z - fz * 2);
    const right = heightAt(p.x + fz * BEAM, p.z - fx * BEAM);
    const left = heightAt(p.x - fz * BEAM, p.z + fx * BEAM);
    const ground = Math.max(fore, aft, right, left, heightAt(p.x, p.z));
    this.nearShore = ground > -LENGTH;
    const resting = THREE.MathUtils.smoothstep(ground, sea - 0.4, sea + 0.4);
    const base = sea - 0.15;
    const pitch = -Math.atan2(Math.max(fore, base) - Math.max(aft, base), 4);
    const roll = Math.atan2(Math.max(right, base) - Math.max(left, base), BEAM * 2);
    const limit = tuning.sail.shoreTilt;
    this.pitch += (THREE.MathUtils.lerp(waterPitch, THREE.MathUtils.clamp(pitch, -limit, limit), resting) - this.pitch) * settle;
    this.roll += (THREE.MathUtils.lerp(waterRoll, THREE.MathUtils.clamp(roll, -limit, limit), resting) - this.roll) * settle;
  }
}
