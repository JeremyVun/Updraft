# The cygnet

The companion becomes a swan cygnet and is rebuilt as the game's co-star. Jeremy's brief is verbatim in
`journey.md` ("On the companion becoming a swan cygnet"). Work happens on branch `cygnet` in
`/private/tmp/updraft-cygnet`. When it ships, the lasting parts of this file fold into `journey.md` and this file
is deleted.

## Who does the work

Jeremy's global model routing sends visual work to Astra or Opus 5. Asked whether that binds this feature, he left
the decision to the owning session (his words are in `journey.md`). Decision: the owning Fable session models,
animates and reviews its own captures, because this bar is only reached by a tight look-and-fix loop held by one
owner; a fresh Opus 5 agent gives an independent visual verdict at each milestone in the build order, as one
bounded parcel with no follow-ups; Jeremy gives the final one. The global rules are left as they are until this
feature shows whether they should change. Product copy is not involved.

## What the story gains

The ugly duckling: a grey, clumsy thing that fell out of a line of white birds. Nobody says it, but the ending
says it back: the family that comes down out of the night is white, and the first white feathers are showing
through its down by then. Cygnets ride on their parents' backs, so riding on the child is what the species does
with the one it trusts. Swans need a long pattering run to take off, which gives every flight attempt a shape a
player can read: run, slap, lift, or run, slap, tumble.

What changes in the story text: "cranes" become swans; the skein is white; the meadow-crest "wheeling up a
thermal" becomes the family **resting on the water of the far bay**, white on dark water, heads up, before they
go on (swans do not thermal); the reunion keeps its low circle over the hill, which is how swans come round to
land. The voice rule is unchanged: the cygnet is silent except in distress and when it calls to its family.
Adult swans are other animals and may be loud: bugling, and the whistle of their wings.

## Why the colt fell short, from the code

- The bird and the child never touch. `Traveller.pickUp` is a 0.9 s bow with straight arms; the colt then lerps
  through the air for 0.5 s to a fixed offset (`ARMS` in `crane.ts`). Neither knows where the other's body is.
- The ride points (`armsPoint`, `hoodPoint`) are computed from the child's position and yaw, not from the rig, so
  the bird does not inherit the child's lean, crouch, sit, breath or bob; the bob is re-added by hand.
- The child has no elbows, so it cannot hold anything in its arms; `cradle` clamps one straight arm.
- The climb into the hood is a bezier through a shoulder point. The child does not react to being climbed.
- Behaviour is a set of independent timers (blink, glance, preen, peck). Nothing connects noticing to reacting,
  so it reads as idling, not as thinking.
- Locomotion advances a stride phase by time, so feet slide; a waddle needs the body to roll over a planted foot.

## The design

### 1. Contact is one system, not two animations

- **Sockets on the child's rig**, parented to the bones they belong to: `cradle` (crook of both arms on the
  chest), `shoulder`, `hood`, `lap` (sitting, and in the boat), `palms` (midpoint of the two mittens). The cygnet
  rides a socket's world matrix, so every lean, breath, crouch and jolt of the child reaches it for free. The
  existing jostle spring stays on top of that as the passenger's own lag.
- **Elbows and two-bone arm IK for the child**, so a mitten can be put on a world point: under the cygnet's
  belly, on its back to steady it, over it in the rain.
- **Contact markers on the cygnet**: belly-left, belly-right, back, breast. Hands aim at markers; while it is in
  the hands, the cygnet's root is driven by `palms`. One side always leads and the other is solved from it, so
  they cannot drift apart.
- **Duets**: a shared timeline that drives both characters from one clock. Each is authored as beats with
  anticipation and settle, and each has a bond-dependent variant where it matters.
  - *Gather up* (first time): child kneels, offers both hands low, waits. The cygnet looks at the hands, at the
    face, shuffles back, then lets itself be scooped. Feet paddle the air on the way up. It is held out a moment,
    they look at each other, then it is brought in to the chest and the arms close.
  - *Pick up* (later): the cygnet sees the kneel coming, runs the last steps and climbs onto the mittens itself.
  - *Set down*: crouch, hands to the grass, it steps off, shakes, looks back up.
  - *Up into the hood*: it scrabbles up the chest to the shoulder, wings out for balance; the child drops that
    shoulder, tilts the head away and brings the far hand up under its rump to boost; it tips head-first into
    the hood, turns round inside it, and its head comes up beside the child's ear.
  - *Down from the hood*: backs out onto the shoulder, the hand comes up, it steps onto the mitten, is lowered.
  - *Small ones while riding*: nuzzles under the chin and the child's head tilts to it; child's free hand strokes
    its back when it shivers; the coat flap comes over it in the shower; it falls asleep and the child slows and
    looks down; it startles and burrows into the collar; it cranes round the hood to watch what the child watches.
  - *The fall's aftermath* and *finding it in the dark* reuse gather-up with the fear turned up: it flinches from
    the first reach, and lets the second one land.

### 2. A mind: attention, feeling, then action

- **Attention.** Each frame a few things compete for its eye: the child's face, the child's hands when they move
  toward it, the paper plane, the nearest creature (`cast.nearby`), a gust crossing it, the flock, the light in
  the wood. Saliency is novelty × nearness × feeling. The winner gets a look with a real saccade: eyes and head
  lead, neck follows, body last.
- **Social referencing.** After anything new or frightening it looks at the child's face, and what the child is
  doing decides how it settles. This is the cheapest and strongest cue that it has thoughts, and it is the bond
  made visible.
- **Feelings** are a small continuous state: fear, curiosity, contentment, tiredness, cold, longing. They set
  posture (neck height and curve, down fluffed or sleeked, wing droop, tail), tempo (blink rate, breath, how
  quick its head moves) and which behaviours are allowed. Bond shifts all of them toward trust.
- **Behaviours** are chosen by a scheduler from what the feelings allow, one at a time, each with anticipation
  and follow-through: preen (breast, wing, back), nibble grass, dabble at wet sand, stretch a leg and wing
  together, yawn, tail-wag after every shake, sit and tuck, chase the plane a few steps and lose interest,
  investigate a butterfly and flinch when it moves, flatten to a gust then lean into it with wings half open.
- Per room: it patters through the washing on the island of lines and is startled by a sheet; it rides high and
  watches the meadow go by; it goes quiet and low over the drowned village; it hides in the wood; it sleeps on
  the long crossing; it cannot keep still at home.

### 2b. The wind is somebody, and the cygnet is the only one who knows

Yes, it reacts to the player's wind, and the way it reacts is its arc. The child never acknowledges the player.
The cygnet does: it looks **into** the wind, up to where a gust came from, as if someone were there. It has two
bonds, one with the child and one with the wind, and the second is what the ending spends: at home it opens its
wings and waits for the player, because by then it trusts them to hold it up.

- *Afraid of it* (first island, the lines): a gust flattens it, it flinches and patters to the child's feet, and
  the child shields it. A sheet snapping beside it sends it under the coat.
- *Curious* (the meadow): it snaps at wind lines and petals going past, leans into a steady wind with its eyes
  shut and its down streaming, and half-opens its wings to feel the lift. Its first glide happens here.
- *Playing* (after the wood): it asks for it. A look up, wings out, a little run, a look up again.
- *Trust* (home): it stands in the pressed grass, opens its wings, and waits.
- Always: the down ruffles along the real wind; a hard gust makes it brace, and a harder one bowls it over a step,
  after which it shakes and looks indignant. Riding, it squints and tucks into the collar.
- Never a torment: fear from the player's wind is capped and spent once per gust, it always ends at the child,
  and a sheltered cygnet only ruffles. A player who keeps blowing on it gets a bird that hides, not one that suffers.

### 2c. The brave swim

It has never been in the water: it fell before it ever came down on any. On the first crossings it watches the
sea from the child's arms, stretches down toward its own reflection over the gunwale and pulls back. In the
drowned village it will not look at the black water at all.

The swim belongs on **the long crossing**, the exhale after the dark wood, at dawn. The child went into the dark
first so that it would not have to; now it does something brave with the child watching. Dolphins come alongside.
It climbs onto the gunwale, looks at the water, looks at the child, and the child does nothing except stay. It
goes in badly, bobs up like a cork, shakes its head, and paddles. Then it is swimming beside the boat, in the
boat's lee, neck up, and the child hangs an arm over the side near it. The player is the wind in the sail, so how
hard they blow sets the pace: too hard and the boat draws ahead, it paddles flat out with its wings half up, and
the child looks back; ease off and it draws level again. Nothing fails. When it tires it comes to the side and is
lifted in, soaked and proud, and is dried under the scarf. At home it swims the last stretch to the beach beside
the boat, which is the first time the player sees it go somewhere on its own and the quiet promise of the ending.

### 3. A body built to be looked at closely

- Cygnet proportions drawn the way a child would: pear-shaped body low to the ground, a soft neck long enough to
  make an S, a rounded head with a flat dark bill and big dark eyes, short legs set well back, outsized dark
  webbed feet, downy arm-wings with no quills, a stub tail that wags. Pale grey down, lighter on breast, cheeks
  and belly. No crest: the cowlick is what read as a comb. By the last island, white shows at the wing edges.
- More bones where the character lives: four in the neck, spread on the webs, a tail spring, a breast bone for
  breath and squash. Down is a shader effect: a soft rim shell that fluffs with cold and contentment, sleeks
  with fear and rain, and ruffles in a gust.
- **Locomotion driven by distance, not time**: feet plant and stay planted; the body rolls over the standing
  foot and the tail counter-swings, which is the waddle; the head is held steady in the world between steps.
  Running is a patter with wings out. It trips on rough ground sometimes, when nothing else is happening.
- **Flight vocabulary**: the fall (holding the line, sinking, bursts that pitch it up, a dropped wing, a last
  tumble, a chest-first skid through the grass, stillness, then the first breath); trying (run-up, slapping feet,
  a hop, a face-plant, a shake, a look at the child); gliding on the player's wind (rigid, amazed, wobbling,
  looking down); landing (feet forward, skid, tumble, sit, look back); leaving (the run becomes flight).
- The adults (`flock.ts`): white, neck straight out, black feet trailing, articulated wings with a slow deep
  beat, in a V; on the water at the meadow's far bay; circling low at the end.

### 4. Sound

Foley everywhere, voice almost nowhere. Feet on sand, grass and boat planks; wing flutter; the whole-body shake;
the thump and skid of a bad landing; down against the coat when it climbs. The two existing cries are re-voiced
as a cygnet's thin whistle. Adults: distant bugling and wing whistle as the skein passes and at the reunion.

### 5. Proving it

- **A stage**: `?stage=cygnet` stands the child and cygnet on bare ground under the game's light with a close
  camera, and plays any state, behaviour or duet by name at any speed. `tools/stage.mjs` captures contact sheets
  and slow-motion clips from front, side and the game camera's distance.
- **Numeric gates**, run headless over every state and every transition between states:
  planted-foot slip under 1 cm; mitten-to-marker distance under 2 cm during contact; no cygnet vertex inside the
  child's coat profile beyond 1 cm; no bone angle or root position jump above a threshold between frames
  (no pops, ever); never below the ground; never out of frame in a glide.
- **Visual verdicts** at real camera distance and close up, per the model-routing rules, then Jeremy's.

## Build order

1. Rename and re-seat: `Crane` → `Cygnet`, `CraneFlock` → `SwanFlock`, `colt/` → `cygnet/`, `cast.cygnet`; story
   and docs text; no behaviour change. Stage and gates scaffold.
2. Child rig: elbows, arm IK, kneel, sockets. Cygnet rides sockets. Gates for contact and penetration.
3. Cygnet body, down shader, palette; adult swans.
4. Locomotion, swimming and flight vocabulary.
5. Mind: attention, feelings, scheduler, social referencing, the bond with the wind.
6. Duets, in story order: gather up, set down, hood, the small ones.
7. Sound.
8. Story changes: the family resting on the far bay at the crest (Jeremy's pick), white skein, reunion, the brave
   swim on the long crossing and the swim ashore at home; per-room behaviour.
9. Full playthrough, visual verdicts, fold this into `journey.md`, merge.
