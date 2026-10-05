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

  Jeremy on the third owl pass (2026-10-05): "The distance and composition at which the child stops kind of brings
  the "scary sillouhette" and "glowing eyes" out of the focus of the frame. Figure out how to do this better. The
  player should just see the owl eyes, and when they light the first ember, the scary outline shows up on the rock
  behind. Right now, the outline is illuminated against the rock without any visible light source, and there's never
  the scary moment of two glowing, blinking eyes staring at you from the darkness. I'm not sure why the child walks
  towards the tree trunk after the owl flies away, that is strange. Tidy up the owl flying away animation and
  direction. Right now, it's a bit amateur. It should be a nice animation sequence and feel cute when it flies away,
  as a relief / contrast to the scariness." On which ember throws the outline: "One ember at the stump. That ember
  is the one that reveals that it's an owl. The ember I'm talking about that reveals the scary outline should be the
  one before it. Not at the stump."
  So, in order: walking up in the dark, the player sees only two glowing eyes ahead that blink and stare, with no
  stump, rock or shadow showing. The last path coal before the bend, once lit, throws the huge antlered outline up the
  rock behind the stump, and that lit coal is the visible source. No moonlight throws it. She stops where the eyes
  and the outline are the focus of the frame. The one coal at the stump, off to the side, reveals the owl, which flies
  off in a cute, well-made sequence. She breathes out and walks on round the bend without going to the trunk.

  Refined with Jeremy (2026-10-05: "Your suggestions 1 through 4 make sense", and he gave ownership of the sequence):
  1. One spot, one frame. Her wait at the coal before the bend is her stop. That coal stays on the path, well short of
     the stump, and never reads as a second coal by it (Jeremy: "It looks like there are two embers next to the stump
     too... i thought i asked for that not to happen"). The camera holds one frame on the eyes in the dark, and the
     outline leaps up the rock when that coal catches, without the camera moving.
  2. The reveal also plays on the rock. As the side coal wakes and the light swings round, the giant antlers swing
     aside and shrink to a plain stump's shadow with a little round owl in its fork.
  3. The relief is cute in the same medium. The owl's small flapping shadow flits across the rock as it takes off,
     then the owl flutters up past her. She turns to follow it, and the cygnet peeps after it out of the satchel.
  4. To try, and cut if it clutters: her own small shadow, with the cygnet's head, beside the giant antlers on the rock.
  Risk to tune: the coal that throws the outline also lights the stump's front. Pale stone and dark bark keep the owl
  hidden until the side coal shows it, with only the eyes glowing before then.
  No fourth wall (Jeremy: "im not sure we should be breaking the fourth wall"): she never glances back toward the camera
  or the player for help. In fear she keeps her eyes on the eyes in the dark, or glances down at the cygnet or toward her light.
  The shadow's size is free (Jeremy: "Figure it out.. we have fireflies, we have lightning.. many different light
  sources.."): the outline points away from the path coal so that coal reads as its cause, but it looms far larger than
  physics gives. The wood's other lights may help the frame; lightning stays at most a faint far flicker, because one
  close flash later is the cygnet's fright.
  The target is the concept in `comps/owl/` (keyframes `k1`–`k4` from one fixed side-on camera, `k2-portrait`,
  `flight-strip`, `plan` with the layout in metres, `notes.md`). Departures from it: in `k3` the reduced shadow must
  read as the stump's fork with a little round owl in it, not a figure with raised arms.
  Approved (Jeremy, 2026-10-05: "the fears sequence is approved. The only thing i'd ask to be changed slightly is after
  the owl is revealed, the camera could pan across to show the owl more face on. Otherwise, well done"). So the frame
  holds from the eyes in the dark through the reveal, then eases once across to see the perched owl more face on.
  Jeremy on the pan build (2026-10-05): in the dark "it looks like it has 4 eyes (the light is reflecting off the
  branches on either side. Can you fix this?"; and "the brances are arranged such that they are in line with the
  player instead of across, so it reads a bit awkward when the owl is revealed". So only the owl's two eyes ever glow,
  and the stump's fork spreads across her line of sight, the owl sitting in it facing her between the two limbs.
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

Jeremy on the third version as built (branch `proto-drowned-streams`, rejected): "get another sub agent to tidy up the
wind vane puzzle. the design is terrible. the wind is going through a building, and then it's reflecting back at a
sharp angle to the player. It's just super weird and not at all intuitive. I also don't see any interaction with
stuck little boats like promised. It needs to be thought through a lot more. I also don't understand the reason for
such a departure from the original design of the drowned village with the straight drowned street. The shiny gold
effect also doesn't look cohesive at all. I'm extremely disappointed by the result here. It needs a huge quality
uplift." And: "If you need help, use codex exec to generate concept art for the puzzle as a guide."

**Fourth version** (concept art first, then the build follows it):
- The village stays as it was on main and in its room painting: open glassy water at dusk with scattered
  half-drowned rooftops, bare trees, the spire and the far lighthouse, the boat drifting a fairly straight line
  between them. No square, no rebuilt streets.
- The toys are in it from the start: all seven becalmed among the rooftops, sails slack, and every one of them answers
  the breath when it reaches them.
- The one last breath comes in from the open sea through a gap between far rooftops as a band of ruffled water with
  leaves and faint wind lines. It only flows over open water and past posts: never through a building, never doubling
  back toward the camera.
- The vanes stand on the village's old iron lamp posts, drowned to mid-height with their lanterns unlit, so the breath
  flows past the post itself. Dark wrought iron (a cockerel, a fish), large enough to read, seen against cloud rather
  than the sun; nothing gilded or shiny.
- Two steps, each with its own visible effect: turning the first vane sends the breath through the becalmed toys,
  whose sails fill one by one as it reaches them, and on to the second vane, which wakes; turning the second sends it
  onto the boat from behind and the red sail fills.
- The camera stays low over the water, beside the drift (three-quarter side view), so the breath reads as a path
  drawn across the scene toward the boat.

Second pass, after the vanes prototype is judged on its own (Jeremy: "yea, this sounds good"): the little boats'
toys are already becalmed in the square, sails dead, and the cygnet perks up at them. Each vane's breath fills the
nearest toy's sail, so the toys read the wind for the player; when all the vanes agree every sail fills and the
toys run on ahead out of the square, then the storm scatters them into the rain, lost but never wrecked on screen.
Meeting them again on the open sea becomes relief that they made it. It must be **all** of the toys, not three:
"another session is working to bring in all of the little boats into the opening sea sequence (not just three), so
you'd have to have all of the little boats in the drowned village encounter as well".

**Fifth round: three new directions, prototyped side by side.** Jeremy, on the vanes: "Another agent is wokring on
some weather vanes idea, but i dont think it's panning out very well". Asked for more:

> yea 1 probably works best, but any other ideas that are more engaging, multi step, or chain together different
> ideas that the player has learnt? Feel free to be creative, push the boundaries. what can make the game more
> amazing?

> can you get astra to do concept art for A, B, and C? I'm thinking of getting a prototype for each done by an opus
> 5.5 agent so we can explore these ideas more and see what works and what doesn't. if not, we can come up with new
> ideas. (B) is a bit confusing but seems like it might have some kind of potential. (C) is probably also quite
> interesting in terms of the dreamlike idea of black chimney smoke turning into a storm. i'm curious to see waht you
> come up with

All three keep the village as it is on main and in its room painting, keep all seven toys becalmed among the roofs,
and chain verbs the player already has (the scarf's upward sweep, the plug's and the scarf's circling updraft,
billowing a sheet, filling a sail). Each prototype is judged on its own branch.

- **A. The kite climbs out of the dead air.** The water is glass but the high clouds still drift and the spire's
  swan vane still turns: the wind has only left the water. The child looks up, then at the limp departure kite on the
  deck. A sweep lifts it off the boards and it flops back: the dead air cannot hold it. One drowned chimney still
  breathes a thread of smoke straight up, the only thing rising; the player gusts the kite over it and circles, the
  smoke stands up into a column and the kite rides it up past the spire. In the last gold light it catches the high
  wind, the line snaps taut and the boat moves; the toys bump into line behind it and are towed. Where the channel
  turns at the church the player leans the kite with gusts and the boat follows it round (slow, soft bumps, no
  reactions needed). The high wind is the storm: the kite pulls harder as it comes down, the child hauls it in as the
  rain starts, and the storm scatters the toys. Knowingly shows the departure kite mid-drift.
- **B. The village in the reflection.** When the air dies the glass shows the village as it was: lit windows,
  smoke, washing out, trees moving in a breeze, nobody in it. The wind blows only in the reflection. A gust on the
  water ripples the glass and breaks the reflection there, and the reflected breeze comes up through the break
  (leaves stir, a toy's sail lifts). The reflected washing and the reflected spire vane show which way it blows in
  each place, so the reflection is a map: break it where its wind blows toward the boat and the sail fills. The wind
  let through ripples the glass further on and lets more through, a spreading cascade that grows into the storm and
  erases the warm village from the water as it goes. The cygnet's reflection has its family beside it until the
  ripples reach them. Risk: a second reflection room before the sky mirror, and the hardest to make read.
- **C. Black smoke becomes the storm.** The storm is dark out at sea and the boat is becalmed; the only way on is to
  call it in, so the child goes into the dark by choice. Drowned chimneys are smothered (a sheet draped over one, as
  sheets fall on the island of lines; leaves heaped on another); the player blows them clear and black smoke starts
  to rise. Circling stands each plume into a tower that leans out toward the storm; when the towers join it, a cold
  rush races across the glass, a visible line of darkening water, and fills the sail. Risk: circling twice can read
  as the same act twice; uncovering each chimney differently is what varies it.
- **D. Whistle up the wind.** Jeremy: "yea i like the idea of D as well. I dont know how we would keep the boat
  stationary as the wind starts blowing, but i do like the idea of incorporating back a bit of a musical theme." The
  old sailors' belief that whistling at sea calls up the wind, and a storm if you overdo it. The drowned church's organ
  pipes stand out of the water near the boat like tall reeds; a gust across a pipe's mouth sounds its note, like
  blowing across a bottle. When the air dies the bells in the spire ring a short phrase on their own, the dying
  breeze's last touch, and nothing answers. As each bell sounds, the pipe with the same note shivers in sympathy with
  a ring on the water at its foot, so the phrase can be read with the sound off; the player answers it on the pipes,
  the piano's call and response in a new place. The boat stays put because the notes never blow on it: each answered
  note draws a dark line of ruffled water on the far horizon nearer across the glass, and stirs the nearest toys (tiny
  and light) a little; a wrong pipe only sounds and ripples. On the last note the line arrives, the sail fills, the
  toys run on, and the wind keeps building past what she called for into the storm.

Jeremy, on the toys: "btw, im not yet convinced that the little toys should be here anymore. i feel like we may be
trying to fit in a callback that may or may not be artistically genuine." The prototypes leave them out: on main the
toys' story ends with them reaching the sea, and only the orange toy comes back, washed up at home.

Jeremy, on all the concept art for A to D: "yea, im honestly not convinced by any of the concept art that has been
crated so far. what do you think? I think i'd be happy to let you take creative ownership of this piece of work and
do the best you can."

Why none convinced: the paintings were postcards from viewpoints the game never uses, showing the puzzle as magic
effects rather than what the hand does; and every idea bolted a new mechanism onto the room (a kite in a smoke lift,
organ pipes, smothered chimneys) instead of growing out of what is already there, because "the boat stopped, make it
go" is an obstacle, not something the child wants.

**Direction taken: the lines the village hung its washing on.** When the air dies the glass shows the village as it
was: whole houses down to their doorsteps, lit windows, and washing out on lines strung house to house, moving in a
breeze that does not exist above the water. The cygnet's reflection has its family beside it. Above the water the
same lines are still there, sunk just under the glass, shown only by a peg or the corner of a sheet breaking the
surface where the reflection's lines run. The sail is no use now; the child pulls them on herself. The player lifts
a sunken line out of the water (the scarf's upward sweep; it rises dripping with its old washing still pegged on)
into her hands, and she hauls the boat along it hand over hand to the next house. Then a choice read from the
reflection (two lines leave that house; only one runs on toward the church), then a line wrapped round a chimney
that circling unwinds. At the church the wind comes back as the storm: cat's-paws race across the glass and wipe the
village as it was out of the water, the lines fall back, the sail fills. The memory shows the way, then the storm
takes it, and she is the one who pulls them on: the step before the wood, where she goes into the dark first.

Jeremy on the lines and the village as it was (branch `proto-drowned-own`, rejected): "I dont like the lines because
it turns the drowned village into the sky mirror and it's actually quite confusing. Written down i think it had
potential, but in execution im not sure it does. As a child im going to try to blow wind on the swans under the water
and it's going to confuse me." Prototypes to judge next: the kite (`proto-drowned-kite`) and the black smoke
(`proto-drowned-smoke`).

Jeremy after playing the lines, the black smoke and the kite:

> thoughts on the lines idea,
> - yes it was very unclear that the lines was the thing to touch, the animations were a bit janky and there's not
>   much "wind" interaction that synergises with the child hauling the boat across lines
> - It felt strange to have a line do a 90 degree right handle around a house
> - It felt slightly contrived that the line led to a bell. The player never did something something that led to it,
>   so it just felt like an aribtrary sequence of events if that makese sense.
>
> Thoughts on the other ideas,
> - I did like the idea of the black smoke coming across the water towards the player, that was an interesting dream
>   like feeling, like an unknown darkness was coming and they needed to get onto land quickly to run away from it.
> - the kite idea was very basic in and of itself, although it is something to put in the backpocket for now.

Jeremy, 2026-10-05, asked whether the darkness should come on its own or be called by the player: **on its own.** The
child flees it; the puzzle is getting away from it and the passage after is a run for land ahead of the dark. Asked
whether the way out should be the kite (swept off the deck, circled up into the high wind, towing the boat ahead of
the dark): **something else.** Other ways out are to be proposed before any art.

Two ways out were offered: warm chimneys whose rising smoke draws the boat house to house, and the child leaving the
boat to run over the roofs for land. Jeremy, 2026-10-05:

> lets try over the roofs. I can see it working really well if executed well (i'm not sure if the paper plane should
> lead the way, but maybe that is what works best). But please also think and suggest another idea that is slightly
> less ambitious as well that we can do in paralell in case the over the roofs idea doesn't work out

> remember, the whole point of the work here is to create an interesting puzzle and add more interactivity to the
> game overall. previously, the drowned village had basically no interaction

**Over the roofs** (agreed with Jeremy, 2026-10-05: she runs on her own; "yes, those three" crossings; the warm
chimneys declined as the parallel idea, "something else"):

- The air dies by the church and the dark rises behind them: black smoke lying on the water, coming on and swallowing
  roofs. The boat bumps aground on a ridge just under the glass. Ahead, a line of roofs steps away toward the
  lighthouse crag; the line runs along the way, so it says "this way". She tucks the cygnet into the satchel and climbs
  out.
- She runs the ridges by herself, away from the dark and toward the light, and stops at each gap. The paper plane does
  not lead; she clutches it the whole way, so when the lighthouse takes it, it is the thing she held on to through the
  run. The player's work is the crossings.
- Three crossings, each a different gesture already learnt, each made from something in the room or a piece of home
  in the wrong place:
  1. **The fallen tree (push).** A dead drowned tree leans beside the first gap. Small gusts rock it and show which way
     it can fall, as the bath rocks on the little boats; a firm push topples it across the gap and she runs over the
     trunk.
  2. **The swing (pump).** A longer gap, with the swing from the birches hanging from a drowned bough over it. She
     climbs on, the player pumps it with gusts, and at the top of the arc she lets go and lands on the far roof.
     Forgiving: no timing to hit.
  3. **The raft (fill a sail).** On the last roof the crag is out of reach. A floating door drifts nearby with a sheet
     caught upright on it. Filling the sheet brings the raft to her; filling it again carries her across to the crag's
     steps.
- The dark creeps up while she waits at a gap and stops a little behind her, heaving. It never reaches her and never
  ends anything. Behind her it swallows each crossing as she leaves it. Each gap has the usual drawn invitation and
  its own safety valve (a gust from the dark does the job), so nobody is stranded.
- Camera: low and side-on, the dark on one side of the frame, her in the middle, the light on the other, so one frame
  tells the chase.
- At the lighthouse the dark catches them: the light falters and goes out and the plane is taken. The empty boat,
  blown in on the dark's wind, waits at the foot of the crag, and the storm carries them on to the wood as on main.

On a less ambitious parallel idea (offered: the dark's first breath snatches the scarf sail onto a chimney and the
player wins it back), Jeremy, 2026-10-05: "im not sure waht snatched sail is about, but i leave it to you to take
ownership of what a possible alternative might be. At this point im more interested in getting the over the roof done
well". Over the roofs comes first.

**The parallel, less ambitious idea: the dark snatches the sail** (chosen under the ownership Jeremy gave; it stays in
the boat, so it needs no walking, climbing or roof navigation, and it reuses the scarf cloth, the dark bank and the
rush across the water). The air dies and the dark rises behind them, as over the roofs. Its first cold breath runs
ahead of it across the glass, tears the red scarf sail off the mast and flings it away; it snags round a drowned
chimney and the bare tree beside it. Three acts, each answered on screen: free it (circles round the turns wrapped on
the chimney, sweeps lift the lengths draped on the branches; kept short, since it echoes the birches), bring it home
(it drops onto the glass and floats; gusts carry it back across the water to the boat while the dark comes on behind
it), set it and run (she hauls it aboard, it climbs the mast, the player fills it and keeps it full as they run before
the dark for the lighthouse). The player wins the sail back from the dark; minutes later the lighthouse takes the plane
and nobody can stop it, so that loss lands harder. Judged only if over the roofs does not work out.

Jeremy on the first concept frames (`comps/roofs/`), 2026-10-05: "It looks a bit too "constructed" and "convenient"
e.g. a single line of houses no?" So the route must read as a drowned village she picks her way through, not a row
laid out for her: roofs of different sizes, heights and angles, bits of the village standing out of the water (a
garden wall's top, a porch, a barn, the church's own roof), a route that bends with what is there, and crossing
pieces that belong where they are, among other things the flood left.

**From the roofs to the wood** (Jeremy, 2026-10-05: "What i liked about the existing feel in main was that the storm
started and landed her at the forest. The moment of "relief" was the landing, but it was actually the beginning of
another scary journey. With the lighthouse in between, it sort of breaks that flow.. any ideas?" and, on the answer
below, "what do you think works here? My ideas may not be the best", so this is our call). This supersedes the raft
and the lighthouse stop above:

- She runs to get back to her boat, not to the lighthouse, which stays what it is on main: the far light ahead, then
  the light the storm passes and puts out.
- Why she leaves the boat must read at once: it runs aground on a ridge with a scrape and a lurch; a sweep on the sail
  only makes it strain and creak; she looks back at the dark, then up at the roof, and climbs out.
- Behind her, the swell the dark pushes ahead of it lifts the empty boat off the ridge and it drifts out among the
  roofs, seen in frame while she is at the crossings, so her boat drifting away is what the run is for.
- The third crossing is the boat itself: on the last roof there is open water with her boat out on it; the player
  fills its red sail (`Boat.brushSail`, as on main's becalming) and brings it to her. She jumps in as the dark
  reaches them, and that is the moment the storm begins: the smoke rolls over them and becomes main's storm weather
  without a seam.
- From there main's storm plays untouched (the weather closing in, the lighthouse sliding past, the beam going out,
  the plane taken, rain, the cygnet's shaking, the landing at the forest). Only its trigger changes, from
  `tuning.storm.startsFromShore` to her being back aboard.

**The whole room, from the beginning** (Jeremy, 2026-10-05: "ok we need to think through this in detail from the
beginning. The player emerges from teh haze / cloud chapter into the drowning village, which is calm. what is the
first puzzle? what happens after that to build into the black clouds and have the child climb onto the roofs? How is
the stormy sequence laid out all the way to the woods village? Keep in mind the existing distances. think through this
step by step". Agreed as below: "Yes, go"; the calm drift gets "a small one" of its own). This supersedes the run back
to a drifting boat and the run to the lighthouse above.

Distances on main: the passage from where the stairs set the boat down (`DESCENT_END`, 16, −1254) to the forest beach
(`WOOD_LANDING`, −26, −1692) is about 530 m. The air dies (`STILL_AT`) about 155 m in, about 30 s after arrival, at
about (−9, −1398), some 40 m short of the church (`SPIRE`, 14, −1436). Main's storm begins 210 m from the beach
(`tuning.storm.startsFromShore`), about 50 m past the church; the light goes out 23 s later, beside the lighthouse
(65, −1580); then the plane is taken and they land. Houses stand 11–30 m off the channel, 15–40 m apart, sunk 1.7–5.4 m.

1. **The calm drift** (about 150 m, about 30 s): dusk among the roofs as on main, with one small puzzle of its own (to
   be chosen), and small answers to the wind (herons lift, the spire's vane swings).
2. **The sea draws back** where the air dies on main. The breeze dies, the glass goes still, then the water slips away:
   the village rises a metre or two out of it (door tops, upstairs windows, garden walls, a wet dark band on every
   wall). A ridge comes up under the boat and it settles on the slates, listing, high and dry. Far behind, where they
   came from, the horizon goes black: the sea coming back under black smoke lying on the water.
3. **She climbs out** because nothing moves a boat sitting on slates (a sweep on the sail only flaps it). She looks
   back at the black and runs for the highest thing there is, the church tower, some 40–60 m off.
4. **Crossing 1, the tree (push):** a lane of deep water to the next house; a dead tree rotted at the roots in a garden
   there; pushed over, it is her bridge.
5. **Crossing 2, the swing (pump):** the drowned village green between that house and the church; the swing hangs from
   the old tree on the green; pumped, she lets go onto the nave roof.
6. **The church:** she climbs the nave roof to the tower and into the belfry opening. While she waits at a crossing
   the dark creeps up and stops a little behind her; it never reaches her and nothing fails.
7. **The dark arrives:** the black water pours back round the tower and the storm comes with it (the smoke rolls over,
   the first rain). The water lifts the stranded boat off its ridge and carries it in among the roofs below.
8. **Bring the boat (fill the sail):** the rising water leaves the tower nowhere safe and her boat is afloat again, the
   only way out. The player fills its red sail (`Boat.brushSail`) to bring it to the foot of the tower and she climbs
   down into it. She left because the boat was stranded; she goes back because the water brought it back.
9. **The storm, untouched:** the church is about 260 m from the beach, close to where main's storm already starts, so
   main's timeline plays from the moment she is aboard (the weather closing in, the lighthouse sliding past and going
   out about 130 m on, the plane taken, rain, the landing at the forest). Only its trigger changes, from
   `startsFromShore` to her being back aboard. The storm still never lets go until the beach.

The village round the church is re-laid so the route reads as a real village she picks her way through (Jeremy's note
on the first frames above). The sea itself does not move: the village rises to show the water falling and sinks to
show it returning.
