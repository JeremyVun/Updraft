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
Sequenced (Claude's call, 2026-10-07): N2 starts on N1's branch once N1 lands, because the net drapes over the
re-posed 110 m head and peers are already running build agents. Branch `sea-whale`, worktree
`/private/tmp/updraft-sea-whale` (`crossing-whale` merged in at `a15e1241`).
Seam: the encounter exposes its step (`approach`, `breath`, `line`, `flipper`, `free`, `gone`) for the net (N2) to
drive and read; the pod's lead and farewell read it; for this phase a stand-in (circles over the blowhole wake it, as
on `crossing-whale`) lets the sequence play end to end.
Gate: typecheck; build; a still of the first crossing's whale diving, far off; `?chapter=sea` plays the pod, the swim, the lead, the stop, the stand-in wake, the release and
the arrival at the mirror with the mirror hidden until the whale has gone; the sea checks and `CROSSING=toMirror node
tools/journey-pacing-check.mjs` updated and passing; one smoke still set at `k1` and `k5`.
Done: [x] `b84a8448..3aaeed46`. `src/story/net-whale.ts` (`NetWhale`: `step`, `stepTime`, `goTo`, the stand-in
`breathe()` handing on to `AFTER_BREATH`), `src/story/sighting.ts` (the far sighting, kept out of `crossing.ts` because
the pacing and camera tools stub the sea life), `SleepingWhale` exposes `blowhole`, `eye`, `jaw`, `finRoot`, `finTip`,
`back`, `flukes`, `surfaceAt(x, z, out)`, `onExhale`, `stir`, `liftFlipper()`, `tickle()`, `look(at)`, `drawBreath()`,
`free()`. Saves `whale-rest` (held until the whale has gone) and `whale-gone`; QA `?chapter=whale`. The mirror and the
first crossing's whale as recorded in design.md (Pacing; The same whale on the first crossing). Left for the look:
the whale reads as a dark flat wall backlit at the hold, with no head or jaw shape; the eye reads human, its crease a
smile with lashes; on its back the near flipper stands like a plank; the far flukes look like a flat cut-out; the pod
is mostly out of `k5`. The N1 agent ran past the context ceiling (765k), so N2 is split.

### Phase N3a: the whale's own look (parallel with N2a)
Owns: `src/fx/sealife/whale.ts`, `whaleShader.ts`, `anatomy.ts`, the shape, pose and eye of `sleeper.ts` (not its
API), the hold's framing numbers in `tuning.netWhale`. Branch `sea-look` from `sea-whale`.
Seam: `surfaceAt` and the world anchors keep their names and stay true to the rendered skin; the net (N2a) drapes by
them, so a re-shaped head moves the net with it.
Gate: typecheck; build; `tools/sea-logic-check.mjs` passing; stills at `k1`, `k2`, `k5` and the first crossing's dive,
landscape and portrait, beside the concept.
Done: [x] `591cfc4a..57df85a5` on `sea-look` (with `sea-net` merged; `sea-whale` fast-forwarded to it). The skin lit
by a cool sky fill and a warm sea bounce, the sun only on the top and a narrow gold rim (`tuning.whaleLook`); the eye
a tired amber almond under a heavy lid, gloss from the sky, never emissive; a wedge snout, a raised crown with two
slits, a pale lower jaw under a mouth line (`aRig.w` is the ring height); flippers and flukes with thickness and no
backlit glow, the flippers folding back on the roll. The hold 22 m behind, 11.5 m up. Still tool:
`tools/whale-look-stills.mjs`. Left for the look: it reads smooth and toy-like (a grey blimp at `k5`), the jaw a
straight pale stripe; the net is faint at the hold (true-width strands); portrait holds need bringing in by about
0.58 and the landscape look point raised for the sky (both in `net-whale.ts` `frame()`); far off the pale jaw gives
it away too soon; the pod mostly out of `k5`. `sea-logic-check`'s featured-leap assertion fails at one seed in about
fifty on every branch since N1 (seed-sensitive, attribution open).

### Phase N2a: the net and the breath
Owns: the net (`src/fx/sealife/net.ts`: sparse deforming mesh draped by `surfaceAt`, instanced corks, boundary ropes,
the lifted patch, the peel, the flipper loop and its slide, the empty net drifting off, each driven by its own 0..1 and
scrubbable on `?chapter=whale`), step 1 in `net-whale.ts` (the breath replacing the stand-in, its invitation, the
dolphin valve lifting the mesh with its nose, the eye opening on her), the whale's voice and the net's and breath's
sounds in `src/audio/foley.ts`, `tools/net-whale-check.mjs` for step 1, the save after it. Branch `sea-net` from
`sea-whale`.
Seam for N2b: the net's API (the peel and loop drivers, the leader's near cork as a pushable float with its position,
the loop's free end for the bill) and `AFTER_BREATH = 'line'` with `line` and `flipper` left as pass-through stubs.
Gate: typecheck; build; the check with real gestures: circles at the blowhole finish the breath; the breeze, idle
and sweeps never progress it before its valve; the valve finishes it by its dolphin; each negative proven to bite by
breaking its guard once. One smoke still set at `k1` and `k2`.
Done: [x] `591cfc4a..518bf634` on `sea-net`. `sealife.net` (`net.ts`, `netShader.ts`): `lift`, `peel`, `loop`, `drift`
(0..1; `posed = true` lets a QA eval scrub them), `float` (the leader's near cork: `position`, `velocity`,
`push(impulse)`), `loopEnd` (`held` pins it to the bill). Draped once by `surfaceAt`, then carried by the anchors.
Strands drawn at true coverage, so no shimmer. The valve's dolphin leaps over the crown and flicks the mesh up
(`lendDolphin`, `poseDolphin`, `handBackDolphin`, reusable for N2b's valves). Save `whale-breath`. The whale's call
(A2 to D3, settling on B2) at the eye and at the farewell flukes, and a far echo on `toLines`. Left: the
hold's low camera sees the crown edge-on, so the net reads only as a band of corks; mid-peel the flank cells stretch
long; the loop is mostly under water from the hold. After merging `sea-look`, re-check `ACROSS_NEAR` (the near edge
above the eye) and `valveClear`. The new sounds still need an entry in `docs/contracts/audio.md`.

### Phase N2b: the child's haul
Owns: step 2 (`line`) in `net-whale.ts` with its invitation and dolphin valve, the sweep that brings the cork, the
child's catch and haul, the peel, the camera's per-step holds (the breath, the haul, the cygnet, the release) with the
portrait scale, the save after it, the rope sounds, `tools/net-whale-check.mjs` for it. On `sea-whale`.
Done: [x] `d4ac84ad..bddd45cf`. A stroke crossing the cork on screen pushes it along the stroke (away from the boat at
0.3, tethered); it knocks on the planking, she leans out and takes it in both mittens, and five pulls hand over hand
set `peel` from the line hauled in; the sheet doubles over at the leader's row (which now leaves at the cheek, 14.4 m)
and slides off along its own drape. Valve: a lent dolphin noses the cork in. Holds per step (`NetWhale.holdFor`; breath
22/11.5, line 11/4.8, flipper 11/4.6 as a first pass; portrait ×0.58). Save `whale-line`; sounds `cork-knock`,
`rope-pull`, `net-slither` (in `docs/contracts/audio.md`). Her mittens reach the rail rather than just outside it: further
puts her boots through the planking. Idle the open sea now runs about 371 s (two valves); circling and sweeping about
180 s. Left for the look: portrait holds show much empty sky and a small boat at the haul; the eye reads as a dark lens;
the net is a sparse grid on the flank; the flipper under the glass reads as a pale slab.

### Phase N2c: the cygnet and the flipper
Owns: step 3 (`flipper`) with its invitation and dolphin valve, the cygnet's swim to the flipper and back (`src/companion/`
or the cygnet's states as fits), the lazy lift and the loop's slide, the net's drift and the pod in frame at free,
the save after it, the splash sounds, `tools/net-whale-check.mjs` for it. On `sea-whale` after N2b.

Both:
Seam: each step's progress is caused only by its own gesture at its own target; steps go in order; a valve's dolphin
does the same physical act the player would have caused.
Gate: typecheck; build; the check with real gestures: each step done by its gesture; the ambient breeze and idle never
progress a step before its valve; each valve finishes its step by its dolphin; sweeps on the whale elsewhere only
tickle; saves at each checkpoint resume correctly; each negative proven to bite by breaking its guard once. One smoke
still set at `k3` and `k4`.
Done: [x] `9d8acd44..3953956a`. The bird drops in on its own side, swims round the stern, takes the end (`net.endRest`,
outside the flipper's sweep; `net.holder` read after the bird moves, 0.024 m gap) and tows it 1.4 m out; screen pace
along the flipper (`finPace`, `finAlong`, `finSweep`; `input.gust` reads low over the near water) lifts it once the
end is held (`finLift` 0.16 rad, `finSwing` 0.05, eased out), the loop slipping off in `slipFor` 4 s; `tickle(mayLift)`
keeps tickles from lifting it. Valve: a lent dolphin noses the flipper up from under 80% along. Her mittens to her
mouth while the bird is out; it climbs onto the gunwale into her arms and is stowed before `free`. The pod crosses
astern (`POD_*`) and one lent dolphin leaps side-on at the spout (`SALUTE_*`). Flipper hold 9/4 (landscape), portrait
its own high hold (`flipperPhoneDistance` 6.5, `flipperPhoneHeight` 10). Save `whale-flipper` (resumes at free); the
line's save moved to her letting go. Sounds `flipper-pour`, `loop-slip`, `swimmer-out`. The cream marks over the sail
were the cygnet's calls from the satchel, new on this branch: `watch(target, hushed)`. Checks: `net-whale-check`
`fin`, `finearly`, `finidle`, `full`, `fullidle` (each negative broken once and seen to fail); `sea-logic-check`
plays and resumes the flipper; `whale-look-stills` adds `k4-held`; `tuning` on the QA `__game`. Left for the look
below.

### Phase N3b: the frames, the net and the pod
Runs alone (Claude's call, 2026-10-08): peers' build agents share the session limit, so N3b and N3c go one after the
other on `sea-whale`. Owns: where the boat comes to rest by the whale and the whale's lie toward the sun (in
`net-whale.ts`), every step's camera hold in landscape and portrait (`holdFor`, `frame()`, `tuning.netWhale`), the
flipper's rest pose and lift (not its shape), the net's look (`net.ts`, `netShader.ts`), the pod at free, how the child
and the bird read (pose, place, light; the bird keeps its own size). Not the whale's skin, head, eye or flipper shape.
Seam: anchors and `surfaceAt` keep their names; the mechanics and the clearances of N2 stay as they are.
Gate: typecheck; build; `net-whale-check` `sweeps`, `line`, `fin`, `finidle`, `saves`; `sea-logic-check`; stills at
`k1`–`k5` with `k4-held`, landscape and portrait, beside the concept.
Done: [ ]

### Phase N3c: the whale's body
Owns: `whale.ts`, `whaleShader.ts`, `anatomy.ts`, the shape, skin and eye in `sleeper.ts` (not its API, pose or lift),
`tuning.whaleLook`; judged in N3b's frames, and far off on the first crossing.
Gate: typecheck; build; `sea-logic-check`; no first-use stalls; final stills (landscape 1600×900 and portrait about
430×932) at each keyframe and the first crossing's dive beside the concept, opened for Jeremy.
Done: [ ]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's chapter-select still regenerated with the whale; the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
