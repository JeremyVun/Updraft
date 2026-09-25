import type { CheckpointPayload } from './checkpoint-data';
import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { DOOR_EXIT, DOOR_SHIFT, doorway } from '../world/doorway';
import { FAMILY_FACE, FAMILY_LINE, door, family } from '../world/lines';
import { CURTAINS, LINES_BERTH, LINES_LANDING, LINES_WALK, washingPassage } from '../world/lines-passage';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';
import type { LinesScorePhase } from '../audio/lines-score';

export { LINES_BERTH, LINES_LANDING, LINES_WALK } from '../world/lines-passage';
const FAMILY_MID = new THREE.Vector3().lerpVectors(FAMILY_LINE.a, FAMILY_LINE.b, 0.5);
const ROUTE = LINES_WALK;
type Beat = 'ashore' | 'wonder' | 'approach' | 'curtain' | 'birdThrough' | 'childThrough' | 'familyApproach' | 'family' | 'throughDoor' | 'shore' | 'walk' | 'toBoat' | 'push' | 'aboard';

/** Small beneath somebody's washing. The wind makes a way, and the little bird learns to go first. */
export class LinesChapter implements Chapter {
  beat: Beat = 'ashore';
  readonly breeze = 1;
  readonly worldLife = 1;
  pace = 0.65;
  readonly haze = 0.9;
  readonly dusk = 0;
  readonly music = 'lines' as const;
  readonly season = 0.2;
  readonly shot: Shot = { target: new THREE.Vector3(), distance: 24, height: 5 };
  readonly focus = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly watching = new THREE.Vector3();
  private readonly from = new THREE.Vector3(0.12, 0, 1).normalize();
  private gate = 0;
  private leg = ROUTE.length - 1;
  private now = 0;
  private beatStart = 0;
  private birdArrived = -1;
  private boarding = false;
  private noticed = false;
  private doorElapsed = 0;
  private readonly thresholdEye = new THREE.Vector3();
  private readonly thresholdLook = new THREE.Vector3();

  constructor(private readonly cast: Cast) {
    const { child, plane, boat, cygnet } = cast;
    doorway.reset();
    CURTAINS.forEach(c => c.reset());
    washingPassage.active = null;
    family.set(0, 0); door.open = 0;
    plane.homeRadius = 20;
    child.dismount(); child.stroll = 1;
    cygnet.mayFly = false;
    cygnet.stay = false;
    cygnet.errand = null;
    // Keep the arrival boat on its beach until the washing hides it from view.
    boat.canGround = false; boat.steerFor = null;
    child.walkTo(LINES_LANDING.x - 2, LINES_LANDING.y - 12, false, () => this.to('wonder'), 0.9);
  }

  get scripted(): boolean {
    return this.beat === 'ashore' || this.beat === 'wonder' || this.beat === 'family' ||
      this.beat === 'throughDoor' || this.beat === 'shore' || this.beat === 'toBoat' || this.beat === 'push' || this.beat === 'aboard';
  }
  get done(): boolean { return this.beat === 'aboard'; }
  get linesScore(): LinesScorePhase | undefined {
    if (['shore', 'walk', 'toBoat', 'push', 'aboard'].includes(this.beat)) return 'shore';
    if (this.beat === 'throughDoor' || (this.beat === 'family' && door.opened)) return 'door';
    if (this.beat === 'familyApproach' || this.beat === 'family') return 'family';
    return this.gate === 0 ? 'first' : this.gate === 1 ? 'second' : 'third';
  }
  /** The bird's lead and look back keep the foreground, without muting playable wind. */
  get linesMelodyQuiet(): boolean { return this.beat === 'birdThrough' || this.beat === 'childThrough'; }
  get checkpoint(): string | null {
    if (this.beat === 'approach' && this.gate > 0) return `curtain-${this.gate}`;
    return this.beat === 'walk' ? 'family' : null;
  }
  saveCheckpoint(): CheckpointPayload<'lines'> { return this.beat === 'walk' ? [this.leg, +door.opened] : [this.gate, 0]; }
  restoreCheckpoint(point: string, data: number[]): void {
    const { child: c, cygnet, plane } = this.cast;
    c.stop(); c.lean = 0; c.lookAt = null;
    cygnet.follow(); cygnet.stay = false; cygnet.errand = null; cygnet.watch(null); cygnet.pace = 1;
    plane.hold(c);
    if (point === 'family') {
      doorway.reset(true);
      // Migrate the former north-beach checkpoint into the new shore.
      if (c.position.x < 150) { c.place(DOOR_EXIT.x, DOOR_EXIT.z - 5, Math.PI); cygnet.release(c.position.clone().add(new THREE.Vector3(1, 0, -1))); cygnet.seating.snap(); }
      this.cast.boat.beach(LINES_BERTH.x, LINES_BERTH.z, 0.1);
      this.cast.boat.canGround = false;
      // Existing two-number family saves remain valid after the route and encounter change.
      this.gate = CURTAINS.length;
      CURTAINS.forEach(g => g.reset(true));
      this.leg = ROUTE.length - 1;
      this.to('walk');
      door.open = data[1] ? 1 : 0;
    } else {
      this.gate = THREE.MathUtils.clamp(Math.floor(data[0]), 1, CURTAINS.length - 1);
      CURTAINS.forEach((g, i) => g.reset(i < this.gate));
      this.approach();
    }
  }

  private to(beat: Beat): void {
    // The boat must already wait beyond the door when it opens, but never vanish at landing.
    if (beat === 'family') this.cast.boat.beach(LINES_BERTH.x, LINES_BERTH.z, 0.1);
    this.beat = beat; this.beatStart = this.now;
  }
  private get t(): number { return this.now - this.beatStart; }

  update(dt: number, time: number): void {
    this.now = time;
    const { child: c, plane: p, cygnet, wind } = this.cast;
    const active = this.gate < CURTAINS.length ? CURTAINS[this.gate] : null;
    washingPassage.active = this.beat === 'curtain' ? active : null;
    CURTAINS.forEach(g => g.update(dt, wind, g === washingPassage.active));
    if (active) {
      p.home.copy(active.before); p.homeRadius = 12;
    }
    switch (this.beat) {
      case 'wonder':
        c.lookAt = CURTAINS[0].center;
        if (this.t > 3.5 && !c.busy) this.setDown();
        break;
      case 'curtain': {
        const g = active!;
        c.lookAt = this.t < 2 ? cygnet.position : g.center;
        if (cygnet.position.distanceTo(g.birdBefore) < 1) {
          cygnet.stay = true;
          if (!this.noticed) {
            this.noticed = true;
            cygnet.does(this.gate === 0 ? 'peer' : 'look-back', c.position, 2.5);
          }
        }
        if (g.charge >= 1 && this.t > tuning.linesPassage.birdLead && this.noticed) {
          g.cleared = true;
          cygnet.bind(0.035);
          cygnet.stay = false; cygnet.errand = g.after;
          cygnet.watch(g.after); cygnet.pace = 0.8;
          cygnet.does('nibble', g.after, 1.6);
          this.birdArrived = -1;
          this.to('birdThrough');
          cue('delight');
        }
        break;
      }
      case 'birdThrough': {
        c.lookAt = cygnet.position;
        const g = active!;
        if (cygnet.position.distanceTo(g.after) < 1.2) {
          cygnet.stay = true;
          cygnet.watch(this.watching.copy(c.position).setY(c.position.y + 1.5));
          if (this.birdArrived < 0) {
            this.birdArrived = time;
            cygnet.does('look-back', c.position, 2.5);
          }
          if (time - this.birdArrived > tuning.linesPassage.lookBack) {
            this.to('childThrough');
            c.walkTo(g.center.x - 1.1, g.after.z - 0.8, false, () => this.passed(), 0.6);
          }
        }
        break;
      }
      case 'childThrough':
        c.lookAt = cygnet.position;
        c.lean = 0.3 * Math.exp(-Math.pow((c.position.z - active!.center.z) / 2.3, 2));
        break;
      case 'family':
        this.reveal(dt);
        break;
      case 'throughDoor': {
        const duration = tuning.linesPassage.doorApproach + tuning.linesPassage.doorCross;
        const through = c.position.z < -399 && cygnet.position.z < -399;
        if (this.doorElapsed < duration * 0.75 || through) this.doorElapsed += dt;
        if (this.doorElapsed >= duration && through) this.crossDoor();
        break;
      }
      case 'shore':
        if (cygnet.errand && cygnet.position.distanceTo(cygnet.errand) < 0.7) cygnet.stay = true;
        if (this.t > tuning.linesPassage.shorePause) {
          doorway.travelling = false;
          cygnet.errand = null; cygnet.stay = false; cygnet.watch(null);
          this.to('walk');
        }
        break;
      case 'walk':
        family.multiplyScalar(Math.exp(-dt * 0.35));
        if (!this.boarding && !c.busy) this.board();
        break;
      case 'push':
        break;
    }
    if (p.held) p.hold(c);
    this.frame();
  }

  private setDown(): void {
    const { child: c, cygnet, carry, plane } = this.cast;
    carry.setDown(() => {
      cygnet.bind(0.08);
      c.lookAt = null;
      plane.hold(c);
      this.approach();
    });
  }

  private approach(): void {
    const { child: c, cygnet } = this.cast;
    const g = CURTAINS[this.gate];
    this.to('approach'); this.noticed = false;
    cygnet.stay = false; cygnet.errand = null; cygnet.pace = 1; cygnet.watch(g.center);
    c.lean = 0; c.lookAt = g.center;
    // A short walk beneath the washing, with the paper safe in hand throughout the encounter.
    c.walkTo(g.before.x, g.before.z, c.position.distanceTo(g.before) > 16, () => {
      c.faceToward(g.center.x, g.center.z, 1);
      cygnet.errand = g.birdBefore;
      cygnet.watch(g.center);
      this.to('curtain');
    }, 0.6);
  }

  private passed(): void {
    const { child: c, cygnet } = this.cast;
    c.lean = 0;
    cygnet.stay = false; cygnet.errand = null; cygnet.pace = 1;
    this.gate++;
    if (this.gate < CURTAINS.length) this.approach();
    else {
      this.to('familyApproach');
      c.lookAt = FAMILY_MID;
      cygnet.watch(FAMILY_MID);
      c.walkTo(9.3, -385.7, false, () => {
        c.faceToward(FAMILY_MID.x, FAMILY_MID.z, 1);
        cygnet.errand = this.tmp.set(12.5, heightAt(12.5, -385.7), -385.7).clone();
        this.to('family');
      }, 0.4);
    }
  }

  private reveal(dt: number): void {
    const { child: c, cygnet, wind } = this.cast;
    const k = tuning.linesPassage;
    c.lookAt = FAMILY_MID;
    // The breeze the player let through the last curtain reaches the three in the clearing.
    const fill = THREE.MathUtils.smoothstep(this.t, 0.5, k.revealFill);
    family.x += (fill - family.x) * (1 - Math.exp(-dt * 2.5));
    family.y += (THREE.MathUtils.smoothstep(this.t, 1.5, k.revealFill + 1) - family.y) * (1 - Math.exp(-dt * 3));
    if (this.t < k.revealFill + 1) wind.addSplat({ source: this, ax: 6, az: -390, bx: 16, bz: -390, vx: 1, vz: -5,
      radius: 4, energy: 0.25, swirl: 0, lift: 0 });
    if (family.y > tuning.family.doorAt && !door.opened) {
      door.open = 1;
      cygnet.bind(0.05);
    }
    if (this.t > k.revealFill + k.revealHold && !c.busy) {
      this.to('throughDoor'); this.doorElapsed = 0; doorway.begin();
      cygnet.stay = false; cygnet.watch(null);
      cygnet.errand = new THREE.Vector3(11.2, heightAt(11.2, -403), -403); cygnet.pace = 0.75;
      c.lookAt = door.group.position;
      c.walkTo(11, -396.8, false, () => c.walkTo(11, -402, false, undefined, 0.15), 0.15);
    }
  }


  private crossDoor(): void {
    const { child: c, cygnet, plane } = this.cast;
    doorway.crossed = true;
    c.stop(); c.place(c.position.x + DOOR_SHIFT.x, c.position.z + DOOR_SHIFT.z, c.yaw);
    cygnet.position.add(DOOR_SHIFT);
    cygnet.position.y = Math.max(heightAt(cygnet.position.x, cygnet.position.z), 0);
    cygnet.seating.snap();
    cygnet.errand = new THREE.Vector3(DOOR_EXIT.x + 1.7, heightAt(DOOR_EXIT.x + 1.7, DOOR_EXIT.z - 7), DOOR_EXIT.z - 7);
    cygnet.stay = false; cygnet.watch(c.position); cygnet.pace = 1;
    plane.hold(c); c.lookAt = this.cast.boat.position;
    this.to('shore');
  }

  private board(): void {
    const { child: c, boat, cygnet } = this.cast;
    washingPassage.active = null;
    cygnet.stay = false; cygnet.errand = null; cygnet.watch(null);
    this.boarding = true; c.lookAt = null;
    const beside = boat.boardingPoint(this.tmp);
    c.walkTo(beside.x, beside.z, false, () => {
      this.to('toBoat');
      this.cast.carry.gatherUp(() => {
        c.lookAt = null; this.to('push');
        c.faceToward(boat.position.x, boat.position.z, 1);
        c.board(boat, () => {
          this.cast.cygnet.mayFly = true;
          this.to('aboard');
        });
      });
    }, 0.5);
  }

  private frame(): void {
    const c = this.cast.child.position;
    const s = this.shot;
    const k = tuning.linesPassage;
    s.from = this.from; s.clearance = 2.1; s.exact = false; s.eye = undefined;
    if (this.beat === 'throughDoor' || this.beat === 'shore') {
      const base = door.group.position;
      const total = k.doorApproach + k.doorCross;
      const progress = THREE.MathUtils.smoothstep(this.doorElapsed, 0, total);
      if (this.beat === 'throughDoor') {
        this.thresholdEye.set(base.x, base.y + 1.85, base.z + 0.04).lerp(doorway.fromEye, 1 - progress);
        this.thresholdLook.set(base.x, base.y + 1.85, base.z - 14).lerp(doorway.fromLook, 1 - THREE.MathUtils.smoothstep(this.doorElapsed, 0, k.doorApproach));
      } else {
        const settle = THREE.MathUtils.smoothstep(this.t, 0, k.shorePause);
        this.thresholdEye.set(DOOR_EXIT.x, DOOR_EXIT.y + 1.85, DOOR_EXIT.z + 0.04);
        this.thresholdEye.lerp(this.tmp.set(DOOR_EXIT.x + 1, DOOR_EXIT.y + 5, DOOR_EXIT.z + 7), settle);
        this.thresholdLook.set(DOOR_EXIT.x, DOOR_EXIT.y + 1.85, DOOR_EXIT.z - 14);
      }
      s.eye = this.thresholdEye; s.target.copy(this.thresholdLook); s.exact = true;
      this.focus.copy(s.target); return;
    }
    if (this.gate < CURTAINS.length && this.beat !== 'ashore' && this.beat !== 'wonder') {
      const g = CURTAINS[this.gate];
      const waiting = this.beat !== 'approach';
      const x = waiting ? g.center.x : c.x * 0.7 + g.center.x * 0.3;
      const z = waiting ? g.center.z + 0.7 : c.z - 3;
      s.target.set(x, heightAt(x, z) + 2.8, z);
      s.distance = waiting ? k.curtainDistance : k.walkDistance;
      s.height = waiting ? k.curtainHeight : k.walkHeight;
      this.pace = waiting ? 1.1 : 0.75;
    } else if (this.beat === 'familyApproach' || this.beat === 'family') {
      s.target.copy(FAMILY_MID).setY(heightAt(11, -390) + 2.8);
      s.from = FAMILY_FACE; s.distance = 17; s.height = 0.3;
      this.pace = 0.7;
    } else if (this.beat === 'ashore' || this.beat === 'wonder') {
      s.target.set(c.x, heightAt(c.x, c.z) + 4, c.z - 9);
      s.distance = 25; s.height = 4;
      this.pace = 0.45;
    } else {
      const b = this.cast.boat.position;
      s.target.set(c.x * 0.65 + b.x * 0.35, Math.max(heightAt(c.x, c.z), 0) + 2.2, c.z * 0.65 + b.z * 0.35);
      s.distance = 24; s.height = 7;
      this.pace = 0.5;
    }
    s.distance *= Math.max(1, 0.53 / (window.innerWidth / window.innerHeight));
    this.focus.copy(s.target);
  }
}
