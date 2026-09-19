import * as THREE from 'three';
import { Soundscape, type SoundState } from './audio/audio';
import { CameraRig } from './camera';
import { Creatures } from './creatures/creatures';
import { islandHabitat, mainlandHabitat } from './creatures/habitat';
import { Petals } from './fx/petals';
import { Swirl } from './fx/swirl';
import { WindLines } from './fx/windlines';
import { Glider } from './glider/glider';
import { ROUTE } from './story/meadow';
import { takeCues } from './story/cues';
import { Journey } from './story/journey';
import { Embers } from './fx/embers';
import { Fireflies } from './fx/fireflies';
import { Murmuration } from './fx/murmuration';
import { Rain } from './fx/rain';
import { SeaLife } from './fx/sealife';
import { Boat } from './traveller/boat';
import { Drawing } from './traveller/drawing';
import { Traveller } from './traveller/traveller';
import { Cursor } from './input/cursor';
import { PointerInput } from './input/pointer';
import { params } from './params';
import { gpuIdle, precompile, precompileSim, warmRender } from './gl/boot';
import { Quality } from './gl/quality';
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
import { applyPalette } from './world/palette';
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
import { WashingLines, baskets, lineField, redDoor, seaLines } from './world/lines';
import { piano } from './world/piano';
import { Kite } from './world/kite';
import { Pinwheels } from './world/pinwheels';
import { LINES_WALK, LINES_LANDING, LINES_BERTH } from './story/lines';
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
import { Water } from './world/water';
import { REFLECTION_LAYER } from './world/water/reflection';
import { surfUniforms } from './world/water/surf';
import { swellUniforms } from './world/water/swell';
import { WINDOW, followWindow, onWindowMove, windowCentre } from './world/window';
import { tuning } from './tuning';

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
const wind = new WindField(renderer, params.lite ? { res: 128, iterations: 12, maxSubsteps: 1 } : {});
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
    piano.clearing,
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
const life = new LifeField(renderer);
const clouds = new CloudShadows(renderer);
scene.add(createSky());
const terrain = new Terrain(wind.breeze, bakes.filterable);
scene.add(terrain.mesh);
scene.add(water.mesh);
const pond = new Pond();
pond.objects.forEach((o) => scene.add(o));
scene.add(createRocks());
scene.add(createDistantIslands());
scene.add(tree.group);
const grass = new Grass();
scene.add(grass.group);
/** Left on the sand where the boat comes in, so the first thing the island says is that somebody was here. */
scene.add(baskets(LINES_LANDING.x + 5, LINES_LANDING.y - 3));

/** A door standing on the crest with nothing behind it: the dream leaving another piece of home lying about. */
const door = redDoor(23, -357, 0.32);
scene.add(door);

/** And an upright piano standing in the meadow grass, off the walk, which the wind plays. */
scene.add(piano.group);

/** Hung around the walk over the island, so the open ground through it is always the way on. */
const washing = new WashingLines([
  ...lineField(new THREE.Vector2(ISLES.lines.x, ISLES.lines.z + 8), 190, 46, 17, LINES_WALK),
  ...seaLines(),
]);
scene.add(washing.group);
/** The child who is not there: one kite standing over the far beach, and pinwheels along the walk. */
const kite = new Kite(wind, LINES_BERTH);
scene.add(kite.group);
const pinwheels = new Pinwheels(wind, LINES_WALK);
scene.add(pinwheels.group);
const village = new DrownedVillage(wind);
village.objects.forEach((o) => scene.add(o));
const wood = new DarkWood(wind);
wood.objects.forEach((o) => scene.add(o));
const sleeping = new SleepingIsland(renderer, wind, input);
sleeping.objects.forEach((o) => scene.add(o));
const birches = new AutumnBirches(renderer, wind);
birches.objects.forEach((o) => scene.add(o));
const cottage = new Cottage(wind);
cottage.objects.forEach((o) => scene.add(o));
/** And out from the beach below it, the one landing in the journey that was built rather than run up onto. */
scene.add(createJetty());
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
const lines = new WindLines(wind);
scene.add(lines.batch.mesh);
/** The wind the player draws by circling the cursor, and the same loops offered where the story wants them. */
const swirl = new Swirl();
scene.add(swirl.batch.mesh);
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
const embers = new Embers(wind);
scene.add(embers.mesh);

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
const sealife = new SeaLife(wind, rig.camera);
sealife.objects.forEach((o) => scene.add(o));
const cygnet = new Cygnet();
cygnet.objects.forEach((o) => scene.add(o));
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
const story = new Journey({ child, plane: glider, boat, wind, input, life, tree, drawing, cottage, sealife, cygnet, flock, carry, embers, birches, sleeping, nearby: nearbyCreature });
/** One update first, so the opening shot is the chapter's own and not the origin eased into over several seconds. */
story.update(0, 0);
rig.cut(story.shot);
const windDebug = params.debug === 'wind' || params.debug === 'sway' ? createWindDebug(params.debug === 'sway') : null;
if (windDebug) scene.add(windDebug);
const creatures = new Creatures(wind, islandHabitat(tree.canopy), input, rig.camera);
creatures.spawn({ x: 1, z: 5, radius: 20, rabbits: 6, butterflies: 26 });
creatures.spawn({ x: 0, z: 0, radius: 30, songbirds: 11, seed: 3 });
creatures.spawn({ x: -6, z: -14, radius: 55, gulls: 5, seed: 2 });
scene.add(creatures.group);
const homesInHills = [
  ...ROUTE.map((p: THREE.Vector2, i: number) => ({ x: p.x + (i % 2 ? 14 : -14), z: p.y })),
  { x: COTTAGE.x + 6, z: COTTAGE.z + 26 },
];
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

const maxPixelRatio = params.ratio ?? Math.min(window.devicePixelRatio, 2);
/** Phones open at a modest scale and climb if they prove smooth; opening at full scale costs seconds of crawl. */
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const post = new Post(renderer, scene, rig.camera, params.msaa ?? (maxPixelRatio >= 1.75 ? 2 : 4));
const quality = new Quality(maxPixelRatio, post.samples, window.innerWidth, window.innerHeight, coarsePointer ? 1.25 : maxPixelRatio, params.ratio !== null || params.msaa !== null, (level) => {
  pixelRatio = level.ratio;
  post.samples = level.samples;
  resize();
});
let pixelRatio = quality.level.ratio;

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
document.getElementById('again')?.addEventListener('click', () => location.reload());
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
const shown = { dusk: NaN, haze: NaN, shower: NaN, season: NaN, storm: NaN };
function ease(from: number, to: number, rate: number, dt: number): number {
  return Number.isNaN(from) ? to : from + (to - from) * (1 - Math.exp(-dt * rate));
}
let time = 0;
let veilLifted = false;
let last = performance.now();
let frames = 0;
let fpsWindowStart = last;
let fps = 0;
let sinceLightBake = 0;
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
  if (params.hold !== null && frameIndex >= params.hold) {
    post.render(time);
    endFrame(renderer);
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
  input.anchor = story.current.invitesFlight && !cygnet.gone ? cygnet.position : null;
  input.update(dt, rig.camera, wind);
  if (input.present) glider.brush(rig.camera, input.prevNdc, input.ndc, input.gust, input.gustDir, input.charge, dt);
  story.update(dt, time);
  creatures.gulls.follow(story.escort);
  atmo.uniforms.uRainbow.value = story.rainbow;
  boat.update(dt, time);
  child.update(dt);
  glider.update(dt, time);
  flock.update(dt, time);
  carry.update(dt);
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
  /**
   * How far the dream lets you see. Beyond it the world dissolves, so the next island is never a spoiler.
   * A clear night has nothing out there to give away and everything to show, so the veil draws back and the
   * sea keeps the stars on it all the way out.
   */
  const seen = haze * (1 - 0.7 * atmo.uniforms.uStarlight.value);
  atmo.uniforms.uVeil.value.set(900 - 780 * seen, 0.002 + 0.03 * seen);
  sinceLightBake++;
  if (sinceLightBake >= 3 && bakedSun.angleTo(atmo.uniforms.uSunDir.value) > 0.0004) {
    sinceLightBake = 0;
    bakedSun.copy(atmo.uniforms.uSunDir.value);
    bakes.bakeLight(bakeInputs);
  }
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
  swirl.update(dt, rig.camera, input, story.current.coax ?? null);
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
  soundState.scripted = story.current.scripted ?? false;
  soundState.silence = story.current.silence ?? false;
  if (story.current.finished && !credits.classList.contains('rolling')) credits.classList.add('rolling');
  soundState.shower = shower;
  sound.update(dt, soundState);

  rig.update(dt, time, story.shot, story.pace);
  rig.camera.updateMatrixWorld();
  followWindow(...windowAim());
  const cam = rig.camera.position;
  u.uCloudDomain.value.set(cam.x - CLOUD_SPAN / 2, cam.z - CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN);
  clouds.update();
  terrain.update(rig.camera);
  grass.update(rig.camera);
  grass.bake(renderer);
  cottage.update(dt, rig.camera);
  village.update(dt, time, boat.position, storm);
  piano.update(dt, time, rig.camera, wind, sound.output, input.present && input.gust > tuning.pointer.minGust ? input.gustDir : null);
  wood.update(dt, time, rig.camera, storm);
  sleeping.update(dt, time, rig.camera);
  kite.update(dt, time, rig.camera);
  pinwheels.update(dt, rig.camera, sound.output);
  birches.update(dt, rig.camera, child.visible ? child.position : null);
  /** Fireflies rise out of grass, not out of the sea; they do not fly in a gale, nor over a frosted island. */
  fireflies.update(dt, atmo.uniforms.uNight.value * overLand * Math.max(0, 1 - storm * 1.6) * (1 - sleeping.presence), story.focus);
  embers.update(dt, child.visible ? child.position : story.focus, story.current.embers ?? 0);
  const emberLit = embers.brightest(emberAt);
  atmo.uniforms.uEmberLight.value.set(emberAt.x, emberAt.y, emberAt.z, Math.min(2.6, emberLit * 0.5));
  rain.update(dt, shower, rig.camera, wind.breeze);
  const joining = glider.departing && glider.position.distanceTo(child.position) < 200 ? glider.position : null;
  /** Starlings turn over the hills at sunset, not in a squall. */
  starlings.update(dt, storm > 0.3 ? 0 : (params.dusk ?? story.dusk), joining);
  if (params.whale) whaleForQa();
  sealife.update(dt, time);
  water.update(rig.camera, (mirrorCamera) => terrain.beginMirror(mirrorCamera), () => terrain.endMirror());
  post.render(time);
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
        `readbacks ok ${readbackStats.delivered} skipped ${readbackStats.skipped} forced ${readbackStats.forced} worst ${readbackStats.worstMs.toFixed(0)} ms`,
        `draws ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k  blades ${grass.bladesDrawn}  leaves ${terrain.leaves}`,
        `boot ${bootMs.toFixed(0)} ms  ${story.name}`,
      ]);
    }
  }
  if (time > 0.4 && !veilLifted) {
    veilLifted = true;
    document.getElementById('veil')?.classList.add('lifted');
  }
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
  window.__game = { wind, input, rig, renderer, scene, glider, lines, swirl, sound, child, story, creatures, hillCreatures, water, terrain, cottage, petals, grass, sealife, cygnet, flock, carry, probe, washing, kite, pinwheels, village, wood, sleeping, embers, boat, life, piano, birches, pond };
}

/**
 * Everything the first frame would otherwise pay for happens here, behind the veil: every shader compiles in
 * parallel, the window bakes, one warm frame uploads the world, and the loop starts only once the GPU is idle.
 */
async function boot(): Promise<void> {
  const started = performance.now();
  await precompile(renderer, scene, rig.camera, post.sceneTarget);
  await precompileSim(renderer, bakes.ground);
  followWindow(...windowAim(), true);
  if (params.shot) heightParity = measureHeightParity(renderer);
  warmRender(renderer, scene, rig.camera, post.sceneTarget);
  post.render(0);
  await gpuIdle(renderer);
  bootMs = performance.now() - started;
  last = performance.now();
  requestAnimationFrame(frame);
}
boot();
