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
        float facing = max(dot(n, eye), 0.0);
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
    fragmentShader: `varying vec2 vUv; uniform float uFade; uniform float uTime;
      void main() {
        vec2 p=(vUv-0.5)*2.0;
        float core=exp(-dot(p,p)*95.0);
        float rays=exp(-abs(p.x)*65.0-abs(p.y)*5.0)+exp(-abs(p.y)*65.0-abs(p.x)*7.0);
        float halo=exp(-dot(p,p)*12.0)*0.16;
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

export function soapWand(): THREE.Group {
  const group = new THREE.Group();
  const brass = mirrorMaterial('#dfbc80');
  // Origin is the mitten's grip. The film's centre is 0.95 above it.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.038, 8, 48), brass);
  loop.position.y = 0.95; group.add(loop);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.6, 8), brass);
  handle.position.y = 0.1; group.add(handle);
  group.traverse(o => o.layers.enable(REFLECTION_LAYER));
  return group;
}
