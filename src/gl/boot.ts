import * as THREE from 'three';

/** New programs compiled together before their status is queried: the first query waits behind all of them. */
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

async function keepPainting(): Promise<void> {
  if (performance.now() - lastFrame >= PAINT_BUDGET_MS) await yieldBoot();
}

/** Waits without holding the main thread, noting any frame painted meanwhile. */
function idle(ms: number): Promise<void> {
  requestAnimationFrame(stamp);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Keep expensive CPU preparation below a short batch, without skipping or changing its fixed steps. */
export async function prepareInBatches(steps: Iterable<unknown>, budgetMs = 8): Promise<void> {
  let started = performance.now();
  for (const _ of steps) {
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

/** First use (three's `onFirstUse`: link status, info logs, uniform and attribute queries) of every program built so far. */
async function settle(renderer: THREE.WebGLRenderer): Promise<void> {
  const gl = renderer.getContext();
  const fresh = (renderer.info.programs ?? []).filter(p => !settled.has(p)) as Program[];
  while (!fresh.every(p => p.isReady())) {
    if (gl.isContextLost()) return;
    await idle(4);
  }
  for (const program of fresh) {
    settling = true;
    try {
      program.getUniforms();
    } finally {
      settling = false;
    }
    settled.add(program);
    await keepPainting();
  }
}

/**
 * Builds every program the jobs' materials are drawn with, at most `GROUP` new ones at a time, and gives each its
 * first use once the driver reports it compiled, so no draw or bake waits on a compile. Yields whenever a paint
 * budget has passed. `onProgress` gets the share of the jobs' materials settled, which only rises and ends at 1.
 * The render target is restored, and each job's state undone, even on failure.
 */
export async function settlePrograms(renderer: THREE.WebGLRenderer, jobs: readonly CompileJob[], onProgress: (fraction: number) => void = () => {}): Promise<void> {
  const total = jobs.reduce((n, job) => n + new Set(job.objects.flatMap(o => isDrawable(o) ? materialsOf(o) : [])).size, 0);
  const previousTarget = renderer.getRenderTarget();
  const built = (): number => renderer.info.programs?.length ?? 0;
  let compiled = 0;
  let settledAt = built();
  const report = async (): Promise<void> => {
    await settle(renderer);
    settledAt = built();
    onProgress(total ? compiled / total : 1);
  };
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
          if (built() - settledAt >= GROUP) await report();
          await keepPainting();
        }
      } finally {
        undo?.();
      }
    }
    await report();
  } finally {
    renderer.setRenderTarget(previousTarget);
  }
}

const drawn = new WeakSet<THREE.WebGLProgram>();
const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

/** The programs three will draw this object with in the current state, found by compiling it (nothing new is built). */
function programsOf(renderer: THREE.WebGLRenderer, object: Drawable, camera: THREE.Camera, scene: THREE.Scene): THREE.WebGLProgram[] {
  compileAlone(renderer, object, camera, scene);
  return materialsOf(object)
    .filter(m => m.visible)
    .map(m => (renderer.properties.get(m) as { currentProgram?: THREE.WebGLProgram }).currentProgram)
    .filter((p): p is THREE.WebGLProgram => !!p);
}

function culled(object: Drawable): boolean {
  if (!object.frustumCulled) return false;
  return (object as Partial<THREE.Sprite>).isSprite ? !frustum.intersectsSprite(object as THREE.Sprite) : !frustum.intersectsObject(object);
}

/**
 * Draws the scene in batches, with every object shown, into `target` (never presented): textures upload,
 * buffers land on the GPU and render targets are allocated, so the first real frame is an ordinary one. A batch
 * holds at most one object whose program has not been drawn yet, because a slow driver pays for a program's first
 * draw in the task that issues it. `only` limits the draws to some objects, such as those whose program variants are
 * still undrawn.
 */
export async function warmRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget, only: (object: THREE.Object3D) => boolean = () => true): Promise<void> {
  const hidden: THREE.Object3D[] = [];
  const masked: { object: THREE.Object3D; mask: number }[] = [];
  const candidates: { object: Drawable; mask: number }[] = [];
  const previousTarget = renderer.getRenderTarget();
  scene.traverse(o => {
    if (!o.visible) { hidden.push(o); o.visible = true; }
    if ('material' in o) {
      masked.push({ object: o, mask: o.layers.mask });
      if (isDrawable(o) && only(o)) candidates.push({ object: o, mask: o.layers.mask });
      // Layers suppress this draw without hiding any children.
      o.layers.mask = 0;
    }
  });
  try {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    renderer.setRenderTarget(target);
    let batch: typeof candidates = [];
    let fresh = false;
    const draw = (): void => {
      for (const { object, mask } of batch) object.layers.mask = mask;
      renderer.render(scene, camera);
      for (const { object } of batch) object.layers.mask = 0;
      batch = [];
      fresh = false;
    };
    for (const entry of candidates) {
      if (!(entry.mask & camera.layers.mask) || culled(entry.object)) continue;
      const undrawn = programsOf(renderer, entry.object, camera, scene).filter(p => !drawn.has(p));
      if (batch.length >= WARM_BATCH || (undrawn.length > 0 && fresh)) {
        draw();
        await keepPainting();
      }
      batch.push(entry);
      for (const p of undrawn) drawn.add(p);
      fresh ||= undrawn.length > 0;
    }
    if (batch.length) draw();
  } finally {
    renderer.setRenderTarget(previousTarget);
    for (const { object, mask } of masked) object.layers.mask = mask;
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
