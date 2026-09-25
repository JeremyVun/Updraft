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

Build ruling, 2026-09-24 (verbatim):

> Ok proceed with phase 0, 1, 2, 4, and 5. And if you can find ways to make the birches scarf look and behave
> better, go ahead (currently it feels too "physic simulationy" if that makes sense).

- Phases 3 (item B, the distant-height atlas) and 6 (item E, the grain bake) are **on hold** until Jeremy approves
  them. He asked to be told of any risk of visual regression, so both would bring him video before merging.
- The scarf's look and behaviour are now in scope as item G2 below. They follow item G's exact CPU work.

Phase 3 approved, 2026-09-24 (verbatim):

> can we do phase 3 carefully and show me where there is regression so i can judge?

- **Order.** Phase 3 first measures the most it could save, as an upper bound, and stops if that is small.
- **Scale of the error.** The 20 cm interpolation error, at 38° vertical field of view on a 1032-pixel-tall
  iPad view, is about 2 px at 130 m and 1 px at 300 m. The 5 cm gate is under a pixel at 130 m. Distant leaves
  already have 2 m or more vertex spacing with flat triangles between vertices.
- **What Jeremy sees.** He judges the regression himself from:
  - per-chapter difference maps, amplified;
  - side-by-side crops of the worst regions;
  - before/after video of the Meadow walk, sailing and a pan across the window edge.
- **Merging.** Nothing merges without his verdict.

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

**How it measures:** each cell is one component's paired saving: the median of four interleaved pairs, with the
component turned off in one half of each pair. It is written as a percentage of that pair's own baseline, followed
by milliseconds saved "of" that baseline.

**Caveats:**
- These figures are not hardware timers or fps.
- Savings overlap, so they can't be added up.
- **The GPU ran in two states.** Within a single chapter, pair baselines jumped between about 11–13 ms and about
  20–27 ms from one ablation to the next. The cause may be another app (one was using about 90% of a CPU core)
  or a GPU clock state. Millisecond savings from the two states aren't comparable, so compare percentages, and
  only within a row.
- There is no single "GPU work per frame" figure for a chapter.
- Future runs should record the baseline of every pair and repeat any ablation whose baselines straddle the two
  states.

Raw data: `/tmp/updraft-perf-0924/profile.json` (in `/tmp`, so it won't survive a reboot; the table below is the record).

Each cell is the saving as a percentage (ms saved of the pair's baseline ms):

| Chapter | CPU median (ms) | Terrain shading | Grass | Post | Sky | Reflection | Wind step | Room |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Island | 1.3 | 14% (3.8 of 27) | 12% (1.4 of 11) | 10% (1.2 of 12) | 4% (0.5 of 12) | 7% (0.9 of 12) | 8% (0.9 of 12) | |
| Washing | 1.7 | 19% (2.2 of 11) | 19% (2.1 of 11) | 11% (3.0 of 23) | 10% (1.0 of 11) | 4% (1.1 of 27) | 23% (5.4 of 19) | |
| Meadow walk | 2.6 | 19% (5.1 of 27) | 23% (3.0 of 13) | 11% (1.4 of 13) | 0% (0.0 of 20) | 7% (0.9 of 13) | 9% (1.2 of 13) | |
| Birches | 4.4 | 27% (3.5 of 13) | 18% (2.3 of 13) | 11% (1.4 of 13) | 4% (0.5 of 13) | 2% (0.2 of 13) | 12% (1.6 of 22) | birches 18% (4.8 of 27); scarf CPU ≈2.6 ms |
| Drowned | 1.8 | 6% (0.8 of 20) | −1% | 10% (0.9 of 9) | 2% (0.4 of 21) | −2% | 9% (0.8 of 9) | village 4% (0.4 of 9) |
| Wood | 1.5 | 34% (3.6 of 11) | 12% (1.3 of 11) | 9% (1.0 of 11) | 5% (0.6 of 11) | 1% (0.2 of 11) | 20% (4.7 of 23) | wood 7% (1.7 of 25) |
| Sleeping | 1.4 | 16% (4.1 of 26) | 12% (3.2 of 26) | 16% (4.1 of 26) | 5% (1.2 of 26) | 0% | 22% (6.1 of 27) | sleeping 8% (2.1 of 25) |
| Boats | 1.6 | 24% (5.5 of 23) | 11% (2.5 of 23) | 10% (1.1 of 11) | 3% (0.7 of 24) | 6% (0.9 of 20) | 8% (0.9 of 11) | |
| Jetty | 1.5 | 21% (2.6 of 12) | 15% (1.8 of 13) | 7% (0.9 of 12) | 3% (0.4 of 12) | 1% (0.1 of 12) | 6% (0.8 of 12) | |
| Sea | 1.5 | 1% (0.2 of 24) | 4% (1.1 of 24) | 16% (3.5 of 22) | 15% (3.6 of 24) | 15% (3.2 of 22) | 8% (1.7 of 21) | |
| Mirror | 1.5 | 7% (1.4 of 20) | 4% (0.8 of 20) | 22% (4.6 of 21) | 13% (2.5 of 19) | 16% (3.2 of 22) | 10% (2.1 of 21) | |

The terrain figure comes from the `terrain-flat` test, which keeps the terrain geometry. So the vertex-shader cost
of the distant terrain (item B below) is **not** included in it.

## Profile after phases 0–5 (2026-09-25, `main` at 2e9603f, before 5b)

**Fixture:** the same as 09-24, on a machine with no contention.
- Clean baselines were 5–8 ms back to back and 7–11 ms drained.
- Wind `stepMs` stayed at 0.26–0.52 ms throughout.
- Two page loads per chapter, 6 pairs each, pooled. Rows that straddled or were contended were dropped.
- † marks a cell from one load only.
- The 09-24 baselines were in the contended slow state, so compare percentages, not ms.
- Raw data: `/tmp/updraft-pb-reprofile2-data/`.

| Chapter | CPU (ms) | Terrain | Grass | Post | Bloom | Sky | Reflection | Water | Wind (drained) | Room |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Island | 1.4–1.6 | 12% | 21% | 9% | 10% | 5% | 3% | 7.5% | 3.5% | |
| Washing | 1.8–2.2 | 8% | 26% | 9% | 6% | 6%† | 0%† | 10% | 3.0% | washing 5% |
| Meadow walk | 2.2–2.3 | 16% | 33% | 9% | 6% | 1% | 2% | 7.5% | 1.6% | |
| Birches | 3.4–3.6 | 14% | 18% | 11% | 6–9% | 4% | −1% | 5%† | 3.3%† | birches 24% |
| Drowned | 1.8–1.9 | 0%† | −2%† | 12%† | 9% | 8%† | 0%† | 3.5%† | 2.1%† | village 1.4% |
| Wood | 1.8–1.9 | 19% | 17% | 10% | 5% | 5% | 0% | 6% | −0.7% | wood 4.7% |
| Sleeping | 1.8–1.9 | 14% | 19% | 9% | 6% | 9% | −1% | 12% | 0.4% | sleeping 0.6% |
| Boats | 1.7–2.0 | 10% | 23% | 12% | 7% | 2% | 1% | 12% | 1.6% | |
| Jetty | 1.6 | 12% | 17% | 8% | 6% | 2% | 0% | 7.5% | 2.6% | |
| Sea | 1.6–1.8 | 1% | 1% | 13% | 8% | 16% | 11% | — | 2.7% | |
| Mirror | 1.8–1.9 | 2% | 0% | 15% | 12% | 21% | 17% | — | 1.7% | |

**Readings:**
- **Grass is now the largest cost in every land chapter.** It has about the same ms as on 09-24; A and B
  removed the work around it.
- **Terrain shading's share roughly halved** on land (A).
- **The wind is 0–3.5%** (F).
- **Rooms:** the Sleeping room fell from 8% to 0.6% (D). The Birches room is 24% of its chapter: 428k triangles
  in 16 calls, not yet split into trunks, leaves and scarf.
- **The final grade is free.** Post is essentially bloom plus the resolve.
- **Draining** does not shrink bloom the way it shrank the wind.
- **The top CPU self-time** is the height readback's `getBufferSubData` (0.15–0.29 ms per frame).
- **Candidates for a next round**, each to be measured before any decision:
  - a grass breakdown: vertex against fragment, the LOD tiers, and the frost and tint terms;
  - a split of the Birches room;
  - an audit of the water surface on land (6–12%) for dead terms, like A.

  Bloom resolution and item E would change the look.

## Round 2: battery (2026-09-25)

Jeremy, 2026-09-25 (verbatim):

> Previously, a full playthrough cost 30% of my ipad battery, but now after all the optimisations to date it only
> costs 15-18% of my ipad battery. So good progress, but i want to try and get it down even more.

**The target is now energy over a whole playthrough, not frame time.** Energy is roughly each chapter's work per
frame × frames rendered × minutes spent there, plus what doesn't show in a GPU profile: CPU script, the audio
graph (which runs every audio frame whether or not a layer is audible), and the display. So a cost in a chapter
the player spends 10 minutes in outweighs the same cost in a 1-minute one, and a skip that saves no frame time on
the Mac can still save energy.

**Assumptions to state, not rely on:**
- The M4 Pro Mac and the M5 iPad have the same family of tile-based Apple GPU, and Chrome and Safari both run
  WebGL through ANGLE on Metal. So a pass's share of GPU time on the Mac is taken as its share of GPU energy on
  the iPad. Absolute milliseconds don't transfer.
- The display and the system take a share of the 15–18% that no rendering change touches. At a guessed 3 W
  for display and system over a playthrough of about an hour on a ~39 Wh battery, that floor is about 8%, so
  the reachable part is roughly half of what's left. Jeremy's playthrough time and brightness would firm this up.

**Measure first (phase M).** No `src/` change until the numbers are in and Jeremy has seen the ranked list.
1. **Minutes per chapter.** Chapter entry times from a full `tools/playthrough.mjs` run (`report.chapters`),
   as the weight for everything else. The bot's pace is a proxy for Jeremy's.
2. **Cost per frame per chapter**, drained, at the scale Jeremy plays (High is 1.5×, touch Auto 1.25×; both
   are measured until he says which).
3. **Breakdowns of the known large costs**, paired as before:
   - grass: vertex against fragment, each LOD tier, and the frost and tint terms;
   - the Birches room: trunks, leaves, scarf and the rest;
   - the water surface on land (6–12%): dead or invisible terms, as item A found in the terrain;
   - post: bloom pass by pass, and the MSAA resolve.
4. **CPU per chapter:** frame script time, draw calls and the top self-time functions.
5. **Audio:** the audio thread's CPU with sound on against muted, per chapter, and a census of nodes that run
   while silent (zero-gain oscillators and noise layers, the two 4.5 s convolvers, the spare convolver), with
   which of them could be stopped without any audible change.
6. **Levers that change the look, costed only:** render scale 1.5× → 1.25× → 1×, MSAA 2 → 0, bloom at lower
   resolution, and the sky at lower resolution at sea and on the mirror. These are Jeremy's decisions; the
   numbers only inform them.

**Deliverable:** a table of energy share by chapter (cost × minutes), a ranked list of candidates split into
exact (no look change) and look-changing, each with its expected saving of the whole playthrough, written here
under "Round 2 profile".

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

**Result (2026-09-24, merged 8a1027e):**
- **A3's precondition holds.**
  - An analytic bound (noise ≤ 2.8) puts any presence inside a scaled meadow ellipse. That ellipse clears the uv
    0.001/0.999 cut by at least 26 m.
  - A 6.9 M-sample CPU sweep (`tools/fields-border-check.mjs`) found no presence outside.
  - `fieldAt` returns exactly `vec4(99,0,0,0)` there.
- **Exactness:**
  - A2, A3 and D1 are bit-identical in all 11 chapters, including forced frost on/off, veil 0/mid, and both
    sides of the `far` edge.
  - A1 is bit-identical except for 1 float ulp from the leaf-mould line on, in Birches and on the Jetty. The
    Metal compiler (fast math) combines operations differently once the surrounding code changes. That shows as
    ≤1/255 in ≤4 channels, in some frames. Nothing that line reads changed.
- **Saving** (terrain skips, median of paired rounds, all in the fast GPU state):

  | Chapter | Saving |
  |---|---:|
  | Island | 10–11% |
  | Washing | 14–15% |
  | Meadow walk | 12–15% |
  | Birches | 12–16% |
  | Wood | 15% |
  | Sleeping | 8–10% |
  | Boats | 15% |
  | Jetty | 10–16% |
  | Drowned | 1–3%, within noise |
  | Sea, Mirror | none, within noise |

  A1 carries most of it (9–16% on land), with A3 at 1–5% and A2 at 2–5%.

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

**Result (2026-09-24, merged 2ec20d2).** Jeremy's verdict on the evidence, verbatim: "yep merge phase 3, looks
good." He accepted the far-skyline edge-pixel change in place of the 2/255 gate.
- **Upper bound.** Replacing every height read beyond the window with a constant saved 11–21% per chapter.
  96% of the light bake's cost is those reads.
- **Built:**
  - 1 m texels in R32F with manual bilinear filtering.
  - Cells where the atlas misses the formula by more than 1 cm and that reach above −4 m (4.8% of visible cells:
    creases, cliff lips, pool banks, pond rim) keep the direct formula. The flag is a +1000 offset in the cell's
    first texel.
  - The open sea is an exact `seaFloor` expression.
  - Memory: 6.64 MiB (693×2513).
  - The atlas bakes patch by patch before Begin, at about 75 ms of M4 Pro GPU.
  - The boot gap is unchanged (250–317 ms against a 500 ms ceiling).
- **Accuracy as built (GPU-measured):** visible height ≤ 1.36 cm; the 2 m normal ≤ 0.0077.
- **Saving (paired, no straddles):**

  | Chapter | Island | Washing | Meadow walk | Birches | Drowned | Wood | Sleeping | Boats | Jetty | Sea | Mirror |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Saving | 12.8% | 9.5% | 13.1% | 9.2% | 11.2% | 5.6% | 12.3% | 14.4% | 12.9% | 14.6% | 14.3% |

  - A window move drops from 24–30 ms to 3–8 ms of GPU work.
  - The sunset shadow re-march (every third frame) drops from about 23 ms to 2–4 ms.
- **What changes on screen:**
  - Single anti-aliased pixels on distant skylines change colour, because a far ridge's outline moves by a
    fraction of a pixel. There is also 1/255 shading on hazy far slopes.
  - It **exceeds the plan's 2/255 frozen-frame gate** on those edge pixels: up to 41/255 in a still and 68/255 on
    one pixel in motion.
  - 10 of 11 chapter-entry frames are identical. The Meadow walk changes a median of 161 of 921,600 pixels per
    frame.
  - No seam shows at the window or patch edges. Frame-to-frame change is equal for old and new (no added
    shimmer).
  - The lead reviewed the worst crops (4× enlarged): old and new are indistinguishable by eye. Only the ×40
    difference shows them.
  - Evidence: `/tmp/updraft-pb-p3-evidence/index.html`.
- **Found in passing:** the sleeping island's notch is written in `birchesHeight` without its `land` factor. It
  cuts an unbounded 11 m strip 0.157 m deeper under the open sea. It's invisible, but `seaFloor` reproduces it,
  so fixing the notch means changing both.
- **Not measured:** the iPad, where the boot bake may be 3–5× slower.

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

**Result (2026-09-24):**
- **Exactness.** The output is bit-identical to the single-pass bake: max height and normal differences are 0
  over 20 windows. Positions come from `gl_FragCoord`, not `vUv`. Window corners are multiples of 10 m, so sample
  positions are exact.
- **GPU cost** (`tools/window-hitch.mjs bench`, medians):
  - the height stage falls from 4.2 ms to 1.3 ms;
  - a whole window move falls from 24.6–25.2 ms to 21.6–22.5 ms.
- **The light bake** (`GROUND_FRAG`, about 20 ms) is now almost all of a move's cost. Its march falls back to
  `worldHeight` beyond the window, which item B's atlas would address.
- **Frame gaps** at window moves showed no difference between builds on the Mac; the GPU absorbs the burst.
  Only the iPad would show a visible effect.
- **Memory:** the 514² R32F intermediate adds 1.0 MiB.

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

**Result (2026-09-24, merged 8a1027e):**
- **The veil** is exact in every state. It is hidden through `material.visible`, so the room system's `visible`
  writes are untouched. It saves 8% in Sleeping and 7% in Sea, where the sleeping room is drawn with the veil
  at 0.
- **The mirror sky branch** is bit-identical in float32 at `on` 1, 0.5 and 0, and saves 19–21% in Mirror.
- **The old mirror code drew specks.** In the real half-float pipeline on ANGLE/Metal, the **old** code draws
  about 100–300 specks in some frames: one or two channels drop to 0, giving teal and orange dots up to 188/255,
  and once a short streak. The lead confirmed them on the flat in captures. The new code draws none at any `on`
  value. So the change removes a visible glitch in the shipped game rather than adding one; whether the iPad
  shows the specks is unknown. The profiler tolerates the old path's specks in `glass-sky-always`.

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
   - **Terms shared across stages: the frost pattern and the Wood tint.**
     - `frostAt` runs in the grass **vertex** shader (`grass.ts`) and in six other shaders (`terrain.ts`,
       `sleeping.ts`, `sleeping-birches.ts`, `sleeping-trail.ts`, `sleeping-hearth.ts`).
     - The Wood tint `fbm(0.32)` sits in `grassTintWithPattern`. That runs in the terrain fragment shader, in the
       grass tables' `TABLE_FRAG` and in the direct-vertex path `VERT_DIRECT`. The table's fragments are packed
       blade indices, not a screen footprint, so implicit derivatives, or gradients derived from table
       coordinates, would pick unrelated mip levels.
     - A texture replacement of either term samples with `textureLod` at one fixed world-space level, the same in
       every stage. That level is independent of table packing and grass LOD, so blades, ground and props agree.
     - Compare surviving blades across LOD transitions and table rebakes.
2. Bake only the terms that measurably pay.
3. Show before/after **video** of the moment in play (Jeremy's standing preference, not stills) for Wood, Sleeping,
   Meadow and a beach. An allowed visual model reviews it before anything merges, and Jeremy sees the video.

### F. Wind-cost anomaly (investigate)

In paired tests, skipping `wind.step(1/60, time, false)` saved 20–23% in Washing, Wood and Sleeping (4.7–6.1 ms,
measured in the slow 19–27 ms GPU state), and 6–12% elsewhere. The step is 21–22 passes at 256² (plus one at 128²) with cheap shaders
(`src/wind/shaders.ts`), so that saving is implausible.

**Establish:**
- whether the saving belongs to the slow GPU state (see the profile caveats);
- whether the saving is a measurement artefact (the draw loop, sim pause or clock behaviour in `frame-profile.mjs`);
- or whether it's a real stall: render-target switching on a tile-based GPU, or the textures the step writes
  being read by scene shaders in the same frame.

**Deliverable:** the explanation, with evidence. If the cost is real, a fix that leaves the wind field numerically
identical (for example, fewer target switches or fused passes). The identity check covers the velocity texture
**and** the grass bend and sway textures. If it's an artefact, a corrected tool.

**Result (2026-09-24, merged 92990f8): an artefact.** There are two causes.

1. **GPU contention from other processes (the "slow state").** A second Chrome running a heavy shader
   reproduces the slow state's signature:
   - baselines of 20–34 ms;
   - an ALU-bound calibration pass 2× slower;
   - the wind step alone 10–13× slower.

   The step is a chain of 21 small, dependent passes, and under contention each waits its turn (about 0.2 ms
   instead of about 20 µs). So its share of the frame doubles. A clock or power state would scale everything
   evenly, and the step does not itself cause the slow state.
2. **Back-to-back synthetic draws.** The scene reads what the step wrote in the same draw, so consecutive draws
   lose overlap that real frames never had. Render-target switches and overwriting what the last scene read
   were both ruled out.

**The step's real cost** is 0.4–0.6 ms alone.

**Corrected profile:** the `wind` ablation now drains the GPU after each draw and records `stepMs`. It warns
above 1 ms, which indicates contention. The corrected saving, from 6 uncontended pairs each:

| Chapter | Saving |
|---|---:|
| Island | 0.8% |
| Washing | 1.1% |
| Meadow walk | 1.7% |
| Birches | 2.6% |
| Drowned | −0.8% |
| Wood | 1.6% |
| Sleeping | 3.1% |
| Sea | −0.4% |
| Mirror | 3.7% |
| Boats | 1.4% |
| Jetty | 2.4% |

Investigation tool: `tools/wind-cost.mjs`.

**Not built:**
- **An exact pass fusion** (21 → about 12 passes: fold the pressure scale in, fuse curl with vorticity, write
  bend and sway in one pass, diamond-fused pressure). It would save about 0.1–0.2 ms uncontended, which isn't
  worth the shader complexity at the Mac numbers. The Mac does not show whether a tile-based iPad GPU pays
  more per pass: each pass there stores its tile memory back out. Revisit only if an iPad profile points at the
  step.
- **A tooling follow-up:** `frame-profile`'s `complete()` polls with `setTimeout(0)` (about 4.5 ms quantum). A
  `MessageChannel` poll would cut noise for every ablation. Every ablation made of chained small passes (bloom,
  bakes) is also inflated under contention, so read `baselines` and `straddle` first.

### G. Birches scarf CPU (reduce without changing the motion)

Birches is the only chapter where the CPU matters: 4.4 ms median. Profile self-time per frame:
- `write` (`birch-scarf.ts`): 1.16 ms
- `step` (`scarf-cloth.ts`): 0.77 ms
- `indexedNormals`: 0.36 ms
- `collide`: 0.32 ms

**Try exact changes first:**
- skip writing and recomputing normals only for sections that are unchanged by the definition below;
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

**Result (2026-09-24, merged 9252bd9):**
- **CPU.** The scarf's `update` fell from 2.77 to 1.76 ms per frame (−36%), and the Birches frame median from
  about 4.8 to 3.7 ms, on a busy machine. Per function:

  | Function | Before (ms) | After (ms) |
  |---|---:|---:|
  | `write` | 1.14 | 0.33 |
  | `collide` | 0.33 | 0.09 (+0.05 `push`) |
  | `step` | 0.76 | 0.77 (unchanged; now the largest cost) |

- **How:**
  - Fold, roll and bunching are precomputed per length, and the roll is skipped where the cloth sets the width.
  - Per-row lookups use tables, and the per-row wind and stump values are computed once per frame.
  - The solver works on packed `Float64Array`s, with precomputed link alphas and support Gaussians.
  - Capsules are found through a ground grid, and an exact early-out skips points clearly clear of a capsule.
- **Exact.** `tools/scarf-exact-check.mjs` runs old and new in lockstep in Node over 24 phases and 4,300 frames:
  tied in wind and calm, every release, the slip, checkpoint restores, 30 Hz, and the gathering. Positions,
  normals and cloth particles are byte-identical. One nudged normal fails the check.
- **Impossible without changing the motion:**
  - *Section skipping:* the roll and flutter have time terms, and the transported frame carries them along the
    whole strip.
  - *Cloth rest:* the ambient wind at the scarf is never zero, and even in dead calm the cloth still creeps
    about 1 mm/s after 4 minutes.
- **Pre-existing on `main`:** `PHYSICS=1 tools/scarf-check.mjs` fails at tangle 4, which needs 7 strokes against
  its limit of 5, on the unmodified build too. Its physics section's wall-clock thresholds (stretch 1.15, settle
  speed) fail intermittently under machine load, on both builds.

### G2. The scarf looks and behaves less like a simulation (look change, Jeremy's verdict)

Jeremy, 2026-09-24: the scarf "feels too 'physic simulationy'". He gave latitude to make it look and behave
better. The scarf is his "impossibly long red scarf", "make it really beautiful" (`docs/journey.md`, Birches).

**Reading of the brief:** the released lengths should read as heavy, soft knitted wool with intent in how they
move, not as a generic cloth solver. Typical tells of a simulation are rubbery stretch and rebound, jitter or
buzzing at rest, uniform floppiness along the whole length, over-eager reaction to every breath of wind, and
bouncy settling. The agent diagnoses from video of the scarf in play which of these (or others) are present
before changing anything, and records the diagnosis here.

Jeremy, later on 2026-09-24 (verbatim):

> one of the problems i had with the scarf was that it felt very jittery. especially when its drawing into the boat
> sail at the end. is there a way to make it feel a bit smoother?

So jitter is the first symptom to fix, and it is worst during the gathering into the sail. The lead read the
gathering code and found these candidate causes. They are hypotheses; the measured symptom is what's binding.
- **The frame pops when the gathering starts.** On its first frame, every cloth row switches from the cloth's
  across vector to the transported frame plus the roll (`physical = … && this.gathering === 0` in `write`).
- **The geometry slides under the surface shapes.** The gathering slides each row along the polyline
  (`at = i + travel`, lerp between `centre[lo]` and `centre[hi]`). Folds, roll and bunching stay fixed per row
  while the shape slides beneath them. So tangents jump as samples cross the polyline's corners, and the
  parallel-transported frame, carried from row 0, re-twists along the whole strip every frame.
- **The wind steps.** The CPU wind copy updates every other frame, which steps the authored rows' wind spring.
- **The mast end may lag a frame** (`boatEnd.copy(boatMast)`) while the boat rides the swell, depending on
  frame order.

**Must keep:**
- the four tangles, their gestures, the order, saved progress and checkpoint restore;
- gravity and settling: nothing floats (Jeremy's earlier floating-scarf findings);
- branch and trunk contact, and clearance around the broken birch during the lift;
- the gathering into the red sail;
- equal motion at 30/60 Hz;
- item G's CPU savings. The CPU cost must not rise above item G's result.

**Checks:** `PHYSICS=1 node tools/scarf-check.mjs`, `node tools/scarf-geometry-check.mjs`, and before/after
**video** of the scarf in play: each release, the settling, the scarf moving in the player's wind, and the gathering.
An allowed visual model reviews it, then it goes to Jeremy. **No merge without Jeremy's verdict.**

**Result (2026-09-25, branch `perf-bakes-p5b` at 78e94d4, awaiting Jeremy's verdict):**

*Diagnosis, from before-video.* Five things read as simulation:
- **The gathering jittered.** Width, twist and folds flickered every frame, and near the end the strip broke into
  dotted fragments. Rows slid through the tree wraps, tangents snapped at the path's corners, and surface detail
  stayed on row indices. The parallel transport from row 0 re-twisted the whole strip, and the first gathering
  frame popped.
- **A travelling sine** ran along every tied length, with a twist wave on top.
- **Wool on the ground** snaked into S-curves under the brush and kept creeping (0.16 m/s after 30 s calm).
- **The first loop** stretched 15% into a thin ribbon and whipped at up to 10 m/s on release.
- **The coils** rose as one rigid lid and landed as a pancake.

*Changes:*
- **Released cloth:**
  - Air pressure acts on the face and grows with the square of the speed, capped below gravity, with shelter
    on the ground.
  - Neighbouring stitches share their motion (viscosity).
  - Tethers limit stretch without adding velocity.
  - Static friction holds wool still against slow pulls.
  - Gravity is 9.8, bending is stiffer, and the solver runs 10 iterations.
- **Tied lengths:** span-averaged damped wind plus a slow in-step sway replace the ripple. Each row's frame is
  local, with no transport along the strip.
- **Gathering:** the strip keeps to its path with blended frames, and only the free end runs home to the sail.
- **Knobs:** new `birches.scarf` knobs; `flutter` and `clothWind` are removed.
- **Tools:** `tools/scarf-video.mjs` records true 60 fps clips, and `tools/scarf-feel-probe.mjs` measures in
  Node.

*Measured (base → new):*
- Gathering surface motion: mean 50 → 2.4 mm, p95 388 → 19 mm.
- Close-up red-pixel flicker: 4.97% → 0.38%.
- Creep after 30 s calm: 0.16 → 0 m/s.
- First-release peak stretch: 1.15 → 1.09; it now settles in 4.9 s, where before it never settled.
- CPU is about 6% below base in alternated pairs on a busy machine.

*Checks:*
- Gates behave the same as on `main`: geometry passes, and `PHYSICS=1 scarf-check` fails only at the
  pre-existing tangle 4.
- **The lead's review of the frames:**
  - Consecutive gathering frames are steady where the base visibly re-twisted every frame.
  - The coils in the unwind still rise as a fairly compact wound block and land as a neat round coil, a modest
    improvement.

*Worse or uncertain (agent):*
- Resting shapes differ: the first length rests in its authored Z fold instead of creeping straight.
- Mid-gathering is quick.
- The tied drapes sway only about 5 cm.
- Released spans pinned between two trees can still lie taut and straight.

Videos: `/tmp/updraft-pb-p5b-video/index.html`.

### H. Repair the profiler

`tools/frame-profile.mjs` still lists `shoreFamily` (removed from `main.ts`), so the injected audit throws and the
game never reports ready. The fix is to remove it from `groups` and from the `culling-off` root list (proved in
the 09-24 run).

The tool's frozen `draw()` also calls `wind.step()` without rebinding the shared wind uniforms. The real loop sets
`uWindTex`, `uBendTex` and `uSwayTex` from `wind.texture`, `wind.bendTexture` and `wind.swayTexture` after
stepping (`src/main.ts`, where it sets `u.uWindTex`). The ping-pong targets swap every tick, so without the
rebinding the synthetic draws alternate between current and stale spring textures. H rebinds all three after each
synthetic step, as the real loop does. This must land before item F's investigation and before any later gate
relies on the tool.

**Result (2026-09-24):**
- Repaired, with the wind rebinding, the re-bake hook and straddle flagging.
- With the wind textures rebound, skipping `wind.step` still saved 18.8% in Washing, all in the slow GPU state
  (pair baselines 25–28 ms).
- On the island it saved 9.8% in the fast state (baselines about 10 ms) and 20.0% in the slow state (22–26 ms).
  This is a lead for item F.

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
    height source (`heights-direct`, the item C passes) must re-run everything a window move re-runs, for **each**
    side of every pair, before capturing pixels. That means:
    - `bakes.bake`, then `bakes.bakeLight`;
    - `water.bakeShore(WINDOW.size)`, which derives waterline crossings from the heights (`src/main.ts`
      `onWindowMove`);
    - the grass tables: set `grass.tablesDirty`, then `grass.bake`. The tables consume heights and normals.

    Otherwise both sides share stale shadow, shore or blade data. This preparation is for correctness; keep it
    out of steady-state timing.
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
