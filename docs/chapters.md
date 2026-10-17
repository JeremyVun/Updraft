# The chapters

One section per room, in journey order: how it plays, why, Jeremy's standing rulings for it ("Rulings", each traced to
his words), the design rules it keeps ("Rules"), where its code and knobs live, and what is still open. The vision and the story of the whole journey are in `docs/journey.md`; where
the islands are and how long the crossings take is in `docs/contracts/world.md`; wind behaviour per room is in
`docs/contracts/wind.md`; the look is in `docs/styles.md`.

## How the chapters fit together

`story/journey.ts` runs the order (`ORDER`):
island → toLines → lines → toBoats → boats → toMeadow → meadow → toBirches → birches → toStairs → stairs → drowned →
wood → toSleeping → sleeping → toMirror → mirror → toHarbour → home. Every `to*` chapter is a `CrossingChapter`
(`story/crossing.ts`) given a route (`ROUTES`), a haze, the time of day and season it eases to, its music, and
optionally a look back, a whale, dolphins and the cygnet's swim. Most arrivals are watched from behind and above the
boat; a few have their own view (`ArrivalView`, `tuning.crossingCamera.arrivals`), easing in over the last stretch
of the route and ending where the room's own first view stands: low beside the hull along the waterline as the
meadow's bank rises over it, high and wide over the little boats' pools and spit. Two sails reveal their island first
(`IslandReveal`), anchored in the world rather than on the hull. As the birches come out of their mist, about
halfway over, the lens swings round from astern in one slow move to the port side, low over the water, and holds the
whole island with the low sun over it and the boat at a third (in portrait
further round, the island standing behind the boat), the child looking at it; Red Door comes in 3 s into the swing. As the
bow runs in, the lens rises into the birches' first view from the south, so landing needs no swing. Jeremy: "It just
stays behind the child and never does a cinematic reveal of the birches island until she gets off the boat." On the
birches' sail the stairs lie in their own mist until about 80 m out; from halfway over the lens turns in one slow arc
and lifts to the stair as it emerges, climbing from the knoll into the cloud beside the boat (in portrait behind it),
then comes round low onto the beach into the stairs' first view. The boat sails out from the birches' beach before
turning, never along its shore. The drowned village is its own crossing: it carries the boat from the stairs through
the storm to the wood's beach. `toWood` and `toHome` exist only to resume old saves.

`?chapter=<name>` starts a room directly (the list and aliases are in the project instructions, plus `piano`,
`stairs`/`clouds`); every start past the first island puts the cygnet with the child. The chapter select
(`src/chapter-select/`, offered after finishing) lists each room with a still.

Rules every room keeps:

- **The departure kite marks the boat.** The same ruled-paper diamond with a faded red foot and a bow tail flies
  beside the boat at every departure, and never at an arrival beach or at home (`story/departure-kites.ts`,
  `Chapter.departureKite`, `world/kite.ts`). Jeremy: "the player learns to look for the kite flying in the sky as
  the location of the boat." It answers the wind but is never a puzzle.
- **Crossings show only the two rooms they join**, and the next island stays hidden in haze or island mist until
  the approach (`world/journey-rooms.ts`; see `docs/contracts/world.md`).
- **Invitations show a gesture and never perform it.** A waiting interaction shows its wind invitation after a
  few idle seconds; nothing is solved by a timer or by the ambient breeze. The one exception is a safety valve
  where a child could otherwise be stranded (each of the drowned village's steps gets on by itself after about 90 s).
- **Dream echoes.** One thing from the room before has washed up on the arrival beaches of the little boats (a
  pegged pillowcase), the meadow (the bath's rubber duck, grey until the piano wakes it), the birches (a run of piano
  keys) and the stairs (the swing's seat) (`world/echoes.ts`): scenery only, above the tide line and off the walk; the
  camera never turns to it, and home has none. On the stairs island a handful of the birches' gold came too
  (`world/echo-leaves.ts`): a drift banked on the seat's landward side, thinning along the sand at the grass's foot,
  a few caught on the first steps; baked and still, one draw, lit by the stairs' light. It is "things recur in the
  wrong place" from `docs/journey.md`.
- **Landing and leaving.** On a beach the boat runs up the sand and the child sits a moment before stepping out
  (`Traveller.stepAshore`); at a jetty they step up onto the boards (`Traveller.alight`). See `docs/boat.md`.
- **No reward phrase.** Each room's recording carries its conclusions (the meadow's flute finale, the whale's
  release in the sea's recording); the stairs' last flight is marked only by its knock. Smaller steps keep
  their own small, physical responses.

## The still island

Late autumn, grey, no wind. `story/island.ts`; the default start.

The child sits on the south beach with the paper plane on her lap; the boat is in the south-east cove in the first
frame. Before the first breeze, a gust invitation is drawn across the held plane from bottom right to top left, so
the natural stroke blows it inland into the grass (`PlaneInvitation`, `tuning.opening.planeInvite*`,
`planeInviteRise`); whenever the plane comes to rest on the grass during catch, a level sweep is drawn across it
toward where it should go. Colour returns wherever the wind goes, and the plane plants lasting colour under it for
as long as it travels (`tuning.opening.planeBloomFrom`, `LifeField.bloom`). Most of the child's throws go along the
greyest line of grass around her, with a little wobble (`throwGreyChance`, `throwGreyWobble`); throws stay in the
southern half and are turned back before the ridge, so play never goes out of sight. When 65% of the island is alive it is restored:
the rest follows and the held-back warmth of the whole frame is released at once.

The plane then leads the child up beside the tree for the fall:

1. The camera rounds the eastern side during the climb and holds an outlook across the slope for 3.5 s.
2. Eight adult swans and the cygnet cross toward the north, setting the direction the boat will follow. The cygnet
   holds the last station of the V, beating faster than the adults just to keep it. Music pulls back.
3. **What brings it down is a winter gust**: white streaks rise off the slope, lift a plume of petals and sweep
   through the V left to right. The adults heel and ride it; it lifts the smallest, rolls it over and carries it out of the V, and that is the fall. Its
   left wing is bent back in the tumble (the wing the child bandages). It fights all the way down to a landing
   ahead along the flock's bearing (`tuning.opening.gustAt`, `gustRun`, `gustLift`, `gustShove`, `gustSpeed`,
   `gustPush`, `tumbleFor`).
4. It lands on the near slope; the descending phrase falls into the low register, a low D sounds on touchdown.
5. In the grass it tries to get up and calls; three small cream strokes mark each call (`fx/call-marks.ts`,
   `tuning.cygnetCalls`).
6. The child waits, runs, slows for the last steps, kneels and offers her hands; it hops up into them. She winds a
   linen wrap round its wing (`Carry.gatherUp(..., true)`, `creatures/cygnet/bandage.ts`) and carries it to the boat.
7. The cove shelters the sail (`Boat.shelter`): it hangs in deep folds but answers the player's gusts. A small
   travelling gust brushes the cove as she pushes off, and the shelter releases once afloat
   (`tuning.opening.departureRate`).

Rulings: the fall has a visible cause, a gust that tumbles the cygnet, and the tumble is the start of the fall (it
does not fly on and then drop). Half lost in the grass is how a fledgling that cannot fly should look; where the child goes and stops is the
signal, not the bird's silhouette. Knobs: `tuning.opening`. Checks: `tools/opening-check.mjs`,
`opening-sail-check.mjs`, `wing-care-check.mjs`.

## The first crossing

The current music experiment starts `still_2.ogg` at source second 8 as she starts walking to the boat after bandaging,
then carries the same recording through departure and the first crossing. The plane stays secured on her satchel
from the tree sequence through boarding. Wind stays playable throughout, without changing the departure timing.
Earlier catch remains free. Gesture motifs end with the rescue;
earlier island motif starts are at least 4.5 seconds apart. Jeremy's verbatim brief and reversible controls are in
[the audio contract](contracts/audio.md).
The lowercase "updraft" title fades in after the look back, holds, and is gone before the whale (currently seconds
34–41 of the crossing, whale at 45). A horizontal wind front lifts the existing flowers with sparse windlines at 31–37 seconds. Its timing is in `tuning.opening.title` and `tuning.opening.crossing`.
Still and its departure route now lie 200 units farther south. The ordinary crossing takes about 117 seconds,
giving roughly 33 extra seconds after the later whale, at the same boat speed. This remains a listening experiment.
After the whale, the camera eases upward and back for six gulls, a bill-carried linen scrap and four loose sheets
that roll and fold on the wind. Lines begins around crossing second 99 as the shore emerges through a broader
horizon veil. The Still recording finishes about six seconds earlier.

`toLines`. The curve round the restored island: the camera looks back at it for the farewell (21 s) and turns
onward; a whale surfaces at 45 s and draws the camera over six seconds. The light stays clear for the farewell,
and through the whale’s dive. A broad horizon veil hides all distant scenery equally, keeping the view clear out to
205 units and fully concealed beyond 260, then blending to a 55–110 unit visibility range over crossing seconds
60–76 (`tuning.world.linesHorizon`).
Lines emerges shoreline first as the boat approaches; no island-shaped fog bank marks its location.
The ordinary distance haze remains (`linesCrossingHaze`, `linesHazeFrom`, `linesHazeTo`). About 117 s.
Lines' recording uses a twelve-second approach lead adjustment. The first whale’s dive sends out the shared physical
swell. From crossing second 69, two gulls pass, one carrying linen, followed by two loose handkerchiefs; a sparse
cry accompanies their closest pass. The loose cloth and bill-held corner use the existing cloth solver.
 This supersedes the earlier shorter crossing to give the new recording
and whale encounter more room. It holds leaving the cove, the island receding, the farewell and the whale.

## The island of lines

`story/lines.ts`, `world/lines.ts` (washing and cloth), `world/lines-layout.ts`, `world/lines-passage.ts` (the
curtains), `world/doorway.ts` and `world/door-shore.ts` (the door and the shore through it), `world/shore-pulley.ts`
(the pinwheel and pulley line on that shore), `world/kite.ts`, `world/pinwheels.ts`. `?chapter=washing`; `?chapter=door`
starts at the family's line, `?chapter=shore` just through the door. The rotary prototype adds
`world/lines-rotary.ts` and `world/rotary-washing.ts`; `?chapter=rotary` starts at it.
Its brief and visual decisions are in [the design](backlog/lines-rotary/design.md).

The first impossible fragment of home: somebody's washing with nobody there, and a child lost in it. Jeremy:
**overwhelmed, not vast**. Density is the lever, not area: a low whaleback (`tuning.world.linesDome`) packed with
washing along a winding alley, the camera beneath it near the child's height, washing dissolving wherever it
stands between the camera and the child.

The plane stays in the child's hand. Three curtains of washing hang across the path, giant sheets held by giant
pegs. Broad sweeps billow a sheet away through the gap, lifting its hem, which falls back when the air dies; small
sweeps add up, in any direction, and progress is never lost; only the waiting curtain takes the stroke aimed at it
on screen (`WashingCurtain.brush`). The first shows sideways invitation traces (`fx/washing-invitation.ts`). Every
strong sweep works a peg loose: it shivers on the line, then gives as the cloth falls back, pops off with a snap and
tumbles to the grass, where it stays. The cloth it held drops. The passage sheets are real cloth stepped on the CPU
(`world/cloth-sim.ts`): nothing holds them up but pegs and lines, so a sheet is always either pegged, hanging under
gravity from what is left, or lying where it fell.

- The first sheet loses the pegs at its right end one at a time and drops, hanging from its two left pegs in one
  long fold with its foot slumped on the grass; the way through is beside it on the right.
- The second, two panels, loses its pegs from the middle outward: each half drops to hang from its own post end and
  the way opens down the middle.
- The last loses both corners, so it sags from its middle pegs, and the final sweep pops those and tears it off
  the line. The breeze lifts it, swings it face on so it fills, and carries it up and over the next line
  (`SNAG_LINE`, which keeps a bare stretch for it) and down onto it; the line takes it wherever it has come down
  across it, and it hangs folded over the line, off the walk and out of the family's view. The view glances toward
  that line as it goes. Nothing pulls it along a set path: the breeze carries the whole sheet, and only its middle is
  drawn softly to where it will lie.

Pegs and fallen sheets stay as they are for the rest of the visit, and a checkpoint loads them already down. The
cygnet goes first and looks back for the child, through the way the fallen cloth has left (`WashingCurtain.way`,
chosen once the sheet has been down `passAfter`), and the child follows. Crossing arrivals stay earned if a gust
moves the waiting bird; reaching the gap counts even if the bird has already cleared its own walking target.

Between the second and third curtains stand two giant rotaries. Their placement is being revised against the
original organic washing field; the rectangular enclosures were rejected. Both start spread. The farther one's trailing sheet is hooked over a neighbouring
post: turning pulls it taut, and a local updraft lifts the hem free. Broad sweeps then align the bare halves of both
frames with the path. Each catches independently; neither runs back. The child and cygnet wait outside their swept
circles until both have settled, then walk through together.
Their sage and dusty blue linen carries narrow cream stripes. Only the three curtain challenges wear white with
red borders, so the two interactions read differently before the player touches them.

The original lane between curtains one and two is formed by loose, overlapping rows of varied washing. The later
path turns round a bend; the family must stay hidden until curtain three has been completed. That reveal is being
rechecked as the prototype's rejected cloth walls are removed. The northern
terrain extends 40 m beneath more washing, keeping the final clearing inland; the arrival heights are unchanged.

The last sheet opens on a clearing: one low line with a blue and a red adult garment and the small yellow jumper
between them, and the red door. The released breeze brings the sleeves together (blue
begins, red follows, yellow answers) and the door opens once they have nearly met. Through it is a separate shore
(`DOOR_SHORE`), drawn inside the opening. The child and the bird pass through, the camera follows and drifts round
to the boat, and the washing is gone.

The boat is not on the grass: it is moored out on the water, tied by its painter to a washing-line pulley (prototype,
branch `proto-lines-shore`). The loop of line runs from a wheel on a post on the bank out to a wheel on a piling
beside the boat, with spare pegs riding it, and a big two-tone pinwheel sits on the bank wheel's axle. The child
walks down to the water's edge below the post with the bird beside her and waits, watching the boat; while nothing
moves she looks out at it, reaches toward it and looks up at the pinwheel. The view holds still on the whole stage:
her, the pinwheel, the line and the boat. Only a sweep across the pinwheel on screen spins it (air spilling from
sweeps nearby turns it a little; the breeze only rocks it); the wheel turns with it, the line runs in, one way only,
and the boat follows its painter, surging when the painter tightens and gliding on when it slackens, slowed by the
water and stopped by the sand right beside her. Nothing runs back out, so any number of sweeps over any time add up.
After a few idle seconds a sweep is drawn across the pinwheel (`ShorePulleyRig`, never wind). Once the boat is in
she gives a small cheer, walks to it with the paper still in hand (no throw), lets go of the painter, gathers the
bird up and lets it climb into the satchel to board: the first time it rides there, and the bag's flap is thrown open
for the rest of the game. The departure kite is tied off on the piling. On a phone the view at the bank looks out
along the line, so the stage runs into the distance rather than across a narrow frame. Checkpoints follow the first and second curtains and the
threshold.

Rulings:
- Colour marks the family's line out from all the other washing, so it is not a needle in a haystack.
- The sleeves reach softly: fullness and small cuff movements, pegs holding; no pointed arms or inflated torso
  (a reaching gesture read as creepy).
- No automatic opening: an invitation, not a timeout.
- A sheet pegged by its top edge never stays up without something holding it: no sheet curled, streaming or
  flapping in mid air once the player's air is gone. Each passage opens a different physical way (Jeremy:
  "why not add variation and have both? We have three checkpoints").
- The door is the only way onward. Beyond it, open grass, the kite, the boat and (prototype) the pinwheel's pulley line
  and nothing else; the pulley knowingly relaxes this and the rule below that pinwheels stay with the washing.
- Lines may cross each other but never run near-parallel close together (`lineField` rejects them).

Rules: rich blue, warm red and the child's yellow belong only to the family; the rest of the laundry is pale linen,
the passage sheets share a red sewn hem, and the pinwheels stay outside the clearing. Daylight stays over the whole
island; pinwheels belong to this island only.

Knobs: `tuning.linesPassage`, `tuning.washing`, `tuning.family`, `tuning.linesToys`, `tuning.shorePulley`, `tuning.rotaryWashing`. Checks:
`tools/lines-check.mjs`, `lines-view-check.mjs` (both wind the boat in with sweeps across the pinwheel; `lines-check idle`
also proves waiting cannot), `rotary-washing-check.mjs` (idle, targeting, both directions and coasting),
`rotary-washing-browser-check.mjs` (real sweeps through the rotary, last curtain, family and door; `FULL=1` includes
the first two curtains, `TOUCH=1 W=390 H=844 REVERSE=1` checks portrait touch in the other direction).
`tools/lines-progression-check.mjs` exercises all three curtains with gusts during the bird's look back at 30–120 Hz.

## The little boats

`story/little-boats.ts`, `world/little-boats.ts` (toys, sails, wakes), `world/little-boats-drain.ts` (the shoal,
the bath, the plug, the pour and the rush), `world/little-boats-layout.ts` (the stream and how high the bath has
raised it, shared by terrain, water, fleet and walkers), `world/little-boats-bath.ts`,
`world/little-boats-spray.ts`. `?chapter=boats`.

Early, affectionate play: the introduction to putting wind into a sail before the drowned village needs it, and the
room that first teaches the updraft. Three pools joined by narrow streams run down to the departure beach. An
oversized enamel bathtub stands on the far bank of the second pool, and an oversized bath plug sits in the stream
mouth like a cork, its chain running up into the haze. Reeds stand in clumps along
the pools' banks, rooted into the shallows and swaying with the grass (`tuning.littleBoats.reeds`, `REEDS_GLSL` in
`world/grass.ts`): mostly on the far bank, only short low stretches on the near one, and never by the toy, on the
child's walk, where the cygnet hops in and out (`BOATS_POOLS`) or in the narrow runs where toys pass close to the
lip.

On the grass above the beach the child takes the cygnet out of the satchel and sets it down, and it walks up with
her. She notices a toy on a bare patch of the flat bank, back from the water (`toyBank`), kneels, lifts it in both
mittens (the hull rides the real mittens, `LittleBoats.afterChildPose`), carries it down the bank, kneels low by the
water (`putDownFrom`) and reaches down to set it on the water just off the bank (`putDownAt`, leaning `putDownLean`). The
sweep that shows how to fill its sail appears as the lens settles back from that close-up (the shared sweep's own
wait, with nothing added). The player fills its sail; then every toy answers the wind near it. Seven toys sail the stream; the child follows the
leading toy along the bank, hurrying while it sails away from her; the cygnet swims three sheltered stretches
beside the toys (quick kicks and glides, folded wings, spray: `swimPlay`) with dry-bank pauses, and the fleet waits
for the child (never leashed to the swimming bird).

**The way out to sea** is two steps of bathtime. Where the second pool narrows, the toys run aground on a line of
rocks across the run (the shoal, `barS`) and bunch against it, bows lifted. A gust of the island's own crosses the
bath toward the stream with a few wind lines and rocks it on its feet without spilling, after `nudgeFirst` s and
then every `nudgeEvery` s until the player pushes it, showing that it can go over and which way. A push across the
bath toward the stream tips it (a push the other way rocks it back); over the rim it pours a waterfall into the
pool, and once `pourNeeded` of it is in the pools have risen `riseHeight`, the rocks go under and a short surge
carries the fleet over. The fleet then waits against the plug. Gusts only rock it; circles drawn over it stand an
updraft on it (`updraftTarget`, the spiral `coax` after the usual wait) that lifts it in tugs, bubbles streaming
round its rim, keeping whatever it has worked loose, until it pops free and the chain hauls it up. The departure
kite waits caught on the plug's chain all along, its string snagged round the links just above the plug so it can
only strain low over the mouth on a few metres of line, the rest trailing over the water to its post on the bank
(`tuning.linesToys.snagTether`). The updraft that pulls the plug lets it go: it climbs off the chain and comes round
onto its own string over `freeFor` s. A whirl opens
where the plug sat and the risen pools rush out of the mouth, carrying the whole fleet out and round to the right into the
sea, where the toys sail on until out of view. The child and the
cygnet keep glancing at whatever is holding them, and the shot leans toward it while the fleet waits. Round the final
bend their own boat waits among the toys (the reveal), the freed kite flying over it. The paper
stays on the backpack throughout.

The boat reveal has no completion phrase (Jeremy, 2026-10-12). During boarding the island's half-strength breeze
eases to the crossing's full breeze, reaching it before the chapter changes so waves and shoreline foam do not
jump. Boarding animation and camera composition are unchanged.

How the toys move: a filled sail picks the hull up (`drive`) and still water takes speed away slowly (`drag`), so
a toy glides on after a stroke. Each toy has its own `pace`; the child's orange toy is quickest and sails the
centre lane, the others side lanes (`sideLane`, `outletLane`), so it can pass. A toy behind one it cannot pass
hands its gust on (`nudge`); carried toys drop the wind once ahead of the child's (`carryAhead`, `fleetLead`).
Sails read only real local wind (droop, fill, luff, boom swing, heel); the stream gives heading, not steering.

Rulings: the toys must move easily and glide: one relaxed stroke should carry a toy well (Jeremy set its drag and
top speed). The orange toy must not lag the fleet. The boats are not held back for the swimming cygnet; instead a
cygnet fallen behind the child hurries, its full walk on the dry banks and a faster swim in the pools
(`tuning.littleBoats.catchUp`, `swimCatchUp`), so it stays in the picture (Jeremy, 2026-09-29). The fleet
leaves the stream mouth for the open sea. Getting it there is a puzzle about how to help the little boats out onto
the open sea, with the giant plug and bath (2026-10-04): the island's gust only wobbles the bath and never spills
it, because a bath that tips and pours by itself makes no sense to a player; the plug needs an updraft and comes out
"very slightly easier" than first built.

Rules: no race, score, text or penalty, and time alone never completes it: only the player's push pours the bath and
only their updraft lifts the plug. The sails take wind from any direction; the bath is the one thing that cares,
because it tips the way it is pushed, and its hint is drawn that way. Keep the toy, the
travellers and the next stretch of water in frame together, in landscape and portrait. The stream is the same water
as the sea and merges into it.

Knobs: `tuning.littleBoats` (the way out from `barS` to `drainFor`, the island's gust `nudge*`). Checks:
`tools/little-boats-logic-check.mjs`, `little-boats-check.mjs` (`TOUCH=1`), `ONLY=boats node tools/progress-check.mjs`.
From a `play.mjs` eval step, `__game.story.current.skipTo(56)` starts just short of the shoal and `skipTo(86)`
before the plug.

## The meadow and the piano

`story/meadow.ts`, `story/piano.ts`, `world/piano.ts`, `world/piano-stroke.ts`, `fx/notetraces.ts`,
`fx/piano-wave.ts`, `world/music-growth.ts`, `world/pond.ts`, `world/fields.ts`, `world/harebells.ts`. `?chapter=meadow`, `?chapter=piano`.

The last warm afternoon of the year, and the island is asleep. The crossing hides it in haze
(`tuning.world.meadowCrossingHaze`) and lines up offshore with the hill path before turning in, so the boat lands
at the foot of the climb. A bank hides the meadow until the
child climbs it. Her steps leave a narrow, soft green trail on the climb and approach (`tuning.meadowLife`),
joining the patch of colour on the near knoll where a piano stands (`PLACE`, `tuning.piano.initialRadius`),
seen through a shallow saddle. The rest stays grey under the waiting region (`life.regions.waiting`,
`uWaiting`): the wind raises no life inside it, leaving the wider awakening to the piano.

**The piano is the key; music brings colour.** The plane leads the child to the piano, and a gust of the island's
own (not the player's: `tuning.piano.planeGust`, drawn as wind lines and heard as a gust) carries it ahead of her,
nose first, into the fork where the hollow wooden bough beside it splits into two pipes, and sticks there nose down
between them, tail up and a little askew, turned three-quarters to the lens so its fold reads (`tuning.windBough.planeAt`).
It is never quite still: it rocks about its nose and its tail and wing tips flutter, more when the player's wind or the
bough's own breath goes by (`planeTremble`). It stays in view until she gets up and it comes back out to her hand. She
sits; the piano is silent, and only her hands ever move its keys. The bough opens the duet
on the breeze, a recorded flute phrase; the child turns to listen. Its call finishes before the guide appears for the
player's reply: a simple shape to trace with a finger, drawn bold in a dark halo above the piano and centred across
the view, starting from a ringed end. Each phrase has its own: a sweep to the right, a sweep back to the left, an
arc, and a wave (`world/piano-stroke.ts`); the straight sweeps rise gently with her answer's melody
(`tuning.piano.guide*`). Whatever of it a finger or cursor passes close by is traced, at any speed and with a wobble,
and the drawn trace follows it; effort is
kept across strokes; traced far enough, it plays her recorded answer whole, at its own tempo, while her hands and
the dipping keys follow its onsets, and its last notes ring on in the room under the bough's next call. Stroke speed
changes nothing. With no answer begun `callAgainAfter` (25 s) after a
call, the bough says it once more, `callAgainDb` softer; after that only the guide invites, and nothing times out.
Each answer sends music out from the piano: note traces curl into the field planting colour, and a broad front with
loose eddies wakes the ground to
`tuning.piano.responseReach` (45, 85, 125). The fourth answer leads to a musical pause and the bough's longer
finale, whose arpeggio's arrival sends colour across the whole island; it is the reward, with no completion phrase.
The cuts are one table, `audio/meadow-cuts.ts`; `node tools/meadow-music-cuts.mjs` makes the files and measures
onsets, melody, tilts and the greening cue into `audio/meadow-cuts-measured.ts`, which `audio/meadow-duet.ts`
turns into calls, answers and the finale (sound in [audio](contracts/audio.md)). The front's shape is fixed and it
never takes colour back (`world/music-growth.ts`). After each answer the camera eases a step up and out from her and
stays there (`tuning.piano.steps`, each a share of the way from the playing view to the walk's view of her), and the
finale is the last and largest step: the flute plays it alone, the bough breathing a steady stream of traces out over the meadow as it goes
(`tuning.piano.finaleStream`), the cygnet listening from the satchel and looking
about as the colour pours out, while the camera opens the rest of the way to the
walk's view (about 15 m above her and 34 m back, 26 m over the ground below it; nearer than the walk's view before the
piano, `tuning.meadowPlane.cameraAwake*`) over `finaleEase` seconds, low
enough that grass, flowers and hills keep their detail. The final front crosses at `finaleSpeed`, pouring down off
her knoll across the slopes that face her, and the grey hold is released only once the front covers it. She walks
round the piano's far end from the bough (`Piano.wayRound`), never through it. Competing wind
sounds and chimes are hushed during the duet. A completed piano checkpoint resumes past it.

In the Meadow rework ([design](backlog/meadow-echoes/design.md)), the piano stands on a nearby rounded knoll
beyond the preserved shore bank. Its camera opens across the rolling hollow as colour returns. The child then
sets the cygnet down beside a low bed of flowers asleep in the grass: short, bowed and closed into buds. Where an
ordinary sweep passes over them on screen they rise, lift their heads and open wide, and the camera looks down on the
bed from close behind her so each sweep's track shows across it and the woken part spreads; about two passes wake a
flower, and the invitation only points at sleepers inside the lens. Once three quarters of the bed is up
the last sleepers rise with it and petals lift off the whole bed, and that is the end of it. They walk together to
seed heads farther through the fold, framed against the far slope. Sweeps only stir the heads; circling winds an
updraft (the spiral invitation shows it) whose column draws the down off them, round and up. Lifted down never
sinks back: unwound it hangs over the heads, and once it is all up the column carries it out over the top to drift
away over the island, away from the lens and off the pond's side. She stands and watches it go: the lens lifts its
gaze after the cloud and holds on it as it thins, keeping her and the cygnet at the foot of the frame, and comes back
to her as she walks on (`tuning.meadowEchoes.watch*`, `seedRest`). The lens comes down in front of the pair as they
walk on together toward it, the hill they came from behind them, and holds them there for a final listening pause
(`cameraListenBearing`): the real swan call comes from beyond the frame, the cygnet's head comes up and she turns
toward it, then gathers the cygnet into the satchel. She walks on past the lens, which turns after her and comes round
behind her as she starts down (`departure*`); the pond and the family come into the edge of the frame as she reaches
the crest, and once she stops there the lens turns from her onto the water (`tuning.crest.revealFor`). Neither play makes a note; ambient wind and idle time complete neither.
`world/meadow-echoes.ts`, `world/meadow-seeds.ts`, `story/meadow-song.ts`;
`?chapter=echoes` begins the encounter. `echoes-1` and `echoes-2` saves preserve completed play and the remaining
walk/listen; old piano and pond saves still load. The departure kite and the boat's move to the far shore wait until after the pond.

The walk goes on over the west rise and through a pass along `WAY` (`world/fields.ts`), the plane kept within
reach of the child (`tuning.meadowPlane`). A flock grazes across the way below the rise (`onTheWay` in `main.ts`); it parts round her as she
comes and bolts from a gust, like any flock, and nothing waits on it. Over the brow the ground falls to **the pond** (`POND`) on the open
north slope, with the cygnet's family resting on it, white on dark water. Like the sheep they sleep with the island: the pond is
grey and empty until the lullaby's colour reaches the hollow; they dissolve in only once she has stopped on the far
rise to listen, and only while the lens cannot see the water, off screen or behind ground (`MeadowChapter.seesPond`,
`SwanFlock.shown`), so no view from the piano to the seeds finds anything on the pond and they are simply there at the
crest; their
bugling is heard on the walk. The veil stands thick from here to the boat (`tuning.crest`). The cygnet hears them
first and the child stops on the rise to look. While she is still up there the family gets ready to go north on its
own: heads come up, wings are tried, and the raft turns and edges toward the far shore (`Flock.stir`). As she starts
down the slope toward them the nearest birds take fright (`tuning.crest.startleFrom`, `Flock.lift`'s startled path):
they paddle off, run across the water one after another, and climb away in a V. The camera is one committed shot from
the rise to the water (`tuning.crest.view*`, `edge*`): up behind her on the sunlit side, travelling with her, her
large in the foreground and the pond and the family below. When they go it turns its gaze up after them from where it
stands, no further than keeps her in frame, and lets the V fly out of the top of it (`gaze*`); it never backs away to
hold them and never goes round the pond. Over her last few metres to the water it eases round to her shoulder, so
that at the water her hands and the swimmer are beside her, not behind her. The cygnet calls after them from the
satchel as she goes down, and at the water she sets it down; it paddles out after them, looks out and turns on the water
watching them go. Then one white feather comes down out of the sky over the water beside it
(`MeadowChapter.dropFeather`, the room's own `Feather`), and it lets itself drift, watching it. A sweep toward the
cygnet carries it there, and the invitation shows which way after a few seconds; left alone, the cygnet paddles over
for it. It takes it in its bill and swims back to her waiting hands, and the feather goes down into the satchel with
it as she puts it away. The warm music that came in after the duet plays on through all of this, a little lower
while the family calls and flies, and up again for the feather (sound in [audio](contracts/audio.md)). Walking on,
a sun shower passes, and halfway through it the sun breaks out and a rainbow stands in the rain over the sea
ahead where the boat waits; the walk does not stop for it (`tuning.rainbow`). As she pushes off, the music goes on
to its own close and ends on the water before Birches' music comes in. Beside the walk down from the pond stands a
row of harebells taller than she is (`world/harebells.ts`). They make no sound: a stroke across a clump swings its bells,
and so does she or the plane brushing through one, and both of them look round at a bell swung near them. Like the pond,
they are grey until the lullaby reaches them. It is there to be found; nothing waits on it.

Rulings:
- The greening must be seen from where the player is: the camera is placed for it, and it never jerks in and out
  per answer ("I just want to make sure we don't make it nauseating").
- The family's departure reads as a painful missed connection, never as parents rejecting their young: they were
  already leaving, and her coming only sets the nearest off first (Jeremy, 2026-09-29). The camera never zooms out
  and pans round and back in for it ("it feels slightly unnatural"). No flight
  practice here: the wing is bandaged, the pond is a short swim back to the child's hands, and the first flight
  belongs to the sleeping island.
- The pond is far from the piano and the family leaves over falling ground and open water, never through a hill.
- The pond's encounter plays no reward chime.
- Walls: field boundaries are painted as dry-stone lines, and every one that crosses the route has a gateway
  exactly where the path goes (`GATE`, `WIDE_GATE` in `fields.ts`); see the standing rule in `docs/journey.md`.

Knobs: `tuning.piano`, `tuning.crest`, `tuning.meadowPlane`, `tuning.rainbow`, `tuning.meadowMusic`,
`tuning.world.meadowVeilFrom`/`To`.
Checks: `tools/piano-check.mjs`, `piano-logic-check.mjs`, `piano-frame-check.mjs`, `piano-growth-check.mjs`,
`meadow-route-check.mjs`, `meadow-plane-check.mjs`, `pond-view-check.mjs`, `meadow-duet-check.mjs`; renders
`meadow-duet-render.mjs` (the duet) and `meadow-bed-render.mjs` (the warm bed from the duet to Birches).

## The birches

`story/birches.ts`, `story/birches-play.ts`, `story/birches-squirrel.ts` (the hide-and-seek),
`story/birches-rounds.ts` (where it happens), `world/birches.ts`, `world/birches-layout.ts`, `world/birch-scarf.ts`,
`world/scarf-cloth.ts`, `fx/leaves.ts`, `fx/birch-canopy.ts`, `creatures/squirrel.ts`, `audio/birches-foley.ts`.
`?chapter=birches`.

Deep autumn, and the last carefree afternoon of the journey: one more romp in the leaves before bedtime on the stairs,
the drowned village and the dark wood. On the first island the player's wind brought colour back; here it takes the
last of the year away, and nothing avoids it, because every gesture is a gust. The canopy is gold tufts the wind takes
off tuft by tuft and never puts back; the leaf floor is a litter field the wind strips bare where it blows and drifts
downwind (`LitterField`), with heaps (`BIRCH_PILES`) and scuffed tracks. Haze is thick enough that the next room never
shows. An engaged player spends about 3½–4 minutes here.

**One corridor.** The walk is a single open ride from beach to beach, about 200 m, over a rise under the swing tree
and down into a hollow (`BIRCH_RISE`, `BIRCH_HOLLOW`). Every stop happens in the ride, never down a side path. The
island as first built is cut across its walk at three lines no feature straddles (`BIRCHES_CUTS`), and the bands are
pushed apart into gaps of new wood: A (16 m) between the fallen log and the first tangle, B (16 m) on the rise's lower
slope for round 2, C (24 m) in the hollow for round 3, the longest because that round is the biggest. Everything is
authored in the first-built island's band-local terms and placed with `birchesAt` / `birchesGap`, so each tangle, the
swing tree and the log keep their tuned shapes, each band keeps its ground, grass and trees, and only the open walk
between them grows: every round gets its own stretch of wood and its own frame, never one shared with a tangle. The
coast is drawn in and the outer wood thinned, so the island keeps its tree count. `BIRCHES_SHIFT` stands it west of
where it was first built, out over open sea about 120 m from the meadow, so the sail from the meadow's far shore and
the sail on to the stairs each take about 45 s (`docs/contracts/world.md`). On the meadow sail the island lies in its
own mist until the run-in.

After landing, the child looks up the ride, steps aside and sets the cygnet down (`carry.setDown`). Between stops it
plays on its own (`birches-play.ts`): hops to a heap, chases gusts, dives in and rummages (`delve`), shakes, and
follows when the child moves on. It never flies here; it is gathered up at the boat.

**The squirrel.** A red squirrel lives in the birches (`creatures/squirrel.ts`), drawn 3× life size so it reads beside
the cygnet, and the child and the cygnet play hide-and-seek with it all the way over the island, finding it the only
way the player can do anything: by blowing the heaps apart. Three rounds, of one, two and three heaps, sit between the
tangles, so the walk alternates between a precise gesture (a tangle) and loose, joyful gusting (a heap). Rounds gate
the walk as tangles do: the walk's next target is the next pending stop, tangle or round.

- **The meeting** (round 1, heap 0 against the fallen log, just short of gap A). The walking shot glances at it
  sitting up on the log with a nut. She comes up to the heap and stands looking while the round's frame eases in; it
  sees her, freezes and drops into the heap. One heap and an obvious tell, so the player learns the game without being
  told.
- **A round.** Each has its own frame, lower and closer than the walk, from the south-east quarter toward the low sun,
  so leaves thrown up are lit through (`ROUNDS[].frames`; portrait on a longer lens eased in by a spring). She walks
  round any heap in her way to her stand, turns there to face the heaps, body and head (round 2's far heap, round
  3's middle one, so she faces the three as a whole), kneels and peers, and turns her head to each heap the wind
  bursts. The right heap
  shivers every 2.5–4 s with a rustle; its tail tip is out half the time in round 1, a third in round 2 and a fifth in
  round 3; now and then it peeks. Wrong heaps never tell.
- **Heaps yield only to updrafts** (Jeremy, 2026-10-16). Every heap, the squirrel's and the free-play ones, stands
  against swipes: its top flutters and its loose leaves lift, and none of it goes. About two loops of circles over a
  heap take it in a whirl. A round's heaps stand against updrafts too until the squirrel is in.
- **Finding.** It is found when an updraft over its heap has taken enough leaves off its back that it shows, about two
  loops of circles; behind a trunk, by the updraft over it. A swipe over its heap only makes it peek, and a swipe or
  circles over another heap make it answer with its tail. A wrong heap bursts into gold under an updraft in round 2;
  in round 3 only its top whirls up and it stands, so there is always a heap left to leap into. Found, it bursts out
  in a spray of leaves, sits up and scolds her, bounds off and glances back once; she gets up and cheers, and the
  cygnet chases a few steps.
- **Where it hides follows the leaves as they are now.** The wind never puts a heap back, so on reaching a round it
  reads the live floor once (`AutumnBirches.depthAt`, one batched readback): a heap still `buryDepth` deep, else the
  deepest drift the round's lens shows, else round the bark of a heap's bank tree. Turned out before she arrives, it
  hides again. The round never breaks and never waits for leaves that are gone.
- **The cygnet seeks too,** looking into heaps of its own choosing, right about as often as chance. After 7 s without
  an updraft on the right heap, swiping or not, it goes to that heap's rim and peers in (the in-story hint). The drawn
  updraft turns over it after 4 s at the first heap, once the leaves of its dive are down, and after 6 s in round 2.
  Round 3 has none: the updraft is learned by then, and drawn over one heap of three it would give the hide away.
  Neither supplies wind.
- **Between rounds** it goes along authored ways over the ground, up and down bark and along the wool (`PATHS`), and
  waits in sight at each tangle without standing where the gesture or the lens needs to be: on the floor at the first
  loop's foot, on the broken birch's top while the coils rise round it, up the birch behind the slipped loop and the
  bow's own birch, on the swing tree's trunk under the limb (and on along the fallen birch's top once she is over). **Seeing it off:** before round 2 it dashes on ahead to hide
  (`dash`) as the first tangle's loop starts to lift, down the fork tree beside the loop and away east among the
  trunks, up the perch tree and down the wool beyond the rise. Freed before it has hidden, she and the cygnet watch it
  go, at least `seeOffFor` (2.5 s), and set off after it once it has come down to the leaves beyond the rise
  (`seeOffMost`, 7 s, at most), about 5.5 s after the loop is free. The lens stays in the tangle's frame and never
  follows it; the depth blur keeps it sharp. Out of her sight its dive barely stirs the leaves (`splash`), so no spray
  far up the ride marks the heap. Before round 3 it waits in plain view instead (the shuffle).
- **The leap.** After round 3 the cygnet dives into the deepest leaves left in the hollow that the lens shows, and the
  child takes a run and jumps in after it, landing on her seat in an explosion of backlit gold; she sits a moment and
  gets up. If the hollow has been blown bare she runs on through it toward the sun, kicking up what is left. From here
  the squirrel waits up a trunk at each stop.
- **The goodbye.** As the boat pushes off it has come down the beach after them and sits up at the water's edge beside
  the berth, watching them go (a glance). It is shown only on the island and its departure.

The round heaps (0 and 4–8) are raked mounds as steep as the leaves stand, the floor round each raked thin to bare
earth, lit by their own surface (in shade on the side away from the sun, the crest catching it) with a solid body
under the leaves that hides anything buried. A gust bursts them as any heap and nothing rebuilds them. The free-play
heaps 1–3 keep their swells. Bursts, dives and peeks throw the loose leaves; a heap the squirrel lives in can shiver
all afternoon and still hide it.

**The impossibly long red scarf** runs as one strip of wool from the arrival beach through the canopy to the boat,
tangled back and forth among the trees, with four tangles in order where the child waits: lift a loop off a fork (an
upward sweep), circle the coils up off a broken birch (updraft circles, the column anchored at the wrap, the swirl
invitation), draw a slipped loop sideways off the upturned limb of a fallen birch, then draw the bow outward off a low
limb. Partial progress holds; the breeze cannot solve them. Released lengths fall and settle as cloth (`ScarfCloth`).
Freed, the scarf draws along its length into the boat (`tuning.birches.scarf.gatherSeconds`) and becomes the red sail
for the rest of the voyage. Under the canopy a stroke's wind lands no further than the shot's distance plus a reach
(`pointerReach`; `docs/contracts/wind.md`), so strokes at the trees or circles round the wool never flatten the next
round's heaps.

**The swing over the fallen birch.** Just past the swing tree a birch has come down across the ride: its root plate
torn up on the west, its dead crown in a tangle on the east, standing birches at both ends, the bole too high to climb
and propped on the limbs it snapped under itself, so there is no way round, over or under it. The swing hangs from a
limb over it and is the way on, ridden once. She walks up to the bole, looks along it, and gets on; the player pumps it
with strokes along its arc exactly as in the drowned village (`SwingCrossing`, `tuning.crossings.swing` with
`tuning.birches.swing.ride`), and at the top of a forward swing that will carry her she lets go, flies over the bole and
lands on her feet in the leaves beyond with a laugh. If the player stops she waits on the swing, the drawn push along its
arc offered after 5 s. The squirrel watches from the swing tree's trunk and runs on along the bole's top ahead of them;
the cygnet flutters up onto the bole and hops down after her. Her walk, her fetching and the plane all keep to her side
of it (`southOfFallen`, the plane's `playEdge`).

**Music.** "The Red Door Opens" (`assets/music/red_door.ogg`) plays from the approach crossing through boarding and
loops only while they are on the island or its approach. On the sail it plays out its pass, fading early if it would
still be sounding within 10 s of the stairs song (`birches.ogg`, under the stairs' cloud), so sea, wind and the boat
come between the two songs. Timings: `docs/contracts/audio.md` "Birches".

Rulings: the leaves must not behave like grass; the room should be fun, and the cygnet's play is its own, not a
scripted beat. The scarf reads as tangled wool, not a ribbon; every support is physical (no knot floating in the air);
the wrapped trunk needs circling; the draw-in into the boat is unhurried. One corridor, never branched: "I do like the
look of how the birches island is set up already as sort of this one corridor instead of zig zag paths everywhere like
in the other chapters." The island's look is kept or lifted: "try to preserve or even uplift the aesthetics of the
island with the swirling leaves and the golden light etc." The sails from the meadow and to the stairs are
lengthened by distance alone: "the boat speed must be kept the same". After his first playtest the island moved out over
open sea: "The sail is like 5 seconds short... The crossing needs to be longer", then "holy hell just move the birches
out a bit. Don't touch the stairs chapter", and "It's ok if the distance between birches and stairs increases as well
e.g. if both become 40 seconds or whatever".

Rules: the squirrel hides, not the cygnet, so the dark wood's hiding-and-finding stays unspent. Nothing is lost or
failed, and no timer finds it. The child looks at the heaps and the squirrel, never at the camera. The child, the
cygnet and the squirrel stay whole and readable in every round frame, portrait and landscape.

Knobs: `tuning.birches` (`squirrel` the game, `strokeReach`, the heaps' `heap*`, `bury*` and `burst*`, `scarf`),
`tuning.squirrel` (the creature: scale and pace). Checks: `tools/squirrel-rounds-check.mjs` (real strokes and circles:
`right`, `updraft`, `wrong`, `answer`, `apart`, `random`, `shuffle`, `plans`, `stall`, `early`, `flat`, `free`,
`leap`, `bare`, `resume`, `frames`; dev server), `squirrel-check.mjs` (poses,
close stills, the room at round distance, motion contact and clips), `scarf-check.mjs` (`PHYSICS=1`, `NATURAL=1`),
`scarf-geometry-check.mjs`, `scarf-exact-check.mjs`, `birches-drift-check.mjs`, `birches-foley-check.mjs`. On the QA
stage, `play('squirrel:<action>')` (`story/squirrel-yard.ts`). Design record and Jeremy's brief:
[backlog/birches-uplift](backlog/birches-uplift/design.md).

## The stairs in the clouds

Between the birches and the drowned village: `toStairs` is about 45 s east over open sea, ending under a low cloud
deck at a small grassy island (`STAIRS_ISLE`). Everything about the room, including Jeremy's brief and the open work,
is in `docs/stairs.md`. `?chapter=stairs`. Not yet in the chapter select: Jeremy wants the sail over the cloud fixed
first, and it needs a still and a name.

## The drowned village

`story/drowned.ts` runs the room's beats; `story/drowned-cat.ts` (`StrandedCat`) the cat and the tub,
`story/drowned-run.ts` (`RoofRun`) her way over the roofs, `story/drowned-church.ts` (`ChurchArrival`) the refuge in
the belfry, the bell and the boat home. Where its pieces live in the world: `docs/contracts/world.md`. The design,
Jeremy's brief in his words and every ruling: `docs/backlog/path-puzzles/design.md`. `?chapter=drowned` starts where
the stairs set the boat down on the water (`DESCENT_END`); `roofs` on the ridge after the cat, `church` at the tower's
foot, `belfry` in the opening over the fog sea with the bell to ring, `storm` seated aboard at the nave.

A homeward-looking room about leaving the boat to save a frightened animal, then losing the one thing she brought.
About five to six minutes, nearly all of it the player's:

1. **The calm drift and the stranded cat.** Dusk among the drowned roofs, herons lifting off chimneys, the spire far
   ahead beside the lighthouse. A small tabby sits on a chimney pot of a cottage sunk to its ridge, pleading in short
   kitten mews. A wooden wash-tub floats nearby; strokes across it on screen push it (`WashTub`; under the low lens a
   stroke's own wind lands far beyond it, so the tub reads the stroke, `contracts/wind.md`), the cat comes down the
   slates and hops in, and strokes bring it to the boat, where the cat chirrups, jumps aboard and sits at the bow.
   The cygnet is wary of it. The lens watches from off the cottage's gable end so she and the cat face each other
   across the water. If the tub makes no progress for 90 s the air carries it there.
2. **The air dies** about 150 m in: the breeze eases to nothing, the water goes to glass, the sail hangs, and the
   becalmed boat coasts in until its stem rests against the slates of a small cottage (`STRAND`): a nudge, never
   on top of anything.
3. **The dark rises behind them**: a sea fog lying low on the water, rising on the horizon the way they came, its
   crest gold in the last sun, roofs fading into it one by one; it comes on and stops a little behind the boat. The
   cat watches it, flatter and flatter, yowls once and bolts up the roof and away over the roofs toward the church.
   She climbs out after it, the cygnet in her satchel and the paper plane in her hand. The cold breath that comes with
   the fog swings the untended boat off the slates, and it drifts away up the open water the way she goes.
4. **The run**, about 214 m of roofs, wall copings, a lean-to and small hops of her own in about two and a half
   minutes, the cat always a roof ahead going its own way over each gap (a railing top, a coping, a leap she could
   never make), the fog creeping along behind her and waiting a little behind her at each piece. Three pieces, each a
   verb the player already has:
   - **The tree (push):** a dead tree rotted at its roots in a walled garden, rocked by strokes to show which way it
     can fall; a few firm pushes the right way loosen it until it goes over the lane, and she walks its trunk with her
     arms out.
   - **The windmill (circle):** a small worn tower mill standing in the water to its shoulders with two sails left;
     circles round its hub turn it (the invitation is a flat spiral in the sails' plane), the sail eases level beside
     the roof edge she waits on, she walks onto its lower rail with a hand on the stock, and the turn lifts her to the
     high roof, where the church and the lighthouse come back into view. The wrong way only rocks it.
   - **The swing (pump):** a rope swing on the old tree on the drowned green, beside the garden cottage's gable end;
     strokes pump it the birches' way with no timing, and at the top of a forward swing she lets go onto the nave roof.
5. **The refuge.** She stands on the nave's ridge at the tower's foot. The cat leaps from the churchyard's railings
   onto the slates beside her and runs up the old ivy on the tower's west face into the belfry, and she climbs after
   it, hand over hand (`Climb`, the plane tucked in her coat from the ivy's foot until she is back in the boat), the
   fog coming over the nave below her and on round the tower until it stops just under the sills: the village a cold
   white sea, the spire and the lighthouse standing out of it. In the straw under the bell are the cat's kittens; it
   curls round them, and as she kneels in the opening one comes to her and mews up at her.
6. **The bell.** Strokes across the bell (`Bell`, seen through the other light) ring it; each ring rolls out over the
   fog's top (`BellWaves`) and pushes it down a step, and out in the fog the lost boat's lantern answers, glowing
   nearer each time (`LanternGlow`), until after four the fog lies on the water and the boat is there under the
   tower's north side. Strokes across its red sail bring it round to the nave while she climbs down the ivy; she steps
   aboard, the cat comes to the sill with a kitten and looks down, she looks back up at it, and it gives her a slow
   blink. After 90 s with no ring the world's own gust rings the bell; with no progress under sail its air carries
   the boat in.
7. **The storm** begins as she turns from the cat, out of the goodbye's calm. They go out north of the nave past the
   lighthouse (`STORM_WAY`, 173 m to the beach) on the first air, the player's wind still filling the sail until the
   storm's comes up; the lens comes down off the cat's sill in one move to look along the water at the boat with the
   church and the lighthouse beyond. The dusk deepens into night, the first stars come out over the fog lying on the
   water, the sea roughens and the rain begins; the lighthouse's beam turns over the fog and the boat, its horn
   calls, and as they pass it its light fails and goes out in frame (30 s out) while the fog rises round the tower
   and closes round them into the storm's night, lightning once the dark is established, the cygnet startled at the
   light going and nuzzling under her chin, its shaking in the rain, the paper plane taken off her hand by a gust
   (55 s out) and carried off fast and low over the wood, and the landing on the forest beach about 78 s after
   casting off. The storm's night takes over from the fog's dark without lifting, and the fog thins off as the forest comes
   up out of it. The landing is relief that turns into the wood's fear.

Rulings:
- Coming down from the stairs, the stairs are never seen from the village (their room goes while the boat is still
  in the white): "we want to keep the illusion of having appeared out of the fog into the drowned village. By this
  point, the player has climbed the stairs and then went on a guided journey through teh clouds, emerging into the
  drowned village. In their mind, the stairs chapter is out of sight behind them."
- The dark comes on its own; the child goes after the cat, and the boat was never stuck: she left it to save the cat.
- The dark is a sea fog, beautiful and ominous, never horror: "yea that fog looks way better" than black smoke.
- Nothing needs fast reactions; holding on to the plane against the storm was rejected for that.
- Her way reads as a village she picks her way through, never "a single line of houses" or a corridor.
- The windmill is the third piece; "we dont need her climbing the lattice": she walks onto the sail.
- The storm starts at the boat and lands her at the forest without a stop: the landing is relief that is "actually
  the beginning of another scary journey".
- The village is a dream, "not too realistic": stylised character in the room painting's palette (charcoal slate,
  dark thatch, limewashed gables, brick pots), not pastel; windows dark so the lantern is the warm light.
- No little boats here. The storm becomes really dark and scary by the forest; the lighthouse is big, as a child
  would dream it; the plane flies away and is lost, never simply vanishes. The camera stays low near the water and
  never surveys the village from above.

Rules: cursor movement is the only verb (strokes push the tub, the tree, the swing and the sail and ring the bell;
circles turn the mill); each step has the drawn invitation after idle seconds and a safety valve after about 90 s;
the fog never reaches her and nothing fails; the camera never jerks, cuts only into and out of the belfry, and the
child never looks to it.

Saves (`docs/contracts/progress.md`): `sail` once the cat is aboard and the drift goes on, `roofs` at the run's start
on the ridge, `church` at the tower's foot, `belfry` in the opening with the bell to ring, `storm` seated aboard with
the look up and the storm to come.

Knobs: `tuning.drowned` (`cat`, `tub`, `dark`, `fog`, `adrift`, `run`, `church`), `tuning.crossings` (the tree, the swing,
the mill), `tuning.drownedCamera`, `tuning.storm`. Checks: `tools/drowned-run-check.mjs` (the whole room
with real gestures from the drift, `FROM=stairs|roofs|church|belfry|storm`, `LENS=1` for the lens's measures: on the
run a roof hiding her, her walking toward it, her out of frame; at the church her out of frame, hidden or lost in the
fog; it rings the bell, sails the boat home and reports the boat's distance after each ring),
`drowned-roofs-check.mjs`, `drowned-way-check.mjs`, `crossings-check.mjs`, `cat-check.mjs`, `mill-check.mjs`,
`drowned-fog-check.mjs`, `storm-check.mjs`, `boat-check.mjs`, `drowned-camera-check.mjs`, `drowned-gating-check.mjs`.

Open: the cat in the lit window of home's cottage at the very end ("the cat comes home").

## The dark wood

`story/wood.ts`, `world/wood.ts`, `fx/embers.ts`, `fx/ember-orb.ts`, `fx/ember-veils.ts`,
`fx/ember-invitation.ts`, `fx/fireflies.ts`; the bend `world/wood-shape.ts`, `creatures/owl.ts`. `?chapter=wood`;
`?chapter=fears` starts short of the bend.

The first winter storm, at night. **Care becomes courage:** the child first needs light for her own next step,
then uses it to help her companion, going into the dark first so it will not have to.

There is no grass to bend and nothing to throw, so the wind breathes on fire. Embers are abstract orbs of light: a
warm heart in translucent golden veils, small and dim at rest, opening and brightening as they wake. **Only the
player's updraft lights one**: circles drawn near the waiting coal on screen stand the column on it
(`WoodChapter.updraftTarget`, `input.anchor`) and `Embers.updraft` turns the charge into its breath; straight
strokes build none. Light grows while it wakes (`Embers.illumination`), but only a fully lit coal moves the story.
Burning coals flare with rising air; loose cinders answer any wind. The trees take
`tuning.wood.treePlayerSway` (0.6) of the player's wind over the breeze; the storm's push on them is unscaled. After a few idle seconds the waiting coal
shows the updraft spiral wound from the litter under it. The child walks for as long as there is light
(`tuning.wood.chainStep` between coals) and stops when it runs out; lit coals stay lit where they were earned.
She waits `tuning.wood.waitShort` short of an unlit coal. The walking camera stands behind her,
`tuning.wood.cameraSide` off her shoulder on whichever side of the path the waiting coal lies, easing across as
each new coal is laid, so the coal she waits for is always beside her in frame and never hidden behind her.

**The owl at the bend.** Walking up in the dark, the player sees only two glowing eyes ahead that blink and stare;
no stump, rock or shadow shows. The camera eases once into a held frame from off the path on her side, her in
profile at the left, and arrives as she stops at the coal before the bend, well short of the stump. Moonlight finds
her outline; she glances down at the cygnet once, never back toward the camera. When that coal catches, a huge
antlered outline with the eyes in it leaps up the rock behind the stump, thrown by the lit coal at her feet, and she
flinches back, mittens to her scarf. Only then is the one coal at the stump laid, off to the side. As it wakes its
light swings round: the antlers fold into a plain stump's shadow with a little round owl in its fork, and the owl
itself shows in the fork, which spreads square to her and to both camera views so each sees a Y with the owl in its
crook. After a beat the camera pans once, unhurried, round and a little down behind her shoulder to see the owl
face on as it blinks and tilts its head at her and she tips hers back, the rock's shadow still in frame
(`tuning.wood.shape.face*`; portrait has its own framing). It fluffs up and hoots softly, hops up off the fork and
flutters away low across the frame to her left, seen side on, before it climbs out above the crowns. She turns after it and waves, and the cygnet peeps up out of the satchel. She breathes out,
looks round the bend and walks on, never to the trunk, while the camera comes back round behind her the way she
came. Everything is in the same verbs: which coal, not a new mechanic.

**The fright.** In a cleared glade the camera settles, then one close lightning flash and clap, the clap a quarter
second after the flash (`tuning.wood.frightThunderDelay`; the bird flinches at the flash). The cygnet recoils, jumps up out of the satchel with a scramble of feathers, lands clear and runs into a shelter of
boulders under a tilted slab. Ambient lightning is suppressed for the whole chapter, so the fright has one cause,
and it cannot repeat. The camera turns to the entrance; only then is the ember inside it seen. The player winds an
updraft on it, revealing the frightened bird; the child crosses to a spot outside the rock, kneels and holds out a
still hand, and after a moment it walks out to her. No completion jingle. She carries on with it at her chest.

**The paper.** The last ember reveals the sodden plane caught in an exposed fork above her reach, rocking in the
branch's sway. Strokes across it (the sweep invitation) slip it along the fork, keeping progress between strokes;
idle wind never frees it. It flutters down beside her and stays on the ground (`Glider.layDown`). She settles the
cygnet into the satchel, picks up the paper, and walks out to the boat along the path's last bend. The wet
shading fades as she walks. No further ember.

Faint cold moonlight keeps trunks, ground and the travellers' outlines readable between embers; lightning is
subdued over land; small green-gold fireflies gather under the trees. Leaving, the crossing's lens rides the
course while the hull is brought round, and the wood's shade lifts over the crossing (`tuning.wood.shadeLift`).

Rulings: embers are abstract orbs of light after the approved study (`assets/art-direction/wood-ember.png`); no
literal fire, flame, coal, smoke, glass sphere or scattered chips. The forest is dark but never loses its sliver of
moonlight. Nothing lights, finds or frees on a timer. One scripted flash, not ambient weather, frightens the bird.
Framing, not erasing the player's earned light, directs attention. No drying mechanic ("too abstract for a
child"). The child is never left apparently stuck.

Knobs: `tuning.wood`, the bend's in `tuning.wood.shape`. Checks: `tools/wood-logic-check.mjs` (only the side
coal reveals the owl, it hoots once and leaves up and out from between the stump's limbs, clear of every trunk and
the rock), `wood-check.mjs`,
`wood-scene-check.mjs`, `ember-check.mjs`, `wood-floor-check.mjs`. The legacy `dry` checkpoint resumes after the paper.

## The sleeping island

`story/sleeping.ts`, `world/sleeping.ts` and its `sleeping-*.ts` modules (layout, trail, ribbon, weather, wind,
hearth, birches), `fx/feather.ts`. `?chapter=sleeping`. The world contract for this room (driven values, fog,
frost, dawn, the feather's calls) is in `docs/contracts/world.md`.

**The one room where the player leads the bird**, and the role reversal of the wood: here the bird brings light to
the child. Winter arrives, and with it the fear that the child might not wake. The emotional line: comfort,
unease, loneliness, hesitation, commitment, relief, tenderness. Island mist on the crossing hides the island and
its summit window until they land (`tuning.world.sleepingMist`).

1. **Bedtime.** A bed on an open grassy terrace, with a rug, floorboard fragments, a lamp, a small painted fireplace,
   an alarm clock, slippers, a book and a writing table. Fatigue shows on the walk (slow steps, a silent yawn,
   drooping lids). She warms her mittens at the hearth while the bird walks round the bed, then takes supported
   actions: set the bird down, turn, sit, nod awake once, legs up, head to the pillow, hands to the quilt and draw
   it up. The window, a warm seam in its curtains on a higher shoulder, is framed with the bed once before sleep.
2. **Cold.** Shortly after sleep, frost creeps in, breath shows, snow thickens with a crosswind, the hearth dies to
   embers and ash, the lamp contracts and the clock stops. The bird tries three times to wake her and calls once;
   nothing answers. A slit of window light touches the pillow, she stirs, and the cloth closes again.
3. **The feather.** A loose feather lies across the quilt over her, rising and falling as she breathes; a stroke
   across it frees it. Broad strokes send it ahead along the route, faster than it goes by itself, never back
   downhill, and it stays near the bird. Short wind wisps hint the way up a natural hillside.
4. **The climb: hesitation, loneliness, commitment.** The small bandaged bird, alone for the first time, climbs into
   the cold so the night grows bigger and it smaller, and it chooses to go on. About two minutes from the bed's edge
   to the summit with prompt input; snowfall thickens, the flakes turn from falling to driving and the night's wind
   rises with height (route progress, never a clock). The window shows from the bedside, is out of sight on the lower
   slopes, is found again from the top of the step, lost in the fog, brought back through it by the player and ahead
   on the crest; each return is a reveal, never a marker. Three looks back (over the horn after the drift, on top of
   the step, in the fog) find the bed further below and its lamp dimmer, framed by where the lens already stands.
   - *Lower slope (no input):* frosted tussocks, half-buried stones, sheep trods, a frozen trickle the bird hops by
     itself, and a bent hawthorn with a rabbit asleep in its form under it (background life: it never wakes on the
     climb; in the morning it washes its face and lopes off).
   - *The drift (strokes):* wind-carved snow packed in a notch between an outcrop and the drop, standing over the
     bird's head behind a chest-deep skirt. The bird wades in to its chest, struggles, backs out and shakes, then
     looks at the drift and the air over it. Strokes lift spindrift off it in streams that follow the stroke and take
     it down a layer at a time into a channel between rounded banks; prints stay in what is left.
   - *The step (circles):* a frost-heaved bank too high to hop. It tries, slides back and bows its head to its
     bandaged wing; circles round it make it rise on its toes beating only its good wing, and a loop and a half of
     real circling gets it over in a lopsided clamber that sheds a few feathers. On top it shakes, glances down at the
     lamp and walks on toward the window, 2.5 s from landing.
   - *The fog (strokes):* fog closes over the shoulder and takes the window and the sky; the bird shivers, calls once
     and only the wind answers; the fog thins downhill by itself to show the lamp far below; it turns uphill and the
     lens comes round with it. The player's strokes then part the fog uphill, the window glowing back through the
     lane, and the bird takes the feather into its bill.
   - *The crest (optional strokes):* above the fog sea, snow streaming sideways, the bird braced in small steps;
     strokes behind it are a tailwind. It is never blown back and never in danger. It lets the feather go at the
     summit.
5. **The ribbon.** The window stands on the crest; its curtains are tied with a ribbon whose loose end hangs beyond
   the lip over open air. A close three-quarter view shows feet on the edge, ribbon beyond, nothing beneath. A gust
   billows the cloth but the knot holds. The bird reaches, falls short, looks back at the child, and takes its
   bandage's loose end in its bill and unwinds it. The player's circles build air under it (softened by
   `twirlGain` only here); below the threshold it settles back. With enough lift it hops out, grips the ribbon in
   its beak and tugs the end through the knot, holding on until the curtains are visibly opening.
6. **Morning.** Having left the ledge, it glides home to the bed by itself, a few flaps on the way and buoyed a
   little by any lift the player gives it: a dip as the wing takes the load, then steadier; letting go is safe. The camera holds the opening window, then follows.
   Light runs down the hill to the bed, frost recedes, green follows the light and spreads over the island, the
   birches leaf, the clock rocks. The child wakes, and after a breath sits up and draws the bird into her lap.
   Then the kite appears and they leave into the sunrise the bird brought.

Rulings:
- The bed is not in a pit; the hillside is natural: no stamped route, golden path, rock rows, kerbs or inset
  shelf.
- The bird opens the curtains itself: release is the completed physical tug, never starting flight or waiting;
  wind alone cannot open the curtains.
- No voiced yawns or narration.
- Callbacks reuse familiar mechanics in this island's own setting (the snow notch recalls the scarf).
- No snow play after this island: the curtains opening is the greening moment that turns winter to spring.
- The climax is the bird flying out to pull the ribbon and gliding down to the bed; nothing on the climb competes
  with it. The player's wind only ever serves the way up: the fog is never cleared back downhill.
- The feather leads at a lively pace by itself (about 1.2 m/s); strokes send it faster, never back.
- Each stop waits for its gesture and never solves on time; wrong input is harmless. A gust or a shaky hand at the
  step only lifts the bird's hopes: it goes over only on circles wound round it (`stepWound`).
- Scripted holds stay short: the bank top 2.5 s from landing to walking on; the fog's wind counts from 5 s after it
  closes, and parting it takes a deliberate amount of stroking (`mistStroke`).
- The rabbit sleeps in a soft, slow tremble with slow breaths, never jerky bouts. The tall white line during the
  step's circles is the updraft's own wind effect.

Rules: the window stays above the skyline in the bedside view with a clear path for its light to the pillow. No
image of strangulation or helpless dangling; no crash or retry after the bird commits; nothing implying the child
has died. Morning uses the island's own winter palette, not the sunset played backwards.

Knobs: `tuning.sleeping`; the climb's stops are `SLEEP_DRIFT_STOP`, `SLEEP_STEP_STOP`, `SLEEP_FOG_STOP` and
`SLEEP_CREST_STOP` on `SLEEP_PATH`, its lens `CLIMB_LENS` keyed by distance up the route. Checks: `tools/sleeping-logic-check.mjs`, `sleeping-check.mjs` (`ADVERSARIAL=1`,
`TOUCH=1`; `SUMMIT=1` and `CLIMB=1` stage the ledge and the feather), `wing-care-check.mjs`. Checkpoints `feather`
and `morning`.

## The open sea

`toMirror`: `story/crossing.ts`, `story/net-whale.ts`, `fx/sealife/dolphin.ts`, `fx/sealife/sleeper.ts`,
`fx/sealife/net.ts`. `?chapter=sea` starts the passage; `?chapter=whale` starts at rest beside the whale.

The ancient whale is the past, burdened by an old net: freeing it puts the past right before the sky mirror puts
the future right. The boat leaves the sleeping island in the last of the night. Dolphins gather, ride the bow and
leap at first light. The featured leaper gathers speed on the camera's side and commits to a forward arc clear
of the hull; readiness uses its actual position and velocity, so it never leaps across the boat to reach a mark.
The cygnet climbs onto the side, decides to swim alongside the moving hull, and is lifted back
in to dry. The boat keeps an ordinary sailing pace for this play. A distant blow appears silently during
the swim; a faint silhouette gradually gains detail, with clear water around the boat. The first low call waits
until the bird has finished returning aboard and the whale is visibly emerging. The approach turns toward
the whale before it is visible, so the pod's travel agrees with that destination. As it emerges, the swimmer's
side view eases toward the boat-to-whale line, keeping the head visible in portrait as the bird returns aboard.
A dolphin nudges the planking and the pod leads them alongside. A second low phrase answers during the closer
approach, with a gap after the first moan. The boat comes to
rest beside its head, the far length lost in haze. It is the whale from the first crossing, now found in trouble.

Five steps share the rescue between wind, child and bird:

1. Circles lift a separate blue-green net with a tighter weave, draped visibly over the orange net. The wind carries
   it off to the far side, leaving the blowhole open. The orange net stays put throughout this challenge.
2. A sweep across the fold clears its eye; it opens and finds her.
3. Strokes bring a cork to her reaching mitten so she can take the line.
4. Gusts lift the net as she heaves it off the head, then lets the line go.
5. The cygnet swims out, takes the loose end in its bill and paddles backwards to tighten it. A sweep raises the
   flipper; the bird braces and pulls the fitted loop along it, then tows it clear before letting go. Loop travel
   follows the bird's actual backward movement, not a timer. It stays afloat, faces the rope and remains in frame.

The whale spouts and sings, waves its flipper, then rolls under and raises its flukes beside the sun. Its swell
lifts the boat; the loose net sinks away. The cygnet returns to her arms, the mist lifts and they sail on to the
mirror, with about forty seconds of sailing after the whale disappears. Its jetty and reflections stay hidden
until the whale has gone. Arrival carries the sailing view into a
seven-second ease toward the mirror's own camera (`tuning.skyMirror.arriveFor`). The paper stays stowed at sea.

Rulings: player-paced, replacing the former 100-second limit and passive crossing. The first whale puzzle begins
about sixty seconds into the sea; the rescue waits for the player, with physical dolphin help after 90 seconds without
progress at a step (`tuning.netWhale.valveAfter`). The whale is kind and immense, its movement slow and heavy.
Dolphins follow their own stations, never swim in the air and never turn faster than a body allows. The boat never
crawls for the first swim. The drawn gestures appear half a second after their target becomes actionable, while
the camera finishes moving, and return two seconds after the last relevant stroke if more help is needed.

Music: the supplied "Another Shore" (`sea.ogg`), its second 55 falling as the boat comes to rest, then one whole phrase
as each act begins (the net lifting, the fold lifting, her first pull, the cygnet's pull; none for taking the line) and
its close from the release to the Mirror (`docs/contracts/audio.md`, "The long sea crossing").

Knobs: `tuning.seaPassage` (pod pacing and mist), `tuning.dolphins`, `tuning.netWhale` (rescue, holds and farewell),
`tuning.audio.whaleVoice`, `tuning.audio.seaMusicLead`. Checks: `tools/sea-check.mjs` (both orientations, through the settled mirror view, with
camera trace and browser/shader errors), `sea-logic-check.mjs`, `net-whale-check.mjs`, `sea-music-check.mjs`,
`sea-music-browser-check.mjs`,
`CROSSING=toMirror node tools/journey-pacing-check.mjs`. Saves: `swim`, `whale-rest`, each completed rescue step and
`whale-gone`; restoration details in `contracts/progress.md`.

## The sky mirror

`story/sky-mirror.ts`, `story/mirror-companion.ts`, `world/sky-mirror.ts`, `world/sky-mirror-layout.ts`,
`world/mirror-soap.ts`. `?chapter=mirror`.

A short way station where a child mends the sky. A flat under a thin skin of water doubles the sunset; nothing
stands above the reflected horizon but a stool, an enamel soap bowl and a brass hoop.

The boat moors offshore alongside a timber jetty; the child walks its planks and down a ramp onto the mirror and
sets the cygnet down. The paper leads them to the bowl. She holds the hoop out in front at chest height, the ring
before her face. Sweeps grow a film and blow bubbles, steered by the stroke at the bubble's height. Four fallen
lights lie on the surface as small gold starbursts; a low bubble touching one catches it (that patch of mirror
goes dark), and circles lift the filled bubble until it bursts gently and the light rises into its place in the
sky, reflected below. Lights go in any order; a sweep at another fallen light walks the child and bird there when
nothing is in play. Empty bubbles are harmless play; a burst carrying a light returns it to its patch. The cygnet
investigates beside the lights, follows low bubbles, opens its wings when one catches a light and watches the
ascent, on its feet at a slow planted walk; it never plays the puzzle for the player. The returned stars gather
above the far jetty as a slightly crooked kite, its outline drawn as neighbouring lights return and its cross lines
once all four are up; each star lights a stretch of broken reflection across the deep channel. The last joins them
and the empty boat comes round the deep outer channel (never over the flat) to the far jetty while the camera
holds the sky view. The child gathers the cygnet, walks up that jetty's ramp and boards. The departure kite flies over the far
jetty throughout.

Rulings: no passive solution (the answer never appears while the player does nothing). No clouds on the ground or
moon prop: keep the whole surface an open mirror. The paper stays visible throughout. Four stars (three ended the
room too soon), and the constellation is a crooked kite echoing the departure kite. The hoop is held well out from
the child's face, as if she is about to blow through it.

Rules: no timers, hidden percentages, constellation matching, raised causeway or sand road.

Camera correction, 2026-10-10. Jeremy's brief:

> "I think something has regressed with the camera dollying on the sky mirror chapter. can you check? for example, when i updraft the second star up and it goes into the sky, the camera never pans up far enough to see the first star. There also seems to be some weird overly done zoom outs"
>
> "the resting camera position also needs a bit of work to restore it properly. the horizon is so far up the top of the screen. shouldn't we atleast follow rule of thirds? what looks best?"

The resting horizon sits at the upper third in landscape and portrait, leaving the child, bubbles and reflections
on the water below. An ascent turns the gaze upward with all returned stars included in the composition, holds
that gaze for two seconds after arrival while the child starts walking, then eases back to play. The final star
flows into the same sky composition. Fitting may retreat up to 8 m; it must not compensate for a downward gaze
with a large zoom-out. Camera checks cover earlier stars during later ascents and the horizon at every stop;
`CONTINUOUS=1 node tools/sky-mirror-check.mjs` plays all four without resetting the camera between them.

The fallen lights breathe over six seconds, between 92% and full brightness. Jeremy: "if we want to have them blink,
they should pulse slowly, not just blink in and out really fast." Their cores and rays are filtered across pixels,
so camera movement must not make the almost edge-on lights flash; `sky-mirror-star-check.mjs` checks constant-light
camera movement at normal and Ultra render scales separately from the intended pulse. Once the kite is complete
its stars brighten over three seconds and then breathe, each slowly and a little out of step with the others, so the
finished constellation looks alive (`tuning.skyMirror.alive*`). Jeremy: "When the stars are completed in the mirror
chapter, it'd be cool if they shined a bit brighter and started pulsing like they were more alive."

Departure correction, 2026-10-10. Jeremy's brief:

> "One other bug with the sky mirror chapter i need fixed - when they sail off in the boat, it should follow the lighted up path. Right now, the boat sort of sails at an angle from the lighted path - to someone with ocd it is very annoying. I'd also like you to have a think about whether we can make that lighted path look a bit better. Right now it looks like some random wiggly lines."

The illuminated channel, empty boat's approach and sailing departure share one line. Boarding pushes along that
line and releases the mooring; the turn toward home starts beyond the light, including the crossing's waypoint
arrival radius. The trail is soft gold with broken glints and a quiet continuous glow. Each returned star still
lights its own quarter, with the gaps joining once all four are home. The mirror logic check sails from real
boarding through the whole trail at 30/60 fps and in a gust, keeping the hull within half a metre of its centre.

Knobs: `tuning.skyMirror`, `tuning.mirrorCompanion`. Checks: `tools/sky-mirror-logic-check.mjs`,
`sky-mirror-check.mjs`, `sky-mirror-pointer-check.mjs`, `sky-mirror-visibility-check.mjs`. Saves: `stars4-<mask>`
holds the returned stars and the current destination.

## Home

`story/home.ts`, `story/home-ending.ts` (the ending clock, `HOME_ENDING`), `world/jetty.ts`, `world/cottage.ts`,
`world/home-layout.ts`, `traveller/drawing.ts`, `creatures/flock.ts`; the closing text is in `index.html`.
`?chapter=jetty` (moored, the walk in to do) and `?chapter=summit`.

**The approach** (`toHarbour`, about 40 s) clears into afternoon. The boat curves offshore before turning in to the
jetty, with a low seaward camera arc toward the lantern. The whole home landscape shares one haze depth, so the
hillside emerges together, clearing between 150 and 45 m from the berth and over the first stretch of the jetty
walk (`tuning.homeApproach`). The home jetty is never seen before this crossing. The boat moors alongside it, the
one arrival in the game with somewhere built for it; the child steps up onto the boards and climbs the hill. Her own
orange toy from the little boats, the one she set sailing out to sea, lies on its side on the sand just above the wash
beside the shore end of the jetty (`world/home-toy.ts`, `tuning.homeToy`), turned so the jetty view shows its hull and
fallen sail: she walks off the boards right past it. Nothing is made of it. A lone
tree, the still island's tree again at two-thirds size, stands on the slope above the beach to the west of the jetty
(`HOME_TREE`): in the approach it breaks the long slope right of the sun, and it is out of frame for the climb,
the summit, the drawing and the pan to the moon.

**The fledging.** She slows over the last few metres of the climb and reaches the top just as the family first flies
into frame (`tuning.summit.swansIn`, `topPace`; the summit's staging and timing begin as early as before, while she is
still walking), so she stops because of them. Jeremy (2026-10-15): "Ideally she should only stop walking once the
adult swans come into frame - i.e. she only stops because the player has noticed the swans come into the frame."
Sitting in the last of the sun, the family passes low across the sun, reaches a wide circuit on a
tangent and wheels over the hilltop (`tuning.swanArrival`), calling. The cygnet watches and cries after them and is
set down. It tries twice by itself and drops, and Home's music, still the family's, falls back at its next phrase end into its own quiet opening, which plays for as long as it asks. Then the player's updraft: a column of `tuning.summit.liftToFly`
gets it off the grass, it climbs only as fast as the player keeps winding and sinks when they stop, and six to
eight turns of the cursor get it high enough (`liftTo`). The shown spiral keeps turning round it while it is up,
fainter under the player's own, until the family answers. **It never times out: it needs the player.** From here to
the closing line the ending is scripted to the music (`HOME_ENDING`): at the answer the opening hands over at its next
phrase to a fixed place in the recording, and the ending is timed from that (`docs/contracts/audio.md`, Homeward and Home). The
family comes down for it; it flies by itself, a wobbly widening circuit over the child that steadies as it goes,
always in frame (`tuning.fledge`); turns to her, calls (the call that is answered: the family bugles back), and
goes north, taking the empty tail station of the V (`tuning.swanDeparture`). She cheers after them in silence.

**The drawing.** She walks on over the brow with the plane still folded and stops where the whole cottage clears
the grass below (`tuning.homeReveal.stopAfter`). House first: a moment looking at it, the plane into both hands,
then the physical unfold. The paper is the glider, plain white ruled paper, until it opens; the crayon drawing
arrives as it flattens (hills and wall, house, sun, the little plane), and the recognition motif starts when
sheet and real house are both in frame (`Chapter.afterCamera` checks the rendered view). The drawing is held
(`recogniseFor`), she looks up at the house and her hands settle, then she refolds it and holds it up, and after
`releaseFor` the island's own breeze takes it into the sunset. The camera looks over her shoulder at the sheet and the house, with the real low sun above and left
of the cottage as in the drawing.

**Home.** Daylight holds through the farewell and the drawing; sunset begins while she watches the plane go, and
night and fireflies are there before the door opens (`tuning.homeLight`). The camera stays at the crest and only
pans its gaze to the house as she walks down; the door opens from inside as she nears it, lamplight on the grass;
the chimney smokes only after nightfall, because somebody inside lights the fire. The family washing (blue and red
adults, the yellow jumper) hangs behind the cottage's left corner (`tuning.homeWashing`). From the same place the
view pans, like a tripod head, to the moon and the sea, the horizon on the lower third and the moon left of
centre, with stars glinting in the water (`uStarlight`). The music's last phrase enters during the pan, its last
strong note comes as the view settles on the moon, and it rings out over the wind, the sea, the crickets and the owl;
as it dies away, about eight seconds after the view settles, "Thanks for bringing them home." fades in, holds and fades,
then Play again fades in at the same place and gently pulses; replay clears the completed save.

Rulings:
- The paper is plain white until it opens: no drawing visible before, and no visible swap.
- House first, then the drawing; the motif plays when the house is found, the paper is open and it shows the house.
- The drawn sun and house both read; the sheet stays within the hands' reach, not floating away.
- The unfolded drawing reading well comes first, then a natural hold: the sheet in both mittens, its near edge below her
  shoulders. The camera stays close behind her shoulder; swinging it out to the side makes the scene feel unnatural.
- The cottage faces the approach with a slight turn, echoing the drawing without looking arranged for it.
- The camera stays at the crest for the goodbye: no following, dolly or crane.
- The little boats' toys are never met at sea: all seven sail on by far below while she climbs the stairs in the
  clouds, and the one thing that comes back to her is her own toy washed up beside the home jetty, still, with no
  timing or camera work (Jeremy, 2026-10-04).
- No figure in the doorway. Children do not light fireplaces: the smoke starts after nightfall.
- No bells at the summit: no phrase when the family arrives, no reward bells at the updraft, none as they fly away.
- The closing screen is the one line and Play again: no border on the button, no credits roll.

Knobs: `tuning.homeReveal`, `homeLight`, `homeApproach`, `homeWashing`, `homeGrass`, `summit`, `swanArrival`,
`swanDeparture`, `fledge`. Checks: `tools/ending-view-check.mjs`, `ending-check.mjs`, `flock-flight-check.mjs`,
`summit-arrival-check.mjs`, `home-approach-browser-check.mjs`; `summit-film.mjs` records the summit with its audio
and camera turn rates, `ending-audition.mjs` renders the ending score. From `?chapter=summit`,
`__game.story.current.skipToDrawing(open?)` jumps to the drawing. Checkpoints `reunion` and `drawing`.

## Open

- The stairs: Jeremy's notes on the sail over the cloud, and the chapter select entry (`docs/stairs.md`).
- Sky mirror: a faint speckled patch on the water beyond the departure jetty, looking toward the sun on the way
  in, seen in Jeremy's screenshot and not yet traced.
