import { SkyMirrorChapter } from './sky-mirror';
import { MIRROR_LANDING, MIRROR_BERTH, MIRROR_LIGHT_PATH, MIRROR_SAIL_OUT } from '../world/sky-mirror-layout';
import { LittleBoatsChapter } from './little-boats';
import { BOATS_LANDING } from '../world/little-boats-layout';
import * as THREE from 'three';
import { tuning } from '../tuning';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import { params } from '../params';
import { QA } from '../qa';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { CrossingChapter, FIRST_ISLAND, LANDING, MEADOW_APPROACH } from './crossing';
import { HOME_MOORING, HomeChapter } from './home';
import { BOAT_BERTH, IslandChapter } from './island';
import { LINES_LANDING, LinesChapter } from './lines';
import { FAR_SHORE, MeadowChapter } from './meadow';
import { BirchesChapter } from './birches';
import { DrownedChapter } from './drowned';
import { SleepingChapter } from './sleeping';
import { StairsChapter } from './stairs';
import { DESCENT_END, STAIRS_LANDING } from '../world/stairs-layout';
import { StageChapter } from './stage';
import { WoodChapter } from './wood';
import { WOOD_BERTH, WOOD_LANDING } from '../world/wood';
import { SLEEP_BERTH, SLEEP_LANDING } from '../world/sleeping';
import { BIRCHES_LANDING } from '../world/birches';
import { placeProgress, restoreLife, saveProgress, type Progress } from './progress';
import { restoreWingCare } from './wing-care';
import { WHALE_MOVE, WHALE_NEARER } from '../world/geography';

export type ChapterName =
  | 'island'
  | 'toLines'
  | 'lines'
  | 'toBoats'
  | 'boats'
  | 'toMeadow'
  | 'meadow'
  | 'toBirches'
  | 'birches'
  | 'toStairs'
  | 'stairs'
  | 'drowned'
  | 'toWood'
  | 'wood'
  | 'toSleeping'
  | 'sleeping'
  | 'toMirror'
  | 'mirror'
  | 'toHarbour'
  | 'toHome'
  | 'home'
  | 'stage';

/**
 * On the open sea, where the boat comes to rest beside the whale's head, where the pod leads it off its line toward
 * it, out in the mist, and the waypoint on ahead that it holds while it waits. The heading it comes in on frames the
 * whale's lie and every hold beside it.
 */
const WHALE_HEADING = new THREE.Vector2(-30, -33).normalize();
export const WHALE_REST = new THREE.Vector2(-480 + WHALE_MOVE.x + WHALE_NEARER.x, -2020 + WHALE_MOVE.z + WHALE_NEARER.z);
export const WHALE_LEAD = WHALE_REST.clone().addScaledVector(WHALE_HEADING, -tuning.seaPassage.leadFor);
const WHALE_HOLD = WHALE_REST.clone().addScaledVector(WHALE_HEADING, 3);
/** Halfway in, so the boat is on the heading it rests on long before it comes to rest. */
const WHALE_LINE = WHALE_LEAD.clone().lerp(WHALE_REST, 0.5);

/** Where the boat goes on each crossing, including the long open passage after the sleeping island. */
export const ROUTES: Record<string, THREE.Vector2[]> = {
  toLines: [
    new THREE.Vector2(34, 44),
    new THREE.Vector2(70, 56),
    new THREE.Vector2(104, 22),
    new THREE.Vector2(60, -95),
    LINES_LANDING,
  ],
  // Leave the door shore to the west, then round Little Boats into its arrival pool.
  toBoats: [new THREE.Vector2(220, -410), new THREE.Vector2(190, -397), new THREE.Vector2(190, -350),
    new THREE.Vector2(BOATS_LANDING.x + 26, BOATS_LANDING.z - 4), new THREE.Vector2(BOATS_LANDING.x, BOATS_LANDING.z)],
  // Cross the open water north of the meadow, then approach its bank head-on.
  toMeadow: [new THREE.Vector2(125, -510), new THREE.Vector2(60, -535), MEADOW_APPROACH, LANDING],
  /** A short blind hop off the meadow's far shore: the gold island is on them before they can see it coming. */
  toBirches: [new THREE.Vector2(FAR_SHORE.x + 4, FAR_SHORE.z - 22), new THREE.Vector2(4, -1024), BIRCHES_LANDING],
  /** A short blind hop east off the birches' far beach, under the cloud coming down, onto the knoll the stairs stand on. */
  toStairs: [new THREE.Vector2(14, -1214), new THREE.Vector2(44, -1224), new THREE.Vector2(STAIRS_LANDING.x - 8, STAIRS_LANDING.y), STAIRS_LANDING],
  /** Legacy saves only: new journeys keep sailing in DrownedChapter until the boat reaches the wood. */
  toWood: [new THREE.Vector2(-18, -1648), new THREE.Vector2(WOOD_LANDING.x, WOOD_LANDING.y)],
  /** A short hop west, round the wood's north shore: the frosted island is on them in a few minutes. */
  toSleeping: [
    new THREE.Vector2(-45, -1940),
    new THREE.Vector2(-80, -1974),
    new THREE.Vector2(-105, -1962), new THREE.Vector2(-118, -1935),
    SLEEP_LANDING,
  ],
  /**
   * The offshore passage keeps the dolphins and the brave swim; the pod leads the boat off its line to rest beside
   * the whale, and once it has gone the boat sails straight on over where it lay and curves in to the entry jetty.
   */
  toMirror: [
    new THREE.Vector2(-300, -1950), new THREE.Vector2(-375, -1970),
    WHALE_LEAD, WHALE_LINE, WHALE_HOLD,
    new THREE.Vector2(MIRROR_LANDING.x - 30.45, MIRROR_LANDING.z + 94.05), new THREE.Vector2(MIRROR_LANDING.x - 40.8, MIRROR_LANDING.z + 74.85),
    new THREE.Vector2(MIRROR_LANDING.x - 40.95, MIRROR_LANDING.z + 52.95), new THREE.Vector2(MIRROR_LANDING.x - 30.75, MIRROR_LANDING.z + 33.75),
    new THREE.Vector2(MIRROR_LANDING.x, MIRROR_LANDING.z),
  ],
  toHarbour: [
    // Stay offshore before curving in; running along the beach cuts the hill across the fog's near edge.
    new THREE.Vector2(MIRROR_SAIL_OUT.x, MIRROR_SAIL_OUT.z),
    new THREE.Vector2(MIRROR_BERTH.x + 115, MIRROR_BERTH.z - 20), new THREE.Vector2(MIRROR_BERTH.x + 145, MIRROR_BERTH.z - 47),
    new THREE.Vector2(MIRROR_BERTH.x + 163, MIRROR_BERTH.z - 69),
    new THREE.Vector2(HOME_MOORING.x, HOME_MOORING.z),
  ],
  /** Previous uninterrupted passage: retained for existing toHome entry/swim saves. */
  toHome: [
    new THREE.Vector2(-340, -1970),
    new THREE.Vector2(-445, -2050),
    new THREE.Vector2(-450, -2150),
    new THREE.Vector2(-350, -2190),
    new THREE.Vector2(-265, -2090),
    new THREE.Vector2(-242, -2012),
    new THREE.Vector2(-180, -1994),
    new THREE.Vector2(-158, -1980),
    new THREE.Vector2(-140, -1966),
    new THREE.Vector2(-120, -1948),
    new THREE.Vector2(-80, -1932),
    new THREE.Vector2(HOME_MOORING.x, HOME_MOORING.z),
  ],
};

const ORDER: ChapterName[] = ['island', 'toLines', 'lines', 'toBoats', 'boats', 'toMeadow', 'meadow', 'toBirches', 'birches', 'toStairs', 'stairs', 'drowned', 'wood', 'toSleeping', 'sleeping', 'toMirror', 'mirror', 'toHarbour', 'home'];

/**
 * Runs the chapters in order and speaks for whichever is current. Until `start` it holds the first island as boot
 * left it; `start` restores the save, or begins later in the story (`?chapter=`, or a chapter picked on the title
 * screen) with everything before it treated as done.
 */
export class Journey {
  name: ChapterName = 'island';
  private chapter: Chapter;
  private savedPoint = '';
  /** Constructors may leave presentation empty until update; keep the last prepared view meanwhile. */
  private transitionView: Chapter | null = null;

  constructor(private readonly cast: Cast) {
    this.chapter = new IslandChapter(cast);
  }

  /** Applies the save or a named start: once per page, before the first update. */
  start(choice: Progress | string | null): void {
    const { cast } = this;
    if (choice !== null && typeof choice === 'object') {
      const saved = choice;
      if (saved.chapter !== 'island' || saved.point !== 'entry') {
        placeProgress(saved, cast);
        if (saved.chapter === 'home') cast.boat.mooring = HOME_MOORING;
        // Mid-island starts must not initiate the arrival's carry animation.
        if (saved.point !== 'entry' && saved.seat) cast.cygnet.rideIn('satchel');
        this.begin(saved.chapter);
        if (saved.point !== 'entry') {
          placeProgress(saved, cast);
          this.chapter.restoreCheckpoint?.(saved.point, saved.data);
        }
      }
      restoreLife(saved, cast);
      if (cast.cygnet.seat === 'satchel') cast.child.openBag(true);
      this.savedPoint = saved.point;
      return;
    }
    if (choice === 'crossing' || choice === 'lines') {
      this.sail(BOAT_BERTH.x + 8, BOAT_BERTH.z + 8, 0.95);
      this.begin('toLines');
    } else if (choice === 'washing') {
      this.land(LINES_LANDING.x, LINES_LANDING.y + 2, LINES_LANDING.x, LINES_LANDING.y - 4);
      this.begin('lines');
    } else if (choice === 'door' || choice === 'shore') {
      this.land(LINES_LANDING.x, LINES_LANDING.y + 2, LINES_LANDING.x, LINES_LANDING.y - 4);
      this.begin('lines');
      const lines = this.chapter as LinesChapter;
      if (choice === 'door') lines.skipToDoor();
      else lines.restoreCheckpoint('family', [0, 1]);
    } else if (choice === 'boats') {
      this.land(BOATS_LANDING.x, BOATS_LANDING.z, BOATS_LANDING.x - 1, BOATS_LANDING.z - 4);
      this.cast.cygnet.rideIn('satchel');
      this.begin('boats');
    } else if (choice === 'meadow' || choice === 'hills') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x, mainlandCoastZ(LANDING.x) - 3);
      this.begin('meadow');
    } else if (choice === 'piano') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x, mainlandCoastZ(LANDING.x) - 3);
      this.begin('meadow');
      (this.chapter as MeadowChapter).skipToPiano();
    } else if (choice === 'birches' || choice === 'autumn') {
      this.land(BIRCHES_LANDING.x, BIRCHES_LANDING.y + 2, BIRCHES_LANDING.x, BIRCHES_LANDING.y - 4);
      this.cast.cygnet.rideIn('satchel');
      this.begin('birches');
    } else if (choice === 'stairs' || choice === 'clouds') {
      this.land(STAIRS_LANDING.x + 2, STAIRS_LANDING.y, STAIRS_LANDING.x + 4, STAIRS_LANDING.y - 1);
      this.cast.boat.yaw = Math.PI * 0.5;
      this.cast.cygnet.rideIn('satchel');
      this.begin('stairs');
    } else if (choice === 'drowned' || choice === 'village') {
      /** The drift into the village begins where the stairs let the boat down through the cloud onto the water. */
      this.sail(DESCENT_END.x, DESCENT_END.y, -1.9);
      this.begin('drowned');
    } else if (choice === 'wood' || choice === 'dark') {
      this.land(WOOD_BERTH.x, WOOD_BERTH.z, WOOD_LANDING.x, WOOD_LANDING.y + 4);
      this.begin('wood');
    } else if (choice === 'fears') {
      this.land(WOOD_BERTH.x, WOOD_BERTH.z, WOOD_LANDING.x, WOOD_LANDING.y + 4);
      this.begin('wood');
      (this.chapter as WoodChapter).skipToShape();
    } else if (choice === 'sleeping') {
      this.land(SLEEP_LANDING.x, SLEEP_LANDING.y, SLEEP_LANDING.x - 5, SLEEP_LANDING.y);
      this.begin('sleeping');
    } else if (choice === 'sea' || choice === 'dolphins') {
      this.sail(SLEEP_BERTH.x - 5, SLEEP_BERTH.z - 2, -1.76);
      this.begin('toMirror');
    } else if (choice === 'whale') {
      /** QA: at rest beside the whale on the open sea, as the save there resumes, the swim behind them. */
      this.sail(WHALE_REST.x - WHALE_HEADING.x * 0.5, WHALE_REST.y - WHALE_HEADING.y * 0.5, Math.atan2(WHALE_HEADING.x, WHALE_HEADING.y));
      this.cast.cygnet.rideIn('satchel');
      this.begin('toMirror');
      this.chapter.restoreCheckpoint?.('whale-rest', [ROUTES.toMirror.indexOf(WHALE_HOLD), 90]);
    } else if (choice === 'mirror') {
      this.land(MIRROR_LANDING.x, MIRROR_LANDING.z, MIRROR_LANDING.x + 2, MIRROR_LANDING.z - 3);
      this.begin('mirror');
    } else if (choice === 'stage') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x + 4, mainlandCoastZ(LANDING.x) - 14);
      this.begin('stage');
    } else if (choice === 'jetty') {
      this.moor();
      this.begin('home');
    } else if (choice === 'summit' || choice === 'home') {
      this.moor();
      this.begin('home');
      (this.chapter as HomeChapter).skipToSummit();
    } else if (choice?.startsWith('to') && ROUTES[choice]) {
      const [a, b] = ROUTES[choice];
      this.sail(a.x, a.y, Math.atan2(b.x - a.x, b.y - a.y));
      this.cast.cygnet.rideIn('satchel');
      this.begin(choice as ChapterName);
    }
  }

  /** Puts the child aboard an afloat boat, ready to be blown along. */
  private sail(x: number, z: number, yaw: number): void {
    const { cast } = this;
    cast.life.regions.island.w = 1;
    cast.boat.beach(x, z, yaw);
    cast.child.ride(cast.boat.seat(new THREE.Vector3()), cast.boat.yaw);
    cast.boat.launch();
    this.withCygnet();
  }

  /** Puts the boat alongside the jetty at home with the child aboard, as if the last crossing had just ended. */
  private moor(): void {
    const { cast } = this;
    cast.life.regions.island.w = 1;
    cast.boat.beach(HOME_MOORING.x, HOME_MOORING.z, HOME_MOORING.yaw);
    cast.boat.afloat = true;
    cast.boat.grounded = true;
    cast.boat.mooring = HOME_MOORING;
    cast.child.ride(cast.boat.seat(new THREE.Vector3()), cast.boat.yaw);
    this.withCygnet();
  }

  /** Puts the boat ashore with the child beside it, as if a crossing had just ended. */
  private land(bx: number, bz: number, cx: number, cz: number): void {
    const { cast } = this;
    cast.life.regions.island.w = 1;
    cast.boat.beach(bx, bz, Math.PI);
    cast.boat.grounded = true;
    cast.child.place(cx, cz, Math.PI);
    this.withCygnet();
  }

  /** Everywhere past the first island the child is carrying the cygnet; starts off a backpack crossing move it there. */
  private withCygnet(): void {
    const { cast } = this;
    cast.cygnet.visible = true;
    cast.cygnet.bond = 0.5;
    cast.cygnet.rideIn('cradle');
  }

  get shot(): Shot {
    return (this.transitionView ?? this.chapter).shot;
  }
  get breeze(): number {
    return this.chapter.breeze;
  }
  get worldLife(): number {
    return this.chapter.worldLife;
  }
  get dusk(): number {
    return this.chapter.dusk;
  }
  get pace(): number {
    return (this.transitionView ?? this.chapter).pace;
  }
  get focus(): THREE.Vector3 {
    return (this.transitionView ?? this.chapter).focus;
  }
  get shower(): number {
    return this.chapter.shower ?? 0;
  }
  get haze(): number {
    return this.chapter.haze ?? 0;
  }
  /** The crossing supplies its sailing bed; arrivalMusic requests the destination after a musical rest. */
  get music(): Mood {
    return this.chapter.music ?? 'sea';
  }
  get season(): number {
    return this.chapter.season ?? 0.3;
  }
  get rainbow(): number {
    return this.chapter.rainbow ?? 0;
  }
  get rainbowAxis(): THREE.Vector3 | undefined {
    return this.chapter.rainbowAxis;
  }
  get escort(): THREE.Vector3 | null {
    return this.chapter.escort ?? null;
  }
  get current(): Chapter {
    return this.chapter;
  }

  update(dt: number, time: number): void {
    this.chapter.update(dt, time);
    this.transitionView = null;
    if (this.chapter.done) {
      // Old saves in the separate forest crossing still arrive in the wood.
      const next = this.name === 'toWood' ? 'wood' : this.name === 'toHome' ? 'home' : ORDER[ORDER.indexOf(this.name) + 1];
      if (next) this.begin(next);
    }
    // The zero-time camera setup behind Begin is not a played checkpoint.
    if (dt <= 0 || !params.progress || this.name === 'stage') return;
    const point = this.chapter.checkpoint;
    if (point && point !== this.savedPoint && !this.cast.carry.busy && !this.cast.child.acting) {
      saveProgress(this.name, point, this.chapter.saveCheckpoint?.() ?? [], this.cast);
      this.savedPoint = point;
    } else if (!this.savedPoint) {
      // Entering a crossing is the preceding island's exit checkpoint.
      saveProgress(this.name, 'entry', [], this.cast);
      this.savedPoint = 'entry';
    }
  }

  private begin(name: ChapterName): void {
    this.transitionView = this.transitionView ?? this.chapter;
    this.name = name;
    /** The cygnet first rides in the bag leaving the washing lines; from then on its flap is left open. */
    if (ORDER.indexOf(name) > ORDER.indexOf('lines')) this.cast.child.openBag(true);
    this.chapter = this.make(name);
    this.savedPoint = '';
  }

  private make(name: ChapterName): Chapter {
    const { cast } = this;
    restoreWingCare(cast.cygnet, name);
    if (ORDER.indexOf(name) > ORDER.indexOf('birches') || name === 'toWood' || name === 'toHome') cast.boat.scarfSail = 1;
    switch (name) {
      case 'toLines':
        return new CrossingChapter(cast, {
          route: ROUTES.toLines,
          music: 'still',
          arrivalMusic: 'lines',
          season: 0.14,
          lookBack: FIRST_ISLAND,
          farewell: 21,
          whaleAt: 37,
          haze: 0.35,
          arrivalHaze: { strength: tuning.world.linesCrossingHaze,
            from: tuning.world.linesHazeFrom, to: tuning.world.linesHazeTo },
        });
      case 'lines':
        return new LinesChapter(cast);
      case 'toBoats':
        return new CrossingChapter(cast, {route: ROUTES.toBoats, haze: 1.05, season: 0.22, music: 'lines', linesScore: 'shore', arrivalMusic: 'boats',
          arrivalView: tuning.crossingCamera.arrivals.boats});
      case 'boats':
        return new LittleBoatsChapter(cast);
      case 'toMeadow':
        /** Nothing of the meadow is given away from the water: a grey shape in the haze until the bank is climbed. */
        return new CrossingChapter(cast, { route: ROUTES.toMeadow, haze: tuning.world.meadowCrossingHaze, season: 0.26, arrivalSpeed: tuning.sail.meadowArrivalSpeed, music: 'boats', hush: .28, arrivalMusic: 'meadow',
          arrivalView: tuning.crossingCamera.arrivals.meadow });
      case 'meadow':
        return new MeadowChapter(cast);
      case 'toBirches':
        return new CrossingChapter(cast, { route: ROUTES.toBirches, haze: 0.85, dusk: 0.55, season: 0.38, music: 'meadow', meadowScore: 'return', arrivalMusic: 'birches' });
      case 'birches':
        return new BirchesChapter(cast);
      case 'toStairs':
        return new CrossingChapter(cast, { route: ROUTES.toStairs, haze: 0.9, dusk: 0.62, season: 0.47, music: 'birches', birchesScore: 'return', hush: 0.3,
          arrivalView: tuning.crossingCamera.arrivals.stairs });
      case 'stairs':
        return new StairsChapter(cast);
      case 'drowned':
        return new DrownedChapter(cast);
      case 'toWood':
        return new CrossingChapter(cast, { route: ROUTES.toWood, haze: 0.94, dusk: 1.75, storm: 1, music: 'wood', season: 0.7, arrivalMusic: 'wood' });
      case 'wood':
        return new WoodChapter(cast);
      case 'toSleeping':
        /** Still the wood's night and the last of its weather, and over before the storm is properly gone. */
        return new CrossingChapter(cast, { route: ROUTES.toSleeping, haze: 0.92, dusk: 1.85, season: 0.85, music: 'wood', hush: .55, arrivalMusic: 'sleeping' });
      case 'sleeping':
        return new SleepingChapter(cast);
      case 'toMirror':
        return new CrossingChapter(cast, {
          route: ROUTES.toMirror, haze: tuning.seaPassage.haze,
          departureMusic: 'sea',
          arrivalMusic: 'mirror',
          dusk: 1.02, duskTo: tuning.skyMirror.duskFrom, dolphins: true,
          swimAt: tuning.seaPassage.swimAt, season: 0.45,
          moor: MIRROR_LANDING,
          netWhale: { lead: WHALE_LEAD, rest: WHALE_REST, hold: WHALE_HOLD, dusk: tuning.seaPassage.restDusk },
        });
      case 'mirror': return new SkyMirrorChapter(cast, this.chapter.done ? this.chapter.shot : undefined);
      case 'toHarbour':
        if (cast.skyMirror.progress < cast.skyMirror.stars.length) cast.skyMirror.restore(cast.skyMirror.stars.length);
        return new CrossingChapter(cast, {
          // Saves from the first mirror version departed from its northern arrival shelf.
          departureChannel: cast.boat.position.x < MIRROR_BERTH.x - 30 ? undefined
            : { ...MIRROR_LIGHT_PATH, lead: tuning.skyMirror.channelLead },
          route: cast.boat.position.x < MIRROR_BERTH.x - 30
            ? [new THREE.Vector2(MIRROR_BERTH.x - 143, MIRROR_BERTH.z + 108), new THREE.Vector2(MIRROR_BERTH.x - 13, MIRROR_BERTH.z + 117), new THREE.Vector2(MIRROR_BERTH.x + 36, MIRROR_BERTH.z + 63), new THREE.Vector2(MIRROR_LIGHT_PATH.to.x, MIRROR_LIGHT_PATH.to.z), ...ROUTES.toHarbour] : ROUTES.toHarbour,
          haze: tuning.homeApproach.haze, dusk: tuning.skyMirror.duskTo, duskTo: tuning.homeLight.daylight,
          season: 0.18, moor: HOME_MOORING, music: 'mirror', mirrorScore: 'depart', hush: .5, arrivalMusic: 'home', homeward: true,
        });
      case 'toHome':
        /** It leaves in the sunrise the bird brought off the hill, and goes on into the day from there. */
        return new CrossingChapter(cast, {
          route: ROUTES.toHome,
          arrivalMusic: 'home',
          haze: tuning.seaPassage.haze,
          dusk: 1.02,
          duskTo: tuning.homeLight.daylight,
          whaleAt: 42,
          whaleEvery: 0,
          dolphins: true,
          swimAt: tuning.seaPassage.swimAt,
          season: 0.18,
          moor: HOME_MOORING,
        });
      case 'home':
        return new HomeChapter(cast);
      case 'stage':
        return QA ? new StageChapter(cast) : new IslandChapter(cast);
      default:
        return new IslandChapter(cast);
    }
  }
}
