# Audio review — September 20, 2026

The confirmed scheduling and placement defects have been fixed in the working tree. The approved physical
sounds and rescue/feather/piano changes are implemented. Music variety still needs development and listening;
Jeremy auditioned the comparison and chose to keep the current home melody.

This reviews the current working tree, including existing uncommitted changes, against `journey.md`, the
current chapter code and the later room-specific briefs. It is a composition, routing and scheduling review.
The excerpts were rendered and measured, **not perceptually auditioned**. Piano realism, pleasantness,
masking and emotional impact still require listening in context.

## Decisions and implementation

**September 23 live playtest:** Jeremy found the Still Island score much too quiet and requested the
same correction for Home, then requested a further 3 dB after the first 9 dB lift. Both approved drones
now play 12 dB louder than the original integration. The opening retains its life-driven
growth and care hush; Home retains its composed dynamics and cue ducking. Notes, transitions, environmental
sounds, gesture chimes and the separate finale are unchanged.

**September 23 second playtest:** Home, from the Sky Mirror departure through the ending, was then too loud,
so it comes back 4 dB (8 dB over the original integration). The Sky Mirror room's score was too soft and
plays 4 dB louder (`mirrorScoreLevel`); the drowned village's share of the same dream score is unchanged.

Volume regression check: seeded 32-second background renders of Lines, Boats, both Meadow beds,
Birches, Drowned, Wood, Sleeping shelter/morning, Sea and Sky Mirror match pre-integration commit
`f5d2c8e` within 0.01 dB. All eleven finish with full arrival and cue-duck gains. This compares music
levels, not perceived loudness against every gameplay sound. Report: `/tmp/updraft-music-volume-regression.json`.

**September 22 transition audit:** Jeremy requested enough silence to leave each tune's headspace and
entrances that belong to the scene. [The complete review](audio-transition-review.md) covers ten handoffs,
all forty adaptive score sections, the piano handover and ending. Ordinary rests are now three seconds;
Sleeping gets 3.5, Mirror four, and homeward five. Short-crossing preparation, approach readiness, phrase
endings, Sleeping → Sea and the dolphin farewell timing were corrected. The specifically approved
Drowned → Wood storm overlap remains continuous.

**September 22 summit approval:** Jeremy approved the full three-minute drone and requested it from
Sky Mirror departure through the ending. It is integrated locally with a three-second mirror fade,
at least five seconds of musical silence, and a three-second entrance after the first offshore turn.
The complete piece plays across the sea; summit story states then guide flight, farewell and home.
The approved recognition melody, original finale and ending cut remain. Jeremy subsequently approved the
opening after its middle passage gained a held D/F♯ resolution before the returning motif. That complete
185.3125-second arrangement is also integrated locally, using the original pad and life/care response.
See [the latest audition and integration](audio-proposals.md#summit-approved-opening-middle-revised--september-22).

**September 22 restoration:** Jeremy requested the earlier cursor-chime sound and the original completion
and small-success sounds. Ordinary cursor chimes again use the September 15 bell partials and 6 ms attack.
`restored`, `delight` and `breeze` retain their original pitches, bright bell voice and cue gain, with no cursor
tail filtering. Current scene gates, note spacing, cursor levels, harmony selection and silence rules remain;
the specifically approved soft forest-rescue and Sleeping voices remain.

Jeremy's follow-up found the wood's darker register missing and chimes crowded together. Ordinary forest
strokes now retain the original low minor palette, and updrafts return to D3–A3–D4–A4 instead of the shared
higher register. Forest attacks are spaced at least 1.25 seconds apart. Glider answers now respect the same
spacing as other input, including their second note; opening spacing stays 0.625 seconds and Sleeping 1.25.
The rescue's softer voice and all scene/silence gates remain.

**September 21 refinement:** Jeremy now wants cursor chimes only on the starting island (+6 dB) and in the
forest (also +6 dB, preserving the rescue voice’s relative softness), with player wind noise −3 dB after the opening.
Jeremy also approved sparse, quiet chimes only during Sleeping’s feather-guided climb, ending before the
summit. Explicit chapter/phase states keep retained music and other Sleeping scenes from enabling chimes.
This supersedes the all-room gesture decision below. Authored cues and piano remain.

Jeremy: "Whenever the player can generate wind, the gesture chimes should play." This supersedes the original
recommendation to suppress them during playable quiet moments. `hush` withdraws the pad, not the player's
musical feedback. Gusts and updrafts now use the same minimum thresholds as the wind input, including gentle
strokes. The piano owns musical feedback while engaged; all three generic chime paths respect that exception.
Its fading mix cannot mute newly playable gestures after the duet.

- **Wood:** Jeremy chose a quiet, caring chime at the rescue ember. That search uses lower, softer gesture
  notes; lighting its hearth plays a restrained two-note `comfort` cue. Ordinary embers retain `kindled`.
- **Sleeping:** morning restores the sea mood and its lighter mix. The pillow feather gets the approved short,
  unresolved hint; the complete `lifted` phrase remains reserved for the bird's brave flight.
  Jeremy subsequently approved the revised Sleeping arrangement and removed the second completion phrase
  at landing. Its own score now follows shelter, cold, climb, summit and morning, with genuine background rests.
- **Meadow:** the world still wakes during the final piano lullaby. The shared completion phrase follows the
  last note plus a 1.2-second breathing space, once only. Checkpoint restoration does not replay it.
  Jeremy subsequently reported the approach becoming quiet too early. The background now stays through
  walking/looking, then fades once over 2.2 seconds from sitting, overlapping the first key and clearing the
  demonstration. The former piano contribution to both `hush` and `pianoMix` is removed.
  Jeremy approved the September 21 post-piano background. It now follows the walk, flock departure, safe
  paddle and return to the child, and hands back to the original pad during boarding. The piano, wind
  feedback and existing island transitions retain their earlier behavior.
- **Birches:** Jeremy approved the revised plucked-string composition after hearing the music separately
  from the wind chimes. It follows the first loop, optional swing, quiet scarf work and walk to the boat.
  Updraft harmony follows its current chord; the original pad returns at boarding and keeps its existing
  island-transition clock and pitch glides.
- **Finale:** an explicit guard replaces the 50 ms trigger window. One cue at every tested frame rate.
- **Location:** shoreline distance is local to the current island. Land wildlife is gated by land, cold and rain;
  only the meadow gets skylarks. Cygnet and flock calls use their actual screen position and distance.
  Adult swans share one voice, fade out at range, and leave meadow/home conversations to their authored cues.
- **Objects:** Jeremy approved restrained cloth, scarf, hull-water, sail, dolphin-splash, paper and door sounds.
  These follow actual object state or local wind, with distance attenuation and bounded scheduling. New or
  resumed motion establishes a baseline rather than replaying completed actions. The child remains voiceless.
- **Sea life:** Jeremy requested dolphin/whale effects, explicitly including the first crossing's whale.
  Dolphin re-entry already had splashes; emergence now adds a lighter wash. Whale emergence, both visible
  breaths, tail drainage and dive now have positioned physical sounds. These follow the shared animation
  events on every crossing, with no marine vocal calls added. Listening in context remains the artistic check.

The existing ending cut is retained. It begins 2.5 seconds before credits. An isolated production render
measured the residual musical reverb at roughly −62 to −65 dBFS during the first credit second, around
40–43 dB below the ending music, falling below −85 dBFS in the next second. The earlier concern about music
continuing into credits was overstated; a different cut is not an approved change.

## Home melody decision and remaining artistic work

Jeremy's decision after listening: "100% the current home melody." Preserve the existing `unfold` melody;
the proposed piano-lullaby reprise is rejected. Do not reopen this choice as part of expanding the score.

The recommendation for a reprise was based on thematic continuity without perceptual audition. That is
insufficient evidence to prefer its emotional effect. Technical tests establish timing, routing and output;
they do not establish that the new physical sounds, caring chime or other musical changes feel right.
Those additions still require listening in context, despite approval of their intended direction.

`tools/audio-theme-preview.mjs` retains the comparison method: actual meadow piano, current `unfold` and the
rejected reprise through the same chime instrument and note strength. The reprise transposes the learned tune
up an octave and adds phrase-ending breaths. It never replaced the production melody.

Comparison: `/tmp/updraft-audio-themes/melody-comparison.wav` — 0:00 piano, 0:16 current home, 0:38 proposed
reprise. Individual clips and their source hashes/metrics are in the same directory. No normalization.

Jeremy subsequently approved the Little Boats composition and revised Sleeping score; both are integrated locally.
The long-sea proposal was revised with quieter melodic fragments and accompaniment shaped around the actual
passage. Jeremy heard that revision and approved integration; it now follows the real swim and approach states.

Jeremy subsequently requested listening proposals before integration. The first three studies, their
comparison timings, approved integration and outstanding decisions are in `audio-proposals.md`.

The findings and island table below describe the **pre-fix review**, with the gesture policy corrected to
match Jeremy's instruction. Historical line numbers refer to that snapshot. Current behavior is defined by
`contracts/audio.md`; verification commands are in `testing.md`.

## What already serves the story

- The harmonic arc has intent: undecided opening fifths, brighter washing and meadow, descending autumn
  harmony, hollow village voicings, a low unsettled wood, restrained mirror and a resolving ending.
- The opening flight/fall phrases follow the animation duration; the low landing note follows actual contact.
  The house motif waits until the drawing and cottage share the frame, and an early plane release does not
  schedule a competing release melody (`audio.ts:610–644`, `home.ts:715–720`). Preserve these decisions.
- The piano has its own synthesis and an attempt at exclusive musical space. The cygnet has feet, wings,
  feather friction, handling and swimming sounds without routine vocal chatter. The child's voice stays absent.
- Major objectives share the original restoration phrase, as Jeremy requested in `polish.md`, “Shared
  objective sound.” Keep that recognition. Later approvals remove it from the wood rescue and Sleeping's
  landing; Sleeping retains its full flight reward immediately beforehand.

## Confirmed problems and their consequences

### 1. Piano mode leaks generic chimes — fixed

`hush` only attenuates the sustained pad. The review initially classified unchanged gesture velocity as a
defect; Jeremy clarified that this feedback is required wherever wind is playable. That behavior is preserved.

Piano mode blocks ordinary gust chimes, but does not block the updraft arpeggio or glider-lift chimes
(`audio.ts:741–756`). With `piano=1`, the probe still scheduled the arpeggio; a separate lift probe scheduled
two chimes. Whether a glider-lift event is reachable in every piano state needs a gameplay check; the unguarded
audio path itself is confirmed. The meadow also calls the shared objective phrase 0.35 seconds into its piano
finale (`story/piano.ts:263–273`, `story/meadow.ts:285–290`, `tuning.ts:316`), layering a second melodic phrase
over the lullaby. Its occurrence is approved; its timing needs space.

During the duet, the piano owns pitched gesture feedback. At the wood's rescue ember, use the approved caring
response. Place the completion phrase after the piano cadence. These changes are implemented.

### 2. The finale can schedule itself repeatedly — high priority

`src/story/home.ts:774` calls `cue('finale')` on every update inside a 50 ms window. The probe invoked the
actual `HomeChapter.updateEnding` method at 60 Hz and received the cue at both 2.0167 and 2.0333 seconds.
The exact count depends on the simulation clock's alignment. `Soundscape.update` processes every queued cue,
and `finale()` schedules the entire chord and chime sequence each time. There is no one-shot guard.

Use an explicit once-only transition. Verify one finale across frame rates and simulation catch-up steps,
then audition its final chord, cut and reverb tail against the credits. The music bus cuts before the shared
reverb, so “silence” currently leaves a musical tail; decide that tail's duration deliberately.

### 3. Restoring morning brings back the wood music — medium priority

Sleeping's normal flight switches `music` from `wood` to `sea` (`sleeping.ts:807`). Restoring its `morning`
checkpoint restores dawn, open curtains and the walk to the boat, but never restores that music selection
(`sleeping.ts:186–197`). The production restore and boarding methods leave the fixture at `dawn=1`,
`beat=toBoat`, `music=wood`. A player returning after earning morning gets the earlier tension underneath it.

Restore the musical phase alongside the scene state, without replaying reward cues. Include audio state in
checkpoint verification; checking only positions and progression misses this regression.

### 4. Ambient sound does not reliably describe the location — medium priority

The cricket and owl rules depend on night and timers, without land, habitat, season or storm gates
(`audio.ts:710–720`). A fixture with `sea=1`, `overLand=false`, `meadow=0`, `night=1` scheduled both. This also
allows the same night bed through the storm and the frozen sleeping island. That weakens the differences
between those places. The requested crickets at the final cottage can remain a deliberate exception.

The sea/meadow mix uses distance north of the **meadow's southern coast**, even on later islands
(`src/main.ts:688–691`, `src/world/heightfield.ts:332`). Dry ground well north of the meadow consequently
counts as deep meadow and suppresses the sea, regardless of its own nearby shoreline.

Give chapters habitat weights, and derive shoreline sound from the current island or local water distance.
Separate open water, cloth passages, leafy ground, storm wood, frozen bedroom and home. Keep bird calls sparse
enough that deliberate cygnet calls remain narratively distinct.

### 5. Character calls have inconsistent position and identity — medium priority

The cygnet's critical calls use a random pan within ±0.15 and no source-distance input
(`audio.ts:482–492`). Its ordinary foley already uses the bird's screen position (`main.ts:559`). In the wood,
the call cannot reliably point toward the hidden bird; during a visible call it can disagree with the picture.

The adults also have two independent voices: story `bugle` cues use the older rolling crane-style patch
(`audio.ts:530–579`), while the visible flock uses the newer swan patch in `foley.ts:198–250`. Both can play
during the same encounter, on independent schedules (`main.ts:575–585`). This is an internal consistency
problem; the naturalism of either patch needs listening.

Route important calls through positioned emitters and one adult-swan sound family. Coordinate the flock's
incidental calls with the authored call-and-answer pauses, especially at the pond and reunion.

### 6. One substantial reward phrase arrives before the reward — artistic priority

Sleeping plays the entire nine-note `lifted` phrase when the player frees the pillow feather
(`sleeping.ts:535–547`), then plays it again when the bird makes its brave return flight (`797–808`). The first
event is the start of an uncertain search; the second earns release and morning. Giving both the same full
answer reduces the distinction. Use a brief unresolved fragment for the feather and reserve the complete
phrase for the flight. Keep the separately approved objective phrase at the child's awakening, with room
between the two musical events.

### 7. Several central objects have no dedicated sound — artistic priority

The implementation has generic wind, sea and rain, detailed cygnet foley, animal voices and pinwheel flutter.
There is no dedicated audio path in the washing sheets, scarf, toy boats, sailing boat, sea-life splashes,
paper drawing or cottage door modules. Musical cues acknowledge some of these events, but their materials
largely remain unheard. Generic land rustle responds to the pointer's land test, not to cloth or leaf motion.

Start with a few expressive sounds: cloth loading and releasing under wind; scarf friction; close hull water
and sail strain; a dolphin re-entry; paper unfolding; the final door. Drive them from the actual action,
position and intensity. Sparse physical detail will make care, shelter and returning home more tangible
without filling every moment with more music. Preserve the protagonists' vocal restraint.

## Music variety and each island

There are **nine mood presets sharing one arrangement template**. Every preset uses the same four
triangle/sine pad voices and the same chime instrument (`audio.ts:67–85`, `278–299`, `376–398`). Differences
are chord notes, chord duration, filter brightness, level and gesture scale. Chord cycles repeat every
30–52 seconds; gesture notes use the same 96 BPM pulse throughout. With no input or story cue, the music is
predominantly a sustained pad. There are no evolving instrumental layers or longer melodic sections.

That provides harmonic continuity, but insufficient identity and development for the enlarged journey.
`testing.md` records a roughly 37-minute published playthrough; that is historical pacing evidence, not a
new measurement of this changing working tree. The score needs to sustain substantially more than its
original eighteen-minute ambition.

| Place | Current score | Assessment and proposed direction |
| --- | --- | --- |
| Still island | Two open chords; 32 s cycle | Appropriate uncertainty. Begin with room for wind, introduce a small home-motif fragment as the world wakes, and preserve the fall's withdrawal. |
| Lines | Bright four-chord pad; 36 s | Suits discovery, but the impossible domestic setting needs intimacy too. Let close cloth and sparse rounded notes give the passage identity; open the harmony at the family line. |
| Little Boats | Lines again, with a quieter pad | No dedicated musical identity. Give the toys a small, buoyant plucked pattern with irregular breathing room, leaving space for the cygnet's swims. |
| Meadow | Full four-chord pad; 34 s, plus piano | The piano is the strongest musical opportunity. Restrain the grey approach, protect the duet, and let the meadow's fuller arrangement be earned by its awakening. |
| Birches | Descending bass D–C–B–A; 44 s | A convincing harmonic premise for autumn. Add dry leaf detail and a fragile upper phrase; let the scarf and optional swing breathe within the same room. |
| Drowned village | Open/suspended chords; 52 s | Good restraint. Thin the background into the becalming and let the sail be heard filling. Preserve musical feedback for playable wind. |
| Dark wood | Low two-chord drone; 30 s | Appropriate tension. Preserve gesture notes, with the approved quiet caring response at the rescue ember. Let ember warmth and space around the cries carry the distinction. |
| Sleeping | Wood until the glide, then Sea | Largest missing identity. This is vulnerable care and role reversal, with cold closing in. The current listening proposal uses an independent sparse piano theme, warming after the flight. |
| Long sea crossing | Four chords; 44 s, also used on early crossings | Relief is appropriate, but this passage needs development beyond a reused loop. Gradually widen register and instrumentation; leave the brave swim intimate and let the environment carry stretches alone. |
| Sky Mirror | Two slow open chords; 38 s | Sensible suspension. Use sparse glass-like resonance and answered musical fragments for returned stars, keeping the strongest resolution for home. |
| Home | Four chords; 40 s, recognition and finale cues | Keep the current recognition melody: Jeremy selected it after audition. Preserve the distinction between reunion and recognition, one finale and the existing withdrawal. |

Aim for one evolving score with distinct chapter arrangements. A restrained palette of felt piano, rounded
plucks, breathy sustained tones, low resonances and sparse glass/bells is enough if register, density, phrasing
and silence change with the story. Fully synthesized audio can support this; synthesis itself is not the fault.

The meadow's `LULLABY` and the ending's `unfold` phrase are separately authored melodies. Their shared key and
arpeggio shapes provide a family resemblance, but there is no explicit reprise of the learned piano melody at
home. The proposal to replace home with that reprise was rejected after Jeremy's audition. Preserve the
current recognition melody and keep the objective signature distinct from it.

The transition audition is resolved: on September 21 Jeremy rejected the proposed crossfades and directed
that existing transitions remain unchanged. Preserve the shared pad's global chord clock and pitch glides.
The earlier concern was not a confirmed defect; the preview was never integrated.

## Evidence and work order

`node tools/audio-review.mjs /tmp/updraft-audio-review` ran successfully against the local dev server.
It calls production methods for the scheduling probes and renders the actual `Soundscape` with Chrome's
OfflineAudioContext. The JSON records source hashes, probe results and audio metrics.

- `/tmp/updraft-audio-review/review.json`: verified hush, piano, habitat, morning-restore and repeated-finale findings.
- `/tmp/updraft-audio-review/comparison.wav`: eight seconds per mood with one-second gaps, in table order
  excluding the reused Boats and Sleeping presets: Still, Lines, Meadow, Birches, Drowned, Wood, Sea, Mirror, Home.
- Individual 48-second WAVs in that directory expose longer chord movement and two identical gesture passages.
  All use standardized daylight, full world life and low breeze for comparison. They are fixtures, not
  recordings of their chapters. No level normalization was applied.
- No rendered fixture clipped; peaks ranged from approximately −10.3 to −8.6 dBFS. This says nothing about
  worst-case thunder, simultaneous creature sounds, the duplicated finale, or device playback loudness.

The timing, checkpoint, emitter, habitat and approved material changes are implemented. Next, audition the
Sleeping, Little Boats and long-sea studies before integrating any new arrangement. Keep the home melody.

Before artistic sign-off, listen through the full journey on headphones and an ordinary phone speaker,
including prolonged idle, energetic swiping, repeated failed attempts and the optional swing. Listen without
looking for part of each island: its place and emotional phase should still be distinguishable. Check that
the piano invitation remains intelligible, the distress call owns attention, morning feels earned, the sea
provides relief, and the house feels remembered. Verify critical cue counts and their spacing alongside those
auditions. Source inspection and peak measurements cannot certify these outcomes.
