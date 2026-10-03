# Chapter select without a reload

## Jeremy's brief (verbatim)

2026-10-03:

> I found a usability issue with how the chapters selection works. When i select a chapter from the chapters section,
> it brings me back to the veil and i have to click to start the chapter. Instead, i'd expect that once i clicked the
> chapter button it would load the chatper and then auto start it.

> huh? the player already clicked to enter "chapters".

> yea, why does it reload the page?? there shouldn't be a need for that?

> no reload version

Phase 3, 2026-10-03:

> one other usability issue i found was that if the player is continuing from a save, they,
> a) don't know what that contuination point is before they press "continue" (I assume we can re-use the chapter images for this?)
> b) can't "Restart" from the beginning if they wanted to.

Rulings, 2026-10-03: this is phase 3 of this item, not its own item ("Phase 3 of this item"). Restart asks before it
replaces the save ("Two-step confirm": a quiet start-over under Continue; the first press turns it in place into a
short confirmation, a second press starts the first island).

## What changes for the player

Today a pick in `chapters` saves the choice in `sessionStorage`, reloads the page, loads the whole game again and
leaves the player on the veil, where a second click on Begin starts the room. After this change a pick starts the room
at once, exactly as Begin or Continue does: the veil departs and the chosen room plays, with sound, and nothing loads
again.

## Why the reload has to go, not just the second click

Browsers allow audio to start only inside a click or tap on the current page, and a reload makes a new page. Starting
automatically after the reload would play silently on desktop Safari (and probably Firefox) until the player clicks,
and the game is played by moving the pointer, so many players never would. A pick on the page that is already loaded
is itself the gesture that starts audio.

## Why the game reloaded

The reload was a shortcut: `?chapter=` already started later in the story, but only while the page loads, because
`new Journey(cast)` (`src/story/journey.ts`) applies the start in its constructor, at `src/main.ts` module
evaluation, long before the player sees the veil. It either restores the save (`placeProgress`, `begin`,
`restoreCheckpoint`, `restoreLife`, `restoreWingCare`, `openBag`) or places the travellers for a named start (`sail`,
`land`, `moor`, `withCygnet`, `begin`, `skipToPiano`, `skipToSummit`), and the chapter constructors then write room
state across the cast and the world modules (doorway, curtains, little boats, piano, stairs descent, drowned entry,
sleeping island, sky mirror, embers, flock, sealife).

## Mechanism: the start is applied when the player chooses it

Undoing a restore in place is not viable: there is no general reset for the child, cygnet, boat, glider or carry, and
several changes have no inverse (`child.openBag`, closures over the old chapter in goals, actions, duets and
`stairs.onDocked`, `cygnet.water`, `plane.landingGround`, accumulated `child.decks`, `Math.random` in `flock.rest`).
Rebuilding the cast would leak GPU resources and listeners and need a new warm-up. So nothing is applied until the
player chooses.

1. **`Journey`'s constructor builds only the island baseline**, `IslandChapter`, which every path already builds
   first (`journey.ts:127`) and which the named starts rely on (for example its `plane.hold`). A new method
   `start(choice)` does everything the constructor does after that line today: restore the save when `choice` is the
   save, or the named start (`params.chapter` names or a pick's start). The order inside it stays exactly today's.
   Nothing may call `story.update` before `start`: an extra island update at dt 0 writes `plane.home` and
   `homeRadius` and can raise cues, which a fresh load never does.
2. **Boot aims at the island baseline.** Boot's camera and window only need a place to stand, because warm-up draws
   every object with culling off and the static atlases are global; only the window (`followWindow`), the shoreline,
   the visible grass tables and the post run depend on where the camera is. `rig.cut` at boot uses the island
   baseline's shot without a story update; if the unupdated shot is empty, cut to a fixed shot over the first island.
3. **Begin, Continue and a pick all go through one start path** (the callback of `startScreen.ready` in
   `src/main.ts`), in this order:
   1. inside the click: `setSound` (unchanged: AudioContext creation must stay in the gesture), then
      `story.start(choice)`, `story.update(0, 0)`, `water.skyMirrorAppearance` from `story.name` (today's
      `main.ts:367` rule), `rig.cut(story.shot)`;
   2. then, not necessarily inside the click: `followWindow(...windowAim(), true)`, `grass.update(rig.camera)`,
      `grass.bake(renderer)`, `post.render(0, true)` and `await gpuIdle(renderer)`, the same steps boot's ground
      stage runs, so the first frame of play pays for nothing;
   Both halves hand a throw to `contextRecovery.trigger('runtime', …)`, as the frame loop does: a restore error now
   happens at the click, where it would otherwise freeze the game behind the departing veil.
   3. telemetry, `pacer`/`quality`/`fpsWindowStart` resets and `requestAnimationFrame(frame)` as today.
   The veil is already departing and stays opaque until `startScreen.reveal()` after the first real frames, so these
   bakes are hidden. Continue and Begin pay them too (the window moves from the island to the save); that is the
   price of one path, and the gate below bounds it.
   `?shot` loads, which bypass the start screen, reach the same path when `ready` calls `start(false)`, with the
   choice taken from the save or `params.chapter`.
4. **The choice.** `choice` is the save (when `params.progress` and `readProgress()` finds one), else
   `params.chapter`, else the island. A pick overrides all three. `resumedAtLoad` becomes "the choice was the save",
   decided at start, and feeds `telemetry.start`.
5. **The start screen.** `StartScreen` gets one private `begin(choice?)` used by the veil's click and by a pick:
   `started`, the disabled button, `departing`, `air.finish()`, then the start callback with the choice.
   `offerChapters(veil, pick)` takes that callback instead of calling `chooseChapter` and `location.reload`. A pick
   keeps today's `chapter-chosen` panel fade and the disabled chapter buttons; the veil departs exactly as it does
   for Begin. The chapters toggle already appears only on `#veil.ready` (`chapter-select.css:30`), so a pick can
   never arrive before boot has finished.
6. **Saves.** A pick no longer needs `sessionStorage`: `CHOSEN_KEY`, `chosenChapter`, `chooseChapter` and the
   `chosenChapter()` guard in `readProgress` go. The contract's promise still holds by construction: `start(pick)`
   ignores the save without touching it, and the first played `update` saves the room's `entry` point
   (`journey.ts:300`), which then replaces it.

## Decisions

- No reload; picks start the room at once, with sound (Jeremy, 2026-10-03: "no reload version").
- The start is deferred rather than undone, and Continue and Begin share the deferred path, so there is one way a
  room begins and a pick is indistinguishable from a fresh `?chapter=` load by construction.
- A pick's departure looks like Begin's; no new text, so no copy work.

## Rejected

- **Auto-start after the reload.** Silent on desktop Safari until a click that a pointer-moving player may never make.
- **Reset the cast and world in place, then apply the pick.** Needs exact resets for the travellers and every room
  module, kept in step forever, and several states have no inverse (above).
- **Rebuild the cast on a pick.** Leaks GPU resources and the window listeners (`window.ts` has no unregister) and
  needs a new boot warm-up.
- **Keep today's construction-time start for players who cannot pick.** Two ways for a room to begin; one is enough.

## Gates

- A pick does not navigate (no `framenavigated`), the story is in the picked room (`__game.story.name`), the
  AudioContext is `running` within a second of the pick with `start=1` (the real gate, not `?shot`), and the room's
  `entry` save replaces the old save on the first frames.
- Equivalence: for every room in `ROOMS`, a pick made on a page that loaded a save from a different room
  (use the sleeping island for every room but itself, and the meadow for it) matches a fresh `?chapter=<start>` load
  after 3 s of play at `shot` fixed steps: `story.name`, the chapter's `checkpoint`, child, boat and cygnet positions
  (within 1 cm), cygnet seat and visibility, glider visibility, and the three life regions.
- Continue still restores every checkpoint layout: `node tools/progress-check.mjs` and
  `node tools/progress-schema-check.mjs` pass.
- Boot rules hold: `start-check` passes (no program first drawn in the first seconds of play, `bootStrayPrograms` 0)
  after Begin, after Continue and after a pick.
- The time from the click to the first frame of play on this Mac's Chrome (QA build) is recorded for Begin, Continue
  and a far pick (Home from an island save); none may exceed 150 ms beyond today's Begin, and the veil's departing
  fade must not visibly stall (the fade runs on the compositor; confirm in a capture).
- `chapter-select-check`, `cygnet-gates` and `failure-paths-check` pass; a `playthrough` from Begin to credits passes.
