# Birches uplift: the squirrel in the leaves

Claude's creative lead (Jeremy, 2026-10-15: no design session; "design it, and orchestrate / execute it"). Built on
branch `birches-uplift` in the worktree `/Users/jeremy/projects/updraft-birches`; nothing reaches `main` until
Jeremy has seen what it changes and approved the merge. Phases: [build_plan.md](build_plan.md). The room as it
stands: [chapters.md](../../chapters.md) "The birches"; its music: [audio contract](../../contracts/audio.md)
"Birches".

## Jeremy's brief (verbatim)

From the roadmap (2026-10-15):

> if we make birches island longer / more interactions and activities (right now its over in 90 seconds) we can add
> another song for the stairs, and probably move the birches island so that the travel from birches to stairs
> island is a bit longer? Otherwise there's not enough musical palate cleansing between the two islands.

The direction (2026-10-15):

> hey check out the roadmap.md, we need to uplift the birches island. it's currently over in 90 seconds. I'm
> thinking two directions, depending on the music (assets/music dir)
> 1) birches.ogg - slower, more cinematic and bittersweet but still somewhat happy. piano only. I'm not sure what to
> add here. It is beautiful and serious in it's own right. I'm not sure what puzzle we can add to extend it within
> this theme.
> 2) Change the music to the red door song, which makes the autumn chapter a fun, playful one, that somehow also
> feels very autumn themed, like there are leaves to play in. I think the natural puzzle that comes to mind to
> extend the birches island here with a leaf pile game / puzzle with some sort of hide and seek and the child has to
> find it by blowing around the leaves. Either the cygnet is hiding, or some other animal like a squirrel(?) is
> hiding and both the cygnet and child are trying to find it in the leaf piles.
>
> What do you think we should do?

Claude recommended direction 2 with a squirrel hiding and `birches.ogg` moved to the stairs under the cloud.
Jeremy's ruling (2026-10-15):

> yea the red door opens, and yep makes sense to make birches the song under the stairs i guess (we can try this).
> I reckon we dont need a backlog design session. I'm fairly confident you have the ability to think this though
> given what we're trying to achieve with the birches chapter, design it, and orchestrate / execute it.

On the island's length (2026-10-15):

> your ideas makes sense.
>
> however, i get the feeling that the birches island may be need to be made appropriately longer to accomodate this
> new content so it doesn't feel too cramped. It might cause a lot of work figuring out how to make the scarf
> longer, and there may be perf implications to having too much drawn on screen.. What do you think? any ideas?

> Don't worry about measuring performance as part of this session. I'll do the profiling in another session. Just
> use common sense and try not to do silly things that would impact performance. What do you mean by inserting
> gaps? I do like the look of how the birches island is set up already as sort of this one corridor instead of zig
> zag paths everywhere like in the other chapters. But that may only work for the current level design i guess...

> ok, so when you said you weren't going to stretch it, you didn't mean you weren't going to make it longer? What
> you're saying about the cuts and making the island longer makes sense to me. Ok, im giving you creative
> ownership. try to preserve or even uplift the aesthetics of the island with the swirling leaves and the golden
> light etc.
>
> And in terms of the crossing from the birches island to the stairs island, that needs to be lengthened a bit as
> well i think, especially since you're lengthening the birches island, so i assume you'll need to figure out how to
> move the birches island to increase the distance of the crossing (the boat speed must be kept the same).

> Oh and one other thing, it'd be nice i think if you could have some autumn leaves as dream echoes on the stairs
> island (they dont need to be able to be blown by the wind, they could be baked textures). 50 seconds seems a bit
> too much, what is the current length of the crossing?

## What it is

The birches become the last carefree afternoon of the journey: one more romp in the leaves before bedtime on the
stairs, the drowned village and the dark wood. A red squirrel lives in the birches. It dives into the leaf heaps, and
the child and the cygnet play hide-and-seek with it all the way over the island. The player finds it the only way
the player can do anything: by blowing the heaps apart. The scarf's four tangles and the swing stay exactly as they
are, and the squirrel rounds slot in between them, so the walk alternates between a precise gesture (a tangle) and
loose, joyful gusting (a heap). The island grows by about 55 m along its walk, so each round gets its own stretch of
wood instead of being squeezed in beside a tangle. The music becomes "The Red Door Opens". `birches.ogg` moves to
the stairs under the cloud, and the island moves further from the stairs so there is quiet sea between the two
songs.

Target: an engaged player spends about **3½–4½ minutes** on the island (currently about 90 s). The Red Door Opens
runs 3:59, so one pass is about one visit.

Why a squirrel and not the cygnet hiding: the dark wood is where the cygnet hides, frightened, and is found by the
light the player makes. That is one of the game's biggest beats, and a playful daylight version would spend it.
With a squirrel hiding, the cygnet and child seek *together*, which is itself the bond growing. The cygnet already
dives into heaps and rummages here (`birches-play.ts`), so the game starts from what the room already does.

## The room, stop by stop

The walk, its heaps and tangles in order. "Band z" is the island as first built, the terms everything on it is
authored in (`world/birches-layout.ts`); "world z" is where it stands since phase 1 (x moved 40 m west as well);
"gap" rows are the new stretches of wood ("The island moves and grows"):

| band z | world z | What | Status |
| --- | --- | --- | --- |
| −1052 | −1036 | landing; the child looks up the ride, sets the cygnet down | as now |
| −1076 | −1060 | **round 1** at heap 0 by the fallen log (`BIRCH_PILES[0]`) | new |
| gap A, 16 m | −1065 to −1081 | open wood between the log and tangle 1, so round 1 and tangle 1 each have their own frame | new |
| −1081 / −1088 | −1081 / −1088 | tangle 1, lift a loop off a fork | as now |
| gap B, 16 m | −1101.5 to −1117.5 | **round 2**, on the rise's lower slope, two new heaps at the corridor's sides | new |
| −1113 / −1118 | −1129 / −1134 | heap 1 at the swing tree's foot (free play, as now) and the swing (optional, once) | as now |
| −1132 / −1139 | −1148 / −1155 | tangle 2, circle the coils up | as now |
| −1149 | −1165 | heap 2, the deep one at the bottom of the hollow, just short of gap C | as now |
| gap C, 24 m, in the hollow | −1170 to −1194 | **round 3**, the shuffle among three new heaps set out in front of her on the hollow's west bank; then **the leap** | new |
| −1157 / −1163 | −1197 / −1203 | tangle 3, draw the slipped loop sideways | as now |
| −1172 | −1212 | heap 3, free play as now | as now |
| −1176 / −1180 | −1216 / −1220 | tangle 4, the bow; the scarf gathers into the boat as its sail | as now |
| −1197 | −1237 | berth; the squirrel sits at the water's edge and watches them go | new glance |

1. **Meeting (round 1, one heap).** Walking up the ride, the frame takes in the fallen log. The squirrel sits up on the
   log's end, out past the heap, with a nut in its paws: red on the white bark and the bare ground there. She comes up
   to the heap and stops, looking at it; it sees her and freezes, then sits up and chatters at her (a chitter and its
   call marks, then bouts of chucks) while she and the cygnet look straight at it and the lens glances at it. After
   about two seconds it dives into the heap with a crunching whumph, and the leaves go up high and wide round it, lit
   against the sun (then stillness). The heap stands against the wind until it is in. The cygnet goes straight for
   the heap. The child crouches at its edge, peering (the walk gates here, as at a tangle). The tail pops up out of
   the leaves and waves with a chitter. Wind that takes enough of the heap off its back uncovers it: it starts with a
   squeak, sitting up in what is left, then explodes out in a spray of gold, sits up, scolds, flicks its tail, and
   dashes for the tangle-1 tree with the cygnet scrambling after it and the child laughing (`cheer`). One heap and an
   obvious tell, so the player learns it without being told.
2. **Tangle 1.** Found, the squirrel runs on ahead of her up the ride, as the drowned village's cat leads, climbs the
   loop's own birch and goes out along the branch the loop hangs from. It sits up on the branch beside the loop,
   against the haze beyond, watching her come and work (the subject of the frame with the knot, never in the
   gesture's way). As the loop lifts free it runs back along the branch, down, and on to the first perch tree, up to
   the coil there and down the wool into the next round. The wool is its road, and the room's red line leads the eye
   on. She sees it go, and they play hide-and-seek: she turns her back on where it went, covers her eyes and counts
   while it hides.
3. **Round 2 (two heaps).** It drops off a trunk into one of two heaps either side of the ride on the slope below
   the rise, out of the swing's frame.
   Now there is a choice. Only the right heap twitches; the tail shows less often. A wrong heap bursts into gold
   harmlessly (it's fun on its own), and the cygnet may rummage one and come up with nothing but a leaf on its head.
4. **The swing** (optional). The squirrel sits on the swing limb while she rides.
5. **Tangle 2.** The squirrel is up on the broken birch's top while the coils are circled off. On their way up they
   close in over it for a moment: it startles, jolting down with a squeak, and is uncovered again as they lift clear
   and slide off to the side, when it shakes itself and scolds the wool (Jeremy's idea, 2026-10-16).
6. **Round 3, the hollow (three heaps): the shuffle.** No counting. Three heaps stand side by side in front of her, like
   cups on a table. The squirrel has run on ahead and sits up between the left heap and the middle one, waiting for her. She comes and stands watching; it chatters at her (watch this)
   and dives into one of the heaps in plain view, with the splash. Then it shuffles: it bursts out and bounds to the
   heap beside it, three or four times, quickening, sometimes doubling back; the last one or two moves are under the
   leaves, a hump of litter heaving across the floor between heaps with the loose leaves popping over it and a rustle
   going with it. Then it settles and stays put. She and the cygnet follow every move with their eyes. Blowing a heap
   it is not in makes the real one answer at once with its tail and a chitter. When it is found, the squirrel bounds up
   the birch behind the middle heap and stays in the canopy from here on. Then **the leap**: the cygnet dives into the nearest
   deep heap left, and the child takes a run and jumps in after it, lands sitting in an explosion of leaves, and the two
   come up together covered in gold. This is the room's showpiece, the moment the child plays in the leaves herself.
7. **Tangles 3 and 4** as now, the squirrel a background presence in the trees above. **The goodbye:** as the boat
   pushes off, the squirrel has come down the beach after them and sits up at the water's edge beside the berth,
   watching them go (a glance, not a shot).

## Jeremy's first playtest (2026-10-16, verbatim)

> 1. The sail is like 5 seconds short... The crossing needs to be longer
> 2. It's hard to see the squirrel sometimes, especially at the beginning. We need the camera to subtly highlight it,
> and noise marks when it makes squirrel noises. a bit of a more energetic idle animation might also help? what do
> you think? Or like it's tail sticking out of each leaf pile and waving around with the noise marks? It's sometimes
> hard to even see the tail sticking out. Maybe the squirrel could be slightly bigger?
> 3. At the first scarf knot, it waits for the child instead of scurrying along to the next leaf pile by itself
> 4. What if the squirrel was holding an acorn or something?
> 5. The indicative wind gestures on the leaf piles should probably be updrafts

> Actually, when i said that the squirrel waits for the player at a challenge, that actually plays alright. It's just
> the very first challenge is a bit weird because the squirrel is standing tehre behind the player waiting for her
> instead of ahead of her on the branch of where the knot is. i.e. it looks better when the squirrel is in the "lead"
> somewhat of the same way the cat does in the drowning village.
>
> There's a leaf pile before the swing that the player can sweep away before they get on the swing. Is that
> intentional?

> And when the squirrel jumps into a leaf pile, it should be obvious with leaves flying everywhere and a sound effect.

On the meadow sail after it was lengthened along the meadow's coast (2026-10-16):

> are these screens showing the 30 seconds? The island is still so close by visually

> holy hell just move the birches out a bit. Don't touch the stairs chapter. i dont want to mess with that

> the haze / fog around the birches island is a bit too strong and obvious i think, and the music starts playing maybe
> 2 seconds too early

> I meant the birches island music should start 2-3 seconds later than it currently does, and it should fade in a bit
> more.

The island mist was softened to clear 90 m / hidden 150 m (from 60 / 110). Red Door fades in on a 1.63 s time
constant (`tuning.audio.recordedMusicFadeIn.birches`), so it rises over about four and a half seconds; where it enters is
"Music" below.

> when the music loops on the birches island, it needs to have a better fade in.

Going round on the island, each pass plays to its natural end, rests (`tuning.audio.recordedMusicLoop.birches`) and
begins again from its top with the same entrance ("Music" below).

> It's jumping animation also needs a look at, when it's "jumping" it looks like it's slow motion gliding through the
> air. It doesn't have the expected jump velocity if that makes sense, and so it's animation looks really strange as a
> result.

> I also think birches chapter has a bit too many leaves now, i'd tone it down by 20% atleast

> And didn't i ask for the leaf heaps to become updrafts, not normal wind gestures? what else did i ask before that
> hasn't been done? Also, when the music loops on the birches island, it needs to have a better fade in.

> i need you to also take a look at the camera when they are doing the crossing to the birches island, it's not very
> good right now. It just stays behind the child and never does a cinematic reveal of the birches island until she
> gets off the boat.

> the player also shouldn't be able to blow away the leaf pile until the squirrel has jumped into it

> the squirrel also jumps out the very instant that the leaf pile is "blown" even though the leaf pile might not have
> disappeared at all

> for the scarf challenge after the swing, an interesting idea would be to have the squirrel squeak and act alarmed in a
> cute way after the scarf is blown up the tree trunk, over it, and then uncovering it again as it rises to the side.

> Then for the leaf piles after that scarf challenge wrapped around the dead tree trunk after the swing, where there are
> three leaf piles, i dont understand why the squirrel only hides in the third one. Why not have it jump from one to the
> other or something, otherwise two of the leaf piles are wasted (unless you think this wouldn't be fun for the
> player). Or maybe, I was thinking of seeing if we could do one of those "which cup is the squirrel under" type of
> shuffle games as well. what do you think?

> Another thing to add to the list from me, the route that the boat takes to the stairs island needs to be taken a look
> at. The route now has the boat sailing literally across the shore line and the stairs island is not hidden in haze
> until the child gets closer. camera direction and haze are important to get just right.

Claude's proposal (2026-10-16), built ("As built: the shuffle and the rounds polish" below): round 3 becomes the
shuffle. No counting before it. The squirrel dives into a heap in plain view, then leaps heap to heap three or four
times, quickening and sometimes doubling back. The last one or two moves are under the leaves, a rustling bulge
crossing the floor. Then it settles and stays put. The heaps hold until the shuffle ends. Blowing an empty heap makes
the real one answer with a tail tell and a chitter. Rounds 2 and 3 vary which heap it ends in.

Loose leaves are cut to 75% per metre of the walk (`tuning.birches.looseLeaves`). On the island Red Door plays to
its end, rests a few seconds and comes in again from the top with its arrival fade-in, instead of looping sample to
sample.

> It's ok if the distance between birches and stairs increases as well e.g. if both become 40 seconds or whatever

On the first knot and the meeting, in a later playtest (2026-10-16):

> i remember talking about wanting the squirrel to "lead" the puzzle so to speak, and that meant that for the first
> knot, it should climb up the tree and sit on the branch next to that first knot. The camera is also not highlighting
> the squirrel enough when they first meet. I didn't even realise there was a squirrel there when i was playing.

What follows from it (Claude's calls, 2026-10-16):
- **The meadow sail** (`toBirches`) crosses real open sea. The birches move further out from the meadow (west, where
  the meadow's shore falls away) and the boat sails straight across instead of along the meadow's coast. The stairs
  room is not touched; the stairs sail grows with the move. Revision 12 has not shipped, so its shift is amended
  rather than a revision 13 added.
- **The squirrel reads at a glance.** Its scale goes from 3 to about 3.6. Its calls show `CallMarks`, the small
  visual echo of a voice the cygnet and the cat already use. Its idle is livelier: stop-start twitches, tail flicks,
  quick head turns and small hops. While hidden, the tell is the tail. More of it comes out, more often, and it
  waves with each chitter and its call marks. The camera highlights it subtly: the depth of field's focus settles on
  it, and a low-weight glance goes to it when it appears, calls or is found, never a pan.
- **It dives in with a splash.** A dive throws leaves everywhere, with a crunching "whumph", without hollowing the
  heap (phase 6's ring fix stands).
- **It leads.** At every tangle it waits ahead of her, on or by the knot's tree where the knot is, as the cat leads
  in the drowned village. Waiting at a challenge stays as it is. At the first knot it climbs the knot's birch and sits
  up on the branch beside the loop, and that tangle's frame is moved so the knot and the squirrel on its branch are
  its subject in both orientations.
- **The meeting is unmistakable,** the room's introduction of its main character, in story and without a pan. It sits
  up on the log's end, red on white bark and bare ground rather than in the gold by the heap. When she stops at the
  heap it sees her, freezes, then sits up and chatters at her with call marks while she and the cygnet look straight
  at it and the lens glances at it; it holds that look about two seconds before it dives.
- **Heaps hold until it is in.** Each round's heaps stand against the wind, updrafts included, until the squirrel
  has gone into hiding in that round: the wind flutters their tops and lifts a few loose leaves, and takes none of
  the heap.
- **It is found when it is uncovered,** not the instant the wind arrives. The live floor over its back is read a few
  times a second; when the updraft has taken enough leaves off that it shows, it starts with a squeak, sitting up in
  what is left, then bursts out. About two loops of updraft over the right heap are enough.
- **Under the coils at the second tangle** it startles as they close over it on the way up, and scolds the wool once
  they have lifted clear and slid off.
- **It carries an acorn**: in its mouth while it runs, in its paws while it sits and nibbles.
- **The heaps' invitation is an updraft** (the circling gesture), and an updraft over the right heap finds it,
  lifting the leaves off in a whirl.
- **The heap before the swing** is heap 1, one of the island's original free-play heaps. It isn't a round heap
  and isn't raked, so it doesn't promise a squirrel. Blowing it away before the swing is fine.

## Jeremy's second playtest (2026-10-16, verbatim)

> so like.. i can blow away the first leaf pile from the crossing. Before the child even sets onto the island

Fixed (`b3348d9a`): the raked heaps start held in `world/birches.ts`, before the island's story first calls `hold`.

> The start of the birches music should coincide with the camera panning to reveal it, so it needs to start a bit
> earlier now.
>
> I can also still blow away the leaf pile before the squirrel has ever jumped into it...
>
> For the first knot, the child should stop a bit closer to the knot and be facing it, not facing away with her head
> turned towards it
>
> leaf piles are too easily blown away, and they should only blow away from updrafts.
>
> Right now, it's not clear why the child gets on the swing, any thoughts on adding some kind of mini puzzle or fun
> thing to the swing so there's a natural conclusion instead of the player figuring out they have to stop blowing on
> the swing to continue on? Maybe we can do some training here before the drowned village and have the swing be a way
> for the child to swing over a leaf pile or some kind of obstacle like a tree trunk blocking the way?
>
> There's too much of a pause in between the looping of the birches music, reduce it by atleast 3 seconds.
>
> Can you please take a look at the performance profile of the birches chapter? I notice the auto quality always
> dropping to medium at some point or other.

Then, on the second knot:

> Another thing, after the second knot challenge around the tree trunk, the squirrel teleports down to the base of the
> tree trunk.

On round 3 and the swing proposal:

> ok yea the fallen birch makes sense. Speaking of the three leaf pile game later on, you need to also make that those
> leaf piles can't be blown away too early. And their layout is also not the best as a line leading away from the
> child. They should be roughly presented infront of her. There's also an issue where if the player guesses wrong,
> then there's no leaf pile for the child to jump into... how can this be solved

On the proposal that a wrong guess in round 3 only lifts a heap's top and leaves it standing (2026-10-16):

> ok cool sounds good

After the music, heaps, knot and performance work (2026-10-17):

> small polish point, i think the music starts maybe 2 seconds too early, and the fade in could be reduced by 0.5
> seconds. I also noticed that the boat disappeared the moment that the child started running off into the birches
> island

Red Door now enters 2 s into the reveal's swing, and its fade-in time constant is 1.63 s (from 1.8), so the audible
rise is about half a second shorter. The boat vanished because the walk's leg count raced ahead while she stood near
a stop short of its waypoint (counting the stop as the waypoint), so it passed the clearing's leg on the walk's first
frame and sent the boat round. Legs now advance only on reaching or passing the route's own waypoint, and the boat
leaves only once she is 25 m from it and no part of it (hull ends to 6 m up, a 1.35 margin) has been in frame for 3 s
(`tuning.birches.boatLeaves`).

> music starts 1 second too early still, and the camera zooms out slightly a bit too much (it shows the sides of the
> birches island and makes it look smaller on the approach in.

Red Door enters 3 s into the swing. The reveal's lens stands 20 m off the boat (from 24) on a longer lens
(`IslandReveal.zoom` 1.3, eased in and out with the reveal), so the island fills the frame on the way in rather than
showing small end to end.

> there's still a subtle zoom out when they come into shore

The longer lens now holds through the landing (it follows the reveal alone, not the arrival) and the room lets it go
between 1.5 and 6 s ashore (`tuning.birches.arrivalLens`), while the first shot is still closing in on her, so the
island only ever grows in the frame: measured, it shrinks under 2% as the boat stops (the lens settling from the sail's
8.5 m to the room's 7 m) where it shrank 4% as the lens widened before.

What follows from it (2026-10-16):
- **Red Door enters with the reveal.** On the meadow sail its entrance coincides with the lens beginning its swing
  round to the port side to reveal the island, not after it.
- **The loop's pause is at least 3 s shorter** than the 3.5 s rest plus the track's own quiet tail and fade-in give
  now, measured from the last audible sound of one pass to the first of the next.
- **Heaps yield only to updrafts.** Every leaf heap (the squirrel's and the free-play ones) stands against swipes:
  a swipe flutters its top and lifts loose leaves, and takes no heap. An updraft wound over a heap takes it, and it
  takes more than now (about two loops, generous to children's circles). Supersedes "A swipe still counts" above:
  a round's squirrel is found by updrafts only.
- **No heap can be blown away before the squirrel has gone into it**, whatever the route, save or gesture.
- **A wrong guess in round 3 leaves the heap standing** (ruling, 2026-10-16). An updraft over a heap the squirrel is
  not in lifts a whirl of leaves off its top, so the player sees it is empty; they rain back down and the heap stands.
  The real heap answers with its tail and chitter. Only the squirrel's heap bursts apart, and only to an updraft, so
  after the find both wrong heaps still stand and the leap always has a heap to land in. Round 2 is unchanged: a
  wrong heap there bursts apart harmlessly.
- **At the first knot** she stops closer to the knot and stands facing it, body and head, not turned away with her
  head looking back.
- **After the second knot** the squirrel climbs down the broken birch and runs on to where it goes next, in
  continuous motion, never a jump cut.
- **The swing:** proposal pending Jeremy's answer (below, once given).
- **Performance:** find why the quality governor steps down to medium on the birches, and fix the cause without
  changing the look. Measured on this Mac (M4 Pro, 1920 × 1080 at DPR 2, where Auto's ladder is Ultra at 1.08×
  with 2× MSAA, then Medium at 1×, then Low): with nothing else on the GPU, the whole walk with real gestures (13,000
  frames, landing to aboard) holds Ultra at a steady 60 fps, no interval over 17 ms. A frame costs about 7–8 ms
  run back to back (meadow 7–10, drowned 5.5–7.6), so Ultra has about twice the headroom it needs; of that, about
  4.5 ms is script, nearly half of it the scarf (its cloth, its rows and their normals, and 680 KB of vertices
  uploaded every frame). The step-down comes from sharing the GPU: one other headless browser running the game
  beside it, as an agent's capture does, takes the birches to Medium within 2 s and to Low within 4 s; the meadow
  also steps down under the same load, and the drowned village, which is lighter, holds Ultra. Readback maps
  that take under 1 ms alone then wait up to 40 ms behind the busy GPU process. Auto returns to Ultra about 14 s
  after the other load stops. So nothing in the room needs cutting, and the governor reacts to frames that really
  are late. Judge Auto's level only with no capture running.

## Mechanisms

### Music

- The birches room's track is "The Red Door Opens" (`assets/music/A Light Left On - The Red Door Opens - Treblo.ogg`,
  238.9 s), copied to `assets/music/red_door.ogg`. It takes over everything `birches.ogg` does now from the approach
  crossing through boarding: it loops only while the story is on `toBirches` or `birches`
  (`SoundState.birchesLoop`) and plays out once they have sailed. Measure its loudness and set its level the way the
  others are set (`recordedMusicDb`; Birches' current `roomTrimDb` −2.5 dB stays unless the measurement says
  otherwise).
- On `toStairs` it plays out the pass under way. If that pass would still be sounding within 15 s of the stairs
  landing, it fades out over 5 s, ending at least 10 s before the stairs song starts. If the pass ends earlier, it
  just ends. The gap between the two songs is sea, wind and the boat, which is the "palate cleansing".
- **The stairs song** is `birches.ogg` ("A Question, Then a Gentle Answer", 224 s, unchanged file). It begins from
  its top at the stairs arrival, through the same arrival-music handoff the other crossings use (`arrivalMusic`),
  and plays under the cloud. When they go up into the white (`StairsAir.phase` leaves `under`) it fades out over
  `stairsSongCloudFade`, 3 s, a trial value Jeremy will judge (the old 1 s `birchesCloudFade` was a guard against a
  leftover song, not an ending). Silence through the white and the loop, and `clouds.ogg` on top, are unchanged.
- Track keys follow the rooms: `birches` → `red_door.ogg`, `stairs` → `birches.ogg`. Prefetch and decode
  (`audio/music-loading.ts`) follow: Red Door warms in the meadow, the stairs song from the birches on, `clouds.ogg`
  from the stairs' white as now.
- **As built (phase 2).** The handoff's real entrance is 9 s before the landing, about 20 s after the push-off, so a
  pass fading 10 s before it would fade as the boat gathers way. Red Door fades when the crossing's estimate
  (`arrivalIn`, at the boat's speed now) reaches 15 s, and the stairs song waits 10 s after Red Door was last heard:
  with no input Red Door fades 8.2–13.1 s after the push-off and the song begins at 23.2 s, 6.5 s before the landing.
  A `toStairs` start never begins Red Door. Numbers and checks: build_plan.md phase 2 and the audio contract.
- **On the meadow sail Red Door enters with the reveal.** The birches' `IslandReveal` carries `music: 3`
  (`tuning.crossingCamera.arrivals.birches.reveal`): the crossing is ready for the arrival music 3 s after the lens
  begins its swing round to port (`revealing` above 0), and the meadow's music is asked to leave early enough that its
  longest phrase wait, fade and quiet (10.5 s at the boat's speed) are over by then. With no input from
  `?chapter=toBirches`: the meadow fades 5.4–8.4 s into the sail, sea and wind until the reveal begins at 17.9 s, Red
  Door from 20.9 s on its 1.63 s fade-in, the lens visibly turning from about 19.5 s and settled at 27.8 s, landing
  at 38.8 s.
- **Going round on the island** each pass plays to the end of the file, rests 0.3 s
  (`tuning.audio.recordedMusicLoop.birches`) and comes in again from its top on the same 1.63 s fade-in. The last
  chord dies away over the file's final 2.7 s (below 30 dB under the piece's average as played) and the next pass is
  audible 0.17 s in, so the pause heard is 3.25 s (`music-transition-audit.mjs`, `birches-seam`).

### The island moves and grows

Two asks share one change. Jeremy's roadmap asks for more sea between the birches and the stairs. And three rounds
added to today's 145 m walk would put eight stops in it, one every ~18 m, while the walking and tangle frames look
17–26 m ahead, so every frame would hold the next stop as well. The island therefore grows by about 55 m (to a walk
of about 200 m, a stop every ~25 m) and moves.

**One corridor stays one corridor.** Jeremy (2026-10-15): "I do like the look of how the birches island is set up
already as sort of this one corridor instead of zig zag paths everywhere like in the other chapters." The walk stays
a single open ride from beach to beach. The gaps make the corridor longer, never branch it. Every round happens in
the corridor: its heaps sit at the ride's edges against trunks and roots, where heaps form, never down side paths
or in clearings off the ride.

**Growing by inserting gaps, not by scaling.** The island is cut into bands across the walk at three lines where no
authored feature straddles the cut, and the bands are pushed apart: gap A ~15 m, B ~20 m, C ~20 m (the table above).
Everything inside a band moves rigidly: a tangle with its tree, snag and perches, the swing tree and its clearing,
the log and its heap. Only the open walk between them gets longer. Exact cut lines are the builder's to choose and
record here; a stop point may move by a metre or two to clear a cut. Uniform scaling was rejected because it would
stretch the tangles, the swing clearing and the scarf's wraps, which are tuned shapes.

What each part costs:
- **Terrain is cheap.** The island is a dome (`ISLES.birches`) plus world-space noise plus two lumps (`BIRCH_RISE`,
  `BIRCH_HOLLOW`). Growing it means a longer `rz`, a rise that sits where its bands now are, and a hollow
  lengthened by gap C (`BIRCH_HOLLOW.rz` up; a longer basin is more of a "place the leaves collect", not less). The
  CPU height function and its GLSL twin (`hf_birches`) take the same new numbers.
- **Trees fill themselves.** They are placed procedurally over the island, kept off the ride (`walkDistance`), and
  the ride follows `BIRCHES_WALK`. New ground grows new trees.
- **The scarf is one strip routed through its snags and perches** (`SCARF_SNAGS`, `SCARF_PERCHES`) and resampled to
  `ROWS` (1140). Moving those points band by band leaves every tangle's shape alone and lengthens only the wool
  runs that cross a gap. `ROWS` rises in proportion to the strip's new length (about +25–30%) so the wool stays as
  fine as now.

**Keeping the cost flat.** All the birches' trees draw as one instanced canopy whenever the island is within 240 m of
the camera, with 420 simulated leaves each, so tree count is the cost that grows with the island. The island
narrows (`rx` 60 → about 48–50) so the tree count stays where it is today; the flanks it loses are ones the camera,
low under the canopy and in thick haze, never shows. The litter field is a 256² grid over the island's box, so a
longer box would coarsen the leaf floor; it becomes 256 × ~320 along the walk (a trivial GPU pass) to keep today's
cell size. The loose leaves (`LEAF_COUNT`, a 192² GPU particle pass) concentrate near the walk, so a longer walk
would thin them. Their grid grows along one side in proportion to the walk (192 × ~260), keeping as many swirling
leaves per metre of corridor as today. That is a small GPU cost spent where the room's look lives. The scarf's
extra rows are the one real CPU increase. Jeremy profiles in another session (2026-10-15: "Don't worry about
measuring performance as part of this session... Just use common sense and try not to do silly things that would
impact performance"), so this build runs no benchmarks.

**The look is kept, and lifted where it can be.** Jeremy gave creative ownership on the condition that the island's
look (the swirling leaves, the golden light) is preserved or uplifted. The new stretches are more of the same
corridor and get the same gold crowns, the same floor and the same haze. The afternoon's light ages across the walk
over the same range as today (`dusk` 0.58 → 0.70 from landing to berth, already proportional to the walk), so the
far beach and the departure look as they do now. The added spectacle is all leaves: the squirrel's bursts, the
heaps the player blows apart, and the leap's explosion of gold. Each round's frame is composed low and toward the
light, so leaves thrown up are lit through against the sun where the room's geometry allows. The storyboard phase
compares every new frame with today's stills of the room and keeps nothing that looks flatter.

**The shift.** The grown island moves by a new `BIRCHES_SHIFT` in `world/geography.ts` (revision 12,
`GEOGRAPHY_VERSION` bumped, saved coordinates migrated the way the other shifts migrate them), mostly west. Every
birches literal (layout, walk, heaps, log, swing tree, scarf snags and perches, `BIRCH_RISE`, `BIRCH_HOLLOW`, the
berth, absolute z tests in the story such as `boat.position.z < -1175`, and the `toBirches` and `toStairs` routes)
is expressed through the bands and the shift. Geography is tight on this line (the meadow's north shore near
z −980, the stairs at (100, −1236), the drowned village's south tip near (−10, −1265)), and moving west opens room
on both sides, because both neighbouring ellipses narrow away from x ≈ 0.

Constraints that choose the shift:
- `toStairs` is lengthened by distance alone: **boat speed stays exactly as it is** (Jeremy, 2026-10-15). It should
  last about **30 s** from push-off with no input (Jeremy found 50 s too much). Measured 2026-10-15 on `main`, no
  input: from the crossing's first waypoint (18, −1215) to the stairs chapter took 12.0 s over 55 m (≈4.6 m/s). The
  berth leg before it is about 28 m (≈6 s), so today's sail is about 18–20 s, and the target adds about 10 s
  (~45–50 m) of sea. The island grows north toward the stairs, so the shift has to cover that growth as well as add
  the extra sea.
- `toBirches` stays within ±15% of its current sailing time.
- The island stays clear of the meadow, the stairs' cloud deck and bank, and the drowned village's mist. Nothing
  becomes visible from a neighbouring room that is hidden now ("the player never sees the next island"), and the
  `toStairs` crossing still ends under the low cloud deck as it does now.

**As built (phase 1, 2026-10-15).** Measured before the change on the base commit and after it, with no input, in
shot mode (fixed 1/60 s steps):

| | before | after |
| --- | --- | --- |
| trees on the island | 147 | 146 (100 of today's kept exactly, 46 grown in the gaps) |
| `toBirches` from its first waypoint (`?chapter=toBirches`) | 15.22 s, 55.7 m | 15.47 s, 56.1 m (+1.6%) |
| `toBirches` from the meadow's far shore (boat put at `FAR_SHORE`) | 23.25 s, 75.7 m | 24.58 s, 85.5 m (+5.7%) |
| push-off at the berth (`push` beat) to the stairs chapter | 23.3 s | 29.4 s |
| boat moving off (`aboard`, `toStairs` begins) to the stairs chapter | 20.5 s, 85.5 m | 26.5 s, 120.6 m |
| `toStairs` from its first waypoint (`?chapter=toStairs`) | 13.5 s, 58.8 m | 21.1 s, 99.0 m |
| scarf | 1140 rows, 612.8 m of wool | 1180 rows, 651.0 m |
| litter field | 256 × 256 over 148 × 188 m | 214 × 332 over 124 × 244 m, the same cells |
| loose leaves | 192 × 192 (36,864) | 192 × 265 (50,880), the same per metre of walk |

Boat speed and the crossings' pace are untouched; only distance changed.

- **The mapping** (`world/birches-layout.ts`). `BIRCHES_CUTS` cuts the first-built island across its walk at band z
  −1080.95 (A, between the log's north end at −1080.6 and tangle 1's stop at −1081), −1101.5 (B, between perch 0's
  coil and perch 1's) and −1154 (C, past heap 2's edge at −1153.6 and perch 6's coil, before tangle 3's stop at
  −1157), opened 16, 16 and 24 m: C is the longest because round 3 is the biggest. No stop point moved.
  `BIRCHES_SHIFT` (revision 12, `world/geography.ts`) is (−136, −16): well west, out where the meadow's shore falls
  away, and 16 m north. Phase 1 chose (−40, +16) to keep the meadow hop short; after Jeremy's playtest the island
  moved out over open sea ("Moved out after the playtest" below). The shift and every opening are whole grass tiles
  (8 m) so each band keeps its own grass. The island's world ellipse (`ISLES.birches`, `BIRCHES_ISLE`) is centred at
  (−136, −1172), 48 × 108.
- **Terrain.** Every band's ground is exactly the first-built island's: the noise is read in band-local terms and, in
  a gap, eased from the band behind into the band ahead at full strength (`birchesNoise`); the broad shape (coast,
  dome, rise and hollow) is read through `birchesShape`, which eases across each cut over 30% of its gap either side,
  so the climb levels into a shelf through gaps A and B and the hollow's floor runs 24 m longer through gap C.
  `birchesFirstHeight` is the island as first built, for anything that must reproduce it.
- **Narrowing.** Within 25 m of the island's middle line nothing changes (every perch and snag tree stands inside
  it); beyond, over 8 m, the flanks steepen so the widest coast is 48 m out instead of 60 (`BIRCHES_NARROW`).
  Narrowing alone could not hold the count: the gaps open the island's widest, densest middle, and narrowing to the
  count would have made it a 72 m ridge with steep banks. So the wood also thins toward the shore
  (`OUTER_THINNING` 0.7, from 18 to 32 m off the walk), each tree by a draw of its own.
- **Trees.** Today's wood is replayed tree for tree (the same stream, the same rules, in band-local terms); a tree is
  kept where its band still stands above the tree line, clear of the stretched scarf runs and not thinned. The gaps
  grow their own, cell by cell from each cell's own numbers, by the same rules, and keep off the 30 m of ride each
  tangle is watched from. Perch trees keep their band-local yaw.
- **Ground patterns.** Grass blades, tufts, tall and short patches and the ground tint keep the patterns they were
  first grown with (`birchesPatternOffset` in `grassOffset`, as Still's do); a gap continues the band before it.
  The birches' grass crop and tint, the leaf-mould ground, the litter seed and the loose leaves' bounds read
  `birchesOut` (the island's own outline) instead of a world ellipse, and the drifts and stands of trees read their
  noise in band-local terms.
- **The scarf.** Its snags, perches and run points are band-local. Rows go evenly to a curve's spans, so the beach
  run is laid across gap A in spans no longer than its own and gets 40 more rows; the drape runs that cross B and C
  (now 41 and 34 m) stay within the length of today's other runs and keep their rows. Every tangle's wool lies
  exactly as first wound: its twist and folds follow the wound length (`wound`), its side is carried from the strip
  as first wound (`carry`), each grown run turns gradually to meet the next knot, and the first length is laid
  across as first wound so it meets perch 0 turned as it was. `gatherSeconds` is unchanged: the draw-in is 6% faster
  for 6% more wool. (The tuning comment's "135 m" was stale; the strip was 613 m.)
- **Crossings.** `toBirches` leaves the far shore already bearing west (`FAR_SHORE` + (−18, −22)) and sails straight
  across open sea, west-north-west, to a point 30 m off the landing (band (14, −1022)), then runs up the beach straight
  on. The meadow's shore falls away south behind it, and for the middle of the crossing there is only sea. On this
  crossing the island lies in its own mist (`tuning.world.birchesMist`, clear 90 m to hidden 150 m from the eye, as
  the wood and the boats do): with no input its beach first shows faintly at the frame's edge about halfway over
  (24 s of 47), the trees from about 30 s, and the mist lifts once they are ashore. The bank thins over two coast
  radii (`edge` 2, from 1.32), so its side never stands as a wall beside the island in the reveal's side view.
- **The meadow sail's camera** (`tuning.crossingCamera.arrivals.birches`, `IslandReveal` in `story/crossing.ts`). Jeremy:
  "It just stays behind the child and never does a cinematic reveal of the birches island until she gets off the
  boat." The sun sets in the north-west, so the island ahead is always backlit; looking into it from astern it was a
  silhouette in glare at the edge of the frame. Now, as it comes out of its mist (100 to 47 m of framed sailing left,
  about 30–36 s), the lens swings round from astern in one slow move (about 11 s, never above 10° a second) to the
  port side, 24 m off and 4 m up, anchored in the world rather than on the hull: the whole island stands beside the
  boat, gold crowns lit through from behind with the low sun over them and its path on the water, the beach and the
  scarf running up from the sand into the trees, the boat at a third. Portrait stands further round (0.35 rad), so
  the island rises behind the boat in the narrow frame. The child turns to look at it, and the lens gives it 0.3 of
  its gaze. Red Door comes in 3 s into the swing and rises with it ("Music" below). Over the last 29 m the lens rises and draws back into the birches' first view from the south (0.075 rad,
  28 m, the child's eye-line 6 m ahead), so the bow grounds into the room's own shot: before, the lens swung 45° round
  the boat in the five seconds after landing. Chosen by looking: front light is impossible from the approach, and the
  side view keeps the backlit gold against a bright sky while reading the island as a place. Still not right: in the
  birches' first shot the sail stands between the lens and the child for the few seconds she steps off the bow
  (unchanged; the walk's view from the south keeps it).
- **The stairs sail.** Jeremy: "the route that the boat takes to the stairs island needs to be taken a look at. The
  route now has the boat sailing literally across the shore line and the stairs island is not hidden in haze until
  the child gets closer. camera direction and haze are important to get just right." When the island moved out, the
  first waypoint came within the 22 m rounding radius of the berth, so the boat turned at once and ran about 35 m
  along the north-east beach in under 0.4 m of water. It now sails out north-east to band (44, −1228) before the turn
  (2 m of water from 34 m out), then east past (26, −1239) onto the knoll as before, under the cloud deck building
  from 150 m out. Push-off to landing is 49.4 s (45.8 before). The stairs lie in their own mist on the sail
  (`tuning.world.stairsMist`, clear 70 m to hidden 130 m, edge 2): hidden through the first two-thirds, a faint hump
  about 80 m out, then the stair climbing into the cloud. The lens rides behind the boat out of the birches, then from
  about halfway turns in one slow arc (`tuning.crossingCamera.arrivals.stairs`, an `IslandReveal`), lifting toward the
  stair as it comes out of the mist: in landscape from the starboard quarter, the boat at the left third and the
  stair rising to the right into the cloud; in portrait from astern, the stair rising behind the boat, its gaze held
  lower so the boat stays whole. Over the last 80 m it comes round low beside the hull onto the beach (world bearing
  −0.6, 14.5 m, 1.5 m up) and the stairs' own first view takes it from the south-west. Before, the lens rode astern
  with the island in view for half the sail and swung 60° round the boat in the last six seconds. Music unchanged
  (`village-music-browser-check sail`): Red Door fades 26–31 s after the push-off, 10 s of quiet in which the stairs
  come out of the mist, the stairs song at 41 s, 8.5 s before the landing.
- **Clearances.** Dry land runs from x −181 to −92 and z −1071 to −1270. The island's south shore is about 122 m of
  open water from the meadow's nearest shore (the landing beach 120 m; 76 at phase 1); the north waterline is 22 m
  short of the drowned village's ellipse (29 at phase 1, 67 before), open sea that the room partition gives to
  whichever room is nearer. The village and the meadow stay hidden from the birches and both crossings by that
  partition as before (checked in free-running stills; a held `hold=` frame redraws every room and shows them, so it
  cannot judge visibility).
- **Saves.** Revision 12 moves the child, bird and boat of `birches`, `toStairs` and old `drowned` saves that lie on
  or just off the old island (`geography-progress.ts`) through `birchesAt`; `drowned.ts` carries its old-save
  threshold with the island (`birchesZ(-1240)`).

**Moved out after the playtest (2026-10-16).** Jeremy found the meadow sail short and the island too close: "The
island is still so close by visually ... just move the birches out a bit", with the stairs room untouched and both
sails allowed to grow ("if both become 40 seconds or whatever"). The meadow's shore curves away south toward the
west, so the island moved out that way and a little north, until about 120 m of open water lies between the meadow's
nearest shore and the landing beach. The boat crosses straight, the meadow falling away behind before the birches
come out of their mist. The stairs sail grows with the distance; only its first waypoint, on the birches side, moved.
Measured with no input in shot mode (frames / 60) on the dev server:

| | phase 1 (−40, +16) | moved out (−136, −16) |
| --- | --- | --- |
| `toBirches` from the meadow's far shore (boat put at `FAR_SHORE`) | 25.08 s | 47.28 s (straight line 177 m) |
| push-off at the berth to the stairs chapter (`village-music-browser-check sail`) | 29.4 s | 45.8 s |
| open water, meadow shore to the island's south shore | 76 m | 122 m |

On the stairs sail Red Door fades 22.2–27.2 s after the push-off, the handoff is asked for at 29.1 s and ready at
36.9 s, the quiet is 10.0 s, and the stairs song starts at 37.2 s, 8.6 s before the landing; it fades over 3.0 s in
the white. The island still has 146 trees.

### The squirrel

A new creature, built the way the cat is: `src/creatures/squirrel.ts` (actions and mechanics) with
`src/creatures/squirrel/` (`body`, `shader`, `pose` drives in and bones out, `gait` planted paws, `voice`). It is
held to the bar of the owl and the clouds.

- **Look.** A red squirrel: rust-red back and tail, cream belly, prominent autumn ear tufts, dark bright eyes, and a
  tail as long as its body that it carries in an S. It is painted in the same light as the cat and the birches
  (shared `ATMO_GLSL`, the room's dusk, cloud shadows), never a toy.
- **Scale is cheated** (as background life may be). The world draws the child about 2× real (her face stands 2.1 m;
  the cygnet's eye 0.82 m), so the squirrel is scaled **3× real** (`tuning.squirrel.scale`), about 1.5× relative to
  the child. Sitting up it is about 0.6 m, three quarters of the cygnet's eye height. At 1.7× (the first build) it
  measured only 15 px tall in portrait at 15 m, the size of one litter leaf (orchestrator ruling, 2026-10-16).
  Heaps must be deep enough to bury it at this size (phases 4 and 5), and portrait round frames may come in closer
  than landscape ones.
- **Actions:** `sit` (upright, a nut in its forepaws, nibbling), `freeze`, `scold` (chitter with tail flicks),
  `bound` (the gallop with its tail streaming), `dive` (into leaves, ending `buried`), `buried` (under the litter
  with the tail tip out or in), `peek` (its head up out of the leaves and back down), `burst` (out of the leaves in a
  spray), `climb` (spiralling up or down a trunk), `perch` (on a branch, tail curled over its back), and `run-line`
  (along the scarf, paws planted on the wool).
- **Voice:** a chuck-chuck scold, a soft squeak when it bursts out, and claws on bark when it climbs, synthesised the
  way the cat's voice is. Other animals may be as loud as they like; the child and cygnet stay silent.
- **QA stage:** `play('squirrel:<action>')` on `?chapter=stage`, a `squirrel-yard` like `cat-yard`, and a
  `tools/squirrel-check.mjs` for stills and motion strips like `cat-check.mjs`.

### Heaps and where it hides

The wind never puts leaves back: a burst heap slumps lower and wider, and depth is carried downwind to wherever the
air ran out (`LitterField`). So the squirrel hides **where the leaves are now**, not where they were authored.

- Each round has an area and a set of authored heaps. `BIRCH_PILES` gains five: two for round 2 in gap B and
  three for round 3 up the hollow's west side in gap C. Each is banked against a birch, as every heap here is against
  something. Where they are and why: "As storyboarded" below.
- When the squirrel picks a hide, one small asynchronous readback of the litter field over the round's area (the
  engine's `Readback`, never a synchronous read and never every frame) finds the live depth. It takes the round's
  heaps that are still deep enough to bury it. If the player has already blown them flat, it uses the deepest drifts
  in the area instead.
- If nothing in the area is deep enough to bury it, it hides **behind a trunk**, peeking round, as real squirrels
  do. An updraft over it, or over the heap beside it, flushes it out just the same. The round never breaks and never
  waits for leaves that are gone.
- **Heaps yield only to updrafts.** Every heap in `BIRCH_PILES`, the squirrel's and the free-play ones, stands against
  gusts: within `heapGuardReach` (0.6 m) of its rim the litter is moved only by lift, from `heapLiftFrom` (1.0) and in
  full flood at `heapLiftFull` (1.7), `heapLiftTakes` (2.4) times as readily as a full gust takes the open floor
  (`LitterField.heaps`, the shader's `heaped`). A swipe flutters its top and lifts its loose leaves, and takes none of
  it. Lift builds with time spent circling (about 0.6 after a loop, 1.3 after two), so a heap holds through the first
  loop and a half and goes over the next half loop, in a whirl. A drift the squirrel lies in is guarded the same way
  (`AutumnBirches.guard`, `driftReach` round it).
- **The heaps hold until it is in.** Each round's heaps (`ROUNDS[i].heaps`) stand against all wind, updrafts included,
  from the start until the squirrel has gone into hiding in that round (in round 3, until its shuffle has settled)
  (`AutumnBirches.hold`, eased on and off over `holdEase`, 0.5 s). The litter field takes them as up to six held
  circles (`LitterField.holds`: centre, the heap's radius plus `holdReach`, and how firmly) and the leaves' mobility
  there is held at nothing, so the air stirs their tops and lifts a few loose leaves but takes none of the heap.
  Measured with real gestures, hard strokes and full-charge circles over the first heap from the boat, from landing
  and through the meeting, and over rounds 2 and 3 before it is in, leave every heap as it was (0.87–0.98 m).
- **Round 3's empty heaps stand.** From the shuffle until she leaps, the round's heaps it is not in (nor was found
  in) are held too (`BirchesSquirrel.emptyHeaps`). An updraft over one lifts its top in a whirl
  (`AutumnBirches.splash` at `emptySplash`, 1.1, as the lift there passes `heapLiftFrom`) and the heap stands; the
  real heap answers. So when it is found both wrong heaps are still standing to leap into. Round 2's wrong heap is
  not held and bursts apart under an updraft. Heaps after their round and the free-play heaps are otherwise never
  held, so the drift and trunk fallbacks only come into play for heaps taken after it is in.
- Round 1's heap is the one the squirrel is seen diving into, so its hide is never a choice.
- Diving in is a splash (`AutumnBirches.splash`): the loose leaves round it go up high and wide, lit against the low
  sun the round's lens looks into, with a crunching whumph (`BirchesFoley.leaves('dive')`), and none of the heap is
  taken, so it stays a whole mound to hide in. The meeting's dive, its first, is the biggest. A dash to hide ends
  `pounceFrom` (0.8 m) short of the hide, so it goes in with one pounce.
- Buried, its paws are `buryBelow` (0.45 m) under the leaves' top, so at 3.6 times life its back is about 0.2 m under
  and, tail in, it is hidden from every round's lens in both orientations.

### A round

- **Gating.** Rounds gate the walk the way tangles do (`toScarf`/`scarf`): the walk's next target is the next
  pending stop in route order, tangle or round. The child walks to a standing point at the edge of the heaps,
  crouches and peers, and turns her head to each heap the player bursts. The plane's home pulls in (as at a tangle)
  so it stays by the heaps.
- **Tells**, always present and never on a wrong heap. Every 2.5–4 s the right heap rustles, the tail pops up out of
  the leaves and waves with a chitter and its call marks (`Squirrel.tell`), and the heap shivers a little under it.
  Between tells the tail tip is out about half the time in round 1, a third in round 2 and a fifth in round 3. A peek
  at room distance is mostly lost in the leaves, so every tell is the tail; a peek is kept for the "nearly".
- **Finding is uncovering.** In the leaves it is found when the wind has actually taken enough of them off it: every
  `feelEvery` (0.25 s) one batched readback of the live depth over its back and `feelAcross` (0.35 m) round it, and
  once that is less than `uncovered` (0.3 m) over its paws, the red shows through. It starts (`freeze` with a squeak,
  sitting up in what is left of the leaves) for `startledFor` (0.4 s), then bursts out. Only an updraft takes the
  leaves off it: the litter under a column is thrown outward down the slope of its lift (`litterLiftThrow`) and
  whirled round with the circles, so the heap thins from the top. Measured with real circles over the right heap,
  the heap holds through the first loop and a half and it starts (`freeze`) after about two, out 2.5–3.5 s after the
  circling began, in every round; hard strokes across it take none of it. A column is wider than the gap between
  neighbouring heaps, so while circles are wound over one heap of the round, the others hold against it
  (`circleLinger`), and circles over another heap never uncover it.
  Behind a trunk there are no leaves to read, so there each rise of the updraft over it, or over the heap it stands
  behind, is counted (`liftWork`, `findWork`; circles wound over another heap count only there). A gust that only
  shaves the right heap makes it `peek`, as a "nearly", and a gust on a wrong heap makes the right one answer. A wrong
  heap bursts apart under an updraft in round 2, and in round 3 only its top whirls up.
- **Found.** `burst`, a beat of `sit` and `scold` facing the child, then `bound` to the next waypoint, glancing back
  once (an invitation to chase). The cygnet chases a few steps (its own errand, not a script) and the child
  `cheer`s, then follows.
- **The cygnet seeks too,** through its own mind and errands (`watch`, `peer`, `delve`, `shake`, `look-back`). It
  goes heap to heap. It is right about as often as chance, so it is a companion, not a solver.
- **A stalled player.** After `hintAfter` (7 s) without an updraft on the right heap, swiping or not, the cygnet goes
  and stands at the right heap, peering into it (the in-story hint, no fourth wall). After `inviteAfter` (12 s) the
  drawn updraft (the chapter's `coax`, the swirl the scarf's second tangle uses) turns over that heap, its loops most
  of the heap's width, plainer over 4 s. Swipes no longer put either off, since they cannot find it. Neither ever
  supplies wind.
- **Camera.** Each round has its own frame, like the tangles' frames: the child, the heaps and the squirrel's last
  sighting in view. It is lower and closer than the walking shot so the squirrel reads (about the swing's 14–17 m,
  storyboarded per round). Portrait stands further back on a longer lens, so its far heaps read nearly as large as its
  near ones. The lens never follows a dash to hide: it stays on her while she counts, and the squirrel goes off up
  the ride, small and far, and hides out of sight. Within a round the squirrel never goes out of frame mid-beat.
- **The camera highlights it, subtly.** The depth blur's focus settles on it along with her (`alsoSharp`, eased over
  about a second): at the meeting, through a round (its tells and its find), and at its perch while she works a
  tangle or swings. The lens gives it a low-weight glance (`glance`, 0.28 of the gaze, eased in and out over a second
  or two) as she comes up to it on its log and while it chatters at her there, when it is found and scolds her, as it runs on ahead to wait at the next
  tangle or the swing and while she walks up to it there, through its startle under the second tangle's coils, and at
  the goodbye. Never a pan, never otherwise inside a tangle's, a round's composition beyond the find, or the swing's
  own frame, and never on a tell: a look every few seconds would bob the lens.

### Between rounds

The squirrel's routes between rounds are authored paths (ground, trunks, and lengths of the scarf), like the cat's
routes. It leads, as the cat does: it runs on ahead of her and waits at the next tangle where the knot is, on or by
the knot's tree, in that tangle's frame in both orientations, while the tangle is worked, and never stands where the
tangle's gesture or camera needs to be. It is never needed off-screen and never seen to teleport. A resumed save
places it where that point of the story would have it.

**Counting.** Before round 2 it sets off to hide as the tangle's loop starts to lift, and when the loop is
free and it is not yet hidden, she counts (the `counting` beat, still the tangle's frame, the wind still the
player's). She watches it go for a moment (`countAfter`, 0.6 s), then turns her back on where it went,
three-quarters to the lens, and covers her eyes: both mittens over them, elbows out, head bowed a little, a dip at the
knees and a nod on every number (`countNod`, 1.3 a second) and her head rocking side to side (`Traveller.counting`).
The cygnet looks from where it went to her and back. After `countFor` (6 s) she drops her hands, turns round and
looks for it, her gaze sweeping across the way it went, for `lookRound` (1.2 s) or until it has gone to ground, but
never more than `lookRoundMost` (3 s), and sets off. The whole count is 7.6–9.6 s from the loop coming free, about
what the squirrel takes to hide: she sets off a second or two before it dives, 40 m up the ride, a few pixels in the
haze. Round 3 has no count: after the second tangle the squirrel runs on ahead and waits for her in plain view.

### The leap

After round 3, the child runs at the nearest heap in the hollow still deep enough to land in (found by the same readback;
a standing heap of the round before any drift, and round 3's empty heaps always stand), leaps
(`child.leap`, landing on her seat), the leaves go up all round her and the heap stands (`splash` at `leapSplash`,
1.4), so she sits in it, and she sits up as the cygnet's
head pops up beside her. Then they get up and walk on. If the hollow has been blown bare,
she runs through what is left kicking leaves up instead. The moment always happens in some form.

### As storyboarded (phase 4)

The data is `story/birches-rounds.ts` (rounds, frames, the leap, perches, paths and small resolvers) and
`world/birches.ts` (`BIRCH_PILES` 4–8, their bank trees `BANKS`, `ROUND_VIEWS` and `ROUND_VIEWS_TALL`), all in
band-local terms.
Every stop was staged through the player's lens with the real squirrel at 3×, in portrait 390×844 and landscape
1600×900. World figures below are for reading only.

**Frames.** Rounds 1 and 3 are watched from the south-east quarter, looking toward the low north-western sun (about
40° west of north at the room's dusk), so the light comes through the heaps and through anything thrown up; round 2
from the south, high enough that its near heap and a burst out of it stand well inside the frame. Portrait's field is
half as wide as landscape's (31° against 64°), so heaps stand one behind another along the view rather than side by
side: a near heap low in the frame, the child beside or beyond it, the far heaps beyond her. The target is 1.2 m above
the ground (portrait 0–1.3 m), and portrait stands further back on screens narrower than 390×844 (`frameShot`).

| round | | looks at (world) | from | back, up | lens |
| --- | --- | --- | --- | --- | --- |
| 1 | landscape | band (11.8, −1074.1), world (−124.2, −1090.1) | 40° (0.643, 0.766) | 10 m, 3 m | 1 |
| | portrait | band (11.5, −1075), world (−124.5, −1091) | 75° (0.966, 0.259) | 18, 5 | 1.25 |
| 2 | landscape | gap B 12.5 m in, x 5; world (−131.5, −1146.5) | 15° (0.259, 0.966) | 18, 6.5 | 1 |
| | portrait | gap B 13 m in, x 3; world (−133, −1146.5) | 65° (0.906, 0.423) | 20, 7.5 | 1.3 |
| 3 | landscape | gap C 11.37 m in, x −13.03; target 1.2 m up | 55° (0.819, 0.574) | 17, 5.5 | 1 |
| | portrait | gap C 12.52 m in, x −12.23; target 6 m up | 58° (0.85, 0.527) | 23, 4.5 | 0.7 |

Every portrait lens is eased by a spring in the chapter (`lensEase`), so it comes in and out like a dolly rather than
with the rig's quick start.

Gap-grown trees keep off each round's views in both orientations (3.5 m either side of the line from the look point
back 24 m; round 3's widens to 11.5 m at the look point, narrowing to the lens, since its heaps stand across the
view), as they already kept off the tangles' sightlines, and off every raked heap and a metre round it. Only the
heaps on the walk show in the walking frames.

**Round 1** (heap 0). She stops at the heap's south-west rim by the ride (band (6.4, −1073.2)). For the meeting the
squirrel sits on the fallen birch where it comes out of the heap's near flank, 0.68–0.88 of the way along it from the
ride end, and it dives from there into the heap's deep. Landscape looks from the south-east, low and 10 m back, so the
squirrel on the log's end is the near subject beside her with the heap between them; portrait looks from the east,
the squirrel nearest and the heap and her beyond it.

**Round 2** (gap B, heaps 4 and 5). One heap stands on each side of the ride on the shelf, north of where the first
perch tree's wool crosses the floor. The near heap is east (r 2.7, deep 4.8, its middle 3.8 m off the walk line),
banked against a birch on its east. The far heap is west (r 2.8, deep 4.8, 5.9 m off) at the foot of a birch behind
it. She stands between them on the ride. The squirrel is last seen where that wool meets the floor, running on
between the heaps.

**Round 3** (gap C, heaps 6, 7 and 8). Jeremy's ruling: the heaps are "roughly presented in front of her", not a
line leading away. She stands on the ride's west edge (gap C 11 m in, x −8) and the three heaps stand on an arc round
her to the west, side by side across her view: the left one (r 2.6) west-south-west of her at gap C 7.19 m in, x
−16.48; the middle one (r 2.8, a little nearer) west-north-west at 14.58 in, x −16.04; the right one (r 2.6)
north-north-west at 19.85 in, x −10.85. Centres are 8.8–9.3 m from her and 2 m of bare floor lies between rims, close
enough for one portrait frame to hold all three. Each is banked against a birch behind it from where she stands; the
middle one's (`HOLLOW_FAR_TREE`) is the birch the squirrel climbs to watch the leap. It waits for her between the left
heap and the middle one, a little toward her (`ROUNDS[2].shuffle`, gap C 10.91 in, x −14.66).

Both lenses stand behind her, a little to her left, so she stands between the middle heap and the right one and the
three are set out across the frame, left to right: every move of the shuffle is a bound or a hump across it.
Landscape is low (5.5 m over a target 1.2 m up, 17 m back) so the heaps stand up as mounds; from 7 m up they read as
flat patches. Portrait holds all three across its width at 390 × 844 from 23 m back on a wider lens (0.7), looking
over them into the gold so the heaps and her are in the lower half of the frame. Its target is 6 m up with the lens
4.5 m above that: the lift sets where the heaps sit in the frame, the height how steeply it looks down. The tangle 3
birch with its wool shows in the top right corner of landscape and at the right edge of wider portrait screens; the
strip crossing the hollow over heap 2 is behind both lenses.

**Heap 2 is not in round 3** (the plan had heap 2 plus two new heaps). The strip from perch 5 to perch 6 crosses the
hollow about 3 m up, right over heap 2, so every frame toward the light that holds heap 2 looks through the wool;
staged, it cut the child at chest height. The east half of gap C is tangle 3's sightline, so new heaps can only
stand on the west side. And no portrait direction holds heap 2 and the west side together except a reverse shot, an
orbit of 140–180° from the walking shot. Heap 2 stays the free-play heap she walks through just before the round.
The round-3 lenses stand north of that wool.

**The leap.** From her stand she runs at the nearest heap deep enough to land in that the lens shows, leaves the
ground at its rim and lands sitting a little way in. The left and right heaps are the near ones, so she runs across
the frame to one side, toward the low sun, and the leaves going up round her are backlit.

**Hides** sit in each heap's deep, 0.3 of its radius out on the side away from the lens (round 1: toward her).
Read back (`depthAt`) the leaves stand 0.73–0.82 m over them; the round heaps' middles 0.87–0.97 m.

**Banks** (`BANKS`) are placed birches beside the gaps' heaps, one behind each of round 3's from where she stands;
the middle one's is the one the squirrel watches the leap from. They are placed rather than
grown, so a heap never loses its tree; a tree grown within 1.6 m of one gives way to it. The island has 144 trees.

**The squirrel's places** (`MEETING`, `TANGLE_PERCHES`, `SWING_PERCH`, `FAR_TRUNK`, `GOODBYE`):

- The meeting: sitting up on the fallen birch's end, out past the heap, red on the white bark and the bare ground
  there. By the heap's flank it was lost in the gold. Sitting up it is about 80 px tall in landscape at (0.62, 0.72)
  of the frame, and 31 px in portrait at (0.44, 0.62).
- Tangle 1: sitting up on the branch the loop hangs from (`FORK_BRANCH`, shared with the world and the cloth), 0.4 of
  the way out from the trunk: just beside the loop, against the haze beyond it rather than the red wool. Tangle 1 is
  looked at from further west than the other tangles and closer (18 m, 3 m up), so the near crowns no longer hang in
  front of the loop; portrait comes further round (bearing −0.45), leans toward the knot and takes a slightly longer
  lens (1.25).
- Tangle 2: on the broken birch's top. The coils rise round it toward 0.85 m above the top, at least 1.15 m out, and
  slide off east. Between 0.42 and 0.8 of the way to free (`SCARF_OVER`) they close in over the top, covering it a
  moment; it `startle`s as they reach it and turns `indignant` at the wool once they have slid off, finishing its
  scold before it goes to hide. Portrait looks at this tangle from further east on a 1.3 lens, so the broken top
  with the squirrel on it and the child both hold the frame.
- Tangle 3: in landscape, 3.2 m up the birch east of the slipped loop, the way the loop is drawn, red on white bark
  against the sea (`TANGLE_3_WIDE`, about 35 px); portrait's narrow view holds only the birch standing behind the loop,
  4.5 m up, above and beyond the work (about 11 px).
- Tangle 4: 5 m up the bow's own birch, above its low limb.
- The swing: 3.4 m up the swing tree's trunk, just under the limb, on the side toward the swing's lens, where its red
  reads on the white bark. Out on the limb it sat in the sun's glow against the gold and was lost.
- After round 3: 3.6 m up the birch behind round 3's middle heap, in view through the leap. From the left or middle
  heap it runs there round behind the gap between the left heap and the middle one, from the right heap behind the gap
  between it and the middle one (`toFarTrunk`, `toFarTrunkRight`), never across a standing heap.
- The goodbye: the berth's beach is sand below the tree line all the way up to the wood, so no branch reaches it. The
  squirrel comes down the beach after them and sits up at the water's edge beside the boat, in the departure frame.

In these places it measures 24–61 px tall in landscape and 13–31 px in portrait.

**Its ways** (`PATHS`) are steps on the ground, up and down bark and along wool, resolved against the trees as grown
(`route`, `AutumnBirches.trunkAt`). After tangle 1 the first length falls
as cloth, so the squirrel climbs the first perch tree to its coil at 9.2 m and runs down the length that stays tied
from there to the floor of gap B. The wool points are sampled from the strip at rest. After round 3 it stays in the
trees in the sense that it waits up a trunk at each stop. Between trees it comes down and crosses the floor quickly,
because the wool there lies on the ground and nothing runs high.

**Heaps (phase 5a).** In the storyboard the floor was one even gold carpet: a heap was a few big leaf cards
standing up out of it. Now each round heap is a raked mound, judged in every round frame in both orientations:

- *Raked* heaps (`BIRCH_PILES` 0 and 4–8, `raked: true`) are laid as a mound as steep as the litter field lets leaves
  stand (`litterRepose`), rounded over the top (`heapCrown`), so the field keeps them as laid; they stand about
  0.9 m, their foot near `r` (`heapFoot`). The floor round each is raked thin in streaks toward it for `heapRaked`
  past its radius, so its foot stands on bare earth. The wind's behaviour is untouched: a gust bursts a heap as
  before and nothing rebuilds it. The free-play heaps 1–3 keep their swells.
- The litter reads its heap's shape (`HEAP_GLSL` in `fx/leaves.ts`): a leaf on a heap is lit by the heap's surface,
  so the side away from the low sun is in the heap's own shade, warm amber under the sky, with the crest catching
  the light; the floor at a heap's foot is shaded by it and darker in the hollow there. Floor away from heaps is
  lit exactly as before (one look toward the sun skips the rest).
- Every heap has a *skin* (a layer `heapSkin` thick of small leaves laid every which way over its surface, thinning
  toward the foot) and a *body* under it (a solid sheet `heapCore` below the surface). Both follow the live field
  within reach of each heap, so a burst heap's remains are drawn the same way. The body is what hides anything
  buried: the squirrel set `buryDepth` under the surface (`buryBelow` 0.38 m: its back 0.2 m under, its tail's tip
  0.21 m out) shows nothing in any round frame tail in, and only its tail's tip tail out. Hidden needs at least
  about 0.26 m of leaves (`burySoil`).
- Loose leaves: nearly a third start in the heaps, shared by area with the raked ones weighted half again, and a
  leaf lying in a heap is never moved round the walker, so each round heap still holds about 1,400–1,700 when she
  reaches it. A squirrel's burst (strength 1) throws about 650 into the air at round 3 (`burstReach`,
  `burstReachPer`); harder than 1 throws them faster and higher. A swipe across a heap throws a backlit cloud.
- The seam: `AutumnBirches.depthAt(points)` (metres of leaves over the ground, one batched `Readback` of up to 64
  points a frame), `burst(x, z, strength)` (1 the squirrel bursting out, about 1.6 the leap) and `shiver(x, z,
  strength)` (the loose leaves go up and none of the heap is taken: a dive, a peek or a tell, so a heap the squirrel
  lives in can shiver all afternoon and still hide it), and `buryDepth(x, z, depth)`. `squirrel.onLeaves` drives
  `burst` for a burst and `shiver` for the rest in `main.ts`, steps excepted.

### As built (phase 5b)

`story/birches-squirrel.ts` (`BirchesSquirrel`, the chapter's `squirrel`) plays the game; `story/birches.ts` gates
the walk on it; knobs are `tuning.birches.squirrel`; `tools/squirrel-rounds-check.mjs` drives it with real strokes and
circles.

- **Its places.** Where the squirrel is follows from the story: rounds found, tangles freed, the swing ridden or
  passed, the leap done and the scarf gathered. When that changes it goes along `PATHS` from wherever it is (cutting
  in at the nearest point of the way if sent on early), and settles at the place's perch; a resumed save puts it
  there directly. Found, it sits up and scolds her (`sitFor`, `scoldFor`), bounds off, and glances back once a few
  metres on. It is shown only in the birches and its crossing, so it sees them off from the beach.
- **Hiding.** On ahead to round 2 it dashes (`dash`, 2.4 times its pace), setting off as the tangle's loop starts to
  lift free, while she counts at the freed tangle ("Counting" above); to round 3 it runs on and waits for her, and
  hides by shuffling (below). At the round's ground it reads the floor once (`depthAt`, its hides and a 5 × 5 grid): a heap still `buryDepth` deep
  (0.35 m), never the one just turned out of while there is another; else the deepest drift; else the bark of a
  heap's bank tree, round from the lens. Drift and trunk hides are only chosen where the round's lens shows them. It
  lies at `AutumnBirches.buryDepth` under the leaves' surface, under each heap's crest (0.1 of the radius past its
  middle from the lens) so the tail tip shows over the top. Turned out before she arrives, it hides again.
- **Tells and finding.** The tell is a `shiver` at 0.18 with a rustle; the tail is re-dealt at each tell by round
  (0.5, 0.33, 0.2); a fifth of tells are a peek. In the leaves it is found when an updraft has uncovered it ("A
  round"); behind a trunk each rise of the updraft over it counts (`liftWork`), and 0.35 (about two loops) flushes it. A child's
  random swipes take no heap and never find it; sloppy circles drawn round the right heap on the screen (off its
  middle, 0.04–0.12 screen heights, squashed, 0.6–1.4 s a loop) find it in 2–3 loops ("Heaps yield only to
  updrafts").
- **Her and the cygnet.** She walks round any heap between her and her stand rather than through it, kneels there
  (`kneel`) and turns to each heap the wind bursts; found, she gets up and cheers. The cygnet first stands beside her,
  then looks into heaps of its own choosing from the rim nearest her (`ROUNDS[].cygnet`), delving or peering and
  shaking off; at `hintAfter` it goes to the right heap's rim and peers; on a find it chases a few steps.
- **The leap.** One readback over round 3's heaps and ground picks the deepest leaves the round's lens shows; the
  cygnet goes in first; she
  runs and leaps (`Traveller.leap` with `seat`: she lands on her seat with no stumble), the leaves go up round her
  (`splash` at 1.4) and the heap stands, a little flattened where she sits (0.85 m to 0.65), she sits 1.8 s and gets
  up. Below `leapDepth` (0.35 m) she runs on through the hollow toward the sun, kicking leaves
  up. Measured 5–7.5 s.
- **Frames.** Landscape keeps phase 4's frames; portrait's are in the table above. The meeting and the goodbye get
  `shot.attention` at `glance` (0.28).
- **Sound.** `BirchesFoley.leaves`: a rustle for each tell, a burst when it is turned out and when the wind throws a
  wrong heap up, and the leap's burst with a thump under it. Heard just before the leaves go up, each stands for the
  scuff that `burst` would otherwise make.

### Verification (phase 6)

Judged in real-gesture clips of the whole room, from the `toBirches` arrival to the stairs landing, in landscape
1600×900 and portrait 390×844, with an engaged player and a careless one.

- **The meeting** is played in round 1's frame. She comes up to the heap and stands looking at it while the frame
  eases in (`meetPause`, 1.4 s); then it sees her and freezes (`meetFreeze`, 0.5 s), sits up chattering at her for
  `meetHold` (1.8 s) while the cygnet watches it, and dives. The walking shot glances at it on its log from
  `meetGlance` (30 m) away.
- **The wind lands among what the lens shows** (`pointerReach`, the wind contract): strokes at the canopy on the
  walk and circles round the wool at a tangle used to land on the next round's heaps 25–57 m from the lens and flatten
  them before she got there.
- **A sprint, not a film run fast.** The squirrel bounds at most 5.5 times a second (`squirrel/gait.ts`): faster than
  its own pace it reaches further each bound and is down for less of it. At its own pace nothing changes.
- **The tail tip**, out, is 15–45 px tall over its heap in every round frame in both orientations.
- **Portrait** frames hold the child whole with a margin on one modest lens. Sitting up the squirrel measures
  47 / 81, 36 / 75, 42, 31 px in landscape and 27 / 61, 30 / 43, 29, 23 px in portrait (by heap, near to far).
- **Time on the island**, engaged (the swing ridden, a wrong heap in round 2 and two in round 3): 3:52 in landscape
  and 3:53 in portrait. Random swipes took 5:36, a minute and a half of it circling tangle 2 into the right gesture.
  With the counting, an engaged landscape drive (the swing ridden about 19 s, wrong heaps first) took 3:38 (217.5 s);
  the count is within a second or two of the old wait at each tangle, so most of the difference is the drive.

### As built: the shuffle and the rounds polish (2026-10-16)

Jeremy's question about round 3 (above, "why the squirrel only hides in the third one") and the previous
verification's own list. Built on `birches-uplift-heaps`.

**Round 3 is the shuffle** (`BirchesSquirrel.wait`, `waiting`, `plan`, `shuffling`; knobs `tuning.birches.squirrel.shuffle*`).
- After the second tangle there is no count. The squirrel runs on ahead (`shuffleRunOn`) and sits up, nut in paws,
  between the near heap and the middle one on her side of them. She walks in and stands watching it; once she has
  stood `shuffleLook` (2 s) and the lens has all but come to rest on the round's frame (`framedBelow`, at most
  `shuffleLookMost` 7 s: portrait's longer lens settles slowly and the show must not start with a heap cut off), it
  sits up and chatters at her, and dives into a heap whose rim is within `shuffleNear` of it, in plain view, with the
  splash.
- One readback of the three heaps' depths, then a plan: three or four moves, each to the heap beside the one it is
  in, so it doubles back from either end; the last one or two are under the leaves. Over 600 plans it ends in the
  near, middle and far heap 23%, 52% and 25% of the time; round 2's hide is a free choice of its two heaps.
- A visible move: it rests (`shuffleRest`, 1.8 s after the first dive, shorter each time), bursts out toward the next
  heap with a squeak and a chatter whose call marks ride over it across, bounds over (`shufflePace`, quickening) and
  pounces in. Bursting out only pops the loose leaves (`shufflePop`) and the later dives splash less (`shuffleSplash`),
  so it is never lost in a cloud of its own leaves.
- A move under the leaves (`burrowFrom`, `burrowing`): it goes out of sight and a hump of litter travels from heap to
  heap (`AutumnBirches.burrow`: the floor, the heap skins and the heap bodies are raised in the shaders by
  `burrowRise` 0.75 m across `burrowReach` 1.3 m, eased up between the heaps; the field itself is not changed), the
  loose leaves popping over it every `burrowStirEvery` and a rustle every `burrowRustleEvery`, panned with it. It
  comes up under the next heap and rests there.
- It settles for `shuffleSettle` and lies hidden as in any round; the tells start, and from then on the wind may find
  it. Measured: 16–23 s from the dare to settled.
- Through all of it the heaps hold (`holdHeaps` until it is hidden), and a held heap is not scuffed by its burst out
  either, so every heap is whole when the shuffle settles. Measured with hard strokes and then two loops of circles
  over each of the three mid-shuffle: every depth as it was.
- She stands at her place and follows it with her head the whole way, the hump while it is under (`tracked`); the
  cygnet comes to her side and watches it too. The depth blur keeps it sharp. In both orientations every heap, the
  squirrel or its hump, and the whole child stay in frame from the dare to settled (checked a few times a second).
- **Wrong heaps answer.** Wind that bursts a heap it is not in (in any round, from the leaves) makes the right heap
  answer `answerAfter` (0.3 s) later with a tell: its tail stands up out of the leaves and waves with a chitter and call
  marks, and she turns to that heap for 1.6 s. Measured 0.75–0.85 s after the stroke began, at most every
  `answerEvery` (1.5 s).
- Found, it bounds round behind the heaps and up the birch behind the middle one; the leap goes to the nearest heap
  still deep enough to land in.

**Uncovering is generous.** Raked heaps are loose (`LitterField.heaps`, `tuning.birches.looseReach`, `looseLift`):
their leaves feel the strongest lift within 1.6 m as well as the air over them, and go 1.6 times as readily. Circles
over the right heap find it in two to three loops whatever their size, centre or pace; strokes never do (above).

**Spacing.** Round 3's heaps are 2 m apart at the rim. An updraft's column is wider than any spacing the frame allows
(5–9 m), so once circles over one heap of the round being played have wound the charge past `circleHoldFrom` (0.35,
well past what random swipes wind up), and for `circleLinger` (3 s) after, the round's other heaps hold against it.
The heap being circled is the one whose rim is nearest the column's middle, so circles drawn off a heap's middle
toward its neighbour still count as that heap. Measured with real circles half a radius off each heap's middle toward
each neighbour, a little too big: that heap goes to nothing in three loops and finds it, both others stand as they
were. Round 2's two heaps are
7 m apart.

**Frames** (the storyboard table above): round 2 is looked at from the south, high enough that the near heap and
its burst sit well inside the frame (portrait from the east along the two heaps, the near one whole at the frame's
foot); round 1 from the south-east, close and low, so the squirrel on the log is a clear subject beside her (about
80 px sitting in landscape, 56 before) and, in portrait, sits near the middle of the frame (0.44 across, 0.8–0.9
before). The meeting keeps her stop, her look, its freeze, chatter and call marks and the beat before the dive; the
cygnet now comes up beside her to look too. At each tangle where it waits on a perch, it chatters at her once as she
comes up to the knot.

**Tangles 1 and 3.** Tangle 1's frame already holds the squirrel on its branch at about 35 px in landscape and
20 px in portrait; closer lenses were tried and pushed the knot under the near crowns, so it is unchanged. Tangle 3's
landscape perch moved to the birch east of the slipped loop (35 px, 23 before).

**Her stance at tangle 1 (after the second playtest).** She walks on 3.5 m past the stop toward the knot
(`SNAGS_AT[0].nearer`), so she stands about 6.6 m from it rather than 10, and as she arrives she turns her whole body
to face it, feet stepping round, her head on the loop. The stop itself, which the walk, the lens and the grown wood's
sightline are judged from, is where it was, so the frame and the trees are unchanged; she stands nearer the middle of
it (landscape 0.43 across and 0.85 down, from 0.38 and 0.95; portrait 0.36 and 0.77, from 0.22 and 0.85). A perch with
a floor of its own (the branch) keeps it when the squirrel settles there at the end of its way: on the ground's floor
it sank off the branch to the ground a few seconds after greeting her.

**Leaving the broken birch (after the second playtest).** After tangle 2 the squirrel steps off the broken top onto
the trunk's south-west face, the side both orientations' lenses see, climbs down it head first, hops off at its foot
and runs round it into the hollow, every frame continuous (worst move 0.38 m in a frame, 4.1 m before). It keeps
the top as its floor until it is down off it: on the ground's floor it dropped to the foot in one frame. Its bark
steps on the broken birch are the scarf's own trunk (`birches.scarf.stump`); `trunkAt` only knows the grown trees,
and the nearest of them stands 4 m off, so it had been climbing that one, on the way up as well.

**The arrival.** The boat leaves the beach they landed on only once that beach has been out of the picture for a
second and she is 15 m up the ride (`afterCamera`), or whenever she is past the crest or resumes a save; measured, it
went about 19.5 s after landing, 1.5 s after the beach left the frame (before, 15 s after landing with the boat still in
view). In the first shot she steps off the bow behind the sail, so the sail gives way to all but 6% of itself where it
hangs between the lens and her (`tuning.birches.landingGivesWay`, `Boat.sailGivesWay`; 30% everywhere else). Turning
the first shot's bearing either way was tried: the sail stays between lens and bow from the south-east, and from the
south-west the lens loses the ride up into the trees, so the shot itself is unchanged and no later swing is added.

**Time on the island**, engaged (the swing ridden, one wrong heap in round 2, two in round 3, each tangle worked with
its gesture), landscape: 4:20 (259.9 s), from stepping ashore to the push-off.

**Not right yet.**
- Portrait round 3 is small: holding all three heaps across the frame sets its scale, so the squirrel sits up 27,
  22 and 25 px by heap at 900 × 1600 and 14, 12 and 13 at 390 × 844 (landscape 49, 41, 41). Its call marks carry it
  on each bound.
- Portrait tangle 3's squirrel is still about 11 px on the birch behind the loop.
- The shuffle's middle heap is its most common end (half the time).

### Saves

Each finished round is a checkpoint. The birches payload gains `squirrelRounds`, and point names gain the round
count: `squirrel<rounds>-scarf<tangles>`, with `-swing` once it is ridden. Saves made before this build infer the
rounds already walked past from their tangle count, swing and leg (a round comes before its tangle; the second
before the swing too), so a resumed player never repeats or skips a round's place on the walk.

### Autumn leaves on the stairs island

A dream echo Jeremy asked for (2026-10-15): gold birch leaves lying on the stairs island, as if the afternoon had
blown some of the birches after them. They join the swing's seat that already lies there (`world/echoes.ts`) and
follow the echo rules: scenery only, above the tide line and off the walk, and the camera never turns to them.

- A drift banked round the swing seat on the arrival beach, thinning into a scatter up the grass toward the foot of
  the stairs, with a few caught in the lee of the first steps. Few enough to read as a handful that came on the wind,
  not a second autumn.
- **Static and baked**, never simulated or blown: one instanced draw of flat, slightly curled leaf quads, using the
  birches' own leaf shape and tint (`LEAF_SHAPE_GLSL`, `LEAF_TINT_GLSL`), lying on the ground's height. They are lit
  by the stairs' light, so they are dimmer under the cloud than the birches' gold.
- They exist only while the stairs island is near, like the other echoes.

## Rules it keeps

- **Cursor movement is the only verb.** No taps, no holds. Blowing a heap is the whole of finding.
- **Nothing is lost or failed.** No wrong answer has a cost, and no timer solves a round. The invitation draws a
  gesture and never supplies wind.
- **No fourth wall.** The child looks at the heaps and the squirrel, never at the camera.
- **The cygnet never flies here** (`mayFly = false`), and its play stays its own.
- **The room's existing rulings stand** (chapters.md): the leaves don't behave like grass; the scarf reads as wool
  and its draw-in is unhurried; the swing is optional and rideable once.
- **The camera never jerks**; scenery gets glances, never a stop-the-world pan, and a dash to hide gets none.
- **Legibility:** the child, the cygnet and the squirrel are whole and readable in every round's frame, in portrait
  and landscape.

## Decisions and rejected alternatives

- Direction 2 (playful, Red Door) over direction 1 (piano, cinematic): the meadow before is already a reflective
  piano room and the stairs after are bedtime, so three serious rooms in a row would run straight into the dark
  part of the journey. chapters.md already rules "the room should be fun". (Jeremy agreed, 2026-10-15.)
- Squirrel, not the cygnet, hides: keeps the dark wood's hiding-and-finding unspent.
- Rounds gate the walk: an optional game would leave the island at 90 s for anyone who walks past it, and the
  generous finding and the invitation keep a gate kind.
- Hides follow live leaf depth with a trunk fallback, rather than heaps the wind can't touch: every gust has to do
  to the floor what it looks like it does.
- One squirrel and three rounds (1, 2, 3 heaps), not more: past three, a seek game becomes a chore. The time comes
  from the rounds plus the slower pace they bring to the walk.
- The island moves, rather than the stairs and everything after them, and rather than a winding crossing that
  would only fake the distance.
- The island grows, rather than staying at 145 m with the rounds squeezed in: frames would overlap stops (Jeremy,
  2026-10-15: "the birches island may be need to be made appropriately longer to accomodate this new content so it
  doesn't feel too cramped"). It grows by inserting gaps rather than scaling, so no tuned shape stretches. Side glades
  off the ride were rejected: the low camera under the canopy would look through trunks at them, and a layout that
  reads clearly from above becomes clutter at eye level.

## Verification

- Real-gesture playthroughs of the whole room in moving player cameras, portrait and landscape, including random
  swipes (a child's play), a player who blows every heap flat before reaching it, and a stalled player.
- Time on the island with an engaged player: 3½–4½ min.
- Resumed saves at every checkpoint, including saves made before this build.
- The `toStairs` crossing: its length, and the song handoff heard as a render (Red Door play-out or fade, the quiet
  gap, `birches.ogg`'s start, its fade into the white).
- Whole silhouettes and contact for the squirrel (skinned vertices against the rendered leaf floor and bark),
  child and cygnet in every beat. Pacing and feel are judged by watching clips, not by numeric gates alone.
