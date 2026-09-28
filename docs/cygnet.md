# The cygnet

The child's companion and the game's co-star: a swan cygnet that fell out of its family's V on the first island.
How it appears in each room is in `docs/chapters.md`.

## Jeremy's words (verbatim)

On the companion becoming a swan cygnet:

> "yea i think a swan cygnet will work a lot better. Ugly duckling is exactly the feel i think this should go. As
> the child's companion, the swan cygnet is a co star in this game so all it's animations, sounds, behaviour, poses,
> how it flaps, falls/tumbles from the sky at the start, how it climbs ontop of the child, is carried by the child
> need to be super high quality, seamless and beyond reproach. It should feel like another real character with
> it's own emotions, thoughts, and liveliness. Especially with teh way it interacts with the child, it should look
> completely seamless and cohesive. This is a big piece of work that requires extreme attention to deail"

> "I'm also thinking that there could be a nice moment in the game where the little swan cygnet has their brave
> moment to swim by themselves next to the child, maybe a bit later in the game where it makes sense. Have a think
> as well about whether the swan cygnet should react to the players 'wind'"

On the recovering wing, approved with "beautiful! yes lets do this":

> "what if we give the cygnette a bandaged wing from it's fall in the starting island. And then later on during the sleeping scene, it's only then that the cygnette confronts its fears and somehow manages to have the bandage come off so that it can do it's flight later on? Instead of the flight practice happening in the meadows, it can be swim practice or something?"

## Who it is

The ugly duckling: a grey, clumsy thing that fell out of a line of white birds. Nobody says it; the ending says it
back, when the family that comes for it is white and the first white is showing at its own wing edges. Cygnets
ride on their parents' backs, so riding on the child is what the species does with the one it trusts. Swans need a
long pattering run to take off, which gives every attempt a shape a player can read.

**Voice.** It is silent except in distress and when it calls to its family: the fall, the pond, hiding in the dark
wood, the one unanswered call on the sleeping island, a questioning peep on the stairs, and the call at home that
is answered. Every call is echoed by three small cream strokes above it (`fx/call-marks.ts`,
`tuning.cygnetCalls`). Adult swans are other animals and may be loud: bugling and the whistle of their wings.

## Its arc

- **The wing.** The wind the player woke puts it out of the sky with its left wing bent back. The child gathers it
  and winds a linen wrap round that wing (`creatures/cygnet/bandage.ts`: one continuous strip fitted to the wing's
  geometry and joint weights, wound by `Carry.gatherUp(..., true)`). It favours the wing early, and its ordinary
  stretches reach further island by island. At the sleeping island's summit it takes the loose end in its bill and
  unwinds it; only then can it fly. `WingBandage.flightReady` gates flight and practice hops independently;
  `story/wing-care.ts` reconstructs care and healing from the chapter and checkpoint, so direct starts and old
  saves agree (`tuning.wingCare`).
- **Flight.** It cannot fly on the early islands. Its first flight is the sleeping island's glide back to the child
  on the player's wind; its last is at home, where the player's updraft lifts it to its family. Flight is the
  player's verb: a gust only makes it hope and open its wings (`tuning.colt.gustLift`); an updraft held under it
  lifts it (see `docs/contracts/wind.md`).
- **The wind.** The child never acknowledges the player; the cygnet does. It looks into the wind, up to where a
  gust came from, as if someone were there. Afraid of it first (a gust flattens it and it patters to the child's
  feet), then curious, then asking for it, and at home trusting it to hold it up. The down ruffles along the real
  wind, a hard gust makes it brace, a harder one bowls it over a step. Never a torment: fear from the player's wind
  is capped and spent once per gust and always ends at the child; a player who keeps blowing on it gets a bird that
  hides, not one that suffers.
- **Water.** It paddles three sheltered stretches beside the little boats, swims after its family on the meadow
  pond and comes back to the child's hands, and makes its brave swim on the open sea, going over the side while the
  child does nothing but stay, and swimming in the wave along the hull (`CrossingOpts.swimAt`, `story/crossing.ts`).

## Where it rides

- **In the satchel on the child's back** on the walks: the camera behind her always sees it, and it can look back
  at the wind. It sits across the bag, facing out past her left shoulder, its head beside the hood.
- **Across her chest in both arms** for the tender moments and in the boat; **in her lap** sitting down.
- **On its own feet** wherever a room gives it play: the birches' leaves, the stairs (it goes up first), the sky
  mirror, the ends of the little boats' pools.
- It gets into her hands by itself: she kneels and holds them out low and still, and it hops up. Nothing is done to
  it. It is never teleported between places; every move is a shared moment.

## How it is built

**Contact is one system.** Sockets on the child's rig (`cradle`, `satchel`, `shoulder`, `lap`) carry every lean,
breath, crouch and jolt of hers to the bird, with a jostle spring on top as the passenger's lag. The child has
elbows and two-bone arm IK (`reachFor`, `reachLocal`), so a mitten goes on a point of the bird. Shared moments
(`companion/carry.ts` on the shared timeline in `companion/duet.ts`) drive both characters from one clock with
anticipation and settle: `gatherUp`, `setDown(onDone, facing)`, `stow`, `unstow`; the fear of the fall and of the
dark wood turn up the gather's hesitation. `cygnet/ride.ts` places it: on the ground, in a seat, in the hands, or on
the surface path over her shoulder, all read live.

**A mind** (`cygnet/mind.ts`): each frame a few things compete for its eye (the child's face, her hands coming
toward it, the plane, the nearest creature, a gust, the flock, the light in the wood), and the winner gets a real
look, eyes and head first, body last. After anything new or frightening it looks at the child's face, and what she
is doing decides how it settles: the bond made visible. Continuous feelings (fear, curiosity, contentment,
tiredness, cold, longing) set posture, tempo and which acts are allowed, and a scheduler picks one act at a time
(preening, nibbling, stretching, yawning, shaking and wagging, chasing, investigating, delving into leaves).
`cygnet/pose.ts` turns drives into bones.

**A body to be looked at closely** (`cygnet/body.ts`, `parts.ts`, `shader.ts`, `wings.ts`): pear-shaped, low to the
ground, a soft neck long enough for an S, a round head with a long flat dark bill, bare lores and big dark eyes,
short legs set well back, outsized dark webbed feet, downy arm-wings with no quills folded into one soft teardrop,
a stub tail that wags. Four neck bones, spread webs, a tail spring, a breast bone for breath. Down is a soft shell
that fluffs with cold and contentment, lies sleek with fear (`sleek`), goes soaked in water (`wet`), and ruffles in
a gust; `grown` brings white to the wing edges late in the journey.

**Locomotion by distance, not time** (`cygnet/gait.ts`): feet plant and stay planted, the body rolls over the
standing foot and the tail counters (the waddle); the head holds steady between steps; hurrying is a patter with
wings out; it turns almost on the spot. `cygnet.ts` holds the states and mechanics: the fall, the run-up and
face-plant, the glide, clumsy landings, perching, swimming (`swimTo`, `ashore`, `swimLevel`, `swimPlay`) and
leaving.

**The adults** (`creatures/flock.ts`, `SwanFlock`): white, necks straight out, black feet trailing, articulated
wings with a slow deep beat. They rest on the meadow pond and leave in a staggered pattering take-off; at home they
pass across the sun, wheel in a circuit (`tuning.swanArrival`) and go north in a V that the cygnet joins at the
tail station (`goOn`, `tuning.swanDeparture`). The skein on the first island reserves the cygnet's own body in its
last station.

**Sound** (`audio/foley.ts`, driven by `cygnet.heard` events from `main.ts`): feet on sand, grass and planks, wing
flutter, the whole-body shake, the thump and skid of a bad landing, down against the coat, the plunge and paddle;
the swans' bugle and wingbeat.

## Rulings

- Pale, not slate: a warm taupe-grey down that stays pale in shade and at distance (the shell rim, not the palette,
  is what reads it pale). "Too pale" is also wrong.
- Snug in the satchel: it looks comfy and snuggled in, and nothing of it pokes out through the bag or shows
  through the child from the camera behind (its grass depth bias `uNudge` is off whenever it is carried).
- Half lost in the grass is fine for a fledgling that cannot fly; where the child goes is the signal.
- When the player is asked to help it fly, it must actually fly for the circling they do; it never wanders off
  instead.
- It never flies before the sleeping island, and never on the stairs.

## Checking it

`?chapter=stage` (`src/story/stage.ts`) stands it and the child on open ground with a free camera; from a
`tools/play.mjs` eval step `__game.story.current.play('<name>')` plays any state, act (`act:<name>`) or shared
moment, and `.look('<view>')` picks a view. `__game.probe.report()` (`companion/probe.ts`) gives the worst pop,
turn, hand gap and foot slip since `probe.reset()`. `node tools/cygnet-gates.mjs` runs them all against limits:
body jerk under 0.02 units/frame², turn under 0.07 rad/frame, mitten gap under 0.06, never below the ground. Every
pop found so far came from a pose weight that switched instead of easing: ease every new weight.
`tools/wing-care-check.mjs` checks the wing's history and one-flight gates.

## Open

- `cygnet-gates` misses by a few thousandths from run to run (the gather's jerk and turn); nothing visible, not
  yet traced.
