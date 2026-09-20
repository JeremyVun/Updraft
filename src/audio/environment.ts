import { tuning } from '../tuning';

function smooth(from: number, to: number, value: number): number {
  const k = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
}

/** A coarse local shoreline query is enough for an ambient mix; it never reads the GPU. */
export function shoreDistance(x: number, z: number, height: (x: number, z: number) => number): number {
  if (height(x, z) <= 0) return 0;
  for (const radius of [8, 16, 28, 44, 64, 96, 144, 200, 260]) {
    for (let ray = 0; ray < 16; ray++) {
      const angle = ray * Math.PI / 8;
      if (height(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) <= 0) return radius;
    }
  }
  return tuning.audio.shoreFar;
}

/** Cache the terrain query between render frames, while deriving habitat from the current room. */
export class AudioEnvironment {
  private remaining = 0;
  private x = Infinity;
  private z = Infinity;
  private distance = 0;
  land = 0;
  sea = 1;
  meadow = 0;

  constructor(private readonly height: (x: number, z: number) => number) {}

  update(dt: number, x: number, z: number, chapter: string): void {
    this.remaining -= dt;
    if (this.remaining <= 0 || Math.hypot(x - this.x, z - this.z) > 8) {
      this.distance = shoreDistance(x, z, this.height);
      this.x = x; this.z = z;
      this.remaining = tuning.audio.shoreRefresh;
    }
    this.land = smooth(-1.5, 2.5, this.height(x, z));
    const inland = smooth(tuning.audio.shoreNear, tuning.audio.shoreFar, this.distance);
    this.sea = 1 - this.land * inland;
    this.meadow = chapter === 'meadow' ? this.land * smooth(8, 60, this.distance) : 0;
  }
}
