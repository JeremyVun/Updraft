import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';

export const HEARTH = new THREE.Vector3(tuning.sleeping.hearthX, heightAt(tuning.sleeping.hearthX,tuning.sleeping.hearthZ), tuning.sleeping.hearthZ);
const smooth=THREE.MathUtils.smoothstep;

/** A small open hearth, with its own spent fuel: morning warms the ashes but never relights them. */
export class SleepingHearth {
  readonly group=new THREE.Group();
  readonly flame={value:1};
  readonly embers={value:1};
  private readonly time={value:0};
  private readonly air={value:new THREE.Vector2()};
  private readonly origin=new THREE.Vector2();
  private readonly ash={value:0};
  private readonly sample:WindSample={x:0,z:0,energy:0,lift:0};
  private coldest=0;
  private readonly tongues:THREE.Mesh[]=[];

  constructor() {
    const rand=mulberry32(20924),parts:THREE.BufferGeometry[]=[];
    const stone=(g:THREE.BufferGeometry,c:THREE.Color)=>{
      const colours=new Float32Array(g.attributes.position.count*3);
      for(let i=0;i<colours.length;i+=3)colours.set(c.toArray(),i);
      g.setAttribute('color',new THREE.BufferAttribute(colours,3));parts.push(g);
    };
    // Broad worn hearthstone, two jambs and an open arch. There is no floating wall or chimney.
    stone(new THREE.CylinderGeometry(.91,1,.14,10).scale(1,1,.64).translate(0,.05,0),new THREE.Color('#6d6258'));
    for(const side of [-1,1])for(let j=0;j<3;j++){
      const block=new THREE.BoxGeometry(.3,.24,.48,1,1,1).rotateY((rand()-.5)*.08).rotateZ((rand()-.5)*.07);
      block.translate(side*.64,.22+j*.23,0);stone(block,new THREE.Color().setRGB(.30+rand()*.06,.27+rand()*.05,.23+rand()*.04));
    }
    for(let i=0;i<9;i++){
      const a=i/8*Math.PI;
      stone(new THREE.BoxGeometry(.27,.27,.49).rotateZ(a-Math.PI/2).translate(Math.cos(a)*.64,.70+Math.sin(a)*.45,0),new THREE.Color('#82766a'));
    }
    for(let i=0;i<3;i++){
      const log=new THREE.CylinderGeometry(.075,.085,.75,8).rotateZ(Math.PI/2).rotateY(i*.8-.8).translate((i-1)*.08,.19+i*.055,.08);
      stone(log,new THREE.Color('#32271f'));
    }
    const mat=new THREE.ShaderMaterial({uniforms:atmo.uniforms,
      vertexShader:`in vec3 color;out vec3 vColor,vWorld,vNormal;void main(){vColor=color;vWorld=(modelMatrix*vec4(position,1)).xyz;vNormal=mat3(modelMatrix)*normal;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1);}`,
      fragmentShader:`${ATMO_GLSL} in vec3 vColor,vWorld,vNormal;void main(){vec3 n=normalize(vNormal);vec3 base=mix(vColor,vec3(.77,.83,.85),frostAt(vWorld.xz)*max(n.y,0.0)*.75);vec3 col=base*(hemiLight(n)*1.3+uSunColor*max(dot(n,uSunDir),0.0)*cloudShadow(vWorld.xz)+lampLight(vWorld,n)+dawnLight(vWorld,n));gl_FragColor=vec4(applyFog(col,vWorld),1);}`});
    this.group.add(new THREE.Mesh(mergeGeometries(parts),mat));
    const fire=new THREE.ShaderMaterial({uniforms:{...atmo.uniforms,uFlame:this.flame,uEmbers:this.embers,uFireTime:this.time,uFireAir:this.air},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`uniform float uFlame,uFireTime;uniform vec2 uFireAir;in float aSeed;out float vSeed;out vec2 vUv;out vec3 vWorld;
        void main(){vSeed=aSeed;vUv=uv;vec3 p=position;p.y*=.3+uFlame*.7;p.x+=sin(uFireTime*5.0+uv.y*5.0+aSeed*17.0)*uv.y*.065+uFireAir.x*uv.y*uv.y*.022;
          vWorld=(modelMatrix*vec4(p,1)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1);}`,
      fragmentShader:`${ATMO_GLSL} uniform float uFlame,uFireTime;in float vSeed;in vec2 vUv;in vec3 vWorld;
        void main(){float y=clamp(vUv.y,0.0,1.0),x=(vUv.x-.5)*2.0;
          x+=sin(y*8.0-uFireTime*5.2+vSeed*11.0)*.12*y;
          float edge=(1.0-y)*(.58+.10*sin(uFireTime*7.0+y*13.0+vSeed*19.0));
          float shape=edge>0.0?1.0-smoothstep(edge*.3,edge,abs(x)):0.0;
          float a=shape*smoothstep(0.0,.13,y)*(1.0-smoothstep(.78,1.0,y))*uFlame;
          vec3 col=mix(vec3(1.2,.19,.025),vec3(2.0,1.15,.24),pow(1.0-y,1.5));gl_FragColor=vec4(applyFog(col,vWorld),a*.85);}`});
    for(let i=0;i<5;i++){
      const h=.5+rand()*.32,geo=new THREE.PlaneGeometry(.37,h,1,8).translate(0,h/2,0);
      geo.setAttribute('aSeed',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(rand()),1));
      const flame=new THREE.Mesh(geo,fire);
      flame.position.set((i-2)*.105,.23,(rand()-.5)*.18);this.group.add(flame);this.tongues.push(flame);
    }
    const coalMat=new THREE.ShaderMaterial({uniforms:{...atmo.uniforms,uEmbers:this.embers},
      vertexShader:`out vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1);}`,
      fragmentShader:`${ATMO_GLSL} uniform float uEmbers;in vec3 vWorld;void main(){gl_FragColor=vec4(applyFog(mix(vec3(.035,.029,.025),vec3(1.5,.21,.016),uEmbers),vWorld),1);}`});
    const coals:THREE.BufferGeometry[]=[];
    for(let i=0;i<12;i++)coals.push(new THREE.IcosahedronGeometry(.045+rand()*.025,0).translate((rand()-.5)*.7,.20+rand()*.06,(rand()-.5)*.35));
    this.group.add(new THREE.Mesh(mergeGeometries(coals),coalMat));
    const dust=new THREE.BufferGeometry(),points=new Float32Array(30*3);
    for(let i=0;i<points.length;i++)points[i]=rand();dust.setAttribute('position',new THREE.BufferAttribute(points,3));
    const ash=new THREE.Points(dust,new THREE.ShaderMaterial({uniforms:{...atmo.uniforms,uFireTime:this.time,uAsh:this.ash,uFlame:this.flame,uFireAir:this.air},transparent:true,depthWrite:false,
      vertexShader:`uniform float uFireTime,uAsh,uFlame;uniform vec2 uFireAir;out vec3 vWorld;out float vAlpha;
        void main(){float age=fract(position.y+uFireTime*.32);vec3 p=vec3((position.x-.5)*.6,.25+age*1.25,(position.z-.5)*.3);p.xz+=uFireAir*age*age*.16;
          vWorld=(modelMatrix*vec4(p,1)).xyz;vec4 view=viewMatrix*vec4(vWorld,1);gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((uFlame>.1?50.0:12.0)/max(-view.z,1.0),1.0,9.0);vAlpha=sin(age*3.14159)*uAsh*.45;}`,
      fragmentShader:`${ATMO_GLSL} in vec3 vWorld;in float vAlpha;void main(){float a=1.0-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(applyFog(vec3(.42,.40,.36),vWorld),a*vAlpha);}` }));
    ash.frustumCulled=false;this.group.add(ash);this.group.position.copy(HEARTH);this.group.rotation.y=.78;
  }

  extinguish():void { this.coldest=1;this.flame.value=this.embers.value=0; }

  update(dt:number,time:number,cold:number,camera:THREE.Camera,wind:WindField):void {
    this.time.value=time;this.coldest=Math.max(this.coldest,cold);
    wind.sample(HEARTH.x,HEARTH.z,this.sample);
    this.air.value.set(this.sample.x,this.sample.z).rotateAround(this.origin,-.78);
    const stirred=Math.min(1,this.sample.energy*.4);
    this.flame.value=1-smooth(this.coldest,tuning.sleeping.hearthGutter,tuning.sleeping.hearthOut);
    this.embers.value=(1-smooth(this.coldest,tuning.sleeping.hearthOut,tuning.sleeping.hearthAsh))*(.58+stirred*.42);
    this.ash.value+=(stirred*(1-this.embers.value)-this.ash.value)*(1-Math.exp(-dt*5));
    for(const tongue of this.tongues)tongue.rotation.y=Math.atan2(camera.position.x-HEARTH.x,camera.position.z-HEARTH.z)-this.group.rotation.y;
    const flicker=.92+Math.sin(time*9)*.05+Math.sin(time*15.3)*.03;
    atmo.uniforms.uHearth.value.set(HEARTH.x,HEARTH.y+.48,HEARTH.z,(this.flame.value*2.7+this.embers.value*.35)*flicker);
  }
}
