# perf-final build plan

Read `design.md` first (the mechanism and Jeremy's rulings), then `profile.md` (the evidence and the fixtures).
`docs/engine.md` "Quality governor", "Bakes and caches" and "Measuring" describe what is being changed and how to
measure.

Rules for every phase:

- Work in a worktree under `/private/tmp` forked from current `main`, with its own server on its own port; measure
  only there, with no other GPU user running (`GPU_QUIET=1`), builds compared back to back.
- The profile was taken at `8f70dd5`; `main` has moved since (the stairs top, QA switches excluded from production
  builds: tools run against the dev server or `npm run build:qa` + `npm run preview:qa`). Its numbers are a guide to
  where the savings are, not a baseline. Each phase measures its own before and after.
- No query flags or switches in `src/` for old paths. An old path lives in a `tools/frame-profile.mjs` ablation or on
  the pre-change commit.
- Visual work (choosing how an effect looks at a level, the menu, judging stills) goes to an allowed visual model.
  Everything else is nonvisual.
- Light testing: typecheck, build, the phase's gate. No full playthrough, no full-game video.
- A look change waits on its own branch for Jeremy's verdict on the stills; exact changes merge when their gate passes.

Seams shared by phases:

- **Variants (phase 2 → 3b-ii, 5), as built.** `src/gl/variants.ts`. A variant is a define set on the existing
  material, switched in place; three keeps every program a material has built, so a switch rebinds a program built
  before Begin (no twin materials: they would change the opaque draw order by `material.id`, draw UUIDs from
  `Math.random`, and miss state set on the original). `register(material, ...axes)` takes axes of alternatives
  (`CLOUD_DECK = [{CLOUD_DECK:true},{CLOUD_DECK:false}]`; every alternative in an axis sets the same switches; a
  switch belongs to one axis; calling again adds axes). `select(material, choice)` sets all of an axis's switches at
  once and throws on an unregistered combination; `selectAll(choice)` applies to every material with those
  switches. Shaders test `#if NAME` (defines are `1`/`0`); `ATMO_GLSL` defaults `CLOUD_DECK` to 1 for unregistered
  materials. Add new switches to the `Switch` union. Boot compiles and warms every variant (`otherVariants()` steps)
  without creating three objects. Variant state is per material, so one frame's choice holds in every view; a
  per-view variant is not supported. Each added axis multiplies boot's variant steps (about 15 ms each plus compile):
  re-measure the veil gap and load time. On Apple hardware every program's first draw costs about 0.2 s of a first
  visit (`docs/backlog/boot-veil/design.md`), so weigh each new variant's saving against that; warming at boot keeps
  the cost out of play. boot-veil is reworking the precompile and warm-up into groups in `gl/boot.ts` and `main.ts`
  `boot()`: check its state before touching them.
- **Level (phase 4 → 5, 6).** `QualityLevel` gains `name: 'ultra' | 'high' | 'medium' | 'low' | 'last'` and
  `frameRate: 30 | 60`. `applyWorldQuality(level)` in `main.ts` is the one place a level's effects are applied; phase
  5 adds its effects there and nowhere else. The deck choice is per frame and independent of the level.

## Phase 0: the profiling tools on main

- **Owns:** `tools/frame-profile.mjs`, `tools/lib/stairs-fixture.mjs`, `tools/memory-census.mjs`,
  `tools/audio-cost.mjs`, `tools/stairs-check.mjs`; `docs/testing.md` (tool list).
- **Do:** merge branch `perf-final-profile` (e609173, tools only) into `main`'s current tools and make them run
  against a QA build or the dev server as `main` now requires.
- **Gate:** `node tools/frame-profile.mjs island stairs:top` with `ROUNDS=0` reports each ablation biting;
  `node tools/memory-census.mjs` runs at the island; `node tools/stairs-check.mjs` passes.
- **Done:** [x] merged to `main` at c105e8f (2026-10-01).
- **Commands for later phases.** `frame-profile` and `memory-census` patch `src/main.ts` as served, so they need a dev
  server (not a QA build); `stairs-check` and `audio-cost` run on either. A cross-build gate needs a second worktree
  at the pre-change commit with its own dev server on port `<Q>`.
  - Frame difference against another build: `BASE=http://127.0.0.1:<P>/ COMPARE_BASE=http://127.0.0.1:<Q>/
    FRAME=600 COMPARE_MAX=1 ROUNDS=0 ABLATIONS=none OUT=/tmp/<prefix> node tools/frame-profile.mjs <fixtures>`; read
    the `against` lines (`changed`, `over1`, `max`, `box`, `drift`); `CAPTURE=1` saves both PNGs. `FRAME` seeds
    `Math.random`, pins readbacks to fixed frames and plays stairs fixtures one pointer move per frame
    (`stairsFixtureOnFrames`). Trust a fixture only where the build reads 0 against itself (verified: `island`,
    `sea`, `meadow:walk`, `drowned`, `stairs:climb`, `stairs:cloud`, `stairs:top`). The comparison page runs the
    current tool's injection, so the old commit must still have every object it names.
  - In-page ablation difference: `ROUNDS=0 CPU_MS=1500 CENSUS_MS=800 ABLATIONS=<a,b> node tools/frame-profile.mjs
    <fixtures>`; each row's `bite` says what it touched, and an ablation that changes nothing throws.
  - Paired saving: `RATIO=1.5 MSAA=2 DRAIN=1 GPU_QUIET=1 QUIET=120 ROUNDS=6 DRAWS=10 ABLATIONS=none,<a>` (weak device
    `RATIO=0.85 MSAA=2 LEVEL=low`; `POST_PASSES=1`, `SIM_PASSES=1` as needed); never with `FRAME`, never `ROUNDS=1`.
    Against the pre-change commit, run the same back to back on both servers per fixture.
  - Memory: `RATIO=1.5 MSAA=2 node tools/memory-census.mjs island <fixtures>` (341.2 MiB at the island on c105e8f's
    parent tools).
  - `stairs-check`: `NOSHOTS=1 node tools/stairs-check.mjs /tmp/<prefix>`, about 6 minutes, exits 1 on a missed beat.
  - Frames at which the stairs moments arrive under `FRAME`: climb 241, loop 1676, waiting 1935, cloud 3006, top
    5125, sail 10446, fog 13653 (`stairs:sail` loads take about 3 minutes, `stairs:fog` 4, doubled under
    `COMPARE_BASE`). Start a background dev server with a long timeout: one was killed at 30 minutes mid-run.

## Phase 1: small free wins

Built as two parallel parcels from 36c52e1, compared against a baseline worktree at that commit: 1a the table items
(branch `perf-final-p1a`), 1b the script leads (`perf-final-p1b`, which leaves 1a's files alone).

- **Owns:** `src/traveller/child/motion.ts` (coat folds), `src/world/stairs.ts` (`Build.result()` indexed),
  `src/main.ts` (the renderer's `depth: false` only), `src/world/stairs-puffs.ts` (early discard),
  `src/world/sky.ts` (deck first), `src/world/drowned.ts` (rest during the stairs).
- **Contract:** each is the only code path and leaves every frame within 1/255. The village's rest during the stairs
  uses the existing catch-up (the last 10 s at 1/30 s steps as the boat nears); it is kept only if the village is
  never on screen from any stairs camera and `tools/drowned-gating-check.mjs` passes, otherwise dropped and said so.
  The indexed mesh keeps the same triangles in the same order. `sky.ts` is also touched by phase 2: land this first.
- **Script leads** (design section 1, "Script leads"): confirm each in a CPU profile, fix where the result is
  identical, and say which were dropped and why. They may touch `src/world/` scenery construction (static matrices),
  the washing lines' and Meadow's per-frame height lookups (`src/creatures/`), the cygnet's bandage fit and normals, `src/world/stairs-cloud.ts` (normals; shared with phase 3,
  so do it here first) and `src/gl/readback.ts`. Static matrices: only objects nothing ever moves, reparents or
  animates; frames must match.
- **Gate:** typecheck, build; `frame-profile` `ROUNDS=0` frame difference against the pre-change commit at
  `island`, `stairs:waiting|climb|cloud|top|sail`, `drowned`; `tools/stairs-check.mjs`, `tools/drowned-gating-check.mjs`,
  `node tools/cygnet-gates.mjs`; `memory-census` before and after (expect about −30 MiB from the stairs mesh and −12 MiB
  from the canvas at 1.5×); the child's `motion.update` in a CPU profile before and after.
- **Done:** [x] merged to `main` at c05467d (2026-10-01). Frames 0 changed against 36c52e1 at `island`, `washing`,
  `sea`, `meadow:walk`, `drowned` and every stairs fixture but `loop` and `fog`.
- **Kept, all exact:**
  - Coat folds: `motion.update` 0.17 → 0.07 ms a frame.
  - Indexed stairs mesh: 787k → 179k vertices, −36 MiB; unindexed was 2.8% slower at `stairs:climb`.
  - Canvas `depth: false`: −12 MiB.
  - Wisps early-out: 6.4% at `stairs:climb`, 5.8% at `stairs:cloud`.
  - Sky deck first: 5.6% at climb, 3.9% at cloud.
  - Ground height: a memo of `worldHeight` plus each island's constant floor beyond a proven bound (`heightfield.ts`
    `isleFar`). Washing heights 0.25 → 0.03 ms, creatures 0.30 → 0.10 ms.
  - Static matrices (`gl/fixed.ts`, 330 of 524 nodes): one `updateMatrixWorld` 33 → 19 µs.
  - Bandage normals through `indexedNormals` and an incremental ring search: the cygnet 0.20–0.27 → 0.13–0.17 ms.
- **Dropped:**
  - The village resting during the stairs: its cost is the leaf drift, which has no catch-up; resting it moves leaves
    by up to 24 m and changes heron roosts.
  - The cloud's normals: misattributed, they were the bandage's.
  - The wind readback at sea: not reproduced (0.14–0.41 ms, like other rooms); the old sample was contention.
- **Not exact, not taken:** creatures reading the baked height copy (0.02–0.06 ms, moves them by centimetres); a leaf
  catch-up for the village.
- **Left for the stairs owner (phase 3):** 53 of the stairs group's 56 nodes never move and can be fixed; the drowned
  village's 7 and the sky likewise.
- **Instrument traps:**
  - Seeded `FRAME` comparisons need the same number of `Math.random` draws during construction; three's UUIDs draw
    from it, so creating more or fewer three objects at boot shifts everything. Read the `randoms` drift field first.
  - A dev server whose origin has served other tools (`cygnet-gates` on the stage) can differ from a fresh one of the
    same commit. Before trusting a red, compare the baseline against itself on a second fresh port.
  - `cygnet-gates` fails intermittently on 36c52e1 itself (a turn spike near 0.10 against limits 0.06–0.08, in idle,
    gather and unstow): treat a single failure as noise unless it repeats more on the changed build.
  - `terrain-heights-check` fails on 36c52e1 (`worst 0.167 at [194,-1750]`), unrelated to this item.

## Phase 2: program variants and the deck-free programs

- **Owns:** `src/gl/variants.ts` (new), `src/world/atmosphere.ts`, `src/world/water.ts`, `src/world/terrain.ts`,
  `src/world/grass.ts`, `src/world/sky.ts`, the precompile and per-frame selection in `src/main.ts`, `docs/engine.md`
  (a "Program variants" section).
- **Contract:** the deck's GLSL in `ATMO_GLSL` and its call sites sit under `#ifdef CLOUD_DECK`. Sea, terrain, grass
  and sky materials (every program each has today, including the grass's no-discard program and the mirror's terrain)
  have a deck and a deck-free variant; other materials keep the deck. The final-view preparation selects the deck
  variant when `uCloudDeck.w > 0` and the deck-free one otherwise, before the doorway view, the reflection and the
  scene are drawn, so all three use the same choice. All variants are compiled and warmed behind the veil.
- **Gate:**
  - Frames within 1/255 of the pre-change commit at `island`, `sea`, `wood`, `sleeping`, `jetty`, `meadow:walk` (static
    and a 16-step camera path) and at every stairs fixture; single-pixel glint specks on the sea are accepted if a
    jetty still shows no visible difference (visual model).
  - Saving: `frame-profile` pairs against the pre-change commit at `island`, `sea`, `meadow:walk`, `wood`; the profile
    found 7 to 9% there.
  - No hitch where the programs swap: `tools/perf.mjs frames` over the crossing from the Birches into the stairs and
    from the stairs' fog down into the drowned village, against the pre-change commit.
  - The veil: `node tools/boot-profile.mjs` and `node tools/start-check.mjs` before and after; the worst gap between
    painted veil frames must not grow. Record the added loading time in `docs/backlog/boot-veil/design.md`.
  - `tools/shader-check.mjs`, `tools/stairs-check.mjs`, `tools/context-loss-check.mjs`.
- **Done:** [x] merged to `main` at 8929eec (2026-10-02). Registered: the sea, terrain (the mirror's terrain is the
  same material), the three grass blade materials and the sky; selection is the first line of `prepareFrame`.
  - Frames against 9557d73: 0 at `island`, `wood` and every stairs fixture; at most 1/255 at `sea` (321 channels),
    `jetty` (739), `meadow:walk` (73), `sleeping` (4); a 16-step camera path at island, sea and jetty at most 1/255
    at every step. No glint specks.
  - Saving (pairs, two passes): island 7.3%, sea 5.4–6.1%, meadow:walk 7.3–9.0%, wood 6.2–6.6%.
  - No hitch at either swap (crossing into the stairs, fog into the village): max 16.8 ms on both builds;
    `renderer.info.programs` constant after Begin. `tools/perf.mjs` cannot play those transitions; a scratch
    rAF-interval run in shot mode did.
  - Veil: about +80 ms to ready; worst gap unchanged within noise (recorded in `docs/backlog/boot-veil/design.md`).
  - Five programs added (219 → 224 at the island).

## Phase 3: stairs work that cannot be seen

- **Owns:** `src/world/stairs-cloud.ts`, `src/world/stairs-haze.ts`, and the stairs' visibility in `src/main.ts` /
  `src/story/stairs*.ts`. Starts after phase 2 has merged (both touch the sea, terrain and grass draw).
- **Do:** fix the stairs group's static nodes (53 of 56 never move; `fixInPlace`, `tools/fixed-matrices-check.mjs`). Find what is drawn and never seen on the stairs' camera paths: the cloud top's grid outside the view, the
  towers when off screen, and in the white the sea, terrain and grass beyond the pocket. Skip each only behind a gate
  that holds on every frame of the chapter, not only at the fixtures.
- **Contract:** frames within 1/255 along the whole chapter, sampled every tenth frame against the pre-change commit,
  including the transitions in and out of the white. `stairs-check` plays by wall clock, so two runs never show the
  same frame: extend `stairsFixtureOnFrames` (`tools/lib/stairs-fixture.mjs`, one pointer move per frame) to capture
  along the way on both builds under `frame-profile`'s `FRAME`/`COMPARE_BASE` machinery, and first prove the build
  reads 0 against itself along that path. Anything that cannot be
  gated exactly is dropped, not approximated.
- **Gate:** the frame difference above; saving at `stairs:cloud`, `stairs:top`, `stairs:sail`; `tools/perf.mjs frames`
  through the chapter shows no new hitch.
- **Done:** [x] merged to `main` at 890359a (2026-10-02). Along the whole chapter (`ALONG=10 … stairs:drowned`, 1508
  samples from the climb to 300 frames into the village) 0 changed against 0be9dc5; `stairs:waiting` 0; island, sea
  and drowned 0.
  - Kept: 30 more stairs nodes, the drowned village's meshes, the lighthouse and the sky fixed in place (367 of 524).
    The cloud top and underside skip grid points whose ±2-cell box (heights bounded by `uRise` and the underside's
    worked bounds) lies past one of five view planes (`cloud-grid.ts` `gridUnseen`): sail 2.8–3.7%, cloud about 3.7%,
    waiting about 3.6%, top none measurable (its cost is rasterising small visible triangles).
  - Testing the sixth (far) plane, or writing the box another way, recompiled the visible points an ulp differently
    (cloud crests up to 113/255): any edit to the cloud top's or underside's vertex stage re-runs `ALONG` against
    the commit before.
  - Dropped: the towers (already culled; a box test drops 12-triangle boxes with no pixels), the haze at the top (its
    density cannot be proven zero), and the sea, terrain and grass in the white (the ordinary haze is never zero, so
    the deck never covers fully: up to 47/255).
  - `frame-profile` `ALONG=<n>` compares every nth frame of two builds playing the stairs on frames; the fixture acts
    once per game frame and adds `stairs:drowned` (frame 15163).
- **Look change found, for phase 7's list:** hiding the sea (and terrain) above the cloud during the top and the sail:
  top −10.8 to −18.7% (1.4 to 2.4 ms), sail −13.8% (2.0 ms), at most 3/255 on a few thousand channels (the sea faintly
  through the deck's frayed edge); nothing proves it hidden, so it needs a check along the whole sail.

## Phase 3b: exact leads across the frame

Built in two parcels: **3b-i** beside phase 2 (the wind step's fusion, the sky mirror's pass gate, the bloom gate,
the visibility of the starlings, petals, sleeping island and stairs steps, draw merging for the mirror and little
boats), and **3b-ii** after phase 2 merges (the sea shader's internals and `LAND_SKIP`).

- **Owns:** `src/world/water.ts` fragment shader internals (after phase 2 has merged; phase 5 follows),
  `src/wind/` pass fusion, the sky mirror's pass gate, `src/post/post.ts` (a bloom gate, only if provable), visibility
  of the starlings, petals, sleeping island and stairs steps, draw merging for the mirror and the little boats.
  The sea's `LAND_SKIP` variant (through `src/gl/variants.ts`), selected ashore, measured at `summit`, `meadow:walk`,
  `wood`, `birches` and checked along a shoreline camera path (the return sits before `fwidth` and the footprint).
- **Do:** design section 1, "GPU leads". Measure each first with an ablation at the fixtures where it should show
  (`sea`, `drowned`, `lines` for the sea shader; `sleeping`, `summit` for the wind; `mirror`; `wood`, `island` for
  bloom); build only those that save more than noise (about 1% of their frame) and stay exact.
- **Contract:** frames within 1/255 statically and along a camera path; the wind field bit for bit
  (`tools/wind-rate-check.mjs`, `tools/wind-clock-check.mjs` and a texel comparison of the field after 600 ticks of a
  scripted stroke); `tools/render-cost-check.mjs` extended to the new skips. Report what was dropped and why.
- **Gate:** the above, plus `tools/sea-check.mjs`, `tools/sky-mirror-check.mjs`, `tools/little-boats-check.mjs`.
- **Done:** [x] 3b-ii merged to `main` at 5340862 (2026-10-02); 3b-i at 5a987d9 (2026-10-02).
- **3b-i as built:** the wind step is 17 passes a tick, not 21 (curl folded into vorticity, the pressure carry-over
  into the first pressure pass, advection with lean and sway, and the window shift, each one pass with several
  outputs): `sleeping` 0.40 → 0.32 ms, `summit` 0.46 → 0.41 ms, +512 KiB. Bit for bit on Chrome/Metal
  (`tools/wind-exact-check.mjs`, 600 and 2,400 ticks at both resolutions, and frames 0 at ten fixtures, re-run after
  merging onto 5340862). The fused shaders reproduce the old passes' compiled arithmetic: half-float targets store
  toward zero, so `storeHalf`/`nearHalf` and sums pinned through `uZero` (`pin`). `wind.lifeTexture` keeps the life
  pass reading what it read before (the field before advection after a tick with 9–16 sources).
- **3b-i dropped:**
  - The sky mirror's pass: every sea pixel samples it while the mirror is in the rooms, so it is never unseen.
  - The bloom gate: nothing can prove in advance that no pixel crosses 1.1.
  - Starlings: exact, but 0.007 ms. Petals: GPU-placed, 0.07 ms. The sleeping island from the open sea: 0.20 ms with
    no provable bound, for the crossing's first 30–40 s.
  - The stairs' steps in the white: visible there.
  - Merging the mirror's pieces: not exact; one merged draw loses three's front-to-back order at depth ties.
  - Merging the little boats: not exact; matrix rounding differs and the bath reads local height.
- **Look changes found, for phase 7's list:** the sky mirror's reflection at the ordinary sea's size and cadence until
  near the flat (1.0 ms, 10.8% of the 2.5-minute crossing to the mirror, up to 27/255 on sea pixels; ablation
  `mirror-ordinary`); the mirror merge (0.37 ms, 4%; single pixels up to 7/255 where posts pierce planks;
  `mirror-merge`). Also not exact: the life pass always reading the finished wind (changes life only in ticks with
  9–16 sources).
- `frame-profile` and `memory-census` take `LEVEL=ultra|high|medium|low|last` for a level's world settings.
- **3b-ii as built:**
  - `LAND_SKIP` (a sea axis; the sea has 4 programs): the sea returns before the ripple reads where the baked ground
    is a metre above the water at the corners of the 3×3 pixel block and no waterline is within it, so every pixel
    of the quad is under land. Selected by `water.landSkip(camera)`: an island's height patch overlaps the window and
    the camera is above the ground there (a camera inside a hill showed black). Not "child ashore" (lead's call,
    2026-10-02): the window rule also wins in the crossings and at the jetty, about 8 minutes against the 0.8%
    (0.07 ms) it costs on the open sea and 4 minutes of sea and drowned village; `!child.riding` is the one-line
    alternative. Saving (frame pairs): wood 3.7–5.2%, jetty 2.2–3.1%, sleeping 2.2–3.2%, lines 1.9–2.6%, island
    1.2–1.6%, washing about 1%; Meadow, birches and boats in noise (the Meadow's no-discard grass already lets the
    GPU cull the sea); summit 0 (its sea under land is beyond the window).
  - Weed term only for bed depths 0.9 to 4 m: drowned 3.3%.
  - Frames 0 against 2ba17d1 at ten fixtures, boat orbits and shoreline paths (Sleeping's at most 1/255) and through
    the washing doorway.
  - Dropped: the caustics skip (under 1% once `LAND_SKIP` is in) and the three folds (`waterWindAt`, `backlit`,
    `fogOf`'s `skyRadiance`: the compiler already shares them).
  - Judge sea items by frame pairs: the sea pass alone overstates savings where discard-free grass covers land.
  - **For phase 3 and anything that hides terrain:** `LAND_SKIP` relies on the terrain drawing in the same pass as
    the sea, on terrain tiles following the camera, and on the camera above the ground. Hiding the terrain where the
    sea draws in the same view shows black under land. Tools that move the camera must call `terrain.update`.
  - `frame-profile` now steps both builds' cameras along a path under `COMPARE_BASE` (`PATH_JS`/`PATH_STEPS`); camera paths (`shore.js`, `orbit.js`, `door.js`) and a veil-gap script (`veil.mjs`) are in `/private/tmp/updraft-pf-p3bii-scripts/`.
  - Not built, for Jeremy if wanted: the sea under land beyond the window (summit up to 5.2%, 0.39 ms), which needs
    the distant atlas and a waterline guarantee that does not exist there.

## Phase 4: four levels and Auto between them (logic)

- **Owns:** `src/gl/quality.ts`, `src/gl/quality-preference.ts`, `src/gl/frame-pacer.ts` (only if needed),
  `applyWorldQuality` and the `Quality` construction in `src/main.ts`, `src/analytics/telemetry.ts`,
  `tools/quality-check.mjs`, `tools/quality-browser-check.mjs`, `tools/quality-setting-check.mjs`,
  `tools/quality-budget-profile.mjs`, `tools/grass-quality-check.mjs`, `tools/frame-pacer-check.mjs`,
  `docs/engine.md` "Quality governor", `docs/contracts/analytics.md`.
- **Contract:** the table in design section 3, columns render scale to terrain split only (the effects rows are
  phase 5). `QualityMode` is `auto | ultra | high | medium | low`. The levels are exactly Ultra, High, Medium, Low and
  the last step; Auto's ladder is those five and nothing else. Auto opens at Ultra, or at High where the touch ceiling
  (1.25×) applies. Over the 2.4 million pixel budget Auto lowers the render scale of its current level to fit, never
  below 0.5×. `frameRate` comes from the level, so Auto at Low presents at 30 fps and is judged against 33.3 ms there
  (the existing `capped` scaling), including the climb probe. A
  stored `high` under `updraft.quality.v1` reads as `ultra`; choices are saved under `updraft.quality.v2`. `?ratio=`
  and `?msaa=` lock the governor at exact values with Ultra's world settings; `shot` hides the selector and leaves
  Auto running (the quality and power browser checks drive the governor in shot mode). `controls.ts` keeps
  compiling against the new type with a minimal change (phase 6 owns its look).
- **Arithmetic:** pixels Ultra/High 1.44×, High/Medium 1.56×, Medium/Low 1.38× (about 1.55× with phase 5's effects);
  a 10 ms fence at the lower level is at most 15.6 ms one level up, inside 16.7 ms.
- **Gate:** the owned checks updated and passing; `quality-budget-profile` shows Auto stepping Ultra → High → Medium →
  Low → last under a throttled GPU and climbing back without oscillating; `tools/analytics-check.mjs`.
- **Done:** [x] merged to `main` at 1ce61c4 (2026-09-30).
- **As built** (`src/gl/quality.ts`):
  - `QualityLevel { name, ratio, samples, frameRate }`; `WORLD_QUALITY[name]` holds grass density and reach, terrain
    split, `mirrorEvery` (the sky mirror's cadence) and mirror scale. `WORLD_QUALITY.ultra` and `.high` are the same
    object, and the ladder relies on that. `applyWorldQuality(level, immediate)` in `main.ts` keys on a local `name`
    (`lite` folds to `low`); treat `last` as Low for effects. `controls.setQualityLevel(name)` replaces
    `setQualityDetail`. Telemetry's dimension is `level` (`chapter.level`, `level.fps`).
  - A level that would render exactly like the one above it (High at DPR ≤ 1.25, or where the budget fits both to one
    scale) is left out of Auto's ladder.
  - Auto steps down one level at a time (Jeremy, 2026-10-01). A failed climb returns exactly one level. The climb probe's
    deadline follows the level being climbed into (10 ms into a 60 fps level, 20 ms into a 30 fps one). Device-cap
    detection runs only at 60 fps levels. Reviews need 30 timed frames at 60 fps and 15 at 30 fps.
  - `tools/quality-budget-profile.mjs` now runs the real game under a GPU throttle and asserts descent, hold, climb
    and the 30/60 boundary (about 3.7 minutes, dev server only, holds the browser lock).
  - Tools that assert no page errors use `tools/lib/vite-client-stub.mjs` (`withoutHotReload(page)`).
- **For later phases:** locked and shot captures now use Ultra's world settings (grass reach 115%, was 100%), so a
  frame comparison must have both sides on the same side of 1ce61c4. `tools/quality-menu-check.mjs` and
  `tools/veil-controls-check.mjs` fail until phase 6 updates them (`updraft.quality.v2`, Ultra first in the menu,
  `setQualityLevel`). `index.html` already has a plain Ultra entry.

## Phase 5: effects by level (visual)

- **Owns:** `src/post/post.ts` (bloom full, half, off), `src/world/water.ts` (`HULL_COLLAR`, `LANTERN_GLINT`,
  `SEABED_DETAIL` variants; the ordinary reflection off), `src/world/stairs-puffs.ts`, `src/world/stairs-haze.ts`
  (fewer wisps and haze steps), the effects in `applyWorldQuality`. After phases 2, 3, 3b and 4.
- Built in two parcels: **5a** beside phase 3 (bloom, the sea's three effect switches, the ordinary reflection, the
  50% grass), **5b** after phase 3 merges (the stairs' wisps and haze steps, which share files with phase 3).
- **Contract:** the effects rows of the table in design section 3. Ultra and High render exactly as before this phase
  (frames within 1/255). Bloom off skips its passes and releases its targets; half resolution halves the chain's
  first target. The sky mirror's reflection is never turned off. Turning an effect off at a level is a variant or a
  skipped pass, never a uniform branch. Level changes mid-play swap without a hitch or a pop the visual model can see
  (bloom may ease over the grass's one second).
- **Visual brief (allowed visual model):** choose the "fewer" wisp and haze-step counts and what the seabed detail
  drops so that Medium and Low still read as the same place; produce before/after stills per level at the boat at sea
  by day and with the lantern lit, the jetty at dusk, the shallows off the first island, the mirror, the Wood's
  embers (bloom), the stairs climb and in the white. Open them in Preview for Jeremy.
- **Gate:** Ultra/High frame difference; saving per effect at Medium and Low settings (`DETAIL`-style profile of each
  level, `LEVEL=<name>`); `tools/perf.mjs frames` across each level change; `tools/sky-mirror-check.mjs`, `tools/sea-check.mjs`,
  `tools/stairs-check.mjs`; the veil gap as in phase 2. **Jeremy's verdict on the stills before merging.**
- **Done:** 5a [x] merged to `main` at 7933da5 (2026-10-02, Jeremy: "Merge"); 5b [x] at 149cdd1 (2026-10-03, Jeremy: "Merge"); 5c (the sun glow) [x] at e959c48 (2026-10-03, Jeremy: "Merge").
- **5a as built:** `WORLD_QUALITY` gains `bloom` (`full|half|off`) and `sea` (`all|noCollar|plain`); Ultra and High
  stay one shared object (`sameLevel` relies on it). `applyWorldQuality` sets `water.effects` and
  `post.setBloom(level, immediate)`.
  - The sea's effects are one three-way axis `SEA_EFFECTS` (`HULL_COLLAR`, `LANTERN_GLINT`, `SEABED_DETAIL`,
    `SEA_REFLECTION`): the sea has 12 programs, boot 11 variant steps (time to ready about +0.3 s; the worst veil gap
    unchanged). A new sea switch joins this axis rather than adding one.
  - Low turns off the ordinary sea's reflection pass and compiles out its sample (the sky mirror keeps its own).
  - Seabed detail off keeps the bed's averages (grain and ripple factors as constants, weed mean 0.21 as a tint in its
    band, caustics mean 0.11), so the shallows keep their colour; only the caustic web goes.
  - Bloom half resizes the chain to half; off skips the passes and, once faded (strength eases over 1 s), releases
    the bright and blur targets (−7.2 MiB at Low). Boot draws bloom once at any level so its programs exist.
  - Costs (drained, isolated): collar 0.08–0.19 ms, glint 0.03–0.09 ms, seabed 0.20–0.26 ms (18–23% of the sea pass),
    ordinary reflection 0.31–0.84 ms, bloom off 0.29–0.31 ms (about 6% of a Low frame); half bloom saves little at
    Medium's scale on the Mac (per-pass overhead). Whole-frame pairs were in the noise while peers ran.
  - Ultra 0 changed at twelve fixtures; High 0 at `sea`.
  - Level changes: two of four runs on the branch showed one 50–83 ms frame, not reproduced switching bloom or the sea
    alone; re-check on a quiet machine in phase 8.
  - Not built, and stays so (Jeremy, 2026-10-02, design rulings): the last step's 50% grass from the sparser table. The sparser level holds 25% (the lowest-ranked blade
    of each 2×2 block); the other blades shown at 50% vary per block, so no fixed slot grid holds them.
  - `frame-profile` levers `bloom-full|half|off`, `sea-collar|glint|seabed|reflection`; `sea` is the lantern lit at
    night, `'sea&dusk=0'` by day; the `wood` fixture has no lit ember (use `play.mjs` and `embers.blow`).
- **5b as built:** `stairs.ts` `DETAIL` by level and `CloudStairs.setLevel(name, immediate)`, the last line of
  `applyWorldQuality`. Wisps: Ultra/High 56, Medium 36, Low and last 24, the kept rags thickened by
  (56/kept)^0.5 (`MAKE_UP`); dropped rags fade over about a second and leave the draw range, all 56 still simulate.
  Haze: a shared `uStride` multiplies the march step, 1 / 1.25 / 1.5 (fewer steps run; 1.75 and up visibly dims the
  band under the steps). Saving at Low: climb 8–15%, cloud 3–4.5%; Medium climb about 4%; elsewhere in the noise.
  Ultra and High 0 changed at every stairs fixture; level changes mid-climb no worse than 16.8 ms. `frame-profile`
  `stairs-full` restores full detail at any `LEVEL`.
- **5c, the sun glow (Jeremy, 2026-10-02):** with bloom off at Low and the last step, the sky draws a soft halo around
  the sun so it is not a hard white disc. Ultra, High and Medium unchanged.
  - As built: the post chain's colour pass adds four soft rings around the sun before tone mapping, strength from 13
    samples of the disc's on-screen brightness over bloom's 1.1 threshold (so clouds, hills, the deck and sails hide
    or wash it as they would bloom; the moon glows too). A `SUN_GLOW` variant on that pass (230 programs), eased by
    `1 - bloomShown`; look numbers `SUN_RADIUS`, `GLOW_SPREAD`, `GLOW_SHARE` beside `BLOOM_STRENGTH`. About 0.01 ms.
    A sun at the frame's edge glows a little less than Ultra's; the sun's reflection on the sea gets none. Its
    warm-up is `post.render(0, true)` in `boot()`, with bloom's.

## Phase 6: the menu (visual)

- **Owns:** `src/controls.ts`, the quality control in `index.html` and its styles, `tools/quality-menu-check.mjs`,
  `tools/veil-controls-check.mjs`. After phase 4; may run beside phase 5.
- **Contract:** the menu offers Auto, Ultra, High, Medium, Low; the indicator and its title show the level in use,
  including the one Auto is on (the last step shows as Low). Keyboard access as today, with `u` for Ultra. Labels
  follow the `user-facing-copy` skill.
- **Gate:** the owned checks; a screenshot of the open menu and of the indicator at each level for Jeremy.
- **Done:** [x] merged to `main` at bb7abab (2026-10-02), Jeremy approved the stills ("Merge as shown"). Four
  ascending bars (Low 1, Medium 2, High 3, Ultra 4 filled); `data-quality` is the level in use
  (`ultra|high|medium|low|pending`, the last step shows as `low`); titles "Graphics quality: High", "Graphics quality:
  Auto (High)"; `u` selects Ultra.

## Phase 7: more effects to switch off (survey, stops for Jeremy)

- **Owns:** `tools/` only; appends its findings to `profile.md`.
- **Do:** at Medium and Low settings, cost the candidates in design section 4 with ablations, weighted by minutes.
  Include the look changes phases 1, 3 and 3b found (phase 3's sea above the cloud; 3b-i's mirror reflection cadence and mirror merge; 3b-ii's sea
  under land beyond the window; 1b's creatures on the baked height copy), at the levels where each would apply.
  For each worth more than about 1% of a Low frame, a visual model makes one before/after still.
- **Deliverable:** a ranked list for Jeremy (effect, level it would leave at, saving, still). His rulings go into
  design section 3's table and a new phase here; nothing is built in this phase.
- **Done:** [ ]

## Phase 8: whole-game verification

- **Do:** re-run the profile's census (per-chapter drained ms, components, CPU, memory) back to back against the
  commit this item started from, at Ultra and at Low; frame-time spikes against the starting commit (`tools/perf.mjs frames` through the stairs, one Auto descent, a Meadow walk and a crossing for window moves and the light bake, `tools/window-hitch.mjs`);
  the release checks in `docs/testing.md`; a visual model looks at one frame per chapter at each level on merged
  `main`.
- **Deliverable:** the before/after tables appended to `profile.md` and a short summary for Jeremy.
- **Jeremy's part:** a playthrough on the iPad (Safari, heat, battery), which nothing on the Mac can stand in for.
- **Done:** [ ]

## Order

0 → 1 → 2 → 3 → 3b, with 4 alongside 1 to 3b (it shares only `applyWorldQuality` in `main.ts` with them) → 5 and 6 → 7 → 8.
At most two build agents at once.
