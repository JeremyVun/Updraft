import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { MIRROR_STARS, MIRROR_BOWL, MIRROR_LANDING, MIRROR_ENTRY_DECK, MIRROR_BERTH, MIRROR_DECK, MIRROR_DRIFT, mirrorBed } from '../world/sky-mirror-layout';
import type { Cast, Chapter } from './cast';
import { cue } from './cues';

type Beat = 'ashore' | 'setDown' | 'pickup' | 'play' | 'throw' | 'walk' | 'fetch' | 'reveal' | 'gather' | 'jetty' | 'boarding' | 'aboard';
const T=tuning.skyMirror;
const GRIP=new THREE.Vector3(-0.65,-0.15,0.7);

/** A child can mend the sky: skim soap bubbles over its fallen stars, then lift the lights home. */
export class SkyMirrorChapter implements Chapter {
  beat: Beat='ashore';
  target=0;
  readonly worldLife=1;
  readonly breeze=0.025;
  readonly season=0.96;
  readonly haze=0.9;
  readonly openSea=1;
  readonly music='mirror' as const;
  readonly hush=0.5;
  readonly pace=0.8;
  readonly focus=new THREE.Vector3();
  readonly shot: Shot={target:new THREE.Vector3(),distance:T.cameraDistance,height:T.cameraHeight,
    from:new THREE.Vector3(-0.92,0,0.39).normalize(),clearance:1.6};
  dusk=T.duskFrom;
  private elapsed=0;
  private drift=-1;
  private boatReady=false;
  private returned=0;
  private nextLook=0;
  private nextChase=0;
  private readonly stand=new THREE.Vector3();
  private readonly aim=new THREE.Vector3();
  private readonly hand=new THREE.Vector3();
  private readonly velocity=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly watched=new THREE.Vector3();
  private readonly frameChild=new THREE.Vector3();
  private readonly framePlay=new THREE.Vector3();
  private readonly deck={...MIRROR_DECK};
  private readonly entryDeck={...MIRROR_ENTRY_DECK};
  private readonly oldRadius: number;

  constructor(private readonly cast: Cast) {
    const {child,plane,cygnet,skyMirror,sealife,boat}=cast;
    skyMirror.reset(); skyMirror.active=true;
    sealife.dolphinsWith(null,0); sealife.onDolphinShove=()=>{};
    child.decks.push(this.deck,this.entryDeck);
    child.dismount(); child.stroll=T.stroll;
    boat.afloat=boat.grounded=true; boat.mooring=MIRROR_LANDING; boat.canGround=false;
    child.place(this.entryDeck.x0,this.entryDeck.z0-3,Math.PI);
    cygnet.mayFly=false; cygnet.watch(null);
    this.oldRadius=plane.homeRadius;
    plane.homeRadius=7;
    plane.landingGround=(x,z)=>mirrorBed(x,z)>-0.04?0.001:null;
    plane.hold(child); plane.visible=true;
    child.walkTo(this.entryDeck.x1,this.entryDeck.z1-1,false,()=>this.setDown(),0.3);
    this.shot.subjects={primary:this.frameChild,secondary:this.framePlay,margin:0.76,extra:12};
    this.frame();
  }

  /** The kite marks the far jetty throughout play; the completed stars still summon the boat. */
  readonly departureKite = true;

  get done(): boolean { return this.beat==='aboard'; }
  readonly scripted=false;
  get windInvitation(): THREE.Vector3 | null { return this.cast.skyMirror.invitation; }
  get coax() {
    const at=this.cast.skyMirror.liftTarget;
    return at?{at,urgency:0.8,radius:2}:null;
  }
  get checkpoint(): string | null {
    // Journey saves when the checkpoint name changes; the bitmask makes every returned light durable.
    return this.cast.skyMirror.holdingWand && ['play','throw','walk','fetch','reveal','gather','jetty'].includes(this.beat)
      ? `stars-${this.cast.skyMirror.completedMask}` : null;
  }
  saveCheckpoint(): number[] { return [this.cast.skyMirror.completedMask,this.target]; }
  restoreCheckpoint(point: string,data: number[]): void {
    const {child,cygnet,skyMirror:room,plane,boat}=this.cast;
    const starSave=point==='stars' || point.startsWith('stars-');
    const mask=starSave?(data[0]|0)&7:point==='tide'?1:point==='lantern'?3:0;
    room.restoreStars(mask); room.active=true;
    this.returned=room.progress;
    this.target=starSave?THREE.MathUtils.clamp(data[1]|0,0,2):this.nearest();
    if (room.stars[this.target].state==='sky' && room.progress<3) this.target=this.nearest();
    room.focusStar=this.target;
    child.stop(); child.dismount(); child.standUp(); child.kneeling=0;
    this.destination(this.target); child.place(this.stand.x,this.stand.z,Math.PI);
    this.watched.copy(child.position).add(new THREE.Vector3(-1.6,0,0.2)); cygnet.release(this.watched);
    cygnet.stay=false; cygnet.mayFly=false; child.stowPlane(true,true); plane.hold(child); plane.visible=true;
    room.holdingWand=true; room.ready=true; child.reachLocal(1,GRIP); room.pose(child);
    if (mask) {
      const offshore=MIRROR_DRIFT[MIRROR_DRIFT.length-2];
      boat.beach(offshore.x,offshore.z,Math.atan2(MIRROR_BERTH.x-offshore.x,MIRROR_BERTH.z-offshore.z));
      boat.afloat=boat.grounded=true; boat.mooring=null;
      this.drift=MIRROR_DRIFT.length-2; this.boatReady=false;
    } else {
      // Older empty-room saves parked the hull on the shallow flat. Restore them at the new jetty.
      boat.beach(MIRROR_LANDING.x,MIRROR_LANDING.z,MIRROR_LANDING.yaw);
      boat.afloat=boat.grounded=true;boat.mooring=MIRROR_LANDING;
      this.drift=-1;this.boatReady=false;
    }
    this.to('play'); this.frame();
  }
  private to(beat: Beat): void { this.beat=beat; this.elapsed=0; }
  private setDown(): void {
    this.to('setDown');
    this.cast.carry.setDown(()=>{
      this.stand.set(MIRROR_BOWL.x+1.2,0,MIRROR_BOWL.z+0.9);
      this.walkWithPlane();
    });
  }
  private arrive(): void {
    const {child,skyMirror:room}=this.cast;
    if (room.holdingWand) { this.play(); return; }
    this.watched.set(MIRROR_BOWL.x+0.2,1.2,MIRROR_BOWL.z);
    child.lookAt=this.watched; child.reachFor(1,this.watched); this.to('pickup');
    room.pose(child);
  }
  private destination(index: number): void {
    const at=MIRROR_STARS[index]; this.stand.set(at.x+2.8,0,at.z+5.5);
  }
  private nearest(): number {
    const {child,skyMirror:room}=this.cast;
    let index=0,distance=Infinity;
    room.stars.forEach((s,i)=>{if(s.state==='fallen'){const d=child.position.distanceToSquared(s.origin);if(d<distance){distance=d;index=i;}}});
    return index;
  }

  update(dt: number,time: number): void {
    this.elapsed+=dt;
    const {child:c,cygnet:k,skyMirror:room,plane:p}=this.cast;
    this.dusk=THREE.MathUtils.lerp(T.duskFrom,T.duskTo,room.progress/3);
    this.driftBoat(dt);
    if(p.held)p.hold(c);
    if(this.beat==='pickup' && this.elapsed>1.2) {
      room.holdingWand=true; c.reachLocal(1,GRIP);
      this.destination(0); c.walkTo(this.stand.x,this.stand.z,false,()=>this.play(),0.45); this.to('walk');
    } else if(this.beat==='play') {
      const carried=room.carried;
      const rising=room.stars.find(s=>s.state==='rising');
      c.lookAt=carried?.position ?? rising?.light.position ?? room.aim;
      if(carried) { k.watch(carried.position); }
      else if(time>this.nextLook) {
        this.watched.copy(room.aim); k.watch(this.watched);
        k.does('nibble',this.watched,1.8); this.nextLook=time+9;
      }
      // Capture happens later in the frame than story navigation. Even an empty bubble locks
      // manual destination changes; a filled or rising light also holds automatic progression.
      if(carried || rising) { room.requestedStar=-1; }
      else if(room.progress===3) { room.ready=false; this.to('reveal'); }
      else if(room.progress>this.returned) {
        this.returned=room.progress; cue('delight'); this.walkToStar(this.nearest());
      } else if(room.requestedStar>=0 && room.requestedStar!==this.target && !room.bubbles.some(b=>b.pop===0)) {
        const choice=room.requestedStar; room.requestedStar=-1; this.walkToStar(choice);
      }
    } else if(this.beat==='reveal') {
      c.lookAt=this.watched.set(MIRROR_BERTH.x,4,MIRROR_BERTH.z); k.watch(this.watched);
      if(this.elapsed>T.constellationReveal)this.gather();
    } else if(this.beat==='walk' && !p.held && !c.acting) {
      // The player can play with the paper on the way; it settles close to the next fallen light.
      c.lookAt=p.position;
      const toStop=Math.hypot(c.position.x-this.stand.x,c.position.z-this.stand.z);
      if(p.landed && (toStop<9 || p.position.distanceTo(c.position)<3)) { this.fetchPlane(); }
      else if(time>this.nextChase) {
        this.aim.copy(p.position);
        if(toStop<8 || Math.hypot(this.aim.x-this.stand.x,this.aim.z-this.stand.z)>8 || p.position.distanceTo(c.position)<3) this.aim.copy(this.stand);
        if(mirrorBed(this.aim.x,this.aim.z)>-0.04)c.walkTo(this.aim.x,this.aim.z,false,undefined,0.5);
        this.nextChase=time+0.65;
      }
    } else if(this.beat==='fetch' && !p.landed && !c.acting) {
      c.stop(); this.to('walk');
    } else if(this.beat==='jetty' && !c.moving && this.boatReady) {
      this.to('boarding'); c.board(this.cast.boat,()=>{
        c.stroll=1; c.decks=c.decks.filter(d=>d!==this.deck && d!==this.entryDeck); c.stowPlane(false); c.reachFor(1,null);
        k.mayFly=true; k.stay=false; k.watch(null);
        p.landingGround=null; p.homeRadius=this.oldRadius;
        room.active=false; room.ready=false; this.to('aboard');
      });
    }
    this.frame();
  }
  private play(): void {
    const {child,skyMirror:room}=this.cast;
    room.ready=true; room.focusStar=this.target; room.requestedStar=-1;
    child.faceToward(room.aim.x,room.aim.z,1); child.reachLocal(1,GRIP);
    this.to('play');
  }
  private walkToStar(index: number): void {
    const {skyMirror:room}=this.cast;
    for(const bubble of room.bubbles)if(bubble.star<0)room.pop(bubble);
    this.target=index; this.destination(index); room.focusStar=index; room.ready=false; room.requestedStar=-1;
    this.walkWithPlane();
  }
  private walkWithPlane(): void {
    const {child:c,plane:p,cygnet:k,skyMirror:room}=this.cast;
    k.stay=false; k.watch(null); c.lookAt=null; c.stowPlane(false); c.reachFor(1,null);
    p.home.copy(this.stand); this.direction.subVectors(this.stand,c.position).setY(0).normalize();
    this.to('throw');
    c.throwToward(this.stand.x,this.stand.z,()=>{
      p.launch(c.handPosition(this.hand),this.velocity.copy(this.direction).multiplyScalar(7).setY(3.5));
      if(room.holdingWand)c.reachLocal(1,GRIP);
      c.walkTo(this.stand.x,this.stand.z,false,undefined,0.5); this.to('walk');
    });
  }
  private fetchPlane(): void {
    const {child,plane}=this.cast;
    this.to('fetch');
    child.walkTo(plane.position.x,plane.position.z,false,()=>{
      if(!plane.landed) { this.to('walk'); return; }
      child.pickUp(()=>{
        child.stowPlane(true); plane.hold(child);
        if(this.cast.skyMirror.holdingWand)child.reachLocal(1,GRIP);
        child.walkTo(this.stand.x,this.stand.z,false,()=>this.arrive(),0.5); this.to('walk');
      });
    },1.1);
  }
  private gather(): void {
    const {child,cygnet,carry,skyMirror:room,plane}=this.cast;
    room.ready=false;
    // The little hoop stays behind on the mirror; the paper stays with the child all the way home.
    child.reachFor(1,null); child.lookAt=null; child.stowPlane(false); plane.hold(child);
    cygnet.stay=false; cygnet.watch(null); cygnet.errand=null; this.to('gather');
    child.pickUp(()=>{
      room.putDownWand(child.position);
      carry.gatherUp(()=>carry.stow(()=>{
        this.to('jetty'); child.walkTo(-391.5,-2323,false,undefined,0.25);
      }));
    });
  }
  private driftBoat(dt: number): void {
    const { boat, skyMirror } = this.cast;
    if (this.boatReady || !skyMirror.hasPlayed && skyMirror.progress === 0) return;
    if (this.drift < 0) {
      this.drift = 0; boat.afloat = true; boat.grounded = true;
      boat.mooring = null; boat.speed = 0;
    }
    // The tide carries an empty hull. Its sailing physics remain at rest while it follows this deep-water channel.
    const at = MIRROR_DRIFT[this.drift], p = boat.position;
    const dx = at.x - p.x, dz = at.z - p.z, distance = Math.hypot(dx, dz);
    const step = Math.min(distance, dt * T.boatDriftSpeed);
    if (distance > 0.001) {
      p.x += dx / distance * step; p.z += dz / distance * step;
      const yaw = Math.atan2(dx, dz);
      boat.yaw += Math.atan2(Math.sin(yaw - boat.yaw), Math.cos(yaw - boat.yaw)) * (1 - Math.exp(-dt * 0.9));
    }
    if (distance < 0.15) {
      if (this.drift === MIRROR_DRIFT.length-2 && skyMirror.progress<3) return;
      if (this.drift < MIRROR_DRIFT.length - 1) this.drift++;
      else { this.boatReady = true; boat.mooring = MIRROR_BERTH; }
    }
  }

  private frame(): void {
    const {child,skyMirror:room}=this.cast;
    const leaving=['gather','jetty','boarding','aboard'].includes(this.beat);
    const playing=this.beat==='play';
    const reveal=this.beat==='reveal';
    const rising=room.stars.find(s=>s.state==='rising');
    const portrait=window.innerWidth<window.innerHeight;
    // Keep the ground destination fixed while steering: tracking the moving bubble would slide the
    // view under the player's hand. A side view separates the hoop, bubble and its fallen light.
    this.frameChild.copy(child.position).y+=1.6;
    this.framePlay.copy(playing?room.stars[this.target].origin:child.position);
    const bubble=room.carried ?? room.bubbles.find(b=>b.pop===0);
    if(playing && bubble)this.framePlay.copy(bubble.position);
    if(rising)this.framePlay.copy(rising.light.position);
    this.shot.target.copy(child.position);
    if(playing)this.shot.target.lerp(room.stars[this.target].origin,0.5);
    this.shot.target.y=1.8+(room.carried?Math.max(0,room.carried.position.y-2)*T.cameraLiftFollow:0);
    this.shot.from!.set(-0.92,0,leaving?0.72:0.39).normalize();
    this.shot.distance=portrait?T.cameraPortraitDistance:T.cameraDistance;
    this.shot.height=portrait?T.cameraPortraitHeight:T.cameraHeight;
    this.shot.subjects!.extra=rising && portrait?35:12;
    if(rising) {
      this.shot.height=4; this.shot.target.y=4;
      this.shot.distance=portrait?T.cameraPortraitRiseDistance:T.cameraRiseDistance;
      this.shot.from!.copy(child.position).sub(rising.sky).setY(0).normalize();
    }
    if(reveal) {
      this.aim.set(MIRROR_BERTH.x,0,MIRROR_BERTH.z);
      this.shot.target.lerpVectors(child.position,this.aim,0.45).setY(4);
      this.shot.from!.copy(child.position).sub(room.stars[1].sky).setY(0).normalize();
      this.shot.distance=portrait?64:48; this.shot.height=7;
      this.framePlay.copy(this.cast.boat.position);
    }
    this.focus.copy(child.position);
  }
}
