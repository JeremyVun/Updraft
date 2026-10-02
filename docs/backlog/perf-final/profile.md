# Profile (2026-09-29 to 30, `main` at 8f70dd5 against 69af219)

Evidence for `design.md`. Tools on branch `perf-final-profile` (last commit e609173, worktree
`/private/tmp/updraft-pf-now`): stairs fixtures (`tools/lib/stairs-fixture.mjs`: `stairs:waiting|climb|loop|cloud|top|sail|fog`),
`deck-out` and per-family `deck-out-water|terrain|grass|sky|rest`, stairs part ablations, `water-lantern`, `water-hull`,
candidate skips (`sky-deckfirst`, `wisps-early`, `water-lantern-reach`), `SIM_PASSES=1`, `DETAIL` (weak-device world
detail), `tools/memory-census.mjs`, stairs fixtures in `audio-cost.mjs`. `sky-flat` had silently stopped biting (the sky
now adds the deck after its radiance); it is fixed and throws if its site moves. Raw data: `/tmp/updraft-pf-profile/`.

## Method

- `tools/frame-profile.mjs`, 1376×1032 page at device scale 2. High: `RATIO=1.5 MSAA=2 DRAIN=1 GPU_QUIET=1 QUIET=120
  ROUNDS=6 DRAWS=10 POST_PASSES=1`; each cell the median of 6 interleaved pairs (8 in candidate runs). 8f70dd5 (port
  5291) and 69af219 (port 5292) back to back per fixture, each with its own tool copy.
- Drained = wind step + sea reflection + scene + post, waiting for the GPU after each draw. Other per-frame passes timed
  alone (`SIM_PASSES=1`).
- Weak device: `RATIO=0.85 MSAA=2 DETAIL=0` (after the fixture, `applyWorldQuality({ratio, samples, detail: 0}, true)`:
  Low's grass 80%/85%, terrain split 1.1, reflection alternate frames, sky mirror 0.5), today's build only.
- No other GPU user during the census; heavy CPU-only system load throughout (`duetexpertd`, `spotlightknowledged`,
  `secd`, a VM, peers' checks). `none` read −2.5% to +6.8% per chapter, 0.9% weighted: treat under about 1% weighted as
  noise. `drowned` starts from different places in the two builds. Meadow fixtures are single loads.
- Not measured: energy (`powermetrics` needs sudo; `power-profile.mjs` is GPU throughput), a person's pace on the
  stairs puzzle (the bot docks each flight in one stroke, so its minutes are a floor), the Birches → stairs crossing
  (costed as the mean crossing), iPad numbers (drained frames here carry a fixed completion overhead that flattens the
  weak rows near 7.5 ms), readback buffers' use in the memory census. `stairs:fog` landed in slightly different states
  in the two runs.

## Minutes

The last pass's estimates plus one timed stairs run (`?chapter=stairs` into the village, real gestures, game time):

| Stairs moment | Game seconds | Minutes | Fixture |
|---|---:|---:|---|
| Ashore and the puzzle on the grass | 0–54 | 0.9 | `stairs:waiting` |
| Last flight below the cloud | 54–77 | 0.38 | `stairs:climb` |
| Penrose loop | 83–107 | 0.4 | `stairs:loop` |
| In the white | 77–83, 107–128 | 0.45 | `stairs:cloud` |
| On top before boarding | 128–203 | 1.25 | `stairs:top` |
| Sail over the cloud | 203–291 | 1.47 | `stairs:sail` |
| Fog bank and down | 291–314 | 0.39 | `stairs:fog` |

Stairs 5.2 min, the crossing to them about 0.4; playthrough 39.5 min.

## Per chapter (drained ms/frame; share = minutes × ms)

| Chapter | Min | Fixture | High ms | High share | Weak ms | Weak share | 69af219 ms | Growth |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| Island | 1.9 | island | 9.1 | 4.4% | 7.6 | 4.9% | 7.9 | +15% |
| Crossing to Washing | 1.6 | lines | 9.2 | 3.7% | 7.6 | 4.2% | 7.9 | +17% |
| Washing | 1.8 | washing | 8.7 | 3.9% | 7.5 | 4.7% | 7.6 | +13% |
| Crossing to Boats | 0.5 | lines+sea | 10.1 | 1.3% | 7.6 | 1.3% | 8.2 | +23% |
| Boats | 1.6 | boats | 8.9 | 3.6% | 7.6 | 4.1% | 7.9 | +12% |
| Crossing to Meadow | 0.7 | lines+sea | 10.1 | 1.8% | 7.6 | 1.8% | 8.2 | +23% |
| Meadow | 5.1 | meadow+walk | 9.3 | 12.0% | 7.4 | 13.0% | 8.2 | +14% |
| Crossing to Birches | 0.3 | lines+sea | 10.1 | 0.8% | 7.6 | 0.8% | 8.2 | +23% |
| Birches | 2.0 | birches | 10.1 | 5.1% | 7.8 | 5.3% | 8.7 | +16% |
| Crossing to Stairs | 0.4 | lines+sea | 10.1 | 1.0% | 7.6 | 1.0% | — | new |
| Stairs: grass and puzzle | 0.9 | stairs:waiting | 11.6 | 2.6% | 7.6 | 2.3% | — | new |
| Stairs: last flight | 0.38 | stairs:climb | 13.7 | 1.3% | 7.5 | 1.0% | — | new |
| Stairs: loop | 0.4 | stairs:loop | 10.2 | 1.0% | 7.3 | 1.0% | — | new |
| Stairs: in the white | 0.45 | stairs:cloud | 11.7 | 1.3% | 7.6 | 1.2% | — | new |
| Stairs: on top | 1.25 | stairs:top | 9.8 | 3.1% | 7.8 | 3.3% | — | new |
| Stairs: sail | 1.47 | stairs:sail | 10.8 | 4.0% | 7.9 | 4.0% | — | new |
| Stairs: fog | 0.39 | stairs:fog | 8.2 | 0.8% | 7.8 | 1.0% | — | new |
| Drowned (drift) | 1.8 | drowned | 9.3 | 4.2% | 6.3 | 3.9% | 7.7 | +20% (different start) |
| Wood | 2.5 | wood | 10.3 | 6.5% | 7.5 | 6.4% | 9.0 | +14% |
| Crossing to Sleeping | 0.6 | lines+sea | 10.1 | 1.5% | 7.6 | 1.6% | 8.2 | +23% |
| Sleeping | 3.3 | sleeping | 11.9 | 9.9% | 7.6 | 8.5% | 9.6 | +24% |
| Open sea to Mirror | 2.5 | sea | 11.0 | 6.9% | 7.6 | 6.5% | 8.6 | +28% |
| Mirror | 2.2 | mirror | 8.1 | 4.5% | 5.4 | 4.1% | 6.8 | +18% |
| Crossing home | 2.0 | lines+sea | 10.1 | 5.1% | 7.6 | 5.2% | 8.2 | +23% |
| Home | 3.5 | jetty+summit | 11.0 | 9.7% | 7.3 | 8.8% | 9.1 | +20% |

Weighted: High 10.0 ms (9.9 on the shared chapters, against 8.4 at 69af219); weak 7.4 ms. The scene pass alone grew
from 4.1–6.7 to 6.5–9.4 ms. Post is unchanged (MSAA clear and resolve 0.7 ms, bloom 0.45, grade 0.03).

## Components (weighted; ablations overlap)

| Component | High | Weak | 69af219 High | Highest (High) |
|---|---:|---:|---:|---|
| Sea shading (`water-frag-flat`) | 22.4% | 21.0% | 17.0% | Drowned 48%, open sea 41% |
| Grass | 13.5% | 16.7% | 15.8% | Meadow 26%, Home 24% |
| Post | 10.4% | 6.7% | 13.4% | Mirror 16%, Wood 15% |
| Terrain shading | 9.7% | 8.7% | 10.1% | Wood 23% |
| Cloud deck compiled in (`deck-out`) | 8.4% | 8.0% | — | 7–10% in nearly every chapter |
| Actors | 8.2% | 10.6% | 3.7% | Mirror 15% |
| Bloom | 7.8% | 5.2% | 9.9% | Wood 13% |
| Sky radiance | 5.4% | 3.8% | 8.7% | Mirror 15% |
| Stairs room | 5.4% | 5.9% | — | in the white 50%, sail 47% |
| Reflection pass | 4.3% | 4.4% | 5.1% | Mirror 23% |
| Wind step | 3.1% | 2.1% | 2.5% | Sleeping 6% |
| Stairs cloud top | 2.4% | 3.6% | — | sail 31%, top 29% |
| Birches room | 1.2% | — | 1.5% | Birches 24% |
| Haze / towers / wisps / steps | 0.9 / 0.8 / 0.8 / 0.4% | 0.5 / — / 0.6 / — | — | |

What grew on the shared chapters (weighted ms, total +1.56): sea shading +0.87, deck presence +0.87 (overlapping the
sea and terrain), actors +0.54, terrain +0.26, grass +0.19, wind +0.11, sky −0.19.

**The deck by shader family** (6 pairs each; ⁰ = no pixel changed):

| Fixture | All | Sea | Terrain | Grass | Sky | Rest |
|---|---:|---:|---:|---:|---:|---:|
| Island | 9.3% | 5.4% | 5.5% | 2.7%⁰ | 2.3%⁰ | 1.1%⁰ |
| Meadow walk | 9.1%⁰ | 1.0%⁰ | 7.8%⁰ | 3.5%⁰ | 0.9%⁰ | −0.1%⁰ |
| Open sea | 7.3% | 8.0% | −0.3%⁰ | 1.4%⁰ | 2.1%⁰ | 2.0%⁰ |
| Wood | 7.5% | 2.3% | 3.0% | 5.8%⁰ | 2.9%⁰ | 1.4%⁰ |
| Mirror | 4.6%⁰ | 1.2%⁰ | 0.1%⁰ | 1.0%⁰ | 1.2%⁰ | 1.1%⁰ |

Exactness (`ROUNDS=0`, static plus a 16-step camera path; island, sea, wood, sleeping, jetty): at most 1/255, except one
jetty path step with glint specks up to 21/255.

**The sea's new terms:** the boat's lantern glint and light (lit whenever the sun is below about 16°) cost island
1.6% (5.3% in another load), crossing 3.5%, sea 2.5–3.0%, jetty 2.5%, about 0 in the Wood and Meadow; they change up
to 170/255 where lit. Limiting the glint to its 9 m reach is exact and saves nothing (0.7, 1.8, 0.4, −0.4%): the cost is
the code's presence. The hull's wet collar is 3.2% at sea.

**Stairs parts** (percent of that fixture's frame):

| Fixture | ms | Room | Cloud top | Towers | Haze | Wisps | Steps | Bank | Underside |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Grass | 11.6 | 23% | 0⁰ | 0⁰ | 13% | 3⁰ | 5% | 2⁰ | 6⁰ |
| Last flight | 13.7 | 44% | 0⁰ | 0⁰ | 18% | 18% | 3% | 2⁰ | 1⁰ |
| Loop | 10.2 | 30% | 2⁰ | 0⁰ | 2% | 12% | 3% | 8% | 1⁰ |
| In the white | 11.7 | 50% | 19% | 0⁰ | 3% | 19% | 3% | 0⁰ | 0⁰ |
| Top | 9.8 | 44% | 29% | 9% | 3⁰ | 2⁰ | 3% | 2⁰ | 1⁰ |
| Sail | 10.8 | 47% | 31% | 14% | 3⁰ | 0⁰ | 2⁰ | 2⁰ | 1⁰ |

The cloud top (`stairs-cloud.ts`, a 7-level 129² grid, 116k vertices, never culled): fragment shading 13–14% of top
and sail frames, the low wisps (veil) 2–3%, the other 15–19% per-vertex work (`cloudTop`, four `bulkAt`, the deck fog,
`skyColor`) and rasterising. In the white, grass and terrain change no pixel; the sea's shading is 19–30% there
because every sea pixel recomputes `fogOf` with the analytic deck.

## Weak device: what doesn't shrink (weighted ms, High → weak)

| Component | High ms | Weak ms | Kept |
|---|---:|---:|---:|
| Whole frame | 10.0 | 7.4 | 74% |
| Grass | 1.35 | 1.23 | 91% |
| Actors | 0.82 | 0.78 | 95% |
| Sea shading | 2.24 | 1.55 | 69% |
| Deck presence | 0.84 | 0.59 | 70% |
| Terrain shading | 0.98 | 0.64 | 65% |
| Reflection pass | 0.43 | 0.33 | 77% |
| Stairs cloud top | 0.24 | 0.27 | ~100% |
| Sky | 0.54 | 0.28 | 52% |
| Post | 1.04 | 0.49 | 47% |
| Bloom | 0.79 | 0.38 | 48% |

Passes alone, the same at both settings: wind step 0.33–0.43 ms; life, clouds, petals, waves 0.02–0.06 ms each (waves
0.19 in the cloud); light bake 0.6–0.9 ms (2–3.7 at dusk), 0–0.07 per frame amortised; bloom's 12 passes 0.43–0.56 ms
High, 0.27–0.43 weak; script submission 0.4–0.6 ms.

## Auto's last rung against a 30 fps Low rung (costed only)

| Fixture | High | Low | Last rung | Wind step | Last rung at 60 fps (ms/s) | Low at 30 fps (ms/s) | Difference |
|---|---:|---:|---:|---:|---:|---:|---:|
| Island | 9.1 | 7.6 | 6.9 | 0.34 | 411 | 237 | −42% |
| Meadow walk | 9.6 | 7.6 | 7.1 | 0.33 | 424 | 239 | −44% |
| Open sea | 11.0 | 7.6 | 7.2 | 0.35 | 431 | 238 | −45% |
| Sleeping | 11.9 | 7.6 | 7.4 | 0.34 | 443 | 237 | −47% |
| Wood | 10.3 | 7.5 | 6.4 | 0.35 | 382 | 235 | −39% |
| Stairs sail | 10.8 | 7.9 | 8.0 | 0.35 | 479 | 246 | −49% |

At 30 fps the wind still steps 60 times a second (one extra step per frame counted); the world script halves, the
wind and its readback do not. The Mac's fixed completion overhead probably understates what the last rung saves on a
truly GPU-bound device.

## CPU (script median/p90 ms, draw calls; today against 69af219)

| Fixture | Today | 69af219 | Draw calls | Largest items today |
|---|---:|---:|---|---|
| Island | 1.6/2.0 | 1.5/2.3 | 80 vs 89 | child 0.29, wind 0.14 |
| Crossing out | 2.0/2.6 | 1.8/2.4 | 94 vs 103 | cygnet 0.32, child 0.29 |
| Washing | 2.3/2.8 | 2.1/2.5 | 71 vs 83 | creatures 0.60, child 0.35 |
| Boats | 2.0/2.5 | 1.9/2.4 | 133 vs 145 | child 0.35, cygnet 0.31 |
| Meadow landing | 1.9/2.4 | 1.6/2.1 | 71 vs 83 | cygnet 0.32, child 0.28 |
| Meadow walk | 2.3/2.9 | 2.1/2.5 | 91 vs 100 | meadow creatures 0.56, cygnet 0.30, child 0.25 |
| Birches | 3.5/3.9 | 3.3/3.7 | 92 vs 97 | scarf 1.9 (unchanged), child 0.25 |
| Stairs moments | 1.2–2.1 / 1.6–2.8 | — | 68–87 | cygnet 0.16–0.34, child 0.14–0.31, village 0.09–0.22 |
| Drowned | 2.0/2.2 | 1.6/2.0 | 75 vs 93 | cygnet 0.23, child 0.21, village 0.15 |
| Wood | 2.1/2.6 | 1.9/2.4 | 75 vs 78 | cygnet 0.33, child 0.24 |
| Sleeping | 2.0/2.5 | 1.9/2.5 | 99 vs 105 | cygnet 0.31, child 0.28 |
| Open sea | 2.3/2.7 | 1.9/2.3 | 134 vs 144 | child 0.26, wind 0.16 |
| Mirror | 2.2/2.6 | 1.9/2.5 | 220 vs 231 | child 0.31 |
| Jetty | 1.8/2.2 | 1.5/2.1 | 75 vs 81 | child 0.32 |
| Summit | 1.7/2.3 | 1.7/2.4 | 68 vs 76 | child 0.35, boat 0.10 |

Weighted script rose from 1.91 to 2.13 ms/frame, almost all the rebuilt child: `pose` 0.17, `motion.update` 0.16
(`secondary` 0.12, of which `hemClear` 0.11), scarf 0.09. The drowned village updates through the whole stairs
chapter: its rest test is the boat's z-distance, and the stairs landing sits inside that band.

## Audio (renderer CPU ms per wall second, sound on minus muted)

Island 86, stairs grass 118–143, stairs loop 113, stairs top 128, stairs sail 127, open sea 94. The stairs cost 25–50
ms/s more than the island or the sea: the Birches phrase keeps playing, plus the stairs' own air (49 live oscillators
during the sail, with the stairs score). The stairs air re-targets its six noise layers every frame
(`StairsSound.set`); the shared layers avoid that through `Soundscape.fade`'s hold. Holding them saved nothing
measurable with the pointer circling (−16 to +14 ms/s) and 1–11 ms/s with it still. The island's group cuts were within
noise in this run.

## Graphics memory (`tools/memory-census.mjs`)

| Setting, chapter | Total | Not touched in 120 frames |
|---|---:|---:|
| High, island | 341 MiB | 99 MiB |
| High, Meadow walk | 285 MiB | 43 MiB |
| High, open sea | 307 MiB | 39 MiB |
| High, stairs sail | 338 MiB | 94 MiB |
| Low, island | 233 MiB | 99 MiB |
| Low, Meadow walk | 177 MiB | 43 MiB |

Largest owners at High [Low]: scene target 109.7 MiB [35.2] (MSAA colour 48.8, resolved colour 24.4, MSAA
depth-stencil 24.4, resolve depth-stencil 12.2); `post.clean` 24.4 [7.8]; bloom chain 22.3 [7.2]; grass tables 33.2
(reserved for every level); static atlases 25.4; stairs geometry and textures 56.4, the standing mesh alone 38 MiB (787k
non-indexed vertices with float colour, part and mist attributes); shore target plus two RGBA32F seed targets 10.0 (the
seeds, 8 MiB, idle between window moves); sea reflection 25.1 near the sky mirror at 0.75 scale, otherwise 2.8;
readback buffers 8.9; the canvas drawing buffer about 36 MiB, including a 12 MiB depth buffer nothing uses (created
with `depth: true`, but only the grade quad draws to the screen).

About 150 MiB does not change with settings (grass tables, atlases, bakes, sims, room geometry). Geometry uploads on
first draw, so the stairs' 49 MiB of buffers are resident from the stairs on (and on the island, because warm-up draws
them). The scene target now has a stencil (the boat's waterline): Depth32Float_Stencil8 on Apple GPUs.

## Phase 7: more effects to switch off (2026-10-03, `main` at 13f8b13)

A survey for Jeremy; nothing here is built. Tools: `tools/frame-profile.mjs` (branch `perf-final-p7`) gains the
candidates as ablations and levers (`cloud-shadow-off`, `sky-bank`, `sky-detail`, `grass-fog-root`, `grass-near-<f>`,
`grass-near-5seg`, `rt-r11`, `deckless-`, `fragflat-` and `bones-frozen-`/`bones-early-<child|cygnet>`, `uploads-mid`),
`FRAME_PASS` and `PASS_VARIANTS`; `tools/upload-census.mjs` is new.

### Method

- Low: `RATIO=0.85 MSAA=2 LEVEL=low`; Medium: `RATIO=1 MSAA=2 LEVEL=medium`; `GPU_QUIET=1`. 1376×1032 page at device
  scale 2.
- **Whole-frame pairs were unusable this time.** Other projects ran GPU work throughout (an Android emulator, two
  builds of a game, Brave, Metal's shader compiler): drained pairs read `none` at 1.1% and 11.3% at the island and
  straddled at every fixture. So every candidate is timed with `FRAME_PASS`: the whole frame but the wind step
  (reflection, scene, post) drawn back to back 30 times and drained, the baseline and each candidate in ABBA order
  over 30 to 60 rounds, the saving the median of each round's paired difference. `none` read −1.5% to +1.9% per
  fixture (0.3% weighted) with interquartile ranges of ±1 to ±4% (±10% in one sleeping run): treat under about 1%
  weighted, or 3% in one room, as noise.
- A throughput frame has no completion overhead and no wind step, so its milliseconds are smaller than the drained
  frames above (weighted Low frame 5.1 ms here against 7.4 ms drained in the census) and inflated by whatever else
  ran. Percentages are the robust figure; milliseconds are each percentage times the quietest frame seen at that
  fixture.
- Isolated passes where they apply (`POST_PASSES`, `REFLECTION_PASS`, `WATER_PASS` with `PASS_VARIANTS`).
- Weighted by the minutes above (39.5): crossings are the mean of `lines` and `sea`; `stairs:waiting` stands for all
  2.5 minutes of the stairs below the cloud (waiting, last flight, loop, in the white, fog), `stairs:top` and
  `stairs:sail` for theirs. Room-specific candidates count only where they apply (the mirror's reflection on the
  crossing to it, the mirror merge in its room, the sea above the stairs' cloud at the top and the sail, the sea
  under land beyond the window at home).
- Stills at Low (the level where each would first apply), the frozen frame drawn with and without the candidate;
  `/tmp/updraft-pf-p7-shots/`.

### Ranked list for Jeremy

Ranked by the saving weighted by minutes at Low (the weakest level), with Medium beside it. ms are on this Mac
(throughput frame, about 5.1 ms weighted at either level under the other load), so read the percentages. "Every
level" means it would change Ultra and High too. Stills: before | after, in `/tmp/updraft-pf-p7-shots/`.

| # | Candidate | Level | Low, weighted | Medium, weighted | Largest room | On screen | Still | Verdict |
|---|---|---|---:|---:|---|---|---|---|
| 1 | Grass fog worked out once per blade (at its root) instead of at every vertex | Medium and Low; every level if wanted | 4.5% (0.28 ms), upper bound | 4.4% (0.24 ms) | Sleeping 10.5% (Low), summit 11.1% (Medium) | Nothing visible: at most 4/255 on 9 pixels | `grass-fog-blade-meadow.png` | **Recommend.** The real saving is a little under the bound: a small per-frame pass works the fog out per blade (1 blade per 9 to 13 vertices) |
| 2 | The child's bone texture uploaded before the frame's passes instead of in the middle of the scene pass (exact) | Every level | +4.0% (0.18 ms), but −11.7% on top of the stairs and −7.6% on the sail | +2.0% (0.09 ms), −1 to −2% in five rooms | Summit 10.5% (Low), mirror 13.1% (Medium) | Nothing (pixel for pixel) | none needed | **Not yet.** Real but its sign depends on the room (see below); measure on the iPad before building |
| 3 | The near grass level ends 25% sooner (the quarter-density middle level takes over at 39 m, not 52 m) | Medium and Low | 4.0% (0.23 ms) | 3.7% (0.20 ms) | Washing 12.5% / 11.3% | The middle distance of every meadow visibly thinner and softer | `grass-near-reach-meadow.png`, `grass-near-reach-washing.png` | **Do not recommend:** it is the grass thinning Jeremy has ruled against |
| 4 | Near blades drawn with 5 segments instead of 6 | Low | 3.2% (0.19 ms) | 1.7% (0.10 ms), in noise | Summit 7.1% / 6.7% | The same meadow at a glance; at 2× single blades bend a little differently (no blade lost) | `grass-near-5seg-meadow.png` (2× crop) | **Maybe, Low only:** Jeremy's eye on the still decides |
| 5 | Scene, resolve, `post.clean` and bloom targets as `R11F_G11F_B10F` instead of half-float RGBA | Every level (look identical) | 2.9% (0.12 ms); MSAA clear+resolve alone 0.25–0.28 → 0.11–0.13 ms | 4.8% (0.25 ms) | Mirror 5.3% (Low), drowned 10.6% (Medium) | Nothing visible: at most 3–5/255, no banding in the night sea, the Wood or the stairs (the grade's grain hides the steps); about −16 MiB at Low, about −60 MiB at Ultra | `rt-r11-night-sea.png`, `rt-r11-night-sea-crop.png`, `rt-r11-wood.png`, `rt-r11-stairs-top.png` | **Recommend**, at every level (Medium and Low at least) |
| 6 | The sea without its ripples | Medium and Low | 2.7% (0.11 ms); sea pass alone −0.18 to −0.20 ms | 4.0% (0.20 ms) | Open sea 7.9%, stairs below the cloud 8.8% | The sea goes glassy: the sun's track turns into a smooth streak | `sea-ripples-off.png`, `sea-ripples-off-crop.png` | **Do not recommend:** a large visible loss |
| 7 | Sky clouds shaded from one noise octave (includes #9) | Medium and Low | 2.1% (0.09 ms); the look part alone 0.9% | 3.4% (0.17 ms); look part 0.9% | Mirror 6.7% (Low), open sea 5.7% (Medium) | Clouds lose their lit/shaded modelling and shift shape | `sky-detail-summit.png`, `sky-detail-sea.png` | **Do not recommend:** take #9, which is most of it |
| 8 | No cloud shadows (full sun everywhere) | Medium and Low | 1.2% (0.06 ms) | 1.7% (0.09 ms) | Washing 3.5% (Low), stairs below the cloud 5.6% (Medium) | Land brighter and flatter; the drifting shadows go | `cloud-shadows-off-washing.png` | **Do not recommend:** visible for a small saving |
| 9 | The sky's storm bank skipped while there is no storm and no lightning (exact) | Every level | 1.2% (0.06 ms) | 2.6% (0.13 ms) | Summit 4.4% (Low), jetty 4.7% (Medium) | Nothing (0 pixels at the island, 1/255 on 3 channels at the crossing) | none needed | **Recommend** as a free win (one `fbm` per sky and fog ray skipped behind `uStormCover`/`uLightning.w`) |
| 10 | Sea and terrain not drawn above the stairs' cloud during the top and the sail | Every level | 1.1% (0.055 ms): top 13.3%, sail 19.3% | 1.7% (0.10 ms): top 20.4%, sail 28.2% | Sail | Nothing visible at either fixture (at most 2/255) | `stairs-top-no-sea.png`, `stairs-sail-no-sea.png` | **Recommend, behind a check along the whole top and sail** (phase 3: nothing yet proves it hidden; its worst was 3/255 at the deck's frayed edge). Fits "no loss of visual quality" |
| 11 | The sky mirror's reflection at the ordinary sea's size and cadence until near the flat | Every level | 0.2% (sea 3.1%); the pass alone 0.57–0.60 → 0.40 ms each time it is drawn (alternate frames at Low) | 0.9% (sea 13.6%) | Crossing to the mirror | Phase 3b-i: up to 27/255 on sea pixels | none: a frozen-frame capture reuses the last reflection, so both sides matched | **Maybe, Medium and Low:** worth it only on that 2.5-minute crossing; needs a still from a running capture |
| 12 | The sea returning early under land beyond the window | Every level | 0.3%, upper bound (jetty 4.0%, summit 3.7%) | 0.7% (summit 10.0%) | Home | Not exact (would need the distant atlas and a waterline guarantee) | none: the bound paints the far sea black | **Do not recommend now:** a build for under 1% weighted |
| 13 | Sea glints off | Medium and Low | 0.7% | — | Summit 2.0% | — | — | **Do not recommend** (under 1%) |
| 14 | Child's mesh simplified when small on screen | Every level | Under 0.9% in any room (her whole cost minus the bone upload and her shading) | — | — | — | — | **Do not recommend:** her triangles are not what costs (see below) |
| 15 | Wind and life readbacks every other frame | Every level | CPU 0.09–0.11 ms a frame (readbacks are 0.18–0.23 ms, `getBufferSubData` 0.12–0.19) | same | — | A feel change: wind under the pointer reaches the piano, curtains and embers a frame later (33 ms at Low) | none (feel) | **Do not recommend** |
| 16 | Creatures reading the baked height copy | Every level | CPU 0.02–0.06 ms (phase 1b) | same | Washing, Meadow | Animals move by centimetres | none | **Do not recommend** (too small) |
| 17 | Petals and small flying effects (petals, wind lines, starlings, flock, fireflies) hidden | Medium and Low | −0.02% (nothing) | — | — | — | — | **Do not recommend** |
| 18 | The sky mirror's pieces merged | Every level | 0.15% | −0.04% | — | Phase 3b-i: single pixels up to 7/255 | — | **Do not recommend** at these levels |

Upper bounds costed but not proposed, because nothing cheaper is defined: the boat hidden 1.4% (Low) / 1.9% (Medium),
open sea 5–6.6%, and a flat-coloured boat saves as much, so its cost is its shading of the player's own boat; the
cygnet hidden 2.9% / 1.7%, her shading under 2%. Deck-free programs for the child, cygnet and boat (exact) read
0.3% weighted, in noise: not worth a variant axis (each costs boot time).

### What the census showed

- **The child costs 5–16% of every Low frame** (island 6.9%, crossings 11%, open sea 14.5%, mirror 16.4%, summit
  14.3%) though she covers 800 to 9,000 pixels. Split at four fixtures (50 rounds, a quiet run): her bone texture's
  upload 3–8%, her fragment program 2–7%, her mesh 0.7–0.9%.
- **The bone upload:** `tools/upload-census.mjs` finds one texture write in the middle of a pass in every room: three
  re-uploads the child's bone texture (her `SkinnedMesh`, 26,478 vertices) at her first draw in the scene pass, and
  again in the reflection pass. Buffer writes mid-pass (the scarf, kites, the plane) cost nothing measurable
  (`uploads-mid` 0.4–1.2%). Uploading the bones before the frame (`bones-early-child`) is pixel for pixel and saves
  2–9% in most rooms, but costs 12% on top of the stairs and 8% on the sail at Low (Medium: −1 to −2% in five rooms):
  with the stairs' cloud top hidden, frozen bones save again (+1%), so the mid-pass upload's split of the pass is what
  relieves the cloud top (most likely the tiler's parameter buffer overflowing on its 116k-vertex grid). On the Mac
  this is net +4.0% at Low, +2.0% at Medium. Its sign may differ on the iPad's GPU; measure there first. It also
  shows the cloud top alone is 44% of a Low frame on top of the stairs (`stairsCloudTop`).
- **Her fragment program:** a flat colour in its place saves 2–7% though she is small on screen; per-pixel arithmetic
  cannot explain that (likely the program's size and latency). A lead for a closer look, not a look change.

### Not measured

- A still for #11 (see the row); stills for #2 and #9 (exact) and #14–18 (not proposed or no picture).
- `stairs:climb`, `loop`, `cloud` and `fog`: their 1.6 minutes are weighted with `stairs:waiting`'s numbers.
- iPad numbers; frame-time spikes; energy.

### What phase 5b could move

5b thins the wisps and haze at Medium and Low. Below the cloud (`stairs:waiting`, standing for 2.5 minutes) the haze
and wisps were 13–37% of the frame in the census, so 5b shrinks that frame and raises every candidate's percentage
there: ripples (8.0% Low, 8.8% Medium), cloud shadows (2.6%, 5.6%), the R11F targets (3.7%, 4.9%), the near grass
(#3, #4) and the child's bones (2.4%, −2.1%). On top of the stairs and the sail the wisps and haze were 0–3%, so #10
(13.3–28.2%) barely moves (it would rise slightly).
