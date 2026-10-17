# Village fog diagnosis — 2026-10-17

Diagnosis followed by a verified, scoped fix for the abrupt cloud-to-village handoff. The separate village mist
appearance and later bank-to-haze styling remain outside this patch.

## Jeremy's brief (verbatim)

> There's an issue with the fog / haze in the drowning village chapter. It's most noticeable when the child transitions out from the clouds chapter into the village chatper - there's a very noticeable change in the style of the fog that gets rendered. Can you take a look and figure out the root cause? I think it's because the fog shader being used in the village chapter is different and not that great. Infact, even during the village chapter, the fog looks really bad, especially noticeable on the horizon.

> and were you able to reproduce the problem in transitioning between the cloud chapter and the village chapter like i asked as well?

> what do you mean only partially? did you not even bother? it is incredibly important that you not be lazy

> good work, whats the root cause? There was a time when the transition was smooth and this didn't happen

> ok great, whats the fix? can you fix it simply without causing a regression issue, and then check those frames again to ensure it's fixed?

> cool, commit. Next i need you to help figure out if there's a cheap way to make the village fog look better

## Cheap village-fog study — 2026-10-17

The transition repair is committed as `4a2bf422`. The appearance study uses a detached worktree at that commit
and QA-only Vite transforms under `/tmp/updraft-village-fog-study-pEuyC9/`. No village appearance changes have
been applied to the main checkout. The analytic density, coverage, progression and clearing calculations stay
unchanged in every prototype.

### Smallest promising treatment

1. Match the distant ordinary haze to the sky. Its existing `skyColor` call samples a slightly elevated direction
   and multiplies the result by `(0.84, 0.87, 0.92)`. In the village, blend that direction toward the actual ray and
   its multiplier toward one between 200 and 900 metres. This removes a separate dark sea/sky seam without
   adding another sky evaluation or changing haze opacity. The prototype uses `uSeaFogShape.w`, so this does
   not address the earlier arrival haze while the village mist is inactive.
2. Replace the mist's constant colour with a brighter upper layer and cooler depth, a directional sun term, and
   a gradual colour blend toward the horizon. The study estimates the visible mist point from the existing
   top/front planes; the horizon blend spans 30–160 metres from the eye. It is an approximation to lighting,
   not a new density integration. A first 140–650 m blend was too narrow on screen to improve the seam.
3. Keep that horizon colour blend during closure. The first prototype weakened it by `1 - close * 0.75`, which
   left a hard night edge. Removing that factor improves the fully closed and partially closed comparison;
   the sky palette already supplies the darkening. Nearby fog remains dark.

The optional fourth part adds two broad value-noise samples to the lighting. It gives some soft shading variation,
especially above the fog at the belfry, but the main improvement comes from the light gradient and horizon match.
The recommended first implementation is the treatment without noise. It adds no rendering pass, texture,
geometry or marching loop. It retains the existing fog cache. Its performance measurement is recorded below.

This still has the original flat density layer. Lighting makes it less like a uniform sheet; it does not give it
the cloud chapter's rolling silhouette. Changing that shape would also change what the mist conceals and needs
a separate full-route review. Do not restore the discarded expensive ray marcher as a shortcut.

### Visual evidence and limits

- `v3/results.json`: frozen, seeded frame 120 at the roofs, church, belfry, portrait belfry and closed belfry.
  Each compares original, ordinary-haze match alone, lighting plus haze, and lighting plus haze with noise.
  All five original → variants → original round trips are pixel-identical, with no browser errors.
- The belfry's left background strip (`x=35..349`, `y=340..389`) has a maximum adjacent-row mean RGB step
  of 11.314/255 originally, 4.639 for the ordinary-haze correction alone, and 1.583 for lighting plus haze.
  Adding noise gives 1.584. This is a local seam measurement, not a general image-quality score.
- Inspected the frozen comparisons and diagnostic camera offsets: two metres sideways with a 0.1 radian yaw,
  and two metres above/below the original camera, at the roofs and belfry. These are still-image checks,
  not a video motion review or a continuous gameplay/controller test.
- `night/results.json`: an additional comparison at `fog=1` and `fog=.6` confirms the full horizon blend avoids
  the first prototype's stronger night seam. `night/closed-8.png` and `night/closing-8.png` are that revision.
  Daytime mode 7 is unchanged by this revision because `close=0` there.
- `measured.json`: the half-float optical-depth channel is bit-identical for the lighting and noise variants
  against original in all 1,146,880 texels of each roof, belfry and church main-camera fog cache. The shader's
  density function is unchanged. This does not replace a gameplay review of how changed colour affects legibility.
- The light-point estimate does not yet account for the side edges or church clearing when choosing its colour
  sample. Before landing, review consecutive moving-camera frames, the advancing bank, all bell clearings,
  reflections, closure and departure; verify cloud arrival and unaffected chapters against a separate build.
  Mobile performance and full-frame cost remain separate from the local cache measurement.

`build.mjs` contains the isolated shader transform, `lighting-prototype.glsl` the lighting helper,
`study-v3.mjs` the five-view capture, and `night.mjs` the final closure-colour comparison. The QA build uses
`envDir:false`. In a production patch, derive the study's hard-coded top/front constants from existing tuning,
remove all study switches, and keep the density calculation unchanged.

### Performance measurement

`batches.json` and `batch-summary.json`: Apple M4 Pro, Chrome for Testing through ANGLE Metal, exclusive browser
GPU gate. Each cell below is the median of six GPU-timed batches of 128 cache bakes, with balanced variant order
and warm-up draws. Values are milliseconds per main-camera cache bake, not per complete game frame.

| View | Original | Lighting | Lighting + noise | Added lighting cost |
| --- | ---: | ---: | ---: | ---: |
| Roofs | 0.561 | 0.582 | 0.662 | 0.021 |
| Belfry | 0.444 | 0.470 | 0.540 | 0.026 |
| Church | 0.534 | 0.604 | 0.742 | 0.070 |

The no-noise treatment adds approximately 0.02–0.07 ms to these median bake measurements. Adding noise takes
the total overhead to approximately 0.10–0.21 ms. This supports omitting the noise in a first implementation.
The cache is 1280×896 with 64 depth slices; no extra pass or texture is added. The ordinary-haze correction
outside the cache reuses the existing sky-colour call, but its full-frame cost was not separately measured.

There are initial outliers (for example, two roof lighting batches at 0.925 and 0.949 ms); these are feasibility
measurements, not a guaranteed timing budget. Initial whole-frame samples included variant compilation;
individual-draw GPU queries produced strongly order-dependent timing ramps. Neither is used for the cost claim.
The recorded wall-time fields measure submission and do not establish GPU completion on this browser; use the
asynchronously retrieved GPU-query results. Reflection-camera cost and physical-device/mobile performance
were not measured. All final measurement runs report no browser errors and identical optical-depth readbacks.

## Transition fix plan — 2026-10-17

Preserve the existing bank shader, cloud appearance before descent, village route and reveal timing. Carry the
bank's texture height and lighting heading through the hidden relocation, preserve its vertical extent, and
move the camera point used by the clear pocket in the same update. The broader village mist appearance is
separate from this scoped continuity fix.

Verify the shared shader's response to rigid relocation, rerun the complete unchanged cloud checkpoint through
arrival with every transition frame retained, and inspect the cut and subsequent clearing. Compare unaffected
cloud/village views against a separate baseline worktree/build. Run typecheck, build and focused fog checks.

The initial seeded, sparsely sampled test was insufficient. A subsequent full replay from the unchanged cloud
checkpoint reproduced an abrupt defect it missed. The corrected findings and complete replay evidence follow.

### Implemented fix and verification

- `FogBank.frame` carries the pre-descent texture height and sunlight heading. The shader samples the same
  streaming pattern and directional light on both sides of the rigid move; its vertical slab moves by the actual
  hull height change, including the cloud swell.
- The authored camera point used by the clear pocket moves with the hull in the same update. `CameraRig.relocate`
  also carries the rendered camera and look point through that transform instead of snapping to its eased target.
  Only the stairs' existing hidden cut supplies this transform.
- The existing bank thickens over the last twelve metres before descent, covers the sail's hidden change of side,
  and returns to its normal density during the first three seconds on the sea. The fifteen-second reveal and
  village route are unchanged. Cloud shadow attenuation saturates at full coverage when density exceeds one.
- A first complete patched replay retained 3,434 consecutive frames and reduced the cut's background difference
  from 12.233 to 3.266 channel values out of 255. It was rejected: the residual camera snap and sail flip remained
  visible. The final camera/density changes above were added after inspecting those exact frames.
- Final production build, typecheck, shader bounds and camera direction checks pass. The fog probe passes 18
  near-coverage cases and 18 relocation cases at densities 1 and 3.5: maximum RGBA relocation error 0.00000287,
  minimum uncarried negative-control error 0.05888. Existing stairs haze coverage checks also pass.
- The final landscape (1600×900) and portrait (900×1600) replays both complete the unchanged cloud checkpoint
  through eight seconds of village arrival. Each retains all 3,434 consecutive frames, 11187–14620, with no
  browser errors. Both descend at frame 13240 and enter the village at 14140, matching the original replay.
- The landscape cut's full-frame mean RGB difference falls from 11.8257 to 1.0783 out of 255; the immediately
  preceding/following differences are 0.9334 and 0.9422. These numbers use the original 160×90 pre-JPEG probe.
  Portrait is 1.4526 at the cut versus 1.0831 and 1.0777 on its neighbours. There is no original portrait replay
  for a before/after numerical claim.
- In the saved landscape JPEGs, the same background side strips fall from 12.2331 to 1.3314 mean channel
  difference; pixels changing by more than eight in any channel fall from 80.645% to 0.00654%. The fog pattern
  and light remain continuous in the inspected adjacent frames. The sail is reduced to a faint silhouette.
- Inspected six adjacent cut frames in each shape, the subsequent clearing sequence, and the three adjacent
  chapter-entry frames. Ranking every adjacent-frame difference finds no relocated large spike during the
  clearing: after its first 0.1 s, its largest landscape difference is 1.8276. The later village camera movement
  reaches 3.5795, comparable to the original replay's 3.5434 at that same frame, rather than a new handoff defect.
- Unaffected-view comparisons against the separate baseline build pass. The final belfry and turned cloud view
  are pixel-identical. The first patch's six checks (drowned, stairs, belfry, roofs, close/turned stairs) had maximum
  mean difference 0.0256/255 and at most 0.150% of pixels changing by more than eight, with unchanged camera and
  character states. The final additional changes apply only around the hidden descent.

This is full gameplay replay, continuous frame capture and still-image/state inspection, not video motion review
or a performance measurement. It verifies the abrupt handoff fix; it does not establish that the village's later
flat mist has been improved. No deployment was made, and unrelated checkout edits were preserved.

Fix evidence and frozen artifacts: `/tmp/updraft-fog-fix-bZXNW7/`. `before/` is a separate worktree at `de334914`
with the pre-existing source edits applied from `uncommitted-src.patch`; `before-build/site/` is its frozen QA
build. `after-v1/` retains the rejected first replay. `after-v2/site/` contains the final patch, and the final
replays are in `after-v2/` and `portrait-v2/`. `run-pair.mjs` runs both normal journeys in one browser with a shared
exclusive GPU reservation, following a long wait for other sessions' timing checks. `review.json`, `frames.json`,
`trace.jsonl` and `errors.json` retain the results; `review.py` and `analyse.py` reproduce the metrics and contact
sheets. `transition-comparison.jpg`, `portrait-v2/cut-sequence.jpg` and `after-v2/arrival-sequence.jpg` were opened
in Preview. The only later edit to the fog patch's source is a clarification of the `uFogBankEye` comment;
shader behavior is unchanged from the recorded build hashes.

## Findings

There are three distinct changes: a one-frame fog-pattern/light jump at the hidden descent, the subsequent cloud
bank fading into ordinary distance haze, and the village's later flat sea mist. The first two occur with village
sea fog disabled by the story. The village mist uses a different visual model; its flat appearance survives
bypassing the fog cache.

### Regression history

Git history separates new handoff behaviour from older defects. This is source-history attribution, not a
visual bisection establishing the last smooth archived build.

- **October 9, `903842b0`: village arrival rerouted.** Previously the descent translated the hull, camera and
  bank while retaining the boat's heading. This commit moved the destination from `(16, -1254)` to
  `(1.555, -1408.19)` and added the immediate rotation to `DESCENT_YAW = -3.0741`, about 51.9 degrees in the
  captured voyage. It rotates the bank's origin/direction and the camera's voyage heading, but not the fog's
  lighting reference. The large instantaneous change in view-relative sunlight is newly introduced by this
  reroute. It landed in main with the village merge `7c66739b` on October 11.
- **October 9, `b8a79484`: the sail-side change added at the same hidden cut.** The sail is mirrored during
  the cloud voyage to expose the bird, then switched back inside `downOntoTheSea`. The replay shows the
  boat is still visible there. This commit also corrects the ordering of cloud mist and ordinary haze, so
  `fogOf` as a whole has changed even though the bank's own shader has not.
- **The bank shader and fade are unchanged across the reroute.** Extracting the complete `fogBank` function
  and `StairsChapter.mistBank` method from `903842b0^` and the pre-fix source gives byte-identical bodies.
  The handoff changed around them. The absolute-height streaming noise dates to September 28, `12c921f9`;
  the stale camera in the clear-pocket midpoint also predates the reroute. Those older problems must not be
  presented as newly introduced on October 9.
- **October 10–11: village fog replaced for performance.** `95baa003` introduced the cheaper analytic mist
  trial; `c47ca45e` replaced its camera-dependent approximation with a world-space density field. On October 11,
  `79c8c621` removed the old marched renderer and made the mist the only production/QA path. The original
  renderer had noise-shaped billows and changing light through its depth. The replacement's flat main layer
  and nearly constant lighting account for the style/horizon difference. The October 10 notes explicitly
  record that it looked flatter and less billowy (`design.md`, “Rescue pacing and cheaper mist”).
- **October 11 cache experiment is not the present cloud path.** `4af9bfa8` cached both fog systems, but
  `a9f14d51` reverted cloud caching after a motion regression. Current cloud fog is direct analytic rendering;
  only village mist remains cached. The current arrival defect cannot be blamed on the reverted cloud atlas.

The root handoff assumption was that moving the bank with the boat/camera preserved its appearance. It does
not preserve world-height texture sampling or view-relative sunlight, and the added rotation creates a new
lighting discontinuity. Separately, the later village renderer really was replaced with a visually simpler one.

### Hidden descent: an actual one-frame discontinuity

The full natural replay enters `stairs:thin` at game frame 13240 (220.667 seconds after the cloud checkpoint).
Frames 13239 and 13240 visibly differ across the fog background; the sail also flips while still visible.
This is 15 seconds before `drowned:enter`, not a switch to the village mist shader.

`StairsChapter.downOntoTheSea` (`src/story/stairs.ts`) translates the boat down to sea level, turns it about
51.9 degrees, carries the bank's horizontal origin/direction, and requests a camera cut. The bank's coordinate
system is not preserved completely:

- The interior `streaming` noise in `fogBank` (`src/world/atmosphere.ts`) uses absolute `ro.y + rd.y * distance`,
  unlike the face's height relative to the bank floor. Camera height drops from 37.754 to 3.421 m in one frame.
  The two vertical noise arguments therefore jump by roughly 24 and 10 noise units. The fog pattern changes
  even though its horizontal coordinates were carried along with the boat.
- Lighting uses `dot(rd, uSunDir)`. The view rotates with the boat, but the world sun stays in place. The central
  ray's sun dot product drops from 0.9763 to 0.6569. Both the interior light multiplier and strong forward halo
  change immediately. `uFogBankLight` itself is identical on the two frames; the intended dusk-colour fade has
  not started yet.
- The clearer pocket also has a one-frame mismatch. `cloud()` computes its midpoint from the relocated hull
  and the previous camera eye before the new camera shot is applied. On the cut frame its centre is
  `(-71.45, 2, -1422.49)`; the next frame it is `(3.38, 1.92, -1358.05)`, back round the boat. Its radius is 9.6 m.
  It therefore stops clearing the boat on the cut frame. This is a separate transient within the same handoff.

The actual rendered cut is confirmed. The individual contributions above follow from the captured uniforms and
shader/controller code; they have not been apportioned by separate full-render ablations.

| Boundary | Game frame | Mean frame change, RGB 0–255 |
| --- | ---: | ---: |
| Last ordinary step before descent | 13239 | 0.928 |
| Hidden descent, `fog` → `thin` | 13240 | 11.826 |
| Next step | 13241 | 1.846 |
| Chapter changes to `drowned:enter` | 14140 | 2.049 |

These measurements use the 160×90 readback before JPEG encoding. In the saved 1280×720 images, background-only
side strips excluding the boat also change substantially; this is not merely the visible sail flip.
The cut is the largest whole-frame change in the entire 3,434-frame capture.

### Arrival: textured cloud bank to ordinary haze

- `StairsChapter.mistBank` (`src/story/stairs.ts`) carries the cloud bank onto the sea, changes its colour from
  warm cloud light to lilac dusk between 1.2 and 5.5 seconds, brings its rear edge through the boat/camera, and
  reduces its density from 9.75 to 15 seconds (`fogLift = 15`). Two effects remove its visible cover together:
  the shrinking volume and falling density. The complete replay confirms a marked reveal between seconds 10 and 12.
- The real frame loop reports `uSeaFogShape.w = 0` in all 3,434 captured frames, throughout `sail` → `fog` → `thin` → `drowned:enter`
  sequence. The village sea-fog renderer and its cache cannot cause this arrival change: they are inactive.
  `DrownedChapter` resets `dark.rise = 0`; the sea fog rises after the cat rescue, as the air dies.
- Once the cloud bank clears, `fogOf` supplies ordinary exponential distance haze and `uVeil`. Unlike the cloud
  bank, that haze has no spatial billows or streaming wisps. Its colour is a tinted `skyColor` sample, whereas
  the sky draws `skyRadiance`. `uOpenSea` is zero in both chapters, so the existing far-haze/sky matching path
  is inactive. This is an additional horizon colour mismatch to consider, not an isolated fix verified here.
- The consecutive frames at the chapter boundary show no comparable fog-pattern jump. The abrupt defect is
  at the start of `thin`; the larger gradual reveal follows within that beat, using the same cloud-bank shader.

### Village: a flat density layer and almost constant lighting

In `src/world/atmosphere.ts`:

- `fogBank` uses moving multi-scale noise for its front/top, billow lighting, streaming interior wisps, view
  direction toward the sun, a lit rim, and a distance blend toward the horizon haze.
- `mistOptical` instead integrates a product of linear height, front and side ramps. Its main top is a single
  height, with a 2.8 m vertical fade. Four fixed ellipsoidal wisps add shape near the front; there is no moving
  noise field. `uSeaFogShape.y`, which the controller still fills with front curvature, is unused by this mist.
- `seaMist` computes essentially one RGB colour for the whole bank, independent of sample height, ray direction
  or distance. Its top/body mix is fixed at `0.35 * (1 - close)`; its sun contribution is also a uniform colour.
  The nearby lantern halo is the exception. There is no equivalent to the cloud bank's distant haze blend.
- Long, shallow sightlines become opaque in this flat layer. With almost no light variation, the result is a
  uniform grey/lilac sheet and a long straight horizon. Both the rooftop and belfry comparisons show this with
  the cache enabled and with the direct analytic calculation.

This simpler mist was introduced for the 2026-10-10 performance problem. The earlier design notes explicitly
record that the trial looked flatter and less billowy. The old expensive renderer was subsequently removed;
production and development now use this same mist (`final-review.md`). Restoring that old renderer blindly
would also restore its known performance problem.

### Cache: a secondary source of edge errors

`src/world/fog-lookup-uniforms.ts` uses 160×96 view samples, including a 25% guard band, per radial slice.
At 1600×900 this gives approximately one fog-direction sample per 12 screen pixels. Bilinear interpolation
of optical depth cannot preserve every thin horizon contour.

Frozen comparisons change only `FOG_LOOKUP` in the scene and grass materials. Camera, world time, lighting,
fog field and postprocessing remain the same:

| View | Mean RGB difference (0–255) | Maximum channel difference | Pixels with any channel >8 |
| --- | ---: | ---: | ---: |
| Roofs | 0.390 | 63 | 0.918% |
| Belfry | 0.157 | 32 | 0.199% |

Errors concentrate around edges, including the horizon. In the selected horizon crops, mean channel differences
were 2.170 (roofs) and 1.138 (belfry). Bypassing the cache changes edge detail but leaves the flat sheet intact.
These still comparisons do not establish motion stability.

The history is relevant: `4af9bfa8` cached both chapters' fog on October 11; `a9f14d51` removed the cloud cache
after a visible motion regression but retained the village cache. That makes the present rendering paths
different, but it does not account for the whole visual mismatch.

## Evidence and limits

Full replay: `/tmp/updraft-fog-transition-agSbXU/`.

- `build.mjs` creates a frozen QA artifact in `site/`, with source SHA-256 hashes in `source-hashes.json`.
  Its only instrumentation observes the completed game frame and reads camera/story/fog state. No source
  files or story states were changed. Actual env files were disabled for the build.
- `run.mjs` starts `?shot=1&chapter=cloud&ratio=1&msaa=4&analytics=0&progress=0` in the repository's GPU-backed
  Chrome for Testing. It lets the climb, swans, boarding, entire sail, fog entry, descent, clearing and arrival
  run normally. No boat relocation, forced beats or accelerated story clock. The kite supplies the normal tow.
- `trace.jsonl` records the full checkpoint route: `follow`, `emerge`, `awe`, `nest`, `skein`, `lean`, `gather`,
  `boarding`, `sail`, `fog`, `thin`, `drowned:enter`. The replay continues eight seconds into the village,
  ending at game time 243.667 seconds.
- `frames/00000.jpg` through `03433.jpg` retain every rendered game frame from 280 m into the sail, well before
  bank entry, through village arrival. `frames.json` proves frame numbers 11187–14620 are consecutive, with
  no missing frames. This covers 57.23 seconds at the fixed QA timestep. `errors.json` is empty.
- `frames/02052.jpg` and `02053.jpg` are the decisive adjacent frames. `descent-adjacent.jpg` shows the three
  frames on each side; `clearing-sequence.jpg` and `chapter-boundary.jpg` show the subsequent reveal and handover.
  `analyse.py` ranks every adjacent-frame change and lists boundary states.
- Verification is a complete gameplay replay, continuous frame capture, image inspection around the cut/reveal,
  and state/code correlation. It is not described as video motion review or a performance measurement.

Earlier frozen comparisons and insufficient first transition probe: `/tmp/updraft-fog-diagnosis-amoryk/`.

- `roofs-{cached,direct,off}.png` and `belfry-{cached,direct,off}.png`: same frozen state at each location.
- `transition-thin-00.png` through `transition-thin-14.png`, plus chapter-entry and settled frames: sampled
  sequence from the running frame loop. The fixture seeds the boat just before the cloud bank and then runs
  the normal sail, fog, relocation, thinning and chapter handover. It does not replay the preceding climb,
  boarding or full cloud voyage. Early approach framing still settles from the seeded position.
- `states.json`, `transition-states.json`: camera and fog uniforms associated with each capture.
- Both completed probes have empty browser-error logs. Captures were inspected as stills; no video motion
  review or performance claim is made. No product code changed, so no build/release suite was run.

## Remaining correction direction

The hidden descent now preserves the bank's texture and lighting reference frame, moves its clear pocket
atomically with the hull/camera, and covers the sail change more fully. Its verification is recorded above.

Preserve the village's front progression, rising height, bell clearing and hidden-boat reveal. Give its fog
spatial shape, light variation and a horizon treatment consistent with the cloud bank, while retaining a cheap
density integration. Review that appearance before choosing how to cache it. Separately tune the arrival's
bank/haze handover so the texture and colour do not disappear together into a visibly different atmosphere.

Verify from before the cloud-bank entry through the village reveal, then through the roof route and full bell
clearing in moving landscape and portrait cameras. A replacement needs both a visual review and performance
measurements; neither merely increasing cache resolution nor extending a fade addresses all the findings.
