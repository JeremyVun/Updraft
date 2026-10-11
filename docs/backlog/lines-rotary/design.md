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
ordinary neighbouring washing-line post. Turning pulls that sheet taut and stops the frame. Lift the hem free,
then turn the bare halves of both frames toward the route. They catch in place independently; once both have
settled, the child and cygnet walk through together. This replaces the single-rotary enter/turn/exit proposal.

The rotaries are staggered in depth, near left and far right, with disjoint swept circles. Both remain in the
player view on desktop and phone. Muted sage and dusty blue linen, sagging square lines, weathered pegs and woven stripes
keep them part of the same washing. A snag must visibly tether the cloth, and
an aligned gap must agree with the worn ground. Responsive turning; progress persists; no timer or idle solve.
Cursor motion and circles remain the only verbs. Lift and strokes write/read the shared wind.

Restore the lane between curtains one and two: remove the broad rotary-camera and family-sightline exclusions
that hollowed it out. Keep all three curtain puzzles. The family and door stay on inland ground but around a
bend beyond the third curtain. Concealment must respect the original organic washing field. The family exists throughout, never
fades or spawns, and cannot be seen before the third curtain is complete. The former early-glimpse idea is rejected.

## Invariants and verification

- Broad strokes over visible linen answer promptly; strokes on one frame do not turn the other.
- The snag responds to local updrafts, not idle time, unrelated circles or drawn invitations.
- Each rotary must sit across the naturally legible way forward. The surrounding field should discourage obvious bypasses through organic density, not engineered enclosures.
- Each frame can be turned both ways; the snag constrains both directions until released.
- Opening one frame never starts the crossing. Both independently earned alignments stay earned.
- Travellers wait outside the sweeps and follow the bare halves only once the mechanism is at rest.
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
has been removed. The current worktree is unfinished.
