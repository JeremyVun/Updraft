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

## 8. One-way rotary refinement — complete

Lighten response, make every frame strictly one-way, quieten and refine bearing friction, and broaden snag
input down the pole, including ground-level updrafts. Verify monotonic turns/catches, all pole heights, distant
and early-input rejection, persistent release and real mouse/touch gestures from the staged player camera.

The fixed turn now accepts sweeps in either direction. Acceleration rises from 0.85 to 1.25 rad/s², with a
0.72 rad/s cap and the same short coast. A strong one-second sweep advances 0.418–0.420 radians at 30/60/120 Hz
(previously 0.284–0.285). The final catch clamps forward travel to its remaining angle and never rebounds.

The snag accepts sweeps anywhere along the post, with a wider screen tolerance, and updrafts within 3.5 m of
its foot regardless of height. The staged input gate, persistent work and physically fixed caught corner remain.
CPU checks cover cap/middle/base sweeps, a nearby ground-level updraft, distant and premature gestures, muted
input, idle non-completion and one-way catches. Rig contact and initialization checks pass.

The short bearing friction uses higher, narrower resonances at lower gain. Its isolated render at established
game gain peaks around −58.6 dBFS (about 11 dB below the previous render), with no clipping or retained nodes.
It still fires once per frame. This is a render/scheduling check, not listening approval.

Desktop real-pointer replay in `/tmp/updraft-rotary-oneway-desktop/` uses opposing sweeps throughout and a circle
at the pole base. The circle releases on its first attempt; every recorded rotary frame advances or stays still.
The playthrough reaches departure with two creaks, one release, no browser errors and zero premature family
pixels across 150 visibility samples. Caught/freed player-camera captures retain post contact and clear companions.

Typecheck and the production build pass; the existing chunk-size warning remains.

Portrait touch replay in `/tmp/updraft-rotary-oneway-touch/` also reaches departure using a circle at the pole
base. Both frames remain monotonic throughout 1842 recorded updates, with two creaks and one release.
There are no browser errors or early family pixels across 150 samples. Caught/freed desktop
and portrait player-camera captures were inspected; no video motion or listening approval is claimed.

## 9. Pinwheel mix and snag resistance — complete

Separate pinwheel flutter from rotary creak levels in `tuning.ts`, `pinwheels.ts` and `foley.ts`. Slow accumulated
snag work modestly and show local tension while keeping the post anchor fixed (`lines-rotary.ts`,
`rotary-washing.ts`). Verify a brief brush cannot release it, pole-base circles remain forgiving, and tension
relaxes without losing work. Render both audio sources at game gain, verify pinwheel lifecycle, play mouse
and touch through the encounter, and run typecheck/build.

Pinwheel flutter now uses its own 0.018 gain (previously 0.05). Matched offline renders through the game’s
audio graph measure −8.87 dB. The rotary’s short metal friction retains its timbre and one-shot schedule
but gains about 17.5 dB, with audition peaks around −38 to −43 dBFS rather than roughly −59 dBFS. Both
are unclipped. The sound render and level checks pass; listening approval still belongs to Jeremy.
The render tool reuses the production module URLs so Vite’s versioned tuning module cannot invalidate an A/B gain test.

The snag now takes 1.67 seconds of full wind work, with a small eased pull and shiver in the adjacent cloth;
the corner itself stays on its cap until release. Brief input, pauses, persistent progress, forgiving cap/middle/
base sweeps and ground-level updrafts pass at 30/60/120 Hz. The rotary’s one-way motion remains unchanged.

Fresh mouse and portrait-touch circles start from zero snag work and release after 2.22 and 1.97 seconds
of game time, respectively. Captures in `/tmp/updraft-rotary-snag-resistance-desktop/` and
`/tmp/updraft-rotary-snag-resistance-touch/` show the caught and freed sheet from the player camera. No
video motion review is claimed.

Typecheck, production build and rig initialization/contact checks pass. The larger `audio-interruption-check`
fails its “The reverb enters with no jump beyond the beds’ own flutter” assertion on both attempts, before
reaching pinwheel checks; no startup audio code was changed. The existing pinwheel block was run separately
and all four lifecycle checks pass: start, retirement/cleanup, return with cached noise, and silent stop.
Its report is `/tmp/updraft-pinwheel-lifecycle-focused.json`. The production build retains its existing chunk warning.

Both mouse and touch playthroughs reach departure with no browser errors, no premature family reveal and
exactly two rotary creaks plus one cloth release. Reinstating the previous instant-release rate in an isolated
test process fails the new brief-gesture regression, as intended.

## 10. Metal-bearing timbre — rejected in listening review

Replace the rejected rasp, render the new sound at established game gain, verify source cleanup and actual
game playback under real rotary gestures with sound enabled. Run typecheck/build. Supply a new isolated
render for Jeremy's listening review; preserve all accepted mechanics, scene composition and other sounds.

`rotary-creak.ts` replaces the old sawtooth rasp with three irregularly slipping modes, a light friction layer
and two brief collar rattles. Duration is 0.72 s rather than 0.38 s. At established game gain the isolated
render peaks at −23.75 dBFS; all seven sources and eighteen nodes retire, muted calls create no nodes, and
the pinwheel A/B remains −8.87 dB. Audition: `/tmp/updraft-rotary-metal-creak.wav`.

`rotary-live-audio-check.mjs` starts sound through the normal M shortcut, then uses real gestures through both
rotaries and the snag with music enabled. Exactly two calls reach live Foley and produce measured audio;
their isolated taps peak at −25.65/−25.97 dBFS, with total mix peaks −23.09/−15.43 dBFS. Both voices clean up,
and the browser reports no errors. Signal capture: `/tmp/updraft-rotary-metal-live.{json,webm}`. This establishes
runtime routing and levels, not perceptual approval. Typecheck and production build pass, with the existing
large-chunk warning. All mechanics, composition and other audio are unchanged.

Jeremy rejected this timbre and requested real reference audio with a spectrogram comparison. Phase 10's
playback checks establish routing only; do not cite them as sonic approval.

## 11. Recorded-reference study — complete

Find close mechanical references with documented provenance, compare time/frequency structure against the
rejected render using identical spectrogram settings, and provide playable excerpts and a readable figure.
This phase studies timbre; it does not change the gameplay or audio implementation.

Found the CC0 apartment-clothesline recording by AlexLane (Freesound 530036) and DenisChardonnet's metal-gate
creak (LaSonotheque 304). Excerpts, source/licence links, hashes, matched-peak auditions, comparison figure
and measured results are preserved in `assets/audio-reference/rotary-creak/README.md`. The reusable analysis
is `tools/creak-reference-study.py`; identical axes/window/colour settings compare the rejected synth with
both recordings. Figure inspected and opened in Preview. No new synthesized candidate or runtime change.
