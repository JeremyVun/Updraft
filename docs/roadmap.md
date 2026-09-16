# Roadmap

## M1: core feel (built, awaiting a play test)

One island at golden hour. Passes when a new player grins within 30 seconds without instructions.

- Live wind simulation driven by the pointer: gusts along swipes, updrafts on press-and-hold.
- A dense grass meadow that bends, overshoots and settles like real grass.
- Petals and pollen that lie in the grass and lift into swirls when a gust passes.
- Wind lines that trace the flow, in the spirit of *The Wind Waker*.
- A paper glider that rides the wind, skims the grass and never gets lost.
- Sea, sky, cloud shadows, haze, a landmark tree and the distant archipelago.
- Wind and music generated from the player's gestures.
- 60 fps on an Apple Silicon Mac at native resolution. Measured at 60 fps on an M4 Pro at pixel ratio 2 in headless Chrome.

Jeremy played it (2026-09-16): sound is good and touch works beautifully.

## M2: the journey (built, local, not yet deployed)

Jeremy's brief for this milestone and the story as built are in `journey.md`: a wordless story from a grey, still island across the sea to endless green hills and a cottage at night. The restoration is simpler than first planned: wind itself brings life back (no seeds, rain or fire elements), which keeps the one verb.

- The traveller (a child with a paper plane), the grey still world and life returning where the wind goes.
- The crossing by boat: farewell under a rainbow, gulls, a whale and fish (whale and fish on a subagent branch).
- The mainland: streamed terrain, grass, field patchwork, dry-stone walls, wildflowers; the green wave; a sun shower; a murmuration at sunset.
- Creatures: rabbits, finches, gulls, butterflies (sheep on a subagent branch).
- Time of day from golden afternoon to night; the drawing, the release, the cottage, the moon.
- A new sea: surf and swash, seabed, glitter, mirror.
- Music that follows the story.

## M3: the dream (in progress)

The journey rebuilt as six rooms with a companion, per `journey.md`. Room 1 is done; the rest follow in order.

- The island made legible: the boat in the cove and in frame from the first second, play kept south of the ridge, the child chasing and laughing, the boat afloat properly, the restoration held back and then released all at once. **Done.**
- The companion system and the fledgling crane: the flock, the fall, carrying, riding, the bond, the first glide, the flight.
- The crossing in fog: ninety seconds, blind, the whale close alongside.
- The alp: Swiss rather than Irish — no walls or paddock fences, spruce stands and hay barns, a snow-capped range on the horizon to give the distance depth. Ends at the tree line.
- The drowned wood: the flooded valley, the long dusk drift, the storm, losing the plane.
- The dark: wind that fans light instead of grass, the lost fledgling, finding and drying the plane.
- The last hill: the flight, the flock, and the existing ending.

## Later

Optional wind trials, a persistent world, more islands; performance on phones (grass fill at high pixel ratios is the main cost).
