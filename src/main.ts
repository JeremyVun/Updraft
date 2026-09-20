import { LittleBoats } from './world/little-boats';
import * as THREE from 'three';
import { Soundscape, type SoundState } from './audio/audio';
import { CameraRig } from './camera';
import { Creatures } from './creatures/creatures';
import { islandHabitat, mainlandHabitat } from './creatures/habitat';
import { Petals } from './fx/petals';
import { Swirl } from './fx/swirl';
import { ScarfInvitation } from './fx/scarf-invitation';
import { WashingInvitation } from './fx/washing-invitation';
import { SailInvitation } from './fx/sail-invitation';
import { WindLines } from './fx/windlines';
import { Glider } from './glider/glider';
import { PlaneIndicator } from './glider/indicator';
import { ROUTE } from './story/meadow';
import { takeCues } from './story/cues';
import { Journey } from './story/journey';
import { clearProgress } from './story/progress';
import { EmberInvitation } from './fx/ember-invitation';
import { Embers } from './fx/embers';
import { Fireflies } from './fx/fireflies';
import { Murmuration } from './fx/murmuration';
import { Rain } from './fx/rain';
import { StormWeather } from './fx/storm';
import { SeaLife } from './fx/sealife';
import { Boat } from './traveller/boat';
import { Drawing } from './traveller/drawing';
import { Traveller } from './traveller/traveller';
import { Cursor } from './input/cursor';
import { PointerInput } from './input/pointer';
import { params } from './params';
import { gpuIdle, precompile, precompileSim, warmRender, yieldBoot } from './gl/boot';
import { Quality, WORLD_QUALITY, type QualityLevel } from './gl/quality';
import { endFrame, pollReadbacks, readbackStats } from './gl/readback';
import { createReadout, percentile } from './gl/readout';
import { Post } from './post/post';
import { createWindDebug } from './wind/debug';
import { WindField, type WindSample } from './wind/field';
import { CLOUD_SPAN, atmo } from './world/atmosphere';
import { CloudShadows } from './world/clouds';
import { createDistantIslands } from './world/distant';
import { Grass } from './world/grass';
import { GroundBakes, type BakeInputs } from './world/ground';
import { LifeField } from './world/life';
import { applyPalette, applySleepingPalette } from './world/palette';
import { heightAt } from './world/island';
import { FLOWER_PATCHES, ROCKS, TREE, wildflowersAlong } from './world/landmarks';
import { measureHeightParity } from './world/parity';
import { createRocks } from './world/rocks';
import { Foley, type Surface } from './audio/foley';
import { Carry } from './companion/carry';
import { Probe } from './companion/probe';
import { Cygnet } from './creatures/cygnet';
import { screenPan } from './creatures/motion';
import { SwanFlock } from './creatures/flock';
import { CURTAINS, washingPassage } from './world/lines-passage';
import { createDoorShoreGrass } from './world/door-shore';
import { DOOR_EXIT, doorway, DoorwayView } from './world/doorway';
import { FAMILY_LINE, WashingLines, baskets, door, lineField, seaLines } from './world/lines';
import { piano } from './world/piano';
import { DepartureKites } from './story/departure-kites';
import { Pinwheels } from './world/pinwheels';
import { LINES_WALK, LINES_LANDING } from './story/lines';
import { DrownedVillage } from './world/drowned';
import { SleepingIsland } from './world/sleeping';
import { DarkWood } from './world/wood';
import { AutumnBirches } from './world/birches';
import { createTree } from './world/tree';
import { createSky } from './world/sky';
import { Terrain } from './world/terrain';
import { Cottage } from './world/cottage';
import { createJetty } from './world/jetty';
import { COTTAGE, ISLES, mainlandCoastZ, meadowPoint } from './world/heightfield';
import { Pond } from './world/pond';
import { SkyMirror } from './world/sky-mirror';
import { Water } from './world/water';
import { REFLECTION_LAYER } from './world/water/reflection';
import { surfUniforms } from './world/water/surf';
import { swellUniforms } from './world/water/swell';
import { WINDOW, followWindow, onWindowMove, windowCentre } from './world/window';
import { tuning } from './tuning';
import { startScreen } from './start-screen';

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
await yieldBoot();
const wind = new WindField(renderer, params.lite ? { res: 128, iterations: 12, maxSubsteps: 1 } : {});
const input = new PointerInput(canvas);
const cursor = new Cursor(canvas);

await yieldBoot();
const tree = createTree();
const hillFlowers = wildflowersAlong(ROUTE);
const bakes = new GroundBakes(renderer);
const bakeInputs: BakeInputs = {
  occluders: tree.canopy,
  clearings: [
    ...ROCKS.map((r) => ({ x: r.x, z: r.z, radius: r.radius })),
    { x: TREE.x, z: TREE.z, radius: 1.6 },
    { x: COTTAGE.x, z: COTTAGE.z, radius: 6.5 },
    piano.clearing,
  ],
  flowers: [...FLOWER_PATCHES, ...hillFlowers],
};
await yieldBoot();
const water = new Water(renderer, scene, wind.breeze, bakes.height.texture);
const bakedSun = atmo.uniforms.uSunDir.value.clone();
onWindowMove(() => {
  bakedSun.copy(atmo.uniforms.uSunDir.value);
  bakes.bake(bakeInputs);
  water.bakeShore(WINDOW.size);
});
await yieldBoot();
const life = new LifeField(renderer);
const clouds = new CloudShadows(renderer);
const sky = createSky();
scene.add(sky);
const terrain = new Terrain(wind.breeze, bakes.filterable);
scene.add(terrain.mesh);
scene.add(water.mesh);
const pond = new Pond();
pond.objects.forEach((o) => scene.add(o));
scene.add(createRocks());
scene.add(createDistantIslands());
scene.add(tree.group);
await yieldBoot();
const grass = new Grass();
scene.add(grass.group);
/** Left on the sand where the boat comes in, so the first thing the island says is that somebody was here. */
const washingBaskets = baskets(LINES_LANDING.x + 5, LINES_LANDING.y - 3);
scene.add(washingBaskets);

/** An ordinary red door; the separate shore is visible only inside its opening. */
scene.add(door.group);

/** And an upright piano standing in the meadow grass, off the walk, which the wind plays. */
scene.add(piano.group);

/** Hung around the walk over the island, so the open ground through it is always the way on. */
await yieldBoot();
const washing = new WashingLines(
  [...lineField(new THREE.Vector2(ISLES.lines.x, ISLES.lines.z + 8), 210, 49, 17, LINES_WALK, [FAMILY_LINE, ...CURTAINS]), ...CURTAINS, ...seaLines()],
  91,
  FAMILY_LINE,
);
scene.add(washing.group);
/** The same kite marks every departure. Lines keeps its kite inside the doorway reveal. */
await yieldBoot();
const departureKites = new DepartureKites(wind);
const kite = departureKites.markers.lines;
for (const marker of Object.values(departureKites.markers)) scene.add(marker.group);
const shoreFamily = new WashingLines([], 91, {
  a: new THREE.Vector3(234.8, heightAt(240, -462) + 5.2, -462),
  b: new THREE.Vector3(245.2, heightAt(240, -462) + 5.2, -462), sag: 0.18,
});
scene.add(shoreFamily.group);
const shoreGrass = createDoorShoreGrass();
scene.add(shoreGrass);
const pinwheels = new Pinwheels(wind, LINES_WALK);
scene.add(pinwheels.group);
await yieldBoot();
const village = new DrownedVillage(wind);
village.objects.forEach((o) => scene.add(o));
await yieldBoot();
const wood = new DarkWood(wind);
wood.objects.forEach((o) => scene.add(o));
await yieldBoot();
const sleeping = new SleepingIsland(renderer, wind, input);
sleeping.objects.forEach((o) => scene.add(o));
await yieldBoot();
const skyMirror = new SkyMirror();
scene.add(skyMirror.group);
const littleBoats = new LittleBoats();
scene.add(littleBoats.group);
const birches = new AutumnBirches(renderer, wind);
birches.objects.forEach((o) => scene.add(o));
await yieldBoot();
const cottage = new Cottage(wind);
cottage.objects.forEach((o) => scene.add(o));
/** And out from the beach below it, the one landing in the journey that was built rather than run up onto. */
scene.add(createJetty());
await yieldBoot();
const petals = new Petals(renderer, tuning.petals.stillIslandShare);
scene.add(petals.mesh);
const allFlowers = [...FLOWER_PATCHES, ...hillFlowers];
const petalsHomedAt = new THREE.Vector2(1e9, 1e9);
/** Keeps the petals in the flower patches near the window, so gusts lift colour wherever the journey is. */
function homePetals(): void {
  const [cx, cz] = windowCentre();
  if (Math.hypot(cx - petalsHomedAt.x, cz - petalsHomedAt.y) < 60) return;
  petalsHomedAt.set(cx, cz);
  const near = allFlowers.filter((f) => Math.hypot(f.x - cx, f.z - cz) < 190);
  petals.rehome(near, cz < -600 ? tuning.petals.pastureShare : cz > -200 ? tuning.petals.stillIslandShare : 1);
}
homePetals();
await yieldBoot();
const lines = new WindLines(wind);
scene.add(lines.batch.mesh);
/** The wind the player draws by circling the cursor, and the same loops offered where the story wants them. */
const swirl = new Swirl();
scene.add(swirl.batch.mesh);
const scarfInvitation = new ScarfInvitation();
scene.add(scarfInvitation.batch.mesh);
const washingInvitation = new WashingInvitation();
scene.add(washingInvitation.batch.mesh);
const sailInvitation = new SailInvitation();
scene.add(sailInvitation.batch.mesh);
const glider = new Glider(wind, tree.canopy);
const planeIndicator = new PlaneIndicator();
glider.objects.forEach((o) => scene.add(o));
await yieldBoot();
const child = new Traveller(wind);
child.objects.forEach((o) => scene.add(o));
await yieldBoot();
const boat = new Boat(wind);
boat.objects.forEach((o) => scene.add(o));
for (const o of [...glider.objects, ...boat.objects, ...child.objects]) if (o !== child.shadow) o.traverse((c) => c.layers.enable(REFLECTION_LAYER));
const drawing = new Drawing();
scene.add(drawing.mesh);
const fireflies = new Fireflies(wind);
scene.add(fireflies.mesh);
const emberArtwork = await new THREE.TextureLoader().loadAsync(new URL('../assets/fx/ember-orb.webp', import.meta.url).href);
emberArtwork.colorSpace = THREE.SRGBColorSpace;
const embers = new Embers(wind, emberArtwork);
scene.add(embers.mesh);
const emberInvitation = new EmberInvitation();
scene.add(emberInvitation.batch.mesh);

await yieldBoot();
const rain = new Rain();
const stormWeather = new StormWeather((strength, pan) => {
  sound.thunder(strength, pan);
  if (story.name === 'drowned' && cygnet.carried) {
    cygnet.mind.startle(0.12);
    cygnet.mind.react('flinch');
  }
});
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
await yieldBoot();
const sealife = new SeaLife(wind, rig.camera);
sealife.objects.forEach((o) => scene.add(o));
await yieldBoot();
const cygnet = new Cygnet();
cygnet.objects.forEach((o) => { scene.add(o); o.traverse((part) => part.layers.enable(REFLECTION_LAYER)); });
cygnet.mount = child;
const carry = new Carry(child, cygnet);
const foley = new Foley();
let nextBugle = 0;
let swanBeat = 0;
const probe = params.shot ? new Probe(child, cygnet, carry) : null;
const flock = new SwanFlock();
flock.objects.forEach((o) => scene.add(o));
const cygnetAir: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
const cygnetAhead: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
const handsAt = new THREE.Vector3();
const creatureAt = new THREE.Vector3();
const emberAt = new THREE.Vector3();
const story = new Journey({ child, plane: glider, boat, wind, input, life, tree, drawing, cottage, sealife, cygnet, flock, carry, embers, birches, sleeping, littleBoats, skyMirror, nearby: nearbyCreature });
/** One update first, so the opening shot is the chapter's own and not the origin eased into over several seconds. */
story.update(0, 0);
rig.cut(story.shot);
const windDebug = params.debug === 'wind' || params.debug === 'sway' ? createWindDebug(params.debug === 'sway') : null;
if (windDebug) scene.add(windDebug);
await yieldBoot();
const creatures = new Creatures(wind, islandHabitat(tree.canopy), input, rig.camera);
creatures.spawn({ x: 1, z: 5, radius: 20, rabbits: 6, butterflies: 26 });
creatures.spawn({ x: 0, z: 0, radius: 30, songbirds: 11, seed: 3 });
creatures.spawn({ x: -6, z: -14, radius: 55, gulls: 5, seed: 2 });
scene.add(creatures.group);
const homesInHills = [
  ...ROUTE.map((p: THREE.Vector2, i: number) => ({ x: p.x + (i % 2 ? 14 : -14), z: p.y })),
  { x: COTTAGE.x + 6, z: COTTAGE.z + 26 },
];
await yieldBoot();
const hillCreatures = new Creatures(wind, mainlandHabitat(hillFlowers, homesInHills), input, rig.camera);
hillCreatures.spawn({ ...meadowPoint(10, -680), radius: 70, gulls: 4, seed: 21 });
homesInHills.forEach((h, i) => {
  const last = i === homesInHills.length - 1;
  hillCreatures.spawn({ x: h.x, z: h.z, radius: 26, rabbits: 2, songbirds: i % 2 === 0 || last ? 4 : 0, butterflies: last ? 0 : 6, seed: 30 + i });
});
const sheepFolds = [
  { ...meadowPoint(-10, -755), sheep: 6 },
  { ...meadowPoint(28, -766), sheep: 4 },
  { ...meadowPoint(-22, -916), sheep: 5 },
  { ...meadowPoint(18, -980), sheep: 5 },
  { ...meadowPoint(30, -1098), sheep: 4 },
  { ...meadowPoint(24, -1150), sheep: 4 },
  { ...meadowPoint(6, -1130), sheep: 5 },
  { x: COTTAGE.x - 15, z: COTTAGE.z + 20, sheep: 6 },
];
sheepFolds.forEach((fold, i) => hillCreatures.spawn({ ...fold, radius: 10, seed: 60 + i }));
scene.add(hillCreatures.group);

await yieldBoot();
const maxPixelRatio = params.ratio ?? Math.min(window.devicePixelRatio, 2);
/** Phones open at a modest scale and climb if they prove smooth; opening at full scale costs seconds of crawl. */
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const post = new Post(renderer, scene, rig.camera, params.msaa ?? (maxPixelRatio >= 1.75 ? 2 : 4));
const doorwayActors = [...child.objects, ...cygnet.objects, ...glider.objects];
const doorwayShared = [sky, terrain.mesh, water.mesh, ...doorwayActors];
const doorwaySource = new Set([...doorwayShared, grass.group, washing.group, washingBaskets, pinwheels.group, door.group, lines.batch.mesh, swirl.batch.mesh, washingInvitation.batch.mesh]);
const doorwayDestination = new Set([...doorwayShared, shoreGrass, shoreFamily.group, kite.group, lines.batch.mesh]);
const doorwayView = new DoorwayView(renderer, scene, terrain, water,
  doorwaySource, doorwayDestination,
  [shoreGrass, shoreFamily.group, kite.group],
  [{ objects: [...child.objects, ...glider.objects], at: child.position }, { objects: cygnet.objects, at: cygnet.position }]);
const quality = new Quality(maxPixelRatio, post.samples, window.innerWidth, window.innerHeight, coarsePointer ? 1.25 : maxPixelRatio, params.ratio !== null || params.msaa !== null, (level) => {
  const resizeTargets = pixelRatio !== level.ratio || post.samples !== level.samples;
  pixelRatio = level.ratio;
  post.samples = level.samples;
  applyWorldQuality(level);
  if (resizeTargets) resize();
}, coarsePointer ? 1 : 2);
function applyWorldQuality(level: QualityLevel, immediate = false): void {
  const detail = WORLD_QUALITY[params.lite ? 0 : level.detail];
  grass.setQuality(detail.grassDensity, detail.grassReach, immediate);
  terrain.detail = detail.terrainSplit;
  water.mirrorEvery = detail.mirrorEvery;
  water.mirrorScale = detail.mirrorScale;
}
applyWorldQuality(quality.level, true);
let pixelRatio = quality.level.ratio;
post.samples = quality.level.samples;

const sound = new Soundscape();
const soundButton = document.getElementById('sound') as HTMLButtonElement;
const fullscreenButton = document.getElementById('fullscreen') as HTMLButtonElement;
function setSound(on: boolean): void {
  sound.setMuted(!on);
  if (on) sound.start();
  soundButton.dataset.on = String(on);
  soundButton.setAttribute('aria-pressed', String(on));
}
let soundChosen = false;
soundButton.addEventListener('click', () => {
  soundChosen = true;
  setSound(soundButton.dataset.on !== 'true');
});
input.onButton((kind) => {
  if (kind === 'down' && soundChosen && soundButton.dataset.on === 'true' && !sound.running) sound.start();
  if (kind === 'down' && !soundChosen && !params.shot) {
    soundChosen = true;
    setSound(true);
  }
});
window.addEventListener('keydown', (e) => {
  if (import.meta.env.DEV && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'R') {
    e.preventDefault();
    clearProgress();
    location.replace(location.pathname);
    return;
  }
  if (startScreen.started && (e.key === 'm' || e.key === 'M')) {
    soundChosen = true;
    setSound(soundButton.dataset.on !== 'true');
  }
});

fullscreenButton.hidden = !document.fullscreenEnabled;
function syncFullscreen(): void {
  const active = document.fullscreenElement !== null;
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
}
fullscreenButton.addEventListener('click', () => {
  const change = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  void change.catch(() => syncFullscreen());
});
document.addEventListener('fullscreenchange', syncFullscreen);

const soundState: SoundState = {
  gust: 0,
  pan: 0,
  rise: 0,
  charge: 0,
  overLand: false,
  breeze: 0,
  music: 'still' as const,
  gliderLift: 0,
  life: 0,
  night: 0,
  sea: 1,
  meadow: 0,
  shower: 0,
  hush: 0,
  scripted: false,
  silence: false,
  cues: [],
};
const credits = document.getElementById('credits') as HTMLElement;
document.getElementById('again')?.addEventListener('click', () => {
  if (params.progress) clearProgress();
  location.reload();
});
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

let heightParity = 0;

const breezeAngle = THREE.MathUtils.degToRad(-18);
/** What the sky is actually showing, eased toward the current chapter's numbers; the first frame takes them whole. */
const shown = { dusk: NaN, haze: NaN, shower: NaN, season: NaN, storm: NaN, woodShade: NaN, islandVeil: NaN };
function ease(from: number, to: number, rate: number, dt: number): number {
  return Number.isNaN(from) ? to : from + (to - from) * (1 - Math.exp(-dt * rate));
}
let time = 0;
let last = performance.now();
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  quality.reset(last);
});
let frames = 0;
let fpsWindowStart = last;
let fps = 0;
let sinceLightBake = 0;
let stormShadowCovered = false;
let frameIndex = 0;
let qaWhaleAt = 8;
const readout = params.stats ? createReadout() : null;
const intervals: number[] = [];
const cpuTimes: number[] = [];
let bootMs = 0;

/** `?whale`: a whale surfaces ahead and to the left of the boat every 40 s, and fish keep leaping by it. */
function whaleForQa(): void {
  sealife.fishNear(boat.position, 1);
  if (time < qaWhaleAt) return;
  qaWhaleAt = time + 40;
  const fx = Math.sin(boat.yaw);
  const fz = Math.cos(boat.yaw);
  sealife.surfaceWhale(new THREE.Vector3(boat.position.x + fx * 125 + fz * 26, 0, boat.position.z + fz * 125 - fx * 26), boat.yaw - 0.3);
}

function frame(now: number): void {
  if (document.hidden) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  if (params.hold !== null && frameIndex >= params.hold) {
    post.render(time);
    endFrame(renderer);
    requestAnimationFrame(frame);
    return;
  }
  // RAF timestamps mark the frame's start, which can precede the Begin click or visibility reset.
  // Wait for a later frame: negative time reverses the tide, and zero breaks velocity calculations.
  if (now <= last) {
    requestAnimationFrame(frame);
    return;
  }
  const cpuStart = performance.now();
  const realDt = (now - last) / 1000;
  quality.frame(now, now - last);
  last = now;
  const dt = params.shot ? 1 / 60 : Math.min(realDt, 1 / 20);
  time += dt;

  renderer.info.reset();
  frameIndex++;
  const veer = Math.sin(time * 0.021) * 0.35;
  wind.breeze.set(Math.cos(breezeAngle + veer), Math.sin(breezeAngle + veer)).multiplyScalar(tuning.wind.breeze * story.breeze);

  input.muted = story.current.scripted ?? false;
  input.twirlGain = story.current.twirlGain ?? 1;
  input.anchor = story.name === 'mirror' ? skyMirror.liftTarget : story.current.invitesFlight && !cygnet.gone ? cygnet.position
    : story.name === 'birches' ? birches.scarf.updraftTarget : null;
  input.update(dt, rig.camera, wind);
  washingPassage.active?.brush(rig.camera, input, wind);
  if (story.name === 'boats') littleBoats.brush(rig.camera, input, wind);
  if (story.name === 'birches') {
    birches.scarf.brush(rig.camera, input, wind, dt);
    birches.swing.brush(rig.camera, input, wind);
  }
  if (input.present && !input.muted) glider.brush(rig.camera, input.prevNdc, input.ndc, input.gust, input.gustDir, input.charge, dt);
  const emberBreath = embers.brush(rig.camera, input, story.current.windInvitation ?? null, dt);
  story.current.brushDry?.(emberBreath);
  skyMirror.brush(dt, time, input, rig.camera);
  story.update(dt, time);
  if (story.name !== 'boats' && littleBoats.departing) littleBoats.update(dt, time, wind, Infinity);
  creatures.gulls.follow(story.escort);
  atmo.uniforms.uRainbow.value = story.rainbow;
  boat.update(dt, time);
  child.update(dt);
  skyMirror.pose(child);
  glider.update(dt, time);
  flock.update(dt, time);
  carry.update(dt);
  if (story.name === 'boats') littleBoats.afterChildPose(child);
  const notice = cygnet.world;
  child.face(notice.face);
  notice.hands = carry.offering(handsAt);
  notice.plane = glider.position.distanceToSquared(cygnet.position) < 400 ? glider.position : null;
  notice.creature = nearbyCreature(cygnet.position.x, cygnet.position.z, 7, creatureAt) ? creatureAt : null;
  notice.flock = flock.active ? flock.head : null;
  notice.light = atmo.uniforms.uEmberLight.value.w > 0.15 ? emberAt : null;
  notice.dark = atmo.uniforms.uNight.value;
  notice.rain = shown.shower || 0;
  /** The white comes through its grey as the year turns: none on the first island, plain to see by the last. */
  cygnet.look.grown = THREE.MathUtils.smoothstep(atmo.uniforms.uSeason.value, 0.4, 1);
  notice.cold = THREE.MathUtils.clamp((atmo.uniforms.uSeason.value - 0.5) * 1.6 + atmo.uniforms.uNight.value * 0.3, 0, 1);
  /**
   * The cygnet reads the air where it is standing. Wind brushed under it with the cursor lifts it as a held updraft
   * does, because moving the cursor is the only verb the game has taught. Not where it has just fallen, though:
   * there it is the child's to gather up.
   */
  wind.sample(cygnet.position.x, cygnet.position.z, cygnetAir);
  /**
   * It feels for the air a little way round itself as well as under it: circles drawn about a small bird put their
   * wind beside it, not beneath it, and a column wound a stride ahead of a running one is under it when it counts.
   */
  for (let i = 0; i < 4; i++) {
    const a = cygnet.yaw + i * Math.PI * 0.5;
    wind.sample(cygnet.position.x + Math.sin(a) * tuning.colt.reach, cygnet.position.z + Math.cos(a) * tuning.colt.reach, cygnetAhead);
    cygnetAir.lift = Math.max(cygnetAir.lift, cygnetAhead.lift);
    cygnetAir.energy = Math.max(cygnetAir.energy, cygnetAhead.energy);
  }
  if (cygnet.state !== 'fallen' && story.current.invitesFlight) cygnetAir.lift += cygnetAir.energy * tuning.colt.gustLift;
  cygnet.update(dt, time, child.position, cygnetAir);
  carry.after();
  foley.setOutput(sound.output);
  const heardPan = screenPan(rig.camera, cygnet.position);
  for (const h of cygnet.heard) {
    if (h.kind === 'step') {
      const under: Surface = child.riding && cygnet.position.distanceToSquared(boat.position) < 9 ? 'wood' : heightAt(cygnet.position.x, cygnet.position.z) < 0.9 ? 'sand' : 'grass';
      foley.step(under, h.amount, heardPan);
    } else if (h.kind === 'flap') foley.flap(h.amount, heardPan);
    else if (h.kind === 'flutter') foley.flutter(6, h.amount, heardPan);
    else if (h.kind === 'shake') foley.shake(heardPan, cygnet.mind.wet);
    else if (h.kind === 'tumble') foley.tumble(h.amount, heardPan);
    else if (h.kind === 'plunge') foley.plunge(heardPan);
    else if (h.kind === 'paddle') foley.paddle(h.amount, heardPan);
    else foley.rustle(h.amount, heardPan);
  }
  cygnet.heard.length = 0;
  /** The grown swans are heard before they are seen: the throb of their wings, and now and then one of them calling. */
  if (flock.active) {
    const far = THREE.MathUtils.clamp(flock.head.distanceTo(rig.camera.position) / 320, 0, 1);
    const swanPan = screenPan(rig.camera, flock.head);
    swanBeat += dt * 3.4;
    if (swanBeat > Math.PI * 2 && far < 0.75) {
      swanBeat -= Math.PI * 2;
      foley.wingbeat(swanPan, far);
    }
    if (time > nextBugle) {
      foley.bugle(swanPan + (Math.random() - 0.5) * 0.4, far, 0.8 + Math.random() * 0.4);
      nextBugle = time + 1.6 + Math.random() * 4.5;
    }
  }
  probe?.update(time);
  pollReadbacks();
  wind.step(dt, time);
  life.update(dt);
  tree.life.value += (Math.min(1, life.at(TREE.x, TREE.z) * 1.15) - tree.life.value) * (1 - Math.exp(-dt * 0.8));
  /**
   * Time of day, haze and rain are eased toward what the chapter asks for rather than taken from it, because a
   * chapter change is a hard cut in those numbers and the sky must never jump between two rooms of one dream.
   */
  const dusk = params.dusk ?? ease(shown.dusk, story.dusk, 0.5, dt);
  const haze = ease(shown.haze, story.haze, 0.6, dt);
  const shower = params.shower ?? ease(shown.shower, story.shower, 0.8, dt);
  /** The year turns island by island and never goes back; like the sky, it is eased so no room change cuts. */
  atmo.uniforms.uSeason.value = ease(shown.season, story.season, 0.35, dt);
  shown.season = atmo.uniforms.uSeason.value;
  const storm = params.storm ?? story.current.storm ?? 0;
  /** The sea answers the weather, and it is still in frame across a room change, so it eases like the sky does. */
  const squall = ease(shown.storm, storm, 0.5, dt);
  /** Whether the story is standing on anything: several things only belong over land, and the journey is mostly sea. */
  const overLand = THREE.MathUtils.smoothstep(heightAt(story.focus.x, story.focus.z), -1.5, 2.5);
  shown.dusk = dusk;
  shown.haze = haze;
  shown.shower = shower;
  shown.storm = squall;
  const flat = story.current.trodden ?? null;
  const tread = atmo.uniforms.uTrodden.value;
  if (flat) tread.set(flat.x, flat.z, flat.y, ease(tread.w, 1, 1.4, dt));
  else tread.w = ease(tread.w, 0, 1.4, dt);
  applyPalette(story.worldLife, dusk, shower, squall);
  applySleepingPalette(sleeping.presence);
  shown.woodShade = ease(shown.woodShade, story.name === 'wood' ? overLand * atmo.uniforms.uNight.value : 0, 1.2, dt);
  stormWeather.update(dt, storm, boat.afloat ? boat.yaw : child.yaw,
    story.name === 'wood' ? THREE.MathUtils.lerp(1, tuning.wood.lightningScale, overLand) : 1, shown.woodShade);
  /**
   * How far the dream lets you see. Beyond it the world dissolves, so the next island is never a spoiler.
   * A clear night has nothing out there to give away and everything to show, so the veil draws back and the
   * sea keeps the stars on it all the way out.
   */
  atmo.uniforms.uOpenSea.value = ease(atmo.uniforms.uOpenSea.value, story.current.openSea ?? 0, 0.7, dt);
  // Keep the meadow's own hills clear while concealing every shore beyond it, including in the sea's mirror.
  // On departure the next room emerges gradually; direct chapter starts get the complete veil on frame one.
  const islandVeil = story.name === 'meadow' ? 1 : 0;
  shown.islandVeil = ease(shown.islandVeil, islandVeil, 0.7, dt);
  if (Math.abs(shown.islandVeil - islandVeil) < 0.001) shown.islandVeil = islandVeil;
  atmo.uniforms.uIslandVeil.value.set(ISLES.meadow.x, ISLES.meadow.z, ISLES.meadow.rx, ISLES.meadow.rz);
  atmo.uniforms.uIslandVeilAmount.value = shown.islandVeil;
  const seen = haze * (1 - 0.7 * atmo.uniforms.uStarlight.value);
  atmo.uniforms.uVeil.value.set(
    THREE.MathUtils.lerp(900 - 780 * seen, tuning.storm.stormVeil, squall),
    THREE.MathUtils.lerp(0.002 + 0.03 * seen, tuning.storm.stormVeilDensity, squall) * (1 - atmo.uniforms.uLightning.value.w * 0.8),
  );
  sinceLightBake++;
  const shadowCovered = atmo.uniforms.uStormCover.value >= tuning.storm.shadowCovered;
  // The shared shader fades terrain shadows out under opaque storm cloud. Re-bake on clearing, even if
  // a window move updated bakedSun while the light was hidden and the sun itself has since stood still.
  if (!shadowCovered && (stormShadowCovered || (sinceLightBake >= 3 && bakedSun.angleTo(atmo.uniforms.uSunDir.value) > 0.0004))) {
    sinceLightBake = 0;
    bakedSun.copy(atmo.uniforms.uSunDir.value);
    bakes.bakeLight(bakeInputs);
  }
  stormShadowCovered = shadowCovered;
  bakes.tick();
  post.saturation = (0.62 + 0.38 * story.worldLife) * (1 - 0.3 * squall);
  surfUniforms.uSeaState.value = story.breeze;
  surfUniforms.uSquall.value = squall;
  /** Trough to crest in world units: a breathing swell on a calm day, a sea running in a squall. */
  swellUniforms.uSwell.value = (0.25 + 1.45 * squall) * story.breeze;
  boat.swell = squall;

  const u = atmo.uniforms;
  u.uTime.value = time;
  u.uWindTex.value = wind.texture;
  u.uBendTex.value = wind.bendTexture;
  u.uSwayTex.value = wind.swayTexture;
  u.uCalm.value = wind.calm;
  u.uCloudShift.value.addScaledVector(wind.breeze, dt * 2.2);

  /** The washing gives way in front of whoever the camera is watching, so they are never lost behind a sheet. */
  washing.subject.set(child.position.x, child.position.y + 1.1, child.position.z, child.visible ? 1 : 0);
  /** And so do the birches, for the same reason. */
  birches.subject.copy(washing.subject);

  homePetals();
  petals.update(dt, input.present && input.charge > 0 ? input.updraftAt : null, input.charge);
  const pointerWorld = input.present ? input.world : null;
  lines.update(dt, pointerWorld, input.gust, input.present && input.charge > 0 ? input.updraftAt : null, input.charge);
  swirl.update(dt, rig.camera, input, story.current.coax ?? (story.name === 'birches' ? scarfInvitation.coax : null));
  cursor.update(input.gust, input.charge, input.down);
  const creatureEnv = {
    camera: rig.camera,
    input,
    glider: glider.position,
    walker: child.visible ? child.position : null,
    life: (x: number, z: number) => life.at(x, z),
    breeze: story.breeze,
    night: atmo.uniforms.uNight.value,
    audio: sound.output,
  };
  creatures.update(dt, time, creatureEnv);
  hillCreatures.update(dt, time, creatureEnv);

  const riseNow = input.ndc.x - input.prevNdc.x + (input.ndc.y - input.prevNdc.y);
  soundState.rise += (Math.sign(riseNow) - soundState.rise) * (Math.abs(riseNow) > 1e-4 ? 0.3 : 0);
  soundState.gust = input.present ? input.gust : 0;
  soundState.pan = input.ndc.x;
  soundState.charge = input.charge;
  soundState.overLand = heightAt(input.world.x, input.world.z) > 0.5;
  /** The wind where the story is, not where it started: the rooms past the first island are most of the game. */
  const b = wind.sample(story.focus.x, story.focus.z, breezeSample);
  soundState.breeze = Math.min(1, Math.hypot(b.x, b.z) / 6);
  soundState.gliderLift = glider.lift;
  soundState.life = story.worldLife;
  soundState.night = atmo.uniforms.uNight.value;
  /** How far into the meadow the story is — but only counted at all while there is ground under it. */
  const inland = mainlandCoastZ(story.focus.x) - story.focus.z;
  soundState.sea = 1 - overLand * THREE.MathUtils.smoothstep(inland, 20, 260);
  soundState.meadow = overLand * THREE.MathUtils.smoothstep(inland, 60, 200);
  soundState.music = story.music;
  soundState.cues = takeCues();
  soundState.hush += ((story.current.hush ?? 0) - soundState.hush) * (1 - Math.exp(-dt * 1.6));
  soundState.piano = story.current.pianoMix ?? 0;
  soundState.scripted = story.current.scripted ?? false;
  soundState.silence = story.current.silence ?? false;
  if (story.current.finished && !credits.classList.contains('rolling')) credits.classList.add('rolling');
  soundState.shower = shower;
  sound.update(dt, soundState);

  rig.camera.near = story.name === 'lines' && doorway.travelling ? 0.035 : 0.5;
  rig.camera.updateProjectionMatrix();
  rig.update(dt, time, story.shot, story.pace);
  rig.camera.updateMatrixWorld();
  followWindow(...windowAim());
  const cam = rig.camera.position;
  u.uCloudDomain.value.set(cam.x - CLOUD_SPAN / 2, cam.z - CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN);
  clouds.update();
  terrain.update(rig.camera);
  grass.update(rig.camera, dt);
  grass.bake(renderer);
  cottage.update(dt, rig.camera);
  village.update(dt, time, boat.position, storm);
  piano.update(dt, time, rig.camera, wind, sound.output, input, life);
  wood.update(dt, time, rig.camera, storm);
  sleeping.update(dt, time, rig.camera);
  departureKites.update(dt, time, rig.camera, story);
  pinwheels.update(dt, rig.camera, sound.output);
  door.update(dt);
  scarfInvitation.update(dt, rig.camera, story.name === 'birches' ? birches : null);
  washingInvitation.update(dt, rig.camera, story.name === 'lines' ? washingPassage.active : null);
  sailInvitation.update(dt, rig.camera, boat, story.current.invitesSail ?? false, input);
  birches.update(dt, rig.camera, child.visible ? child.position : null);
  /** Under the wood's canopy a sheltered population stays low despite the storm outside. */
  const inWood = story.name === 'wood';
  const flyWeather = inWood ? tuning.wood.fireflyPresence : Math.max(0, 1 - storm * 1.6);
  fireflies.update(dt, atmo.uniforms.uNight.value * overLand * flyWeather * (1 - sleeping.presence), story.focus, inWood);
  emberInvitation.update(dt, rig.camera, story.current.windInvitation ?? null, input,
    undefined, story.name === 'mirror' ? tuning.skyMirror.bubbleRadius : 0);
  embers.update(dt, child.visible ? child.position : story.focus, story.current.embers ?? 0);
  const emberLit = embers.illumination(emberAt);
  atmo.uniforms.uEmberLight.value.set(emberAt.x, emberAt.y, emberAt.z, Math.min(2.6, emberLit * 0.5));
  rain.update(dt, shower, rig.camera, wind.breeze, squall);
  const joining = glider.departing && glider.position.distanceTo(child.position) < 200 ? glider.position : null;
  /** Starlings turn over the hills at sunset, not in a squall. */
  starlings.update(dt, storm > 0.3 ? 0 : (params.dusk ?? story.dusk), joining);
  if (params.whale) whaleForQa();
  sealife.update(dt, time);
  skyMirror.update(dt, time, child.position, cygnet.position, !cygnet.carried);
  water.step(dt);
  // The boat belongs to the arrival room until it moves to the shore beyond the door.
  const boatInWashing = boat.position.distanceToSquared(door.group.position) < boat.position.distanceToSquared(DOOR_EXIT);
  for (const o of boat.objects) {
    (boatInWashing ? doorwaySource : doorwayDestination).add(o);
    (boatInWashing ? doorwayDestination : doorwaySource).delete(o);
  }
  doorwayView.render(rig.camera, story.name === 'lines', story.name === 'island' || story.name === 'toLines', () => {
    // The sea's reflection belongs to the same room as the main view.
    water.update(rig.camera, (mirrorCamera) => terrain.beginMirror(mirrorCamera), () => terrain.endMirror());
    post.render(time);
  });
  planeIndicator.update(dt, rig.camera, glider, startScreen.started && !story.current.scripted);
  endFrame(renderer);

  frames++;
  if (readout) {
    intervals.push(realDt * 1000);
    cpuTimes.push(performance.now() - cpuStart);
    if (intervals.length > 120) {
      intervals.shift();
      cpuTimes.shift();
    }
  }
  if (now - fpsWindowStart > 1500) {
    fps = (frames * 1000) / (now - fpsWindowStart);
    frames = 0;
    fpsWindowStart = now;
    if (readout) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      readout([
        `fps ${fps.toFixed(0)}  frame p50 ${percentile(intervals, 0.5).toFixed(0)} p90 ${percentile(intervals, 0.9).toFixed(0)} max ${Math.max(...intervals).toFixed(0)} ms`,
        `cpu (js in frame) p50 ${percentile(cpuTimes, 0.5).toFixed(1)} p90 ${percentile(cpuTimes, 0.9).toFixed(1)} ms${params.lite ? '  LITE' : ''}`,
        `scale ${pixelRatio} of ${maxPixelRatio} (dpr ${window.devicePixelRatio})  msaa ${post.samples}  ${size.x}x${size.y}`,
        `grass ${(grass.quality.density * 100).toFixed(0)}%  reach ${(grass.quality.reach * 100).toFixed(0)}%  detail ${quality.level.detail}`,
        `readbacks ok ${readbackStats.delivered} skipped ${readbackStats.skipped} forced ${readbackStats.forced} worst ${readbackStats.worstMs.toFixed(0)} ms`,
        `draws ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k  blades ${grass.bladesDrawn}  leaves ${terrain.leaves}`,
        `boot ${bootMs.toFixed(0)} ms  ${story.name}`,
      ]);
    }
  }
  if (time > 0.4) startScreen.reveal();
  if (params.shot) {
    window.__stats = {
      frame: frameIndex,
      fps: Math.round(fps),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      blades: grass.bladesDrawn,
      leaves: terrain.leaves,
      ratio: pixelRatio,
      samples: post.samples,
      worldDetail: quality.level.detail,
      grassDensity: grass.quality.density,
      grassReach: grass.quality.reach,
      readbacksSkipped: readbackStats.skipped,
      readbacksForced: readbackStats.forced,
      readbacksDelivered: readbackStats.delivered,
      readbackWorstMs: Math.round(readbackStats.worstMs * 10) / 10,
      heightParity,
    };
    if (time > 0.75) window.__ready = true;
  }
  requestAnimationFrame(frame);
}

if (params.shot) {
  window.__game = { quality, wind, input, rig, renderer, scene, glider, lines, swirl, sound, child, story, creatures, hillCreatures, water, skyMirror, terrain, cottage, petals, grass, littleBoats, sealife, cygnet, flock, carry, probe, washing, curtains: CURTAINS, doorway, doorwayView, doorExit: DOOR_EXIT, washingPassage, washingInvitation, scarfInvitation, kite, departureKites, pinwheels, village, wood, stormWeather, sleeping, embers, emberInvitation, fireflies, boat, life, piano, birches, pond };
}

/**
 * Everything the first frame would otherwise pay for happens here, behind the veil: every shader compiles in
 * parallel, the window bakes, warm batches upload the world, and the loop starts only once the GPU is idle.
 */
async function boot(): Promise<void> {
  const started = performance.now();
  await yieldBoot();
  await precompile(renderer, scene, rig.camera, post.sceneTarget);
  await precompileSim(renderer, bakes.ground);
  await grass.precompile(renderer);
  await yieldBoot();
  followWindow(...windowAim(), true);
  grass.update(rig.camera);
  grass.bake(renderer);
  if (params.shot) heightParity = measureHeightParity(renderer);
  await gpuIdle(renderer);
  await yieldBoot();
  await warmRender(renderer, scene, rig.camera, post.sceneTarget);
  await yieldBoot();
  post.render(0);
  await gpuIdle(renderer);
  bootMs = performance.now() - started;
  startScreen.ready(withSound => {
    if (withSound) {
      soundChosen = true;
      setSound(true);
    }
    last = performance.now();
    quality.reset(last);
    fpsWindowStart = last;
    requestAnimationFrame(frame);
  });
}
export const bootReady = boot();
