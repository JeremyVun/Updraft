import * as THREE from 'three';
import { Soundscape, type SoundState } from './audio/audio';
import { CameraRig } from './camera';
import { Creatures } from './creatures/creatures';
import { islandHabitat, mainlandHabitat } from './creatures/habitat';
import { Petals } from './fx/petals';
import { WindLines } from './fx/windlines';
import { Glider } from './glider/glider';
import { ROUTE } from './story/hills';
import { takeCues } from './story/cues';
import { Journey } from './story/journey';
import { Fireflies } from './fx/fireflies';
import { Murmuration } from './fx/murmuration';
import { Rain } from './fx/rain';
import { Boat } from './traveller/boat';
import { Drawing } from './traveller/drawing';
import { Traveller } from './traveller/traveller';
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
import { LifeField } from './world/life';
import { applyPalette } from './world/palette';
import { heightAt } from './world/island';
import { FLOWER_PATCHES, ROCKS, TREE, wildflowersAlong } from './world/landmarks';
import { measureHeightParity } from './world/parity';
import { createRocks } from './world/rocks';
import { createTree } from './world/tree';
import { createSky } from './world/sky';
import { Terrain } from './world/terrain';
import { Cottage } from './world/cottage';
import { COTTAGE, mainlandCoastZ } from './world/heightfield';
import { Walls } from './world/walls';
import { Water } from './world/water';
import { REFLECTION_LAYER } from './world/water/reflection';
import { surfUniforms } from './world/water/surf';
import { WINDOW, followWindow, onWindowMove, windowCentre } from './world/window';

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
const hillFlowers = wildflowersAlong(ROUTE);
const bakes = new GroundBakes(renderer);
const bakeInputs: BakeInputs = {
  occluders: tree.canopy,
  clearings: [
    ...ROCKS.map((r) => ({ x: r.x, z: r.z, radius: r.radius })),
    { x: TREE.x, z: TREE.z, radius: 1.6 },
    { x: COTTAGE.x, z: COTTAGE.z, radius: 6.5 },
  ],
  flowers: [...FLOWER_PATCHES, ...hillFlowers],
};
const water = new Water(renderer, scene, wind.breeze, bakes.height.texture);
const bakedSun = atmo.uniforms.uSunDir.value.clone();
onWindowMove(() => {
  bakedSun.copy(atmo.uniforms.uSunDir.value);
  bakes.bake(bakeInputs);
  water.bakeShore(WINDOW.size);
});
followWindow(...windowAim(), true);
const life = new LifeField(renderer);
const clouds = new CloudShadows(renderer);
scene.add(createSky());
const terrain = new Terrain(wind.breeze, bakes.filterable);
scene.add(terrain.mesh);
scene.add(water.mesh);
scene.add(createRocks());
scene.add(createDistantIslands());
scene.add(tree.group);
const grass = new Grass();
scene.add(grass.group);
const walls = new Walls();
scene.add(walls.mesh);
const cottage = new Cottage(wind);
cottage.objects.forEach((o) => scene.add(o));
const petals = new Petals(renderer);
scene.add(petals.mesh);
const allFlowers = [...FLOWER_PATCHES, ...hillFlowers];
const petalsHomedAt = new THREE.Vector2(1e9, 1e9);
/** Keeps the petals in the flower patches near the window, so gusts lift colour wherever the journey is. */
function homePetals(): void {
  const [cx, cz] = windowCentre();
  if (Math.hypot(cx - petalsHomedAt.x, cz - petalsHomedAt.y) < 60) return;
  petalsHomedAt.set(cx, cz);
  const near = allFlowers.filter((f) => Math.hypot(f.x - cx, f.z - cz) < 190);
  petals.rehome(near, cz < -600 ? 0.12 : 1);
}
homePetals();
const lines = new WindLines(wind);
scene.add(lines.batch.mesh);
const glider = new Glider(wind, tree.canopy);
glider.objects.forEach((o) => scene.add(o));
const child = new Traveller(wind);
child.objects.forEach((o) => scene.add(o));
const boat = new Boat(wind);
boat.objects.forEach((o) => scene.add(o));
for (const o of [...glider.objects, ...boat.objects, ...child.objects]) if (o !== child.shadow) o.traverse((c) => c.layers.enable(REFLECTION_LAYER));
const drawing = new Drawing();
scene.add(drawing.mesh);
const fireflies = new Fireflies(wind);
scene.add(fireflies.mesh);
const rain = new Rain();
scene.add(rain.mesh);
const starlings = new Murmuration();
scene.add(starlings.mesh);
/** The nearest rabbit or finch to a point, for the child to glance at as they pass. */
function nearbyCreature(x: number, z: number, radius: number, out: THREE.Vector3): boolean {
  let best = radius * radius;
  let found = false;
  for (const set of [creatures, hillCreatures]) {
    for (const animal of [...set.rabbits.state, ...set.songbirds.state]) {
      const d = (animal.x - x) ** 2 + (animal.z - z) ** 2;
      if (d < best) {
        best = d;
        out.set(animal.x, animal.y + 0.35, animal.z);
        found = true;
      }
    }
  }
  return found;
}
const story = new Journey({ child, plane: glider, boat, wind, input, life, tree, drawing, cottage, nearby: nearbyCreature });
rig.cut(story.shot);
const windDebug = params.debug === 'wind' ? createWindDebug() : null;
if (windDebug) scene.add(windDebug);
const creatures = new Creatures(wind, islandHabitat(tree.canopy), input, rig.camera);
creatures.spawn({ x: 1, z: 5, radius: 20, rabbits: 6, butterflies: 26 });
creatures.spawn({ x: 0, z: 0, radius: 30, songbirds: 11, seed: 3 });
creatures.spawn({ x: -6, z: -14, radius: 55, gulls: 5, seed: 2 });
scene.add(creatures.group);
const homesInHills = [...ROUTE.map((p, i) => ({ x: p.x + (i % 2 ? 14 : -14), z: p.y })), { x: COTTAGE.x + 6, z: COTTAGE.z + 26 }];
const hillCreatures = new Creatures(wind, mainlandHabitat(hillFlowers, homesInHills), input, rig.camera);
hillCreatures.spawn({ x: 10, z: -680, radius: 70, gulls: 4, seed: 21 });
homesInHills.forEach((h, i) => {
  const last = i === homesInHills.length - 1;
  hillCreatures.spawn({ x: h.x, z: h.z, radius: 26, rabbits: 2, songbirds: i % 2 === 0 || last ? 4 : 0, butterflies: last ? 0 : 6, seed: 30 + i });
});
scene.add(hillCreatures.group);

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
const soundState: SoundState = {
  gust: 0,
  pan: 0,
  rise: 0,
  charge: 0,
  overLand: false,
  breeze: 0,
  gliderLift: 0,
  life: 0,
  night: 0,
  sea: 1,
  meadow: 0,
  shower: 0,
  cues: [],
};
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
  wind.breeze.set(Math.cos(breezeAngle + veer), Math.sin(breezeAngle + veer)).multiplyScalar(2.6 * story.breeze);

  input.update(dt, rig.camera, wind);
  if (input.present) glider.brush(rig.camera, input.prevNdc, input.ndc, input.gust, input.gustDir, input.down ? input.charge : 0, dt);
  story.update(dt, time);
  creatures.gulls.follow(story.escort);
  atmo.uniforms.uRainbow.value = story.rainbow;
  boat.update(dt);
  child.update(dt);
  glider.update(dt, time);
  wind.step(dt, time);
  life.update(dt);
  tree.life.value += (Math.min(1, life.at(TREE.x, TREE.z) * 1.15) - tree.life.value) * (1 - Math.exp(-dt * 0.8));
  const shower = params.shower ?? story.shower;
  applyPalette(story.worldLife, params.dusk ?? story.dusk, shower);
  if (bakedSun.angleTo(atmo.uniforms.uSunDir.value) > 0.006) {
    bakedSun.copy(atmo.uniforms.uSunDir.value);
    bakes.bake(bakeInputs);
  }
  post.saturation = 0.62 + 0.38 * story.worldLife;
  surfUniforms.uSeaState.value = story.breeze;

  const u = atmo.uniforms;
  u.uTime.value = time;
  u.uWindTex.value = wind.texture;
  u.uBendTex.value = wind.bendTexture;
  u.uCloudShift.value.addScaledVector(wind.breeze, dt * 2.2);
  clouds.update();

  homePetals();
  petals.update(dt, input.down && input.present ? input.world : null, input.charge);
  const pointerWorld = input.present ? input.world : null;
  lines.update(dt, pointerWorld, input.gust, input.down ? pointerWorld : null, input.charge);
  cursor.update(input.gust, input.charge, input.down);
  const creatureEnv = {
    camera: rig.camera,
    input,
    glider: glider.position,
    walker: child.visible ? child.position : null,
    life: (x: number, z: number) => life.at(x, z),
    breeze: story.breeze,
    audio: sound.output,
  };
  creatures.update(dt, time, creatureEnv);
  hillCreatures.update(dt, time, creatureEnv);

  const riseNow = input.ndc.x - input.prevNdc.x + (input.ndc.y - input.prevNdc.y);
  soundState.rise += (Math.sign(riseNow) - soundState.rise) * (Math.abs(riseNow) > 1e-4 ? 0.3 : 0);
  soundState.gust = input.present ? input.gust : 0;
  soundState.pan = input.ndc.x;
  soundState.charge = input.down ? input.charge : 0;
  soundState.overLand = heightAt(input.world.x, input.world.z) > 0.5;
  const b = wind.sample(-6, -14, breezeSample);
  soundState.breeze = Math.min(1, Math.hypot(b.x, b.z) / 6);
  soundState.gliderLift = glider.lift;
  soundState.life = story.worldLife;
  soundState.night = atmo.uniforms.uNight.value;
  const inland = mainlandCoastZ(story.focus.x) - story.focus.z;
  soundState.sea = 1 - THREE.MathUtils.smoothstep(inland, 20, 260);
  soundState.meadow = THREE.MathUtils.smoothstep(inland, 60, 200);
  soundState.cues = takeCues();
  soundState.shower = shower;
  sound.update(dt, soundState);

  rig.update(dt, time, story.shot, story.pace);
  rig.camera.updateMatrixWorld();
  followWindow(...windowAim());
  const cam = rig.camera.position;
  u.uCloudDomain.value.set(cam.x - CLOUD_SPAN / 2, cam.z - CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN);
  terrain.update(rig.camera);
  grass.update(rig.camera);
  walls.update(rig.camera);
  cottage.update(dt, rig.camera);
  fireflies.update(dt, atmo.uniforms.uNight.value, story.focus);
  rain.update(dt, shower, rig.camera, wind.breeze);
  const joining = glider.departing && glider.position.distanceTo(child.position) < 200 ? glider.position : null;
  starlings.update(dt, params.dusk ?? story.dusk, joining);
  water.update(rig.camera);
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
      stones: walls.stones,
      ratio: pixelRatio,
      heightParity,
    };
    if (time > 0.75) window.__ready = true;
  }
  requestAnimationFrame(frame);
}

if (params.shot) window.__game = { wind, input, rig, renderer, scene, glider, lines, sound, child, story, creatures, hillCreatures, water, terrain, cottage, petals, grass };
requestAnimationFrame(frame);
