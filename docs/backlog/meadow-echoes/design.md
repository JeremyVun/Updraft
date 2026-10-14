# The meadow carries the song

Status: landscape, musical play redesign and wind-instrument foundation approved for merge onto `main`.
Recorded phrases and final musical synchronisation remain a follow-up; deployment is not requested.

Merge instruction (2026-10-14, verbatim):

> can you merge onto main?

## Jeremy's brief (verbatim)

> i think i know why im struggling to find music.. there's not enough to do on the meadows island. it probably doesn't make sense narratively, or atleast it coudl be polished up a lot more. just like the island of lines was tidied up

> Agreed. start working in a worktree. flesh this out. and remember the rule about the experience being all about what the player sees from the camera viewport. Keep going until you have something you think works really well

> that was surprisingly quick. are you sure it's ready? if so, spin the dev server up again. if not, keep going I feel like you may have been lazy

Musical direction discussed immediately before this:

> after the piano can we try wind or flute instead or strings?

## Redesign brief — 2026-10-13 (binding)

> are you sure? it looks really low quality and low effort to me. Something doesn' tlook right. what do you think?

> lets step back a bit, what is the plan? what are you trying to acheive with the meadows chapter?

> yea and maybe the piano needs to be a bit closer to the entry point. I like the opening sequence and camera shots where the child walks up the grey shore bank. Please try to preserve that part, but everything after is fair game to change e.g. if you want to change the feel of the landscape to be more like rolling grass hills and the piano a bit closer, then a landscape that makes sense for the "enjoy what you've awakened" phase and the discovery of the family. I am giving you ownership of this and i know you'll do a good job. Don't stop until you think you've got an amazing idea and implementation

Preserve the arrival beach, shore bank, climb and their camera direction. Beyond that outlook, the whole chapter
may change. The first prototype's tall bells read as lamp posts; seed deliveries made the middle feel like a row
of puzzle stations. Passing mechanics and viewport bounds did not establish visual quality.

The revised middle is play in the landscape the piano awakened. Low, irregular flower swathes sit in a sheltered
fold between rolling hills. Sweeping the wind through them bends successive clusters and answers the piano in
short breath phrases; petals lift from the responding plants. The child lets the cygnet down to explore beside
her. Farther up the fold, circling or upward strokes lift feathery seed heads into a drifting cloud around them.
The cloud opens into the sky, leaving a musical rest for the swan call. They turn, gather together, and approach
the crest: only their arrival there reveals the family. The two interactions retain completed progress, accept
broad gestures, and never solve from ambient wind. There are no receiver sockets or giant flower props.

Bring the piano onto the near shoulder beyond the preserved bank, with a broad view across the sleeping hills.
Compose that view with clear piano/child silhouettes and no flowers standing over its lid. Sculpt the middle as
overlapping rounded hills and a sheltered fold; preserve the pond's natural basin and flight clearance. Inspect
the first outlook, duet, awakening, both play spaces and the family reveal in the actual player viewport, then
the entire connected approach–play–departure. The original worktree-only scope is superseded by the merge
instruction above; deployment remains outside this request.

## Piano placement clarification (verbatim)

> doesn't it make more sense for the piano to be more ontop of a small hill?

> or maybe your new position is ok thats fine too. just think through it and figure out what makes it easier to do the nice cinematic camera shots

The piano stays close to the entry at (-18, -678), now on a rounded knoll overlooking the lower meadow.
Retain the original piano camera's bearing and gradual widening at that new position. Limit the finale's
rise so the family remains concealed beyond the far crest. The original
shore bank and pond terrain stay unchanged; the new hills blend into them.

## Piano review correction — 2026-10-13 (verbatim)

> the sunflowers in hte distance are green. was that intentional?

> was there a reason you changed the camera design to keep moving to the right everytime the player plays one of the piano motifs? it looks really strange. what was wrong with the previous camera pattern?

The more oblique, lower view exaggerated sideways movement after each answer. Restore the motif camera settings
from before the Meadow rework, retaining the relocated piano and landscape. The old 46 m final rise exposes the
pond from the new knoll; retain the lower finale, rising from the third response's 14 m to 18 m. Compare against a separate original
build and replay the real gestures. The distant seed bed must remain grey with its surrounding ground until the
musical colour wave reaches it; its material must share the live atmosphere and life uniforms.

## Wind instrument and piano foundation — 2026-10-13

Jeremy's brief (verbatim):

> ok cool here's what i want to do. I want to add some kind of really beautiful wind instrument (i dont htink it should look literally like a flute though since a flute is too small) that plays a beautiful flute phrase, and then the child has to respond with the piano phrase. What i can't figure out is where the players action should be. should the player create wind to blow through the instrument? Or should there be a auto generated "wind" that plays the wind instrument and then the player has to respond on the piano. what do you think?

> sounds good, can you build out the bones for this? I already have the phrases for the music and i'll supply them to you (we'll need to cut up some clips). After the chil'ds final response, the wind instrument will play and be quite climactic as it does a final greening

Build the approved foundation: a hollow, weathered bough just beyond one end of the piano, with an open mouth
and a trembling reed. It is large enough to read with the child and piano in the existing shot. A brief authored
breeze plays each call; the child turns to listen, then the familiar piano gesture invites the player's reply.
Keep four forgiving responses and retained partial strokes. Calls cannot count as answers or colour the hills.
After the fourth response, leave a musical breath, then let the bough's longer final phrase carry the great
colour wave and the existing camera rise. Retain the companion's keyboard moment under that final phrase.

Use provisional procedural breath notes while Jeremy prepares his recordings. Keep phrase note events,
durations, reply patterns and the final greening cue together so the supplied clip timings can replace them.
The recording edit and final musical synchronisation remain a later pass with the actual audio. Preserve the
shore climb, green footsteps, piano camera bearing and all subsequent Meadow encounters.

Jeremy requested a stable server while working on timings: frozen QA build at `http://127.0.0.1:5246/`, served
from `/tmp/updraft-timing-preview-AH5XUd`. Keep that snapshot unchanged while development continues on 5244.

## Meadow life and composition

Further review (verbatim):

> more animals and flower patches? or do we have a perf issue?

Add small wildlife groups near the revised walk and loose wildflower banks on the slopes. Keep the musical
flower bed and seed heads distinct and leave the child, companion and gestures clear. Use the existing batched
creatures and baked wildflower masks; compare the local rendering cost before and after. The original sparse
placement was not a measured performance restriction. Preserve the grey opening and let the music wake the
additional life with the rest of the meadow.

Approach colour refinement (verbatim):

> I'd like to make a change to the meadows. when the child walks through the grass up to the piano, i'd like to see the grass turn green as well. thoughts?

Let the child's climb and approach leave a narrow, soft-edged green trail using the existing life field. The
colour remains where she walked and joins the piano's patch; untouched hills still wait for the music. Keep
the shore, route and camera choreography, with no extra particles, flattened path or camera move.

1. Preserve the beach and profile climb. Green follows the child's steps; at the brow the piano waits in its patch of colour.
2. Follow the paper onto the knoll. The child sits, plays one note, and invites four wind answers. Colour spreads
   into the hollow. The cygnet's turn on the keys remains part of the finale.
3. Walk down into low lavender, rose and ivory flowers. The child sets the cygnet down beside her. Broad strokes
   through three loosely staggered clusters open the flowers and lift petals, answering with breath notes. Played
   clusters stay open; all three need the player's wind. Idle and off-target movement cannot advance the scene.
4. Walk together through the grassy fold to pale seed heads. Upward strokes or circles lift a cloud of feathery
   seeds. Sustained gentle wind carries it clear; unattended seeds settle. Once released, the cloud disperses.
5. Walk toward the far rise, hear the real swan call, and gather the cygnet into the satchel. The camera follows
   their travel into the pond reveal. The family's departure, swim, feather, comfort, shower and rainbow continue.

The flower beds belong to the rolling landscape. Their shorter grass has a soft irregular edge; there are no
rectangular corridors, paths carved across the island, oversized bells or receiver sockets. Existing decorative
flower clumps stay outside the playable beds so they cannot obscure the child or the wind targets. Wind bending
saturates before stems stretch unnaturally. The two beds sample their own local wind.

The camera holds the child, cygnet and active plants together. Portrait frames the receding flower clusters rather
than losing an outer target. At the end of the musical play, the camera blends into the pond composition over the
child's next sixteen metres of walking. Movement earns the view; a new camera must not race ahead to a destination.
The departure kite and the boat at the far shore remain concealed until the pond sequence is over.

Completed stages retain the existing `echoes-1` and `echoes-2` save names. They resume the remaining walk and
listening beat, including after a reload. The interactive breath voice is procedural Web Audio; background scores
are not replaced by this work. Music pulls back while the local phrases play.

## Verification and quality bar

Play from the landing through the piano, both wind interactions, the family and departure with real pointer
input. Repeat the interactions and transitions in portrait with real touch events. Inspect intervening player
views, not only composed stops: whole silhouettes, grass occlusion, contact, concealed pond, readable wind targets,
strong gusts, and camera approach/hold/departure. Preserve the opening geometry against the previous revision.

Check idle and wrong-location input, broad strokes and circles, retained effort, seed recovery, checkpoint reloads,
the piano's colour waves, pond sight lines and every swan's run and lift. Numeric checks establish mechanics and
framing, not cinematic quality. Chronological still inspection is not a human motion or listening review.
Current evidence and remaining limits belong in `verification.md`.

The rejected prototype used giant bellflowers and two seed deliveries. Its successful tests did not make those
objects or the scene good; those earlier verification claims must not be used as evidence for this redesign.
