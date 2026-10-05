# Updraft — darkness treatments

## A — Low rolling smoke bank

Sky and chimney fragments remain visible through torn edges, while overlapping bluish veils become almost black toward the front: transparency and changing density give the dark no solid surface. Build it from staggered, stretched transparent sheets with two slowly advected noise scales, sparse soft wisps, and a shallow curling strip at the waterline; depth fading should dissolve intersections with roofs and water. Let layers slip past one another at different speeds, keep their lighting broad and diffuse, and put a subdued blurred dark reflection beneath the bank instead of highlighting individual billows.

## B — Ink in water

The threat spreads horizontally through the glass, with diluted feathered fingers and glimpses of water inside them; its low rising haze makes the blackness feel unstable and immaterial. Drive a world-space water-shader stain with an advancing distance field distorted by slow flow noise, blending indigo absorption and muted reflection rather than raising the surface. Add a few transparent mist sheets over the darkest area and use the same broad field to dim the sky above it, with the feathered edge diffusing forward rather than wriggling like tentacles.

## C — Storm night arriving

Long diagonal gradients and a dissolving leading edge make this read as an approaching weather shadow, while the distant chimney losing its warmth shows the night swallowing the village. Use several large overlapping cloud sheets with slow noise advection, a separate low mist layer, and a shared world-space approach field that cools ambient light and suppresses warm sunlight and water reflection near the dark. Move the broad wall slowly and let its edges shear and dissolve independently; avoid lighting each noise lump as an object.

## Choice and portrait

I would choose **A**: it most directly delivers black smoke coming across the water while preserving the room's sunset, the girl's warmth, and the uncertainty of a child's dream. B is the most unusual alternative but can suggest a spill, while C makes the threat more recognizably weather; `dark-portrait.png` carries A into the supplied upright frame, keeping the boat and lantern readable below the open sky.

## Generation record

Created with the built-in `image_gen` editing tool, using the supplied landscape and portrait screenshots as edit targets; no CLI generation was used. Outputs were normalized to the source dimensions, 1600 × 900 and 900 × 1950, without cropping. These are generated concept paint-overs preserving scene placement, rather than pixel-exact masked composites: fine texture and tiny details can differ from the source.

The final prompt set, condensed:

- **Shared:** Edit the supplied screenshot in place; lock camera, framing, boat, girl, sail, lantern, cottage, tree, roofs, chimneys, leaves and visible sunset composition. Replace only the darkness and its specified atmospheric influence; use soft painterly game effects feasible with transparent sheets, particles, noise and the water shader. No rocks, industrial columns, horror, monsters, text or borders.
- **A:** Lower the dense smoke top to around one third of the landscape frame, keep its foot at the original waterline, restore horizontal sunset bands where the taller mass disappears, and use blue-violet distant veils, near-black front layers, translucent holes, lifting wisps and a curling waterline lip.
- **B:** Remove the airborne mass; spread a blue-black stain flat across the water from the right, with diluted violet feathered fingers stopping short of the boat, original ripples showing through, a very low black haze and softly dimmed sky. Preserve the original distant roof and chimney through the haze.
- **C:** Replace the mass with a very soft, towering, inward-leaning wall of night entering from the upper right, long translucent diagonal curtains, and black mist at its foot. Preserve the left sunset's existing horizontal bands, and drain warmth from water and roofs nearest the approaching darkness.
- **Portrait:** Apply A directly to the original portrait, preserving its full crop and foreground placement; lower the bank, retain sparse torn wisps above it, restore the original sky's horizontal bands, and keep the lantern and its reflection untouched.
