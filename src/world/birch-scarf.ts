import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';

/** The same strip passes through all three tangles, in walking order. */
export const SCARF_SNAGS = [
  { x: 10, z: -1088, treeX: 14, treeZ: -1089, stopX: 3, stopZ: -1081, kind: 'lift' },
  { x: -8, z: -1139, treeX: -10, treeZ: -1139, stopX: -3, stopZ: -1132, kind: 'unwind' },
  { x: -5, z: -1182, treeX: -13, treeZ: -1180, stopX: -3, stopZ: -1176, kind: 'bow' },
] as const;

/** These are real trees: the long runs double back around them, rather than floating between knots. */
export const SCARF_PERCHES = [
  { x: 20, z: -1099, h: 10 }, { x: -15, z: -1104, h: 4.5 },
  { x: 24, z: -1114, h: 12 }, { x: -21, z: -1125, h: 6 }, { x: 18, z: -1130, h: 10 },
  { x: -20, z: -1148, h: 7 }, { x: 17, z: -1152, h: 11 },
  { x: -23, z: -1166, h: 4 }, { x: 18, z: -1171, h: 8 }, { x: -16, z: -1160, h: 6 },
] as const;

const ROWS = 1040;
const ACROSS = 12;
const RING = ACROSS * 2;
const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec2 vCloth;
void main() {
  vWorld = position;
  vNormal = normal;
  vCloth = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vCloth;
uniform float uScarfLength;
void main() {
  // Split the two ends into tassels, with little irregular lengths of yarn.
  float end = min(vCloth.y, uScarfLength - vCloth.y);
  float yarn = fract(vCloth.x * 17.0);
  if (end < 0.8 && (yarn > 0.67 || end < hash12(vec2(floor(vCloth.x * 17.0), 4.0)) * 0.18)) discard;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = min(vCloth.x, 1.0 - vCloth.x);
  // Stockinette: nested V-shaped yarn loops, with broad ribs still visible when the fine fibres recede.
  vec2 stitches = vec2(vCloth.x * 25.0, vCloth.y * 15.0);
  float course = fract(stitches.y + abs(fract(stitches.x) - 0.5) * 1.25);
  float yarnHeight = exp(-pow((course - 0.5) * 6.5, 2.0));
  float aa = 1.0 - smoothstep(0.35, 1.5, max(fwidth(stitches.x), fwidth(stitches.y)));
  float ribs = cos(vCloth.x * 25.0 * 6.2831);
  float relief = yarnHeight * aa * 0.016;
  vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
  vec3 rx = cross(dpdy, N), ry = cross(N, dpdx);
  float det = dot(dpdx, rx);
  N = normalize(N - (dFdx(relief) * rx + dFdy(relief) * ry) / (abs(det) + 0.00001) * sign(det));
  float hem = 1.0 - smoothstep(0.025, 0.085, edge);
  vec3 red = mix(vec3(0.43, 0.020, 0.033), vec3(0.30, 0.008, 0.018), hem * 0.55);
  red *= 0.91 + yarnHeight * aa * 0.16 + ribs * aa * 0.04;
  red *= 1.0 - 0.065 * smoothstep(0.3, 0.48, abs(fract(vCloth.y / 7.0) - 0.5));
  float sun = max(0.35, groundAt(vWorld.xz).w) * cloudShadow(vWorld.xz);
  float through = max(0.0, dot(-N, uSunDir)) * 0.13;
  float nap = pow(1.0 - abs(dot(N, V)), 3.0);
  vec3 col = red * (hemiLight(N) * 1.25 + uGroundBounce * 0.4 + uSunColor * (max(0.0, dot(N, uSunDir)) * 0.85 + through) * sun);
  col += vec3(0.18, 0.045, 0.04) * nap * (0.35 + 0.35 * sun);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface Snag {
  center: THREE.Vector3;
  before: THREE.Vector3;
  work: number;
  release: number;
  freed: boolean;
  impulse: number;
}
interface Section { tied: THREE.CatmullRomCurve3; loose: THREE.CatmullRomCurve3; snag: number; count: number }
const ground = (x: number, z: number, above: number): THREE.Vector3 => new THREE.Vector3(x, Math.max(0, heightAt(x, z)) + above, z);
const smooth = (x: number): number => THREE.MathUtils.smootherstep(x, 0, 1);

/** An authored drape with spring-driven cloth: tangles keep their shape until wind actually unthreads them. */
export class BirchScarf {
  readonly mesh: THREE.Mesh;
  readonly snags: Snag[] = SCARF_SNAGS.map(s => ({
    center: ground(s.x, s.z, s.kind === 'bow' ? 2.1 : 3.5), before: ground(s.stopX, s.stopZ, 0),
    work: 0, release: 0, freed: false, impulse: 0,
  }));
  active = -1;
  woven = 0;
  private gathering = 0;
  private readonly sections: Section[] = [];
  private readonly tied: THREE.Vector3[] = [];
  private readonly loose: THREE.Vector3[] = [];
  private readonly centre: THREE.Vector3[] = [];
  private readonly winds: THREE.Vector3[] = [];
  private readonly velocities: THREE.Vector3[] = [];
  private readonly owner: number[] = [];
  private readonly pins: number[] = [];
  private readonly heights: number[] = [];
  private readonly lengths: number[] = [];
  private readonly positions = new Float32Array(ROWS * RING * 3);
  private readonly normals = new Float32Array(ROWS * RING * 3);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly point = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly transported = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly projected = new THREE.Vector3();
  private readonly boatEnd = new THREE.Vector3(-4, 3, -1197);
  private elapsed = 0;

  constructor() {
    this.route();
    for (const section of this.sections) {
      for (let j = 0; j < section.count; j++) {
        const u = j / section.count;
        const a = section.tied.getPoint(u), b = section.loose.getPoint(u);
        this.tied.push(a); this.loose.push(b); this.centre.push(a.clone());
        this.winds.push(new THREE.Vector3()); this.velocities.push(new THREE.Vector3()); this.owner.push(section.snag);
        const trunkGap = Math.min(...SCARF_PERCHES.map(t => Math.hypot(t.x - a.x, t.z - a.z)));
        this.pins.push(Math.sin(Math.PI * u) ** 0.7 * THREE.MathUtils.smoothstep(trunkGap, 1, 3));
        this.heights.push(Math.max(0, heightAt(a.x, a.z)));
      }
    }
    let length = 0;
    this.tied.forEach((p, i) => { if (i) length += p.distanceTo(this.tied[i - 1]); this.lengths.push(length); });
    const uv = new Float32Array(ROWS * RING * 2);
    const indices: number[] = [];
    for (let i = 0; i < ROWS; i++) for (let j = 0; j < RING; j++) {
      const k = i * RING + j, next = i * RING + (j + 1) % RING;
      uv[k * 2] = (j < ACROSS ? j : RING - 1 - j) / (ACROSS - 1);
      uv[k * 2 + 1] = this.lengths[i];
      if (i < ROWS - 1) indices.push(k, k + RING, next, next, k + RING, next + RING);
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uScarfLength: { value: length } }, side: THREE.DoubleSide }));
    this.mesh.name = 'impossibly-long-red-scarf';
    this.mesh.frustumCulled = false;
    this.write(0);
  }

  get completed(): number { return this.snags.filter(s => s.freed).length; }
  get finished(): boolean { return this.woven >= 1; }
  get focus(): THREE.Vector3 | null { return this.snags[this.active]?.center ?? null; }

  /** Keep incidental trunks out of the cloth; the two trees it actually wraps are placed deliberately. */
  crosses(x: number, z: number): boolean {
    return this.tied.some(p => Math.hypot(p.x - x, p.z - z) < 1.6);
  }

  restore(count: number): void {
    this.snags.forEach((s, i) => { s.freed = i < count; s.work = s.release = s.freed ? 1 : 0; });
    this.gathering = count >= 3 ? tuning.birches.scarf.gatherSeconds : 0;
    this.woven = count >= 3 ? 1 : 0;
  }

  /** Stroke the cloth the player sees, rather than the ground beyond it under a low camera. */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField, dt: number): void {
    const snag = this.snags[this.active];
    const k = tuning.birches.scarf;
    if (!snag || snag.freed || input.muted || !input.present || input.gust < k.brushSpeed) return;
    const dx = input.ndc.x - input.prevNdc.x, dy = input.ndc.y - input.prevNdc.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.0001) return;
    let touch = 0;
    for (const offset of [-1.8, 0, 1.8]) {
      this.point.copy(snag.center); this.point.x += offset;
      touch = Math.max(touch, screenBrush(camera, this.point, input.prevNdc, input.ndc, k.brushRadius));
    }
    if (touch < 0.01) return;
    this.projected.copy(snag.center).project(camera);
    const kind = SCARF_SNAGS[this.active].kind;
    // Lift the dangling loop, sweep across the wound trunk, then draw either bow tail outward.
    const direction = kind === 'lift' ? dy / length : kind === 'unwind' ? Math.abs(dx) / length : dx / length * Math.sign(input.ndc.x - this.projected.x || dx);
    const pull = Math.max(0, direction) * Math.sqrt(touch) * Math.min(1, input.gust / 8);
    // The bow's outward stroke covers half the distance of a sweep through the other tangles.
    snag.work = Math.min(1, snag.work + pull * dt / k.loosenSeconds * (kind === 'bow' ? 2 : 1));
    snag.impulse = Math.min(1, snag.impulse + Math.sqrt(touch) * dt * 5);
    wind.addSplat({ ax: snag.center.x, az: snag.center.z, bx: snag.center.x, bz: snag.center.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust,
      radius: 3.5, energy: Math.min(0.6, input.gust / 25), lift: kind === 'lift' ? pull * 0.5 : 0, swirl: 0 });
  }

  update(dt: number, wind: WindField, boatMast?: THREE.Vector3): void {
    if (this.finished) { this.mesh.visible = false; return; }
    this.elapsed += dt;
    if (boatMast) this.boatEnd.copy(boatMast);
    const k = tuning.birches.scarf;
    for (const s of this.snags) {
      s.impulse *= Math.exp(-dt * 3);
      if (s.work >= 1) {
        s.release = Math.min(1, s.release + dt / k.releaseSeconds);
        if (s.release >= 1) s.freed = true;
      }
    }
    if (this.completed === 3) this.gathering = Math.min(k.gatherSeconds, this.gathering + dt);
    this.woven = smooth(Math.max(0, this.gathering / k.gatherSeconds - 0.45) / 0.55);
    this.mesh.visible = this.woven < 1;
    for (let i = 0; i < ROWS; i++) {
      const s = this.snags[this.owner[i]];
      const loose = s ? smooth(s.work * 0.65 + s.release * 0.35) : 0;
      const p = this.centre[i].lerpVectors(this.tied[i], this.loose[i], loose);
      const w = wind.sample(p.x, p.z, this.air);
      const f = this.pins[i] * THREE.MathUtils.smoothstep(p.y - this.heights[i], 0.1, 0.8);
      const step = Math.min(dt, .05);
      this.point.set(w.x * 0.028, w.lift * 0.12, w.z * 0.028).clampLength(0, 0.7);
      this.velocities[i].addScaledVector(this.point.sub(this.winds[i]), k.windResponse * k.windResponse * step)
        .multiplyScalar(Math.exp(-step * k.windResponse * 1.3));
      this.winds[i].addScaledVector(this.velocities[i], step);
      p.addScaledVector(this.winds[i], f);
      const wave = this.elapsed * 1.7 - i * 0.14;
      p.y += Math.sin(wave) * k.flutter * f;
      if (s && s.release < 1) {
        p.y += s.work * f * (this.owner[i] === 0 ? 2.6 : 0.45);
        p.x += Math.sin(wave * 2.2) * s.impulse * f * 0.25;
      }
      p.y = Math.max(this.heights[i] + 0.09, p.y);
      if (this.owner[i] === 1) {
        const trunk = SCARF_SNAGS[1];
        const dx = p.x - trunk.treeX, dz = p.z - trunk.treeZ;
        const radius = Math.hypot(dx, dz);
        if (radius < 1.05) {
          const angle = radius > 0.001 ? Math.atan2(dz, dx) : i * 0.2;
          p.x = trunk.treeX + Math.cos(angle) * 1.05;
          p.z = trunk.treeZ + Math.sin(angle) * 1.05;
        }
      }
    }
    // The final loose end is physically attached to the mast, including its shoreward lean.
    for (let i = ROWS - 20; i < ROWS; i++) {
      this.centre[i].lerp(this.boatEnd, smooth((i - ROWS + 20) / 19));
    }
    if (this.gathering > 0) {
      const drawn = smooth(this.gathering / k.gatherSeconds);
      // A travelling free end follows the entire drape into the mast; the strip never pops away in sections.
      for (let i = 0; i < ROWS; i++) {
        const travel = drawn * (ROWS - 1 - i);
        const at = i + travel, lo = Math.min(ROWS - 1, Math.floor(at)), hi = Math.min(ROWS - 1, lo + 1);
        this.point.lerpVectors(this.centre[lo], this.centre[hi], at - lo);
        this.tiedScratch[i].copy(this.point);
      }
      for (let i = 0; i < ROWS; i++) this.centre[i].copy(this.tiedScratch[i]);
    }
    this.write(this.elapsed);
  }

  private readonly tiedScratch = Array.from({ length: ROWS }, () => new THREE.Vector3());

  private route(): void {
    const at = (x: number, z: number, h: number) => ground(x, z, h);
    const add = (points: THREE.Vector3[], count: number, snag = -1, free = points) => {
      this.sections.push({ tied: new THREE.CatmullRomCurve3(points), loose: new THREE.CatmullRomCurve3(free), snag, count });
    };
    const a = this.snags[0].center, b = this.snags[1].center, c = this.snags[2].center;
    const local = (p: THREE.Vector3, x: number, y: number, z: number) => p.clone().add(new THREE.Vector3(x, y, z));
    const a0 = local(a, -2, -2.5, 4), a1 = local(a, 1.8, 1.5, -4);
    add([at(2,-1061,.2),at(1,-1065,.25),at(7,-1070,.4),at(3,-1077,.5),a0], 80);
    add([a0,local(a,-1,-1,1.7),local(a,.4,1.1,0),local(a,1.6,.4,-.7),local(a,.5,-1.7,-.3),local(a,-.9,-.4,.4),local(a,.2,1.2,-.1),a1], 110, 0,
      [a0,local(a,-2.8,3,1),local(a,-1.5,4.4,-1),a1]);
    const coil = (index: number, turn: number, phase = 0): THREE.Vector3[] => {
      const tree = SCARF_PERCHES[index], points: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const f = i / 10, angle = phase + f * Math.PI * 2 * turn;
        const radius = 0.9 + Math.sin(f * Math.PI) * 0.25;
        points.push(at(tree.x + Math.cos(angle) * radius, tree.z + Math.sin(angle) * radius, tree.h - f * 0.7));
      }
      return points;
    };
    const drape = (start: THREE.Vector3, groups: THREE.Vector3[][], end: THREE.Vector3): THREE.Vector3[] => {
      const points = [start];
      for (const group of [...groups, [end]]) {
        const from = points[points.length - 1], to = group[0];
        const sag = Math.min(7, from.distanceTo(to) * .22);
        for (const t of [.25, .5, .75]) {
          const p = from.clone().lerp(to, t);
          p.y = Math.max(heightAt(p.x, p.z) + .25, p.y - sag * 4 * t * (1 - t));
          points.push(p);
        }
        points.push(...group);
      }
      return points;
    };
    const b0=local(b,2,2.2,5),b1=local(b,-1,-1,-4);
    add(drape(a1,[coil(0,.85),coil(1,-.7,Math.PI),coil(2,1.25,.5),coil(3,-.85,2),coil(4,.65)],b0),290);
    const wrap:THREE.Vector3[]=[b0];
    for(let i=0;i<=14;i++){
      const t=i/14,angle=t*Math.PI*5.2;
      const radius=1.15+Math.sin(t*Math.PI)*.6;
      wrap.push(new THREE.Vector3(SCARF_SNAGS[1].treeX+Math.cos(angle)*radius,b.y+1.6-t*3.3+Math.sin(angle*1.2)*.35,b.z+Math.sin(angle)*radius));
    }
    wrap.push(b1);
    add(wrap,130,1,[b0,local(b,3,4.5,1),local(b,2,3,-2),b1]);
    const c0=local(c,-2,1,4),c1=local(c,2,-.4,-3);
    add(drape(b1,[coil(5,.9,1),coil(6,-.8),coil(7,1.2,2),coil(8,-.65),coil(9,.9,1)],c0),260);
    add([c0,local(c,-.3,0,.1),local(c,2.5,1.1,-.1),local(c,3,.1,.4),local(c,.1,-.2,0),local(c,-2.6,1,.4),local(c,-3,-.2,.6),local(c,-.1,.1,-.4),c1],110,2,
      [c0,local(c,-1,3,1),local(c,1,2.8,-1),c1]);
    add([c1,at(-1,-1188,.4),at(-7,-1191,.3),at(-4,-1197,3)],60);
  }

  private write(time: number): void {
    const width = tuning.birches.scarf.width;
    this.transported.set(1, 0, 0);
    for (let i = 0; i < ROWS; i++) {
      const p = this.centre[i];
      this.tangent.subVectors(this.centre[Math.min(ROWS - 1, i + 1)], this.centre[Math.max(0, i - 1)]).normalize();
      if (this.tangent.lengthSq() < 0.01) this.tangent.set(0, 0, -1);
      // Parallel transport avoids the abrupt flips a horizontal ribbon frame makes on hanging folds.
      this.transported.addScaledVector(this.tangent, -this.transported.dot(this.tangent)).normalize();
      if (this.transported.lengthSq() < 0.01) this.transported.set(0, 0, 1).cross(this.tangent).normalize();
      this.side.copy(this.transported);
      const length = this.lengths[i];
      const roll = length * .13 + Math.sin(length * .31) * .75 + Math.sin(length * .83) * .23
        + Math.sin(time * .8 - length * .35) * .07;
      this.side.applyAxisAngle(this.tangent, roll);
      this.normal.crossVectors(this.tangent, this.side).normalize();
      const taper = 1 - this.woven * 0.75;
      const rumple = .5 + .5 * Math.sin(length * .57 + Math.sin(length * .2));
      const bunched = .66 + .34 * (1 - rumple);
      const foldRoom = THREE.MathUtils.smoothstep(p.y - this.heights[i], .1, .5);
      for (let j = 0; j < RING; j++) {
        const back = j >= ACROSS;
        const across = (back ? RING - 1 - j : j) / (ACROSS - 1) * 2 - 1;
        // Deep, uneven lengthwise folds and softly rolled hems give the yarn a substantial silhouette.
        const fold = (Math.sin(across * Math.PI * 1.6 + length * .24) * (.09 + rumple * .1)
          + Math.pow(Math.abs(across), 5) * .13 * Math.sin(length * .42 + .5)
          + Math.sin(length * 2.1 + across * 2.4) * .025) * width;
        const thickness = (back ? -1 : 1) * .025 * width;
        const k = (i * RING + j) * 3;
        this.point.copy(p).addScaledVector(this.side, across * width * .5 * bunched * taper)
          .addScaledVector(this.normal, (fold * foldRoom + thickness) * taper);
        this.positions[k]=this.point.x;this.positions[k+1]=this.point.y;this.positions[k+2]=this.point.z;
      }
    }
    this.geometry.attributes.position.needsUpdate=true;
    // Lighting must follow each fold, including the back and the thick hem, not just the centreline.
    this.geometry.computeVertexNormals();
  }
}
