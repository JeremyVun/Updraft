import * as THREE from 'three';

interface Pending<T> {
  buffer: WebGLBuffer;
  sync: WebGLSync;
  tag: T;
}

const all: Readback<unknown>[] = [];
const query = new URLSearchParams(location.search);
/** Fences of the last frames, oldest first. */
const frameSyncs: WebGLSync[] = [];
const MAX_DEPTH = 3;
/**
 * Copies are mapped only once the GPU has finished the frame before last. In Chrome every `getBufferSubData`
 * is a synchronous round trip that waits until the GPU process has worked through everything submitted before
 * it, so each further frame allowed in flight is a further frame the map can wait behind.
 */
const DEPTH = Math.min(MAX_DEPTH, Math.max(1, Number(query.get('depth') ?? 2)));
/**
 * When nothing has been delivered for this long the gate relaxes to the frame before that, the deepest the
 * display pipeline normally runs. It never goes further: nothing is ever mapped while the GPU is further behind.
 */
const STALE_MS = Number(query.get('stale') ?? 100);
let frameGl: WebGL2RenderingContext | null = null;
let lastDelivery = 0;

/** Lifetime diagnostics, shown in `?stats` and `window.__stats`. */
export const readbackStats = {
  skipped: 0, delivered: 0,
  /** Longest whole `pollReadbacks`. */
  worstMs: 0,
  /** Time blocked in `getBufferSubData` (the round trip to the GPU process), total and longest. */
  waitMs: 0, waitWorstMs: 0,
  /** Longest delivery handler of each consumer (`Readback.name`). */
  work: {} as Record<string, number>,
};

/**
 * Copies a float render target to the CPU without making the CPU wait on the GPU's rendering. `request` copies
 * the target into a pixel buffer and fences it; `pollReadbacks`, called first thing in a frame while nothing new
 * has been submitted, delivers requests whose own fence has signalled, and only while the GPU has finished the
 * frame before last. Anything still in flight waits a frame. Each consumer keeps its own `inFlight` buffers,
 * allocated once and reused after delivery.
 */
export class Readback<T> {
  private readonly gl: WebGL2RenderingContext;
  private readonly pending: Pending<T>[] = [];
  private readonly free: WebGLBuffer[] = [];
  private readonly data: Float32Array;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly name: string,
    readonly width: number,
    readonly height: number,
    /** Receives each delivery; `data` is reused by the next one, so copy what must be kept. */
    private readonly onData: (data: Float32Array, tag: T) => void,
    inFlight = 3,
  ) {
    const gl = this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.data = new Float32Array(width * height * 4);
    for (let i = 0; i < inFlight; i++) {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      // Not a READ usage: Chrome shadows READ buffers into shared memory on every fence, a copy WebGL's
      // getBufferSubData never reads, and warns each time a pooled one is refilled. ANGLE's Metal backend
      // keeps STATIC_COPY buffers CPU-visible, as it does READ ones.
      gl.bufferData(gl.PIXEL_PACK_BUFFER, this.data.byteLength, gl.STATIC_COPY);
      this.free.push(buffer);
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    readbackStats.work[name] = 0;
    all.push(this as Readback<unknown>);
  }

  /** Whether a request would be accepted now (a buffer is free: fewer than `inFlight` are waiting on the GPU). */
  get ready(): boolean {
    return this.free.length > 0;
  }

  /** Queues a copy of `target` (RGBA float, at least this size) tagged with `tag`; false when too many are in flight. */
  request(target: THREE.WebGLRenderTarget, tag: T): boolean {
    const buffer = this.free.pop();
    if (!buffer) return false;
    const gl = this.gl;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.renderer.setRenderTarget(prev);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    gl.flush();
    this.pending.push({ buffer, sync, tag });
    return true;
  }

  /** Delivers every finished request, oldest first. */
  poll(): void {
    const gl = this.gl;
    while (this.pending.length) {
      const next = this.pending[0];
      const status = gl.clientWaitSync(next.sync, 0, 0);
      if (status !== gl.ALREADY_SIGNALED && status !== gl.CONDITION_SATISFIED) break;
      this.pending.shift();
      const started = performance.now();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, next.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteSync(next.sync);
      this.free.push(next.buffer);
      const mapped = performance.now();
      readbackStats.waitMs += mapped - started;
      readbackStats.waitWorstMs = Math.max(readbackStats.waitWorstMs, mapped - started);
      readbackStats.delivered++;
      lastDelivery = mapped;
      this.onData(this.data, next.tag);
      readbackStats.work[this.name] = Math.max(readbackStats.work[this.name], performance.now() - mapped);
    }
  }
}

/** Call after the frame's last GPU command: marks the point the GPU must reach before the next frame's readbacks. */
export function endFrame(renderer: THREE.WebGLRenderer): void {
  frameGl = renderer.getContext() as WebGL2RenderingContext;
  frameSyncs.push(frameGl.fenceSync(frameGl.SYNC_GPU_COMMANDS_COMPLETE, 0)!);
  frameGl.flush();
  while (frameSyncs.length > MAX_DEPTH) frameGl.deleteSync(frameSyncs.shift()!);
}

/** A timer that fires this late cannot tell whether the GPU finished by the deadline. */
const LATE_MS = 2;

/**
 * Reports whether the GPU had finished everything submitted before the last `endFrame` by `deadline`, a
 * `performance.now()` time. A timer that fires late reports false: only a clear early finish counts.
 */
export function timeLastFrame(deadline: number, report: (finished: boolean) => void): void {
  const gl = frameGl;
  const sync = frameSyncs[frameSyncs.length - 1];
  if (!gl || !sync) return;
  setTimeout(() => {
    const onTime = performance.now() <= deadline + LATE_MS;
    report(onTime && gl.isSync(sync) && gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED);
  }, Math.max(0, deadline - performance.now()));
}

/** Whether the GPU has finished the frame `depth` frames back (with fewer fences, the oldest there is). */
function finished(gl: WebGL2RenderingContext, depth: number): boolean {
  const status = gl.clientWaitSync(frameSyncs[Math.max(0, frameSyncs.length - depth)], 0, 0);
  return status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED;
}

/**
 * Call after the frame's CPU-only work and before its first GPU command. Finished readbacks are delivered when
 * the GPU has also finished the frame before last; after `STALE_MS` without a delivery, the frame before that
 * will do. There is no blocking escape hatch: while the GPU is further behind, nothing is mapped and the CPU
 * copies simply age. Every consumer stays correct with older data. The wind and life copies carry the window
 * they were read in and are sampled in world space through it, so an old copy is late, never misplaced. The
 * height copy is installed only if it is the window last baked, and `heightAt` falls back to the exact
 * procedural terrain outside whatever grid it has. The quality governor is meanwhile taking the load off the GPU.
 */
export function pollReadbacks(): void {
  const started = performance.now();
  const gl = frameGl;
  if (gl && frameSyncs.length && !finished(gl, DEPTH)
    && (started - lastDelivery < STALE_MS || !finished(gl, MAX_DEPTH))) {
    readbackStats.skipped++;
    return;
  }
  for (const r of all) r.poll();
  readbackStats.worstMs = Math.max(readbackStats.worstMs, performance.now() - started);
}
