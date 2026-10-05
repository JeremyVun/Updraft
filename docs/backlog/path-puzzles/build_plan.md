# Build plan: path puzzles

Each room's puzzle gets its own section. The design, Jeremy's words and every ruling are in [design.md](design.md);
this file only orders the work.

## The drowned village: the sea draws back (prototype)

Design: the sections of design.md from "The whole room, from the beginning" on, with the stranded cat and the nave
ridge refinement. Concept frames: `comps/drowned/` (the look of `comps/roofs/` second pass is the village to aim for;
the raft and the lighthouse stop in `comps/roofs/` are superseded). Branch `proto-drowned-roofs`, worktree
`/private/tmp/updraft-drowned-roofs`, based on main. Judged by Jeremy on its own; never merged without his approval.

Standing constraints for every phase:
- Cursor movement is the only verb: gusts push what is under the cursor, circles raise an updraft. No press-and-hold,
  no timing to hit, no fast reactions. Nothing fails; the dark creeps up while she waits and stops a little behind her.
- Every step is caused by the player's own act and visibly answers it. Nothing looks interactive that is not.
- Each puzzle step has the usual drawn invitation after idle seconds (`contracts/wind.md`) and its own safety valve
  (about 90 s with no progress), so nobody is stranded.
- The camera stays low near the water and never surveys from above; never jerks; no fourth wall (the child never looks
  to the camera for help). Upright phone compositions stack the way up the frame.
- Player-feel numbers go in `src/tuning.ts` (`tuning.drowned...`), not inline.
- Main's storm, lighthouse, plane snatch and landing are not changed beyond the trigger.
- Useful parts on other branches: `proto-drowned-smoke` (`src/world/drowned-smoke.ts`: `Billows`, `StormBank`; the
  gust front on the water `Water.gustFront`), the birches' `Swing` (`src/world/birches.ts`), `Boat.brushSail`, the
  little boats' bath rocking as the way to show which way something can tip.

Distances (main): see design.md. The sea draws back where the air dies on main, about (−9, −1398); the church
`SPIRE` is (14, −1436); the storm's trigger moves from `tuning.storm.startsFromShore` (210 m from `WOOD_LANDING`) to
her being back aboard at the nave, about 260 m from the beach, so main's storm timeline (light out at 23 s, about
130 m on, beside the lighthouse) still lands beside the lighthouse at `passageSpeed`.

### Phase 1: the village round the church, and the sea drawing back
Owns: `src/world/drowned.ts` (hand-placed houses, walls, trees and the green along the route near the church, among
the generated ones; the village's rise and fall with a wet band on its walls), `src/story/drowned.ts` (the new beats
up to the stranding), the dark bank behind (`src/world/drowned-dark.ts`, ported from the smoke branch), `src/tuning.ts`.
Seam: the village exposes its current rise (metres) and the walkable surfaces of the route (ridges, wall tops) as
data the child's walk reads; the boat strands on a named ridge.
Gate: `npm run typecheck`; stills of the drift, the drawing back and the stranded boat from the game camera, landscape
and portrait, compared with `comps/drowned/`.
Done: [ ]

### Phase 2: the stranded cat
Owns: `src/creatures/cat.ts` (+ `src/creatures/cat/` if needed: model, poses, gait in the game's soft look), the
wash-tub (floats, pushed by the wind field like the leaves on the water), the cat's beats in `src/story/drowned.ts`,
its sounds in `src/audio/foley.ts`.
Seam: the cat boards the boat and rides it; the cygnet tucks into the satchel while it is aboard.
Gate: a real-gesture check (`tools/drowned-roofs-check.mjs`, started here) carries the tub to the cat and back;
idle proves the breeze alone does nothing; stills.
Done: [ ]

### Phase 3: over the roofs
Owns: the child's walk over the route (following the cat, stopping at each gap), the tree crossing (rocks to the
wind, a push topples it into a bridge), the swing crossing (pumped, she lets go onto the nave), the dark's creep and
hold, the side-on camera for the run.
Seam: each crossing reports done; the dark reads the child's progress.
Gate: the check plays both crossings with real gestures; stills of each.
Done: [ ]

### Phase 4: the water comes back, and the boat
Owns: the village sinking back past its old level over the nave roof, the smoke rolling over into main's storm
weather, the boat floated off its ridge and carried in, `Boat.brushSail` bringing it alongside the nave, her stepping
down, the cat left in the belfry, the storm's trigger.
Seam: from aboard, main's storm beats run unchanged.
Gate: the check plays through to the forest beach; `tools/storm-check.mjs` (note: it already fails on main at the
lighthouse crown and the plane), `boat-check.mjs` and `drowned-camera-check.mjs` fixtures updated to play the new
sequence.
Done: [ ]

### Phase 5: saves, docs and the look
Owns: checkpoints (a save past the run resumes aboard with the storm to come; a save mid-run resumes at the stranding),
`docs/chapters.md` drowned section on the branch, a final set of stills (landscape and portrait) for Jeremy beside
`comps/drowned/`.
Gate: typecheck, build, the check from start to the beach; stills opened for review.
Done: [ ]

## The crossings: the meadow on the sea and the whale asleep

Design: design.md, "The crossings" through "As decided: the crossings". Concept frames: `comps/crossings/meadow/`
and `comps/crossings/whale/`. Each encounter is its own branch off main, judged by Jeremy on its own and never merged
without his approval. The meadow and the whale are built at the same time (Jeremy, 2026-10-05: "can we not do the whale (C2) at the same
time?"), one agent per branch, never more than two at once (peers share the session limit); commit after every step.

Standing constraints for every phase:
- Cursor movement is the only verb; nothing timed, nothing failed; the boat never waits for the meadow.
- Every response is caused by the player's own wind and visibly answers it; the ambient breeze opens no flower and
  never wakes the whale.
- Camera never jerks; scenery gets at most a low-weight glance; no fourth wall.
- Player-feel numbers in `src/tuning.ts` (`tuning.seaMeadow`, `tuning.sleepingWhale`).
- Crossing lengths stay as in `docs/contracts/world.md` apart from the whale's stop: `CROSSING=toHarbour node
  tools/journey-pacing-check.mjs` passes unchanged.
- The first crossing (`toLines`) is not touched: its whale is the set-up for the sleeping one.
- Visual judging (stills against the concept frames) is done by Opus or Astra only.

### Phase C0: direct crossing starts
Owns: `src/story/journey.ts` (a `?chapter=` value naming any `to*` route starts it at its first waypoint, heading
for the second, cygnet in the satchel; prototyped on branch `crossings-study`), the query-param list in `CLAUDE.md`.
Gate: `npm run typecheck`; `?chapter=toHarbour` and `?chapter=toMeadow` captures show the boat under way.
Done: [x] branch `crossings-start` (9dd4ebe), the base for both encounter branches; merges with whichever is approved
first.

### Phase C1: the meadow on the sea (branch `crossing-meadow`)
Start from the spike (branch `spike-sea-meadow`, commits 3fdefa4 and 43c9c94) and replace its shortcuts as listed in
design.md. The spike placed it on the first crossing; it now lies on the last, sky mirror to home (`toHarbour`).
Owns: `src/world/sea-meadow.ts`, `src/world/grass.ts` (sea mask in the blade table, the flag, per-blade swell, the
direct-blades shader), `src/world/life.ts` (`.g` flower channel inside the patch), the grass-lean writer for the hull,
`src/main.ts` wiring, `src/story/crossing.ts` (a `seaMeadow` option; the child's reach and the cygnet's look while in
it), `src/story/journey.ts` (the `toHarbour` option), `src/tuning.ts`.
Seam: the lean texture gains a second writer (the hull) alongside wind splats; the flower channel rises only from the
player's gusts and updrafts inside the mask, never spreads or falls; the mask is live only on `toHarbour`.
Order: measure first (where the route leaves the mirror's flat, when home's hillside starts to clear from its haze,
at the ordinary breeze and at the 10 units/s ceiling; which room partition the patch falls in), place the patch, then
build. Built in two waves: code and the check tool with one smoke still (C1a), then the look and the gates (C1b).
Gate: typecheck; build; a real-gesture check (`tools/sea-meadow-check.mjs`) that sweeps across the patch and finds
flowers there, and idles through it and finds none; the pacing check; `__stats.blades` with the meadow in frame no
higher than the first crossing draws at its start (about 40k); stills (landscape and portrait) from the crossing camera beside `k1`–`k3`,
opened for Jeremy.
Done: [x] built on `crossing-meadow` (C1a to c9418780, C1b to 7b24b73e); awaiting Jeremy's judgement.

### Phase C2: the whale asleep across the way (branch `crossing-whale`)
Owns: the sleeping whale (rest pose, breathing, shiver along a stroke, flipper slap, eye, the roll and fluke wave, in
`src/fx/sealife/` beside `whale.ts`, sharing its anatomy and shader), the gull, `src/story/crossing.ts` (a
`sleepingWhale` option: the stop, `updraftTarget`, `coax`, the brush response, the safety valve, the camera hold,
the child's lean and wave, the cygnet's duck and peek, the checkpoint flag), `src/story/journey.ts` (`toMeadow`),
`src/audio/foley.ts` (breath, slap, gull), `src/tuning.ts`.
Seam: the crossing holds the boat with `Boat.speedLimit` eased to zero and releases it the same way; the whale reports
`awake` once the breath is drawn; nothing else in the crossing changes.
Gate: typecheck; build; a real-gesture check (`tools/sleeping-whale-check.mjs`): sweeps alone never wake it, circles
over the blowhole do, idle wakes it only by the gull after the valve, a save before and after resumes correctly;
stills beside `k1`–`k4` in landscape and portrait, opened for Jeremy. Built in two waves like the meadow: code, the
check and one smoke still set (C2a), then the look and the gates (C2b).
Done: [ ]

### Phase C3: docs on approval
Once Jeremy approves an encounter: its section in `docs/chapters.md`, the crossing table in `docs/contracts/world.md`
if a length changed, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
