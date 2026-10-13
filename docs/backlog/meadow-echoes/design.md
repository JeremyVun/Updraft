# The meadow carries the song

Status: playable design in progress, isolated on `codex/meadow-echoes`. Jeremy authorised continued design,
implementation and player-camera verification in this session. No merge or deployment is requested.

## Jeremy's brief (verbatim)

> i think i know why im struggling to find music.. there's not enough to do on the meadows island. it probably doesn't make sense narratively, or atleast it coudl be polished up a lot more. just like the island of lines was tidied up

> Agreed. start working in a worktree. flesh this out. and remember the rule about the experience being all about what the player sees from the camera viewport. Keep going until you have something you think works really well

> that was surprisingly quick. are you sure it's ready? if so, spin the dev server up again. if not, keep going I feel like you may have been lazy

Musical direction discussed immediately before this:

> after the piano can we try wind or flute instead or strings?

## Intent

The piano gives the meadow a voice. The child discovers that its flowers remember the tune, and the wind carries
that music onwards until a real swan call answers beyond the rise. The pond then changes anticipation into a missed
connection, followed by the small kindness of returning the feather. The player participates in the middle of the
chapter instead of simply following the paper across it.

Preserve the piano and its four colour waves, the cygnet on the keys, the family's already-preparing departure,
the short swim and return, and the shower/rainbow. No flight practice, hostile flock, timing test, added walls,
score UI, written instructions or collectible counters. Musical flowers are an invitation to play together;
the child pauses through curiosity, not an invisible physical barrier.

## Playable direction

One encounter, three oversized bellflowers growing irregularly through the existing hollow between piano and crest.
The child approaches and touches the first. It nods and releases a small ivory seed plume, with an airy phrase
related to the piano. The receiving bloom sways and opens towards it. A broad wind stroke carries the plume across
the first gap; the higher second receiver invites lifting as well as directional strokes. Unhelpful strokes only
move the plume; no reset, timer, failure, or lost seed. Idle seeds return towards their source without advancing.
Each completed transfer stays complete. At the receiver the plume folds into the bell, which opens and answers.
The child walks to it before the next seed is offered. The final answer leaves a rest for the real family call.

The simulation receives genuine pointer motion over the visible plume, in screen space; mute/idle/ambient wind
cannot solve it. Mouse and touch share generous hit areas and gesture invitations. The source/receiver/child
remain together in frame. Seeds remain close enough to these physical anchors to be recoverable.

A silent single flower on the grey piano approach foreshadows the shape; the landscape gains its voice only after the piano. Existing post-pond harebells remain a
gentle reprise. The new foreground voice is procedural flute-like breath; background music ducks smoothly while
it speaks, without restarting the score. Jeremy's uncommitted music on main is not part of this worktree.

## Camera and verification

Judge the actual moving player viewport, including portrait. First establish child, source, seed and receiver;
hold the view through input. Character travel earns the next view; never jump ahead to the next object. Avoid
foreground grass hiding the child or a seed plume mistaken for an interface orb. Hide the departure kite until
the pond is finished. Review approach, both transfers, departure into the crest, and the pond continuously.

Baseline stills: `/tmp/updraft-meadow-before-{piano,walk}.png`. They expose a far-off departure kite already visible
behind the piano. The baseline's route-only tests intentionally bypass the existing piano, so cannot substitute
for a real-gesture playthrough. Add meaningful input/idle/recovery/checkpoint tests and inspect real renders.

## Review questions

- Do the seeds and receiver read as a musical exchange at playing distance?
- Can broad strokes and circles deliver them without precision or trivial one-frame completion?
- Does moving between flowers feel like exploration rather than a row of mandatory buttons?
- Does the final sound transition lead naturally into the established crest view?

Revise the prototype if these answers are poor; a passing numeric check is not a visual verdict.


## Implemented experience — 2026-10-13

The new exchange occupies about a minute after the piano, including the child's walking and listening. Two broad
wind transfers carry an ivory seed plume between three violet bellflowers. The first crosses the hollow; the second
rises up its far side. A circle can lift the plume too. The receiver opens and gives a short D-major pentatonic
answer in a procedural breath voice. Small satellite blooms make each plant belong to a clump. The grey approach
flower stays silent, preserving the piano as the first source of the meadow's voice.

The child touches a bowing flower, watches the seeds, and follows only after their arrival. The last rest contains
the distant swan call: both characters turn toward it before the walk resumes. The existing crest, migration,
feather, shower and departure follow. The departure kite stays hidden through the pond encounter.

Camera corrections made from actual captures: lowered and brought the landscape camera closer; moved it onto
the eastern side as the child advances so the pond is outside the flower view; gave portrait its own angle rather
than backing far away to fit the landscape shot. Portrait can still glimpse distant water on the first slope,
but keeps the child and both playable flower mouths legible. The seed mouth sits below the petal lip and above the
child's hood. Directional input stays equally responsive near the receiver instead of needing increasingly tiny
strokes. Seeds settle into the bloom continuously; the bloom opens gradually. Save points retain each completed
transfer and resume the walk to its receiver, including the final listening beat.

The readiness review found two missed details: the flower touch was hidden behind the hood and aimed into empty
space, and returning to the ordinary walking camera inserted a large retreat before the pond. The child now stands
beside the bloom and rests the near mitten on an actual petal vertex before it rises. Leaves follow the bending
stem. Camera coverage includes the tops of both flowers. The final flower view passes directly into the pond
composition as the child walks the next sixteen metres. The crest framing holds the whole child, with a slightly
higher eye to see over the bank and no automatic retreat during the swans' departure.

Checks and captures are recorded in `verification.md`. These are automated gesture playthroughs and inspected
stills, not a claim of a human listening or motion review. Jeremy's review of the voice, feel and narrative remains
the next creative decision. The worktree is a playable direction, not merged or deployed.
