# Build plan: bake or skip static work

The design is in `design.md` in this folder; its item letters (A–H) are used below. Engine background:
`docs/engine.md`.

## Standing rules for every phase

- **Worktrees:** work in a worktree under `/private/tmp`, forked from current `main`. Before forking, run
  `git log main --since='1 day'` and read the coord notes.
- **Commits:** commit after every step.
- **Browser runs:**
  - Measure from the worktree with its own dev server (`npx vite --port <free port> --strictPort`), after
    checking the listener's cwd.
  - Only one browser gate runs at a time; the tools share `/tmp/updraft-chromium.lock`.
  - Check `ps` for busy processes before timing anything, and record what was running.
- **Agents:**
  - Run at most one or two build agents alongside peer sessions.
  - Nonvisual phases go to Opus subagents.
  - Visual work (the phase 6 look, and the phase 5 motion review if motion changes) goes to an allowed visual
    model: Opus, or Astra with Jeremy's authorisation.
- **Record results:** each phase writes its measured numbers into `design.md` under its item, and marks itself
  done here.

## Phase 0: repair the profiler and re-baseline (item H)

**Status:** not started

**Owns:** `tools/frame-profile.mjs`

**Work:**
1. Remove `shoreFamily` from `groups` and from the `culling-off` root list.
2. Run the default ablation set on Island only, to prove the tool starts and completes. A full re-baseline is
   unnecessary: the 09-24 table in `design.md` is the baseline.

**Seam:** later phases add their own ablation names to this tool.

**Gate:** `node tools/frame-profile.mjs island` exits 0 with no browser errors.

## Phase 1: exact terrain and small skips (items A and D)

**Status:** not started

**Owns:**
- `src/world/terrain.ts` (`FRAG` only)
- `src/world/terrain-fields.ts`
- `src/world/sleeping-weather.ts`
- `src/world/water.ts` (`glassColour` only)
- `src/world/water/surf.ts`
- `src/world/water/shore.ts`
- `tools/frame-profile.mjs` (new ablations)
- a new `tools/fields-border-check.mjs`

**Work:**
1. Write the A3 border-presence sweep before the A3 change. If it fails, stop and report.
2. Implement A1, A2, A3 and D.

**Ablations:** one per skip, each restoring the old path in the page:
- `terrain-skips-off`: shader string replacement.
- `veil-always`.
- `glass-sky-always`.
- `surf-direct`: a ready uniform on the baked surf phase.

**Seams:**
- The shore bake's output keeps R as the signed shore distance; G becomes the surf phase noise (not the
  time term).
- Every consumer of `surfCycle` gets the same value within half-float precision.

**Gate: exactness.** Frame-difference against each ablation in Island, Washing, Meadow walk, Birches, Drowned,
Wood, Sleeping, Sea, Mirror, Boats and Jetty:
- `terrain-skips-off`: max 0, or at most 1/255 with the reason stated.
- the others: max ≤1/255.

**Gate: saving.** At least four paired rounds per chapter for `terrain-skips-off`, reported with median and range.

**Gate: build.** `npm run typecheck` and `npm run build` pass.

## Phase 2: distant-height atlas (item B)

**Status:** not started. Starts after phase 1 merges, because it shares `terrain.ts`.

**Owns:**
- a new `src/world/terrain-heights.ts`
- `src/world/terrain.ts` (`VERT` and wiring)
- `src/world/ground.ts` (`GROUND_FRAG` `heightAt` only)
- the bake wiring in `src/main.ts`
- `tools/frame-profile.mjs` (ablation `heights-direct`)
- a new `tools/terrain-heights-check.mjs`

**Work:**
1. First establish what `worldHeight` returns outside the patches, and whether any pixel can show it. Record the
   finding in `design.md`.
2. Pick the open-sea treatment accordingly.
3. Bake before Begin. Precompile through the bake registry so there's no first-frame compile.

**Seam:**
- `groundHeight(q)` and `heightAt(p)` return window texture, then atlas, then open-sea expression or
  `worldHeight`.
- Callers see heights only; nothing else changes.

**Memory arithmetic:**
- R16F is 2 bytes per texel.
- The colour atlas's 1024×1376 footprint at 1 m texels is 1.41 M texels, about 2.75 MiB.
- At 2 m texels it is about 0.69 MiB.
- Report the chosen size's actual allocation.

**Gate: parity.**
- The check sweeps every patch.
- Max |atlas − worldHeight| ≤ 3 cm at texel centres, with the bilinear error between texels reported.
- No NaN.

**Gate: frames.** Frame-difference against `heights-direct` in all eleven chapters: max ≤ 2/255, and no seam at
the window edge in the Island, Meadow walk, Sea and Mirror views.

**Gate: saving.**
- Paired `heights-direct` rounds per chapter.
- Also the shadow-bake cost while the sun is moving: a dusk fixture (`?dusk=`) timed with `bakeLight` running.

**Gate: boot.** The boot-gap check in `docs/testing.md` stays under its ceiling.

## Phase 3: cheaper window height re-bake (item C)

**Status:** not started. Starts after phase 2, whose atlas it uses at the border.

**Owns:**
- `src/world/ground.ts` (`HEIGHT_FRAG` and the `bake` pass order)
- `tools/frame-profile.mjs` or a new check script

**Seam:**
- The height texture keeps `r` height and `gba` normal.
- `setHeightGrid`, the height readback and the shadow bake read it unchanged.
- It is re-baked in the same frame as the window move.

**Gate: parity.** New against old texture over several window positions:
- heights identical;
- normals within 1e-3.

**Gate: hitches.** Frame gaps at window moves on a travelling fixture, compared back to back in two worktrees:
- a Meadow walk with `tools/perf.mjs frames` and a scripted walk;
- sailing in `?chapter=boats`.

Report the worst gap and p99 at each move.

**Gate: build.** `npm run typecheck` and `npm run build` pass.

## Phase 4: wind-cost anomaly (item F)

**Status:** not started. Independent of phases 1–3; it can run beside one of them.

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

**Gate: wind parity.** A fix must leave the wind field bit-identical, or within 1e-5, over 300 ticks with scripted
splats (compare the read-back velocity texture).

**Gate: `docs/contracts/wind.md`** still holds.

## Phase 5: Birches scarf CPU (item G)

**Status:** not started. Independent; don't run it beside phase 4.

**Owns:**
- `src/world/birch-scarf.ts`
- `src/world/scarf-cloth.ts`
- `src/gl/indexed-normals.ts` (only if needed)

**Work:**
1. Exact changes first: skip writes and normals for unchanged sections, skip resting cloth, remove allocations.
2. Measure.
3. Only then consider changes that alter the motion.

**Gate: CPU.** Median and p90 frame CPU in Birches, using `frame-profile.mjs birches` in a CPU-only run, compared
with 4.4 / 4.6 ms (09-24) and with a back-to-back old worktree.

**Gate: exactness.** For exact changes, the scarf's vertex positions are identical over a scripted 20 s of play.

**Gate: motion.** If motion changes, record before/after video of the scarf in play (`VIDEO=1 node tools/play.mjs`).
An allowed visual model reviews it, and it goes to Jeremy before merge.

## Phase 6: bake the fine grain and noise (item E)

**Status:** not started. Starts after phases 1–3 merge. Visual implementation, so an allowed visual model only.

**Owns:**
- `src/world/terrain.ts` (`FRAG`)
- `src/world/grass.ts` (tint only)
- `src/world/atmosphere.ts` (`frostAt` only)
- `src/world/water.ts` (bed noise only)
- a new tiling noise texture module

**Work:**
1. Measure first. For each candidate term, replace it with a constant in a paired profile, and list the per-chapter
   savings.
2. Implement only the terms with a consistent saving.
3. Textures must be mipmapped and sampled with explicit gradients where they sit in branches.

**Gate: video.** Before/after webm of the moment in play:
- walking through the Wood floor;
- the Sleeping island at dawn frost;
- the Meadow walk;
- a beach at the opening island.

An allowed visual model reviews the videos, then they go to Jeremy. **No merge without Jeremy's verdict.**

**Gate: saving.** Paired rounds per chapter with the new textures against the live noise.

## Phase 7: close

**Status:** not started. Run the backlog-item close stage:
- Move the durable rules and measured numbers into `docs/engine.md`.
- Update `docs/testing.md` for the new check scripts.
- Delete this folder.
