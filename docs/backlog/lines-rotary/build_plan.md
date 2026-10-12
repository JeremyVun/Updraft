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


## 5. Player-camera polish — complete

- Stage green alignment → sheltered walk inside → snag glance/invitation → blue alignment → onward walk.
  Own story/rotary controls, tuning and real gesture helpers. Verify actual gestures, no premature lift or
  traversal, full companion silhouettes, wide and portrait, and the subsequent family reveal.
- Soften approach/exit grass cuts while preserving rotary footing and character readability.
- Relocate the secret shore with save migration and unchanged boat speed. Measure against the 31.9 s baseline;
  target +10–15 s, conceal the destination until the sea has had breathing room. Replay both sea handoffs.
- Apply Still-to-Lines-only 0.99 sailing pace, lower its surfacing whale and extend the gull/linen procession.
  Check complete passage duration, navigation and player-camera captures through procession and landfall.
- Record the camera-first staging lesson in AGENTS.md, run focused regressions, typecheck and production build.


Verification: `/tmp/updraft-lines-polish-wide/` replays both alignments, inside pause, snag, curtain three,
family, door and pulley with real pointer input. `/tmp/updraft-lines-polish-portrait/` starts at the arrival
and uses touch with the opposite turn direction through the whole Lines island. Both rendered family masks
show zero early pixels. Player-camera captures show green linen/arms enclosing the inside pause, both whole
companions and the caught corner in view. Chronological frames and camera traces were inspected; no video
motion review is claimed. The entry dolly follows the walking pair, settles beside the mast, then shifts right
and forward towards the snag. Traces flag the expected change in camera-to-child distance as they walk and
the lens follows; there is no new entry cut or emergency clearance correction.

`/tmp/updraft-lines-sea-polish/` begins before the real shore departure, plays the pulley, boards and sails
through Little Boats arrival. Frozen rendered comparisons across the portal boundary change zero pixels.
The sea factor carries 1.0 into arrival, then settles to 0.505; its largest per-frame step is 0.00374 instead
of 0.5. The 13-second view has open sea ahead; the island emerges later from its own mist. CPU navigation
checks measure 45.5 s vs 31.9 s before the 60 m move (+13.6 s), with unchanged speed, across gust and frame-rate
cases. Still-to-Lines measures 118.1 s vs 117.0 s (+1.1 s) at its 0.99 drive multiplier.

`/tmp/updraft-first-crossing-polish/` follows the complete incoming crossing. The whale rides 2.4 m deeper;
the back remains a low rise and the flukes still clear the water. Ten gulls and eight loose sheets (plus the
bill-carried cloth) replace six gulls/four loose sheets. New sheets enter in later waves through 28 s after
the procession starts, rather than all being launched by 10.2 s. Captures at 92/98 s show the later sheets
leading into the island's emergence; landfall is clear. Spawn-frustum tests pass in portrait/landscape and
three camera bearings, along with cloth stability at 30/60/120 Hz.

Typecheck, production build, curtain progression/cloth, rotary mechanics/rig initialization, geography/save
migration and first-whale swell checks pass. Production retains its existing large-chunk warning. No deployment
or merge was performed.

## 6. Flying linen palette — complete

Add three muted accents among six pale pieces, retaining the pale cloth's original body and hem colours.
Check the full incoming crossing from the boat camera, then typecheck and build. Preserve the secret-door
motif's bright primaries and all existing motion and timing.

Three loose sheets now use mauve, dusty rose and taupe, with softly darker hems. Player-camera frames at
80/86/92/98/104 seconds in `/tmp/updraft-crossing-muted-linen/` were inspected: the hues remain quiet in
the golden light and distinguish the accents from the pale majority. The complete crossing reaches landfall
without browser errors. Typecheck and production build pass, with the existing chunk-size warning.

## 7. Rotary weight and snag release — complete

- Tune acceleration, coasting and directional resistance in `lines-rotary.ts` and `tuning.ts`; preserve earned alignment.
- Change snag input to a local sweep, keep the corner attached until release, and update the visible invitation
  in `rotary-washing.ts`/`story/lines.ts`. Verify no distant input or early blue interaction can release it.
- Add one restrained metal creak per frame using the existing spatial foley, driven by actual rotation.
- Verify frame-rate independence, reversal response, silent restore, fixed snag contact and full pointer/touch
  approach–interaction–departure from the player camera. Run typecheck/build and focused audio checks.

Acceleration is bounded, maximum rotation is 0.58 rad/s, and opposite gusts have 30% of the preferred drive.
The final catch uses a damped spring that preserves momentum. At 30/60/120 Hz, a strong one-second sweep moves
0.284–0.285 radians in the preferred direction versus 0.085–0.086 against it. Local snag sweeps now keep the
corner at its physical post until release; the sheet returns to hanging within half a second. Wind invitations
show the preferred turn and a short sweep over the caught hem. Each bearing creaks once, with one cloth release.

Final desktop encounter: `/tmp/updraft-rotary-final-h7MJJs/`; full portrait touch arrival-to-departure:
`/tmp/updraft-rotary-weight-touch-full/`. Real sweeps pass both rotaries and the snag, including an opposing
push before recovery. Full touch records 260 visibility samples, zero early family pixels and exactly two creaks
plus one release. Player-camera frames show the corner attached during work, then hanging naturally, with both
companions readable. Captures and per-frame traces were inspected; no video motion review is claimed.

The earlier quick-start portrait test teleported out of the washing arrival camera after boot and exposed a
few family pixels while that artificial camera move settled. The harness now boots the existing rotary QA entry
normally; the full approach verifies the production route. No scenery or camera redesign was needed.

Typecheck, production build, mechanics, rig contact and audio render/scheduling checks pass. Abrupt acceleration,
equal directional drive and the former floating anchor each fail their corresponding negative control. The
isolated creak render is restrained (about −47 dBFS peak at established game gain), with no clipping or retained
nodes; the render is `/tmp/updraft-rotary-creak.wav`. No listening approval is claimed. The production build
retains its existing chunk-size warning. No deployment or merge was performed.
