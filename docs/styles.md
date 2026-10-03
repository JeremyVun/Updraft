# Visual language

"Painted golden hour": small islands, crossings and a warm late-afternoon light that deepens through the journey,
drawn with soft painterly shading, where the wind is the most visible thing on screen. A dream: shape, colour and
feel over detail. How each room plays is in `docs/chapters.md`.

- **Light**: a low sun behind and to the left of the still island, so the meadow is backlit. Grass tips glow with
  light passing through them, petals catch warm light, the far sea glitters toward the sun. Shadows are cool
  blue-teal, never black. Hills and trees cast long soft shadows baked from the fixed sun (`src/world/ground.ts`).
- **Wind is visible everywhere**: grass bends in travelling waves, and flattened grass turns paler and shinier, so
  gusts read as bright streaks. Petals lift in bursts. The sea ruffles into darker cat's paws under gusts, drawn
  out along the wind; the weather runs the sea, and a squall breaks it into whitecaps (`Chapter.storm`). Cloud
  shadows drift across the land with the breeze.
- **Weather grades the world**: a squall takes the warmth out of the light, so the drowned village's sunset pinks
  go to slate on the way to the dark wood, while a night keeps its blue moonlight (`bruise`,
  `src/world/palette.ts`). The child's mustard coat is then the only warm thing in frame. The boat rolls, pitches
  and drives harder on a running sea.
- **The turn of the year**: the season deepens island by island to full winter on the sleeping island (`season` per
  chapter, `uSeason`): the grass keeps its green but goes over to seed and colder. When the curtains open it turns
  toward spring and eases back through the sea and the mirror, so home's grass is as fresh as the first island's,
  brighter and warmer green. The sleeping island has its morning, the sky mirror its sunset, and home holds an
  afternoon until the door.
- **Grass**: dense and slightly chunkier than real, so it reads at game distance. Deep green at the root, warm
  yellow-green at the tip, with large soft patches of drier gold and cooler green. Near the beach it thins into
  short, lighter tufts rather than ending in a hedge.
- **The tree**: one broad tree on the still island's ridge is the landmark. Its canopy is small leaf cards shaded
  as soft spheres, dark inside and warm on the sunlit side, swaying with the live wind. The same tree grows again,
  two-thirds the size and alone, on the slope above the home jetty (`HOME_TREE`).
- **Rocks**: rounded, mossy on top, a few clusters near the shore and on the hills.
- **Footprints**: the child's round-toed boots and the cygnet's three-toed webbed feet leave small soft dents in
  bare sand, a little darker and cooler inside, their walls modelled by the sun; they crumble softer as they age,
  fade within the minute and are wiped wherever the swash runs over them. Never on grass or snow.
- **Dream echoes**: a small thing from the room before lies washed up on the next arrival beach, half in the sand on
  a damp patch above the tide line: a pegged pillowcase, an oversized yellow rubber duck with an orange bill tipped
  on its side, a run of piano keys a little larger than the piano's, the swing's seat with gold leaves. Static, off the walk, never at home.
- **Petals**: small pastel pink, cream, yellow and a little lilac, with a few glowing pollen specks, hidden in
  flower patches until they tumble.
- **Wind lines**: thin white tapered ribbons that follow the actual flow, fade in and out, and curl as they die, in
  the spirit of *The Wind Waker*. They appear along the player's gestures, spiral round an updraft, and sometimes
  trace a strong natural gust.
- **The swirl**: circling lays a leading turn into the air, with detached, fading pieces rising above it. It
  stretches and disperses rather than stacking hoops. The cygnet, the wrapped scarf trunk and the wood's waiting
  coal use the same invitation, giving way to the player's real updraft.
- **Wind invitations**: one ivory gust crosses the thing that needs wind, with unequal trailing strands curling
  apart. The same effect sweeps sideways, lifts a scarf loop or pulls a bow outward. A soft cool edge keeps contrast
  on pale cloth and a minimum light level keeps it visible in the dark wood.
- **Sea**: turquoise over a sandy seabed glimpsed through the shallows, deep blue further out. Broken waves roll in
  as lines of lacy foam, run up the beach as a thin sheet and slide back, leaving wet sand that dries. Sun glitter
  twinkles toward the sun; the land, the boat and the child are mirrored, blurred by ripples. In the still world it
  lies glassy and grey.
- **Haze**: distance fades toward a sky colour that is warm toward the sun and cooler away from it. The next
  island is never more than a smudge in it.
- **The departure kite**: a ruled-paper diamond with a faded red foot and a bow tail, one per room, flying over the
  berth where the boat waits at every departure (`story/departure-kites.ts`); none at arrivals or at home.
- **The boat**: a little clinker-built boat a child would dream of, after the concept boat
  (`assets/art-direction/boat-concept-kite-drawn*.png`): deep enough that the seated child rides with the gunwale
  at her belly, round and flat-bottomed, sitting flat in the sea, its sheer lifting only a little toward the ends. Six wide
  strakes of warm varnished wood under a cream rubbing strake hung with heavy rope swags; a thick white post at the
  stem carrying a brass lantern, dull by day and lit from sunset through the night; a stout dark mast and boom,
  turned knobs on the transom, a cream rudder and tiller, a painted pail and a coil of rope on the boards. The laps
  are drawn by the shader and fade to their average tone when too fine to draw. The sail is stitched quilt panels
  with doubled hems, corner patches and soft folds that ease as it fills; after the birches it is the red scarf's
  wool, knitted courses across it, a little sun-faded. See `docs/boat.md`.
- **Glider**: warm off-white notebook paper with faint ruled lines and a red margin, glowing when backlit, leaving
  a faint ribbon from each wingtip. It stays plain paper until it opens into the drawing at the end.
- **The child**: a little girl, from the concept sheet (`assets/art-direction/child-front-concept-v1.png`),
  remembered rather than detailed. A big soft mustard hood with a rolled rim and a centre seam, her round face low
  inside it with chubby cheeks, big dark eyes, a button nose and a small smile; a fringe parted in the middle and
  swept out to her temples, and low pigtails with knitted bobbles; a short mustard A-line coat from narrow
  shoulders with three brown buttons; mittens to match; charcoal trousers and round-toed matte brown leather boots; a
  chunky brick-red knitted scarf with two unequal ends; a brown leather satchel low on her back. The clothes answer
  the wind and her movement on springs, not a cloth simulation. See `docs/child.md`.
- **The drawing**: the paper plane unfolds into a child's crayon drawing on ruled paper: sun, green hills, a dashed
  wall, the white cottage with a red door and lit windows, a yellow figure with a red scarf, the plane itself.
- **Creatures**: small, round and slightly oversized so they read from the default camera. Warm brown rabbits (one
  white) whose long ears glow pink against the sun, plump finches with buff, rosy or yellow breasts, white gulls
  with grey wings and dark tips, white, pale yellow and blue butterflies, and sheep in loose flocks (creamy fleece,
  black faces and legs, some with a blue or red raddle mark, lambs springing beside their mothers). Soft wrapped
  light, cool shadows and a warm rim when backlit. They move in springy, eased arcs and all answer the wind:
  rabbits flatten their ears or bolt, finches burst up as a flock, gulls circle up an updraft, butterflies tumble
  away and drift back, sheep bunch rumps to a strong wind.
- **The swans and the cygnet**: the adults white above and pearl-grey below so they read on a pale sky, necks
  straight out, black feet trailing, a slow deep beat in a V. The cygnet is a warm pale taupe-grey down that stays
  pale in shade and at distance, not slate; white shows at its wing edges by the last island. See
  `docs/cygnet.md`.
- **The still world**: before the first gust the still island is grey, dim and quiet: colourless grass, a bare
  tree, a glassy sea, no animals. Colour returns only where the wind has been, and the whole frame warms at once
  when the island is whole.
- **The meadow**: rolling pasture in a patchwork of fields, each its own green, gold hay or dark rushes, bounded by
  painted grey dry-stone lines; short grazed grass and scattered wildflower heads. Asleep and grey until the
  piano's music wakes it. A sun shower may pass: thin streaks catching the low sun, a bright grey veil, wet sheen
  on the grass, and a rainbow standing in the rain over the sea ahead. At sunset a murmuration of starlings turns
  near the sun.
- **Sea life**: a humpback rolls up out of the open sea in one long slow arc, its spout glowing gold against the
  low sun; dolphins run with the boat; small silver fish leap and flash. On the open sea three of the little boats'
  toys are come across sailing their own way, smaller than in their own room, trailing little foam.
- **Final image**: HDR lighting, gentle bloom, ACES tone mapping, cool shadows and warm highlights, soft vignette,
  faint lens fringe at the corners, fine grain.
- **Interface**: no gameplay narration on screen. The cursor is a soft ring that tightens and glows while an
  updraft charges. Small round buttons in the corner: a speaker that breathes when muted, fullscreen, and graphics
  quality as four ascending bars (one filled for Low, two for Medium, three for High, four for Ultra) tracking the
  level in use while Auto adapts; bars stay unfilled until the first automatic level is known. Its blue-green menu has compact
  ivory sans-serif labels and a quiet gold check; touch rows stay 44 px. The controls work on the loading veil and
  throughout play; the menu takes arrows, first letters, Enter/Space, Escape and Tab, and dismissing it never
  starts play or blows wind.

## Start screen

Set the mood and invite one click; discovering the wind belongs in the game.

- Muted sage through the centre, sea blue-teal toward the edges and diffuse straw-gold light above and to the
  left, with a still vignette and slowly drifting haze; night checkpoints deepen these toward slate and dark
  green. Pointer movement gently nudges the whole colour field and it settles when the hand stops. No cursor
  trails, local spotlight or mist following the pointer.
- A browser-drawn copy of the game's hollow cursor stays responsive during graphics setup. Two or three sparse
  ambient wind ribbons borrow the game's taper.
- One centred invitation: "Begin", or "Continue" with a valid checkpoint, in warm ivory italic serif (Iowan /
  Palatino / Georgia), with a small mouse outline for a fine pointer and a delicate rounded outline on touch. Its
  opacity breathes gently (.95 to .82) without disappearing, scaling or bouncing; reduced motion stills it.
- The word appears after graphics preparation. Click, tap, Enter or Space starts sound and the story, and the veil
  dissolves over the first real scene; the entering gesture never reaches the wind field. A failed boot offers
  "Try again" on the plain veil. The veil needs nothing downloaded to read complete; the room's painting is added only
  once it has decoded. It stays silent and is removed after the fade.
- **The room's painting.** When the game is ready, a full-screen painting of the room the player will start in (the
  Still island for Begin) fills the veil behind everything and fades up over 1.6 s, with a neutral near-black shade
  taken from the paintings' own shadows rising from the bottom and eased out by 40% up (`.veil-shade`, the one place
  to retune it; Continue keeps 4.5:1 at its faintest on the palest rooms, the Still island and Cloud stairs). The
  invitation then sits low and centred in the painting's quiet band: its centre at `100% - max(160px, 22vh)`.
  A finished save reserves at least 220 px below the invitation for its two secondary actions and corner controls;
  `chapters` 50 px below it, `start over` 50 px below, or 94 px under `chapters`. A painting that has not decoded
  when the veil turns ready is never shown that visit: the plain veil keeps the invitation centred, so nothing moves
  once on screen. One WebP per visit (`src/paintings/<room>-land.webp`, or `-port` under 3:4), requested at low
  priority. Cloud stairs anchors at 50% 65% when cropped, giving the close stairs room above the invitation.
  Leaving, the painting fades with the invitation (.8 s) before the veil dissolves, so it never cross-fades
  into the game's own view; while chapters are open it fades back to the plain veil (.6 s). Reduced motion: no fades.
- `start over` is drawn like `chapters` (16 px italic at .5) and shows for any valid save. Its first press turns it
  in place into `start over and lose your progress?` (.85); a second starts the first island. The question goes back
  after 6 s, on Escape or when focus leaves it.
- `tools/start-check.mjs` checks entry, audio gating, the invitation's place with and without the painting, ambient
  motion, checkpoint restoration and retry; `tools/start-over-check.mjs` checks start over.

## Rooms

- **Island of lines**: washing hung so dense the child is small beneath it; ordinary laundry pale linen, the
  family's garments rich blue, warm red and the child's yellow.
- **Little boats**: the pools meet the turf through clumps of reeds, slender, darker and bluer than the grass, with
  a few dark brown seed heads, standing in the shallows and bending with the wind.
- **Dark wood**: dark, with faint cold moonlight on wet trunks, uneven ground and the travellers' outlines; never so
  dark that the forest disappears. The embers are abstract light after the approved study
  (`assets/art-direction/wood-ember.png`): honey and apricot veils curling round a warm heart, breathing and
  yielding to wind, with small warm motes distinct from the cooler fireflies (`src/fx/ember-orb.ts` for the heart,
  `src/fx/ember-veils.ts` for seven independently moving veils). No literal campfire, flame, solid sphere or
  scattered glowing chips. Waking a coal reveals a warmer patch of the way ahead. Lightning is subdued over land.
  The floor is sparse fine tufts over mottled leaf mould and moss.
- **Sky mirror**: an uninterrupted skin of water doubling the sunset and clouds. No ground fog, moon prop or
  revealed sand road. A little wooden stool, an enamel soap bowl and a brass hoop are the one fragment of
  childhood. Bubbles have nearly clear centres, shifting rose, pearl and blue rims, soft highlights and a slight
  wobble, reflected in the same glass as the child. Each footstep, hers and the cygnet's, sets a few fine rings running
  out over the glass that catch the light and break up the reflection at their feet. Fallen lights are small gold starbursts on the surface; caught
  lights glow in their bubbles; returned lights rise into the sky and reflect below. The camera looks across a
  bubble's travel, keeping bubble, reflection and target apart.
- **Sleeping island**: slate-blue night round a small warm bed on an open grassy terrace; lavender-grey distance
  and pale moonlit edges; mist that leaves the cygnet readable and has an uneven, continuous boundary, never stacked
  planes. The window on the crest holds a cream seam, tied with a broad coral ribbon whose loose end hangs beyond
  the lip. The hill is natural, with continuous convex slopes and sparse buried rock; never a flattened strip or an
  inset shelf. Snow reads as snow, not a laid sheet: wind-scooped and ridged in the middle, breaking into patches at
  the rim, blue on faces turned from the moon, a few glinting crystals, spindrift on gusts; strokes lift powder off
  in grains and soft clouds. Short curved winter blades keep the meadow's wind response; frost gathers toward
  tips; bare birches and snowdrops. Morning is golden light and fresh green turf under a pearl-blue sky, the green
  following the light down the hill, in the island's own winter palette rather than the sunset reversed.
- **Home**: a soft clear afternoon through the farewell and the drawing, with the low sun above and left of the
  real cottage as in the drawing; the cottage faces the approach with a slight turn, its door and two windows
  echoing the drawing. A modest washing line behind its left corner repeats the island of lines' blue, red and
  yellow at household scale, fluttering gently. Sunset begins as the child watches the plane go; night and
  floating fireflies are there when the door opens. The last view pans from the crest to the moon and the sea, the
  horizon on the lower third and stars glinting in the water.
