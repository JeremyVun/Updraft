# Drowned village — painted direction

The approved room painting governs colour, material and finish. The earlier village and kit contribute settlement rhythm and silhouettes only. The village should feel remembered through water: recognisable houses, slightly impossible proportions, long pauses between things.

## Palette and finish

Roofs share charcoal slate, dark brown-grey and deep weathered thatch. Gold belongs to the illumination; violet belongs to reflected sky and shadow. Neither becomes a bright roof pigment. Warm limewashed cream gables catch the sun, with restrained brick and stone chimneys. Windows remain dark. The boat lantern is the intimate warm light; the distant lighthouse remains a small navigation landmark.

Use broad, continuous shading across moderately faceted forms. A faint slate stroke, the thin line of a ridge and a sunlit bargeboard provide enough description. Do not model individual tiles. Thatch reads first as a low, heavy cap, with sparse directional strokes rather than strands or stacked scalloped courses. Avoid plaster noise, brick grids and baked photographic dirt.

## Eight houses

Widths below are starting dimensions, not eight independent architectural systems. Keep the girl at 1.15 m in the actual scene; the sheet's figures are scale witnesses, not extra inhabitants.

| House | Starting width | Character and material |
| --- | --- | --- |
| Swayback | 4 m | The ridge dips between slightly higher ends; cream gable beneath a continuous charcoal roof. A narrow chimney leans subtly. The curve should read at thumbnail size. |
| Tall hat | 2.5 m | A narrow gable stretches into a steep, slightly crooked point. Dark slate remains one quiet mass; one dark slit gives scale. Reserve its strongest exaggeration for the tall-and-tiny pair. |
| Low cap | 4 m | A broad dark brown-grey thatch roof settles close to the water. Soft shoulders and a low eave make the character. Warm only its sun-facing edge; never turn the whole roof honey-yellow. |
| Little pocket | 1.8 m | A short, squat cream gable and disproportionately small dark roof. A thin off-centre chimney gives it an awkward dignity. Its material is identical to the larger cottages. |
| Cat's shoulder | 4.5 m | A broad, low, asymmetric slate roof makes a quiet stage for the existing chimney and kitten. Keep the chimney top, kitten pose and gameplay location fixed. Any dormer stays secondary. |
| Tucked together | 6 m combined | Two ordinary cottage modules overlap at a small angle and different heights. Their shared dark roof family makes the join feel natural. Character comes from their relationship. |
| Round keeper | 3 m | A shallow conical charcoal roof over a short round cream wall. A small dark opening prevents it becoming an ornamental tower. Use once, away from the church silhouette. |
| Open shutter | 4 m | One dark dormer and one plain shutter interrupt an otherwise modest roof. A thin lit edge describes the timber. No planter, flowers or extra trim. |

## Settlement and three quiet touches

Place irregular submerged rows and small huddles around an empty water clearing where the green used to be. Continue smaller, simpler silhouettes around the horizon on every side. The nearest boat water remains generous and calm. Facing the sun, buildings dissolve into low-contrast gold haze. Facing away, dark roofs and cream edges retain shape without becoming a wall of objects.

Roughly four houses in five should be modest variants. Do not place all eight designs evenly or give every cottage a dormer. Leave gaps through the huddles, and protect the fog as visible space. Keep the church and lighthouse together, small and distant, with separate readable silhouettes and an unobstructed approach sightline.

There are three unique scene placements, not three decorations to repeat in every cluster:

1. **Tall beside tiny:** one strong height mismatch, with the two houses close enough to read as a pair.
2. **Her door under water:** one muted red door entirely below the water surface. Refraction and blue-violet attenuation pass across the whole door. It should be discovered, not glow like an objective marker. No second red door or exposed red window.
3. **Washing between chimneys:** one slack line and two plain cream cloths. The chimneys support it; there are no poles. Movement is slow and small.

The separate paintings are view studies of the same design vocabulary. Reconcile the unique touches into one world layout during implementation rather than copying each image's placement independently.

## A small shared construction kit

Use one parameterised gable shell with a few ridge/eave stations. Width, length, pitch, ridge sag and asymmetric eave height produce the modest cottage, Swayback, Tall hat, Little pocket and Cat's shoulder. Preserve enough geometry for a readable curve, but keep normals smooth across the roof planes. Bargeboards follow the same edge stations.

Add one low rounded thatch shell and one modest faceted cone/cylinder shell. Tucked together reuses two gable modules. A single dormer, one shutter, a dark window insert, two chimney shafts, one cap and one reusable pot complete the house parts. Kitten and boat assets remain the existing game assets.

Share a small painted material atlas: dark slate, brown-grey thatch, warm cream, subdued brick/stone and dark wood. Use large low-contrast colour variation; reserve slate marks for sparse flat texture strokes. Avoid adding normal-map tile relief. Keep roof and wall colour variation narrow so low sun and existing sky illumination supply the richness.

Bake the few silhouette variants, then instance repeated forms by geometry/material. Merge static trim into those variants where useful; instancing alone does not remove draw calls for separately rendered parts. At distance remove dormers, pots and interior trim, then use simple roof/chimney silhouettes with the existing fog. Hide submerged construction rather than modelling complete houses, except for the door's small underwater wall patch. Integrate that patch with the existing water's depth/refraction behaviour; check transparency ordering before adding any new water pass.

The washing line needs one curve and two low-resolution cloth planes with gentle vertex motion. Bare trees share a small branching kit. No live foliage, signs, telegraph wires, garden clutter or fences are needed to make the settlement read.

## Build priority

1. Lock source camera transforms, horizon, existing sky/water settings and character/prop transforms. Establish the common roof, cream wall and chimney materials against the approved master in the actual renderer.
2. Replace the identical sheds with modest parameter variations. Build the surrounding huddles, distant rows and water clearing. Check the three source views before adding special houses.
3. Add Swayback and Cat's shoulder; verify the fixed kitten silhouette and approach. Place the distant church/lighthouse pair in a clear shared site.
4. Add the rare Tall hat, Low cap, Tucked together and Round keeper silhouettes. Reduce any that compete with the boat or landmarks.
5. Place each dream touch once. Add only the dormers and painted strokes that remain useful at gameplay distance.
6. Check portrait and landscape views in motion. Measure draw calls and frame time on the game's target devices; simplify distance variants before increasing surface detail.

## What breaks it

- Blue, rose or violet roof pigments, orange base-colour thatch, whitewashed toy brightness, repeated scalloped edges or thick outlined tiles pull it toward the rejected mobile-game kit.
- Photographic grime, visible masonry grids, dense slate relief and excessive texture contrast pull it toward the rejected literal village.
- Equal spacing, equal scale and identical gables restore the shed field. Equally frequent novelty houses create a theme park. Ordinary roofs make the rare shapes matter.
- Too many trees, dormers, washing lines, pots or strong reflections destroy the meditative water clearing.
- Large nearby landmarks, a roof across the lighthouse, or trees against the church spire erase the destination. Dense horizon detail also erases the fog.
- Glowing house windows, repeated red doors, extra lanterns and conspicuous dream props compete with the girl's quiet journey.

## Artifact limits

These images were made with the built-in image generation tool and reviewed as art-direction paint-overs. Generative editing can redraw source pixels; these are not certified pixel-identical composites. The original `today-*.png` files remain authoritative for exact cameras, sky, lighting, water, girl, boat, tub and kitten placement. The approved style master remains authoritative wherever a generated surface is too detailed or its colour drifts. Treat any remaining shingle-like marks as flat, low-contrast paint suggestions, never instructions to model tiles.
