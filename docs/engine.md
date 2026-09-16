# The engine: frame, readbacks, quality, post

How a frame is produced and what keeps it smooth. Story, mechanics and looks live elsewhere; this is the layer they sit on. Code: `src/gl/`, `src/post/post.ts`, the loop in `src/main.ts`.

## Boot (`src/gl/boot.ts`, `boot()` in `main.ts`)

Nothing heavy is allowed to happen in the first frames. Before the loop starts, behind the veil:

1. Every scene material compiles in parallel (`precompile`, `KHR_parallel_shader_compile`), against the scene's half-float target: a program's cache key depends on the target's colour space, so compiling against the screen would compile everything twice.
2. Every simulation and bake material compiles the same way (`precompileSim`; `simMaterial` registers them).
3. The window is placed for the camera the story chose and baked once (`followWindow(..., true)`).
4. One warm frame draws the whole scene with every object shown into the offscreen target, then runs the post chain: textures upload, buffers land on the GPU, every render target is allocated.
5. `gpuIdle` waits (polling a fence, never blocking) until the GPU has finished all of it. Only then does `requestAnimationFrame(frame)` start.

Anything that appears later in the story (the whale, rain, fireflies, the drawing) is already compiled and uploaded; showing it costs nothing.

## Frame order (`frame()` in `main.ts`)

1. CPU-only work first: input, story, the traveller, the boat, the glider. No GPU commands yet.
2. `pollReadbacks()`: finished GPU→CPU copies land (see below). This is the one place a frame may touch a read buffer.
3. GPU simulation: wind substeps, life, the light re-bake if the sun has moved, petals, wind lines.
4. Camera update, then everything that depends on where it is: the window follow (with its bakes and shifts), the cloud-shadow bake for the camera's domain, terrain leaves, grass tiles, walls.
5. The sea's mirror render, then the post chain (scene → resolve → bloom → grade → screen).
6. `endFrame()` fences the frame so the next one can tell whether the GPU has caught up.

## Readbacks (`src/gl/readback.ts`)

The wind field, the life field and the height bake are read back to the CPU for gameplay. In Chrome, mapping a read buffer blocks until the GPU process has executed every command issued before the map, so a readback issued and mapped mid-frame stalls for the whole frame's rendering, and a GPU-bound frame turns into a CPU stall too (that was the original stutter: 60-140 ms every few frames).

`Readback` therefore never waits: `request` copies the target into a fresh pixel buffer and fences it; `pollReadbacks` maps only buffers whose fence has signalled, and only when the fence of the frame before last has signalled as well (the display pipeline is normally two frames deep), so the map is a memcpy. A fresh buffer per request matters: the driver keeps a CPU shadow of a fenced read buffer, and reusing the buffer discards it and turns the read into a blocking GPU copy.

If the GPU stays behind (a saturated device, or another process on the GPU), the gate would starve the CPU copies. So after `patience` closed frames one blocking delivery is accepted anyway; `patience` jumps to 30 frames whenever such a delivery cost more than 6 ms and relaxes by one each time it was cheap. The CPU wind copy is then up to a few frames older than usual, which the consumers tolerate, and the quality governor is stepping the load down meanwhile. `__stats.readbacksSkipped / readbacksForced / readbacksDelivered / readbackWorstMs` show what happened.

## Quality governor (`src/gl/quality.ts`)

A ladder of levels: render scale from the device's pixel ratio (capped at 2) down to 1 in steps of 0.25, then multisampling 4 → 2. Every 1.5 s it looks at the last 90 real frame intervals: if their trimmed mean (top 5% dropped) is over 17.6 ms it steps down (two steps when far over); after 12 s with the 90th percentile under 17.2 ms it steps back up, and a step down that undoes a recent step up doubles that wait, so levels never oscillate. The trim means a single hitch (a window move, a tab switch) never costs quality; the mean catches a GPU that misses every other refresh, which percentiles hide. Touch devices open at a scale of 1.25 and climb from there, since opening at the full 2× costs seconds of crawl before the first step down. `?ratio=` or `?msaa=` lock it for QA.

## Post chain (`src/post/post.ts`)

One multisampled half-float scene target; one resolve pass that also clamps NaN/inf and huge highlights (bloom would smear one bad pixel across the screen); bloom added in place on that plain target; the grade (ACES, split toning, vignette, grain) straight to the screen. Only the scene target is multisampled: the previous composer resolved three multisampled targets per frame.

## Bakes that follow the world

- Window moves (`followWindow`) re-bake the height, surface and light of the window and shift the wind, lean and life textures, all in the same frame. Whole-texel steps keep everything aligned.
- The light bake alone re-runs whenever the sun has moved by more than 0.0004 rad, at most every third frame. The old threshold (0.006 rad) let long sunset shadows jump several units at each re-bake, which read as a flicker on the walk inland.
- Grass tiles pick their level of detail with hysteresis (3 units past a ring), so the camera's breathing never reshuffles the blades of tiles sitting on a ring.

## On a phone

`?stats` draws a small readout (frame percentiles, quality level, readback counts, draw calls, boot time) for devices without a debugger. The costs that do not shrink with resolution matter most there: the wind simulation (about 35 passes of 256² per substep), the life, cloud and petal passes, and bloom. The sim never runs more than two substeps a frame, so a slow frame cannot multiply its own cost.

## Measuring

`node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query] ['<steps>']` runs the game in local Chrome and reports from inside the page: frame-interval percentiles and hitches, which native WebGL calls block the main thread, a CPU profile, or frame-to-frame image change spikes (pops and flashes). `?ratio=2` makes the GPU the bottleneck on purpose, which is how GPU cost is compared here: `EXT_disjoint_timer_query` numbers are meaningless on ANGLE's Metal backend.

Every number from these tools is inflated by anything else using the GPU: another session's capture, a browser playing video. Check `ps` for busy Chrome processes before trusting a run, and compare builds back to back rather than against remembered numbers.
