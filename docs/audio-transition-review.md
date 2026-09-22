# Background music transition review — September 22, 2026

Jeremy's brief: the player must leave the previous tune's headspace before a new one enters. Keep the
outgoing music through the journey, fade at a musical stopping point, give the silence time, and start
the next piece when the scene is ready. This pass changes direction and timing, not approved compositions.

## Findings and changes

The old ordinary handoff used a 1.5-second fade and only 0.4 seconds of explicit rest. It now uses a
three-second fade, three seconds of music/reverb silence, and a 2.5-second entrance. Sleeping gets a
3.5-second rest; Sky Mirror four; Mirror → Summit retains five and its three-second entrance. Wind,
water, physical sounds and authored calls continue. An early landing cannot shorten the rest.

Music waits up to 4.5 seconds for a nearby melodic ending. The opening first lets its current chord
settle; Little Boats has stopping points after each short figure, so overlapping pluck tails do not
make it appear to have no musical endings. The approved notes and their ordinary playback timing remain.

The outgoing music stays longer on short crossings. Preparation cannot begin until at least 35% of the
route is behind the boat, replacing the previous 5% threshold. A separate gate admits the destination
only in the final approach and after the opening's farewell camera has substantially turned forward.
Approach estimates account for the boat's shore speed cap, preventing a fast sail from starting a long
empty stretch before Meadow. The sea handoff now waits for the dolphins' actual farewell.

Sleeping morning previously stopped while the new sea arrangement started immediately. The crossing
now requests an explicit handoff, preserving the morning phrase through the fade and giving it a real rest.
Re-entering an already-playing piece no longer creates a duplicate fade/rest, including Wood's approach
and checkpoint entry.

## Every change of piece

| Passage | Musical exit and incoming scene | Rest | Result |
| --- | --- | --- | --- |
| Opening → Lines | Keep the full approved opening across the sea. Fade a settled chord; admit Lines on the final approach, facing its shore. | ≥3 s | Fixed; actual browser landing retains the incoming clock. |
| Lines → Little Boats | Keep the shore phrase after boarding; let its nearby melodic ending pass before fading. Boats enters near its landing. | ≥3 s | Rendered and sailing timing checked. |
| Little Boats → grey Meadow | Finish the current short figure. Use the slower shore approach when deciding when to fade. The grey bed enters near the bank. | ≥3 s | Fixed premature fast-sail handoff. |
| Grey Meadow → playable piano | Music stays during walking/looking, withdraws at the stool, and is clear before the demonstration. | Authored physical handover | Real browser check passes; preserve the previously approved quiet overlap with the child's first key. |
| Piano → awakened Meadow | The lullaby completes, its completion response gets its space, and the child leaves the stool before the walking score starts. | Existing scene timing | Code timing reviewed; no change to the approved duet or completion cue. |
| Meadow → Birches | Keep Meadow during departure. Fade on a nearby phrase ending; Birches enters at the approach or after a very fast landing. | ≥3 s | Fixed: calm fade request moved from 0.28 s after departure to 10.85 s. |
| Birches → Drowned Village | The final birch phrase fades on leaving; rooftops' music starts as the channel begins to take over. | ≥3 s | Rendered; channel entry and departure checked with real sailing code. |
| Drowned Village → Wood | The approved storm continues on shared D/A; its music thins into the forest drone after the plane loss. | Continuous 4 s overlap | Preserve the specific earlier approval. No second tune enters, and no duplicate handoff occurs later. |
| Wood → Sleeping | Keep the forest's hush through the crossing; clear its reverb before shelter enters on approach. | ≥3.5 s | Rendered and sailing timing checked. |
| Sleeping morning → open sea | Fade the morning composition after boarding; sea begins after its own rest. | ≥3 s | Added the missing handoff. |
| Sea → Sky Mirror | Retain the reunion until the dolphins actually leave. Fade the arrival bed; admit Mirror during the reflective-water approach. | ≥4 s | Fixed the early fade during a fast-sail dolphin farewell. |
| Sky Mirror → Summit | Fade after departure; wait for the first offshore turn, at least 30 units clear, and the full rest. | ≥5 s | Preserved; no restart at landing. |
| Summit flight → farewell → recognition/home | Develop the same approved drone at story beats. Let the upper voice leave; honour the paper hush and recognition cue. | Existing story hush | All phases rendered; the approved recognition melody is unchanged. |
| Home → finale → credits | The once-only finale takes over the pad, then music yields permanently to the world before credits. | Existing ending cut | Production lifecycle/render checks pass; no second score restarts underneath it. |

Developments within Lines, Meadow, Birches, Sleeping, Sea, Mirror, Drowned and Summit remain parts of their
own compositions. Adding a full island-style pause to every internal chord/section would interrupt their
musical thought. All forty sections were exercised through their normal phase transitions and retirement.
Sleeping's cold and summit passages retain their authored silence; its morning cue keeps its initial space.

## Evidence and listening clips

`node tools/music-transition-audit.mjs` renders ten production handoffs and checks 104 conditions,
including digital silence of both music and reverb, source retirement, landing continuity, stalled frames,
and suppression of duplicate handoffs. It also renders forty score sections. No clipping was detected.
These are isolated music fixtures, not full gameplay recordings or perceptual approval. The request is
at 0:18 and the arranged landing at 0:42; individual phrase endings determine the exact fade time.

| Clip | File |
| --- | --- |
| Opening → Lines | [Listen](/tmp/updraft-music-transitions/opening-lines.mp3) |
| Lines → Little Boats | [Listen](/tmp/updraft-music-transitions/lines-boats.mp3) |
| Little Boats → Meadow | [Listen](/tmp/updraft-music-transitions/boats-meadow.mp3) |
| Meadow → Birches | [Listen](/tmp/updraft-music-transitions/meadow-birches.mp3) |
| Birches → Drowned Village | [Listen](/tmp/updraft-music-transitions/birches-drowned.mp3) |
| Drowned Village → Wood | [Listen](/tmp/updraft-music-transitions/drowned-wood.mp3) |
| Wood → Sleeping | [Listen](/tmp/updraft-music-transitions/wood-sleeping.mp3) |
| Sleeping → Sea | [Listen](/tmp/updraft-music-transitions/sleeping-sea.mp3) |
| Sea → Sky Mirror | [Listen](/tmp/updraft-music-transitions/sea-mirror.mp3) |
| Sky Mirror → Summit | [Listen](/tmp/updraft-music-transitions/mirror-summit.mp3) |

The sailing audit uses the actual chapters and boat physics at 30/60 Hz, ordinary breeze, sustained gusts,
two wind directions and late gusts. It covers all eight routes; Meadow and Mirror were rerun after their
specific fixes. `/tmp/updraft-journey-pacing-music-audit-all.json` records request/approach gates and landing
times. These gates are not claims about the exact incoming audio time: phrase endings and full rests also apply.

The Lines browser fixture arranges the final leg after the farewell camera. The incoming score starts
with the washing island ahead, continues across landing, and preserves non-musical wind feedback.
Evidence: `/tmp/updraft-arrival-audio-browser.json`, `/tmp/updraft-lines-music-entry.png`.
The real piano approach also passes: `/tmp/updraft-piano-audio-browser.json`.

Two further browser checks sail from the actual departure states. Birches keeps Meadow for about
13 seconds, fades for three, rests for three, and enters with its shore close ahead (16 world units
remaining). Sleeping morning fades for three seconds after boarding, rests for three, and admits the
sea composition offshore. Both retire the outgoing score before the new one enters; neither reports
browser errors. Evidence: `/tmp/updraft-transition-scenes-browser.json`,
`/tmp/updraft-birches-music-entry.png`, `/tmp/updraft-sea-music-entry.png`.

Regression checks cover the approved opening, summit/finale, Drowned/forest, Sleeping rests and the common
audio director. Older Drowned/Sleeping test fixtures were corrected to reflect the already-approved gesture
gates: musical wind begins in the actual forest and only the feather climb on Sleeping.
