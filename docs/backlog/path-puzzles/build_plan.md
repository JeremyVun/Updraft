# Build plan: path puzzles

Each room's puzzle gets its own section. The design, Jeremy's words and every ruling are in [design.md](design.md);
this file only orders the work.

Final pre-merge review (2026-10-10–11): [findings and verification](final-review.md). Complete: verified bugs and
safe cleanup fixed; approved mist preserved and the old renderer removed. Landscape and portrait replays pass.
Merged into local main as `7c66739b`; both viewport replays and the merged village checks pass.
The subsequent pond and marine baseline fixes are recorded below.

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

#### Integration playtest follow-up — 2026-10-10

Jeremy's four-image brief is preserved verbatim in design.md, items 43–46. Fix the woodland silhouette, remove
the cat's redundant bow-to-thwart hop, align the cat with roof slopes, and correct the child's visible boot contact.
Inspect rendered geometry and motion, add focused regression checks that fail on the original defects, then run
the rescue and roof route in both aspects. Keep changes on `proto-drowned-integrate`; no merge or deployment.

Implemented and checked: [x]. Further findings 47–48 await Jeremy's approval; this does not close Phase 10.

Implementation and evidence (`/tmp/updraft-contact-diLDtA/`): the wood rock retains its local haze reduction
but takes the full chapter veil; the cat boards the mast thwart directly before the cuddle and its one move to the
bow; its support frame follows the roof slope, with seated haunch clearance corrected. Roof decks now expose their
actual surface to the child's feet while navigation keeps the original centre-line heights. The child fits the boot
soles to that surface and lowers her hips when either leg would run out of reach. The correction has a speed limit
so carried objects do not jerk when the supporting leg changes. `drowned-contact-check` tests posed vertices, completes the real rescue and
checks descent at 30/60/120 fps. It passes; all three sections fail against the pre-change commit `6c87e705` for the
reported defects (negative-control logs in the evidence folder). Typecheck, production build and all 51 mechanics
checks pass (`mechanics-final/results.json`), including the little-boats check of the paper boat carried in her hands.
The frozen real-render wood comparison reveals 385 silhouette pixels with the old shader; the fixed image differs
from the absent mesh by at most 1/255 there. Rescue, drift, climb-out and the untended boat pass in both aspects
(`rescue-land-final.log`, `rescue-port.log`). Close moving contact frames are in `close/`, with the review sheet
`contact-review.jpg`; `rescue-review.jpg` and `cat-rescue.mp4` show the new rescue sequence.

The final portrait roof replay completes the route, but its cat-readability gate fails at 2.1 seconds between the
mill and swing (limit 2.0); every other lens and fog gate passes. This is new approval item 47, with no camera change
or assertion relaxation. The final landscape roof replay passes all gates (`final-land.log`): cat unreadable at most
1.8 s, fog absent at most 1.6 s, no camera cuts, roof obstruction or old-tree obstruction. Its extra posed-sole trace
records one 56 mm gap at the mill slope-to-ridge transition, with grounded samples 0.1 s either side; this is approval
item 48 and requires a close motion capture before deciding the navigation correction. The full portrait trace's
largest sole gap is 30 mm at the sheet transition. Shared character tests and the physical roof samples pass, but do
not claim every transition has perfect contact. The full release playthrough and physical iPad checks were not rerun.

#### Departure playtest follow-up — 2026-10-10

Items 49–52 in design.md preserve Jeremy's brief and route preference verbatim. Work starts at `27ef6c4b` in
`/private/tmp/updraft-drowned-integrate`. Clear the green cottage's chimney from the walking ridge; keep the cat
and kitten on the sill; restore ordinary sailing and add distance through a modest bend, keeping all islands in
place; reduce and space the plane's wind traces and ease its release. Review remains at port 5331, without merge
or deployment. Evidence: `/tmp/updraft-departure-Y5m3eS/`.

Implemented and checked: [x]. The posed child clears the rendered chimney by 27 cm; restoring its old location
fails the check with zero clearance. The cat and kitten stay on the sill through both full church-to-wood replays.
The 233 m course uses main's normal 5.8 m/s ceiling and reaches the woods about 49 seconds after cast-off. It adds
about 53 m of actual sailing compared with the former course at normal speed, without moving islands or berths.
The lighthouse remains lit until 34 seconds, with its lamp in frame through the fade. The plane's two traces are
thin and spaced, and the lifted, gentler release remains visible in portrait. The final captures are prefixed
`chimney-final`, `church-land-final`, `church-port-final` and `plane-port-final` in the evidence folder.

Typecheck and production build pass. The mechanics batch passed 50 of 51; `journey-pacing` incorrectly accumulated
all storm waypoints as one turn. It now keys each leg independently without relaxing its circling limit, and the
targeted rerun passes (`journey-pacing-final.log`). All 51 checks therefore pass. The dedicated boat check also
requires normal speed, fewer than half a turn per waypoint, two spaced gust traces and the cat at the sill.

The landscape still revealed a cropped child at the slow blink despite the passing face-centre gate. This became
item 53. Findings 42, 47, 48 and 53 were subsequently approved and resolved in the following round; Phase 10 stays open.

#### Approved remaining findings — 2026-10-10

Jeremy: "you are approved to address all identified issues". Address design.md items 42, 47, 48 and 53:
tree gaze priority, portrait cat visibility after the mill, the mill step-up contact, and the landscape farewell's
cropped head. Verify the actual posed silhouettes and contact, then replay both aspects. Work starts at `62daa64a`
in the integration worktree; no main merge or deployment. Evidence: `/tmp/updraft-final-findings-WhJDz0/`.

Implemented and checked: [x]. The tree failure came from sampling after Carry changed `lookAt`, although the
head had already been posed. Sampling the actual pose input passes the unchanged limits; a 24-second browser
sample looks across the lane 70% and up the tree 30%. The portrait camera gently tightens its lens on the turn
toward the swing, reducing the longest cat-readability gap from 2.1 to 1.9 seconds without moving the camera or
relaxing its limits. The mill slope and ridge now follow the physical roof for navigation, removing a 22 cm
root jump. Four gait phases at 30/60/120 Hz keep a supporting sole within 24 mm of the roof; restoring the old navigation
fails the vertical-speed check. The farewell reserves the child's whole head and tests posed vertices: both
aspects retain the hood and face while keeping the cat readable. Restoring the old framing fails the new check.

All 52 mechanics checks pass together (`mechanics/results.json`). After the final portrait lens adjustment,
typecheck, production build and the focused camera checks pass. The complete landscape roofs-to-woods replay
passes (`landscape-final.log`); the complete portrait roof route and farewell framing pass (`portrait-final.log`).
That first portrait run fails a later storm brightness gate at 20.3/255. A separate portrait departure rerun,
with flashes measured throughout each screenshot capture, passes at 11.1/255 (`portrait-departure.log`), without
changing the 12/255 limit. The intermittent surge remains recorded as new review item 54 rather than being
declared fixed. The close mill clips and final farewell stills are in the same evidence directory.

Jeremy subsequently pointed out a circular foreground edge in the storm capture. Read-only diagnosis isolates
the lantern's fog density sample: it switches at the closest point to the lantern crossing the water endpoint.
A frozen shader comparison and an exact boundary mask confirm item 55; the proposed sampling correction is
recorded in design.md. Only the diagnostic browser's shader was changed. Evidence: `/tmp/updraft-fog-circle-jkq4FF/`.

#### Lantern fog boundary correction — 2026-10-10

Jeremy: "then fix it.. omg". Apply item 55 in the integration review build. The fog sample now stays within the
visible ray and includes its surface endpoint, so the lantern glow remains continuous as the water crosses the
closest point to the light. `lantern-fog-check` renders the real shader around that boundary at three camera
heights; the corrected shader passes and restoring the old shader fails. Typecheck, shader bounds and production
build pass. The first moving portrait run exposed the related reflection cutoff at water height ±0.4 m and
failed the brightness gate at 18.3/255. Reflection now follows the actual water surface and fades with distance;
the water explicitly identifies itself to the fog shader. Reflected fog views no longer enable direct light
halos whenever a wave rises above 1 m. The GPU check covers the old wave-height and camera-height boundaries,
and restoring the reflection cutoff fails. Final landscape storm replay passes (largest non-flash rise 9.5/255).
Both moving captures show the circles gone. The portrait replay reaches the woods and passes its framing but
still fails item 54's separate brightness gate at 16.0/255; that item remains open.
Evidence: `/tmp/updraft-lantern-fix-U0Lxxo/`.

#### Further rescue/contact polish — 2026-10-10

Requested items 56–62, full brief in design.md: remove untended tub completion, show the active tub destination
with the stairs' golden ghost treatment, raise the waiting cat clear of the water/eaves, fit boat and roof contact
to their visible surfaces, reduce recurring calls and correct the mill perch. Disable village fog rendering in QA
by default (`villagefog=1` for comparison), without changing story progression or the production default.
Verify unattended waiting, both player-driven tub trips, actual skinned paw/body clearance on the bow and strand
roof, and the rotating stock. Then inspect close captures and play the rescue through the first roof.
Implemented and CPU checks pass at 30/60/120 Hz; removing the pose fit fails the new regression with a 5 cm
haunch penetration. The first real-pointer rescue takes two strokes to the roof and four back to the boat.
The ghost destinations are visible at both ends, and the cat stays clear of the water. Completed in review:
final portrait rescue/stranding and landscape first-tree replays pass, along with the targeted contact,
camera and farewell checks. Evidence: `/tmp/updraft-cat-polish-gJ6o1k/`.

#### Rescue pacing and cheaper mist — 2026-10-10

Completed in review: items 63–70; item 71 is an implemented and tested mist trial. Verbatim brief and ruling
remain in design.md. The tub rejects pre-rescue input; the cat shakes on the thwart and hops to the bow;
boat-to-roof landing and the first-tree chimney route clear the actual skin. Calls distinguish stranded and
rescued states, grounding gets a prompt reaction, two seconds of sailing precede becalming, and the windless
drift has no score. The belfry mother sits alert, including after checkpoint restoration.

The 30/60/120 Hz sequence checks pass, including 11 cm mast, 21–24 cm hull and 20 cm chimney clearance.
The input-gate negative control fails as intended. Final typecheck, production build, 14 quick checks, boat,
camera, contact, farewell and rescue checks pass. Real-pointer portrait rescue and belfry-to-woods replays,
and the landscape first-tree replay, pass. The mist's portrait storm brightness check passes at 10.7/255;
the original fog fallback still has item 54's separate intermittent brightness failure.

The initial mist trial used four analytic height layers and retained bell clearing and the hidden-boat reveal. Matched local
belfry Ultra samples give 60.0 fps with mist or fog off, against 53.9 fps with the original fog (six-second
samples, 1600×900, render scale 1.5). Early-rooftop samples give 60.0 fps with mist/off and 59.5 fps with original;
the gain is concentrated in the denser view. Its flatter appearance needs Jeremy's review before production adoption.
Port 5331 remains the review server: `villagefog=mist` selects the trial, `villagefog=1` the original, and the
default initially omitted fog for comparison; the later correction below enables mist by default. Production remains on the original renderer. No merge/deploy.
Evidence and captures: `/tmp/updraft-cat-polish-gJ6o1k/`.

#### Tower, boarding camera and lantern polish — 2026-10-10

Jeremy's verbatim follow-ups and issue list 76–81 are in design.md. The cat jumps from an earlier point on the
existing railing to a landing farther west on the nave, clearing the tower's dressed corner by about 0.29 m.
The stone band projects past the corner posts and quoins instead of sharing their depth; mesh ray checks
measure 5–8 cm separation where the old geometry returned coincident faces.

Boarding and the look-up share their horizontal camera position and aim. The lens lowers and tilts toward the
cats, blending subject bounds and zoom. Full real-pointer belfry → woods replays pass in landscape and portrait;
boarding-to-look-up pan is 4.9°/5.5° with only 0.6°/0.3° of reverse tracking, and there are no cuts. The whole
kite remains in frame at boarding, and the child and both cats remain visible. A first candidate that passed an
isolated fixture failed the full transition; the final check covers the preceding return and boarding too.

The answering-lantern billboard fades on approach and stays off aboard and throughout the storm. The original
boat/water lantern lighting remains. CPU checks explicitly seed the bell-answer state, and full browser
replays start before ringing; a direct storm checkpoint does not reproduce that state.

Sheet stroke response increases from 0.75 to 0.95, requiring about 21% less wind for the same fill. Real-pointer
checks pass for moderate input, the full crossing, gentle input, wrong-way input and stopping mid-crossing.
The sheet's held hem also lagged behind the hands with either sensitivity; grasp pins now follow directly.
Contact checks use the rendered held hem, not its ideal gathering point. At 60 Hz the full pointer replay's
worst hand gap is 6.7 cm; CPU contact checks pass at 30/60/120 Hz.

The rescue cue and effect are verified together after 2.00–2.03 seconds of sailing, following the completed wet
shake and bow hop. Typecheck, production build, 14 quick checks and focused CPU regressions pass. Evidence:
`/tmp/updraft-polish-Aciibr/README.md`. The full roof-route replay also passes, including the sheet, mill, swing and tower approach. No merge or deployment.

#### Bell-summoned return — 2026-10-10

Jeremy's latest ruling is recorded verbatim in design.md, item 83. The final bell answer now carries the boat
all the way to the berth as she climbs down. The gentle breeze starts immediately on descent; the old
90-second stall fallback and sail invitation are removed. The existing route, steering and mooring slow it
alongside, then it waits for boarding and the farewell.

`drowned-return-check` passes at 30/60/120 Hz with spaced and rapid bell answers and no player wind: motion
builds within two seconds, the boat moors in 18.1–18.4 seconds at a peak 1.99 m/s, and she boards by about
24 seconds. Before the bell the lost boat stays still. Disabling the automatic return makes the test fail.
The release harness no longer classifies this intended return as a puzzle fallback.

Real-pointer belfry → woods replays pass in landscape and portrait with no gestures after the bell. The boat
moors in 17.8 seconds and she is aboard in 23.4–23.5 seconds. Boarding through look-up pans 5.3°/5.6° with only
0.3°/0.2° reverse tracking; no cuts. The pickup kite and both cats remain visible at their checked beats.
The build (including typecheck), focused boarding and lantern checks pass. Captures were inspected and opened
in Preview. Evidence: `/tmp/updraft-summoned-z3InKr/README.md`. Review server remains `http://127.0.0.1:5331/`;
no merge or deployment.

#### Continuous mist correction — 2026-10-10

Jeremy's further playtest found a hard blue strip during becalming and a fog bank that moved with the camera
(issue 82, verbatim in design.md). The trial sampled a ray-dependent height and front, then filled four hard
layers. Its apparent density changed when the same sightline was viewed from the other direction.

The replacement uses continuous height, front and side ramps in world coordinates. Their product is integrated
exactly between ramp boundaries, with no noise texture reads or density marching. A soft circular clearing
removes the high bank when the bell rings, retaining the low water mist. The trial's colour is less blue and
includes the existing sunset crest light; the original production fog renderer remains unchanged.

The actual shader passes 54 reverse-ray and split-ray cases, including clearings and near-horizontal views.
Worst optical-depth disagreement is 0.00023; the old shader differs by 11.52 and has a 0.95 opacity jump across
2 mm where the replacement's largest change is 0.0087. Continuous rescue → becalming → ridge and tower-foot →
woods landscape replays pass, with the bell reveal and ordinary storm lantern intact. A frozen-world camera
sweep confirms the mist remains aligned with the roofs. Build, 14 quick checks and lantern continuity pass.

Local six-second Ultra samples at 1600×900, render scale 1.5, hold 60 fps with mist on or off, both before a
bell ring and with a 31 m clearing. These are local desktop measurements, not device-wide performance claims.
Evidence: `/tmp/updraft-mist-Cq6Qis/README.md`. The portrait bell → woods replay also passes, with no camera
cuts. The field checks pass on Metal and SwiftShader; restoring the old shader fails as expected.

#### Farewell camera floor and simpler bell — 2026-10-10

Jeremy reopened the fog at the lowest point of the farewell and the bell's resistance to slow or repeated
strokes; his full brief is in design.md. The live fitted camera reached 0.54 m even though the authored eye
was 1.58 m high. Raised the landscape eye, widened its final lens from 1.4 to 1.25, and raised the water
clearance to 2.05 m. The child and window cats remain framed; the live landscape hold now stays above
2.088 m through 8.5 seconds. Fog shaders, density and storm timing are unchanged.

The bell now receives bounded energy from stroke distance, including slow movement, and feeds that momentum
near the bottom of its swing without opposing its velocity. Both ends remain free to turn and ring. Input
no longer locks out a swing or resets it toward one side. Each ring retains the bronze, sound and pale ripple.
This supersedes Phase 7b's original one-stroke/one-ring interaction. One strong stroke rings twice as it decays;
repeated strokes sustain it, and no input leaves it still until the existing safety valve.

Typecheck, production build, 30/60/120 Hz bell cases, landscape/portrait camera and boarding checks, bank
motion/clearing, and passive boat return pass. The new checks fail against the old code: all rapid-input
rings on one side, and a lens height of 0.600 m. An initial live gentle test caught insufficient response to
short strokes; energy gain was tuned against those real mouse gestures. The final landscape slow-stroke
replay and portrait rapid-stroke replay pass, including descent, boarding and the full farewell hold; the
portrait continues through the storm into the woods with no camera cuts. The separate bell stage also passes
firm strokes and incidental movement: it settles to 0.014 radians after input stops, while tiny strokes only
rock it. Evidence, before/after captures,
negative checks and camera traces: `/tmp/updraft-belfry-input-DrJAFo/`. Review remains port 5331.

#### Clear ivy climb — 2026-10-10

Removed the lower stone belt from the west, ivy-covered tower face. Three separate strips retain the belt on
the other faces; the window sill remains. The existing geometry check now verifies the clear climb and the
remaining bands' 0.05–0.08 m separation from the corner posts. Typecheck, production build and that check pass.
Live tower-foot → climb → belfry captures confirm the unobstructed vines; evidence:
`/tmp/updraft-vine-strip-XK0H9r/vines-climb.png`. Review server remains port 5331. No merge or deployment.

#### Softer mist edge and belfry continuity — 2026-10-10

Jeremy's new tree-exit still showed the continuous mist's straight front. The cheap renderer now spreads that
front fade over 10 m and adds four broad, rounded wisps. Their density is integrated analytically in world
coordinates, with no new render passes, noise texture reads or ray marching. The fixed bank heading and steady
advance are retained. The tree-to-sheet replay passes; its frame `after-film-035.png` shows the same view as the
reported edge. Paired six-second 1600×900, ratio 1.5 samples both held 60 fps, p99 16.8 ms, with no intervals over
25 ms. This is a bounded local desktop sample, not a claim about all devices.

Jeremy then reported the plane disappearing during the ivy climbs and fog suddenly returning during descent
and the window farewell. The plane was explicitly hidden; it now moves to the backpack on the approach and
stays visible through both climbs and the belfry visit. The fog clearing used a narrower height fade than the
surrounding bank, then switched it off when their heights met, producing a 0.0404 opacity jump in the actual
shader probe. Its fade now scales continuously with the bank; the same probe's largest step is 0.000443.

The bell's clearing stays low through descent and the farewell, then blends out over the first four seconds
of sailing. It is fully gone before the storm closes in. The storm's density, colour, height, light and timing
are unchanged by this clearing fix. The skip directly to boarding initializes the same clearing as natural play.

Typecheck, production build, fog motion/clearing, 54 shader reversal/split-ray cases, and boat return at
30/60/120 Hz pass. The natural landscape tower → four rings → descent → boarding → farewell replay passes,
with zero hidden plane frames and the plane held at the backpack on both climbs. The capture now keeps the
window cats clear above the water-level mist. The portrait four-ring → descent → farewell → storm → woods
replay also passes, with no camera cuts; the departure and storm captures retain the mist and lantern lighting.
Evidence: `/tmp/updraft-fog-edge-g2HYUh/`. No merge or deployment.

#### Wider boarding view and bell ripple — 2026-10-10

Jeremy approved the review: "ok looks good". Boarding now includes the window cats throughout, with a higher
aim and a wider shared camera position for the look-up. The framing protects the child's whole body rather
than only her hood. The normal bronze material remains unchanged when the bell rings; its physical quiver
remains. A softer, pale, uneven ripple replaces the saturated double ring and remains visible after earlier
rings clear the mist.

Whole-body CPU framing passes in 2:1, 16:9 and portrait, with at most 0.2° reverse camera movement. The
farewell cat measures 42 px in landscape and 50 px in portrait; the former close-up's 45 px minimum is now
35 px to accommodate the requested wider composition. Restoring the old camera tuning fails the new
body and window bounds (1.47 and 1.37 NDC). Bell input checks pass at 30/60/120 Hz; production build passes.

Real four-ring captures show the pale ripple on later strikes and the cats visible during boarding and the
look-up. Portrait body/window bounds pass at 0.793/0.502; its new farewell-only stop initially hit an
unrelated final woods-arrival assertion, corrected in the harness. Landscape continued to the woods and
flagged a 12.1/255 one-second brightness change against the existing 12 threshold; do not claim the full
storm gate passed. Its camera trace shows 5.49° pan, 0.25° reverse tracking, and no cuts. The brightness
finding remains on the review list; no visual change was made after Jeremy's approval.
Evidence: `/tmp/updraft-boarding-wide-7EC5Eu/`. No merge or deployment.

#### Visible sailing delay and steady fog — 2026-10-10

Jeremy's latest timing instruction adds another two seconds. The old two-second timer started when the boat
was released, so sail recovery consumed most of it: the baseline replay travelled only 1.15 m before the tone.
The timer now starts at 1.2 m/s and waits four seconds. Music continues through recovery and the first two
seconds of sailing, then fades over two seconds. The original tone and weather change start together;
the wet shake and bow hop remain. The cat's later roof landing moves slightly away from the hull to preserve
clearance under the changed swell timing.

The fog controller still turned its broad bank toward the child, swinging its edges at up to 34.63 m/s and
backwards at 29.06 m/s in the first-roof → tree replay. It now keeps the original approach heading and maps
route progress to monotonically advancing world positions. Village/woods fade follows the boat; the belfry
clearing follows the child's height. Camera motion changes neither. Jeremy explicitly prefers the fog
overtaking parts of her route; no protective gap or retreat is added.

The final natural portrait rescue → tree replay passes with audio recorded from the game's master output.
The cue and effect begin 4.00 seconds after sailing speed, with all three real note schedules checked;
the boat travels 9.25 m since release. Through the first roof and tree, shader uniforms show no pivot,
retreat or opacity change, and at most 3.20 m/s advance. Captures were inspected. CPU rescue checks pass
at 30/60/120 Hz (4.00–4.03 seconds; 15–19 cm hull clearance), as do fog motion, automatic boat return and
the production build including typecheck. Restoring the old bank or the two-second interval fails the new checks.

An earlier full roof-route capture completed the interactions but failed its old minimum-gap gate as fog
overtook the route; that gate is now diagnostic to match Jeremy's ruling. It also recorded a 4.2-second
front-visibility gap near the swing. That separate framing check remains unresolved; this is not a claim
that the full chapter visual gate passes. Evidence: `/tmp/updraft-calm-fog-1UEjg3/README.md`.
Review server: `http://127.0.0.1:5331/`. No merge or deployment.

#### Follow-up regressions — 2026-10-10

Jeremy's verbatim corrections are in design.md, “Tub control and rescue sound correction”. Keep checkpoint
attraction: the untouched movement came from the approaching boat pushing the tub, not that assistance.
The tub starts outside the hull's approach; its horizontal displacement is zero over 90 seconds including the
entire approach at 30/60/120 Hz. Restoring the old start fails with 0.389 m of movement. The previous test began
after the hull stopped and missed the defect.

The shake lands on the far half of the thwart facing the bow, settles for 0.65 s, completes before the bow hop,
and the child stays seated. The temporary rest uses `drownedQuiet`, releasing the score over the two seconds
of sailing without muting the cue bus. Actual Web Audio renders contain the becalming tone (-34.3 dBFS RMS),
resume the fog score, and enter the storm score 0.125 s after the storm request. The farewell can no longer
hold its major melody for 32 seconds into the storm. Sustained notes hold through the handoff fade so their
natural envelopes cannot drop out early; the score's 497 checks, including the forest overlap, pass.
Storm sailing is capped at 4.5 m/s (main measured 5.8 m/s;
the review's closer camera makes that pace feel faster). The same curved route takes 53–56 seconds from casting
off, the lighthouse stays lit until 34 seconds, and no islands or later crossings move.

The cheaper mist is now the dev/QA default, `villagefog=0` explicitly disables it, and `villagefog=1` selects
the original. Production remains on the original. A full tower-foot → woods replay with the mist passes;
captures show the boat hidden before ringing and the lantern answering through the mist. Rapid bell strokes
no longer reset the active swing: sustained/alternating input rings 8–9 times in 12 seconds at 30/60/120 Hz,
then comes to rest. Single input rings once; weak/absent input does not ring.

The complete rescue/stranding replay passes in both aspects, with the portrait capture showing the wet shake
and its water droplets before the bow hop. Four rapid real-pointer rings take 4.7 seconds and the portrait
tower-foot → woods replay passes: the boat answers, returns, and both cats stay at the window.
The existing paper kite and bow tail float beside the pickup, on the bow's water side. Actual pickup replays
pass in both aspects; a posed-corner framing check keeps the full diamond onscreen when she boards.
Typecheck, production build, quick checks, focused mechanics and rendered audio pass. Evidence and the selected
captures: `/tmp/updraft-tub-manual-ImGNBj/README.md`. The cheaper mist remains a review trial; original-fog
fallback item 54 is still open, and no merge or deployment has been performed.

#### Integration takeover — 2026-10-10

Jeremy: "ok proceed". For this takeover he also approved Codex doing the remaining visual work:
"Yes, use Codex for this takeover". His full playtest brief remains verbatim in design.md items 22–35.

Continue on `proto-drowned-integrate`, worktree `/private/tmp/updraft-drowned-integrate`, starting at `7007e9ab`.
The seven fix branches are already merged. The previous session hit its weekly limit while investigating
`boat-check`; the combined browser checks had not run. Keep Jeremy's existing play build on the roofs branch
until the integrated result is ready for review. Main merge and deployment remain separate.

The restored `sail` checkpoint now resumes the designed air-dies beat silently, and its boat check passes.
The music-transition audit passes the longer 88-second farewell into the wood. The merged fog, rescue and storm
have been checked in both aspects, and all five browser checkpoint round-trips pass. That first pass found the
portrait sheet-exit gap; the approved follow-up below fixes it.

Jeremy subsequently asked for a list of issues to approve before fixes, and flagged the roof-arrival camera.
His instruction is preserved verbatim in design.md, "Takeover review", with review items 36–41. Keep new camera,
fog and performance findings as proposals pending his approval. Results and captures:
`/tmp/updraft-takeover-TUMeWz/`.

Jeremy then approved items 36–41: "proceed" (2026-10-10). Current work: forward roof-arrival dolly; portrait
sheet-exit framing; mill exit without the extra look back; Ultra fog cost and shader warmup; fixture repairs and
triage; readable portrait goodbye. Preserve the continuous camera, visible companions, wind interactions and
the fog's shape/coverage. New evidence: `/tmp/updraft-approved-Ad2y4S/`; baseline `91255b9c`.

Approved follow-up:
- The missing late shader is the bell's bronze material, constructed by `ChurchArrival` after boot. The village now
  owns one reusable bell, prepared before warmup and reset by each church controller. The belfry browser probe reports
  zero stray programs and zero first draws after boot, down from one.
- Two fog candidates were rejected: branching around zero-opacity lighting made the shader slower; reducing the
  march from 20 to 16 steps showed no useful gain. With fixed fog time and no other GPU capture, the baseline ran
  59.3–59.5 fps, the 16-step candidate 58.5–59.1 fps, both with a 16.8 ms 95th percentile. The original 20-step fog
  remains intact. These desktop results do not establish smoothness on an iPad or under sustained thermal load.
- Fixture repairs pass: bandage deformation (zero geometry difference), all eight journey crossings, Lines audio
  (92 checks), kite placement, plane routing and little boats. Lines now drives the real pinwheel, the kite checks
  its actual offshore piling, and swimming checks folded wings per `e4a0e38ab` instead of obsolete wing flicks.
- At distant village entry the vanes differ in speed by 0.050178 rad/s, but each is settled under 0.05 rad/s and
  within 0.1 rad of the wind. Their angle and speed are identical on village arrival. The gate now bounds each
  settling speed at entry and retains the existing pairwise parity requirement after arrival. No gameplay change.
- First camera candidates rejected by full portrait run: advancing the mill approach increased missing fog to
  8.1 seconds, and the initial short mill handoff left the cat below the readability threshold for 2 seconds.
  A west-side handoff made her walk toward the lens for 3.2 seconds. The local sheet-exit setback reduces its fog
  gap to 1.2 seconds. A southern handoff passed the original gates but its foreground branches were unacceptable.
  The run check now raycasts the old tree's actual geometry (three body points, sampled every 0.1 s; two blocked
  points for 0.5 s fails). A corrected CPU study includes the fog's real update and initial route distance; the
  earlier abbreviated study omitted those and is not a fog-framing verdict.
- The mill camera keeps the wide view while she walks, draws closer over the last four metres before her pause at
  the swing, stays below the branches, then rises to see the cat descend the cottage. It fits her face with a 0.6
  margin; portrait widens over the last eight metres without changing the fog's aim. The landscape swing look stays
  nearer to her to clear the tree. `run-final-land` passes every gate with no tree obstruction or camera cuts.
- Earlier portrait candidates passed every gate but still briefly cropped the hood: the safety frame protected
  only a point. `subjects.primaryRadius`
  now reserves world-space padding in fitting and the safety frame; only this portrait approach opts in, with a
  0.6 m head bound. The regression passes at 30/60/120 Hz and fails when that bound is disabled. The general camera,
  all 24 crossing-camera cases and drowned camera mechanics pass. Final replay `run13-port` passes every gate:
  at the mill-to-swing transition fog is absent at most 1.7 s, the cat unreadable 1.8 s, and the old tree hides her
  for 0 s. Her longest walk toward the lens is 0.3 s; no camera cuts. Inspect a motion strip alongside point gates:
  the centre of a face being visible does not prove that its hood or the foreground branches clear.
- All 50 mechanics checks pass together (`mechanics/results.json`); the production build passes with the existing
  bundle-size warning. Rescue/stranding passes in both aspects with the forward arrival dolly. At portrait roof
  contact the viewing direction's dot product with the boat's heading is 0.825, and the destination ridge is on screen
  (`arrival-port-final.log`). Final roof routes pass in both orientations (`run13-port.log`, `run-final-land.log`).
- Arrival direction now has a real-cast CPU regression at 30/60 Hz in both aspects, calm and gusting. It passes;
  disabling the pre-contact dolly makes it fail with a backward direction dot product of -0.443. The new browser
  roof-framing assertion initially referenced a non-exported constant; that fixture is corrected to use the roof deck.
- `run9-port` stopped at the unchanged tree-gaze assertion before reaching the mill (25% across, 21% up in its
  six-second sample). This is recorded as review item 42; no gaze code or gate was changed. The full landscape
  church replay passes, including four bell answers, the slow blink and the full 88-second farewell into the wood.

Integration verification:

| Check | Result |
| --- | --- |
| Production build (includes TypeScript) | Pass; existing bundle-size warning |
| Boat mechanics and restored `sail` | Pass |
| Browser save/reload | Pass for all five drowned checkpoints; belfry rerun passes with the reusable bell |
| Boat ground contact | Pass after replacing the obsolete passive-village fixture with the real storm cast |
| Foghorn timing and restore | Pass; uses the longer storm's timing, retaining the approved sound parameters |
| Camera mechanics | Pass at 30/60 Hz, landscape/portrait, calm/gust; see fixture corrections below |
| Landscape and portrait rescue/stranding | Pass, including 30 seconds with the stranded boat stationary in each |
| Landscape roof crossings | Pass including LENS gates; no camera cuts and cat retained after the mill |
| Portrait roof crossings | Pass including fog, cat readability, head extent and tree clearance; no cuts (`run13-port`) |
| Landscape and portrait church through storm into wood | Pass including LENS gates, four bell answers, kittens, farewell and fog; both land 88 seconds after boarding |
| Portrait goodbye readability | Pass with the new 45 px gate; cat is 50 px tall at its slow blink, up from 39 px |
| Cat/kitten call marks | All seven vocal calls in the church-through-wood capture have visible marks; footsteps excluded |
| Music transitions | Pass: ten handoffs and 39 internal sections, including the full 88-second farewell |
| Shader gate | Pass after seven equivalent ascending-ramp corrections; belfry now reports zero late shader programs |
| Broad mechanics | All 50 pass together after fixture repairs (`mechanics/results.json`) |
| Audio group | Initial 16/17 pass; repaired Lines score now also passes its 92 assertions |

The camera check referenced the removed `villageBearing` field and applied whole-hull framing to the close
farewell looking up at the cat. It now measures the actual entry lens on the stern quarter (within 60°, instead
of a 0.2-radian constraint on the removed internal bearing), and starts storm hull/elevation checks after the
departure dolly. The church's browser LENS gate covers the farewell. The entry limit follows the authored
quarter view while the boat changes heading after the stairs; it does not require the lens to track that turn
instantly. No game camera values were changed. Roofs/run browser checks now use the shared GPU lock.

Resolved fixture failures under review item 40 (no gameplay changes):

| Check | Repair and result |
| --- | --- |
| `bandage-cost` | Supplies the required `nudgeAt` and `nudgeSlope`; zero geometry difference across 620 frames |
| `journey-pacing` | Uses the real storm cast for the drowned departure; all eight crossings and six conditions pass |
| `lines-score` | Supplies boat position and interpolation vector; all 92 checks pass |
| `kite-logic` | Asserts the Lines kite's actual pulley-piling tie-off instead of requiring dry ground offshore; passes |
| `little-boats-logic` | Requires folded swimming wings per the approved `e4a0e38ab` change; faster paddles still required; passes |
| `plane-routing` | Supplies repeated player strokes across the real pinwheel to haul the boat in; passes |
| `drowned-gating` | Bounds each vane's settling speed on distant entry, preserves pairwise parity on arrival; passes |

Phase 10 remains open for Jeremy's playtest and music listen, the Ultra investigation and new review items 54–55. The
whole-journey release playthrough has not been run during this takeover. Ultra fog cost is not a claimed fix. The integration
dev server is on `http://127.0.0.1:5331/`; the original roofs play build and main remain separate.

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

### Phase N3f: the giant's form
After N3e, on `sea-whale` (Jeremy, 2026-10-08; design.md, "A dreamlike giant, ancient" and "Its form, from a real
whale, not the concept"). Owns the whale's section and profile along its length (`anatomy.ts`, the rest pose and
breath in `sleeper.ts`), its shape under the glass, the haze along its length, the gold line along the back, and the
holds the new form needs. A first form (a tube sunk tail-down behind the crown, `ff2330ec..2e176d32`) was rejected by
Jeremy: its light, haze, glass, breath and eye work may stay where they serve the new form. The form is shown to
Jeremy as stills before the holds and the gate.
Seam: `surfaceAt` and the anchors stay true to the rendered skin; the net drapes by them and must still lie on it;
the bird's clearance from the flipper and the mechanics of N2 stay.
Gate: as N3d's, stills at every keyframe.
Done: [x] `fea5d161..2ab6edf9` (the rejected first form `ff2330ec..2e176d32` before it). An upper cap and a lower hull
meeting at a broadest line, each shaped along the length (`TOP`, `WIDEST`, `BOTTOM`, `HALF_WIDTH`, `ROUND`, `KEEL` in
`anatomy.ts`; `halfWidthAt`): the head flat-topped, about 18 m wide and 12 m deep at the eye, the lower jaw bulging
up to 15% wider than the upper at the lip, a broad soft crest down the snout (`RIDGE`); broadest about 2.3–3 m under
the water at s 0.36–0.45, about 23 m across (1.5× a blue whale's breadth); the tail stock narrow and deep. Above the
sea: snout 1.1 m, the wedge rising to the blowhole's guard at 5.3 m 23 m back, the back level at 5.1–5.25 m to 55 m,
lowering into the haze, a small dorsal knuckle (`DORSAL_AT` 0.74) about 79 m back, under from about 100 m; flukes
about 1.7 m down (the pale slab trap now applies to them). `restPitch` tips the head 0.08 rad, level to s 0.6, then
tail-down; anchors eye 2.30, blowhole 5.30, back 5.15, flipper root −0.09 m (the flipper and `FIN_HALF` unchanged).
`EYE_S`/`EYE_Y` shared from `anatomy.ts`. Light, haze, glass and `breathAt` from the first form kept. The net's gap
to the skin: worst −0.056 m, 99% within 0.65 m. Left: every near hold was lowered for the rejected low back and now
sits at the back's height (the flank a dark wall, the sun half hidden at the haul); `breathEvery` still 7 s; up close
the flank is a huge smooth wall until the skin pass.

### Phase N3g: the encounter staged (awe, sorrow, courage)
After N3f, on `sea-whale` (Jeremy, 2026-10-08; design.md, "The feeling and the bar", "Claude's direction for the
encounter", "One encounter, seamless", the body never answering the wind). Owns the approach's reveal in the haze,
the sorrow at rest, the breath's held exchange of looks, the haul and the bird's swim as one flow: `net-whale.ts`'s
hand-offs between steps, the whale's attention (its eye on her and the bird), the child's and the bird's acts at
every beat, the camera's holds and moves on the new form, the score thinning in the sorrow, and the removal of the
body's wind response (`tickle`, the shiver and slap). Claude plays the build in motion before it is done.
Gate: typecheck; build; the whole `net-whale-check` (its tickle assertions become "the body never answers");
`sea-logic-check`; `CROSSING=toMirror node tools/journey-pacing-check.mjs`; a real-gesture recording of the whole
open sea with frame strips.
Done: [x] `f285042d..7c67b8af`. The body never answers the wind (`tickle`, the shiver and the gust slap removed;
`net-whale-check` watches every resting and woken frame for anything but its breath moving it). `breathEvery` 10 with
the sputter on the same exhale; the score thins through `Crossing.hush` (`hushSorrow` 0.9 at rest, `hushCourage` 0.45
once its eye finds her, 0 at free). The haze reveal (`uLost`, `LOST_GLSL`: `lostFar` 0.75 lifting between 80 and 25 m
short of rest); its far sighs spread with distance (`whale.seenFrom`); she points and the bird peeks at each breath in
view. The look between them, in seconds after the first full breath: in over her left shoulder at 2.4 (`holdFor('look')`,
4 s ease), its eye opens on her at 3 (`eyeOpening` 0.55), blinks at 7.6 (`whale.blink()`), her mitten out at 8, its call
8.9, the bird peeps 10.1, her eyes to the float line 11.6, the line at 13. The bared head runs wet (`whale.stream`);
let go she sits back, the bird sees the loop (1 s), she looks to it (1.9 s), it goes at 3.4 s; its eye follows the
bird; the lift slow and heavy (`LIFT` 6.6 s, `slipFor` 5). Holds: sorrow 20 m back, 8.5 up; look 6 back, 3 up; line
12.5 back, 7.2 up; flipper 12 back, 7.5 up. Played: rest 88.8, line 111.6, flipper 143.8, free 166.8, moored 215.7; idle
moored about 480. Left (Claude, playing it): the holds above the back look down on it like a map; the lifted patch
stands as a pyramid of net over the back with corks up its middle; the first column is lost in the glow; the look's
frame has her as a hood cut off in the corner beside a wall of sail (half out in portrait); the far sigh is not seen;
her pointing barely reads; the flipper's lift reads as a claw with streaks; the eye's iris glows orange; `wrongway`
fails as it did on 96137ec2 (a reverse stroke draws the cork in); a phone's swipe along the flipper needs 0.8 screen
heights a second.

### Phase N3g2: the courage at the bar
After N3g, on `sea-whale` (Claude's calls after playing N3g, 2026-10-08; design.md, "1. The breath", "3. The cygnet",
"Camera"). Owns: the holds brought down so the ridge stands against the sky and the approach's descent into them; the
look's frame as the owl's (landscape and portrait); the patch falling aside off the blowhole once it has breathed; the
first column reading against the glow; the far sigh in the haze seen and her pointing read; the flipper's lift as one
pale paddle side-on with water running off it; a reverse stroke pushing the cork away; a phone's swipe along the flipper
at a phone's pace. Not the eye's colour (N3i), nor free and gone (N3h).
Gate: as N3g's, `wrongway` included.
Done: [x] `a41aff1d..e28bfebc`. The holds sit low, the lens allowed a metre over the water beside it (`holdClearance`) and
backed off at most `holdRoom` 2 m (the look not at all): sorrow 13 m back, 2.8 up, 0.25 to port (the back's ridge and
its gold line against the sky, the sun's disc behind the back, its glow over it); line 9/3.4/0.3; flipper 12/3.2/0.55,
from the port quarter so the flipper is side-on; phone sorrow 18/2.8, haul 6/3.2 aimed at its eye (`eyeward`), bird
12/3.4 turned −1.5. The approach comes down in one ease: no rise over the pod; led, the view comes `leadDrop` 2.6 lower
and `leadIn` 10 nearer, and the hold (`holdFrom` 75) takes it on down. The lead's sigh: `sighIn` makes it breathe
`leadSigh` 4 s after the lead, and a sigh seen from over 40 m off rises as a soft plume of `COLUMN` puffs scaled to the
distance (`spray.plume`, over 2.2 s); she sits up and leans toward it (`knowsLean`) `knowsFirst` 1.2 s before each such
breath (`untilSigh`), the cygnet peeking at the first. The patch: `net.slump` from `slumpFrom` 3.2 s into the first
breath over 3 s, sliding it 4.2 m down the far side of the crown in loose folds (`net.raised` is the patch's lift
everywhere it is read). The first column: `spray.column`, round puffs lit as one shape (`COLUMN`, the side each left
from in `iC.w`), 13 m (`firstBreathHeight`). The look: she slides 0.35 m to the port rail, turns 0.95 and leans 0.9 out
toward its eye (`lookSlide`, `lookTurn`, `lookLean`, eased by `drawn`); the camera 3.8 back, 1.75 up, 0.22 to port,
looking 0.33 toward its eye (the focus is the eye there), her face the primary; the mast stands at the frame's right
edge and the sail beyond it once the boat has settled (the bird peeks at the edge beside it); phone 2.9/2.55, turn
−0.45, close behind her on the line to its eye. The flipper: `finPoint` (anatomy) gives its surface for the mesh and
`sleeper.finAt` the posed point; lifted it pales (`finRaised` in the skin) and the sea pours off the whole trailing
edge in threads and drops. The cork: a wrong-way stroke pushes it a little away and `settleCork` draws it back to where
it lay (`corkSettle`); `wrongway` failed because the check parked the pointer by dragging it back across the cork, now
it leaves and comes back as a hand does (`jumpTo`/`away`), and it fails with the push reversed. The flipper's pace is
eased over a few frames (`finPace` 0.45): a 150 px, 0.34 s phone swipe lifts it, a 1.5 s drag does not.
`sea-logic-check` measures the blowhole as a target only while the circles are asked (NDC 0.12–0.13). Played: rest
88.7, line 112.2, flipper 143.6, free 165.8, gone 195.3, moored 215.0 (`full`: moored 216.3); idle moored about 480
(pacing `calm` arrivalReady 479.7). Left: from behind, her short arms never clear her hood, so her pointing at the lead
and her mitten at the look barely read (her lean, her head turned and the cygnet carry them); her hood is a dark
backlit shape in the look; the sail can show at the look's edge while the boat is still settling or the boom swings;
on a phone the paper plane on her back hides her hands at the haul and the bird sits at the edge of the bird's hold;
the eye's orange iris is N3j's.

### Phase N3h: the release
After N3g2, on `sea-whale`, in parallel with N3j (Claude played N3g2, 2026-10-08: the giant now breaks the horizon and
the far sigh reads; its first column reads as violet smoke with rings in it, not mist). The river-spirit moment, from
the bird lifted in to the start of the dive: it drifts clear and breathes free, the tall plume against the sunrise, its
mist drifting down over the boat in the gold light; its call turning glad; the sea brightening round it; the net let go
working loose into a raft and sinking away into the deep; the pod's leaps; her wave and the bird's call; the score's one
bloom; the release view easing out from the low holds without a lurch, the giant still breaking the horizon. The first
column and the spout read as mist, white lit gold through the sun and soft grey-blue on the shadow side, never
coloured smoke or ring bands. Owns the free step in `net-whale.ts` and the free motion in `sleeper.ts` up to the dive,
the net's raft and sinking (`net.ts`, `netShader.ts`), `spray.ts`, the sounds and score there.
Gate: as N3g's.
Done: [x] `20eebe58..2c47c804`. Mist (`spray.ts`): `COLUMN` puffs are soft balls all the way from the middle (no rim
term, so no rings), shaded as the stairs' cloud is, the sky's brightness without its colours (`mistShade`, lilac-grey in
its folds), a share of the low sun scattered all through, gold where it is thin toward the sun, warming as it thins; the
first column, the far plume and the sighs share it. Free, in seconds of `whale.time` (`sleeper.ts`): it drifts clear as
before; `SPOUT_FROM` 6 the spout, `spray.jet` plus a `spray.column` `spoutBreadth` 1.5 times as broad, 20 m; the
reward phrase and three leaps as before; from 7 to 13.8 its mist comes down over the boat (`spray.veil`: puffs from
high in the plume carried on their own way, slowing as the square of their life, and fine drops glinting); the sea
brightens round it from the spout (`water/glad.ts`, `gladSea` 0.8 out to `gladReach` 34 m along its head and forward
body: the body lifted, the sun's glitter tripled); at `GLAD_AT` 9.2 its glad call (`whale-glad`: the same voice,
brighter, rising to E instead of settling), her eyes on its eye, from 10.5 up into the mist; at 11 the cygnet calls back
(`call(true)`); she waves from the spout to 12. The dive now starts at `DIVE_AT` 15.5 (every dive key is timed from it;
`FREE_FLUKES_FROM` is `DIVE_AT` + 3). The net: let go it drifts to `raftPort` 8 / `raftAhead` 9 (to port and ahead
of the boat at rest, turning `raftTurn` 0.5) and works loose into a raft by the spout (`DRIFT_TO` 24; a save at the
flipper backdates the letting go by `FREED_BEFORE` 7.5 so it is a raft by the spout there too); from the spout's end
to `DIVE_AT` − 1 it sinks (`net.sink`, `uSunk` = 4 m × sink², drawn through the glass by `SINK_VERT`/`SINK_FRAG`: each
point slid up its view ray to the surface, the mesh fading fast, the floats going down whole 0.6 m behind it and
fading slowly; corks are now a transparent material so they fade rather than dither), and is hidden at sink 1. The
release view: free holds `release*` as a hold of its own, eased to from the flipper's in one move over `releaseMove`
7 s (no second ease): 18 back, 3.6 up, 0.3 to port, `releaseLookY` 5, `releaseToward` 0.5, backed off at most
`releaseRoom` 4; phone 12/3/−0.3, lookY 12, toward 0.4, `phone.releaseRoom` 4; what it keeps in frame moves from the
flipper to the spout with the same ease; a phone's view turns between flipper and head by angle (through the point
between them it swung round fast). Camera through the release, measured on the recordings: worst 0.6 m/s² landscape,
0.5 portrait (N3g2: 1.9 at its first second). Played (`full`): rest 88.7, line 111.8, flipper 144.5, free 167.2,
spout 173.2, gone 201.9, moored 221.2; idle moored about 485 (pacing `calm` arrivalReady 484.7). Left: in the webm the
spout's upper crown reads paler grey-white than in stills; the sea's brightening is subtle at the low angle; the
pod's own leaps cross close by the boat as before; the hand-back to the crossing camera as it goes (`gone`) still
jerks (about 9 m/s², as on N3g2's recording) — N3i's.

### Phase N3i: the farewell
After N3h, on `sea-whale`. It dives as a whale does, never rolling (Jeremy, 2026-10-08): the head goes down, the long
back arches slowly forward and slides under, the flukes rise high once with their pale pattern and slip under; its
swell lifts the boat; the pod goes with it; the sea stills toward the mirror's glass and the boat comes about. Two
things N3h left, both Claude's judgement on playing it (2026-10-08): the free spout, the climax image, reads in motion
as a grey wedge widening up out of the frame, where the first column now reads as white mist lit gold; it becomes that
mist, taller and glad, bushing out at its crown against the sunrise. And the hand-back to the crossing camera as it
goes jerks (about 9 m/s²); it becomes one ease. Owns the dive and gone in `net-whale.ts` and `sleeper.ts`, the swell,
the free spout in `spray.ts`, the camera through it.
Gate: as N3g's.
Done: [x] `c201f8eb..b9aaae07`. The dive (`sleeper.ts`, from `DIVE_AT` 15.5): one forward glide down a way the whole
body follows, with no roll. Each spine sample's pitch comes from the way at its distance past the bend, `DIVE_SLOPE`:
a 1.5 m arch rising behind the bend, then down to 69°, steeper as the tail comes. The pitches are integrated from the
bend, which stays where it lay on the water at `BEND_AT` 0.22, its blowhole (`farewell`, known from `DIVE_AT` − 3).
Its rest posture fades as each part reaches the bend; the head eases onto the way over `HEAD_DOWN` 6.5 s.
`GLIDE` is its speed in m/s, 8.6 at most through the arch, slowing to about 1.3 round the flukes (`glided`,
`glidedAt`). The tail stock (`STOCK` 0.84 to `STOCK_TO` 0.95) lifts by `LIFT_BY` (metres it lies past the bend) to
`FLUKES_UP` −1.45. As the flukes rise the whole body turns `TURN_TO_HER` 0.7 of the way about the bend's vertical, so
their undersides face the boat. The wave is a hinge flex `WAVE_FLEX` 0.16 and a slight roll `WAVE_TURN` 0.12.
`fluking`, `going` (`GOING_AFTER` 1.2 s after the notch is under), gone 3 s after it, `diving`, `flukesShown`.
The swell (`surgeHeight` 0.6) spreads from the arch and reaches the boat just after the flukes are under. The lens
leaves out the swell's lift (`surgeAt`), so the boat rises in frame. The pod leaps away over where it went (`podYaw`).
The sea's brightening gathers to the bend and fades out by the notch's going under.
The spout: `spray.spout`, its own kind (`SPOUT`), the first column's puffs with a firmer lumpy edge, the backlight on
their rims, `spoutHeight` 15 and `spoutBreadth` 1.2, its crown in the release's frame (`releaseLookY` 10). `MAX` 3200.
The camera: as it dives the view eases once over `farewellMove` 7 s to the farewell's hold, framed on the bend (hold
entry 14, `farewell*`; phone `farewell`). Once gone, the hand-back is one linear ramp of the hold (`handBack` 16 s,
smootherstep on screen). The blend's turn is unwound frame to frame. Gone, the hold's subjects let go (`extra` → 0).
A phone's farewell keeps the bend in frame, not its sunk eye, whose 80 m depth had shoved the view down.
Camera from free to the hand-back's end, worst acceleration: landscape 1.97 m/s², in the middle of the swing
round behind the boat as it comes about; portrait 3.75 m/s², the same swing's turn. N3h's was about 9.
Played (`full`): rest 88.7, line 111.5, flipper 144.7, free 167.4, spout 173.5, gone 206.7, moored 233.1. Idle,
moored about 496 (pacing `calm` arrivalReady 496.5). Beats in seconds of being free: spout 6, its eye going under
about 19, the arch at its height about 22, the flukes up from about 27 and highest about 31 (notch about 12 m),
under 36.1, going 37.3, the swell under the boat about 38.5, gone 39.1.
Left:
- In the webm the spout reads paler lilac-white than the render, and at its full height its crown reaches the top
  of the release frame.
- For about a second the rising flukes stand edge on, a thin blade, before the turn opens them.
- In the landscape recording, the left fluke tip touches the top of the frame at its height.
- The sail stands near the stock as the flukes rise; their tips overflow a phone's frame.
- She is small in the farewell's frame, so her waves barely read.
- The hinge shows a seam, and the tail stock's pale underside reads as a stalk; both are the skin's.
- From the flukes under to the hand-back, about 8 s of quiet sea, sun and boat.
Claude's judgement, 2026-10-08, in motion: the dive is one continuous whale's movement and the arch under the low sun
is lovely; the flukes standing over the boat with the sun beside the sail are the encounter's strongest image, and
its weakest form: flat faceted boards with a saw edge against the sky, a cow's patches, a pale round stalk, a seam.
The quiet after they go under is right, the sea stilling. The spout reads as soft mist, a little grey.

### Phase N3j: the ancient skin and the eye
In parallel with N3h, on its own branch `sea-whale-skin` off `sea-whale` (merged back before N3k). Owns the skin and the
eye in `whaleShader.ts`, `whale.ts`'s look uniforms and `tuning.whaleLook`, shader only (the form, the anchors and the
net's drape untouched): barnacle crusts, healed scars, mottling, growth at the waterline, wet streaks, drawn as bold
simple painted shapes like the rest of the game, fine against its bulk; the eye old, wet and kind in its folds, its iris a
deep warm brown catching the sun in one bright point (not the lit orange N3g left). The same skin on the first
crossing's whale.
Gate: typecheck; build; stills of every hold (landscape and portrait) and of the first crossing's whale, beside N3g2's.
Done: [x] `2adf00d4..8ab6e76b` on `sea-whale-skin` (`whaleShader.ts`, `tuning.whaleLook` only). Every mark sized in metres
on the skin and faded to its mean tone below a few pixels: broad tone patches (`tone`); two scatters of ragged pale
grey-blue dapple 0.4–1.4 m (`dapple`, `dappleCover`, `dappleAmount`); a few soft pale wavering scar strokes 3–8 m,
kept off the eye (`scar`, `scars`, `scarAmount`); barnacle clusters of shaded soft domes round the head's knobs, the
chin, a few head patches and the flipper's edges, a pale crust far off (`crust`); a dark olive band with a ragged top
on the rest waterline (`growth`, `growthReach`; the line is the table `REST_SEA` with `tuning.netWhale.roll`, re-measure
it if the rest lay changes); faint wet runs (`runs`); the ghost body softened (`dry`). The eye: a brown iris `#82502b`
with fibres, the sun through the cornea keeping its hue (`caustic`), one warm-white catchlight (`catchlight`) and a faint
second from the sea, dimmed to a quarter when shut; fine age lines behind the corner. Claude's judgement, 2026-10-08:
the eye is right, kind and wet, and the whale now reads as a mottled blue whale rather than a plastic model, but not
yet as ancient: the dapple's soft round spots read as out-of-focus light up close, the scars do not read, the
barnacles show only at the snout beyond the near frames, the growth is a plain dark band, the wet runs never show.

### Phase N3k: its age
After N3j, on `sea-whale-skin`, in parallel with N3h and N3i; shader only, as N3j. The skin taken to ancient where the
near frames see it: barnacle crusts on the chin, the lip and the head near the eye (clear of the eye itself), scars bold
enough to read as old healed marks, the dapple painted with edges like lichen on a rock (the owl's rock is the
reference), the growth with life in it. Still gentle to a child.
Gate: as N3j's.
Done: [x] `a8aafc13..9d5cb9c3` on `sea-whale-skin` (`whaleShader.ts`, `tuning.whaleLook` only). Lichen replaces the
dapple: colonies of crisp-edged rosettes (about 0.3–1.1 m, and small flecks), paler at the rim, dense at a colony's
heart and thicker about the face, never on the eye or the low flank (`lichen`, `lichenWarm`, `lichenCover`,
`lichenAmount`); scars as soft pale strokes 2–4 m with rounded ends, a pale haze and a thin shade under the lower edge,
mostly along the body (`scar`, `scars`, `scarAmount`; raked pairs and tapers dropped, they read as claws); barnacles as
tight lumpy pale crusts of soft domes on the knobs, the chin, the lip line and round the eye clear of its folds, greyer
on the pale lip, shading the skin under them (`crust`, `crustShells`); the weed a ragged band on the rest waterline with
moss and a faint yellow film above (`growth`, `moss`, `film`, `growthReach`; upright fronds dropped, they read as trees);
a soft grain (`grain`) and three long creases arching over the eye (`creases`). The eye's clearance is one measure,
`face`, 1 at the edge of its folds. Claude's judgement, 2026-10-08: it now reads as an old weathered whale, like an old
hull from the bird's hold; the lichen is a little decal-like beside the owl's rock, a crust behind the eye is prominent
at the look, and the weed can read as a dark hedge along a shore at a glance.

### Phase N3l: the flukes
After N3i, with N3k merged on `sea-whale`; in parallel with N3m. The flukes made the farewell's finished image (the
design's form section): a humpback's swept pair, a thick rounded leading edge thinning to a fine trailing edge in
soft scallops either side of the notch, the tail stock a deep narrow keel flowing into them with no seam; their
underside pale with a dark margin and a few old marks of its own, barnacles along the edges, the same pattern on the
first crossing's whale. The second where they rise edge-on opened by the turn. The farewell's frame holding their
tips in landscape and on a phone, the sail clear of the stock, her waves plain. And the lichen gathered on the head
and the top of the back, thinning down the flank. Owns `flukes()` and the tail stock's rings in `anatomy.ts`, the
skin in `whaleShader.ts` (not its wet terms), the dive's turn in `sleeper.ts`, the farewell's hold in `net-whale.ts`,
their tuning.
Gate: as N3g's, with stills of the flukes high and slipping (landscape and portrait) and the first crossing's dive.
Done: [x] `e5406172..c3e4fb91`. The form (`anatomy.ts`): the flukes (about 34 m across) drawn at 200 stations of 36
round a blade section (`blade`: round at the leading edge, fine behind; thickness 0.34 of the chord at the root, 0.12
at the tips), the trailing edge five soft lobes a side either side of the notch (`SCALLOPS`, 0.2-0.45 m, the right
fluke's unlike the left's) over the unscalloped `flukeLine`; the tips' trailing point is unchanged, so `DREAM_SCALE` is
too. The tail stock from 0.82 a deep narrow keel (`ROUND`/`KEEL` up to 1.7/1.9 at 0.88) tapering in depth into the
flukes' root, flaring out in their plane (`FLARE` 0.2 rest units, `FLARE_DEPTH` 0.1) and ending inside them at
`TAIL_END` 0.975, so nothing shows in the notch and there is no seam; the hinge's flex is spread over 0.9-0.96 rather
than stepping at 0.93. The skin (`whaleShader.ts`, shared with the first crossing's whale): under the flukes pale
(`flukePale` 1.12) with a dark leading edge, tips and scalloped trailing margin reaching into the pale in a few soft
tongues, a dark wedge up from the notch into the stock, a dark comma on one fluke and a round spot on the other, a few
specks and faint old scratches, barnacles on the edges (`flukeShells` 0.7); above them the back's slate, little lichen.
The stock without the waterline's weed (`stock`, from 0.74); the throat's pale ends by 0.7. Lichen gathers on the head
and the top of the back and thins down the flank to `lichenFlank` 0.2 of its cover. The turn (`sleeper.ts`; `uTurn` in
the rig and in `point()`, over `STOCK_TURN` 0.76-0.93): `TURN_TO_HER` 0.75, `YAW_SHARE` 0.6 of it the body about its
bend over `YAW_WITH` 0.1-0.85 of the lift, the rest the stock turning them about its own line from the lift's start
(`TILT_WITH` 0.3), never tipping them more than `TILT` 0.3 (about 17°) while low; meanwhile they trail low from the
stock (`TRAIL` 0.7 rad, straightening over `TRAIL_UNTIL` 0.4-0.85). `LIFT_BY` has all of the lift 4.5 m past the bend
(was 6); the wave first leans them away from her. The farewell's holds: landscape 17 m behind, 1.8 m up,
`farewellBearing` 0.6, `farewellLookY` 19; phone 40/2/-0.5, lookY 26, toward 0.6.
The lens's own composition layer (`CameraDirection` in `camera-direction.ts`) keeps an orbit it chose earlier: in a
full play 0.18 rad through the whole release and farewell, none when resumed from the flipper's save. Both holds were
tuned so that either way the sun stands between the stock and the sail, the sail clears the stock on a phone and the
tips stay in frame (headless, `FULL=1` in the scratch `frame.mjs`).
Beats in seconds of being free: the flukes break the water about 28.5, stand from about 29.5 to 34 (the notch highest,
about 13 m, at 31), under 36.1, going 37.3, gone 39.3. Played (`full`): rest 88.6, breath 111.2, line 144.1, flipper
166.9, free 172.9, gone 205.8, moored 232.4, fin clearance 1.48 m. Idle, moored about 496 (pacing `calm` arrivalReady
496.5). Camera from free to the hand-back's end, worst acceleration: landscape 1.95 m/s², portrait 4.5 m/s² (N3i 3.75;
the phone's hold now stands farther back), both in the hand-back's swing round as the boat comes about.
Left:
- For about a third of a second the near fluke rises as a broad diagonal paddle over the sail before it opens; never
  the thin blade, but not yet opening from the first frame.
- Her waving mitten: she is bigger in landscape (about 95 px tall at 1600×900, was 79), but low in the frame with the
  hull cut, and her mitten waves against the sail, so it is still not plain; on a phone she is about 23 px.
- On a phone the rising fluke passes the right edge for about a third of a second, and as they slip under the near
  tip drifts to the left edge.
- The sun stands behind the stock on a phone, so its disc does not show there.
- The first crossing's whale still flexes its flukes with a step at the hinge (`whale.ts`, `s > FLUKE_HINGE`); far
  off it does not show.
Claude's judgement, 2026-10-08, from the stills and sheets: the flukes now read as a humpback's, swept and
scalloped, pale beneath with a dark margin and the first crossing's comma, the stock flowing into them as one animal;
standing over the boat beside the sun they are the image this encounter needed. But the landscape frame is so low
that the boat sits on its bottom edge, the hull cut and her only a dark head against the sail, so her goodbye is lost.

### Phase N3m: its life
After N3i, on `sea-whale-life` off `sea-whale`; in parallel with N3l. Each slow breath lifts the back a little and
water sheets off its top in glinting streams, the sea swelling and settling round it; a few seabirds stand far along
its back as on a rock, never near a step's target, and lift off as it spouts free, gone before the dive arches the
back. Owns the breath's lift and the water off it in `sleeper.ts` (not the dive), `spray.ts`, `wake.ts`, the whale's
`uWet` sheeting, the seabirds (the gulls in `src/creatures/creatures.ts` or a few of their own), their tuning.
Gate: as N3g's.
Done: [x] `2f87b831..9f0afb5f` on `sea-whale-life`. The breath (`sleeper.ts`): as each breath's rise passes `SHEDS_AT` 0.2 of
its cycle, its first full breath half way into drawing it, and the free spout a second before it, `rises(deep)` (deep
0.45 at rest, 1 awake, 1.3 the first full breath, 1.5 the spout) sheds the sea off its back: `uWet` is raised along
s 0.15 to 0.8 to `sheetWet` 0.8 (times deep, at most 1), in over a second and gone over `sheetFor` 4 s (`shedSea`);
white water laces the waterline over s 0.18 to 0.68, seven in ten on the near side, for the first 3.5 s; and one low
crest of sea goes out from its flank (`swell.ts`: `uHeave`/`uHeaveAxis`, `heaveLift` in the shader and the same on
the CPU, so the boat, the corks and the swimming cygnet ride it), `heaveHeight` 0.3 m times deep at the flank, out at
`heaveSpeed` 3.5 m/s, `heaveWidth` 6 m, settled by `heaveFor` 6 s. Measured at the line's hold, the boat rises about
0.15 m more about 3 s after a waking breath, its worst vertical acceleration 0.58 m/s² (0.47 without). The skin's wet
terms (`whaleShader.ts`): over the body the sheet is now `rills` (threads about 1.4 m apart along it, wandering down
the flank, each carrying its water in pulses that run down it, mirroring the dawn with a little of the low sun behind,
`rills` 0.4, with gold glints, `glints` 2.5, fading to a faint sheen below a pixel); the old streaks were keyed to the
ring's angle and lay as horizontal bands along it. The Fresnel wash a sheet added to the body is down from 0.5 to
0.15. The bared head running wet at the haul (`stream`) takes the same threads. The seabirds (`seabirds.ts`, the
gull's geometry and colours from `gulls.ts` with folded wings and legs of their own; `whale.birds`): four at
`seabirdPerches` (s 0.54, 0.565, 0.665, 0.7, on the ridge), `seabirdSize` 2.2 times a gull (about 5.7 m across the
wings), hazed as the back they stand on (`HAZE_GLSL`, now exported); they ride its breath, turn their heads every
1.2 to 5 s, shift their feet every 8 to 22 s and stretch their wings every 25 to 55 s (`seabirdStretch` 1.6 s). From
`seabirdsAfter` 0 s after the free spout, 0.18 s apart and up to 0.2 s more, each crouches, opens its wings over 0.3 s
and flies a curve through its perch, a climb toward the head, a point `seabirdAside` 4 m to the tail side of the
spout and `seabirdHeight` 10 m over it, and `seabirdAway` 75 m off toward the low sun, over `seabirdFlight` 8.2 s,
fading into the sky behind it over the last `seabirdFade` 2.5 s: all gone by about 14.9 s into being free (`DIVE_AT`
15.5). `seabirds-lift`: a flurry of heavy wingbeats through `WorldFoley.whale`. Where they show, landscape: not in the
sorrow, look or line holds (s 0.45 lies past the right edge); in the bird's hold the far pair (s 0.665, 0.7) stands
against the sky right of the sail, about 63 to 67 m off, the near pair behind it; at the spout they rise at the right
edge, cross the sky to beside the spout by about 9.5 s into being free and go off small into the sun by about 12.
Portrait: the back from s 0.45 lies off the right edge in every hold, so they are seen only in flight, entering at
the right edge beside the spout from about 10 s into being free to about 12.5. `net-whale-check`: all 11 cases pass
(`fin` clearance 1.61 m, `finidle` 1.65, `full` 1.49). Played (`full`): rest 88.7, line 111.5, flipper 144.2, free
167.1, spout 173.0, gone 206.2, moored 232.8; idle moored about 496 (pacing `calm` arrivalReady 496.4).
Left:
- On a phone the standing birds are never seen, and in flight they are small and pale against the bright sky beside
  the spout for two or three seconds.
- In the bird's hold the sail hides the near pair; in the release hold the far pair is off the right edge until it flies.
- At twice a gull's size they read as big gulls as they pass the spout.
- A weak breath at rest sheds only faint threads; the crest at the boat is under the sea's own swell (0.15 against
  about 0.35 m), so it reads as the boat lifting a little more rather than as a wave seen on the water.
- In a still the threads can read like the pale scars; they differ in motion.
- Taking off, for 0.3 s the folded and the open wings show together.
- At its height the lace can read as a bright line along the near waterline.
Claude's judgement, 2026-10-08, from the sheets, stills and the recording: the seabirds are right, birds on a
rock on its far skyline, then rising one after another to wheel over the gold sky beside the plume and off into the
sun. The breath is not yet seen: in motion the threads are too faint to read as water running off, in a still they
read as scratches or wires on the skin, and the crest is never seen as a wave on the water.

### Phase N3n: her light and her goodbye
After N3l and N3m merged on `sea-whale`; in parallel with N3o. The look's frame finished (N3g2 left her a dark
backlit hood filling a quarter of the frame): her whole seated figure smaller in it, the sun's rim on her hood and the
lantern warm on her cheek, her head and mitten turned to the eye, the eye large. The farewell's frame keeping its low
height and the flukes over the boat with the sun beside the stock, but the boat whole above the bottom edge and her
waving mitten against the sky or the sun's glow, not the sail; on a phone she reads as a child waving. Owns the look's
and the farewell's holds in `net-whale.ts` and `tuning.ts`, and the light on her (the child's own look, its lantern
and rim).
Gate: as N3g's, with stills of the look and the flukes high, landscape and portrait, in a full play and resumed.
Done: [x] `df1738cb..b8d1c6e0`. The look: the boat's sail swings out over her starboard quarter and its
mast stands 0.8 m ahead of her, so a view that sees her side brings the sail in behind her; the landscape hold looks
from nearly astern of her, `lookDistance` 4.6, `lookHeight` 1.6, `lookBearing` 0.08, `lookToward` 0.66, `lookLookY`
2.6: her figure from hood to gunwale about 315 px of 900 at the frame's right (was cut by the bottom edge), the eye
about 245 px across, the mast at the right edge. Phone `look` 3.8 back, 2.1 up, turn −0.42, lookY 2.5, toward 0.5:
her seated in the boat (about 180 px hood to gunwale of 932), its eye above her, the mast just past the right edge.
Her light (`Traveller.lent`, a per-frame vector the story lends and the traveller lets go after each frame; `uLent` in
the child's shader, so nothing changes where it is not lent): the sun along her outline where it turns toward it, the
lantern wrapped round her face and side, a lift in her shade; `lookLight` [2.2, 2.5, 0.6], `farewellLight`
[1.5, 0, 0.3], eased at `lightEase` 1 a second. Her reach to its eye is `lookReach` (unchanged values). The farewell:
landscape `farewellDistance` 21, `farewellHeight` 1.2, `farewellBearing` 0.3, `farewellLookY` 16 (was 17/1.8/0.6/19):
the boat whole on the water about 75 px above the bottom edge, the flukes' tips inside the top, the sun between the
stock and the sail. As it dives her seat turns to where it goes down (`turnToward(at)`), she goes along the thwart to
the port rail (`farewellSlide` 0.35 at `farewellRailEase` 0.8) and, while it flukes, holds a mitten out at her side
waving slowly (`waveGoodbye`, `goodbyeWave` [0.55 out, 0.12 up, 0.15 sway, 4.5 rad/s]), so it shows beside her hood
against the sun's glow rather than in front of the sail. Phone `farewell` 22 back, 1.2 up, turn −0.6, lookY 24,
toward 0.25 (was 40/2/−0.5/26/0.6): she is about 70 px seat to hood (was about 38 by the same measure), the flukes
tower past the frame's left edge, the sun between the stock and the boat. `Shot.authored` (`camera.ts`,
`camera-direction.ts`): a story that frames a view itself lets any turn the lens chose earlier ease out and has no new
one chosen; the encounter sets it while its hold has any weight, so the full play and a resumed save now frame the same
(headless: offset 0 through the look and the farewell either way; it was 0.18 rad in a full play). The child is
unchanged elsewhere (the dark wood and the meadow, stills before and after). Camera on the recordings (full play with
gestures): through the look worst 1.6 m/s² landscape, 2.7 portrait; free to the hand-back's end worst 2.3 landscape,
4.6 portrait, in the hand-back's swing as the boat comes about (N3l: 1.95, 4.5). `net-whale-check` all 11 cases pass
(`fin` clearance 1.61 m, `finidle` 1.65, `full` 1.5); played (`full`): rest 88.6, breath 111.4, line 144.5, flipper
167.2, free 173.3, gone 206.5, moored 232.9. Idle, moored about 496 (pacing `calm` arrivalReady 496.4).
Left:
- In landscape her face stays inside her hood and the hood is most of her figure; her mitten held out to its eye
  never shows from behind (the arm folds back beside her hood).
- The mast stands at the landscape look's right edge and shows there as the boat rolls; her bag is near that edge.
- The goodbye mitten never rises above her face: a reach above face height stops level with it (the child's arm,
  cause not found), so her goodbye is a small mitten swinging at her side, about 30 px out in landscape and 15 on a phone.
- On a phone the left fluke is cut by the frame's edge through the farewell.
- In 2 of 5 full plays with real gestures (both of the first two recordings) the look's camera dropped to its 1 m
  clearance about 4.7 s into the first breath and swung through the boat at about 20 m/s; three later plays and every
  resumed one were smooth, and the logged state was the same (`/tmp/updraft-seawhale-n3n-glitch-full-*`).

Claude's judgement, 2026-10-09, from the stills and a full play of the merged sea: lit, she is a child in a yellow
coat rather than a dark lump, and the phone's look holds her seated under the eye. The farewell in landscape is the
encounter's image now, the boat whole under the flukes and the sun between the stock and the sail. The landscape look
is not yet the owl's: her hood fills the right corner, cut by the frame, and her reaching mitten never shows. The
intermittent drop of the lens through the boat in the look must not reach Jeremy.

### Phase N3o: the breath seen, the spout white
After N3l and N3m merged on `sea-whale`; in parallel with N3n. Each breath's water seen as water: sheets of the sea
pouring off the ridge and down the flanks in broad glinting falls that thin to threads and drops at the waterline,
never thin lines like scars or wires; the crest seen on the water as a low ring of swell going out and lifting the
boat. The free spout white mist lit gold on its sun side and soft grey-blue on its shadow side, as the first column,
never a grey pillar. And the pod's featured leap kept in frame: at the check's seed 147 on the merge, the 30 fps,
gust 20, circling case, a dolphin surfaces about 13 m from the lens below the bottom edge during the approach (the
seed only exposes it; the player would see a leap cut by the frame's edge). Owns the whale's wet terms in
`whaleShader.ts`, the breath's shedding in `sleeper.ts`, `spray.ts`, the heave in `swell.ts`, the leap's placement
in `dolphin.ts`, their tuning.
Gate: as N3g's.
Done: [x] `d47c32ab..a064fec3` on `sea-whale-life`, docs in the commit after. The water (`whaleShader.ts`): the threads
(`rills`) are gone; each breath's sea pours off as `falls()`: broad lanes along the body about 2.5 m apart that
wander as they run down, covering more as there is more water (`sheetWet` 0.8 times the breath's depth, up to 1),
streaming with the dawn they mirror (gold where they pour over the ridge toward the sun, `falls` 0.8 of the skin
they cover at most, the skin showing through but where they run full), with gold glints (`glints` 2); below about
2.4 m they part into threads, and as they drain they narrow to their middles and go. Their front (`uPour`) comes down
from `pourFrom` 6.5 m above the sea at `pourSpeed` 1.2 m/s gathering `pourFall` 1.6 m/s², reaching the waterline
about 2.2 s after the shed; they drain over `sheetFor` 5.5 s; where they reach the sea, white churn on the skin.
The span shed is s 0.08 to 0.86 (was 0.15 to 0.8). The head bared at the haul streams with the same falls, already
come down (`uPour.y`). `sleeper.ts`: from 1.3 to 5 s after a shed, `pourDrops` 260 drops a second times its depth run
off the flank just over the waterline (three in four on the near side), and the lace runs with them, never laid
within 2.8 m of the near flipper's blade (over it, it drew white threads across the blade). The ring (`swell.ts`):
`heaveHeight` 0.55 m times depth at the flank, out at `heaveSpeed` 2.6 m/s, `heaveWidth` 2.2 m from crest to side
there, broadening by `heaveSpread` 0.3 of each metre over its first 12 m, lower by half `heaveReach` 8 m out, with a
shallow trough behind (0.35), settled by `heaveFor` 8 s and cut off a little way either side so the far sea is
exactly as it was; the breath before keeps its ring going (`uHeaveBefore`), so a new breath never cuts one off
under the boat. The water shader takes the ring's height (`vHeave`) and lights its crest through toward the low sun
(`heaveGlow` 2.5). Measured at the line's hold after a waking breath: the boat rises about 0.21 m more, its worst
vertical acceleration 0.48 m/s² (0.47 with no ring; N3m's 0.58). The mist (`spray.ts`, `mistLook`): the first column
and the spout are lit as a painter lights a backlit plume, from the side the sun lies on in the frame, in shares of
the sky's brightness behind them: `shade` 1 grey-blue on the far side, `white` 2.1 (`spoutWhite` 0.3 more) warm white
on the sun's side with `gold` 0.4 of the low sun's glow, and `through` 0.9 glowing through thin edges toward it. The
spout's puffs are firmer at their lumpy edge, so its crown billows, and fray into wisps as they thin; `spoutHeight`
10 (was 15) and its crown's puffs grow slower, so its crown, about 14 m over the blowhole at most, stays in the
release frame (landscape: at least 33 px under the top, at about 11 s free; portrait about 208 px). The leap
(`dolphin.ts`): the throw is asked only once the leaper is within `leapMarkNear` 1.5 m of its mark beside the boat;
at seed 147 the leaper had set out 40 m astern and threw 9 m astern, 13 m from the lens (featured leap edge now 0.53
in that case, was 1.21). Seed 149 then exposed a softlock: the pod's nudge never landed (the boat had slowed for the
whale and a dolphin ahead of it cannot drop back), so the whale was never led and the cygnet stayed in her arms at
the flipper; `crossing.ts` now counts the whale as led once its step is past the approach. Gates: typecheck, build;
`net-whale-check` all 11 cases (`fin` clearance 1.61 m, `finidle` 1.7, `full` 1.5); `sea-logic-check` at seeds 147 to
158; pacing `toMirror` (whale brake 0.41 to 0.55 m/s², as before). Played (`full`): rest 88.8, line 111.6, flipper
144.5, free 167.2, spout 173.3, gone 206.4, moored 233.0; idle moored about 497 (pacing `calm` arrivalReady 496.5).
Left:
- The ring reads in motion as a soft warm band going out and the boat lifting, not as a crisp ring on the water.
- A deep breath in the bird's hold lays a broad bright curtain along the back for about three seconds, behind the
  cygnet swimming to the loop.
- A lone narrow fall can read as a single bright streak in a still; the pale scars still read as scratches.
- The spout is no taller in its frame than the first column at rest, whose crown still leaves the top of the rest frame.
- Thinning (from about 10 s free) the plume reads as a soft round cloud more than wisps.
- In the played portrait release the plume stands behind the sail as it rises and drifts to the right edge, its right
  side cut (the release hold's framing, unchanged).
- Thin white curved strokes show near the loop's end by the cygnet and the flipper's tip (not the lace; unidentified).

Claude's judgement, 2026-10-09, from the sheets and a full play of the merged sea: the breath now reads as water,
lilac-gold sheets over the ridge breaking into threads at the waterline, but every resting breath through the line and
the flipper lays the same bright curtain along the back, so it repeats and pulls the eye from the step at hand. The
spout is white and gold but swells into a round opaque ball like cotton wool, a cloud rather than a blow. The scars
read across the water as drawn chevrons. The leap kept in frame and the softlock found at seed 149 are both right.
The white curved strokes are the steps' drawn invitations (at the weak breath's still, the coax over the blowhole),
not an artifact.

### Phase N3q: her frame
After N3n and N3o merged on `sea-whale`; in parallel with N3r. The look's landscape frame made the owl's: her whole
seated figure smaller, three-quarter back, lit, the sail allowed behind her at the frame's edge but never between her
and the eye (the design's Camera bullet), her reaching mitten against its flank. The child's arm able to reach above
her face, so the reach to the eye and the goodbye wave rise as they should. And the intermittent drop of the lens in
the look found and fixed: in 2 of 5 full plays with real gestures, about 4.7 s into the first breath, the camera
fell to its 1 m floor and swung through the boat at about 20 m/s. Owns the look's holds in `net-whale.ts`, the lens
(`camera.ts`, `camera-direction.ts`), the child's arm, their tuning.
Gate: as N3g's, the look in at least five full plays with real gestures, landscape and portrait, none with a jolt.
Done: [x] `4010afe0..42c21d7d`. The jolt: the lens carries the boat's motion by taking up its speed
(`carried` in `camera.ts`), and took it up in one frame while shedding it no harder than `carryBrake` 9 m/s², so a hull
that dropped 0.155 m in one frame became a 9.3 m/s coast: the lens sank 1.7 m to its 1 m floor, and once its own eye was
under the water the occlusion test pulled it toward its gaze, through the boat at about 20 m/s. Both glitch runs'
drops began on the exact frames the whale laid a ring of swell (`rises`, 4.62 and 8.35 s into its first breath; the
4.62 ring comes only when the first breath interrupts a resting breath before its ring, about one play in two). Fixed
at the lens: `carryTake` 12 m/s², the hardest it takes up the speed of what carries it (above any boat gathering way
or child setting off), so a one-frame jump is left to the ease. Headless, a 0.155 m one-frame drop of the boat at 4.62 s
reproduces the glitch exactly before (lens worst 19.5 m/s, down to 1.00 m) and after is no different from no drop
(3.0 m/s, lowest 1.43 m). At the sea: each ring of swell now keeps the axis it went out on (`uHeaveAxisBefore`); a new
breath re-laid the older ring's axis, stepping the sea near the boat by up to 4.6 cm. The 15 cm step of the glitch
runs was not reproduced on this code: the largest step under the boat at any ring in the six plays below was 3 mm.
Six full plays with real gestures (three landscape, three portrait; three with the 4.62 ring), none with a jolt;
through the look (first breath to 2 s into the line, 0.25 s velocity windows) landscape worst 1.5 m/s and 0.8 m/s²,
lowest 2.1 m; portrait 4.8 m/s and 2.7 m/s², lowest 2.3 m. The 0.5 m one-frame jump as the look handed over to the
line (her face outside the frame's safety margin) is gone with the new frame. Free to the crossing's end is as on
N3n (landscape 4.8 m/s², portrait 6.2, same measure on N3n's plays 4.7 and 6.3). The child's arm: her shoulder sits
about 0.5 m below her face and the reach IK (`motion.reach`) left the collarbone down, so any target above her face
stopped level with it; now a reach above the shoulder lifts the collarbone as a posed raised arm does (`SHRUG` 0.45),
and the mitten tops out about 0.2 m above her face (was 0.09). The look: she was turned 0.95, 52° past its eye (she
sits a little turned to port already), so from behind her mitten folded across her face; now `lookTurn` 0.05 faces
her to its eye, `lookLean` 0.35 (was 0.9) sits her up, and `lookReach` [0.5, 0.15, 0.4] holds her left mitten up and
out beside her hood. Landscape `lookDistance` 9.5, `lookHeight` 2, `lookBearing` 0.3, `lookToward` 0.32, `lookLookY`
2.7: the whole boat and her seated figure (about 250 px of 900, hood to seat) three-quarters from behind her left
shoulder at the frame's right third, the sail behind her at the right edge, its eye about 220 px across at the left
over clear water. Phone `look` 4.8 back, 2.2 up, turn −0.55, lookY 2.5, toward 0.28: her seated under its eye, the
mitten up beside her hood. The goodbye (`waveGoodbye`): the mitten on the side toward where it went down, held up and
out across the view (`goodbyeWave` [0.45 across, 0.45 up, 0.2 sway, 4.5 rad/s]), so it rises beside her hood; the
farewell frames unchanged. `cygnet-gates` 27 of 27 (before: 26, `stow turn` 0.101 over its 0.08, now 0.062; the rest
within 0.007). `net-whale-check` all 11 pass (`fin` clearance 1.6 m, `finidle` 1.69, `full` 1.5); played (`full`):
rest 88.8, breath 111.7, line 144.7, flipper 167.4, free 173.5, gone 206.6, moored 233.1. `sea-logic-check` passes at
seeds 147 and 148; pacing `calm` arrivalReady 508.6 (N3n 496.4).
Left:
- In the farewell her wave is about 30 px out from her face and 8 px above it in landscape, backlit against the sun:
  it reads in motion as a small mitten beside her hood, not a plain wave. Her arm cannot get above her hood's brim.
- In the look her face stays inside her hood from behind; the paper plane in her satchel stands up beside the cygnet
  as a white triangle by the sail, and on a phone it covers her right side.
- On a phone she is large in the look and cut by the frame's right edge (the plane and the boat's quarter).

Claude's judgement, 2026-10-09, from the stills of three full plays: the landscape look is the owl's frame now, her
small whole figure seated in the boat to one side, three-quarters from behind, the giant eye large across clear water
and the sail behind her; the jolt had a real cause (a one-frame dip of the boat copied as a fall) and is fixed at it.
`carryTake` changes how the lens rides the boat in every chapter, so the whole-game playthrough checks it. The
goodbye wave stays small, a mitten beside her hood; the white paper plane standing in her satchel is the frame's
loudest shape after the sail, on a phone beside her face.

### Phase N3r: the mist and the skin
After N3n and N3o merged on `sea-whale`; in parallel with N3q. The spout and the first column made a whale's blow,
a tall bushy column bursting up and widening, the sun through its thin parts, drifting and fraying (the design's
release); the breath's falls kept for the breaths that matter (its waking breath, its first full breath, the spout)
and only a soft sheen at a resting breath, never a curtain repeating over the step at hand; the scars faint and soft,
never chevrons. Owns `spray.ts`, the whale's skin and wet terms in `whaleShader.ts`, the breath's shedding in
`sleeper.ts`, their tuning.
Gate: as N3g's.
Done: [x] `90f282fa..65b43bb0` on `sea-whale-life`, docs in the commits after. The blow (`spray.ts`): the first column
and the spout are one kind of puff, `BLOW`, thrown by `blowOut(at, height, strength, dt, wide, glad)` (the old
`column`, `jet`, `spout` and the `SPOUT` kind are gone; the far sigh's `COLUMN` puffs are untouched). Its strength is
`blowing(t)` in `sleeper.ts`, all at once over 0.15 s then easing off over `blow.exhale` 0.6 s, from `BREATH_IN` for the
first column and `SPOUT_FROM` for the spout (`SPOUT_FROM`, `SPOUT_TO` and the sounds are as they were). `blow.puffs` 66
puffs a second for each metre of its height at its hardest, each thrown up into air that slows it `blow.drag` 2.6 a
second, so it reaches its height in about a second, and out the further the higher it goes, so the column is
`blow.stem` 0.35 m in radius at the blowhole and flares `blow.flare` 0.2 m a metre, by the 1.4 power of its height
share, into a bushy top; the edge falls short and some puffs overshoot, so the top is domed and ragged. Each
puff swells (`blow.swell` 2.4 a second) toward 0.35 to 0.6 of the column's radius there and 0.2 m more and keeps spreading
(`blow.spread` 0.25 m/s); bursting up, it is drawn out along its flight (up to 2.5 times), so the blow reads as thrown;
it hangs clear of the breeze 0.6 to 2 s (the top longest), then drifts on the wind, its top torn apart at up to
`blow.tear` 0.8 m/s and each puff drawn out sideways by `blow.torn` 0.8 of its size over its life; `blow.opacity` 0.2 at
most, thinning by the power `blow.thinning` 0.9 of its life left over `blow.life` 7 s for the top (the low parts go
sooner, the spout's last a fifth longer). The shader lights it as one column, never puff by puff: its side is where it
was thrown and how far out, its core facing the eye, a little of each clump's own lumps; the puff a small soft clump
with a lumpy edge torn into wisps as it ages, its thin parts glowing toward the low sun (`mistLook.blowThrough` 1.8)
and partly additive. `firstBreathHeight` 10 (was 13), `spoutHeight` 13.5 (was 10), `spoutBreadth` 1.2. Measured: the
first column's crown about 8.7 to 9.4 m over the blowhole, 65 to 86 px under the top of the landscape breath frame
(portrait 269); the spout's 12.3 to 13.5 m, 58 to 70 px under the top in the landscape release frame (portrait 216
to 239), at full height within a second of the blow, its top torn and drifting from about 3 s after it, thin by
about 5 and gone by about 7 (before the dive at 15.5). The falls (`sleeper.ts`, `whaleShader.ts`): `rises(deep,
falls)`, falls 1 only for the first full breath and the spout; `uPour` is now a `Vector3`, its `z` how much of the
breath pours in falls. `falls()` takes `full`: at 0 a breath runs off as a faint sheen streaming down the whole skin
behind the same front (`sheen` 0.28 of a fall's cover, broad, the falls' streaming in it, no glints), at 1 the falls
as N3o built them; the head bared at the haul still streams in falls. At such a breath the lace and the drops at the
waterline are `sheenShed` 0.3 of a fall's. The scars (`whaleShader.ts`): `scarIn` is a soft pale smear along the body
(slant at most about 14°, its width 0.2 to 0.32 m falling off as a Gaussian across it and at its ends), no shade line
under it, `scarAmount` 0.45 (was 0.65); it comes in over `scarSeen` 1.5 to 4.5 px across a 0.26 m mark, so it is only
there close enough to read as skin. Gates: typecheck, build; `net-whale-check` all 11 cases (`fin` clearance 1.6 m,
`finidle` 1.7, `full` 1.5; played `full`: rest 88.7, breath 111.5, line 144.5, flipper 167.4, free 173.2, gone 206.4,
moored 232.9); `sea-logic-check` at the default seed and 148 to 150; pacing `toMirror` (whale brake 0.41 to 0.56 m/s²,
`calm` arrivalReady 496.55).
Left:
- Thinning, for about a second before its top tears (about 2.5 s after the blow) the spout's crown can read as a soft
  rounded mass over a thin stem, translucent rather than wool.
- From the release hold the low sun lies almost behind the spout, so its grey-blue shade side is faint; it reads
  mostly white with a warm sun side.
- The first column's base stands among the net patch's corks on the domed mesh, which show as dark balls inside it.
- The seabirds' flight beside the spout now passes over its torn top as it thins (it drifts toward their side).
- The scars are faint enough that at the bird's hold only two or three soft smears show on the near flank.
- The resting breath's sheen shows as fine bright vertical streaks in a still, the falls' streaming in it.

Claude's judgement, 2026-10-09, from the sheets and stills: the blow is a whale's now, a narrow stem bursting up and
bushing out, torn into glowing wisps toward the sun, in the family of the stairs' clouds; a breath through the steps
is a faint sheen and the eye stays on the step; the scars no longer read from across the water.

### Phase N3p: the playable build
After N3q and N3r merged. Claude plays the whole open sea beside the clouds and the owl, folds what that turns up
into the docs and fixes it, and the playable build goes to Jeremy.
Done: [x] 2026-10-09, `sea-whale` at `1fe33692`. Claude played the whole open sea in landscape and on a phone from
its start to the mooring at the mirror (with real gestures, twice each across the round), and it reads as one
sequence: the giant breaking the horizon, the first breath's blow through the drawn spiral, the look framed as the
owl's, the haul and the cygnet at the flipper, the free spout with the gulls rising, the dive and the flukes over
the boat, the sea stilling into the mirror. Camera: no jolt in the encounter; the worst acceleration in a full play
is the mirror's own swing round to the mooring (about 5.5 m/s² landscape, 6.7 on a phone, smooth in motion).
Gates on the merge: typecheck, build, `net-whale-check` all 11, `sea-logic-check` at seeds 147 to 150, the pacing
check, `cygnet-gates` 27 of 27 (one earlier run missed two by a hair at the cygnet's step up, unrelated, and passed
on rerun). The whole journey (`playthrough.mjs`) on the QA build: Begin through every chapter, the credits, the
completed-save reload and Play again, in three legs. It needed two gestures it had never been taught, both added:
a sweep across the shore pinwheel through the haul (`shorePinwheel` on `__game`), and the little boats' bath pushed
its hinted way and the plug circled. `carryTake` was checked against it: the child's first steps speed up at 13 to
15 m/s², so the lens trails her by millimetres; only one-frame jumps are changed. Found on the way, both already on
main and outside the whale: continuing a save made in the little boats (`pool-1`) leaves the story's focus and the
camera NaN from the first frame; and once, in a full run, the dark wood stalled after the owl with her standing on
the path and no next coal laid (from the `found` save it passed on main and the branch alike, so it is timing).
Left for Jeremy's eye: the phone's line frame stands the boat half out at the right edge (as before N3n), and the
paper plane standing in her satchel is the loudest shape in the near frames after the sail.

## The rework after Jeremy's first play (2026-10-09)

Design: design.md, "Jeremy's first play" and "The rework", then the rewritten bullets they point to ("Where it
lies", "The boat's pace", "The pod leads, and the whale is found", "What every step keeps", the five steps, "Its
goodbye, with feeling", "The dive, a whale's, not an eel's", "Its voice"). Jeremy's notes there are verbatim; every
brief cites the doc, never the chat.

How it runs (lessons from N1 to N3r):
- Base: `sea-whale` (worktree `/private/tmp/updraft-sea-whale`). First merge main into it, because main has moved
  since `0fbab59d`. Each phase forks its own branch and worktree under `/private/tmp` from `sea-whale`; check the base
  with a landmark file. The lead merges each phase back into `sea-whale`.
- Agents: Opus at xhigh on file-disjoint lanes, each committing after every step. Jeremy lifted the two-at-once limit
  (2026-10-09: "im waiving the 2 session limit. i want all the work completed quickly"), so N5a, N5b and N5c run
  together and the lead resolves their seams in `net-whale.ts` at merge. Each aims to finish under 400k tokens and must
  stop and hand off at 450k. Every brief carries the comment rule verbatim.
  Agents write Done entries on their branch but never "Claude's judgement" lines; the lead adds those on main.
- Ports: 5321 and 5324 for agents, 5330 for Jeremy's play build. Peers use 5317 to 5319 and 5323. Check a
  listener's cwd before trusting a port.
- Instruments: `net-whale-check` (about 25 min, run in the background), `sea-logic-check` at seeds 147 to 150
  (`SEA_SEED`), `CROSSING=toMirror node tools/journey-pacing-check.mjs`, and `cygnet-gates` with `BASE`. For play
  in motion: `/tmp/updraft-seawhale-n3m-review-rNP7/play.mjs <prefix> sea|whale <WxH> <port>` records real
  gestures with a 4 Hz state log (boat speed, step, screen positions of the targets) and a camera trace;
  `acc.py` reports camera acceleration. Copy both into the phase's own scratch directory before changing them.
- Every interaction frame is judged as a first-time player sees it, in both orientations: the thing acted on, the
  drawn gesture and the goal all plainly in frame.

### Phase N5a: the sea laid out again (found, not seen; the boat's pace)
In parallel with N5b. Owns: `src/world/geography.ts`, `src/story/geography-progress.ts`, `src/story/journey.ts` (`WHALE_LEAD`,
`WHALE_REST`, `toMirror`, the QA `whale` start), `src/story/crossing.ts` (the pod's pacing, the sea mist, the mirror's isle mist), the isle mist table and
its hook in `src/main.ts` (`ISLE_MISTS`), and in `src/story/net-whale.ts` only the approach: the speed limit in `update()`, `pod()`,
the lead's way (`wayAt`, `layWay`, `escortYaw`, `local`) and the haze lifting off it. In `src/tuning.ts` it owns
`seaPassage` and the approach keys of `netWhale` (`slowing`, `settling`, `release`, the `lost*` keys). Also
`tools/sea-check.mjs`, `tools/sea-logic-check.mjs` and `tools/journey-pacing-check.mjs`.
- The whale, the boat's line, the mirror's island and home move so that the doc's "Where it lies" holds. Geography
  revision 6 (`src/world/geography.ts`, `GEOGRAPHY_VERSION` 6, save migration in `src/story/geography-progress.ts`)
  shifts the mirror and home together, so `toHarbour` keeps its shape and length, until the mirror's landing lies
  straight on past the whale on the boat's heading at rest. A first estimate is about (-270, -215), about 350 m, but
  compute it. The sleeping island and everything before it keep their places. The whale's pose and every hold are
  defined relative to `WHALE_REST` and the lead's heading; keep the boat's heading at rest and the time of day at
  rest as built, so the holds come out unchanged.
- The mirror's and home's own checks must pass after the move: `tools/geography-check.mjs` (migrations, clearance,
  continuity), `tools/boat-ground-check.mjs`, `tools/boat-shores-check.mjs`, `tools/landing-check.mjs`, and
  `CROSSING=toHarbour` pacing unchanged. A completed save and saves at the mirror and home must migrate and resume.
- Facts to work from. The sea's haze (0.94) begins its veil at about 167 m and, with `uOpenSea`, has converged on the
  sky by about 300 m. The whale rested about 300 m from the sleeping island and 150 m from the mirror's centre,
  (-345, -2090). A low mist that lies on the sea while the sky stays clear may be built from the existing `uMist`
  (it thins with height) rather than from the haze.
- The heard-first breath in the mist uses the existing breath sound for now; N5c gives it the whale's voice.
- Seam: N5b and N5c read nothing new from this phase. The whale's step machine and its saves keep their names, and
  `whale-rest` resumes at rest beside it in the mist.
- Main's own `swim` save on `toMirror` (`[leg, time]`) must still resume on the new route.
- Gate:
  - typecheck and build;
  - stills every 5 s, landscape and phone, from `?chapter=sea` and from a real departure off the sleeping island, up
    to the nudge: no whale and no mirror in any of them;
  - the boat-speed log at or above 4.5 m/s except during the swim and the last few metres;
  - from the nudge to rest 30 to 45 s, and the last 20 m in at most about 8 s;
  - the heard, the blow and the shape come in that order;
  - stills of each hold (breath, look, line, flipper, release, farewell) matching `sea-whale`'s before the move, side
    by side;
  - the mirror out of its mist only after the dive, straight ahead with no turn away, and from the dive to the
    mooring at most about 60 s;
  - stills at the mirror's arrival and at home matching main's, side by side;
  - `sea-logic-check` at seeds 147 to 150, the pacing check, and `net-whale-check` (its positions updated).
Done: [x] `04ce3b5a..71c2c44e` on `sea-n5a`. Geography revision 6 (`GEOGRAPHY_VERSION` 6): `PAST_THE_WHALE` (−236,
−192) carries the mirror and home together (`MIRROR_SHIFT`, `HOME_SHIFT`; `HOME_TREE` now moves with home), so
`toHarbour` keeps its shape and pace exactly (the pacing check's numbers are the base's to the decimal);
`WHALE_MOVE` (−108, −79) puts the rest at (−588, −2099), off the line the boat sails from the sleeping island.
Saves: mirror, `toHarbour` and home saves move by `PAST_THE_WHALE` (revision 1 ones by `SEA_SHORTENING` too), any
`toMirror` `whale-*` save by `WHALE_MOVE`, life regions south of z −2000 with the islands; main's `swim` save resumes
where it was, on the line the passage still sails, and a resumed swim is never sailed past the whale
(`geography-check` covers each). The route (`ROUTES.toMirror`): main's line out to (−375, −1970) and on to the turn
(`WHALE_LEAD`, `tuning.seaPassage.leadFor` 128 m short of the rest on the lead's heading as built, atan2(−30, −33)),
`WHALE_LINE` halfway, `WHALE_HOLD` 3 m past the rest, then straight on about 110 m over where it lay, an 84° starboard
curve of about 30 m radius and the last 30 m straight in alongside the jetty as main had it (waypoints off
`MIRROR_LANDING`). The pod's pace (`tuning.seaPassage`): `leapFrom` 0.265 (the leap about 80 m out, as on main),
`farewellAt` 0.86, `playFor` 45, `leastSpeed` 4.5; once its play's time is up the boat is kept to `leastSpeed` until
the nudge, so the pod can still come alongside a gusting boat (at full gust it never could, and nudged again and again
for four minutes); where a whale waits nothing holds the boat back for a late pod (`holdSpeed` stays the other
crossings'). The pod leads off ahead of the bow toward the rest (`pod()`'s heading) and the boat turns after it. Led
in, and sailing on after, the boat makes no more than `tuning.netWhale.leadSpeed` 5.5. Coming in (`comingIn`), the
limit takes way off at `slowing` 1.2 m/s² until the hull's carry (`tuning.sail.carries`) takes it the rest of the way,
nothing `restShort` −1.9 m out; `settling` is gone. While it holds beside the whale the boat steers for a point 12 m on
along its line in (`ON_THE_LINE`), so it rests 0.6 m short and 0.2 m off the line, its heading within 0.9° of the
lead's (the base's voyage rested 0.4 m off and 6.7° round, pointing at a hold waypoint 3 m ahead); `?chapter=whale`
starts 0.5 m short on the heading. The dawn eases onto `tuning.seaPassage.restDusk` 1.224 at the rest (the base's
`?chapter=whale`, on whose stills every hold was judged; its voyage came in at 1.211) and on to the mirror's 1.27. The
mist (`tuning.seaPassage.mist`): the crossing's own `haze` and `hazeFalloff`, rising from the leap to the nudge to
haze 1.064 and a veil 1.3 times as deep (untouched to about 70 m, gone past about 160 m), drawing back from 80 to 30 m
short of the rest to 0.985 and 1.05 (untouched to about 130 m), lifting as it dives; `uLost` and the `lost*` keys are
no longer used (the field stays at 0 because `restore()` sets it). Found: it sighs 2 s after the nudge (`leadSigh` 2)
and goes on breathing every 10 s, and once 95 m short and at least 6 s on (`seenAt`, `seenAfter`) a breath comes for
its blow; a breath just gone serves rather than doubling. Led in, the view comes down and turns to it only over the
last 70 to 20 m (`riseFrom`, `riseNear`): turning at the nudge pushed the boat out of a phone's frame toward a mist
with nothing in it. The mirror's mist: `ISLE_MISTS.mirror` over 0.85 of its flat
(`tuning.world.mirrorMist`), lifting once the whale has gone under (`mirrorArrival` above 0).
Gate, measured:
- typecheck and build pass.
- Stills every 5 s from `?chapter=sea` and from a real departure off the sleeping island (its `morning` checkpoint
  with the boat at its berth: the walk down, the push off), 1600×900 and 430×932, to the nudge: no whale and no
  mirror in any. The pacing check asserts it in all seven runs (no whale mark on screen less than 97% covered before
  the nudge, no mirror mark less than 90% covered before the dive).
- Boat speed: never under 4.45 m/s from getting under way to the last 20 m but for the swim, in all seven pacing
  runs and the browser logs.
- Nudge to rest 33.5 to 43.8 s in the pacing runs (calm 42.6), about 32 s with the latest nudge seen in a browser
  play (70 s in; the pod's set pieces are random); the last 20 m to under 0.3 m/s 8.5 to 8.8 s, never losing way
  faster than 0.85 m/s². The lens in the lead: at most 1.0 m/s² (`acc.py`).
- Heard, blow, shape in order in every run: at the first sigh the whale is at least 99% covered, a breath on about
  92 to 96%, at the blow about 84 to 85% (its plume 93%) and less than half covered 5 to 10 s later.
- Holds (breath, look, line, flipper, release, farewell), landscape and phone, side by side with the base's
  `?chapter=whale` stills: the same whale, boat, child, sail, sun and frame in each. The far sea reads a little
  hazier (the mist beside it starts at about 130 m), and the swell's facets round the boat differ, as the swell
  differs from place to place.
- The mirror out of its mist only after the dive (about 29 s after it, as the boat gets under way), never turning to
  port by more than 6° (crabbing) nor round more than 81° to starboard; from the boat let go to the mooring 41.6 to
  48 s, so from the dive 63 to 70 s with the dive as it is (it lets the boat go 22 s in), about 55 to 60 s with N5c's.
- The mirror's arrival and home, side by side with the base's: the arrival at the jetty and its settled view match in
  both orientations (the boat alongside from behind, the kite and the lantern far off; with the curve's 15 m straight
  the arrival had come in from the side, so it now runs the last 30 m straight in as main did); home (moored at the
  jetty, the summit, the arrival from `toHarbour`) matches.
- `sea-logic-check` at seeds 147 to 150 pass (the resumed cases allow 60 s more for the longer sail on); the pacing
  check `CROSSING=toMirror` passes with its new gate and `CROSSING=toHarbour` is unchanged; `geography-check`,
  `boat-ground-check` and `boat-shores-check` (its home berth included) pass; `landing-check` fails at the island of lines' departure boat (248.6, −398.3
  against 240, −388.5) exactly as on the base, so not this phase's; `net-whale-check` passes all 11 cases (`full`: at rest 102.1 s, moored 261.7 s).
Each new negative assertion was broken once and seen to fail: no mist (the whale seen at 38 s; heard and blow fail),
no mirror mist (the mirror seen in the lead), the old 3 m/s pace, the old slowing, a 3.6 m/s lead (the pace gate
passed vacuously until it also required the boat to get under way), a come-about waypoint, and a revision 5 whale
save left where it was.
Left:
- Heard first is quiet: the sleeper's sigh at about 150 m is near the foley's 190 m cut-off (`whaleNear`,
  `whaleFar`); N5c's moan needs its own reach.
- The blow and the shape come close together: its plume and its body share the veil, so the plume reads by being
  bright against the sun; a mist that thinned with height in the shader (not `uMist`, keyed to the lower of eye and
  point) would separate them.
- With a late nudge the lead is about 32 s and the boat has already turned at `WHALE_LEAD` before it; the pod's set
  pieces vary by about 10 s.
- The jetty stands 20° to 35° to starboard as it comes out of the mist (out of a phone's frame until the curve), not
  dead ahead: its axis is square to the heading the boat rests on, so the landing needs the 84° curve.
- `NetWhale.lost` is now always 0; its field and the two lines in `restore()` can go once N5b's steps are merged.
- From the dive to the mooring is over 60 s until N5c's dive lands.

Claude's judgement, 2026-10-10, from the lead's sheet and the mirror stills: the open sea is open now, the pod round
the bow on an empty gold sea, then a long low shape under the sun with its blow over the mist, then the netted head
coming up beside the boat; the arrival at the mirror's jetty frames as main's. Still to judge in motion in N5d: the
shape shows faintly a moment before its blow, and the 84° curve onto the jetty must not read as veering off toward
an island (Jeremy: "instead of veering off artificially towards another island").

### Phase N5b: the five steps
In parallel with N5a. Owns, in `src/story/net-whale.ts`, the steps and everything they drive: `breathe`, the new
eye step, `exchange`, `haulLine` and the new heave, `lastLoop`, `brushFin`, `brushCork`, the invitations, the
valves, `checkpoint` and `restore`. Also `src/fx/sealife/net.ts` (the fold over its eye, the mesh billowing off its
head), the eye's struggle under the fold in `src/fx/sealife/sleeper.ts` (the eye only), the child's heave and the
step keys of `tuning.netWhale`, `src/story/checkpoint-data.ts` (the new checkpoints) and `tools/net-whale-check.mjs`.
- Build the doc's "What every step keeps" and the five steps: the breath in about two loops; the eye; the line taking
  any stroke across the cork; the heave; the flipper taking any stroke at the flipper or the bird.
- Drawn gestures show the moment a step is asked. This is the whale's own rule; other rooms keep "after a few idle
  seconds".
- Seam: the step machine runs `approach`, `breath`, `eye`, `line`, `heave`, `flipper`, `free`, `gone`. The pod, the
  camera holds and the crossing read `step`. The eye step uses the look's hold; the heave uses the line's hold,
  widened only as far as the net on its head needs.
- Saves: `whale-eye` and `whale-heave` are added. `whale-line` now resumes with the cork in her mittens before the
  first heave, since the branch never shipped. Each resumes as the doc's "Saves" says.
- Facts to work from. The breath's progress was `liftRate` 0.16 a second at full charge (`liftFrom` 0.12,
  `liftFull` 0.5, `reach` 6 m). Invitations waited for `inviteAfter` 6 s of stillness, and any lifting reset the wait.
  The flipper counted only strokes running along it (`finAlong`). After the cork was caught, the haul played itself
  (`haulPulls`, `pullTime`).
- Gate:
  - typecheck and build;
  - `net-whale-check` plays all five steps with real gestures, and also with strokes in random directions across
    the scene (the way a child plays), each step completing within a few strokes or about two loops;
  - each step's valve still frees it;
  - every new save resumes;
  - stills of each step's frame in both orientations, taken about 1.5 s after it is asked, show the drawn gesture, the
    target and the goal;
  - one smoke play of the whole encounter.
Done: [x] `5a7e9bce..5fd07363` and this entry on `sea-n5b`. Steps `approach`, `breath`, `eye`, `line`, `heave`, `flipper`,
`free`, `gone`; saves `whale-rest`, `-breath` (resumes at the eye, the fold over it), `-eye` (fold off, eye open, cork
out), `-line` (cork in her mittens, braced), `-heave` (line let go), `-flipper`, `-gone`. Breath: `liftRate` 0.8. Eye:
the fold is its own doubled mesh hinged on the net's near edge over the eye with 22 weed strands (`net.flap`,
`foldOn`/`layFold`); its lid tries under it (`sleeper.struggle`, `TRY`); any stroke within `foldRadius` 0.7 of it lifts
it, part way and sagging back (`foldPart`, `foldSettle`), and `foldSweep` 0.35 of stroke flips it over onto the brow in
`foldFlip` 1.5 s; the look plays from its eye opening (`eyeT`; `blinkAt` etc. re-based). Line: any stroke across the
cork or the line behind it (`corkRadius` 0.55) sends it gliding toward her (`corkCome` 4 m per unit, `glideCork`), bent
by the stroke (`corkBend`); a shove drags the last links (`DRAGGED`). Heave: braced, the net will not come; a stroke over
its head or the water to her (`heaveRadius` 0.45, a triangle of points between eye, crown and jaw and a strip to her)
billows the mesh (`net.billow`, `billowHeight` 1.7 m) and asks for one heave once it has swept `heaveSweep` 0.1, a stroke
kept going another every `heaveStroke` 0.5; a stroke ends `heaveGap` 0.25 s off the head, and heaves asked for while
she hauls follow in turn (`owed`), so none is lost (`heaveTime` 1.5 s, `pullTake` 0.9 m, four `heaves`). Flipper: any
stroke near the flipper or the bird (`finRadius` 0.5, `finSweep` 0.2); `finAlong`/`finPace` gone. Invitations: a step
is asked once the hold is `inviteHeld` 0.8 through its move (`askedFor`), the sweep shows `inviteSettle` 0.5 s later and
again `inviteBack` 4 s after the last stroke; the whale draws its own sweeps (`net.gesture`, `drawSweep`, sized to the
frame along their heading, `sweep*`), the shared `windInvitation` returns null; the spiral is the shared coax with
`Coax.bold`. Valves: `noseFold` (a dolphin rises nose-up under the eye and lifts the fold), `nudgeHead` (comes up under
the net's edge each brace), the others as before, run to their end across a step change (`valveStep`, `runValve`,
`valveDone`). Sounds `fold-lift`, `net-heave` in `foley.ts` and `docs/contracts/audio.md`.
`net-whale-check`: a failed case had left its page playing in the shared browser, and a second running page slows the
next boot's compiles from a few seconds to over 80, past the 90 s wait for `__ready`, so every case after the first
failure timed out (the base's check does the same: its `circles` failing against this branch, its `sweeps` then never
readied). Each case's pages now close whatever happens, the check takes the shared GPU lock, paces its circles in game
time (the game steps 1/60 s a frame, so a loaded machine's slow clock had made wall-clock circles too fast), strokes
elsewhere on screen as far from the target as the frame allows, and takes `BREAK` as a list (idle cases' valves at 10 s,
or `anywhere`).
Measured, landscape, with real gestures: all 16 default cases pass in one run (27 min). `steps` loops 2, eye 1, line 1,
heave 4 strokes for 4 heaves, flipper 1, free 60.6 s after rest; `heave` 4 strokes, billow 0.74; `eye` lid tries 0.34,
a weak stroke 0.43 part way, one good stroke; `line` 1 stroke from 3.62 m, `anyway` brings it to 1.29 m; `fin` 1 stroke,
the cygnet 1.61 m clear, bill gap 0.014 m; `finearly` lifts it with the loop kept on. `child` random strokes (seed 7 /
seed 3): breath 1 / 1 go, eye 7 / 4 strokes, line 3 / 2, heave 7 / 5 for four heaves, flipper 1 / 1. Each idle case's
valve went at 90.1–90.8 s and its dolphin did the step; the breeze at three times and strokes elsewhere did nothing
before it. `BREAK` (valves at 10 s) fails all five idle cases, `BREAK=anywhere` fails `sweeps` and all five on their
strokes elsewhere. `saves`: all seven resume as "Saves" says. `full` rest 88.6 s into the sea, free 153.2, gone 192.2,
moored 218.9, every step the player's; `fullidle` every step by its dolphin, moored 697.7. Smoke plays from
`?chapter=whale` landscape (recorded) and phone moored with no errors, a go of circles and then 1, 1–2, 4 and 1 strokes; `bootStrayPrograms` 0 and
first-drawn programs 0, and at fixed quality (`ratio=1`) no first-drawn target pairs either (unfixed, the governor's
step to 2× MSAA on the loaded machine draws into a new target). Stills 1.5 s after each ask, both orientations, show the
sweep, the target and the goal; the phone's flipper frame (the base's hold, unchanged) has the bird small at the left
edge and its streak short. Left: `sea-logic-check` (N5a's) still expects the old steps and saves.

Claude's judgement, 2026-10-10, from the step stills: each step's sweep lies on its target with her and the goal in
frame, and the fold of net and weed reads over its shut eye. Merged into `sea-whale` with N5a (`fdda6594`). The sea
check, `whale-look-stills` and the playthrough still play the old steps (the shared invitation is null at the whale,
so the playthrough would wait out four valves there); they are integration work before N5d. The phone's flipper
frame is N5d's.

### Phase N5c: the goodbye and its voice
Beside N5a and N5b (Jeremy's waiver above), branch `sea-n5c` off `sea-whale`; the lead merges it after N5b. Owns
`src/fx/sealife/sleeper.ts` (the dive, the body behind the flippers, riding higher, the flipper's wave, the eye open
on her through the release; not the eye under the fold, N5b's), the `free` and `gone` steps in `net-whale.ts`
(`salute()`, the release's direction, her goodbye wave), the release and farewell holds (`release*` and `farewell*`
keys, not the approach's bare `release`), the child's arm where her goodbye needs it, the whale's voice in `src/audio/` and its notes in `docs/contracts/audio.md` (branch
copy), the body's shape in `src/fx/sealife/anatomy.ts`, and the first crossing's whale (`src/fx/sealife/whale.ts`), which
shares the form.
- Build the doc's "Its goodbye, with feeling", "The dive, a whale's, not an eel's" and "Its voice", including the
  moan heard in N5a's mist.
- Gate:
  - typecheck and build;
  - a strip at 4 fps of the release and the dive, landscape and phone: its eye open and on her in frame from the
    spout to the head going under, the waving flipper in frame, the arch short and thick, and from the head under to
    the flukes gone at most about 9 s;
  - the first crossing's far dive still reads;
  - the whale's voice rendered from the game at each of its moments, its level against the score measured and
    plainly heard;
  - `net-whale-check` and `cygnet-gates`.
Done: [x] `f5cd37c6..2042d1e0`. The body (`anatomy.ts` `KEEP`, `along`, `taken`; `whale.ts` `SPINE_AT`, `SPINE_GAP`;
`whaleShader.ts` `TAKEN`): behind the net's back (s 0.5) the rig lays it out at 0.45 of its rest length through the
back and 0.65 at the stock, so it is about 90 m nose to fluke tips, the head, eye, flipper, flukes and `surfaceAt`
unchanged, its skin's marks keeping their shape; `restPitch` is divided by `KEEP` so its back still lowers as far.
The first crossing's whale shares it. Free (`sleeper.ts`, in seconds of being free): it rides `RIDE` 0.6 m higher,
spouts at 6, sings at `SONG_AT` 7.2, lifts the freed flipper from `WAVE_AT` 11.2 (`WAVE_RAISE`, the tip about 10 m
up) and waves it twice from 13.4 to 17.8 (`WAVES`), rolling `WAVE_ROLL` 0.15 away from the boat, calling goodbye at
13.8; its lids are drawn back (`FREE_EYE` 1.15) and its gaze is taken along its own head (`lookOut`). The dive from
`DIVE_AT` 19.6: its way bends where s 0.36 lay; the spine there rides by `ARCH_RISE` (by metres the stock is short of
the bend: level, then 4 m down as the broad back rolls over, back up as the stock comes), so the back passes as a low
line awash about 1.5 m high with the dorsal knuckle riding over, never a dome; the stock arches up ahead of the
flukes (`STOCK_LEADS` 0.5 of their lift) with them hanging from it (`TRAIL` 1.3), and they lift on `LIFT_UP` from
`LIFT_SHORT` 9 m short of the bend; `GLIDE` brings the stock's root to the bend as they stand, so standing only the
stock and the flukes are out of the sea. Headless: eye under 1.75 s into the dive, flukes break 6.1, notch highest
11.9 m from 6.9 to 8.5, notch under 9.6, tips gone 10.3: 8.5 s from the head going under to the flukes gone (the
first pass's arch rose 4 m: the back stood 8.6 m high as a dome and 7.8 m beside the standing stock). Her part
(`net-whale.ts`): her looks retimed, both arms up in a V with her back to the view (`waveGoodbye`, `goodbyeWave`
[0.75, 0.45, 0.25, 6], `goodbyeTurn` 0.25, `toView()`), the cygnet calling twice; the release's subjects take its eye
and the flipper's tip. Holds: landscape farewell 24 / 1.2 / bearing 0.85 / lookY 15 (sun left, flukes middle, boat
right); phone `farewell` 24 / 1.2 / turn −0.45 / lookY 22 / toward 0.3, the sail beside the stock. The voice
(`src/audio/whale-voice.ts`, `Foley.whale`; `tuning.audio.whaleVoice`, `level` 0.09): `whale-moan` with the sigh as
the pod leads (`sighIn(K.leadSigh, true)`), `whale-greet`, `whale-song`, `whale-goodbye` (twice), `whale-deep`,
`whale-echo` on the first crossing; the score makes room (`voiceRoom` 0.6).
Gate, measured: typecheck and build pass. Strips at 4 fps from the flipper's save, 1600×900 and 430×932: its eye in
frame with its lids at or past open in every frame from the spout to its head going under, the flipper's tip in frame
through the whole wave, in both. The first crossing's far dive reads as a fluke-up in the haze (back, flukes up,
slipping under). The voice rendered from the game (call against the score in its window, RMS dB): song −37.6 / −37.1,
goodbye −36.9 / −40.5 and −37.9 / −37.0, deep −38.2 / −37.9, greet −44.0 / −44.0, mist moan −39.5 / −37.8 (at this
branch's whale distance), peaks about 13 dB over, 35 to 51% under 150 Hz; the first crossing's echo −60.4 / −35.3.
`net-whale-check` `full` passes (rest 88.7, breath 111.4, line 144.6, flipper 167.5, free 173.5, gone 199.9, moored
226.4, fin clearance 1.5 m) and `saves` passes (each resumes; after the dive at `gone`). `cygnet-gates` passes (a first
run failed idle and gather turns at about 12.2 s following; the rerun passed all 27). Stills of the breath, look and
flipper holds beside `04ce3b5a`: the same in both orientations but for the far back in the landscape flipper hold.
Left:
- In the landscape flipper hold the far back curves down into the sea in frame, rounder and about 140 px short of
  where the longer back faded into the haze.
- As the flukes rise and turn, the near one spreads flat over the boat for about half a second before it stands (the
  N3l paddle, longer now that the stock is up first).
- While its broad back rolls over (about 2.5 to 5.5 s into the dive) only a low line of back shows, small in the
  landscape frame; near the sun it catches the sky at a glancing look and reads pale and smooth.
- The flukes stand lower than the first pass's (notch 11.9 m against 15.8, N3l 13).
- The first crossing's echo sits about 25 dB under the score, so it is heard only in a quiet moment.
- No camera trace this phase; the full `net-whale-check` with N5b's steps runs at integration.

Claude's judgement, 2026-10-10, from the strips: the first pass's dive swelled the back into a smooth dome and then
stood a long pale body above the sea with the stock rising out of it like a neck, a serpent rearing; now the back rolls
over awash and the stock and flukes come up out of it, a whale's fluke-up dive, and on a phone the flukes stand whole
beside the sail. The release reads glad: the spout, the flipper raised and waving beside its open eye. Merged into
`sea-whale` with N5a and N5b (`29d51e8a`): N5c's moan is the first sigh heard in N5a's mist (`sighIn(K.leadSigh, true)`
for the first), its wide free eye joins N5b's struggle under the fold in one `uEye`. The moan was measured nearer than
N5a lays it; N5d hears it there.

### Phase N5d: the playable build
After N5a, N5b and N5c are merged on `sea-whale`. Claude plays the whole open sea in motion, landscape and phone, from
the sleeping island to the mooring at the mirror, beside the clouds and the owl. Claude fixes what that turns up,
folds it into the docs, and puts the build up for Jeremy on 5330.
Found so far (2026-10-10), on `sea-whale` at `98e69212` with the tools brought to the five steps (`sea-tools`: the
sea check, `whale-look-stills` and the playthrough play them; `tools/lib/whale-gestures.mjs`; the dead `lost` gone):
- A softlock at the line: in strong wind her mitten stops about 0.5 m short of the cork, `'reaching'` has no valve,
  and the whale is never freed (`sea-logic-check` seeds 148 and 150, portrait). Branch `sea-catch`, with the eye's
  drawn sweep, which is drawn in the sky above its brow rather than across the fold.
- The heave's billow barely lifts the mesh; the phone's line frame cuts the boat at the right edge; the phone's
  flipper frame has the bird small at the left edge. Branch `sea-frames`.
- The playthrough's open sea: rest 102.1 s, free 164.1, gone 203.1, moored 247.4, every step the player's.
- Fixed and merged: the catch (`sea-catch`: the cork drawn to rest under her mitten, the catch judged from the boat,
  a 4 s give; the cygnet's swims go on after 12 s; nothing waits forever) and the eye's sweep the fold's length; the
  heave's billow up to 3 m and held through her draw, the phone's line and flipper holds (`sea-frames`); the pacing
  check's run long enough for five valves (`sea-verify`).
- Claude's play of the merged build (`a69b1c45`), landscape and phone, real gestures, to the mooring: every step the
  player's in one go or a stroke (four for the heave), no errors, no stray programs. Found: the lens drops onto its
  1 m floor easing to the farewell (6.0 m/s² landscape, 5.3 m/s on a phone); the swing onto the mirror's jetty 6.8 /
  8.0 m/s² (main 5.5 / 6.7); the phone's look crowded by her hood and the plane; the shortened back's end showing as
  a round end in the landscape flipper hold; the eye's sweep thin. Branch `sea-polish`. The pod's late nudge (the
  pacing check's margins) and the sea check's five steps on `sea-pace`.
- Recovery, 2026-10-10: Jeremy asked Codex to take over "Open sea: whale rescue and final playthrough" after
  Claude's weekly limit. His model ruling: "you can use sol for review, but i'd like you to do any remaining work
  yourself as astra". This chat runs `gpt-6-astra`. `sea-pace` and `sea-polish`
  were already merged at `29960fd5`. The final `sea-blow` agent left two code commits (`4af09c8b`, `25772c46`),
  passing checks and captures, plus an uncommitted design amendment. That amendment is preserved in `859c316f`,
  and the work is merged on `sea-whale` at `4aa6bca3`. Production and QA builds pass.
- Integrated verification, 2026-10-10: real-gesture sea play completed at 1600×900 and 430×932 through all five steps,
  the farewell and the mirror's seven-second arrival plus three seconds settled. Each took one go per step except
  four heave strokes; both saw 539 swim frames, no clipping and a maximum 1.03 m gap from the hull-side swim point.
  No browser errors, stray shader programs or unwarmed program/target pairs. Saved camera traces and arrival
  strips show a gradual handoff; peak acceleration across the arrival and first walk was 1.41 / 1.58 m/s² with
  the previous agent's 0.5 s velocity-window measure. No further gameplay change arose. Audio was not freshly
  auditioned; N5c's existing audio review remains the evidence for it.
- Jeremy approved extending `tools/sea-check.mjs` to cover the settled mirror, camera trace and runtime/compile
  errors (`e0b7ad56`). All six new report assertions reject injected failures. The first landscape run exposed a
  report-format mistake in the assertion; the corrected assertion passes its saved report, and the phone run
  passes end to end. Pacing seeds 147/148, sea logic seed 147 and the sleeping-island crossing also passed at the
  integrated gameplay head. Captures, traces, videos and logs: `/tmp/updraft-sea-takeover-V1Gw4P/`.
- Review build: stable QA preview on port 5330, `?chapter=sea` for the passage or `?chapter=whale` for the rescue.
  Jeremy's workflow ruling: "before any fix or change you want to make, present me a list so i can approve".
  Merging the encounter into main still needs his approval.
- Performance follow-up, 2026-10-10: Jeremy approved both proposed net CPU optimisations: "yep please do the
  optimisations you identified". Cache repeated spine/lift-weight calculations and streamline sheet normals and
  rope tangents, preserving geometry and behaviour. Before/after measurement and geometry parity are required;
  this does not authorise the main merge. Baseline audit: `/tmp/updraft-whale-perf-NNMYa6/README.md`.
  Implemented with per-call spine values, double-precision cached lift powers, fixed neighbour tables and scalar
  normal/tangent loops. Production and QA builds pass. The full real-gesture sea replay through settled Mirror
  passed; 48,774 sampled comparisons against the previous implementation across every live-net phase found zero
  difference in mesh positions, normals, contact/afloat weights and rope tangents (128,890,468 numeric comparisons).
  Alternating old/new CPU batches on identical frozen poses reduced sheet + fold + rope-tangent work from
  0.188–0.228 ms to 0.048–0.088 ms (61–75%, about 0.14 ms saved). These are the changed routines' isolated costs,
  not whole-frame speedups; mesh detail, shaders, particles and render resolution are unchanged.
  The rebuilt QA preview at 430×932, ratio 2 held 60 fps for 20 seconds after warmup (p99/max 16.8 ms, no hitches
  or long tasks on this Mac; not a physical-phone measurement).
  Evidence and alternating old/new benchmarks: `/tmp/updraft-net-opt-rqMjR6/`.
Done: [x]

### Phase N4: docs on approval
Once Jeremy approves: the open sea's landscape and portrait paintings regenerated with the whale using built-in
imagegen and game references, with the chapter tile derived from the landscape; the open sea's section in
`docs/chapters.md` (its ruling "at most 100 s, nothing asked" replaced),
the crossing table in `docs/contracts/world.md`, the new tuning names; this item's crossing sections trimmed.
Jeremy approved both documentation and thumbnail work on 2026-10-10: "approved both". The chapter, world and save
contracts now describe the five steps, mist and camera handoff, geography revision 6 and seven whale checkpoints.
The design's pacing/save summary points to these durable contracts.

Jeremy rejected the screenshot substitution and directed the correction: "what do you mean approve that
correction? You made a mistake. fix it. look at how the other chapters are done and follow that pattern."
The replacement follows that pattern: built-in imagegen landscape and portrait paintings, native PNG masters and
exact prompts retained, q94 full-size WebPs and a q90 400×250 tile derived from the landscape. Scene references
come from the integrated whale playthrough; existing sea and drowned paintings supply the finish and boat design.
The whale's eye and net are the subject, beside the empty red-sailed boat; the title, hover painting and tile agree.
Provenance: `assets/art-direction/sea-whale-2026-10-10/record.json`.

Verification: production and QA builds pass. Actual title and chapter-select captures at 1600×1000, 2000×800 and
390×844 show the matching paintings and 400×250 tile loaded without browser errors. Wide Sea controls were
returned to the centre over open water, clear of the boat; the start-over confirmation was checked there too,
and Mirror's 77% control position was verified unchanged. Native masters, exact prompts, dimensions and derivative
checksums are retained and verified. The portrait collage is rebuilt. Evidence:
`/tmp/updraft-sea-takeover-V1Gw4P/art-*`. N4 is complete on `sea-whale`; main merge still awaits Jeremy's approval.
Done: [x]


### Phase N6: approved whale playtest corrections

Jeremy approved all five fixes on 2026-10-10, with the pacing constraint quoted in design.md. Work on sea-whale;
main merge remains a separate approval. Files: net.ts, sleeper.ts, net-whale.ts, tuning.ts, focused checks and
corresponding sea contracts. Preserve the measured net CPU improvements and existing save semantics.

- [x] Permanently turn the blowhole flap aside with visible breathing clearance.
- [x] Prompt invitations and overlapping camera/reaction handoffs.
- [x] Flipper loop clearly above water and framed with the cygnet.
- [x] Continuous tail bend through the farewell.
- [x] Carefully redistribute quiet approach/departure time; compare ordinary/gust/30–60 fps pacing.
- [x] Build, save/interaction checks and landscape/portrait play through settled Mirror; inspect captures and timings.

Implementation: the loose patch is a hinged part of the existing net, covering a real opening until the updraft
and first breath turn it aside. It stays folded as the remaining net is hauled away. Invitations begin 0.50–0.53 s
after each target becomes actionable; the eye/line camera handoff overlaps the end of their exchange. The loop is
thicker and its entire ring clears the swell by at least 0.36 m in the idle check. The tail's maximum neighbouring
spine-angle change falls from 1.040 to 0.295 radians, spreading the former elbow over the stock.

Pacing decision: preserve the approach rather than speeding it up to recover an arbitrary ten seconds. Keep the
route, geography revision, authored twelve-second swim and farewell clock. A 3 m/s onward cap changes the time
from the whale disappearing to the mooring from 40–46 s to 62–64 s across ordinary/gust wind, wind bearings and
30/60 fps. The rescue starts at the same time to 0.1 s. Passage gates and all interaction/save logic checks pass.
Evidence: `/tmp/updraft-whale-fixes-OtdqgR/README.md`.

Verification: production and QA builds pass. Full landscape/portrait real-gesture runs pass through the settled
Mirror: one circle, one eye sweep, one cork sweep, four heaves and one flipper sweep in each; no browser errors or
unexpected shader compilation. Breath-flap rotation, exposed loop and tail rise/turn were inspected in both
orientations. The broader tail needed a little more room in the phone farewell: that hold is wider and looks
further toward it, keeping the whole raised span in frame. The final phone hold was replayed from the release
through the settled Mirror, with clean runtime/shader checks. Geometry/framing gates pass at the final settings.
The rebuilt preview at 430×932, ratio 2 holds 60 fps for 20 s after warmup (p99/max 16.8 ms; no hitches or long tasks
on this Mac, not a physical-phone measurement). Stable playtest preview remains on port 5330.
N6 is complete on `sea-whale`; main merge still awaits Jeremy's approval.

### Phase N7: second sea playtest pass

Approved six-item batch and verbatim brief: design.md, "Approved second sea playtest pass". Astra implements on
sea-whale, preserving existing performance work, checkpoints and the longer onward sail.

- [x] Real gunwale contact and continuous entry/return for both cygnet swims.
- [x] Approach 10–15 s shorter, with dolphin and swim beats preserved.
- [x] Surface-fitted flipper rope and readable cygnet pickup/hold/release.
- [x] Smoother whale calls without the motor-like pulse; production audio rendered in context and levels checked.
- [x] One sun disc with its glow aligned during the onward sail and Mirror arrival.
- [x] Builds, focused regressions, landscape/portrait playthrough and refreshed port 5330 preview.

The supported perch uses the actual gunwale profile, follows the hull after its update and plants the feet while
the hop settles. The hop's source travels with the boat; water-to-rail returns keep the source on the water.
The rope samples the same flipper surface and pose as the rendered mesh, with a small knot on its leading edge
and a heavier loose end. The bird takes it over 0.8 s and looks toward the tie while its bill holds the actual end.

Geography revision 7 moves the whale 52 m nearer. Across seven wind/frame-rate cases the first puzzle begins
11.1–11.8 s earlier; the twelve-second swim is unchanged. A 3.9 m/s onward cap over the longer remaining distance
keeps that sail at 63.6–64.9 s, within 1.3 s of N6. Mist reveal checks pass: heard first, then the blow above the
still-hidden body, then its shape, with the mirror hidden until departure. Old whale checkpoints move once;
other revision-6 saves keep their positions.

The voice uses softer harmonics, a quieter sub and filtered breath instead of detuned beating and a 27 Hz pulse.
Four production call fixtures and the calls over the sea score render without clipping (mixed peak −18.0 dBFS).
The rendered clips are provided for listening in the playtest; no human listening approval is claimed.
The doubled sun came from the mirror water's low-horizon reflection. That narrow region now continues the visible
sky around the sun, preserving one round disc and its glow.

Evidence and source hashes: `/tmp/updraft-sea-contact-0EYfFu/README.md`. Full landscape and phone plays through the
settled Mirror pass with one circle, one eye sweep, one/two cork sweeps, four heaves and one flipper sweep;
invitations in 0.50–0.52 s, no browser errors or unexpected shader compilation. Shared character-animation gates
all pass, including foot contact and hand gaps. Port 5330 serves the current QA build.
The onward sail at 430×932, ratio 2 holds 60 fps over 20 s after warmup (p99/max 16.8 ms, no hitches or long tasks
on this Mac; not a physical-phone measurement). N7 is complete on `sea-whale`; main merge still awaits approval.

### Phase N8: active cygnet pull and normal onward sailing

Approved brief in design.md. Astra owns net-whale, net, cygnet swim/pose, geography/migration, tuning and their
checks/contracts. Preserve other chapters' swimming, existing checkpoints and mirror-to-home navigation.

- [x] Backward paddling takes up slack, draws the loop off the lifted fin and tows it clear before release.
- [x] Normal boat speed; longer onward distance with mirror/home moved together and old saves migrated.
- [x] Causal motion and speed regression checks, save/navigation checks, landscape/portrait visual verification.
- [x] Build, update contracts and refresh stable port 5330 preview; no main merge or deployment.

The bird's actual backward displacement draws the loop along the flipper; freezing its position leaves the loop
attached even after the lift's clock runs out. The bill retains the rope through the pull and a further tow clear.
Its body braces and its feet work while it continues facing the rope. A wider portrait hold keeps the whole pull
in frame; both CPU and browser checks now explicitly cover that interval.

Revision 8 moves Mirror and home together by (-10, -42) m. The mirror's approach curve has a larger radius for
normal-speed gusting boats. Both special sailing caps are gone; the normal 10 m/s ceiling and boat physics apply.
Seven pacing cases pass: ordinary onward 63.1–65.3 s, sustained gust 30.9 s, late gust 58.4 s. The twelve-second
swim and first puzzle at 90.6–92.9 s are preserved. Home retains its 206 m route and 40.3–40.9 s ordinary crossing.
Jeremy will playtest the lengths before deciding on any further change. Evidence: `/tmp/updraft-sea-pull-z6lcrs/`.

Production and QA builds, sea mechanics, geography, pacing and all seven shared character gates pass. Full
landscape/portrait real-gesture runs reach the settled Mirror with no browser errors or unexpected shader
compilation. Portrait records 310 pull/tow frames with no clipping; the held rope, pull, final tug and tow clear
were inspected in both orientations. Deliberately restoring the timer-driven loop, slow sailing cap or old phone
framing fails the corresponding regression guard.

The broader terrain-height check has an existing open-sea-floor mismatch: 0.16704 m at (194, -1750), identical on
the unchanged `f1e6a0d5` baseline and N8. Every visible terrain patch remains within the height/normal limits;
the translated islands introduce no new failing samples. This unrelated terrain issue remains open. N8 is
implemented on `sea-whale`; journey-length feedback and approval to merge into main remain with Jeremy.

### Phase N9: sixty seconds to the whale, forty to the Mirror, and its audible voice

Jeremy's corrected numbers and voice report are verbatim in design.md. Astra owns geography, route, save migration,
encounter voice timing, whale-voice synthesis and their checks. Normal boat speed and Mirror-to-home route persist.

- [x] Shorten the distances to reach the first whale puzzle in about 60 s and the Mirror in about 40 s after farewell.
- [x] Restore the low call at first sight and its audible body, preserving smooth calls and the score's room for them.
- [x] Verify timings, saves, sound, landscape/portrait play and builds; refresh port 5330 and record the results.

Revision 9 moves the whale by (133, 58.5) m and Mirror/home together by (228, 122.5) m. Seven pacing cases pass:
first puzzle at 59.9–60.8 s; ordinary onward sailing at 38.1–40.7 s, sustained gust at 19.7 s. Normal sailing
speed, the full twelve-second swim and the 206 m Mirror-to-home route remain. The pod starts earlier and its
nudge starts the lead on actual contact. Mist depth and reveal timing fit the nearer whale: hidden during the
pod's play, heard, then blow, then body. The camera closes only as the reveal develops.

The first moan lasts 8.2 s and carries through the reveal. Fuller upper harmonics restore its audible body above
180 Hz, about 8 dB above the previous thin voice, without restoring detuned beating or the periodic motor pulse.
Four production voice renders and their sea-score mix have no clipping; listening remains part of Jeremy's playtest.
Restoring either the thin harmonics or the short call deliberately fails the corresponding regression check.

Full landscape and portrait runs complete all five puzzles and the settled Mirror arrival. Both reach the whale
at 58.9 s and take 39.8–39.9 s onward; no swim/pull clipping, browser errors or unexpected shader compilation.
Invitations appear in 0.50–0.52 s. Typecheck, production/QA builds, mechanics, geography and navigation pass.
The fractional relocation exposed hard-coded `.0` suffixes in home terrain/grass shaders; those now use `glsl()`.
The terrain comparison retains N8's existing 0.167039 m sea-floor mismatch, with zero failing visible samples.
The broader marine-audio check also fails its first-crossing surface sequence on unchanged `81573eb2`; this is
separate from the encounter voice. These existing failures remain open.

Evidence, renders, captures and source hashes: `/tmp/updraft-sea-n9-pSUeOt/README.md`. Port 5330 serves the current
QA build. N9 is implemented on `sea-whale`; main merge and deployment remain outside this batch.

### Phase N10: restore the reveal, natural neck pose and whale voice

Jeremy's reports are verbatim in design.md. The 60/40-second sailing targets remain binding.

- [x] Rebase sea-whale onto committed main (`3f7a237a`), preserving all sea work and upstream fixes.
- [x] Restore the distant silhouette and gradual reveal, with clear water around the boat; compare in motion.
- [x] Correct the cygnet's neck through hop-out, rope pickup and backward pull, retaining the active pull.
- [x] Remove the freed song's mechanical synthesis features while keeping audible low calls; render all variants in context.
- [x] Verify both orientations, pacing, saves, source integration, sound and builds; refresh port 5330.

Rebase audit: the resulting tree differs from pre-rebase `f6a46f18` only by main's five new commits after the
reconstructed whale-eye expression is restored. Historical doc conflicts preserve the later approved notes.
The distance-driven mist no longer crowds the boat to conceal the whale until a late dolphin cue. Its first
silhouette appears about 112 m short of the rest, gaining detail over about twelve seconds; the nearest veil
stays at least 77.6 m from the camera. The low call and distant blow precede that silhouette. All seven pacing
cases pass: ordinary first puzzle 60.3–60.8 s, onward 38.0–40.7 s, with normal speed and the twelve-second swim.

Literal point gaze removes the person-height adjustment from the rope. The bird looks along its swim path,
suppresses idle preening during the task and wakes from its passenger doze as it hops out. That last cause was
caught in the first full capture, then corrected and rerun. Both final full runs keep the bill within 0.39 radians
of the rope through the pull. Freezing the bird still prevents loop removal: backward paddling remains causal.

The voice now uses rounded harmonics, eased pitch arches and diffuse reverb. Fixed throat resonances, the
sub-octave and discrete repeats are removed; the freed song ends before the flipper goodbye. The first low moan
lasts 10.2 s and retains its measured speaker-band body. All six production call variants pass clipping, level
and rapid modulation checks; the real game release mix is recorded through the final deep call. No direct
listening approval is claimed: this session has no audio-listening tool.

Final landscape and portrait runs complete all five puzzles and the settled Mirror arrival, with no clipping,
browser errors or unexpected shader compilation. Invitations appear in 0.50–0.52 s. Mechanics, saves, geography,
Mirror navigation, typecheck and production/QA builds pass. Restoring close fog, person-height gaze, idle preening,
retained sleep, pulsing voice or weak upper harmonics deliberately fails the relevant regression guard. N9's
unrelated baseline terrain and marine-audio failures remain open.

Evidence, reports, videos and audio: `/tmp/updraft-sea-n10-WtbK2q/README.md`. Port 5330 serves the corrected QA
build. N10 is implemented on `sea-whale`; no merge or deployment yet.

### Phase N11: dolphins lead toward the visible whale

Jeremy's report and approved camera correction are in design.md. Astra owns the approach waypoints in journey.ts,
the camera handoff in crossing.ts/tuning.ts and their reveal/pacing checks. Preserve the whale's position, resting
frame, normal speed, full swim and onward route.

- [x] Curve the initial approach toward the whale before its silhouette is visible.
- [x] Ease from the swimmer's side view toward the boat-to-whale line, keeping both visible in portrait.
- [x] Check actual pod movement, swim, nudge, reveal and pacing; compare landscape and portrait captures.
- [x] Build and refresh port 5330; record evidence and keep the branch unmerged.

The first two waypoints turn the approach earlier. Actual pod movement stays within 32 degrees of the whale's
bearing across landscape and portrait checks; restoring the old route produces a 54-degree divergence and fails
the guard. The camera turns toward the revealed whale while retaining room beside the hull for the swimmer,
then eases behind the boat as the bird returns. Restoring the old handoff puts the whale's head outside portrait
and fails the framing guard. The portrait trace's maximum turn rate over seconds 24–61 falls from 10.7 to 5.8
degrees/second; maximum camera acceleration falls from 3.3 to 2.3 m/s². The horizon remains level.

Seven pacing cases preserve the twelve-second swim and normal speed. Ordinary runs reach the first puzzle in
61.8–62.4 seconds and sail from whale-gone to Mirror in 38.1–40.7 seconds. Both full GPU runs complete all five
puzzles and the settled Mirror arrival without swim/pull clipping, browser errors or unexpected shader compilation.
Invitations remain 0.50–0.52 seconds. Mechanics, saves, geography, navigation, typecheck and production/QA builds
pass. N9's unrelated baseline terrain and marine-audio failures remain open; this batch does not change audio.

Final captures are `camera-land-*` and `camera-port-*` in `/tmp/updraft-sea-n11-F2TBFa/`; the evidence README
distinguishes them from intermediate route-only captures. Port 5330 serves the revised QA build. N11 is implemented
on `sea-whale`; no merge or deployment.

### Phase N12: natural dolphin flight and audible reference whale calls

Astra owns `sealife/dolphin.ts`, `audio/whale-voice.ts`, `story/net-whale.ts`, their tuning and targeted checks.
Jeremy approved the three corrections recorded in design.md. Preserve the rest of the sequence and pacing.

- [x] Launch from the dolphin's actual safe position and velocity; prove continuous forward flight without hull clamping.
- [x] Rebuild the procedural voice against NOAA's pitch/tone/phrasing reference and rebalance it in context.
- [x] Add a closer-approach phrase without changing the reveal; verify voice events and actual mixed sound.
- [x] Check landscape/portrait, full rescue and onward pacing; refresh port 5330 and record evidence, unmerged.

The leap chooses an adult physically on the camera's side, gathers speed at its actual mark, and holds its run
through the final rising stroke and flight. All 32 combinations of side, orientation, frame rate and seed clear
the hull without clamping and gain 1.53–3.05 m on the boat. Restoring the former launch fails the guard. The final
landscape game capture gains 3.12 m while staying at least 6.26 m from the centreline.

The original voice now follows the varied contours and changing harmonic balance in NOAA's humpback reference,
with no fixed bass stack or score-note arches. At the first approach's actual 165 m distance, the moan's rendered
RMS rises about 5 dB; the freed song rises about 7 dB. A 4.4-second closer phrase follows the distant call after
a gap. The game recording confirms calls at 24.55 and 40.77 seconds, without moving the reveal or slowing the
boat. All seven voices pass level, clipping, speaker-band and rapid-pulsing checks; weak and motor-pulsing
mutations fail. The actual approach and release mixes do not clip. Spectrogram comparisons and recordings are
evidence of the work, not listening approval; this session cannot listen directly.

The corrected leap changes the later pod arrangement. One portrait/wind-direction case nudges 20.5 seconds before
the first puzzle, outside the former 20-second test allowance. Its arrival is still 62.4 seconds, the same as the
old dolphin implementation. The test now allows 21 seconds from nudge to puzzle; arrival, speed, braking, reveal,
camera and onward constraints are unchanged. No game pacing adjustment was made to satisfy that assertion.

Both final GPU runs complete the five puzzles and settled Mirror arrival with no browser errors, unexpected
shader compilation or swimmer/pull clipping. Invitations remain 0.50–0.52 seconds. Fourteen landscape/portrait
pacing cases pass, preserving normal speed, the full swim, ordinary arrival at 61.8–62.4 seconds and onward
sailing at 38.1–40.7 seconds. Sea mechanics/checkpoints, the sea score, production isolation and both builds pass.

Evidence and before/after audio: `/tmp/updraft-sea-n12-yCarUU/README.md`. N9's unrelated baseline terrain and
marine-audio failures remain open. No merge or deployment.

### Phase N13: voice at the visible reveal and a separate blowhole net

Astra implements Jeremy's approved scope in design.md personally.

- [x] Separate visual breath staging from sound; prove no whale sound during the swim or before visible emergence.
- [x] Deepen the changing voice, increase reverb slightly and lower its level a touch; render comparisons.
- [x] Lift and carry aside a separate weathered blue-green net; keep the orange net unaffected by the updraft.
- [x] Check rescue mechanics, checkpoints, pacing and landscape/portrait; refresh port 5330, unmerged.


The first call now waits for the cygnet's completed return and the whale's visible emergence; the visual blow
and reveal retain their original timing. Weak breaths and net sputters use the same audio gate. Fourteen full
pacing cases keep normal speed and ordinary 61.8–62.4-second arrival / 38.1–40.7-second onward sailing. The actual
landscape and portrait captures sound the first moan at 40.32–40.33 seconds, with every approach whale sound
occurring after the bird is aboard. Restoring the early-call trigger fails the new guard during the swim.

The voice is lowered by about four semitones (`pitch` 0.78), with level 0.20 and wet send 0.42. Matched-distance
renders of the six encounter calls measure 0.7–0.9 dB quieter. The audio harness previously never prepared the
shared reverb; it now renders that production reverb and verifies an audible tail. Rapid-pulsing checks measure
the direct voice, since diffuse reflections introduce unrelated fluctuations. All seven calls pass; deliberately
thin and motor-pulsing versions fail. These are signal checks and comparison clips, not listening approval.

The separate blue-green net has 0.65 m cells against the orange net's 1.25 m weave, with its near edge visibly
draped over the orange sheet. The whole net lifts above the crown and drifts off the far side over five seconds.
The orange sheet, ropes and floats remain exactly unchanged by updraft, breath-doming and upper-net drift at a
fixed body pose. Checks establish coverage before lifting, a permanent opening afterwards, and checkpoint
restoration. The flight remains clear of the skin. Both full GPU captures finish all five rescue steps and the
settled Mirror arrival with no browser errors, unexpected shader programs, or swimmer/pull clipping.

Typecheck, production and QA builds, sea mechanics/checkpoints and voice checks pass. Evidence, final screenshots,
videos and before/after sound clips: `/tmp/updraft-sea-n13-Oltlpe/README.md`. Port 5330 serves this revision.
N9's unrelated release-check failures remain open. N13 is complete on `sea-whale`, unmerged and undeployed.

### Phase N14: approved sea review and main merge

Astra implements Jeremy's three approved review corrections personally; his merge brief is in design.md.

- [x] Replace the five reversed shader ranges with equivalent supported ramps.
- [x] Stop settled blue-net geometry work and cache fixed call durations; verify parity and checkpoint reuse.
- [x] Run focused checks and both sea orientations, rebase against current main and merge the approved chapter.

The pre-change quick suite passes 13 of 14 checks; only the five sea shader bounds fail. An instrumented
mechanics run measures the redundant settled blue-net update at about 0.036 ms per frame on this Mac, an
isolated routine cost rather than a whole-frame speedup. Evidence: `/tmp/updraft-sea-merge-TojNOy/`.

The corrected quick suite passes all 14 checks. The blue-net buffers match the approved implementation exactly
over 102,964 updates, including 36,215 settled frames, across rescue phases and all tested checkpoint restores.
An alternating six-round benchmark reduces its settled update from 0.0345–0.0350 ms to the early-return cost;
the regression also proves unchanged buffers are not uploaded and redraping resumes updates. Fixed call lengths
are now computed once. All seven production whale voice renders pass. Sea mechanics, fourteen pacing cases,
geography/save migration, crossing camera/haze and dolphin flight checks pass, as do production and QA builds.

Both full real-gesture GPU replays complete the five puzzles, farewell and settled Mirror arrival, with zero
browser errors, unexpected shader programs, or swimmer/pull clipping. The supported shader ramps also pass on
Metal and software Vulkan. Source and evidence index: `/tmp/updraft-sea-merge-TojNOy/README.md`.

Committed as `fdb9864d`, rebased against current main (already up to date), then fast-forwarded into clean local
main from `3f7a237a`. This sea work is merged. No deployment or remote push was performed. N9's previously
recorded unrelated terrain and marine-audio failures remain open; this was a focused merge check, not a fresh
whole-game release certification. Other path-puzzles work remains in this backlog.

### Approved drowned village integration into main

Jeremy approved merging the final reviewed village (`79c8c621`) into local main (`97f7e4d4`). The 11 conflicts
are resolved with both chapters' behaviour preserved, including the two boarding modes, sea voice and wind
invitations, stair-sail unmirroring and room/character lighting. The approved analytic mist remains the only
village renderer; its shader body matches the reviewed branch exactly.

The merged production build and bundle checks pass. All village mechanics, sea gameplay, Mirror departure and
crossing checks pass. The stairs-to-rescue replay measures four seconds and 9.27 m of sailing before the
becalming tone/effect. One stale camera fixture now respects main's acceleration limit; its corrected check
passes. The pond-framing and first-crossing marine-audio checks retain their pre-existing main failures.
Both landscape and portrait roof-to-woods replays, all five village checkpoint reloads, and analytic mist/lantern
continuity checks pass. The reviewed village is merged into local main. Details: [final-review.md](final-review.md).
Evidence: `/tmp/updraft-drowned-merge-6sLLVd/`. No push or deployment was performed. The pre-existing untracked
drowned-dusk artwork folder is preserved outside the merge.

### Post-merge baseline failures (2026-10-11)

Jeremy asked to fix the two pre-existing failures; his exact request is in `design.md`.

- [x] First-crossing marine audio: update the obsolete two-breath expectation to the approved single-breath
  surfacing documented above. Keep the exact event order and repeated-surfacing checks at 10/30/60/144 Hz.
  All 56 assertions and seven offline renders pass; production sound and animation are unchanged.
- [x] Pond framing: hold the waiting family and every take-off inside the existing margins, with the bank clear
  of the sight lines. The portrait approach moves slightly around and back; the approach lens is 0.3 m higher.
  All twelve 30/60/120 Hz, landscape/portrait, two-approach cases pass without weakening an assertion.
- [x] Repair the browser review setup to wake the island before judging the flock; it previously captured
  invisible birds on an unwoken pond. The new visibility assertion makes that mistake fail explicitly.
- [x] Review the final rendered comparisons and run the corrected browser check: both aspects pass, the family
  is visible, and the child positions match the baseline. Both cameras return to the existing shore position.

Evidence: `/tmp/updraft-baseline-fixes-hVoE9o/`. Related meadow route, plane, piano framing, flock flight and
camera-direction checks pass. This work changes the pond framing and test fixtures, not the village's approved
camera, mist, sound or animation.
