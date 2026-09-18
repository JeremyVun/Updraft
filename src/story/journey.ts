import * as THREE from 'three';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import { params } from '../params';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { CrossingChapter, FIRST_ISLAND, LANDING } from './crossing';
import { HOME_BEACH, HomeChapter } from './home';
import { BOAT_BERTH, IslandChapter } from './island';
import { LINES_LANDING, LinesChapter } from './lines';
import { FAR_SHORE, MeadowChapter } from './meadow';
import { BirchesChapter } from './birches';
import { DrownedChapter } from './drowned';
import { StageChapter } from './stage';
import { WoodChapter } from './wood';
import { WOOD_BERTH, WOOD_LANDING } from '../world/wood';
import { BIRCHES_BERTH, BIRCHES_LANDING } from '../world/birches';

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
  | 'toHome'
  | 'home'
  | 'stage';

/** Where the boat goes on each crossing. Each one is shorter and hazier than the last. */
const ROUTES: Record<string, THREE.Vector2[]> = {
  toLines: [
    new THREE.Vector2(34, 44),
    new THREE.Vector2(70, 56),
    new THREE.Vector2(104, 22),
    new THREE.Vector2(106, -90),
    new THREE.Vector2(60, -195),
    LINES_LANDING,
  ],
  toMeadow: [new THREE.Vector2(14, -505), new THREE.Vector2(10, -545), LANDING],
  /** A short blind hop off the meadow's far shore: the gold island is on them before they can see it coming. */
  toBirches: [new THREE.Vector2(FAR_SHORE.x + 4, FAR_SHORE.z - 22), new THREE.Vector2(4, -1024), BIRCHES_LANDING],
  /** Out of the village and straight into the wood, in the dark and the worst of the weather. */
  toWood: [new THREE.Vector2(-18, -1648), new THREE.Vector2(WOOD_LANDING.x, WOOD_LANDING.y)],
  /**
   * The long way round. They come out of the wood before dawn and stand well out into open water, and the night
   * ends somewhere along it. It is the only crossing that goes anywhere but straight, because after the wood the
   * point of it is not to arrive.
   */
  toHome: [
    new THREE.Vector2(-70, -1926),
    new THREE.Vector2(-160, -1946),
    new THREE.Vector2(-250, -1950),
    new THREE.Vector2(-290, -2010),
    new THREE.Vector2(-205, -1975),
    new THREE.Vector2(-130, -1940),
    new THREE.Vector2(HOME_BEACH.x, HOME_BEACH.y),
  ],
};

const ORDER: ChapterName[] = ['island', 'toLines', 'lines', 'toMeadow', 'meadow', 'toBirches', 'birches', 'drowned', 'toWood', 'wood', 'toHome', 'home'];

/**
 * Runs the chapters in order and speaks for whichever is current. `?chapter=` starts later in the story for
 * testing, with everything before it treated as done.
 */
export class Journey {
  name: ChapterName = 'island';
  private chapter: Chapter;

  constructor(private readonly cast: Cast) {
    this.chapter = new IslandChapter(cast);
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
    } else if (start === 'sea' || start === 'dolphins') {
      this.sail(WOOD_BERTH.x, WOOD_BERTH.z + 6, Math.PI);
      this.begin('toHome');
    } else if (start === 'stage') {
      this.land(LANDING.x, mainlandCoastZ(LANDING.x) + 3, LANDING.x + 4, mainlandCoastZ(LANDING.x) - 14);
      this.begin('stage');
    } else if (start === 'summit' || start === 'home') {
      this.land(HOME_BEACH.x, HOME_BEACH.y - 2, HOME_BEACH.x, HOME_BEACH.y - 8);
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
    if (!this.chapter.done) return;
    const next = ORDER[ORDER.indexOf(this.name) + 1];
    if (next) this.begin(next);
  }

  private begin(name: ChapterName): void {
    this.name = name;
    this.chapter = this.make(name);
  }

  private make(name: ChapterName): Chapter {
    const { cast } = this;
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
      case 'toHome':
        return new CrossingChapter(cast, {
          route: ROUTES.toHome,
          haze: 0.5,
          dusk: 1.85,
          duskTo: 0.25,
          whaleAt: 55,
          whaleEvery: 150,
          dolphins: true,
          swimAt: 0.42,
          season: 0.92,
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
