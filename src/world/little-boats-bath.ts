import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

/** An old enamel bath, improbably standing beside the stream, with a rolled rim and four small claw feet. */
export function littleBoatsBath(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dream-bathtub';
  const enamel = new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uColour: { value: new THREE.Color('#eee9db') }, uShine: { value: 0.3 } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vHeight = position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${ATMO_GLSL}
      uniform vec3 uColour;
      uniform float uShine;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 alb = uColour * mix(vec3(0.68, 0.75, 0.72), vec3(1.0), smoothstep(0.2, 1.6, vHeight));
        float shadow = cloudShadow(vWorld.xz);
        vec3 col = alb * (hemiLight(N) + uSunColor * max(0.0, dot(N, uSunDir)) * shadow * 0.65);
        col += uSunColor * pow(max(0.0, dot(N, halfVector(uSunDir, V))), 65.0) * uShine * shadow;
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }`,
  });
  const brass = new THREE.ShaderMaterial({
    vertexShader: enamel.vertexShader, fragmentShader: enamel.fragmentShader, side: THREE.DoubleSide,
    uniforms: { ...atmo.uniforms, uColour: { value: new THREE.Color('#9f8557') }, uShine: { value: 0.55 } },
  });
  // The profile returns down the inside to form a real bowl, rather than an opaque oval cap.
  const profile = [
    [0, 0.15],
    [0.38, 0.15],
    [0.58, 0.22],
    [0.72, 0.43],
    [0.86, 0.84],
    [0.96, 1.38],
    [1.02, 1.85],
    [1.045, 1.98],
    [1.0, 2.03],
    [0.94, 1.9],
    [0.9, 1.4],
    [0.79, 0.9],
    [0.62, 0.57],
    [0.35, 0.48],
    [0, 0.48],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.LatheGeometry(profile, 72);
  shell.scale(1.55, 1, 2.9);
  shell.computeVertexNormals();
  group.add(new THREE.Mesh(shell, enamel));
  const rim = new THREE.CatmullRomCurve3(
    Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 1.6, 1.98, Math.sin(a) * 3.02);
    }),
    true,
  );
  group.add(new THREE.Mesh(new THREE.TubeGeometry(rim, 96, 0.12, 10, true), enamel));
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const foot = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * 0.82, 0.5, end * 1.75),
        new THREE.Vector3(side * 1.12, -0.2, end * 1.95),
        new THREE.Vector3(side * 1.2, -0.65, end * 2.04),
      );
      group.add(new THREE.Mesh(new THREE.TubeGeometry(foot, 12, 0.12, 8, false), brass));
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8), brass);
      toe.scale.set(1, 0.65, 1.3);
      toe.position.copy(foot.v2);
      group.add(toe);
    }
  const faucet = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.65, -2.82),
    new THREE.Vector3(0, 2.58, -2.82),
    new THREE.Vector3(0, 2.77, -2.55),
    new THREE.Vector3(0, 2.68, -2.23),
    new THREE.Vector3(0, 2.44, -2.2),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(faucet, 24, 0.09, 8, false), brass));
  for (const side of [-1, 1]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 8), brass);
    stem.position.set(side * 0.37, 2.02, -2.72);
    group.add(stem);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.37, 8), brass);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(side * 0.37, 2.21, -2.72);
    group.add(handle);
  }
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 16), brass);
  drain.position.set(0, 0.5, -0.55);
  group.add(drain);
  return group;
}
