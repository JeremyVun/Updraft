# The engine: frame, readbacks, quality, post

How a frame is produced and what keeps it smooth. Story, mechanics and looks live elsewhere; this is the layer they sit on. Code: `src/gl/`, `src/post/post.ts`, the loop in `src/main.ts`.

## Boot (`src/gl/boot.ts`, `boot()` in `main.ts`)

Nothing heavy is allowed to happen in the first frames. Before the loop starts, behind the veil:

1. Every scene material compiles in parallel (`precompile`, `KHR_parallel_shader_compile`), against the scene's half-float target: a program's cache key depends on the target's colour space, so compiling against the screen would compile everything twice.
2. Every simulation and bake material compiles the same way (`precompileSim`; `simMaterial` registers them).
   Grass-table materials compile separately against their four-attachment targets; they are not part of the
   scene or the single-target simulation registry. The initial visible tables bake before Begin.
3. The window is placed for the camera the story chose and baked once (`followWindow(..., true)`).
4. Warm batches draw the scene into the offscreen target, yielding for input and paint between each 64 objects, then run the post chain. Original visibility and layer masks are restored even on failure. Textures upload, buffers land on the GPU, and render targets are allocated.
5. `gpuIdle` waits (polling a fence, never blocking) until the GPU has finished all of it. The start screen then enables Begin / Continue. Only the activation gesture starts audio and `requestAnimationFrame(frame)`; the story and quality governor do not run while waiting.

World construction also yields between major systems so setup does not monopolise the browser in one long task.
The start screen's hollow ring is a browser-owned SVG cursor: its movement does not depend on JavaScript
servicing pointer events during WebGL initialization. The animated gameplay cursor stays unchanged.
A local production-preview profile reduced the worst opening frame gap from 950 ms to 167 ms; individual
constructors and driver calls can still cause shorter pauses. These changes only affect startup.
The start-screen check records the worst boot frame gap (default ceiling 500 ms, override with `BOOT_MAX_MS`).

`src/entry.ts` paints the DOM/SVG start screen before dynamically importing the game. Module and boot failures keep a retry button available. The first real frames trigger the veil fade; its listeners, SVGs and animation loop are removed after the transition. `?shot` bypasses the screen and sound activation for existing QA; add `start=1` to test the real gate with QA access. `node tools/start-check.mjs` verifies entry, pause, audio, touch, keyboard, resume and retry in isolated Chrome (set `BASE` for a production preview).

Anything that appears later in the story (the whale, rain, fireflies, the drawing) is already compiled and uploaded; showing it costs nothing.

## Frame order (`frame()` in `main.ts`)

1. CPU-only work first: input, story, the traveller, the boat, the glider. No GPU commands yet.
2. `pollReadbacks()`: finished GPU→CPU copies land (see below). This is the one place a frame may touch a read buffer.
3. GPU simulation: wind substeps, life, the light re-bake if the sun has moved, petals, wind lines.
4. Camera update, then everything that depends on where it is: the window follow (with its bakes and shifts), the cloud-shadow bake for the camera's domain, terrain leaves, grass tiles, walls.
5. The doorway view when open, the current room's sea reflection, then the post chain (scene → resolve → bloom → grade → screen).
6. `endFrame()` fences the frame so the next one can tell whether the GPU has caught up.

## Readbacks (`src/gl/readback.ts`)

The wind field, the life field and the height bake are read back to the CPU for gameplay. In Chrome, mapping a read buffer blocks until the GPU process has executed every command issued before the map, so a readback issued and mapped mid-frame stalls for the whole frame's rendering, and a GPU-bound frame turns into a CPU stall too (that was the original stutter: 60-140 ms every few frames).

`Readback` therefore never waits: `request` copies the target into a fresh pixel buffer and fences it; `pollReadbacks` maps only buffers whose fence has signalled, and only when the fence of the frame before last has signalled as well (the display pipeline is normally two frames deep), so the map is a memcpy. A fresh buffer per request matters: the driver keeps a CPU shadow of a fenced read buffer, and reusing the buffer discards it and turns the read into a blocking GPU copy.

If the GPU stays behind (a saturated device, or another process on the GPU), the gate would starve the CPU copies. So one blocking delivery is accepted anyway now and then: a quarter second after a cheap one, two seconds after one that blocked for more than 6 ms, whatever the frame rate. The CPU wind copy is then up to a few frames older than usual, which the consumers tolerate, and the quality governor is stepping the load down meanwhile. `__stats.readbacksSkipped / readbacksForced / readbacksDelivered / readbackWorstMs` show what happened.

## Quality governor (`src/gl/quality.ts`)

Explicit render-scale overrides are exact, including values below 1. Startup selects the lowest rung if even
that exceeds the pixel budget, and applies its multisampling before allocating the scene target. The governor
resets its timing when play begins or page visibility changes: time behind Begin or in another tab cannot earn
a quality increase. `node tools/quality-check.mjs` verifies these cases and normal adaptation.

The governor targets 60 fps on every device. Every 1.5 seconds it reviews up to 90 real frame intervals,
discarding the slowest 5%. A trimmed mean above 17.6 ms lowers quality; a sustained p90 below 17.2 ms for
12 seconds earns one increase. Failed increases double the next wait, up to two minutes. A single hitch or
hidden-tab time cannot earn a change. A new level settles for 2.5 seconds after a reduction, one second after
an increase.

The ladder lowers render scale from DPR (capped at 2) to 1, then multisampling to 2, then world detail,
before resorting to subpixel scales of 0.85 and 0.72. Full grass recovers before extra antialiasing. World detail controls:

| Level | Grass density | Grass reach | Terrain split factor | Reflection cadence | Sky-mirror scale |
| --- | --- | --- | --- | --- | --- |
| Full | 100% | 100% | 1.6 | Every frame | 0.75 |
| Medium | 55% | 85% | 1.35 | Every frame | 0.625 |
| Low | 25% | 70% | 1.1 | Alternate frames | 0.5 |

The opening pixel budget is 2.2 million. Touch starts at medium world detail and at most 1.25× render scale;
this is only a starting point. It has the same full-quality ceiling as a mouse device. The governor restores
full grass before climbing above 1×. Grass grows/shrinks in place over one second while its distance rings
move continuously. Tables reserve capacity for all levels at boot; quality changes do not allocate or
recompile grass resources. The lowest density skips fine populations after the fade completes.

`?ratio=` or `?msaa=` locks the governor for reproducible QA, using full world detail. `?grass=` overrides
grass density, `?mirror=` overrides reflection cadence, and `?lite=1` explicitly pins the old low world
preset and cheaper simulation. Touch no longer implicitly enables lite. Wind resolution, solver cadence
and water mesh topology stay fixed during play; changing simulation fidelity safely needs separate state
transfer and gameplay verification. Normal play uses the full wind simulation and water mesh.

`node tools/quality-check.mjs` checks touch promotion, geometry fallback/recovery, exact overrides and
suspend/resume. `node tools/grass-quality-check.mjs meadow` checks both transition directions, unchanged
blade roots, resource identity and pixel-identical restoration in a frozen GPU scene. `TOUCH=1` in
`tools/play.mjs` emulates a coarse pointer for integration checks, not iPad GPU performance.
`node tools/quality-browser-check.mjs` drives measured-interval scenarios through the real coarse-pointer
browser wiring: full grass, low-detail overload, restoration, terrain budgets and reflection cadence.
The frozen meadow test submitted 83,456 blades at full detail and 29,440 at low detail (65% fewer).
Meadow and sleeping-island down/up cycles both restored the full-quality pixels exactly. These checks
establish adaptation and rendering correctness; they do not establish frame rates on an actual iPad.

## Post chain (`src/post/post.ts`)

One multisampled half-float scene target; one resolve pass that also clamps NaN/inf and huge highlights (bloom would smear one bad pixel across the screen); bloom added in place on that plain target; the grade (ACES, split toning, vignette, grain) straight to the screen. Only the scene target is multisampled: the previous composer resolved three multisampled targets per frame.

## Storm transitions

The shared key light moves continuously from the sunset direction to the moon between dusk 1.5 and 1.85;
it previously jumped 71° at dusk 1.5. Lightning is a separate cloud flash, gated by rain, darkness and elapsed
storm time. Dense storm cover fades directional terrain shadows to diffuse light and skips their ray marches;
clearing the cloud forces a fresh shadow bake even if the moon has stopped moving. `node tools/storm-profile.mjs` measures the underway passage without screenshot/video overhead,
reporting frame stalls, blocking GPU calls, lighting-direction jumps and chapter boundaries.

## Bakes that follow the world

- Window moves (`followWindow`) re-bake the height, surface and light of the window and shift the wind, lean and life textures, all in the same frame. Whole-texel steps keep everything aligned.
- The light bake alone re-runs whenever the sun has moved by more than 0.0004 rad, at most every third frame. The old threshold (0.006 rad) let long sunset shadows jump several units at each re-bake, which read as a flicker on the walk inland.
- The sea's mirror (a second render of the terrain and the travellers at quarter size) uses a much coarser set of terrain leaves (`MIRROR_SPLIT`): through ripples at quarter size the reflected land is identical on the same frame (`?mirrorlod=full` to compare). In the lite tier it is also drawn on alternate frames; that one-frame lag is faintly visible in a still comparison, so it is not the desktop default (`?mirror=1|2|0`).
- The sky mirror enables the planar pass around its offshore sandflat even beyond the usual coastal cutoff.
  It uses 0.75 resolution (0.5 in lite mode), projects at the sea surface and adds local ring distortion.
  The ordinary sea retains its quarter-resolution reflection.
- Grass blades the density alone rejects leave the vertex shader before any texture lookup; every later factor only lowers `keep`, so the result is identical.
- Grass-table clears and draws are scissored to occupied rows. Storage stays allocated across camera movement;
  newly occupied rows are filled before drawing. In the meadow review frame this touches 83 of 539 allocated
  rows (85% fewer), with no change in blade density, reach or shading.
  A level's table is reused while its tile list and fixed traits are unchanged. Season, grass palette,
  flattened patches and window/ground rebakes invalidate it; wind, life and lighting remain live in the blade
  shader. Unchanged tile lists also skip their buffer and texture uploads.
- Terrain computes fog first and skips surface shading only when fog opacity is exactly 1. The colour is
  unchanged, including in reflections. `node tools/render-cost-check.mjs <chapter>` compares both optimizations
  against full work in the same frozen GPU state, including changing tile populations and the reflection view.
- The blade table (`TABLE_FRAG` in `grass.ts`): everything about a blade that is the same for all of its vertices and does not change frame to frame (root, height, width, facing, curve, tint, flower) is computed once per blade into four texels when its fixed inputs or tile list change, and the blade shader reads them. Before, all of it (two fbm, the field lookup, the tint's three fbm) ran for every one of the blade's thirteen vertices. The random draws happen in the same order, so every blade stands where it stood; `?blades=direct` restores the old shader for comparison (mean difference on the same frame: 0.06 of 255).
- Grass levels of detail draw one population of blades, not three. Level 1 (16x16 a tile) holds one chosen blade from every 2x2 block of level 0's cells (32x32) and level 2 (8x16) one from every pair of level 1's; the chosen blades carry the lowest thinning ranks. Thinning, blade width and the far sink depend on distance from the eye alone, never on the level, so by the time every blade of a tile is past a ring the blades still standing are exactly the next level's, and the tile changes level with no change on screen (no hysteresis needed). Each level's blade also closes its lowest segment across its thinning band, so the tessellation matches too. A blade about to be thinned shrinks whole into the ground over a few metres of camera travel instead of vanishing. Before this, each level hashed its own unrelated blades (32², 17², 10²), and a tile crossing the 52 m ring was redrawn at once as a different patch of grass. `grasslod=<0|1>` caps the coarsest level for a same-frame diff (0.0002 of 255 against `grasslod=1`; `grasslod=0` differs only beyond the second ring, where level 0 has no second segment to close).
- A sparsely sown meadow (the lite tier's quarter density) starts its tiles at the first level that holds every blade it can show, so a phone does not run the vertex shader over blades that never appear.
- Blade fragments clamp `vT` and `vSun`: under multisampling a sliver of a blade is evaluated outside its own edges, where they extrapolate far past 1 and light one pixel like a spark, which bloom then spreads.
- Grass tiles are culled against a sphere sized from the ground under the whole tile, so tiles on a cliff do not drop out at the edge of the screen.

## On a phone

## Where the frame went (2026-09-17)

The meadow was the one room that could not hold 60 at render scale 1, and two things were paying for it. The
pressure solve ran one Jacobi relaxation per pass; it now runs **two relaxations in one pass**, bit for bit what
two passes produced — each neighbour's relaxed pressure is rebuilt from the same texels, with neighbour positions
clamped as sampling clamps them, and rounded to half float as the intermediate target would have rounded it — so
the sim costs half the passes, and a pass on a tiled GPU carries a fixed load and store on top of its pixels. And
the blade's root colour, its ambient occlusion and how flat the wind has laid it were computed per fragment,
which under multisampling is several times per pixel; they are per-blade quantities and are now computed **once
per vertex** (`BLADE_SHADE_GLSL`, shared by the table and direct paths). Median of three back-to-back runs at
`ratio=1&msaa=2`: p90 33.3 ms → 16.8, frames over 25 ms in twelve seconds about 89 → 70, the same frame
pixel-for-pixel. The island of lines and the drowned village were already locked at 16.7 and stayed there.

`?stats` draws a small readout (frame percentiles, CPU time inside the frame, quality level, readback counts, draw calls, boot time) for devices without a debugger. The explicit `?lite=1` comparison preset uses: 128² wind with 12 pressure iterations and one substep, a quarter of the grass at 0.7× reach, and far terrain that splits less. The costs that do not shrink with resolution matter most there: the wind simulation (about 35 passes of 256² per substep), the life, cloud and petal passes, and bloom. The sim never runs more than two substeps a frame, so a slow frame cannot multiply its own cost.

## Before/after flags

Each optimisation that could conceivably change the picture keeps its old path behind a query flag, so two captures of the same frame can be diffed: `blades=direct` (per-vertex grass), `grasslod=0|1` (no coarse grass levels), `mirrorlod=full` (full terrain in the reflection), `mirror=1|2|0` (reflection cadence), `lite=1` (fixed cheaper simulation and low world detail). Add `hold=<frame>` and capture with `tools/play.mjs` after an `eval` step that waits for `__stats.frame`: the world freezes at that frame, so two runs capture the very same state, and runs of the same variant are pixel-identical. The only differences left between variants come from creatures and the scarf, which read the CPU wind copy and diverge when readbacks land on different frames.

## Measuring

`node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query] ['<steps>']` runs the game in local Chrome and reports from inside the page: frame-interval percentiles and hitches, which native WebGL calls block the main thread, a CPU profile, or frame-to-frame image change spikes (pops and flashes). To hunt level-of-detail pops, freeze the world (`hold=150` with a fixed `cam=`), creep the camera a few millimetres a frame from an `eval` step that also calls `grass.update` and `grass.bake`, and lower the thresholds (`BLOCK=2 WHOLE=0.3`): with nothing else moving, any spike is a pop. At game speed the wind's own motion (about 6 of 255 a frame) hides them from this tool, though not from the eye. `?ratio=2` makes the GPU the bottleneck on purpose, which is how GPU cost is compared here: `EXT_disjoint_timer_query` numbers are meaningless on ANGLE's Metal backend.

Measurements start after readiness and a 1.5-second warmup (`WARMUP` overrides it); startup time is reported
separately. A reload during measurement invalidates the run. `__stats` readback counters and worst time remain
lifetime diagnostics, including startup; use the measured intervals or `gl` mode for steady-state stalls.

Every number from these tools is inflated by anything else using the GPU: another session's capture, a browser playing video. Check `ps` for busy Chrome processes before trusting a run, and compare builds back to back rather than against remembered numbers.

## Quality and performance review (2026-09-20)

The initial checkout, including its unpushed history, was committed and pushed as `1602154` before edits.
Measurements compare against that snapshot. Another session subsequently committed the first quality/grass
fixes as `adb67ef` and continued changing the sky-mirror chapter in the shared checkout.

The review also fixes scripted-input leakage: muted input clears its stroke and updraft, and direct plane
brushing respects the mute. The cygnet's bandage now skins each sampled wing vertex once per pose, preserving
scaled joint displacements and fingertip contact. Its standalone benchmark went from about 144 to 109 ms per
1,000 updates (24% less CPU work), with identical positions and normals throughout wrapping and release.
This is a component saving, not a 24% improvement in whole-game frame time.

Local Chrome/Metal measurements, twelve seconds after warmup, fixed 2× MSAA:

| View | Before | After |
| --- | --- | --- |
| Meadow, 1600×900, scale 1 | p90 16.7 ms; no frames over 25 ms | p90 16.7 ms; no frames over 25 ms |
| Meadow, scale 2 (3200×1800) | p90 33.3 ms; 104–113 frames over 25 ms in two runs | p90 33.3 ms; 78 frames over 25 ms |

The stress result shows some headroom, not sustained 60 fps at double scale. Real low-end hardware has not
been measured. Graphics defaults were unchanged by this first review; the governor follow-up above removes the fixed touch-device grass cap.

Validation: production build/typecheck; quality and muted-input regressions; exact bandage geometry and
wing-care/checkpoint checks at 30/60/120 fps; little-boats, mirror, sea, sleeping, wood, kite and scarf logic;
GPU terrain/height/shader checks across nine chapter starts; Begin/tab-resume checks; same-frame grass,
cache-invalidation and terrain comparisons in meadow, sleeping and lite wood, with zero changed pixels.
Reusable focused checks: `tools/quality-check.mjs`, `tools/bandage-cost-check.mjs`,
`tools/render-cost-check.mjs`. The production build retains its existing main-chunk size warning.

Remaining findings that need a separate decision or larger change:

- **Wind simulation time depends on display rate** (`src/wind/field.ts`, `step`). A one-second stepping audit
  executes two seconds of fixed simulation at 120 fps and 1.5 seconds at 90 fps. Lite mode executes half a
  second at 30 fps. The per-frame gust impulses and per-second lift forces need consistent accumulation before
  changing the solver cadence; simply dropping alternate frames loses input or changes the wind's feel.
  A fixed 60 Hz solver with accumulated gesture forces is the recommended follow-up, tested at 30/60/90/120 Hz.
- **Saturated GPU readbacks still hitch.** Locked 3200×1800 meadow runs force roughly six readback deliveries
  in twelve seconds and spend around 60–90 ms on some of them. This is the existing stale-input escape hatch,
  not normal-resolution behavior. The quality governor ordinarily lowers resolution. A device that remains
  overloaded on its lowest rung needs a measured simulation/geometry budget, not higher default graphics.
- **Startup constructs the whole journey.** The main production chunk remains about 1.58 MB (482 KB gzip),
  and distant rooms allocate and warm their resources before Begin. Local readiness is around 3–4 seconds;
  that is not a low-end-phone measurement. Loading rooms ahead of travel would need explicit lifetime,
  checkpoint and shader-warmup handling. The adaptive defaults still need target-device captures, especially the full wind simulation on low-end phones.

The sleeping island's unresolved narrative/comprehension concerns are already recorded in `docs/sleeping.md`;
they require design judgment rather than an engine patch. No narrative redesign is included here.

## The washing island's doorway

`world/doorway.ts` draws one translated camera into a half-float target, then samples it projectively inside the
red door. An oblique near plane clips the destination at its threshold. The image enters the normal scene pass,
so bloom and grading happen once. There is no recursive portal rendering or second simulation.

Before arrival, a negative `uRoom` radius excludes the secret shore from terrain and water shading; its grass,
family and kite are hidden during both the scene and reflection pass. The occupied boat remains visible.
Each doorway view has an explicit scene-object set and a positive terrain radius (`uRoom`); the departure boat and kite cannot
appear beside the source doorway, and the ordinary washing cannot appear on the far shore. The terrain's existing
secondary leaf set serves the portal view. The sea grid is temporarily centred on that camera with its reflection
disabled; all render state is restored before the main pass. `world/door-shore.ts` supplies fixed-root, wind-reactive
short grass that both views can draw without moving the simulation window twice.

Traveller shaders receive a render-only translation for the doorway view and a threshold clip for the source
view. Each traveller follows the destination ground height beyond the sill, so the old hillside cannot lower
their feet into the new shore. World-space scarf vertices use the same translation. The camera waits for both travellers, crosses with an
explicit continuous shot, and the chapter transfers their logical positions once. The ordinary camera and window
follow then resume. The portal stops rendering after crossing. `tools/lines-check.mjs` checks the full route,
per-view object visibility, both travellers' transfer and checkpoint restore.
