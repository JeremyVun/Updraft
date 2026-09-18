# The cygnet

The companion becomes a swan cygnet and is rebuilt as the game's co-star. Jeremy's brief is verbatim in
`journey.md` ("On the companion becoming a swan cygnet"). It is **on `main`** (merged 2026-09-18, `eb1d7c6`); the
parcels still open are under Status. When it ships, the lasting parts of this file fold into `journey.md` and this file
is deleted.

## Who does the work

Jeremy's global model routing sends visual work to Astra or Opus 5, and says why: to keep the expensive grind of
iterating on a look off Fable, while a Fable lead still looks at results, accepts or rejects them and writes what it
saw into the next brief. Asked whether that binds this feature, Jeremy left the decision to the owning session (his
words are in `journey.md`). Decision:

- **The owning Fable session** holds the design and this document, builds the systems (the child's arm IK and
  sockets, the duet timeline, attention, feelings and the behaviour scheduler, locomotion and flight mechanics, the
  wind relationship, sound, the stage and the numeric gates), wires the story, looks at a handful of captures at
  each checkpoint, and decides what is accepted.
- **Opus 5 agents** do the visual production: the model, the down shader and palette, the adult swans, and the
  pose and timing passes that are judged by eye. Each gets one complete bounded parcel, its own worktree forked
  from `cygnet` under `/private/tmp`, its own dev-server port and `/tmp` prefix, and is never sent a follow-up; a
  further pass is a new agent with a new brief that carries the findings forward.
- The seams between the two are small files with a stated contract: `cygnet/body.ts` (skeleton, rest space,
  `HOLDS`), `cygnet/shader.ts` (`Look`, `cygnetMaterial`, `applyLook`), `cygnet/wings.ts` (`WingPose`, `poseWings`).
- Jeremy gives the final verdict. Product copy is not involved.

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

## Status (update as it moves)

**On `main` since 2026-09-18** (`eb1d7c6`), merged on top of the rooms (birches, kite and pinwheels, piano). The
session that built it died; a new session took over from this file. What the merge decided:
- **The crest is the close scene, with swans.** `main` had since rebuilt the crest as one unmissable scene for the
  cranes (heard first, the family wheeling up right in front of the rise, stringing out north, the set-down
  straight after in the same place: `tuning.crest`). This branch had the family resting on the far bay (Jeremy's
  pick, because swans do not ride thermals), which from the real crest was a few white pixels. Merged: the close
  scene, played by the swans (`SwanFlock.circle(..., climb)` and a new `SwanFlock.goOn`, which hands each bird a V
  slot and lets it ease across). **Open for Jeremy:** whether a resting-then-lifting family can or should be staged
  close instead; the swans agent was asked for an opinion.
- Gusts count as lift under the cygnet (`tuning.colt.gustLift`), as they did for the colt: cursor movement is the
  only verb. The home summit's `coax` swirl follows the cygnet.
- The birches carry it in the satchel (`carry.stow()` on setting off).
- Gates on `main` after the merge: the same marginal misses as before (gather jerk 0.0211, gap 0.0649; down jerk
  0.0241, gap 0.0678; walk turn 0.1018). The crest scene runs end to end at 60 fps with no console errors.

In flight (2026-09-18), Opus 5, one parcel each, forked from `main`: **look pass two** in
`/private/tmp/updraft-cyg-look2` (branch `cygnet-look2-b`, port 5263) and **swans polish and the crest** in
`/private/tmp/updraft-cyg-swans2` (branch `cygnet-swans2-b`, port 5264). **Pose and timing** follows once look pass
two has landed, because both touch `traveller/body.ts`.

The rest of this section is the record from the branch.

Done on `cygnet`:
- Names; the QA stage (`?chapter=stage`, `story/stage.ts`: `play(name)` including `act:<name>`, `shore`, `swim`;
  `look(view)`; a free close camera).
- One smooth skin on a 21-bone skeleton (`cygnet/body.ts`), authored in one rest space, two-bone skinning.
- The child: elbows, two-bone arm IK (`reachFor`, `reachLocal`), kneel, lean, head tilt, sockets, the plane tucked
  in the satchel while the arms are full (`traveller/body.ts`, `traveller.ts`).
- Placement (`cygnet/ride.ts`): ground, seat, in the hands, the surface path over the shoulder, all read live.
- Shared moments (`companion/carry.ts` on `companion/duet.ts`): `gatherUp`, `setDown(onDone, facing)`, `stow`,
  `unstow`; every chapter now uses them instead of a bow and a teleport.
- The brain/body split: `cygnet/mind.ts` (attention, feelings, acts, the bond with the wind), `cygnet/pose.ts`
  (`Drives` in, bones out; the file a pose pass owns), `cygnet/gait.ts` (planted feet at a walk, a patter when it
  hurries, steps when it turns), `cygnet.ts` (states and mechanics: fall, run-up and face-plant, glide, clumsy
  landings, perch, swim, leave).
- Sound: `audio/foley.ts` (steps by surface, flaps, flutter, shake, tumble, rustle, plunge, paddle; swans' bugle
  and wingbeat), driven by `cygnet.heard` events from `main.ts`. The two cries are unchanged so far.
- Story: the brave swim on the long crossing (`CrossingOpts.swimAt`, `crossing.ts`).
- The probe (`companion/probe.ts`, `__game.probe.report()` / `.trace`): body jerk, turn rate, mitten gap, foot
  slip, ground.

Merged from Opus 5 agents: `cygnet-look` (down shells, fan-closing wing, grey palette, `SIZE` 1.42, complete, with
a report) and `cygnet-swans` (white swans: skein, wheel, raft on the water, take-off; cut off by the session limit
on 2026-09-18 before its final polish and report; its uncommitted work was committed as WIP and merged; it
typechecks and builds). The crest now calls `flock.rest()` on the far bay and `flock.lift()` north.

Interrupted by the same limit before they had changed anything: `cygnet-look2` and `cygnet-pose` (worktrees exist,
no commits). Their briefs are the next two parcels and are summarised here so they can be relaunched:
- **Look pass two** (owns `cygnet/body.ts`, `parts.ts`, `shader.ts`, the child's geometry in `traveller/body.ts`):
  more swan in it (longer slender neck, longer flatter bill, lores that read at 3-5 units); the folded wing's
  coverts read as hard plates and should be one soft downy teardrop; it goes charcoal in shade and should stay pale
  silver-fawn in every light; `sleek` needs a directional lay, `wet` reads soapy; `grown` must read at game
  distance; an open-topped satchel the cygnet sits IN; puffy sleeves, soft elbow, mittens with thumbs.
- **Pose and timing pass** (owns `cygnet/pose.ts`, `wings.ts`, `gait.ts`, numbers in `mind.ts`, `ride.ts`,
  `carry.ts`, the child's kneel/lean/arm feel in `traveller.ts`, sockets in `traveller/body.ts`, the look of the
  mechanics in `cygnet.ts`): every pose and act is an engineer's sketch; the kneel tips the coat like a rigid bell;
  the held-out "regard" covers the child's face from the front.
- **Swans follow-up**: from the real crest (20 up, 370 units from the bay) the raft is a few white pixels. It needs
  a size it can be given for that shot, or to be staged nearer; then its own final polish.

Gates on the merged branch (2026-09-18): 21 of 27 pass. Misses, all marginal and all from refitting to the bigger
bird: gather jerk 0.021 and gap 0.065, a 0.098 turn while it waits, set-down jerk 0.024 and gap 0.082, walk turn
0.10. The pose pass retunes these; none is a visible pop.

Still to do: the three parcels above; re-listen to the re-voiced cries and the foley (nobody has heard them yet);
per-room behaviour; a full playthrough; an independent visual verdict; fold this file into `journey.md`; merge to
`main` (which has moved on: `src/tuning.ts` and petals work from other sessions touch `main.ts`).

Found on the way, and decided:
- **The satchel is its seat on the walks, not the hood.** The hood is worn up, and anything held in front of a bell
  coat is invisible from the game camera, which lives behind the child. In the open satchel on the child's back it
  is in every frame, facing the way they go, able to look back at the player's wind, and it is what cygnets do:
  ride on a back. In the arms (across the chest, head to the child's left) is for tender moments and the boat.
- **It gets into the hands by itself.** A kneeling child's hands stop about half a unit above the grass; bending the
  rigid coat further tips it over like a plank. So the hands are offered low and held still, and the cygnet hops up
  into them. Nothing is done to it. After the fall this is its fourth try at getting up, and the one that works,
  because someone is there.
- The child's arms now show: shoulders moved out to the coat's surface, arms resting on it, red mittens. This
  changes the child's silhouette a little and needs Jeremy's eye.
- Probe numbers to hold (worst over gather, stow, unstow, set-down): body jerk under 0.02 units/frame², turn under
  0.07 rad/frame, mitten gap under 0.06, never below ground. Pops found so far all came from a pose weight that
  switched instead of easing; every new weight must be eased.

In flight: Opus 5 agents on `cygnet-look` (model, wing fold, down shader) and `cygnet-swans` (adult swans, the raft
on the water, take-off), each in `/private/tmp/updraft-cygnet-{look,swans}`.

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
