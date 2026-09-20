import { SkyMirrorChapter } from './sky-mirror';
import { MIRROR_LANDING } from '../world/sky-mirror-layout';
import { LittleBoatsChapter } from './little-boats';
import { BOATS_LANDING, BOATS_BERTH } from '../world/little-boats-layout';
import * as THREE from 'three';
import { tuning } from '../tuning';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import { params } from '../params';
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
import { StageChapter } from './stage';
import { WoodChapter } from './wood';
import { WOOD_BERTH, WOOD_LANDING } from '../world/wood';
import { SLEEP_BERTH, SLEEP_LANDING } from '../world/sleeping';
import { BIRCHES_BERTH, BIRCHES_LANDING } from '../world/birches';
import { readProgress, placeProgress, restoreLife, saveProgress } from './progress';
import { restoreWingCare } from './wing-care';

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

/** Where the boat goes on each crossing, including the long open passage after the sleeping island. */
export const ROUTES: Record<string, THREE.Vector2[]> = {
  toLines: [
    new THREE.Vector2(34, 44),
    new THREE.Vector2(70, 56),
    new THREE.Vector2(104, 22),
    new THREE.Vector2(106, -90),
    new THREE.Vector2(60, -195),
    LINES_LANDING,
  ],
  toBoats: [new THREE.Vector2(265, -512), new THREE.Vector2(330, -502), new THREE.Vector2(BOATS_LANDING.x, BOATS_LANDING.z)],
  toMeadow: [new THREE.Vector2(355, -683), new THREE.Vector2(305, -682), new THREE.Vector2(230, -574), new THREE.Vector2(100, -549), MEADOW_APPROACH, LANDING],
  /** A short blind hop off the meadow's far shore: the gold island is on them before they can see it coming. */
  toBirches: [new THREE.Vector2(FAR_SHORE.x + 4, FAR_SHORE.z - 22), new THREE.Vector2(4, -1024), BIRCHES_LANDING],
  /** Legacy saves only: new journeys keep sailing in DrownedChapter until the boat reaches the wood. */
  toWood: [new THREE.Vector2(-18, -1648), new THREE.Vector2(WOOD_LANDING.x, WOOD_LANDING.y)],
  /** A short hop west, round the wood's north shore: the frosted island is on them in a few minutes. */
  toSleeping: [
    new THREE.Vector2(-38, -1922),
    new THREE.Vector2(-80, -1928),
    new THREE.Vector2(-115, -1924),
    SLEEP_LANDING,
  ],
  /** The offshore passage keeps the dolphins and brave swim, then moors beside the entry jetty. */
  toMirror: [
    new THREE.Vector2(-330, -1990), new THREE.Vector2(-445, -2095),
    new THREE.Vector2(-533, -2215),
    new THREE.Vector2(-542, -2253), new THREE.Vector2(MIRROR_LANDING.x, MIRROR_LANDING.z),
  ],
  toHarbour: [
    new THREE.Vector2(-347, -2315), new THREE.Vector2(-310, -2135),
    new THREE.Vector2(-242, -2012),
    new THREE.Vector2(-180, -1994), new THREE.Vector2(-158, -1980),
    new THREE.Vector2(-140, -1966), new THREE.Vector2(-120, -1948),
    new THREE.Vector2(-80, -1932), new THREE.Vector2(HOME_MOORING.x, HOME_MOORING.z),
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

const ORDER: ChapterName[] = ['island', 'toLines', 'lines', 'toBoats', 'boats', 'toMeadow', 'meadow', 'toBirches', 'birches', 'drowned', 'wood', 'toSleeping', 'sleeping', 'toMirror', 'mirror', 'toHarbour', 'home'];

/**
 * Runs the chapters in order and speaks for whichever is current. `?chapter=` starts later in the story for
 * testing, with everything before it treated as done.
 */
export class Journey {
  name: ChapterName = 'island';
  private chapter: Chapter;
  private savedPoint = '';

  constructor(private readonly cast: Cast) {
    this.chapter = new IslandChapter(cast);
    const saved = params.progress ? readProgress() : null;
    if (saved) {
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
      this.savedPoint = saved.point;
      return;
    }
    const start = params.chapter;
    if (start === 'crossing' || start === 'lines') {
      this.sail(BOAT_BERTH.x + 8, BOAT_BERTH.z + 8, 0.95);
      this.begin('toLines');
    } else if (start === 'washing') {
      this.land(LINES_LANDING.x, LINES_LANDING.y + 2, LINES_LANDING.x, LINES_LANDING.y - 4);
      this.begin('lines');
    } else if (start === 'boats') {
      this.land(BOATS_LANDING.x, BOATS_LANDING.z, BOATS_LANDING.x - 1, BOATS_LANDING.z - 4);
      this.begin('boats');
    } else if (start === 'meadow' || start === 'hills') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x, mainlandCoastZ(LANDING.x) - 3);
      this.begin('meadow');
    } else if (start === 'piano') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x, mainlandCoastZ(LANDING.x) - 3);
      this.begin('meadow');
      (this.chapter as MeadowChapter).skipToPiano();
    } else if (start === 'birches' || start === 'autumn') {
      this.land(BIRCHES_LANDING.x, BIRCHES_LANDING.y + 2, BIRCHES_LANDING.x, BIRCHES_LANDING.y - 4);
      this.begin('birches');
    } else if (start === 'drowned' || start === 'village') {
      /** The drift into the village begins where the birches end: off their north beach, not the meadow's. */
      this.sail(BIRCHES_BERTH.x, BIRCHES_BERTH.z - 6, Math.PI);
      this.begin('drowned');
    } else if (start === 'wood' || start === 'dark') {
      this.land(WOOD_BERTH.x, WOOD_BERTH.z, WOOD_LANDING.x, WOOD_LANDING.y + 4);
      this.begin('wood');
    } else if (start === 'sleeping') {
      this.land(SLEEP_LANDING.x, SLEEP_LANDING.y, SLEEP_LANDING.x - 5, SLEEP_LANDING.y);
      this.begin('sleeping');
    } else if (start === 'sea' || start === 'dolphins') {
      this.sail(SLEEP_BERTH.x - 5, SLEEP_BERTH.z - 2, -1.76);
      this.begin('toMirror');
    } else if (start === 'mirror') {
      this.land(MIRROR_LANDING.x, MIRROR_LANDING.z, MIRROR_LANDING.x + 2, MIRROR_LANDING.z - 3);
      this.begin('mirror');
    } else if (start === 'stage') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x + 4, mainlandCoastZ(LANDING.x) - 14);
      this.begin('stage');
    } else if (start === 'jetty') {
      this.moor();
      this.begin('home');
    } else if (start === 'summit' || start === 'home') {
      this.moor();
      this.begin('home');
      (this.chapter as HomeChapter).skipToSummit();
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

  /** Everywhere past the first island the child is carrying the cygnet, so every test start has to start that way. */
  private withCygnet(): void {
    const { cast } = this;
    cast.cygnet.visible = true;
    cast.cygnet.bond = 0.5;
    cast.cygnet.rideIn('cradle');
  }

  get shot(): Shot {
    return this.chapter.shot;
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
    return this.chapter.pace;
  }
  get focus(): THREE.Vector3 {
    return this.chapter.focus;
  }
  get shower(): number {
    return this.chapter.shower ?? 0;
  }
  get haze(): number {
    return this.chapter.haze ?? 0;
  }
  /** Crossings take the music of wherever they are going, so the sea is never silent between two rooms. */
  get music(): Mood {
    return this.chapter.music ?? 'sea';
  }
  get season(): number {
    return this.chapter.season ?? 0.3;
  }
  get rainbow(): number {
    return this.chapter.rainbow ?? 0;
  }
  get escort(): THREE.Vector3 | null {
    return this.chapter.escort ?? null;
  }
  get current(): Chapter {
    return this.chapter;
  }

  update(dt: number, time: number): void {
    this.chapter.update(dt, time);
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
    this.name = name;
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
          season: 0.14,
          lookBack: FIRST_ISLAND,
          farewell: 30,
          rainbow: true,
          whaleAt: 52,
          haze: 0.35,
        });
      case 'lines':
        return new LinesChapter(cast);
      case 'toBoats':
        return new CrossingChapter(cast, {route: ROUTES.toBoats, haze: 1.05, season: 0.22, music: 'lines'});
      case 'boats':
        return new LittleBoatsChapter(cast);
      case 'toMeadow':
        /** Nothing of the meadow is given away from the water: a grey shape in the haze until the bank is climbed. */
        return new CrossingChapter(cast, { route: cast.boat.position.x < BOATS_BERTH.x - 70 ? [new THREE.Vector2(224, -521), new THREE.Vector2(100, -549), MEADOW_APPROACH, LANDING] : ROUTES.toMeadow, haze: 0.9, season: 0.26, arrivalSpeed: tuning.sail.meadowArrivalSpeed });
      case 'meadow':
        return new MeadowChapter(cast);
      case 'toBirches':
        return new CrossingChapter(cast, { route: ROUTES.toBirches, haze: 0.85, dusk: 0.55, season: 0.38, music: 'birches' });
      case 'birches':
        return new BirchesChapter(cast);
      case 'drowned':
        return new DrownedChapter(cast);
      case 'toWood':
        return new CrossingChapter(cast, { route: ROUTES.toWood, haze: 0.94, dusk: 1.75, storm: 1, music: 'wood', season: 0.7 });
      case 'wood':
        return new WoodChapter(cast);
      case 'toSleeping':
        /** Still the wood's night and the last of its weather, and over before the storm is properly gone. */
        return new CrossingChapter(cast, { route: ROUTES.toSleeping, haze: 0.92, dusk: 1.85, season: 0.85, music: 'wood' });
      case 'sleeping':
        return new SleepingChapter(cast);
      case 'toMirror':
        return new CrossingChapter(cast, {
          route: ROUTES.toMirror, haze: tuning.seaPassage.haze,
          dusk: 1.02, duskTo: tuning.skyMirror.duskFrom,
          whaleAt: 42, whaleEvery: 0, dolphins: true,
          swimAt: tuning.seaPassage.swimAt, season: 0.92,
          moor: MIRROR_LANDING, arrivalSpeed: 3,
        });
      case 'mirror': return new SkyMirrorChapter(cast);
      case 'toHarbour':
        if (cast.skyMirror.progress < 3) cast.skyMirror.restore(3);
        return new CrossingChapter(cast, {
          // Saves from the first mirror version departed from its northern arrival shelf.
          route: cast.boat.position.x < -420 && cast.boat.position.z > -2280
            ? [new THREE.Vector2(-455, -2205), ...ROUTES.toHarbour.slice(1)] : ROUTES.toHarbour,
          haze: 0.92, dusk: tuning.skyMirror.duskTo,
          season: 0.98, moor: HOME_MOORING, music: 'home',
        });
      case 'toHome':
        /** It leaves in the sunrise the bird brought off the hill, and goes on into the day from there. */
        return new CrossingChapter(cast, {
          route: ROUTES.toHome,
          haze: tuning.seaPassage.haze,
          dusk: 1.02,
          duskTo: 0.25,
          whaleAt: 42,
          whaleEvery: 0,
          dolphins: true,
          swimAt: tuning.seaPassage.swimAt,
          season: 0.92,
          moor: HOME_MOORING,
        });
      case 'home':
        return new HomeChapter(cast, tuning.skyMirror.duskTo);
      case 'stage':
        return new StageChapter(cast);
      default:
        return new IslandChapter(cast);
    }
  }
}
