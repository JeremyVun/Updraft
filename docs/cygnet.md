# The cygnet

The companion becomes a swan cygnet and is rebuilt as the game's co-star. Jeremy's brief is verbatim in
`journey.md` ("On the companion becoming a swan cygnet"). It is **on `main`** (merged 2026-09-18, `eb1d7c6`); the
parcels still open are under Status. When it ships, the lasting parts of this file fold into `journey.md` and this file
is deleted.

## Who does the work

Jeremy's global model routing sends visual work to Astra or Opus 5, and says why: to keep the expensive grind of
iterating on a look off Fable, while a Fable lead still looks at results, accepts or rejects them and writes what it
saw into the next brief. Asked whether that binds this feature, Jeremy left the decision to the owning session (his
words are in `journey.md`). Decision:

- **The owning Fable session** holds the design and this document, builds the systems (the child's arm IK and
  sockets, the duet timeline, attention, feelings and the behaviour scheduler, locomotion and flight mechanics, the
  wind relationship, sound, the stage and the numeric gates), wires the story, looks at a handful of captures at
  each checkpoint, and decides what is accepted.
- **Opus 5 agents** do the visual production: the model, the down shader and palette, the adult swans, and the
  pose and timing passes that are judged by eye. Each gets one complete bounded parcel, its own worktree forked
  from `cygnet` under `/private/tmp`, its own dev-server port and `/tmp` prefix, and is never sent a follow-up; a
  further pass is a new agent with a new brief that carries the findings forward.
- The seams between the two are small files with a stated contract: `cygnet/body.ts` (skeleton, rest space,
  `HOLDS`), `cygnet/shader.ts` (`Look`, `cygnetMaterial`, `applyLook`), `cygnet/wings.ts` (`WingPose`, `poseWings`).
- Jeremy gives the final verdict. Product copy is not involved.

## What the story gains

The ugly duckling: a grey, clumsy thing that fell out of a line of white birds. Nobody says it, but the ending
says it back: the family that comes down out of the night is white, and the first white feathers are showing
through its down by then. Cygnets ride on their parents' backs, so riding on the child is what the species does
with the one it trusts. Swans need a long pattering run to take off, which gives every flight attempt a shape a
player can read: run, slap, lift, or run, slap, tumble.

What changes in the story text: "cranes" become swans; the skein is white; the meadow-crest "wheeling up a
thermal" becomes the family **resting on the water of the far bay**, white on dark water, heads up, before they
go on (swans do not thermal); the reunion keeps its low circle over the hill, which is how swans come round to
land. The voice rule is unchanged: the cygnet is silent except in distress and when it calls to its family.
Adult swans are other animals and may be loud: bugling, and the whistle of their wings.

## Why the colt fell short, from the code

- The bird and the child never touch. `Traveller.pickUp` is a 0.9 s bow with straight arms; the colt then lerps
  through the air for 0.5 s to a fixed offset (`ARMS` in `crane.ts`). Neither knows where the other's body is.
- The ride points (`armsPoint`, `hoodPoint`) are computed from the child's position and yaw, not from the rig, so
  the bird does not inherit the child's lean, crouch, sit, breath or bob; the bob is re-added by hand.
- The child has no elbows, so it cannot hold anything in its arms; `cradle` clamps one straight arm.
- The climb into the hood is a bezier through a shoulder point. The child does not react to being climbed.
- Behaviour is a set of independent timers (blink, glance, preen, peck). Nothing connects noticing to reacting,
  so it reads as idling, not as thinking.
- Locomotion advances a stride phase by time, so feet slide; a waddle needs the body to roll over a planted foot.

## The design

### 1. Contact is one system, not two animations

- **Sockets on the child's rig**, parented to the bones they belong to: `cradle` (crook of both arms on the
  chest), `shoulder`, `hood`, `lap` (sitting, and in the boat), `palms` (midpoint of the two mittens). The cygnet
  rides a socket's world matrix, so every lean, breath, crouch and jolt of the child reaches it for free. The
  existing jostle spring stays on top of that as the passenger's own lag.
- **Elbows and two-bone arm IK for the child**, so a mitten can be put on a world point: under the cygnet's
  belly, on its back to steady it, over it in the rain.
- **Contact markers on the cygnet**: belly-left, belly-right, back, breast. Hands aim at markers; while it is in
  the hands, the cygnet's root is driven by `palms`. One side always leads and the other is solved from it, so
  they cannot drift apart.
- **Duets**: a shared timeline that drives both characters from one clock. Each is authored as beats with
  anticipation and settle, and each has a bond-dependent variant where it matters.
  - *Gather up* (first time): child kneels, offers both hands low, waits. The cygnet looks at the hands, at the
    face, shuffles back, then lets itself be scooped. Feet paddle the air on the way up. It is held out a moment,
    they look at each other, then it is brought in to the chest and the arms close.
  - *Pick up* (later): the cygnet sees the kneel coming, runs the last steps and climbs onto the mittens itself.
  - *Set down*: crouch, hands to the grass, it steps off, shakes, looks back up.
  - *Up into the hood*: it scrabbles up the chest to the shoulder, wings out for balance; the child drops that
    shoulder, tilts the head away and brings the far hand up under its rump to boost; it tips head-first into
    the hood, turns round inside it, and its head comes up beside the child's ear.
  - *Down from the hood*: backs out onto the shoulder, the hand comes up, it steps onto the mitten, is lowered.
  - *Small ones while riding*: nuzzles under the chin and the child's head tilts to it; child's free hand strokes
    its back when it shivers; the coat flap comes over it in the shower; it falls asleep and the child slows and
    looks down; it startles and burrows into the collar; it cranes round the hood to watch what the child watches.
  - *The fall's aftermath* and *finding it in the dark* reuse gather-up with the fear turned up: it flinches from
    the first reach, and lets the second one land.

### 2. A mind: attention, feeling, then action

- **Attention.** Each frame a few things compete for its eye: the child's face, the child's hands when they move
  toward it, the paper plane, the nearest creature (`cast.nearby`), a gust crossing it, the flock, the light in
  the wood. Saliency is novelty × nearness × feeling. The winner gets a look with a real saccade: eyes and head
  lead, neck follows, body last.
- **Social referencing.** After anything new or frightening it looks at the child's face, and what the child is
  doing decides how it settles. This is the cheapest and strongest cue that it has thoughts, and it is the bond
  made visible.
- **Feelings** are a small continuous state: fear, curiosity, contentment, tiredness, cold, longing. They set
  posture (neck height and curve, down fluffed or sleeked, wing droop, tail), tempo (blink rate, breath, how
  quick its head moves) and which behaviours are allowed. Bond shifts all of them toward trust.
- **Behaviours** are chosen by a scheduler from what the feelings allow, one at a time, each with anticipation
  and follow-through: preen (breast, wing, back), nibble grass, dabble at wet sand, stretch a leg and wing
  together, yawn, tail-wag after every shake, sit and tuck, chase the plane a few steps and lose interest,
  investigate a butterfly and flinch when it moves, flatten to a gust then lean into it with wings half open.
- Per room: it patters through the washing on the island of lines and is startled by a sheet; it rides high and
  watches the meadow go by; it goes quiet and low over the drowned village; it hides in the wood; it sleeps on
  the long crossing; it cannot keep still at home.

### 2b. The wind is somebody, and the cygnet is the only one who knows

Yes, it reacts to the player's wind, and the way it reacts is its arc. The child never acknowledges the player.
The cygnet does: it looks **into** the wind, up to where a gust came from, as if someone were there. It has two
bonds, one with the child and one with the wind, and the second is what the ending spends: at home it opens its
wings and waits for the player, because by then it trusts them to hold it up.

- *Afraid of it* (first island, the lines): a gust flattens it, it flinches and patters to the child's feet, and
  the child shields it. A sheet snapping beside it sends it under the coat.
- *Curious* (the meadow): it snaps at wind lines and petals going past, leans into a steady wind with its eyes
  shut and its down streaming, and half-opens its wings to feel the lift. Its first glide happens here.
- *Playing* (after the wood): it asks for it. A look up, wings out, a little run, a look up again.
- *Trust* (home): it stands in the pressed grass, opens its wings, and waits.
- Always: the down ruffles along the real wind; a hard gust makes it brace, and a harder one bowls it over a step,
  after which it shakes and looks indignant. Riding, it squints and tucks into the collar.
- Never a torment: fear from the player's wind is capped and spent once per gust, it always ends at the child,
  and a sheltered cygnet only ruffles. A player who keeps blowing on it gets a bird that hides, not one that suffers.

### 2c. The brave swim

It has never been in the water: it fell before it ever came down on any. On the first crossings it watches the
sea from the child's arms, stretches down toward its own reflection over the gunwale and pulls back. In the
drowned village it will not look at the black water at all.

The swim belongs on **the long crossing**, the exhale after the dark wood, at dawn. The child went into the dark
first so that it would not have to; now it does something brave with the child watching. Dolphins come alongside.
It climbs onto the gunwale, looks at the water, looks at the child, and the child does nothing except stay. It
goes in badly, bobs up like a cork, shakes its head, and paddles. Then it is swimming beside the boat, in the
boat's lee, neck up, and the child hangs an arm over the side near it. The player is the wind in the sail, so how
hard they blow sets the pace: too hard and the boat draws ahead, it paddles flat out with its wings half up, and
the child looks back; ease off and it draws level again. Nothing fails. When it tires it comes to the side and is
lifted in, soaked and proud, and is dried under the scarf. At home it swims the last stretch to the beach beside
the boat, which is the first time the player sees it go somewhere on its own and the quiet promise of the ending.

### 3. A body built to be looked at closely

- Cygnet proportions drawn the way a child would: pear-shaped body low to the ground, a soft neck long enough to
  make an S, a rounded head with a flat dark bill and big dark eyes, short legs set well back, outsized dark
  webbed feet, downy arm-wings with no quills, a stub tail that wags. Pale grey down, lighter on breast, cheeks
  and belly. No crest: the cowlick is what read as a comb. By the last island, white shows at the wing edges.
- More bones where the character lives: four in the neck, spread on the webs, a tail spring, a breast bone for
  breath and squash. Down is a shader effect: a soft rim shell that fluffs with cold and contentment, sleeks
  with fear and rain, and ruffles in a gust.
- **Locomotion driven by distance, not time**: feet plant and stay planted; the body rolls over the standing
  foot and the tail counter-swings, which is the waddle; the head is held steady in the world between steps.
  Running is a patter with wings out. It trips on rough ground sometimes, when nothing else is happening.
- **Flight vocabulary**: the fall (holding the line, sinking, bursts that pitch it up, a dropped wing, a last
  tumble, a chest-first skid through the grass, stillness, then the first breath); trying (run-up, slapping feet,
  a hop, a face-plant, a shake, a look at the child); gliding on the player's wind (rigid, amazed, wobbling,
  looking down); landing (feet forward, skid, tumble, sit, look back); leaving (the run becomes flight).
- The adults (`flock.ts`): white, neck straight out, black feet trailing, articulated wings with a slow deep
  beat, in a V; on the water at the meadow's far bay; circling low at the end.

### 4. Sound

Foley everywhere, voice almost nowhere. Feet on sand, grass and boat planks; wing flutter; the whole-body shake;
the thump and skid of a bad landing; down against the coat when it climbs. The two existing cries are re-voiced
as a cygnet's thin whistle. Three tiny cream strokes accompany its calls in every chapter, following its
shown position even while carried or airborne and fading back to nothing between calls. These belong to the
voice, not footsteps or wing sounds (`fx/call-marks.ts`, `tuning.cygnetCalls`). Adults: distant bugling and wing whistle as the skein passes and at the reunion.

### 5. Proving it

- **A stage**: `?stage=cygnet` stands the child and cygnet on bare ground under the game's light with a close
  camera, and plays any state, behaviour or duet by name at any speed. `tools/stage.mjs` captures contact sheets
  and slow-motion clips from front, side and the game camera's distance.
- **Numeric gates**, run headless over every state and every transition between states:
  planted-foot slip under 1 cm; mitten-to-marker distance under 2 cm during contact; no cygnet vertex inside the
  child's coat profile beyond 1 cm; no bone angle or root position jump above a threshold between frames
  (no pops, ever); never below the ground; never out of frame in a glide.
- **Visual verdicts** at real camera distance and close up, per the model-routing rules, then Jeremy's.

## Status (update as it moves)

**On `main` since 2026-09-18** (`eb1d7c6`), merged on top of the rooms (birches, kite and pinwheels, piano). The
session that built it died; a new session took over from this file. What the merge decided:
- **The crest is the close scene, with swans.** `main` had since rebuilt the crest as one unmissable scene for the
  cranes (heard first, the family wheeling up right in front of the rise, stringing out north, the set-down
  straight after in the same place: `tuning.crest`). This branch had the family resting on the far bay (Jeremy's
  pick, because swans do not ride thermals), which from the real crest was a few white pixels. Merged: the close
  scene, played by the swans (`SwanFlock.circle(..., climb)` and a new `SwanFlock.goOn`, which hands each bird a V
  slot and lets it ease across). **Settled 2026-09-18** (Jeremy: "I do agree that the raft of swans on a pond is
  better"): the wheel is gone from the crest and the family rests on a pond dug in the hollow beyond the rise.
  `circle`/`goOn` stay in the flock for the reunion at home.
- Gusts count as lift under the cygnet (`tuning.colt.gustLift`), as they did for the colt: cursor movement is the
  only verb. The home summit's `coax` swirl follows the cygnet.
- The birches carry it in the satchel (`carry.stow()` on setting off).
- Gates on `main` after the merge: the same marginal misses as before (gather jerk 0.0211, gap 0.0649; down jerk
  0.0241, gap 0.0678; walk turn 0.1018). The crest scene runs end to end at 60 fps with no console errors.

Landed on `main` 2026-09-18 from Opus 5 parcels, each accepted on a look at its screenshots:
- **Swans polish and the crest** (`7c90cb2`): white above and pearl-grey below so they read on a pale sky; the wheel
  is a flown, banked low circuit (`tuning.crest`); `goOn` lets each bird break out of the circle in turn into a
  narrow deep V going due north and climbing (`leaveClimb`); wakes ride the swell; the take-off run has legs down
  and hard shallow beats; a `flock` view on the stage. Still short: heads should hold steady in the world while the
  body bobs (cheap, biggest gain); the raft has no ripple ring or reflection; the wash lingers 0.6 s under a bird
  that has lifted; 22 birds is loose at the crest, 14-16 would read as one family. The agent's view on Jeremy's
  pick: a resting-then-lifting family would read if staged on a pond or wet hollow 50-70 units ahead of the crest.
- **Look pass two** (`59a6cf6`): neck half again as long and tapered, longer flatter bill, bare lores, the folded
  wing as one downy teardrop, paler and warmer in every light with a sky fill and a far-distance skin fix, a real
  lay for `sleek`, a soaked `wet`, `grown` readable from the game camera, an open-topped satchel it sits in, puffed
  sleeves, thumbs. Gates unchanged. Still short: the bag is boxy; wet shows faint diagonal lines on the crown; from
  behind it sits deep and shows mostly its grey back (handed to the pose pass).

- **Pose and timing** (`12ebf3a`): a lean is now mostly a translation with a squash, so the kneel no longer planks
  the coat; anticipation, arcs and a rest beat in gather-up and set-down; the plane no longer crosses the child's
  face on its way to the satchel; the satchel seat is higher and upright with its own S-neck, leans into turns and
  looks about; acts have an in, a hold and an out; a weightier waddle; the try is crouch, patter, bound, face-plant,
  lie there, up, shake, look at the child. Gates: all 27 green for the agent and on the lead's first run; on a
  second run one intermittent miss (gather turn 0.1025 against 0.07 while carried), not yet traced. Still short:
  in the regard the cygnet's head still sits over the child's face from dead front (the cross-body reach runs out;
  needs the shoulder pivots forward, which is geometry); stow and unstow are one smooth beat each with nothing
  authored inside; swim, plunge and glide were not worked; from 15 units behind it still reads deep in the bag
  (the bag's front rim is the limit).
- **Lead's finding across all three:** at 5-20 units the cygnet still reads dark slate, not pale silver-fawn. Close
  up it is pale; past the distance where the down shells fade it is not. This is the first thing for the next look
  parcel, with the boxy bag, its front rim and the shoulder pivots.

Playthrough (2026-09-18): clean from the first island to the end of the meadow walk, 60 fps; the script ends there
and does not drive the later rooms.

From Jeremy's playtest of 2026-09-18 (his words in `journey.md`), landed on `main`:
- Flying (`217e240`): a try's run becomes the take-off when there is wind under it; it feels for wind in a ring
  (`tuning.colt.reach`); runs come back to `trodden`; plain gusts count as lift only where the chapter's
  `invitesFlight` is true; `mayFly` false in the wood; the twirl winds up sooner.
- Pale cygnet and the pouch (`14e474d`): the palette was 8-10x darker than every other creature (DOVE 0.06 linear
  against the swans' 0.72); rescaled, hacks unwound, the crate replaced by a soft pouch it nestles into, the
  shoulder pivots forward so the regard clears the face. Then, Jeremy: "too pale now"; duskier (`a39e0df`): warm
  taupe, DOVE 0.23 / MILK 0.33 / SNOW 0.55, the shell rim `fuzz` 0.20→0.09 (the rim term, not the palette, is what
  makes it read white), a warm sky fill at dusk.
- Birches (`6ddc6b3`): a litter field the wind transports (swept bare behind a gust, drift where it dies), leaves
  that skitter, lift and settle elsewhere, four heaps with an angle of repose, the cygnet's dive into the hollow's
  heap (`delve` act, `cygnet.errand`), the island 60×80 with a rise and a hollow, haze 0.97. Short: the leaf devil
  does not isolate in a wood already full of gold; heaps read flatter from the walking camera.
- The piano (`48b7422`, `184992f`): a struck-string tone (unheard by anyone yet), and the approved call-and-response
  duet; still to do by eye: the cygnet on the keys, the island answering each phrase (the piano is the key that
  wakes the grey meadow: see `journey.md`), the child sitting AT it.

- The pond crest (`a25656f`): a pond in a hollow 51 units past the crest (`world/pond.ts`, carved in the heightfield),
  the family resting on it from the chapter's first frame, bugling heard before the crest, the beat crest → down →
  try, the family's pattering run and V north, the set-down at the edge, runs along the shore, the try camera
  looking out over the water, the coax sooner; 8 of 8 test circles flew it; splash-down and paddle back. Swan heads
  steady, ripple rings, the wash no longer lingers. Short: the far bank reads as a dark smear from the crest (grass
  lit only by sky); water reflects sky only; the crest measured 47 fps once while two agents' Chromes were busy,
  unconfirmed.
- The wood (`32b2462`): coals the player's gusts catch, flare and burn down; one first coal in the first view; a
  chain laid one at a time at the edge of the last light; cinders stirred by any gust; firelight on the floor; the
  bolt runs across frame and the bird's coal is the one thing to blow on; the camera behind the way they are going;
  the exits kept. Short: foreground branches during the search; the finding can come within ~10 s.

- The meadow's opening (`1158c8a`): the piano is the key. Haze 0.9 on the crossing; a bank over a shallow bay with
  beats beach → climb → brow; the whole island asleep (the `waiting` region covers it and the wind raises no life
  in it); the piano moved onto the route at `meadowPoint(-18, -740)` in a 27-unit patch of colour, scaled 1.42 with
  the child seated at the stool; `PianoStop.onWake` rolls colour out by phrase (hollow, crest and pond, the island
  on the finale) and the piano finishes the tune itself when nobody answers; the cygnet walks the keys in the
  finale; `WAY` in `fields.ts` is the one route line and no wall stands within 8 units of it (24 near the brow);
  `?chapter=piano`. Short: the wind front only reads in motion; the pond's rim grass is green while the island
  sleeps.
- The water (`4588766`): the player's gust used to feed the sea's roughness (blurred mirror, wide glitter, lost
  Fresnel) and drag the ripple texture at cursor speed: a slick. Lighting now comes from the weather only; the
  stroke adds fine ripple, a uniform darkening and a short chop; the sail luffs on an arriving gust
  (`tuning.water`). Deliberate: whitecaps now need the squall.

- The sleeping island's world (`1aed3b1`, 2026-09-19): `world/sleeping.ts` (the bed with a cloth blanket, pillow and
  down, the bedside lamp, the window frame with cloth curtains and a light shaft onto the pillow, the upside-down
  chair and desk hanging over the hollow, the ceiling lamp on its flex, rug and floorboards dithering into frost),
  pooled fog in `fogOf` with four top sheets and a 128² carve field the player's stroke opens lanes in, frost and
  dawn as shared uniforms, a `sleeping` block in `tuning.ts`, a stub chapter (ashore, the bed, the berth), the
  `toSleeping` hop and `toHome` re-based west off `SLEEP_BERTH` through the strait north of the island; the wood
  no longer sows trees or litter over it. 60 fps at the bed as the game opens; parity 0.0006. Short: the rig's
  2.8-unit ground clearance keeps every shot in the hollow 4–5 units above the child (a low camera needs
  `camera.ts` or a shallower hollow); **a carved lane does not read from the high camera** (the fog top is a flat
  pale disc from above; it reads at fog level); the `toHome` strait is 30–80 cm deep for 30 units and will read as
  bright shallows; frosted blades read as ice chips within 10 units; `fogTopAt` ignores carving; large glowing
  orbs in the hill shot at dawn 1 (`/tmp/updraft-sleepw-k-hill-dawn1.png`) are unattributed (fireflies gate or
  the down); the last two thirds of the crossing home were checked numerically, not watched.

- The sleeping island's story (2026-09-19, merged `4153f73`, fixed up in `d6b1f63` for the peer's new `needs(lift, labour)`): `story/sleeping.ts` rewritten from the stub into
  the whole room — ashore through the fog, the cygnet set on the blanket and the child into the bed with the plane
  held against them, the three tries and the one call nothing answers, the pillow's feather, the look back at the
  edge of the trodden grass, the climb, the shiver and the breath that lifts it, the hilltop, the glide down the
  lane of sun, the window on the face and the waking. New: `fx/feather.ts` (the plane's idea, slower and floatier:
  it takes the air's own speed, hangs about `featherHangs` off the grass, leans toward a goal so it is never lost,
  and a stroke across it on screen carries it); `Cygnet.glideTo/sailing` (the long glide, with `laneOpen` run from
  it), `stay`, `pace`, `plead`, `does`, and the acts `tug`, `nudge`, `look-back`, `shiver`; `Traveller.lieOn/abed/
  abedSide/tighter/eyesShut` (the coat is flattened on its own, not the child inside it, so the head and hood read
  on the pillow while the blanket stands over the rest); `Shot.clearance` so one room can come down to a bird's eye
  without touching the rig anywhere else; `sleeping.fogTop` and `sleeping.sleeper` driven by the story.
  **Every wait ends by itself** (see the beat list in `story/sleeping.ts`): with no input at all it reaches the boat
  in about 4 minutes. Gates unchanged from `main` (25 of 27; the two `idle` misses are `main`'s). Short: the frosted
  blades read as flying ice chips at the bird's-eye camera, which is the world parcel's note made worse by the low
  shot; the tumble onto the blanket and the lift into the arms measure turn 0.12–0.16 rad and jerk 0.06 (both are
  deliberate impacts, inside the gates' `try` limits, above the 0.07/0.02 the quiet moments hold); the paper plane
  is as long as the child is tall, so while they are asleep it is under the blanket with them rather than shown.
  **Lead's look at five frames:** the child asleep with the cygnet on the blanket, the glide in the sunrise, the
  light through the window and the waking with the bird in the lap all read. The bird's-eye climb frame is the weak
  one: the frosted blades fill the frame as a swarm of dark chips against the sky (`/tmp/updraft-sleeps-beat-11-lane.png`),
  and the same chips are visible in the grass of every sunrise shot. That is the first thing for the next parcel
  (`grass.ts`: the frost treatment and the blade width over the island). Also unjudged by anyone but the agent: the
  lying pose up close, the climb's brightness (`dusk` 1.22 for the climb), and the eased gust lean, which reaches
  the meadow and the summit too.
- The frosted grass (`a4bc000`): the chips were two things — a blade cropped to 28% was wider than tall, and the
  wildflower heads were glowing cards on a 0.15 m sward. Now the width goes down with the crop (`swardWidth`,
  `swardCrop` in `tuning.sleeping`), no flowers on the island, tufts and curve cut, a shared `rimeColour()` that
  takes its pale from the sky ambient and lightens the tip more than the root, the dawn and the lamp multiplying a
  blade's colour rather than adding to it, rimed blades shading flat, and the ground under them grass rather than
  soil so it carries the surface between blades. Every term gated by `sleepFloorAt`/`frostAt`; meadow and summit
  frames unchanged to MSAA noise; 60 fps at the bed and at the bird's eye. The climb now reads as a rimed slope
  with the bird legible in it. Short: near blades in full sun still read as gold cones at the hilltop (the backlit
  term on a short sward; density is capped at one blade per 0.25 m cell, so continuity has to come from the ground).
- **Found on the merge:** the child and the cygnet were black on the bed once the ending lowered the moon from 24°
  to 12° (the hollow's rim shadows the bed), because the character shaders never took the lamp.
- The lamp on the characters (`4540335`): `emberLight`, `dawnLight` and the lamp added to the child's shader
  (`traveller/body.ts`), `dawnLight` and the lamp to the cygnet's skin and down shells (`cygnet/shader.ts`, the
  shells taking it as a rim on the lamp side), all three to the paper plane; every block behind its uniform's `w`
  so other rooms pay one comparison (ungated, the down shells' extra cost shifted the gates' wall-clock window and
  two runs failed marginally). The characters multiply the lamp by a cubed wrap toward it, the cygnet at 0.75, so
  the hood and the down are warm on the lamp side and blue away from it and the bed stays the warmest thing in
  frame; at the props' flat weight the child was a butter blob. A side gain: in the wood the coat, the mittens and
  the cygnet in the satchel now take the coal's light as the floor does. 60 fps, gates clean three runs, summit
  unchanged. The cygnet's 0.75 and the wrap are the agent's judgement, not a value Jeremy has seen.

Everything in the 2026-09-18 playtest is built. Open: Jeremy's verdict on the sleeping island as a whole; the crest's
frame rate under measurement; fireflies in the wood (a one-number idea, unasked). A peer session is polishing the
ending (dolphins, summit, fledging, credits).

The rest of this section is the record from the branch.

Done on `cygnet`:
- Names; the QA stage (`?chapter=stage`, `story/stage.ts`: `play(name)` including `act:<name>`, `shore`, `swim`;
  `look(view)`; a free close camera).
- One smooth skin on a 21-bone skeleton (`cygnet/body.ts`), authored in one rest space, two-bone skinning.
- The child: elbows, two-bone arm IK (`reachFor`, `reachLocal`), kneel, lean, head tilt, sockets, the plane tucked
  in the satchel while the arms are full (`traveller/body.ts`, `traveller.ts`).
- Placement (`cygnet/ride.ts`): ground, seat, in the hands, the surface path over the shoulder, all read live.
- Shared moments (`companion/carry.ts` on `companion/duet.ts`): `gatherUp`, `setDown(onDone, facing)`, `stow`,
  `unstow`; every chapter now uses them instead of a bow and a teleport.
- The brain/body split: `cygnet/mind.ts` (attention, feelings, acts, the bond with the wind), `cygnet/pose.ts`
  (`Drives` in, bones out; the file a pose pass owns), `cygnet/gait.ts` (planted feet at a walk, a patter when it
  hurries, steps when it turns), `cygnet.ts` (states and mechanics: fall, run-up and face-plant, glide, clumsy
  landings, perch, swim, leave).
- Sound: `audio/foley.ts` (steps by surface, flaps, flutter, shake, tumble, rustle, plunge, paddle; swans' bugle
  and wingbeat), driven by `cygnet.heard` events from `main.ts`. The two cries are unchanged so far.
- Story: the brave swim on the long crossing (`CrossingOpts.swimAt`, `crossing.ts`).
- The probe (`companion/probe.ts`, `__game.probe.report()` / `.trace`): body jerk, turn rate, mitten gap, foot
  slip, ground.

Merged from Opus 5 agents: `cygnet-look` (down shells, fan-closing wing, grey palette, `SIZE` 1.42, complete, with
a report) and `cygnet-swans` (white swans: skein, wheel, raft on the water, take-off; cut off by the session limit
on 2026-09-18 before its final polish and report; its uncommitted work was committed as WIP and merged; it
typechecks and builds). The crest now calls `flock.rest()` on the far bay and `flock.lift()` north.

Interrupted by the same limit before they had changed anything: `cygnet-look2` and `cygnet-pose` (worktrees exist,
no commits). Their briefs are the next two parcels and are summarised here so they can be relaunched:
- **Look pass two** (owns `cygnet/body.ts`, `parts.ts`, `shader.ts`, the child's geometry in `traveller/body.ts`):
  more swan in it (longer slender neck, longer flatter bill, lores that read at 3-5 units); the folded wing's
  coverts read as hard plates and should be one soft downy teardrop; it goes charcoal in shade and should stay pale
  silver-fawn in every light; `sleek` needs a directional lay, `wet` reads soapy; `grown` must read at game
  distance; an open-topped satchel the cygnet sits IN; puffy sleeves, soft elbow, mittens with thumbs.
- **Pose and timing pass** (owns `cygnet/pose.ts`, `wings.ts`, `gait.ts`, numbers in `mind.ts`, `ride.ts`,
  `carry.ts`, the child's kneel/lean/arm feel in `traveller.ts`, sockets in `traveller/body.ts`, the look of the
  mechanics in `cygnet.ts`): every pose and act is an engineer's sketch; the kneel tips the coat like a rigid bell;
  the held-out "regard" covers the child's face from the front.
- **Swans follow-up**: from the real crest (20 up, 370 units from the bay) the raft is a few white pixels. It needs
  a size it can be given for that shot, or to be staged nearer; then its own final polish.

Gates on the merged branch (2026-09-18): 21 of 27 pass. Misses, all marginal and all from refitting to the bigger
bird: gather jerk 0.021 and gap 0.065, a 0.098 turn while it waits, set-down jerk 0.024 and gap 0.082, walk turn
0.10. The pose pass retunes these; none is a visible pop.

Still to do: the three parcels above; re-listen to the re-voiced cries and the foley (nobody has heard them yet);
per-room behaviour; a full playthrough; an independent visual verdict; fold this file into `journey.md`; merge to
`main` (which has moved on: `src/tuning.ts` and petals work from other sessions touch `main.ts`).

Found on the way, and decided:
- **The satchel is its seat on the walks, not the hood.** The hood is worn up, and anything held in front of a bell
  coat is invisible from the game camera, which lives behind the child. In the open satchel on the child's back it
  is in every frame, facing the way they go, able to look back at the player's wind, and it is what cygnets do:
  ride on a back. In the arms (across the chest, head to the child's left) is for tender moments and the boat.
- **It gets into the hands by itself.** A kneeling child's hands stop about half a unit above the grass; bending the
  rigid coat further tips it over like a plank. So the hands are offered low and held still, and the cygnet hops up
  into them. Nothing is done to it. After the fall this is its fourth try at getting up, and the one that works,
  because someone is there.
- The child's arms now show: shoulders moved out to the coat's surface, arms resting on it, red mittens. This
  changes the child's silhouette a little and needs Jeremy's eye.
- Probe numbers to hold (worst over gather, stow, unstow, set-down): body jerk under 0.02 units/frame², turn under
  0.07 rad/frame, mitten gap under 0.06, never below ground. Pops found so far all came from a pose weight that
  switched instead of easing; every new weight must be eased.

In flight: Opus 5 agents on `cygnet-look` (model, wing fold, down shader) and `cygnet-swans` (adult swans, the raft
on the water, take-off), each in `/private/tmp/updraft-cygnet-{look,swans}`.

## Build order

1. Rename and re-seat: `Crane` → `Cygnet`, `CraneFlock` → `SwanFlock`, `colt/` → `cygnet/`, `cast.cygnet`; story
   and docs text; no behaviour change. Stage and gates scaffold.
2. Child rig: elbows, arm IK, kneel, sockets. Cygnet rides sockets. Gates for contact and penetration.
3. Cygnet body, down shader, palette; adult swans.
4. Locomotion, swimming and flight vocabulary.
5. Mind: attention, feelings, scheduler, social referencing, the bond with the wind.
6. Duets, in story order: gather up, set down, hood, the small ones.
7. Sound.
8. Story changes: the family resting on the far bay at the crest (Jeremy's pick), white skein, reunion, the brave
   swim on the long crossing and the swim ashore at home; per-room behaviour.
9. Full playthrough, visual verdicts, fold this into `journey.md`, merge.
