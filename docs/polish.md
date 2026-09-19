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
