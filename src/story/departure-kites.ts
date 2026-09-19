import type * as THREE from 'three';
import type { WindField } from '../wind/field';
import { Kite } from '../world/kite';
import { tuning } from '../tuning';
import { BOATS_BERTH } from '../world/little-boats-layout';
import { BIRCHES_BERTH } from '../world/birches';
import { WOOD_BERTH } from '../world/wood';
import { SLEEP_BERTH } from '../world/sleeping';
import { MIRROR_BERTH, MIRROR_DECK } from '../world/sky-mirror-layout';
import { BOAT_BERTH } from './island';
import { LINES_BERTH } from './lines';
import { FAR_SHORE } from './meadow';
import type { Journey, ChapterName } from './journey';

/** One familiar paper diamond at each departure, never at the arrival beach. */
export class DepartureKites {
  readonly markers: Record<string, Kite>;
  private chapter?: ChapterName;
  private crossing?: string;
  private readonly crossings: Partial<Record<ChapterName, string>> = {
    toLines: 'island', toBoats: 'lines', toMeadow: 'boats', toBirches: 'meadow',
    drowned: 'birches', toSleeping: 'wood', toMirror: 'sleeping', toHome: 'sleeping', toHarbour: 'mirror',
  };

  constructor(wind: WindField) {
    this.markers = {
      island: new Kite(wind, BOAT_BERTH, { offset: [-8, -4] }),
      lines: new Kite(wind, LINES_BERTH, { offset: [-12, 7] }),
      boats: new Kite(wind, BOATS_BERTH, { offset: [-8, 5], stringLength: tuning.linesToys.shoreKiteStringLength }),
      meadow: new Kite(wind, FAR_SHORE, { offset: [-9, 0], stringLength: tuning.linesToys.shoreKiteStringLength }),
      birches: new Kite(wind, BIRCHES_BERTH, { offset: [-9, 7], stringLength: tuning.linesToys.shoreKiteStringLength }),
      wood: new Kite(wind, WOOD_BERTH, { offset: [-8, 7], stringLength: tuning.linesToys.shoreKiteStringLength }),
      sleeping: new Kite(wind, SLEEP_BERTH, { offset: [2, 4], stringLength: tuning.linesToys.shoreKiteStringLength }),
      // Tie off on the landing stage and start north of it in the near-still air, within the star-play views.
      mirror: new Kite(wind, MIRROR_BERTH, { offset: [-15, -0.65], ground: MIRROR_DECK.height, azimuth: 2.35 }),
    };
    for (const [name, kite] of Object.entries(this.markers)) kite.group.name = `departure-kite-${name}`;
  }

  update(dt: number, time: number, camera: THREE.Camera, story: Journey): void {
    if (this.chapter !== story.name) {
      this.crossing = this.crossings[story.name];
      if (story.name === 'toMeadow') {
        // Older saves sail straight from Lines. Pick their shore once, never switch markers mid-crossing.
        this.crossing = this.markers.lines.tieOff.distanceToSquared(camera.position)
          < this.markers.boats.tieOff.distanceToSquared(camera.position) ? 'lines' : 'boats';
      }
      this.chapter = story.name;
    }
    for (const [name, kite] of Object.entries(this.markers)) {
      const enabled = name === story.name ? story.current.departureKite !== false : name === this.crossing;
      kite.update(dt, time, camera, enabled);
    }
  }
}
