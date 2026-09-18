import * as THREE from 'three';
import type { Cygnet } from '../creatures/cygnet';
import type { Traveller } from '../traveller/traveller';
import { heightAt } from '../world/island';
import type { Carry } from './carry';

interface Worst {
  value: number;
  at: string;
}

/**
 * QA only. Watches the two of them every frame and keeps the worst of what it sees, so that "seamless" is a number:
 * how hard the cygnet's body ever jerks (a pop shows up as a spike in the change of its velocity), how fast it ever
 * turns, how far a mitten ever is from the body it is holding, and whether it ever sinks into the ground.
 */
export class Probe {
  private readonly p1 = new THREE.Vector3();
  private readonly p2 = new THREE.Vector3();
  private readonly q1 = new THREE.Quaternion();
  private readonly c1 = new THREE.Vector3();
  private readonly c2 = new THREE.Vector3();
  private frames = 0;
  private slipNow = 0;
  /** Every frame since the last reset, for finding out what happened round a bad one. */
  readonly trace: string[] = [];
  private readonly rel = new THREE.Vector3();
  private readonly body = new THREE.Vector3();
  private readonly turnNow = new THREE.Quaternion();
  private readonly acc = new THREE.Vector3();
  private readonly footWas = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly footNow = new THREE.Vector3();
  private readonly stood = [false, false];
  private readonly worst: Record<'jerk' | 'turn' | 'gap' | 'sunk' | 'slip', Worst> = {
    slip: { value: 0, at: '' },
    jerk: { value: 0, at: '' },
    turn: { value: 0, at: '' },
    gap: { value: 0, at: '' },
    sunk: { value: 0, at: '' },
  };

  constructor(
    private readonly child: Traveller,
    private readonly cygnet: Cygnet,
    private readonly carry: Carry,
  ) {}

  reset(): void {
    this.frames = 0;
    this.trace.length = 0;
    for (const w of Object.values(this.worst)) {
      w.value = 0;
      w.at = '';
    }
  }

  update(time: number): void {
    const k = this.cygnet;
    if (!k.visible) {
      this.frames = 0;
      return;
    }
    /** Its body, not its origin: the origin slides under it as its legs fold and hang, and nobody can see an origin. */
    const p = k.grip('back', this.body);
    const q = k.bodyTurn(this.turnNow);
    const where = `${time.toFixed(2)}s ${k.state} ${this.carry.playing}`;
    /** While it rides, what matters is how it moves against the child, not over the ground. */
    const c = this.child.position;
    this.slipNow = 0;
    /** A foot that is down must not move: how far either one slid this frame while it was meant to be planted. */
    for (const side of [0, 1] as const) {
      const planted = k.footAt(side, this.footNow);
      if (planted && this.stood[side] && this.frames >= 2) {
        this.note('slip', this.footNow.distanceTo(this.footWas[side]), where);
        this.slipNow = Math.max(this.slipNow, this.footNow.distanceTo(this.footWas[side]));
      }
      this.stood[side] = planted;
      this.footWas[side].copy(this.footNow);
    }
    if (this.frames >= 2) {
      this.acc.copy(p).addScaledVector(this.p1, -2).add(this.p2);
      if (k.carried) this.acc.sub(this.rel.copy(c).addScaledVector(this.c1, -2).add(this.c2));
      this.note('jerk', this.acc.length(), where);
      this.note('turn', q.angleTo(this.q1), where);
      this.trace.push(`${where} jerk ${this.acc.length().toFixed(4)} turn ${q.angleTo(this.q1).toFixed(4)} slip ${this.slipNow.toFixed(4)} d ${this.acc.x.toFixed(3)},${this.acc.y.toFixed(3)},${this.acc.z.toFixed(3)} ${k.mind.act ?? '-'} ${k.mind.interest}`);
    }
    const gap = this.carry.contactGap;
    if (gap !== null) this.note('gap', gap, where);
    if (!k.carried && k.state !== 'falling' && k.state !== 'gliding' && k.state !== 'leaving' && k.state !== 'swimming' && k.state !== 'perched') {
      const feet = k.seating.shown.p;
      this.note('sunk', Math.max(0, Math.max(heightAt(feet.x, feet.z), 0) - feet.y), where);
    }
    this.p2.copy(this.p1);
    this.p1.copy(p);
    this.c2.copy(this.c1);
    this.c1.copy(c);
    this.q1.copy(q);
    this.frames++;
  }

  private note(key: keyof Probe['worst'], value: number, at: string): void {
    const w = this.worst[key];
    if (value > w.value) {
      w.value = value;
      w.at = at;
    }
  }

  /** Worst values since the last reset: jerk in units per frame², turn in radians per frame, gap and sunk in units. */
  report(): string {
    return JSON.stringify(Object.fromEntries(Object.entries(this.worst).map(([k, w]) => [k, `${w.value.toFixed(4)} @ ${w.at}`])));
  }
}
