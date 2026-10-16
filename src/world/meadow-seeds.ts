import { tuning } from '../tuning';

/** The meadow's two wind plays: how awake each flower of the bed is, then how much down the updraft has taken. */
export class MeadowSeeds {
  completed = 0;
  active = false;
  progress = 0;
  /** Seconds since the bed came nearly all awake and the last sleepers began rising with it; -1 before. */
  finishing = -1;
  readonly wake: Float32Array;
  private readonly weight: Float32Array;
  private readonly total: number;

  /** `seen` marks the flowers the player can see; any hidden under the child's feet never hold the bed back. */
  constructor(flowers: number = tuning.meadowEchoes.flowers, seen?: ArrayLike<boolean>) {
    this.wake = new Float32Array(flowers);
    this.weight = new Float32Array(flowers).map((_, i) => (seen ? (seen[i] ? 1 : 0) : 1));
    this.total = Math.max(1, this.weight.reduce((a, b) => a + b, 0));
  }

  reset(completed = 0): void {
    this.completed = Math.max(0, Math.min(2, completed));
    this.active = false;
    this.finishing = -1;
    this.wake.fill(this.completed > 0 ? 1 : 0);
    this.progress = this.completed === 2 ? 1 : this.completed === 1 ? 0 : 0;
  }

  release(): void {
    if (this.completed >= 2) return;
    this.active = true;
    this.finishing = -1;
  }

  stir(flower: number, amount: number): void {
    if (!this.active || this.completed !== 0 || !Number.isFinite(amount) || amount <= 0) return;
    this.wake[flower] = Math.min(1, this.wake[flower] + Math.min(tuning.meadowEchoes.wakeCap, amount));
  }

  lift(amount: number): void {
    if (!this.active || this.completed !== 1 || !Number.isFinite(amount) || amount <= 0) return;
    this.progress = Math.min(1, this.progress + Math.min(tuning.meadowEchoes.liftCap, amount));
  }

  update(dt: number): boolean {
    if (!this.active) return false;
    if (this.completed === 0) {
      let sum = 0, least = 1;
      for (let i = 0; i < this.wake.length; i++) {
        if (!this.weight[i]) continue;
        sum += this.wake[i];
        least = Math.min(least, this.wake[i]);
      }
      this.progress = sum / this.total;
      if (this.finishing < 0 && this.progress >= tuning.meadowEchoes.bedAwake) this.finishing = 0;
      if (this.finishing < 0) return false;
      this.finishing += dt;
      for (let i = 0; i < this.wake.length; i++) this.wake[i] = Math.min(1, this.wake[i] + dt / tuning.meadowEchoes.bedFinish);
      if (least < 1) return false;
    } else if (this.progress < 1) return false;
    this.completed++;
    this.progress = this.completed === 1 ? 0 : 1;
    this.active = false;
    this.finishing = -1;
    return true;
  }
}
