# Playtest fixes — 2026-09-23

Jeremy's issues from playing the release build. Read this first after any context loss.

## Jeremy's words (verbatim)

> Here's some issues i've found too,
>   - On the sky mirror, the bubble hoop is held too close to the child
>   - On the sea chapter when travelling from the sleeping island to the sky mirror island, the dolphin animations spasm out of the water, and the speed of the boat slows down a lot when the cygnet drops down to swim (this whole part of the story is not well paced)
>   - during the part of the game where the paper plane flies away from the child when they are in the storm, as teh child approachs the forest, the plane just disappears instead of flying away and getting lost
>   - The music volume on the summit island at the end is too loud (needs to be -4db)
>   - The music volume of the sky mirror chapter is too soft (needs to be +4db)
>   - The little boats need a bit more momentum and need to react to the wind a bit easier, right now, i have to keep rapidly creating wind the whole time or else the boats don't move (and they move a bit slow). Also an issue where the orange boat lags behind the rest a bit too much
>   - while travelling through teh drowned village, the forest island is visible in the distance but it's bare and has no detail on it because of draw render distance. We need to hide in haze.
>   - On the still island, it looks like the paper plane only makes things green if it's moving faster than some speed. That threshold is set too high, causing the last 30% of the plane's travel to not cause things underneath to become green
>   - When travelling from the forest island to the sleeping island, the player can see most of the island already as well as the curtains on the hill, which ruins the sense of discovery and wonder. Might need some haze here / hide the curtain until the player lands

> Can you see if these are still issues and see if they can be fixed? Im trying to polish the game.

## Work

Branches from `8be5346`, each in its own worktree with its own dev server; all merged to `main` at `105e066` on 2026-09-24,
after the Home ending audio (`c7f41f0`) landed.

| # | Issue | Owner | Worktree / port | Status |
| --- | --- | --- | --- | --- |
| 1 | Mirror hoop too close to the child | lead | `/private/tmp/updraft-pt-lead` :5341 | fixed: the grip was out of reach, so the hand hung at the hip and the 1.24-wide ring sat 0.8 from the face. The arm is now out in front at chest height and the handle leans forward and out (`GRIP`, `WAND_PITCH`/`WAND_ROLL`): 1.4 from the face |
| 2 | Sea passage (sleeping → mirror): dolphins spasm, boat crawls during the swim, pacing | Opus agent | `/private/tmp/updraft-pt-sea` :5342 | fixed (merged into `pt0923-lead`): the dolphins' pose came from their motion through the world, so the crawling boat (1.5, then 0.65 u/s for the swim and a 24 s hold near the end) stood them on end, wrapped the tail's lookup and spun them round; arc joins also snapped pitch. Joins are now matched, arcs scale with each dolphin's own speed, the tail follows the beak's recorded path, set pieces are acceleration-limited. Max pitch 80° → 44°, fastest pitch change 3,737 → 224°/s. The boat settles into one even pace of about 3.3 u/s (`paceSea`) and the cygnet rides the wave along the hull, so nothing slows when it goes in. Passage 93 → 79 s, no crawl. Also fixed: wakes and foam near the mirror now lie on its still water (`seaSurfaceY` ignored the mirror's calm). See `docs/journey.md` 12b |
| 3 | Storm: the plane vanishes near the wood instead of flying off lost | lead | lead | fixed: it was hidden on a 6.5 s timer while still about 25 units away, loitering over the wood's treeline. It now leaves fast and low (`tuning.storm.planeAway`), 27 → 114 units in 13 s, and is put away only when out of frame or 2.5 fog lengths deep |
| 4 | Summit music −4 dB | lead | lead | done: `summitScoreLevel` at +8 dB over the original integration (was +12) |
| 5 | Mirror music +4 dB | lead | lead | done: `mirrorScoreLevel` 1 → 10^(4/20) |
| 6 | Little boats: more momentum, easier to move, faster; orange boat lags | Opus agent | `/private/tmp/updraft-pt-boats` :5343 | fixed (merged into `pt0923-lead`): hulls lost speed as fast as they gained it, and the orange toy (the child's own) was the only one capped by the walking child, with the rest pushed ahead as a rigid train. Separate `drive`/`drag` so a toy glides; `speed` 2.4 → 2.9; the child hurries and leads further; other toys sail side lanes so the orange can pass. One relaxed stroke: 3.7–5.9 → 9–12.4 units, glide 2.3–3.5 → 7–9.3; orange lag behind the leader 14.0 → 6.2 mean. Swims are shorter (47 → 33 s of 66 → 53 s) because the room is faster. Details in `docs/rooms.md` |
| 7 | Drowned village: bare wood island visible at draw distance; hide it in haze | lead | lead | fixed: the wood draws trees only within 178 of the eye, so its bare hill showed over the rooftops. New island mist (`uIsleMist`, `tuning.world.woodMist`) hides it beyond 110–165 units; it comes out of the rain with its trees |
| 8 | Still island: the plane stops greening below a speed threshold that is too high | lead | lead | fixed: greening was gated on `airborne`, which drops as soon as the plane settles to its glide height over the grass, while it still travels 60% of its path. It now greens while it moves (`planeBloomFrom` 0.3). Life along one throw's path, first/middle/last third: 0.77/0.14/0.00 before, 0.91/0.99/1.00 after |
| 9 | Wood → sleeping: the island and its hill curtains show too early | lead | lead | fixed: the same island mist (`sleepingMist`, 40–72 units, a soft bank over the water) hides the island until the last few seconds; the near shore emerges first and the summit window stays hidden until they land, then the mist lifts |

## Follow-up: the dolphins (2026-09-24)

After watching the before/after recordings, Jeremy (verbatim):

> The dolphin animations still need work during the sea scene. use a fable 5.1 sub agent to do this in a worktree

A Fable 5.1 subagent owns it in `/private/tmp/updraft-dolphins` (branch `dolphins-0924`, dev server :5348),
by Jeremy's explicit choice of model for this visual work. Done and approved from the recordings: the pod
swims after its stations instead of riding the boat's frame (the 'spasm' was the whole pod swung at the route's
turn), breaths roll instead of hopping, the featured leap turns out so it reads side-on, the nudge keeps its
flukes down. Fastest turn 226 → 63°/s, fastest pitch change 223 → 115°/s. Details in `docs/journey.md` 12b;
recordings in `/tmp/updraft-dolphins-fable-Pt1f/compare-*.webm` (left current, right reworked).

## Verification (2026-09-24, integrated `pt0923-lead`)

- Typecheck and production build pass. Check groups: quick 12/14 and mechanics 48/50, the two failures
  (`progress-schema`'s `stars4-*` arity and `camera-parity`'s last-digit float) identical on the untouched
  `8be5346`; audio 17/17; browser 8/8. Sky mirror GPU run, sea logic, little boats logic, crossing camera and
  geography pass.
- Render parity against `8be5346` (12 frozen scenes) passes: wood, sleeping, mirror, home and portrait are
  identical; the drowned village differs in 1.1% of pixels (the wood's mist), boats 0.15%, sea 0.06%.
- Before/after recordings, before on the left, aligned by beat: `/tmp/updraft-pt-lead-rec/compare-*.webm`
  (hoop, still-island, drowned-village, storm-plane, wood-to-sleeping, little-boats, sea-passage); the
  separate takes are `before-*.webm` and `after-*.webm` beside them.
- Not verified: a listening pass on the two music levels, and a physical iPad.

# Playtest fixes — 2026-09-27

Pre-release bugs from Jeremy's playtest. Read this first after any context loss.

## Jeremy's words (verbatim)

> We're almost there to release. I found a few bugs during playtest that i'd like to get fixed. Do not focus on running perf profiles or hour long playthroughs, i just want the bugs fixed and surgically verified.
> 1. Remove from the game the two tone sound that plays when i suspect the child "cheers". It no longer fits with the music
> 2. When the child is carrying the cygnet in front, when the camera is viewing them from behind the child, i can see the cygnet through the player.
> 3. In the drowned forest sequence when the wind dies out, there is an indicative gesture drawn on the sail, but nothing happens when the player traces that outline - the player actualy has to draw beind on the boat (i think when the player traces across the sail, it creates wind further behind the sail instead of on the sail.
> 4. On the still island, I want an indicative wind gesture drawn on the paper plane at the beginning when the child is holding it, and then anytime it is on the ground on the still island and not moving (indicating that the player should try to make it move again to continue greening the island).
> 5. There is some strange rendering bug where as the camera rotates, the grass sort of "Stutters", almost as if the state of the grass gets reset and loads back in or something
> 6. On the island of birches, when the scarf gets drawn into the boat, it happens very quickly. Much more quickly than before the recent scarf physics refactor
> 7. On the sky mirror island, the cygnet gets stuck in a swimming pose (it paddles instead of walks). It then gets stuck in that paddle pose even while in the child's backpack
> 8. When the child gets out of the boat and onto a jetty, they basically teleport onto the jetty, which doesn't look good. I need a better animation.
> 9. When the child lands on the birches island, they don't put the cygnet down. Only until the child reaches the swing does the cygnet suddenly teleport out ontot he ground
> 10. When the cygnet is in the backpack, parts of it are clipping out of the backpack.
> 11. Reduce the drag by 30% on the island of little boats and increase the max speed by 10%

## Status

| # | Issue | Status |
| --- | --- | --- |
| 1 | Cheer two-tone | open |
| 2 | Cygnet seen through the child from behind | open |
| 3 | Drowned sail gesture lands behind the sail | open |
| 4 | Still island: gesture on the plane when held and when grounded | open |
| 5 | Grass stutters as the camera turns | Fixed. The simulated window sits 100 m ahead of the camera, so turning moves it every 17° or so. On each move the wind field shifted its velocity, lean and sway textures and swapped them, but the shaders kept the textures bound earlier in the frame and read them against the moved window, so for that one frame every blade took the lean of grass 10–40 m away (the sail and the trees too), then snapped back. `WindField.shift` (`src/wind/field.ts`) now rebinds `uWindTex`, `uBendTex` and `uSwayTex`, as the life field and wind waves already did. Checked with a 0.5°-a-frame turn over the meadow, compared with the same run with the window pinned: on the move frame the whole-frame difference was 7.26 of 255 before the fix (2.4 on the frames either side) and 1.65 after it, the same as its neighbours. |
| 6 | Birches: scarf drawn into the boat too fast | open |
| 7 | Mirror: cygnet stuck paddling, even in the backpack | open |
| 8 | Boat to jetty is a teleport | open |
| 9 | Birches landing: cygnet not put down until the swing | open |
| 10 | Cygnet clips out of the backpack | open |
| 11 | Little boats: drag −30%, max speed +10% | open |
