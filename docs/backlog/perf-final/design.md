# Final performance pass over the whole game

## Jeremy's brief (verbatim)

2026-09-29, after the stairs in the clouds were added:

> yea after we added the stairs level, i need another pass to find performance optimisation opportunities.

> in terms of the perf, create a backlog item for a final perf profile and optimisation pass over the whole game

## What this is

A fresh profile of the whole journey as it now plays, then savings, in the order the last pass used: exact ones first
(no pixel or sample changes), then anything that changes the look, each brought to Jeremy with evidence before it
merges. It is the last pass before release, so it also checks that nothing the game gained since the last pass (the
stairs in the clouds, the child rebuild, bedtime, the cloud sea, the cygnet's catch-up swim) is spending more than
it shows.

The previous pass, `docs/backlog/perf-bakes/`, is fully merged (its last phase, the close, is still to run). Its
rulings carry over unless Jeremy changes them:

- **The target is energy over a whole playthrough on Jeremy's M5 iPad Pro at High (1.5×, MSAA 2)**, not frame time
  alone (2026-09-25: a playthrough cost 30% of the battery, then 15 to 18% after that pass; "the back of ipad still
  gets hot. There must certainly be more computation (cpu or gpu) that we can save on in the game"). A cost in a room
  the player spends ten minutes in outweighs the same cost in a one-minute one; CPU script and the audio graph count
  as well as the GPU.
- **Exact first, then the look.** Changes that keep every pixel and sample go first. Anything that changes the look
  gets stills or video for Jeremy and merges only on his verdict.
- **Kept as ruled:** High stays 1.5× (L1 rejected 2026-09-26); alpha-to-coverage stays (L2 breaks the sail's
  see-through cutaway). Drawing the sky at lower resolution or less often was left out of the last pass as a
  separate decision (13 to 15% at sea and on the mirror); it can be raised again here as a look change.

## Scope

- Every room, the crossings, the ending and the credits, on the path a player takes (`tools/playthrough.mjs`), with
  the time spent in each so costs are weighted by minutes.
- GPU per pass and per object, CPU per frame (story, creatures, cloth, wind), the audio graph, readbacks, and
  graphics memory (`docs/engine.md` "Open": no target-device budget yet).
- The stairs in the clouds in particular: the cloud deck GLSL is in `ATMO_GLSL`, which every shader includes, so it
  may cost in every room, not only the stairs.
- **Not in scope:** the boot freeze and the loading veil, which are `docs/backlog/boot-veil/`. Anything learned here
  about startup is handed to that item.

## Constraints

- Nothing changes how the game plays, the camera, or the story's timing.
- Play never freezes or hitches for a saving (Jeremy, 2026-09-29, on setting up the stairs: "what i want to avoid
  though it having the gameplay itself freeze"). Deferring or streaming work must be proven hitch-free with the
  frame-time checks.
- Measurement rules from `docs/engine.md` "Measuring": a worktree with its own server, no other Chrome capture
  running, builds compared back to back, never against remembered numbers. Desktop deltas are not iPad numbers.

## Next (design, not yet ready to build)

1. Close `perf-bakes` first (its phase 7: durable rules and numbers into `docs/engine.md`, new checks into
   `docs/testing.md`, delete the folder), so this pass starts from one record.
2. Settle with Jeremy what "done" means (open questions below).
3. Profile: a traced playthrough with per-chapter GPU census (`tools/frame-profile.mjs`), CPU profiles, the audio
   cost (`tools/audio-cost.mjs`), power where the tools allow (`tools/power-profile.mjs`), minutes per room; compare
   with the last pass's per-chapter numbers where they exist, re-measured back to back at the base the last pass
   ended on.
4. Bring Jeremy the ranked list of costs and candidate savings (exact and look-changing), then write `build_plan.md`.

## Open questions for Jeremy

- **Goal:** is the target still battery and heat on the M5 iPad at High, or also smoothness on weaker devices
  (older iPads, phones), which would bring Medium and Low and graphics memory in?
- **Evidence from the iPad:** the last pass could only estimate the iPad from the Mac. A battery figure for a full
  playthrough now, and the `?stats` readout on the iPad in the stairs, would anchor this pass.
