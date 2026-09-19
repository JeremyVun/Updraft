# The world

How the ground, its life and the things living on it fit together. The wind's own contract is `wind.md`.

## Height

- One function, written twice: `worldHeight(x, z)` in TypeScript and `worldHeight(vec2)` in GLSL, both in `src/world/heightfield.ts`, on the same integer-hashed gradient noise so they agree everywhere (`src/world/parity.ts` measures the difference at load; it is about 0.006 units).
- It covers the whole world: the island around the origin, open sea, and the mainland whose coast runs east to west at `mainlandCoastZ(x)` (about z = −700) with rolling hills inland and a flat pad under the cottage.
- `heightAt(x, z)` (`src/world/island.ts`) reads the window's height bake when the point is inside it and falls back to `worldHeight`, so it is valid everywhere and consistent with what is drawn. Use it for anything that stands on the ground.
- The terrain, grass and sea all read the same 512² height bake inside the window (`src/world/ground.ts`), so nothing floats or sinks.

## The window

A 320 × 320 square that follows the camera; see `wind.md` for how it moves. Everything baked in window space is re-made when it moves: height, ground (normal and sun visibility), surface (open ground and flower patches), the shoreline distance for the surf, and the life field shifts with it.

## Life

- `src/world/life.ts` keeps a 256² field over the window: 0 grey and still, 1 fully alive. Wind over land raises it, it spreads slowly, and it never falls.
- Two regions extend it beyond the window: the island (a disc that fills in once the island is restored) and the wave (a growing radius, with a soft edge, from wherever the room's colour comes back from). On the meadow that is the piano: the wave starts as the one patch of colour the piano stands in and grows with the lullaby — a few dozen units for the first phrase, out over the crest for the second, and the whole island on the last, with the wind running ahead of it (`story/meadow.ts`, `WAKING`).
- The meadow is held asleep until then by `uWaiting`: inside that ellipse wind does not raise life at all, so the island wakes all of a piece and never in blotches under the cursor. The story clears it when the wave is let go, and from then on the wind wakes ground the ordinary way.
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
`HILLTOP` (the top of `SLEEP_HILL`, well clear of the fog), `LAMP` (the bedside bulb), `WINDOW` with
`WINDOW_INTO` (the way the light comes through it toward the pillow), and `bedside` (where the child stands).

**Driven values**, all 0..1, all eased inside the module (`tuning.sleeping.ease`) so a chapter setting one never
pops. Defaults in brackets.

| value | 0 | 1 |
| --- | --- | --- |
| `fog` [1] | no fog at all | the night's full pooling in the hollow |
| `frost` [0] | bare grass | frost hard in from the rim right up to the bed |
| `dawn` [0] | night | the first sun down the whole hill, the fog burnt back, the lamp overtaken |
| `curtains` [0] | drawn | thrown open, gathered at the sides, with the light coming through |
| `blanket` [0] | tucked in | folded back off the bed |

The sky's own warming is not here: that is the chapter's `dusk`, eased in `main.ts` like every other room's.
The module also lifts the blanket a little by itself under any real gust over the bed and settles it back.

**What they drive.** `uHollow` (where the fog pools, how far it reaches, how thick) and `uHollowTop` feed
`hollowDensity`, which `fogOf` takes along the eye ray, so the pooled fog is in every shader at no extra cost to
any other room: at `fog` 0 with the camera 300 units away the whole of it is one comparison. `uFrost` is read by
`frostAt` (the terrain, the grass blades, the bed and the rug). `uLamp` is read by `lampLight` and `uDawn` by
`dawnLight`, which lights the hilltop first and comes down the hill as `dawn` rises, and lights the lane
wherever it is open.

**Calls.**
- `carve(x, z, dirX, dirZ, strength)` stamps a lane of clear air into the fog; `strength` is how much fog one
  call takes out (1 clears it), so a caller working per frame scales it by `dt`. The room already calls it every
  frame from the player's own stroke (`input.world`, `input.gust`), so blowing across the hollow opens a lane
  that closes again over `tuning.sleeping.carveCloses` seconds. It is a 128² field over the island
  (`uCarveTex`/`uCarveDomain`) decayed back toward 1, read by the pooled fog and by the fog's top sheets.
- `lane(from, to, halfWidth)` and `laneOpen` (0..1) set `uLane`/`uLaneOpen`: one widening lane down the hill,
  clear of fog and of frost as far as it has opened, for the morning to come down.
- `pillowPuff()` releases a few dozen pieces of down from the pillow, which hang and then go where the wind
  goes. The story's one long white feather belongs beside it (see the note in the constructor).
- `fogTopAt(x, z)` is the height of the fog's top surface, so a bird climbing the hill can be told when it is
  out of it. It ignores what has been carved: it answers for the fog as a whole, not for the hole you just made.

**What the story parcel is expected to drive:** `frost` up through the night and back down with `dawn`; `fog`
through the climb; `blanket` for the gust that is answered and refused; `pillowPuff()` and its feather;
`lane(HILLTOP, BED, ...)` with `laneOpen` run from 0 to 1 as the bird glides down it; `curtains` thrown open at
the end; `dawn` to 1. Nothing in the room decides any of that for itself.

## Adding something that lives in the world

1. Stand it on `heightAt`, and if it is small, keep it out of walls (`fieldAt`) and off water.
2. Fade it with `lifeAt`/`life.at` so it belongs to the restored world, not the grey one.
3. Read the wind from the field rather than inventing motion; note any deliberate exception in `wind.md`.
4. Make it dormant when it is far from the camera, and check the frame rate at `ratio=2`.
