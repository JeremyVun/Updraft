# A village half remembered

The village should feel lovingly made and slightly misremembered. Keep the richness of the first round, but put it into bent silhouettes, oversized roof pieces and small expressive choices. The second round's quiet water and strange scale remain useful; its interchangeable houses do not.

Jeremy's governing clarification: “when i said dont be detailed, i meant dont be too realistic. detail is nice, just not realistic detail if that makes sense. i.e. add a little bit of artistic flair that suits it being a dream / game”.

## The nine houses

Widths below are modelling targets, with the girl fixed at 1.15 m. Water sits at the eaves; the complete house continues underneath. Use the kit for shape and colour, and these dimensions for construction rather than measuring perspective drawings.

| House | Width | What makes it memorable | Cheapest construction |
|---|---:|---|---|
| **Crooked cap** | 4 m | A gently bowed slate-blue ridge, uneven scallops, an off-centre square window with one shutter, two subtly divergent chimney pots. The village's ordinary house, already handmade. | Gable body, lightly deformed roof, square window insert, short chimney. |
| **Long sigh** | 5.5 m | A low plum roof that sags between slightly lifted ends; one low arched dormer. Its horizontal silhouette provides rest between taller houses. | Stretch the common roof along its ridge, lower the centre control points, add the arched insert in a shallow dormer shell. |
| **Straw blanket** | 4 m | Three overlapping soft gold roof lobes pulled low around one dark window. It feels heavy and sheltering, not shaggy. | Common body beneath three broad curved shells; a few sculpted grooves, no individual straw. |
| **Needle** | 2.5 m | A narrow pointed roof, roughly 4 m above the water, with a slight lean and one long chimney. A single arched opening keeps the front quiet. | Narrow the body, raise the roof peak and draw the eaves outward. Reuse the same tiles and stretch the chimney shaft. |
| **Little pocket** | 1.8 m | A very low ochre roof and tiny dark square recess. Target roof peak about 0.95 m above water, excluding the chimney. Few large tiles make the smallness legible. | Shrink the body and roof while retaining bold tile thickness; use fewer tiles, not miniaturised detail. |
| **Cat's shoulder** | 4.5 m | A broad roof with one long sweeping side; a generous chimney shoulder and steady pot perch. One dark dormer sits away from the kitten. A few large ivy leaves are optional. | Stretch one side of the roof cage. Preserve the existing chimney-top and kitten anchors; deform the shaft below them. |
| **Tucked together** | 6.5 m overall | Unequal plum and faded-rose volumes nestle together; one simple projecting oriel gives the larger half a story. Different window heights avoid a face. | Overlap two common bodies and roofs, join their submerged walls, attach one shallow timber-framed box. |
| **Round keeper** | 3 m | A low circular body under an uneven conical slate cap, one dark arched opening and a simple leaf weathervane. A rare punctuation, never a competing castle. | Low-sided cylinder, ring-based cone roof, the common arch insert and a flat leaf silhouette. |
| **Open shutter** | 4 m | A kicked eave, one projecting dormer with a single open shutter, and a window box of three broad leaf shapes. A small inhabited trace without an occupant. | Common roof plus one dormer module; reuse the square window, shutter and leaf pieces. |

Most buildings should be Crooked cap, Long sigh and restrained variations of those bodies. Not every roof needs a dormer, foliage and fancy chimney. Ordinary houses carry one telling feature; special houses get two. Keep the strongest Needle silhouette rare, and the round roof rarer still. The kitten's roof is a destination, not a repeated decorative motif.

## Four shared parts

**Body.** Start with a plain rectangular volume and gable end, with a few controllable vertices. Change width, depth and gable height; give selected buildings a small lean of roughly 2–4 degrees. Leave most upright. Lean is authored, not random wobble. Use smooth cream, dusty peach or lavender planes, with broad vertex-colour shifts. Keep submerged walls so the roofs read as drowned houses rather than objects floating on the surface.

**Roof.** One low-resolution roof cage should control pitch, ridge sag, unequal slope lengths and lifted eaves. Make separate simple shells for the thatch and cone. Reuse a small family of thick scalloped tile shapes and a rounded ridge-cap segment. About three to five readable courses are enough on ordinary nearby roofs. Vary the width and placement gently; keep overlaps credible and colours grouped into broad patches. Deform the tiles with their roof, not independently into noise. Chunky silhouette edges matter more than interior seams.

**Chimney.** A tapered four-sided shaft, broad cap and short low-sided pot. Short, long, slightly bent and double-pot variants cover almost everything. Pots lean a little, never like cartoon antennae. Use smooth colour and soft bevels; no individual bricks. On the kitten cottage, lock the pot top and kitten in world space before changing any surrounding geometry.

**Window.** Two inserts: a dark square recess and a dark arch. Reuse a thick imperfect frame, one hinged shutter and a small dormer hood. The same square insert can sit inside the oriel. No emission. The aperture stays much darker than the wall even in warm sunlight. One primary aperture per modest visible face; never mirror two windows into eyes.

The extra pieces are a few broad leaves, a plain box, a timber beam and the small leaf weathervane. They should be shared geometry with colour variants, not new assets for every house.

For Three.js, start with rough, non-metallic materials and vertex colours. Author colour variation deliberately rather than sampling noise. Keep the existing dusk lighting, sky, water, exposure and boat materials. Build near houses from the full pieces; merge static geometry by material or instance repeated parts where useful. At medium distance collapse tile interiors into broad roof colour bands while retaining the eave silhouette. At far distance keep roof, wall and chimney masses only. Profile in the actual game before choosing budgets; these paintings are not performance measurements.

## The village between the houses

Arrange crooked rows along drowned lanes, two- and three-house huddles and a small square whose centre is now clear water. Establish the near-boat water space first, then fit the houses around it. The first arrival should reveal a village with depth on both sides, not a dozen foreground sheds and not an evenly tiled horizon.

Continue modest silhouettes around the player's travel area, but leave the southern fog approach open. This is not a closed ring. Let the distant roofs thin and fade at the edges of that route. Keep the drowned green an unmistakable clearing of water, with houses describing its perimeter rather than occupying it.

The church spire and red-and-white lighthouse form one distant pair. Each has its own clear silhouette and sky gap; neither hides behind a roof, chimney or branch. They remain smaller in the frame than nearby cottages. Never duplicate the lighthouse to fill empty space. The eye-level painting shows the pair in a gap beside the foreground roof; the arrival painting places the same pair on the far horizon.

Keep the original cameras and all gameplay anchors when implementing: girl, boat, mast, sail, lantern, wake, tub and kitten. In particular, the kitten cottage changes around its existing chimney and rescue approach. Its new dormer must not compete with the kitten against the sky. Preserve water access between the tub and roof.

## Three dream touches, once in the whole room

1. **Tall beside tiny.** Place Needle and Little pocket together at their true shared scale. Their contrast is the event. Do not scatter repeated tall-and-tiny pairs around the village.
2. **The red door beneath the water.** One rectangular red home door on a submerged wall. Its top is below the surface, with a visible band of water above it. All of it receives water tint and distortion; none of it is an above-water red attic window. Keep it quiet enough to discover on approach. The kit shows the construction clearly; the arrival painting keeps it subdued beneath the tall house. Use the existing water/refraction treatment rather than adding a luminous red decal.
3. **Washing between chimneys.** One gently slack line with two simple pale cloths. The arrival groups it near the scale contrast. Use a tiny amount of slow movement if needed; no busy flapping, extra wires or repeated laundry strings.

These are unique world placements, not decorations attached to every prefab. The kit's three vignettes explain those same placements; they are not additional instances.

## Build priority

1. **Lock the room.** Record the existing three cameras and gameplay anchors. Reserve the near-boat clearing, drowned green, southern fog approach and landmark sightlines before adding geometry.
2. **Prove three silhouettes.** Build Crooked cap, Long sigh and Cat's shoulder in simple colour. Check arrival, kitten approach and eye-level views in the existing dusk light. They must already read differently without surface detail.
3. **Add one shared detail pass.** Chunky tiles, thick eaves, chimney caps and dark windows. Tune the size of these parts in the game camera; do not add more pieces to compensate for weak silhouettes.
4. **Populate in depth.** Lay out crooked lanes and huddles, then add quiet distance silhouettes around the room. Preserve open-water gaps. Test the whole sailing route, not only these three frames.
5. **Add the exceptions.** Straw blanket, Tucked together, Open shutter and the rare round roof. Place the unique tall/tiny pair, submerged door and washing line. Add the church beside the lighthouse without blocking either silhouette.
6. **Finish and simplify.** Add only a few leaves and shutters, apply broad roof-colour variation, then reduce distant geometry. Capture the same views and inspect the scene in motion for clutter, popping, glare and unintended faces.

## What would break it

- **Realistic surfaces:** photographic slate, brick courses, thin straw fibres, distressed plaster, grime, granular noise and dense normal maps bring back the first round's wrong kind of specificity. Richness belongs in the shapes.
- **A toy catalogue:** nine special silhouettes repeated equally often, identical spacing, uniformly saturated pastels or a dormer on every house. Most houses need to remain modest, with softened dusk colour and irregular grouping.
- **Comic cuteness:** exaggerated corkscrew chimneys, constant leaning, bouncy roofs and enormous witch-hat tips. The dream is tender and strange, not a joke.
- **Faces:** paired windows, matching shutters like eyebrows, a door centred beneath two windows. Check silhouettes and dark shapes at thumbnail size from multiple directions.
- **Busy horizons:** tall roofs or branches covering the church or lighthouse; adding extra towers; filling the green or southern fog route to increase house count.
- **Literal place-making:** pub signs, telegraph poles, lettering, flags, recognisable historical masonry or national motifs. This place belongs to the dream.
- **Lost rescue staging:** moving the kitten, growing its chimney, covering it with a pot, shifting the tub or crowding the boat's approach. Architecture serves that small encounter.
- **Wrong waterline:** houses reading as floating roof toys; the red door emerging above water; thick bright foam outlining every building. Keep the drowned walls continuous and the water calm.

## Painting record

Created with the built-in image generation tool, using the original gameplay frames as edit targets and the corrected story kit as the shared architectural reference. Final files are three 1600 × 900 paintings and a 1600 × 1200 kit. They are art-direction references; production should retain the original scene's exact gameplay transforms.

Prompt direction used throughout: change only the village; preserve the camera, horizon, sky, dusk lighting and non-village subjects; replace repeated bare sheds with rich handmade storybook geometry, broad scalloped tiles, smooth walls, dark irregular windows and restrained silhouette variety; avoid photographic materials, noise, faces, signs and poles. Arrival adds the full village, unique dream group and one distant landmark pair. The kitten view preserves its perch and gives its roof a long sweeping shoulder. The eye-level view gives the nearest cottage bold readable shapes and moves the landmark pair into a clear distant gap. The kit specifies nine named families at a shared 1.15 m girl scale and illustrates the three unique dream touches. Targeted corrections removed masonry texture, an extra lighthouse and red colour above the door's waterline.
