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

## Sway texture (`wind.swayTexture`, shared as `uSwayTex`; GLSL `swayAt(xz)`)

RGBA half float on the same grid. `xy` is the wind a hanging thing feels, on a soft spring (`tuning.wind.swayStiffness` / `swayDamping`), in world units per second; `zw` is its rate of change. Cloth, sails, kites, pinwheels and leaves on their twigs swing on this and not on the raw velocity. The grass does not read it.

Why it exists: the field is incompressible, so a stroke moves air a long way off in the same frame (measured: 10 units per second 15 units UPWIND of a stroke within 10 frames), and everything hung in it jumped at once, like paint under a brush. The gust itself travels: gust energy (`b`) is laid down only under the stroke and carried downwind at the air's own speed, reaching 20 units downwind about a second later. So the felt wind (`feltWind` in GLSL and in `wind/field.ts`) takes air with no gust energy in it only up to a soft ceiling of `tuning.wind.calm` times the prevailing breeze (dead air is dead), and the full velocity once energy has risen from `arriveFrom` to `arriveFull`. Story gusts that should be felt must carry energy in their splats.

On the CPU, sample the wind, pass it through `feltWind(sample, wind.calm)`, and keep a `Sway` (same spring) for the thing that swings. `?debug=sway` draws the texture.

## Frame order

1. During the frame, callers queue splats with `wind.addSplat(splat)`. At most 8 per frame; extra ones are dropped.
2. `main.ts` sets `wind.breeze` (the prevailing breeze vector, about 2.6 units/s, slowly veering).
3. `wind.step(dt, time)` runs 1 or 2 substeps of 1/60 s (never more: a slow frame must not multiply the sim's cost, so under heavy load the wind runs slower than real time): force (breeze and splats; splats only in the first substep), curl, vorticity confinement, divergence, 24 Jacobi pressure iterations, gradient subtraction, self-advection, then the grass spring and the sway spring.
4. `main.ts` copies the current textures into `atmo.uniforms` after the step. Textures ping-pong, so never keep a texture reference from an earlier frame.
5. The step ends by requesting a readback of a 128 × 128 copy (`src/gl/readback.ts`), which lands at the next frame's `pollReadbacks()` once the GPU has finished it, without the CPU ever waiting. `wind.sample(x, z, out)` reads that copy bilinearly. It is normally one or two frames behind the GPU; when the GPU is saturated it can fall a few more frames behind (see `docs/engine.md`). It covers the domain that was current when it was requested.

## Splats

A splat pushes air along the segment from `(ax, az)` to `(bx, bz)`, with a Gaussian falloff of `radius` world units around it.

- `vx, vz`: push velocity. The splat only adds air along the push direction until the local wind reaches the push speed, plus a 12% blend toward it. A slow stroke never stops a strong wind.
- `energy`: gust energy added at full weight on the segment.
- `swirl`: tangential acceleration around the end point `b`, peaking at about 0.7 × radius. It spins the grass and the wind lines.
- `lift`: updraft added per second around `b`.

Writers today: the pointer (`src/input/pointer.ts`: gusts along the stroke, and lift in the middle of circles traced with the cursor: `charge` winds up with how fast the stroke's heading turns, `tuning.pointer.twirlFrom`/`twirlFull`, and runs down when the circling stops. Nothing needs a button press. While a chapter `invitesFlight`, `main.ts` sets `input.anchor` to the cygnet, and circles drawn within `tuning.pointer.anchorNear` screen heights of it stand their column at the bird rather than at the cursor's ground point, which under a low camera is a long ellipse that would put the air anywhere but under it) and the glider's wake when it skims low.

Pointer strokes project both screen endpoints through the current camera, so camera motion cannot generate wind. An idle pointer performs no ground picks; the last gesture's gust settles at its existing world point. A new touch or re-entry starts a fresh stroke without connecting it to the previous contact.

The cygnet reads `lift` at its own position (plus `tuning.colt.reach` around it) and takes off above `Cygnet.liftToFly` once it has been held there for `liftFor` seconds (`Cygnet.needs`; a flick anywhere else, `tuning.summit` at the end). Gust `energy` under it counts as lift at `tuning.colt.gustLift`, enough to make it hope and open its wings but never to lift it: the updraft is the spiral the wind shows the player (`Coax`, drawn by `fx/swirl.ts`) and the player draws it.

## Deliberate exceptions

These effects bypass the field on purpose. Keep them explicit when changing any of them.

- **Pushing the glider.** The field is pushed where the cursor meets the ground, but the glider flies well above that point. A stroke that passes over the glider on screen pushes it directly (`Glider.brush`), so the player pushes what they see.
- **The updraft funnel for petals.** Petals spiral up an explicit funnel around the middle of the traced circles (`input.updraftAt`) (`Petals.update`, `uUpdraft`: centre, strength, radius). They are drawn in along the ground and spill out at the top. The funnel fades over about 1.5 s after release.
- **Brushing gulls.** Gulls also fly far above the ground point the stroke pushes, so a stroke that passes over a gull on screen shoves it directly (`Gulls.update`, `screenBrush`), and it flaps to recover.
- **Unthreading the birches scarf.** `BirchScarf.brush` tests moving strokes at the active tangle in screen
  space: upward for the fork, horizontal for the trunk and outward for the bow. These directed strokes
  accumulate permanent knot progress and deposit wind at the cloth; ambient wind only moves the drape.
  Only the tangle the child has reached can open. The final gathering into the sail is a scripted reward.

## Storm passage

The drowned village caps hull drive with `Boat.speedLimit` while leaving the sail exposed. Storm pressure
(`squallPress`) mostly spills (`squallHolds`); `squallLuff` shakes the cloth without multiplying the boat's speed.
Tight turns also ease the drive. Leeway is bounded in a capped passage and attenuated close to the final mooring. These do not change the wind
field. The passage cap is reapplied after checkpoint placement and reset on other crossings or a new berth.

Rain's storm slant is an explicit weather effect: it adds `tuning.storm.rainLean` along the prevailing breeze,
without writing a gust into the field. Lightning and delayed thunder are driven by `StormWeather` after the
palette is set; shared ambient light and the sky's `uLightning` illuminate the world together. They do not light
the embers or let the child bypass the forest's light mechanic. Storm cover also veils the moon and closes the
view to 62 paces; flashes briefly thin that veil. `LighthouseLight` drives `uHarbourLight` and
`uHarbourDirection`, shared by the beam, boat, creature and water shaders. Its clock begins with the storm,
fades out at nineteen seconds, and resets in calm weather. It is independent of `uEmberLight`.

## Opening cove shelter

`Boat.shelter` (0 exposed, 1 sheltered) attenuates prevailing wind and weather in both `sailWind.blowing` and
`sailWind.taken`. Local gusts remain effective. The first island sets shelter to 1; once afloat it decays at
`tuning.opening.departureRate`. A new berth resets shelter; restoring the opening companion checkpoint reinstates it. Its deeper hanging folds ease out with the same value. This is separate from
`becalmed`, which spills the weather's drive while allowing the cloth to keep moving.

During the opening push-off, `IslandChapter` writes a short, low-energy travelling splat across the cove. It
uses the regular wind field, so grass and sail feel its arrival through their existing springs.

## Washing passages

`world/lines-passage.ts` samples local felt wind across each curtain. Gust energy and speed together accumulate
its opening; ambient wind alone cannot solve it. Broad sweeps in either direction work. `WashingCurtain.brush`
projects points on the active sheet into the camera, then deposits a splat **at the sheet** when a moving pointer
passes over it. This corrects the low camera's ground projection behind the hanging cloth. It writes the same
field used by nearby grass and washing; it never increments puzzle progress directly. Only the waiting curtain
receives this screen targeting. There is no timed assistance: the first sheet instead shows sideways invitation
traces (`fx/washing-invitation.ts`) that draw without writing wind or progress. Real sweeps accumulate without
losing progress, and the invitation fades while those sweeps are arriving.

Completed curtains hold their opening as story state so they cannot fall onto either traveller. The family
reveal after the last passage is a scripted reward, with a matching breeze in the field; its garment and door
animation asks for no further hidden gesture. The plane remains held throughout the passages.
