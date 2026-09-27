# The boat's look

The sailboat the child sails through the whole game: `src/traveller/boat.ts`, with its form, parts and shaders in
`src/traveller/boat/`. This file keeps Jeremy's brief for its look and where the work stands. Branch `boat-look`.

## Jeremy's words (2026-09-27, verbatim)

> "It may also be worth finally getting an opus 5.5 sub agent to have a look at improving the visuals of the sail boat (right now it's quite simple looking). The improved sailboat doesnt need to be super detailed and high definition, but i do think we need to target a higher quality bar. "

After seeing the first pass (before/after stills in `/tmp/updraft-boat-look-shots/compare-*.png`):

> "boat is a bit too shallow and small. would like to see it look more like the concept art boat./Users/jeremy/Desktop/cloud-boats.mp4 - specifically teh boat on the right"

On the three study hulls (A waist-deep, B concept tub, C big tub):

> "ok, i think it should be just a bit slightly smaller than waist deep. With a cuter, more rounded sillouhette and wider planks like in the concept, and a thicker white beam at the front with the lamp. B and C all look way too big and unmanageable and don't let the game feel like a dream."

The reference, kept here: `assets/art-direction/boat-concept-kite-drawn.png` and `-2.png` (frames of the right-hand boat
in his animation, which plays backwards) and `boat-concept-kite-drawn-still.png` (the concept still it came from). The
kite tow and the bow lantern in it belong to the stairs chapter only (branch `stairs`); the boat itself is the target
for the whole game.

## Status

- First pass (6 commits from 02e8887): clinker strakes in the shader, rail, ribs, floorboards, seats, stem, rudder
  and tiller; tapered mast with hoops; the boom under the sail's clew; a masthead pennant; the quilt sail stitched and
  hemmed.
- Pass 2 (from 1572bce), after proportion studies Jeremy steered through: waist-deep hulls; then "a bit slightly
  smaller than waist deep" with a rounder silhouette, wider planks and the white post and lamp; then flatter-bottomed
  with the bow down; then a gentler sheer (the pram bow was tried and dropped: "it just looks weird"); a pail and a
  coil of rope aboard; the top strake left natural wood. The hull is now the only form in `form.ts`: 4.4 m, six
  strakes, the gunwale at the seated child's belly, a level keel just below the waterline. The contact shell is the
  drawn bottom, so the physics and the look agree; the rudder and stem stay clear of it.
- Gates on the final hull: typecheck, `boat-check`, `sail-flutter-check`, `boat-ground-check` (lowest 0.041 m, first
  pass 0.031), `boat-mooring-check`, `boat-shores-check` (lowest 0.043 m, first pass 0.038).
- Open: boarding and the jetty step-out over the higher gunwale (`tuning.boarding.gunwaleIn` and `gunwaleHeight`,
  and the child's step in `traveller.ts`, which the child rebuild owns). The stairs branch hangs its own bow lantern;
  when the branches meet, that chapter should light this one instead.
- Merged into main (8158b36, 2026-09-28) on top of the rebuilt child. Typecheck, `boat-check`, `boat-ground-check`
  and `boat-shores-check` (lowest 0.047 m, meadow departure) pass. Seen together: she sits in the boat cleanly, the
  boarding clears the side (though the lead foot lifts about 0.6 m over it, more hop than step: `boarding.stepArc`,
  `railHeight`), and the lantern glows at sunset.
- The step-out onto the home jetty over the higher gunwale is fixed (fcc3e78). It was going through the rail: the
  rail point came from stale knobs (now read from `gunwale()`/`gunwaleHalf()` in `form.ts`), the lift was sized for
  the arc's midpoint rather than where the body is there, the feet dropped to the floor under them as soon as the
  child stopped riding, and the jetty's footprint reaches in under the hull, so a foot still inside the boat stood on
  it. Now the feet keep to the body's level through the step and ignore a deck under the hull; `alightClear` -0.22.
  Traced per frame: no foot inside the side, both clear its top by 0.06 to 0.3 m. Checks: typecheck, `boat-check`,
  `boat-mooring-check`, `sky-mirror-logic-check`, `flock-flight-check`. The boarding still lifts the lead foot about
  0.6 m over the side, more hop than step (`boarding.stepArc`, `railHeight`); untouched.
