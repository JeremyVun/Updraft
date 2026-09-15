import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { SURF_GLSL, surfUniforms } from '../../world/water/surf';

const MAX = 600;
export const FOAM = 0;
export const SLICK = 1;
export const RING = 2;

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 iA;
in vec4 iB;
in vec4 iC;
out vec2 vQ;
out vec3 vWorld;
out float vFade;
out float vKind;
out float vSeed;
out float vStrength;
void main() {
  float age = uTime - iB.x;
  float t = clamp(age / iB.y, 0.0, 1.0);
  float r = iA.z + iC.x * age;
  vec2 dir = vec2(cos(iA.w), sin(iA.w));
  vec2 q = position.xy;
  vec2 local = vec2(q.x * r * iC.y, q.y * r);
  vec2 xz = iA.xy + dir * local.x + vec2(-dir.y, dir.x) * local.y;
  vWorld = vec3(xz.x, 0.02, xz.y);
  vQ = q;
  vFade = t;
  vKind = iB.z;
  vSeed = iB.w;
  vStrength = iC.z;
  gl_Position = age < 0.0 || t >= 1.0 ? vec4(0.0, 0.0, -2.0, 1.0) : projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${SURF_GLSL}
uniform vec3 uDeep;
in vec2 vQ;
in vec3 vWorld;
in float vFade;
in float vKind;
in float vSeed;
in float vStrength;
void main() {
  Footprint fp = footprintOf(vWorld.xz);
  float r = length(vQ);
  if (r > 1.0) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float nv = max(V.y, 0.02);
  vec3 col;
  float a;
  if (vKind < 0.5) {
    float edge = 1.0 - smoothstep(0.25, 1.0, r + (vnoise(vQ * 2.5 + vSeed * 40.0) - 0.5) * 0.5);
    float density = edge * vStrength * pow(1.0 - vFade, 1.4) * smoothstep(0.0, 0.05, vFade + 0.02);
    a = foamLace(density, vWorld.xz * 1.6 + vSeed * 57.0, Footprint(fp.dx * 1.6, fp.dy * 1.6));
    col = foamColor(V, sun);
  } else if (vKind < 1.5) {
    float body = 1.0 - smoothstep(0.35, 1.0, r + (vnoise(vQ * 1.7 + vSeed * 23.0) - 0.5) * 0.35);
    a = body * vStrength * smoothstep(0.0, 0.08, vFade) * (1.0 - vFade) * 0.6;
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
    vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sun);
    col = mix(deep, skyColor(R) * 1.04, F);
  } else {
    float w = 0.035 + 0.07 * vFade;
    float k = vStrength * pow(1.0 - vFade, 1.8) * 0.35;
    float crest = (exp(-pow((r - 0.86) / w, 2.0)) + 0.5 * exp(-pow((r - 0.6) / w, 2.0))) * k;
    float trough = exp(-pow((r - 0.86 + w * 1.8) / (w * 1.5), 2.0)) * k * 0.4;
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    vec3 bright = skyColor(R) * 1.25 + uSunColor * pow(max(dot(R, uSunDir), 0.0), 40.0) * sun;
    a = crest + trough;
    col = (bright * crest + uDeep * uSkyAmbient * trough) / max(a, 1e-4);
  }
  if (a < 0.004) discard;
  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col * a, a);
}`;

/** Marks on the sea surface: white water that breaks into lace, calm glassy slicks, and spreading rings. */
export class Marks {
  readonly mesh: THREE.Mesh;
  private next = 0;
  private until = -1;
  private readonly a: THREE.InstancedBufferAttribute;
  private readonly b: THREE.InstancedBufferAttribute;
  private readonly c: THREE.InstancedBufferAttribute;

  constructor() {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.a = attr();
    this.b = attr();
    this.c = attr();
    (this.b.array as Float32Array).fill(-1e6);
    for (let i = 0; i < MAX; i++) (this.b.array as Float32Array)[i * 4 + 1] = 1;
    geo.setAttribute('iA', this.a);
    geo.setAttribute('iB', this.b);
    geo.setAttribute('iC', this.c);
    geo.instanceCount = MAX;
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...atmo.uniforms, ...surfUniforms, uDeep: { value: new THREE.Color('#0d4a66') } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /**
   * Leaves a mark at (x, z) for `life` seconds. It grows by `grow` units per second from `radius`; `stretch` makes it
   * that many times longer along `angle` than across.
   */
  add(kind: number, x: number, z: number, radius: number, life: number, time: number, strength = 1, grow = 0, angle = 0, stretch = 1): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const A = this.a.array as Float32Array;
    const B = this.b.array as Float32Array;
    const C = this.c.array as Float32Array;
    A[i * 4] = x;
    A[i * 4 + 1] = z;
    A[i * 4 + 2] = radius;
    A[i * 4 + 3] = angle;
    B[i * 4] = time;
    B[i * 4 + 1] = life;
    B[i * 4 + 2] = kind;
    B[i * 4 + 3] = Math.random();
    C[i * 4] = grow;
    C[i * 4 + 1] = stretch;
    C[i * 4 + 2] = strength;
    this.until = Math.max(this.until, time + life);
    this.a.needsUpdate = true;
    this.b.needsUpdate = true;
    this.c.needsUpdate = true;
  }

  update(time: number): void {
    this.mesh.visible = time < this.until;
  }
}
