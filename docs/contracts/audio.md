# Audio

Home, the Sky Mirror, Birches, the stairs in the clouds, the drowned village, Lines and Little Boats play supplied recordings; Still experiments with triggered excerpts, and the open sea plays its recording as excerpts the whale's rescue calls for; the other scores and world sounds are synthesised in Web Audio.
`src/audio/audio.ts` (`Soundscape`) owns wind,
environment, the shared pad, gesture chimes, authored cues and calls, and runs one pass per rendered frame after the
camera update. Each room with its own composition has a score module that follows story phases, not timers:
`opening-score.ts`, `meadow-score.ts` and `sleeping-score.ts`. `recorded-score.ts` plays Home, the Sky Mirror,
Birches, Lines and Little Boats continuously across story phases, and the stairs' `clouds.ogg`, the village's
`village_approach.ogg` and `belfry.ogg`, and Still's departure once each (`recordedMusicOnce`); `phrase-clips.ts` plays excerpts of one recording as
overlapping clips for `still-phrases.ts` and the open sea's `sea-music.ts`.
The former `little-boats-score.ts`, `lines-score.ts`, `birches-score.ts`, `summit-score.ts`, `sea-score.ts`, `stairs-score.ts`, `drowned-score.ts` and `dream-score.ts` (notes in `dream-score-data.ts`) remain for historical studies and phase types, outside runtime playback.
`phrasing.ts` shares scheduling, lookahead, stale-attack skipping and introductory rests among them;
`arrival-music.ts` owns handoffs between pieces; `gesture-harmony.ts` the chord tones gestures may use.
`foley.ts` plays physical sounds and `world-foley.ts` / `birches-foley.ts` map object motion to them;
`environment.ts` derives habitat and coast weights; `foghorn.ts` is the Drowned lighthouse horn; `stairs-sound.ts`
and `stairs-air.ts` are the stairs room's air; `sliced.ts` paces start-up synthesis. The piano's tone is
`PianoStrings` in `audio.ts`. Feel, level and timing knobs live in `tuning.audio` (plus `tuning.piano` and
`tuning.storm` where noted).

Story code raises cues through `cue()` / `completeObjective()` in `src/story/cues.ts`; `takeCues()` drains the queue
once per rendered frame. Chapters expose optional score state (`linesScore`, `meadowScore`, `birchesScore`,
`sleepingScore`, `seaScore`, `seaMusicTime`, `stairsAir`, `arrivalMusic`, and so on); `main.ts` copies it into `SoundState` every frame
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

Every piece sits near one reference, about −29 LUFS in its main section. Home measures −14.6 LUFS and uses −14.4 dB
gain; Birches (`birches.ogg`, "A Question, Then a Gentle Answer", 224 s) measures −16.0 LUFS and uses −13 dB; the Sky Mirror measures −14.3 LUFS and uses −14.7 dB; the stairs' `clouds.ogg` measures
−14.5 LUFS over the 0–3:28 it plays and uses −14.5 dB; the drowned village's `village_approach.ogg` measures −15.2 LUFS
over the whole file but −19.3 LUFS over the 0–36.93 s it plays, and uses −9.7 dB; its `belfry.ogg` measures −18.0 LUFS
over the 7.97–54.05 s it plays and uses −11 dB; the open sea's recording measures −15.4 LUFS
and uses −13.6 dB (its crossing −19.7, rescue phrases −19.1 and close −13.8 LUFS before trim); Lines measures −17 LUFS and uses −12 dB. Little Boats measures −16.7 LUFS
and uses −12.3 dB. Still measures −23.3 LUFS across its
phrases and rests and starts at −6 dB (`stillPhraseDb`). These trims preserve the source dynamics and encoded bytes.
Their dry route avoids adding reverb to an already mixed recording. `roomTrimDb` trims
Sleeping +2.5 dB over its approved study level (`sleepingScoreLevel`). Its Home, Sky Mirror, Birches and drowned
village entries and their old score levels are historical, unused by recorded playback. With the experiment disabled, the opening grows about
5 dB with life (`openingPadRise`), keeping its quiet start. The grey
meadow, the wood and the Sleeping climb stay quiet by design; the wood's drone keeps its original level (`woodDroneDb`
0; Wood, below). Add new rooms at the reference.

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
title and whale. It fades over source 1:54–1:58 and stops before the next phrase (`recordedMusicOnce.stillDeparture`); the independent source envelope survives ongoing level updates and pauses with audio.
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

**Meadow and the piano.** The meadow plays cuts of four supplied takes (the playable prototype of 2026-10-15; Jeremy's
brief and the cut list are in [the design](../backlog/meadow-echoes/design.md), "Piano hill and the meadow score").
`audio/meadow-cuts.ts` is the one table of cuts per beat; `node tools/meadow-music-cuts.mjs` (SOURCES=<folder of the
takes>) cuts them from the takes into `meadow-walk.ogg`, `meadow-duet.ogg` (calls, answer notes and finale packed with
0.25 s gaps), `meadow-after.ogg` and `meadow-ending.ogg` (Ogg Opus, 48 kHz stereo, 20 ms edges unless a tail fade is
given), levels each to the room reference by measured loudness, and writes what it measured to
`audio/meadow-cuts-measured.ts`. Swapping a take or a cut is an edit to the table and a rerun.

- Landing to the stool: the walk (O 0–27.2) loops with 3 s rests. It arrives through the ordinary handoff from Little
  Boats and begins once the background gate is open, so its first note is not under the gate's rise; sitting fades it
  over `tuning.piano.fadeOut` (`pianoMix`), and it is released.
- The duet: the bough's four flute calls, her four piano answers, the flute finale and the cygnet's steps are the
  instruments' own voices, on the instrument route (sound-off silences them, music-off does not). Nothing sounds from
  the piano before the bough's first call. Each call starts with the bough's inhale so its first breath lands as the
  inhale ends; reply input opens after the flute's measured end. With no answer begun `callAgainAfter` (25 s) later
  the bough says the call once more, `callAgainDb` (−4 dB) softer, and then stays silent. Following the guide far
  enough plays the answer whole at its own tempo; her hands and the keys follow its measured onsets and melody notes,
  and stroke speed changes nothing. The next call waits for the answer to ring down, and the finale for the last.
  The guide tilts with the answer's overall rise or fall (`tilt`). Until the duet file is decoded the piano strings
  play the melody notes instead. The finale's colour front starts on the measured top of its opening arpeggio
  (`MEADOW_FINALE.greenAt`), when the cygnet starts along the keys: six footfalls on single notes cut from the
  answers' take, C4, A♭4 and E♭5 of the finale's chord, `stepDb` (−10 dB) under the answers so the flute leads. Its
  end raises no `restored`: the flute's finale is the reward.
- From the duet's end the warm bed plays through the flowers and seeds from `meadow_extended.ogg` (take E as Jeremy
  extended it): 0:22.60 to 2:53.05, then round from 1:36.60 with no rest, as a native loop (`loopStart`/`loopEnd`).
  The cut's last 0.6 s carries the source's lead into 1:36.60 under its own end (an equal-power crossfade baked in by
  the tool), so the seam continues the phrase; the tool's seam check measures it against the source's own
  continuation there. It fades over `listenFade` for the listening rest. The family's departure is silent. The ending
  (3:16.30 to the file's end, whose tail still sounds, so its last 0.5 s fade) plays once from the feather
  (`dropFeather`) or a `pond` restore; then silence until Birches' handoff.
- `MeadowChapter.meadowMusic` names the part; `audio/meadow-music.ts` plays it. The shared pad is silent in the meadow
  (`MOODS.meadow.level` 0) and the synthesised `MeadowScore` no longer plays; `meadowScore` remains story state.
  `hush` does not apply. Files are fetched ahead in Little Boats and on the crossing (walk, duet), during the duet
  (warm bed, ending) and after it (ending), decoded as their part nears and released once played; a start or restore
  in the meadow waits behind the veil for its first part. Music mute and hidden pages behave as for the other
  recordings. Decoded sizes: walk 10 MiB, duet 31 MiB, warm bed 55 MiB, ending 17 MiB.

The flowers' breath voice (`audio/meadow-breath.ts`) and the harebells use the F minor pentatonic (F, A♭, B♭, C, E♭)
of the recordings. The flower prototype's breath voice is synthesised in Web Audio from harmonics and filtered air at
`tuning.meadowEchoes.voice`, under the warm bed; the grey approach flower stays silent. `MeadowSong` smoothly shares the existing
`pianoMix` gate while the child and wind exchange seeds, then releases it; the warm bed ignores that duck. The final
listening rest gives the distant family call space before the crest.

**Birches.** Jeremy's 2026-10-11 instruction: "next if you can wire birches.ogg in for birches island music".
`assets/music/birches.ogg` ("A Question, Then a Gentle Answer") replaces the synthesised score from the approach
crossing through boarding and departure. The existing `walk`, `swing`, `scarf` and `return` phases still describe
story progress and checkpoint state, but never seek, restart or rearrange the recording. Jeremy (2026-10-14/15):

> my thinking for birches is the logic can be pretty simple. if on birches island, loop, else don't loop and let it finish up. And then on the stairs chapter, just have a hard stop for silence if it's still somehow playing before they enter the clouds and start the penrose stairs sequence.

> My feeling is that there should be silence as they enter the cloud and do the penrose puzzle up until the nest. it builds up a climax i think? And it kinda fits the idea of them being in the clouds (a place they aren't normally supposed to be, so theres no music which makes it feel slightly more awkward)

It loops only while the story is on the Birches island or its approach (`toBirches`, `birches`: `SoundState.birchesLoop`).
Once they have sailed (`toStairs`, `stairs`) it stops looping (`RecordedScore.playOut`): the pass under way plays to the
end of the file and stops; begun there (a `toStairs` or `stairs` start) it plays once. In the stairs, if it is still
playing when they go up into the white (`StairsAir.phase` leaves `under` as the bird goes first, before the loop), it
stops over `birchesCloudFade` (1 s; a cut would click) and never starts again in that room. Silence then holds
through the white and the loop until `clouds.ogg` on top of the cloud (below).

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

Measured with no input on the game clock (`tools/village-music-browser-check.mjs`, at 60 fps, the audio clock in step):
from `?chapter=drowned` it starts with the chapter and ends at 36.9 s; the boat holds and the tub becomes the player's
to push (`StrandedCat` `waiting`) at 33.0 s, while the cat is still coming down the slates, and the tub's drawn
invitation appears at 46.6 s. From `?chapter=cloud` (the real handoff) `clouds.ogg` ends 227.1 s in and the recording
starts 3 s later, 5.6 s before the village chapter itself (the boat still coming down through the fog); it ends 31.3 s
into the chapter, 0.3 s after the tub becomes pushable (31.0 s) and 13 s before the first invitation (44.6 s). The
cut point is Jeremy's to move.

**The belfry's goodbye.** Jeremy (2026-10-15), verbatim: "ok best i think i can do is belfry.ogg, starting from 8
seconds 54 seconds - and fades in slowly after the last bell plays". A short bittersweet goodbye that "blends easily
into the storm that follows". The unchanged `assets/music/belfry.ogg` (143.9 s) plays once on the dry music route from
7.97 s, just before the attack at 8.0 s, to 54.05 s, just before the next at 54.1 s (both low notes under a sustained
texture, checked below 250 Hz on the decoded samples), fading over its last 2 s (`recordedMusicOnce.belfry`). It
measures −18.0 LUFS over that stretch and uses −11 dB. It begins on the bell's fourth ring (`DrownedChapter.bellsRung`;
the 90 s gust's ring counts), coming in from silence over `enterOver` (5 s), and keeps its own audio clock: sailing the
boat round, climbing down, boarding, the look back and the cat's slow blink never cut it, and the storm's start does not
stop it; it plays on into the storm to its own end fade and never restarts. The storm is otherwise silent. It is
decoded once she is in the belfry (`drownedScore` `refuge`/`home`) and prefetched in the village after the approach.
`?chapter=belfry` plays it after the fourth ring; a `storm` save is past the bells, so it starts on load from 7.97 s
with the same slow entrance; the wood never plays it. Music switched on later joins at its own time. Its key reads as
D♭ major / F minor, a long way from the bell's B strike (`note` 59).

Measured with gestures ringing the bell and no input after (`village-music-browser-check.mjs belfry`, game clock from
the fourth ring): it starts with the ring and is at full level at 5 s; she starts down at 4.5 s, steps aboard at 27.5 s
and is seated at 30.3 s; the storm begins at 40.9 s; the end fade runs 44.1–46.1 s, about 5 s into the storm. From a
`storm` save it starts on load, the storm begins at 10.6 s and the piece ends at 46.1 s.

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
The release raises no `restored` cue: as in
Little Boats, the recording carries the conclusion, and the cue's D-major bell and duck would cut across it.

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
`mirrorSeamSoonest` (0.3 s) ahead, across the loop if need be. The recording fades to silence over
`mirrorSeamRelease` (1.2 s; shorter if the seam is nearer) ending exactly at the seam, so the last phrase's quiet tail
is eased off and the next attack never sounds: over the seams the fade begins on average 22 dB under full scale. If
no seam lies in that window, it stops at the earliest seam still `mirrorSeamLatest` (1 s) before Home; if there is
none, it fades over `mirrorFallbackFade` (3 s) at once. The background is silent from the seam until Home.
A later Home start (past landing, for the hilltop) holds across landing: the handoff keeps the audio-clock time it
last took from the crossing.

Edge cases. A Mirror not sounding as the boat leaves (music off, still decoding, `?chapter=toHarbour`) leaves silence
at once and Home still begins `homeStartAfter` into the crossing; a restored crossing counts from its own saved time.
The crossing clock keeps Home with the boat through suspended audio. Music switched off when Home is due, then back on,
joins the recording where it would have been (fading in) rather than from its top. `home`, `jetty` and `summit` starts
begin Home with the chapter. `tools/homeward-audio-check.mjs` checks the seam chosen for several leave times
(the loop and both fallbacks), renders the Mirror silent from its seam and Home beginning on time, and retries a
dropped download; `homeward-audio-browser-check.mjs` measures the whole handover from `?chapter=mirrorEnd`.
Landing, the updraft, the flight and the walk keep the same playback clock; the whole recording loops if needed.
The existing ending timeline remains: fade over 0.7 s from `HOME_ENDING.fadeFrom`, silence at `musicEndsAt`, and the
closing line two seconds later at `creditsAt`. This first integration does not edit the recording to align its musical
cadences with individual story beats. Restored `reunion` and `drawing` checkpoints start at `homeEndingTime` seconds
into the recording. `homeEndingSounds = false` and `homeMusicDucking = false` keep the existing cue and ducking rules.
Render the ending with `node tools/ending-audition.mjs`.

**Recorded asset lifecycle.** Vite emits the eleven original Ogg files as separate hashed assets. `music-loading.ts`
downloads only the starting recording alongside world construction and shader compilation, with no AudioContext
before Begin. Begin unlocks audio and decodes while the chosen room prepares its first frame. The veil waits for
both, showing "Preparing music" for waits over 150 ms. Sound-off and music-off skip preparation; switching either
off cancels an in-progress start. A 20-second deadline bounds download/decode failures so ambience can still begin.
During play, a single compressed prefetch slot warms Still's second recording on the island, Lines on the first crossing, Boats in Lines, Birches in Meadow,
the stairs' `clouds.ogg` from Birches on (once the birches recording is in hand), the village's `village_approach.ogg` from the stairs' white on (once `clouds.ogg` is in hand: `nextMusicForChapter` takes the stairs' phase), `belfry.ogg` in the village, the open sea in Sleeping, the Sky Mirror on its crossing, and Home in Mirror. `Soundscape.prepareMusic` consumes that download and decodes at the existing arrival handoff (the village's while the stairs' fog waits for `clouds.ogg`).
Playback uses an `AudioBufferSourceNode` on the shared
audio clock, so mute-all and hidden pages freeze it without separate media autoplay permissions. Music-only mute
leaves an existing score's clock running, but does not start downloading new muted scores. A live decoded Home
buffer is about 65 MiB at 48 kHz; the Sky Mirror about 79 MiB; the open sea about 87 MiB; Birches about 57 MiB; `clouds.ogg` about 98 MiB, decoded in the white; `village_approach.ogg` about 74 MiB, held only until its seam; `belfry.ogg` about 55 MiB, from the belfry to its end. Exit releases
the buffer, aborts an unfinished fetch and prevents a late decode from starting playback. The browser HTTP cache
retains downloaded files for revisits. A failed fetch or decode is fetched afresh after 1 s and again after 3 s
(`musicRetryAfter`), within the same 20-second deadline, so a network blip does not silence a room; a recording still
failing logs a warning and leaves that score silent.

Synthesised scores repeat their sections to fit player pacing and release voices on phase changes. All scores release
over 1.8 s on exit (0.12 s for permanent silence), disconnect finished voices and buses, and freeze with the shared audio clock when muted or
hidden. Missed frames skip stale attacks rather than bursting.

The piano's D–E–F♯–B question links the rooms: a three-note reed fragment in Lines, the plucked shape in Boats, the
Meadow melody itself, and D–E–F on the Sleeping climb.

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
  3 s, rests `seaArrivalQuiet` (1 s) and the gates reopen over `seaArrivalFadeIn` (1 s), clear before the recording
  begins at `seaMusicLead`; sea → Mirror waits until the whale has gone; the stairs → Drowned is asked for in the stairs' fog and waits for `clouds.ogg` (below); the village's recording enters at full level, without a fade-in (`villageArrivalFadeIn`); Drowned requests Wood
  only after the lost-plane scene: out of the storm, silent by then, the wood's drone comes in over `forestMusicBlend` (4 s) with
  the gates open, tuned on D/A before it is audible; Mirror → Home is scheduled from the boat's leaving, the Mirror ending at a phrase seam
  (Homeward and Home above).

- A once-played recording marked `holdsHandoff` holds any request until its own end fade is done, with no phrase-wait
  cap; the handoff then skips its fade (the recording has faded itself) and keeps the rest and fade-in. A recording
  already over leaves the handoff as it was.

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

- Under the cloud the birches recording plays out the pass it was on when they sailed (Birches, above). Each flight that docks raises
  `flightHome`, a soft wooden knock and puff outside cue ducking (`flightKnock`); the last flight also plays the
  completion phrase. The cygnet's `puzzled` peep asks when the loop brings it back to where it set off.
- In the white, if the birches recording is still playing, it stops over `birchesCloudFade` (1 s) and never starts
  again in this room; there is no music through the white and the loop. The wind is close and muffled and climbs with
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

Levels: `stairsAir`, `stairsAirLevel`, `recordedMusicDb.clouds`, `birchesCloudFade`. `node tools/clouds-music-check.mjs` checks the
recording's start, entrance, end, hold and gates offline; `node tools/stairs-audio-proposal.mjs [outDir]` renders the
room's arc against a dev server. `stairs-score.ts` (the earlier synthesised bloom and sail) remains for studies.

## Checks

`npm run check:audio` runs the offline audio and score checks in headless Chrome against a running dev server (no GPU);
the list and the browser audio checks are in [testing.md](../testing.md). `node tools/audio-interruption-check.mjs`
covers start-up pacing, interruptions, piano reservations across mute, the cached output graph, the foghorn's
preparation and the pinwheel voice. `node tools/music-transition-audit.mjs` renders every handoff and all score
sections. `node tools/village-music-check.mjs` covers the Birches play-out and stop in the white, the village's
recording and the silence after it, the belfry's goodbye, the storm and the wood's drone level; `node
tools/village-music-browser-check.mjs [drowned cloud belfry storm]` measures them in the real game.

## Open

- The stairs: the sail's air over the cloud awaits Jeremy's listen in the game, and the moment `clouds.ogg` starts
  (on `clear`) and the settled high air await his playtest (`cloudsMusicDelay`, `highSettled`).
- The drowned village: whether `village_approach.ogg`'s end (just before the bass, 36.93 s) sits right against the
  first challenge (it ends as the tub becomes pushable from the stairs, about 4 s after it from `?chapter=drowned`);
  the belfry's goodbye (`belfry.ogg`, its 5 s entrance and where its end falls in the storm) awaits his playtest.
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
line without substituting a new attraction yet. Validate audio, passage timing, title/gust timing,
the continuous reveal and the production build. This supersedes the earlier title and coast-mist experiments above.


Checks for this refinement: production build; 50 Still audio checks and 51 Lines score checks; all eight measured
passages complete (Still → Lines: 117 s). Storm/steering, haze continuity and 24 crossing-camera cases pass. The title and horizon browser
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
