import * as THREE from 'three';
import type { Shot } from '../camera';
import { params } from '../params';
import { mainlandCoastZ } from '../world/heightfield';
import type { Cast, Chapter } from './cast';
import { CrossingChapter, LANDING } from './crossing';
import { HillsChapter } from './hills';
import { BOAT_BERTH, IslandChapter } from './island';

export type ChapterName = 'island' | 'crossing' | 'hills';

/**
 * Runs the chapters in order and speaks for whichever is current. `?chapter=crossing|hills` starts later in the
 * story for testing, with the earlier chapters treated as done.
 */
export class Journey {
  name: ChapterName = 'island';
  private chapter: Chapter;

  constructor(private readonly cast: Cast) {
    this.chapter = new IslandChapter(cast);
    const start = params.chapter;
    if (start === 'crossing' || start === 'hills' || start === 'summit') {
      cast.life.regions.island.w = 1;
      cast.boat.beach(BOAT_BERTH.x, BOAT_BERTH.z - 4, Math.PI);
      cast.child.ride(cast.boat.seat(new THREE.Vector3()), cast.boat.yaw);
      cast.boat.launch();
      this.begin('crossing');
      if (start === 'hills' || start === 'summit') {
        const z = mainlandCoastZ(LANDING.x) + 3;
        cast.boat.beach(LANDING.x, z, Math.PI);
        cast.boat.grounded = true;
        cast.child.place(LANDING.x, z - 3, Math.PI);
        this.begin('hills');
        if (start === 'summit') (this.chapter as HillsChapter).skipToSummit();
      }
    }
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
    if (this.name === 'island') this.begin('crossing');
    else if (this.name === 'crossing') this.begin('hills');
  }

  private begin(name: ChapterName): void {
    this.name = name;
    this.chapter = name === 'crossing' ? new CrossingChapter(this.cast) : new HillsChapter(this.cast);
  }
}
