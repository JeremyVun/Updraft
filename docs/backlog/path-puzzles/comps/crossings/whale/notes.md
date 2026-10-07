# Whale asleep across the way

Four concept keyframes for the little boats → meadow crossing. Generated with the built-in image generation tool using both supplied crossing captures, then the sleeping frame as the continuity reference. Final prompts are in `prompts.json`. All four deliverables are 1664 × 936 JPEGs (16:9).

## Shared staging

Keep the existing crossing camera: roughly 24 m behind the boat and 6.5 m above the sea, looking along travel. Keep its lens; do not cut closer for the encounter. Horizon stays near the upper fifth. The boat remains small in the lower middle; the mast, patchwork sail, rounded hull, child and satchel belong to the existing game. The whale's head, eye and blowhole sit to the left of the sail. The farewell tail rises to its right. The meadow is only a distant low grey shape in the right-hand haze.

Metres below are proposed blocking targets, not measurements recovered from the generated paintings. Use the actual boat asset unchanged. Coordinates are relative to the stopped boat's centre: +Z is forward along the crossing, +X is boat-right, Y is height above the local water surface. Bearings are clockwise from forward; negative bearings are left. Distances in the table are horizontal. Account for the actual bow extent when setting the 6–8 m clearance.

The whale is 14 m nose to fluke tips, approximately 3.4 m wide and 3.0 m deep through the body. Most of that depth stays underwater. Its long axis lies across travel, head left, tail right. Begin with body centre at (0, 10.5) m; its near flank is at Z ≈ 8.8 m. For a bow extending about 1.5 m forward of boat centre this leaves 7.3 m of clear water. Adjust centre Z only enough to preserve 6–8 m from the actual hull. Back crest is about 1.2 m above water; the closed eye is 0.25–0.4 m above water. Keep the pale underside a narrow glimpse, not a white stripe around the whole animal.

| Feature | X, Z from stopped boat (m) | Distance / bearing | Size / height above water |
| --- | --- | --- | --- |
| Whale body centre, frames 1–3 | 0, 10.5 | 10.5 m / 0° | 14 m overall; back crest 1.2 m |
| Head / visible eye | −5.4, 9.8 | 11.2 m / −29° | Small eye about 0.08 m; Y 0.3 m |
| Near-side blowhole | −4.1, 9.6 | 10.4 m / −23° | Opening about 0.2 m; Y 1.1 m |
| Gull at rest | −1.7, 10.3 | 10.4 m / −9° | Body 0.35 m; feet on back at Y 1.2 m |
| Near pectoral root | −3.5, 9.0 | 9.7 m / −21° | Paddle 3 m long, up to 0.75 m wide |
| Farewell tail root, frame 4 | +4, 12 | 12.6 m / +18° | Flukes 5 m across; tips up to Y 3.5 m |

## k1-asleep.jpg

**Shows:** the long sleeping body closing the route, a tiny resting gull, a breath of mist, the boat stopped with its sail hanging slack. The seated girl leans over the left gunwale; only the cygnet's head and a little neck show above the satchel flap.

**Reads well:** the whale is a low island, not a looming creature. The water gap preserves a gentle encounter. The warm sail and orange hood separate the little travellers from the blue body. Mist makes the blowhole findable without marking it with an interface.

**Layout:** use the shared whale placement. Mist rises 0.5–0.8 m above the blowhole and spreads no more than 0.6 m. Slow breathing moves the back roughly 0.08–0.15 m. The gull's head is tucked. Lean the girl's torso approximately 15° toward the rail without moving her seated base; keep the arm supported. The hidden cygnet exposes around 0.12–0.18 m of head/neck above the flap. No moving-boat wake.

## k2-tickled.jpg

**Shows:** a sweep along the back, a small shiver, a lazy pectoral slap, a splash toward the boat and the gull hopping. The whale's eye stays shut. This is an answer to a gust, not the waking gesture.

**Reads well:** the few white stroke lines sit against dark skin. The paddle and spray make the result physical, while the closed eye distinguishes tickling from waking. The gull supplies a second, small reaction.

**Layout:** whale and boat keep frame 1 positions. A stroke can run 3–5 m along the back, with 2–3 thin white line fragments 0.15–0.4 m above skin. A shallow deformation of about 0.02–0.04 m travels under it; do not turn the generated skin texture into permanent wrinkles. The 3 m pectoral paddle sweeps diagonally toward the boat, rises about 0.6 m, then slaps near (−2, 6.5) m. Main spray stays under 0.9 m high. A few droplets can carry toward the near gunwale; the broad splash remains by the flipper. Gull hops 0.4–0.6 m above its resting perch, wings half open. Keep the child and cygnet oriented toward the response.

## k3-the-breath.jpg

**Shows:** a faint spiral directly over the blowhole, a tall spout rising through it, a trace of rainbow and the newly opened eye. The cygnet cautiously extends its neck; the child watches the plume.

**Reads well:** the vertical response contrasts with frame 2's horizontal stroke. The blowhole, spiral and water jet share one origin, clearly left of the mast. A small eye glint carries waking without a human expression.

**Layout:** keep the shared placement. Spiral diameter about 1.4 m, rising 2 m above the blowhole; use sparse broken arcs, not a continuous luminous spring. The spout rises about 4.5 m above the back (top Y ≈ 5.6 m), widening from a 0.2 m stem to roughly 1.3 m near the top. Leave margin under the top of the frame in the real camera; the concept's highest droplets nearly touch it. The rainbow is a faint incomplete patch in the sunlit spray, attached to the droplets rather than an arch floating in air. The pectoral is submerged again. Cygnet body remains inside the satchel with about 0.3 m of neck showing.

## k4-goodbye.jpg

**Shows:** the whale has rolled away and sunk headfirst; its dripping flukes are the last visible part. A broad swell passes under the boat. The seated girl waves; the cygnet is fully out, neck raised, perched beside her. The gull leaves overhead.

**Reads well:** the raised tail echoes the child's raised hand. The passage ahead is visibly open. Tail and sail have separate silhouettes. The wave reaches the hull, connecting the large animal's departure to the small boat.

**Layout:** ease the animal away and turn its dive heading before the tail rises; do not teleport from broadside to tail-on. Tail root reaches (+4, 12) m, fluke span 5 m, highest edge 3.5 m above water. The head and torso descend forward of the tail; no new hump stays above water. Thin streams fall from the flukes. A low swell 8–12 m wide, with roughly 6–8 m crest spacing, lifts the boat 0.3–0.4 m and rolls it about 4–5°. Use the same displaced surface for hull and visible wave. Cygnet body about 0.3 m long, neck/head reaching about 0.45 m above its perch; secure both feet and keep its left-wing bandage visible. The girl waves one hand without standing. Wind lines and spout have ended.

## Build risks

- **Projection and scale:** these are generative concepts, not calibrated renders. Preserve the 14 m animal, actual boat scale and 6–8 m hull clearance first; validate their projection from the existing camera. The paintings place the hull slightly lower than reference B. Do not change the camera or enlarge the boat to chase that drift.
- **Occlusion:** the mast can cover the blowhole or the farewell tail during a turn. Test the complete transition, including portrait framing; keep the interactive blowhole visible to the left until the waking response finishes.
- **Fine effects:** white wind lines can disappear in glitter or resemble magic when thickened. Keep them over dark skin, thin and softly translucent. Use broad subtle skin deformation rather than the fine patterned texture the generator introduced in frames 2–3.
- **Spray and rainbow:** keep spray translucent without dense particle overdraw or an opaque white column. The rainbow is a restrained artistic accent; test its sun-relative placement from the actual camera. Reduce effect density before sacrificing frame time.
- **Companion continuity:** the painted cygnet and satchel are approximations. Use the established grey cygnet model, its long neck and bandaged left wing; keep its gaze toward the whale. Animate its climb from bag to perch, with no popping, wing clipping or unsafe-looking balance.
- **Water and anatomy:** the far tail tip in the sleeping paintings must be one partly exposed lobe of horizontal flukes, not a shark-like vertical fin. The pectoral, dive, surface contact and boat swell need continuous motion and consistent water heights.
- **Interaction:** gusts always give a repeatable tickle answer; only circling over the blowhole wakes it. Keep the boat waiting without a countdown or failure. This art pass does not specify the backlog's invitation/safety-valve logic; retain that contract when implementing.

No product code changed. These are art and blocking targets, not a validated 3D scene.
