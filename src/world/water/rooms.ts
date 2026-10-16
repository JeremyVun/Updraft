import { MathUtils } from 'three';
import { ROOMS, type Room } from '../journey-rooms';
import { tuning } from '../../tuning';

const names = Object.keys(ROOMS) as Room[];

/** A land-room handoff can leave its offshore water in view. */
export class WaterRooms {
  readonly uniform = { value: new Float32Array(names.length).fill(1) };
  private readonly absentFor = new Float64Array(names.length);
  private initialized = false;

  update(rooms: readonly Room[], dt: number): void {
    const duration = tuning.water.departureFade;
    names.forEach((room, i) => {
      if (rooms.includes(room)) this.absentFor[i] = 0;
      else this.absentFor[i] = this.initialized ? Math.min(duration, this.absentFor[i] + Math.max(0, dt)) : duration;
      this.uniform.value[i] = MathUtils.clamp(1 - MathUtils.smootherstep(this.absentFor[i], 0, duration), 0, 1);
    });
    this.initialized = true;
  }
}

export const WATER_ROOMS_GLSL = /* glsl */ `
uniform float uWaterRooms[${names.length}];
float waterRoomPresence(vec2 p) {
  float d = distance(p, uRoom.xy);
  if (uRoom.z > 0.0) return d > uRoom.z ? 0.0 : 1.0;
  if (uRoom.z < 0.0 && d < -uRoom.z) return 0.0;
  return uJourneyRooms.x == -1.0 ? 1.0 : uWaterRooms[int(journeyRoom(p))];
}
`;
