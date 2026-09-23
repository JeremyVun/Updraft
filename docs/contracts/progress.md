# Progress and page lifecycle

Jeremy's decision (2026-09-19): reload returns the player to a checkpoint at an island's entry or exit, or after a point of interest such as the piano. Hide/suspend audio when the page is hidden.

## Saving

`src/story/progress.ts` stores one versioned JSON record in `localStorage` under `updraft.progress.v1`. It belongs to this browser and origin, with no account or server dependency. `Journey` writes on chapter changes and completed interaction exits, never every frame. A crossing's entry is the preceding island's exit. The saved location is the checkpoint location, not wherever the player happened to reload later.

Every chapter has an entry checkpoint. Additional exits:

- Still island: the tree/fall/gather sequence, companion now in the arms.
- Washing: past curtains one and two (`curtain-1`, `curtain-2`, two-number payloads), then through the family’s door (`family`, its existing two-number payload). Completed curtains stay open after restore. `family` resumes on the separate shore with the doorway crossed; older family saves on the washing island migrate to that shore, including the departure boat. A reload during the camera crossing returns to the previous curtain checkpoint.
- Little boats: `pool-1` and `pool-2`, each with one number for fleet progress. Restore the travellers on
  the dry bank between swims and rebuild the gathered toys at rest. Pre-Little-Boats `toMeadow` entry saves
  from the washing shore resume at the current Little Boats departure berth.
- Meadow: leaving the piano, then leaving the pond encounter.
- Birches: each freed scarf tangle and leaving the one-time optional swing. `scarf4-1` through `scarf4-4`,
  plus their `-swing` variants and `scarf4-0-swing`, store route leg, swing-used count, dusk and freed-tangle
  count. The final checkpoint restores the red sail. Legacy `scarf-3` saves map to all four knots freed;
  `scarf4-3` leaves the final bow intact. Older three-number swing/leaf saves resume their saved
  walk position with one/two tangles already freed. Independent cygnet play creates no separate checkpoint.
- Drowned village: wind has filled the sail and the boat is moving again.
- Dark wood: companion found and gathered; recovered plane dried. The two-number payload remains leg/path
  distance. Restore rebuilds earned light beside the child and leaves the next ember unlit at its saved distance.
- Sleeping island: feather leaves the bed; morning together is over and they walk to the boat. The
  feather checkpoint resumes the assisted climb with the summit curtains closed; the morning checkpoint
  restores them open. Neither changes the payload or replays the bedside gesture.
- Long crossing: companion's swim is over. The two-number payload remains leg/time; restore finds the nearest
  waypoint to the saved boat position so checkpoints from the shorter coastal route continue toward home.
- Sky mirror: `stars4-<mask>` (0–15) stores the completed-star bitmask and current destination. Restore rebuilds the
  pair with the wand and held paper, preserves lights already overhead, and discards transient bubbles.
  A partial constellation restores the boat offshore; only all four stars open its final approach.
  Older `stars`/`stars-<mask>` saves retain partial progress; mask 7 restores all four to preserve completion.
  New `stars4-7` saves leave the fourth light playable.
  Legacy `moon`/`tide`/`lantern` map to 0/1/2 restored stars; `reflection`/`window` restart with none.
  Voyages use `toMirror` (entry/swim) and `toHarbour` (entry); old `toHome` saves keep the direct route.
- Home: reunion is over (resume the walk toward the house); house/drawing recognition is complete (resume
  with the sheet open at the brow, without replaying the motif); completed ending. Existing checkpoint names
  `reunion`, `drawing` and `complete` remain valid.

`Chapter.checkpoint` names a safe exit; `saveCheckpoint()` supplies its numeric story state and `restoreCheckpoint()` rebuilds its continuation. `CHECKPOINTS` declares permitted chapter/point pairs and payload lengths. Changing this schema incompatibly requires a version change or migration. Restore clamps route indices. Malformed/unknown saves and unavailable storage must not prevent playing.

`story/checkpoint-data.ts` names the positional fields in `CHECKPOINT_FIELDS`, derives `CHECKPOINTS` lengths
and supplies numeric tuple types to the current chapter writers. Legacy layouts remain explicit. The pure
`decodeProgress(unknown)` validator is shared with `readProgress()`; chapter-specific restoration still
owns semantic clamping and migration. `tools/progress-schema-check.mjs` compares all 69 layouts and valid/
malformed records against the pre-refactor decoder. This consolidation does not change the v1 wire format.

Wing care is reconstructed from chapter and checkpoint by `story/wing-care.ts`: bare before the fall, wrapped from
the companion checkpoint through sleeping/feather, and free from sleeping/morning onward. The same rule migrates
older saves and applies to chapter shortcuts. No checkpoint falls inside treatment or unwrapping, so there is no
new serialized animation state. A reload before the sleeping glide repeats the hilltop release; later saves never
put the bandage back on.

The record keeps the travellers' checkpoint positions, boat state, companion bond/flight count/seat, plane condition, life regions and chapter-specific progression. A completed piano is not replayed or re-scored; its wave and waiting region are retained. Transient wind, individual leaves, particle fields and animations are rebuilt, not serialized. Checkpoints wait until the current child/carry action is complete; restore starts from a stable pose with new callbacks and relative timers.

Geography revision 4 places Little Boats west of the door shore for the shorter crossings. Original and
revision 1/2/3 saves translate
the travellers, boat and local life regions together at `boats` and `toMeadow` checkpoints, preserving pool
progress. Revision 3 saves receive only the adjustment from the longer offshore layout. Revision 2/3 saves
retain their existing mirror/home coordinates and swim progress; the earlier sea
relocation applies only to older revisions. Migration runs once, before chapter restoration.

Startup restores before the initial camera cut, terrain bake and warm render. `Play again` clears the record before reloading. The completed-ending checkpoint returns to credits until replay is chosen. `?shot` and `?chapter=` neither read nor write normal progress; use `?progress=1` explicitly for persistence QA, or `?progress=0` to disable it.

Restore the musical phase with the story state. Sleeping's `morning` selects the sea mood and `hush=0.1`;
earlier Sleeping progression retains wood. Completed piano restoration clears pending completion audio.
Neither restore emits reward cues. See `audio.md` for gesture, source and cue contracts.

## Hidden pages and sound

`Soundscape` responds to `visibilitychange`, `pagehide` and `pageshow`. It suspends the existing AudioContext while hidden or muted, and resumes it on return only if sound was already started and enabled. It never creates audio on a visibility event. If the browser requires a fresh gesture to resume, the next pointer-down retries. A rejected resume does not break gameplay.

The frame loop skips simulation and rendering while hidden, and resets its time baseline on visibility changes. Story time therefore waits with audio; a long absence does not advance a scripted beat or appear to the quality governor as a slow frame.

Verification: `node tools/progress-check.mjs` against a dev server; `BASE` selects another server. It uses an isolated browser profile and does not touch a player's saves. Logs and screenshots go to `/tmp`.

## Lost graphics context

`src/gl/context-recovery.ts` listens before WebGL boot. A real context loss pauses the frame loop, mutes audio
and makes the game controls inert. The recovery dialog reloads the page from its last valid checkpoint (or
restarts when no save exists). Browser context restoration alone does not resume play: wind simulation textures
and raw readback fences cannot be reconstructed by Three.js's ordinary resource restoration. No save is written
by recovery, so an interrupted action returns to the preceding stable checkpoint.

`node tools/context-loss-check.mjs` uses `WEBGL_lose_context` in local Chrome, restores the context, verifies
that the broken simulation remains paused, then reloads through the UI and checks that wind readbacks advance.
It covers both saved and unsaved play. A phone is not needed for this fault-injection check.
