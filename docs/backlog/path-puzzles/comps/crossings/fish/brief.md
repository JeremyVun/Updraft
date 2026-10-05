# Leaves that are fish — concept brief

2026-10-05. Art only: four keyframes and builder notes; no product-code changes.

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

## The encounter: leaves that are fish (optional; the boat sails on whether or not the player plays)
The short hop from the meadow to the autumn birches, late afternoon going gold, as in `ref-crossing.png`; the birches'
island of gold trees lies ahead (`ref-birch-beach.png`). Ahead on the water floats a loose drift of gold and amber
birch leaves, like leaves blown off the island. Up close they are a shoal of little golden fish exactly the size and
colour of birch leaves: leaf-shaped bodies, a fine dark midrib line, a tiny fan tail. At rest they lie at the surface
and could be leaves.

Keyframes:
1. `k1-leaves.jpg`: the drift ahead and beside the boat; mostly they read as floating leaves, with only a hint (a
   flick of a tail, a small ring on the water) that something is alive. The cygnet stretches its neck toward them.
2. `k2-scatter.jpg`: the player sweeps a gust across the drift (thin white wind lines): along the stroke the leaves
   dart away in a fan just under the surface, flashing gold, rings on the water where they went down; the rest of the
   drift is still.
3. `k3-the-ring.jpg`: the player circles over the water beside the boat (a faint spiral of thin white wind lines): the
   fish gather and swim in a slow golden ring under it, a whirl of gold in the blue; the child leans over to watch.
4. `k4-on-the-beach.jpg`: the boat run up on the birches' beach; at the waterline a scatter of ordinary wet birch
   leaves washed up on the sand, just leaves now. Nobody remarks on it.

## Working plan

Use the built-in image generator with both real frames as references. Establish k1, reuse its framing for k2 and k3, then stage the beach arrival from the supplied beach camera. Inspect each image, export the four exact JPEG sizes, and record concrete metre layouts and limitations in notes.md. Keep prompt provenance in generation-prompts.md. The parent project index is outside this session's writable scope; this brief is colocated with the requested deliverables.
