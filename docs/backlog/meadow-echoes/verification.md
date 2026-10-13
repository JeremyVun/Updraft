# Meadow prototype verification

Worktree: `codex/meadow-echoes`, based on local main `45feff79`. Main's music edits were left untouched.
Development server: `http://127.0.0.1:5244/`. Whole chapter: `?chapter=meadow&progress=0`.
Direct encounter: `?chapter=echoes&progress=0`.

## Played and inspected

- `/tmp/updraft-meadow-full`: real mouse gestures from grey landing through the four piano answers, both
  seed transfers, crest, migration, feather, return and boarding; entered `toBirches` at 343 game seconds.
  This precedes the final camera and input refinements.
- `/tmp/updraft-meadow-framing`: revised landscape views, both transfers, and the last flower's departure.
  The camera faces across the hollow, keeping the pond outside the flower composition.
- `/tmp/updraft-meadow-portrait-review`: final 390×844 touch run from the first flower through boarding;
  transfers completed at 26 and 49 seconds, final listening finished at 64, departure at 207. The first
  exchange took about seven seconds of broad strokes and the second about nine. Idle and off-target input
  did not advance them; all active source, receiver and child head/feet projections stayed inside the frame.
- `/tmp/updraft-meadow-desktop-final`: final landscape exchange, both transfers and onward walking passed;
  completed at 25 and 47 seconds, final listening finished at 63. `/tmp/meadow-contact-touch-*.png` captures
  the bow/touch/release in chronological frames. Real circles carried both plumes successfully too
  (`/tmp/meadow-contact-{circle-arrival,second-circle-arrival}.png`). The plume is instanced as one draw.
- Actual checkpoint writes and page reloads passed for `meadow/piano`, `echoes-1`, `echoes-2` and `pond`.
  Captures: `/tmp/updraft-progress-meadow-<point>.png`.

These are automated real-pointer playthroughs, state traces and visually inspected stills. No recorded video
was used as a substitute for a motion review. No claim is made of human listening, first-time-player comprehension,
or physical-device performance. Portrait can glimpse distant water from the first slope; the playable flowers
and child remain the foreground. The final creative verdict belongs to Jeremy's playthrough.

## Focused checks

Passed: TypeScript, production build and production/QA separation; seed simulation and world input checks at
30/60/120 Hz; current/legacy progress schema; real checkpoint reloads; piano gesture, colour growth, camera and
audio handoff; meadow route and plane; pond sight lines and migration; companion wing-care story; camera direction.

The new breath voice renders in Web Audio with no bundled sample. Its five-note overlap stress case peaks at
−15.18 dBFS, has no clipped samples and falls completely silent after the voices finish. This tests envelope and
headroom, not whether the timbre is pleasing. The existing large JavaScript chunk warning remains.

The seed checks reject idle, muted, absent, disabled and opposing input, preserve partial/complete progress, test
both strokes and lift, and measure continuous arrival into the receiving bloom. The two new checkpoints keep
completed transfers while preserving the child's remaining walk and final listening beat. Legacy route fixtures
explicitly skip the new encounter because those tests exercise the downstream paper/pond behavior; the new
encounter has its own real-input checks. The full-journey driver now follows Meadow's directional invitations.

The deliberate idle-drift negative control failed at “idle cannot complete”, confirming that the guard detects
an automatic solve. Final production build passed after the feel constants were moved into `tuning.ts`.

## Readiness review after Jeremy's challenge

The earlier pass missed the hand reaching under the flower without touching a petal, leaves staying in their
rest position during the bow, and a wide camera retreat between the final flower and the crest. Those are fixed.
The near mitten now rests on a rendered petal vertex for more than 0.6 seconds at 30/60/120 Hz; the child stands
beside the flower so the hood does not hide the contact. Both flower crowns join the camera bounds.

The final flower composition passes directly into the pond view over sixteen metres of the child's walking.
Holding the whole child required more head/foot space, a slightly higher crest eye and the same viewing distance
on portrait as landscape. The camera does not retreat to hold the departing flock. All twelve pond cases
(both banks, both screen shapes, 30/60/120 Hz) retain all fifteen swans' runs/lifts and clear sight lines.

- `/tmp/updraft-meadow-readiness-before`: full grey landing through departure, 346.9 game seconds, before these fixes.
- `/tmp/updraft-meadow-readiness-final`: final full mouse play from grey landing, all piano answers, both flower
  transfers, migration, feather, shower and boarding; entered `toBirches` at 343.8 game seconds without errors.
  The camera trace checks 6,035 frames from the flower approach through the descent. Projected head and feet
  keep at least 11.4% screen margin. Maximum eye-to-child distance during the flower departure is 19.35 m,
  compared with the original retreat to 44.2 m. Chronological captures include all those handoffs.
- `/tmp/updraft-meadow-readiness-portrait`: full touch play from the first flower through departure, 209.9 game
  seconds, before the final crest eye-height adjustment. Both flowers' crowns and playable points fit. The
  frame audit checks 5,955 frames with at least 10.5% margin for projected head and feet.
- `/tmp/meadow-portrait-exit-final-*.png`: targeted portrait checkpoint replay after the final crest adjustment,
  from the last flower's listening beat through departure, crest and descent. All 1,804 traced frames keep the
  projected head and feet inside the viewport; the chronological captures were inspected.

`meadow-camera-audit.mjs` rejects the old 44.2 m retreat and the intermediate cropped-foot capture; these are
recorded negative controls. Final TypeScript, build, contact/input/checkpoint state checks, pond sight lines and
the 30/60/120 Hz route checks pass. Build log: `/tmp/updraft-meadow-readiness-build.log`.
This remains inspected chronological stills, camera traces and real-input play, not a human motion or listening review.
