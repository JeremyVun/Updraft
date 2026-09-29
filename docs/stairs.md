# The stairs in the clouds

The room between the birches and the drowned village: a staircase a child would dream about, climbing from a grassy
island up through a cloud deck into the last sun of the year, then a sail across the top of the cloud and down
through the fog onto the village's water. It is on `main` and plays end to end (`?chapter=stairs`), and it is in
the chapter select as "Cloud stairs" (the still: the stair from the grass with its loose flights hanging, captured by
`tools/chapter-stills.mjs stairs`).

## Jeremy's words (verbatim)

> "How would the stairs into the clouds even work? like how do you, after climbing into the clouds, get baack to the drowned island on the ground? Or is it stairs up, then we use the moment to remind the player that the cygnet can't fly, and then they have to find the stairs down somehow?"

The answer he responded to: the boat is waiting at the top. The kite, which marks the boat on every departure, is
already flying above the cloud; at the top the boat floats on the cloud as if it were water; they sail across it
into the sunset and sink down through it onto the dusk water of the drowned village. No hunting for a way down,
and no "the cygnet can't fly" beat, which belongs to home.

> "Very interesting idea with the stairs into the clouds. Can you build this experience out in a worktree and then show me?"

> "I want you to take creative ownership here as well to make the cloud stairs chapter really beautiful and a standlone experience in it's own right that has it's own puzzle and moments between the child and cygnet that fit within and add to the overall game. Emotionally and narratively."

On a playful winter room: "the problem with having a snowman after the sleeping island is that the curtain opening
is the greening moment that moves the game from winter to spring." (So no snow play after the sleeping island.)

His first reaction:

> "I feel like the stairs are too finely defined and don't quite fit the dream like nature of the game."

> "but, i think the bones of it are right. few things for the next session to work on,
> 1) the design of the stairs
> 2) the feeling of climbing up the stairs a bit longer through the clouds. The wind, audio, visual effects as they go through and emerge on top into that beautiful peaceful cloud duvet scene. It should feel expansive and airy (audio is probably a lever to tune here)
> 3) flying / sailing ontop of the clouds should be refined a bit more. It should be a slightly longer, more beautiful journey. Maybe the sailboat can be modified tastefully just for this journey to look more like an air ship / air boat instead of just the same sail boat
> 4) The transition to the drowning island needs a better look at it. Right now, it's very obvious to the player that they are being invisibly dropped (the downward motion is seen and felt) through the clouds instead of the dreamlike nature of sailing through clouds and fog and suddenly emerging into the drowning village."

> "More thought and intentionality is needed also around how the player interacts with the stairs to move them into place. Right now, the perspective makes it very hard to do this. This is a problem we solved with the bubbles and the stars in the sky mirror chapter, so we should take inspiration from that (the player can basically in effect click and drag the bubbles over the stars)"

> "the sky mirror is also very good at placing the camera at just the right position so that the player has the right perspectiv eto move the bublbe intot he right place."

Shown three stair directions (A floating treads, B stairs made of cloud, C soft toy staircase) and three air boats
(`assets/art-direction/stairs-concept-c.png`, `stairs-airboat-concepts.png`):

> "I think C should be the direction. It should feel like the stairs that a child would dream about. It'd be cool to see if you can get it turning into B (cloud stairs) convincingly, but it has to be done really well or else it's not worth it. Also, i noticed that the child picks up the cygnet and puts it down outside of the stairs (in mid air), because the stairs are kinda small in those areas and dont have space for the child to move around. The way they disappear into the clouds in the concept is really nice too. If we can get dynamic "clouds" moving across during the ascent that would be quite nice. It should feel like like an emotional release / entering another world once the child climbs through to the top of the stairs. Same feeling i think as flying through the storm and emerging into the eye of the storm where it's eerily calm. The climb through teh clouds doesn't need to be stormy, maybe claustrophic and a bit scary with no visibility and a fair bit of wind, but it'd be good to capture the same kind of feeling when you finally climb above it all. I leave the details and the pacing to you."

On the air boat, after animating each concept himself:

> "I feel like the boat on the right with the lantern and the kite sailing through the clouds feels the best (if you can get a nice wake effect through the clouds as it sails through them). It may also be worth finally getting an opus 5.5 sub agent to have a look at improving the visuals of the sail boat (right now it's quite simple looking). The improved sailboat doesnt need to be super detailed and high definition, but i do think we need to target a higher quality bar. "

> "question, do you reckon you could throw in a fun little penrose stairs sequence in there for fun? I'm envisioning the cygnet running around and getting confused / making noises"

Asked where the Penrose stairs should go (an opener on the grass, inside the cloud, or on top in the calm), he chose
**inside the cloud**.

> "next session to continue working on the stairs chapter. I'd like to get it looking more like the concept art `/tmp/updraft-stairs-concepts/stairs-c.png`"

(Kept at `assets/art-direction/stairs-concept-c.png`.) On the stills that followed:

> "yep, i think
> - the cloud duvet looks a little too much like a literal duvet, which is a nice dreamlike texture, but could be dialled back a bit. From below, it looks like a white sheet instead of a beautiful cloud layer with beautiful reflected sunlight
> - In hte concept art, the first part of the stairs has an instant visual direction to it (it's going up and forwar). In the game, the stairs go forward, then back again (the visual direction isn't clear, or leading to the player). And honestly, seeing the underside of a staircase so blankly doesn't make for a great screenshot when we add photo mode later.
> - The stairs that have been built in hte game also don't have those thicker bannisters and pillars that the concept art have (which makes the in game stairs feel a bit thin
> - the ingame staircases try to emulate cloud fog but it just reads as very small and regular puffs of fog instead of a nice volumetric haze (it doesn't look good and i know you can do a lot better
> - the platforms between stairs are completely missing a railing.
> - I don't see the penrose stairs. How did you fit that into the gameplay?
> - I see the cygnett getting carried up the stairs, but shouldn't it be walking up itself for this one?"

Asked what the Penrose stairs should be, he chose **"Visible loop, playable"**: a clearing in the cloud with a ring
of stairs, the camera holding the one angle where they seem to climb forever; the bird runs round and keeps
arriving back behind the child until the player's wind blows the cloud off the corner where the real flight goes
on up; then the camera eases round and the loop comes apart. Asked which layout answers "the stairs go forward,
then back again", he chose **"Up and onward"**: every flight climbs away from you, zigzagging left and right toward
the cloud and never coming back, a path into the sky out over the sea.

After playtesting by hand (2026-09-27):

> "- The penrose stairs causes the cygnet to teleport down. Visually, it doesn't look like penrose stairs at all. Also, there's no invitational gesture that lets the player know they have to blow away some fog.
>
> - They sail around in circles in the clouds, and the camera is stuck in one close up position the whole time. It's completely fails to capture the beauty of this journey.
>
> - It's still very obvious that they are descending through the clouds instead of into some fog."

On a still of the loop (2026-09-28):

> "I need you to tidy up the penrose stairs in the stairs chapter. It doesn't look quite right. The bannister is missing, the clouds are on the corner ofthe penrose stairs insead of over the exit, and the cygnet is walking ontop of the clouds which looks a bit strange. The cygnet is also walking outside of the bounds of the stairs at the start of the penrose stairs loop, and when the cygnet rounds the third corner it is walking ontop of the bannister there."

> "Also, when the camera moves down to reveal the penrose stairs, the penrose stairs model is sort of see through (it looks buggy)."

Shown the loop with rails on the inside of the ring as well, he chose none, and no posts at its inside corners.

On the room as it is on `main` (2026-09-28), before it goes into the chapter select:

> "- I think the starlings are ok i think.
>
> Before putting the stairs room in the chapter select, I need you to take a look at fixing the journey that the child takes through the clouds.
>
> - For most of it, the camera is up close and you never get to see the rolling cloudy expanse, and the journey seems a bit too much like a straight line. There's currently not much of a unique feel to "sailing ontop of the clouds".
> - The audio and the trails left by the boat make the clouds feel more like snow than clouds
> - Part of the feeling of it being snow instead of cloud is also probably because the "shape" of the clouds is a bit "flat" but im not sure what the performance implications of uplifting this area is. Might be worth exploring with a sub agent.
> - As the camera breaks through the cloud cover, the boat and everything suddenly render in, which doesn't look good. Either have the boat arrive at the jetty from off camera, or have it not just suddenly load in. The boat is also a bit far from the jetty i think (there's a bit too much gap between the jetty and the boat)
> - There's some kind of render bug (it looks like it's related to render distance), where parts of the cloud that are beyond a certain range that now come into that render range suddenly get drawn in a completely different position / state. This makes the experience very stuttery.
> - I don't like that as you go through teh clouds, you can see them moving alot, but then as you emerge everything goes still and you have to create wind to drive the boat. I think the player shouldn't need to create wind to drive this part of the game, they should just be able to sit back and enjoy the beautiful experience. Maybe also have the child and the cygnet look like they are "enjoying" the experience too e.g. leaning on the side of the boat looking out or something."

On the heap on the loop, which blew away and heaped itself back up (2026-09-28):

> "It's really strange how the cloud heaps come back when you brush them away. why not just don't let that happen to begin with? i.e. player cannot generate wind and brush them away until it's safe to do so??"

On the reworked sail (2026-09-29):

> "It's beautiful. I only noticed one consistent issue is that the cloud seems to clip into the boat and fill teh bottom of it. It's especially noticeable when the boat is sailing into the nest."

On the top landing (2026-09-29):

> "On the stairs chapter, there are two things going on at the cloud nest.
> 1. the boat sails towards the player
> 2. the swan flying v flies from left to right.
>
> What this means is that the player's attention is drawn to the boat with the red sail moving towards them, and they completely miss the visual and emotional impact of the callback of the swans flying across from left to right. I need you to have a think about how to space these two things out so that they aren't competing for the player's attention. My feeling is that we should have the swans fly across first with the existing subtle camera dolly to draw the players attention. And then halfway through their flight the boat comes out of the clouds sailing towards them. However, if you feel there's a better way to direct this scene feel free to explore.
>
> Also, i noticed that once the child reaches the nest, they instantly sit down and we lose the opportunity to have an otherwise nice moment for the child to enjoy the clouds and sit down. It's so fast that to the player, it doesn't even read as the child sitting down and hanging their legs off the jetty playfully.
>
> The player should be allowed a moment to feel awe and take in the cloud top scene, and then enjoy both of the events after that. Not too slow, not too quick. We need just the right pacing here."

Playing the first pass of that:

> "1) The camera does a pan / zoom into the child child's face before instantly backing out the same way. The golden rule of this game is that every camera movement must be intentional. This should not happen. Also, consider that we should really be going the other way. from somewhat close up on the child and it's face to showing the wider world. Do you understand what i mean?
> 2) Previously, the flying v swans would appear literally from the left side of the screen and teh camera would slowly pan up and across with them. I want that. It still currently feels a bit too rushed. give it a bit more space and pacing."

> "yea on point 2, the original sequence for the swans was really good."

On the second pass, which turned onto her face as she came out of the white:

> "sigh... up top, it's a bit better, but not only did you mess up the camera when the child is moving up the stairs, but the swans don't come in from the left of the screen like originally"

> "The swans appear out of thin air, and we lose the look out over the cloud when the child comes out of the gold white out."

Asked how to have both main's look out over the cloud and her face and feet on the lip (which only show from in
front):

> "why not try look out, then side on sit, but instead of the camera drifting around her left, let it drift around her right? then the swans can naturally come in no?"

On that, with the swans coming in from behind the landing and flying on into the sun:

> "ok better, but the swans need to be flying in the same direction the boat is going... that was the idea of the swans flying in more of a left to right direction. The feeling is that the swans are going somewhere and you are going there too."

Then, asked how: "ok nevermind, this is good merge into main".

## Where it sits

Birches → **stairs** → drowned village. Deep autumn, the afternoon going. The birches took the last of the year off
the trees and gave the boat its red sail; the drowned village is dusk, the dead air and the storm that takes the
plane. The stairs are the last warm light before all of that: the room climbs out of the weather into the last sun
of the year, and then goes down into the dark.

## What it is about

Bedtime: going upstairs alone as a child, up into somewhere you cannot see. And **the smaller one is brave first.**
Until now the child has carried the cygnet everywhere. Here, where the stair goes up into the white and the child
stops, the cygnet goes up first and waits. In the dark wood the child returns it; on the sleeping island the bird
brings the light. Courage passes back and forth between them, and the stairs are where it starts.

## The room, beat by beat

1. **Under the cloud.** A short blind hop from the birches (`toStairs`) runs the boat under a low cloud deck onto a
   small grassy island. The child sets the cygnet down; here it goes on its own feet the whole way. They look up. A
   soft toy staircase (chunky rounded steps with their blocks showing underneath, a dusty-rose runner, fat honey
   rails both sides on round balusters, big knobbed newels, rails round every landing, no house) climbs up and
   onward: each flight goes off to one side, turns on a landing, and the next goes off to the other, zigzagging
   toward a ceiling of cloud lit gold where the low sun slips under its edge. Three flights climb from the grass,
   two come down out of the cloud, and between them three have come loose and hang turning in the air.
2. **The loose flights (the puzzle).** The child climbs to where the stair stops; a gold drawing of the missing
   flight shows where it belongs; a stroke over the loose flight carries it on its own level, and it turns itself
   to fit as it nears its place. The bird waits on the landing behind. The last one placed plays the reward phrase.
3. **Into the cloud.** On the last landing below the white the child steps aside and hangs back, looking up; the
   bird comes past, looks up too, goes up into the white first, and waits.
4. **The loop (the Penrose stairs).** Halfway up the white the stair comes into a hollow of clear air, onto the
   corner of one ring of stairs (sides of 4 and 12 steps, corners no wider than a flight, stepped ends showing, a
   rail round the outside only). The child waits a few treads down the flight below the near corner. The lens rises
   out of the white to the one place from which the ring climbs for ever, and holds dead still. The bird runs up
   and round and comes back onto the corner it left, right over the child; it looks up the way it went, back the
   way it came, and down at her, and asks with a small questioning peep. They both look across at a heap of cloud
   sitting on the first treads of the way on; a sweep is drawn across it. Until then no wind moves the heap. Blown away, the heap shows a flight going
   on up that nobody could see; next time round the bird takes it, the child follows, and the lens comes round and
   down beside the ring while its last flight lets go of the trick and is seen to climb on past the corner and stop
   in the air a storey too high. The hollow closes once the lens is back in the white.
5. **Above the clouds.** Up out of the white through mist that thins as they rise (the deck's crown), out of the
   wind into a vast calm, the cloud still drifting on a soft air. One thing at a time, each given room:
   - *The look out* (about 7 s). The lens rises out of the mist behind her and draws back as the cloud opens out
     to the sun, and settles low behind her with the sun in the frame. A step from the edge she stops and looks
     slowly right across it all, then at the bird beside her.
   - *Sitting* (about 11 s). A pair of slippers; the bird settles in one and she lowers herself onto the lip beside it
     (over 1.4 s, not a drop), her feet hanging over the cloud and swinging in little runs (Jeremy: "the child should
     set on the lip with her feet dangling in the cloud, and the cygnet next to her"). As she sits the lens drifts
     round her right, away from the sun (`toHerSide`), keeping its height until it is past the rail and then coming
     down a little in front of her side: her face, her feet over the lip, the bird beside her. The slippers are on
     her right, where the stowed paper does not hide the bird, and a bird's width clear of her coat.
   - *The swans.* A skein comes from behind the landing, low over the cloud off to her left, and flies on toward the
     sun, where the boat will take them. It comes in at the top left of her side view; once it is well into the
     frame the lens goes with it (`withTheSwans`), panning up and across and back round behind her as far as the
     swans have come round toward the sun, turning and tilting only as far as keeps them in the frame, until it is
     looking up past her at the sky they are going into. The bird sees them first and calls to them as the lens
     starts to go with them (Jeremy: "when the swans fly in, lets have the cygnet make a call"); she follows its look and her
     feet go still.
   - *The boat.* Once the lens has come to rest over her shoulder into the sun, it holds there a few seconds
     (Jeremy: "hold that shot for maybe 5-7 seconds before the boat appears out of the clouds"); then the boat
     comes out of the foot of a tower of cumulus to the right of the sun (it has waited inside, hidden, since they
     came up) and sails in toward them, the kite with it. A few seconds after it sets off she turns to the bird,
     still looking where the swans went, then to the boat; her feet swing again. The lens comes round to their faces as it slows and lies right alongside the landing's edge.
6. **The sail over the cloud.** The kite draws them the whole way; nobody needs to blow (a gust still adds a
   little). Off the landing in one slow turn to port, then a long wander across the open cloud toward the low sun:
   out to port among the heaps, back across to starboard between towers of cumulus, and straight on into a bank of
   mist standing on the cloud (about 350 m, two minutes). The hull rides the billows, down in the tops, parting them.
   Under way the bird hops up onto the gunwale on the sunward side and the child turns to that side, arms on the
   rail, both looking out toward the sun; now and then she looks at the bird. The lens is mostly far off, so the
   cloud is seen going on for ever round a small boat: ahead of them looking back at the stair; up and away on the
   sunward side; down beside them, low over the tops; up and round astern while they sail between the towers; and
   down behind them as the bank looms. As it does, the bird comes back into her arms.
7. **Into the mist and out onto the village's water.** They sail into the bank level until there is nothing but
   white. Unseen, the boat is put down on the sea where the village begins (the one camera cut); the gold of the
   cloud turns to the grey and blue of dusk, water shows under the hull, and they sail out of the back of the bank
   into the drowned village at sunset.

## Principles

- Wordless. The cygnet's voice is heard twice: in the loop, where it asks with a small questioning peep
  (`Cygnet.call(false, 'puzzled')`: the bill opens and the call marks show, but only the peep is heard; it is
  puzzled, not frightened), and on top, calling to the swans as the lens starts to go with them (`call(true)`).
- No failure, no timer that solves anything, no maze; the ghost flight says where each piece goes.
- The cygnet never flies here and is never lifted by the wind: flight belongs to the sleeping island and home.
- Every gesture is answered: gusts move the flights, tear cloud wisps, fill the sail.
- The pieces the player moves are dragged like the sky mirror's bubbles, from a camera placed for it.

## How it is built

- **Layout** (`src/world/stairs-layout.ts`): the stair is a list of flight specs (`SPECS`: which way, how many
  risers, which face of its landing the next leaves by); `flight(i)`, `landingOf(i)` (in the landing's own frame,
  with `openings` where flights meet it and `bare` sides), `onLanding`. `LOOSE` are the loose flights, `BELOW_CLOUD`
  the last below the white, `LOOP` the ring (its corner, where the child waits, where the way on leaves); the far
  side only the bird walks is `LOOP_FAR` and `LOOP_BACK`; `LOOP_GAP` runs from the near corner to where the loop's
  last flight really arrives, a whole round higher and toward the eye. `CORNER` is the ring's corner size.
- **The loop's trick** (`src/world/stairs-penrose.ts`): the eye (`LOOP_EYE`) stands on the line of `LOOP_GAP`, so
  the top of the last flight lies exactly in front of the near corner; that flight is drawn in (`drawIn`) toward a
  copy of the corner shrunk about the eye (`toCopy`, `LOOP_SHRINK`), so from the eye it covers the corner exactly.
  It depth-tests as if it stood where it seems to (`TRICK`, `aDepth`), so the corner's newel and the flight below
  stand in front of it; that faked depth lets go as the lens leaves the one place (`uTrueDepth`), and `undraw`
  lets the flight climb on past the corner. `CloudStairs.trick` is drawn only while the lens is there. Its rail has
  rings all along it (`RING_RAIL`) so it bends with the flight. The bird is drawn smaller up that flight
  (`Cygnet.scale`, `sizeOnBack`), walks it on short strips that follow it (`loopDecks`), and at its top is put on
  the corner along the same sightline (`fromCopy`); over the loop it is not pulled toward the lens (`Cygnet.nudge`).
  The lens is `Shot.zoom` with `Shot.exact` for the hold. The heap over the way on (`LOOP_BANK`,
  `src/world/stairs-bank.ts`) is volumetric cumulus (`hazeHeapMaterial`) that a stroke carries away; `hideTop`
  keeps the deck's top surface out of sight while the lens is up there. No rails or posts on the ring's inside
  (`buildLanding`'s `ring`).
- **World**: `src/world/stairs.ts` (flights, landings, loose flights and ghost, slippers, the trick),
  `stairs-cloud.ts` (the deck's underside and top, the parting behind the hull, `FogBank`), `stairs-haze.ts` (volumetric
  haze), `stairs-puffs.ts`, `stairs-wisps.ts` (cloud streaming past in the white), `stairs-wake.ts`,
  `stairs-lantern.ts` (the glow on the boat's own lantern). Chapter: `src/story/stairs.ts`, the sail's lens
  `src/story/stairs-sail.ts` (`SAIL_SHOTS`), the bird's line up the stair `src/story/stairs-track.ts`. Knobs:
  `tuning.stairs`.
- **Order**: birches → `toStairs` (short hop east; the deck comes down over the sea; it carries the birches' closing
  phrase) → `stairs` → drowned, which takes over wherever the fog leaves the boat. `?chapter=drowned` starts at
  `DESCENT_END`.
- **The cloud deck** is analytic, in the shared fog (`cloudDeck` in `atmosphere.ts`) and the sky: a slab whose
  fringe thickens with height (so its underside has no edge), clipped to a disc, with a pocket of thinner cloud
  round whoever is inside (`bubble`, its thickness `clearing`). Under it the low sun comes in at about half
  strength. The chapter asks for the deck each frame (`CloudDeckState`; `snap` sets it at once).
- **Loose flights**: `CloudStairs.brush` reads the stroke on the flight's own level and eases the waited-for
  flight's velocity to it (the others move at `stir`); `update` turns it to fit inside `alignFrom` and draws it in
  when close and recently worked.
- **Walking on stairs**: `Deck.height1` makes a strip a flight; neither walker steps off a raised edge
  (`offTheEdge`), and the bird turns almost on the spot there (`mayStep`). It is routed stop by stop and drops an
  errand within 0.45 m, so arrival is checked at 0.5 m. `Cygnet.standAt` puts it somewhere at once.
- **The sea of cloud**: its top (`StairsCloud`) is drawn on world-anchored nested grids (`cloud-grid.ts`), so far
  heaps never jump as the lens moves; its lobes are baked into tiling textures at load (`cloud-lobes.ts`) and drift
  on the air (`tuning.stairs.cloudDrift`) under a veil of wisps. The towers are raymarched cumulus
  (`cloud-towers.ts`) placed off the route and either side of `TOWER_GATE`; `CloudTowers.keepOut` keeps the lens out
  of them. The hull parts the tops in a trough that fills in behind, with a breath of vapour off the stern
  (`stairs-wake.ts`, `cloud-vapour.ts`); the top is never drawn inside the hull (`StairsCloud.holdOut`, the boat's
  own planform). `surfaceAt(x, z)` gives the top as drawn: the hull rides the billows on it and the lens keeps over
  it. Coming out on top the deck thins away over `tuning.stairs.crown` metres above its top (`uCloudCrown`) and
  clears over seven seconds, so the lens rises out of mist rather than through a ceiling.
- **The sail**: the route is `CLOUD_ROUTE` (the turn off the landing, then a Catmull-Rom wander through `MEANDER`),
  the bank's front `FOG_BANK`. The boat waits hidden in the foot of the nearest tower a little right of the sun
  (`harbour`) from the moment they come out on top, and once the swans are on their way into the sun (`BOAT_SETS_OFF`) sails
  out of it in to `CLOUD_BERTH` (`comeAlongside`); `Chapter.kiteTow` ties the kite to the bow, and under sail the kite
  draws them at `kiteDraws`. The lens is authored by how far they have come (`SAIL_SHOTS`, blended the short way
  round). Under way the bird perches on the starboard gunwale and the child turns to it (`lookOut`). The bank is an
  analytic volume in the shared fog (`fogBank`, folded into `cloudDeck`). At `bankSwap` metres in, the boat and the
  bank are moved down onto the sea by the same offset, so the white is unchanged (`Chapter.cameraCut` lets the story
  cut where nothing can be seen); the deck goes under the water and the village shows from then on without its
  arrival veil (`stairsDescent` in `world/journey-rooms.ts`).
- **Sound**: `src/audio/stairs-sound.ts` and `stairs-score.ts` behind `StairsAir` (phase, cloud, climb, open, fog,
  speed), rendered with `tools/stairs-audio-proposal.mjs`; the contract is in `docs/contracts/audio.md`.
- **Checking**: `node tools/stairs-check.mjs <prefix>` plays the room with real drags against a dev server
  (`BASE=`), captures each beat, blows the heap off the loop when the sweep is drawn, and shoots the fog; `FROM=n`
  starts with n flights home, `UNTIL=n` stops after n, `TRACE=1` logs the flights. Capture from a separate worktree
  with its own server while editing.

## Open

- The sail's air over the cloud awaits Jeremy's listen in the game.
- The paper plane in the satchel shows as a bright white triangle on her back.
