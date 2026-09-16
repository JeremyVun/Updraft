import * as THREE from 'three';

interface Pending<T> {
  buffer: WebGLBuffer;
  sync: WebGLSync;
  tag: T;
}

const all: Readback<unknown>[] = [];
/** Fences of the last frames, oldest first; the pipeline is allowed to be this many frames deep. */
const frameSyncs: WebGLSync[] = [];
/**
 * Three, not two: in the rooms where the grass is the room the GPU runs a frame further behind than the display
 * pipeline, and waiting on a fence it has not reached yet is a hundred-millisecond stall in the middle of a walk.
 * Costing the wind and life copies one more frame of staleness is not something any of them can feel.
 */
const PIPELINE_DEPTH = 3;
let frameGl: WebGL2RenderingContext | null = null;
let nextForceAt = 0;
/** A forced delivery that blocked for long is not repeated for this long; a cheap one much sooner. */
const COSTLY_WAIT_MS = 2000;
const CHEAP_WAIT_MS = 250;
const COSTLY_MS = 6;
export const readbackStats = { skipped: 0, forced: 0, delivered: 0, worstMs: 0 };

/**
 * Copies a float render target to the CPU without ever making the CPU wait for the GPU. `request` copies the
 * target into a pixel buffer and fences it; `pollReadbacks`, called first thing in a frame while the GPU queue
 * is empty, delivers only requests whose fence has already signalled. Anything still in flight waits a frame.
 *
 * Mapping a buffer in Chrome blocks until the GPU process has executed every command issued before the map,
 * so a readback issued and mapped mid-frame stalls for the whole frame's rendering. This never maps mid-frame.
 * Each request gets a fresh buffer: the driver keeps a CPU copy of a fenced read buffer, and reusing the
 * buffer before that copy is read throws it away and turns the read into a blocking GPU copy.
 */
export class Readback<T> {
  private readonly gl: WebGL2RenderingContext;
  private readonly pending: Pending<T>[] = [];
  private readonly data: Float32Array;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly width: number,
    readonly height: number,
    /** Receives each delivery; `data` is reused by the next one, so copy what must be kept. */
    private readonly onData: (data: Float32Array, tag: T) => void,
    private readonly inFlight = 3,
  ) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.data = new Float32Array(width * height * 4);
    all.push(this as Readback<unknown>);
  }

  /** Whether a request would be accepted now (fewer than `inFlight` are waiting on the GPU). */
  get ready(): boolean {
    return this.pending.length < this.inFlight;
  }

  /** Queues a copy of `target` (RGBA float, at least this size) tagged with `tag`; false when too many are in flight. */
  request(target: THREE.WebGLRenderTarget, tag: T): boolean {
    if (!this.ready) return false;
    const gl = this.gl;
    const buffer = gl.createBuffer()!;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.width * this.height * 16, gl.STREAM_READ);
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
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, next.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(next.buffer);
      gl.deleteSync(next.sync);
      readbackStats.delivered++;
      this.onData(this.data, next.tag);
    }
  }
}

/** Call after the frame's last GPU command: marks the point the GPU must reach before the next frame's readbacks. */
export function endFrame(renderer: THREE.WebGLRenderer): void {
  frameGl = renderer.getContext() as WebGL2RenderingContext;
  frameSyncs.push(frameGl.fenceSync(frameGl.SYNC_GPU_COMMANDS_COMPLETE, 0)!);
  frameGl.flush();
  while (frameSyncs.length > PIPELINE_DEPTH) frameGl.deleteSync(frameSyncs.shift()!);
}

/**
 * Call after the frame's CPU-only work and before its first GPU command. Finished readbacks are delivered when
 * the GPU has also finished the frame before last (the display pipeline is normally two frames deep); mapping
 * while it is further behind blocks until it catches up.
 * When the GPU stays behind (it is saturated), one such blocking delivery is accepted now and then rather than
 * letting the CPU copies go stale: every quarter second while they prove cheap, every two seconds while they
 * block for long, whatever the frame rate. The quality governor is meanwhile taking the load off the GPU.
 */
export function pollReadbacks(): void {
  let forced = false;
  const started = performance.now();
  if (frameSyncs.length >= PIPELINE_DEPTH && frameGl) {
    const status = frameGl.clientWaitSync(frameSyncs[0], 0, 0);
    if (status !== frameGl.ALREADY_SIGNALED && status !== frameGl.CONDITION_SATISFIED) {
      if (started < nextForceAt) {
        readbackStats.skipped++;
        return;
      }
      forced = true;
      readbackStats.forced++;
    }
  }
  for (const r of all) r.poll();
  const cost = performance.now() - started;
  if (cost > readbackStats.worstMs) readbackStats.worstMs = cost;
  if (forced) nextForceAt = started + cost + (cost > COSTLY_MS ? COSTLY_WAIT_MS : CHEAP_WAIT_MS);
}
