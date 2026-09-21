# Island score listening proposals

September 20, 2026. Jeremy requested listening proposals before any new music is added to the game.
These three studies address the score's largest reuse gaps. Little Boats, the revised sea arrangement
and the revised Sleeping arrangement are approved and implemented locally. Jeremy rejected the held-chord
transition proposal. His later arrival-timing and four-second pause request is recorded below.
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
  existing delight/completion cues space. Wind chimes retain their response. The approach crossing retained Lines; the later arrival handoff now starts Boats before landing.
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

Jeremy: “keep what we currently have for transitions, dont touch them.” This rejected the proposed replacement
for the shared pad's pitch glides and chord clock; the later arrival-timing request below is a separate change. The proposal was preview-only and was never
integrated. Do not implement it or reopen this change without a new request.

Rejected proposal: fade between held chords over 3.5 seconds when the musical setting changes, start the incoming
sequence at its opening chord, and use shorter 1.8-second fades within that sequence. Keep the same composition,
instrument colour and levels. A crossing that continues the same setting should continue its phrase; do not
restart music simply because the chapter identifier changes. Existing composed scores already have their own
phrase clocks and fades. This proposed replacement was not integrated.

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
the +3.4 dB audition boost. The later arrival handoff starts `walk` before landing and continues it through
the gold-canopy pause and first scarf loop. Accepting the optional swing selects `swing`; ignoring it goes straight to the quiet `scarf`
section after the first release. That section continues through the remaining tangles and final gathering
of the wool, leaving the existing `delight` cues clear. Once the sail is complete, `return` accompanies
gathering the cygnet and walking to the boat. Starting the push/boarding action restores the original pad
before the existing departure transition. No additional reward phrase is introduced.

Walk/swing repeat after 22 seconds, scarf after 40, and return after 18. Player progress selects each
section; no puzzle or swing duration is imposed. Checkpoints select the appropriate section without cues.
Old voices release over 1.8 seconds, permanent silence over 0.12; mute/hidden-page suspension preserves
the audio clock. The legacy pad remains silent during the score but keeps its original chord clock and
pitch glides. All gesture responses keep their timing, timbre and dynamics while taking chord tones from
the arrangement currently playing; ordinary strokes were added to this matching in the later pass below.

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
current harmony; the later pass below also matches ordinary gust pitches, keeping their timing and level. The shared pad clock/glides remain intact.
Voices release over 1.8 seconds on phase changes/exit, or 0.12 on permanent silence, then disconnect.

`tools/lines-score-check.mjs` checks exact composition/timbre parity, independent melody trim, checkpoint
routing, long waits at 10–144 Hz, cue space, gesture feedback, unchanged transitions and voice cleanup.


## Arrival timing and matched wind chimes — September 21, 2026

Jeremy reported that Lines music starts after landing/walking and requested the same timing audit elsewhere.
He chose about four seconds without background music between islands, with water, wind and gestures continuing.
He also requested that cursor chimes match whichever background music is playing.

Implemented: a 1.5-second outgoing fade, four-second background rest and 1.5-second incoming fade, triggered
on approach using remaining route distance and boat speed. Every island arrival has a destination profile;
Lines/Birches/Sleeping/Boats begin their composition before grounding and retain the phrase ashore. Meadow
keeps the pre-piano bed, Drowned preserves the plane-loss scene, and the sea keeps its swim/reunion/farewell.
The shared pad clock/glides, approved music, Lines' −1.5 dB trim and original home melody are unchanged.

All cursor, updraft and glider notes now follow the active background harmony at their scheduled onset.
Meadow and Sleeping expose their actual section chords; Sleeping carries the preceding harmony through
intentional rests. The wood rescue retains its softer caring chime, and the piano retains gesture ownership.
Authored story melodies are unchanged. These are integrated timing/harmony fixes, not new compositions.

`tools/arrival-audio-check.mjs` renders nine destination handoffs and a condensed production example to
`/tmp/updraft-arrival-audio.wav` (fade at 0:08, rest 0:09.5–0:13.5, Lines enters 0:13.5, landing at 0:22).
`tools/gesture-harmony-check.mjs` checks all 33 score/mood sections, including queued notes crossing chords.

## Audio-director polish — approved September 21, 2026

Jeremy approved all five priorities: phrase-aware arrivals, repaired loops with variation, gentler gesture chimes, harmonic cue coordination and a shared piano motif. This supersedes the four-second ordinary arrival rest above. It preserves the rejected held-chord decision, the chosen home melody and the intentional Sleeping/ending silences.

The Meadow–Birches example was quiet around 0:19–0:26 because the Meadow phrase ended before the 0:20 handoff, followed by the 1.5-second fade, four-second rest and soft incoming attack. Harmony now lasts to the handoff; the explicit rest is 0.4 seconds. The updated 36-second example is `/tmp/updraft-meadow-birches-continuity.wav` (handoff requested at 0:20).

Runtime arrangements recall D–E–F♯–B in different instruments, directions and durations. Alternate verses thin the melody; introductory cue rests occur only once. Minor rewards follow actual harmony. Shared gesture timing removes double attacks and the charge octave jump; softer harmonic partials and fading incompatible tails reduce brightness and clashes. Important story cues get a gradual background duck.

Historical auditions remain intact. Current implementation and invariants are in `docs/contracts/audio.md`; `tools/audio-direction-check.mjs` renders targeted listening passages and checks the new behavior. These are production-audio renders and numerical checks, not a listening sign-off.

## Sky Mirror and Drowned Village — September 21 listening proposals

Jeremy asked for custom scores after a chapter-by-chapter review. These are new listening studies, **not yet
integrated**. They follow his existing request to audition new music before adding it to the game.
The current home melody and six approved arrangements are untouched.

**Sky Mirror:** repair after the long sea passage, with the child and cygnet together on the reflection.
The bowl and soap hoop keep its wonder domestic. Rounded glass tones have a softer, lower answering voice;
open sustained harmony leaves room for the player's wind. The first returned star introduces the complete
D–E–F-sharp–B journey fragment; the second answers downward. Low, slow blooms acknowledge the stars without
bright reward attacks. The constellation opens onto D/A/E, preserving Home's eventual resolution.
The study proposes replacing the first two generic delight cues with these musical responses, and giving
the third return its own continuation. No bubble-pop or swimming sounds are added.

**Drowned Village:** homes passed at water level, then the need to supply wind, the lighthouse going dark
and the plane taken. A low string-like melody recalls D–E–F-sharp but falls to the lower B; descending bass
continues the autumn movement from Birches. Muted key notes are sparse. The arrangement withdraws beneath
the existing becalming cue and leaves space for the existing objective phrase when the sail fills. Its
return remains tentative; the weather removes notes rather than adding percussion or a crescendo. Music
clears after the plane loss, with a quiet D/A pedal arriving later toward the wood.

| Study | Condensed listening timeline |
| --- | --- |
| Sky Mirror, 1:44 | Approach 0:00; unreturned sky 0:16; one star 0:36; two 0:56; constellation 1:16; departure 1:24. |
| Drowned Village, 1:52 | Rooftops 0:00; spire 0:16; becalmed 0:32; sail fills 0:46; storm gathers 1:02; lighthouse fades 1:21; plane taken 1:24; wood approach 1:40. |

For integration, these times must become story events. Mirror development follows **completed-star count**,
independent of collection order; resumed saves enter that count without replaying blooms. Drowned follows
`enter/drift`, `still`, resumed drift, `gather`, `snatch` and `after`; the 22-second storm gathering matches
the current chapter. Both need extendable, varied sections for slow play, current-harmony gesture feedback,
the existing arrival handoff and checkpoint/mute behavior. Do not ship the study timelines as chapter timers.

Reproduce with `node tools/mirror-drowned-score-preview.mjs /tmp/updraft-mirror-drowned-scores`.
Composition, note schedules and instruments live in `tools/lib/mirror-drowned-score-proposals.mjs`.
The renderer snapshots its audio dependencies, disables Vite environment loading and renders Chrome Web
Audio through production reverb/compression. `*-music.mp3` isolates the scores; `*-scene.mp3` adds illustrative
production wind, water, gesture and story sounds. The scene versions are not gameplay recordings.
Each export uses a single fixed listening gain; isolated scores are matched near −23 LUFS. Intentional
withdrawals and rests remain. Raw WAVs retain the scene balance; `report.json` records hashes, note-envelope
checks, one-second levels, source cleanup, clipping and decoded MP3 headroom. Numerical checks do not
establish pleasantness or emotional fit; Jeremy's listening remains the artistic decision.

### Revision after listening — more wonder, earlier weather

Jeremy found Sky Mirror insufficiently ethereal/magical and Drowned's storm transition unconvincing.
The revised preview supersedes the first study's orchestration and Drowned's silent ending above.

Mirror now has a quieter bass beneath wider upper harmony, including ninths and a restrained major seventh.
A soft-onset glass voice carries the melody higher; the highest notes have lower levels. Slow halos and
three quiet filtered echoes extend the reflected sound. Each star adds an upward trail with a long swell;
the third is the widest. The familiar melodic contour and unresolved departure remain.

Drowned retains its rooftop melody. A faint low swell foreshadows the weather before becalming; overlapping
swells return beneath the resumed drift and grow closer during the gathering. The bass descends through
G and F into D minor before the plane is taken. The lead withdraws, but low accompaniment now continues
under the rain and toward the wood's D/A and semitone tension. No percussion or sharp impact is added.
The becalming still withdraws substantially and the sail's existing objective cue keeps its space.

Render with `node tools/mirror-drowned-score-preview.mjs /tmp/updraft-mirror-drowned-revised`.
Original audio remains under `/tmp/updraft-mirror-drowned-scores`; revised music and illustrative scene
mixes are under `/tmp/updraft-mirror-drowned-revised`. The Drowned scene version includes the production
rain/wind/thunder to audition the transition. Neither revision is integrated into the game.


### Approved and integrated — September 21

Jeremy: “ok great, both are approved.” Both revised scores are integrated locally; this supersedes the
preview-only status above. He also requested a seamless Drowned/forest transition. The forest retains its
quiet existing drone, introduced through a four-second overlap on shared D/A pitches without a music gap
or cleared reverb. The current four-star Mirror room extends the approved middle variation before its
final bloom. Runtime behavior is documented in `contracts/audio.md`.

`tools/dream-score-check.mjs` verifies approval parity, real Web Audio scheduling, long loops, real-event
blooms, source/echo cleanup, gesture continuity and the forest overlap. It renders
`/tmp/updraft-drowned-forest-{music,scene}.wav`; the forest starts at 0:46. A 32-second scene excerpt,
`/tmp/updraft-drowned-forest-transition.mp3`, starts the overlap at 0:10. These use production audio and
illustrative chapter timing; they are not recordings of a full player traversal or a perceptual sign-off.

## Opening island evolution — September 21 listening study

**Decision: retain the original.** After comparing the two, Jeremy said: “yea, the original still sounds
better”. The evolution study is rejected and was never integrated. Preserve the original opening music;
do not treat this study as pending work or include it in a later score integration.

Jeremy asked whether the original opening had outgrown its usefulness, then approved trying an evolution
that preserves its identity. This study is **not integrated**. The production pad, two open chords, global
chord clock, brightness, life response and cue ducking remain unchanged. The first sixteen seconds retain
the original sound; a quiet rounded voice begins answering during exploration. A low-level F-sharp warms
the open D harmony after restoration, followed by a short A–F-sharp–E thought. The added part, including its
reverb, withdraws before the flock arrives and remains absent through the fall and care. Three subdued
notes return on departure. No new completion cue or replacement home theme is proposed.

The 96-second study condenses first wind at 0:06, exploration from 0:16, colour returning at 0:40, flock
at 0:56, fall at 1:01, contact/care from 1:06 and departure at 1:20. Any integration must follow the real
chapter and player progress, rather than these preview times. First gestures and time spent exploring
must remain free; a long play session should vary the answering material and leave phrases out.

Reproduce: `node tools/opening-score-preview.mjs /tmp/updraft-opening-study`.
Composition: `tools/lib/opening-score-proposal.mjs`. Original/revised music and illustrative scene files
share one fixed playback gain, including the same original pad level. `comparison.mp3` plays the first
56 seconds of the current background, a two-second separator, then the study from **0:58**. The scene
versions also contain production wind, gesture notes and the existing story phrases. No protagonist voice
is added. The snapshot renderer checks the original entrance within PCM rounding precision, clearance of
added tails during the fall, source cleanup and clipping; `report.json` records source hashes and levels.
These checks do not determine whether the new part improves the feeling; that remains a listening decision.

## Distant ship foghorn — September 21 listening study

Jeremy suggested a distant ship foghorn while passing the lighthouse in the storm, then asked for a try.
This is a listening preview, **not integrated**. One low A emerges slowly from the right, with filtered
harmonics, a 1.5-second rounded attack and a long production-reverb tail. It shares the score's D/A harmony.
There is no repeating alarm, sharp onset or added musical phrase.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-study`.
The 32-second illustrative scene uses production Drowned music, wind, rain and thunder. The horn begins
at 0:08 and its body ends near 0:15; thunder follows at 0:17.4, lighthouse extinction at 0:19 and the plane
snatch at 0:22. These are audition timings, not a gameplay recording. Any integration should use the actual
chapter state and fire once during the lighthouse passage.

`storm-with-foghorn.mp3`, `storm-original.mp3` and `foghorn-alone.mp3` share one fixed 4.8 dB listening gain.
The scene with the horn measures −23.5 LUFS and −8.7 dBFS decoded peak. Thirteen numerical checks cover
attack, tail clearance, harmonic tuning, source cleanup and clipping; they do not establish perceptual fit.
Composition is in `tools/lib/foghorn-proposal.mjs`; raw WAVs and measurements accompany the exports.

### Revision — audible through the storm

Jeremy could not hear the first horn. Its isolated body measured about 11 dB below the surrounding scene;
the low fundamental and restrained harmonics left it buried in the mix. The revised preview raises the
horn's source level by 12 dB and strengthens the 220/330 Hz harmonics while retaining the same soft attack,
filter, timing and reverb. Scene playback gain stays at 4.8 dB for a fair comparison.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-revised`. The horn still enters at 0:08 in
`storm-with-foghorn.mp3`. `foghorn-close-listen.mp3` isolates the call at the same gain and removes the
opening silence. This revision remains a listening preview, pending Jeremy's assessment.

### Revision — recognisable ship-horn character

Jeremy heard the louder version but wanted a more stereotypical foghorn. The third study lowers the
fundamental to A1, with stronger upper harmonics for a brassy reed tone, a held body instead of an early
decay, filtered breath and a small pressure rise/fall in pitch. The rounded attack is now 0.85 seconds;
the call's timing, stereo position and overall duration are unchanged.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-brass`. The scene horn enters at 0:08;
`foghorn-close-listen.mp3` presents it alone without the opening silence. All exports retain the same
4.8 dB listening gain. The mixed scene peaks at −5.3 dBFS after MP3 decoding; attack, tail clearance,
source cleanup and clipping checks pass. Preview only; this timbre has not been approved or integrated.

### Revision — reference-guided midrange horn

Jeremy found the third study still merged with the music's bass. He supplied
[a ship-horn reference around 0:23](https://www.youtube.com/watch?v=ETrWMvicKps&t=23s), explicitly as a
reference for original synthesis. Spectral analysis of the sustained call found a roughly 167 Hz harmonic
series, with prominent components around 333, 500, 666 and 999 Hz. The fourth harmonic is often strongest.
The previous A1-based study put too much of its body in the bass despite the added harmonics.

The new synthesis uses D3 (about 147 Hz), a restrained fundamental, strong second through sixth harmonics,
and an emphasis near 587 Hz. A low cut reduces bass overlap; a more open low-pass filter retains the
brassy midrange. The steady call, rounded 0.7-second attack, restrained air texture and distant reverb
remain. All audio is generated from oscillators and seeded noise; no reference samples enter the output.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-reference-study`. Scene entry remains 0:08;
`foghorn-close-listen.mp3` has no opening silence. This replaces the bass-heavy direction for audition,
but remains unapproved and unintegrated. Numerical analysis informed the timbre; it is not a listening
judgment or a claim of matching the recording exactly.

### Revision — shorter, fuller and farther away

Jeremy requested a slightly shorter call with more bass and reverb, stressing that the ship is distant.
The call now lasts 4.6 seconds instead of 6.8, with its sustained body ending at 2.65 seconds. D3 remains
the pitch, but a stronger fundamental and a lower bass-cut restore weight beneath the identifying upper
harmonics. The direct signal drops to 0.72, the production-reverb send rises from 0.65 to 2.5, and a
160 ms predelay separates the spacious return. The upper filter is also softer. The local send stays
connected until its delay drains; the shared reverb continues afterward.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-distant`. The call enters at 0:08 and its
source envelope ends at 0:12.6, followed by reverb. Same fixed playback gain; the mixed export peaks at
−5.5 dBFS. The existing attack, clearance, cleanup and clipping checks pass. Listening preview only.

### Revision — diffuse distance rather than foreground reverb

Jeremy still heard the horn in the foreground. The new study replaces most of the direct sound and
short production reverb with a separate stereo diffuse field. Its generated 4.4-second impulse builds
after a 180 ms onset delay and decays gradually, without distinct repeated calls. The direct gain drops
from 0.72 to 0.22, the onset broadens to 1.1 seconds, and both direct and diffuse paths lose more upper
frequencies. The strengthened D3 fundamental and 4.6-second source duration remain. The source level
also drops by 5 dB to compensate for the diffuse field's sustained energy; exports keep the same gain.

Reproduce: `node tools/foghorn-preview.mjs /tmp/updraft-foghorn-mist`. Listen in the scene at 0:08 to
judge distance against the weather. The added convolution remains connected until its tail has drained;
the renderer checks source cleanup, clipping and clearance before thunder and the plane snatch.
This is still an unapproved listening study, not a runtime change.

### Accepted and integrated — distant foghorn

Jeremy accepted the diffuse-distance version: “good enough”. This supersedes the pending status above.
`src/audio/foghorn.ts` now implements that exact synthesis with settings in `tuning.audio.foghorn`.
Drowned emits a single environmental `foghorn` cue eight seconds into the storm gathering, while the
lighthouse is in view. It does not duck the music. The shorter call and diffuse tail finish before thunder;
stale events after a large simulation jump are discarded. No sample from the YouTube reference is used.

The final audition remains frozen in `tools/lib/foghorn-proposal.mjs` for comparison. The renderer now also
plays the actual production cue and checks that its mixed PCM matches the approved reference within one
16-bit rounding step. Integration evidence: `/tmp/updraft-foghorn-integrated/report.json` and
`storm-integrated.mp3`. Story timing and once-only behavior: `tools/foghorn-story-check.mjs`.
