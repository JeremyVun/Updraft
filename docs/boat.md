# The boat's look

The sailboat the child sails through the whole game: `src/traveller/boat.ts`, with its form, parts and shaders in
`src/traveller/boat/`. This file keeps Jeremy's brief for its look and where the work stands. Branch `boat-look`.

## Jeremy's words (2026-09-27, verbatim)

> "It may also be worth finally getting an opus 5.5 sub agent to have a look at improving the visuals of the sail boat (right now it's quite simple looking). The improved sailboat doesnt need to be super detailed and high definition, but i do think we need to target a higher quality bar. "

After seeing the first pass (before/after stills in `/tmp/updraft-boat-look-shots/compare-*.png`):

> "boat is a bit too shallow and small. would like to see it look more like the concept art boat./Users/jeremy/Desktop/cloud-boats.mp4 - specifically teh boat on the right"

The reference, kept here: `assets/art-direction/boat-concept-kite-drawn.png` and `-2.png` (frames of the right-hand boat
in his animation, which plays backwards) and `boat-concept-kite-drawn-still.png` (the concept still it came from). The
kite tow and the bow lantern in it belong to the stairs chapter only (branch `stairs`); the boat itself is the target
for the whole game.

## Status

- First pass (6 commits from 02e8887): clinker strakes in the shader, a pale gunwale rail, ribs, floorboards, seats,
  foredeck, stem, rudder and tiller; tapered mast with hoops; the boom under the sail's clew; a masthead pennant; the
  quilt sail stitched and hemmed; LENGTH, BEAM, DEPTH, DRAFT, the contact shell, physics and public API unchanged.
- Pass 2, proportion study (in progress): `?hull=waist|tub|big` picks a study hull in `form.ts` (`first` is the first
  pass). Only the drawn hull, the seat and the rig's height change; the contact shell, physics and berths do not. The
  new hulls take the concept's finish: honey planking, a cream rubbing strake hung with rope, a stout dark mast, a
  raked stem and transom. The switch is temporary: the chosen hull becomes the only form, then boarding, the jetty
  step, grounding and berths are reconciled with it.
