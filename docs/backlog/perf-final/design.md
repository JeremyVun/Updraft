# Final performance pass over the whole game

## Jeremy's brief (verbatim)

2026-09-29, after the stairs in the clouds were added:

> yea after we added the stairs level, i need another pass to find performance optimisation opportunities.

> in terms of the perf, create a backlog item for a final perf profile and optimisation pass over the whole game

## What this is

A fresh profile of the whole journey as it now plays, then savings, in the order the last pass used: exact ones first
(no pixel or sample changes), then anything that changes the look, each brought to Jeremy with evidence before it
merges. It is the last pass before release, so it also checks that nothing the game gained since the last pass (the
stairs in the clouds, the child rebuild, bedtime, the cloud sea, the cygnet's catch-up swim) is spending more than
it shows.

The previous pass (perf-bakes) is merged and closed; its code ended at `69af219`, and its lasting rules are in
`docs/engine.md` (Bakes and caches, Before/after flags, Measuring). Its per-chapter profile tables, the ones to
re-measure against, are in git: `git show 829e70f:docs/backlog/perf-bakes/design.md`. Its rulings carry over unless
Jeremy changes them:

- **The target is energy over a whole playthrough on Jeremy's M5 iPad Pro at High (1.5×, MSAA 2)**, not frame time
  alone (2026-09-25: a playthrough cost 30% of the battery, then 15 to 18% after that pass; "the back of ipad still
  gets hot. There must certainly be more computation (cpu or gpu) that we can save on in the game"). A cost in a room
  the player spends ten minutes in outweighs the same cost in a one-minute one; CPU script and the audio graph count
  as well as the GPU.
- **Exact first, then the look.** Changes that keep every pixel and sample go first. Anything that changes the look
  gets stills or video for Jeremy and merges only on his verdict.
- **Kept as ruled:** High stays 1.5× (L1 rejected 2026-09-26); alpha-to-coverage stays (L2 breaks the sail's
  see-through cutaway). Drawing the sky at lower resolution or less often was left out of the last pass as a
  separate decision (13 to 15% at sea and on the mirror); it can be raised again here as a look change.
- **Light testing.** Jeremy, 2026-09-26: "are we over testing? I can playtest most of it, i dont need full video
  capture of the entire game" and "some very quick screenshots or recordings will help". Exact items get typecheck,
  build, a short frame-difference pass and one saving measurement; look changes get a few quick before/after shots of
  their key moments. No switches in the deployed game ("i dont want switches for the deployed version though").

## Leads left by the last pass

Where the time went at its end (1.5×, Mac, weighted by minutes): the sea surface's shading was the largest GPU cost
(about 19%, 25 to 41% of a frame afloat), then grass (13%, vertex-bound, the near level most of it), post and bloom
(10 to 12%) and terrain shading (10%). Sound cost CPU on the scale of the game script. Re-measure before trusting any
of it; the stairs, the cloud sea and the rebuilt characters came after.

Not built, still open:
- **Sea shader:** the weed term is multiplied by exactly 0 outside bed depths 0.9 to 4 m (two `vnoise` a pixel over
  most of the open sea) and the caustics beyond 220 m and above 0.1 m of water (two `textureGrad`); upper bounds 1 to
  10% each. `waterWindAt(xz)` is read twice (`stroke` and `windWaveSlope`), `foamColor` recomputes `backlit`, and
  `fogOf` can evaluate `skyRadiance` up to three times for one ray.
- **The wind step:** 21 small passes could fuse to about 12, exactly, for 0.1 to 0.2 ms on the Mac. Worth it only if
  tile-based GPUs pay more per pass than the Mac shows.
- **Look changes Jeremy has not been asked about:** bloom at half resolution (about 3%), a sparser or shorter near
  grass level (up to 10%), grass fog once per blade instead of per vertex (up to 2.4%), the seabed, glints or ripples
  in the sea (2 to 3% each), wind and life readbacks every other frame (0.1 to 0.2 ms of CPU, a frame of latency).
- Auto's touch ceiling stays 1.25× (High is 1.5×); pricing the two against each other was left open.

Tried and not worth it (don't repeat without a new reason):
- Skipping empty grass tiles: almost none are empty at every density (Birches and Wood floors thin by rank, not to
  zero). Returning early for sea under land: exact, but slower afloat than it saves on land. Skipping the seabed
  where the water hides it: it is never hidden where it is drawn. Pausing the Birches room in the Drowned drift: it
  is on screen for the first seconds.
- Tiled noise textures for single-octave `vnoise` terms (grain, ripples, the Wood's moss and flecks, the seabed): one
  sample costs about as much as one `vnoise`. Only four-octave `fbm` pays.
- Terrain without its discard, the grass's frost, dawn and lamp terms (they already early-out), skipping the mirror
  pass where it is invisible (it is free there), drawing the sea last (slower and not exact), MSAA without the depth
  resolve (drops the antialiasing), re-baking only the newly exposed window strip.
- The scarf: skipping unchanged sections or resting cloth would change its motion (time-driven roll, the wind never
  zero, a slow creep).
- Clouds baked into a static texture (they drift), props' noise (small screen area), a room-index texture for
  `journeyHides` (cheap arithmetic), the pond's noise (scrolls).

## Scope

- Every room, the crossings, the ending and the credits, on the path a player takes (`tools/playthrough.mjs`), with
  the time spent in each so costs are weighted by minutes.
- GPU per pass and per object, CPU per frame (story, creatures, cloth, wind), the audio graph, readbacks, and
  graphics memory (`docs/engine.md` "Open": no target-device budget yet).
- The stairs in the clouds in particular: the cloud deck GLSL is in `ATMO_GLSL`, which every shader includes, so it
  may cost in every room, not only the stairs.
- **Not in scope:** the boot freeze and the loading veil, which are `docs/backlog/boot-veil/`. Anything learned here
  about startup is handed to that item.

## Constraints

- Nothing changes how the game plays, the camera, or the story's timing.
- Play never freezes or hitches for a saving (Jeremy, 2026-09-29, on setting up the stairs: "what i want to avoid
  though it having the gameplay itself freeze"). Deferring or streaming work must be proven hitch-free with the
  frame-time checks.
- Measurement rules from `docs/engine.md` "Measuring": a worktree with its own server, no other Chrome capture
  running, builds compared back to back, never against remembered numbers. Desktop deltas are not iPad numbers.

## Next (design, not yet ready to build)

1. Check that `tools/frame-profile.mjs`'s ablations still patch today's shaders: they are string replacements
   written against the code as it stood at `69af219`, and a patch that no longer matches measures nothing.
2. Profile: a traced playthrough with per-chapter GPU census (`tools/frame-profile.mjs`), CPU profiles, the audio
   cost (`tools/audio-cost.mjs`), power where the tools allow (`tools/power-profile.mjs`), minutes per room; compare
   with the last pass's per-chapter numbers where they exist, re-measured back to back at `69af219`.
3. Bring Jeremy the ranked list of costs and candidate savings (exact and look-changing), then write `build_plan.md`.

## Jeremy's answers (2026-09-29)

> any kind of performance improvement we can get is good so we can get this playable on more devices. I think we can
> profile on this mac and just get performance up?

- **Goal:** less work per frame everywhere, CPU and GPU, so the game runs on more devices. Battery and heat on the
  M5 iPad follow from that; weaker devices (older iPads, phones) are in scope, so Medium, Low, Auto's lower rungs and
  graphics memory count too.
- **Measured on this Mac.** Its Apple GPU is the same family as the iPad's, so where the time goes and the relative
  size of a saving carry over; absolute milliseconds do not. `?ratio=2` makes the GPU the bottleneck on purpose so
  GPU savings show. No iPad readings needed to start.
- **Asked, 2026-09-29:** "Do we already cap fps to 30 to keep visual quality higher?" Only the Low preset presents at
  30 fps; High, Medium and Auto aim for 60, and Auto lowers resolution, antialiasing and world detail to hold it
  (it only judges against 30 when the device itself caps, as in iOS Low Power Mode). Whether Auto should end on a
  30 fps rung that keeps more detail, instead of its last rung (25% grass, 70% reach), is a candidate for this pass:
  it trades smoothness of the wind under the pointer for looks, so it goes to Jeremy with evidence.
