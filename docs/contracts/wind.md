# Wind field

The single source of air motion. Grass, petals, wind lines, the glider, the sea and the tree read it; only splats and the ambient breeze write it. Code: `src/wind/field.ts`, `src/wind/shaders.ts`.

## Domain: the moving window

- A 320 × 320 square of the XZ plane that follows the camera (`src/world/window.ts`). `followWindow` recentres it on a point about 100 units ahead of the camera once that point drifts 30 units, snapping to 10-unit steps so every window texture shifts by whole texels. Listeners registered with `onWindowMove` shift or re-bake their window-space data (the wind and grass-lean textures, life, the height, ground and surface bakes).
- GPU grid 256 × 256 (1.25 world units per cell). UV maps as `uv = (xz - WINDOW.min) / WINDOW.size` (`domainUv` in GLSL, `atmo.uniforms.uDomain`); texture v is world z.
- Cells that enter the window on a move start at the ambient breeze (`uOutside` in the shift pass). Shaders check `insideUv` before reading window textures, and `wind.sample` clamps to the window's edge. `heightAt` falls back to the analytic `worldHeight` (`src/world/heightfield.ts`), so heights are valid everywhere.

## Velocity texture (`wind.texture`, shared as `atmo.uniforms.uWindTex`)

RGBA half float, linear filtering.

| channel | meaning | range | life |
|---|---|---|---|
| r, g | air velocity along world x and z, in world units per second | about ±60 (clamped) | relaxes toward the ambient breeze at 0.32/s, dissipates 12%/s |
| b | gust energy: how recently the player gusted here | 0 to 1.6 | decays 1.1/s, advected with the air |
| a | updraft: rising air | 0 to 2.5 | decays 0.8/s, advected with the air |

Gust energy and updraft exist because the 2D field is incompressible: it cannot hold rising air, so vertical effects are carried as scalars that consumers turn into lift.

## Grass lean texture (`wind.bendTexture`, shared as `uBendTex`)

RGBA half float on the same grid. `xy` is the lean vector of the grass (direction on the ground, magnitude in radians, up to about 1.3). `zw` is its rate of change. It is a damped spring (stiffness 38, damping 3.2) driven toward a lean set by wind speed, so gusts overshoot and settle.

## Frame order

1. During the frame, callers queue splats with `wind.addSplat(splat)`. At most 8 per frame; extra ones are dropped.
2. `main.ts` sets `wind.breeze` (the prevailing breeze vector, about 2.6 units/s, slowly veering).
3. `wind.step(dt, time)` runs 1 or 2 substeps of 1/60 s (never more: a slow frame must not multiply the sim's cost, so under heavy load the wind runs slower than real time): force (breeze and splats; splats only in the first substep), curl, vorticity confinement, divergence, 24 Jacobi pressure iterations, gradient subtraction, self-advection, then the grass spring.
4. `main.ts` copies the current textures into `atmo.uniforms` after the step. Textures ping-pong, so never keep a texture reference from an earlier frame.
5. The step ends by requesting a readback of a 128 × 128 copy (`src/gl/readback.ts`), which lands at the next frame's `pollReadbacks()` once the GPU has finished it, without the CPU ever waiting. `wind.sample(x, z, out)` reads that copy bilinearly. It is normally one or two frames behind the GPU; when the GPU is saturated it can fall a few more frames behind (see `docs/engine.md`). It covers the domain that was current when it was requested.

## Splats

A splat pushes air along the segment from `(ax, az)` to `(bx, bz)`, with a Gaussian falloff of `radius` world units around it.

- `vx, vz`: push velocity. The splat only adds air along the push direction until the local wind reaches the push speed, plus a 12% blend toward it. A slow stroke never stops a strong wind.
- `energy`: gust energy added at full weight on the segment.
- `swirl`: tangential acceleration around the end point `b`, peaking at about 0.7 × radius. It spins the grass and the wind lines.
- `lift`: updraft added per second around `b`.

Writers today: the pointer (`src/input/pointer.ts`: gusts along the stroke, and lift in the middle of circles traced with the cursor: `charge` winds up with how fast the stroke's heading turns, `tuning.pointer.twirlFrom`/`twirlFull`, and runs down when the circling stops. Nothing needs a button press) and the glider's wake when it skims low.

## Deliberate exceptions

These effects bypass the field on purpose. Keep them explicit when changing any of them.

- **Pushing the glider.** The field is pushed where the cursor meets the ground, but the glider flies well above that point. A stroke that passes over the glider on screen pushes it directly (`Glider.brush`), so the player pushes what they see.
- **The updraft funnel for petals.** Petals spiral up an explicit funnel around the middle of the traced circles (`input.updraftAt`) (`Petals.update`, `uUpdraft`: centre, strength, radius). They are drawn in along the ground and spill out at the top. The funnel fades over about 1.5 s after release.
- **Brushing gulls.** Gulls also fly far above the ground point the stroke pushes, so a stroke that passes over a gull on screen shoves it directly (`Gulls.update`, `screenBrush`), and it flaps to recover.
