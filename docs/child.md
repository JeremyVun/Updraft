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
  every story moment still lines up; the lighting hooks (embers, bedside lamp, dawn) stay; frame time checked back to
  back against main before merging.
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
- Checks: `node tools/cygnet-gates.mjs`, the `?chapter=stage` moments, `node tools/perf.mjs frames`.

## Status

- 2026-09-27: worktree made from `d461f90`; the rejected incremental attempt's worktree and branch are deleted.
