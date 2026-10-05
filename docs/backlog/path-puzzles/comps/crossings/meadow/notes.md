# Sailing through a meadow on the sea

Concept keyframes for the optional first crossing encounter, 2026-10-05. The boat continues along its route whether the player touches the meadow or leaves it alone. These are visual targets and proposed dimensions, not measurements recovered from a 3D scene or an approved implementation plan.

## Camera and shared layout

Use `ref-crossing-45s.png` as the camera and boat authority: approximately 24 m behind the boat and 6.5 m above the water. Keep the horizon about 23% down the image; the hull stays small in the lower middle. Preserve the captured dinghy, mast and patchwork sail. Late-afternoon light comes from ahead-left; the destination remains hidden in haze. The girl stays seated, facing her surroundings; the grey cygnet rides in her brown satchel. Do not enlarge them to make the gesture readable.

All positions below are relative to the boat at that keyframe: **x** is metres to starboard/right, **z** is metres ahead. Bearings are relative to the bow: 0° ahead, +90° starboard, −90° port, ±180° astern. Heights are above the instantaneous local water surface, so grass and flowers travel vertically with the same swell as the boat.

The meadow has an irregular envelope approximately **70 m across × 100 m along the route**. Treat this as a density field, not a visible rectangle. The first and last 18 m, and the outer 12 m on either side, feather through isolated tufts. Stagger the ends of the clumps so the transition never becomes a line. Keep water visible between blades throughout, including in the dense middle. There is no soil, underwater island, raised platform or solid grass carpet.

Grass tips stand **0.45–0.85 m** above the water, with occasional **1 m** tips beside the gunwale for the child's hand. Clumps span **0.25–0.6 m**, with irregular **0.2–1.2 m** water openings. Roots disappear just below the water. Wider open-water gaps remain at the feathered margins. Use the existing island grass's soft green, with sunlit pale undersides; do not turn it into reeds or wheat.

## k1-into-the-meadow.jpg

**Shows:** The boat enters scattered tufts and pushes into the thicker meadow. Grass bends outward at the bow and lies down beside the hull. A narrow furrow trails astern; the oldest bent blades are already lifting back up. The girl reaches over the port gunwale to brush the tips while the cygnet looks out from the satchel.

**Reads well:** The familiar sail and hull anchor the impossible landscape. Blue water in the furrow and between the clumps establishes that the boat is still sailing. The girl's sleeve connects her small gesture to the grass passing within reach.

**Builder layout:** The boat is approximately 8 m into the 100 m envelope: meadow extends from **z = −8 to +92 m**, **x ≈ −35 to +35 m**. Dense growth starts about **10 m ahead, bearing 0°**. The hull's contact band extends **0.3–0.6 m beyond each side**, bending blades outwards and then aft. The recovering furrow is approximately **2 m wide × 8–10 m long**, centred **5 m astern, bearing 180°**; it is compressed grass, not a dug channel. Tips near the hull lower to **0.05–0.2 m**, then recover toward full height farther astern. The touch tuft is approximately **1 m away, bearing −90°**, with tips **0.8–1 m above water**; tune to the actual seated hand and gunwale without stretching the arm.

## k2-the-winds-wave.jpg

**Shows:** A sideways sweep beside the boat sends a broad wave through the grass. Its pale moving front is the underside of bent blades catching sunlight. Small white, pale-yellow and occasional blue flowers open behind that front. A few thin, soft white wind lines show the sweep direction.

**Reads well:** The sequence is spatial: upright green ahead of the bend, pale bowed blades at the front, and open flowers in the grass the gust has crossed. The bright front and the flower ribbon are different physical things, so the player's motion has a readable answer.

**Builder layout:** The boat is halfway through: meadow envelope **z = −50 to +50 m**, **x ≈ ±35 m**. The painted stroke curves on the starboard side from approximately **(x, z) = (+6, −15) m**, through **(+18, +4) m**, toward **(+14, +18) m**, approximately **40 m along the curve**. Its ends are **16 m away at bearing +158°** and **23 m away at bearing +38°**; the bright bend sits around **18 m away at bearing +77°**. A **3–4 m-wide** affected swath leaves an irregular **2–3 m-wide** flower ribbon; this is a player's trace, not a fixed path the player must copy. The moving bend lowers the grass tips to **0.15–0.35 m**. Flowers sit on stems **0.3–0.65 m above water**, with **0.06–0.1 m** flower heads. Cluster the flowers loosely for screen legibility; do not enlarge individual blossoms into giant daisies. Wind lines skim the blade tops, approximately **0.7–1.2 m above water**, thin and low-opacity, with no emission or halo.

## k3-the-trail.jpg

**Shows:** The boat nears the far edge. Tufts thin ahead into uninterrupted sea. Several earlier gusts have left flower ribbons crossing the green beside and behind the boat. The grass has mostly stood back up; the flowers remain. No active gesture is needed in this frame.

**Reads well:** The open sea ahead carries the journey onward. The diagonal ribbons in the lower corners remember the player's movements while the forward-facing camera and small boat retain the game's ordinary view.

**Builder layout:** The boat is approximately **88 m** through the envelope: meadow spans **z = −88 to +12 m**. The final scattered tufts end approximately **12 m ahead, bearing 0°**; open sea follows. Keep three example flower traces mostly in the visible region **x = −22 to +22 m**, **z = −18 to +4 m**. Suggested ribbon centres are **(−12, −7) m**, **(+12, −9) m**, and **(0, −15) m**: respectively **14 m at −120°**, **15 m at +127°**, and **15 m at 180°**. Each ribbon is **2–3 m wide × 15–30 m long**, with irregular gaps and one or two intersections. Keep the nearest crossings beside the hull and in the foreground; a trace far behind the camera cannot communicate persistence. Flower heights and sizes match k2. The boat's narrow bend furrow crosses these traces without erasing the flowers.

## Build risks

- **Grass becomes land:** dense coverage, uniform height or a hard boundary can imply a solid island. Verify moving blue-water gaps and swell-driven height changes from the real crossing camera.
- **A pale stripe becomes magic:** the gust front must be directional bending and changed light on the blades. Flowers open on stems behind it; nothing glows, emits particles or leaves a painted ribbon on the sea.
- **Companion and hand readability:** the sail, gunwale and grass can hide the reaching sleeve or bird. Preserve boat scale; solve with a small pose adjustment and local blade bending. Check hand contact against the actual rig.
- **Motion disagreement:** boat, grass roots, flowers and wake must share the local water height. Otherwise the hull clips through blades, the field floats, or flower stems detach in a trough.
- **Grass and flower cost:** dense alpha geometry over reflective water risks overdraw and shimmering. Use instancing, clump LOD and restrained flower density; verify motion on the project's lower-performance target.
- **Flowers overwhelm the green:** repeated sweeps should saturate existing patches rather than stack flowers or white-out the meadow. Keep trails world-fixed and visible for the passage; discard only after they leave view.
- **Accidental mandatory beat:** do not slow, stop or reroute the boat for interaction. There is no completion threshold, timer, required pattern or reward gate.

## Production record

Generated using the built-in image generation tool with the game capture as the camera/style reference. Exact generation prompts are recorded in `generation-prompts.json`. Final deliverables are JPG, exactly **1664 × 936** pixels (16:9). The layout values above are proposed starting dimensions; match the camera and silhouette against the reference in engine before tuning density and motion.
