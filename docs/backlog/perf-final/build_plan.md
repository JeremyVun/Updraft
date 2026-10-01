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

- **Variants (phase 2 → 5).** `src/gl/variants.ts` owns the variant sets. A material is registered with the defines
  it supports; `variant(material, defines)` returns the twin sharing its uniform objects; `select(mesh, defines)`
  assigns it. Phase 2 adds `CLOUD_DECK`; phase 5 adds `HULL_COLLAR`, `LANTERN_GLINT`, `SEABED_DETAIL` through the same
  calls. Every registered variant joins the boot precompile and warm render. Nothing compiles after Begin.
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
    `RATIO=0.85 MSAA=2 DETAIL=0`; `POST_PASSES=1`, `SIM_PASSES=1` as needed); never with `FRAME`, never `ROUNDS=1`.
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
- **Done:** [ ]

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
- **Done:** [ ]

## Phase 3: stairs work that cannot be seen

- **Owns:** `src/world/stairs-cloud.ts`, `src/world/stairs-haze.ts`, and the stairs' visibility in `src/main.ts` /
  `src/story/stairs*.ts`. Starts after phase 2 has merged (both touch the sea, terrain and grass draw).
- **Do:** find what is drawn and never seen on the stairs' camera paths: the cloud top's grid outside the view, the
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
- **Done:** [ ]

## Phase 3b: exact leads across the frame

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
- **Done:** [ ]

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
- **Also (nonvisual):** the last step's 50% grass submits the same blades as 100% and thins them in the shader, so it
  saves no vertex work; draw it from the sparser level the way sparse density already starts tiles at the coarsest
  level that holds every blade it can show, with frames identical to today's 50% (`src/world/grass.ts`).
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
  level); `tools/perf.mjs frames` across each level change; `tools/sky-mirror-check.mjs`, `tools/sea-check.mjs`,
  `tools/stairs-check.mjs`; the veil gap as in phase 2. **Jeremy's verdict on the stills before merging.**
- **Done:** [ ]

## Phase 6: the menu (visual)

- **Owns:** `src/controls.ts`, the quality control in `index.html` and its styles, `tools/quality-menu-check.mjs`,
  `tools/veil-controls-check.mjs`. After phase 4; may run beside phase 5.
- **Contract:** the menu offers Auto, Ultra, High, Medium, Low; the indicator and its title show the level in use,
  including the one Auto is on (the last step shows as Low). Keyboard access as today, with `u` for Ultra. Labels
  follow the `user-facing-copy` skill.
- **Gate:** the owned checks; a screenshot of the open menu and of the indicator at each level for Jeremy.
- **Done:** [ ]

## Phase 7: more effects to switch off (survey, stops for Jeremy)

- **Owns:** `tools/` only; appends its findings to `profile.md`.
- **Do:** at Medium and Low settings, cost the candidates in design section 4 with ablations, weighted by minutes.
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
