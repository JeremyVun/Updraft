# The ending

The summit, the fledging, the drawing, the red door and the credits. Read after any context loss while working on
the end of the game. `docs/journey.md` holds the vision this serves; this file holds Jeremy's brief for the polish
pass and the plan that answers it.

## Jeremy's brief (2026-09-18, verbatim)

> "Your task is to tidy up the ending of the game (the summit arena). I think the ending at the summit is beautiful
> and it almost made me cry. But there are a few bugs and polish issues preventing it from being even better. Think
> carefully about the pacing, the audio, the camera work (what we want the player to see). Sweat the details.
>
> Some that i've seen are below though there may be other issues that you migth see that need fixing as well,
> 0) The dolphins are too small. I'd also like to see if you can get the dolphins to animate a bit more organically,
> interacting with the player like one of them coming up from behind and pushing their boat playfully, another
> jumping over the boat maybe. Maybe shorten the sequence just a tiny bit as well (it currently feels like the player
> is looping around in circles for maybe a bit too long).
> 1) The boat that arrives at the summit goes into it instead of landing at it's shore.
> 2) The grass is too short. It shouldn't be too tall that it makes it hard to see the child, but it should still
> feel lush and green and beautiful
> 3) The sequence and callback at the end where you help the cygnet fly away needs a bit of polish. The adult swans
> are flying overhead, which is ok, but when you do the updraft, the cygnet should fly upwards and then start gaining
> confidence and flying on it's own so that it stays in camera, before it looks back at the child, makes a noise,
> and then flies off (maybe still a tiny bit wonky, but definitely more confident and capable after having gone
> through the adventure with the child). As it flies off, the adult swans should stay visible, until the cygnet
> joins them and then they fly away.
> 4) When the camera pans back down, the player needs to be able to see the child unfolding the paper aeroplane
> into the drawing of the house. Right now, the camera pans down and the paper aeroplane is already unfolded.
> 5) After an emotional enough pause, the child heads into the house. (right now this sequence is a bit too long).
> 6) Once the child is in the house, I would tighten up the sequence where it changes to night and pans up (there
> are currently periods of time where it pauses the camera too much)
> 7) Audio design needs to be looked at for the ending. In the final moments as the camera is panning up to the
> stars, the music should sound like it's reaching a finality, ascending (turning form dissonant to happy), before
> cutting to silence, with only the environmental audio playing (the wind, the crickets etc.) and then we scroll the
> credits from the bottom up, with a faintly glowing / fading in and out "play again" button in the bottom right or
> something. For the credits, i want it to read something like below (meant to be tongue in cheek but also honest
> about who the credit belongs to). It's just a rough idea below, so flesh it out.
>
> Directed by Jeremy / Writers: Jeremy, Fable 5.1 / Audio effects: Fable 5.1 / Visual effects: Opus 5 /
> Graphics engineer: Opus 5, Opus 5, Opus 5 / Animations: Fable"

And, a little later:

> "note: I feel like the final summit island should have a landing dock of some kind that you land at so that it
> feels more like coming home as a contrast to all the other islands"

## What was actually wrong (found 2026-09-18)

- **The boat sailed through the island.** `ROUTES.toHome` came back east along z ≈ −2024 and −1986, which is inside
  the home island's ellipse (its south coast is at z ≈ −1950): the last three legs crossed ground up to 42 units
  high with `canGround` off. And the south shore was a cliff (−1 to +10 in 15 units), because the island's base
  plateau and the wide hill both stood at full height right at the waterline.
- **The drawing opened before the camera got there.** `gone` cut straight to `unfold`, which opened the sheet in
  1.1 s, while the camera took about 5 s to glide round from behind the child, and its target was the cottage
  far down the hill, so the sheet was cut off at the bottom of the frame with the child in a corner.
- **Too long after the release.** `release` 12 s, `nightfall` 26 s, then a 75-unit walk at walking pace under a
  static camera, then a 7 s hold before a 43 s pan.
- **Grass at the summit** is the pasture's 0.4–0.65 height halved again by `grazed` within 45 units of the top.

## The plan

1. **A shelving south shore and a jetty.** `homeHeight` gains `inland`, which brings the plateau and the wide hill
   up over about 110 units from the coast, so the shore is a beach and a slope. The return route stays in water and
   is about 15% shorter. Then (Jeremy's note) a wooden jetty stands out from the beach and the boat comes
   alongside it and stops there — moored, not grounded — and the child steps out onto the planks and walks in:
   the one arrival in the game that has somewhere built for it.
2. **Dolphins** (Opus 5 parcel, `end-dolphins`): adults three quarters of the boat's length; a push from astern
   that the boat answers; a leap over the bow; the child looks.
3. **The fledging** (Opus 5 parcel, after the lead's `home.ts` restructure lands): once the player's updraft has
   it up and the family has come down to wheel nearby, the cygnet flies by itself — a wobbly widening loop over the
   child that steadies as it goes, in frame the whole time — then turns to the child, hangs a beat, calls (the
   third call in the story, and the one that is answered: the family bugles back), and goes north to the wheel.
   The family keeps wheeling until it arrives, then the whole V goes north with the cygnet holding the last place
   in it: the place it fell out of on the first island.
4. **The drawing.** A `settle` beat: the child sits facing the cottage with the plane in both hands while the camera
   comes round to a rear three-quarter over the shoulder, framed on the hands with the cottage beyond; only once
   the camera has arrived does the sheet open, slowly. Gaze, fold, release as before but tighter.
5. **Home.** Nightfall about 11 s, then the child runs down the hill home, the door, and one continuous rise to the
   stars with no hold at the start.
6. **The finale.** A composed cue on the pad and the chimes over the rise: from a cluster that does not agree with
   itself, climbing chord by chord into D, ending on a high held chord that rings out; then the music is cut and
   only the wind, the sea, the crickets and the owl are left. Then the credits roll up from the bottom, with a
   faint breathing "play again" in the corner.
7. **Grass on the home island**: lusher than the pasture, and the summit no longer half-grazed.

## Jeremy's second brief (2026-09-19, verbatim)

> "1. play again shouldnt have a button border.
> 2. it should take more wind from the player to help the cygnett fly. right now i only need to move my mouse and
> draw one short line (it should feel more involved from the player, more cursor turns to create the updraft to help
> it fly). This should also be the one sequence in the game that doesn't time out (it requires the player to do
> something).
> 3. I want a better animation for the child unfolding the paper aeroplane, and when they do so, the house should
> be in sight (and the chimney shouldn't start smoking until the child enters the house). I'm thinking that after
> they help the cygnett fly away, there's an emotional pause of some kind as they keep walking slowly up the hill,
> and then they see the house and then unfold the paper aeroplane.
> 4. For the ending scene with the sky full of stars, is there a way to compose the shot so that the stars are
> still sparkling in the water in the bottom half, while keeping the moon in the shot? The moon probably shouldn't
> be right in the middle of the screen horizontally either (it causes the credit text to become hard to read). I
> dont know, please take a look and help me figure out how to better compose this final camera pan (maybe water
> distance rendering needs a look at as well? I'm not sure)."

And, while that was being built:

> "there should be some mechanic in the game called an 'updraft' that the player learns either by accident or as
> part of earlier puzzles and sequences where we show them an upward spiralling trace (like at the summit scene
> currently), and the player has to mirror it with their cursor (mouse / touch screen drag)"

## What answers it (2026-09-19)

- **The lift is the whole gesture.** A bare gust used to count as lift under the bird (`tuning.colt.gustLift` 0.9
  against a take-off at 0.5), so one stroke lifted it. Now gusts only make it hope (0.25: wings half open, nothing
  more). At the summit a column of `tuning.summit.liftToFly` gets it off the grass and then it climbs only as fast
  as the player keeps winding and sinks the moment they stop (`Cygnet.needs` with a `Labour`: `gain`, `sink`,
  `rise`), and the family comes down for it once it has been held `liftTo` up: six to eight turns of the cursor,
  and a player who stops halfway watches it come back down to try again. Nothing times it out.
- **Why it happens.** Sitting in the last of the sun, the family passes low across the sun ahead of the child
  (`updateSummit`: `flock.pass` where the summit camera can see it), the small one watches them and cries after
  them, and only then is it set down. The family swings out of the skein into a wide wheel over the hilltop and
  calls from it every `callEvery` seconds while the player is asked; they come down for it only when it is up.
- **The updraft is taught by mirroring.** The invitation spiral (`Coax`, `fx/swirl.ts`) was already shown in the
  meadow's `try` beat and at the summit; what stopped it being a lesson was that gusts lifted the bird anyway, and
  that the player's column stood at the cursor's ground point, which under a low camera is a long ellipse off the
  bird. Now `input.anchor` (set by `main.ts` while a chapter `invitesFlight`) stands the column at the bird when
  the circles are drawn near it on screen (`tuning.pointer.anchorNear`), so the player's spiral takes the
  invitation's place exactly. The meadow teaches it, the summit asks for it.
- **On over the brow.** The cottage was hidden from the summit point behind the true crest, which is why the
  drawing used to open against grass. After the family goes, the child walks on slowly (`Traveller.stroll`, beat
  `crest`) with their eyes on the path; they stop on the brow (`BROW_AT`, 17 on from the summit) and stand there
  for six seconds with the valley and the roof below them, and only then go down a few steps more to `REVEAL`
  (25 on), sit, and open the paper with the cottage in frame beyond it. The house first, then the drawing: the
  rhyme needs the thing before the picture of it.
  The chimney is cold (`Cottage.smoking`) until nightfall, when somebody in the house lights the fire: the smoke
  is what asks the child in (Jeremy: children do not light fireplaces, adults do).
- **Play again** is bare glowing text: no border, box or blur.
- **Fireflies at home** had gone out: the sleeping island's `presence` (which puts a summer night's fireflies out)
  was true for the whole 300-unit range the room is drawn at, and the cottage is 237 from the hollow. It now gives
  out at `PRESENCE_TO` (110) from the hollow.
- The final rise and the stars in the water: Opus 5 parcel `end-stars`, merged. The unfolding animation: Opus 5
  parcel `end-unfold`.

## Status (2026-09-19)

On `main`: everything in the first brief (the shelving shore and the shorter route; the jetty, `world/jetty.ts`,
with its deck and mooring, the arrival watched from the water and the climb watched from low behind the child;
the dolphins; the fledging and join; the restructured beats, cameras and timings in `home.ts`; the lush home
grass; the finale and the credits) and the second brief's mechanics above.

**The last shot** (`end-stars`, 2026-09-19). The rise now ends looking out over the open sea north-east of the
island, swung 19 degrees east of the moon (`MOON_OFF` in `home.ts`) and a degree above level: the moon hangs in
the left of the frame with its path lying down the water under it, the horizon crosses the middle, and the dark
strip up the centre that the credits roll through is left alone. The moon had to come down to do it (`MOON.el`
12, was 24): from a camera 90 units up, a moon at 24 throws its path onto water inside the island's own shoulder,
where nothing can see it, and it will not share a 38-degree lens with the sea it lights. The pan also tightens as
it goes (`pace` 0.2 to 0.36 instead of 0.2 down to 0.08) so it has arrived by the time the credits are over it;
before, it was still swinging the moon into the middle of the screen a minute into the roll.
And the sea keeps the stars: `uStarlight` (1 once the last of the day is out of the sky and no weather is in the
way) thins the night haze, draws the distance veil back from 510 units to 780, and lets the water catch the
sky's field of stars as glints — the world-space cells a few pixels across that the sun's glitter is drawn with,
because reflecting the sky's own star field through the ripples would only boil. Before this the whole lower
frame was one flat fogged slab.


**The unfolding** (`end-unfold`, 2026-09-19). The drawing is not a second sheet that replaces the plane any
more: it is the same piece of paper. `traveller/drawing.ts` holds the sheet the glider is folded from — its span
plus its keel across, its length along, nose at the top edge — cut into the eight facets its creases make, and
folds every vertex of it on the CPU each frame: the nose flap first, about the diagonal crease out of the nose,
then the wing about its own crease, then the fold down the middle that everything rides on. Folded, it is the
plane in the child's hand (the glider mesh is hidden from the brow until the throw, and comes back at the instant
it leaves their hand). `open` runs it to the flat sheet in stages you can watch — the near wing up, the far one
falling open after it, the sheet swinging out of its own fold, the two corners of the nose flipping back — and the
drawn side is the side those folds hide, so the drawing arrives as the paper flattens, with the creases still in
it. The mittens are put on points *of the sheet* (`Drawing.point`, `GRIPS` in `home.ts`), so the hands go where
the paper goes: the far one keeps hold of the fold, the near one lifts the wing, swings the sheet open, flicks the
corners back and takes a bottom corner. It is folded back the same way before the throw.
And the camera is one swing and nothing else: close behind on the walk, up over their head on the brow so the
valley opens for the player as it opens for the child, round onto their left shoulder as they sit, in on their
hands while the paper comes open and out again as the sheet fills, so the finished drawing and the house it is a
drawing of are held in the one frame. `gone` to `release` is about 61 s, six more than it was.

Waiting on Jeremy: the credits copy (`docs/copy/copy-2.json`), the finale as heard (composed blind), and whether
the 72 s credits roll and the summit-to-credits pacing feel right. Known and pre-existing: `tools/cygnet-gates.mjs`
reports the set-down step-off jerk a hair over its limit (0.021 against 0.02), in `companion/carry.ts`.
