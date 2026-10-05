# Dandelion keyframe prompts

All five generation/edit calls used the built-in `image_gen` tool (`image_gen__imagegen`) with `transparent_background: false`, art direction and visual review by Astra. No fallback CLI/API or additional image model was used. Supplied local images were inspected before use. Final selected PNG outputs remain at the built-in generated-image paths below; final project deliverables were resized and encoded with `sips -s format jpeg -s formatOptions 94 -z 936 1664`. The three JPGs were verified as 1664 × 936 JPEG.

The exact submitted prompt for every call follows in order. Refinement prompts build on their listed edit target; they are not independent replacements for the initial prompt.

## k1-the-clock.jpg — initial generation

Input reference/edit target: `ref-crossing-b.png and ref-crossing.png`.

Output: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-d99a80fe-08aa-43a8-8918-71dc2228eb4c.png`. Intermediate; not a final deliverable.

```text
Use case: stylized-concept. Create a finished concept keyframe for the actual real-time Three.js game Updraft. Single landscape image, 1664 x 936, exact 16:9.

REFERENCE ROLES: first attached ref-crossing-b.png is the exact wooden boat, red sail, rear-quarter viewing direction and character appearance; second ref-crossing.png is the scale guide: the boat is SMALL within a wide gameplay view. Preserve the simple rounded soft 3D rendering of both references, painterly rippling blue sea, warm atmospheric haze. This must look like the existing game, not a cinematic poster or a new illustration style.

CAMERA AND COMPOSITION: fixed crossing gameplay camera, behind and above the boat, approximately 24 metres back and 6.5 metres up, looking ahead on its route. Rear three-quarter view of the boat with stern closer to us, bow pointing diagonally away to the right, as in first reference. Reduce the boat's on-screen size to match the second reference: hull spans about 17 percent of image width, whole boat including sail occupies about 34 percent of image height. Position hull centred near x=53%, y=68%, sail top near y=35%. Horizon is high at y=24%, exactly the reference's ratio of sea to sky, broad open sea foreground. No camera turn toward the passengers. Modest golden birch shoreline receding on the far right only, low layered lavender cloud gathering ahead along horizon. Calm late golden light becoming bedtime dusk, broken subtle sun glitter on the water to the left, cool blue sea; warm haze, no huge visible sun.

BOAT AND PASSENGERS: retain exactly the reference's small rounded clinker wooden dinghy, warm broad wood planks, cream rubbing rail, rope swags, small bow lantern, dark mast, cream stern rudder. The single red scarf sail keeps the same tall tapered quadrilateral profile and horizontal course lines seen in ref-crossing-b, its boom and low rounded fullness; no extra sails, no triangular yacht sail, no redesigned boat. The sail lies on the right side of mast. Little 1.1 metre girl in mustard-orange hooded coat and red scarf sits low in aft boat, back and left three-quarter of hood toward us. She leans naturally over the left visible gunwale toward the floating clock, one mitten resting on the rail. Grey cygnet rides snugly IN HER BROWN BACK SATCHEL, a small long grey neck and head poking up beside her hood; its left wing is bandaged inside the bag. Both look toward the clock, absolutely nobody looks at the camera.

KEYFRAME 1 — THE CLOCK: in the dark blue open water immediately off the visible port bow, a single impossible dandelion seed clock 0.7 metres across, only about one sixth of the boat's 4.2 metre length. It is a perfect delicate spherical arrangement of fine individual white parachute seeds with a tiny brown centre, recognisable as a dandelion clock, not a fuzzy cotton ball or flower. It floats and bobs at the water surface beside the boat, NOT on top of the boat. Centre about 0.35 m above water; a short green stem extends sideways and lies mostly along the water. Water makes small gentle concentric ripples around its wet lower edge. Put it clearly outside the hull, about 0.7 m beyond the port rail and a little forward of the child, screen position approximately x=43%, y=64%, with clear dark water separating clock and boat. A few 3–5 individual parachute seeds have already come loose and drift a short distance above it, softly catching low sun. Keep it SMALL in the actual game world; don't enlarge it into a giant foreground flower. The scene is tender, quiet and optional: the boat continues sailing.

No text, no lettering, no UI, no cursor, no human hand of the player, no symbols, no sparkles, no luminous particles, no magic glow, no flare, no extra people, no extra birds, no inset detail, no border. Only ordinary low sunlight on physical seeds.
```

## k1-the-clock.jpg — final refinement

Input reference/edit target: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-d99a80fe-08aa-43a8-8918-71dc2228eb4c.png`.

Output: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-66704f81-e335-4f38-870b-2c81cf14f300.png`. Selected for the final JPG.

```text
Use case: precise-object-edit. Refine this Updraft concept keyframe. Preserve the existing camera direction, high horizon at 25% image height, sea, shoreline, clouds, palette, rendering style, boat geometry, red scarf sail and both character identities.

The BOAT MUST BE SMALLER IN FRAME to match the distant 24 m back, 6.5 m high crossing gameplay camera. Reduce the whole boat with all its parts and passengers uniformly to 78% of its present on-screen size, without changing any of their relative proportions. Keep the hull in the lower middle, centre x=54%, y=68%. The full assembly from mast top to keel should now occupy only about 37% of total image height and the hull itself about 14% of image width. Keep the rear three-quarter view and everyone facing away from us.

Scale the dandelion down by the same factor so it remains 0.7 m wide against the unchanged 4.2 m boat. Bring it closer beside the visible left/port gunwale and a little forward: only about 0.6 m of open water between its nearest seeds and the boat. Its seed-sphere centre should appear approximately at x=45%, y=65%. Keep the short stem GREEN, lying almost horizontally in the water, not yellow. Keep the ball round and fine white with a few distinct loose parachute seeds and a tiny wet ring; no glow.

The child's torso should lean visibly and gently left over the port gunwale toward that clock, seated hips remaining low in the boat, one mustard mitten on the rail for support, orange hood looking down toward the clock. The brown satchel and grey long-necked cygnet stay securely on her back and follow her lean. Both heads still face the clock and away from the camera. No extra characters or objects.

Everything else unchanged. Single full-frame 16:9 image, no text/UI/cursor/sparkles/graphic marks.
```

## k2-blown.jpg — initial generation

Input reference/edit target: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-66704f81-e335-4f38-870b-2c81cf14f300.png`.

Output: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-2f9d6098-0484-4899-8eaf-d1ab5d58b62a.png`. Intermediate; not a final deliverable.

```text
Use case: stylized-concept / precise-object-edit.
Create KEYFRAME 2 of this exact Updraft gameplay scene, a moment after the supplied image. Preserve this exact wide 16:9 composition, fixed camera behind and above the boat, high horizon at 25%, small boat lower middle, same boat size, exact wooden hull and red scarf sail, child and grey cygnet in her brown satchel, shoreline, sea and low clouds. Do not zoom, change viewpoint, redesign or move the boat. Use the same soft stylised 3D rendering. Nobody looks toward the camera.

The player's moving wind has swept THROUGH THE SMALL DANDELION CLOCK beside the boat. The wind is only THREE fine, soft, tapered, translucent white strokes, passing diagonally from lower right through the clock toward upper left. Keep these strokes local to the clock, each only about 1 to 2 metres long. They are narrow like the game's ordinary wind ribbons; not luminous, not thick ribbons, no circular vortex. A slight narrow ruffle on the water under that stroke.

The clock has just been stripped: a small brown bare seed receptacle about 0.12 m across bobs on the water in precisely the former clock's position, still attached to its short GREEN stem lying sideways along the surface, with a couple of gentle contact ripples. Three or four remaining seeds cling to the head; the full white ball has gone.

The seeds physically detach and lift: make a long soft airy plume of individually readable TINY WHITE DANDELION PARACHUTES rising up and away to the upper left, beginning just above the bare head. About 65–85 individual seeds in all, each a very fine white umbrella crown carried over a tiny dark pendant seed, sunlit ivory at the edges. Lower seeds are clearly separate little parachutes, not white dots. Close to the water the plume is narrow; it spreads and loosens as it rises, curling gently with the moving air, not a decorative S-ribbon. The top seeds become very small with distance. The plume's broad path runs from the head near x=43%, y=65%, through x=38%, y=50%, x=31%, y=33%, and ends in the sky above the low cloud around x=29%, y=8–13%. Leave plenty of empty sky between individual seeds. The lower and middle plume reads beautifully against blue water; a few highest seeds cross the dusky cloud into the sky. No continuous luminous trail between seeds, no confetti, butterflies, sparkle stars, mist column or magic effect. These are physical windborne dandelion seeds catching the low sun.

The child eases out of her lean, still seated, tilts her orange hood slightly up and left following the rising seeds. The grey cygnet's long neck stays upright in the satchel and turns the same way. Keep their familiar simple geometry and their small on-screen scale. Keep the low gold afternoon turning to lavender evening; no sudden night.

Single landscape image 1664 x 936, exact 16:9, no text, no logos, no UI, no cursor, no player hand, no inset, no borders, no additional people or animals. This is a buildable game keyframe, not a poster.
```

## k2-blown.jpg — final refinement

Input reference/edit target: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-2f9d6098-0484-4899-8eaf-d1ab5d58b62a.png`.

Output: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-3357b96c-892c-4ffc-ac1d-9946e5463638.png`. Selected for the final JPG.

```text
Use case: precise-object-edit. Change ONLY the small wind-stroke and bare-head detail at the base of this seed plume; preserve the entire rest of this image exactly, including the excellent physical dandelion seeds, fixed gameplay framing, boat, characters, water and sky.

The two broad pale ribbons currently seem to come from the girl's hood and point into the plume. REMOVE THEM COMPLETELY. Wind must visibly pass across the floating dandelion head on the WATER, not originate from the girl.

Replace them with THREE much FINER, FAINT SOFT WHITE TAPERED WIND LINES, with no light emission or glow. Each line is only about 1–2 pixels wide at this full image size, broken and fading naturally. Lay the short strokes diagonally THROUGH THE FLOATING HEAD near x=42.5%, y=65.5%, flowing from lower-right toward upper-left. The strokes begin over EMPTY WATER around x=45.5%, y=69%, pass across the brown head and continue only to around x=39%, y=61%. The unequal strands spread just a little as they die. Keep them short and local, disconnected from the child's body and from the distant seed plume. They should read as a brief cursor sweep in the game's ordinary wind style. Do not draw a cursor or arrow.

Make the seed receptacle a very small, unmistakably BARE BROWN head, approximately 0.12 metres across, with only 2–3 sparse fine seed stalks left. The short stem lying on the water must be muted OLIVE GREEN, not a yellow luminous line. Keep its small contact ripple.

All other image content absolutely unchanged. No text, UI, logos, sparkles, magic trail, new objects or extra wind effects. 16:9.
```

## k3-first-stars.jpg — final generation

Input reference/edit target: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-3357b96c-892c-4ffc-ac1d-9946e5463638.png`.

Output: `/Users/jeremy/.codex/generated_images/01a10b59-53a8-7510-8ab6-1c19826e258e/exec-c98ebb47-2628-4da7-baee-f0051fdec1b8.png`. Selected for the final JPG.

```text
Use case: stylized-concept / lighting-weather continuity edit.
Create KEYFRAME 3, a little later in this exact Updraft crossing scene. Keep the identical fixed gameplay camera 24 metres behind and 6.5 metres above the small boat, rear three-quarter view, the high horizon at 25% image height, the exact same size and lower-middle placement of the boat, original wooden dinghy geometry and RED SCARF SAIL shape, and same soft stylised 3D game-rendered look. Do not turn the camera or look up with it. There is still much more sea than sky. Preserve the game's subjects and world, not a dramatic new poster composition.

THE MOMENT: the seeds have travelled high above the low cloud and quietly become the evening's first faint stars. REMOVE the long low-altitude seed plume and ALL visible wind lines. The space between the little boat and the horizon is empty blue water and air again. The tiny bare brown seed-head and short dull olive green stem may remain bobbing behind and to the left of the boat, lower and less prominent than before, with a small faint contact ripple. No full dandelion clock remains.

The evening light has lowered gently: upper sky shifts to dusty lavender blue, low horizon keeps a thin muted peach and old-gold warmth. Soft low lavender clouds gather ahead, their tops warm at the edges. The large gold glitter field on the left sea becomes dimmer, narrower and broken; most of the sea is quiet blue with violet shadows, still readable, never black. Birch shore stays visible on far right but subdued by dusk haze. It is the beginning of evening, not deep night. Keep the red sail readable red and the orange coat warm; existing tiny bow lantern has a modest ordinary warm light, no new large light source.

In the small strip of CLEAR SKY ABOVE THE LOW CLOUD, scatter only about 18–24 very faint tiny white star POINTS at irregular positions. Give them the loose spread of the former plume carried away overhead: the cluster begins in the upper-left sky where the seeds were going and disperses across the upper middle, roughly x=25–69%, y=3–15%. They should look like distant first stars in an evening sky: small dim white pinpoints, not drawn star shapes, crosses, lens flares, glowing confetti, sparkles, glitter dust or a magical trail. Do not connect them. No halo. Different spacings, with generous empty sky between them. The lowest stars appear just above the cloud top; none in the water or below the cloud. Their visibility should reward looking, not shout.

The little girl stays seated in the boat and visibly tilts her orange hood and head back to LOOK UP TOWARD THESE STARS, a quiet small lift of chin toward upper left. Her face is turned away from us, only a little cheek/profile can be seen if needed; no eye contact with the camera. Her posture has settled from the earlier lean; both mittens rest naturally on the boat. The grey cygnet remains in her brown satchel with its long neck poking up beside her hood and also gazes upward. Bandaged left wing stays safely in the bag. Keep their familiar small scale.

Only the light, the seed-to-star state and the quiet gaze change. Wordless gentle dream logic; nobody performs amazement. Single full-frame landscape image 1664 x 936, exact 16:9. No text, no UI, no cursor, no player hand, no logos, no additional people or animals, no graphic effects, no inset or frame.
```
