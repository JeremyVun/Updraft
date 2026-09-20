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

1. During the frame, callers queue splats with `wind.addSplat(splat)`. Each sustained force has a stable `source` identity; `trail: true` means its segment traces movement during this render interval. One-off story gusts set `impulse: true`.
2. `main.ts` sets `wind.breeze` (the prevailing breeze vector, about 2.6 units/s, slowly veering).
3. `wind.step(dt, time)` accumulates elapsed game time and runs fixed 1/60 s ticks (zero on some high-refresh frames, two at 30 fps, up to six at the game's 100 ms stall cap; the lite preset uses the same clock): force (breeze and resampled splats), curl, vorticity confinement, divergence, 24 Jacobi pressure iterations, gradient subtraction, self-advection, then the grass spring and the sway spring.
4. `main.ts` copies the current textures into `atmo.uniforms` after the step. Textures ping-pong, so never keep a texture reference from an earlier frame.
5. After the final world substep of a rendered frame, if any wind tick ran, the field requests a readback of a 128 × 128 copy (`src/gl/readback.ts`), which lands at the next frame's `pollReadbacks()` once the GPU has finished it, without the CPU ever waiting. `wind.sample(x, z, out)` reads that copy bilinearly. It is normally one or two frames behind the GPU; when the GPU is saturated it can fall a few more frames behind (see `docs/engine.md`). It covers the domain that was current when it was requested.

## Splats

`src/wind/clock.ts` retains inputs until their render interval is consumed. It splits movement segments at tick boundaries and combines samples of the same source into one duration-weighted force per tick. Stationary brush segments retain their extent. Impulses are consumed exactly once. GPU force passes batch eight sources at a time without dropping extras; ambient relaxation runs only in the first batch. Pressure/advection/springs still run once per tick.

A splat pushes air along the segment from `(ax, az)` to `(bx, bz)`, with a Gaussian falloff of `radius` world units around it.

- `vx, vz`: push velocity. The splat only adds air along the push direction until the local wind reaches the push speed, plus a 12% blend toward it. A slow stroke never stops a strong wind.
- `energy`: gust energy added per 1/60 s of sustained exposure (or once for an impulse), at full spatial weight on the segment.
- `swirl`: tangential acceleration around the end point `b`, peaking at about 0.7 × radius. It spins the grass and the wind lines.
- `lift`: updraft added per second around `b`.

Writers today: the pointer (`src/input/pointer.ts`: gusts along the stroke, and lift in the middle of circles traced with the cursor: `charge` winds up with how fast the stroke's heading turns, `tuning.pointer.twirlFrom`/`twirlFull`, and runs down when the circling stops. Nothing needs a button press. While a chapter `invitesFlight`, `main.ts` sets `input.anchor` to the cygnet, and circles drawn within `tuning.pointer.anchorNear` screen heights of it stand their column at the bird rather than at the cursor's ground point, which under a low camera is a long ellipse that would put the air anywhere but under it) and the glider's wake when it skims low.

Pointer strokes project both screen endpoints through the current camera, so camera motion cannot generate wind. An idle pointer performs no ground picks; the last gesture's gust settles at its existing world point. A new touch or re-entry starts a fresh stroke without connecting it to the previous contact.

One primary pointer owns a contact until release. Additional fingers or another input device cannot move or
release that stroke. Browser cancellation, lost capture, blur, page suspension and viewport resize discard
pending motion and charge; a cancelled touch needs a fresh pointer-down. Ordinary release retains the soft
decay, and mouse hover still makes wind. `tools/pointer-contact-check.mjs` checks these rules without a GPU;
`tools/touch-viewport-check.mjs` checks real browser touch contacts and viewport/fullscreen resizing.

`tuning.pointer.minGust` and `minLift` are shared with gesture audio. Any input strong enough to write wind
must qualify for its chime response; piano and rescue behavior are defined in `audio.md`.

The cygnet reads `lift` at its own position (plus `tuning.colt.reach` around it) and takes off above `Cygnet.liftToFly` once it has been held there for `liftFor` seconds (`Cygnet.needs`; a flick anywhere else, `tuning.summit` at the end). Gust `energy` under it counts as lift at `tuning.colt.gustLift`, enough to make it hope and open its wings but never to lift it: the updraft is the spiral the wind shows the player (`Coax`, drawn by `fx/swirl.ts`) and the player draws it.

## Deliberate exceptions

These effects bypass the field on purpose. Keep them explicit when changing any of them.

- **Pushing the glider.** The field is pushed where the cursor meets the ground, but the glider flies well above that point. A stroke that passes over the glider on screen pushes it directly (`Glider.brush`), so the player pushes what they see.
- **The updraft funnel for petals.** Petals spiral up an explicit funnel around the middle of the traced circles (`input.updraftAt`) (`Petals.update`, `uUpdraft`: centre, strength, radius). They are drawn in along the ground and spill out at the top. The funnel fades over about 1.5 s after release.
- **Brushing gulls.** Gulls also fly far above the ground point the stroke pushes, so a stroke that passes over a gull on screen shoves it directly (`Gulls.update`, `screenBrush`), and it flaps to recover.
- **Unthreading the birches scarf.** `BirchScarf.brush` tests moving strokes at the active tangle in screen
  space: upward for the fork, sustained circles for the wrapped trunk, rightward for the slipped loop,
  and outward for either bow tail. Circling must build the same `PointerInput.charge` as the cygnet's
  updraft; a straight stroke crossing the centre cannot count as a half-turn. `input.anchor` stands the
  real column at the visible wrap, and the shared `Swirl` invitation demonstrates it. These directed strokes
  accumulate permanent knot progress and deposit wind at the cloth; ambient wind only moves the drape.
  Only the tangle the child has reached can open. The final gathering into the sail is a scripted reward.
  The first length uses `ScarfCloth`: the field accelerates its persistent particles while gravity, cloth
  constraints and collision contact determine where they move. The active upward brush also lifts the
  nearby folds and slides the fork attachments; completing the gesture releases those attachments.
  Authored curves no longer reposition that length after release. The other released lengths use the same
  solver after guided clearance of their supports.

## Invitations

`fx/wind-gesture.ts` draws the shared travelling sweep for washing, sails, embers, toy boats, soap bubbles,
scarf lifts/pulls, the sleeping pillow and the swing. Each gust has a leading strand and two shorter, unequal wakes that curl
apart. Direction changes with the useful gesture; the bow sends matching sweeps outward on both sides.
The wrapped trunk uses `fx/swirl.ts`, like the cygnet: a leading turn followed by detached pieces of rising air.

Hints never write wind, heat or puzzle progress. Local useful input suppresses them; inactivity lets them
return. Large targets place their demonstration on the near surface, where it stays visible.
Sweeps shorten near screen edges so departing air can dissolve inside a portrait frame. Sweep and updraft width is bounded in CSS pixels
at the target depth. Wind ribbons have a minimum light level and a soft cool edge so pale cloth and the
unlit wood both retain contrast; glider and kite ribbons keep their existing material. Piano guidance
keeps its note timing and key path while sharing this readable material. Settings: `tuning.invitation`.

`tools/wind-invitation-check.mjs` captures the game cameras and checks idle gates and fanning handover;
`tools/scarf-check.mjs` checks rejection of straight strokes, circular release, saves and departure.

## Ordinary sailing

At the ordinary 2.6-unit breeze, hull drive is 4.5 units/s, with up to 1 additional unit/s in a following
wind. Player gusts can raise forward speed to the shared 10 units/s ceiling, including dolphin nudges.
The meadow, sea and home crossings use the ordinary breeze rather than route-specific boosts. Turns,
acceleration, landing/mooring and the cygnet's swim can bring speed below the cruise range. Settings:
`tuning.sail`; passage measurements and physical-layout recommendations: [geography](../geography.md).

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

The little-boats room samples local gust energy at the toy hulls. Strokes over a visible sail also write a
local splat through `LittleBoats.brush`, correcting the low camera's projection onto ground behind it.
The stream supplies heading; each toy responds to its own local gust, and nearby gusts also carry the joined fleet. Ambient breeze and distant strokes do
not complete the room. The invitation is drawing only. Feel parameters live in `tuning.littleBoats`.

Toy sails use that same local reading for their hanging folds, gust flutter, belly and boom angle.
Changes in pressure trigger a short luff; quiet air lets the cloth sag again. A damped hull roll and
bounded sideways drift follow the crosswind. Bobbing and surface tilt come from the shared pool ripples.

## Sky mirror: soap bubbles and fallen stars

`SkyMirror.brush` tests pointer segments against the visible soap hoop, bubbles and bubble reflections.
Sweeps grow a film at the hoop. A released bubble takes direction from the current screen stroke projected
locally at its height. Stroke speed sets a bounded target velocity; a fast response handles reversals and
horizontal drag supplies a short coast. This avoids lag from the shared wind's smoothed direction.
Empty bubbles ignore lift, so curled steering strokes
still skim the mirror. A filled bubble uses the existing updraft charge and anchors it at the visible bubble;
if capture happened during a charged stroke, a fresh arc or a settled charge arms lifting. A continuous
circle works without requiring a release. Filled bubbles stop taking horizontal pushes so the circle
does not shove its own target away.
Only a low bubble can collect a fallen light. Sufficient
height releases it into the sky. Invitations only demonstrate gestures and never advance the puzzle.
A sweep over a different fallen light selects it for the paper-led walk only when no live bubble or rising
star is in play. Selection does not carry over into later frames. Neither idle time nor ambient
breeze can make a bubble or restore a star. Water strokes and footsteps still make local rings.

The little-boats farewell adds an outgoing current only after the leading toy reaches the stream mouth
(or for an individual toy already at the mouth). This carries the toys into the sea after play and cannot
advance the earlier interaction. Sails still read actual wind; the current never fabricates sail pressure.

## Sleeping island

After the cygnet's unanswered call, `SleepingChapter.windInvitation` points at the pillow. The existing
screen-space brush feeds `brushDry`/`bedWind`, lifting the blanket and accumulating feather release.
Ambient wind and invitation ribbons cannot release it. The feather's own `brush` remains a direct
screen-space exception like the glider's. During the assisted walk, strokes build forward encouragement
inside the current route corridor. They retain lift and sway without projecting the feather backwards
down a steep hill. Strong correct strokes move it faster than idle guidance.

At the two ascent encounters, `windInvitation` instead points to the loose snow or the fog ahead.
`brushDry` accumulates real screen travel, including during the short noticing action; `snowStroke`/`mistStroke` tune
completion. Progress persists when input pauses, and the opened passage stays clear. Ambient wind and
route wisps do not advance these gates. Bird errands follow the shared grass centreline even when gestures
push the feather sideways. Each waypoint is reached before the next becomes active.

At the summit `invitesFlight` anchors real updrafts at the cygnet. `Chapter.twirlGain` is copied into
`PointerInput` each frame (default 1); this chapter uses `tuning.sleeping.twirlGain` only while inviting
flight, so slower loops can charge the column. The bird still samples real lift and holds it for its
normal takeoff interval. Takeoff starts a reach for the loose ribbon beyond the ledge. The bird's beak
must catch it and complete a physical tug before the knot releases and the curtains can open. The resulting
glide releases the dawn lane toward the bed. There is no timed launch, and blowing on tied curtains alone
cannot solve the chapter. After commitment, further wind steadies the glide while a safe baseline carries
it home if input stops.
