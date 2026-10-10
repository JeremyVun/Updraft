# Drowned village final review — 2026-10-10–11

Brief and constraints: [design.md](design.md), Jeremy's final pre-merge review. Review starts at `568a5f22`
on `proto-drowned-integrate`; evidence directory `/tmp/updraft-final-review-atQrxM/`. Review complete.
Verified findings below are fixed; merging with current main remains a separate, unperformed step.

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

No merge or deployment performed. Read-only `git merge-tree` against main `97f7e4d4` found 11 conflicting files:
`AGENTS.md`, `src/audio/foley.ts`, `src/fx/wind-gesture.ts`, `src/main.ts`, `src/story/stairs.ts`,
`src/traveller/boat.ts`, `src/traveller/child/shader.ts`, `src/traveller/traveller.ts`, `src/world/drowned.ts`,
`tools/check.mjs`, `tools/journey-pacing-check.mjs`. See `merge-preview.txt`.

Resolve shared imports, wind gesture styling, boarding/push-off changes, stairs handoff and village setup by
preserving both branches' behavior. Keep the union of the check registrations and QA exposure. The resulting
merged tree needs its own typecheck/build, relevant shared-system tests and gameplay replay; this branch's
checks cannot validate conflict resolutions that have not happened yet.
