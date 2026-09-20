import type { Splat } from './field';
import { MAX_FRAME_TIME } from '../gl/frame-time';

export const WIND_STEP = 1 / 60;
const EPSILON = 1e-9;
export interface TimedSplat { splat: Splat; weight: number }

/** Retain every render frame's input until its interval has been consumed by the 60 Hz solver. */
export class WindClock {
  private pending = 0;
  private frames: { left: number; duration: number; splats: Splat[]; impulseUsed: boolean }[] = [];

  advance(dt: number, time: number, splats: Splat[], run: (time: number, inputs: TimedSplat[]) => void): number {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    // Match the game's 100 ms stall cap. Never build a catch-up backlog after a suspended tab.
    dt = Math.min(dt, MAX_FRAME_TIME);
    this.frames.push({ left: dt, duration: dt, splats, impulseUsed: false });
    this.pending += dt;
    let steps = 0;
    while (this.pending + EPSILON >= WIND_STEP) {
      const samples = new Map<Splat['source'], TimedSplat>();
      const impulses: TimedSplat[] = [];
      let left = WIND_STEP;
      while (left > EPSILON && this.frames.length) {
        const frame = this.frames[0];
        const span = Math.min(left, frame.left);
        for (const splat of frame.splats) {
          const weight = splat.impulse ? (frame.impulseUsed ? 0 : 1) : span / WIND_STEP;
          if (weight <= 0) continue;
          if (splat.impulse) { impulses.push({ splat, weight }); continue; }
          const start = 1 - frame.left / frame.duration;
          const end = start + span / frame.duration;
          const sample = { ...splat };
          if (splat.trail) {
            sample.ax = splat.ax + (splat.bx - splat.ax) * start;
            sample.az = splat.az + (splat.bz - splat.az) * start;
            sample.bx = splat.ax + (splat.bx - splat.ax) * end;
            sample.bz = splat.az + (splat.bz - splat.az) * end;
          }
          const previous = samples.get(splat.source);
          if (!previous) samples.set(splat.source, { splat: sample, weight });
          else {
            const k = weight / (previous.weight + weight);
            for (const key of ['vx', 'vz', 'radius', 'energy', 'swirl', 'lift'] as const)
              previous.splat[key] += (sample[key] - previous.splat[key]) * k;
            if (splat.trail) {
              previous.splat.bx = sample.bx;
              previous.splat.bz = sample.bz;
            } else {
              for (const key of ['ax', 'az', 'bx', 'bz'] as const)
                previous.splat[key] += (sample[key] - previous.splat[key]) * k;
            }
            previous.weight += weight;
          }
        }
        frame.impulseUsed = true;
        frame.left -= span;
        left -= span;
        if (frame.left < EPSILON) this.frames.shift();
      }
      this.pending = Math.max(0, this.pending - WIND_STEP);
      const inputs = [...samples.values(), ...impulses];
      for (const input of inputs) if (Math.abs(input.weight - 1) < EPSILON) input.weight = 1;
      run(time - this.pending, inputs);
      steps++;
    }
    return steps;
  }
}
