# More to do on the path

Status: choosing ideas. Nothing is designed yet; each accepted idea becomes its own section here, then its own plan.

## Jeremy's words (verbatim)

2026-10-04:

> I think i'm looking for more puzzles and challenges so to speak. I like that the game is meditative and very
> cinematic, but i get the feeling people are going to complain about not having "enough to do".

> add a backlog items for optional secrets, but this session im looking for things to do on the active path.
> 1, 2, 3, 4, 6 all make sense to me in that sense.

The five directions he accepted: steering air as a fluid (wind bending round walls and through gaps), puzzles that
combine verbs already learned, chain reactions through the pieces of home, the cygnet as a second pair of hands,
and something to do on crossings. Optional secrets are a separate item ([../secrets](../secrets/)).

His answers to the first room-by-room proposals:

> - the drowned village needs something else. I'm not sure about the logjam, that seems like a replay of the snow
>   drift mechanic on the sleeping island. Any other interesting ideas?
> - I like the idea of bringing the giant plug and bathtub into the little boats island. So it's somehwat a puzzle
>   about how to help the little boats get out onto the open sea.
> - good idea about using the swing to help the player untie one of the bow knots
> - good idea for the dark woods - see if you can come up with something more interesting though
> - I don't know about the yellow jumper idea, it's a bit too finnicky maybe at that point of the game, and it
>   doesn't exactly fit. any other ideas?

His answers to the second round:

> - the dark wood facing the shapes in the dark is a great idea, can you get an opus 5.5 sub agent to start
>   prototyping this in a worktree
> - i like the pinwheels drive a pulley idea, the only problem is there doesn't seem to be much space left on the
>   island of lines for it. try exploring and prototyping something with an opus 5.5 sub agent in a worktree.
> - for the drowning village, whats the narrative motivation for this chapter? i do like the idea of the houses
>   lighting up under the water, and the weather vane idea is interesting? Are you proposing turning the drowning
>   village into a maze puzzle? Any other ideas?
> - I reckon have a go getting an opus 5.5 sub agent to prototype something for the little boats island in it's own
>   worktree

## Accepted

- **The little boats: getting out to sea.** The oversized bath plug on its chain and the bathtub on the far bank,
  scenery today, become the puzzle of how the toys get out onto the open sea, replacing the outgoing current that
  now carries them out by itself.
- **The birches: the swing frees a knot.** One of the scarf's tangles hangs where only the child at the top of the
  swing's arc can reach it; the player pumps the swing with gusts to get her there.
- **The dark wood: facing the shapes in the dark.** Something looms ahead in the dark (antlers, a crouching beast,
  reaching fingers) and the child stops. The player moves light round it (fireflies gathered by circles and carried
  by gusts) until, lit from the side, it shows itself as something harmless; she steps forward, touches it and walks
  on. Being prototyped on branch `proto-wood-shapes`.
  Jeremy on the first prototype (a firefly lantern gathered by circles): "it's interesting but i think it could
  be done better. As a player, i learn to spin around an ember, but i dont see an ember or some kind of light point
  of interest here to spin around / updraft. I was also thinking if we should add an owl as well or instead."
  Second version, agreed ("yea have a go trying that"): no fireflies. The glowing eyes are an owl's, sitting in the
  dead stump's antler-like fork. Two waiting coals of the usual kind: the obvious one on the path in front of her
  throws a huge antlered shadow up the rock and makes it worse; the one off to the side shows the stump and the owl,
  which blinks, hoots softly and glides off ahead. The puzzle is which coal, not a new verb.

  Jeremy on the owl version (branch `proto-wood-owl`): "we shoul donly have one ember that reveals the owl (i.e. the
  one on the side). the rock backdropss are unecessarily large, we don't need them to be such a big part of the
  sequence other than to have a spooky shadow cast on hte background before the child lights the ember. I'd make the
  tree stump a bit taller than the child so it reads more spooky and frightening. the owl is really cute when it
  flies away, but it should probably fly away upwards. Right now it flies away at almost ground leveel and through
  the rocks." So: no front coal; the antlered shadow is already on a modest backdrop before anything is lit (thrown by
  the light she already has); one waiting coal, off to the side, reveals the owl; the stump stands taller than her;
  the owl leaves upward, clear of everything.
- **The island of lines: a pinwheel winds the boat in, on the shore beyond the red door** (Jeremy: "yes i think this
  is a good idea to try"). The boat is moored out on the water; a pinwheel on the bank drives a pulley line that
  winds it in to the shore. It adds a beat after the door rather than replacing a curtain. It knowingly relaxes two
  rulings for this shore: "beyond it only open grass, the kite and the boat" and pinwheels staying with the washing. **Approved** and merged (branch `proto-lines-shore`; Jeremy: "the shore is approved"). A save past the door
  still resumes just before it, with the boat moored out again.

The little boats' bath and plug are **approved** and merged (branch `proto-boats-plug`; Jeremy: "the plug
could be very slightly easier to pull out, otherwise it's approved"). As approved: the toys ground on a shoal; the
island's own gust rocks the bath on its feet with a few wind lines, showing it can tip and which way, without
spilling; only the player's push toward the stream pours it, the hint drawn that way; the risen water carries them
over; the plug in the mouth needs an updraft (circles over it lift it in tugs until it pops; gusts only rock it),
which makes this the room that first teaches circling. Production still needs: rewriting `little-boats-logic-check`
and `little-boats-check` to play both steps, bigger darker shoal stones, the departure kite out of the plug shot,
and `docs/chapters.md`.

## Rejected

- A logjam of debris in the drowned village's streets: a replay of the sleeping island's snow notch.
- The island of lines' pinwheel pulley as built (branch `proto-lines-pulley`): it changed how the second curtain
  opens. Jeremy: "the pinwheel puzzle is not approved. all it did was replace one of the existing puzzles...". The
  point of this item is more to do; a new idea must add a beat, never swap one.
- Blowing the yellow jumper along the lines to its parents on the island of lines: too finicky that early, and it
  does not fit.

## The drowned village

Jeremy, third round:

> I feel like i might have over steered you with the drowned houses and the lights and you're trying to make the
> idea work. Or maybe it genuinely is a good idea with the underwater lights and channels. Either that, or i just
> don't have a vision here for what you're trying to do. I think i'd be happy with you thinking about creating an
> engaging puzzle that fits the theme of the chapter, that looks great and plays great and adds to the atmosphere of
> the game, and prototyping it out with an opus 5.5 sub agent.

> I dont think the "holding on" works because it depends on the player having "fast reactions" for it to play well,
> and if the player doesn't realise, the mechanic just doesn't work.

Rejected: the underwater lights as the puzzle (keeping lights awake is upkeep, not a puzzle; the channel has one way
so it needs no guiding; and the wood, the sleeping island's morning and the mirror's stars already make three light
rooms in a row); holding on to the plane against the storm (needs fast reactions, and a player who does not notice
gets nothing); a maze of any kind.

Chosen for the prototype: **the weathervanes.** The room's job is the way down into the dark, where the dream takes
things from the child one at a time; the becalming is the first time the journey needs the player. So the puzzle
lives at the becalming. The boat drifts into a drowned square among the roofs and the air dies. Round the square,
vanes on chimneys and ridges point every which way, creaking; the spire's vane, a swan, points on along the
channel, north, where the family flew. In this dream a vane does not show the wind, it decides it: a gust swings a
vane and it settles where it is left, and each vane brought round to agree with the swan sends a breath of air
across the water toward the boat. When they all agree the wind comes back from behind and fills the sail. One
square and one way out: a noticing and aligning puzzle, not a maze. The wind the player called back keeps
building into the storm.

Jeremy on the first vanes prototype (branch `proto-drowned-vanes`): "i odnt know.. as a player it's very
unintuitive and i can hardly see the vanes against the sun glare. They don't read like points of interest to me.
maybe it's just a question of level design?"

Jeremy: "yea, really have a think about how to do this puzzle well. It may need some tweaks to how it works".

Why the first version fell flat: nothing visibly caused anything (a vane turned and air happened elsewhere, a rule
only); the same act three times was a chore, not a puzzle; and small dark shapes against the sun drew no eye.

**Third version: steer the last breath of wind to the sail.** When the air dies everything goes to glass except
one thin band of ruffled water: the last of the sea breeze, entering the square through a gap between houses and
running across it past the boat, with leaves riding it and a few wind lines. It is the only thing moving, so the eye
and the child's gaze go to it. A vane standing in a stream catches it and sends it on the way its arrow points, like
a mirror turning a beam, visibly bending there. A stroke across a vane swings it; the stream sweeps across the water
as it turns; pointed near something useful it settles there exactly. A short chain: the stream reaches the first
vane, but the boat lies round the church's corner, out of its line; the first vane sends it to a second vane by the
corner, which wakes (creaks and swings) when the stream reaches it, and the second sends it onto the boat's stern;
the sail fills, the wind builds back from there and carries the boat out through the gap, and keeps building into
the storm. A stream pointed at nothing runs into the roofs and fades. The vanes stand on low roofs near the boat,
large, copper catching the low sun, each a different animal; the camera keeps the sun beside it rather than ahead,
as the sky mirror's view does; the square is laid out mostly in depth so it fits an upright phone. The invitation
is a drawn stroke across the live vane, the right way; the 90 s safety valve stays. With the toys' pass, their
sails fill wherever the stream passes and light the wind's path.

Jeremy on the third version: "yea, like each vane should have a cause and effect, instead of the player having to
guess that thye need to align all three for anything to happen. You may need to redesign / flesh out the drowned
village level itself to make it feel and look better too." So every vane visibly does something the moment it is
touched, and the village around the square may be reworked so the room feels and looks better.

Second pass, after the vanes prototype is judged on its own (Jeremy: "yea, this sounds good"): the little boats'
toys are already becalmed in the square, sails dead, and the cygnet perks up at them. Each vane's breath fills the
nearest toy's sail, so the toys read the wind for the player; when all the vanes agree every sail fills and the
toys run on ahead out of the square, then the storm scatters them into the rain, lost but never wrecked on screen.
Meeting them again on the open sea becomes relief that they made it. It must be **all** of the toys, not three:
"another session is working to bring in all of the little boats into the opening sea sequence (not just three), so
you'd have to have all of the little boats in the drowned village encounter as well".
