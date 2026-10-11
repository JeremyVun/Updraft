import { tuning } from '../tuning';

type ColourSample = { x: number; z: number; life: number; age: number };

export class StillGestures {
  private flying = false;
  private samples: ColourSample[] = [];
  private sinceSample = 0;

  update(dt: number, active: boolean, flying: boolean, wind: boolean, x: number, z: number,
    lifeAt: (x: number, z: number) => number): boolean {
    const flight = active && flying && !this.flying;
    this.flying = flying;
    if (!active) { this.samples.length = 0; this.sinceSample = 0; return false; }
    let coloured = false;
    // Read back the ground touched by recent wind, rather than the island's autonomous recovery.
    this.samples = this.samples.filter(sample => {
      sample.age += dt;
      if (lifeAt(sample.x, sample.z) - sample.life >= tuning.audio.stillColourGain) {
        coloured = true;
        return false;
      }
      return sample.age < tuning.audio.stillColourWait;
    });
    this.sinceSample += dt;
    if (wind && this.sinceSample >= tuning.audio.stillColourSample) {
      this.sinceSample = 0;
      const life = lifeAt(x, z);
      if (life < .9) this.samples.push({ x, z, life, age: 0 });
    }
    return flight || coloured;
  }
}
