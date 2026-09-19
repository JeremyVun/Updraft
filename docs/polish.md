# The polish round (2026-09-19)

Jeremy played the game through and raised six issues; a first session fixed the clear-cut ones and he gave verdicts on
the rest. This file holds his words, what was found, the plan and the status, so a context loss cannot distort them.

## Jeremy's words (verbatim)

The issues:

> 1. On the starting island when the swans fly overhead, from below the swan torso / underbelly is see through.
> 2. I want the boat's sail animatinos to be refined to better reflect what's going on. It should be able to fully droop if there's no wind, and flutter when there's alot of wind in it's sails. It needs to feel more organic.
> 3. On the island of lines, the cloth lines have these "vertical lines" appearing randomly on the hanging clothes. The way they flutter in the wind needs to be be way smoother, more organic, more natural. I think there is a global issue here as well with how wind interacts with objects in the game where objects further away from the "wind" react at the same moment in time as objects further away from the wind. so it doesn't look feel like a wind effect as much as if you're just moving things around with a paint brush. This island also doesn't have a small challenge / puzzle on it. We need something, can you think of anything for the island of lines chapter?
> 4. On the meadows island, the piano puzzle needs to be polished up. It's currently not clear whats going on at all. The piano sound is so soft you can't hear it at all, let alone hear it over the background music (background music should probably be turned off here). There's no wind "traces" either to help the player understand what they should do or how they should move their mouse. Also, as the player i dont see the greening effect because the camera is set so close up to the piano against a hill so you don't see much of the effect. Maybe tidy up the camera sequence here so it's clear when a level of the piano puzzle is solved. Overall, the piano challenge needs more thought about how exactly it should work so that it can communicate what it needs to, to the player. I also suspect the paper aeroplane isn't targeting the piano as a "point of interest" that the child needs to complete, instead i suspect it targets the swan pond before the child has completed the piano puzzle.
> 5. The small pond of swans on the meadows island is too close to the piano. After solving the piano challenge, and the greening, that should be the reveal of the swan lake (maybe camera zooms out a bit to show it or something, think about this carefully). Basically we need to be more thoughtful about how we reveal each step that the player needs to complete on the island.
> 6. Each time the boat leaves an island, it tends to loop around back into the island it came from before departing. We need to fix this.

His verdicts on what the first session proposed:

> 1. approved. the end result just needs to be that the sail flutters when there is "wind" whatever the source (the squall or the player), and droops when there isn't any, and the boats speed should somewhat organically match (with a little bit of inertia)
> 2. the lines can cross each other, but not paralell or near parallel to the point where they cause the issue.
> 3. yea, please explore the wind feel change. It's affecting the leaves on the autumn island as well. As long as there isn't too much of a regression to how it affects the wind through the grass (it looks and feels really nice already today).
> 4. try to think if there's any other ideas for a puzzle on this island, think outside the box. What else can make the game feel more dreamlike and fit within the narrative of the child's journey on this island?
> 5. yea let's explore the piano puzzle more, good ideas. I just want to make sure we don't make it nauseating with the camera jerking in and out all the time.
> 6. i think the "wow" factor of the piano's finale reveal is that it turns the whole island green. I don't think it should be revealed with a high camera shot, but maybe more of a low / child pov camera shot that spirals around and up slowly into a mid level camera shot, before finally settling on the swan pond. The other issue with teh swan pond position is that because it's in a dip, when the adult swans fly off, they actually fly off through the hill, which is part of the reason why i needed you to take a look to see if there's a better position to put the swan pond.

On the finale camera: "don't take my word on the camera reveal as gospel. The session should just take it as a suggestion but go with it's own judgement and think carefully about what works best."

Later the same evening, after the Opus 5 limit was hit, on the lines puzzle and on who does the visual work:

> 1. What lines puzzles? did you think of any? what was suggested before?
> 2. I am giving you ownership of the work that astra was supposed to do

> for the lines puzzle, why 1 and 4? If you think it fits with the child's dreamlike, meditative, adventure, will be visually intuitive and simple for a child to solve, and tugs the right heartstrings, then proceed accordingly.

And on the piano, an open question:

> are we going the wrong direction with the piano? the connection is the piano and the music tones with the rest of the island. how does it currently work? can the invitation wind lines / traces in the air connect and resonate with the environment? if you were entering the dream as a child, what would work best here?

## Status

| item | state |
| --- | --- |
| swans see-through from below; the boat looping back over the island it left; the plane leaning at the pond before the piano; the piano too quiet under the music | fixed on `main` (`2274654`). The piano's loudness and the hush still need Jeremy's ear. |
| the "vertical lines" on the washing | fixed on `main` (`ab0be2b`). Two causes. The one Jeremy saw: each vertex of a sheet chose its swing side by the bare sign of the wind across the line, so with the wind along a line neighbouring columns of ONE sheet swung opposite ways and the fold between them showed as a thin seam of sky. The swing side is now smooth in the wind across the line, and the sheet's normal is its true front normal. Also: `lineField` no longer hangs two lines within 1.4 units of each other at 25° or less (`crowds`); crossings stay. The overhead lines are hung first so the field cannot crowd them out; 194 lines and about 700 pieces, as before. |
| the sail | building: Opus 5 parcel, `/private/tmp/updraft-polish2-sail`, branch `polish2-sail`. |
| the piano puzzle, the finale, the pond | building: Opus 5 parcel, `/private/tmp/updraft-polish2-piano`, branch `polish2-piano`. See "The pond". |
| the wind feel | design below; plumbing by the lead, the look by an Opus 5 parcel after the sail lands. |
| a puzzle for the island of lines | ideas below, for Jeremy to pick from. |

## The pond

Measured (world units, north is −z): the pond at (8, −789), level 3.5, lies in a closed bowl. The family leaves due
north on a slope of about 0.23 in a V some 20 wide; the rim north of the water is 9 to 10 high at 20 to 40 units and
16 at x = 23, so they fly through it. The saddle at `WAY[4]` (0.7, −813) is the natural second crest: north of it the
ground falls steadily to the shore at z ≈ −975. The parcel was briefed to move the pond to the open slope at about
(22, −880) and the reveal to the saddle, so the family leaves over falling ground and the sea.

Read with issue 5 above, Jeremy wants the finale's resting frame to be the first, far sight of the swan lake ("After
solving the piano challenge, and the greening, that should be the reveal of the swan lake"), with the pond further
from the piano than it was. Seen from the piano the saddle is a notch in line with about (8, −895); the highest ground
on that line is 11.7 at z = −840, so a camera 12 or more above the piano's ground sees water at that spot through the
notch. The parcel was only told to keep such a glimpse if it read well. If it comes back without it, a short
follow-up parcel moves the pond into the notch's line and rests the finale on it, thinning the haze as the crest does.

## The wind feel

Measured in the running game (a 0.2 s stroke of 22 units per second, radius 6, sampled round it):

| where | raw air | gust energy |
| --- | --- | --- |
| under the stroke | 20 at once | full at once |
| 20 downwind | 7 within 0.2 s | arrives at about 1 s |
| 15 to the side | 4 within 0.2 s | never |
| 15 UPWIND | 10 within 0.2 s | never |

That is the paintbrush Jeremy described. The field is incompressible, so the pressure solve moves air everywhere
round a stroke in the same frame, and cloth, sail, kite and leaves read that raw velocity with no inertia. The gust
itself does travel: its energy is laid down only under the stroke and is carried downwind at the air's own speed.

The change (branch `polish2-wind`, contract in `docs/contracts/wind.md`): hanging things stop reading raw velocity.
They read the **felt wind**, which takes air without gust energy in it only up to a soft ceiling that goes with the
prevailing breeze (so dead air is dead), and the whole velocity where a gust has arrived; and they read it through
a **sway spring** kept per cell beside the grass's own, so they take a gust late, overshoot and swing back. Measured
after: a sheet under the stroke fills in about half a second, one 10 downwind follows at about a second, one 20
downwind at about 1.4 s, and 15 upwind barely stirs. Nothing the grass reads was touched (the force, advection and
grass-spring passes and the pointer's splats are as they were), so the grass cannot regress.

Still to do, as one Opus 5 parcel once the sail has landed: the washing (swing on the sway texture per vertex, the
hem lagging the peg so a gust runs down the cloth, a belly out of the plane so a sheet fills rather than hinges, a
ripple that rises with the wind), the kite, the pinwheels, the birch leaves on their twigs and the loose leaves, and
the sail's one sampling function.

## A puzzle for the island of lines: ideas

What the island is: the first piece of home the dream hands over, washing hung out with nobody there, a child lost
in it, a red door on the crest, a cygnet that has only just been picked up. Anything here has to be wordless, use
only the wind, fail nobody and strand nobody: each idea below is something the walk passes, that rewards the player
who plays with it and lets everyone else through after a little while.

1. **The family on the line (recommended).** On the crest, beside the red door, one line carries a man's shirt, a
   woman's nightgown and between them a child's small jumper. Hanging, they are washing. One steady sweep of wind
   along the line fills all three at once, and for as long as the wind holds they are people: shoulders, arms, the
   sleeves of the big ones lifting toward the small one's. The child stops under them and looks up. Hold it a few
   seconds and the small sleeve lifts and points down the far slope, the door behind them swings open on the view
   of the boat, and when the wind drops they are empty clothes again. It is the island's whole feeling in one
   image (somebody was here, and is not), it makes the player hold a steady wind along a line, which is exactly
   the gesture the piano asks for on the next island, and it costs little: the garments and their shaders exist.
   Unplayed, a breeze of the island's own fills them for a moment as the child passes, so nobody misses the image.
2. **Hide and seek in the sheets.** The cygnet, just met and still wary, slips out of the child's arms into the
   washing. The child stops and turns about. A small shadow shows through a backlit sheet; lift that sheet with a
   gust and the bird is found, scuttles off, and hides again further up the alley. The third time it comes out by
   itself and climbs back up. This is the bond Jeremy asked to see grow, as a game a child would play in washing,
   and it is a rehearsal in sunlight of the dark wood, where the same bird is lost in earnest and found with light.
   It always ends: the cygnet gives itself up after a little while wherever the player looks.
3. **The shadow on the sheet.** One great white sheet hangs across the low sun. While a steady wind holds it taut,
   the shadow of someone pegging out washing falls on it from behind, with nobody there to cast it; slack, it is a
   sheet. Held long enough, the shadow turns its head toward the far shore. The child who is not seen, and the
   person who hung all this, in one image. It is the cheapest of the three (one fragment shader) and the quietest.
4. **The door the wind opens.** The red door is shut and rattles to a gust. Blown from the front it swings open,
   and what is through it is not the hill behind it: it is evening light and the far beach with the boat. The child
   walks through and the washing on the other side all leans the way to go. It ties straight to the last door in
   the game, which the child opens by hand. It needs a second view of the scene drawn into the doorway, which is
   the costly part.

Ideas 1 and 4 join naturally (the family filled is what opens the door), and 1 and 3 can share a sheet. Already
offered and not repeated here: the grounded kite the player lifts to mark the way, and the sheet across the alley
the child waits behind. **Jeremy picks; nothing is built until he does.**
