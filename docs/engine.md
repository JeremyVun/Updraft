# The engine: frame, camera, readbacks, quality, post

How a frame is produced and what keeps it smooth. Story, mechanics and looks live elsewhere; this is the layer they
sit on. Code: `src/gl/`, `src/post/post.ts`, the camera in `src/camera.ts` and `src/camera-direction.ts`, and the loop
in `src/main.ts`.

## Boot (`src/gl/boot.ts`, `boot()` in `main.ts`)

Nothing heavy may happen in the first frames of play, and the veil must keep painting while the game prepares. World
construction runs first (stage B below), then, before the loop starts, behind the veil:

1. `settlePrograms` starts the terrain variants first (they are the last to finish on Windows when queued late), then
   builds every program before anything draws with it: the scene's materials against the scene's
   half-float target (a program's cache key depends on whether it draws to the screen), the simulation and bake
   materials (`simMaterial` registers them) and the grass tables as full-screen passes, the unclipped blades, the post
   chain, and the objects with variants, the unclipped blades and the post chain again for each program variant
   (`variantSteps`, see Program variants). Each object compiles on its own, and each program is given its first use
   (three's link and uniform queries) once the driver reports it compiled.
2. `runBootPasses` runs the draws construction deferred with `atBoot` (seeding the petals, leaves and litter, the
   carve field).
3. `warmRender` draws the scene into the offscreen target in batches, culling off: the main view and the reflected
   world in the sea mirror's format, each with every variant, and the grass blades with each of their fragment
   shaders (`grass.fragmentSteps`). An object that would draw nothing (no instances, an empty draw range) is given one
   instance or its whole range for the draw. Textures upload, buffers land on the GPU and render targets are
   allocated. `warmSimulations` then draws each simulation and bake material once into a 4×4 scratch target of the
   format it really writes (`simMaterial(fragment, uniforms, target)` names it), so nothing it writes changes.
   Visibility, layer masks, culling, draw counts and the render target are restored even on failure.
4. The static atlases bake once (the field and ground-colour caches and the distant-height atlas, see Bakes), the
   window is placed for the boot camera and baked (`followWindow(..., true)`), the visible grass tables bake, and
   the post chain runs. Boot does not know which room will be played: `Journey` holds the first island unstarted, and
   the boot camera stands on that island's opening shot.
5. `gpuIdle` waits (polling a fence, never blocking) until the GPU has finished. The start screen then enables
   Begin / Continue (and, for a finished player, `chapters`); the story and the quality governor do not run while
   waiting.

The Windows ANGLE/D3D11 path compiles repeated procedural noise much more expensively than the Vulkan path
tested with the same shader inputs. Keep the scene's `fbm` octaves and the height noise's octaves/corners as uniform-bounded loops
(`gl/loops.ts`), with fixed values 4, 6 and 4. Both `atmo.uniforms` and `simMaterial` supply them; these are compiler
bounds, not quality settings. `NOISE_GLSL` retains the original fixed loop for wind and other short simulation
shaders: rolling those loops also changed grass motion in the seeded image comparison, despite tiny differences
in individual noise samples.
`fogOf` shares one sky-radiance calculation across its three veils, and the terrain caches share their exact
fallback calls. Neither effect counts nor program variants are reduced. Validate changes with `noise-loop-check`,
seeded `render-parity-check`, and cold startup on the platform's normal backend; measured evidence is in
`backlog/boot-veil/build_plan.md` (Windows follow-up).

The gesture that chooses (Begin, Continue or a chapter pick; `?shot` without `start=1` goes straight on with no pick)
starts the game through the one callback of `startScreen.ready`. Inside the gesture it starts audio, then
`story.start(choice)` applies the save, the `?chapter=` start or the pick (`progress.md`), one `story.update(0, 0)`
gives the room its opening shot and the camera cuts to it. Then, behind the departing veil, the window moves to that
camera and bakes, the visible grass tables bake, the post chain runs and `gpuIdle` waits, as at boot, so the first
frame of play pays for none of them; then `requestAnimationFrame(frame)`. These steps reuse programs boot has already
built and first drawn. Nothing calls `story.update` before `story.start`, and `start` runs once per page.

Anything that appears later in the story is already compiled, first drawn and uploaded; showing it costs nothing.

`src/entry.ts` paints the DOM/SVG start screen before dynamically importing the game; its hollow ring is a
browser-owned SVG cursor, so it moves even while JavaScript is busy with WebGL setup. `controls.ts` loads before the
game bundle, so quality, sound and fullscreen controls work on the veil without starting play or creating audio.
`?shot` bypasses the start screen and sound activation; add `start=1` to test the real gate with QA access.

Failure paths:

- `index.html` carries a tiny inline watchdog: if the entry chunk fails to load or has not signalled within its
  timeout, it shows the ordinary failure ("The game couldn't start. Try again.", reloading on click) with plain DOM
  calls. `entry.ts` cancels it as its first statement; later failures go through `startScreen.fail()`.
- Before the world is built, `gl/graphics-capability.ts` checks WebGL2's `EXT_color_buffer_float` (the grass table's
  float attachments, the multisampled half-float scene target and the wind's float targets all need it) and
  size floors. A shortfall shows the same text with Try again hidden (`fail(permanent)`), since retrying cannot help.
- A failed `sound.start()` switches sound off, reports telemetry and still starts the loop.
- An uncaught exception inside a frame goes through `contextRecovery.trigger('runtime', error)`, the same pause, mute
  and recovery dialog as a lost WebGL context (`docs/contracts/progress.md`).

`node tools/failure-paths-check.mjs` fault-injects all four.

### Rules a change must keep

- **Nothing is first used outside `settlePrograms`, and every program is first drawn behind the veil.** A first use
  waits for the compile; a first draw builds the driver's pipeline, once per program and target format. Both are
  long on a cold driver, so neither may happen in a draw, a bake or play. A new material must exist by `boot()`, in
  the scene or through `simMaterial` with the target it writes; objects culled or empty at boot and passes that only
  run in later rooms are still warmed. A constructor that has to draw registers the pass with `atBoot` instead of
  drawing, before `boot()` runs. In QA builds `__stats.bootStrayPrograms` counts programs first used anywhere else
  and `__stats.playFirstDraws` counts programs, and programs with a target format, first drawn after Begin; both
  must be 0, at boot and through the opening minute or any `?chapter=` load (`start-check` checks the first seconds
  of play). The one accepted exception: a quality step to a new MSAA sample count first draws the
  scene's programs into that sample count.
- **At most 8 programs compile at once (`GROUP`).** A status query waits behind every compile issued before it: in
  Chrome, 138 programs issued together made the first query wait 0.4 s. When 8 are compiling, boot settles the
  finished ones until a slot is free and refills. Waiting for half the group to finish leaves capacity unfilled;
  refilling each slot shortens cold Windows startup without increasing the window. Changing the window needs the
  gates below measured again.
- **Each warm batch holds at most one program not yet drawn into that target format, beside up to 64 drawn ones
  (`WARM_BATCH`), and at most 4 first draws are queued on the GPU (`FIRST_DRAWS_QUEUED`).** A slow driver pays for a
  first draw in the task that issues it, so this is the smallest piece the work splits into. Chrome on Metal under
  `?coldshaders` builds each pipeline at its first draw; with all of them queued, later uploads blocked the main
  thread for 3.7–5.8 s, while waiting for every one cost 0.8 s on an ordinary load.
- **Boot yields whenever 12 ms have passed since the last paint (`keepPainting`, `yieldBoot`).** Yielding after every
  batch instead would add seconds.
- **World construction runs in `BUILD_STEPS` counted steps (`built()` in `main.ts`), none above about 120 ms at 1×
  on this Mac** (500 ms at 4× CPU slowdown). Longer work, such as the stairs flight by flight and the birches scarf's
  settle, is a generator run by `prepareInBatches` that yields the share it has done. Adding or removing a step
  changes `BUILD_STEPS`; `start-check` fails if a real boot counts another number.
- **Every program costs a first visit time.** A program's first draw takes about 0.2 s on Apple hardware (Safari
  compiles in the background, but the first draw blocks the thread that issues it), so every new program or variant
  adds about 0.2 s to a first visit on an iPad (about 25 s for about 200 programs). Weigh a new variant
  against that; duplicates (the same vertex and fragment source built twice) are a bug.

### Progress on the veil

`startScreen.progress(stage, fraction)` writes the stage line and a whole percentage that never falls; the line is
static HTML until `main.ts` runs. Each stage has a fixed share (`STAGES` in `src/start-screen.ts`):

| Stage | Line | Covers | Share |
| --- | --- | --- | --- |
| A | Downloading the game | `index.html` until `main.ts` starts evaluating | 0–3% |
| B | Building the world | World construction: completed steps of `BUILD_STEPS`, plus a generator's share | 3–41% |
| C | Preparing the graphics | Settling (`SETTLE_SHARE`, 60%), then the objects and passes first drawn | 41–95% |
| D | Laying out the ground and grass | Bakes, window, grass tables, post, `gpuIdle` | 95–100% |

Each share is the mean of a first iPad visit's (A 3, B 6, C 85, D 6) and a cold Chrome load's at 4× CPU slowdown,
so the number moves on a slow tablet as well as on an iPad. To measure them again, run
`RUNS=3 THROTTLE=4 BASE=<QA preview> node tools/boot-profile.mjs /tmp/<prefix>`: each run prints the stage times
(`A`, `B`, `settle`, `warm`, `D`, from the `main`, `boot`, `settled`, `warmed` and `ready` marks). C is settle plus
warm, and settle over C is `SETTLE_SHARE`.

### Measuring boot

On a QA preview, never a dev server, with nothing else busy on the GPU (check `ps`), compared back to back with the
unchanged build: `RUNS=5 node tools/boot-profile.mjs` (fresh profile per load: worst veil gap under 150 ms, Begin at
2.8 s or less on this Mac), `RUNS=3 THROTTLE=4` (worst gap under 500 ms), `WARM=1` (a second load in the same
profile, from Chrome's program cache). `?coldshaders` (QA only) adds a never-taken
`if (gl_FragCoord.x < -<random>) discard;` to every fragment shader, unique to the load, so no browser or driver
cache holds a program and every load compiles as a first visit does; a comment would not do, because WebKit caches
translated code without comments. Give Jeremy a LAN QA preview with `?coldshaders&start=1` to check a first visit on
his iPad. `node tools/start-check.mjs` also fails if the worst boot frame gap exceeds 500 ms (`BOOT_MAX_MS`).

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
   order. The last one follows the world window and requests the wind readback after its final tick. The story
   runs before the boat moves, so a chapter seats the child with `ride(at, yaw, boat)` and she keeps that seat in the
   hull's frame: anything placed from the boat's last position trails it by a step, which uneven frames turn into a
   shudder (`shot`'s even steps hide it).
4. The final view is prepared once: program variants, lighting bakes, cloud shadows, terrain selection, grass tables,
   what every grass blade shares this frame, and audio.
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
- **An arrival can have its own view.** A crossing may name an `ArrivalView` (`crossingCamera.arrivals`): angle off
  astern, distance, height, look-ahead and optionally a committed side, eased in over sailed distance from the end of
  the route and ending where the room's first view stands, so landing is not followed by a swing round.
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

The Graphics selector offers Auto (default), Ultra, High, Medium and Low; the choice persists in
`updraft.quality.v2`. A choice saved under `updraft.quality.v1` is read until a new one is made, its `high` as Ultra.

| | Ultra | High | Medium | Low |
| --- | --- | --- | --- | --- |
| Render scale | min(DPR, 1.5) | min(DPR, 1.25) | min(DPR, 1) | 0.85 × min(DPR, 1) |
| MSAA | scene default | scene default | up to 2 | up to 2 |
| Grass reach | 115% | 115% | 100% | 100% |
| Segments of the near grass's blades | 6 | 6 | 6 | 5 |
| Terrain split | 1.6 | 1.6 | 1.35 | 1.1 |
| Sky-mirror scale | 0.75 | 0.75 | 0.625 | 0.5 |
| Sky mirror's reflection | every frame | every frame | every frame | alternate frames |
| Bloom | full | full | full | off |
| Sun's glow painted by the grade in bloom's place (`SUN_GLOW`, eased with bloom) | no | no | no | yes |
| Depth blur (`DEPTH_BLUR`, eased like bloom; its quarter-size targets released when off) | yes | yes | off | off |
| Hull's wet collar on the sea | yes | yes | off | off |
| Lantern's glint and light on the sea | yes | yes | yes | off |
| Ordinary sea's reflection | alternate frames | alternate frames | alternate frames | off |
| Seabed detail in the shallows | yes | yes | yes | off |

The scene's default MSAA is 4, or 2 on displays with a device pixel ratio of 1.75 or more. The ordinary sea's
reflection is redrawn at most every other frame (unless the view has cut or the rooms changed); at Low it is not
drawn and the ordinary sea mirrors only the sky, while the sky mirror keeps its reflection at every
level. The seabed's detail is its sand grain, ripples, weed and caustics; without it the bed keeps their averages, so
the shallows keep their colour. The sea's effects are one variant axis (`SEA_EFFECTS` in `water.ts`: all, all but
the collar, none), selected only by `applyWorldQuality`. A change fades them over a second (`uSeaEffects`, toward
those averages and the sky) as the grass and bloom change: what goes keeps its variant until it has faded out, and what
comes is selected at once and fades in.
Every level presents at up to 60 fps ("just let it target 60 fps"), and Low is Auto's floor. Jeremy's rulings: "ultra,
high, medium, low. dont overcomplicate this"; every level keeps full grass, and Low keeps 2× MSAA because the fading
scenery fades by alpha to coverage (a dither breaks into coloured grain under the grade's lens fringe). A switched-off
effect is compiled out or its pass skipped, never branched round (Program variants).

A level is a `QualityLevel`: its `name` (`ultra`, `high`, `medium`, `low`), render scale and samples. Its
world settings are `WORLD_QUALITY[name]`. `applyWorldQuality(level)` in `main.ts` is the one place a level's settings
and effects are applied to the world. A manual level never reacts to frame timing or to the viewport.

**Auto moves only between these levels** and renders as one of them at all times. It opens at Ultra, or at High
where Ultra's scale is above its ceiling (1.25× on touch). Its one difference from a manual level: on a viewport
where the level's scale would exceed a sustained budget of 2.4 million pixels, Auto lowers that level's render scale
to the budget, never below 0.5×, and refits on resize. A level that would render exactly as the one above it (High on
a display at DPR 1.25 or less, or where the budget fits both to one scale) is left out of Auto's ladder. The canvas
and every render target share one scale, kept within `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE` and
`MAX_VIEWPORT_DIMS`.

**Auto's decisions.** Every 1.5 s it reviews up to 90 frame intervals, discarding the slowest 5%, against a budget
of 16.7 ms (33.3 ms under a device's own 30 fps cap, where every limit below doubles). A trimmed mean above 17.6 ms
steps down one level, never two: with four coarse levels a double drop overshoots where the level between would hold.
A new level settles for 2.5 s after a reduction, 1 s after an increase. Below its ceiling Auto climbs on evidence:
`main.ts` polls each frame's fence 10 ms after submission (`timeLastFrame`, one timer, never a wait). A review with p90 under 17.2 ms in which at least 90% of 30 or more timed frames finished by
then climbs one level at once; the next level costs at most 1.56× the pixels (Medium to High), so 10 ms stays inside
one refresh. Fewer than a quarter on time rules a climb out; between the two, or where frames can't be timed, 12 s of
p90 under the smooth limit earns one level. A failed climb returns exactly one level and doubles the next wait, up
to two minutes, so a device that holds Low but not Medium tries Medium ever less often.

A steady 33 ms cadence is either a GPU missing every other refresh or a display capped at 30 fps
(iOS Low Power Mode): while intervals are that long, each frame's fence is timed against one 60 Hz refresh, and if at
least 80% of eight or more finish early the cap is proven and Auto judges every level against 30 fps until intervals
under 25 ms show it has lifted. A timer that fires late counts as not early. A single hitch, time behind Begin or in
a hidden tab never changes quality; Begin and visibility changes reset its timing. Pacing reports the longest display
callback interval since the last presentation, floored at 16.7 ms, so deliberately skipped callbacks on 120/144 Hz
displays don't look like overload.

Grass grows and shrinks in place over one second while its distance rings move continuously. Tables reserve capacity
for every level at boot (about 44 MiB for the tables' four attachments, and 33 MiB for what moves each frame), so quality changes
never allocate or recompile. The near level's geometry holds its blade twice, with six segments and with five; at
Low the sixth segment closes over a second, and the five-segment form, the same blade fully closed,
is drawn only once it has shut (`grass.setNearSegments`).
Wind resolution, solver cadence and water mesh topology never change during play.

Only the dev server and explicit QA builds accept game query overrides; the production build removes their parser
and QA tools. Use `npm run build:qa` and `npm run preview:qa` for instrumented checks against an optimised build.
In those builds, `?ratio=` or `?msaa=` locks the governor at exact values with Ultra's world settings and hides the
selector; `shot` hides the selector and leaves Auto running.
`params-qa.ts` clamps `ratio` to (0, 4], `msaa` to [0, 16] and `grass` to [0, 4]; `main.ts` clamps `msaa` again to the
device's `MAX_SAMPLES`. `?grass=` overrides density, `?mirror=1|2|0` the reflection cadence.

## Post chain (`src/post/post.ts`)

One multisampled scene target; while bloom is drawn, bloom's bright pass reads its resolve and one pass writes the
scene plus bloom into a plain target; then, at Ultra and High, the depth blur's quarter-size frame made from that
target (weighted by each pixel's blur so the sharp subject never haloes what is behind it; the scene's depth is
resolved with its colour, `focusOn` from `main.ts` sets the focus on the child and the cygnet each frame); then the
grade (the depth blur mixed in, ACES, split toning, vibrance (pinks and magentas held back, so sunlit cloud stays gold
and white) and a gentle contrast curve on brightness after tone mapping, blue-tinted shadows that leave black alone,
vignette, grain) reads the plain target, or the resolve itself while bloom is off, straight to the screen. The depth
blur is never shown with more strength than bloom, so the plain target is always there for it. Every read of the
scene clamps NaN, infinity and huge highlights (bloom would smear one bad pixel across the screen); it clamps the
filtered sample, so it matches clamping each texel first except beside a texel over 40 or not finite. The grade reads
the plain target, cleaned already, without the clamp: bloom can lift it past 40. Bloom is added
texel for texel before the grade, not in it: the plain target's rounding of the sum is part of the picture, and
dropping it moved blue by up to 10/255. The clamp tests the exponent's bits rather than calling `isnan` or `isinf`,
which change how the compiler treats every float in the grade and moved its grain by up to 8/255. Nothing in the
chain reads alpha, so the scene target, the plain target and bloom's targets are `R11F_G11F_B10F`, half the memory
and bandwidth of half-float RGBA, wherever
the device multisamples that format as well (`compactFrameFormat`; half-float RGBA otherwise). The format holds no
negative colour; half-float keeps it, and the grade's ACES makes a bright speck of it. Multisampling shades an edge
sample at the pixel centre even when that lies outside the triangle, so blends passed from the vertices extrapolate
there: a shader that mixes colours by them clamps its output at zero (the rabbits, reeds, swans, songbirds and
cygnet do), which is what the compact format stores anyway. Apple GPUs store it truncated, a fraction of a percent darker; near bloom's threshold that can move a glint's halo by
a few levels. Bloom follows the level: full, or off at Low, when its passes are skipped and its targets, the plain one too, released.
Half-resolution bloom spread wider and veiled the frame near the sun while saving almost nothing. Turning it on or
off eases its strength over one second, as the grass changes; boot draws it once whatever the level, so its programs
exist before Begin. Only the scene target is multisampled. The canvas has no depth buffer
(`depth: false`): nothing drawn to the screen may rely on depth.

## Program variants (`src/gl/variants.ts`)

On these GPUs code compiled into a program costs even where a uniform switches it off (register pressure), so an
effect that is off is compiled out, not branched round. Each such effect is a switch: a define of the same name, 1 or
0, tested with `#if`. Shared GLSL defaults a switch to on, so materials without variants keep the effect.

- `register(material, ...axes)` lists the alternatives of each axis; a variant takes one alternative from every
  axis, so several independent switches multiply (the sea's deck × three effect sets is two axes, six programs).
- `select(material, choice)` and `selectAll(choice)` change the defines in place. three keeps every program a
  material has built, keyed by its defines, so switching rebinds a program built before Begin, for every mesh, view
  and pass that draws the material, and never compiles. A choice that is not a registered variant throws.
- Behind the veil, `variantSteps()` steps every registered material through its other variants: each step compiles
  the scene and the grass's programs again and warms the registered objects (`warmRender`'s `only`); the selection is
  restored after.
- A twin material per variant was rejected: three sorts opaque draws by `material.id`, so a twin made later draws in
  another order; each twin's UUID draws from `Math.random`, which shifts seeded frame comparisons; and state set on
  the original afterwards (the grass's per-draw program pick, uniforms replaced, visibility) would miss the twin.

The cloud deck (`CLOUD_DECK`): its GLSL in `ATMO_GLSL` (the deck, the bank of mist, their helpers, the sun dimming in
`cloudShadow`, the deck in `fogOf`, and the drowned village's sea fog, `seaFog`) and the sky's and the sea's use of
them are compiled only where it is 1. The sea, the terrain
(main view and the sea's mirror) and the sky have both programs, and
`prepareFrame` selects the deck while `uCloudDeck.w > 0` or the sea fog is out (`uSeaFogShape.w > 0`), before the doorway view, the reflection and the scene are
drawn. Every other material keeps the deck; the grass's blade table includes `ATMO_GLSL` but never reaches the deck,
and the blades' per-frame pass (`FRAME_FRAG`) reads it only while it is there, so the blades need no variant.
That is three programs more and about 80 ms more behind the veil on the Mac, for 6 to 9% of the GPU's frame wherever
the deck is away.

`STORM_BANK`: the sky's storm bank (one `fbm` per sky pixel in `skyRadiance`) is compiled out of the sky while
`uStormCover` and the lightning are 0, its value replaced by 0 (two more sky programs). Branching round it instead
changed a few sky pixels by 1/255; the define does not. Other materials that read `skyRadiance` keep the bank.
Without the bank the sky also leaves out its clouds below and above their band, where they are exactly 0. Branching
round the clouds' shading where none shows moved them by a rounding step (fast math regroups the two cloud lookups
when both run), so it is worked out wherever the band is.

`uLandSkip`: the sea returns unshaded where the ground stands a metre over it across the 3×3 pixels round it with no
waterline inside, so no seen pixel shares its quad; it needs the terrain drawn over the sea with tiles following a
camera above the ground, and is selected while island ground lies in the window. This small early exit uses a bool
uniform, avoiding a second copy of each large water program. The effect sets and cloud deck still use variants.
The sample positions, waterline safety margin and return colour are unchanged.

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
- The terrain vertex shader shares its three `groundHeight` samples in a loop bounded by the frozen
  `uGroundSamples = 3` uniform. It retains the centre, x-offset and z-offset samples and the original normal
  calculation; D3D11 otherwise expands the large height helper at all three call sites. This is a compile-time
  optimization, not a lower-detail normal. `tools/terrain-samples-check.mjs` compares the actual vertex calculation
  against three separate calls, for both height-filtering paths, main/mirror heights, all patches and direct fallback.
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
- Grass (`world/grass.ts`): per-blade constants (root, height, width, facing, curve, tint, flower and the ground's
  normal under the blade) are computed once into a blade table (`TABLE_FRAG`, four texels a blade: root, shape, and
  the normal with the facing at full float; colour, curve, seed and flower as packed halves) when fixed inputs or the
  tile list change; per-blade shading runs once per vertex (`BLADE_SHADE_GLSL`). What moves from frame to frame is
  worked out once a frame per blade (`FRAME_FRAG`, three `RGBA32UI` attachments, 48 bytes a blade): whether thinning
  collapses it, its grown height, width and closing, its life, the wind's bend and flutter strength on it, frost, the
  ground's baked shadow, cloud shadow and fog (a quarter of the way up the blade, where one fog comes closest to the
  fog along it). Nothing that holds still between table bakes is written there, because every byte the pass writes
  is memory traffic every frame. The blade shader reads both with `texelFetch`, so its vertices take no filtered
  sample; the targets are allocated at boot (`atBoot`), because a draw whose integer sampler finds three's stand-in
  texture is dropped by the driver. Values are kept as full float, as the vertex shader worked them out, but the fog
  and the table's halves, cut toward zero as a half-float target stores them: the ground's normal, frost, the
  morning's green or the warm lights stored as half float moved single pixels by up to 41/255 through the grade's
  hue. The morning's green and the warm lights (lamp, hearth, lantern, dawn) stay at every vertex, where each is zero
  by a uniform outside the rooms that light it; in the per-frame pass they would add 16 bytes a blade every frame
  everywhere. Collapsed blades write only their mark. Neither pass clears: each draws over its rows, a clear would
  cost more than the per-frame pass, and a target with an integer attachment cannot be cleared whole. A level's table is reused while its tiles
  and fixed traits are unchanged; season, palette, flattened patches and ground rebakes invalidate it, while wind,
  life and lighting stay live in the per-frame pass. Clears and draws are scissored to occupied rows. The three detail levels draw one
  population: each coarser level holds the lowest-ranked blades of the finer one, and thinning depends only on
  distance, so a tile changes level with no change on screen. A thinned blade shrinks into the ground rather than
  vanishing. Sparse density starts tiles at the coarsest level that holds every blade it can show. Tiles are culled
  against a sphere sized from the ground under the whole tile; blades that need no discard use a program without
  one (`tools/grass-unclipped-check.mjs`).
- Blade fragments clamp `vT` and `vSun`, and swan fragments their underside shading, because under MSAA a sliver
  evaluated outside its edges extrapolates into a spark that bloom spreads (`tools/swan-shading-check.mjs`).

Rules:

- In the terrain, grass and sea shaders, skip terms whose weight is exactly zero (unused regional colour noise, the
  distant-field colour where `far` is 0, frost noise where there is no frost, sun glints outside the glitter lobe,
  the seabed's weed outside its depths).
  A mipmapped sampler moved inside such a branch must use explicit derivatives or `textureLod`.
- Terrain computes fog first and skips surface shading only where fog opacity is exactly 1; fully reflective
  sky-mirror water skips ordinary sea shading. `node tools/render-cost-check.mjs <chapter>` compares these against
  full work in the same frozen GPU frame.
- The terrain draws no leaf under the open sea: beyond every island's height patch the ground is `seaFloor`,
  at least 5 m under the opaque sea, so a leaf 16 m clear of every patch and 100 m inside the sea's grid is not
  drawn. This holds only while the sea is opaque and drawn wherever the camera, always above it, can see.
- A dynamic buffer with nothing to upload skips its upload: WebGL2 reads an update range of length 0 as the whole
  rest of the array.
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
- The wind step fuses passes bit for bit (`wind/shaders.ts`); `tools/wind-exact-check.mjs` compares the field texel
  for texel against another build. On Chrome/Metal a half-float target stores toward zero (`packHalf2x16` rounds to
  nearest) and fast math regroups float sums, so a fused pass cuts and orders with bit operations (`storeHalf`, `pin`).
- Touching pieces of one material are not merged into one draw: three sorts separate meshes front to back every
  frame, and that order decides exact depth ties along where they meet (`mirror-merge` in `tools/frame-profile.mjs`).
- Measured and not worth repeating without a new reason: tiled noise textures for single-octave `vnoise` (one sample
  costs about as much; only four-octave `fbm` pays); skipping empty grass tiles (none are empty at every density);
  skipping the seabed where water hides it (never hidden where drawn); a bloom gate (nothing proves in advance that no
  pixel crosses its threshold); hiding the sea and terrain above the stairs' cloud (the deck blends over them,
  `docs/stairs.md`); the sky mirror's pass where it is out of view (every sea pixel samples it there); folding
  `waterWindAt`, `backlit` or `fogOf`'s `skyRadiance` (the compiler already shares them); readbacks every other frame
  and creatures on the baked height copy (not exact for little gain); resting the drowned village during the stairs
  (its leaf drift has no catch-up).
- Scenery nothing moves, turns or reparents is fixed with `fixInPlace` (`gl/fixed.ts`) where it is built, so renders
  skip its matrices; anything that moves stays automatic. `tools/fixed-matrices-check.mjs` fails if a fixed object moves.

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
resolution matter most on a phone: the wind simulation (17 passes of 256² per tick, plus a force pass for each
further eight sources), the life, cloud and petal passes, and bloom.

## Before/after flags

Jeremy wants no switches in the deployed game, so a new optimisation adds no query flag: its old path lives as a
`tools/frame-profile.mjs` ablation that patches the page, or on the pre-change commit, and once approved the change
is the only code path. Older optimisations still have flags so the same frame can be diffed: `blades=direct`,
`grasslod=0|1`, `mirrorlod=full`, `mirror=1|2|0`, `heights=direct`, `lite=1`. Add `hold=<frame>` and capture with `tools/play.mjs` after an `eval` step that waits for
`__stats.frame`: the world freezes at that frame, and runs of the same variant are pixel-identical. Creatures and the
scarf read the CPU wind copy and can still differ when readbacks land on different frames.

## Measuring

`node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query] ['<steps>']` runs the game in Chrome for Testing and reports
from inside the page: frame-interval percentiles and hitches, native WebGL calls that block, a CPU profile, or
frame-to-frame image spikes. Measurement starts after readiness and a 1.5 s warm-up (`WARMUP`). To hunt level-of-detail
pops, freeze the world (`hold=150` with a fixed `cam=`), creep the camera a few millimetres a frame from an `eval`
step that also calls `grass.update` and `grass.bake`, and lower the thresholds (`BLOCK=2 WHOLE=0.3`). `?ratio=2` makes
the GPU the bottleneck on purpose; `EXT_disjoint_timer_query` is meaningless on ANGLE's Metal backend.
`tools/frame-profile.mjs` gives CPU profiles, a per-pass and per-object draw census and paired frozen ablations;
`tools/window-hitch.mjs` compares window-move gaps between two builds; `tools/audio-cost.mjs` measures the audio
graph's CPU, sound on against muted. `tools/memory-census.mjs` sizes every texture, target and buffer by owner.
`frame-profile` with `PAIR_BASE=<another dev server>` times the same frozen frame on two builds in one browser, ABBA
over 40 rounds, so outside load lands on both sides of every pair; `tools/frame-spikes.mjs` counts slow frames through
the stairs played on frames and across level switches. The last whole-game census (per room at Ultra and Low,
components, script, memory, spikes, weighted by minutes) is `git show 25b6bb2:docs/backlog/perf-final/profile.md`.

- **Energy is cost × minutes.** Heat and battery over a playthrough follow each room's cost per frame times the time
  spent there, plus CPU script and the audio graph, which cost CPU on the scale of the script itself. A saving in a
  long room or crossing outweighs the same saving in a short one.
- **Read the noise floor.** Ablations are interleaved pairs; `none` pairs the baseline with itself. Chains of small
  dependent passes (the wind step, bloom, bakes) inflate several-fold under another process's GPU load and when
  drawn back to back, so time them with `DRAIN=1` and `GPU_QUIET=1`, and drop rows whose pair baselines straddle.
- **Time a pass the scene reads with the wind step.** `FRAME_PASS` leaves the wind step out, so a per-frame pass
  whose output the scene's vertices read (the blades' per-frame values) becomes the one thing the scene waits on and reads several
  times its cost; `FRAME_SIM=1` steps the wind before each draw, as the loop does.
- **Frozen draws do not re-bake.** An ablation that changes a height source must re-run the window-move bakes
  (ground, light, shore, grass tables) on both sides of every pair; list it in the tool's `heightSources`.

Every number is inflated by anything else using the GPU. Check `ps` for busy Chrome first, measure from a worktree
with its own server, and compare builds back to back, never against remembered numbers. Desktop throughput deltas
are not iPad frame rates or battery figures. Don't run benchmarks unless Jeremy asks.

## Open

- Startup still constructs and warms the whole archipelago before Begin (local readiness about 3–4 s; the main chunk
  carries a bundle-size warning). Staged room preparation would need explicit lifetimes, checkpoint starts and
  shader warm-up without chapter-entry stalls.
- Graphics memory has no target-device budget: the grass's tables and per-frame targets (about 77 MiB), the static atlases (about 26 MiB) and
  the scene, MSAA, reflection and bloom targets on older iPads.
- The child's bone texture is the one texture written mid-pass. Uploading it before the frame's passes is exact; on
  the Mac it costs 2–4% of a weighted frame but saves 8–12% on top of the stairs and the sail. Decide on the iPad.
