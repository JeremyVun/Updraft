You are the art director for Updraft, a wordless, dreamy Ghibli-soft browser game rendered in real time with Three.js. In the drowned village at dusk (low warm sun, violet-gold sky, glassy water), something comes across the water toward a small girl in a boat and swallows the half-drowned roofs one by one. A cat panics at it and she follows the cat over the roofs to the church; when it reaches the church it becomes a night storm. It must feel like an unknown coming in a child's dream: beautiful and ominous, never horror.

Until now it was black smoke. The owner doubts that black smoke makes sense in this light and time of day, and asks whether a white fog, mist or haze would make more sense. Explore the sea fog (a haar rolling in off the sea at dusk) that obeys the scene's light: its crest catches the low sun's gold and rose, its body is cool blue-grey in shade, things at its edge fade into it rather than being covered, and as it nears it takes the sun and the light drains. It must still feel like something to run from.

Attached:
- game-dark-coming.png (the dark far off) and game-dark-held.png (the dark close, waiting): the real game frames today, with the black smoke the owner doubts. It reads as dark boulders.
- game-dark-held-portrait.png: the same on an upright phone.
- dark-a.png: the previous study's preferred black-smoke-bank paint-over, for comparison.
- room-painting.webp: the room's painted look.

Paint these, each as a paint-over that keeps everything else in its source frame exactly (camera, boat, girl, cottage, tree, roofs, sky composition), replacing only the black smoke with fog and changing the light only as described:
- fog-far.png over game-dark-coming.png: the fog bank low on the horizon the way they came, its crest lit gold-rose by the low sun, the far roofs and chimneys going faint and vanishing into its edge. Beautiful first, a little uneasy.
- fog-near.png over game-dark-held.png: the bank close and tall behind the boat, the near roofs half gone into it, the sun now behind it so the scene's warmth is failing and the light is turning cold grey-blue; the lantern the warmest thing left. The threat is what it takes away.
- fog-arrives.png over game-dark-held.png: the fog has rolled over everything and is darkening into the storm's night; the roofs and church only shapes, the water dark slate, the first cold wind on the glass. The point where fog has become storm.
- fog-portrait.png over game-dark-held-portrait.png: fog-near, upright.
Each must be something a real-time engine can draw: a distance and height fog field that every shader reads (so things genuinely fade into it), a few large soft transparent sheets for the crest and wisps, the water shader, and a light ramp; not a photograph of a volume render.

Finally write fog-notes.md: for each frame two or three sentences on why it reads and how it would be built in real time; then a frank comparison with the black smoke bank (dark-a.png): which suits this light and time of day, which carries the threat better, and what each risks. Note that the room before this one is a climb into luminous cream-and-gold cloud, and say whether fog right after it is a risk.

Then answer with a short bare JSON list of the files written.
