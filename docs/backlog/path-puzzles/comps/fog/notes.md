# Updraft — sea fog at dusk

## fog-far.png

The gold-rose crest belongs to the sunset, while its cool underside and the fading right-hand roof suggest that this beautiful weather is quietly removing the way back. Build a moving sea-level density field with distance and height falloff, blend every affected material toward its local fog colour through transmittance, and use only a few broad translucent sheets to soften the crest. Keep the boat, foreground water and warm key light clear at this stage; the first unmistakable event is a chimney losing contrast and disappearing.

## fog-near.png

The close bank takes away depth and warm illumination: roofs become uncertain, the boat's orange and red fall into shade, and the lantern becomes the last concentrated warmth. Advance the same field through the village, fade roof and chimney shading within it, and ramp the warm directional light and sky contribution down together while leaving the lantern independent. Broad steel-blue shadow and a small residual rose rim give the wall weight without hard lobes, black smoke or elaborate volume rendering.

## fog-arrives.png

The bank has ceased to be an object ahead and become the air around the child; roof and tree shapes survive, but their detail and the horizon have gone. Enclose the camera in the field, deepen its scattering colour toward slate-violet as the sun contribution reaches zero, and introduce a restrained directional water-normal pattern that breaks the lantern reflection into cold wind ripples. There is no church visible in the locked source frame, so none has been invented: in the church view, apply this same transmittance to its existing silhouette as the fog turns into the storm's night.

## fog-portrait.png

The narrow view makes the cold wall loom behind the little warm lantern, while the retained upper sky allows the player to register light draining from a place that was beautiful. Use the same world-space field, colours and light ramp as the landscape near frame, without scaling the effect to screen coordinates; keep the crest sheets few and broad to limit transparent overdraw on phones. Maintain enough contrast between the boat, nearby roof and fog for the route to remain readable.

## Against dark-a.png

Sea fog suits this light and time of day better. Its lit upper edge and shaded blue-grey body can inherit the dusk palette naturally; white should be a lighting result, not a fixed white material. The far frame is the most persuasive argument for it: weather, water and sky feel like one place.

The black bank in **dark-a.png** carries the immediate threat more strongly. Its airy edges are already much better than the game's solid boulder-like masses, and the dark-versus-warm contrast reads instantly, even in a still. It risks implying fire, soot or an overt evil substance, however, and a large black mass can compete with the soft world rather than appear to belong to its weather.

Fog's danger is less automatic: a pale scenic bank can look restful, and the near study could read as an attractive weather change if it simply waits. The threat must be the advancing loss of familiar things—one roof, then another, the sun, then the route—supported by the cat's reaction; give that loss a clear direction and an unrelenting pace. Avoid turning the soft wall into giant cumulus pillows, a flat grey screen, or visibility so poor that the player cannot act.

**Recommendation:** use the fog progression for this room, provided the disappearance of landmarks and the cooling light are animated as the primary event. Reserve the deepest values for the transition into night, instead of making the distant bank black from the start. A haar does not literally transform into a storm; that change is the deliberate dream logic, made legible through the loss of sun, deepening sky and first wind on the water.

## The preceding cream-and-gold cloud room

Yes, fog immediately after a climb into luminous cream-and-gold cloud is a real repetition risk. Both could become passages through soft, glowing vapour, weakening the arrival in the drowned village and making the approaching bank seem welcoming. Keep this fog low, horizontal, cold-bodied and subtractive: only a narrow crest inherits the sunset, the village has a clear interval of open air, and the ensuing action is escape from disappearing space rather than ascent into light.

## Real-time construction

Use one shared fog function and parameters for standard materials, custom roofs, characters, sails, water and transparent effects. A moving front, a height profile and a small amount of low-frequency variation define density; estimate optical depth along the view segment and use `T = exp(-opticalDepth)` to mix shaded surfaces toward the fog colour. Merely drawing translucent sheets in front of fully contrasted roofs will reproduce the original problem.

Use three to five large feathered sheets for the crest and occasional wisps, with depth fading at intersections; those sheets supplement the field rather than hide the village themselves. Drive fog colour, sun intensity, ambient/sky contribution and water reflection colour from the same progression, then introduce a small directional normal ripple as the storm arrives. Keep lantern emission/local light independent, and test the route at phone scale before increasing density; these are proposed real-time ingredients, not a measured implementation or performance claim.

## Generation record

Created with the built-in ImageGen editing tool, directed and visually checked by Astra. Each frame was generated from its specified game screenshot; `fog-near.png` also supplied atmospheric continuity for the arrives and portrait edits. A localized second portrait edit removed two invented distant chimney silhouettes.

Shared prompt instructions: lighting/weather paint-over; preserve source camera, crop, object positions, identities and poses, cottage, tree, roofs, sky cloud arrangement and floating leaves; replace the black smoke only, with the requested illumination changes; use broad distance/height gradients and a handful of soft sheets in the existing economical Three.js aesthetic; no photographic volume render, added church, text or border.

- **Far prompt:** low sea fog on the former right-horizon smoke footprint, pale gold and dusty rose crest, cool blue-grey underside, far roof and chimneys fading in contrast through its edge, warm foreground unchanged, beautiful with slight unease.
- **Near prompt:** close tall continuous cool fog wall behind the boat; no boulder lobes; middle-distance roofs half lost; warm sunlight blocked; sky and materials cooled and dimmed, only a faint rose trace aloft; lantern the warmest luminous point.
- **Arrives prompt:** inside the same fog as it darkens into storm night; no separate fluffy bank; roofs and tree reduced to receding silhouettes; slate-violet air, dark slate water and the first narrow directional ripples; retain a readable boat and tiny amber lantern.
- **Portrait prompt:** apply the near treatment to the upright source without reframing; preserve the upper sky and lower boat/cottage arrangement, cool the light and fade existing distant geometry. Final correction: remove only the two newly invented freestanding ghost chimneys and their fragments, blending those small regions into the surrounding fog.

The supplied compositions and major silhouettes are retained, but these are generative paint-overs, not pixel-locked composites: small surface/character details can drift. The tool exported the landscape studies at 1672 × 941 and the portrait at 852 × 1846, approximately the source aspect ratios; source screenshots remain untouched. Use the studies to judge atmosphere and progression, and retain the game's actual geometry in implementation.
