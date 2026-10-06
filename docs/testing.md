# Local checks

Every check runs locally from `tools/`; there is no CI. Browser tools default to the dev server on
`http://127.0.0.1:5230/` and take `BASE` for another server (use `npm run build:qa` then `npm run preview:qa`, or a worktree with its own
server, for anything long or visual: a dev server reloads on any `src` edit, including another session's). GPU checks
share one capture lock (`tools/lib/browser.mjs`), including `play.mjs`, so captures cannot distort timing checks.
Chrome for Testing uses Metal on macOS and the browser's default backend elsewhere; `ANGLE` explicitly selects a
comparison backend. No GPU blocklist override is used. Evidence goes under
`/tmp`. Node mechanics checks load TypeScript through `tools/lib/typescript.mjs` and need no browser.

## Groups

`tools/check.mjs` runs named groups sequentially and writes each check's log plus `results.json` to
`CHECK_OUTPUT` (default `/tmp/updraft-<group>-<time>`):

- `npm run check`: fast shader, parity, input, timing and engine mechanics, no browser.
- `npm run check:mechanics`: the quick group plus chapter, camera, gesture and story mechanics (about five minutes).
- `npm run check:browser`: shader backends, touch and viewport, chapter transitions, context loss, the start screen,
  saves, frame scheduling and chapter views. Needs a running server.
- `npm run check:audio`: the offline audio and score checks, in headless Chrome against a running dev server, no GPU
  (`audio-interruption-check` and `music-transition-audit` run separately).
- `npm run check:release`: mechanics, browser and audio, then the full playthrough. Allow at least an hour.

## Before a release

1. `npm run typecheck` and `npm run build`.
2. Run `node tools/production-build-check.mjs` to verify production ignores game query overrides and excludes QA
   modules. For the instrumented browser checks, run `npm run build:qa`, start `npm run preview:qa`, and run
   `BASE=<preview> npm run check:release`. QA assets live in `dist-qa/`; `dist/` remains the production build.
   Twenty of its checks fail on a preview without saying anything about the game: the audio group, `shader-browser`
   and `progress` import modules from `src/`, which a built bundle does not serve, and `frame-time-browser` finds the
   frame loop by a name minification removes. Run those against a dev server in a worktree nobody is editing:
   `BASE=<dev server> npm run check:audio`, then `node tools/<name>-check.mjs` with the same `BASE` for the three.
3. Jeremy owns the parts no local tool covers: a listening pass through the whole journey (see
   `docs/contracts/audio.md`, Open) and physical-device checks on his iPad (touch robustness, Safari fullscreen,
   performance, warmth and battery).
4. Deploy with `tools/deploy.sh` from a clean `main` (every deploy goes to production).

A failing check is fixed in the game unless it asserts behaviour Jeremy deliberately changed; then the check is
updated to the new intent, with the reason in the commit. Never widen a limit without writing down why the old one was
wrong.

Choose the focused checks relevant to a change; the playthrough is a release check, not something to run after every
edit.

## The whole journey

- `node tools/playthrough.mjs <prefix>`: Begin through every chapter to the closing line, reload the completed save, then
  Play again, with real pointer gestures and natural transitions in a fresh browser profile. Fails on exceptions,
  wrong chapter order, a stalled chapter or a missing ending. `REVIEW=1` records video and one-second frames (review
  them in order, not just chapter entries); `TRACE=1` records the camera for `tools/camera-intent-report.mjs`;
  `UNTIL=<chapter>` stops on entering it; `SAVE_FILE=<json>` continues from a captured checkpoint.
- `node tools/camera-review-strip.mjs <prefix> <first-frame> [count] [stride]`: chronological contact sheets from
  review captures.
- `node tools/play.mjs <out-prefix> '<json steps>'`: drive real gestures and capture frames for visual QA
  (`VIDEO=1`, `TOUCH=1`, `W`/`H`, `QUERY`).
- `node tools/cygnet-gates.mjs`: every shared moment and way of moving for the cygnet and child on the QA stage,
  against numeric limits.

## Focused checks

**Engine, rendering and input**

- `shader-check` (literal GLSL edge order) and `shader-browser-check` (float ramps on Chrome/Metal and software
  Vulkan, texture bytes in the browser; another compiler, not another GPU family or Safari).
- `render-parity-check`: seeded frozen scene comparisons against an unchanged build. Run with
  `COMPARE_BASE=<unchanged build> BASE=<changed build> node tools/render-parity-check.mjs /tmp/<dir>`; both frozen
  builds must expose `?shot`. `CASES=lines,wood,stairs` selects cases; `TIMEOUT_MS` allows an unchanged slow baseline
  to finish. Include a same-build control when investigating differences.
- `noise-loop-check`: compares the rolled scene/height noise to the original shader arithmetic on the GPU over
  294,912 samples, including negative coordinates and all six octave counts. Needs a dev server for source imports.
  Run on the default backend and a second backend (`ANGLE=vulkan` on Windows); this is not a physical mobile test.
- `terrain-samples-check`: compares the terrain vertex shader's shared height samples with three separate calls,
  reading normal components and heights as floats across every height patch, window boundaries, atlas/direct paths,
  filtered/manual height lookups and main/mirror geometry. Needs a dev server; run on the default backend and Vulkan.
  `PERTURB=1` deliberately moves the reference's x sample and must fail, to check the probe's sensitivity.
- `render-cost-check <chapter>`, `grass-quality-check`, `grass-unclipped-check`, `swan-shading-check`,
  `water-texture-check`, `terrain-check`, `terrain-fields-check`, `terrain-colour-check`, `terrain-heights-check`
  (after any island's shape or position change), `fields-border-check`, `height-bake-check`.
- `frame-time-check`, `frame-time-browser-check`, `frame-pacer-check`, `power-browser-check`, `wind-clock-check`,
  `wind-rate-check`, `wind-gesture-logic-check`, `quality-check`, `quality-browser-check`, `quality-setting-check`,
  `quality-menu-check`, `veil-controls-check`.
- `pointer-contact-check`, `pointer-pick-check`, `touch-viewport-check` (Chrome, not a Safari substitute).
- `start-check` (Begin, audio unlock, Continue, retry; the invitation low in the room painting, and centred when the
  painting is blocked, on desktop and phone; worst boot gap under `BOOT_MAX_MS`; no program first used
  outside boot's settle step, `__stats.bootStrayPrograms`; the construction steps a real boot counts equal
  `BUILD_STEPS`; fixed noise and terrain-sample loop bounds actually uploaded to every active program; no program first drawn in the first seconds of play after Begin, Continue or a chapter pick,
`__stats.playFirstDraws`), `startup-check`,
  `loading-check`, `boot-cloth-check`, `failure-paths-check` (including a blocked room painting: plain veil, working
  Continue), `context-loss-check`.
- After a change to world construction, boot or the programs (a new material or variant): on a QA preview, with
  nothing else busy on the GPU and back to back with the unchanged build, `RUNS=5 node tools/boot-profile.mjs` (worst
  veil gap under 150 ms, Begin at 2.8 s or less) and `RUNS=3 THROTTLE=4` (Chrome with the CPU slowed 4×, a stand-in
  for an older tablet: worst gap under 500 ms). See `docs/engine.md`, Boot.
- Windows startup regression: `RUNS=3 QUERY=coldshaders MAX_READY_MS=60000 BASE=<QA preview> node tools/boot-profile.mjs /tmp/updraft-windows-cold`
  on the Ryzen 5 9600X / RTX 4070 Super reference machine, with no other GPU work. Keep `ANGLE` unset: switching a
  player to Vulkan is not the fix. The report records browser/backend, all boot stages, program count, overlapping
  per-program waits and main-thread stalls. It rejects a failed veil posing as readiness. The 60 s startup budget
  is a Windows reference-machine regression guard, not a replacement for the Mac veil-gap gates above or a guarantee
  for every device. Use `TIMEOUT_MS=300000` for the unchanged baseline.
- `veil-stills.mjs [prefix]`: stills of the veil's loading line held at known text, desktop, iPad and phone, day and
  night, for comparing its look against the boot-veil comps.
- `fixed-matrices-check` (every chapter: no object fixed in place moves or keeps a stale world matrix).
- `nearby-check`, `bandage-cost-check`, `scarf-normals-check`, `drowned-gating-check`, `boat-mooring-check` (every
  frame the moored hull skips its contact tests, testing them would not have moved it).
- `stairs-haze-check`: landing mist volumes stay below the incoming flights' exposed treads and risers.
- Against another build, for changes meant to be exact: `scarf-exact-check` (`BASELINE=<checkout>`: the scarf's mesh
  and cloth byte-identical in lockstep, no browser), `audio-silence-check` (`OLD=<previous build's server>`: offline
  renders below −100 dBFS apart) and `wind-exact-check` (`COMPARE_BASE=<its server>`: the wind field and what the life
  pass reads of it bit for bit after 600 scripted ticks, `TICKS` for more).

**Camera**

- `camera-direction-check`: orbital clearance, eased turns, focus, dolly and height at 10–120 Hz, carry, attention,
  stable composition choices, interaction holds, exact paths and portrait resize.
- `crossing-camera-check`, `drowned-camera-check`, `storm-camera-trace`, `chapter-view-check`, `ending-view-check`
  (fails any staged view whose turn rate changes by 2.5°/s or more within a quarter second), `piano-frame-check`,
  `pond-view-check` (the meadow family seen stirring, running and lifting, then let out of the frame without the
  camera backing away from the child; both companions clear of the bank at the water).
- Browser: `camera-chapters-browser-check` (every chapter entrance, landscape and portrait),
  `crossing-camera-browser-check` (`CASE=crossing|sea`), `drowned-camera-browser-check` (`PORTRAIT=1`, `REVIEW=1`),
  `chapter-view-browser-check`, `journey-view-check`.

**Chapters and mechanics** (Node, real chapter code, no renderer)

- `plane-routing-check`, `meadow-route-check`, `meadow-plane-check`, `piano-logic-check`, `piano-growth-check`,
  `little-boats-logic-check`, `kite-logic-check`, `scarf-geometry-check`, `sail-flutter-check`, `sea-logic-check`,
  `sky-mirror-logic-check`, `sky-mirror-pointer-check` (`TOUCH=1`), `sleeping-logic-check`, `wood-logic-check`,
  `wing-care-check`, `flock-flight-check`, `boat-check`, `boat-ground-check`, `journey-pacing-check`,
  `geography-check`, `journey-reveal-check`, `crossing-haze-check`, `dream-story-check`, `foghorn-story-check`.
- The scarf's feel: `scarf-feel-probe` (Node: bounce, settling, creep, stretch and jitter) and `scarf-video` (true
  60 fps clips of each release and the gathering, `SUFFIX=before|after`).
- In the browser with real gestures: `lines-check`, `lines-view-check`, `little-boats-check`, `piano-check`,
  `scarf-check`, `stairs-check`, `storm-check`, `wood-check`, `ember-check`, `sea-check`, `sky-mirror-check`,
  `sleeping-check`, `summit-arrival-check`, `home-approach-browser-check`, `ending-check`, `landing-check`,
  `kite-check`, `geography-browser-check`, `boats-offshore-browser-check`.

**Saves and lifecycle**: `progress-check`, `progress-schema-check`, `chapter-select-check` (who is offered chapters;
the twelve 400x250 tiles; the list over the title's painting, opening fetching every painting once; a looked-at room's
painting crossfading in without the stack dropping below full cover; `back`, Escape and a press on empty space closing
without starting, `back` returning focus to `chapters`, a double click on `chapters` leaving the list open; the
phone list fitting without scrolling; a pick starts its room in place, with sound and the room's entry save, without
navigating, and the panel fades over its .45 s), `start-over-check` (no start over
without a save; the first press asks without starting; the question goes back after 6 s, on Escape and on blur; a
second press starts the first island in place with sound, its save replacing the old one; a press elsewhere on the
veil continues the save; the phone layout with `chapters`), `chapter-pick-check`
(every room picked on a page that loaded another room's save matches a fresh `?chapter=` load 3 s in; a room that
differs, as a late readback can make it, is played once more; `ONLY=wood,jetty` for some rooms), `analytics-check`, `analytics-browser-check`; see `docs/contracts/progress.md` and `analytics.md`.

**Audio** (offline, through a headless dev server, no GPU)

- Shared: `audio-check` (gesture thresholds and gates, cue timing, habitat, materials, clipping stress),
  `audio-continuity-check`, `audio-direction-check`, `gesture-harmony-check`, `arrival-audio-check`,
  `music-transition-audit` (every handoff and all score sections), `audio-interruption-check`, `piano-audio-check`,
  `flock-audio-check`, `marine-audio-check`, `birches-foley-check`.
- Scores: `opening-score-check`, `lines-score-check`, `boats-score-check`, `meadow-score-check`,
  `birches-score-check`, `dream-score-check`, `sleeping-score-check`, `sea-score-check`, `homeward-audio-check`.
- In the browser: `audio-browser-check`, `piano-audio-browser-check`, `arrival-audio-browser-check`,
  `transition-scenes-browser-check`, `opening-score-browser-check`, `homeward-audio-browser-check`,
  `meadow-score-browser-check`, `birches-score-browser-check`, `sea-score-browser-check`.
- Renders for listening: `opening-fall-render`, `ending-audition`, `stairs-audio-proposal`, `foghorn-preview`.

**Performance** (only when Jeremy asks; see `docs/engine.md`, Measuring): `perf.mjs`, `frame-profile.mjs`,
`boot-profile.mjs` (cold-load veil gaps and long tasks: `RUNS=<n>` fresh-profile loads, `THROTTLE=<rate>` CPU slowdown, `WARM=1` a second load in the same profile, `QUERY` such as `coldshaders`), `storm-profile.mjs`, `window-hitch.mjs`, `power-profile.mjs`, `quality-budget-profile.mjs`,
`audio-cost.mjs`, `wind-cost.mjs` (the wind step's GPU cost pass by pass), `memory-census.mjs`.

- `frame-profile.mjs <fixtures>`: paired ablations at a fixture, each reporting its bite (programs patched, objects
  hidden, draws, pixels changed) and throwing if it changes nothing. `ROUNDS=0` compares frames without timing.
  Among its ablations: `deck-out` and `deck-out-water|terrain|grass|sky|rest` (the cloud deck compiled
  out), the stairs' parts (`stairs`, `stairsCloud`, `stairsCloudTop`, `stairsCloudBelly`, `stairsTowers`,
  `stairsWake`, `stairsWisps`, `stairsBank`, `stairsHaze`, `stairsSteps`), `cloudtop-frag-flat`, `cloudtop-veil`,
  `water-lantern`, `water-hull`, `water-frag-flat`, `sky-flat`, and the candidate exact skips `sky-deckfirst`,
  `wisps-early`, `water-lantern-reach`. `SIM_PASSES=1` times each simulation pass alone; `LEVEL=<name>` applies a
  level's world settings. The header lists the rest.
- Against another build: `FRAME=600 COMPARE_BASE=<its dev server>` stops both on the same frame and reports the
  difference between them (`COMPARE_MAX=1` fails above 1/255, `CAPTURE=1` saves both frames); a build against itself
  reads 0.
- Stairs fixtures (`tools/lib/stairs-fixture.mjs`), for `frame-profile`, `memory-census` and `audio-cost`:
  `stairs:waiting|climb|loop|cloud|top|sail|fog` play the chapter to that moment, with real gestures, or on frames
  under `FRAME` so every run is the same.
- `memory-census.mjs <fixtures>`: every texture, render target and buffer the game holds, by owner, with what the
  watched frames used (`RATIO`, `MSAA`, `DETAIL`).
- `frame-profile` and `memory-census` patch `src/main.ts`, so they need a dev server (a worktree's own); `audio-cost`
  and `stairs-check` also run against `npm run preview:qa`.

Rendered checks, screenshots and numeric audio checks are evidence for review, not pixel baselines or a listening
sign-off.
