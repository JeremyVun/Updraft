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

## M3: the dream (the journey plays end to end)

The journey rebuilt as a chain of islands with a companion, per `journey.md`, which is the anchor for all of it.
Every room below is built and playable; what is left is polish, pacing and the turn of the year.

- **The still island.** Made legible: the boat in frame from the first second, play kept south of the ridge, the
  throws leaning toward whatever is still grey so catch finds the rest of the island, the restoration held back
  and released all at once. The skein, the fall, and the child carrying the colt from there. **Done.**
- **The island of lines.** A small green whaleback strung with washing, hung around the walk so the open ground
  is always the way on; shirts, gowns and trousers among the sheets; a red door on the crest; baskets on the
  sand. **Done.**
- **The meadow.** The green wave, the long walk, the sun shower, the crest where the family is seen wheeling, and
  the colt's first glide on an updraft the player holds. **Done.**
- **The drowned village.** The dusk drift between rooftops, the becalming where the player is the wind in the
  sail, and the storm taking the paper plane. **Done.**
- **The dark wood.** Wind that fans light instead of grass, the colt frightened out of the hood and found by
  putting light on it, the plane found sodden and dried. Nobody can be stranded there. **Done.**
- **The long crossing.** The exhale: whales, dolphins, fish, and the night ending somewhere along it. **Done.**
- **Home.** The last hill, the reunion staged in four beats, the drawing, the release and the red door. **Done.**
- **The companion.** A crane colt rebuilt as a round downy chick that rides under the arm and on the shoulder,
  climbs into the hood, tries and fails, glides, hides and flies. **Done.**
- **Music.** A mood per room, gliding between them.

## Next

- [New rooms](rooms.md): build the island of little boats between washing and meadow; then the sky mirror;
  develop the stairs in the clouds before committing its build.

- [Phone and portrait gameplay](backlog/portrait-gameplay/design.md): full physical-phone playthrough and framing/input/performance pass; deferred from the 2026-09-19 review.
- The meadow's frame time: it saturates the GPU at render scale 1 and the governor answers by going soft.
- A playthrough for pacing: about eighteen minutes, no room over five.
- The turn of the year beyond the grass — the trees, the flowers, the sky and the light.
- More of the loose nonsense `journey.md` asks for: chimneys with no house, a bed in the meadow, a piano at the
  tide line. And two islands never built: the sky mirror and the autumn birches.

## Later

Optional wind trials, a persistent world, more islands; performance on phones (grass fill at high pixel ratios is
the main cost).
