# Local release checks

The project already has focused mechanics, checkpoint, GPU and gesture tests in `tools/`.
They run locally; GitHub Actions is not required. The checks serve different purposes:

Common groups run sequentially and preserve each check's log plus `results.json` in `/tmp`:

- `npm run check`: fast shader, parity, input, timing and engine mechanics checks.
- `npm run check:mechanics`: the quick group plus chapter, camera and gesture mechanics (including mouse
  and portrait touch Mirror collection). About five minutes locally.
- `npm run check:browser`: shader backends, touch/viewport, transitions, context loss, Begin, saves, frame
  scheduling and chapter views. Requires a running dev server; `BASE` selects it.
- `npm run check:release`: mechanics, browser checks and the continuous journey. Allow at least an hour.
  Audio/artistic checks below remain separate; this group does not replace listening or device QA.

Set `CHECK_OUTPUT=/tmp/<name>` to choose the evidence directory. `tools/lib/typescript.mjs` is the shared
loader for Node mechanics fixtures. Camera/progress refactor checks read baseline source from Git, default
`188c9fa`; keep that history available or set `BASELINE_REF` to an appropriate pre-refactor revision.

Focused checks:

- `npm run typecheck` and `npm run build`: TypeScript and the production bundle.
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
- `node tools/chapter-view-browser-check.mjs`: real Sleeping/Home constructors at arranged crossing exits;
  checks the transition frame and captures the following view. Uses the shared GPU lock and supports `BASE`.
- `node tools/frame-time-check.mjs`: 100 ms catch-up cap, bounded world steps, gesture subdivision and fresh contacts.
- `node tools/frame-time-browser-check.mjs`: actual game loop at 10–60 fps, stalls, tab resume and one render per frame.
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
- `node tools/playthrough.mjs /tmp/updraft-journey`: Begin through every chapter to credits, reload the completed
  checkpoint, then Play again. Uses only pointer gestures and natural story transitions, with a fresh browser
  profile. It fails on exceptions, wrong chapter order, a stalled chapter or a missing ending. Allow up to an hour.
- `node tools/ending-view-check.mjs`: ending order, camera visibility, narrow screens, resize, resume and motif timing.
- `node tools/audio-check.mjs`: gesture thresholds/exceptions, cue timing, morning music, call spacing, habitat,
  material scheduling, stereo output, clipping stress and the final musical tail; requires the dev server, no GPU.
- `node tools/piano-audio-check.mjs`: short/long approaches at 10–144 Hz, first-key overlap, demonstration,
  single attenuation, departure and completed restoration.
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
- `node tools/audio-transition-proposals.mjs`: current/proposed transition A/Bs in `/tmp`, with source hashes,
  matched lead-ins, chord timing and level measurements; runtime transitions are unchanged.
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
runtime transitions remain unchanged. Contextual listening for the integrated score/effects remains separate.

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
