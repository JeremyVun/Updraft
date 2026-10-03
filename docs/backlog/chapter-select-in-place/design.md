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

Comps round 1, 2026-10-03 (`/tmp/updraft-continue-comps-1/`, four directions: A tile above Continue, B still
blurred into light behind it, C Continue set into a larger still, D the still as the whole veil's field). Jeremy:

> I like C in that the still is larger, but yea depending on the still, it is hard to see the continue / begin button
> inside it. So maybe let's do (A), without the chapter name label, make the still much larger

> start over / start over and lost your progress

So: A's tile above Continue, with no room name, and the still much larger than chapter select's tile. Continue never
sits on the picture. The label is `start over` and its confirmation is `start over and lose your progress?` (his
"lost" read as a typo for "lose"). Carried from round 1: `start over` is drawn like `chapters` and sits below it for
a finished player; "restart" is avoided because the recovery dialog's `Restart game` means something else; the veil
reads complete if the still never loads.

Comps round 2, 2026-10-03 (`/tmp/updraft-continue-comps-2/`, A without the name at a size ladder, sharp against
upscaled stills, edges for the night stills). Jeremy chose 440 px on desktop and 350 px on the phone, as one rule
`min(440px, 100vw - 40px, 49vh)`, and "Ember only" for the Dark wood: its nearly black still is blended so the black
drops out and only the ember and its sparks show on the night veil (to be shown to him before the build). The
orchestrator's calls, following his take-the-simple-option rule: one set of stills recaptured at 1600x1000 and
encoded 880x550 (`cwebp -q 78 -sharp_yuv`) serves both the Continue tile and chapter select; the Drowned village is
recaptured to its shipped framing first, because the round 2 capture lost the village; the confirmation goes back to
`start over` after 6 s, on Escape or when focus leaves it; any valid save shows `start over`, a completed one included.

Ember only shown 2026-10-03 and refused: "now the ember only is not at all the same standard window picture as the
others. Do not do ember only dont overcomplicate it." The Dark wood takes the same soft-edged window as every room.

Then, same day:

> The only lat thing i want you to try is ask astra via codex exec to use imagegen to produce full screen chapter still
> shots. I want to see if we should stick with the window style or move towards something even more high quality.
> Obviusly, the full screen chapter shots must be mindful about leaving space for controls (continue, begin, audio,
> quality, full screen) etc. it might mean that the continue, begin, chapters buttons go to the bottom of screen
> instead of the middle. Figure it out

Round 3 (`/tmp/updraft-continue-comps-3/`, exemplars kept in `comps/`) compared the round 2 window with full-screen
paintings Astra generated from the game's captures. Jeremy, 2026-10-03: "Full-screen paintings", and for a first
visit "The Still island painting". This replaces the round 2 window; the section "Phase 3: the room picture and start
over" below is the spec.

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

## Phase 3: the room picture and start over

Exemplars: `comps/f-washing-d.jpg` (Continue, desktop), `comps/f-wood-d.jpg` (night room), `comps/f-fin-p.jpg`
(finished player, phone), `comps/f-confirm-d.jpg` (the confirmation), `comps/f-begin-island-d.jpg` (Begin),
`comps/f-noart-d.jpg` (the picture not decoded in time), `comps/f-chapters-d.jpg` (chapters open). The comp's CSS and
script are `comps/concept-f.css` and `comps/concept-f.js`; the build starts from them.

### What the player sees

The title veil loads exactly as today. When the game is ready, a painting of the room the player will start in fills
the veil behind everything and fades up over 1.6 s, with a neutral near-black gradient (#121418, the paintings' own
lower shade without its blue) rising from the bottom: alpha .5 to 20% of the height, easing to 0 at 40% (`.veil-shade`
in `src/styles.css`, tuned so Continue at its faintest breath stays at least 4.5:1 on every painting). Continue (or Begin), `chapters` and
`start over` sit low and centred in the painting's quiet band: Continue's centre at `calc(100% - max(200px, 28vh))`,
`chapters` 50 px below it, `start over` 50 px below Continue, or 94 px for a finished player (below `chapters`). On a
390x844 phone that leaves the last line 40 px clear of the corner buttons. Type, breathing and opacities are the house
ones (Continue .95 to .82; `chapters` and `start over` .5, the armed confirmation .85).

- **Which painting.** A first visit (Begin) shows the Still island. A save shows its room, mapped from the saved
  chapter: island to Still island; toLines, lines to Washing; toBoats, boats to Little boats; toMeadow, meadow to
  Meadow; toBirches, birches to Birches; toStairs, stairs to Cloud stairs; drowned to Drowned village; toWood, wood to
  Dark wood; toSleeping, sleeping to Sleeping island; toMirror to Open sea; mirror to Sky mirror; toHarbour, toHome,
  home to Home. `?chapter=` loads with `start=1` map the same way from their start.
- **One file per visit**, chosen by aspect: the portrait painting under 3:4, otherwise the landscape. It is requested
  as soon as the start screen knows the room, `decoding="async"`, `fetchpriority="low"`, `alt=""`, so it never
  competes with the game chunk.
- **Arrival.** If the painting has decoded when the veil turns `ready`, the painting, gradient and low layout appear
  together in that frame, the painting fading up while Continue fades in already in its low place. If it has not, this
  visit keeps today's plain veil with Continue centred and `start over` 50 px under it, and a late painting is never
  shown, so nothing moves once on screen.
- **Leaving.** On Begin, Continue, a pick or start over, the painting and gradient fade with Continue (.8 s); then
  the veil dissolves into the game as today, so a painting never cross-fades into the game's own view. The veil's
  dissolve waits until .8 s after the press when a painting shows, up to .3 s later than without one.
- **Chapters.** Chapter select's tiles are the same paintings cut to 400x250, replacing the captures, so a room has one
  picture everywhere. While the list is open the painting fades back to the plain veil (.6 s), because the tiles and
  names do not read over a painting. A pick's panel fades out over .45 s with a `chapters-out` animation (a
  transition cannot start there under the `chapters-in` animation's fill, which made the panel vanish in one frame).
- **Start over.** Drawn like `chapters`; shown for any valid save, a completed one included; never for Begin. The
  first press turns it in place into `start over and lose your progress?` (Jeremy's words); a press on that starts the
  first island through the one start path (`begin('island')`, the same as picking Still island), whose entry save
  replaces the old save. The confirmation goes back to `start over` after 6 s, on Escape, or when focus leaves it.
  Its presses stay its own, like `chapters`; a press anywhere else on the veil still continues the save. The first
  press focuses it (Safari does not focus clicked buttons), so blur and Escape behave the same everywhere. Start over
  keeps the finished flag, so chapter select stays open to a finished player.
- **Reduced motion:** no fades.

### The paintings

Generated by Astra (`gpt-6-astra`, Codex image generation) from each room's capture, composed for this layout: a
soft, shaded lower band and an empty bottom-right corner, a landscape (1586x992) and a portrait (about 853x1844) per
room, with no characters. They ship as WebP (`cwebp -q 78 -sharp_yuv`) at native size: about 900 K for the 12
landscapes, 820 K for the portraits, 116 K for the tiles; a visit downloads one file (mean 75 K). Native size is soft
when a 2x desktop screen upscales it 1.8x; no upscaler is available here, the art is soft by design, and this was
taken as the plain option. Before shipping, the rooms whose painting differs from the game are regenerated from the
same prompt with the old image attached and the fix named: the sails are knitted wool, not plain red cloth (Home,
Open sea, Drowned village, Sky mirror); the Dark wood as dark as the game; no added hill on the Sleeping island; the
Still island's boat lying as the game has it. Jeremy, 2026-10-03, on the round 3 set: "looks great, i think i'd only
look to see if we can generate better images for drowned village and sleeping", so those two get further attempts.
Then: "on some of them, the blue is a bit too much / bit too high ... I'm also seeing some kind of dark "banding"
across the grass" (`f-washing-d`). Measured: the banding is in the painting (the raw PNG and the WebP match row for
row; the gradient is smooth), a dark smear of out-of-focus blades where Astra's defocused band begins. The blue is the
teal gradient reaching halfway up plus the paintings' "cool shade" band starting near the middle, when Continue sits at
72%. So every painting is regenerated with a shallower quiet band (the lower quarter, in the room's own colours, in
shade rather than heavily defocused, no dark horizontal bands), and the gradient becomes lower, lighter and neutral
rather than teal, tuned so Continue stays at least 4.5:1 on every room. He clarified "blue" meant blur: "e.g.
f-meadow-d, f-birches-d - the blur is a bit too much / too obvious". The band is quiet because the room is calm and in
shade there, with at most a subtle focus falloff, never a visible blur effect. The standard for the band is Home and Sky mirror ("the bottom half looks quieter and less
artificially blurred"). He also found the paintings "a bit... low resolution": a 1586x992 painting is upscaled 1.8x on
a 2x desktop, Jeremy will handle the upscale himself ("dont worry
about local AI upscale, i will figure that out myself"); the build ships the native-size set, file for file
replaceable. The prompts and a one-room regenerate script live in
`assets/art-direction/continue/`. The paintings are release art: refreshed when a room's look changes for good, not on
every tweak.

### Decisions

- Full-screen paintings, not the window (Jeremy, 2026-10-03, after rounds 1-3). Begin shows the Still island painting.
- Bottom-centre invitation: centred, Continue lands on the subject (Cloud stairs 1.4:1); lower left gives up the one
  centred invitation and sits under the low sun. Against the paintings Continue measures 5.0:1 to 15:1 where today's
  plain veil gives 2.4:1.
- One gradient for every room; it is needed only for the Still island and Cloud stairs but harmless elsewhere.
- The painting is an enhancement: the veil reads complete with nothing downloaded and a painting that is late is not
  shown. `docs/styles.md`'s rule becomes "The veil needs nothing downloaded to read complete; the room's painting is
  added only once it has decoded."
- The painting leaves before the veil dissolves (the step down from painting to the game's frame is not a morph).

### Rejected

- The window with the game's captures (rounds 1-2): plainer and scriptable, but Jeremy asked for "something even more
  high quality".
- Captures at full screen: no quiet band, so the words land on the subject, and a phone crop cuts the room.
- A special treatment for one room (ember only for the Dark wood): "dont overcomplicate it".
- An upscaled desktop set: no upscaler here and two to three times the bytes.

### Gates

- `start-check` passes with the new layout: Continue's centre at `100% - max(200px, 28vh)` when the painting shows,
  centred when it does not (forced with a blocked image), on desktop and phone; no new program first drawn after any
  start.
- `chapter-select-check` and `chapter-pick-check` pass; a new check covers start over: first press arms without
  starting, a second press starts the island with sound and no navigation and its entry save replaces the old save,
  the confirmation reverts on Escape, after 6 s and on blur, and a press elsewhere on the veil continues the save.
- The panel fades over its .45 s after a pick (frames across the fade show intermediate opacity).
- `failure-paths-check` passes; a blocked painting leaves the plain veil and a working Continue.
- Stills of all 12 rooms at desktop 1440x900 and phone 390x844, plus finished, confirmation, chapters open, Begin and
  the not-decoded fallback, checked by an allowed visual model (Opus or Astra) against the exemplars; probes report
  nothing past an edge, no text spill, touch targets at least 44 px.
- One check of the painting arrival and departure in real Safari (WebKit) on this Mac.

