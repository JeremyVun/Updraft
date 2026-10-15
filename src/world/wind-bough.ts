import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AudioOut } from '../creatures/voices';
import type { WindPhrase } from '../audio/meadow-duet';
import { meadowMusic } from '../audio/meadow-music';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import type { WindField } from '../wind/field';
import { tuning } from '../tuning';
import { atmo, ATMO_GLSL } from './atmosphere';
import { heightAt } from './island';
import { PLACE } from './piano';

const VERT = /* glsl */ `
in vec3 color;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = color;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float grain = vnoise(vec2(vWorld.y * 2.0, (vWorld.x + vWorld.z) * 28.0));
  vec3 wood = vTint * (0.86 + grain * 0.25);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float wrap = pow(clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 1.7);
  vec3 col = wood * (hemiLight(N) * 1.12 + uGroundBounce * 0.75 + uSunColor * wrap * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function hollowBough(points: number[][], radius: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const steps = 48, sides = 20, frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [], colours: number[] = [], indices: number[] = [];
  const outer = new THREE.Color('#918169'), inner = new THREE.Color('#504332'), rim = new THREE.Color('#c7b797');
  for (let wall = 0; wall < 2; wall++) for (let i = 0; i <= steps; i++) {
    const t = i / steps, centre = curve.getPointAt(t);
    const flare = 1 + .9 * THREE.MathUtils.smoothstep(t, .78, 1);
    const r = radius * flare * (1 - .25 * Math.sin(t * Math.PI)) - wall * radius * .25;
    const colour = (wall ? inner : outer).clone().lerp(rim, THREE.MathUtils.smoothstep(t, .94, 1) * .75);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const uneven = 1 + .05 * Math.sin(a * 3 + t * 8);
      const p = centre.clone().addScaledVector(frames.normals[i], Math.cos(a) * r * uneven)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r * uneven);
      positions.push(p.x, p.y, p.z); colours.push(colour.r, colour.g, colour.b);
      if (i < steps && j < sides) {
        const q = wall * (steps + 1) * (sides + 1) + i * (sides + 1) + j;
        const n = q + sides + 1;
        if (wall) indices.push(q, q + 1, n, q + 1, n + 1, n);
        else indices.push(q, n, q + 1, q + 1, n, n + 1);
      }
    }
  }
  const offset = (steps + 1) * (sides + 1);
  for (let j = 0; j < sides; j++) {
    const q = steps * (sides + 1) + j;
    indices.push(q, q + 1, q + offset, q + 1, q + offset + 1, q + offset);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

export class WindBough {
  readonly group = new THREE.Group();
  readonly mouth = new THREE.Vector3();
  readonly crown = new THREE.Vector3();
  readonly log: { at: number; finale: boolean; duration: number }[] = [];
  private readonly reed = new THREE.Mesh();
  private readonly ribbons = new RibbonBatch(3 * 40, '#f3ead0', 1, false, .35);
  private readonly curls: Ribbon[] = Array.from({ length: 3 }, () => ({
    points: Array.from({ length: 40 }, () => new THREE.Vector3()), alpha: 0, width: .04,
  }));
  private phrase: WindPhrase | null = null;
  private started = 0;
  /** Its recording has been started, or passed by. */
  private sounded = false;
  private finale = false;
  private breath = 0;

  constructor() {
    const t = tuning.windBough, x = PLACE.x + t.offset[0], z = PLACE.z + t.offset[1];
    const foot = heightAt(x, z);
    const shape = mergeGeometries([
      hollowBough([[0,-.4,0],[-.35,.7,-.12],[-.22,1.85,-.2],[.2,3,-.05],[.75,3.85,.3],[.8,4.15,.9]], .27),
      hollowBough([[-.26,.8,-.1],[-.85,1.35,-.16],[-1.1,2.25,.05],[-.94,2.9,.45]], .16),
    ]);
    const material = new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms }, vertexShader: VERT,
      fragmentShader: FRAG, side: THREE.DoubleSide });
    const body = new THREE.Mesh(shape, material);
    body.position.set(x, foot, z);
    this.group.add(body);
    const reed = new THREE.BoxGeometry(.085, .48, .025).translate(0, -.24, 0);
    const colour = new THREE.Color('#d4bd8e');
    reed.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({length:reed.attributes.position.count},
      () => [colour.r, colour.g, colour.b]).flat(),3));
    this.reed.geometry = reed; this.reed.material = material;
    this.reed.position.set(x + .8, foot + 4.22, z + .82);
    this.group.add(this.reed, this.ribbons.mesh);
    this.mouth.set(x + .8, foot + 4.1, z + .9);
    this.crown.copy(this.mouth).y += .4;
    this.ribbons.mesh.visible = false;
  }

  play(phrase: WindPhrase, time: number, finale = false): number {
    this.phrase = phrase; this.started = time; this.sounded = false; this.finale = finale;
    this.log.push({at:time,finale,duration:phrase.duration});
    if (this.log.length > 24) this.log.shift();
    return time + tuning.windBough.inhale + phrase.duration;
  }

  sounding(time: number): boolean {
    return !!this.phrase && time >= this.started && time < this.started + tuning.windBough.inhale + this.phrase.duration;
  }

  reset(): void { this.phrase = null; this.breath = 0; this.log.length = 0; this.ribbons.mesh.visible = false; }

  update(dt: number, time: number, camera: THREE.Camera, wind: WindField, out: AudioOut | null, active: boolean): void {
    this.group.visible = active && camera.position.distanceTo(this.mouth) < 240;
    if (!active) { this.phrase = null; return; }
    const t = tuning.windBough, elapsed = time - this.started, phrase = this.phrase;
    const playing = this.sounding(time);
    const envelope = playing ? THREE.MathUtils.smoothstep(elapsed, 0, t.inhale)
      * (1 - THREE.MathUtils.smoothstep(elapsed, t.inhale + phrase!.duration - .9, t.inhale + phrase!.duration)) : 0;
    this.breath += (envelope - this.breath) * (1 - Math.exp(-dt * 4));
    this.reed.rotation.x = Math.sin(time * 32) * this.breath * .12;
    this.reed.rotation.z = Math.sin(time * 21) * this.breath * .025;
    // The flute's recording begins on the breath's own clock; a stalled frame joins it where it would have been.
    if (phrase && !this.sounded && elapsed >= t.inhale + phrase.startAt) {
      this.sounded = true;
      const late = elapsed - t.inhale - phrase.startAt;
      if (out) meadowMusic.phrase(phrase.clip, late, this.finale ? 'finale' : 'call',
        this.finale ? tuning.meadowMusic.finaleDb : tuning.meadowMusic.callDb);
    }
    if (this.breath > .01) {
      wind.addSplat({source:'wind-bough',ax:this.mouth.x-5,az:this.mouth.z+4,bx:this.mouth.x,bz:this.mouth.z,
        vx:3*this.breath,vz:-2.5*this.breath,radius:3,energy:.15*this.breath,lift:.05*this.breath,swirl:0});
    }
    this.ribbons.mesh.visible = this.breath > .015;
    if (!this.ribbons.mesh.visible) return;
    for (let band = 0; band < this.curls.length; band++) {
      const curl = this.curls[band];
      curl.alpha = this.breath * t.ribbonAlpha;
      curl.width = t.ribbonWidth * (this.finale ? 1.25 : 1);
      for (let i = 0; i < curl.points.length; i++) {
        const u = i / (curl.points.length - 1), a = u * 4.2 - time * 1.6 + band * 2.1;
        const reach = (1 - u) * (this.finale ? 5 : 3.4);
        curl.points[i].set(this.mouth.x - reach + Math.sin(a) * reach * .18,
          this.mouth.y - (1-u)*1.5 + Math.cos(a) * reach * .16,
          this.mouth.z + reach * .65 + Math.sin(a) * reach * .12);
      }
    }
    this.ribbons.update(this.curls);
  }
}

export const windBough = new WindBough();
