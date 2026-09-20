import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

export interface Ribbon {
  points: THREE.Vector3[];
  /** Overall opacity, 0..1. */
  alpha: number;
  width: number;
}

const VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uFlat;
in vec3 aSide;
in vec2 aInfo;
out float vAlpha;
out float vEdge;
out vec3 vWorld;
void main() {
  vec3 toCam = normalize(cameraPosition - position);
  /** Foam lies on the water; only a ribbon in the air turns to face the camera, or it stands up as a wall. */
  vec3 c = cross(aSide, mix(toCam, vec3(0.0, 1.0, 0.0), uFlat));
  vec3 side = c / max(length(c), 1e-4);
  vec3 world = position + side * aInfo.x;
  vAlpha = aInfo.y;
  vEdge = sign(aInfo.x);
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColor;
uniform float uLightFloor;
in float vAlpha;
in float vEdge;
in vec3 vWorld;
void main() {
  float soft = (1.0 - smoothstep(0.35, 1.0, abs(vEdge)));
  vec3 col = uColor * max(vec3(uLightFloor), hemiLight(vec3(0.0, 1.0, 0.0)) * 0.9 + uSunColor * 0.55);
  // A soft, cool edge keeps ivory air legible over pale cloth without lighting the surrounding world.
  if (uLightFloor > 0.0) {
    float core = 1.0 - smoothstep(0.12, 0.6, abs(vEdge));
    col = mix(vec3(0.035, 0.075, 0.09), col, core);
    soft *= mix(0.85, 1.0, core);
  }
  float fog = 1.0 - exp(-length(vWorld - cameraPosition) * uFogDensity);
  gl_FragColor = vec4(col, vAlpha * soft * (1.0 - fog));
}`;

/** Camera-facing tapered ribbons rebuilt on the CPU each frame. */
export class RibbonBatch {
  readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly sides: Float32Array;
  private readonly info: Float32Array;
  private readonly geo = new THREE.BufferGeometry();
  private readonly maxVerts: number;
  private readonly tmp = new THREE.Vector3();

  /** `flat` keeps the ribbon lying in the ground plane instead of turning to face the camera. */
  constructor(maxPoints: number, color: THREE.ColorRepresentation, opacity = 1, flat = false, lightFloor = 0) {
    this.maxVerts = maxPoints * 2;
    this.positions = new Float32Array(this.maxVerts * 3);
    this.sides = new Float32Array(this.maxVerts * 3);
    this.info = new Float32Array(this.maxVerts * 2);
    const index = new Uint32Array(maxPoints * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(this.sides, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aInfo', new THREE.BufferAttribute(this.info, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(new THREE.BufferAttribute(index, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uColor: { value: new THREE.Color(color).multiplyScalar(opacity) }, uFlat: { value: flat ? 1 : 0 }, uLightFloor: { value: lightFloor } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  update(ribbons: Iterable<Ribbon>): void {
    const index = this.geo.index!.array as Uint32Array;
    let v = 0;
    let idx = 0;
    for (const r of ribbons) {
      const n = r.points.length;
      if (n < 2 || r.alpha <= 0.001) continue;
      if (v + n * 2 > this.maxVerts) break;
      const start = v;
      for (let i = 0; i < n; i++) {
        const p = r.points[i];
        const a = r.points[Math.max(0, i - 1)];
        const b = r.points[Math.min(n - 1, i + 1)];
        this.tmp.subVectors(b, a).normalize();
        const f = i / (n - 1);
        const taper = Math.sin(Math.PI * Math.pow(f, 0.7));
        const w = r.width * taper * 0.5;
        const alpha = r.alpha * taper;
        for (let s = -1; s <= 1; s += 2) {
          const o = v * 3;
          this.positions[o] = p.x;
          this.positions[o + 1] = p.y;
          this.positions[o + 2] = p.z;
          this.sides[o] = this.tmp.x;
          this.sides[o + 1] = this.tmp.y;
          this.sides[o + 2] = this.tmp.z;
          this.info[v * 2] = s * w;
          this.info[v * 2 + 1] = alpha;
          v++;
        }
      }
      for (let i = 0; i < n - 1; i++) {
        const a = start + i * 2;
        index[idx++] = a;
        index[idx++] = a + 1;
        index[idx++] = a + 2;
        index[idx++] = a + 1;
        index[idx++] = a + 3;
        index[idx++] = a + 2;
      }
    }
    this.geo.setDrawRange(0, idx);
    for (const name of ['position', 'aSide', 'aInfo']) {
      const attr = this.geo.getAttribute(name) as THREE.BufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, v * attr.itemSize);
      attr.needsUpdate = true;
    }
    const indexAttr = this.geo.index!;
    indexAttr.clearUpdateRanges();
    indexAttr.addUpdateRange(0, idx);
    indexAttr.needsUpdate = true;
  }
}
