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
