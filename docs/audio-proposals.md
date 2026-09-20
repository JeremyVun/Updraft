# Island score listening proposals

September 20, 2026. Jeremy requested listening proposals before any new music is added to the game.
These three studies address the score's largest reuse gaps. Little Boats and the revised sea arrangement
are approved and implemented locally. Sleeping awaits a decision. The approved current home melody remains intact.

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
- **Sleeping:** no approval or rejection yet; runtime music unchanged.
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
its legacy home-bound counterpart use it; ordinary transfers and Sleeping's morning retain the original sea
pad. Entry after a saved swim starts in the return/approach section. Gesture notes remain responsive in every
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
