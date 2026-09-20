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
| P1 | Reversed GLSL `smoothstep` bounds rely on undefined behavior across GPUs. | Open; details below. |
| P1 | A new chapter can expose its zero-initialized camera target for one frame, pulling the view toward the world origin. | Fixed; retain the preceding prepared view until the normal update. |
| P2 | Additional fingers can reposition or release another finger's wind stroke. | Fixed; primary pointer owns its contact. |
| P2 | Browser cancellation, lost capture or page suspension can leave stale contact/charge. | Fixed; discard interrupted input, including viewport resize. |
| P2 | Canvas CSS height and renderer/camera height can disagree when Safari controls reappear. | Fixed; resize the displayed canvas with the rendering viewport. |
| P2 | Distant flock wingbeats accumulate and burst on return; resting rafts also emit sustained wingbeats. | Fixed; expire inaudible beats and gate on flight/take-off. |
| P2 | iPad Safari can dismiss native fullscreen during a wind gesture. | User-reported; likely browser-owned dismissal, still needs target-device confirmation. |

### Shader portability

The audit found **73 literal reversed-bound calls inside GLSL templates in 22 files**, including
`src/world/heightfield.ts`, `water.ts`, `water/swell.ts`, `sky-radiance.ts`, swan shading and marine animals.
For example, the heightfield uses `smoothstep(10.0, -14.0, …)`, and grass uses
`smoothstep(-600.0, -660.0, …)`. This count excludes JavaScript's deliberately reversible helper and does
not exhaust variable/interpolated bounds.

The [GLSL ES specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
leaves results undefined when the first edge is greater than or equal to the second. A driver may therefore
render different terrain, masks, shading or water even though local Chrome looks correct. This is a verified
specification violation, not a reproduced failure on Jeremy's iPad.

Replace descending ramps with `1.0 - smoothstep(low, high, x)` or one explicit descending-ramp helper.
Handle equal edges deliberately. Preserve CPU/GPU terrain parity and test frozen views across Metal, WebKit
and an additional GPU family. This broad shader pass is deferred to avoid changing dozens of visual paths
without those comparisons. Inventory: `/tmp/updraft-production-review/shader-literal-reversed.json`.

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

1. **Reduce startup construction cost.** The latest combined production build's main chunk is 1,711.83 kB minified
   / 520.98 kB gzip. The engine constructs and prepares the entire archipelago before Begin. Splitting this
   file alone will not remove that work. Candidate first steps: generate deterministic water textures at
   build time with exact byte parity, then evaluate preparing distant chapters during playable slack time.
   `water/textures.ts` currently computes 4,194,304 cosine terms for ripples and four 256² Worley fields
   for lace. Three desktop Node runs measured 215–253 ms for ripples and 50–71 ms for lace; these are
   component timings, not browser boot or iPad measurements (`texture-cpu.json` in the evidence directory).
   Any staged preparation must retain checkpoint starts and avoid chapter-entry stalls.
   The cold browser profile also attributes about 0.66 s of sampled self time to the heightfield's
   `pcg`/`hash2`/`gradDot` functions. `heightAt()` already uses the GPU-baked CPU grid once installed;
   target repeated construction-time queries before adding another cache to normal gameplay.
2. **Measure graphics memory alongside FPS.** Grass reserves all three quality tiers so promotion never
   allocates mid-play. Its four attachments total about **28.17 MiB** at default settings, before other
   world textures, reflection, scene/MSAA/depth targets and bloom. Low reduces drawing cost but retains
   these grass allocations. Review the memory budget on older iPads; consider a bounded pool or compact
   immutable data only if it preserves promotion behavior, tile coverage and existing blade precision.
3. **Remove verified hot-loop allocation.** `nearbyCreature()` builds spread arrays of rabbits/songbirds
   on every query; `worldStep()` creates the environment object and callback; `CameraRig.fitSubjects()`
   creates small arrays/closures each substep. Reuse scratch state or iterate existing populations directly
   if profiles show GC pressure. Keep tie ordering and subject-fit behavior identical.
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
- **Give checkpoints typed payloads.** `CHECKPOINTS`, chapter serialization and restoration duplicate names,
  lengths and positional-number meanings. A typed per-chapter schema/decoder can catch drift at compile
  time while retaining the existing v1 migration rules. Existing malformed-storage guards and fixtures are
  valuable; retain compatibility tests for old saves.
- **Consolidate test plumbing.** Many tools duplicate TypeScript loaders and browser setup/locking.
  `tools/lib/browser.mjs` already provides the shared GPU lock, but some older tools launch directly.
  This review moved the Begin-screen check onto that lock, preserving its requirement for a real user
  gesture to start audio rather than inheriting the helper's autoplay override.
  Standardize ownership, cleanup and a discoverable quick/mechanics/browser/release runner so accidental
  concurrent GPU checks do not invalidate measurements.
  Two existing fixtures had drifted: Begin expected audio even though `shot` defaults to mute, and Sleeping
  attempted the feather checkpoint before completing the newer walk-around-bed/tuck-in sequence. The
  tests now explicitly set the sound preference before the real Begin gesture and arrange a completed
  tuck-in, retaining the original audio-unlock and saved-position assertions.
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

Physical iPad Safari validation remains a release requirement. A stable combined checkout should receive
the final release playthrough once the separate audio work has finished.
