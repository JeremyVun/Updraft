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

Branches from `8be5346`, each in its own worktree with its own dev server; merged to `main` at the end.

| # | Issue | Owner | Worktree / port | Status |
| --- | --- | --- | --- | --- |
| 1 | Mirror hoop too close to the child | lead | `/private/tmp/updraft-pt-lead` :5341 | fixed: the grip was out of reach, so the hand hung at the hip and the 1.24-wide ring sat 0.8 from the face. The arm is now out in front at chest height and the handle leans forward and out (`GRIP`, `WAND_PITCH`/`WAND_ROLL`): 1.4 from the face |
| 2 | Sea passage (sleeping → mirror): dolphins spasm, boat crawls during the swim, pacing | Opus agent | `/private/tmp/updraft-pt-sea` :5342 | open |
| 3 | Storm: the plane vanishes near the wood instead of flying off lost | lead | lead | fixed: it was hidden on a 6.5 s timer while still about 25 units away, loitering over the wood's treeline. It now leaves fast and low (`tuning.storm.planeAway`), 27 → 114 units in 13 s, and is put away only when out of frame or 2.5 fog lengths deep |
| 4 | Summit music −4 dB | lead | lead | done: `summitScoreLevel` at +8 dB over the original integration (was +12) |
| 5 | Mirror music +4 dB | lead | lead | done: `mirrorScoreLevel` 1 → 10^(4/20) |
| 6 | Little boats: more momentum, easier to move, faster; orange boat lags | Opus agent | `/private/tmp/updraft-pt-boats` :5343 | fixed (merged into `pt0923-lead`): hulls lost speed as fast as they gained it, and the orange toy (the child's own) was the only one capped by the walking child, with the rest pushed ahead as a rigid train. Separate `drive`/`drag` so a toy glides; `speed` 2.4 → 2.9; the child hurries and leads further; other toys sail side lanes so the orange can pass. One relaxed stroke: 3.7–5.9 → 9–12.4 units, glide 2.3–3.5 → 7–9.3; orange lag behind the leader 14.0 → 6.2 mean. Swims are shorter (47 → 33 s of 66 → 53 s) because the room is faster. Details in `docs/rooms.md` |
| 7 | Drowned village: bare wood island visible at draw distance; hide it in haze | lead | lead | fixed: the wood draws trees only within 178 of the eye, so its bare hill showed over the rooftops. New island mist (`uIsleMist`, `tuning.world.woodMist`) hides it beyond 110–165 units; it comes out of the rain with its trees |
| 8 | Still island: the plane stops greening below a speed threshold that is too high | lead | lead | fixed: greening was gated on `airborne`, which drops as soon as the plane settles to its glide height over the grass, while it still travels 60% of its path. It now greens while it moves (`planeBloomFrom` 0.3). Life along one throw's path, first/middle/last third: 0.77/0.14/0.00 before, 0.91/0.99/1.00 after |
| 9 | Wood → sleeping: the island and its hill curtains show too early | lead | lead | fixed: the same island mist (`sleepingMist`, 40–72 units, a soft bank over the water) hides the island until the last few seconds; the near shore emerges first and the summit window stays hidden until they land, then the mist lifts |
