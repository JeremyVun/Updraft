import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { MIST_AT } from './sleeping-trail';

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
  constructor() {
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
      uniforms:{...atmo.uniforms,uBeacon:this.beacon,uCold:this.cold},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`uniform vec3 uBeacon;out vec2 vUv;void main(){vec4 view=viewMatrix*vec4(uBeacon,1.0);view.xy+=position.xy;gl_Position=projectionMatrix*view;vUv=uv;}`,
      fragmentShader:`${ATMO_GLSL} uniform vec3 uBeacon;uniform float uCold;in vec2 vUv;void main(){float r=length((vUv-.5)*2.0);float a=exp(-r*r*8.0)*(1.0-smoothstep(.6,1.0,r))*(1.0-journeyVeilAt(uBeacon));gl_FragColor=vec4(1.0,.63,.27,a*(.12+uCold*.13));}`,
    }));glow.frustumCulled=false;glow.renderOrder=13;this.objects.push(glow);
    const fog=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:{...atmo.uniforms,uSleepVeil:this.veil,uPart:this.part},transparent:true,depthWrite:false,depthTest:false,
      vertexShader:`out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:`${ATMO_GLSL} uniform float uSleepVeil,uPart;in vec2 vUv;
        void main(){vec2 uv=vUv;float side=sign(uv.x-.5);
          uv.x-=side*uPart*.38;uv+=vec2(uTime*.009,uTime*.004);
          float n=fbm(uv*vec2(4.0,3.0))*.65+fbm(uv*9.0)*.35;
          float rim=smoothstep(.12,.52,length((vUv-.5)*vec2(1.15,1.0)));
          float bankEdge=abs(vUv.x-.5+.035*sin(vUv.y*9.0+uTime*.12)+.025*sin(vUv.y*23.0-uTime*.08));
          float opening=1.0-uPart*(1.0-smoothstep(.10,.49,bankEdge));
          opening*=.55+rim*1.0;
          vec3 tint=vec3(.20,.26,.33);gl_FragColor=vec4(tint,uSleepVeil*(.35+n*.65)*opening);}`,
    }));fog.frustumCulled=false;fog.renderOrder=12;this.objects.push(fog);
  }
  update(time:number,cold:number,sleep:number,dawn:number,face:THREE.Vector3,camera:THREE.Camera,part:number,beacon:THREE.Vector3,quiet:number,enclosure=1):void {
    this.beacon.value.copy(beacon);
    this.quiet.value=sleep*THREE.MathUtils.smoothstep(quiet,.8,1);
    this.clock.value=time;this.cold.value=THREE.MathUtils.smoothstep(cold,.18,.55)*(1-dawn);this.sleep.value=sleep;
    this.face.value.copy(face);
    const near=1-THREE.MathUtils.smoothstep(camera.position.distanceTo(MIST_AT),8,28);
    this.veil.value=cold*(1-dawn)*(.10+near*.65)*enclosure;
    this.part.value=part;
  }
}
