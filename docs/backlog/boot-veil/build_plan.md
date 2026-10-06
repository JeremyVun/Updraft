# Boot veil: build plan

Read `design.md` in this folder first; it is the spec, and its Gates table is binding. The boot contract is
`docs/engine.md` (Boot) and the checks are in `docs/testing.md`. Phases run in order: phases 1 and 2 both edit
`src/main.ts`, and phase 3 styles the line that phase 2 writes. One build agent at a time. Commit after every step.

Every measurement is on a QA build (`npm run build:qa`, then `npm run preview:qa` or `vite preview --outDir dist-qa`
on a port of your own, after confirming the listener's cwd), never on a dev server. Check `ps` for Chrome above 20% CPU
first, and say in the report if another session's capture was running. Run captures, builds and checks in the
foreground, and report once at the end.

## The arithmetic behind the gates

- A first draw of a new program costs about 200 ms on Safari and is slow on mobile GPU drivers, so `warmRender`
  batches carry at most one new program. Splitting adds one wait for the next paint (`yieldBoot`: one
  `requestAnimationFrame`, then `setTimeout 0`) per program, about 10 ms each, so up to about 2 s more on a slow
  device. That is the price of no freeze, and it is accepted; on this Mac's Chrome it must stay inside the 2.8 s gate.
- Chrome compiles in parallel. 138 programs issued at once made the first status query wait 0.4 s, so a group of 8
  should wait about 8/138 × 0.4 s ≈ 25 ms. 27 groups of polling at 10 ms intervals cost up to about 0.3 s, which gives
  the 2.8 s limit. The group size is a knob: change it if the gates demand, and record the measurement that justified
  it in `docs/engine.md`.
- World construction at 4× CPU throttling is 4× the 1× numbers. A 500 ms limit at 4× means no unbroken construction
  step above about 120 ms at 1×. `CloudStairs` (280 ms) must split. `AutumnBirches` (100 ms) fits on its own.
- Progress shares: start from the iPad's A 0–3%, B 3–9%, C 9–94%, D 94–100%; phase 2 averages them with a 4×-throttled
  Chrome load's measured stage times (design.md, Progress).

## Phase 1: programs compile in a window of 8, settle, and warm one new program at a time

Owns: `src/gl/boot.ts` (the helper and `warmRender`), `boot()` in `src/main.ts` and the construction-time bakes it has to move, `src/params.ts`
(`coldshaders`), the grass compile paths (`src/world/grass.ts` `precompile`, `precompileUnclipped`), the post chain's
compile (`src/post/post.ts`), the materials behind the duplicate program, `tools/start-check.mjs` (new assertion).

Build:

1. The compile-and-settle helper in `src/gl/boot.ts`, per design.md "Programs", and `warmRender` batches with at
   most one not-yet-drawn program each. The helper replaces `precompile` and
   `precompileSim`. Contract: it takes the jobs (objects, camera, target scene and render target) and an
   `onProgress(fraction)` callback. It resolves once every program those materials use has had its first use. It
   calls `yieldBoot` whenever 12 ms have passed since the last paint. Its fraction never falls and reaches 1 at the
   end. It must restore the render target and visibility exactly as `precompile` does today, even on failure.
2. Route every compile through it: scene materials for every variant (`otherVariants()`), `simMaterials`, the grass
   table materials and unclipped variants, and the post chain. Constructors that render a bake before `boot()` (find
   them with the probe from step 3; candidates are `GroundBakes`, `Water`, `LifeField`, `CloudShadows`, and the
   `onWindowMove` bake) either settle their materials through the helper first or move the bake into `boot()` after
   settling. Their outputs must be bit for bit unchanged; compare the baked textures before and after.
3. QA probe: wrap the context's `getProgramInfoLog` in QA builds and count first uses outside the helper into
   `window.__stats.bootStrayPrograms` (`{ count, names }`, with names from `material.name` or the program's
   `name`). `start-check` asserts count 0 and prints the names when it fails.
4. `?coldshaders` (QA only, ignored in production like every query param; `tools/production-build-check.mjs` must
   still pass): the context's `shaderSource` adds `if (gl_FragCoord.x < -<random>) discard;` at the top of every
   fragment shader's `main`, using one random constant per page load. Add it to the query-param list in `AGENTS.md`.
5. The duplicate: one program is built three times (exact same vertex and fragment source). Find it by hooking
   `shaderSource`, `attachShader` and `linkProgram` in a cold Chrome load and grouping programs by source, then share
   the program, usually by sharing the material or giving it the same `customProgramCacheKey`. Afterwards the boot
   compiles 211 programs.

Verify (phase 1 gate): `npm run typecheck`; `npm run build`; `node tools/production-build-check.mjs`; on the QA
preview, `BASE=<preview> node tools/start-check.mjs` (stray programs 0) and `node tools/context-loss-check.mjs`
(the reboot after a lost context takes the same path). Run five cold Chrome loads with a longtask observer and report
the worst gap and the time to Begin. Phase 2 removes the 0.4 s construction task, so this phase only needs the
compile-time stall gone: no long task over 150 ms after construction ends. Spot-check that the game looks unchanged:
one `tools/play.mjs` still of the opening at `?shot`, compared against the same still from `main`.

Done marker: `Phase 1: done <commit>` here, with the measured numbers.

Phase 1: done fdf970b, merged to `main` at d15afd3 (2026-10-03) with the grade's other `SUN_GLOW` program added to the variant steps. Measured 2026-10-02 on QA previews of this build and of c7d6c15, back to back with
`tools/boot-profile.mjs` (fresh browser profile per run), while other sessions kept the machine busy:

| Chrome, this Mac | c7d6c15 | fdf970b |
| --- | --- | --- |
| 5 cold loads, 1×: worst long task after construction | 166 ms (median 77) | none over 50 ms |
| 5 cold loads, 1×: worst veil gap (the construction task, phase 2) | 533 ms | 483 ms |
| 5 cold loads, 1×: time to `#veil.ready` | 2618–4761 ms (median 3129) | 2790–3334 ms (median 3169) |
| 3 repeat loads in one profile (`WARM=1`): long task after construction | 573–655 ms | 0–67 ms |
| 3 cold loads, 4× CPU: long task after construction | 145–177 ms | none over 50 ms |
| 3 cold loads, 4× CPU: construction task; ready | 1750–1861 ms; 6886–7148 ms | 1625–1734 ms; 6654–7313 ms |
| 3 loads with `?coldshaders`: long task after construction; ready | (no `?coldshaders`) | 92–105 ms; 19.4–21.3 s |

The 0.4 s compile stall shows on a repeat load in one profile (Chrome's program cache); a first load in a fresh
profile on this Mac waits about 150 ms. Boot after construction takes the same time as before (median 1.34 s both);
in an earlier, quieter batch this build reached `#veil.ready` in 2552–2801 ms against 2740–2893 ms. Programs: c7d6c15
built 211 by Begin and 14 more in the first two seconds of play (36 of them full-screen variants with normals that
nothing drew, and the seed-copy pass three times); this build builds 193 by Begin, none in play, no exact duplicates,
and no stray first uses. Group size stays 8.

## Phase 2: world construction in short steps, and progress reported

Owns: the top-level construction in `src/main.ts`, `src/world/stairs.ts` (`CloudStairs` construction only), any
constructor split it needs, `progress()` in `src/start-screen.ts` (DOM writes only, no styling), `warmRender` in
`src/gl/boot.ts` (culled objects and sim passes, step 5), and `tools/start-check.mjs` (the `BUILD_STEPS` assertion).

Build:

1. `CloudStairs` builds through a generator (flight by flight), driven by `prepareInBatches`. The stairs' geometry
   must be identical: compare vertex and index arrays before and after.
2. Each constructor above 50 ms at 1× gets its own step (see design.md, World construction). Re-profile with
   `tools/boot-profile.mjs` against the QA preview to find any others.
3. `startScreen.progress(stage, fraction)` per design.md "Progress", with stages B, C and D reported from
   `main.ts`. The helper's `onProgress` and the `warmRender` batches feed C. D counts its steps before starting.
   Measure the stage times of three cold Chrome loads at 4× CPU throttling and set the shares as design.md says;
   record both sets of numbers here. The number is an integer and
   never falls. Write the stage line and the number into the D1 elements (phase 3 adds them to the markup; until then
   create the two spans inside `.veil-loading` if they are missing, and phase 3 replaces that with static markup).
   `#start-status` gets the stage line on each stage change only.
4. `BUILD_STEPS`: count the construction steps in a real boot into `__stats.bootSteps`; `start-check` asserts they
   equal the constant.
5. Every program first drawn behind the veil (design.md, "Every program is first drawn behind the veil"): the warm
   draws objects that frustum culling skips today, and each sim material draws once into a scratch target of the
   format it really writes. Prove it with a QA probe in the style of `bootStrayPrograms`: count programs first drawn
   after Begin (by program, from three's `renderer.info.programs` or a `useProgram` hook) through the opening minute of
   play and a `?chapter=stairs` load, and report the names. The simulation's state and the bakes stay bit for bit.
   Each of these first draws joins stage C's warm count.

Verify (phase 2 gate): typecheck and build; `start-check` on the QA preview; `boot-cloth-check.mjs` (the scarf's
settle is untouched); five cold Chrome loads at 1× (worst gap under 150 ms, Begin at 2.8 s or less) and three at 4×
CPU throttling (worst gap under 500 ms). Record the percent sequence of one 1× load and check that it only rises and
reaches 100 exactly when `#veil.ready` appears.

Done marker: `Phase 2: done <commit>` here, with the measured numbers.

Phase 2: done 0a98c6f (branch `boot-veil-p2`, main merged in at 0a90e86), 2026-10-03. Measured on QA previews of
this build and of 4bfadd7 (both with the first-draw probe), alternating run by run with `tools/boot-profile.mjs`
(fresh browser profile per run), while other sessions kept the machine busy (Xcode's sourcekit near 100% CPU in the
last batch, a Godot game build in earlier ones):

| Chrome, this Mac | 4bfadd7 | 0a98c6f |
| --- | --- | --- |
| 5 cold loads, 1×: worst veil gap | 400–433 ms | 100–133 ms |
| 5 cold loads, 1×: time to `#veil.ready` | 2756–3056 ms (median 2973) | 2806–3333 ms (median 2901) |
| 3 cold loads, 4× CPU: worst veil gap | 1617–1650 ms | 400–433 ms |
| 3 cold loads, 4× CPU: time to `#veil.ready` | 6892–7009 ms | 6899–7001 ms |
| Programs first drawn after Begin, opening minute (pairs with target format) | 20 (39) | 0 (0) |
| Programs first drawn after Begin, `?chapter=stairs` minute | 22 (22) | 0 (0) |
| `start-check`: stray first uses; construction steps | 0; none counted | 0; 25 of `BUILD_STEPS` 25 |

Begin's 2.8 s limit is not readable on this machine today: the unchanged build takes 2.76–3.06 s; back to back this
build is as fast (an earlier, quieter batch: 2792–2877 ms against 2836–3082 ms). The longest construction task left
is `AutumnBirches` (about 105 ms at 1×, 410–434 ms at 4×); `Traveller` is about 70 ms. Percent sequence of one 1× load
(ready at 2750 ms): 4 6 7 9 10 12 … 39 41 (Preparing the graphics) 41 42 … 63 72 … 94 95 (Laying out the ground and
grass) 95 96 97 98 99 100, only rising, with 100% written in the same task as `#veil.ready`. A seeded load hashes
identically to 4bfadd7 (every scene geometry, matrix and visibility, and all 29 render targets the scene samples,
bakes and simulation state included), the stairs' arrays match the old constructor's, and the `play.mjs` still of the
opening is byte-identical.

Shares, stage times in ms (mean of 3 cold Chrome loads at 4×): A 276, B 4803, C 1551 (settle 896, first draws 655),
D 260 (total 6890); repeated after the last change: A 279, B 4849, C 1572, D 250. As shares: A 4.0, B 69.0, C 23.0,
D 4.0; the iPad's: A 3, B 6, C 85, D 6; mean, rounded to sum to 100: A 0–3, B 3–41, C 41–95, D 95–100. Within C,
settling 60%.

## Phase 3: the D1 line (visual work: Opus or Astra only)

Owns: `index.html` (the veil's loading line), `src/styles.css` (`.loading-text` replaced), the markup hooks
`progress()` writes to in `src/start-screen.ts`.

Build to the exemplar in `comps/` (`d1-ipad-day-c37.jpg` is the hero) and `comps/d1.css`, per design.md "The
indicator's look":

1. Replace `.loading-text` ("Loading…" with its animated dots) with the stage line: the words, then the number in
   tabular figures. `index.html` carries "Downloading the game" with no number, so stage A shows before any script
   runs.
2. Type, opacity, shadow and spacing from `comps/d1.css`. The line fades with the cygnet when `ready()` adds
   `.ready`. It must be gone before the Chapters link fades in for finished players. Night veil: same line and colour.
3. `index.html`'s inline watchdog failure path and `startScreen.fail()` still show the failure text correctly where
   the line was.

Verify (phase 3 gate): stills at desktop 1440×900, iPad 1180×820 and phone 390×844, day and night, at stage C
mid-load and at the longest line ("Laying out the ground and grass 96%"), side by side with the exemplar. Open them
in Preview for Jeremy (`open -a Preview`). The phone's longest line must stay on one row. `start-check` passes,
including its failure-path screenshot. Measure the day-veil contrast on the iPad frame mid-load; it should match
the exemplar's 3.2:1 within 0.2.

Done marker: `Phase 3: done <commit>` here, with the stills' paths.

Phase 3: done 16973bc (branch `boot-veil-p3`), 2026-10-03. Stills from `tools/veil-stills.mjs` on the QA preview, at
device scale 2, in `/tmp/updraft-bv-p3-stills/`: `veil-<desktop|ipad|phone>-<day|night>-<a|c|long>.png` (desktop
1440x900, iPad 1180x820, phone 390x844; `a` the static stage A line, `c` "Preparing the graphics 37%", `long` "Laying
out the ground and grass 96%"), and beside the exemplar in the comps' framing: `compare-ipad-day-c.png`,
`compare-ipad-night-c.png`, `compare-desktop-day-a.png`, `compare-phone-day-long.png`. The line's size, position, gap
and shadow match the exemplar pixel for pixel; `comps/d1.css` is ported unchanged. The phone's longest line is one
row, 248 px wide. Contrast on the iPad day frame at 37% (rendered glyph colour against the backdrop under the
shadow, the same method on both): 3.29:1, the exemplar 3.40:1; night 6.41:1, the exemplar 6.67:1 (its JPEG brightens
the glyph cores). Failure stills: `failure-retry-1280.png` (start-check), `failure-watchdog-ipad.png`,
`failure-permanent-ipad.png`. Checks: typecheck, build, `production-build-check`, `start-check` and `loading-check` on
the QA preview; `failure-paths-check` on a dev server (its entry-chunk block matches only the dev module name).

## Phase 4: verification and docs

Owns: `docs/engine.md` (Boot), `docs/testing.md`.

1. Run every row of design.md's Gates table on the final build and record the numbers here.
2. Jeremy's iPad: serve the QA preview on the LAN (`vite preview --outDir dist-qa --host`), give Jeremy the URL with
   `?coldshaders&start=1`, and ask him to load it twice and say whether it froze. If the playtester can retry on the
   Samsung tablet, the same URL (or production after deploy) settles their case.
3. `docs/engine.md` Boot: the compile, settle and warm rule (no program first used outside the helper; at most one
   new program per warm batch; the probe), the group size and why, the first-draw cost (about 0.2 s per program on
   Apple hardware, so every new program or variant lengthens a first visit), `?coldshaders`, and the progress stages
   and shares. `docs/testing.md`: the new `start-check` assertions and the throttled Chrome check. The project's
   query-param list in `AGENTS.md` gets `coldshaders` (phase 1 adds it).

Done marker: `Phase 4: done <commit>` here, with the gate numbers and Jeremy's iPad verdict.

Phase 4 gates measured 2026-10-03 on QA previews of 558fff2 (phase 3 merged) and of a783f6a (`main` before phase 1),
alternating run by run with `tools/boot-profile.mjs` (fresh browser profile per run). No quiet window came in 20
minutes of waiting: a Godot game (`Bayview Nights`) held 75–78% CPU through every batch, with `secd` and, before the
first batch, an iOS simulator and `xcodebuild` also busy.

| Chrome, this Mac | a783f6a | 558fff2 | Gate |
| --- | --- | --- | --- |
| 5 cold loads, 1×: worst veil gap (two batches) | 400–417 ms; 417–450 ms | 100–117 ms; 100–117 ms | under 150 ms: met |
| 5 cold loads, 1×: time to `#veil.ready` (two batches) | 2887–3237 ms (median 3024); 2989–3066 ms (median 3047) | 2725–3167 ms (median 2875); 2778–2898 ms (median 2833) | 2.8 s or less: not confirmed on this loaded machine |
| 3 cold loads, 4× CPU: worst veil gap | 1600 ms (all three) | 417–433 ms | under 500 ms: met |
| 3 cold loads, 4× CPU: time to `#veil.ready` | 6740–6874 ms | 6813–6866 ms | |
| Stray first uses (`__stats.bootStrayPrograms`, `start-check`) | every program: 182 first used by Begin, no settle step | 0 | 0: met |
| Programs at Begin | 220 created, 182 used | 202, all settled and first drawn | |
| Programs first drawn after Begin, opening minute (with target format) | 15 (14 of them created in play) | 0 (0) | |
| Programs first drawn after Begin, `?chapter=stairs` minute | 22 (19 created in play) | 0 (0) | |

Begin is 150–210 ms sooner than the unchanged build in both batches, but the unchanged build itself reads about
3.0 s here against the 2.5 s it took when the gates were set, so the absolute 2.8 s limit is unreadable under this
load. Stage times at 4× (ms): A 269–294, B 4737–4755, settle 940–1017, first draws 578–601, D 244–265. The first
draws in play were counted with an outside hook on `useProgram` and the draw calls (the a783f6a build has no probe)
and, on 558fff2, also with `__stats.playFirstDraws`.

Release checks on the 558fff2 QA preview: `start-check` (worst boot gap 100 ms, stray 0, construction steps 25 of 25,
no program first drawn in the first seconds of play), `context-loss-check`, `boot-cloth-check`, `loading-check`,
`chapter-select-check`, `production-build-check` and `failure-paths-check` (its blocked-entry case now matches the
built `assets/index-*.js` as well as `src/entry.ts`) all pass. The iPad row is pending Jeremy's verdict.

## Windows follow-up: shader compilation (2026-10-06)

Scope: the Windows extension in `design.md`. Preserve all effects, the 220 programs, warm draws before Begin,
simulation behaviour and the existing visual/state gates. The physical Samsung tablet model is unknown; Jeremy
confirmed Chrome, but it has not been tested here. This does not close the older pending iPad verdict.

Implementation:

1. Isolate native compilation cost on the normal D3D11 backend. The same live shader inputs settle in 143 s on
   D3D11 versus 5.2 s on Vulkan in Chrome for Testing 149. Individual program experiments then use CFT 153.
2. Keep scene noise octaves and height noise corners/octaves in uniform-bounded loops. Share the sky radiance used
   by the three fog veils and the terrain caches' direct fallback calls. Do not remove shader effects or move
   compilation into play. Preserve the static noise loop in short simulation shaders: the first broad version
   changed grass motion, despite tiny primitive-noise differences, and failed the existing image gate.
3. Check actual GPU noise output, all chapter views, default-Windows startup and gameplay, controls and context-loss
   recovery. Record browser/backend and cold-cache conditions. The Windows reference-machine startup guard is 60 s,
   compared with 160 s for the unchanged QA baseline on CFT 153. Existing Mac frame-gap gates remain separate.
4. Make the capture/performance harness use the platform backend and shared lock. Make production-build checking
   portable (Node temporary directories; its direct-grass marker also needed updating for the existing reed code).
   Fix two pre-existing descending smoothstep expressions in the owl that the shader gate found: one dead term and
   the eye-glow ramp, expressed with ascending edges.

Evidence so far (Ryzen 5 9600X, RTX 4070 Super, CFT 153.0.8010.12, one GPU check at a time):

- Frozen baseline `d5a4941e`, QA, `coldshaders`: ready 160.075 s; settling 153.347 s; 220 programs.
- First loop/call-sharing fix: ready 51.825–53.098 s. Rolling the four height-noise corners reduced this to 38.868 s.
  The final shader version restores static simulation noise for visual parity: three cold loads take 44.849,
  43.808 and 44.924 s; settling takes 40.537, 39.594 and 40.616 s. All 220 programs remain. Worst veil gaps are
  700, 700 and 717 ms, versus 2250 ms in the unchanged baseline; the stricter 500 ms veil gate is not yet met.
- An extra paint yield between height-atlas patches did not remove the remaining pause (44.943 s ready, worst gap
  900 ms during settling), so it is not included. First-use driver/compositor pauses remain a separate follow-up.
- Primitive noise: 294,912 samples on each of D3D11 and Vulkan; worst difference under 6e-8. No GL errors.
- Vulkan before/after: all 13 views pass, including portrait, dark wood and stairs. Maximum channel difference 2/255;
  most views are pixel-identical. Same-build washing control is pixel-identical. Height parity remains 0.01206 m.
- Default D3D11 before/after: lines, meadow, wood, sea and stairs all pass. Worst mean channel difference 0.000286/255;
  at most 0.000521% of pixels differ by more than 8/255. Character/camera differences remain below 5e-8 m and height
  parity is 0.01037 m. These comparisons use the frozen baseline, not a different backend as the reference image.
- D3D11 gameplay, dark wood at 1600x900, ratio 1, MSAA 4: 600 measured intervals over 10 s; p50/p90 16.7 ms,
  p99/max 16.8 ms, no intervals over 25 ms and no long tasks. No programs or program/target pairs first drawn in play.
  The existing D3D shader compiler warnings about potentially uninitialized helper results remain; no runtime errors.
- Context loss on D3D11: saved and fresh games recover through a real reload; startup loss also recovers.
- `start-check`: desktop and emulated-phone Begin/Continue, native audio, chapter pick, reduced motion, quality
  step-down, blocked painting fallback, bundle failure/retry and QA bypass pass;
  all active loop-bound uploads are correct (149 noise-octave, 8 height-octave and 8 corner bindings).
  This functional run used `BOOT_MAX_MS=1000` to continue past the known smoothness failure; its measured gap was
  616.7 ms, still above the unchanged default 500 ms gate. No new programs are first drawn after Begin or Continue.
- The first phone fixture tapped 15 ms after its injected drag ended: Chrome delivered pointer down/up but no
  click; a second tap worked. The fixture now separates those gestures by 350 ms, and the full rerun passes.
  This observation does not diagnose the physical Samsung tablet.
- Typecheck, production/QA builds, shader bounds, production QA exclusion, and cloth equality pass.

Reports: `C:/tmp/updraft-windows-baseline-153.json`, `C:/tmp/updraft-windows-final-cold-*.json`,
`C:/tmp/updraft-windows-parity-final-vulkan.json`, `C:/tmp/updraft-windows-parity-d3d11.json`,
`C:/tmp/updraft-noise-loop-check.json`, `C:/tmp/updraft-noise-loop-vulkan.json`, `C:/tmp/updraft-context-loss.json`.

The Windows compilation fix is implemented and verified locally; it has not been deployed. Remaining: the stricter
veil-gap target and physical Apple/Samsung validation of these shader changes. The original phase 4 stays open.

### Conservative fog follow-up (2026-10-06)

Jeremy prioritised avoiding any visual regression over further loading gains (verbatim ruling in `design.md`).
Only the duplicate fog calls in `wood-shape.ts` change: the stump/rock shader shares its fogged colour across the
two material branches, and the additive coal pool shares `fogOf` while retaining both colour mixes and their
subtraction. Water variants and remaining terrain loops stay unchanged.

Verification against the frozen pre-change QA build (`e97f16b` runtime), CFT 153.0.8010.12:

- Six fixed-frame views of the actual owl bend (dark, antler shadow and side-lit reveal, landscape and portrait)
  are pixel-identical on D3D11, and all six are separately pixel-identical on Vulkan. Both affected meshes issue
  draws. Hiding them changes 148,695 pixels in the portrait reveal, confirming that the comparison sees them.
  These are staged rendering checks of the real meshes, materials, lighting and post chain, not a playthrough.
- Captured GLSL confirms only the two expected fragment shaders changed; all other programs and vertex sources
  match. Three forced-cold isolated compilation trials per version, alternating order, give median times of
  2.480 to 1.245 s for stump/rock and 1.842 to 0.855 s for the pool. Every link succeeds with no GL error. These
  isolated savings cannot be added directly to startup time, since the game compiles programs concurrently.
- Typecheck, production/QA builds and the shader-bounds check pass. Physical Apple/Samsung validation remains open.
- Full D3D11 forced-cold startup: 44.556 s ready, 40.282 s settling, all 220 programs linked, no startup errors.
  This falls within the preceding version's 43.808–44.924 s range, so no overall startup improvement is established.
  The worst veil gap remains 700 ms; the existing 500 ms smoothness target is still unmet.

Evidence: `C:/tmp/updraft-fog-parity.mjs`, `C:/tmp/updraft-fog-{d3d11,vulkan}.json` and matching PNGs;
`C:/tmp/updraft-fog-compile.mjs`, `C:/tmp/updraft-fog-compile.json`, `C:/tmp/updraft-fog-cold.json`.

### Compile scheduling follow-up (2026-10-06)

The four preceding cold profiles all finish waiting on terrain variant #203: it starts around 30 s and finishes
at 41.6–42.6 s. The fog changes do not shorten that final wait. Experiments keep the shader inputs, program variants,
all first draws before Begin, and the world/simulation construction order unchanged.

Keep two scheduling changes: enqueue the terrain's variants before the general jobs (later jobs reuse the same
programs), and refill the eight-program window as soon as one slot is free, rather than waiting for four slots.
Only compilation order and submission timing change; no shader arithmetic or quality settings change.

Cold D3D11 measurements, CFT 153.0.8010.12, Ryzen 5 9600X / RTX 4070 Super:

| Scheduling | Time to Begin | Worst veil gap | Decision |
| --- | --- | --- | --- |
| Before | 44.556 s; fresh control 43.755 s | 700; 767 ms | Reference |
| Terrain first, original refill | 42.731 s | 700 ms | Some benefit |
| Terrain first, 16-program window | 38.452 s | 1434 ms | Rejected: longer freeze |
| Refill each slot, original order | 43.179 s | 733 ms | Little benefit alone |
| Terrain first, refill each slot, eight-program window | 38.397; 40.329; 40.707 s | 717; 750; 700 ms | Kept; output/startup checks pass |

All runs link the same 220 programs without startup errors. The retained combination saves about 4 s at the
median (roughly 9%) against the two reference loads, with the existing approximately 0.7 s first-draw pause still
present. The fresh control had a production build running briefly during compilation; the earlier 44.556 s
reference did not. Physical Apple/Samsung timing remains unmeasured, and the 500 ms veil target stays open.

Profiles: `C:/tmp/updraft-schedule-early-terrain*.json`, `C:/tmp/updraft-schedule-refill-only.json`,
`C:/tmp/updraft-schedule-control-1.json`, `C:/tmp/updraft-schedule-confirm-{1,2}.json`.

Default-D3D11 verification against the frozen pre-scheduling QA build: island, sea and stairs are pixel-identical,
with identical character/camera state and CPU/GPU height parity 0.01037 m. The full retained set of 219 program
source pairs (vertex plus fragment) hashes identically in each comparison; boot linked 220 before the unused post
variant was released. No stray first uses and no programs or program/target pairs first drawn in play in any view.
Harness and report: `C:/tmp/updraft-schedule-parity.mjs`, `C:/tmp/updraft-schedule-parity-d3d11.json` and matching PNGs.

Focused existing `start-check` assertions through Begin and quality step-down pass on D3D11: veil animation and
pointer strokes, paused/silent ready screen, keyboard Begin with native audio, 25/25 construction steps, all 165
active loop-bound uploads correct, no stray programs or programs first drawn after Begin or quality changes.
Changing MSAA still first-draws existing programs into the new sample count, as allowed by the engine contract.
This run used `BOOT_MAX_MS=1000`; its measured 616.7 ms veil gap still exceeds the unchanged default 500 ms gate.
This is the focused portion, not a repeat of the entire start-screen suite. Typecheck and production/QA builds pass.
Evidence: `C:/tmp/updraft-schedule-start-check.mjs`, `C:/tmp/updraft-schedule-start-check.json`.

### Terrain samples and water programs (2026-10-06)

The scheduling/fog changes were committed and pushed as `10ab475` before this investigation. Jeremy then asked for
larger improvements and clarified that imperceptible pixel differences are acceptable, with captures for his review.

Two changes preserve effect counts and the work completed before Begin:

- Terrain: evaluate the same centre, x-offset and z-offset heights in a uniform-bounded three-iteration loop. Keep
  the offsets and normal arithmetic unchanged. The frozen `uGroundSamples = 3` belongs to the terrain material;
  simulation noise stays unchanged. This avoids three compiler expansions of the large height helper.
- Water: replace the small under-land early exit's `LAND_SKIP` program axis with `uLandSkip`. Keep its safe footprint
  test and return colour. Cloud-deck and sea-quality effects still have their separate programs. Water now needs
  six programs instead of twelve, and boot links 214 instead of 220. The profiler and render-cost fixtures follow
  the uniform; the profiler retains compatibility with older comparison builds.

Rejected probes: rolling the footprint's nine-by-eight loops or the field search did not materially improve isolated
terrain compilation. Diagnostic omission of footprints, fields or fog was only an upper-bound experiment, not a
proposed visual change. Sharing the three height samples reduced one isolated terrain link from 6.494 to 4.373 s.

Cold D3D11 startup on the same Ryzen 5 9600X / RTX 4070 Super, CFT 153.0.8010.12:

| Build | Time to Begin | Programs |
| --- | --- | --- |
| Pushed scheduling baseline | 38.397, 40.329, 40.707 s; fresh control 39.397 s | 220 |
| Water consolidation alone | 36.948 s | 214 |
| Water plus shared terrain samples, first trial | 31.252 s | 214 |
| Final repeated cold loads | 31.750, 31.357, 31.319 s | 214 |

The final median is 31.357 s: about 8–9 s (20–22%) faster than the scheduling baseline. No other GPU check ran during
these loads. The worst veil gaps in the three final loads are 683, 717 and 700 ms; the existing 500 ms gate remains
unmet. The largest measured main-thread long task was 605 ms. All loads complete without startup errors.

Targeted vertex-output verification (`tools/terrain-samples-check.mjs`): 1,572,864 samples on each backend, across all
eleven island patches plus the moving window, four leaf sizes, atlas and direct fallback, both height-filtering
paths, and main/mirror geometry. D3D11 heights match exactly, with largest normal-component difference 7.05e-6.
Vulkan heights and normal components match exactly. No GL errors. This tests the actual vertex calculations using
floating-point point draws, rather than just the height function in a fragment shader.

Runtime probe for the terrain change alone: alternating GPU timer queries at 1600x900, main scene and terrain alone,
in island, sea and stairs. Whole-scene medians were 1.121→1.163, 0.833→0.846 and 1.465→1.493 ms; paired ratios were
1.057, 1.004 and 1.018. These small increases are recorded rather than claiming a rendering speedup. They exclude
simulation and post-processing and are not measurements of phone or Apple hardware.

Reports: `C:/tmp/updraft-heavy-final-cold-*.json`, `C:/tmp/updraft-heavy-control-cold.json`,
`C:/tmp/updraft-water-uniform-cold.json`, `C:/tmp/updraft-terrain-{loop,stage}-probes.json`,
`C:/tmp/updraft-terrain-samples{,-vulkan}.json`, `C:/tmp/updraft-terrain-runtime-d3d11.json`.

The final combined build passes all 13 fixed-frame chapter/viewport comparisons on each of D3D11 and Vulkan.
Island, lines, meadow and portrait are pixel-identical on both. The largest mean channel difference is 0.166/255
on D3D11 and 0.174/255 on Vulkan; at most 0.282% and 0.303% of pixels respectively differ by more than 8/255.
The biggest visible pattern difference is in fine wake foam in the storm scene; matched storm and sea captures
were provided for Jeremy's review. Heights retain the prior CPU/GPU parity (0.01037 m D3D11, 0.01206 m Vulkan).
Character/camera drift stays below 0.00032 m. No stray programs or programs first drawn during play in any view.
Reports and PNGs: `C:/tmp/updraft-heavy-parity-{d3d11,vulkan}.*` and matching scene filenames.

Focused `start-check` through Begin and quality step-down passes: native audio, paused ready screen, 25/25
construction steps, all active fixed loop bounds uploaded correctly (including both terrain programs), and no
programs first drawn after Begin or quality changes. The allowed MSAA target-pair first draws remain. It used
`BOOT_MAX_MS=1000`; the measured 633.3 ms gap still fails the unchanged default 500 ms gate. Typecheck, production/QA
builds and shader bounds pass. This is not a full journey or a physical Apple/Samsung test.
Evidence: `C:/tmp/updraft-heavy-start-check.json`.

The vertex probe's `PERTURB=1` calibration fails as intended when the reference x-offset is changed by 10% (largest
normal-component difference 0.7304), confirming it detects a real normal regression. Water GPU timings were repeated
after warming both programs and using paired ratios to avoid GPU clock transitions biasing separate medians:
18 cases cover island/sea/stairs, all three sea-effect sets and both under-land states. Median paired new/old costs
range from 0.993 to 1.013; no meaningful water cost increase was established on this GPU. Report:
`C:/tmp/updraft-water-runtime-confirm-d3d11.json`; calibration: `C:/tmp/updraft-terrain-samples-perturbed.json`.

Final D3D11 stairs gameplay at 1600x900, ratio 1, MSAA 4: 600 frame intervals over 10 seconds, p50/p90 16.7 ms,
p99/max 16.8 ms, no intervals over 25 ms, no long tasks, and no new programs or target pairs first drawn in play.
The compiler still emits potential-uninitialized-helper warnings; the output and functional checks above pass.
Evidence: `C:/tmp/updraft-heavy-stairs-frames.txt`.

Jeremy approved the visual result on 2026-10-06: "yep it looks fine, that wake foam difference is acceptable".
Keep both optimizations; the visual review is complete. These changes follow the earlier `10ab475` scheduling push.
Production deployment and physical Apple/Samsung testing are not covered by this verification.
The original phase 4 and its 500 ms gate remain open.
