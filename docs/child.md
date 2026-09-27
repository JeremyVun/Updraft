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
  The long end streams well round to the side so it reads past the bag from the camera behind.
- Face details still at **D** until Jeremy rules on the shape.
- Capture harness for this round, in `/tmp/child3`:
  - `snap.sh <tag>` freezes the worktree as a build served at `:5377/<tag>/`, so edits don't disturb captures.
  - `studio.sh <tag>` shoots the child alone on cream through a long lens (`URL=`, `BIRD=1`, `ONLY=1`).
  - `overlay.py`, `compare.py`, `faces.py` and `checkpoint.py` build the comparisons with the concept.
