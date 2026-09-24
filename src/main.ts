import { visibleRooms, setJourneyRooms, drawJourneyRooms, clipJourneyProps, journeyReveal, type Room } from './world/journey-rooms';
import { LittleBoats } from './world/little-boats';
import * as THREE from 'three';
import { Soundscape, type SoundState } from './audio/audio';
import { AudioEnvironment } from './audio/environment';
import { WorldFoley } from './audio/world-foley';
import { BirchesFoley } from './audio/birches-foley';
import { CameraRig } from './camera';
import { Creatures, type CreatureEnv } from './creatures/creatures';
import { nearestCreature } from './creatures/nearby';
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
import { clearProgress, readProgress } from './story/progress';
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
import { gpuIdle, precompile, precompileSim, prepareInBatches, warmRender, yieldBoot } from './gl/boot';
import { Quality, WORLD_QUALITY, type QualityLevel } from './gl/quality';
import { controls } from './controls';
import { endFrame, holdForReadbacks, pollReadbacks, readbackStats, timeLastFrame } from './gl/readback';
import { createReadout, percentile } from './gl/readout';
import { Post } from './post/post';
import { createWindDebug } from './wind/debug';
import { WindField, type WindSample } from './wind/field';
import { CLOUD_SPAN, atmo } from './world/atmosphere';
import { CloudShadows } from './world/clouds';
import { Grass } from './world/grass';
import { sleepingGust } from './world/sleeping-wind';
import { HEARTH } from './world/sleeping-hearth';
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
import { FAMILY_LINE, WashingLines, baskets, door, family, lineField, seaLines } from './world/lines';
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
import { TerrainHeights } from './world/terrain-heights';
import { Cottage } from './world/cottage';
import { createJetty } from './world/jetty';
import { COTTAGE, ISLES, meadowPoint } from './world/heightfield';
import { Pond } from './world/pond';
import { SkyMirror } from './world/sky-mirror';
import { Water } from './world/water';
import { REFLECTION_LAYER } from './world/water/reflection';
import { surfUniforms } from './world/water/surf';
import { swellUniforms } from './world/water/swell';
import { WINDOW, followWindow, onWindowMove, windowCentre } from './world/window';
import { tuning } from './tuning';
import { startScreen } from './start-screen';
import { contextRecovery } from './gl/context-recovery';
import { checkGraphicsCapability } from './gl/graphics-capability';
import { telemetry } from './analytics/telemetry';
import { frameTiming } from './gl/frame-time';
import { FramePacer } from './gl/frame-pacer';
import { saveSoundPreference } from './sound-preference';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: Record<string, number>;
    __game?: Record<string, unknown>;
  }
}

const resumedAtLoad = params.progress && readProgress() !== null;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;
if (params.shot) document.body.classList.add('shot');

/** A missing float render-target format or an unusably small GL limit cannot be fixed by retrying. */
const graphicsCapability = checkGraphicsCapability(renderer);
if (!graphicsCapability.supported) {
  telemetry.failure('graphics', new Error(graphicsCapability.reason));
  startScreen.fail(true);
  throw new Error(`Graphics capability check failed: ${graphicsCapability.reason}`);
}

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
const wind = new WindField(renderer, params.lite ? { res: 128, iterations: 12 } : {});
const input = new PointerInput(canvas);
const cursor = new Cursor(canvas);

await yieldBoot();
const tree = createTree();
const hillFlowers = wildflowersAlong(ROUTE);
const terrainHeights = new TerrainHeights();
const bakes = new GroundBakes(renderer, terrainHeights);
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
const terrain = new Terrain(wind.breeze, bakes.filterable, terrainHeights);
scene.add(terrain.mesh);
scene.add(water.mesh);
const pond = new Pond();
pond.objects.forEach((o) => scene.add(o));
const islandRocks = createRocks();
scene.add(islandRocks);
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
const birches = new AutumnBirches(renderer, wind, false);
await prepareInBatches(birches.scarf.settle());
birches.objects.forEach((o) => scene.add(o));
await yieldBoot();
const cottage = new Cottage(wind);
cottage.objects.forEach((o) => scene.add(o));
/** And out from the beach below it, the one landing in the journey that was built rather than run up onto. */
const homeJetty = createJetty();
scene.add(homeJetty);
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
const stormWeather = new StormWeather((strength, pan, close) => {
  sound.thunder(strength, pan, close);
  if (story.name === 'drowned' && cygnet.carried) {
    cygnet.mind.startle(0.12);
    cygnet.mind.react('flinch');
  }
});
scene.add(rain.mesh);
const starlings = new Murmuration();
scene.add(starlings.mesh);
/** The live populations retain their order, including exact-distance ties. */
function nearbyCreature(x: number, z: number, radius: number, out: THREE.Vector3): boolean {
  return nearestCreature(nearbyPopulations, x, z, radius, out);
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
const worldFoley = new WorldFoley(foley, rig.camera);
const birchesFoley = new BirchesFoley(foley, rig.camera);
const materialAt = new THREE.Vector3();
const splashAt = new THREE.Vector3();
birches.onLeafScuff = (x, z, strength) => {
  birchesFoley.scuff(materialAt.set(x, heightAt(x, z), z), strength,
    sound.running && story.name === 'birches');
};
sealife.onDolphinSplash = (x, y, z, strength) => {
  if (sound.running) worldFoley.splash(splashAt.set(x, y, z), strength);
};
sealife.onDolphinSurface = (x, y, z, strength) => {
  if (sound.running) worldFoley.splash(splashAt.set(x, y, z), strength, true);
};
sealife.onWhaleSound = (kind, x, y, z) => {
  if (sound.running) worldFoley.whale(kind, splashAt.set(x, y, z));
};
const probe = params.shot ? new Probe(child, cygnet, carry) : null;
const flock = new SwanFlock();
flock.objects.forEach((o) => scene.add(o));
const cygnetAir: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
const cygnetAhead: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
const handsAt = new THREE.Vector3();
const creatureAt = new THREE.Vector3();
const emberAt = new THREE.Vector3();
const story = new Journey({ child, plane: glider, boat, wind, input, life, tree, drawing, cottage, sealife, cygnet, flock, carry, embers, birches, sleeping, littleBoats, skyMirror, village, nearby: nearbyCreature });
/** One update first, so the opening shot is the chapter's own and not the origin eased into over several seconds. */
story.update(0, 0);
water.skyMirrorAppearance = story.name === 'toMirror' ? 0 : story.name === 'home' ? 0 : 1;
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
clipJourneyProps(hillCreatures.group);
const roomObjects: Partial<Record<Room, THREE.Object3D[]>> = {
  island: [tree.group, islandRocks, creatures.group], lines: [washing.group, washingBaskets, pinwheels.group, door.group],
  shore: [shoreGrass, kite.group], boats: [littleBoats.group],
  meadow: [piano.group, ...pond.objects], birches: [...birches.objects], drowned: [...village.objects],
  wood: [...wood.objects], sleeping: [...sleeping.objects], mirror: [skyMirror.group], home: [...cottage.objects, homeJetty],
};
for (const [name, marker] of Object.entries(departureKites.markers)) {
  if (name !== "lines") roomObjects[name as Room]?.push(marker.group);
}

await yieldBoot();
const nativePixelRatio = Math.min(window.devicePixelRatio, 2);
// Keep full scene detail while avoiding Retina's disproportionate pixel/bandwidth cost.
const maxPixelRatio = params.ratio ?? Math.min(nativePixelRatio, 1.5);
/** Touch Auto keeps a smaller sustained resolution budget than High. */
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const post = new Post(renderer, scene, rig.camera, Math.min(params.msaa ?? ((params.ratio ?? nativePixelRatio) >= 1.75 ? 2 : 4), Math.max(0, graphicsCapability.maxSamples)));
const doorwayActors = [...child.objects, ...cygnet.objects, ...glider.objects];
const doorwayShared = [sky, terrain.mesh, water.mesh, ...doorwayActors];
const doorwaySource = new Set([...doorwayShared, grass.group, washing.group, washingBaskets, pinwheels.group, door.group, lines.batch.mesh, swirl.batch.mesh, washingInvitation.batch.mesh]);
const doorwayDestination = new Set([...doorwayShared, shoreGrass, kite.group, lines.batch.mesh]);
const doorwayView = new DoorwayView(renderer, scene, terrain, water,
  doorwaySource, doorwayDestination,
  [shoreGrass, kite.group],
  [{ objects: [...child.objects, ...glider.objects], at: child.position }, { objects: cygnet.objects, at: cygnet.position }]);
const quality = new Quality(maxPixelRatio, post.samples, window.innerWidth, window.innerHeight, coarsePointer ? 1.25 : maxPixelRatio, params.ratio !== null || params.msaa !== null, (level) => {
  const resizeTargets = pixelRatio !== level.ratio || post.samples !== level.samples;
  pixelRatio = level.ratio;
  post.samples = level.samples;
  applyWorldQuality(level);
  telemetry.quality(level.ratio, level.samples, level.detail);
  if (resizeTargets) resize();
}, coarsePointer ? 1 : 2, controls.qualityMode, coarsePointer ? 1.25 : maxPixelRatio);
function applyWorldQuality(level: QualityLevel, immediate = false): void {
  const detail = WORLD_QUALITY[params.lite ? 0 : level.detail];
  grass.setQuality(level.grassDensity ?? detail.grassDensity, level.grassReach ?? detail.grassReach, immediate);
  terrain.detail = detail.terrainSplit;
  water.mirrorEvery = detail.mirrorEvery;
  water.mirrorScale = detail.mirrorScale;
  controls.setQualityDetail(params.lite ? 0 : level.detail);
}
applyWorldQuality(quality.level, true);
let pixelRatio = quality.level.ratio;
post.samples = quality.level.samples;

const reportGpu = (early: boolean): void => quality.gpu(early);

let graphicsReady = false;
controls.onQualityChange = mode => {
  // A loading-time choice is applied after warm-up, without resizing targets mid-batch.
  if (graphicsReady && !contextRecovery.lost) quality.setMode(mode, performance.now());
};

const sound = new Soundscape();
const audioEnvironment = new AudioEnvironment(heightAt);
contextRecovery.onPause = () => { input.muted = true; sound.setMuted(true); };
const soundButton = document.getElementById('sound') as HTMLButtonElement;
function setSound(on: boolean): void {
  if (contextRecovery.lost) return;
  sound.setMuted(!on);
  if (on) {
    // AudioContext construction can throw (Web Audio unavailable/disabled, context quota); sound must
    // never block the frame loop from starting.
    try {
      sound.start();
    } catch (error) {
      console.error('Sound could not start', error);
      telemetry.failure('audio', error);
      sound.setMuted(true);
      controls.setSound(false);
      return;
    }
  }
  controls.setSound(on);
}
let soundChosen = false;
controls.onSoundChange = on => {
  soundChosen = true;
  if (startScreen.started) setSound(on);
};
input.onButton((kind) => {
  if (contextRecovery.lost) return;
  if (kind === 'down' && soundChosen && soundButton.dataset.on === 'true' && !sound.running) sound.start();
  if (kind === 'down' && !soundChosen && !params.shot) {
    soundChosen = true;
    setSound(true);
  }
});
window.addEventListener('keydown', (e) => {
  // Text entry and form controls must not trigger game shortcuts.
  if (e.target instanceof Element && e.target.closest('select, input, textarea, [contenteditable="true"]')) return;
  if (import.meta.env.DEV && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'R') {
    e.preventDefault();
    clearProgress();
    location.replace(location.pathname);
    return;
  }
  if (startScreen.started && (e.key === 'm' || e.key === 'M')) {
    const on = soundButton.dataset.on !== 'true';
    soundChosen = true;
    setSound(on);
    saveSoundPreference(on);
  }
});

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
  land: 0,
  cold: 0,
  cygnet: { pan: 0, distance: 0, active: false },
  flock: { pan: 0, distance: 0, active: false },
  shower: 0,
  hush: 0,
  scripted: false,
  silence: false,
  cues: [],
};
const credits = document.getElementById('credits') as HTMLElement;
const lastCredit = credits.querySelector('.entry:last-child') as HTMLElement;
const again = document.getElementById('again') as HTMLButtonElement;
again.addEventListener('click', () => {
  if (params.progress) clearProgress();
  location.reload();
});
const breezeSample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };

const glLimits = renderer.getContext();
/** The largest canvas/target side the GPU can allocate: a huge viewport scales every target down together. */
const maxTargetSize = Math.min(renderer.capabilities.maxTextureSize, glLimits.getParameter(glLimits.MAX_RENDERBUFFER_SIZE),
  ...glLimits.getParameter(glLimits.MAX_VIEWPORT_DIMS));
function resize(): void {
  if (contextRecovery.lost) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = Math.min(pixelRatio, maxTargetSize / Math.max(1, w, h));
  renderer.setPixelRatio(ratio);
  // Keep the displayed canvas and camera on the same viewport, including Safari's browser controls.
  renderer.setSize(w, h);
  post.setSize(w, h, ratio);
  rig.resize(w, h);
}
window.addEventListener('resize', () => {
  quality.resize(window.innerWidth, window.innerHeight, performance.now());
  resize();
});
resize();

let heightParity = 0;

const breezeAngle = THREE.MathUtils.degToRad(-18);
/** What the sky is actually showing, eased toward the current chapter's numbers; the first frame takes them whole. */
const shown = { dusk: NaN, haze: NaN, hazeFalloff: NaN, shower: NaN, season: NaN, storm: NaN, woodShade: NaN, islandVeil: NaN, isleMist: NaN };
const ISLE_MISTS = {
  wood: { isle: ISLES.wood, range: tuning.world.woodMist },
  sleeping: { isle: ISLES.sleeping, range: tuning.world.sleepingMist },
};
let isleMist: (typeof ISLE_MISTS)[keyof typeof ISLE_MISTS] = ISLE_MISTS.wood;
function ease(from: number, to: number, rate: number, dt: number): number {
  return Number.isNaN(from) ? to : from + (to - from) * (1 - Math.exp(-dt * rate));
}
let time = 0;
let last = performance.now();
const pacer = new FramePacer();
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  pacer.reset(last);
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

const nearbyPopulations = [creatures.rabbits.positions, creatures.songbirds.positions,
  hillCreatures.rabbits.positions, hillCreatures.songbirds.positions];
const creatureEnv: CreatureEnv = {
  camera: rig.camera, input, glider: glider.position, walker: null,
  life: (x, z) => life.at(x, z), breeze: 0, night: 0, audio: null,
};

/** World mechanics receive at most 1/30 s; wind subdivides to 1/60 s; input follows the same slice of the screen stroke. */
function simulate(dt: number, inputFraction: number, finalStep: boolean): void {
  time += dt;
  const veer = Math.sin(time * 0.021) * 0.35;
  wind.breeze.set(Math.cos(breezeAngle + veer), Math.sin(breezeAngle + veer)).multiplyScalar(tuning.wind.breeze * story.breeze);

  input.muted = story.current.scripted ?? false;
  input.twirlGain = story.current.twirlGain ?? 1;
  input.anchor = story.name === 'mirror' ? skyMirror.liftTarget : story.current.invitesFlight && !cygnet.gone ? cygnet.position
    : story.name === 'birches' ? birches.scarf.updraftTarget : null;
  input.update(dt, rig.camera, wind, inputFraction);
  washingPassage.active?.brush(rig.camera, input, wind);
  if (story.name === 'boats') littleBoats.brush(rig.camera, input, wind);
  if (story.name === 'birches') {
    birches.scarf.brush(rig.camera, input, wind, dt);
    birches.swing.brush(rig.camera, input, wind);
  }
  if (input.present && !input.muted) glider.brush(rig.camera, input.prevNdc, input.ndc, input.gust, input.gustDir, input.charge, dt);
  const emberBreath = embers.brush(rig.camera, input, story.current.windInvitation ?? null, dt);
  story.current.brushDry?.(story.name==='sleeping' ? sleeping.trail.brush(rig.camera,input,dt) ?? emberBreath : emberBreath);
  skyMirror.brush(dt, time, input, rig.camera);
  story.update(dt, time);
  telemetry.chapter(story.name);
  if (story.current.finished) telemetry.complete();
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
  notice.cold = story.name === 'sleeping' ? sleeping.cold * (1-sleeping.dawn) : THREE.MathUtils.clamp((atmo.uniforms.uSeason.value - 0.5) * 1.6 + atmo.uniforms.uNight.value * 0.3, 0, 1);
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
  foley.frost(story.name==='sleeping' ? sleeping.cold*(1-sleeping.dawn) : 0);
  if(story.name==='sleeping')foley.hearth(sleeping.hearth.flame.value,1-THREE.MathUtils.smoothstep(rig.camera.position.distanceTo(HEARTH),10,35),screenPan(rig.camera,HEARTH));
  const heardPan = screenPan(rig.camera, cygnet.position);
  for (const h of cygnet.heard) {
    if (h.kind === 'step') {
      const under: Surface = child.riding && cygnet.position.distanceToSquared(boat.position) < 9 ? 'wood' : heightAt(cygnet.position.x, cygnet.position.z) < 0.9 ? 'sand' : 'grass';
      foley.step(under, h.amount, heardPan);
    } else if (h.kind === 'flap') foley.flap(h.amount, heardPan);
    else if (h.kind === 'scramble') foley.scramble(heardPan);
    else if (h.kind === 'flutter') foley.flutter(6, h.amount, heardPan);
    else if (h.kind === 'shake') foley.shake(heardPan, cygnet.mind.wet);
    else if (h.kind === 'tumble') foley.tumble(h.amount, heardPan);
    else if (h.kind === 'plunge') foley.plunge(heardPan);
    else if (h.kind === 'paddle') foley.paddle(h.amount, heardPan);
    else foley.rustle(h.amount, heardPan);
  }
  cygnet.heard.length = 0;
  /** The grown swans are heard before they are seen: the throb of their wings, and now and then one of them calling. */
  if (flock.flying) {
    const far = THREE.MathUtils.clamp(flock.head.distanceTo(rig.camera.position) / 320, 0, 1);
    const swanPan = screenPan(rig.camera, flock.head);
    foley.wingbeat(dt, swanPan, far);
  }
  probe?.update(time);
  wind.step(dt, time, finalStep);
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
  shown.hazeFalloff = ease(shown.hazeFalloff, story.current.hazeFalloff ?? 1, 0.6, dt);
  shown.shower = shower;
  shown.storm = squall;
  const flat = story.current.trodden ?? null;
  const tread = atmo.uniforms.uTrodden.value;
  if (flat) tread.set(flat.x, flat.z, flat.y, ease(tread.w, 1, 1.4, dt));
  else tread.w = ease(tread.w, 0, 1.4, dt);
  // The mirror's suspended light clears on the crossing; home has the low sun drawn on the paper.
  const homeLight = story.name === 'home' ? 1 : story.name === 'toHarbour' || story.name === 'toHome'
    ? 1 - THREE.MathUtils.smoothstep(dusk, tuning.homeLight.daylight, tuning.skyMirror.duskTo) : 0;
  applyPalette(story.worldLife, dusk, shower, squall, homeLight);
  applySleepingPalette(sleeping.presence);
  shown.woodShade = ease(shown.woodShade, story.name === 'wood' ? overLand * atmo.uniforms.uNight.value : 0, 1.2, dt);
  stormWeather.update(dt, storm, boat.afloat ? boat.yaw : child.yaw,
    story.name === 'wood' ? THREE.MathUtils.lerp(1, tuning.wood.lightningScale, overLand) : 1, shown.woodShade, story.current.stormStrike);
  /**
   * How far the dream lets you see. Beyond it the world dissolves, so the next island is never a spoiler.
   * A clear night has nothing out there to give away and everything to show, so the veil draws back and the
   * sea keeps the stars on it all the way out.
   */
  // Let the pod finish diving before the mirror develops; fade back to ordinary sea on the final hill.
  water.skyMirrorAppearance = ease(water.skyMirrorAppearance, story.current.mirrorArrival ?? (story.name === 'home' ? 0 : 1), 1.2, dt);
  if (story.name === 'home' && water.skyMirrorAppearance < 0.001) water.skyMirrorAppearance = 0;
  atmo.uniforms.uOpenSea.value = ease(atmo.uniforms.uOpenSea.value, story.current.openSea ?? 0, 0.7, dt);
  atmo.uniforms.uHomeHaze.value = ease(atmo.uniforms.uHomeHaze.value,
    story.name === 'toHarbour' ? 1 : story.name === 'home' ? story.current.openSea ?? 0 : 0, 0.7, dt);
  // Keep the meadow's own hills clear while concealing every shore beyond it, including in the sea's mirror.
  // On departure the next room emerges gradually; direct chapter starts get the complete veil on frame one.
  const islandVeil = story.name === 'meadow' ? 1 : 0;
  shown.islandVeil = ease(shown.islandVeil, islandVeil, 0.7, dt);
  if (Math.abs(shown.islandVeil - islandVeil) < 0.001) shown.islandVeil = islandVeil;
  atmo.uniforms.uIslandVeil.value.set(ISLES.meadow.x, ISLES.meadow.z, ISLES.meadow.rx, ISLES.meadow.rz);
  atmo.uniforms.uIslandVeilAmount.value = shown.islandVeil;
  // The island ahead is seen only as near as its detail is drawn, and not at all from across the water.
  const mistAhead = story.name === 'drowned' || story.name === 'toWood' ? ISLE_MISTS.wood
    : story.name === 'toSleeping' ? ISLE_MISTS.sleeping : null;
  if (mistAhead) isleMist = mistAhead;
  shown.isleMist = mistAhead ? 1 : ease(shown.isleMist, 0, tuning.world.isleMistLift, dt);
  if (shown.isleMist < 0.001) shown.isleMist = 0;
  atmo.uniforms.uIsleMist.value.set(isleMist.isle.x, isleMist.isle.z, isleMist.isle.rx, isleMist.isle.rz);
  atmo.uniforms.uIsleMistRange.value.set(isleMist.range.clear, isleMist.range.hidden, shown.isleMist, isleMist.range.edge);
  const seen = haze * (1 - 0.7 * atmo.uniforms.uStarlight.value);
  atmo.uniforms.uVeil.value.set(
    THREE.MathUtils.lerp(900 - 780 * seen, tuning.storm.stormVeil, squall),
    THREE.MathUtils.lerp((0.002 + 0.03 * seen) * shown.hazeFalloff, tuning.storm.stormVeilDensity, squall) * (1 - atmo.uniforms.uLightning.value.w * 0.8),
  );
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
  /** And so do the birches and the sail, for the same reason. */
  birches.subject.copy(washing.subject);
  boat.subject.copy(washing.subject);

  homePetals();
  petals.update(dt, input.present && input.charge > 0 ? input.updraftAt : null, input.charge);
  const pointerWorld = input.present ? input.world : null;
  lines.update(dt, pointerWorld, input.gust, input.present && input.charge > 0 ? input.updraftAt : null, input.charge);
  swirl.update(dt, rig.camera, input, story.current.coax ?? (story.name === 'birches' ? scarfInvitation.coax : null));
  creatureEnv.walker = child.visible ? child.position : null;
  creatureEnv.breeze = story.breeze;
  creatureEnv.night = atmo.uniforms.uNight.value;
  creatureEnv.audio = sound.output;
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
  soundState.startingIsland = story.name === 'island';
  soundState.openingScore = story.name === 'island' || story.name === 'toLines';
  soundState.forestWind = story.name === 'wood';
  soundState.sleepingWind = story.name === 'sleeping' && story.current.sleepingScore === 'climb';
  soundState.music = story.music;
  soundState.arrivalMusic = story.current.arrivalMusic;
  soundState.arrivalReady = story.current.arrivalReady;
  soundState.homewardReady = story.current.homewardReady;
  soundState.summitScore = story.current.summitScore;
  soundState.homeEndingTime = story.current.homeEndingTime;
  soundState.mirrorScore = story.current.mirrorScore;
  soundState.drownedScore = story.current.drownedScore;
  soundState.seaScore = story.current.seaScore;
  soundState.sleepingScore = story.current.sleepingScore;
  soundState.meadowScore = story.current.meadowScore;
  soundState.birchesScore = story.current.birchesScore;
  soundState.linesScore = story.current.linesScore;
  soundState.linesMelodyQuiet = story.current.linesMelodyQuiet;
  soundState.hush += ((story.current.hush ?? 0) - soundState.hush) * (1 - Math.exp(-dt * 1.6));
  soundState.piano = story.current.pianoMix ?? 0;
  soundState.pianoActive = story.current.pianoActive ?? false;
  soundState.caringWind = story.current.caringWind ?? false;
  soundState.flockChatter = story.current.flockChatter ?? true;
  soundState.scripted = story.current.scripted ?? false;
  soundState.silence = story.current.silence ?? false;
  if (story.current.finished && !credits.classList.contains('rolling')) credits.classList.add('rolling');
  if (story.current.finished && !credits.classList.contains('replay-ready')
    && lastCredit.getBoundingClientRect().bottom < again.getBoundingClientRect().top - 24) {
    credits.classList.add('replay-ready');
  }
  soundState.shower = shower;

  rig.camera.near = story.name === 'lines' && doorway.travelling ? 0.035 : 0.5;
  rig.camera.updateProjectionMatrix();
  rig.update(dt, time, story.shot, story.pace, !!(story.current.scripted || story.current.invitesSail
    || story.current.invitesFlight || story.current.windInvitation || story.current.pianoActive));
  story.current.afterCamera?.(rig.camera);
  rig.camera.updateMatrixWorld();
  if (finalStep) followWindow(...windowAim());
  cottage.update(dt, rig.camera);
  village.update(dt, time, boat.position, storm);
  piano.update(dt, time, rig.camera, wind, sound.output, input, life);
  wood.update(dt, time, rig.camera, storm, story.name === 'wood' ? story.shot.subjects : undefined);
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
}

/** Material sound follows the same physical state the frame is about to draw. */
function prepareWorldAudio(dt: number): void {
  const heard = sound.running;
  worldFoley.update(dt);
  birchesFoley.update(dt);
  const hearBirches = heard && story.name === 'birches';
  birchesFoley.step(child.position, child.footContact, birches.leafCoverAt(child.position.x, child.position.z),
    hearBirches && child.visible && child.moving && !child.riding && !child.sitting && !child.acting);
  birchesFoley.swing(birches.swing.pivot, birches.swing.angle, birches.swing.speed, birches.swing.rider, hearBirches);
  worldFoley.cloth(washing.soundPoints, wind, dt, heard && story.name === 'lines');
  materialAt.copy(FAMILY_LINE.a).lerp(FAMILY_LINE.b, 0.5);
  worldFoley.motion(family, 'cloth', materialAt, family.x + family.y, dt, heard && story.name === 'lines');
  for (const curtain of CURTAINS) {
    worldFoley.motion(curtain, 'cloth', curtain.center, curtain.opening, dt, heard && story.name === 'lines');
  }
  for (const snag of birches.scarf.snags) {
    worldFoley.motion(snag, 'wool', snag.center, snag.work + snag.release, dt, heard && story.name === 'birches');
  }
  worldFoley.motion(birches.scarf, 'wool', boat.position, birches.scarf.woven, dt, heard && story.name === 'birches');
  boat.sailPoint(materialAt);
  worldFoley.flow(boat, 'sail', materialAt, boat.sailFlutter * 0.65, heard && boat.group.visible);
  worldFoley.sailSettles(boat, materialAt, boat.sailDroop, heard && boat.group.visible);
  for (const toy of littleBoats.toys) {
    const active = heard && littleBoats.active && littleBoats.launched && toy.group.visible;
    worldFoley.flow(toy, 'water', toy.group.position, Math.min(0.14, toy.speed * 0.035), active);
    worldFoley.flow(toy, 'sail', toy.group.position, toy.luff * 0.12, active);
  }
  worldFoley.motion(drawing, 'paper', drawing.mesh.position, drawing.open, dt, heard && drawing.mesh.visible && tuning.audio.homeEndingSounds);
  worldFoley.motion(cottage, 'door', cottage.doorstep, cottage.doorOpening, dt, heard && story.name === 'home' && tuning.audio.homeEndingSounds);
  worldFoley.motion(door, 'door', door.group.position, door.doorOpening, dt, heard && story.name === 'lines');
}

function placeEmitter(emitter: NonNullable<SoundState['cygnet']>, at: THREE.Vector3, active: boolean): void {
  emitter.pan = screenPan(rig.camera, at);
  emitter.distance = rig.camera.position.distanceTo(at);
  emitter.active = active;
}

/** Expensive view preparation and audio scheduling run once per rendered frame. */
function prepareFrame(dt: number): void {
  const u = atmo.uniforms;
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
  const cam = rig.camera.position;
  u.uCloudDomain.value.set(cam.x - CLOUD_SPAN / 2, cam.z - CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN);
  clouds.update();
  terrain.update(rig.camera);
  grass.update(rig.camera, dt);
  grass.bake(renderer);
  cursor.update(input.gust, input.charge, input.down);
  audioEnvironment.update(dt, story.focus.x, story.focus.z, story.name);
  soundState.sea = audioEnvironment.sea;
  soundState.meadow = audioEnvironment.meadow;
  soundState.land = audioEnvironment.land;
  soundState.cold = story.name === 'sleeping' ? sleeping.cold * (1 - sleeping.dawn) : 0;
  placeEmitter(soundState.cygnet!, cygnet.position, cygnet.visible);
  placeEmitter(soundState.flock!, flock.head, flock.active);
  soundState.cues = takeCues();
  soundState.winterGust = story.name === 'sleeping' ? sleepingGust(time, sleeping.cold, sleeping.dawn) : 0;
  sound.update(dt, soundState);
  prepareWorldAudio(dt);
}

const beginMirror = (mirrorCamera: THREE.PerspectiveCamera): void => terrain.beginMirror(mirrorCamera);
const endMirror = (): void => terrain.endMirror();
/** The sea's reflection belongs to the same room as the main view. */
function drawView(): void {
  water.update(rig.camera, beginMirror, endMirror);
  post.render(time);
}
function drawRooms(): void {
  doorwayView.render(rig.camera, story.name === 'lines', story.name !== 'toBoats', drawView);
}

function frameInner(now: number): void {
  if (contextRecovery.lost) return;
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
  if (!params.shot && !pacer.due(now, quality.frameRate)) {
    requestAnimationFrame(frame);
    return;
  }
  // Shot mode is driven frame by frame by the tools and never holds a frame back.
  if (!params.shot && holdForReadbacks()) {
    requestAnimationFrame(frame);
    return;
  }
  const cpuStart = performance.now();
  const realDt = (now - last) / 1000;
  telemetry.frame(now - last);
  quality.frame(now, params.shot ? now - last : pacer.intervalMs);
  last = now;
  const timing = frameTiming(params.shot ? 1 / 60 : realDt);
  const dt = timing.dt;

  renderer.info.reset();
  frameIndex++;
  pollReadbacks();
  input.beginFrame();
  for (let step = 0; step < timing.steps; step++) {
    simulate(timing.stepDt, (step + 1) / timing.steps, step === timing.steps - 1);
  }
  prepareFrame(dt);
  // The boat belongs to the arrival room until it moves to the shore beyond the door.
  const boatInWashing = boat.position.distanceToSquared(door.group.position) < boat.position.distanceToSquared(DOOR_EXIT);
  for (const o of boat.objects) {
    (boatInWashing ? doorwaySource : doorwayDestination).add(o);
    (boatInWashing ? doorwayDestination : doorwaySource).delete(o);
  }
  // The home landing belongs to the final approach, including in the water's reflection.
  homeJetty.visible = story.name === 'home' || story.name === 'toHarbour' || story.name === 'toHome';
  // The shore behind the impossible door can recede during its departure, but never reappear later.
  const rooms = journeyReveal.update(visibleRooms(story.name, boat.position.z), dt);
  setJourneyRooms(rooms);
  drawJourneyRooms(rooms, roomObjects, drawRooms);
  planeIndicator.update(dt, rig.camera, glider, startScreen.started && !story.current.scripted);
  endFrame(renderer);
  if (quality.probing) timeLastFrame(now + 1000 / 60, reportGpu);

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
        `${quality.mode}  scale ${pixelRatio} of ${maxPixelRatio} (dpr ${window.devicePixelRatio})  msaa ${post.samples}  ${size.x}x${size.y}`,
        `grass ${(grass.quality.density * 100).toFixed(0)}%  reach ${(grass.quality.reach * 100).toFixed(0)}%  detail ${quality.level.detail}`,
        `readbacks ok ${readbackStats.delivered} skipped ${readbackStats.skipped} held ${readbackStats.held} forced ${readbackStats.forced} worst ${readbackStats.worstMs.toFixed(0)} ms (wait ${readbackStats.waitWorstMs.toFixed(0)})`,
        `draws ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k  blades ${grass.bladesDrawn}  leaves ${terrain.leaves}`,
        `boot ${bootMs.toFixed(0)} ms  ${story.name}`,
      ]);
    }
  }
  if (time > 0.4) startScreen.reveal();
  if (params.shot) {
    window.__stats = {
      frame: frameIndex,
      time,
      simulationSteps: timing.steps,
      simulationStepMs: timing.stepDt * 1000,
      simulatedMs: dt * 1000,
      droppedMs: Math.max(0, realDt - dt) * 1000,
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
      readbacksDelivered: readbackStats.delivered,
      readbacksHeld: readbackStats.held,
      readbacksForced: readbackStats.forced,
      readbackWorstMs: Math.round(readbackStats.worstMs * 10) / 10,
      readbackWaitMs: Math.round(readbackStats.waitMs * 10) / 10,
      readbackWaitWorstMs: Math.round(readbackStats.waitWorstMs * 10) / 10,
      readbackWindWorstMs: Math.round(readbackStats.work.wind * 10) / 10,
      readbackLifeWorstMs: Math.round(readbackStats.work.life * 10) / 10,
      readbackHeightWorstMs: Math.round(readbackStats.work.height * 10) / 10,
      heightParity,
    };
    if (time > 0.75) window.__ready = true;
  }
  requestAnimationFrame(frame);
}

/** An exception here would otherwise stop scheduling and freeze the game silently; treat it like a lost context. */
function frame(now: number): void {
  try {
    frameInner(now);
  } catch (error) {
    console.error('Frame loop failed', error);
    contextRecovery.trigger('runtime', error);
  }
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
  terrain.fields.bake(renderer);
  terrain.colour.bake(renderer);
  if (params.heights !== 'direct') await terrainHeights.bake(renderer, () => gpuIdle(renderer));
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
  if (contextRecovery.lost) return;
  graphicsReady = true;
  quality.setMode(controls.qualityMode, performance.now());
  startScreen.ready(withSound => {
    telemetry.start(story.name, resumedAtLoad, !!story.current.finished);
    telemetry.quality(quality.level.ratio, quality.level.samples, quality.level.detail);
    if (withSound) {
      soundChosen = true;
      setSound(controls.soundOn);
    }
    last = performance.now();
    pacer.reset(last);
    quality.reset(last);
    fpsWindowStart = last;
    requestAnimationFrame(frame);
  });
}
export const bootReady = boot();
