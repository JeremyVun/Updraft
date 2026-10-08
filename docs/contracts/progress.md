# Progress and page lifecycle

Jeremy's rule: a reload returns the player to a checkpoint at an island's entry or exit, or just after a point of
interest such as the piano. Sound is suspended while the page is hidden.

## Saving

`src/story/progress.ts` stores one versioned JSON record in `localStorage` under `updraft.progress.v1`, belonging to
this browser and origin (no account or server). `Journey` writes on chapter changes and completed interaction exits,
never every frame. The saved location is the checkpoint's, not wherever the player was when they reloaded. A
crossing's entry is the previous island's exit.

`Chapter.checkpoint` names the current safe point, `saveCheckpoint()` supplies its numeric payload and
`restoreCheckpoint()` rebuilds the continuation. `src/story/checkpoint-data.ts` declares every permitted
chapter/point pair and its positional fields (`CHECKPOINT_FIELDS`, from which `CHECKPOINTS` derives payload lengths),
including legacy layouts. The pure `decodeProgress(unknown)` validator is shared with `readProgress()`; chapters own
semantic clamping and migration. An incompatible schema change needs a version change or a migration. Restore clamps
route indices; malformed or unknown saves and unavailable storage never prevent play.

Every chapter has an entry checkpoint. The additional points:

- Still island: `companion`, after the tree, the fall and the gather, the bird in the child's arms.
- Washing (`lines`): `curtain-1` and `curtain-2` (opened curtains stay open), then `family`, which resumes on the far
  shore with the doorway crossed. A reload during the camera crossing returns to the previous curtain.
- Little Boats: `pool-1` and `pool-2` with fleet progress; the travellers restore on the dry bank between swims and
  the gathered toys at rest.
- Meadow: `piano` (leaving the piano) and `pond` (leaving the pond encounter).
- Birches: `scarf4-1` to `scarf4-4` for each freed tangle, plus `-swing` variants (and `scarf4-0-swing`) after the
  one-time optional swing; the payload holds route leg, swing count, dusk and freed tangles. The last restores the red
  sail. Independent cygnet play makes no checkpoint.
- Stairs in the clouds: `flight-1` to `flight-3`, the number of flights docked; restore rebuilds the docked stairs and
  stands the pair at the matching landing.
- Drowned village: `sail` once the cat is aboard and the drift goes on (resumes on the drift with the cat at the bow;
  a save from before then resumes at the entry, the cat on its chimney); `roofs` from her setting off over the roofs
  (resumes on the strand's ridge with the cat a roof ahead, the fog risen and held behind her and the boat against the
  slates, about to drift; the lens starts in the climb's view and the run takes it round to the tree's);
  `church` from the tower's foot until she is in the belfry (resumes at the tower's foot, the cat on the railings
  below the ivy, the boat lost in the fog); `belfry` from her kneeling over the kittens until she steps aboard
  (resumes with her standing in the opening over the fog sea, the cat curled round its kittens and the bell about to
  be hers to ring, the boat out of sight in the fog); `storm` from her stepping aboard to the beach (resumes seated at
  the nave, the cat and a kitten on the sill, so the look up, the slow blink, the light, the plane and the landing
  play again). All five carry the drift's leg; only `sail` reads it.
- Dark wood: `found` (companion found and gathered) and `dry` (plane recovered and dried), with leg and path distance;
  restore rebuilds the earned light and leaves the next ember unlit.
- Sleeping island: `feather` (the feather leaves the bed; resumes the assisted climb with the summit curtains closed)
  and `morning` (the walk to the boat, curtains open). Neither replays the bedside gesture.
- Long crossing (`toMirror`): `swim`, once the companion's swim is over, with leg and time; restore finds the nearest
  waypoint to the saved boat.
- Sky mirror: `stars4-<mask>` (0–15), the completed-star bitmask and current destination. Restore rebuilds the pair
  with the wand and paper and the lights already overhead, and drops transient bubbles. A partial constellation
  restores the boat offshore; only all four stars open the final approach.
- Home: `reunion` (resume the walk to the house), `drawing` (the sheet open at the brow, without replaying the motif)
  and `complete`, which returns to the thank-you screen until replay is chosen.

Legacy saves stay playable: older point names and payloads (`scarf-*`, `swing` and `leaves` on the birches; `stars`,
`stars-<mask>`, `moon`, `tide`, `lantern`, `reflection` and `window` on the mirror; `toHome` routed through
`toMirror`) map onto the current ones in each chapter's restore. Saves from earlier island layouts carry a geography
revision: `src/story/geography-progress.ts` translates travellers, boat and local life regions to the current
`GEOGRAPHY_VERSION` once, before chapter restoration.

Wing care is reconstructed from chapter and checkpoint by `src/story/wing-care.ts`: bare before the fall, wrapped from
`companion` through Sleeping's `feather`, free from `morning` on. No checkpoint falls inside the treatment or the
unwrapping, so no animation state is serialised.

The record holds the travellers' checkpoint positions, boat state, companion bond, flight count and seat, plane
condition, life regions and chapter progression. A completed piano is not replayed or re-scored. Transient wind,
leaves, particles and animations are rebuilt, not saved. Checkpoints wait until the current child or carry action is
complete; restore starts from a stable pose with fresh callbacks and relative timers. Restore also sets the musical
phase (for example Sleeping's `morning` selects the sea mood) and never emits reward cues; see `audio.md`.

The save is read and restored at the gesture that starts play (Continue, or `?shot` without `start=1`), before
the room's first update and camera cut; boot itself warms and bakes round the unstarted first island (`engine.md`,
Boot). `Play again` clears the record before reloading. `?shot` and `?chapter=` neither read nor write progress unless `?progress=1` is given; `?progress=0`
disables it.

## Chapter select

Once the game has been finished, the title screen offers a faint `chapters` under Begin/Continue. It opens the rooms
as two rows of six small, soft-edged tiles (four rows of three on a phone), each with a one- or two-word name, laid
over the title's own painting; a pick begins that room. The tiles are the title screen's room paintings cut to
400x250 (`src/chapter-select/stills/<room>.webp`), so a room has one picture everywhere; `tools/chapter-stills.mjs`
captures the rooms the paintings are made from (`assets/art-direction/continue/`). It must cost new players nothing,
so `src/chapter-select/` (script, CSS and tiles) is a separate chunk that only a finished player's title screen
imports, and the tiles download only when `chapters` is opened.

The painting stays while the list is open, printed down under the tiles and opening out above them (`docs/styles.md`).
The list opens on the room already behind the title, its tile lit as the current one. Hovering a tile, or
reaching it with the keyboard, crossfades that room's full painting in over .45 s: the new painting fades in over the
old, which stays whole underneath until the new one is whole, so the stack never drops below full cover. The painting
stays on the last room looked at. A touch never moves it, because a tap starts the room at once. With a hovering pointer,
opening the list fetches every room's full painting (`src/paintings/<room>-land.webp`, or `-port`) at low priority, so
a hover never waits on the network; on touch none is fetched. `back`, drawn like `chapters`, stands where `chapters` was and closes the list
without starting, returning focus to `chapters`; the second click of a double click on `chapters` is ignored, so the
list stays open. Escape and a press on empty space close it too. A pick's panel fades out over .45 s as the veil
departs, and the painting leaves with the veil's over .8 s (`tools/chapter-select-check.mjs`).

Finishing sets `updraft.finished.v1`, which `Play again` leaves alone; an old completed save sets it on the next
visit. A pick starts that room at once, on the page already loaded and with sound, exactly as Begin or Continue
starts theirs: the veil departs and `story.start` begins the room as `?chapter=` would, with saving on. The pick
overrides the save without touching it; the room's first played frames save its `entry` checkpoint, which then
replaces it.

## Start over

Any valid save, a completed one included, offers `start over` under Continue (under `chapters` for a finished
player); Begin never does. The first press only asks (`start over and lose your progress?`) and touches nothing; the
question goes back after `tuning.veil.startOverAsks` (6 s), on Escape or when focus leaves it. A second press starts
the first island through the same start path as a pick of the Still island: in place, with sound, and the island's
first played frame saves its checkpoint over the old save. `updraft.finished.v1` stays, so chapter select is still
offered. Its presses stay its own; a press anywhere else on the veil, even while it asks, continues the save
(`tools/start-over-check.mjs`).

## Hidden pages and sound

`Soundscape` responds to `visibilitychange`, `pagehide` and `pageshow`. It suspends the AudioContext while hidden or
muted and resumes it on return only if sound was started and enabled; it never creates audio on a visibility event.
If the browser wants a fresh gesture, the next pointer-down retries, and a rejected resume never breaks play.

A call, Siri or another app can stop a visible, unmuted context (iOS reports `interrupted`, or leaves it
`suspended`). `Soundscape` then retries `resume()` on `statechange`, `pageshow`, window `focus` and any pointer press
or release. Story cues raised meanwhile are held on the frame clock and play, in order and before that frame's own,
once audio runs again, if younger than `tuning.audio.heldCueLife` (3 s); a held foghorn keeps its 0.25 s allowance.
Muted, hidden and not-started audio still consume cues, and muting or hiding drops held ones.

The frame loop skips simulation and rendering while hidden and resets its time baseline on visibility changes, so
story time waits with audio and a long absence is neither a scripted jump nor a slow frame to the quality governor.

The sound on/off choice persists in `updraft.sound.v1` (`src/sound-preference.ts`) and the graphics choice in
`updraft.quality.v2` (`src/gl/quality-preference.ts`); both fall back gracefully when storage is unavailable. Only a
deliberate toggle writes them; `?shot` stays muted.

## Lost graphics context

`src/gl/context-recovery.ts` listens before WebGL boots. A real context loss pauses the frame loop, mutes audio and
makes the controls inert; an uncaught exception inside a frame takes the same path. The recovery dialog reloads the
page from its last valid checkpoint (or restarts when there is none). Browser context restoration alone does not
resume play, because the wind simulation textures and readback fences cannot be rebuilt by Three.js's ordinary
restoration. Recovery writes no save, so an interrupted action returns to the preceding checkpoint.

## Checks

- `node tools/progress-check.mjs`: checkpoint writes and restores, replay, storage failures and hidden-page audio,
  in an isolated browser profile against a dev server (`BASE`); it never touches a player's saves.
- `node tools/progress-schema-check.mjs`: every current and legacy layout, and valid and malformed records, against
  the pre-refactor decoder read from Git (`BASELINE_REF`, default in `tools/lib/baseline.mjs`).
- `node tools/chapter-select-check.mjs`: hidden and never downloaded for new players, offered after finishing, picks
  and save handling.
- `node tools/audio-interruption-check.mjs`: held cues through an interruption and the resume retries.
- `node tools/context-loss-check.mjs`: real `WEBGL_lose_context` during boot and play, with and without a save; the
  simulation stays paused, and the reload restores working wind readbacks.
