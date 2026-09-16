# The journey

Read this first after any context loss. It is the artistic vision and the plan, and it outranks convenient shortcuts.

## Jeremy's words (2026-09-16, verbatim)

> "I love your artistic thinking. Please explore your ideas and continue expanding ontop of this beautiful experience you've made. small cute animals and birds. I'd love to see the story you tell with the traveller. I would probably suggest getting an opus 5 sub agent to take a look at increasing the quality of the water to match the rest of the visual quality of the game. The grass visuals and effects are truly amazing, and i'd love to see the adventure go to a place where it's like those endless beautiful green rolling irish hills."
>
> "You don't have to use backlog items for this. [...] you may also use sub agents however you feel best to achieve your artistic dream of making dreamy, meditative game."

Earlier: sound is good and touch works beautifully; the core feel (wind over grass, petals, wind lines, the glider) is loved and must not regress.

## Jeremy's redirection (2026-09-16, verbatim)

This supersedes the shape of the first build. The island, the wind, the grass, the hills and the ending are kept; the arc around them is rebuilt.

> "My vision for the game is that there is a very dream like narrative. you start on the island. The player doesn't know how they got there. They touch the screen and discover the wind effect. however it's still not clear what they can do or what the game is about. They see the child following the plane around, but they don't yet know that this is the primary way of playing the game. So maybe they randomly play around with the plane. there needs to be some things on the island that the player has a good chance of accidently leading the child into which cause some kind of small effect or event to happen. However, the primary subject should be the boat and we need to set it up so that the player can intuitively learn or understand that they need to lead the child to the boat. One of the big problems right now is that the boat is BEHIND the island so the player can't see it at all. Infact, there's an issue where the plane and the child can disappear behind the island and the player has no idea what to do anymore. In terms of polish, when the child gets into the boat, the boat is filled with water (it's not floating on the water properly). It wasn't clear to me at all for example that i had to get 78% of the island alive before they climb up to the blooming tree. I do like the effect of the world coming into colour suddenly when "78% of the island" is coloured in though, see if there's a way to boost that.
>
> Everything the child does on the other side of the island, the player can't see at all, which is a shame.
>
> Along the way home, the child makes friends with some animals that keep them company. There should be simple and natural things that happen in the game that cause the bond between the child and the animal to grow stronger.
>
> The child isn't laughing and cheering when it flies high currently, thats a great idea that needs to be tastefully added. It's cool that they throw it by themselves as well. There's also an issue where the child too often stands still watching the plane while it flies instead of going after it.
>
> I like the long boat ride idea, and it's definitely something to explore, but I'm not sure about the beginning of the game (it's way too long, and the player can see the destination the whole way there so there's no surprise or delight).
>
> I'm not sure about the endless rolling hills being the destination at the beginning of the game as well. I may have over steered here when i gave this idea without letting the build agent think through the dream and waht would make most sense. The hills really do feel endless and there's no more narrative progression.
>
> At a high level in my head, I'm thinking that the journey should be filled with ups and downs, and throughout it all a profound sense of being lost and nostalgia, trying to find home with his animal friend. Maybe we can do something where the animal friend is also a little child animal that is also trying to get home, and so they have to get home together. Sort of like a heroes journey even for the child, where they get drawn into a world larger than they thought and have to face the darkness in their dream and get through it alone with just their animal friend/s. Maybe facing their fears, and then helping their animal friend face their fears. If you were dreaming as a child, how do you think your dream would play out? What would stay with you even after you woke up and make you feel like you grown up and become a different person?"

On the companion, answering the design questions: "fledgling crane. We can aim for a short 18 minutes now, but i'd eventually like to add another animal later one and make this a much more involved and immersive experience."

On the setting, rejecting both Ireland and Switzerland:

> "i mean what do you think? should it be swiss? I guess the opening theme is a bunch of islands, and that is sort of a metaphor for isolation and being lost. should we stay with that setting for a while longer? Does rolling swiss hills in full summer/spring fit with this? What other settings do you think really fit with the child's dream?"

> "on the laugh, i think there shouldn't be any voices or anything in the game. No sounds from either the child or the baby crane. There can be noises from other animals and environmental sounds, but never any voicing from the two main characters."

On the islands: "love all of these ideas, especially the island of lines! It's very surreal and dreamlike. Like the kid is dreaming of home, and it's manifesting."

On the season: "i agree with the use of seasons. That's the heroes journey. But i dont think the still island should start in dead winter. It should be looming. thats why the cranes are migrating. It's why they have to find their way home before it gets too cold and dark."

And: "Anything you want to prototype and explore, go ahead. we can always iterate or trim what doesn't work."

## The dream

A dreamy, meditative game about being the wind. A Ghibli afternoon: soft light, slow time, small kindnesses. The player never fails, never waits on a timer, never reads a word. Every gesture is answered by the world.

What the journey is *about*: **something small trusted the child, and the child went into the dark first so it wouldn't have to.** That is the moment a kid feels changed — not being brave for yourself, but being brave in front of someone smaller. And then letting go of what you loved and being glad.

Principles:
- **Beauty first, and beauty from simulation.** Light, colour and motion come from shaders and the live wind, not from a pile of assets. Every new thing must match the grass and the golden light; if it doesn't, it isn't finished.
- **Wordless, and voiceless.** No text on screen, ever, in the story. The child and the crane never make a sound — no laughing, no crying, no chirping. Other animals and the world are as loud as they like; the two travellers are silent, and everything they feel is carried by the body, the light and the music. Meaning is carried by light, colour, music, the child's body language, where the child looks, and the drawing on the paper plane.
- **The player pushes what they see.** Wind reaches what is under the cursor on screen.
- **Never let the player lose the thread.** The subject is always in frame. If the child or the plane would go behind terrain, the camera answers. A player who stops understanding what to do is the only real failure state this game has.
- **Nothing is lost, nothing is failed.** Things drift home, the child waits, the world only grows more alive.
- **Teach by accident.** The player should discover that they lead the child, rather than be shown it. Everywhere the child arrives, something small and delightful happens.
- **Calm pacing.** Beats wait for the player; transitions are slow and continuous; the camera glides.
- **Dream logic, not explanation.** You never learn how you got here. Things recur in the wrong place, and nobody remarks on it.
- **The dream is manifesting home.** Every island holds a piece of home, out of place and with nobody in it: washing on the line, chimneys with no house, a village under the water, a bed in the grass. The child is dreaming their way toward it and the dream keeps handing them fragments. That is where the nostalgia comes from, and it is why the real cottage at the end lands.
- **Nowhere real.** No country is ever named or recognisable. Ireland and Switzerland were the same mistake in different accents: the moment a player can place it, the dream becomes a travelogue. Rolling green, yes; dry-stone walls and chalets, no.

## The spine

**The child isn't travelling home. The child is taking a lost fledgling to its family — and only at the very end does the player find out they were walking home the whole time.**

When the island comes back to life, a flock of cranes crosses overhead going north. One small one can't keep up and comes down in the grass. The flock goes on. The child picks it up, looks at the boat, and pushes off.

This carries the whole game:
- It gives the player a legible, wordless goal without a word of text.
- It gives the boat a reason to exist that the player understands, so leading the child to it is intuitive.
- It makes north mean something.
- It makes the ending a real reveal. You thought you were on the bird's errand; then the drawing opens and it is a white cottage with a red door, and it is in the valley below you. The child never told you what they wanted.

Two lost children: one who can't find home, one who can't fly. Both fears are faced, and the player is the answer to both — because flight is the player's verb. The fledgling flaps and drops on the island; glides a few metres on an updraft in the hills; is too frightened to come out in the dark; and at the end, one updraft and it goes, and the flock comes down out of the night for it.

## The year

Winter is **coming**, not gone. That is why the cranes are flying, why the fledgling has to catch up, and why the journey has a clock without ever having a timer. The light and the warmth are draining out of the world ahead of them, and home has to be reached before the cold closes in.

The season deepens island by island and never goes back: late autumn, a bright windy day, the last warm afternoon of the year, deep autumn, the first winter storm, a clear frozen night. The child leaves in autumn and arrives in winter, a year older, in one night.

The grass keeps the green it is loved for — it just ages. Colour returns to the still island as green going gold, not spring green, and each island afterwards is a little further through the turn.

## The story: the islands

Every room is an island and every crossing is shorter than the last, so the world closes in as home gets nearer. Each island is bounded by sea on every side, so you can always see its edges and always know you are getting somewhere — which is exactly what the endless mainland hills could never do. Home is an island too: not a continent to arrive at, just a small place with the light on.

1. **The still island** — grey, dawn, late autumn, no wind. The child and the paper plane, the boat in the cove. The first gesture is the first breeze in a long time; colour comes back green going gold wherever the wind goes; everywhere the child arrives something small happens; and when the island is whole the whole frame lifts at once. A flock of cranes crosses overhead, going on ahead. One small one cannot keep up and comes down in the grass. The child gathers it up, and the player leads them to the boat. **Built.**
2. **The island of lines** — a steep little island strung pole to pole with washing lines: sheets, cloth, flags, paper, all hung out with nobody there. One gust fills a hundred of them at once. Bright, cold, windy, loud with colour — the first delight after the grey, and the first piece of home the dream hands over. Short.
3. **The meadow** — the last warm afternoon of the year. Endless grass going to seed, wildflowers, skylarks, a sun shower, the green wave rolling out. Unfenced and unnamed. Where the fledgling first glides, on the player's updraft. The high point.
4. **The drowned village** — the long dusk drift. Sailing between rooftops, a church spire, the tops of trees, a weathervane still turning, herons standing on chimneys, leaves on black water. Homes the water took. This is the room that makes a lit window mean something. The storm gathers and takes the plane.
5. **The dark wood** — the first winter storm, at night. The wind stops bending grass and starts breathing on light: embers and fireflies fanned into a trail the child follows. The fledgling is lost in the dark and is found by lighting where it hides. The plane is found snagged and sodden, and the wind dries it.
6. **The lamplit island** — clear, frozen, stars. Flock calls overhead; the child holds the fledgling up, the player raises an updraft, and it flies. The flock comes down for it. The child watches it go, alone — then turns, and below is a white cottage with a red door, smoke rising, one lit window. The drawing, the release into the night with the murmuration behind it, and the door.

Two more islands are wanted and slot in as short interludes once the spine works: **the sky mirror**, a salt flat under an inch of water where the sky is doubled and the child appears to walk on cloud, and **the autumn birches**, an island of gold leaves the wind strips and drifts.

Other fragments of home for the dream to manifest, to be used wherever they land best: a single red door standing in the grass with nothing behind it; chimneys smoking with no house under them; a made bed in the middle of the meadow with the sheets lifting; a washing line strung between two rocks out in open water with one small sheet on it; a bell or wind chimes the wind rings; scarecrows that are not people.

No fail states anywhere. Every beat waits for the player; nothing is timed.

## The companion

Built as a general **companion** system, not a one-off crane, because more animals join later and the experience is meant to grow more involved.

A companion has: a body and gait, a place it rides on the child (arms, hood, shoulder, at heel), a bond value that only rises, and a set of shared moments that raise it. The bond shows in behaviour, never in a meter: distance kept, how often it looks at the child, whether it rides or walks, whether it sleeps against them at night, whether it comes when the child stops.

Things that raise the bond, all of them things the player causes or witnesses:
- The child picks it up, carries it, sets it down somewhere safe.
- It is fed, warmed, dried, or sheltered from the sun shower under the coat.
- It chases the plane and is cheered for.
- It is lifted by the player's updraft and lands safely.
- It is frightened and the child stays.
- It is lost and found.

The crane's arc is flight: flaps and drops, then glides, then cannot help in the dark, then flies. Later companions get their own single arc of the same shape — one fear, faced once, caused by the player.

## World layout (one coordinate space; the camera looks roughly north, −z)

Each island sits further north than the last, with open sea between. Crossings shorten as home gets nearer.

- **The still island:** the ellipse centred near (−6, −14), about 60 by 44. The child starts on the south shore; the boat waits in the south-east cove at (8.5, 21.5), in frame from the first second. The ridge and the tree are north-west, at (−16, −34) and (−15, −31); play stays south of the ridge, so nothing happens off camera.
- **The island of lines:** small and steep, north across the first crossing.
- **The meadow:** large and open — the existing mainland terrain, bounded by coast on every side instead of streaming on forever.
- **The drowned village:** a shallow flooded basin, sailed rather than walked.
- **The dark wood:** thick and close, the smallest island of all.
- **Home:** the cottage island, the last one.

Concrete coordinates are settled island by island as each is built; the mainland terrain around z ≈ −700 becomes the meadow.

## Systems this needs

- **Moving world window.** The wind field, height texture, baked shadows, grass and petals cover a square that follows the camera. The terrain height is one function written twice, in TypeScript and GLSL, on integer-hashed noise so both agree.
- **Life.** A field over the window records how alive the land is, 0 (grey) to 1. Wind over land raises it; it spreads slowly and never falls.
- **Time of day.** Sun height and sky colours follow the story: pale dawn, bright fogged morning, golden afternoon, bruised dusk, storm dark, clear night.
- **The traveller.** A procedural child with a wind-simulated scarf, walking, running, throwing, sitting, sailing, carrying, driven by a story director. Silent.
- **Cloth on the wind.** Lines, sheets and hanging things that read the wind field and fill, snap and flutter: the sail's shader generalised. The island of lines is built on it, and it pays for sheets, flags and laundry anywhere else.
- **Companions.** The system above; the crane first.
- **The boat.** A small boat whose patchwork sail catches the wind field. Used twice: the crossing, and the drift through the wood.
- **Creatures.** Songbirds, gulls, rabbits, butterflies, sheep, goats, fish, a whale, herons, a murmuration, fireflies, and the crane flock.
- **Distance that reads.** Open ground with nothing on the horizon looked flat and streamed in badly. Every island wants a far silhouette with atmospheric perspective — the next island in the chain, standing out of the haze — and verticals in the middle distance. Being able to see where you are going next is the point of an archipelago.
- **Light on the wind.** In the dark room, gusts and updrafts fan embers and fireflies into brightness and carry them.
- **Music.** Layers join as the world comes back, fuller in the hills, thin and low in the wood, almost gone in the dark, whole at the end.

## What the first build got wrong (fixed)

- The boat sat at (−15, −61.5), behind a 13-unit ridge, and was never once on screen. It is now in the cove, in the opening frame. **Fixed.**
- Throws aimed at the island centre, so play drifted over the ridge and out of sight. Throws stay in the southern half and are reflected back at z = −24. **Fixed.**
- The child only chased the plane past 26 units, so they stood and watched. They chase from 8 and run when it is far or high. **Fixed.**
- `cheer()` was a pose only and was silently dropped whenever another action ran. It now interrupts, hops higher, and fires sooner. **Fixed.**
- The hull bottom sat below the sea plane, so the sea rendered inside the boat. Floorboards at local −0.24, draft 0.42, less bob. **Fixed.**
- The 78% life threshold was invisible and the restoration a 1.8-second fade. Global warmth is now held back until the island is whole, then released. **Fixed.**
- The player was never led to the boat. A `leaving` beat now frames it, the child glances at it, throws bias toward it, and landing the plane nearby boards them. **Fixed.**
- A laugh was added and then removed: the two travellers are silent. **Reverted.**
- Still open: the crossing is too long with the destination visible the whole way, and the hills are an endless unbounded mainland. Both are answered by the island chain.

## Build order

1. Engine: shared noise, world height function, moving window, GPU grass. **Done.**
2. The traveller and the paper plane. **Done.**
3. Life and the grey start. **Done.**
4. The boat, the crossing, the sea (surf, swash, seabed, glitter, mirror), whale and fish. **Done.**
5. The hills: terrain, the green wave, creatures, wildflowers, sheep, the sun shower, the murmuration. **Done**, to be reworked into the meadow.
6. Time of day, the drawing, the release, night, the cottage, music. **Done.**
7. **The island, made legible.** **Done.**
8. **Cloth on the wind, and the island of lines:** the generalised cloth shader, poles and catenary lines, hung sheets that fill and snap, pieces that tear loose and fly. **Prototyped** (`src/world/lines.ts`, `?lines` hangs it over the still island). What it proved: a gust visibly lifts a whole *band* of washing as it rolls through, which is the effect the room is for. What it still needs: colours desaturated toward linen (the current palette reads as bunting, not laundry), a billow curve so a lifted sheet keeps a belly instead of going edge-on and disappearing, and above all its own island — over the still island's tall grass the lines are half-buried decoration, and they need bare, short-cropped slopes to be the subject.
9. **The companion system and the crane:** flock, fall, carry, ride, bond, glide, flight.
10. **The crossings:** shorter, blind in haze, each island appearing out of nothing; the whale close alongside.
11. **The meadow:** bound the mainland into an island, drop the walls and field patchwork, age the palette toward the last warm day of the year.
12. **The drowned village:** flooded basin, rooftops, spire, treetops, herons, the drift, the storm, losing the plane.
13. **The dark wood:** light on the wind, the lost fledgling, finding and drying the plane.
14. **Home:** the flight, the flock, and the existing ending.

## Testing shortcuts

`?chapter=crossing|hills|summit` start later in the story; `?dusk=0..2` overrides the time of day; `?shower=0..1` forces the rain; `?debug=wind` draws the wind field.

## Pacing

Measured by a scripted playthrough on 2026-09-16, before this redirection: island about 3 minutes, farewell half a minute, crossing just under 2, walk inland 8, ending 2 — about 16 minutes at 59 fps average. The target for the six-room arc is about 18 minutes, with no room longer than about 5.
