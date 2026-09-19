import * as THREE from 'three';
import { simMaterials } from './gpu';

/** Give input and the opening veil a paint opportunity between startup chunks. */
export function yieldBoot(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * Compiles every material in the scene up front, in parallel where the driver allows, against the target the
 * scene is really drawn into (a program's key depends on the target's colour space). Without this the first
 * frame that shows an object compiles its shaders and the game stalls "as if loading".
 */
export async function precompile(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget): Promise<void> {
  renderer.setRenderTarget(target);
  try {
    await renderer.compileAsync(scene, camera);
  } finally {
    renderer.setRenderTarget(null);
  }
}

/** Compiles the simulation and bake materials the same way, against a float target like the ones they write. */
export async function precompileSim(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): Promise<void> {
  const quad = new THREE.PlaneGeometry(2, 2);
  const bench = new THREE.Scene();
  for (const material of simMaterials) bench.add(new THREE.Mesh(quad, material));
  await precompile(renderer, bench, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), target);
  quad.dispose();
}

/**
 * Draws the scene in batches, with every object shown, into `target` (never presented): textures upload,
 * buffers land on the GPU and render targets are allocated, so the first real frame is an ordinary one.
 */
export async function warmRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget): Promise<void> {
  const hidden: THREE.Object3D[] = [];
  const drawables: { object: THREE.Object3D; mask: number }[] = [];
  const previousTarget = renderer.getRenderTarget();
  scene.traverse(o => {
    if (!o.visible) { hidden.push(o); o.visible = true; }
    if ('material' in o) {
      drawables.push({ object: o, mask: o.layers.mask });
      // Layers suppress this draw without hiding any children.
      o.layers.mask = 0;
    }
  });
  try {
    // The warm images are discarded. Upload a bounded batch per paint opportunity.
    for (let i = 0; i < drawables.length; i += 64) {
      const batch = drawables.slice(i, i + 64);
      for (const { object, mask } of batch) object.layers.mask = mask;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      for (const { object } of batch) object.layers.mask = 0;
      renderer.setRenderTarget(previousTarget);
      await yieldBoot();
    }
  } finally {
    renderer.setRenderTarget(previousTarget);
    for (const { object, mask } of drawables) object.layers.mask = mask;
    for (const o of hidden) o.visible = false;
  }
}

/** Resolves once the GPU has finished everything issued so far, polling without blocking the main thread. */
export function gpuIdle(renderer: THREE.WebGLRenderer, timeoutMs = 4000): Promise<void> {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const started = performance.now();
  return new Promise((resolve) => {
    const check = (): void => {
      const status = sync ? gl.clientWaitSync(sync, 0, 0) : gl.ALREADY_SIGNALED;
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED || performance.now() - started > timeoutMs) {
        if (sync) gl.deleteSync(sync);
        resolve();
      } else {
        setTimeout(check, 8);
      }
    };
    check();
  });
}
