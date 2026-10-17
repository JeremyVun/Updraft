# Audio

Home, the Sky Mirror, Birches, the stairs in the clouds, the drowned village, Sleeping, Lines and Little Boats play supplied recordings; Still experiments with triggered excerpts, and the open sea plays its recording as excerpts the whale's rescue calls for; the other scores and world sounds are synthesised in Web Audio.
`src/audio/audio.ts` (`Soundscape`) owns wind,
environment, the shared pad, gesture chimes, authored cues and calls, and runs one pass per rendered frame after the
camera update. Each room with its own composition has a score module that follows story phases, not timers:
`opening-score.ts` and `meadow-score.ts`. `recorded-score.ts` plays Home, the Sky Mirror,
Birches, the stairs song under the cloud, Lines and Little Boats continuously across story phases, and the stairs' `clouds.ogg`, the village's
`village_approach.ogg` and `belfry.ogg`, and Still's departure once each (`recordedMusicOnce`); `phrase-clips.ts` plays excerpts of one recording as
overlapping clips for `still-phrases.ts` and the open sea's `sea-music.ts`; `sleeping-music.ts` plays Sleeping's lullaby
and the parts of its climb's recording.
The former `little-boats-score.ts`, `lines-score.ts`, `birches-score.ts`, `summit-score.ts`, `sea-score.ts`, `stairs-score.ts`, `drowned-score.ts`, `sleeping-score.ts` and `dream-score.ts` (notes in `dream-score-data.ts`) remain for historical studies and phase types, outside runtime playback.
`phrasing.ts` shares scheduling, lookahead, stale-attack skipping and introductory rests among them;
`arrival-music.ts` owns handoffs between pieces; `gesture-harmony.ts` the chord tones gestures may use.
`foley.ts` plays physical sounds and `world-foley.ts` / `birches-foley.ts` map object motion to them;
`environment.ts` derives habitat and coast weights; `foghorn.ts` is the Drowned lighthouse horn; `stairs-sound.ts`
and `stairs-air.ts` are the stairs room's air; `sliced.ts` paces start-up synthesis. The piano's tone is
`PianoStrings` in `audio.ts`. Feel, level and timing knobs live in `tuning.audio` (plus `tuning.piano` and
`tuning.storm` where noted).

Story code raises cues through `cue()` in `src/story/cues.ts`; `takeCues()` drains the queue
once per rendered frame. Chapters expose optional score state (`linesScore`, `meadowScore`, `birchesScore`,
`sleepingScore`, `sleepingMusic`, `seaScore`, `seaMusicTime`, `stairsAir`, `arrivalMusic`, and so on); `main.ts` copies it into `SoundState` every frame
and clears it on exit.

## Jeremy's standing rulings

- New music goes to Jeremy as a rendered listening study before it goes into the game; rendered checks and
  measurements are never a listening sign-off.
- The original synthesised scores use the detuned drone. Keep it, but it must move harmonically: "it just can't be one single drone
  note the whole way through". Circle-of-fifths piano rewrites of the opening and summit were rejected.
- New music needs structured harmony and melody: a theme in regular phrases over clear, repeating progressions, not a
  scatter of notes ("the music sounds a bit... random? I think there's not enough structured harmony / melody to it").
- Never fill a musical gap with one held sound: a stretch in Sleeping "playing the exact same note" was "horrible".
  The held-chord crossfade replacement for the shared pad's chord clock and glides was rejected; the pad's clock and
  glides stay.
- The opening island keeps its approved drone available, disabled during the Still phrase experiment below; an "evolution" study was rejected ("the original still sounds better").
- The former Lines score remains available for studies; Lines plays `lines.ogg`. A from-scratch rewrite was "a clear downgrade": don't propose it again. No
  completion phrase when the door opens.
- The piano-lullaby reprise at Home was rejected. Home's ending is scripted from the successful updraft and must feel
  as if the Home music plays all the way through to the credits.
- No bell phrases over the swans at Home: not when the family arrives over the summit, not as they fly away. The
  wingbeats and the Home recording carry it.
- No synthesised completion or reward phrases over the recorded music: each room's recording, or the room's own
  physical sound, carries its conclusions.
- The sailing boat has no hull-water foley: its bursts sounded like flapping. Toy boats keep theirs.
- No child voice: "never any voicing from the two main characters". The cygnet's calls, which he later heard and
  liked ("The cygnet sounds great"), are the one exception (`docs/cygnet.md`).

## Room levels

Every piece sits near one reference, about −29 LUFS in its main section. Home measures −14.6 LUFS and uses −14.4 dB
gain; Birches (`red_door.ogg`, "The Red Door Opens", 238.9 s) measures −18.3 LUFS and uses −10.7 dB; the stairs song (`birches.ogg`, "A Question, Then a Gentle Answer", 224 s) measures −16.0 LUFS and uses −13 dB; the Sky Mirror measures −14.3 LUFS and uses −14.7 dB; the stairs' `clouds.ogg` measures
−14.5 LUFS over the 0–3:28 it plays and uses −14.5 dB; the drowned village's `village_approach.ogg` measures −15.2 LUFS
over the whole file but −19.3 LUFS over the 0–36.93 s it plays, and uses −9.7 dB; its goodbye (`belfry.ogg` from 7.97 s, then `belfry_ending.ogg`) measures
−18.0 LUFS over the 47.06 s it plays and uses −11 dB; the open sea's recording measures −15.4 LUFS
and uses −13.6 dB (its crossing −19.7, rescue phrases −19.1 and close −13.8 LUFS before trim); Lines measures −17 LUFS and uses −12 dB. Little Boats measures −16.7 LUFS
and uses −12.3 dB. Sleeping's lullaby (`sleeping.ogg`) measures −16.3 LUFS over the 0–63.7 s it plays and uses −12.7 dB;
its climb (`cygnet_brave.ogg`) measures −14.4 LUFS over its three parts whole (−15.3 with the climb theme stopped at
65.69 s) and uses −14 dB; its morning (`sleeping_morning.ogg`) measures −13.7 LUFS over the 11 s to its end that it
plays and uses −15 dB, level with the climb. Still measures −23.3 LUFS across its
phrases and rests and starts at −6 dB (`stillPhraseDb`). These trims preserve the source dynamics and encoded bytes.
Their dry route avoids adding reverb to an already mixed recording. `roomTrimDb`'s Home, Sky Mirror, Birches, drowned
village and Sleeping entries and their old score levels are historical, unused by recorded playback; the stairs song
needs no trim of its own, since its gain already puts it at the reference. Loudness is ffmpeg's `ebur128` integrated
measure over the whole file unless a stretch is given. With the experiment disabled, the opening grows about
5 dB with life (`openingPadRise`), keeping its quiet start. The grey
meadow and the wood stay quiet by design; the wood's drone keeps its original level (`woodDroneDb`
0; Wood, below). Add new rooms at the reference.

## Player feedback

**Cursor chimes play only in the forest** (Jeremy, 2026-10-15: "The only chapter that should ahve tone sounds from the players wind is the woods chapter.").
The still island keeps its wind sounds and authored story cues, with no chimes from gusts, updrafts or glider lift.
The first breeze and plane flight have no tune, and restoring its colour has no completion phrase.
The cygnet's story cues remain.
`forestWind` follows `story.name === 'wood'`.
This gate is independent of whatever music is still playing from a departed island. Outside it gusts, held
updrafts and glider-lift answers schedule no chimes, and sounding tails fade over `gestureTailRelease` (300 ms).
`scripted`, `silence` and an engaged piano (`pianoActive`) also suppress them. Checkpoint restoration derives the same
gate.

- Forest stroke chimes answer deliberate strokes only (Jeremy, 2026-10-17): the stroke as heard (its speed across
  the screen) must pass `forestChimeGust.on` (3) to sound and stays answered until it drops under `off` (1.5), so a
  drifting cursor (heard under about 1.2) never rings while a slow deliberate sweep (about 3.6) does. Updrafts and the caring voice keep `pointer.minLift` and `pointer.minGust`.
- Attacks sit on a 96-BPM grid with a minimum gap: `forestChimePulses`
  (six, 1.875 s) in the forest, about one note per stroke. Both notes of a glider
  answer obey the gap and reserve it against gusts and updrafts.
- Forest chimes sit `forestChimeDb` (−4 dB) under the other gesture chimes, beneath the owl, the cygnet and the
  thunder; the caring voice keeps `careChimeLevel`.
- **Forest chimes use the original low minor palette: the whole wood scale (MIDI 50–72), not filtered to the current
  chord.** Forest updrafts use D3–A3–D4–A4. These ring over the forest drone without tail filtering. Searching at
  the rescue ember uses the softer caring voice (`careChime*`).
- Where a gesture follows harmony, lift stays in MIDI 62–81 and strokes and glider answers stop at 86; notes query
  the harmony at their scheduled onset, including across chord and loop boundaries, and incompatible held notes fade
  over 300 ms at chord changes.
- Player gust, whistle and updraft noise use `playerWindDb` (−6 dB); grass rustle has its own
  `grassRustleDb` (−12 dB). These apply in every room and ease off as a stroke strengthens (`playerWindEase`: about −1 dB at half strength,
  −6 dB at full); their filter sweeps are scaled by `playerWindFilterRange`. The trim leaves the weather floor,
  ambient breeze, sea and rain unchanged.
- The player's wind is heard by the stroke's speed across the screen (`PointerInput.heard`), not the gust it makes on
  the ground, so the same gesture sounds alike over near ground and over far ground or sky. Jeremy (2026-10-17): "if i
  do the very same gestures near the bottom of the screen, it hardly makes a noise. That lower bound volume needs to be
  brought up, and the higher bound volume brought down." It reaches `strokeMost` (0.6) of a full gust at most, nearing
  it past `strokeSpan` (1.6) screen heights a second; held strokes count by the same pressed gain as the wind. A stroke
  across 0.4 of a 16:9 screen peaks the gust layer at about −30 dB in 0.9 s, −25 dB in 0.45 s and −23 dB in 0.22 s at any
  height. A story's gust front still sounds at its own
  strength. The wind itself and its gameplay are unchanged.
- Sleeping's night wind has its own noise voice, filter and slow pan (`nightGain`, `nightWhistleGain`, `nightPan`),
  never shared with the player's gust, so the player's wind stays audible over it: the night wind gives way under a
  stroke (by `nightWindUnder`, fully at `nightWindUnderAt` of a full gust) and the player's wind sits `nightPlayerDb`
  louder on the night hill. Its level is `nightWindSound` (`sleeping-wind.ts`, through `winterGust`): gust fronts and
  a capped roar (`nightWindMost`) grow with `climbExposure`, lull by `fogLull` while the fog has the window, swell
  once to answer the bird's call into the fog, and settle by `summitLull` at the summit, never louder than the
  summit's moment.
- `hush` attenuates only the background score, never the player's feedback.

The only synthesised phrases are the dark wood's, on its D/A drone: `kindled` (D4 A4 D5) as a coal takes and `comfort`
(D4 A4, the softer caring voice) as the rescue hearth is lit. They use fixed pitches and the bright bell voice,
independent of cursor harmony, and leave the accompaniment where it is. Every other cue is a physical or animal sound:
`flightHome` (the stairs' knock), `foghorn`, `hoot`, and the cygnet's and swans' `distress`, `calling`, `puzzled` and
`bugle`. The piano keeps its own musical response.

## Scores, room by room

**Still experiment (2026-10-11).** Jeremy's brief, verbatim:

> ok now try adding lines.ogg
>
> The other thing is, i have a still.ogg - and it has these musical phrases in sequence. I'd love to experiment with it playing each of those phrases everytime the paper plane flew, or everytime the player created wind that gave colour to the island (deduped ofcourse so that one phrase is playing at any time). You'd need to splice it up for that i think or something

Jeremy chose "Replace the continuous opening music", then clarified:

> but dont remove the music drone, just disable it. Remember, this is all experimentation.

`tuning.audio.stillPhraseExperiment` enables the experiment. Set it to `false` to restore the original drone
on the island and its crossing. Its score, voicings, timing and gain settings remain intact.
`still-phrases.ts` contains 14 provisional island sample ranges in the unchanged `assets/music/still.ogg`.
The island ranges follow measured quiet gaps through 1:56.90. The former crossing excerpt at 1:57–2:55.20 is
retained for experimentation; the current crossing uses the second recording described below.
The final excerpt ends at 175.20 s, before the extended quiet tail. These are experimental cut points requiring
listening review, not a claim of musically verified phrase boundaries. No re-encoding or duplicate audio assets.

Each new playable plane flight or recent wind patch with at least .025 measured colour growth requests the
next island excerpt, in file order, wrapping after the fourteenth. Starts are at least 4.5 seconds apart
(`stillPhraseSpacing`); the preceding excerpt's tail keeps playing. Requests within that spacing, while
loading, music-muted or scripted are dropped. Sustained wind may earn another excerpt after 4.5 seconds
if it continues adding colour. The readback checks the actual recent ground point for up to .8 s; world-life
averages and autonomous recovery without recent player wind cannot start music. Plane and colour in one frame
make one request. This spatial/temporal attribution is approximate: nearby spreading colour may contribute.
While the plane remains airborne, another motif starts six seconds after the last accepted motif start
(`stillFlightEvery`). A colour-triggered phrase resets that interval too, so the two triggers cannot pile up.
Landing or catching the plane stops the automatic requests, while existing tails finish naturally. Scripted
scenes, music mute and the post-bandage recording suppress them; the shared audio clock freezes during mute-all
and hidden pages. Jeremy's addition: "next, while the paper plane is flying, if another phrase could be played at a ~6 second timeout, then the next motif should be played. that solves the problem of a long paper plane flight having long period of silence."
Scripted story beats and departure fade all active excerpts; mute-all and hidden-page suspension freeze the shared clock.
The original drone stays disabled. Existing authored cues remain.

Jeremy's follow-up, verbatim:

> ok the still island music is beautiful now, one thing is, allow those spliced music clips to play ontop of one another if the last one has already played e.g. ~5 seconds. e.g. the next clip can play while the reverbe of the last clip is still going.

The horn passage from 2:00 on remains available in `StillPhrases.crossing`; the crossing plays `still_2.ogg` (below).
The starting file downloads alongside shader compilation and decodes after Begin, before play is revealed;
failed loads fall back to ambience, and gestures never queue. A decoded Still buffer is
about 69 MiB at 48 kHz and is released on exit. Playback uses the dry music route and honours music mute.

**After bandaging — current direction (2026-10-11).** Jeremy's brief, verbatim:

> the moment that the cygnet is bandaged and the child throws the paper plane, we should play `still_2.ogg` (the paper plane no longer players those sequences).
>
> Then, at a certain point we should fade in the "updraft" title as she's making the crossing over to the island of lines. In addition, just for your context, be prepared that we will likely have to move the still island out a bit further so that the crossing a bit longer to accomodate all this new emotive space, as well as the timing of when she sees the whale.

Title timing: "After the look back, before the whale". Further adjustment, verbatim:

> btw, when playing still_2.ogg, it should start at the second phrase that plays at 8 seconds, not the first phrase.

The first plane release in `leaving`, after the completed bandaging callback, starts the supplied `still_2.ogg`
at source second 8 (`stillDepartureOffset`). Its original bytes stay unchanged. It is 174.02 seconds long,
measures −14.9 LUFS, and uses −14.1 dB playback trim. It plays once, without a loop; subsequent throws and colour
cannot start motifs or restart it. Prefetch begins during island play; decoding begins on the walk to the tree.
The original Still buffer is retired there. The second recording uses the same source through boarding, farewell,
title and whale. It fades over source 1:54–1:58 and stops before the next phrase (`recordedMusicOnce.stillDeparture`); the independent source envelope survives ongoing level updates and pauses with audio.
The existing Lines fade/rest hands over to `lines.ogg`. If the recording ends before arrival, ambience
continues. Direct crossing starts begin this recording at second 8; the crossing entry save has no elapsed audio
position. A companion checkpoint prepares it behind the veil and waits for the next plane release.

The title uses slightly enlarged ending typography and a story-clock fade (`opening-title.ts`, `tuning.opening.title`):
thirteen seconds after the 21-second farewell, fade in for three, hold for two and a half, fade out for three
(34–42.5 seconds). It takes no input, pauses with story time, and disappears on leaving the crossing. The title is
independent of music mute. The first whale surfaces at 45 seconds, after the farewell camera has finished turning, and its
camera attention eases in and out over six seconds (`tuning.opening.crossing`). These are trial story-clock cues,
not sample-locked music cues: boarding time still determines which source phrase accompanies them.

Jeremy's 2026-10-11 timing and geography experiment, verbatim:

> do you think the "updraft" should actually start fading in when it currently fades out? in terms of the timing? i.e. have it align with the next musical phrase that it currently does. (i might be wrong about this so lets try it and if it doesn't work we can revert). The camera pan over to the whale is a bit too fast and rushed, maybe push the timing of that out a bit to the next phrase as well?
>
> And then i think we definitely need to move the whale and still island position back by atleast 30 seconds (don't change the boats speed). Then we can think about what other attractions we can add along the way.

He chose **“More sailing after the whale”**, measured at the ordinary breeze. Still and its first four departure
waypoints sit 200 units further south, leaving Lines fixed. The whale surfaces relative to the boat, so its encounter
moves with that departure. The ordinary crossing measures 117 seconds, about 72 of them sailing after the whale
appears. Boat speed settings were not changed for it. Geography revision 10 migrates older saves.

Jeremy's next fine-tuning brief, verbatim:

> - what do you think about the title timing? better or worse? I'm thinking we should either push the updraft title timing to appear halfway through it's current phrase instead of starting directly on it. If that doesn't work, we can revert the updraft timing back to your original one and then maybe figure out how to make it easier to see against the green grass in the background (maybe just slightly bigger font?)
> - also as a fine tune, we should end the play of `still_2.ogg` on ~1.58 faded out before it plays the next phrase
> - and lastly, as the child is sailing out to the island of lines, they shouldn't be able to see it until they get closer. Right now the fog / haze effect doesn't hide the island reveal until they get close (from afar you can see the island of lines as the camera pans over to the whale right now (they shouldn't be able to see it)

Title timing and Lines' concealment are set in the choreography refinement below.

**Preserved opening drone (experiment disabled).** `opening-score.ts` conducts the original four detuned pad voices through the approved 33 voicings,
5.3125 s apart (80% of the endorsed tempo), with a held D/F♯ resolution at 1:25; the 185.3125 s form repeats for
player pacing. It plays on the first island and its crossing (`openingScore`), follows a local audio clock, and the
Lines arrival retires it without letting it return. During the fall the `openingScore` phase holds the first chord
(D) while the skein passes. The fall and the touchdown have no phrase, only the swans' and the cygnet's own calls. The pad then fades to silence with the fall and stays silent through the rescue, leaving calls, wind and sea;
when the child carries the bird away the piece begins again from its first chord (`openingReturn`). Render it with
`node tools/opening-fall-render.mjs <out.wav>`.

**Lines.** The unchanged `assets/music/lines.ogg` plays continuously at native speed through the three
curtains, family, door, shore and departure crossing, looping if needed. Arrival and exit retain the shared
fade/rest gates. Story phase changes do not seek, restart, or add generated notes. The original `lines-score.ts`
and its tuning remain as historical material; its reed trimming and section changes are inactive.

**Little Boats.** Jeremy's 2026-10-11 instruction: "wire up boats.ogg". The unchanged `assets/music/boats.ogg`
plays at native speed from the approach handoff, through the island and across the crossing to Meadow. It loops
for a lingering player, uses the dry music route and the shared arrival/exit fades, and honours music mute and
hidden-page suspension. Its own recorded dynamics replace the old per-cue score trim; authored cues retain their
shared accompaniment duck. The original `little-boats-score.ts` and its tuning remain available for studies.
The decoded recording is about 43 MiB at 48 kHz; exit releases it.
The reveal has no completion sound (Jeremy, 2026-10-12): the supplied recording carries the conclusion.

**Meadow and the piano.** The meadow's sound is wind instruments with the piano, never chamber strings (Jeremy,
2026-10-15: "this chapter is all about wind instruments"). It plays cuts of four supplied takes in one key (F minor
turning to A♭ major) that share the duet's tune, named in `MEADOW_SOURCES`: O, the original Sleeping Meadow, whose
sad opening Jeremy loves; B, the take whose phrases are cut into her answers; E, the warmest take, as Jeremy extended
it; and the solo flute, which belongs to the duet alone (Jeremy: "i think it should be used only for the piano
puzzle"). `audio/meadow-cuts.ts` is the one table of cuts per beat; `node tools/meadow-music-cuts.mjs` (SOURCES=<folder of the
takes>) cuts them from the takes into `meadow-walk.ogg`, `meadow-duet.ogg` (calls, answers and finale packed
with 0.25 s gaps) and `meadow-after.ogg` (the warm bed and its close; Ogg Opus, 48 kHz stereo, 20 ms edges unless a
tail fade is given), levels each to the room reference by measured loudness, and writes what it measured to
`audio/meadow-cuts-measured.ts`. Swapping a take or a cut is an edit to the table and a rerun.

- Landing to the stool: the walk (O 0–27.2) loops with 3 s rests. It arrives through the ordinary handoff from Little
  Boats and begins once the background gate is open, so its first note is not under the gate's rise; sitting fades it
  over `tuning.piano.fadeOut` (`pianoMix`), and it is released.
- The duet: the bough's four flute calls, her four piano answers and the flute finale are the
  instruments' own voices, on the instrument route (sound-off silences them, music-off does not). Nothing sounds from
  the piano before the bough's first call. Each call starts with the bough's inhale so its first breath lands as the
  inhale ends; reply input opens after the flute's measured end. With no answer begun `callAgainAfter` (25 s) later
  the bough says the call once more, `callAgainDb` (−4 dB) softer, and then stays silent. Following the guide far
  enough plays the answer whole at its own tempo; her hands and the keys follow its measured onsets and melody notes,
  and stroke speed changes nothing. The straight guides tilt with the answer's overall rise or fall (`tilt`).
- The answers ring out. Take B plays its phrases straight on, pedal down, so each answer keeps the take up to 60 ms
  before the next phrase's attack (`ringOut`; the tool checks nothing of the attack reaches it) and there crossfades,
  over the last 0.34 s it measured, into the ring of its own sound: its partials, each at a frequency taken from the
  channels' mid so the image holds and nothing beats that did not, and the noise under them, falling at the decay B
  measures between its phrases (the median of its four gaps, 3.9 dB a second, RT60 15 s) down to the take's own
  silence (−80 dBFS), with a last second's fade. Each rings 7.6–8.9 s past the handover. `end` is the handover: the
  next call waits for it and for `phraseRest` after the answer began, and the finale follows the last by
  `finalRest`; the ring carries on, softly, under them. The first call is held into the flute take's next phrase, so it
  ends over its last 1.4 s (`release`) as the take's own seven phrase endings into silence do (their median level
  curve), and fades over its last 0.3 s. The other calls and the finale already end in the take's silence. Under the finale's held close the flute
  take swells a synth drone no instrument plays (43.1 Hz with its partials, from 1:53), already rising under the first
  call's end: both are high-passed at 160 Hz, under their lowest note (C4), and the finale notched at its 215.3 Hz partial. Until the duet file is decoded the piano strings
  play the melody notes instead. The finale's colour front starts on the measured top of its opening arpeggio
  (`MEADOW_FINALE.greenAt`); the flute carries it alone, with nothing from the piano under it. Its
  end has no completion sound: the flute's finale is the reward.
- One warm bed from the duet to the boat, with no music of the feather's own and no silence for the family (Jeremy,
  2026-10-16: "I'm not convinced that the music should stop so soon and so abruptly"). From the duet's end it swells in over `afterFadeIn` (6 s) and plays
  unbroken through the flowers, the seeds, the listening rest, the pond, the family's departure, the feather, the
  shower and the walk to the boat, from `meadow_extended.ogg` (take E as Jeremy extended it): 0:22.60 to 2:53.05,
  then round from 1:36.60 with no rest, as a native loop (`loopStart`/`loopEnd`). The cut's last 0.6 s carries the
  source's lead into 1:36.60 under its own end (an equal-power crossfade baked in by the tool), so the seam continues
  the phrase; the tool's seam check measures it against the source's own continuation there.
- Room for the family. From the listening rest, whose distant call draws her to the crest, until the family has flown
  out of sight over the pond (`swans`), the bed sits `swanDipDb` (−4 dB) lower, easing down over `swanDipIn` (3 s)
  and back up over `swanDipOut` (6 s), so it is up again as the feather comes down. After the family (`boat`) a bed
  begun afresh, as on a `pond` restore, starts at 1:36.60 rather than at its opening.
- The meadow ends on its own music. At the push off (`onward`, which the crossing carries on) the bed stops looping:
  at its next phrase end into the close (`seams`: the bed's recurring cadence, wherever its chord and level over the
  crossfade, and its chord over the second before, match the take's own lead into 3:43.60; mostly 3–12 s apart, the
  longest wait 23.8 s) it crossfades over 0.6 s, equal power, into 3:43.60 and plays the take's final cadence and soft
  close (7.2 s, to 3:50.80, its last 2 s faded as the chord dies away: from 3:50.8 the take swells into a low synth
  rumble, 20–180 Hz, a generation artefact that is no part of the music). The tool measures
  each way in against the take's own continuation there. Birches' arrival handoff waits for that end
  (`meadowMusic.closesAt`, held like a once-played recording: no fade of its own), then rests `arrivalQuiet` and fades
  in, so the two never sound together and the meadow is not cut. Typically the close ends about 8 s into the 47 s
  crossing and Birches comes in at its approach (26 s); at worst about 31 s in, 16 s before landing. A start on the
  crossing itself has no bed and is quiet until Birches. `node tools/meadow-bed-render.mjs` renders the whole run
  from the duet's end to Birches through the game's sound (LISTEN, GONE and PUSH set the story's times).
- `MeadowChapter.meadowMusic` names the part; `audio/meadow-music.ts` plays it. The shared pad is silent in the meadow
  (`MOODS.meadow.level` 0) and the synthesised `MeadowScore` does not play; `meadowScore` remains story state.
  `hush` does not apply. Files are fetched ahead in Little Boats and on the crossing (walk, duet) and during the duet
  (warm bed), decoded as their part nears and released once played: the walk as she sits, the duet as the warm bed
  begins, the warm bed once its close has played. A start or restore in the meadow waits behind the veil for its first
  part. Music mute and hidden pages behave as for the other recordings. Decoded sizes: walk 10 MiB, duet 44 MiB, warm
  bed with its close 63 MiB, so the duet holds about 107 MiB once the walk is released.

The flower bed, the seed heads and the harebells make no notes (Jeremy, 2026-10-16: "None of the flower challenges
should make that bell sound anymore. It no loner fits with the meadow music"; "the bluebells should go quiet as well");
they answer with sight and the ordinary sound of the wind. `MeadowSong` smoothly shares the existing
`pianoMix` gate while the child and wind exchange seeds, then releases it; the warm bed ignores that duck.

**Birches.** The room plays "The Red Door Opens", and `birches.ogg` ("A Question, Then a Gentle Answer") is the
stairs song under the cloud (the stairs, below). Jeremy (2026-10-15):

> yea the red door opens, and yep makes sense to make birches the song under the stairs i guess (we can try this)

How it plays out and the silence in the cloud, Jeremy (2026-10-14/15):

> my thinking for birches is the logic can be pretty simple. if on birches island, loop, else don't loop and let it finish up. And then on the stairs chapter, just have a hard stop for silence if it's still somehow playing before they enter the clouds and start the penrose stairs sequence.

> My feeling is that there should be silence as they enter the cloud and do the penrose puzzle up until the nest. it builds up a climax i think? And it kinda fits the idea of them being in the clouds (a place they aren't normally supposed to be, so theres no music which makes it feel slightly more awkward)

`assets/music/red_door.ogg` (a copy of "The Red Door Opens") plays from the approach crossing through boarding. The
`walk`, `swing`, `scarf` and `return` phases describe story progress and checkpoint state, but never seek, restart or
rearrange the recording. It loops only while the story is on the Birches island or its approach (`toBirches`,
`birches`: `SoundState.birchesLoop`) and begins only there. Jeremy (2026-10-15):

> the birches island music should start 2-3 seconds later than it currently does, and it should fade in a bit more.

> when the music loops on the birches island, it needs to have a better fade in.

Jeremy (2026-10-16):

> The start of the birches music should coincide with the camera panning to reveal it, so it needs to start a bit earlier now.

> There's too much of a pause in between the looping of the birches music, reduce it by atleast 3 seconds.

On the meadow sail it enters 3 s into the lens's swing round to reveal the island: the birches' `IslandReveal`
carries `music: 3`, the seconds after the reveal starts (`revealing` above 0) that the crossing is ready for it, not
as the shore nears. The meadow's music is asked to leave early enough that its longest phrase wait, fade and quiet
(`arrivalPhraseWait` + `arrivalFadeOut` + `arrivalQuiet`, 10.5 s at the boat's speed) all fall before the reveal. It
fades in on a 1.63 s time constant (`recordedMusicFadeIn`: about 0.46 of full at 1 s, 0.71 at 2 s, 0.95 at 4.9 s),
rising with the swing. With no input from `?chapter=toBirches` (crossing clock): the meadow fades 5.4–8.4 s, sea and wind
until the reveal begins at 17.9 s, Red Door from 20.9 s, the lens visibly turning from about 19.5 s and settled
at 27.8 s, landing at 38.8 s.

Going round, the song is never butted end to start: each pass plays to its natural end, rests
`recordedMusicLoop.birches.rest` (0.3 s) with only the room's world sounds, and begins again from its top with the same
entrance. The recording's last chord dies away over its final seconds, so the pause heard is longer than the rest:
measured on the render (`music-transition-audit.mjs`, `birches-seam`, 50 ms windows within 30 dB of the piece's average
as played), the last audible sound falls 2.7 s before the end of the file and the next pass is audible 0.17 s after it
begins, a 3.25 s pause. The decoded recording is held through the rest and released once the loop is
over (play-out, stop or leaving). Once they have sailed (`toStairs`) it stops looping (`RecordedScore.playOut`) and
the pass under way plays out; sailing during a rest, nothing more plays. A `toStairs` start is quiet until the stairs
song. The
crossing says how soon the stairs song can come in (`arrivalIn`: the distance to the handoff's entrance over the
boat's speed now). Once that is `stairsSongRest` + `birchesSailFade` (15 s) or less, a pass that would still sound
`stairsSongRest` (10 s) before it fades over `birchesSailFade` (5 s) to end then; a pass ending sooner simply ends.
The gap is sea, wind and the boat. The boat gathers way after the estimate is made, and gusts can drive it on, so
the stairs song also waits until `stairsSongRest` after the birches were last heard. With no input, timed from the
push-off: aboard 2.8 s, the fade 22.2–27.2 s, the handoff asked for at 29.1 and ready at 36.9, the stairs song from
37.2 s (held 0.3 s for the rest), the landing 45.8 s. A pass ending by itself before the rest leaves the song on
the handoff (36.9 s).

**Drowned Village.** Jeremy (2026-10-14/15), verbatim:

> I'm thinking we use the first bit of village_approach.ogg? and then let it be silent while they do the challenges, then we can figure out another song to play during the cat farewell sequence maybe.

> Have a go with the village_approach with the 37.5 second idea. The bellfry sound can stay, to me that is a sound effect.

> I do think the storm and the woods shouldn't have any music. Woods can have a very quiet background drone (maybe?), but even that might not work.

The unchanged `assets/music/village_approach.ogg` (192.9 s, A minor) plays once on the dry music route, from its top
to the seam at 36.93 s (`recordedMusicOnce.villageApproach`), fading over its last 0.5 s. The seam is measured on the
decoded samples: the bass enters at 36.96 s (an A2 attack, rising about 15 dB within 130 ms); over the 0.3 s before it
the last note has rung down to about 14 dB under the opening's median level, and the seam sits 30 ms before the attack.
It begins where the village's music begins: once the stairs' fog has waited out `clouds.ogg`, after the ordinary 3 s
rest, from its first second at full level (`villageArrivalFadeIn` 0: the file opens on 0.2 s of silence and then its
loudest note, which the ordinary fade-in would swallow). `?chapter=drowned` starts it with the chapter. It keeps its
own audio clock from there: landing and the village's beats and phases never seek or restart it, music switched on
later joins at its own time, and after the seam nothing plays. The rescue's quiet (`drownedQuiet`) lets it go early, for
good, over `drowned.rescue.musicFade`, so the air dies in silence. Later starts and saves (`sail`, `roofs`,
`church`, `belfry`, `storm`) never play it.

After it there is no music through the rescue, the becalming, the fog, the run, the refuge and the bell until the
goodbye below. The generic pad stays silent throughout the village and the storm, so nothing fills the quiet. The
sound effects stay: the bell's strikes (foley), the foghorn, the cat, the herons, the weather and the physical sounds.
No musical cue marks the air dying: Jeremy (2026-10-15), "oh, yea the becalming tone needs to go doesn't it".
The air itself falls nearly silent as it dies: Jeremy (2026-10-17), "When the becalming starts, I think the ambient
wind sound needs to go more silent". Through the still beats (the air dying to the church, until the bell's breeze
carries the boat) the story's `calm` eases to 1 at `calmEase` and back as the storm gathers; the ambient breeze falls
by `calmBreeze` (about −26 dB) and the sea's wash by `calmSea` (−8 dB, quiet lapping). The player's own wind stays.

Measured with no input on the game clock (`tools/village-music-browser-check.mjs`, at 60 fps, the audio clock in step):
from `?chapter=drowned` it starts with the chapter and ends at 36.9 s; the boat holds and the tub becomes the player's
to push (`StrandedCat` `waiting`) at 33.0 s, while the cat is still coming down the slates, and the tub's drawn
invitation appears at 46.6 s. From `?chapter=cloud` (the real handoff) `clouds.ogg` ends 227.1 s in and the recording
starts 3 s later, 5.6 s before the village chapter itself (the boat still coming down through the fog); it ends 31.3 s
into the chapter, 0.3 s after the tub becomes pushable (31.0 s) and 13 s before the first invitation (44.6 s). The
cut point is Jeremy's to move.

**The belfry's goodbye.** Jeremy (2026-10-15), verbatim: "ok best i think i can do is belfry.ogg, starting from 8
seconds 54 seconds - and fades in slowly after the last bell plays". A short bittersweet goodbye that "blends easily
into the storm that follows". On its end, verbatim: "yea. And the ending of that cut up piece is a bit harsh as well..
I'm wondering if you can do a progressive slow down a little bit for those last 2-3 or so seconds if you know what i
mean, so it feels more like it's coming to an ending note." Of three time-stretched studies he chose, verbatim: "(B) is
best". The unchanged `assets/music/belfry.ogg` (143.9 s) plays once on the dry music route from 7.97 s, just before
the attack at 8.0 s (a low note under a sustained texture, checked below 250 Hz on the decoded samples). At 50.24 s, in
the quiet just before the attack at 50.275 s, it crossfades linearly over 30 ms into the derived
`assets/music/belfry_ending.ogg`, started on the audio clock against the recording's position
(`recordedMusicOnce.belfry.ending`); there the two are the same passage, sample-aligned. The ending is study B:
`belfry.ogg` 46.0–54.05 s stretched with pitch preserved, `rubberband -q -3 --timemap <map> -D 9.0315`, the map (a frame
pair every 50 ms) the identity to 51.05 s, then easing the tempo linearly to 0.55× over the last 3 s of source, which
become 3.98 s; a 2.5 s quarter-sine fade (`afade` `qsin`) is baked in to its last sample; Opus at 128 kb/s. The piece
so ends at 55.03 s on the recording's time line, 47.06 s after it begins. It measures −18.0 LUFS over what it plays and
uses −11 dB. It begins on the bell's fourth ring (`DrownedChapter.bellsRung`;
the 90 s gust's ring counts), coming in from silence over `enterOver` (5 s), and keeps its own audio clock: sailing the
boat round, climbing down, boarding, the look back and the cat's slow blink never cut it, and the storm's start does not
stop it; it plays on into the storm to its own end fade and never restarts. The storm is otherwise silent. It is
decoded once she is in the belfry (`drownedScore` `refuge`/`home`) and prefetched in the village after the approach.
`?chapter=belfry` plays it after the fourth ring; a `storm` save is past the bells, so it starts on load from 7.97 s
with the same slow entrance; the wood never plays it. Music switched on later joins at its own time. Its key reads as
D♭ major / F minor, a long way from the bell's B strike (`note` 59).

Measured with gestures ringing the bell and no input after (`village-music-browser-check.mjs belfry`, game clock from
the fourth ring): it starts with the ring and is at full level at 5 s; she starts down at 4.5 s, steps aboard at 27.5 s
and is seated at 30.3 s; the storm begins at 40.9 s; the ending takes over at 42.3 s, slows from 43.1 s, fades from
44.6 s and ends at 47.1 s, about 6 s into the storm. From a `storm` save it starts on load, the storm begins at 10.6 s
and the piece ends at 47.1 s.

`drowned-score.ts` (the earlier synthesised drift, fog, refuge, home, farewell and storm) remains for studies:
`node tools/drowned-music-study.mjs [outDir]` renders it through the game's sound. `tools/village-music-check.mjs`
checks both recordings' seams, starts, levels, ends, restores and the quiet between them offline;
`tools/drowned-audio-regression-check.mjs` the rescue's quiet, the silent becalming and the storm without the goodbye.

**Sky Mirror.** Jeremy's 2026-10-14 instruction: "mirror.ogg is confirmed for mirror chapter."
The unchanged `assets/music/mirror.ogg` plays at native speed from the arrival handoff off the dolphin crossing through
the stars, the gathering and boarding, looping for a lingering player, on the dry music route with music mute and
hidden-page suspension. The `approach`, `search`, `one` to `three`, `constellation` and `depart` phases still describe
story progress and checkpoint state (completed-star count, not order, picks them), but never restart or rearrange the
recording. `star` is emitted once per real return, never on entry, loops or restore, and adds no music. Leaving the
Mirror plays the recording on to a phrase seam chosen against Home's scheduled start (Homeward and Home below).
`MIRROR_SEAMS` (`mirror-seams.ts`) lists the recording's stopping points, measured on the decoded samples: 30 ms
before each attack whose last 0.3 s averages at least 5 dB under the piece's median level (−18 dB RMS), with the level
falling into the rest and the next attack rising at least 9 dB out of it; attacks under 2 s apart keep the first (the
opening phrase's single notes are not seams). The rests come every 2–5 s in the sparse opening and every 4–18 s
through the fuller middle; the loop point is a seam too (0.32 s, the first note after the piece rings out to silence).

**Wood.** Jeremy (2026-10-15), verbatim: "I do think the storm and the woods shouldn't have any music. Woods can have
a very quiet background drone (maybe?), but even that might not work." The storm has no music of its own; only the
belfry's goodbye carries on into its first seconds (Drowned Village, above).
The wood keeps its original low drone, the shared detuned pad in the wood's mood (`MOODS.wood`: D–A–D–A over low D,
turning to D–A–D♯–A♯ and back every 15 s, low-passed near 440 Hz), at its original level: Jeremy tried it 10 dB
down and asked for it back (2026-10-15, "please revert the -10db to the woods drone"). `woodDroneDb` (0) trims it;
−Infinity silences it. It enters as the boat nears the forest beach after the plane is lost, over
`forestMusicBlend` (4 s) with the gates open, tuned on D/A before it is heard, and carries on through the wood and the
crossing to Sleeping. Ordinary embers cue `kindled`; lighting the rescue hearth cues `comfort`; both, and the forest's
gesture chimes, keep their level.

**Sleeping.** Jeremy (2026-10-15), verbatim:

> I figured out what i want to do for the sleeping island. I've labelled it sleeping.ogg. I'm thinking we need to do sleeping.ogg and cygnet_brave.ogg for the cygnet's sequence. With an appropriate period of no music between the two clips when the frost comes in. do you get what i mean? Have a think and see if it makes sense and how you would do it.

> Figure out the right implementation for the sleeping timings. I'm giving you creative ownership. I'll review at the end and provide feedback

Claude holds creative ownership of these timings (2026-10-15). Three unchanged recordings play on the dry music route
(`sleeping-music.ts`, `SleepingMusic`), each once, at their own dynamics: music mute (their clocks run on), hidden-page
suspension, exit fades and permanent silence apply; `hush` does not, and the generic pad is silent throughout. They
follow `SleepingChapter.sleepingMusic`, the furthest gate reached: `bedtime`, `asleep`, `feather` (the pillow feather
freed), `mist` (the fog closes over the bird), `catch` (it takes the feather in its bill), `summit` (it reaches the top
and unwinds its bandage: `unbinding`), `ribbon` (`ribbonLead`, 1 s, before the bandage comes free, about 2.3 s before
the bird turns to face the ribbon, and on through `hilltop`, the leap and the tug) and `glide` (the ribbon released as the curtains begin to part, a moment before the bird leaves the top). `sleepingScore` remains the story phase the handoffs and
gestures read.

- **The lullaby.** `sleeping.ogg` ("A Tune for the Sleeping Meadow", 143.6 s, A minor) enters through the wood's
  handoff (its 3.5 s rest), from its top at full level (`sleepingArrivalFadeIn` 0: it opens on near-silence and a soft
  note), and plays once to `LULLABY_END`, 63.7 s, fading over its last 0.4 s: measured on the decoded samples, the note
  attacked at 60.8 s has rung down to −47 dB when the next attacks at 63.73 s. The second half is unused.
  `?chapter=sleeping` plays it from load.
- **The frost waits for it.** Winter (the frost, the cold, the bird's three tries, its call, the window's light and the
  pillow feather) is held, before the first try, until the frost can come `frostRest` (1.5 s) after the lullaby ends,
  for at most `frostWaitMost` (12 s) past `asleep` + `winterBeginsAt` (`winterHold`; the sound tells the chapter the
  lullaby's time left each frame through `hearLullaby`). With no lullaby sounding (no audio, music off) there is no wait.
  If its end lies beyond that bound when she falls asleep, it ends at its next seam at least `mirrorSeamSoonest` (0.3 s)
  ahead, fading over up to `mirrorSeamRelease` (1.2 s) into it. `LULLABY_SEAMS`, measured as `MIRROR_SEAMS` were (30 ms
  before an attack out of a rest at least 5 dB under the median, not rising into it, the attack's loudest 50 ms at least
  9 dB over it; attacks under 2 s apart keep the first): .77, 3.97, 6.21, 9.94, 11.96, 15.57, 17.68, 20.35, 23.13,
  28.22, 33.58, 38.69, 41.36, 44.32, 52.76, 56.88, 63.7.
- **Silence** from the lullaby's end through the frost, the tries, the unanswered call, the window and the feather on
  the quilt, until the player's stroke frees it; the wind, hearth, clock and foley carry on.
- **The climb.** `cygnet_brave.ogg` ("Fragments for a Swan Who Stayed", 174.2 s, C minor / A♭) in three parts back to
  back in the recording (`BRAVE_PARTS`), each from 30 ms before the attack after one of its clean rests: the climb
  theme 0–96.27 s as the feather is freed (its quiet opening carries the bird watching, hopping down and looking back);
  the sparse commitment 96.27–112.11 at `catch`; the summit 112.11–153.18 at `summit`. The two-phrase coda after it is
  unused. Jeremy (2026-10-16), verbatim: "the summit music needs to start like a second later and have a bit more of a
  fade in too." Begun on its own, the summit part starts `summitDelay` (1 s) after the bird reaches the top and rises
  over `summitFadeIn` (1.5 s); following on from the commitment it carries the recording on unbroken. When the fog closes the climb theme ends at its next seam (0.3 s ahead, over up to
  1.2 s) if one comes within `fogSeamWithin` (6 s), or else fades over `fogFade` (3 s), so the fog never carries the
  full theme into the bird's call (the rebuilt climb's prompt fog closes about 68.5 s in, 12 s short of a seam); otherwise it ends at 96.27 s and never runs into the sparse section. `BRAVE_SEAMS`: .84, 4.08, 6.13, 8.18,
  16.1, 24.02, 27.63, 49.96, 57.86, 65.69, 80.5, 92.67, 96.27, 104.18, 112.11, 126.67, 153.18, 157.15, 161.24 (there is
  none between 65.69 and 80.5, nor 80.5 and 92.67, where the theme is full).
- **Silence at the ribbon.** Jeremy (2026-10-16), verbatim:

  > ok i think there just needs to be a bit of silence as a musical palate cleanse at the ribbon sequence, so it focuses on the cygnet all alone at the top before it jumps. understand what i mean?

  And, verbatim: "it needs to fade to silence over like 3 seconds when the bandage comes free, so shift the fade out
  start back by like 1 second".

  The unwinding keeps its music; `ribbonLead` (1 s) before the bandage comes free (`ribbon`) the climb part sounding
  ends at its next seam at least `mirrorSeamSoonest` (0.3 s) ahead if one comes within `ribbonSeamWithin` (1.5 s),
  fading over up to `mirrorSeamRelease` (1.2 s) into it, or else fades over `ribbonFade` (3 s), and no part of the climb's recording
  begins after it: a part waiting, or a summit part not yet begun, never plays. The music lets go as the bandage falls
  away, so the bird faces the ribbon in silence before it leaps; wind and foley alone carry the turn, the circles, the
  leap and the tug until the curtains.
- **The morning.** Jeremy (2026-10-16), verbatim, of a piece for the curtains opening and the cygnet gliding down:

  > ok i figured it out, use the colour returns to the meadow song, and start it on the second phrase at around 11 seconds. When you do that, the next phrase lines up perfectly with the child waking up out of bed.

  `sleeping_morning.ogg` ("Colour Returns to the Meadow", 123.7 s, A minor) starts the moment the ribbon is released
  (`glide`), from `MORNING_FROM`, 11 s: the last second of the rest before its second phrase (the 12.02 s seam), which
  is what lands its third phrase (the 23.62 s seam) on the bird's landing and the child waking. It plays once to its end,
  through the glide, the waking and the lap, until the departure hands off to the sea, fading over
  `sleepingDepartureFade` (4 s) as the boat leaves (Jeremy, 2026-10-16: "The colour returns to the meadow song needs a
  slightly longer fade out as well"). It enters out of the silence at the ribbon and never waits: should a climb part
  still sound (the curtains reached with no `ribbon` gate), it gives way as the morning starts, ending at its next
  seam if one comes within `mirrorSeamRelease` (1.2 s), or else fading over `curtainsFade` (1.5 s), and a part waiting
  to follow it is passed over. `MORNING_SEAMS`, measured as the others:
  1.75, 5.47, 12.02, 16.46, 23.62, 27.8, 31.81, 35.67, 38.26, 41.39, 50.93, 61.1, 69.02, 72.91, 75.81, 79.37, 89.25,
  99.58, 109.68, 118.83.
- **Queueing** (Jeremy's ruling: phrases never overlap and are never cut or faded early). A part reached while another
  sounds starts as that one ends, placed a second ahead; where it follows on in the recording the earlier part's end
  fade is dropped, so the recording runs on unbroken. A later gate reached before a waiting part begins plays instead
  of it. Parts never replay. A slow player hears the piece's rests and then the wind until the next gate. The bandage
  freed and the curtains are the exceptions: the climb lets go with the bandage, and the morning starts at its gate,
  the climb giving way to it (above). The morning hands off to the sea as below, whatever is or is not still sounding.
- **Restores.** The `feather` save resumes the climb (beat `climb`) with the climb theme from its top; the `morning`
  save is silent until the sea and decodes none of the three. Any start or music switched on past a gate stays silent
  until the next, except bedtime (the lullaby) and the freed feather (the climb theme); once the bandage is
  freed, until the curtains; past the curtains, until the sea. The QA start `?chapter=ribbon`, a step below the top
  with the feather caught, plays the summit part a second after the bird reaches the top, the silence from the
  bandage freed and the morning at the curtains.
- **Cues.** Sleeping raises no phrases: the climb theme's entrance is the feather's sound, the summit part the bird's arrival at the top and the morning its flight. Landing adds no completion phrase.
- **Loading.** The wood and the crossing from it prefetch the lullaby, decoded at the wood's handoff; bedtime prefetches
  the climb, decoded from `asleep`; the freed feather prefetches the morning, decoded from `catch`, so it is in hand well
  before the curtains; the sea prefetches from the summit. Each buffer is released when its last part ends, or on
  exit.

Measured in the game with no input from `?chapter=toSleeping`, then prompt gestures
(`sleeping-music-browser-check.mjs climb`, audio clock, seconds from the crossing's start; the game clock within 0.05 s):
the arrival is asked for at 12.5, the lullaby plays 19.2–82.9, she lands at 29.6, goes to bed at 37.4, tucks in at 56.9
and is asleep at 84.7; the frost at 86.8 (no wait: 3.9 s after the lullaby), the tries at 85.9, 89.1 and 92.3, the
call at 95.5, the feather offered at 106.5 and freed at 109.4, the background silent between. From the `feather` save
through the rebuilt climb: the fog closes at +68.5 with no seam within 6 s, so the climb theme fades out by +71.5; the
commitment at the catch, +81.5; the summit part at +97.4 as the commitment ends (top +95.2), unbroken. From
`?chapter=ribbon` (`sleeping-music-browser-check.mjs ribbon`, prompt circles 2 s after the turn), measured from the
release: the top at −20.0, the summit part from −19.0, rising in; the `ribbon` gate at −8.9, a second before the bandage
comes free, where it fades out by −5.9 (125.09 s in); the turn at −6.6; the leap at −3.6, 2.3 s into the silence, the
tug at −1.6, and the morning at the release, 5.9 s of silence before it. Then the 16.46 s seam at +5.5, the 23.62 s seam at +12.6, the landing (`waking`)
at +12.7, her eyes open at +14.9 and she sits up from +16.3; boarding at +54.2 fades the morning out by +58.2, and the
sea's recording begins 6.3 s into the passage, 2.3 s after the morning stops, the gates open. From `?chapter=sleeping` she sleeps 49.2 s in: the lullaby ends at its 52.76 s seam
and the frost waits 3.2 s. `sleeping-music-check.mjs` prints the same timeline offline for main's former climb, the
rebuilt climb and a slow player.

`sleeping-score.ts` (the former synthesised shelter, climb, summit and morning) remains for studies;
`PianoStrings.note` optionally takes an audio-clock time and returns its sources so it can release them; its ten voice
reservations belong to the AudioContext, survive mute and are cleared only when a new context is installed.

**The long sea crossing.** Jeremy chose the supplied "Another Shore" for the open sea (2026-10-14), verbatim:

> i think you're right about using another shore for the sea. timed so that 55 seconds is when the boat settles infront of the whale and the start of the puzzle begins. in terms of what accompanying phrases we play each time the child does something e.g. lifts off the nets im not sure though.

He agreed the phrase plan below and asked for it in the game: "yea in terms of the another shore at sea, i was thinking of doing something like that. thanks could you actually wire it up so i can test it on the dev server?"

`assets/music/sea.ogg` is that recording unchanged (236.6 s, F♯ major). `sea-music.ts` (`SeaMusic`) plays it on the
dry music route from the crossing's own clock (`CrossingChapter.seaMusicTime`): it begins `tuning.audio.seaMusicLead`
(6.3) seconds into the passage, so that its second 55, in the near-silent break before the bass enters, falls as the
boat comes to rest beside the whale and the rescue begins (measured with no input; boat speed at sea is story-only,
so `tools/sea-music-browser-check.mjs` re-measures it after any change to the passage). Cut points, each just before
the next attack: the crossing 0–56.43; the rescue's four two-bar phrases of the high section after the bass, back to
back in the recording, 129.93–136.3, 136.3–143.1, 143.1–150 and 150–159.47, each fading over its last 0.4 s when it
plays alone; the close 159.47 to the end. The bass section between the crossing and the rescue phrases is unused.

After testing, Jeremy (2026-10-14): "after it ends at that natural seam, it keeps playing instead of there being
silence", and "the phrases that play on each net lift need to be polished up a bit, some of the phrases are a bit long
so they overlap with each other if the player completes them quickly. But I think it's directionally right, and the
phrase that it ends on with the last one with the cygnet lifting the net is very nice." Then: "i dont think a new
phrase shoudl fade out an old one, we'd lose musical cohesion. If it really becomes an issue, we shoudl think about
pacing the puzzles themselves".

Then (2026-10-14): "in sea.ogg, you know how there's a set of phrases from about 2:09 onwards? They are sort of like
very regular higher pitched piano phrases that sound very much like the wind. I think they can be used for the whale
puzzle sequences. And then the built up theme at 2:39 onwards can play when the puzzle is completed."

Playtesting the version that cued half-phrases on completed steps, Jeremy (2026-10-14): "1) the phrase should probably
play the moment the net starts to lift, not when it's already in the sky and about to fly off. 2) Same with the net on
the eye, it's currently too delayed. Both phrases for 1 and 2 are too short, it sounds like a phrase got cut in two.
3) when the child starts holding the line, it shouldn't play a phrase. It should only start playing when the child
starts pulling it in. 4) same for the cygnet (and the last phrase that was playing before doesn't play anymore....)"

The crossing plays to the break and ends there; nothing plays as the boat comes to rest (`NetWhale.phrase` 0, the
`whale-rest` checkpoint). There is no continuous bed during the rescue: one whole phrase plays as each physical act
begins (`NetWhale.phrase` rises once per act and never falls). The first as the net over the blowhole first visibly
lifts (`net.lift` 0.05, under the player's circles or the valve's dolphin, with the first rope-and-cork sound); the
second as the fold over its eye first lifts under a sweep or the valve's dolphin; nothing as strokes bring the cork or
she takes the line; the third as she makes her first pull on it; the fourth as the cygnet, holding the loop's end,
starts to pull it off the lifted flipper (`bird` `pulling`). The release (`free`: the loop gone and the cygnet back in
the satchel as the whale's farewell begins) plays the close continuously through the spout, song, flipper wave and
flukes and the sail on to the Mirror, where the ordinary arrival handoff fades it for `mirror.ogg`; if it ends first,
it ends. Phrases play in order, never overlap and are never cut or faded early: an act begun while one still sounds
waits for it, and because each phrase follows the last in the recording, the waiting one starts at the sample where
the last ends with the last one's fade dropped, so a quick rescue plays the recording unbroken from 129.93 through the
close. If the waits become noticeable, pace the rescue rather than the music.
The release has no completion sound: as in Little Boats, the recording carries the conclusion.

Restores and QA starts: `?chapter=sea` / `dolphins` begin the whole passage with the recording; a resumed passage
joins the crossing at its own time. `?chapter=whale` and a restored `whale-rest` stay silent until the first act; saves mid-rescue
(`whale-breath` to `whale-heave`), like a recording first started mid-rescue after music was switched back on, stay
silent until the next act begins and plays its phrase; loading never raises a cue. `whale-flipper` and `whale-gone`
play the close from its start.
The recording honours music mute (its clock keeps running), mute-all and hidden-page suspension, and permanent
silence. `hush` does not apply: the recording carries its own dynamics, and makes `whaleCallRoomDb` (−4 dB) of room
only while the whale calls, so its voice stays clear. The generic pad is silent throughout the passage.
`CrossingChapter.seaScore` (`open`, `swim`, `return`, `arrival`) remains story state for the swim and the pod.
`tools/sea-music-check.mjs` checks the cuts, whole phrases, silence at rest, order, waiting, restores, handoff and gates
offline; `sea-logic-check.mjs` that each cue comes as its act begins; `sea-music-browser-check.mjs rescue` plays the
rescue with real gestures and reports each phrase's wait. Ordinary crossings keep
the departing island's music until the handoff.

**Homeward and Home.** Jeremy's 2026-10-11 instruction: "great, can you set it up so that home.ogg is what plays for
the home chapter instead of whatever music we currently have." He rejected smaller encodes: "nvm its not worth it,
just use the .ogg as given". `assets/music/home.ogg` replaces the drone.

Jeremy's 2026-10-14 brief for the handover: "Also, i noticed that from mirror to home, there's unfortunately no
deterministic sequence we can make use of e.g. the player might finish the mirror level at any time. I think what we
need here is the ability to know what natural phrase stopping points there are in the sky mirror music, and then
choose an appropriate one based on when the home.ogg is scheduled to play. e.g. we have to look ahead and pick a sky
mirror music stopping point that is the furthest along that is closest to ~5 seconds before the home.ogg starting
point." He tunes the start so a chosen moment of Home lands as the child reaches the top of the hill.

The voyage from the Mirror is deterministic; when the player leaves is not. So Home is scheduled from the moment the
boat leaves (the toHarbour crossing's start): `home.ogg` begins from its first second `homeStartAfter` (12.5) seconds
in, counted on the crossing's clock, at full level with the background gates opened at once (the file opens on
0.18 s of silence, so it needs no fade). As the boat leaves, the Mirror recording's playback position is read and
`mirrorEnding` picks where it stops: the latest seam at least `mirrorSeamLead` (5 s) before Home and at least
`mirrorSeamSoonest` (0.3 s) ahead, across the loop if need be. The recording fades to silence over `mirrorFade` (3 s;
shorter if the seam is nearer) ending exactly at the seam, so the last phrase's tail is eased off and the next attack
never sounds. If no seam lies in that window, it fades over `mirrorFade` at once. So at least 5 s of silence always
separates the two (9.5 s after a fade at once): across every leave time it stops at a seam 70% of the time, with
about 9 s of silence on average. Jeremy (2026-10-15), verbatim: "There's not enough minimum separation between the sky
mirror's music ending and the summit music starting, and the fade out of the sky mirror music could be longer"; he
chose a 5 s minimum and a 3 s fade. The
background is silent from the seam until Home.
A later Home start (past landing, for the hilltop) holds across landing: the handoff keeps the audio-clock time it
last took from the crossing.

Edge cases. A Mirror not sounding as the boat leaves (music off, still decoding, `?chapter=toHarbour`) leaves silence
at once and Home still begins `homeStartAfter` into the crossing; a restored crossing counts from its own saved time.
The crossing clock keeps Home with the boat through suspended audio. Music switched off when Home is due, then back on,
joins the recording where it would have been (fading in) rather than from its top. `home`, `jetty` and `summit` starts
begin Home with the chapter. `tools/homeward-audio-check.mjs` checks the seam chosen for several leave times
(the loop and both fallbacks), renders the Mirror silent from its seam and Home beginning on time, and retries a
dropped download; `homeward-audio-browser-check.mjs` measures the whole handover from `?chapter=mirrorEnd`.
Landing and the climb keep the same playback clock; the whole recording loops if needed.

Jeremy (2026-10-15), verbatim: "Ok, the next problem to solve is the timing of the home song as the game actually ends.
I'm having trouble with it. It's very important that it ends on the right phrase as it pans up to the moon before
leaving the player with nothing but the beautiful shot and the ambient sounds. Can you help figure this out? The only
thing i know is that we can rely on the timings being exactly deterministic from the point at which the cygnet flying
sequence starts and the end credits. The technique that was used before the home music was put in was that we could use
the updraft to subtly mask the background music and transition to a known music start point that could then play
right through to the end, with good phrasing and emotional impact for the child opening the paper aeroplane, going
into the home, and then the pan up to the final shot. Understand what i mean?" On a masked crossfade at the updraft:
"the transition is a bit sudden, it can't be hid by the updraft.. surely there's something we can do to make it sound
and feel more seamless"

Jeremy (2026-10-15), verbatim, on that silence: "In fixing the summit chapter, it abrupbly muted the music at the
updraft challenge at the top of the hill with teh cygnet flying away instead of figuring out if thre was a better way
to do a nice musical transition. Please familiarise yourself with the problem and see if you can figure anything out
given the home.ogg track." And: "For context, im looking for the whole summit / home chapter to feel atmospherically
and musically coherent the whole way through".

`home.ogg` turns on one four-bar cycle, C, D, A♭, G at 68 bpm (about 14.2 s a pass), the whole way through; only the
texture changes. So Home never stops between the Mirror and the moon: it moves between passes of its own cycle at
bar lines, in rests, where one passage can follow another as it would in the piece.
- **The approach** plays from the top as scheduled. On the journey from the Mirror they sit on the summit at 83.5 s,
  the family wheels over the big low section from 86.4 s, and the cygnet is set down at 100.5 s as its second pass
  begins. It carries the cygnet's two tries by itself to the rest at 114.8 s, where the fullest section would begin.
- **The ask.** At that seam Home goes on instead into its own quiet opening (`HOME_ASK`, 0.16 to 29.95 s: the cycle's
  first two passes, both ends in rests), as the second try fails and it calls north, and loops it for as long as the
  cygnet asks. The fullest section is first heard as she lets the plane go. The seam is chosen as they sit
  (`homeSetDownIn`, from the `summit` beat): the first cycle seam (`HOME_CYCLE_SEAMS`, where a pass has ended in a rest)
  from `homeAskEarly` (2 s) before the set-down to `homeAskWithin` (16 s) after it, so drift between the story and the
  audio clock cannot move it. Other starts find their own (`toHarbour` 86.4 s, `summit` 29.95 s). With none then it
  fades over `fogFade` as the tries begin and the opening follows. Each pass is cut over `homeSeamCut` (60 ms) into the
  rest before the next pass's attack. Nothing new starts during the ask (music off, still decoding).
- **The answer.** At the updraft's success the opening hands over at its next exit at least `mirrorSeamSoonest` ahead
  to the ending's music (`HOME_ENDING.passages`), entering mid-phrase at 47.65 s: its rest is shallow and its D follows
  on from the C before it, so it carries on rather than starting over (43.85 s, the deepest rest in the piece's middle,
  sounded like the track going back to its beginning). The exits are the opening's seams (4.05, 7.86, 11.6, 18.95,
  22.57, 25.3 s and its loop point) and the bar line at 15.26 s where its second pass reaches C with no rest between,
  which it breathes into over `homeBreathRelease` (0.35 s). Answered before the opening begins, the ending takes the
  opening's seam itself. The return waits 0.3 to 5 s, about 2 s on average, while the family wheels down. The sound
  reports the wait each frame (`Soundscape.homeReturnIn`, `hearHome`) and the story sets the ending's clock `e` by it,
  so the attack lands at `homeJumpAt` (0.5 s) and the cygnet lets go of the wind at e = 3; until then it holds itself
  up, sinking only at `answeredSink`. The sound places the exit within `homeExitSnap` of where the story's clock puts
  it. Every passage rises over `homeSpliceFadeIn` (4 ms), since 47.62 s starts in a −30 dB breath that clicks if cut
  in at full level. With no opening sounding (a success before it begins), a pass still sounding ends at a seam within
  `homeQuickFade` (1.5 s) or fades over it, and the return begins as it falls silent, at its place, rising over
  `homeQuickFadeIn` (0.4 s). Restores (`reunion`, `drawing`), late starts and music switched on mid-ending join where
  the passages put the music at that `e` (`homeEndingPosition`), with a fade-in. Once per ending.
- **The ending's passages.** After the entry, the big low section's first round (86.44–100.55 s) plays three times,
  each repeat taking over attack to attack on the same C downbeat (`homeSpliceFade` 10 ms, cut 4 ms before the
  attacks at 86.442 and 100.546 s, which line up within 1 ms); then its second round to 114.8 s. The minor bridge
  (114.8–143.1 s: B minor, A, F♯ minor) is cut: the big section's last rest goes straight to 143.135 s, 30 ms before the
  soft pass's C after it, and the recording plays on from there to its end.

Jeremy (2026-10-15), verbatim, auditioning recordings of the real game. On a later entry: "Another possibility where
was a nice entry point at 57 as well with the phrase starting with stronger strings? what do you think? We can cut a
2 seconds from the paper plane, 2 seconds from looking at the flock flying away, give two seconds back to the walk down
the hill." On the bridge: "the phrase that starts playing at 1:36 that is a bit more dissonant and sad, i dont like
that." And: "I wanted that dissonant bridge removed. It doesn't fit the scene at all." On filling its time: "start
from that earlier 47 second boundary or something you identified earlier, keep the repeated big section pass, and cut
the dissonant pass." Asked whether a shorter ending should shorten the pan, he chose to keep the pan as it was. On the
recording of this version: "this is the one! only one surgical change, bring the "thanks for bringing them home" and
play again forward by 6 seconds", then "sorry make that 5 seconds, not 6". Rejected: the crest take-over (the opening
carrying on through the farewell to the big section at the crest); the strings phrase at 58.1 s with only the track
after it (the bridge lands on the drawing); adding the big section's extra round without being asked. His timing
changes: the look at the opened drawing is 2 s shorter (`homeReveal.recogniseFor` 6), watching the flock go 2 s
shorter (`homeReveal.watchFlockFor` 13), and the run down to the house 2 s longer (`homeReveal.runHomePace` 0.815,
10.8 s instead of 8.8 s).
- **Alignment** (beats measured in the game; they may drift by about a second from the brow on, since the brow waits
  for the house to be framed; the pan's end is fixed to `e`):

  | e (s) | recording (s) | story | music |
  |---|---|---|---|
  | 0.5 | 47.65 | the cygnet held up on the wind, the family wheeling down | the opening hands over mid-phrase |
  | 3 | 50.2 | it flies by itself | |
  | 37–39.3 | 84.2–86.4 | over the crest | big low section from 86.4 (e 39.3) |
  | 50.4 | 97.5 | stops at the brow | |
  | 53.4 | 86.44 | the paper opens; recognition about 58 | the big section's first round again |
  | 66.8 | 99.8 | she lets the plane go | |
  | 67.5 | 86.44 | | the first round a third time, then the second round from e 81.6 |
  | 77.3–88.1 | | the run down; inside | |
  | 91.1–120.15 | | the pan up to the moon | the bridge cut at e 95.9 (114.8 → 143.1, the soft pass); final phrase from 157.2 (e 109.9); its strong entry 164.5 (e 117.2) |
  | 120.15 | 167.4 | the camera settles on the moon (`moonAt`) and holds | last strong attack 168.3 (e 121) |
  | 128.4 | 175.7 | `musicEndsAt` and `creditsAt`: the closing line | rung out to about −64 dB, cut |

  The recording ends on its own last note, which has rung out as the closing line comes.

`homeMusicDucking = false` lets the Home recording play on without the story's hush.
`node tools/ending-audition.mjs <out.wav> [fromSeconds]` renders Home from the summit to the credits (START is where the
island's pass is as they sit, ASK how long the cygnet asks, RATE the story's frames a second; WORLD=1 adds wind and a
stand-in rush); `homeward-audio-check` covers the seams, the move into the opening, its loop, the return and restores.

**Recorded asset lifecycle.** Vite emits the thirteen original Ogg files and the belfry's derived ending as separate hashed assets. `music-loading.ts`
downloads only the starting recording alongside world construction and shader compilation, with no AudioContext
before Begin. Begin unlocks audio and decodes while the chosen room prepares its first frame. The veil waits for
both, showing "Preparing music" for waits over 150 ms. Sound-off and music-off skip preparation; switching either
off cancels an in-progress start. A 20-second deadline bounds download/decode failures so ambience can still begin.
During play, a single compressed prefetch slot warms Still's second recording on the island, Lines on the first crossing, Boats in Lines, Birches in Meadow,
the stairs song from the birches on (decoded when the crossing asks for it), the stairs' `clouds.ogg` under the cloud (once the stairs song is in hand), the village's `village_approach.ogg` from the stairs' white on (once `clouds.ogg` is in hand: `nextMusicForChapter` takes the stairs' phase), `belfry.ogg` with its ending in the village, Sleeping's lullaby in the wood and on the crossing from it, Sleeping's climb at bedtime, its morning from the freed feather and the open sea from the summit on (`nextMusicForChapter` takes Sleeping's gate), the Sky Mirror on its crossing, and Home in Mirror. `Soundscape.prepareMusic` consumes that download and decodes at the existing arrival handoff (the village's while the stairs' fog waits for `clouds.ogg`).
Playback uses an `AudioBufferSourceNode` on the shared
audio clock, so mute-all and hidden pages freeze it without separate media autoplay permissions. Music-only mute
leaves an existing score's clock running, but does not start downloading new muted scores. A live decoded Home
buffer is about 65 MiB at 48 kHz; the Sky Mirror about 79 MiB; the open sea about 87 MiB; Birches (`red_door.ogg`) about 87 MiB, released as its pass ends on the sail; the stairs song about 82 MiB, from the crossing's handoff to its end below the white (up to 10 s beside `clouds.ogg`'s decode); `clouds.ogg` about 98 MiB, decoded in the white; `village_approach.ogg` about 74 MiB, held only until its seam; `belfry.ogg` about 55 MiB and its ending about 3 MiB, from the belfry to its end; Sleeping's lullaby about 53 MiB, from the wood's handoff to its end; its climb about 64 MiB, from her falling asleep until the curtains (or the summit part's end); its morning about 45 MiB, from the catch to its end, so the climb and the morning hold about 109 MiB together over the summit, under the lullaby and climb's 117 MiB while she falls asleep. Exit releases
the buffer, aborts an unfinished fetch and prevents a late decode from starting playback. The browser HTTP cache
retains downloaded files for revisits. A failed fetch or decode is fetched afresh after 1 s and again after 3 s
(`musicRetryAfter`), within the same 20-second deadline, so a network blip does not silence a room; a recording still
failing logs a warning and leaves that score silent.

Synthesised scores repeat their sections to fit player pacing and release voices on phase changes. All scores release
over 1.8 s on exit (0.12 s for permanent silence), disconnect finished voices and buses, and freeze with the shared audio clock when muted or
hidden. Missed frames skip stale attacks rather than bursting.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the plucked shape in Boats and
the Meadow melody itself.

## Handoffs between pieces

- `Chapter.arrivalMusic` names the destination piece. On a crossing it is requested from the remaining distance and
  the boat's speed, never before 35% of the route is behind the boat (`arrivalMusicRouteShare`, `arrivalMusicLead`).
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
- Special cases: Sleeping morning hands off explicitly to `sea` on departure, without a phrase wait: it fades over
  `sleepingDepartureFade` (4 s), rests `seaArrivalQuiet` (1 s) and the gates reopen over `seaArrivalFadeIn` (1 s), clear
  before the recording begins at `seaMusicLead` (6.3 s), 2.3 s after the morning stops; sea → Mirror waits until the whale has gone; the stairs → Drowned is asked for in the stairs' fog and waits for `clouds.ogg` (below); the village's recording enters at full level, without a fade-in (`villageArrivalFadeIn`), and so does Sleeping's lullaby (`sleepingArrivalFadeIn`); Drowned requests Wood
  only after the lost-plane scene: out of the storm, silent by then, the wood's drone comes in over `forestMusicBlend` (4 s) with
  the gates open, tuned on D/A before it is audible; Mirror → Home is scheduled from the boat's leaving, the Mirror ending at a phrase seam
  (Homeward and Home above).

- A once-played recording marked `holdsHandoff` holds any request until its own end fade is done, with no phrase-wait
  cap; the handoff then skips its fade (the recording has faded itself) and keeps the rest and fade-in. A recording
  already over leaves the handoff as it was. The meadow's warm bed, once it is playing out to its close
  (`meadowMusic.closesAt`), holds Birches the same way.

A gain whose first event is scheduled ahead starts at 0, not its default of 1: a source starting between samples
lets one sample through before that event, a click (the piano's hammer did this).

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
  convolver are prepared across frames once the village begins, so the cue's frame only connects nodes.
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

Motion sounds come from changes in physical state, never from completion cues: curtains, scarf
working, releasing and gathering, paper and doors. New sources, inactive sources and the first frame after resume
establish a silent baseline, so completed actions are never replayed. Every source has distance attenuation, screen
pan and bounded scheduling; finished nodes disconnect.

- Birches: leaf scuffs follow the child's footfalls on authored leaf-covered ground (the initial litter map, not
  readbacks) and the cygnet's heap kicks, sharing one `leafScuffEvery` budget; particles and wind never trigger them.
  `leafScuffLevel` is 3 dB above the original level, independent of wind and grass rustle.
  Swing creaks need real travel and a reversal, `swingCreakEvery` apart. Both attenuate over `birchesFoleyNear/Far`.
  The squirrel's game (`BirchesFoley.leaves`): a rustle for each tell from its heap (`leafRustleLevel`), a burst when
  it is turned out or the wind throws a wrong heap up, and the leap's burst with a thump under it (`leafBurstLevel`);
  each stands for the scuff the leaves going up would make. The squirrel's own voice is synthesised
  (`creatures/squirrel/voice.ts`): the scolding chuck and teeth-chatter, a squeak as it bursts out, claws on bark,
  patter, landings and gnawing, played positionally from `squirrel.heard` in `main.ts`.
- Sail: one quiet canvas fold at full droop (`sailSettleAt`), re-armed only after a refill below `sailSettleRearm`;
  flutter sounds only on fresh rises, `sailEvery` apart. Toy-boat flutter is silent.
- Laundry: local wind on the cloth's spring and flutter thresholds, at most `clothSources` voices. A passage sheet's
  peg coming off the line snaps once (`peg`), from the peg itself; pegs already off when a checkpoint loads are silent.
  `pegBoostDb` raises the snap and wooden knock by 6 dB after Jeremy's Lines playtest. The family garments filling
  and reaching toward each other are silent. Each rotary gives one metal-bearing creak after real angular travel:
  `rotary-friction.ts` generates two 0.62 s variations from irregular pressure, ringing harmonics around
  2.9/5.8/8.7 kHz, filtered noise and brief collar contacts. `rotary-creak.ts` caches the generated buffers when
  audio starts, then alternates them without synthesis work at the gesture. No recorded PCM ships with this sound.
  Jeremy approved this procedural timbre. The [reference study](../../assets/audio-reference/rotary-creak/README.md)
  preserves the recording used to guide it; keep recordings as development references, not playback assets.
  Its level is separate from the little pinwheels’ flutter; Jeremy’s
  request to quiet the spinners referred to those pinwheels. A small cloth sound follows the snag release. Idle, restored and muted events stay silent;
  missed creaks expire rather than playing on unmute.
- Sleeping hearth: one looping low roar that breathes, plus crackles in small uneven clusters with an occasional
  snap, all scaled by the flame and the camera's distance; the roar fades out with the flame or on leaving the room, and
  once it has been quiet for two seconds it stops until the fire is heard again.
- Sleeping climb (`sleeping-foley.ts`): snow under the bird and round its chest in the drift, the wade's struggle,
  and the bandaged wing's flutter whenever it scrambles or, at the step, beats in hope (following `flap` and `hope`);
  snow steps take `cygnetStepDb` like other steps. Everything else sounds as it does elsewhere.
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
  more diffuse reverb. While it calls, the sea's recording eases down by up to `whaleCallRoomDb` (−4 dB) and back
  after, so the music makes room under it rather than burying it.
  `tools/whale-voice-check.mjs` renders all seven production calls through WorldFoley and checks clipping, level,
  the direct voice's rapid amplitude modulation, the shared reverb tail and the moan's body above 180 Hz at its visible-reveal distance of about 95 m.
  `MUTATE=motor` and `MUTATE=thin` prove those guards. The passage check rejects any whale sound before visible
  emergence and the bird's return; `MUTATE=earlyvoice` proves this. `AUDIO=1 node tools/sea-check.mjs` records both approach and release mixes; listening remains
  part of the playtest.
- Flock wingbeats follow flight and take-off; resting rafts are silent. Beats consumed while inaudible never burst on
  return.
- The Lines pinwheels share one flutter voice, controlled by `linesToys.pinwheelFlutterLevel` and reduced about
  9 dB after Jeremy’s playtest. Out of reach it fades, stops and disconnects; returning makes a new voice.

## Start-up and lifecycle

The Music button mutes background scores and the shared pad through separate dry and reverb-send gains.
Existing reverb tails ring out. Wind, wildlife, physical sounds, gesture chimes, story cues and the meadow's duet
remain audible. The score keeps following the story while music is muted; arrivals and endings cannot override
the preference. The Sound button and M shortcut still mute everything. `tools/music-mute-check.mjs` renders both
music routes and the effects routes through this control.

The Begin gesture creates and resumes the AudioContext and builds its graph, nothing more. The loop noise and reverb
impulse are then synthesised in slices over about a second (`sliced.ts`), each long convolver gets a frame to itself,
ambient beds join with a short fade and the reverb starts from silence, so nothing clicks. Arrivals only move gates and
build no convolver. `Soundscape.output` returns one cached graph object while running. Hidden-page and mute handling:
`progress.md`.

## The stairs in the clouds

The room's sound follows `SoundState.stairsAir` (`StairsAir` in `stairs-air.ts`: a phase from `under` through
`cloud`, `above`, `sail` and `fog` to `down`, the measures `cloud`, `climb`, `open`, `fog` and `speed`, and `clear`), which the
chapter sets each frame; no clock decides a phase.
`stairs-sound.ts` owns the air and the knock (a proposal awaiting Jeremy's listen); the music on top is `clouds.ogg`.

Jeremy's brief (2026-10-14), verbatim:

> Ok i got another really good music timing i think works for the clouds chapter. Let's use `clouds.ogg` for this. from 0 seconds all the way to 3:28 seconds. The sequence is they climb through the clouds, into the white out, revealing the sun, and then as it reveals itself, the cloud wind sounds die down as the child is standing there, and we transition to clouds.ogg (maybe with a quick fade in from 50% -> 100% while the sound of the cloud wind from before dies down. I just had a manual play through and the phrases of the music time perfectly with each sequence as it stands (the swans flying, the boat appearing, the camera zoom outs. See if you can identify the right moment to start clouds.ogg as well and i'll playtest and give feedback if it's right

> i want it to do the full 3:28, if there's a forced handoff to the village music, that needs to be pushed out

After playtesting (2026-10-14):

> The cloud stairs music plays too soon by like ~5 seconds or so. It needs to start when the child has already stopped moving and the sun is revealed. have a look at that sequence and figure out a good timing. basically when the child reaches the clearing. Also that background ambience noise / wind sound above the clouds never transitions down. It's supposed to give way to the music at the top. Still there, but much quieter. The windy noise of going through teh clouds and emerging on top into a peaceful, serene scene is what we're going for.

- Under the cloud the stairs song (`birches.ogg`) loops, begun from its top on the crossing's handoff (Birches, above;
  a stairs start under the cloud begins it on load). Each flight that docks raises
  `flightHome`, a soft wooden knock and puff outside cue ducking (`flightKnock`); the last flight
  has no completion phrase (Jeremy, 2026-10-17): the knock and the stairs song carry it. The cygnet's `puzzled` peep asks when the loop brings it back to where it set off.
- On the landing below the white, where she steps aside and the bird goes up first (`StairsAir` leaves `under` at
  `hesitate`), the stairs song ends at its next natural stopping point and never starts again in this room; there
  is no music through the white and the loop. Jeremy (2026-10-17): "The way the music cuts out leading to the
  penrose stairs isn't very good. Any ideas? a longer fade? Leverage the existing technique in other parts of the
  game that tries to find the next natural stopping point in the music?" The seams are measured on the decoded
  samples as `MIRROR_SEAMS` were (`STAIRS_SONG_SEAMS` in `stairs-song-seams.ts`); those whose rest lies at least
  14 dB under the median, the second before it at least 5 dB under, close a phrase (`STAIRS_SONG_PHRASE_ENDS`; 0.69 is the first
  note after the loop, so stopping there lets the piece's own ending ring out). `stairsSongEnding` takes the next
  phrase end within `stairsSongSeamWithin` (10 s) and lets it ring out, held only to its last `mirrorSeamRelease`
  (1.2 s); with none, the next seam, the figure under way faded into its rest over up to `stairsSongEndFade`
  (2.5 s); with neither (only in the 15.6 s without a seam from 39.83 s), one 10 s fade. Seams nearer than
  `mirrorSeamSoonest` are passed over. With no input, the bird goes first 3.4 s after the landing, she follows it up
  at 10.8 s and is in the white at 13.8 s, so the song is always over before she climbs into the white. Over the
  song's 224 s, the landing falls in reach of a phrase end 38% of the time, of a seam 59%, neither 3%; the song is
  silent a median 3.5 s after the landing, at most 10 s. The puzzle's length decides where in the song she lands,
  so a quick or slow player only changes which ending is heard. The wind is close and muffled and climbs with
  `climb`, while breeze and sea fall away. `clouds.ogg` is decoded here.
- Out on top, on the first `above` frame, the wind's last gust sweeps past and away and the white's wind dies within
  about 2 s; the high air above the cloud rises as the view opens. She walks to the edge and stops, and the haze lifts
  off the sun. `clouds.ogg` waits for that: `StairsAir.clear`, set `CLEARED` (4 s) into her look across the cloud
  (`awe`), about 4.6 s after the first `above` frame and 2.4 s after she stops. It begins from its first second at half
  its level, rising to full over 1.75 s (`recordedMusicOnce.clouds`: `enterFrom`, `enterOver`), while the high air
  settles to `highSettled` (0.5, about −6 dB) with time constant `settleFor` (2 s), its band sliding down to
  `highFar` 1400–3800 Hz and only `highFar.dry` (0.4) of it direct, the rest in the reverb: still there, far off,
  under the music. `cloudsMusicDelay` (0.5) moves the start relative to `clear`; below 0 it starts that far into the
  recording. The recording keeps its own audio clock from there: beats, the sail, the fog and music mute never
  seek or restart it, and nothing thins it (no `hush`, no fog trim, the generic pad silent). It plays once to 3:28,
  fading over 206.3–208.3 s, just before the next phrase at 208.42. Music switched on later joins at its own time
  without the entrance.
- With no input from `?chapter=cloud`, in recording seconds (the earlier measurement from the first `above` frame,
  less the 4.6 s the start moved): she sits on the lip about 3.4, the skein of swans 15.4, the boat sets off 37.1,
  comes alongside 65.4, she gathers the bird 71.6, boards 80.3, sails 83.1, the fog 190.2, the white thins 203.1.
  Gusts over the cloud shorten the sail.
- Under the music, while the hull rides the cloud, a low breath of air past the hull (lowpassed under about 600 Hz)
  follows `speed` and swells over several seconds, and the kite's line sings faintly while it draws them. Never a
  hiss: a band of hiss through the tops made the cloud sound like snow (Jeremy, 2026-09-28).
- The fog asks for the village's music (`arrivalMusic = 'drowned'` during `fog` and `down`, and the village itself),
  which waits for the recording's end fade (`holdsHandoff`): about 18 s at the measured pace. Then the ordinary rest
  (3 s) and `village_approach.ogg` from its top (Drowned Village, above). A recording already over leaves the fog's
  handoff as it was. Once out on top only the fog brings the sea back.
  Outside the room every level multiplier is exactly 1.

Levels: `stairsAir`, `stairsAirLevel`, `recordedMusicDb.stairs`, `recordedMusicDb.clouds`, `stairsSongSeamWithin`, `stairsSongEndFade`. `node tools/clouds-music-check.mjs` checks the
recording's start, entrance, end, hold and gates offline; `node tools/stairs-audio-proposal.mjs [outDir]` renders the
room's arc against a dev server. `stairs-score.ts` (the earlier synthesised bloom and sail) remains for studies.

## Checks

`npm run check:audio` runs the offline audio and score checks in headless Chrome against a running dev server (no GPU);
the list and the browser audio checks are in [testing.md](../testing.md). `node tools/audio-interruption-check.mjs`
covers start-up pacing, interruptions, piano reservations across mute, the cached output graph, the foghorn's
preparation and the pinwheel voice. `node tools/music-transition-audit.mjs` renders every handoff and all score
sections. `node tools/village-music-check.mjs` covers the Birches play-out and its end before the stairs song, the stairs song's seams and its ending below the white, the village's
recording and the silence after it, the belfry's goodbye, the storm and the wood's drone level; `node
tools/village-music-browser-check.mjs [drowned cloud belfry storm sail]` measures them in the real game (`sail`: the
birches' push-off to the stairs and up into the white). `node tools/music-transition-audit.mjs` also renders that sail
whole (`sail-faded`, `sail-ended`) and the birches going round (`birches-seam`: a pass's last 10 s, the rest and the
next's first 10 s, with the gap and entrance measured). `node
tools/sleeping-music-check.mjs` checks Sleeping's cut points and seams on the decoded samples, the frost's wait, the
climb's gates, queueing, skips, the morning at the curtains and restores offline and prints each player's timeline;
`node tools/sleeping-music-browser-check.mjs [climb sleeping ribbon feather morning]` measures them in the real game.

## Open

- The stairs: the sail's air over the cloud awaits Jeremy's listen in the game, and the moment `clouds.ogg` starts
  (on `clear`) and the settled high air await his playtest (`cloudsMusicDelay`, `highSettled`).
- Birches and the stairs song: Red Door's level, its rest and entrance going round, the sail's fade and quiet (`birchesSailFade`, `stairsSongRest`) and
  the stairs song's ending at a phrase end or seam below the white (`stairsSongSeamWithin`, `stairsSongEndFade`) await his listen.
- The drowned village: whether `village_approach.ogg`'s end (just before the bass, 36.93 s) sits right against the
  first challenge (it ends as the tub becomes pushable from the stairs, about 4 s after it from `?chapter=drowned`);
  the belfry's goodbye (`belfry.ogg`, its 5 s entrance and where its slowed end falls in the storm) awaits his playtest.
- Sleeping: Jeremy's review of the lullaby, the silence through the frost, the climb's parts and the morning in the
  game, including whether the crest's rising wind masks the sparse commitment section, and whether the summit part's
  1.5 s fade at the curtains sits right (a prompt player reaches them about 19 s into the 41 s part, with no seam near).
- Artistic sign-off needs a full-journey listen on headphones and a phone speaker (idle, energetic swiping, failed
  attempts, the optional swing), checking that each place is distinguishable by ear and the physical sounds and caring
  chime feel right in context.


## Still choreography refinement — 2026-10-11

Jeremy's brief (verbatim):

> Ok, yea I think when the "updraft" title could be a little bigger, and run for a little shorter, so just as the title starts coming close to the child as the camera pans, that's when it fades out? And just have the updraft title appear about a second earlier? Make it a tiny bit larger font size, and we can have a small gust blow over the island as well before it appears to represent the "updraft" and have an aesthetic shot with petals in the air. Same ideas as the wind blowing during the piano challenge on the  the music from the piano.
>
> The fog around the island of lines is a bit too on the nose. The player can see that it covers something in particular in the distance - why not have the fog / haze more spread out across the horizon instead?
>
> i think lines.ogg should start playing a bit earlier.
>
> now that we've added better music choreography to the still island, I think we need to revisit the falling tones for the cygnet. They are in a completely different key to the new motifs, so either we remove the music tones or try to align them to the same key (i think this would be difficult, so maybe we should just remove the falling tones? what do you think?).
>
> disable the ability for the player to speed up the boat during any crossing. they can create wind, but they can't speed up the boat. We need to do this so that we have more certainty about the timing of the musical choreography.
>
> remove that clothes line sitting in the ocean. We need to think of better points of interest or even pre-echoes of the island of lines after the whale.

The title runs at crossing seconds 34–42.5 (three-second rise, 2.5-second hold, three-second fade; `tuning.opening.title`),
40 px at desktop, with a six-second wind front through the existing Still flower patches starting at second 31. Lines
is concealed by a horizon-wide distance veil, not a coast-shaped mist, preserving the farewell before the visibility
range draws inward. The fall and its landing have no phrase; physical sounds stay. The main boat's propulsion and
leeway read the prevailing breeze independently of local gusts; its sail, pennant and heel still read the live field.
There is no offshore washing line.

## First-whale visibility, music gap and shore echoes — 2026-10-11

Jeremy's brief (verbatim):

> ah ok first,
> 1 ) the whale encounter is now in the fog and can't really be seen by the player. maybe the fog is a bit too restrictive?
> 2) how much silence is there now between the lines music and the end of the still_2 music? is it too much? should we move the still island slightly closer or the easier solution being to increase the speed of the boat a tiny tiny bit to cut it down by a few seconds?
> 3) I do think we should have the same kind of water wave effect as with the whale encounter later in the game when the whale dives. and yea i think you're right, if we have a pieces of laundry flying away and a gull carrying a scrap of linen, that would be a nice pre-dream echo. after the whale, there's like no animals or birds, which is probably why it feels a bit empty. what do you mean by the reflection of washing? Let's leave that for now and revisit it after above is done

Jeremy added (verbatim):

> yea, can we make it deterministic between when the child makes that paper aeroplane throw and when they get into the boat? e.g. disable the ability for the player to randomly blow the paper plane around etc.

The horizon stays clear through the first whale's surfacing and dive and closes in only after crossing second 60.
The first dive uses the shared physical swell, with independent expiry so the inactive later whale cannot erase it.
After the whale, gulls (one carrying a linen scrap) and loose pieces of cloth pass on the air, animated by the existing
cloth solver; a single quiet gull cry accompanies the pass. The washing-reflection idea is deferred.

## Secured plane, whale fades and horizontal title gust — 2026-10-11

Jeremy's brief (verbatim):

> - the whale sort of just teleports in, and then teleports out under the water. can it sort of fade in a bit better?
> - instead of just disabling the ability for the player to create wind temporarily on the still island, just have the child  hold the paper plane at the state of the sequence i.e. attach it to her backpack. then the player can still create wind throughout the entire sequence.
> - the "updraft" on still island i think needs to be a little more horizontal from left to right in the direction of the direction of travel, instead of simply "upwards", and a tasteful amount of windlines would be good too.

The plane is secured on the satchel from the tree sequence through boarding; player wind stays available throughout
Still. `still_2` starts as she sets off for the boat after bandaging, from source second 8 to the 1:58 cutoff. The
first whale's body and underwater silhouette ease in over 3.5 seconds and disappear over the last 4 seconds of the
encounter; its surfaced portion stays fully visible. The later whale keeps its own visibility choreography. The title
gust uses the shot's ground-projected screen-right direction, lower lift and sparse, thin windlines.

## Post-whale framing and livelier shore echoes — 2026-10-11

Jeremy's brief (verbatim):

> i think when the child is crossing over to the island of lines, the camera is pointed down and static too much, and so all the activity you added in the sky is hardly noticed. I need you to think more carefully about the sea gull flying, the sheets flying (right now there's only one sheet that isn't really tumbling through the air as much as it is just a square awkwardly being "panned" across the sky), and the framing of them in the camera.
>
> It might be nice as well to have a little bit of activity from dolphins following the whale. Or maybe something cheaper if you can think of anything to help make the journey feel a bit more alive. Or maybe it's really just a matter of having more than one clothesline sheet flying around in the sky, and more than 2-3 gulls.
>
> The lines music starts like ~2 seconds too early i.e. it starts playing even though the fog hasn't revealed the island of lines yet. Either increase the speed of the boat by like 1% or something and tone down the fog a tiny bit to get more a feeling of an expansive sea.

After the whale the camera eases up and slightly back with a slow lateral drift, then returns gently toward the
visible shore (`shoreEchoes.camera`), so the gulls and sheets share the shot with the whole boat and child. Lines
begins at about crossing second 99, as the rendered shore appears; boat propulsion stays fixed. Boarding is about 17 s
from the walk cue.

Jeremy's follow-up (verbatim):

> i think the sheets flying are not organic enough. they are all in a single line evenly spaced at the same height, and i presume all moving at the same speed and direction..

Each loose piece has its own release time, launch depth, lateral offset, altitude, curved bearing, breathing speed,
lift rhythm and tumble axis and rate, under one coherent prevailing wind, so pieces rise, dip, linger and overtake
each other (`shoreEchoes.laundry`). Verify changing projected heights and uneven gaps over a sequence, not one still.

The boarding camera keeps its 26/6.5 composition and .35 pace, is entered directly after bandaging, and keeps its
target at least at the child's height until she reaches shore: a close tracking camera here broke the post-bandaging
shot (Jeremy: "btw the boarding camera is still fucked up."). Check it from the bandaging sequence, not a restored
boat.

## Title, wind and crossing timing polish — 2026-10-11

Jeremy's brief (verbatim):

> - the updraft title fades out a touch too soon
> - the wind sounds are a touch too loud in the game e.g. the wind that blows on still island before the title. It draws attention away from the title, which then disappears a bit too quickly
> - on the crossing to the lines island, the gulls should appear sooner. there's a stretch of empty space after the whale encounter that is a bit too long. The flying sheets either need to be a bit sooner as well, or a bit after. Right now, both these events are playing in the silence between when still_2 music stops and lines music starts which is a bit weird.

`audio.windDb = -3` applies to the shared breeze, gust, whistle, grass-rustle and updraft audio, including scripted
weather; it does not alter the wind simulation or the sea, rain and music mix. The gull and linen sequence starts at
crossing second 69 (`shoreEchoes.afterFarewell` 48), after the boat and camera turn, with a short off-screen approach
so its visible pass arrives under Still's recording; the camera has its own `afterFarewell`.

Jeremy's follow-up (verbatim):

> - with re: to the gulls and sheets, I think you've overcorrected. They are appearing out of nowhere while the camera is still panned over to the whale. A little bit of space after the whale is ok, just not as much as was before. Make sure things aren't teleporting into existence in the camera. It's ok for things to teleport in outside of the camera view though if required. I think you've picked up on this already
> - Also, i get the feeling that still_2.ogg is not playing all the way to 1:58 seconds. something is cutting it off early?

The gull group's initial bounds and each loose sheet are checked against the camera frustum at creation; anything
intersecting it starts beyond the incoming edge with a margin, then follows its continuous flight. This adjusts only
initial placement, never repositions visible objects, and preserves the camera.

Still's recording reports its authored cutoff as its handoff time, so the generic arrival fade never multiplies its
own 1:54–1:58 envelope: its Lines transition waits until that time and then enters the rest with no additional fade.
Other recordings keep their normal handoffs. About 5.9 s of quiet separate Still's 1:58 end from Lines.
