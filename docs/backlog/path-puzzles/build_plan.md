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
Done: [ ]

### Phase N3h: the release and the farewell
After N3g. The river-spirit moment: it breathes free, the plume's mist drifting down over the boat in the gold light,
its call turning glad, the sea brightening round it, the net let go sinking away into the deep, the pod's leaps, her
wave and the bird's call, the score's one bloom; then the dive (head down, the back arching forward and sliding under,
the flukes rising once with their pale pattern and slipping under, never a roll), the swell lifting the boat, and the
sea stilling toward the mirror. Owns the free and gone steps in `net-whale.ts` and `sleeper.ts`, the net's sinking,
the spout's mist, the sounds and score there.
Gate: as N3g's.
Done: [ ]

### Phase N3i: the ancient skin and its life
After N3h. Owns the skin (`whaleShader.ts`, `tuning.whaleLook`): barnacle crusts, healed scars, mottling, growth at the
waterline, wet streaks, the eye's age, drawn as bold simple painted shapes like the rest of the game; water sheeting
off the back with each breath; the seabirds on its back.
Gate: as N3g's, then the playable build for Jeremy.
Done: [ ]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's chapter-select still regenerated with the whale (from the game, not Astra: Jeremy, 2026-10-08, "don't use astra anymore"); the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
