import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { BELFRY_NORTH, BELFRY_SOUTH, BRING_WAY, DARK_WAY, IVY, NAVE_BERTH, NAVE_NORTH, TOWER } from '../world/drowned-way';
import type { Cast } from './cast';

/**
 * `watch` her at the tower's foot, the cat below the ivy; `climb` the cat going up it into the belfry while she steps
 * back along the ridge to watch; `up` it on the belfry's sill looking down; `fog` the fog rolling over the church and
 * closing round, the sun gone and the night coming; `bring` the player filling the boat's sail to bring it from its
 * tree to the nave; `board` her stepping down into it; `aboard` from then on.
 */
type Step = 'watch' | 'climb' | 'up' | 'fog' | 'bring' | 'board' | 'aboard';

const SOUTH = new THREE.Vector3(0, 0, 1);
const DARK_END = DARK_WAY.reduce((sum, p, i) => (i ? sum + p.distanceTo(DARK_WAY[i - 1]) : 0), 0);
const RIDGE_TOP = new THREE.Vector3(NAVE_NORTH.x0, NAVE_NORTH.height, NAVE_NORTH.z0);
const SLATES_FOOT = new THREE.Vector3(NAVE_NORTH.x1, NAVE_NORTH.height1!, NAVE_NORTH.z1);
const sill = () => TOWER.sill;

/** A view the lens comes round to: where it looks, its bearing from there (atan2(x, z)), how far off and how high. */
interface View {
  target: THREE.Vector3;
  bearing: number;
  distance: number;
  eye: number;
  zoom: number;
}

/**
 * The church, from her reaching the tower's foot to her aboard her boat: the cat climbs the tower's ivy into the
 * belfry, safe and high and out of her reach, and looks down; the fog rolls over the church and closes round her, the
 * sun gone and the night coming, the first wind breaking up the glass and the first rain; the player fills the boat's
 * red sail and brings it from its dead tree across the water to the nave, and she steps down into it. As they go she
 * looks back once at the cat in the belfry.
 */
export class ChurchArrival {
  step: Step | 'off' = 'off';
  /** How far the fog has closed round her, 0 to 1. */
  close = 0;
  /** True once the boat has gone `tuning.drowned.church.valve` seconds without coming nearer: the world's air carries it. */
  carrying = false;
  /** Seconds since she was seated aboard (-1 before). */
  aboardFor = -1;
  /** How far round on the thwart she has turned from the bow to look back, radians. */
  seatTurn = 0;
  private t = 0;
  private leg = 0;
  private best = Infinity;
  private stall = 0;
  private fogFrom = 0;
  private catIn = false;
  private swung = false;
  private down = false;
  private mewed = false;
  private camera: THREE.PerspectiveCamera | null = null;
  private aspect = 16 / 9;
  private readonly head = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly catEye = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly view: View = { target: new THREE.Vector3(), bearing: 0, distance: 15, eye: 3.5, zoom: 1 };
  private readonly want: View = { target: new THREE.Vector3(), bearing: 0, distance: 15, eye: 3.5, zoom: 1 };
  private framed = false;

  constructor(private readonly cast: Cast) {}

  /** She has reached the tower's foot, the cat sitting at the foot of the ivy round the corner below her. */
  begin(): void {
    const { child: c, cat } = this.cast;
    this.step = 'watch';
    this.t = 0;
    this.fogFrom = this.cast.village!.dark.reach;
    c.decks = [...c.decks, NAVE_NORTH];
    c.face(this.head);
    cat.look(this.head);
    cat.unease = 0.6;
  }

  get done(): boolean {
    return this.step === 'aboard';
  }

  /** The sail is the player's while the boat is to be brought. */
  get invitesSail(): boolean {
    return this.step === 'bring' && !this.cast.boat.grounded;
  }

  /** While she looks back at the cat as they go. */
  get lookingBack(): boolean {
    const k = tuning.drowned.church;
    return this.aboardFor >= k.lookBackAt && this.aboardFor < k.lookBackAt + k.lookBackFor;
  }

  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.aspect = camera.aspect;
  }

  private to(step: Step): void {
    this.step = step;
    this.t = 0;
  }

  update(dt: number): void {
    if (this.step === 'off') return;
    const { child: c, cat } = this.cast;
    const k = tuning.drowned.church;
    this.t += dt;
    c.face(this.head);
    cat.eye(this.catEye);
    if (this.aboardFor >= 0) {
      this.aboardFor += dt;
      this.goingAway(dt);
      return;
    }
    switch (this.step) {
      case 'watch':
        if (this.t > k.climbAfter) this.climb();
        break;
      case 'climb':
        break;
      case 'up':
        if (this.t > k.upFor) {
          this.to('fog');
          this.fogFrom = this.cast.village!.dark.reach;
        }
        break;
      case 'fog':
        if (this.t > k.fog.bringAfter) this.bring();
        break;
      case 'bring':
        this.bringing(dt);
        break;
      default:
        break;
    }
    if (this.step === 'fog' || this.step === 'bring' || this.step === 'board') this.fogComes();
    this.gaze(dt);
  }

  /** The cat goes up the ivy to the belfry's sill; she steps back along the ridge to see it go. */
  private climb(): void {
    const { child: c, cat } = this.cast;
    this.to('climb');
    cat.climb([...IVY.slice(1, 6), BELFRY_SOUTH], SOUTH, { then: 'sit', look: this.head }, () => {
      cat.unease = 0.3;
      if (this.step === 'climb') this.to('up');
    });
    c.walkTo(RIDGE_TOP.x, RIDGE_TOP.z, false, () => c.stop(), 0.15);
  }

  /**
   * The fog's front comes on over the church and on past her, closing round as it comes, the sun going with it; the
   * cat backs into the belfry from it and comes out at the far side to look down at her; the first wind swings the
   * boat off its tree, round to face the church.
   */
  private fogComes(): void {
    const { boat, cat } = this.cast;
    const k = tuning.drowned.church.fog;
    const dark = this.cast.village!.dark;
    const since = this.step === 'fog' ? this.t : k.bringAfter + this.t + (this.step === 'board' ? 1e3 : 0);
    dark.reach = THREE.MathUtils.lerp(this.fogFrom, DARK_END + k.past, THREE.MathUtils.smootherstep(since, k.comeAfter, k.comeAfter + k.comeFor));
    this.close = THREE.MathUtils.smootherstep(since, k.closeFrom, k.closeFrom + k.closeFor);
    dark.close = this.close;
    if (!this.catIn && since > k.catIn) {
      this.catIn = true;
      cat.afraid(0.5);
      cat.run([BELFRY_SOUTH.clone().setZ(TOWER.z), BELFRY_NORTH], sill, { pace: 'trot', then: 'sit', look: this.head });
    }
    if (!this.swung && since > k.swingAt) {
      this.swung = true;
      const to = BRING_WAY[0];
      const yaw = Math.atan2(to.x - boat.position.x, to.y - boat.position.z);
      const back = tuning.drowned.church.swingBack;
      boat.coastTo = { x: boat.position.x - Math.sin(boat.yaw) * back, z: boat.position.z - Math.cos(boat.yaw) * back, yaw };
      boat.nudge(1, 0.3);
    }
  }

  /** The fog has closed round: the boat is hers to bring, and the player's wind is what fills its sail. */
  private bring(): void {
    const { boat } = this.cast;
    this.to('bring');
    boat.coastTo = null;
    boat.mooring = null;
    boat.grounded = false;
    boat.canGround = false;
    boat.speedLimit = tuning.drowned.church.bringSpeed;
    this.leg = 0;
    boat.steerFor = BRING_WAY[0];
  }

  /** How far the boat still has to come along its way to the berth, metres. */
  private get left(): number {
    const p = this.cast.boat.position;
    let left = Math.hypot(p.x - BRING_WAY[this.leg].x, p.z - BRING_WAY[this.leg].y);
    for (let i = this.leg + 1; i < BRING_WAY.length; i++) left += BRING_WAY[i].distanceTo(BRING_WAY[i - 1]);
    return left;
  }

  private bringing(dt: number): void {
    const { boat, child: c } = this.cast;
    const k = tuning.drowned.church;
    const p = boat.position;
    if (this.leg < BRING_WAY.length - 1 && Math.hypot(p.x - BRING_WAY[this.leg].x, p.z - BRING_WAY[this.leg].y) < k.rounded) {
      this.leg++;
      boat.steerFor = BRING_WAY[this.leg];
      if (this.leg === BRING_WAY.length - 1) boat.mooring = { ...NAVE_BERTH };
    }
    const left = this.left;
    if (left < this.best - 0.5) {
      this.best = left;
      this.stall = 0;
    } else this.stall += dt;
    if (this.stall > k.valve) this.carrying = true;
    if (!this.down && left < k.meetFrom) {
      this.down = true;
      c.walkTo(SLATES_FOOT.x, SLATES_FOOT.z, false, () => c.stop(), 0.12);
    }
    const berthed = boat.grounded && Math.hypot(p.x - NAVE_BERTH.x, p.z - NAVE_BERTH.z) < k.berthed;
    if (berthed && this.down && !c.busy) this.board();
  }

  /** She steps down off the slates into the boat; the push off them takes it out from the roof. */
  private board(): void {
    const { boat, child: c } = this.cast;
    this.to('board');
    this.carrying = false;
    boat.mooring = null;
    boat.grounded = false;
    boat.speed = 0;
    c.faceToward(boat.position.x, boat.position.z, 1);
    c.board(boat, () => {
      this.to('aboard');
      this.aboardFor = 0;
    });
  }

  /**
   * As they go she looks back once at the cat in the belfry, turning round on the thwart to it the way that keeps her
   * face from the lens, and it mews down to her.
   */
  private goingAway(dt: number): void {
    const { child: c, cat, boat } = this.cast;
    const k = tuning.drowned.church;
    cat.eye(this.catEye);
    let want = 0;
    if (this.lookingBack) {
      c.lookAt = this.look.copy(this.catEye);
      const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
      let to = wrap(Math.atan2(this.catEye.x - c.position.x, this.catEye.z - c.position.z) - boat.yaw);
      const lens = this.camera ? wrap(Math.atan2(this.camera.position.x - c.position.x, this.camera.position.z - c.position.z) - boat.yaw) : 0;
      if (Math.abs(to) > k.turnPast && Math.sign(to) === Math.sign(lens)) to -= Math.sign(to) * Math.PI * 2;
      if (Math.abs(to) > k.headTurns) want = THREE.MathUtils.clamp(to - Math.sign(to) * k.headTurns, -k.seatTurn, k.seatTurn);
    }
    this.seatTurn += (want - this.seatTurn) * (1 - Math.exp(-dt * k.turnRate));
    if (!this.mewed && this.aboardFor > k.lookBackAt + k.mewAfter) {
      this.mewed = true;
      cat.mew(0.6);
    }
  }

  /**
   * Where she looks: up at the cat while it climbs and sits looking down; at the fog as it comes over the church and
   * then out across the water to her boat; at the boat while it is brought, and down at it as she steps in.
   */
  private gaze(dt: number): void {
    const { child: c, boat, cat } = this.cast;
    const k = tuning.drowned.church;
    const f = k.fog;
    let at: THREE.Vector3;
    const fog = this.step === 'fog' ? this.t : -1;
    if (this.step === 'watch' || this.step === 'climb' || this.step === 'up' || fog < f.lookAtFog && fog >= 0
      || fog >= f.lookAtCat && fog < f.lookAtCat + 2.5) at = this.look.copy(this.catEye);
    else if (fog >= 0 && fog < f.lookAtCat) at = this.look.copy(c.position).add(this.tmp.set(-4, 2, 20));
    else at = this.look.copy(boat.position).setY(boat.position.y + 0.8);
    if (this.step === 'board') at = this.look.copy(boat.position);
    c.lookAt = at;
    if (!c.busy && this.step !== 'board') c.faceToward(at.x, at.z, 1 - Math.exp(-dt * 2.5));
    cat.unease = this.step === 'fog' ? 0.6 : 0.35;
  }

  /**
   * Low over the water and never above the roofs. While the cat climbs, off the green to the south-west, near enough
   * for the cat on the ivy to read, with her on the ridge and the tower's south face, tilting up with the cat. As the
   * fog comes on behind it, it goes round the nave's west end, wide of its gable, to the open water north of the
   * church, ahead of the fog: from there the fog comes over the church, the boat is brought round the tower to the
   * nave and she steps down into it, the cat looking down from the belfry over them.
   */
  frame(shot: Shot, dt: number): number {
    const k = tuning.drownedCamera.church;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const w = this.want;
    if (!this.framed && this.camera) {
      this.framed = true;
      this.view.target.copy(shot.target);
      const e = this.camera.position;
      this.view.bearing = Math.atan2(e.x - shot.target.x, e.z - shot.target.z);
      this.view.distance = Math.hypot(e.x - shot.target.x, e.z - shot.target.z);
      this.view.eye = e.y;
      this.view.zoom = 1;
    }
    const round = this.step === 'watch' || this.step === 'climb' || this.step === 'up' ? 0
      : THREE.MathUtils.smootherstep(this.step === 'fog' ? this.t : 1e3, k.roundFrom, k.roundFrom + k.roundFor);
    if (round < 1) {
      const climbed = THREE.MathUtils.clamp((this.catEye.y - 1) / (TOWER.sill - 1), 0, 1);
      const e = this.tmp.set(TOWER.x + k.climbFrom.x, THREE.MathUtils.lerp(k.climbFrom.y, k.climbUp, climbed), TOWER.z + k.climbFrom.z);
      w.target.copy(this.head).lerp(this.catEye, k.climbAlong).y += k.climbLift;
      w.bearing = Math.atan2(e.x - w.target.x, e.z - w.target.z);
      w.distance = Math.hypot(e.x - w.target.x, e.z - w.target.z) * THREE.MathUtils.lerp(k.uprightFar, 1, wide);
      w.eye = e.y;
      w.zoom = THREE.MathUtils.lerp(1, k.climbZoom, wide);
    }
    if (round > 0) {
      const north = this.north(this.northView, wide, false);
      /** Wide of the nave's gable as it goes round, never across its roof. */
      const swing = Math.sin(round * Math.PI) * k.roundWide;
      w.target.lerp(north.target, round);
      w.bearing += Math.atan2(Math.sin(north.bearing - w.bearing), Math.cos(north.bearing - w.bearing)) * round;
      w.distance = THREE.MathUtils.lerp(round < 1 ? w.distance : north.distance, north.distance, round) + swing;
      w.eye = THREE.MathUtils.lerp(round < 1 ? w.eye : north.eye, north.eye, round);
      w.zoom = north.zoom;
    }
    this.ease(dt, k.ease);
    this.write(shot, this.view);
    shot.carry = false;
    return k.pace;
  }

  private readonly northView: View = { target: new THREE.Vector3(), bearing: 0, distance: 20, eye: 2.6, zoom: 1 };
  private readonly northEye = new THREE.Vector3();

  /**
   * The view from the open water north of the church: it stands further off while the boat is still at its tree and
   * draws in as it comes, looking between her and the boat; or, as they go, between her and the cat in the belfry.
   */
  private north(out: View, wide: number, back: boolean): View {
    const k = tuning.drownedCamera.church;
    const { child, boat } = this.cast;
    const near = 1 - THREE.MathUtils.clamp((this.left - 4) / 18, 0, 1);
    const far = k.northFar, close = k.northNear;
    const e = this.northEye.set(TOWER.x + THREE.MathUtils.lerp(far.x, close.x, near), THREE.MathUtils.lerp(far.y, close.y, near),
      TOWER.z + THREE.MathUtils.lerp(far.z, close.z, near));
    const head = this.tmp.copy(child.position).setY(child.position.y + 1.1);
    if (back) out.target.copy(head).lerp(this.catEye, THREE.MathUtils.lerp(k.backUprightAlong, k.backAlong, wide));
    else out.target.copy(head).lerp(boat.position, k.northToward * (1 - near)).setY(k.northAim);
    const reach = Math.hypot(e.x - out.target.x, e.z - out.target.z);
    out.bearing = Math.atan2(e.x - out.target.x, e.z - out.target.z);
    out.distance = reach * THREE.MathUtils.lerp(k.uprightFar, 1, wide);
    out.eye = e.y;
    out.zoom = back ? THREE.MathUtils.lerp(k.backUprightZoom, k.backZoom, wide) : 1;
    return out;
  }

  /**
   * Leaving the nave, the lens holds the view across the water to the church while she looks back at the cat in the
   * belfry, then gives the storm its own frame, going round to it about what it looks at as the boat goes by.
   */
  departure(shot: Shot, dt: number): void {
    if (this.aboardFor < 0) return;
    const k = tuning.drownedCamera.church;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const away = THREE.MathUtils.smootherstep(this.aboardFor, k.leaveFrom, k.leaveFrom + k.leaveFor);
    if (away >= 1) return;
    this.north(this.want, wide, this.aboardFor < tuning.drowned.church.lookBackAt + tuning.drowned.church.lookBackFor);
    this.ease(dt, k.ease);
    const storm: View = { target: shot.target.clone(), bearing: Math.atan2(shot.from!.x, shot.from!.z), distance: shot.distance,
      eye: shot.target.y + shot.height, zoom: shot.zoom ?? 1 };
    const v = this.view;
    const mixed: View = { target: storm.target.lerp(v.target, 1 - away),
      bearing: v.bearing + Math.atan2(Math.sin(storm.bearing - v.bearing), Math.cos(storm.bearing - v.bearing)) * away,
      distance: THREE.MathUtils.lerp(v.distance, storm.distance, away), eye: THREE.MathUtils.lerp(v.eye, storm.eye, away),
      zoom: THREE.MathUtils.lerp(v.zoom, storm.zoom, away) };
    this.write(shot, mixed);
    shot.carry = away > 0.5;
  }

  private ease(dt: number, rate: number): void {
    const v = this.view, w = this.want, u = 1 - Math.exp(-dt * rate);
    v.target.lerp(w.target, u);
    v.bearing += Math.atan2(Math.sin(w.bearing - v.bearing), Math.cos(w.bearing - v.bearing)) * u;
    v.distance += (w.distance - v.distance) * u;
    v.eye += (w.eye - v.eye) * u;
    v.zoom += (w.zoom - v.zoom) * u;
  }

  private write(shot: Shot, v: View): void {
    shot.eye = undefined;
    shot.subjects = undefined;
    shot.attention = undefined;
    shot.obstacles = undefined;
    shot.smoothFit = undefined;
    shot.target.copy(v.target);
    shot.from = (shot.from ?? new THREE.Vector3()).set(Math.sin(v.bearing), 0, Math.cos(v.bearing));
    shot.distance = v.distance;
    shot.height = v.eye - v.target.y;
    shot.zoom = v.zoom;
    shot.orbit = undefined;
    shot.free = false;
    shot.fitWidth = false;
  }
}

