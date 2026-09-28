# Build plan: bug sweep

The design is `design.md` in this folder; item numbers below are its sections. Read it and `docs/testing.md` first.

## Standing rules

- Work in worktrees under `/private/tmp`, forked from current `main` after `git log main --since='1 day'` and the
  coord notes. Commit after every step. Give each worktree its own dev server and check the listener's cwd.
- At most one or two build agents alongside peer sessions. Nonvisual phases go to Opus subagents. Visual capture,
  visual judgement and anything that changes the look or the camera go to an allowed visual model (Opus, or Astra
  with Jeremy's authorisation), per the model-routing rules.
- Browser and GPU checks run one at a time (shared lock). Node checks need `node_modules`: symlink the main
  checkout's into a worktree.
- Confirm each bug on `main` before fixing it; if it is already gone, say so and mark the phase done.
- A failing check is fixed in the game unless the check tests behaviour Jeremy deliberately changed; never widen a
  limit without writing down why the old one was wrong.
- Update the affected docs (`chapters.md`, `stairs.md`, `cygnet.md`, `journey.md`, `styles.md`, `roadmap.md` Known
  issues and Checks) in the same change as the fix.
- **Jeremy's ruling (2026-09-29):** "before any change gets onto main, I need you to confirm the issue and if it
  survives, very clearly present the proposed change to me to prove that it's an actual bug that needed to be fixed.
  For now, lets work in a worktree". So all work happens on the `bug-sweep` branch in `/private/tmp/updraft-bugsweep`;
  for each item, show Jeremy the evidence that the bug is real on current `main` and the exact proposed change, and
  merge nothing to `main` until he approves it. Open stills in Preview for him.

## Phase 0: baseline

Run `npm run check:mechanics` and, against your own dev server, `npm run check:audio` on current `main`. Record which
checks fail and compare with design items 0 to 8. Owns nothing.
**Gate:** a list of current failures, each mapped to a design item or added as a new one.
**Status:** not started.

## Phase 1: the `checks-fix` branch (item 0)

Rebase or merge `checks-fix` onto current `main` in a worktree and re-run the checks it touches. Capture the child
close up on the QA stage (`?chapter=stage`: face, hood, coat hem, boots) before and after the shader change, on
Chrome/Metal and on software Vulkan (SwiftShader), with an allowed visual model. Show Jeremy the pairs and what the
change protects against; merge only on his OK.
**Owns:** the branch's files (`tools/*-check.mjs` listed in design item 0, `tools/lib/baseline.mjs`,
`src/traveller/child/shader.ts`).
**Gate:** `shader`, `progress-schema`, `chapter-view`, `kite-logic`, `plane-routing`, `journey-pacing`, `wood-logic`
and the three score browser checks pass; Jeremy has seen the stills and approved.
**Status:** done 2026-09-29. Stills identical on Metal and SwiftShader (insurance, not a visible fix); Jeremy: "makes
  sense to merge this child shader rework". Merged to `main` as 061c2b3.

## Phase 2: the storm and beach landings (item 1)

Keep the eased landing but stop the sideways crawl: while `beachApproach` slows the hull it must keep making for the
beach. Measure every beach arrival against 85645e9^ as well as the wood.
**Owns:** `src/traveller/boat.ts`, `tuning.sail.beach*`.
**Gate:** `boat-check` (storm 38 to 44 s at every case), `drowned-camera-check`, `boat-ground-check`,
`boat-shores-check`, `journey-pacing-check` pass; no beach arrival slower than at 85645e9^ by more than the easing's
own few seconds.
**Status:** not started.

## Phase 3: the little boats (item 2)

Trace the frame where the orange toy loses 80 units/s² and decide jolt or stale check, keeping Jeremy's "no leash"
change.
**Owns:** `src/story/little-boats.ts`, `src/world/little-boats.ts`, `tuning.littleBoats`,
`tools/little-boats-logic-check.mjs`.
**Gate:** `little-boats-logic-check` passes at 30/60/120 fps from arrival and both restores; `little-boats-check`
passes; the reason is written in the commit.
**Status:** not started.

## Phase 4: the swans at home (item 3)

Find why the pigtails commit moved the reunion's start, and make the departing V keep clear of the cygnet with a
real margin.
**Owns:** `src/creatures/flock.ts`, `tuning.swanDeparture`.
**Gate:** `flock-flight-check` passes with the closest pass well clear of 1.8 m at every frame rate;
`summit-arrival-check` and `ending-check` pass.
**Status:** not started.

## Phase 5: small fixes (items 6 and 10)

The stairs loop plays the questioning peep only (drop the `k.call(false)` in the `puzzled` beat; keep the call marks
if they belong to the peep). Correct the boot and coat comments.
**Owns:** `src/story/stairs.ts` (the `puzzled` beat only; peers are working on the stairs, so check coord first),
`src/traveller/body.ts`, `src/traveller/child/garments.ts` (comments only).
**Gate:** typecheck; `stairs-check` if it covers the loop; `docs/stairs.md` Principles and `docs/cygnet.md` voice
list updated.
**Status:** not started.

## Phase 6: the audio checks (item 8)

Triage `audio-check` ("player wind is 3 dB softer after departure") and `birches-score-check` (fixture without a
cygnet): stale check or real change.
**Owns:** `tools/audio-check.mjs`, `tools/birches-score-check.mjs`; `src/audio/` only if the game is wrong.
**Gate:** `npm run check:audio` passes in full.
**Status:** not started.

## Phase 7: the season toward spring (item 4, visual)

Propose the season values from the curtains opening to home so home's grass is green and lush; capture the sleeping
island's morning, the sea, the mirror and home at current and proposed values; show Jeremy.
**Owns:** the `season` values in `src/story/journey.ts`, `src/story/sky-mirror.ts`, `src/story/home.ts`,
`src/story/sleeping.ts` (and `world/grass.ts` only if the curve itself needs it).
**Gate:** Jeremy approves the stills; `render-parity-check` differs only in those rooms; `docs/journey.md` "The year"
and `docs/styles.md` updated.
**Status:** not started.

## Phase 8: the meadow swans (item 5, visual)

Capture the pond sequence as it plays on `main` (desktop and portrait) and compare with 88a3a5f^ where the child
startled them. Show Jeremy; restore the startled take-off only if he says it regressed.
**Owns:** `src/story/meadow.ts` (the pond beats), `tuning.crest`.
**Gate:** Jeremy's verdict on the stills or clip; if changed, `pond-view-check` and `meadow-route-check` pass and
`docs/chapters.md` (meadow) is updated.
**Status:** not started.

## Phase 9: the dark wood's hidden ember (item 7, visual and camera)

Walk the whole ember chain (desktop and portrait) and measure, at every stop, whether the waiting ember is clear of
the child's silhouette on screen. Fix the stop position or the walking shot so it always is, without new camera
jerks.
**Owns:** `src/story/wood.ts`, `tuning.wood` (`waitShort` and the walking camera), `tools/wood-logic-check.mjs` (add
an assertion that the waiting ember is not behind the child on screen).
**Gate:** the new assertion passes at every stop at 30/60/120 fps and in portrait; `wood-check` and `ember-check`
pass; `camera-intent-report` shows no new jerks or in-and-out swings in the wood; Jeremy has seen stills of each stop.
**Status:** not started.

## Phase 10: browser group and close

Run `npm run check:browser` (item 9) and triage anything new. Re-run `check:mechanics` and `check:audio`: all pass.
Clear the fixed items from `docs/roadmap.md` (Known issues and Checks), then run the backlog close stage.
**Gate:** every check group passes on `main`; roadmap current.
**Status:** not started.
