# Build plan: bake or skip static work

The design is in `design.md` in this folder; its item letters (A–H) are used below. Engine background:
`docs/engine.md`.

**Order (after the 2026-09-24 review):** the exact work comes first: A, the veil and mirror-sky skips, and the
corrected two-pass height bake. The distant-height atlas and the surf cache are experiments. They are kept only
if they pass their stronger checks.

**Approved to build (Jeremy, 2026-09-24):**
- phases 0, 1, 2, 4 and 5;
- phase 5b, the scarf's look and behaviour (design G2);
- phase 3, approved later the same day, with regression evidence for his judgement.

Phase 6 is on hold until he approves it.

**Running order:** phase 0 and phase 2 run together first. Phase 1 starts on phase 0's branch once it lands.
Phase 4 follows, on phase 0's branch. Then phase 5, then 5b on phase 5's branch.

## Standing rules for every phase

- **Worktrees:** work in a worktree under `/private/tmp`, forked from current `main`. Before forking, run
  `git log main --since='1 day'` and read the coord notes.
- **Commits:** commit after every step.
- **Browser runs:**
  - Measure from the worktree with its own dev server (`npx vite --port <free port> --strictPort`), after
    checking the listener's cwd.
  - Only one browser gate runs at a time; the tools share `/tmp/updraft-chromium.lock`.
  - Check `ps` for busy processes before timing anything, and record what was running.
- **Frozen comparisons re-bake shadows:** the profiler's frozen `draw()` does not re-bake. Any variant that
  changes a height source must re-run the window bake and `bakeLight` on each side of every pair (design, "How
  every phase is judged").
- **Agents:**
  - Run at most one or two build agents alongside peer sessions.
  - Nonvisual phases go to Opus subagents.
  - Visual work (phase 6, and the phase 5 motion review if motion changes) goes to an allowed visual model: Opus,
    or Astra with Jeremy's authorisation.
- **Record results:** each phase writes its measured numbers into `design.md` under its item, and marks itself
  done here.

## Phase 0: repair the profiler (item H)

**Status:** done 2026-09-24 (6b3deee). The gate passed: island exits 0 with no errors. Height-source ablations are
declared in `__audit.heightSources` and re-bake both sides automatically. Each row reports `baselines` and flags
`straddle` (max/min pair baseline > 1.4).

**Owns:** `tools/frame-profile.mjs`

**Work:**
1. Remove `shoreFamily` from `groups` and from the `culling-off` root list.
2. After each synthetic `wind.step()` in `draw()`, rebind `uWindTex`, `uBendTex` and `uSwayTex` as the real loop
   does (design H).
3. Add an option for ablations to re-run everything a window move re-runs before capturing each side:
   `bakes.bake`, `bakes.bakeLight`, `water.bakeShore(WINDOW.size)`, and a grass-table rebake
   (`grass.tablesDirty = true`, then `grass.bake`). Keep it out of timed draws. Later phases use it.
4. Record every pair's baseline in the report, and flag an ablation whose baselines straddle the two GPU states
   (design, profile caveats).

**Gate:** `node tools/frame-profile.mjs island` exits 0 with no browser errors. The 09-24 table in `design.md` is
the baseline; no full re-baseline is needed.

## Phase 1: exact terrain, veil and mirror-sky skips (items A and D)

**Status:** done 2026-09-24 (merged 8a1027e). Exact in all 11 chapters, with two recorded exceptions:
- A1 differs by 1 float ulp (≤1/255 in ≤4 channels) in Birches and on the Jetty.
- D2 removes specks that the **old** mirror code drew.

Results are in design A and D.

**Owns:**
- `src/world/terrain.ts` (`FRAG` only)
- `src/world/terrain-fields.ts`
- `src/world/sleeping-weather.ts`
- `src/world/water.ts` (`glassColour` only)
- `tools/frame-profile.mjs` (new ablations)
- a new `tools/fields-border-check.mjs`

**Work:**
1. Write the A3 border-presence sweep before the A3 change. If it fails, stop and report.
2. Implement A1, A2, A3, the sleeping-veil hide and the `glassColour` branch.

**Ablations:** each restores the old path in the page:
- `terrain-skips-off`: shader string replacement.
- `veil-always`.
- `glass-sky-always`.

**Gate: exactness.** Frame-difference against each ablation in Island, Washing, Meadow walk, Birches, Drowned,
Wood, Sleeping, Sea, Mirror, Boats and Jetty:
- `terrain-skips-off`: max 0, or at most 1/255 with the reason stated.
- the others: max ≤1/255.

**Gate: saving.** At least four paired rounds per chapter for `terrain-skips-off`, reported with median and range.

**Gate: build.** `npm run typecheck` and `npm run build` pass.

## Phase 2: two-pass window height bake (item C)

**Status:** done 2026-09-24 (merged d2fea04). Bit-identical heights and normals over 20 windows (5.24 M texels),
including real walk moves and a device without linear float filtering. `tools/height-bake-check.mjs` proves this,
and its `MUTATE=` options show it fails when the bake is broken. The frame-gap gate can't tell the builds apart
on this Mac. `tools/window-hitch.mjs bench` is the discriminating measure (see design C).

**Owns:**
- `src/world/ground.ts` (`HEIGHT_FRAG`, a new normals pass, the `bake` pass order, a new (512+2)² R32F
  intermediate target)
- a new check script

**Seam:**
- The height texture keeps `r` height and `gba` normal, `FloatType`.
- `setHeightGrid`, the height readback and the shadow bake read it unchanged.
- It is re-baked in the same frame as the window move.
- Border neighbours come from the calculated one-texel margin, never from an atlas.

**Gate: parity.** New against old texture at several window positions, including positions after moves:
- heights identical;
- normals within 1e-5, beyond sample-position rounding.

Record the maximum.

**Gate: hitches.** Frame gaps at window moves on a travelling fixture, compared back to back in two worktrees:
- a Meadow walk with `tools/perf.mjs frames` and a scripted walk;
- sailing in `?chapter=boats`.

Report the worst gap and p99 at each move.

**Gate: build.** `npm run typecheck` and `npm run build` pass.

## Phase 3: distant-height atlas (item B, experiment)

**Status:** done 2026-09-24 (merged 2ec20d2). Jeremy approved the far-skyline edge-pixel change after seeing
the evidence (design B, Result).
Jeremy judges the regression from difference maps, worst-region crops and before/after video. **No merge without
his verdict.**

**Owns:**
- a new `src/world/terrain-heights.ts`
- `src/world/terrain.ts` (`VERT` and wiring)
- `src/world/ground.ts` (`GROUND_FRAG` `heightAt` only)
- the bake wiring in `src/main.ts`
- `tools/frame-profile.mjs` (ablation `heights-direct`, with shadow re-bakes on both sides)
- a new `tools/terrain-heights-check.mjs`

**Work:**
1. First establish what `worldHeight` returns outside the patches, and whether any pixel can show it. Record the
   finding in `design.md`.
2. Measure the interpolation error per patch at 1 m and 2 m texels, before any shader work. If the fallbacks
   needed to meet the bounds would eat most of the saving, stop and report. Dropping B is an acceptable outcome.
3. Bake before Begin. Precompile through the bake registry so there's no first-frame compile.

**Seam:**
- `groundHeight(q)` and `heightAt(p)` return window texture, then atlas (or the direct calculation where the
  atlas is flagged), then open-sea expression or `worldHeight`.
- The window height bake (phase 2) never reads the atlas.

**Memory arithmetic:**
- R16F is 2 bytes per texel.
- The colour atlas's 1024×1376 footprint at 1 m texels is 1.41 M texels, about 2.75 MiB.
- At 2 m texels it is about 0.69 MiB.
- A second mask channel doubles the chosen size.
- Report the actual allocation.

**Gate: accuracy (design B).** At sub-texel points in every patch:
- height error ≤ 5 cm;
- normal error ≤ 0.01 per component.

Report the maximum and p99 per patch.

**Gate: frames.**
- Frozen frame-difference against `heights-direct`, with shadows re-baked on both sides, in all eleven chapters:
  max ≤ 2/255.
- Moving-camera comparisons (Meadow walk, sailing, a pan across the window edge): no seam and no swimming,
  judged from frame differences.

**Gate: saving.**
- Paired `heights-direct` rounds per chapter.
- The shadow-bake cost with the sun moving through a sunset arc between draws. A fixed `?dusk=` does not move it.

**Gate: boot.** The boot-gap check in `docs/testing.md` stays under its ceiling.

## Phase 4: wind-cost anomaly (item F)

**Status:** done 2026-09-24 (merged 92990f8). The saving was an artefact; no change to `src/wind`. See design F.

**Owns:**
- `src/wind/*` (only if a fix is needed)
- `tools/frame-profile.mjs` (only the wind ablation)

**Work:**
1. Reproduce the 09-24 wind saving in Washing, Wood and Sleeping.
2. Count the substeps `clock.advance` actually runs inside the ablation's `draw`.
3. Time `wind.step` alone with fences.
4. Test whether the cost follows render-target switches or same-frame reads of the written textures.

**Deliverable:** the explanation in `design.md` item F, with evidence. If the cost is real, a fix. If it's an
artefact, a corrected ablation.

**Gate: wind parity.** Over 300 ticks with scripted splats, a fix must leave the velocity, grass bend and sway
textures bit-identical, or within 1e-5.

**Gate: `docs/contracts/wind.md`** still holds.

## Phase 5: Birches scarf CPU (item G)

**Status:** done 2026-09-24 (merged 9252bd9). See design G.

**Owns:**
- `src/world/birch-scarf.ts`
- `src/world/scarf-cloth.ts`
- `src/gl/indexed-normals.ts` (only if needed)

**Work:**
1. First remove allocations and redundant work inside `write` without skipping sections.
2. Then skip sections and rest cloth only under the design G definition and wake-up rules.
3. Measure after each step.
4. Only then consider changes that alter the motion.

**Gate: CPU.** Median and p90 frame CPU in Birches, compared with 4.4 / 4.6 ms (09-24) and with a back-to-back old
worktree.

**Gate: exactness.** Positions and normals match the unmodified build over scripted runs of:
- the tied scarf in wind;
- release and the slip;
- the child gathering it;
- a checkpoint restore mid-sequence.

**Gate: motion.** If motion changes, record before/after video of the scarf in play (`VIDEO=1 node tools/play.mjs`).
An allowed visual model reviews it, and it goes to Jeremy before merge.

## Phase 5b: the scarf's look and behaviour (design G2)

**Status:** done 2026-09-25 (merged bc6ecdb, Jeremy approved). Typecheck, build and the geometry check pass on main; the browser scarf-check and the Birches CPU re-measure wait for the census to free the browser.

**Owns:** the same files as phase 5, plus the scarf's shader in `src/world/birch-scarf.ts` and scarf numbers in
`src/tuning.ts`.

**Work:**
1. Record before-video of the scarf in play and diagnose what reads as simulation (design G2). Write the
   diagnosis into `design.md`.
2. Change the motion (and the look if it helps). Put new feel numbers in `src/tuning.ts`.
3. Record after-video at the same moments.

**Gates:** `PHYSICS=1 node tools/scarf-check.mjs` and `node tools/scarf-geometry-check.mjs` pass. The Birches CPU
median is no higher than phase 5's. The videos go to Jeremy; **no merge without his verdict**.

## Phase 6: bake the fine grain and noise (item E, including the surf experiment)

**Status:** done 2026-09-26, merged (Jeremy approved after mid-spread frost screenshots).

**Owns:**
- `src/world/terrain.ts` (`FRAG`)
- `src/world/grass.ts` (tint and `frostAt` use only)
- `src/world/atmosphere.ts` (`frostAt` only)
- `src/world/water.ts` (bed noise only)
- `src/world/water/surf.ts` and `src/world/water/shore.ts` (the surf experiment)
- a new tiling noise texture module

**Work:**
1. Measure first. For each candidate term, replace it with a constant in a paired profile, and list the per-chapter
   savings.
2. Implement only the terms with a consistent saving.
3. Textures must be mipmapped and sampled with explicit gradients where they sit in branches.
4. **Frost and Wood tint:** one fixed world-space sampling level for each, shared by every stage that calls it:
   the grass vertex shader and grass tables included (design E). Compare surviving blades across LOD transitions
   and table rebakes.

**Gate: surf.** The surf cache is kept only if both hold:
- Frame comparisons over complete wave cycles, and across window moves, show no visible change in the foam
  edges.
- It passes the video review.

**Gate: video.** Before/after webm of the moment in play:
- walking through the Wood floor;
- the Sleeping island at dawn frost;
- the Meadow walk;
- a beach at the opening island, which also covers surf.

An allowed visual model reviews the videos, then they go to Jeremy. **No merge without Jeremy's verdict.**

**Gate: saving.** Paired rounds per chapter with the new textures against the live noise.

## Phase R: re-profile `main` after phases 0–5

**Status:** done 2026-09-25 (tooling merged f4fbc1e). The first run was void because a misbehaving process
heavily contended the CPU (Jeremy); it was rerun on a clean machine. Results are in design, "Profile after
phases 0–5". Birches CPU is re-checked when 5b lands.

**Owns:** nothing in `src/`. It may improve `tools/frame-profile.mjs` measurement (for example `MessageChannel`
fence polling) if it shows the change doesn't shift results systematically.

**Deliverable:**
- A new table in design.md, "Profile after phases 0–5", laid out like the 09-24 table.
- Every pair's baseline, with any straddled or contended row repeated.
- A ranked list of the largest remaining costs per chapter.

## Phase M: battery census (round 2, design "Round 2: battery")

**Status:** done 2026-09-25 on `perf-bakes-m`; results in design, "Round 2 profile". On Jeremy's steer the full
playthrough was stopped at Sleeping and the minutes are estimates. Tools added: `tools/audio-cost.mjs`, and
`frame-profile.mjs` gained `RATIO`/`MSAA`/`DRAIN`/`GPU_QUIET`, the look levers, the grass/water/Birches breakdowns
and `POST_PASSES`. Next: Jeremy picks from the ranked list; nothing in `src/` has changed.

**Owns:** nothing in `src/`. New or extended tools under `tools/` (for example new `frame-profile.mjs`
ablations, an audio census). The results go into design.md under "Round 2 profile".

**Work:** the six measurements in design "Round 2: battery", in that order of priority. Pool at least two page
loads per chapter and drop straddled or contended rows, as in phase R.

**Gate:** every number states its fixture, scale, the machine's load and its pair range. No saving is quoted
as a battery percentage without the minutes weighting and the display floor beside it.

## Phase Q: Auto starts at the top and climbs on evidence (design "Auto on capable devices")

**Status:** done 2026-09-25, merged to `main`. Nonvisual (governor logic), Opus. Touch Auto opens at
`{1.25×, detail 2}`. Below the ceiling each frame's fence is polled 10 ms after submission: ≥90% of ≥30 timed frames
on time in a review climbs one rung at once, <25% rules a climb out, and anything between (or untimed) falls back to
the 12 s smooth window. After a failed climb, fence evidence skips only the first 12 s of the doubled wait. The
constructor lost its `startRatio`/`startDetail` arguments (Auto always opens at its ceiling); `timeLastFrame` now
reports null for a late timer. Gates: `quality-check` (opening-level asserts changed, new touch scenarios: down from
the top in 2.5 s and never back into overload; lying timings back off at 6.5/33/108/278 s; back at the ceiling 6.6 s
after a load lifts, 44 s untimed or inconclusive; 30 fps cap recognised and climbed back under), `quality-browser-check`
(opening assert changed from "conservative" to the ceiling), `frame-pacer-check`, `power-browser-check`,
`quality-setting-check`, `quality-menu-check` (constructor call only), typecheck and build all pass. Live Chrome on the
M4 Pro: Medium → Auto reached the ceiling in 4.0–4.1 s, five of five. The evidence is in `docs/engine.md`.

**Owns:** `src/gl/quality.ts`, the `Quality` construction and probing call in `src/main.ts`, `src/gl/readback.ts`
(`timeLastFrame` only, if needed), the quality check tools, and the "Quality governor" section of `docs/engine.md`.

**Work:**
1. Touch Auto opens at its ceiling (`{1.25×, detail 2}` today) with full detail.
2. While Auto is below its ceiling, time frames' GPU completion against a headroom deadline inside one refresh,
   and climb one rung as soon as a short window proves headroom. Keep the 12 s smooth window as the fallback,
   and the doubling after a failed climb. Put the thresholds' reasoning beside them: the next rung costs up to
   about 1.56× the pixels (1× → 1.25×), so the deadline must leave that much room.
3. Keep: 30 fps cap detection, manual presets holding, `?ratio`/`?msaa` locks, hidden-tab and Begin resets, the
   Auto-only fallback rungs, no allocation on detail changes.

**Seam:** `Quality`'s public surface (`level`, `mode`, `frameRate`, `probing`, `gpu`, `frame`, `setMode`,
`resize`, `reset`) may gain a field for the headroom deadline; `main.ts` stays the only caller.

**Gates:**
- `node tools/quality-check.mjs`, `node tools/quality-browser-check.mjs`, `node tools/frame-pacer-check.mjs`,
  `node tools/power-browser-check.mjs`, `node tools/quality-setting-check.mjs` pass, updated only where the new
  opening level or climb is the intended change (say which).
- Scripted scenarios: an overloaded touch device steps down from the top within a few seconds and never climbs
  back into overload in a loop; a device with headroom that was pushed down climbs back within a few seconds
  once load lifts; a 30 fps-capped display is still recognised.
- `npm run typecheck` and `npm run build` pass.

## Round 2 phases (design "Round 2 profile", Jeremy's rulings 2026-09-25)

Each exact phase restores its old path behind an ablation or query flag so frames and audio can be compared in
the same page, and records its measured saving under its E item in design.md.

### Phase X1: CPU and audio cuts (E1, E2, E7) and the one-reverb evidence (L8)

**Status:** done 2026-09-26, merged to `main`. E1 and E2 built and pass their gates; E7 dropped (the
Birches room is on screen for the first 3.7 s of the drift, and its full update already stops 22.5 s in); L8's
`reverb=one` evidence is at `/tmp/updraft-pb-x1-reverb/index.html`, default unchanged, awaiting Jeremy's verdict.
Numbers in design.md, "Round 2 results: phase X1". The E1 gain hold replaces a disconnect: a disconnected looping
source stops advancing in Chrome, so it could not be sample-identical. `meadow-score-browser-check`,
`birches-score-browser-check` and `sea-score-browser-check` fail on the untouched base too.

**Owns:** `src/audio/*` (silent-layer gating, the one-reverb option), the moored boat's hull-contact code (E2),
the Birches room's update gating (E7), `tools/audio-cost.mjs`.

**Work:**
- E1: disconnect a noise layer or pad voice while its gain is exactly 0 and its target is 0; reconnect it before
  its target leaves 0, so nothing audible changes. The reverbs then idle after their tails.
- E2: cache the ground heights under the moored hull's contacts while it lies at the home mooring.
- E7: first prove from frames whether the Birches room is visible anywhere in the Drowned drift. Gate its update
  only where it is not.
- L8: a one-reverb option behind a query flag (`reverb=one`), for evidence only, not the default.

**Gates:**
- E1: offline renders (`OfflineAudioContext`) of scripted sequences, including layers entering and leaving
  silence, are sample-identical or below −100 dBFS difference against the old graph. `tools/audio-cost.mjs`
  shows the saving per chapter. The existing audio checks pass.
- E2: the boat's pose is bit-identical over a scripted run at the mooring, including the walk and departure.
- E7: frames identical through the drift.
- L8: paired WAV renders (two reverbs against one) of the Meadow score, the island arrival swap and the finale,
  with an index page for Jeremy. **No change to the default without Jeremy's verdict.**
- `npm run typecheck`, `npm run build`.

### Phase X2: GPU cuts (E3, E4, E5, E6)

**Status:** done 2026-09-26, merged to `main`. Kept E5 (grass without its discards where nothing
in reach is clipped) and E6 (glints skipped outside the glitter lobe, a per-pixel test: a uniform one can't be exact
because the moon lights the night sea). Dropped E3 (almost no tile is empty at every density; the ceiling is under 1%
of a Birches frame) and E4 (exact, but +1–3% on land against −2–4% afloat). Gates: no changed pixel in any of the
twelve fixtures for E5 and E6, static or along 40-step camera paths; `tools/grass-unclipped-check.mjs` passes;
`npm run typecheck` and `npm run build` pass. Results and numbers: design, "Phase X2 results".

**Owns:** `src/world/grass.ts` (tile submission, the discard-free program), `src/world/water.ts` (the under-land
early return, the glint skip), `tools/frame-profile.mjs` (ablations restoring each old path).

**Gates:**
- Exactness: frame difference against each ablation in all eleven chapters, max ≤1/255 with any exception
  explained. E3 is exact only for tiles where nothing stands at any density; prove the tile test.
- E4 (early return before `fwidth` and the footprint): moving-camera comparisons along shorelines (a Meadow
  walk, sailing past the Birches beach, the jetty) show no changed pixel beyond 1/255.
- E5: the program choice covers every hidden room and the door shore within grass reach; prove it with a sweep.
- Saving: paired rounds per chapter, pooled over two loads, with `GPU_QUIET=1`.
- `npm run typecheck`, `npm run build`.

### Phase X3: one reverb (L8, Jeremy approved 2026-09-26)

**Status:** built and gated 2026-09-26 on branch `perf-bakes-x3` (from 1c69cff), not merged. Live saving: about
75 ms/s of renderer CPU with the pointer moving, 25 ms/s with it still. One reverb is the only graph; `reverb=`, the second convolver, the spare and the arrival
swap are gone, and `tools/reverb-evidence.mjs` is retired. Results in design.md, "Phase X3 results".
- Passed: typecheck, build; offline `audio-check`, `arrival-audio-check`, `audio-interruption-check`,
  `audio-continuity-check`, `audio-direction-check`, `dream-score-check`, `homeward-audio-check`,
  `music-transition-audit`, `flock-audio-check`, `marine-audio-check`, `piano-audio-check` and the boats, birches,
  lines, meadow, opening, sea and sleeping `*-score-check`s; browser `audio-browser-check`,
  `piano-audio-browser-check`, `arrival-audio-browser-check`, `homeward-audio-browser-check`,
  `opening-score-browser-check`.
- Fail the same way on the base 1c69cff (rerun there on its own server), so X3 did not cause them:
  `meadow-score-browser-check` (timeout at line 72, the gesture-chime wait), `birches-score-browser-check` (line 82,
  "Real scarf circles create chimes and puzzle progress") and `sea-score-browser-check` (timeout at line 44, waiting
  for the real swipe's chime). All three stop where a real gesture should make a chime. Before that step, the sea
  check passes its open phase and mute/resume assertions on both builds.
- `audio-cost PAIRS=tworeverb REPS=2`, with and without `STIR=1`: see design.md, "Phase X3 results".
- `audio-silence-check` no longer applies as a gate: it requires matching the two-reverb graph, which X3 changes on
  purpose (largest difference −43 dBFS during an arrival fade, −56 to −69 dBFS elsewhere). Run with `oneReverb` forced
  on the base build's Soundscape, it matches: −113 to −147 dBFS, the same as two renders of one build.

**Owns:** `src/audio/audio.ts` (reverb graph), `src/params.ts` (remove `reverb=`), the audio checks that hold the
background convolver or the spare, `tools/audio-cost.mjs`, `tools/reverb-evidence.mjs` (retire or keep as a
two-reverb comparison only if cheap), `docs/contracts/audio.md`.

**Work:** make the one-reverb graph the only one: the background's wet send is gated and ducked into the shared
reverb, and the second convolver, its spare and the arrival swap are deleted. Update the checks that asserted the
swap to assert the new arrival behaviour instead.

**Gates:** every audio check passes (offline and browser), updated only where the swap was the asserted
behaviour; `tools/audio-cost.mjs` confirms the saving; `npm run typecheck`, `npm run build`.

### Phase S: the sea (design "Round 3: the sea")

**Status:** queued 2026-09-26; starts when an agent slot frees. Visual judgement is needed for S1's motion and S4's
look, so Opus.

**Owns:** `src/world/water.ts` and `src/world/water/reflection.ts`, except the seabed's noise terms (phase 6 owns
them; keep edits to the bed branch's guard so the two merge cleanly), `tools/frame-profile.mjs` (ablations).

**Work and gates:**
- **S1:** ordinary-sea reflection on alternate frames; the sky mirror every frame. Gate: before/after video (true
  60 fps) of sailing with the boat and islands reflected and a turning camera, reviewed for judder or lag between
  the reflection and the sea; the sky mirror journey unchanged frame for frame; paired saving at sea, island,
  Meadow.
- **S2:** bed skip where its contribution is below 1/255. Gate: frame difference ≤1/255 in every chapter with
  sea, plus a moving check along a shelving shore; paired saving.
- **S3:** fold repeated terms only where exact (≤1/255) and measurably cheaper.
- **S4:** coarse fog behind a flag (`seafog=coarse`), paired saving, and frame-locked before/after video at the
  iPad viewport (1376×1032, DPR 2, ratio 1.5, msaa 2) of the open sea toward the horizon, a crossing, and the
  island from the water, under `/tmp/updraft-pb-s-evidence/`. **No default change without Jeremy's verdict.**
- Glints, ripples, surf and wind streaks are not touched.
- `npm run typecheck`, `npm run build`.

### Phase V: look-lever evidence (L1, L2)

**Status:** evidence merged to `main` 2026-09-26; L2 ruled out by the lead (it breaks the sail's see-through cutaway); L1 rejected by Jeremy 2026-09-26 (High stays 1.5×). Evidence and review notes:
`/tmp/updraft-pb-v-evidence/index.html`, summarised in design.md under "Phase V evidence". The tool is
`tools/look-lever-evidence.mjs`. The main finding: L2 turns off every alpha-to-coverage fade, so the sail no longer
shows the child through it. L1 is a mild softening with no designed effect lost. Visual (capture and review), Opus.
No `src/` change: `?ratio=` and `?msaa=` exist.

**Deliverable:** frame-locked before/after video and enlarged crops, at an iPad-like viewport (1376×1032 CSS,
DPR 2), of High (1.5×, MSAA 2) against 1.25× with MSAA 2 (L1) and 1.5× with MSAA 0 (L2). Moments with fine edges
and motion: the Meadow walk through grass, the washing lines, sailing (mast and rigging), the Birches with the
scarf, the summit view. An index page in `/tmp` for Jeremy, and the reviewer's notes on where each lever shows.

## Phase 7: close

**Status:** not started. Run the backlog-item close stage:
- Move the durable rules and measured numbers into `docs/engine.md`.
- Update `docs/testing.md` for the new check scripts.
- Delete this folder.
