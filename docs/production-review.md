# Production review — 2026-09-21

Scope: gameplay and chapter transitions, pointer input, camera/framing, rendering and GPU state, audio,
checkpoint/lifecycle handling, startup, performance, dependencies and maintainability. Source inspection
is paired with mechanics tests, a continuous journey and focused real-browser checks. Device-specific
Safari gestures, thermal behavior and GPU portability require physical-device validation.

The checkout already contained substantial scene/audio changes. Further Birches audio work arrived during
the review. Existing work was preserved. The continuous journey uses a frozen production build taken at
the start; focused post-fix browser checks use a second frozen build where supported. Source-only fixtures
use the working checkout. Evidence and source hashes are under `/tmp/updraft-production-review/`.

## Findings and fixes

| Priority | Finding | Status |
| --- | --- | --- |
| P1 | Reversed GLSL `smoothstep` bounds rely on undefined behavior across GPUs. | Fixed in the isolated hardening pass; comparison evidence below. |
| P1 | A new chapter can expose its zero-initialized camera target for one frame, pulling the view toward the world origin. | Fixed; retain the preceding prepared view until the normal update. |
| P2 | Additional fingers can reposition or release another finger's wind stroke. | Fixed; primary pointer owns its contact. |
| P2 | Browser cancellation, lost capture or page suspension can leave stale contact/charge. | Fixed; discard interrupted input, including viewport resize. |
| P2 | Canvas CSS height and renderer/camera height can disagree when Safari controls reappear. | Fixed; resize the displayed canvas with the rendering viewport. |
| P2 | Distant flock wingbeats accumulate and burst on return; resting rafts also emit sustained wingbeats. | Fixed; expire inaudible beats and gate on flight/take-off. |
| P2 | iPad Safari can dismiss native fullscreen during a wind gesture. | User-reported; likely browser-owned dismissal, still needs target-device confirmation. |
| P2 | Rolling credits pass behind the visible Play again label. | Existing UI overlap exposed by the final journey capture; follow-up below. |

### Shader portability

The initial audit found 73 literal reversed-bound calls in annotated GLSL templates. The follow-up scans
all shader templates, including inline unannotated shaders: **74 literal calls plus two expression-bound
calls** now use `1.0 - smoothstep(low, high, x)`. JavaScript's intentionally reversible helpers are unchanged.
The collapsed hearth flame tip also handles equal edges explicitly and bounds extrapolated UV height
before its fractional power; nonpositive shadow radii are skipped.

The [GLSL ES specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
leaves results undefined when the first edge is greater than or equal to the second. A driver can render
incorrect terrain, masks, shading or water. This was a verified specification violation, not a reproduced
failure on Jeremy's iPad. The corrected expression preserves the intended descending curve with defined bounds.

Validation against `188c9fa`: all 12 seeded, frozen scene comparisons pass on Chrome/Metal, including
landscape and portrait Sleeping. Worst mean channel difference is 0.005/255; at most 0.013% of pixels differ
by more than 8 levels. Sampled CPU/GPU height error remains 0.01038 m (gate: 0.02 m). Metal and software
Vulkan also pass small float-shader ramp comparisons, with maximum error below 1.8e-7. This adds a second
compiler/backend; it is not a substitute for a physical WebKit/iPad or independent GPU-family check.

`tools/shader-check.mjs` rejects literal descending/equal bounds. The render comparison scans actual
compiled shaders too, catching expanded tuning literals. Expression-bound calls still need explicit range
reasoning; all 86 such source calls were inspected during this pass. Evidence: `/tmp/updraft-hardening/`.

### Touch and fullscreen

`src/input/pointer.ts` now keeps one primary pointer ID. A second finger or another device cannot move/end
that stroke. Cancellation, lost capture, blur, hidden/pagehide and resize clear pending motion, velocity and
charge. Cancelled touch movement cannot return as hover; a new touch must start a new contact. Mouse hover,
ordinary release decay and fresh-contact behavior remain covered by regressions.

`src/main.ts` previously called `renderer.setSize(w, h, false)` with `innerHeight`, while CSS kept the canvas
at `100vh`. The displayed canvas now gets the same dimensions as the renderer and camera. This addresses
stretching/cropping when the browser's visible viewport differs from the large CSS viewport. See WebKit's
[viewport-unit explanation](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).

Jeremy confirmed Safari on iPad and that the game remains open while browser controls return. The only
game call to `exitFullscreen()` is the fullscreen button. The canvas already uses `touch-action: none`.
WebKit's [native fullscreen controller](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/fullscreen/WKFullScreenWindowControllerIOS.mm)
registers a one-finger downward-swipe dismissal that cancels page touches and requests fullscreen exit.
This fits the report, but the exact iPadOS version/gesture has not been reproduced here. The input and sizing
fixes improve recovery; **they do not claim to suppress Safari's native exit gesture**.

On the iPad, retest downward strokes, circles, double taps, a second finger, rotation and background/return
in both fullscreen and an ordinary tab. Check that the current puzzle still works after every exit.
If persistent fullscreen is a product requirement, evaluate a standalone Home Screen launch on that device.
Keep deliberate fullscreen exit available.

### Flock sound

The previous main-loop timer advanced while the flock was distant, but subtracted a beat only when audible.
A reproduction of that actual scheduling block produced **33 wingbeats in the first second after 60 seconds
out of earshot**. `Foley` now consumes elapsed beats before applying distance/output gates. The cadence,
timbre, volume and pan are retained. `SwanFlock.flying` includes the take-off run and excludes resting rafts.
The regression checks normal timing and distant/muted recovery at 10, 30, 60, 120 and 144 Hz.

### Chapter-transition camera

The continuous run's Sleeping entry capture briefly lost the travellers. `Journey.update()` updates the
old chapter, then constructs the next one; several constructors leave `shot.target` and `focus` at the
origin until their first update. Main reads those fields immediately. Far into the archipelago, even one
frame of camera easing toward the origin can produce a large displacement.

`Journey` now retains the preceding prepared shot, pace and focus until the new chapter's first normal
update. It does not add a gameplay update, change chapter order or alter save timing. A regression failed
on the original origin target and passes at 10–120 Hz, including the existing zero-time startup/restore
path. Separate real-browser fixtures exercise the actual Sleeping and Home constructors.

## Performance opportunities

Prioritize from measured target-device profiles. The following costs are visible in the implementation;
they are not claimed FPS improvements.

The frozen post-fix build sustained 60 Hz in a 20-second Meadow sample at 1600×900, render ratio 1,
4× MSAA and high world detail on local Chrome/Metal: p50/p90 16.7 ms, p99/max 16.8 ms, no intervals
over 25 ms and no measured long tasks. Ready took 4.30 s. This is one desktop scene, not an iPad or
whole-game performance guarantee. A separate cold-start profile recorded a 266.6 ms worst frame and
a 262 ms longest task, with no individually instrumented GL call above 10 ms (`boot.json`).
The matching 15.1-second steady-state CPU profile spent 13.36 s idle. `getBufferSubData` accounted for
165 ms across the whole sample; rendering, matrix updates and pose/camera work followed among the
active costs. Preserve the asynchronous readback ordering and prioritize target-device measurements
before changing it (`perf-cpu.log`).

1. **Reduce startup construction cost.** The baseline combined production build's main chunk is 1,711.83 kB minified
   / 520.98 kB gzip. The engine constructs and prepares the entire archipelago before Begin. Splitting this
   file alone will not remove that work. **Implemented:** water texture construction reuses row/column
   trigonometry and ranks squared Worley distances before taking the two nearest square roots. At 256²,
   ripple generation falls from 4,194,304 cosine calls to 65,536 sine/cosine calls. Five-run desktop Node
   medians were 133.63 → 24.31 ms for ripples and 34.03 → 11.34 ms for lace, with identical packed bytes
   at five resolutions in Node and both Chrome backends. No new assets or downloads are required. These
   are component timings, not a whole-game FPS or iPad claim. Staged distant-room preparation remains
   a larger follow-up if target-device startup is still slow.
   Any staged preparation must retain checkpoint starts and avoid chapter-entry stalls.
   The cold browser profile also attributes about 0.66 s of sampled self time to the heightfield's
   `pcg`/`hash2`/`gradDot` functions. `heightAt()` already uses the GPU-baked CPU grid once installed;
   target repeated construction-time queries before adding another cache to normal gameplay.
2. **Measure graphics memory alongside FPS.** Grass reserves all three quality tiers so promotion never
   allocates mid-play. Its four attachments total about **28.17 MiB** at default settings, before other
   world textures, reflection, scene/MSAA/depth targets and bloom. Low reduces drawing cost but retains
   these grass allocations. Review the memory budget on older iPads; consider a bounded pool or compact
   immutable data only if it preserves promotion behavior, tile coverage and existing blade precision.
3. **Remove verified hot-loop allocation — implemented.** Nearby-creature queries iterate live populations
   directly, preserving distance ties and the exclusive radius. The simulation reuses its creature environment
   and callback; camera fitting avoids per-step arrays and a capturing closure. Two thousand nearest-creature
   cases and 7,200 camera frames match the original exactly. Real rabbit/songbird getters also match
   fresh snapshots over 600 frames of movement; inspection snapshots remain detached. No camera tuning
   or frame order changes.
4. **Profile before extending room culling.** Most distant systems already have explicit distance gates.
   `DrownedVillage.update()` still advances vanes/herons each world step. A room-level gate may save work,
   but stateful departures, audio and resumptions need an explicit catch-up policy. Do not apply a blanket
   offscreen pause to flock, cloth or story mechanics.
5. **Treat the governor's 60 Hz target as a policy.** A browser/device deliberately capped at 30 Hz can
   drive Auto to its lowest tier despite having spare GPU time. Measure this on the target iPad in Low Power
   Mode. A cap-aware governor would need timing evidence to distinguish capped refresh from overload.

## Quality, duplication and simplification

- **Separate orchestration from implementation incrementally.** `main.ts` combines world construction,
  audio state, per-frame visibility, quality, simulation and QA exports. Extract cohesive startup and audio
  wiring functions with explicit dependencies while preserving frame order. A wholesale engine rewrite
  would put timing, snapshots and shared uniforms at risk.
- **Checkpoint schemas consolidated.** `story/checkpoint-data.ts` names positional fields once, derives
  the public arity map and types the eight current payload writers as numeric tuples. `decodeProgress()`
  separates validation from storage. All 69 current/legacy layouts and 2,698 decoder cases match `188c9fa`.
  The v1 wire format, chapter restoration and migration rules are unchanged. Per-point semantic decoding
  remains in the chapters; this is not a serialization rewrite.
- **Consolidate test plumbing.** Many tools duplicate TypeScript loaders and browser setup/locking.
  `tools/lib/browser.mjs` already provides the shared GPU lock, but some older tools launch directly.
  This review moved the Begin-screen check onto that lock, preserving its requirement for a real user
  gesture to start audio rather than inheriting the helper's autoplay override.
  **Follow-up implemented:** 28 tools share one TypeScript loader. `npm run check`, `check:mechanics`,
  `check:browser` and `check:release` provide sequential groups and per-check evidence logs. Older bespoke
  tools remain available individually; the release group is not every audio/artistic fixture in the repo.
  Two existing fixtures had drifted: Begin expected audio even though `shot` defaults to mute, and Sleeping
  attempted the feather checkpoint before completing the newer walk-around-bed/tuck-in sequence. The
  tests now explicitly set the sound preference before the real Begin gesture and arrange a completed
  tuck-in, retaining the original audio-unlock and saved-position assertions.
- **Morning-lane GLSL consolidated.** Surface lighting and Sleeping fog use one `LANE_GLSL` definition,
  preserving uniforms, curve arithmetic and the early-out. Frozen render comparisons cover both.
- **Keep shader/CPU duplication explicit.** Heightfields and several grass masks intentionally have both
  implementations. Centralize constants and generate matching scalar functions where practical; use
  `measureHeightParity` as a required gate. Sharing only names without parity checks would hide drift.
- **Documentation drift was corrected.** `docs/project.md` described hold-still updrafts, no on-screen text
  and the current game as unbuilt. It now distinguishes the original exploration from the shipped mechanics.
  Input/audio contracts and the release-check index include the new behavior and regressions.

## Verification

Completed:

- Baseline and post-fix TypeScript/production builds pass. The bundle-size warning remains actionable.
- `npm audit --json`: zero reported vulnerabilities at review time. This is dependency-audit evidence,
  not a complete security certification.
- Nineteen initial checks passed: frame time, wind clock, gesture logic, quality, boot cloth, analytics,
  boat grounding, kite, little boats, piano mechanics, sea mechanics, mirror mechanics, sleeping, wood,
  piano audio and boats/sea/sleeping/meadow scores.
- New contact and flock-audio checks pass; existing frame-time and wind-gesture checks pass after changes.
- The new chapter-view regression passes at 10–120 Hz. In the real renderer, arranged Sleeping and Home
  crossing exits retain the previous shot for the transition frame (camera displacement 0 m / 0.0026 m)
  and use the new chapter's prepared target on its next normal update.
- Ending view checks pass across landscape, square and narrow portrait sizes, 30–120 Hz, rotation,
  drawing/reunion restoration, occlusion recovery and one-time motif timing.
- Flock flight/arrival/reunion, scarf geometry and wing-care/checkpoint checks pass.
- Audio and marine-audio suites pass. A separate Chrome lifetime probe reclaimed completed wildlife voice
  nodes after collection; this review did not establish an unbounded voice-node leak.
- An instrumented Sleeping mechanics run with the real camera at 390×844 stayed above terrain (minimum
  sampled clearance 1.847 m). This is a bounded camera check, not proof of every possible sightline.
- The continuous baseline journey passed all 17 chapters with 265 real gesture strokes, 42 distinct
  checkpoints, credits, completed-save reload and Play again; no reported page errors. Credits were reached
  in about 36 minutes. This predates the review fixes and the later concurrent Birches work.
- Post-fix context-loss checks pass during boot and during play, with/without saves, including checkpoint
  preservation, reload and restored wind readbacks.
- Real browser touch ownership/cancellation, portrait/landscape sizing, simulated returning browser
  controls and explicit fullscreen entry/exit pass without page errors. This does not emulate native Safari
  gesture recognition. The fixture restores the original `innerHeight` descriptor after mocking it.
- Pond migration and shore/jetty visibility checks pass at 1600×900 and 390×844; sampled CPU/GPU terrain
  error is 0.01038 m, below the existing 0.02 m gate. Both layouts were visually inspected.
- Browser frame-time checks pass at 10–60 Hz in Lines, Birches, Wood and Mirror, including bounded
  catch-up, stalls, pause and resume. These validate simulation scheduling, not device rendering speed.
- All 23 point-of-interest and 19 chapter-entry checkpoint cases pass across the initial run and the
  corrected Sleeping-onward rerun. Replay, QA save isolation, corrupt/unavailable storage, hidden-page
  audio suspension, resume and mute also pass.
- Begin-screen checks pass: native audio unlock by keyboard and touch, Continue, drag-versus-tap,
  reduced motion, failed-bundle retry and QA bypass; no page errors. The final cold-start sample's worst
  frame was 250.1 ms, within the existing 500 ms gate but still a startup optimization target.
- The latest combined checkout passes TypeScript and production build, the three new mechanics regressions,
  and the concurrently added Birches foley's 35 checks and two unclipped renders.

Physical iPad Safari validation remains a release requirement. The isolated hardening pass below runs
against a frozen build containing the combined work committed at `188c9fa` plus this pass's production changes.


## Isolated hardening verification — 2026-09-21

The combined checkout was committed and pushed as `188c9fa` before work began in the separate
`codex/production-hardening` worktree. Evidence is under `/tmp/updraft-hardening/`; `source-hashes.json`
identifies the production sources used for the frozen comparison and journey build.

- Production build/typecheck and all 35 mechanics checks pass (`mechanics-final/results.json`).
- The shader scan covers 523 calls; 84 expression-bound calls remain subject to range contracts. Metal and
  software Vulkan ramp checks pass, as do exact original texture hashes at five resolutions on both backends.
- All 12 final frozen render/state comparisons pass (`render-final.json`). Camera refactor parity is exact
  over 7,200 frames; save decoding matches all 69 layouts and 2,698 cases against the original source.
- The old Mirror pointer fixture omitted primary-pointer metadata and failed before the loader refactor.
  It now dispatches complete events; desktop and portrait touch collection, lift and star selection pass.
- Live creature-position coverage uses the actual classes over 600 frames, protecting against accidentally
  caching their detached QA snapshots. Spatial-query order and miss behavior remain covered separately.

The main bundle remains 1,717.67 kB minified / 522.23 kB gzip. This pass improves texture construction and
recurring allocation; it does not solve whole-world eager loading or establish an iPad memory budget.

Back-to-back cold browser profiles covered 3.54 s before and 3.51 s after to the ready screen. Worst frame
intervals were 266.7/283.3 ms, and the longest construction tasks 263/285 ms; neither recorded an instrumented
GL call above 10 ms. These single samples show no meaningful whole-boot reduction despite the measured texture
saving. Procedural terrain/construction work still dominates (`boot-before.json`, `boot-after.json`).
A 20-second final Meadow sample at 1600×900, ratio 1 and 4× MSAA measured p50/p90 16.7 ms, p99 16.8 ms,
two 33.4 ms intervals and no long tasks. This is desktop evidence, not an iPad throughput or thermal result.

The final frozen-build journey passed all 17 chapters with 269 real pointer gestures and 42 checkpoint
observations, reached credits at 2,230 seconds (about 37 minutes), reloaded the completed save and returned
to a fresh island through Play again. No page or console errors were reported. Unlike the original baseline
journey, this run includes the combined audio/scene work, review fixes and this hardening pass. Evidence:
`journey.json`, `journey.log` and chapter/credits captures. This is functional traversal, not a listening pass.

The final credits capture also exposes an existing UI issue: the rolling names pass through the same screen
area as Play again. `styles.css` and the credits markup are unchanged from `188c9fa`; replay itself works.
Reserve a clear band or fade for the replay control in a separate credits-layout pass, covering portrait,
short landscape and safe-area insets. Evidence: `journey-credits.png`. This remains an open presentation issue.

All eight focused browser checks pass across the grouped run and corrected Begin-screen rerun: shader
backends, touch/viewport, transition views, context loss, Begin/audio unlock/retry, progress, frame scheduling
and pond/crossing views. The initial retry fixture missed Vite's timestamped `main.ts?t=…` URL, so no failure
had actually been injected. It now matches the URL pathname and asserts that the module was blocked; retry
and all other Begin cases pass. Evidence: `browser-final/results.json`, `start-final-rerun.log` and
`validation-summary.json`, which retains the distinction between the original failure and passing rerun.
