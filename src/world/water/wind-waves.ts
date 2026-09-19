import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial } from '../../gl/gpu';
import { glsl, tuning } from '../../tuning';
import { atmo } from '../atmosphere';
import { onWindowMove, WINDOW } from '../window';

// Fixed wave headings: wind feeds their amplitudes, never rotates their phase.
const WAVES = [
  { x: 0.94, z: 0.341174, length: 11 },
  { x: -0.341174, z: 0.94, length: 13 },
  { x: -0.94, z: -0.341174, length: 11.7 },
  { x: 0.341174, z: -0.94, length: 12.3 },
];
const channel = ['x', 'y', 'z', 'w'];
const dir = (w: (typeof WAVES)[number]) => `vec2(${glsl(w.x)}, ${glsl(w.z)})`;

/** Shared by the geometry and shading; all phases travel continuously in world space. */
export const WIND_WAVES_GLSL = /* glsl */ `
uniform sampler2D uWaterWind;
vec4 waterWindAt(vec2 p) {
  vec2 uv = domainUv(p);
  vec2 edge = min(uv, 1.0 - uv);
  return texture(uWaterWind, clamp(uv, 0.0, 1.0)) * smoothstep(0.0, 0.04, min(edge.x, edge.y));
}
float windWaveHeight(vec2 p) {
  vec4 energy = waterWindAt(p);
  float h = 0.0;
  ${WAVES.map((w, i) => `h += energy.${channel[i]} * sin(dot(p, ${dir(w)}) * ${glsl(2 * Math.PI / w.length)} - uTime * ${glsl(Math.sqrt(9.8 * 2 * Math.PI / w.length))} + ${glsl(i * 1.7)});`).join('\n')}
  return h * ${glsl(tuning.water.chop)};
}
vec2 windWaveSlope(vec2 p, float footprint) {
  vec4 energy = waterWindAt(p);
  vec2 slope = vec2(0.0);
  ${WAVES.map((w, i) => {
    // Broader ripples remain legible from the story camera; fine ones break up their crests.
    const bands = [{ scale: 0.3, weight: 0.72 }, { scale: 0.13, weight: 0.28 }];
    return bands.map(({ scale, weight }) => {
      const k = 2 * Math.PI / (w.length * scale);
      return `slope += ${dir(w)} * energy.${channel[i]} * ${glsl(weight)} * cos(dot(p, ${dir(w)}) * ${glsl(k)} - uTime * ${glsl(Math.sqrt(9.8 * k))} + ${glsl(i * 2.3)}) * (1.0 - smoothstep(0.5, 1.8, footprint * ${glsl(k)}));`;
    }).join('\n');
  }).join('\n')}
  return slope * ${glsl(tuning.water.ruffle)};
}
`;

const STEP = /* glsl */ `
uniform sampler2D uState;
uniform sampler2D uWind;
uniform sampler2D uHeight;
uniform vec4 uDomain;
uniform float uDt;
in vec2 vUv;
vec4 at(vec2 uv) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture(uState, uv);
}
void main() {
  vec4 wind = texture(uWind, vUv);
  float speed = length(wind.xy);
  vec2 heading = wind.xy / max(speed, 0.001);
  float forcing = smoothstep(${glsl(tuning.water.windEnergyFrom)}, ${glsl(tuning.water.windEnergyFull)}, wind.z)
                * smoothstep(${glsl(tuning.water.windSpeedFrom)}, ${glsl(tuning.water.windSpeedFull)}, speed);
  vec4 weights = vec4(${WAVES.map(w => `pow(max(0.0, dot(heading, ${dir(w)})), 2.0)`).join(', ')});
  weights /= max(dot(weights, vec4(1.0)), 0.001);
  vec4 energy;
  ${WAVES.map((w, i) => `energy.${channel[i]} = at(vUv - ${dir(w)} * ${glsl(Math.sqrt(9.8 * w.length / (2 * Math.PI)) * 0.5)} * uDt * uDomain.zw).${channel[i]};`).join('\n')}
  vec4 target = weights * forcing;
  vec4 rate = mix(vec4(1.0 / ${glsl(tuning.water.windRelease)}), vec4(1.0 / ${glsl(tuning.water.windAttack)}), step(energy, target));
  energy = mix(energy, target, 1.0 - exp(-rate * uDt));
  // Land absorbs the packet; it cannot emerge from the other side of an island.
  energy *= exp(-uDt * 12.0 * (1.0 - smoothstep(0.0, 1.5, -texture(uHeight, vUv).r)));
  gl_FragColor = energy;
}`;

/** Four travelling wave envelopes, retaining the water's response after the air changes. */
export class WindWaves {
  readonly uniform: THREE.IUniform;
  private readonly state = new PingPong(128, 128);
  private readonly gpu: GpuRunner;
  private readonly step: THREE.ShaderMaterial;
  private readonly shift: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    this.gpu.clear(this.state.read);
    this.gpu.clear(this.state.write);
    this.uniform = { value: this.state.texture };
    this.step = simMaterial(STEP, {
      uState: this.uniform,
      uWind: atmo.uniforms.uWindTex,
      uHeight: atmo.uniforms.uHeightTex,
      uDomain: atmo.uniforms.uDomain,
      uDt: { value: 0 },
    });
    this.shift = simMaterial(`
      uniform sampler2D uState;
      uniform vec2 uShift;
      in vec2 vUv;
      void main() {
        vec2 uv = vUv + uShift;
        gl_FragColor = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))) ? texture(uState, uv) : vec4(0.0);
      }`, { uState: this.uniform, uShift: { value: new THREE.Vector2() } });
    onWindowMove((dx, dz) => {
      this.shift.uniforms.uShift.value.set(dx / WINDOW.size, dz / WINDOW.size);
      this.gpu.run(this.shift, this.state.write);
      this.state.swap();
      this.uniform.value = this.state.texture;
    });
  }

  update(dt: number): void {
    this.step.uniforms.uDt.value = Math.min(dt, 1 / 30);
    this.gpu.run(this.step, this.state.write);
    this.state.swap();
    this.uniform.value = this.state.texture;
  }
}
