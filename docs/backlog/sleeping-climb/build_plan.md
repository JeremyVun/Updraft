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

## Phase 2: the beats — done (2a `982a95ba`, 2b `a494640f`, 2c `a1ba7e88`, lead `84abb218`)

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

### 2c — done (`a1ba7e88`), lead's review of its strip (`/tmp/updraft-climb-2c-igGu/`)

The fog takes the whole window and the sky (76–80.3 s all white, bird readable; the window returns as a ghost with
the lane 80.7–81.7 s and glows from 82 s); the hard edge was the unfogged sky at the sea horizon, now fogged by
`hollowSky` in `atmosphere.ts` (sleeping-only, keyed on `uHollow.w > 0`). The first look back moved one waypoint on to
`SLEEP_STEP_STOP - 1` (over the horn), where the lamp can be framed without a swing: accepted by the lead. The edge
lens keeps 7 m from the bed's centre (`lensBedClear`). Portrait: the saddle lens leans toward the lamp in narrow frames
(`fogNarrowLean`, through `afterCamera`); the first look back still loses the lamp in portrait (accepted). Near-lens
streaks fade through the opt-in `lines.nearFade` (`windLinesNearFade`); the lead widened `lineNearFade` from
[0.8, 2.5] to [2, 4.5] m because bands still crossed the frame from 2.35–2.65 m (35.3–35.7, 38.3–38.7, 86.7–87.0 s).

What later phases must know:
- The first look back's framing depends on the key 0.7 m before `SLEEP_STEP_STOP - 1`; moving the drift or the horn
  means retuning both.
- `hollowMist()` is the single base fog colour for ground and sky; a mismatch brings the horizon line back. Anything
  that changes the fog's top or the shoulder bank changes the sky with it. `uSleepLost` (1 − `WINDOW_SEEN`) whitens
  everything within about 3 m of the window.
- The CPU logic check does not call `afterCamera`; only the GPU tools exercise portrait framing.
- Frames mixing the sleeping island with another room (the crossings in and out) need a look in phase 4, because the
  sky now has a sleeping-only branch.

## Phase 3: surface and sound — done (3a `52c7d88f`, 3b `3a361bfa`, 3c `67f72e80`, merged `8217d2df`; main merged `efb15021`)

Three parallel waves, file-disjoint, each in its own worktree with its own dev server so no wave's edits reload
another's captures; 3b and 3c merge into `sleeping-climb` when all three are done.

### 3a: the drift (worktree `updraft-sleeping-climb`, branch `sleeping-climb`, dev server 5231)

**Owns:** the drift in `src/world/sleeping-trail.ts` (its look, spindrift, footprints) and its shader. Not the rocks.

**Does:**
- The drift reads as wind-carved snow: crust, sastrugi ridges, a curled cornice lip on the lee side, blue shadow in
  its hollows, a moonlit sparkle. Today it is a smooth mound made of angular facets, like a white tent. The thin edge
  renders, so the bird visibly sinks to its chest in the wade. The layers read as they go; spindrift lifts off the
  crest in streams that run the way the stroke went and settle downwind; footprints stay in what is left; both
  channel banks remain. The bank nearest the lens on the walk out (32–34.7 s in the 2c strip) does not fill the
  bottom of the frame.

**Seams:** `snowDepthAt` stays identical to the shader's depth; drift encounter behaviour and timings unchanged.

**Verify:** typecheck, the logic check, `CLIMB=1` GPU run; player-camera stills of the drift before, in the wade and
lowered, and the walk out; one `VIDEO=1 CLIMB=1` strip reviewed by the lead, which also checks the near-lens streaks
after the widened fade.

### 3c: the hillside (worktree `updraft-sleeping-climb-hill`, branch `sleeping-climb-hill`, dev server 5233)

**Owns:** a new `src/world/sleeping-dressing.ts`, the sleeping room's rocks (moved out of `sleeping-trail.ts` into
it), the heightfield's sleeping functions only if the bank's lip needs ground shape (JS and GLSL identical), and the
rabbit's placement and morning wake through `src/creatures/rabbits.ts`.

**Does:**
- The step's bank reads as a ledge too high to hop from the step's lens: turf curling over a lip of rock, part of the
  hillside, not a terrace and not a row of loose rocks.
- The outcrop and bank rocks match the island's rock look elsewhere (`src/world/landmarks.ts`): weathered,
  half-buried, frost-shattered, not bare grey polyhedra.
- Hillside detail at the bird's scale: frosted tussocks and heather clumps, half-buried stones, sheep trods across
  the steep face seen from the bed and the glide, the frozen trickle at `SLEEP_TRICKLE`. None of it marks a route (no
  rows, kerbs, stamped or golden path).
- A lone hawthorn bent by the wind near the drift, on the trickle-to-drift stretch, with a rabbit curled in its form
  under it, snow on its back, ears flat. It never wakes during the climb; in the morning, when the green reaches it,
  it sits up, washes its face and lopes off. Background life, no encounter.

**Seams:** nothing new in the lens's 7 m bed clearance path (west then north of the bed), the glide line, the
morning lane, any look-back sightline or the drift's channel; the bedside framing unchanged; the bird's walking
ground unchanged except at the bank's lip.

**Verify:** typecheck, the logic check, `CLIMB=1` GPU run; player-camera stills of the bank from the step's lens, the
lower slope with the hawthorn and rabbit, the outcrop, the bedside view and the glide; the rabbit's morning wake; one
`VIDEO=1 CLIMB=1` strip reviewed by the lead.

### 3b: weather and sound (worktree `updraft-sleeping-climb-sound`, branch `sleeping-climb-sound`, dev server 5232)

**Owns:** `src/world/sleeping-weather.ts` (snowfall), the sleeping room's sound in `src/audio/` (coordinate through
`coord`: other sessions are editing audio), and the chapter's hooks that feed them.

**Does:** snowfall thickens and turns from falling to driving with `climbExposure`, streaming sideways on the crest
(any ribbon streaks set `nearFade`); the night's wind sound rises with height; foley for snow crunch in the drift, the
wade's struggle, the scramble, the bandaged flutter at the step (following `flap` and `hope`), the unanswered call
into the fog with only the wind answering; nothing louder than the summit's moment.

**Seams:** the `sleepingWind` contract in `docs/contracts/audio.md` (true only in the `climb` phase, which now spans
`climb`, `snow`, `step`, `mist`, `catchFeather`, `crest`); flakes never hide the bird; the fog stop's white keeps its
silence-but-wind character.

**Verify:** typecheck, `sleeping-score-check`, audio checks the project already has for the room, stills of the crest
and fog in snow, a `VIDEO=1 CLIMB=1` run with its audio track levels logged per beat. The lead cannot listen: the
playtest build in phase 4 is where Jeremy hears it.

### Phase 3 handoff notes

- Drift (`src/world/sleeping-drift.ts`): `snowDepthAt` forwards to `SleepingDrift.depthAt`, whose shader twin is
  `DRIFT_GLSL` in the same file; change both together. The cornice's lean-out is drawing only. `SNOW_AT` and
  `alongRoute` live there (`sleeping-trail.ts` re-exports `SNOW_AT`). Prints and the wade trench need the
  `main.ts` line feeding the bird's position and footfalls, which the CPU logic check does not run.
- Hillside (`src/world/sleeping-dressing.ts`): the bank face and turf cap follow the heightfield's lip (`lipAlong`
  mirrors `sleepingCrest`); the rabbit's wake uses a JS copy of `morningAt` from `atmosphere.ts` and waits until it is
  on screen (`WAKE_UNSEEN`, 30 s at most), a lead-accepted addition. The trickle is traced from `SLEEP_TRICKLE` down
  the fall line; long traces read as a path.
- Snow and sound: snowfall reads `NIGHT_WIND` and `uSleepLost`, knobs `snowThicken`, `snowDrive`, `snowShutter`,
  `snowStreakDim`, `snowAcross` (75% of the along-view drive turned across it on the crest), `snowFogCalms`. The night
  wind is `nightWindSound` in `sleeping-wind.ts` through `winterGust`, knobs `nightWindGusts`, `nightWindRoar`,
  `nightWindMost`, `nightWindAnswer`, `fogLull`, `summitLull`, `nightWindSettles`; foley in
  `src/audio/sleeping-foley.ts` and new `foley.ts` methods; `tools/sleeping-audio-check.mjs` renders it;
  `sleeping-check.mjs AUDIO=1` prints levels by beat. Snow steps take `tuning.audio.cygnetStepDb` like other steps.
- `tools/audio-check.mjs` fails on "meadow begins waking without a competing completion phrase", identically on the
  base: not this work.
- For close: `docs/contracts/audio.md` gains the night wind and the climb foley (wording in the 3b report: gusts and a
  capped roar grow with `climbExposure`, lull by `fogLull` while the fog has the window, one swell answers the call,
  settle by `summitLull` at the summit) and the `sleepingWind` line names all six climb beats; `docs/styles.md`'s
  "Footprints … never on grass or snow" gains the drift's prints.

### Lead's review of the merged strip (`/tmp/updraft-climb-3m-jG7S/`, 2 fps sheets, 2026-10-15)

The climb now plays as the storyboard in one run (feather to boat, no errors): the drift's try, sink and layered
clearing; the bank's overhang reading as too high, the lopsided scramble, the window found; the fog's call, glimpse,
turn, white, ghost and glow; the crest. Left for phase 4a:
1. **Ink-blot prints** (38–44 s): prints and gaps in the cleared channel's skin read as dark blue-grey puddles. Soft
   blue-shadowed impressions, far lighter.
2. **White-out on the walk out** (37.5–40 s): the drift fills most of the frame. The bird keeps hill and sky round it
   there (re-key the lens or pull the near bank back further).
3. **The trickle reads as a drawn line** (6.5–11.5 s): a long bright wavy line down the foreground slope. A small
   frozen rill: shorter, broken, matte frost, no brighter than the frost round it.
4. **Boat over the grass** in `push` after a scripted `morning` restore (seen by 3c): establish whether it happens in
   normal play and whether it predates this branch; fix only if this branch caused it, otherwise report.
5. **Crossings:** the sky has a sleeping-only fog branch; check the arrival crossing and the departure to the mirror
   for sky or fog artifacts.
6. The cornice a little bolder, so the lee lip reads from the arrival lens.

### 4a — done (`ff214d11`, `10a948f1`)

Prints and thin channel snow are soft blue (no holes to the turf); the walk-out lens is lower and turned toward the
lamp, so sky and hill show round the bird from about 39 s and the window stays out of frame until the bank's top
(lead's ruling: the remaining white at 37.5–38 s is fine; no window before the bank's top); the trickle is a short
broken matte rill; `driftCornice` 0.62. The boat crossing the grass after a scripted `morning` restore is the
harness skipping the save system's boat placement (a real save or normal play puts it on the west strand), and the
base does the same: left. Crossings in and out show no sky or fog change. Peak climb lens rotation 0.397 rad/s.

## Phase 4: review, playtest, close — Jeremy's playtest notes being addressed (4b)

### Jeremy's playtest, verbatim (2026-10-15)

> Only one small thing, i think the forced pause with the cygnet looking back at the child is a bit too long, and the jump up over the small cliff could have a slightly better animation, maybe some feathers flying off as well kind of like the jump scare in the woods, but not as many feathers. The snow bank also doesn't appear to the player as something that the cygnet should have had problem walking over, maybe something to consider to make it slightly steeper and more formidable from it's perspective? There also seems to be some kind of stuck rabbit frozen under a tree which looks a bit strange.

### 4b — the playtest fixes

1. **The look back** — Jeremy's ruling (2026-10-15): the forced pause that is too long is the one **on top of the
   bank**. Done: from landing on top to walking on is 2.5 s (`stepStandFor`; it was about 4.5 s of shake, a held look
   at the window and a held glance at the lamp, queued). It shakes as it finds its feet (`stepShakeFor` 0.6 s), looks
   back down at the lamp (`stepLampFor` 1.0 s, still counted as the second look back), then turns to the window and
   walks on. The order is lamp then window because the lens, which follows the bird up the route, brings the window
   up over the shoulder about 1.3 s after landing: looking at it first had the bird gazing at an empty sky. Peak lens
   rotation across the top 0.10 rad/s. `glanceFor` and `looksBack` are unchanged.
2. **The scramble over the bank** — done: `Cygnet.clamber` replaces the straight `dash` lerp with a scripted clamber
   (`CLAMBER` shares of `stepClamberFor` 2.1 s): a crouch, a spring onto the face, its chest on the turf lip with the
   body near upright and the feet pedalling at the face (new `scramble` drive in `pose.ts`), a slip back and a haul up
   on the good wing while the bandaged one is held half out and rigid (`stiff` in `wings.ts`), a heave over the lip on
   its breast, and a stagger onto its feet. At the worst of the hang it sheds `stepFeathers` (4) loose feathers from
   the wood's `LooseDown` (now `burst(at, heading, count, speed, size)`; the wood's call is unchanged), flung back off
   the face and carried downhill on the night wind. Side-camera checks show the breast at the lip and the feet on the
   face, with no clipping into the overhang.
3. **The drift** — done: every edge is now a shallow skirt, chest deep, running in to a wind-cut face (`rimAt`, JS and
   GLSL), the trough before it scoured less, and `snowDepth` 1.65 → 2.2. On the bird's way in, the snow reaches its
   chest at the skirt (the wade's deepest stays 0.15–0.4) and the face rises from 0.4 to 0.95 m in 0.4 m; the crest
   stands 1.8 m (it was 1.15). The ridges, cornice, blue hollows, sparkle, layered clearing and channel banks are as
   they were; the walk-out keeps sky and hill round the bird and no window.
4. **The rabbit** — done: from the lens it lay behind the thorn's near stem, which cut across it, level on a slope
   with a gap under its belly and its feet showing, its whole top (head and ears too) white with snow: a pale slab
   with a second disc behind, like bracket fungus on the trunk. Its form moves to the lens side of the thorn and it
   lies side-on to the passing lens; asleep it settles into a scrape worn through the frost, belly down, feet hidden,
   with snow only on its back; its flanks rise and fall (`iRest` in `rabbits.ts`, a 2.2 s breath), and now and then
   an ear flicks or its nose works. It wakes in the morning as before. The meadow's rabbits are unaffected.

Lead watches the whole room in motion with sound beside the owl and the clouds, fixes what does not earn its place,
then hands Jeremy a build to play. On approval: migrate the durable rules into `docs/chapters.md` § The sleeping
island and `docs/contracts/world.md`, delete this folder, and merge.

### Jeremy's second playtest, verbatim (2026-10-15)

> the bunny still looks still, shouldn't it be shivering? What happened to the nice snow being blown away effect from before when the player uses wind on the snow drift blockage to clear a path? The cygnets model is clipping into the bank a few times when it tries to get over it. both in the attempt and during the updraft jump. Also i think that white line is simply from an updraft wind effect and not a bug.

### 4c — the second playtest fixes

1. **The rabbit** shivers in its sleep, visibly from the player's lens as the bird passes.
2. **The snow blown off the drift** by strokes is back and reads as it did before.
3. **No clipping at the bank:** the cygnet stays outside the bank's rendered surface in the try, the slide back and the
   clamber.
4. The tall white line during the bank's circles is the updraft's own wind effect (Jeremy's ruling): left as it is.
