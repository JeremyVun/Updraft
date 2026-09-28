# The chapters

One section per room, in journey order: how it plays, why, Jeremy's standing rulings for it, where its code and
knobs live, and what is still open. The vision and the story of the whole journey are in `docs/journey.md`; where
the islands are and how long the crossings take is in `docs/contracts/world.md`; wind behaviour per room is in
`docs/contracts/wind.md`; the look is in `docs/styles.md`.

## How the chapters fit together

`story/journey.ts` runs the order (`ORDER`):
island → toLines → lines → toBoats → boats → toMeadow → meadow → toBirches → birches → toStairs → stairs → drowned →
wood → toSleeping → sleeping → toMirror → mirror → toHarbour → home. Every `to*` chapter is a `CrossingChapter`
(`story/crossing.ts`) given a route (`ROUTES`), a haze, the time of day and season it eases to, its music, and
optionally a look back, a whale, dolphins and the cygnet's swim. The drowned village is its own crossing: it
carries the boat from the stairs through the storm to the wood's beach. `toWood` and `toHome` exist only to
resume old saves.

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
  where a child could otherwise be stranded (the drowned village's becalming lifts after 90 s).
- **Landing and leaving.** On a beach the boat runs up the sand and the child sits a moment before stepping out
  (`Traveller.stepAshore`); at a jetty they step up onto the boards (`Traveller.alight`). See `docs/boat.md`.
- **The reward phrase** (`completeObjective()` in `story/cues.ts`, the still island's restoration phrase) plays
  only at major conclusions: the still island restored, the little boats' reveal, the last loose stair flight
  placed, the drowned village's sail refilled. Smaller steps keep their own small responses.

## The still island

Late autumn, grey, no wind. `story/island.ts`; the default start.

The child sits on the south beach with the paper plane on her lap; the boat is in the south-east cove in the first
frame. Before the first breeze, a gust invitation is drawn across the held plane from bottom right to top left, so
the natural stroke blows it inland into the grass (`PlaneInvitation`, `tuning.opening.planeInvite*`,
`planeInviteRise`); whenever the plane comes to rest on the grass during catch, a level sweep is drawn across it
toward where it should go. Colour returns wherever the wind goes, and the plane plants lasting colour under it for
as long as it travels (`tuning.opening.planeBloomFrom`, `LifeField.bloom`). Throws stay in the southern half and
are turned back before the ridge, so play never goes out of sight. When 65% of the island is alive it is restored:
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

`toLines`. The long curve round the restored island: the camera looks back at it for the farewell (30 s) and turns
onward; a whale surfaces at 52 s. The light stays clear until the boat closes on the Lines berth, then eases into
distance haze so the washing resolves only on the final approach (`tuning.world.linesCrossingHaze`,
`linesHazeFrom`, `linesHazeTo`). This crossing earns its length: leaving the cove, the island receding, the
farewell and the whale.

## The island of lines

`story/lines.ts`, `world/lines.ts` (washing and cloth), `world/lines-layout.ts`, `world/lines-passage.ts` (the
curtains), `world/doorway.ts` and `world/door-shore.ts` (the door and the shore through it), `world/kite.ts`,
`world/pinwheels.ts`. `?chapter=washing`.

The first impossible fragment of home: somebody's washing with nobody there, and a child lost in it. Jeremy:
**overwhelmed, not vast**. Density is the lever, not area: a low whaleback (`tuning.world.linesDome`) packed with
washing along a winding alley, the camera beneath it near the child's height, washing dissolving wherever it
stands between the camera and the child.

The plane stays in the child's hand. Three curtains of washing hang across the path. Broad sweeps lift a hem and
small sweeps add up, in any direction, and progress is never lost; only the waiting curtain takes the stroke
aimed at it on screen (`WashingCurtain.brush`). The first shows sideways invitation traces
(`fx/washing-invitation.ts`). The cygnet goes under first and looks back for the child; a lifted sheet stays up
until both are through. The last sheet opens on a clearing: one low line with a blue and a red adult garment and
the small yellow jumper between them, and the red door. The released breeze brings the sleeves together (blue
begins, red follows, yellow answers) and the door opens once they have nearly met. Through it is a separate shore
(`DOOR_SHORE`), drawn inside the opening, where the kite and the boat wait on open grass. The child and the bird
pass through, the camera follows, the washing is gone, and the child throws the plane and the voyage resumes.
Checkpoints follow the first and second curtains and the threshold.

Rulings:
- Colour identifies the family: rich blue, warm red and the child's yellow belong only to these three; the rest of
  the laundry is pale linen, the passage sheets share a red sewn hem, and the pinwheels stay outside the clearing.
- The sleeves reach softly: fullness and small cuff movements, pegs holding; no pointed arms or inflated torso
  (a reaching gesture read as creepy).
- No automatic opening: an invitation, not a timeout.
- The door is the only way onward; beyond it only open grass, the kite and the boat.
- Lines may cross each other but never run near-parallel close together (`lineField` rejects them).
- Daylight stays over the whole island; pinwheels belong to this island only.

Knobs: `tuning.linesPassage`, `tuning.washing`, `tuning.family`, `tuning.linesToys`. Checks: `tools/lines-check.mjs`,
`lines-view-check.mjs`.

## The little boats

`story/little-boats.ts`, `world/little-boats.ts` (toys, sails, wakes, the plug), `world/little-boats-layout.ts`
(the stream, shared by terrain, water, fleet and walkers), `world/little-boats-bath.ts`,
`world/little-boats-spray.ts`. `?chapter=boats`.

Early, affectionate play, and the introduction to putting wind into a sail before the drowned village needs it.
Three pools joined by narrow streams run down to the departure beach. An oversized bath plug hangs on a long chain
from the haze, and an oversized enamel bathtub stands on the far bank (scenery only).

The child sets the cygnet down, notices a toy on a bare patch of bank, kneels, lifts it in both mittens (the hull
rides the real mittens, `LittleBoats.afterChildPose`), carries it to the lip and lowers it onto the water. The
player fills its sail; then every toy answers the wind near it. Seven toys sail the stream; the child follows the
leading toy along the bank, hurrying while it sails away from her; the cygnet swims three sheltered stretches
beside the toys (quick kicks and glides, wing flicks, spray: `swimPlay`) with dry-bank pauses, and the fleet waits
for either traveller. Round the final bend their own boat waits among the toys (the reveal), with the departure
kite. Once the leading toy reaches the stream mouth an outgoing current carries the fleet out and round to the
right into the sea, where the toys sail on until out of view. The paper stays on the backpack throughout. The
first time the cygnet rides in the satchel here, the bag's flap is thrown open for the rest of the game.

How the toys move: a filled sail picks the hull up (`drive`) and still water takes speed away slowly (`drag`), so
a toy glides on after a stroke. Each toy has its own `pace`; the child's orange toy is quickest and sails the
centre lane, the others side lanes (`sideLane`, `outletLane`), so it can pass. A toy behind one it cannot pass
hands its gust on (`nudge`); carried toys drop the wind once ahead of the child's (`carryAhead`, `fleetLead`).
Sails read only real local wind (droop, fill, luff, boom swing, heel); the stream gives heading, not steering.

Rulings: no race, score, text, direction test or penalty, and time alone never completes it. The toys must move
easily and glide: one relaxed stroke should carry a toy well (Jeremy set its drag and top speed). The orange
toy must not lag the fleet. Keep the toy, the travellers and the next stretch of water in frame together, in
landscape and portrait. The stream is the same water as the sea and merges into it.

Knobs: `tuning.littleBoats`. Checks: `tools/little-boats-logic-check.mjs`, `little-boats-check.mjs` (`TOUCH=1`),
`ONLY=boats node tools/progress-check.mjs`.

## The meadow and the piano

`story/meadow.ts`, `story/piano.ts`, `world/piano.ts`, `world/piano-stroke.ts`, `fx/notetraces.ts`,
`fx/piano-wave.ts`, `world/music-growth.ts`, `world/pond.ts`, `world/fields.ts`. `?chapter=meadow`, `?chapter=piano`.

The last warm afternoon of the year, and the island is asleep. The crossing hides it in haze
(`tuning.world.meadowCrossingHaze`) and lines up offshore with the hill path before turning in, so the boat lands
at the foot of the climb (`tuning.sail.meadowArrivalSpeed` caps the last legs). A bank hides the meadow until the
child climbs it. From the top: a grey island, shore included, with one patch of colour on the west rise where a
piano stands (`PLACE`, `tuning.piano.initialRadius`), seen through a shallow saddle. The grey is held by the
waiting region (`life.regions.waiting`, `uWaiting`): the wind raises no life inside it, so the island wakes all of
a piece.

**The piano is the key; music brings colour.** The plane leads the child to the stool; she plays one note.
Call and response: rising, falling, then rising and falling together. A persistent outline above the keys, with a
ring at its starting end, is both the invitation and the input target on screen; tracing it plays the notes, her
hands follow the progress, partial progress is kept, and there is no rhythm or pitch to match. An idle player
keeps the invitation and a quiet demonstration; nothing times out. Each answered sweep sends music out from the
piano: note traces curl into the field planting colour, and a broad front with loose eddies wakes the ground to
`tuning.piano.responseReach` (45, 85, 125), then the whole island on the fourth. The front's shape is fixed and it
never takes colour back (`world/music-growth.ts`). After each answer the camera steps back and up over the field
and stays there (`restBack`, `restUp`). On the lullaby the cygnet climbs out onto the keys and walks them, the
camera rises and widens with the wave, and the grey hold is released only once the front covers it. Competing wind
sounds and chimes are hushed during the duet. A completed piano checkpoint resumes past it.

The walk goes on over the west rise and through a pass along `WAY` (`world/fields.ts`), the plane kept within
reach of the child (`tuning.meadowPlane`). Over the brow the ground falls to **the pond** (`POND`) on the open
north slope, with the cygnet's family resting on it, white on dark water, from the chapter's first frame; their
bugling is heard on the walk. The veil stands thick from here to the boat (`tuning.crest`). As the child nears the
bank the nearest birds notice and the family begins a staggered take-off north while she is still on the rise;
the camera holds her and the whole flock through the climb, then turns to the shore. She sets the bandaged cygnet
down at the water; it paddles after them, calls, watches them go, and swims back to her waiting hands. Walking on,
a sun shower passes, and halfway through it the sun breaks out and a rainbow stands in the rain over the sea
ahead where the boat waits; the walk does not stop for it (`tuning.rainbow`).

Rulings:
- The greening must be seen from where the player is: the camera is placed for it, and it never jerks in and out
  per answer ("I just want to make sure we don't make it nauseating").
- The family leaves while the child is still on the rise: a missed connection, not the child frightening them
  away or the parents rejecting their young. No flight practice here; the wing heals later.
- The pond is far from the piano and the family leaves over falling ground and open water, never through a hill.
- The pond's encounter plays no reward chime.
- Walls: field boundaries are painted as dry-stone lines, and every one that crosses the route has a gateway
  exactly where the path goes (`GATE`, `WIDE_GATE` in `fields.ts`); see the standing rule in `docs/journey.md`.

Knobs: `tuning.piano`, `tuning.crest`, `tuning.meadowPlane`, `tuning.rainbow`, `tuning.world.meadowVeilFrom`/`To`.
Checks: `tools/piano-check.mjs`, `piano-logic-check.mjs`, `piano-frame-check.mjs`, `piano-growth-check.mjs`,
`meadow-route-check.mjs`, `meadow-plane-check.mjs`, `pond-view-check.mjs`.

## The birches

`story/birches.ts`, `story/birches-play.ts`, `world/birches.ts`, `world/birch-scarf.ts`, `world/scarf-cloth.ts`,
`fx/leaves.ts`, `fx/birch-canopy.ts`. `?chapter=birches`.

Deep autumn. On the first island the player's wind brought colour back; here it takes the last of the year away,
and nothing avoids it, because every gesture is a gust. The island is long, with a rise under the swing tree and a
hollow beyond (`BIRCH_RISE`, `BIRCH_HOLLOW`). The canopy is gold tufts the wind takes off tuft by tuft and never
puts back; the leaf floor is a litter field the wind strips bare where it blows and drifts downwind, with four
heaps (`BIRCH_PILES`) and scuffed tracks (`LitterField`). Haze is thick enough that the next room never shows.

After landing, the child looks up the ride, steps aside and sets the cygnet down (`carry.setDown`). It plays on
its own while the player carries on (`birches-play.ts`): hops to a heap, chases gusts, dives in and rummages
(`delve`), shakes, and follows when the child moves on. It never flies here and never stops the walk; it is
gathered up at the boat.

**The impossibly long red scarf** runs as one strip of wool from the arrival beach through the canopy to the
boat, tangled back and forth among the trees, with four tangles in order where the child waits: lift a loop off a
fork (an upward sweep), circle the coils up off a broken birch (updraft circles, the column anchored at the wrap,
the swirl invitation), draw a slipped loop sideways off the upturned limb of a fallen birch, then draw the bow
outward off a low limb. Partial progress holds; the breeze cannot solve them. Released lengths fall and settle as
cloth (`ScarfCloth`). Freed, the scarf draws along its length into the boat (`tuning.birches.scarf.gatherSeconds`)
and becomes the red sail for the rest of the voyage.

**The swing** on the rise is optional and rideable once: brushing the empty seat invites the child on and pushes
it; she rides while the player keeps gusting, and 2.6 s of quiet air brakes it and she steps off.

Rulings: the leaves must not behave like grass; the room should be fun, and the cygnet's play is its own, not a
scripted beat. The scarf reads as tangled wool, not a ribbon; every support is physical (no knot floating in the
air); the wrapped trunk needs circling; the draw-in into the boat is unhurried.

Knobs: `tuning.birches`. Checks: `tools/scarf-check.mjs` (`PHYSICS=1`, `NATURAL=1`), `scarf-geometry-check.mjs`,
`birches-drift-check.mjs`.

## The stairs in the clouds

Between the birches and the drowned village: `toStairs` is a short hop east under a low cloud deck to a small
grassy island (`STAIRS_ISLE`). Everything about the room, including Jeremy's brief and the open work, is in
`docs/stairs.md`. `?chapter=stairs`. Not yet in the chapter select: it needs a still and an approved name.

## The drowned village

`story/drowned.ts`, `world/drowned.ts`, `world/lighthouse.ts`, `fx/storm.ts`, `fx/rain.ts`. `?chapter=drowned`
starts where the stairs set the boat down on the water (`DESCENT_END`).

A long dusk drift between rooftops, a spire with a weathervane, herons flushing off chimneys, drowned tree crowns
and leaves on black water: homes the water took. The camera travels behind the boat low among the roofs and pans
up to the church.

A third of the way through **the air dies** (`STILL_AT`): the breeze eases to nothing, the water goes to glass, the
music hushes, the sail hangs dead in the middle of the frame and the child looks up at it (`Boat.becalmed`). It is
the first time the journey needs the player rather than answering them. A stroke across the sail on screen blows
on the sail itself (`Boat.brushSail`, `tuning.sail.brushReach`); about `FILL_NEEDED` worth of gusts gets them
under way. After `STILL_LIMIT` (90 s) the air returns by itself, because nobody is ever stranded.

Then **the storm**: the weather gathers among the last roofs (`tuning.storm.startsFromShore`); the channel bows
toward a tall lighthouse on a crag, the lens holding its crown and the travellers together and letting it slide
past as they come under it. Its beam sweeps the rain and water, falters and goes out (`lighthouseOutAt`). A gust
drawn as wind lines past the child's hand takes the paper plane; the storm carries it off fast and low over the
wood (`planeAway`), and it is put away only once out of frame or deep in the rain. By the beach the last colour is
gone: black trees, cold rain, clouded moonlight, lightning only once rain and darkness are established. The
cygnet shakes in the rain, flinches at thunder and nuzzles under the child's chin when the light goes out. Hull
drive is capped through the passage (`Boat.speedLimit`); see `docs/contracts/wind.md`. Island mist hides the wood
until it comes out of the rain with its trees (`tuning.world.woodMist`).

Rulings: the becalming is visually and audibly clear. The storm lasts long enough to become really dark and scary
by the forest; the lighthouse is big, as a child would dream it, and central to the passage. The plane flies away
and is lost, never simply vanishes. The camera travels through the streets near the water, never surveying the
village from above.

Knobs: `tuning.storm`, `tuning.drownedCamera`. Checks: `tools/storm-check.mjs`, `boat-check.mjs`,
`drowned-camera-check.mjs`, `drowned-gating-check.mjs`.

## The dark wood

`story/wood.ts`, `world/wood.ts`, `fx/embers.ts`, `fx/ember-orb.ts`, `fx/ember-veils.ts`,
`fx/ember-invitation.ts`, `fx/fireflies.ts`. `?chapter=wood`.

The first winter storm, at night. **Care becomes courage:** the child first needs light for her own next step,
then uses it to help her companion, going into the dark first so it will not have to.

There is no grass to bend and nothing to throw, so the wind breathes on fire. Embers are abstract orbs of light: a
warm heart in translucent golden veils, small and dim at rest, opening and brightening as they wake. **Only the
player's updraft lights one**: circles drawn near the waiting coal on screen stand the column on it
(`WoodChapter.updraftTarget`, `input.anchor`) and `Embers.updraft` turns the charge into its breath; straight
strokes build none. Light grows while it wakes (`Embers.illumination`), but only a fully lit coal moves the story.
Burning coals flare with rising air; loose cinders answer any wind. After a few idle seconds the waiting coal
shows the updraft spiral wound from the litter under it. The child walks for as long as there is light
(`tuning.wood.chainStep` between coals) and stops when it runs out; lit coals stay lit where they were earned.

**The fright.** In a cleared glade the camera settles, then one close lightning flash and clap. The cygnet
recoils, jumps out of the child's arms with a scramble of feathers, lands clear and runs into a shelter of
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

Knobs: `tuning.wood`. Checks: `tools/wood-logic-check.mjs`, `wood-check.mjs`, `wood-scene-check.mjs`,
`ember-check.mjs`, `wood-floor-check.mjs`. The legacy `dry` checkpoint resumes after the paper.

## The sleeping island

`story/sleeping.ts`, `world/sleeping.ts` and its `sleeping-*.ts` modules (layout, trail, ribbon, weather, wind,
hearth, birches), `fx/feather.ts`. `?chapter=sleeping`. The world contract for this room (driven values, fog,
frost, dawn, the feather's calls) is in `docs/contracts/world.md`.

**The one room where the player leads the bird**, and the role reversal of the wood: here the bird brings light to
the child. Winter arrives, and with it the fear that the child might not wake. The emotional line: comfort,
unease, loneliness, hesitation, commitment, relief, tenderness. Island mist on the crossing hides the island and
its summit window until they land (`tuning.world.sleepingMist`).

1. **Bedtime.** A bed on an open grassy terrace, with a rug, floorboard fragments, a lamp, a small stone hearth,
   an alarm clock, slippers, a book and a writing table. Fatigue shows on the walk (slow steps, a silent yawn,
   drooping lids). She warms her mittens at the hearth while the bird walks round the bed, then takes supported
   actions: set the bird down, turn, sit, nod awake once, legs up, head to the pillow, hands to the quilt and draw
   it up. The window, a warm seam in its curtains on a higher shoulder, is framed with the bed once before sleep.
2. **Cold.** Shortly after sleep, frost creeps in, breath shows, snow thickens with a crosswind, the hearth dies to
   embers and ash, the lamp contracts and the clock stops. The bird tries three times to wake her and calls once;
   nothing answers. A slit of window light touches the pillow, she stirs, and the cloth closes again.
3. **The feather.** A loose feather lies at the pillow's edge; a stroke across the pillow frees it. Broad strokes
   send it ahead along the route, faster than it goes by itself, never back downhill, and it stays near the bird.
   Short wind wisps hint the way up a natural hillside.
4. **Snow and mist.** A snow-choked notch between rock and drop: the bird tries the powder and backs out; broad
   sweeps carry it away into a grassy channel between rounded banks. Then a bank of mist over the shoulder: the
   bird looks back and shivers until the player parts it. Progress persists. In the upper fog the bird takes the
   feather into its bill, and lets it go at the summit.
5. **The ribbon.** The window stands on the crest; its curtains are tied with a ribbon whose loose end hangs beyond
   the lip over open air. A close three-quarter view shows feet on the edge, ribbon beyond, nothing beneath. A gust
   billows the cloth but the knot holds. The bird reaches, falls short, looks back at the child, and takes its
   bandage's loose end in its bill and unwinds it. The player's circles build air under it (softened by
   `twirlGain` only here); below the threshold it settles back. With enough lift it hops out, grips the ribbon in
   its beak and tugs the end through the knot, holding on until the curtains are visibly opening.
6. **Morning.** Having left the ledge, it has nothing under it and glides home on the player's wind: a dip as the
   wing takes the load, then steadier; letting go is safe. The camera holds the opening window, then follows.
   Light runs down the hill to the bed, frost recedes, green follows the light and spreads over the island, the
   birches leaf, the clock rocks. The child wakes, and after a breath sits up and draws the bird into her lap.
   Then the kite appears and they leave into the sunrise the bird brought.

Rulings:
- The bed is not in a pit; the hillside is natural: no stamped route, golden path, rock rows, kerbs or inset
  shelf. The window stays above the skyline in the bedside view with a clear path for its light to the pillow.
- Release is the completed physical tug, never starting flight or waiting; wind alone cannot open the curtains.
- No image of strangulation or helpless dangling; no crash or retry after the bird commits.
- No voiced yawns or narration, nothing implying the child has died.
- Callbacks reuse familiar mechanics in this island's own setting (the snow notch recalls the scarf).
- No snow play after this island: the curtains opening is the greening moment that turns winter to spring.
- Morning uses the island's own winter palette, not the sunset played backwards.

Knobs: `tuning.sleeping`. Checks: `tools/sleeping-logic-check.mjs`, `sleeping-check.mjs` (`ADVERSARIAL=1`,
`TOUCH=1`; `SUMMIT=1` and `CLIMB=1` stage the ledge and the feather), `wing-care-check.mjs`. Checkpoints `feather`
and `morning`.

## The open sea

`toMirror`: `story/crossing.ts` with `dolphins` and `swimAt`, `fx/sealife/dolphin.ts`, `fx/sealife/whale.ts`.
`?chapter=sea`.

The exhale after the worst of the journey: the one crossing that takes its time, and nothing is asked of the
player but to sail. The boat leaves in the last of the night and the sleeping island's palette lifts astern. The
pod rises round the boat in staggered groups and rides the bow; the featured leap runs up alongside and turns out
so it is seen side-on, at first light; a whale surfaces far ahead. The boat settles into one even pace that fits
the pod's play and is never braked. Then the cygnet's brave swim: it grows restless, climbs onto the side, makes
up its mind, goes in and swims in the wave along the hull while the boat sails on, and is lifted back in to dry. A
dolphin comes in and nudges the planking; then the pod dives away ahead before the mirror's still water develops.
Distant land dissolves into the sky until the pod has gone (`Chapter.openSea`). The paper stays stowed.

Rulings: the passage takes at most 100 s. Dolphins are big, never swim in the air, and never turn faster than a
body allows; the pod follows its own stations rather than being swung with the boat. The boat never crawls for the
swim.

Knobs: `tuning.seaPassage`, `tuning.dolphins`. Checks: `tools/sea-check.mjs`, `sea-logic-check.mjs`,
`CROSSING=toMirror node tools/journey-pacing-check.mjs`.

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
widens. The child gathers the cygnet, walks up that jetty's ramp and boards. The departure kite flies over the far
jetty throughout.

Rulings: no timers, hidden percentages, constellation matching, raised causeway or passive solution. No ground
fog, moon prop or sand road: keep the whole surface an open mirror. The paper stays visible throughout. Four
stars (three ended the room too soon), and the constellation is a crooked kite echoing the departure kite. The
hoop is held well out from the child's face.

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
one arrival in the game with somewhere built for it; the child steps up onto the boards and climbs the hill.

**The fledging.** Sitting in the last of the sun, the family passes low across the sun, reaches a wide circuit on a
tangent and wheels over the hilltop (`tuning.swanArrival`), calling. The cygnet watches and cries after them and is
set down. It tries twice by itself and drops. Then the player's updraft: a column of `tuning.summit.liftToFly`
gets it off the grass, it climbs only as fast as the player keeps winding and sinks when they stop, and six to
eight turns of the cursor get it high enough (`liftTo`). **This is the one sequence that never times out.** The
family comes down for it; it flies by itself, a wobbly widening circuit over the child that steadies as it goes,
always in frame (`tuning.fledge`); turns to her, calls (the call that is answered: the family bugles back), and
goes north, taking the empty tail station of the V (`tuning.swanDeparture`). She cheers after them in silence.

**The drawing.** She walks on over the brow with the plane still folded and stops where the whole cottage clears
the grass below (`tuning.homeReveal.stopAfter`). House first: a moment looking at it, the plane into both hands,
then the physical unfold. The paper is the glider, plain white ruled paper, until it opens; the crayon drawing
arrives as it flattens (hills and wall, house, sun, the little plane), and the recognition motif starts when
sheet and real house are both in frame (`Chapter.afterCamera` checks the rendered view). The drawing is held
(`recogniseFor`), she looks up at the house and her hands settle, then she refolds it and offers it to the wind:
the player's stroke carries it into the sunset, or the island's own breeze takes it shortly after
(`releaseFor`). The camera looks over her shoulder at the sheet and the house, with the real low sun above and left
of the cottage as in the drawing.

**Home.** Daylight holds through the farewell and the drawing; sunset begins while she watches the plane go, and
night and fireflies are there before the door opens (`tuning.homeLight`). The camera stays at the crest and only
pans its gaze to the house as she walks down; the door opens from inside as she nears it, lamplight on the grass;
the chimney smokes only after nightfall, because somebody inside lights the fire. The family washing (blue and red
adults, the yellow jumper) hangs behind the cottage's left corner (`tuning.homeWashing`). From the same place the
view pans, like a tripod head, to the moon and the sea, the horizon on the lower third and the moon left of
centre, with stars glinting in the water (`uStarlight`). The music's last cadence broadens and rings out, then
only the wind, the sea, the crickets and the owl. "Thanks for bringing them home." fades in, holds and fades,
then Play again fades in at the same place and gently pulses; replay clears the completed save.

Rulings:
- The paper is plain white until it opens: no drawing visible before, and no visible swap.
- House first, then the drawing; the motif plays when the house is found, the paper is open and it shows the house.
- The drawn sun and house both read; the sheet stays within the hands' reach, not floating away.
- The cottage faces the approach with a slight turn, echoing the drawing without looking arranged for it.
- The camera stays at the crest for the goodbye: no following, dolly or crane.
- No figure in the doorway. Children do not light fireplaces: the smoke starts after nightfall.
- No reward bells at the summit and no phrase as the family flies away.
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
