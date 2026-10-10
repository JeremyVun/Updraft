import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';

/** Scene props use the same sky and sun as the shader-lit travellers. */
export function mirrorMaterial(colour: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: {...atmo.uniforms,uColour:{value:new THREE.Color(colour)}},
    side:THREE.DoubleSide,
    vertexShader:`varying vec3 vWorld; varying vec3 vNormal;
      void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
    fragmentShader:`${ATMO_GLSL}
      uniform vec3 uColour; varying vec3 vWorld; varying vec3 vNormal;
      void main(){vec3 n=normalize(vNormal);vec3 c=uColour*(hemiLight(n)+uSunColor*max(dot(n,uSunDir),0.0));
      gl_FragColor=vec4(applyFog(c,vWorld),1.0);}`});
}

/** Thin film reflects the existing sky; it never asks for another scene render or a screen readback. */
export function soapMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uFade: { value: 1 }, uFilled: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    vertexShader: `${ATMO_GLSL}
      varying vec3 vWorld; varying vec3 vNormal;
      void main() {
        vec3 p = position;
        p *= 1.0 + 0.014 * sin(p.y * 5.0 + uTime * 2.0) * sin(p.x * 4.0 - uTime);
        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `${ATMO_GLSL}
      uniform float uFade; uniform float uFilled;
      varying vec3 vWorld; varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal), eye = normalize(cameraPosition - vWorld);
        float facing = clamp(dot(n, eye), 0.0, 1.0);
        float rim = pow(1.0 - facing, 3.5);
        float film = facing * 5.0 + n.y * 2.3 + 0.3 * sin(n.x * 5.0 + uTime * 0.55);
        vec3 rainbow = 0.55 + 0.45 * cos(film * 3.0 + vec3(0.0, 2.1, 4.2));
        vec3 reflected = skyColor(reflect(-eye, n));
        float glint = pow(max(dot(reflect(-uSunDir, n), eye), 0.0), 100.0);
        float shoulder = pow(max(dot(n, normalize(vec3(-0.4, 0.7, 0.5))), 0.0), 26.0);
        vec3 colour = reflected * 0.65 + rainbow * (0.32 + rim * 0.65);
        colour += vec3(1.0, 0.96, 0.84) * (glint * 2.5 + shoulder * 0.7);
        colour += vec3(1.0, 0.57, 0.18) * uFilled * 0.06;
        float alpha = 0.018 + rim * 0.52 + shoulder * 0.17 + glint * 0.45;
        gl_FragColor = vec4(colour, alpha * uFade);
      }`,
  });
}

/** A small luminous point with long soft rays, rather than a solid star-shaped collectible. */
export function starLight(floor = false): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main() { vUv=uv; gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uFade;
      float rayIntegral(float x, float sharpness) {
        return sign(x)*(1.0-exp(-abs(x)*sharpness))/sharpness;
      }
      float ray(float x, float width, float sharpness) {
        return (rayIntegral(x+width*0.5,sharpness)-rayIntegral(x-width*0.5,sharpness))/width;
      }
      float glow(vec2 p, vec2 width, float sharpness) {
        vec2 spread=1.0+sharpness*width*width*0.5;
        return exp(-dot(p*p,sharpness/spread))/sqrt(spread.x*spread.y);
      }
      void main() {
        vec2 p=(vUv-0.5)*2.0;
        // The light lies almost edge-on to the camera; integrate thin rays across each pixel.
        vec2 width=max(fwidth(p),vec2(0.0001));
        float core=glow(p,width,95.0);
        float rays=ray(p.x,width.x,65.0)*ray(p.y,width.y,5.0)+ray(p.y,width.y,65.0)*ray(p.x,width.x,7.0);
        float halo=glow(p,width,12.0)*0.16;
        float a=(core+rays*0.75+halo)*uFade;
        gl_FragColor=vec4(vec3(1.0,0.79,0.43)*1.65,a);
      }`,
  }));
  if (floor) { mesh.rotation.x = -Math.PI / 2; mesh.scale.setScalar(5.5); }
  else {
    mesh.layers.enable(REFLECTION_LAYER);
    // Billboard for each camera, including the existing reflection pass.
    mesh.onBeforeRender = (_r, _s, camera) => {
      mesh.quaternion.copy(camera.quaternion); mesh.updateMatrixWorld();
    };
  }
  return mesh;
}

/** How far the film's centre sits above the mitten, which holds the wand at the end of its handle. */
export const WAND_REACH = 0.95;

export function soapWand(): THREE.Group {
  const group = new THREE.Group();
  const brass = mirrorMaterial('#dfbc80');
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.038, 8, 48), brass);
  loop.position.y = WAND_REACH; group.add(loop);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.44, 8), brass);
  handle.position.y = 0.14; group.add(handle);
  group.traverse(o => o.layers.enable(REFLECTION_LAYER));
  return group;
}
