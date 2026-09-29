# The engine: frame, camera, readbacks, quality, post

How a frame is produced and what keeps it smooth. Story, mechanics and looks live elsewhere; this is the layer they
sit on. Code: `src/gl/`, `src/post/post.ts`, the camera in `src/camera.ts` and `src/camera-direction.ts`, and the loop
in `src/main.ts`.

## Boot (`src/gl/boot.ts`, `boot()` in `main.ts`)

Nothing heavy may happen in the first frames of play. Before the loop starts, behind the veil:

1. Every scene material compiles in parallel (`precompile`, `KHR_parallel_shader_compile`) against the scene's
   half-float target: a program's cache key depends on the target's colour space, so compiling against the screen
   would compile everything twice.
2. Every simulation and bake material compiles the same way (`precompileSim`; `simMaterial` registers them). Grass
   table materials compile separately against their four-attachment targets (`grass.precompile`).
3. The static atlases bake once: the field and ground-colour caches and the distant-height atlas (see Bakes).
4. The window is placed for the camera the story chose and baked (`followWindow(..., true)`), and the visible grass
   tables bake.
5. `warmRender` draws the scene into the offscreen target in batches of 64 objects, yielding for input and paint
   between them, then the post chain runs; visibility and layer masks are restored even on failure. Textures upload,
   buffers land on the GPU and render targets are allocated.
6. `gpuIdle` waits (polling a fence, never blocking) until the GPU has finished. The start screen then enables
   Begin / Continue. Only that gesture starts audio and `requestAnimationFrame(frame)`; the story and the quality
   governor do not run while waiting.

World construction yields between major systems, and long preparation such as the birches scarf settling runs in
short batches (`prepareInBatches`), so the veil keeps painting. Anything that appears later in the story is already
compiled and uploaded; showing it costs nothing. `node tools/start-check.mjs` fails if the worst boot frame gap
exceeds 500 ms (`BOOT_MAX_MS`); `node tools/boot-profile.mjs` records cold-load long tasks, blocking GL calls and a
CPU profile.

`src/entry.ts` paints the DOM/SVG start screen before dynamically importing the game; its hollow ring is a
browser-owned SVG cursor, so it moves even while JavaScript is busy with WebGL setup. `controls.ts` loads before the
game bundle, so quality, sound and fullscreen controls work on the veil without starting play or creating audio.
`?shot` bypasses the start screen and sound activation; add `start=1` to test the real gate with QA access.

Failure paths:

- `index.html` carries a tiny inline watchdog: if the entry chunk fails to load or has not signalled within its
  timeout, it shows the ordinary failure ("The game couldn't start. Try again.", reloading on click) with plain DOM
  calls. `entry.ts` cancels it as its first statement; later failures go through `startScreen.fail()`.
- Before the world is built, `gl/graphics-capability.ts` checks WebGL2's `EXT_color_buffer_float` (the grass table's
  mixed float/half-float MRT, the multisampled half-float scene target and the wind's float targets all need it) and
  size floors. A shortfall shows the same text with Try again hidden (`fail(permanent)`), since retrying cannot help.
- A failed `sound.start()` switches sound off, reports telemetry and still starts the loop.
- An uncaught exception inside a frame goes through `contextRecovery.trigger('runtime', error)`, the same pause, mute
  and recovery dialog as a lost WebGL context (`docs/contracts/progress.md`).

`node tools/failure-paths-check.mjs` fault-injects all four.

## Frame order (`frame()` in `main.ts`)

1. `gl/frame-pacer.ts` limits presentation to 60 frames a second (30 on Low), skipping excess display callbacks
   before any input, simulation or rendering; `shot` bypasses pacing. Actual elapsed time between presented frames
   reaches gameplay and telemetry. `gl/frame-time.ts` accepts up to 100 ms (`MAX_FRAME_TIME`) and divides it into at
   most three world updates of at most 1/30 s; ordinary 30–144 fps frames are one update. Time beyond 100 ms is
   discarded, not queued, so game time slows below 10 fps rather than catching up. The GPU wind keeps its own fixed
   60 Hz clock (`wind/clock.ts`, at most six ticks a frame), resampling held sources and stroke trails onto it.
2. Completed readbacks are polled once, before this frame submits any GPU work. The pointer's screen segment is
   snapshotted and interpolated across the world updates; each brush sees only its own segment.
3. Each world update advances input, story, actors, wind, life and particles, camera and world mechanics, in that
   order. The last one follows the world window and requests the wind readback after its final tick.
4. The final view is prepared once: lighting bakes, cloud shadows, terrain selection, grass tables and audio.
5. The doorway view renders when open, then the sea reflection, the scene and the post chain; `endFrame()` fences it.

Hidden tabs advance nothing, and visibility changes reset the timestamp. `shot` advances exactly 1/60 s per frame.
`__stats` reports game time, world-step count and size, simulated and discarded milliseconds.

On resize, `main.ts` sizes the displayed canvas and its drawing buffer from `innerWidth`/`innerHeight`, then the post
targets and camera from the same values (CSS `100vh` can include space behind Safari's toolbars). A viewport change
cancels any stroke in progress. `src/input/pointer.ts` keeps one primary pointer: a second finger cannot move or end
its stroke, and cancellation, lost capture, blur, hiding and resize discard pending motion and charge.

When a chapter changes, `Journey` keeps the previous chapter's prepared shot, pace and habitat focus until the new
chapter's first normal update, because several constructors leave those at the origin until then. Startup and
checkpoint restore do their own zero-time setup before the first camera cut.

## Cinematography (`src/camera.ts`, `src/camera-direction.ts`)

Jeremy's brief (2026-09-25): "Every time the camera moves (pans, zooms etc). It must have an "intention"… It needs to
feel cinematic and incredibly polished in terms of the camera direction the whole way through the game." Earlier:
"make sure we don't make it nauseating with the camera jerking in and out all the time", and it should feel "almost
like there wasn't an authored system in place". What intention means:

- **A move commits.** Room made for a subject (a thrown plane, the island in a farewell, a whale) opens on an eased
  curve and stays while the need may return, settling back only after it has stayed smaller a while, and slowly.
  Nothing pumps in and out with each throw, gust or flap.
- **The lens stays with the child.** It travels with what it follows, so walking and pausing do not stretch the shot,
  and a boat running aground does not stop the lens dead.
- **A side is chosen, not flipped.** The sailing camera rides the quarter away from the sail, but the sail must stay
  across for `crossingCamera.sideCommit` seconds before the view changes quarter, and a look back never changes side.
- **A look toward something is a glance, not a chase.** The whale is watched within `crossingCamera.whaleArc` of the
  travelling view, the storm's lighthouse within `storm.lighthouseCamera.arc` of astern; the lens never circles the
  boat to keep them.
- **Reveals ratchet.** Each piano answer steps the view back and up and it stays (`piano.restBack`, `restUp`).
- Deliberate single moves are allowed: the doorway's threshold path, the little-boats close-up while the child handles
  a toy, the birches' close-up for the circling snag, the Sleeping bedroom's glance to the window, the summit push-in.

How the rig does it:

- Chapters supply a preferred composition and the subjects that must share it. Optional `Shot.attention` names a
  point, its share of the gaze and an optional encounter angle; the director resolves it independently of the follow
  anchor, so a change of focus turns the lens rather than translating the view.
- Turns, focus, dolly and height are critically damped: a change builds speed rather than starting at full speed, and
  the orbit is capped at `maxTurnSpeed` (0.3 rad/s). World-space staging and subject-relative orbits hand their
  velocities on; cuts and `exact` paths clear them. `Shot.orbit` lets an explicit eye travel round its focus.
- Subject fitting and ground occlusion go through `Commitment`: an eased move toward what is needed that keeps the room
  it made until the need has stayed smaller for `fitHold` / `occlusionHold` seconds, then settles slowly. Only the
  primary's 0.9 NDC safety frame (`primarySafetyMargin`) is enforced at once. Chapters size room for play with the
  same class (`reach*`, the still island's plane).
- A follow carries `followShare` of its target's smoothed travel. Boat carry (`carryAnchor`) takes up the anchor's
  speed at once but brakes no harder than `carryBrake`, rejects anchor changes and teleports, and accepts real
  movement at low frame rates. The sailing view rides a smoothed hull heading (`crossingCamera.headingResponse`).
- Every half second the director compares five nearby angles within 0.18 rad of the preferred view for framing
  distance and terrain clearance. It favours the authored angle and needs a material improvement, a six-second hold
  and 1.5 s of consistent evidence before changing; it never pans because a timer expired.
- Rooms can supply static `Shot.obstacles` (the drowned village's roofs, chimneys and branches, built once). Sightline
  checks try small lateral offsets before asking for height; any rise is limited by the angle down to the child
  (`obstacleMaxElevation`), and the final elevation is checked, so fitting a landmark never becomes an overhead view.
  No per-frame scene search, raycast, GPU pass or readback is involved.
- Scripted beats and explicit wind or piano interactions suppress optional angle changes. A placed `eye` keeps its
  world-space approach; `composition: 'hold'` preserves staged motion; `exact` gives a continuous path with no
  clearance or fitting. Zero-time preparation cannot advance the camera.

Knobs: `tuning.cinematography`, `crossingCamera`, `drownedCamera`, `storm.lighthouseCamera`, `piano.rest*`.

To find indecision, `BASE=<preview> TRACE=1 node tools/playthrough.mjs <prefix>` records every camera step of a real
journey, and `node tools/camera-intent-report.mjs <prefix>` lists by chapter and beat the stalls (the lens nearly
stops while the child moves on), in-then-out swings (distance to the child more than 10% one way and back within
12 s), pan reversals (more than 7° and back within 10 s) and jerks, naming the rig correction behind each.
`node tools/storm-camera-trace.mjs` traces the storm alone. The gates are in [testing.md](testing.md).

## Readbacks (`src/gl/readback.ts`)

The wind field, the life field and the height bake are read back to the CPU for gameplay. In Chrome
`getBufferSubData` is a synchronous round trip: the page waits for every command submitted before it, so a map
mid-frame stalls for the whole frame's rendering, and a GPU-bound frame becomes a CPU stall.

- Maps happen only at the start of a frame, before anything new is submitted, and only for buffers whose own fence
  has signalled while the GPU has also finished the frame before last (`?depth=`, default 2). The first three frames
  of play map freely.
- After 100 ms without a delivery (`?stale=`) the gate relaxes to the frame before that, the deepest the display
  pipeline normally runs.
- After two seconds without a delivery, whole frames are held back (no simulation, no GPU work; the image stays up
  and the next frame catches the time up) until the GPU has caught up, so the map never waits behind a backlog. Only
  if it is still behind after four held frames is one map forced. The bound matters: the piano, the curtains and the
  embers read the wind through these copies. Shot mode never holds a frame.
- Each consumer allocates its pixel buffers once as `STATIC_COPY` (Chrome shadows READ-usage buffers into shared
  memory on every fence; ANGLE's Metal backend keeps `STATIC_COPY` CPU-visible) and reuses them. The 4 MiB height copy
  is taken in four 1 MiB slices on successive frames and installed only when complete.
- Older data stays correct: wind and life copies carry the window they were read in and are sampled in world space
  through it, so an old copy is late, never misplaced. A height copy is installed only if it belongs to the window
  last baked; `heightAt` falls back to the exact procedural terrain outside whatever grid it has.

`__stats` exposes `readbacksSkipped`, `readbacksDelivered`, `readbacksHeld`, `readbacksForced`, `readbackWorstMs`,
`readbackWaitMs`, `readbackWaitWorstMs` and each consumer's handler time.

## Quality governor (`src/gl/quality.ts`)

The Graphics selector offers Auto (default), High, Medium and Low; the choice persists in `updraft.quality.v1`.

| Preset | Render scale | MSAA | Grass density / reach | Presentation |
| --- | --- | --- | --- | --- |
| High | device pixel ratio, capped at 1.5 | scene default | 100% / 115% (`HIGH_GRASS_REACH`) | 60 fps |
| Medium | at most 1× | up to 2 | 100% / 95% | 60 fps |
| Low | 0.85 × min(DPR, 1) | up to 2 | 80% / 85% | 30 fps |
| Auto | adapts over the ladder below | | | 60 fps |

The scene's default MSAA is 4, or 2 on displays with a device pixel ratio of 1.75 or more. Manual presets never react to frame
timing. Jeremy's rulings: "keep high the same", with its grass reaching further than Auto's top rung (he asked for
more grass distance on High); Medium keeps full grass density and Low drops only to 80%; Low accepts 30 fps.

World detail (`WORLD_QUALITY`):

| Detail | Grass density | Grass reach | Terrain split | Reflection cadence | Sky-mirror scale |
| --- | --- | --- | --- | --- | --- |
| 2 (full) | 100% | 100% | 1.6 | every frame | 0.75 |
| 1 | 100% | 95% | 1.35 | every frame | 0.625 |
| 0 | 80% | 85% | 1.1 | alternate frames | 0.5 |
| Auto fallback | 25% | 70% | 1.1 | alternate frames | 0.5 |

The ordinary sea's reflection is redrawn at most every other frame in any case (unless the view has cut or the
rooms changed); the sky mirror uses the detail's cadence.

**Auto's ladder** lowers render scale from its ceiling to 1× in 0.25 steps, then multisampling to 2, then world
detail, then subpixel scales of 0.85× and 0.72×, and finally the Auto-only fallback. Full grass recovers before extra
antialiasing. Auto's ceiling is the largest scale within a sustained budget of 2.4 million pixels, and 1.25× on
touch; viewports too large for the fixed ladder get one more Auto-only rung at the budget ratio, never below 0.5×.
The canvas and every render target share one scale, kept within `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE` and
`MAX_VIEWPORT_DIMS`.

**Auto's decisions.** It opens at its ceiling with full detail. Every 1.5 s it reviews up to 90 frame intervals,
discarding the slowest 5%. A trimmed mean above 17.6 ms steps down (two rungs above 26.4 ms); a new level settles for
2.5 s after a reduction, 1 s after an increase. Below its ceiling it climbs on evidence: `main.ts` polls each frame's
fence 10 ms after submission (`timeLastFrame`, one timer, never a wait). A review with p90 under 17.2 ms in which at
least 90% of 30 or more timed frames finished by then climbs one rung at once; the next rung costs at most 1.56× the
pixels, so 10 ms stays inside one refresh. Fewer than a quarter on time rules a climb out; between the two, or where
frames can't be timed, 12 s of p90 under 17.2 ms earns one rung. A failed climb doubles the next wait, up to two
minutes. A steady 33 ms cadence is either a GPU missing every other refresh or a display capped at 30 fps (iOS Low
Power Mode): while intervals are that long, each frame's fence is timed against one 60 Hz refresh, and if at least 80%
of eight or more finish early the cap is proven and Auto judges against 30 fps until intervals under 25 ms show it
has lifted. A timer that fires late counts as not early. A single hitch, time behind Begin or in a hidden tab never
changes quality; Begin and visibility changes reset its timing. Pacing reports the longest display callback interval
since the last presentation, floored at 16.67 ms, so deliberately skipped 120/144 Hz callbacks don't look like
overload.

Grass grows and shrinks in place over one second while its distance rings move continuously. Tables reserve capacity
for every level at boot (about 28 MiB for the four attachments), so quality changes never allocate or recompile.
Wind resolution, solver cadence and water mesh topology never change during play.

Only the dev server and explicit QA builds accept game query overrides; the production build removes their parser
and QA tools. Use `npm run build:qa` and `npm run preview:qa` for instrumented checks against an optimised build.
In those builds, `?ratio=` or `?msaa=` locks the governor at exact values with full detail and hides the selector, as does `shot`.
`params-qa.ts` clamps `ratio` to (0, 4], `msaa` to [0, 16] and `grass` to [0, 4]; `main.ts` clamps `msaa` again to the
device's `MAX_SAMPLES`. `?grass=` overrides density, `?mirror=1|2|0` the reflection cadence.

## Post chain (`src/post/post.ts`)

One multisampled half-float scene target; one resolve pass that also clamps NaN, infinity and huge highlights (bloom
would smear one bad pixel across the screen); bloom added in place on that plain target; then the grade (ACES, split
toning, vignette, grain) straight to the screen. Only the scene target is multisampled.

## Bakes and caches

Static, baked once before Begin (runtime GPU allocations, not downloads):

- `world/terrain-fields.ts`: Meadow's fixed field pattern (boundary distance, field kind, wall and gate identity,
  coastal presence), 1024² RGBA16F, 8 MiB. Near edges, walls, gates and the coast, and outside the atlas, the
  original function still runs, so identities stay sharp.
- `world/terrain-colour.ts`: four low-frequency colour-noise inputs for every island, the doorway shore and the sky
  mirror, 1024×1376 RGBA16F, 10.75 MiB, with a two-texel blend back to the original function outside each patch.
  Palette, season, life, wind, shadows, frost and lighting stay live.
- `world/terrain-heights.ts`: the distant-height atlas, 1 m texels in R32F (about 6.6 MiB) read beyond the moving
  window. Cells where it would miss the formula by more than 1 cm keep the direct formula (flagged in the texel), and
  the open sea is an exact `seaFloor` expression. **`tools/terrain-heights-check.mjs` must pass again after any
  island's shape or position changes.** `?heights=direct` compares against the formula.
- `world/noise-tiles.ts`: the ground's four-octave noise as a 512² tiling texture with mips (about 0.35 MiB). The
  frost pattern samples one fixed level everywhere, so blades, ground and props agree.

Bakes that follow the world:

- A window move (`followWindow`) re-bakes the height (two passes, checked texel for texel by
  `tools/height-bake-check.mjs`), surface and light of the window and shifts the wind, lean and life textures in the
  same frame, in whole-texel steps. The shoreline (`water.bakeShore`) and grass tables follow.
- The light bake alone re-runs when the sun has moved more than 0.0004 rad, at most every third frame. Dense storm
  cover fades terrain shadows to diffuse light and skips their ray marches; clearing forces a fresh bake.
- The sea's mirror is a second render at quarter size with coarser terrain leaves (`MIRROR_SPLIT`; `?mirrorlod=full`
  compares). The sky mirror enables the planar pass around its sandflat at 0.75 scale (0.5 on low detail), projected
  at the sea surface with local ring distortion.
- Grass (`world/grass.ts`): per-blade constants (root, height, width, facing, curve, tint, flower) are computed once
  into a blade table (`TABLE_FRAG`, four texels a blade) when fixed inputs or the tile list change; per-blade shading
  runs once per vertex (`BLADE_SHADE_GLSL`). A level's table is reused while its tiles and fixed traits are
  unchanged; season, palette, flattened patches and ground rebakes invalidate it, while wind, life and lighting stay
  live in the blade shader. Clears and draws are scissored to occupied rows. The three detail levels draw one
  population: each coarser level holds the lowest-ranked blades of the finer one, and thinning depends only on
  distance, so a tile changes level with no change on screen. A thinned blade shrinks into the ground rather than
  vanishing. Sparse density starts tiles at the coarsest level that holds every blade it can show. Tiles are culled
  against a sphere sized from the ground under the whole tile; blades that need no discard use a program without
  one (`tools/grass-unclipped-check.mjs`).
- Blade fragments clamp `vT` and `vSun`, and swan fragments their underside shading, because under MSAA a sliver
  evaluated outside its edges extrapolates into a spark that bloom spreads (`tools/swan-shading-check.mjs`).

Rules:

- In the terrain, grass and sea shaders, skip terms whose weight is exactly zero (unused regional colour noise, the
  distant-field colour where `far` is 0, frost noise where there is no frost, sun glints outside the glitter lobe).
  A mipmapped sampler moved inside such a branch must use explicit derivatives or `textureLod`.
- Terrain computes fog first and skips surface shading only where fog opacity is exactly 1; fully reflective
  sky-mirror water skips ordinary sea shading. `node tools/render-cost-check.mjs <chapter>` compares these against
  full work in the same frozen GPU frame.
- The sea's fog is computed per vertex and interpolated (Jeremy could not tell it from per pixel); the fragment
  recomputes it only where the interpolated fog is nearly opaque, because near the horizon the grid's cells are so
  wide that a sliver short of opaque lets a glint line through.
- An exact skip is proven by frame difference against the old path in the same page, static and along a moving
  camera. On ANGLE/Metal: an early return cannot come before implicit derivatives a quad neighbour needs, and
  explicit gradients (`textureGrad`) are not bit-identical to implicit ones; an edit nearby can move a result by an
  ulp (≤1/255); toggling `resolveDepthBuffer` on the multisampled scene target silently drops antialiasing. Drawing
  the sea after the land is slower, not faster: the land discards, so the tiler cannot cull the water beneath it.
- GLSL descending ramps use `1.0 - smoothstep(low, high, x)` with distinct, ascending edges; reversed or equal edges
  are undefined on some GPUs even if the local driver draws the expected curve. `tools/shader-check.mjs` rejects
  literal violations; expression bounds need range reasoning. CPU reversible helpers are separate.
- Where heights or grass masks exist on both CPU and GPU, keep them in step with `measureHeightParity` as a gate.
  Surface lighting and Sleeping fog share one morning-lane function (`world/lane.ts`).
- A distant room may rest while the boat is far off only with an explicit catch-up (the drowned village's vane and
  herons rest beyond 320 m and live through the last 10 s at 1/30 s steps as it nears;
  `tools/drowned-gating-check.mjs`). Never apply a blanket off-screen pause to flock, cloth or story mechanics.
- The wind's pressure solve runs two Jacobi relaxations per pass, bit for bit what two passes produce.

## The washing island's doorway (`world/doorway.ts`)

One translated camera draws into a half-float target, sampled projectively inside the red door; an oblique near plane
clips the destination at its threshold. The image enters the normal scene pass, so bloom and grading happen once;
there is no recursive portal and no second simulation. Each view has an explicit object set and a terrain radius
(`uRoom`), so the far shore never appears beside the source door and the washing never on the far shore; the sea grid
is re-centred for the portal view with its reflection off, and all state is restored before the main pass.
`world/door-shore.ts` supplies fixed-root, wind-reactive grass both views can draw. Travellers get a render-only
translation in the portal view and a threshold clip in the source view, and follow the destination ground beyond the
sill. The camera crosses on an explicit continuous shot and the chapter transfers the travellers once. Whenever the
door is not shown its target shrinks to 1×1, releasing the full-screen multisampled colour and depth.
`tools/lines-check.mjs` covers the route, per-view visibility, transfer and restore.

## Storm light

The key light moves continuously from the sunset direction to the moon between dusk 1.5 and 1.85. Lightning is a
separate cloud flash, gated by rain, darkness and storm time. `node tools/storm-profile.mjs` measures the underway
passage without capture overhead: stalls, blocking GL calls, light-direction jumps and chapter boundaries.

## Phones and the lite preset

`?stats` draws a small readout (frame percentiles, CPU time in the frame, quality level, readback counts, draw calls,
boot time) for devices without a debugger. `?lite=1` is an explicit QA preset only: 128² wind with fewer pressure
iterations on the same 60 Hz clock, low world detail, sparser grass and the reflection on alternate frames. Normal
play on every device uses the full simulation and adapts visual quality instead. The costs that do not shrink with
resolution matter most on a phone: the wind simulation (22 passes of 256² per tick, plus a force pass for each
further eight sources), the life, cloud and petal passes, and bloom.

## Before/after flags

Jeremy wants no switches in the deployed game, so a new optimisation adds no query flag: its old path lives as a
`tools/frame-profile.mjs` ablation that patches the page, or on the pre-change commit, and once approved the change
is the only code path. Older optimisations still have flags so the same frame can be diffed: `blades=direct`,
`grasslod=0|1`, `mirrorlod=full`, `mirror=1|2|0`, `heights=direct`, `lite=1`. Add `hold=<frame>` and capture with `tools/play.mjs` after an `eval` step that waits for
`__stats.frame`: the world freezes at that frame, and runs of the same variant are pixel-identical. Creatures and the
scarf read the CPU wind copy and can still differ when readbacks land on different frames.

## Measuring

`node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query] ['<steps>']` runs the game in local Chrome and reports
from inside the page: frame-interval percentiles and hitches, native WebGL calls that block, a CPU profile, or
frame-to-frame image spikes. Measurement starts after readiness and a 1.5 s warm-up (`WARMUP`). To hunt level-of-detail
pops, freeze the world (`hold=150` with a fixed `cam=`), creep the camera a few millimetres a frame from an `eval`
step that also calls `grass.update` and `grass.bake`, and lower the thresholds (`BLOCK=2 WHOLE=0.3`). `?ratio=2` makes
the GPU the bottleneck on purpose; `EXT_disjoint_timer_query` is meaningless on ANGLE's Metal backend.
`tools/frame-profile.mjs` gives CPU profiles, a per-pass and per-object draw census and paired frozen ablations;
`tools/window-hitch.mjs` compares window-move gaps between two builds; `tools/audio-cost.mjs` measures the audio
graph's CPU, sound on against muted.

- **Energy is cost × minutes.** Heat and battery over a playthrough follow each room's cost per frame times the time
  spent there, plus CPU script and the audio graph, which cost CPU on the scale of the script itself. A saving in a
  long room or crossing outweighs the same saving in a short one.
- **Read the noise floor.** Ablations are interleaved pairs; `none` pairs the baseline with itself. Chains of small
  dependent passes (the wind step, bloom, bakes) inflate several-fold under another process's GPU load and when
  drawn back to back, so time them with `DRAIN=1` and `GPU_QUIET=1`, and drop rows whose pair baselines straddle.
- **Frozen draws do not re-bake.** An ablation that changes a height source must re-run the window-move bakes
  (ground, light, shore, grass tables) on both sides of every pair; list it in the tool's `heightSources`.

Every number is inflated by anything else using the GPU. Check `ps` for busy Chrome first, measure from a worktree
with its own server, and compare builds back to back, never against remembered numbers. Desktop throughput deltas
are not iPad frame rates or battery figures. Don't run benchmarks unless Jeremy asks.

## Open

- Startup still constructs and warms the whole archipelago before Begin (local readiness about 3–4 s; the main chunk
  carries a bundle-size warning). Staged room preparation would need explicit lifetimes, checkpoint starts and
  shader warm-up without chapter-entry stalls.
- Graphics memory has no target-device budget: the grass tables (about 28 MiB), the static atlases (about 26 MiB) and
  the scene, MSAA, reflection and bloom targets on older iPads.
