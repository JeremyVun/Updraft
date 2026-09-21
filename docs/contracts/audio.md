# Audio

`src/audio/audio.ts` owns wind, environment, score, gesture chimes and authored calls. `little-boats-score.ts`
plays the approved Little Boats composition on its own chapter clock. `sea-score.ts`, `sleeping-score.ts`, `meadow-score.ts`, `birches-score.ts` and `lines-score.ts`
adapt their approved compositions to story phases. `dream-score.ts` plays the approved Sky Mirror and Drowned Village arrangements from `dream-score-data.ts`. `foley.ts` synthesizes
physical sounds; `world-foley.ts` maps object motion to them. `environment.ts` derives local habitat and coast
weights. Feel and distance settings live in `tuning.audio`.

## Player feedback

Cursor chimes accompany the starting island, forest and the feather-guided climb on Sleeping.
`SoundState.startingIsland` follows `story.name === 'island'`; `forestWind` follows `story.name === 'wood'`.
These chapter gates are independent of departing music and Sleeping's wood mood.
Gusts, held updrafts and glider-lift answers stop scheduling chimes outside these scenes; existing gesture tails fade
out over 300 ms. Opening and forest chimes are both +6 dB above the previous 0.7 gain trim, preserving the rescue voice’s
relative softness. Everywhere after the opening, including the forest, player gust,
whistle, ground rustle and updraft noise are −3 dB (`tuning.audio.laterWindDb`). Ambient breeze, sea, rain and
the winter weather floor keep their existing levels. Cursor filter sweeps are 20% smaller
(`playerWindFilterRange`): maximum gust cutoff 1140 Hz, whistle 1620 Hz and updraft 1420 Hz, down from
1360/1800/1720 Hz. Weather filter response and wind mechanics are unchanged.

Audio and `PointerInput` share `pointer.minGust` and `pointer.minLift`; first input after audio starts can
schedule a note. Gust and lift share one answer on the 96-BPM grid, at most every two pulses; glider answers
reserve their two pulses. Opening notes follow the background chord at their scheduled onset, with harmonic
partials and a 25 ms attack. Lift stays in MIDI 62–81; strokes/glider answers stop at 86. Incompatible held
notes fade over 300 ms at harmonic changes. `hush` attenuates the background score only.

The piano retains its own musical response. Authored cues, including the wood's rescue `comfort` and ordinary
`kindled`, retain their existing sound and level. `breeze`, `delight` and `restored` follow the active chord;
story melodies retain their authored pitches. Accompaniment ducks to 0.32 with a 0.45-second response and
returns over 1.3 seconds. The finale and chosen home recognition melody are unchanged. `scripted`,
`pianoActive` and the permanent ending `silence` still suppress gesture chimes.

Sleeping's `sleepingWind` is true only in the actual Sleeping chapter's `climb` score phase (climb, snow,
mist and catching the feather). Notes follow that score, use the soft attack and 0.7 relative level (about 3 dB below opening/forest chimes), and
answer at most every four pulses (1.25 seconds). The stowed glider cannot trigger extra notes. The summit,
waking and departure remain free of cursor chimes; the 300 ms tail release applies when the climb ends.
Checkpoint restoration derives the same gate. `tuning.audio.sleepingChime*` owns level and spacing.

These scene-specific rules supersede earlier all-room gesture descriptions in the score implementation history below.

## Musical continuity

`phrasing.ts` shares scheduling, lookahead, stalled-frame skipping and introductory-rest handling across all eight scores. Sustained harmony now bridges accidental loop-end holes; Sleeping shelter/climb retain their sparse rests. Repeating bodies alternate the main melody, a quieter sparse verse and the original melody. Historical `*_AUDITION_NOTES` exports preserve the reference studies; runtime sections contain the approved polish.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the full plucked shape in Boats, the existing Meadow melody, B–F♯–E–D in Birches, and a stretched recollection at sea. Sleeping's climb remembers only D–E–F natural. Instrument voices, local harmony, story timing and home recognition remain distinct.

## Story timing

Jeremy rejected the earlier held-chord proposal. On September 21 he first requested a four-second arrival rest, then approved the audio-director priorities after the Meadow–Birches render exposed a perceived seven-second hole. Ordinary arrivals now use a short breath; Sleeping and ending retain their dramatic rests. The shared pad's pitch glides/global chord clock remain intact.

`Chapter.arrivalMusic` anticipates the destination using remaining sailing distance and current boat speed.
The handoff can wait up to 2.5 seconds for a nearby melodic ending. The outgoing background fades for 1.5 seconds, rests for 0.4, then the destination fades in over 1.5 seconds
before landing. Its phrase continues across grounding/disembarkation. `arrival-music.ts` owns the audio-clock
state; mute/hidden-page suspension freezes it. A separate background gate includes both dry sound and reverb,
leaving water, wind, physical sounds, calls, cues and playable gestures outside the arrival pause. The old
background echo is cleared before the incoming fade. Score scheduling stops at the handoff boundary and voices retire during the outgoing fade, so old sources cannot reappear when the gate reopens. A stalled frame still gets the full short rest.

Every gain release/fade explicitly anchors its current value at the start time before the linear ramp.
`cancelAndHoldAtTime` alone can leave the last constant event in the past: this caused the arrival fade-in to
jump to about 75%, and Sleeping releases to drop about 83% immediately. Both now use the intended full fades.
The still-island and mirror pads continue into their crossings; Wood also retains its .55 hush on departure.
Strong wind adds at most about 2 dB to the fully alive daytime pad (previously about 8 dB), independently of
its gesture notes. Ambient pink-noise loops blend their seam over 40 ms and retain randomized starting offsets.
Finished chime, wildlife, call and ember nodes disconnect after their release.

Drowned starts its handoff on departure from Birches, then requests Wood only after the lost-plane scene.
The long sea passage retains its swim/reunion music until the pod's farewell. Meadow arrival uses its grey
pre-piano bed; the approved post-piano composition still waits for the duet. `tuning.audio.arrival*` owns the
distance allowances and fade/rest durations.

`LinesChapter.linesScore` follows the three curtains, the family approach, open doorway and far shore.
The first section begins on the approach crossing and continues ashore; the shore section continues through
boarding and the crossing to Little Boats, retaining the same score instance and phrase clock.
`linesMelodyQuiet` withdraws the reed while the bird leads and the child follows; existing delight/completion cues also clear it for four seconds. Gesture feedback stays
active whenever input is playable. Masked melody attacks expire, with no delayed burst after a cue.
The original audition's +17.6 dB backing gain excludes preview normalization; `linesMelodyDb` trims only
the reed (currently −1.5 dB). Sections repeat for player pacing and checkpoint restores emit no reward.
All gesture harmony follows the score while the original shared chord clock/glides continue independently.
Phase/exit releases last 1.8 seconds, permanent silence 0.12; finished voices and buses disconnect.

Little Boats uses the `boats` mood and its approved 36-second plucked phrase; the shared pad fades out.
Gesture notes follow its current chord. Entry starts at the beginning of the phrase, suspension
preserves audio time, missed frames skip stale attacks, and its arrival handoff retires all score voices.
The delight and restoration cues temporarily duck this background. The approach crossing retains the Lines shore section
until its arrival handoff starts Boats. Boats then continues on the crossing to Meadow, at its island level,
until the Meadow arrival handoff.

`sea-score.ts` plays the approved revised sea background only when `SoundState.seaScore` is present with
`music='sea'`. `CrossingChapter` supplies it only for dolphin passages: `open` before the swim, `swim` from
restlessness through drying, `return` once settled in the arms, and `arrival` past the pod's farewell route
fraction. An unfinished swim takes priority over the approach. These states, not elapsed chapter time,
select the music. Main copies the optional state every frame, clearing it after departure.

The sections retain the auditioned notes/timbres and repeat to fit player pacing. Swim and arrival have
only sustained accompaniment. Phase changes crossfade over 1.8 seconds, with no pitch glides; updraft chord
tones follow the current harmony. The shared pad withdraws while this arrangement plays. Ordinary crossings
retain the departing island's music until the destination handoff. A restored swim starts in return/arrival
without replaying the opening.
Audio suspension preserves the phrase clock; missed frames skip stale attacks. Chapter exit and
permanent music silence stop scheduling, fade and disconnect the score's voices and buses.

`takeCues()` drains the simulation's cue queue once per rendered frame. One-way story events must use explicit
guards, not narrow time windows. The home finale is once-only and cannot replay after completed restoration.
Recognition still starts from the visible reveal; releasing the plane early does not overlap another melody.

Drowned's lighthouse passage emits one environmental `foghorn` cue at storm time eight seconds, guarded
by `hornPassed`. A call over 0.25 seconds late is discarded rather than overlapping thunder or the plane loss.
`foghorn.ts` generates the accepted D3 horn and stereo diffuse field; `tuning.audio.foghorn` preserves its
approved balance without the export listening gain. Its source lasts 4.6 seconds and the diffuse field
drains over a further 4.4 seconds. The audio-clock cleanup marker releases every local node afterward.
The cue bypasses musical phrases and accompaniment ducking. Muted/not-started audio consumes the cue
without replaying it later; hidden-page suspension preserves active audio timing. Restoring the earlier
village sailing checkpoint can replay the passage, but does not itself emit a horn. Timing knobs live in
`tuning.storm.foghornAt` and `foghornLateAllowance`.

`PianoStop.finish()` schedules the complete lullaby and records its actual phrase end. The final colour front
starts at `finaleWaveAfter`. `onComplete` fires once after the phrase end plus `completionRest`, and the meadow
uses that callback for `completeObjective()`. `restoreDone()` cancels pending completion.

`MeadowChapter.meadowScore` starts the approved post-piano score only after the duet is `done`: `walk` before
the crest; accompaniment-only `flock` for crest/down and `pond` for the paddle; `return` while gathering and
walking onward. Return starts harmony at four seconds and plucks at 5.5, after the existing completion cue.
Walk repeats at 24 seconds, flock/pond at 18. Return plays its four-second entrance once, then repeats its 20-second body. The arrangement already contains its quiet scene dynamics;
do not apply chapter `hush` a second time. `pianoMix` still controls its post-duet fade-in. Main copies/clears the
optional score state every frame; Soundscape also requires the Meadow mood.

The original pad is suppressed during the arrangement, while its global chord clock and frequency automation
continue unchanged; gesture pitches follow the arrangement. `toBoat`/`push`/`aboard` retain the return section,
which continues on the crossing to Birches until its arrival handoff. The grey approach and piano itself never
start the new score. Restored piano
and pond checkpoints select walk and return respectively without reward replay. Score phase changes and
departure release/disconnect all voices; the shared audio clock preserves musical position while muted/hidden.

`BirchesChapter.birchesScore` continues the approved revision from its approach crossing through `ashore` and `wonder`.
The first loop keeps `walk`; accepting the optional swing selects `swing`. Later scarf work and unravelling
use `scarf`, without a lead melody. Once the sail is finished, `return` continues through gathering the bird
and walking to the boat. `push`/`aboard` retain the return section until Drowned begins its outgoing fade.
Walk/swing loop after 22 seconds, scarf after 40, return after 18; checkpoints derive the phase from saved
tangles and cannot emit rewards. Its +20.3 dB level excludes the audition playback boost.

The shared pad clock/glides continue unchanged beneath Birches. All gesture chord tones follow the
active arrangement independently of that clock; ordinary strokes retain their contour and register.
Gesture rhythm, timbre, levels and ownership rules are unchanged. Score phase changes release voices over
1.8 seconds; permanent silence uses 0.12 seconds. All source nodes/buses disconnect after release, and
mute/hidden-page suspension freezes the phrase.

The piano takes gesture ownership on approach, but keeps the background during walking and looking.
Its score/environment fade starts with sitting and takes `tuning.piano.fadeOut` (2.2 seconds): the first key
overlaps the end, and the demonstration starts after it. `pianoMix` carries this one fade; Meadow's `hush`
contains only its other story quiet, so the piano is not attenuated twice. Departure returns the background
over `fadeIn` (3.2 seconds); restoring completion clears the piano mix immediately.

`SleepingChapter.sleepingScore` supplies shelter until the first frost; cold through the unanswered call and
feather departure; climb through snow/mist; summit from unbinding through the ribbon tug; morning from release
through departure. Main copies the optional state every frame and clears it on exit. Cold and summit schedule
no accompaniment, however long the player takes. Existing voices fade over 1.8 seconds and their reverb clears.
The generic pad is suppressed throughout Sleeping. Its authored dynamics replace `hush` attenuation for this
arrangement; gesture chimes and physical sounds remain available under their usual rules.

Shelter/climb phrases repeat after 32 seconds. Morning has a 48-second first pass, then repeats its 43-second body without the initial rest. Morning leaves five seconds for `lifted`
alone and nineteen before its piano answer. The pillow feather emits the two-note `feather` hint. Landing
does not emit the shared completion phrase: Jeremy approved retaining only the flight reward here. Restoring
`morning` selects the warm arrangement and sea gesture register without emitting a cue; the feather checkpoint
selects climb and the wood register. Gesture pitches follow the selected arrangement in both cases. The dry score and its reverb sends share lifecycle gates; departure stops
and releases all piano/pad sources. `PianoStrings.note` optionally accepts an audio-clock time and returns its
scheduled sources so the score can release them; ordinary piano calls keep their immediate timing and sound.

The ending fades the gesture/cue and background buses at 23.5 seconds inside the cottage and starts credits at 26 seconds. Its existing
shared reverb tail is retained. Environmental sounds continue. Jeremy auditioned both home-melody versions
and explicitly chose the existing `unfold` melody. Preserve it; the piano-lullaby replacement is rejected.

## Space and habitat

Each rendered frame derives `land`, `sea` and `meadow` from the story focus and current chapter. Shoreline
sampling is a cached CPU height query around that point, never distance from the original meadow coast.
`overLand` still describes the pointer for wind rustle; it must not decide the story's habitat.

Night wildlife needs land, warmth and little rain. The final home's requested crickets/owls remain. Skylarks
need meadow habitat, daylight and little rain. Sleeping cold is withdrawn with dawn.

Cygnet and flock emitters use the rendered camera's `screenPan` and source distance. The hidden cygnet remains
audible: concealment must not mute its rescue call. Story and incidental adults use the same swan synthesis.
An authored cygnet or adult call holds incidental flock chatter for `callSpace` seconds. Meadow and home set
`flockChatter=false`: their authored conversations own all the pauses. Adult calls fade with distance and
stop beyond `flockDistance`, so a flock on another part of the island cannot sound close to the player.

## Physical sounds

Birches leaf scuffs follow the child's walking contacts on authored leaf-covered ground and the cygnet's
actual heap kicks. Both share a 1.4-second room-wide limit; skipped events expire. Leaf particles and wind
never trigger individual sounds. Coverage uses the initial litter map, not GPU readbacks; it is an acoustic
mask rather than a measurement of each displaced leaf. Swing creaks require substantial physical travel
and a direction reversal, at least 2.4 seconds apart. Tiny idle sway is silent; the empty swing is quieter.
Both sounds attenuate from 20 to 65 units and pan from their source. Entry/resume establishes silent
walking/swing baselines. `tools/birches-foley-check.mjs` verifies rate limits, gates and production voices.

Flock wingbeats follow the flight/take-off state, with the existing 3.4 rad/s cadence. Resting rafts are quiet.
Distant or muted beats expire on their original clock; approaching or unmuting cannot replay a backlog.
`tools/flock-audio-check.mjs` checks these gates and timing at 10–144 Hz.

Motion sounds use differences in physical state: curtains opening, the family sleeves, scarf working/releasing
and gathering, paper unfolding/folding and doors swinging/shutting. New sources, inactive sources and the
first frame after resume establish a silent baseline. Do not synthesize these from completion cues.

Hull sounds use actual speed and pitch. Sail sound follows fresh rises in flutter, with a 2.4-second
minimum interval and a quieter level; sustained luffing never retriggers it. Entry/resume establishes a silent
baseline and inaudible/cooldown events expire. Tiny toy-boat flutter stays silent. Nearby laundry uses local wind with the
cloth's spring and flutter thresholds, limited to three sources. Dolphin re-entry uses the same crossing of
the water surface as its visible splash; emergence adds a lighter wash at its spray event. Their independent
pod-wide limits keep emergence from swallowing a landing (0.6 seconds between rises, 0.4 between landings). Dolphin sounds use a 0.65 level trim, 65 ms primary attacks and filtered spray instead of high-frequency hiss. Whale wash, both breaths, fluke drainage and dive
fire directly from `WhaleWake`'s visible events. The shared `SeaLife` callback covers the opening-to-Lines whale,
the long crossing and the QA whale. Its broader distance range keeps the breath audible ahead of the boat. Whale events use a 0.65 level trim, 200 ms main attacks and lower filtered breath/water layers; the drain drops also have softened attacks.
Marine callbacks are discarded while sound is muted/hidden and cannot replay on resume; no vocal calls are added.

All new material sounds use distance attenuation, screen panning
and bounded per-source scheduling; dolphin scheduling is also bounded globally. Finished noise/tone nodes
disconnect. No child voice or routine cygnet vocal chatter is added.

Audio state is prepared once per rendered frame after the camera update. Existing hidden-page/mute lifecycle
is unchanged; see `progress.md`. Tests: `tools/audio-check.mjs`, `tools/audio-browser-check.mjs` and the existing
ending/checkpoint checks. `tools/marine-audio-check.mjs` checks actual surfacing events at 10–144 Hz, stereo,
distance, scheduling and voice cleanup, and renders an isolated sample to `/tmp/updraft-marine-audio.wav`.
Rendered previews and numerical checks do not replace listening through the game.

`tools/audio-continuity-check.mjs` renders seven departure/arrival paths from production chapter definitions,
checks retained score instances/clocks, gate ramps, every score's release, sail triggers at 10–144 Hz,
noise-loop seams, background gain response and finished-voice cleanup. It writes evidence to
`/tmp/updraft-audio-continuity.json` and a Meadow-to-Birches sample to
`/tmp/updraft-meadow-birches-continuity.wav`. Numerical checks are not a listening sign-off.

`tools/audio-direction-check.mjs` checks introductory rests versus repeat bodies, loop coverage, phrase-aware handoff, shared motifs, combined-input density, charge register, reward harmony, incompatible-tail release and unchanged home notes. It renders Lines loops, Birches rewards, the sea theme and a phrase-aware departure under `/tmp/updraft-*.wav`.

Sky Mirror investigations use planted walking, with no swimming state, paddle or plunge events. The earlier fast exploration pace triggered running/pattering and balance wingbeats. `mirrorCompanion.explorePace` slows investigation; walking wing balance follows actual speed, including pace multipliers. Following the moving child retains its existing travel pace.


## Sky Mirror, Drowned Village and the forest handoff — September 21

Jeremy approved both revised studies. Runtime preserves their note data, voice envelopes, harmonic partials,
stereo reflections and relative levels. `dream-score.ts` divides them into story-led sections; repeated
sections alternate a sparser melody and retain sustained harmony across joins. Per-phase buses retire both
voices and echoes. Audio-clock cleanup survives suspended playback; departure and the ending cut release all parts.

Mirror follows approach, first play, one/two/three returned lights, the completed constellation and departure.
The working room now has four stars: the third uses another verse of the approved middle arrangement, and
only the fourth receives the final constellation bloom. The chapter emits `star` once on an actual return;
phase entry, loops and checkpoint restoration never emit it. Completed-star count determines the section,
independent of collection order. The departure section continues on the harbour crossing until Home's handoff.

Drowned follows rooftops, becalming, resumed drift, gathering weather, plane loss and the quiet approach to
the wood. The 22-second gathering uses the approved descending harmony and overlapping low swells. Composed
levels already include the withdrawal, so chapter hush is not applied a second time; the authored becalming
cue still ducks the background. Wind feedback follows each score's current chord.

**Drowned → Wood is a four-second overlap**, replacing the ordinary arrival pause for this boundary only.
The common background gate stays open and its reverb is retained. The retiring village score fades while
the forest pad enters on D/A; the previously inaudible pad is tuned before it becomes audible. After the
blend, the existing forest chord clock resumes with its slow pitch glide into the unsettled voicing.
Other arrivals retain the 1.5-second fade, 0.4-second breath and 1.5-second fade-in. No new forest melody,
weather sound or protagonist voice is added.
