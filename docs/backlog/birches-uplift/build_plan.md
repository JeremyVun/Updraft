# Birches uplift: build plan

Design: [design.md](design.md). Everything is built in the worktree `/Users/jeremy/projects/updraft-birches` on branch
`birches-uplift`. Nothing merges to `main` without Jeremy's approval.

## Worktrees and ports

Sequential phases build in `/Users/jeremy/projects/updraft-birches` (branch `birches-uplift`, dev server port 5231).
Phases running alongside get their own worktree branched from `birches-uplift`, merged back by the orchestrator
when done: 3a in `/Users/jeremy/projects/updraft-birches-squirrel` (port 5232), 3c in
`/Users/jeremy/projects/updraft-birches-echo` (port 5233). Each worktree has its own `node_modules` (`npm ci`).
Point the tools at a server with `BASE=http://127.0.0.1:<port>/`.

## Every brief includes

- Every agent is the latest Opus. Read `AGENTS.md`, `docs/journey.md`, design.md and this phase, then the files
  the phase owns.
- Run `coord note "<intent>"` first. Never `git stash`. Never restore or overwrite a file wholesale.
- Run builds, checks and captures in the foreground, splitting anything over the 10-minute tool limit into pieces
  (one case, seed or batch per call). Never background a job to wait on it. The one background job allowed is a dev
  server, on its own port (`npm run dev -- --port <n>`) when another phase is running at the same time.
- Browser tools use Playwright's Chrome for Testing (`channel: 'chromium'`), never the installed Google Chrome.
- Put output in `/tmp` (`mktemp -d`). Report stills and strips by path; record videos only when they will be
  watched for motion.
- Commit to `birches-uplift` at the end of the phase with the attribution trailer. Mark the phase done here, with
  what was measured.

## Phases

### 1. Grow and move the island. Opus. Done: ☑ (2026-10-15)

Built as design.md "As built (phase 1)" records: gaps A, B and C opened 16, 16 and 24 m at band z −1080.95,
−1101.5 and −1154; `BIRCHES_SHIFT` (−40, +16), geography revision 12; coast drawn in to 48 m beyond 25 m of the
middle, and the outer wood thinned. Trees 147 → 146; `toBirches` 15.22 → 15.47 s (far shore 23.25 → 24.58 s);
push-off to the stairs 23.3 → 29.4 s; scarf 1140 → 1180 rows; litter 214 × 332; loose leaves 192 × 265. Every
tangle's wool, every band's ground and grass, and 100 of today's trees are exactly as before. Later phases author
positions in band-local terms through `birchesAt` / `birchesGap` (`world/birches-layout.ts`).


Owns `world/geography.ts`, the birches entries of `world/heightfield.ts` (`ISLES.birches`, `BIRCH_RISE`,
`BIRCH_HOLLOW`, `birchesHeight` and `hf_birches`), `world/birches.ts`, `world/birch-scarf.ts` (`ROWS` and the
points), `fx/leaves.ts` (the litter and loose-leaf grids' shapes), `story/birches.ts`, the `toBirches`/`toStairs` routes in
`story/journey.ts`, wherever saved coordinates are migrated by `GEOGRAPHY_VERSION`, and any tool with birches
coordinates baked in (`tools/scarf-check.mjs`, `scarf-geometry-check.mjs`, `birches-drift-check.mjs`, the
playthrough).

- First, measure and record in design.md: the current `toStairs` and `toBirches` sailing times with no input (from
  `?chapter=toStairs` and `?chapter=toBirches` in the QA preview), and the tree count. No performance benchmarks in
  this build: Jeremy profiles in another session (2026-10-15). Use common sense instead (design.md "Keeping the cost
  flat").
- Step 1, refactor only: route every birches literal through one mapping, the bands and the shift, so that zero gaps
  and a zero shift reproduce today's world exactly. Check with stills, then commit.
- Step 2: open gaps A, B and C at cut lines where no feature straddles the cut. Lengthen the dome and the hollow,
  narrow `rx` until the tree count is back to the baseline (±5%), reshape the litter grid to keep today's cell size,
  grow the loose-leaf grid along one side with the walk, and raise `ROWS` in proportion to the scarf's new length.
- Step 3: choose the shift (mostly west) to meet the crossing and clearance constraints in design.md. Never change
  boat speed or crossing pace to hit the time; only distance.
- **Seam:** later phases author positions through the same mapping, in band-local terms, never as new absolute
  numbers. The empty gaps are where phases 4 and 5 put rounds 1–3.
- **Gate:** typecheck and build. Sailing times and tree count re-measured and recorded beside the baseline. `scarf-check` (all modes) and `birches-drift-check` pass, and the tangles' close stills match today's.
  Before/after stills: the arrival, each gap from the walk, the crest, the hollow, the berth and departure,
  mid-`toStairs`, the stairs landing under the deck, and the view north from the meadow's far shore. A save made at a
  birches checkpoint and at `toStairs` before the change resumes correctly after it.

### 2. Music. Opus. Done: ☐ (after 1; may run alongside 3)

Owns `assets/music/red_door.ogg` (a copy of "The Red Door Opens"; leave every other file in `assets/music`
untouched), `audio/music-loading.ts`, the recorded-score and sound-state wiring for the birches and stairs tracks,
`tuning.audio` (`recordedMusicDb`, `stairsSongCloudFade`), `audio/stairs-sound.ts`'s white fade, the `toStairs`
crossing options in `story/journey.ts`, `docs/contracts/audio.md` (Birches, the stairs, prefetch and memory), the
sound line in `docs/stairs.md`, and the music checks (`village-music-check.mjs`, `clouds-music-check.mjs`,
`music-transition-audit.mjs`, as they need).

- Do what design.md "Music" says. Measure Red Door's LUFS and set its level by the existing method. Record the
  number in the audio contract.
- **Gate:** `npm run check:audio`, `village-music-check`, `clouds-music-check`. Render `toStairs` from push-off to
  the white with `music-transition-audit` (or `stairs-audio-proposal.mjs`) and report: Red Door's end or fade
  time, the length of the quiet gap, `birches.ogg`'s start, and its fade in the white.

### 3a. The squirrel's look. Opus (visual). Done: ☑ (after 1; may run alongside 2)

Owns `src/creatures/squirrel.ts`, `src/creatures/squirrel/` (`body`, `shader`, `pose`), `src/story/squirrel-yard.ts`
with its stage hook (as `cat-yard.ts` is wired), and `tools/squirrel-check.mjs`.

- The cat (`creatures/cat.ts`, `creatures/cat/`) is the template for structure, skinning and shading. The owl and
  the clouds are the quality bar. The look and scale are in design.md "The squirrel".
- Static poses for every action (`sit` with nut, `freeze`, `perch`, `buried` tail out and tail in, `peek`), in the
  birches' light: a stage variant or a `?chapter=birches` eval placement.
- **Seam (the API phases 3b and 5 build on):** `Squirrel` with `position`/`yaw`, `act(name, opts)`, `follow(path,
  onArrive)` (a path of ground, trunk and scarf points), `hide(at, { tailOut })`, `flush()` (burst out),
  `perchAt(point, yaw)`, `visible`, `update(dt, time)`, and a `busy` flag. Phase 3a fills in the poses behind it;
  3b fills in the motion.
- **Gate:** stills at gameplay distance beside the child and cygnet, in the room's own light, at 390×844 portrait
  and 1440×900 landscape. In the round frames (about 14–17 m), the squirrel's sitting-up silhouette is at least
  about 28 px tall in portrait. Close stills for the face, ear tufts and tail. The orchestrator reviews them, then
  shares them with Jeremy (opened in Preview) and carries on unless he objects.
- **Built:** one skinned mesh (31 bones, an 8-link tail) with fur shells, shaded with `ATMO_GLSL` like the cat; a
  held stance per action in `pose.ts` (`STANCES`), eased into with breath, blinks, ear flicks and snap glances; the
  seam as above, `follow` a placeholder glide in the gait's shape; `tuning.squirrel`; a QA yard out on the stage's
  sea (litter, heap, log, birch and limb); `tools/squirrel-check.mjs` (poses with contact numbers, close stills, round
  1's frame in the birches). Measured at 1.7×: sitting 0.34 m tall; at 15 m it is 28 px in landscape and 15 px in
  portrait (the game's 62° portrait lens), short of the 28 px mirror. The child's face stands 2.1 m and the cygnet's
  eye 0.8 m above the ground, so at 1.7× it is a third of the cygnet and the size of one litter leaf; 2.3× gives
  38 / 21 px. The scale (`tuning.squirrel.scale`) and the portrait round frames are for phase 4 to settle.

### 3b. The squirrel's motion and voice. Opus. Done: ☐ (after 3a)

Owns `src/creatures/squirrel/` (`gait`, `voice`, the actions' motion in `pose`), `squirrel.ts` mechanics,
`squirrel-check.mjs` strips.

- `bound` with planted paws, `dive` into `buried`, `burst`, `climb` up and down a trunk, `run-line` along a sagging
  wool path, `scold` with tail flicks, `peek`. A synthesised voice and claw-on-bark sound, built like the cat's.
- **Gate:** motion strips and one clip each of bound, dive→burst, climb and run-line, watched by the orchestrator
  for motion. Contact via skinned vertices against the rendered ground, litter surface and bark (no floating, no
  sinking except when `buried`). No pops or foot slip beyond the cat's limits.

### 3c. Autumn leaves on the stairs island. Opus (visual). Done: ☑ (independent; may run alongside 2 and 3a)

Owns `world/echoes.ts` (or a small module beside it that it creates). Build design.md "Autumn leaves on the stairs
island".

- **Gate:** before/after stills of the stairs arrival, the walk to the stairs' foot and the first flights, in
  portrait and landscape. Nothing lies on the walk or in the way of the stairs' own play. They read as birch gold in
  the stairs' light, and nothing in the room's existing look changes.

### 4. Storyboard and layout. Opus (visual). Done: ☑ (2026-10-16)

Owns the new `BIRCH_PILES` entries in `world/birches.ts` (two for round 2 in gap B, three for round 3 in gap C,
each banked against a birch), and a layout module `src/story/birches-rounds.ts` holding each round's area, heaps, the
child's standing point, the camera frame, the squirrel's paths between rounds, its perches at each tangle, the swing
limb and the goodbye branch.

- Stage every stop in design.md "The room, stop by stop" in-engine with the real squirrel posed by eval: the meeting
  on the log, each round's frame with tells showing, each dash's start and end, its perch at each tangle, the leap's
  drift, and the goodbye. Check that no squirrel position blocks a tangle's gesture or camera, and that no new heap
  sits on the ride or in a tangle's frame.
- **Gate:** a strip of stills per stop in portrait and landscape, reviewed by the orchestrator. Final positions are
  recorded in design.md, replacing "settled in the storyboard phase".
- **Built:** design.md "As storyboarded". Heaps 4–8 with five placed bank birches (`BANKS`), gap-grown trees kept off
  each round's view (`ROUND_VIEWS`), and `AutumnBirches.trunkAt` / `swingLimbAt` for climbing; the island keeps 146
  trees and its leaf count. `story/birches-rounds.ts` holds the three rounds (area, heaps, hides, stand, last
  sighting, the cygnet's likely places, portrait and landscape frames), the leap, the meeting seat, a perch at each
  tangle, the swing limb, the far trunk, the goodbye and nine paths. Staged at every stop through the lens with the
  squirrel at 3×: 24–61 px landscape, 13–31 px portrait; hides read back at 0.85–1.0 m of heaped leaves. Round 3
  leaves heap 2 out (the wool over it cuts every frame toward the light), tangle 1's perch is on the floor at the
  loop's foot (the fork is hidden in gold from that lens), and the goodbye is at the water's edge (no branch reaches
  the berth).

### 5. The game. Opus. Done: ☐ (after 3b and 4)

Owns `src/story/birches-squirrel.ts` (rounds, live-depth hides via `Readback`, the trunk fallback, finding, tells,
the cygnet's co-seeking, the stall hint and invitation, the leap), the integration into `story/birches.ts` (new
beats, the walk's next stop across tangles and rounds, frames, the squirrel at tangles, the swing and the goodbye),
the save payload and point names in `story/checkpoint-data.ts`, `audio/birches-foley.ts` (rustle tells, bursts,
the leap), `tuning.birches.squirrel` knobs, and a new `tools/squirrel-rounds-check.mjs`.

- Numbers to build to (design.md "A round"): tell interval 2.5–4 s; tail-out share 0.5 / 0.33 / 0.2 by round; find
  radius = heap radius + 1.5 m; hint at 10 s, invitation at 18 s without wind on the right heap; one deliberate
  swipe or two near misses finds it.
- Hides are chosen from one asynchronous readback per choice, never a synchronous read and never every frame.
- **Gate:** typecheck. `squirrel-rounds-check` with real gestures covers: each round found on the right heap;
  wrong heaps first; random swipes only; a stall through the hint and the invitation; every heap blown flat before
  arrival (drift and trunk fallbacks); the leap with a deep drift and with a bare hollow; and a resume at every new
  checkpoint and from pre-build save names. Existing `scarf-check` (all modes) and the swing still pass.

### 6. Verification wave. Opus. Done: ☐ (after 2 and 5)

Run against `npm run build:qa` then `npm run preview:qa`.

- Full-room clips with real gestures in portrait and landscape, from the `toBirches` arrival through the `toStairs`
  landing, with an engaged player and with a careless one. The orchestrator watches them for pacing, legibility,
  camera and contact. Fix what they show (fixes go back to the owning phase's files), then re-capture only what
  changed.
- Time on the island with an engaged player: 3½–4½ min. Report the measurement.
- Sound in the real game: `village-music-browser-check.mjs` and a listen-render of the room and crossing.

### 7. Docs and close. Opus. Done: ☐

Rewrite chapters.md "The birches" for the room as built, with the squirrel's files, knobs and checks. Fix the
journey.md one-liner for the birches, the audio contract and `docs/stairs.md` where phase 2 didn't, and the roadmap
(drop the "Birches uplift" entry). Then run the backlog-item close stage. The orchestrator summarises for Jeremy
what the branch changes, with stills and the clip paths, and merges only on his approval.
