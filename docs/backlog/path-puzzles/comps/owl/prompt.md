You are the concept artist for one short scene in Updraft, a browser game (real-time Three.js) where the player is the wind. Paint concept keyframes that a 3D build will match, plus a plan diagram. Use your image generation. Save every image as a PNG in the current directory with the exact names given below, and write `notes.md`.

## Reference images (attached, also in this directory)
- `wood-land.png`: the room painting for the dark wood. Its mood, palette and light are the target: blue-black night forest of bare trees, warm ember glow, faint cold moonlight on outlines.
- `ref-ember.png`: the approved ember. An abstract orb of warm light with translucent golden veils swirling round it. Never a flame, a fire, coals in a pit or a glass ball.
- `ref-jeremy-play.png`: real play, the moment before this scene. It is the owner's screenshot and his complaint: the thing she fears is tiny and far off, up in the frame's corner, out of focus.
- `ref-current-antlers.png`, `ref-current-reveal.png`, `ref-current-owl-flight.png`: the current in-engine attempt, which is NOT good enough. Use them only for the characters' designs and the game's rendering style (soft, stylised, simple shapes and shading). What's wrong with them:
  - The rock is a huge tower of stacked slabs that dominates every frame.
  - The camera sits behind the child, so her reactions never read.
  - The antlered shadow is muddled behind the real stump.
  - The owl is small and lost against bright stone.

## The characters (keep their designs)
- **The child:** a small girl, about 1.1 m tall. Orange hooded coat, red scarf, dark boots, a brown satchel slung at her side. A cygnet (a grey baby swan) rides in the satchel, its head and long neck poking out.
- **The owl:** small, round and fluffy, brown-grey, with big round yellow eyes. Cute, not realistic.
- **Nobody looks at the camera, ever.** No fourth wall.

## The scene (the beats, in order, all from ONE fixed camera)
The child walks a path through the dark wood at night. Coals wait on the ground, and the player lights each one by winding an updraft over it. She can only walk as far as the light reaches.

1. **DREAD.** She has stopped in the dark on the path, beside an unlit coal, some way short of a bend. Ahead in the blackness there are only two glowing, blinking eyes, staring at her. You cannot see the stump, the rock or anything else: just the eyes, and her faint moonlit outline. The eyes are the focus of the frame.
2. **IT GETS WORSE.** The player lights that coal, the one beside her on the path. It is NOT at the stump: it stays back on the path where she waits, clearly well short of the stump (roughly 6-9 m), and it must be visible in the frame, near her. Its low warm light reaches out down the path and throws a HUGE antlered shadow, with two glowing eyes in it, up a rock face behind. The thing casting it is a dead tree stump with two antler-like dead limbs at the top, and the owl sits in the fork between them. The stump is only a bit taller than her: about 2 m to the fork, the tines reaching about 2.6 m. Its shadow on the rock is HUGE, two or three times the stump's size, looming over her. That is dream logic, not physics: the shadow points away from the coal, so the coal reads as its cause, but its size is free. If another light in this wood helps the frame (fireflies under the trees, a faint far-off flicker of the storm), you may use it, but the coal must still read as what throws the outline. The real stump stays dark: the coal lights the rock, not the bark. The camera must sit off the coal-stump line, so the shadow on the rock shows clear of the stump on screen, not hidden behind it. She flinches back, mittens drawn up to her scarf. This is the scariest frame.
3. **"OH."** A second coal, the only one at the stump, off to its side, is lit. Its light comes from the side, and now you see the stump for what it is: an old dead stump with a small, cute owl in its fork. On the rock, the huge antlers have swung aside and shrunk to an ordinary stump's shadow, with a little round owl shape in it. The owl blinks and tilts its head at her, and she looks back at it. Her shoulders drop and her hands lower.
4. **DELIGHT.** The owl flies off: a fluff-up, a little hop, wings spread wide, then soft flaps up past her and away, up and clear of the trees. Its small flapping shadow flits across the same rock that held the monster. She turns her head and body to follow it, and the cygnet pops up out of the satchel to peep after it. This is the warmest frame.

## What to deliver
- `k1-dread.png`, `k2-antlers.png`, `k3-oh.png`, `k4-delight.png`: 16:9, all four from the SAME camera position and framing, so only the light and the characters change between them. Choose that camera for the best possible composition of all four together. Her reactions should read, so give a three-quarter or side-on view of her rather than her back. Keep her large enough in frame to read.
- `k2-portrait.png`: beat 2 framed for a phone held upright (9:19.5), from roughly the same place.
- `flight-strip.png`: a storyboard strip of 6 small panels for the owl's take-off and flight, showing pose and path. Make it charming, a little clumsy-cute, and readable in the dark.
- `plan.png`: a top-down plan in metres. Show:
  - the path and the bend;
  - the child, the first coal, the stump, the rock face (with its width and height), the side coal and the camera, with its height and aim;
  - the line each coal's light takes past the stump onto the rock;
  - the owl's flight path.
- `notes.md`: the layout numbers from the plan, the camera and lens, the rock's size and shape (its proportions and surface), and one line per keyframe on what makes it work.

## Constraints that matter for the build
- **Exactly one coal at the stump** (the side coal). The first coal belongs to the path where she waits and must never read as a second coal by the stump. This is the owner's explicit ruling.
- **The rock is modest:** one weathered stone outcrop face, just big enough to carry the shadow, about 4 m tall. It must not be a tower of stacked slabs, a smooth loaf or a tombstone. Moss and leaf litter at its foot.
- **The forest stays dark between beats.** Faint cold moonlight only on outlines; the forest never goes fully black.
- **Light only from visible sources:** the coals' warm glow and that faint moonlight. Nothing glows without a reason, except the owl's eyeshine.
- **Simple, buildable shapes,** in the game's soft, stylised 3D look.
