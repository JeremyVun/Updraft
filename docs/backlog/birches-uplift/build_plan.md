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
−1101.5 and −1154; `BIRCHES_SHIFT` (−40, +16), geography revision 12 (moved out to (−136, −16) after Jeremy's first
playtest, design.md "Moved out after the playtest"); coast drawn in to 48 m beyond 25 m of the
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

### 2. Music. Opus. Done: ☑ (2026-10-15)

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
- **Built:** track keys `birches` → `red_door.ogg`, `stairs` → `birches.ogg`; Red Door measures −18.3 LUFS (ffmpeg
  `ebur128`, the contract's method; birches.ogg re-measures −16.0) and uses −10.7 dB, the −29 reference the others
  sit at. No stairs room trim: −13 dB already puts the stairs song there, and `roomTrimDb` is not applied to recorded
  playback (Birches' −2.5 dB stays, unused). Red Door begins only on its island or the approach; a `toStairs` start is
  quiet until the stairs song. The crossing exposes `arrivalIn` (distance to the handoff's entrance over the boat's
  speed now); at 15 s or less a pass that would sound past `stairsSongRest` (10 s) before the song fades over
  `birchesSailFade` (5 s), and the stairs song also waits `stairsSongRest` after Red Door was last heard, because the
  boat gathers way after the estimate (and gusts drive it on). The stairs song enters on the `toStairs` crossing's
  `arrivalMusic: 'stairs'` handoff from its top, loops under the cloud and fades over `stairsSongCloudFade` (3 s) in
  the white. Prefetch: Red Door in the meadow, the stairs song from the birches on, `clouds.ogg` under the cloud.
  Measured in the real game with no input (`village-music-browser-check.mjs sail`), from the push-off: aboard 2.8 s,
  Red Door fades 8.7–13.7 s, the handoff is asked for at 14.0 and ready at 20.4, the stairs song starts 23.7 s (held
  3.3 s for the rest; quiet gap 10.0 s), landing 29.4 s (song 5.7 s before it), the white 41.4 s, the song gone 3.0 s
  later. Offline (`music-transition-audit.mjs`, `sail-faded`/`sail-ended`): a pass 30 s in at push-off fades
  8.6–13.5 s, song 23.5 s; a pass 8 s from its end ends by itself at 8.0 s, song on the handoff at 20.5 s (gap 12.5 s).
  `npm run check:audio` fails in `audio`, `meadow-score`, `opening-score` and `piano-audio` exactly as on the base
  commit (meadow, piano and opening fixtures, outside this phase); everything else passes.

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

### 3b. The squirrel's motion and voice. Opus. Done: ☑ (after 3a)

Owns `src/creatures/squirrel/` (`gait`, `voice`, the actions' motion in `pose`), `squirrel.ts` mechanics,
`squirrel-check.mjs` strips.

- `bound` with planted paws, `dive` into `buried`, `burst`, `climb` up and down a trunk, `run-line` along a sagging
  wool path, `scold` with tail flicks, `peek`. A synthesised voice and claw-on-bark sound, built like the cat's.
- **Gate:** motion strips and one clip each of bound, dive→burst, climb and run-line, watched by the orchestrator
  for motion. Contact via skinned vertices against the rendered ground, litter surface and bark (no floating, no
  sinking except when `buried`). No pops or foot slip beyond the cat's limits.
- **Built:** scale 3.0 (forearms slimmed, ear tufts a brush of bowed wisps, the perch tail curled over the back).
  `squirrel/gait.ts` plants paws by distance travelled in a squirrel's bound (forepaws land, hind feet swing through
  outside them and land ahead), one pattern per surface; `bound.ts` shapes the body through the stride;
  `route.ts` makes a `follow` path one smooth way over the ground, round trunks (`spiral`) and along the wool
  (`sagging`), the paws snapping to that surface and leaping together from one surface to the next. `dive` and
  `burst` are timed arcs, `peek` rises and goes back under, `scold` chucks in bouts with jaw, body and tail
  flicks, `sit` nibbles in bouts. `voice.ts` synthesises the chuck, chatter, squeak, claws, patter, landing and
  gnawing (`squirrel.heard`, played positionally in `main.ts`); `onLeaves` reports dive, burst, peek and ground
  steps. Measured on the yard (`squirrel-check.mjs MODES=motion`): planted-paw slip 0 in every motion; leg short
  of a planted paw at most 4 mm except 13 mm in a scold's chuck after a burst; sink and float at most 7 mm and
  9 mm through bound, climbs, wool and scold, with transients of 13 mm (pelvis at a burst's take-off) and 26 mm
  (a hind foot in a wool-to-trunk leap). In the round frame at 15 / 12 m the sitting squirrel is 50 / 62 px tall in
  landscape and 27 / 34 px in portrait.

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
  each round's view (`ROUND_VIEWS`), and `AutumnBirches.trunkAt` for climbing; the island keeps 146
  trees and its leaf count. `story/birches-rounds.ts` holds the three rounds (area, heaps, hides, stand, last
  sighting, the cygnet's likely places, portrait and landscape frames), the leap, the meeting seat, a perch at each
  tangle, the swing limb, the far trunk, the goodbye and nine paths. Staged at every stop through the lens with the
  squirrel at 3×: 24–61 px landscape, 13–31 px portrait; hides read back at 0.85–1.0 m of heaped leaves. Round 3
  leaves heap 2 out (the wool over it cuts every frame toward the light), tangle 1's perch is on the floor at the
  loop's foot (the fork is hidden in gold from that lens), and the goodbye is at the water's edge (no branch reaches
  the berth).

### 5a. Heaps that read, and leaves that fly. Opus (visual). Done: ☑ (2026-10-16)

Worktree `/Users/jeremy/projects/updraft-birches-heaps`, branch `birches-uplift-heaps`. Owns `src/world/birches.ts`
(heap seeding and the litter's look over heaps), `src/fx/leaves.ts`, and the wiring of `squirrel.onLeaves` to the
world.

Orchestrator review of phase 4's storyboard (2026-10-16): **the heaps do not read as heaps.** In every round frame
the floor is one even gold carpet, so there are no distinct mounds for the player to choose between, and a
hide-and-seek among heaps nobody can see is not a game. Make each round heap a distinct mound from its round's
frame, in portrait and landscape: a child's leaf pile, with a clear silhouette, a lit side and a shadowed side under
the low sun, and a base that reads against the floor around it. The tools are deeper and steeper heaps, scuffed
thinner ground round each heap where its leaves were gathered from, and shading of the litter over a heap. Keep the
room's look: the leaves must not behave like grass, the gold and the light stay as they are, and the wind still
bursts a heap exactly as now and never rebuilds it.

- Bury the 3× squirrel so its back never shows between the leaf cards from its round's camera (phase 4 saw it in
  the near heaps), with only the tail tip out when `tailOut`.
- Loose leaves: phase 4 found every simulated leaf more than 58 m from the child is moved round her, so bursts at
  rounds 2 and 3 throw only litter cards. Put a share of the moved leaves onto the coming round's heaps, so a burst
  (squirrel, wind or leap) throws a real spray of tumbling leaves.
- **Seam to 5b:**
  - `AutumnBirches.depthAt(points): Promise<number[]>`: live litter height in metres over the ground, from one
    batched asynchronous readback (the engine's `Readback`), never synchronous and never every frame.
  - `AutumnBirches.burst(x, z, strength)`: something going into or out of the leaves. It lifts the litter
    (today's `kick`) and throws loose leaves.
  - `squirrel.onLeaves` wired to `burst` (dive 0.55, burst 1, peek 0.2; ignore `step`).
  - A per-heap `buryDepth`, or a function giving how low to set the squirrel in a heap so it is hidden.
- **Gate:** before/after stills of every round frame from `story/birches-rounds.ts` (`frameShot`), portrait and
  landscape, with the squirrel buried tail-out. Each heap must read as a distinct mound at a glance. Also a strip
  of a squirrel burst and a wind burst at a round-3 heap showing the spray, and the walking frames through the gaps
  to prove the floor elsewhere is unchanged.

- **Built:** design.md "Heaps (phase 5a)". Measured: every round frame, portrait and landscape, shows each round heap
  as a distinct mound; the buried squirrel (3×) shows 0 px tail in (4 px, an ear-tuft wisp, in round 1 landscape)
  and only its tail's tip tail out, by redrawing each frozen frame without it; live heights 0.73–0.82 m at the hides,
  0.87–0.97 m at round heap middles; 1,386–2,748 loose leaves lie in each heap and stay there; a squirrel burst at
  round 3 throws about 650 into the air. The walking frames through gaps A, B and C and tangle 1's frame are
  unchanged away from the heaps. Typecheck, build, `birches-drift-check` and `scarf-check` pass. `LEAF_COUNT`
  unchanged; the heaps add one draw of about 19,000 small cards and one of about 6,600 vertices, both only near
  the island.

### 5b. The game. Opus. Done: ☑ (2026-10-15)

Worktree `/Users/jeremy/projects/updraft-birches`, branch `birches-uplift`. Owns `src/story/birches-squirrel.ts`
(rounds, hides via `depthAt`, the trunk fallback, finding, tells, the cygnet's co-seeking, the stall hint and
invitation, the leap), the integration into `story/birches.ts` (new beats, the walk's next stop across tangles and
rounds, frames, the squirrel at tangles, the swing and the goodbye), `story/birches-rounds.ts` (adjust frames), the
save payload and point names in `story/checkpoint-data.ts`, `audio/birches-foley.ts` (rustle tells, bursts, the
leap), `tuning.birches.squirrel` knobs, and a new `tools/squirrel-rounds-check.mjs`. Until 5a lands, call `depthAt`
and `burst` through a thin local stand-in (`kick` and the authored heap depths) with the same signatures.

- Numbers to build to (design.md "A round"): tell interval 2.5–4 s; tail-out share 0.5 / 0.33 / 0.2 by round; find
  radius = heap radius + 1.5 m; hint at 10 s, invitation at 18 s without wind on the right heap; one deliberate
  swipe or two near misses finds it.
- Orchestrator review of phase 4 (2026-10-16): **portrait round frames are too far.** The squirrel measured 13–31
  px tall in portrait. Bring portrait round frames in until the squirrel buried, peeking or sitting reads (about
  30 px or more) while the child stays whole and the heaps stay in frame. Also give the meeting on the log and the
  wool dash after tangle 1 (24 px) a low-weight glance (`focus`), never a pan.
- **Gate:** typecheck. `squirrel-rounds-check` with real gestures covers: each round found on the right heap;
  wrong heaps first; random swipes only; a stall through the hint and the invitation; every heap blown flat before
  arrival (drift and trunk fallbacks); the leap with a deep drift and with a bare hollow; and a resume at every new
  checkpoint and from pre-build save names. Existing `scarf-check` (all modes) and the swing still pass. One smoke
  drive through the whole room. The full look loop belongs to phase 6.
- **Built:** design.md "As built (phase 5b)". Merged 5a (a618073b) mid-phase and deleted the stand-in; the game reads
  `depthAt`, `burst` and `buryDepth` directly. `squirrel-rounds-check` (dev server, real strokes, 1600×900): one stroke
  across the right heap finds it in every round, 0.75–0.8 s after the stroke begins; wrong heaps first never find it
  in round 3, nor round 2's far heap from the near one (a hard stroke over the far heap does find it in the near one);
  random swipes found it in 1–25 strokes a round over three seeds; stalled, the cygnet stands peering at the right heap
  at 10–11.6 s and the drawn sweep shows at 18.1–18.6 s, nothing found in 30 s; blown flat by real strokes (hides
  0.84–0.98 m → 0–0.24 m) it went behind a bank trunk in rounds 2 and 3, and forced drift and trunk floors bury it in
  a drift in frame and behind a trunk, each found in one stroke; the leap 5.9–8.2 s, the bare run 2 s; 17 resume
  points (8 new, 9 pre-build) put it at its perch (0 m off) or hidden in the next round, and two real reloads resume
  it. Squirrel sitting up, skinned outline: 49 / 79, 37 / 77, 41, 31 px landscape; 34 / 63, 38 / 49, 32, 26 px
  portrait (portrait was 13–31 px); peeks clear the leaves by 11–29 px. `scarf-check` default, PHYSICS=1 and
  NATURAL=1, the swing, `progress-schema` (145 layouts), `plane-routing`, `scarf-geometry`, `birches-score`,
  `birches-foley`, `journey-pacing` and `npm run check` pass. Smoke drive (`playthrough.mjs` from a `toBirches` save,
  `UNTIL=toStairs`, a brisk player: every round found in one or two sweeps, the swing declined, the leap taken): 184 s
  on the island (3:04); 194 s in an earlier run that took the bare-hollow run. An engaged player who rides the swing
  and misses a heap or two adds roughly 30–60 s.

### 6. Verification wave. Opus. Done: ☑ (2026-10-15)

Run against `npm run build:qa` then `npm run preview:qa`.

- Full-room clips with real gestures in portrait and landscape, from the `toBirches` arrival through the `toStairs`
  landing, with an engaged player and with a careless one. The orchestrator watches them for pacing, legibility,
  camera and contact. Fix what they show (fixes go back to the owning phase's files), then re-capture only what
  changed.
- Time on the island with an engaged player: 3½–4½ min. Report the measurement.
- Sound in the real game: `village-music-browser-check.mjs` and a listen-render of the room and crossing.
- **Done:** design.md "Verification (phase 6)". Island time, engaged (swing ridden, wrong heaps first): 232 s
  landscape, 233 s portrait (3:52, 3:53). Fixed: the meeting now plays in round 1's frame (she stands at the heap,
  then it freezes and dives; the seat moved to the log's near flank, portrait round 1 looks from the east); the
  pointer's wind lands no further than the shot's distance plus a reach, so canopy strokes and tangle circles stop
  flattening the next round's heaps; tells, peeks and dives `shiver` the loose leaves and leave the heap whole, which
  also ends round 1's hollowed "ring" look; `buryDepth` 0.5 → 0.35; portrait rounds 2 and 3 reframed on a 1.6 lens
  (1.5 round 1) eased by a spring, the child whole; the squirrel's gait caps its bounds at 5.5 a second so the dash
  reads as a sprint; it sets off as a tangle's loop starts to lift and she waits at the freed tangle until it is
  hidden (about 10 s), so the player no longer sees it dive into a heap; the swing perch moved to the swing tree's
  trunk under the limb; the leap lands only in leaves the lens shows. Sound (`village-music-browser-check`, all five
  cases) passes: from push-off Red Door fades 8.7–13.7 s, a 10 s quiet, the stairs song at 23.7 s, 5.6 s before the
  landing. Gates: typecheck, build, `npm run check`, `scarf-check` default twice, PHYSICS=1 and NATURAL=1,
  `squirrel-rounds-check` (every case, frames in both orientations), `birches-drift-check` and the node birches checks
  pass. Tangle 4's bow alone needs 5–9 scripted strokes on the base commit as on this branch (`FROM=3`), so a full
  run's `strokes <= 5` fails now and then; PHYSICS=1 and NATURAL=1 each passed on a rerun.

### 7. Docs and close. Opus. Done: ☑ (2026-10-15, docs; the close stage waits on Jeremy's approval of the merge)

Rewrite chapters.md "The birches" for the room as built, with the squirrel's files, knobs and checks. Fix the
journey.md one-liner for the birches, the audio contract and `docs/stairs.md` where phase 2 didn't, and the roadmap
(drop the "Birches uplift" entry). Then run the backlog-item close stage. The orchestrator summarises for Jeremy
what the branch changes, with stills and the clip paths, and merges only on his approval.

- **Done (docs):** chapters.md "The birches" rewritten for the room as built (corridor and gaps, the squirrel's
  rounds, counting, the leap and goodbye, music, rulings with Jeremy's corridor ruling, files, knobs, checks); the
  stairs pointer and `docs/stairs.md` give the half-minute sail; journey.md item 5 has the hide-and-seek; the roadmap
  drops the planned entry and lists the birches listen and the tangle-4 stroke count; the audio contract's Birches
  section reads forward and gains the squirrel's sounds; testing.md lists `squirrel-check` and
  `squirrel-rounds-check`; progress.md's swing perch is the trunk; AGENTS.md points at the squirrel's files.

### 8. Second playtest. Opus. Done: ☐

Jeremy's notes and what follows from them: design.md "Jeremy's second playtest". Four parallel parcels; each but 8a
builds in its own worktree branched from `birches-uplift` and is merged back by the orchestrator. 8a first merges
`main` into `birches-uplift` (main's Home summit music and hill walk conflict in the audio code, `tuning.ts` and the
music checks), so the music work sits on the merged code.

- **8a. Merge main, then the music.** `/Users/jeremy/projects/updraft-birches`, port 5241. Red Door's entrance on the
  meadow sail coincides with the reveal's swing to port; the loop's pause at least 3 s shorter. **Done ☑
  (2026-10-16).** Merged `main` (`ff25f0b6`): `RecordedScore` keeps main's scheduled sources and belfry ending and gains
  the rest between passes; track lists, levels, prefetch and checks carry both the stairs song and Sleeping's
  recordings. The birches' `IslandReveal` carries `music`: the crossing is ready the frame the reveal begins, and
  the meadow is asked to leave its longest phrase wait, fade and quiet (10.5 s) before it; `birchesArrivalLater` is
  gone. Measured in the real game with no input from `?chapter=toBirches` (crossing clock; scratch probe of the
  camera and the arrival handoff): the reveal begins at 17.9 s, the lens visibly turning from about 19.5 s and
  settled at 27.8 s, landing at 38.8 s. Before, the meadow faded 21.0–24.2 s and Red Door started at 31.1 s, 13.2 s
  after the reveal began and 3.3 s after it settled; now the meadow fades 5.4–8.4 s and Red Door starts at 17.9 s,
  the reveal's own first frame. The loop's rest is 0.3 s (from 3.5): on the render (`music-transition-audit`
  `birches-seam`, which now also reports the audible gap: 50 ms windows within 30 dB of the piece's average as
  played) the last audible sound falls 2.7 s before the file's end and the next pass is audible 0.17 s in, so the
  pause heard is 3.25 s, from 6.37 s. Checks: typecheck, build, `npm run check`; `check:audio` fails only in `audio`,
  `meadow-score`, `opening-score` and `piano-audio` as on the base, and `birches-foley` intermittently (its random
  audition peaks at −29.5 to −30.x dBFS against a −30 limit; the merge and this music work touch none of it).
  `birches-score` passes again: its restore stubs gained the boat's `beach` and the child's `stowPlane`, and the
  shared recorded-score check accepts a recording that rests between passes. `crossing-camera`, `journey-pacing`,
  `journey-reveal` and `transition-scenes-browser` pass.
- **8b. Heaps.** `/Users/jeremy/projects/updraft-birches-heaps`, branch `birches-uplift-heaps2`, port 5242. Heaps
  yield only to updrafts; none can be taken before the squirrel is in (reproduce Jeremy's case first).
  **Done (2026-10-17).** Every heap stands against swipes and goes to about two loops of circles (litter `heaped`,
  `heapLiftFrom` 1.0, `heapLiftFull` 1.7, `heapLiftTakes` 2.4); round 3's empty heaps stand until the leap; the hint
  and drawn updraft at 7 and 12 s without an updraft. Strokes and circles from the boat, the landing, the meeting and
  before rounds 2 and 3 (waiting, resting, burrowing) leave every heap as it was; no path but the boat (fixed in
  `b3348d9a`) reproduced. Circles find it in 2–4 loops (2.5–3.5 s), sloppy screen circles in 2–3; `squirrel-rounds-check`
  every case, `birches-drift-check`, `birches-score-check`, typecheck, build and `npm run check` pass;
  `birches-foley-check`'s audition peaks at −28.6 dBFS against its −30 ceiling, an audio-only check this branch does
  not touch (after the main merge).
- **8c. The first knot.** `/Users/jeremy/projects/updraft-birches-knot`, branch `birches-uplift-knot`, port 5243.
  She stops closer to tangle 1 and faces it; after tangle 2 the squirrel climbs down the broken birch rather than
  dropping to its foot. Done ☑: she stands 6.6 m from the knot (10 before), facing it; the squirrel keeps its
  branch at tangle 1 and its worst one-frame move leaving tangle 2 is 0.38 m (4.1 before).
- **8d. Performance.** `/Users/jeremy/projects/updraft-birches-perf`, branch `birches-uplift-perf`, port 5244. Why
  the quality governor steps down to medium on the birches; fix the cause without changing the look. Done
  (2026-10-17): measured, no change to the room or the governor. Alone on the GPU the whole walk holds Ultra at 60 fps;
  the step-down came from captures sharing the GPU (design.md, Performance).
- **8e. The swing.** Waits on Jeremy's answer to the proposal.
