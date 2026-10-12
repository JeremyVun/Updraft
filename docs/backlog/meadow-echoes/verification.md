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
