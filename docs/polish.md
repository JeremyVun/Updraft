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
| the sail | on `main` (`e375b13`, from `polish2-sail`): the cloth fills with whatever wind it has, hangs dead in folds with none, ripples and shakes more the harder it blows, and the hull's speed follows the same reading with inertia (`tuning.sail`). Looked at by eye (2026-09-19 evening, the captures under `/tmp/updraft-polish2-sail-*`): the drooped, filled, breeze and squall states all read. Its one sampling function now reads the felt wind on the sway spring; the first crossing still takes 90 s. |
| the pond | on `main`: `POND` at (24, −892) on the north slope, the walk over the brow at `WAY[4]`, the veil held from the brow to the boat. The crater rim is fixed: the bowl is dug out but the rim is the slope itself where the slope stands above the water and a low lip (`POND_LIP` 0.4) only where it falls below; checked by capture from the brow, the tarn lies in its slope. |
| the piano puzzle and the finale | built, and the mechanic reworked on Jeremy's question (his words above): every note lifts a wind trace off its key that runs up the hill and greens the grass it runs over (`fx/notetraces.ts`, `LifeField.bloom`); the phrase's traces are the invitation; the key-line shows only while a phrase waits; the duet frame sees the whole keyboard from the child's shoulder with the slope and sky behind; the finale spirals up in one eased rise and rests looking along the way north with the child and the piano at the foot of the frame, then the child gets up. The pond cannot be seen from the piano (205 paces, two rises), so its reveal is the brow's. Details in `docs/journey.md`. |
| the wind feel | built: the washing swings on the felt wind through the sway spring, its hem lagging its pegs so a gust runs down the cloth, filled with a belly (an arc, not a fan of rays) and a ripple that rises with the wind (`tuning.washing`); the kite, the pinwheels, the birches' whip and their leaves' letting go, and the sail's one sampling function all read the felt wind on the same spring. Nothing the grass reads was touched. Compared by capture against `main` from the walk: the sheets take the gust a beat after the grass, belly rather than tilt as one, and settle again. |
| a puzzle for the island of lines | **reworked September 19**: three wind-lifted curtains wait for player input, with sideways invitation traces at the first; the cygnet goes first and waits for the child. The plane stays held. The family opens a real doorway onto a separate grassy shore with the kite and boat; Jeremy approved removing the repeated family clothes beyond the door on September 21. Island length increased 15%, width retained. See `docs/journey.md`, the island of lines. |

## The sea passage

Jeremy, September 19: “Get an understanding of the game's vision and what it aims to make the player feel and
experience, then proceed with fixing these issues.” The approved review found undersized dolphins, cropped or
sail-obscured encounters, repetitive steep hops, weak contact with the waves, hidden child reactions, a cygnet
swim that fell behind the frame, and land appearing too soon.

Implemented around the crossing's role as relief after the wood: a generous living sea, a little play, then room
for the cygnet's confidence. Larger dolphins and quieter surfacing, a side-on encounter camera, water-following
foam and wake, a slower boat during the swim, and a longer offshore route replace the crowded sequence. The paper
stays stowed in the boat so it cannot intersect the returning cygnet. Passage details and verification tools are
in `journey.md`, “The long crossing”.

## The pond

September 20 follow-up: the flock now reacts during the approach, nearest birds first. The meadow flight practice
is replaced by a short swim back to waiting hands. The recovering wing is wrapped on the starting island and
unwrapped at the sleeping hilltop before its first glide; see `docs/cygnet.md`, “The recovering wing”.

Pond visibility follow-up: Jeremy's screenshot showed only the child's hat above the foreground bank. The approach
camera comes round over the water, keeping the child and shore as its subjects. A later playtest found that
this turn happened too soon and hid the swans' reaction. The approach now holds the child and the whole flock
through the raised heads, staggered runs and climb, then turns toward the shore over 3.5 seconds before the
set-down. The set-down, swim and gathering frame both companions in landscape and portrait. The child
stops closer to the water; a short, fine grass margin and an opening in the southern reeds expose their hands
and the cygnet's route. `tools/pond-view-check.mjs` checks framing and terrain/grass sight lines through the real
sequence from two approaches at 30/60/120 fps, including every swan through departure. Earlier browser captures
cover set-down, swimming and return; the revised departure still needs a GPU capture (the shared browser was
occupied by another task's full playthrough during this fix).

Meadow navigation follow-up: throws and airborne guidance now share the next destination, with an unfinished
piano or pond stop taking priority over the final boat marker. After swimming, guidance and pursuit bend around
the dry bank instead of repeatedly stopping at the water. `tools/meadow-route-check.mjs` checks every route
cursor, the real piano approach and complete pond-to-boat walk at 30/60/120 fps, and restored walks on both banks.

Earlier pond-placement investigation:

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

## Where it stands (2026-09-19, late evening)

Everything in this round is on `main`. Jeremy gave the Fable lead ownership of the visual work after the Opus 5 limit was hit, and it was all done by capture from the lead's own worktrees. Still wanting his eye and ear: the piano's loudness and hush, the traces and the greening as played, the finale's rise, the three on the line, and the washing in a gust.

Review follow-up: Jeremy wants to discuss how the piano puzzle works before changing it, after the other review fixes. The reported finale issue (restoring the whole meadow immediately while the green wave is still travelling) remains unresolved; no piano behavior is changed in this pass. The full phone/portrait gameplay pass is captured in `backlog/portrait-gameplay/design.md` and is outside this session.


## Shared objective sound (September 19)

Jeremy asked for the starting island's completion sound at major puzzle conclusions, not every smaller step.
`completeObjective()` in `story/cues.ts` reuses the unchanged `restored` phrase. It marks the opening restoration,
red door opening, piano's full meadow awakening, first successful meadow glide, refilled sail, finding the cygnet
in the wood, waking the sleeping child and the final family's answer. Each is a one-time success transition;
checkpoint restoration does not play it. Sheets, piano phrases, coals and free play keep their smaller responses.

## Dark wood (September 19)

Jeremy: embers look like basic light orbs and activate on tiny cursor movement; replace mechanic-skipping
waiting timers with invitation traces after about five seconds; increase ember spacing 30–40%; explain the
sequence and assess firefly numbers.

The first fragmented-coal visual pass is rejected (see below). Direct sweeps build ignition; idle and residual wind
cannot finish it. Traces demonstrate the sweep after five seconds without supplying wind, light or progress.
Spacing increased 35% (15 → 20.25 along the path). Rescue requires the hiding-place coal; plane drying requires
player fanning. The storm previously suppressed every firefly; the wood now has its own sheltered population
(240 within 25 units, smaller than the open meadow's flies). The plane stop now interrupts the path walk, preventing the child from walking past it and becoming stuck
at the far shore. Checkpoint restore lights only the already-earned area, leaving the next ember for the player.
The story remains making light, losing and finding
the cygnet, repairing the plane, then boarding on the far shore. Its narrative is the child facing the dark
for somebody smaller who trusts them.

Checks: `node tools/wood-logic-check.mjs` for input/idle invariants and `node tools/wood-check.mjs [portrait]`
for real gestures through the scene (`rescue` stages the bolt for a focused second-half check).
The mechanics suite covers 30/60/120 fps, tiny motions, residual wind, both checkpoint resumes, the full
route and waiting-target framing in landscape and portrait. Screenshots and reports go to `/tmp/updraft-wood-*`.

Jeremy's visual correction, verbatim:

> “hrm.. the embers still need to look like something the player can and should interact with, instead of a bunch of orange squares. Rethink the visual language a bit for the embers”

Jeremy authorized one Astra subagent to create three in-scene ember concepts with no gameplay changes.
Workshop: `/tmp/updraft-ember-comps-r1` (superseded by the approved image below). The object itself must invite fanning;
the five-second traces reinforce that invitation. Both a plain light orb and scattered orange squares are rejected.

During the authorized study Jeremy redirected it, verbatim:

> “im looking at what the sub agent is doing and it's just weird and doesn't fit with the style of a child's dream.”

The study must return to simple, soft, inviting warmth that belongs beside the child and cygnet. Familiar
forms and a legible response to breath take priority over novelty or an elaborate object to decipher.

The completed study is `/tmp/updraft-ember-comps-r1/index.html`, with implementation notes in `OPTIONS.md`.
The final three directions are Tiny flame, Breathing cinders and Smoking ember. The lead recommends Tiny flame
for the clearest invitation at gameplay and phone size; the waiting flame means nurturing existing warmth.
All were visual fixtures. The realistic direction was subsequently rejected.

Jeremy redirected the visual study again, verbatim:

> “ok listen, i think we went too realistic. We just needed the idea of an artistic / abstract idea of a "light orb ember". make sense? maybe use gpt image 2.5 to create an idea”

The realistic flame/coal/smoke study is superseded. Return to an abstract orb of light with a richer, expressive
response to wind. Explore it through image generation before another implementation; no literal fire or debris.

Approved direction: Jeremy answered **“yes! this is it”** to the generated abstract orb study.
The durable exemplar is [wood-ember.png](../assets/art-direction/wood-ember.png).

Implementation: one warm heart wrapped in overlapping translucent veils, a loose trailing wisp and small
rounded motes. The orb breathes while waiting, its outer light yields to wind, and fanning opens the shape
before it catches. Rendering in `src/fx/ember-orb.ts` reads existing wake/heat/flare state; ignition,
spacing, invitation timing and story gates are retained. The visible heart and input target share the same
position above the litter. No physical housing, firewood, smoke plume, glass sphere or sharp fragments.
`node tools/ember-check.mjs [portrait]` captures waiting, invitation, fanning, lit and close-detail states with
real mouse/touch sweeps; temporary pictures, movie and report live in `/tmp/updraft-orb-*`.

Verification: build/typecheck and `wood-logic-check.mjs` pass, including the full route and checkpoint
restores. The real browser check passes at 1600×900 and 390×844: idle and one sweep leave the orb unlit,
four deliberate mouse/touch sweeps ignite it, and no browser errors are reported. Waiting, invitation and
lit states were visually inspected in both sizes. The scene remains local; no deployment was made.

Follow-up polish: Jeremy asked for richer animation, progressive light while fanning, and a much smaller,
dimmer resting ember. Resting scale is 0.38 of the base size and opacity 0.24. Smoothed wake opens and
brightens the veils; their uneven folds circulate, breathe and sway, with the tail lengthening as they warm.
Forest illumination now eases up before ignition through `Embers.illumination`; `brightest` remains the
fully-lit story gate. Mouse/touch checks measure growth and light across individual sweeps, and the logic
check verifies that pre-ignition illumination cannot advance the story at 30/60/120 Hz.
Desktop and portrait browser checks pass with four sweeps to ignite, increasing size/brightness/forest
light at each partial sweep and no browser errors. Full route and checkpoint logic pass. Vite bundling
passes. The unrelated scarf typecheck errors were subsequently resolved; full typecheck now passes.

Jeremy then asked for the circular, wispy silhouette of the approved concept to be matched more closely.
The first attempt used a painted texture with subtle distortion. Jeremy rejected it as a static image;
its motion was not sufficient. The replacement has seven independent curved surfaces per orb in
`src/fx/ember-veils.ts`, with separate tilted orbits, billowing widths, free ends and light flowing along
their surfaces. `ember-orb.ts` draws only the heart and halo. The generated artwork supplies colour
variation inside the ribbons, not the orb's silhouette. Resting size, fanning growth and lighting stay.

`ember-check.mjs` now records an isolated view on a plain background with a fixed camera and no airborne
sparks, alongside the real mouse/touch interaction. This makes the actual wisp motion reviewable.
The artwork and built-in imagegen prompt are in `assets/fx/ember-orb.png` and `ember-orb-prompt.md`.

The moving-surface pass builds and typechecks. Mouse/touch fanning, progressive illumination and the
full route/checkpoint checks pass. Fixed-camera captures show the silhouette and folds changing over
2.4 seconds without sparks or scene motion. Local only; no deployment.

Forest floor and lightning polish (2026-09-20): Jeremy found lightning exposing a smooth green floor and
asked for more subdued flashes ashore and a little more grass. Wood lightning eases to 28% strength over
land; strike timing and thunder are retained. The native grass renderer now includes short, fine forest
tufts in uneven patches, with flowers suppressed and muted olive/brown colour. Terrain between the tufts
is mottled leaf mould and moss instead of the generic green soil. CPU and both GPU grass paths use the
same crop formula. `tools/wood-floor-check.mjs` captures quiet, subdued-flash and full-flash views.

Forest tuft density is one quarter of the meadow population; interior tiles use the matching coarser
blade table. Build/typecheck, boat/weather timing tests and the browser floor captures pass without
shader errors. The held wood flash measures 0.168 versus approximately 0.602 unsheltered. Local only.

## Piano redesign investigation (2026-09-20)

Jeremy's brief:

> i think it needs a redesign. The piano location and the camera position needs to be done so that you can actually see the greening of the field. The piano, the music, and the meadows should feel connected. The music being the way that the child brings colour to the chapter.
>
> In terms of copying the direction, it's not clear at all what and where to do this. The piano is a bit too soft, and there's no trace outline showing you what to trace.

Jeremy requested removal of the old piano/wind worktrees and an inspection of the current code and visuals.
`/private/tmp/updraft-polish2-piano` and `/private/tmp/updraft-polish2-wind` were clean and fully merged into
`main`; both worktrees were removed. Their branch refs remain. No unmerged redesign was recovered.

Findings from the current implementation:

- **Composition:** the seated view faces a rising bank. Most nearby grass is already inside the piano's
  initial green patch; the hill hides the broader meadow. Note trails travel above the case and out toward the
  edge of the view. Making the trail brighter cannot expose the ground receiving its colour.
- **Invitation:** `KeyLine` follows sounding notes, holds for 0.85 seconds, then loses its points and fades.
  The response remains available for several more seconds without a guide. Concurrent trace-clarity work
  increases its contrast and screen width, but retains this lifecycle.
- **Input:** `PointerInput.pick` intersects terrain, while `Piano.listen` checks rising wind energy at the
  keyboard's ground coordinates. It does not test a stroke against the keyboard as seen on screen. The low
  viewing angle displaces a pointer over the keys onto ground behind them. This needs direct gesture verification.
- **Sound:** `hush` reduces the pad to 8%; it does not hush the normal gesture chimes, gust, whistle or grass
  rustle. Piano answers compete with sounds generated by the same sweep. The existing loudness multiplier is
  already 3. This is a mix-routing finding, not a listening verdict.
- **Colour:** stage three immediately clears `life.regions.waiting`, making `regionLife` return fully alive
  for the meadow before the expanding wave reaches it. Earlier stages have radii 80 and 168, much larger than
  the close view. Automatic notes plant colour too; no answer starts the automatic finale after 14 seated seconds.
- **Child:** the child presses one introductory note, then listens with hands in their lap while wind and
  scripted phrases supply the tune. The animation does not yet communicate the child playing the meadow awake.

Recommended direction, not yet implemented: one stable composition holding the child, playable keys and an
open descending field; a persistent, generously sized sweep guide whose visible path is also its input target;
notes and the child's hands responding progressively to the stroke; a broad, clearly visible advance of colour
after each phrase; a final travelling wave that finishes before the grey hold is released. Duck competing
gesture sounds during the duet. Repeated demonstrations should help an idle player find the gesture rather
than silently completing it for them. Preserve earned progress and avoid rhythm or exact-pitch requirements.

Terrain candidate for visual exploration: the existing west-rise waypoint, sculpted (-40, -830), world
approximately (-23.3, -746.7). Ground there is 20.9 high and falls to 11.6 forty units north; at the current piano
it is 16.5 and rises to 19.8 twenty units north. This supports a view over the field without an overhead camera.
It is a candidate, not an approved relocation: verify the approach, skyline, pond concealment, keyboard
visibility and colour front in landscape and portrait before deciding. Piano placement, walk waypoints,
clearing, initial colour origin and finale framing must move together.

Scratch evidence and inspection scripts are in `/tmp/updraft-piano-*`; no gameplay changes were made by this
investigation. The existing note synthesis, key depression and life-field systems can support the redesign.
Visual inspection covered the approach, seated framing and cygnet on the keyboard. A separate attempt to measure
real sweeps and the complete finale did not finish: concurrent GPU captures occupied the shared browser lock,
and a live reload interrupted the first acquired run. Gesture reliability is a code finding awaiting a completed
browser check; the finale's immediate restoration is confirmed by the life-field and story code.

## Meadow plane and camera (2026-09-20)

The plane could outrun the child and pull the camera onto empty ground between them. Its meadow steering target
now stays at most 24 units toward the next waypoint, piano, pond or boat. Jeremy found the first 26-unit flight
area too restrictive: slowing now starts at 28, waiting turns at 34, and inward return takes over by 42 units.
Forward flight resumes when the gap closes to 24. Lift eases from 18 to 28 units above the child, including on
high ground. A plane already far away flies back continuously.
The child refreshes the pursuit destination without resetting obstacle detours. The walking camera caps the
plane's influence and fits the pair using their camera-space positions, with bounded extra distance and priority
for the child during recovery. At the widest separation the plane may leave the frame briefly, especially on
phones. Authored piano, pond and boarding shots retain their own framing.
Knobs: `tuning.meadowPlane`. Regression check: `node tools/meadow-plane-check.mjs` (strong gusts and updrafts,
30/60/120fps, desktop/portrait, runaway recovery, route progress, scripted release and the final departure).


## Piano redesign implemented (2026-09-20)

Jeremy approved the redesign, then asked for the green patch to read from the beach crest and a slightly wider
playing camera. The piano moved to the west rise, facing the open falling field. The initial green radius is
13 with a soft edge of 4; a shallow saddle lowers the intervening ridge without changing the piano's height.
The playing camera stands 19 units back and the finale widens to 32, with both piano and child retained.

The persistent trace above the keys is also the screen-space input target, with a starting ring, directional
motion and progressive notes. Four sweeps answer the three phrases; idle time no longer completes the puzzle.
The child's hands follow the notes. Player notes carry colour out into the field; repeated demonstrations
remain quiet and do not colour it. Phrase waves reach 32 and 62, then the finale travels across the island
before releasing its grey hold. Competing wind/chime sounds are hushed and piano loudness is raised.
The child resumes following the plane after standing up, and the completed checkpoint skips the duet.

The earlier investigation above is historical; its unimplemented recommendations and incomplete checks are
superseded by this build. Gesture logic and meadow plane regression checks pass. Real GPU mouse and touch
runs complete all four sweeps, preserve the invitation while idle, retain the grey hold at the wave's start,
keep the piano and child in the finale frame, and resume the walk afterward. Build/typecheck pass.


## A field-wide answer to every piano gesture (2026-09-20)

Jeremy's next playtest: "I can see the greening to the top right of the screen, but i can't see the greening
happen anywhere else... i was hoping for a more 'epic' feeling of the music connecting with the environment
each time the player mirrors an action."

The previous early radii stayed beneath the close camera; the third sweep had no wave at all. All four
sweeps now have a distinct reward: radii 45, 85, 125, then the whole island. Music starts at the piano and
travels across already-green ground before advancing the next colour front. Three soft arcs follow the
terrain at that same radius, and a broad front of wind bends the grass across the left, middle and right.
Note trails fan across the field with much less sideways drift; the introductory note no longer spends
colour ahead of the player's first answer.

Each early answer opens a brief view over the field, holds while the front arrives, then returns to the
keys before demonstrating the next gesture. Each successive reveal is wider and higher. The final camera
remains above the field for the full wave. This supersedes the earlier fixed close camera and 32/62 radii.
`tools/piano-frame-check.mjs` checks continuous subject visibility in landscape, ultrawide and portrait;
`tools/piano-check.mjs` checks four real gestures and colour across three bearings after every early answer.

Verified: typecheck and production bundling pass, as do gesture and meadow pursuit regressions. The full
desktop playthrough completes all four real pointer sweeps and confirms colour at left, centre and right
bearings for each early wave. Captures show the first broad response, the third sweep restoring the middle
hills, and the final island-wide reveal. Continuous camera bounds pass at 1600×900, 2048×1023 and 390×844.


## Curling music and organic colour (2026-09-20)

Jeremy found that the note trails painted straight lanes and asked for "a whirlwind of music and greening".
Notes now orbit as they drift into the meadow; wider, gentler blooms overlap along those curved paths.
Five loose eddies replace the three concentric musical arcs, carrying soft patches just ahead of the main
front. Grass receives both outward and turning wind.

The broad restoration uses a fixed spatial disturbance and an increasingly soft edge. CPU life queries,
shader colour and the visible eddies share `world/music-growth.ts`. Its shape stays fixed as the radius
advances, so earned colour never goes grey again. The initial arrival patch is unchanged, and the final
coverage margin includes the uneven edge. `tools/piano-growth-check.mjs` checks permanence, initial-patch
compatibility and agreement between the colour front and the visible curls.
