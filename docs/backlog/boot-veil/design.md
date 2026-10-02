# Boot and the loading veil

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
  Apple hardware, so perf-final weighs new variants against it.
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

### Programs: compile in small groups, settle, then warm one new program at a time

Every program the game uses is created and settled behind the veil by one helper in `src/gl/boot.ts`, and first drawn
by `warmRender` with at most one new program per task.

- **Compile in groups.** Collect the materials to compile: scene materials, once per program variant
  (`otherVariants()`), sim and bake materials (`simMaterials`), the grass table materials, and the post chain's
  materials. Compile them in groups of at most 8 materials with `renderer.compileAsync(group, camera, targetScene)`.
  A group of 8 keeps Chrome's first status query short: one query waits behind every compile issued before it, and
  138 programs at once made it wait 0.4 s.
- **Settle each program.** After a group's `compileAsync` resolves, call `getUniforms()` once on each new program in
  `renderer.info.programs` (three's first use, `onFirstUse`: the info log, link status and uniform queries). Yield
  (`yieldBoot`) whenever 12 ms have passed since the last paint.
- **Warm one new program per task.** `warmRender` builds its batches so that each holds at most one object whose
  program has not been drawn yet, plus up to 64 objects whose programs have. It yields between batches as now. The
  same holds for the variant passes. On a driver where a first draw is expensive (Safari, slow mobile GPUs) each pause
  is then one program.
- **Draw nothing unsettled.** The bakes (`terrain.fields`, `terrain.colour`, `terrainHeights`, `grass.bake`),
  `warmRender` and the first `post.render` draw only with settled programs. Constructors that bake during world
  construction (the ones that render a texture in their constructor, such as `GroundBakes`, `Water`, `LifeField`,
  `CloudShadows`) either settle their materials through the helper first or move the bake into `boot()` after the
  programs settle.
- **QA probe for stray compiles.** In QA builds, boot wraps the context's `getProgramInfoLog` (three calls it only
  inside first use, with `debug.checkShaderErrors` on, as it is by default) and counts calls made outside the
  settle helper. `window.__stats.bootStrayPrograms` holds the count and the first few programs' material names.
  `tools/start-check.mjs` requires 0.
- **Cold shaders on demand (QA).** Browsers cache compiled programs across visits (Chrome's GPU disk cache, WebKit's
  cache), so a tester's second load hides the problem. `?coldshaders` (QA builds only) adds a never-taken
  `if (gl_FragCoord.x < -<random>) discard;` at the top of every fragment `main`, so every load is a first visit. A
  comment is not enough: WebKit caches translated code, which drops comments.

### World construction: no step longer than one paint budget

Yield between all major systems, as now. Additionally:

- `CloudStairs` (≈280 ms on this Mac) builds through a generator, flight by flight, run with `prepareInBatches`.
  `AutumnBirches` (≈100 ms) gets its own step after it. Keep `birches.scarf.settle()` in batches as now.
- Any constructor above 50 ms on this Mac in Chrome gets its own step. Measured: `Traveller` 78 ms,
  `SleepingIsland` 48, `DrownedVillage` 38, `lineField` 34.

### Progress: stage and fraction, reported from the boot path

The start screen (`src/start-screen.ts`, in the entry chunk) owns the indicator and exposes `progress(stage,
fraction)`. Four stages with fixed shares of the number. A laptop finishes in 2.5 s, where no weighting shows; the
shares matter on a slow device. The table's shares are a first iPad visit's. Phase 2 measures the stage times of a
cold Chrome load at 4× CPU throttling and sets each share to the mean of the two, rounded to whole percent, because
the playtester was on a Samsung tablet and the iPad's shares alone would leave the number near 5% through a long
construction stage:

| Stage | Line (approved 2026-10-02) | Covers | Share | Fraction within the stage |
| --- | --- | --- | --- | --- |
| A | Downloading the game | `index.html` until `main.ts` starts evaluating | 0–3% | none: the line is static HTML with no number; `main.ts` starting shows 3% |
| B | Building the world | World construction in `main.ts` | 3–9% | completed construction steps / `BUILD_STEPS` |
| C | Preparing the graphics | Compiling, settling and first-drawing programs (`warmRender` included) | 9–94% | settled materials, then warmed batches, over both counts collected up front |
| D | Laying out the ground and grass | Bakes, window, grass tables, post, `gpuIdle` | 94–100% | completed steps / steps counted before starting |

The displayed percentage is an integer and never falls. The D line reads up to 100% and nothing else shows at 100%:
Begin replaces the line as `ready()` fades it with the cygnet, as "Loading" fades today. `BUILD_STEPS` is a constant;
`start-check` fails if the steps counted in a real boot differ from it, so adding a construction step means updating
it.

Stage A's words are written into `index.html`, because they show before any game code has downloaded. `progress`
writes the stage line and the number with one `textContent` each per change. The line is `aria-hidden`; the existing
`#start-status` live region announces stage changes only, never percentages.

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
- For finished players, the Chapters link fades in where this line sits; the line must be gone first, which fading
  with the cygnet already ensures.
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

All on a production or QA build, never a dev server, with no other Chrome capture running.

| Check | Before (2026-10-02) | Gate |
| --- | --- | --- |
| Chrome, this Mac, cold profile: worst veil frame gap | 400–450 ms | under 150 ms |
| Chrome, CPU throttled 4× (`Emulation.setCPUThrottlingRate`): worst gap | 1.6 s | under 500 ms |
| Chrome, this Mac, cold profile: time to Begin | 2.5 s | 2.8 s or less (groups of 8 add status polling) |
| Stray first uses (`__stats.bootStrayPrograms`) | every program (first use happens in draws and bakes) | 0 |
| Jeremy's iPad, LAN QA preview with `?coldshaders&start=1` | freezes for seconds | Jeremy sees no freeze (the wind lines may step) |

