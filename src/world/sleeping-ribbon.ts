import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { tuning } from '../tuning';

const STEPS = 32;
const STRIPS = 4;
/** A loose bow joining the curtains, with one long end beyond the ledge. No collision-less automatic release. */
export class CurtainRibbon {
  readonly mesh: THREE.Mesh;
  pull = 0;
  released = false;
  private elapsed = 0;
  private readonly positions = new Float32Array(STRIPS * (STEPS + 1) * 2 * 3);
  private readonly point = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly next = new THREE.Vector3();
  private readonly attr: THREE.BufferAttribute;

  constructor(readonly knot: THREE.Vector3, readonly end: THREE.Vector3) {
    const geo = new THREE.BufferGeometry(), index: number[] = [];
    this.attr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    for (let s = 0; s < STRIPS; s++) for (let i = 0; i < STEPS; i++) {
      const a = (s * (STEPS + 1) + i) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide,
      vertexShader: `out vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);}`,
      fragmentShader: `${ATMO_GLSL}\nin vec3 vWorld;
        void main(){vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld))); if(!gl_FrontFacing)n=-n;
        vec3 col=vec3(0.62,0.30,0.13)*(hemiLight(n)*1.5+uSunColor*max(0.2,dot(n,uSunDir))*0.5+lampLight(vWorld,n)+dawnLight(vWorld,n));
        gl_FragColor=vec4(applyFog(col,vWorld),1.0);}`,
    }));
    this.mesh.frustumCulled = false;
    this.update(0, 0, 0);
  }

  gripAt(pull: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.end).add(this.next.set(0, -tuning.sleeping.ribbonPull * pull, 0.32 * pull));
  }

  update(dt: number, time: number, open: number): void {
    if (this.released) this.elapsed += dt;
    this.gripAt(this.pull, this.tip);
    const loose = THREE.MathUtils.smoothstep(this.elapsed, 0, 2.5);
    for (let s = 0; s < STRIPS; s++) for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS, p = this.point.copy(this.knot);
      const bow = (1 - this.pull * 0.85) * (1 - loose);
      if (s < 2) {
        // Two loops in the knot shrink as the free end is drawn through them.
        const side = s === 0 ? -1 : 1;
        p.x += side * Math.sin(u * Math.PI) * 0.34 * bow + side * open * 0.65;
        p.y += Math.sin(u * Math.PI * 2) * 0.19 * bow;
        p.z += Math.sin(u * Math.PI) * 0.14 * bow;
      } else if (s === 2) {
        p.lerp(this.tip, u);
        p.y -= Math.sin(u * Math.PI) * 0.28 * (1 - this.pull);
        p.x += Math.sin(u * 7 - time * 1.6) * 0.035 * Math.sin(u * Math.PI) * (1 - this.pull);
        // After the knot comes free, this tail falls against the open curtain, clear of the bird.
        p.x += open * 0.8 * u;
        p.y -= loose * u * 0.6;
        p.z -= loose * u * 2.2;
      } else {
        p.x -= u * (0.2 + open * 0.7);
        p.y -= u * (0.75 - this.pull * 0.55);
        p.z += Math.sin(u * 4 + time) * 0.04;
      }
      const width = (s < 2 ? 0.047 : 0.065) * (1 - u * 0.2);
      const j = (s * (STEPS + 1) + i) * 6;
      this.positions[j] = p.x - width; this.positions[j + 1] = p.y; this.positions[j + 2] = p.z;
      this.positions[j + 3] = p.x + width; this.positions[j + 4] = p.y + 0.012; this.positions[j + 5] = p.z;
    }
    this.attr.needsUpdate = true;
  }
}
