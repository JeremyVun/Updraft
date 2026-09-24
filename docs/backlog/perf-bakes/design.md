# Performance: bake or skip static work

## Jeremy's brief (2026-09-24, verbatim)

> I want to look for more performance optimisations. We currently do baking of models for terrain i think? Is there
> anything else we can bake? Could you prepare a profile first?

Scope rulings, 2026-09-24:

- **Exact items first, then the grain.** Build the changes that keep pixels identical (skipped dead work, caches of
  static values) first. After that, bake the fine ground grain and noise into textures, which changes the pattern
  slightly and gets a visual review.
- **Also in scope:** the wind-cost anomaly, the Birches scarf's CPU cost, and repairing `tools/frame-profile.mjs`.
- **Out of scope:** drawing the sky at lower resolution or less often at sea and on the mirror, even though it
  costs 13–15% there. That changes the look, so it's a separate decision.

Review folded in, 2026-09-24. An external review (code reading plus CPU numerical probes, not GPU or iPad runs)
led to these changes:

- **Build first:** A, the veil and mirror-sky skips, and a corrected two-pass height bake.
- **Treat as experiments:** the distant-height atlas (B) and the surf cache, until their stronger checks pass.
- **Specific findings:**
  - The atlas interpolates with about 20 cm of error between texels.
  - Atlas heights at the window border would give a 0.048 error in the normals.
  - The surf phase error is amplified at foam edges.
  - The profiler's frozen draws never re-bake the shadows.
  - "Unchanged" scarf sections were undefined.
  - `frostAt` also runs in vertex shaders.

## Why

The target is the iPad. Jeremy named the Meadow walk as the worst part of the game there (see `docs/engine.md`).
Every chapter is limited by the GPU, not the CPU. The biggest single cost on land is still the detailed terrain
surface shading: 14–34% of completed GPU work, depending on the chapter. Two terrain caches already exist, the
field pattern and the colour atlas. A survey of the shaders found three further kinds of per-frame work whose
inputs never change:

1. Work computed and then thrown away. This needs no bake at all.
2. Pure functions of world position, such as the distant terrain heights, which can be baked once at boot.
3. Fine noise that can move into a small texture.

## Profile (2026-09-24, `main` at 019d927)

**Fixture:** `tools/frame-profile.mjs` in a 1376×1032 view at device scale 2, with `ratio=1.5` and `msaa=2`. It
ran from an isolated worktree with its own server.

**How it measures:** each figure is completed GPU work per frame. A component's saving is the median of four
interleaved pairs, with the component turned off in one half of each pair.

**Caveats:**
- These figures are not hardware timers or fps.
- Savings overlap, so they can't be added up.
- Another app was using about 90% of a CPU core throughout, so absolute times are inflated. Compare only
  within a pair.

Raw data: `/tmp/updraft-perf-0924/profile.json` (in `/tmp`, so it won't survive a reboot; the table below is the record).

| Chapter | CPU median | GPU work | Terrain shading | Grass | Post | Sky | Notable |
|---|---:|---:|---:|---:|---:|---:|---|
| Island | 1.3 ms | 11.7 ms | 3.8 (14%) | 1.4 (12%) | 1.2 | 0.5 | reflection 0.9 |
| Washing | 1.7 | 11.6 | 2.2 (19%) | 2.1 (19%) | 3.0 | 1.0 | wind 5.4 (range −2.9..5.7) |
| Meadow walk | 2.6 | 12.5 | 5.1 (19%) | 3.0 (23%) | 1.4 | ≈0 | |
| Birches | 4.4 | 22.1 | 3.5 (27%) | 2.3 (18%) | 1.4 | 0.5 | birch room 4.8 (18%); scarf CPU ≈2.6 |
| Drowned | 1.8 | 8.8 | 0.8 | — | 0.9 | 0.4 | |
| Wood | 1.5 | 23.2 | 3.7 (34%) | 1.3 | 1.0 | 0.6 | wind 4.7 |
| Sleeping | 1.4 | 26.3 | 4.1 (16%) | 3.2 | 4.1 | 1.2 | wind 6.1 (4.7..7.1) |
| Boats | 1.6 | 11.2 | 5.5 (24%) | 2.5 | 1.1 | 0.7 | |
| Jetty | 1.5 | 12.3 | 2.6 (21%) | 1.8 | 0.9 | 0.4 | |
| Sea | 1.5 | 21.5 | — | 1.1 | 3.5 (16%) | 3.6 (15%) | reflection 3.2 |
| Mirror | 1.5 | 19.8 | 1.4 | 0.8 | 4.6 (22%) | 2.5 (13%) | reflection 3.2 |

The terrain figure comes from the `terrain-flat` test, which keeps the terrain geometry. So the vertex-shader cost
of the distant terrain (item B below) is **not** included in it.

## What changes

### A. Skip terrain fragment work that is thrown away (exact)

All in `src/world/terrain.ts` `FRAG`, plus `src/world/terrain-fields.ts`.

**1. The distant-field colour.** `far` is exactly 0 within `FIELD_FROM` (118 m) of the camera, except where the
door-shore term lifts it. The mirror pass returns before this point. Where `far == 0`, these values never reach
the output:
- `field`, and everything that only feeds it: `colourPattern.w`, the `flattened` bend-texture read, and the
  `waves` fbm (4 octaves).
- `tint`, `hay` and `rush`. `tint` is only used through `field`, `back` (multiplied by `far`) and `homePasture`
  (multiplied by `far`).

Guard these with `if (far > 0.0)`. `terrainFieldAt` must still run everywhere, because `wallLine` reads `fld.x`,
`fld.z` and `fld.w`.

**2. The frost pattern.** `fbm(xz * 0.35)` in the frost line (currently `terrain.ts:191`) runs on every terrain
fragment in every chapter. It only multiplies `frostAt(xz)`, which returns 0 when `uFrost.w <= 0`. Compute
`frostAt` first, and evaluate the fbm only when it is above 0.

**3. Islands outside Meadow's field atlas.** For any point outside the atlas, `terrainFieldAt` falls back to the
full `fieldAt`. That pays for `meadowInset` (a 3-octave `gfbm` through `hf_isleCoast`) and then returns
`vec4(99, 0, 0, 0)` because presence is 0. Return `vec4(99.0, 0.0, 0.0, 0.0)` directly outside the atlas instead.

**Precondition:** presence must be 0 on and beyond the whole atlas border. Prove it with a CPU sweep of
`fieldAt` from `src/world/fields.ts` along the border and outside it, before relying on it. If it fails, widen
the atlas rather than approximate.

**Derivatives inside the new branches:** the atlases sampled there (`uTerrainColour`, `uTerrainFields`,
`uBendTex`) are `LinearFilter` without mipmaps. Implicit derivatives therefore don't pick a level, and the
branches are safe. Any sampler with mipmaps moved inside a branch must use `textureLod`/`textureGrad`, or the
`Footprint` taken at the top of `main`.

### B. Distant-height atlas (experiment, kept only if it passes the accuracy gates below)

**The problem.** `groundHeight()` in the terrain vertex shader falls back to `worldHeight()` outside the 320 m
window. It calls it 3 times per vertex (h, hx, hz), on every distant leaf, in both the main pass and the sea-mirror
pass. `worldHeight` (`heightfield.ts`, `HEIGHTFIELD_GLSL`, no uniforms, so fully static) combines about 11 island
functions without distance early-outs. The shadow bake's `heightAt` (`ground.ts` `GROUND_FRAG`) makes the same
fallback. Its march runs up to 190 m, so texels near the window edge leave the window. It re-runs every third
frame while the sun is moving.

**The atlas.** Bake `worldHeight` once before Begin into a static atlas (`src/world/terrain-heights.ts`):
- Use the same patch-packing approach as `terrain-colour.ts`, with world-aligned texels.
- Use R16F with linear filtering (filterable in WebGL2).
- Start at 1 m texels, about 2.75 MiB at the colour atlas's footprint. Coarsen to 2 m only if the error check
  allows it: distant leaves are at least about 130 m away, where vertex spacing is 2 m or more.
- Register it with the other bake materials so `precompileSim` compiles it.
- Add a ready uniform like `uTerrainColourReady`, so profiling can pair it against the direct function.

**How `groundHeight` and `heightAt` read heights:** the window texture first, then the atlas, and `worldHeight`
only outside every patch.

**Open sea outside the patches.** Most distant vertices are open sea, outside every patch. First establish what
`worldHeight` returns there and whether any rendered pixel can show it (under deep water or fully fogged). If
nothing can, replace it with a cheap sea-floor expression that matches the patch borders. Blend across a margin
of at least two texels, as the colour atlas does. If something can show it, keep `worldHeight` there and record
the reason.

**Accuracy.** Checking texel centres alone is not enough. A CPU probe of the 1 m layout found about 20 cm of
error *between* samples, before any half-float rounding. That error bends distant terrain, its normals and the
shadows marched over it. The gates:

- **Interpolation error:**
  - Sample each patch at sub-texel points: at least the texel quarter-points, plus random points.
  - Compare the atlas's bilinear value, in the stored format, with `worldHeight`.
  - Record the maximum and the 99th percentile, per patch.
- **Height and normal bounds:**
  - Height error ≤ 5 cm.
  - Normals (from h, hx, hz at the leaf's vertex spacing) within 0.01 per component.
- **Fallback where the bounds fail:**
  - Where a region can't meet the bounds at an affordable resolution, keep the direct calculation for it. Flag
    such regions in a second channel (RG16F or R32F plus a mask), or give those patches finer texels.
  - Record the memory each option costs.
  - If most of the saving goes to fallbacks, drop B and record why.
- **Moving camera:** compare the old and new rendering while the camera moves: the Meadow walk, sailing, and a
  pan across the window edge. Compare frames exactly as in "How every phase is judged". No seam may show at the
  window edge or at a patch edge, and there must be no visible swimming.
- **Shadows:** re-bake the shadows for each variant before comparing (see the profiler rule below).

**Kept away from item C.** The window height bake does not read the atlas.

### C. Cheaper window height re-bake (exact)

`HEIGHT_FRAG` in `ground.ts` calls `worldHeight` 5 times per texel over 512² on every window move: the centre plus
four neighbours exactly one texel away. Split it into two passes:

1. **Heights.** Compute `worldHeight` into an intermediate R32F target of (512+2)², covering a one-texel margin
   all round. Keep full float precision, like the current `FloatType` height target.
2. **Normals.** Take each texel's normal from its four neighbours in that intermediate target. Write `r` height
   and `gba` normal into the existing target.

The border texels' neighbours come from the calculated margin, so every value equals today's calculation.
Floating-point rounding of the sample positions is the only difference, and it is recorded. This phase does not
depend on the item B atlas. (Using atlas heights for border neighbours gave a 0.048 normal-component error in a
CPU probe.)

The output layout and the `setHeightGrid` and readback consumers stay unchanged.

**Rejected for now:** re-baking only the newly exposed strip. The light bake re-marches the whole window on
every move anyway, so the strip would save less than it costs in complexity. Revisit only if travel hitches
remain after C.

### D. Small exact skips

- **Sleeping veil** (`sleeping-weather.ts`, the full-screen `fog` mesh): it draws 2 screen-space fbm per pixel
  even when `uSleepVeil` is 0. Hide the mesh when the veil value is 0. The result is identical, because an alpha
  of 0 with normal blending changes nothing.
- **Sky mirror `glassColour`** (`water.ts`): it computes `skyRadiance` even where `on == 1` and only the planar
  reflection is kept. Branch on `on < 1.0`.
The surf phase cache is **not** an exact skip and has moved to item E as an experiment (see there).

### E. Bake the fine ground grain and noise (changes the look; visual review)

Per-fragment noise that is still live:
- `grain` and `ripples` (3 `vnoise`, at every distance; `mix(…, detail)` doesn't skip the calculation).
- The Wood floor's moss `fbm(0.24)` and flecks.
- The Wood tint `fbm(0.32)` (`grass.ts`).
- The Sleeping floor's tuft `fbm(0.17)` and fibre.
- `frostAt`'s `fbm(0.12)`.
- 7 `vnoise` in the shallow-water bed (`water.ts`).

`fbm` has 4 octaves with a lacunarity of 2, so its top octave is 8× its base frequency. A world-aligned atlas
fine enough to reproduce the top octaves exactly is too large. So this item replaces the noise with sampled,
mipmapped tiling noise textures. The pattern stays statistically similar but is not the same pattern, and it
aliases less at a distance.

**Approach:**
1. Measure each term's cost first, by replacing it with a constant in a paired profile. The candidates include:
   - **The surf phase** (`surf.ts` `surfCycle`). Its two static `vnoise` terms (0.016 and 0.057 cycles/m) could
     go into the unused G channel of the shore bake (`water/shore.ts`), which re-bakes with the window. This is
     not exact:
     - Narrow foam edges amplify even a 1e-3 phase error.
     - When the phase crosses a whole number, it changes the wave's random pattern (`floor(c)` seeds
       `surfReach`).
     - It stays procedural unless it passes comparisons over complete wave cycles, and across window moves
       (the bake is window-aligned), plus the video review.
   - **The frost pattern.** `frostAt` runs in the grass **vertex** shader (`grass.ts`) and in six other shaders
     (`terrain.ts`, `sleeping.ts`, `sleeping-birches.ts`, `sleeping-trail.ts`, `sleeping-hearth.ts`). A texture
     replacement needs one explicit sampling-level policy, so that frost on blades, ground and props stays
     consistent: `textureLod` at a fixed level, the same in every stage.
2. Bake only the terms that measurably pay.
3. Show before/after **video** of the moment in play (Jeremy's standing preference, not stills) for Wood, Sleeping,
   Meadow and a beach. An allowed visual model reviews it before anything merges, and Jeremy sees the video.

### F. Wind-cost anomaly (investigate)

In paired tests, skipping `wind.step(1/60, time, false)` saved 4.7–6.1 ms in Washing, Wood and Sleeping, and
0.8–2.1 ms elsewhere. The step is 21–22 passes at 256² (plus one at 128²) with cheap shaders
(`src/wind/shaders.ts`), so that saving is implausible.

**Establish:**
- whether the saving is a measurement artefact (the draw loop, sim pause or clock behaviour in `frame-profile.mjs`);
- or whether it's a real stall: render-target switching on a tile-based GPU, or the textures the step writes
  being read by scene shaders in the same frame.

**Deliverable:** the explanation, with evidence. If the cost is real, a fix that leaves the wind field numerically
identical (for example, fewer target switches or fused passes). The identity check covers the velocity texture
**and** the grass bend and sway textures. If it's an artefact, a corrected tool.

### G. Birches scarf CPU (reduce without changing the motion)

Birches is the only chapter where the CPU matters: 4.4 ms median. Profile self-time per frame:
- `write` (`birch-scarf.ts`): 1.16 ms
- `step` (`scarf-cloth.ts`): 0.77 ms
- `indexedNormals`: 0.36 ms
- `collide`: 0.32 ms

**Try exact changes first:**
- write and recompute normals only for sections that are unchanged by the definition below;
- skip cloth that is at rest;
- remove per-frame allocations.

**Definition of "unchanged".** A strip's mesh is more than each section's position. It depends on:
- the time-driven roll;
- the tangents of neighbouring sections;
- an orientation carried along the whole strip.

A section may skip its write only if **every** input to its vertices and normals is unchanged, including those
three. Otherwise a fold freezes or the lighting shifts. The first thing to try is safest: remove allocations
and redundant work inside `write`, without skipping sections.

**Rest and wake-up.** Cloth counts as resting only if its positions stay put and none of these are active: wind at
its sections, a moving attachment or support rail, release progress, or slip time. Any of them wakes it the same
tick.

**Tests:**
- Positions **and normals** match the unmodified build over scripted runs covering:
  - the tied scarf in wind;
  - release and the slip off the branch;
  - the child gathering it;
  - restoring from a checkpoint mid-sequence.

Any change that alters the motion (fewer substeps or constraint iterations, cheaper collision) needs before/after
video of the scarf in play, reviewed like item E.

### H. Repair the profiler

`tools/frame-profile.mjs` still lists `shoreFamily` (removed from `main.ts`), so the injected audit throws and the
game never reports ready. The fix is to remove it from `groups` and from the `culling-off` root list (proved in
the 09-24 run).

Every later phase measures through this tool. Add an ablation for each new cache or skip that restores the old
path in the page, following the existing examples:
- the `fields-direct` and `colour-direct` ready uniforms;
- the `full-tint` shader string replacement for skips.

## How every phase is judged

- **Exactness:**
  - Items A, C and D compare rendered frames with the old path restored in the same page. The maximum channel
    difference is ≤1/255 in every chapter listed in the profile; item A differences are expected to be 0.
  - Item B uses its own accuracy gates plus ≤2/255 frames.
  - Items B and C also compare texture values, as `tools/terrain-fields-check.mjs` does.
- **Saving:**
  - The saving is the median of at least four interleaved pairs per chapter, reported with its range.
  - A change that isn't exact must show a consistent saving to be kept.
  - An exact skip is kept unless it measurably costs time.
- **Shadows in frozen comparisons:**
  - The profiler's frozen `draw()` renders without re-running `bakeLight` or `bake`. Any variant that changes a
    height source (`heights-direct`, the item C passes) must re-bake the window and the light for **each** side of
    every pair. Otherwise both sides share one shadow texture.
  - `?dusk=` fixes the sun, so timing the light bake needs a fixture where the sun actually moves: step
    `uSunDir` through a sunset arc between draws, or run the real dusk transition.
- **Hitches:** item C is judged by window-move frame gaps on a travelling fixture (`tools/perf.mjs frames` while
  walking in Meadow or sailing), not by steady-state cost.
- **Measuring conditions:**
  - Measure from a worktree with its own dev server.
  - Check `ps` first for busy GPU/CPU processes.
  - Record source hashes, as the earlier cache work did.

## Rejected

- **Sky clouds into a static texture.** They drift every frame (`uCloudShift`, `uTime`), and the fine fbm would
  need a very large texture. Lower-resolution sky is out of scope (ruling above).
- **Props (rocks, bark, drowned village, cottage, jetty, piano, distant islands).** Their shaders use 0–4 `vnoise`
  over a small screen area. No scene shader ray-marches shadows or AO.
- **A `journeyHides` room-index texture.** About 11 ellipse tests per fragment is cheap arithmetic.
- **Pond fbm.** It scrolls with time over a small area.

## Durable rules after shipping

Move into `docs/engine.md`:
- the new caches, with their memory;
- the "skip unused terms" rule for the terrain shader;
- the measured savings.
