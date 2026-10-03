# The world

How the ground, its life and what lives on it fit together, where the rooms are, and how each is hidden until it is
reached. The wind's own contract is `wind.md`; how each room plays is `docs/chapters.md`.

## Height

- One function, written twice: `worldHeight(x, z)` in TypeScript and `worldHeight(vec2)` in GLSL, both in
  `src/world/heightfield.ts`, on the same integer-hashed gradient noise so they agree everywhere
  (`src/world/parity.ts` measures the difference at load). Every island, the open sea and the submerged rooms are
  in it. Anything carved for a room (the pond, the little boats' pools, the cottage terrace, the sleeping island's
  ridge) is carved in both, and the parity check samples it.
- `heightAt(x, z)` (`src/world/island.ts`) reads the window's height bake when the point is inside it and falls
  back to `worldHeight`, so it is valid everywhere and matches what is drawn. Use it for anything that stands on
  the ground.
- The terrain, grass and sea all read the same 512² height bake inside the window (`src/world/ground.ts`), so
  nothing floats or sinks.

## The window

A 320 × 320 square that follows the camera (`src/world/window.ts`; see `wind.md` for how it moves). Everything
baked in window space is re-made or shifted when it moves: height, ground (normal and sun visibility), surface
(open ground and flower patches), the shoreline distance for the surf, the life field and the wind textures.

## Where the rooms are

One coordinate space; the camera looks roughly north (−z) and the journey runs south to north, then west. Centres
and half-sizes are in `ISLES` (`heightfield.ts`) unless noted:

| room | centre (x, z) | half-size | defined by |
| --- | --- | --- | --- |
| still island | (−6, −14) | its own coastline | `islandCoast` in `heightfield.ts` |
| island of lines | (14, −368.4) | 70 × 64.4 | `ISLES.lines` |
| the shore through the red door | (240, −365) | 23 × 30 | `DOOR_SHORE` |
| little boats | (130, −420) | 48 × 70 | `LITTLE_BOATS` (`little-boats-layout.ts`) |
| meadow | (10, −780) | 227 × 200 | `ISLES.meadow`, sculpted at 340 × 300 and scaled by `tuning.world.meadowLength` (`meadowPoint`) |
| birches | (0, −1128) | 60 × 80 | `ISLES.birches` |
| stairs | (100, −1236) | 30 × 26 | `STAIRS_ISLE` (`stairs-layout.ts`) |
| drowned village | (−10, −1440) | 210 × 175, all under water | `ISLES.drowned` |
| dark wood | (−30, −1800) | 130 × 115 | `ISLES.wood` |
| sleeping island | (−175, −1922) | 42 × 46 | `ISLES.sleeping` |
| sky mirror | (−345, −2090) | 82 × 70, a flat just under the water | `SKY_MIRROR` (`sky-mirror-layout.ts`) |
| home | (−100, −2370) | 190 × 165 | `ISLES.home` |

`world/geography.ts` holds each moved room's shift from its original placement, and `GEOGRAPHY_VERSION` migrates
saved coordinates on load. Moving a room means moving its terrain, props, walking
targets, berths, routes and region masks together, bumping the geography version with a migration, and
re-measuring both crossings that touch it. `node tools/geography-report.mjs` prints the centres, berths, routes and
distances; `tools/geography-check.mjs` checks migrations, clearance and continuity.

## Crossings

Routes are `ROUTES` in `story/journey.ts`. At the ordinary 2.6-unit breeze the hull drives at 4.5 units/s, up to
5.5 with a following wind; player gusts can push it to the 10 units/s ceiling (`tuning.sail`). Routes are sized for
the ordinary breeze, never by per-crossing speed boosts (Jeremy ruled those out); turns, mooring, the storm and the
cygnet's swim slow the boat naturally. Targets at the ordinary breeze:

| crossing | about | notes |
| --- | --- | --- |
| still island → lines | 95 s | the long first curve: farewell look back and the whale |
| door shore → little boats | 30 s | |
| little boats → meadow | 40 s | arrives lined up with the hill path |
| meadow → birches | 20 s | a short blind hop |
| birches → stairs | short | under the cloud deck |
| drowned village to the wood | player-paced | the becalming waits for the player; the storm is about 40 s |
| wood → sleeping | 40 s | a sheltered bend |
| sleeping → sky mirror (the sea) | at most 100 s | includes the pod's leap, the swim and the nudge |
| sky mirror → home | 40 s | curves offshore before turning in to the jetty |

A crossing is never shortened by losing an encounter: the sea's departure waits for the swim and the nudge.
`tools/journey-pacing-check.mjs` sails the real boat through the passages (`CROSSING=` for one) at several wind
bearings and frame rates; `tools/boat-check.mjs` checks navigation and storm pacing.

## Hiding what is next

The player never sees the next island before it is time.

- **Only two rooms at a time.** `visibleRooms` (`world/journey-rooms.ts`) gives each chapter the rooms it may draw:
  a crossing its departure and destination, a room itself. Terrain and grass discard the rest, water drops their
  shallows and surf, and their props leave both the scene and the reflection. A room coming into view is covered
  in fog first and cleared after (`JourneyReveal`, `tuning.world.arrivalFogCover`/`arrivalFogClear`). The door
  shore is visible only from the washing and its outgoing crossing; the home jetty only from `toHarbour`.
- **Haze.** Each chapter sets a `haze`; the veil (`uVeil`, `world/atmosphere.ts`) dissolves the world past it
  whatever the height.
- **Island mist.** The island ahead can lie in its own mist (`uIsleMist`, `uIsleMistRange`, part of
  `journeyVeilAt` so emissive props obey it): sightlines over that coast dissolve into `skyRadiance` beyond a
  distance, so the near shore comes out first and nothing behind shows through. The drowned village keeps the wood
  in it beyond its drawn trees; the crossing to the sleeping island keeps all but the landing shore in it, so the
  summit window is found ashore (`tuning.world.woodMist`, `sleepingMist`; lifted at `isleMistLift` on landing).
- **The meadow's coastal veil** (`uIslandVeil`, `uIslandVeilAmount`, `tuning.world.meadowVeilFrom`/`To`) blends
  everything outside the meadow's shore into the sky, from the piano to the departure.
- **Open sea.** On the long crossing `Chapter.openSea` (eased into `uOpenSea` by `main.ts`) makes distant fog
  converge fully on the sky backdrop, so hidden islands leave no tinted outline; it releases on the approach home.
- **Nothing snaps into colour.** Everything north of `LIVING_BEYOND` (`atmosphere.ts`) is already alive before the
  child reaches it; only the still island starts grey, and the meadow is held back by its waiting region.
  `main.ts` eases time of day, haze, season and rain toward what each chapter asks, so a chapter change is never a
  cut in the sky.

## The sea surface

`world/water/swell.ts` owns the swell. CPU floaters use `swellLift`/`swellAt`; foam, rings, slicks and submerged
dolphin silhouettes use GLSL `seaSurfaceY`, which undoes horizontal wave displacement before finding the surface
height. Surface marks have enough vertices to bend over the swell; the boat emits them for its wake.

## Boats on the shore

`Boat` resolves its rotated hull against the terrain on placement and every frame, afloat or pushing off, and
eases its pitch and roll toward a beach's slope. Clearance and the most shore tilt are in `tuning.sail`. Made fast
at a berth, it measures once the highest ground its hull could reach (kept until it drifts 1 m) and skips the contact
tests on frames where even that leaves the hull clear, since outside the height window each test is the procedural
terrain (`tools/boat-mooring-check.mjs` proves every skipped frame could not have moved it).
`tools/boat-ground-check.mjs` audits berths, launches and crossings on the CPU; `tools/boat-shores-check.mjs`
checks the baked and rendered ground at each shore. Arrival rooms keep the boat on its beach until the walk
reaches their inland crest (`tools/landing-check.mjs`).

## Prints and echoes on the beaches

- **Footprints** (`world/footprints.ts`): the child's heel strikes (`ChildMotion.strikes`, filtered to the ground
  itself by `Traveller.footfalls`) and the cygnet's footfalls (`Gait.landed`) press prints into bare sand above the
  sea. Two ring buffers (64 boots, 32 webbed feet) go to the terrain shader in chunks of eight, each with its own
  bounds, so a sand fragment tests a few boxes and shades only the prints whose chunk holds it; with no live print
  the shader skips them entirely. A print softens with age, fades over `tuning.footprints.fadeFrom`–`fadeTo`, fades
  as its ring fills, and is gone wherever a swash has run over it since it was made (worked out from the same
  `surfCycle`/`surfReach` the waves use, so it is wiped exactly where the water went).
- **Dream echoes** (`world/echoes.ts`): one static thing from the room before on four arrival beaches, each in its
  own room's objects: a pegged pillowcase on the little boats' beach, a stranded toy boat on the meadow's, a run of
  piano keys on the birches', the swing's seat and gold leaves on the stairs'. Each is placed above the tide line
  and off the walk, buried to `bury` below its lowest point, gritty and darker where it meets the sand, and fades
  with `lifeAt` like everything else. The terrain darkens a damp patch under each (`echoDamp`).

## Life

- `src/world/life.ts` keeps a 256² field over the window: 0 grey and still, 1 fully alive. Wind over land raises
  it, it spreads slowly, and it never falls.
- Regions extend it beyond the window (`life.regions`): the still island (a disc that fills once the island is
  restored), the wave (a growing radius with a soft edge from wherever a room's colour comes back) and the waiting
  island (the meadow, where wind raises no life at all until the piano's last wave has covered it, `uWaiting`).
  The meadow's front has a fixed irregular shape shared by CPU and shaders (`world/music-growth.ts`), so advancing
  it never removes earned colour.
- `LifeField.bloom` plants colour on purpose (a place, a radius and a rate, for this frame), even inside the
  waiting island; it then grows and spreads like any life. The still island's airborne plane and the piano's note
  traces use it.
- `lifeAt(xz)` in GLSL and `life.at(x, z)` on the CPU (one or two readbacks behind) must agree in spirit: grass,
  terrain, the tree, petals and creatures all fade between grey and living with it.

## Fields

The meadow is a warped Voronoi patchwork (`src/world/fields.ts`, `FIELD` = 56 units), written in TypeScript and
GLSL. `fieldAt` gives the distance to the nearest boundary, a stable random `kind` for the field, whether the
boundary carries a wall, and how strongly the patchwork is present (it fades out near the coast). Walls are painted
by the terrain shader as dry-stone lines; the child clambers over one, sheep stay in their field and flowers keep
clear of them. **Nothing long and straight lies across the walk without a way through on it:** `WAY` is the line
the story walks, and no boundary within `GATE` of it carries a wall, widening to a gateway (`WIDE_GATE`) in the
first view over the bank, so the gap is the same on the ground, in the grass and in the painted line.

## Creatures

- `src/creatures/` holds one instanced draw call per species, posed in the vertex shader, and a `Habitat` that
  tells them where they may live: ground height, grass height, meadow and foraging ground, flower patches, perches.
- Every species reads the same `Stimuli` each frame: the wind field, the player's gust and updraft, the camera,
  the glider, the walking child, the life at a point, the breeze and the time of night. They are dormant beyond
  `DORMANT_RANGE` from the camera.
- Waking follows the story: rabbits pop up, butterflies rise from the flowers and finches fly in where life passes
  0.6–0.75; gulls come in once the breeze returns. Finches perch in the tree only once it has leaves.

## The shore through the red door

`DOOR_SHORE` is a small island of its own with the same CPU/GLSL height function, grass from `door-shore.ts` (the
ordinary grass skips it) and the washing's departure kite. During the washing each camera sees only its own room's
land; the boat waits on the arrival beach until the family reveal, then moves to the shore before the door opens,
and its room membership (in the reflection too) follows its position. The voyage to the little boats starts from
here. The portal rendering and the threshold transfer are in `docs/engine.md`.

## The little boats' water

`little-boats-layout.ts` supplies the stream's centre, width and level to the heightfield, water, toy fleet and
bank walkers; CPU and GLSL share the three pool shapes. The water stands above sea level and shelves down to the
departure beach. The sea mesh itself rises into the channel (no separate pool plane); `boatsWaterHeight` gives
toys and swimmers the same mean level and sheltered ripple, and the sea material fades its surf out in the pools
and back at the outlet, where swell takes over from ripple as the water deepens. Grass keeps out of the wet bowls
on CPU and GPU. `boatsCourse` carries the toy route on past the stream mouth into a turn out to sea.

## The sky mirror

`world/sky-mirror-layout.ts` holds the flat (`SKY_MIRROR`), the four fallen lights (`MIRROR_STARS`), the bowl, the
constellation above the departure jetty, the deep outer channel the empty boat takes (`MIRROR_DRIFT`), the entry
jetty (`MIRROR_ENTRY_DECK`, the mooring `MIRROR_LANDING`) and the departure jetty (`MIRROR_DECK`, `MIRROR_BERTH`).
Each jetty runs down a plank ramp onto the flat at its island end (`rampAt`, `rampLength`); the child's ground lets
her down a ramp and off its foot but not off its sides. `mirrorBed` is shared CPU/GPU terrain just below sea level
at the centre.

`water.ts` flattens the waves locally and reflects the travellers, soap props, bubbles, lights and jetties in the
existing reflection pass, with ring slopes from `world/sky-mirror.ts`; `mirror-soap.ts` draws the film. There is no
extra scene render or readback per bubble. Home fades `Water.skyMirrorAppearance` to zero so the distant flat
shades as ordinary sea behind the cottage; only that colour override is gated.

## The sleeping island

`src/world/sleeping.ts` (`SleepingIsland`). Its ground is in `heightfield.ts` (`ISLES.sleeping`, `SLEEP_HOLLOW`,
`SLEEP_HILL`: one continuous rounded ridge, steeper to the south), its frosted grass in `grass.ts`
(`sleepFloorAt`), and everything it colours the world with in `atmosphere.ts`. The chapter drives it entirely
through the values below; the room owns how they look.

**Places.** `SLEEP_LANDING` (east shore), `SLEEP_BERTH` (west shore, for the crossing on), `BED` with `BED_FACING`,
`PILLOW`, `HILLTOP`, `SLEEP_ROUTE` (the shared grassy ascent) and `SLEEP_APPROACH`, `SLEEP_LEDGE` (the launch
footing), `CURTAIN_KNOT` and `CURTAIN_END` (beyond the lip), `LAMP`, `WINDOW` with `WINDOW_INTO`, and `bedside`.
`sleeping-layout.ts` owns walking targets only; the heightfield never imports it, so no corridor is carved for
the script. `sleeping-trail.ts` owns the sparse buried rocks, snow, seed heads and guiding wisps.

**Driven values**, all 0..1 and eased inside the module (`tuning.sleeping.ease`) so a chapter setting one never
pops. Defaults in brackets.

| value | 0 | 1 |
| --- | --- | --- |
| `fog` [1] | no fog | the night's full pooling round the terrace |
| `frost` [0] | bare grass | frost hard in from the rim to the bed |
| `dawn` [0] | night | first sun down the whole hill, fog burnt back, lamp overtaken |
| `curtains` [0] | drawn | thrown open, with the light coming through |
| `cold` [0] | warm bedside, ticking clock | lamp contracted, clock stopped |
| `hint` [0] | nothing | a brief slit of window light on the pillow |
| `blanket` [0] | tucked in | folded back |
| `sleeper` [0] | empty bed | a child asleep, rising and falling with her breathing |

`fogTop` is a height (default `tuning.sleeping.fogTop`), raised to `fogClimbs` as the night thickens, so a bird
climbing the hill walks up into the fog and out near the top; the pool thins with distance from the hollow, so
the hilltop always stands clear. `applySleepingPalette(presence)` blends in the island's own winter palette (slate
night, lavender first light, golden morning under a pearl-blue sky), fading offshore; an explicit `dusk` override
bypasses it. `morningAt` follows the opened lane and then spreads green over the island. The blanket lifts under
gusts over the bed or the chapter's screen-space `bedWind`.

**In the shaders.** `uHollow`/`uHollowTop` feed `hollowDensity`, sampled along the eye ray by `fogOf`, so the
pooled fog costs other rooms one comparison; `uSleepMist` adds the shoulder bank inside it. There are no fog
planes. `uFrost` is read by `frostAt` (terrain, blades, bed, rug); `uLamp` by `lampLight`; `dawnLight` uses
`uDawnSource` (the window and the eased curtain opening) and the advancing lane. `uSleepHint` lights the pillow
independently of the dawn. Near-camera extinction eases in over `fogNear`–`fogFar`.

**Calls.**
- `carve(x, z, dirX, dirZ, strength)` stamps a lane of clear air into a 128² field (`uCarveTex`, `uCarveDomain`)
  that closes again over `tuning.sleeping.carveCloses`; the room carves from the player's own strokes every frame.
- `lane(from, to, halfWidth)` and `laneOpen` (`uLane`, `uLaneOpen`): one widening lane down the hill, clear of fog
  and frost as far as it has opened, for the morning to come down.
- `pillowPuff()` releases the pillow's down. `feather` (`src/fx/feather.ts`) is the room's control:
  `release(from, drift)` puts it in the air, where it takes the air's own speed, hangs about `featherHangs` off the
  grass and leans toward `goal`, so it can never be lost. A stroke crossing it on screen carries it (`brush`).
  While walking it keeps near the cygnet (`follow`, `featherLead`, `featherCatch`) inside the corridor from
  `routeStart` to `goal`; strokes build `encouragement` forward and cannot send it back downhill.
- `fogTopAt(x, z)` is the fog's top surface height, ignoring carved lanes.

**Contact.** Reclining interpolates supported hips; `blanketEdge()` gives the crease the mittens take and
`blanketPull` lifts it as they draw it up. The scarf collides with the posed body and mattress. At the summit
`Cygnet.billGrip`/`billGripWeight` solve contact at the posed bill tip, `flightPose` keeps wings and feet airborne
through the reach, and the bird's grass depth offset fades to zero so the ribbon can occlude the bill.
`pullRibbon` advances only while contact holds; pulling the full `ribbonPull` sets `ribbon.released`, and only then
may `curtains` open (`SleepingIsland` keeps them shut while it is tied). `sleeping-ribbon.ts` draws the knot and
tail. The snow's wind sculpting (`SNOW_SCULPT`) reshapes only depths over 0.2, and `snowDepthAt` repeats it, so
footing and brushing test the surface that is drawn. Winter grass uses a finer tile near the camera on this island
only (`swardDetailFrom`/`To`).

## Adding something that lives in the world

1. Stand it on `heightAt`; if it is small, keep it off walls (`fieldAt`) and out of water.
2. Fade it with `lifeAt`/`life.at` so it belongs to the restored world, not the grey one.
3. Read the wind from the field rather than inventing motion; note any deliberate exception in `wind.md`.
4. Make it dormant when far from the camera, and give it to the rooms that may draw it (`journey-rooms.ts`).
