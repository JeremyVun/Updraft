import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Programs compiling at once: a status query waits behind every compile issued before it. */
const GROUP = 8;
/** The longest stretch of boot work between paint opportunities, unless one driver call alone takes longer. */
const PAINT_BUDGET_MS = 12;
/** Objects drawn per warm batch, beside at most one object with a program not drawn yet. */
const WARM_BATCH = 64;

type Program = THREE.WebGLProgram & { isReady(): boolean };

let lastFrame = 0;
const stamp = (): void => { lastFrame = performance.now(); };

/** Give input and the opening veil a paint opportunity between startup chunks. */
export function yieldBoot(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => { stamp(); setTimeout(resolve, 0); }));
}

/** Yields for a paint once a paint budget has passed since the last one. */
export async function keepPainting(): Promise<void> {
  if (performance.now() - lastFrame >= PAINT_BUDGET_MS) await yieldBoot();
}

/** Waits without holding the main thread, noting any frame painted meanwhile. */
function idle(ms: number): Promise<void> {
  requestAnimationFrame(stamp);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Keep expensive CPU preparation below a short batch, without skipping or changing its fixed steps; resolves to what
 * the steps return. Steps that yield the share done pass it to `onProgress`.
 */
export async function prepareInBatches<T>(steps: Iterator<number | void, T>, onProgress: (fraction: number) => void = () => {}, budgetMs = 8): Promise<T> {
  let started = performance.now();
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    if (typeof step.value === 'number') onProgress(step.value);
    if (performance.now() - started >= budgetMs) { await yieldBoot(); started = performance.now(); }
  }
}

/**
 * Objects whose programs compile together. A program's key depends on the scene that lights and fogs the object and
 * on the target it is drawn into (only whether it is the screen), so each job names both. `apply` puts the materials
 * in a state they are also drawn with, such as a program variant, and returns the undo.
 */
export interface CompileJob {
  objects: readonly THREE.Object3D[];
  camera: THREE.Camera;
  /** Null for full-screen passes, which three draws as a scene of their own. */
  scene: THREE.Scene | null;
  target: THREE.WebGLRenderTarget | null;
  apply?: () => () => void;
}

type Drawable = THREE.Object3D & { material: THREE.Material | THREE.Material[] };

function isDrawable(object: THREE.Object3D): object is Drawable {
  const o = object as Partial<THREE.Mesh & THREE.Points & THREE.Line & THREE.Sprite>;
  return !!(o.isMesh || o.isPoints || o.isLine || o.isSprite) && !!o.material;
}

const materialsOf = (object: Drawable): THREE.Material[] => [object.material].flat();

/** Everything under `root` that three would compile, hidden objects included. */
export function drawables(root: THREE.Object3D): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse(o => { if (isDrawable(o)) found.push(o); });
  return found;
}

let passGeometry: THREE.BufferGeometry | null = null;
let passCamera: THREE.Camera | null = null;

/** Full-screen passes into `target`, standing in for FullScreenQuad, whose attributes are part of a program's key. */
export function passJob(materials: readonly THREE.Material[], target: THREE.WebGLRenderTarget | null): CompileJob {
  if (!passGeometry) {
    passGeometry = new THREE.BufferGeometry();
    passGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    passGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  }
  passCamera ??= new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = passGeometry;
  return { objects: materials.map(m => new THREE.Mesh(geometry, m)), camera: passCamera, scene: null, target };
}

/** Hands `renderer.compile` one object without its children; lights come only from the target scene. */
const alone = {
  object: null as THREE.Object3D | null,
  traverse(visit: (o: THREE.Object3D) => void): void { visit(this.object!); },
  traverseVisible(): void {},
};

function compileAlone(renderer: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene | null): void {
  alone.object = object;
  const root = alone as unknown as THREE.Object3D;
  try {
    renderer.compile(root, camera, (scene ?? root) as THREE.Scene);
  } finally {
    alone.object = null;
  }
}

const settled = new WeakSet<THREE.WebGLProgram>();
let settling = false;

/**
 * Gives every built program whose compile has finished its first use (three's `onFirstUse`: link status, info logs,
 * uniform and attribute queries), waiting until at most `compiling` are still compiling.
 */
async function settle(renderer: THREE.WebGLRenderer, compiling = 0): Promise<void> {
  const gl = renderer.getContext();
  for (;;) {
    let waiting = 0;
    for (const program of (renderer.info.programs ?? []) as Program[]) {
      if (settled.has(program)) continue;
      if (!program.isReady()) { waiting++; continue; }
      settling = true;
      try {
        program.getUniforms();
      } finally {
        settling = false;
      }
      settled.add(program);
      await keepPainting();
    }
    if (waiting <= compiling || gl.isContextLost()) return;
    await idle(4);
  }
}

/**
 * Builds every program the jobs' materials are drawn with and gives each its first use once the driver reports it
 * compiled, so no draw or bake waits on a compile. At most `GROUP` programs compile at once. Yields whenever a paint
 * budget has passed. `onProgress` gets the share of the jobs' materials compiled, which only rises and ends at 1
 * once all are settled. The render target is restored, and each job's state undone, even on failure.
 */
export async function settlePrograms(renderer: THREE.WebGLRenderer, jobs: readonly CompileJob[], onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const total = jobs.reduce((n, job) => n + new Set(job.objects.flatMap(o => isDrawable(o) ? materialsOf(o) : [])).size, 0);
  const previousTarget = renderer.getRenderTarget();
  const compiling = (): number => (renderer.info.programs ?? []).filter(p => !settled.has(p)).length;
  let compiled = 0;
  try {
    for (const job of jobs) {
      const undo = job.apply?.();
      try {
        const seen = new Set<THREE.Material>();
        renderer.setRenderTarget(job.target);
        for (const object of job.objects) {
          if (!isDrawable(object)) continue;
          compileAlone(renderer, object, job.camera, job.scene);
          for (const m of materialsOf(object)) if (!seen.has(m)) { seen.add(m); compiled++; }
          if (compiling() >= GROUP) {
            // Refill each free slot without raising the limit on outstanding programs.
            await settle(renderer, GROUP - 1);
            onProgress(compiled / total);
          }
          await keepPainting();
        }
      } finally {
        undo?.();
      }
    }
    await settle(renderer);
  } finally {
    renderer.setRenderTarget(previousTarget);
  }
  onProgress(1);
}


/** The programs three will draw this object with in the current state, found by compiling it (nothing new is built). */
function programsOf(renderer: THREE.WebGLRenderer, object: Drawable, camera: THREE.Camera, scene: THREE.Scene): THREE.WebGLProgram[] {
  compileAlone(renderer, object, camera, scene);
  return materialsOf(object)
    .filter(m => m.visible)
    .map(m => (renderer.properties.get(m) as { currentProgram?: THREE.WebGLProgram }).currentProgram)
    .filter((p): p is THREE.WebGLProgram => !!p);
}

/**
 * Gives an object that would draw nothing yet (no instances, an empty draw range) something to draw for the warm
 * draw, which three would otherwise skip; returns the undo.
 */
function somethingToDraw(object: Drawable): (() => void) | null {
  const mesh = object as Partial<THREE.InstancedMesh>;
  if (mesh.isInstancedMesh && mesh.count === 0 && mesh.instanceMatrix!.count > 0) {
    mesh.count = 1;
    return () => { mesh.count = 0; };
  }
  const geometry = (object as Partial<THREE.Mesh>).geometry as Partial<THREE.InstancedBufferGeometry> | undefined;
  if (!geometry) return null;
  if (geometry.isInstancedBufferGeometry && geometry.instanceCount === 0) {
    geometry.instanceCount = 1;
    return () => { geometry.instanceCount = 0; };
  }
  if (geometry.drawRange?.count === 0) {
    geometry.drawRange.count = Infinity;
    return () => { geometry.drawRange!.count = 0; };
  }
  return null;
}

/** What a driver builds a pipeline for besides the program: the formats of the target drawn into. */
function formatOf(target: THREE.WebGLRenderTarget): string {
  const texture = target.textures[0] as THREE.Texture;
  return `${texture.type} ${texture.format} ${texture.colorSpace} ${target.textures.length} ${target.samples} ${target.depthBuffer} ${target.stencilBuffer}`;
}

const drawnInto = new WeakMap<THREE.WebGLProgram, Set<string>>();

/** Notes a program's first draw into targets of this format; false if it had one. */
function firstDrawn(program: THREE.WebGLProgram, format: string): boolean {
  const formats = drawnInto.get(program) ?? new Set<string>();
  drawnInto.set(program, formats);
  if (formats.has(format)) return false;
  formats.add(format);
  return true;
}

/** First draws the GPU may still be working through when the next is issued. */
const FIRST_DRAWS_QUEUED = 4;

/** Fences after the warm batches that first drew a program, oldest first. */
const firstDraws = {
  fences: [] as WebGLSync[],
  fence(gl: WebGL2RenderingContext): void {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) this.fences.push(sync);
    gl.flush();
  },
  /** Waits, without blocking, until fewer than `queued` first draws are still on the GPU. */
  async catchUp(gl: WebGL2RenderingContext, queued: number): Promise<void> {
    for (;;) {
      const oldest = this.fences[0];
      if (!oldest) return;
      if (gl.isContextLost() || gl.clientWaitSync(oldest, 0, 0) !== gl.TIMEOUT_EXPIRED) {
        gl.deleteSync(oldest);
        this.fences.shift();
      } else if (this.fences.length < queued) {
        return;
      } else {
        await idle(2);
      }
    }
  },
};

/**
 * Draws the scene in batches, with every object shown and none culled, into `target` (never presented): textures
 * upload, buffers land on the GPU, render targets are allocated and every program has its first draw, so the first
 * real frame, and the first view of every room, is an ordinary one. A batch holds at most one object whose program
 * has not been drawn yet, because a slow driver pays for a program's first draw in the task that issues it. `only`
 * limits the draws to some objects, such as those whose program variants are still undrawn. `onProgress` gets the
 * share of the objects drawn. Up to `FIRST_DRAWS_QUEUED` first draws may still be on the GPU when it resolves; the
 * next warm waits for them (`warmSimulations` waits for all).
 */
export async function warmRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget,
  only: (object: THREE.Object3D) => boolean = () => true, onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const hidden: THREE.Object3D[] = [];
  const masked: { object: THREE.Object3D; mask: number; culled: boolean }[] = [];
  const candidates: { object: Drawable; mask: number }[] = [];
  const previousTarget = renderer.getRenderTarget();
  const gl = renderer.getContext() as WebGL2RenderingContext;
  scene.traverse(o => {
    if (!o.visible) { hidden.push(o); o.visible = true; }
    if ('material' in o) {
      masked.push({ object: o, mask: o.layers.mask, culled: o.frustumCulled });
      if (isDrawable(o) && only(o) && o.layers.mask & camera.layers.mask) candidates.push({ object: o, mask: o.layers.mask });
      // Layers suppress this draw without hiding any children.
      o.layers.mask = 0;
      o.frustumCulled = false;
    }
  });
  try {
    camera.updateMatrixWorld();
    renderer.setRenderTarget(target);
    const format = formatOf(target);
    let batch: typeof candidates = [];
    let fresh = false;
    let done = 0;
    const draw = async (): Promise<void> => {
      // A cold driver builds a program's GPU pipeline at its first draw, and while the GPU is busy with those,
      // uploads in later draws block the main thread.
      if (fresh) await firstDraws.catchUp(gl, FIRST_DRAWS_QUEUED);
      const undo: (() => void)[] = [];
      for (const { object, mask } of batch) {
        object.layers.mask = mask;
        const restore = somethingToDraw(object);
        if (restore) undo.push(restore);
      }
      renderer.render(scene, camera);
      for (const restore of undo) restore();
      for (const { object } of batch) object.layers.mask = 0;
      if (fresh) firstDraws.fence(gl);
      done += batch.length;
      onProgress(done / candidates.length);
      batch = [];
      fresh = false;
    };
    for (const entry of candidates) {
      const programs = programsOf(renderer, entry.object, camera, scene);
      const undrawn = programs.some(p => !drawnInto.get(p)?.has(format));
      if (batch.length >= WARM_BATCH || (undrawn && fresh)) {
        await draw();
        await keepPainting();
      }
      batch.push(entry);
      for (const p of programs) firstDrawn(p, format);
      fresh ||= undrawn;
    }
    if (batch.length) await draw();
  } finally {
    renderer.setRenderTarget(previousTarget);
    for (const { object, mask, culled } of masked) {
      object.layers.mask = mask;
      object.frustumCulled = culled;
    }
    for (const o of hidden) o.visible = false;
  }
  onProgress(1);
}

/** The objects `warmRender` will draw, so progress can count them before it starts. */
export function warmCount(scene: THREE.Scene, camera: THREE.Camera, only: (object: THREE.Object3D) => boolean = () => true): number {
  let count = 0;
  scene.traverse(o => { if (isDrawable(o) && only(o) && o.layers.mask & camera.layers.mask) count++; });
  return count;
}

/**
 * Draws each full-screen pass once into a small scratch target with the format of the one it really writes (a
 * driver builds a pipeline per program and target format), so its first draw in play is an ordinary one and nothing
 * it really writes changes. Passes whose material has been disposed are skipped.
 */
export async function warmSimulations(renderer: THREE.WebGLRenderer, passes: readonly { material: THREE.Material; writes: THREE.WebGLRenderTarget }[],
  onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const quad = new FullScreenQuad();
  const scratch = new Map<string, THREE.WebGLRenderTarget>();
  const previousTarget = renderer.getRenderTarget();
  let done = 0;
  try {
    for (const { material, writes } of passes) {
      const program = renderer.properties.has(material) ? (renderer.properties.get(material) as { currentProgram?: THREE.WebGLProgram }).currentProgram : undefined;
      const format = formatOf(writes);
      if (program && firstDrawn(program, format)) {
        let target = scratch.get(format);
        if (!target) {
          const texture = writes.textures[0] as THREE.Texture;
          target = new THREE.WebGLRenderTarget(4, 4, { count: writes.textures.length, type: texture.type, format: texture.format as THREE.PixelFormat, colorSpace: texture.colorSpace as THREE.ColorSpace,
            samples: writes.samples, depthBuffer: writes.depthBuffer, stencilBuffer: writes.stencilBuffer, generateMipmaps: false });
          scratch.set(format, target);
        }
        await firstDraws.catchUp(gl, FIRST_DRAWS_QUEUED);
        renderer.setRenderTarget(target);
        quad.material = material;
        quad.render(renderer);
        firstDraws.fence(gl);
        await keepPainting();
      }
      onProgress(++done / passes.length);
    }
    await firstDraws.catchUp(gl, 0);
  } finally {
    renderer.setRenderTarget(previousTarget);
    for (const target of scratch.values()) target.dispose();
  }
  onProgress(1);
}

/** Resolves once the GPU has finished everything issued so far, polling without blocking the main thread. */
export function gpuIdle(renderer: THREE.WebGLRenderer, timeoutMs = 4000): Promise<void> {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const started = performance.now();
  return new Promise((resolve) => {
    const check = (): void => {
      // A lost context invalidates its fence; only a fresh page may restart the simulation.
      if (gl.isContextLost()) { resolve(); return; }
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

/** QA: counts programs first used (three's info-log query) outside `settlePrograms`, naming the first few. */
export function watchStrayPrograms(renderer: THREE.WebGLRenderer): { count: number; names: string[] } {
  const gl = renderer.getContext();
  const stray = { count: 0, names: [] as string[] };
  const infoLog = gl.getProgramInfoLog.bind(gl);
  gl.getProgramInfoLog = (program: WebGLProgram): string | null => {
    if (!settling) {
      stray.count++;
      const three = renderer.info.programs?.find(p => p.program === program) as (THREE.WebGLProgram & { type?: string }) | undefined;
      if (stray.names.length < 8) stray.names.push(`${three?.name || three?.type || 'program'} #${three?.id ?? '?'}`);
    }
    return infoLog(program);
  };
  return stray;
}

/** QA `?coldshaders`: every fragment shader is new to the browser's and the driver's caches, so each load compiles cold. */
export function coldShaders(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  // A comment would not do: WebKit caches translated code, which drops comments.
  const line = ` if (gl_FragCoord.x < -${crypto.getRandomValues(new Uint32Array(1))[0] + 1}.0) discard;`;
  const fragments = new WeakSet<WebGLShader>();
  const create = gl.createShader.bind(gl);
  const source = gl.shaderSource.bind(gl);
  gl.createShader = (type: GLenum): WebGLShader | null => {
    const shader = create(type);
    if (shader && type === gl.FRAGMENT_SHADER) fragments.add(shader);
    return shader;
  };
  gl.shaderSource = (shader: WebGLShader, text: string): void => {
    source(shader, fragments.has(shader) ? text.replace(/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/, `$&${line}`) : text);
  };
}

/**
 * QA: programs, and programs with the target format they draw into, first drawn after `begin()` (Begin), naming the
 * first few. A draw that issues nothing (no vertices or instances) does not count, because nothing was built for it.
 */
export function watchFirstDraws(renderer: THREE.WebGLRenderer): { begin(): void; report(): { programs: number; names: string[]; pairs: number; pairNames: string[] } } {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const programs = new Set<WebGLProgram>();
  const pairs = new Set<string>();
  const ids = new Map<WebGLProgram, number>();
  const after = { programs: [] as string[], pairs: [] as string[] };
  let current: WebGLProgram | null = null;
  let format = 'screen';
  let begun = false;
  const nameOf = (program: WebGLProgram): string => {
    const three = renderer.info.programs?.find(p => p.program === program) as (THREE.WebGLProgram & { type?: string }) | undefined;
    return `${three?.name || three?.type || 'program'} #${three?.id ?? '?'}`;
  };
  const drawn = (count: number, instances = 1): void => {
    if (!current || count <= 0 || instances <= 0) return;
    if (!ids.has(current)) ids.set(current, ids.size);
    const pair = `${ids.get(current)} ${format}`;
    if (!programs.has(current)) {
      programs.add(current);
      if (begun) after.programs.push(nameOf(current));
    }
    if (!pairs.has(pair)) {
      pairs.add(pair);
      if (begun) after.pairs.push(`${nameOf(current)} into ${format}`);
    }
  };
  const use = gl.useProgram.bind(gl);
  gl.useProgram = (program: WebGLProgram | null): void => { current = program; use(program); };
  const setTarget = renderer.setRenderTarget.bind(renderer);
  renderer.setRenderTarget = (target, face, level): void => {
    const texture = target ? target.textures[0] as THREE.Texture : null;
    format = target && texture ? `${texture.type}/${texture.internalFormat ?? texture.format}x${target.textures.length}${target.samples ? ` msaa${target.samples}` : ''}${target.depthBuffer ? ' depth' : ''}${target.stencilBuffer ? ' stencil' : ''}${texture.colorSpace === THREE.SRGBColorSpace ? ' srgb' : ''}` : 'screen';
    setTarget(target, face, level);
  };
  const arrays = gl.drawArrays.bind(gl), elements = gl.drawElements.bind(gl);
  const arraysInstanced = gl.drawArraysInstanced.bind(gl), elementsInstanced = gl.drawElementsInstanced.bind(gl);
  gl.drawArrays = (mode, first, count) => { drawn(count); arrays(mode, first, count); };
  gl.drawElements = (mode, count, type, offset) => { drawn(count); elements(mode, count, type, offset); };
  gl.drawArraysInstanced = (mode, first, count, instances) => { drawn(count, instances); arraysInstanced(mode, first, count, instances); };
  gl.drawElementsInstanced = (mode, count, type, offset, instances) => { drawn(count, instances); elementsInstanced(mode, count, type, offset, instances); };
  return {
    begin() { begun = true; },
    report: () => ({ programs: after.programs.length, names: after.programs.slice(0, 40), pairs: after.pairs.length, pairNames: after.pairs.slice(0, 60) }),
  };
}
