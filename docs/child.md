# The child: a ground-up rebuild

Read this first after any context loss while the child is being rebuilt. The work is in the worktree
`/private/tmp/updraft-child2` (branch `child-rebuild`).

## Jeremy's brief (2026-09-27, verbatim)

> Uplift the child's ingame model to more faithfully capture the concept art. The child model should still fit within
> the art style of the game and not be too high definition, but it does need an uplift with better animations, and the
> child's coat being able to subtly flap in the wind (not full physics simulation). Whether or not the in game model
> should have a mouth, nose, and eye whites im not sure yet though (remember, the whole game takes place within a
> dream, and in dreams we tend to remember the shape, colour, and feel of things)

> The concept art is the direction i want us to go towards capturing

> dont worry about what jeremy kept last time - just align what we have towards the concept art. Jeremy only chose
> waht to keep last time because of previous attempt to uplift the model which didn't work out. That info shouldn't
> pollute this attempt

> hold on, i need you to take this more seriously to uplift the child's model and make it more like the concept art.
> It should be flowing, animated, and feel high quality. For performance reasons we dont need to have full physics
> simulation of the child's clothes (including the scarf), but it does need to feel and react stylistically to the
> wind and to the child's movements somewhat. Any historical information that's been written anywhere about "jeremy
> this or that with the model" need to be deleted so as not to poison and misguide the next session. The problem with
> this current session is that all you've done currently is try to shift the current child model to fit the concept
> art so it still looks blocky and low definition. What i needed was a ground up rebuild in a worktree.

> remember, this is a game about a child in their dream journey. so full realism isn't the expectation as much as it
> is about capturing the feel of things. to this regard, animations, colours, and sillouhettes are important. Because
> this game is going to become a paid product, i need the child model to be higher quality. Some thoughts below on the
> clothing,
> ```
> 2. Clothes with weight and softness.
>    The hood needs a few broad folds, the coat should hang from the shoulders, and the backpack should sag around the
>    bird. Those shapes will survive at gameplay distance. Subtle knit shading on the scarf would help in closer views;
>    modelling every stitch wouldn't.
> ```

On the plan below: "yep good, proceed. whether you use sub agents to help is up to you, i just want a high quality
model that animates really seamlessly and interacts really well with the rest of the game world."

After checkpoint 1 (2026-09-27, verbatim):

> next session to continue working on the child model to better fit the proportions of the concept art. e.g. the
> child in the concept is chubby, which is different from in game. It's really important to get face shape right. The
> backpack also doesn't look like the more rectangular backpack in the concept art. The ingame shoes are too shiny and
> not like the brown leather in the concept art. The child's hair looks like they got a bowl cut like a monk, not the
> wavy hair in the concept. The hood is also out of proportion with the rest of the child's outfit (in the game, their
> head looks too big and it's not the right shape, proportion, or sillouhette compared to the concept art). The scraf
> doesn't billow out behind the child. As for the face, it's hard to tell righ tnow because the face shape is
> completely wrong. So maybe just keep node + mouth + eye  whites (D) until you get the same chubby face shape and
> hood sillouhette right and then we can revise on the facial details.

> Do not run perf benches unless i ask for it.

Steer during the proportions round (2026-09-27, verbatim):

> it's better than before, but the hood looks like it has maybe 10 to 20% more volume than the concept, the child's
> chin looks like it's missing. the child's shoulders are too wide, causing the coat flare sillouhette to not stand out
> like in the concept.

Next round's ask (2026-09-27, verbatim; his images are `/tmp/child3/jeremy-handoff-image-{1,2,3}.jpg`: our face beside
the concept's, the promo header, the concept sheet):

> do the sillouhettes of the hood openings look the same to you? [Image #8]. The backpack also looks a bit too big -
> it's starting to look like a bin instead of an open backpack like in the concepts [Image #9] [Image #10]. And the
> backpack straps on the front need look correctly attached to the bag around and under the child's shoulders.

And on `/tmp/child3/checkpoint3-walk-behind.png` (verbatim):

> Also, if i look at the checkpoint3-walk-behind.pnd - the coat looks like it's slightly too long due to the
> perspective of the camera, i think we may need to use a trick and shorten the coat by just a tiny little bit so it
> looks less like a dress and more like an oversized coat.

His ruling during that round (2026-09-27). Asked whether to turn the cygnet sideways in the bag, as both concepts
show, so the bag can be a flatter backpack instead of as deep as the bird is long, he chose "Turn it sideways
(Recommended)".

After round 3 (2026-09-27, verbatim). His image was the side walk strip from `/tmp/child3/checkpoint2-old-vs-new.png`:

> great, the model looks good. how do the animations look like?

> do you see from the side, i think the coat drapes down a bit too much and we lose that sillouhette from the concept
> images. do you understand what i mean?

> and yea, please fix all the issues you see as well

The issues he meant are the ones reported with checkpoint 2:
- the run lacks energy;
- the idle is static, with the arms held out;
- the walk's arm swing reads small;
- the scarf lies across the arm like a sash from the side, and whips over the head in the pick-up;
- the quick actions need checking frame by frame.

Earlier attempts on the child's model are not a guide. Do not mine old transcripts or git history for them.

## The target

- Concept sheet (front, three-quarter, face): `assets/art-direction/child-front-concept-v1.png`, with its design notes
  beside it. The back and seated silhouette, with the cygnet in the bag and the scarf streaming:
  `assets/promo/updraft-header-master-v6.png` (local only).
- A dream, not realism: shape, colour and feel. Silhouette first, so it reads from the game camera; detail only where
  the camera comes close (the face, the scarf's knit).
- **Hood:** a big rounded dome with a thick rolled rim, a centre seam and a few broad folds; the face sits low inside
  it. No point, no pompom.
- **Coat:** a deeper, warmer mustard than the old bright yellow (the family jumper in `world/lines.ts` follows it). It
  hangs from narrow shoulders and flares to the knee in a few soft folds, with a placket and three brown buttons.
  Mittens match the coat; charcoal trousers; chunky round-toed brown wellingtons.
- **Backpack:** brown leather, a pouch that sags around the cygnet, an open mouth, straps over the shoulders.
- **Scarf:** chunky brick-red wrap, two unequal ends. Knit as subtle shading in close views, no modelled stitches.
- **Face:** small dark eyes with glints, small brows, warm cheeks, a fringe of a few broad locks. Nose, mouth and eye
  whites are Jeremy's open question: compare the variants as matched stills and ship only his pick, with no switch.

## The plan (approved 2026-09-27)

- **Built in code, like the cygnet:** continuous smooth surfaces per garment (not glued primitives), skinned to a real
  skeleton (spine, neck, elbows, wrists, knees, ankles) and deformed on the GPU.
- **New animation:** walk, run and idle with weight (hips rise and fall over each step, shoulders counter the hips,
  arms swing with a lag, the head stays steady, leaning into starts, stops and turns). Every existing action remade on
  the new skeleton: throw, pick-up, cheer, wave, reach, push, kneel, sit, swing, boarding and alighting, sleep and
  yawn, bracing in wind, holding the cygnet.
- **Stylised secondary motion, not cloth simulation:** springs on a few extra bones. The hood lags head turns and
  lifts at the brim in gusts; the hem swings with each stride, trails when running and ripples on the windward side;
  the backpack sways and bounces with the bird's weight; the scarf ends stream with the wind and swing with the body.
- **Fits the game as it is:** same size and joint positions, so the hands, head and the cygnet's seats stay put and
  every story moment still lines up; the lighting hooks (embers, bedside lamp, dawn) stay. No perf benches unless
  Jeremy asks for one.
- **Checkpoints for Jeremy, as stills opened in Preview:** (1) the still model beside the concept sheet; (2) poses and
  the walk, run and idle; (3) in game on a few islands, before and after.

## What the rest of the game relies on

- `src/traveller/body.ts` exports `buildChild(): Rig`, `keepOffChild`, `PALETTE`, `UPPER_ARM`, `FOREARM`, `SocketName`.
  Only `traveller.ts` uses the rig; the scarf uses `PALETTE`.
- Story code works in the body's frame: `reachLocal` targets (the cradle hold at about (±0.17, 0.53, 0.43), the mirror's
  hoop grip), sockets `cradle`, `satchel`, `shoulder`, `lap`, and the cygnet's climb over the shoulder
  (`creatures/cygnet/ride.ts` reads the body as the parent of the `cradle` socket). Keep that frame's scale and origin.
- `face()`, `breathFrom()`, `mitten()`, `handPosition()`, `planeQuaternion()` read the head and hands.
- The shader keeps `ATMO_GLSL` hooks: `hemiLight`, `groundAt`, `cloudShadow`, `emberLight`, `dawnLight`, `lampLight`,
  `applyFog`, and `uGroundPos`.
- Checks: `node tools/cygnet-gates.mjs`, the `?chapter=stage` moments.

## Status

- 2026-09-27: worktree made from `d461f90`; the rejected incremental attempt's worktree and branch are deleted.
- Built (branch `child-rebuild`): `src/traveller/child/` — `skeleton.ts` (29 bones: spine, neck, head, hood, clavicles,
  arms to the wrist, legs to the ankle, bag, eight hem bones), `garments.ts` (every garment as one parametric surface),
  `shader.ts` (per-material wool, knit, leather, rubber, hair and skin; the face painted), `motion.ts` (planted-foot walk
  with leg IK on the terrain, arm IK, springs on hem, hood and bag). `traveller.ts` authors a `Pose` per frame.
  The satchel is lower on the back (seat unchanged relative to the bag) so the cygnet's head rides beside the hood.
- Checkpoint 1 shown to Jeremy: `/tmp/child2-shots/checkpoint1-model.png` (concept, main, rebuild) and
  `checkpoint1-faces.png` (A eyes only, B + nose, C + nose + mouth, D + eye whites). His verdict is above: the shapes
  are off. Face details stay at **D** (nose, mouth, eye whites) until the chubby face shape and the hood's silhouette
  match the concept; then the details are revisited.
- Since checkpoint 1 (commits `91a1d9b`, `565c918` on `child-rebuild`): the hem flares and ripples in the wind (spring
  plus a shader ripple), livelier walk and springing run, scarf ends framed by parallel transport and smoothed, the
  paper's stow point on the lower bag, throw/cheer/wave reworked, springs rest while lying down, the family jumper in
  `world/lines.ts` takes the coat's `#d9a22c`, `docs/styles.md` describes the new child.
- Round 2, proportions (2026-09-27, `child-rebuild` from `a0a27b1`), measured against the concept by overlaying the
  studio front view on the concept's at matched height, and adjusted after Jeremy's steer above. The knobs are all in
  `garments.ts`:
  - **Face** (`FACE`, `facePoint`): a round crown, and a lower half 10% wider that stays full to a round chin (a
    broad U). The chin sits just over the scarf with the throat shaded. The ears are bigger and forward. The painted
    features are placed to the concept in `paintFace`: eyes wider apart and a touch larger, nose and mouth low and
    close, blush on the cheeks. Skin takes direct sun at 70%, so a bare forehead can't flare.
  - **Hood** (`HOOD`, `hoodOpen`, `hoodPoint`): a bell, not a ball. It has an egg crown with a soft seam ridge,
    sides falling nearly straight to the shoulders, and a back hanging over the bag. It is about 20% less volume than
    before, per Jeremy. The opening is wide at the sides and closes in at the jaw, with the face forward in it.
  - **Coat** (`COAT`): narrow sloped shoulders with a steady A-line flare to the hem (Jeremy: wide shoulders hid the
    flare). The sleeves narrow at the shoulder and fill out toward the cuff.
  - **Bag** (`BAG`, `bagSize`, `bagLip`, `BAG_SQUARE`): a soft leather box with seams down the corners. It bellies
    low where the bird sits, and its open top sags between the corners. The near face is pressed to the back, and
    its backward swing is halved (`motion.ts`), so it no longer hangs off the coat as they walk. The seat offset is
    unchanged relative to `BAG.c`, which moved 0.08 toward the back.
  - **Boots** (`boot`): wider shafts opening at the top, a foot that widens onto a welt, matte scuffed leather.
  - **Hair** (`HAIR`, `hairline`, `LOCKS`): a fringe of broad locks tapering to soft points, parted on the child's
    left and swept right, with locks in front of the ears.
  - **Legs:** thicker trousers, hips at ±0.15 and the feet a touch wider still. Mittens are plumper, thumb forward.
- Then from Jeremy's notes on the overlay (verbatim in the brief above is his first steer; these followed in chat):
  buttons raised to the concept's, the hood brought forward over the fringe and flaring out at the ears, the palette
  matched to the concept by sampling both (coat `#d29134`, scarf `#7c261b`, trousers `#2c2823`, hair `#3d2a1b`, boots
  `#453427`; the family jumper follows the coat), the chest carried forward. The face read vertically short: the
  parting now shows forehead on the child's left and the cheeks taper to the chin. The hood was cinched down onto the
  head: it now stands off it, the brim arching out over the fringe.
- Scarf ends (Opus agent, branch `child-scarf`, merged): a dream breeze always carries both ends out behind and round
  to the knot's side, more with the child's speed; a player's gust takes them its own way. Knobs in `tuning.scarf`.
  The long end streams well round to the side so it reads past the bag from the camera behind. 09-28, after Jeremy
  found the ends blowing about with no wind and the scarf odd always sticking out: the thrashing was the coat push
  (`keepOut`), applied in both constraint passes and so carried into the ends' last positions twice, flinging them
  back into the coat every step (tip 1.4 m/s standing still, 0.2 after). It now pushes once, on the last pass. The
  dream breeze is 0.8 (was 3), so standing in still air the ends droop with a lean behind; `carry` 0.8 (was 1): Jeremy
  found them sticking out too much just from walking, so at a walk they trail back and down (tip 0.5 m below the
  knot, where it was level), lifting further at a run or in a gust.
- Face details still at **D** until Jeremy rules on the shape.
- Capture harness for this round, in `/tmp/child3`:
  - `snap.sh <tag>` freezes the worktree as a build served at `:5377/<tag>/`, so edits don't disturb captures.
  - `studio.sh <tag>` shoots the child alone on cream through a long lens (`URL=`, `BIRD=1`, `ONLY=1`; `FACE=1` for
    the close face views, `STRAPS=1` for the straps). The gaze is held straight ahead, so the head doesn't turn.
  - `overlay.py`, `compare.py`, `faces.py` and `checkpoint.py` build the comparisons with the concept.
  - `headcmp.py <tag>` puts the concept's head into our face shot at full-body scale (hood top to sole matched). It
    is the fair way to compare the hood and face, because matching on the eyes hides that ours sit higher.
  - `birdfit.sh <tag>` skins the cygnet's vertices on the CPU and reports any outside the bag's walls or over its rim.
    `headfit.sh <tag>` reports how close its head comes to the hood. Their bag and hood numbers are copies of
    `garments.ts`; update them when those change.
- Round 3 (2026-09-27, `child-rebuild` to `a2a83ee`), after Jeremy's ask above. The knobs are in `garments.ts` unless
  noted.
  - **Hood opening.** Measured at body scale, the two openings were the same width at eye level, but ours was broad
    and low at the top and closed in a U under the chin. The concept's is a tall, narrow arch whose sides run down
    beside the jaw into the scarf. The opening is now drawn as that front outline, an egg with its narrow end up
    (`OPENING`: top, widest point, bottom, half-width, and how the width falls away above and below it). The cut
    angle round the hood (`hoodOpen`) is solved from it once. The rolled rim is thicker (radius 0.05) and the brim
    lifts less. The hair cap is taller (`HAIR.ry` 0.296), because the face's crown showed through it under the
    taller arch.
  - **Bag.** It looked like a bin because the cygnet sat facing forward, its body front to back, so the bag had to be
    as deep as the bird is long. Its tail poked out of the far side even then. Per Jeremy's ruling, the cygnet now
    sits across the bag, facing out past the child's left shoulder and a little back:
    - `SEATS.satchel` yaw 1.9 in `creatures/cygnet/ride.ts`.
    - The satchel socket's x is +0.01 in `body.ts`.
    - The stowed neck stands nearly straight in `creatures/cygnet/pose.ts`.
    - Its head is beside the hood where the camera behind sees it, as in the promo header. Before, its head was
      inside the hood's volume most of the time.

    The bag is a soft satchel, wider than it is deep:
    - `bagSize` gives a half-width of 0.292 + belly, 0.232 toward the child, and 0.19 + belly away.
    - It is fuller low down, with a rounded bottom (`BAG_ROWS`) and softer corners (`BAG_SQUARE` 3.2).
    - The rim is lower (`BAG.lip` 1.46), sagging between the corners, so the bag is shorter and the bird's back shows.
    - `BAG_KEEP` in `body.ts` follows the new shape.
    - Every cygnet vertex is inside the walls, the worst 2% in from the wall.
  - **Straps** (`strap()`). Each one leaves the top of the bag's near face and goes over the shoulder. It comes down
    the chest to the second button, runs round under the arm on the coat, and curves into the lower corner of the
    bag's near face. Both ends are skinned to the bag and sink into the leather.
  - **Hem** raised from 0.56 to 0.6 in every place that has it: `hemY`, the lowest `COAT` rows (a touch wider, to
    keep the flare), and the shader's hem ripple and stitch line.
  - **Gates**, both builds back to back. Stow, unstow and set-down match the starting build (stow turn 0.0619 against
    0.0614). The failures are the known flakes, on both builds: jerk 0.0201–0.0205, and gather turn about 0.10.
  - **Noticed, not changed** (face work, for later). At body scale our eyes sit about 0.04 higher in the head than
    the concept's, and our face is about 12% wider. The concept's ears are larger and show inside the opening.
  - Sheets shown to Jeremy, in `/tmp/child3`: `checkpoint4-hood.png`, `checkpoint4-bag.png`,
    `checkpoint4-straps.png` and `checkpoint4-walk-behind.png`.
- Round 4, animation (2026-09-27, `child-rebuild` to `b64c47b`), approved by Jeremy, after his ask above. The knobs
  are in `traveller.ts` unless noted.
  - **Coat from the side** (`COAT` in `garments.ts`): below 1.18 the rows are deeper and further forward, so the hem
    flares front and back as well as sideways and keeps the concept's A-line in profile. The back at bag height barely
    moved, so the bag still sits on the coat.
  - **Quick actions by hand targets.** The arm angles compose badly for a raised arm (the raise rolls an arm already
    lifted out), which put the mitten across the face in the throw and the reach. Each action now places the mittens
    in the body's frame with the elbow's direction given (`grips`, `motion.reach(…, elbow)`):
    - throw (`THROW` keys): up beside the hood with the shoulder drawn back (`twist`), a beat, then long, forward and
      up through the release at 0.62 and down across the front;
    - pick-up (`PICKUP` 0.9 s): a squat with the other hand on a knee and the left mitten to where the paper lies.
      `onDone` comes at `PICKUP_GRAB` 0.46 s, as the mitten reaches the ground, so the paper comes up in the hand;
      the stand-up plays on after, into whatever comes next. Five story call sites pass the paper's position
      (`pickUp(onDone, at)`);
    - cheer: a dip, a hop into a wide V, a smaller hop, down;
    - wave: the free hand (the right while the left holds the paper) up by the hood, waving from the elbow;
    - reach: both arms out after it, up on the toes, then giving up slowly;
    - bracing in a strong wind: a forearm across the lower face, elbow out.
  - **Idle:** after 1.2 s standing, whatever hand is free holds a strap at the chest (`straps`), as in the concept's
    three-quarter view. Glances go round to either side or up (`glanceYaw`, `glancePitch`), not back at the bag,
    because `companion/carry.ts` already has the child look back whenever the bird nuzzles, peers or flinches. The
    glance draws no `Math.random`: seeded checks (`flock-flight`, `sleeping-logic`) are chaotic in the random
    sequence and flip on any extra draw.
  - **Turns on the spot.** Story code snaps the child round with `faceToward(…, 1)` in 25 places. A turn faster than
    walking now eases round (`yawLag`: about half a second for half a turn), the feet stepping (the gait advances with
    the turn; `stepping` in `motion.ts`) and the head leading (`lead`). Turns no faster than walking pass straight
    through, so walking and the boat are unchanged.
  - **Stops:** the feet finish the step they are in and come together under the hips (`PASSING`) instead of sliding.
  - **Run:** the elbow opens as the arm drives back past the hip and closes as the mitten comes up (`pump`).
  - **Scarf** (`scarf.ts`): the air holds an end up near the knot (`held`, `open`), and the ends stream further
    behind (long end's splay 0.75, was 0.95; short 1.05, was 1.25; the air of their going at `splay * 0.65`). Walking
    and running, from the side it streams back at neck height instead of lying across the arm like a sash; from
    behind the long end still reaches out past the bag. The dream breeze is 3 (was 2.4, `tuning.scarf.breeze`), so
    standing it streams out rather than hanging across the arm. The chain is carried with the child's vertical
    motion too, keeping 40% of the starts-and-stops share (`inertia`) as a bob (`lurchY`), so squatting to the paper
    or hopping in a cheer no longer leaves the ends in the air to fling over the hood.
  - **Scarf colour** (after Jeremy's approval, which noted two reds): the ends' strip and caps were wound inside
    out, so with double-sided drawing every face was lit as the one behind it and the ends glowed orange against the
    wrap's brick red. They are wound the right way and lit exactly as the wrap (`scarf.ts` `FRAG`; the backlit
    `through` glow is gone).
  - **Gusts:** a gust arriving (`tuning.wind.arriveFrom`–`arriveFull`) turns the head toward where it comes from,
    unless the story has their attention, and the body gives a little with its push (`gusted`, `P.tilt`).
  - **Low reaches** (`stoop`): a story reach for something low in front, further than the arms go, bends the child
    further over toward it, only as far as it takes, then eases back up. Only on their feet or kneeling.
  - **Little boats:** the new arms could not reach the stranded toy hull from the old kneeling spot (a pre-existing
    failure on the branch, gap 0.58). They now kneel 0.9 from it (`story/little-boats.ts`); gap 0.058.
  - **Stowed paper** (`PAPER_STOW`, read by `little-boats-logic-check`): against the bag's far face and lower, so the
    bird shows above it. It is wider than the bag, so from behind it still covers the bag.
  - **Checks, browser-free:** all pass except `little-boats-logic-check` (characters leave the safe frame, 1.150) and
    `plane-routing-check` (an old field), which fail identically on main. `sleeping-logic-check` now asks the pose,
    not the old coat mesh, whether lying down has let go.
  - **Cygnet gates**, both builds back to back: every gate passes on `085d356`. The pre-rebuild build fails only the
    known gather turn (0.1025); ours is 0.049, and the gather's hand gap is 0.016 against 0.031.
  - **Tried and reverted:** a soft S in the cygnet's neck in the bag. It brought the head into the hood more often
    (`headfit` 10th percentile 0.66 against 0.81). The straight neck still reads as a post from behind and the side.
  - Sheets for Jeremy, in `/tmp/child3`: `checkpoint5-coat-scarf.png`, `checkpoint5-walk-run.png`,
    `checkpoint5-actions.png`, `checkpoint5-actions-behind.png` and `checkpoint5-turn-idle.png`.
  - Capture harness additions: `verify.sh <tag>` (walk, run, idle, turn and stop on the studio set, walking over
    land), `acts.sh <tag>` (the quick actions pinned at fixed times), `pickup.sh <tag>` (the pick-up in real time: it
    runs on its own clock, so pinning cannot show it), `paperthrow.sh <tag>`, `boat.sh <tag>` (boarding at the
    birches, alighting at the home jetty), `rows.py` (labelled sheets). `studio.sh` scrub actions cannot contain `;`.

## The face round: a little girl (2026-09-27/28)

Jeremy, verbatim, in order:

> I dont know why, but the child model looks older in age than a the child age we are aiming for. is it the size of
> the eyes being too small?

> can the eyes be made larger? It still doesn't read as a child. Also, do we need the little white dots in the
> child's pupils? Also, there's some kind of brown thing on the side of their face. It looks like a man with side
> burns rather than a small girl child.

> Its definitely supposed to be a little girl. If you can stray from the concept art and make the hair under the hood
> reflect this, as well as the face shape.
>
> I think i also figured out why the concept art looks like a child more than the in game model - because our ingame
> model doesn't have those chubby cheeks. do you see what i mean?

> hey, whatever you did to the cheeks, it looks horrendous, change it back and try again. You were supposed to add
> baby fat to the cheeks, not make them look like an alien

> ok, the problem with the baby fat is you moved it too high on the cheek instead of lower down, and the baby fat is
> slightly a bit too much.

> yea ok, lets go with lower, a little more, and maybe fix the bangs so it doesn't look so much like a bowl cut

He approved the result ("looks good"). The child is a little girl; the concept sheet's gender-neutral note no longer
holds, and hair and face may stray from it to show her. Built on branch `child-face`, merged. The knobs are in
`garments.ts` (`FACE`, `facePoint`, `BANGS`, `BOB`, `bob`, `strand`) and `shader.ts` (`paintFace`).

- **Eyes:** big dark upright ovals (half 0.043 × 0.053), a warm brown low in the iris, a sliver of white at the outer
  corner, one soft glint (without it they read as holes), two lash flicks at the outer corner. Set a little lower
  (0.048 below the face's middle). Shut, only the lash line shows. (Since made younger: see the next section.)
- **Face:** narrower (`rx` 0.238). At the old width the hood's inside showed in front of the cheeks, the "brown thing"
  he saw. Baby fat (`FACE.fat` 0.13) is a broad fullness low in the cheeks, widest just below the mouth, above a
  small round chin. **Not local pads:** a round pad under each eye was the "alien" version.
- **Nose, mouth, brows, ears:** a small round button nose (its own mesh; a vertex bump on the face read as a spike in
  profile), a small smile, soft arched brows, bigger ears.
- **Hair:** bangs parted a little off the middle, sweeping away from the parting at uneven lengths, the outer ones
  longer to the temples (a single straight line read as a bowl cut). A bob falls past the cheeks behind their outline
  and turns under at the jaw.
- **Neck:** shaded as a whole (vertex tag `k` on the neck tube). The idle pose lifts the head and shows a strip of it
  that sits inside the head at rest, so shading by rest height could not reach it.
- Sheets shown to Jeremy, in `/tmp/childface`: `face-before-after.png`, `babyfat2.png`, `bangs.png`,
  `full-girl.png`. Harness: `snap.sh` and `studio.sh` (copies of `/tmp/child3`'s, serving on :5393).
- Not yet checked in a level from the play camera, or in motion.
- **Merged into main** (2026-09-28): `child-rebuild` (`fea312e`), then `child-face` (`edea896`). Checked on the
  combined build: typecheck; every cygnet gate (27); the story checks, as main (little boats' safe frame and
  plane routing fail there too); studio stills; and the play camera in the birches, at home and in the meadow, at
  gameplay distance only (not the face up close, nor in motion). Closeout: the helper worktrees
  `updraft-child2-before`, `-scarf` and `-base`, the servers on :5373–:5375 and :5377, and `/tmp/child3/snaps` are
  gone. The `child-rebuild` worktree and `/tmp/child3`'s scripts stay for further child work.

## Younger: lashes off, bigger eyes, lower brows (2026-09-28)

Jeremy, verbatim: "The purpose of this session is to figure out how to make the child model look more like a child
instead of a teen. I have a feeling the eyes need to be slightly bigger and the lashes need to go?" Shown lashes off,
then eyes 1.15×, 1.2× (with brows and mouth moved) and 1.3×, he asked for "C + brows" and chose it.

- **Lashes gone.** The two flicks at the outer corner read as a made-up, older eye; taking them off was the biggest
  single step.
- **Eyes 1.15× about their old centre** (half 0.0495 × 0.061), with the white sliver, iris warmth, glint and the shut
  lash line scaled with them. 1.3× started to read as a doll, and took over the face at half-body distance.
- **Brows set 0.014 lower** (0.068 above the face's middle), close over the eyes. Floating high they read surprised and
  older.
- Knobs in `shader.ts` (`paintFace`). Sheet: `/tmp/childyoung/c-brows.png` (now, C, C + brows, F).
- **A shorter lower face, 5%.** Jeremy asked to see it ("can you give me a comparison sheet so i can see what that
  shorter face would look like?"), was shown 7%, 14% and 22%, and chose: "i think 14% is too much. lets go with 5%".
  The chin stays on the scarf and the face's middle comes down 0.014 (`FACE.c.y` 2.016, `up` 0.314, `down` 0.264),
  so the eyes, brows, nose and mouth sit lower and closer together under a taller forehead. Raising the chin instead
  bared a dark strip of neck above the scarf. The hair no longer follows the face: `HAIR.c` is its own point, and
  `hairline` is measured from it. The painted nose tip, its shade, the cheeks and the mouth are scaled with `down`.
  Sheets: `/tmp/childyoung/lower-sheet.png` (the choices), `lower5.png` (the result: front, three-quarter, side,
  sunset).

## The bag's flap (2026-09-28)

Jeremy (verbatim): "I think the child's backpack is good, but it just needs a flap or something for the bag cover if
thawt makes sense. right now, when the cygnet is not in the backpack, it looks like a bucket"

After the first cut, which closed the flap over the empty bag (verbatim): "It's ok for the bag to be open for most of
hte game but just to have the flap showing on the side of the bag or osmething. you know what i mean? like the bag is
open and not just a bucket"

Then, asked whether the bag is closed until she first puts the cygnet in it: "lets do that."

- A leather lid (`flap()` in `garments.ts`, `FLAP_EDGE`, `FLAP_THICK`) cut to the bag's own outline and a little
  larger, modelled shut over the mouth. It is hinged along the top of the outer face on three bones hung off the bag
  (`BONE.flap`, `flapRoll`, `flapTip` in `skeleton.ts`).
- Until the cygnet first rides in the bag, the flap lies shut over the mouth. The first time its seat is the
  satchel (in the little boats, where it is gathered up and climbs in before boarding), the flap is thrown back over
  the hinge (`child.openBag()`, called from `main.ts`) and stays open for the rest of the game, hanging down the outer
  face (`FLAP_OPEN`, on the `flapOpen` spring in `motion.ts`, so it flops a little as it lands).
- A story that starts after the little boats (`Journey.begin`), or a save resumed with the cygnet in the bag, starts
  with the flap already open. Checked: `?chapter=washing` and `boats` start shut; `meadow` and `home` open. A resumed
  save is not yet checked.
- Open, the flap swings away from the face with the bag's own swing and a little in the wind (`flapSwing`), never into
  it. It doesn't flop with each step or sway side to side.
- The paper, stowed, lies over it; checked in the stage.
- Stills in `/tmp/bagflap`: `sheet.png` (before, shut, open), `open-sheet.png` (open), `v8-first-stow.png` (shut, the
  first climb in, open after it climbs out). Not yet checked in a level from the play camera.

## The hood from the side (2026-09-28)

Jeremy (verbatim): "From the side the hood reads like a bicycle helmet instead of a cloth hood. It doesn't look nice."
Then, tracing the face edge on a side still: "It's the fucking bend that makes it look like a helmet." He also asked
for the dark wedge showing through the side of the hood to go. He approved the result ("ok this is good").

- **The bend.** The opening is cut to the concept's front outline, widest at the ears, so at the temples the cut went
  far back into the hood. From the side the edge came forward over the brow, stepped back at the temple and ran
  straight down to the jaw: a helmet's face cut-out. The cloth near the edge now comes forward at the temples
  (`HOOD.reach`, in `hoodShape`), so the edge runs down in one line. Only depth moves; the front outline is the same.
- **Seam.** A centre-seam ridge up the back of the hood to a soft corner at the back of the crown (`HOOD.seam`,
  `HOOD.corner`): a gentle peak from behind, where players see her most.
- **Dark wedge.** The bob's ends showed through the side of the hood under the jaw; they tuck in a little more
  (`bob()`), and look the same from the front.
- **The rim stays as it was.** A flatter, tapered rim and a hood swelling up into it both read as the rim being
  removed. Neither was wanted.
- Checked in stills on the stage only (lit from the side via `sun=0,35`, gaze held ahead), not in a level or in motion.

## Sitting on the ground (2026-09-28)

Jeremy (verbatim): "I need you to take a look at uplifting the child's pose at the start of the game, it's a bit weird
looking. like they are a doll with their arms sticking out."

The game opens with her sat on the shore holding the plane (`story/island.ts`). The seated rest put both forearms out
level in front and the plane's carry held it out at the hip on its edge. Now, sat on the ground (not in the boat),
the mittens come into the lap (`lap` in `traveller.ts`): round the paper, which lies flat on her lap nose ahead
(`paperLap`), with her eyes on it; without it they rest on her knees. She leans in a little. It lets go as she stands
or starts any action. The stairs' nest (paper stowed) and the summit (paper in hand) share it. Sheet:
`/tmp/startpose/start-pose-before-after.png`. The summit is not yet checked in place.
