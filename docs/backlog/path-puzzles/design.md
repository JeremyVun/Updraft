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
step by step". Agreed: "Yes, go"; the calm drift gets "a small one" of its own, the stranded cat. Refined since under
the ownership below: no draining, she leaves the boat to go after the cat). This supersedes the run back to a drifting
boat and the run to the lighthouse above.

Distances on main: the passage from where the stairs set the boat down (`DESCENT_END`, 16, −1254) to the forest beach
(`WOOD_LANDING`, −26, −1692) is about 530 m. The air dies (`STILL_AT`) about 155 m in, about 30 s after arrival, at
about (−9, −1398), some 40 m short of the church (`SPIRE`, 14, −1436). Main's storm begins 210 m from the beach
(`tuning.storm.startsFromShore`), about 50 m past the church; the light goes out 23 s later, beside the lighthouse
(65, −1580); then the plane is taken and they land. Houses stand 11–30 m off the channel, 15–40 m apart, sunk 1.7–5.4 m.

1. **The calm drift and the stranded cat** (about 150 m): dusk among the roofs as on main, with small answers to the
   wind (herons lift, the spire's vane swings). A cat crouches on a chimney pot along the drift, mewing (animals may be
   as loud as they like). A wooden wash-tub floats nearby; the player's gusts carry it to the cat's roof, the cat hops
   in, and the gusts bring the tub to the boat, where the cat jumps aboard and settles at the bow. The cygnet is wary of
   it and ducks into the satchel.
2. **The air dies** where it does on main. The glass goes still and the becalmed boat drifts gently in until its stem
   rests against the slates of a small cottage's roof at the waterline: a nudge, never landing on top of anything.
3. **The dark rises behind them**: a sea fog lying low on the water, rising on the horizon the way they came and
   coming on, its crest gold in the last sun, roofs fading into it one by one. The cat panics, leaps onto the roof and bolts over the roofs toward the church, the
   highest thing there is. A child does not leave a frightened cat: she climbs out after it. The boat was never stuck;
   she left it to save the cat. She follows the cat's run, so the plane never leads; she clutches it the whole way.
4. **Crossing 1, the tree (push):** a lane of deep water to a walled garden; the cat crosses its own way (a leap she
   could never make); a dead tree rotted at the roots in the garden, rocked by gusts to show which way it can fall,
   pushed over, is her bridge.
5. **Crossing 2, the swing (pump):** the drowned village green between the garden cottage and the church; the cat goes
   along a railing top; the rope swing hangs from the old tree on the green; pumped, she lets go at the top of the arc
   onto the nave roof.
6. **The church:** the cat climbs the tower's ivy into the belfry, safe and out of her reach, and looks down. She is
   left on the nave ridge at the tower's foot. While she waits at a crossing the dark creeps up and stops a little
   behind her, heaving; as she crosses it swallows the place she left. It never reaches her and nothing fails.
7. **The dark arrives:** the fog rolls over the church, the sun gone, and darkens into the storm's night; the wind
   comes and the first rain falls. Now she needs her boat, still resting against the cottage roof back along the way.
8. **Bring the boat (fill the sail):** the player fills its red sail (`Boat.brushSail`) and brings it across the water
   to the nave; she steps down into it. She looks back once at the cat in the belfry as they go.
9. **The storm:** the boat leaves the nave about 145 m from the beach, so main's storm plays from the moment she is
   aboard, re-timed to that shorter way: the weather already half gathered, the lighthouse about 55 m off as she boards
   and its beam going out in the first seconds while it is still in view (a glow through the fog, then gone), the
   cygnet's shaking, the plane taken about mid-way, rain, the landing at the forest about 45 s after she boards. The
   night takes over from the fog's dark without ever lifting. The storm never lets go until the beach, the fog thins
   off as the forest comes up out of it, and the landing is relief that turns into the wood's fear.

The village round the church is re-laid so the route reads as a real village she picks her way through (Jeremy's note
on the first frames above). The water level never changes. The village's look may be raised as far as it needs
(Jeremy, 2026-10-07: "If you see opportunities to upgrade the visuals of the drowned village as well e.g. more houses,
better looking houses, more feeling of a whole village etc., feel free to take them."), settled in concept art before
it is built and keeping open water between the houses.

**Ownership of the drowned village** (Jeremy, 2026-10-05, verbatim):

> Ok great, I want you to take the lead in terms of owning the artistic vision and execution as i know you won't stop
> of anything short of excellence. My only requirements are that it feels great, plays great, and looks great, with
> good pacing and narrative that adds to the game's narrative. To this end, alot of refactoring of the existing
> drowned village and storm sequence may need to happen. The astra concepts may or may not make sense, do don't
> necessarily take them as gospel as something to match pixel for pixel. Take what works and ignore waht doesn't. Any
> questions, ask at any time.

So the existing drowned village and storm code may be refactored as far as the room needs; the concept frames in
`comps/drowned/` are a guide to take from, not a target to match (they still show the drained village, which is cut).

### How it is made (Claude's calls under that ownership, 2026-10-05)

- **Pacing.** Arrival and calm drift about 30 s; the cat about 30–60 s; a short drift with the cat aboard (the cygnet
  ducking into the satchel, the cat washing a paw at the bow) about 15 s; the air dying and the dark rising about 20 s,
  slow and eerie; the run about 2 min with both crossings; the dark arriving and the boat brought in about 45 s; the
  storm about 45 s to the beach. The room grows from about 3 minutes to 5–6, nearly all of it the player's.
- **The cat.** A small soft tabby with a white chest and socks, round-faced, a little bedraggled, built as soft
  rounded shapes like the game's other animals, to the model sheet in `comps/cat/`. It mews from the chimney, hates the
  water, rides the tub hunched with its ears flat, and on the boat sits at the bow as far from the water as it can. It
  is quick and sure where she is slow, and it is the player's guide: at each gap it goes first, so the player sees
  what the crossing is before they make it (Jeremy, 2026-10-08: "i thought the cat was supposed act as the players
  guide, so it makes a crossing e.g. across the windmill before the player so that they know what they need to do.
  Very cat like behaviour"). At the windmill it hops onto the sail end lying level with her roof edge and sits there
  looking up; when the player circles it rides up and drops off onto the high roof, and the next sail comes level
  beside her. At the swing it leaps onto the seat, its weight sets it swaying, and at the top of a swing it springs
  onto the nave; the empty swing drifting back says "you next". At the tree the gap is too wide for it to show the
  crossing itself (Jeremy: "i dont know how it does the tree crossing though, there's a big gap"), so it runs the
  railing tops over the lane, scrambles up the dead trunk in the garden, and the rotten tree creaks and leans toward
  her under its weight and settles back: the tree is loose and falls her way. It sits in the crown looking back at her
  and leaps clear onto the garden wall as the tree goes. Each showing is brief and never makes the player wait
  (Jeremy: "Only thing to be wary of is that we dont have the player waiting too long for the cat to cross and climb
  up the tree, pacing is important."): the cat is already crossing as she arrives, and the player's wind is live
  throughout. At the church
  it climbs the tower's ivy to the belfry. It is left there, safe and high, looking down as the boat goes.
- **The dark is a sea fog** (Jeremy, 2026-10-05, doubting the black smoke: "im not sure if the dark cloud look make
  sense given the lighting and time of day... what do you think? would a white fog / mist / haze make more sense?"; on
  Astra's fog study: "yea that fog looks way better"). A haar rolls in low off the sea from behind (south, the way they
  came; `src/world/drowned-dark.ts`, "the dark" in code). It obeys the dusk: its crest takes the low sun's gold and rose,
  its body is cool blue-grey, and roofs at its edge fade into it and are gone rather than being covered. As it nears it
  takes the sun: the warmth drains from the boat, the roofs and the water, and the lantern is the warmest thing left.
  At the church it closes round her and darkens into the storm's night, the first wind breaking up the glass. The
  threat is what it takes away, so it never sits still: one roof, then the next, then the sun, with the cat's panic
  selling it. Beautiful-ominous, never horror. Black smoke is cut: under a dusk sky a mass that takes none of the light
  reads as land or rock, and smoke implies a fire that is not there. The target is Astra's study in `comps/fog/`
  (`fog-far`, `fog-near`, `fog-arrives`, `fog-portrait`, painted over `today.jpg`). It is built as one fog field every
  shader reads (a moving front, a height profile and slow low-frequency variation, surfaces mixing toward the fog's
  colour by transmittance), so things truly fade into it; three to five large feathered sheets give the crest and
  wisps but never do the hiding themselves; the fog's colour, the sun, the sky light and the water's reflection are
  driven from one progression, and the lantern's light stays its own. It stays low, flat and cold-bodied, with a clear
  stretch of open dusk air before it rises, so it never echoes the stairs room's luminous cloud.
- **The tree and the swing, from the spike** (`proto-drowned-crossings`, playable on the QA stage with
  `?chapter=stage&gap=tree|swing|run`; `src/world/crossings/`). Kept: the push arriving a beat late, the rock and
  spring back, the fall that hangs on its roots and then goes, her walk along the trunk with her arms out, the swing
  pumped the birches' way with no timing, the release at the top of a forward swing with her arms up, the landing on
  one hand and the look back. Changed in the village: the tree takes two or three firm pushes the right way, its
  roots visibly loosening between them, never one stroke; the root plate is a flat muddy disc of earth with trailing
  roots that heaves only a little (the garden bed about a metre down), never a spiky ball; the empty swing dies away
  over about 10 s while she looks back; the swing hangs beside the garden cottage's gable end so its back-swing passes
  the end of the house, and the old tree's trunk never stands behind her arc from the lens; the tree's root lies on
  the line of its fall and the trunk crosses a wall square on; the lens is already on her side before the tree falls,
  so it never swings round to meet her on the trunk. The tree's creak, root tear and thud and the swing's creak are
  new foley.
- **The run is the spine of the room** (Jeremy, 2026-10-05: "overall, it feels to me like these two challenges by
  themselves cover very little ground. There's a lot of ground between the drowning village and the woods island... i
  hope you have a plan here."; on the plan below: "proceed with your plan with the tree, and swing"). As first planned
  she walked about 45 m of the roughly 445 m from the stairs to the forest beach, and the last 255 m was watched from
  the boat. Instead her way on foot grows to about 165 m: the church moves on about 120 m to stand near the
  lighthouse (as the room painting has them, together), and the old church site becomes ordinary roofs. In order: she
  climbs out at the cottage; the tree (Phase 1's lane and walled garden); her own way over ridges, wall copings and a
  lean-to, small hops she makes herself, the cat a roof ahead and the fog behind, never a puzzle and never a single
  line of houses; a middle piece (below); her own way again; the swing on the green onto the nave; the church. The storm from the church to the beach is about 140 m, past the lighthouse soon after she boards. The
  village keeps its open water and scattered roofs; the way adds only hand-placed roofs, walls and copings where it
  needs them. Plan: `comps/run/` (from `route-plan.png`, north up).
- **The boat goes ahead of the fog.** With the church that far on, a boat left at the cottage would be out of reach
  and out of frame. So the cold breath that comes with the fog swings the untended boat off the slates and drifts it
  away along the open water, the same way she runs; she sees it go and still follows the cat. It fetches up against a
  dead tree in the fog near the church, its lantern glowing, and the player fills its sail to bring it the last stretch
  to the nave. Everything on the water is driven the same way, so the boat's drift is also a sign of the fog's breath.
- **The middle piece is a drowned windmill** (Jeremy, 2026-10-05, on Astra's route frames in `comps/run/`: "this makes
  sense. i think it's be nice to have a third player interaction way though in addition to the tree and the swing").
  The door ride down a flooded lane (`lane.jpg`) is cut: it repeats gusting a floating thing (the tub, the boat), forty
  metres of sitting breaks the run, and a lane too narrow for the boat packs the village. The third interaction uses
  the game's other verb, circling: an old tower mill stands in the water up to its shoulders between two roofs, its
  sails turning slowly in the fog's breath; the player turns it by circling round its hub (the drawn invitation shows
  the circle); she waits on a roof edge until a sail comes round level beside her, walks onto it, and as the player
  keeps turning it lifts her up against the sky until she walks off onto a high roof, where
  the church and the lighthouse come back into view across the water. The kitten has gone ahead its own way and waits
  there. She chooses when to step on and off; nothing needs timing. With the tree (a walk across) and the swing (a
  leap), it makes the flood a child's playground as she runs from it. It must not crowd the horizon's spire and
  lighthouse. Approved on Astra's concept (Jeremy, 2026-10-05: "I am happy with the windmill as teh third piece"),
  `comps/mill/` (`mill-wait`, `mill-ride`, `mill-top`, `mill-plan`, `notes.md`): a small, worn tower mill with only two
  opposite sails left, bare lattice and torn linen, no taller than a cottage, so it never makes a third landmark;
  about a 2 m tower, the hub about 2.9 m up, a 2.4 m sail radius. Any
  broad circle round the hub turns it (tangential movement is torque; the drawn invitation is a flat spiral in the
  sails' plane, about a turn and a quarter, its tip showing the way); the sail eases and dwells as it reaches her and
  again at the roof; circling the wrong way only rocks it, never carrying her back toward the water; when the player
  stops it coasts and settles while she holds on; its speed is capped. She does not climb (Jeremy, 2026-10-05: "we
  dont need her climbing the lattice, why not keep it as simple as her just walking onto the wind mill sail?"): the
  sail comes round to lie about level with the roof edge she waits on, she walks out onto its lattice's lower rail
  with a hand on its stock like a handrail, and stands there, one held pose with small shifts of balance, while the
  turn lifts her through a short arc, well under half a turn and never steeper than she could stand on, until it eases
  beside the high roof and she walks off its end. The boarding and stepping-off heights follow from that arc in the
  blockout; the mill keeps the concept's size, and the cygnet stays tucked clear. The mill leaves the frame as the
  church and the lighthouse come back into view.
- **A whole village the sea has taken** (Jeremy, 2026-10-07, quoted above; then: "it doesn't need to be super
  realistic detailed btw. remember, this is a dream and it should feel surreal like one."). Today it reads as a dozen
  identical sheds on empty sea. It becomes a place with a shape: cottages in short rows whose turns imply drowned
  lanes, broad water between clusters, groups on every side to the horizon (gold silhouettes into the sun), and the
  green left as a clearing of water. It is a village remembered in a dream, not surveyed: shape, colour and light over
each house's character carried by its shape and by stylised detail (Jeremy, 2026-10-07: "when i said dont be
  detailed, i meant dont be too realistic. detail is nice, just not realistic detail if that makes sense. i.e. add a
  little bit of artistic flair that suits it being a dream / game"): chunky slates and scalloped tiles drawn as bold
  shapes, thatch as sculpted layers, wonky frames and shutters, leaning pots, never photographic materials, grime or
  noise; nothing recognisably of one country or era, and no lettering ("nowhere real"). A few quiet surreal touches carry the dream, in the game's dream logic
  where things recur in the wrong place and nobody remarks on it: pieces of home out of place (the red door, washing on
  a line), gentle impossible leans and shifts of scale. Windows stay dark so the
  lantern is the warm light. The near water stays open and quiet; density goes to the middle distance and the horizon;
  nothing crowds the views of the church and the lighthouse or of the fog coming, and nothing on the way becomes an
  obstacle. Concept: `comps/village/`. The first round (`village-*.png`, `house-kit.png`, painted over today's frames
  `today-*.png`) had character but was too literal; the second (`dream-*.png`) was dreamlike but plain, every house the
  same polite gable (Jeremy, 2026-10-07: "nah iit doesnt have enough character"). The target is between them: a
  storybook dream village where every house has a personality readable in its silhouette (a roof like a pointed hat, a
  swaybacked ridge, thatch pulled low like a cap, a crooked or tall thin chimney, a round attic window, a little
  turret), with the first round's richness in stylised form, most houses modest so the special ones sing; the second round's three touches kept, each built
  once (the tall-beside-tiny pair, one red door just under the water, one washing line between two chimneys); windows
  dark and never paired like faces. Round three (`story-*.png`) had the character but not the game's look (Jeremy,
  2026-10-07: "i think the style and colour palette really doesn't fit he game"; "dont rebuild the village yet until
  we can settle on a style"): its pastel violet, blue and rose roofs and candy-scalloped tiles belong to another game.
  The style master is the room's own approved painting (`src/paintings/drowned-land.webp`): charcoal-slate and
  dark thatch roofs, warm lime-washed gables catching the low sun, brick chimneys, soft continuous painterly shading,
  the light doing the work. Character goes into the shapes within that palette. Round four (`painted-*.png`,
  `painted-kit.png`, `painted-notes.md`) is approved (Jeremy, 2026-10-07: "ok this looks good, we can refine as we
  go"): eight houses (swayback, tall hat, low cap, little pocket, the cat's shoulder, tucked together, round keeper,
  open shutter) in charcoal slate, dark brown-grey and deep weathered thatch, cream limewash and brick-red pots, gold
  only in the light, no modelled tiles; the three touches once each. It is built in the construction of home's
  cottage (`src/world/cottage.ts`), the game's own house: clean modelled masses with crisp edges, soft colour lit by
  the scene, a few crafted parts (window frames, a door, sills, bargeboards, a dormer, a shutter, pots), as the game's
  best built things are (the stairs, the boat); and many more of them, as the washing field repeats to the horizon.
- **The run is built on decks** (`src/world/decks.ts`): ridges, wall tops and the fallen trunk are strips the child
  walks; the slates up to a ridge are ramps. She gets out with `alight` onto the cottage's slates and back in with
  `board` at the nave.
- **Camera.** Low and beside the run, at roof height at most, the dark on one side of the frame and the church on the
  other, easing between crossings and never cutting; on an upright phone it looks along her way so it stacks up the
  frame. While she waits at a gap, the gap, the thing to push and her are all in frame. With the cat aboard the lens
  comes round to the side so the cat at the bow is not hidden behind her and the sail.
- **The storm from aboard.** The dark has already arrived, so the storm starts with the weather mostly gathered rather
  than gathering from clear; its beats keep their order and their spacing along the way.
- **Saves.** A save during the run resumes with the boat at rest against the cottage, the cat aboard and the dark
  risen; a save after she is aboard resumes aboard with the storm to come.
- **The cat comes home** (Jeremy, 2026-10-05: yes). At the very end, as she walks down to the cottage with the red door,
  the same tabby sits in its lit window, waiting: home's cat all along. No remark and no beat of its own; it is built
  once the drowned village is judged.

**Why the sea does not draw back** (Jeremy, 2026-10-05, on Phase 1's stills: "why is hte boat on the roof?" and "you're
planning to drain the drowning village? why? Im going to let you figure out what works best, but it does seem a bit on
the nose to exactly align ontop of the roof like that."; then, on the tsunami logic, "just before a bad thing happens
at sea like a tsunami, the water will recede ... you are the artistic director so as long as you've thought carefully
about what works best, feel free to purusue your vision"). An earlier version stranded the boat by draining the
village. Cut: it was machinery invented to strand the boat; the dark is already the omen, and two omens split one
event; leaving the boat for the cat is the child's own act of kindness, where a stranding is only a mechanism; making
the draining read needs a great deal (water pouring off eaves, a visible current, the village sinking again to free
the boat) for what the dark already says; and a literal tsunami weighs heavier than a child's dream should.

**The cat's first build missed** (Jeremy, 2026-10-05: "i think the face makes it look mentally not all there. it looks
bug eyed and when it sits, it's head is pointed way back on a long neck like a swan. Come on, cute cats are the most
common shape on the internet"). It is rebuilt against the model sheet (`comps/cat/`): a big round head; eyes large
with big dark pupils and a catchlight, set at or below the middle of the head and fairly close, soft upper lids; a
short muzzle with nose and mouth tucked under the eyes; round cheeks; ears wide; no neck in the sit, the head sunk into
the shoulders; a compact pear sit with front paws together and the tail wrapped round; frightened means low (body
down, ears flat, tail tucked). Jeremy: "opus 5.5 subagent should be able to remodel the cat appropriately".

**The rebuild, judged** (2026-10-05, `proto-drowned-cat` at `766c738`). At play distance, about 4 m, it reads as a
kitten: big round head, no neck, large dark eyes with a glint, white muzzle and bib, a compact sit, a low frightened
loaf. Close up it falls short of the sheet: in profile the head is a flat-sided helmet with the eye on its front edge;
too much forehead above eyes set low, like a mushroom cap; a dark outline round each eye makes them googly where the
sheet's are soft under the upper lid; the mew barely opens the mouth; under warm light the coat goes saturated ginger
with heavy stripes rather than the sheet's soft grey-brown. Jeremy: "yep, the cat definitely needs a polish pass. Along
with your observations, the body looks weird from bove" (from above and behind it is a narrow column ringed by its
stripes, like a grub, where the sheet's back is a soft broad pear whose stripes fade down the flanks).

**The cat's voice** (Jeremy, 2026-10-05, on the first synthesised mew: "the cat mew sounds like a human mimicking a cat,
it sounds hilariously uncanny and bad"; on recordings: "Im wary of using real recordings because they add to the
bundle size don't they? And we don't have much room to modify them to suit whatever we need.."). It stays synthesised,
as every sound in the game is (`docs/contracts/audio.md`), but grounded in real cats: a few public-domain kitten
recordings are analysed offline (the pitch contour, the formant movement, the nasal onset, the flutter and the breath)
and only the resulting numbers ship, so the mew, the plea and the chirrup can still be shaped freely. Jeremy judges
each round by ear.

The analysed voice (`proto-drowned-cat-voice`, its study made with `tools/cat-voice.mjs`) is approved: "i think the cat
sounds are much more on points, im guessing we probably wont' need all of them when you get to adding the cat into the
story". The story uses only what each moment needs: the plea while it is stranded, at a kitten's length (0.3–0.45 s,
which means shortening the mouth's hold for pleas in `cat.ts`); the chirrup as it lands aboard; the frightened yowl
once, as the fog rises and it bolts; and at most a mew from the belfry as the boat goes.

## The crossings

Jeremy, 2026-10-05, choosing what to work on after the room-by-room ideas: "lets work on the corssings first".

On the crossings today the boat sails itself between rooms. The player's gusts can fill the sail and push the hull from
the ordinary 4.5 units/s up to 10, but nothing on the water asks for that or answers it. The crossings are short
(`docs/contracts/world.md`, Crossings): 95 s to the island of lines (the farewell and the whale), 30 s to the little
boats, 40 s to the meadow, 20 s to the birches, a short hop to the stairs, 40 s to the sleeping island at night, up to
100 s for the sea (the pod, the swim) and 40 s home.

Jeremy's rulings (2026-10-05), answering two questions:
- Must the boat wait for the beat? **Mix**: one must-do beat on one longer crossing, with the usual invitation and
  safety valve; anything else on a crossing is optional and the boat sails past it whether or not the player plays.
- Which crossings? **Just one or two**, done really well, rather than something on every crossing.

**The must-do beat: a whale asleep across the way** (proposed; Jeremy left where it goes to Claude: "figure it out and
make a suggestion"). The whale is already the crossings' creature (`fx/sealife/whale.ts`; it surfaces on the first
crossing at 37 s and on the sea at 27 s). Partway across, a huge whale lies asleep at the surface across the boat's
way, like a long low island, breathing slowly; the boat drifts to a stop beside it. The child leans out; the cygnet
ducks into the satchel and peeks. Gusts across its back only tickle it (the skin shivers, a flipper slaps lazily, a
splash reaches the boat). Circles over the blowhole wake it: the column draws a breath, it spouts a tall plume, rolls,
lifts its flukes and sinks, and its swell lifts the boat as it passes under. Usual invitation and safety valve.
Placed on the crossing to the meadow (Claude's call): afternoon light reads it, the little boats have just taught
circling, and the meadow it arrives at is asleep too, so the player wakes the whale with wind and then the meadow with
music. The night crossing to the sleeping island was the alternative: darker to read, and it lengthens the long dark
stretch after the wood.

**No optional encounters.** Three were offered and first accepted: a meadow lying on the sea whose flowers open where
the wind goes, leaves on the water that are a shoal of golden fish, and a giant dandelion clock whose seeds a gust
blows up into the first stars. The dandelion was dropped on its concept art ("it clashes with the sky mirror puzzle").
The meadow was built on the last crossing and cut (Jeremy, 2026-10-05: "I dont think the meadows earns it's keep.
swiping on the grass actually makes the boat just go faster. There's no noticeably new interaction."), and the fish
dropped with it ("cut the meadow, delete its branch and drop the fish"). The lesson, for any idea on a crossing: while
the boat sails, a sweep is the same act as filling the sail, and the boat surging is the loudest answer on screen, so
anything played from a moving boat reads as decoration on sailing. A crossing beat has to stop the boat and want
something, as the whale does.

**The whale is shown first and met later** (Jeremy, 2026-10-05: "The sleeping whale feels to me to be the one to put
here since there is already a whale from the still island to the island of lines no? Or do you think it's better to
just show the whale to the player during the first crossing, and then they can interact with it later on?"; on the
answer below, "agreed"). The first crossing keeps its whale surfacing far off, unchanged, as the set-up; the sleeping
whale lies on the crossing to the meadow. Waking it needs circling, which the player first learns on the little boats'
plug, two rooms after the first crossing; there it could only wake to gusts, a weaker puzzle that would also spend the
circling before the plug teaches it. Seen far off, then found asleep across the way one island later, it is met again
rather than met.

**The whale moves to the open sea, dream-sized** (Jeremy, 2026-10-07, while its look was being tuned on `toMeadow`):
"in a dream, from the perspective of a child, the whale would be really big. like really dream like big"; and "why
not have this on the open sea chapter instead. We can extend the open sea chapter if needed e.g. move or hide the sky
mirror island appropriately or something. Right now, the open sea chapter has nothing to do in it even though it's a
whole selectable chapter." Agreed ("yea, i think this works"): it lies on `toMirror` after the pod has dived away
ahead, about three times its built size (70–80 m), too big for the frame; seen far off at first as a long low island
in the dawn haze that turns out to breathe, replacing the sea's distant surfacing whale; its leaving swell passes and
the sea goes still into the mirror's glass. The open sea's ruling "at most 100 s, nothing asked" is lifted for it;
the route may lengthen and the mirror's island stay hidden longer. The meadow crossing goes back to what it is on main.
The narrative it must serve (Jeremy, 2026-10-07):

> - the child is brave for the cygnet
> - the cygnet is brave for the child
> - then they both fix something for someone else together
> - and then it escalates and they fix the stars

So the whale is the third step: the dark wood is her courage for the bird, the sleeping island the bird's for her,
the sky mirror the stars. Offered: a lost calf the cygnet leads to its sleeping mother, or a whale caught in a net.
Jeremy (2026-10-07): "I dont think (1) works - if the cygnet could swim to the mother, then surely the calf could have
done so as well. I think that the whale caught in a net is the classic example that works." So: **the whale caught in
a net.**

**The whale in the net, agreed** (Jeremy, 2026-10-07: "sounds great, proceed"; concept frames `comps/crossings/whale-net/`, painted from the open
sea's own camera over `ref-sea-*.png`). Measured on main: the open sea runs about 78 s; the swim ends about 51 s in;
the pod leaves at 60 s; the mirror's jetty is already in frame by 58 s; the sun rises low ahead.
- After the swim, a dolphin nudges the planking (main's nudge, now asking) and the pod leads the boat off its line
  toward what looks like a long low island in the sunrise haze. It breathes: a whale, dream-sized (about 75 m), lying
  still and worn out, an old drifting net with cork floats over its head and blowhole and trailing down its back, one
  loop round its near flipper. Sad but gentle: tired, never hurt. The boat eases to rest beside its head.
- Three steps, each answered on screen, each a different part:
  1. **The breath (the player, circles).** The net lies over the blowhole; each breath only domes the mesh and
     sputters. Circles over the blowhole raise an updraft that lifts the mesh clear, like a sheet in the wind; the
     whale draws its first full breath and its great eye opens and looks at the child.
  2. **The child (a gust brings her the line).** A line of cork floats trails across the water by the boat. A sweep
     pushes the nearest float to her; she catches the line and hauls, and the net peels back off the jaw and head.
  3. **The cygnet (its own courage, for someone else).** The last loop is round the near flipper, out of her reach.
     The cygnet, who swam earlier in this chapter, goes in and swims to it and takes the loop's end in its bill; a sweep
     along the flipper makes it lift lazily (the tickle already built), and the loop slides off into the cygnet's pull.
- Free: it spouts a tall golden plume against the sunrise, the empty net drifting away; the pod leaps round it; the
  cygnet is lifted back in; the child waves; it dives, lifts its flukes high as if waving and sinks, and its swell lifts
  the boat. Then the pod goes with it and the sea goes still into the mirror's glass.
- Each step has the usual drawn invitation and a safety valve after about 90 s with a cause on screen: a dolphin lifts
  the mesh with its nose, noses the float to the boat, nudges the flipper. The gull of the first build is not needed.
- The pod leads the boat off its line so the mirror is out of frame until the whale has gone; the stop and the camera hold,
  the saves and the real-gesture check carry over from branch `crossing-whale`, re-placed and re-scaled. The encounter below (a whale in their way, woken for their own passage, the cygnet only
peeking) predates this and is being redesigned to fit it.

### As decided: the whale in the net (the open sea, `toMirror`)

**Ownership** (Jeremy, 2026-10-07, on the frames): "looks good, i would probably see if the whale can be made a bit
bigger though like in a dream, but i leave thr interpretation, detail, interactions, and implementation to your
judgement. I trust you'll make a great looking sequence puzzle that plats well and fits the dream vibes". So Claude
owns the sequence's interpretation, detail, interactions and build; the frames are a guide. Claude's call on size:
bigger than the frames, about 110 m nose to flukes, scaled in proportion (eye about 3.5 m across, crown about 5 m,
the net to match), so from beside its head it is a landscape that breathes; the circles over the blowhole must
still be an easy target on screen, so the hold frames the blowhole within easy reach in both orientations.

**The feeling and the bar** (Jeremy, 2026-10-08, asked what would help Claude do better, verbatim):
> 1. the journey through the clouds, the owl sequence in the woods. Those are the main standards of quality.
> 2. I am imagining a studio ghibli sequence for the whale. We don't need the same art style, but it should have a
> sort of similar dream feel. That's why i was pushing for a "giant" whale, not a "realistic" sized whale. It's more
> about the feeling of an ancient whale caught in a "net" (a representation of the problems of the past, ignorances
> etc.) that you have to save. I think that's the narrative development at this point of the journey. You put things
> right with the "past" (the ancient whale), and then you put things right with the "future", the stars in the sky in
> the sky mirror. Hopefully that makes sense
> 3. this is fine with me, im happy to let you drive the creative work here until you're happy with the result

So: the standard is the clouds journey and the owl in the dark wood; the feel is a Ghibli dream, not realism; the
whale is the past, ancient and burdened by the net of old ignorance, and freeing it puts the past right before the
sky mirror puts the future right. Claude drives the creative work and brings it to Jeremy when Claude is happy with
it, judged by playing it in motion. Astra is no longer used (Jeremy, 2026-10-08: "don't use astra anymore").

**Claude's direction for the encounter** (2026-10-08, from Jeremy's brief above). The Ghibli touchstone is the river
spirit in *Spirited Away*: an ancient being weighed down by what people left behind, freed by a child, leaving
renewed and glad. Here the net is the past's old carelessness lying on something kind; the child and the bird take it
off. Five movements, each with its own feeling, each handing on to the next on screen:
1. **Awe.** A long low island in the gold haze breathes: a slow sigh of mist and the sea lifting round it. She knows
   it before the player does. The camera comes down as the boat slows, so it grows above the horizon.
2. **Sorrow.** At rest beside its head: an old faded net grown with weed lies over it, its breath sputtering through
   the mesh, the eye heavy and tired. The camera holds still and the score thins.
3. **Courage.** The breath (the player's circles; the eye opens and finds her; its low call, the friend's greeting);
   the haul (her pulls; the net slides off the bared head, water streaming; its eye on her); the bird's swim and the
   flipper it lifts for the wind's touch.
4. **Release.** The river-spirit moment: it breathes free; the plume's mist drifts down over the boat in the gold
   light; its call turns glad; the sea round it brightens; the net, let go, sinks slowly away into the deep and is
   gone; the dolphins leap; she waves and the bird calls.
5. **Farewell.** It dives as a whale does, the flukes rising once with the pale pattern from the first crossing, and
   its swell lifts the boat; then the sea stills toward the mirror's glass, the future next.
What makes it a giant and a dream rather than a model: a form from a real whale at dream size; everything about it
slow and heavy (a breath every ten seconds or so; nothing quick but the eye, and that slow); detail small against its
bulk; the far length lost in haze; the sea answering its breath; a low camera, held frames, one camera intention per
beat (as the owl's bend has); the child and the bird acting at every beat; nothing on it moving like an object in the
wind. Judged by playing it beside the clouds and the owl.
What the two standards teach (studied in motion on main, 2026-10-08): the owl's bend is one clear stage (her at the
left, the rock a screen for shadows), a fear the player's own light turns into a small kind truth, then a held
over-the-shoulder exchange of looks (it blinks and tilts, she tips her head back), each character gesture a beat of
a second or two, one pan, and music that allows one lift per success and nothing more. The cloud stairs reveal by
atmosphere (thick white, then the vast sunlit top), hold a beautiful frame for half a minute when it earns it, and are
stylised throughout: bold simple shapes with character, a soft-toy staircase, not realism. So for the whale: a real
whale's structure drawn as bold, simple, characterful shapes; the eye's opening on her is the held exchange of
looks at the heart of it (over her shoulder, a slow blink, she reaches a mitten toward it, the bird peeps); the haze
does the first reveal; the score thins to almost nothing in the sorrow and blooms once at the release.

This consolidates the above for the build. The concept frames `comps/crossings/whale-net/k1–k5` and `k2-portrait`
(Astra, 2026-10-07, painted over real frames of this chapter, `ref-sea-*.png`) are now only a reference for
composition: their whale's form was wrong (a round tube) and is not followed. `notes.md` beside them has the layout
in metres and the build risks. Branch `crossing-whale` (a sleeping whale on `toMeadow`, built and half-tuned before the move) holds the
parts that carry over.

The sequence:
- **The same whale on the first crossing** (Jeremy, 2026-10-07: "itd be good to have the whale at the beginning
  between the still island and island of lines to be this very same whale as well (just without the netting and all
  that)"). The first crossing's whale (`toLines`, surfacing far off about 37 s in) becomes this animal: the same
  shape, skin and dream size, free and unnetted, seen only far off, rising, blowing and lifting its flukes as it
  dives, and it never crowds the farewell look-back. As built (Claude's call, 2026-10-07): it rises at main's 37 s, but
  at 110 m main's track carried it into the island of lines' haze, which is nearly opaque past about 150 m, so it
  breathes once about 124 m off and dives flukes-up about 77 m off, clear of the island, about 46 s in
  (`tuning.netWhale.sightAhead`, `sightAside`, `sightTurn`). Claude's call: the underside
  of its flukes carries a pale pattern of its own, seen as it dives there and again when it waves goodbye on the open
  sea, so the meeting is a recognition rather than a coincidence.
  Jeremy: "so when hte child encounters the whale again, it feels like a familiar face / friend". So it is met as a
  friend, never as a stranger or a danger: on the first crossing she watches it go (her gaze follows it and she sits
  up as it blows), and on the open sea she knows it before the player does: as it breathes in the haze she leans
  toward it and points, and the cygnet, wary of everything else that size, is not afraid of it. When its eye opens
  after the first breath it knows her too; the look between them is the warmest beat of the sequence, and the
  goodbye is a friend's.
- **The open sea as on main up to the swim.** The pod rises and rides the bow, the leap at first light, the cygnet's
  swim and its drying. The sea's distant surfacing whale (`whaleAt: 27`) is cut: the sleeper is the whale. The leap
  is thrown only from its mark beside the boat (Claude's call, N3o): a leaper that set out far astern runs up to it
  first, so the whole arc stays in the frame, never close under the lens.
- **The pod leads.** After the swim a dolphin nudges the planking (main's nudge, now asking) and the pod leads the boat
  off its line toward what looks like a long low island in the sunrise haze (`k1`). It breathes: a whale, dream-sized,
  lying still and worn out. The boat eases to rest beside its head (`Boat.speedLimit` eased to zero, never braked).
  Come to rest beside it with the nudge never landed, it counts as led all the same.
- **The whale.** About 110 m nose to flukes (see Ownership above; `notes.md` says 75 m), too big for the frame: the back recedes across and away into the haze and
  is never shown whole near the boat. Slate-blue, paler underside, the low sun on its rim, cool sky fill so the eye
  still reads; no sharp ridge, no face-like smile. Its eye, near the boat, is larger than the
  boat is wide, under a heavy tired lid. `notes.md`'s heights scaled to 110 m: crown about 5.3 m above the water, eye
  centre about 2.3 m, the eye about 3.5 m across. It breathes slowly. As built (Claude's
  call, 2026-10-08): a blunt head with its own lower jaw, the pale lip narrowing to a point under the eye and greying
  into the slate far off, so the first sight reads as a long low shape before it reads as a jaw; the near flipper,
  about 9.6 m (at 16 m it read as a second animal before the eye), roots low just behind the mouth's corner and lies
  awash toward the boat's port bow, turned up on its knobbly leading edge.
- **A dreamlike giant, ancient** (Jeremy, 2026-10-08: "To me it doesn't quite yet read like a sillouhette of a
  dreamlike giant whale." and "I also agree about the skin being a bit too "smooth" - we need it to look like an
  ancient giant whale", then "i think the concept art has served it's purpose to get us this far, i need you to take
  it to the next step."). From here the concept frames are a reference for composition, not the target: the whale is
  Claude's to take further. Claude's reading, agreed with him: it rode high and even along its whole length like a
  balloon, its outline one smooth arch, its skin clean and evenly lit like a small near model. Claude's direction: an
  island that breathes.
  - **Its form, from a real whale, not the concept** (Jeremy, 2026-10-08, on the first low-back build: "I'm not
    convinced by the sillouhette. Why is there a big hump and then the body sort of falls away. That doesn't read like
    a giant whale to me. I think the astra concept art was very bad in this regard and it seems to have carried
    through, creating this almost cylinder tubular shape to the whale's body"). Claude's reading: the body was a lathed
    tube, one round section swept along its length with the crown a bump on top; sinking the back behind the crown
    made it fall away. Claude's direction, from the blue whale (the largest animal there has been; the ancient look
    comes from its skin):
    - The section changes along the body. The head is broad and flat-topped, wider than it is tall, a long flat
      wedge from above with a ridge down the snout; the body is broadest just behind the flippers; the tail stock is
      narrow side to side and deep.
    - The flukes are the farewell's image, standing whole against the sun over the boat, so they are the most
      finished part of it: a humpback's broad swept pair, thick and rounded along the leading edge and thinning to a
      fine trailing edge in a few soft scallops either side of the notch, never a faceted saw edge against the sky;
      the tail stock a deep narrow keel flowing into them with no seam at the hinge, never a round stalk; their
      underside pale with a dark margin and a few old marks of its own (the first crossing's pattern), a few
      barnacles along the edges, never a cow's patches (Claude's call, 2026-10-08, after N3i: they stood as flat
      faceted boards on a pale stalk). As built (N3l): about 34 m across, their trailing edge five soft round lobes a
      side, the right fluke's a little unlike the left's; thickest at the root, where the tail stock flares out in
      their plane to meet them and ends inside them; underneath, a dark leading edge, tips and scalloped trailing
      margin reaching into the pale in a few soft tongues, a dark wedge up from the notch into the stock, a dark comma
      on one fluke and a round spot on the other, a few specks and faint old scratches on the pale.
    - The back is a broad, gently rounded ridge, not a tube's rim: from the hold its flanks curve up so slowly that
      it reads as a long low island, not a wall. It runs long and nearly level at about the blowhole's height, the
      blowhole's raised guard a gentle rise on it, never a hump the body falls away from; far along a small low
      dorsal knuckle; it goes on into the haze and lowers only where the haze takes it.
    - It sits in the sea like a hull: the flanks keep widening below the waterline, so its mass goes down and on
      beyond what shows. Under the glass that vast shape continues beside the boat, the flipper reaching under her.
      (The lie stays: the body's axis passes about 21 m from the boat.)
  - **It melts into the morning.** The far length dissolves into warm haze; a crisp gold line runs along the back's
    ridge against the sea; the top is wet.
  - **Ancient skin.** Weathered like an old hull or a reef: barnacle crusts clustered on the head, chin and flipper
    edges, old pale healed scars and scuffs, mottling like lichen, green growth at the waterline, wet streaks. Stylised
    and painted like the rest of the game, never photographic noise; healed and old, never a wound. Fine detail small
    against its bulk is what makes it read giant. The lichen gathers on the head and the top of the back and thins
    down the flank, so the near flank reads as one old surface rather than a scatter of decals (Claude's call,
    2026-10-08, after N3k). The scars are faint soft pale marks seen only as you look, never drawn strokes or
    chevrons that read from across the water (Claude's call, 2026-10-09, after playing the merged sea); as built (N3r),
    soft pale smears along the body fading at their ends and edges, there only where they are large enough on the
    screen to be seen as skin. The eye old, wet and kind in folds of age, its iris a deep warm brown catching
    the sun in one bright point, never a lit orange.
  - **It breathes the sea.** Each slow breath lifts the back a little, water sheeting off its top in glinting streams,
    and the sea round it swells and settles. As built (Claude's calls, 2026-10-08, N3m then N3o): as a breath that
    matters rises past its middle the sea pours off its back (s 0.08 to 0.86) in broad falls over the ridge and down the
    flanks, their front coming down from the top to the waterline in about two seconds, each fall wandering a little
    and streaming with the dawn it mirrors, lit gold through where it pours over the ridge toward the sun, gold drops
    glinting in it; low down they part into threads, and as they drain over the next few seconds they narrow to their
    middles and go. Where they reach the sea, strings of drops run off just over the waterline and white water laces
    it, mostly on the near side, never over the flipper. One low ring of swell goes out from its flank, the low sun
    coming through its crest, broadening as it goes so it lifts the corks and the boat gently (about 0.2 m at the
    boat after a waking breath). Only the breaths that matter pour in falls: its first full breath and the free spout
    (Claude's call, 2026-10-09, after playing the merged sea: every breath through the line and the flipper laid the
    same bright curtain along the back, repeating and pulling the eye from the step at hand). Every other breath, at
    rest or awake, runs off as a faint sheen streaming down the skin behind the same front, with a little lace and a
    few drops at the waterline: alive, never a curtain over the step at hand. Never a sudden lift under the boat.
  - **Life on it.** A few seabirds stand far along its back as on a rock, never near a step's target, and lift off as
    it spouts free. As built (Claude's call, 2026-10-08): four gulls in the game's gull look, cheated to about twice a
    gull's size so they read at 50 to 70 m, stand in two loose pairs on the ridge at s 0.54 to 0.7, riding its breath,
    turning their heads, shifting their feet and now and then stretching their wings. They are never in the sorrow,
    the look or the line's frames; from the bird's hold the far pair stands against the sky beside the sail. As it
    spouts they go up one after another, round beside the spout on its tail side, clear of its mist, and off into the
    low sun, fading into it well before the dive.
  - **Gentle to a child** (Jeremy, 2026-10-08: "ok but not too scary to a child yea, they still get to see the
    whale's eyes right?"). The eye stays above the water near the boat, large, warm and kind, and opening it on her is
    still the heart of the breath. The shape under the glass is soft and warm in the gold water, never a black abyss,
    and never moves suddenly beneath the boat. Barnacles are sparse soft bumps, never clusters of holes; scars soft pale
    lines, never gashes. Old and wise, never monstrous.
- **The net.** One old faded brown-green net, scaled with the whale to about 45 × 17 m, over the head and blowhole and
  down the forward back, rows of cork floats on its edges, a few strands of weed; one loop round the near flipper. The
  line in her mittens and its floats keep their real sizes (`notes.md`), so it is one a child can hold; the net's own
  corks are cheated larger (about 0.54 m) and its rope thicker so they read from the hold (Claude's call, 2026-10-08),
  the rope knotted in irregular diamonds and standing off the skin in folds and over hollows. A sparse
  deforming mesh, instanced corks and a few boundary ropes, never a general cloth simulation. Tired, never hurt: no
  injury shown.
- **1. The breath (circles).** The net lies over the blowhole; each breath only domes the mesh and sputters a weak
  mist. `updraftTarget` is the blowhole; circles there lift the patch of mesh off it like a sheet in the wind
  (progress builds while the player winds and is kept when they stop); the whale draws its first full breath, a soft
  column of mist up through the spiral, and its great eye opens and looks at the child (`k2`). Once it has breathed,
  the patch falls back loose and slumps off the blowhole to the far side of the crown, so the back's outline is the
  whale's again, never a tent of net standing on it; the column reads against the bright sky, full and tall, white
  mist lit gold on its sun side and soft grey-blue on its shadow side, never coloured smoke, drifting as it falls (Claude's call, 2026-10-08, after playing N3g: the
  patch held up stood as a pyramid of net over the back, and the column was lost in the glow). It is a whale's blow,
  the spout's kind, smaller (Claude's call, 2026-10-09): as built (N3r), burst up through the spiral to about 9 m in
  about a second, widening as it rises into a bushy top, then torn by the air and drifting off as it frays, gone in
  about five seconds.
- **2. The child (a sweep).** A line of corks trails from the net across the water by the boat. A sweep pushes the
  nearest cork to the boat; she leans out, catches the line in both mittens and hauls, and the net peels back off the
  jaw and head into the water (`k3`). Hands just outside the rail; she leans, never hangs out.
- **3. The cygnet (a sweep along the flipper).** The last loop is round the near flipper, out of her reach. The cygnet,
  which swam earlier in this chapter, goes in, swims to it and takes the loop's end in its bill; a sweep along the
  flipper and the whale, awake now and knowing her, lifts it lazily, and the loop slides off into the cygnet's pull,
  slack in the rope so the bird never reads as hauling a giant (`k4`). The child watches, mittens to her mouth. The
  cygnet swims back and is lifted in; the bird stays its own size and keeps clear water between it and the fin. As
  built (Claude's call, 2026-10-08): it drops in on its own side and swims round the stern, never through her; it holds
  the end beside the flipper's tip, about 4 m out to port of her, at least 1.2 m clear of the flipper's lift, side-on
  to the camera, facing the loop; a sweep before it holds the end lifts
  the flipper but the loop stays on; the lift is lazy, the tip rising about 2 m; as the loop slips off it backs away,
  lets go, climbs onto the gunwale into her arms and is stowed, and only then does the whale go free. The lift reads
  as one long pale paddle rising side-on out of the sea, water running off its trailing edge in sheets and drops, the
  loop sliding down it (Claude's call, 2026-10-08, after playing N3g: seen end-on with its drips as streaks it read
  as a claw).
- **Free.** It spouts a tall plume against the sunrise, the empty net drifting away on the water; the pod leaps round
  it; the child waves (`k5`). Then it dives as a whale does, never rolling over (Jeremy, 2026-10-08: "it "rolls
  over" at the end which is very weird"): the head goes down, the long back arches slowly forward and slides under,
  the flukes rise high once as if waving and slip under; its swell lifts the boat. The pod
  goes with it, the limit eases off, and the sea goes still into the mirror's glass. The net starts drifting as the
  loop slips off, working loose into a raft with its corks round its edges, so it is its own shape by the spout, then
  sinks slowly away into the deep and is gone by the dive (Claude's call, 2026-10-08: the past let go); as built
  (N3h), the raft lies in the open water between the boat and its head, where both frames see it, settles awash as
  the spout falls and goes down through the glass, its floats last; the
  pod sets off as the bird is lifted in, and three dolphins leap clear of the water round the head at the spout,
  caught by the sun. Free, the whale first swings its head away and slides clear of the boat (the eye from about 15.6
  to 19 m off), so by the spout it lies whole in the middle distance; the boat stays at rest. The release as built
  (Claude's call, N3h): the spout, then its mist drifting down over the boat in the gold light with fine drops
  glinting, the sea brightening round it, its call turned glad (the same voice, rising instead of settling) with her
  eyes on its eye, then her look up into the mist and the cygnet calling back; about ten seconds from the spout to
  the dive. The spout is a whale's blow of the first breath's white mist, glad and taller: a tall bushy column burst up
  fast and widening as it rises, lit gold on its sun side and soft grey-blue in its shade, the low sun glowing
  through its thin parts, then drifting and fraying; never a ball, opaque wool or smoke (Claude's call, 2026-10-09,
  after playing it: a plume that swelled over seconds became a round opaque ball like cotton wool sitting on the
  back, a cloud rather than a blow). Its crown is held in the release frame (Claude's call, N3o: as tall as fits,
  about 14 m at most, not taller). As built (N3r): it stands at its full height, about 13 m, within a second of the
  blow, holds about two seconds, then its top tears apart and drifts off fraying into the sun's glow, thin about five
  seconds after the blow and gone by about seven. The dive
  as built (Claude's call, N3i): one slow forward glide down a way through the sea that the whole body follows, its
  bend where the spout stood, so the flukes rise in the sun's own glow; its head tips down into the sea with its eye
  on her, the long back rises into an arch over the bend and slides forward under it, the low sun cresting the
  arch; the tail stock comes to the bend and the flukes lift and stand high there, the whale turning about the
  bend as they rise so their pale undersides open toward her (it turns, never rolls), flexing once or twice in a
  slow wave with its goodbye call and her waves; as built (N3l), they trail low from the stock as it arches and its
  stock tips them open toward her while they are still low (never more than about 17° across), so they come up
  already opening, never a blade edge on to her, and stand level three-quarters toward her; they slip straight down, and its swell comes back and lifts the
  boat; the pod leaps away over where it went; the boat comes about. About 20 s from the head going down to the
  flukes under.
- **Gestures.** Each step's answer starts at the wind's target and is plainly the biggest thing on screen: the boat is
  at rest, so nothing may read as the boat speeding up. The ambient breeze does nothing to the net, the corks or the
  flipper. The whale's body never answers the wind (Jeremy, 2026-10-08: "I also saw that the whale's body responds to
  the wind, which is weird"): no shiver, no slap, nothing from gusts on it or the breeze. What moves on it is the net,
  the breath it draws through the player's circles, and the flipper it lifts for a sweep along it once awake.
- **One encounter, seamless** (Jeremy, 2026-10-08: "the interactions need a pass as well so that the whole encounter
  feels seamless"). Each step's end hands on to the next on screen, with no dead air and nothing popping: the eye
  opens and finds her, and her look goes to the float line by the boat; the net sliding off the head bares the loop on
  the flipper, and the bird sees it and goes; the bird aboard, the whale drifts clear. The next target is plain the
  moment the last step ends; the whale's eye follows what matters (her, the bird); the camera's moves between holds
  are each one unbroken ease; the child and the bird answer each step's end.
- **Invitations and valves.** Each step has the usual drawn invitation after a few idle seconds and a safety valve after
  about 90 s with no progress, with a cause on screen: a dolphin lifts the mesh with its nose, noses the cork to the
  boat, nudges the flipper. No gull. Nothing is timed, nothing fails.
- **Camera.** The crossing camera eases (never jerks, never cuts, no reverse angle or underwater shot) from the rear
  view in `k1` to a hold beside the boat for the breath (`k2`), then closer and lower for the child's haul and the
  cygnet (`k3`, `k4`), where her mittens, the cork and the bird must read, then back out for the release (`k5`, the pod
  in frame). As found in the frames pass (Claude's call, 2026-10-08): the whale lies with its eye about 14.5 m off at
  46° to port and its length running about 72° to starboard, so its back recedes toward the low sun and leaves the
  frame on the right; every landscape hold looks toward the sun with the whale rimmed against it. A giant breaks the
  horizon (Claude's call, 2026-10-08, after playing N3g, whose holds 7–8.5 m up looked down on it like a map): the
  holds sit low enough that the back's ridge stands against the gold sky, the sorrow's and the look's lowest. The sun
  stands under a degree above the sea, so a camera below the back (about 5.2 m) hides its disc; what must show is its
  light, glowing along the ridge or over the far back, never the disc for its own sake. The haul's and the bird's
  holds rise only as far as the cork and the bird on the water need. The approach comes down as the boat slows, so
  the island rises above the horizon as it nears. The look between them is framed as the owl's is: her whole seated
  figure in three-quarter back view to one side, lit, its eye large across clear water. Claude's call, 2026-10-09,
  after playing N3n: from nearly astern her hood filled the corner, cut by the frame, not the owl's whole small figure,
  so the sail may stand behind her at the frame's edge as long as it never comes between her and the eye, and her
  reaching mitten shows against its flank. As
  built (N3q): looked at, she turns on the thwart until she faces its eye (she sits a little turned to port already,
  so the turn is small), sits up leaning only a little toward it, and holds her left mitten up and out toward it at
  full stretch, beside her hood. The landscape hold stands 9.5 m behind the boat, 2 m up and 0.3 round to port,
  looking a third of the way to its eye: the whole boat and her seated figure, about a quarter of the frame's height,
  three-quarters from behind her left shoulder at the frame's right third, the sail behind her at the right edge,
  its eye large at the left across clear water and the whale's back against the gold sky. Her face stays inside her
  hood from behind, as the owl's frame has it; what reads is her small figure turned to the eye with a mitten raised
  toward it. A phone's stands 4.8 m back and 2.2 up, turned −0.55, her seated in the boat under its eye with the
  mitten up beside her hood. Backlit by the low sun she would read as a dark lump, so the held frames lend her light of their own
  (`Traveller.lent`, only while they hold): the sun along her outline where it turns toward it, the lantern wrapped
  round her face and side, a lift in her shade so her coat stays yellow. The encounter composes its holds itself
  (`Shot.authored`): any turn the lens chose for the approach eases out, so they frame the same however the boat came
  in. The release eases out wide, the plume's crown in the frame; as it dives the view eases once to the farewell's
  hold, framed on where it goes down, the flukes towering over the boat against the sun, the sail clear of the stock,
  the boat whole above the bottom edge and her waving mitten against the sky or the sun's glow, never lost against
  the sail. As built (N3n): the landscape hold sits low (1.2 m), 21 m behind the boat and 0.3 to port, the flukes'
  tips inside the frame and the sun between the stock and the sail; as it dives she turns to where it goes down, goes
  along the thwart to the port rail and holds a mitten out at her side, waving slowly, so it shows beside her hood
  against the sun's glow rather than in front of the sail; the mitten is the one on the side toward where it went
  down, held up and out across the view, so it rises beside her hood. A phone's stands 22 m behind, 1.2 m up, turned −0.6, so she
  is about 70 px tall: the flukes tower past the frame's left edge and the sun stands between the stock and the boat.
  Once it has gone the view goes back to the crossing's in one long even ease as the boat comes about. A phone's frame is too narrow (31° across) to hold the head and the sun together, so its holds look along the line from what matters
  through the boat, each with its own distance, height and turn, stacking boat, step and head up the frame; the
  cygnet's is turned toward astern so the bird stands clear of the sail above the boat (`k2-portrait`).
- **Reward.** Freeing the whale is the open sea's major conclusion, so the reward phrase (`completeObjective()`) plays
  as it spouts free.
- **Pacing.** The mirror's jetty is on the horizon from the first seconds of the open sea, as on main: it lies only
  about 250 m from the sleeping island's berth and about 25° off the sunrise the sea sails toward, so no route that keeps
  the sunrise ahead through the leap and the swim can hide it. Claude's call (2026-10-07): keep that, since the
  destination glimpsed and then left is what makes the pod's lead read as a detour; from the lead until the whale has
  gone nothing of the mirror is in frame, and the boat comes about for it a few seconds after. Measured on `sea-whale`
  with all three steps and the look between them (2026-10-08, N3g): the lead about 60 s in, at rest about 89 s; a
  player making each gesture is moored about 216 s in, one who leaves every step to its valve about 480 s. The open
  sea's "at most 100 s" is lifted for this. Music: the sea's score holds through the encounter; the mirror's arrival
  music cannot start until the whale has gone.
- **Saves.** Checkpoints at rest beside it (before the first step), after each step, and after it has gone (resumes
  sailing on toward the mirror with no whale). The haul's is taken as she lets go of the line, before the bird goes
  in; the flipper's resumes at free with the bird in the satchel and the net loose.
- **Sounds.** Its slow breath and the sputter through the mesh, the full breath, the spout (`whale-blow`), the net's
  wet rope and corks, the cygnet's splash; all synthesised (`docs/contracts/audio.md`).
- **Its voice** (Jeremy, 2026-10-07: "yea, lets give it a voice"). One low, soft call when its eye opens and it knows
  her, the friend's greeting, and the same call once more as it waves goodbye. Synthesised like every sound, shaped
  to sit in the sea's score, never a cartoon voice; on the first crossing, at most a far echo of it as it dives.
- **The cygnet's second swim** (Claude's call). Its first swim in this chapter is the hesitant brave one; at the
  flipper it goes in at once, without the climbing and deciding: the same bird after the sleeping island.
- **No first-use stalls.** The whale's new programs and the net are compiled at boot like every other program
  (`docs/backlog/boot-veil/`; `__stats.bootStrayPrograms` and `playFirstDraws` stay at 0).
- **The chapter-select still** for the open sea becomes the whale; regenerated after the build is judged (Jeremy,
  2026-10-07: "the picture will need to be regenerated, but lets build it out first").

**QA starts.** `?chapter=toMirror` (and any `to*` crossing) starts that crossing at its first waypoint, cygnet in the
satchel (branch `crossings-start`, also carried by `crossing-whale`); `?chapter=sea` starts the open sea as on main;
`?chapter=whale` starts at rest beside the whale, as its first save (`whale-rest`) resumes.
