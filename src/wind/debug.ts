import * as THREE from 'three';
import { atmo } from '../world/atmosphere';
import { WINDOW } from '../world/window';

/** `?debug=wind`: the wind field drawn on a translucent sheet above the window. Hue is direction, brightness is speed. */
export function createWindDebug(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uWindTex: atmo.uniforms.uWindTex },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uWindTex;
      in vec2 vUv;
      vec3 hue(float h) {
        return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      }
      void main() {
        vec4 w = texture(uWindTex, vUv);
        float sp = length(w.xy);
        float ang = atan(w.y, w.x) / 6.2831853 + 0.5;
        vec3 col = hue(ang) * smoothstep(0.0, 20.0, sp) * 2.0;
        col += vec3(1.0, 0.9, 0.6) * w.z * 0.6 + vec3(0.4, 0.6, 1.0) * w.w * 0.6;
        float grid = step(0.97, fract(vUv.x * 32.0)) + step(0.97, fract(vUv.y * 32.0));
        gl_FragColor = vec4(col + grid * 0.08, 0.75);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0.5, 0, 0.5);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.onBeforeRender = () => {
    mesh.position.set(WINDOW.minX, 18, WINDOW.minZ);
    mesh.scale.set(WINDOW.size, 1, WINDOW.size);
    mesh.updateMatrixWorld();
  };
  return mesh;
}
