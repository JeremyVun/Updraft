# Meadow development plan

## Landscape and play redesign

- [x] Preserve the shore bank; move the piano nearer and sculpt overlapping rolling hills. Inspect the opening
  and piano view in the renderer, and verify CPU/GPU ground agreement and landing invariance.
- [x] Replace giant bells and seed deliveries with low flower swathes, wind-played phrases and lifting seed heads.
  Integrate companion exploration, invitations, retained progress, music and continuous camera travel.
- [x] Verify input, idle, recovery and saves; play from landing through the family and departure with real input.
  Inspect intermediate camera views in landscape and portrait; fix visual failures before final build checks.
- [x] Record results and remaining limits; leave a playable dev server in the worktree.
- [x] Restore the original piano motif camera against a separate original build; keep the family concealed in
  the relocated finale and verify desktop/portrait input, silhouettes and onward framing.
- [x] Fix the seed-bed material's premature colour; guard the shared atmosphere and live piano colour waves.
- [x] Add a soft green trail on the climb and piano approach; inspect it from the player camera and verify that
  untouched ground still waits for the piano.

## Piano hill and recorded score prototype (2026-10-15)

Worktree `.claude/worktrees/agent-af871ede7cd7aa843`, branch `worktree-agent-af871ede7cd7aa843`, dev server 5251.
Brief and the cut table: "Piano hill and the meadow score" in [design.md](design.md).

- [x] Raise the piano's crown and keep the duet camera low behind her (`caf20a2d`); pond hidden through the duet
  in landscape and portrait; protected terrain identical. Open: finale camera move, first-answer visibility,
  portrait framing, the walk camera's pond view after the duet.
- [x] Cut list → small assets (reproducible tool from the source takes), gains to the room reference.
  Seam: one table of segments per beat; swapping a take is an edit to that table.
- [x] Wire the beats: walk loop to the stool, flute calls, traced piano answers sliced at note onsets with the
  outline following the answer's melody, finale greening on its arrival, warm bed, silence for the family,
  ending from the feather; loading/prefetch and checkpoint restores. Retune breath notes and harebells.
  Gate: typecheck, build, real-input duet (four answers required, idle never completes, greening fires on the
  finale cue), a rendered audio timeline of the duet and walk for Jeremy, dev server left on 5251. Done in `fbc3d86f`;
  awaiting Jeremy's listen. Open: the four traced outlines come out nearly alike, answers 2 and 4 trace right to
  left over rising melodies, the guide is faint against the sky, and the answers' synthesised rings need a listen.

## Second playthrough corrections (2026-10-16)

Brief: "Second playthrough of the recorded duet" in [design.md](design.md). Two parallel worktrees off the prototype
branch, merged back into it for Jeremy on 5251.

- [x] Story and camera (`src/story/meadow.ts`, `src/story/piano.ts`, `src/audio/meadow-music.ts`, the `piano`,
  `meadowMusic` and `crest` tuning): finale rise and descent with the surprises absent while it is up; the walk
  round the piano; the warm bed's fade-in; the slower brow turn; no trodden grass in the flower and seed play.
- [x] Flowers and seeds (`src/world/meadow-echoes.ts`, `src/world/meadow-seeds.ts`, `src/story/meadow-song.ts`,
  `src/world/harebells.ts`, the `meadowEchoes` tuning): a sleeping bed that each sweep visibly wakes, no pitched
  notes from the play or the harebells, updraft seeds that rise smoothly and never sink back, seed framing
  against the hills.

## Wind instrument foundation

- [x] Add the hollow wooden bough, reed and local breeze in the piano composition.
- [x] Replace self-playing piano calls with bough calls; reserve piano input for replies and let the bough's
  final phrase cue the full greening. Keep replaceable phrase timing data and procedural placeholders.
- [x] Verify call/input isolation, partial answers, four replies, finale timing and player framing; preserve
  the frozen timing server and document the remaining recording integration.

## Superseded prototype

- [x] Build the seed transfer simulation, bellflowers and procedural breath voice. Verify idle, off-target input,
  useful gestures, recovery and persistent completion at multiple frame rates.
- [x] Integrate child approaches, touches, camera holds, invitations, audio ducking, checkpoint recovery and
  the transition into the crest. Preserve the piano and downstream story contracts.
- [x] Play the chapter with real pointer gestures; inspect player-camera captures, correct failures,
  and check portrait. Run focused regression checks and a production build.
- [x] Record the final experience, evidence and limitations; leave a reviewable worktree and dev server.
- [x] Revisit readiness: fix visible petal contact and bending leaves, include flower crowns in the frame,
  remove the wide retreat before the crest, and verify whole-child framing without losing the swans' departure.

Human motion/listening and first-time comprehension review remain with Jeremy; see `verification.md`.
