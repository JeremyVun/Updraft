import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { noiseLoopUniforms } from './loops';

const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Every simulation and bake material made so far, so they can all be compiled up front (see gl/boot.ts). */
export const simMaterials: THREE.ShaderMaterial[] = [];
const writes = new WeakMap<THREE.Material, THREE.WebGLRenderTarget | PingPong>();

/** A target with the format a simulation or bake material draws into, so boot can first draw it alike (gl/boot.ts). */
export function simWrites(material: THREE.Material): THREE.WebGLRenderTarget | null {
  const target = writes.get(material);
  return target instanceof PingPong ? target.write : target ?? null;
}

const bootPasses: (() => void)[] = [];

/** Defers a construction-time pass until boot has compiled and settled its program (see gl/boot.ts). */
export function atBoot(pass: () => void): void {
  bootPasses.push(pass);
}

export function runBootPasses(): void {
  for (const pass of bootPasses.splice(0)) pass();
}

/** `target` is what it draws into, or one with the same format. */
export function simMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, target: THREE.WebGLRenderTarget | PingPong): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader,
    uniforms: { ...noiseLoopUniforms, ...uniforms },
    depthTest: false,
    depthWrite: false,
  });
  simMaterials.push(material);
  writes.set(material, target);
  return material;
}

export function simTarget(
  width: number,
  height: number,
  type: THREE.TextureDataType = THREE.HalfFloatType,
  filter: THREE.MinificationTextureFilter & THREE.MagnificationTextureFilter = THREE.LinearFilter,
  count = 1,
): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    count,
    type,
    format: THREE.RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

export class PingPong {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;

  /** `count` textures in each target, written together by one pass. */
  constructor(width: number, height: number, type?: THREE.TextureDataType, filter?: THREE.MinificationTextureFilter & THREE.MagnificationTextureFilter, count = 1) {
    this.read = simTarget(width, height, type, filter, count);
    this.write = simTarget(width, height, type, filter, count);
  }

  get texture(): THREE.Texture {
    return this.read.texture;
  }

  swap(): void {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
}

export class GpuRunner {
  private readonly quad = new FullScreenQuad();

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  run(material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = material;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(prev);
  }

  clear(target: THREE.WebGLRenderTarget): void {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(prev);
  }
}
