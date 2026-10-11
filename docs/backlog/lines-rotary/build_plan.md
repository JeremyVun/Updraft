# Rotary washing line prototype

Status: implemented in the isolated `codex/lines-rotary` worktree for design review. The prototype is playable;
landing it into the concurrent main work is a separate owner decision. Read [the brief and design](design.md) first.

## 1. Layout and mechanism — done

Files: `src/world/lines-layout.ts`, `lines-passage.ts`, `lines.ts`, `lines-rotary.ts`, `rotary-washing.ts`,
`pinwheels.ts`, `heightfield.ts`, `terrain-heights.ts`, `src/tuning.ts`, `src/main.ts`.

A half-loaded four-arm rotary stands between curtains two and three. A locally brushed sheet writes shared wind;
the rotor reads that wind, keeps its momentum, and catches at either half-turn. Empty lines, the offset walk and the
settling interval make a physically clear passage. Family and doorway share location constants with their actors
and portal. Scenery reservations and worn grass never depend on puzzle progress. Jeremy rejected the family against the
beach: the northern terrain now extends 40 m with another layer of washing, preserving the arrival heights and
returning the family and door to an inland clearing at their original elevation. The terrain height atlas includes
the extended underwater slope.

Verification: real gestures in both directions, full route in landscape, touch in portrait, idle/off-target/muted
input and coast/stop behaviour at 30/60/120 Hz. The existing curtains keep their different physical openings.

## 2. Story and composition — done

Files: `src/story/lines.ts`, `src/world/lines-layout.ts`, `lines-passage.ts`, `lines.ts`, `src/tuning.ts`.

The child and bird wait beyond the swept circle; once the bearing settles, they look toward the newly visible
colours and pass east of the mast. The camera arrives from behind them, holds its direction during gestures, and
continues toward the last curtain. Portrait uses a closer view than preserving the desktop's full horizontal field.
The final family view clears the grass and the fallen sheet, keeping the original sleeve/door sequence.

Verification: sequential captures from the actual player camera, including the approach, turning, opening, passage,
third curtain, family and doorway. Evidence and rejected compositions are recorded in the design document.

## 3. Saves and integration — done

Files: `src/story/checkpoint-data.ts`, `src/story/journey.ts`, `src/start-screen.ts`, `src/world/doorway.ts`,
`tools/lib/rotary-gesture.mjs`, `tools/rotary-washing-*.mjs`, existing Lines/progress/playthrough checks and docs.

New `rotary` checkpoints restore before the new encounter. Legacy `curtain-2` checkpoints restore after it, with
the bearing already caught. QA `chapter=rotary` starts at the new puzzle. Existing real-gesture automation turns it
before attempting curtain three. Portal clipping uses the moved door, and the far-shore save remains compatible.

Verification: production build/typecheck, shader and boot-cloth checks, checkpoint schema, full Lines replay with
checkpoint reloads through boat departure, and focused Lines progress restore checks. A physical iPad check and
release boot/performance comparison remain release work; no deployment is part of this prototype.
