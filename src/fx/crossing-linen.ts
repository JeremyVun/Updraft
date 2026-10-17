import * as THREE from 'three';
import { GULL_SIZE, gullGeometry, gullMaterial } from '../creatures/gulls';
import { Instances } from '../creatures/shapes';
import { CREATURE_GLSL } from '../creatures/shading';
import { Cloth } from '../world/cloth-sim';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import { grassHeightAt } from '../world/grass';
import { tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { Voices, type AudioOut } from '../creatures/voices';
import { screenPan } from '../creatures/motion';

const H = 1 / 120;
const FLOOR = -20;
/**
 * Over the sea nothing stops them; on land they come to rest half sunk in the grass, held up unevenly by its tufts so
 * they drape in folds. The island of lines' grass is tall enough to swallow a sheet lying on the ground beneath it.
 */
const landFloor = (x: number, z: number): number => {
  const ground = heightAt(x, z);
  const tufts = 0.5 + 0.2 * Math.sin(x * 4.1 + z * 1.3) * Math.sin(z * 3.7 - x * 0.9);
  return ground > 0 ? ground + 0.05 + grassHeightAt(x, z) * tufts : FLOOR;
};
/** How slowly a fallen sheet must move (metres a second), for how long (seconds), before it is left lying. */
const STILL = 0.08;
const REST = 1.5;
const VERT = `out vec3 vWorld; out vec3 vNormal; out vec2 vCloth;
void main() { vWorld=position; vNormal=normal; vCloth=uv;
gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0); }`;
const FRAG = `${ATMO_GLSL}\n${CREATURE_GLSL}
in vec3 vWorld; in vec3 vNormal; in vec2 vCloth;
uniform vec3 uLinenColour; uniform vec3 uHemColour;
void main() {
  vec3 n=normalize(vNormal)*(gl_FrontFacing?1.0:-1.0);
  float edge=min(min(vCloth.x,1.0-vCloth.x),min(vCloth.y,1.0-vCloth.y));
  vec3 linen=mix(uHemColour,uLinenColour,smoothstep(.018,.04,edge));
  gl_FragColor=vec4(applyFog(shadeCreature(linen,n,vWorld,1.0,.14,.22,1.0),vWorld),1.0);
}`;

type LinenFlight = typeof tuning.opening.shoreEchoes.laundry[number];

class Linen {
  readonly cloth: Cloth;
  readonly mesh: THREE.Mesh;
  readonly anchor = new THREE.Vector3();
  private remainder = 0;
  /** It has come down on land: out of the air it was riding, it falls and drapes over the ground. */
  landed = false;
  private nearLand = false;
  private quiet = 0;
  private resting = false;
  private readonly air = { x: 0, y: 0, z: 0, spin: 0, cx: 0, cz: 0 };
  private readonly sample = { x: 0, z: 0, energy: 0, lift: 0 };
  private clock = 0;
  private readonly centre = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly radius = new THREE.Vector3();
  private readonly turn = new THREE.Vector3();
  private readonly flutter = (i: number) => 1 + .18 * Math.sin(this.clock * (4 + this.phase * .3) + i * .7 + this.phase);
  private get phase(): number { return this.flight?.phase ?? 0; }
  private readonly floor = (x: number, z: number): number => this.nearLand ? landFloor(x, z) : FLOOR;

  constructor(width: number, drop: number, readonly carried: boolean, readonly flight?: LinenFlight) {
    this.cloth = new Cloth(9, 11, width, drop);
    if (carried) { this.cloth.hold(0, 0, 0, 0); this.cloth.retether(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.cloth.view, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.cloth.normal, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.cloth.uv, 2));
    geo.setIndex(new THREE.BufferAttribute(this.cloth.index, 1));
    const colour = flight?.colour ? new THREE.Color(flight.colour) : new THREE.Color(.86, .84, .77);
    const hem = flight?.colour ? colour.clone().multiplyScalar(.82) : new THREE.Color(.69, .76, .80);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uLinenColour: { value: colour }, uHemColour: { value: hem } }, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  private touching(): boolean {
    const p = this.cloth.pos;
    for (let i = 0; i < this.cloth.count; i++) {
      if (p[i * 3 + 1] <= landFloor(p[i * 3], p[i * 3 + 2]) + 1e-3) return true;
    }
    return false;
  }

  begin(at: THREE.Vector3, right: THREE.Vector3, forward: THREE.Vector3): void {
    const c = this.cloth;
    this.anchor.copy(at); this.remainder = 0;
    this.landed = this.nearLand = this.resting = false; this.quiet = 0;
    this.axis.copy(right).multiplyScalar(Math.cos(this.phase)).addScaledVector(forward, Math.sin(this.phase));
    this.axis.y = .25 * Math.sin(this.phase * 1.7); this.axis.normalize();
    for (let i = 0; i < c.count; i++) {
      const u = i % c.cols / (c.cols - 1), v = Math.floor(i / c.cols) / (c.rows - 1);
      const fold = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * c.width * .3;
      c.place(i, at.x + right.x * u * c.width + forward.x * (fold - v * c.drop * .35),
        at.y - v * c.drop, at.z + right.z * u * c.width + forward.z * (fold - v * c.drop * .35));
      c.kick(i, forward.x * 6, 0, forward.z * 6, H);
    }
    c.blend(1); this.mesh.visible = true;
  }

  update(dt: number, time: number, wind: WindField, flow: THREE.Vector3): void {
    const c = this.cloth, k = tuning.opening.shoreEchoes;
    if (this.resting) return;
    this.clock = this.landed ? this.clock + dt : time;
    const w = wind.sample(c.pos[0], c.pos[2], this.sample);
    const flight = this.flight;
    const speed = this.landed ? 0 : flight ? flight.speed * (1 + .3 * Math.sin(time * flight.rate + this.phase)) : 1;
    const angle = flight ? flight.veer * Math.sin(time * flight.rate * .6 + this.phase) : 0;
    this.air.x = (flow.x * Math.cos(angle) + flow.z * Math.sin(angle)) * speed + THREE.MathUtils.clamp(w.x, -12, 12) * .15;
    this.air.z = (flow.z * Math.cos(angle) - flow.x * Math.sin(angle)) * speed + THREE.MathUtils.clamp(w.z, -12, 12) * .15;
    this.remainder += dt;
    while (this.remainder >= H) {
      if (this.carried) c.hold(0, this.anchor.x, this.anchor.y, this.anchor.z);
      this.air.y = .5;
      if (this.landed) this.air.y = 0;
      else if (flight) {
        this.centre.set(0, 0, 0);
        for (let i = 0; i < c.count; i++) {
          this.centre.x += c.pos[i * 3]; this.centre.y += c.pos[i * 3 + 1]; this.centre.z += c.pos[i * 3 + 2];
        }
        this.centre.multiplyScalar(1 / c.count);
        this.nearLand = heightAt(this.centre.x, this.centre.z) > -3;
        const height = flight.height + Math.sin(time * flight.rate + this.phase) * flight.bob;
        this.air.y = k.laundryLift + (height - this.centre.y) * k.laundrySteady;
        const torque = k.laundryTurn * flight.roll * (.8 + .7 * Math.sin(time * flight.rate * 1.5 + this.phase));
        for (let i = 0; i < c.count; i++) {
          this.radius.fromArray(c.pos, i * 3).sub(this.centre);
          this.turn.crossVectors(this.axis, this.radius).multiplyScalar(torque * H);
          c.kick(i, this.turn.x, this.turn.y, this.turn.z, H);
        }
      }
      c.step(H, this.air, .09, .35, 7, this.flutter, this.floor, [], this.carried ? .45 : 2);
      this.remainder -= H;
      if (this.nearLand && !this.landed) this.landed = this.touching();
      if (this.landed) {
        this.quiet = c.motion(H) < STILL ? this.quiet + H : 0;
        if (this.quiet > REST) { this.resting = true; this.remainder = 0; break; }
      }
    }
    c.blend(this.remainder / H);
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }
}

export class CrossingLinen {
  readonly birds: THREE.Mesh;
  readonly objects: THREE.Object3D[];
  private readonly instances = new Instances(gullGeometry(), tuning.opening.shoreEchoes.gulls, ['iPos', 'iAtt', 'iWing']);
  private readonly linen = [new Linen(1.05, 1.3, true),
    ...tuning.opening.shoreEchoes.laundry.map(f => new Linen(f.width, f.drop, false, f))];
  private readonly origin = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly flow = new THREE.Vector3();
  private readonly frustum = new THREE.Frustum();
  private readonly projection = new THREE.Matrix4();
  private readonly bounds = new THREE.Sphere();
  private readonly screenRight = new THREE.Vector3();
  private readonly spawn = new THREE.Vector3();
  private readonly turn = new THREE.Euler(0, 0, 0, 'YZX');
  private started = false;
  private previous = -Infinity;
  private readonly voices = new Voices();

  constructor(private readonly wind: WindField, private readonly camera: THREE.Camera) {
    this.birds = new THREE.Mesh(this.instances.geometry, gullMaterial());
    this.birds.frustumCulled = false;
    this.objects = [this.birds, ...this.linen.map(l => l.mesh)];
  }

  private outsideFrame(point: THREE.Vector3, radius: number): void {
    this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    this.bounds.set(point, radius);
    if (!this.frustum.intersectsSphere(this.bounds)) return;
    this.screenRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const edge = this.frustum.planes[this.right.dot(this.screenRight) >= 0 ? 1 : 0];
    const distance = (edge.distanceToPoint(point) + radius + tuning.opening.shoreEchoes.spawnMargin)
      / edge.normal.dot(this.screenRight);
    point.addScaledVector(this.screenRight, -distance);
  }

  /** `keepLanded` leaves any sheet that came down on the island lying there once the crossing is over. */
  update(dt: number, crossing: number | undefined, boat: THREE.Vector3, heading: number, audio: AudioOut | null,
    keepLanded = false): void {
    this.voices.setOutput(audio);
    const k = tuning.opening.shoreEchoes, t = (crossing ?? -Infinity) - k.afterFarewell;
    if (t < 0 || t > k.duration) {
      this.instances.commit(0);
      this.linen.forEach(l => {
        if (keepLanded && l.landed && l.mesh.visible) l.update(dt, 0, this.wind, this.flow);
        else l.mesh.visible = false;
      });
      this.started = false; this.previous = -Infinity;
      return;
    }
    if (!this.started) {
      this.origin.copy(boat);
      this.forward.set(Math.sin(heading), 0, Math.cos(heading));
      this.right.set(this.forward.z, 0, -this.forward.x);
      this.spawn.copy(this.origin).addScaledVector(this.right, -k.span - 17.5)
        .addScaledVector(this.forward, k.ahead).setY(k.height + k.followerHeight);
      this.point.copy(this.spawn);
      this.outsideFrame(this.spawn, 28);
      this.origin.add(this.spawn.sub(this.point));
      this.started = true;
      this.previous = t;
    }
    for (let i = 0; i < k.gulls; i++) {
      const phase = t * .3 + i * 1.7, side = k.crossSpeed + Math.cos(phase) * 1.2;
      const forward = k.forwardSpeed + Math.cos(phase * .8) * .8;
      const yaw = Math.atan2(this.forward.x * forward + this.right.x * side,
        this.forward.z * forward + this.right.z * side);
      const bank = .16 * Math.sin(phase), pitch = -.04 + .06 * Math.cos(phase);
      this.point.copy(this.origin).addScaledVector(this.right, -k.span + t * k.crossSpeed - i * k.gullSpacing + Math.sin(phase) * 4)
        .addScaledVector(this.forward, k.ahead + t * k.forwardSpeed + (i % 3 - 1) * 9 + Math.sin(phase * .8) * 3.3);
      this.point.y = k.height + (i % 3) * k.followerHeight + Math.sin(phase) * 1.1;
      this.instances.set(0, i, this.point.x, this.point.y, this.point.z, yaw);
      this.instances.set(1, i, pitch, bank, 0, 0);
      const flap = Math.sin((t + i) * 5.5) * .22 * Math.max(0, Math.sin((t + i) * .7));
      this.instances.set(2, i, -.08 + flap, -.12 + flap * .65, .04, 0);
      if (i === 0) {
        this.turn.set(pitch, yaw, bank);
        this.linen[0].anchor.set(0, .05, .575).multiplyScalar(GULL_SIZE).applyEuler(this.turn).add(this.point);
        if (this.previous < 12 && t >= 12) this.voices.cry(screenPan(this.camera, this.point),
          .65 / (1 + this.point.distanceTo(this.camera.position) / 60));
      }
    }
    this.instances.commit(k.gulls);
    this.flow.copy(this.forward).multiplyScalar(k.forwardSpeed).addScaledVector(this.right, k.crossSpeed);
    for (let i = 0; i < this.linen.length; i++) {
      const l = this.linen[i], flight = l.flight, start = flight?.at ?? 0;
      if (t < start) continue;
      if (!l.mesh.visible) {
        if (i === 0) this.point.copy(l.anchor);
        else this.point.copy(this.origin).addScaledVector(this.right, -k.span + flight!.side)
          .addScaledVector(this.forward, k.ahead + start * k.forwardSpeed + flight!.depth).setY(flight!.height);
        if (!l.carried) this.outsideFrame(this.point, Math.hypot(l.cloth.width, l.cloth.drop));
        l.begin(this.point, this.right, this.forward);
      }
      l.update(dt, t - start, this.wind, this.flow);
    }
    this.previous = t;
  }
}
