import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { WindField } from '../wind/field';
import { tuning } from '../tuning';
import { atmo, ATMO_GLSL } from './atmosphere';
import { heightAt } from './island';
import { littleBoatsBath } from './little-boats-bath';
import { LITTLE_BOATS as L, boatsCourse, boatsLevel, boatsWaterHeight, boatsWidth, boatsX } from './little-boats-layout';

const SURFACE_VERT = /* glsl */ `
out vec3 vWorld;
out vec2 vUv;
void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;
const BATH_WATER_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec2 vUv;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float ripple = vnoise(vWorld.xz * 2.3 + uTime * 0.6) * 0.5 + vnoise(vWorld.xz * 4.1 - uTime * 0.9) * 0.5;
  vec3 N = normalize(vec3((ripple - 0.5) * 0.25, 1.0, (vnoise(vWorld.zx * 3.0 + uTime) - 0.5) * 0.25));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 body = vec3(0.26, 0.48, 0.5) * (uSkyAmbient * 1.05 + uSunColor * 0.3);
  vec3 col = mix(body, uSkyAmbient * 1.1, 0.12 + 0.35 * fres);
  col += uSunColor * pow(max(0.0, dot(N, halfVector(uSunDir, V))), 80.0) * 0.3;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
/** A falling sheet: streaks run along it with the flow and break up toward its foot. */
const POUR_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uAmount;
uniform float uSpeed;
in vec3 vWorld;
in vec2 vUv;
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  float streak = vnoise(vec2(vUv.x * 18.0, vUv.y * 2.5 - uTime * uSpeed));
  streak = mix(streak, vnoise(vec2(vUv.x * 41.0, vUv.y * 5.0 - uTime * uSpeed * 1.3)), 0.4);
  float body = (1.0 - smoothstep(0.55, 1.0, across)) * smoothstep(0.0, 0.08, vUv.y);
  float foam = smoothstep(0.35, 0.75, streak + vUv.y * 0.35);
  float alpha = body * uAmount * mix(0.4, 0.85, foam);
  vec3 water = vec3(0.42, 0.64, 0.66) * (uSkyAmbient * 0.95 + uSunColor * 0.3);
  vec3 white = vec3(0.88, 0.92, 0.88) * (uSkyAmbient * 0.7 + uSunColor * 0.38);
  gl_FragColor = vec4(applyFog(mix(water, white, foam), vWorld), alpha);
}`;
/** Foam streaks on the water rushing out of the mouth, and the whirl where the plug was. */
const RUSH_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uRush;
uniform float uFlow;
in vec3 vWorld;
in vec2 vUv;
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  float s = vUv.y;
  float streak = vnoise(vec2(vUv.x * 26.0, s * 0.22 - uFlow * 0.5));
  streak = streak * 0.6 + vnoise(vec2(vUv.x * 57.0 + 4.0, s * 0.5 - uFlow * 0.8)) * 0.4;
  float lines = smoothstep(0.6, 0.72, streak) * (1.0 - smoothstep(0.78, 0.9, streak));
  float edge = smoothstep(0.7, 0.95, across) * smoothstep(0.45, 0.7, vnoise(vec2(s * 0.8 - uFlow * 0.6, vUv.x * 9.0)));
  float ends = smoothstep(0.0, 5.0, s - ${(tuning.littleBoats.plugS - 7).toFixed(1)}) * (1.0 - smoothstep(12.0, 30.0, s - ${tuning.littleBoats.plugS.toFixed(1)}));
  float alpha = (lines * 0.55 + edge * 0.45) * (1.0 - smoothstep(0.88, 1.0, across)) * ends * uRush;
  vec3 white = vec3(0.9, 0.94, 0.9) * (uSkyAmbient * 0.8 + uSunColor * 0.45);
  gl_FragColor = vec4(applyFog(white, vWorld), alpha * 0.7);
}`;
const WHIRL_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uWhirl;
in vec3 vWorld;
in vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float arms = sin(a * 3.0 + log(max(r, 0.02)) * 7.0 + uTime * 7.0) * 0.5 + 0.5;
  float ring = smoothstep(0.08, 0.3, r) * (1.0 - smoothstep(0.65, 1.0, r));
  float alpha = smoothstep(0.55, 0.85, arms) * ring * uWhirl;
  vec3 white = vec3(0.9, 0.94, 0.9) * (uSkyAmbient * 0.8 + uSunColor * 0.45);
  gl_FragColor = vec4(applyFog(white, vWorld), alpha * 0.7);
}`;
const SOLID_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;
const SOLID_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColour;
uniform float uShine;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float grain = vnoise(vWorld.xz * 3.0 + vWorld.y * 2.0);
  vec3 alb = uColour * (0.86 + grain * 0.22);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(N) + uSunColor * max(0.0, dot(N, uSunDir) * 0.6 + 0.4) * sun);
  col += uSunColor * pow(max(0.0, dot(N, halfVector(uSunDir, V))), 40.0) * uShine * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
function solid(colour: string, shine = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uColour: { value: new THREE.Color(colour) }, uShine: { value: shine } },
    vertexShader: SOLID_VERT,
    fragmentShader: SOLID_FRAG,
    side: THREE.DoubleSide,
  });
}
function film(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, ...uniforms },
    vertexShader: SURFACE_VERT,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Drops thrown up where water lands or bubbles: born in world space and left to fall. */
class Splash {
  private readonly count = 96;
  private readonly positions = new THREE.BufferAttribute(new Float32Array(96 * 3), 3);
  private readonly velocities = new THREE.BufferAttribute(new Float32Array(96 * 3), 3);
  private readonly births = new THREE.BufferAttribute(new Float32Array(96).fill(-100), 1);
  private next = 0;
  readonly points: THREE.Points;
  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('velocity', this.velocities);
    geometry.setAttribute('born', this.births);
    this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 velocity;
        attribute float born;
        varying vec3 vWorld;
        varying float vLife;
        void main() {
          float age = max(0.0, uTime - born);
          vLife = 1.0 - smoothstep(0.25, 0.7, age);
          vWorld = position + velocity * age;
          vWorld.y -= 4.0 * age * age;
          vec4 p = viewMatrix * vec4(vWorld, 1.0);
          gl_Position = projectionMatrix * p;
          gl_PointSize = clamp(150.0 / max(1.0, -p.z), 1.5, 7.0) * vLife;
        }`,
      fragmentShader: /* glsl */ `
        ${ATMO_GLSL}
        varying vec3 vWorld;
        varying float vLife;
        void main() {
          float dot = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
          if (vLife < 0.01 || dot < 0.01) discard;
          vec3 colour = vec3(0.86, 0.92, 0.9) * (uSkyAmbient + uSunColor * 0.75);
          gl_FragColor = vec4(applyFog(colour, vWorld), dot * vLife * 0.75);
        }`,
    }));
    this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, time: number, spread: number, up: number): void {
    const n = this.next++ % this.count;
    const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
    this.positions.setXYZ(n, x + Math.cos(a) * r * 0.4, y, z + Math.sin(a) * r * 0.4);
    this.velocities.setXYZ(n, Math.cos(a) * r, up * (0.6 + Math.random() * 0.6), Math.sin(a) * r);
    this.births.setX(n, time);
    this.positions.needsUpdate = this.velocities.needsUpdate = this.births.needsUpdate = true;
  }
}

/**
 * The way out to sea: a shoal the fleet grounds on, the bath whose water floats it over, and the plug in the
 * mouth whose pulling lets the risen pools rush out and carry the toys away.
 */
export class LittleBoatsDrain {
  readonly group = new THREE.Group();
  /** Pools risen by the bath's water, 0..1 of `riseHeight`. */
  rise = 0;
  /** The bath's water is in and the shoal is covered. */
  risen = false;
  /** Seconds left of the risen water's surge over the shoal, as a share of `surgeFor`. */
  surge = 0;
  loose = 0;
  pulled = false;
  /** How strongly the pools are rushing out of the mouth, 0..1. */
  rush = 0;
  /** Seconds since the waiting obstacle (the bath, then the plug) was last touched by a stroke. */
  idle = 0;
  readonly bathAt = new THREE.Vector3();
  /** Where the bath's pour meets the pool. */
  readonly pourAt = new THREE.Vector3();
  readonly plugAt = new THREE.Vector3();
  private water = 1;
  private tip = 0;
  private tipV = 0;
  pour = 0;
  private readonly bathRoot = new THREE.Group();
  private readonly bathPivot = new THREE.Group();
  private readonly bathWater: THREE.Mesh;
  private readonly pourSheet: THREE.Mesh;
  private readonly pourMaterial: THREE.ShaderMaterial;
  private readonly hang = new THREE.Group();
  private readonly plug = new THREE.Group();
  readonly plugRest = new THREE.Vector3();
  /** Screen angle, radians anticlockwise from the right, of a stroke that pushes the bath over toward the stream. */
  pushAngle = 0;
  /** Where the bath's push is shown: from the tub out over its rim toward the pour. */
  readonly hintAt = new THREE.Vector3();
  private lifting = 0;
  /** The updraft's pull on the plug, quick to take hold and slow to let go. */
  private strain = 0;
  private heave = 0;
  private heaveV = 0;
  private sincePush = Infinity;
  /** Set when the island's own gust sets off across the bath, for the story to draw: where from and which way. */
  readonly gustFrom = new THREE.Vector3();
  readonly gustDir = new THREE.Vector3();
  gustStarted = false;
  private nudgeClock = 0;
  private nudges = 0;
  /** How far the island's own gust has crossed the bath, 0..1, or -1 while none is crossing. */
  private nudgeAt = -1;
  private readonly nudgeFrom = new THREE.Vector3();
  private readonly nudgeTo = new THREE.Vector3();
  private readonly nudgeLast = new THREE.Vector3();
  private rockX = 0;
  private rockZ = 0;
  private rockVX = 0;
  private rockVZ = 0;
  private haul = 0;
  private haulV = 0;
  private swing = 0;
  private flow = 0;
  private whirl = 0;
  private readonly rushRibbon: THREE.Mesh;
  private readonly rushMaterial: THREE.ShaderMaterial;
  private readonly whirlDisc: THREE.Mesh;
  private readonly whirlMaterial: THREE.ShaderMaterial;
  private readonly splash = new Splash();
  private readonly lip = new THREE.Vector3();
  private readonly out = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly screenA = new THREE.Vector3();
  private readonly screenB = new THREE.Vector3();
  private readonly course = { x: 0, z: 0, yaw: 0 };
  private readonly pourSegments = 18;
  private readonly ribbonFrom = tuning.littleBoats.plugS - 7;
  private readonly ribbonTo = tuning.littleBoats.plugS + 30;
  private readonly ribbonSteps = 70;

  constructor() {
    const k = tuning.littleBoats;
    this.group.name = 'little-boats-drain';

    // The shoal's stones break the surface right across the run, just under the bank's lip.
    const stones: THREE.BufferGeometry[] = [];
    const level = boatsLevel(k.barS);
    for (let i = 0; i < 17; i++) {
      const across = -1.08 + (i / 16) * 2.16 + Math.sin(i * 7.3) * 0.04;
      const s = k.barS + Math.sin(i * 2.7) * 0.55;
      const r = 0.42 + 0.2 * (0.5 + 0.5 * Math.sin(i * 4.1));
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1.15, 0.55, 0.95);
      g.rotateY(i * 1.3);
      const x = boatsX(s) + across * boatsWidth(s);
      g.translate(x, level + 0.18 + 0.06 * Math.sin(i * 3.3) - r * 0.55, L.startZ - s);
      stones.push(g);
    }
    const shoal = new THREE.Mesh(mergeGeometries(stones), solid('#8f8a78', 0.08));
    shoal.name = 'shoal-stones';
    this.group.add(shoal);

    // The bath tips on the feet nearest the stream, so its far side lifts and the water goes over the near rim.
    const bath = littleBoatsBath();
    const bathX = boatsX(k.bathS) - boatsWidth(k.bathS) - 1.5, bathZ = L.startZ - k.bathS;
    this.bathRoot.position.set(bathX, heightAt(bathX, bathZ) + 0.8, bathZ);
    this.bathRoot.rotation.set(0.035, -0.22, 0);
    this.bathPivot.position.set(1.2, -0.65, 0);
    bath.position.set(-1.2, 0.65, 0);
    this.bathPivot.add(bath);
    this.bathRoot.add(this.bathPivot);
    this.bathWater = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms }, vertexShader: SURFACE_VERT, fragmentShader: BATH_WATER_FRAG }),
    );
    bath.add(this.bathWater);
    this.group.add(this.bathRoot);
    this.bathAt.set(bathX, this.bathRoot.position.y + 1.6, bathZ);
    // Where the pour will land, known before any water has gone over.
    this.bathRoot.updateMatrixWorld(true);
    this.out.set(1, 0, 0).transformDirection(this.bathRoot.matrixWorld).setY(0).normalize();
    this.lip.set(1.66, 1.99, 0).applyMatrix4(bath.matrixWorld).addScaledVector(this.out, 1.6);
    this.pourAt.set(this.lip.x, boatsWaterHeight(this.lip.x, this.lip.z, 0), this.lip.z);

    const pour = new THREE.PlaneGeometry(1, 1, 1, this.pourSegments);
    this.pourMaterial = film(POUR_FRAG, { uAmount: { value: 0 }, uSpeed: { value: 3.5 } });
    this.pourSheet = new THREE.Mesh(pour, this.pourMaterial);
    this.pourSheet.frustumCulled = false;
    this.pourSheet.renderOrder = 4;
    this.pourSheet.visible = false;
    this.group.add(this.pourSheet);

    // The plug stands in the mouth like a cork, its chain running up out of sight into the haze.
    const plugX = boatsX(k.plugS), plugZ = L.startZ - k.plugS;
    const plugY = boatsLevel(k.plugS) - 0.22;
    this.plugRest.set(plugX, plugY, plugZ);
    const brass = solid('#ae9462', 0.5);
    const rubber = solid('#4a4b3d', 0.12);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.47, 0.3, 28), rubber);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 28).rotateX(Math.PI / 2).translate(0, 0.15, 0), rubber);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 16), brass);
    eye.position.y = 0.25;
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 12).translate(0, 0.17, 0), brass);
    this.plug.add(body, rim, eye, boss);
    this.plug.scale.setScalar(k.plugScale);
    this.hang.position.copy(this.plugRest);
    this.hang.add(this.plug);
    const links: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 70; i++) {
      const g = new THREE.TorusGeometry(0.18, 0.034, 6, 12);
      g.scale(1.47, 2.835, 2.1);
      g.rotateY(((i % 2) * Math.PI) / 2);
      g.translate(Math.sin(i * 0.03) * 1.2, 0.25 * k.plugScale + 0.6 + i * 0.84, Math.sin(i * 0.017) * 0.6);
      links.push(g);
    }
    this.hang.add(new THREE.Mesh(mergeGeometries(links), brass));
    this.group.add(this.hang);
    this.plugAt.set(plugX, plugY + 0.8, plugZ);

    const ribbon = new THREE.PlaneGeometry(1, 1, 8, this.ribbonSteps);
    this.rushMaterial = film(RUSH_FRAG, { uRush: { value: 0 }, uFlow: { value: 0 } });
    this.rushRibbon = new THREE.Mesh(ribbon, this.rushMaterial);
    this.rushRibbon.frustumCulled = false;
    this.rushRibbon.renderOrder = 4;
    this.rushRibbon.visible = false;
    const uv = ribbon.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, this.ribbonFrom + uv.getY(i) * (this.ribbonTo - this.ribbonFrom));
    this.group.add(this.rushRibbon);
    this.whirlMaterial = film(WHIRL_FRAG, { uWhirl: { value: 0 } });
    this.whirlDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.whirlMaterial);
    this.whirlDisc.scale.setScalar(k.plugScale * 1.6);
    this.whirlDisc.position.set(plugX, plugY + 0.3, plugZ);
    this.whirlDisc.renderOrder = 4;
    this.whirlDisc.visible = false;
    this.group.add(this.whirlDisc, this.splash.points);
    this.pose(0);
  }

  /** Where the fleet must stop: against the shoal until the pools rise, then against the plug until it is out. */
  get gate(): number {
    const k = tuning.littleBoats;
    if (!this.risen) return k.barS - 1.15;
    if (!this.pulled) return k.plugS - 0.58 * k.plugScale - 0.95;
    return Infinity;
  }
  /** The obstacle waiting on the player now, while the fleet is stopped against it. */
  waiting(heroS: number): THREE.Vector3 | null {
    const g = this.gate;
    if (!Number.isFinite(g) || heroS < g - 2.5) return null;
    return this.risen ? this.plugAt : this.bathAt;
  }
  get waitingRadius(): number {
    return this.risen ? 0.58 * tuning.littleBoats.plugScale : 2;
  }

  /** Restores the state a save point implies: past the shoal, the bath has been poured. */
  restore(s: number): void {
    const k = tuning.littleBoats;
    this.risen = s > k.barS;
    this.rise = this.risen ? 1 : 0;
    this.water = this.risen ? 1 - k.pourNeeded : 1;
    this.tip = this.tipV = this.surge = 0;
    this.loose = this.rush = this.haul = this.haulV = this.swing = this.whirl = 0;
    this.pulled = false;
    this.idle = 0;
  }

  /** A stroke pushing across the bath toward the stream tips it over; a stroke across the plug only rocks it in its hole. */
  brush(camera: THREE.Camera, input: PointerInput, heroS: number, dt: number): void {
    const k = tuning.littleBoats;
    const strength = Math.min(1, input.gust / 12);
    if (this.water > 1 - k.pourNeeded) {
      const hit = screenBrush(camera, this.bathAt, input.prevNdc, input.ndc, this.screenRadius(camera, this.bathAt, 2.4));
      if (hit > 0.01) {
        const aspect = (camera as THREE.PerspectiveCamera).aspect;
        const sx = (input.ndc.x - input.prevNdc.x) * aspect, sy = input.ndc.y - input.prevNdc.y;
        const along = (sx * Math.cos(this.pushAngle) + sy * Math.sin(this.pushAngle)) / Math.max(1e-6, Math.hypot(sx, sy));
        this.tipV += k.bathPush * hit * strength * (along > 0 ? along : along * k.bathAgainst);
        if (along > 0) this.sincePush = 0;
        if (!this.risen && along > 0.3) this.idle = 0;
      }
    }
    if (!this.pulled) {
      const hit = screenBrush(camera, this.plugAt, input.prevNdc, input.ndc, this.screenRadius(camera, this.plugAt, 0.58 * k.plugScale));
      if (hit > 0.01) {
        const push = hit * strength;
        this.rockVX += input.gustDir.y * k.plugRock * push;
        this.rockVZ -= input.gustDir.x * k.plugRock * push;
      }
    }
  }

  /** While the fleet waits aground, now and then the island's own gust shows which way the bath tips. */
  breeze(wind: WindField, heroS: number, dt: number): void {
    const k = tuning.littleBoats;
    if (this.risen || heroS < this.gate - 2.5) { this.nudgeClock = 0; this.nudgeAt = -1; return; }
    this.nudgeClock += dt;
    if (this.nudgeAt < 0 && this.sincePush > 3 && this.nudgeClock > (this.nudges ? k.nudgeEvery : k.nudgeFirst)) {
      this.nudgeAt = 0;
      this.nudgeClock = 0;
      this.nudges++;
      this.tmp.subVectors(this.pourAt, this.bathAt).setY(0).normalize();
      this.nudgeFrom.copy(this.bathAt).addScaledVector(this.tmp, -6);
      this.nudgeTo.copy(this.pourAt).addScaledVector(this.tmp, 3);
      this.nudgeLast.copy(this.nudgeFrom);
      this.gustDir.copy(this.tmp);
      this.gustFrom.copy(this.bathAt).addScaledVector(this.tmp, -2.5);
      this.gustStarted = true;
    }
    if (this.nudgeAt < 0) return;
    const before = this.nudgeAt;
    this.nudgeAt = Math.min(1, this.nudgeAt + dt / k.nudgeFor);
    for (const at of [0.32, 0.62]) if (before < at && this.nudgeAt >= at) this.tipV += k.nudgeTip;
    this.out.lerpVectors(this.nudgeFrom, this.nudgeTo, this.nudgeAt);
    this.tmp.subVectors(this.nudgeTo, this.nudgeFrom).setY(0).normalize();
    const fade = Math.sin(this.nudgeAt * Math.PI);
    wind.addSplat({ source: this, trail: true, ax: this.nudgeLast.x, az: this.nudgeLast.z, bx: this.out.x, bz: this.out.z,
      vx: this.tmp.x * k.nudgeSpeed * fade, vz: this.tmp.z * k.nudgeSpeed * fade, radius: 3.5, energy: 0.8 * fade, swirl: 0, lift: 0 });
    this.nudgeLast.copy(this.out);
    if (this.nudgeAt >= 1) this.nudgeAt = -1;
  }

  /** Where on screen a push tips the bath toward its pour. */
  aim(camera: THREE.Camera): void {
    this.screenA.copy(this.bathAt).project(camera);
    this.screenB.copy(this.pourAt).project(camera);
    this.pushAngle = Math.atan2(this.screenB.y - this.screenA.y, (this.screenB.x - this.screenA.x) * (camera as THREE.PerspectiveCamera).aspect);
    this.hintAt.lerpVectors(this.bathAt, this.pourAt, 0.55);
  }

  /** An updraft wound over the plug lifts it, but works it loose only once the fleet is waiting against it. */
  updraft(input: PointerInput, heroS: number, dt: number): void {
    const k = tuning.littleBoats;
    this.lifting = 0;
    if (this.pulled || input.muted || !input.present) return;
    const over = 1 - THREE.MathUtils.smoothstep(Math.hypot(input.updraftAt.x - this.plugRest.x, input.updraftAt.z - this.plugRest.z),
      k.plugReach * 0.5, k.plugReach);
    this.lifting = THREE.MathUtils.smoothstep(input.charge, k.plugLiftFrom, k.plugLiftFull) * over;
    if (this.lifting < 0.02 || !this.risen || heroS < this.gate - 2.5) return;
    this.loose = Math.min(1, this.loose + k.plugLiftRate * this.lifting * dt);
    this.idle = 0;
    if (this.loose >= 1) { this.pulled = true; this.haulV = k.plugPop; }
  }

  private screenRadius(camera: THREE.Camera, at: THREE.Vector3, size: number): number {
    this.screenA.copy(at).project(camera);
    this.tmp.setFromMatrixColumn(camera.matrixWorld, 0);
    this.screenB.copy(at).addScaledVector(this.tmp, size).project(camera);
    return Math.max(0.06, Math.abs(this.screenB.x - this.screenA.x) * (camera as THREE.PerspectiveCamera).aspect + 0.03);
  }

  /** `fleetOut`: the last toy has left the mouth, so the rush can settle. */
  update(dt: number, time: number, fleetOut: boolean): void {
    const k = tuning.littleBoats;
    this.idle += dt;

    this.tipV += (-k.bathSpring * this.tip - k.bathDamping * this.tipV) * dt;
    this.tip += this.tipV * dt;
    if (this.tip > k.bathTipMax) { this.tip = k.bathTipMax; this.tipV = Math.min(0, this.tipV); }
    if (this.tip < -0.04) { this.tip = -0.04; this.tipV = Math.max(0, this.tipV) * 0.3; }
    this.sincePush += dt;
    const canPour = this.water > 1 - k.pourNeeded && this.sincePush < 1.5 ? 1 : 0;
    const pouring = THREE.MathUtils.smoothstep(this.tip, k.pourFrom, k.bathTipMax) * canPour;
    this.pour += (pouring - this.pour) * (1 - Math.exp(-dt * (pouring > this.pour ? 10 : 4)));
    this.water = Math.max(1 - k.pourNeeded, this.water - pouring * k.pourRate * dt);
    if (!this.pulled) this.rise = (1 - this.water) / k.pourNeeded;
    if (!this.risen && this.rise >= 0.999) {
      this.risen = true;
      this.surge = 1;
    }
    this.surge = Math.max(0, this.surge - dt / k.surgeFor);

    this.strain += (this.lifting - this.strain) * (1 - Math.exp(-dt * (this.lifting > this.strain ? 6 : 1.2)));
    // Held in its hole by suction: each tug of the column lifts it a little, and what it has worked loose stays loose.
    const tug = this.pulled ? 0 : this.loose * 0.45 + this.strain * (0.1 + 0.12 * Math.max(0, Math.sin(time * 5.5)));
    this.heaveV += (60 * (tug - this.heave) - 7 * this.heaveV) * dt;
    this.heave += this.heaveV * dt;
    this.rockVX += (-14 * this.rockX - 3 * this.rockVX) * dt;
    this.rockVZ += (-14 * this.rockZ - 3 * this.rockVZ) * dt;
    this.rockX = THREE.MathUtils.clamp(this.rockX + this.rockVX * dt, -0.28, 0.28);
    this.rockZ = THREE.MathUtils.clamp(this.rockZ + this.rockVZ * dt, -0.28, 0.28);
    if (this.pulled) {
      this.haulV += (k.plugHaul - this.haulV) * (1 - Math.exp(-dt * 1.5));
      this.haul = Math.min(k.plugLift, this.haul + this.haulV * dt);
      this.swing += dt;
      if (this.haul > 0.9) {
        const target = fleetOut ? 0 : 1;
        this.rush += Math.sign(target - this.rush) * Math.min(Math.abs(target - this.rush), dt / (fleetOut ? k.drainFor : k.rushRise));
        this.rise = Math.max(0, this.rise - dt / k.drainFor);
      }
    }
    this.whirl = this.pulled ? Math.max(0, Math.min(1, this.haul / 1.2) - Math.max(0, this.swing - 3) * 0.12) : 0;

    this.flow += dt * this.rush * k.rushSpeed * 0.5;

    this.pose(time);
    this.emit(time);
  }

  private pose(time: number): void {
    const k = tuning.littleBoats;
    this.bathPivot.rotation.z = -this.tip;
    const level = THREE.MathUtils.lerp(1.08, 1.92, (this.water - (1 - k.pourNeeded)) / k.pourNeeded * 0.75 + 0.25 * this.water);
    const inner = THREE.MathUtils.lerp(0.79, 0.95, THREE.MathUtils.smoothstep(level, 0.9, 1.9));
    this.bathWater.position.set(0, level, 0);
    this.bathWater.rotation.z = this.tip;
    this.bathWater.scale.set(inner * 1.55, 1, inner * 2.9);

    this.pourSheet.visible = this.pour > 0.01;
    this.pourMaterial.uniforms.uAmount.value = Math.min(1, this.pour * 1.4);
    if (this.pourSheet.visible) this.shapePour(time);

    const swing = this.pulled ? Math.sin(this.swing * 2.1) * 0.12 * Math.exp(-this.swing * 0.35) : 0;
    const jiggle = this.pulled ? 0 : Math.sin(time * 31) * 0.012 * (this.loose * Math.min(1, Math.hypot(this.rockVX, this.rockVZ)) + this.strain);
    const heave = this.pulled ? 0 : this.heave;
    const wobble = this.pulled ? 0 : this.strain * (0.03 + 0.05 * this.loose);
    this.hang.position.set(this.plugRest.x, this.plugRest.y + this.haul + heave, this.plugRest.z);
    this.hang.rotation.set(swing * 0.6, 0, swing);
    this.plug.rotation.set(this.rockX + wobble * Math.sin(time * 3.1), 0, this.rockZ + wobble * Math.cos(time * 2.6) + jiggle);
    this.plugAt.set(this.plugRest.x, this.plugRest.y + 0.8 + this.haul, this.plugRest.z);

    this.whirlDisc.visible = this.whirl > 0.01;
    this.whirlMaterial.uniforms.uWhirl.value = this.whirl;
    this.whirlDisc.position.y = boatsWaterHeight(this.plugRest.x, this.plugRest.z, time) + 0.06;
    this.rushRibbon.visible = this.rush > 0.01;
    this.rushMaterial.uniforms.uRush.value = this.rush;
    this.rushMaterial.uniforms.uFlow.value = this.flow;
    if (this.rushRibbon.visible) this.shapeRibbon(time);
  }

  /** The sheet leaves the low rim with the bath's tilt and falls in a parabola to the pool beside it. */
  private shapePour(time: number): void {
    const p = this.pourSheet.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.bathPivot.updateWorldMatrix(true, true);
    const bath = this.bathPivot.children[0];
    const half = 0.6 + 0.9 * Math.min(1, this.pour * 1.3);
    this.out.set(1, 0, 0).transformDirection(this.bathRoot.matrixWorld);
    this.out.y = 0;
    this.out.normalize();
    for (let i = 0; i <= this.pourSegments; i++) {
      const u = i / this.pourSegments;
      for (let j = 0; j < 2; j++) {
        const side = (j === 0 ? -1 : 1) * half * (1 + u * 0.25);
        this.lip.set(1.66, 1.99, side).applyMatrix4(bath.matrixWorld);
        const reach = 1.1 + this.pour * 0.9;
        const x = this.lip.x + this.out.x * reach * u, z = this.lip.z + this.out.z * reach * u;
        const floor = boatsWaterHeight(x, z, time) + 0.02;
        const y = THREE.MathUtils.lerp(this.lip.y, floor, u * u);
        p.setXYZ(i * 2 + j, x, Math.max(y, Math.min(this.lip.y, heightAt(x, z) + 0.05)), z);
      }
    }
    p.needsUpdate = true;
    const last = this.pourSegments * 2;
    this.pourAt.set((p.getX(last) + p.getX(last + 1)) / 2, p.getY(last), (p.getZ(last) + p.getZ(last + 1)) / 2);
  }

  private shapeRibbon(time: number): void {
    const p = this.rushRibbon.geometry.getAttribute('position') as THREE.BufferAttribute;
    const cols = 9;
    for (let r = 0; r <= this.ribbonSteps; r++) {
      const s = this.ribbonFrom + (r / this.ribbonSteps) * (this.ribbonTo - this.ribbonFrom);
      boatsCourse(s, this.course);
      const width = s <= 107 ? Math.min(boatsWidth(s) * 0.9, 3.2) : boatsWidth(107) * 0.9 + (s - 107) * 0.16;
      const spread = THREE.MathUtils.smoothstep(s, 109, 133);
      for (let c = 0; c < cols; c++) {
        const offset = (c / (cols - 1) - 0.5) * 2 * width;
        const x = this.course.x + offset * THREE.MathUtils.lerp(1, -Math.cos(this.course.yaw), spread);
        const z = this.course.z + offset * Math.sin(this.course.yaw) * spread;
        // PlaneGeometry rows run top to bottom: row 0 is the far (downstream) end.
        p.setXYZ((this.ribbonSteps - r) * cols + c, x, boatsWaterHeight(x, z, time) + 0.03, z);
      }
    }
    p.needsUpdate = true;
  }

  private emit(time: number): void {
    const k = tuning.littleBoats;
    if (this.pour > 0.15) {
      const p = this.pourSheet.geometry.getAttribute('position') as THREE.BufferAttribute;
      const last = this.pourSegments * 2;
      const n = Math.ceil(this.pour * 3);
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        this.splash.emit(
          THREE.MathUtils.lerp(p.getX(last), p.getX(last + 1), t), p.getY(last) + 0.05,
          THREE.MathUtils.lerp(p.getZ(last), p.getZ(last + 1), t), time, 1.1, 1.6 + this.pour);
      }
    }
    const seep = this.pulled ? 0 : this.loose * 0.25 + this.strain * 1.6;
    for (let i = 0; i < 2; i++) {
      if (Math.random() >= seep - i) continue;
      const a = Math.random() * Math.PI * 2, r = (0.5 + Math.random() * 0.1) * k.plugScale;
      const x = this.plugRest.x + Math.cos(a) * r, z = this.plugRest.z + Math.sin(a) * r;
      this.splash.emit(x, boatsWaterHeight(x, z, time) + 0.03, z, time, 0.25 + this.strain * 0.25, 0.7 + this.loose + this.strain);
    }
    if (this.pulled && this.haul < 3) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5 * k.plugScale;
        const x = this.plugRest.x + Math.cos(a) * r, z = this.plugRest.z + Math.sin(a) * r;
        this.splash.emit(x, boatsWaterHeight(x, z, time) + 0.03, z, time, 0.8, 2.2);
      }
    }
  }
}
