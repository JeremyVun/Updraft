import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WindGesture } from '../fx/wind-gesture';
import { tuning } from '../tuning';
import { atmo } from './atmosphere';
import { CLOTH_FRAG, CURTAIN_VERT, PAINT_FRAG, WOOD_FRAG, WOOD_VERT, passagePegGeometry } from './lines';
import { rotaryWashing, ROTARY_SHEET_INTERVALS, type RotaryFrame } from './lines-rotary';

const K = tuning.rotaryWashing;
const UP = new THREE.Vector3(0, 1, 0);

function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 7);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

function paint(colour: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms, uPaint: { value: new THREE.Color(colour) } },
    vertexShader: WOOD_VERT, fragmentShader: PAINT_FRAG });
}

class FrameRig {
  readonly group = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly spin = { value: 0 };
  private readonly gesture = new WindGesture('rotary-washing-invitation');
  private readonly invitationAt = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly snag = { value: 1 };
  private snagRate = 0;
  private readonly snagPull = { value: 0 };
  private readonly snagAt = { value: new THREE.Vector3() };
  private elapsed = 0;
  private alpha = 0;
  private wasCaught = false;

  constructor(private readonly frame: RotaryFrame, subject: THREE.Vector4) {
    this.group.name = 'rotary-washing-' + frame.index;
    this.group.position.copy(frame.foot);
    this.rotor.rotation.y = frame.angle;
    this.snag.value = frame.unhook < 1 ? 1 : 0;
    this.snagAt.value.copy(frame.snagPoint);
    this.wasCaught = !!frame.snagTarget;
    this.group.add(this.rotor);
    const mast = new THREE.CylinderGeometry(0.13, 0.19, K.top + 0.3, 10).translate(0, (K.top + 0.3) / 2, 0);
    this.group.add(new THREE.Mesh(mast, paint('#a9b4a0')));
    const hardware = paint('#79847a');
    const collar = new THREE.CylinderGeometry(0.29, 0.3, 0.42, 12).translate(0, K.top - 1.75, 0);
    this.rotor.add(new THREE.Mesh(collar, hardware));
    const arms: THREE.BufferGeometry[] = [], ropes: THREE.BufferGeometry[] = [], pegs: THREE.BufferGeometry[] = [];
    const point = (i: number, r: number) => new THREE.Vector3(Math.cos(i * Math.PI / 2) * r, K.top, Math.sin(i * Math.PI / 2) * r);
    for (let i = 0; i < 4; i++) {
      arms.push(rod(new THREE.Vector3(0, K.top, 0), point(i, K.radius), 0.065));
      arms.push(rod(new THREE.Vector3(0, K.top - 1.75, 0), point(i, K.radius * 0.57), 0.045));
      for (const size of [0.38, 0.68, 1]) {
        const a = point(i, K.radius * size), b = point(i + 1, K.radius * size);
        const points = Array.from({ length: 17 }, (_, j) => a.clone().lerp(b, j / 16)
          .add(new THREE.Vector3(0, -Math.sin(j / 16 * Math.PI) * 0.12 * size, 0)));
        ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.019, 4));
        if (i === 0 || i === 3) {
          const pieces = size === 1 ? 2 : 1;
          for (let piece = 0; piece < pieces; piece++) {
            const [lo, hi] = size === 1 ? ROTARY_SHEET_INTERVALS[piece] : [0.08, 0.92];
            const drop = size === 1 ? 5.05 + piece * 0.25 : 1.15 + size;
            const geometry = new THREE.PlaneGeometry(1, 1, 18, 20);
            const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
            for (let n = 0; n < pos.count; n++) {
              const t = THREE.MathUtils.lerp(lo, hi, uv.getX(n)), hang = 1 - uv.getY(n);
              const p = a.clone().lerp(b, t);
              p.y -= Math.sin(t * Math.PI) * 0.12 * size + drop * hang;
              const r = Math.sin(uv.getX(n) * Math.PI * 6) * 0.07 * hang;
              p.x += r; p.z += r;
              pos.setXYZ(n, p.x, p.y, p.z);
            }
            geometry.computeVertexNormals();
            const material = new THREE.ShaderMaterial({
              uniforms: { ...atmo.uniforms, uSubject: { value: subject }, uFamilyFlutter: { value: 0 },
                uColor: { value: new THREE.Color(frame.index ? (piece ? '#a7baca' : '#89a5b8') : (piece ? '#adc1ab' : '#94ae9d')) },
                uSpin: this.spin,
                uCentre: { value: frame.foot }, uSnagAt: this.snagAt, uSnagPull: this.snagPull,
                uSnag: frame.index === 1 && i === 3 && size === 1 && piece === 1 ? this.snag : { value: 0 }, uRotary: { value: 1 } },
              // The passage curtains' program, switched to the rotary's sheets.
              vertexShader: CURTAIN_VERT, fragmentShader: CLOTH_FRAG,
              side: THREE.DoubleSide, alphaToCoverage: true,
            });
            const cloth = new THREE.Mesh(geometry, material);
            cloth.frustumCulled = false;
            this.rotor.add(cloth);
            for (const t of [lo, hi]) {
              const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.12 * size;
              pegs.push(passagePegGeometry().scale(0.8, 0.8, 0.8).rotateY(Math.atan2(a.z - b.z, b.x - a.x))
                .translate(p.x, p.y + 0.04, p.z));
            }
          }
        } else if (size === 1) {
          for (const t of [0.2, 0.67]) {
            const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.12;
            pegs.push(passagePegGeometry().scale(0.8, 0.8, 0.8).translate(p.x, p.y + 0.04, p.z));
          }
        }
      }
    }
    this.rotor.add(new THREE.Mesh(mergeGeometries(arms), paint('#a3ae9b')));
    this.rotor.add(new THREE.Mesh(mergeGeometries(ropes), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms }, vertexShader: WOOD_VERT, fragmentShader: WOOD_FRAG })));
    this.rotor.add(new THREE.Mesh(mergeGeometries(pegs), paint('#d9c29b')));
    const stop = new THREE.BoxGeometry(0.22, 0.25, 0.54).translate(-0.18, K.top - 1.68, 0.12);
    this.group.add(new THREE.Mesh(stop, paint('#79847a')));
    const lug = new THREE.BoxGeometry(0.22, 0.22, 0.46).translate(0.22, K.top - 1.68, 0.12);
    this.rotor.add(new THREE.Mesh(lug, hardware));
    this.group.add(this.gesture.batch.mesh);
    this.gesture.batch.mesh.position.copy(frame.foot).negate();
    if (frame.index === 1) {
      const p = frame.snagPoint.clone().sub(frame.foot);
      const foot = p.clone().setY(0);
      this.group.add(new THREE.Mesh(rod(foot, p.clone().add(new THREE.Vector3(0, 0.2, 0)), 0.12), paint('#938574')));
      const cap = new THREE.SphereGeometry(0.2, 8, 6).translate(p.x, p.y, p.z);
      this.group.add(new THREE.Mesh(cap, paint('#b8a58a')));
      const end = p.clone().add(new THREE.Vector3(2.2, 0.35, -8));
      this.group.add(new THREE.Mesh(rod(end.clone().setY(0), end, 0.1), paint('#938574')));
      this.group.add(new THREE.Mesh(rod(p, end, 0.022), paint('#c2b9a2')));
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    const r = this.frame;
    const spring = K.releaseSpring;
    this.snagRate += (spring * spring * ((r.unhook < 1 ? 1 : 0) - this.snag.value) - 2 * K.releaseDamping * spring * this.snagRate) * dt;
    this.snag.value += this.snagRate * dt;
    // Caught again it settles onto the pole rather than past it.
    if (this.snag.value > 1) { this.snag.value = 1; this.snagRate = 0; }
    this.snagAt.value.copy(r.snagPoint);
    this.snagPull.value = r.snagPull;
    this.rotor.rotation.y = r.angle;
    this.spin.value += (r.speed - this.spin.value) * (1 - Math.exp(-dt * 4));
    this.gesture.hide();
    const next = rotaryWashing.rotors.find(frame => !frame.open);
    const caught = !!r.snagTarget;
    if (caught !== this.wasCaught) { this.elapsed = 0; this.alpha = 0; this.wasCaught = caught; }
    if (!rotaryWashing.active || next !== r || r.aligned) { this.elapsed = 0; this.alpha = 0; return; }
    this.elapsed += dt;
    const offered = this.elapsed > K.inviteAfter && Math.min(r.brushAge, r.snagAge) > K.invitePause;
    this.alpha += ((offered ? 0.8 : 0) - this.alpha) * (1 - Math.exp(-dt * 4));
    const phase = (Math.max(0, this.elapsed - K.inviteAfter) % (K.inviteSweep + K.invitePause)) / K.inviteSweep;
    if (caught) {
      this.projected.copy(r.snagPoint).project(camera);
      r.clothPoint(-1, 0.96, 5.3, this.point).project(camera).sub(this.projected);
      const tilt = Math.atan2(this.point.y, this.point.x * ((camera as THREE.PerspectiveCamera).aspect ?? 1));
      this.gesture.draw(camera, r.snagPoint, phase, K.snagInviteSpan, this.alpha, 0.08, 'across', 1, tilt, true);
      return;
    }
    let nearest = Infinity;
    for (const side of [-1, 1]) for (const fraction of [0.24, 0.76]) {
      r.clothPoint(side, fraction, 2.6, this.point);
      this.projected.copy(this.point).project(camera);
      if (Math.abs(this.projected.x) > 0.8 || Math.abs(this.projected.y) > 0.8) continue;
      const distance = this.point.distanceToSquared(camera.position);
      if (distance < nearest) { nearest = distance; this.invitationAt.copy(this.point); }
    }
    if (!Number.isFinite(nearest)) return;
    const direction = r.preferredDirection;
    this.tangent.set(this.invitationAt.z - r.foot.z, 0, r.foot.x - this.invitationAt.x).normalize();
    this.projected.copy(this.invitationAt).project(camera);
    this.point.copy(this.invitationAt).addScaledVector(this.tangent, direction).project(camera).sub(this.projected);
    const tilt = Math.atan2(this.point.y, this.point.x * ((camera as THREE.PerspectiveCamera).aspect ?? 1));
    this.gesture.draw(camera, this.invitationAt, phase, K.radius * 0.7, this.alpha, 0.1, 'across', 1, tilt, true);
  }
}

export class RotaryWashingRig {
  readonly group = new THREE.Group();
  private readonly frames: FrameRig[];
  constructor(subject: THREE.Vector4) {
    this.frames = rotaryWashing.rotors.map(r => new FrameRig(r, subject));
    this.frames.forEach(r => this.group.add(r.group));
  }
  update(dt: number, camera: THREE.Camera): void { this.frames.forEach(r => r.update(dt, camera)); }
}
