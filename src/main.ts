import * as THREE from 'three';
import { Soundscape, type SoundState } from './audio/audio';
import { CameraRig } from './camera';
import { Petals } from './fx/petals';
import { WindLines } from './fx/windlines';
import { Glider } from './glider/glider';
import { Cursor } from './input/cursor';
import { PointerInput } from './input/pointer';
import { params } from './params';
import { Post } from './post/post';
import { createWindDebug } from './wind/debug';
import { WindField, type WindSample } from './wind/field';
import { CLOUD_SPAN, atmo } from './world/atmosphere';
import { CloudShadows } from './world/clouds';
import { createDistantIslands } from './world/distant';
import { Grass } from './world/grass';
import { GroundBakes, type BakeInputs } from './world/ground';
import { heightAt } from './world/island';
import { FLOWER_PATCHES, ROCKS, TREE } from './world/landmarks';
import { measureHeightParity } from './world/parity';
import { createRocks } from './world/rocks';
import { createTree } from './world/tree';
import { createSky } from './world/sky';
import { Terrain } from './world/terrain';
import { createWater } from './world/water';
import { followWindow, onWindowMove } from './world/window';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: Record<string, number>;
    __game?: Record<string, unknown>;
  }
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;
if (params.shot) document.body.classList.add('shot');

const scene = new THREE.Scene();
const rig = new CameraRig();
const aimDir = new THREE.Vector3();
/** Where the window should be centred: well ahead of the camera, on the ground it is looking at. */
function windowAim(): [number, number] {
  rig.camera.updateMatrixWorld();
  rig.camera.getWorldDirection(aimDir);
  aimDir.y = 0;
  if (aimDir.lengthSq() < 1e-6) aimDir.set(0, 0, -1);
  aimDir.normalize();
  return [rig.camera.position.x + aimDir.x * 100, rig.camera.position.z + aimDir.z * 100];
}
const wind = new WindField(renderer);
const input = new PointerInput(canvas);
const cursor = new Cursor(canvas);

const tree = createTree();
const bakes = new GroundBakes(renderer);
const bakeInputs: BakeInputs = {
  occluders: tree.canopy,
  clearings: [...ROCKS.map((r) => ({ x: r.x, z: r.z, radius: r.radius })), { x: TREE.x, z: TREE.z, radius: 1.6 }],
  flowers: FLOWER_PATCHES,
};
onWindowMove(() => bakes.bake(bakeInputs));
followWindow(...windowAim(), true);
const clouds = new CloudShadows(renderer);
scene.add(createSky());
const terrain = new Terrain(wind.breeze);
scene.add(terrain.mesh);
scene.add(createWater());
scene.add(createRocks());
scene.add(createDistantIslands());
scene.add(tree.group);
const grass = new Grass();
scene.add(grass.group);
const petals = new Petals(renderer);
scene.add(petals.mesh);
const lines = new WindLines(wind);
scene.add(lines.batch.mesh);
const glider = params.noGlider ? null : new Glider(wind, tree.canopy);
glider?.objects.forEach((o) => scene.add(o));
const windDebug = params.debug === 'wind' ? createWindDebug() : null;
if (windDebug) scene.add(windDebug);

const maxPixelRatio = params.ratio ?? Math.min(window.devicePixelRatio, 2);
let pixelRatio = maxPixelRatio;
const post = new Post(renderer, scene, rig.camera, maxPixelRatio);

const sound = new Soundscape();
const soundButton = document.getElementById('sound') as HTMLButtonElement;
function setSound(on: boolean): void {
  if (on) sound.start();
  sound.setMuted(!on);
  soundButton.dataset.on = String(on);
  soundButton.setAttribute('aria-pressed', String(on));
}
let soundChosen = false;
soundButton.addEventListener('click', () => {
  soundChosen = true;
  setSound(soundButton.dataset.on !== 'true');
});
input.onButton((kind) => {
  if (kind === 'down' && !soundChosen && !params.shot) {
    soundChosen = true;
    setSound(true);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    soundChosen = true;
    setSound(soundButton.dataset.on !== 'true');
  }
});
const soundState: SoundState = { gust: 0, pan: 0, rise: 0, charge: 0, overLand: false, breeze: 0, gliderLift: 0 };
const breezeSample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  post.setSize(w, h, pixelRatio);
  rig.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

let smoothSince = performance.now();
/** Steps the render scale down when frames run long and creeps back up after a sustained smooth stretch. */
function adaptQuality(now: number): void {
  if (params.ratio !== null || now < 4000) return;
  if (fps < 50 && pixelRatio > 1) {
    pixelRatio = Math.max(1, pixelRatio - 0.25);
    smoothSince = now;
    resize();
  } else if (fps < 57) {
    smoothSince = now;
  } else if (now - smoothSince > 12000 && pixelRatio < maxPixelRatio) {
    pixelRatio = Math.min(maxPixelRatio, pixelRatio + 0.25);
    smoothSince = now;
    resize();
  }
}

const heightParity = params.shot ? measureHeightParity(renderer) : 0;

const breezeAngle = THREE.MathUtils.degToRad(-18);
let time = 0;
let veilLifted = false;
let last = performance.now();
let frames = 0;
let fpsWindowStart = last;
let fps = 0;

function frame(now: number): void {
  const realDt = (now - last) / 1000;
  last = now;
  const dt = params.shot ? 1 / 60 : Math.min(realDt, 1 / 20);
  time += dt;

  renderer.info.reset();
  const veer = Math.sin(time * 0.021) * 0.35;
  wind.breeze.set(Math.cos(breezeAngle + veer), Math.sin(breezeAngle + veer)).multiplyScalar(2.6);

  input.update(dt, rig.camera, wind);
  if (input.present) glider?.brush(rig.camera, input.prevNdc, input.ndc, input.gust, input.gustDir, input.down ? input.charge : 0, dt);
  glider?.update(dt, time);
  wind.step(dt, time);

  const u = atmo.uniforms;
  u.uTime.value = time;
  u.uWindTex.value = wind.texture;
  u.uBendTex.value = wind.bendTexture;
  u.uCloudShift.value.addScaledVector(wind.breeze, dt * 2.2);
  clouds.update();

  petals.update(dt, input.down && input.present ? input.world : null, input.charge);
  const pointerWorld = input.present ? input.world : null;
  lines.update(dt, pointerWorld, input.gust, input.down ? pointerWorld : null, input.charge);
  cursor.update(input.gust, input.charge, input.down);

  const riseNow = input.ndc.x - input.prevNdc.x + (input.ndc.y - input.prevNdc.y);
  soundState.rise += (Math.sign(riseNow) - soundState.rise) * (Math.abs(riseNow) > 1e-4 ? 0.3 : 0);
  soundState.gust = input.present ? input.gust : 0;
  soundState.pan = input.ndc.x;
  soundState.charge = input.down ? input.charge : 0;
  soundState.overLand = heightAt(input.world.x, input.world.z) > 0.5;
  const b = wind.sample(-6, -14, breezeSample);
  soundState.breeze = Math.min(1, Math.hypot(b.x, b.z) / 6);
  soundState.gliderLift = glider?.lift ?? 0;
  sound.update(dt, soundState);

  rig.update(dt, time, glider?.position ?? null);
  rig.camera.updateMatrixWorld();
  followWindow(...windowAim());
  const cam = rig.camera.position;
  u.uCloudDomain.value.set(cam.x - CLOUD_SPAN / 2, cam.z - CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN);
  terrain.update(rig.camera);
  grass.update(rig.camera);
  post.render(time);

  frames++;
  if (now - fpsWindowStart > 1500) {
    fps = (frames * 1000) / (now - fpsWindowStart);
    frames = 0;
    fpsWindowStart = now;
    adaptQuality(now);
  }
  if (time > 0.4 && !veilLifted) {
    veilLifted = true;
    document.getElementById('veil')?.classList.add('lifted');
  }
  if (params.shot) {
    window.__stats = {
      fps: Math.round(fps),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      blades: grass.bladesDrawn,
      leaves: terrain.leaves,
      ratio: pixelRatio,
      heightParity,
    };
    if (time > 0.75) window.__ready = true;
  }
  requestAnimationFrame(frame);
}

if (params.shot) window.__game = { wind, input, rig, renderer, scene, glider, lines, sound };
requestAnimationFrame(frame);
