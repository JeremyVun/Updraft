# Build plan: path puzzles

Each room's puzzle gets its own section. The design, Jeremy's words and every ruling are in [design.md](design.md);
this file only orders the work.

## The drowned village: the cat and the roofs (prototype)

Design: the sections of design.md from "The whole room, from the beginning" on. Concept frames: `comps/drowned/` (a
guide; they still show the drained village, which is cut). The cat: `comps/cat/`. Branch `proto-drowned-roofs`, worktree
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

Distances (main): see design.md. The air dies and the boat comes to rest where main's air dies, about (−9, −1398); the church
`SPIRE` is (14, −1436); the storm's trigger moves from `tuning.storm.startsFromShore` (210 m from `WOOD_LANDING`) to
her being back aboard at the nave, about 260 m from the beach, so main's storm timeline (light out at 23 s, about
130 m on, beside the lighthouse) still lands beside the lighthouse at `passageSpeed`.

### Phase 1: the village round the church, the boat at rest, and the dark
Owns: `src/world/drowned-way.ts` (the hand-laid route and `WAY` decks), `src/world/drowned.ts`, `src/world/drowned-dark.ts`,
`src/story/drowned.ts` (beats `still`, `becalmed`), `Boat.coastTo`, `tuning.drowned`.
Done: [x] (code `abd2608`..`2d72bd3`; look pass `2fbdd82`..`8741578`: the drain removed, the boat resting its stem on a
small cottage's slates, the dark rebuilt in layers with the water darkening under it). Left for a later look pass: the
dark still reads as dark boulders in stills rather than smoke; the light should deepen as it comes.

### The cat creature (parallel)
Owns: `src/creatures/cat.ts`, `src/creatures/cat/`, `src/story/cat-yard.ts`, `tools/cat-check.mjs` on branch
`proto-drowned-cat` (worktree `/private/tmp/updraft-drowned-cat`). First build merged into `proto-drowned-roofs`
(`faf9574`); its API is stable. Being rebuilt to the model sheet (Jeremy found the first face bug-eyed and the sit
swan-necked); the rebuild changes only its own files and is merged again when it lands.
Done: [ ]

### Phase 2: the stranded cat, and she goes after it
Owns: the wash-tub (floats, pushed by the wind field), the cat's beats in `src/story/drowned.ts` from the chimney to
the bow, the drift with the cat aboard (lens round to the side), the cat bolting onto the cottage roof as the dark
rises, and the child climbing out after it (`alight` onto the cottage's slates).
Seam: the cat API (`place`, `strand`, `hop`, `leap`, `run`, `rest`, `look`, `afraid`, `unease`, `mewing`, `curious`);
the dark's `rise` and `reach`; `WAY` decks.
Gate: a real-gesture check (`tools/drowned-roofs-check.mjs`, started here) carries the tub to the cat and back; idle
proves the breeze alone does nothing; stills.
Done: [x] (`44f5777`..`81aa993`). The cat's roof moved earlier along the drift (`CAT_HOUSE`, `CAT_HOLD`), so the cat
aboard gets its own drift of about 15 s before the air dies; its old roof stays as a plain neighbour
(`EAST_OF_STRAND`), and the generated village is laid out exactly as before, only left unbuilt on the cat's ground
(`onCatGround`). Phase 2b: the cat's cottage is sunk to its ridge with a gable-end chimney 9 m across from the hold, so
the cat on its pot sits low; the lens watches the tub from a fixed point off that gable end (`CAT_LENS`), where she
and the cat face each other across the frame (upright: behind her, on the side away from the slack sail); the cat sits
rather than crouches on its pot, pleads at a kitten's length every few seconds, chirrups landing aboard and yowls
once as it bolts; the boat's drift away up the open water once she is on the ridge is `BOAT_ADRIFT` (its last point a
placeholder for where it fetches up by the church). The tub (`src/world/wash-tub.ts`) is pushed by strokes across it on screen, not by the field (under the
low lens a stroke's own wind lands far beyond it; see `contracts/wind.md`). The beat lives in
`src/story/drowned-cat.ts` (`StrandedCat`), driven by the chapter. The strand's landing is a level line of slates
(`WAY.strandLanding`) and `WAY.strandSlope` is now the whole slope above it, because `alight` sets her down at a deck's
own height. Left for later: the cat still reads small on its pot (about 40 px at 1600 × 900) and at the gap, and upright
the cat at the bow is hidden behind her; the climb's lens looks on to the church with the dark behind it.

### Phase 3: over the roofs
Owns: the child's walk over `WAY` following the cat, stopping at each gap; the tree crossing (rocks to the wind, a
push topples it into a bridge); the swing crossing (the birches' `Swing`, pumped, she lets go onto the nave); the
cat's own way over each gap; the dark's creep and hold; the side-on lens for the run.
Seam: each crossing reports done; the dark reads the child's progress.
Gate: the check plays both crossings with real gestures; stills of each.
Done: [ ]

### Phase 4: the dark arrives, the boat, the storm
Owns: the cat up the tower to the belfry; the dark rolling over into main's storm sky (the dark handed over to the
storm or zeroed, since nothing resets it today); `boat.coastTo` cleared; `Boat.brushSail` bringing the boat from the
cottage to the nave; her stepping down (`board`) and her one look back at the cat; the storm's trigger (aboard, not
`startsFromShore`) with the weather mostly gathered at the start.
Seam: from aboard, main's storm beats run in order.
Gate: the check plays through to the forest beach; `tools/storm-check.mjs` (note: it already fails on main at the
lighthouse crown and the plane), `boat-check.mjs` and `drowned-camera-check.mjs` fixtures updated to play the new
sequence.
Done: [ ]

### Phase 5: saves, docs and the look
Owns: checkpoints (a save during the run resumes with the boat at rest, the cat aboard and the dark risen; a save
after she is aboard resumes aboard with the storm to come), `docs/chapters.md` drowned section on the branch, the
dark's look pass, a final set of stills (landscape and portrait).
Gate: typecheck, build, the check from start to the beach; stills opened for review.
Done: [ ]

## The crossing: the whale asleep

Design: design.md, "The crossings" through the end. Concept frames: `comps/crossings/whale/`. Its own branch, judged
by Jeremy on its own and never merged without his approval. Commit after every step.

Standing constraints for every phase:
- Cursor movement is the only verb; nothing timed, nothing failed.
- Every response is caused by the player's own wind and visibly answers it; the ambient breeze never wakes the whale.
- Camera never jerks; no fourth wall.
- Player-feel numbers in `src/tuning.ts` (`tuning.sleepingWhale`).
- Crossing lengths stay as in `docs/contracts/world.md` apart from the whale's stop.
- The first crossing (`toLines`) is not touched: its whale is the set-up for the sleeping one.
- Visual judging (stills against the concept frames) is done by Opus or Astra only.

### Phase C0: direct crossing starts
Owns: `src/story/journey.ts` (a `?chapter=` value naming any `to*` route starts it at its first waypoint, heading
for the second, cygnet in the satchel), the query-param list in `CLAUDE.md`.
Done: [x] branch `crossings-start` (9dd4ebe), the base of `crossing-whale`.

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
stills beside `k1`–`k4` in landscape and portrait, opened for Jeremy. Built in two waves: code, the
check and one smoke still set (C2a), then the look and the gates (C2b).
Done: [ ]

### Phase C3: docs on approval
Once Jeremy approves the whale: its section in `docs/chapters.md`, the crossing table in `docs/contracts/world.md`
if the length changed, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
