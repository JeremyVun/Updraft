# The boat

The sailboat the child sails through the whole game: `src/traveller/boat.ts` (sailing, mooring, beaching,
boarding), with its form, parts and shaders in `src/traveller/boat/` (`form.ts`, `parts.ts`, `shaders.ts`).
Its look in words is in `docs/styles.md`.

## Jeremy's words (verbatim)

> "It may also be worth finally getting an opus 5.5 sub agent to have a look at improving the visuals of the sail boat (right now it's quite simple looking). The improved sailboat doesnt need to be super detailed and high definition, but i do think we need to target a higher quality bar. "

> "boat is a bit too shallow and small. would like to see it look more like the concept art boat [...] specifically teh boat on the right"

> "ok, i think it should be just a bit slightly smaller than waist deep. With a cuter, more rounded sillouhette and wider planks like in the concept, and a thicker white beam at the front with the lamp. B and C all look way too big and unmanageable and don't let the game feel like a dream."

The reference: `assets/art-direction/boat-concept-kite-drawn.png` and `-2.png` (frames of the right-hand boat in his
animation) and `boat-concept-kite-drawn-still.png`. The boat is the target for the whole game; the kite tow belongs
to the stairs chapter only.

## The form

`form.ts` holds the one hull: about 4.2 m (`LENGTH`), six wide clinker strakes (`STRAKES`), round and
flat-bottomed, a level keel just below the waterline sweeping up round the forefoot into a raked stem, the gunwale
at the seated child's belly (`SEAT_Y`, `gunwale()`, `gunwaleHalf()`). It floats with the waterline up round the bilge,
where the bottom is most of its full width, and the floorboards still above it so the sea is never seen inside
(`FLOOR_Y`, `DRAFT`). Where hull and sea meet (`boat/waterline.ts`) the water breaks white round the hull, further
out from a moving bow, and the planks carry a thin lip of foam with dark wet wood above it. The contact shell is the drawn bottom, so physics and look agree;
the rudder and stem stay clear of it. `parts.ts` builds the planking, transom, rails, cream rubbing strake with rope
swags, frames, floorboards, thwarts, foredeck, the white stem post and its brass lantern, mast, boom, rudder and
tiller, a pail and a coil of rope. The laps are drawn in the shader and fade to their average tone when too fine.
The sail is quilt panels until the birches, then the red scarf (`boat.scarfSail`).

The lantern is dull by day and lit from sunset through the night; it lights the travellers, the sail (less) and
glints in the water (`tuning.lantern`). The stairs' glow sits on this lantern.

Rulings: a little smaller than waist-deep, cute and rounded, wide planks, a thick white post with the lamp at the
bow. Bigger tubs read "too big and unmanageable" for a dream. A pram bow "just looks weird". The top strake stays
natural wood.

## Arriving and leaving

- **Beaching.** The way comes off over the last metres (`tuning.sail.beachEase`, read up to `beachLook` ahead of
  the bow), the forefoot touches at `beachTouch` and the keel slides on up the sand (`beachGrip`) before it rests;
  only then is it `grounded`. A hull being pushed off never starts beaching on the sand it is leaving. Eased past its landing point with the beach still ahead, it holds its course onto the
  sand rather than coming round for the point. Jeremy: the boat instantly stopping and the child instantly walking out "doesn't look
  very polished". Each beach chapter calls `Traveller.stepAshore`: the child sits a moment (`boarding.ashorePause`),
  then steps out over the gunwale onto the sand beside the bow, standing nearer the keel than at a jetty
  (`ashoreInside`) so a boot does not come through the round bilge. A walk the chapter asks for waits until her
  feet are down. Chapter starts and restored saves begin with her already ashore.
- **Alighting onto a jetty** (`Traveller.alight`, `tuning.boarding.alight*`): four beats, the reverse of boarding.
  Up off the thwart onto the floorboards while turning to face the boards; the lead foot onto the edge with a lean,
  weight still in the boat; the weight across, the body rising only with the boards and clearing the gunwale while
  the trailing leg pushes off; a small give on landing. The push-off rocks the hull. A wide gap becomes a little
  hop. The feet keep to the body's level through the step and ignore a deck under the hull. Never a teleport.
- **Boarding** (`tuning.boarding`): plant against the hull, push off, one continuous step over the gunwale and down
  onto the thwart (`railIn`, `railHeight`, `stepArc`).
- **Shores.** The hull is resolved against the terrain every frame and eases its pitch and roll to a beach
  (`docs/contracts/world.md`). Checks: `tools/boat-check.mjs`, `boat-ground-check.mjs`, `boat-shores-check.mjs`,
  `boat-mooring-check.mjs`, `sail-flutter-check.mjs`.

## Open

- Boarding lifts the lead foot about 0.6 m over the side, more hop than step (`boarding.stepArc`, `railHeight`).
