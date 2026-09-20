import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Traveller } from '../traveller/traveller';
import { screenBrush } from '../creatures/motion';
import { mirrorMaterial, soapMaterial, soapWand, starLight } from './mirror-soap';
import type { PointerInput } from '../input/pointer';
import { glsl, tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { MIRROR_BOWL, MIRROR_STARS, MIRROR_CONSTELLATION, MIRROR_DRIFT, MIRROR_BERTH, MIRROR_ENTRY_DECK, SKY_MIRROR, mirrorBed } from './sky-mirror-layout';
import { REFLECTION_LAYER } from './water/reflection';

const T = tuning.skyMirror;
const COUNT = 12;
export const mirrorUniforms = {
  uMirrorRings: { value: Array.from({ length: COUNT }, () => new THREE.Vector4(0, 0, -100, 0)) },
};
export const MIRROR_RIPPLES_GLSL = /* glsl */ `
uniform vec4 uMirrorRings[${COUNT}];
vec2 mirrorSlope(vec2 p) {
  vec2 slope = vec2(0.0);
  for (int i = 0; i < ${COUNT}; i++) {
    vec4 ring = uMirrorRings[i];
    float age = uTime - ring.z;
    if (age < 0.0 || age > 9.0 || ring.w <= 0.0) continue;
    vec2 delta = p - ring.xy;
    float d = length(delta);
    float wave = d - age * ${glsl(T.rippleSpeed)};
    float envelope = exp(-wave * wave * 0.22) * exp(-age * 0.45) * smoothstep(0.0, 0.3, age);
    slope += delta / max(d, 0.1) * cos(wave * 3.4) * envelope * ring.w;
  }
  return slope;
}
`;
const VERT = `varying vec3 vWorld; varying vec3 vNormal;
void main() { vWorld=(modelMatrix*vec4(position,1.0)).xyz;
vNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0); }`;
type Light = ReturnType<typeof starLight>;
export interface MirrorBubble {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  age: number;
  star: number;
  pop: number;
  liftArmed: boolean;
  liftTurn: number;
  liftHeading: number | null;
}
interface FallenStar {
  floor: Light;
  light: Light;
  origin: THREE.Vector3;
  sky: THREE.Vector3;
  from: THREE.Vector3;
  state: 'fallen' | 'carried' | 'rising' | 'sky' | 'falling';
  flight: number;
}

/** Wind makes bubbles; low bubbles catch the fallen lights, and updrafts return them to the sky. */
export class SkyMirror {
  readonly group = new THREE.Group();
  readonly wand = new THREE.Vector3();
  readonly bubbles: MirrorBubble[] = [];
  readonly stars: FallenStar[] = [];
  active = false;
  ready = false;
  holdingWand = false;
  hasPlayed = false;
  requestedStar = -1;
  focusStar = 0;
  completedMask = 0;
  lastReturned = -1;
  private ring = 0;
  private nextStroke = 0;
  private forming = 0;
  private cooldown = 0;
  private lastCharge = 0;
  private readonly hoop = soapWand();
  private readonly film = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), soapMaterial());
  private readonly bubbleGeometry = new THREE.SphereGeometry(1, 48, 32);
  private readonly lastChild = new THREE.Vector3();
  private readonly lastBird = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly rim = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly reflected = new THREE.Vector3();
  private readonly strokeFrom = new THREE.Vector3();
  private readonly strokeTo = new THREE.Vector3();
  private readonly stroke = new THREE.Vector3();
  private footstepsReady = false;
  private readonly guideLights = new THREE.Vector3();
  private readonly constellationLines: THREE.Mesh<THREE.TubeGeometry,THREE.MeshBasicMaterial>[] = [];

  constructor() {
    this.group.add(this.hoop, this.film);
    this.film.layers.enable(REFLECTION_LAYER);
    const wood = mirrorMaterial('#927b68');
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.86, 0.15, 24), wood);
    seat.position.set(MIRROR_BOWL.x, 0.95, MIRROR_BOWL.z); this.group.add(seat);
    for (const [x,z] of [[-0.5,-0.4],[0.5,-0.4],[0,0.55]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.1,0.9,8), wood);
      leg.position.set(MIRROR_BOWL.x+x,0.45,MIRROR_BOWL.z+z); this.group.add(leg);
    }
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.64,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),
      mirrorMaterial('#b3c7ca'));
    bowl.scale.y=0.5; bowl.position.set(MIRROR_BOWL.x,1.3,MIRROR_BOWL.z); this.group.add(bowl);
    const soap = new THREE.Mesh(new THREE.CircleGeometry(0.61,32),soapMaterial());
    soap.rotation.x=-Math.PI/2; soap.position.set(MIRROR_BOWL.x,1.24,MIRROR_BOWL.z); this.group.add(soap);
    this.group.traverse(o=>o.layers.enable(REFLECTION_LAYER));
    for (const [i,at] of MIRROR_STARS.entries()) {
      const floor=starLight(true), light=starLight();
      const origin=new THREE.Vector3(at.x,0.055,at.z);
      floor.position.copy(origin); light.visible=false;
      const sky=MIRROR_CONSTELLATION[i];
      this.stars.push({floor,light,origin,sky:new THREE.Vector3(sky.x,T.starHeight+sky.rise,sky.z),
        from:new THREE.Vector3(),state:'fallen',flight:0});
      this.group.add(floor,light);
    }
    for(let i=0;i<2;i++) {
      const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(this.stars[i].sky,this.stars[i+1].sky),1,0.035,4,false),
        new THREE.MeshBasicMaterial({color:'#ffdc9c',transparent:true,opacity:0,depthWrite:false}));
      line.layers.enable(REFLECTION_LAYER); this.constellationLines.push(line); this.group.add(line);
    }
    // Broken bands of reflected light on the deep-water approach. Their gaps close only when the
    // constellation is whole, so the boat's last approach has a visible cause.
    const offshore=MIRROR_DRIFT[MIRROR_DRIFT.length-2];
    const dx=MIRROR_BERTH.x-offshore.x,dz=MIRROR_BERTH.z-offshore.z;
    const guide=new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(dx,dz),5),new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uLit:{value:this.guideLights}},transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec2 vUv; uniform vec3 uLit; uniform float uTime;
        void main(){float part=vUv.x*3.0;float on=part<1.0?uLit.x:part<2.0?uLit.y:uLit.z;
          float complete=min(uLit.x,min(uLit.y,uLit.z));float s=fract(part);
          float gaps=mix(smoothstep(0.01,0.18,s)*(1.0-smoothstep(0.82,0.99,s)),1.0,complete);
          float edge=pow(max(0.0,1.0-abs(vUv.y*2.0-1.0)),2.0);
          float ripple=pow(0.5+0.5*sin(vUv.x*240.0+sin(vUv.y*19.0+uTime*0.6)*2.0),8.0);
          float ends=smoothstep(0.0,0.04,vUv.x)*(1.0-smoothstep(0.96,1.0,vUv.x));
          gl_FragColor=vec4(vec3(1.0,0.81,0.5),on*gaps*edge*ends*(0.06+ripple*0.62));}`,
    }));
    guide.position.set((offshore.x+MIRROR_BERTH.x)/2,0.055,(offshore.z+MIRROR_BERTH.z)/2);
    guide.rotation.set(-Math.PI/2,0,Math.atan2(-dz,dx)); this.group.add(guide);
    const timber = new THREE.ShaderMaterial({ uniforms: { ...atmo.uniforms }, vertexShader: VERT,
      fragmentShader: `${ATMO_GLSL}
      varying vec3 vWorld; varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float grain = vnoise(vec2(vWorld.x * 1.7, vWorld.z * 35.0));
        vec3 col = vec3(0.3, 0.25, 0.20) * (0.8 + 0.35 * grain);
        col *= hemiLight(n) + uSunColor * max(dot(n, uSunDir), 0.0);
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }` });
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = timber) => {
      const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.layers.enable(REFLECTION_LAYER); this.group.add(mesh); return mesh;
    };
    for (let i = 0; i < 31; i++) add(new THREE.BoxGeometry(0.49, 0.14, 2.2), -406.8 + i * 0.51, 0.15, -2323);
    for (let i = 0; i < 5; i++) for (const side of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.12, 3, 7), -406 + i * 3.6, -1, -2323 + side);
    // The entry has its own landing stage: a hull in deep water, planks above it, then the bare mirror.
    const entry=MIRROR_ENTRY_DECK;
    const entryX=entry.x1-entry.x0,entryZ=entry.z1-entry.z0,entryYaw=Math.atan2(entryX,entryZ);
    const entryParts: THREE.BufferGeometry[]=[];
    const part=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>entryParts.push(g.rotateY(entryYaw).translate(x,y,z));
    const length=Math.hypot(entryX,entryZ), planks=Math.ceil(length/0.51);
    for(let i=0;i<planks;i++)part(new THREE.BoxGeometry(entry.halfWidth*2,0.14,length/planks-0.015),
      entry.x0+(i+0.5)*entryX/planks,entry.height-0.07,entry.z0+(i+0.5)*entryZ/planks);
    const posts=Math.ceil(length/3.7);
    for(let i=0;i<=posts;i++)for(const side of [-1,1]) {
      const z=entry.z0+i*entryZ/posts-Math.sin(entryYaw)*side, x=entry.x0+i*entryX/posts+Math.cos(entryYaw)*side;
      const bottom=mirrorBed(x,z)-0.4, top=entry.height+0.5;
      part(new THREE.CylinderGeometry(0.1,0.15,top-bottom,8),x,(top+bottom)/2,z);
    }
    for(const side of [-1,1])part(new THREE.BoxGeometry(0.14,0.22,length),(entry.x0+entry.x1)/2+Math.cos(entryYaw)*side*0.85,
      entry.height-0.23,(entry.z0+entry.z1)/2-Math.sin(entryYaw)*side*0.85);
    add(mergeGeometries(entryParts),0,0,0);entryParts.forEach(g=>g.dispose());
    // A lone lamppost comes into view along the curve, with no house or second red door.
    add(new THREE.CylinderGeometry(0.075, 0.11, 5, 9), -394, 2.2, -2324.05);
    add(new THREE.BoxGeometry(0.76, 0.12, 0.62), -394, 4.85, -2324.05);
    add(new THREE.BoxGeometry(0.66, 0.10, 0.56), -394, 4.12, -2324.05);
    const lamp = new THREE.MeshBasicMaterial({ color: '#ffcb79' });
    add(new THREE.BoxGeometry(0.42, 0.59, 0.35), -394, 4.46, -2324.05, lamp);
    for (const x of [-0.25, 0.25]) for (const z of [-0.2, 0.2]) add(new THREE.BoxGeometry(0.035, 0.7, 0.035), -394 + x, 4.48, -2324.05 + z);
    this.reset(); this.group.visible=false;
  }

  get progress(): number { return this.stars.filter(s=>s.state==='sky').length; }
  get carried(): MirrorBubble | undefined { return this.bubbles.find(b=>b.star>=0 && b.pop===0); }
  get invitation(): THREE.Vector3 | null {
    if (!this.ready || this.carried || this.stars.some(s=>s.state==='rising')) return null;
    return this.bubbles.find(b=>b.pop===0)?.position ?? this.wand;
  }
  get liftTarget(): THREE.Vector3 | null { return this.carried?.position ?? null; }
  get aim(): THREE.Vector3 { return this.carried?.position ?? this.stars[this.focusStar].origin; }

  reset(): void {
    for (const b of this.bubbles) { this.group.remove(b.mesh); b.mesh.material.dispose(); }
    this.bubbles.length=0; this.completedMask=0; this.lastReturned=-1;
    this.ready=this.holdingWand=this.hasPlayed=false; this.requestedStar=-1; this.focusStar=0;
    this.forming=this.cooldown=this.lastCharge=0; this.footstepsReady=false;
    this.guideLights.set(0,0,0); this.constellationLines.forEach(line=>line.material.opacity=0);
    this.hoop.position.set(MIRROR_BOWL.x+0.2,1.2,MIRROR_BOWL.z); this.hoop.rotation.set(-0.35,0,0.4);
    this.hoop.visible=true; this.film.visible=false;
    for (const s of this.stars) { s.state='fallen'; s.flight=0; s.floor.visible=true; s.light.visible=false; }
    for (const r of mirrorUniforms.uMirrorRings.value) r.set(0,0,-100,0);
  }

  /** Old crossing saves still restore the completed room by count. */
  restore(count: number): void { this.restoreStars((1 << THREE.MathUtils.clamp(Math.floor(count),0,3))-1); }
  restoreStars(mask: number): void {
    this.reset(); this.completedMask=mask & 7;
    this.stars.forEach((s,i)=>{
      if (this.completedMask & (1<<i)) {
        s.state='sky'; s.floor.visible=false; s.light.visible=true; s.light.position.copy(s.sky); s.light.scale.setScalar(1.8);
      }
    });
    this.updateGuide(Infinity);
  }

  private updateGuide(dt: number): void {
    const k=1-Math.exp(-dt*1.3);
    this.stars.forEach((s,i)=>this.guideLights.setComponent(i,
      THREE.MathUtils.lerp(this.guideLights.getComponent(i),s.state==='sky'?1:0,k)));
    this.constellationLines.forEach((line,i)=>{
      const lit=this.stars[i].state==='sky' && this.stars[i+1].state==='sky';
      line.material.opacity=THREE.MathUtils.lerp(line.material.opacity,lit?0.38:0,k);
    });
  }

  /** Called after the child's pose, so the prop stays in the actual mitten. */
  pose(child: Traveller): void {
    if (this.active && this.holdingWand) {
      child.mitten(1,this.hand); this.hoop.position.copy(this.hand);
      this.hoop.rotation.set(0,child.yaw,0.08);
    }
    this.hoop.updateMatrixWorld(true);
    this.wand.set(0,0.95,0).applyMatrix4(this.hoop.matrixWorld);
    this.film.position.copy(this.wand);
    this.film.quaternion.copy(this.hoop.quaternion);
    this.film.scale.set(T.wandRadius,T.wandRadius,0.035+this.forming*0.8);
    this.film.visible=this.active && this.ready;
  }

  putDownWand(child: THREE.Vector3): void {
    this.holdingWand=false;
    this.hoop.position.set(child.x+1.1,0.09,child.z);
    this.hoop.rotation.set(-Math.PI/2,0,0.3);
  }

  ripple(x: number,z: number,time: number,strength: number): void {
    mirrorUniforms.uMirrorRings.value[this.ring++ % COUNT].set(x,z,time,strength);
  }

  private hit(at: THREE.Vector3,radius: number,input: PointerInput,camera: THREE.Camera): number {
    this.projected.copy(at).project(camera);
    if (this.projected.z>1 || this.projected.z< -1) return 0;
    this.right.setFromMatrixColumn(camera.matrixWorld,0);
    this.rim.copy(at).addScaledVector(this.right,radius).project(camera);
    const aspect=(camera as THREE.PerspectiveCamera).aspect ?? 1;
    return screenBrush(camera,at,input.prevNdc,input.ndc,Math.abs(this.rim.x-this.projected.x)*aspect+T.bubbleHitPadding);
  }

  /** Project the actual stroke onto the bubble's height, using the same camera for both ends. */
  private strokePoint(ndc: {x:number;y:number},height: number,camera: THREE.Camera,out: THREE.Vector3): void {
    out.set(ndc.x,ndc.y,0.5).unproject(camera).sub(camera.position);
    const t=(height-camera.position.y)/out.y;
    out.multiplyScalar(t).add(camera.position);
  }

  brush(dt: number,time: number,input: PointerInput,camera: THREE.Camera): void {
    this.requestedStar=-1;
    this.lastCharge=input.charge;
    for(const b of this.bubbles)if(b.star>=0 && input.charge<T.liftFrom*0.5)b.liftArmed=true;
    if (!this.active || input.muted || !input.present || dt<=0) return;
    const travel=input.ndc.distanceTo(input.prevNdc);
    if (travel<0.0005) return;
    let touched=false;
    for (const b of this.bubbles) {
      if (b.pop>0) continue;
      this.reflected.copy(b.position).setY(-b.position.y);
      const hit=Math.max(this.hit(b.position,b.radius,input,camera),this.hit(this.reflected,b.radius,input,camera));
      if (hit<=0) continue;
      touched=true;
      if(b.star>=0 && !b.liftArmed) {
        // A fresh arc after capture can start lifting without making the player release and wait
        // for old charge to drain. Straight steering still cannot inherit that charge.
        const aspect=(camera as THREE.PerspectiveCamera).aspect ?? 1;
        const heading=Math.atan2(input.ndc.y-input.prevNdc.y,(input.ndc.x-input.prevNdc.x)*aspect);
        if(b.liftHeading!==null) {
          const turn=Math.atan2(Math.sin(heading-b.liftHeading),Math.cos(heading-b.liftHeading));
          if(Math.abs(turn)<1.2)b.liftTurn+=turn;
          if(Math.abs(b.liftTurn)>Math.PI*0.75)b.liftArmed=true;
        }
        b.liftHeading=heading;
      }
      // An empty bubble skims the mirror, even if a steering stroke curls. Only a caught light
      // gives the bubble something to lift; circling cannot spoil the approach to a star.
      const lift=b.star>=0 && b.liftArmed?THREE.MathUtils.smoothstep(input.charge,T.liftFrom,T.liftFull):0;
      if (lift>0) b.velocity.y += T.bubbleLift*lift*dt*5;
      else if(b.star<0) {
        // Use the local screen direction at the bubble: a long flick may end above the horizon,
        // where intersecting its endpoint with a horizontal plane would invert the push.
        this.projected.copy(b.position).project(camera);
        this.rim.set(this.projected.x+(input.ndc.x-input.prevNdc.x)/travel*0.01,
          this.projected.y+(input.ndc.y-input.prevNdc.y)/travel*0.01,0);
        this.strokePoint(this.projected,b.position.y,camera,this.strokeFrom);
        this.strokePoint(this.rim,b.position.y,camera,this.strokeTo);
        this.stroke.subVectors(this.strokeTo,this.strokeFrom).setY(0);
        if(this.stroke.lengthSq()>0.000001 && Number.isFinite(this.stroke.lengthSq())) {
          const aspect=(camera as THREE.PerspectiveCamera).aspect ?? 1;
          const speed=Math.hypot((input.ndc.x-input.prevNdc.x)*aspect,input.ndc.y-input.prevNdc.y)/dt;
          this.stroke.normalize().multiplyScalar(T.bubbleSpeed*Math.tanh(speed/T.bubbleStrokeSpeed));
          // Follow a reversal promptly, instead of adding opposite forces until they cancel.
          // A broad core makes strokes over the visible film feel as effective as its centre.
          const response=1-Math.exp(-dt*T.bubbleResponse*Math.min(1,Math.sqrt(hit)*2));
          b.velocity.x=THREE.MathUtils.lerp(b.velocity.x,this.stroke.x,response);
          b.velocity.z=THREE.MathUtils.lerp(b.velocity.z,this.stroke.z,response);
        }
      }
    }
    if (!touched && this.ready && this.cooldown<=0 && this.hit(this.wand,T.wandRadius,input,camera)>0) {
      this.forming += Math.min(travel,dt*4)*T.bubbleGrow;
      this.hasPlayed=true;
      if (this.forming>=1) {
        this.spawn(); this.forming=0; this.cooldown=1.1;
      }
      touched=true;
    }
    // A sweep at a different fallen light asks the paper to lead the child there.
    if (!touched && this.ready && !this.bubbles.some(b=>b.pop===0) && !this.stars.some(s=>s.state==='rising')) this.stars.forEach((s,i)=>{
      if (s.state==='fallen' && this.hit(s.origin,1.8,input,camera)>0) this.requestedStar=i;
    });
    if (time>=this.nextStroke && Math.hypot(input.world.x-SKY_MIRROR.x,input.world.z-SKY_MIRROR.z)<90) {
      this.ripple(input.world.x,input.world.z,time,T.rippleStrength*0.4); this.nextStroke=time+0.2;
    }
  }

  private spawn(): void {
    const live=this.bubbles.filter(b=>b.pop===0);
    if (live.length>=3) { const empty=live.find(b=>b.star<0); if (empty) this.pop(empty); else return; }
    const mesh=new THREE.Mesh(this.bubbleGeometry,soapMaterial());
    mesh.layers.enable(REFLECTION_LAYER); this.group.add(mesh);
    const position=mesh.position.copy(this.wand), at=this.stars[this.focusStar].origin;
    const dir=new THREE.Vector3(at.x-position.x,0,at.z-position.z).normalize();
    position.addScaledVector(dir,0.8); position.y=Math.max(T.bubbleRadius,position.y);
    this.bubbles.push({mesh,position,velocity:dir.multiplyScalar(1.2),radius:T.bubbleRadius,age:0,star:-1,pop:0,
      liftArmed:false,liftTurn:0,liftHeading:null});
  }

  /** Bursting never loses a light: it settles back onto the same patch of mirror. */
  pop(b: MirrorBubble): void {
    if (b.pop>0) return;
    b.pop=0.001;
    if (b.star>=0) {
      const s=this.stars[b.star]; s.state='falling'; s.from.copy(b.position); s.flight=0; b.star=-1;
    }
  }

  update(dt: number,time: number,child: THREE.Vector3,bird: THREE.Vector3,afoot: boolean): void {
    this.group.visible=this.active || Math.hypot(child.x-SKY_MIRROR.x,child.z-SKY_MIRROR.z)<185;
    if (!this.active) { this.footstepsReady=false; return; }
    this.cooldown=Math.max(0,this.cooldown-dt);
    for (let i=this.bubbles.length-1;i>=0;i--) {
      const b=this.bubbles[i]; b.age+=dt;
      if (b.pop>0) {
        b.pop+=dt; b.mesh.scale.setScalar(b.radius*(1+b.pop*0.5)); b.mesh.material.uniforms.uFade.value=Math.max(0,1-b.pop*3);
        if (b.pop>0.4) { this.group.remove(b.mesh); b.mesh.material.dispose(); this.bubbles.splice(i,1); }
        continue;
      }
      const drag=Math.exp(-dt*(b.star<0?T.bubbleDrag:T.bubbleFilledDrag));
      b.velocity.x*=drag; b.velocity.z*=drag;
      b.velocity.y*=Math.exp(-dt*T.bubbleVerticalDrag);
      const planar=Math.hypot(b.velocity.x,b.velocity.z);
      if (planar>T.bubbleSpeed) { b.velocity.x*=T.bubbleSpeed/planar; b.velocity.z*=T.bubbleSpeed/planar; }
      b.velocity.y-=dt*0.8;
      b.position.addScaledVector(b.velocity,dt);
      if (b.position.y<b.radius+0.08) { b.position.y=b.radius+0.08; b.velocity.y=Math.max(0,b.velocity.y); }
      b.mesh.scale.set(b.radius*(1+Math.sin(time*1.7+i)*0.018),b.radius,b.radius);
      if (mirrorBed(b.position.x,b.position.z)<-0.1 || (b.star<0 && b.position.distanceTo(child)>T.bubbleReach)) { this.pop(b); continue; }
      if (b.star<0 && b.position.y<b.radius+0.8) {
        const index=this.stars.findIndex(s=>s.state==='fallen' && Math.hypot(s.origin.x-b.position.x,s.origin.z-b.position.z)<T.captureRadius);
        if (index>=0) {
          b.star=index; b.liftArmed=this.lastCharge<T.liftFrom;
          const s=this.stars[index]; s.state='carried'; s.from.copy(s.origin); s.flight=0; s.floor.visible=false; s.light.visible=true;
          b.mesh.material.uniforms.uFilled.value=1; this.ripple(s.origin.x,s.origin.z,time,0.065);
        }
      }
      if (b.star>=0) {
        const s=this.stars[b.star]; s.flight=Math.min(1,s.flight+dt/0.5);
        s.light.position.lerpVectors(s.from,b.position,THREE.MathUtils.smoothstep(s.flight,0,1)); s.light.scale.setScalar(2.9);
        if (b.position.y>=T.bubbleRelease) {
          s.state='rising'; s.flight=0; s.from.copy(b.position); b.star=-1; this.pop(b);
        }
      }
    }
    for (const [i,s] of this.stars.entries()) {
      if (s.state==='rising' || s.state==='falling') {
        const rising=s.state==='rising'; s.flight=Math.min(1,s.flight+dt/(rising?T.starRise:1.8));
        const t=THREE.MathUtils.smoothstep(s.flight,0,1);
        s.light.position.lerpVectors(s.from,rising?s.sky:s.origin,t);
        s.light.scale.setScalar(THREE.MathUtils.lerp(2.9,rising?1.8:3.4,t));
        if (s.flight===1) {
          s.state=rising?'sky':'fallen'; s.floor.visible=!rising; s.light.visible=rising;
          if (rising) { this.completedMask|=1<<i; this.lastReturned=i; }
        }
      }
      s.floor.material.uniforms.uFade.value=0.85+Math.sin(time*1.8+i*2)*0.15;
    }
    this.updateGuide(dt);
    if (this.footstepsReady) {
      if (child.distanceTo(this.lastChild)>0.85) { this.ripple(child.x,child.z,time,0.018); this.lastChild.copy(child); }
      if (afoot && bird.distanceTo(this.lastBird)>0.5) { this.ripple(bird.x,bird.z,time,0.009); this.lastBird.copy(bird); }
    } else { this.lastChild.copy(child); this.lastBird.copy(bird); this.footstepsReady=true; }
  }
}
