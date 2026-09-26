import * as THREE from 'three';
import { sleepingGust } from './sleeping-wind';
import { sleepingBirches } from './sleeping-birches';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, NOISE_GRAD_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { SLEEP_PATH, SLEEP_SNOW_STOP, SLEEP_MIST_STOP, sleepPathAt } from './sleeping-layout';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from '../fx/ribbons';

const point = (i: number) => new THREE.Vector3(SLEEP_PATH[i][0], heightAt(SLEEP_PATH[i][0], SLEEP_PATH[i][1]), SLEEP_PATH[i][1]);
export const SNOW_AT = point(SLEEP_SNOW_STOP).lerp(point(SLEEP_SNOW_STOP+1), 0.8);
SNOW_AT.y = heightAt(SNOW_AT.x, SNOW_AT.z);
export const MIST_AT = point(SLEEP_MIST_STOP).lerp(point(SLEEP_MIST_STOP+1), 0.48);
MIST_AT.y = heightAt(MIST_AT.x, MIST_AT.z);
const SNOW_FORWARD = point(SLEEP_SNOW_STOP+1).sub(point(SLEEP_SNOW_STOP)).setY(0).normalize();
const MIST_FORWARD = point(SLEEP_MIST_STOP+1).sub(point(SLEEP_MIST_STOP)).setY(0).normalize();
const SNOW_RIGHT = new THREE.Vector3(-SNOW_FORWARD.z, 0, SNOW_FORWARD.x);
/** How deeply the wind scoops and ridges the drift's thick middle, as a share of its depth; the thin edges keep their shape. */
const SNOW_SCULPT = 0.24;

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
  readonly snowTarget = SNOW_AT.clone().add(new THREE.Vector3(0, tuning.sleeping.snowDepth + 0.65, 0));
  readonly mistTarget = MIST_AT.clone().add(new THREE.Vector3(0, 1.15, 0));
  interaction: 'snow' | 'mist' | null = null;
  snow = 0;
  get snowReady(): boolean { return this.swept.value > .997; }
  private readonly brushAt = new THREE.Vector3();
  private readonly brushRay = new THREE.Raycaster();
  private readonly brushNdc = new THREE.Vector2();
  mist = 0;
  fogEnclosure = 1;
  private readonly swept = { value: 0 };
  private readonly blow = { value: 0 };
  private readonly clear = { value: 0 };
  private readonly clock = { value: 0 };
  private readonly thaw = { value: 0 };
  private readonly flakes: THREE.Points;
  private readonly weather = {value:0};
  private readonly snowDrift = {value:0};
  private readonly snowfall = {value:0};
  private readonly gust = {value:0};
  private readonly snowOrigin = {value:new THREE.Vector3()};
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
    // Exposed geology belongs to the hillside, never to two kerbs marking the route.
    // Unequal, half-buried clusters leave the bed terrace and long stretches of turf open.
    const exposures=[[-185,-1928,1.1],[-154,-1935,1.7],
      [-159,-1944,2.1],[-172,-1949,1.8],[-186,-1945,2.7],[-168,-1932,1.2]];
    for(const [cx,cz,size] of exposures){
      const yaw=rand()*Math.PI;
      for(let j=0;j<2+Math.floor(rand()*3);j++){
        const x=cx+(rand()-.5)*size*1.8,z=cz+(rand()-.5)*size;
        if(sleepPathAt(x,z).distance<2.6)continue;
        const y=heightAt(x,z),scale=size*(.4+rand()*.7);
        const rock=new THREE.DodecahedronGeometry(1,0);
        rock.scale(scale,scale*(.6+rand()*.5),scale*.65);
        rock.rotateY(yaw+rand()*.25);rock.rotateZ(-.2+rand()*.15);
        rock.translate(x,y-scale*.45,z);
        add(rock,j%2?'#596376':'#687082');
        const drift=new THREE.IcosahedronGeometry(1,2).scale(scale*.7,.13,scale*.48).rotateY(yaw);
        const vertices=drift.attributes.position;
        for(let v=0;v<vertices.count;v++){
          const px=x+.4+vertices.getX(v),pz=z+.5+vertices.getZ(v);
          vertices.setXYZ(v,px,heightAt(px,pz)+.02+vertices.getY(v),pz);
        }
        drift.computeVertexNormals();add(drift,'#c3cbd0',1);
      }
    }
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

    // Snow follows the real ground. Sweeping excavates a widening channel rather than lifting a white lid.
    const driftGeometry=new THREE.PlaneGeometry(23,6.5,144,64);
    const vertices=driftGeometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      const p=SNOW_AT.clone().addScaledVector(SNOW_RIGHT,vertices.getX(i)).addScaledVector(SNOW_FORWARD,vertices.getY(i));
      vertices.setXYZ(i,p.x,heightAt(p.x,p.z)+.012,p.z);
    }
    driftGeometry.computeVertexNormals();
    const snow=new THREE.Mesh(driftGeometry,new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uSwept:this.swept,uThaw:this.thaw,uGust:this.gust,uSnowRight:{value:SNOW_RIGHT},uSnowForward:{value:SNOW_FORWARD}},
      side:THREE.DoubleSide,transparent:true,
      vertexShader:`uniform float uSwept,uThaw;uniform vec3 uSnowRight,uSnowForward;
        out vec3 vWorld;out vec3 vNormal;out float vDepth;
        float passageDistance(vec2 local) {
          vec2 p=vec2(${SNOW_AT.x.toFixed(5)},${SNOW_AT.z.toFixed(5)})+uSnowRight.xz*local.x+uSnowForward.xz*local.y;
          float d=1000.0;
          ${SLEEP_PATH.slice(2,7).map((a,i)=>{const b=SLEEP_PATH[i+3];return `{
            vec2 a=vec2(${a[0].toFixed(5)},${a[1].toFixed(5)}),b=vec2(${b[0].toFixed(5)},${b[1].toFixed(5)});
            vec2 ab=b-a;float t=clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0);d=min(d,length(p-a-ab*t));}`;}).join('')}
          return d;
        }
        float depthAt(vec2 local){
          vec2 drift=local+vec2(.35*sin(local.y*1.2),.25*sin(local.x*.65));
          float bank=pow(max(0.0,1.0-dot(drift/vec2(11.5,3.25),drift/vec2(11.5,3.25))),1.6);
          float channel=1.0-smoothstep(.55+uSwept*1.65,1.25+uSwept*1.65,passageDistance(local));
          float crest=1.0+.12*sin(local.x*1.7)+.06*sin(local.y*3.5+local.x);
          float depth=${tuning.sleeping.snowDepth.toFixed(2)}*bank*crest*(1.0-uSwept*channel)*(1.0-uThaw);
          float sculpt=.5*sin(local.x*.83+1.4*sin(local.y*.9+local.x*.31))+.3*sin(local.x*2.1+local.y*1.3+2.0*sin(local.x*.47));
          return depth*(1.0+${SNOW_SCULPT}*sculpt*smoothstep(.2,.7,depth));
        }
        void main(){vec2 local=(uv-.5)*vec2(23.0,6.5);vDepth=depthAt(local);
          vec2 slope=vec2(depthAt(local+vec2(.06,0))-depthAt(local-vec2(.06,0)),
            depthAt(local+vec2(0,.06))-depthAt(local-vec2(0,.06)))/.12;
          vec2 gradient=uSnowRight.xz*slope.x+uSnowForward.xz*slope.y;
          vec3 ground=normal.y<0.0?-normal:normal;
          vNormal=normalize(vec3(ground.x-gradient.x*ground.y,ground.y,ground.z-gradient.y*ground.y));
          vWorld=position;vWorld.y+=vDepth;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
      fragmentShader:`${ATMO_GLSL}
        ${NOISE_GRAD_GLSL}
        uniform float uGust;uniform vec3 uSnowRight,uSnowForward;
        in vec3 vWorld;in vec3 vNormal;in float vDepth;
        void main(){
          vec2 xz=vWorld.xz,dx=dFdx(xz),dy=dFdy(xz);float pixel=max(length(dx),length(dy));
          if(vDepth<.004)discard;
          // Thin snow lies in patches, so the rim wanders in and out instead of tracing the drift's outline.
          float patches=vnoise(xz*.42+3.7)*.5+vnoise(xz*1.3)*.3+vnoise(xz*3.9)*.2;
          float cover=smoothstep(.05,.24,vDepth*(.3+1.4*patches));
          if(cover<.01)discard;
          // Carved by the wind: long soft ridges down the drift, fine powder over them, resolved only while a pixel is smaller.
          vec2 local=vec2(dot(xz,uSnowRight.xz),dot(xz,uSnowForward.xz));
          vec3 ridge=vnoiseGrad(local*vec2(.32,1.05));
          vec3 powder=vnoiseGrad(xz*4.2)*(1.0-smoothstep(.02,.06,pixel));
          vec2 carve=(uSnowRight.xz*ridge.y*.32+uSnowForward.xz*ridge.z*1.05)*.3+powder.yz*.008;
          vec3 n=normalize(normalize(vNormal)-vec3(carve.x,0.0,carve.y)*smoothstep(.02,.3,vDepth));
          float ndl=dot(n,uSunDir),sun=max(0.0,ndl)*cloudShadow(xz);
          // Light soaks into snow, so faces turned away go blue rather than grey.
          vec3 base=mix(vec3(.62,.74,.90),vec3(.86,.9,.94),smoothstep(-.25,.45,ndl));
          vec3 col=base*(hemiLight(n)*(.8+.45*max(0.0,n.y))+uSunColor*(sun*.75+clamp(ndl*.5+.3,0.0,1.0)*.12)+lampLight(vWorld,n)+dawnLight(vWorld,n));
          // Where it thins over the turf it takes the ground's shade.
          col*=mix(.78,1.0,smoothstep(.02,.45,vDepth));
          // Spindrift: faint streaks of blown powder crossing the surface on the gusts.
          float blown=smoothstep(.62,.95,vnoise(vec2(local.x*.55-uTime*(.9+uGust*2.5),local.y*2.6+ridge.x*1.5)));
          col+=hemiLight(vec3(0,1,0))*blown*(.05+.12*uGust)*cover;
          // Crystals catch the light one at a time as the eye moves; too small to show once they would shimmer.
          vec2 cell=floor(xz*26.0);vec3 V=normalize(cameraPosition-vWorld);
          float facet=hash12(cell+floor(V.xz*7.0+V.y*5.0)*17.0);
          // Sparse, and gathered where the wind has polished the crust rather than spread evenly.
          float polished=smoothstep(.45,.85,vnoise(xz*.55+9.1));
          float fleck=step(mix(.9985,.993,polished),facet)*(1.0-smoothstep(.13,.34,length(fract(xz*26.0)-.5)))*(1.0-smoothstep(.012,.028,pixel));
          col+=(uSunColor*1.5+uSkyAmbient*.7)*fleck*(.45+.55*hash12(cell+3.1))*max(.25,sun)*cover;
          gl_FragColor=vec4(applyFog(col,vWorld),cover*smoothstep(.004,.12,vDepth));}`,
    }));snow.frustumCulled=false;this.objects.push(snow);
    const powderGeo=new THREE.BufferGeometry(),powderSeeds=new Float32Array(420*3);
    for(let i=0;i<powderSeeds.length;i++)powderSeeds[i]=rand();
    powderGeo.setAttribute('position',new THREE.BufferAttribute(powderSeeds,3));
    const powder=new THREE.Points(powderGeo,new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uClock:this.clock,uBlow:this.blow,uOrigin:{value:SNOW_AT},uRight:{value:SNOW_RIGHT}},transparent:true,depthWrite:false,
      vertexShader:`uniform float uClock,uBlow;uniform vec3 uOrigin,uRight;out vec3 vWorld;out float vAlpha;
        void main(){float age=fract(position.x+uClock*.65);vWorld=uOrigin+uRight*((position.y-.5)*2.0+age*7.5);
          vWorld.y+=.45+sin(age*3.14159)*1.25;vWorld.z+=(position.z-.5)*2.5;
          vAlpha=sin(age*3.14159)*uBlow;vec4 view=viewMatrix*vec4(vWorld,1.0);gl_Position=projectionMatrix*view;
          gl_PointSize=clamp(90.0/max(1.0,-view.z),2.0,7.0);}`,
      fragmentShader:`${ATMO_GLSL} in vec3 vWorld;in float vAlpha;
        void main(){float a=1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));if(a*vAlpha<.01)discard;
          gl_FragColor=vec4(applyFog(hemiLight(vec3(0,1,0))*1.9+vec3(.28,.34,.4),vWorld),a*vAlpha*.65);}`,
    }));powder.frustumCulled=false;this.objects.push(powder);

    // The bank is integrated by atmosphere.hollowDensity in every material, without intersecting fog cards.
    this.objects.push(this.traces.mesh);
    const geo=new THREE.BufferGeometry(),positions=new Float32Array(tuning.sleeping.snowCount*3);
    for(let i=0;i<positions.length;i+=3)positions.set([rand()*36,rand()*20,rand()*36],i);
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.flakes=new THREE.Points(geo,new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uClock:this.clock,uThaw:this.thaw,uWeather:this.weather,uDrift:this.snowDrift,uFall:this.snowfall,uGust:this.gust,uSnowOrigin:this.snowOrigin},transparent:true,depthWrite:false,
      vertexShader:`uniform float uClock,uWeather,uDrift,uFall,uGust;uniform vec3 uSnowOrigin;out vec3 vWorld;out float vSeed;
        void main(){vSeed=fract(position.x*.713);vWorld=uSnowOrigin+vec3(-18.0+mod(position.x+uDrift-uSnowOrigin.x,36.0),-10.0+mod(position.y-uFall-uSnowOrigin.y,20.0),-18.0+mod(position.z+uClock*.3-uSnowOrigin.z,36.0));
        vWorld.x+=sin(uClock*1.2+position.z)*(.24+uGust*.6);vec4 view=viewMatrix*vec4(vWorld,1.0);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((45.0+uGust*12.0)/max(1.0,-view.z),1.0,4.0);}`,
      fragmentShader:`${ATMO_GLSL}
        uniform float uThaw,uWeather;in vec3 vWorld;in float vSeed;
        void main(){float a=1.0-smoothstep(.15,.5,length(gl_PointCoord-.5));if(a<.01)discard;
        vec3 col=hemiLight(vec3(0,1,0))*1.8+lampLight(vWorld,vec3(0,1,0));
        gl_FragColor=vec4(applyFog(col,vWorld),a*.8*(1.0-uThaw)*smoothstep(vSeed,vSeed+.08,uWeather));}`,
    }));this.flakes.frustumCulled=false;this.objects.push(this.flakes);
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
    } else hit=screenBrush(camera,this.mistTarget,input.prevNdc,input.ndc,tuning.sleeping.mistBrushRadius);
    return Math.sqrt(hit)*Math.min(travel,tuning.wood.brushStepMax)/dt;
  }

  /** Same displaced surface as the snow shader, for feet/clearance verification. */
  snowDepthAt(x:number,z:number):number {
    const dx=x-SNOW_AT.x,dz=z-SNOW_AT.z;
    const lx=dx*SNOW_RIGHT.x+dz*SNOW_RIGHT.z,ly=dx*SNOW_FORWARD.x+dz*SNOW_FORWARD.z;
    const bx=lx+.35*Math.sin(ly*1.2),by=ly+.25*Math.sin(lx*.65);
    const bank=Math.max(0,1-(bx/11.5)**2-(by/3.25)**2)**1.6;
    const s=this.swept.value;
    const channel=1-THREE.MathUtils.smoothstep(sleepPathAt(x,z).distance,.55+s*1.65,1.25+s*1.65);
    const depth=tuning.sleeping.snowDepth*bank*(1+.12*Math.sin(lx*1.7)+.06*Math.sin(ly*3.5+lx))*(1-s*channel)*(1-this.thaw.value);
    const sculpt=.5*Math.sin(lx*.83+1.4*Math.sin(ly*.9+lx*.31))+.3*Math.sin(lx*2.1+ly*1.3+2*Math.sin(lx*.47));
    return depth*(1+SNOW_SCULPT*sculpt*THREE.MathUtils.smoothstep(depth,.2,.7));
  }

  update(dt: number, time: number, dawn: number, camera: THREE.Camera, cold = 0): void {
    this.clock.value=time;
    this.gust.value=sleepingGust(time,cold,dawn);
    this.snowDrift.value+=dt*(.22+cold*1.8+this.gust.value*8);
    this.snowfall.value+=dt*tuning.sleeping.snowFall*(1+cold+this.gust.value);
    this.weather.value=cold;this.snowOrigin.value.copy(camera.position);
    const blowing=Math.min(1,Math.max(0,this.snow-this.swept.value)*9);
    this.blow.value+=(blowing-this.blow.value)*(1-Math.exp(-dt*5));
    this.swept.value+=(this.snow-this.swept.value)*(1-Math.exp(-dt*5));
    this.clear.value+=(this.mist-this.clear.value)*(1-Math.exp(-dt*1.6));
    this.thaw.value=THREE.MathUtils.smoothstep(dawn,0.12,0.85);
    this.flakes.visible=dawn<.85;
    const beyond=(this.guideAt.x-MIST_AT.x)*MIST_FORWARD.x+(this.guideAt.z-MIST_AT.z)*MIST_FORWARD.z;
    const emerged=THREE.MathUtils.smoothstep(beyond,2.4,7);
    this.fogEnclosure=1-emerged;
    atmo.uniforms.uSleepMist.value.set(MIST_AT.x,MIST_AT.y+1.1-emerged*3,MIST_AT.z,(1-this.thaw.value)*(1-emerged*.94));
    atmo.uniforms.uSleepMistPart.value=this.clear.value;
    this.guideFade+=((this.guideActive?1:0)-this.guideFade)*(1-Math.exp(-dt*2));
    const dx=this.guideGoal.x-this.guideAt.x,dz=this.guideGoal.z-this.guideAt.z,len=Math.hypot(dx,dz)||1;
    for(let i=0;i<this.wisps.length;i++){
      const w=this.wisps[i],phase=((time+i*2.8)%5.6)/5.6;
      w.alpha=Math.sin(phase*Math.PI)**2*this.guideFade*(this.interaction==='mist'?.8:.4)*THREE.MathUtils.smoothstep(len,.4,1.4);
      for(let j=0;j<w.points.length;j++){
        const t=j/(w.points.length-1),along=Math.min(len,0.3+phase*Math.min(3.5,len)+t*1.4);
        const curl=Math.sin(t*Math.PI*1.5+time*.4)*.15;
        const x=this.guideAt.x+dx/len*along-dz/len*curl,z=this.guideAt.z+dz/len*along+dx/len*curl;
        w.points[j].set(x,THREE.MathUtils.lerp(this.guideAt.y,this.guideGoal.y,Math.min(1,along/len))+.5+Math.sin(t*Math.PI)*.18,z);
      }
    }
    this.traces.update(this.wisps);
  }
}
