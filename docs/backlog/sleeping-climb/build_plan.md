# Sleeping climb build plan

Design: `design.md` beside this file. Work on a branch in a worktree: `main` carries other sessions' uncommitted
audio work. Nothing merges until Jeremy has been told what it changes and approves.

The lead (Claude, creative owner) reviews each phase in the player camera before the next starts: stills for phase 1,
a frame strip from a `VIDEO=1` run for phases 2–3 (about 3 fps across the climb), judged beside the owl in the dark
wood and the journey through the clouds. Agents implement toward the storyboard; they do not redesign it.

Subagents run builds, checks and captures in the foreground, one capture per call within the 10-minute tool limit;
only a dev server runs in the background. Captures go in `mktemp -d` scratch dirs.

## Phase 1: ground, route and storyboard — not started

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

## Phase 2: the beats — not started

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
