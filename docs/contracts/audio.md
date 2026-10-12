# Audio

Home, Birches, Lines and Little Boats play supplied recordings; Still experiments with triggered excerpts; the other scores and world sounds are synthesised in Web Audio.
`src/audio/audio.ts` (`Soundscape`) owns wind,
environment, the shared pad, gesture chimes, authored cues and calls, and runs one pass per rendered frame after the
camera update. Each room with its own composition has a score module that follows story phases, not timers:
`opening-score.ts`, `lines-score.ts`, `little-boats-score.ts`, `meadow-score.ts`,
`stairs-score.ts`, `drowned-score.ts`, `dream-score.ts` (the Sky Mirror, notes in `dream-score-data.ts`),
`sleeping-score.ts` and `sea-score.ts`. `recorded-score.ts` plays Home, Birches, Lines and Little Boats continuously across story phases.
The former `little-boats-score.ts`, `lines-score.ts`, `birches-score.ts` and `summit-score.ts` remain for historical studies and phase types, outside runtime playback.
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
- The original synthesised scores use the detuned drone. Keep it, but it must move harmonically: "it just can't be one single drone
  note the whole way through". Circle-of-fifths piano rewrites of the opening and summit were rejected.
- New music needs structured harmony and melody: a theme in regular phrases over clear, repeating progressions, not a
  scatter of notes ("the music sounds a bit... random? I think there's not enough structured harmony / melody to it").
- Never fill a musical gap with one held sound: a stretch in Sleeping "playing the exact same note" was "horrible".
  The held-chord crossfade replacement for the shared pad's chord clock and glides was rejected; the pad's clock and
  glides stay.
- The opening island keeps its approved drone available, disabled during the Still phrase experiment below; an "evolution" study was rejected ("the original still sounds better").
- The former Lines score remains available for studies; Jeremy requested `lines.ogg` for playback on 2026-10-11. Previously, a from-scratch rewrite was "a clear downgrade". Don't propose it again. No
  completion phrase when the door opens.
- The piano-lullaby reprise at Home was rejected. Home's ending is scripted from the successful updraft and must feel
  as if the Home music plays all the way through to the credits.
- No bell phrases over the swans at Home: not when the family arrives over the summit, not as they fly away. The
  wingbeats and the Home recording carry it.
- The story no longer cues `delight` (the chime with the child's cheer): it no longer fits the music.
- The sailing boat has no hull-water foley: its bursts sounded like flapping. Toy boats keep theirs.
- No child voice: "never any voicing from the two main characters". The cygnet's calls, which he later heard and
  liked ("The cygnet sounds great"), are the one exception (`docs/cygnet.md`).

## Room levels

Every piece sits near one reference, about −29 LUFS in its main section. Home and Birches measure −14.6 LUFS
and use −14.4 dB gain; Lines measures −17 LUFS and uses −12 dB. Little Boats measures −16.7 LUFS
and uses −12.3 dB. Still measures −23.3 LUFS across its
phrases and rests and starts at −6 dB (`stillPhraseDb`). These trims preserve the source dynamics and encoded bytes.
Their dry route avoids adding reverb to an already mixed recording. `roomTrimDb` trims the Sky Mirror
+6 and the drowned village and Sleeping +2.5 dB over their approved study levels (`*ScoreLevel`). Its Home and
Birches entries and their old score levels are historical, unused by recorded playback. With the experiment disabled, the opening grows about
5 dB with life (`openingPadRise`), keeping its quiet start. The grey
meadow, the wood and the Sleeping climb stay quiet by design. Add new rooms at the reference.

## Player feedback

**Cursor chimes play only in the forest and on Sleeping's feather-guided climb.**
The still island keeps its wind sounds and authored story cues, with no chimes from gusts, updrafts or glider lift.
The first breeze and plane flight have no tune, and restoring its colour has no completion phrase.
The cygnet's story cues remain.
`forestWind` follows `story.name === 'wood'` and
`sleepingWind` is true only in the Sleeping chapter's `climb` score phase (climb, snow, mist, catching the feather).
These gates are independent of whatever music is still playing from a departed island. Outside them gusts, held
updrafts and glider-lift answers schedule no chimes, and sounding tails fade over `gestureTailRelease` (300 ms).
`scripted`, `silence` and an engaged piano (`pianoActive`) also suppress them. Checkpoint restoration derives the same
gates.

- Audio and `PointerInput` share `pointer.minGust` and `pointer.minLift`, so the first gentle stroke after audio
  starts can sound.
- Attacks sit on a 96-BPM grid with a minimum gap: `forestChimePulses` / `sleepingChimePulses`
  (four, 1.25 s) in the forest and on the climb. Both notes of a glider
  answer obey the gap and reserve it against gusts and updrafts.
- **Forest chimes use the original low minor palette: the whole wood scale (MIDI 50–72), not filtered to the current
  chord.** Forest updrafts use D3–A3–D4–A4. These ring over the forest drone without tail filtering. Searching at
  the rescue ember uses the softer caring voice (`careChime*`).
- Sleeping climb notes follow its score, with the soft attack at `sleepingChimeLevel` (about 3 dB under the others).
  The stowed glider cannot trigger notes; summit, waking and departure have none.
- Where a gesture follows harmony, lift stays in MIDI 62–81 and strokes and glider answers stop at 86; notes query
  the harmony at their scheduled onset, including across chord and loop boundaries, and incompatible held notes fade
  over 300 ms at chord changes.
- Player gust, whistle and updraft noise use `playerWindDb` (−6 dB); grass rustle has its own
  `grassRustleDb` (−9 dB). These apply in every room and ease off as a stroke strengthens (`playerWindEase`: about −1 dB at half strength,
  −6 dB at full); their filter sweeps are scaled by `playerWindFilterRange`. The trim leaves the weather floor,
  ambient breeze, sea and rain unchanged.
- `hush` attenuates only the background score, never the player's feedback.

Authored cues keep their own sound: `restored` (the shared completion phrase), `breeze`, `kindled`, `comfort` (the
rescue hearth's two notes), `feather`, `lifted`, `star` and the rest use fixed pitches and the bright bell voice,
independent of cursor harmony. An important cue ducks the accompaniment to `authoredCueDuck` (0.32) over 0.45 s and
returns over 1.3 s. The piano keeps its own musical response.

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

> We should make sure to bring forward some of the phrases from 2:00 onwards as well, they have some colour with some horns. can you show me the sequence of phrases that will be played?

> or, we keep those phrases with the horns for during the corssing then they see the whale

The old horn passage remains available in `StillPhrases.crossing`, but the following direction supersedes it.
The starting file downloads alongside shader compilation and decodes after Begin, before play is revealed;
failed loads fall back to ambience, and gestures never queue. A decoded Still buffer is
about 69 MiB at 48 kHz and is released on exit. Playback uses the dry music route and honours music mute.

**After bandaging — current direction (2026-10-11).** Jeremy's brief, verbatim:

> the moment that the cygnet is bandaged and the child throws the paper plane, we should play `still_2.ogg` (the paper plane no longer players those sequences).
>
> Then, at a certain point we should fade in the "updraft" title as she's making the crossing over to the island of lines. In addition, just for your context, be prepared that we will likely have to move the still island out a bit further so that the crossing a bit longer to accomodate all this new emotive space, as well as the timing of when she sees the whale.

Title timing: "After the look back, before the whale". Further adjustments, verbatim:

> also, the "timeout" before a new motif can play on the still island, whats it at now? 5 seconds? can you reduce whatever it is by 0.5 seconds

> btw, when playing still_2.ogg, it should start at the second phrase that plays at 8 seconds, not the first phrase.

The first plane release in `leaving`, after the completed bandaging callback, starts the supplied `still_2.ogg`
at source second 8 (`stillDepartureOffset`). Its original bytes stay unchanged. It is 174.02 seconds long,
measures −14.9 LUFS, and uses −14.1 dB playback trim. It plays once, without a loop; subsequent throws and colour
cannot start motifs or restart it. Prefetch begins during island play; decoding begins on the walk to the tree.
The original Still buffer is retired there. The second recording uses the same source through boarding, farewell,
title and whale. It fades over source 1:54–1:58 and stops before the next phrase (`stillDepartureEnd`,
`stillDepartureFadeOut`); the independent source envelope survives ongoing level updates and pauses with audio.
The existing Lines fade/rest hands over to `lines.ogg`. If the recording ends before arrival, ambience
continues. Direct crossing starts begin this recording at second 8; the crossing entry save has no elapsed audio
position. A companion checkpoint prepares it behind the veil and waits for the next plane release.

The title uses slightly enlarged ending typography and a story-clock fade (`opening-title.ts`, `tuning.opening.title`):
thirteen seconds after the 21-second farewell, fade in for three, hold for one, fade out for three (34–41 seconds).
It takes no input, pauses with story time, and disappears on leaving the crossing. The title is independent of
music mute. The first whale now surfaces at 45 seconds, after the farewell camera has finished turning, and its
camera attention eases in and out over six seconds (`tuning.opening.crossing`). These are trial story-clock cues,
not sample-locked music cues: boarding time still determines which source phrase accompanies them.

Jeremy's 2026-10-11 timing and geography experiment, verbatim:

> do you think the "updraft" should actually start fading in when it currently fades out? in terms of the timing? i.e. have it align with the next musical phrase that it currently does. (i might be wrong about this so lets try it and if it doesn't work we can revert). The camera pan over to the whale is a bit too fast and rushed, maybe push the timing of that out a bit to the next phrase as well?
>
> And then i think we definitely need to move the whale and still island position back by atleast 30 seconds (don't change the boats speed). Then we can think about what other attractions we can add along the way.

He chose **“More sailing after the whale”**, measured at the ordinary breeze. The implementation moves Still and
its first four departure waypoints 200 units south, leaving Lines fixed. The whale surfaces relative to the boat,
so its encounter moves with that departure. The measured ordinary crossing grows from 76.3 to 117 seconds;
with the whale eight seconds later, sailing after its appearance grows from 39.3 to 72 seconds (+32.7 seconds).
Boat speed settings are unchanged. Geography revision 10 migrates existing saves; new attractions remain for
a later experiment. Next review is listening to the title and whale alongside the recording in normal play.
To retime independently, the previous title delay was 3, whale onset 37, and whale camera easing 2 seconds.

Jeremy's next fine-tuning brief, verbatim:

> - what do you think about the title timing? better or worse? I'm thinking we should either push the updraft title timing to appear halfway through it's current phrase instead of starting directly on it. If that doesn't work, we can revert the updraft timing back to your original one and then maybe figure out how to make it easier to see against the green grass in the background (maybe just slightly bigger font?)
> - also as a fine tune, we should end the play of `still_2.ogg` on ~1.58 faded out before it plays the next phrase
> - and lastly, as the child is sailing out to the island of lines, they shouldn't be able to see it until they get closer. Right now the fog / haze effect doesn't hide the island reveal until they get close (from afar you can see the island of lines as the camera pans over to the whale right now (they shouldn't be able to see it)

The preceding pass tried four more seconds of title delay, approximately halfway into the next eight-second phrase;
font size stays as it was. The fallback is the original 24–34-second title with a modest size increase, pending
Jeremy's listening pass. That pass gave Lines its own coast mist (fully concealed beyond 110 units from the camera,
clearing over 110–55) throughout `toLines`; this stays independent of the farewell and the whale's open-water view.
The fine-tune passes the production build, 48 Still audio checks and 51 Lines score checks. A real crossing GPU
probe checks 117 dry-land points: full concealment through the whale and at second 95, partial shoreline reveal
at 105 (77 units from the eye), and a clear near shore at 115 (37 units). Title fades are checked at each boundary.

Verification: production build; geography/save migration, boat clearance, crossing camera and haze checks;
real browser bandaging/score/title/whale handoff; opening colour/plane motif playback; full first-crossing camera
coverage. Still's 340 sampled dry-land heights are unchanged after translation. The distant height/colour atlases
also move. The broad terrain atlas audit passes visible-surface accuracy but reports a separate open-sea mismatch
at (194, −1750) near Wood (0.167 units); the terrain height there is identical with Still at its old and new positions.

**Preserved opening drone (experiment disabled).** `opening-score.ts` conducts the original four detuned pad voices through the approved 33 voicings,
5.3125 s apart (80% of the endorsed tempo), with a held D/F♯ resolution at 1:25; the 185.3125 s form repeats for
player pacing. It plays on the first island and its crossing (`openingScore`), follows a local audio clock, and the
Lines arrival retires it without letting it return. During the fall the `openingScore` phase holds the first chord
(D) while the skein passes. The original D-major `fallen` phrase and pitched landing note are separately
disabled by `audio.stillFallTones`; re-enable that switch only when auditioning the old scoring. The skein has
no phrase, only the swans' own calls. The pad then fades to silence with the fall and stays silent through the rescue, leaving calls, wind and sea;
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
Jeremy's 2026-10-12 instruction: remove the Little Boats "puzzle completed" sound. The reveal no longer raises
`restored`; the supplied recording carries the conclusion without that phrase or its accompaniment duck.

**Meadow and the piano.** A grey bed plays on arrival. The background stays while the child walks to and looks at the
piano, then fades once over `tuning.piano.fadeOut` from sitting, overlapping the first key and clear before the
demonstration; `pianoMix` carries that fade and Meadow's `hush` holds only its other quiet, so nothing is attenuated
twice. Departure from the stool returns the background over `fadeIn`. `PianoStop.finish()` schedules the whole
lullaby, the colour front starts `finaleWaveAfter` in, and `onComplete` fires once after the phrase plus
`completionRest`, which is when the meadow calls `completeObjective()`; `restoreDone()` cancels a pending completion.
Only after the duet is done does `MeadowChapter.meadowScore` start: `walk` before the crest, accompaniment-only
`flock` and `pond`, then `return` (harmony at 4 s and plucks at 5.5 s, after the completion cue), which continues
through boarding and the crossing to Birches. The arrangement contains its own dynamics; don't apply `hush` on top.

**Birches.** Jeremy's 2026-10-11 instruction: "next if you can wire birches.ogg in for birches island music".
`assets/music/birches.ogg` replaces the synthesised score from the approach crossing through boarding and departure.
The existing `walk`, `swing`, `scarf` and `return` phases still describe story progress and checkpoint state, but
never restart or rearrange the recording. The stairs' existing mix fades it away before their score takes over.

**Drowned Village** (`drowned-score.ts`). Six pieces in the game's own voices: the shared detuned pad (a chord every
8 s, each held into the next one's swell), the meadow's piano, its soft sung voice and its pluck, all in B minor and
D major with the dark in D minor, and the boat's lilt of six to a four-second bar, long-short then long.
`DrownedChapter.drownedScore` follows the scene: `drift` from the stairs' fog through
the rescue (the boat's tune on the piano over the falling B minor, A, G, F♯ minor, then the piano's question D–E–F♯–B
over G and down by E minor to A; its repeats sung by the soft voice, then sparer). `drownedQuiet` releases that score
over the two seconds of sailing after the rescue, leaves the becalming cue audible, and keeps the windless drift
quiet until the cat is ashore. Never use permanent `silence` for this rest: it also mutes later cue sounds. `fog` then plays to the top
of the ivy (the boat's tune gone with the boat: over B minor, G, E minor and F♯ a sung line climbs in sighs a step at a
time, then falls down the scale to F♯, over the low piano tolling each root and its fifth a bar apart; its passes add
the line and then the piano, never a pulse); `refuge` in the belfry until the lantern first answers (a lullaby on the
bell's own notes over Gmaj7, B minor 7, E minor 7 and A); `home` from the first answer to boarding (the boat's tune back
in D major over a bass walking down from D, its question unchanged); `farewell` while she looks back aboard (the answer
B–A–F♯, E–F♯–D, G–F♯–E–C♯ landing on D); `storm` as they cast off (D minor, B♭, G minor and D over a low D with the
question gone cold to D–E–F, then the same round fainter until the wood; every chord keeps D and A for the wood's drone).
The storm starts within 0.3 seconds of the weather beginning, crossfading the farewell over `drownedCrossFade`.
A piece the story leaves plays on to its next chord change and the next begins there, the old one fading over
`drownedCrossFade`; requests that change again before then go straight to the latest. Levels are composed (the drift
at the room reference, the fog about 1 dB under, the refuge 3 dB under, home level with the drift, the dark 3 and then
6 dB under), so chapter hush is not applied. `node tools/drowned-music-study.mjs [outDir]` renders each piece and a
sweep of the room from the drift into the wood with the becalmed phrase, the bell and the foghorn.
`tools/drowned-audio-regression-check.mjs` renders the rescue rest and cue, the resumed score and storm transition.

**Sky Mirror** (`dream-score.ts`, notes in `dream-score-data.ts`). The Mirror follows approach, first play, one to
three returned lights, the full constellation and departure; completed-star count, not order, picks the section, the
third star reuses the middle verse and only the fourth gets the final bloom. `star` is emitted once per real return,
never on entry, loops or restore. The departure section carries on over the harbour crossing.

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

**Homeward and Home.** Jeremy's 2026-10-11 instruction: "great, can you set it up so that home.ogg is what plays for
the home chapter instead of whatever music we currently have." He rejected smaller encodes: "nvm its not worth it,
just use the .ogg as given". `assets/music/home.ogg` replaces the drone. Leaving the Sky Mirror requests Home at once:
the Mirror fades over 3 s, the background stays silent at least 5 s, and the recording fades in over 3 s once the boat
has passed its first offshore turn and is `homewardClearDistance` from the berth (`homeward*`, `homewardReady`).
Landing, the updraft, the flight and the walk keep the same playback clock; the whole recording loops if needed.
The existing ending timeline remains: fade over 0.7 s from `HOME_ENDING.fadeFrom`, silence at `musicEndsAt`, and the
closing line two seconds later at `creditsAt`. This first integration does not edit the recording to align its musical
cadences with individual story beats. Restored `reunion` and `drawing` checkpoints start at `homeEndingTime` seconds
into the recording. `homeEndingSounds = false` and `homeMusicDucking = false` keep the existing cue and ducking rules.
Render the ending with `node tools/ending-audition.mjs`.

**Recorded asset lifecycle.** Vite emits the six original Ogg files as separate hashed assets. `music-loading.ts`
downloads only the starting recording alongside world construction and shader compilation, with no AudioContext
before Begin. Begin unlocks audio and decodes while the chosen room prepares its first frame. The veil waits for
both, showing "Preparing music" for waits over 150 ms. Sound-off and music-off skip preparation; switching either
off cancels an in-progress start. A 20-second deadline bounds download/decode failures so ambience can still begin.
During play, a single compressed prefetch slot warms Still's second recording on the island, Lines on the first crossing, Boats in Lines, Birches in Meadow,
and Home in Mirror. `Soundscape.prepareMusic` consumes that download and decodes at the existing arrival handoff.
Playback uses an `AudioBufferSourceNode` on the shared
audio clock, so mute-all and hidden pages freeze it without separate media autoplay permissions. Music-only mute
leaves an existing score's clock running, but does not start downloading new muted scores. A live decoded Home
buffer is about 65 MiB at 48 kHz; Birches is about 57 MiB. Exit releases
the buffer, aborts an unfinished fetch and prevents a late decode from starting playback. The browser HTTP cache
retains downloaded files for revisits. Failed fetches/decodes log a warning and leave that score silent.

Synthesised scores repeat their sections to fit player pacing and release voices on phase changes. All scores release
over 1.8 s on exit (0.12 s for permanent silence), disconnect finished voices and buses, and freeze with the shared audio clock when muted or
hidden. Missed frames skip stale attacks rather than bursting.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the plucked shape in Boats, the
Meadow melody itself, the whole question in the drowned village's boat tune (asked on the drift,
unchanged when the boat comes home, gone cold to D–E–F as the dark comes), a stretched recollection at sea, and D–E–F
on the Sleeping climb.

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

Motion sounds come from changes in physical state, never from completion cues: curtains, scarf
working, releasing and gathering, paper and doors. New sources, inactive sources and the first frame after resume
establish a silent baseline, so completed actions are never replayed. Every source has distance attenuation, screen
pan and bounded scheduling; finished nodes disconnect.

- Birches: leaf scuffs follow the child's footfalls on authored leaf-covered ground (the initial litter map, not
  readbacks) and the cygnet's heap kicks, sharing one `leafScuffEvery` budget; particles and wind never trigger them.
  `leafScuffLevel` is 3 dB above the original level, independent of wind and grass rustle.
  Swing creaks need real travel and a reversal, `swingCreakEvery` apart. Both attenuate over `birchesFoleyNear/Far`.
- Sail: one quiet canvas fold at full droop (`sailSettleAt`), re-armed only after a refill below `sailSettleRearm`;
  flutter sounds only on fresh rises, `sailEvery` apart. Toy-boat flutter is silent.
- Laundry: local wind on the cloth's spring and flutter thresholds, at most `clothSources` voices. A passage sheet's
  peg coming off the line snaps once (`peg`), from the peg itself; pegs already off when a checkpoint loads are silent.
  `pegBoostDb` raises the snap and wooden knock by 6 dB after Jeremy's Lines playtest. The family garments filling
  and reaching toward each other are silent. Each rotary gives one metal-bearing creak after real angular travel:
  `rotary-creak.ts` layers an irregular slipping squeal, lower strain and two short collar rattles. Jeremy rejected
  the former filtered rasp after hearing it isolated; the replacement lasts 0.72 s and awaits his listening review.
  Its level is separate from the little pinwheels’ flutter; Jeremy’s
  request to quiet the spinners referred to those pinwheels. A small cloth sound follows the snag release. Idle, restored and muted events stay silent;
  missed creaks expire rather than playing on unmute.
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
- The Lines pinwheels share one flutter voice, controlled by `linesToys.pinwheelFlutterLevel` and reduced about
  9 dB after Jeremy’s playtest. Out of reach it fades, stops and disconnects; returning makes a new voice.

## Start-up and lifecycle

The Music button mutes background scores and the shared pad through separate dry and reverb-send gains.
Existing reverb tails ring out. Wind, wildlife, physical sounds, gesture chimes, story cues and the playable piano
remain audible. The score keeps following the story while music is muted; arrivals and endings cannot override
the preference. The Sound button and M shortcut still mute everything. `tools/music-mute-check.mjs` renders both
music routes and the effects routes through this control.

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
- The drowned village's score (`drowned-score.ts`) awaits Jeremy's listen.
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

Current implementation: move the title to crossing seconds 34–41 (three-second rise, one-second hold,
three-second fade), enlarge its type from 36 to 40 px at desktop, and send a six-second wind front through the
existing Still flower patches starting at second 31. Replace the coast-shaped Lines concealment with a horizon-wide
distance veil, preserving the farewell before drawing the visibility range inward. Move both Lines handoff gates
six seconds earlier. Disable the falling phrase and its pitched landing note through `audio.stillFallTones`, keeping
the synthesiser available and preserving physical sounds. The main boat's propulsion and leeway read the prevailing
breeze independently of local gusts; its sail, pennant and heel still read the live field. Remove the offshore washing
line without substituting a new attraction yet. Validate audio, ordinary-versus-gust passage timing, title/gust timing,
the continuous reveal and the production build. This supersedes the earlier title and coast-mist experiments above.


Checks for this refinement: production build; 50 Still audio checks and 51 Lines score checks; all eight measured
passages complete with the same elapsed time under calm and sustained player gusts (Still → Lines: 117 s in both).
The sail regression also checks opposing gusts and lift at 30/60/120 Hz: identical hull speed and path, continued
cloth response. Storm/steering, haze continuity and 24 crossing-camera cases pass. The title and horizon browser
replay samples actual GPU concealment and airborne petals; capture paths and final result are recorded below.

The horizon/title replay passes: the title reaches full opacity at 37.5 s and is gone at 41 s, before the child
crosses its centre. The real wind lifts visible petals during the 31–37 s sweep. All 117 dry-land probes stay fully
concealed through second 95; the shoreline is partially visible at 105 s (80.5 units away) and clear at 115 s
(39.7 units). Twelve bearings beyond the visibility range are equally concealed throughout. Captures:
`/tmp/updraft-horizon-33.png`, `/tmp/updraft-horizon-37.5.png`, `/tmp/updraft-horizon-39.5.png`,
`/tmp/updraft-horizon-65.png` and `/tmp/updraft-horizon-105.png` (opened in Preview).

The separate full bandaging-to-departure browser rerun was cancelled while waiting for another session's GPU
check; this pass verifies title timing in the actual continuous crossing and audio behavior in the offline
production checks. It does not claim a new full rescue playback run.


## First-whale visibility, music gap and shore echoes — 2026-10-11

Jeremy's brief (verbatim):

> ah ok first,
> 1 ) the whale encounter is now in the fog and can't really be seen by the player. maybe the fog is a bit too restrictive?
> 2) how much silence is there now between the lines music and the end of the still_2 music? is it too much? should we move the still island slightly closer or the easier solution being to increase the speed of the boat a tiny tiny bit to cut it down by a few seconds?
> 3) I do think we should have the same kind of water wave effect as with the whale encounter later in the game when the whale dives. and yea i think you're right, if we have a pieces of laundry flying away and a gull carrying a scrap of linen, that would be a nice pre-dream echo. after the whale, there's like no animals or birds, which is probably why it feels a bit empty. what do you mean by the reflection of washing? Let's leave that for now and revisit it after above is done

Plan: keep a broad clear horizon through the complete first whale surfacing and dive, validating the whale itself
as well as hidden Lines. Measure native audio and story time from the actual post-bandaging throw to Lines before
choosing a pacing correction. Reuse the later whale's physical spreading swell at the first dive. Add sparse
post-whale gull life, one bird carrying a linen scrap, and a couple of loose pieces of cloth carried by wind.
The washing-reflection idea is deferred. Preserve the title, original supplied music and fixed player-independent
propulsion; any new timing should be explicitly recorded below.

Jeremy added (verbatim):

> yea, can we make it deterministic between when the child makes that paper aeroplane throw and when they get into the boat? e.g. disable the ability for the player to randomly blow the paper plane around etc.

The post-bandaging departure now owns the input: one aimed throw to a fixed inland pickup spot, wind-independent
settling flight, a direct walk, pickup and the existing boarding animation. Earlier catch remains interactive.
The baseline native-audio replay measured 21.47 s from throw to crossing and 13.97 s of silence before Lines.
Re-measure after the authored departure before changing the boat speed or island placement.

Final timing pass: the authored throw-to-crossing interval measured 20.25 s in two full native-audio replays.
Both Lines approach gates now use a 12-second lead adjustment (previously 6); the actual silence after Still’s
1:58 endpoint measures 6.90 s, down from 13.97 s in the baseline. Boat speed, geography, title and whale timings
are unchanged. The horizon stays clear to 205 units, fully hidden beyond 260, through the whale; both it and
the ordinary distance haze close in only after crossing second 60. The first dive uses the shared physical
swell, with independent expiry so the inactive later whale cannot erase it. Two gulls begin their pass at
second 69, one carrying linen; two loose handkerchiefs follow on the air. The existing cloth solver animates
all three pieces. A single quiet gull cry accompanies the pass. No washing reflection is added.

Validation: production build and targeted Still/Lines audio checks pass. Real child/plane/boarding checks cover
opposing gusts at 30/60/120 Hz; only the releasing hand’s small wind sway and a pickup callback frame differ.
The GPU horizon replay keeps all 117 dry-land probes hidden through second 95, then reveals the near shore
continuously. The separate full crossing capture keeps the whale clear throughout the dive, observes the
physical swell, and sees both gulls and all three linen pieces from the sailing camera with no browser errors.
The first visual pass sent loose cloth above the frame; the corrected lower pass is captured at
`/tmp/updraft-first-crossing-84.png`, `-98.png` and `-106.png`; the whale is at `-52.png` and `-56.png`.
Cloth stability/bill attachment, swell ownership/expiry, haze continuity and crossing-camera checks pass.


## Secured plane, whale fades and horizontal title gust — 2026-10-11

Jeremy's brief (verbatim):

> - the whale sort of just teleports in, and then teleports out under the water. can it sort of fade in a bit better?
> - instead of just disabling the ability for the player to create wind temporarily on the still island, just have the child  hold the paper plane at the state of the sequence i.e. attach it to her backpack. then the player can still create wind throughout the entire sequence.
> - the "updraft" on still island i think needs to be a little more horizontal from left to right in the direction of the direction of travel, instead of simply "upwards", and a tasteful amount of windlines would be good too.

This supersedes the single departure throw and input lock above. Secure the plane on the satchel from the tree
sequence through boarding; keep player wind available throughout Still. Start `still_2` as she sets off for the
boat after bandaging, keeping source second 8 and the 1:58 cutoff. Re-measure the shorter walk-to-boarding interval
and music gap. The first whale's body and underwater silhouette ease in over 3.5 seconds and disappear over the
last 4 seconds of the encounter; its surfaced portion stays fully visible. The later whale retains its own
visibility choreography. The title gust uses the shot's ground-projected screen-right direction, lower lift and
sparse, thin windlines. Keep the title/camera/whale cue times and crossing propulsion unchanged.


## Post-whale framing and livelier shore echoes — 2026-10-11

Jeremy's brief (verbatim):

> i think when the child is crossing over to the island of lines, the camera is pointed down and static too much, and so all the activity you added in the sky is hardly noticed. I need you to think more carefully about the sea gull flying, the sheets flying (right now there's only one sheet that isn't really tumbling through the air as much as it is just a square awkwardly being "panned" across the sky), and the framing of them in the camera.
>
> It might be nice as well to have a little bit of activity from dolphins following the whale. Or maybe something cheaper if you can think of anything to help make the journey feel a bit more alive. Or maybe it's really just a matter of having more than one clothesline sheet flying around in the sky, and more than 2-3 gulls.
>
> The lines music starts like ~2 seconds too early i.e. it starts playing even though the fog hasn't revealed the island of lines yet. Either increase the speed of the boat by like 1% or something and tone down the fog a tiny bit to get more a feeling of an expansive sea.

Plan: stage six gulls and four loose pieces of linen in the same post-whale shot, with the bill-carried scrap
as a separate detail. Give the loose cloth angular motion and uneven lift, keeping the existing cloth solver's
folding and bill attachment. Ease the camera up and slightly back after the whale, give it a slow lateral drift,
and return gently toward the visible shore. Open the horizon veil moderately and start Lines about two seconds
later; keep boat propulsion fixed. Evaluate this pass before adding another dolphin encounter. Check whole boat
and child silhouettes, simultaneous visibility of birds/cloth, actual tumbling over time, and music/reveal alignment
in a continuous crossing. The earlier secured-plane replay measured 17.03 s to boarding and 3.95 s of silence.


The first rendered sky pass kept the full boat in frame and opened roughly the upper half of the image to the sky.
All six gulls crossed visibly, and the loose sheets rolled through different orientations, but their entrances
lagged the flock. Move their staggered release earlier so several sheets and most of the gulls share the shot.
The revised reveal already shows the Lines shore around crossing second 100.

The shorter direct walk exposed an old camera assumption: the boarding shot aimed at sea level while the child
was still uphill. Keep its target at the child's height and reserve her full silhouette alongside the boat.

Native-audio replay with the revised music gate: 17.03 seconds from the walk cue to crossing, 5.89 seconds from
Still's scheduled 1:58 endpoint to Lines. Lines begins at crossing second 98.86, about two seconds later than
the previous gate; the rendered shore is visible around that time. Boat speed and crossing duration remain fixed.
The secured-plane browser check confirms zero launches, live pointer gusts, no muted interval and source-second-8
playback continuing across boarding. The first whale fade and title sweep browser replay passes.


Jeremy's follow-up (verbatim):

> i think the sheets flying are not organic enough. they are all in a single line evenly spaced at the same height, and i presume all moving at the same speed and direction..

Replace regular releases and shared flow with per-sheet launch time, depth, altitude, pace, curved wind bearing,
lift rhythm and tumble axis/rate. Preserve coherent prevailing wind, but let individual pieces rise, dip, linger
and overtake each other. Verify changing projected heights and uneven gaps over a sequence, not one still.

The four loose pieces now have separate irregular release times, launch depths and lateral offsets, base
altitudes from 4–12 units, curved bearings and independently breathing speeds. Their lift, rotation axes and
turning rhythms differ, including opposite tumble directions. Reduced backlighting lets folds read as cloth.
The physical checks cover distinct heights/speeds/headings at 30/60/120 Hz; the browser checks also compare
projected vertical spread and overtaking, rather than merely counting objects inside the frame.

The recorded crossing replay passes: all five linen pieces enter the shot, at least four gulls and three loose
sheets share it, and a loose sheet turns substantially while visible. Independent checks on the capture data
confirm vertical separation and overtaking. Review clip: `/tmp/updraft-crossing-linen.mp4`; captures at
`/tmp/updraft-first-crossing-{88,92,100}.png`. Production and QA builds pass. The clip was generated but not watched;
these results establish automated checks and still-frame inspection, not visual approval of the motion.
The final secured-plane replay also passes with live pointer wind and uninterrupted source playback through
boarding. The close tracking camera added during this work caused a post-bandaging regression in Jeremy's
playtest. Removed its bearing override, subject fitting and variable distance/height, and removed the moving
pressed-grass patch. Jeremy's correction: "btw the boarding camera is still fucked up."
The first rollback missed the changed departure state: boarding now starts uphill. A real replay showed the
post-bandaging shot requesting distance 48.34 for 1.4 seconds, then reversing to 26 and aiming at sea level.
Keep the previous 26/6.5 boarding composition and .35 pace, enter it directly after bandaging, and keep its target
at least at the child's height until she reaches shore. Check from the bandaging sequence, not a restored boat.

## Title, wind and crossing timing polish — 2026-10-11

Jeremy's brief (verbatim):

> - the updraft title fades out a touch too soon
> - the wind sounds are a touch too loud in the game e.g. the wind that blows on still island before the title. It draws attention away from the title, which then disappears a bit too quickly
> - on the crossing to the lines island, the gulls should appear sooner. there's a stretch of empty space after the whale encounter that is a bit too long. The flying sheets either need to be a bit sooner as well, or a bit after. Right now, both these events are playing in the silence between when still_2 music stops and lines music starts which is a bit weird.

Extend the title's full-opacity hold from 1 to 2.5 seconds, retaining its onset and three-second fades: crossing
seconds 34–42.5. Apply `audio.windDb = -3` to the shared breeze, gust, whistle, grass-rustle and updraft audio,
including scripted weather. This does not alter the wind simulation or the sea, rain and music mix.

Keep the gull/linen sequence's start at crossing second 69, after the boat and camera turn, but shorten its
off-screen approach from 80 to 40 units so its visible pass arrives earlier under Still's recording. Keep the
existing individual sheet delays and flight behavior. Give the existing camera timing its own `afterFarewell`
value of 48, preserving the prior shot exactly when the birds' start changes. Camera composition, boat
speed, geography, fog, grass and the Lines entrance timing remain as previously set.

Jeremy's follow-up (verbatim):

> - with re: to the gulls and sheets, I think you've overcorrected. They are appearing out of nowhere while the camera is still panned over to the whale. A little bit of space after the whale is ok, just not as much as was before. Make sure things aren't teleporting into existence in the camera. It's ok for things to teleport in outside of the camera view though if required. I think you've picked up on this already
> - Also, i get the feeling that still_2.ogg is not playing all the way to 1:58 seconds. something is cutting it off early?

The gull group's initial bounds and each loose sheet are checked against the camera frustum at creation;
anything intersecting it starts beyond the incoming edge with a margin, then follows the existing continuous flight.
This adjusts only initial placement, never repositions visible objects, and preserves the camera.

The generic arrival fade began around source 1:56 and multiplied Still's own 1:54–1:58 envelope, making its tail
drop faster. Still's recording now reports its authored cutoff as its handoff time. Its Lines transition waits
until that time and then enters the rest with no additional fade. Other recordings retain their normal handoffs.
The native source still starts at 0:08 and stops at 1:58; neither the supplied asset nor the endpoint changes.

Verified from the real tree checkpoint through bandaging, boarding and Lines: gulls first enter around crossing
second 74 and loose sheets around 76, with several sheets visible before Still's fade. All six creation events
(the flock and five cloth pieces) occur outside the frame. Inspected captures at 68, 78 and 84 seconds; no video
was recorded. Still reaches its scheduled 1:58 endpoint without the arrival gate reducing its tail, followed by
5.89 seconds before Lines. Boarding remains 17.03 seconds. Production/QA builds, audio and arrival checks,
camera checks, and cloth/off-screen entry checks at multiple frame rates and aspect ratios pass.
