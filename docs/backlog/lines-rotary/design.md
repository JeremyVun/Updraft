# Rotary washing line

Status: design prototype in `codex/lines-rotary`, isolated from the shared main checkout. Nothing approved for release.
Parent: [more to do on the path](../path-puzzles/design.md). Story authority: [journey](../../journey.md).

## Jeremy's brief, verbatim

2026-10-11:

> I'm looking to make the main island of lines a bit longer. any ideas?

> yea, the only thing i can think of is that the red, blue, yellow shirts on the clothes line just sort of appear out of nowhere.
>
> The rotary washing line is probably the best one i think? the laundry basket land boat is too similar to the challenge on the little boats island

After the proposal to put it between the second and third curtains and glimpse the family's existing garments through the turning washing:

> yea, think carefully about how to design the puzzle beautifully. work in a worktree

During the prototype:

> make sure that as you're designing it that you really think about the aesthetics of the scene from the perspective of the player camera and how the scenes are composed

After seeing the first prototype:

> note: doesn't the island itself feel a bit short now? i dont remember the door being on the beach in the original island of lines

The family and door must remain an inland clearing, enclosed by washing. Extend the island itself to fit the extra
encounter; moving the door down the existing slope was the wrong tradeoff.

## Approved revision — 2026-10-11

Jeremy's playtest, verbatim:

> image 1: There's a gap to the left of the second clothesline. What happened to all the stuff that formed a lane from the first clothesline to the second clotheline challenge?
>
> image 2, 3, 4: I can also see the final red / blue clothes behind the third clothesline challenge. the reveal is spoiled already. It shouldn't be visible until after the third clothesline challenge is completed.
>
> ok the clothes line spinner idea is cool, i think it's a good start, but it's a bit hard to spin around and it's completed too quickly. Can you fix above issues and think about how to make the clothes line spinner a bit more of an interesting puzzle

> what if we take multiple of these ideas? the caught sheet is cool, as is the folded rotary. and by two stage passage, do you mean the two rotaries forming a passage?

> i liked the idea of there being two rotaries that you had to align as well. thoughts?

After the paired-rotary proposal below:

> yep this sounds like the right plan. proceed

During the paired build:

> Can we use different coloured sheets for the spinners as well? the clothesline challenges then can be the white sheet with red border, and the spinner sheets can be a slightly different design and colour variation so that it's not so visually confusing? what do you think?

Use muted sage linen on the nearer rotary and dusty blue on the farther one, with narrow cream woven stripes.
Keep white with red borders exclusive to the three curtain challenges; the family's saturated colours stay distinct.

Jeremy rejected the open clearing after seeing the paired scene:

> with teh way the rotators are positioned, why does the child even have to bother with the green one? They coudl very easily just walk around the side directly to the blue one.. i need you to think carefully and pay attention to the believability of the level design

Asked whether unfolding should remain required, because folding naturally creates more empty space:

> Keep two alignments and the snag; remove required unfolding

The open clearing and the subsequent boxed-bay response are both rejected. The current layout work is a study of
`de1286a2`, immediately before the rotary prototype. Recover the original procedural funnel before integrating
the two frames. Its uneven density, varied lines, loose overlap and low player view are binding visual references.
Do not use continuous wall panels, rectangular enclosures or hard cropped corridors to force the puzzle.

## Current design

Two spread rotaries form one continuous winding passage. The farther one's trailing sheet is hooked on an
ordinary neighbouring washing-line post. First turn green's bare half towards the route; it catches and the pair
walk into the sheltered space beside its mast. The camera accompanies them, then eases towards the blue snag.
Turning blue pulls its sheet taut and stops the frame. Sweep the caught hem free, then align blue's bare half with the
onward path. Each alignment persists, and the pair finish the passage together.

The rotaries are staggered in depth, near left and far right, with disjoint swept circles. Both remain in the
player view on desktop and phone. Muted sage and dusty blue linen, sagging square lines, weathered pegs and woven stripes
keep them part of the same washing. A snag must visibly tether the cloth, and
an aligned gap must agree with the worn ground. Responsive turning; progress persists; no timer or idle solve.
Cursor motion remains the only verb. Strokes write/read the shared wind; the caught corner responds to local contact.

Restore the lane between curtains one and two: remove the broad rotary-camera and family-sightline exclusions
that hollowed it out. Keep all three curtain puzzles. The family and door stay on inland ground but around a
bend beyond the third curtain. Concealment must respect the original organic washing field. The family exists throughout, never
fades or spawns, and cannot be seen before the third curtain is complete. The former early-glimpse idea is rejected.

## Invariants and verification

- Broad strokes over visible linen answer promptly; strokes on one frame do not turn the other.
- The snag responds to local sweeps, not idle time, distant wind or drawn invitations; its corner stays on the pole until release.
- Each rotary must sit across the naturally legible way forward. The surrounding field should discourage obvious bypasses through organic density, not engineered enclosures.
- Each frame favours its shorter turn towards alignment and resists opposite gusts; the snag constrains both directions until released.
- Green opens a walk into its own sheltered half; blue remains closed until its snag and alignment are earned. Both alignments stay earned.
- Travellers move through each bare half only once that frame is at rest; the inside waiting point stays outside blue’s sweep.
- Fixed scenery forms the lane and hides the family in every preceding camera transition, including billowing
  and partial release of the third curtain. Test wide desktop and portrait views with real gestures.
- Legacy curtain-2 saves still bypass the encounter; rotary saves begin before it; far-shore saves remain valid.
- Build, mechanics at 30/60/120 Hz, real mouse/touch replay, checkpoints, and camera captures gate completion.

## Earlier evidence

The single-rotary prototype was committed as `94c82968`; its captures are in `/tmp/updraft-lines-rotary.Okl0Yk/`.
Its early family glimpse and cleared-out lane were rejected in the playtest above. The 40 m northern terrain
extension remains: arrival heights are unchanged. The world terrain-atlas check has an existing sea-floor mismatch
at `(194, -1750)`, identical in the original baseline; visible-height and normal checks pass.

Worktree: `codex/lines-rotary`. Preview: `http://127.0.0.1:5243/?chapter=rotary&progress=0`.
Main has concurrent work; this worktree contains the prior verified Lines bird-arrival fix required for progression.

## Rejected maze revision — 2026-10-11

Jeremy's correction, verbatim:

> what the heck have you done?! you made it a literal maze of clothes. it's way too obvious now and not at all organic like before..

> what the heck is this?!

> I think you've gone off the rails. go back and look at how the island of lines was originally designed. How it was able to create a funnel for the player while having the island still feel organic and natural

The rectangular bays, connecting walls, sharply cropped corridor and raised overview camera are rejected and removed.
Do not replace them with another engineered enclosure. Study the pre-rotary scene and its original placement rules
before further layout work. Preserve the organic funnel: irregular laundry density and overlap, open sky, varied
heights and a route implied by the field. Mechanical topology tests cannot approve the appearance of the scene.
The two alignments, snag, sage/blue distinction and removal of mandatory unfolding remain approved.

## Original funnel findings

Reference checkout: `/Users/jeremy/.codex/worktrees/lines-original-study/updraft`, commit `de1286a2`.
The original field leaves a variable-width alley around the walk. Nearby lines roughly follow its tangent with
angular variation; farther lines turn across the prevailing wind. Density rises gradually away from the alley.
Lengths, pole heights, sag, garment widths and gaps vary; some short laundry hangs high across the walk.
Grass clearings are soft noise-edged patches, and the camera remains inside the washing. There are no closed
bays or ground-reaching walls.

Our extra camera reservations carved long empty corridors through that field. Also, `against` and `pointAt`
use a fraction of the whole path: adding the rotary detour changes early alley widths, overhead rows and seeded
placement decisions. The original seed alone does not preserve the original placement. Visual comparisons must
use the original separate checkout, not a toggle in the changed build.

The field's palette was also incorrectly restricted to white around both rotaries, bleaching most of the island.
The added northern field began behind the relocated door, leaving a band without ordinary washing around the
third curtain. Screens concealed that underlying omission.

Restoration in progress: remove all custom screen geometry and shader restrictions; restore the original varied
garments, faded palette and noise-edged grass clearings. The procedural alley now follows the rotary masts;
clearing around the travellers' side route would create another way round each frame. Rotary camera reservations
are removed, including the failed foreground-only trial. Bring the northern field
forward so the same irregular rows continue around the third curtain. The family clearing moves farther round
the left bend, rather than relying on a tall cloth wall. Both frames and the snag still need player-camera QA.

Original reference captures are `/tmp/updraft-paired-rotary.3Sh6gz/original-*.png`.
The restored second curtain is recorded in `organic-study-second.png`; later `organic-*` captures are iteration
evidence, not approval. The low camera trials exposed ordinary foreground laundry obscuring the frames, and
the first reveal trial still exposed the family; neither is a finished composition.

The full `organic-wide/` replay subsequently reached the shore but failed the reveal assertion. Its foreground
reservation reopened the gap left of curtain two, a foreground pole crossed the waiting child, and ordinary
washing partly hid the snag. These are rejected iteration results. Preserve the original early field before
further rotary staging; do not keep clearing it to accommodate the camera. The failed foreground reservation
was removed. These failed restoration captures are superseded by the verification recorded in [build_plan.md](build_plan.md).

The later camera correction uses the same irregular field. Short overhead rows stay clear of the rotary arms
and snag, while the final crest opens into the family clearing. Soft, noise-edged grass patches follow the companions' actual
walk; no tall washing walls or rectangular bays return. The northern extension is now 80 m so the family can
stand centrally at (14, −353), with the door at (14, −361). A rounded rise conceals that clearing until the third
curtain has opened. An earlier crest/left-hand clearing trial hid the child behind its far slope and was rejected.
The final approach follows the child over the rise before settling; the camera gently gains height as the child
crosses the third curtain, then lowers into the clearing. Keep both companions in the framing contract through
waiting and walking, because switching that contract only when walking caused abrupt safety corrections.

The torn cloth keeps its continuous carried fold when it catches the rope. Once caught, its collider uses the
rope's actual thickness: the enlarged flight catch proxy pulled the neighboring vertices away from the pinned
fold and produced the jagged shape Jeremy reported. The snagged rotary's world-space anchor and saved angle
are initialized in its constructor so the inbound sailing view cannot render a sheet stretching to the origin.

## Crossing and player-view correction — 2026-10-12

Jeremy reported a long blue strip across the Still-to-Lines crossing:

> fix this. it's appearing on the crossing from the still island to island of lines

He also supplied the obscured rotary waiting view:

> continue. i was going to say, this is also not a very clear view for the player. you must consider the experience from the players camera.

> and add appropriate indicative wind gestures

Initialize the snagged sheet at its post before any chapter update. Compose the rotary approach and waiting view
so both travellers, the playable sheets and the snag are legible, using the existing irregular washing as the
frame. Preserve the early funnel and avoid another broad clearance or enclosure. Turning invitations should
follow a visible sheet's turning direction; the caught hem needs a local lifting spiral. Offer one next action
at a time, pause hints during input, and never let invitations solve the mechanism.

Jeremy expanded the acceptance criterion to the entire island:

> the sheet that blew off is gone all weird. and why is the door on the beach, with the camera going to the door before teh child even got there? dude. the level of quality here is atrocious. Do not stop until the entire playthrough of the lines island is of exceptional quality for a human player who sees and experiences the game from the camera. Every camera movement must be intentional and cinematic in it's pacing as well.

Review the full crossing, all three curtains, both rotaries, the loose sheet, family clearing and door in motion.
The family and door must stand inland. The camera accompanies the child into the clearing before settling on
the reveal; it cannot abandon the walk to frame the destination early. Fix physical cloth contact and flights
against their relocated posts, not just their endpoints. Desktop and portrait playthroughs must show clear
companions and interactions, organic enclosure, an earned reveal and continuous camera pacing.

## Arrival shoreline correction — 2026-10-12

Jeremy supplied the torn shoreline during disembarkation and asked:

> ?? fix htis

The Lines chapter still applied a 96 m circular rendering cutoff around the moved island centre. The cutoff
removed the arrival beach as soon as the crossing became Lines, leaving clipped sand and black water artifacts.
Keep the source view's secret-shore exclusion used during sailing; let the journey's room partition bound Lines.
Do not change the island shape or arrival camera to hide this renderer defect. Verify from offshore through the
actual chapter handoff and disembarkation, including the ultrawide player view.


## Player-camera polish — 2026-10-12

Jeremy's brief (verbatim):

> - I think the grass being flattened deliberately to make a path only really works around the spinners, but not as much leading up to or leading away from. what do you think? Maybe tone the flattening down a bit?
> - the clothes being stuck on the snag is not immediately obvious because the child is a bit far away. I think it makes more sense for the child to walk into the first spinner and it should feel a bit enclosed. And then the camera can subtly pan towards the snag as the next puzzle to solve. you know what i mean?
> - i'd like a bit more travel time between the secret island through the door and the island of little boats. not by slowing down the boat but by moving the location of the secret island to create a bit more space. like +10-15 seconds or so. What im trying to do at a high level is create more of a sense of being "lost" like "what's next?" within a dream and then resolving it with the next island appearing out of the mist. instead of the next island instantly being visible the moment you leave.
> - I think there's a bug where as you leave the secret island to the island of little boats, the water and everything sort of renders completely differently (i think it's got something to do with a different wind gust factor being 0.5 for the little boats island maybe that isn't being smoothed over properly?)
> - To make up for the island of lines being extended a little bit, which does interfere with the timings we had from the still island to the island of lines, could you reduce the boats speed by something really small like 1%?
> - During that crossing from the still island to the island of lines, it's quite nice except for two small polish items. 1) the whale comes too high out of the water 2) I'd like to see more gulls and especially more sheets. What i mean is that the "procession" (if you can call it that) ends a bit too soon and i'd like the sequence to play a bit longer. understand what i mean?
>
> Otherwise, really good job on the island of lines rework. i want to understand what it was that made it click for you. Was it thinking about the experience completely from the perspective of the player camera? I'd like to capture whatever it was and put it in the project's AGENTS.md so that other sessions working on the game can benefit as well.

This supersedes waiting outside until both rotaries align: align green, walk into its open half, settle beside
the mast, then notice and free the blue snag before aligning blue. Green sheets frame the waiting pair without
blocking them. The camera accompanies their walk and only then eases its attention towards the snag. Retain
the original irregular field, two alignments, contrasting cloth palettes and physical reveal. Soften worn grass
on approaches and exits; retain local footing around mechanisms and waiting companions.

Move only the secret shore to lengthen its departure by 10–15 seconds at unchanged sailing speed, with a period
of open sea before Little Boats emerges. Migrate existing saves with the shore. Smooth sea-state handoffs,
preserve other crossings' pace, reduce Still-to-Lines drive by 1%, lower its distant whale, and stagger more
gulls and sheets so the procession lasts longer without obscuring the arrival.

## Flying linen palette — 2026-10-12

Jeremy's request and correction (verbatim):

> ok great! one last thing, can some of the clothes flying in the wind be different bright colours? what do you think

> actually no don't do bright red, blue oryellow. we must save those colours for the specific motif beyond the secret door. maybe try different muted colours? not sure...

Keep the majority of the procession pale linen, with three scattered sheets in muted mauve, dusty rose and
warm taupe. Reserve bright red, blue and yellow for the secret-door motif. Judge these accents in the actual
sailing camera and golden light; preserve flight paths, timing, cloth motion and camera staging.

## Rotary weight and snag release — 2026-10-12

Jeremy's brief (verbatim):

> oh and one other thing, can you give the spinners a bit more weight and biased towards spinning only in one direction? right now they don't feel like they have enough of a weighty feeling (not to weighty, but just enough that they don't feel like toys). Maybe a very subtle once or twice off metal creaking sound effect too.
>
> And then in terms of the cloth being caught on the pole, I'm not sure if it should be an updraft, but i'll let you decide what you think is best. Either way it could probably be tidied up a bit (right now the wind lifts the cloth way above the pole into mid air before it is counted as not snagged anymore. I would have expected it to instead behave a little bit more like the pegs).

Keep the current layout, palette and staged walk. Limit rotational acceleration and speed so a sweep gathers
momentum, coasts briefly and settles. Each frame favours its shorter turn towards the opening; opposite gusts
meet more resistance without becoming inert. Invitations indicate that preferred turn. One quiet metal-bearing
creak per frame follows actual movement, with no looping or replay on restore/mute.

Supersede the required updraft with a local sweep across the caught hem, like the peg interactions. The corner
stays at the pole until it slips free, then falls back into its hanging sheet. Remove the raised invisible
anchor, use a short local sweep invitation, and retain staged access and persistent release.
