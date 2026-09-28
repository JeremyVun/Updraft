# The child

A little girl, built in code from smooth garment surfaces skinned to a real skeleton and deformed on the GPU:
`src/traveller/child/` (`skeleton.ts`, `garments.ts`, `shader.ts`, `motion.ts`, `mesh.ts`), posed each frame by
`src/traveller/traveller.ts`, with the rig contract in `src/traveller/body.ts` and the scarf in
`src/traveller/scarf.ts`.

## Jeremy's brief (verbatim)

> Uplift the child's ingame model to more faithfully capture the concept art. The child model should still fit within
> the art style of the game and not be too high definition, but it does need an uplift with better animations, and the
> child's coat being able to subtly flap in the wind (not full physics simulation). Whether or not the in game model
> should have a mouth, nose, and eye whites im not sure yet though (remember, the whole game takes place within a
> dream, and in dreams we tend to remember the shape, colour, and feel of things)

> The concept art is the direction i want us to go towards capturing

> It should be flowing, animated, and feel high quality. For performance reasons we dont need to have full physics
> simulation of the child's clothes (including the scarf), but it does need to feel and react stylistically to the
> wind and to the child's movements somewhat.

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

> i just want a high quality model that animates really seamlessly and interacts really well with the rest of the
> game world.

Earlier attempts on the child's model are not a guide. Do not mine old transcripts or git history for them.

## The target

- The concept sheet: `assets/art-direction/child-front-concept-v1.png` (front, three-quarter, face), with its design
  notes beside it; the back and seated silhouette, with the cygnet in the bag and the scarf streaming, is the promo
  header `assets/promo/updraft-header-master-v6.png` (local only).
- A dream, not realism: shape, colour and feel. Silhouette first, so she reads from the game camera behind and above
  her; detail only where the camera comes close (the face, the scarf's knit).
- **She is a little girl.** The concept sheet's gender-neutral note does not hold: hair and face may stray from the
  concept to show her, and should read as a stereotypically cute small child, not a teen.

## Rulings

Each from one of Jeremy's rounds; do not retry what he rejected.

**Face** (`FACE`, `facePoint` in `garments.ts`; painted in `paintFace`, `shader.ts`)
- Chubby cheeks are what read young: baby fat as a broad fullness low in the cheeks, widest just below the mouth,
  above a small round chin (`FACE.fat`). Round pads high under the eyes looked "like an alien"; too much or too high
  both fail.
- Big dark upright eyes with a warm brown low in the iris, a sliver of white at the outer corner and one soft glint.
  No lashes (Jeremy: "the lashes need to go"). The eyes are 1.15× the first size with the brows lowered: he chose
  that over 1.2× and 1.3× eyes.
- Soft brows set low and close over the eyes.
- A small round button nose (its own mesh), a small smile, big ears.
- The lower face is 5% shorter than first modelled, under a taller forehead; 14% was too much.
- The face is narrow enough that the hood's inside never shows in front of the cheeks (that read as sideburns).

**Hair** (`BANGS`, `SIDES`, `bob()`, `pigtail()`, `strand()`, `lock()` in `garments.ts`; `PIGTAIL_TIE`, `BONE.pigL`,
`pigR` in `skeleton.ts`; `pigSwing` in `motion.ts`)
- A fringe parted in the middle, each half swept out to its temple, short at the parting and longer outward, so its
  edge is an arch with a little forehead in the middle; clumps bow away from the parting and end in soft points.
- A short lock in front of each ear curls round the cheek; the rest is drawn back to low plump pigtails tied with
  knitted bobbles like the scarf, coming out of the hood at the jaw with the tips turned up. They bounce and droop
  with each step, lag the head, lean into the wind and flutter a little in a strong one.
- Locks are shaded lighter down their middles so they read as locks in daylight, not one dark cap.
- **Judge the hair from the play camera**, above her (elevation 20–35°, 5–6 m), not only face-on: from above the brim
  hides the fringe's top, and a level lower edge plus hair down both sides of the face makes a dark ring inside the
  hood that reads as a bowl cut whatever the fringe's shape.
- Rejected: a straight fringe (bowl cut), hair framing the face like curtains, a side-swept fringe, a round bob with
  no pigtails, a bare forehead with a few wisps (she looked bald).

**Hood** (`HOOD`, `OPENING`, `hoodOpen`, `hoodShape`, `hoodPoint`)
- A bell, not a ball: an egg crown with a soft centre seam, sides falling nearly straight to the shoulders, the back
  hanging over the bag; about a fifth less volume than first built. It stands off the head, the brim arching over
  the fringe.
- The opening is the concept's tall narrow arch, its sides running down beside the jaw into the scarf.
- From the side the edge runs down in one line (`HOOD.reach` brings the cloth forward at the temples); the bend a
  helmet's face cut-out makes read as "a bicycle helmet".
- A centre-seam ridge rises to a soft corner at the back of the crown (`HOOD.seam`, `HOOD.corner`).
- The thick rolled rim stays: flatter or tapered rims read as the rim removed.

**Body and clothes**
- **Head sits low.** The head, hair and hood are posed `HEAD_SINK` below where they are modelled, so the chin sits
  into the scarf and no long neck shows; a high head read older. The hood's keep-out (`HOOD_AT` in `body.ts`) moves
  with it.
- **Coat** (`COAT`, `HEM`, `hemY`): a warm mustard (the family jumper in `world/lines.ts` follows its colour), hung
  from narrow sloped shoulders with a steady A-line flare that stands out from the front, the side and behind; wide
  shoulders hid it. The hem is short enough to read from the camera behind as an oversized coat, not a dress, and
  the lower half is not "frilly": a flat woollen hem edge over shallow folds, flaring a little less front to back
  than side to side. It still swings when she walks. A placket and three brown buttons.
- **Bag** (`BAG`, `bagSize`, `BAG_ROWS`, `BAG_SQUARE`, `strap()`): a soft brown leather satchel low on the back,
  wider than it is deep, bellying where the bird sits and sagging between its corners. The cygnet sits across it,
  facing out past her left shoulder, its head beside the hood where the camera behind sees it (`SEATS.satchel` in
  `creatures/cygnet/ride.ts`), because a bag as deep as the bird is long looked like a bin. The straps leave the top
  of the near face, go over the shoulders, down the chest and back under the arms into the bag's lower corners.
- **Flap** (`flap()`, `FLAP_OPEN`, `BONE.flap`, `flapRoll`, `flapTip`): a leather lid on three bones. It lies shut over
  the mouth until the cygnet first rides in the bag (in the little boats), then is thrown back (`child.openBag()`)
  and hangs open down the outer face for the rest of the game, swinging a little with the bag and the wind but
  never flopping with each step. Jeremy: the bag should be open most of the game, but not look like a bucket. A
  story or save that starts after the little boats starts with it open.
- **Boots**: matte, scuffed brown leather, chunky and round-toed; not shiny.
- **Mittens** match the coat; charcoal trousers.

**Movement**
- Stylised secondary motion on springs, never cloth simulation.
- **The scarf** (`scarf.ts`, `tuning.scarf`): standing in still air the ends droop with only a lean behind; at a walk
  they trail back and down, lifting further at a run or in a gust; a player's gust takes them its own way. They must
  not stick out or blow about with no wind. Knit is shading only.
- **Seated on the ground** she holds the paper flat in her lap, or rests her mittens on her knees, and leans in a
  little (`lap`, `paperLap` in `traveller.ts`), never a doll with its arms out; the front hem drapes over her thighs
  (`LAP_DRAPE`). In the boat she sits on the thwart and the coat hangs.
- **Going to bed** she turns the covers back herself, gets in and pulls them up (Jeremy: "the child has her hands
  straight infront of her, it looks very unnatural"); her arms never hold straight out. Nothing of her shows through
  the quilt. The scarf's tail hanging off the side of the bed is fine.
- No perf benches unless Jeremy asks.

## How she moves

In `traveller.ts` unless noted.

- **Walk, run, idle** with weight: a planted-foot walk with leg IK on the terrain (`motion.ts`), hips rising and
  falling, shoulders countering, a lagging arm swing, a steady head; the run pumps the elbows (`pump`). Standing a
  while, a free hand holds a strap at the chest (`straps`) and glances go to the sides or up (`glanceYaw`,
  `glancePitch`); they draw no `Math.random`, because seeded story checks are chaotic in the random sequence.
- **Turns on the spot** ease round with the feet stepping and the head leading (`yawLag`, `stepping` in
  `motion.ts`); a turn no faster than walking passes straight through. **Stops**: the feet finish the step and come
  together (`PASSING`).
- **Quick actions** place the mittens by hand targets in the body's frame with the elbow given (`grips`,
  `motion.reach(…, elbow)`): throw (`THROW`), pick-up (`PICKUP`: a squat, the mitten to where the paper lies; the
  paper comes up in hand at `PICKUP_GRAB`; `pickUp(onDone, at)`), cheer, wave with the free hand, reach, and a
  forearm raised against a strong wind.
- **Low reaches** bend her further over toward something low in front, only as far as needed (`stoop`).
- **Gusts**: an arriving gust turns her head toward it unless the story has her attention, and the body gives a
  little with its push (`gusted`).
- **Springs**: the hem swings with each stride, trails when running and ripples on the side the air leaves (plus a
  shader ripple); the hood lags head turns and lifts at the brim in gusts; the bag sways with the bird's weight;
  the springs rest while she lies down.
- **Bedtime** (`tuckIn` in `story/sleeping.ts`, `layDown` in `traveller.ts`): she sets the bird down, takes the top
  of the quilt in both mittens and draws it back down the bed (`blanketEdge(…, top)`, `blanketLift`, `blanketHeld`
  in `world/sleeping.ts`; `turnReachAt`, `turnGripAt`, `turnDrawnAt`, `turnDrawn`, `turnLift` in `tuning.sleeping`),
  sits on the edge and yawns, swings round onto the mattress on her seat with her hands beside her hips
  (`swingIn`, `Pose.lieFold`), lies back as her hands come to her chest, and draws the quilt up to under her chin,
  where her mittens rest on top of it while she sleeps (`blanketTucked`, `coversHeld`, `coversInset`). Waking,
  she sits up pushing the quilt aside off her side (`blanketAside`; `asideSide`, `asideAlong`, `asideHalf`,
  `asideBack`) and swings out over it; the quilt keeps the shape of her legs until she does, and in bed the hem does
  not swing up to clear her legs (`pose.lie` in `motion.ts`). `tools/sleeping-logic-check.mjs` checks the hands on the quilt; its hilltop preening gate depends on
  seeded randomness, so the bedtime's length (`bedPauseFor`) moves it.
- **Boarding and alighting** are in `docs/boat.md`.

## What the rest of the game relies on

- `src/traveller/body.ts` exports `buildChild(): Rig`, `keepOffChild`, `PALETTE`, `UPPER_ARM`, `FOREARM`,
  `SocketName`. Only `traveller.ts` uses the rig; the scarf uses `PALETTE`.
- Story code works in the body's frame: `reachLocal` targets (the cradle hold, the mirror's hoop grip), sockets
  `cradle`, `satchel`, `shoulder`, `lap`, and the cygnet's climb over the shoulder (`creatures/cygnet/ride.ts` reads
  the body as the parent of the `cradle` socket). Keep that frame's scale and origin.
- `face()`, `breathFrom()`, `mitten()`, `handPosition()`, `planeQuaternion()` read the head and hands.
- The shader keeps the `ATMO_GLSL` hooks: `hemiLight`, `groundAt`, `cloudShadow`, `emberLight`, `dawnLight`,
  `lampLight`, `applyFog`, and `uGroundPos`.
- The stowed paper lies against the bag's far face (`PAPER_STOW`, read by `little-boats-logic-check`).

## Checking her

`?chapter=stage` stands her and the cygnet on open ground with a free camera (`src/story/stage.ts`; `sun=` lights
her from any side). From a `tools/play.mjs` eval step, `__game.story.current.play('<name>')` plays any state, act or
shared moment and `.look('<view>')` picks a view. `node tools/cygnet-gates.mjs` checks every shared moment with the
cygnet against limits; show Jeremy stills (face-on, three-quarter, side and from the play camera above), opened in
Preview.

## Open

- Not yet seen in a level from the play camera in motion: the pigtails, the hood's side line and the open flap.
- Unchecked: a resumed save with the cygnet in the bag starting with the flap open.
