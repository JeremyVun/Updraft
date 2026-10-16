# Meadow redesign verification — 2026-10-13

Worktree: `codex/meadow-echoes`. Development server: `http://127.0.0.1:5244/`.
Whole chapter: `?chapter=meadow&progress=0`; musical play: `?chapter=echoes&progress=0`.
This supersedes the rejected tall-bell/seed-delivery prototype and its earlier readiness claims.

## Experience and inspected evidence

The preserved grey beach and bank lead to a nearer piano on a rounded knoll. Its camera looks over the child's
shoulder and opens onto the rolling hollow with the colour waves. Low flowers answer broad wind strokes;
farther through the fold, seed heads lift into a drifting cloud. The cygnet explores on foot. A listening pause
and gathering beat precede the walk into the family reveal. The existing migration, swim, feather, shower,
rainbow and departure remain. Background scores are unchanged; the breath responses are procedural Web Audio.

- `/tmp/meadow-final-desktop`: real mouse play from the grey landing through all four piano answers, flower
  clusters, seed lift, family, feather, shower and boarding. Reached `toBirches` at 359.7 game seconds with no
  runtime errors. Includes chronological walk captures and every-frame camera trace. This run precedes the
  final small flower clearance, companion position and departure-boat timing corrections.
- `/tmp/meadow-portrait-companion`: final 390×844 touch play from the flower approach through departure at
  251.2 game seconds. Both interactions, idle/off-target checks, family and boarding pass. The camera audit
  covers 8,697 frames, including both characters; minimum projected margin is 5.4%. The camera stays within
  20.7 m of the child during the walk into the crest. Portrait arrival and piano had also passed earlier in
  `/tmp/meadow-redesign-portrait`; their layout was unchanged by the later companion correction.
- `/tmp/meadow-final-circles-*.png`: final desktop replay using real circles for all three flower clusters and
  the seed lift, then continuing through gathering to the crest. Both stages complete, the cygnet stays on the
  ground, and the boat remains at the arrival shore during the family reveal. These captures include the final
  flower clearance and companion placement. Completed interactions no longer display the next wind invitation
  during their settling pause.
- `/tmp/updraft-progress-meadow-<point>.png`: actual writes and reloads passed for `piano`, `echoes-1`,
  `echoes-2` and `pond`. Completed play persists and the remaining walk/listening is retained.

The evidence is automated real-input play, visually inspected chronological stills and camera traces. No video
was recorded or claimed as a motion review. Human listening, first-time comprehension, physical mobile-device
performance and Jeremy's creative verdict remain unverified. The motion report still flags the existing
post-pond paper-follow camera's approximately 5 m outward/inward change over eight seconds; that section's
staging is unchanged. Numeric camera checks establish continuity and framing, not cinematic quality.

## Corrections made through viewport review

The first terrain draft raised the pond crest and cropped the child; the final terrain preserves the original
shore bank and pond/departure surface. Comparing 14,645 protected ground samples against `58c76e7a` found no
change, including the pond level. CPU/GPU height parity in final browser captures is within 0.011 m.

Jeremy rejected the altered piano camera's repeated sideways movement. Its original motif bearing, distance,
height and gaze settings are restored. A separate `45feff79` build supplies the original comparison. The old
46 m finale exposes the pond from the new piano location, so only the final rise remains limited: from the
third response's 14 m to 18 m, with a 42 m distance. Large decorative flowers are kept out of the playable beds, and the child's standing space stays clear.
Seed play happens beside the bed rather than inside it. Shorter irregular grass and a local tread keep the
companion legible without carving a path across the island. The camera turns during the walk so the family is
concealed through listening; it opens toward the pond over the child's next sixteen metres of travel.

The portrait review caught an offscreen companion despite the child and seed cloud fitting. The corrected view
keeps the pair together and lets the cygnet walk alongside the child. The strengthened camera audit rejects the
previous trace at 66.17 seconds. The idle-drift negative control also fails as intended. The boat and departure
kite appear at the far shore only after the family encounter, avoiding the distracting sail behind the pond.

## Focused checks

Passed: TypeScript and production build; production/QA separation; flower effort, retained progress, seed lift,
hold and settling at 30/60/120 Hz; idle, muted, absent, disabled and off-target input; ground-checkpoint companion
flight suppression; checkpoint schema (104 layouts and 4,063 decode cases); real checkpoint reloads; piano
logic, colour growth and framing; meadow plane and route; all twelve pond sight-line/migration cases, retaining
all fifteen swans' runs/lifts. The production build retains the existing large-JavaScript-chunk warning.

Build log: `/tmp/meadow-final-build.log`. Production separation log: `/tmp/meadow-final-production-check.log`.
The final breath timbre was not changed by this redesign; prior audio-envelope results alone do not establish
that the whole sequence sounds good.

## Piano camera and colour correction

The seed-head, airborne-seed and petal materials had cloned the shared atmosphere uniforms, freezing the grey
hold, colour wave and lighting at construction. They now share live uniforms like the flower bed and grass.
The added material-sharing regression fails on the unfixed constructor and passes after the correction.
The real-input piano check also compares every plant material's grey hold and colour wave at each captured
stage; this checks the running renderer through all four answers and completion.

Original comparison: `/tmp/meadow-piano-original-*.png` from the separate `45feff79` build. The intermediate
full camera restoration is `/tmp/meadow-piano-restored-*.png`; its high finale exposed the pond and is superseded.

Final captures: `/tmp/meadow-piano-final-*.png` and `/tmp/meadow-piano-final-portrait-*.png`. Both real-input
runs passed four answers, idle non-completion, plant/world colour agreement, guide visibility and departure.
Inspected response, finale and departure stills, with chronological desktop captures in
`/tmp/meadow-piano-final-frames/`. These are stills, not a human motion review. The final rise retains sky and
keeps the family below the far crest; a sliver of pond water remains visible. Camera framing/continuity,
material sharing and input state checks pass, as does the production build (`/tmp/meadow-piano-final-build.log`).

## Wildlife and wildflower density

Jeremy asked for more animals and flower patches, and whether performance was the constraint. Added overlapping
wildflower patches on the slopes using the existing surface bake, plus six rabbits, eight sheep (lambs included),
eight finches and twelve butterflies near the revised walk. Species remain batched; the piano camera and grey
arrival are unchanged. Runtime population inspection confirms the intended additions, with existing home-island
animals retained. The musical flower and seed beds keep their decorative-flower clearance.

Before/after local Chrome-for-Testing samples at 1600×900, 1.5× render scale, full grass, six seconds warmup and
twenty seconds measurement both recorded 1,199 intervals: median 16.7 ms, p99/max 16.8 ms, no intervals above
25 ms and no long tasks. Draw calls remain 78; triangles increase from 2,200,383 to 2,258,637 (about 2.6%). Logs:
`/tmp/meadow-density-perf-before.log` and `/tmp/meadow-density-perf-after.log`. These are capped local desktop
frame intervals, not GPU headroom or an iPad performance/battery estimate. Population/viewport captures are
`/tmp/meadow-density-before-flowers.png` and `/tmp/meadow-density-after-flowers.png`. Typecheck, input/state
regressions and production build pass (`/tmp/meadow-density-build.log`).

Real-pointer replay from the piano through both encounters and gathering passes, including idle/off-target
input and visible-subject checks (`/tmp/meadow-density-play/report.json`). Inspected the piano reveal,
flower arrival, seed play, listening and gathering captures for added clutter. Both characters and musical
targets remain readable at the interaction stops. This was a still-image review, not a motion review.

## Green approach

The child's climb and piano approach now plant colour in the existing life field, with a 3.2 m soft radius
and 2.2 life/second. Only walking before the piano plants this trail; it remains behind her, joining the initial
piano patch. No new render pass, grass flattening or camera change is involved.

Played the unmodified arrival and walk to the stool at 1600×900 and 390×844. Inspected climb, brow and approach
stills in `/tmp/meadow-green-approach/` and `/tmp/meadow-green-approach-portrait/`; their reports confirm that
previously grey ground behind her gains colour while distant hills remain grey. These are still reviews.
Typecheck, the route check at 30/60/120 Hz and the production build pass (`/tmp/meadow-green-build.log`).

## Wind-bough foundation

`world/wind-bough.ts` adds the hollow wooden prototype, reed and local incoming breeze beside the piano. Calls
use the existing procedural breath voice; `audio/meadow-duet.ts` holds four calls, their piano reply patterns
and a longer finale. Its note times and `greenAt` are relative to the first note, after `windBough.inhale`.
The final reply schedules that finale after `windBough.finalRest`; the colour front and existing camera rise
begin at its greening cue. Recordings have not been supplied, cut or integrated, and these are temporary notes.

`meadow-duet-check` passes at 30/60/120 Hz: calls cannot answer themselves, input opens after the call, partial
replies are not interrupted, all four replies are required, and the final wave waits for its musical cue.
A runtime negative control that opened piano input during a call was rejected by the check. The existing
piano camera check includes the bough crown and passes. Typecheck and production build pass, retaining the
existing chunk-size warning (`/tmp/meadow-bough-build.log`).

Real mouse and portrait touch sweeps passed all four replies, idle non-completion, early-call input rejection,
shared plant/ground colour, finale and departure. Captures/reports: `/tmp/meadow-bough-duet-*` and
`/tmp/meadow-bough-portrait-*`. Inspected call, reply and wide-finale stills; no motion or listening approval is
claimed. The bough is an initial geometric prototype, with final sound and pacing awaiting Jeremy's clips.

The requested stable preview remains the earlier frozen build on port 5246, rooted at
`/tmp/updraft-timing-preview-AH5XUd`; the new instrument is in development on port 5244. The frozen preview
still responds after all source changes and the separate production build.

## Merge verification — 2026-10-14

Merged the full worktree onto clean `main` at `9c48f571`, retaining its two dependency-update commits.
TypeScript and the production build pass (`/tmp/meadow-merge-build.log`), as does production/QA separation
(`/tmp/meadow-merge-production-check.log`). The existing large-chunk warning remains.

The mechanics suite completed all 72 checks (`/tmp/meadow-merge-mechanics/results.json`): 69 passed on the
first run, including every Meadow and piano check. The Little Boats arrival fixture lacked `life.bloom()`;
adding that stub makes its full rerun pass (`/tmp/meadow-merge-little-boats-rerun.log`).

The unseeded wood check failed once on portrait ember visibility at 120 Hz. Both merged main and the separate
pre-merge `64cc1c72` checkout pass with random seed 731 and produce identical output
(`/tmp/meadow-merge-wood-seeded.log`, `/tmp/meadow-merge-wood-baseline-seeded.log`). This establishes parity for
that seed, not a fix for the unseeded check's variability. The foghorn check's `?url` audio import failure also
occurs on pre-merge main (`/tmp/meadow-merge-foghorn-baseline.log`); it remains an inherited test-harness issue.

No deployment or push was requested or performed. Recorded phrases and final musical synchronisation remain
pending; the existing player-camera captures are the visual evidence, not a new motion or listening review.

## Second playthrough: story and camera — 2026-10-16

Items 1, 2, 3 and 6 of "Second playthrough of the recorded duet" in [design.md](design.md), from player-camera
captures on the dev server (fixed 1/60 s steps; the duet's answers given through `piano.perform` to reach the
finale quickly, then the real-input piano check). Stills and numbers, not a motion or listening review.

- **Finale.** From the greening cue the camera rises from 14 m above the ground (17 m from her) to 123 m above it
  and 155 m from her, about 13 s in, holds to about 20 s and comes down to the walk's own view of her (26 m up,
  45 m back) by 28 s, as she gets up; distance only grows on the way up and only shrinks on the way down. The final
  front crosses at 16 m/s, so the far half of the island turns from grey to green while the camera is up (it
  reaches the pond about 13.5 s in). Landscape and portrait use the same high view; portrait sees the island's
  length and crops its sides. The pond's water is seen from the high view and is empty: the family stays at
  `shown` 0 while `seesPond` finds the raft on screen, and came in 43 to 45 s after the cue, once the camera had
  come down into the fold behind her. The boat stayed at the landing, out of frame, and the departure kite is
  disabled until the crest. Strips: `/tmp/updraft-story-hbJM/f2-strip.jpg` (landscape),
  `/tmp/updraft-story-hbJM/p2-strip.jpg` (portrait).
- **Leaving the stool.** She steps off the stool to the west, round the end away from the bough and out behind the
  case, then throws and walks on north; the old path took her through the case. Strip:
  `/tmp/updraft-story-hbJM/walkround-strip.jpg`.
- **Warm bed.** Rendered with `tools/meadow-duet-render.mjs`: it now swells in over `afterFadeIn` (6 s,
  smoothstep), at −20 dB 1.25 s in, −6 dB at 3 s and full by about 5.5 s; before, it reached full level within
  about 0.3 s.
- **Brow.** Against the unchanged prototype on 5251, the same 0.48–0.5 rad look round from the climb's profile onto
  her line to the piano took 10–90 % in 0.55–3.1 s and settled by 4.4 s (peak 0.22 rad/s; the camera rose
  4.6 m/s at most); it now begins as she arrives, settles by 7.5 s and she walks on at 7.8 s (peak 0.11 rad/s,
  1.7 m/s). Start and end framings are the old ones. Strip: `/tmp/updraft-story-hbJM/b4-strip.jpg`.
- **No trodden grass.** The flower and seed play no longer press the grass flat round her.
- **Cygnet in the grass.** With the pressing gone, real strokes through both plays (`meadow-echoes-check.mjs`,
  landscape, passed) show the cygnet's head and neck above the grass and its body half in it; in the flower bed it is
  small at her feet and at times behind her legs, so it is easy to miss there. Reported, not compensated.
- Gates after merging `main`: typecheck, production build (existing chunk-size warning), `piano-frame-check.mjs`,
  and the real-input `piano-check.mjs` in landscape and portrait touch all pass. Two portrait runs earlier failed
  at the first call because the machine was heavily loaded (load average 75): the check's touch strokes fell so far
  behind the fixed-step clock that the bough had already repeated; the unchanged prototype and a rerun pass.

## Flower bed and seed down — 2026-10-16

Branch `meadow-fix-flowers` (design items 4, 5 and 7, with Jeremy's follow-up on the bed and the harebells).
Before/after stills from the actual play camera are in `/tmp/updraft-flowers/` and are scratch evidence.

- Flower bed: asleep it is a scatter of closed, bowed violet buds in the grass. Each ordinary sweep opens the
  flowers along its track on screen; about two passes open a flower. Broad strokes aimed at the sleeping stretch
  woke the bed in 5 sweeps (landscape mouse) and 7 (portrait touch); the last sleepers then rose with it, and the
  play ended 1.6 s after the bed reached three quarters awake (`tuning.meadowEchoes.bedFinish`), with no timer
  before that. Sheet: `bed-before-after.png` (top row the previous build, bottom row this one), strip of the first
  sweep `fin-bed-strip.png`.
- Seeds: sweeps only lean the heads. Circling over them lifted all the down in 3 loops (landscape and portrait);
  a pause between loops keeps what is up hovering above the heads. In-browser, the worst change of velocity of
  any lifted mote was 10.3 m/s² over about 1.2 million mote-frames, and none ever moved down. Landscape frames the
  column against the green west slope with the low sun behind it; portrait looks north-east over the golden hay
  slope, which keeps the pond out of the narrow frame. Sheet: `seeds-before-after.png` (Jeremy's screenshot, the
  previous build, this one circling and released); motion strip from a recording, `b3-rise-strip.png`.
- No notes: the flower and seed play and the harebells make no pitched sound; `audio/meadow-breath.ts` and its
  check are gone.
- `node tools/meadow-seeds-check.mjs`, `node tools/meadow-echoes-state-check.mjs`, `meadow-echoes-check.mjs` in
  landscape (FULL, TRACE) and `W=390 H=844 TOUCH=1`, `ONLY=meadow progress-check.mjs` (piano, echoes-1,
  echoes-2, pond) pass. `meadow-camera-audit.mjs` passes (character margin 11.8%, departure 17.5 m), and
  `camera-intent-report.mjs` flags the same small jerks in the play beats as a trace of the previous build, with
  no reversals in them.

Not established: a human motion review of the rise and of the bed waking, and Jeremy's creative verdict.
