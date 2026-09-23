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
Water's deterministic ripple texture reuses row/column sine and cosine tables; its foam texture ranks squared
cell distances and takes only the two winning square roots. Packed bytes and texture settings match the
original generator at five checked resolutions (`tools/water-texture-check.mjs`). The temporary tables are
discarded after construction; no startup assets or downloads were added.
The start screen's hollow ring is a browser-owned SVG cursor: its movement does not depend on JavaScript
servicing pointer events during WebGL initialization. The animated gameplay cursor stays unchanged.
A local production-preview profile reduced the worst opening frame gap from 950 ms to 167 ms; individual
constructors and driver calls can still cause shorter pauses. These changes only affect startup.
The start-screen check records the worst boot frame gap (default ceiling 500 ms, override with `BOOT_MAX_MS`).

`src/entry.ts` paints the DOM/SVG start screen before dynamically importing the game. Module and boot failures keep a retry button available. The first real frames trigger the veil fade; its listeners, SVGs and animation loop are removed after the transition. `?shot` bypasses the screen and sound activation for existing QA; add `start=1` to test the real gate with QA access. `node tools/start-check.mjs` verifies entry, pause, audio, touch, keyboard, resume and retry in isolated Chrome (set `BASE` for a production preview).

Anything that appears later in the story (the whale, rain, fireflies, the drawing) is already compiled and uploaded; showing it costs nothing.

## Frame order (`frame()` in `main.ts`)

1. `gl/frame-pacer.ts` limits normal play to 60 presentations/s (30 on Low), skipping excess display callbacks
   before input, simulation or rendering. `shot` bypasses pacing. Measure actual elapsed time between presented
   frames for telemetry and simulation. `gl/frame-time.ts` accepts up
   to 100 ms and divides it into at most three world updates, each no larger than 1/30 s. Ordinary 30–144 fps
   updates remain single steps, avoiding duplicated CPU work around 60 fps. The GPU wind keeps its separate
   fixed 60 Hz clock: at most six wind ticks per rendered frame.
2. Poll completed readbacks once, before submitting this frame's GPU work. Snapshot the pointer's screen
   segment and interpolate it across the world updates; each brush sees only its own segment and duration.
3. Each world update advances input, story, actors, wind/life/particles, camera and world mechanics in order.
   The final update follows the world window and requests the wind readback after its last simulation tick.
4. Prepare the final view once: lighting bakes, cloud shadows, terrain selection, grass tables and audio cues.
5. Render the doorway view when open, the room's sea reflection and post chain, then fence with `endFrame()`.

The 100 ms cap permits normal game-time progression down to 10 fps. Excess time from a longer stall is
discarded rather than queued; the next frame starts without a catch-up backlog. Hidden tabs do not advance
simulation, and visibility changes reset the timestamp. QA `shot` still advances exactly 1/60 s per frame.
`__stats` reports game time, world-step count/size, simulated milliseconds and discarded milliseconds.

On resize, `main.ts` sizes both the displayed canvas and its drawing buffer from `innerWidth`/`innerHeight`,
then sizes the post targets and camera from those same values. CSS `100vh` alone may include space behind
Safari's browser controls. Viewport changes also cancel any in-progress pointer stroke before its old
coordinates can be interpreted in the new frame.

When a chapter changes, `Journey` retains the previous chapter's prepared shot, pace and habitat focus
until the new chapter has had its first normal update. Several constructors initialize those vectors at
the origin and populate them during update. Reading them sooner caused a one-frame camera pull toward
the origin. Retaining the view avoids an extra zero-time gameplay update at every transition; startup and
checkpoint restoration still perform their existing zero-time setup before the first camera cut.

## Cinematography (`src/camera.ts`, `src/camera-direction.ts`)

Chapters supply a preferred composition and the subjects that must share it. Optional `Shot.attention`
names a meaningful point, its presence and share of the gaze, and an optional preferred encounter angle.
The shared director resolves that attention independently of the physical follow anchor. The whale and
village church use this contract: changing focus turns the lens instead of translating the whole view.
Ordinary sailing stays close to astern. The church changes gaze from that travelling position, without
an encounter orbit; after the sail interaction it is allowed to fall behind. Departure from the still
island holds a look back, then joins the forward view over fourteen seconds. The sea opens beside the
boat for the swim and returns astern afterward.

Subject-relative turns preserve distance and ease their angular velocity, including across chapters.
Focus, dolly and height use critically damped motion too: a change of attention builds speed rather than
starting at full speed. The response is capped even when a chapter asks for fast following; the orbit is
limited to 0.3 radians/second (about 17 degrees); faster momentum inherited from a placed view decays into
that limit rather than stopping abruptly. Physical boat movement is still carried directly. At lower
chapter paces, doubling the spring response preserves the former steady tracking lag. World-space staging
and subject-relative orbits transfer their velocities on handoff, while cuts and exact paths clear them.
An explicit eye can request `Shot.orbit` when a change of side must travel around its focus. The wood uses
this on returning to the path after the reunion; its shelter choreography retains a placed eye. Smooth
subject fitting retains a 0.9 NDC safety frame for the primary, so easing cannot leave the child or bird
outside the image. The mirror keeps fitting eased between all phases, including the next star and departure.
Every half second, the director compares five nearby angles within 0.18 radians of the preferred view.
It considers required framing distance and terrain clearance, favours the authored angle, and requires
a material improvement, a six-second hold and 1.5 seconds of consistent evidence before changing preference. It does not pan because a timer
expired. Subject fitting accepts additional scene bounds (the sky mirror supplies its three returned stars),
while retaining the primary when a group cannot fit within its retreat budget. Terrain correction remains
a safeguard. Rooms can supply static `Shot.obstacles`: the drowned village builds bounds for roofs,
chimneys and substantial branches once. Scalar sightline checks compare the current clearance with five
small lateral offsets, easing beside a roof before asking for height. Any rise is limited by the angle
down to the child (0.3 radians), as well as its height and speed. The checks include the previous fitting
offset, so portrait coverage cannot silently send the lens behind a different roof. The final rendered
elevation is tested too; fitting a landmark is not permission to turn the scene into an overhead view.
No per-frame scene graph search, mesh raycast, GPU pass or readback is added; the work reuses its vectors.

Scripted beats and explicit wind/piano interactions suppress optional angle selection. A placed `eye`
retains its world-space approach, and `composition: 'hold'` preserves staged motion such as the pond's
path beside the bank. `exact` preserves the doorway's own continuous choreography and resets residual
motion/fitting state. Carry uses a physical `carryAnchor`, rejects anchor-identity changes and teleports,
and accepts legitimate movement at low frame rates. Zero-time preparation cannot advance the camera.

Feel values live in `tuning.cinematography`. `tools/camera-direction-check.mjs` covers orbital clearance,
turn acceleration/rate, eased focus/dolly/height at 10–120 Hz, carry, attention, stable composition choices, interaction holds,
exact-path exits and portrait resizing. Its CPU microbenchmark measures the new decision layer alone;
it is not a phone frame-rate or rendering benchmark.

The creature environment and its life callback are reused between simulation steps. Nearby-creature queries
iterate persistent population arrays, preserving their tie order and strict radius. Camera subject fitting
uses the same arithmetic without per-step arrays or a capturing closure; 7,200 frames match the original
camera exactly (`tools/camera-parity-check.mjs`). These changes do not reorder simulation work.

GLSL descending ramps use `1.0 - smoothstep(low, high, x)` with distinct, ascending edges. Reversed or equal
GLSL edges are undefined, even if a local driver draws the expected curve. CPU reversible helpers remain
separate. Surface lighting and Sleeping fog share the morning-lane function in `world/lane.ts`.

## Readbacks (`src/gl/readback.ts`)

The wind field, the life field and the height bake are read back to the CPU for gameplay. In Chrome, mapping a read buffer blocks until the GPU process has executed every command issued before the map, so a readback issued and mapped mid-frame stalls for the whole frame's rendering, and a GPU-bound frame turns into a CPU stall too (that was the original stutter: 60-140 ms every few frames).

`Readback` therefore never waits: `request` copies the target into a fresh pixel buffer and fences it; `pollReadbacks` maps only buffers whose fence has signalled, and only when the fence of the frame before last has signalled as well (the display pipeline is normally two frames deep), so the map is a memcpy. A fresh buffer per request matters: the driver keeps a CPU shadow of a fenced read buffer, and reusing the buffer discards it and turns the read into a blocking GPU copy.

If the GPU stays behind (a saturated device, or another process on the GPU), the gate would starve the CPU copies. So one blocking delivery is accepted anyway now and then: a quarter second after a cheap one, two seconds after one that blocked for more than 6 ms, whatever the frame rate. The CPU wind copy is then up to a few frames older than usual, which the consumers tolerate, and the quality governor is stepping the load down meanwhile. `__stats.readbacksSkipped / readbacksForced / readbacksDelivered / readbackWorstMs` show what happened.

## Quality governor (`src/gl/quality.ts`)

The bottom-right Graphics quality selector offers Auto, High, Medium and Low. Auto is the default and
adapts in both directions. High holds full world detail at device pixel ratio (capped at 1.5); Medium holds
80% grass with 95% reach at at most 1× scale with up to two MSAA samples; Low holds 55% grass with
85% reach at 0.85× scale (relative to the lesser of DPR and 1), also with up to two samples. Low prioritises
a fuller meadow and caps presentation at 30 fps. Auto, High and Medium cap at 60; these are ceilings, not
guaranteed device frame rates. The wind retains its fixed 60 Hz simulation on every preset.
Manual settings never respond to frame intervals.
Switching back to Auto keeps the current level if within its sustained budget, otherwise reduces it immediately,
and resets timing and the failed-climb penalty.
The choice persists separately from story progress in `updraft.quality.v1`; unavailable storage falls back
to Auto without preventing session changes. Shot mode and explicit graphics overrides ignore the saved
choice and hide the selector. `node tools/quality-setting-check.mjs` checks the real control, full-grass
restoration, reload persistence, keyboard selection, phone layout and QA isolation.
`controls.ts` loads before the game bundle so the same controls also work on the veil. Loading-time quality
choices are applied after graphics warm-up; audio preferences never create an AudioContext until play
begins with sound enabled. `node tools/veil-controls-check.mjs` verifies that control clicks cannot start
play, fullscreen works before module loading, and Begin preserves the selected mute state.

Explicit render-scale overrides are exact, including values below 1. Startup selects the lowest rung if even
that exceeds the pixel budget, and applies its multisampling before allocating the scene target. The governor
resets its timing when play begins or page visibility changes: time behind Begin or in another tab cannot earn
a quality increase. `node tools/quality-check.mjs` verifies these cases and normal adaptation.

The governor targets 60 fps on every device. Every 1.5 seconds it reviews up to 90 frame timing samples,
discarding the slowest 5%. A trimmed mean above 17.6 ms lowers quality; a sustained p90 below 17.2 ms for
12 seconds earns one increase. Failed increases double the next wait, up to two minutes. A single hitch or
hidden-tab time cannot earn a change. A new level settles for 2.5 seconds after a reduction, one second after
an increase. Pacing reports the longest display callback interval since the preceding presentation, with a
16.67 ms floor: intentionally skipped 120/144 Hz callbacks cannot masquerade as overload, but actual missed
callbacks still count. Actual elapsed time, including skipped callbacks, always reaches gameplay.

The ladder lowers render scale from DPR (capped at 1.5) to 1, then multisampling to 2, then world detail,
before resorting to subpixel scales of 0.85 and 0.72. A final Auto-only fallback retains the old 25% density
and 70% reach at 0.72× for devices still overloaded; selecting Low never chooses that fallback. Auto still
targets 60 fps. Full grass recovers before extra antialiasing. World detail controls:

| Level | Grass density | Grass reach | Terrain split factor | Reflection cadence | Sky-mirror scale |
| --- | --- | --- | --- | --- | --- |
| Full | 100% | 100% | 1.6 | Every frame | 0.75 |
| Medium | 80% | 95% | 1.35 | Every frame | 0.625 |
| Low | 55% | 85% | 1.1 | Alternate frames | 0.5 |
| Auto fallback | 25% | 70% | 1.1 | Alternate frames | 0.5 |

Auto's sustained pixel budget is 2.4 million, re-evaluated on resize/fullscreen. Touch also has a sustained
1.25× ceiling and starts at medium world detail; it can recover full grass. High permits 1.5× on both touch
and mouse. Smooth vsync cannot prove spare power, so Auto never climbs beyond its budget. The governor restores
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

### Grass budget comparison (2026-09-20)

Jeremy prefers fuller Medium/Low grass and accepts 30 fps on Low. The selected values are 80% density/95%
reach for Medium at 1× scale, and 55%/85% for Low at 0.85×. The 25%/70% at 0.72× fallback remains
available only to Auto. These September 20 comparisons preceded the presentation caps added September 21.

`node tools/quality-budget-profile.mjs` compares frozen cameras in the island, meadow and sky mirror on
local Chrome/Metal, M4 Pro, 1280×800 CSS pixels, 2× MSAA. Each comparison changes one setting, plus two
comparisons of the complete old/new presets. Five A/B/B/A or B/A/A/B rounds bracket background load.
Each sample waits for GPU completion after eight draws. Results report median paired deltas and their
range, not differences between independent run averages. Raw results/captures are written to `/tmp`.

The work includes wind ticks, reflections and post-processing, but excludes story/CPU simulation,
other field updates and readbacks. These are completed-work throughput deltas, **not gameplay fps**.
Other sessions are using the GPU: small or sign-changing deltas are inconclusive, and absolute costs
cannot establish device headroom. Earlier standalone live frame-rate samples were discarded as a basis
for preset decisions because their background load was not comparable. Physical-device checks remain
necessary before claiming sustained 30/60 fps.

Paired median changes in completed-work cost (five rounds; positive means more work):

| Change | Island | Meadow | Sky mirror |
| --- | ---: | ---: | ---: |
| Density 55% → 80%, other settings fixed | +1.23 ms / +8.8% | +0.44 ms / +3.9% | +0.10 ms (noise) |
| Density 25% → 55%, other settings fixed | +1.58 ms / +16.2% | +0.60 ms / +6.9% | −0.26 ms (noise) |
| Reach 85% → 95%, other settings fixed | +0.20 ms | +0.56 ms | +0.12 ms (noise) |
| Render scale 0.72× → 0.85× | +0.95 ms | +1.06 ms | +0.67 ms |
| Reflection every frame → alternate frames | −0.44 ms | −0.69 ms | −0.81 ms |
| Bloom disabled | −0.39 ms | −0.74 ms | −0.71 ms |
| Grass hidden entirely | −2.24 ms | −2.67 ms | −0.02 ms (noise) |
| Render scale 1× → 2× | +10.76 ms | +12.11 ms | +11.59 ms |
| Complete old → new Medium | +0.54 ms / +5.3% | +0.68 ms / +4.7% | −0.15 ms (noise) |
| Complete old → new Low | +2.16 ms / +34.5% | +2.71 ms / +28.7% | +1.24 ms / +18.7% |

The mirror camera has no grass, providing a noise check. Small changes are not precise: the complete
Medium deltas span −0.41 to +1.46 ms on the island and −1.34 to +1.46 ms in the meadow. The complete
Low delta spans +1.17 to +2.63 ms on the island, −1.59 to +3.34 ms in the meadow. Density-only 25% → 55%
was positive in all five pairs in both land views. Resolution 1× → 2× was consistently much more
expensive than adding the grass. These results justify trying the richer presets, not an FPS guarantee.

### Battery and sustained rendering (2026-09-21)

Jeremy reported a full playthrough on an M5 iPad Pro using **High** consumed about 20% battery and made the
device warm. High bypassed adaptation, so Auto's former tendency to climb to full Retina does not explain
that particular run. The code also rendered on every display callback without a 60 fps limit; the actual
callback rate on Jeremy's iPad was not recorded.

Changes: 1.5× maximum scale for High, 1.25× for touch Auto within its sustained pixel budget, 60 fps
presentation limit (30 on Low), and exact-opacity shortcuts for hidden water shading. Ordinary sea covered
completely by fog returns the fog colour. Fully reflective sky-mirror water skips ordinary sea shading and
fog, which its reflection replaces. Its partially reflective edge still computes and blends both surfaces.
Full world detail, grass populations, lighting, wind grid/solver and water geometry are retained on High.
On a 2× display, 1.5× submits 43.75% fewer scene pixels. MSAA stays at two samples on those displays;
reducing scale must not accidentally switch it to four. Explicit `?ratio=2` still reproduces the old resolution.

`node tools/power-profile.mjs` uses Chrome/Metal on the local M4 Pro at 1376×1032 CSS pixels and 2× MSAA.
Five interleaved A/B/B/A or B/A/A/B rounds compare frozen views, waiting for GPU completion after each
12-draw batch. Work includes the wind solver, sea reflection and post chain, but excludes story updates,
other world simulations and readbacks. These are **completed-work throughput costs, not FPS, watts or iPad
battery measurements**. Background contention differed between the High and Auto experiments; compare
paired deltas within each experiment, not their absolute times with one another.

| Scene | Old 2× → new High 1.5× | Paired cost reduction range | Old 2× → touch Auto ceiling 1.25× |
| --- | ---: | ---: | ---: |
| Still island | 26.3% | 6.06–6.78 ms | 42.2% |
| Meadow landing | 25.9% | 4.80–6.99 ms | 37.2% |
| Sea | 31.6% | 6.14–10.52 ms | 44.1% |
| Sky mirror | 37.1% | 9.15–9.99 ms | 51.0% |
| Wood | 31.4% | 7.57–9.44 ms | 42.9% |

Percentages are medians of paired changes. Every High/resolution pair improved in all five rounds.
High's tradeoff is slight softness at fine edges. Frozen comparisons preserve composition, grass density,
light and reflections; they do not establish aliasing behavior throughout an entire moving playthrough.
Captures: `/tmp/updraft-power-<chapter>-{retina,high,auto}.png`.

The isolated fog shortcut saved a median 1.67 ms in the opening view, but one pair changed sign. Other
views were within noise, so no universal speedup is claimed. At fixed resolution its final pixels were
identical in four scenes; the meadow differed in five color channels by 1/255, out of 8.88 million channels.
Raw paired runs: `/tmp/updraft-power-profile.log` and `/tmp/updraft-power-high.log`. The script also writes
JSON; `PAIR=retina-to-high` restricts a repeat to that comparison.

A subsequent isolated mirror-shading comparison at 1.5× saved another **23.1%** in the mirror view
(median paired 2.30 ms; every pair saved 2.07–3.05 ms), with no resolution or reflection-quality change.
Its final image differed in 23 channels by 1/255. This shader change was added after the table's resolution
measurements; those gains are not additive percentages. `PAIR=mirror-shading node tools/power-profile.mjs mirror island`
repeats it with an ordinary-island control. The parity check also exercises mirror appearance at .999, .5
and zero so the fade back to ordinary sea cannot bypass its blend. Evidence: `/tmp/updraft-power-mirror.log`.

`tools/frame-pacer-check.mjs` checks cadence at 30–144 Hz, stalls, resume and preset changes.
`tools/power-browser-check.mjs` drives the actual renderer/game loop with controlled callbacks: 60 or 30
renders per simulated second, 60 wind ticks, unchanged game time, and hidden-page resume. This establishes
work counts and timing, not sustainable hardware performance. The real quality-menu check covers saved
presets, manual holds, keyboard selection, full grass restoration and the new High scale.

Next acceptance check is a physical iPad A/B over the same route, brightness, audio volume and duration,
starting cool and unplugged. Record battery drain, device warmth and sustained frame intervals on High
and Auto. Safari's actual display-callback rate determines whether the 60 fps ceiling contributes savings.
Do not convert the desktop throughput reductions into battery percentages. For investigating remaining
cost, [WebKit's energy guidance](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)
and [CPU timeline](https://webkit.org/blog/8993/cpu-timeline-in-web-inspector/) describe Safari's power tools.

### Draw and CPU audit (2026-09-21)

`tools/frame-profile.mjs` now records raw Chrome CPU profiles, frame CPU duration, and draw/triangle counts
by pass and owning world object. The first audit sampled nine chapter entries at High's 1.5× scale,
1376×1032 CSS pixels, 2× MSAA, with audio running on the local M4 Pro. CPU sampling and the instrumented
draw census run separately. These are short fixtures, not a continuous journey or Safari/iPad capture.

Most chapters used 1.7–2.1 ms median JavaScript/frame; Birches used 6.8 ms. Its scarf rebuild accounted for
about 5 ms/frame, including 2.7 ms in `computeVertexNormals`. `gl/indexed-normals.ts` retains the same
triangle accumulation and Float32 rounding using packed arrays. Fifteen real scarf states (all release
counts, calm and strong wind) match Three.js normals exactly. Eight interleaved microbenchmark pairs
measured 3.26 → 0.37 ms median, an 89% reduction in that calculation. Separate browser runs with old/new
normal code measured whole-frame CPU medians of 7.1 → 4.2 ms and p90 of 8.2 → 4.8 ms. Geometry, cloth
physics and detail are unchanged; contact/release/checkpoint checks pass.

The draw audit confirmed wasted submissions. Washing had a 10,000-unit bounding sphere: its vertex
shader rejected distant sheets only after submission. The opening tree and pond disabled frustum culling.
Their bounds now include their world-space instances and animation margins; each camera, including the
reflection camera, can cull independently. Initial frozen comparisons removed 154,220–175,452 triangles
and 5–7 calls in distant scenes, with identical final pixels in nine chapter samples. Paired completion
times were within noise; this is a proven reduction in submitted work, not a measured battery/FPS gain.
An additional 15 near/edge views of full tree foliage, pond and washing also matched exactly.

Costs observed in that baseline (before these bounds and the concurrent journey-room scoping changes):

- Land-heavy entry views submit roughly 1.3–1.7 million triangles/frame. Grass accounts for roughly
  0.6–0.9 million. It already selects tiles by camera frustum and distance; terrain also has its own
  culling/LOD. Their disabled Three.js culling flags are intentional, unlike the fixed objects above.
- Drowned village meshes still disable culling and update outside their room. About 31,000 triangles
  remain submitted in several unrelated chapters; hiding them changed no pixels in those fixtures.
  Birches also submits about 428,000 triangles in the adjacent drowned entry view. Conservative animated
  bounds and smaller spatial batches need testing; chapter-only visibility risks popping during travel.
- Wind submits 22 small draws/tick including its readback reduction; petals run two simulation passes
  and submit 16,384 triangles even in distant rooms. Water waves and cloud shadows add one pass each.
  Bloom uses 12 intermediate draws, plus its blend, scene resolve and final grade. Offscreen targets are
  often necessary calculations, not evidence of offscreen scenery rendering.
- Frozen omission trials attributed about 0.4–1.1 ms to wind, 0.4–1.0 ms to bloom and 1.1–1.7 ms to grass
  in the land views. The sky-mirror reflection cost about 1.16 ms (14%) in its fixture. These are completed
  workload deltas, not hardware GPU timers, and are not additive. Omitting water sometimes made rendering
  slower by exposing other work; triangle counts alone do not identify the largest cost.

Raw audit: `/tmp/updraft-frame-census.json`, `/tmp/updraft-frame-census-<chapter>.cpuprofile`.
Frozen omissions: `/tmp/updraft-frame-profile.json`; culling: `/tmp/updraft-culling-profile.json` and
`/tmp/updraft-culling-edges.json`; scarf: `/tmp/updraft-scarf-{before,after}.json` and
`/tmp/updraft-scarf-normals.json`. The profiler is test-only; no production instrumentation was added.

Jeremy identified walking through Meadow and over its hill as the worst part on iPad. Follow-up CPU and
draw profiles use arranged walk/crest states, then let the game run normally. Other tasks were editing the
shared checkout, so the final runs used `/tmp/updraft-perf-snapshot` on port 5231, with a source hash manifest,
and included the new journey-room scoping in both live frames and frozen comparisons.

| Meadow fixture | Median frame CPU | p90 frame CPU | Grass draw cost when omitted | Grass-table draws/frame |
| --- | ---: | ---: | ---: | ---: |
| Walk | 3.0 ms | 8.0 ms | 1.70 ms / 11.7% | 0.80 |
| Crest | 3.2 ms | 6.5 ms | 2.85 ms / 15.2% | 0.10 |

These views submit about 100,000–106,000 blades and 1.6 million triangles. Readbacks were repeatedly
deferred and eventually forced. The CPU samples contain uninterrupted `getBufferSubData` spans up to
70 ms on the walk and 90 ms at the crest, with three spans over 16 ms in each six-second profile.
The wider fixture counters, including warm-up, report worst waits of 84–90 ms. Short typical CPU frames plus backlogged
GPU work point to rendering pressure causing stalls; this is desktop evidence, not a Safari diagnosis.
Forcing all three grass tables to rebuild every draw added no consistent completion cost (median 0.015 ms,
range −0.015 to +0.285 ms). Moving the sky after opaque geometry also had mixed-sign pairs. Neither
experiment justifies a production change. Reducing grass density was not selected from these results.

A subsequent same-resolution shader comparison found useful work to remove: `grassTint` computed
pasture, wild-meadow and woodland noise even where their blend weights were exactly zero. It now skips
those unused terms; transition regions still compute both sides. This shared function colours the terrain
and cached blades. Six interleaved pairs per view measured:

| View | Median completed-work saving | Relative reduction | Paired saving range |
| --- | ---: | ---: | ---: |
| Meadow walk | 0.88 ms | 6.0% | 0.19–3.58 ms |
| Meadow crest | 1.01 ms | 7.0% | 0.54–1.39 ms |
| Opening island | 0.56 ms | 5.1% | 0.21–0.79 ms |
| Wood | 0.48 ms | 4.2% | 0.27–0.70 ms |
| Sleeping | 0.48 ms | 4.0% | 0.03–1.01 ms |

All 30 pairs improved; all five terrain comparisons had identical final pixels. Timing isolates the terrain
shader change, without counting any possible blade-table saving. The test's `full-tint` variant forces the
three formerly unconditional noise calculations back on. This remains a throughput comparison, not FPS
or battery savings, and percentages cannot be added to the earlier resolution improvements.
Evidence: `/tmp/updraft-meadow-fixed.json` and its two `.cpuprofile` files;
`/tmp/updraft-meadow-bakes.json`, `/tmp/updraft-meadow-tint.json`, `/tmp/updraft-tint-parity.json`.
The last file also compares regenerated blade tables against the unconditional shader: all five views
match exactly, with no browser errors. Both the current checkout and the isolated snapshot build pass.

The grass omission percentage is a **net saving**, not grass's standalone share: deleting geometry can
expose more expensive terrain or water behind it. A follow-up used the same isolated source snapshot,
five interleaved pairs per experiment, and 12 completed draws per batch. Its shorter live warm-up produces
slightly different walk/crest states from the first capture; compare variants within each frozen fixture.

| Diagnostic change | Walk saving | Crest saving |
| --- | ---: | ---: |
| Simple terrain surface colour, keeping terrain geometry, normals, room discard and fog | 7.37 ms / 45.9% | 7.62 ms / 49.5% |
| Omit grass | 2.71 ms / 16.7% | 1.97 ms / 13.9% |
| Copy the HDR/MSAA scene directly to screen, bypassing bloom and final grade | 1.23 ms / 7.6% | 1.26 ms / 8.2% |
| Flat sky colour | 0.55 ms / 3.3% | No consistent saving |
| Omit characters, animals, kites, petals and wind lines | 0.29 ms / 1.8% | 0.60 ms / 3.9% |
| Omit wind simulation | No consistent saving | 0.58 ms / 3.7% |

All ten terrain-simplification pairs improved (walk 6.65–7.76 ms, crest 7.42–7.79 ms). Calls and triangle
counts stayed unchanged. This identifies detailed terrain surface shading as the largest measured target;
it does **not** establish that a visually acceptable replacement can save the same amount. These diagnostic
materials are test-only and intentionally change pixels. Even removing terrain entirely saved less than
simplifying its surface, demonstrating why deletion deltas cannot be treated as an additive frame budget.
The earlier water/reflection comparisons are separate evidence, not extra percentages to add to this table.

Reproduce with `ABLATIONS=terrain-flat,sky-flat,wind,post,actors,grass,grass+terrain-flat,terrain` on
`tools/frame-profile.mjs`. Raw evidence: `/tmp/updraft-meadow-costs.json`; captured source hashes:
`/tmp/updraft-meadow-costs-manifest.json`. Both views completed without browser errors. Surface colour/noise
caching and skipping unused terrain calculations deserve priority over reducing Meadow's width.

### Static field-pattern cache (`world/terrain-fields.ts`)

The ground no longer reconstructs Meadow's fixed field pattern for every visible fragment. A 1024² RGBA16F
texture stores boundary distance, field kind, wall/gate identity and coastal presence. It is compiled with
the other bake shaders and filled once before Begin; it uses 8 MiB and does not follow the moving wind
window. The atlas bounds derive from Meadow's geography. Bilinear sampling replaces the 9-cell nearest-site
and 25-cell boundary searches inside fields. Near field edges, wall lines, gates and the coastal transition,
the original function still runs to preserve sharp identities and narrow marks. Outside the atlas it also
uses the original function.

This caches the fixed pattern, not the final lit colour. Grey-to-colour life, season, wind, shadows, fog,
frost, shore movement and lighting remain live. No grass population, landscape or render scale changes.

Five interleaved pairs per frozen High view, on a new fixed source snapshot, measured a median **2.42 ms /
16.6%** reduction in completed rendering work on the walk and **2.82 ms / 18.0%** at the crest. All ten pairs
improved. Walk pixels matched exactly; the crest differed in 19 colour channels, each by 1/255. These are
desktop throughput comparisons against the original field calculation, not iPad FPS or battery results.

`tools/terrain-fields-check.mjs` compares over a million sample locations across the atlas at three wall
widths. Maximum field-colour error was 0.00071 in linear colour; maximum wall-mask error was below 3e-8.
Eighteen rendered comparisons cover grey/partial/full life and three seasons, both with grass and with the
ground exposed: maximum channel difference 1/255. Repeated bake calls submit no draws; a warm one-off
rebake completed in 15.4 ms in this check. Evidence: `/tmp/updraft-fields-first-valid.json` and
`/tmp/updraft-terrain-fields-check.json`; source snapshot: `/tmp/updraft-field-cache-snapshot`.
Five additional frozen views passed: Meadow's pond and piano differed by at most 1/255 per channel;
Island, Wood and Sleeping matched exactly (`/tmp/updraft-fields-regression.json`).

### Shared static ground-colour patterns (`world/terrain-colour.ts`)

A second atlas extends the technique across all islands: the opening island, named journey islands,
doorway shore and sky mirror. It stores four low-frequency noise inputs for dry, cool and pasture grass
colour and field grain. The final palette, season, grey-to-colour life, wind movement, shadows, frost,
shore and lighting remain live. Fine woodland, soil and frost details still use the original calculation.
World-aligned samples agree across overlapping patches; a two-texel edge blend returns to the original
function outside the padded island bounds.

The shared 1024×1376 RGBA16F atlas is baked once before Begin and consumes **10.75 MiB**, bringing the
two static terrain caches to **18.75 MiB**. These are runtime GPU allocations, not downloadable image
assets, and the allocation is shared by the entire journey rather than repeated per island. Repeated bake
calls submit zero draws. One warm rebake took 4.7 ms; this is not a cold-start compilation measurement.

Four interleaved pairs per frozen High view measured the following reductions in completed rendering work
against direct colour-noise calculations. The Meadow field cache is enabled on both sides.

| View | Median saving | Relative reduction |
| --- | ---: | ---: |
| Opening island | 0.66 ms | 5.6% |
| Washing | 0.51 ms | 4.6% |
| Little boats | 0.61 ms | 5.5% |
| Meadow crest | 1.16 ms | 10.0% |
| Birches | 0.69 ms | 6.2% |
| Wood | 0.89 ms | 7.7% |
| Sleeping | 0.90 ms | 7.9% |
| Home jetty | 0.63 ms | 5.8% |

All 32 pairs improved. Seven views matched exactly; Meadow's crest differed by at most 1/255 per channel
(mean 0.000624/255), with no noticeable difference in the reviewed images. These are local Chrome/Metal
throughput comparisons, not hardware GPU timers, gameplay FPS or iPad battery measurements. The savings
are incremental to the earlier field cache and cannot be added to its percentages.

The shared tint-function refactor matches the original formula within 5.96e-8 linear colour. GPU sample
checks cover all 11 atlas patches at three seasons; maximum cached tint error was 0.0081 linear colour,
with worst patch mean 0.00021. Eighteen rendered life/season pairs, with and without grass, differed by
at most 1/255. Evidence: `/tmp/updraft-colour-first.json`, `/tmp/updraft-terrain-colour-check.json`;
fixed source snapshot: `/tmp/updraft-colour-cache-snapshot`.
Extended distant-ground captures (`GROUND_VIEW=1`) and Drowned/Mirror/Sea timing runs were queued
behind another GPU capture and cancelled before acquiring the lock. They are not part of the completed
visual or performance evidence above.

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
- Swan fragments likewise clamp interpolated underside shading to 0–1: distant wing triangles otherwise flash as their lighting extrapolates under MSAA. `node tools/swan-shading-check.mjs` compares the old and fixed shaders through wingbeats at four distances and checks that ordinary shading remains unchanged.
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

`?stats` draws a small readout (frame percentiles, CPU time inside the frame, quality level, readback counts, draw calls, boot time) for devices without a debugger. The explicit `?lite=1` comparison preset uses: 128² wind with 12 pressure iterations and the same 60 Hz simulation clock, a quarter of the grass at 0.7× reach, and far terrain that splits less. The costs that do not shrink with resolution matter most there: the wind simulation (22 passes of 256² per tick, plus another force pass for each additional eight sources), the life, cloud and petal passes, and bloom. The solver accumulates elapsed game time, runs zero to six ticks per frame, and shares the game’s 100 ms stall cap. High-refresh displays no longer multiply simulation cost or speed; input is retained and resampled between ticks.

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

Wind timing fix (2026-09-20): `wind/clock.ts` resamples sustained sources and movement trails onto a fixed
60 Hz clock, including the lite preset. One-shot gusts are applied once; high-refresh frames retain their input.
At 120 fps this halves full solver ticks versus the old frame-based loop. The shared loop now accepts 100 ms with bounded world substeps; prolonged frames below 10 fps still slow
game time as a whole, and hidden time is not caught up.
Chrome/Metal checks passed 72 combinations of 20/30/60/90/120/144 fps, normal/lite, and six input patterns.
Steady breeze, held forces, straight strokes, impulses and 13 simultaneous sources gave identical fields.
Circles sample different polygons; aggregate velocity magnitude differed by at most 2.4%, and transported
gust/lift fields by at most 3.6%. Local pointer interpretation also passes at 30/60/120 Hz. This establishes
simulation timing and force consistency, not physical-device performance or a combined release playthrough.

Remaining findings that need a separate decision or larger change:

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

## Startup and recovery follow-up (2026-09-20)

A cold production-build CPU profile traced a 1.17-second startup task mostly to scarf settling: 180 cloth
updates repeatedly sampled procedural terrain before a height bake existed. `prepareInBatches` now runs the
same steps in short batches and yields for the opening veil to paint. A numerical regression checks both
current and previous cloth positions against synchronous settling; the contact/migration checks still pass.
This changes scheduling, not cloth physics. It does not defer room allocation or reduce total startup work.
A local cold-load profile measured the worst RAF gap at 1,167 ms before and 267 ms after; the navigation-to-ready
profile windows were about 2.9 and 3.0 seconds. These are local Chrome measurements, not phone measurements.

The initial HTML includes a small inline SVG cygnet while loading, replaced by Begin/Continue when ready.
Its CSS animation is disabled for reduced motion. It cannot guarantee animation through a browser/GPU stall.
`tools/boot-profile.mjs` records cold-load long tasks, WebGL stalls and a CPU profile for further investigation.

WebGL loss pauses play and offers checkpoint reload; see `docs/contracts/progress.md`. Coarse production
performance and lifecycle telemetry uses the shared analytics service; see `docs/contracts/analytics.md`.
Local release checks and the continuous journey runner are listed in `docs/testing.md`.
