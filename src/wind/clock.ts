import type { Splat } from './field';
import { MAX_FRAME_TIME } from '../gl/frame-time';

export const WIND_STEP = 1 / 60;
const EPSILON = 1e-9;
export interface TimedSplat { splat: Splat; weight: number }

interface Frame { left: number; duration: number; splats: Splat[]; count: number; impulseUsed: boolean }
interface Tick { inputs: TimedSplat[]; samples: TimedSplat[]; impulses: TimedSplat[] }

const RESAMPLED = ['vx', 'vz', 'radius', 'energy', 'swirl', 'lift'] as const;
const ENDS = ['ax', 'az', 'bx', 'bz'] as const;

function sampleRecord(): TimedSplat {
  return { splat: { source: '', trail: false, ax: 0, az: 0, bx: 0, bz: 0, vx: 0, vz: 0, radius: 0, energy: 0, swirl: 0, lift: 0 }, weight: 0 };
}

function copySplat(from: Splat, to: Splat): void {
  to.source = from.source;
  to.trail = from.trail;
  to.ax = from.ax;
  to.az = from.az;
  to.bx = from.bx;
  to.bz = from.bz;
  to.vx = from.vx;
  to.vz = from.vz;
  to.radius = from.radius;
  to.energy = from.energy;
  to.swirl = from.swirl;
  to.lift = from.lift;
}

/**
 * Retain every render frame's input until its interval has been consumed by the 60 Hz solver.
 * Splats are copied on arrival, so producers may reuse their objects. The inputs handed to `run` belong to the
 * clock: they stay valid until the next `advance`, and nothing is allocated once its pools have grown.
 */
export class WindClock {
  private pending = 0;
  private readonly frames: Frame[] = [];
  private readonly spareFrames: Frame[] = [];
  private readonly ticks: Tick[] = [];
  /** Where a repeated source's next sample is built before it is blended into the first. */
  private readonly scratch = sampleRecord();

  advance(dt: number, time: number, splats: readonly Splat[], run: (time: number, inputs: TimedSplat[]) => void): number {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    // Match the game's 100 ms stall cap. Never build a catch-up backlog after a suspended tab.
    dt = Math.min(dt, MAX_FRAME_TIME);
    this.frames.push(this.retain(dt, splats));
    this.pending += dt;
    let steps = 0;
    while (this.pending + EPSILON >= WIND_STEP) {
      const tick = this.ticks[steps] ??= { inputs: [], samples: [], impulses: [] };
      let sampleCount = 0;
      let impulseCount = 0;
      let left = WIND_STEP;
      while (left > EPSILON && this.frames.length) {
        const frame = this.frames[0];
        const span = Math.min(left, frame.left);
        for (let i = 0; i < frame.count; i++) {
          const splat = frame.splats[i];
          const weight = splat.impulse ? (frame.impulseUsed ? 0 : 1) : span / WIND_STEP;
          if (weight <= 0) continue;
          if (splat.impulse) {
            const impulse = tick.impulses[impulseCount++] ??= { splat, weight };
            impulse.splat = splat;
            impulse.weight = weight;
            continue;
          }
          const start = 1 - frame.left / frame.duration;
          const end = start + span / frame.duration;
          let previous: TimedSplat | null = null;
          for (let s = 0; s < sampleCount; s++) {
            if (tick.samples[s].splat.source === splat.source) {
              previous = tick.samples[s];
              break;
            }
          }
          const sample = previous ? this.scratch : tick.samples[sampleCount++] ??= sampleRecord();
          const into = sample.splat;
          copySplat(splat, into);
          if (splat.trail) {
            into.ax = splat.ax + (splat.bx - splat.ax) * start;
            into.az = splat.az + (splat.bz - splat.az) * start;
            into.bx = splat.ax + (splat.bx - splat.ax) * end;
            into.bz = splat.az + (splat.bz - splat.az) * end;
          }
          if (!previous) {
            sample.weight = weight;
            continue;
          }
          const k = weight / (previous.weight + weight);
          for (const key of RESAMPLED) previous.splat[key] += (into[key] - previous.splat[key]) * k;
          if (splat.trail) {
            previous.splat.bx = into.bx;
            previous.splat.bz = into.bz;
          } else {
            for (const key of ENDS) previous.splat[key] += (into[key] - previous.splat[key]) * k;
          }
          previous.weight += weight;
        }
        frame.impulseUsed = true;
        frame.left -= span;
        left -= span;
        if (frame.left < EPSILON) this.spareFrames.push(this.frames.shift()!);
      }
      this.pending = Math.max(0, this.pending - WIND_STEP);
      const inputs = tick.inputs;
      inputs.length = 0;
      for (let s = 0; s < sampleCount; s++) inputs.push(tick.samples[s]);
      for (let s = 0; s < impulseCount; s++) inputs.push(tick.impulses[s]);
      for (const input of inputs) if (Math.abs(input.weight - 1) < EPSILON) input.weight = 1;
      run(time - this.pending, inputs);
      steps++;
    }
    return steps;
  }

  private retain(dt: number, splats: readonly Splat[]): Frame {
    const frame = this.spareFrames.pop() ?? { left: 0, duration: 0, splats: [], count: 0, impulseUsed: false };
    frame.left = frame.duration = dt;
    frame.impulseUsed = false;
    frame.count = splats.length;
    for (let i = 0; i < splats.length; i++) {
      const into = frame.splats[i] ??= { ...sampleRecord().splat, impulse: false };
      copySplat(splats[i], into);
      into.impulse = splats[i].impulse;
    }
    return frame;
  }
}
