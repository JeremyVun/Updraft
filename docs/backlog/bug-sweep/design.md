# Bug sweep: regressions and stale checks found while verifying the docs

On 2026-09-28/29 the docs were checked claim by claim against the code, and the automatic checks were run. That
turned up real bugs, some checks that had fallen behind the game, and one bug Jeremy added from his own playtest.
This item is for a fresh session to investigate and fix them. Jeremy's brief (2026-09-29): "Create a /backlog-item
for the bugs for another session to investigate", and on the dark wood: "in the dark forest, at some of the points
where the child stops, the camera position is such taht the child is directly blocking the ember (the player can't
see it)."

Every bug below says what was observed, how to reproduce it, what is already known about the cause, and what "fixed"
means. Where a fix depends on what Jeremy wants, his ruling is quoted with its date. Nothing here is fixed yet.

## Ground rules for this item

- Investigate first: confirm each bug on current `main` before changing anything, because peers merge often. Some
  may already be fixed by the time this runs.
- A check that fails because it tests behaviour Jeremy deliberately changed is stale: update the check. A check that
  fails because the game got worse is a bug: fix the game, not the limit. Never widen a limit to make a check pass
  without saying why the old limit was wrong.
- Visual changes and visual verification (stills, look of the season, camera framing) go to an allowed visual model
  (Opus or Astra with Jeremy's authorisation), per the model-routing rules. Show Jeremy stills of every visual
  change, opened in Preview.
- Record in `docs/` (chapters, contracts, roadmap) any behaviour that changes, in the same change.

## 0. The `checks-fix` branch (merge only after Jeremy sees stills)

Branch `checks-fix` (one commit on top of 8cd3d5b, not merged) updates the checks that fell behind deliberate
changes, so that afterwards every failing check points at a real bug:

- `meadow-`, `birches-` and `sea-score-browser-check`: those rooms have no cursor chimes (see
  `docs/contracts/audio.md`), so the checks now assert silence after a gesture instead of waiting for a chime.
- `progress-schema-check`: its parity baseline (`tools/lib/baseline.mjs`) moves from 188c9fa to 357177f, the last
  commit that changed `src/story/progress.ts`; old checkpoints must keep their arity, new ones may be added.
- `chapter-view-check`: the fixture's cast gains a `child` with `openBag()` (the journey now opens the bag).
- `kite-logic-check`: the stairs kite is tied on its deck (like the mirror's), and the crossings `toStairs` and
  `drowned` expect the birches' and the stairs' kites.
- `plane-routing-check`: the Lines shore no longer throws the paper (the child keeps it from the door to the boat),
  so the two Lines blocks assert she keeps it and boards in time.
- `journey-pacing-check`: the fixture's cast gains `lines: { gust() {} }` (the storm's snatch draws wind lines).
- `wood-logic-check`: embers now light in about two seconds of circling (8135c02, `tuning.wood.updraftCatch`), so
  the window is 1.5 to 3 s instead of 2.5 to 5 s.
- **One game-code change**, `src/traveller/child/shader.ts`: six `smoothstep(high, low, x)` calls (lines 34, 61, 165
  twice, 229, 230) rewritten as `1.0 - smoothstep(low, high, x)`. GLSL leaves `smoothstep` undefined when the first
  edge is not below the second; most GPUs happen to draw it as intended, some drivers may not. An earlier hardening
  pass removed every such call and `tools/shader-check.mjs` enforces it; the child rebuild brought six back. The
  rewrite is mathematically identical.

**Jeremy's ruling (2026-09-29): "yes, but I want stills showing what rendering issues were fixed first before
anything from that branch touches main".** So before merging: capture the child close up (the stage,
`?chapter=stage`, face, hood, coat hem and boots) before and after the shader change, on Chrome/Metal and on
software Vulkan (SwiftShader, as `tools/shader-browser-check.mjs` launches it), and show Jeremy the pairs. If the two
builds look identical on both, say so plainly: the fix is then insurance against drivers that draw it wrong, not a
visible change. Merge only after his OK.

## 1. The storm reaches the dark wood about 15 s late

- **Observed:** `node tools/boat-check.mjs` fails: `storm duration 55.6` against 38 to 44 s (Jeremy, 2026-09-19: "I'd be looking to increase the journey
  through the storm by 10-15 seconds"; it was then built at about 41 s).
  `node tools/drowned-camera-check.mjs` fails on the same passage: "sailing camera looks steeply down at the child:
  25.2 degrees" at t 132.5, beat `after`.
- **Cause, as far as known:** bisected to 85645e9 (beach landings). A per-second trace of the boat from the weather's
  start: full speed (5.8) to about 39 s, then `Boat.beachApproach` caps the speed once the wood's shelving shore is
  within `tuning.sail.beachLook` (9) of the bow; at about 1 unit/s the breeze drift (`w * drift` in `Boat.update`)
  and the steering carry the hull sideways along the shore (x from -21 to -30 and back to -23) for about 15 s before
  the forefoot finds `heightAt > -0.25` and `beaching` starts. Before 85645e9 the boat ran in at full speed and
  stopped dead, so the passage took 41.4 s.
- **Traced (2026-09-29):** not a sideways crawl. The wood's landing point (`WOOD_LANDING`, the passage's last
  waypoint) lies in the water just short of the sand. The eased hull reaches it at about 2.3 units/s before the
  forefoot touches, the waypoint is then behind it, and the steering comes round for it: at about 1 unit/s the boat
  circles in front of the beach for about 13 s (its heading turns through more than a full circle) until the forefoot
  happens onto the sand. Before 85645e9 it was still at full speed past the waypoint and touched at once.
- **Jeremy's ruling (2026-09-29):** "if there's circling, that needs to be fixed". The reason for the fix is the
  circle the player sees, not the 38 to 44 s window; the storm's length is whatever the straight run-in gives.
- **Fix:** with the beach ahead inside `beachLook`, a boat that has passed its landing point (bearing to it more than
  90 degrees off the bow) holds its course and runs up the sand instead of turning back (`Boat.update`).
- **Found underneath (2026-09-29):** with the storm passing, `boat-check` reached its lighthouse block, which
  asserted the lamp is out 20 s into the storm and before the snatch (`lighthouseOutAt < gatherFor`). 2e915c6 moved
  the lamp out to 23 s, so the plane (taken at 22 s) now goes while the lamp is still faltering. **Jeremy's ruling
  (2026-09-29): "Overlap is fine".** The check asserts the lamp is out by `lighthouseOutAt` and no longer orders it
  before the snatch.
- **Check the other beaches too:** every beach arrival now goes through `beachApproach`. Measure each (lines, boats,
  meadow, birches, stairs island, wood, sleeping) for the same sideways crawl; `journey-pacing-check` passes on the
  crossings it covers, but compare arrival times with 85645e9^.
- **Fixed means:** the boat still eases up the sand (Jeremy asked for that on 2026-09-28: "everytime the boat hits
  land, it instantly stops ... It doesn't look very polished"), but it keeps heading for the beach while it slows, so
  the storm is back to about 41 s and `boat-check` and `drowned-camera-check` pass unchanged.

## 2. The little boats: the orange toy stops abruptly

- **Observed:** `node tools/little-boats-logic-check.mjs` fails: "30fps from arrival: orange boat lost momentum
  abruptly: 80.7" (limit 3 units/s²).
- **Known:** the momentum failure started at 1e0d470 ("update", Jeremy, 2026-09-28), which removed the limit that
  held the child's toy near the swimming cygnet (`swimLead`) and gave the cygnet a launch speed into each pool
  (`swimLaunch`). That change is deliberate (Jeremy, 2026-09-27: "give the cygnet a moving start so it's better able to
  catch up or something. the boats shouldn't be affected by a leash i think (it doesn't feel good for the player)"). The
  remaining limit is the child's lead (`Math.max(3, childS + tuning.littleBoats.childLead)` in
  `story/little-boats.ts`).
- **To settle:** is the 80 units/s² drop a real jolt the player would see (the toy hitting the child's limit, or a
  handoff), or is the check measuring something the change made meaningless? Trace the frame. If it is a jolt, fix
  it; if the check is stale, update it and say why.

- **Traced (2026-09-29):** not the child's limit. `LittleBoats.update` clipped the toy's step at the outlet
  (`Math.min(L.length, limit)`) even when nothing held it, so on the frame it crossed s = 101 its speed fell from 3.3 to
  0.6 and the sail needed a second to bring it back. Older than 1e0d470; the leash had hidden it from the check. Fixed by
  easing only while the toy waits; the check now counts the frame that ends sailing.
- **Found underneath:** the check's safe-frame assertion: since 1e0d470 the cygnet falls far behind in the last pool
  (s 73 against the toy's 101 at the outlet) and is out of frame about 12 s of 45 in landscape, about 19 s in portrait.
  **Jeremy's ruling (2026-09-29): the cygnet catches up.** When it has fallen well behind it swims faster until it is
  back near the child; the boats stay unleashed.

## 3. Home: a departing swan passes close to the cygnet

- **Observed:** `node tools/flock-flight-check.mjs` fails: "adult crossed through the cygnet", closest 1.735 m against
  1.8 m, in the first reunion case.
- **Known:** bisected to 1009b91 (the child's pigtails), which cannot touch the flock directly; most likely it moved
  where the cygnet starts (the child's pose or hands), and the V's spacing near the tail is only just above the
  limit. `tuning.swanDeparture.avoid*` is the avoidance.
- **To settle:** why the start moved, and whether the avoidance is robust or just lucky. Fix the avoidance so the
  closest pass has a real margin at every frame rate; do not lower the limit.

- **Traced (2026-09-29):** the V is not moved by the pigtails; they add 8 `Math.random` draws when the child is built,
  which reshuffles the check's seeded sequence. The real weakness: adults dodge the cygnet only by climbing, which is
  too slow while it too climbs into its tail place. In the check's simulation 10 of 240 reunions pass under 1.8 m.
- **But in the real game (browser, 9 seeds) the closest pass was 4.35 to 6.71 m**, never near 1.8 m. The near-miss is
  produced by the check's simulation and has not been seen in play.
- **Prepared, not merged (3bdade1 on `bug-sweep`):** adults also bank sideways away from the cygnet when a near-miss is
  predicted (`tuning.swanDeparture.companionAside: 10`); the check's closest becomes 2.72 m (240-case sweep: 2.60 m,
  none under 2.5 m); in the real game it moved the closest pass from 4.35 to 4.7 m. **For Jeremy:** (a) merge it as a
  guard (not a visible fix); or (b) leave the game as it is and make the check's simulation match what the game does.
- **Jeremy's ruling (2026-09-29): (b)**, "if the test drifted, then get the test to match the game again". 3bdade1 is
  reverted. **Done on `bug-sweep` (2454813):** the check skipped the three-second `answered` beat, in which the family
  wheels in to the gathering point before the cygnet fledges, so its V left from a half-formed wheel. It now runs that
  beat through the chapter, and reseeds after building the cast so the child's random draws cannot shift the flock.
  Over 240 reunions (40 seeds, 30/60/120 fps, arriving or not) the closest pass is 2.41 m (the old setup 1.87 m, with
  67 under 2.5 m against 6); `flock-flight-check` passes with its 1.8 m limit unchanged.

## 4. The season after the sleeping island should ease toward spring

- **Observed:** `season` is 1 on the sleeping island, then 0.92 (`toMirror`), 0.96 (mirror), 0.98 (`toHarbour`),
  0.92 (`toHome`) and 1 (home), set in `story/journey.ts` and the chapters (`sky-mirror.ts`, `home.ts`). The grass
  reads `uSeason` (`world/grass.ts`), so home's grass stays at its most aged and cold.
- **Jeremy's words:** "the curtain opening is the greening moment that moves the game from winter to spring"
  (2026-09-27); of home's grass, "it should still feel lush and green and beautiful" (2026-09-18).
- **Jeremy's ruling (2026-09-29): ease toward spring.** After the curtains open, the season eases back through the sea
  and the mirror so home's grass is green and lush.
- **To do:** propose the values (and whether the sleeping island's own morning should already move it), capture home,
  the mirror and the sea at the current and proposed values, and show Jeremy stills before merging. Visual work:
  allowed visual model only. Update `docs/journey.md` ("The year") and `docs/styles.md`.

- **Proposed, not merged (on `bug-sweep`):** the sleeping island's `season` becomes `1 - 0.4 * curtains` (1 before
  the curtains open, 0.6 once they have); `toMirror` 0.45, the mirror 0.3, `toHarbour` and `toHome` 0.18, home 0.04 (the
  first island is 0.08). Only the grass reads `uSeason`.
- **Stills (current left or top, proposed right or bottom):** `/tmp/updraft-bugsweep-season-sheet.png` (home, mirror,
  sea, leaving the sleeping island); `/tmp/updraft-bugsweep-season-home-crop.png` (home's grass close);
  `/tmp/updraft-bugsweep-season-island-pair.png` (the sleeping island's grass in the morning, from above the bed).
  The visible change is at home: a colder, darker green becomes a brighter, warmer one. The mirror and the sea show no
  grass, and the sleeping island's morning grass is already green (its frost and light carry it), so there the
  change barely shows.
- **Jeremy (2026-09-29): approved to merge** ("approved home grass, dark wood camera, and swan check to merge into
  main"). `docs/journey.md` "The year" and `docs/styles.md` "The turn of the year" updated.

## 5. The meadow swans may no longer be startled by the child

- **Observed:** in `story/meadow.ts` the family's take-off is `flock.lift(Math.PI, tuning.crest.leaves,
  tuning.crest.leaveClimb)` with no `startledBy`, so it starts from the far end of the raft by itself.
  `Flock.lift`'s startled path (nearest birds first, `tuning.crest.startlePaddle`) is unused.
- **Jeremy (2026-09-29):** "the last time i playtested this, the swans get startled correctly. this will need
  investigation to confirm if there was some kind of regression". His earlier note (2026-09-20): "the camera never
  properly shows the swans getting skittish and flying away".
- **Lead:** the `c.position` argument was dropped in 88a3a5f (2026-09-20 22:42), when the pond became a missed
  connection. Find out whether the sequence still reads as startled in play (the timing and the camera may carry
  it), capture it, and show Jeremy before changing it.

- **Found (2026-09-29): not a regression; a deliberate change that undid Jeremy's earlier ask.** Jeremy, 2026-09-19:
  "The swans get "scared" and fly away as the child approached, not after the child approaches and stops"; 2026-09-20
  06:17: "the camera never properly shows the swans getting skittish and flying away". At 07:01 the same day a Codex
  review proposed "Keep the swan family's behaviour emotionally legible" and Jeremy answered "i agree. could this be
  communicated better during that sequence?". Codex then made the migration begin "while the child is still standing
  back ... a missed connection rather than rejection" (88a3a5f, 2026-09-20 22:42): `goDown` lifts the raft from its
  far end as she starts down off the rise, with no `startledBy`, and `docs/chapters.md` records it ("starting from the
  far end of the raft rather than startled by her"). `Flock.lift`'s startled path is kept but unused.
- **For Jeremy to decide (no code changed):** (a) keep the missed connection as it plays now; (b) restore the startle,
  the nearest birds going first as she comes down toward them (`flock.lift(..., c.position)` at her approach);
  (c) both: already stirring to leave, her approach sets the nearest ones off. Stills of the sequence as it plays now,
  one a second from the crest, desktop and portrait: `/tmp/updraft-bugsweep-pond-sheet-1600x900.png` and
  `/tmp/updraft-bugsweep-pond-sheet-390x844.png`. What they show: the raft starts to lift about 6 s after the crest
  while she is still well up the slope; the birds are small in frame, and from about 10 s the veil thickens until the
  flock is lost in the haze by 13 to 14 s. So his 2026-09-20 note ("the camera never properly shows the swans getting
  skittish and flying away") still stands whichever take-off he chooses: the departure is hard to see.

- **Jeremy (2026-09-29), on the stills:** "I tthink the only concern i have with this whole sequence with the meadow
  swans is that the camera is really zoomed out and pans around and then in. it feels slightly unnatural".
- **Why it does that (`MeadowChapter.frame`, beats `crest` and `down`):** the departure shot frames the flock's
  bounding box (`departureFraming`, `departureCameraExtra` 80) from `departureCameraBack` 20 plus 0.35 of the distance
  to the flock and `departureCameraUp` 14 above her, so the further the V flies the wider the shot and the smaller she
  gets (a few pixels by 5 s). Then from `setsDown` (8.5 s) over `pondReturn` (3.5 s) the bearing swings from
  `REVEAL.swing` round to the pond view (`pondView` 2.15 rad off her line to the water), the distance falls to about
  10 and the height to 5.5: a wide orbit and dive in one move.
- **Jeremy's ruling (2026-09-29): "ok sounds good, please get an opus agent to build it"**, on this proposal: one
  committed shot from up behind her on the rise, her large in the foreground and the pond and swans below; as they
  lift, the camera turns up to follow them from where it stands and lets the V leave the frame rather than backing
  out to hold it; as she walks down, the camera follows from behind her to the water's edge instead of orbiting round
  the pond. The take-off is option (c): the family is already stirring to leave, and her approach sets the nearest
  birds off first (`Flock.lift`'s startled path). Stills before anything merges.

## 6. The stairs loop: the peep only

- **Observed:** in `story/stairs.ts`, the `puzzled` beat calls `cue('puzzled')` and `k.call(false)` together;
  `Cygnet.call(false)` cues `distress`. So each time round, the questioning peep plays with a distress call.
- **Jeremy's ruling (2026-09-29): peep only.** It is puzzled, not frightened. Remove the distress call there (keep the
  call marks if the peep should show them; check `fx/call-marks.ts`), and update `docs/stairs.md` (Principles) and
  `docs/cygnet.md` (voice list).

## 7. The dark wood: the child hides the ember at some stops

- **Jeremy (2026-09-29):** "in the dark forest, at some of the points where the child stops, the camera position is
  such taht the child is directly blocking the ember (the player can't see it)."
- **Known:** she stops `tuning.wood.waitShort` (7 m) short of an unlit coal (`story/wood.ts`, around line 366), which
  was meant to stop exactly this (8135c02). The camera is the walking shot (`docs/engine.md`, Cinematography).
- **Confirmed (2026-09-29).** Measured in the real renderer (each stop drawn four ways, with and without the child
  and cygnet and with and without the embers, to get how much of the waiting orb's light reaches the screen) and in
  Node with the real chapter, child and `CameraRig` (the orb's centre against her projected, posed mesh). Of the nine
  stops on the chain (the first coal, six on the path, the rescue hearth, the plane's light), three hide the ember:
  the second path stop (leg 1) loses about 40% of the orb after five seconds of waiting, and both leg-2 stops lose
  all of it for the whole wait, at 1600x900 and 390x844 alike. The other stops keep it fully in view.
- **Cause, traced:** not where she stops. The walking camera stands `cameraBack` (13) behind her along `aim`, and
  `aim` eases onto the direction from her to the waiting coal; she stops `waitShort` (7) short of it, facing it. So
  lens, child and coal end up in one line, and before the rescue only a fixed 1.1 m shoulder separated them (about
  1.7 degrees, less than her hood is wide). Where the path bends at leg 2 the aim is still turning when she stops,
  cancelling even that. After the rescue the shoulder was 2.8 and those stops kept the ember in view. A longer
  `waitShort` barely helps (the separation grows only slowly with distance) and moves her; a wider fixed shoulder
  does not fix leg 2 (4 m still hides it for the first seconds of the wait).
- **Fix:** the walking camera stands `tuning.wood.cameraSide` (2.8, the old after-rescue shoulder, now used
  throughout) off her shoulder on the side of the path the waiting coal lies, easing across at the aim's own rate
  when the next coal is laid on the other side. During the approach the bearing to the coal swings towards its own
  side, so the lens's lag now widens the gap instead of closing it. `wood-logic-check` asserts, at every stop at
  30/60/120 fps in both viewports, that the orb stays more than its heart (0.3 units) clear of her mesh from the
  moment she stops until it catches.
- **For Jeremy to judge:** the lens now moves from one shoulder to the other each time a coal catches (about 5.6 m
  sideways at 13 m, eased over several seconds and overlapping the turn towards the new coal, which partly cancels
  it). On the approach to the leg-2 corner the ember can still pass behind her for about a second while she walks
  (under two seconds per walk against about three before); every stop is clear.
- **Jeremy (2026-09-29):** "when the camera swings, it's not jerky is it? does the camera feel natural? this is my
  only concern before merging it". **Checked (Opus, 2026-09-29):** not jerky and it reads as natural. Each of the four
  crossings starts on the frame she sets off for the new coal, so it reads as following her; it builds and settles
  over about 5 to 6 s, 97% done before she stops. It runs against the aim's own turn, so the view turns 25 to 55% less
  than before (e.g. 16 against 35 degrees at the second crossing). No lens reversal; camera-intent-report 33 jerk
  flags against 34 before, at the same moments (her starts, stops and corners). Contact sheets (after over before):
  `/tmp/updraft-woodswing-sheet-e{0,1,2,6}-{desk,port}.png`.
- **Jeremy (2026-09-29): approved to merge.**

## 8. Two audio checks not yet looked into

- `audio-check` fails: "gustGain: player wind is 3 dB softer after departure". Decide whether the game or the check
  is out of date (`tuning.audio.playerWindEase` and the island departure).
- `birches-score-check` fails: "Cannot read properties of undefined (reading 'carried')": the fixture likely lacks a
  cygnet. Probably stale.

## 9. The browser group has not been run

`npm run check:browser` (8 checks, GPU, one at a time) was not run during the docs verification. Run it once the
branch in item 0 is in, and triage anything that fails the same way.

- **Run (2026-09-29, against `main` at d05f524):** 7 of 8 pass (`shader-browser`, `touch-viewport`,
  `chapter-view-browser`, `context-loss`, `progress`, `frame-time-browser`, `journey-view`). **`start-check` fails:
  "startup blocked the veil for 533 ms"** (limit `BOOT_MAX_MS` 500): the loading veil freezes for over half a second
  while the game boots. Real, not the harness: 533 and 550 ms on the dev server, 550 to 583 ms on a production build
  (`vite preview`), on a quiet machine.
- **Bisected on production builds:** 250 to 300 ms up to the child rebuild (fea312e, 2026-09-28 00:07); **517 to 533
  ms from the stairs merge (60767a5, 2026-09-28 02:58)**; 533 to 567 ms after. The stairs added a `CloudStairs` world
  built at startup and about 150 lines of cloud-deck GLSL in `atmosphere.ts`, which every shader includes, so either
  the boot build or the extra shader compile is the likely cost.
- **Moved to its own backlog item, `docs/backlog/boot-veil/`** (Jeremy, 2026-09-29: "create a separate backlog item
  for the veil issue"), with his constraint that setting up the stairs later must not freeze play instead.

## 10. Stale comments

`src/traveller/body.ts:47` ("coat to the knee ... wellingtons") and `src/traveller/child/garments.ts:345`
("wellington"): the coat is short and the boots are matte brown leather (Jeremy, 2026-09-27: "the brown leather in
the concept art").

## Out of scope

The other known issues in `docs/roadmap.md` (the sky mirror's speckled patch, the boarding hop, the bag flap on a
resumed save) stay there unless Jeremy adds them.
