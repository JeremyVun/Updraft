# Audio

`src/audio/audio.ts` owns wind, environment, score, gesture chimes and authored calls. `little-boats-score.ts`
plays the approved Little Boats composition on its own chapter clock. `sea-score.ts`, `sleeping-score.ts`, `meadow-score.ts`, `birches-score.ts` and `lines-score.ts`
adapt their approved compositions to story phases. `foley.ts` synthesizes
physical sounds; `world-foley.ts` maps object motion to them. `environment.ts` derives local habitat and coast
weights. Feel and distance settings live in `tuning.audio`.

## Player feedback

Every playable gust or updraft gets gesture chimes. Audio and `PointerInput` share `pointer.minGust` and
`pointer.minLift`; first input after audio starts can schedule a note. Notes retain the established pulse
and rate limits. `hush` attenuates the background score only. Never silence playable wind merely because a chapter is sad,
quiet, cold or stormy.

- `pianoActive` suppresses gust, updraft and glider chimes while the piano supplies the musical response.
  This is separate from the easing `pianoMix`; wind regains its chimes immediately after the duet ends.
- Wood's `lost` beat sets `caringWind`: quieter, lower notes with fewer bright partials and a softer attack.
  Catching the rescue hearth emits `comfort`; other embers emit `kindled`.
- `scripted` matches muted player input. `silence` is the permanent ending music cut. Neither is a general
  purpose quiet-moment control.

## Story timing

Jeremy auditioned and rejected the proposed transition crossfades on September 21, 2026: keep existing
transitions unchanged. Preserve the shared pad's pitch glides and global chord clock, along with the already
approved composed scores' existing behavior. The transition comparison remains a preview only.

`LinesChapter.linesScore` follows the three curtains, the family approach, open doorway and far shore.
Arrival and boarding retain the original pad. `linesMelodyQuiet` withdraws the reed while the bird leads and
the child follows; existing delight/completion cues also clear it for four seconds. Gesture feedback stays
active whenever input is playable. Masked melody attacks expire, with no delayed burst after a cue.
The original audition's +17.6 dB backing gain excludes preview normalization; `linesMelodyDb` trims only
the reed (currently −1.5 dB). Sections repeat for player pacing and checkpoint restores emit no reward.
Updraft/glider harmony follows the score while the original shared chord clock/glides continue independently.
Phase/exit releases last 1.8 seconds, permanent silence 0.12; finished voices and buses disconnect.

Little Boats uses the `boats` mood and its approved 36-second plucked phrase; the shared pad fades out.
Updraft notes follow its current chord. Entry starts at the beginning of the phrase, suspension
preserves audio time, missed frames skip stale attacks, and departure fades then disconnects all score voices.
The delight and restoration cues temporarily duck this background. The approach crossing retains Lines;
other crossings and islands do not play this arrangement.

`sea-score.ts` plays the approved revised sea background only when `SoundState.seaScore` is present with
`music='sea'`. `CrossingChapter` supplies it only for dolphin passages: `open` before the swim, `swim` from
restlessness through drying, `return` once settled in the arms, and `arrival` past the pod's farewell route
fraction. An unfinished swim takes priority over the approach. These states, not elapsed chapter time,
select the music. Main copies the optional state every frame, clearing it after departure.

The sections retain the auditioned notes/timbres and repeat to fit player pacing. Swim and arrival have
only sustained accompaniment. Phase changes crossfade over 1.8 seconds, with no pitch glides; updraft chord
tones follow the current harmony. The shared pad withdraws while this arrangement plays. Ordinary crossings
retain the original pad. A restored swim starts in return/arrival without replaying the opening.
Audio suspension preserves the phrase clock; missed frames skip stale attacks. Chapter exit and
permanent music silence stop scheduling, fade and disconnect the score's voices and buses.

`takeCues()` drains the simulation's cue queue once per rendered frame. One-way story events must use explicit
guards, not narrow time windows. The home finale is once-only and cannot replay after completed restoration.
Recognition still starts from the visible reveal; releasing the plane early does not overlap another melody.

`PianoStop.finish()` schedules the complete lullaby and records its actual phrase end. The final colour front
starts at `finaleWaveAfter`. `onComplete` fires once after the phrase end plus `completionRest`, and the meadow
uses that callback for `completeObjective()`. `restoreDone()` cancels pending completion.

`MeadowChapter.meadowScore` starts the approved post-piano score only after the duet is `done`: `walk` before
the crest; accompaniment-only `flock` for crest/down and `pond` for the paddle; `return` while gathering and
walking onward. Return starts harmony at four seconds and plucks at 5.5, after the existing completion cue.
Walk/return repeat at 24 seconds, flock/pond at 18. The arrangement already contains its quiet scene dynamics;
do not apply chapter `hush` a second time. `pianoMix` still controls its post-duet fade-in. Main copies/clears the
optional score state every frame; Soundscape also requires the Meadow mood.

The original pad is suppressed during the arrangement, while its global chord clock, frequency automation
and gesture scale continue unchanged. `toBoat`/`push`/`aboard` stop the score and restore the original pad before
the existing island transition. The grey approach and piano itself never start the new score. Restored piano
and pond checkpoints select walk and return respectively without reward replay. Score phase changes and
departure release/disconnect all voices; the shared audio clock preserves musical position while muted/hidden.

`BirchesChapter.birchesScore` starts the approved revision at `wonder`, after the original arrival pad.
The first loop keeps `walk`; accepting the optional swing selects `swing`. Later scarf work and unravelling
use `scarf`, without a lead melody. Once the sail is finished, `return` continues through gathering the bird
and walking to the boat. `push`/`aboard` stop the score and restore the pad before the existing transition.
Walk/swing loop after 22 seconds, scarf after 40, return after 18; checkpoints derive the phase from saved
tangles and cannot emit rewards. Its +20.3 dB level excludes the audition playback boost.

The shared pad clock/glides continue unchanged beneath Birches. Updraft and glider chord tones follow the
active arrangement independently of that clock; ordinary stroke notes keep the established Birches scale.
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

Shelter/climb phrases repeat after 32 seconds, morning after 48. Morning leaves five seconds for `lifted`
alone and nineteen before its piano answer. The pillow feather emits the two-note `feather` hint. Landing
does not emit the shared completion phrase: Jeremy approved retaining only the flight reward here. Restoring
`morning` selects the warm arrangement and sea gesture scale without emitting a cue; the feather checkpoint
selects climb and the wood scale. The dry score and its reverb sends share lifecycle gates; departure stops
and releases all piano/pad sources. `PianoStrings.note` optionally accepts an audio-clock time and returns its
scheduled sources so the score can release them; ordinary piano calls keep their immediate timing and sound.

The ending fades `musicBus` at 23.5 seconds inside the cottage and starts credits at 26 seconds. Its existing
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

Continuous sail and hull sounds use actual flutter, speed and pitch. Nearby laundry uses local wind with the
cloth's spring and flutter thresholds, limited to three sources. Dolphin re-entry uses the same crossing of
the water surface as its visible splash; emergence adds a lighter wash at its spray event. Their independent
pod-wide limits keep emergence from swallowing a landing. Whale wash, both breaths, fluke drainage and dive
fire directly from `WhaleWake`'s visible events. The shared `SeaLife` callback covers the opening-to-Lines whale,
the long crossing and the QA whale. Its broader distance range keeps the breath audible ahead of the boat.
Marine callbacks are discarded while sound is muted/hidden and cannot replay on resume; no vocal calls are added.

All new material sounds use distance attenuation, screen panning
and bounded per-source scheduling; dolphin scheduling is also bounded globally. Finished noise/tone nodes
disconnect. No child voice or routine cygnet vocal chatter is added.

Audio state is prepared once per rendered frame after the camera update. Existing hidden-page/mute lifecycle
is unchanged; see `progress.md`. Tests: `tools/audio-check.mjs`, `tools/audio-browser-check.mjs` and the existing
ending/checkpoint checks. `tools/marine-audio-check.mjs` checks actual surfacing events at 10–144 Hz, stereo,
distance, scheduling and voice cleanup, and renders an isolated sample to `/tmp/updraft-marine-audio.wav`.
Rendered previews and numerical checks do not replace listening through the game.
