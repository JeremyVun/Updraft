# Boot and the loading veil

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
  at once: when 8 are in flight it settles the finished ones until 4 or fewer remain. Eight keeps Chrome's status
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

All on a production or QA build, never a dev server, with no other Chrome capture running.

| Check | Before (2026-10-02) | Gate |
| --- | --- | --- |
| Chrome, this Mac, cold profile: worst veil frame gap | 400–450 ms | under 150 ms |
| Chrome, CPU throttled 4× (`Emulation.setCPUThrottlingRate`): worst gap | 1.6 s | under 500 ms |
| Chrome, this Mac, cold profile: time to Begin | 2.5 s | 2.8 s or less (groups of 8 add status polling) |
| Stray first uses (`__stats.bootStrayPrograms`) | every program (first use happens in draws and bakes) | 0 |
| Jeremy's iPad, LAN QA preview with `?coldshaders&start=1` | freezes for seconds | Jeremy sees no freeze (the wind lines may step) |

