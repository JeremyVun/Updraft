import * as THREE from 'three';
import { tuning } from '../tuning';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import { params } from '../params';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { CrossingChapter, FIRST_ISLAND, LANDING } from './crossing';
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

export type ChapterName =
  | 'island'
  | 'toLines'
  | 'lines'
  | 'toMeadow'
  | 'meadow'
  | 'toBirches'
  | 'birches'
  | 'drowned'
  | 'toWood'
  | 'wood'
  | 'toSleeping'
  | 'sleeping'
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
  toMeadow: [new THREE.Vector2(224, -521), new THREE.Vector2(100, -549), LANDING],
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
  /**
   * The long way round, about 900 units of it. They leave the sleeping island's west shore in the sunrise and
   * stand well out into open water before coming back east through the shallow strait between the island they
   * left and the one they are going to. It is the only crossing that goes anywhere but straight, because by now
   * the point of it is not to arrive.
   */
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

const ORDER: ChapterName[] = ['island', 'toLines', 'lines', 'toMeadow', 'meadow', 'toBirches', 'birches', 'drowned', 'wood', 'toSleeping', 'sleeping', 'toHome', 'home'];

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
      this.begin('toHome');
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
      const next = this.name === 'toWood' ? 'wood' : ORDER[ORDER.indexOf(this.name) + 1];
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
    if (ORDER.indexOf(name) > ORDER.indexOf('birches') || name === 'toWood') cast.boat.scarfSail = 1;
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
      case 'toMeadow':
        /** Nothing of the meadow is given away from the water: a grey shape in the haze until the bank is climbed. */
        return new CrossingChapter(cast, { route: ROUTES.toMeadow, haze: 0.9, season: 0.26 });
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
        return new HomeChapter(cast);
      case 'stage':
        return new StageChapter(cast);
      default:
        return new IslandChapter(cast);
    }
  }
}
