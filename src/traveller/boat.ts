import { mirrorWater } from '../world/sky-mirror-layout';
import * as THREE from 'three';
import { tuning } from '../tuning';
import { Sway, feltWind, type WindField, type WindSample } from '../wind/field';
import { atmo } from '../world/atmosphere';
import { FOAM, Marks } from '../fx/sealife/marks';
import { heightAt } from '../world/island';
import { type Swell, swellAt, swellUniforms } from '../world/water/swell';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { BEAM, BOW_Z, DRAFT, LENGTH, MAST_TOP, MAST_Z, SAIL_RISE, SAIL_SPAN, SAIL_TACK, SEAT_Y, STERN_Z, contactShell, gunwale } from './boat/form';
import { boomGeometry, hullGeometry, lanternFlame, pennantGeometry, sailGeometry } from './boat/parts';
import { HULL_FRAG, HULL_VERT, PENNANT_FRAG, PENNANT_VERT, SAIL_FRAG, SAIL_VERT } from './boat/shaders';
import { hullLid, waterlineUniforms } from './boat/waterline';

/**
 * Pushed off a beach, a boat goes out the way the sand slopes, whichever way its bow is pointing, and is brought
 * round by hand before the sail can take it: how fast it drifts out, how fast it comes round, how nearly it has
 * to be pointing the right way before it is sailed, and the longest it is ever held like that.
 */
const PUSH_OFF_SPEED = 1.4;
/** How far ahead of the hull's centre the forefoot finds the bottom. */
const FOREFOOT = 2.2;
const PUSH_OFF_TURN = 0.55;
const PUSH_OFF_UNTIL = 0.7;
const PUSH_OFF_LONGEST = 8;
/** How fast it can be steered round under sail: nimble with no way on, and a wide slow curve at speed. */
const TURN_SLOW = 0.5;
const TURN_FAST = 0.25;
/**
 * Made fast at a berth, the hull only tests its contacts against the ground when the highest ground within its reach
 * could touch it: that ground is sampled this finely, kept while the boat stays this close to where it was measured,
 * and raised by this much beyond the slope between samples, for the height window's small differences.
 */
const CEILING_STEP = 0.5;
const CEILING_SLACK = 1;
const CEILING_MARGIN = 0.25;
/** On a cloud the hull rides higher than on the sea, its bottom just in the top of the cloud. */
const CLOUD_DRAFT = 0.42;
/** The way the boom's mesh lies before it is turned to the clew. */
const BOOM_REST = new THREE.Vector3(-1, 0, 0);

/**
 * The child's little boat. It waits on a beach, is pushed into the water, and then sails where it is steered,
 * driven by whatever wind fills its patchwork sail.
 */
export class Boat {
  scarfSail = 0;
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  /** A narrow passage can spill surplus wind without making its sail look becalmed. */
  speedLimit = Infinity;
  afloat = false;
  /** Where the child steers for; null lets it drift with the wind. */
  steerFor: THREE.Vector2 | null = null;
  /** True once the bow has run up onto a shore while sailing. */
  grounded = false;
  /** False while the route still passes close to land, so rounding a headland is not mistaken for arriving. */
  canGround = true;
  /** A berth to come alongside instead of a beach to run up: where the hull stops, and the way it lies there. */
  mooring: { x: number; z: number; yaw: number } | null = null;
  /**
   * How far the world's own wind has gone out of the sails, 0 normal to 1 dead calm. At 1 the boat has no way
   * of its own at all and only the wind the player makes moves it.
   */
  becalmed = 0;
  /** The opening cove shelters the sail from weather, while the player's gusts still reach it. */
  shelter = 0;
  /** How hard the sea is running under the hull, 0 calm to 1 the full squall; the boat rocks and drives on it. */
  swell = 0;
  /** Afloat on something other than the sea, such as the top of a cloud: the height it floats at, or null. */
  altitude: number | null = null;
  /**
   * The wind the sail has, smoothed, and the only reading the cloth and the hull are allowed: `blowing` is the
   * air moving in the cloth, `taken` the part of it the sail is holding (an eased sheet spills the rest), `along`
   * how much of what it holds pushes the way the boat is pointing, and `made` how much of it the player put there.
   */
  readonly sailWind = { blowing: 0, taken: 0, along: 0, made: 0 };
  private readonly sailPivot = new THREE.Group();
  /** The boom itself, turned every frame to the clew of the cloth the shader draws. */
  private readonly spar = new THREE.Mesh();
  private readonly clewAt = new THREE.Vector3();
  /** The world as the hull sees it, for the shade its own sides cast inside it. */
  private readonly hullFrame = new THREE.Matrix4();
  private readonly flame = lanternFlame();
  /** How bright the lantern's glass is this moment, 1 at full. */
  private readonly glass = { value: 1 };
  private readonly pennantMat: THREE.ShaderMaterial;
  /** The air the pennant streams in, in the hull's own frame, and how far out it lifts. */
  private readonly pennantAir = new THREE.Vector2();
  private pennantLift = 0;
  /** The child the sail gives way to (w = 1 while there is one to watch). */
  readonly subject = new THREE.Vector4();
  private readonly sailMat: THREE.ShaderMaterial;
  /** The actual shell vertices, before merging, so every part of the hull clears the sand. */
  private readonly hullContacts: THREE.BufferAttribute;
  private readonly contact = new THREE.Vector3();
  /** How far any contact can lie from the hull's origin, however it is turned. */
  private readonly reach: number;
  /** Above the highest ground within reach of the hull while it lies near (x, z). */
  private readonly ceiling = { x: NaN, z: NaN, height: Infinity };
  private nearShore = true;
  private readonly seatLocal = new THREE.Vector3(0, SEAT_Y, -0.25);
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  /** The wind the sail feels, on the hanging things' spring: it fills when a gust arrives, not when the air moves. */
  private readonly sway = new Sway();
  /** Foam left on the water behind the hull. */
  private readonly wake = new Marks();
  private wakeIn = 0;
  private readonly boardA = new THREE.Vector3();
  private readonly boardB = new THREE.Vector3();
  private readonly brushAt = new THREE.Vector3();
  private readonly brushTop = new THREE.Vector3();
  private readonly sea: Swell = { height: 0, slopeX: 0, slopeZ: 0 };
  /** How the hull is lying, for whoever is riding it. */
  roll = 0;
  pitch = 0;
  private boom = 0;
  /** The wind the sail has settled to, against which a new gust reads as an arrival. */
  private settled = 0;
  private luff = 0;
  private time = 0;
  /** A shove against the hull, signed by the side it came from, and how long ago it landed. */
  private shove = 0;
  private shoveAge = 1e3;
  /** Which way the beach lets it go while it is being pushed off, and how long that has been going on. */
  private readonly pushDir = new THREE.Vector2();
  private pushingFor = -1;
  /** The forefoot has touched a beach and the keel is sliding up it. */
  private beaching = false;
  /** While a foot is still crossing the gunwale, the hull may drift from the shove but the sail may not take it. */
  private boardingPush = false;

  constructor(private readonly wind: WindField) {
    const hullMat = new THREE.ShaderMaterial({
      vertexShader: HULL_VERT,
      fragmentShader: HULL_FRAG,
      uniforms: { ...atmo.uniforms, ...swellUniforms, ...waterlineUniforms, uHullFrame: { value: this.hullFrame }, uGlass: this.glass },
      side: THREE.DoubleSide,
    });
    this.hullContacts = contactShell().getAttribute('position') as THREE.BufferAttribute;
    let reach = 0;
    for (let i = 0; i < this.hullContacts.count; i++) reach = Math.max(reach, this.contact.fromBufferAttribute(this.hullContacts, i).length());
    this.reach = reach;
    this.group.add(new THREE.Mesh(hullGeometry(), hullMat), hullLid());

    this.sailMat = new THREE.ShaderMaterial({
      vertexShader: SAIL_VERT,
      fragmentShader: SAIL_FRAG,
      uniforms: { ...atmo.uniforms, uSubject: { value: this.subject }, uScarf: { value: 0 }, uFill: { value: 0 }, uFlutter: { value: 0 }, uRipplePhase: { value: 0 }, uLuff: { value: 0 }, uDroop: { value: 1 }, uShelter: { value: 0 } },
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    });
    this.sailPivot.position.set(0, 0, MAST_Z);
    this.sailPivot.add(new THREE.Mesh(sailGeometry(), this.sailMat));
    this.spar.position.set(0, SAIL_TACK, 0);
    this.spar.geometry = boomGeometry();
    this.spar.material = hullMat;
    this.sailPivot.add(this.spar);
    this.group.add(this.sailPivot);

    this.pennantMat = new THREE.ShaderMaterial({
      vertexShader: PENNANT_VERT,
      fragmentShader: PENNANT_FRAG,
      uniforms: { ...atmo.uniforms, uPennant: { value: new THREE.Vector4(0, -1, 0, 0) }, uScarf: { value: 0 } },
      side: THREE.DoubleSide,
    });
    const pennant = new THREE.Mesh(pennantGeometry(), this.pennantMat);
    pennant.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, MAST_TOP - 0.3, MAST_Z), 0.9);
    this.group.add(pennant);
  }

  get objects(): THREE.Object3D[] {
    return [this.group, this.wake.mesh];
  }

  beach(x: number, z: number, yaw: number): void {
    this.speedLimit = Infinity;
    this.shelter = 0;
    this.position.set(x, Math.max(heightAt(x, z), 0) + DRAFT, z);
    this.yaw = yaw;
    this.afloat = false;
    this.beaching = false;
    this.speed = 0;
    this.lieOnShore(1, 0);
    this.pose(0);
  }

  launch(holdForBoarding = false): void {
    this.afloat = true;
    this.grounded = false;
    this.beaching = false;
    this.speed = 0;
    this.pushingFor = 0;
    this.boardingPush = holdForBoarding;
    /** Out is downhill off the sand; on open water, where there is no slope, it is astern. */
    const p = this.position;
    const gx = heightAt(p.x + 3, p.z) - heightAt(p.x - 3, p.z);
    const gz = heightAt(p.x, p.z + 3) - heightAt(p.x, p.z - 3);
    if (Math.hypot(gx, gz) > 0.05) this.pushDir.set(-gx, -gz).normalize();
    else this.pushDir.set(-Math.sin(this.yaw), -Math.cos(this.yaw));
  }

  /** The child has settled: the shove may now give way to the wind already waiting in the sail. */
  finishBoarding(): void {
    this.boardingPush = false;
  }

  /** Pushed off a beach and still being brought round by hand, before the sail takes it. */
  get pushingOff(): boolean {
    return this.pushingFor >= 0;
  }

  /** Which side the sail is swung out to: +1 to starboard, -1 to port. */
  get sailSide(): number {
    return this.boom >= 0 ? 1 : -1;
  }

  /** The droop actually drawn by the cloth, 0 full to 1 hanging dead. */
  get sailDroop(): number { return this.sailMat.uniforms.uDroop.value; }
  get sailFlutter(): number { return this.sailMat.uniforms.uLuff.value; }

  /** World position of the middle of the sail, for anyone who needs to look at it. */
  sailPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.set(0, SAIL_TACK + 1.45, MAST_Z).applyMatrix4(this.group.matrixWorld);
  }

  /** Put a stroke that crosses the sail on screen onto the sail; from low behind the boat the pointer's ray meets water beyond it. */
  brushSail(camera: THREE.Camera, input: PointerInput): void {
    const k = tuning.sail;
    if (input.muted || !input.present || input.gust < k.brushSpeed || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    this.sailPoint(this.brushAt);
    const top = this.brushTop.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(k.brushReach).add(this.brushAt).project(camera).y;
    const radius = Math.abs(top - this.brushTop.copy(this.brushAt).project(camera).y);
    if (screenBrush(camera, this.brushAt, input.prevNdc, input.ndc, radius) < 0.01) return;
    this.wind.addSplat({ source: this,
      ax: this.position.x, az: this.position.z, bx: this.position.x, bz: this.position.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust,
      radius: k.brushWindRadius, energy: Math.min(0.65, input.gust / k.brushEnergyScale), lift: 0, swirl: 0 });
  }

  /** The visible hull's ends, so landmark framing keeps the whole boat within the screen. */
  hullEnds(bow: THREE.Vector3, stern: THREE.Vector3): void {
    this.group.updateMatrixWorld(true);
    bow.set(0, gunwale(1) - 0.05, BOW_Z).applyMatrix4(this.group.matrixWorld);
    stern.set(0, 0, STERN_Z).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Something in the water leans on the hull from `side` (+1 for the hull's own +x, the side a crossing calls
   * left), `strength` 1 being about a dolphin's shoulder: the boat heels away from the shove, its head is knocked
   * round and it is given a surge, all three easing out over a couple of seconds.
   */
  nudge(side: number, strength = 1): void {
    this.shove = side * strength;
    this.shoveAge = 0;
  }

  /** World position of the seat, where the child rides. */
  seat(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.copy(this.seatLocal).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * The shoreward place beside the thwart. Choosing the higher of the two sides keeps the child on sand when the
   * boat is lying at an angle to a beach, and gives every departure the same measured last step to the gunwale.
   */
  boardingPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    this.boardA.set(-1.45, 0, 0.3).applyMatrix4(this.group.matrixWorld);
    this.boardB.set(1.45, 0, 0.3).applyMatrix4(this.group.matrixWorld);
    const a = heightAt(this.boardA.x, this.boardA.z);
    const b = heightAt(this.boardB.x, this.boardB.z);
    return out.copy(a >= b ? this.boardA : this.boardB);
  }

  update(dt: number, time: number): void {
    this.time += dt;
    const p = this.position;
    if (this.afloat) this.shelter *= Math.exp(-dt * tuning.opening.departureRate);
    const w = this.readWind(dt);
    const air = this.sailWind;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const along = w.x * fx + w.z * fz;
    const across = w.x * fz - w.z * fx;

    this.shoveAge += dt;
    const u = this.shoveAge / tuning.dolphins.shovePeak;
    const kick = this.shove * u * Math.exp(1 - u);

    if (this.afloat && !this.grounded) {
      let dy = 0;
      if (this.steerFor) {
        const want = Math.atan2(this.steerFor.x - p.x, this.steerFor.y - p.z);
        dy = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      }
      if (this.pushingOff) {
        this.pushingFor += dt;
        const out = PUSH_OFF_SPEED * Math.max(0.35, 1 - this.pushingFor / PUSH_OFF_LONGEST);
        p.x += this.pushDir.x * out * dt;
        p.z += this.pushDir.y * out * dt;
        this.yaw += THREE.MathUtils.clamp(dy, -dt * PUSH_OFF_TURN, dt * PUSH_OFF_TURN);
        if (!this.boardingPush && ((this.steerFor && Math.abs(dy) < PUSH_OFF_UNTIL) || this.pushingFor > PUSH_OFF_LONGEST)) {
          this.pushingFor = -1;
        }
      } else if (this.beaching) {
        this.speed = Math.max(0, this.speed - tuning.sail.beachGrip * dt);
        p.x += fx * this.speed * dt;
        p.z += fz * this.speed * dt;
        if (this.speed === 0) {
          this.beaching = false;
          this.grounded = true;
        }
      } else {
        /**
         * A small boat sails on any point of wind, so what drives it is how much wind the sail is holding, with
         * a little more for a following one. Nobody is ever left stuck head to wind waiting for a shift.
         */
        const ashore = this.canGround ? this.beachApproach(fx, fz) : Infinity;
        // Past its landing point with the beach still ahead, it runs on up the sand rather than coming round for it.
        if (ashore < Infinity && Math.abs(dy) > Math.PI / 2) dy = 0;
        const distance = this.steerFor ? Math.hypot(this.steerFor.x - p.x, this.steerFor.y - p.z) : Infinity;
        // Ease the sheet before a tight turn. A fixed turning circle can orbit a point forever.
        const aligned = THREE.MathUtils.smoothstep(Math.cos(dy), 0, tuning.sail.turnAligned);
        const turnLimit = this.steerFor
          ? THREE.MathUtils.lerp(Math.max(tuning.sail.minimumWay, distance * TURN_FAST * tuning.sail.turnBrake), tuning.sail.topSpeed, aligned)
          : Infinity;
        const berthDistance = this.mooring ? Math.hypot(this.mooring.x - p.x, this.mooring.z - p.z) : Infinity;
        const approach = Math.max(tuning.sail.minimumWay, berthDistance * tuning.sail.mooringDrive);
        const drive = Math.min(
          air.taken * tuning.sail.drive + Math.max(0, air.along) * tuning.sail.following,
          tuning.sail.topSpeed,
          this.speedLimit,
          turnLimit,
          approach,
        );
        const gathering = drive > this.speed ? tuning.sail.gathers : tuning.sail.carries;
        this.speed += (drive - this.speed) * (1 - Math.exp(-dt * gathering));
        this.speed = Math.min(tuning.sail.topSpeed, this.speed + Math.abs(kick) * tuning.dolphins.shoveSurge * dt);
        this.speed = Math.min(this.speed, ashore);
        this.yaw += kick * tuning.dolphins.shoveYaw * dt;
        const turn = THREE.MathUtils.lerp(TURN_SLOW, TURN_FAST, Math.min(1, this.speed / 5));
        this.yaw += THREE.MathUtils.clamp(dy, -dt * turn, dt * turn);
        // The child takes a line as the berth approaches; sideways drift must not defeat the last turn.
        const leeway = Math.min(0.06, this.speedLimit * tuning.sail.passageDrift / Math.max(1, Math.hypot(w.x, w.z)));
        const drift = leeway * (this.mooring ? THREE.MathUtils.smoothstep(berthDistance, 2.6, tuning.sail.mooringShelter) : 1);
        p.x += (fx * this.speed + w.x * drift) * dt;
        p.z += (fz * this.speed + w.z * drift) * dt;
      }
      // Pushed off a beach bow first, the forefoot is still on the sand it is leaving.
      if (this.canGround && !this.grounded && !this.beaching && !this.pushingOff && this.touchesBottom(p.x, p.z, fx, fz, 0)) {
        this.beaching = true;
        this.speed = Math.min(this.speed, tuning.sail.beachTouch);
      }
      if (this.mooring && Math.hypot(this.mooring.x - p.x, this.mooring.z - p.z) < 2.6) {
        this.grounded = true;
        this.speed = 0;
      }
    } else if (this.afloat && this.mooring) {
      /** Made fast: it settles against the jetty and lies along it. */
      const m = this.mooring;
      const k = 1 - Math.exp(-dt * 0.8);
      p.x += (m.x - p.x) * k;
      p.z += (m.z - p.z) * k;
      this.yaw += Math.atan2(Math.sin(m.yaw - this.yaw), Math.cos(m.yaw - this.yaw)) * k;
    }

    const heel = this.afloat ? THREE.MathUtils.clamp(across * 0.018, -0.22, 0.22) : 0;
    /**
     * The hull lies along the swell it is floating on, the same waves the water mesh is displaced by, so the
     * boat rises over a crest and heels to the face of it instead of rocking to a rhythm of its own.
     */
    const t = this.time;
    if (this.altitude !== null) this.sea.height = this.sea.slopeX = this.sea.slopeZ = 0;
    const lift = this.altitude === null ? this.swellUnder(p.x, p.z, time) : this.altitude;
    const bow = this.sea.slopeX * fx + this.sea.slopeZ * fz;
    const beam = this.sea.slopeX * fz - this.sea.slopeZ * fx;
    const settle = 1 - Math.exp(-dt * 3.5);
    const waterRoll = heel + kick * tuning.dolphins.shoveHeel + Math.sin(t * 1.3) * (this.afloat ? 0.05 : 0.0) + beam;
    const waterPitch = this.afloat ? Math.sin(t * 0.9 + 1) * 0.04 - this.speed * 0.004 - bow : -0.05;
    this.lieOnShore(settle, this.altitude === null ? lift : 1e3, waterRoll, waterPitch);
    const bob = this.afloat ? Math.sin(t * 1.1) * 0.045 + Math.sin(t * 2.3) * 0.02 : 0;
    p.y = this.afloat ? bob + lift + (this.altitude === null ? DRAFT : CLOUD_DRAFT) : Math.max(heightAt(p.x, p.z), 0) + DRAFT + 0.1;

    const sail = this.sailMat.uniforms;
    sail.uScarf.value = this.scarfSail;
    sail.uShelter.value = this.shelter;
    /** With nothing moving in it the cloth is dead weight: the leech falls in and it hangs off the mast in folds. */
    const hang = 1 - THREE.MathUtils.smoothstep(air.blowing, 0, tuning.sail.hangsBelow);
    sail.uDroop.value = hang;
    /** Nothing holds a dead sail out: the boom comes back amidships and swings with whatever the hull is doing. */
    const set = THREE.MathUtils.clamp(Math.atan2(across, Math.max(along, 0.5)) * 0.6, -1.1, 1.1);
    const targetBoom = set * (1 - hang * 0.85) + hang * Math.sin(this.time * 0.35) * 0.05;
    this.boom += (targetBoom - this.boom) * (1 - Math.exp(-dt * 1.5));
    const fill = (1 - Math.exp(-air.taken / tuning.sail.bellyAt)) * (this.afloat ? 1 : 0.4);
    // Cloth bellies along the sail's local +z, rotated by the boom and hull. Crosswind alone can
    // change sign in a following breeze and turn the belly astern while the wind still drives us forward.
    const normalYaw = this.yaw + this.boom;
    const pressure = w.x * Math.sin(normalYaw) + w.z * Math.cos(normalYaw);
    sail.uFill.value += ((pressure >= 0 ? 1 : -1) * fill * tuning.sail.belly - sail.uFill.value) * (1 - Math.exp(-dt * 3));
    /** The harder it blows, the more there is for the cloth to do: a lazy ripple in a light air, a lively one in a gust. */
    sail.uFlutter.value = Math.min(1, air.blowing / tuning.sail.livelyAt);
    /** Integrate the changing frequency: multiplying it by elapsed time makes every gust jump the cloth. */
    sail.uRipplePhase.value = (sail.uRipplePhase.value
      + dt * (tuning.sail.rippleRate + tuning.sail.rippleGustRate * sail.uFlutter.value)) % (Math.PI * 2);
    /**
     * A gust does not simply fill the sail: it breaks over it. The cloth shakes along the leech the moment the
     * wind changes, hard for a gust the sail was not already carrying, and goes quiet again as it fills.
     */
    const pressing = Math.min(1, w.energy * 1.5 + air.made / 12);
    this.settled += (pressing - this.settled) * (1 - Math.exp(-dt * 1.1));
    const arriving = Math.max(0, pressing - this.settled) / Math.max(1 - this.settled, 0.2);
    this.luff = Math.max(this.luff * Math.exp(-dt / tuning.sail.luffFade), Math.min(1, Math.max(0, arriving - tuning.sail.luffFrom) * 2.4));
    /** An eased sheet spills its wind instead of holding it: the sail flaps on while the boat loses way. */
    const spilling = this.becalmed * Math.min(1, (air.blowing - air.made) / tuning.sail.hangsBelow);
    const squallLuff = this.swell * tuning.sail.squallLuff * (0.58 + 0.42 * Math.sin(this.time * 2.7) ** 2);
    sail.uLuff.value = Math.max(this.luff, spilling, squallLuff) * (this.afloat ? 1 : 0.5);
    this.flyPennant(dt, across, along, air.blowing);
    this.trimBoom(time);
    this.pose(dt);
    this.updateWake(dt, time);
    this.light(time);
  }

  /** The pennant streams the way the air in the sail is going, lifting out as it freshens. */
  private flyPennant(dt: number, across: number, along: number, blowing: number): void {
    const k = 1 - Math.exp(-dt * 2.5);
    this.pennantAir.x += (across - this.pennantAir.x) * k;
    this.pennantAir.y += (along - this.pennantAir.y) * k;
    this.pennantLift += (1 - Math.exp(-blowing / 2.2) - this.pennantLift) * k;
    const u = this.pennantMat.uniforms;
    const length = this.pennantAir.length();
    const [x, z] = length > 1e-3 ? [this.pennantAir.x / length, this.pennantAir.y / length] : [0, -1];
    u.uPennant.value.set(x, z, this.pennantLift, (u.uPennant.value.w + dt * (5 + 10 * this.pennantLift)) % (Math.PI * 200));
    u.uScarf.value = this.scarfSail;
  }

  /**
   * Where the clew of the cloth is this frame, worked out exactly as the sail's shader does at the corner of its
   * foot, so the boom can lie under it: out to the clew of a full sail, swinging with the leech as it shakes.
   */
  private trimBoom(time: number): void {
    const u = this.sailMat.uniforms;
    const k = tuning.sail;
    const droop = u.uDroop.value;
    const shelter = u.uShelter.value;
    const cut = 1 - droop * THREE.MathUtils.lerp(k.gather, tuning.opening.sailGather, shelter);
    const y = SAIL_TACK + cut * SAIL_RISE - droop * 0.4 * THREE.MathUtils.lerp(k.sag, tuning.opening.sailSag, shelter);
    const folds = Math.sin(k.folds * Math.PI * 2 + 1.1) * 0.3;
    const breathe = 0.7 + 0.3 * Math.sin(time * 0.55);
    const ripple = Math.sin(u.uRipplePhase.value - 6.5) * u.uFlutter.value;
    const shake = (u.uLuff.value + u.uFlutter.value * 0.35) * 0.4;
    const z = droop * (folds * breathe * k.fold + Math.sin(time * 0.4) * 0.08) + ripple * k.ripple + Math.sin(time * 19 - 12) * shake * k.shake;
    this.clewAt.set(-cut * SAIL_SPAN, y - SAIL_TACK, z).normalize();
    this.spar.quaternion.setFromUnitVectors(BOOM_REST, this.clewAt);
  }

  /** The air the sail is standing in: the one place the boat reads the wind field. */
  private airOnSail(out: WindSample, dt: number): WindSample {
    feltWind(this.wind.sample(this.position.x, this.position.z, out), this.wind.calm);
    this.sway.update(out.x, out.z, dt);
    out.x = this.sway.x;
    out.z = this.sway.z;
    return out;
  }

  /**
   * What the sail has this frame, smoothed into `sailWind`. The world's share is the prevailing breeze the
   * chapter is running, which is steady and dies when the chapter means it to; the field itself is read for what
   * the player has added to it and for which way the wind is lying. `becalmed` takes the world's wind out of the
   * sail and leaves the player's. The squall is no stronger in the field, so its weight comes from the sea.
   */
  private readWind(dt: number): WindSample {
    const w = this.airOnSail(this.sample, dt);
    const speed = Math.hypot(w.x, w.z);
    const world = this.wind.breeze.length();
    /** Told by the gust it carries and by standing well clear of the breeze and of the field's own stirring. */
    const made = Math.max(0, speed - Math.max(world, tuning.sail.stirs)) + w.energy * tuning.sail.gustPress;
    const weather = this.swell * tuning.sail.squallPress;
    const exposed = 1 - this.shelter;
    const blowing = made + (world + weather) * exposed;
    const taken = made + (world + weather * tuning.sail.squallHolds) * exposed * (1 - this.becalmed);
    /** Which way it is lying is the field's to say, however little of it there is. */
    const heading = speed > 1e-3 ? (w.x * Math.sin(this.yaw) + w.z * Math.cos(this.yaw)) / speed : 0;
    const along = heading * taken;
    const air = this.sailWind;
    air.blowing = this.takesUp(air.blowing, blowing, dt);
    air.taken = this.takesUp(air.taken, taken, dt);
    air.made = this.takesUp(air.made, made, dt);
    air.along += (along - air.along) * (1 - Math.exp(-dt * tuning.sail.fills));
    return w;
  }

  /** Cloth takes wind up faster than it lets it go. */
  private takesUp(was: number, now: number, dt: number): number {
    const rate = now > was ? tuning.sail.fills : tuning.sail.empties;
    return was + (now - was) * (1 - Math.exp(-dt * rate));
  }

  /**
   * The swell under a point, damped in the shallows exactly as the water mesh damps it, so a boat coming in
   * over the sand settles onto a flat sea rather than bobbing on a swell that is no longer drawn.
   */
  private swellUnder(x: number, z: number, time: number): number {
    swellAt(x, z, time, this.sea);
    const damp = this.afloat ? THREE.MathUtils.smoothstep(Math.max(-heightAt(x, z), 0), 0.6, 4.5) * (1 - mirrorWater(x, z)) : 0;
    this.sea.height *= damp;
    this.sea.slopeX *= damp;
    this.sea.slopeZ *= damp;
    return this.sea.height;
  }

  /** The lantern lights what is round it from when its glass does: as the sun goes down and through the night. */
  private light(time: number): void {
    const u = atmo.uniforms;
    const lit = this.group.visible ? Math.max(u.uNight.value, 1 - THREE.MathUtils.smoothstep(u.uSunDir.value.y, 0.04, 0.28)) : 0;
    // Incommensurate slow waves wander without a beat, so the flame breathes rather than blinks.
    const gutter = 0.5 + 0.25 * Math.sin(time * 2.3) + 0.15 * Math.sin(time * 5.1 + 1.7) + 0.1 * Math.sin(time * 8.7 + 0.4);
    this.glass.value = 1 - tuning.lantern.glassFlicker * gutter;
    const at = this.contact.copy(this.flame).applyMatrix4(this.group.matrixWorld);
    u.uLantern.value.set(at.x, at.y, at.z, tuning.lantern.glow * lit * (1 - tuning.lantern.flicker * gutter));
  }

  /** The sea breaking against the hull, and a short tail of foam behind it while it is under way that spreads and fades. */
  private updateWake(dt: number, time: number): void {
    const bySea = this.altitude === null && this.group.visible ? 1 : 0;
    const wet = waterlineUniforms.uHullWet.value;
    const ease = 1 - Math.exp(-dt * 2);
    wet.set(wet.x + ((this.afloat ? bySea : 0) - wet.x) * ease, Math.abs(this.speed), wet.z + (bySea - wet.z) * ease);
    waterlineUniforms.uHullAt.value.set(this.position.x, this.position.z, Math.sin(this.yaw), Math.cos(this.yaw));
    this.wake.update(time);
    this.wakeIn -= dt;
    if (!this.afloat || this.grounded || this.speed < 0.6 || this.wakeIn > 0 || this.altitude !== null) return;
    this.wakeIn = 0.15;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const strength = Math.min(0.7, this.speed * 0.13);
    // Two broken trails peel off the quarters; a small curl at each shoulder anchors the waterline.
    for (const side of [-1, 1]) {
      this.wake.add(FOAM, this.position.x - fx * 1.6 + fz * side * 0.5,
        this.position.z - fz * 1.6 - fx * side * 0.5, 0.22, 5.5, time,
        strength, 0.22, Math.PI / 2 - this.yaw + side * 0.18, 1.65);
      this.wake.add(FOAM, this.position.x + fx * 0.6 + fz * side * 0.78,
        this.position.z + fz * 0.6 - fx * side * 0.78, 0.13, 1.4, time,
        strength * 0.8, 0.09, Math.PI / 2 - this.yaw, 2.4);
    }
  }

  private pose(_dt: number): void {
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.yaw);
    this.group.rotateX(this.pitch);
    this.group.rotateZ(this.roll);
    // Floating height alone lets an arriving bow, or a departing stern, pass through the beach.
    // Resolve the shell against the ground after applying its complete pitch and roll.
    let supported = -Infinity;
    const touching = this.nearShore && !this.clearOfGround();
    for (let i = 0; touching && i < this.hullContacts.count; i++) {
      const p = this.contact.fromBufferAttribute(this.hullContacts, i).applyQuaternion(this.group.quaternion);
      supported = Math.max(supported, heightAt(this.position.x + p.x, this.position.z + p.z) - p.y);
    }
    this.position.y = Math.max(this.position.y, supported + tuning.sail.hullClearance);
    this.group.position.copy(this.position);
    this.sailPivot.rotation.y = this.boom;
    this.group.updateMatrixWorld(true);
    this.hullFrame.copy(this.group.matrixWorld).invert();
  }

  /**
   * True only when no contact can reach the ground, so testing them would leave the hull where it is. Outside the
   * height window every contact's ground is the procedural island, which costs most of a moored boat's frame.
   */
  private clearOfGround(): boolean {
    if (!this.afloat || !this.grounded || !this.mooring) return false;
    const p = this.position, c = this.ceiling;
    if (!(Math.hypot(p.x - c.x, p.z - c.z) <= CEILING_SLACK)) this.measureCeiling(p.x, p.z);
    let lowest = Infinity;
    for (let i = 0; i < this.hullContacts.count; i++) {
      lowest = Math.min(lowest, this.contact.fromBufferAttribute(this.hullContacts, i).applyQuaternion(this.group.quaternion).y);
    }
    return c.height - lowest + tuning.sail.hullClearance < p.y;
  }

  private measureCeiling(x: number, z: number): void {
    const n = Math.ceil((this.reach + CEILING_SLACK) / CEILING_STEP) + 1, side = 2 * n + 1;
    const h = new Float64Array(side * side);
    let top = -Infinity, slope = 0;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const k = j * side + i;
        h[k] = heightAt(x + (i - n) * CEILING_STEP, z + (j - n) * CEILING_STEP);
        top = Math.max(top, h[k]);
        if (i) slope = Math.max(slope, Math.abs(h[k] - h[k - 1]));
        if (j) slope = Math.max(slope, Math.abs(h[k] - h[k - side]));
      }
    }
    this.ceiling.x = x;
    this.ceiling.z = z;
    this.ceiling.height = top + slope + CEILING_MARGIN;
  }

  /** The forefoot, `run` further along the heading, is in water shallow enough to touch. */
  private touchesBottom(x: number, z: number, fx: number, fz: number, run: number): boolean {
    return heightAt(x + fx * (FOREFOOT + run), z + fz * (FOREFOOT + run)) > -0.25;
  }

  /** The most way the hull may carry with the beach this close ahead, so it touches at `beachTouch`. */
  private beachApproach(fx: number, fz: number): number {
    const k = tuning.sail, p = this.position;
    if (!this.touchesBottom(p.x, p.z, fx, fz, k.beachLook)) return Infinity;
    let near = 0, far = k.beachLook;
    for (let i = 0; i < 6; i++) {
      const mid = (near + far) / 2;
      if (this.touchesBottom(p.x, p.z, fx, fz, mid)) far = mid;
      else near = mid;
    }
    return Math.sqrt(k.beachTouch * k.beachTouch + 2 * k.beachEase * far);
  }

  /** Rest along a sloping beach instead of holding a level hull on its highest corner. */
  private lieOnShore(settle: number, sea: number, waterRoll = 0, waterPitch = -0.05): void {
    const p = this.position, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const fore = heightAt(p.x + fx * 2, p.z + fz * 2);
    const aft = heightAt(p.x - fx * 2, p.z - fz * 2);
    const right = heightAt(p.x + fz * BEAM, p.z - fx * BEAM);
    const left = heightAt(p.x - fz * BEAM, p.z + fx * BEAM);
    const ground = Math.max(fore, aft, right, left, heightAt(p.x, p.z));
    this.nearShore = ground > -LENGTH;
    const resting = THREE.MathUtils.smoothstep(ground, sea - 0.4, sea + 0.4);
    const base = sea - 0.15;
    const pitch = -Math.atan2(Math.max(fore, base) - Math.max(aft, base), 4);
    const roll = Math.atan2(Math.max(right, base) - Math.max(left, base), BEAM * 2);
    const limit = tuning.sail.shoreTilt;
    this.pitch += (THREE.MathUtils.lerp(waterPitch, THREE.MathUtils.clamp(pitch, -limit, limit), resting) - this.pitch) * settle;
    this.roll += (THREE.MathUtils.lerp(waterRoll, THREE.MathUtils.clamp(roll, -limit, limit), resting) - this.roll) * settle;
  }
}
