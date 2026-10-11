# Boot and the loading veil

## Shader simplification investigation (2026-10-11)

After merging the chapter fog cache, Jeremy asked, verbatim:

> can you take a look if there's anything else we can do to bring it down more?

Continue solo from `4af9bfa8`. Profile the remaining first-use cost and test isolated shader simplifications or
material sharing against that integrated build. Preserve appearance, gameplay throughput and complete warm-up
before play; diagnostic omissions are bounds, not proposed changes. No deployment is requested.

Jeremy's brief, verbatim:

> Is there anything we can do about the time to compile all the shaders?
>
> we can't precompile the shaders?
>
> is it because of the large number of shaders we have?
>
> Surely there's a way for us to simplify the shaders and reduce their number?

Jeremy authorised proceeding, then clarified:

> yea ok please. is it really a shared fog? I know we had some fog in the cloud stairs chapter, and a "cheap" fog for the drowned village chapter?

Jeremy then instructed:

> dont use subagents going forward please.

Continue this investigation directly. The active cache-prototype agent was stopped; at that checkpoint its
isolated worktree was experimental evidence, not an approved game change.

Jeremy subsequently instructed: "merge into main please". This authorises integrating the final chapter-only
cache and exact copy-pass cleanup into local main, preserving the fog models and the cache approach.
Replace shader string rewrites with an explicit `FOG_LOOKUP` compile switch and renderer interception with the
world scene's `onBeforeRender` callback. Invalidate once per prepared frame, even at fixed game time; preserve
camera-specific caches for grass, main, reflected and doorway views, and release atlases when their fog clears.
An additional turned-camera stairs comparison required increasing the fine grid to 160×96 (8.75 MiB per atlas):
128×80 exceeded the existing 2% pixel-difference gate at that angle. The first finer comparison passes at 1.959%.
Verify the integrated result against the prototype, real fog transitions, startup and context recovery. Continue
solo. Deployment is outside this instruction.

The chapter fog models are distinct: stairs `cloudDeck`/`fogBank`, village `seaMist`, plus ordinary haze and the
sleeping island's ground fog. `fogOf` combines their results; its source is shared across materials. The village
mist remains analytic, not the removed ray-marched implementation. Its nine-interval quadrature loop is called
several times for church clearing and can be costly to expand during compilation despite being cheap at runtime.
Before building a texture cache, isolate the stairs and village costs and test a uniform-bound version of that
same nine-interval loop. Preserve the existing integration, boundary handling, samples, lighting and wisps.

Audit of clean `72d962b2`: 240 linked programs, up from the 214 measured on October 6. Of these, 176 include
the shared atmosphere source; this is a source inventory, not a claim that every included function survives
compiler elimination. Normalising comments and whitespace finds one duplicate pair: the life field's copy pass
and the petal/leaf copy pass. Eleven programs have doorway support, but that does not establish eleven redundant
programs: the doorway modifies existing actor materials as well as separating otherwise shared materials.

Exploratory probes run against a frozen QA build on this Mac, Chrome for Testing 153 with ANGLE Metal, a fresh
browser per load and `coldshaders`. They intercept shader source in a scratch browser; no product shader changed.
Initial time to ready was 43.404 s (4.309 s settling, 36.295 s warming first draws). Replacing `skyRadiance` with
plain `skyColor` took 38.219 s. Sharing its two cloud-density samples through a uniform-bounded loop took 44.100 s,
so that rewrite did not establish a Mac improvement. Replacing the main `fogOf` calculation with zero fog took
14.330 s, still with 240 programs. A final unchanged control took 43.965 s (4.690 s settling, 36.584 s warming),
confirming that the baseline remained slow after the probes. The sky and fog omissions change the picture and are diagnostic bounds only,
not proposals to remove the effects or estimates of a finished optimisation. These are individual exploratory
loads, not Windows/Safari/tablet measurements or a rendering-performance comparison. A first malformed sky probe
was discarded; the corrected probes require no console/page errors and a successful `ready` performance mark.

The main experiment is a shared lookup for existing fog colour and amount, so individual
materials compile a texture lookup instead of the entire fog calculation. This remains an isolated prototype,
not an approved production implementation. It must preserve the approved analytic mist: evaluate
that same function into a cache rather than substitute a new fog style. Main, reflected and doorway cameras,
the terrain's landscape-specific home haze, transparent materials, nudged character geometry, rapidly changing
lightning and moving fog boundaries all need explicit treatment. Texture resolution, interpolation and per-frame
cost are unresolved; no startup win justifies a visible fog change or slower play. A cache adds its own bake
programs and work, so the diagnostic's 29-second difference cannot be claimed as a deliverable saving.

For program count, consolidate genuinely equivalent prop shaders by putting differences such as paint colour,
grain scale and light strength in uniforms, and share their vertex source too. `lines.ts`'s `PAINT_FRAG` and
`birches.ts`'s `ROPE_FRAG` are an initial family to inspect; the latter also dissolves near the camera, so this is
not a textual deduplication. Retain quality variants that have measured gameplay benefits. The duplicate copy
pass is a small exact cleanup, not the main startup fix. Confirm savings in whole-game cold startup before
retaining a change; compare output and runtime separately. Production integration remains open.

Scratch evidence and probe: `/tmp/updraft-shader-audit-UBDk40/` (`programs.json`, `sky.json`, `loop.json`,
`fog.json`, `control.json`, `audit.mjs`; `baseline/` is the frozen QA build). Reference for the shared-volume approach:
[Epic's volumetric fog documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/volumetric-fog-in-unreal-engine).
The reference establishes the technique, not its performance or fidelity in Updraft.

### Follow-up experiments

The village-only omission took 34.279 s; omitting the stairs deck/bank took 35.222 s. Both models contribute to
compilation. Keeping nine integration intervals behind a uniform bound took 44.090 s, without an established
improvement. Sharing the clearing's integral call sites took 41.598 s; sharing its two height passes as well took
41.488 s. These are single-load probes, not retained changes.

A four-sample loop took 40.560 s; combining it with the clearing loop took 41.127 s. The sample-loop GPU comparison
covered 110,592 rays, including nearly horizontal and vertical rays, three fog heights, three clearing sizes and
three closure amounts. Maximum opacity difference was 0.000000537. However, paired batches with a blocking pixel
readback showed median new/old cost ratios of 1.364, 0.923, 1.208 and 1.364 across four fog states. Reject this
rewrite: a small startup improvement does not justify making the fog kernel slower. A first timing using only
`gl.finish()` did not wait reliably on this browser and was discarded. Evidence: `mist-parity.json` and its script
in the scratch directory.

The isolated full-fog cache took 15.295 s in one forced-cold load (241 programs). At 1600×900, ratio 1 and MSAA 4,
both it and the unchanged belfry ran at 60 fps for eight seconds, with no intervals above 25 ms. This only establishes
that short desktop frame test, not GPU headroom or tablet performance. The original island, drowned and stairs
comparisons passed, but the closed-fog belfry comparison failed: 2.136% of pixels differed by more than 8/255,
against the existing 2% limit. Mean channel difference was 0.444/255. It also samples detailed sky radiance too
coarsely to preserve the exact sky-matching contract. Do not merge it.

A second cache retains ordinary haze and sky radiance in the material shaders and caches only `cloudDeck` and
`seaFog`, with physical-distance interpolation between radial slices. It still failed the belfry comparison
(3.078% over 8/255, mean 0.555/255). Storing optical depth and depth-weighted light improved this to 2.393%, still
outside the gate. A view-oriented cache then concentrated its samples inside the camera's view plus a 25% margin,
keeping a coarse spherical fallback for offscreen vertices. At 96×64 view samples, the belfry, church, rooftops,
sleeping island, mirror, home, shore and sea passed; the 1600×900 stairs view still failed at 2.172% over 8/255.

The final experimental layout uses 128×80 view samples, a 32×16 spherical fallback and 64 radial slices. Each
allocated half-float atlas costs 6 MiB. Stairs and village have separate atlases per camera; their original analytic
functions bake them. Ordinary haze, landscape-specific home haze, sky radiance and the water's reflected sea-mist
calculation remain analytic. Decoding restores exactly opaque fog, preserving the terrain and water's early-return
optimization. Without that restoration, the prototype caused an avoidable rendering slowdown.

Final fixed-frame comparisons pass for belfry, rooftops and stairs: respectively 0.353%, 1.401% and 1.723% of pixels
over 8/255; mean differences 0.083, 0.467 and 0.475/255. These are numerical image gates, not human approval.
The view-cache pairs retain the same chapter, character poses and camera positions (largest camera drift below
0.000001 m). A 16-round comparison alternating ABBA and BAAB advances both builds through the same frames, drains the GPU after
every draw using pixel readback, and includes the per-frame cache rebuild. Median new/old completed-frame cost
ratios are 0.910 in the belfry, 0.944 on the stairs and 0.999 in the village entry. These are local throughput
measurements, not device-independent GPU milliseconds. The earlier separate-page timing is superseded by this
paired comparison and the opaque-fog fix.

Three forced-cold loads of that final frozen prototype took 27.437, 28.035 and 28.058 s. An unchanged load measured
immediately afterwards with the same profiler took 43.320 s: the prototype's median is 35.3% lower. It links 241
programs, including the shared bake, versus the unchanged 240. Its longest veil gap was 333 ms and its longest
post-construction task 202 ms, versus 400 and 416 ms in that control. The older 150 ms/2.8 s gates remain unmet;
this is not a claim to have closed the whole loading-veil backlog. No Windows, Safari or physical tablet result
has been established for this prototype.

At the prototype checkpoint, the worktree was `/Users/jeremy/.codex/worktrees/fog-lookup-prototype/updraft` and main
contained only the exact copy-pass consolidation. The latter links 239 programs with no remaining normalized duplicate pair; the set of
unique shader sources is identical to the unchanged build, after ignoring whitespace/comments and the cold-load
nonce. Its one cold load was 42.595 s, too little evidence to claim a loading-time improvement from that cleanup.
Typecheck, the production build and shader bounds pass. Seeded fixed-frame island, meadow and birches comparisons are pixel-identical,
covering the life field, petals and fallen-leaf/litter initialization paths affected by the shared copy shader.

Evidence: `fine-view-cache-views*.png`/`.json`, `view-cache-wide*.png`/`.json`, `paired-cost.json`,
`fine-cache-cold-{1,2,3}.json` and `final-control-cold.json` in the scratch directory. The final frozen prototype is
`fine-view-cache/`, served at port 5354 during review. The integration below supersedes the experimental hooks.

### Local integration, authorised by Jeremy

The integrated implementation uses explicit `FOG_LOOKUP` shader selection and the scene's normal render callback,
with per-frame invalidation, per-camera matrix/mirror checks and disposal of inactive atlases. A turned-camera
stairs comparison exposed insufficient directional resolution: the original 128×80 grid differed by more than
8/255 on 2.322% of pixels. Preparing grass, terrain and reflection for the moved camera did not remove the
difference. Raising the grid to 160×96 brought that view to 1.959%, inside the existing 2% gate, at 8.75 MiB per
allocated atlas. The original analytical fog functions, depth slices and optical encoding are unchanged.

Paired completed-frame tests of this finer version, including the cache rebuild, give median new/old ratios of
0.903 in the belfry, 0.951 on the stairs and 0.994 at the village entrance. The cache regression renders a clearing
at fixed time, moves/turns/resizes the camera, switches cameras and mirror mode, and checks actual GPU texture
release. Omitting invalidation fails its negative control. The original stairs, village and lantern shader probes
also pass; the lantern probe explicitly selects the analytical path. `frame-profile` invalidates on each measured
whole-frame draw so frozen time cannot hide cache cost. Camera-angle cases are retained in `render-parity-check`.

All six final moved-camera comparisons pass: belfry left/right 0.777%/0.587%, roofs 1.516%/1.392%, stairs
1.543%/1.959% over 8/255; all means remain below 1/255 and character/camera state agrees. A final forced-cold load
of the finer version takes 26.408 s, followed by a fresh unchanged control at 43.884 s (39.8% less). Both link 240
programs: the bake adds one, the exact copy cleanup removes one. Worst veil gaps are 317/417 ms and longest
post-construction tasks 208/422 ms respectively. This final pair supplements the three earlier prototype loads;
it does not establish performance on other hardware.

The startup-flow check passes with no stray programs or first draws in play, including Begin, Continue, a chapter
pick and quality changes; its worst veil gap was 316.6 ms. Context loss during play, with/without a checkpoint, and
during boot all recover through the existing reload path. The final context check also starts in the belfry with
the finer fog atlases allocated, and passes all three recovery paths. Real pointer strokes at the belfry rang the bell four times,
cleared the fog, brought the boat home, and continued through descent, boarding and the cat's farewell with no
cuts or lost-character intervals. The harness needs a dev server for its source imports; a first preview attempt
was discarded when those imports were unavailable.
The real roofs-to-tree replay also passes through the fallen tree and the camera turn toward the sheet, with
no cuts, hidden-character intervals or roof penetration. Typecheck, shader bounds, the production and QA builds,
and production/QA separation guards pass; the existing bundle-size warning remains.

Evidence remains in `/tmp/updraft-shader-audit-UBDk40/`: `integrated-fine-cost.json`,
`integrated-fine-camera*.json`, `integrated-start.json`, `integrated-context-loss.log` and
`integrated-fine-belfry-dev.log`, `integrated-fine-roofs.log`, `integrated-fine-cold.json` and
`integration-control-cold.json`, `integrated-fine-context-loss.log` and `integrated-fine-cache-check.json`.
The old loading-veil targets and physical Windows/Safari/tablet checks remain open.

### Further reductions after the merge

Jeremy then requested, verbatim: "28 to 22 seconds is nice. can you test to see waht the visual difference would be?"
Compare the exact `fogOf` sky-gradient diagnostic with the frozen integrated build, including ordinary chapter
views and crossings where sky-matched haze conceals coastlines. Keep camera, frame and random seed fixed and
show representative comparisons. This is visual evaluation of the diagnostic, not approval to merge it.

The follow-up starts from `4af9bfa8`, served as a frozen QA build. A fresh forced-cold load takes 27.698 s:
3.854 s settling programs and 21.117 s warming their first draws. Chrome for Testing 153 / ANGLE Metal,
one browser at a time; these measurements do not establish Windows, Safari or tablet results.

- Replacing all `skyRadiance` calls with the plain sky gradient takes 21.229 s. Replacing only the sky calculation
  inside `fogOf` takes 22.196 s and keeps the visible sky's shader intact. Both omit detail from the result and are
  diagnostic bounds, not approved simplifications. The latter identifies the repeated sky calculation inside
  distance haze as the most promising next target.
- Rolling the four value-noise corners into a uniform-bounded loop takes 28.119 s; computing the hashes in vector
  lanes takes 29.476 s. Neither establishes a startup improvement; do not retain them.
- The still-island and mainland animal shaders have five pairs differing only in chapter clipping. An isolated
  uniform-switch prototype shares those programs, reducing 240 to 235. Three cold loads take 28.281, 26.717 and
  28.884 s; fresh unchanged controls take 28.051 and 27.252 s. No reliable startup gain is established. Seeded
  island, meadow and home images and character/camera states are identical. Paired completed-frame ratios are
  0.988, 0.993 and 0.990 respectively, with no observed throughput regression. Typecheck and QA build pass.
- Drawing the warm-up scene into 4×4 scratch targets with the original formats, on top of the animal prototype,
  takes 26.476 s; warming itself takes 20.082 s versus 20.208 s in the fastest animal-only load. This does not
  establish a material warm-up saving. It remains an isolated probe, without startup-flow validation.

The next worthwhile prototype is a shared sky result for distance haze, evaluated once per camera/frame and
sampled by materials. It must match the actual sky, preserve the sharp sun/stars, work for reflected/doorway views
and offscreen grass-table vertices, and pass memory and completed-frame cost checks. The earlier coarse full-fog
atlas is unsuitable for this. The roughly five-second diagnostic difference is not a promised deliverable saving;
the cache would add work and might need a different representation. No new product optimization is merged from
this follow-up, and the sky-cache implementation remains open.

Evidence: `/tmp/updraft-shader-followup-IIWQ3X/` (`control.json`, `sky-omission.json`, `haze-sky.json`, `corners.json`,
`vector.json`, `animals-cold-1.json`, `animals-confirm-{1,2}.json`, `animal-parity.json`, `animal-cost.json`,
`small-warm-cold.json`, `control-cold-{1,2}.json` and patches). The experimental checkout `shader-followup/updraft`
is recoverably archived with the animal-sharing and small-warm probes, not production-ready changes. A dead-function pruning harness was
discarded because its brace scanner could not handle conditional GLSL branches; it supplies no performance result.

The requested visual comparison rejects the plain-gradient substitution as a shipping change. Sixteen seeded
chapter/camera pairs are mostly indistinguishable, including stairs, belfry, mirror and ordinary village views.
Separate loads initially moved the village camera by about 2 mm; repeating the substitution within one frozen
world leaves at most 1/255 channel difference there. Chapter-start views alone miss the important regression.

With the actual `JourneyReveal` controller advanced through covered, half-cleared and clear states, a targeted
camera facing the incoming home island exposes a hill-shaped gap in the clouds and stars and removes the sun
where the island should still dissolve into the sky. At full cover, 15.48% of pixels differ by more than 8/255 in
at least one channel; at half cover, 2.73%. The corresponding birches reveal exposes tree-shaped gaps in daylight
clouds (1.94% and 0.44%). The sleeping arrival changes very little. These are diagnostic camera angles with the
world frozen, not complete gameplay replays. They use the production reveal controller, room visibility, fog
bakes, reflection and post passes from the same frozen QA build; the only shader substitution is
`clearSky = skyRadiance(rd)` to `clearSky = skyColor(rd)`.

All nine reveal states reproduce the current image pixel-for-pixel on an unchanged redraw and after reversing
the substitution, with no browser errors. This rules out camera or simulation drift as the source of the reveal
regression. Keep the detailed sky match when pursuing a shared lookup; simply dropping it is visibly unsafe.
No further game code was changed or merged. Evidence is `/tmp/updraft-sky-visual-oaQ9IV/`: `compare.json`,
`targeted.json`, `production.json`, `arrivals.json`, the capture harnesses and `review-{home,birches,village}.png`.

Jeremy confirmed on 2026-10-11, verbatim: "yea agreed, dont merge this". The plain-gradient haze diagnostic is
rejected and must remain unmerged. The previously approved chapter-fog cache remains in main.

Jeremy then reported a regression in the already merged chapter-fog cache, with a stairs screenshot, verbatim:
"hey that other change you merged in do you remember? it's causing the clouds in the background to render really weird. do you see this? It looks like a bug."
The screenshot shows hard, angular background-cloud boundaries. Reproduce against the original analytical
rendering, fix the regression, and check the actual cloud contours at large viewports and while moving the camera;
the previous whole-image difference gate did not establish that these edges were acceptable. This is separate
from the rejected sky-gradient diagnostic, which remains unmerged.
Jeremy clarified, verbatim: "it looks fine in a single still, but over time in motion, it's kind of artifacting all over the place".
Motion stability is the primary regression gate: compare frame sequences as the camera and clouds move, including
the difference between cached and analytical rendering at the same frozen world state for each frame.
Jeremy added, verbatim: "yea, that last merge basically ruined the beautiful fog effects up in the cloud".
Restore the original analytical stairs cloud deck and mist bank for every material and view, throughout the
climb, cloud sea and descent. Remove the cloud atlas; keep the village cache and exact copy-pass consolidation.
Preserving the original cloud appearance takes priority over retaining the full startup saving.

The restoration removes the cloud lookup sampler, allocation and bake. `cloudDeck` now matches its pre-cache
`0cd3f43d` body exactly for every material; the sky, geometry, grass, reflected views and bank all use that
original integration. The village cache is unchanged apart from removing the unused cloud branch.

A 120-frame moving-camera comparison of the rejected merge against its analytic path confirms errors that
change from frame to frame (maximum channel error 111/255 in the cloud region). Restoring the sky alone still
leaves errors up to 111/255 on cloud geometry, so that partial fix was rejected. The final
`stairs-fog-motion-check` advances the real game loop and pans each view, comparing each world state with the
original per-ray fog. All 96 frames are pixel-identical across checkpoints 0, 2 and 3 at 1920×1080 and an
ultrawide 3776×1094 view. Its frame-advance assertion prevents the initial scratch fixture's paused-clock
mistake from yielding a false gameplay-motion result. These are targeted motion checks, not a full playthrough.

Typecheck, shader bounds, production/QA builds and separation guards, the 18-case cloud-bank continuity probe,
544 landing-mist contact samples and the village-cache lifecycle check pass. The cache check now also verifies
that active stairs fog performs no cache draw or allocation. Startup, Continue, chapter selection and quality
changes pass without stray programs or first program draws during play. One forced-cold QA load takes 34.814 s
with 240 programs (4.174 s settling, 27.981 s warming), versus the earlier 43.884 s pre-cache control. This gives
back part of the startup saving to restore the clouds; it is one local Mac measurement, not a cross-device claim.
Evidence: `/tmp/updraft-cloud-edge-dDdhtx/`, especially `motion.json`, `fixed-motion-advancing.json`,
`fixed-cold.json`, `start.json` and `cached-vs-original-motion.mp4`.

Jeremy reported residual motion artifacts after the restoration, verbatim:

> ok well the reason i ask is because there's still some kind of "glinting" in the clouds even after your fix. i dont know what the issue is but it looks like some kind of rendering artifact still

The 96-frame check above compares two shader paths inside the modified build, not the entire pre-cache renderer.
It does not establish that the reported glinting is gone. Confirm the running build, compare actual pre-cache and
restored builds in motion, and isolate the glint before making another appearance change.

The follow-up compared a separate checkout of `0cd3f43d` with current main using `frame-profile`'s deterministic
frame/UUID/readback controls. The real climb, loop, upper-cloud reveal, sail, mist and descent into the village
matched exactly in all 525 sampled frames (every 30th frame, 90–15810, 1376×1032, ratio 1, MSAA 4, Chrome for Testing
on ANGLE Metal). Separately, the background-cloud region matched in all 60 entrance frames from the frozen
pre-cache and restored QA builds at 1920×1080. This establishes parity in those frames; it does not identify or
resolve Jeremy's reported glinting. Asked for the running URL and whether the camera moves; no answer yet.
No further rendering change was made. Evidence and the entrance comparison clip: `/tmp/updraft-cloud-glint-9fK0m8/`;
`replay-results.json` records the full replay command and its successful output. A pristine pre-cache dev reference
is available at `http://127.0.0.1:5363/?chapter=stairs&progress=0` in the attached `cloud-glint-baseline` worktree.

## Windows compilation follow-up (2026-10-06)

Jeremy: "ok listen, i need you to figure it out. I need this game to be playable on windows machines. This may explain why my sister said the game just completely hung and froze when she tried on her samsung tablet or whatever"

This extends the earlier freeze-only scope to eliminating minutes of CPU-bound shader compilation on the normal
Windows browser backend. On his Ryzen 5 9600X / RTX 4070 Super, the live game takes 149 s to Begin through ANGLE
D3D11 (143 s settling programs), versus 18 s through Vulkan, using identical inputs for 220 programs. These first
measurements used Chrome for Testing 149; Chrome/Brave 154 also show the problem. Terrain, water variants and dark
wood programs are the longest waits. Evidence: `C:/tmp/updraft-windows-diagnosis/summary.md`.

Keep the game's look and the rule that programs are compiled and first drawn before play. Fix the shader work on
the default backend; a player changing browser flags is not the deliverable. Isolate the expensive code, verify
equivalent output, and measure a fresh-profile and forced-cold QA startup. The Samsung report remains unconfirmed:
an emulated mobile viewport or CPU slowdown does not establish physical tablet compatibility.

Jeremy's follow-up (2026-10-06): "the last thing i want to happen is a regression in visuals so lets just do whats safe. i assume (2) is safe? is 1 and 3 safe?"

For this follow-up, only share the duplicate fog calculation in the two dark-wood bend shaders. Keep the original
colour mixing and subtraction order, then compare the affected stump, rock and coal pool against the current
build on Windows. Leave the water variant consolidation (1) and remaining terrain loops (2) unchanged: their
runtime and visual risks need separate investigation. The earlier broad loop experiment changed grass motion.

Jeremy then asked: "lol what was the point of that then. so there's nothing we can do?"
The fog change did not establish a reduction in time to Begin. Further experiments must measure that outcome.
First investigate compilation order: the non-cloud terrain variant is consistently queued around 30 s and is
last to settle at 42 s. Starting it earlier can be tested with identical shader inputs and visual settings.

Jeremy's next instruction: "commit and push, and then lets try tackle some meatier stuff". The verified fog and
scheduling work was pushed as `10ab475`. This authorises investigating the terrain/water compiler hotspots next,
while retaining the earlier no-visual-regression requirement. Isolate compile cost before editing the game; any
retained shader restructuring must preserve effect counts and arithmetic order, pass targeted GPU output and scene
comparisons, and produce an improvement in whole-game cold startup. Do not defer work into play or lower quality.

Jeremy clarified the visual gate: "its fine if it doesn't cause a human visible issue. im happy to take a look".
Tiny numerical or pixel differences are not an automatic rejection. Preserve the effects and the perceived look;
offer matched before/after captures for Jeremy's review. Continue checking gameplay cost separately from startup.

After reviewing the result, Jeremy approved it (2026-10-06): "yep it looks fine, that wake foam difference is acceptable".
Keep the water-program consolidation and shared terrain-height samples. The reviewed wake-foam difference is accepted.

## Jeremy's brief (verbatim)

2026-09-29:

> yea after we added the stairs level, i need another pass to find performance optimisation opportunities. I'm
> wondering if we've outlived the short and sweet loading veil as well

> what i want to avoid though it having the gameplay itself freeze setting up the stairs. and yea, create a separate
> backlog item for the veil issue

2026-10-02:

> for context, my playtester told me that it froze on load. i need the boot-veil to not freeze, and also maybe show a
> simple progress indicator. What it's doing, and a rough loading percentage

> They were on an older samsung tablet like an ipad. but even i get freezes on the veil loading screen on my ipad m5
> pro. i think the main event loop is blocked or something no? probably when it's loading shaders or something?

> listen, the playtester was on a samsung device. i dont think it makes sense to spend too much time optimising for
> safari no?

## What is wrong (measured 2026-10-02, production build of ca8408e)

The playtester was on an older Samsung tablet, so Chrome on Android: the Chrome costs below, stretched by a much
slower CPU and GPU. Jeremy's iPad shows the Safari cost.

**1. Long tasks in Chrome.** On this Mac (Chrome, cold profile) Begin arrives at about 2.5 s, with two pauses of
about 0.4 s:

- World construction: `new CloudStairs()` (≈280 ms) and `new AutumnBirches(...)` (≈100 ms) run back to back with no
  yield between them (`src/main.ts`, the step after `new SleepingIsland`), about 0.36 s after navigation. With the CPU
  slowed 4× (a stand-in for an older tablet) this one task becomes 1.6 s and Begin takes 6.3 s.
- First compile (most loads): `precompile` issues all 138 scene programs at once, and the first status query waits
  about 0.4 s for the GPU process to take them all in (one `getProgramParameter` call, about 1.5 s after
  navigation).
- `warmRender` draws 64 objects per batch however many of them use a program not yet drawn. A slow GPU driver pays
  for each first draw inside that one task.

**2. First draws of new programs in Safari.** Mac Safari 26.6 (the same WebKit and Apple GPU family as Jeremy's iPad)
on a first visit: 24 s to Begin, with the veil frozen for up to 4.2 s at a time; a repeat visit takes 3 s, from
WebKit's cache. Safari compiles shaders in the background and in parallel (a lab page compiled 24 of the game's
programs in 0.9 s with no main-thread block). The cost is the first draw of each program, about 200 ms, done on the
thread that issues the draw: 24 first draws issued without any query still blocked the main thread for 4.6 s. With
64 objects per `warmRender` batch, dozens of first draws land in one task. Boot creates 213 programs.

The paddling cygnet on the veil is animated by the compositor (transform and opacity only, `src/styles.css`), so it
keeps paddling through these pauses; the moving wind lines on the veil (`VeilWind`, driven by JavaScript) and the
response to the pointer stop. `node tools/start-check.mjs` measures only the worst gap on this Mac's Chrome (500 ms
limit), which is why it passes.

## Constraints

- **Play never freezes to set up the stairs (Jeremy, 2026-09-29).** Anything moved out of boot must not cost a
  visible hitch during play. This is the boot contract in `docs/engine.md` ("Nothing heavy may happen in the first
  frames of play ... Anything that appears later in the story is already compiled and uploaded"), and it stays. A
  program's first draw costs about 200 ms on Apple hardware, so programs cannot be deferred into play.
- **The veil must not freeze (Jeremy, 2026-10-02).** The fix keeps the work behind the veil and splits it so the veil
  keeps painting.
- **The veil shows what it is doing and a rough percentage (Jeremy, 2026-10-02).** This settles the earlier open
  question about the veil: option (b), keep its look and show that loading is progressing.

- **Scope: stop the freezing, show progress, and audit for accidental duplicate programs (Jeremy, 2026-10-02).** Not a
  push to shorten the cold load. The audit found 2 of the 213 programs are exact duplicates (one program is built
  three times; median fragment shader 40 KB, largest 78 KB, so size rather than duplication drives the cost). Remove
  the duplicates and record in `docs/engine.md` that every program's first draw costs about 0.2 s of a first visit on
  Apple hardware, so each new variant is weighed against it.
- **Chrome on a slow tablet is the target; no further Safari work (Jeremy, 2026-10-02).** The fixes are general
  (short construction steps, compiles in groups, at most one new program per warm-up draw), and they end Safari's
  multi-second freezes as a side effect. Not pursued: a warm-up worker with its own WebGL context, moving the
  renderer into a worker, and making the veil's wind lines compositor-animated. On Safari the wind lines will step at
  about 5 frames a second during the graphics stage, and that is accepted.

## What the player will see

The veil looks as it does now, with the cygnet paddling, and under it, where "Loading" was, one quiet line: what the
game is doing and a rough percentage that only rises. On a fast laptop it runs 0 to 100 in about 2.5 s. On a slow
tablet it takes longer but never stops: the wind lines and the pointer stay live, with no pause longer than about
half a second at 4× CPU slowdown. On a first iPad visit it takes about 25 s, and during the graphics stage the wind
lines step about 5 times a second, because one program's first draw (about 200 ms) is the smallest piece that work
splits into. The cygnet keeps paddling smoothly everywhere.

## Mechanism

### Programs: compile in a window of 8, settle, then warm one new program at a time

Every program the game uses is created and settled behind the veil by one helper in `src/gl/boot.ts`, and first drawn
by `warmRender` with at most one new program per batch.

- **Compile in a window of 8.** `settlePrograms` takes compile jobs: scene materials, once per program variant
  (`variantSteps()`), sim and bake materials (`simMaterials`), the grass table and unclipped materials, and the post
  chain's materials (`post.compileJobs()`, also once per variant step, for the grade's `SUN_GLOW`). Each object is
  compiled on its own (`renderer.compile` on a root that visits only that object), and at most 8 programs are compiling
  at once: when 8 are in flight it settles the finished ones until one slot is free, then refills. The Windows
  follow-up also queues terrain variants first, so their long compile overlaps the other work. Eight keeps Chrome's status
  queries short: one query waits behind every compile issued before it, and 138 programs at once made it wait 0.4 s.
  Waiting out each group of 8 before the next cost about 0.86 s in all, because the GPU process sat idle between
  groups (built 2026-10-02).
- **Settle each program.** Once its compile finishes, `getUniforms()` is called once on each new program (three's
  first use, `onFirstUse`: the info log, link status and uniform queries). Yield (`yieldBoot`) whenever 12 ms have
  passed since the last paint.
- **Warm one new program per batch.** `warmRender` builds its batches so that each holds at most one object whose
  program has not been drawn yet, plus up to 64 objects whose programs have. It yields on the same 12 ms budget, not
  after every batch: about 145 batches each waiting for a paint would add about 2.4 s. On a driver where a first draw
  is expensive (Safari, slow mobile GPUs) every batch then yields, and each pause is one program. The same holds for
  the variant passes.
- **At most 4 first draws queued on the GPU.** After each batch that first draws a program, `warmRender` sets a
  fence and waits until no more than 4 such batches are unfinished. With `?coldshaders`, Chrome on Metal builds each
  pipeline at its first draw; queuing them all made later buffer uploads block the main thread for 3.7 to 5.8 s.
  Waiting for every first draw cost 0.8 s on an ordinary load; a depth of 4 costs about 0.1 s.
- **Draw nothing unsettled.** The bakes (`terrain.fields`, `terrain.colour`, `terrainHeights`, `grass.bake`),
  `warmRender` and the first `post.render` draw only with settled programs. Draws that constructors made during
  world construction (the seed copies of `Petals`, `LitterField` and `FallenLeaves`, and `SleepingIsland`'s carve
  field) wait for boot through `atBoot()` and run in `runBootPasses()` after the programs settle; their outputs are bit
  for bit unchanged. Every `atBoot` pass must be constructed before `boot()` runs.
- **Every program is first drawn behind the veil.** Settling is not the whole cost: a first draw also builds the
  driver's pipeline (about 200 ms on Apple hardware, slow on mobile GPUs), once per program and target format. Phase 1
  left first draws in play: objects outside the warm camera's view (three's frustum culling), objects that drew
  nothing at warm time (no instances yet, an empty draw range), the grass blades' other fragment shader, the reflected
  world in the sea mirror's format, and the full-screen sim passes (wind, life, petals, leaves, canopy, sea waves,
  carve field, cloud shadows). The warm now turns culling off, gives an empty object one instance or its whole draw
  range for the draw, draws the reflection-layer objects again into a scratch target of the mirror's format (with
  their variants), draws the blades with each fragment shader (`grass.fragmentSteps()`, with their variants), and
  draws each sim material once into a 4×4 scratch target of the format it writes (`simMaterial(fragment, uniforms,
  target)` names it; `warmSimulations`). A first draw is tracked per program and target format, so each batch still
  holds at most one. The simulation's state and every bake stay bit for bit (built 2026-10-03, under the 2026-09-29
  constraint that play never freezes).
- **QA probe for first draws in play.** `__stats.playFirstDraws` counts programs, and programs with a target format,
  first drawn after Begin (draws that issue no vertices or instances do not count), with their names. Through the
  opening minute of play and a `?chapter=stairs` load both are 0 (they were 20 and 22 programs before). One known
  exception: when the quality governor changes the MSAA sample count, every scene program draws into the new sample
  count for the first time; that is a quality change, not a first visit, and it is not warmed ahead.
- **QA probe for stray compiles.** In QA builds, boot wraps the context's `getProgramInfoLog` (three calls it only
  inside first use, with `debug.checkShaderErrors` on, as it is by default) and counts calls made outside the
  settle helper. `window.__stats.bootStrayPrograms` holds the count and the first few programs' material names.
  `tools/start-check.mjs` requires 0.
- **Cold shaders on demand (QA).** Browsers cache compiled programs across visits (Chrome's GPU disk cache, WebKit's
  cache), so a tester's second load hides the problem. `?coldshaders` (QA builds only) adds a never-taken
  `if (gl_FragCoord.x < -<random>) discard;` at the top of every fragment `main`, so every load is a first visit. A
  comment is not enough: WebKit caches translated code, which drops comments.

### World construction: no step longer than one paint budget

World construction runs in counted steps (`BUILD_STEPS` in `main.ts`), each ending with a yield once 12 ms have passed
since the last paint, so short steps run on without waiting for a frame:

- `CloudStairs.build()` is a generator, flight by flight, run with `prepareInBatches`; the geometry, object ids and
  material order are identical to the old constructor's. `AutumnBirches` (about 105 ms on this Mac, the longest step
  left) has its own step, with `birches.scarf.settle()` in batches after it. The washing lines' layout (`lineField`)
  is its own step before `WashingLines`. `Traveller` (about 70 ms) already had its own step.
- Generators yield the share they have done, so the number moves through the stairs and the scarf's settle.

### Boot order

Programs settle, then every first draw happens (stage C), then the bakes, window, grass tables and the first post
chain run (stage D). Before phase 2 the bakes ran between settling and the warm; the warm does not need them (a blade
with no instances yet is given one for the draw), and every bake and simulation output is bit for bit as before.

### Progress: stage and fraction, reported from the boot path

The start screen (`src/start-screen.ts`, in the entry chunk) owns the indicator and exposes `progress(stage,
fraction)`. Four stages with fixed shares of the number. A laptop finishes in about 2.8 s, where no weighting shows;
the shares matter on a slow device. Each share is the mean of a first iPad visit's (A 3, B 6, C 85, D 6) and a cold
Chrome load's at 4× CPU throttling (A 4.0, B 69.0, C 23.0, D 4.0, measured 2026-10-03), rounded to whole percent,
because the playtester was on a Samsung tablet and the iPad's shares alone would leave the number near 5% through a
long construction stage. Within C, settling takes 60% and first draws 40% (Chrome at 4×: 0.94 s and 0.68 s):

| Stage | Line (approved 2026-10-02) | Covers | Share | Fraction within the stage |
| --- | --- | --- | --- | --- |
| A | Downloading the game | `index.html` until `main.ts` starts evaluating | 0–3% | none: the line is static HTML with no number; `main.ts` starting shows 3% |
| B | Building the world | World construction in `main.ts` | 3–41% | completed construction steps / `BUILD_STEPS`, plus the share a generator yields within its step |
| C | Preparing the graphics | Compiling, settling and first-drawing programs (`warmRender`, `warmSimulations`) | 41–95% | settled materials (60%), then objects and passes first drawn over their count collected up front (40%) |
| D | Laying out the ground and grass | Bakes, window, grass tables, post, `gpuIdle` | 95–100% | completed steps / steps counted before starting |

The displayed percentage is an integer and never falls. The D line reads up to 100% and nothing else shows at 100%:
Begin replaces the line as `ready()` fades it with the cygnet. `BUILD_STEPS` is a constant;
`start-check` fails if the steps counted in a real boot differ from it, so adding a construction step means updating
it.

Stage A's words are written into `index.html`, because they show before any game code has downloaded. `progress`
writes the stage line and the number with one `textContent` each per change, into `.progress-stage` and
`.progress-percent`, the two spans of `.loading-text` in `index.html` (the percent span starts empty and takes no
space). A failure that retrying cannot fix puts "The game couldn't start." in the line and empties the number; the
Try again failure fades the line with the cygnet as Begin would. The line is `aria-hidden`; the existing `#start-status` live region announces
stage changes only, never percentages, and `ready()` clears it unless it holds a failure message.

### The indicator's look: D1, "In place" (Jeremy, 2026-10-02)

Comp round 1 offered three directions: D1 in place, D2 the same plus a filling hairline, D3 a small sans line in the
bottom-left corner. Jeremy chose D1 and kept all four stage lines. Exemplar: `comps/` (`d1-ipad-day-c37.jpg` is the
hero, with night, phone longest-line and desktop stage-A frames beside it), and its stylesheet `comps/d1.css`.

- The line replaces `.loading-text` ("Loading…" and its animated dots) under the cygnet: stage words, a 0.6 em gap,
  then the number in tabular figures (`font-variant-numeric: tabular-nums`), as in `comps/d1.css`.
- Type borrowed from `.loading-text`: italic Iowan Old Style stack at 15 px, ivory `#fff2db`, 0.045 em tracking. Opacity
  0.9 (was 0.62), with the ending's dark under-shadow softened: `0 0 2px #182a3659, 0 1px 12px #182a3699`. The text
  top is 14 px below the cygnet's box.
- No motion: stage words change by a plain cut; the number steps. The line leaves with the cygnet (0.35 s) as Begin
  fades in. Reduced motion changes nothing here.
- Contrast measured on the iPad frame at 37%: 3.2:1 on the day veil, 6.3:1 at night (the old "Loading" was 1.9:1
  and 3.35:1). The day veil's centre is too pale for 4.5:1 with ivory text; Jeremy accepted D1 knowing that only
  the corner direction reached it.
- For finished players, the Chapters link fades in where this line sits; the line must be gone first, so the link's
  fade waits 0.35 s for the line's (`chapter-select.css`). Fading together, the two would cross.
- The night veil uses the same line and colour.

### Rejected

- **Moving later chapters' programs into play.** A program's first draw costs about 200 ms on Apple hardware and is
  slow on mobile GPUs, so every one is a hitch in play. Ruled out by the 2026-09-29 constraint.
- **Background threads for the GL work.** WebGL programs belong to one context and cannot be shared. A warm-up worker
  with its own context could only help if the browser's driver cache carried its work over to the game's context
  (unmeasured), and the whole renderer in a worker is a rewrite of input, audio and story. Jeremy declined further
  Safari work (2026-10-02), and the Chrome freezes do not need either.
- **Turning off `checkShaderErrors` in production.** It skips `getProgramInfoLog`, but the next uniform query still
  waits for the compile. It moves the stall without removing it, and loses error reporting.
- **Per-device timing for the bar's shares.** Not worth its machinery for a "rough loading percentage".

## Gates

### Audio readiness follow-up — 2026-10-11

Jeremy asked, verbatim: "Do we need a loading audio stage as part of the veil now then?", then "proceed".
His timing constraint: "yea, btw, i hope you're allowing audio to download async at the same time as the shaders are compiling, instead of downloading the audio being sequential."

Start downloading only the selected starting recording when main begins, concurrently with construction and shader
compilation. Begin still creates/resumes Web Audio synchronously in the gesture. Its decode runs alongside the
chosen room's first-frame preparation; gameplay and veil reveal wait for both. Show "Preparing music" in the existing
loading line only if that final wait lasts at least 150 ms, without an invented decode percentage.
Music-off or sound-off starts skip the download and wait. Turning either off during preparation cancels it. Download,
decode failure or a 20-second preparation deadline permits play with ambience. During play, keep at most one next
recording prefetched as compressed bytes; prepare its decoded score through the existing arrival handoff.
Preserve the supplied Ogg bytes and all experimental synth fallbacks. This is a separate follow-up to the open
shader performance and physical-device gates below.

All on a production or QA build, never a dev server, with no other Chrome capture running.

| Check | Before (2026-10-02) | Gate |
| --- | --- | --- |
| Chrome, this Mac, cold profile: worst veil frame gap | 400–450 ms | under 150 ms |
| Chrome, CPU throttled 4× (`Emulation.setCPUThrottlingRate`): worst gap | 1.6 s | under 500 ms |
| Chrome, this Mac, cold profile: time to Begin | 2.5 s | 2.8 s or less (groups of 8 add status polling) |
| Stray first uses (`__stats.bootStrayPrograms`) | every program (first use happens in draws and bakes) | 0 |
| Jeremy's iPad, LAN QA preview with `?coldshaders&start=1` | freezes for seconds | Jeremy sees no freeze (the wind lines may step) |

