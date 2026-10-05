# Wind field

The single source of air motion. Grass, petals, wind lines, the glider, the sea, cloth and trees read it; only
splats and the ambient breeze write it. Code: `src/wind/field.ts`, `src/wind/shaders.ts`, `src/wind/clock.ts`.
Numbers below are the defaults in `tuning.wind`.

## Domain: the moving window

- A 320 × 320 square of the XZ plane that follows the camera (`src/world/window.ts`). `followWindow` recentres it
  on a point about 100 units ahead of the camera once that point drifts 30 units, snapping to 10-unit steps so
  every window texture shifts by whole texels. Listeners registered with `onWindowMove` shift or re-bake their
  window-space data (the wind and grass-lean textures, life, the height, ground and surface bakes). On a move the
  field rebinds `uWindTex`, `uBendTex` and `uSwayTex`, so no shader reads a shifted texture against the old window.
- GPU grid 256 × 256 (1.25 world units per cell; 128 with 12 pressure iterations under `?lite`). UV maps as
  `uv = (xz - WINDOW.min) / WINDOW.size` (`domainUv` in GLSL, `atmo.uniforms.uDomain`); texture v is world z.
- Cells entering the window start at the ambient breeze (`uOutside` in the shift pass). Shaders check `insideUv`
  before reading window textures, `wind.sample` clamps to the window's edge, and `heightAt` falls back to the
  analytic `worldHeight`, so heights are valid everywhere.

## Velocity texture (`wind.texture`, shared as `atmo.uniforms.uWindTex`)

RGBA half float, linear filtering.

| channel | meaning | range | life |
|---|---|---|---|
| r, g | air velocity along world x and z, units per second | about ±60 (clamped) | relaxes toward the breeze at `relax`, loses `dissipation` a second |
| b | gust energy: how recently the player gusted here | 0 to 1.6 | decays at `energyDecay`, advected with the air |
| a | updraft: rising air | 0 to 2.5 | decays at `liftDecay`, advected with the air |

Gust energy and updraft exist because the 2D field is incompressible: it cannot hold rising air, so vertical
effects are carried as scalars that consumers turn into lift.

## Grass lean texture (`wind.bendTexture`, shared as `uBendTex`)

RGBA half float on the same grid. `xy` is the grass's lean vector (direction on the ground, magnitude in radians,
up to about 1.3); `zw` its rate of change. A damped spring (`grassStiffness`, `grassDamping`) driven toward a lean
set by wind speed, so gusts overshoot and settle. The grass's look and feel is loved: changes elsewhere must not
touch what it reads.

## Sway texture (`wind.swayTexture`, shared as `uSwayTex`; GLSL `swayAt(xz)`)

RGBA half float on the same grid. `xy` is the wind a hanging thing feels, on a soft spring (`swayStiffness`,
`swayDamping`); `zw` its rate of change. Cloth, sails, kites, pinwheels and leaves on their twigs swing on this,
never on the raw velocity. The grass does not read it.

Why: the field is incompressible, so a stroke moves air a long way off in the same frame, upwind included, and
anything hung in raw velocity jumps at once, like paint under a brush. The gust itself travels: gust energy is laid
down only under the stroke and carried downwind at the air's speed. So the **felt wind** (`feltWind` in GLSL and in
`wind/field.ts`) takes air with no gust energy in it only up to a soft ceiling of `calm` times the prevailing
breeze (dead air is dead), and the full velocity once energy has risen from `arriveFrom` to `arriveFull`. Hanging
things take a gust a beat late, overshoot and swing back. Story gusts that should be felt must carry energy in
their splats.

On the CPU, sample the wind, pass it through `feltWind(sample, wind.calm)`, and keep a `Sway` (same spring) for
the thing that swings. `?debug=sway` draws the texture; `?debug=wind` draws the field.

## Frame order

1. During the frame, callers queue splats with `wind.addSplat(splat)`. Each sustained force has a stable `source`
   identity; `trail: true` means its segment traces movement during this render interval. One-off story gusts set
   `impulse: true`.
2. `main.ts` sets `wind.breeze` (the prevailing breeze vector, `tuning.wind.breeze` scaled by the chapter, slowly
   veering).
3. `wind.step(dt, time)` accumulates game time and runs fixed 1/60 s ticks (none on some high-refresh frames, two
   at 30 fps, up to six at the 100 ms stall cap): force (breeze and resampled splats), curl, vorticity confinement
   (`swirliness`), divergence, 24 Jacobi pressure iterations, gradient subtraction, self-advection, then the grass
   and sway springs.
4. `main.ts` copies the current textures into `atmo.uniforms` after the step. Textures ping-pong: never keep a
   texture reference from an earlier frame.
5. After the last world substep of a rendered frame, if any tick ran, the field requests a readback of a 128 × 128
   copy (`src/gl/readback.ts`), which lands at a later frame's `pollReadbacks()` without the CPU waiting.
   `wind.sample(x, z, out)` reads it bilinearly. It is normally one or two frames behind the GPU, more when the GPU
   is saturated (`docs/engine.md`), and covers the domain current when it was requested.

## Splats

`src/wind/clock.ts` keeps inputs until their render interval is consumed, splits movement segments at tick
boundaries and combines samples of one source into one duration-weighted force per tick. Stationary brush
segments keep their extent; impulses are consumed exactly once. Splats are copied as they arrive, so a producer
may reuse one object; the inputs handed to each tick are pooled and valid until the next `step`. GPU force passes
batch eight sources at a time without dropping any.

A splat pushes air along the segment from `(ax, az)` to `(bx, bz)`, with a Gaussian falloff of `radius` units.

- `vx, vz`: push velocity. It only adds air along the push until the local wind reaches the push speed, plus a 12%
  blend toward it, so a slow stroke never stops a strong wind.
- `energy`: gust energy added per 1/60 s of exposure (or once for an impulse), at full weight on the segment.
- `swirl`: tangential acceleration around `b`, peaking at about 0.7 × radius. It spins grass and wind lines.
- `lift`: updraft added per second around `b`.

## The pointer

`src/input/pointer.ts` writes gusts along the stroke, and lift in the middle of circles: `charge` winds up with
how fast the stroke's heading turns (`tuning.pointer.twirlFrom`/`twirlFull`) and runs down when the circling stops.
Nothing needs a button press; holding still charges nothing. `Chapter.twirlGain` is copied into the pointer each
frame (default 1). The glider's wake also writes when it skims low.

- **Where the column stands.** Under a low camera the cursor's ground point is a long ellipse off any target, so a
  chapter can anchor the updraft: while a chapter `invitesFlight`, `main.ts` sets `input.anchor` to the cygnet, and
  the wood (the waiting coal), the birches (the wrapped trunk) and the sky mirror (a filled bubble) do the same.
  Circles drawn within `tuning.pointer.anchorNear` screen heights of the anchor stand the column there.
- **Camera motion makes no wind.** Strokes project both screen endpoints through the current camera. An idle
  pointer makes no ground picks; the last gesture's gust settles at its world point. Picks march the ray 2 m at a
  time to 700 m, skipping the height lookup where the ray is above every hill or over open water clear of every
  room (`tools/pointer-pick-check.mjs` guards that this matches the plain march).
- **Touch.** A touch stroke starts where the finger landed, so its first movement is wind, and after lifting its
  last segment is kept until one rendered frame has used it: a flick between two frames at 30 fps still blows its
  whole length. A new touch or re-entry starts a fresh stroke.
- **One contact.** One primary pointer owns a contact until release; other fingers or devices cannot move or
  release it. Cancellation, lost capture, blur, page suspension and viewport resize discard pending motion and
  charge. Ordinary release keeps the soft decay; mouse hover still makes wind. Checks:
  `tools/pointer-contact-check.mjs` (no GPU), `tools/touch-viewport-check.mjs` (real browser).
- **Scripted beats.** While a chapter is `scripted`, `PointerInput.muted` puts nothing into the field (no chimes,
  ripples or wind lines); the pointer still tracks and control returns when the beat ends.
- `tuning.pointer.minGust` and `minLift` are shared with gesture audio: any input strong enough to write wind
  qualifies for its chime (`audio.md`).

## The cygnet and lift

The cygnet reads `lift` at its own position (plus `tuning.colt.reach` around it) and takes off once the lift under
it exceeds `liftToFly`, if the chapter lets it fly (`mayFly`) and its wing is ready. A chapter sets that threshold
and how it climbs on the column with `Cygnet.needs(lift, labour)` (`tuning.summit` at the end). Gust energy
under it counts as lift only at `tuning.colt.gustLift`: enough to make it hope and open its wings, never to lift it.
The updraft is the spiral the invitation shows (`Coax`, drawn by `fx/swirl.ts`) and the player draws it.

## Deliberate exceptions

These bypass the field on purpose. Keep them explicit when changing any of them. The rule behind most of them: the
player pushes what they see. A stroke meets the ground far behind anything standing or flying under a low camera,
so things the player can see are tested against the stroke on screen and pushed directly, or have a splat laid at
them.

- **The glider.** A stroke passing over it on screen pushes it (`Glider.brush`).
- **Gulls.** A stroke over a gull shoves it (`Gulls.update`, `screenBrush`) and it flaps to recover.
- **The petal funnel.** Petals spiral up an explicit funnel round the middle of the traced circles
  (`input.updraftAt`; `Petals.update`, `uUpdraft`), drawn in along the ground and spilling out at the top, fading
  over about 1.5 s after release.
- **Sails and cloth that need the stroke at them.** The washing's waiting curtain (`WashingCurtain.brush`), the
  toy sails (`LittleBoats.brush`) and the boat's sail when becalmed (`Boat.brushSail`, `tuning.sail.brushReach`)
  lay a splat at the cloth when a moving stroke crosses it on screen. They write the same field nearby grass reads
  and never add progress directly.
- **The birches scarf.** `BirchScarf.brush` tests moving strokes at the active tangle on screen: upward for the
  fork, sustained circles for the wrapped trunk (building the same `charge` as the cygnet's updraft, so a straight
  stroke across it never counts), sideways for the slipped loop, outward for the bow. These build permanent knot
  progress and deposit wind at the cloth; ambient wind only moves the drape. Released lengths are cloth
  (`ScarfCloth`): the field accelerates their particles while gravity, constraints and collisions decide where
  they go. The gathering into the sail is scripted.
- **The drowned village's wash-tub.** `WashTub.brush` tests moving strokes against the tub on screen (a generous
  reach, `tuning.drowned.tub.brushReach`) and pushes it along the stroke's path over the water, as fast as the stroke
  goes there times `take`, only adding way along the stroke; a slow hand drifting back across it barely counts
  (`flickFrom`/`flickFull`). It lays a splat at the tub so the water and the air answer too. The breeze never moves it;
  pushed off its water it drifts back toward the middle; near the cat's eaves or the bow it is drawn in. After
  `tuning.drowned.cat.carryAfter` seconds with no progress the world's air carries it there: the room's safety valve.
- **The sky mirror's bubbles.** `SkyMirror.brush` tests strokes against the hoop, bubbles and their reflections.
  Sweeps grow a film; a released bubble takes its direction from the current stroke projected at its height, with
  a bounded target speed, a quick response to reversals and a short coast. Empty bubbles ignore lift and always
  skim; a filled bubble takes the updraft anchored at it and stops taking horizontal pushes, so a circle does not
  shove its own target. Only a low bubble collects a light; enough height releases it. A sweep at another fallen
  light selects it only when nothing is in play.
- **The sleeping island's feather and pillow.** After the unanswered call `SleepingChapter.windInvitation` points
  at the pillow; screen-space strokes feed `brushDry`/`bedWind`, lifting the blanket and releasing the feather. The
  feather's own `brush` is a direct screen-space push like the glider's; during the walk strokes build forward
  encouragement inside the route corridor and never project it back down the hill. At the snow and mist,
  `brushDry` counts real screen travel (`snowStroke`, `mistStroke`), and progress persists.
- **Storm rain** leans by `tuning.storm.rainLean` along the breeze without writing a gust.

## What wind can and cannot solve

- **Invitations never write wind, heat or progress** (`fx/wind-gesture.ts` for the travelling sweep, `fx/swirl.ts`
  for the rising spiral). Local useful input suppresses them and inactivity brings them back
  (`tuning.invitation`). Large targets place the demonstration on their near surface; sweeps shorten near screen
  edges and are bounded in CSS pixels, with a minimum light level and a soft cool edge so they read on pale cloth
  and in the dark wood.
- **Ambient breeze and idle time solve nothing**: not a curtain, a toy, a scarf tangle, an ember, a bubble, the
  feather, the curtains or the drowned village's tub. The becalmed sail's 90 s return and the tub's are the safety
  valves.
- **Updraft, not gust, where the gesture is a circle.** The cygnet's flights, the wrapped trunk, the wood's embers
  (`Embers.updraft` turns the charge at the waiting coal into its breath; burning coals flare from the field's
  lift) and lifting a filled bubble. Straight strokes build no charge.
- Each room's wind interaction is described with the room in `docs/chapters.md`.

## Sailing

At the ordinary breeze the hull drives at 4.5 units/s, up to 1 more in a following wind; player gusts can raise
forward speed to the shared 10 units/s ceiling (`tuning.sail`). The sail's single sampling function reads the felt
wind on the sway spring: the cloth fills with whatever wind it has, hangs in folds with none, ripples and shakes
harder the harder it blows, and the hull's speed follows the same reading with a little inertia. The player's
gust over the sea adds fine ripple, a slight darkening and a short chop, but the sea's lighting comes from the
weather alone; whitecaps need a squall (`tuning.water`).

- **Shelter.** `Boat.shelter` (0 exposed, 1 sheltered) attenuates the prevailing wind and weather in
  `sailWind.blowing` and `sailWind.taken`; local gusts stay effective. The first island sets it to 1 and it decays
  once afloat (`tuning.opening.departureRate`); restoring the opening checkpoint reinstates it. The opening's
  push-off writes a short low-energy travelling splat across the cove.
- **Becalmed.** `Boat.becalmed` spills the weather's drive while letting the cloth move, so only the player's
  wind moves the boat.
- **Storm passage.** The drowned village caps hull drive with `Boat.speedLimit` while leaving the sail exposed:
  storm pressure (`squallPress`) mostly spills (`squallHolds`) and `squallLuff` shakes the cloth without adding
  speed; tight turns ease the drive and leeway is bounded near the mooring. The cap is reapplied after checkpoint
  placement and reset on other crossings. Lightning and thunder come from `StormWeather`; the lighthouse
  (`LighthouseLight`, `uHarbourLight`, `uHarbourDirection`) starts with the storm and goes out at
  `tuning.storm.lighthouseOutAt`. Neither lights the embers.
- **Toy boats.** Each toy samples local gust energy at its hull; nearby gusts also carry the gathered fleet.
  After the leading toy reaches the stream mouth an outgoing current carries the toys to sea; it cannot complete
  the room, and their sails still read only real wind.
