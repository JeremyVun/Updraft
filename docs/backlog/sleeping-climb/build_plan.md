# Sleeping climb build plan

Design: `design.md` beside this file. Work happens in the worktree `/Users/jeremy/projects/updraft-sleeping-climb`
(branch `sleeping-climb`; `main` carries other sessions' uncommitted audio work), whose dev server is
`http://127.0.0.1:5231/` (pass `BASE=http://127.0.0.1:5231/` to the tools). Nothing merges until Jeremy has been
told what it changes and approves.

The lead (Claude, creative owner) reviews each phase in the player camera before the next starts: stills for phase 1,
a frame strip from a `VIDEO=1` run for phases 2–3 (about 3 fps across the climb), judged beside the owl in the dark
wood and the journey through the clouds. Agents implement toward the storyboard; they do not redesign it.

Subagents run builds, checks and captures in the foreground, one capture per call within the 10-minute tool limit;
only a dev server runs in the background. Captures go in `mktemp -d` scratch dirs.

## Phase 1: ground, route and storyboard — done (`ee152f85`, reviewed by the lead 2026-10-14)

What later phases must know:
- `SLEEP_PATH` is 69 m (18 points). Named stops in `sleeping-layout.ts`: `SLEEP_DRIFT_STOP` 6 (below the drift),
  `SLEEP_STEP_STOP` 9 (bank foot, ground 10.90; the top is point 10, ground 13.38), `SLEEP_FOG_STOP` 14 (saddle),
  `SLEEP_CREST_STOP` 15 (crest foot, 11.8 m to the window). The snow and mist encounters fire at the drift and fog
  stops; `step` and `crest` exist only as camera cases.
- The climb lens is `CLIMB_LENS` in `story/sleeping.ts`, keys laid out by distance up the route (`LENS_AT`), so it
  holds while the bird stands and never turns on its own. Look-back framing is already in it: lamp keys after the
  drift, window keys from the step top, fog keys at the saddle. New beats keep using it; re-key rather than override.
- The bank (lip through (-155.3, -1932.5), 1.3 m) is exempt from the 0.65 walking-slope gate within 1.4 m of its lip.
  It has no rock lip yet (a row of rocks read as floating): phase 3 gives it a turf overhang or lip.
- On the lower slopes the window is kept out of frame by the lens direction, not hidden by the shoulder (a shoulder
  cannot hide a window 10 m higher from a lens 2.4 m over the bird). At the bank foot the shoulder does hide it.
- `cygnet.ts`: idle acts no longer start while a scripted preen holds the neck (`preenWeight > 0`), which let a stretch
  pull the bill off the bandage at some arrival timings during the summit unwind. Approved by the lead.
- Open: the lens orbits up to 0.48 rad/s where the bird hurries (out of the drift channel, up the last crest with the
  feather); recheck after phase 2's pacing. Portrait framing untested. The drift is still a smooth mound and the
  outcrop rocks are bare angular polyhedra (phase 3). `tools/sleeping-check.mjs` crashes at leaving-bed (`'scale'` of
  undefined, line ~243), before this work too.

**Owns:** `src/world/heightfield.ts` (`sleepingHeight` and `hf_sleeping` only), `src/world/sleeping-layout.ts`,
place constants in `src/world/sleeping.ts`, stop positions in `src/world/sleeping-trail.ts`, the climb camera case in
`src/story/sleeping.ts` (`edge`/`climb`/`snow`/`mist`/`catchFeather`, plus new `step`/`crest` cases as camera stubs).

**Does:** reshape the hill (switchback, step bank, narrow crest) and `SLEEP_PATH` to about 70–80 m; name the stop
indices; place the drift, step, fog and crest; direct the lens per stretch so each stop's arrival frame shows the
bird, where the wind goes and where it is heading, and so each of the three look-backs has the bed's lamp beyond the
bird from where the lens already is.

**Seams:** bed, `PILLOW`, `WINDOW`, `CURTAIN_*`, `SLEEP_LEDGE` unchanged; `SLEEP_ROUTE`/`SLEEP_APPROACH` derived as now;
JS and GLSL heights identical; the glide line and the morning `lane` from window to bed stay clear of new ground.

**Verify:** `npm run typecheck`; `tools/sleeping-logic-check.mjs` still passes with the existing two encounters moved
to the new stops; player-camera stills at: bedside window framing, lower slope (window hidden), drift arrival, after
the drift looking back, step arrival, step top (window revealed, bed below), fog stop, crest, hilltop. Bedside rule:
window above the skyline with a clear light path to the pillow. Grounding: bed, window and bird feet on the rendered
surface at every stop.

## Phase 2: the beats — in progress

Split in two waves (phase 1's agent ran near the context ceiling on its verification loop): **2a** builds every beat
with the logic, adversarial, touch and score checks and one `VIDEO=1 CLIMB=1` smoke run whose frame strip the lead
reviews; **2b**, a fresh agent, fixes what that review finds and checks portrait framing and lens speed.

Wind seam for phase 3: the chapter exposes one climb exposure value (0 at the bed's edge, 1 on the crest, from route
progress, never a clock) that drives the night's wind strength here and that phase 3's driving snow and sound read.

### 2a — done (`982a95ba`)

Every beat is built; typecheck, logic (30/60 fps, `ADVERSARIAL=1`), score, and GPU `CLIMB=1` (`ADVERSARIAL=1`,
`TOUCH=1`) checks pass, and the full GPU run now reaches the boat (the leaving-bed crash was the tool reading a removed
`child.rig.coat`). Measured with bot input: edge to hilltop 119 s; smoke video climb → unbinding 95 s.

What later waves must know:
- `SleepingChapter.climbExposure` (0 at the bed's edge → 1 at `SLEEP_CREST_STOP`, route progress, never decreases,
  holds 1 through the summit, falls with the morning) adds `climbWind` to the breeze on climb beats and drives
  `Cygnet.braced` (lean, `Drives.braced` in `pose.ts`). The extra wind drops away at the summit so its circles are as
  before.
- `SLEEP_TRICKLE = [-160.3, -1920.24]` in `sleeping-layout.ts`: the bird hops there; phase 3 lays the frozen trickle.
- The drift lowers in `snowLayers` (4) eased layers; a sweep giving at least `snowLayerFrom` of a layer takes it once
  the stroke ends. The bird wades to `driftChest` (0.32 m of modelled snow) but the drift shader draws nothing that
  thin, so it does not visibly sink yet (phase 3's drift look must render the thin edge).
- The step holds the bandaged wing stiffer by lowering its recovery (`stepWingRecovery`), not a new pose; the run,
  hop and scramble target fixed distances past point 9 (`stepFoot`, `stepBack`, `stepTop`), so moving the bank means
  retuning them. Summit circles are unchanged.
- The fog closes by raising the pooled fog's top to 19 m (a thickened saddle bank hid the bird); the window's glow
  and halo fade with `WINDOW_SEEN` (`trail.windowLost`, `trail.glimpse`, both eased), which touched
  `world/sleeping.ts` and `world/sleeping-weather.ts`. The fog's invitation point is 1.4 m uphill of the bird.
- Scripted moments run through `play()`, which must stop when the stage changes (without it a moment looped until
  memory ran out). `feather.encouragement` now decays while the feather is in the bill.
- `tools/sleeping-score-check.mjs` defaults to 5230 (main's server): pass `BASE` for the worktree.

### Lead's review of the 2a smoke strip (2026-10-15), the binding list for 2b

Frame times are on the smoke video's clock (`/tmp/updraft-climb-2a-FBgL/`, `sheet-NN.png`, 3 fps).
1. **The fog's commitment is off screen** (84–87 s). The lens at the fog stop faces back down the hill for the
   glimpse of the bed, so the player's uphill carve, the lane and the window's glow returning never show; the
   climb's emotional turn happens out of frame. When the bird turns uphill after the glimpse, the lens comes round
   with it, slowly and led by the bird's turn, so the invitation, the parting lane and the window coming back are in
   frame before the strokes start, and stay in frame through `catchFeather`.
2. **The climb opens looking straight down** (1–6 s): the bird small on featureless fog and grass from above, the
   defect this rebuild set out to remove. From the `edge` beat in normal play (not only the checkpoint restore), the
   lens is low and behind or beside the bird with the slope rising ahead.
3. **The drift doesn't read** (17–46 s). The bird is about a twelfth of the frame height, so the wade, struggle,
   back-out and shake are hard to see; the frame then holds unchanged about 10 s until the invitation; after the bird
   passes, the drift still looks whole from the next lens, with no channel. Bring the lens nearer and lower for the
   attempt so the bird reads; show the drift's invitation about 5–6 s after the bird's look (as the step's is); make
   the channel through the lowered drift visible from the lens after it.
4. **The step's look at its wing doesn't read** (48.7–52 s): the bird just stands. A clear turn of the head to the
   bandaged wing, held, before the invitation. Confirm from a close capture that the hope and the scramble read
   lopsided (good wing beating, bandaged one stiff); if they don't, make them.
5. **The crest is over too fast** (90.7–95.0 s, 4.3 s with the bot's tailwind): the strongest-wind beat barely
   registers. About 7 s with a tailwind and 11 s without, braced and small-stepped.
6. **White bands across the lens** (43, 47, 52.7, 62.7, 64.3, 66.3, 85–86 s): long bright streaks, some a fifth of
   the frame wide, crossing near the camera. Identify what draws them (player gust trails meeting the hillside near a
   low lens, the step's updraft streaks, or the night wind's wisps). Fix them in the sleeping room only; if the cause
   is a shared system whose look elsewhere would change, report it to the lead instead.
7. Carried from earlier: portrait framing at every stop (the fog invitation still falls past the edge), and lens
   orbit speed after the pacing changes (it reached 0.48 rad/s in phase 1).

Kept as they are: the step's run, slide and scramble; the window found from the step top; the fog closing and hiding
the glow; the call; the glimpse of the bed; the crest framing toward the window. The two long walks (trickle → drift
about 12–14 s, step top → fog about 13 s) are left for phase 3's hawthorn and rabbit and the fog's climb over the
shoulder; do not shorten the route.

### 2b — done (`a494640f`)

Items 1–5 fixed and confirmed by the lead in the 2b strip (`/tmp/updraft-climb-2b-W1N5/`): the fog stop's lens comes
round behind the bird as it turns uphill (glimpse 74–76 s, turn 76.5–81 s, lane and glow 84.7–85.3 s, `catchFeather`
framed); the checkpoint resume cuts to its own shot (`cameraCut`) and the climb opens low behind the bird; the drift
lens is nearer (bird a sixth of the frame), its invitation about 5.4 s after the look, the layers drop visibly and the
bird walks between two banks; the step's look bows the head to the bandaged wing and the hope beats the good wing
(`Cygnet.hopeBeats`); the crest takes about 7 s with a tailwind and 11 s without. Checks all pass. Lens peaks
0.445 rad/s rotation, 3.6 m/s translation.

What later waves must know:
- The fog stop's lens is `FOG_TURNED`, driven by `fogTurn` (1 once the fog is done); timings `mistGlimpseTurn`,
  `mistTurnAfter`, `mistTurnFor`, `mistInviteAt`. Re-key there. Phase 3's fog over the shoulder must keep the window
  in that turned frame.
- Drift: `SNOW_AT` is offset −0.7 across the path; `CHANNEL_WIDEN`/`CHANNEL_SOFTEN` .45/.9; the invitation point is
  `snowDepth + 0.3`. `snowDepthAt` must stay identical to the shader's depth. The drift look must render the thin
  edge (so the bird visibly sinks) and keep both channel banks.
- The step sets `k.hopeBeats` (0 again once over); the bandaged flutter's foley follows `flap` and `hope` there.
- The near-lens bands (review item 6) are the player's gust trails and the circles' lift streaks from the shared
  `src/fx/windlines.ts`, spawning 2.2–5.2 m above the ground near the pointer's hit on the hillside, so a low lens
  by rising ground gets them within 0.4 m. `sleeping-check` writes `nearLine` per frame to measure them.

### 2c — the lead's review of the 2b strip (2026-10-15)

1. **The lost window still shows.** While the fog has the window (80–84 s, the turned frame) its frame stands as a
   pale post at the top of the hill, so the window is never really lost and its return is weaker. It is gone in the
   white until the lane opens. In the same frames a hard straight horizontal edge crosses the fog (the pooled fog's
   top or the saddle bank's edge); the fog has no straight edges.
2. **The first look back misses the lamp:** during the glance after the drift the lamp is off screen left. The lens
   on that stretch frames the lamp beyond the bird from where it already is.
3. **The edge beat's lens skims the sleeping child's face** (normal play, edge t≈5 s) coming down from the bedside
   view. It keeps clear of her and the bed.
4. **Near-lens streaks** (item 6), lead's ruling: an opt-in near-camera fade in `src/fx/windlines.ts` (alpha fading
   with distance to the camera over about 0.8–2.5 m), switched on only by the sleeping climb, so every other room is
   unchanged. Measure with `nearLine`.
5. **Portrait glimpse:** in portrait the bed's lamp is out of frame during the fog's glimpse. If the camera already
   adapts framing to aspect elsewhere, use that so the lamp is in frame; otherwise report and leave it.

**Owns:** `src/story/sleeping.ts` (climb beats), `src/fx/feather.ts`, `tuning.sleeping` in `src/tuning.ts`,
`src/world/sleeping-trail.ts` (encounter state), cygnet acts in `src/creatures/cygnet.ts`/`cygnet/pose.ts` only if a
needed act is missing (the bandaged flap-scramble; reuse `peer`, `shiver`, `look-back`, `into-wind`, `shake`
first), `tools/sleeping-logic-check.mjs`, `tools/sleeping-check.mjs`, `tools/sleeping-score-check.mjs` (beat lists).

**Does:** the drift's try-and-back-out before strokes count, layered lowering; the `step` encounter (circles, lower
threshold, `mayFly` false, scripted lopsided scramble, reveal on top); the fog rework (enclose and hide the glow,
turn, shiver, unanswered call, scripted glimpse of the lamp, invitation, uphill carve brings the glow back,
`catchFeather`); the `crest` tailwind; the three look-backs; weather and wind rising with route progress; feather
unassisted lead about 1.2 m/s (from about 0.6) with `climbPace` matched so the bird walks unhurried and keeps up.
New beats join the `climb` score phase.

**Seams:** stops wait for real input and never solve on time; wrong input harmless; progress persists per stop; the
`feather` checkpoint resumes the whole climb; the summit beats receive the bird as now (feather in bill, at
`SLEEP_LEDGE`).

**Verify:** logic check covers each stop with real gestures, `ADVERSARIAL=1` (wrong verb at each stop, interrupted
progress, idle until the invitation shows), `TOUCH=1`; score check passes; one `VIDEO=1 CLIMB=1` run reviewed by the
lead as a strip for pacing (edge to hilltop about 2–2.5 min with prompt input, no walk over about 10 s without
something happening).

## Phase 3: surface and sound — not started

**Owns:** `src/world/sleeping-trail.ts` (drift look, spindrift streams, footprints), a new
`src/world/sleeping-dressing.ts` (tussocks, heather, frozen trickle, hawthorn, stones, sheep trods), rabbit placement
via `src/creatures/rabbits.ts` and its morning wake, `src/world/sleeping-weather.ts` (driving snow on the crest),
foley mapping for snow crunch, the scramble, the bandaged flutter and the unanswered call (coordinate through
`coord`: other sessions are editing `src/audio/`).

**Does:** the drift reads as wind-carved snow (crust, sastrugi, cornice, blue hollows, sparkle); natural hillside detail
at the bird's scale, none marking a route; the rabbit asleep under the thorn, waking and loping off when the green
reaches it; wind sound rising with height.

**Verify:** stills of the drift, lower slope and crest in the player camera; the rabbit in the morning; one full-room
`VIDEO=1` run reviewed by the lead with sound. Production build check passes.

## Phase 4: review, playtest, close — not started

Lead watches the whole room in motion with sound beside the owl and the clouds, fixes what does not earn its place,
then hands Jeremy a build to play. On approval: migrate the durable rules into `docs/chapters.md` § The sleeping
island and `docs/contracts/world.md`, delete this folder, and merge.
