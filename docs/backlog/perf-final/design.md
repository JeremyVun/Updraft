# Final performance pass over the whole game

## Jeremy's brief (verbatim)

2026-09-29, after the stairs in the clouds were added:

> yea after we added the stairs level, i need another pass to find performance optimisation opportunities.

> in terms of the perf, create a backlog item for a final perf profile and optimisation pass over the whole game

## What this is

The last performance pass before release. A fresh profile of the whole journey (`profile.md`, 2026-09-30) found the
game 12 to 28% heavier per frame than when the previous pass ended, and that lower resolution alone barely helps a
weak device. This item takes every saving that changes no pixel and no sample, then rebuilds the graphics settings as
four named levels that Auto moves between, each level switching off the effects it cannot afford.

The previous pass (perf-bakes) is merged and closed; its code ended at `69af219`, and its lasting rules are in
`docs/engine.md` (Bakes and caches, Before/after flags, Measuring). Its per-chapter tables are in git:
`git show 829e70f:docs/backlog/perf-bakes/design.md`. Its rulings carry over unless Jeremy changes them:

- **Energy over a whole playthrough counts, not frame time alone** (2026-09-25: "the back of ipad still gets hot.
  There must certainly be more computation (cpu or gpu) that we can save on in the game"). A cost in a room the player
  spends ten minutes in outweighs the same cost in a one-minute one; CPU script and the audio graph count as well as
  the GPU.
- **Exact first, then the look.** Anything that changes the look gets stills for Jeremy and merges only on his verdict.
- **Kept as ruled:** the top level stays 1.5× (2026-09-26); alpha-to-coverage and MSAA stay at every level (without
  them the sail's see-through cutaway breaks); glints, ripples, surf and wind streaks on the sea are untouched at the
  top level.
- **Light testing.** Jeremy, 2026-09-26: "are we over testing? I can playtest most of it, i dont need full video
  capture of the entire game" and "some very quick screenshots or recordings will help". Exact items get typecheck,
  build, a short frame-difference pass and one saving measurement; look changes get a few quick before/after shots of
  their key moments. No switches in the deployed game ("i dont want switches for the deployed version though").

## Leads left by the last pass

Where the time went at its end (1.5×, Mac, weighted by minutes): the sea surface's shading was the largest GPU cost
(about 19%, 25 to 41% of a frame afloat), then grass (13%, vertex-bound, the near level most of it), post and bloom
(10 to 12%) and terrain shading (10%). Sound cost CPU on the scale of the game script. Re-measure before trusting any
of it; the stairs, the cloud sea and the rebuilt characters came after.

Not built, still open:
- **Sea shader:** the weed term is multiplied by exactly 0 outside bed depths 0.9 to 4 m (two `vnoise` a pixel over
  most of the open sea) and the caustics beyond 220 m and above 0.1 m of water (two `textureGrad`); upper bounds 1 to
  10% each. `waterWindAt(xz)` is read twice (`stroke` and `windWaveSlope`), `foamColor` recomputes `backlit`, and
  `fogOf` can evaluate `skyRadiance` up to three times for one ray.
- **The wind step:** 21 small passes could fuse to about 12, exactly, for 0.1 to 0.2 ms on the Mac. Worth it only if
  tile-based GPUs pay more per pass than the Mac shows.
- **Look changes Jeremy has not been asked about:** bloom at half resolution (about 3%), a sparser or shorter near
  grass level (up to 10%), grass fog once per blade instead of per vertex (up to 2.4%), the seabed, glints or ripples
  in the sea (2 to 3% each), wind and life readbacks every other frame (0.1 to 0.2 ms of CPU, a frame of latency).
- Auto's touch ceiling stays 1.25× (High is 1.5×); pricing the two against each other was left open.

Tried and not worth it (don't repeat without a new reason):
- Skipping empty grass tiles: almost none are empty at every density (Birches and Wood floors thin by rank, not to
  zero). Returning early for sea under land: exact, but slower afloat than it saves on land. Skipping the seabed
  where the water hides it: it is never hidden where it is drawn. Pausing the Birches room in the Drowned drift: it
  is on screen for the first seconds.
- Tiled noise textures for single-octave `vnoise` terms (grain, ripples, the Wood's moss and flecks, the seabed): one
  sample costs about as much as one `vnoise`. Only four-octave `fbm` pays.
- Terrain without its discard, the grass's frost, dawn and lamp terms (they already early-out), skipping the mirror
  pass where it is invisible (it is free there), drawing the sea last (slower and not exact), MSAA without the depth
  resolve (drops the antialiasing), re-baking only the newly exposed window strip.
- The scarf: skipping unchanged sections or resting cloth would change its motion (time-driven roll, the wind never
  zero, a slow creep).
- Clouds baked into a static texture (they drift), props' noise (small screen area), a room-index texture for
  `journeyHides` (cheap arithmetic), the pond's noise (scrolls).

## Scope

- Every room, the crossings and the ending: GPU, CPU script, graphics memory.
- The graphics settings: the levels, what each keeps, and how Auto moves between them.
- **Not in scope:** the boot freeze and the loading veil, which are `docs/backlog/boot-veil/`. This item may lengthen
  the veil (more programs to compile) but must not add a freeze to it; its loading time before and after is reported
  to that item. Audio: nothing measurable was found to save.

## Constraints

- Nothing changes how the game plays, the camera, or the story's timing.
- Play never freezes or hitches for a saving (Jeremy, 2026-09-29, on setting up the stairs: "what i want to avoid
  though it having the gameplay itself freeze"). Deferring or streaming work must be proven hitch-free with the
  frame-time checks.
- Measurement rules from `docs/engine.md` "Measuring": a worktree with its own server, no other Chrome capture
  running, builds compared back to back, never against remembered numbers. Desktop deltas are not iPad numbers.

## Design

### 1. Free wins (no pixel, no sample changes)

| Item | Where | What | Measured (profile.md) |
|---|---|---|---|
| Deck-free programs | `atmosphere.ts` (`fogOf`, `cloudShadow`, the sun dimming), `sky.ts`, `water.ts`, `terrain.ts`, `grass.ts` | Section 2's variants: the cloud deck compiled out while `uCloudDeck.w` is 0 | 7.5% of GPU work at the top level, 7.3% weak; sea and terrain carry 70% |
| Coat folds | `traveller/child/motion.ts` `hemClear` | `hemY(a)` is fixed per hem bone; compute once | 0.06 to 0.08 ms of script per frame |
| Stairs mesh indexed | `world/stairs.ts` `Build.result()` | Merge identical vertices, same triangles in the same order | about 30 MiB; up to 3 to 5% of stairs frames |
| Canvas without depth | `main.ts` `new THREE.WebGLRenderer` | `depth: false`; only the grade quad draws to the screen | 12 MiB at the top level |
| Wisps early-out | `world/stairs-puffs.ts` | Discard where `d >= 1.25`, before the noise | 2.4 to 3.7% of in-cloud frames |
| Sky under the deck | `world/sky.ts` | Work out the deck first; skip the radiance where it covers fully | 1 to 3% of stairs frames |
| Village rests during the stairs | `world/drowned.ts` `update` (the `NEAR_Z` test) | The stairs landing sits inside the z-band; rest there too, using the existing catch-up as the boat nears | 0.1 to 0.2 ms of script per frame for the stairs' minutes |
| Stairs: work that cannot be seen | `world/stairs-cloud.ts`, `main.ts` | The cloud top (116k vertices) is never culled; in the white the sea, terrain and grass are shaded and change no pixel. Cull or skip only behind a gate proven along the stairs camera paths | cloud top 28 to 33% of top and sail frames; sea 19 to 30% in the white |

The village rest is kept only if a check shows the village is never on screen from the stairs and its state after the
catch-up passes `tools/drowned-gating-check.mjs`. Every other item is kept only if frames match the old path to 1/255.
The deck-free sea moved glint specks by up to 21/255 at one jetty camera step (single pixels, the kind any sea-shader
edit moves); that is accepted if a still of the jetty shows no visible difference.

Script leads from the profile's CPU samples (6 s each at 1.5×; `/tmp/updraft-pf-profile/high-now-*.cpuprofile`), each
to be confirmed and taken only if exact:

- **Matrix updates of things that never move:** three's `updateMatrixWorld` and `multiplyMatrices` are 60 to 100 ms of
  every 6 s sample in every room (about 0.2 to 0.3 ms a frame). Static scenery can stop recomputing its matrices
  (`matrixAutoUpdate` / `matrixWorldAutoUpdate` off once placed).
- **Procedural ground height on the CPU at the washing lines:** `gfbm` and `gradDot` (`heightfield.ts`) are 132 ms of
  the washing sample (about 0.35 ms a frame) and 53 ms on the Meadow walk: something asks for the exact terrain every
  frame where the baked height copy would do, as the moored boat did in the last pass.
- **Normals rebuilt every frame in the stairs' cloud:** `computeVertexNormals` and `fromBufferAttribute` (about 40 ms of
  the in-the-white sample).
- **The creatures:** the Meadow's are 0.56 ms a frame on the walk (the largest script item of the longest room) and the
  first island's 0.60 ms at the washing lines; the procedural height calls above are probably theirs. The cygnet is
  0.3 ms in every room, of which fitting its bandage (`bandage.ts` `fitted`) is 0.04 to 0.08 ms and three's generic
  `computeVertexNormals` about 0.04 ms (the scarf's `indexedNormals` replaced the same call in the last pass).
- **The wind readback at sea:** `getBufferSubData` is 286 ms of the open-sea sample (about 0.8 ms a frame) against 50
  to 100 ms elsewhere; find what makes the sea's map wait and whether the existing gate can avoid it.

GPU leads from the same census, beyond the table above, each to be confirmed and taken only if exact:

- **Inside the sea shader** (the largest cost: 22% of the playthrough, 41 to 48% of a frame afloat), the last pass's
  unbuilt leads: the weed term is multiplied by exactly 0 outside bed depths 0.9 to 4 m (two `vnoise` a pixel over
  most of the open sea); the caustics are 0 beyond 220 m and above 0.1 m of water (two `textureGrad`);
  `waterWindAt(xz)` is read twice; `foamColor` recomputes `backlit`; `fogOf` can evaluate `skyRadiance` up to three
  times for one ray. Skip zero-weight terms and fold repeats (the rule in `docs/engine.md` "Bakes and caches").
- **The wind step** is 0.33 to 0.43 ms at every setting (up to 6% of a frame, more on a weak device): its 21 passes
  could fuse to about 12, bit for bit, as the pressure solve's pairs already do.
- **The sky mirror's reflection pass** is 23% of the mirror fixture's frame; check whether it renders while the flat
  is out of view and skip it then.
- **Bloom where nothing can bloom:** its passes cost 6 to 13% of a frame and changed no pixel at the island, the Wood,
  the summit and parts of the stairs (nothing over its 1.1 threshold). Take it only if a gate can prove in advance
  that no pixel will cross the threshold; a gate that reacts a frame late is a look change.
- **Meshes drawn with nothing to show:** the starlings (24k triangles) and petals (16k) are submitted in nearly every
  room, the sleeping island in 25 draws from the open sea, the stairs' steps (262k) from inside the white.
- **Many small draws:** the mirror is 220 draw calls a frame (70 for 4k triangles of its own), the little boats 68
  for 31k; merging or instancing static pieces cuts the 0.4 to 0.6 ms of submission.

- **The sea shaded under land** (12.9% of the summit's frame with no sea pixel on screen: the sea draws first, and the
  terrain and grass discard, so the GPU cannot cull it). The last pass's early return where the baked ground is a metre
  above the sea was exact and saved 2 to 6% on land, but its test cost more afloat than it saved. As a variant
  (`LAND_SKIP`) selected while the child is ashore and the plain program afloat, land rooms keep the saving and the sea
  pays nothing. Jeremy, 2026-09-30: "if sea isn't on screen, why is it being drawn on land?"

Known and left alone: drawing the sea last (27 to 38% slower at sea and not exact), the MSAA clear and resolve (0.68 ms every
frame; without the depth resolve the antialiasing goes). Not measured by this profile: frame-time spikes (window moves, chapter changes, the light bake's 2 to 2.4 ms when it
runs), Safari on the iPad itself, and heat. Phase 8 measures the first; the others need the device.

Look changes for section 4's survey: the near grass's blade
geometry (grass is 0.8 to 1.1 million triangles a frame on land and bound by vertices), the child's 53k triangles when
she is small on screen, the boat's 4 to 5% at sea, and
the render targets' format: the scene, its resolve, `post.clean` and the bloom chain are half-float RGBA (157 MiB of
the 341 at the top level); `R11F_G11F_B10F` would halve that and the bandwidth of every resolve and bloom pass, at the
risk of banding in dark gradients.

Garbage collection is not a cost: 0 to 0.6% of busy script time in every room (0 to 7 ms per 6 s), with no long
pauses. Cache locality was not measured (a JS profiler cannot see it); script is about 2 ms of a frame, most of it GL
calls, so the ceiling is small.

Not taken: releasing the two 4 MiB shore seed targets between window moves (reallocating them would risk a hitch);
limiting the lantern glint to its 9 m reach (exact, saves nothing: the cost is the code's presence); holding the
stairs' air layers at zero (no measurable saving).

### 2. Program variants

On these GPUs code that is compiled in but switched off by a uniform still costs (register pressure): the deck 7 to
10% of a frame it never draws in, the lantern glint 1.6 to 3.5%, the hull's wet collar about 3% at sea. So a
switched-off effect must be compiled out, not branched round.

- Each effect is a GLSL `#ifdef` on a material define: `CLOUD_DECK` (sea, terrain, grass, sky), and on the sea
  `HULL_COLLAR`, `LANTERN_GLINT`, `SEABED_DETAIL`.
- A variant is its own material sharing the original's uniform objects, so both stay alive and their programs are
  never released. Switching is assigning `mesh.material`; nothing compiles during play.
- Every variant any level can use is compiled behind the veil with the existing `precompile` (`gl/boot.ts`,
  `compileAsync`, parallel where the driver allows) and warmed. Sea: deck on/off × three effect sets (top two levels,
  Medium, Low) = 6 programs; terrain, grass and sky: deck on/off for each program they have today.
- The deck variant is chosen once per frame in the final-view preparation from `uCloudDeck.w > 0` (so the deck
  programs are bound from the first frame the deck fades in to the last it fades out); the effect set follows the
  quality level.
- Jeremy: "I'm ok with longer compile times during the initial veil load as long as the veil doesn't freeze." The
  longest gap between painted veil frames must not grow (`tools/start-check.mjs` measures it; it fails today for
  boot-veil's reasons, so compare before and after on the same machine).

### 3. Four levels, and Auto between them

| | Ultra | High | Medium | Low | Last step (Auto only) |
|---|---|---|---|---|---|
| Render scale | min(DPR, 1.5) | min(DPR, 1.25) | min(DPR, 1) | 0.85 × min(DPR, 1) | 0.72 × min(DPR, 1) |
| MSAA | scene default | scene default | up to 2 | up to 2 | up to 2 |
| Presentation | 60 fps | 60 fps | 60 fps | 30 fps | 30 fps |
| Grass density / reach | 100% / 115% | 100% / 115% | 100% / 100% | 100% / 100% | 50% / 100% |
| Terrain split, mirror scale | 1.6, 0.75 | 1.6, 0.75 | 1.35, 0.625 | 1.1, 0.5 | 1.1, 0.5 |
| Bloom | full | full | half resolution | off | off |
| Hull wet collar | yes | yes | off | off | off |
| Lantern glint and light on the sea | yes | yes | yes | off | off |
| Ordinary sea's reflection | alternate frames | alternate frames | alternate frames | off | off |
| Sky mirror's reflection | every frame | every frame | every frame | alternate frames | alternate frames |
| Seabed detail in the shallows | yes | yes | yes | off | off |
| Stairs wisps and haze steps | full | full | fewer | fewer | fewer |

- Ultra is what High was; a saved `high` in `updraft.quality.v1` becomes `ultra` (new key `updraft.quality.v2`), so
  nobody's picture changes. High is new: Ultra at 1.25× and nothing else different.
- **Auto moves only between these levels** and looks like one of them at all times. It opens at the highest level its
  ceiling allows: Ultra, or High on touch devices (the 1.25× touch ceiling stands, so iPads and phones on Auto start
  exactly where they do today). On viewports over the 2.4 million pixel budget Auto lowers the render scale of the
  level it is on to fit (never below 0.5×); that is the only thing Auto does that a manual level does not.
- Stepping down and climbing use the governor's existing evidence (trimmed mean of frame intervals to step down, the
  10 ms fence probe or 12 s of smooth frames to climb, a failed climb doubling the wait). At Low and the last step the
  budget is 33.3 ms, as it already is under a device's own 30 fps cap. A climb from Low to Medium asks for frames
  finishing within 10 ms of submission: Medium renders 1.38× Low's pixels plus half bloom, the glint, the reflection
  and the seabed, about 1.55× in all, so 10 ms becomes about 15.5 ms, inside one 16.7 ms refresh. Ultra is 1.44×
  High's pixels and High 1.56× Medium's, as today.
- The last step is reached only when Low at 30 fps still runs long. There is no 25% grass anywhere.
- The "fewer" wisps and haze steps and what "seabed detail" covers (caustics, weed and the bed's noise, never the
  shallows' colour) are chosen in the build by a visual model and shown to Jeremy as stills.
- The menu offers Auto, Ultra, High, Medium, Low; its indicator and title name the level in use. `quality_changed`
  and `performance_sampled` carry the level's name.

### 4. More effects to switch off

Jeremy: "im sure there are many other things in the game like this that make sense to turn off appropriately at medium
and low". After the levels exist, one measuring phase costs further candidates at Medium and Low settings (cloud
shadows, sky detail, petals and small flying effects, the child's mesh when small on screen, grass fog per blade, and
whatever the census shows) and brings Jeremy a list with costs and stills. Nothing from it is built without his
ruling; that list, once ruled on, is appended to the table above and the build plan.

### 5. How it is judged

- Exact items: typecheck, build, frames within 1/255 of the old path at the profile's fixtures (static and along a
  camera path; `tools/frame-profile.mjs` with `ROUNDS=0`), one saving measurement. Old paths live only in the tools'
  ablations or on the pre-change commit.
- Level changes: a few quick before/after stills of the key moments per level, judged by an allowed visual model and
  shown to Jeremy; the quality checks in `docs/testing.md` updated to the four levels.
- No hitches: `tools/perf.mjs frames` across the crossing into the stairs and out into the drowned village (where the
  deck programs swap), and across every Auto level change.
- At the end, the profile's census is re-run back to back against the commit this item started from, at Ultra and at
  Low, with the memory census.

## Jeremy's answers (2026-09-29)

> any kind of performance improvement we can get is good so we can get this playable on more devices. I think we can
> profile on this mac and just get performance up?

- **Goal:** less work per frame everywhere, CPU and GPU, so the game runs on more devices. Battery and heat on the
  M5 iPad follow from that; weaker devices (older iPads, phones) are in scope, so Medium, Low, Auto's lower rungs and
  graphics memory count too.
- **Measured on this Mac.** Its Apple GPU is the same family as the iPad's, so where the time goes and the relative
  size of a saving carry over; absolute milliseconds do not. `?ratio=2` makes the GPU the bottleneck on purpose so
  GPU savings show. No iPad readings needed to start.
- **Asked, 2026-09-29:** "Do we already cap fps to 30 to keep visual quality higher?" Only the Low preset presents at
  30 fps; High, Medium and Auto aim for 60, and Auto lowers resolution, antialiasing and world detail to hold it
  (it only judges against 30 when the device itself caps, as in iOS Low Power Mode). Whether Auto should end on a
  30 fps rung that keeps more detail, instead of its last rung (25% grass, 70% reach), is a candidate for this pass:
  it trades smoothness of the wind under the pointer for looks, so it goes to Jeremy with evidence.
- **Settings profiled (chosen 2026-09-29):** High (1.5×, MSAA 2), comparable with the last pass, plus a weak-device
  pass at Low-like settings (about 0.85×, MSAA 2, world detail 0). At low resolution the costs that do not shrink with
  the screen stand out (wind simulation, script, audio, small GPU passes), and those decide whether weaker devices
  keep up.
- **Minutes per room (chosen 2026-09-29):** the last pass's estimates, plus one short timed run of the stairs. No full
  traced playthrough (an hour, and it holds the browser lock for every session).
- **Graphics memory (chosen 2026-09-29):** measure what every texture, render target and table holds, and cut only
  what goes without changing the picture (for example targets kept alive while unused). No target-device budget.

## Jeremy's rulings on the profile (2026-09-30)

The profile is `profile.md`. His answers, verbatim where quoted:

- **Free wins are taken without asking.** "any free wins in terms of memory, take them"; "again, any free wins, take
  them"; on the stairs, "anything that is a free win for the stairs, take it". A free win changes no pixel and no
  sample.
- **Cloud-free shaders outside the stairs** (the deck code compiled out of the sea, terrain, grass and sky programs
  while `uCloudDeck.w` is 0): taken. "I'm ok with longer compile times during the initial veil load as long as the
  veil doesn't freeze."
- **The child's coat folds** (`hemClear` recomputing `hemY`): "if there are redunant calculations for coat folds that
  never change, that sounds like a free win? If it is a free win, take it."
- **Effects come off by quality level.** "lantern glint and wet collar seem to me like things we can remove using the
  governor? e.g. medium keeps lantern glint but loses wet collar. - low loses both?" and "im sure there are many other
  things in the game like this that make sense to turn off appropriately at medium and low".
- **Grass.** "lets raise medium and low to full grass with low capped to 30 fps. I think auto's 25% grass step is
  horrible looking. I'd rather try to turn off other things than reduce grass to 25%. can we raise that to 50%
  atleast".
- **Bloom:** half resolution on Medium, off on Low. "approved on bloom suggestions".
- **Auto.** "Honestly, i expected auto to be an auto between high, medium, and low. I dont understand why it's sitting
  in it's own track."
- **The stairs** are expected to be heavier; only savings with no loss of visual quality are wanted there.
- Dropped: holding the stairs' air layers at zero (no measurable saving).
- **Approved for the lower levels (2026-09-30):** "your three question mark suggestions are approved": the ordinary
  sea's reflection off on Low, fewer stairs wisps and haze steps on Medium and Low, the seabed detail in the shallows
  off on Low. Each still comes with quick before/after stills.
- **Grass reach:** asked whether Medium's 95% and Low's 85% are needed: "do you see a need to do 95% and 85%? im not
  sure i do."
- **A step between High and Medium:** "sure, we can add another setting between high and medium."
- **Four settings (2026-09-30):** "then just add the fourth setting. ultra, high, medium, low. dont overcomplicate
  this." Ultra is today's High; High is the step between (1.25×); Auto moves between the four and has no states of
  its own, apart from one last step below Low.
- **Grass reach (2026-09-30):** Medium and Low at 100% density and 100% reach approved ("yea this is approved").
