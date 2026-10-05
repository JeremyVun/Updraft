# Leaves that are fish

Four concept keyframes for the optional meadow-to-birches crossing. The boat sails on with or without input. These are visual targets and proposed staging dimensions, not measurements recovered from a 3D scene. The real boat, camera and character assets remain authoritative.

## Shared staging

Use the supplied crossing camera: approximately 24 m behind and 6.5 m above the boat. Keep the boat small in the lower middle, with the horizon around the upper fifth in k1–k3. The beach frame follows the supplied rear arrival view. Keep the existing cream/yellow panelled sail throughout; the encounter does not replace it.

Coordinates below are relative to the boat centre at the depicted instant: **x** is starboard, **z** is ahead, **y** is height relative to the local moving water surface. Bearing 0° is ahead; +90° is starboard. Starboard is the open water on the right of the painted hull. Reproject these positions through the existing camera rather than changing the camera to fit them.

Each leaf-fish has an 0.08–0.12 m body, 0.035–0.055 m width and a 0.01–0.02 m fan tail. Use the same yellow ochre, gold and amber as the island's birch leaves; a fine dark midrib supplies the leaf reading. No emissive material. The nearest painted leaves are emphasized for readability: the metre sizes here govern the build, and should be checked in the actual camera before approving the effect. The cygnet stays inside the child's worn satchel, with its bandaged left wing tucked away.

## k1-leaves.jpg

**Shows:** a broken drift beside and ahead of the bow. Almost everything reads as fallen leaves. The cygnet reaches towards the nearest cluster; one or two little rings and a tail flick are the only clues.

**What reads well:** isolated warm shapes against uninterrupted blue water, with open gaps between clusters. The bird's neck gives a reason to look without an invitation graphic.

**Layout:** about 80–100 fish in a 7 m long × 3 m wide patch, centred at x=3.5 m, z=3.5 m: 5 m from boat centre, bearing +45°. The nearest fringe is roughly 1.2–1.5 m clear of the hull. Bodies sit at y=0 to +0.005 m and follow the swell. Hint rings are 0.15–0.30 m in diameter. Limit the cygnet's reach to about 0.15–0.20 m beyond its normal neck pose; do not move the bag or bird out over the water.

## k2-scatter.jpg

**Shows:** a sweep opens a narrow blue gap through the drift. The touched fish fan away just below the surface; small rings mark their entry points. Foreground and distant leaves remain at rest.

**What reads well:** the empty strip and outward headings establish cause and effect. Three white strokes locate the player's sweep without obscuring the gold bodies or replacing their movement.

**Layout:** keep the k1 patch. Example stroke runs from x=2.8 m, z=1 m to x=4.6 m, z=4.5 m, approximately 4 m long and 0.8 m wide. Its centre is 4.6 m from the boat at bearing +53°. Roughly 20–30 affected fish spread 1–2 m outward through a 60–70° fan. Dive to y=−0.05 to −0.18 m; they never jump. Entry rings grow from 0.12 to 0.35 m diameter at y≈+0.005 m. Wind strokes occupy y=+0.10 to +0.35 m. In play the actual gesture defines this swath; the painting is one example, not a fixed trigger zone.

## k3-the-ring.jpg

**Shows:** the circle gesture gathers a loose shoal below a faint air spiral. The girl leans to look over the near gunwale. Water remains visible through the ring and over individual bodies.

**What reads well:** the broad, broken ellipse is legible from the crossing camera. Individual leaves become a collective swimming movement; the child's lean carries the response.

**Layout:** ring centre x=3.8 m, z=1.5 m: 4.1 m away at bearing +68°. Outer diameter about 3.2 m, band width 0.4–0.6 m, with 45–60 fish and irregular gaps. Swim at y=−0.05 to −0.15 m. Keep the ring flat on the water plane; perspective makes the ellipse. Two fine broken spiral strokes rise from y=+0.15 to +0.60 m. No funnel, raised fish, depressed water or solid circular outline. Child leans about 0.15–0.20 m toward the rail, hips seated, hands supported, satchel moving with her torso.

## k4-on-the-beach.jpg

**Shows:** the bow has run gently onto the birches' wet sand. Ordinary damp leaves lie just above the wash, the same colours and size as the shoal. No transformation is shown and neither companion reacts.

**What reads well:** the wet sand separates the little amber shapes from the gold-covered forest. Their ordinary resting state ends the encounter without a reward effect.

**Layout:** keep the existing landing location and ground the existing hull against the beach. Place a broken 4 m × 0.8 m leaf ribbon along the waterline, centred approximately x=2.6 m, z=2.2 m: 3.4 m from the boat, bearing +50°. Around 40–60 leaves, each 0.08–0.12 m long, sit 0.002–0.008 m above the sand and approximately 0.01–0.05 m above the instantaneous water surface between washes. The receding swash briefly wets their lower edge. They have stalks and midribs, no fish tails or fins. No extra shore geometry is required.

## Build risks

- **Leaf scale versus visibility.** Tails and midribs will be only a few pixels or less at this camera, especially on a phone. Test silhouette, clustering and motion first; do not solve this by enlarging fish or pushing the camera in. The paintings slightly emphasize nearest leaves and are not a pixel-accurate asset specification.
- **Time in view.** A 7 m patch passes quickly at crossing speed. Make the drift visible ahead of the boat and test real sweeps and circles during uninterrupted travel. A ring is an optional passing sight, not a prerequisite that stops or slows the route. These four frames are illustrative states, not a compulsory sequence.
- **Underwater rendering.** Fish must be seen through the sea without sitting on top of its reflections. Check depth, transparency, refraction and surface sorting; derive all heights from the local swell to avoid flashing or floating above troughs.
- **Gesture locality.** Only fish touched by the screen-space wind should scatter. Circle gathering must use the player's actual water position and release gently when input stops. Keep untouched leaves visibly quiet.
- **Continuity and rigging.** The sail can occlude the bird; the leaning child can detach or clip the satchel. Preserve the real assets and verify both poses from the gameplay camera. Generated shapes are not replacements for the boat or character models.
- **No magic read.** Use restrained white air strokes, ordinary water rings and reflected gold. Avoid additive gold trails, emissive fish, sparkles and perfectly uniform spacing. The shore leaves need no visible morph or continuity tracking from individual fish.

## Files and provenance

Final deliverables: `k1-leaves.jpg`, `k2-scatter.jpg`, `k3-the-ring.jpg`, `k4-on-the-beach.jpg`, all 1664 × 936 JPEG. Created with the built-in image generator, using `ref-crossing.png` and `ref-birch-beach.png`; exported to the requested size and format. Exact generation and refinement prompts are in [generation-prompts.md](generation-prompts.md). Jeremy's full art brief is preserved in [brief.md](brief.md).
