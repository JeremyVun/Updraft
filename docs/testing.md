# Local release checks

The project already has focused mechanics, checkpoint, GPU and gesture tests in `tools/`.
They run locally; GitHub Actions is not required. The checks serve different purposes:

- `npm run typecheck` and `npm run build`: TypeScript and the production bundle.
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
- `node tools/context-loss-check.mjs`: real WebGL context loss, pause, reload and working wind readbacks.
- `node tools/playthrough.mjs /tmp/updraft-journey`: Begin through every chapter to credits, reload the completed
  checkpoint, then Play again. Uses only pointer gestures and natural story transitions, with a fresh browser
  profile. It fails on exceptions, wrong chapter order, a stalled chapter or a missing ending. Allow up to an hour.
- `node tools/ending-view-check.mjs`: ending order, camera visibility, narrow screens, resize, resume and motif timing.
- `node tools/audio-check.mjs`: gesture thresholds/exceptions, cue timing, morning music, call spacing, habitat,
  material scheduling, stereo output, clipping stress and the final musical tail; requires the dev server, no GPU.
- `node tools/audio-browser-check.mjs`: real game audio wiring across ten chapters, morning restore and a
  real wind gesture, both scripted whale crossings and muted marine events; holds the GPU browser lock.
  Arranged fixtures, not a listening pass.
- `node tools/marine-audio-check.mjs`: real whale/dolphin surface events at 10–144 Hz, replay, distance/pan,
  bounded pod sounds, finite unclipped audio and voice cleanup. Renders an isolated sample in `/tmp`.
- `node tools/boats-score-check.mjs`: approved Little Boats notes, clock, transitions, gesture coexistence and cleanup.
- `node tools/sea-score-check.mjs`: approved sea notes/timbres, adaptive sections, restore, gestures and voice cleanup.
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
other GPU-heavy work stopped. `playthrough`, progress, context-loss, boot-profile and analytics-browser share the capture lock.
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
