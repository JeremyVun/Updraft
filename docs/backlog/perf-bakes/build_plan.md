# Build plan: bake or skip static work

The design is in `design.md` in this folder; its item letters (A–H) are used below. Engine background:
`docs/engine.md`.

**Order (after the 2026-09-24 review):** the exact work comes first: A, the veil and mirror-sky skips, and the
corrected two-pass height bake. The distant-height atlas and the surf cache are experiments. They are kept only
if they pass their stronger checks.

**Approved to build (Jeremy, 2026-09-24):** phases 0, 1, 2, 4 and 5, plus 5b (the scarf's look and behaviour,
design G2). Phases 3 and 6 are on hold until he approves them.

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

**Status:** on hold (Jeremy, 2026-09-24). When approved, it starts after phase 1 merges, because it shares
`terrain.ts`, and it adds a before/after video of the Meadow walk and sailing past the window edge for Jeremy.

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

**Status:** not started. Independent; don't run it beside phase 4.

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

**Status:** not started. Starts on phase 5's branch after phase 5's exactness gates pass. Visual work (motion
and look), so an allowed visual model only: Opus.

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

**Status:** on hold (Jeremy, 2026-09-24). When approved, it starts after phases 1–3 merge. Visual implementation, so an allowed visual model only.

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

## Phase 7: close

**Status:** not started. Run the backlog-item close stage:
- Move the durable rules and measured numbers into `docs/engine.md`.
- Update `docs/testing.md` for the new check scripts.
- Delete this folder.
