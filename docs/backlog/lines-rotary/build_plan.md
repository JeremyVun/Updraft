# Paired rotary revision

Approved plan and Jeremy's brief: [design.md](design.md). Work in `codex/lines-rotary`.

## 1. Layout and reveal — implemented

Original study at `de1286a2` is complete, with separate-build player captures. Jeremy rejected the rectangular
maze and raised camera; both are removed, along with the remaining long reveal screens. The original varied
garments/palette and soft rotary grass patches are restored. The two ordinary washing fields now overlap around
the third curtain. The field follows the rotary masts, retaining density beside both mechanisms. Foreground
overhead rows are kept off the playable sheets and snag. Noise-edged grass patches follow the actual walking
route, including the companions' different waiting positions.

The ground extends 80 m north. A rounded rise beyond the third curtain conceals the central family clearing;
the family stands at (14, −353), the door at (14, −361), on grass about 45 m from the northern waterline.
The camera follows the child over the crest, gains height to see her descend, and settles only as she reaches
the clearing. The last few rows stand beside the crest rather than crossing that view. There are no custom
cloth screens. The terrain atlas includes the extended underwater slope.

## 2. Snag and alignment — implemented

Two independent rotors, local responsive wind, persistent unhooking, independent alignment catches.
A real cloth-to-post tether. Travellers cross only when both have settled. Required unfolding was removed by Jeremy.
Files: `lines-rotary.ts`, `rotary-washing.ts`, `tuning.ts`, `story/lines.ts`, `main.ts`.
Verify idle/off-target input, each mechanism, either turn direction, permanent catches and geometry clearance.

Implemented sage and dusty blue striped linen and a far sheet tethered visibly to a post.
Screen contact follows the nearest cloth point and preserves an uninterrupted stroke's direction. Mechanics pass
both directions at 30/60/120 Hz; disabling that direction guard makes the regression fail. A full portrait touch
run reaches the shore with real circles and sweeps. The prior open clearing was rejected: rebuild its physical
route with the original organic washing field. The attempted enclosed bays were then rejected as a literal maze;
the generated-sheet test also caught that their overlapping panels obstructed the intended opening. That check
is retained only as rejected evidence in `/tmp/updraft-paired-rotary.3Sh6gz/rejected-maze-route-check.mjs`.
Do not rebuild or tighten those enclosures. Compare the original scene first.

The snag anchor and saved angle are initialized before the first render, fixing the blue strip across the sea.
Only the next action offers a wind invitation: a directional sweep on visible rotary linen, or a lifting spiral
at the caught corner. Hints pause during input and contribute no wind. The third curtain's released sheet keeps
a continuous fold and uses a thin rope collider once caught; the enlarged flight collider caused the jagged cloth.

## 3. Integration and review

Evidence root: `/tmp/updraft-rotary-camera.2C3tZG/`. Full real-input runs reach the departing boat, including all
curtains, both alignments, the snag, family, doorway and shore pulley. `review-wide/` begins on the incoming
crossing; `review-portrait/` uses touch and the opposite turn direction. Both pass the rendered family-mask check
with zero early pixels. Camera traces exposed abrupt safety corrections when the companion framing contract
was only enabled while walking; it now remains consistent through the land scenes. The rotary exit and curtain
exits follow the moving child instead of holding and then catching up.

Review evidence is chronological screenshots and per-frame camera traces, not a reviewed video. Final crest
polish is captured separately in `finale-reviewed/`, with the full touch replay in `accepted-portrait/`.
Production build, curtain progression at four gust bearings and 30/60/120 Hz, cloth strain, rotary controls,
initial rotary geometry, camera-direction, geography and boot-cloth checks pass. Both new regressions were
verified against their failure: the origin snag stretches into the sea, and the thick rope proxy stretches
the folded cloth. Visible terrain height/normal samples pass; the global terrain check retains its pre-existing
0.167 m sea-floor mismatch at (194, −1750), outside Lines. Legacy-door resume passes through the doorway,
reload, pulley and departure (`door-legacy-final.log`), with no room/reflection leaks. The prior attempt was
interrupted by a dev-server reload; the test now disables hot reload. No release or merge has been performed.

Older checkpoint, shader and browser checks remain mechanism evidence only. In particular, `portrait-final/`,
`wide-final/` and `bays-*` used rejected layouts. They do not validate the current layout or its reveal.

## 4. Arrival shoreline — corrected 2026-10-12

Jeremy's arrival screenshot exposed the obsolete 96 m source-view cutoff in `DoorwayView`. It clipped the
extended island's beach when sailing handed over to Lines. The source now excludes the secret shore exactly as
the crossing does; the journey room partition bounds the rest. Terrain and camera parameters are unchanged.

`FULL=1 lines-arrival-check` passes the complete inbound crossing and disembarkation at 1869×549 and 390×844:
94 actual-render comparisons match the unclipped beach exactly, with no browser errors. The negative control
reinstating the old cutoff fails 39 samples, with 59,108 altered pixels in its worst comparison. Captures and
reports: `/tmp/updraft-lines-shore.Nrvta6/full/`; rejected baseline: `crossing-approach-*` in the same root.
The existing `lines-check door` passes source/portal/reflection visibility and departure. Typecheck and production
build pass. Landing stills were inspected; this narrow renderer correction does not claim a motion review.
