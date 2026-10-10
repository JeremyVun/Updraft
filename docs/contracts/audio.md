# Audio

Everything is synthesised in Web Audio; there are no sample files. `src/audio/audio.ts` (`Soundscape`) owns wind,
environment, the shared pad, gesture chimes, authored cues and calls, and runs one pass per rendered frame after the
camera update. Each room with its own composition has a score module that follows story phases, not timers:
`opening-score.ts`, `lines-score.ts`, `little-boats-score.ts`, `meadow-score.ts`, `birches-score.ts`,
`stairs-score.ts`, `dream-score.ts` (Drowned Village and Sky Mirror, notes in `dream-score-data.ts`),
`sleeping-score.ts`, `sea-score.ts` and `summit-score.ts` (the homeward crossing and the Home ending).
`phrasing.ts` shares scheduling, lookahead, stale-attack skipping and introductory rests among them;
`arrival-music.ts` owns handoffs between pieces; `gesture-harmony.ts` the chord tones gestures may use.
`foley.ts` synthesises physical sounds and `world-foley.ts` / `birches-foley.ts` map object motion to them;
`environment.ts` derives habitat and coast weights; `foghorn.ts` is the Drowned lighthouse horn; `stairs-sound.ts`
and `stairs-air.ts` are the stairs room's air; `sliced.ts` paces start-up synthesis. The piano's tone is
`PianoStrings` in `audio.ts`. Feel, level and timing knobs live in `tuning.audio` (plus `tuning.piano` and
`tuning.storm` where noted).

Story code raises cues through `cue()` / `completeObjective()` in `src/story/cues.ts`; `takeCues()` drains the queue
once per rendered frame. Chapters expose optional score state (`linesScore`, `meadowScore`, `birchesScore`,
`sleepingScore`, `seaScore`, `stairsAir`, `arrivalMusic`, and so on); `main.ts` copies it into `SoundState` every frame
and clears it on exit.

## Jeremy's standing rulings

- New music goes to Jeremy as a rendered listening study before it goes into the game; rendered checks and
  measurements are never a listening sign-off.
- The game's style is the detuned drone. Keep it, but it must move harmonically: "it just can't be one single drone
  note the whole way through". Circle-of-fifths piano rewrites of the opening and summit were rejected.
- Never fill a musical gap with one held sound: a stretch in Sleeping "playing the exact same note" was "horrible".
  The held-chord crossfade replacement for the shared pad's chord clock and glides was rejected; the pad's clock and
  glides stay.
- The opening island keeps its approved music; an "evolution" study was rejected ("the original still sounds better").
- The Lines score stays as shipped; a from-scratch rewrite was "a clear downgrade". Don't propose it again. No
  completion phrase when the door opens.
- The piano-lullaby reprise at Home was rejected. Home's ending is scripted from the successful updraft and must feel
  as if the Home music plays all the way through to the credits.
- No bell phrases over the swans at Home: not when the family arrives over the summit, not as they fly away. The
  wingbeats and the Home drone carry it.
- The story no longer cues `delight` (the chime with the child's cheer): it no longer fits the music.
- The sailing boat has no hull-water foley: its bursts sounded like flapping. Toy boats keep theirs.
- No child voice: "never any voicing from the two main characters". The cygnet's calls, which he later heard and
  liked ("The cygnet sounds great"), are the one exception (`docs/cygnet.md`).

## Room levels

Every piece sits near one reference, about −29 LUFS in its main section. `roomTrimDb` trims Home −6, the Sky Mirror
+6, the drowned village and Sleeping +2.5 and the birches −2.5 dB over each piece's approved study level
(`*ScoreLevel`), and the opening grows about 5 dB with life (`openingPadRise`), keeping its quiet start. The grey
meadow, the wood and the Sleeping climb stay quiet by design. Add new rooms at the reference.

## Player feedback

**Cursor chimes play only on the opening island, in the forest and on Sleeping's feather-guided climb.**
`SoundState.startingIsland` follows `story.name === 'island'`, `forestWind` follows `story.name === 'wood'` and
`sleepingWind` is true only in the Sleeping chapter's `climb` score phase (climb, snow, mist, catching the feather).
These gates are independent of whatever music is still playing from a departed island. Outside them gusts, held
updrafts and glider-lift answers schedule no chimes, and sounding tails fade over `gestureTailRelease` (300 ms).
`scripted`, `silence` and an engaged piano (`pianoActive`) also suppress them. Checkpoint restoration derives the same
gates.

- Audio and `PointerInput` share `pointer.minGust` and `pointer.minLift`, so the first gentle stroke after audio
  starts can sound.
- Attacks sit on a 96-BPM grid with a minimum gap: `gesturePulses` (two pulses, 0.625 s) on the opening island,
  `forestChimePulses` / `sleepingChimePulses` (four, 1.25 s) in the forest and on the climb. Both notes of a glider
  answer obey the gap and reserve it against gusts and updrafts.
- Opening notes follow the background chord, with the original bell partials and 6 ms attack (`gestureAttack`).
- **Forest chimes use the original low minor palette: the whole wood scale (MIDI 50–72), not filtered to the current
  chord.** Forest updrafts use D3–A3–D4–A4. These ring over the forest drone without tail filtering. Searching at
  the rescue ember uses the softer caring voice (`careChime*`).
- Sleeping climb notes follow its score, with the soft attack at `sleepingChimeLevel` (about 3 dB under the others).
  The stowed glider cannot trigger notes; summit, waking and departure have none.
- Where a gesture follows harmony, lift stays in MIDI 62–81 and strokes and glider answers stop at 86; notes query
  the harmony at their scheduled onset, including across chord and loop boundaries, and incompatible held notes fade
  over 300 ms at chord changes.
- Player gust, whistle, ground rustle and updraft noise are the same level in every room and ease off as a stroke
  strengthens (`playerWindEase`: about −1 dB at half strength, −6 dB at full); their filter sweeps are scaled by
  `playerWindFilterRange`. Ambient breeze, sea and rain are separate.
- `hush` attenuates only the background score, never the player's feedback.

Authored cues keep their own sound: `restored` (the shared completion phrase), `breeze`, `kindled`, `comfort` (the
rescue hearth's two notes), `feather`, `lifted`, `star` and the rest use fixed pitches and the bright bell voice,
independent of cursor harmony. An important cue ducks the accompaniment to `authoredCueDuck` (0.32) over 0.45 s and
returns over 1.3 s. The piano keeps its own musical response.

## Scores, room by room

**Opening.** `opening-score.ts` conducts the original four detuned pad voices through the approved 33 voicings,
5.3125 s apart (80% of the endorsed tempo), with a held D/F♯ resolution at 1:25; the 185.3125 s form repeats for
player pacing. It plays on the first island and its crossing (`openingScore`), follows a local audio clock, and the
Lines arrival retires it without letting it return. During the fall the `openingScore` phase holds the first chord
(D) while the skein passes, so the D-major `fallen` phrase always fits; the skein has no phrase, only the swans' own
calls. The pad then fades to silence with the fall and stays silent through the rescue, leaving calls, wind and sea;
when the child carries the bird away the piece begins again from its first chord (`openingReturn`). Render it with
`node tools/opening-fall-render.mjs <out.wav>`.

**Lines.** `LinesChapter.linesScore` follows the three curtains, the family approach, the open doorway and the far
shore. The first section starts on the approach crossing; the shore section carries on through boarding and the
crossing to Little Boats. `linesMelodyQuiet` withdraws the reed while the bird leads; `restored` clears it for
`linesCueSpace`. The quiet verse rests whole reply figures rather than dropping notes inside them, each curtain section
answers its figure over its second chord, and cue space lets a sounding figure finish and starts no new one.
`linesMelodyDb` trims the reed alone.

**Little Boats.** The approved 36 s plucked phrase on its own chapter clock (`boats` mood); the shared pad fades out.
The Lines shore section plays until the Boats handoff, and Boats carries on across the crossing to Meadow.

**Meadow and the piano.** A grey bed plays on arrival. The background stays while the child walks to and looks at the
piano, then fades once over `tuning.piano.fadeOut` from sitting, overlapping the first key and clear before the
demonstration; `pianoMix` carries that fade and Meadow's `hush` holds only its other quiet, so nothing is attenuated
twice. Departure from the stool returns the background over `fadeIn`. `PianoStop.finish()` schedules the whole
lullaby, the colour front starts `finaleWaveAfter` in, and `onComplete` fires once after the phrase plus
`completionRest`, which is when the meadow calls `completeObjective()`; `restoreDone()` cancels a pending completion.
Only after the duet is done does `MeadowChapter.meadowScore` start: `walk` before the crest, accompaniment-only
`flock` and `pond`, then `return` (harmony at 4 s and plucks at 5.5 s, after the completion cue), which continues
through boarding and the crossing to Birches. The arrangement contains its own dynamics; don't apply `hush` on top.

**Birches.** `BirchesChapter.birchesScore` runs from the approach crossing: `walk` for the first loop, `swing` if the
optional swing is accepted, `scarf` (no lead melody) for the later tangles, and `return` once the sail is finished.
`return` carries on through boarding and into the stairs room. Checkpoints derive the phase from saved tangles.

**Drowned Village and Sky Mirror** (`dream-score.ts`). Drowned follows rooftops, becalming, resumed drift, the 22 s
gathering storm, plane loss and the approach to the wood; its composed levels already include the withdrawal, so
chapter hush is not applied again, and the `becalmed` cue still ducks it. The Mirror follows approach, first play,
one to three returned lights, the full constellation and departure; completed-star count, not order, picks the
section, the third star reuses the middle verse and only the fourth gets the final bloom. `star` is emitted once per
real return, never on entry, loops or restore. The departure section carries on over the harbour crossing.

**Wood.** The original low forest drone. Ordinary embers cue `kindled`; lighting the rescue hearth cues `comfort`.

**Sleeping.** `SleepingChapter.sleepingScore`: `shelter` (the bedside melody over changing harmony) until the first
frost; `cold`, silent however long the player takes, through the unanswered call and the feather's departure; `climb`
through snow and mist (D minor, B♭, G minor and suspended A, a low piano pulse, the D–E–F winter fragment and the
bedside A–E–D–A); `summit` continues the climb's phrase clock and voices from unbinding through the ribbon tug;
`morning` from release through departure. Morning plays a 48 s first pass, then its 43 s body; it leaves 5 s for
`lifted` alone and 19 s before its piano answer, and keeps its authored chord lengths (holding the last chord to the
repeat sounded like a stuck note). The pillow feather cues the two-note `feather` hint; the full `lifted` phrase
belongs to the bird's flight, and landing adds no completion phrase. The generic pad is silent throughout Sleeping and
`hush` does not apply. Restoring `feather` selects climb and the wood register; `morning` the warm arrangement and sea
register; neither cues anything. `PianoStrings.note` optionally takes an audio-clock time and returns its sources so
the score can release them; its ten voice reservations belong to the AudioContext, survive mute and are cleared only
when a new context is installed.

**The long sea crossing.** `CrossingChapter.seaScore` exists only on the dolphin passage: `open` before the swim,
`swim` from restlessness through drying, `return` once the bird is back in the arms, `arrival` past the pod's
farewell. An unfinished swim outranks the approach, and a restored swim starts in return or arrival. Swim and arrival
are accompaniment only. Ordinary crossings keep the departing island's music until the handoff.

**Homeward and Home** (`summit-score.ts`). Leaving the Sky Mirror requests Home at once: the Mirror fades over 3 s, the
background stays silent at least 5 s, and the drone fades in over 3 s once the boat has passed its first offshore turn
and is `homewardClearDistance` from the berth; slow sailing lengthens the rest (`homeward*`, `homewardReady`). Offshore
it plays the whole three-minute drone Jeremy approved (32 voicings at 80% tempo), repeating if needed; landing keeps the
instance and clock. From the successful updraft `HomeChapter.homeEndingTime` drives a fixed, once-only ending: the music
rises over 4 s from wherever the approach left it (no reward bells at the updraft), plays the flight, farewell and Home
passages, gains two soft upper voices during the walk, climbs home by steps over a held D (B♭, C, D) that broaden (5.1,
5.5, 6 s), and resolves Dmaj9 to Dadd9 with only C♯ rising to D. The last chord rings about seven seconds, then the dry
sound and its reverb send fade over 0.7 s from `HOME_ENDING.fadeFrom`; the reverb tail rings on, wind and wildlife
remain, and the closing line starts at `HOME_ENDING.creditsAt`, two seconds after the music ends. `src/story/home-ending.ts`
shares these times between story and audio; restoring `reunion` or `drawing` enters at the matching score time; the
paper release is automatic. `homeEndingSounds = false` disables the old `unfold`, `release`, `home` and `finale` cues
and the paper and cottage-door foley (kept in code behind the switch); `homeMusicDucking = false` bypasses hush and cue
ducking for Home. Render the ending with `node tools/ending-audition.mjs`.

Every score repeats its sections to fit player pacing, releases voices over 1.8 s on phase changes and exit (0.12 s
for permanent silence), disconnects finished voices and buses, and freezes with the shared audio clock when muted or
hidden. Missed frames skip stale attacks rather than bursting.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the plucked shape in Boats, the
Meadow melody itself, B–F♯–E–D in Birches, a stretched recollection at sea, and D–E–F on the Sleeping climb.

## Handoffs between pieces

- `Chapter.arrivalMusic` names the destination piece. On a crossing it is requested from the remaining distance and
  the shore speed cap, never before 35% of the route is behind the boat (`arrivalMusicRouteShare`, `arrivalMusicLead`).
- The outgoing piece may wait up to `arrivalPhraseWait` (4.5 s) for a nearby melodic ending; the opening lets its
  current voicing settle first. It fades over `arrivalFadeOut` (3 s), rests `arrivalQuiet` (3 s; Sleeping 3.5, Mirror
  4), then the destination fades in over `arrivalFadeIn` (2.5 s). `arrivalReady` also requires the final approach
  and, on the first crossing, the farewell camera's release. A fast landing never shortens the rest, and the incoming
  phrase continues across landing.
- There is one reverb for every sound. The background reaches it through its own gate and duck, matching the gates on
  its dry sound, so the pause silences only the music: water, wind, foley, calls, cues and gestures carry on. The echo
  already in the reverb rings out rather than being cut. Score scheduling stops at the handoff and voices retire
  during the fade, so nothing reappears when the gate reopens.
- Re-entering a piece that is already playing makes no second pause. Section changes inside one piece keep their own
  continuity.
- Special cases: Sleeping morning hands off explicitly to `sea` on departure; sea → Mirror waits for the dolphins'
  actual farewell; Birches → Drowned starts in the stairs' fog; Drowned requests Wood only after the lost-plane scene,
  as a **four-second overlap** (`forestMusicBlend`) with the gates open, the forest pad tuned before it is audible and
  entering on shared D/A; Mirror → Home is the homeward rest above.

Every gain fade explicitly anchors its current value at the start time before the linear ramp:
`cancelAndHoldAtTime` alone can leave the last event in the past and make a fade jump.

Silent layers are held, never re-targeted or disconnected (`Soundscape.fade`). A gain that `setTargetAtTime`
re-targets every frame counts as live automation even at 0, and keeps every convolver it feeds running; once it is
within −120 dB of a zero target (by its own schedule and by the engine's reported value) it is set to exactly 0 once
and left, so the reverb idles after its tail. Disconnecting a looping source instead would stop its playhead in
Chrome, and the noise would come back at a different place. `tools/audio-silence-check.mjs` renders scripted
sequences through this graph and a previous build's to prove a change like this inaudible.

## Cues

- One-way story events use explicit guards, never narrow time windows. Completions and rewards are not replayed on
  checkpoint restore.
- The Drowned lighthouse raises one `foghorn` at storm time `tuning.storm.foghornAt`, guarded by `hornPassed`. A call
  later than `foghornLateAllowance` (0.25 s) is dropped, so it never overlaps the thunder or the plane loss. The horn
  (D3, a diffuse stereo field, settings in `tuning.audio.foghorn`) bypasses phrases and ducking. Its buffers and
  convolver are prepared across frames once Drowned's music begins, so the cue's frame only connects nodes.
- Muted, hidden or not-started audio consumes cues. A call or Siri interrupting a visible, unmuted context holds cues
  for `heldCueLife` (3 s) and plays them in order when audio resumes (see `progress.md`).

## Space and habitat

Each frame derives `land`, `sea` and `meadow` from the story focus and chapter. Shoreline distance is a cached CPU
height query around that point. `overLand` describes only the pointer, for wind rustle. Night wildlife needs land,
warmth and little rain; skylarks need meadow, daylight and little rain; Sleeping's cold withdraws with dawn; Home keeps
its crickets and owls.

Cygnet and flock sounds use the rendered camera's `screenPan` and source distance; the hidden cygnet stays audible.
Story and incidental adult swans share one synthesis. An authored call holds incidental flock chatter for `callSpace`;
Meadow and Home set `flockChatter = false`. Adult calls fade with distance and stop beyond `flockDistance`.

## Physical sounds

Motion sounds come from changes in physical state, never from completion cues: curtains, the family's sleeves, scarf
working, releasing and gathering, paper and doors. New sources, inactive sources and the first frame after resume
establish a silent baseline, so completed actions are never replayed. Every source has distance attenuation, screen
pan and bounded scheduling; finished nodes disconnect.

- Birches: leaf scuffs follow the child's footfalls on authored leaf-covered ground (the initial litter map, not
  readbacks) and the cygnet's heap kicks, sharing one `leafScuffEvery` budget; particles and wind never trigger them.
  Swing creaks need real travel and a reversal, `swingCreakEvery` apart. Both attenuate over `birchesFoleyNear/Far`.
- Sail: one quiet canvas fold at full droop (`sailSettleAt`), re-armed only after a refill below `sailSettleRearm`;
  flutter sounds only on fresh rises, `sailEvery` apart. Toy-boat flutter is silent.
- Laundry: local wind on the cloth's spring and flutter thresholds, at most `clothSources` voices. A passage sheet's
  peg coming off the line snaps once (`peg`), from the peg itself; pegs already off when a checkpoint loads are silent.
- Sleeping hearth: one looping low roar that breathes, plus crackles in small uneven clusters with an occasional
  snap, all scaled by the flame and the camera's distance; the roar fades out with the flame or on leaving the room, and
  once it has been quiet for two seconds it stops until the fire is heard again.
- Dolphins and whales: sounds fire from the same events as the visible splash, spray, breaths, fluke drainage and
  dive (`WhaleWake`, the shared `SeaLife` callback), with soft attacks and level trims (`dolphin*`, `whale*`). Pod
  emergence and re-entry have separate budgets. Muted or hidden events are dropped.
- The whale in the net (`Net.onSound`, through `WorldFoley.net` at the whale's level and distance): each weak breath
  under the blue-green mesh sputters (`net-sputter`); the lifted net takes the weight of its wet rope as fast as it
  rises (`net-lift`); the heavy fold of net and weed over its eye peels up, turns over and slaps down wet on its brow
  as it flips (`fold-lift`); the near cork knocks on the planking when it comes in hard (`cork-knock`); each heave
  lifts the mesh off its head in the wind as the rope creaks taut, under one soft rising note (`net-heave`), and each
  of her pulls draws the wet rope through her mittens (`rope-pull`); the mesh slithers off the skin into the sea as
  fast as it peels (`net-slither`); the last loop slides off the flipper's tip into the cygnet's pull (`loop-slip`);
  the cygnet scrambles up out of the sea onto her side (`swimmer-out`; its plunge in is its own `plunge`). The sea runs off its near
  flipper as each lazy lift brings it up out of the water (`flipper-pour`, through `WorldFoley.whale`) before it is laid
  back down (`whale-slap`), and as it lifts it high to wave goodbye. The seabirds standing on its back go up with a soft flurry of heavy wingbeats as it spouts
  free (`seabirds-lift`, through `WorldFoley.whale`, from the first of them); the sea running off its back with each
  breath is silent under its sigh.
- The whale's voice (`whale-voice.ts`, `WhaleVoice`, owned by `Foley.whale`): an original procedural voice informed by
  [NOAA's humpback recording](https://www.fisheries.noaa.gov/national/science-data/sounds-ocean-mammals).
  Uneven falling cries and rising answers use fundamentals around 55–254 Hz, a changing balance of four smooth
  partials, irregular pitch drift, filtered breath and diffuse reverb. The former fixed bass stack and score-note
  arches still sounded like a motorcycle to Jeremy after the rapid pulsing was removed: spectral and level checks
  alone cannot approve the timbre. The freed song finishes before the flipper's goodbye begins. Keep enough
  upper harmonics for small speakers: removing the roughness must not remove the audible voice. The first tired
  moan (`whale-moan`, two phrases spanning 10.2 s) waits until the cygnet has finished returning aboard and the whale
  is visibly emerging, within `netWhale.nearCallAt` of the rest. Weak sighs and net sputters use the same gate;
  the distant visual blow stays silent during the swim. One closer reply follows (`whale-near`, 4.4 s, at least
  `nearCallGap` after the moan ends);
  a greeting as its eye opens on her (`whale-greet`, from the net's `whale-call`); a glad song
  in two unequal phrases as it breathes free (`whale-song`); a falling goodbye as it waves its
  flipper and again as its flukes stand and flex (`whale-goodbye`); and its last and lowest, muffled, from under the sea
  as its swell reaches the boat (`whale-deep`). The first crossing's far dive has at most its echo (`whale-echo`).
  `WorldFoley` gives the voice its own level and distance (`whaleVoice.level` 0.20 at its loudest, `near` 40 m to
  `far` 600 m, never below `farthest`), so the moan carries from the mist; farther, it is more muffled and more of it
  is reverberation. `whaleVoice.pitch` 0.78 deepens all calls by about four semitones; `wet` 0.42 gives them a little
  more diffuse reverb. While it calls the encounter's
  `hush` rises to at least `netWhale.voiceRoom` (0.6, about −7 dB on the sea score) and eases back after, so the score
  makes room under it rather than burying it.
  `tools/whale-voice-check.mjs` renders all seven production calls through WorldFoley and checks clipping, level,
  the direct voice's rapid amplitude modulation, the shared reverb tail and the moan's body above 180 Hz at its visible-reveal distance of about 95 m.
  `MUTATE=motor` and `MUTATE=thin` prove those guards. The passage check rejects any whale sound before visible
  emergence and the bird's return; `MUTATE=earlyvoice` proves this. `AUDIO=1 node tools/sea-check.mjs` records both approach and release mixes; listening remains
  part of the playtest.
- Flock wingbeats follow flight and take-off; resting rafts are silent. Beats consumed while inaudible never burst on
  return.
- The Lines pinwheels share one flutter voice; out of reach it fades, stops and disconnects, and a new one is made if
  the row comes back.

## Start-up and lifecycle

The Begin gesture creates and resumes the AudioContext and builds its graph, nothing more. The loop noise and reverb
impulse are then synthesised in slices over about a second (`sliced.ts`), each long convolver gets a frame to itself,
ambient beds join with a short fade and the reverb starts from silence, so nothing clicks. Arrivals only move gates and
build no convolver. `Soundscape.output` returns one cached graph object while running. Hidden-page and mute handling:
`progress.md`.

## The stairs in the clouds (proposal, not approved)

The room's sound follows `SoundState.stairsAir` (`StairsAir` in `stairs-air.ts`: a phase from `under` through
`cloud`, `above`, `sail` and `fog` to `down`, and the measures `cloud`, `climb`, `open`, `fog` and `speed`), which the
chapter sets each frame; no clock decides a phase.
`stairs-sound.ts` owns the air and the knock, `stairs-score.ts` the bloom and sail music.

- Under the cloud the birches' `return` phrase carries on through the puzzle. Each flight that docks raises
  `flightHome`, a soft wooden knock and puff outside cue ducking (`flightKnock`); the last flight also plays the
  completion phrase. The cygnet's `puzzled` peep asks when the loop brings it back to where it set off.
- In the white the birches' phrase drains away (`stairsAir.drain`) and never returns in this room; the wind is close
  and muffled and climbs with `climb`, while breeze and sea fall away.
- Out on top the wind drops and the room is nearly silent, then the score's bloom starts from nothing; the sail
  crossfades from it. Under it, while the hull rides the cloud, a low breath of air past the hull (lowpassed under
  about 600 Hz) follows `speed` and swells over several seconds, and the kite's line sings faintly while it draws
  them. Never a hiss: a band of hiss through the tops made the cloud sound like snow (Jeremy, 2026-09-28).
- The fog thins the sail and asks for the village's music (`arrivalMusic = 'drowned'` during `fog` and `down`) through
  the ordinary handoff. Once out on top, only the fog brings the sea back; a started score keeps its section whatever
  one frame's phase reports. Outside the room every level multiplier is exactly 1.

Levels: `stairsAir`, `stairsAirLevel`, `stairsScoreLevel`, `stairsPhaseFade`. Render the arc offline with
`node tools/stairs-audio-proposal.mjs [outDir]` against a dev server.

## Checks

`npm run check:audio` runs the offline audio and score checks in headless Chrome against a running dev server (no GPU);
the list and the browser audio checks are in [testing.md](../testing.md). `node tools/audio-interruption-check.mjs`
covers start-up pacing, interruptions, piano reservations across mute, the cached output graph, the foghorn's
preparation and the pinwheel voice. `node tools/music-transition-audit.mjs` renders every handoff and all score
sections.

## Open

- The stairs: the sail's air over the cloud awaits Jeremy's listen in the game.
- Artistic sign-off needs a full-journey listen on headphones and a phone speaker (idle, energetic swiping, failed
  attempts, the optional swing), checking that each place is distinguishable by ear and the physical sounds and caring
  chime feel right in context.
