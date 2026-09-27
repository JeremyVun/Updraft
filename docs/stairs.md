# The stairs in the clouds

Read this first after any context loss while building this room. It is the brief, the concept and the build state.
Branch `stairs`, worktree `/private/tmp/updraft-stairs`. Nothing here is on `main` yet.

## Jeremy's words (2026-09-27, verbatim)

> "How would the stairs into the clouds even work? like how do you, after climbing into the clouds, get baack to the drowned island on the ground? Or is it stairs up, then we use the moment to remind the player that the cygnet can't fly, and then they have to find the stairs down somehow?"

The answer he responded to: the boat is waiting at the top. The kite, which marks the boat on every departure, is
already flying above the cloud; at the top the boat floats on the cloud as if it were water; they sail across it
into the sunset and sink down through it onto the dusk water of the drowned village. No hunting for a way down, and
no "the cygnet can't fly" beat, which belongs to the home reunion.

> "Very interesting idea with the stairs into the clouds. Can you build this experience out in a worktree and then show me?"

> "I want you to take creative ownership here as well to make the cloud stairs chapter really beautiful and a standlone experience in it's own right that has it's own puzzle and moments between the child and cygnet that fit within and add to the overall game. Emotionally and narratively."

Also, on a playful winter room: "the problem with having a snowman after the sleeping island is that the curtain
opening is the greening moment that moves the game from winter to spring." (So no snow play after the sleeping island.)

## Jeremy's first reaction (2026-09-27, verbatim)

> "I feel like the stairs are too finely defined and don't quite fit the dream like nature of the game."

Then (2026-09-27, verbatim):

> "but, i think the bones of it are right. few things for the next session to work on,
> 1) the design of the stairs
> 2) the feeling of climbing up the stairs a bit longer through the clouds. The wind, audio, visual effects as they go through and emerge on top into that beautiful peaceful cloud duvet scene. It should feel expansive and airy (audio is probably a lever to tune here)
> 3) flying / sailing ontop of the clouds should be refined a bit more. It should be a slightly longer, more beautiful journey. Maybe the sailboat can be modified tastefully just for this journey to look more like an air ship / air boat instead of just the same sail boat
> 4) The transition to the drowning island needs a better look at it. Right now, it's very obvious to the player that they are being invisibly dropped (the downward motion is seen and felt) through the clouds instead of the dreamlike nature of sailing through clouds and fog and suddenly emerging into the drowning village."

And (2026-09-27, verbatim):

> "More thought and intentionality is needed also around how the player interacts with the stairs to move them into place. Right now, the perspective makes it very hard to do this. This is a problem we solved with the bubbles and the stars in the sky mirror chapter, so we should take inspiration from that (the player can basically in effect click and drag the bubbles over the stars)"

And (2026-09-27, verbatim):

> "the sky mirror is also very good at placing the camera at just the right position so that the player has the right perspectiv eto move the bublbe intot he right place."

Shown three stair directions (A floating treads, B stairs made of cloud, C soft toy staircase) and three air boats
(wings, quilt balloon, kite-drawn with a lantern) as concept art (`/tmp/updraft-stairs-concepts/`), Jeremy answered
(2026-09-27, verbatim):

> "I think C should be the direction. It should feel like the stairs that a child would dream about. It'd be cool to see if you can get it turning into B (cloud stairs) convincingly, but it has to be done really well or else it's not worth it. Also, i noticed that the child picks up the cygnet and puts it down outside of the stairs (in mid air), because the stairs are kinda small in those areas and dont have space for the child to move around. The way they disappear into the clouds in the concept is really nice too. If we can get dynamic "clouds" moving across during the ascent that would be quite nice. It should feel like like an emotional release / entering another world once the child climbs through to the top of the stairs. Same feeling i think as flying through the storm and emerging into the eye of the storm where it's eerily calm. The climb through teh clouds doesn't need to be stormy, maybe claustrophic and a bit scary with no visibility and a fair bit of wind, but it'd be good to capture the same kind of feeling when you finally climb above it all. I leave the details and the pacing to you."

On the air boat, after animating each concept himself (`~/Desktop/cloud-boats.mp4`):

> "I feel like the boat on the right with the lantern and the kite sailing through the clouds feels the best (if you can get a nice wake effect through the clouds as it sails through them). It may also be worth finally getting an opus 5.5 sub agent to have a look at improving the visuals of the sail boat (right now it's quite simple looking). The improved sailboat doesnt need to be super detailed and high definition, but i do think we need to target a higher quality bar. "


Mid-build (2026-09-27, verbatim):

> "question, do you reckon you could throw in a fun little penrose stairs sequence in there for fun? I'm envisioning the cygnet running around and getting confused / making noises"

Offered an opener on the grass (recommended), inside the cloud, or on top in the calm, he chose **inside the cloud**.

After the second pass's stills (`/tmp/updraft-stairs-show2/`) and the sound render, Jeremy's handoff note
(2026-09-27, verbatim): "next session to continue working on the stairs chapter. I'd like to get it looking more like
the concept art `/tmp/updraft-stairs-concepts/stairs-c.png`" (kept at `assets/art-direction/stairs-concept-c.png`).

Then, on the second pass's stills (2026-09-27, verbatim):

> "yep, i think
> - the cloud duvet looks a little too much like a literal duvet, which is a nice dreamlike texture, but could be dialled back a bit. From below, it looks like a white sheet instead of a beautiful cloud layer with beautiful reflected sunlight
> - In hte concept art, the first part of the stairs has an instant visual direction to it (it's going up and forwar). In the game, the stairs go forward, then back again (the visual direction isn't clear, or leading to the player). And honestly, seeing the underside of a staircase so blankly doesn't make for a great screenshot when we add photo mode later.
> - The stairs that have been built in hte game also don't have those thicker bannisters and pillars that the concept art have (which makes the in game stairs feel a bit thin
> - the ingame staircases try to emulate cloud fog but it just reads as very small and regular puffs of fog instead of a nice volumetric haze (it doesn't look good and i know you can do a lot better
> - the platforms between stairs are completely missing a railing.
> - I don't see the penrose stairs. How did you fit that into the gameplay?
> - I see the cygnett getting carried up the stairs, but shouldn't it be walking up itself for this one?"

Asked (2026-09-27) what the Penrose stairs should be, given that they were only a scripted beat in the white with
nothing impossible to see, Jeremy chose **"Visible loop, playable"**: a clearing in the cloud with four short flights
round a square, the camera holding the one angle where they seem to climb forever; the bird runs round and keeps
arriving back behind the child, peeping, until the player's wind blows the cloud off the corner where the real
flight goes on up; then the camera eases round and the loop comes apart.

Asked which layout answers "the stairs go forward, then back again", he chose **"Up and onward"** over a side-on
zigzag like concept C: every flight climbs away from you, zigzagging left and right toward the cloud and never
coming back, more a path into the sky, walking out over the sea.

After playtesting the third pass by hand (2026-09-28, verbatim):

> "- The penrose stairs causes the cygnet to teleport down. Visually, it doesn't look like penrose stairs at all. Also, there's no invitational gesture that lets the player know they have to blow away some fog.
>
> - They sail around in circles in the clouds, and the camera is stuck in one close up position the whole time. It's completely fails to capture the beauty of this journey.
>
> - It's still very obvious that they are descending through the clouds instead of into some fog."

## Where it sits

Birches → **stairs** → drowned village. Deep autumn; the afternoon going. The birches took the last of the year off the
trees and gave the boat its red sail; the drowned village is dusk, the dead air and the storm that takes the plane.
The stairs are the last warm light before all of that: the room climbs out of the weather into the last sun of the
year, and then goes down into the dark.

## What it is about

Bedtime. Going upstairs alone as a child: the stair that goes up into somewhere you can't see.

And **the smaller one is brave first.** Until now the child has carried the cygnet everywhere. Here, where the stair
goes up into the white and the child stops, the cygnet gets down and goes up first, and waits. In the dark wood the
child returns it (goes into the dark first so the bird won't have to); on the sleeping island the bird brings the
light. Courage passes back and forth between them; the stairs are where it starts.

## The room, beat by beat (third pass)

1. **Under the cloud.** A short blind hop from the birches runs the boat under a low cloud deck onto a small grassy
   island. The child sets the cygnet down on the grass (in this room it goes on its own feet the whole way), and
   they look up. A staircase a child would dream about (soft toy flights: chunky rounded steps with their blocks
   showing underneath, a dusty-rose runner, fat honey rails both sides on a few round balusters, big knobbed newels,
   no house) climbs up and onward away from them: each flight goes off to one side, turns on a railed landing, and
   the next goes off to the other, zigzagging north toward a ceiling of cloud lit gold where the low sun slips in
   under its edge. It never comes back toward you. Two flights stand on the grass; two more come down out of the
   cloud; between them three have come loose and hang in the air, turning slowly.
2. **The loose flights (the puzzle).** As the second pass: the child climbs to where the stair stops, a gold drawing
   of the missing flight shows where it belongs, a stroke over the loose flight carries it with the stroke on its
   own level, and it turns itself to fit as it nears its place. The bird waits on the landing behind the child.
3. **Into the cloud.** On the last landing below the white the child steps aside into its far corner and hangs back,
   looking up; the bird comes past them, looks up too, and goes up into the white first, and waits.
4. **The loop (Jeremy's Penrose stairs).** Halfway up the white the stair comes up into a hollow of clear air, onto
   the corner of a ring of stairs, two short sides and two long, with a rail round its outside and every step's end
   showing. The child stops a few treads short of the corner. The lens rises out of the white behind them to the one
   place high over the ring from which it climbs for ever, and holds there dead still. The bird runs on up and round:
   up, and up, and up, and up, and comes up onto the corner it set off from, right over the child. It looks up the
   way it went, back the way it came, and down at her, and asks (a small questioning peep); they both look across at
   a heap of cloud sitting on the far corner, and a sweep is drawn across it. Round again. Blown off, the heap shows
   a flight going on up from that corner that nobody could see; next time round the bird takes it, the child
   follows, and the lens comes round and down beside the ring while its last flight lets go of the trick and is seen
   to climb on past the corner and stop in the air, a storey too high.
5. **Above the clouds.** As the second pass: out of the wind into a vast calm; the slippers; the bird settles in one,
   the child sits beside it; a skein goes north across the sun; the boat waits on the cloud under the kite.
6. **The sail over the cloud.** Off the landing in one slow turn to port, away from the stair, then a long straight
   run toward the low sun (about 300 m, a minute or more of sailing), the player's gusts filling the sail. Far ahead
   a bank of mist stands on the cloud sea, and the sun goes down into its top as they come. The lens goes once
   round the boat and never back: ahead of them looking back at the stair standing out of the cloud; across the bow
   in close to their faces in the lantern light and the sun, with heaped towers crowding the way behind them; up
   and away astern until the boat is small on the cloud under the sun, the bank on the horizon; and down behind
   them as the bank looms.
7. **Into the mist and out onto the village's water.** They sail into the bank level: the bow and the lantern go
   into the white first, then the child, until there is nothing but white. There, unseen, the boat is put down on
   the sea where the village begins (the one camera cut), in the same white. It turns from the gold of the cloud to
   the grey and blue of dusk, the water shows under the hull, and all at once they sail out of the back of the
   bank into the drowned village at sunset.

## Principles this room keeps

- Wordless. The cygnet never calls here (its one unanswered call belongs to the sleeping island); in the loop it
  only asks, with a small questioning peep (`cue('puzzled')`).
- No failure, no timer that solves anything, no maze; the ghost flight says where each piece goes.
- The cygnet never flies here and is never lifted by the wind: flight belongs to the sleeping island and home.
- Every gesture is answered: gusts move the flights, tear cloud wisps, fill the sail.

## Build notes

- Layout: `src/world/stairs-layout.ts`. The stair is a list of flight specs (`SPECS`: which way, how many risers,
  which face of its landing the next leaves by); `flight(i)`, `landingOf(i)` (in the landing's own frame, with
  `openings` where flights meet it and `bare` sides), `onLanding`. Fifteen walking flights: `LOOSE` 3–5,
  `BELOW_CLOUD` 7, the loop `LOOP` (corner 9, the child waits on 10, the way on leaves 11). The loop's far side,
  which only the bird walks, is `LOOP_FAR` and `LOOP_BACK`; `LOOP_GAP` runs from the near corner to where its last
  flight really arrives, a whole round higher and toward the eye.
- The loop's trick: `src/world/stairs-penrose.ts`. The eye (`LOOP_EYE`) stands on the line of `LOOP_GAP`, so the
  top of the last flight lies exactly in front of the near corner; that flight is drawn in (`drawIn`) to a copy of
  the corner shrunk about the eye (`toCopy`, `LOOP_SHRINK`), so from the eye it covers the corner exactly. It works
  from nowhere else, so `CloudStairs.trick` is drawn only while the lens is there and until they are on past it.
  The bird is drawn smaller up that flight (`Cygnet.scale`, `sizeOnBack`) and at its top is put on the corner itself
  along the same sightline (`fromCopy`). The long sides are long in steps, not walkways, which is why it is seen from
  about 62° up. The lens: `Shot.zoom` (a longer focal length, eased), `Shot.exact` for the hold. While the lens is up
  there the story deepens the deck over and under it and opens the pocket round it; `CloudStairs.hideTop` keeps the
  cloud's top surface out of sight. The heap on the far corner: `src/world/stairs-bank.ts`.
- World: `src/world/stairs.ts` (the toy flights, landings, loose flights and ghost, slippers, the loop's trick),
  `stairs-cloud.ts` (the deck's underside over the island and its top under the sunset, the hull's furrow),
  `stairs-puffs.ts` (soft cloud cards), `stairs-wisps.ts` (the cloud streaming past in the white),
  `stairs-wake.ts` (spray off the hull), `stairs-lantern.ts`. Chapter: `src/story/stairs.ts`. Feel knobs:
  `tuning.stairs`.
- Order: birches → `toStairs` (short hop east, the deck comes down over the sea; it carries the birches' closing
  phrase) → `stairs` → drowned, which takes over wherever the fog leaves the boat. `?chapter=drowned` starts at
  `DESCENT_END`.
- The cloud deck is analytic, in the shared fog (`cloudDeck` in `atmosphere.ts`) and the sky: a slab whose fringe
  thickens with height (so its underside has no edge), clipped to a disc, with a pocket of thinner cloud round
  whoever is inside (`bubble`, its thickness `clearing`; only the inner 0.6 of the pocket is fully clear). Under it
  the low sun is let in at about half strength. The chapter asks for the deck each frame (`CloudDeckState`; `snap`
  takes its base at once).
- Loose flights: `CloudStairs.brush` reads the stroke on the flight's own level and eases the flight's velocity to
  it (only the waited-for flight; the others move at `stir`); `update` turns it to fit inside `alignFrom` and draws
  it in when close and recently worked.
- Walking on stairs: `Deck.height1` makes a strip a flight; neither walker steps off a raised edge (`offTheEdge`).
  The bird is routed stop by stop (it cuts corners) and drops an errand within 0.45 m, so arrival is checked at
  0.55 m. `Cygnet.standAt` puts it somewhere at once.
- The sail: the route is `CLOUD_ROUTE` (the turn, then `RUN_YAW`), the bank's front `FOG_BANK`, the towers along the
  way `TOWER_GATE`. The lens is authored by how far the boat has come (`SAIL_SHOTS` in `src/story/stairs-sail.ts`).
  The bank of mist is an analytic volume in the shared fog (`fogBank` in `atmosphere.ts`, folded into `cloudDeck`),
  driven by `FogBank` in `stairs-cloud.ts`: a slab beyond a line across the way, soft and heaving along its front and
  top, thicker over its floor, with the deck's pocket kept clear round the boat and the lens. At `bankSwap` metres
  in, the boat and the bank are moved down onto the sea by the same offset, so the white is unchanged; the deck is
  put under the water, and the village is shown from then on without its own arrival veil (`stairsDescent` in
  `journey-rooms.ts`). On the sea the bank's back comes to meet the boat and it sails out of it. Under sail the
  pointer lands about at the boom (`POINTER_OVER_HULL`), so strokes over the hull and across the sail both fill it;
  while the lens is below the sail on their faces the kite draws them on (`kiteDraws`).
- Over the cloud the boat rides at a fixed height (`RIDE`); `Chapter.kiteTow` ties the stairs' departure kite to the
  bow and flies it ahead; `Chapter.cameraCut` lets the story cut the camera where nothing can be seen (the swap to
  sea level in the fog).
- Sound: `src/audio/stairs-sound.ts`, `stairs-score.ts` behind `StairsAir` (phase, cloud, climb, open, fog, speed);
  the render `tools/stairs-audio-proposal.mjs`; the contract in `docs/contracts/audio.md`.
- `node tools/stairs-check.mjs <prefix>` plays the room with real drags against a dev server (`BASE=`), captures
  each beat, blows the heap off the loop when the sweep is drawn, and shoots the fog; `FROM=n` starts with n flights
  home, `UNTIL=n` stops after n, `TRACE=1` logs the flights. Capture from a separate worktree with its own server
  while editing (`/private/tmp/updraft-stairs-cap`).

## Status (2026-09-28, fourth pass, in progress)

- The loop, rebuilt so it reads as Penrose stairs:
  - It is one ring of stairs, not four railed landings with stubs of steps between. The corners are no wider than
    a flight with its rails (`CORNER`), and the sides are 4 and 12 steps.
  - There are no strings, so every side shows its stepped ends, and there is a rail on the outside of the ring only.
  - The child waits a few treads down the flight below the near corner (`waitBelow`), clear of the ring. The bird
    sets off from that corner, runs round and comes back onto it, right over her: up the way it went, back the way it
    came, at her, a questioning peep.
  - The drawn-in last flight depth-tests as if it stood where it seems to (`TRICK`, `aDepth`), so the corner's newel
    and the flight below stand in front of it. The copy of the corner is gone.
  - The hollow deepens to lilac below the ring, because the cloud's light is taken where a sightline leaves the
    pocket's clear heart.
- Jeremy's "teleport": from the one place, the swap onto the corner never moves the bird on screen (checked frame
  by frame). What read as a teleport was the loop not reading as a loop.
- The heap on the far corner is volumetric cumulus (`hazeHeapMaterial`), lumps with their own round heads that a
  stroke carries away. The sweep across it comes as soon as the bird is back where it started. It runs from the
  clear air on one side across the heap and out the other, drawn over it, and child and bird both look across at
  the heap before each new round.
- The reveal: once the bird finds the way on, the lens holds, then comes round and down beside the loop. Meanwhile
  the last flight lets go of the trick (`undraw`) and climbs on past the corner, ending in the air a storey too
  high. The hollow closes once the lens is back in the white.
- The sail and the way down into the fog are being redone on branch `stairs-sail`.

## Status (2026-09-27, third pass, in progress)

- Done on `stairs`, playing end to end with the driver (about 4.3 minutes): the stair climbs up and onward; fat
  rails both sides, big newels, rails round every landing, stepped undersides; the cygnet walks the whole way (it
  keeps to a line down the middle of the stair, `src/story/stairs-track.ts`, and goes along a rail rather than
  sticking at it); the Penrose loop, playable; the cloud's new look from above (a heaped sea of cumulus rather than
  a quilt) and from below (cells lit gold toward the sun, breaking into separate clouds away from the stair).
- In progress on its own branch: a volumetric haze under the flights to replace the puff cards (`stairs-haze`).
  The boat's look is another session's (`boat-look`).
- Open: the heap of cloud on the loop's far corner is still puff cards; the hesitation shot catches the child's
  back while they step aside.

## Status (2026-09-27, second pass)

- Built on branch `stairs`: everything in the beats above, playing end to end with the driver. The second pass
  replaced the look, the layout, the puzzle's interaction and camera, the climb, the top, the sail and the descent,
  and merged the room's sound (branch `stairs-audio`, render at `/tmp/updraft-stairs-audio-proposal/`).
- A sailboat visual upgrade is being done separately on branch `boat-look` (off `main`).
- Open: Jeremy to audition the sound and see the stills; the puzzle's own music (the birches' 18 s phrase loops
  through it); the paper plane in the satchel shows as a bright triangle; a performance pass; merge with the child
  rebuild on `main`.
