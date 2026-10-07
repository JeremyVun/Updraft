# Build plan: path puzzles

Each room's puzzle gets its own section. The design, Jeremy's words and every ruling are in [design.md](design.md);
this file only orders the work.

## The drowned village: the cat and the roofs (prototype)

Design: the sections of design.md from "The whole room, from the beginning" on. Concept frames: `comps/drowned/` (a
guide; they still show the drained village, which is cut). The cat: `comps/cat/`; the fog `comps/fog/`; the run
`comps/run/`; the windmill `comps/mill/`; the village's look `comps/village/`. Branch `proto-drowned-roofs`, worktree
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
Done: [x] (rebuilt, polished and its analysed voice merged).

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

### The pieces already built (parallel branches)
- **The tree and the swing** (`proto-drowned-crossings`, `src/world/crossings/`, QA `?chapter=stage&gap=tree|swing|run`):
  polished and merged into this branch (`715b48a`). Placement: `TreeCrossing({root, rest, over, height}, {wait, stepOff,
  onward}, cast)`, root about 2.4 m behind the wall, its foot about 0.15 m under water, the tree about 10 m tall, the
  waterline at its foot kept in view (a slightly raised lens); `SwingCrossing({pivot, toward, rope}, {board, landing,
  onward}, cast)`, beside the cottage's gable end so the back-swing passes the house end, the old tree off the
  cottage's corner behind the back-swing and never between the lens and her, the landing's slope deck in
  `child.decks`. Copy the yard's `TREE_SOUNDS`/`SWING_SOUNDS` onto `onEvent`. Saves treat the tree as standing.
  Jeremy has not yet judged the new foley by ear.
- **The windmill** (`proto-drowned-mill`, worktree `/private/tmp/updraft-drowned-mill`): the piece on the QA stage
  (`?chapter=stage&gap=mill`, `src/story/mill-yard.ts`, `tools/mill-check.mjs`, `tuning.crossings.mill`), her walk onto
  the sail and the ride first. Done: [ ]
- **The sea fog, pass 2** (`proto-drowned-fog`, worktree `/private/tmp/updraft-drowned-fog`): the billowed near face,
  the gold crest, no hard edge at the far stage, the bank well away at first, the light draining over the whole
  approach; every other room pixel-identical. Done: [ ]

### Phase 3a: the village re-laid
Owns: `src/world/drowned-way.ts`, the layout parts of `src/world/drowned.ts` (`layout`, `PLACED`, `CLEARINGS`, the
church), `tools/drowned-roofs-check.mjs` (extended to walk the way).
- The church (spire, nave, tower, vane, belfry, ivy) moves about 120 m on to stand near the lighthouse, about
  (10, −1560) per `comps/run/route-plan.png`; its old site becomes ordinary roofs. `SPIRE`'s users (camera aims, the
  heron and vane answers, the storm) follow it.
- The village takes the shape in `comps/village/` (lanes, rows and clusters, a green, outlying farms, water between
  them; denser off the way and toward the horizon on every side, the near water open). The generated village's
  random draws stay stable: build and throw away, never reorder the draws in `PLACED`/`CLEARINGS`.
- Her way, about 165 m from the strand to the nave, laid as `WAY` decks per `route-plan.png` (north up): the climb
  out at the cottage, the tree's lane and walled garden, her own way (ridges, wall copings, a lean-to, small hops), the
  windmill's site (a roof edge level with a sail, the mill, the high roof beyond), her own way again, the green with
  the swing at the garden cottage's gable end, the nave. Only hand-placed roofs, walls and copings where the way needs
  them; never a corridor or a single line of houses.
- The dead tree the boat fetches up against near the church; `BOAT_ADRIFT` ends there. `DARK_WAY` runs along the
  new way.
- The pieces placed as stand-ins at their sites (the tree and swing through their real classes; the mill as a block
  until 3b lands).
Gate: a QA walk of the decks end to end with no gap she cannot make; a high plan still for the orchestrator only
(never a player view) and eye-level stills compared with `comps/run/` and `comps/village/`; typecheck.
Done: [x] (`db4e299`). Her way is about 190 m of `WAY` decks (the drawn plan's gold line measures about the same),
walked deck to deck by `tools/drowned-way-check.mjs`; hops and the three pieces are `WAY_GAPS`, the pieces' places
`TREE_SITE`, `MILL_SITE` (heights in `MILL`, a stand-in mill until the windmill lands) and `SWING_SITE`, the cat's
own way over each gap `CAT_WAY`. The village's real `ToppleTree` and `RopeSwing` stand idle at their sites and the
crossings take them over when given them. The boat cannot cross her way, so it drifts west of it, round behind the
church to its dead tree (`BOAT_TREE`) east of the tower; at today's 0.3 m/s that drift takes minutes, so 3c sets its
pace. The generated village keeps its draws (`DRAWN_ROUND`) and leaves open water round her way, the boat's water,
the mill, the green and the churchyard (`inClearing`). Left: the walls round the way read as walls rather than
plots; the strand's slope lifts her onto its ridge 0.4 m early (Phase 2's, left as tuned); the becalmed lens's turn
to the church (`strandChurch`) and the climb lens still aim where the church stood; `drowned-camera-check.mjs` fails
on its cast lacking the cat, as it did before this phase.

### Phase 3b: the village's look
Owns: the house and prop pieces (a new module beside `drowned.ts`, its showroom on the QA stage) and their use in
`drowned.ts`'s builders. Builds the house types and props chosen in `comps/village/house-kit.png` and `notes.md` in
the game's simple faceted style, the far village toward the horizon, and the small things of village life above the
water, on the layout 3a lays. Fixed cost: one merged mesh as today, no new draw calls per house.
Gate: stills of the arrival, the cat's roof, the run's views and the far horizon beside `comps/village/`; the run's
views of the church and lighthouse never crowded; typecheck.
Done: [ ]

### Phase 3c: the run
Owns: the child's walk over `WAY` following the cat from the strand to the nave, stopping at each piece; the cat's own
way over each gap (a railing top, a wall coping, a leap she could never make), always a roof ahead; the three pieces
wired in place (tree, mill, swing) with their invitations, safety valves and sounds; the fog's creep and hold behind
her (the story resets `close` to 0 when the run starts and drives `reach` along `DARK_WAY`, waiting a little behind
her at each piece and taking the place she left as she crosses); the run's camera (low and beside her, the fog on one
side of the frame and the church on the other, easing between pieces and never cutting; the climb-out lens turned so
the fog is in frame).
Seam: each piece reports done; the fog reads her progress; the boat's drift runs on its own clock to its dead tree.
Gate: the check plays from the air dying to the nave with real gestures; stills at each piece and between them,
landscape and upright; the run's time measured against the pacing (about 2 minutes).
Done: [ ]

### Phase 4: the dark arrives, the boat, the storm
Owns: the cat up the tower's ivy to the belfry; the fog's `close` into the storm's night (the story's `dusk` and the
fog's drain from one progression, not stacked); `boat.coastTo` cleared before `brushSail`; the player filling the sail
to bring the boat from its dead tree to the nave; her stepping down (`board`) and her one look back at the cat; at
most a mew from the belfry; the storm's trigger moved to her being aboard at the nave, with the weather mostly gathered
at the start and main's beats re-timed for about 140 m to the beach (the lighthouse passed and going out soon after
she boards, the plane taken, rain, the landing).
Gate: the check plays through to the forest beach; `tools/storm-check.mjs`, `boat-check.mjs` and
`drowned-camera-check.mjs` fixtures updated to the new sequence.
Done: [ ]

### Phase 5: saves, docs and the look
Owns: checkpoints (a save during the run resumes with the boat at rest against the cottage, the cat aboard and the
fog risen; a save after she is aboard resumes aboard with the storm to come), `docs/chapters.md` drowned section,
`docs/contracts/world.md` where the village's pieces belong, a final set of stills (landscape and upright), a full play
from the stairs to the forest beach.
Gate: typecheck, build, the check from start to the beach; stills opened for review.
Done: [ ]

### Later
The cat in the lit window of the cottage with the red door at the very end (design.md "The cat comes home"); a small
cat-face pass (eyes slightly big and low close up, muzzle cream not white, profile ears small, mew mouth small).

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
Sequenced (Claude's call, 2026-10-07): N2 starts on N1's branch once N1 lands, because the net drapes over the
re-posed 110 m head and peers are already running build agents. Branch `sea-whale`, worktree
`/private/tmp/updraft-sea-whale` (`crossing-whale` merged in at `a15e1241`).
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
cygnet's states as fits), sounds in `src/audio/foley.ts` (the whale's voice among them), `tools/net-whale-check.mjs` (replacing
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
Once Jeremy approves: the open sea's chapter-select still regenerated with the whale; the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
