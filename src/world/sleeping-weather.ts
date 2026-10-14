import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { MIST_AT, WINDOW_SEEN } from './sleeping-trail';
import { NIGHT_WIND, sleepingGust } from './sleeping-wind';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';

const SNOW_BOX = new THREE.Vector3(36, 20, 36);

/**
 * The night's snow, in a box that travels with the lens. Down by the bed it falls; out on the hill it thickens and
 * the wind takes it, until on the crest it drives past sideways. Each flake is drawn along the way it moved over a
 * short exposure, so a still flake is a soft dot and a driven one a streak.
 */
class Snowfall {
  readonly mesh: THREE.Mesh;
  private readonly offset = { value: new THREE.Vector3() };
  private readonly velocity = { value: new THREE.Vector3() };
  private readonly origin = { value: new THREE.Vector3() };
  private readonly gust = { value: 0 };
  private readonly clock = { value: 0 };
  private readonly shutter = { value: 0 };
  private readonly show = { value: 0 };
  private readonly thaw = { value: 0 };
  private readonly near = { value: 0 };
  private readonly pixel = { value: 0 };
  private readonly heading = new THREE.Vector2();
  private readonly view = new THREE.Vector3();
  private last = -1;
  constructor() {
    const t = tuning.sleeping, count = Math.round(t.snowCount * t.snowThicken), rand = mulberry32(52203);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i += 4) seeds.set([rand() * SNOW_BOX.x, rand() * SNOW_BOX.y, rand() * SNOW_BOX.z, rand()], i);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    const [nearFrom, nearTo] = t.lineNearFade;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uOffset: this.offset, uVel: this.velocity, uSnowOrigin: this.origin, uGust: this.gust, uClock: this.clock,
        uShutter: this.shutter, uShow: this.show, uThaw: this.thaw, uNear: this.near, uPixel: this.pixel },
      transparent: true, depthWrite: false,
      vertexShader: `uniform float uGust,uClock,uShutter,uShow,uThaw,uNear,uPixel;uniform vec3 uOffset,uVel,uSnowOrigin;
        in vec4 aSeed;out vec3 vWorld;out vec2 vAt;out float vHalf,vAlpha;
        const vec3 BOX=vec3(${SNOW_BOX.x.toFixed(1)},${SNOW_BOX.y.toFixed(1)},${SNOW_BOX.z.toFixed(1)});
        void main(){
          vWorld=uSnowOrigin-BOX*.5+mod(aSeed.xyz+uOffset-uSnowOrigin,BOX);
          vWorld.x+=sin(uClock*1.2+aSeed.z)*(.24+uGust*.6);
          vec4 head=viewMatrix*vec4(vWorld,1.0),tail=viewMatrix*vec4(vWorld-uVel*uShutter,1.0);
          tail.z=min(tail.z,-.05);
          vec4 h=projectionMatrix*head,t=projectionMatrix*tail;
          vec2 squash=vec2(projectionMatrix[1][1]/projectionMatrix[0][0],1.0);
          vec2 a=h.xy/h.w*squash,b=t.xy/t.w*squash,d=a-b;
          float len=length(d);vec2 along=len>1e-6?d/len:vec2(1.0,0.0),across=vec2(-along.y,along.x);
          float r=clamp((45.0+uGust*12.0)/max(1.0,-head.z),1.0,4.0)*.5*uPixel,span=len*.5;
          vec2 at=(a+b)*.5+along*position.x*(span+r)+across*position.y*r;
          gl_Position=vec4(at/squash*h.w,h.z,h.w);
          vAt=vec2(position.x*(span+r),position.y*r)/r;vHalf=span/r;
          float d0=${nearFrom.toFixed(2)},d1=${nearTo.toFixed(2)};
          float near=mix(1.0,smoothstep(d0,d1,length(head.xyz)),uNear);
          float dim=1.0/(1.0+${t.snowStreakDim.toFixed(3)}*vHalf);
          vAlpha=.8*(1.0-uThaw)*smoothstep(aSeed.w,aSeed.w+.08/${t.snowThicken.toFixed(2)},uShow)*near*dim*step(0.0,h.w);}`,
      fragmentShader: `${ATMO_GLSL} in vec3 vWorld;in vec2 vAt;in float vHalf,vAlpha;
        void main(){float a=(1.0-smoothstep(.3,1.0,length(vec2(max(abs(vAt.x)-vHalf,0.0),vAt.y))))*vAlpha;if(a<.004)discard;
          vec3 col=hemiLight(vec3(0,1,0))*1.8+lampLight(vWorld,vec3(0,1,0));
          gl_FragColor=vec4(applyFog(col,vWorld),a);}`,
    }));
    this.mesh.frustumCulled = false;
    const size = new THREE.Vector2();
    this.mesh.onBeforeRender = (renderer) => {
      const target = renderer.getRenderTarget();
      this.pixel.value = 2 / (target ? target.height : renderer.getDrawingBufferSize(size).y);
    };
  }

  update(time: number, cold: number, dawn: number, camera: THREE.Camera): void {
    const t = tuning.sleeping, rise = NIGHT_WIND.rise;
    const dt = this.last < 0 ? 0 : THREE.MathUtils.clamp(time - this.last, 0, .1);
    this.last = time;
    const gust = sleepingGust(time, cold, dawn), lost = atmo.uniforms.uSleepLost.value;
    // In the white of the fog the snow lightens and only swirls, so the moment the window goes stays clean.
    const fog = 1 - t.snowFogCalms * lost;
    const speed = (.22 + cold * 1.8 + gust * 8) * (1 + (t.snowDrive - 1) * rise ** 1.5 * fog);
    // Blown straight at or away from the lens a driven flake only grows out of the middle of the frame, so it is led
    // across the view instead, as it would be seen from beside it.
    camera.getWorldDirection(this.view);
    const look = Math.hypot(this.view.x, this.view.z) || 1, lx = this.view.x / look, lz = this.view.z / look;
    this.heading.set(1, 0).lerp(NIGHT_WIND.toward, rise).normalize();
    const along = (this.heading.x * lx + this.heading.y * lz) * t.snowAcross * rise;
    this.heading.set(this.heading.x - along * lx, this.heading.y - along * lz).normalize();
    this.velocity.value.set(this.heading.x * speed, -t.snowFall * (1 + cold + gust), this.heading.y * speed + .3);
    const o = this.offset.value.addScaledVector(this.velocity.value, dt);
    o.set(o.x % SNOW_BOX.x, o.y % SNOW_BOX.y, o.z % SNOW_BOX.z);
    this.origin.value.copy(camera.position);
    this.gust.value = gust;
    this.clock.value = time;
    this.shutter.value = t.snowShutter * rise * rise * fog;
    this.show.value = cold / t.snowThicken * (1 + (t.snowThicken - 1) * rise ** 1.2 * fog);
    this.near.value = THREE.MathUtils.smoothstep(rise, 0, .25);
    this.thaw.value = THREE.MathUtils.smoothstep(dawn, .12, .85);
    this.mesh.visible = dawn < .85;
  }
}

/** Breath and small sleep marks belong to the child; the approaching weather encloses the camera. */
export class SleepingWeather {
  readonly objects: THREE.Object3D[] = [];
  private readonly clock = {value:0};
  private readonly cold = {value:0};
  private readonly sleep = {value:0};
  private readonly quiet = {value:0};
  private readonly face = {value:new THREE.Vector3()};
  private readonly veil = {value:0};
  private readonly part = {value:0};
  private readonly beacon = {value:new THREE.Vector3()};
  private readonly fogMaterial: THREE.ShaderMaterial;
  private readonly snow = new Snowfall();
  constructor() {
    this.objects.push(this.snow.mesh);
    const breathGeo=new THREE.BufferGeometry();
    breathGeo.setAttribute('position',new THREE.Float32BufferAttribute(Array.from({length:24},(_,i)=>[i/24,0,0]).flat(),3));
    const breath=new THREE.Points(breathGeo,new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uClock:this.clock,uCold:this.cold,uSleep:this.sleep,uFace:this.face},
      transparent:true,depthWrite:false,
      vertexShader:`uniform float uClock,uCold,uSleep;uniform vec3 uFace;out float vAlpha;
        void main(){float age=mod(uClock+position.x*.65,4.2);float life=clamp(age/1.9,0.0,1.0);
          vec3 p=uFace+vec3(-.06-life*.38,.06+life*.32,life*.18);
          vec4 view=viewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((5.0+life*32.0)*12.0/max(1.0,-view.z),2.0,42.0);
          vAlpha=sin(life*3.14159)*uCold*uSleep*.075;}`,
      fragmentShader:`in float vAlpha;void main(){float a=1.0-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.66,.75,.82,a*vAlpha);}`,
    }));breath.frustumCulled=false;this.objects.push(breath);
    for(let i=0;i<3;i++){
      const mark=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
        uniforms:{uClock:this.clock,uSleep:this.quiet,uFace:this.face,uIndex:{value:i}},transparent:true,depthWrite:false,
        vertexShader:`uniform float uClock,uSleep,uIndex;uniform vec3 uFace;out vec2 vUv;out float vAlpha;
          void main(){float age=fract(uClock/5.5+uIndex/3.0);vec4 view=viewMatrix*vec4(uFace,1.0);
            view.xy+=vec2(.18+age*.32,.30+age*.85)+position.xy*(.12+age*.07);
            gl_Position=projectionMatrix*view;vUv=uv;vAlpha=sin(age*3.14159)*uSleep*.45;}`,
        fragmentShader:`in vec2 vUv;in float vAlpha;
          float line(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
          void main(){float d=min(line(vUv,vec2(.2,.8),vec2(.8,.8)),min(line(vUv,vec2(.8,.8),vec2(.2,.2)),line(vUv,vec2(.2,.2),vec2(.8,.2))));
            gl_FragColor=vec4(.70,.77,.79,(1.0-smoothstep(.035,.075,d))*vAlpha);}`,
      }));mark.frustumCulled=false;this.objects.push(mark);
    }
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uBeacon:this.beacon,uCold:this.cold,uSeen:WINDOW_SEEN},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`uniform vec3 uBeacon;out vec2 vUv;void main(){vec4 view=viewMatrix*vec4(uBeacon,1.0);view.xy+=position.xy;gl_Position=projectionMatrix*view;vUv=uv;}`,
      fragmentShader:`${ATMO_GLSL} uniform vec3 uBeacon;uniform float uCold,uSeen;in vec2 vUv;void main(){float r=length((vUv-.5)*2.0);float a=exp(-r*r*8.0)*(1.0-smoothstep(.6,1.0,r))*(1.0-journeyVeilAt(uBeacon))*uSeen;gl_FragColor=vec4(1.0,.63,.27,a*(.12+uCold*.13));}`,
    }));glow.frustumCulled=false;glow.renderOrder=13;this.objects.push(glow);
    this.fogMaterial=new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uSleepVeil:this.veil,uPart:this.part},transparent:true,depthWrite:false,depthTest:false,
      vertexShader:`out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:`${ATMO_GLSL} uniform float uSleepVeil,uPart;in vec2 vUv;
        void main(){vec2 uv=vUv;
          uv.x-=clamp((uv.x-.5)*8.0,-1.0,1.0)*uPart*.38;uv+=vec2(uTime*.009,uTime*.004);
          float n=fbm(uv*vec2(4.0,3.0))*.65+fbm(uv*9.0)*.35;
          float rim=smoothstep(.12,.52,length((vUv-.5)*vec2(1.15,1.0)));
          float bankEdge=abs(vUv.x-.5+.035*sin(vUv.y*9.0+uTime*.12)+.025*sin(vUv.y*23.0-uTime*.08));
          float opening=1.0-uPart*(1.0-smoothstep(.10,.49,bankEdge));
          opening*=.55+rim*1.0;
          vec3 tint=vec3(.20,.26,.33);gl_FragColor=vec4(tint,uSleepVeil*(.35+n*.65)*opening);}`,
    });
    const fog=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.fogMaterial);fog.frustumCulled=false;fog.renderOrder=12;this.objects.push(fog);
  }
  update(time:number,cold:number,sleep:number,dawn:number,face:THREE.Vector3,camera:THREE.Camera,part:number,beacon:THREE.Vector3,quiet:number,enclosure=1):void {
    this.snow.update(time, cold, dawn, camera);
    this.beacon.value.copy(beacon);
    this.quiet.value=sleep*THREE.MathUtils.smoothstep(quiet,.8,1);
    this.clock.value=time;this.cold.value=THREE.MathUtils.smoothstep(cold,.18,.55)*(1-dawn);this.sleep.value=sleep;
    this.face.value.copy(face);
    const near=1-THREE.MathUtils.smoothstep(camera.position.distanceTo(MIST_AT),8,28);
    this.veil.value=cold*(1-dawn)*(.10+near*.65)*enclosure;
    // A zero veil blends to nothing. The material flag, not the mesh's, since the room system owns that one.
    this.fogMaterial.visible=this.veil.value!==0;
    this.part.value=part;
  }
}
