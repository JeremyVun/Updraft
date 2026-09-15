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
- Two regions extend it beyond the window: the island (a disc that fills in once the island is restored) and the mainland's green wave (a growing radius from where the player's first gust inland landed).
- `lifeAt(xz)` in GLSL and `life.at(x, z)` on the CPU (one or two readbacks behind) must agree in spirit: grass, terrain, walls, the tree, petals and creatures all fade between grey and living with it.
- Creatures are absent where life has not come back and appear as it arrives (see below), so the grey world is empty and the restored world is busy.

## Fields and walls

- The mainland is a warped Voronoi patchwork (`src/world/fields.ts`, `FIELD` = 56 units), written in TypeScript and GLSL. `fieldAt` gives the distance to the nearest boundary, a stable random `kind` for the field, whether that boundary carries a wall, and how strongly the patchwork is present (it fades out near the coast).
- Dry-stone walls (`src/world/walls.ts`) are built from the same function a few tiles per frame near the camera; beyond that the terrain paints them as thin lines. Anything that moves on the ground should respect them: the child hops over them, sheep stay in their field, and the grass grows tufts along them.

## Creatures

- `src/creatures/` holds one instanced draw call per species, posed in the vertex shader, and a `Habitat` (island or mainland) that tells them where they may live: ground height, grass height, meadow and foraging ground, flower patches and perches.
- Every species reads the same `Stimuli` each frame: the wind field, the player's gust and updraft, the camera, the glider, the walking child, the life at a point, the breeze and the time of night. They are dormant beyond `DORMANT_RANGE` from the camera.
- Waking follows the story: rabbits pop up out of the grass, butterflies rise from the flowers and finches fly in where life passes 0.6–0.75; gulls come in off the sea once the breeze returns. Finches only perch in the tree once it has leaves.

## Adding something that lives in the world

1. Stand it on `heightAt`, and if it is small, keep it out of walls (`fieldAt`) and off water.
2. Fade it with `lifeAt`/`life.at` so it belongs to the restored world, not the grey one.
3. Read the wind from the field rather than inventing motion; note any deliberate exception in `wind.md`.
4. Make it dormant when it is far from the camera, and check the frame rate at `ratio=2`.
