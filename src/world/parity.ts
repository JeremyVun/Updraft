import { HOME_SHIFT } from './geography';
import { SKY_MIRROR } from './sky-mirror-layout';
import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { COTTAGE, HEIGHTFIELD_GLSL, LAST_HILL, SLEEP_HILL, worldHeight } from './heightfield';

import { SLEEP_PATH } from './sleeping-layout';

import { LITTLE_BOATS, boatsX, boatsWidth } from './little-boats-layout';

const SAMPLES = 138 + 9 + (SLEEP_PATH.length - 1) * 9 + 9 + 21;

/** Largest gap between the GPU and CPU height functions over scattered points (QA only; stalls the GPU once). */
export function measureHeightParity(renderer: THREE.WebGLRenderer): number {
  const points: THREE.Vector2[] = [];
  // The narrow homeward channel clears the hull in both the rendered and navigated seabed.
  for (const x of [-168, -150, -132]) for (const z of [-1986, -1974, -1962]) points.push(new THREE.Vector2(x + HOME_SHIFT.x,z + HOME_SHIFT.z));
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
  for (let i = 0; i < 16; i++) points.push(new THREE.Vector2(SKY_MIRROR.x + i * 7 - 45, SKY_MIRROR.z + i * 5 - 32));
  // The piano approach saddle must match the rendered ground under the child's walk.
  for (let i = 0; i < 8; i++) points.push(new THREE.Vector2(-23 + (i % 2) * 12, -744 + i * 6));
  // The shorter sleeping ascent must put the cygnet and summit window on the same ground on CPU and GPU.
  for (let i = 0; i < 12; i++) points.push(new THREE.Vector2(SLEEP_HILL.x + (i % 3 - 1) * 4, SLEEP_HILL.z + Math.floor(i / 3) * 5));
  for (const [x,z] of [[-180,-1938.8],[-180,-1938.2],[-180,-1937.6],[-177.3,-1939.6],[-176.5,-1911],[-172,-1940]]) points.push(new THREE.Vector2(x,z));
  for (let i=1;i<SLEEP_PATH.length;i++) for (const t of [0,0.5,1]) for (const side of [-1.2,0,1.2]) {
    const a=SLEEP_PATH[i-1],b=SLEEP_PATH[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    points.push(new THREE.Vector2(a[0]+dx*t-dz/len*side,a[1]+dz*t+dx/len*side));
  }
  // The continuous south face beneath the window must match the CPU contact and sightline checks.
  for(const x of [-183,-180,-177])for(const z of [-1934,-1937,-1940])points.push(new THREE.Vector2(x,z));
  // The cottage terrace's uphill extension and both feathered edges agree with the walking/sightline surface.
  const approach = new THREE.Vector2(LAST_HILL.x - COTTAGE.x, LAST_HILL.z - COTTAGE.z).normalize();
  for (const along of [-26, 0, 13, 26, 36, 44, 52]) for (const across of [-13, 0, 13]) {
    points.push(new THREE.Vector2(COTTAGE.x + along * approach.x + across * approach.y,
      COTTAGE.z + along * approach.y - across * approach.x));
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
