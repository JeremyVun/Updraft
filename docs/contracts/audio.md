# Audio

`src/audio/audio.ts` owns wind, environment, score, gesture chimes and authored calls. `little-boats-score.ts`
plays the approved Little Boats composition on its own chapter clock. `foley.ts` synthesizes
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
and Sleeping morning retain the original pad. A restored swim starts in return/arrival without replaying the
opening. Audio suspension preserves the phrase clock; missed frames skip stale attacks. Chapter exit and
permanent music silence stop scheduling, fade and disconnect the score's voices and buses.

`takeCues()` drains the simulation's cue queue once per rendered frame. One-way story events must use explicit
guards, not narrow time windows. The home finale is once-only and cannot replay after completed restoration.
Recognition still starts from the visible reveal; releasing the plane early does not overlap another melody.

`PianoStop.finish()` schedules the complete lullaby and records its actual phrase end. The final colour front
starts at `finaleWaveAfter`. `onComplete` fires once after the phrase end plus `completionRest`, and the meadow
uses that callback for `completeObjective()`. `restoreDone()` cancels pending completion.

Sleeping's pillow feather emits the two-note `feather` hint. The brave flight retains `lifted`. Restoring
`morning` restores `music='sea'` and `hush=0.1` without emitting a reward. The earlier checkpoint retains wood.

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
