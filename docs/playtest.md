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
| 1 | Cheer two-tone | done: the sound was the `delight` chime (three quick bell notes) cued with the child's cheer on the still island and the birches, and also on the birches' freed snags, the little boats' launch and the lines bird's arrival. The story no longer cues it anywhere (`docs/contracts/audio.md`) |
| 2 | Cygnet seen through the child from behind | fixed (`d0a9685`, branch `pt0927-cygnet`): the cygnet's grass depth bias (`uNudge`, which pulls a bird standing in grass toward a camera 9-34 units away so the blades do not swallow it) stayed on while it was carried, so from the game camera behind (15-30 units) the bird in the arms was drawn up to 1.7 units nearer than it is, through the child's coat. It now eases to 0 whenever it is carried or held (`Cygnet.pose`). Before/after: `/tmp/updraft-pt0927-cygnet-cap/b2real-zoom.png` (mirror jetty walk, game camera), `b2before-crops.png` / `b2after-crops.png` (stage, 8/15/22/30 units behind; it showed from 22 up) |
| 3 | Drowned sail gesture lands behind the sail | fixed: as Jeremy guessed, a stroke puts wind where the pointer's ray meets the water, which from the camera behind the boat is well beyond the sail, and the calm is read at the hull. A stroke that crosses the sail on screen (within `sail.brushReach` of its middle) now blows on the sail itself (`Boat.brushSail`, the little boats' fix). Four rounds of strokes across the sail filled 0.06 of the 22 needed before; now one round fills it and the boat moves on |
| 4 | Still island: gesture on the plane when held and when grounded | done: `PlaneInvitation` draws the sail's gust across the paper while the child holds it before the first breeze, and whenever it has come to rest on the grass during catch (and on the way to the boat), half a second after it settles; it heads toward the plane's home and gives way while the player strokes across it (`planeInvitation` on the chapter, `opening.planeInvite*`) |
| 5 | Grass stutters as the camera turns | Fixed. The simulated window sits 100 m ahead of the camera, so turning moves it every 17° or so. On each move the wind field shifted its velocity, lean and sway textures and swapped them, but the shaders kept the textures bound earlier in the frame and read them against the moved window, so for that one frame every blade took the lean of grass 10–40 m away (the sail and the trees too), then snapped back. `WindField.shift` (`src/wind/field.ts`) now rebinds `uWindTex`, `uBendTex` and `uSwayTex`, as the life field and wind waves already did. Checked with a 0.5°-a-frame turn over the meadow, compared with the same run with the window pinned: on the move frame the whole-frame difference was 7.26 of 255 before the fix (2.4 on the frames either side) and 1.65 after it, the same as its neighbours. |
| 6 | Birches: scarf drawn into the boat too fast | slowed: measured against `a9fdd86` (just before the cloth rewrite), the draw-in was the same 8 s in both, the free end covering about 135 m, so the rewrite did not change its timing. It now takes 16 s (`birches.scarf.gatherSeconds`), the free end at up to 13 m/s rather than 25 |
| 7 | Mirror: cygnet stuck paddling, even in the backpack | fixed (`d0a9685`): not the swim state (it never swims on the mirror). The glide back to the bed at the sleeping island leaves `tucked` (legs carried up behind in flight) at 0.85 and nothing ever brought it back, so from the sleeping island on the legs trailed out behind like a swimmer's whenever the gait's planted feet did not own them: sitting and setting off on the mirror, in the hands, and in the satchel, where the feet came out through the back of the bag. The chapter only follows the sleeping island in a real play-through, so `?chapter=mirror` never showed it. `tucked` now eases to 0 whenever it is not flying on its own wings (`Cygnet.update`). Evidence: the headless sleeping chapter ends with `tucked` 0.85 before, 0 after (`/tmp/updraft-pt0927-cygnet-cap/evidence-7-sleeping-dump.txt`); `m7c-cmp.png` (mirror, 0.85 carried in: before top, after bottom: feet out behind while it sits, legs trailing as it sets off); satchel feet through the bag 11 cm before, none after. A bird sitting down on the mirror's still water still reads a little like floating; that is its ordinary sit |
| 8 | Boat to jetty is a teleport | fixed: at home and at the sky mirror the child was placed straight onto the deck. `Traveller.alight` is the reverse of boarding: up off the thwart, a foot on the gunwale on the deck's side, down onto the boards (2.1 s, `boarding.alight*`), then the walk in. Placing the child (checkpoint restores) cancels it |
| 9 | Birches landing: cygnet not put down until the swing | fixed (`511cf11`): by design it rode in the satchel from the beach and hopped out (a 0.72 s drop from the bag) only when a leaf pile came within reach, and the first one near enough is by the swing. Now, after the look up the ride, the child steps aside, kneels side-on to the camera behind and sets it down with the shared set-down (`carry.setDown`, facing up the ride); it walks and plays in the leaves from the beach on, and is gathered up at the boat as before. A checkpoint restore stands it beside the child. The satchel hop-out and its three knobs are gone. Before/after: `/tmp/updraft-pt0927-cygnet-cap/b9-cmp.png` (game camera, 6.9-11 s after landing: before top, still in the bag; after bottom, kneel, lower, step off, walk on); `b9sw-grid.png` (at the swing with it on foot) |
| 10 | Cygnet clips out of the backpack | fixed (`d0a9685`, `a3647a4`): mostly #2's depth bias, which from the game camera drew the whole bird through the bag's back wall (and over the paper plane); plus the #7 feet; plus, close up, the folded wing tips and tail reaching 15 cm past the bag's back rim. In the satchel the hands now cross further over the rump, the tail is cocked up and the seat is 3 cm nearer the child's back (worst reach past the rim 1.3 cm, inside the rim's own thickness; nothing through the walls). Before/after: `/tmp/updraft-pt0927-cygnet-cap/b10real-zoom.png` (meadow walk, game camera, before/after pairs), `b10-close-cmp.png` (left, right, above while walking: before top, after bottom), `b10-before-grid.png` / `b10-after-grid.png` (six angles). `node tools/cygnet-gates.mjs` flakes by a few thousandths on both builds (base 0 of 3 runs clean, this branch 2 of 5; the misses are marginal and move between gates from run to run, and nothing changed here runs on the stage outside the satchel) |
| 11 | Little boats: drag −30%, max speed +10% | done: `drag` 0.38 → 0.266, `speed` 3.1 → 3.41. The faster, freer toy then met the cygnet's swim limit already inside it and jolted (up to 9 u/s² in one frame, from under 2); a limit that drops under the sailing toy is now let in over its stopping room, back to 1.9 |

### Follow-up (2026-09-27, Jeremy verbatim)

> - Remove the restored chime when the cygnet climbs out of the bank. and remove those five falling high notes when the swans are flying away.
> - On the woods island, i want the embers to only respond to updrafts (change the indicative gesture appropriately)
> - When getting off the jetty when entering the sky mirror island, because the jetty isn't really connected to anything, it looks a bit strange when they step off the jetty onto the sky mirror and set down the cygnet. I think we may need an "exit" ramp for the jetty that enters intot he sky mirror, and as well as an "entry" ramp for the jetty that leads out of the sky mirror. Also take a look at fixing the pathing for the child leaving the sky mirror (they kind of cross onto the jetty half way through.

| # | Issue | Status |
| --- | --- | --- |
| 12 | No `restored` chime when the cygnet climbs out onto the meadow pond's bank | done: the pond no longer calls `completeObjective` (the piano's completion keeps its chime) |
| 13 | No `skein` phrase when the swans fly away at home | done: the child still cheers as the family goes north, in silence; the skein's arrival over the summit keeps its phrase |
| 14 | Dark wood: embers answer only updrafts, with the updraft gesture | open |
| 15 | Sky mirror: ramps off the entry jetty and onto the departure jetty; the child's path out | done: each jetty runs down a 2.6 m plank ramp into the mirror at its island end (`rampAt`/`rampLength` on the deck, built in `world/sky-mirror.ts`, walkable through `rampHeight` in the child's ground, which lets them down a ramp and off its foot but not off its sides). Arriving, the child walks down the entry ramp before setting the cygnet down; leaving, they walk to the foot of the departure ramp and up it along the boards to the boat, instead of cutting onto the jetty over its side halfway along. Traced: 0 → 0.17 → 0.22 up the ramp, then along the deck's centreline to the berth. Stills `/tmp/updraft-pt0927-lead-ramps.png`, `/tmp/updraft-pt0927-lead-entry2-grid.png` |

### Follow-up 2 (2026-09-27, Jeremy verbatim)

> Two more playtest feedback which i need looked at and fixed if it's not fixed already
> - when the child is leaving the woods island, the whole scene "stutters" / "reloads" instead of smoothly transitioning. Try to identify the root cause and fix it.
> - [screenshot: sailing west into the sun toward the sky mirror, dolphins alongside] there are black lines under the sun. It looks like some kind of rendering artifact

| # | Issue | Status |
| --- | --- | --- |
| 16 | Leaving the dark wood: the scene stutters / reloads | open |
| 17 | Black lines under the sun (sea passage to the sky mirror) | open |
