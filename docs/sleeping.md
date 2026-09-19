# Sleeping island: narrative repair

September 20, 2026. **Design proposal, not implemented or playtested.** This records the response to Jeremy's
playtest; it does not describe the current build. The earlier lighting pass is integrated. The subsequent
bedtime animation experiment remains isolated in `/tmp/updraft-bedtime` and has not been integrated.

## Jeremy's playtest

> im playesting it now, the animations need to really be tidied up, especially the animation of the child
> getting into the bed and tucking themselves in. It's also incredibly fast - there should be more yawning,
> more fighting to stay awake etc.

> also, im having a lot of difficulty just blowing the feather up to the curtain at the top of the hill...
> the narrative also doesn't make sense in the details... the cygnet doesn't open the curtains / it just
> opens on its own. What exactly did the cygnet do or risk in order to help the child? What is forcing the
> cygnet to have to fly down since they climbed up the hill? There was absolutely no risk, no feeling of danger.
>
> the sequence was over incredibly quickly and i was left slightly confused (although i understand what
> it was supposed to be about narratively as a co-creator of the game, but as a player i would be very confused).
>
> And i misjudged the distance, the curtains are actually quite close to the child... I also don't think the
> bed should be in bottom of a depression / pit - it's a bit strange.
>
> I need you to think through it much more carefully. Sweat the details, and make the sleeping bed scenario
> make more sense.

## What fails now

The curtains open on elapsed glide time. The bird never touches them. The climb ends on continuous ground,
so flying is unnecessary. A shiver and a look back cannot establish a physical risk that the scene does not
contain. The feather can be pushed away from the route, while idle assistance can finish the ascent; the
player does more work yet has less control. The bed is lowered by an explicit terrain hollow. The original
bed entry translates and rotates the child into place in about five seconds, without distinct supported
poses or time to resist sleep. Passing the chapter's current automation proves progression, not comprehension.

## Proposed causal sequence

The child exhaustedly accepts a bed. Cold makes the bird leave that shelter. It finds morning tied behind a
window. Opening the curtains requires it to leave solid ground and trust its healed wing. The bird frees the
curtains; the player's wind carries it back through the morning it released.

### The bed and the first hint

Put the bed on a broad, gently sloping grassy terrace. Keep the rug, floorboard fragments and warm lamp;
remove the bowl around them. Night should feel hushed and inviting at first. Fatigue is visible on the walk:
slower steps, a silent yawn, drooping eyelids and a recovery. At the bed, give separate supported actions to
setting down the bird, turning, sitting, nodding awake once, swinging legs onto the mattress, lowering the
head to the pillow and pulling the quilt to the chest. Hands must meet the quilt before it moves. Allow
roughly 20–25 seconds at the bedside, with time spent on actions rather than an idle delay.

Before sleep, frame the distant window and bed together once. It occupies a higher shoulder of the island,
with one thin warm seam in its curtains. Screen composition must establish the relationship; neither a
longer walk nor a smaller window is evidence of distance by itself.

The child breathes and responds sleepily to the bird, then settles again. Frost approaches through the
grass and the surroundings lose warmth. The lamp remains a small refuge. Preserve the unanswered call;
do not add voiced yawns, narration or an implication that the child has died. The bird notices the warm
seam after its attempts to wake the child fail.

### The walk belongs to the bird

The pillow feather remains the scrap of home the bird follows. A broad sweep sends it ahead along the
visible route. Gestures give it lift, sway and forward encouragement; they must not send it back downhill
or make it disappear behind the camera. Use a generous screen-space response area and constrain wandering
to a corridor a few bird-lengths wide. Idle assistance can recover mistakes, but strong correct strokes
must produce visibly faster progress than waiting. The player never has to deliver the feather precisely
into the window. At the destination it rises through the seam and ceases to be a steering target.

Keep one departure hesitation and one moment when the bed disappears into fog. The player clears the air
and gives the bird company. Avoid stacking several similar timed look-backs. The changing view should make
the short walk feel consequential without making it laborious.

### The curtain mechanism and the commitment

The window stands at the lip of a steep shoulder. The walking route ends at firm ground beside it. Its
curtains are tied together by a visible loose ribbon. The ribbon's long end hangs on the outward face,
beyond the lip, above open air. From the bird's footing it is too far to reach with its beak. Ground behind
the window cannot reach this end either. There is no shelf below the ribbon.

Show this in a close three-quarter side view: feet on the edge, ribbon beyond it, empty space underneath.
A gust billows the cloth but the knot holds, demonstrating why wind alone cannot open it. The bird reaches
from safety, falls short, steps back, looks towards the child and tests its healing wing. Give these actions
distinct silhouettes. The bandage releases before the player is invited to make the leap.

The player's familiar circles build supporting air. The ribbon lifts and the bird opens its wings as the
wind strengthens. Below the launch threshold, it can settle safely back on the ledge. With sufficient lift
it deliberately makes a short assisted hop out to the ribbon and grips the loose end in its beak. This is
not powered flight up to a second perch.

Its weight and one deliberate tug draw the end through the loose knot. The knot, ribbon and curtain tension
must visibly respond to that contact. When the end comes free, wind parts the released curtains and morning
spills out. **Release is driven by the completed physical tug, never by starting flight or waiting.** The
bird holds a loose ribbon end, not a loop around its body. Avoid an image of strangulation or prolonged
helpless dangling.

Unfastening the ribbon leaves nothing to hold and no ground under its feet. That is the committed risk the
bird saw before jumping. It spreads both wings and glides down towards the child, supported by the wind.
There is no surprise collapsing platform or invented reason it cannot use its walking route: it has
already chosen to leave that route to do the thing that helps the child.

The first glide should dip briefly as the wing takes the load, then settle. Continued wind visibly steadies
and lifts it. Once committed, baseline lift guarantees a safe return if the player stops; do not punish a
child player with a crash or reset. Any hesitation or retry belongs before the jump. Keep the curtain tug
short enough that it reads as effort, not a bird hanging in distress.

### Morning and reunion

Hold the opening long enough to see the bird caused it. Then show light travelling down the slope towards
the bed, ahead of or alongside the bird. Morning comes from the window: frost recedes in that path first,
grass greens, stems rise and the cold blue gives way to gold and fresh green. The bed can remain in night
for several seconds while the route above it warms. Preserve the earlier lighting work, changing its trigger.

The bird reaches the blanket; light reaches the pillow; the child stirs and discovers the bird. Let one
breath pass before sitting up and drawing it into their lap. Hold the reunion before showing the departure
invitation. The emotional movement is comfort, unease, loneliness, hesitation, commitment, relief, tenderness.
The open view from the terrace should make the restored island part of that relief.

## Acceptance before integration

- Watch the whole sequence at normal speed on phone and desktop, including real imprecise feather strokes.
  Do not use idle completion as the only input test. Correct strokes help; missed strokes never lose the guide.
- Check terrain and camera together. The bed has an open terrace; the ribbon is visibly unreachable from
  standing ground; the jump and drop can be understood in a single composition without an explanatory caption.
- Pause before contact, during the tug and at release. Beak and ribbon meet; the knot responds; curtains stay
  closed until released. Blowing on them while the bird remains on the ledge cannot solve the chapter.
- Check the bedtime animation from the side as well as the story camera. Hips meet the mattress before the
  recline, feet clear the edge, head meets the pillow, hands move cloth, and no shared pose leaks into walking.
- Verify low-input and interrupted-input cases, both checkpoints, terrain CPU/GPU parity and departure.
- Ask a viewer unfamiliar with the design what the bird wanted, why it jumped, what opened the curtains and
  why it flew home. Those answers are the comprehension test; passing automated state transitions is not.

Build in that order: prove the geography and physical action in a simple playable scene, then integrate
bedtime choreography, assisted feather controls, cameras, light timing and reunion. Do not call a prettier
automatic curtain opening the completed repair.
