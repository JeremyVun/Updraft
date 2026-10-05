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
Done: [ ]

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
