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

The walk, its heaps and tangles in order. The z values are today's; "gap" rows are the new stretches of wood
("The island moves and grows"):

| z today | What | Status |
| --- | --- | --- |
| −1052 | landing; the child looks up the ride, sets the cygnet down | as now |
| −1076 | **round 1** at heap 0 by the fallen log (`BIRCH_PILES[0]`) | new |
| gap A, ~15 m | open wood between the log and tangle 1, so round 1 and tangle 1 each have their own frame | new |
| −1081 / −1088 | tangle 1, lift a loop off a fork | as now |
| gap B, ~20 m | **round 2**, on the rise's lower slope, two new heaps at the corridor's sides | new |
| −1113 / −1118 | heap 1 at the swing tree's foot (free play, as now) and the swing (optional, once) | as now |
| −1132 / −1139 | tangle 2, circle the coils up | as now |
| gap C, ~20 m, in the hollow | **round 3**, heap 2 plus two new heaps in a longer hollow; then **the leap** | new |
| −1157 / −1163 | tangle 3, draw the slipped loop sideways | as now |
| −1172 | heap 3, free play as now | as now |
| −1176 / −1180 | tangle 4, the bow; the scarf gathers into the boat as its sail | as now |
| −1197 | berth; the squirrel watches them go | new glance |

1. **Meeting (round 1, one heap).** Walking up the ride, the frame takes in the fallen log. The squirrel sits up on it
   with a nut in its paws, ear tufts up. It sees them, freezes, then drops into the heap against the log (a puff of
   gold, then stillness). The cygnet goes straight for the heap. The child stops at the heap's edge, crouching and
   peering (the walk gates here, as at a tangle). A red tail tip sticks out of the leaves and twitches; the heap
   shivers with a rustle. Any gust over the heap bursts it. The squirrel explodes out in a spray of gold, sits up,
   scolds, flicks its tail, and dashes for the tangle-1 tree with the cygnet scrambling after it and the child
   laughing (`cheer`). One heap and an obvious tell, so the player learns it without being told.
2. **Tangle 1.** The squirrel sits on the fork above the loop, watching the work (background, never in the way). When
   the loop lifts free it runs off along the scarf through the canopy toward the clearing. The wool is its road, and
   the room's red line leads the eye on.
3. **Round 2 (two heaps).** It drops off a trunk into one of two heaps either side of the ride on the slope below
   the rise, out of the swing's frame.
   Now there is a choice. Only the right heap twitches; the tail shows less often. A wrong heap bursts into gold
   harmlessly (it's fun on its own), and the cygnet may rummage one and come up with nothing but a leaf on its head.
4. **The swing** (optional). The squirrel sits on the swing limb while she rides.
5. **Tangle 2.** The squirrel is up in the broken birch while the coils are circled off.
6. **Round 3, the hollow (three heaps).** The biggest round, where the leaves are deepest, and the tells are subtlest
   but always present. When it is found, the squirrel bounds up the far trunk of the hollow and stays in the canopy
   from here on. Then **the leap**: the cygnet dives into the deepest drift left in the hollow, and the child takes a
   run and jumps in after it, lands sitting in an explosion of leaves, and the two come up together covered in gold.
   This is the room's showpiece, the moment the child plays in the leaves herself.
7. **Tangles 3 and 4** as now, the squirrel a background presence in the trees above. **The goodbye:** as the boat
   pushes off, the squirrel is on a low branch over the berth, sitting up, watching them go (a glance, not a shot).

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
cell size. `LEAF_COUNT` stays as it is, because the loose leaves already concentrate near the walk. The scarf's
extra rows are the one real CPU increase. Jeremy profiles in another session (2026-10-15: "Don't worry about
measuring performance as part of this session... Just use common sense and try not to do silly things that would
impact performance"), so this build runs no benchmarks.

**The shift.** The grown island moves by a new `BIRCHES_SHIFT` in `world/geography.ts` (revision 12,
`GEOGRAPHY_VERSION` bumped, saved coordinates migrated the way the other shifts migrate them), mostly west. Every
birches literal (layout, walk, heaps, log, swing tree, scarf snags and perches, `BIRCH_RISE`, `BIRCH_HOLLOW`, the
berth, absolute z tests in the story such as `boat.position.z < -1175`, and the `toBirches` and `toStairs` routes)
is expressed through the bands and the shift. Geography is tight on this line (the meadow's north shore near
z −980, the stairs at (100, −1236), the drowned village's south tip near (−10, −1265)), and moving west opens room
on both sides, because both neighbouring ellipses narrow away from x ≈ 0.

Constraints that choose the shift:
- `toStairs` lasts about **50 s** of sailing at ordinary speed with no input (measure the current crossing first and
  record it here).
- `toBirches` stays within ±15% of its current sailing time.
- The island stays clear of the meadow, the stairs' cloud deck and bank, and the drowned village's mist. Nothing
  becomes visible from a neighbouring room that is hidden now ("the player never sees the next island"), and the
  `toStairs` crossing still ends under the low cloud deck as it does now.

### The squirrel

A new creature, built the way the cat is: `src/creatures/squirrel.ts` (actions and mechanics) with
`src/creatures/squirrel/` (`body`, `shader`, `pose` drives in and bones out, `gait` planted paws, `voice`). It is
held to the bar of the owl and the clouds.

- **Look.** A red squirrel: rust-red back and tail, cream belly, prominent autumn ear tufts, dark bright eyes, and a
  tail as long as its body that it carries in an S. It is painted in the same light as the cat and the birches
  (shared `ATMO_GLSL`, the room's dusk, cloud shadows), never a toy.
- **Scale is cheated** (as background life may be): about 1.7× real. Head and body about 0.34 m, tail about 0.32 m,
  sitting-up height about 0.35 m. It has to read beside the cygnet at gameplay distance; the gate is in the plan.
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

- Each round has an area and a set of authored heaps. `BIRCH_PILES` gains four: two for round 2 in gap B and
  two for round 3 in the hollow. Each is banked against something, a trunk, root or stone, as every heap here is.
  Exact positions are settled in the storyboard phase.
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
- **Finding.** Wind on the hide is integrated as the trees' stripping is (energy plus speed above `gripSpeed`) over a
  generous radius, the heap's radius plus 1.5 m. One deliberate swipe across the heap, or two careless ones near it,
  is enough. A gust that only shaves the edge of the right heap makes it `peek`, as a "nearly". Wrong heaps simply
  burst.
- **Found.** `burst`, a beat of `sit` and `scold` facing the child, then `bound` to the next waypoint, glancing back
  once (an invitation to chase). The cygnet chases a few steps (its own errand, not a script) and the child
  `cheer`s, then follows.
- **The cygnet seeks too,** through its own mind and errands (`watch`, `peer`, `delve`, `shake`, `look-back`). It
  goes heap to heap. It is right about as often as chance, so it is a companion, not a solver.
- **A stalled player.** After 10 s without wind on the right heap, the cygnet goes and stands at the right heap,
  peering into it (the in-story hint, no fourth wall). After 18 s the standard drawn invitation (`invitationAt`)
  sweeps across that heap. Neither ever supplies wind.
- **Camera.** Each round has its own frame, like the tangles' frames: the child, the heaps and the squirrel's last
  sighting in view. It is lower and closer than the walking shot so the squirrel reads (about the swing's 14–17 m,
  storyboarded per round). Portrait is widened as the tangle shots are. Dashes between hides are followed by a
  low-weight glance (`focus`), never a pan away from the child, and the squirrel never goes out of frame mid-beat.

### Between rounds

The squirrel's routes between rounds are authored paths (ground, trunks, and lengths of the scarf), like the cat's
routes. It waits in sight at the next tangle's tree while that tangle is worked, and never stands where the
tangle's gesture or camera needs to be. It is never needed off-screen and never seen to teleport. A resumed save
places it where that point of the story would have it.

### The leap

After round 3, the child runs at the deepest live drift in the hollow (found by the same readback), leaps
(`child.leap`), lands sitting (`sitDown`), the leaves burst round her (a large `kick`), and she sits up and brushes
gold off as the cygnet's head pops up beside her. Then they get up and walk on. If the hollow has been blown bare,
she runs through what is left kicking leaves up instead. The moment always happens in some form.

### Saves

Each finished round is a checkpoint. The birches payload gains `squirrelRounds`, and point names gain the round
count. Saves made before this build infer the rounds already walked past from their leg and tangle count, so a
resumed player never repeats or skips a round's place on the walk.

## Rules it keeps

- **Cursor movement is the only verb.** No taps, no holds. Blowing a heap is the whole of finding.
- **Nothing is lost or failed.** No wrong answer has a cost, and no timer solves a round. The invitation draws a
  gesture and never supplies wind.
- **No fourth wall.** The child looks at the heaps and the squirrel, never at the camera.
- **The cygnet never flies here** (`mayFly = false`), and its play stays its own.
- **The room's existing rulings stand** (chapters.md): the leaves don't behave like grass; the scarf reads as wool
  and its draw-in is unhurried; the swing is optional and rideable once.
- **The camera never jerks**; scenery and dashes get glances, never a stop-the-world pan.
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
