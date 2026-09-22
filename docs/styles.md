# Visual language

"Painted golden hour": a small island, a crossing and endless green hills in warm late-afternoon light that sinks to sunset and night, drawn with soft painterly shading, where the wind is the most visible thing on screen.

- **Light**: a low sun (13°) sits behind and to the left of the island, so the meadow is backlit. Grass tips glow with light passing through them, petals catch warm light, and the far sea glitters toward the sun. Shadows are cool blue-teal, never black. The hills and the tree cast long soft shadows baked from the fixed sun (`src/world/ground.ts`).
- **Wind is visible everywhere**: grass bends in travelling waves, and flattened grass turns paler and shinier, so gusts read as bright streaks across the field. Petals lift in bursts. The sea ruffles into darker cat's paws under gusts, drawn out along the wind, and the weather runs it: a squall gets the sea up and breaks it into whitecaps (`Chapter.storm`). Cloud shadows drift across the island with the breeze.
- **Weather grades the world**: a squall takes the warmth out of the light and the daylight with it, so the sunset pinks of the drowned village go to slate on the way to the dark wood, while a night keeps its blue moonlight (`bruise`, `src/world/palette.ts`). The child's yellow coat is then the only warm thing left in frame. The boat rolls, pitches and drives harder on a running sea.
- **Grass**: dense and slightly chunkier than real, so it reads at game distance. Deep green at the root, warm yellow-green at the tip, with large soft patches of drier gold and cooler green. Near the beach it thins into short, lighter tufts rather than ending in a hedge.
- **The tree**: one broad tree on the ridge is the landmark. Its canopy is made of small leaf cards shaded as soft spheres, dark inside and warm on the sunlit side, and it sways with the live wind.
- **Rocks**: rounded, mossy on top, a few clusters near the shore and on the hills.
- **Petals**: small pastel pink, cream, yellow and a little lilac, with a few glowing pollen specks. They lie hidden in flower patches in the grass and glint as they tumble.
- **Wind lines**: thin white tapered ribbons that follow the actual flow, fade in and out, and curl as they die, in the spirit of *The Wind Waker*. They appear along the player's gestures, spiral around an updraft, and occasionally trace a strong natural gust.
- **The swirl**: circling the cursor lays a leading turn into the air, with detached, fading pieces rising above it. It stretches and disperses rather than stacking complete hoops. The cygnet and the wrapped scarf trunk use the same invitation, giving way to the player's real updraft.
- **Wind invitations**: one ivory gust crosses the object that needs wind, with unequal trailing strands curling apart. The same effect sweeps sideways, lifts a scarf loop or pulls a bow outward. A soft cool edge preserves contrast on pale cloth, and a minimum light level keeps air visible in the dark wood. Local gestures suppress the demonstration; it returns after inactivity. Invitations never advance a puzzle.
- **Sea**: turquoise over a sandy seabed glimpsed through the shallows, deep blue further out. Broken waves roll in as lines of lacy foam, run up the beach as a thin sheet and slide back, leaving wet sand that dries. Sun glitter twinkles toward the sun; the land, the boat and the child are mirrored, blurred by ripples. In the still world it lies glassy and grey.
- **Haze and the archipelago**: distance fades toward a sky colour that is warm toward the sun and cooler away from it. The other islands of the archipelago are grey, lifeless silhouettes in that haze.
- **First crossing**: preserve the original clear light while rounding the still island and looking back. As the farewell camera releases and the boat closes from 330 to 270 metres of the Lines berth, ease into Birches' continuous distance haze. Washing and grass resolve on the final approach. `tuning.world.linesCrossingHaze` sets its strength; `linesHazeFrom/To` place the transition.
- **Departure kite**: the same ruled-paper diamond, faded red foot and bow tail marks every boat departure. One kite belongs to the current room; arrival beaches and home have none. It answers the wind without requiring interaction. Preserve the door reveal on Lines, the final bend among the little boats, the opening beyond the wood and the departure after the sleeping island reunion. The mirror keeps its landing-stage kite visible during star play; the completed constellation still controls the boat’s final approach.
- **Glider**: warm off-white notebook paper with faint ruled lines and a red margin, glowing when backlit, leaving a faint ribbon from each wingtip.
- **Creatures**: small, round and slightly oversized so they read from the default camera. Warm brown rabbits (one white) whose long ears glow pink against the sun, plump finches with buff, rosy or yellow breasts, white gulls with grey wings and dark tips, and white, pale yellow and blue butterflies. Soft wrapped light, cool shadows and a warm rim of fur or feathers when backlit. They move in springy, eased arcs (hops squash and stretch, ears lag and flop) and all of them answer the wind: rabbits flatten their ears or bolt, finches burst up as a flock, gulls circle up an updraft, butterflies tumble away and drift back to the flowers. Sheep graze the walled pastures in loose flocks: plump clouds of creamy fleece with black faces and legs, some carrying a farmer's blue or red raddle mark, lambs springing into the air beside their mothers; they bunch with their rumps to a strong wind, trot away from a gust, and lie down together at night.
- **The still world**: before the first gust everything is grey, dim and quiet: colourless grass, a bare tree, a glassy sea, no animals. Colour returns only where the wind has been.
- **The hills**: endless rolling pasture in a patchwork of fields, each its own green, gold hay or dark rushes, bounded by grey dry-stone walls with finches on them. Short grazed grass, scattered wildflower heads (buttercup, daisy, clover, violet). One white cottage with a thatched roof and a red door stands below the last hill.
- **Time and weather**: the walk inland sinks from golden afternoon to a deep orange sunset, then dusk and a cool moonlit night with stars, fireflies and glowing windows. A sun shower may pass: thin streaks catching the low sun, a bright grey veil, wet sheen on the grass. A rainbow comes down on the island as the child sails away. At sunset a murmuration of starlings turns over the far hills beside the sun.
- **Home light**: hold a soft, clear afternoon through the cygnet farewell and unfolding: warm sunlight, cool shadows, restrained gold haze. Frame the low sun above and left of the real cottage, matching the drawing. Hold the flatter paper within the hands' reach, seen over a slightly higher shoulder; its drawn sun and house must both read. The cottage faces the approach with a slight turn: its door and two windows echo the drawing, while a little side remains visible. Begin sunset while the child watches the released plane; darkness and floating fireflies are established by the time the door opens.
- **The family at home**: one modest washing line behind the cottage's left side repeats the island of lines' blue and red adult garments, with the smaller yellow jumper between them. Reuse their silhouettes and colours at a household scale, with a gentle flutter and fixed pegs. Angle the line slightly away, below the roof and away from the doorway; it belongs in the background, without another staged sleeve-reaching gesture.
- **The child and the drawing**: a small child in a mustard hooded coat with a long red scarf that streams in the wind. The paper plane unfolds into a child's crayon drawing on ruled notebook paper: sun, green hills, a dashed wall, the white cottage with a red door and lit windows, a yellow figure with a red scarf, the plane itself.
- **Sea life**: on the crossing a humpback rolls up out of the open sea in one long slow arc — dark blue-grey back, white water where it breaks the surface, a spout that glows gold against the low sun and drifts away on the wind, and pale flukes streaming water as it dives — while small silver fish leap near the boat and flash in the sun.
- **The last goodbye**: stay at the hill crest while the child walks down to the cottage. Only pan the gaze toward the house, then onward to the moon and sea for the credits; the camera does not follow the child or crane upward.
- **Final image**: HDR lighting, gentle bloom, ACES tone mapping, cool shadows and warm highlights, soft vignette, faint lens fringe at the corners, fine grain. The page opens through a dim pastel veil, with ivory wind ribbons and a single serif invitation; see the start screen below.
- **Interface**: no gameplay narration on screen. The cursor is a soft ring that tightens and glows while an updraft charges. A small speaker button in the corner breathes when muted. Graphics quality uses three ascending bars in a matching round button beside sound and fullscreen: one filled bar for Low, two for Medium, three for High. The bars track the rendered world-detail tier as Auto adapts; Auto remains selected in the menu and the tooltip includes its current tier. During loading, bars stay unfilled until the initial automatic level is known. Its custom blue-green menu has compact ivory sans-serif labels and a quiet gold check for Auto, High, Medium or Low; touch devices retain 44px menu rows. The current choice stays in the tooltip and accessible label, without a persistent text label. These shared controls are available on the loading veil and throughout play. The menu supports arrows, first-letter navigation, Enter/Space, Escape and Tab; outside dismissal never starts play or blows wind.


## Start screen (2026-09-19)

Jeremy approved simplifying the opening after experimenting with cursor gusts and local mist: set the mood
and invite one click; discovering the wind belongs in the game.

- Muted sage through the centre, sea blue-teal toward the edges and diffuse straw-gold light above
  and to the left, with a stationary vignette and slowly drifting haze. Night checkpoints deepen these
  colours toward slate and dark green. Pointer movement gently nudges the whole colour field, which settles
  when the hand stops. No cursor trails, local spotlight or mist following the pointer.
- A browser-owned SVG version of the game's hollow 26px cursor stays responsive during graphics setup.
  Two or three sparse ambient wind ribbons borrow the game's taper.
- One centred invitation: “Begin”, or “Continue” with a valid checkpoint. Warm ivory italic Iowan /
  Palatino / Georgia serif, with a small mouse outline and filled left button for a fine pointer with
  hover. Touch uses a delicate rounded button outline instead. Label opacity breathes from .95 to .82
  over 5.6 seconds, without disappearing, scaling or bouncing. Reduced motion disables the pulse and
  drift, leaving a still wind motif.
- Reveal the word after graphics preparation. Click, tap, Enter or Space starts sound and the story, then
  dissolves the veil over the first real scene. Touch dragging shifts the backdrop without entering.
  Keep the entering gesture out of the game's wind field, and retain the visible keyboard focus outline.
- No downloaded font, image, audio or graphics context is needed for the start screen itself. A failed
  module or graphics boot offers “Try again”. Remove the veil and its animation loop after the fade.
- Mute, fullscreen and quality work while loading through the lightweight `controls.ts` module. The
  veil stays silent even when sound is enabled; Begin honours the selected mute state. Control clicks
  cannot enter the game. Quality changes during graphics preparation queue until warm-up completes.

`tools/start-check.mjs` checks desktop and phone entry, audio gating, centring, ambient motion, backdrop
response without cursor trails, reduced motion, checkpoint restoration and boot retry.

The dark wood's embers are abstract light, following Jeremy's approved
[orb study](../assets/art-direction/wood-ember.png): honey and apricot veils curling around a warm heart,
softly breathing and yielding to wind. Their small warm motes remain distinct from the cooler fireflies.
No literal campfire, solid sphere or scattered glowing chips. The heart is in `src/fx/ember-orb.ts`; seven independently moving surfaces in `src/fx/ember-veils.ts` form the wisps.

The forest remains dark, with faint cold moonlight on wet trunks, uneven ground and the travellers' outlines.
Jeremy's September 20 correction: the earlier near-black floor erased the forest and left no sliver of moonlight.
Retain enough scattered fill and blue-grey distance to place the characters in the wood between embers.
Fanning progressively reveals a warmer, fuller patch of the way ahead. Moonlight never supplies the story's
ember gate. Keep the storm's subdued lightning and the contrast between cold surroundings and warm care.


## Sky mirror (2026-09-20)

An uninterrupted skin of water doubles the sunset and clouds beneath the travellers. Keep the room open:
no ground fog, moon prop or revealed sand road. A little wooden stool, enamel soap bowl and brass hoop
bring one fragment of childhood into the emptiness. Bubbles have nearly clear centres, shifting rose,
pearl and blue rims, soft highlights and a slight wobble. They reflect in the same glass as the child.

Fallen lights are small gold starbursts on the surface; captured lights glow inside transparent bubbles;
returned lights recede into the sky and gain their ordinary reflection below. Their ascent must be visible
from the child's position. The paper stays visible in hand, on the satchel or flying between discoveries.
A lamp and distant landing stage give the walk an ending without interrupting the reflected horizon.
The playable view looks across the bubble's travel, keeping its reflection and the fallen light apart.
Returned stars gather above the far jetty; thin connecting light and broken ripples across the offshore
channel make their connection to the boat visible. The completed constellation joins the ripples into
its approach, shown in a brief wider view before the travellers leave.

## Sleeping island (2026-09-20)

Slate-blue night surrounds a small warm bed. Keep lavender-grey distance and pale moonlit edges;
nearby mist must leave the cygnet readable. Rounded bedding supports the child, including the seated
embrace. The paper stays tucked away until the child leaves the bed.

The bed stands on an open grassy terrace. The window holds a cream seam above a steep shoulder, with an
broad coral ribbon tied at its centre and a loose end beyond the lip. Frame the bird, unreachable end and drop
together on phone and desktop; retain the opening window before following the glide. The beak contact
must be visible, including removal of the bird's grass visibility offset while airborne. Its light travels down the
grass and mist before the wider sky brightens. Morning is golden light and fresh green turf beneath a pearl-blue sky, with cool shadows
keeping the warmth distinct. The cold island visibly wakes with the child: green follows the light
down the hill, then spreads beyond the lane across the whole island. Use the local winter palette, not the game's orange sunset played backwards.
The bedside lamp's light and emissive shade contract as frost reaches the rug; the bedside clock stops.
A narrow slit of window light briefly reaches the pillow before the bird leaves. The cliff is natural,
with continuous convex slopes, sparse buried exposures and snow pockets. Never flatten a strip under
the walking route or cut an inset shelf below the window. The summit curtain remains clear against the sky.
The route is suggested by short moving wind wisps and the feather's lean. A snowdrift fills a natural notch between rock and the drop; wind exposes the grassy footing.
Bedroom details cluster around the bed and summit window, leaving the hillside natural. The chapter reaches full winter before its morning transformation.

Short, curved winter blades retain the meadow's wind response. A bounded patch of extra stems near
the phone camera avoids isolated spikes; lighter roots and quiet, broad ground variation tie the turf
together. Frost gathers toward tips. Mist has an uneven, continuous boundary, never stacked planes.
Keep the bedside pair together and follow the child throughout the departure to the boat.
