# Progress and page lifecycle

Jeremy's decision (2026-09-19): reload returns the player to a checkpoint at an island's entry or exit, or after a point of interest such as the piano. Hide/suspend audio when the page is hidden.

## Saving

`src/story/progress.ts` stores one versioned JSON record in `localStorage` under `updraft.progress.v1`. It belongs to this browser and origin, with no account or server dependency. `Journey` writes on chapter changes and completed interaction exits, never every frame. A crossing's entry is the preceding island's exit. The saved location is the checkpoint location, not wherever the player happened to reload later.

Every chapter has an entry checkpoint. Additional exits:

- Still island: the tree/fall/gather sequence, companion now in the arms.
- Washing: past curtains one and two (`curtain-1`, `curtain-2`, two-number payloads), then through the family’s door (`family`, its existing two-number payload). Completed curtains stay open after restore. `family` resumes on the separate shore with the doorway crossed; older family saves on the washing island migrate to that shore, including the departure boat. A reload during the camera crossing returns to the previous curtain checkpoint.
- Meadow: leaving the piano, then leaving the pond encounter.
- Birches: each freed scarf tangle and leaving the one-time optional swing. `scarf-1` through `scarf-3`,
  plus their `-swing` variants and `scarf-0-swing`, store route leg, swing-used count, dusk and freed-tangle
  count. The final checkpoint restores the red sail. Older three-number swing/leaf saves resume their saved
  walk position with one/two tangles already freed. Independent cygnet play creates no separate checkpoint.
- Drowned village: wind has filled the sail and the boat is moving again.
- Dark wood: companion found and gathered; recovered plane dried. The two-number payload remains leg/path
  distance. Restore rebuilds earned light beside the child and leaves the next ember unlit at its saved distance.
- Sleeping island: feather leaves the bed; morning together is over and they walk to the boat.
- Long crossing: companion's swim is over. The two-number payload remains leg/time; restore finds the nearest
  waypoint to the saved boat position so checkpoints from the shorter coastal route continue toward home.
- Home: reunion is over; drawing is folded and ready for release; completed ending.

`Chapter.checkpoint` names a safe exit; `saveCheckpoint()` supplies its numeric story state and `restoreCheckpoint()` rebuilds its continuation. `CHECKPOINTS` declares permitted chapter/point pairs and payload lengths. Changing this schema incompatibly requires a version change or migration. Restore clamps route indices. Malformed/unknown saves and unavailable storage must not prevent playing.

The record keeps the travellers' checkpoint positions, boat state, companion bond/flight count/seat, plane condition, life regions and chapter-specific progression. A completed piano is not replayed or re-scored; its wave and waiting region are retained. Transient wind, individual leaves, particle fields and animations are rebuilt, not serialized. Checkpoints wait until the current child/carry action is complete; restore starts from a stable pose with new callbacks and relative timers.

Startup restores before the initial camera cut, terrain bake and warm render. `Play again` clears the record before reloading. The completed-ending checkpoint returns to credits until replay is chosen. `?shot` and `?chapter=` neither read nor write normal progress; use `?progress=1` explicitly for persistence QA, or `?progress=0` to disable it.

## Hidden pages and sound

`Soundscape` responds to `visibilitychange`, `pagehide` and `pageshow`. It suspends the existing AudioContext while hidden or muted, and resumes it on return only if sound was already started and enabled. It never creates audio on a visibility event. If the browser requires a fresh gesture to resume, the next pointer-down retries. A rejected resume does not break gameplay.

The frame loop skips simulation and rendering while hidden, and resets its time baseline on visibility changes. Story time therefore waits with audio; a long absence does not advance a scripted beat or appear to the quality governor as a slow frame.

Verification: `node tools/progress-check.mjs` against a dev server; `BASE` selects another server. It uses an isolated browser profile and does not touch a player's saves. Logs and screenshots go to `/tmp`.
