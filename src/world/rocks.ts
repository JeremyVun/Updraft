import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { ROCKS } from './landmarks';
import { createNoise2D } from './noise';
import { REFLECTION_LAYER } from './water/reflection';

const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uStone;
uniform vec3 uMoss;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  float grain = vnoise(vWorld.xz * 2.1 + vWorld.y * 1.3) * 0.6 + vnoise(vWorld.xy * 5.0) * 0.4;
  float strata = sin(vWorld.y * 3.2 + vnoise(vWorld.xz * 0.6) * 4.0) * 0.5 + 0.5;
  vec3 alb = uStone * (0.75 + 0.35 * grain) * (0.92 + 0.12 * strata);
  float moss = smoothstep(0.55, 0.85, n.y + (grain - 0.5) * 0.5);
  vec3 mossCol = uMoss * (0.8 + 0.4 * grain);
  alb = mix(alb, mix(stillGrey(mossCol), mossCol, lifeAt(vWorld.xz)), moss);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float ao = mix(0.55, 1.0, smoothstep(0.0, 1.5, vWorld.y - texture(uHeightTex, domainUv(vWorld.xz)).r));
  vec3 col = alb * (hemiLight(n) * ao + uSunColor * mix(ndl, wrap, 0.25) * sun);
  float rim = pow(1.0 - clamp(dot(n, normalize(cameraPosition - vWorld)), 0.0, 1.0), 4.0);
  col += uSunColor * rim * 0.12 * sun * max(dot(-normalize(cameraPosition - vWorld), uSunDir), 0.0);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

function boulder(seed: number): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv'));
  const noise = createNoise2D(Math.floor(seed));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lumps = noise(v.x * 1.3 + v.y * 0.7, v.z * 1.3 - v.y * 0.5) * 0.18 + noise(v.x * 3.1, v.z * 3.1 + v.y) * 0.06;
    const flat = v.y < -0.2 ? 0.6 : 1;
    v.multiplyScalar(1 + lumps);
    v.y *= flat;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRocks(): THREE.Mesh {
  const parts = ROCKS.map((r) => {
    const geo = boulder(r.seed);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(r.x, heightAt(r.x, r.z) + r.height * 0.25, r.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.yaw, 0)),
      new THREE.Vector3(r.radius, r.height, r.radius * (0.8 + (r.seed % 0.4))),
    );
    geo.applyMatrix4(m);
    return geo;
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...atmo.uniforms,
      uStone: { value: new THREE.Color('#8a8379') },
      uMoss: { value: new THREE.Color('#5d7336') },
    },
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  mesh.layers.enable(REFLECTION_LAYER);
  return mesh;
}
