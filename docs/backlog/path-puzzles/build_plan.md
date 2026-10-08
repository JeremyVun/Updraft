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
Done: [x] `b073d339..cdab5c51` on `sea-whale`. The lie: eye 14.5 m at 0.8 rad to port, length 1.25 rad to starboard, so the
back recedes toward the sun and leaves the frame right (at 1.1 the whole animal showed from the approach). Every
landscape hold looks into the sun; the sun is 0.65° up, so below about 7 m the crown hides it: breath 18/9.5, line
11/4.8 (as was), flipper 15/7.2 bearing 0.36 looking 9 m up, release 30/8.5 bearing 0.2 (`releaseBearing`); the
spout no longer pushes the camera back. Phone holds are explicit per step (`tuning.netWhale.phone`: distance,
height, turn, lookY, toward; `portraitIn` and `flipperPhone*` gone); the line and flipper phone holds no longer fit
the eye (it only backed the camera off). The flipper's rest pose in tuning (`finRestSweep` -1.75, `finRestRaise`
0.67), floating awash as the body rises with each breath; `finLift` 0.1 (tip up about 2 m); the loop sits at 0.9
along it (`LOOP_FROM`), so its line leaves the water at the tip. The cygnet takes the end at 4.6/1.8 and holds at
3.4/2.2, side-on, 1.19 m clear at worst. The float-line is 17 m (`LEADER`; 14.4 could not bring the cork to her
from the new lie). The net: strands 0.03 m with a 1.5 px, 0.6 opacity floor and a veil past it, darker rope and
weed, 24 weed strands, a deeper skin shadow; drifting off it opens into a raft (`OPEN`). The pod and the leaper
cross just ahead of and beside the bow, against the sea rather than the flank. Left for N3c: the whale reads smooth
and toy-like and its near flank is dark against the sun; the eye a dark lens; the flipper is a straight plank from a
root 6 m deep, so only its last metres reach the surface: at rest it shows as a pale slab under the glass, lifted as
a pale plank (a flipper that bends up toward the surface would let it lie awash along its length); the bird at the
flipper is small and dark against the sea from the hold that keeps the sun in frame.

### Phase N3c: the whale's body
Owns: `whale.ts`, `whaleShader.ts`, `anatomy.ts`, the shape, skin and eye in `sleeper.ts` (not its API, pose or lift),
`tuning.whaleLook`; the flipper's root and rest pose too where its shape needs them (keeping the `fin` clearance);
judged in N3b's frames, and far off on the first crossing. The concept's skin is simplified for the build
(`notes.md`): the target is form that reads (head, jaw line, throat, eye, flipper), never rock-like noise.
Gate: typecheck; build; `sea-logic-check`; `net-whale-check` `line`, `fin`; no first-use stalls; stills at each
keyframe and the first crossing's dive, landscape and portrait, beside the concept.
Done: [x] `fd76ee3b..a9c06a05`. `anatomy.ts`: a blunt head rising steeply off the rostrum, a saddle behind the crown
(blowhole 5.76 m), the lower jaw its own mass bowing out under `MOUTH` (in `ringPoint`, so `surfaceAt` and a
numerically solved `flankAt` follow); 201 × 128 rings. In the shader: the lip's crease and rim, broad throat
grooves, eight soft knobs (`KNOBS`), low swells. The pale lip narrows to a point under the eye (`JAW_CORNER` 0.152)
and greys into the slate from 70 to 140 m, so far off it reads as a long low shape first; a lip rising toward the eye
or gold along it read as a smile and were rejected. The eye: an amber iris (`#b06a26`) with fibres and a dark pupil
under a bulging cornea that carries the sky and the catchlight, a heavy upper lid over the top 40%, two folds above
and two below, little white. The flank: a cooler, higher fill on steep faces, less bounce, darker toward the
waterline, the rim gold on top only. The flipper: root about 0.5 m deep (`FIN_ROOT`), `finTip` now its true tip, a
narrow wrist and rounded tip (`FIN_HALF_CHORD`), knobs on the leading edge, turning over as it lifts (`finTurn`);
`finRestSweep` -1.843, `finRestRaise` 0.278; the `fin` check models its half-chord (`FIN_HALF`), clear 1.19 m. The
pale slab under the glass is the water's shallow tint over anything a few centimetres under: keep the flipper's top
above the water or well under it. About 4× the vertices and a heavier fragment shader. Left: the knobs read as pale
dots in rows; the lifted flipper reads as a pale lilac second animal before the eye; the resting flipper at `k3` a
translucent blade; the big flank still smooth where it fills the frame; the dive's flukes flat in the haze.

### Phase N3d: the net up close and the last frames
After N3c. Owns: the net's look (`net.ts`, `netShader.ts`), the pod's leaps at free, the bird's read at the flipper,
small hold changes. The mesh reads as rope lying in sags and folds over the head rather than a grid printed on the
skin; the corks read as the concept's cream spotted floats, cheated larger for legibility where needed (Claude's
call, 2026-10-08), the float in her mittens still one a child can catch; the drifting raft is not a mat of corks.
Gate: typecheck; build; `net-whale-check` `sweeps`, `line`, `fin`, `saves`; `sea-logic-check`; final stills (landscape
1600×900 and portrait about 430×932) at each keyframe and the first crossing's dive beside the concept, opened for
Jeremy.
Done: [x] `f6f7c8a6..936fbf44`. Rope knotted into irregular 1.25 m diamonds (0.07 m, lit round, knots at the
crossings), standing off the skin in seven folds and over hollows (`BRIDGE_SAG`); 46 rows × 28 columns, each row with
its own near edge (`edge` attribute: down to the water round the head, held clear of the eye, climbing along the
back), scalloped between corks; glow through the mesh 0.35 so it shows against the sky; 40 weed strands. Corks cream
with dark spots, per instance (`iSize`): the net's 0.54 m on its edges (`NET.cork`), the line's floats 0.32 m
(`NET.float`, `CORK_CLEAR` follows). The raft drifts clear of the head by the spout (`OPEN`, `DRIFT_AWAY`,
`DRIFT_OUT`). The pod lends four dolphins (slot 0 the valves' and nudges', 1–3 `SALUTES`, three leaps round the head,
caught by the sun through `uCatch`). Knobs no longer brighten; the flipper slate, wet and streaming as it lifts,
dark under the glass (×0.45 in `GHOST_FRAG`), drips in strings (`POURS`). The bird only slightly wet on its second
swim (`swimTo(…, soaked)`). Holds: flipper 11.5 back, look 8 up; release 21/7, bearing 0.28, fitting only the boat
and the blowhole (`extra` 4). No step-downs on the whale's frames with the GPU free. Left: at `k5` the whale fills
the frame and the snout is cut (eye 14.5 m off; the concept's 18–20 m as it drifts clear), one leap clear in frame;
the resting and lifted flipper read as a separate big smooth lump before the eye; portrait frames look away from the
sun into deep blue, and portrait `k5` has no leap or raft; the whale's skin smooth where it fills the frame.

### Phase N3e: the farewell clear, the flipper and the phone's light
After N3d, on `sea-whale`. At free the whale drifts clear before it spouts, as `notes.md`'s `k5` has it (eye about
18–20 m off, nearest skin at least 8 m), so the head, eye and snout sit whole in the middle distance with the leaps
round them; the flipper reads as the whale's own, joined under the jaw, not a separate lump before the eye; portrait
frames keep the gold morning though the sun can't share a phone's frame with the head and the boat.
Gate: as N3d's, final stills opened for Jeremy.
Done: [x] `fed63c7c..58172ef1`. Free, the whale swings its head away about its tail stock and slides clear
(`driftClear`: `CLEAR_TURN` 0.06 rad, `CLEAR_SLIDE` 2 m; pivot and heading restored in `lie()`), the eye 19.2 m off at
40° to port by the spout; the free timeline 2 s longer (`SPOUT_FROM` 6, `FREE_FLUKES_FROM` 13.5; everything timed in
free seconds follows). Landscape release hold 30/12. Three leaps clear in frame (`SALUTES`). The flipper about 9.6 m
(`DREAM_SHAPE.fin` 0.28), rooted just behind the mouth's corner (`FIN_ROOT`), turned up on its knobbly edge
(`FIN_EDGE_UP`), drooping, darker and less sky-lit than the body; `finRestSweep` -0.45, `finRestRaise` 0.23, `finLift`
0.16; the bird's stations moved clear of the new tip (`endOut`/`endAhead`, `birdOut`/`birdAhead`). The flipper's reach
table (`FIN_HALF`) lives in both `net-whale-check` and `sea-logic-check`: regenerate both if its shape changes; `full`
is the tight case (1.23 m, as the bird swims out past the tip). Phone holds turned toward the sun as far as their
subjects allow (`phone.*.turn`, `release.turn`); the breath's portrait has the sun. Timings (`full`): rest 88.8,
moored 210.3; idle 485.9. Left: the portrait farewell has no raft (it lies 19 m abeam beside the snout); the leapers
are dark against the sun; the flipper's root bobs about 1 m with each breath (under at the bottom, a pale horn at the
top); at `k3` the hauled net reads as a scatter of corks.

### Phase N3f: the giant's form
After N3e, on `sea-whale` (Jeremy, 2026-10-08; design.md, "A dreamlike giant, ancient" and "Its form, from a real
whale, not the concept"). Owns the whale's section and profile along its length (`anatomy.ts`, the rest pose and
breath in `sleeper.ts`), its shape under the glass, the haze along its length, the gold line along the back, and the
holds the new form needs. A first form (a tube sunk tail-down behind the crown, `ff2330ec..2e176d32`) was rejected by
Jeremy: its light, haze, glass, breath and eye work may stay where they serve the new form. The form is shown to
Jeremy as stills before the holds and the gate.
Seam: `surfaceAt` and the anchors stay true to the rendered skin; the net drapes by them and must still lie on it;
the bird's clearance from the flipper and the mechanics of N2 stay.
Gate: as N3d's, stills at every keyframe.
Done: [x] `fea5d161..2ab6edf9` (the rejected first form `ff2330ec..2e176d32` before it). An upper cap and a lower hull
meeting at a broadest line, each shaped along the length (`TOP`, `WIDEST`, `BOTTOM`, `HALF_WIDTH`, `ROUND`, `KEEL` in
`anatomy.ts`; `halfWidthAt`): the head flat-topped, about 18 m wide and 12 m deep at the eye, the lower jaw bulging
up to 15% wider than the upper at the lip, a broad soft crest down the snout (`RIDGE`); broadest about 2.3–3 m under
the water at s 0.36–0.45, about 23 m across (1.5× a blue whale's breadth); the tail stock narrow and deep. Above the
sea: snout 1.1 m, the wedge rising to the blowhole's guard at 5.3 m 23 m back, the back level at 5.1–5.25 m to 55 m,
lowering into the haze, a small dorsal knuckle (`DORSAL_AT` 0.74) about 79 m back, under from about 100 m; flukes
about 1.7 m down (the pale slab trap now applies to them). `restPitch` tips the head 0.08 rad, level to s 0.6, then
tail-down; anchors eye 2.30, blowhole 5.30, back 5.15, flipper root −0.09 m (the flipper and `FIN_HALF` unchanged).
`EYE_S`/`EYE_Y` shared from `anatomy.ts`. Light, haze, glass and `breathAt` from the first form kept. The net's gap
to the skin: worst −0.056 m, 99% within 0.65 m. Left: every near hold was lowered for the rejected low back and now
sits at the back's height (the flank a dark wall, the sun half hidden at the haul); `breathEvery` still 7 s; up close
the flank is a huge smooth wall until the skin pass.

### Phase N3g: the encounter staged (awe, sorrow, courage)
After N3f, on `sea-whale` (Jeremy, 2026-10-08; design.md, "The feeling and the bar", "Claude's direction for the
encounter", "One encounter, seamless", the body never answering the wind). Owns the approach's reveal in the haze,
the sorrow at rest, the breath's held exchange of looks, the haul and the bird's swim as one flow: `net-whale.ts`'s
hand-offs between steps, the whale's attention (its eye on her and the bird), the child's and the bird's acts at
every beat, the camera's holds and moves on the new form, the score thinning in the sorrow, and the removal of the
body's wind response (`tickle`, the shiver and slap). Claude plays the build in motion before it is done.
Gate: typecheck; build; the whole `net-whale-check` (its tickle assertions become "the body never answers");
`sea-logic-check`; `CROSSING=toMirror node tools/journey-pacing-check.mjs`; a real-gesture recording of the whole
open sea with frame strips.
Done: [x] `f285042d..7c67b8af`. The body never answers the wind (`tickle`, the shiver and the gust slap removed;
`net-whale-check` watches every resting and woken frame for anything but its breath moving it). `breathEvery` 10 with
the sputter on the same exhale; the score thins through `Crossing.hush` (`hushSorrow` 0.9 at rest, `hushCourage` 0.45
once its eye finds her, 0 at free). The haze reveal (`uLost`, `LOST_GLSL`: `lostFar` 0.75 lifting between 80 and 25 m
short of rest); its far sighs spread with distance (`whale.seenFrom`); she points and the bird peeks at each breath in
view. The look between them, in seconds after the first full breath: in over her left shoulder at 2.4 (`holdFor('look')`,
4 s ease), its eye opens on her at 3 (`eyeOpening` 0.55), blinks at 7.6 (`whale.blink()`), her mitten out at 8, its call
8.9, the bird peeps 10.1, her eyes to the float line 11.6, the line at 13. The bared head runs wet (`whale.stream`);
let go she sits back, the bird sees the loop (1 s), she looks to it (1.9 s), it goes at 3.4 s; its eye follows the
bird; the lift slow and heavy (`LIFT` 6.6 s, `slipFor` 5). Holds: sorrow 20 m back, 8.5 up; look 6 back, 3 up; line
12.5 back, 7.2 up; flipper 12 back, 7.5 up. Played: rest 88.8, line 111.6, flipper 143.8, free 166.8, moored 215.7; idle
moored about 480. Left (Claude, playing it): the holds above the back look down on it like a map; the lifted patch
stands as a pyramid of net over the back with corks up its middle; the first column is lost in the glow; the look's
frame has her as a hood cut off in the corner beside a wall of sail (half out in portrait); the far sigh is not seen;
her pointing barely reads; the flipper's lift reads as a claw with streaks; the eye's iris glows orange; `wrongway`
fails as it did on 96137ec2 (a reverse stroke draws the cork in); a phone's swipe along the flipper needs 0.8 screen
heights a second.

### Phase N3g2: the courage at the bar
After N3g, on `sea-whale` (Claude's calls after playing N3g, 2026-10-08; design.md, "1. The breath", "3. The cygnet",
"Camera"). Owns: the holds brought down so the ridge stands against the sky and the approach's descent into them; the
look's frame as the owl's (landscape and portrait); the patch falling aside off the blowhole once it has breathed; the
first column reading against the glow; the far sigh in the haze seen and her pointing read; the flipper's lift as one
pale paddle side-on with water running off it; a reverse stroke pushing the cork away; a phone's swipe along the flipper
at a phone's pace. Not the eye's colour (N3i), nor free and gone (N3h).
Gate: as N3g's, `wrongway` included.
Done: [x] `a41aff1d..e28bfebc`. The holds sit low, the lens allowed a metre over the water beside it (`holdClearance`) and
backed off at most `holdRoom` 2 m (the look not at all): sorrow 13 m back, 2.8 up, 0.25 to port (the back's ridge and
its gold line against the sky, the sun's disc behind the back, its glow over it); line 9/3.4/0.3; flipper 12/3.2/0.55,
from the port quarter so the flipper is side-on; phone sorrow 18/2.8, haul 6/3.2 aimed at its eye (`eyeward`), bird
12/3.4 turned −1.5. The approach comes down in one ease: no rise over the pod; led, the view comes `leadDrop` 2.6 lower
and `leadIn` 10 nearer, and the hold (`holdFrom` 75) takes it on down. The lead's sigh: `sighIn` makes it breathe
`leadSigh` 4 s after the lead, and a sigh seen from over 40 m off rises as a soft plume of `COLUMN` puffs scaled to the
distance (`spray.plume`, over 2.2 s); she sits up and leans toward it (`knowsLean`) `knowsFirst` 1.2 s before each such
breath (`untilSigh`), the cygnet peeking at the first. The patch: `net.slump` from `slumpFrom` 3.2 s into the first
breath over 3 s, sliding it 4.2 m down the far side of the crown in loose folds (`net.raised` is the patch's lift
everywhere it is read). The first column: `spray.column`, round puffs lit as one shape (`COLUMN`, the side each left
from in `iC.w`), 13 m (`firstBreathHeight`). The look: she slides 0.35 m to the port rail, turns 0.95 and leans 0.9 out
toward its eye (`lookSlide`, `lookTurn`, `lookLean`, eased by `drawn`); the camera 3.8 back, 1.75 up, 0.22 to port,
looking 0.33 toward its eye (the focus is the eye there), her face the primary; the mast stands at the frame's right
edge and the sail beyond it once the boat has settled (the bird peeks at the edge beside it); phone 2.9/2.55, turn
−0.45, close behind her on the line to its eye. The flipper: `finPoint` (anatomy) gives its surface for the mesh and
`sleeper.finAt` the posed point; lifted it pales (`finRaised` in the skin) and the sea pours off the whole trailing
edge in threads and drops. The cork: a wrong-way stroke pushes it a little away and `settleCork` draws it back to where
it lay (`corkSettle`); `wrongway` failed because the check parked the pointer by dragging it back across the cork, now
it leaves and comes back as a hand does (`jumpTo`/`away`), and it fails with the push reversed. The flipper's pace is
eased over a few frames (`finPace` 0.45): a 150 px, 0.34 s phone swipe lifts it, a 1.5 s drag does not.
`sea-logic-check` measures the blowhole as a target only while the circles are asked (NDC 0.12–0.13). Played: rest
88.7, line 112.2, flipper 143.6, free 165.8, gone 195.3, moored 215.0 (`full`: moored 216.3); idle moored about 480
(pacing `calm` arrivalReady 479.7). Left: from behind, her short arms never clear her hood, so her pointing at the lead
and her mitten at the look barely read (her lean, her head turned and the cygnet carry them); her hood is a dark
backlit shape in the look; the sail can show at the look's edge while the boat is still settling or the boom swings;
on a phone the paper plane on her back hides her hands at the haul and the bird sits at the edge of the bird's hold;
the eye's orange iris is N3j's.

### Phase N3h: the release
After N3g2, on `sea-whale`, in parallel with N3j (Claude played N3g2, 2026-10-08: the giant now breaks the horizon and
the far sigh reads; its first column reads as violet smoke with rings in it, not mist). The river-spirit moment, from
the bird lifted in to the start of the dive: it drifts clear and breathes free, the tall plume against the sunrise, its
mist drifting down over the boat in the gold light; its call turning glad; the sea brightening round it; the net let go
working loose into a raft and sinking away into the deep; the pod's leaps; her wave and the bird's call; the score's one
bloom; the release view easing out from the low holds without a lurch, the giant still breaking the horizon. The first
column and the spout read as mist, white lit gold through the sun and soft grey-blue on the shadow side, never
coloured smoke or ring bands. Owns the free step in `net-whale.ts` and the free motion in `sleeper.ts` up to the dive,
the net's raft and sinking (`net.ts`, `netShader.ts`), `spray.ts`, the sounds and score there.
Gate: as N3g's.
Done: [x] `20eebe58..2c47c804`. Mist (`spray.ts`): `COLUMN` puffs are soft balls all the way from the middle (no rim
term, so no rings), shaded as the stairs' cloud is, the sky's brightness without its colours (`mistShade`, lilac-grey in
its folds), a share of the low sun scattered all through, gold where it is thin toward the sun, warming as it thins; the
first column, the far plume and the sighs share it. Free, in seconds of `whale.time` (`sleeper.ts`): it drifts clear as
before; `SPOUT_FROM` 6 the spout, `spray.jet` plus a `spray.column` `spoutBreadth` 1.5 times as broad, 20 m; the
reward phrase and three leaps as before; from 7 to 13.8 its mist comes down over the boat (`spray.veil`: puffs from
high in the plume carried on their own way, slowing as the square of their life, and fine drops glinting); the sea
brightens round it from the spout (`water/glad.ts`, `gladSea` 0.8 out to `gladReach` 34 m along its head and forward
body: the body lifted, the sun's glitter tripled); at `GLAD_AT` 9.2 its glad call (`whale-glad`: the same voice,
brighter, rising to E instead of settling), her eyes on its eye, from 10.5 up into the mist; at 11 the cygnet calls back
(`call(true)`); she waves from the spout to 12. The dive now starts at `DIVE_AT` 15.5 (every dive key is timed from it;
`FREE_FLUKES_FROM` is `DIVE_AT` + 3). The net: let go it drifts to `raftPort` 8 / `raftAhead` 9 (to port and ahead
of the boat at rest, turning `raftTurn` 0.5) and works loose into a raft by the spout (`DRIFT_TO` 24; a save at the
flipper backdates the letting go by `FREED_BEFORE` 7.5 so it is a raft by the spout there too); from the spout's end
to `DIVE_AT` − 1 it sinks (`net.sink`, `uSunk` = 4 m × sink², drawn through the glass by `SINK_VERT`/`SINK_FRAG`: each
point slid up its view ray to the surface, the mesh fading fast, the floats going down whole 0.6 m behind it and
fading slowly; corks are now a transparent material so they fade rather than dither), and is hidden at sink 1. The
release view: free holds `release*` as a hold of its own, eased to from the flipper's in one move over `releaseMove`
7 s (no second ease): 18 back, 3.6 up, 0.3 to port, `releaseLookY` 5, `releaseToward` 0.5, backed off at most
`releaseRoom` 4; phone 12/3/−0.3, lookY 12, toward 0.4, `phone.releaseRoom` 4; what it keeps in frame moves from the
flipper to the spout with the same ease; a phone's view turns between flipper and head by angle (through the point
between them it swung round fast). Camera through the release, measured on the recordings: worst 0.6 m/s² landscape,
0.5 portrait (N3g2: 1.9 at its first second). Played (`full`): rest 88.7, line 111.8, flipper 144.5, free 167.2,
spout 173.2, gone 201.9, moored 221.2; idle moored about 485 (pacing `calm` arrivalReady 484.7). Left: in the webm the
spout's upper crown reads paler grey-white than in stills; the sea's brightening is subtle at the low angle; the
pod's own leaps cross close by the boat as before; the hand-back to the crossing camera as it goes (`gone`) still
jerks (about 9 m/s², as on N3g2's recording) — N3i's.

### Phase N3i: the farewell
After N3h, on `sea-whale`. It dives as a whale does, never rolling (Jeremy, 2026-10-08): the head goes down, the long
back arches slowly forward and slides under, the flukes rise high once with their pale pattern and slip under; its
swell lifts the boat; the pod goes with it; the sea stills toward the mirror's glass and the boat comes about. Two
things N3h left, both Claude's judgement on playing it (2026-10-08): the free spout, the climax image, reads in motion
as a grey wedge widening up out of the frame, where the first column now reads as white mist lit gold; it becomes that
mist, taller and glad, bushing out at its crown against the sunrise. And the hand-back to the crossing camera as it
goes jerks (about 9 m/s²); it becomes one ease. Owns the dive and gone in `net-whale.ts` and `sleeper.ts`, the swell,
the free spout in `spray.ts`, the camera through it.
Gate: as N3g's.
Done: [x] `c201f8eb..b9aaae07`. The dive (`sleeper.ts`, from `DIVE_AT` 15.5): one forward glide down a way the whole
body follows, with no roll. Each spine sample's pitch comes from the way at its distance past the bend, `DIVE_SLOPE`:
a 1.5 m arch rising behind the bend, then down to 69°, steeper as the tail comes. The pitches are integrated from the
bend, which stays where it lay on the water at `BEND_AT` 0.22, its blowhole (`farewell`, known from `DIVE_AT` − 3).
Its rest posture fades as each part reaches the bend; the head eases onto the way over `HEAD_DOWN` 6.5 s.
`GLIDE` is its speed in m/s, 8.6 at most through the arch, slowing to about 1.3 round the flukes (`glided`,
`glidedAt`). The tail stock (`STOCK` 0.84 to `STOCK_TO` 0.95) lifts by `LIFT_BY` (metres it lies past the bend) to
`FLUKES_UP` −1.45. As the flukes rise the whole body turns `TURN_TO_HER` 0.7 of the way about the bend's vertical, so
their undersides face the boat. The wave is a hinge flex `WAVE_FLEX` 0.16 and a slight roll `WAVE_TURN` 0.12.
`fluking`, `going` (`GOING_AFTER` 1.2 s after the notch is under), gone 3 s after it, `diving`, `flukesShown`.
The swell (`surgeHeight` 0.6) spreads from the arch and reaches the boat just after the flukes are under. The lens
leaves out the swell's lift (`surgeAt`), so the boat rises in frame. The pod leaps away over where it went (`podYaw`).
The sea's brightening gathers to the bend and fades out by the notch's going under.
The spout: `spray.spout`, its own kind (`SPOUT`), the first column's puffs with a firmer lumpy edge, the backlight on
their rims, `spoutHeight` 15 and `spoutBreadth` 1.2, its crown in the release's frame (`releaseLookY` 10). `MAX` 3200.
The camera: as it dives the view eases once over `farewellMove` 7 s to the farewell's hold, framed on the bend (hold
entry 14, `farewell*`; phone `farewell`). Once gone, the hand-back is one linear ramp of the hold (`handBack` 16 s,
smootherstep on screen). The blend's turn is unwound frame to frame. Gone, the hold's subjects let go (`extra` → 0).
A phone's farewell keeps the bend in frame, not its sunk eye, whose 80 m depth had shoved the view down.
Camera from free to the hand-back's end, worst acceleration: landscape 1.97 m/s², in the middle of the swing
round behind the boat as it comes about; portrait 3.75 m/s², the same swing's turn. N3h's was about 9.
Played (`full`): rest 88.7, line 111.5, flipper 144.7, free 167.4, spout 173.5, gone 206.7, moored 233.1. Idle,
moored about 496 (pacing `calm` arrivalReady 496.5). Beats in seconds of being free: spout 6, its eye going under
about 19, the arch at its height about 22, the flukes up from about 27 and highest about 31 (notch about 12 m),
under 36.1, going 37.3, the swell under the boat about 38.5, gone 39.1.
Left:
- In the webm the spout reads paler lilac-white than the render, and at its full height its crown reaches the top
  of the release frame.
- For about a second the rising flukes stand edge on, a thin blade, before the turn opens them.
- In the landscape recording, the left fluke tip touches the top of the frame at its height.
- The sail stands near the stock as the flukes rise; their tips overflow a phone's frame.
- She is small in the farewell's frame, so her waves barely read.
- The hinge shows a seam, and the tail stock's pale underside reads as a stalk; both are the skin's.
- From the flukes under to the hand-back, about 8 s of quiet sea, sun and boat.
Claude's judgement, 2026-10-08, in motion: the dive is one continuous whale's movement and the arch under the low sun
is lovely; the flukes standing over the boat with the sun beside the sail are the encounter's strongest image, and
its weakest form: flat faceted boards with a saw edge against the sky, a cow's patches, a pale round stalk, a seam.
The quiet after they go under is right, the sea stilling. The spout reads as soft mist, a little grey.

### Phase N3j: the ancient skin and the eye
In parallel with N3h, on its own branch `sea-whale-skin` off `sea-whale` (merged back before N3k). Owns the skin and the
eye in `whaleShader.ts`, `whale.ts`'s look uniforms and `tuning.whaleLook`, shader only (the form, the anchors and the
net's drape untouched): barnacle crusts, healed scars, mottling, growth at the waterline, wet streaks, drawn as bold
simple painted shapes like the rest of the game, fine against its bulk; the eye old, wet and kind in its folds, its iris a
deep warm brown catching the sun in one bright point (not the lit orange N3g left). The same skin on the first
crossing's whale.
Gate: typecheck; build; stills of every hold (landscape and portrait) and of the first crossing's whale, beside N3g2's.
Done: [x] `2adf00d4..8ab6e76b` on `sea-whale-skin` (`whaleShader.ts`, `tuning.whaleLook` only). Every mark sized in metres
on the skin and faded to its mean tone below a few pixels: broad tone patches (`tone`); two scatters of ragged pale
grey-blue dapple 0.4–1.4 m (`dapple`, `dappleCover`, `dappleAmount`); a few soft pale wavering scar strokes 3–8 m,
kept off the eye (`scar`, `scars`, `scarAmount`); barnacle clusters of shaded soft domes round the head's knobs, the
chin, a few head patches and the flipper's edges, a pale crust far off (`crust`); a dark olive band with a ragged top
on the rest waterline (`growth`, `growthReach`; the line is the table `REST_SEA` with `tuning.netWhale.roll`, re-measure
it if the rest lay changes); faint wet runs (`runs`); the ghost body softened (`dry`). The eye: a brown iris `#82502b`
with fibres, the sun through the cornea keeping its hue (`caustic`), one warm-white catchlight (`catchlight`) and a faint
second from the sea, dimmed to a quarter when shut; fine age lines behind the corner. Claude's judgement, 2026-10-08:
the eye is right, kind and wet, and the whale now reads as a mottled blue whale rather than a plastic model, but not
yet as ancient: the dapple's soft round spots read as out-of-focus light up close, the scars do not read, the
barnacles show only at the snout beyond the near frames, the growth is a plain dark band, the wet runs never show.

### Phase N3k: its age
After N3j, on `sea-whale-skin`, in parallel with N3h and N3i; shader only, as N3j. The skin taken to ancient where the
near frames see it: barnacle crusts on the chin, the lip and the head near the eye (clear of the eye itself), scars bold
enough to read as old healed marks, the dapple painted with edges like lichen on a rock (the owl's rock is the
reference), the growth with life in it. Still gentle to a child.
Gate: as N3j's.
Done: [x] `a8aafc13..9d5cb9c3` on `sea-whale-skin` (`whaleShader.ts`, `tuning.whaleLook` only). Lichen replaces the
dapple: colonies of crisp-edged rosettes (about 0.3–1.1 m, and small flecks), paler at the rim, dense at a colony's
heart and thicker about the face, never on the eye or the low flank (`lichen`, `lichenWarm`, `lichenCover`,
`lichenAmount`); scars as soft pale strokes 2–4 m with rounded ends, a pale haze and a thin shade under the lower edge,
mostly along the body (`scar`, `scars`, `scarAmount`; raked pairs and tapers dropped, they read as claws); barnacles as
tight lumpy pale crusts of soft domes on the knobs, the chin, the lip line and round the eye clear of its folds, greyer
on the pale lip, shading the skin under them (`crust`, `crustShells`); the weed a ragged band on the rest waterline with
moss and a faint yellow film above (`growth`, `moss`, `film`, `growthReach`; upright fronds dropped, they read as trees);
a soft grain (`grain`) and three long creases arching over the eye (`creases`). The eye's clearance is one measure,
`face`, 1 at the edge of its folds. Claude's judgement, 2026-10-08: it now reads as an old weathered whale, like an old
hull from the bird's hold; the lichen is a little decal-like beside the owl's rock, a crust behind the eye is prominent
at the look, and the weed can read as a dark hedge along a shore at a glance.

### Phase N3l: the flukes
After N3i, with N3k merged on `sea-whale`; in parallel with N3m. The flukes made the farewell's finished image (the
design's form section): a humpback's swept pair, a thick rounded leading edge thinning to a fine trailing edge in
soft scallops either side of the notch, the tail stock a deep narrow keel flowing into them with no seam; their
underside pale with a dark margin and a few old marks of its own, barnacles along the edges, the same pattern on the
first crossing's whale. The second where they rise edge-on opened by the turn. The farewell's frame holding their
tips in landscape and on a phone, the sail clear of the stock, her waves plain. And the lichen gathered on the head
and the top of the back, thinning down the flank. Owns `flukes()` and the tail stock's rings in `anatomy.ts`, the
skin in `whaleShader.ts` (not its wet terms), the dive's turn in `sleeper.ts`, the farewell's hold in `net-whale.ts`,
their tuning.
Gate: as N3g's, with stills of the flukes high and slipping (landscape and portrait) and the first crossing's dive.
Done: [x] `e5406172..c3e4fb91`. The form (`anatomy.ts`): the flukes (about 34 m across) drawn at 200 stations of 36
round a blade section (`blade`: round at the leading edge, fine behind; thickness 0.34 of the chord at the root, 0.12
at the tips), the trailing edge five soft lobes a side either side of the notch (`SCALLOPS`, 0.2-0.45 m, the right
fluke's unlike the left's) over the unscalloped `flukeLine`; the tips' trailing point is unchanged, so `DREAM_SCALE` is
too. The tail stock from 0.82 a deep narrow keel (`ROUND`/`KEEL` up to 1.7/1.9 at 0.88) tapering in depth into the
flukes' root, flaring out in their plane (`FLARE` 0.2 rest units, `FLARE_DEPTH` 0.1) and ending inside them at
`TAIL_END` 0.975, so nothing shows in the notch and there is no seam; the hinge's flex is spread over 0.9-0.96 rather
than stepping at 0.93. The skin (`whaleShader.ts`, shared with the first crossing's whale): under the flukes pale
(`flukePale` 1.12) with a dark leading edge, tips and scalloped trailing margin reaching into the pale in a few soft
tongues, a dark wedge up from the notch into the stock, a dark comma on one fluke and a round spot on the other, a few
specks and faint old scratches, barnacles on the edges (`flukeShells` 0.7); above them the back's slate, little lichen.
The stock without the waterline's weed (`stock`, from 0.74); the throat's pale ends by 0.7. Lichen gathers on the head
and the top of the back and thins down the flank to `lichenFlank` 0.2 of its cover. The turn (`sleeper.ts`; `uTurn` in
the rig and in `point()`, over `STOCK_TURN` 0.76-0.93): `TURN_TO_HER` 0.75, `YAW_SHARE` 0.6 of it the body about its
bend over `YAW_WITH` 0.1-0.85 of the lift, the rest the stock turning them about its own line from the lift's start
(`TILT_WITH` 0.3), never tipping them more than `TILT` 0.3 (about 17°) while low; meanwhile they trail low from the
stock (`TRAIL` 0.7 rad, straightening over `TRAIL_UNTIL` 0.4-0.85). `LIFT_BY` has all of the lift 4.5 m past the bend
(was 6); the wave first leans them away from her. The farewell's holds: landscape 17 m behind, 1.8 m up,
`farewellBearing` 0.6, `farewellLookY` 19; phone 40/2/-0.5, lookY 26, toward 0.6.
The lens's own composition layer (`CameraDirection` in `camera-direction.ts`) keeps an orbit it chose earlier: in a
full play 0.18 rad through the whole release and farewell, none when resumed from the flipper's save. Both holds were
tuned so that either way the sun stands between the stock and the sail, the sail clears the stock on a phone and the
tips stay in frame (headless, `FULL=1` in the scratch `frame.mjs`).
Beats in seconds of being free: the flukes break the water about 28.5, stand from about 29.5 to 34 (the notch highest,
about 13 m, at 31), under 36.1, going 37.3, gone 39.3. Played (`full`): rest 88.6, breath 111.2, line 144.1, flipper
166.9, free 172.9, gone 205.8, moored 232.4, fin clearance 1.48 m. Idle, moored about 496 (pacing `calm` arrivalReady
496.5). Camera from free to the hand-back's end, worst acceleration: landscape 1.95 m/s², portrait 4.5 m/s² (N3i 3.75;
the phone's hold now stands farther back), both in the hand-back's swing round as the boat comes about.
Left:
- For about a third of a second the near fluke rises as a broad diagonal paddle over the sail before it opens; never
  the thin blade, but not yet opening from the first frame.
- Her waving mitten: she is bigger in landscape (about 95 px tall at 1600×900, was 79), but low in the frame with the
  hull cut, and her mitten waves against the sail, so it is still not plain; on a phone she is about 23 px.
- On a phone the rising fluke passes the right edge for about a third of a second, and as they slip under the near
  tip drifts to the left edge.
- The sun stands behind the stock on a phone, so its disc does not show there.
- The first crossing's whale still flexes its flukes with a step at the hinge (`whale.ts`, `s > FLUKE_HINGE`); far
  off it does not show.
Claude's judgement, 2026-10-08, from the stills and sheets: the flukes now read as a humpback's, swept and
scalloped, pale beneath with a dark margin and the first crossing's comma, the stock flowing into them as one animal;
standing over the boat beside the sun they are the image this encounter needed. But the landscape frame is so low
that the boat sits on its bottom edge, the hull cut and her only a dark head against the sail, so her goodbye is lost.

### Phase N3m: its life
After N3i, on `sea-whale-life` off `sea-whale`; in parallel with N3l. Each slow breath lifts the back a little and
water sheets off its top in glinting streams, the sea swelling and settling round it; a few seabirds stand far along
its back as on a rock, never near a step's target, and lift off as it spouts free, gone before the dive arches the
back. Owns the breath's lift and the water off it in `sleeper.ts` (not the dive), `spray.ts`, `wake.ts`, the whale's
`uWet` sheeting, the seabirds (the gulls in `src/creatures/creatures.ts` or a few of their own), their tuning.
Gate: as N3g's.
Done: [x] `2f87b831..9f0afb5f` on `sea-whale-life`. The breath (`sleeper.ts`): as each breath's rise passes `SHEDS_AT` 0.2 of
its cycle, its first full breath half way into drawing it, and the free spout a second before it, `rises(deep)` (deep
0.45 at rest, 1 awake, 1.3 the first full breath, 1.5 the spout) sheds the sea off its back: `uWet` is raised along
s 0.15 to 0.8 to `sheetWet` 0.8 (times deep, at most 1), in over a second and gone over `sheetFor` 4 s (`shedSea`);
white water laces the waterline over s 0.18 to 0.68, seven in ten on the near side, for the first 3.5 s; and one low
crest of sea goes out from its flank (`swell.ts`: `uHeave`/`uHeaveAxis`, `heaveLift` in the shader and the same on
the CPU, so the boat, the corks and the swimming cygnet ride it), `heaveHeight` 0.3 m times deep at the flank, out at
`heaveSpeed` 3.5 m/s, `heaveWidth` 6 m, settled by `heaveFor` 6 s. Measured at the line's hold, the boat rises about
0.15 m more about 3 s after a waking breath, its worst vertical acceleration 0.58 m/s² (0.47 without). The skin's wet
terms (`whaleShader.ts`): over the body the sheet is now `rills` (threads about 1.4 m apart along it, wandering down
the flank, each carrying its water in pulses that run down it, mirroring the dawn with a little of the low sun behind,
`rills` 0.4, with gold glints, `glints` 2.5, fading to a faint sheen below a pixel); the old streaks were keyed to the
ring's angle and lay as horizontal bands along it. The Fresnel wash a sheet added to the body is down from 0.5 to
0.15. The bared head running wet at the haul (`stream`) takes the same threads. The seabirds (`seabirds.ts`, the
gull's geometry and colours from `gulls.ts` with folded wings and legs of their own; `whale.birds`): four at
`seabirdPerches` (s 0.54, 0.565, 0.665, 0.7, on the ridge), `seabirdSize` 2.2 times a gull (about 5.7 m across the
wings), hazed as the back they stand on (`HAZE_GLSL`, now exported); they ride its breath, turn their heads every
1.2 to 5 s, shift their feet every 8 to 22 s and stretch their wings every 25 to 55 s (`seabirdStretch` 1.6 s). From
`seabirdsAfter` 0 s after the free spout, 0.18 s apart and up to 0.2 s more, each crouches, opens its wings over 0.3 s
and flies a curve through its perch, a climb toward the head, a point `seabirdAside` 4 m to the tail side of the
spout and `seabirdHeight` 10 m over it, and `seabirdAway` 75 m off toward the low sun, over `seabirdFlight` 8.2 s,
fading into the sky behind it over the last `seabirdFade` 2.5 s: all gone by about 14.9 s into being free (`DIVE_AT`
15.5). `seabirds-lift`: a flurry of heavy wingbeats through `WorldFoley.whale`. Where they show, landscape: not in the
sorrow, look or line holds (s 0.45 lies past the right edge); in the bird's hold the far pair (s 0.665, 0.7) stands
against the sky right of the sail, about 63 to 67 m off, the near pair behind it; at the spout they rise at the right
edge, cross the sky to beside the spout by about 9.5 s into being free and go off small into the sun by about 12.
Portrait: the back from s 0.45 lies off the right edge in every hold, so they are seen only in flight, entering at
the right edge beside the spout from about 10 s into being free to about 12.5. `net-whale-check`: all 11 cases pass
(`fin` clearance 1.61 m, `finidle` 1.65, `full` 1.49). Played (`full`): rest 88.7, line 111.5, flipper 144.2, free
167.1, spout 173.0, gone 206.2, moored 232.8; idle moored about 496 (pacing `calm` arrivalReady 496.4).
Left:
- On a phone the standing birds are never seen, and in flight they are small and pale against the bright sky beside
  the spout for two or three seconds.
- In the bird's hold the sail hides the near pair; in the release hold the far pair is off the right edge until it flies.
- At twice a gull's size they read as big gulls as they pass the spout.
- A weak breath at rest sheds only faint threads; the crest at the boat is under the sea's own swell (0.15 against
  about 0.35 m), so it reads as the boat lifting a little more rather than as a wave seen on the water.
- In a still the threads can read like the pale scars; they differ in motion.
- Taking off, for 0.3 s the folded and the open wings show together.
- At its height the lace can read as a bright line along the near waterline.
Claude's judgement, 2026-10-08, from the sheets, stills and the recording: the seabirds are right, birds on a
rock on its far skyline, then rising one after another to wheel over the gold sky beside the plume and off into the
sun. The breath is not yet seen: in motion the threads are too faint to read as water running off, in a still they
read as scratches or wires on the skin, and the crest is never seen as a wave on the water.

### Phase N3n: her light and her goodbye
After N3l and N3m merged on `sea-whale`; in parallel with N3o. The look's frame finished (N3g2 left her a dark
backlit hood filling a quarter of the frame): her whole seated figure smaller in it, the sun's rim on her hood and the
lantern warm on her cheek, her head and mitten turned to the eye, the eye large. The farewell's frame keeping its low
height and the flukes over the boat with the sun beside the stock, but the boat whole above the bottom edge and her
waving mitten against the sky or the sun's glow, not the sail; on a phone she reads as a child waving. Owns the look's
and the farewell's holds in `net-whale.ts` and `tuning.ts`, and the light on her (the child's own look, its lantern
and rim).
Gate: as N3g's, with stills of the look and the flukes high, landscape and portrait, in a full play and resumed.
Done: [x] `df1738cb..b8d1c6e0`. The look: the boat's sail swings out over her starboard quarter and its
mast stands 0.8 m ahead of her, so a view that sees her side brings the sail in behind her; the landscape hold looks
from nearly astern of her, `lookDistance` 4.6, `lookHeight` 1.6, `lookBearing` 0.08, `lookToward` 0.66, `lookLookY`
2.6: her figure from hood to gunwale about 315 px of 900 at the frame's right (was cut by the bottom edge), the eye
about 245 px across, the mast at the right edge. Phone `look` 3.8 back, 2.1 up, turn −0.42, lookY 2.5, toward 0.5:
her seated in the boat (about 180 px hood to gunwale of 932), its eye above her, the mast just past the right edge.
Her light (`Traveller.lent`, a per-frame vector the story lends and the traveller lets go after each frame; `uLent` in
the child's shader, so nothing changes where it is not lent): the sun along her outline where it turns toward it, the
lantern wrapped round her face and side, a lift in her shade; `lookLight` [2.2, 2.5, 0.6], `farewellLight`
[1.5, 0, 0.3], eased at `lightEase` 1 a second. Her reach to its eye is `lookReach` (unchanged values). The farewell:
landscape `farewellDistance` 21, `farewellHeight` 1.2, `farewellBearing` 0.3, `farewellLookY` 16 (was 17/1.8/0.6/19):
the boat whole on the water about 75 px above the bottom edge, the flukes' tips inside the top, the sun between the
stock and the sail. As it dives her seat turns to where it goes down (`turnToward(at)`), she goes along the thwart to
the port rail (`farewellSlide` 0.35 at `farewellRailEase` 0.8) and, while it flukes, holds a mitten out at her side
waving slowly (`waveGoodbye`, `goodbyeWave` [0.55 out, 0.12 up, 0.15 sway, 4.5 rad/s]), so it shows beside her hood
against the sun's glow rather than in front of the sail. Phone `farewell` 22 back, 1.2 up, turn −0.6, lookY 24,
toward 0.25 (was 40/2/−0.5/26/0.6): she is about 70 px seat to hood (was about 38 by the same measure), the flukes
tower past the frame's left edge, the sun between the stock and the boat. `Shot.authored` (`camera.ts`,
`camera-direction.ts`): a story that frames a view itself lets any turn the lens chose earlier ease out and has no new
one chosen; the encounter sets it while its hold has any weight, so the full play and a resumed save now frame the same
(headless: offset 0 through the look and the farewell either way; it was 0.18 rad in a full play). The child is
unchanged elsewhere (the dark wood and the meadow, stills before and after). Camera on the recordings (full play with
gestures): through the look worst 1.6 m/s² landscape, 2.7 portrait; free to the hand-back's end worst 2.3 landscape,
4.6 portrait, in the hand-back's swing as the boat comes about (N3l: 1.95, 4.5). `net-whale-check` all 11 cases pass
(`fin` clearance 1.61 m, `finidle` 1.65, `full` 1.5); played (`full`): rest 88.6, breath 111.4, line 144.5, flipper
167.2, free 173.3, gone 206.5, moored 232.9. Idle, moored about 496 (pacing `calm` arrivalReady 496.4).
Left:
- In landscape her face stays inside her hood and the hood is most of her figure; her mitten held out to its eye
  never shows from behind (the arm folds back beside her hood).
- The mast stands at the landscape look's right edge and shows there as the boat rolls; her bag is near that edge.
- The goodbye mitten never rises above her face: a reach above face height stops level with it (the child's arm,
  cause not found), so her goodbye is a small mitten swinging at her side, about 30 px out in landscape and 15 on a phone.
- On a phone the left fluke is cut by the frame's edge through the farewell.
- In 2 of 5 full plays with real gestures (both of the first two recordings) the look's camera dropped to its 1 m
  clearance about 4.7 s into the first breath and swung through the boat at about 20 m/s; three later plays and every
  resumed one were smooth, and the logged state was the same (`/tmp/updraft-seawhale-n3n-glitch-full-*`).

Claude's judgement, 2026-10-09, from the stills and a full play of the merged sea: lit, she is a child in a yellow
coat rather than a dark lump, and the phone's look holds her seated under the eye. The farewell in landscape is the
encounter's image now, the boat whole under the flukes and the sun between the stock and the sail. The landscape look
is not yet the owl's: her hood fills the right corner, cut by the frame, and her reaching mitten never shows. The
intermittent drop of the lens through the boat in the look must not reach Jeremy.

### Phase N3o: the breath seen, the spout white
After N3l and N3m merged on `sea-whale`; in parallel with N3n. Each breath's water seen as water: sheets of the sea
pouring off the ridge and down the flanks in broad glinting falls that thin to threads and drops at the waterline,
never thin lines like scars or wires; the crest seen on the water as a low ring of swell going out and lifting the
boat. The free spout white mist lit gold on its sun side and soft grey-blue on its shadow side, as the first column,
never a grey pillar. And the pod's featured leap kept in frame: at the check's seed 147 on the merge, the 30 fps,
gust 20, circling case, a dolphin surfaces about 13 m from the lens below the bottom edge during the approach (the
seed only exposes it; the player would see a leap cut by the frame's edge). Owns the whale's wet terms in
`whaleShader.ts`, the breath's shedding in `sleeper.ts`, `spray.ts`, the heave in `swell.ts`, the leap's placement
in `dolphin.ts`, their tuning.
Gate: as N3g's.
Done: [x] `d47c32ab..a064fec3` on `sea-whale-life`, docs in the commit after. The water (`whaleShader.ts`): the threads
(`rills`) are gone; each breath's sea pours off as `falls()`: broad lanes along the body about 2.5 m apart that
wander as they run down, covering more as there is more water (`sheetWet` 0.8 times the breath's depth, up to 1),
streaming with the dawn they mirror (gold where they pour over the ridge toward the sun, `falls` 0.8 of the skin
they cover at most, the skin showing through but where they run full), with gold glints (`glints` 2); below about
2.4 m they part into threads, and as they drain they narrow to their middles and go. Their front (`uPour`) comes down
from `pourFrom` 6.5 m above the sea at `pourSpeed` 1.2 m/s gathering `pourFall` 1.6 m/s², reaching the waterline
about 2.2 s after the shed; they drain over `sheetFor` 5.5 s; where they reach the sea, white churn on the skin.
The span shed is s 0.08 to 0.86 (was 0.15 to 0.8). The head bared at the haul streams with the same falls, already
come down (`uPour.y`). `sleeper.ts`: from 1.3 to 5 s after a shed, `pourDrops` 260 drops a second times its depth run
off the flank just over the waterline (three in four on the near side), and the lace runs with them, never laid
within 2.8 m of the near flipper's blade (over it, it drew white threads across the blade). The ring (`swell.ts`):
`heaveHeight` 0.55 m times depth at the flank, out at `heaveSpeed` 2.6 m/s, `heaveWidth` 2.2 m from crest to side
there, broadening by `heaveSpread` 0.3 of each metre over its first 12 m, lower by half `heaveReach` 8 m out, with a
shallow trough behind (0.35), settled by `heaveFor` 8 s and cut off a little way either side so the far sea is
exactly as it was; the breath before keeps its ring going (`uHeaveBefore`), so a new breath never cuts one off
under the boat. The water shader takes the ring's height (`vHeave`) and lights its crest through toward the low sun
(`heaveGlow` 2.5). Measured at the line's hold after a waking breath: the boat rises about 0.21 m more, its worst
vertical acceleration 0.48 m/s² (0.47 with no ring; N3m's 0.58). The mist (`spray.ts`, `mistLook`): the first column
and the spout are lit as a painter lights a backlit plume, from the side the sun lies on in the frame, in shares of
the sky's brightness behind them: `shade` 1 grey-blue on the far side, `white` 2.1 (`spoutWhite` 0.3 more) warm white
on the sun's side with `gold` 0.4 of the low sun's glow, and `through` 0.9 glowing through thin edges toward it. The
spout's puffs are firmer at their lumpy edge, so its crown billows, and fray into wisps as they thin; `spoutHeight`
10 (was 15) and its crown's puffs grow slower, so its crown, about 14 m over the blowhole at most, stays in the
release frame (landscape: at least 33 px under the top, at about 11 s free; portrait about 208 px). The leap
(`dolphin.ts`): the throw is asked only once the leaper is within `leapMarkNear` 1.5 m of its mark beside the boat;
at seed 147 the leaper had set out 40 m astern and threw 9 m astern, 13 m from the lens (featured leap edge now 0.53
in that case, was 1.21). Seed 149 then exposed a softlock: the pod's nudge never landed (the boat had slowed for the
whale and a dolphin ahead of it cannot drop back), so the whale was never led and the cygnet stayed in her arms at
the flipper; `crossing.ts` now counts the whale as led once its step is past the approach. Gates: typecheck, build;
`net-whale-check` all 11 cases (`fin` clearance 1.61 m, `finidle` 1.7, `full` 1.5); `sea-logic-check` at seeds 147 to
158; pacing `toMirror` (whale brake 0.41 to 0.55 m/s², as before). Played (`full`): rest 88.8, line 111.6, flipper
144.5, free 167.2, spout 173.3, gone 206.4, moored 233.0; idle moored about 497 (pacing `calm` arrivalReady 496.5).
Left:
- The ring reads in motion as a soft warm band going out and the boat lifting, not as a crisp ring on the water.
- A deep breath in the bird's hold lays a broad bright curtain along the back for about three seconds, behind the
  cygnet swimming to the loop.
- A lone narrow fall can read as a single bright streak in a still; the pale scars still read as scratches.
- The spout is no taller in its frame than the first column at rest, whose crown still leaves the top of the rest frame.
- Thinning (from about 10 s free) the plume reads as a soft round cloud more than wisps.
- In the played portrait release the plume stands behind the sail as it rises and drifts to the right edge, its right
  side cut (the release hold's framing, unchanged).
- Thin white curved strokes show near the loop's end by the cygnet and the flipper's tip (not the lace; unidentified).

Claude's judgement, 2026-10-09, from the sheets and a full play of the merged sea: the breath now reads as water,
lilac-gold sheets over the ridge breaking into threads at the waterline, but every resting breath through the line and
the flipper lays the same bright curtain along the back, so it repeats and pulls the eye from the step at hand. The
spout is white and gold but swells into a round opaque ball like cotton wool, a cloud rather than a blow. The scars
read across the water as drawn chevrons. The leap kept in frame and the softlock found at seed 149 are both right.
The white curved strokes are the steps' drawn invitations (at the weak breath's still, the coax over the blowhole),
not an artifact.

### Phase N3q: her frame
After N3n and N3o merged on `sea-whale`; in parallel with N3r. The look's landscape frame made the owl's: her whole
seated figure smaller, three-quarter back, lit, the sail allowed behind her at the frame's edge but never between her
and the eye (the design's Camera bullet), her reaching mitten against its flank. The child's arm able to reach above
her face, so the reach to the eye and the goodbye wave rise as they should. And the intermittent drop of the lens in
the look found and fixed: in 2 of 5 full plays with real gestures, about 4.7 s into the first breath, the camera
fell to its 1 m floor and swung through the boat at about 20 m/s. Owns the look's holds in `net-whale.ts`, the lens
(`camera.ts`, `camera-direction.ts`), the child's arm, their tuning.
Gate: as N3g's, the look in at least five full plays with real gestures, landscape and portrait, none with a jolt.
Done: [x] `4010afe0..42c21d7d`. The jolt: the lens carries the boat's motion by taking up its speed
(`carried` in `camera.ts`), and took it up in one frame while shedding it no harder than `carryBrake` 9 m/s², so a hull
that dropped 0.155 m in one frame became a 9.3 m/s coast: the lens sank 1.7 m to its 1 m floor, and once its own eye was
under the water the occlusion test pulled it toward its gaze, through the boat at about 20 m/s. Both glitch runs'
drops began on the exact frames the whale laid a ring of swell (`rises`, 4.62 and 8.35 s into its first breath; the
4.62 ring comes only when the first breath interrupts a resting breath before its ring, about one play in two). Fixed
at the lens: `carryTake` 12 m/s², the hardest it takes up the speed of what carries it (above any boat gathering way
or child setting off), so a one-frame jump is left to the ease. Headless, a 0.155 m one-frame drop of the boat at 4.62 s
reproduces the glitch exactly before (lens worst 19.5 m/s, down to 1.00 m) and after is no different from no drop
(3.0 m/s, lowest 1.43 m). At the sea: each ring of swell now keeps the axis it went out on (`uHeaveAxisBefore`); a new
breath re-laid the older ring's axis, stepping the sea near the boat by up to 4.6 cm. The 15 cm step of the glitch
runs was not reproduced on this code: the largest step under the boat at any ring in the six plays below was 3 mm.
Six full plays with real gestures (three landscape, three portrait; three with the 4.62 ring), none with a jolt;
through the look (first breath to 2 s into the line, 0.25 s velocity windows) landscape worst 1.5 m/s and 0.8 m/s²,
lowest 2.1 m; portrait 4.8 m/s and 2.7 m/s², lowest 2.3 m. The 0.5 m one-frame jump as the look handed over to the
line (her face outside the frame's safety margin) is gone with the new frame. Free to the crossing's end is as on
N3n (landscape 4.8 m/s², portrait 6.2, same measure on N3n's plays 4.7 and 6.3). The child's arm: her shoulder sits
about 0.5 m below her face and the reach IK (`motion.reach`) left the collarbone down, so any target above her face
stopped level with it; now a reach above the shoulder lifts the collarbone as a posed raised arm does (`SHRUG` 0.45),
and the mitten tops out about 0.2 m above her face (was 0.09). The look: she was turned 0.95, 52° past its eye (she
sits a little turned to port already), so from behind her mitten folded across her face; now `lookTurn` 0.05 faces
her to its eye, `lookLean` 0.35 (was 0.9) sits her up, and `lookReach` [0.5, 0.15, 0.4] holds her left mitten up and
out beside her hood. Landscape `lookDistance` 9.5, `lookHeight` 2, `lookBearing` 0.3, `lookToward` 0.32, `lookLookY`
2.7: the whole boat and her seated figure (about 250 px of 900, hood to seat) three-quarters from behind her left
shoulder at the frame's right third, the sail behind her at the right edge, its eye about 220 px across at the left
over clear water. Phone `look` 4.8 back, 2.2 up, turn −0.55, lookY 2.5, toward 0.28: her seated under its eye, the
mitten up beside her hood. The goodbye (`waveGoodbye`): the mitten on the side toward where it went down, held up and
out across the view (`goodbyeWave` [0.45 across, 0.45 up, 0.2 sway, 4.5 rad/s]), so it rises beside her hood; the
farewell frames unchanged. `cygnet-gates` 27 of 27 (before: 26, `stow turn` 0.101 over its 0.08, now 0.062; the rest
within 0.007). `net-whale-check` all 11 pass (`fin` clearance 1.6 m, `finidle` 1.69, `full` 1.5); played (`full`):
rest 88.8, breath 111.7, line 144.7, flipper 167.4, free 173.5, gone 206.6, moored 233.1. `sea-logic-check` passes at
seeds 147 and 148; pacing `calm` arrivalReady 508.6 (N3n 496.4).
Left:
- In the farewell her wave is about 30 px out from her face and 8 px above it in landscape, backlit against the sun:
  it reads in motion as a small mitten beside her hood, not a plain wave. Her arm cannot get above her hood's brim.
- In the look her face stays inside her hood from behind; the paper plane in her satchel stands up beside the cygnet
  as a white triangle by the sail, and on a phone it covers her right side.
- On a phone she is large in the look and cut by the frame's right edge (the plane and the boat's quarter).

Claude's judgement, 2026-10-09, from the stills of three full plays: the landscape look is the owl's frame now, her
small whole figure seated in the boat to one side, three-quarters from behind, the giant eye large across clear water
and the sail behind her; the jolt had a real cause (a one-frame dip of the boat copied as a fall) and is fixed at it.
`carryTake` changes how the lens rides the boat in every chapter, so the whole-game playthrough checks it. The
goodbye wave stays small, a mitten beside her hood; the white paper plane standing in her satchel is the frame's
loudest shape after the sail, on a phone beside her face.

### Phase N3r: the mist and the skin
After N3n and N3o merged on `sea-whale`; in parallel with N3q. The spout and the first column made a whale's blow,
a tall bushy column bursting up and widening, the sun through its thin parts, drifting and fraying (the design's
release); the breath's falls kept for the breaths that matter (its waking breath, its first full breath, the spout)
and only a soft sheen at a resting breath, never a curtain repeating over the step at hand; the scars faint and soft,
never chevrons. Owns `spray.ts`, the whale's skin and wet terms in `whaleShader.ts`, the breath's shedding in
`sleeper.ts`, their tuning.
Gate: as N3g's.
Done: [x] `90f282fa..65b43bb0` on `sea-whale-life`, docs in the commits after. The blow (`spray.ts`): the first column
and the spout are one kind of puff, `BLOW`, thrown by `blowOut(at, height, strength, dt, wide, glad)` (the old
`column`, `jet`, `spout` and the `SPOUT` kind are gone; the far sigh's `COLUMN` puffs are untouched). Its strength is
`blowing(t)` in `sleeper.ts`, all at once over 0.15 s then easing off over `blow.exhale` 0.6 s, from `BREATH_IN` for the
first column and `SPOUT_FROM` for the spout (`SPOUT_FROM`, `SPOUT_TO` and the sounds are as they were). `blow.puffs` 66
puffs a second for each metre of its height at its hardest, each thrown up into air that slows it `blow.drag` 2.6 a
second, so it reaches its height in about a second, and out the further the higher it goes, so the column is
`blow.stem` 0.35 m in radius at the blowhole and flares `blow.flare` 0.2 m a metre, by the 1.4 power of its height
share, into a bushy top; the edge falls short and some puffs overshoot, so the top is domed and ragged. Each
puff swells (`blow.swell` 2.4 a second) toward 0.35 to 0.6 of the column's radius there and 0.2 m more and keeps spreading
(`blow.spread` 0.25 m/s); bursting up, it is drawn out along its flight (up to 2.5 times), so the blow reads as thrown;
it hangs clear of the breeze 0.6 to 2 s (the top longest), then drifts on the wind, its top torn apart at up to
`blow.tear` 0.8 m/s and each puff drawn out sideways by `blow.torn` 0.8 of its size over its life; `blow.opacity` 0.2 at
most, thinning by the power `blow.thinning` 0.9 of its life left over `blow.life` 7 s for the top (the low parts go
sooner, the spout's last a fifth longer). The shader lights it as one column, never puff by puff: its side is where it
was thrown and how far out, its core facing the eye, a little of each clump's own lumps; the puff a small soft clump
with a lumpy edge torn into wisps as it ages, its thin parts glowing toward the low sun (`mistLook.blowThrough` 1.8)
and partly additive. `firstBreathHeight` 10 (was 13), `spoutHeight` 13.5 (was 10), `spoutBreadth` 1.2. Measured: the
first column's crown about 8.7 to 9.4 m over the blowhole, 65 to 86 px under the top of the landscape breath frame
(portrait 269); the spout's 12.3 to 13.5 m, 58 to 70 px under the top in the landscape release frame (portrait 216
to 239), at full height within a second of the blow, its top torn and drifting from about 3 s after it, thin by
about 5 and gone by about 7 (before the dive at 15.5). The falls (`sleeper.ts`, `whaleShader.ts`): `rises(deep,
falls)`, falls 1 only for the first full breath and the spout; `uPour` is now a `Vector3`, its `z` how much of the
breath pours in falls. `falls()` takes `full`: at 0 a breath runs off as a faint sheen streaming down the whole skin
behind the same front (`sheen` 0.28 of a fall's cover, broad, the falls' streaming in it, no glints), at 1 the falls
as N3o built them; the head bared at the haul still streams in falls. At such a breath the lace and the drops at the
waterline are `sheenShed` 0.3 of a fall's. The scars (`whaleShader.ts`): `scarIn` is a soft pale smear along the body
(slant at most about 14°, its width 0.2 to 0.32 m falling off as a Gaussian across it and at its ends), no shade line
under it, `scarAmount` 0.45 (was 0.65); it comes in over `scarSeen` 1.5 to 4.5 px across a 0.26 m mark, so it is only
there close enough to read as skin. Gates: typecheck, build; `net-whale-check` all 11 cases (`fin` clearance 1.6 m,
`finidle` 1.7, `full` 1.5; played `full`: rest 88.7, breath 111.5, line 144.5, flipper 167.4, free 173.2, gone 206.4,
moored 232.9); `sea-logic-check` at the default seed and 148 to 150; pacing `toMirror` (whale brake 0.41 to 0.56 m/s²,
`calm` arrivalReady 496.55).
Left:
- Thinning, for about a second before its top tears (about 2.5 s after the blow) the spout's crown can read as a soft
  rounded mass over a thin stem, translucent rather than wool.
- From the release hold the low sun lies almost behind the spout, so its grey-blue shade side is faint; it reads
  mostly white with a warm sun side.
- The first column's base stands among the net patch's corks on the domed mesh, which show as dark balls inside it.
- The seabirds' flight beside the spout now passes over its torn top as it thins (it drifts toward their side).
- The scars are faint enough that at the bird's hold only two or three soft smears show on the near flank.
- The resting breath's sheen shows as fine bright vertical streaks in a still, the falls' streaming in it.

Claude's judgement, 2026-10-09, from the sheets and stills: the blow is a whale's now, a narrow stem bursting up and
bushing out, torn into glowing wisps toward the sun, in the family of the stairs' clouds; a breath through the steps
is a faint sheen and the eye stays on the step; the scars no longer read from across the water.

### Phase N3p: the playable build
After N3q and N3r merged. Claude plays the whole open sea beside the clouds and the owl, folds what that turns up
into the docs and fixes it, and the playable build goes to Jeremy.
Done: [ ]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's chapter-select still regenerated with the whale (from the game, not Astra: Jeremy, 2026-10-08, "don't use astra anymore"); the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
