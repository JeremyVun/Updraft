import * as THREE from 'three';
import { sleepingGust } from './sleeping-wind';
import { sleepingBirches } from './sleeping-birches';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { SLEEP_PATH, SLEEP_FOG_STOP, sleepPathAt } from './sleeping-layout';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';
import { SNOW_AT, SleepingDrift, alongRoute } from './sleeping-drift';

export { SNOW_AT };

const point = (i: number) => new THREE.Vector3(SLEEP_PATH[i][0], heightAt(SLEEP_PATH[i][0], SLEEP_PATH[i][1]), SLEEP_PATH[i][1]);
const MIST_FORWARD = point(SLEEP_FOG_STOP+1).sub(point(SLEEP_FOG_STOP)).setY(0).normalize();
/** The fog bank lying in the saddle just uphill of the bird. */
export const MIST_AT = alongRoute(SLEEP_FOG_STOP, 2.8);
/** How much of the summit window's glow reaches the eye: lost when the fog closes round the bird, back as it parts. */
export const WINDOW_SEEN = { value: 1 };

const VERT = `
  uniform vec2 uDawn; in float aSnow; in vec3 color; out vec3 vWorld; out vec3 vNormal; out vec3 vColor;
  void main(){vWorld=position;vWorld.y-=aSnow*smoothstep(.2,.85,uDawn.x)*.65;vNormal=normal;vColor=color;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`;
const FRAG = `${ATMO_GLSL}
  in vec3 vWorld; in vec3 vNormal; in vec3 vColor;
  void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
    float snow=frostAt(vWorld.xz)*smoothstep(0.15,0.72,n.y);
    vec3 base=mix(vColor,vec3(0.78,0.86,0.91),snow*0.93);
    float strata=0.92+0.08*sin(vWorld.y*12.0+vWorld.x*0.35);
    vec3 col=base*strata*(hemiLight(n)*1.25+uSunColor*max(dot(n,uSunDir),0.0)*cloudShadow(vWorld.xz)+lampLight(vWorld,n)+dawnLight(vWorld,n));
    gl_FragColor=vec4(applyFog(col,vWorld),1.0);}`;

/** Small sheltered passages, rime-covered rock strata and loose powder in the winter hillside. */
export class SleepingTrail {
  readonly objects: THREE.Object3D[] = [];
  readonly snowTarget = SNOW_AT.clone().add(new THREE.Vector3(0, tuning.sleeping.snowDepth + 0.3, 0));
  /** Where strokes part the fog: just uphill of the bird, so even a narrow screen shows it beside the bird. */
  readonly mistTarget = alongRoute(SLEEP_FOG_STOP, 1.4).add(new THREE.Vector3(0, 1.15, 0));
  interaction: 'snow' | 'mist' | null = null;
  snow = 0;
  readonly drift = new SleepingDrift();
  get snowReady(): boolean { return this.drift.swept.value > .997; }
  private readonly brushAt = new THREE.Vector3();
  private readonly brushRay = new THREE.Raycaster();
  private readonly brushNdc = new THREE.Vector2();
  mist = 0;
  fogEnclosure = 1;
  /** The fog thinning downhill by itself for a moment, 0..1. */
  glimpse = 0;
  /** The window's glow lost in the fog, 0 seen to 1 gone. */
  windowLost = 0;
  private readonly closing = { glimpse: 0, lost: 0 };
  private readonly clear = { value: 0 };
  private readonly clock = { value: 0 };
  private readonly thaw = this.drift.thaw;
  private readonly gust = {value:0};
  guideActive = false;
  readonly guideAt = new THREE.Vector3();
  readonly guideGoal = new THREE.Vector3();
  private guideFade = 0;
  private readonly traces = new RibbonBatch(64, '#e3e9e5', 1, false, 0.5);
  private readonly wisps: Ribbon[] = [0,1].map(()=>({points:Array.from({length:28},()=>new THREE.Vector3()),alpha:0,width:0.075}));

  constructor() {
    this.objects.push(sleepingBirches());
    const rand=mulberry32(41079), parts: THREE.BufferGeometry[]=[];
    const add=(g: THREE.BufferGeometry,color: string, snow = 0) => {
      const p=g.index?g.toNonIndexed():g,c=new THREE.Color(color), a=new Float32Array(p.attributes.position.count*3);
      for(let i=0;i<a.length;i+=3)a.set([c.r,c.g,c.b],i);
      p.setAttribute('aSnow',new THREE.BufferAttribute(new Float32Array(p.attributes.position.count).fill(snow),1));
      p.deleteAttribute('uv');p.computeVertexNormals();p.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(p);
    };
    // Sparse dried seed heads and snowdrops form clusters, not a uniform scatter over the lawn.
    for(let i=0;i<130;i++){
      const route=point(1+Math.floor(rand()*(SLEEP_PATH.length-2))),a=rand()*Math.PI*2,r=2.3+rand()*3.2;
      const x=route.x+Math.cos(a)*r,z=route.z+Math.sin(a)*r;
      if(sleepPathAt(x,z).distance<1.6)continue;
      const y=heightAt(x,z),h=.24+rand()*.44;
      add(new THREE.CylinderGeometry(.009,.015,h,4).rotateZ(.18).translate(x,y+h*.5,z),'#817e71');
      add(new THREE.IcosahedronGeometry(.055,0).scale(.65,1.8,.65).translate(x-.06,y+h,z),'#dad6bb');
    }
    // Small closed flowers near the room open into the light that finally reaches the bed.
    const petals:THREE.BufferGeometry[]=[];
    const flowerClumps=[[-181,-1913],[-179,-1907],[-185,-1927],[-165,-1930]];
    for(let i=0;i<64;i++){
      const clump=flowerClumps[Math.floor(i/16)],a=rand()*Math.PI*2,radius=Math.sqrt(rand())*1.15;
      const x=clump[0]+Math.cos(a)*radius,z=clump[1]+Math.sin(a)*radius;
      if(sleepPathAt(x,z).distance<1.8)continue;
      const y=heightAt(x,z),h=.19+rand()*.13;
      add(new THREE.CylinderGeometry(.008,.012,h,4).translate(x,y+h/2,z),'#627664');
      // Three long drooping outer petals, with narrow leaves, read as snowdrops rather than white stakes.
      for(let leaf=0;leaf<2;leaf++){
        const yaw=rand()*Math.PI*2;
        add(new THREE.SphereGeometry(1,5,4).scale(.022,h*.85,.009).rotateZ(.3+leaf*.4).rotateY(yaw).translate(x,y+h*.55,z),'#547455');
      }
      for(let petal=0;petal<3;petal++){
        const angle=petal*Math.PI*2/3;
        const g=new THREE.SphereGeometry(.055,7,5).scale(.5,1.65,.65).rotateX(.22)
          .rotateY(angle).translate(x+Math.sin(angle)*.045,y+h-.055,z+Math.cos(angle)*.045);
        const centre=new Float32Array(g.attributes.position.count*3);
        for(let v=0;v<centre.length;v+=3)centre.set([x,y+h,z],v);
        g.setAttribute('aCentre',new THREE.BufferAttribute(centre,3));petals.push(g);
      }
    }
    const flowers=new THREE.Mesh(mergeGeometries(petals),new THREE.ShaderMaterial({uniforms:{...atmo.uniforms},
      vertexShader:`${ATMO_GLSL}
        in vec3 aCentre;out vec3 vWorld;out vec3 vNormal;
        void main(){float warm=morningAt(aCentre.xz);vWorld=position;
          vWorld.xz=aCentre.xz+(position.xz-aCentre.xz)*mix(.72,1.3,warm);
          vWorld.y-=warm*.025;vNormal=normal;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
      fragmentShader:`${ATMO_GLSL}
        in vec3 vWorld;in vec3 vNormal;
        void main(){vec3 n=normalize(vNormal);vec3 col=vec3(.85,.88,.81)*(hemiLight(n)+uSunColor*max(.1,dot(n,uSunDir))*.65+lampLight(vWorld,n)+dawnLight(vWorld,n));
          gl_FragColor=vec4(applyFog(col,vWorld),1.0);}`,
    }));flowers.frustumCulled=false;this.objects.push(flowers);
    const scenery=new THREE.Mesh(mergeGeometries(parts),new THREE.ShaderMaterial({uniforms:{...atmo.uniforms},vertexShader:VERT,fragmentShader:FRAG}));
    scenery.frustumCulled=false;this.objects.push(scenery);

    this.objects.push(...this.drift.objects);

    // The bank is integrated by atmosphere.hollowDensity in every material, without intersecting fog cards.
    this.objects.push(this.traces.mesh);
  }

  /** Reach the visible obstruction, including its low front and shoulders, instead of a tiny floating hotspot. */
  brush(camera: THREE.Camera,input: PointerInput,dt:number):number|null {
    if (!this.interaction) return null;
    if(input.muted || !input.present || dt<=0) return 0;
    const aspect=(camera as THREE.PerspectiveCamera).aspect;
    const travel=Math.hypot((input.ndc.x-input.prevNdc.x)*aspect,input.ndc.y-input.prevNdc.y);
    if(travel<tuning.wood.brushTravelMin)return 0;
    let hit=0;
    if(this.interaction==='snow') {
      // Ray-march the same displaced surface the snow shader draws. The first ground hit wins,
      // so gestures cannot reach a hidden bank through the hill or a hotspot projected into sky.
      for(const fraction of [0,.5,1]) {
        this.brushNdc.lerpVectors(input.prevNdc,input.ndc,fraction);
        this.brushRay.setFromCamera(this.brushNdc,camera);
        for(let distance=.2;distance<55;) {
          this.brushRay.ray.at(distance,this.brushAt);
          const depth=this.snowDepthAt(this.brushAt.x,this.brushAt.z);
          const gap=this.brushAt.y-heightAt(this.brushAt.x,this.brushAt.z)-depth;
          if(gap<.035) {if(depth>.025)hit=1;break;}
          distance+=THREE.MathUtils.clamp(gap*.35,.12,1.5);
        }
      }
      // The feather hanging just above the crest remains a forgiving invitation too.
      hit=Math.max(hit,screenBrush(camera,this.snowTarget,input.prevNdc,input.ndc,tuning.sleeping.snowBrushRadius));
      if(hit>0)this.drift.strokeOver(camera,input.prevNdc,input.ndc);
    } else hit=screenBrush(camera,this.mistTarget,input.prevNdc,input.ndc,tuning.sleeping.mistBrushRadius);
    return Math.sqrt(hit)*Math.min(travel,tuning.wood.brushStepMax)/dt;
  }

  /** Same displaced surface as the snow shader, for feet/clearance verification. */
  snowDepthAt(x:number,z:number):number { return this.drift.depthAt(x,z); }

  update(dt: number, time: number, dawn: number, camera: THREE.Camera, cold = 0): void {
    this.clock.value=time;
    this.gust.value=sleepingGust(time,cold,dawn);
    this.clear.value+=(this.mist-this.clear.value)*(1-Math.exp(-dt*1.6));
    this.drift.update(dt,time,this.snow,THREE.MathUtils.smoothstep(dawn,0.12,0.85),this.gust.value);
    const beyond=(this.guideAt.x-MIST_AT.x)*MIST_FORWARD.x+(this.guideAt.z-MIST_AT.z)*MIST_FORWARD.z;
    const emerged=THREE.MathUtils.smoothstep(beyond,2.4,7);
    this.fogEnclosure=1-emerged;
    const c=this.closing,t=tuning.sleeping;
    c.glimpse+=(this.glimpse-c.glimpse)*(1-Math.exp(-dt/t.mistGlimpseEase));
    c.lost+=(this.windowLost-c.lost)*(1-Math.exp(-dt/t.mistWindowEase));
    WINDOW_SEEN.value=1-c.lost;
    atmo.uniforms.uSleepLost.value=c.lost;
    atmo.uniforms.uSleepMist.value.set(MIST_AT.x,MIST_AT.y+1.1-emerged*3,MIST_AT.z,
      (1-this.thaw.value)*(1-emerged*.94)*(1-c.glimpse*t.mistGlimpseThins)*(1+c.lost*(t.mistBankCloses-1)));
    atmo.uniforms.uSleepMistPart.value=this.clear.value;
    atmo.uniforms.uSleepMistAxis.value.set(MIST_FORWARD.z,-MIST_FORWARD.x);
    this.guideFade+=((this.guideActive?1:0)-this.guideFade)*(1-Math.exp(-dt*2));
    const dx=this.guideGoal.x-this.guideAt.x,dz=this.guideGoal.z-this.guideAt.z,len=Math.hypot(dx,dz)||1;
    for(let i=0;i<this.wisps.length;i++){
      const w=this.wisps[i],phase=((time+i*2.8)%5.6)/5.6;
      w.alpha=Math.sin(phase*Math.PI)**2*this.guideFade*(this.interaction==='mist'?.8:.4)*THREE.MathUtils.smoothstep(len,.4,1.4);
      for(let j=0;j<w.points.length;j++){
        const t=j/(w.points.length-1),along=Math.min(len,0.3+phase*Math.min(3.5,len)+t*1.4);
        const curl=Math.sin(t*Math.PI*1.5+time*.4)*.15;
        const x=this.guideAt.x+dx/len*along-dz/len*curl,z=this.guideAt.z+dz/len*along+dx/len*curl;
        // Skimming over the drift rather than through it, where it would flicker in and out of the snow.
        const over=heightAt(x,z)+this.snowDepthAt(x,z)+.3;
        w.points[j].set(x,Math.max(over,THREE.MathUtils.lerp(this.guideAt.y,this.guideGoal.y,Math.min(1,along/len))+.5+Math.sin(t*Math.PI)*.18),z);
      }
    }
    this.traces.update(this.wisps);
  }
}
