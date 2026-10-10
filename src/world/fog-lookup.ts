import * as THREE from 'three';
import { glsl } from '../tuning';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { ATMO_GLSL, atmo } from './atmosphere';
import { FOG_VIEW, FOG_SPHERE, FOG_GUARD, FOG_SIZE, FOG_TILES, FOG_SLICES, FOG_NEAR, FOG_FAR, fogLookupUniforms } from './fog-lookup-uniforms';

const FRAG = /* glsl */ `
#define FOG_LOOKUP 0
#define CLOUD_DECK 1
#define STORM_BANK 1
#define cameraPosition uFogBakeEye
uniform vec3 uFogBakeEye;
uniform float uFogBakeKind;
uniform mat3 uFogLookupView;
uniform vec2 uFogLookupProjection;
${ATMO_GLSL}
void main() {
  vec2 pixel = gl_FragCoord.xy - 0.5;
  vec2 tile = floor(pixel / vec2(${FOG_SIZE.x}.0, ${FOG_SIZE.y}.0));
  vec2 local = mod(pixel, vec2(${FOG_SIZE.x}.0, ${FOG_SIZE.y}.0));
  vec3 ray;
  if (local.y < ${glsl(FOG_VIEW.y)}) {
    vec2 uv = local / vec2(${glsl(FOG_VIEW.x - 1)}, ${glsl(FOG_VIEW.y - 1)});
    vec3 view = normalize(vec3((uv * 2.0 - 1.0) * ${glsl(FOG_GUARD)} / uFogLookupProjection, -1.0));
    ray = transpose(uFogLookupView) * view;
  } else {
    if (local.x >= ${glsl(FOG_SPHERE.x)}) { gl_FragColor = vec4(0.0); return; }
    vec2 uv = (local - vec2(0.0, ${glsl(FOG_VIEW.y)})) / vec2(${glsl(FOG_SPHERE.x - 1)}, ${glsl(FOG_SPHERE.y - 1)});
    float longitude = (uv.x - 0.5) * 6.28318530718;
    float latitude = (uv.y - 0.5) * 3.14159265359;
    ray = vec3(cos(longitude) * cos(latitude), sin(latitude), sin(longitude) * cos(latitude));
  }
  float layer = tile.y * ${FOG_TILES}.0 + tile.x;
  float dist = ${FOG_NEAR} * pow(${FOG_FAR / FOG_NEAR}.0, layer / ${FOG_SLICES - 1}.0);
  vec4 fog = uFogBakeKind < 0.5 ? cloudDeck(uFogBakeEye, ray, dist) : seaFog(uFogBakeEye, ray, dist);
  float optical = -log(max(1.0 - fog.a, 0.000001));
  gl_FragColor = vec4(fog.rgb * optical, optical);
}`;

type Cache = {
  cloud?: THREE.WebGLRenderTarget;
  mist?: THREE.WebGLRenderTarget;
  frame: number;
  mirror: number;
  world: THREE.Matrix4;
  projection: THREE.Matrix4;
};

export class FogLookup {
  private readonly caches = new Map<THREE.PerspectiveCamera, Cache>();
  private readonly template = simTarget(FOG_SIZE.x * FOG_TILES, FOG_SIZE.y * FOG_TILES);
  private readonly material = simMaterial(FRAG, {
    ...atmo.uniforms,
    uFogBakeEye: { value: new THREE.Vector3() },
    uFogBakeKind: { value: 0 },
  }, this.template);
  private readonly runner: GpuRunner;
  private frame = 0;
  active = false;

  constructor(renderer: THREE.WebGLRenderer) {
    this.runner = new GpuRunner(renderer);
    this.material.name = 'Chapter fog lookup';
  }

  beginFrame(): void {
    this.frame++;
    if (atmo.uniforms.uCloudDeck.value.w <= 0) fogLookupUniforms.uCloudLookup.value = null;
    if (atmo.uniforms.uSeaFogShape.value.w <= 0) fogLookupUniforms.uMistLookup.value = null;
    for (const cache of this.caches.values()) {
      if (atmo.uniforms.uCloudDeck.value.w <= 0) { cache.cloud?.dispose(); cache.cloud = undefined; }
      if (atmo.uniforms.uSeaFogShape.value.w <= 0) { cache.mist?.dispose(); cache.mist = undefined; }
    }
  }

  bake(camera: THREE.PerspectiveCamera): void {
    const u = atmo.uniforms;
    if (!this.active || (u.uCloudDeck.value.w <= 0 && u.uSeaFogShape.value.w <= 0)) return;
    let cache = this.caches.get(camera);
    if (!cache) {
      cache = { frame: -1, mirror: -1, world: new THREE.Matrix4(), projection: new THREE.Matrix4() };
      this.caches.set(camera, cache);
    }
    camera.updateWorldMatrix(true, false);
    fogLookupUniforms.uFogLookupView.value.setFromMatrix4(camera.matrixWorldInverse);
    fogLookupUniforms.uFogLookupProjection.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]);
    if (cache.frame !== this.frame || cache.mirror !== u.uMirrorPass.value ||
        !cache.world.equals(camera.matrixWorld) || !cache.projection.equals(camera.projectionMatrix)) {
      this.material.uniforms.uFogBakeEye.value.setFromMatrixPosition(camera.matrixWorld);
      if (u.uCloudDeck.value.w > 0) {
        cache.cloud ??= this.template.clone();
        this.material.uniforms.uFogBakeKind.value = 0;
        this.runner.run(this.material, cache.cloud);
      }
      if (u.uSeaFogShape.value.w > 0) {
        cache.mist ??= this.template.clone();
        this.material.uniforms.uFogBakeKind.value = 1;
        this.runner.run(this.material, cache.mist);
      }
      cache.frame = this.frame;
      cache.mirror = u.uMirrorPass.value;
      cache.world.copy(camera.matrixWorld);
      cache.projection.copy(camera.projectionMatrix);
    }
    fogLookupUniforms.uCloudLookup.value = cache.cloud?.texture ?? null;
    fogLookupUniforms.uMistLookup.value = cache.mist?.texture ?? null;
  }
}
