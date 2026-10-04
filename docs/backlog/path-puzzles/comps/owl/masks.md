# Updraft shadow masks

All coordinates use a top-left origin, with x increasing right and y increasing down; integer coordinates identify pixel centres. Masks are opaque RGB PNGs: black shadow, white background, and an approximately 2 px antialiased transition at the contour (0.8 px Gaussian; about 2 px from 10% to 90%).

| Mask | Size | Base point | Fork point |
| --- | --- | --- | --- |
| `monster.png` | 1024 × 1024 | **(512, 1023)** | **(512, 568)** |
| `plain.png` | 1024 × 1024 | **(512, 1023)** | **(535, 721)** |

The base is the fixed bottom-centre attachment point and is solid black in both masks. The fork is the central antler junction in the monster, and the bottom of the open woody crook immediately beside the owl's perch in the plain mask. These are semantic correspondence points, not centroids.

## Monster eye holes

| Eye, as seen in the image | Centre | Radius |
| --- | --- | --- |
| Left | **(486, 602)** | **8 px** |
| Right | **(538, 602)** | **8 px** |

These are circular white holes with the same edge softening as the outer contour; radius is measured before edge softening. Both centre pixels are pure white. The glow shown in `preview.png` is a compositing demonstration and is not baked into `monster.png`.

## Transition

For a light moving to screen-left, pin the base and swing the antlers clockwise toward screen-right: fold the broad left antler inward, lower the right crown into the taller dead limb, and shrink the head into the perched owl while cross-fading to `plain.png`.

## Flying owl

`owl-flap-1.png` through `owl-flap-4.png` are 256 × 256: **up → mid/downstroke → down → mid/upstroke → repeat**. The owl faces right, viewed from below and its left side. All four use one shared image transform, preserving the body position rather than centring each wing pose separately. Use body anchor **(132, 152)** for placement. The downstroke's lowest wingtip is at y=235, leaving a white safety margin.

## Preview and reproducibility

`preview.png` presents the two large shadows side by side on the same warm-lit rock, with all four flying shadows beneath them. This is an asset-read preview, not an in-engine lighting capture.

The seven generated source images are retained in `source/`. `generation-prompts.md` records the complete prompt set and built-in ImageGen provenance. `build_masks.py` performs threshold cleanup, fills incidental internal gaps, normalizes the large masks to their bottom-centre anchors, adds the exact eye apertures, joins subpixel gaps in the owl wings, and renders the preview. Run `python3 build_masks.py` from this folder with Pillow and NumPy installed to reproduce the outputs from the retained sources.
