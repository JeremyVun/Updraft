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
| gap C, 24 m, in the hollow | −1170 to −1194 | **round 3**, three new heaps up the hollow's west side; then **the leap** | new |
| −1157 / −1163 | −1197 / −1203 | tangle 3, draw the slipped loop sideways | as now |
| −1172 | −1212 | heap 3, free play as now | as now |
| −1176 / −1180 | −1216 / −1220 | tangle 4, the bow; the scarf gathers into the boat as its sail | as now |
| −1197 | −1237 | berth; the squirrel sits at the water's edge and watches them go | new glance |

1. **Meeting (round 1, one heap).** Walking up the ride, the frame takes in the fallen log. The squirrel sits up on it
   with a nut in its paws, ear tufts up. It sees them, freezes, then drops into the heap against the log (a puff of
   gold, then stillness). The cygnet goes straight for the heap. The child stops at the heap's edge, crouching and
   peering (the walk gates here, as at a tangle). A red tail tip sticks out of the leaves and twitches; the heap
   shivers with a rustle. Any gust over the heap bursts it. The squirrel explodes out in a spray of gold, sits up,
   scolds, flicks its tail, and dashes for the tangle-1 tree with the cygnet scrambling after it and the child
   laughing (`cheer`). One heap and an obvious tell, so the player learns it without being told.
2. **Tangle 1.** The squirrel sits up on the floor at the loop's foot beside the wool, watching the work (background,
   never in the way). As the loop lifts free it runs to the first perch tree, up to the coil there and down the
   wool into the next round. The wool is its road, and the room's red line leads the eye on. She sees it go, and
   they play hide-and-seek: she turns her back on where it went, covers her eyes and counts while it hides.
3. **Round 2 (two heaps).** It drops off a trunk into one of two heaps either side of the ride on the slope below
   the rise, out of the swing's frame.
   Now there is a choice. Only the right heap twitches; the tail shows less often. A wrong heap bursts into gold
   harmlessly (it's fun on its own), and the cygnet may rummage one and come up with nothing but a leaf on its head.
4. **The swing** (optional). The squirrel sits on the swing limb while she rides.
5. **Tangle 2.** The squirrel is up on the broken birch's top while the coils are circled off: they rise round it
   and slide off past it.
6. **Round 3, the hollow (three heaps).** The biggest round, where the leaves are deepest, and the tells are subtlest
   but always present. When it is found, the squirrel bounds up the far trunk of the hollow and stays in the canopy
   from here on. Then **the leap**: the cygnet dives into the deepest drift left in the hollow, and the child takes a
   run and jumps in after it, lands sitting in an explosion of leaves, and the two come up together covered in gold.
   This is the room's showpiece, the moment the child plays in the leaves herself.
7. **Tangles 3 and 4** as now, the squirrel a background presence in the trees above. **The goodbye:** as the boat
   pushes off, the squirrel has come down the beach after them and sits up at the water's edge beside the berth,
   watching them go (a glance, not a shot).

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
  with no input Red Door fades 8.7–13.7 s after the push-off and the song begins at 23.7 s, 5.7 s before the landing.
  A `toStairs` start never begins Red Door. Numbers and checks: build_plan.md phase 2 and the audio contract.

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
  `BIRCHES_SHIFT` (revision 12, `world/geography.ts`) is (−40, +16): west, and 16 m south so the meadow hop stays
  short. The shift and every opening are whole grass tiles (8 m) so each band keeps its own grass. The island's
  world ellipse (`ISLES.birches`, `BIRCHES_ISLE`) is centred at (−40, −1140), 48 × 108.
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
- **Crossings.** `toBirches` leaves the far shore already bearing west (`FAR_SHORE` + (−18, −22)) and runs up the
  landing straight on as before. `toStairs` leaves the berth as before (its first waypoint moves with the band),
  passes south of the village's edge at (26, −1239) and comes in to the stairs as before; it starts 140 m from the
  stairs, so the cloud deck builds over the crossing and the landing is under it as now.
- **Clearances.** Dry land runs from x −85 to 4 and z −1040 to −1238. The south waterline is about 70 m off the
  meadow's north shore (about 79 before); the north waterline is 29 m short of the drowned village's ellipse (67
  before), open sea that the room partition gives to whichever room is nearer. The village and the meadow stay
  hidden from the birches and both crossings by that partition as before (checked in free-running stills; a held
  `hold=` frame redraws every room and shows them, so it cannot judge visibility).
- **Saves.** Revision 12 moves the child, bird and boat of `birches`, `toStairs` and old `drowned` saves that lie on
  or just off the old island (`geography-progress.ts`) through `birchesAt`; `drowned.ts` carries its old-save
  threshold with the island (`birchesZ(-1240)`).

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
  do. A gust at it flushes it out just the same. The round never breaks and never waits for leaves that are gone.
- Round 1's heap is the one the squirrel is seen diving into, so its hide is never a choice.
- Diving in is a small, low kick (`AutumnBirches.kick` at a radius and strength that puffs leaves up round it without
  blowing a hole in its own heap; the builder sets them by eye).

### A round

- **Gating.** Rounds gate the walk the way tangles do (`toScarf`/`scarf`): the walk's next target is the next
  pending stop in route order, tangle or round. The child walks to a standing point at the edge of the heaps,
  crouches and peers, and turns her head to each heap the player bursts. The plane's home pulls in (as at a tangle)
  so it stays by the heaps.
- **Tells**, always present and never on a wrong heap. The right heap shivers every 2.5–4 s with a rustle panned to
  it. The tail tip is out about half the time in round 1, a third in round 2 and a fifth in round 3. Now and then a
  `peek`.
- **Finding.** The air over the hide's heap is measured as the trees' stripping measures it (energy plus speed above
  `gripSpeed`), and each rise of it counts, so it bursts out as the gust arrives, two glancing gusts add up and a
  gust dying away adds nothing. A stroke's air is 3.4 m wide or more, so one passing a metre or two outside the heap
  still reaches in. One deliberate swipe across the heap, or two careless ones near it, is enough; in the first round
  any gust over the heap is. A gust that only shaves the right heap makes it `peek`, as a "nearly". Wrong heaps
  simply burst.
- **Found.** `burst`, a beat of `sit` and `scold` facing the child, then `bound` to the next waypoint, glancing back
  once (an invitation to chase). The cygnet chases a few steps (its own errand, not a script) and the child
  `cheer`s, then follows.
- **The cygnet seeks too,** through its own mind and errands (`watch`, `peer`, `delve`, `shake`, `look-back`). It
  goes heap to heap. It is right about as often as chance, so it is a companion, not a solver.
- **A stalled player.** After 10 s without wind on the right heap, the cygnet goes and stands at the right heap,
  peering into it (the in-story hint, no fourth wall). After 18 s the standard drawn sweep (the chapter's
  `windInvitation`) crosses that heap. Neither ever supplies wind.
- **Camera.** Each round has its own frame, like the tangles' frames: the child, the heaps and the squirrel's last
  sighting in view. It is lower and closer than the walking shot so the squirrel reads (about the swing's 14–17 m,
  storyboarded per round). Portrait stands further back on a longer lens, so its far heaps read nearly as large as its
  near ones. The lens never follows a dash to hide: it stays on her while she counts, and the squirrel goes off up
  the ride, small and far, and hides out of sight. Within a round the squirrel never goes out of frame mid-beat.

### Between rounds

The squirrel's routes between rounds are authored paths (ground, trunks, and lengths of the scarf), like the cat's
routes. It waits in sight at the next tangle's tree while that tangle is worked, and never stands where the
tangle's gesture or camera needs to be. It is never needed off-screen and never seen to teleport. A resumed save
places it where that point of the story would have it.

**Counting.** Before rounds 2 and 3 it sets off to hide as the tangle's loop starts to lift, and when the loop is
free and it is not yet hidden, she counts (the `counting` beat, still the tangle's frame, the wind still the
player's). She watches it go for a moment (`countAfter`, 0.6 s), then turns her back on where it went,
three-quarters to the lens, and covers her eyes: both mittens over them, elbows out, head bowed a little, a dip at the
knees and a nod on every number (`countNod`, 1.3 a second) and her head rocking side to side (`Traveller.counting`).
The cygnet looks from where it went to her and back. After `countFor` (6 s) she drops her hands, turns round and
looks for it, her gaze sweeping across the way it went, for `lookRound` (1.2 s) or until it has gone to ground, but
never more than `lookRoundMost` (3 s), and sets off. The whole count is 7.6–9.6 s from the loop coming free, about
what the squirrel takes to hide: in round 3 it is under the leaves before she sets off; in round 2 she sets off a
second or two before it dives, 40 m up the ride, a few pixels in the haze.

### The leap

After round 3, the child runs at the deepest live drift in the hollow (found by the same readback), leaps
(`child.leap`, landing on her seat), the leaves burst round her (`burst` at 1.4), and she sits up as the cygnet's
head pops up beside her. Then they get up and walk on. If the hollow has been blown bare,
she runs through what is left kicking leaves up instead. The moment always happens in some form.

### As storyboarded (phase 4)

The data is `story/birches-rounds.ts` (rounds, frames, the leap, perches, paths and small resolvers) and
`world/birches.ts` (`BIRCH_PILES` 4–8, their bank trees `BANKS`, and `ROUND_VIEWS`), all in band-local terms.
Every stop was staged through the player's lens with the real squirrel at 3×, in portrait 390×844 and landscape
1600×900. World figures below are for reading only.

**Frames.** Each round is watched from the south-east quarter, looking toward the low north-western sun (about 40°
west of north at the room's dusk), so the light comes through the heaps and through anything thrown up. Each is a
small turn from the walking shot (16°, 56° and 34°), so the lens eases round rather than swinging. Portrait's field is
half as wide as landscape's (31° against 64°), so heaps stand one behind another along the view rather than side by
side: a near heap low in the frame, the child in the middle, the far heap beyond her and off to one side so she never
covers it. The target is 1.2 m above the ground (portrait 0.9–1 m), and portrait stands further back on screens
narrower than 390×844 (`frameShot`).

| round | | looks at | from | back, up | lens |
| --- | --- | --- | --- | --- | --- |
| 1 | landscape | band (8, −1074.6), world (−32, −1059) | (0.35, 0.94) | 14 m, 4 m | 1 |
| | portrait | band (9.6, −1074.1), world (−30.4, −1058.1) | (0.866, 0.5) | 20, 5 | 1.5 |
| 2 | landscape | gap B 13.8 m in, x 2.5; world (−37.5, −1115.3) | (0.866, 0.5) | 15, 3.4 | 1 |
| | portrait | gap B 13.6 m in, x 4.6; world (−35.4, −1115.1) | 65° (0.906, 0.423) | 14, 4.5 | 1.6 |
| 3 | landscape | gap C 14.6 m in, x −12.9; world (−52.9, −1184.6) | (0.616, 0.788) | 15, 4 | 1 |
| | portrait | gap C 13.8 m in, x −11.7; world (−51.7, −1183.8) | 45° (0.707, 0.707) | 18, 4.5 | 1.6 |

Portrait round 1 looks from further east than landscape so she, the heap and the squirrel on its log fit across
its narrow field. Every portrait lens is eased by a spring in the chapter (`lensEase`), so it comes in and out like
a dolly rather than with the rig's quick start.

Gap-grown trees keep off each round's view (3.5 m either side of the line from the look point back 20 m), as they
already kept off the tangles' sightlines. That took out one double trunk that stood at round 2's lens. Only the
heaps on the walk show in the walking frames; the tangle and swing frames are unchanged (checked before and after).

**Round 1** (heap 0, as built). She stops at the heap's south-west rim by the ride (band (6.4, −1073.2)). For the
meeting the squirrel sits on the fallen birch where it comes out of the heap's near flank, 0.68–0.88 of the way along
it from the ride end, where the round's frame shows it whole and clear of the heap in both orientations (at the far
rim the heap hid half of it), and it dives from there into the heap's deep.

**Round 2** (gap B, heaps 4 and 5). One heap stands on each side of the ride on the shelf, north of where the first
perch tree's wool crosses the floor. The near heap is east (r 2.7, deep 4.8, its middle 3.8 m off the walk line),
banked against a birch on its east. The far heap is west (r 2.8, deep 4.8, 5.9 m off) at the foot of a birch behind
it. She stands between them on the ride. The squirrel is last seen where that wool meets the floor, running on
between the heaps.

**Round 3** (gap C, heaps 6, 7 and 8). Three heaps stand in a line up the hollow's west side toward the sun: the near
one at the ride's edge (r 2.8, deep 5), the deep one (r 3, deep 5.4, the leap's) and the far one at the foot of the
far trunk (r 2.8, deep 5). She stands at the near heap's far side, 2.4 m west of the walk line.

**Heap 2 is not in round 3** (the plan had heap 2 plus two new heaps). The strip from perch 5 to perch 6 crosses the
hollow about 3 m up, right over heap 2, so every frame toward the light that holds heap 2 looks through the wool;
staged, it cut the child at chest height. The east half of gap C is tangle 3's sightline, so new heaps can only
stand on the west side. And no portrait direction holds heap 2 and the west side together except a reverse shot, an
orbit of 140–180° from the walking shot. Heap 2 stays the free-play heap she walks through just before the round.
The round-3 lens stands 4–6 m north of that wool.

**The leap.** From her stand she runs 2.8 m at heap 7, leaves the ground at its rim and lands sitting a little way
in (`LEAP`). She runs away from the lens toward the sun, so the burst is backlit.

**Hides** sit in each heap's deep, 0.3 of its radius out on the side away from the lens (round 1: toward her).
Read back (`depthAt`) the leaves stand 0.73–0.82 m over them; the round heaps' middles 0.87–0.97 m.

**Banks** (`BANKS`) are five birches 5.6–10.8 m off the walk line and at least 3 m from the wool. They are placed
rather than grown, so a heap never loses its tree; a tree grown within 1.6 m of one gives way to it. Two stand
exactly where gap-grown trees stood. The island still has 146 trees.

**The squirrel's places** (`MEETING`, `TANGLE_PERCHES`, `SWING_PERCH`, `FAR_TRUNK`, `GOODBYE`):

- Tangle 1: sitting up on the floor at the loop's foot, beside the wool. The fork (the first idea) is inside the
  thickest gold in the room: from tangle 1's lens the near trees' hanging leaves hide anything there in both
  orientations, while the red loop still shows through them.
- Tangle 2: on the broken birch's top. The coils rise round it to 0.85 m above the top, at least 1.15 m out, and slide
  off east, so they ring it without touching it; it is hidden in them for a moment.
- Tangle 3: 4.5 m up the birch standing behind the slipped loop, above and beyond the work.
- Tangle 4: 5 m up the bow's own birch, above its low limb.
- The swing: 3.4 m up the swing tree's trunk, just under the limb, on the side toward the swing's lens, where its red
  reads on the white bark. Out on the limb it sat in the sun's glow against the gold and was lost.
- After round 3: 3.6 m up the far trunk (the far heap's bank), in view through the leap.
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
the walk on it; knobs are `tuning.birches.squirrel`; `tools/squirrel-rounds-check.mjs` drives it with real strokes.

- **Its places.** Where the squirrel is follows from the story: rounds found, tangles freed, the swing ridden or
  passed, the leap done and the scarf gathered. When that changes it goes along `PATHS` from wherever it is (cutting
  in at the nearest point of the way if sent on early), and settles at the place's perch; a resumed save puts it
  there directly. Found, it sits up and scolds her (`sitFor`, `scoldFor`), bounds off, and glances back once a few
  metres on. It is shown only in the birches and its crossing, so it sees them off from the beach.
- **Hiding.** On ahead to hide it dashes (`dash`, 2.4 times its pace), setting off as the tangle's loop starts to
  lift free, while she counts at the freed tangle ("Counting" above). At the
  round's ground it reads the floor once (`depthAt`, its hides and a 5 × 5 grid): a heap still `buryDepth` deep
  (0.35 m), never the one just turned out of while there is another; else the deepest drift; else the bark of a
  heap's bank tree, round from the lens. Drift and trunk hides are only chosen where the round's lens shows them. It
  lies at `AutumnBirches.buryDepth` under the leaves' surface, under each heap's crest (0.1 of the radius past its
  middle from the lens) so the tail tip shows over the top. Turned out before she arrives, it hides again.
- **Tells and finding.** The tell is a `shiver` at 0.18 with a rustle; the tail is re-dealt at each tell by round
  (0.5, 0.33, 0.2); a fifth of tells are a peek. Each rise of the air over the heap counts; 0.12 flushes it in round
  1 and 0.25 after. Measured strokes: across a heap 0.3–0.6, along its rim 0.1–0.17, a metre outside it about 0.1.
  Round 3's heaps are told apart cleanly. In round 2 a hard stroke over the far heap also blows the near one (its air
  reaches there at 0.4–0.6), so it finds a squirrel in the near heap: generous, and what the leaves show. A child's
  random swipes found it in 1–25 strokes a round.
- **Her and the cygnet.** She walks round any heap between her and her stand rather than through it, kneels there
  (`kneel`) and turns to each heap the wind bursts; found, she gets up and cheers. The cygnet first stands beside her,
  then looks into heaps of its own choosing from the rim nearest her (`ROUNDS[].cygnet`), delving or peering and
  shaking off; at `hintAfter` it goes to the right heap's rim and peers; on a find it chases a few steps.
- **The leap.** One readback over round 3's heaps and ground picks the deepest leaves the round's lens shows; the
  cygnet goes in first; she
  runs and leaps (`Traveller.leap` with `seat`: she lands on her seat with no stumble), the leaves burst at 1.4, she
  sits 1.8 s and gets up. Below `leapDepth` (0.35 m) she runs on through the hollow toward the sun, kicking leaves
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
  eases in (`meetPause`, 1.4 s); then it sees her, freezes and drops in. The walking shot glances at it on its log
  from `meetGlance` (30 m) away. Sitting on the log it is 48 px tall in landscape and 36 px in portrait.
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
