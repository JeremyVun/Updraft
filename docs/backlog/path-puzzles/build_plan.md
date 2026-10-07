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

## The open sea: the whale in the net

Design: design.md, "The crossings" through the end; the spec is "As decided: the whale in the net". Concept frames:
`comps/crossings/whale-net/` (`k1`–`k5`, `k2-portrait`, `notes.md`). Its own branch, judged by Jeremy on its own and
never merged without his approval. At most two build agents at once (peers share the session limit); commit after
every step. Worktrees under `/private/tmp` are wiped by a restart: the branch is the record.

Standing constraints for every phase:
- Cursor movement is the only verb; nothing timed, nothing failed; the ambient breeze does nothing to the net.
- Every response starts at the wind's target and visibly answers it; the boat is at rest, so nothing reads as the boat
  speeding up.
- Camera never jerks; no fourth wall (the child never looks to the camera or player).
- Player-feel numbers in `src/tuning.ts` (`tuning.netWhale`, replacing `tuning.sleepingWhale`).
- The meadow crossing (`toMeadow`) is as on main. The first crossing (`toLines`) changes only its whale (N1).
- Visual judging (stills against the concept frames) is done by Opus or Astra only. Code waves end with one smoke
  still set; the look loop is its own wave.

### Phase C0: direct crossing starts
Done: [x] branch `crossings-start` (9dd4ebe): `?chapter=<route>` starts any crossing at its first waypoint.

### Phase N1: the whale moves to the open sea (branch `sea-whale`)
Base: main, with `crossing-whale` (to 1900b58c) merged in, then the `toMeadow` hook removed. `crossing-whale` holds:
`src/fx/sealife/sleeper.ts` (`SleepingWhale`, phases asleep/waking/leaving/gone, breathing, shiver, slap, eye, spout
jet, roll and fluke wave), `perched-gull.ts` (to be removed), `whale.ts` (`WhaleRig` base), `src/story/sleeping-whale.ts`
(`WhaleAcross`: the speed-limit hold and release, on-screen gust detection, `updraftTarget`, coax, camera hold, child
and cygnet), whale shader uniforms (`uScale`, `uShiver`, `uSlap`, `uEye`), `spray.ts` `jet()`, `swell.ts` `uSurge`,
`tools/sleeping-whale-check.mjs`, and the pacing tool's real `SeaLife`. Its last report's knobs, traps and rejected
approaches are in the commit messages; read `git log -p crossings-start..crossing-whale`.
Owns: `src/story/journey.ts` (`toMirror`: the route lengthened, `whaleAt` cut, the encounter option), `src/story/crossing.ts`
(the pod's nudge becomes the lead; the pod's farewell waits for the whale), the encounter module, `sleeper.ts` (about
110 m, the resting pose of `notes.md` scaled up, the eye larger than the boat), the camera hold, `src/story/checkpoint-data.ts`,
`src/tuning.ts`, `tools/journey-pacing-check.mjs`, `tools/sea-check.mjs`, `tools/sea-logic-check.mjs`.
Also: the first crossing's whale (`src/fx/sealife/whale.ts`, `toLines`) becomes the same animal at the same size and
look, unnetted and far off, its timing and distance as on main, with the pale pattern under its flukes it shares with
the sleeper; `CROSSING=toLines node tools/journey-pacing-check.mjs` unchanged.
Seam: the encounter exposes its step (`approach`, `breath`, `line`, `flipper`, `free`, `gone`) for the net (N2) to
drive and read; the pod's lead and farewell read it; for this phase a stand-in (circles over the blowhole wake it, as
on `crossing-whale`) lets the sequence play end to end.
Gate: typecheck; build; a still of the first crossing's whale diving, far off; `?chapter=sea` plays the pod, the swim, the lead, the stop, the stand-in wake, the release and
the arrival at the mirror with the mirror hidden until the whale has gone; the sea checks and `CROSSING=toMirror node
tools/journey-pacing-check.mjs` updated and passing; one smoke still set at `k1` and `k5`.
Done: [ ]

### Phase N2: the net and the three steps
Owns: the net (`src/fx/sealife/net.ts`: sparse deforming mesh, instanced corks, boundary ropes, the lifted patch, the
peel, the flipper loop, the empty net drifting off), the three steps and their invitations and dolphin valves in the
encounter module, the child's catch and haul and the cygnet's swim to the flipper and back (`src/companion/` or the
cygnet's states as fits), sounds in `src/audio/foley.ts`, `tools/net-whale-check.mjs` (replacing
`sleeping-whale-check.mjs`).
Seam: each step's progress is caused only by its own gesture at its own target; steps go in order; a valve's dolphin
does the same physical act the player would have caused.
Gate: typecheck; build; the check with real gestures: each step done by its gesture; the ambient breeze and idle never
progress a step before its valve; each valve finishes its step by its dolphin; sweeps on the whale elsewhere only
tickle; saves at each checkpoint resume correctly; each negative proven to bite by breaking its guard once. One smoke
still set at `k2`–`k4`.
Done: [ ]

### Phase N3: the look
Owns: the look of the whale, the net, the light on them, the camera hold and portrait framing, the child's and the
cygnet's poses, against `k1`–`k5` and `k2-portrait` side by side every iteration.
Gate: typecheck; build; the N2 check still passing; final stills (landscape 1600×900 and portrait about 430×932) at
each keyframe beside the concept, opened for Jeremy.
Done: [ ]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's section in `docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
