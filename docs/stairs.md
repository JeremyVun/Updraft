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

## The room, beat by beat

1. **Under the cloud.** A short blind hop from the birches runs the boat under a low cloud deck onto a small grassy
   island. From the grass a household staircase (carpet runner, stair rods, turned balusters, newel posts, no house)
   climbs in doglegs toward the underside of the cloud. The lower flights stand. Above them the staircase has come
   apart: its flights hang loose in the air under the cloud, still carpeted, still with their banisters, turning
   slowly like leaves on a pond.
2. **The loose flights (the puzzle).** The child climbs to where the stair stops. A pale ghost of the missing flight
   shows where it belongs. The player's gusts push the floating flights: a push moves one, a push on one end turns it.
   When it lines up it settles in with a soft wooden knock and a puff of cloud. Three flights: the first needs only a
   push, the second has to be turned, the third has drifted round behind the tower and must be brought back round.
   Progress holds, nothing drifts away, and the breeze alone never solves it. The little boats taught pushing hulls
   with gusts; this is the same verb on something that should never float. The cygnet cranes after each flight from
   the child's arms and greets each one that settles.
3. **Into the cloud.** The last flight leads up into the white. The child stops on the last step below it, can't see
   the stair above, and holds the bird tighter. The cygnet wriggles down, hops onto the next step and the next, into
   the white, then turns and waits: a small grey shape on the carpet. The child follows. Inside there is only the
   banister, the carpet and the bird a few steps ahead, waiting at each landing. The player's wind tears the wisps
   about but nothing needs it. No timer and no gesture gate; this beat is the bird's.
4. **Above the clouds.** They come out onto the top landing into the last sun of the year. The cloud lies to the
   horizon like a duvet, gold on top and lilac in its folds. On the top step is a pair of small slippers, a fragment
   of home. The cygnet climbs into one and settles in it like a nest; the child sits on the top step beside it. Far
   off across the sun a skein of swans goes north over the cloud. The cygnet lifts its head and watches them out of
   sight, then leans back against the child. The only beat that asks nothing of the player; it ends when the skein
   has gone.
5. **The boat on the cloud.** The kite has been flying above them all along. Beneath it, beside the landing, their
   boat floats on the cloud as if it were water, red sail slack. The child lifts the bird out of the slipper and
   boards; the slippers stay. The player fills the sail, and they sail over the cloud into the sunset. Then the cloud
   thickens around them and they sink through it, white going grey and blue, until the hull settles on dark water in
   fog and the first roof of the drowned village comes out of it. The drowned chapter begins there.

## Principles this room keeps

- Wordless; the cygnet is silent throughout (no call: its one unanswered call belongs to the sleeping island).
- No failure, no timer that solves anything, no maze; the ghost flight says where each piece goes.
- The cygnet never flies here and is never lifted by the wind: flight belongs to the sleeping island and home.
- Every gesture is answered: gusts move the flights, tear cloud wisps, fill the sail.

## Build notes

- Layout constants: `src/world/stairs-layout.ts`. World: `src/world/stairs.ts`. Chapter: `src/story/stairs.ts`.
- The cloud deck is analytic, in the shared fog (`atmosphere.ts`, `cloudDeck`), so everything in or behind it is
  covered consistently, sky included.
- `?chapter=stairs` starts on the island.

## Status

- [ ] Island, staircase, loose flights, slippers
- [ ] Cloud deck in the shared fog and the sky
- [ ] Walking on stairs (child and cygnet), boat floating on cloud
- [ ] Chapter beats 1–5 and the handover to the drowned village
- [ ] Screens for Jeremy
