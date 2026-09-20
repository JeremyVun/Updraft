# Island score listening proposals

September 20, 2026. Jeremy requested listening proposals before any new music is added to the game.
These three studies address the score's largest reuse gaps. Little Boats, the revised sea arrangement
and the revised Sleeping arrangement are approved and implemented locally. Jeremy rejected the transition proposal;
keep the existing transitions unchanged.
The approved current home melody remains intact.
Jeremy approved the September 21 Meadow background study below; it is now integrated locally.
Jeremy also approved the revised Birches composition after hearing its isolated music layer; it is integrated locally.
Jeremy approved the Lines study with a slightly quieter melody; it is integrated locally with a 1.5 dB melody trim.

## The three studies

| Scene | Proposal | Listening structure |
| --- | --- | --- |
| Little Boats | Rounded plucked notes, a six-beat sway and small answering phrases. A distinct early-play arrangement in the existing key family. | 36 seconds: first toys, moving fleet, a varied second phrase, opening toward the sea. |
| Sleeping | Sparse felt piano over open minor harmony. Fewer notes through the cold; warmer major voicings beneath morning and a quiet piano answer after the flight cue. An independent theme, not a replacement home melody or a reprise of the meadow puzzle. | 48 seconds: bedside 0–12, cold ascent 12–28, flight/morning from 28, piano returns at 40. |
| Long sea crossing | Stable, overlapping sustained chords, a slow upper line and plucked detail that develops over time. The arrangement recedes around the companion's swim. | 60 seconds: open water, widening from 18, intimate swim 35–45, then a return to open water. |

These are condensed musical studies. They do not propose shortening chapters or switching musical states on
fixed timers. Any approved implementation must follow actual scene progress and preserve player gesture
feedback, authored cues and the source/timing rules in `contracts/audio.md`.

## Reproduce and compare

Render the comparisons:

```
node tools/audio-island-proposals.mjs /tmp/updraft-island-proposals
```

Requires local Chrome and ffmpeg. The tool serves a temporary source snapshot so concurrent game changes
cannot alter a comparison midway through rendering. `tools/lib/island-score-proposals.mjs` contains the preview compositions.
The renderer creates the current production music, proposed music and a shared environment/gesture stem.
It matches music-stem integrated loudness, applies one common playback gain to each comparison pair, and
retains the same environment and story sounds in both alternatives. Rendering never changes runtime code.
The original Boats comparison retains the former Lines background as its historical baseline.

Outputs include WAV and MP3 files, isolated stems, note schedules, source hashes and `proposals.json` with
levels and gain adjustments. Each comparison is current music, a two-second gap, then the proposal:

- `boats-comparison.mp3`: proposal begins at **0:38**.
- `sleeping-comparison.mp3`: proposal begins at **0:50**.
- `sea-comparison.mp3`: proposal begins at **1:02**.

Each also has `*-current.mp3` and `*-proposal.mp3` for direct listening. These are rendered fixtures, not
gameplay recordings. Numerical validation cannot decide emotional fit.

Validation: all nine MP3 exports decode as stereo at their expected durations. PCM exports have no clipped
samples; final peaks range from −9.2 to −7.1 dBFS. Both preview modules pass Node syntax checks.

## Decisions

- **Little Boats:** Jeremy: “i love the melody composition you came up with for the little boats.” Integrated
  in `src/audio/little-boats-score.ts`, with the exact pitches, rhythm, dynamics and instrument recipe from
  the approved study. Its 36-second phrase repeats on a chapter-local clock, fades on departure and gives the
  existing delight/completion cues space. Wind chimes retain their response. The approach crossing retains Lines.
- **Sea:** Jeremy was willing to try it, but “melody notes were a bit too loud.” He requested another look at
  the passage's role in the whole journey, its shots and scripting before choosing a better background.
  After hearing the revision below: “it sounds nice, have a go putting in your sea-proposal revision.”
  Implemented locally in `src/audio/sea-score.ts`; it applies only to the long dolphin crossing.
- **Sleeping:** Jeremy approved the revised 108-second study below, then chose “Keep the flight phrase only.”
  Integrated with pauses driven by the story; its second full completion phrase is removed.
- **Home:** existing `unfold` melody approved; the earlier proposed lullaby replacement is rejected.

## Sea revision after scene review

The current route is Sleeping → long sea → sky mirror → harbour → home. The sea follows the bird's brave
flight and the child's recovery. Its job is companionship and breathing room before the mirror, with room
for the animals and the player's wind. Older descriptions placing it directly after the wood are historical.

Reviewed `CrossingChapter` and a complete real simulation capture through mirror arrival, including the
wide dolphin encounter, closer swim and return to the child's arms. In this run, the bird grew restless at
45 seconds, perched at 50, swam at 57–89 and settled back at 92; mirror arrival was around 151 seconds.
These are observed timings, not fixed musical triggers. The swim stayed in frame for all 1,740 sampled
frames. Captures: `/tmp/updraft-sea-score-context-*.png` and `/tmp/updraft-sea-score-context.webm`.

The revised 60-second study keeps the same scene-sound stem and matches overall music loudness for comparison.
It reduces the melodic voice relative to the sustained harmony, softens its attack, removes the high F-sharp/E
rise, thins the plucked detail and leaves the condensed swim without piano or a lead melody. Close sustained
voicings continue underneath; the return has a small melodic fragment, with no new reward phrase.

```
node tools/audio-island-proposals.mjs /tmp/updraft-sea-refined --sea-refinement
```

`/tmp/updraft-sea-refined/sea-proposal.mp3` is the revision alone. `sea-comparison.mp3` plays the first proposal,
two seconds of silence, then the revision at **1:02**. This remains a condensed study; runtime timing follows
the real story states described below.

## Sea integration

The approved notes, quiet melody levels, instruments and relative mix are preserved. The study's sections
expand to fit the passage: opening music while sailing; the sustained B-minor harmony from the bird becoming
restless through swimming and drying; the short return phrases once it settles in the arms; the final open D
harmony as the pod leaves on the coastal approach. Sections repeat as needed and crossfade over 1.8 seconds.
No new reward cue or home-melody variation was added.

`CrossingChapter.seaScore` provides the section from actual swim state and route progress. The long route and
its legacy home-bound counterpart use it; ordinary transfers retain the original sea pad. Sleeping now has
its own approved morning arrangement. Entry after a saved swim starts in the return/approach section. Gesture notes remain responsive in every
section, and updraft chord tones follow the score. Muting or hiding freezes the shared audio clock; departure
and the ending cut stop scheduling and release all voices.

`tools/sea-score-check.mjs` verifies note and waveform parity with the approved study, phase timing, stale-frame
recovery, saved swim entry, gesture coexistence and cleanup. `tools/sea-score-browser-check.mjs` follows a full
real passage through the mirror, including mute/resume and final voice release. `tools/sea-logic-check.mjs`
also checks score state during calm and strong-wind runs and legacy restoration.

Validation passed: 36 focused sea-score checks, 87 shared audio assertions with five output renders,
27 Little Boats regression checks, ten real chapter fixtures, calm/strong-wind passage simulations and
the production build. The full production-build passage followed open → swim → return → arrival → off
without a state mismatch over 8,905 audio frames. It preserved mute/resume and wind chimes, peaked at
23 active score oscillators, and released every phase bus after mirror arrival.
Evidence: `/tmp/updraft-sea-score-browser.json` and `/tmp/updraft-sea-score-check.wav`.

Little Boats verification: `tools/boats-score-check.mjs` checks approved-note parity, scheduling at 10–144 Hz,
stalled-frame recovery, cue space, gesture coexistence, departure/re-entry and oscillator cleanup. The shared
audio checks, real chapter-wiring checks and production build are also run after integration.

## Sleeping revision: shelter, cold, courage and morning

Jeremy asked for a proposal grounded in what Sleeping communicates, including silence where needed.
Reviewed the current chapter, the successive approved revisions in `sleeping.md`, and frames/state timings
from `/tmp/updraft-sleeping-approved.webm` and its motion log. In that recording sleep begins at 49 seconds,
snow holds the bird at 102, mist at 125, unbinding starts at 139, commitment at 161, the glide at 166,
waking at 177 and the lap at 189. These are one player's timings, not score triggers.

Sleeping follows the child's care for the bird through the wood. It reverses their roles: welcome shelter
becomes unsafe, the unanswered call leaves the bird responsible, and the healed wing lets it release morning
for the child. The long sea afterward supplies wider companionship and relief; this chapter's ending should
stay intimate. The warm hearth, its extinction, the physical ribbon tug and the deliberately silent clock
matter more than adding a continuous dramatic accompaniment.

The approved 108-second study is retained in `tools/lib/sleeping-score-proposal.mjs`:

| Time | Scene and score |
| --- | --- |
| 0:00–0:18 | Open harmony and an unfinished piano phrase by the fire. |
| 0:18–0:36 | Music decays away as the refuge freezes; the unanswered call has no background score. |
| 0:36–0:54 | A quieter descending fragment accompanies the feather and winter ascent. |
| 0:54–1:10 | Music withdraws again for the wing, ribbon and decision to leave solid ground. |
| 1:10–1:29 | Existing flight cue first; sustained warmth enters after five seconds. The former completion at 1:21 is removed. |
| 1:29–1:48 | A warmer answer to the bedside phrase as the two settle together. |

The score has no hidden drone in its two rests. Physical sounds, weather, calls and the player's gesture
chimes remain; silence in the accompaniment must never mute playable wind. The melody is independent of
both the meadow puzzle and the approved home melody.

Reproduce with `node tools/audio-island-proposals.mjs /tmp/updraft-sleeping-score-revised --sleeping-refinement`.
`sleeping-proposal.mp3` is the revision; `sleeping-comparison.mp3` plays current music first, then the revision
at 1:50. Both use the same condensed scene-sound stem. This is a rendered study, not audio from the recording.
Music loudness is matched; the shared playback adjustment preserves the gaps. Output has no clipped samples;
the accompaniment falls below −90 dBFS in the checked 0:24–0:35 and 0:58–1:09 windows, after reverb tails.
Jeremy approved its composition and pauses. The original audition had `lifted` at 1:10 and `restored` at 1:21;
their shared rising opening sounded repetitive. He chose to retain only the flight phrase. New renders omit
the second phrase; the previously delivered `/tmp/updraft-sleeping-score-revised` files preserve what he heard.

## Sleeping integration

`src/audio/sleeping-score.ts` retains the approved notes, instruments and +16.9 dB music balance, excluding
the preview's common playback boost. Shelter accompanies arrival and settling into bed. The first frost
starts a true background rest through the unanswered call and feather departure. Climbing, snow and mist
share the sparse descending phrase; unbinding through the physical ribbon tug share the second rest.
The release starts morning: five seconds for the flight cue alone, warm harmony, then the piano answer at
nineteen seconds. Landing emits no second completion phrase. Checkpoint restoration selects climb or morning
without reward cues. Shelter/climb repeat after 32 seconds and morning after 48, leaving breaths between phrases.

Phase changes release old voices over 1.8 seconds. Both dry piano and its reverb send follow the score's
phase gate; the generic wood/sea pad is suppressed throughout Sleeping, including both rests. Wind gesture
notes, weather, physical sounds and the authored call keep their normal ownership. Leaving the chapter stops
the scheduler and disconnects its voices; hiding/muting freezes the shared audio clock.

`tools/sleeping-score-check.mjs` verifies approved-note and instrument waveform parity, long rests and
scheduling at 10–144 Hz, reward removal, gesture coexistence and cleanup. Its production score/reverb render
measures both settled rests below −90 dBFS. In-game emotional fit remains a contextual listening check.

## Transition comparison — rejected September 21, 2026

Jeremy: “keep what we currently have for transitions, dont touch them.” Preserve the current transition
behavior, including the shared pad's pitch glides and chord clock. The proposal was preview-only and was never
integrated. Do not implement it or reopen this change without a new request.

Rejected proposal: fade between held chords over 3.5 seconds when the musical setting changes, start the incoming
sequence at its opening chord, and use shorter 1.8-second fades within that sequence. Keep the same composition,
instrument colour and levels. A crossing that continues the same setting should continue its phrase; do not
restart music simply because the chapter identifier changes. Existing composed scores already have their own
phrase clocks and fades. No transition change has been integrated.

`node tools/audio-transition-proposals.mjs /tmp/updraft-transition-proposals` renders two 48-second A/B studies:
Meadow departure into Birches, and Drowned Village into Wood. Each plays current behavior at 0:00 (transition
at 0:08), a two-second gap, then the proposal at 0:25 (transition at 0:33). These are rendered studies, not captured
gameplay; the old chord clock uses an illustrative 80-second starting position. In the Wood example the old
clock enters on its second chord and changes again two seconds later, while the proposal gives its opening
chord a full phrase. In the Birches example both versions enter on the same chord, isolating the transition sound.

The tool snapshots production definitions and instruments without changing runtime code. Each pair shares
the same ambience, starting waveform and playback gain. Final loudness is within 0.2 LUFS, peaks are below
−9 dBFS, and the first eight seconds match within 1.5e−8 amplitude. WAV/MP3s and `comparison.json` with source
hashes, chord timings and levels are under `/tmp/updraft-transition-proposals`. These are historical comparison
artifacts, not an approved implementation plan.

## Meadow background proposal — September 21, 2026

Jeremy asked whether Meadow or another island should receive the next music proposal. Meadow is the next
recommendation: the piano wakes a grey island, the walk opens into colour, the migrating swans leave before
the cygnet can follow, and the child offers a safe paddle and waiting hands. The music should allow warmth
and wonder alongside the continuing longing for home. Birches is the next candidate afterward, developing
its existing descending autumn harmony. Jeremy subsequently approved Meadow: “this is great! yes do this
for meadows.” Jeremy then requested a Birches listening proposal: “ok lets try birches.”

`tools/lib/meadow-score-proposal.mjs` contains a 72-second study of the walk **after** the piano. A soft sustained
line recalls the puzzle's opening D–E–F♯–B shape; occasional rounded plucks add movement, without a repeating
toy-boat rhythm. Its accompaniment stays close to Meadow's existing D / B minor / G / A harmony. There is no
automatic melody during migration, calls, the paddle or its completion cue. A short descending answer returns
once the bird is back with the child. The piano puzzle, grey approach, home melody and existing island
transitions are outside this proposal and unchanged.

| Time | Condensed scene |
| --- | --- |
| 0:00–0:24 | Walking through the awakened meadow; gentle melodic fragments. |
| 0:24–0:34 | The flock is already leaving; accompaniment thins beneath the calls. |
| 0:34–0:50 | Safe paddle; quiet harmony, water and wind feedback. |
| 0:50–0:56 | The existing completion cue follows the bird's return. |
| 0:56–1:12 | Walking on together; a small return of warmth and the beginning of the shower. |

Reproduce with `node tools/audio-island-proposals.mjs /tmp/updraft-meadow-score-proposal --meadow`.
`meadow-proposal.mp3` is the approved arrangement. `meadow-comparison.mp3` plays the previous background, a two-second
gap, then the proposal at **1:14**. This is a rendered listening study with compressed story timing, not a
gameplay recording or a proposal to time the chapter this way.

Both alternatives use the same production environment, calls, gestures, paddle and completion stem. Music
loudness is matched, then both mixes receive the same playback gain. The proposed mix measures −23.4 LUFS
and −9.1 dBFS true peak, with no clipped PCM samples. Source hashes, notes, isolated stems and measurements
are in `proposals.json` and `stems/`. Jeremy approved the listening study; numerical verification establishes
implementation fidelity. The renderer preserves the pre-integration background for reproducible comparison.

## Meadow integration

`src/audio/meadow-score.ts` retains the approved notes, instruments and +17.9 dB music balance, excluding
the preview playback gain. `MeadowChapter.meadowScore` begins `walk` only after `PianoStop.at='done'`;
`crest`/`down` select the accompaniment-only `flock` section; `pond` selects its quiet paddle harmony;
`gather` and the later walk select `return`. Its first chord waits four seconds and its first pluck 5.5 seconds,
leaving room for the existing pond completion cue. Walk/return repeat after 24 seconds, flock/pond after 18,
so the actual story and player determine how long each section lasts.

The grey approach, piano duet and existing island transitions keep their earlier behavior. During the new
arrangement the original pad is inaudible but retains its global chord clock and pitch automation. Boarding
ends the arrangement and restores that pad before the departure to Birches. No new transition algorithm,
entry-chord reset or gesture scale is introduced. Restored piano/pond checkpoints select walk/return without
replaying a reward. Mute/hidden-page behavior uses the shared audio clock; departure releases all score voices.

`tools/meadow-score-check.mjs` checks approved-note and waveform parity, 10–144 Hz scheduling, piano/scene
gates, checkpoint entry, gesture coexistence, cleanup and preservation of the original pad clock/glides.
`tools/meadow-score-browser-check.mjs` uses four real piano sweeps, then the existing crest fixture through
the swan departure and paddle. It checks live phase routing, mute/resume and score release while boarding.

## Birches background proposal — September 21, 2026

Jeremy liked the first proposal's idea and shape but found the melody too out of key. He subsequently
approved the revision below: “ok the birches music is approved.” Birches follows the awakened meadow and precedes the
drowned village. Every gust takes more gold off the trees, while the swing, local leaf play and four scarf
tangles make the island playful. The score should hold warmth and autumn wistfulness together. It should
not anticipate the drowned village's grief or turn the puzzles into a timed musical sequence.

`tools/lib/birches-score-proposal.mjs` keeps the existing D–C–B–A descending bass and introduces muted plucked
strings with a middle-register melody. Falling pairs leave uneven breaths; the optional swing gets a gentle
rise and fall. During the middle tangles and last bow the melody rests, leaving quiet harmony beneath the
player's wind notes, wool movement and existing `delight` cues. A short, unresolved answer accompanies the
walk toward the far beach once the scarf has gathered. There is no added completion phrase or animal call.

| Time | Condensed scene |
| --- | --- |
| 0:00–0:18 | Gold canopy and first loop; existing scarf release cue at 0:14. |
| 0:18–0:36 | Pushing the child on the optional swing. |
| 0:36–1:00 | Wrapped trunk and slipped loop; existing release cues at 0:44 and 0:57. |
| 1:00–1:14 | Last bow at 1:08, followed by the scarf gathering into the red sail. |
| 1:14–1:24 | Walking toward the far beach; a small melodic answer. |

Reproduce with `node tools/audio-island-proposals.mjs /tmp/updraft-birches-score-proposal --birches`.
`birches-proposal.mp3` contains the new study. `birches-comparison.mp3` plays the current background, a
two-second gap, then the proposal at **1:26**. Both use the same production environment, gestures, material
sounds and four release cues. This is a rendered study with condensed events, not recorded gameplay.
The real swing and puzzles remain player-paced; any approved arrangement must follow their state.
The home melody, gesture scale and existing island transitions are unchanged. Source hashes, note events,
isolated stems and loudness measurements accompany the previews in `proposals.json` and `stems/`.

The music stems are matched by integrated loudness, followed by a shared +2.8 dB audition gain. The current
mix measures −23.0 LUFS; the proposal measures −23.5 LUFS. Both peak at −9.2 dBFS with no clipped PCM
samples. The proposed music's +20.4 dB matching gain is separate from the playback gain. Numerical checks
verify the files and reserved melodic space; emotional fit remains Jeremy's listening decision.

### Birches melody revision — September 21, 2026

Jeremy: “the melody could do with some work, it's a bit too out of key. The idea and shape is about right”.
Keep the instrument, falling bass, swing contour, dynamics, gestures and quiet scarf passages. The first
proposal remains reproducible with `--birches`; its files in `/tmp/updraft-birches-score-proposal` are retained.

The revision gives sustained melody notes clear chord tones. The opening falls A–F♯–D, answered by E–D–C
over C, with the passing D brief. The swing rises B–D–G and falls E–C–A. Its accompaniment changes from the
original suspended voicings to D / C / G-over-B / A minor, retaining the bass D–C–B–A. This removes the old
swing's G against a lingering F♯, and lets the phrase end on A rather than a suspended B. The later answer
descends D–B–A. The low A now enters after its chord begins; the later low F♯ becomes G to fit the new harmony.
The red sail still receives only its existing release cue. No runtime code or transition behavior changes.

Render with `node tools/audio-island-proposals.mjs /tmp/updraft-birches-score-revised --birches-refinement`.
`birches-proposal.mp3` is the revised 84-second study. In this directory `birches-current.mp3` means the **first
proposal**, not the game's current pad. `birches-comparison.mp3` plays that first proposal at 0:00 and the
revision at 1:26. The same environment and original music-to-environment balance are retained, with music
loudness matched and one common playback gain. Jeremy approved this revision after hearing its isolated music layer.

`birches-melody-comparison.mp3` is a shorter comparison of the first 36 seconds: first proposal at 0:00,
revision at **0:38**, with the same gain and end fade. Both full mixes measure −22.9 LUFS; the revised mix
peaks at −8.4 dBFS before MP3 encoding, with no clipped PCM samples. The mix matching adjustment is −0.1 dB
on top of the original music's +20.4 dB; the common audition boost is separate (+3.4 dB).

### Birches listening layers

Jeremy found the melody difficult to distinguish from gesture chimes, but liked the riff around 0:35 in
the **full 1:24 revision**, not the comparison. The written melody has no attacks from 0:34 to 1:14.
A background chord begins at 0:35 and a low accompanying D at 0:37; the rising run around 0:38–0:43 is the
production updraft response, with ordinary stroke chimes alongside it. The isolated layers below clarified
the distinction; Jeremy then approved the Birches background music.

`/tmp/updraft-birches-score-separated/birches-music-only.mp3` contains the exact revised music stem on its
original 84-second timeline. `birches-wind-response.mp3` contains the original context stem from 0:33 to
0:43.5, ending before the release cue at 0:44. Wind and physical sounds remain audible in that excerpt.
Both retain their gains from the delivered revision, with edge fades; neither is recomposed or normalized
to a new loudness. `separation.json` records source hashes, gains and decoding checks. No game changes.

The historical study leaves the production updraft chord clock running independently of its composed score.
The integration below aligns gesture harmony with the sounding arrangement while preserving the existing
shared transition clock/glides.

### Birches integration

`src/audio/birches-score.ts` retains the approved revision's notes and instruments at +20.3 dB, excluding
the +3.4 dB audition boost. Arrival ashore keeps the original pad; the gold-canopy pause and first scarf loop
start `walk`. Accepting the optional swing selects `swing`; ignoring it goes straight to the quiet `scarf`
section after the first release. That section continues through the remaining tangles and final gathering
of the wool, leaving the existing `delight` cues clear. Once the sail is complete, `return` accompanies
gathering the cygnet and walking to the boat. Starting the push/boarding action restores the original pad
before the existing departure transition. No additional reward phrase is introduced.

Walk/swing repeat after 22 seconds, scarf after 40, and return after 18. Player progress selects each
section; no puzzle or swing duration is imposed. Checkpoints select the appropriate section without cues.
Old voices release over 1.8 seconds, permanent silence over 0.12; mute/hidden-page suspension preserves
the audio clock. The legacy pad remains silent during the score but keeps its original chord clock and
pitch glides. Ordinary stroke chimes retain their scale. Updraft and glider responses keep their timing,
timbre and dynamics while taking chord tones from the arrangement currently playing.

`tools/birches-score-check.mjs` verifies approved-note/instrument parity, section and checkpoint routing,
10–144 Hz scheduling, gesture harmony, cleanup and unchanged pad transitions. The live browser check uses
a real swing brush and scarf circles, then an arranged final bow through natural release/gathering and boarding.

## Lines proposal — approved

Jeremy requested Birches physical detail first, then a Lines music audition. The 72-second Lines study uses
rounded, held reed tones in the middle register to distinguish its melody from gesture chimes. It starts
tentatively beneath the giant washing, answers after the bird leads through, and warms at the family clothes.
It keeps the D-major pitch family and leaves space around all three existing `delight` cues and `restored`.
The chapter remains player-paced; these timings are only a condensed listening scene.

Reproduce: `node tools/audio-island-proposals.mjs /tmp/updraft-lines-score-proposal --lines`.
`tools/lib/lines-score-proposal.mjs` preserves the original audition; runtime integration is described below.

- `lines-music-only.mp3`: proposed accompaniment alone, 72 seconds.
- `lines-proposal.mp3`: identical music/gain/timeline with production wind, chimes, cloth, door and story cues.
- `lines-comparison.mp3`: former shared background first; proposed version begins at 1:14, with identical context.

The family phrase begins at 0:47; the completion cue has the foreground from 0:55, and the small final
answer begins at 1:04. Music is matched to the existing background (+17.6 dB), with +3.1 dB common playback
gain; the proposed mix measures −23.5 LUFS and −10.7 dBTP without clipping. These are rendered studies,
not gameplay recordings. Jeremy approved the composition and asked for a small reduction in melody volume.
Home and all island transitions stay unchanged.

Birches physical detail is implemented locally: sparse shared-budget leaf scuffs and occasional swing
creaks. `node tools/birches-foley-check.mjs` renders `/tmp/updraft-birches-foley.mp3`, an isolated 19-second
sample at game gain (leaves first, swing from 0:09). No per-particle or wind-driven leaf triggers were added.

## Lines integration

`src/audio/lines-score.ts` retains the audition's notes and instruments. The accompaniment keeps its +17.6 dB
music match, excluding the +3.1 dB playback boost. `tuning.audio.linesMelodyDb` currently trims the reed alone
by 1.5 dB; numerical rendering verifies a 0 dB change to the pad. The original listening files remain intact.

The first/second/third curtain phrases loop at 26/18/18 seconds according to actual passage progress.
The melody withdraws while the bird leads and the child follows; playable wind retains its response. Family
warmth begins on approach to the familiar clothes, then the door opening selects accompaniment only.
That 12-second accompaniment can continue as long as the crossing needs. The far-shore phrase repeats at
16 seconds through the walk to the boat; `push`/`aboard` restore the existing pad before departure.
Family accompaniment can also loop at 18 seconds if needed. No fixed audition duration controls gameplay.

Existing `delight`/`restored` cues clear the melody for four seconds, including already scheduled notes;
masked attacks expire. Main copies/clears chapter state each frame. Checkpoints resume the correct curtain
or far-shore section without replaying the family reveal or reward. Updraft and glider tones follow the
current harmony; ordinary gusts keep their scale, timing and level. The shared pad clock/glides remain intact.
Voices release over 1.8 seconds on phase changes/exit, or 0.12 on permanent silence, then disconnect.

`tools/lines-score-check.mjs` checks exact composition/timbre parity, independent melody trim, checkpoint
routing, long waits at 10–144 Hz, cue space, gesture feedback, unchanged transitions and voice cleanup.
