# How Updraft frames a human: the camera grammar, measured

A study for the drowned village's camera phase (Phase 8). It reads `src/camera.ts`, `src/camera-direction.ts`,
`tuning.cinematography` and each room's `frame()`, and measures real play on `main` (58620cce): the little boats,
the birches, the stairs in the clouds, the dark wood from the owl, the sea and the meadow from the piano, each played
with real gestures in landscape (1600x900) and upright (900x1600) with the rig traced every frame.

- Contact sheets: `comps/camera-A-walking-and-wide.jpg`, `camera-B-interactions.jpg`,
  `camera-C-creatures-and-feeling.jpg`, `camera-D-upright.jpg`, `camera-E-one-move-the-owl.jpg`. Every tile is captioned
  with its label (A1, B2 and so on below), the lens distance from her (flat), the lens height over her feet, the angle
  down to her head and the vertical field.
- "Her" is the child; her head is about 1.2 m over her feet. "Down" is the angle from the lens down to her head.

## 1. The lens

- One fixed lens, eased only for a reason. Landscape 16:9: 38.7° vertical, 64° horizontal (`verticalFov`, the
  horizontal field is never narrower than 64°). Upright 9:16: 62° vertical (the clamp), only about 37° across.
- `Shot.zoom` is a longer lens (2 halves the field) and eases in at 1.1/s (95% in about 2.7 s). The game uses it
  rarely and for meaning: 1.3 (30° vertical) for her wonder at the foot of the stair, about 1.8 (22°) for her face to
  face with the owl, 2.2 (18°) for the impossible loop. Wider than normal only for a held frame that must hold a
  place: the owl's held frame (76° across), the lighthouse (0.82).
- Child size this gives (landscape): about 29% of the frame's height at 6 m, 13% at 13 m, 8% at 20 m, 4% at 40 m.

## 2. Distance and height, by kind of shot (code and measured)

| Kind | Lens from her (flat) | Lens over her feet | Down to her head | Pace | Examples |
|---|---|---|---|---|---|
| Walking, open ground | 17-23 m | 8-11 m | 17-30° | 0.4-0.65 | A1 boats, A2 birches |
| Walking, wooded / low / slope | 12-14 m | 3-4.5 m | 7-13° | 0.35-0.65 | A3 wood, A4-A5 stairs |
| Sailing | 16-23 m behind | 4.5-6 m | 12-13° | 0.4-0.7 | A6 sea, `crossingCamera` |
| Working a thing (interaction) | 12-22 m | 5-10 m | 15-25° | 0.4-0.65 | B1-B5, B7 |
| Close interaction over her shoulder | 6 m | 3 m | 18° | 2.8 | B6 the ember in the shelter |
| Creature / feeling moment | 5-13 m | -0.7 to +2.7 m (near her head) | -9° to +7° | 0.16-0.3 | C1-C8, C10 |
| Wide establishing / reveal | 20-40 m | 10-16 m | 20-25° | 0.35-0.8 | A7-A9 |
| Set-piece reveal (rare) | up to 40 m | up to 48 m | up to 50° | ratchet | meadow greening; stairs loop 65° |

What sets those numbers in code:
- A follow names a `target` above her (her feet +1.0 to +3.4 m), a `distance`, a `height` over the target and a
  `from` bearing; default is from just east of south (`FROM`), so most rooms are seen looking roughly north, the
  way the journey goes. Birches walking: `distance = min(26, 18 + 0.4 x plane distance)`, `height = 0.3 x distance`.
  Boats: 23/9 walking, 13/6 while she handles the toy, 25/8 at the end. Wood walking: the eye stands on the ground
  `cameraBack` 13 m behind the way she is going, `cameraSide` 2.8 m off her shoulder, `cameraUp` 2.8 m up.
- Feeling shots drop the target to her head (+1.0 to +1.3), the height over it to 0.2-0.5 m and the ground
  clearance from 2.8 to 0.4 m (stairs `hesitate`, `birdFirst`, `follow`, the boarding at the top).

## 3. Where she sits in the frame

Measured from the stills (x across, y down, 0..1):
- Walking: centred across (x 0.45-0.57), head at y 0.5-0.7, so she sits on or just below the middle and the way
  ahead (the swing on its rise, the stair, the next coal, the sea) fills the upper half. Lead room is made by moving
  the target ahead of her, not by pushing her to a third: birches 4 m north of her, boats up to 62% of the way to the
  toy, the wood up to 36% of the way to the next coal's glow, sailing 1.5-5 m ahead of her seat.
- Interactions: she moves to a third (x 0.3-0.37 or 0.63-0.68) and the thing she is working takes the other side
  or the space above her: B2 (bath left, her right third), B4 (snag left, her right), B6, B7 (her left third, the
  ember / plane right and up).
- Feeling: firmly on a third, the other third given to what she is looking at or feeling about: C3 her left third,
  the bird going up the flight right; C7 the owl's held frame puts her profile at x 0.14 with the rock and eyes right;
  C8 her back at x 0.29, the owl in the fork right. Her head stays below the upper third line (y 0.5-0.75): the
  space above her is sky, stair, cloud or the shape she fears.
- She never leaves a 0.9 safety frame (`primarySafetyMargin`, enforced at once), and her feet are kept in frame.

## 4. Subjects, margins and keeping the thing she works in frame

- `Shot.subjects = {primary, secondary, tertiary?, points?, margin, extra}`: primary is her (+1.1 to +1.5 m),
  secondary the other subject (the bird, the plane, the sail point, a flight's drawing), tertiary or `points` the
  extra bounds (the hull ends, the next coal, the hearth). `margin` is the share of the frame they must sit inside
  (0.65 close in the wood, 0.72-0.8 usual, 0.9 for the owl), `extra` the most the lens may retreat to fit (0.5 to 18 m,
  40 for a farewell). Room made is a commitment: opens at `fitOpen` 2.2/s, holds 4 s after the need shrinks, settles at
  0.45/s, so it never pumps in and out. The stairs puzzle opens it more gently (`smoothFit` 1.5).
- The target itself is pulled between her and the thing (the toy, the bath while the fleet waits, the flight's
  drawing 60%, the refuge 62%), and the lens side is chosen so the thing is beside her, never behind her: the wood's
  walking camera stands off her shoulder on whichever side the waiting coal lies, easing across as each coal is laid.
- The little boats' gate lean: while the fleet waits on the bath or plug, the target leans 18% (landscape) or 42%
  (upright) toward it, eased at 0.7/s both ways.

## 5. How the lens moves between beats

- Every change is a critically damped glide: it builds speed, arrives softly, never rings. Response is
  `min(1.4, 2 x pace)` per second; 95% arrival takes about 4.7 / response: pace 0.16 about 15 s, 0.2 about 12 s,
  0.3 about 8 s, 0.4 about 6 s, 0.65 about 3.6 s, 0.7+ about 3.4 s. Walking rooms use 0.4-0.65; moments 0.16-0.3.
- A change of side is an orbit round her at fixed distance ("round her, never across or through her"), capped at
  `maxTurnSpeed` 0.3 rad/s = 17.2°/s. Measured on every orbit beat: p95 and max 17.2-17.6°/s, so a 60-90° change of
  side takes 4-6 s (boats `notice`: 65° to the handling close-up; stairs `hesitate`).
- Authored single moves set their own time and are slow: the owl's ease into its held frame at least 7.5 s, its pan
  to the owl 4.2 s, its release back behind her 8 s (sheet E); the stairs' drift to her side 7 s, the loop's settle
  5 s; the sea's farewell swing 22 s. Their peaks measured 21-26°/s for a second or so (owl ease 21.6, stairs nest
  26, skein 25); the fastest anywhere was 29.5°/s, briefly, during the wood's rescue reunion (a placed eye, so uncapped).
- Composition is chosen, not hunted: the director may try angles within 0.18 rad of the authored view, only with a
  material gain, 1.5 s of evidence and after 6 s of holding (`freedom`, `holdFor`, `confirmFor`); never a reverse.
- It never cuts visibly in play. Cuts happen when a room starts, and once inside the stairs' white, hidden by the
  cloud, as the boat is let down onto the sea (`stairs.cameraCut`). Thresholds (the red door) are continuous paths.
  Breathing: a slow drift of 2% of the reach sideways and 1.2% up and down.
- A follow carries half her smoothed travel (`followShare`), so walking and stopping do not stretch the shot; a boat
  carries the lens with it (`carry`), braking no harder than 9 m/s².

## 6. Glances (`Shot.attention`)

- A glance turns the lens toward something without moving it off her: `{point, strength 0..1, weight, bearing?,
  distance?, height?}`. Weight is the share of the gaze it gets: 0.3 (the island in a farewell, the church spire, the
  torn sheet), 0.38 (the whale). Strength eases in and out with the moment.
- It is watched only inside an arc of the travelling view (the whale within 0.8 rad, let go over a further 0.6 rad; the
  lighthouse 0.7): the lens never circles to keep it. A watched whale also backs the lens off 6 m and up 1.2 m and adds
  the whale's extent as subjects, so her boat and the body share the frame (B9).

## 7. Never from above

- Ground in the way is answered by coming closer first (30% then 55% of the way in), only then by rising
  (`place`, `blocked`): "a camera that solves every hill by climbing ends up looking down on the game".
- Static scenery (`Shot.obstacles`): sideways first (up to 8 m), any rise capped so the angle down to her never
  passes 0.3 rad (17°) (`obstacleMaxElevation`).
- Rooms place the eye low by design: the wood stands the eye on the ground behind her plus 2.8 m ("a fixed height put
  the camera in the hillside going up and in the air coming down"); the birches cap the distance at 26 m ("from up
  above, a wood is a ceiling"); the stairs keep the lens under the cloud base and later over its tops by 1.2 m.
- Measured: interactions 15-25° down, wooded or close 7-18°, feeling beats at or below her eye. The only steep views
  are deliberate reveals (the meadow's greening rises to about 50° with the wave; the stairs' impossible loop is a
  65° puzzle view held dead still), and both return to her.

## 8. Feeling beats

- Closer: 5-6 m for the bird going first (C3), in the cloud (C4), the boarding at the top. The owl's held frame
  stands back 13 m with a wide lens to hold the place; its face-to-face pan is 10.5 m on a long lens, so she fills
  about 30% of the frame (C8, E5).
- Lower: the lens at her head height or below, looking level or up past her the way she looks (C1 up the stair, C2
  from below the landing, C5 up at the swans): from 7° down to 9° up.
- Three-quarter or profile with her face and what she feels about in one frame (C3, C7), or from behind her when
  what she looks at fills the frame beyond her (C5, C8); never her walking at the lens. The wood's reunion is moved "to see the offered hand and the bird's way out beside the
  child, instead of through their back".
- Slower and longer: pace 0.16-0.3; held until the story moves (the owl's held frame about 40 s here, the skein 50 s,
  the swing 12 s), one unhurried move per beat, never in and out (the owl pan goes "across round the owl rather than
  in toward it").
- A goodbye holds wide enough to keep what is left: the sea's farewell keeps the island and the whole hull as bounds
  (`extra` 40) and lets go as the swing home begins; the meadow pond keeps her and the empty water (C12); home's
  goodbye "stays at the crest: no following, dolly or crane".
- Caution from the bar itself: at the stairs' boarding the mast crosses her face at 5.6 m (C6). Sailing views keep the
  mast out by bearing (`nearBearing` 0.12 so "the mast never bisects the companions", the quarter away from the sail).

## 9. Upright

- Same rig, narrower and taller frame. Rooms either draw back a little (boats +4 m; the birches' scarf and swing offer
  scale distance by `0.56 / aspect` below that aspect) or lean less toward the far target (stairs ashore 12% vs 35%,
  boats 40% vs 62%), and lean more toward an obstacle that matters (boats gate 42% vs 18%). Subjects keep her inside.
- The best upright frames are composed for themselves and stack the story up the frame: the owl's upright held view
  is closer (8 m vs 13 m), wider (72° vertical) and tilted 10° up, so she is bottom-left and the rock, antlers and eyes
  stand above her (D6); its face view is 34° vertical (D7). She is smaller upright: 3-7% of the frame's height walking
  (D2), 12-22% in the moments (D5-D7).
- Measured turn speeds are the same as landscape (orbits 17.6°/s max; authored peaks 26°/s).

## 10. The beats studied (tiles on the contact sheets)

- A1: walking up from the beach, 17 m back, 11 m up, 30° down; the pools ahead.
- A2: walking, centred low, the swing on its rise at the top of frame.
- A3: behind her and off her shoulder, low (+3 m), the waiting coal beside her.
- A4/A5: low up the grass (+3 m, 9°); climbing from behind and above.
- A6: sailing, 22 m astern, small quarter offset, lead room ahead of the bow.
- A7-A9: wide frames for the field (40 m), the reveal of their boat among the toys (20 m), the walk down to the boat.
- B1: the handling close-up comes round 65° to her other side, 13 m, toy and water.
- B2: the fleet held at the shoal, the bath leaned into frame, her right third.
- B3/B4 birches: the swing offered from 22 m low; the scarf snag over her shoulder, snag left, her right third.
- B5: the flight puzzle: her, the loose flight and its ghost drawing in one frame.
- B6: over her shoulder at 6 m, the shelter and the ember centred, her a dark mass left.
- B7 wood: the plane in the fork, her left third, the fork up right. B8 meadow: the piano answer steps back and up.
- B9: the whale glanced at from the travelling view, the boat still the subject.
- C1: low behind her, long lens, looking up the stair the way she looks.
- C2/C3: from the landing's corner at her eye height, the bird going up first.
- C4/C5: in the cloud at 5 m behind and below; the skein from behind the two of them, the sun in frame.
- C6: boarding at the top: the mast crosses her face (what not to copy).
- C7/C8 and sheet E: the owl: held wide frame with her profile far left; one pan round to the owl with a long lens;
  released back behind her over 8 s.
- C9 wood: the bird found, the lens beside the offered hand. C10 birches: the swing, three-quarters on, low (+2.7 m).
- C11 sea: the cygnet's swim opens the lens 37° to the side and in to 16 m. C12 meadow: the pond after the family.
- D1-D8: the same beats upright.

## 11. Applying it to the drowned village

Read from `proto-drowned-roofs` after 7c and 7d.

The API it uses:
- `drowned.ts`: the drift, the cat and the stranding use the ordinary rig: an orbiting follow with `carry` on the
  boat, `subjects` (her, the sail, the hull ends), `obstacles` (roofs, chimneys, branches) and the church as an
  `attention` glance (weight 0.3). The cat frame and the stranding set `from`, `distance`, `height` and `zoom`
  (0.9-1); with the cat aboard the lens stands 5.5 m off the port side, 0.9 m over the aim (`aboard*`), the rescue
  4.2 m at 2.6 m (`rescue*`).
- `drowned-run.ts` (`RoofRun.frame`): a placed eye (`shot.eye`, `orbit: false`) taken from a lens path laid ahead of
  time (`layLens`, a cost search over `WAY`), 10 m off (upright 12), 1.5 m over her (upright 2.6), a lens widened to
  0.85 (about 45° vertical), pace 0.7, with each piece's own station view eased in over her last 5 m to it and round
  rates of 0.95/s (0.25/s to the swing). `subjects` only upright (her alone), none in landscape; no obstacles.
- `drowned-church.ts` (`ChurchArrival.frame`): `exact: true` views from a table round the tower (climb, nest, sea,
  ring, bring, up; upright has its own), glided about the tower's centre in about 1.8 s per change, with a
  `cameraCut` into and out of the belfry; `departure()` mixes into the storm's frame over 12 s.

Where it departs from the grammar:
- Turn speed. A placed eye is not capped by `maxTurnSpeed` and an `exact` view bypasses the rig entirely; the run's
  laid path and the church's 1.8 s glides can turn as fast as their own curves (the review measured 64°/s upright
  coming round from the climb). The bar rooms turn at 17°/s on orbits and peak at 21-30°/s for a second in their
  authored moves. Either cap the authored turn (or ask for an orbit, `orbit: true`, where it is a change of side) or
  give the moves the bar rooms' time: 4-8 s per change of view, one move per beat.
- Height. The mill's station (`millWide` 9.3 m over her roof, looking down) and the swing's via point (13 m over
  the swing's pivot) look down on her, where the bar rooms' interactions sit 15-25° down at most and their feeling beats at her eye.
  Climbs are seen low and looking up the way she climbs (stairs `climb`, `hesitate`: lens at or below the landing);
  the thing climbed is the ruler in frame. The swing in the birches is three-quarters on, 14 m from the seat, the
  lens 2.6 m over the seat's aim: about 7-10° down.
- What must share the frame. In landscape the run names no subjects, so nothing holds the fog, the sheet, the mill's
  sail or the church in frame with her; in the church `exact` drops subjects, obstacles and the safety frame, so the
  cat at the sill can be 30 px and the red sail can stand between lens and cat. The grammar names her as primary and
  the thing as secondary (fog front, the piece, the cat, the bell, the kittens), leans the target 35-62% toward it,
  and picks the side so it is beside her, never behind her. A moving occluder (sail, mast) is avoided by bearing.
- Facing. On the granary ridge she walks at the lens, and the kittens are seen with her back to it through the other
  light. Walking frames in the bar rooms stand behind her the way she is going (wood: behind her heading, not behind
  north); discoveries are three-quarter or profile with what she finds beside her face (C3, C7, the wood's reunion).
- Close and wide used the other way round. The drift holds a 5.5 m two-shot for its 20 s of travel and the stranding
  holds a low 15 m wide frame through the cat's stare, yowl and bolt. The bar rooms travel wide-behind with the place
  in frame (sailing 16-23 m, the place passing beside) and go close for a creature's moment (5-6 m at her eye height,
  pace 0.2-0.3), then release. For a growing threat the wood's fright "settles" first, then holds the shelter and
  her together; the fog can be a secondary subject or a 0.3 glance whose strength rises with it, so its rise grows in
  frame while the lens stays with her.
- Cuts. The belfry's `cameraCut` into and out of the tower is a visible cut in play; the game's only other cut in
  play is hidden in solid white cloud. Everywhere else the lens goes round, over or through (the red door's threshold
  is a continuous path).
- What already fits: the drift's follow (16-23 m, 2.8-5 m up, obstacles sideways first, the spire as a glance), the
  storm and lighthouse frames, and the belfry's fog sea, rings and lantern, which the review says read.
