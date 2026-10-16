# Local checks

Every check runs locally from `tools/`; there is no CI. Browser tools default to the dev server on
`http://127.0.0.1:5230/` and take `BASE` for another server (use `npm run build:qa` then `npm run preview:qa`, or a worktree with its own
server, for anything long or visual: a dev server reloads on any `src` edit, including another session's). Browser
captures share the GPU (`tools/lib/browser.mjs`, up to `GPU_SLOTS`, default 4, at once), since fixed steps make them
independent of speed; tools that time real frames (`perf`, profiles, `start-check` and similar) take it alone and wait
for running captures, so no capture distorts them.
Chrome for Testing uses Metal on macOS and the browser's default backend elsewhere; `ANGLE` explicitly selects a
comparison backend. No GPU blocklist override is used. Evidence goes under
`/tmp`. Node mechanics checks load TypeScript through `tools/lib/typescript.mjs` and need no browser.

For Still's relocated grass, `COMPARE_BASE=<pre-relocation QA build> BASE=<changed QA build>
node tools/still-grass-check.mjs` compares blade positions, heights, tuft coverage, colour, curves, flowers and
ground normals at all three detail levels. `BROKEN_BASE` optionally records the regressed build too. Captures and
metrics go to `OUT` (default `/tmp/updraft-still-grass`); inspect the stills as well as the numeric comparison.

The Meadow musical play has `meadow-seeds-check` (persistent gesture effort and recovery),
`meadow-echoes-state-check` (input ownership, checkpoint recovery, flower strokes and seed lift), and
`meadow-breath-check` (procedural voice envelope and headroom). `BASE=<dev> node tools/meadow-echoes-check.mjs`
plays the flower phrase and seed lift with real gestures; `FROM=meadow FULL=1` includes the entire chapter, and
`W=390 H=844 TOUCH=1` exercises portrait touch. It writes captures and a state report under `OUT` in `/tmp`.
`TRACE=1 AUDIT=1` also captures every camera step and intervening walk frames. Run
`node tools/meadow-camera-audit.mjs <OUT>/audit-camera.jsonl` to check child framing through the handoffs and
prevent the wide retreat before the pond; `camera-intent-report.mjs <OUT>/audit` flags motion to inspect.
`ONLY=meadow node tools/progress-check.mjs` includes the two new saves. These checks do not replace human audio
or motion review.

## Groups

`tools/check.mjs` runs named groups sequentially and writes each check's log plus `results.json` to
`CHECK_OUTPUT` (default `/tmp/updraft-<group>-<time>`):

- `npm run check`: fast shader, parity, input, timing and engine mechanics, no browser.
- `npm run check:mechanics`: the quick group plus chapter, camera, gesture and story mechanics (about five minutes).
- `npm run check:browser`: shader backends, touch and viewport, chapter transitions, context loss, the start screen,
  saves, frame scheduling and chapter views. Needs a running server.
- `npm run check:audio`: the offline audio and score checks, in headless Chrome against a running dev server, no GPU
  (`audio-interruption-check` and `music-transition-audit` run separately).
- `npm run check:release`: mechanics, browser and audio, then the full playthrough. Allow at least an hour.

## Before a release

1. `npm run typecheck` and `npm run build`.
2. Run `node tools/production-build-check.mjs` to verify production ignores game query overrides and excludes QA
   modules. For the instrumented browser checks, run `npm run build:qa`, start `npm run preview:qa`, and run
   `BASE=<preview> npm run check:release`. QA assets live in `dist-qa/`; `dist/` remains the production build.
   Twenty-one of its checks fail on a preview without saying anything about the game: the audio group, `shader-browser`,
   `stairs-fog` and `progress` import modules from `src/`, which a built bundle does not serve, and `frame-time-browser` finds the
   frame loop by a name minification removes. Run those against a dev server in a worktree nobody is editing:
   `BASE=<dev server> npm run check:audio`, then `node tools/<name>-check.mjs` with the same `BASE` for the four.
3. Jeremy owns the parts no local tool covers: a listening pass through the whole journey (see
   `docs/contracts/audio.md`, Open) and physical-device checks on his iPad (touch robustness, Safari fullscreen,
   performance, warmth and battery).
4. Deploy with `tools/deploy.sh` from a clean `main` (every deploy goes to production).

A failing check is fixed in the game unless it asserts behaviour Jeremy deliberately changed; then the check is
updated to the new intent, with the reason in the commit. Never widen a limit without writing down why the old one was
wrong.

Choose the focused checks relevant to a change; the playthrough is a release check, not something to run after every
edit.

## The whole journey

- `node tools/playthrough.mjs <prefix>`: Begin through every chapter to the closing line, reload the completed save, then
  Play again, with real pointer gestures and natural transitions in a fresh browser profile. Fails on exceptions,
  wrong chapter order, a stalled chapter or a missing ending. In the drowned village it plays the room as a player
  does (the tub to the cat and back, the run's tree, mill and swing) and fails if a puzzle safety valve carries it
  on instead. The bell-summoned boat returns to the nave by itself. `REVIEW=1` records video and one-second frames (review
  them in order, not just chapter entries); `TRACE=1` records the camera for `tools/camera-intent-report.mjs`;
  `UNTIL=<chapter>` stops on entering it; `SAVE_FILE=<json>` continues from a captured checkpoint.
- `node tools/camera-review-strip.mjs <prefix> <first-frame> [count] [stride]`: chronological contact sheets from
  review captures.
- `node tools/play.mjs <out-prefix> '<json steps>'`: drive real gestures and capture frames for visual QA
  (`VIDEO=1`, `TOUCH=1`, `W`/`H`, `QUERY`).
- `node tools/cygnet-gates.mjs`: every shared moment and way of moving for the cygnet and child on the QA stage,
  against numeric limits.

## Focused checks

**Engine, rendering and input**

- `rendering-continuity-check`: outgoing water and sheltered firefly transitions at 10–120 Hz, and visual storm
  cover independent of lightning triggers. `BASE=<QA preview> CASE=toSleeping AFTER=720 OUT=/tmp/<dir>
  node tools/rendering-continuity-audit.mjs` captures handoff frames and twelve seconds afterward; use
  `MODE=departure CASE=sleeping|wood|meadow` for boarding. Inspect the images as well as the per-frame state.
- `shader-check` (literal GLSL edge order) and `shader-browser-check` (float ramps on Chrome/Metal and software
  Vulkan, texture bytes in the browser; another compiler, not another GPU family or Safari).
- `sky-mirror-star-check`: renders the fallen star shader at constant brightness while the low camera crosses
  pixel boundaries, nearby and distant, at normal and Ultra render scales. Needs a dev server; `SOFTWARE=1`
  uses SwiftShader without the GPU lock. The intentional slow pulse is covered by `sky-mirror-logic-check`.
- `stairs-fog-check`: renders the shared fog-bank shader along near sightlines, including downward rays to the
  foreground. Checks continuous coverage inside the bank at cloud and sea height, with the boat's clearing,
  and clear surfaces outside it. Also checks colour and coverage after translating and rotating the bank;
  an uncarried reference exposes the descent discontinuity. Needs a dev server for the shader import.
- `stairs-fog-motion-check`: compares moving checkpoint views, including an ultrawide viewport, against the
  original per-ray fog in the same world state. Checks cloud edges per pixel; a whole-image average alone missed
  the rejected cloud-cache artifacts. Needs Vite; `OUT` sets the evidence prefix.
- `fog-lookup-check`: real GPU cache invalidation at fixed time, camera motion/rotation/resize, reflection mode,
  camera rebinding and texture release. Needs a dev server; `NEGATIVE=1` omits invalidation to prove the clearing
  assertion catches stale fog. Also verifies that stairs-only fog allocates no cache. The analytic lantern probe
  uses `FOG_LOOKUP=0`; village scene comparisons exercise the cache.
- `render-parity-check`: seeded frozen scene comparisons against an unchanged build. Run with
  `COMPARE_BASE=<unchanged build> BASE=<changed build> node tools/render-parity-check.mjs /tmp/<dir>`; both frozen
  builds must expose `?shot`. `CASES=lines,wood,stairs` selects cases; `TIMEOUT_MS` allows an unchanged slow baseline
  to finish. Include a same-build control when investigating differences.
  Fog-cache changes include `CASES=belfry,roofs,stairs-close,stairs-turned`; the turned view freezes the world,
  moves the camera, then refreshes terrain, grass and reflections as play does.
- `home-water-check`: sails the last approach into home, checking reflection continuity through disembark in
  landscape and portrait, freshness after the target resize, and High/Medium/Low quality behavior. Works on a QA
  preview; a direct `chapter=jetty` start cannot exercise the crossing's reflection handoff.
- `noise-loop-check`: compares the rolled scene/height noise to the original shader arithmetic on the GPU over
  294,912 samples, including negative coordinates and all six octave counts. Needs a dev server for source imports.
  Run on the default backend and a second backend (`ANGLE=vulkan` on Windows); this is not a physical mobile test.
- `terrain-samples-check`: compares the terrain vertex shader's shared height samples with three separate calls,
  reading normal components and heights as floats across every height patch, window boundaries, atlas/direct paths,
  filtered/manual height lookups and main/mirror geometry. Needs a dev server; run on the default backend and Vulkan.
  `PERTURB=1` deliberately moves the reference's x sample and must fail, to check the probe's sensitivity.
- `render-cost-check <chapter>`, `grass-quality-check`, `grass-unclipped-check`, `swan-shading-check`,
  `water-texture-check`, `terrain-check`, `terrain-fields-check`, `terrain-colour-check`, `terrain-heights-check`
  (after any island's shape or position change), `fields-border-check`, `height-bake-check`.
- `frame-time-check`, `frame-time-browser-check`, `frame-pacer-check`, `power-browser-check`, `wind-clock-check`,
  `wind-rate-check`, `wind-gesture-logic-check`, `quality-check`, `quality-browser-check`, `quality-setting-check`,
  `quality-menu-check`, `veil-controls-check`.
- `pointer-contact-check`, `pointer-pick-check`, `touch-viewport-check` (Chrome, not a Safari substitute).
- `start-check` (Begin, audio unlock, Continue, retry; the invitation low in the room painting, and centred when the
  painting is blocked, on desktop and phone; worst boot gap under `BOOT_MAX_MS`; no program first used
  outside boot's settle step, `__stats.bootStrayPrograms`; the construction steps a real boot counts equal
  `BUILD_STEPS`; fixed noise and terrain-sample loop bounds actually uploaded to every active program; no program first drawn in the first seconds of play after Begin, Continue or a chapter pick,
`__stats.playFirstDraws`), `startup-check`,
  `loading-check`, `boot-cloth-check`, `failure-paths-check` (including a blocked room painting: plain veil, working
  Continue), `context-loss-check` (`CHAPTER=belfry` exercises allocated fog atlases before context loss).
- After a change to world construction, boot or the programs (a new material or variant): on a QA preview, with
  nothing else busy on the GPU and back to back with the unchanged build, `RUNS=5 node tools/boot-profile.mjs` (worst
  veil gap under 150 ms, Begin at 2.8 s or less) and `RUNS=3 THROTTLE=4` (Chrome with the CPU slowed 4×, a stand-in
  for an older tablet: worst gap under 500 ms). See `docs/engine.md`, Boot.
- Windows startup regression: `RUNS=3 QUERY=coldshaders MAX_READY_MS=60000 BASE=<QA preview> node tools/boot-profile.mjs /tmp/updraft-windows-cold`
  on the Ryzen 5 9600X / RTX 4070 Super reference machine, with no other GPU work. Keep `ANGLE` unset: switching a
  player to Vulkan is not the fix. The report records browser/backend, all boot stages, program count, overlapping
  per-program waits and main-thread stalls. It rejects a failed veil posing as readiness. The 60 s startup budget
  is a Windows reference-machine regression guard, not a replacement for the Mac veil-gap gates above or a guarantee
  for every device. Use `TIMEOUT_MS=300000` for the unchanged baseline.
- `veil-stills.mjs [prefix]`: stills of the veil's loading line held at known text, desktop, iPad and phone, day and
  night, for comparing its look against the boot-veil comps.
- `fixed-matrices-check` (every chapter: no object fixed in place moves or keeps a stale world matrix).
- `nearby-check`, `bandage-cost-check`, `scarf-normals-check`, `drowned-gating-check`, `boat-mooring-check` (every
  frame the moored hull skips its contact tests, testing them would not have moved it).
- `stairs-haze-check`: landing mist volumes stay below the incoming flights' exposed treads and risers.
- Against another build, for changes meant to be exact: `scarf-exact-check` (`BASELINE=<checkout>`: the scarf's mesh
  and cloth byte-identical in lockstep, no browser), `audio-silence-check` (`OLD=<previous build's server>`: offline
  renders below −100 dBFS apart) and `wind-exact-check` (`COMPARE_BASE=<its server>`: the wind field and what the life
  pass reads of it bit for bit after 600 scripted ticks, `TICKS` for more).

**Camera**

- `camera-direction-check`: orbital clearance, eased turns, focus, dolly and height at 10–120 Hz, carry, attention,
  stable composition choices, interaction holds, exact paths, portrait resize and hidden camera relocation.
- `crossing-camera-check`, `drowned-camera-check`, `storm-camera-trace`, `chapter-view-check`, `ending-view-check`
  (fails any staged view whose turn rate changes by 2.5°/s or more within a quarter second), `piano-frame-check`,
  `pond-view-check` (the meadow family seen stirring, running and lifting, then let out of the frame without the
  camera backing away from the child; both companions clear of the bank at the water).
- Browser: `camera-chapters-browser-check` (every chapter entrance, landscape and portrait),
  `crossing-camera-browser-check` (`CASE=crossing|sea`), `drowned-camera-browser-check` (`PORTRAIT=1`, `REVIEW=1`),
  `chapter-view-browser-check`, `journey-view-check`.

**Chapters and mechanics** (Node, real chapter code, no renderer)

- `plane-routing-check`, `plane-catch-check`, `meadow-route-check`, `meadow-plane-check`, `meadow-duet-check`, `piano-logic-check`, `piano-growth-check`,
  `little-boats-logic-check`, `kite-logic-check`, `scarf-geometry-check`, `sail-flutter-check`, `sea-logic-check`,
  `sky-mirror-logic-check`, `sky-mirror-pointer-check` (`TOUCH=1`), `sleeping-logic-check`, `wood-logic-check`,
  `wing-care-check`, `flock-flight-check`, `dolphin-leap-check`, `boat-check`, `boat-ground-check`, `journey-pacing-check`,
  `geography-check`, `journey-reveal-check`, `crossing-haze-check`, `dream-story-check`, `foghorn-story-check`.
- `plane-catch-check` covers return flights at 30/60/120 Hz, eight bearings and three heights under sustained gusts,
  exact mitten attachment and one completion. It also checks paper edges against the posed child mesh through eight
  approaches; `QUICK=1` selects one case. `QUICK=1 NEGATIVE=1` loads the old arrival from `db31c945` and reproduces its
  head intersection. Rendered approach, catch and boarding still need review.
- `meadow-duet-check` covers the wind call before piano input, retained partial replies, four player answers,
  the delayed bough finale/colour cue and restoration at 30/60/120 Hz. The real-input `piano-check` also swipes
  during a call to confirm that it cannot count as a reply; its framing checks include the bough's crown.
- `dolphin-leap-check` covers both camera sides, portrait/landscape, 30/60 Hz and four seeds: actual takeoff,
  overtaking flight and hull clearance. `MUTATE=old` loads the faulty launch from `893c316f` in memory to prove the guard.
- The scarf's feel: `scarf-feel-probe` (Node: bounce, settling, creep, stretch and jitter) and `scarf-video` (true
  60 fps clips of each release and the gathering, `SUFFIX=before|after`).
- `drowned-contact-check`: posed cat body and child boot vertices against village roofs and coping, plus the real
  cat rescue's boarding, cuddle and bow sequence. `ONLY=cat|child|rescue` selects one part. Browser companions:
  `drowned-contact-stills.mjs <dir>` for close moving contact frames and `drowned-wood-veil-check.mjs <prefix>`
  for a frozen entrance comparison with the distant rock's mesh absent (requires Python Pillow).
- `drowned-return-check`: zero player wind after the bell, arrival at the berth and boarding at 30/60/120 Hz,
  with spaced and rapid rings. `NEGATIVE=1` disables the automatic return and must fail.
  `FROM=belfry LENS=1 node tools/drowned-run-check.mjs` checks this through the real bell gestures, passive
  approach, boarding camera and onward storm; `W=900 H=1600` checks portrait. Use `SWAY=1` for short, slow
  real mouse strokes and `RAPID=1` for repeated fast strokes: both must ring on alternating sides. The farewell
  must be sampled through the end of its hold at 8.5 seconds, since the blink still misses the camera's lowest point.
- `drowned-fog-motion-check`: the whole bank advances without pivoting or retreating, camera motion cannot
  change its field or belfry clearing, the bell clearing survives descent and the farewell before blending out,
  and the actual boat reaching the woods fades it out. `drowned-mist-check` probes the actual shader for
  camera-independent density and continuous lowering through the clearing height. The live church replay also
  checks that the paper stays visible and attached to the backpack on both ivy climbs.
- `AUDIT=/tmp/drowned TO=tree-arrival node tools/drowned-run-check.mjs` records the natural rescue's real audio
  and live fog uniforms through the first roof and tree. `node tools/drowned-audit-check.mjs /tmp/drowned.json`
  checks the four-second sailing interval, matching tone/effect onset, music fade and fog motion.
- `rotary-washing-check`: idle, off-target and muted input, local unhooking, persistent turns, both directions and independent
  alignment stops at 30/60/120 Hz. `rotary-rig-check` checks both closed and restored cloth before its first update,
  catching a snag anchored at the world origin during the inbound crossing. `lines-cloth-check` measures settled
  mesh strain after real curtain releases at four gust bearings and 30/60/120 Hz, including checkpoint restoration;
  `NEGATIVE=1` restores the oversized rope collider to prove it fails.
  `rotary-washing-browser-check` drives real sweeps through the encounter, doorway, pulley and boat departure.
  `FULL=1` plays all three curtains, `CROSSING=1` includes the inbound sailing approach, and
  `TOUCH=1 W=390 H=844 REVERSE=1` exercises portrait touch. A rendered family mask checks concealment through
  camera transitions and visibility at the reveal. `REVIEW=1` captures chronological stills and per-frame camera
  traces in `OUT`; these are frame/trace evidence, not a reviewed video.
- `lines-arrival-check` sails the final approach and steps ashore in ultrawide and portrait views, comparing
  the actual rendered beach against its unclipped geometry through the chapter handoff. `FULL=1` includes the
  entire incoming crossing; `NEGATIVE=1` reinstates the obsolete circular cutoff and must fail.
- In the browser with real gestures: `lines-check`, `lines-view-check`, `little-boats-check`, `piano-check`,
  `scarf-check`, `stairs-check`, `storm-check`, `wood-check`, `ember-check`, `sea-check`, `sky-mirror-check`,
  `sleeping-check`, `summit-arrival-check`, `home-approach-browser-check`, `ending-check`, `landing-check`,
  `kite-check`, `geography-browser-check`, `boats-offshore-browser-check`.
- `petals-browser-check` replays the flock, fall and bandaging, checking that camera-driven rehoming preserves the
  still island's petal population. Density follows the flower patches, since the camera's look-ahead crosses region
  boundaries while the child stays in place; the original bug activated 4,178 reserve petals in one frame.
- `little-boats-exit-check` uses real sail/plug gestures from the final pool checkpoint through boarding and the
  crossing. It captures both sides of the chapter handoff and checks no completion phrase, continuous sea/swell
  strength and unchanged water shader; `OUT` selects its capture directory. `little-boats-logic-check` also checks
  this exit at 30/60/120 Hz from arrival and both pool checkpoints.

**Saves and lifecycle**: `progress-check`, `progress-schema-check`, `chapter-select-check` (who is offered chapters;
the twelve 400x250 tiles; the list over the title's painting, opening fetching every painting once; a looked-at room's
painting crossfading in without the stack dropping below full cover; `back`, Escape and a press on empty space closing
without starting, `back` returning focus to `chapters`, a double click on `chapters` leaving the list open; the
phone list fitting without scrolling; a pick starts its room in place, with sound and the room's entry save, without
navigating, and the panel fades over its .45 s), `start-over-check` (no start over
without a save; the first press asks without starting; the question goes back after 6 s, on Escape and on blur; a
second press starts the first island in place with sound, its save replacing the old one; a press elsewhere on the
veil continues the save; the phone layout with `chapters`), `chapter-pick-check`
(every room picked on a page that loaded another room's save matches a fresh `?chapter=` load 3 s in; a room that
differs, as a late readback can make it, is played once more; `ONLY=wood,jetty` for some rooms), `analytics-check`, `analytics-browser-check`; see `docs/contracts/progress.md` and `analytics.md`.

**Audio** (offline, through a headless dev server, no GPU)

- Shared: `audio-check` (gesture thresholds and gates, cue timing, habitat, materials, clipping stress),
  `audio-continuity-check`, `audio-direction-check`, `gesture-harmony-check`, `arrival-audio-check`,
  `music-mute-check` (independent music/effects routing, reverb tails and mute-all interaction),
  `music-transition-audit` (every handoff and all score sections), `audio-interruption-check`, `piano-audio-check`,
  `flock-audio-check`, `marine-audio-check`, `whale-voice-check` (production calls, clipping and speaker-band body;
  `MUTATE=thin` must fail), `birches-foley-check`.
- Scores: `opening-score-check`, `lines-score-check`, `boats-score-check`, `meadow-score-check`,
  `birches-score-check`, `mirror-score-check`, `clouds-music-check`, `village-music-check`, `dream-score-check`, `sleeping-score-check` (the former synthesised score, kept for studies, and the chapter's phases), `sea-score-check` (the study score and the passage's story phases), `homeward-audio-check`.
  The Lines, Boats, Birches and Home gates decode the supplied recordings and check looping, story continuity, mute/hidden-page
  suspension, late-decode cancellation and buffer release; Home also checks the ending fade and checkpoint offset.
- `sea-music-check` decodes `sea.ogg` and checks its cut points, the silent hold at the break, phrase A at rest
  (sample-continuous when the boat rests early), B to E on the rescue's steps without restarts, the close on release,
  restores, the Sleeping handoff before the recording begins, the pad, call room, mute and silence.
  `clouds-music-check` renders the stairs' `clouds.ogg`: decoded in the white, started `cloudsMusicDelay` after the view
  clears on top at half level rising to full, never restarted, faded by 3:28, the village's music held until then (fog or village
  first), a recording already over, a late join after music mute and silence.
  `village-music-check` renders Birches looping on its island, playing its pass out after sailing and stopping over a
  second in the white; `village_approach.ogg` checked at its seam on the decoded samples, started from its top at full
  level as the village's rest ends (or with `?chapter=drowned`), faded at the seam, never restarted, a late join, the
  rescue's quiet, silent later starts; no music or pad through the village; `belfry.ogg` checked at its start seam and
  its handover to `belfry_ending.ogg` (just before an attack, sample-aligned, no dip, faded to silence at its end),
  started on the fourth ring with its slow entrance, played through the storm's start into the ending's ritardando and
  fade, never restarted, started on load by a storm save; and the wood's drone at `woodDroneDb`. `drowned-audio-regression-check` renders the rescue's quiet, the silent becalming and the silent storm.
  `sleeping-music-check` decodes `sleeping.ogg`, `cygnet_brave.ogg` and `sleeping_morning.ogg` and checks the
  lullaby's end, every seam, the climb's part boundaries and the morning's entry on the samples; the frost's bounded
  wait and the lullaby's early end at a seam; the parts at their gates, never overlapping, the summit begun on its own
  a second late and rising in, the climb theme cut at its seam by the fog, queued, passed over and joined unbroken;
  the part sounding as the bandage comes free let go at a seam or a short fade, and silence from there to the
  curtains; the morning from its second phrase as the curtains open; restores; the wood's handoff at full level, the pad, the climb's chime tones, mute and silence. It prints
  each player's timeline (main's measured climb, the rebuilt climb, a slow player, `?chapter=sleeping`).
  `sleeping-music-browser-check [climb sleeping ribbon feather morning]` measures the same in the real game with a real
  AudioContext (`climb` first, about 5 minutes: it saves the checkpoints the restores continue; `ribbon` drives the
  summit's circles from `?chapter=ribbon`, logs the summit part against the top, the bandage freed, the turn and the leap, the morning's
  seams against the waking, and its departure fade against the sea's entry).
  `sea-music-browser-check` runs `?chapter=sea` with no input in the real game: second 55 must fall within 0.6 s of
  the boat coming to rest, with A starting within 0.5 s; `?chapter=whale` must play A on load.
- `still-phrases-check` verifies flight/colour triggers, 4.5-second spacing with overlapping tails, no backlog, mute, late decode, cleanup and drone restoration, plus reversible removal of the falling and touchdown tones.
  Sustained-flight checks cover six-second repeats from the last accepted phrase, colour timing, landing, mute and scripted suppression.
  `still-phrases-browser-check` uses real Begin and pointer strokes to verify colour, takeoff, deduplication and hidden-page suspension.
  `still-departure-browser-check` runs the tree/fall/bandaging sequence, checks the plane stays secured under real pointer wind and music begins on the walk to the boat
  at source second 8, continues through the crossing, and the title fades in/out before the whale and clears on arrival.
  Current trial: title 34–41 s, whale 45 s; `crossing-camera-check` verifies its six-second attention ramp.
  `still-phrases-check` renders the recording's 1:54–1:58 fade and silence afterward, including ongoing gain updates.
  `lines-reveal-browser-check` sails through the farewell, title, whale and approach while sampling the production
  horizon veil on the GPU: sampled dry land and twelve horizon bearings stay concealed from afar; the near shore clears on approach.
  `first-crossing-browser-check` captures the whale and post-whale gull/linen passages, checks the whale remains clear
  through its dive and the physical swell persists. It also checks that at least four gulls and three loose sheets
  share the shot, all five linen pieces appear, and the cloth turns substantially while visible. It also checks
  distinct projected heights and one loose sheet overtaking another. Set `VIDEO=1` for a recorded crossing. `still-crossing-timing-check` measures native audio from the real
  post-bandaging walk through boarding and the Lines handoff; both default to a QA preview on port 5247 and accept `BASE`.
  `plane-routing-check` compares authored Still departure timing under opposing gusts at 30/60/120 Hz;
  `crossing-linen-check` covers cloth stability and bill attachment; `first-whale-swell-check` verifies the water-entry
  trigger, gradual visibility and independent ownership of the later whale's wave.
  `still-atmosphere-browser-check` captures the horizontal title sweep and gradual whale appearance/disappearance
  in a continuous crossing; checks sparse windlines and the projected direction using the actual camera.
  `CROSSING=toLines node tools/journey-pacing-check.mjs` measures the extended passage; `geography-check` covers
  Still's moved props and revision 9→10 saves without reapplying earlier late-island migrations.
  `opening-score-check` and `opening-score-browser-check` explicitly disable the experiment to retain the original drone regression checks.
- In the browser: `audio-browser-check`, `piano-audio-browser-check`, `arrival-audio-browser-check`,
  `transition-scenes-browser-check`, `opening-score-browser-check`, `homeward-audio-browser-check`,
  `meadow-score-browser-check`, `birches-score-browser-check`, `sea-music-browser-check`, `village-music-browser-check`
  (`drowned` and `cloud` with no input: the village's recording against the tub becoming pushable and its invitation;
  `belfry` rings the bell four times and times the goodbye against boarding and the storm, checking the ending starts
  on the audio clock where the recording hands over; `storm` starts it on load),
  `recorded-music-browser-check` (real Begin unlock, no music download with sound off, reuse of the starting download,
  only the starting/next recording fetched, and an audible decoded source in each chapter).
  `music-loading-browser-check` holds downloads and decodes to verify concurrent shader loading, no premature
  gameplay/reveal, failure fallback, preference cancellation and readiness for the first gesture.
- Renders for listening: `opening-fall-render`, `ending-audition`, `stairs-audio-proposal`, `foghorn-preview`.

**Performance** (only when Jeremy asks; see `docs/engine.md`, Measuring): `perf.mjs`, `frame-profile.mjs`,
`boot-profile.mjs` (cold-load veil gaps and long tasks: `RUNS=<n>` fresh-profile loads, `THROTTLE=<rate>` CPU slowdown, `WARM=1` a second load in the same profile, `QUERY` such as `coldshaders`), `storm-profile.mjs`, `window-hitch.mjs`, `power-profile.mjs`, `quality-budget-profile.mjs`,
`audio-cost.mjs`, `wind-cost.mjs` (the wind step's GPU cost pass by pass), `memory-census.mjs`.

- `frame-profile.mjs <fixtures>`: paired ablations at a fixture, each reporting its bite (programs patched, objects
  hidden, draws, pixels changed) and throwing if it changes nothing. `ROUNDS=0` compares frames without timing.
  Among its ablations: `deck-out` and `deck-out-water|terrain|grass|sky|rest` (the cloud deck compiled
  out), the stairs' parts (`stairs`, `stairsCloud`, `stairsCloudTop`, `stairsCloudBelly`, `stairsTowers`,
  `stairsWake`, `stairsWisps`, `stairsBank`, `stairsHaze`, `stairsSteps`), `cloudtop-frag-flat`, `cloudtop-veil`,
  `water-lantern`, `water-hull`, `water-frag-flat`, `sky-flat`, and the candidate exact skips `sky-deckfirst`,
  `wisps-early`, `water-lantern-reach`. `SIM_PASSES=1` times each simulation pass alone; `LEVEL=<name>` applies a
  level's world settings. The header lists the rest.
- Against another build: `FRAME=600 COMPARE_BASE=<its dev server>` stops both on the same frame and reports the
  difference between them (`COMPARE_MAX=1` fails above 1/255, `CAPTURE=1` saves both frames); a build against itself
  reads 0.
  Whole-frame timing refreshes the chapter-fog cache on each draw, even at frozen game time, so its bake cost counts.
- Stairs fixtures (`tools/lib/stairs-fixture.mjs`), for `frame-profile`, `memory-census` and `audio-cost`:
  `stairs:waiting|climb|loop|cloud|top|sail|fog` play the chapter to that moment, with real gestures, or on frames
  under `FRAME` so every run is the same.
- `memory-census.mjs <fixtures>`: every texture, render target and buffer the game holds, by owner, with what the
  watched frames used (`RATIO`, `MSAA`, `DETAIL`).
- `frame-profile` and `memory-census` patch `src/main.ts`, so they need a dev server (a worktree's own); `audio-cost`
  and `stairs-check` also run against `npm run preview:qa`.

Rendered checks, screenshots and numeric audio checks are evidence for review, not pixel baselines or a listening
sign-off.
