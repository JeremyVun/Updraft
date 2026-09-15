# The journey

Read this first after any context loss. It is the artistic vision and the plan, and it outranks convenient shortcuts.

## Jeremy's words (2026-09-16, verbatim)

> "I love your artistic thinking. Please explore your ideas and continue expanding ontop of this beautiful experience you've made. small cute animals and birds. I'd love to see the story you tell with the traveller. I would probably suggest getting an opus 5 sub agent to take a look at increasing the quality of the water to match the rest of the visual quality of the game. The grass visuals and effects are truly amazing, and i'd love to see the adventure go to a place where it's like those endless beautiful green rolling irish hills."
>
> "You don't have to use backlog items for this. [...] you may also use sub agents however you feel best to achieve your artistic dream of making dreamy, meditative game."

Earlier: sound is good and touch works beautifully; the core feel (wind over grass, petals, wind lines, the glider) is loved and must not regress.

## The dream

A dreamy, meditative game about being the wind. It should feel like a Ghibli afternoon: soft light, slow time, small kindnesses. The player never fails, never waits on a timer, never reads a word. Every gesture is answered by the world: grass bends, petals lift, birds scatter and settle, a child laughs and runs. The story is small and warm: a child and a paper plane, carried across a grey world that comes back to life wherever the wind goes, to a home in endless green hills.

Principles:
- **Beauty first, and beauty from simulation.** Light, colour and motion come from shaders and the live wind, not from a pile of assets. Every new thing must match the grass and the golden light; if it doesn't, it isn't finished.
- **Wordless.** No text on screen, ever, in the story. Meaning is carried by light, colour, music, the child's body language, and the drawing on the paper plane.
- **The player pushes what they see.** Wind reaches what is under the cursor on screen.
- **Nothing is lost, nothing is failed.** Things drift home, the child waits, the world only grows more alive.
- **Calm pacing.** Beats wait for the player; transitions are slow and continuous; the camera glides.
- **Cute, small, alive.** Animals are gentle and reactive; the child is expressive through pose and motion.

A wordless story in one continuous world. No cuts, no text: it is told through light, colour, music and what the traveller does.

## The story

1. **The still island (dawn).** The world has gone still. With no wind, the islands have faded grey and quiet: flat colourless grass, a bare tree, a glassy sea. On a small grey island a child in a mustard hooded coat and a long red scarf sits by a beached boat with a limp sail, holding a paper plane folded from a crayon drawing.
2. **The wind returns.** The player's first gesture is the first breeze in a long time. The scarf lifts. The plane slips from the child's hand and the player carries it; the child runs after it, laughing. Wherever the wind flows over the land, colour and life come back: grass greens, flowers open, rabbits come out, birds return, and at last the tree leafs out.
3. **Playing catch.** The child throws the plane; the player carries it; it lands; the child fetches it and throws again. Petals, updrafts and birds all join in. When the island is alive, the child pushes the boat into the water.
4. **The crossing (late morning).** The player fills the patchwork sail. Gulls follow the boat, fish jump, a whale surfaces far off. Green hills rise out of the haze ahead.
5. **The hills (afternoon).** The boat grounds on a mainland beach below grey hills. When the player sends a gust inland, a wave of green rolls across the hills to the horizon. Endless rolling pasture, dry-stone walls, sheep, a ruined cottage, soft showers and rainbows. The child walks inland, throwing the plane ahead and following it.
6. **The last hill (sunset).** On the highest hill the child sits and unfolds the plane. The crayon drawing shows these same hills, a sun and a small figure. The child holds it up to the view, then lets it go. The player lifts it on an updraft into the sunset, where it joins a flock of birds.
7. **Night.** Fireflies rise out of the grass, the stars come out, and the camera slowly lifts away.

No fail states anywhere. Every beat waits for the player; nothing is timed.

## World layout (one coordinate space; the camera looks roughly north, −z)

- The still island: the current island, centred near the origin.
- The crossing: open sea to the north, about 600 units.
- The mainland: its coast runs east to west around z ≈ −700; rolling hills continue north and to both sides without end.

## Systems this needs

- **Moving world window.** The wind field, height texture, baked shadows, grass and petals cover a square that follows the camera. The terrain height is one function written twice, in TypeScript and GLSL, on integer-hashed noise so both agree. Grass is placed on the GPU in world-anchored tiles, culled per tile on the CPU, with three levels of detail; beyond the window, the terrain shader paints grass.
- **Life.** A field over the window records how alive the land is, from 0 (grey) to 1. Wind flowing over land raises it and it spreads slowly; it never falls. Grass, flowers, petals, creatures and the tree all read it. On the mainland, a front of life sweeps out from the coast.
- **Time of day.** Sun height and sky colours follow the story: pale dawn, bright morning, golden afternoon, sunset, night. Hill shadows re-bake as the sun moves.
- **The traveller.** A procedural child with a wind-simulated scarf, walking, running, throwing, sitting, sailing, driven by a small story director.
- **The boat.** A small boat whose patchwork sail catches the wind field.
- **Creatures.** Songbirds, gulls, rabbits and butterflies (built by a subagent), later sheep, fish, a whale, a murmuration and fireflies.
- **Music.** Layers join as the island comes back to life, fuller in the hills, quiet at night.

## Build order

1. Engine: shared noise, world height function, moving window, GPU grass.
2. The traveller and the paper plane on the island.
3. Life and the grey start.
4. The boat and the crossing.
5. The hills: terrain, walls, sheep, showers, the green wave.
6. Time of day, the ending, music.
