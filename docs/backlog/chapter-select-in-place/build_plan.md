# Chapter select without a reload: build plan

Read `design.md` in this folder first; it is the spec and its Gates are binding. Contracts: `docs/contracts/progress.md`
(Chapter select, checkpoint saves) and `docs/engine.md` (Boot). One build agent at a time; phase 2 depends on phase 1.
Commit after every step. Run captures, builds and checks in the foreground, against a QA build on a port of your own
(confirm the listener's cwd), and report once at the end.

## Phase 1: one start path

Owns: `src/story/journey.ts`, `src/story/progress.ts`, `src/main.ts` (the Journey construction block around
`main.ts:364-368`, `resumedAtLoad`, the boot camera, the `startScreen.ready` callback), `src/start-screen.ts`,
`src/chapter-select/chapter-select.ts`.

Build:

1. Split `Journey`: the constructor builds `IslandChapter` only; `start(choice: Progress | string | null)` holds the
   rest of today's constructor in today's order. Prefer turning the named-start `if` chain into a lookup if it reads
   better, but keep each branch's calls and their order.
2. `main.ts`: no `story.update` before start; boot cuts to the island baseline's shot (or a fixed island shot when
   that is empty). The `ready` callback runs design.md Mechanism 3 in order. Work out the choice (Mechanism 4) at
   start and pass `resumed` to `telemetry.start`.
3. `start-screen.ts` and `chapter-select.ts`: `begin(choice?)` shared by the veil click and a pick; `offerChapters`
   takes the pick callback; remove the reload and the 500 ms timer.
4. `progress.ts`: remove `CHOSEN_KEY`, `chosenChapter`, `chooseChapter` and the guard in `readProgress`; fix callers.
5. Grep `tools/` for anything that reads `__game.story` (name, current, shot) or the camera before the game starts,
   or that sets `updraft.chosen-chapter`; before start they now see the island baseline. Adjust those tools.

Seams: `story.start` runs exactly once per page, before any `story.update`. Audio starts synchronously inside the
click that chose. Nothing first-draws a program after boot (the ground re-bake reuses programs boot warmed).

Verify: `npm run typecheck`, `npm run build`, then by hand on a QA preview with `start=1&progress=1`: Begin, Continue
from a mid-room save, and a pick each start the right room with sound and no navigation.

Done: [x] 2026-10-03 (5eba223, 47a2d8b). `IslandChapter` frames its shot in its constructor, so boot needed no
fixed fallback shot.

## Phase 2: gates

Owns: `tools/chapter-select-check.mjs` (rewritten for the in-place pick, plus the equivalence sweep, or a new
`tools/chapter-pick-check.mjs` if it grows too long), and any tool fixed in phase 1 step 5.

Build the design's Gates as automated checks where they can be (no navigation, story name, AudioContext state,
the entry save replacing the old one, the 12-room equivalence), then run every gate in design.md and report each
result with its numbers, including the click-to-first-frame times for Begin, Continue and the far pick. Capture a
still of three picked rooms a few seconds in (Washing, Dark wood, Home) beside the same rooms from a fresh
`?chapter=` load, and have an allowed visual model (Opus or Astra) compare them.

Done: [x] 2026-10-03 (3fa1e04 to 0b70f59). Every gate passes: 12/12 rooms within 1 cm (worst 0.029 cm), audio running
148 ms after a pick, click to first frame 64-66 ms against today's 31 ms Begin, 0 new programs after Begin, Continue
and a pick, playthrough to credits. `chapter-pick-check` replays a differing room once, because shot mode never waits
for wind readbacks and a late one can move a floating boat by a few millimetres. Found, pre-existing: the panel's
`chapters-in` animation overrides the `chapter-chosen` fade, so the panel vanishes in one frame instead of fading
(phase 3 fixes it).

## Phase 3: the paintings

Owns: `assets/art-direction/continue/` (prompts, the one-room regenerate script, a README of how a painting is made)
and the encoded set delivered to `/tmp/csip-art/out/` (`<room>-land.webp`, `<room>-port.webp`, `<room>.webp` tiles at
400x250, room names as chapter select's stills: island, washing, boats, meadow, birches, stairs, drowned, wood,
sleeping, sea, mirror, home). Runs beside phase 4, in its own worktree; the orchestrator installs the set.

Build: start from round 3's `/tmp/updraft-continue-comps-3/` (`gen/`, `prompts/`, `refs/`, `logs/`, OPTIONS.md §6 and
§10). Regenerate the rooms design.md "The paintings" names, through Astra (`codex exec -m gpt-6-astra`), with the old
image attached and the fix named; look at every result against the game capture and the layout's quiet band and
corner, rerolling until right. Encode all 24 plus the tiles. Write the regenerate script so one room can be redone
from a fresh capture (`tools/chapter-stills.mjs` without `ENCODE`).

Verify: a review grid of all 24 beside their captures, judged by the agent (an allowed visual model), and the byte
table.

Done: [ ]

## Phase 4: the veil

Owns: `src/start-screen.ts`, `index.html` (veil markup), the veil CSS (`src/styles.css` veil rules),
`src/chapter-select/` (tiles, panel fade), `src/paintings/` (new; the 24 paintings), `tools/chapter-stills.mjs` (no
longer encodes the tiles: the paintings are the tiles; captures feed the regenerate script), `tools/start-check.mjs`,
`tools/chapter-select-check.mjs`, a start-over check, `docs/styles.md` (Start screen), `docs/contracts/progress.md`
(Chapter select, start over), `docs/testing.md`.

Build design.md "Phase 3: the room picture and start over" from `comps/concept-f.css` and `comps/concept-f.js`,
installing round 3's encoded paintings (`/tmp/updraft-continue-comps-3/stills/full/`, tiles from `stills/tile/`) as
stand-ins that phase 3's set replaces file for file. Start over calls the start screen's `begin('island')` (phase 1's
one start path). Fix the panel fade. Update the docs so they are true of what ships.

Seams: the painting decision is made once, at `ready`, from `img.complete && img.naturalWidth` after `decode()`; a
painting that decodes later is never shown. Start over's presses stop at its button. The start path, its order and
the audio gesture are phase 1's and do not change.

Verify: typecheck, build, the Gates in design.md "Phase 3" (stills of all 12 rooms at desktop and phone with the
named states, judged against `comps/` by the agent), and the WebKit check.

Done: [x] 2026-10-03 (8a9f8cc to 836cc9a), on round 3's stand-in paintings. Every Phase 3 gate passes (start-check,
chapter-select-check with the panel fade sampled per frame, the new start-over-check, chapter-pick-check, the
blocked-painting failure path, WebKit arrival and departure). Installing phase 3's set includes the final gradient
retune: rerun the contrast measure (`/tmp/csip-p4-shots/tools/`) and adjust only the alpha stops in `.veil-shade`;
the Still island limits it.
