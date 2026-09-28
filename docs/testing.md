# Local checks

Every check runs locally from `tools/`; there is no CI. Browser tools default to the dev server on
`http://127.0.0.1:5230/` and take `BASE` for another server (use a `vite preview` build, or a worktree with its own
server, for anything long or visual: a dev server reloads on any `src` edit, including another session's). GPU checks
share one capture lock (`tools/lib/browser.mjs`), so timings are not skewed by another browser; `play.mjs`
captures take no lock and can run side by side. Evidence goes under
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
2. Start a `vite preview` of the build and run `BASE=<preview> npm run check:release`.
3. Jeremy owns the parts no local tool covers: a listening pass through the whole journey (see
   `docs/contracts/audio.md`, Open) and physical-device checks on his iPad (touch robustness, Safari fullscreen,
   performance, warmth and battery).
4. Deploy with `tools/deploy.sh` from a clean `main` (every deploy goes to production).

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
  builds must expose `?shot`.
- `render-cost-check <chapter>`, `grass-quality-check`, `grass-unclipped-check`, `swan-shading-check`,
  `water-texture-check`, `terrain-check`, `terrain-fields-check`, `terrain-colour-check`, `terrain-heights-check`
  (after any island's shape or position change), `fields-border-check`, `height-bake-check`.
- `frame-time-check`, `frame-time-browser-check`, `frame-pacer-check`, `power-browser-check`, `wind-clock-check`,
  `wind-rate-check`, `wind-gesture-logic-check`, `quality-check`, `quality-browser-check`, `quality-setting-check`,
  `quality-menu-check`, `veil-controls-check`.
- `pointer-contact-check`, `pointer-pick-check`, `touch-viewport-check` (Chrome, not a Safari substitute).
- `start-check` (Begin, audio unlock, Continue, retry; worst boot gap under `BOOT_MAX_MS`), `startup-check`,
  `loading-check`, `boot-cloth-check`, `failure-paths-check`, `context-loss-check`.
- `nearby-check`, `bandage-cost-check`, `scarf-normals-check`, `drowned-gating-check`.

**Camera**

- `camera-direction-check`: orbital clearance, eased turns, focus, dolly and height at 10–120 Hz, carry, attention,
  stable composition choices, interaction holds, exact paths and portrait resize.
- `crossing-camera-check`, `drowned-camera-check`, `storm-camera-trace`, `chapter-view-check`, `ending-view-check`
  (fails any staged view whose turn rate changes by 2.5°/s or more within a quarter second), `piano-frame-check`,
  `pond-view-check`.
- Browser: `camera-chapters-browser-check` (every chapter entrance, landscape and portrait),
  `crossing-camera-browser-check` (`CASE=crossing|sea`), `drowned-camera-browser-check` (`PORTRAIT=1`, `REVIEW=1`),
  `chapter-view-browser-check`, `journey-view-check`.

**Chapters and mechanics** (Node, real chapter code, no renderer)

- `plane-routing-check`, `meadow-route-check`, `meadow-plane-check`, `piano-logic-check`, `piano-growth-check`,
  `little-boats-logic-check`, `kite-logic-check`, `scarf-geometry-check`, `sail-flutter-check`, `sea-logic-check`,
  `sky-mirror-logic-check`, `sky-mirror-pointer-check` (`TOUCH=1`), `sleeping-logic-check`, `wood-logic-check`,
  `wing-care-check`, `flock-flight-check`, `boat-check`, `boat-ground-check`, `journey-pacing-check`,
  `geography-check`, `journey-reveal-check`, `crossing-haze-check`, `dream-story-check`, `foghorn-story-check`.
- In the browser with real gestures: `lines-check`, `lines-view-check`, `little-boats-check`, `piano-check`,
  `scarf-check`, `stairs-check`, `storm-check`, `wood-check`, `ember-check`, `sea-check`, `sky-mirror-check`,
  `sleeping-check`, `summit-arrival-check`, `home-approach-browser-check`, `ending-check`, `landing-check`,
  `kite-check`, `geography-browser-check`, `boats-offshore-browser-check`.

**Saves and lifecycle**: `progress-check`, `progress-schema-check`, `chapter-select-check`, `analytics-check`,
`analytics-browser-check`; see `docs/contracts/progress.md` and `analytics.md`.

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
`boot-profile.mjs`, `storm-profile.mjs`, `window-hitch.mjs`, `power-profile.mjs`, `quality-budget-profile.mjs`,
`audio-cost.mjs`.

Rendered checks, screenshots and numeric audio checks are evidence for review, not pixel baselines or a listening
sign-off.

## Open

- Several checks fail on `main`: some are stale, some catch real regressions. Which is which, and the unmerged
  branch that updates the stale ones, is in [roadmap.md](roadmap.md) under Checks.
