import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { HEIGHTFIELD_GLSL, worldHeight } from './heightfield';

const SAMPLES = 64;

/** Largest gap between the GPU and CPU height functions over scattered points (QA only; stalls the GPU once). */
export function measureHeightParity(renderer: THREE.WebGLRenderer): number {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2.39996;
    const r = 30 + i * 26;
    points.push(new THREE.Vector2(Math.cos(a) * r - 10, Math.sin(a) * r * 1.3 - 400));
  }
  const target = simTarget(SAMPLES, 1, THREE.FloatType, THREE.NearestFilter);
  const mat = simMaterial(
    /* glsl */ `
    ${HEIGHTFIELD_GLSL}
    uniform vec2 uPoints[${SAMPLES}];
    in vec2 vUv;
    void main() {
      int i = int(vUv.x * ${SAMPLES}.0);
      gl_FragColor = vec4(worldHeight(uPoints[i]), 0.0, 0.0, 1.0);
    }`,
    { uPoints: { value: points } },
  );
  new GpuRunner(renderer).run(mat, target);
  const out = new Float32Array(SAMPLES * 4);
  renderer.readRenderTargetPixels(target, 0, 0, SAMPLES, 1, out);
  mat.dispose();
  target.dispose();
  let worst = 0;
  points.forEach((p, i) => (worst = Math.max(worst, Math.abs(out[i * 4] - worldHeight(p.x, p.y)))));
  return worst;
}
