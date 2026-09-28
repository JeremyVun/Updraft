# The journey

The vision, Jeremy's brief in his words, the story and the principles every room answers to. It outranks convenient
shortcuts. How each room plays: [chapters.md](chapters.md). Island positions and routes:
[contracts/world.md](contracts/world.md). What is left to do: [roadmap.md](roadmap.md).

## Jeremy's words (verbatim)

The brief that started the journey (2026-09-16):

> "I love your artistic thinking. Please explore your ideas and continue expanding ontop of this beautiful experience you've made. small cute animals and birds. I'd love to see the story you tell with the traveller. [...] The grass visuals and effects are truly amazing, and i'd love to see the adventure go to a place where it's like those endless beautiful green rolling irish hills."
>
> "[...] you may also use sub agents however you feel best to achieve your artistic dream of making dreamy, meditative game."

The redirection that gave the game its shape:

> "My vision for the game is that there is a very dream like narrative. you start on the island. The player doesn't know how they got there. They touch the screen and discover the wind effect. however it's still not clear what they can do or what the game is about. They see the child following the plane around, but they don't yet know that this is the primary way of playing the game. So maybe they randomly play around with the plane. there needs to be some things on the island that the player has a good chance of accidently leading the child into which cause some kind of small effect or event to happen. However, the primary subject should be the boat and we need to set it up so that the player can intuitively learn or understand that they need to lead the child to the boat. [...]
>
> Along the way home, the child makes friends with some animals that keep them company. There should be simple and natural things that happen in the game that cause the bond between the child and the animal to grow stronger. [...]
>
> At a high level in my head, I'm thinking that the journey should be filled with ups and downs, and throughout it all a profound sense of being lost and nostalgia, trying to find home with his animal friend. Maybe we can do something where the animal friend is also a little child animal that is also trying to get home, and so they have to get home together. Sort of like a heroes journey even for the child, where they get drawn into a world larger than they thought and have to face the darkness in their dream and get through it alone with just their animal friend/s. Maybe facing their fears, and then helping their animal friend face their fears. If you were dreaming as a child, how do you think your dream would play out? What would stay with you even after you woke up and make you feel like you grown up and become a different person?"

On the companion: "i'd eventually like to add another animal later one and make this a much more involved and
immersive experience." It is a swan cygnet, "a co star in this game" (his full brief is in [cygnet.md](cygnet.md)).

On voices: "there shouldn't be any voices or anything in the game. No sounds from either the child or the baby crane.
There can be noises from other animals and environmental sounds, but never any voicing from the two main characters."

On the season: "i dont think the still island should start in dead winter. It should be looming. thats why the
cranes are migrating. It's why they have to find their way home before it gets too cold and dark."

On legibility:

> "when i say sweating the details, i mean stuff like making sure that the child and the characters are still legible and visible at all times. [...] It's not enough to think about it programmatically, we have to think about things from the perspective of what a child playing this game might see and feel."

On the camera:

> "it'd need to feel really nice and seamless throughout the entire game. Almost like there wasn't an authored system in place. We must maintain the seamless, dreamlike state as much as possible while also making sure we try to frame beautiful moments, scenes, and camera angles"

## The dream

A dreamy, meditative game about being the wind. A Ghibli afternoon: soft light, slow time, small kindnesses. The
player never fails, never waits on a timer, never reads a word during play. Every gesture is answered by the world.

What the journey is about: **something small trusted the child, and the child went into the dark first so it
wouldn't have to.** That is the moment a kid feels changed: not being brave for yourself, but being brave in front of
someone smaller. And then letting go of what you loved and being glad.

- **Beauty first, and beauty from simulation.** Light, colour and motion come from shaders and the live wind, not a
  pile of assets. Every new thing must match the grass and the golden light; if it doesn't, it isn't finished.
- **Wordless, and almost voiceless.** No text during play. The child never makes a sound. The cygnet is silent except
  at a handful of critical moments (distress, calling to the flock, a small questioning peep), so those few cries land.
  Other animals and the world are as loud as they like. Meaning is carried by light, colour, music, the child's body
  language, where the child looks, and the drawing on the paper plane.
- **Cursor movement is the only verb.** Moving makes a gust; tracing circles raises an updraft. There is no
  press-and-hold. The player pushes what they see: wind reaches what is under the cursor on screen.
- **Never let the player lose the thread.** The subject is always in frame, enforced rather than hoped for. A player
  who stops understanding what to do is the only real failure state this game has.
- **The plane is the signpost.** It leans toward wherever the story wants the player next, harder the higher it is.
  Over water it turns for land, and a plane that comes down on the sea lifts itself home. Nothing the player has to
  retrieve, ever.
- **Nothing is lost, nothing is failed, nobody is stranded.** Things drift home and the child waits. A stalled player
  gets an invitation (a drawn gesture that never supplies wind), never a timeout that solves the beat for them.
- **Teach by accident.** The player discovers that they lead the child rather than being shown it. Everywhere the
  child arrives, something small and delightful happens.
- **Calm pacing.** Beats wait for the player; transitions are slow and continuous. The camera never jerks and every
  move has an intention; scenery gets a glance along the path, never a stop-the-world pan.
- **Dream logic, not explanation.** You never learn how you got here. Things recur in the wrong place and nobody
  remarks on it.
- **The dream is manifesting home.** Every island holds a piece of home, out of place and with nobody in it: washing on
  the line, a red door, toy boats, a piano in the grass, a swing, a staircase, a village under the water, a bed on a
  hill. That is where the nostalgia comes from, and why the real cottage at the end lands.
- **Nowhere real.** No country is named or recognisable. Rolling green, yes; dry-stone walls and chalets, no.
- **Nothing long and straight lies across the route without a visible way through on the route.** A wall, fence or
  line across the path says "go round"; one along it says "this way". The worn path, the plane's lean and the gaps agree.
- **The player never sees the next island.** A veil (`uVeil`, set by each chapter's `haze`) dissolves the world past a
  distance, and island mist hides a destination until the boat is close. A crossing shows only the room it leaves and
  the room it reaches.

## The spine

**The child isn't travelling home. The child is taking a lost fledgling to its family, and only at the very end does
the player find out they were walking home the whole time.**

When the still island comes back to life, a skein of white swans crosses toward the north, and a winter gust tumbles the
smallest out of the V. The child picks it up, wraps its wing, looks at the boat, and pushes off.
It gives the player a wordless goal, the boat a reason to exist, and north a meaning, and it makes the ending a reveal:
the drawing opens and it is a white cottage with a red door, in the valley below.

Two lost children: one who can't find home, one who can't fly. Both fears are faced, and the player is the answer to
both, because flight is the player's verb. The cygnet's wing heals over the early islands; it goes up the stairs into
the cloud first; it is frightened out of hiding in the dark wood and found by the light the player makes; it swims
beside the boat by itself; it glides back to the sleeping child on the player's updraft; and at the end, held up by the
player's wind, it flies, and the flock comes down through the afternoon light for it.

## The year

Winter is coming, not gone. That is why the swans are flying and why the journey has a clock without a timer. The
season deepens island by island and never goes back: late autumn on the still island to the frozen night at home
(each chapter names a `season`, eased between rooms like the sky). The grass keeps its loved green and ages toward
gold and seed. Light can return without reversing the season: the sleeping island earns morning, the sky mirror
suspends time, and home holds the afternoon until the child walks down to the door.

## The story

Every room is an island bounded by sea, so you always see its edges and know you are getting somewhere. Crossings vary:
some are short blind hops, and the long sea crossing earns its length as the exhale after the worst of the journey.
The order is `ORDER` in `src/story/journey.ts`; each room has its section in [chapters.md](chapters.md).

1. **The still island.** Grey, late autumn, no wind. The first gesture is the first breeze in a long time; colour
   comes back where the wind and the plane go, and when the island is whole the whole frame lifts at once. The
   skein, the gust, the fall; the child carries the cygnet to the boat.
2. **The island of lines.** A whaleback swallowed in washing: overwhelmed, not vast. Curtains of sheets part to the
   player's wind, the family's three garments reach for each other, and a red door opens onto another shore.
3. **The little boats.** Toy sailing boats in linked pools; the player learns to fill a sail, the cygnet swims among
   them, and their own boat waits among the toys.
4. **The meadow.** The last warm afternoon, and the island asleep. The wind plays a piano in the grass and the music
   wakes the meadow; over the brow the swan family rests on a pond and leaves north as the child comes.
5. **The birches.** Deep autumn. Gusts strip the gold, a swing waits, and an impossibly long red scarf tangled through
   the trees is freed to become the boat's sail.
6. **The stairs in the clouds.** Bedtime: a staircase climbing into cloud. The cygnet goes up first. Above the cloud,
   the last sun of the year; then down into the mist ([stairs.md](stairs.md)).
7. **The drowned village and the storm.** A dusk drift between rooftops; the air dies and the player is the wind in
   the sail; a lighthouse; the storm takes the paper plane.
8. **The dark wood.** Night and the first winter storm. The player's updrafts breathe embers alight; the child walks
   as far as there is light; the cygnet, frightened into hiding, is found by putting light on it.
9. **The sleeping island.** The child falls asleep and the player guides the bird: a feather, a winter climb, a
   ribbon tugged free, morning let in, and the bird's first glide home to the child.
10. **The sea.** The long crossing at sunrise: dolphins, a whale, and the cygnet's brave swim.
11. **The sky mirror.** A flat of still water; bubbles skim fallen star reflections and lift the lights back into the
    sky.
12. **Home.** The last hill: the cygnet tries, the player holds it up, the family comes down and it flies. The child
    unfolds the plane to the drawing of the cottage below, lets it go, and walks down to the red door at night.

## The companion

A general companion system, not a one-off swan, because more animals are meant to join. The cygnet is the first. Its
bond only rises and shows in behaviour, never a meter: distance kept, how often it looks at the child, whether it
rides or walks, whether it comes when the child stops. It rises from things the player causes or witnesses: being
carried and set down safely, sheltered, lifted by the wind, frightened with the child staying, lost and found.

It has a second bond, with the wind, which is the player: afraid of it, then curious,
then asking for it, and at the end trusting it to hold it up. Later companions get one arc of the same shape: one
fear, faced once, caused by the player. The build: [cygnet.md](cygnet.md) and the child in [child.md](child.md).

## Systems the story is built from

- **One wind field** under everything that moves ([contracts/wind.md](contracts/wind.md)).
- **Life**: a field recording how alive the land is. Only the still island is grey; everything beyond
  `LIVING_BEYOND` is living before the child arrives, except where a room holds its colour back as a beat the
  player causes (the meadow).
- **Time of day, season, haze and rain** follow the chapter and are eased by `main.ts`, so a chapter change is never
  a cut in the sky.
- **Scripted beats mute the player's wind** (`scripted` on the chapter, `PointerInput.muted`) so a moment lands
  without the player performing over it; the pointer keeps tracking and control returns when it ends.
- **Invitations**: the drawn gusts and spirals that show a stalled player the gesture ([contracts/wind.md](contracts/wind.md)).
- **Departure kites**: the same paper kite flies beside the boat at every departure, so the player learns to look for
  it (`story/departure-kites.ts`).
- **A mood per room**: every chapter names a `music` mood, and moods glide into each other so a room change is a
  modulation, never a new track ([contracts/audio.md](contracts/audio.md)).
