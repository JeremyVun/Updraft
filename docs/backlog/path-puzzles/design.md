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
- **The island of lines: pinwheels drive a pulley** (pinwheels turning a pulley line that carries washing out of
  the way), with the caveat that the island has little room left for it. To be explored and prototyped.

The little boats' plug and bathtub are being prototyped on branch `proto-boats-plug`.

## Rejected

- A logjam of debris in the drowned village's streets: a replay of the sleeping island's snow notch.
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
