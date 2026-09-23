# Local release checks

September 22 transition spot check: [results and listening clips](audio-transition-review.md).

- `node tools/music-transition-audit.mjs`: ten real Web Audio handoffs (104 checks) and forty adaptive
  sections; silence/reverb, source retirement, continuous landing clocks, stalled frames and same-piece entry.
- `node tools/journey-pacing-check.mjs`: all eight routes, two frame rates and varied wind/late gusts.
  Records both music preparation and final-approach readiness. A fast landing must preserve the full rest.
- `node tools/arrival-audio-browser-check.mjs`: the arranged final leg into Lines, after its farewell camera.
- `node tools/transition-scenes-browser-check.mjs`: natural Meadow → Birches and Sleeping → Sea departures.
- `node tools/piano-audio-browser-check.mjs`: real approach, stool fade and clear demonstration.
- `node tools/arrival-audio-check.mjs`: ten destination profiles and 78 checks, now using full musical rests.

September 22 approved opening integration:

- `node tools/opening-score-check.mjs`: 18 checks over the actual 215-second Web Audio render. Exact
  approved notes/timing/dynamics, D/F♯ resolution and delayed motif, complete loop, first crossing,
  fall/care withdrawal, 201 harmonically matched gesture notes, shared oscillator identity and Lines handoff.
  No clipping. Report: `/tmp/updraft-opening-score-check.json`.
- `node tools/opening-score-browser-check.mjs`: actual main-loop activation, first chord change,
  mute/resume, first crossing continuity and chapter cleanup, using a private server without env loading.
  Report: `/tmp/updraft-opening-score-browser.json`.
- The 81 audio-direction regression checks pass, including cue melodies and gesture gating.

September 22 homeward score checks:

- `node tools/homeward-audio-check.mjs`: approved voicing parity, full offshore form, five-second minimum
  rest including reverb, spatial readiness, suspension/stalls, landing continuity, story phases, finale
  takeover and oscillator cleanup. Writes `/tmp/updraft-homeward-audio.json` and a transition MP3 fixture.
- `node tools/homeward-audio-browser-check.mjs`: private Vite server without env loading or HMR;
  actual mirror berth, sailing physics, camera and audio entrance. The checked departure faded for
  3.013 seconds, kept 5.024 seconds of musical silence, and entered on route leg 1 at 30.76 units
  offshore. No browser errors. Screenshots and report: `/tmp/updraft-homeward-{entry,silence}.png`
  and `/tmp/updraft-homeward-browser.json`. This arranges the completed mirror departure, not its puzzle.
- `node tools/opening-summit-preview.mjs /tmp/updraft-opening-harmony-sept22 --harmony-revision`:
  revised three-minute opening audition. Seven render checks passed; first 47.8 seconds match the
  preceding full proposal within one PCM quantization step. New harmony remains pending listening.

The 71 ordinary-arrival checks also pass with Summit included in score identity/clock verification.
Its gesture fixture explicitly enables the opening voice; ordinary arrivals do not enable cursor chimes.

The project already has focused mechanics, checkpoint, GPU and gesture tests in `tools/`.
They run locally; GitHub Actions is not required. The checks serve different purposes:

Common groups run sequentially and preserve each check's log plus `results.json` in `/tmp`:

- `npm run check`: fast shader, parity, input, timing and engine mechanics checks.
- `npm run check:mechanics`: the quick group plus chapter, camera and gesture mechanics (including mouse
  and portrait touch Mirror collection). About five minutes locally.
- `npm run check:browser`: shader backends, touch/viewport, transitions, context loss, Begin, saves, frame
  scheduling and chapter views. Requires a running dev server; `BASE` selects it.
- `npm run check:audio`: every audio/score regression check that renders through a headless dev server
  without the GPU — gesture chimes and harmony, cue timing/continuity/direction, marine and foley sounds,
  and each room's approved score (Lines, Boats, Meadow, Birches, Sleeping, Sea, Mirror/Drowned, opening,
  homeward and arrival). Requires a running dev server; `BASE` selects it.
- `npm run check:release`: mechanics, browser and audio checks, then the continuous journey. Allow at
  least an hour. Listening/device QA below remain separate; this group does not replace them.

Set `CHECK_OUTPUT=/tmp/<name>` to choose the evidence directory. `tools/lib/typescript.mjs` is the shared
loader for Node mechanics fixtures. Camera/progress refactor checks read baseline source from Git, default
`188c9fa`; keep that history available or set `BASELINE_REF` to an appropriate pre-refactor revision.

Focused checks:

- `npm run typecheck` and `npm run build`: TypeScript and the production bundle.
- `node tools/plane-routing-check.mjs`: hidden-shore departure in four winds at 30/60/120 fps,
  committed pickup under sustained gusts, opening/birches exits, scarf targets and encounter gates.
- `node tools/meadow-route-check.mjs`: piano, crest/pond and departure routing, including restored bank walks.
- `node tools/meadow-plane-check.mjs`: guided flight, gust recovery, companion bounds and framing.

- `node tools/shader-check.mjs`: ascending/distinct literal GLSL edges and descending-ramp equivalence.
- `node tools/shader-browser-check.mjs`: float-shader ramps on Chrome/Metal and software Vulkan, plus
  original water-texture hashes through browser JavaScript. Requires the dev server. Software Vulkan
  exercises another compiler/backend, not another physical GPU family or Safari.
- `node tools/water-texture-check.mjs`: exact original texture bytes and settings at five resolutions.
- `node tools/nearby-check.mjs`: 2,000 nearest-creature comparisons, ties, boundaries and live populations.
- `node tools/camera-parity-check.mjs`: 7,200 exact original/refactored camera frames, including rotation.
- `node tools/progress-schema-check.mjs`: current/legacy checkpoint layouts and malformed-record parity.
- `COMPARE_BASE=http://127.0.0.1:5233/ BASE=http://127.0.0.1:5235/ node tools/render-parity-check.mjs /tmp/updraft-render`:
  12 seeded frozen scene comparisons against an unchanged build, actor/camera bounds, terrain parity and
  expanded shader-literal checks. Both servers should serve frozen production builds.
- `node tools/pointer-contact-check.mjs`: primary-contact ownership, cancellation, page lifecycle and viewport resize.
- `node tools/touch-viewport-check.mjs`: real browser multi-touch, cancellation, canvas/camera dimensions,
  portrait resize and fullscreen entry/exit. The browser-controls case models a reduced `innerHeight`;
  Safari's native fullscreen-dismiss gesture still requires an iPad check.
- `node tools/flock-audio-check.mjs`: wingbeat cadence, distance/mute backlog and resting/take-off gates.
- `node tools/chapter-view-check.mjs`: prepared camera/focus across chapter transitions without an extra story tick.
- `node tools/camera-direction-check.mjs`: shared composition decisions, orbital clearance, smooth turns,
  carry/anchor changes, interaction holds, exact paths, portrait resize and decision-layer CPU cost.
- `BASE=<preview> node tools/camera-chapters-browser-check.mjs`: all chapter entrances in landscape and
  portrait, checking continuous turns and declared primary subjects; saves frames for visual review.
- `node tools/crossing-camera-check.mjs`: departure/companions/arrival movement, whale pan and coverage,
  farewell continuity, 10–120 Hz response, plus 24 real-boat passages in landscape/portrait and calm/gusts.
- `node tools/drowned-camera-check.mjs`: village arc, church/spire coverage, sail and lighthouse framing,
  traveller visibility, static scenery obstruction duration and completion in landscape/portrait at 30/60 Hz.
- `BASE=<preview> node tools/drowned-camera-browser-check.mjs`: real village through forest landing,
  including pointer strokes to fill the becalmed sail; `PORTRAIT=1` selects a phone viewport.
  `REVIEW=1` adds one-second chronological frames; also supported by `piano-check.mjs`.
- `BASE=<preview> node tools/crossing-camera-browser-check.mjs`: rendered farewell, companions, whale,
  arrival and portrait pod/swim/shore checks. `CASE=crossing` or `CASE=sea` selects one passage.
  Use a fixed preview build when other tasks are editing the shared checkout.
- `node tools/chapter-view-browser-check.mjs`: real Sleeping/Home constructors at arranged crossing exits;
  checks the transition frame and captures the following view. Uses the shared GPU lock and supports `BASE`.
- `node tools/frame-time-check.mjs`: 100 ms catch-up cap, bounded world steps, gesture subdivision and fresh contacts.
- `node tools/frame-time-browser-check.mjs`: actual game loop at 10–60 fps, stalls, tab resume and one render per frame.
- `node tools/frame-pacer-check.mjs`: 30/60 fps presentation limits across 30–144 Hz displays, overload timing,
  stalls, resume and preset changes.
- `node tools/power-browser-check.mjs`: production pacing with the real game loop; render/audio counts, fixed
  60 Hz wind, elapsed game time and hidden-page resume in the island, birches and sky mirror.
- `node tools/power-profile.mjs`: paired completed-work rendering costs and water-shader pixel parity in five
  scenes, with old Retina/new High/Auto captures. Local GPU throughput, not iPad battery measurements.
- `node tools/frame-profile.mjs`: nine chapter-entry CPU profiles, per-pass/object draw census and frozen
  rendering ablations. Writes `/tmp/updraft-frame-profile.json` and Chrome `.cpuprofile` files. Set
  `ABLATIONS=''` for CPU/census only; `ABLATIONS=culling-off CULLING_VIEWS=1` also checks final-pixel parity
  with legacy culling disabled and near/edge views. `LEGACY_NORMALS=1` restores Three.js scarf normals in the
  test browser for comparison. Hold the shared GPU lock; don't run other CPU benchmarks during timings.
  `meadow:walk`, `meadow:crest`, `meadow:flock` and `meadow:pond` arrange later Meadow fixtures.
  `ABLATIONS=full-tint` compares conditional regional colour noise with its original unconditional work;
  `ROUNDS=0` runs pixel parity without timings. `FORCE_GRASS_BAKES=1 ABLATIONS=grass-tables` measures the
  extra cost of rebuilding all three blade tables, rather than assuming cache misses dominate.
- `node tools/terrain-fields-check.mjs`: GPU field-cache accuracy over the atlas, exact wall/gate masks,
  one-time bake behaviour and rendered life/season comparisons with and without grass.
  `ABLATIONS=fields-direct CAPTURE=1 node tools/frame-profile.mjs meadow:walk meadow:crest` measures the
  cache against the original calculation and saves paired images; differences must stay within 3/255 per
  channel and a mean below 0.005/255. `BASE` selects the server for both tools.
- `node tools/terrain-colour-check.mjs`: shared colour-pattern cache accuracy across every island and
  three seasons, original tint-formula parity, one-time bake behaviour and 18 rendered life/season pairs.
  `GROUND_VIEW=1 CAPTURE=1 CHAPTER=wood` exposes distant ground and saves a direct/cached image pair;
  repeat with `CHAPTER=meadow` and `sleeping`. `OUT` selects the JSON path and image prefix.
  `ABLATIONS=colour-direct CAPTURE=1 node tools/frame-profile.mjs island meadow:crest wood sleeping`
  measures the cache against direct noise calculations. Normal-view differences must stay within 3/255
  per channel and a mean below 0.01/255. Both tools support `BASE` and hold the shared GPU lock.
- `node tools/scarf-normals-check.mjs`: exact Three.js normal-array parity over 15 real scarf states and
  interleaved CPU timings. `node tools/scarf-geometry-check.mjs` checks contacts, releases and checkpoints.
- `node tools/wind-clock-check.mjs`: fixed tick timing, input exposure, stroke resampling, impulses and stalls.
- `node tools/wind-rate-check.mjs`: real GPU wind fields across render rates, in normal and lite simulation.
- `node tools/wind-gesture-logic-check.mjs`: pointer circles, updraft and scarf interactions at 30/60/120 Hz.
- `BASE=http://127.0.0.1:5230/ node tools/loading-check.mjs`: loading motif, animation, reduced motion and readiness.
- `node tools/quality-check.mjs`: governor promotion, fallback, exact overrides and suspend/resume.
- `node tools/boot-cloth-check.mjs`: exact cloth state parity across batched startup preparation.
- `node tools/analytics-check.mjs`: telemetry privacy, failure isolation and lifecycle counting.
- `node tools/startup-check.mjs`: Begin and tab-resume frame timing regression.
- `node tools/start-check.mjs`: keyboard/touch Begin, native audio unlock, Continue, reduced motion and
  bundle-load retry. Uses the shared GPU lock without bypassing browser autoplay restrictions.
- `node tools/context-loss-check.mjs`: real WebGL context loss, pause, reload and working wind readbacks.
- `node tools/failure-paths-check.mjs`: fault-injects a failed AudioContext, a thrown frame-loop exception,
  a blocked entry-module chunk and a missing EXT_color_buffer_float, and checks each recovers as intended.
- `node tools/playthrough.mjs /tmp/updraft-journey`: Begin through every chapter to credits, reload the completed
  checkpoint, then Play again. Uses only pointer gestures and natural story transitions, with a fresh browser
  profile. It fails on exceptions, wrong chapter order, a stalled chapter or a missing ending. Allow up to an hour.
  `REVIEW=1` records video and one-second frames; review those chronologically rather than only chapter entries.
  `UNTIL=<chapter>` ends a focused replay on entry. `SAVE_FILE=<json>` uses normal Continue from an actual
  captured checkpoint; it does not claim a fresh uninterrupted run.
- `node tools/camera-review-strip.mjs <capture-prefix> <first-frame> [count=30] [stride=2]`: chronological
  contact sheets from review captures, read left-to-right/top-to-bottom using the emitted column count and beat metadata.
  Inspect ambiguous frames at full size; this review does not replace physical-device or audio testing.
- `node tools/ending-view-check.mjs`: ending order, camera visibility, narrow screens, resize, resume and motif timing.
- `node tools/audio-check.mjs`: gesture thresholds/exceptions, cue timing, morning music, call spacing, habitat,
  material scheduling, stereo output, clipping stress and the final musical tail; requires the dev server, no GPU.
- `node tools/piano-audio-check.mjs`: short/long approaches at 10–144 Hz, first-key overlap, demonstration,
  single attenuation, departure and completed restoration.
- `node tools/audio-interruption-check.mjs [evidence.json]`: cues held through a simulated call and resume
  retries, piano voices across mute, the cached output graph, Begin synthesis and convolvers paced across frames
  without clicks, the arrival's spare reverb, the prepared foghorn and the retiring pinwheel voice; no GPU.
- `node tools/piano-audio-browser-check.mjs`: real approach and first notes through the production audio graph;
  holds the GPU lock and supports `BASE` for a fixed build.
- `node tools/audio-browser-check.mjs`: real game audio wiring across ten chapters, morning restore and a
  real wind gesture, both scripted whale crossings and muted marine events; holds the GPU browser lock.
  Arranged fixtures, not a listening pass.
- `node tools/marine-audio-check.mjs`: real whale/dolphin surface events at 10–144 Hz, replay, distance/pan,
  bounded pod sounds, finite unclipped audio and voice cleanup. Renders an isolated sample in `/tmp`.
- `node tools/boats-score-check.mjs`: approved Little Boats notes, clock, transitions, gesture coexistence and cleanup.
- `node tools/sea-score-check.mjs`: approved sea notes/timbres, adaptive sections, restore, gestures and voice cleanup.
- `node tools/sleeping-score-check.mjs`: approved Sleeping notes/timbres, player-paced rests and reverb silence,
  flight-only reward, gesture coexistence, morning entry and piano/pad cleanup.
- `node tools/meadow-score-check.mjs`: approved Meadow notes/timbres, piano/scene gates, checkpoint entry,
  player-paced loops, wind feedback, cleanup and unchanged pad clock/pitch glides.
- `node tools/meadow-score-browser-check.mjs`: four real piano sweeps, then the crest fixture through the
  flock departure and paddle; live score phases, mute/resume and retirement before leaving Meadow.
- `node tools/birches-score-check.mjs`: approved Birches note/instrument parity, sections/checkpoints,
  10–144 Hz loops, gesture harmony, voice cleanup and preservation of the shared pad's clock/glides.
- `node tools/birches-score-browser-check.mjs`: real swing brush and scarf circles, then an arranged final
  bow through release/gathering and boarding; live routing, mute/resume, gesture harmony and cleanup.
- `node tools/arrival-audio-check.mjs`: nine production destination renders, exact four-second background/reverb
  silence, wind/gesture continuity, landing phrase continuity, suspension and stalled-frame recovery; no GPU.
- `node tools/arrival-audio-browser-check.mjs`: arranged final sailing leg into Lines with the real game loop,
  audio clock and pointer; checks the gap, pre-landing melody and continuous phrase ashore; shared GPU lock.
- `node tools/gesture-harmony-check.mjs`: all 33 mood/score sections, cursor/updraft/glider notes, scheduled
  chord-boundary crossings, Sleeping rests, caring rescue and piano ownership; no GPU.
- `node tools/audio-transition-proposals.mjs`: historical rejected transition A/Bs in `/tmp`, with source hashes,
  matched lead-ins, chord timing and level measurements; this is not the later approved arrival pause.
- `node tools/sea-score-browser-check.mjs`: a complete long crossing with live score phases, mute/resume and
  release at the mirror; holds the GPU browser lock. Takes about three minutes.
- `node tools/audio-theme-preview.mjs`: piano reference, current home melody and proposed reprise in `/tmp`.
  `node tools/audio-review.mjs` renders the current nine mood presets; `PROBES_ONLY=1` runs scheduling probes.
- `node tools/ending-check.mjs /tmp/updraft-ending`: desktop and portrait reveal captures and video in real Chrome.
- `node tools/progress-check.mjs`: isolated checkpoint/restore fixtures, storage failures and audio lifecycle.
  This complements the continuous playthrough; it deliberately arranges story states to exercise saves quickly.
- `node tools/boot-profile.mjs /tmp/updraft-boot`: startup CPU profile, long tasks and blocking WebGL calls.
- `node tools/analytics-browser-check.mjs`: actual QA event delivery and offline isolation.

Browser tools default to the dev server on port 5230; `BASE` selects a production preview where supported.
The progress fixtures import source modules and require the dev server. Run GPU checks one at a time, with
other GPU-heavy work stopped. `playthrough`, start, progress, context-loss, boot-profile and analytics-browser share the capture lock.
Evidence is written under `/tmp`. Chapter screenshots are review evidence, not automatic pixel-baseline comparisons.

Choose the focused mechanics checks relevant to a change (`*-logic-check.mjs`, scarf, piano, wing care, etc.).
The full journey is a release check, not something to run after every small edit. Jeremy owns physical-device
performance/thermal testing and touch robustness. Local Chrome tests do not substitute for those device checks.

## Validation recorded 2026-09-20

The continuous pointer-driven run passed all 17 current chapters on published `b30fb70`, reached credits at
2,223 seconds (about 37 minutes), reloaded the completed checkpoint, and returned to a fresh island through
Play again. No page or console errors were captured. Evidence: `/tmp/updraft-e2e-final.json` and its chapter/credits
screenshots. The runner's expected route excludes the legacy `toWood` alias: the village leads directly to wood.

Focused local checks passed for GPU loss during play and startup, checkpoint reload and wind readbacks,
anonymous event delivery (HTTP 204), analytics failure isolation, the loading motif, governor behavior and
exact cloth-state parity after batched preparation. The checkpoint suite's current POI and entry cases,
replay, storage failures and audio lifecycle passed across the full run and its corrected home-fixture rerun.

The shared checkout was changing concurrently during this validation. The published journey result does
not certify those later scene/ending edits; run the journey again against the combined stable release build.
Dashboard readback of analytics remains unverified because the available browser requires Authelia sign-in.

Wind follow-up: `wind-clock-check` passed elapsed-time and input accounting at 20–240 Hz, changing frame
rates, stroke segmentation, source merging, one-shot impulses and bounded stalls. `wind-rate-check` passed
72 Chrome/Metal cases across 20–144 Hz in normal/lite, with identical fields for the five exactly resampled
patterns; circle velocity power differed by at most 2.4% and gust/lift fields by 3.6%. The loading motif check
passed moving paddles, desktop/portrait framing, reduced motion and stopping animations on readiness.

Bounded catch-up follow-up: the real game loop passed controlled 10/15/20/30/59/60 fps intervals in lines,
birches, wood and mirror (`/tmp/updraft-frame-time.json`). Each interval advanced one second of game time
and 60 wind ticks. Terrain selection, grass baking, sea-view rendering and audio updates ran once per frame.
Two-second stalls advanced only 100 ms without backlog; hidden time and stale resume timestamps were ignored.
Scarf circles completed in about 3.3 seconds at 10/15/30 fps; straight-stroke rejection, governor checks and
startup cloth parity passed. These are controlled timing checks, not a target-device throughput benchmark.

Audio follow-up: build/typecheck and 84 scheduling, story, habitat and material assertions pass. Five real
Web Audio renders passed output/clipping checks, including overlapping finale, thunder, distress and material
sounds. The caring chime was more than 8 dB quieter than the ordinary chime. These are bounded fixtures,
not an exhaustive clipping or perceptual test. Evidence: `/tmp/updraft-audio-check/checks.json` and its WAVs.
The real game loop passed eight chapter fixtures, morning music restoration and a real wind gesture without
page errors (`/tmp/updraft-audio-browser.json`). Sleeping logic and ending reveal/timing regressions also pass.
Full-journey listening remains necessary. Jeremy auditioned the home-melody comparison and chose the current
melody; the proposed reprise is rejected. New effects still need listening in context for artistic sign-off.

Piano approach follow-up: the background remains through walking/looking, fades once from sitting and
overlaps the child's first key. Short/long approach fixtures pass at 10–144 Hz. The running game measured
the pad about 14 dB below its approach level at the first key and at zero by the demonstration; restoration
and return fades pass. Build, 87 shared audio checks, five renders, 27 Boats and 36 Sea checks pass.
The ten-chapter browser check also now passes both whale crossings and muted marine events, closing the
previous queued verification.

Sleeping follow-up: Jeremy approved the revised study and retaining only its flight reward. Integration
passes 50 checks, including instrument waveform parity (relative error 1.7e−6), 10–144 Hz scheduling,
indefinite player-paced pauses, wind feedback and full voice cleanup. Both settled background/reverb rests
measure below −90 dBFS. The ten-chapter game-loop suite passes its new Sleeping entry, morning restore and
departure checks; shared audio and piano-approach regressions also pass. Transition A/Bs decode as 48-second
stereo MP3s, with matching lead-ins and no clipping. Jeremy rejected the transition proposal on September 21;
that held-chord replacement remains rejected. The later arrival pause is recorded below. Contextual listening
for the integrated score/effects remains separate.

Meadow integration (September 21): 51 focused checks pass, including approved instrument waveform parity
(relative error 2.2e−6), scene/checkpoint gates, scheduling at 10–144 Hz, wind feedback and unchanged legacy
pad clock/glides. The mixed render has no clipped samples. A real browser run completed four piano sweeps,
then used the crest fixture through flock departure and the paddle: off → walk → flock → pond → return → off,
with zero phase mismatches or score leakage into the piano. Mute/resume preserved the phrase; boarding
retired the score before leaving Meadow; at most 22 score oscillators were active and none remained on exit.
Build, the shared 87 audio checks/five renders and the piano approach regressions also pass. Evidence:
`/tmp/updraft-meadow-score-check.json` and `/tmp/updraft-meadow-score-browser.json`.

Birches integration (September 21): 70 focused checks pass, including exact approved-note parity,
instrument waveform parity (relative error 5.9e−7), phase/checkpoint routing, player-paced loops at
10–144 Hz, updraft chord matching, cleanup and unchanged legacy pad clock/glides. The score/gesture
render peaks at −12.6 dBFS without clipping. Build, the shared 87 audio checks/five renders and all
51 Meadow regression checks pass. Evidence: `/tmp/updraft-birches-score-check.json` and its WAV.
The new Birches live gesture check has not run: an existing full-game playthrough owns the GPU browser
lock. Its queued invocation was cancelled without interrupting that playthrough. Run
`node tools/birches-score-browser-check.mjs` once that resource is free; this remains a contextual
verification limitation, not a passing browser result.

Birches physical detail (September 21): 35 focused checks and three offline renders pass. At 10–144 Hz,
100 simultaneous potential scuffs plus walking share the same 1.4-second budget; substantial swing
reversals share a 2.4-second limit. Standing, speed jitter, tiny sway, bare ground, distance and mute/resume
are covered; production sources clean up and remain below −30 dBFS peak without clipping. Build and
87 shared audio checks/five renders pass. Evidence: `/tmp/updraft-birches-foley.json`; isolated audition:
`/tmp/updraft-birches-foley.mp3`. Contextual game verification remains pending: another progress check
owns the browser. Lines' 72-second preview renders successfully with separate music-only/context players
and a matched comparison; its subsequent approved integration is recorded below.

Lines integration (September 21): 92 checks pass, including exact approved-note parity, instrument waveform
parity (relative error 8.2e−7), separate melody reduction (−1.500 dB; pad change 0 dB), chapter/checkpoint
routing, indefinite waits and missed-frame behavior at 10–144 Hz, cue space, gesture response and cleanup.
The production mix peaks at −15.35 dBFS without clipping. Build, 87 shared audio checks/five renders and
70 Birches score regressions pass. Evidence: `/tmp/updraft-lines-score-check.json` and its WAV.
Live game-loop/contextual verification remains outstanding because another progress check holds the browser;
offline production audio and chapter tests do not constitute a live listening pass.


Arrival timing and gesture harmony (September 21): 71 production-render checks pass for all nine destination
profiles. Background plus reverb is exactly silent for four seconds; the mixed render keeps the environment
and gesture response audible with no clipping. Landing preserves the score instance, phrase epoch and incoming
reverb. Suspended time, early grounding, unrelated chapter jumps and a stalled frame are covered.

The real boat/chapter pacing simulations pass all eight current passages under ordinary breeze, sustained
gusts, a sudden gust at the handoff, 30 Hz and both wind-bearing variations, plus the unattended Drowned
encounter. Incoming music begins at least 1.7 seconds before grounding in these fixtures; the ordinary opening-to-Lines run gives 11.35 seconds.
Evidence: `/tmp/updraft-arrival-pacing.json` and `/tmp/updraft-arrival-audio.json`.

Harmony checks pass across 33 sections and 3,196 scheduled gesture notes, including 609 that cross a chord
boundary before sounding. Rescue timbre/level, piano ownership and Sleeping's harmony through its rests pass.
Evidence: `/tmp/updraft-gesture-harmony.json`. Build, 87 shared audio checks/five renders, and Lines (92),
Birches (70), Meadow (51), Sleeping (50) score regressions pass with approved compositions and levels intact.

The live Lines arrival fixture passes with a 4.02-second background pause, incoming phrase starting 11.26
seconds before grounding, four harmonically matched real-pointer chimes, no score restart ashore and no
browser errors. Evidence: `/tmp/updraft-arrival-audio-browser.json`. This verifies arranged approach-to-landing
wiring, not a continuous full-game listening pass.

Camera follow-up (September 21): the focused crossing check passes 24 real-boat passages, plus
10–120 Hz framing, farewell continuity and whale pan/release checks. Village checks cover the church,
child, sail and lighthouse at 30/60 Hz, calm/gusts and both aspects. Real desktop and portrait village
captures reached the wood after pointer-driven sail recovery; the portrait run kept the child's centre
within 0.907 NDC. The rendered sea run retained the swimmer and approached the mirror without a camera cut.
Evidence: `/tmp/updraft-crossing-camera*.json`, `/tmp/updraft-drowned-camera*.json` and
`/tmp/updraft-camera-*.png`.

The shared checkout changed during verification. A later sea suite failed its route-progress continuity
assertion (about 0.055 at waypoint rounding on the shorter route); an instrumented run logging that
assertion separately passed the remaining camera, swim and checkpoint assertions. Later combined renders
also lost the water and reported missing fragment outputs. These results do not certify the concurrent
geography/rendering edits. The final camera review uses a separate local build of the committed renderer
with the camera/director changes; this is a review preview, not a release checkout or deployment.

The final isolated crossing capture passed with the child within 0.800 NDC and the visible whale's sampled
body bounds within 0.648 NDC; no camera cut or page exception was recorded. Its whale/release screenshots
were visually reviewed. Camera review preview: `http://127.0.0.1:5249/?chapter=drowned`, built under
`/tmp/updraft-camera-review-dist`; source fixes remain in the shared workspace.
The final shared-tree typecheck was blocked by `src/audio/audio.ts:244` (`wasGusting` declared but unused)
in the concurrent audio work. Earlier camera-stage typechecks and preview builds passed; the shared-tree
production build did not run after that final typecheck failure.

Marine/gait follow-up (September 21): 56 marine checks and seven production renders pass after softening dolphin and whale attacks, filtering spray, reducing levels and spacing pod events. A seeded old/new comparison measured roughly 6 dB lower peaks for dolphin landing and whale breath; all six marine voices have lower transient energy. Evidence: `/tmp/updraft-marine-softened.json` and its WAV.

Sky Mirror's targeted companion/checkpoint tests pass with planted investigation steps, no swimming pose, no paddle/plunge events and no running wingbeats. Wing-care/pond/glide checks also pass at 30/60/120 Hz. The full Mirror simulation completes landscape, but the portrait constellation check fails its 0.95 framing margin (x≈−0.9505); the baseline gait also fails (x≈−0.9512). This separate framing issue is not certified by the gait fix. Before/after close-ups: `/tmp/updraft-mirror-gait-{before,after}-feet-*.png`.

Shared cinematography (September 21): `camera-direction-check` passes orbital clearance and turn-rate
checks at 10/30/60/120 Hz, near-reverse route noise, fast carry and anchor changes, stable composition
choices, interaction holds, exact-path exits, portrait resize and multi-subject bounds. Local CPU
microbenchmarks across sea, meadow, birches and wood measured about 0.003–0.005 ms per decision-layer
update, amortized at 60 Hz; actual review updates measured about 0.08–0.13 ms and occur twice a second.
These are desktop CPU measurements, not mobile frame-rate results; there are no additional GPU passes.

The production build/typecheck and chapter-transition, crossing (24 real-boat passages), drowned,
pond, sea, wood, sky-mirror and ending checks passed. The sky mirror now declares all three constellation
points and gives the reveal a bounded extra retreat; its portrait completion/framing check passes.
A real-browser entrance sweep passed 22 landscape/portrait cases with no page exceptions or camera
turn discontinuities. The portrait village completed via real sail strokes with the child inside
0.887 NDC and a maximum turn of 0.0099 radians per frame. Screenshots were reviewed for the village,
meadow, forest, sleeping island and mirror. This is focused chapter verification, not a new uninterrupted
start-to-credits manual playthrough. Evidence: `/tmp/updraft-camera-direction.json`,
`/tmp/updraft-direction-chapters.json`, `/tmp/updraft-drowned-camera-390.json` and the camera check reports.

Final shared-camera renders: the ordinary crossing retained the child within 0.623 NDC and the visible
whale body within 0.581 NDC; maximum angular step was 0.0092 radians. The portrait mirror's three-star
reveal was also visually reviewed. The local review preview is `http://127.0.0.1:5259/?chapter=drowned`
from `/tmp/updraft-direction-preview`. Nothing was deployed.


## Approved Mirror/Drowned scores and forest transition — September 21

- `node tools/dream-score-check.mjs`: exact approved note/palette parity; phase envelopes; sustained loop
  coverage; saved-phase entry without a bloom; real-return blooms; final cut and retired voice/echo/bus
  cleanup; actual Drowned-to-Wood render with an open gate, retained reverb, tuned D/A entry and responsive
  gestures. All three renders have no clipping. Evidence: `/tmp/updraft-dream-score-check.json`.
- `node tools/dream-story-check.mjs`: actual chapter phase getters, four distinct star returns with one cue
  each, no cue replay for completed progress, and Drowned's still/resumed/storm/loss phase selection.
- `RESTORE_ONLY=1 node tools/sky-mirror-logic-check.mjs`: focused real actors, mirror mechanics and saves.
- `node tools/arrival-audio-check.mjs`: all nine destination profiles, now including real DreamScore object
  and clock continuity through landing; other arrivals retain the short background-only rest.
- Existing `audio-check.mjs` (88 checks/five renders), `audio-direction-check.mjs` (67 checks/four renders)
  and production build pass. This is audio integration verification, not a complete journey playtest.

### Cinematic playthrough audit (September 21)

`REVIEW=1` drove the real pointer interactions from Begin, then continued from the actual pond checkpoint
through credits, completed-save reload and Play again. Visual review used chronological captures at
1–2-second intervals, with full-size inspection of suspected problems. This is rendered sequence review,
not a claim of real-time video listening or physical-device coverage; optional branches were not exhaustive.

The fresh run found a genuine Meadow stall: paper resting on the elevated pond was considered fetchable
land. The plane now shares the pond's water boundary and recovers through flight. Calm-water reproductions
at 30/60/120 Hz pass, and normal Continue cleared the pond and reached Birches. Jeremy's relocated exit boat
is preserved; the boarding view now looks back from the water and frames the approaching child with the hull.

Other observed fixes: the Lines grass patch now follows `(x, radius, z)`; the opening rescue clears only its
care patch; the first farewell uses the visible side of the sail; the piano approach includes the walking
child; village roofs/chimneys/branches receive bounded, eased obstruction clearance, with bow/stern framing
and room for the church reveal to ease into place; and the final paper
release retains the child's standing silhouette before the descent. The shared village check covers 167
static bounds, both screen shapes and calm/gust passages: longest measured obstruction 0.14 s, maximum
frame turn 0.020 rad. The bounds-only CPU microbenchmark is roughly 0.001 ms here, not a device FPS estimate.

Evidence: `/tmp/updraft-cinematic-playthrough*` (original failure), `/tmp/updraft-cinematic-continued*`
(pond through ending), `/tmp/updraft-cinematic-boarding-replay*`, `/tmp/updraft-cinematic-reload.json`.
The continued run's final harness assertion failed on capture-timer evaluations during reload, after both
completion and Play again succeeded. The capture timer now stops before navigation; the separate actual
completed-save replay passes with no errors. The original failed report remains intact.

Focused replays also passed fresh Begin through all three Lines curtains and departure (323 s), the actual
pond save through Meadow boarding and Birches (96 s), and all four piano gestures in landscape and portrait.
The ending's arranged drawing-approach fixture passed through credits in both screen shapes; chronological
review confirms the release no longer clips the child. These are focused confirmations, not additional
uninterrupted full journeys. Type checking, production build and the camera/pond/ending regression checks pass.

Final village GPU replays pass in 1280×720 and 390×844, including real sail strokes, storm and forest landing.
Chronological review of `/tmp/updraft-drowned-hull-final-{1280,390}-frames/` confirms clear roof/church
passage and complete hull framing. The old child-center-only check missed clipped bow/stern; the replay
now checks those actual hull points too (worst viewport coordinate 0.800 landscape, 0.876 portrait; edge=1).
Evidence includes `/tmp/updraft-drowned-camera-{1280,390}.json`, `/tmp/updraft-piano-new-*-report.json`
and `/tmp/updraft-cinematic-ending-replay-*`. Final review preview: `http://127.0.0.1:5299/`.

## Calmer camera motion (September 22)

The shared rig's focus, dolly and height now ease into movement; ordinary orbit speed is capped at 0.3 rad/s.
`camera-direction-check.mjs` adds 10/30/60/120 Hz reframing, stationary-target settling, moving handoffs
between placed views and orbits, and rejection of short-lived composition improvements after a long rest.
All pass. `crossing-camera-check.mjs` passes all 24 real ordinary routes with calm/gust and both aspects,
including keeping the still-island focus visible through the first thirty seconds. Ordinary sailing is
checked to stay close to astern; church coverage is checked during its approach reveal, before the sail
interaction. The crossing mirror fixture includes the stars required by the current chapter constructor.

`drowned-camera-check.mjs` keeps the child, hull, church, sail and lighthouse in frame. Maximum frame turn
falls from 0.0216 to 0.0124 rad at 30 Hz landscape, 0.0106 to 0.0065 at 60 Hz portrait, and 0.0207 to 0.0118
at 30 Hz portrait with gusts. Final elevation down to the child peaks at 18.0°, 17.6° and 17.1°;
the regression gate is 23°. A conservative branch bound crosses the landscape sightline for 0.33 seconds;
the portrait routes have no measured scenery obstruction. Small eased lateral clearance replaces the
previous climb over foreground buildings. The renderer replay also checks the final elevation.
Pond, ending, sea/swim, piano framing and chapter-handoff checks also pass.
These are focused motion and visibility checks, not another uninterrupted full-game playthrough.

The initial 1280×720 village GPU replay passes real sail strokes, storm and forest landing, with chronological
review in `/tmp/updraft-calm-camera-final-1280-frames/`. Peak frame turn is 0.0061 rad; worst child/hull
viewport coordinates are 0.707/0.841 (edge=1). The first dev-server capture was interrupted by a source
reload; the completed replay used the built preview to avoid hot reloads during review.
All eleven chapter entrances pass six-second renderer checks at 1280×720 and 390×844, with no page errors,
invalid camera positions or lost primary subjects. That entrance sweep covers the shared motion changes;
the subsequent astern sailing direction has separate route checks and renderer replays.

Final low-camera village replays pass real sail strokes, storm and forest landing at 390×844 and 1280×720.
Chronological evidence is `/tmp/updraft-low-camera-{390,1280}-frames/`; the landscape renderer's maximum
elevation is 17.0°. The church view at about 36 seconds keeps the camera near 5.8 units above the water,
instead of the rejected portrait view near 18.9. The farewell reserves the whole hull and sail beside the
island, and introduces its distant framing bound over six seconds to avoid a jump from the boarding shot.

### Island camera follow-up

The natural forest baseline (`/tmp/updraft-islands-wood-before*`) exposed a roughly 143°/s turn when
returning from the reunion. `wood-logic-check.mjs` now gates walking turns on the whole route: about 19°/s
in landscape and portrait, with the next coal and rescue gesture still reachable. `camera-direction-check.mjs`
also verifies a placed eye's return arc at 30/60/120 Hz and primary visibility during smoothed fitting.

`sleeping-logic-check.mjs` now uses the real camera rig at 30/60 Hz in both aspects. The glide and waking
peaks fall from about 97°/s and 148°/s to 4°/s and 3°/s. Every beat keeps its primary within 0.9 viewport
coordinates (edge=1). The pose fixture uses a fixed random seed so unrelated idle preening is reproducible.
`sky-mirror-logic-check.mjs` covers continuous framing throughout all four stars, constellation and departure;
its previous multi-unit frame jumps are gone. Camera direction, pond, ending, drowned village, forest,
sleeping and mirror regression checks pass with the shared framing safeguard.

The uninterrupted renderer baseline (`/tmp/updraft-island-audit*`) passes Begin, all seventeen chapters,
credits, completed-save reload and Play again with no browser errors. Chronological review covers the
still island, all Lines curtains and doorway, the three boat pools, Meadow's climb/piano/pond, Birches,
the drowned village, forest rescue and retrieval, sleeping ascent and descent, all four mirror lights,
and Home through the final walk. This run retained the bundle loaded before the three island fixes;
the revised shots are verified separately rather than described as another full-game run.

The final portrait forest replay (`/tmp/updraft-islands-wood-settled-ready*`) passes the whole chapter with
55 real pointer sweeps and no browser errors. Review includes the lower walking lens, close shelter reveal,
slower return arc and widening, paper retrieval and shore descent. The first sleeping replay was interrupted
by a dev-server reload; subsequent camera replays use a fixed source copy to isolate them from ongoing edits.
The portrait summit replay (`/tmp/updraft-islands-sleeping-stable*`) passes ribbon input, window coverage,
glide, waking and boarding without errors. Its chronological frames confirm the descent stays on the
bedside camera side.
The final portrait mirror checkpoint replay (`/tmp/updraft-islands-mirror-final*`) passes the fourth star,
complete constellation and departure with no errors. The optional swing is also visually checked in
1280×720 and 390×844 from a staged seat approach (`/tmp/updraft-islands-swing-final-*`), with the actual
mounted state asserted before capture. Type checking, production build and whitespace checks pass.

## Accepted lighthouse foghorn

- `node tools/foghorn-story-check.mjs`: approved settings, one actual chapter cue at 30/60/144 Hz,
  no calls before the storm, stale-event suppression, checkpoint behavior and inactive-audio handling.
- `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-integrated`: four production Web Audio renders;
  integrated cue matches the frozen accepted reference within one PCM rounding step. Checks also cover
  no accompaniment ducking, source cleanup, soft onset, thunder/plane clearance and encoded headroom.

These checks, the existing chapter-audio checks, 140 audio regression checks with six renders, type checking
and production build pass. This verifies the cue integration, not a new full-game listening playthrough.

## Production hardening validation — 2026-09-21

The isolated `codex/production-hardening` pass builds on the combined `188c9fa` snapshot. Build/typecheck,
35 mechanics checks, 12 frozen render/state comparisons and exact camera/texture/save compatibility
checks pass. The final continuous journey passed all 17 chapters, 269 real pointer gestures, credits,
completed-save reload and Play again with no reported page/console errors. Credits were reached in about
37 minutes. Evidence and source hashes: `/tmp/updraft-hardening/`. See `production-review.md` for measurements,
implementation scope and physical-iPad limitations. The run verifies traversal; audio listening remains separate.

All eight focused browser gates also pass across the grouped run and the corrected Begin retry rerun.
The fault-injection route now ignores Vite's query timestamp and verifies that it actually blocked the main
module before asserting the retry state. The final credits capture exposed an existing replay-label overlap,
recorded as an open presentation issue in the review; neither the credits markup nor its CSS changed here.
