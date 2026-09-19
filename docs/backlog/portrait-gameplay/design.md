# Phone and portrait gameplay

Status: deferred; needs a full gameplay audit and design discussion before implementation.

## Owner brief — 2026-09-19

> Portrait mode needs a full gameplay pass to check how it plays on phones, but this is a big one outside the scope of this session. Create a backlog item for it.

## Problem and evidence

The desktop review found that the opening boat is outside the portrait frame at 390 × 844. Its projected horizontal coordinate was 1.48, beyond the visible range of −1 to 1. `src/camera.ts` caps the vertical field of view at 62 degrees, so widening that view alone does not preserve the opening composition. This is a confirmed starting point, not the complete phone issue list.

Review the entire journey on phones, from first input through credits and replay. Preserve the brief in `docs/journey.md`: the child, companion and current wind target must be readable; the way onward must be discoverable without instructions. Do not solve framing by shrinking everything until gestures become difficult.

## Scope for the future pass

- Play every chapter in portrait, including arrivals, departures, optional interactions, pond flight and recovery, the dark wood search and the ending. Check landscape and orientation changes as well.
- Check touch swipes and circles, finger occlusion, reachable targets, interrupted touches and the absence of mouse hover. Preserve wind feel and the wordless story.
- Check narrow and tall viewports, safe areas, browser bars opening and closing, sound/replay controls and page scrolling or zoom interfering with play.
- Measure frame pacing, render scale and legibility on actual iOS Safari and Android Chrome hardware. Desktop viewport emulation is useful for framing but cannot establish phone performance or touch feel.
- Check background/resume and graphics recovery, with the separate context-loss finding in mind. Test long sessions, not just chapter shortcuts.
- Retest desktop framing and controls after any shared camera or input changes.

## Design still to settle

Choose the supported phone/device matrix and performance target with Jeremy. Audit first, then choose chapter-specific compositions, shared framing constraints or interaction changes from the evidence. No camera redesign, forced orientation, phone quality budget or new product copy is approved by this item.

## Entry points and acceptance

Read `docs/journey.md`, `docs/styles.md`, `docs/engine.md` and the wind contract. Relevant code: `src/camera.ts`, chapter shots in `src/story/`, `src/input/pointer.ts`, `src/main.ts`, `src/styles.css` and `src/gl/quality.ts`. Use `tools/play.mjs` for repeatable captures and `tools/perf.mjs` for instrumented runs; keep evidence outside the repository unless it is needed as durable design material.

Pass when the agreed devices complete the whole journey without unreachable interactions, clipped essential subjects, orientation traps or accidental browser gestures; performance meets the agreed target; and desktop play remains intact. Record device/browser versions, chapter-specific findings, measurements and any remaining limitations. See `build_plan.md` for the deferred sequence.
