# Build plan: path puzzles

Each room's puzzle gets its own section. The design, Jeremy's words and every ruling are in [design.md](design.md);
this file only orders the work.

## The drowned village: the cat and the roofs (prototype)

Design: the sections of design.md from "The whole room, from the beginning" on. Concept frames: `comps/drowned/` (a
guide; they still show the drained village, which is cut). The cat: `comps/cat/`; the fog `comps/fog/`; the run
`comps/run/`; the windmill `comps/mill/`; the village's look `comps/village/`. Branch `proto-drowned-roofs`, worktree
`/private/tmp/updraft-drowned-roofs`, based on main. Judged by Jeremy on its own; never merged without his approval.

Standing constraints for every phase:
- Cursor movement is the only verb: gusts push what is under the cursor, circles raise an updraft. No press-and-hold,
  no timing to hit, no fast reactions. Nothing fails; the dark creeps up while she waits and stops a little behind her.
- Every step is caused by the player's own act and visibly answers it. Nothing looks interactive that is not.
- Each puzzle step has the usual drawn invitation after idle seconds (`contracts/wind.md`) and its own safety valve
  (about 90 s with no progress), so nobody is stranded.
- The camera stays low near the water and never surveys from above; never jerks; no fourth wall (the child never looks
  to the camera for help). Upright phone compositions stack the way up the frame.
- Player-feel numbers go in `src/tuning.ts` (`tuning.drowned...`), not inline.
- Main's storm, lighthouse, plane snatch and landing are not changed beyond the trigger.
- Useful parts on other branches: `proto-drowned-smoke` (`src/world/drowned-smoke.ts`: `Billows`, `StormBank`; the
  gust front on the water `Water.gustFront`), the birches' `Swing` (`src/world/birches.ts`), `Boat.brushSail`, the
  little boats' bath rocking as the way to show which way something can tip.

Distances (main): see design.md. The air dies and the boat comes to rest where main's air dies, about (−9, −1398); the church
`SPIRE` is (14, −1436); the storm's trigger moves from `tuning.storm.startsFromShore` (210 m from `WOOD_LANDING`) to
her being back aboard at the nave, about 260 m from the beach, so main's storm timeline (light out at 23 s, about
130 m on, beside the lighthouse) still lands beside the lighthouse at `passageSpeed`.

### Phase 1: the village round the church, the boat at rest, and the dark
Owns: `src/world/drowned-way.ts` (the hand-laid route and `WAY` decks), `src/world/drowned.ts`, `src/world/drowned-dark.ts`,
`src/story/drowned.ts` (beats `still`, `becalmed`), `Boat.coastTo`, `tuning.drowned`.
Done: [x] (code `abd2608`..`2d72bd3`; look pass `2fbdd82`..`8741578`: the drain removed, the boat resting its stem on a
small cottage's slates, the dark rebuilt in layers with the water darkening under it). Left for a later look pass: the
dark still reads as dark boulders in stills rather than smoke; the light should deepen as it comes.

### The cat creature (parallel)
Owns: `src/creatures/cat.ts`, `src/creatures/cat/`, `src/story/cat-yard.ts`, `tools/cat-check.mjs` on branch
`proto-drowned-cat` (worktree `/private/tmp/updraft-drowned-cat`). First build merged into `proto-drowned-roofs`
(`faf9574`); its API is stable. Being rebuilt to the model sheet (Jeremy found the first face bug-eyed and the sit
swan-necked); the rebuild changes only its own files and is merged again when it lands.
Done: [x] (rebuilt, polished and its analysed voice merged).

### Phase 2: the stranded cat, and she goes after it
Owns: the wash-tub (floats, pushed by the wind field), the cat's beats in `src/story/drowned.ts` from the chimney to
the bow, the drift with the cat aboard (lens round to the side), the cat bolting onto the cottage roof as the dark
rises, and the child climbing out after it (`alight` onto the cottage's slates).
Seam: the cat API (`place`, `strand`, `hop`, `leap`, `run`, `rest`, `look`, `afraid`, `unease`, `mewing`, `curious`);
the dark's `rise` and `reach`; `WAY` decks.
Gate: a real-gesture check (`tools/drowned-roofs-check.mjs`, started here) carries the tub to the cat and back; idle
proves the breeze alone does nothing; stills.
Done: [x] (`44f5777`..`81aa993`). The cat's roof moved earlier along the drift (`CAT_HOUSE`, `CAT_HOLD`), so the cat
aboard gets its own drift of about 15 s before the air dies; its old roof stays as a plain neighbour
(`EAST_OF_STRAND`), and the generated village is laid out exactly as before, only left unbuilt on the cat's ground
(`onCatGround`). Phase 2b: the cat's cottage is sunk to its ridge with a gable-end chimney 9 m across from the hold, so
the cat on its pot sits low; the lens watches the tub from a fixed point off that gable end (`CAT_LENS`), where she
and the cat face each other across the frame (upright: behind her, on the side away from the slack sail); the cat sits
rather than crouches on its pot, pleads at a kitten's length every few seconds, chirrups landing aboard and yowls
once as it bolts; the boat's drift away up the open water once she is on the ridge is `BOAT_ADRIFT` (its last point a
placeholder for where it fetches up by the church). The tub (`src/world/wash-tub.ts`) is pushed by strokes across it on screen, not by the field (under the
low lens a stroke's own wind lands far beyond it; see `contracts/wind.md`). The beat lives in
`src/story/drowned-cat.ts` (`StrandedCat`), driven by the chapter. The strand's landing is a level line of slates
(`WAY.strandLanding`) and `WAY.strandSlope` is now the whole slope above it, because `alight` sets her down at a deck's
own height. Left for later: the cat still reads small on its pot (about 40 px at 1600 × 900) and at the gap, and upright
the cat at the bow is hidden behind her; the climb's lens looks on to the church with the dark behind it.

### The pieces already built (parallel branches)
- **The tree and the swing** (`proto-drowned-crossings`, `src/world/crossings/`, QA `?chapter=stage&gap=tree|swing|run`):
  polished and merged into this branch (`715b48a`). Placement: `TreeCrossing({root, rest, over, height}, {wait, stepOff,
  onward}, cast)`, root about 2.4 m behind the wall, its foot about 0.15 m under water, the tree about 10 m tall, the
  waterline at its foot kept in view (a slightly raised lens); `SwingCrossing({pivot, toward, rope}, {board, landing,
  onward}, cast)`, beside the cottage's gable end so the back-swing passes the house end, the old tree off the
  cottage's corner behind the back-swing and never between the lens and her, the landing's slope deck in
  `child.decks`. Copy the yard's `TREE_SOUNDS`/`SWING_SOUNDS` onto `onEvent`. Saves treat the tree as standing.
  Jeremy has not yet judged the new foley by ear.
- **The windmill** (`proto-drowned-mill`, worktree `/private/tmp/updraft-drowned-mill`): the piece on the QA stage
  (`?chapter=stage&gap=mill`, `src/story/mill-yard.ts`, `tools/mill-check.mjs`, `tuning.crossings.mill`), her walk onto
  the sail and the ride first. Done: [ ]
- **The sea fog, pass 2** (`proto-drowned-fog`, worktree `/private/tmp/updraft-drowned-fog`): the billowed near face,
  the gold crest, no hard edge at the far stage, the bank well away at first, the light draining over the whole
  approach; every other room pixel-identical. Done: [ ]

### Phase 3a: the village re-laid
Owns: `src/world/drowned-way.ts`, the layout parts of `src/world/drowned.ts` (`layout`, `PLACED`, `CLEARINGS`, the
church), `tools/drowned-roofs-check.mjs` (extended to walk the way).
- The church (spire, nave, tower, vane, belfry, ivy) moves about 120 m on to stand near the lighthouse, about
  (10, −1560) per `comps/run/route-plan.png`; its old site becomes ordinary roofs. `SPIRE`'s users (camera aims, the
  heron and vane answers, the storm) follow it.
- The village takes the shape in `comps/village/` (lanes, rows and clusters, a green, outlying farms, water between
  them; denser off the way and toward the horizon on every side, the near water open). The generated village's
  random draws stay stable: build and throw away, never reorder the draws in `PLACED`/`CLEARINGS`.
- Her way, about 165 m from the strand to the nave, laid as `WAY` decks per `route-plan.png` (north up): the climb
  out at the cottage, the tree's lane and walled garden, her own way (ridges, wall copings, a lean-to, small hops), the
  windmill's site (a roof edge level with a sail, the mill, the high roof beyond), her own way again, the green with
  the swing at the garden cottage's gable end, the nave. Only hand-placed roofs, walls and copings where the way needs
  them; never a corridor or a single line of houses.
- The dead tree the boat fetches up against near the church; `BOAT_ADRIFT` ends there. `DARK_WAY` runs along the
  new way.
- The pieces placed as stand-ins at their sites (the tree and swing through their real classes; the mill as a block
  until 3b lands).
Gate: a QA walk of the decks end to end with no gap she cannot make; a high plan still for the orchestrator only
(never a player view) and eye-level stills compared with `comps/run/` and `comps/village/`; typecheck.
Done: [x] (`db4e299`). Her way is about 190 m of `WAY` decks (the drawn plan's gold line measures about the same),
walked deck to deck by `tools/drowned-way-check.mjs`; hops and the three pieces are `WAY_GAPS`, the pieces' places
`TREE_SITE`, `MILL_SITE` (heights in `MILL`, a stand-in mill until the windmill lands) and `SWING_SITE`, the cat's
own way over each gap `CAT_WAY`. The village's real `ToppleTree` and `RopeSwing` stand idle at their sites and the
crossings take them over when given them. The boat cannot cross her way, so it drifts west of it, round behind the
church to its dead tree (`BOAT_TREE`) east of the tower; at today's 0.3 m/s that drift takes minutes, so 3c sets its
pace. The generated village keeps its draws (`DRAWN_ROUND`) and leaves open water round her way, the boat's water,
the mill, the green and the churchyard (`inClearing`). Left: the walls round the way read as walls rather than
plots; the strand's slope lifts her onto its ridge 0.4 m early (Phase 2's, left as tuned); the becalmed lens's turn
to the church (`strandChurch`) and the climb lens still aim where the church stood; `drowned-camera-check.mjs` fails
on its cast lacking the cat, as it did before this phase.

### Phase 3b: the village's look
Owns: the house and prop pieces (a new module beside `drowned.ts`, built in the construction of home's cottage,
`src/world/cottage.ts`), their use in `drowned.ts`'s house builders, the generated village's growth outside
`inClearing` (through the throw-away filter, never changing the draws), the far village toward the horizon, and the
three touches. Look target: `comps/village/painted-*.png`, `painted-kit.png`, `painted-notes.md` (approved; design.md
"A whole village the sea has taken"). The houses on her way (`PLACED`) are restyled without changing their footprint,
ridge height or eaves; the mill, the green, the churchyard, her way and the boat's water stay clear.
Wave 1: the kit and the restyle of today's houses, judged by Jeremy in stills from the three `today-*` cameras.
Wave 2: the village's fuller shape (rows, huddles, the middle distance either side of her way, groups to the
horizon), the touches, the far village's cheap form.
Gate: stills beside `comps/village/painted-*` (arrival, the cat's roof, eye level, the run's views, the horizon); the
run's views of the church and lighthouse never crowded; one merged mesh as today; typecheck, `drowned-roofs-check`,
`drowned-way-check`.
Done: [x] The kit is `drowned-houses.ts` (a house is a `Lot` given to `buildHouse`; `mid` builds it on fewer stations,
`far` as a silhouette only). The fuller village is `drowned-shape.ts`: lanes, huddles and farms on a loose grid from
their own seeded streams, full in the middle distance from where she goes (the drift up to the strand, then her way),
a band of broad water, then far groups to the haze; `free` in `drowned.ts` keeps them off the drift, her way and the
clearings, the storm's way to the wood, the dark's way in from the south-east, the church and lighthouse and the sight
lines to them from the arrival, the strand, eye level and the high roof. The touches stand once each: the tall hat
beside the little pocket in the arrival's middle distance (`TALL_AND_TINY`), washing between two chimneys west of her
way (`WASHING_PAIR`), and her door under the water in the strand roof's gable end (`SUNK_DOOR`, drawn by the sea's
shader down through the surface). The low cap is a swelling skirt under a soft crown. Left: north of the church stays
thin (the storm's way and the sight lines behind the pair); the washing's cloths are backlit from every play view;
far houses have no form between `mid` and the silhouette.

### Phase 3c: the run
Owns: the child's walk over `WAY` following the cat from the strand to the nave, stopping at each piece; the cat's own
way over each gap (a railing top, a wall coping, a leap she could never make), always a roof ahead; the three pieces
wired in place (tree, mill, swing) with their invitations, safety valves and sounds; the fog's creep and hold behind
her (the story resets `close` to 0 when the run starts and drives `reach` along `DARK_WAY`, waiting a little behind
her at each piece and taking the place she left as she crosses); the run's camera (low and beside her, the fog on one
side of the frame and the church on the other, easing between pieces and never cutting; the climb-out lens turned so
the fog is in frame).
Seam: each piece reports done; the fog reads her progress; the boat's drift runs on its own clock to its dead tree.
Gate: the check plays from the air dying to the nave with real gestures; stills at each piece and between them,
landscape and upright; the run's time measured against the pacing (about 2 minutes).
Done: first wave [x] (branch `proto-drowned-run`). `RoofRun` (`src/story/drowned-run.ts`) walks her over `WAY` from the
strand's ridge to the tower's foot, the three crossings take over the village's tree, swing and mill (now the real
`Windmill`, its site re-laid from `tuning.crossings.mill` and `SAIL` through `railAt`: her wall runs out from in front of
the sails, the high roof's back comes down over a lean-to), the cat goes a roof ahead its own way and over each piece
first, the fog creeps along `DARK_WAY` (held 18 m behind her at a piece, 30 m on her own way, never nearer than 14 m),
and the boat is paced to fetch up at `BOAT_TREE` as she arrives. Chapter beats `run` and `nave`; `?chapter=roofs`
starts on the ridge after the cat. `tools/drowned-run-check.mjs` plays it with real gestures (`FROM=roofs` from the
ridge): 214 m of way in about 154 s, 90 s on foot and 63 s at the pieces. Left for the camera wave: the walking lens is
laid along her way at the start (`layLens`) and mostly keeps her in frame from behind her left, but off the high roof's
back and over the hairpin onto the long roof it loses her for a second or two (`LENS=1` makes the check fail on that),
it never shows the fog and the church together, and the boat drifting west crosses the tree's view; the becalmed turn
now looks to the moved church but the climb lens is unchanged; no upright pass. For Phase 4: at `nave` she stands at
`TOWER_FOOT` looking at the cat, which sits at the tower's south face at the foot of the ivy (`CAT_WAY.swing`'s end),
the fog is held behind her (`dark.reach`, and `close` is still 0 once the fog branch's `DarkBank` lands), the boat lies
against its tree with `coastTo` still set, and the swing is still the crossing's; the fog's hold distances need
retuning against the fog branch's heave and front.

Second wave, the run's camera [x] (branch `proto-drowned-lens`). The walking lens looks across her way between the
fog's body trailing behind her and the church (`views`), into the low sun, a little wider than the rest of the room
(`zoom`); where the two are too far apart to share the frame it holds the fog's flank on one side and the church or
the lighthouse on the other as the way allows. `layLens` lays it as the cheapest path through bearings, distances and
two heights that stays clear of every roof, wall, chimney and the mill's sails, never has her walking toward it, pays
for anything crowding the near half of its sightline and for turning between steps, and starts out from where each
piece's view leaves it; it is laid a little each frame from the start of the room (`prepare`). Her pace is fed
forward to the eased lens so it stands where it was laid. The tree's view stands off the east end of her ridge (the
boat's side is west) and comes round behind her, wide of and over the chimney, as she crosses; the mill's view comes
in along the high ridge so the church and lighthouse open beyond her; the swing's view hands over to the nave's three
metres past it. Upright, the walking lens stands straight behind her and its look is led too; the tree's, mill's and
swing's upright views are their own. The drift's first legs lie a little further west. With `LENS=1` the landscape
check holds with nothing hidden, nothing out of frame and the lens never inside a roof. Left: the climb-out lens is
unchanged (turning it east to bring the fog in hid her behind the cottage as she climbed: the fog lies south of the
cottage and she climbs its south slope northward, so it wants a different staging, for instance holding the becalmed
view looking toward the fog until she tops the ridge); upright still loses her for a second or two at the tall house
(about 55-65 m) and at the turn west near 160 m; a chimney still crowds the foreground in a few landscape moments; the
fog's feathered sheets show as jagged blue streaks where its flank comes into these side views (its look, not the
lens).

### Phase 4: the dark arrives, the boat, the storm
Owns: the cat up the tower's ivy to the belfry; the fog's `close` into the storm's night (the story's `dusk` and the
fog's drain from one progression, not stacked); `boat.coastTo` cleared before `brushSail`; the player filling the sail
to bring the boat from its dead tree to the nave; her stepping down (`board`) and her one look back at the cat; at
most a mew from the belfry; the storm's trigger moved to her being aboard at the nave, with the weather mostly gathered
at the start and main's beats re-timed for about 140 m to the beach (the lighthouse passed and going out soon after
she boards, the plane taken, rain, the landing).
Gate: the check plays through to the forest beach; `tools/storm-check.mjs`, `boat-check.mjs` and
`drowned-camera-check.mjs` fixtures updated to the new sequence.
Done: 4a [x] (branch `proto-drowned-board`), 4b [x] (branch `proto-drowned-storm`). `ChurchArrival` (`src/story/drowned-church.ts`, chapter beat
`church`, `?chapter=church` starts at the tower's foot): ivy up the tower's south face (`src/world/drowned-ivy.ts`,
`IVY`) and sills under the belfry's openings; the cat climbs it to the south sill (`BELFRY_SOUTH`) while she steps
back along the ridge, then backs through the belfry to the north sill (`BELFRY_NORTH`) as the fog comes; the fog's
front comes on to the tower's foot and `close` runs 0 to 1 (its body now thins over the first `fog.closedBy` of the
closing before its front runs on past the eye, so nobody stands in its thick body); the fog alone takes the light
(the story's dusk no longer rises with it) and the storm's night takes over from the fog's (`DarkBank.storm`); the
first wind swings the boat off its tree, the player fills its sail (`invitesSail`) to bring it round the tower's north
side (`BRING_WAY`) to `NAVE_BERTH` (safety valve: 90 s with no progress brings the world's breeze back to carry it),
she walks down the nave's north slates (`NAVE_NORTH`) and `board`s, and turns round on the thwart to look back at the
cat, which mews once. The storm (`gather`) now begins with her aboard (`startsFromShore` is gone), its weather from
`church.stormFrom` gathered, and the boat goes out by `AWAY` onto the channel's last leg. As it now falls (check, landscape):
the cat up 13 s after the tower's foot, the fog 16 s, the boat hers at 32 s, brought in 12 s of stroking, aboard 54 s;
from aboard 146 m to `WOOD_LANDING`; snatch at storm 22 s, 39 m from the beach; the light out at 23 s with the boat
114 m from the lighthouse (it is long past it, out of sight in the closed fog); landed 30 s after she is aboard. For
4b: main's beats need re-timing to this (the lighthouse is abeam about 55 m off as she boards; the light should go out
within the first few seconds, the plane be taken mid-way); the closed fog still covers the forest beach (`here` fades
200 to 320 m from the church); the storm's first seconds grey and brighten the frame (the squall's desaturation and
veil coming in before its night), worth judging; `storm-check`, `boat-check` and `drowned-camera-check` fixtures are
untouched and expect `startsFromShore`. For the camera wave: the run's shot still has `carry` on, so its lens is carried
by the drifting boat; the look back's cat reads small (about 20 px landscape).
4b as built: the storm goes out by `STORM_WAY` (`drowned-way.ts`): round into the open water north of the nave, on
past the lighthouse's side (nearest about 37 m) and down the channel's last leg, 173 m in all at `tuning.storm.speed`
(4.2 m/s, the hard-pressed sail), so it lands about 45 s after she is seated; the generated village and its trees keep
14 m off that way (`inClearing`), which took out one tree the lens used to pass through. The church's water view
(`waterFar`, `waterNear`) now stands off the nave's west end looking east, so the bring, the boarding and the look
back all hold the tower, the boat and the lighthouse; leaving, the lens keeps where it stood from her and aims between
the boat and the lighthouse's lamp (`backAcross`, `backUp`), and the light falters and goes out in that look back
(`lighthouseOutAt` 6.5 s, 57 m off) before the lens gives way to the storm's frame from 7 s; the cygnet startles and
nuzzles with it, and she watches the lighthouse, lit and then dark, until it is behind her shoulder
(`lighthouseWatched`); the spire look is the drift's only. Beats from her seated (check, landscape): foghorn 3 s (its
tail gone before the first thunder at about 19 s), light out 6.5, shake 14, first lightning 18, snatch 23 (89 m from
the beach, about mid-way), after 27, the plane gone 32, landed 45.7. The storm's night comes in over `darkBy` 22 s so
the frame only darkens from the look back (mean 55 at the look back, 20 by 12 s, 9-14 to the beach, lifting to 14 as
the forest comes up); the fog thins off from 90 to 25 m from the beach (`fog.shoreFrom`, `shoreGone`). Her step aboard
from the slates (`board(..., fromDeck)`, `Boat.takeWeight`) dips and rocks the hull and leaves it where it lies. The
stray A-frame in 4a's storm still was the paper plane seen from behind with its wingtip trails strung back 24 m to
the boat; the trails are capped at 7 m (`TRAIL_REACH`). `?chapter=storm` starts with her seated aboard at the berth.
Fixtures: `storm-check`, `storm-profile` (via `storm-fixture`) start from `?chapter=storm`; `boat-check`,
`drowned-camera-check` and `storm-camera-trace` sail the storm on a headless cast (`tools/lib/storm-cast.mjs`;
`drowned-camera-check` also drives the drift until the cat is seen); `drowned-run-check` reports the storm's beats and
the mean brightness each second, and fails if the light goes out with the lamp out of frame, the frame brightens past
the look back, jumps at the hand-off, or the landing comes 60 s or more after she is aboard (`FROM=storm` plays only
the storm). Left: the cat in the belfry reads about 10 px in the look back (the lens now holds the lighthouse too);
the turn past the lighthouse pans the lens at up to 17 deg/s for about 8 s; the storm from 10 to 30 s is dark and the
boat small in the frame at 15-20 s; the lighthouse stands clear above the closed fog's top rather than as a glow in it.

### Phase 4c: polish from the strand to the beach (two parallel parcels)
What the first full pass left, judged on the merged stills. Each parcel is visual, Opus, and checked by the run check
with `LENS=1` from `roofs` and `church`, landscape and upright.

- **Lens** (`src/story/drowned-run.ts`, the church's and the storm's lens in `drowned-church.ts` and `drowned.ts`,
  `tuning.drownedCamera`, the storm's camera numbers): the climb out of the boat sees the fog she is leaving (hold the
  becalmed view toward the fog until she tops the ridge, then hand to the tree's view, never a swing round the
  cottage); the cat in the belfry reads in the look back (today about 10 px); the storm's 10–20 s keeps the boat and
  its lantern legible (today very dark, the lens about 23 m off); upright never loses her (the tall house at 55–65 m,
  the westward turn near 160 m, the old tree's branches over the swing); no chimney fills the near frame; her glance
  back at the fog never turns her face to the lens.
- **Look** (`src/world/atmosphere.ts` sea fog, `drowned-dark.ts`, the church's build in `drowned.ts`, `drowned-houses.ts`,
  `drowned-shape.ts`): the fog's sheets seen side-on along its flank show as jagged blue vertical streaks, and its
  front makes a dark smoky smear beside the tower as it comes; the lighthouse reads as a glow through the closed fog,
  not a ghost tower standing clear of it; the church and its tower in home's cottage family like the houses (today a
  plain box); the village north of the church less thin, the washing not grey when backlit, a few far silhouettes
  that are not plain gables.

Done: lens [x] (branch `proto-drowned-polish-lens`), look [x] (branch `proto-drowned-polish-look`)

Look as built: the sea fog's front is met by a sightline from its front read at the eye and 160 m out along it, taken
as straight between and beyond (`LOOK`), so a sightline along it no longer reads a heave hundreds of metres off; its
swells and billows are read no further than 120 m off (`GRAZE`); its ends are integrated over a sightline's first
200 m (`seaFogFlank`) rather than sampled and cut; a grazing sightline crosses its soft front within 30 m (`EDGE`);
the sheets standing along the way it comes are gone and those across it show only to a sightline looking into it;
its billows are a soft mottle near the eye. Seen side-on it is one soft body. Closed round her its top rises 0.5 m
for each metre away (`fog.closedBowl`), so the lighthouse stands in it, and its lamp (now drawn through the weather)
glows in it (`fog.harbourHalo`, `harbourReach`) until it goes out. The church is limewash with dressed quoins, a
corbel table, arched belfry openings in proud surrounds, a numberless clock stopped at different hours north and
east, a bell-cast slate spire that turns a little as it rises with four gabled lights, and the nave built by the kit
on its exact slates with a wheel window in its west gable; masses, sills, ivy and decks unchanged. A second pass of
the fuller village from its own streams fills the broad water beyond the pair (`BEYOND_CHURCH`, `BACKDROP`) round the
storm's way out; nothing laid before it moves. The washing lets the low sun through (`drowned.clothThrough`). Far
off more houses are tall hats and the round keeper is a leaning-hatted turret. Draw calls unchanged (82 at the
drift's start); the village's merged mesh 150k to 166k triangles. Left: the fog closing at the church has no lit
crest (the sun is gone by then) and can still show a dark ragged patch at a frame's edge when a sightline grazes its
top; the fog's crest seen side-on reads as a darker top rather than the painting's lit rim.

Lens as built. The climb: when the cat bolts the strand's lens holds the view toward the dark (`strandDark`), side on
to the slope, so she climbs across the frame with the fog behind her; `strandClimb` is gone. Once she is up, the run
takes the lens from that near view round her over the open water where the boat lies to the tree's east view in one
move (`handOver`, `run.handFor` 16 s, standing `handOut` further out and `handUp` higher half-way so the sail and the
east chimney stay clear); from anywhere further than `handFar` (a QA start) the rig brings it in instead. Her looks on
the slope, the ridge and her own way (the fog, the cat, ahead) are turned until they are no further toward the lens than
`run.glanceOff` of straight away from it (`lookAwayFrom`), so her face never turns to it. The walking lens pays for a
chimney close in front of it (`chimneyNear`, `chimneyCone`, `chimneyCost`); overlapping piece views blend by weight
(the swing's going as the end's comes no longer jumps); upright it is drawn in less (`uprightInCost`), a little wider
(`uprightZoom`), and on her own way keeps her inside the narrow frame through the rig's 0.9 safety frame (subjects with
no drawing back). The look back: the near water view stands nearer, due west of the berth (`waterNear`; upright as
before, `uprightWaterNear`), and landscape first aims between her and the cat on the north sill (`backCat`) and goes
across to the boat and the lamp from `backLightFrom` to `backLightTo` as the light falters; the cat sits at the north
sill's west end (`BELFRY_NORTH`), so its face shows over the sill: about twice the size it was, the lighthouse, the
tower and her in the boat in one frame. The departure into the storm's frame now goes round her (eye blended about her,
`shot.carry` on from the start, `leaveFor` 9), the storm lens lets the lighthouse go once its light is out and comes in
to `lighthouseCamera.near` 12 m behind the boat over `inFor` 10 s, and takes the hull's turns critically damped
(`storm.lensTurn`): the lens never goes out past 18 m, the pan peaks at about 14 deg/s with no reversal, and the boat,
her and the lantern fill the dark 10 to 22 s. Checks (`LENS=1`): from the drift, `roofs` and `church`, landscape and
upright, nothing hidden, nothing out of frame, never inside a roof; `drowned-camera-check`, `storm-check`,
`crossings-check` pass. `FILM` now films from the air dying. Left: upright the look back is as before (the belfry and
the lamp cannot share the narrow frame) and its cat stays small; the cat in landscape is still only a face over the sill
(about 15-20 px), which is about as large as it can be with her and the cat in one frame; upright near the tall house
(55-65 m) the safety frame keeps her in but the lens is close and she sits at the frame's edge; a chimney still stands
beside her in a few landscape moments (just after the tree, about 25 m, and on the high cottage near 60 m), and the old
tree's boughs still cross the top of the upright swing view; the hand-over passes close by the cottage's east chimney as
it arrives at the tree.

### Phase 5: saves, docs and the look
Owns: checkpoints (a save during the run resumes at its start on the strand roof, the cat ahead, the fog risen and the
boat adrift as it was then; a save after she is aboard resumes aboard with the storm to come), `docs/chapters.md` drowned section,
`docs/contracts/world.md` where the village's pieces belong, a final set of stills (landscape and upright), a full play
from the stairs to the forest beach.
Gate: typecheck, build, the check from start to the beach; stills opened for review.
Done: [x] Saves: `sail` once the cat is aboard (resumes the drift with the cat at the bow), `roofs` from her setting off
(resumes on the strand's ridge through `skipToRun`; the restore starts in the climb's view, which the run hands over
from, `handFar` 22, rather than a far view the rig brought in through her at up to 340 deg/s), `church` from the tower's
foot (`skipToNave`), `storm` from her seated aboard (`skipToStorm`); all `[leg]`. `tools/progress-check.mjs` saves each
from real play, reloads and waits for it to play on (the becalming, 12 m of the run with the boat adrift, the fog
half closed, the plane taken). `tools/drowned-run-check.mjs FROM=stairs` docks the stairs with real strokes and plays
on through the room into the wood, a still at each moment, and reports the lens's fastest turn and move in the room;
upright, the hand-over from the climb now keeps her in the narrow frame (`uprightHandHold`; she left its edge for
3.5 s); the cat sits in the tub, ears flat, where crouched it was hidden by the tub's sides from every view. Docs:
`chapters.md`, `world.md`, `progress.md`, `journey.md`, `wind.md`, the project instructions, design.md.
Fixed after the final stills: down from the stairs their room goes while the boat is still in the white (Jeremy's
ruling in design.md, "Arriving"), so no flight stands in the sky behind the drift; at the church the lens goes round
the nave's west end from the cat's sitting on the sill (`roundFrom`), the climb view keeps her and the cat in one
frame (`climbAlong`, `climbZoom`), and upright the water view is wider rather than further off (`uprightWaterZoom`);
the fog's front eases to a stop 4 m short of her (`fog.past`; its old 40 m past the tower's foot was clamped there by
`darkWayPoint`, so it stood over her thick for six seconds) and thins round her as it arrives (`closeFrom` 6); seen
edge-on, the fog's face heaps with height (`fog.faceHeap`, a lean for grazing sightlines only, bounded so no
sightline turns from meeting it to leaving it) instead of standing as a straight wall. `drowned-run-check` with
`LENS=1` now also fails through the church if she leaves the frame, the church or a roof hides her, or she is lost in
the fog (her raincoat's warmth against what stands round her, every half second); on the old framing it failed (out
of frame 3.7 s at the cat's sill, lost 6 s in the fog). `drowned-gating-check` compares the arriving vane with the
wind it settles into (the moved spire's vane reads it to 0.05 rad; the step-by-step one hunts 0.04 the other side)
and after the storm only asks that every heron has left. `playthrough.mjs` plays the room with real gestures (the
tub, the tree, the mill, the swing, the bring) and fails if any of its safety valves fires. Left: the cat on the ivy
and on its pot reads small; the first seconds in the wood are near black with the sail cropped at the frame's foot;
upright the church's water views leave the lower half of the frame to empty water.

### The room rethought (Phases 6–10)
Design: design.md, "Jeremy's first play" and "The room rethought" (the spine, the shot list, the music). No concept
art: pieces are staged on the stage's yards and judged from stills. The base is `proto-drowned-roofs`; its village,
church, storm, saves and checks carry over. The interrupted cat-guide work is on `proto-drowned-catguide` (`8d39016f`,
uncommitted state saved as one commit), to take from where useful.

### Phase 6a: the two new crossings (parallel with 6b)
Owns: `src/world/crossings/` new pieces (the sheet on its line, the umbrella), their yards in `src/story/stage.ts`
(`?chapter=stage&gap=sheet|umbrella`), `tools/crossings-check.mjs`, their tuning under `tuning.crossings`.
Contract: each is a piece like `TreeCrossing`/`SwingCrossing`/`MillCrossing` (constructed with its site, a wait point,
a step-off and an onward point; `taken` when she is across; an invitation for a stalled player; a safety valve), with a
hook for the cat going first (`showFor(cat)` or similar: the cat's way across it and when it is clear for her). The
sheet: gusts across it fill it, and full it carries her holding on over a lane to a higher roof. The umbrella: she
opens it on a roof edge and the player's updraft (traced circles) lifts her over a gap to a higher roof; she floats,
never falls. Each takes her 1–3 m higher.
Gate: `crossings-check` for all pieces; stills of each yard from the shot list's interaction framing (her on the near
edge, the piece and the far side across the frame), landscape and upright.
Done: [x] the sheet (branch `proto-drowned-pieces`); the umbrella cut (design.md, step 5).
The sheet as built: `SheetCrossing(spot, {wait, stepOff, onward}, cast)` (`src/world/crossings/sheet-crossing.ts`) over
`WashSheet` (`wash-sheet.ts`): a line from `spot.from` (round her chimney, behind her on her ridge) to `spot.to` (the far
chimney's prop pulley), a 2.7 by 2.05 m cream sheet with a faded red hem on seven rings, a small mass-spring cloth
pinned to them. Strokes up the line across it on screen fill it a beat late (`tuning.crossings.sheet`: one firm stroke
about 0.7 full), back down only puff it back, a dying gust lets it sag and swing; full for `takeFor` she takes its
trailing edge at her face (the hood swallows anything held higher: `HANG` 1.93 m from mittens to feet, `UNDER` 0.33 m
behind them), and while it stays full it runs up the line with her hanging from it, legs paddling, turned toward the
lens (`turnToLens`), swinging under her hands as it starts and stops; slack, she hangs where she is; its rings bunch at
a knot `spot.stop` short of the pulley and she drops onto the high ridge, then goes on down the slates clear of the
bunched cloth. The child gained `hang` (legs leave the ground and paddle, no foot planting, no brace, no shadow). Cat
hook: `catWay(near, far)` gives the cat's steps (`CatStep`, `cat-way.ts`: hop onto the line, run it with the line's own
`floor`, hop down onto `far`), `catAt(p|null)` dips the line under it, and she will not take hold while `clear` is false.
The yard (`?chapter=stage&gap=sheet`, `&catless` for none; `src/story/sheet-yard.ts`) solves the line from where her
mittens are at the start and end of the ride (`lineThrough`): lane 4 m, the high ridge 1.3 m up, her chimney 2.4 m
behind the gable end, the far one 2.3 m past the far gable, each with a forked prop (the line clears her hood by about
9 cm where she waits). Low dusk side light from her side, the lens beside the lane (landscape), behind her near
shoulder (upright). `crossings-check` sheet, sheet-sag, sheet-wrong, sheet-stall, sheet-idle (valve) pass with feet on
a ridge or mittens within 0.1 m of the edge throughout. Left: upright framing crops her at the left edge and the far
roof barely shows, and takes far more strokes (about 29) because the sheet is small and steep on screen; hanging, she
still reads mostly from behind in landscape; after a gust the dying fill carries her on up to 2 m; the cat on the line
is small (the 6b cat will change it). The umbrella's look only (`umbrella.ts`, `Umbrella`: domed eight-rib canopy that
puffs with lift, crook, lying and held poses) is written and unwired; its crossing, yard and check are not built.

### Phase 6b: the cat (parallel with 6a)
Owns: `src/creatures/cat.ts`, `src/creatures/cat/`, `src/story/cat-yard.ts`, `tools/cat-check.mjs`, the wash-tub
(`src/world/wash-tub.ts`), kittens (new, in `src/creatures/cat/`).
Contract: the cat about knee-high to her (cheated); gaits and moves that read cat-quick (walk, trot, bolt, leap and
land, climb, ride, hop down); emotes for the story (frightened on the pot, shiver, press against her legs, staring at
the fog with ears back, curling round kittens, the slow blink, a mew); three kittens that tumble and nestle; the tub's
inside masked from the sea and steering readily, easing toward its target once near. The yard (`cat-yard.ts`) plays
every move and emote for stills.
Gate: `cat-check`; yard stills of every move and emote at game distance (the cat reads at the room's camera
distances, never rat-sized); the drowned run check still passing with the bigger cat.
Done: [x] (branch `proto-drowned-cat2`). The cat is `scale` 1.8: standing, its back is at her knee; sitting, its ears
reach the hem of her coat. It still sits on the village's pots (0.175 m rims, its haunches over the edge as a
perched cat's are), sits in the tub with its head and ears over the rim, and at the bow beside her.
- Moves, all on `Cat`: `run(path, floor, { pace: 'walk' | 'trot' | 'run', speed })` (a bolt is `run` at about 3.6 m/s
  after `afraid`); `leap` and `hop` (`gather` sets the wind-up; a hop well down leans out over the edge and looks before
  it drops); `climb(path, out, { frame, speed, gather })` for the ivy, a dead trunk or anything that moves; riding is
  `place`, `hop` or `leap` with `{ frame, upright: true }`, which keeps it upright in the world on a sail end or a
  swing seat while its paws stay on it. The head and ears lead every turn.
- Feelings: `strand(look)` (hunched, ears flat, mewing at `look`, and every few seconds it flinches and looks down at
  the water); `shiver` (0..1); `shake()` (the wet-cat twist, on straight legs); `stare(target)` (ears flat, low, head
  forward, tail tip twitching; null lets go); `press(legs, facing, floor, face, onDone)` (along her shins leaning in,
  tail up and hooked, back the other way, then sits at her feet looking up); `nuzzle(hand)` (head up into her hand,
  eyes shut); `rest('curl', look)` (curled on its side round `hollow(out)`, head tucked in unless it watches
  something); `slowBlink()`; `mew`, `yowl`, `chirrup` as before. Her side of the rescue needs no new child code:
  `child.kneeling = 1` and `child.reachFor(1, hand)`.
- Kittens: `Kittens` (`src/creatures/cat/kittens.ts`), three `Cat`s at 0.62 in a straw nest (`straw`, laid with
  `lay(at)`): `nestle(mother)` asleep curled in her hollow, `tumble()` pouncing, batting (`Cat.bat`) and bowling each
  other over (`Cat.topple`), `toSill(i, to, look, onDone)` one scampers over and hops up beside her. `heard` collects
  their pats and tiny mews for whoever plays them.
- The tub: a lid over its opening drawn into the hull's stencil bit (`INSIDE_HULL`), so the sea is never drawn inside
  it; strokes count from further off and lighter (`tuning.drowned.tub`); with `goal` set (the story sets it in
  `bringTo`) a stroke roughly that way is bent toward it once within `easeFrom`, and for `easeFor` seconds after a
  stroke it drifts on in by itself. Left alone it stays where it is.
- The yard (`?chapter=stage`, `play('cat:<name>')`; `yard.child = __game.child` first for `press`): sit, stand, crouch,
  wash, curious, mew, chirrup, afraid, strand, shiver, shake, stare, slow-blink, press, curl, kittens, tumble, sill,
  walk, trot, run, bolt, scared-run, rail, gap, hop-down, leap-pot, leap-boat, leap-roof, hop-tub, ride-tub, jump-boat
  (leap, shake, shiver), boat, tub, climb, climb-trunk, ride-sail, ride-swing. `cat-check` shoots them all.
Left: the rescue (shake, shiver, press, her kneel), the stare at the fog, the kittens and the slow blink are not yet
in the room's story (Phase 7).

### Phase 6b2: the cat in motion (after 6b)
Owns as 6b. 6b's stills read (size, slow blink, the tub dry inside) but motion was never judged, and Jeremy's note
was "the animations aren't on point". `tools/cat-check.mjs` gains a film mode: each action and feeling as a strip of
frames at 8–10 fps from its framing camera (near and at the room's distance), so the lead judges motion, not poses.
Then the motion is polished until each move reads as a real cat's: anticipation and weight before a leap, the
landing's give, the bolt's low stretch, the climb's reach and pull, the press's lean and tail, the shiver, the slow
blink's timing. The kittens read in the belfry's half light (lighter coats, one ginger, one with white socks, about a
third of her size) and the curl is a ring round them, not a loaf; the shake throws a little water.
Gate: `cat-check`; film strips of every action and feeling for the lead to judge.
Done: [x] (branch `proto-drowned-catmotion`). `FILM=1 node tools/cat-check.mjs <dir>` films every action and feeling
from its start until settled at 10 fps (`FPS`, `WINDOW=0.8-1.6` for a close look at a few frames), one contact strip
per action and view: `near` 4 m off with the cat filling most of the frame, `far` 12 m off through the game's lens cut
at full size; a first pass learns where the action goes, so the lens holds still or glides along with it. The kittens
are filmed in `half` light (`dusk=1.45`). All APIs of 6b stand; new: `new Cat({ coat, kitten })`, `Cat.voice`, the
`voice` on a heard mew (and `CatVoice.mew(..., voice)`), `Coat` in `cat/shader.ts`.
- Leaps: down low with its eyes on the far side, the hindquarters swaying as the back feet tread, the tail tip
  twitching, then a load (rump drops, chest lifts) and the spring; in the air it watches where it will land; front paws
  first, the shoulders and head take it, the weight carries on forward, the tail whips up. Hops get half the give.
- Gallop: the back gathers and stretches further and the head rides level; fear no longer flattens it to the roof at a
  gallop (it shows in the ears and tail). Trot: a lighter bounce, tail up and hooked. Climb: in surges, the hind legs
  driving it up while the front paws reach. Turns on the spot: the head goes first, the body a moment after; the tail
  swings out of every turn.
- Feelings: frightened and sitting it hunches and keeps glancing about; on its pot or adrift, the flinch starts it back
  with its ears pinned and then it stretches its neck to peer down at the water; riding, it keeps its head over the rim
  and an uneasy cat flinches at a lurch. Shiver: a fine tremor and a shudder every second or two. Slow blink: eyes
  narrow over 0.75 s, stay shut 0.8 s, open half way and soften over a second. Shake: head, then body, then tail, and
  drops thrown off the coat (`cat/spray.ts`). The press bends its body round her shin and hooks its tail tip after it.
  Shakes and tremors are laid over the eased pose (they were eased to a tenth of their size before).
- Kittens: a ginger, a grey with white socks to its knees, and a pale tabby, each lighter than her; heads 1.32 times a
  grown cat's; a wobble through everything they do; a longer wiggle before a pounce; each its own high mew (the yard
  passes their mews to hers to be heard). The mother's curl is a ring (bent further, rolled onto her side) with the
  kittens inside it against her belly.
Left: the far strips show the cat's motion only roughly (it is 40 px tall at 12 m); the shake's spray is faint in the
game's own light; the press reads best close to; the gallop is still lower and shorter in the leg than the model
sheet's soft gallop (its gather and stretch read at 30 fps, not at 10); riding the sail a hind leg falls 3 cm short
as the sail tips.

### Phase 6b3: the gallop as a bound (after 6b2; owns `src/creatures/cat.ts`, `src/creatures/cat/`, `tools/cat-check.mjs`)
The lead's review of 6b2's strips: leaps, the slow blink and the shake read; the gallop does not. At the room's
distance (the `far` strips, 12 m through the game's lens) the cat slides along the roof like a toy pulled on a string:
the back never rises clear of the roof, the legs barely open, and it is the cat's most-seen move (it runs ahead of her
at every crossing). Each stride must read at 12 m as a bound: the bunch (all four feet gathered under the belly, back
arched), the push, a moment with all four feet off the roof and the back lifted clear, the stretch (fore and hind legs
reaching apart), front feet down first. The scared run is the same bound, lower and longer. If the legs are too short
for any gallop to read, lengthen them a little, keeping the sit, curl, slow blink and tub silhouettes. Also: the
shake's spray lit and fogged like everything else in the room, so it reads in the game's light; a kitten's pounce
bowls its sibling over rather than landing inside it.
Gate: `cat-check` slip and reach no worse; `far` and `near` strips of run, bolt, scared-run and trot at 30 fps over a
second (`FPS=30 WINDOW=`) and at 10 fps whole, for the lead to judge; shake and tumble strips.
Done: [x] (branch `proto-drowned-gallop`). APIs of 6b and 6b2 stand; new: `Cat.flying`, `Cat.topple(from?)`.
- The bound is its own choreography (`cat/bound.ts`), phased from the hind paws touching down: the bunch (paws
  gathered under the belly, back arched, body low), the push (nose up, hind legs driving), a long flight with the body
  up to 8 cm higher at scale 1.8, the spine drawn out and the legs reaching flat out fore and aft, front paws down first
  with the nose dipping, then the hind paws swing up under it. The shoulders check over the front paws and surge on
  while the hips keep an even pace, so the trunk itself lengthens and bunches. Paws in the air follow body-relative
  reaches; planted paws stay where they were put. The legs draw out a fifth longer as it comes up to a gallop (a leg
  length drive on the rig), so the sit, curl, slow blink and tub keep the sheet's short legs. The neck gives against
  the body's rise, so the head travels about half as far as the body. At the room's 3 m/s a stride is about 1.1 m at
  2.7 a second, and at the top of its flight its back is about 0.4 m above the roof. Fear keeps the same bound lower, with a 12%
  longer stride, ears pinned and tail down.
- Every gait sets off from standing at its own moment in the cycle, and `place` forgets the last heading and pace, so a
  run's first strides are the same every time.
- The shake's drops are small clear balls shaded as the cat is (sun, sky, lantern) with a sun glint and the room's fog.
- Kittens: a pounce comes down with its front paws at the sibling's flank; the sibling holds still while stalked, goes
  over away from the pouncer as it lands and stays down a moment, and the pouncer pats it. Woken into play
  (`tumble()`), the first thing one does is pounce on the next.
Left: at 12 m the cat is about 40 px tall, so the bound reads most clearly at 30 fps; 10 fps samples its 2.7 Hz rhythm
unevenly, though every frame shows a distinct pose. At the moment of a pounce the kitten's big head presses into its
sibling's flank. The trot is unchanged (a short-legged patter). The narrow rail bound at 1.6 m/s runs at about 2 Hz
with the full flight and can look floaty.

### Phase 6c: the windmill as a sack hoist (after 6a; owns `src/world/crossings/windmill.ts`, `mill-crossing.ts`, `mill-spiral.ts`, the mill yard, `mill-check`)
design.md "The windmill, rebuilt": she rides a basket on the hoist, standing, the full height of the mill; the
circles turn big sails with weight and carry-on; creak, the rope winding on its drum, a ratchet that holds her; the
cat rides a sail up first. Gate: `mill-check` and `crossings-check` with real circles; yard stills and a recorded
clip of the turning watched for feel; how many circles and seconds the climb takes.
Also, the sheet (6a) as Jeremy will play it: in upright it took 29 strokes because the sheet is small and steep on
screen (count strokes by their sweep across the sheet in the world, not its size on screen); she turns her face to
the lens as she lands (no fourth wall: she looks where she is going or back at the fog); the dying gust carries her on
up to 2 m after the last stroke (stop sooner, so the player's stroke is what moves her).
Done: [x] (branch `proto-drowned-hoist`). The hoist as built: `MillCrossing(spot | Windmill, {wait, stepOff, onward},
cast, spiral?)` over `Windmill` (`windmill.ts`), phases `waiting`, `boarding`, `riding`, `leaving`, `over`. The mill is
laid in its own frame (x right seen from in front of the sails, z out of their front, the hub over the origin):
`MillSpot {hub (x, z), facing, from, to, reach?}`; `from` is the basket's floor at the bottom (her roof's edge), `to` at
the top (level with the hoist door's sill), and the tower is built to suit: the curb 3.4 m and the hub `HUB_ABOVE`
4.2 m over `to`, the tower 1.6 m in radius at the water and 1.3 under the cap, its middle 1.9 m behind the sails.
Four sails of `SAIL.reach` 7.3 m (lattice from 1.3 to 7.2 m out; `reach` shrinks them for a smaller site). The hoist
(`HOIST`): a beam out of a door on the tower's left at `to` + 2.95, a drum with a 12-tooth ratchet and pawl at its
root driven by a belt from the cap, the rope over a sheave at x -3.6, z -1.9 (behind the sails' plane, so the sweep
never comes near it) down to a 1 m slatted basket, open front and back, with a bar overhead at 2.45 m and a rope from
each end of it to the middle of each side; she walks in from her roof's edge in front of it (+z), turns to face back
the way she came and holds a rope in each mitten at her shoulders (1.45 m), and at the top walks out of the back (-z)
onto the high roof. The crossing lays one deck for her: into the basket, under her while it rises, out onto the high
roof. Circles round the hub on screen turn the sails one way (`tuning.crossings.mill`: they come up toward
`ratio` x the cursor's turning over `spinUp`/`spinUpAboard` s, coast with `drag`/`dragAboard`, brake on the pawl
below `settleSpeed`); the drum winds `rise` 1.1 m per radian of sail, so about two thirds of a turn of the sails winds
her the whole way; the pawl clicks every tooth (`mill-click`) and holds her wherever they stop; the wrong way rocks
them `rockAboard` against it; at the top they ease into the stop. The cap creaks every `creakEvery` rad. The drawn
spiral (`MillSpiral`, now 1.4 to 5.2 m round the hub) is offered while she rides and the player is still; the safety
valve turns them after 90 s with no progress. Measured (`mill-check`, real circles): a steady hand at 1.25 s a circle
5.0 to 6.7 s of circling (4 to 5.3 circles) for 5.2 m; a hesitant one (1.8 s circles, smaller, a stop) 6.3 to 7.2 s;
let go mid-climb they coast about 0.1 to 0.25 rad (0.1 to 0.4 m) and hold. Cat hook: `catWay()` returns `CatStep`s
(`cat-way.ts` now carries `frame`, `upright`, `yaw`, `gather` and `when`): a leap from within reach of the low sail's
end (the yard's chimney, 2 m stack on her ridge just in front of the sails' plane) onto `Windmill.perch` (the first
sail's stock end, resting low over it at `rest`), two hops in along the stock as the sails start, and a leap onto the
cap (`capTop`) once the sail is `catLeap` above level. Whoever drives the cat sets `clear` once it is on the sail (the
brake stays on until then) and `catOn` while it bounds (the sails turn no faster than `capCat`). `playCatSteps` now
returns a driver with `update()` and `step` for steps that wait. The yard (`?chapter=stage&gap=mill`, `&catless`;
`mill-yard.ts`): her roof at 3.0 m running in under the sails to the basket, a tall granary behind it with its ridge
at 8.2 m, a 5.2 m climb; the lens wide in front and to the hoist's side, rising less than she does so she climbs up
the frame and closing in a little, upright nearer with the hub mid-frame (`closeUp = 'her' | 'mill'` for QA). The run
keeps its old heights until Phase 7 (`MILL_SITE` from 2.82 to 5.39 m, sails `reach` 4.5 m, her wall in under them to
the basket, the lens raised to the hub; its cat still runs the wall and leaps to the high roof, not yet the sail).
`tools/crossing-film.mjs <mill|sheet>` films a yard at 10 fps from its own lens with real gestures into labelled
sheets and a state log. Left: in the wide frame the sails' top and the cat's ride over the cap leave the frame; she
reads small there (upright is the stronger frame); the sails sweep in front of her as she passes the hub's height
(lattice, so she shows through); the cat reaches the cap only a second or so before she tops out on a fast hand.
The sheet as tuned: strokes count by the share of the sheet's own length they sweep (`push` per sheet length, `gentle`
and `firm` in sheet lengths a second), so one firm stroke fills it about 0.65 in both aspects and the crossing takes
10 strokes from the first (4 or 5 once the cat is off the line) landscape and upright alike; what carries her is the
fresh gust of the strokes (`gustFor` 0.8 s), not the cloth's slow sag, so she goes on about 0.65 m after the last
stroke (was 1.8); hanging she turns `turnToLens` 0.6 toward the lens and back up the line over the last 2.4 m, looking
along it, and lands looking on along the far ridge (looking back across the lane faced the upright lens). Left: the cat takes about 8 s on the line before she can take hold.


### Phase 7a: the rescue, the stuck boat and the chase (after 6c)
Owns: `src/world/drowned-way.ts` (the route), `src/world/drowned.ts` layout from the strand to the nave,
`src/world/drowned-dark.ts` and this room's fog knobs, `src/story/drowned.ts` beats `enter` to `nave`,
`src/story/drowned-run.ts`, `src/story/drowned-cat.ts`, the crossings' places in the room, `drowned-run-check` and the
saves for these beats. design.md "The room rethought", steps 1 to 5, is the spec.
- The rescue in the room with 6b's cat: in the tub, head over the rim; the leap aboard, the shake, the shiver; the
  press against her shins and her kneeling to it (`child.kneeling`, `child.reachFor`); it sits at the bow.
- Stuck: the becalmed boat runs onto a roof lying just under the water (seen under the surface): a scrape, a lurch,
  the lantern swinging. A sweep on the sail only makes it strain and creak against the roof; it never comes off.
- The cat stares at the rising fog (`stare`), then toward the church, leaps onto the nearest roof and runs; she looks
  at the fog and the boat and goes after it with the plane.
- The boat is left where it lies for the rest of the run. From the first roof she looks back as the fog takes it:
  the hull, the sail, and last the lantern's glow. Nothing follows them.
- The fog is a rising tide: never stops, never rushes; it comes on behind at her pace and rises as it comes, so each
  roof she leaves goes under just after she is off it. It keeps a few roofs back, closer while she works a crossing,
  never reaching her; nothing fails. It is physically behind or beside every walk (Phase 8 frames it); she and the
  cat glance back at it now and then; the sea goes muffled under it.
- The route climbs at every crossing: the tree, the sheet, the windmill's hoist, the swing onto the nave, in that
  order, each landing higher than it started. No walk much over 10 s on foot. The cat goes first at every piece,
  already going as she arrives, never making her wait.
- The mill at its yard's full size in the room (a 5.2 m climb, 7.3 m sails, the high roof's ridge at the basket's top),
  the cat riding a sail up to the cap (`catWay`). Riding the basket she faces the tower and looks up at the cat and the
  top, then down at the fog below, never back toward the lens (in the yard she faced the way she came, into the lens).
- The sheet's cat is on the line for about 8 s before she can take hold: it must be across or nearly so as she
  arrives, so she never waits.
- Hand-on to 7c: she on the nave's ridge at the tower's foot, the cat at the ivy, the fog a few roofs back, the boat
  lost where it stuck, its lantern lit inside the fog. The fog is drivable by its level (the height of its top) and its
  front (how far along her way it has come), named in the as-built note, for 7c to raise round the tower and push back.
Gate: `drowned-run-check` from the drift to the nave with real gestures (its fog checks re-cast for the tide: in
every walk's frame, never on her, each roof she leaves going under after she is off it; each walk's seconds on foot
reported); `crossings-check`; the saves (`progress-check`, `progress-schema-check`, `drowned-gating-check`); a
`VIDEO=1` webm of the whole run from the rescue to the nave for the lead to watch.
Done: [x] `f6ba0bcd..a12fb413` on `proto-drowned-chase`. The beats: the cat in the tub, head over the rim; carried to
the boat it leaps aboard, shakes, shivers, hops down and presses against her shins; she kneels (`child.kneeling`),
reaches for it (`reachFor`, the cat's `nuzzle`) and it goes back to sit at the bow (`DrownedCat.rescue`/`rescued`, the
lens closing in to `rescue*` while it happens). The air dies and the boat runs onto the first roof's slates where they
go under the water (`STRAND`, worked out from that roof's waterline): `Boat.knock(pitch, roll, trim)` lurches and trims
it, `hull-scrape` sounds; a stroke on the sail only strains it (`brushSail`, `hull-strain` every `stuck.strainEvery`)
and it never comes off. The fog rises on the way they came and comes on; the cat stares at it (`dread`: `stare` from
`cat.uneasyFrom`), looks toward the church within `churchFrom`, bolts onto the first roof at `boltFrom` and runs; she
climbs out after it. Her way (`HER_WAY`, laid backward from the green in `drowned-way.ts`): the first roof's ridge, a
hop down onto the garden wall where she stops and looks back at the boat for `lookBackFor` as the fog comes onto it (the
lens over her shoulder, `back*`); the wall north to the fallen tree (`TreeWay.climb`: she steps up onto the trunk and
walks it, 0.6 m up, to the barn's ridge); the sheet over the lane to the high roof, then a breath (`setDown`); down its
far slope and a hop onto the next wall, round to the mill; the basket wound 5.2 m up to the granary's ridge (the mill at
the yard's size, `facing` 0, its hoist on the west; she holds the tower-side rope, looks up at the cap and the cat, then
down at the fog); on the granary's ridge she stops and looks back down at it (`lookDownFor`); down the lean-to, a hop
onto the green cottage, its ridge to the swing; the swing onto the nave; the nave's ridge to the tower's foot. The cat
goes first by `CAT_WAY` (composed from `run`, `hop`, `leap`, `rest`; nothing new in `cat.ts`): along the lane's railing
to the barn's chimney, across the sheet's caps, up the low sail to the cap, the bough and the nave to the tower's south
face. The boat stays where it stuck (`boat moved 0.00 m`). The fog (`DarkBank`, `drowned-dark.ts`) is driven by two
numbers: `front`, metres along `DARK_WAY` (from far south of the stranding, through `STRAND`, then `HER_WAY` to
`TOWER_FOOT`; `darkAlong(x, z, was)` projects a place onto it), and `level`, the height of its top. `comeOn(front, dt)`
moves the front on (never back) and raises the level toward `tide(front)` at `fog.levelRate` (never down): over
everything it has taken (`DARK_TOPS`, each place of her way's height) by `levelOver`, and never below a climb from
`levelFrom` 4.5 m to `levelTo` 7.2 m. `faces` (a point; the run sets her) turns its front to face her, eased
(`dark.turnRate`), so it comes on behind her round every corner; `ahead` is the way it faces and `frontAt()` where its
front is. The run paces it (`run.fog`): toward `fogTrail` 12 m behind her on her way, `fogHold` (tree 10, sheet 8, mill
18, swing 12) at the pieces, `fogNearest` 7.5 m at the closest, `fogEnd` 19 m at the tower's foot, closing at `fogPull`
within `fogSlowest`..`fogFastest`; while she looks back it comes in to `fogNearest` so it is on the boat. Its level is
7.3 m at the hand-on. For 7c: set `dark.front` and `dark.level` directly (assignment may go back; `comeOn` never does),
and `dark.faces` to what it should close on. The sea under it muffles (`Story.seaMuffle` from how far the lens is ahead
of its front, `fog.muffleFrom`..`muffleTo`; `audio.seaMuffleLevel`, `seaMuffleCutoff`). The lens: on her way the laid
walking lens, kept `fogClear` ahead of where the fog will be and clear of her way once `frame` leads it (`toward`); each
piece's own view (the tree's from north of it, the sheet's from the lane's side away from the fog, the mill's high off
the sails' left over the fog's top, which then glides round the granary's west side to stand over the green and hands
round to the swing's high along the nave's south side, `toSwingView`); upright it always holds her (`shot.subjects`).
Saves: `sail` (the drift, the cat aboard), `roofs` (on the ridge after the cat, the boat aground, the fog coming; a
restore cuts the lens to her, `RoofRun.cutIn`), `church` (the hand-on: `RoofRun.skipToEnd`); the schema is unchanged.
Measured (`drowned-run-check TO=nave` from the drift, real gestures, 1600x900, `LENS=1`): 95 m of way in about 103 s; on
foot to the tree 17.1 s (10.6 s walking and the 6.5 s look back), to the sheet 0.3 s, to the mill 10.6 s, to the swing
11.2 s (with the 1.4 s look down), to the tower's foot 1.6 s; the tree 17 s, the sheet 10 s, the mill 20 s, the swing 15
s; she waited on the cat 0.4 s at the mill and not at all at the sheet; the fog's front never nearer than 5.6 m; each
roof she went on from under it 7.3, 13.4, 8.5, 9.7 and 10.5 s later (the green cottage's not yet: the fog waits short of
it for the church); the fog out of a walk's frame for at most 0.5 s; the lens never faced her more than 0.8 s, never
lost her, turned at most 60 deg/s. Upright (900x1600) the check passes; its lens turns at 64 deg/s as it comes round
from the climb and 60 deg/s just after the sheet (just over `LENS=1`'s 60), and the fog is behind the narrow frame for
up to 3.8 s on a walk (the check asks the fog of the wide frame only). Weak: from the boat sticking to the cat's bolt is
about 20 s of the same wide frame while the fog comes; at the rescue the mast stands between the lens and the cat at her
shins; the mill's view stands above the fog, so the fog is out of its frame while she rides; the lens comes round to the
swing's view high over the board, looking down on her as she gets on; from the wall she is only 8 m from the boat, so
the fog is just onto it as she turns away, the lantern still showing; the barn goes under 13.4 s after she leaves it;
the drift from the rescue to the stranding is about 30 s (`driftBreeze`); the slates the boat runs onto are not drawn
under the water; on the way in the lens passes through the sail for a moment. For 7c: `fetchForChurch` in `drowned.ts`
is a stand-in that sets the boat 2.5 m off the old tree once the church's fog has closed (`church.fetchAt`); the bell's
drift home replaces it.

### Phase 7b: the belfry and the bell, staged (after 6b3; parallel with 7a; new files only)
Owns new files: `src/world/belfry.ts` (the belfry's inside: the bell in its oak frame, old straw under it, the four
sills, the trap down into the tower), `src/world/crossings/bell.ts` (the bell as a piece), `src/story/bell-yard.ts`
on the stage (`?chapter=stage`, `gap=bell` in `crossings-check`), the bell's sound (a new file under `src/audio/`
with one registering line where foley is wired), and the child's ivy climb (her clamber up and down a stepped ivy
face, in `src/traveller/child/motion.ts`, staged on the yard with a stand-in wall).
- The bell: big, old bronze, green at the lip, hung in its frame. One good stroke across it swings it and it rings
  once at the top of the swing; it is not pumped up like the swing. A weak stroke rocks it and the clapper only
  touches. Each ring is deep and long, its note given by Phase 9's key (until then the score's tonic), and sends a
  visible ring rolling out from the tower over the fog's top. The yard shows four rings in about 15 s of play.
- The belfry is warm and close in shadow after the cold outside: the straw nest under the bell with the kittens
  (`Kittens.lay`, `nestle`, `tumble`), the cat curled round them, the last light coming in low at the sills and laid
  across the straw, so the kittens' coats and the cat's closed eyes read (6b2's strips in a plain half light were too
  dark to read them).
- The ivy she climbs (new `src/world/ivy-face.ts`, which 7c puts on the tower in place of today's single stem): old
  woody stems as thick as her wrist, forking into footholds, under a dense mat of leaves, so a child can believe she
  climbs it. On the yard it covers a stand-in tower face from a ridge to a belfry sill as high as the room's (about
  5.5 m, the nave's ridge to the sill).
- The child's climb: hand over hand up the ivy, a knee up, feet finding the forks, the plane tucked in her coat; down
  the same way, looking for her footing. Reads at the room's distance; no hand or foot slips (`probe.report()`).
Gate: `crossings-check` `gap=bell` with real strokes; yard stills of the belfry and of every climb pose; a recorded
clip of four rings for the lead to watch and hear.
Done: [x] (branch `proto-drowned-belfry`). As built, for 7c to mount:
- **The belfry** (`src/world/belfry.ts`): `new Belfry(towerMiddle)`, square to the world at the room's own heights
  (`BELFRY`: half-width 2.4, walls 0.45 thick, sills at 8.27 with the boards 0.12 below them, the room 3.3 high to its
  ceiling boards, walls from 7.75 to 11.6, the cornice at 11.75 as today's). It is the whole belfry storey, outside and
  in: one opening a face of two pointed lights 1.0 wide either side of a slender shaft (their middles ±0.65 off the
  face's middle, the arches springing 2.3 above the sill, points 0.55 higher), dressed surrounds, quoins, a 0.12 drip
  ledge under each opening (the four sills; the cat sits in the reveal, 0.45 deep). It differs from today's tower,
  which shows two lancets a face at ±1.05: 7c cuts the tower box at 7.75 and puts this on it (and moves
  `BELFRY_SOUTH`/`NORTH`). Inside: boards, straw, joists, the trap (north-east), and two oak A-trestles east and west
  of the bell at ±1.16, so the bell swings north–south across the west face's two lights. `pivot()`, `nest()` (just
  inside the west face's north light, where she climbs in), `sill(face, light, out)`, `inside(face, light, inward)`,
  `decks` (her floor), `light` (uniforms shared with the bell). Its shader lets the low sun in only through a light and
  round the bell's shadow (`BELFRY_GLSL`: `belfryOpen`, `belfrySun`, `bellShade`), keeps the inside warm and close, and
  needs `shadeBell(bell.pivot, bell.down(v))` every frame. `sunAt()` checks a point; the nest is lit at the room's low
  sun from the north-west (dusk 0.88 on the yard, azimuth about 34°).
- **The bell** (`src/world/crossings/bell.ts`): `new Bell({ pivot, toward: (0, 1), half: BELFRY.trestle }, cast,
  belfry.light)`, 1.94 across the lip and 1.75 from crown to lip, crown 0.22 under the gudgeons, old bronze gone green
  at the lip and in runs, with a headstock, straps and a clapper. Each stroke across it on screen asks for a swing in
  proportion to the bell widths it sweeps along its swing (firmer for faster) and never adds to one; as the swing
  tops out the clapper strikes once: a ring past `ringAt` 0.3 rad, a touch past `touchAt` 0.07. `live` gates it (on
  only while she rings); `onRing(strength)` is the hook for the waves, the fog and the lantern; `onEvent` raises
  `BELL_SOUNDS` (`bell`, `bell-touch`) through `cast.knock`. The drawn stroke after `inviteAfter` 5 s; after `valveAfter`
  90 s with no ring the world's own gust rings it every `valveEvery` 4 s. `BellWaves(centre, level, from)`: `emit`,
  `level` (the water on the yard; the fog's top in the room), up to six crests of broken pale light rolling out at
  6 m/s for 7.5 s. Tuning: `tuning.crossings.bell`.
- **Its sound** (`src/audio/bell.ts`, `strikeBell`, registered in `foley.ts`): a minor-third bell on B (strike note MIDI
  59, nominal B4, the drowned score's B minor tonic; a bell about a metre across, as drawn, and above what a phone's
  speaker drops): hum, prime, tierce, quint and nominal with slow doublet beats, the brighter partials
  and the clapper's clang and knock scaled by the stroke, the hum lasting about half a minute; a touch is a soft knock
  and the note barely woken. Four rings through the game's own reverb peak at about -5 dBFS
  (`node tools/bell-render.mjs [out.wav] [rings] [seconds]`).
- **The ivy** (`src/world/ivy-face.ts`): `new IvyFace({ from, to, out, roof, spread })`, `from` on the face at the foot
  (the nave's ridge, 2.84), `to` the middle of the light's sill (8.27), `roof(across)` the slates' height under the
  face. Two wrist-thick old stems ±0.44 either side of her line (radius 0.052, 0.075 off the stone) forking inward
  every 0.7 m into crotches, the right stem's 0.35 lower, a few more old stems over the face, and up to 1150 leaves in
  `drowned-ivy.ts`'s shape and palette, kept off the grips. `holds` (her left stem, her right: `hand`, `foot`, `up`),
  `catWay()`. In the room: the tower's west face from the nave's ridge to the west face's north light.
- **The climb** (`src/traveller/climb.ts`; the child gained `climbing`, `climbPose`, `footFor`, `footReached` and
  `ankle`, and her legs take world foot holds in `child/motion.ts`): `new Climb(child, { wall, out, holds, sill, depth })`,
  `start()`, `facing`, `up(onDone)`, `down(onDone)`, `update(dt)` every frame, `worst`. Planned from the holds so that
  every limb is in reach where it is put: a hand to the highest hold it can reach before her body rises, the lower
  foot up a fork (a knee up), the push; hands onto the sill, up on her arms, her hands to the sides of the opening, a
  knee onto the sill, up into the opening, where she ends standing in the reveal; down, she backs out over the sill
  and the ladder plays backwards, each foot feeling for its fork. `tuning.crossings.climb`. 8.5 s from the ridge to
  standing in the opening (about 6.5 on the face), 12.8 s down; worst mitten gap 0.02 m, foot slip 0.02 m up and down.
  The plane is tucked in her coat (`cast.plane.visible = false`) from the ivy's foot until she is back in the boat.
- **The yard** (`src/story/bell-yard.ts`, `?chapter=stage&gap=bell`, `&bell=ring|down`, `&bellView=<view>`; the stage's
  `play('crossing:bell' | 'bell:ring' | 'bell:down')`): the nave's ridge into the tower's west face over open water,
  the cat up the ivy first and in to curl round its sleeping kittens (it comes in on the heading it curls on, so the
  kittens' heap is in the curl's hollow, open toward the opening), her climb, her kneeling in the opening over the nest,
  then standing there looking out toward the last of the sun while the player rings. The lens glides round the tower in
  bearing, distance and height (never through it): from the north going up (her profile, a knee up, the sea behind),
  round to look in at the nest through the other light, out west of the tower for the bell (her in the north light,
  the bronze swinging across the south light, the rings rolling out below); from the south coming down.
  `crossings-check` `bell`, `bell-weak`, `bell-idle`, `climb`, `climb-down`; `crossing-film.mjs bell` (`BELL=`,
  `VIEW=`, `KEEP=`, `CLIP=` for a clip with the bell rendered into its sound track).
Left: from outside, the bell is a dim shape in its light, best read as it swings and shivers; the depth blur keeps
her, the cygnet and the cat sharp, so a bell nearer the lens than they are blurs (the interior's wide frame is taken
past the nest for that reason). She and the creatures are shaded by the open sun even inside, so the nest sits in the
sun's shaft to agree; she reads as outdoor-lit in the belfry's shade. There is no room inside for her (the frame
leaves a 0.8 m strip by the west wall), so she kneels in the opening; the kneel reads weakly from the lens. The kittens
are small and half hidden in the curl; `nestle(cat)` re-places them a few centimetres. From behind she is all satchel
and cygnet, so the climb reads side-on. The ivy goes yellow-green in the low sun. A firm stroke's swing is larger
upright than landscape (the bell is smaller on screen). The bell's sound was judged only by its partials and
loudness; Phase 9 retunes its note. The cygnet's own glance at the cat (`peer`) pops once near the top (the probe's
worst jerk, 0.09, is that, not the climb).

### Phase 7c: the refuge and the boat home (after 7a and 7b)
Owns: `src/story/drowned-church.ts`, `src/story/drowned.ts` from `nave` to the storm's `gather`, the belfry mounted
in the tower (`src/world/drowned.ts`, `src/world/drowned-ivy.ts`), the fog's level and front through these beats, the
checks and saves for them. design.md "The room rethought", steps 6 to 8, is the spec.
- The cat climbs the ivy into the belfry and she follows, climbing (7b's clamber); inside are the kittens; the cat
  curls round them. The fog closes round the tower and rises to just below the sills, and stops: the village a cold
  white sea in the last light, the spire and the lighthouse out of it, the beam sweeping its top.
- The bell: each ring rolls out over the fog and pushes it back a little round the tower, and out in the fog a lantern
  glows in answer, nearer each time; the boat, freed, drifting home to the sound from where it was lost. When it is
  near, the fog has drawn back to the water round the nave and the player fills its sail for the last stretch to the
  tower's foot.
- She climbs down the ivy and steps aboard. The cat comes to the sill with a kitten (`toSill`) and looks down; she
  looks up from the boat; the slow blink. Then the fog darkens into the storm's night and the storm plays as built.
- From the lead's review of 7b's stills: the ivy goes yellow in the low sun (it must stay a deep, old green that reads
  as ivy); her climb down takes 12.8 s (bring it to about 7 s); she reads lit by the open sun inside the belfry (in
  the shade she should be lit as the nest is, by the shaft at the sill); her kneel in the opening reads weakly, so
  give the moment she first sees the kittens a frame that shows it (Phase 8 refines it).
- From 7a: drive the fog only through `DarkBank`'s `front`, `level`, `close` and `faces` (7d owns its look);
  `fetchForChurch()` in `src/story/drowned.ts` is a stand-in that the bell's drift home replaces; the boat lies where
  it stuck, lantern lit; `church` restores by `RoofRun.skipToEnd`.
Gate: `drowned-run-check` from the drift through the belfry and the boat home to the storm, with real gestures; the
saves; `playthrough.mjs` through the room; a `VIDEO=1` webm of the nave to the storm for the lead.
Done: [x] (branch `proto-drowned-refuge`). The beats, timed from her reaching the tower's foot (`ChurchArrival`,
steps `foot`, `climb`, `nest`, `sea`, `ring`, `down`, `wait`, `board`, `aboard`):
- **The climb.** The cat leaps from the churchyard's railings onto the nave's slates beside her and runs up the ivy
  (`catClimb` 1.9) into the west face's north light, down onto the boards and round its kittens (curled about 13 s in,
  `kittens.nestle` 1.2 s later). She follows once it is `followAt` 2.4 m up (about 5.7 s), the plane tucked away from
  the ivy's foot until she is back in the boat, and climbs 8.5 s (`Climb`). The fog (`DarkBank` through `front`,
  `level` and `faces` only; `faces` is let go at the church) waits `behind` 16 m back along the nave while she is low,
  comes to the tower as she reaches the sill and on to `past` 55 m beyond it, where it stops, its `level` easing from
  the run's 7.3 m to `sea` 6.8 m, just under the sills. `darkWayPoint` now runs on past the tower's foot the way the
  way's last stretch goes, so the front can stand beyond the tower.
- **The kittens** (`nest`, 6.4 s, about 14.5 s in): she kneels in the opening facing the straw; a kitten (`FOUND`, the
  ginger) lifts its head and mews, comes to the edge of the straw by her (`kittenAside`), sits looking up and mews
  again, and she leans to it.
- **The fog sea** (`sea`, 6 s): she stands in the opening turned `lookRound` toward the north water; a quiet breath.
- **The bell** (`ring`, live about 27 s in; first rung at 29 s in the recorded play): one firm stroke a ring. Each ring
  emits `BellWaves` at `wavesAt` of the fog's top and sinks the fog a step over `sinkFor` 3.2 s (6.8, 5.35, 3.9, 2.45,
  1.0 m); `answerAfter` 0.7 s later the lantern answers: `LanternGlow` (a warm glow drawn over the fog where the boat's
  flame is, fading as the fog sinks below it) swells and the boat glides a stretch along `HOME_WAY` (`answers` 10, 42,
  72, 100 %). Measured: the boat 51, 48.6, 40, 30.7 and 21.8 m from the berth before and after each answer; four rings
  over 12.3 s with four strokes; the lantern on screen each time at about (-0.22, 0.13), (-0.21, 0.04), (-0.24,
  -0.07), (-0.31, -0.26). `HOME_WAY` comes in from the north-east open water so every answer falls just left of the
  tower's north-west corner in the bell's view, in both aspects. The bell's own valve (90 s) rings it for a stalled
  player.
- **The boat home** (`down`, `wait`, `board`): `answerFor` 3.8 s after the last answer the sail is the player's
  (`invitesSail`, `bringSpeed` 2.6) round the tower's north side (`BRING_WAY`) to `NAVE_BERTH`, 13.5 s and seven
  strokes in the recorded play; meanwhile she climbs down (7.1 s, `crossings.climb.down` 0.72 and `feel` 0.16; worst
  hand gap 0.034 m, foot slip 0.018 m), walks the ridge (`IVY_STEP`) and down `NAVE_NORTH`, and steps aboard when it
  lies there (18 s after the sail was hers). The cat gets up `catUpAfter` 2.5 s into her climb down and comes to the
  lip of the sill she climbed out over, the kitten beside it (`Kittens.toSill`).
- **The look up** (`aboard`, `lookUpFor` 5.5 s): she turns on the thwart to the cat (`lookUpAt` 0.6 s, the side away
  from the lens), the cat's slow blink at `blinkAt` 2.4 s and a soft chirrup `chirrupAfter` 2.2 s later; the fog closes
  evenly from `closeAfter` 1.5 s over `closeFor` 20 s, rising to `closedLevel` 6, and darkens into the storm's night, which starts
  (`gather`) when the look up ends. Measured on to the beach: the light out 6.5 s into the storm and in frame, the
  frame darkening at most 9.5 a second, landed 51 s after she sat down.
- **Saves**: `church` through the climb (resumes at the tower's foot), `belfry` (new) from the kittens until she
  steps aboard (resumes standing in the opening over the fog sea, the cat curled round its kittens, the bell about to
  be hers, the boat away in the fog), `storm` from boarding (resumes seated at the berth, the cat and kitten on the
  sill, so the look up plays again). `?chapter=belfry` is the QA start. Schema: one point added, arities unchanged.
- **The look.** The tower box is cut at `BELFRY_FOOT` and 7b's `Belfry` stands on it (the old lancets, sills, surrounds,
  cornice and the single ivy stem gone; `BELFRY_SOUTH`/`NORTH` sit in the reveals of the south and north faces' west
  lights); `IvyFace` covers the west face from the nave's ridge to the north light's sill (`IVY_FOOT`, `IVY_SILL`).
  Its leaves are a deep, cool green that the low sun pales rather than gilds. In the opening and over the sill she is
  lit as the room is (`Traveller.room`, the child shader's `uInRoom`: the sky only at the windows and the low sun only
  as it comes in at her light). The kittens' pats and mews go into the cat's `heard`.
- **The lens** (`tuning.drownedCamera.church`, views as eye and target from the tower's middle, heights over the sill
  or over her while she climbs, an optional lens; a critically damped glide of `glide` 1.8 s about the tower's middle,
  never through it): from the run's lens round the west side to 7b's climb view from the north, rising with her; a cut
  to the nest, close outside the west face looking past her into the other light at the straw; a cut out to the wide
  view west of the tower over the fog sea; a glide in to 7b's bell view turned on the tower's north-west corner (her
  from behind in her light, the bell in the other, the lantern's answers left of the tower; `find` 0.1 leans toward
  each answer); a glide low over the north water from the west as she climbs down and the boat comes in; the look-up
  two-shot from the north-west with a 1.3 lens; then the departure goes with her, turns to between her and the
  lighthouse's lamp as its light falters (`lampFrom`..`lampTo`, `lampZoom` 0.75, upright wider) and hands over to
  the storm's frame from `leaveFrom` 6.6 s over 12 s, carrying the rig's breathing in (`breathe` in `camera.ts`; a
  placed shot now keeps the eye before its breathing, so any placed move handing over to an eased one is seamless).
- **Checks**: `drowned-run-check` (new `FROM=belfry`) climbs, rings the bell with strokes until four rings, sails the
  boat home, and reports the beats' times, each ring's boat distance before and after its answer and the lantern on
  screen, the cat and kitten on the sill at the slow blink, and the rings' times into the recording; it fails if the
  bell does not ring four times, the lantern comes no nearer or is out of frame when it answers, or the cat is off the
  sill. `progress-check` restores `church` (plays on to her climbing), `belfry` (to the bell live) and `storm`.
  Measured from the drift with real gestures, landscape with `LENS=1`: the bell hers 24.4 s after the tower's foot and
  first rung at 26.7 s; four rings in four strokes over 12.3 s; the boat home 14 s and eight strokes after the sail was
  hers; her aboard about 62 s after the tower's foot; the cat 0.2 m and the kitten 0.25 m from the sill at the blink;
  she was never out of frame or hidden through the church; the lens's fastest turn from the tower's foot to the beach
  25 deg/s; the frame darkening into the storm at most 9.9 a second. The one failure is the run's own walking lens just
  after the sheet, 60.1 deg/s against the 60 limit, as on the base commit (60.3). Upright (900x1600) passes, the church
  never losing her.
Weak: the kittens read small through the other light and the kitten's coming to her is half behind the shaft, her
back to the lens; at the slow blink the cat is about 30 px tall at 1600 wide, so the blink reads in motion only; the
cat's run up beside her at the ivy's foot is behind her in the climb view, and its leap onto the wall is slow (the
cat's own launch); the fog sea is 7d's to make read (today a pink tableland whose flank shows far roofs on open
water); `LanternGlow` stands in for the fog's lantern halo, which is faint from above: check the two do not double
once 7d's halo lands; the boat comes home from the north-east, not the south where it was lost. For Phase 8: the views are the tuning arrays above; `HOME_WAY`
is laid for the bell's view and moves with it. For Phase 9: `drownedScore` still returns `still` through the church;
the cues are `church.step` (`climb`, `nest`, `sea`, `ring`, `down`, `aboard`), `rings`, `answered` and `aboardFor`,
the bell's note is B (MIDI 59).

### Phase 7d: the fog's body and its first act (after 7a; parallel with 7c)
Owns: the fog's look (`seaFog` and its helpers in `src/world/atmosphere.ts`, the hues and tints in
`src/world/drowned-dark.ts`, the look numbers in `tuning.drowned.fog` and `tuning.drowned.dark`), and its first act
in `src/story/drowned.ts` (the drift after the rescue, `still`, `becalmed`) and the look back at the start of
`src/story/drowned-run.ts`. It keeps `DarkBank`'s API (`front`, `level`, `close`, `faces`, `comeOn`) as 7a left it,
which 7c drives.
The lead's review of 7a's run: the chase is now in every walk, but the fog does not read as fog. From the roofs its
flat top lies across the frame as a pink tableland under the sky, chimney tops standing out of it like posts in sand
(the low sun's crest colour lights its whole top); its near face is a dark wavy band; only seen from within it, at
the tree, does it read as a cold veil. The design asks for a rising white tide, low and cold-bodied, never the stairs
room's luminous cloud. Make it read as sea fog at dusk in every frame of the run:
- Its body cold white to blue-grey, lit from above by the sky and darker beneath; the sun's warmth only a thin rim
  on the crests that face it, never the whole top.
- No flat top: it heaps and rolls, swells a few metres high moving slowly, its top thinning into the air over a
  couple of metres rather than ending at a surface; where it is thin, roofs and chimneys show ghosted through it.
- Its front a soft leaning wall with fingers running ahead over the water and up walls, so what it takes dissolves
  (nearer things soften first, then are gone), never cut off by a line.
- The lantern's glow through it (`seaFogHalo`) a soft warm halo that dims as it thickens; 7c's answering lantern
  relies on it.
- Seen from above (the belfry's sill, 8.3 m, over a level about 7 to 8 m), a fog sea: billowed, the spire and the
  lighthouse out of it, the beam able to light a band across its top.
Its first act, paced: the drift from the rescue to the strand about 15 s (it is about 30); from the scrape to the
cat's leap about 10 s (the same wide frame holds about 20 s now), the fog seen rising off the sea in it; the slates
the boat runs onto drawn under the water; the look back from the first roof about 4 s (6.5 s now), close enough that
the fog is seen taking the hull, then the sail, the lantern's glow last.
Gate: stills at the run's walks (the first roof looking back, the garden wall, the trunk, the granary's ridge, the
nave), from the belfry over the fog sea (a `cam=` from the sill), and of the lantern in it, each before and after;
`drowned-run-check` (its fog checks still hold); `drowned-fog-check`; a `VIDEO=1` webm of the first act (the rescue to
the first roof) with 2 fps strips.
Done: [x] (branch `proto-drowned-fogbody`). As built:
- **The body** (`seaFogMarch` in `atmosphere.ts`; `seaFog` calls it, `seaFogMirrored` for the glassy sea's mirror). A
  sightline is marched in up to `fog.steps` (20) steps, each `stepGrow` longer than the last, the first laid so they
  cover the stretch where its top's relief can be met (never finer than `stepLeast`, coarser far off); each step's share
  of fog is taken exactly for its top and face going straight between the step's ends (`pastEdge`), so no step shows
  as a band, and relief a step is too long to follow is folded into a softer top (`seaFogTop`'s third value) rather
  than aliased. Whatever lies past the last step is taken whole with its top at its usual height. It stops once
  nearly opaque. Outside the drowned village nothing of it runs (`uSeaFogShape.w` 0, as before).
- **Its top** rolls: long swells (`swell`, `swellBroad` 30 m) rolling one way under billowed heaps (`heap`,
  `heapBroad` 10 m; the noise's fold `|2n-1|`, round on top and creased between) rolling another (`swellRoll`,
  `heapRoll`, about 0.15 m/s). `level` is about where its highest heaps come to (`swellUp`, `heapUp`): they seldom
  stand more than 17% over it and it usually lies at about 0.63 of it, so roofs and chimneys stand ghosted out of its
  troughs. It thins into the air from `thinUp` over its top to `thinDown` under it. The shader's highest, lowest, usual
  and spread are derived from these knobs (`SEA_FOG_TOP`).
- **Its face** leans back (`lean`, so its foot takes what is low first), bulges in billowed rolls (`bulge`,
  `bulgeBroad`), is whole `front` (5 m) behind its line, and runs thin fingers on ahead over the water (`fingers` 12 m,
  `fingerLow`, `fingerThick`).
- **Its light**: lit from above by the sky, cold white on top (`uSeaFogTop`, `top`/`topNear` of the sky's light)
  going to the blue-grey body (`uSeaFogBody`, `body`/`bodyNear`) the deeper under its top (`skyDepth`), darker in the
  hollows and creases between heaps (`hollow`, `crease`), the side of a heap toward the low sun lighter and the other
  darker (`side`, `sideDepth`); near its face the open air lights it too (`faceLit`, `faceDepth`). The low sun is only
  a rim on crests that face it (`crest`, `rim`, `rimProbe`, `rimFacing`), a little rose left there once the sun has
  gone (`roseLeft`); looking toward the sun its thin top glows. Far off it goes into the haze (`farHaze`). Closed round
  into the night it has no lit top and its body goes to the old slate (`night`), so the storm's frames are unchanged
  (the run check's brightness per second from aboard matches 4b's).
- **The lantern** in it: its light scattered where the sightline passes nearest the flame, as thick as the fog is
  there, spreading wider (`lanternSpread`) and dimming less than the fog between would dim a surface
  (`lanternThrough`), so the boat's lantern glows from 40 m out in the fog sea for 7c's answer. **The lighthouse's
  beam** lights the fog where a sightline crosses its cone, taken whole at the sightline's nearest pass to its axis
  (`beam`). **The sea** reads the fog per pixel while it is out, and its mirror of it (at the grid's points and in the
  mirror's pass) in steps no finer than `mirrorStep`. The feathered sheets are gone.
- **Cost**: per pixel of anything the fog reaches (sky, sea, houses): at most 21 steps of 2 noise-tile reads for its
  top, 1-2 more within a few metres of its face, 2 more within `sideDepth` of its top; most sightlines into it stop
  after a few steps. The old field was about 12 tile reads and 10 value-noise calls a pixel. The sea's per-pixel read
  (it was per vertex) is the largest addition. No timings taken.
- **The first act** (`drowned.ts`): with the cat aboard the breeze freshens and carries the boat at `driftSpeed`
  9.5 m/s; the drift never rounds the stranding, the air dies `stillFrom` 22 m out and the hull runs on onto the slates
  braking at most `strandBrake` (`Boat.coastTo.brake`). The fog starts to rise off the sea as the air dies (`riseFor`
  6 s, `riseAway` 72 m, from `level` 3.5 m) and the boat lies becalmed from the scrape, the fog coming on `comeAfter`
  0.6 s after it. The lens comes round beside the boat over `turnFor` 8 s and lifts from `settleFrom`. The first roof's
  slope is drawn going on down under the glass ahead of the stem (`SUNK_SLATES`, in the sea's shader beside the red
  door). The look back from the first roof is `lookBackFor` 4 s, the fog coming on past the boat to `fogLooked` 5 m from
  her meanwhile, so the hull goes, then the sail, the lantern's glow last; its lens eases in and out over `backIn`,
  `backOut`, `backGone`. Measured (`drowned-run-check` from the drift, landscape): the rescue done to the air dying
  19.6 s and to the scrape 23.9 s; the scrape to the cat's leap 9.1 s; the air dying to her up on the ridge 25.9 s.
- **Checks**: typecheck; `drowned-run-check` from the drift `TO=nave` passes (the fog's front never nearer than 4.5 m,
  out of a walk's frame at most 0.4 s, each roof she leaves under in 7-13 s, the lens's fastest turn 60 deg/s just after
  the look back); `FROM=church` passes (the storm's beats and brightness as 4b's); `drowned-fog-check` runs clean. The
  barn she leaves for the sheet goes under only once the fog has come on past it, so when the sheet takes about 15 s
  (some runs' strokes) it is 18-19 s and the check's 14 s fails, on the base as well.
- **Weak**: the drift is about 20 s, not 15 (it is 175 m from the cat's roof to the strand; 15 s needs about 12 m/s,
  or the cat's roof nearer the strand). Seen side on from the stranding view its face is a smooth pale wall whose foot
  runs fairly straight. From a lens at its level its top still reads level; the heaps show from above (the granary,
  the belfry). At the tower its front is a line through the tower's foot (`darkWayPoint` holds at the way's end), so the
  fog sea lies on one side of the tower only unless the church turns its front (`faces`); heaps may stand up to 17%
  over the level, so a level of about 7 m keeps them under the belfry's sills.
- **For Phase 8**: the fog reads best seen from a little above its top or across its face with sky behind it; a lens
  inside its top layer (up to about a metre under its level) sees only pale veil, and one 3 m back toward it from her
  can end up inside its face as it comes; the stranding's wide frame sees it rise behind the houses on the boat's
  far side.

### Phase 8: the camera to the shot list (after 7c)
Owns: the room's lens from the rescue to the storm's frame (`drowned-run.ts`, `drowned-church.ts`, `drowned.ts`'s
watch, `tuning.drownedCamera`), authored per beat to design.md's camera rules and shot list, upright composed for itself. The game's grammar is
measured in `camera-grammar.md` with contact sheets in `comps/camera-*.jpg` (its section 11 reads where this room
departs from it); take it from there: framed well for a human. The run's laid path and the church's `exact` views
bypass the rig's turn cap, subjects and safety frame: give them back (orbit where it is a change of side, subjects
named in every frame) or hold their turns to the bar rooms' speeds. `HOME_WAY` is laid for the bell's view and moves
with it. The study's capture script ran real gestures with a per-frame camera trace; measure turns, distances and
the angle down to her the same way.
From the lead's review of 7a's run: at the rescue the mast stands between the lens and the cat at her shins; the mill
is seen from high above, so she is tiny, the climb has no ruler and the fog is out of frame; the swing is seen from
high over the board, looking down on her; on the granary's ridge she walks straight at the lens; the upright lens
turns at 64 deg/s coming round from the climb and leaves the fog out of the narrow frame for up to 3.8 s on walks.
From the lead's review of 7d's first act: the drift holds one close frame on her in the boat for its 20 s, where the
village passing is the shot; the stranding's wide frame holds about 18 s from the scrape to her climbing out, low and
far, so the cat's stare, yowl and bolt are a few pixels at the bow and the fog rising behind the houses has no
weight. Come in on the bow for the cat's fear and keep the fog's rise growing in frame, so the wait reads as the
threat arriving.
From the lead's review of 7c with 7d's fog: the slow blink, the room's last word, is unreadable: the cat is about 30 px
at the sill and the red sail stands between the lens and her as she looks up. The kittens are seen from outside
through the other light, small, with her back to the lens. The cat's way up the ivy is hidden behind her. The fog sea
from the belfry, the rings over it and the lantern coming through it all read; keep them.
Gate: `LENS=1` checks, both aspects (no turn over 30 deg/s, she never out of frame, no visible cut); a still at every
shot-list line in both aspects, judged beside the contact sheets; a `VIDEO=1` webm of the whole room with 2 fps
strips.
Done: [~] (branch `proto-drowned-camera`; the turns, cuts and most frames done, three gate failures left, below). As
built, every beat from the rescue to the storm is on the ordinary rig (`orbit: true` eyes or follow shots, `subjects`
named), so every change of side is an orbit at the rig's 17 deg/s and nothing cuts in play (`cameraCut` only on QA
skips and restored saves):
- **Rescue** (`DrownedChapter.rescueFrame`, `drownedCamera.rescue*`): once the tub is `rescueFrom` 5 m from the boat
  the lens comes round to the bow's quarter (0.95 rad off the bow) on the side away from the sail, committed as the
  sailing view's side (`quarter`): forward of the sail, the mast clear of her face, 5.4 m, 2.5 m over the boards so the
  cat shows past the gunwale, lens 1.25: the leap aboard, the shiver, the cat at her shins and her kneeling, her face.
- **Drift** (`driftFrame`, `drift*`): 19 m astern on the quarter away from the sail, 4.2 m over the aim, the spire,
  windmill and lighthouse ahead: the room's establishing shot.
- **Stuck** (`strandFrame`, `stuck*`, `ridge*`): from the air dying the lens comes round the boat's open (west) side
  and in, side on to the bow, 5.6 m, 1.5 m over the water; as the fog comes on the cat's fear leans it onto the cat
  (`stuckOnCat`) and lengthens the lens (`stuckCloser`); at the bolt it rises and comes round to the south-west of the
  ridge's west end, behind her the way she will go, the fog beyond. Upright from the bow's quarter.
- **Run** (`RoofRun.frame`): the laid lens (`layLens`) now wants to stand behind her on the fog's side (`behindHer`,
  `off` 1.35 rad from straight behind, 12.5 m, 3.5 m up) and costs a steep look down (`steepFrom`), the fog's front
  out of view (`fogInView`, `fogEdge`) and her walking at it (three strides ahead); it is read `keyAhead` 2.5 m ahead
  of her so the turn-capped lens comes round corners as she does. Pieces: the tree and sheet as before; the mill low
  beside the basket looking up the tower, rising slower than she does (`millWide`), only once she is at the basket;
  the swing side on from 21 m as its pumping was tuned for; the end along the nave. The old tree's crown and bough are
  obstacles for the laid lens. Subjects: her and the piece, the cat ahead within `catHeld`, or her way on; no draw back
  at a piece.
- **Church** (`ChurchArrival.frame`, `drownedCamera.church`): view tables as before but written as orbit eyes with
  subjects (her and the cat, kitten, bell or boat), per-step paces: the foot from the south-west (the cat past her
  and up the ivy), the climb from the north, the kittens past her through the other light (7c's), the fog sea, the
  bell, the boat home from high off the north water coming down with her (`bring`, `bringAlong`). Aboard
  (`upFrame`): low beside the boat on its starboard, 4.2 m, on her as she turns, then from `tiltFrom` 1.2 s to
  `tiltTo` 5 s up past her face to the cat and kitten on the sill with a lens of 2.2, held for the blink (the blink
  moved from 2.4 to 5.6 s and the look up from 5.5 to 10.6 s to hold it), then let go from `releaseFrom` out to the
  west (`release`), where the storm's departure takes it.
Measured (`drowned-run-check`, real gestures, landscape): the fastest turn anywhere 25.4 deg/s (drift; run 21, church
18, storm 18.5), p95 17-20 everywhere; no cut in play; she never out of frame on the run, no roof hiding her; the rings,
lantern in frame at each answer, the boat home and the storm's light and landing all pass; upright the same within
25.3 deg/s. Stills and lens measures per beat: contact sheets `/tmp/updraft-cam8-sheet-*.jpg`.
Left (gate failures and weak frames):
- The fog leaves a walk's frame for 7-10 s on the walk from the granary to the swing (and 8 s on the walk to the mill
  in some runs): the lens behind her looks the way she goes and the fog is behind it there; the laid lens's fog cost
  does not win against the turn and off costs on that stretch. Upright the same (reported, not gated).
- She walks toward the lens 1.1-1.5 s at one corner of her way (58.9 m, onto the wall before the mill, or 39 m at the
  tree's end): the turn-capped lens comes round after her.
- At the slow blink she is out of the frame for 6.5-8 s by design (the long lens on the cat, about 70 px tall); the
  church check asks for her in frame throughout, so `LENS=1` fails there. Holding both in one landscape frame puts the
  cat at about 35 px.
- The kittens are 7c's view (her back, the kitten small): a view in through the north face's west light never showed
  her (she sits behind its jamb from anywhere that sees through it); going inside the belfry needs an authored path.
- From the kittens to the fog sea the orbit round the north-west corner hides her behind the tower for up to 7.6 s.
- Boarding: the mast crosses her as she steps in; the swing's pumping took 9 to more than 40 strokes across runs
  (unchanged view; the variance is the puzzle's).
For Phase 9: the look up now runs 10.6 s (`lookUpFor`), the blink at 5.6 s, so the storm's `gather` starts 5.1 s later
than before. For Phase 10: the run check's `FILMFROM=cat`, `TO=ridge`, `TRACE=<file>` (per-quarter-second lens trace
and per-stretch fastest turns), stills' lens measures (`<prefix>-measures.json`), and `LENS=1` gating 30 deg/s and cuts.

### Phase 8b: the camera's leftovers (after 8 and 9 merged; what was left goes to 8c and 8d)
Owns: the same camera code as Phase 8 (`drowned-run.ts`'s lens, `drowned-church.ts`'s frames, `drowned.ts`'s
frames, `tuning.drownedCamera`) and `tools/drowned-run-check.mjs`'s lens gates. Not the music, the fog's look or the
cat's animation.
The lead's review of Phase 8: the rescue, the stranding's lean in on the bow, the bolt, the sheet, the mill from low
beside the basket and the bell all read now, and nothing turns faster than the bar rooms. What is left, with the
lead's calls:
- **The slow blink** (the room's last word) has drifted from the shot list: the lens rises 4.5 m to the sill's height
  and looks across at the cat, so she is out of frame for 8 s. Make it the low over-the-shoulder looking up: the lens
  below her head height and close behind her (about 1.5 m back, 1 m under her eyes), her hood and shoulder large in a
  lower corner, the cat and the kitten on the sill in the upper third beyond, both in one frame, the cat at least
  80 px tall in landscape (a lens around 1.3-1.6 does it: from there she and the sill are only about 20 degrees
  apart). Mast and sail out of the line. Held through the blink; then the release as now. She stays in frame
  throughout, so the church check holds without an exception.
- **The fog on walks:** it leaves the frame for 7-10 s on the walk from the granary to the swing and up to 8 s on
  the walk to the mill (upright up to 8 s). Keep it at the frame's edge on every walk: stand off the shoulder on the
  fog's side so it shows beside her, or give it a glance whose weight rises as it nears; never chase it round.
- **Her walking toward the lens** for 1.1-1.5 s at one corner (onto the wall before the mill, or the tree's end):
  the lens comes round before her, not after.
- **The kittens:** her face and the kittens in one frame, three-quarter on, close and warm. If no eye outside the
  belfry sees it, the lens follows her in through the light she climbs in by (a continuous path, as the red door's
  threshold), never a cut.
- **From the kittens to the fog sea** the orbit round the tower's corner hides her for up to 7.6 s: go round the
  other way, or over.
- **Boarding:** the mast crosses her as she steps in; keep it out by bearing.
- **The storm's light going out from `FROM=belfry`:** the lighthouse leaves the frame as the light fails (the check
  fails there; `FROM=church` passes).
Gate: `drowned-run-check` `LENS=1` from the drift through the storm and `FROM=belfry`, landscape and upright, passing
with no exceptions; stills of each item before and after, in both aspects, captioned as the Phase 8 sheets; 2 fps
strips of the blink, the kittens and the two walks.
Done: [~] (branch `proto-drowned-camfix`; the blink and the belfry's light done, the rest left). As built:
- **The slow blink** (`upFrame`, `drownedCamera.church` `seatedEyes`…`upLook`): one move from the boarding view, round
  first and in after, to a low lens behind her on the boat's starboard (2.6 m from her eyes, 0.45 m over the water, 43°
  round from straight behind toward starboard, so the sail and boom, which stand out to starboard from the mast, stay
  behind it), looking half way round from her face to the cat on a lens of 1.3 (upright 2.4 m, 32°, 1.7); her face is
  the primary subject and it never draws back (`extra` 0 aboard, since back is down and away from the sill); it may go
  down to `upClear` over the water and aims `upLook` 8 m out so the rig's ground check sees the ray rise clear. Held
  from about 5 s through the blink, then the release as before. She is in frame throughout, so `LENS=1` holds at the
  church with no exception; the swap that made the cat the primary (a 5 m jump of the lens in one frame) is gone.
  The check takes her face as her head while she is seated.
- **The belfry's light:** `FROM=belfry` keeps the lighthouse in frame as the light goes out, both aspects (lamp at
  -0.4, 0.66 landscape; -0.65, 0.36 upright).
- **Boarding** (`boardEye`, `boardBack`, `boardHigh`): once the boat lies at the berth the lens comes round onto the
  bearing the look up comes in along, off the starboard, so the move aboard never passes the boom.
- The check times its swing strokes to the seat swinging out (a player's pumping): 8 strokes, where untimed strokes
  took 9 to more than 40.
Measured (`FROM=belfry`, `LENS=1`): passes in both aspects; her out of frame at the church 0.0 s (was 7.9 landscape,
6.3 upright), lost in the frame 0.0 s (was 4.0), the fastest turn 21.6 deg/s landscape and 20.6 upright (the release),
the fastest lens move 7.8 m/s (was 310). Sheets: `/tmp/updraft-cam8b-sheet-{l,u}-blink-boarding.jpg`.
Left:
- The blink still does not read: from the low shoulder her hood, the cygnet in her satchel and the paper plane fill the
  lower right, and the cat is about 53 px (feet to ears, landscape; 73 upright) at the top of the frame with its body
  behind the sill's lip and the ivy, its face about 35 px. 80 px is out of reach from any lens holding both: the cat
  is 7 m over her eyes and 5 m off, so seen from below it is foreshortened by about a third; with her face in frame the
  cat reaches 80 px only when her hood is as tall as the frame, and with the hood a third of the frame it is 48 px.
  Closer than about 2 m the hood fills the frame; on her other shoulder stand the mast and sail. Bringing the cat
  lower for the blink (the ivy's top, or the nave's ridge by the tower) would let a shoulder shot hold both.
- Boarding: the mast still crosses her as she steps in (from the starboard beam it stands in line with where she steps
  down off the slates); the board view wants a bearing toward the stern quarter.
- Not started: the fog at the frame's edge on the walks (granary to swing 10.2 s, to the mill up to 8 s; landscape
  and upright), her walking toward the lens at corners (1.5 s at 58.9 m), the kittens' three-quarter frame, the
  kittens to the fog sea behind the tower, and the gate from the drift through the storm. The check now reports where
  the fog was lost (her, the lens, the front, its top) to lay the walking lens against.

### Phase 8c: the goodbye re-staged (after 8b)
Owns: the cat's part from her climb down to the storm (`drowned-church.ts`'s steps from `down` on, the cat's way
down and back up the ivy from `ivy.catWay()`), the look up's frames (`upFrame`, `departure`'s start,
`tuning.drownedCamera.church`'s boarding and look-up knobs), and boarding. Design.md step 8 and its shot-list line.
The cat comes down the ivy after her (backing down; `Cat.climb` along the ivy's way reversed, its body facing up the
ivy) to the ivy's foot on the nave's ridge, and sits facing the boat; aboard she looks back up at it; the slow blink;
it turns and climbs back up to the sill, where a kitten's head shows over it. The low over-the-shoulder look up holds
both. Boarding keeps the mast out of the line (a bearing toward the stern quarter). The farewell music's cadence is
timed to `blinkAt`; keep the look up about as long (`lookUpFor`) or say what moved.
Gate: `FROM=belfry` `LENS=1` both aspects, no exceptions; the cat at the blink at least 80 px tall landscape with her
in frame; 2 fps strips of the climb down, boarding and the look up to the storm's frame, both aspects; `crossings-check`
`climb-down`.
Done: [x] (branch `proto-drowned-goodbye`). As built (`drowned-church.ts`, knobs in `tuning.drowned.church` and
`tuning.drownedCamera.church`):
- **The cat after her** (`catToLight`, `catDown`, `Cat.backDown`): as the boat answers the last ring it leaves its
  kittens for just inside her light; once she is `catGap` below the sill it hops onto the lip of the light's north half,
  looks down at her, turns its back to the drop (`catTurn`), lets itself over the lip hind feet first with its front
  paws holding the edge till last, and backs down the ivy on her left, the boat's side (the cat's `back` gait: a hind
  foot reaches down, then the front on its side, its weight rolling with each). At the foot it stops and looks down
  over its shoulder (`catPause`) and drops, turning, onto the nave's ridge (`catRidge`), where it sits facing the boat
  and watches her. A kitten comes to the sill's other half (`kittenAfter`). It is on the ridge 4.2 s after she is off
  the ivy and 7-18 s before she sits, so it never holds her up.
- **Home**: at `homeAt` 7.7 s aboard (after the blink and its chirrup) it turns round on the ridge and climbs the ivy
  (`homeClimb`) to the sill beside the kitten, home 14.3 s after she sat, 3.7 s into the storm.
- **Boarding** (`boardEye`): once the boat is `boardFrom` 14 m out the lens comes round in one `boardFor` 4 s move to the
  starboard quarter (`boardQuarter`), bearings taken from the berth, not the sailing hull; she steps in once the boat
  has lain there `boardAfter` 1 s; the mast stands 35° off her line as she steps in. The boat is made fast at the berth
  from her sitting until `lookUpFor`, so air left in its sail cannot carry it off along the nave during the look up.
- **The look up** (`upFrame`): round and in from the boarding view (`tiltFrom`-`tiltTo`, `upPace`) to 3.4 m behind her
  eyes at their height, 0.6 rad round toward starboard from straight behind, on a 1.5 lens, looking half way from her
  hood to the cat's eyes on the ridge (`catSeen`): her hood large in the lower right, the cygnet beside it looking up
  too, the cat in the upper third. Held through the blink (`blinkAt` 5.6 s and `lookUpFor` 10.6 s unchanged). Then the
  release (`releaseEye`): back first and round toward the bow after, to 15 m off and 2 m over her eyes, so the cat going
  home stays above her in frame; the departure takes it from there (upright `uprightLampHer` 0.45).
- **Checks**: `drowned-run-check` finds the cat on the ridge and the kitten on the sill at the blink, measures the cat's
  height on screen (feet to ear tips by its bones) and her place, times the cat's way down and home, and fails if it is
  not home before the storm's lens takes over; with `LENS=1` in landscape it asks 80 px with her in frame. The cat yard
  has `back-down` (`cat-check.mjs`).
Measured (`FROM=belfry`, `LENS=1`): both aspects pass with no exceptions (her out of frame or hidden 0.0 s; fastest
turn 16.8 deg/s landscape, 17.4 upright; no cuts; the light out in frame). At the blink the cat is 109 px at (0.29,
0.36) with her face at (0.66, 0.69) landscape, 125 px at (0.27, 0.41) and (0.67, 0.67) upright. Sheets
`/tmp/updraft-cam8c-sheet-{l,u}-goodbye.jpg`.
Left:
- The cat on the ivy reads small in the bring view (about 40 px landscape); upright she climbs at the frame's right
  edge, and the upright bring view looks 33° down as she walks the ridge.
- At the blink the dead sail on the mast stands at the frame's right edge (about an eighth of it in landscape), and the
  release brings mast and sail beside her (never across); as the boat comes in for boarding its sail sweeps across her
  once (giving way, as the sail does over her).
- The cat waits for her to be clear of the light before it goes over, so it is on the ivy above her for only a moment.

### Phase 8d: the run's walks and the belfry's inside (parallel with 8c)
Owns: the run's walking lens (`drowned-run.ts` `layLens`, `frame`, `tuning.drownedCamera.run`) and the church's
`nest` and `sea` frames (`drowned-church.ts` `frame`'s `nest`/`sea` cases, their knobs). From 8b's Left: the fog at
the frame's edge on every walk (granary to swing 10.2 s out, to the mill up to 8 s, landscape and upright); no
walking toward the lens at corners (1.5 s at 58.9 m); the kittens three-quarter on with her face, a continuous path
in through her light if no outside eye sees it; the kittens to the fog sea never behind the tower.
Gate: `drowned-run-check` `LENS=1` from the drift to the nave and `FROM=church`, both aspects, no exceptions; before
and after stills per item, both aspects; 2 fps strips of the two walks and the kittens.
Done: [~] (branch `proto-drowned-walks`; the walks partly). As built:
- **The walks** (`layLens`, `RoofRun.fogGlance`): the laid lens wants to stand near side on (`sideOn`), either side,
  so the fog's front reaches back from the frame's edge; it is costed on the front as the run check sees it, where
  the fog trails her (`fogTrail` and `fogSlack` further), after the glance; standing at the fog's face costs
  (`fogNearCost`), behind it is ruled out; turns past `turnMost` a step cost steeply (`whipCost`); her walking toward
  it is tested where she is when the key is read (`keyAhead`, `towardAhead`). On her own way the look glances toward
  the fog's front (`fogEdge`, `herEdge`, `glanceMost`) as it would leave the frame. She takes a longer breath after
  the sheet (`setDown` 2.6 s) while the lens comes round off the sheet's view. The run check gates the fog upright too,
  reports it per walk, and traces the fog and the look.
  Measured (landscape, from the roofs): the fog out of frame 0.0 s on the walks to the tree and the sheet, 0.7 s to the
  mill (was 3.2, 3.1 and 2.8), 7.5 s to the swing (was 7.8-11.2).
Left:
- **The walk from the granary to the swing**: the fog in play lies across the mill's foot facing north as she goes
  west, so only a lens north of her is clear of it with it in view, but she turns north to the swing's board at 79 m
  and the swing's view is west of it: no lens side satisfies the fog, never walking at the lens and the turn to the
  swing's view at once. Likely answers: the swing seen from the north-west or the board approached from the west, or
  the lens north of her coming round over her as she turns.
- **Walking toward the lens** 1.4 s at 43.5 m, just after the sheet (the lens off the sheet's view comes round about
  10° short of where it was laid); 58.9 m and the tree's end are clear.
- **The kittens**: 7c's view from outside stands (her back, the kitten small). The lead turned down a lens that goes
  in through the other light: inside, the shaft between the lights filled a third of the frame, the kittens never
  showed, and the way out passed through her coat. As with the blink, the answer is in the staging: the kitten comes
  out to her where an outside eye sees them both (her turned on the sill, the kitten at its lip), three-quarter on.
- From the kittens to the fog sea the orbit round the tower's corner can still hide her (7.6 s in Phase 8).
- Not yet run: the gate from the drift to the nave, and the walks upright.
- Seen in the strips, not gated: the hoist's beam crosses the lens as it leaves the mill's view, and the green tree's
  trunk as it comes round to the swing's view.
- The swing's pumping in the run check depends on the wind's readback, which a busy GPU (another session's capture)
  starves in `shot` mode; it took 8 to more than 40 strokes, and up to 143 s, across runs.

### Phase 9: the music (parallel with 7c or 8)
Owns: the drowned score (`src/audio/drowned-score.ts`, the room's `drownedScore` pieces); renders for Jeremy to judge
by ear.
Done: [x] rebuilt for design.md item 35 on `proto-drowned-fix-music` (five pieces in the game's own voices, crossing at
chord changes), awaiting Jeremy's listen. Study: `node tools/drowned-music-study.mjs`. Checks: typecheck,
`dream-story-check`, `dream-score-check` (the key, the tunes on the bar's grid, the boat's question coming home
unchanged, the dark keeping D and A, crossings at chord changes, the overlap into the wood), `music-transition-audit`,
`check:audio` (all but `lines-score`, which fails the same way before the branch: the Lines shore pulley's restore
reads an undefined vector).

### Phase 10: polish, saves, docs and the full play
Done: [ ]

### Later
The cat in the lit window of the cottage with the red door at the very end (design.md "The cat comes home"); a small
cat-face pass (eyes slightly big and low close up, muzzle cream not white, profile ears small, mew mouth small).

## The open sea: the whale in the net

Design: design.md, "The crossings" through the end; the spec is "As decided: the whale in the net". Concept frames:
`comps/crossings/whale-net/` (`k1`–`k5`, `k2-portrait`, `notes.md`). Its own branch, judged by Jeremy on its own and
never merged without his approval. At most two build agents at once (peers share the session limit); commit after
every step. Worktrees under `/private/tmp` are wiped by a restart: the branch is the record.

Standing constraints for every phase:
- Cursor movement is the only verb; nothing timed, nothing failed; the ambient breeze does nothing to the net.
- Every response starts at the wind's target and visibly answers it; the boat is at rest, so nothing reads as the boat
  speeding up.
- Camera never jerks; no fourth wall (the child never looks to the camera or player).
- Player-feel numbers in `src/tuning.ts` (`tuning.netWhale`, replacing `tuning.sleepingWhale`).
- The meadow crossing (`toMeadow`) is as on main. The first crossing (`toLines`) changes only its whale (N1).
- Visual judging (stills against the concept frames) is done by Opus or Astra only. Code waves end with one smoke
  still set; the look loop is its own wave.

### Phase C0: direct crossing starts
Done: [x] branch `crossings-start` (9dd4ebe): `?chapter=<route>` starts any crossing at its first waypoint.

### Phase N1: the whale moves to the open sea (branch `sea-whale`)
Base: main, with `crossing-whale` (to 1900b58c) merged in, then the `toMeadow` hook removed. `crossing-whale` holds:
`src/fx/sealife/sleeper.ts` (`SleepingWhale`, phases asleep/waking/leaving/gone, breathing, shiver, slap, eye, spout
jet, roll and fluke wave), `perched-gull.ts` (to be removed), `whale.ts` (`WhaleRig` base), `src/story/sleeping-whale.ts`
(`WhaleAcross`: the speed-limit hold and release, on-screen gust detection, `updraftTarget`, coax, camera hold, child
and cygnet), whale shader uniforms (`uScale`, `uShiver`, `uSlap`, `uEye`), `spray.ts` `jet()`, `swell.ts` `uSurge`,
`tools/sleeping-whale-check.mjs`, and the pacing tool's real `SeaLife`. Its last report's knobs, traps and rejected
approaches are in the commit messages; read `git log -p crossings-start..crossing-whale`.
Owns: `src/story/journey.ts` (`toMirror`: the route lengthened, `whaleAt` cut, the encounter option), `src/story/crossing.ts`
(the pod's nudge becomes the lead; the pod's farewell waits for the whale), the encounter module, `sleeper.ts` (about
110 m, the resting pose of `notes.md` scaled up, the eye larger than the boat), the camera hold, `src/story/checkpoint-data.ts`,
`src/tuning.ts`, `tools/journey-pacing-check.mjs`, `tools/sea-check.mjs`, `tools/sea-logic-check.mjs`.
Also: the first crossing's whale (`src/fx/sealife/whale.ts`, `toLines`) becomes the same animal at the same size and
look, unnetted and far off, its timing and distance as on main, with the pale pattern under its flukes it shares with
the sleeper; `CROSSING=toLines node tools/journey-pacing-check.mjs` unchanged.
Sequenced (Claude's call, 2026-10-07): N2 starts on N1's branch once N1 lands, because the net drapes over the
re-posed 110 m head and peers are already running build agents. Branch `sea-whale`, worktree
`/private/tmp/updraft-sea-whale` (`crossing-whale` merged in at `a15e1241`).
Seam: the encounter exposes its step (`approach`, `breath`, `line`, `flipper`, `free`, `gone`) for the net (N2) to
drive and read; the pod's lead and farewell read it; for this phase a stand-in (circles over the blowhole wake it, as
on `crossing-whale`) lets the sequence play end to end.
Gate: typecheck; build; a still of the first crossing's whale diving, far off; `?chapter=sea` plays the pod, the swim, the lead, the stop, the stand-in wake, the release and
the arrival at the mirror with the mirror hidden until the whale has gone; the sea checks and `CROSSING=toMirror node
tools/journey-pacing-check.mjs` updated and passing; one smoke still set at `k1` and `k5`.
Done: [x] `b84a8448..3aaeed46`. `src/story/net-whale.ts` (`NetWhale`: `step`, `stepTime`, `goTo`, the stand-in
`breathe()` handing on to `AFTER_BREATH`), `src/story/sighting.ts` (the far sighting, kept out of `crossing.ts` because
the pacing and camera tools stub the sea life), `SleepingWhale` exposes `blowhole`, `eye`, `jaw`, `finRoot`, `finTip`,
`back`, `flukes`, `surfaceAt(x, z, out)`, `onExhale`, `stir`, `liftFlipper()`, `tickle()`, `look(at)`, `drawBreath()`,
`free()`. Saves `whale-rest` (held until the whale has gone) and `whale-gone`; QA `?chapter=whale`. The mirror and the
first crossing's whale as recorded in design.md (Pacing; The same whale on the first crossing). Left for the look:
the whale reads as a dark flat wall backlit at the hold, with no head or jaw shape; the eye reads human, its crease a
smile with lashes; on its back the near flipper stands like a plank; the far flukes look like a flat cut-out; the pod
is mostly out of `k5`. The N1 agent ran past the context ceiling (765k), so N2 is split.

### Phase N3a: the whale's own look (parallel with N2a)
Owns: `src/fx/sealife/whale.ts`, `whaleShader.ts`, `anatomy.ts`, the shape, pose and eye of `sleeper.ts` (not its
API), the hold's framing numbers in `tuning.netWhale`. Branch `sea-look` from `sea-whale`.
Seam: `surfaceAt` and the world anchors keep their names and stay true to the rendered skin; the net (N2a) drapes by
them, so a re-shaped head moves the net with it.
Gate: typecheck; build; `tools/sea-logic-check.mjs` passing; stills at `k1`, `k2`, `k5` and the first crossing's dive,
landscape and portrait, beside the concept.
Done: [x] `591cfc4a..57df85a5` on `sea-look` (with `sea-net` merged; `sea-whale` fast-forwarded to it). The skin lit
by a cool sky fill and a warm sea bounce, the sun only on the top and a narrow gold rim (`tuning.whaleLook`); the eye
a tired amber almond under a heavy lid, gloss from the sky, never emissive; a wedge snout, a raised crown with two
slits, a pale lower jaw under a mouth line (`aRig.w` is the ring height); flippers and flukes with thickness and no
backlit glow, the flippers folding back on the roll. The hold 22 m behind, 11.5 m up. Still tool:
`tools/whale-look-stills.mjs`. Left for the look: it reads smooth and toy-like (a grey blimp at `k5`), the jaw a
straight pale stripe; the net is faint at the hold (true-width strands); portrait holds need bringing in by about
0.58 and the landscape look point raised for the sky (both in `net-whale.ts` `frame()`); far off the pale jaw gives
it away too soon; the pod mostly out of `k5`. `sea-logic-check`'s featured-leap assertion fails at one seed in about
fifty on every branch since N1 (seed-sensitive, attribution open).

### Phase N2a: the net and the breath
Owns: the net (`src/fx/sealife/net.ts`: sparse deforming mesh draped by `surfaceAt`, instanced corks, boundary ropes,
the lifted patch, the peel, the flipper loop and its slide, the empty net drifting off, each driven by its own 0..1 and
scrubbable on `?chapter=whale`), step 1 in `net-whale.ts` (the breath replacing the stand-in, its invitation, the
dolphin valve lifting the mesh with its nose, the eye opening on her), the whale's voice and the net's and breath's
sounds in `src/audio/foley.ts`, `tools/net-whale-check.mjs` for step 1, the save after it. Branch `sea-net` from
`sea-whale`.
Seam for N2b: the net's API (the peel and loop drivers, the leader's near cork as a pushable float with its position,
the loop's free end for the bill) and `AFTER_BREATH = 'line'` with `line` and `flipper` left as pass-through stubs.
Gate: typecheck; build; the check with real gestures: circles at the blowhole finish the breath; the breeze, idle
and sweeps never progress it before its valve; the valve finishes it by its dolphin; each negative proven to bite by
breaking its guard once. One smoke still set at `k1` and `k2`.
Done: [x] `591cfc4a..518bf634` on `sea-net`. `sealife.net` (`net.ts`, `netShader.ts`): `lift`, `peel`, `loop`, `drift`
(0..1; `posed = true` lets a QA eval scrub them), `float` (the leader's near cork: `position`, `velocity`,
`push(impulse)`), `loopEnd` (`held` pins it to the bill). Draped once by `surfaceAt`, then carried by the anchors.
Strands drawn at true coverage, so no shimmer. The valve's dolphin leaps over the crown and flicks the mesh up
(`lendDolphin`, `poseDolphin`, `handBackDolphin`, reusable for N2b's valves). Save `whale-breath`. The whale's call
(A2 to D3, settling on B2) at the eye and at the farewell flukes, and a far echo on `toLines`. Left: the
hold's low camera sees the crown edge-on, so the net reads only as a band of corks; mid-peel the flank cells stretch
long; the loop is mostly under water from the hold. After merging `sea-look`, re-check `ACROSS_NEAR` (the near edge
above the eye) and `valveClear`. The new sounds still need an entry in `docs/contracts/audio.md`.

### Phase N2b: the child's haul
Owns: step 2 (`line`) in `net-whale.ts` with its invitation and dolphin valve, the sweep that brings the cork, the
child's catch and haul, the peel, the camera's per-step holds (the breath, the haul, the cygnet, the release) with the
portrait scale, the save after it, the rope sounds, `tools/net-whale-check.mjs` for it. On `sea-whale`.
Done: [x] `d4ac84ad..bddd45cf`. A stroke crossing the cork on screen pushes it along the stroke (away from the boat at
0.3, tethered); it knocks on the planking, she leans out and takes it in both mittens, and five pulls hand over hand
set `peel` from the line hauled in; the sheet doubles over at the leader's row (which now leaves at the cheek, 14.4 m)
and slides off along its own drape. Valve: a lent dolphin noses the cork in. Holds per step (`NetWhale.holdFor`; breath
22/11.5, line 11/4.8, flipper 11/4.6 as a first pass; portrait ×0.58). Save `whale-line`; sounds `cork-knock`,
`rope-pull`, `net-slither` (in `docs/contracts/audio.md`). Her mittens reach the rail rather than just outside it: further
puts her boots through the planking. Idle the open sea now runs about 371 s (two valves); circling and sweeping about
180 s. Left for the look: portrait holds show much empty sky and a small boat at the haul; the eye reads as a dark lens;
the net is a sparse grid on the flank; the flipper under the glass reads as a pale slab.

### Phase N2c: the cygnet and the flipper
Owns: step 3 (`flipper`) with its invitation and dolphin valve, the cygnet's swim to the flipper and back (`src/companion/`
or the cygnet's states as fits), the lazy lift and the loop's slide, the net's drift and the pod in frame at free,
the save after it, the splash sounds, `tools/net-whale-check.mjs` for it. On `sea-whale` after N2b.

Both:
Seam: each step's progress is caused only by its own gesture at its own target; steps go in order; a valve's dolphin
does the same physical act the player would have caused.
Gate: typecheck; build; the check with real gestures: each step done by its gesture; the ambient breeze and idle never
progress a step before its valve; each valve finishes its step by its dolphin; sweeps on the whale elsewhere only
tickle; saves at each checkpoint resume correctly; each negative proven to bite by breaking its guard once. One smoke
still set at `k3` and `k4`.
Done: [x] `9d8acd44..3953956a`. The bird drops in on its own side, swims round the stern, takes the end (`net.endRest`,
outside the flipper's sweep; `net.holder` read after the bird moves, 0.024 m gap) and tows it 1.4 m out; screen pace
along the flipper (`finPace`, `finAlong`, `finSweep`; `input.gust` reads low over the near water) lifts it once the
end is held (`finLift` 0.16 rad, `finSwing` 0.05, eased out), the loop slipping off in `slipFor` 4 s; `tickle(mayLift)`
keeps tickles from lifting it. Valve: a lent dolphin noses the flipper up from under 80% along. Her mittens to her
mouth while the bird is out; it climbs onto the gunwale into her arms and is stowed before `free`. The pod crosses
astern (`POD_*`) and one lent dolphin leaps side-on at the spout (`SALUTE_*`). Flipper hold 9/4 (landscape), portrait
its own high hold (`flipperPhoneDistance` 6.5, `flipperPhoneHeight` 10). Save `whale-flipper` (resumes at free); the
line's save moved to her letting go. Sounds `flipper-pour`, `loop-slip`, `swimmer-out`. The cream marks over the sail
were the cygnet's calls from the satchel, new on this branch: `watch(target, hushed)`. Checks: `net-whale-check`
`fin`, `finearly`, `finidle`, `full`, `fullidle` (each negative broken once and seen to fail); `sea-logic-check`
plays and resumes the flipper; `whale-look-stills` adds `k4-held`; `tuning` on the QA `__game`. Left for the look
below.

### Phase N3b: the frames, the net and the pod
Runs alone (Claude's call, 2026-10-08): peers' build agents share the session limit, so N3b and N3c go one after the
other on `sea-whale`. Owns: where the boat comes to rest by the whale and the whale's lie toward the sun (in
`net-whale.ts`), every step's camera hold in landscape and portrait (`holdFor`, `frame()`, `tuning.netWhale`), the
flipper's rest pose and lift (not its shape), the net's look (`net.ts`, `netShader.ts`), the pod at free, how the child
and the bird read (pose, place, light; the bird keeps its own size). Not the whale's skin, head, eye or flipper shape.
Seam: anchors and `surfaceAt` keep their names; the mechanics and the clearances of N2 stay as they are.
Gate: typecheck; build; `net-whale-check` `sweeps`, `line`, `fin`, `finidle`, `saves`; `sea-logic-check`; stills at
`k1`–`k5` with `k4-held`, landscape and portrait, beside the concept.
Done: [x] `b073d339..cdab5c51` on `sea-whale`. The lie: eye 14.5 m at 0.8 rad to port, length 1.25 rad to starboard, so the
back recedes toward the sun and leaves the frame right (at 1.1 the whole animal showed from the approach). Every
landscape hold looks into the sun; the sun is 0.65° up, so below about 7 m the crown hides it: breath 18/9.5, line
11/4.8 (as was), flipper 15/7.2 bearing 0.36 looking 9 m up, release 30/8.5 bearing 0.2 (`releaseBearing`); the
spout no longer pushes the camera back. Phone holds are explicit per step (`tuning.netWhale.phone`: distance,
height, turn, lookY, toward; `portraitIn` and `flipperPhone*` gone); the line and flipper phone holds no longer fit
the eye (it only backed the camera off). The flipper's rest pose in tuning (`finRestSweep` -1.75, `finRestRaise`
0.67), floating awash as the body rises with each breath; `finLift` 0.1 (tip up about 2 m); the loop sits at 0.9
along it (`LOOP_FROM`), so its line leaves the water at the tip. The cygnet takes the end at 4.6/1.8 and holds at
3.4/2.2, side-on, 1.19 m clear at worst. The float-line is 17 m (`LEADER`; 14.4 could not bring the cork to her
from the new lie). The net: strands 0.03 m with a 1.5 px, 0.6 opacity floor and a veil past it, darker rope and
weed, 24 weed strands, a deeper skin shadow; drifting off it opens into a raft (`OPEN`). The pod and the leaper
cross just ahead of and beside the bow, against the sea rather than the flank. Left for N3c: the whale reads smooth
and toy-like and its near flank is dark against the sun; the eye a dark lens; the flipper is a straight plank from a
root 6 m deep, so only its last metres reach the surface: at rest it shows as a pale slab under the glass, lifted as
a pale plank (a flipper that bends up toward the surface would let it lie awash along its length); the bird at the
flipper is small and dark against the sea from the hold that keeps the sun in frame.

### Phase N3c: the whale's body
Owns: `whale.ts`, `whaleShader.ts`, `anatomy.ts`, the shape, skin and eye in `sleeper.ts` (not its API, pose or lift),
`tuning.whaleLook`; the flipper's root and rest pose too where its shape needs them (keeping the `fin` clearance);
judged in N3b's frames, and far off on the first crossing. The concept's skin is simplified for the build
(`notes.md`): the target is form that reads (head, jaw line, throat, eye, flipper), never rock-like noise.
Gate: typecheck; build; `sea-logic-check`; `net-whale-check` `line`, `fin`; no first-use stalls; stills at each
keyframe and the first crossing's dive, landscape and portrait, beside the concept.
Done: [x] `fd76ee3b..a9c06a05`. `anatomy.ts`: a blunt head rising steeply off the rostrum, a saddle behind the crown
(blowhole 5.76 m), the lower jaw its own mass bowing out under `MOUTH` (in `ringPoint`, so `surfaceAt` and a
numerically solved `flankAt` follow); 201 × 128 rings. In the shader: the lip's crease and rim, broad throat
grooves, eight soft knobs (`KNOBS`), low swells. The pale lip narrows to a point under the eye (`JAW_CORNER` 0.152)
and greys into the slate from 70 to 140 m, so far off it reads as a long low shape first; a lip rising toward the eye
or gold along it read as a smile and were rejected. The eye: an amber iris (`#b06a26`) with fibres and a dark pupil
under a bulging cornea that carries the sky and the catchlight, a heavy upper lid over the top 40%, two folds above
and two below, little white. The flank: a cooler, higher fill on steep faces, less bounce, darker toward the
waterline, the rim gold on top only. The flipper: root about 0.5 m deep (`FIN_ROOT`), `finTip` now its true tip, a
narrow wrist and rounded tip (`FIN_HALF_CHORD`), knobs on the leading edge, turning over as it lifts (`finTurn`);
`finRestSweep` -1.843, `finRestRaise` 0.278; the `fin` check models its half-chord (`FIN_HALF`), clear 1.19 m. The
pale slab under the glass is the water's shallow tint over anything a few centimetres under: keep the flipper's top
above the water or well under it. About 4× the vertices and a heavier fragment shader. Left: the knobs read as pale
dots in rows; the lifted flipper reads as a pale lilac second animal before the eye; the resting flipper at `k3` a
translucent blade; the big flank still smooth where it fills the frame; the dive's flukes flat in the haze.

### Phase N3d: the net up close and the last frames
After N3c. Owns: the net's look (`net.ts`, `netShader.ts`), the pod's leaps at free, the bird's read at the flipper,
small hold changes. The mesh reads as rope lying in sags and folds over the head rather than a grid printed on the
skin; the corks read as the concept's cream spotted floats, cheated larger for legibility where needed (Claude's
call, 2026-10-08), the float in her mittens still one a child can catch; the drifting raft is not a mat of corks.
Gate: typecheck; build; `net-whale-check` `sweeps`, `line`, `fin`, `saves`; `sea-logic-check`; final stills (landscape
1600×900 and portrait about 430×932) at each keyframe and the first crossing's dive beside the concept, opened for
Jeremy.
Done: [x] `f6f7c8a6..936fbf44`. Rope knotted into irregular 1.25 m diamonds (0.07 m, lit round, knots at the
crossings), standing off the skin in seven folds and over hollows (`BRIDGE_SAG`); 46 rows × 28 columns, each row with
its own near edge (`edge` attribute: down to the water round the head, held clear of the eye, climbing along the
back), scalloped between corks; glow through the mesh 0.35 so it shows against the sky; 40 weed strands. Corks cream
with dark spots, per instance (`iSize`): the net's 0.54 m on its edges (`NET.cork`), the line's floats 0.32 m
(`NET.float`, `CORK_CLEAR` follows). The raft drifts clear of the head by the spout (`OPEN`, `DRIFT_AWAY`,
`DRIFT_OUT`). The pod lends four dolphins (slot 0 the valves' and nudges', 1–3 `SALUTES`, three leaps round the head,
caught by the sun through `uCatch`). Knobs no longer brighten; the flipper slate, wet and streaming as it lifts,
dark under the glass (×0.45 in `GHOST_FRAG`), drips in strings (`POURS`). The bird only slightly wet on its second
swim (`swimTo(…, soaked)`). Holds: flipper 11.5 back, look 8 up; release 21/7, bearing 0.28, fitting only the boat
and the blowhole (`extra` 4). No step-downs on the whale's frames with the GPU free. Left: at `k5` the whale fills
the frame and the snout is cut (eye 14.5 m off; the concept's 18–20 m as it drifts clear), one leap clear in frame;
the resting and lifted flipper read as a separate big smooth lump before the eye; portrait frames look away from the
sun into deep blue, and portrait `k5` has no leap or raft; the whale's skin smooth where it fills the frame.

### Phase N3e: the farewell clear, the flipper and the phone's light
After N3d, on `sea-whale`. At free the whale drifts clear before it spouts, as `notes.md`'s `k5` has it (eye about
18–20 m off, nearest skin at least 8 m), so the head, eye and snout sit whole in the middle distance with the leaps
round them; the flipper reads as the whale's own, joined under the jaw, not a separate lump before the eye; portrait
frames keep the gold morning though the sun can't share a phone's frame with the head and the boat.
Gate: as N3d's, final stills opened for Jeremy.
Done: [x] `fed63c7c..58172ef1`. Free, the whale swings its head away about its tail stock and slides clear
(`driftClear`: `CLEAR_TURN` 0.06 rad, `CLEAR_SLIDE` 2 m; pivot and heading restored in `lie()`), the eye 19.2 m off at
40° to port by the spout; the free timeline 2 s longer (`SPOUT_FROM` 6, `FREE_FLUKES_FROM` 13.5; everything timed in
free seconds follows). Landscape release hold 30/12. Three leaps clear in frame (`SALUTES`). The flipper about 9.6 m
(`DREAM_SHAPE.fin` 0.28), rooted just behind the mouth's corner (`FIN_ROOT`), turned up on its knobbly edge
(`FIN_EDGE_UP`), drooping, darker and less sky-lit than the body; `finRestSweep` -0.45, `finRestRaise` 0.23, `finLift`
0.16; the bird's stations moved clear of the new tip (`endOut`/`endAhead`, `birdOut`/`birdAhead`). The flipper's reach
table (`FIN_HALF`) lives in both `net-whale-check` and `sea-logic-check`: regenerate both if its shape changes; `full`
is the tight case (1.23 m, as the bird swims out past the tip). Phone holds turned toward the sun as far as their
subjects allow (`phone.*.turn`, `release.turn`); the breath's portrait has the sun. Timings (`full`): rest 88.8,
moored 210.3; idle 485.9. Left: the portrait farewell has no raft (it lies 19 m abeam beside the snout); the leapers
are dark against the sun; the flipper's root bobs about 1 m with each breath (under at the bottom, a pale horn at the
top); at `k3` the hauled net reads as a scatter of corks.

### Phase N3f: the giant
After N3e, on `sea-whale` (Jeremy, 2026-10-08; design.md, "A dreamlike giant, ancient": Claude's direction, the
concept now only a reference). Owns the whale's profile along its length and how much rides above the water
(`anatomy.ts`, the rest pose in `sleeper.ts`), its vast shape under the glass, the haze along its length, the gold
line along the back, and whatever framing the new silhouette needs.
Seam: `surfaceAt` and the anchors stay true to the rendered skin; the net drapes by them and must still lie on it;
the bird's clearance from the flipper and the mechanics of N2 stay.
Gate: as N3d's, stills at every keyframe.
Progress: `ff2330ec..3313c9bf` (first agent, handed back before the gate). The back runs level from the crown to a
small hump at 0.64 and sinks tail-down (`TOP`, `MOUND` the guard round the blowhole, `restPitch`); heights at rest
3.8 m at the snout, 5.3 at the crown, 2.9 at 0.3, 1.0 at 0.5, awash by 0.6, under from 0.7. A breath lifts the back
fully and the head by 0.3 (`breathAt`), so the flipper's root bobs 0.13 m; the net follows the spine's own rise per
row (`bodyShift`, `spineShift`). A crisp gold `ridge`, a `wet` top, `HAZE_GLSL` (`uHaze`) melting the far length; the
shape under the glass deeper, warm and soft (`glassDeep`, `glassWarm`). Left: the gate, the stills, the holds.
Done: [ ]

### Phase N3g: the ancient skin and its life
After N3f. Owns the skin (`whaleShader.ts`, `tuning.whaleLook`): barnacle crusts, healed scars, mottling, growth at the
waterline, wet streaks, the eye's age; water sheeting off the back with each breath; the seabirds on its back.
Gate: as N3d's, final stills opened for Jeremy.
Done: [ ]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's chapter-select still regenerated with the whale; the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Done: [ ]
