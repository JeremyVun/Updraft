# The whale in the net — concept keyframes

Painted 2026-10-07 with the built-in image generator, using both supplied game captures. Jeremy's complete brief is preserved in [brief.md](brief.md). The six JPEGs are the visual sequence; [prompts.json](prompts.json) records the exact generation and correction prompts. Five landscapes are 1664 × 936; the portrait is 936 × 1664. This is a concept handoff, not a tested Three.js scene or approval of a build.

The emotional progression is recognition, a breath, her hands, the bird's courage, then release. The physical progression is equally important: lifted mesh creates air space; a float reaches the girl's mittens; a slack loop slips off a raised flipper. Wind never becomes a magic tether. The whale remains still enough for these small actions to matter.

## Shared blockout

These metre values are proposed starting geometry, not measurements recovered from generated pixels. Keep one whale and one boat throughout; solve composition by continuous boat/camera movement. Use the existing boat asset and crossing lens as authority if their measured dimensions differ from the scale proxy below. Do not enlarge or rebuild the boat to match an incidental painted detail.

- Whale: **75 m nose to fluke tips**, maximum body width **14 m**, total body depth roughly **10 m**, mostly submerged. Nose points screen-left; the long body recedes right into haze and leaves the frame. Nearly horizontal, with about **5° roll toward the boat** to expose the eye and near flipper. Crown/blowhole at **3.6 m** above mean sea level, highest back about **4.5 m**. No land texture, sharp dorsal ridge or face-like smile.
- Eye: **2.4 m wide**, centre **1.6 m** above water, opening about **0.25 m** in k1 and **0.7–0.9 m** after the full breath. Upper lid remains heavy. Blowhole is **4 m** from the eye centre in 3D, on the upper near crown; opening approximately **1.0 × 0.6 m**. The painted opening is exaggerated in portrait: avoid building it as a crater.
- Boat scale proxy: **3.4 m long × 1.7 m wide**, gunwale **0.65 m** above water, mast top approximately **4.3 m**. Preserve the captured round hull, red sail and lantern. Girl **1.1 m** tall. Cygnet body approximately **0.6 m** long, swimming head **0.45 m** above water, left wing bandaged and folded. It remains in the satchel in k1–k3, swims only in k4, returns aboard before k5.
- Net: one continuous faded brown-green sheet, approximately **32 × 12 m** unfolded, over the head and forward back; no requirement to net all 75 m of whale. Diamond cells approximately **0.6–0.8 m**. Fine mesh strands **0.015–0.025 m** diameter; perimeter rope **0.04 m**. Round cork floats **0.25–0.3 m** diameter, spaced about **1.2 m** along selected edge rows. The paintings exaggerate rope and float thickness for legibility; do not make the child or bird haul a ship's hawser.
- A **12 m free float-line leader** continues from the near edge toward the boat. Separate from it, a **5 m slack loop** from the net's lower corner catches the outer third of the near pectoral flipper, with a **2 m free end** for the bird. It is an open, slipping loop, not a cinching knot. Flipper: **11 m long × 3 m** at its widest, tapering to a rounded tip. Its root is roughly **8 m aft of the eye**. Resting upper surface near the tip lies just below/at water level.
- Use rose-purple water and slate-blue skin beneath the warm sunlight. Gold outlines the upper body; broad cool fill makes the eye and pale lower jaw readable. The eye's gold is a reflection, never an emissive light. The supplied captures remain the material/style reference: reduce the generated skin pitting and dense glitter when building.

For the layouts below, bearings are measured from the boat's forward direction, toward port. Distances to the eye are horizontal. Heights refer to local mean water, with boat, floats and bird following the same swell. Camera offsets are relative to the boat centre and remain behind it. The tailward body axis runs approximately **65–75° to starboard of boat-forward**, so the length recedes across/right rather than standing as a wall directly across the view.

## k1-island.jpg — the island breathes

**Shows / reads:** Three dolphins curve toward a long low shape. Its tired eye, pale jaw and weak breath resolve the apparent island into an animal. The stern-view boat and the back continuing beyond the right edge provide the size comparison. The cygnet is aboard, looking with the child.

**Layout:** Camera **24 m behind, 6.5 m high**, normal crossing lens; frame boat low-right with a high horizon. Nearest head skin is roughly **15 m ahead-left** of the bow; eye approximately **23 m** from boat centre at **38° port**. Whale retains the shared 75 m resting pose, crown **3.6 m**, eye centre **1.6 m**. Dolphin leads lie **6–18 m** ahead, curving toward port. Do not reveal a tail silhouette that fits the whole animal in frame.

**Net:** The full **32 × 12 m** sheet still lies on the head/back; a roughly **3 × 2 m** patch domes just **0.25–0.4 m** over the blowhole on a weak exhale. Mist rises only **1–2 m** above the crown. The **12 m** leader floats beside the near cheek, its end still about **6 m** from the approaching boat. The **5 m** loop remains around the flipper's outer third, mostly at water level. The leader is not prominent in this wide frame; its introduction can come with the drift alongside.

## k2-the-breath.jpg — air under the mesh

**Shows / reads:** The same boat has stopped alongside. The net becomes a raised, sagging canopy with a visible gap beneath it. Corks hanging from that canopy show weight. Thin white spiral lines mark the player's circles; ordinary breath mist passes through. The eye opens toward the child. The sail sits to the right of the interaction.

**Layout:** Keep camera **24 m behind, 6.5 m high**. Eye about **7–9 m** from boat centre at **45–50° port**; nearest skin approximately **3 m clear of the port gunwale**. Whale remains horizontal in the same pose, **3.6 m crown / 1.6 m eye**. Keep the eye, blowhole and net gap to the left of the sail, with enough screen space for a circling gesture.

**Net:** Lift a **7 × 5 m** patch of the same sheet **2.5 m clear of the crown**, apex near **6.1 m** above water. Its side edges remain joined to draped mesh, not detached and hovering. A roughly **3 m diameter** faint spiral continues above it; mist reaches roughly **9–11 m** above sea. The **12 m** float leader remains slack, its nearest float **2.5–3 m** from the gunwale. The **5 m flipper loop** is unchanged. The first exhale is the visible sign that the whale can breathe fully again; keep inhale/exhale physically sequenced in animation.

## k3-the-child.jpg — both mittens on the line

**Shows / reads:** A sweep has delivered the nearest cork. Both mittens hold the connected rope. It leads diagonally back to a sagging fold peeling from the cheek, leaving the eye, jaw and blowhole clear. The bird watches from her satchel. The child remains supported by the boat.

**Layout:** Ease the camera to **11 m behind, 3 m port, 4 m high**, looking forward toward the same head. Eye roughly **9 m away at 50° port**; nearest cheek **3 m from the gunwale**. The whale keeps its shared 75 m pose and heights. Hands are **0.65–0.85 m above water**, just outside the port rail; hips/feet remain inside. The child leans, rather than hanging her full body out.

**Net:** The nearest **0.25–0.3 m float** touches the hull within **0.35 m** of the girl's reach. The **12 m leader** has approximately **8–9 m** between mittens and mesh; the remainder curves on the water. Draw only a few sweep lines across that approach. The net's near edge descends from **2.5–3.5 m** into the water, progressively peeling the **32 × 12 m sheet** from the head. The painting catches the middle of the peel, not completion. By the end of this beat it is folded into roughly a **16 × 8 m** floating area. Only the **5 m flipper loop** remains attached, beyond her reach; the bird's **2 m end** is exposed.

## k4-the-cygnet.jpg — the last loop

**Shows / reads:** The whale's head and back are bare. The bird holds a rope end in its bill, the loose bend hangs at the flipper tip, and the rest connects to empty mesh on the water. Three thin strokes follow the flipper's length. The child watches with mittens at her mouth; her satchel is empty. The visible slack prevents the bird from reading as a tiny crane lifting a giant.

**Layout:** Ease around the same rear quarter to **9 m behind, 3 m port, 3.2 m high**. Boat drifts about **3–4 m tailward** along the whale between k3 and k4. Eye is now about **14 m away at 50° port**. The **11 m flipper** projects toward the boat; tip sits approximately **5.5 m from boat centre at 45° port** and rises lazily to **0.9 m above water**. Bird is about **4 m from the boat**, slightly nearer the camera than the tip, head **0.45 m** high. Keep at least **1 m lateral clearance** between its body and the flipper's swept volume: it pulls outward, never swims underneath.

**Net:** Entire **32 × 12 m sheet**, folded into a **16 × 8 m** footprint, lies on the water to the left of the flipper. The **12 m float leader** is released and slack with it. The single **5 m loop** has migrated to the narrow tip; half the bend is already past the rounded end. The **2 m free end** reaches the bill. Release is a lazy lift plus the bird's outward swim, not a knot being magically untied. The line must remain visibly continuous through the bill contact, loop and floating net.

## k5-free.jpg — a full breath and a small wave

**Shows / reads:** The bare whale gives a tall natural plume, dolphins leap, the child waves, and the cygnet is back in the satchel with its neck up. The abandoned mesh is a separate shape at lower left. No loop remains on the animal. The plume's upper extent leaves the frame; this is the scale payoff, not a breach.

**Layout:** Ease back to **27 m behind, 7 m high**, retaining the crossing's rear view. Eye roughly **18–20 m away at 35–40° port**, nearest skin at least **8 m** from the boat as the whale starts drifting clear. Whale still **75 m**, crown **3.6 m**, body almost horizontal; flipper lowers gently before the next roll. Plume rises about **14 m above the blowhole** to **17.6 m above water**, with a **3–5 m** diffuse upper spread. Dolphins leap **1–2 m** above the water around it, leaving the boat/bird space clear.

**Net:** The whole sheet floats folded into roughly **16 × 8 m**, at least **4 m clear** of both hull and whale, moving off to port. The **12 m leader**, **5 m former loop** and **2 m end** are slack with that raft; no line crosses back to the animal. This frame precedes the roll, fluke wave and leaving swell. Do not add those actions to this still or start them before the cygnet is aboard.

## k2-portrait.jpg — the same breath on a phone

**Shows / reads:** A separate upright composition, not a crop: boat low-right, eye above-left, lifted net and blowhole above the eye. The red sail remains beside the mechanism. The whale continues beyond both sides of the narrow viewport. The mesh gap still reads without showing the whole animal.

**Layout:** Preserve k2's **75 m whale**, **7–9 m eye distance / 45–50° port bearing**, **3 m skin clearance**, **3.6 m crown / 1.6 m eye** and **24 m rear / 6.5 m high camera**. Re-aim toward the near crown while preserving the rear-camera hemisphere; tune portrait framing with lens/target, never independently move the eye or blowhole. Target approximate vertical zones: boat **68–86%** down frame, eye **45–56%**, blowhole **29–34%**, lifted mesh **19–29%**. Validate these in the actual portrait camera before treating them as achieved geometry.

**Net:** Exactly k2: **32 × 12 m sheet**, **7 × 5 m lifted patch**, **2.5 m clearance**, **12 m leader** and unchanged **5 m flipper loop**. The loop and much of the leader can sit outside the phone crop; the eye, blowhole and breathing gap cannot. Mist passes through a thin spiral, not a luminous column.

## Risks to settle in the build

- **Scale reading as land:** The first silhouette should briefly invite that reading, then breathing, the lid and the pale jaw must resolve it. Avoid rock-like skin noise. Keep the 2.4 m eye larger than the 1.7 m beam, and let the back leave frame instead of zooming out to show a complete whale.
- **Net cost and motion:** Full rope geometry or general cloth simulation across 32 × 12 m is unnecessary and risks aliasing/overdraw. Prototype a sparse deforming mesh, instanced corks and only a few explicit boundary ropes; concentrate deformation in the lifted patch, peeling edge and last loop. Preserve topology and water contact through each transition. Check mobile shimmer against the moving sea.
- **Sun-backlit whale:** A gold rim alone will hide the eye. Retain cool sky fill and broad slate values; keep the sun's glitter lane away from the rope/bill contact. The paintings carry more skin texture and specular glitter than the reference game: simplify those in the build. Never make the eye emissive.
- **Tiny bird near giant:** Keep its grey neck and cream bandage against a quiet darker patch of sea, with wings folded and a visible escape lane. The close camera earns this detail; do not inflate the bird to adult-swan size. No fin/body collision, ducking underneath or taut rope across its neck.
- **Camera and asset continuity:** These are generated concepts, not calibrated projections. The boat's fine rigging/lantern placement and whale texture vary slightly between paintings; the existing assets win. Verify all key poses in one 3D blockout with the actual crossing lens, especially portrait and the giant eye comparison. Ease camera/boat movement; no reverse angle, underwater shot or teleport.
- **Gesture and response:** A still cannot prove interaction. In motion, show wind at the target before the physical answer. Only a small patch rises for circles; the cork moves for a sweep; the fin lifts for the final sweep. Use existing faint wind lines without bloom. No timer, completion text or UI is introduced by these concepts.

Export check: exact JPEG sizes and aspect ratios were checked after conversion. Final art was reviewed in the conversation. Opening the files in Preview was attempted, but this environment could not find the Preview application.
