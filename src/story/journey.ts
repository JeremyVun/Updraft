import * as THREE from 'three';
import type { Shot } from '../camera';
import { params } from '../params';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { CrossingChapter, FIRST_ISLAND, LANDING } from './crossing';
import { HomeChapter } from './home';
import { BOAT_BERTH, IslandChapter } from './island';
import { LINES_LANDING, LinesChapter } from './lines';
import { MeadowChapter } from './meadow';

export type ChapterName = 'island' | 'toLines' | 'lines' | 'toMeadow' | 'meadow' | 'toHome' | 'home';

/** Where the boat goes on each crossing. Each one is shorter and hazier than the last. */
const ROUTES: Record<string, THREE.Vector2[]> = {
  toLines: [
    new THREE.Vector2(34, 44),
    new THREE.Vector2(70, 56),
    new THREE.Vector2(104, 22),
    new THREE.Vector2(106, -90),
    new THREE.Vector2(60, -230),
    LINES_LANDING,
  ],
  toMeadow: [new THREE.Vector2(14, -430), new THREE.Vector2(10, -520), LANDING],
  toHome: [
    new THREE.Vector2(-6, -1240),
    new THREE.Vector2(-16, -1440),
    new THREE.Vector2(-28, -1700),
    new THREE.Vector2(-40, -1900),
    new THREE.Vector2(-45, -1958),
  ],
};

const ORDER: ChapterName[] = ['island', 'toLines', 'lines', 'toMeadow', 'meadow', 'toHome', 'home'];

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
    } else if (start === 'summit' || start === 'home') {
      this.land(-45, -1958, -45, -1968);
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
  }

  /** Puts the boat ashore with the child beside it, as if a crossing had just ended. */
  private land(bx: number, bz: number, cx: number, cz: number): void {
    const { cast } = this;
    cast.life.regions.island.w = 1;
    cast.boat.beach(bx, bz, Math.PI);
    cast.boat.grounded = true;
    cast.child.place(cx, cz, Math.PI);
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
          lookBack: FIRST_ISLAND,
          farewell: 30,
          rainbow: true,
          whaleAt: 52,
          haze: 0.35,
        });
      case 'lines':
        return new LinesChapter(cast);
      case 'toMeadow':
        return new CrossingChapter(cast, { route: ROUTES.toMeadow, haze: 0.75 });
      case 'meadow':
        return new MeadowChapter(cast);
      case 'toHome':
        return new CrossingChapter(cast, { route: ROUTES.toHome, haze: 0.85, dusk: 0.8 });
      case 'home':
        return new HomeChapter(cast);
      default:
        return new IslandChapter(cast);
    }
  }
}
