import { MathUtils } from 'three';
import { ROOMS, type Room } from '../journey-rooms';
import { glsl, tuning } from '../../tuning';

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

/**
 * As `journeyRoom` partitions the sea, except that a room going gives up the sea along its border to a room shown,
 * and the sea passes from one's showing to the other's gradually: an island's shelf can run on over the line between
 * them, and there its shallows must deepen rather than stop.
 */
export const WATER_ROOMS_GLSL = /* glsl */ `
uniform float uWaterRooms[${names.length}];
float waterRoomPresence(vec2 p) {
  float d = distance(p, uRoom.xy);
  if (uRoom.z > 0.0) return d > uRoom.z ? 0.0 : 1.0;
  if (uRoom.z < 0.0 && d < -uRoom.z) return 0.0;
  if (uJourneyRooms.x == -1.0) return 1.0;
  float nearest = 1e20, next = 1e20, here = 1.0, there = 1.0;
  ${names.map((room, i) => {
    const c = ROOMS[room];
    return `{
    float shown = uWaterRooms[${i}];
    float e = (length((p - vec2(${glsl(c.x)}, ${glsl(c.z)})) / vec2(${glsl(c.rx)}, ${glsl(c.rz)})) - 1.0) * ${glsl(Math.min(c.rx, c.rz))}
      + ${glsl(tuning.water.roomYield)} * (1.0 - shown);
    if (e < nearest) { next = nearest; there = here; nearest = e; here = shown; }
    else if (e < next) { next = e; there = shown; }
  }`;
  }).join('\n  ')}
  return mix(there, here, 0.5 + 0.5 * smoothstep(0.0, ${glsl(tuning.water.roomBlend)}, next - nearest));
}
`;
