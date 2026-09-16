import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Every simulation and bake material made so far, so they can all be compiled up front (see gl/boot.ts). */
export const simMaterials: THREE.ShaderMaterial[] = [];

export function simMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  simMaterials.push(material);
  return material;
}

export function simTarget(
  width: number,
  height: number,
  type: THREE.TextureDataType = THREE.HalfFloatType,
  filter: THREE.MinificationTextureFilter & THREE.MagnificationTextureFilter = THREE.LinearFilter,
): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
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

  constructor(width: number, height: number, type?: THREE.TextureDataType, filter?: THREE.MinificationTextureFilter & THREE.MagnificationTextureFilter) {
    this.read = simTarget(width, height, type, filter);
    this.write = simTarget(width, height, type, filter);
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
