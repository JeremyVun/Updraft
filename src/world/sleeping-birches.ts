import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { mulberry32 } from './noise';
import { growBirch } from './birches';

/** A few exposed birches beyond the walk: the autumn trees, stripped down to their winter silhouette. */
export function sleepingBirches(): THREE.Group {
  const random=mulberry32(210921),parts:THREE.BufferGeometry[]=[];
  const up=new THREE.Vector3(0,1,0),leaves:THREE.BufferGeometry[]=[];
  const branch=(a:THREE.Vector3,b:THREE.Vector3,r:number,tip:number,root:THREE.Vector3)=>{
    const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(tip,r,delta.length(),7,1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize()));
    g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
    const roots=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<roots.length;i+=3)roots.set(root.toArray(),i);
    g.setAttribute('aRoot',new THREE.BufferAttribute(roots,3));parts.push(g);
  };
  for(const [x,z,h] of [[-190,-1919,3.9],[-193,-1922,2.7],[-191,-1925,3.3],[-146,-1938,3.4],[-148,-1941,2.5]]) {
    const root=new THREE.Vector3(x,heightAt(x,z),z),tree=growBirch(random,false);
    const place=(p:THREE.Vector3)=>p.clone().multiplyScalar(h).add(new THREE.Vector3(p.y*p.y*h*.11,0,0)).add(root);
    for(const limb of tree.segs)branch(place(limb.a),place(limb.b),limb.ra*h,limb.rb*h,root);
    for(let i=0;i<460;i++) {
      const tip=tree.tips[Math.floor(random()*tree.tips.length)];
      const centre=place(tip).add(new THREE.Vector3((random()-.5)*h*.26,(random()-.5)*h*.2,(random()-.5)*h*.26));
      const normal=centre.clone().sub(root).sub(new THREE.Vector3(0,h*.85,0)).normalize();
      const g=new THREE.PlaneGeometry(2,2),count=g.attributes.position.count;
      const leaf=new Float32Array(count*4),roots=new Float32Array(count*3),shade=new Float32Array(count*3),seed=random();
      for(let j=0;j<count;j++){leaf.set([...centre.toArray(),seed],j*4);roots.set(root.toArray(),j*3);shade.set(normal.toArray(),j*3);}
      g.setAttribute('aLeaf',new THREE.BufferAttribute(leaf,4));g.setAttribute('aRoot',new THREE.BufferAttribute(roots,3));g.setAttribute('aShade',new THREE.BufferAttribute(shade,3));leaves.push(g);
    }
  }
  const mesh=new THREE.Mesh(mergeGeometries(parts),new THREE.ShaderMaterial({uniforms:atmo.uniforms,
    vertexShader:`${ATMO_GLSL}
      in vec3 aRoot;out vec3 vWorld;out vec3 vNormal;out float vHeight;
      void main(){vWorld=position;vHeight=position.y-aRoot.y;vNormal=normal;
        vWorld.x+=sin(uTime*.8+aRoot.x*.3)*vHeight*vHeight*.006;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
    fragmentShader:`${ATMO_GLSL}
      in vec3 vWorld;in vec3 vNormal;in float vHeight;
      void main(){vec3 n=normalize(vNormal);
        float around=atan(n.z,n.x);
        float band=vnoise(vec2(around*1.4,vWorld.y*1.6));
        float scar=smoothstep(.66,.86,vnoise(vec2(around*3.2,vWorld.y*9.0)));
        vec3 bark=mix(mix(vec3(.60,.59,.55),vec3(.82,.82,.77),band),vec3(.20,.19,.18),scar*.7);
        bark=mix(bark,vec3(.77,.84,.86),frostAt(vWorld.xz)*(.16+max(0.0,n.y)*.7));
        vec3 col=bark*(hemiLight(n)+uSunColor*max(0.0,dot(n,uSunDir))*cloudShadow(vWorld.xz)+dawnLight(vWorld,n)+lampLight(vWorld,n));
        gl_FragColor=vec4(applyFog(col,vWorld),1.0);}`,
  }));mesh.frustumCulled=false;
  const foliage=new THREE.Mesh(mergeGeometries(leaves),new THREE.ShaderMaterial({uniforms:atmo.uniforms,side:THREE.DoubleSide,
    vertexShader:`${ATMO_GLSL}
      in vec4 aLeaf;in vec3 aRoot,aShade;out vec2 vUv;out vec3 vWorld,vNormal;out float vSeed,vDepth;
      void main(){float warm=morningAt(aRoot.xz);float seed=aLeaf.w;
        float bloom=smoothstep(.15+seed*.40,.40+seed*.40,warm);
        if(bloom<=0.0){gl_Position=vec4(2,2,2,1);return;}
        float angle=seed*6.2831+sin(uTime*(7.0+seed*5.0)+seed*40.0)*.12;
        vec2 corner=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*position.xy;
        vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
        vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
        vec3 centre=aLeaf.xyz;float h=centre.y-aRoot.y;
        centre.x+=sin(uTime*.8+aRoot.x*.3)*h*h*.006;
        vWorld=centre+(right*corner.x+up*corner.y)*(.075+seed*.05)*bloom;
        vUv=position.xy;vNormal=aShade;vSeed=seed;vDepth=.5+seed*.5;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1);}`,
    fragmentShader:`${ATMO_GLSL}
      in vec2 vUv;in vec3 vWorld,vNormal;in float vSeed,vDepth;
      void main(){vec2 p=vUv;if(length(vec2(p.x*1.7,p.y+p.x*p.x*.35))>1.0)discard;
        vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld);
        float wrap=clamp(dot(N,uSunDir)*.55+.45,0.0,1.0),sun=cloudShadow(vWorld.xz);
        vec3 deep=vec3(.03,.06,.045),lit=mix(vec3(.17,.27,.07),vec3(.30,.33,.08),fract(vSeed*3.3));
        vec3 alb=mix(deep,lit,smoothstep(.3,1.0,vDepth)*(.55+.45*wrap));
        vec3 col=alb*hemiLight(N)+alb*uSunColor*pow(wrap,2.5)*sun*1.3;
        col+=vec3(.45,.55,.1)*uSunColor*pow(max(dot(-V,uSunDir),0.0),3.0)*sun*.3;
        col+=alb*dawnLight(vWorld,N)*.3;gl_FragColor=vec4(applyFog(col,vWorld),1);}`,
  }));foliage.frustumCulled=false;
  const group=new THREE.Group();group.add(mesh,foliage);return group;
}
