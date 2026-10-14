import { tuning } from '../tuning';

export class MeadowSeeds {
  completed = 0;
  active = false;
  progress = 0;
  age = 0;
  quiet = 0;
  held = 0;
  readonly blooms = [0, 0, 0];

  reset(completed = 0): void {
    this.completed = Math.max(0, Math.min(2, completed));
    this.active = false;
    this.progress = this.age = this.quiet = this.held = 0;
    this.blooms.fill(this.completed > 0 ? 1 : 0);
  }

  release(): void {
    if (this.completed >= 2) return;
    this.active = true;
    this.age = this.quiet = this.held = 0;
  }

  sweep(sector: number, amount: number): void {
    if (!this.active || this.completed !== 0 || !Number.isFinite(amount) || amount <= 0) return;
    this.blooms[sector] = Math.min(1, this.blooms[sector] + Math.min(0.045, amount) / tuning.meadowEchoes.bloomEffort);
    this.quiet = 0;
  }

  lift(amount: number): void {
    if (!this.active || this.completed !== 1 || !Number.isFinite(amount) || amount <= 0) return;
    this.progress = Math.min(1, this.progress + Math.min(0.025, amount));
    this.quiet = 0;
  }

  update(dt: number): boolean {
    if (!this.active) return false;
    this.age += dt;
    this.quiet += dt;
    if (this.completed === 0) {
      this.progress = this.blooms.reduce((a, b) => a + b, 0) / 3;
      if (this.blooms.some(v => v < 1)) return false;
    } else {
      if (this.quiet > 1.5) this.progress = Math.max(0, this.progress - dt * tuning.meadowEchoes.liftSettle);
      this.held = this.progress > 0.92 && this.quiet < 1.2 ? this.held + dt : Math.max(0, this.held - dt * 0.3);
      if (this.held < tuning.meadowEchoes.liftHold) return false;
    }
    if (this.age < tuning.meadowEchoes.minimumPlay) return false;
    this.completed++;
    this.progress = this.completed === 1 ? 0 : 1;
    this.active = false;
    return true;
  }
}
