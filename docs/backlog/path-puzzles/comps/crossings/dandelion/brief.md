# Dandelion crossing art brief

## Jeremy's brief (verbatim)

You are the concept artist for one short encounter on a sea crossing in Updraft, a real-time Three.js browser game where
the player is the wind. Paint concept keyframes that a 3D build will match, then write `notes.md`. Use your image
generation. Save every image in the current directory with the exact names given, as 1664 x 936 JPG (exact 16:9).

## What the game is
A dreamy, meditative, wordless game: a Ghibli afternoon, soft golden light, slow time, small kindnesses. A small girl
and a grey cygnet (a baby swan with a bandaged left wing) sail a little wooden boat from island to island; the player
never controls them directly. The player's only verb is moving the cursor: a sweep makes a gust that pushes whatever
is under the cursor on screen, and tracing circles raises an updraft, a rising column. Nothing is ever failed, nothing
is timed, there is no text and no UI.

## The reference captures (attached, also in this directory)
`ref-*.png` are real frames from the game on this crossing, from the game's own crossing camera: behind and above the
boat, about 24 m back and 6.5 m up, looking ahead along the way. **Paint from this camera.** The previous concept round
failed because the paintings were postcards from viewpoints the game never uses and showed the puzzle as magic effects
instead of what the player's hand does and how the world physically answers. So:
- Keep the game's camera, horizon height, scale of the boat in frame (small, lower middle) and its rendering style:
  soft stylised 3D, simple rounded shapes, painterly sea with sun glitter, warm haze at the horizon.
- Keep the boat exactly as captured: a small rounded wooden dinghy with a mast and the sail shown in the capture.
- The child: a small girl about 1.1 m tall in an orange hooded coat and a red scarf, sitting in the boat; the cygnet
  rides in her brown satchel, head and long grey neck poking out. Nobody ever looks at the camera.
- Show the player's wind the way the game draws it: a few thin soft white wind lines streaking along the stroke, or a
  faint spiral of thin white lines for an updraft. Never a cursor, hand, glowing trail, sparkles or magic glow.
- No text, no UI, no logos, no people other than the child, nothing of a real country.
- Dream logic: impossible things happen calmly and nobody remarks on them. Beautiful first; never horror.

## notes.md
For each keyframe: what it shows, what reads well, and the layout a builder needs in metres (size of the new thing,
its distance and bearing from the boat, height above the water). Then a short list of risks you see in building it.
## The encounter: a dandelion clock (optional; the boat sails on whether or not the player plays)
The short hop from the birches to the stairs in the clouds: the sail is now red (a long knitted red scarf), as in
`ref-crossing.png`; low cloud is coming down ahead and the light is turning toward bedtime dusk, warm gold low in the
sky. Floating on the water just off the boat's bow, drifting toward it, is an impossible dandelion clock the size of a
beach ball (about 0.7 m across): a perfect sphere of fine white seeds on a short green stem lying in the water,
bobbing, a few seeds already loose. Dream logic: nobody remarks on its size.

Keyframes:
1. `k1-the-clock.jpg`: the clock floating close beside the boat in the low gold light; the child leans out toward it,
   the cygnet's head up.
2. `k2-blown.jpg`: the player sweeps a gust across it (thin white wind lines): the seeds lift off in a long soft plume
   that streams up and away into the sky, each seed a tiny white parachute catching the low sun; the bare head bobs.
3. `k3-first-stars.jpg`: a little later, the light lower: high up the seeds have become the evening's first faint
   stars, scattered loosely over the sky above the cloud; the child looks up at them.

## Working plan

Hold the crossing camera across all three frames. Use the rear-quarter view of `ref-crossing-b.png` with the smaller boat scale of `ref-crossing.png`; horizon near the upper quarter. Put the small clock off the visible port bow in dark water, clear of the red sail. Carry the physical seeds up the open side of the frame. Hold the camera for the final loose scattering above the cloud. Inspect each image before deriving the next, then record metre-based layout and build risks in `notes.md`. This is concept art only; no product implementation or build orchestration.

