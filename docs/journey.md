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
- **Wordless, and almost voiceless.** No text on screen, ever. The child never makes a sound at all. The colt is
  silent too, **except at a handful of critical moments** — when it is in distress, or when it is warning the child
  and the player of something. Because everything else is silent, those few small cries land like nothing else in
  the game. They are the only voice in the story, so they are never spent on anything ordinary. Other animals and
  the world are as loud as they like. Meaning is carried by light, colour, music, the child's body language, where the child looks, and the drawing on the paper plane.
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

Every room is an island, bounded by sea on every side, so you can always see its edges and always know you are
getting somewhere. Home is an island too: not a continent to arrive at, just a small place with the light on.

**Crossings vary.** There is no rule that each one is shorter than the last — that was a tidy idea that cost the
sea its best sequence. Some are short blind hops between islands that are almost touching. At least one is long
and open and full of life, and it earns its length by being the exhale after the worst part of the journey.

**The player must never be able to see the next island.** A veil (`uVeil` in `world/atmosphere.ts`) dissolves the
world past a distance each chapter chooses, and it ignores height, unlike the ground mist. From the first island
the second is a smudge on the horizon and nothing more. Chapters set `haze`: about 0.85 on the small islands,
0.55 on the meadow.

1. **The still island** (`story/island.ts`) — grey, dawn, late autumn, no wind. The child and the paper plane, the
   boat in the cove. The first gesture is the first breeze in a long time; colour comes back wherever the wind
   goes; everywhere the child arrives something small happens; and when the island is whole the whole frame lifts
   at once. Then the skein comes over and the colt falls — see below. **Built.**
2. **The island of lines** (`story/lines.ts`, `world/lines.ts`) — a green whaleback strung pole to pole with
   washing hung out with nobody there. One gust lifts a whole band of sheets at once and the child runs through
   them after the plane. The first piece of home the dream hands over. **Built.**
3. **The meadow** (`story/meadow.ts`) — the last warm afternoon of the year. The green wave rolls out, and the long
   walk follows the plane through a sun shower. Unfenced and unnamed. **Built**, and still needs the colt's first
   glide on the player's updraft.
4. **The drowned village** — the long dusk drift between rooftops, a spire, treetops, a turning weathervane,
   herons on chimneys. Homes the water took. The storm gathers and takes the plane. **Terrain only.**
5. **The dark wood** — the first winter storm, at night. The wind stops bending grass and starts breathing on
   light: embers and fireflies fanned into a trail the child follows. The colt is lost in the dark and is found by
   lighting where it hides. **Terrain only.**
6. **The long crossing** — the intermission, and the only crossing that takes its time. They come out of the dark
   wood onto open water at first light, and the sea is alive: whales, a pod of dolphins running with the boat,
   fish, birds. Nothing is asked of the player except to sail. After the storm and the dark, this is the room
   where you are allowed to breathe. **Not built** — dolphins do not exist yet; `fx/sealife/` has the whale and
   the fish.
7. **Home** (`story/home.ts`) — clear, frozen, stars. The colt flies on the player's updraft and the flock comes
   down for it. Then the drawing, the release, and the red door. **Built.**

Crossings between them are all one class (`story/crossing.ts`) taking a route, a haze, what to look back at, and
whether there is a whale. `story/journey.ts` runs the order: island → toLines → lines → toMeadow → meadow →
toHome → home, with the drowned village and the dark wood to be inserted before home.

Two more islands are wanted as short interludes: **the sky mirror**, a salt flat under an inch of water where the
sky is doubled, and **the autumn birches**, an island of gold leaves the wind strips.

Other fragments of home for the dream to manifest: a red door standing in the grass with nothing behind it;
chimneys smoking with no house; a bed made up in the meadow; a line strung between two rocks at sea; a piano at the
tide line the wind plays. None of it makes sense and none of it is explained. That is the point.

## The crest: where the player is told what they are doing

Halfway across the meadow the ground rises, and this is the one moment the dream orientates you. The child tops
the rise and stops. **The haze thins** — the chapter eases its `haze` from 0.55 down to 0.1 — and the world opens
out as far as the far shore. Away to the north, the colt's family is **wheeling up a thermal**, a slow column of
cranes turning in the light, the way cranes do before they go on.

The colt calls to them. Not the distress call: lower, longer, twice, with hope in it rather than panic. Nothing
answers. The column keeps turning. After a while the child walks on and the haze closes again behind them.

No words, no marker, no objective text: you simply now know where you are going and what you are carrying. And
because the gathering lies the same way as home, it quietly sets up the ending, where it turns out you were
walking the child home the whole time.

## The fall, beat by beat

The moment the whole game turns on. It is staged deliberately and nothing about it is incidental.

1. The island is whole. The child climbs to the tree and looks out at the horizon.
2. **The skein comes over**, 40 units up — low enough to read as birds, not specks — on a bearing that takes it
   right over the child's head and on north without them. Music: a thin high phrase going away from you. The
   music begins pulling back from this moment (`hush` 0.55).
3. The camera plants itself at the child's shoulder and looks up past them. The player watches the sky **with**
   the child, never instead of them.
4. **The bird at the back of the V is the one that cannot hold on**, and it goes when it is directly overhead, so
   none of it happens off screen. The colt takes over from exactly where that bird was.
5. **The camera stands square on to the line of the fall** — on whichever side is clear of the tree — and snaps
   onto it rather than gliding, because by the time a slow camera arrived the fall was half over. It rides down
   with the colt so it is always centred, with the V receding above it, and lifts to look down once it is in the
   grass, where the grass would otherwise hide it.
6. **It falls for eight and a half seconds.** Not like a stone: at first it is still almost with them, sinking and
   falling behind, and only once it has lost the formation does the ground come up. Wings going the whole way,
   sagging each time it tries to climb and cannot. It calls, over and over, all the way down. Music is out of the
   way by now (`hush` 1) — the cries are almost the only thing you can hear.
7. It lands on the near side of the ridge, always in view. It tries three times to get up, each weaker, and stops.
   It keeps calling.
8. **The child does not move for three and a half seconds.** The player is left alone with it.
9. Then they run — and pull up short, four metres away. The last steps are walked. They stop, face it, kneel, and
   wait a beat while it looks at them. Only then do they gather it up. You do not charge at something that small.
10. From here they carry it, and the music comes back at sea, on the crossing, as an intermission.

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

The chain is in `ISLES` in `world/heightfield.ts`, written twice (TypeScript and GLSL) like the rest of the terrain.
Each island lies further north than the last with sea between, and the stretches shrink as home gets nearer.

| room | centre | size | sea before it |
| --- | --- | --- | --- |
| the still island | (−6, −14) | 60 × 44, its own hand-made shape | — |
| the island of lines | (14, −330) | 70 × 56, a low green whaleback | 216 |
| the meadow | (10, −880) | 340 × 300, the old rolling pasture, now bounded | 194 |
| the drowned village | (−10, −1440) | 210 × 175, nearly all of it under water | 85 |
| the dark wood | (−30, −1800) | 130 × 115, the smallest of them | 70 |
| home | (−45, −2120) | 190 × 165, one long hill and the cottage beyond | 40 |

The still island keeps the south-east cove at (8.5, 21.5). The last hill is at (−30, −2060) and the cottage at
(−70, −2124), so the sun now sets into open sea past the cottage: home is an island like all the others.

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
- **Music.** Layers join as the world comes back, fuller in the hills, thin and low in the wood, almost gone in
  the dark, whole at the end. Chapters can pull it back entirely with `hush` so a moment is heard on its own; the
  fall does this, and the music returns on the crossing that follows.
- **The colt's voice.** `peep()` in `audio/audio.ts`, fired by the `distress` and `calling` cues. Distress is high
  and panicky; calling out to the flock is lower, longer and hopeful. Kept for those moments and nothing else.
- **The player's wind stops during a scripted beat.** Chapters expose `scripted` for the beats the story plays out
  on its own. While it is set, `PointerInput.muted` puts nothing into the wind field at all: no chimes, no whoosh,
  no ripples on the water, no wind lines, and nothing the player does can blow the paper plane out of the scene.
  The pointer still tracks, and control returns the instant the beat ends. A scripted moment has to be allowed to
  land without the player accidentally performing over the top of it.

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
8. **Cloth on the wind, and the island of lines: built.** `world/lines.ts` and `story/lines.ts`; the island is
   cropped short so the washing is the only thing standing on it. Still to do: a billow curve so a lifted sheet
   keeps a belly instead of going edge-on, baskets and pegs and other things nobody left there, and a sun angle
   that does not leave the camera-facing slope in shadow. Original prototype note: the generalised cloth shader, poles and catenary lines, hung sheets that fill and snap, pieces that tear loose and fly. **Prototyped** (`src/world/lines.ts`, `?lines` hangs it over the still island). What it proved: a gust visibly lifts a whole *band* of washing as it rolls through, which is the effect the room is for. What it still needs: colours desaturated toward linen (the current palette reads as bunting, not laundry), a billow curve so a lifted sheet keeps a belly instead of going edge-on and disappearing, and above all its own island — over the still island's tall grass the lines are half-buried decoration, and they need bare, short-cropped slopes to be the subject.
9. **The island chain: built.** `ISLES` in the heightfield, the chapters sequenced in `story/journey.ts`
   (island → toLines → lines → toMeadow → meadow → toHome → home), the crossing generalised to take a route and a
   haze, the old hills chapter split into `story/meadow.ts` and `story/home.ts`, the dry-stone walls deleted.
10. **The crane: built.** `creatures/crane.ts` — a 16-bone rigged colt: three neck capsules that read as a tube,
    wings split into arm and hand so the fold tucks and the hand whips a beat behind in flight, feet that stay
    flat when planted and extend when trailing, eyes with catchlights. The palette is derived in **linear** space,
    which was the real cause of it washing out to cream: the renderer is `NoToneMapping` with a linear sun near
    2.7, so any albedo written as if it were sRGB clips. Falling now lags along the flock's line first so the gap
    in the V opens where you can see it, flaps in bursts with sinking between them, and banks and slews because it
    cannot hold a line. Remaining: the colt does not tilt to the terrain slope (no creature here does), and where
    it lands the island grass is taller than it is.

10b. **Superseded note from when it was half built:** `creatures/crane.ts` is a rigged colt (body, neck, head and bill, folded wings,
    two-jointed legs) driven by bone matrices, with fallen / carried / hooded / following states and a bond that
    only rises. `creatures/flock.ts` is the skein that goes over. The island chapter now runs the beat: the flock
    crosses once the island is whole, one bird cannot hold formation and comes down, and the child gathers it up
    and carries it from there. Still to do: the first glide on an updraft, the flight at the end, riding in the
    hood on the walks, and tuning — the colt still reads cream rather than cinnamon when backlit.

    **The fall is the moment the whole game turns on, so it is staged deliberately.** The skein comes over the
    child's head low enough to read as birds. The camera plants itself at their shoulder and looks up past them,
    so the player watches the sky *with* them rather than instead of them. The bird at the back of the V is the one
    that goes, and it goes when it is directly overhead, so none of it happens off screen. It takes eight and a
    half seconds to come down, wings going the whole way, sagging each time it tries to climb and cannot. It lands
    on the near side of the ridge. Then it tries three times to get up, each try weaker, and stops. The child
    stands still for two seconds and then runs. Music marks both: a thin high phrase going away for the skein, the
    same shape turned downward for the fall, and it does not resolve.
11. **The drowned village:** rooftops, spire, treetops, herons, the drift, the storm, losing the plane. Until it is
    built the last crossing sails straight over its mud banks without stopping.
12. **The dark wood:** light on the wind, the lost fledgling, finding and drying the plane.
12b. **The long crossing:** dolphins running with the boat, whales, first light on open water. The exhale after
    the dark. Needs a dolphin pod in `fx/sealife/` alongside the existing whale and fish.
13. **More nonsense:** baskets and pegs on the island of lines; a red door standing in the grass; chimneys with no
    house; a bed made up in the meadow; a line strung between two rocks at sea; a piano at the tide line the wind
    plays. The point is that none of it makes sense and none of it is explained.
14. **The turn of the year:** age the palette island by island, late autumn through to a frozen night.

## Testing shortcuts

`?chapter=lines|washing|meadow|summit` start later in the story (`crossing` and `hills` still work as aliases); `?dusk=0..2` overrides the time of day; `?shower=0..1` forces the rain; `?debug=wind` draws the wind field.

## Pacing

Measured by a scripted playthrough on 2026-09-16, before this redirection: island about 3 minutes, farewell half a minute, crossing just under 2, walk inland 8, ending 2 — about 16 minutes at 59 fps average. The target for the six-room arc is about 18 minutes, with no room longer than about 5.
