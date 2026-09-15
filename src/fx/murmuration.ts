import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

const COUNT = 12000;
/** Over the far hills just left of where the sun sets, as seen from the last hill. */
const HOME = new THREE.Vector3(-165, 88, -1735);
/** Where the flock comes from, far to the west. */
const ARRIVE_FROM = new THREE.Vector3(-900, 130, -1500);

const VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uCentre;
uniform float uSize;
uniform float uPresence;
uniform float uRoost;
in vec4 aSeed;
out float vShade;
out vec2 vUv;
out vec3 vWorld;

mat3 turnY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
mat3 turnX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

/** The flock's body: a ball of birds, folded and stretched by slow flowing currents so its shape never settles. */
vec3 flock(vec3 s, float t) {
  vec3 q = s;
  q.x += 0.55 * sin(q.y * 2.3 + t * 1.3) + 0.25 * sin(q.z * 3.7 - t * 0.9);
  q.y += 0.4 * sin(q.z * 1.9 + t * 1.1 + 1.3) + 0.2 * sin(q.x * 3.1 + t * 0.7);
  q.z += 0.5 * sin(q.x * 2.1 - t * 1.2 + 2.1) + 0.25 * sin(q.y * 2.9 + t * 1.5);
  q = turnY(q.y * (0.45 + 0.4 * sin(t * 0.37))) * q;
  vec3 stretch = vec3(1.5 + 0.7 * sin(t * 0.41), 0.85 + 0.3 * cos(t * 0.53), 1.0 + 0.4 * sin(t * 0.29 + 1.0));
  q *= stretch;
  return turnX(0.35 * sin(t * 0.23)) * turnY(t * 0.18) * q;
}

void main() {
  float t = uTime * 0.11;
  vec3 s = normalize(aSeed.xyz * 2.0 - 1.0 + 1e-4) * pow(aSeed.w, 0.6);
  vec3 q = flock(s, t);
  vec3 dir = normalize(vec3(sin(t * 0.7), 0.3 * cos(t * 0.5), cos(t * 0.7)));
  float wave = sin(dot(q, dir) * 5.0 - uTime * 2.2);
  float jitter = fract(aSeed.x * 91.7 + aSeed.y * 13.1);
  vec3 wobble = vec3(sin(uTime * (2.0 + jitter * 3.0) + jitter * 40.0), cos(uTime * (2.5 + jitter * 2.0) + jitter * 17.0), sin(uTime * 1.7 + jitter * 9.0)) * 0.035;
  q += wobble;
  q.y = mix(q.y, -abs(q.y) * 0.4 - uRoost * 3.0 * (0.3 + aSeed.w), uRoost);
  q.xz *= 1.0 - 0.6 * uRoost * smoothstep(-0.2, -1.5, q.y);
  vec3 centre = uCentre + q * uSize;

  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float dist = length(cameraPosition - centre);
  float bank = 0.8 + 0.22 * wave;
  float size = max(0.16 * bank, dist * 0.0015 * bank) * step(jitter, uPresence);
  float flap = sin(uTime * 18.0 + jitter * 30.0);
  vec2 corner = position.xy;
  corner.y *= 0.45 + 0.35 * flap * corner.x * corner.x;
  vWorld = centre + (right * corner.x * 1.4 + up * corner.y) * size;
  vUv = position.xy;
  vShade = 0.55 + 0.45 * bank;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in float vShade;
in vec2 vUv;
in vec3 vWorld;
void main() {
  float body = 1.0 - smoothstep(0.35, 1.0, length(vUv * vec2(0.8, 1.6)));
  if (body < 0.01) discard;
  vec4 f = fogOf(vWorld);
  vec3 col = mix(vec3(0.04, 0.035, 0.05) + uSkyHorizon * 0.05, f.rgb, f.a * 0.45);
  gl_FragColor = vec4(col, body * vShade * 0.8);
}`;

/**
 * Starlings at dusk: thousands of birds in one dark, shape-shifting cloud over the far hills beside the setting
 * sun, dark waves rippling through it as they turn together. The released plane is drawn into it, and at last light
 * the flock pours down to roost.
 */
export class Murmuration {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly centre = new THREE.Vector3().copy(ARRIVE_FROM);
  private readonly want = new THREE.Vector3();

  constructor() {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = COUNT;
    this.uniforms = {
      ...atmo.uniforms,
      uCentre: { value: this.centre },
      uSize: { value: 14 },
      uPresence: { value: 0 },
      uRoost: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  /** Follows the time of day (`dusk`, 0 afternoon .. 2 night); `lure` draws the flock toward the plane once it is let go. */
  update(dt: number, dusk: number, lure: THREE.Vector3 | null): void {
    const presence = THREE.MathUtils.smoothstep(dusk, 0.5, 0.75);
    const roost = THREE.MathUtils.smoothstep(dusk, 1.22, 1.45);
    this.mesh.visible = presence > 0.001 && roost < 0.999;
    if (!this.mesh.visible) return;
    this.want.copy(HOME);
    this.want.x += Math.sin(dusk * 9) * 25;
    this.want.y += Math.sin(dusk * 13) * 8 - roost * 60;
    if (lure) this.want.lerp(lure, 0.55);
    const k = 1 - Math.exp(-dt * (lure ? 0.25 : 0.14));
    this.centre.lerp(this.want, k);
    this.uniforms.uPresence.value = presence * (1 - roost * roost);
    this.uniforms.uRoost.value = roost;
  }
}
