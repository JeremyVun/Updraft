import { tuning } from '../tuning';

export class MeadowSeeds {
  completed = 0;
  active = false;
  progress = 0;
  velocity = 0;
  effort = 0;
  age = 0;
  quiet = 0;

  reset(completed = 0): void {
    this.completed = Math.max(0, Math.min(2, completed));
    this.active = false;
    this.progress = this.velocity = this.effort = this.age = this.quiet = 0;
  }

  release(): void {
    if (this.completed >= 2) return;
    this.active = true;
    this.progress = this.velocity = this.effort = this.age = this.quiet = 0;
  }

  blow(amount: number): void {
    if (!this.active || !Number.isFinite(amount)) return;
    const t = tuning.meadowEchoes;
    const push = Math.max(-t.maxImpulse, Math.min(t.maxImpulse, amount));
    this.velocity += push * t.travel * t.damping;
    this.effort += Math.max(0, push);
    if (Math.abs(push) > 0.00001) this.quiet = 0;
  }

  update(dt: number): boolean {
    if (!this.active) return false;
    this.age += dt;
    this.quiet += dt;
    const t = tuning.meadowEchoes;
    const decay = Math.exp(-t.damping * dt);
    this.progress += this.velocity * (1 - decay) / t.damping;
    this.velocity *= decay;
    if (this.quiet > t.recoverAfter) this.progress -= t.recovery * dt;
    this.progress = Math.max(0, Math.min(1, this.progress));
    if (this.progress < 0.001 && this.velocity < 0) this.velocity = 0;
    if (this.progress < t.receipt || this.effort < t.effort || this.age < t.minimumTravel || this.quiet > t.recentWind) return false;
    this.completed++;
    this.progress = 1;
    this.active = false;
    return true;
  }
}
