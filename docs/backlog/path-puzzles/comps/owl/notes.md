# Updraft — the owl at the bend

The four landscape paintings share one composition: her profile at lower left, a long unlit gap along the path, the stump near the middle, and the shadow clear to its right. The ember beside her is always the first source. Exactly one other coal belongs to the stump.

## Deliverables

- `k1-dread.jpg`, `k2-antlers.jpg`, `k3-oh.jpg`, `k4-delight.jpg`: 1664 × 936, exact 16:9.
- `k2-portrait.jpg`: 810 × 1755, exact 9:19.5.
- `flight-strip.jpg`: six consecutive pose panels, 2172 × 724.
- `plan.jpg`: measured top-down diagram, 2400 × 1660.

## Layout

Use metres, Y up. The plan plots X horizontally and Z vertically. Ground is Y = 0. These are proposed blockout coordinates, not measurements recovered from a rendered 3D scene; the paintings govern silhouette and performance. Match them in the first camera blockout before detailing the set.

| Element | X | Z | Height / dimensions |
|---|---:|---:|---|
| Girl's waiting mark | 0.00 | 0.00 | 1.10 m tall |
| First coal E1 | 0.60 | 0.25 | Warm core at Y 0.18; veil envelope about 0.35 m |
| Stump | 7.80 | 1.40 | Fork at Y 2.00; tines to 2.60; trunk about 0.45 m diameter |
| Owl on fork | 7.80 | 1.40 | Feet at Y 2.10; body about 0.32 m tall; wingspan about 0.75 m |
| Only side coal E2 | 6.40 | 2.50 | Warm core at Y 0.18 |
| Rock face | 10.20 | −1.20 to 4.80 | 6.00 m wide along Z, 4.00 m maximum height, about 1.40 m deep |
| Fixed landscape camera C | −1.00 | −5.20 | Y 1.10 |
| Landscape aim A | 4.80 | 1.40 | Y 1.45 |

E1 is **7.29 m from the stump**, and 0.65 m from her waiting mark. E2 is **1.78 m from the stump**. The stump-to-rock gap is 2.40 m along X. E1 must remain visible by her feet throughout the lit beats; never move it forward to improve lighting.

The 1.40 m path enters through (−3.8, −0.7), passes her mark and (4.0, 0.55), then bends through (5.3, 1.1), (6.0, 2.0), and (6.35, 3.2), continuing towards (5.8, 8.9). The stump occupies the outside of this bend. Keep the stretch between her and the bend visually empty.

## Camera and framing

Landscape: 23 mm equivalent on a 36 mm horizontal gate; horizontal FOV 76°, vertical FOV 47.45° at 16:9. No camera movement, lens change, focus pull or automatic exposure change between beats. Use the same scene registration as the paintings: girl at roughly 16% across, stump around 58%, monster eyes around 83%. Her whole body and both ground-level sources stay inside the shot. Preserve her profile and the open gap between the stump and its projected outline when tuning the initial blockout.

Phone: a separate fixed composition from the same side of the path, moved nearer the path axis. Starting position (X −3.8, Y 1.1, Z −2.4), aimed at (6.5, 4.0, 1.8); approximately 24 mm equivalent with a 36 mm vertical gate, vertical FOV 74°, horizontal FOV about 38.4°. The tall frame puts her below the threat with a visible stretch of path between them. The phone painting is a reframe, not a crop of the landscape camera. Keep it fixed throughout the phone version too.

## Rock and lighting

One irregular outcrop, **6 W × 4 H × about 1.4 D m**: broad face, broken sloping shoulders, uneven top, one or two shallow diagonal fissures, subdued brown-grey stone. Its base disappears into moss and leaf litter. Build broad soft facets and sparse surface variation; do not reproduce every painted fleck as geometry. No stacked slabs, pedestal or separate upright tombstone. The highest edge is visible against the forest.

E1 → stump → rock intersects the face at R1 = (10.20, 1.78). E2 → stump → rock intersects at R2 = (10.20, −0.49). These are horizontal direction guides, not a requirement to accept a physically computed shadow size.

The monster is an **authored shadow projection**, not an extra creature or hidden lamp. Its antler spread is about 2.5 times the real fork's spread; its body occupies nearly the full available 4 m face. Its vertical height is limited by that modest rock, so the exaggerated breadth and dark area carry the enlargement. Keep the projection clearly to the stump's screen-right. Use E1's visible glow to drive the rock illumination and shadow strength, while suppressing the warm response of the stump's front surface in beat 2.

The eyes in the monster are a deliberate eyeshine projection cheat. In beat 1, the eye pair belongs at the owl's real fork position. In beat 2, show the enlarged pair inside the monster and suppress the original pair so there are never two competing threats. In beat 3, remove projected eyes completely and return attention to the round yellow eyes on the actual owl.

As E2 ignites, blend the monster projection into the smaller, ordinary fork-and-owl shadow directed towards R2. A simple static two-light setup alone will not perform this transformation: animate the shadow mask and its weighting with the coal state. Both embers remain on in beats 3–4. All warm illumination belongs to these two visible sources; faint cold moonlight maintains the forest outlines. Keep exposure fixed and the woodland dark.

## Keyframe rationale

- **Dread:** the unlit waiting place and barely traced child lead to one isolated eye pair, with no readable explanation in the darkness.
- **Antlers:** her flinch, the nearby visible source, the empty intervening path and the separate oversized silhouette make the misunderstanding immediate.
- **Oh:** warm side light exposes the little owl against dark trees; her lowered mittens and the harmless fork shadow release the tension.
- **Delight:** the owl's uneven wingbeat passes above her face, the cygnet peeps up, and a tiny flying shadow replaces the monster on the same stone.

## Owl flight

The six strip panels are animation inserts, not six changes to the gameplay camera: fluff, toe-driven hop, wide opening, soft downstroke, upstroke past her, then departure above the crowns. Keep its head oriented along its movement or towards her; nobody addresses the viewer.

| Route point | X | Z | Y / action |
|---|---:|---:|---|
| 1 | 7.80 | 1.40 | 2.10 — puff and crouch on fork |
| 2 | 6.00 | 1.50 | 2.45 — leave perch, toes trailing |
| 3 | 3.00 | 0.70 | 2.60 — approach her with a slightly uneven downstroke |
| 4 | 0.30 | 0.20 | 2.80 — pass safely overhead; cygnet stretches up |
| 5 | −1.00 | 2.00 | 4.80 — bank upwards |
| 6 | −2.00 | 6.00 | 8.50 — clear the local 6–7 m crowns |

Use a smooth curve through these points. Let the body bob slightly after the first flap, then settle into soft strokes. Keep the small travelling owl shadow on the rock only while the projection can meet it; fade it as the owl leaves that surface. The dashed arrows in the strip and plan are production annotations, not visible magic.

## Production record

Paintings and flight strip were created with the built-in image-generation tool. Exact prompts are in `process/prompts.json`; the measured plan is drawn by `process/draw_plan.py`. Final export normalisation preserves the common landscape framing; the portrait received a small safe-edge crop to meet the requested exact aspect ratio.
