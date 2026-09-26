# Audio

`src/audio/audio.ts` owns wind, environment, score, gesture chimes and authored calls. `little-boats-score.ts`
plays the approved Little Boats composition on its own chapter clock. `sea-score.ts`, `sleeping-score.ts`, `meadow-score.ts`, `birches-score.ts` and `lines-score.ts`
adapt their approved compositions to story phases. `dream-score.ts` plays the approved Sky Mirror and Drowned Village arrangements from `dream-score-data.ts`. `foley.ts` synthesizes
physical sounds; `world-foley.ts` maps object motion to them. `environment.ts` derives local habitat and coast
weights. Feel and distance settings live in `tuning.audio`.

Approved September 24 Home ending: `tuning.audio.homeEndingSounds = false` disables the ending's `unfold`,
`release`, `home` and `finale` cues plus paper handling and cottage door sounds. Their implementations remain
available behind the switch. The accepted Home composition carries the entire ending on a fixed clock. This supersedes the earlier requirement to play the recognition and finale cues.
`homeMusicDucking = false` also bypasses chapter hush and authored-cue ducking for the Home score, including
its offshore approach. Its composed dynamics, night shading and arrival fades remain.

The still island's fall (September 26): the island chapter's `openingScore` phase holds the opening on its first
chord (D) while the skein passes, so the D-major `fallen` phrase always sits in its harmony; the skein itself has no phrase, only the swans' calls. The pad
then fades to silence over the fall and stays silent through the rescue, leaving the calls, wind and sea. When the child
carries the bird away, the piece begins again from its first chord (`tuning.audio.openingReturn`). Render the sequence
with `node tools/opening-fall-render.mjs <out.wav>`.

Sleeping's September 23 approved revision continues the bedside melody over changing harmony until frost starts;
the earlier static held-chord filler was rejected. Its darker journey
variation adds a low piano pulse and recalls the bedside melody. Climb and summit share one phrase clock
and voice set; reaching the summit no longer cuts the music. Frost remains silent, and the existing flight
cue and morning answer retain their timing. See `audio-review.md` for Jeremy's brief and approvals.

## Room levels

Every piece sits near one reference, about −29 LUFS in its main section (September 25 audit and Jeremy's approval):
`tuning.audio.roomTrimDb` trims Home −6, the Sky Mirror +6, the drowned village and Sleeping +2.5 and the birches
−2.5 dB over their approved levels, and the opening grows about 5 dB with life instead of 12 (`openingPadRise`),
keeping its quiet start. The grey meadow, the wood and the Sleeping climb stay quiet by design. The level constants
below remain the approved study matches; add new rooms at the reference rather than by ear against the old pad.

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
schedule a note. All gesture attacks share the 96-BPM grid and a minimum gap: two pulses (0.625 seconds)
on the opening island, four (1.25 seconds) in the forest and Sleeping climb. Both notes of a glider answer
obey the same gap and reserve that time against gusts and updrafts.
Opening notes follow the background chord, with the original bell partials and 6 ms attack.
Ordinary forest strokes use the original low minor palette (MIDI 50–72); updrafts use D3–A3–D4–A4.
These minor colours ring over the forest drone without harmonic tail filtering. The rescue keeps its softer voice.
Elsewhere lift stays in MIDI 62–81 and strokes/glider answers stop at 86; incompatible held notes fade over
300 ms at harmonic changes. `hush` attenuates the background score only.

The piano retains its own musical response. Authored cues, including the wood's rescue `comfort` and ordinary
`kindled`, retain their existing sound and level. `breeze`, `delight` and `restored` use their original authored
pitches, bell voice and level; they are independent of cursor harmony, gain and tail gating.
Accompaniment ducks to 0.32 with a 0.45-second response and
returns over 1.3 seconds. The finale and chosen home recognition melody are unchanged. `scripted`,
`pianoActive` and the permanent ending `silence` still suppress gesture chimes.

Sleeping's `sleepingWind` is true only in the actual Sleeping chapter's `climb` score phase (climb, snow,
mist and catching the feather). Notes follow that score, use the soft attack and 0.7 relative level (about 3 dB below opening/forest chimes), and
answer at most every four pulses (1.25 seconds). The stowed glider cannot trigger extra notes. The summit,
waking and departure remain free of cursor chimes; the 300 ms tail release applies when the climb ends.
Checkpoint restoration derives the same gate. `tuning.audio.sleepingChime*` owns level and spacing.

These scene-specific rules supersede earlier all-room gesture descriptions in the score implementation history below.

## Musical continuity

`opening-score.ts` conducts the original four detuned pad voices for the approved 185.3125-second opening.
All 33 voicings and the held D/F♯ resolution at 1:25 follow a local audio clock; changes are 5.3125 seconds
apart, with the audition's longer final hold. Common pitches stay continuous; changed voices glide at the
approved rate. The complete form repeats for player pacing. Main enables `openingScore` only on the first
island and its crossing; the conductor and clock persist on departure, independently of opening gesture
chimes, which end at the island. The existing pad filter, life response, restrained activity gain, chapter
hush and cue ducking remain. Wind notes query the new harmony at their scheduled onset, including across
chord/loop boundaries. Lines' arrival gate freezes and retires the conductor without allocating another
pad or letting its notes return under the next composition. Mute and hidden-page suspension freeze audio time.

`phrasing.ts` shares scheduling, lookahead, stalled-frame skipping and introductory-rest handling across all eight scores. Sustained harmony bridges loop-end holes, including Sleeping shelter/climb. Repeating bodies alternate the main melody, a quieter sparse verse and the original melody. Lines' sparse verse rests its reply figure whole instead of dropping alternate notes, which read as missing notes inside its three-note figures; each curtain section answers its figure over its second chord, and cue space lets a sounding figure finish, then starts no new one. Historical `*_AUDITION_NOTES` exports preserve the reference studies; runtime sections contain the approved polish.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the full plucked shape in Boats, the existing Meadow melody, B–F♯–E–D in Birches, and a stretched recollection at sea. Sleeping's climb remembers D–E–F natural, then the bedside A–E–D–A. Instrument voices, local harmony and story timing remain distinct.

## Story timing

Jeremy rejected the earlier held-chord proposal. On September 21 he first requested a four-second arrival rest, then approved the audio-director priorities after the Meadow–Birches render exposed a perceived seven-second hole. Ordinary arrivals now use a short breath; Sleeping and ending retain their dramatic rests. The shared pad's pitch glides/global chord clock remain intact.

Jeremy's September 22 transition review supersedes the short breath: [every handoff](../audio-transition-review.md).
`Chapter.arrivalMusic` anticipates the destination using remaining sailing distance and its shore speed cap,
after at least 35% of the crossing. The handoff can wait up to 4.5 seconds for a nearby melodic ending.
The outgoing background fades for three seconds, rests for three, then the destination fades in over 2.5.
Sleeping rests for 3.5 seconds and Mirror four. `arrivalReady` also requires the final approach and, on the
first crossing, release of the farewell camera. Its phrase continues across grounding/disembarkation;
a very fast landing never abbreviates the rest. `arrival-music.ts` owns the audio-clock
state; mute/hidden-page suspension freezes it. There is one reverb, shared by every sound. The background music
reaches it through its own gate and duck, a pair matching the gates on its dry sound, so the arrival pause
leaves water, wind, physical sounds, calls, cues and playable gestures untouched. Nothing from the background
enters the reverb during the rest; the echo already in it rings out over the rest rather than being cut. Score scheduling stops at the handoff boundary and voices retire during the outgoing fade, so old sources cannot reappear when the gate reopens. A stalled frame still gets the full rest.

The opening waits for its current drone voicing to settle before fading. Little Boats exposes ends of its
short figures despite overlapping tails. Re-entering an already-playing piece does not create a second
pause. Sleeping morning now hands off explicitly to `sea` on departure; the sea → Mirror request waits
for the dolphins' actual farewell. Changes of section within one approved piece retain their existing
continuity and authored rests.

Every gain release/fade explicitly anchors its current value at the start time before the linear ramp.
`cancelAndHoldAtTime` alone can leave the last constant event in the past: this caused the arrival fade-in to
jump to about 75%, and Sleeping releases to drop about 83% immediately. Both now use the intended full fades.
The still-island pad continues into its crossing; Wood also retains its .55 hush on departure.
Strong wind adds at most about 2 dB to the fully alive daytime pad (previously about 8 dB), independently of
its gesture notes. Ambient pink-noise loops blend their seam over 40 ms and retain randomized starting offsets.
Finished chime, wildlife, call and ember nodes disconnect after their release.

The final crossing is a deliberate exception to the short arrival breath. On departure from Sky Mirror,
`homeward` requests Home immediately. Mirror fades for three seconds, its background gates remain
closed for at least five, then Summit fades in over three once the boat clears the first offshore turn
and 30 units from departure. Slow sailing extends the rest; once entered, sailing back cannot close it.
Wind, water, foley and authored calls remain outside this musical silence. `homewardReady` and
`tuning.audio.homeward*` own the spatial gate and timing. A restored home chapter can enter directly.

`summit-score.ts` plays Jeremy's approved drone: all 32 voicings at 80% tempo, continuous detuned
triangle/sine voices, shared pitches held and moving voices independently gliding. Offshore `approach`
plays the whole 180-second form, repeating for a slow crossing; landing retains its instance and clock.
`HomeChapter.homeEndingTime` starts at the successful updraft. From then on `SummitScore` plays the
accepted flight/farewell/Home sequence once, preserving the live voices at entry. Two soft upper voices
join during the walk; the final Dmaj9 becomes Dadd9 with only C-sharp rising to D. It holds its height
and level until the final fade. Checkpoint restoration selects the matching reunion/drawing score time.
The paper release is automatic. `home-ending.ts` shares the end times between story and audio; scene
phase changes cannot restart the composition. The old phase arrangements remain available when no
ending clock is supplied. Recognition/release/door/finale cues remain disabled behind their switch.

Drowned starts its handoff on departure from Birches, then requests Wood only after the lost-plane scene.
The long sea passage retains its swim/reunion music until the pod's farewell. Meadow arrival uses its grey
pre-piano bed; the approved post-piano composition still waits for the duet. `tuning.audio.arrival*` owns the
distance allowances and fade/rest durations.

`LinesChapter.linesScore` follows the three curtains, the family approach, open doorway and far shore.
The first section begins on the approach crossing and continues ashore; the shore section continues through
boarding and the crossing to Little Boats, retaining the same score instance and phrase clock.
`linesMelodyQuiet` withdraws the reed while the bird leads and the child follows; the curtains' delight cues also clear it for four seconds. The door opens without the shared completion phrase: on September 25 Jeremy asked for the piano phrase to be taken off the door. Gesture feedback stays
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
Its seeded buffers and diffuse convolver are prepared across frames once Drowned's music begins (about two
seconds), so the cue's frame only connects nodes; the prepared field serves one call, and a call before
preparation finishes builds its parts on the spot. The cue bypasses musical phrases and accompaniment ducking.
Muted/not-started audio consumes the cue without replaying it later; an interrupted context holds it only within
the same 0.25-second allowance; hidden-page suspension preserves active audio timing. Restoring the earlier
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
through departure. Main copies the optional state every frame and clears it on exit. Cold schedules
no accompaniment, however long the player takes. Summit continues the climb without resetting its phrase.
Other section changes release existing voices over 1.8 seconds, including their reverb sends.
The generic pad is suppressed throughout Sleeping. Its authored dynamics replace `hush` attenuation for this
arrangement; gesture chimes and physical sounds remain available under their usual rules.

Shelter/climb phrases repeat after 32 seconds. Morning has a 48-second first pass, then repeats its 43-second body without the initial rest. Morning keeps its authored chord lengths: its last chord ends with the melody rather than being held until the repeat, which sounded like a stuck note. Morning leaves five seconds for `lifted`
alone and nineteen before its piano answer. The pillow feather emits the two-note `feather` hint. Landing
does not emit the shared completion phrase: Jeremy approved retaining only the flight reward here. Restoring
`morning` selects the warm arrangement and sea gesture register without emitting a cue; the feather checkpoint
selects climb and the wood register. Gesture pitches follow the selected arrangement in both cases. The dry score and its reverb sends share lifecycle gates; departure stops
and releases all piano/pad sources. `PianoStrings.note` optionally accepts an audio-clock time and returns its
scheduled sources so the score can release them; ordinary piano calls keep their immediate timing and sound.
`PianoStrings` voice reservations belong to its AudioContext: muting suspends that context with its notes still
scheduled, so the ten reservations survive mute and are cleared only when a new context is installed.

Only Home's ending gets a 0.7-second fade, from 113.8 to 114.5 seconds after the successful updraft.
It acts on the background's dry sound and its send into the reverb, so the reverb's tail rings on after the music;
wind and wildlife remain. Credits start at 116.5 seconds, two seconds after the music ends. Their
initial position is inside the bottom reveal band and opacity enters over 0.3 seconds, so the first
line is visible at the intended time rather than travelling up from beneath the screen. Other chapter
fades are unchanged. The old `unfold` melody is retained in code, with its ending cue disabled.

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

The sailing boat has no hull-water foley: its repeating bursts sounded like persistent flapping and Jeremy
requested their removal. Toy-boat water sounds remain. A quiet canvas fold sounds once at full droop (0.995),
re-arming only after the sail refills below 0.8 droop, with a 2.4-second minimum interval. Entry/resume is silent
and muted, distant or cooldown arrivals expire. Sail flutter sound follows fresh rises in flutter, with a 2.4-second
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

The Lines pinwheel flutter is one voice for the whole row. Once the row is out of reach (camera beyond 220
units) the voice fades with its 0.2-second time constant, then its sources stop after 1.5 seconds and every node
disconnects. A new voice, reusing the context's paper noise, is made if the row comes back into reach.

Audio state is prepared once per rendered frame after the camera update. `Soundscape.output` returns one cached
graph object while running and null otherwise. Existing hidden-page/mute lifecycle is unchanged, and interrupted
audio keeps recent story cues; see `progress.md`. Tests: `tools/audio-check.mjs`, `tools/audio-browser-check.mjs` and the existing
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
The background gates stay open. The retiring village score fades while
the forest pad enters on D/A; the previously inaudible pad is tuned before it becomes audible. After the
blend, the existing forest chord clock resumes with its slow pitch glide into the unsettled voicing.
Other arrivals retain the 1.5-second fade, 0.4-second breath and 1.5-second fade-in. No new forest melody,
weather sound or protagonist voice is added.

## Start-up and preparation

The Begin gesture creates and resumes the AudioContext and builds its graph, nothing more. The six-second loop
noise and the 4.5-second reverb impulse are synthesised afterwards in 4096-sample slices at 240 slices per second
of story time (about 16k samples in a 60 Hz frame; both ready about a second after Begin), with unchanged
formulas. Each long convolver analyses its impulse on the main thread (10–30 ms on a desktop), so each gets a
frame to itself: the reverb and, in Drowned, the foghorn's diffuse field. Ambient beds join with a 0.25-second
fade and the reverb starts from silence, so nothing clicks; thunder or an ember needed sooner finishes the noise
at once. Arrivals only move gates, so they make and analyse no convolver. `src/audio/sliced.ts` paces this work. `tools/audio-interruption-check.mjs` checks the pacing, entries,
the prepared horn, piano reservations across mute, the cached output graph, interruptions and the pinwheel voice.
