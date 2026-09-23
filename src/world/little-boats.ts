import { littleBoatsBath } from './little-boats-bath';
import { PaddleSpray } from './little-boats-spray';
import type { Traveller } from '../traveller/traveller';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './island';
import { swellAt } from './water/swell';
import { glsl, tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { atmo, ATMO_GLSL } from './atmosphere';
import { LITTLE_BOATS as L, boatsX, boatsWidth, boatsWaterHeight, boatsCourse } from './little-boats-layout';

const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec2 vUv;
void main() {
  vLocal = position; vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColour;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float grain = vnoise(vec2(vLocal.z * 4.0, vLocal.x * 38.0));
  vec3 alb = uColour * (0.88 + grain * 0.19);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(N) + uSunColor * max(0.0, dot(N, uSunDir) * 0.6 + 0.4) * sun);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
const SAIL_VERT = /* glsl */ `
uniform float uFill;
uniform float uDroop;
uniform float uLuff;
uniform float uPhase;
uniform float uSeed;
uniform float uTime;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
vec3 cloth(vec2 st) {
  float s = st.x, t = st.y;
  float cut = s * (1.0 - uDroop * s * 0.48);
  vec3 p = vec3(-cut * 0.93 * (1.0 - t * 0.55), 0.32 + t * 1.28 + cut * 0.12, 0.0);
  p.y -= uDroop * s * (0.4 + 0.6 * sin(t * 3.14159)) * ${glsl(tuning.littleBoats.sailSag)};
  float folds = sin(s * 25.1327 + 1.1 + t * 0.7) * smoothstep(0.0, 0.2, s) * (0.3 + 0.7 * sin(t * 3.14159));
  p.z += uDroop * folds * (0.7 + 0.3 * sin(uTime * 0.55 + uSeed + t * 1.5)) * ${glsl(tuning.littleBoats.sailFold)};
  float edge = smoothstep(0.15, 1.0, s) * (0.4 + 0.6 * t);
  float belly = sin(s * 3.14159) * sin(t * 2.827) * (1.0 - 0.3 * uLuff * edge);
  p.z += belly * uFill * 0.34;
  p.z += sin(uPhase - s * 6.5 + t * 3.0) * abs(uFill) * (0.25 + 0.75 * s * s) * ${glsl(tuning.littleBoats.sailFlutter)};
  p.z += sin(uTime * 19.0 + uSeed - s * 12.0 + t * 4.0) * edge * (uLuff + abs(uFill) * 0.2) * ${glsl(tuning.littleBoats.sailShake)};
  return p;
}
void main() {
  vUv = uv;
  vec3 p = cloth(uv);
  vec3 pu = cloth(uv + vec2(0.012, 0.0));
  vec3 pv = cloth(uv + vec2(0.0, 0.012));
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normalize(cross(pv-p, pu-p)));
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;
const SAIL_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColour;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y));
  float seam = 1.0 - smoothstep(0.012, 0.025, edge);
  float stripe = smoothstep(0.47, 0.48, vUv.y) * (1.0-smoothstep(0.7,0.71,vUv.y));
  vec3 alb = mix(uColour, uColour * 0.72, seam * 0.45 + stripe * 0.17);
  float back = pow(max(0.0, dot(-V, uSunDir)), 2.0);
  vec3 col = alb * (uSkyAmbient * 1.15 + uSunColor * (0.38 + 0.38 * back + 0.25 * abs(dot(N,uSunDir))) * cloudShadow(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
const SHADOW_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec2 vUv;
void main() {
  if (uMirrorPass > 0.5) discard;
  float d = length((vUv - 0.5) * 2.0);
  float a = (1.0 - smoothstep(0.22, 1.0, d)) * 0.23 * (1.0 - fogOf(vWorld).a);
  gl_FragColor = vec4(0.045, 0.12, 0.1, a);
}`;
const WAKE_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uFill;
in vec3 vWorld;
in vec2 vUv;
void main() {
  float x = abs(vUv.x - 0.5);
  float y = vUv.y;
  float line = exp(-pow((x - (1.0-y)*0.42 - sin(y*19.0+uTime*1.3)*0.016) / 0.018,2.0));
  float alpha = line * sin(y*3.14159) * uFill * 0.12;
  gl_FragColor = vec4(applyFog(vec3(0.85,0.88,0.75),vWorld),alpha);
}`;
function material(colour: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uColour: { value: new THREE.Color(colour) } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  });
}

/** Carved solid hull: rounded sides, pointed bow, broad stern and a thin contrasting gunwale. */
function hull(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(0, 0.86);
  outline.bezierCurveTo(0.42, 0.45, 0.39, -0.43, 0.26, -0.67);
  outline.quadraticCurveTo(0, -0.77, -0.26, -0.67);
  outline.bezierCurveTo(-0.39, -0.43, -0.42, 0.45, 0, 0.86);
  const g = new THREE.ExtrudeGeometry(outline, {
    depth: 0.15,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.065,
    bevelThickness: 0.085,
    curveSegments: 12,
  });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.16, 0);
  return g;
}
function sail(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 12, 14);
  const p = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const s = uv.getX(i),
      t = uv.getY(i);
    p.setXYZ(i, -s * 0.93 * (1 - t * 0.55), 0.32 + t * 1.28 + s * 0.12, 0.21);
  }
  g.computeVertexNormals();
  return g;
}
interface Toy {
  group: THREE.Group;
  sail: THREE.ShaderMaterial;
  pivot: THREE.Group;
  boom: number;
  gust: number;
  luff: number;
  across: number;
  drift: number;
  heel: number;
  roll: number;
  rollV: number;
  wake: THREE.Mesh;
  shadow: THREE.Mesh;
  s: number;
  rest: number;
  lane: number;
  speed: number;
  previousS: number;
  fill: number;
  effort: number;
  joined: boolean;
  seed: number;
  drive: number;
  shove: number;
}

export class LittleBoats {
  readonly group = new THREE.Group();
  readonly toys: Toy[] = [];
  private readonly spray = new PaddleSpray();
  private readonly swimWake = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 2.5).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uFill: { value: 0.8 } },
      vertexShader: VERT,
      fragmentShader: WAKE_FRAG,
      transparent: true,
      depthWrite: false,
    }),
  );
  readonly focus = new THREE.Vector3();
  readonly invitation = new THREE.Vector3();
  active = false;
  departing = false;
  launched = false;
  progress = 3;
  idle = 0;
  launch = 0;
  readonly stranded = new THREE.Vector3();
  held = false;
  released = false;
  private readonly releaseAt = new THREE.Vector3();
  private readonly releaseTurn = new THREE.Quaternion();
  private readonly handA = new THREE.Vector3();
  private readonly handB = new THREE.Vector3();
  private readonly course = { x: 0, z: 0, yaw: 0 };
  private readonly swell = { height: 0, slopeX: 0, slopeZ: 0 };
  private time = 0;
  private readonly brushAt = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly fleet: Toy[] = [];

  constructor() {
    this.group.name = 'island-of-little-boats';
    this.swimWake.visible = false;
    this.swimWake.renderOrder = 3;
    this.group.add(this.swimWake, this.spray.points);
    const wood = material('#76503a'),
      rim = material('#d4ad73');
    const paints = ['#b96547', '#4e878c', '#d4b35d', '#72865b', '#8e727c', '#4f7a96', '#af794d'];
    const linens = ['#efe1bb', '#d5dfd3', '#eee2b7', '#e5c6b0', '#d8d6c4', '#e9d9c1', '#c8d7d6'];
    const shell = hull(),
      cloth = sail();
    const spar = mergeGeometries([new THREE.CylinderGeometry(0.025, 0.035, 1.75, 7).translate(0, 0.85, 0.21)]);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      g.name = `toy-boat-${i}`;
      g.add(new THREE.Mesh(shell, material(paints[i])));
      const deck = new THREE.Mesh(shell, rim);
      deck.scale.set(0.89, 0.24, 0.91);
      deck.position.y = 0.13;
      g.add(deck);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.07, 0.13), wood);
      seat.position.set(0, 0.24, -0.2);
      g.add(seat);
      g.add(new THREE.Mesh(spar, wood));
      const m = new THREE.ShaderMaterial({
        uniforms: {
          ...atmo.uniforms,
          uFill: { value: 0 },
          uDroop: { value: 1 },
          uLuff: { value: 0 },
          uPhase: { value: i * 1.7 },
          uSeed: { value: i * 2.4 },
          uColour: { value: new THREE.Color(linens[i]) },
        },
        vertexShader: SAIL_VERT,
        fragmentShader: SAIL_FRAG,
        side: THREE.DoubleSide,
      });
      const pivot = new THREE.Group();
      pivot.position.z = 0.21;
      pivot.add(new THREE.Mesh(cloth, m));
      pivot.add(
        new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6).rotateZ(Math.PI / 2).translate(-0.45, 0.34, 0), wood),
      );
      g.add(pivot);
      const wake = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 3.4).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
          uniforms: { ...atmo.uniforms, uFill: { value: 0 } },
          vertexShader: VERT,
          fragmentShader: WAKE_FRAG,
          transparent: true,
          depthWrite: false,
        }),
      );
      wake.renderOrder = 3;
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 2.3).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
          uniforms: { ...atmo.uniforms },
          vertexShader: VERT,
          fragmentShader: SHADOW_FRAG,
          transparent: true,
          depthWrite: false,
        }),
      );
      shadow.renderOrder = 3;
      this.group.add(g, wake, shadow);
      this.toys.push({
        group: g,
        sail: m,
        pivot,
        boom: 0,
        gust: 0,
        luff: 0,
        across: 0,
        drift: 0,
        heel: 0,
        roll: 0,
        rollV: 0,
        wake,
        shadow,
        rest: i === 0 ? 3 : [0, 12, 36, 49, 66, 79, 87][i],
        s: i === 0 ? 3 : [0, 12, 36, 49, 66, 79, 87][i],
        lane: i === 0 ? 0 : (i % 2 ? 1 : -1) * (tuning.littleBoats.sideLane + i * 0.13),
        speed: 0,
        previousS: 0,
        fill: 0,
        effort: 0,
        joined: i === 0,
        seed: i * 1.7,
        drive: 0,
        shove: 0,
      });
    }
    // A bathroom plug, with a brass eye and a chain that simply continues beyond sight.
    const plug = new THREE.Group();
    plug.name = 'bath-plug';
    const brass = material('#ae9462');
    const rubber = material('#494a3b');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.47, 0.3, 24), rubber);
    plug.add(body);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 16), brass);
    eye.position.y = 0.25;
    plug.add(eye);
    const plugX = boatsX(45) - boatsWidth(45) - 2.2,
      plugZ = L.startZ - 45;
    plug.scale.setScalar(3.2);
    plug.position.set(plugX, heightAt(plugX, plugZ) + 1.03, plugZ);
    plug.rotation.z = -0.35;
    this.group.add(plug);
    const links: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 95; i++) {
      const y = plug.position.y + 1.34 + i * 0.84;
      const g = new THREE.TorusGeometry(0.18, 0.034, 6, 12);
      g.scale(1.47, 2.835, 2.1);
      g.rotateY(((i % 2) * Math.PI) / 2);
      g.translate(plug.position.x + 0.4 + Math.sin(i * 0.036) * 1.5, y, plug.position.z + Math.sin(i * 0.018) * 0.8);
      links.push(g);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(links), brass));
    const bath = littleBoatsBath();
    const bathS = 54,
      bathX = boatsX(bathS) - boatsWidth(bathS) - 3.1,
      bathZ = L.startZ - bathS;
    bath.position.set(bathX, heightAt(bathX, bathZ) + 0.8, bathZ);
    bath.rotation.set(0.035, -0.22, -0.07);
    this.group.add(bath);
    const strandedX = boatsX(3) + boatsWidth(3) + 0.45;
    this.stranded.set(strandedX, heightAt(strandedX, L.startZ - 3) + 0.12, L.startZ - 3);
    this.pose(0);
  }

  /** The same hull follows the actual mittens after the child's bones have been posed. */
  afterChildPose(child: Traveller): void {
    if (!this.held) return;
    child.mitten(0, this.handA);
    child.mitten(1, this.handB);
    this.toys[0].group.position.copy(this.handA).lerp(this.handB, 0.5);
    this.toys[0].group.position.x -= 0.3;
    this.toys[0].group.position.y -= 0.18;
    this.toys[0].group.rotation.set(0, 0, 0);
    this.focus.copy(this.toys[0].group.position);
  }

  releaseToy(): void {
    this.held = false;
    this.released = true;
    this.releaseAt.copy(this.toys[0].group.position);
    this.releaseTurn.copy(this.toys[0].group.quaternion);
  }

  /** The sheltered pool owns its surface height; offshore wake marks follow the sea instead. */
  swimmer(at: THREE.Vector3 | null, yaw: number, stride: number, play: number): void {
    this.spray.update(at, yaw, stride, play, this.time);
    this.swimWake.visible = at !== null;
    if (!at) return;
    this.swimWake.position.set(
      at.x - Math.sin(yaw) * 1.1,
      boatsWaterHeight(at.x, at.z, this.time) + 0.035,
      at.z - Math.cos(yaw) * 1.1,
    );
    this.swimWake.rotation.y = yaw - Math.PI;
  }

  /** Put screen strokes onto the sail they cross; a low camera otherwise hits ground behind the toy. */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (!this.active || !this.launched || input.muted || !input.present || input.gust < tuning.littleBoats.brushSpeed) return;
    if (input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    for (const toy of this.toys) {
      this.brushAt.copy(toy.group.position);
      this.brushAt.y += 0.8;
      if (screenBrush(camera, this.brushAt, input.prevNdc, input.ndc, tuning.littleBoats.brushRadius) < 0.01) continue;
      wind.addSplat({ source: toy,
        ax: toy.group.position.x,
        az: toy.group.position.z,
        bx: toy.group.position.x,
        bz: toy.group.position.z,
        vx: input.gustDir.x * input.gust,
        vz: input.gustDir.y * input.gust,
        radius: tuning.littleBoats.brushWindRadius,
        energy: Math.min(0.65, input.gust / tuning.littleBoats.brushEnergyScale),
        lift: 0,
        swirl: 0,
      });
    }
  }

  /** Restores a completed pool, without retaining velocities or a half-played hand animation. */
  restore(s: number): void {
    this.progress = THREE.MathUtils.clamp(s, 3, L.length);
    this.departing = false;
    this.launched = true;
    this.held = false;
    this.released = true;
    this.launch = 1;
    this.idle = 0;
    this.toys.forEach((t, i) => {
      t.joined = t.rest <= s + 8;
      const behind = s - i * tuning.littleBoats.hullSpacing;
      t.s = t.joined ? (behind >= 3 ? behind : s + i * tuning.littleBoats.hullSpacing) : t.rest;
      t.speed = 0;
    });
    this.pose(0);
  }

  update(dt: number, time: number, wind: WindField, limit: number): void {
    if (!this.active && !this.departing) return;
    const k = tuning.littleBoats;
    this.time = time;
    let push = 0;
    for (const t of this.toys) {
      const w = wind.sample(t.group.position.x, t.group.position.z, this.air);
      const effort = THREE.MathUtils.smoothstep(w.energy, k.windFrom, k.windFull);
      t.effort = effort;
      const yaw = t.group.rotation.y;
      const cross = w.x * Math.cos(yaw) - w.z * Math.sin(yaw);
      const side = Math.tanh(cross * 0.4);
      t.fill += (effort - t.fill) * (1 - Math.exp(-dt * (effort > t.fill ? k.sailFillRate : k.sailEmptyRate)));
      const arriving = Math.abs(effort - t.gust);
      t.gust += (effort - t.gust) * (1 - Math.exp(-dt * 1.2));
      t.luff = Math.max(t.luff * Math.exp(-dt * 2.2), Math.min(1, arriving * 1.8));
      t.across += (side - t.across) * (1 - Math.exp(-dt * 3));
      t.boom += (-t.across * t.fill * 0.85 - t.boom) * (1 - Math.exp(-dt * 2));
      t.pivot.rotation.y = t.boom;
      t.drift += (t.across * t.fill * k.drift - t.drift) * (1 - Math.exp(-dt * 1.1));
      t.heel = t.across * t.fill * k.heel;
      t.rollV += ((t.heel - t.roll) * k.rollSpring - t.rollV * k.rollDamping) * dt;
      t.roll += t.rollV * dt;
      const u = t.sail.uniforms;
      u.uFill.value += ((t.across >= 0 ? 1 : -1) * t.fill - u.uFill.value) * (1 - Math.exp(-dt * 3));
      u.uDroop.value = 1 - THREE.MathUtils.smoothstep(t.fill, 0.025, 0.65);
      u.uLuff.value = t.luff;
      u.uPhase.value = (u.uPhase.value + dt * (3 + t.fill * 7)) % (Math.PI * 2);
      (t.wake.material as THREE.ShaderMaterial).uniforms.uFill.value = Math.max(t.fill, (t.speed / k.speed) * 0.7);
      if (Math.abs(t.s - this.progress) < k.fleetReach) push = Math.max(push, effort);
    }
    this.idle = push > 0.1 ? 0 : this.idle + dt;
    if (this.launched) {
      const hero = this.toys[0];
      this.fleet.length = 0;
      for (const t of this.toys) {
        t.previousS = t.s;
        if (t.s < k.offshoreEnd) this.fleet.push(t);
      }
      // Use the boats' actual order on the water, including independently sailed toys.
      this.fleet.sort((a, b) => a.s - b.s);
      let heroEnd = this.progress < L.length ? Math.max(hero.s, Math.min(L.length, limit)) : k.offshoreEnd;
      // Ease toward the walkers/swimmer instead of losing all momentum at each
      // pool handoff. Contact from a following hull must obey the same easing.
      // Leave the outlet free so the toy can cross it and start departing.
      const waiting = this.progress < L.length && limit < L.length;
      if (waiting) heroEnd = Math.min(heroEnd, hero.s + Math.max(0, limit - hero.s) * dt / k.followEase);
      for (const [i, t] of this.toys.entries()) {
        // Waiting toys join when the fleet reaches them, not only the child's toy.
        if (!t.joined && this.toys.some((o) => o.joined && o.s > t.s - 5)) t.joined = true;
        // The fleet sails in the child's toy's company: a toy that has run ahead of it leaves that wind behind.
        const company = 1 - THREE.MathUtils.smoothstep(t.s - hero.s, k.carryAhead, k.carryAheadEnd);
        const carried = i === 0 ? push : t.joined ? push * k.fleetCarry * company : 0;
        // Each sail owns its response; a following hull can carry that movement forward.
        const current =
          this.departing || t.s >= L.length
            ? THREE.MathUtils.lerp(k.outletCurrent, k.offshoreSpeed, THREE.MathUtils.smoothstep(t.s, 107, 135))
            : 0;
        const top = k.speed * k.pace[i];
        t.drive = Math.max(Math.max(t.effort, carried) * top, current);
        // The fleet waits for the travellers too, drifting to rest a little beyond the child's toy.
        if (waiting && i > 0 && t.joined) t.drive = Math.min(t.drive, Math.max(0, limit + k.fleetLead - t.s) / k.followEase);
        t.shove = i === 0 ? t.drive : t.effort * top;
      }
      // A hull's own gust nudges on a toy it is closing on and cannot pass, and through it any queue ahead.
      for (let i = 0; i < this.fleet.length; i++) {
        const t = this.fleet[i];
        for (let j = i + 1; j < this.fleet.length; j++) {
          const ahead = this.fleet[j], need = this.spacing(t, t.s, ahead, ahead.s);
          const clear = ahead.s - t.s - need;
          if (need <= 0 || clear >= k.nudge) continue;
          ahead.shove = Math.max(ahead.shove, t.shove * (1 - Math.max(0, clear) / k.nudge));
          ahead.drive = Math.max(ahead.drive, ahead.shove);
        }
      }
      // Front to back, so each hull keeps station behind the settled speed of any toy ahead it cannot pass.
      for (let i = this.fleet.length - 1; i >= 0; i--) {
        const t = this.fleet[i];
        // A filled sail picks the hull up quickly; once the air eases, still water lets it glide on.
        t.speed += (t.drive - t.speed) * (1 - Math.exp(-dt * (t.drive > t.speed ? k.drive : k.drag)));
        if (t === hero) t.speed = Math.min(t.speed, Math.max(0, heroEnd - t.s) / dt);
        for (let j = i + 1; j < this.fleet.length; j++) {
          const ahead = this.fleet[j], need = this.spacing(t, t.s, ahead, ahead.previousS);
          if (need <= 0) continue;
          // Offshore the spacing grows into the turn; allow for that growth before the hulls meet.
          const growth = Math.max(0, this.spacing(t, t.s + t.speed * dt, ahead, ahead.s) - need) / dt;
          t.speed = Math.min(t.speed, Math.max(0, ahead.speed - growth + (ahead.previousS - t.s - need - k.berth) / k.followEase));
        }
        t.s = Math.max(t.s, Math.min(t === hero ? heroEnd : k.offshoreEnd, t.s + t.speed * dt));
      }
      // Should that fall short, a rear push travels through the flotilla instead of through the hulls.
      // Keep the lane offsets and stream course, so a collision cannot shove a toy onto a bank.
      // Toys in clear lanes slip past each other; the frame's starting order holds where they cannot.
      for (let i = 1; i < this.fleet.length; i++) {
        const ahead = this.fleet[i];
        for (let j = 0; j < i; j++) {
          const behind = this.fleet[j], need = this.spacing(behind, behind.s, ahead, ahead.s);
          if (need > 0 && ahead.s < behind.s + need - 1e-8)
            ahead.s = Math.min(ahead === hero ? heroEnd : k.offshoreEnd, ahead.previousS + k.speed * dt, behind.s + need);
        }
      }
      // The child's boat may be waiting for the walkers/swimmer. Let that stop travel
      // back through any boats behind it, without pushing it past the chapter limit.
      for (let i = this.fleet.length - 2; i >= 0; i--) {
        const behind = this.fleet[i];
        for (let j = i + 1; j < this.fleet.length; j++) {
          const ahead = this.fleet[j], need = this.spacing(behind, behind.s, ahead, ahead.s);
          if (need > 0 && behind.s > ahead.s - need + 1e-8) behind.s = Math.max(behind.previousS, ahead.s - need);
        }
      }
      for (const t of this.fleet) t.speed = dt > 0 ? Math.max(0, (t.s - t.previousS) / dt) : 0;
      this.progress = Math.min(L.length, hero.s);
      if (this.progress >= L.length) this.departing = this.toys.some((t) => t.s < k.offshoreEnd);
    }

    this.pose(time);
  }

  /** Offset across the stream at course position s, before wind drift. */
  private laneAt(t: Toy, s: number): number {
    const streamS = Math.min(s, 107);
    if (t === this.toys[0]) return (1 - this.launch) * boatsWidth(streamS) * 0.92;
    const narrow = Math.max(tuning.littleBoats.outletLane, (boatsWidth(streamS) - 1) * 0.7);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(t.lane, -narrow, narrow),
      t.lane * 1.5,
      THREE.MathUtils.smoothstep(s, 109, 133),
    );
  }

  /** Course distance two hulls keep: none when their lanes pass clear of each other, more where the offshore turn compresses travel. */
  private spacing(a: Toy, sa: number, b: Toy, sb: number): number {
    const k = tuning.littleBoats;
    const apart = Math.abs(this.laneAt(a, sa) - this.laneAt(b, sb));
    const turn = 1 + k.turnRoom * THREE.MathUtils.smoothstep((sa + sb) / 2, 104, 113);
    return k.hullSpacing * turn * (1 - THREE.MathUtils.smoothstep(apart, k.passFrom, k.passClear));
  }

  private pose(time: number): void {
    this.toys.forEach((t, i) => {
      if (i === 0 && this.held) return;
      const spread = THREE.MathUtils.smoothstep(t.s, 109, 133);
      const lane = this.laneAt(t, t.s);
      boatsCourse(t.s, this.course);
      const yaw = this.course.yaw;
      const offset = lane + (i === 0 ? this.launch : 1) * t.drift;
      const x = this.course.x + offset * THREE.MathUtils.lerp(1, -Math.cos(yaw), spread);
      const z = this.course.z + offset * Math.sin(yaw) * spread;
      const ocean = THREE.MathUtils.smoothstep(-heightAt(x, z), 0.6, 4.5);
      swellAt(x, z, time, this.swell);
      const surface = boatsWaterHeight(x, z, time) + this.swell.height * ocean;
      const y = surface + tuning.littleBoats.toyDraft + Math.sin(time * 2.1 + t.seed) * (0.018 + t.fill * 0.018);
      const resting = i === 0 ? (1 - this.launch) * Math.max(0, heightAt(x, z) + 0.12 - y) : 0;
      t.group.position.set(x, y + resting, z);
      const slopeX = (boatsWaterHeight(x + 0.4, z, time) - boatsWaterHeight(x - 0.4, z, time)) / 0.8 + this.swell.slopeX * ocean;
      const slopeZ = (boatsWaterHeight(x, z + 0.6, time) - boatsWaterHeight(x, z - 0.6, time)) / 1.2 + this.swell.slopeZ * ocean;
      t.group.rotation.set(
        -slopeX * Math.sin(yaw) - slopeZ * Math.cos(yaw) + Math.sin(time * 1.6 + t.seed) * 0.035,
        yaw + t.boom * 0.09 + Math.sin(time * 0.8 + t.seed) * (0.025 + t.fill * 0.045),
        t.roll +
          slopeX * Math.cos(yaw) -
          slopeZ * Math.sin(yaw) +
          Math.sin(time * 1.9 + t.seed) * 0.045 +
          (i === 0 ? (1 - this.launch) * 0.85 : 0),
      );
      if (i === 0 && !this.released) {
        t.group.position.copy(this.stranded);
        t.group.rotation.set(0, 0, 0.08);
      } else if (i === 0 && this.launch < 1) {
        t.group.position.lerp(this.releaseAt, 1 - this.launch);
        t.group.quaternion.slerp(this.releaseTurn, 1 - this.launch);
      }
      t.wake.position.set(x - Math.sin(yaw) * 1.8, surface + 0.025, z - Math.cos(yaw) * 1.8);
      t.wake.rotation.y = yaw - Math.PI;
      t.wake.visible = this.launched && t.speed > 0.03 && t.s < tuning.littleBoats.offshoreEnd;
      t.shadow.position.set(x, surface + 0.019, z);
      t.shadow.rotation.y = yaw;
      t.group.visible = t.s < tuning.littleBoats.offshoreEnd;
      t.shadow.visible = t.group.visible && (i !== 0 || this.launch > 0.4);
    });
    this.focus.copy(this.toys[0].group.position);
    if (this.progress >= L.length) {
      // The travellers stay at the reveal while their fleet sails out of the shot.
      this.focus.set(boatsX(L.length), boatsWaterHeight(boatsX(L.length), L.startZ - L.length, time), L.startZ - L.length);
    }
    this.invitation.copy(this.focus);
    this.invitation.x -= 0.25;
    this.invitation.y += 0.9;
  }
}
