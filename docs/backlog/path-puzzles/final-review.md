# Drowned village final review — 2026-10-10–11

Brief and constraints: [design.md](design.md), Jeremy's final pre-merge review. Review starts at `568a5f22`
on `proto-drowned-integrate`; evidence directory `/tmp/updraft-final-review-atQrxM/`. Review complete.
Verified findings below are fixed. Jeremy subsequently approved the main merge; its verification is recorded below.

Reviewed:
- Production versus the approved dev build, rendering and frame cost.
- Chapter transitions, restart/save restoration, puzzle input and safety valves.
- Shared camera, traveller, wind and audio changes, including conflicts with current main.
- Dead state, duplicate logic and low-risk simplifications.
- Focused regression checks, build, production checks and natural gameplay verification.

## Findings

- **Release fog mismatch, fixed.** Production selected the expensive original fog while QA/dev selected the
  approved mist. The production-build check reproduced the mismatch. Jeremy then explicitly requested removal
  of the old renderer: the ray march, noise sampling, obsolete uniforms and tuning, selector and water-only
  overload are gone. The approved mist functions remain byte-identical; their colour, height, softness, wisps,
  clearing and storm values are preserved. Development, QA and production use the same implementation.
  `villagefog=0` still switches it off for measurement; `1` and `mist` both enable the approved renderer.
- **Unbounded kitten sound queue, fixed.** Nearby kittens keep animating after the chapter stops consuming their
  sounds. Their events accumulated indefinitely. The queue now lasts one frame, matching its contract. A real
  twenty-second simulation exercises 112 events without a consumer; removing the fix makes the regression
  check fail on a stale event.
- **Production diagnostic overhead, removed.** Cat paw-slip and climbing-contact probes ran in production.
  They are now guarded by `QA`; production checks verify diagnostics are absent while QA keeps them.
- **Redundant cat contact transforms, removed.** 1,216 of 1,882 sampled contact vertices are attached to one bone,
  but still received a second bone transform and zero-weight interpolation. Skip that unused work without
  changing the contact sample set or positions. Physical contact, rescue, sloped roofs and mill checks pass.
- **Unused state, removed.** `ChurchArrival.inBelfry` had no consumers. Larger controller refactors and reduced
  contact sampling were deliberately avoided because their risk outweighed a final-review cleanup.
- **Mill camera transitions, corrected.** Landscape replay found 1.5 seconds of walking toward the lens after
  the sheet. The existing mill approach starts six metres earlier, the sheet landing gets another 0.4 seconds
  to settle, and the post-mill dolly draws in a little earlier to keep the cat readable. Portrait replay also
  exposed a pre-existing, larger problem: its fog-biased target turned the lens through a roof and lost the
  child for 3.3 seconds. Replaying with pre-review tuning reproduced it. Reduce only the portrait fog bias;
  the repeat has zero out-of-frame time, zero roof obstruction/penetration and a longest toward-lens interval
  of 0.8 seconds. Both aspects keep the cat readability gaps below two seconds. The authored camera positions,
  zoom, movement caps, storm and farewell settings are unchanged.
- **Stale checks, corrected.** The chapter audio test still expected the gentle farewell during the storm;
  it now expects the approved dark score. The fog visibility probe only sampled ±40 m across the bank and
  14 m into it; it now samples the actual shader side bounds and the body behind the front. Its visibility
  threshold is unchanged. The old fourteen-second roof deadline predates the approved steady bank and its
  puzzle holds; the replay now requires earlier roofs to be covered by tower arrival, with the existing
  exception for the roof beside the tower. Separate checks still enforce forward-only movement at no more
  than 3.2 m/s. The lantern continuity negative control now injects a hard cutoff into the current
  shader rather than referencing the deleted renderer.

## Verification

Evidence is under `/tmp/updraft-final-review-atQrxM/`:

- Mechanics: 60 of the original 61 passed on the first suite run. The remaining `dream-story` expectation was
  corrected and rerun successfully; the new `cat-events` check also passes. `mechanics/results.json`,
  `dream-story-final.log`, `contact-final.log`, `rescue-final.log`.
- All 18 audio checks pass: `audio/results.json`.
- All five drowned saves reload and play on: sail, roofs, church, belfry and storm. `progress.json`.
- Real rescue replay: 4.00 seconds of sailing before tone/effect, 9.37 m travelled, all three cue notes scheduled;
  fog does not retreat or pivot, advancing at most 3.20 m/s. `full-audit.json`, `audit-check.log`.
- Mist shader: 54 cases pass continuity, split-ray and reversed-ray checks, plus bell clearing and camera-height
  transitions. Lantern continuity passes; an injected hard cutoff fails as intended. `mist-final.log`,
  `lantern-final.log`, `lantern-negative.log`.
- Bell checks pass at 30/60/120 Hz, gentle swaying, fast repeated input, single strokes and idle. Farewell framing
  passes both aspects at 30/60 Hz, with the camera above the mist. `bell-final.log`, `farewell-final.log`.
- Entry/storm cameras pass both aspects, calm and gusting, 30/60 Hz, through the woods landing. `camera-final.log`.
- Typecheck, production build, shader bounds, fog-motion and production/QA bundle checks pass. Both builds include
  `mistOptical` and exclude `seaFogMarch`/`SeaFogRay`. `typecheck-final.log`, `build-final.log`,
  `shader-final.log`, `fog-motion-final.log`, `production-final.log`.

At Ultra (1600×900, device scale 1.5), six-second belfry samples with mist enabled and disabled both measured
60 fps, p95 16.7 ms and no frames over 25 ms. This is a local performance comparison, not a mobile-device
guarantee. `perf/belfry.json`.

The complete 900×1600 portrait replay passes from the first roof through the woods landing, with gentle bell
strokes: no camera cuts, no child occlusion or off-screen interval, no missing plane frames on either climb,
and the camera's lowest farewell position at 2.741 m. The cat and kitten remain in their window. The boat
returns without further wind. Evidence: `upright-final.log`, `upright-final-trace.json` and `upright-final-*.png`.
The complete 1800×910 landscape replay also passes through the woods landing with rapid bell input: four
rings, automatic boat return, no camera cuts, no child occlusion or off-screen interval, no missing plane
frames, and no reversal during boarding/look-up (5.9° left, 0.2° right). `wide-final.log`,
`wide-final-trace.json` and `wide-final-*.png`.

Reviewed captures include `wide-final-farewell-hold.png`, `wide-final-storm-20.png` and
`upright-final-mill.png` (also opened in Preview). The approved mist shader body is byte-identical to its
pre-removal copy, `mist-before.glsl`; only the obsolete alternate renderer was removed.

The full-game release suite and physical iPad/Safari checks were not rerun for this focused branch review;
see `docs/testing.md` for the eventual release checks.

## Integration with main

Jeremy approved merging `79c8c621` into local main `97f7e4d4`. The 11 conflicting files were:
`AGENTS.md`, `src/audio/foley.ts`, `src/fx/wind-gesture.ts`, `src/main.ts`, `src/story/stairs.ts`,
`src/traveller/boat.ts`, `src/traveller/child/shader.ts`, `src/traveller/traveller.ts`, `src/world/drowned.ts`,
`tools/check.mjs`, `tools/journey-pacing-check.mjs`.

The resolutions preserve main's whale audio, numeric wind-stroke widths, boarding departure course, stair-sail
unmirroring, continuous rope phase and character lighting. They also preserve the village's bell audio,
high-contrast wind invitations, boarding from a roof, rotated stairs handoff and room lighting. Boarding now
uses named options for the two independent behaviours. Check registrations and QA exports retain both branches.
The analytic mist shader body is byte-identical to the approved branch (`parity.json`); no alternate renderer returns.

Merged-tree evidence: `/tmp/updraft-drowned-merge-6sLLVd/`.

- Typecheck, production build and production/QA bundle checks pass.
- All 63 mechanics checks were run. The initial run passed 61; `camera-direction` then passed after correcting
  a stale fixture that expected an instantaneous start at 12 m/s. The fixture now accelerates into the same
  speed and separately rejects a camera jerk from a one-frame hull displacement. Main's camera code was retained.
- The remaining `pond-view` failure reproduces exactly on pre-merge main in an isolated worktree: portrait
  waiting-swan horizontal extent 0.900828867 against a 0.9 margin. `pond-main-baseline.log`.
- 18 of 19 audio checks pass, including drowned music and whale voice. `marine-audio` still fails its
  first-crossing whale surface sequence, as already recorded in build-plan N9. Its test and SeaLife implementation
  are unchanged from main. This is separate from the passing encounter voice and sea gameplay checks.
- Continuous stairs-to-village replay passes through rescue and the first roof. Actual tone/effect onset is
  4.00 seconds after sailing begins, with 9.27 m of travel and all three cue notes scheduled. The audit now compares
  two game-clock timestamps, so starting in an earlier chapter does not mix chapter time with global time.
  The previous direct-entry recording also passes the corrected audit. `stairs-rescue.log`, `rescue-audit.log`.
- Landscape 1800×910 roof-to-woods replay passes with rapid bell input, automatic boat return, no camera cuts,
  no missing plane frames and boarding pan of 5.6° left / 0.1° right. `wide.log`, `wide-trace.json`.

- Portrait 900×1600 roof-to-woods replay passes with gentle bell input, no cuts, no missing plane frames,
  and boarding pan of 5.9° left / 0.2° right. `portrait.log`, `portrait-trace.json`.
- All five village saves reload and play on: sail, roofs, church, belfry and storm. `progress.log`, `progress.json`.
- All 54 analytic mist cases and lantern continuity checks pass. `mist.log`, `lantern.log`.

The reviewed work is merged into local main. No push or deployment was performed. The pre-existing untracked
`assets/art-direction/drowned-dusk-2026-10-11/` remains outside the merge. The two unrelated baseline failures
were then fixed as described below; this verification is not a whole-game release certification.

## Baseline failures fixed after the merge

Jeremy requested both fixes on 2026-10-11. Evidence: `/tmp/updraft-baseline-fixes-hVoE9o/`.

- **Marine audio:** the test still expected the old whale's two breaths. The approved first-crossing animation
  breathes once (the design's first-crossing whale section already records this). Its exact expected order is now
  surface, breath, fluke drainage, dive. All 56 assertions and seven offline renders pass, including two successive
  surfacings at 10/30/60/144 Hz, attenuation, stereo placement, muted output, source cleanup and peak limits.
  Actual animation and sound code are unchanged. `marine-before.log`, `marine-after.log`, `marine-report.json`.
- **Pond framing:** continuing past the first failed assertion exposed waiting swans outside the portrait frame
  and brief bank occlusion on one approach. The approach lens is 0.3 m higher; portrait starts at −0.32 radians
  around the approach axis with a 0.85 distance scale, easing into the existing shore composition. The unchanged
  pond check passes all twelve cases: two approaches, both aspect ratios, 30/60/120 Hz. Every bird is seen running
  and lifting, then the V is allowed to leave. No assertion or margin was relaxed. `pond-before.log`,
  `pond-context.log`, `pond-final.log`.
- **Browser review fixture:** it previously skipped the piano without waking the island, so its captures showed
  an invisible flock. It now uses `skipToCrest()` and asserts the family is visible. The real-renderer check passes
  in landscape and portrait, including terrain parity and crossing visibility. `journey-view.log`, `journey-view.json`.
- **Visual comparison:** seeded before/after captures at 4, 13.5, 16 and 32 seconds show the same child positions
  in every pair. Both cameras return to the same shore position by 32 seconds. The family, take-off and companions
  remain readable; landscape keeps its composition and portrait gives the birds room beside the child.
  `pond-render-final.json`, `pond-final-*-before-*.png`, `pond-final-*-after-*.png`; reviewed pairs opened in Preview.
- Related meadow-route, meadow-plane, piano-frame, flock-flight and camera-direction checks pass. Production
  build (including TypeScript) passes, with the existing bundle-size advisory. `build-final.log`.

Together with the merge run and focused reruns, all 63 registered mechanics and 19 audio checks now have passing
results. The complete browser/release suite and physical-device checks were not rerun. The approved village mist,
camera, animation and audio were not changed by these fixes.
