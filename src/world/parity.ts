import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { HEIGHTFIELD_GLSL, SLEEP_HILL, worldHeight } from './heightfield';

import { LITTLE_BOATS, boatsX, boatsWidth } from './little-boats-layout';

const SAMPLES = 138;

/** Largest gap between the GPU and CPU height functions over scattered points (QA only; stalls the GPU once). */
export function measureHeightParity(renderer: THREE.WebGLRenderer): number {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < 64; i++) {
    const a = i * 2.39996;
    const r = 30 + i * 26;
    points.push(new THREE.Vector2(Math.cos(a) * r - 10, Math.sin(a) * r * 1.3 - 400));
  }
  // Include the new narrow stream and both banks, which the global spiral can miss entirely.
  for (let i = 0; i < 32; i++) {
    const s = Math.floor(i / 4) * 15;
    points.push(new THREE.Vector2(boatsX(s) + boatsWidth(s) * [-1.4, 0, 0.8, 1.4][i % 4], LITTLE_BOATS.startZ - s));
  }
  // The mirror's shallow bed and shelf must agree closely enough that feet never disappear underwater.
  for (let i = 0; i < 16; i++) points.push(new THREE.Vector2(-455 + i * 7 - 45, -2310 + i * 5 - 32));
  // The piano approach saddle must match the rendered ground under the child's walk.
  for (let i = 0; i < 8; i++) points.push(new THREE.Vector2(-23 + (i % 2) * 12, -744 + i * 6));
  // The shorter sleeping ascent must put the cygnet and summit window on the same ground on CPU and GPU.
  for (let i = 0; i < 12; i++) points.push(new THREE.Vector2(SLEEP_HILL.x + (i % 3 - 1) * 4, SLEEP_HILL.z + Math.floor(i / 3) * 5));
  for (const [x,z] of [[-180,-1938.8],[-180,-1938.2],[-180,-1937.6],[-177.3,-1939.6],[-176.5,-1911],[-172,-1940]]) points.push(new THREE.Vector2(x,z));
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
