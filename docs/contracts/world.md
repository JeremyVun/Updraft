# The world

How the ground, its life and the things living on it fit together. The wind's own contract is `wind.md`.

## Height

- One function, written twice: `worldHeight(x, z)` in TypeScript and `worldHeight(vec2)` in GLSL, both in `src/world/heightfield.ts`, on the same integer-hashed gradient noise so they agree everywhere (`src/world/parity.ts` measures the difference at load; it is about 0.006 units).
- It covers the whole world: the island around the origin, open sea, and the mainland whose coast runs east to west at `mainlandCoastZ(x)` (about z = −700) with rolling hills inland and a flat pad under the cottage.
- `heightAt(x, z)` (`src/world/island.ts`) reads the window's height bake when the point is inside it and falls back to `worldHeight`, so it is valid everywhere and consistent with what is drawn. Use it for anything that stands on the ground.
- The terrain, grass and sea all read the same 512² height bake inside the window (`src/world/ground.ts`), so nothing floats or sinks.

## The shore beyond the red door

`DOOR_SHORE` in `heightfield.ts` is a separate small island at (240, −460), with the same CPU/GLSL height function.
During the washing chapter each camera sees only its room's land; the rest is sea. The boat stays visible on the
arrival beach until the family reveal, then moves to the destination before the red door at (11, −398) opens.
Its render-room membership follows its position, including in the water reflection. The kite belongs only to
the destination. It has one family clothesline and short grass from
`door-shore.ts`; ordinary grass excludes this patch to avoid drawing two populations. The voyage to the meadow
starts from this shore. Portal rendering and the threshold transfer are described in `docs/engine.md`.

The meadow and birches also retain the arrival boat until the walk approaches their inland crest. Check landing
continuity, boat visibility and departure placement with `node tools/landing-check.mjs`.

## Boats on the shore

`Boat` resolves its rotated hull vertices against terrain on placement and every frame, including while afloat
or pushing off. Checking only the hull centre misses sand under the bow and sides. Near shore it eases its pitch
and roll toward the beach slope; the floorboards rise inside the bow rather than extending below its shell.
Clearance and maximum shore tilt are in `tuning.sail`. `tools/boat-ground-check.mjs` audits berths, launches and
crossings on the CPU; `tools/boat-shores-check.mjs` checks the baked and rendered ground and captures each shore.

## The sea surface and offshore view

`world/water/swell.ts` owns the swell. CPU swimmers and dolphins use `swellLift`; foam, rings, slicks and submerged
dolphin silhouettes use GLSL `seaSurfaceY`, which undoes horizontal wave displacement before finding surface
height. Surface marks have enough vertices to bend over the swell. The boat emits these marks for its wake.

The long crossing exposes `Chapter.openSea` (0–1). `main.ts` eases it into `uOpenSea`; distant fog converges fully
to the same `skyRadiance` used by the backdrop, including clouds, so hidden islands cannot leave tinted outlines.
It releases during the approach to home.

The meadow also uses a coastal veil (`uIslandVeil`, `uIslandVeilAmount`). It leaves the island clear and blends
land, props, sea and reflections into the sky outside its shoreline, hiding neighbouring islands from the piano
through departure. `tuning.world.meadowVeilFrom/To` set its reach relative to `ISLES.meadow`; `main.ts` eases it
away during the next crossing. Other chapters retain ordinary haze.

## The sky mirror

`world/sky-mirror-layout.ts` defines the submerged flat at (−455, −2310), three fallen lights, the outer
boat channel and far pier. `mirrorBed` remains shared CPU/GPU terrain, 0.025 below sea level at its centre.
The entry mooring is offshore at (−515.66, −2271.09); a 16-unit timber jetty reaches the western flat at (−501, −2278).
Its deck permits the shallow step off only at the shore end, preserving the deep-water walking boundary.
The bubble redesign changes no terrain or shared water height. The old causeway overlay is removed.

`water.ts` flattens waves locally and projects the existing reflection, with ring slopes from
`world/sky-mirror.ts`. Resolution rises locally to 0.75 (0.5 in lite mode). Travellers, soap props, bubbles,
carried/restored lights and the pier appear in the same reflection pass. Fallen light marks sit on the
surface itself. `mirror-soap.ts` supplies the transparent film and luminous points; there is no extra
scene render or GPU readback per bubble.

The child registers a temporary walkable pier deck and paper landing-height callback, both removed on
departure. The empty boat travels around the flat through deep water to meet them at the far pier.
Returned lights and the pier stay visible behind the boat until hidden by distance.

## The window

A 320 × 320 square that follows the camera; see `wind.md` for how it moves. Everything baked in window space is re-made when it moves: height, ground (normal and sun visibility), surface (open ground and flower patches), the shoreline distance for the surf, and the life field shifts with it.

## Life

- `src/world/life.ts` keeps a 256² field over the window: 0 grey and still, 1 fully alive. Wind over land raises it, it spreads slowly, and it never falls.
- Two regions extend it beyond the window: the island (a disc that fills in once the island is restored) and the wave (a growing radius, with a soft edge, from wherever the room's colour comes back from). On the meadow that is the piano: the wave starts as the one patch of colour the piano stands in and grows with the lullaby — 45, 85 and 125 units for the first three mirrored sweeps, and the whole island on the fourth, with the wind running ahead of it (`story/meadow.ts`, `WAKING`). The meadow front has a fixed, irregular shape and a soft edge (`world/music-growth.ts`), shared by CPU and shaders so advancing it never removes earned colour. Colour can also be planted on purpose (`LifeField.bloom`: a place, a radius and a rate, for this frame), which takes even inside the waiting island and then grows and spreads like life anywhere; player answers and the final lullaby plant colour where their traces run. Repeated quiet demonstrations do not restore the field.
- The meadow is held asleep until then by `uWaiting`: inside that ellipse wind does not raise life at all, so the island wakes all of a piece and never in blotches under the cursor. The story clears it only after the final wave covers the waiting ellipse, and from then on the wind wakes ground the ordinary way.
- `lifeAt(xz)` in GLSL and `life.at(x, z)` on the CPU (one or two readbacks behind) must agree in spirit: grass, terrain, walls, the tree, petals and creatures all fade between grey and living with it.
- Creatures are absent where life has not come back and appear as it arrives (see below), so the grey world is empty and the restored world is busy.

## Fields and walls

- The mainland is a warped Voronoi patchwork (`src/world/fields.ts`, `FIELD` = 56 units), written in TypeScript and GLSL. `fieldAt` gives the distance to the nearest boundary, a stable random `kind` for the field, whether that boundary carries a wall, and how strongly the patchwork is present (it fades out near the coast).
- **Nothing long and straight lies across the walk without a way through on it.** `WAY` in `fields.ts` is the line the story walks, and no boundary within `GATE` of it carries a wall, so every wall that crosses the route has a gap exactly where the path goes — in the built walls, in the grass tufts and in the line the terrain paints, because all three ask `fieldAt`. The gap widens to a gateway in the first view over the bank above the landing.
- Dry-stone walls (`src/world/walls.ts`) are built from the same function a few tiles per frame near the camera; beyond that the terrain paints them as thin lines. Anything that moves on the ground should respect them: the child hops over them, sheep stay in their field, and the grass grows tufts along them.

## Creatures

- `src/creatures/` holds one instanced draw call per species, posed in the vertex shader, and a `Habitat` (island or mainland) that tells them where they may live: ground height, grass height, meadow and foraging ground, flower patches and perches.
- Every species reads the same `Stimuli` each frame: the wind field, the player's gust and updraft, the camera, the glider, the walking child, the life at a point, the breeze and the time of night. They are dormant beyond `DORMANT_RANGE` from the camera.
- Waking follows the story: rabbits pop up out of the grass, butterflies rise from the flowers and finches fly in where life passes 0.6–0.75; gulls come in off the sea once the breeze returns. Finches only perch in the tree once it has leaves.

## The sleeping island

`src/world/sleeping.ts` (`SleepingIsland`), the room after the dark wood. Its ground is in `heightfield.ts`
(`ISLES.sleeping` at (−175, −1922), `SLEEP_HOLLOW` and `SLEEP_HILL`), its short frosted grass in `grass.ts`
(`sleepFloorAt`), and everything it colours the world with is in `atmosphere.ts`. The story that plays in it
drives it entirely through the numbers below; the room itself owns how they look.

**Places.** `SLEEP_LANDING` (east shore, facing the wood: where the boat runs ashore), `SLEEP_BERTH` (west shore:
where it is drawn up for the crossing home), `BED` with `BED_FACING` (the way its head end points), `PILLOW`,
`HILLTOP` (the top of `SLEEP_HILL`, clear of fog), `SLEEP_APPROACH` (the side path), `SLEEP_LEDGE`
(the safe launch footing), `CURTAIN_KNOT` and `CURTAIN_END` (beyond the exposed lip), `LAMP`, `WINDOW` with
`WINDOW_INTO` (the way the light comes through it down toward the bed), and `bedside` (where the child stands).

**Driven values**, all 0..1, all eased inside the module (`tuning.sleeping.ease`) so a chapter setting one never
pops. Defaults in brackets.

| value | 0 | 1 |
| --- | --- | --- |
| `fog` [1] | no fog at all | the night's full pooling around the terrace |
| `frost` [0] | bare grass | frost hard in from the rim right up to the bed |
| `dawn` [0] | night | the first sun down the whole hill, the fog burnt back, the lamp overtaken |
| `curtains` [0] | drawn | thrown open, gathered at the sides, with the light coming through |
| `blanket` [0] | tucked in | folded back off the bed |
| `sleeper` [0] | an empty bed | a child asleep under the blanket: it stands over them and rises and falls with their breathing |

`fogTop` is not 0..1 but a height in world units (default `tuning.sleeping.fogTop`): how high the fog's top surface
lies. The story raises it to `fogClimbs` as the night thickens, so a bird climbing the hill walks up into the fog
and out of it again near the top, and the lanes the player carves are the only clear air in it. The pool thins
with distance from the hollow long before the summit, so the hilltop stands out of the fog however high it is.

The chapter still drives `dusk`. After `applyPalette`, `applySleepingPalette(sleeping.presence)` blends
in the local winter palette using the module's eased `uDawn.x`: slate night, lavender first light,
golden morning beneath a pearl-blue sky. `morningAt` follows the opened lane, then spreads green
across the island; terrain and blade albedo read the same field. Presence fades offshore; an explicit `dusk` override bypasses this palette.
The module also lifts the blanket under gusts over the bed or the chapter's screen-space `bedWind` (0..1), then settles it back. `bedWind` is refreshed while asleep and cleared on feather release.

**What they drive.** `uHollow` (where the fog pools, how far it reaches, how thick) and `uHollowTop` feed
`hollowDensity`, whose drifting, uneven height boundary `fogOf` samples along the eye ray, so the pooled fog is in every shader at no extra cost to
any other room: at `fog` 0 with the camera 300 units away the whole of it is one comparison. `uFrost` is read by
`frostAt` (the terrain, the grass blades, the bed and the rug). `uLamp` is read by `lampLight`.
`dawnLight` uses `uDawnSource` (window xyz, eased curtain opening) and the advancing lane; broad fill
arrives late in `uDawn.x`. Grass receives this as light, independently of the dim night ambient.
Near-camera fog extinction eases in over `fogNear`–`fogFar`, preserving distant concealment.
The lamp shade's emission fades with the lamp as dawn arrives.

**Calls.**
- `carve(x, z, dirX, dirZ, strength)` stamps a lane of clear air into the fog; `strength` is how much fog one
  call takes out (1 clears it), so a caller working per frame scales it by `dt`. The room already calls it every
  frame from the player's own stroke (`input.world`, `input.gust`), so blowing across the hollow opens a lane
  that closes again over `tuning.sleeping.carveCloses` seconds. It is a 128² field over the island
  (`uCarveTex`/`uCarveDomain`) decayed back toward 1, read by the pooled eye-ray fog. There are no horizontal fog meshes.
- `lane(from, to, halfWidth)` and `laneOpen` (0..1) set `uLane`/`uLaneOpen`: one widening lane down the hill,
  clear of fog and of frost as far as it has opened, for the morning to come down.
- `pillowPuff()` releases a few dozen pieces of down from the pillow, which hang and then go where the wind goes.
- `feather` is the room's one long white feather (`src/fx/feather.ts`), which comes out of the pillow with that
  down and is the whole of this room's control. `release(from, drift)` puts it in the air; it then takes the air's
  own speed rather than being pushed along by it, hangs about `featherHangs` off the grass, and leans toward
  `goal` so it can never be lost and never has to be fetched — the paper plane's idea, slower and floatier. A
  stroke that crosses it on screen carries it directly (`brush`), as one that crosses the plane does.
  While walking, `follow` references the cygnet position; `featherLead`/`featherCatch` softly limit the
  guide's lead. `routeStart` and `goal` define the current walking corridor. During that guided walk,
  screen strokes build `encouragement`; forward speed responds while lateral drift remains bounded.
  World-projected swipes cannot reverse it down the hill. Final ground contact is sampled after movement.
- `fogTopAt(x, z)` is the height of the fog's top surface, so a bird climbing the hill can be told when it is
  out of it. It ignores what has been carved: it answers for the fog as a whole, not for the hole you just made.

**Story and contact.** The child takes roughly 26 seconds to pause, place the bird, sit, drowse, recline,
pull up the quilt and settle. `Traveller.sleepiness` and `yawn` default to zero; yawns are silent. Reclining
interpolates supported hips, and `blanketEdge()` exposes the cloth crease for the mitten targets.
`blanketPull` lifts that crease while the hands draw it up. The folded end is the head end of the bed. The quilt covers the flattened coat; legs settle along the
mattress, and the scarf uses the posed body and mattress for collision. Scarf shading receives the lamp
and dawn alongside the coat.

The pillow releases after the unanswered call, a view of the warm seam and real brushing. The side path
ends at `SLEEP_LEDGE`, where the bird studies the unreachable ribbon and releases its healed wing.
`twirlGain` only assists circles during `hilltop`; real lift starts `reachRibbon`, not the return glide.
`Cygnet.billGrip`/`billGripWeight` solve contact at the posed bill tip. `flightPose` keeps the wings and feet
in an airborne pose through the reach. The creature's grass depth offset fades to zero so the ribbon can correctly occlude the bill. `pullRibbon` advances only while contact is maintained. Pulling the loose
end the full `ribbonPull` distance sets `ribbon.released`; only then may `curtains` open. `SleepingIsland`
enforces closed curtains while the ribbon is tied. `sleeping-ribbon.ts` draws the shrinking knot and tail.

The released knot starts one continued glide, counted as the same flight as takeoff. Light advances from
`WINDOW` to `BED` through `laneOpen`. Wind adds support to the safe return; no crash/retry follows commitment.
The camera retains the window for `windowRevealFor` before following the bird. Both `feather` and `morning`
checkpoint names retain their schema; morning restoration also releases the ribbon. The exposed lip and
bed terrace are mirrored in CPU/GLSL terrain and explicitly sampled by the height parity check.

`tools/sleeping-logic-check.mjs` checks progression, idle gates, physical contact, terrace/drop and assisted
versus idle feather travel. `tools/sleeping-check.mjs` checks real mouse/touch gestures, portrait/landscape
framing, bedtime, beak grip, opening, dawn and boarding. `SUMMIT=1` isolates the ledge for visual iteration;
that staged mode is not a full playthrough. `tools/wing-care-check.mjs` retains the healing and one-flight gates.

Winter grass uses a finer tile only within `swardDetailTo` of the camera on this island; the extra
density fades between `swardDetailFrom` and `swardDetailTo`. The sparse phone tier reserves at most
96 fine tiles. The table and direct blade paths use the same density function; other islands keep
their existing density and tile selection.

## Adding something that lives in the world

1. Stand it on `heightAt`, and if it is small, keep it out of walls (`fieldAt`) and off water.
2. Fade it with `lifeAt`/`life.at` so it belongs to the restored world, not the grey one.
3. Read the wind from the field rather than inventing motion; note any deliberate exception in `wind.md`.
4. Make it dormant when it is far from the camera, and check the frame rate at `ratio=2`.


## The island of little boats

`little-boats-layout.ts` supplies the stream centre, width and level to the heightfield, water, toy fleet and
bank walkers. CPU and GLSL use the same three pool shapes. The water sits above sea level, then shelves down
to the departure beach. The sea mesh itself rises into the channel; there is no overlapping pool plane.
`boatsWaterHeight` supplies the mean level and matching sheltered ripples to toys and swimmers. The shared
sea material uses that level for depth, fades out ocean surf in the pools and restores it at the outlet.
Grass excludes the wet bowls on CPU
and GPU and stays short on the banks. Height parity QA includes samples in the stream and on its margins.
The arrival boat remains on its beach until the first pool is behind the camera, then waits at the far shore.

The first toy stays on its bank clearing until picked up. During handling, `LittleBoats.afterChildPose`
runs after the child and companion carry update and attaches the hull to the two actual mittens. Releasing
stores that exact transform, then eases it onto the stream surface. Checkpoint restore clears handling.

`boatsCourse` continues the toy route beyond the stream into a rightward ocean turn. The toy fleet retains
its own departure update after the chapter ends, until every toy has left view. Chapter progress and camera
focus stop at the mouth; they do not follow the departing toys offshore. Sea swell replaces sheltered
ripples gradually as the water deepens.
