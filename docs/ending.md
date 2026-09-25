# The ending

The summit, the fledging, the drawing, the red door and the credits. Read after any context loss while working on
the end of the game. `docs/journey.md` holds the vision this serves; this file holds Jeremy's brief for the polish
pass and the plan that answers it.

## Sky mirror to home (2026-09-23)

Jeremy asked for a more considered arrival before the ending, then found the close-up haze too strong and
the divide between clear shoreline and obscured hillside too obvious. The boat now curves offshore before
turning into the jetty, keeping more water between it and the beach. The passage remains about 40 seconds.
A low camera arcs toward the jetty's seaward quarter; its lantern stays softly lit as daylight returns.
Shared distance haze is lighter and spreads over nearly three times the usual depth. It eases between
150 and 45 metres from the berth, leaving the nearby beach and grass clear. The remaining mist clears as
the child walks the first 24 metres of the jetty. The climb, cottage reveal and ending score retain their
existing timing.

The lighter distance haze alone still left an oval of visible grass, which Jeremy rejected. A fog-disabled
capture exposed the same outline at the end of the blade draw range. Home's distant terrain now carries
filtered tuft shading using the grass palette, instead of becoming a smooth dome. During the approach,
terrain and blades share a landscape fog depth derived from the jetty distance; the whole hill clears
together. This applies only to Home's landscape, preserving the foreground boat, child and ordinary fog
elsewhere. The profile eases back to normal during the jetty walk.

`tools/home-approach-browser-check.mjs` runs the completed mirror departure through the real crossing,
docking and shore approach on desktop and phone, captures each stage, and checks framing, continuous
camera turns and haze clearing. `tools/crossing-haze-check.mjs` covers the distance transitions and summit
light; `tools/crossing-camera-check.mjs` covers ordinary routes and gusts.

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

## Jeremy's third brief (2026-09-19, evening, verbatim)

After playing the unfolding that landed that afternoon:

> "the paper aeroplane unfolding doesn't look right. throughout the whole game, it's a white piece of paper, but
> then suddenly it changes to this [a wide, ruled sheet in the child's hand on the brow]. It's wider and is showing
> a drawing. The unfolding is supposed to be a surprise, a dreamlike reveal, but it's revealed before it's ever
> unfolded."

Asked what would make the ending most likely to make people cry, the lead proposed: keep the unfolding but make
it small and hands-led; put the drawing *before* the house, so the picture becomes the place when they walk over
the brow; let the music go quiet for it and return with the house; someone in the doorway; and the player, the
wind, taking the drawing away at the end. Jeremy:

> "yea, the camera work will need to be key. Enter the dream and go with what feels most natural. I'm not
> convinced about the figure standing in the light though, but if you think it works, you're free to try."

After the third round was on `main`, asked whether the drawing before the house fits the narrative better:

> "ok, then my only steer is to keep the map unfolded for a bit until the house comes into view"

So the sheet stays open in their hands as they walk on over the brow, and only folds once the house is in view.

## The plan for the third round

1. **The paper is the plane until it opens.** From the summit to the moment the hands begin, the paper is
   indistinguishable from the glider (same silhouette, scale and white paper; the swap made at that instant and
   checked frame by frame). No face shows any drawing before the sheet is opening; the drawing comes into being
   as the paper flattens.
2. **Drawing first, then the house.** After the family goes the child sits alone on the summit, the house still
   hidden behind the brow, and opens the plane: a child's crayon drawing of a house with a red door. Quiet. Then
   they get up, walk the last steps over the brow, and the real house is below them, as drawn, window lit. The
   walk over the brow is the climax. The camera carries it: over the shoulder for the hands, then rising with them
   over the brow so the valley opens for the player as it opens for the child.
3. **Music quiet for the opening**, wind and paper only, and the theme back as the house appears.
4. **The wind takes the drawing.** The child holds it up into the wind and the player's stroke carries it into the
   sunset the way the cygnet went; the island's own wind takes it after a while if the player does nothing, so the
   ending cannot stall.
5. **The door opens from inside** as the child comes down to it, light spilling onto the grass. No figure: Jeremy
   is not convinced by one, and a crude figure would cost more than it gives.

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


**The unfolding** (`end-unfold2`, 2026-09-19, answering the third brief). Three things were wrong with the first
version: the paper stopped being the plane at the brow, the drawing was on it before it was ever opened, and the
house was shown before the picture of it.

*The paper is the plane until it opens.* `traveller/drawing.ts` still holds the sheet the glider is folded from,
cut into the eight facets its creases make and folded vertex by vertex on the CPU each frame — the nose flap about
the diagonal crease out of the nose, then the wing about its own crease, then the fold down the middle everything
rides on. What is new is that folded it *is* the glider rather than a likeness of it. The sheet is 3.3 by 2.45
(`HALF_W` 1.65, `KEEL` 0.5) and hangs from `HOLD`, and those numbers put its span at ±1.15, its nose at +1.5, its
tail at −0.95, its wings at +0.16 and the bottom of its keel at −0.34: the glider's own five points
(`glider/glider.ts`, `paperPlane()`), at the glider's own `SCALE`. Its shader is the glider's `PAPER_FRAG` and not
a second opinion about paper — the same white (0.96, 0.93, 0.87), the same nine ruled lines read off a paper
coordinate in the glider's units so they lie across the folded plane where the glider's do, the same margin, the
same hemisphere-plus-sun-plus-rim light with the same glow through the back of the page. One difference is left
and cannot be folded away: a real dart's wing ends in a short chord with a 45-degree leading edge, and the glider
is a stylised arrow with a point and a 25-degree one. The exchange is made at nine units with the camera moving,
where that is a few pixels.

*Nothing is drawn on it before it opens.* `uDrawn` holds the entire crayon back, so both faces are bare ruled
paper while it is folded and the drawing can no longer ride out on top of the wings — which is exactly what
Jeremy saw. The paper comes flat and stays blank for about half a second, and then from `open` 0.58 the crayon
arrives from the foot of the page upward behind a waxy, noisy edge over 2.8 s: the hills and the wall, then the
house, then the sun, and last the little paper plane in the sky. `uOpen` brings the creases up as it opens, so the
folded plane has none. Folding it back runs the crayon out again (capped by `smoothstep(open, 0.06, 0.42)`), so
the faces that come back to the outside of the plane are bare paper, the way they were on the way up.

*Historical staging, superseded by the house-first sequence below.* The drawing originally came first, the house second. After the family goes, the child turns for home, walks six units down
off the very top — far enough that the ground has begun to fall and the sheet is held against the sea and not
against the grass — and sits down with the cottage still hidden behind the brow. `settle` 3.6 s (they turn, sit,
and the paper comes up out of the one hand into both; the glider is hidden and the sheet shown at the start of it,
still a plane), `unfold` 4.2 s on `OPENING` keys — the two wings up in 1.1 s, then held still for 0.8 s with the
plane's shape wide open in their hands, then flat over 2.3 s — `gaze` 6 s, `fold` 2.6 s. Then they stand, the
sheet is the glider again in their hand, and they walk the last eleven units over the brow (`crest`, `Traveller.
stroll` 0.7, about 7 s) and stand there 7 s with the real house below them, lit, as drawn. The walk over the brow
is the climax, and the picture is what the player has in their eye when it happens.

*The camera is one swing.* Behind them while the family goes; round onto their shoulder and in from nine units to
four as they sit (`DRAW_ARC` 0.7, and briskly — `pace` 0.8 — so it has arrived before the first fold moves); in to
3.2 on the mittens as the paper opens and out to 4.7 as the sheet fills, so the finished drawing is held whole;
then one long move through `fold` and `crest` that takes it back in behind them (`WALK_ARC` 0.1), up from 2.5 to
4.8 and out to 7.1, so it is over their head when the ground drops away and the valley opens for the player at the
moment it opens for the child; and a last quarter-turn off their shoulder (`BROW_ARC` 0.28 to `GOES_ARC` 0.46)
while the paper goes.

*The music goes for it.* `HomeChapter.hush` runs to 0.75 as they sit, 1 through the opening and the gaze, 0.9
through the fold, and then back down to 0 across the last nine units of the walk, so the theme swells as the
ground falls away. `cue('unfold')` still fires as the hands start: a small paper sound reads better than nothing
at all with the music that far out. The wind and the paper are the whole soundtrack of the opening.

*The wind takes the drawing.* There is no throw any more. On the brow the child raises the paper into the wind on
the same hand that has carried it all game, and `release` waits for the player, who is not muted there. The stroke
is read as a stroke and not as a place (`input.gust` above 2, about four tenths of a second of real stroking):
from the brow the ground under the cursor is half a mile of open sea, so asking the player to draw it across the
paper would be asking them to aim at something the camera has put nowhere. Then `Glider.launch` into the sunset,
`depart`, `cue('release')`, and the child cheers after it. If the player only watches, the island's own wind comes
up the hill at 10.8 s — a splat that lays the grass over first — and takes it at 12, so the ending cannot be made
to wait. `gone` to the start of nightfall is about 59 s if the player takes it at once and 70 s if they never do.

*The door opens from inside.* On the run down, `Cottage.openDoor(true)` fires nine units out instead of on
arrival, so the lamplight is out on the grass before the child reaches it. There is no figure in it: Jeremy was
not convinced by one, and a crude one would cost more than it gives.

Everything above, round 2 and the unfolding included, is on `main` as of the evening of 2026-09-19, verified by capture
only: Jeremy has not played round 2. To reach the drawing quickly in QA, `__game.story.current.skipToDrawing(open?)`
from an `eval` step in `?chapter=summit` puts the child on the summit with the family gone and the paper still a
plane in their hand, at `settle`; with an argument it sits them down with the sheet already that far open.

Waiting on Jeremy: the credits copy (`docs/copy/copy-2.json`), the finale as heard (composed blind), and whether
the 72 s credits roll and the summit-to-credits pacing feel right. Known and pre-existing: `tools/cygnet-gates.mjs`
reports the set-down step-off jerk a hair over its limit (0.021 against 0.02), in `companion/carry.ts`.

## Flock departure (2026-09-20)

Jeremy noticed adults racing back into formation and asked for natural catch-up while keeping the opening's V.
The old position interpolation could move an adult at nearly four times the intended travelling speed.
`SwanFlock.goOn` now assigns the V around the birds' expected turning paths. They retain their speed, bank onto
their courses and fly toward their stations, with bounded acceleration and at most 15% extra catch-up speed.
Birds ahead ease back; birds on crossing paths leave vertical room. The departure and the opening share the
same V proportions, and the cygnet takes eight seconds to settle into the empty tail station.

The controls are in `tuning.swanDeparture`. `node tools/flock-flight-check.mjs` checks speed, acceleration,
turns, separation, the V forming before the child turns away, and the opening reset at 30/60/120 fps.

## House first, then recognition (2026-09-20)

Jeremy: “the audio motif that plays should [be] played at the moment when three things are true — the house is
found, the paper plane is unfolded and reveals the house.” He chose the alternative where the child keeps
walking, sees the house, then unfolds the plane: “sweat the details when it comes to the camera script.”

After watching the flock leave, the child walks seventeen units over the brow with the plane still folded.
They remain standing: one second looking at the visible house, 2.2 seconds bringing the plane into both hands,
then the existing 4.2-second physical unfold. The picture becomes readable with the final fold. The motif starts
at that recognition, with both the sheet and the real house in frame. The drawing stays open for eight seconds,
as Jeremy chose after the initial twelve-second refinement; the melody continues through refolding.
The child looks from the drawing back to the house; only then do they refold it for its wind release.
Jeremy found the post-fold pause too long: the automatic release now takes two seconds instead of twelve.
The breeze starts after 0.8 seconds; a player's stroke can still carry the plane away sooner.
Paper handling plays at 35% of its previous gain, leaving the wind and melody more space. There is no separate
walk or seven-second wait between reading the picture and finding the house.

Jeremy set the priority: a natural hold first, then the camera. He approved the lower, farther-out pose with
the sheet tilted 40 degrees above horizontal, allowing a tiny extra reach if needed. Its centre is now at
1.95 units above the feet and 1.4 forward. At Jeremy's request, the unfolded picture is 10% larger; the
carried plane keeps its existing size. Both hands follow the near edge. The sheet's
orientation belongs to the child; neither the camera nor a glance toward the cottage swivels it.

Jeremy asked to keep the house in view and preserve the emotion: the sideways shot felt “like you're no longer
the character.” The paper moves farther out, and the camera comes closer and almost directly behind the child,
looking over their head toward the drawing and the house above it. Following Jeremy's feedback that it climbed
too eagerly, the camera approaches over 4.4 seconds through the hands coming up and the first folds opening.
Its landscape resting height is 5.5 units above the child's feet, lowered again after Jeremy found the
previous endpoint too high. During the eight-second hold it advances slightly after a 1.5-second pause,
without further rise or sideways orbit. Some head overlap remains. Portrait screens use their own framing. The aim stays at the sheet's distance: an extended
downward aim would enter the hillside and trigger unwanted terrain correction.
The camera eases out through refolding and follows the plane after release. `tuning.homeReveal` holds the
pose, timing and composition controls. The ending view check verifies that the sheet and house stay in frame
throughout the move and that the paper does not cover the cottage.
The larger picture and slower approach passed all fifteen ending-view cases and typecheck, with full desktop
and portrait captures at `/tmp/updraft-larger-drawing-*`. The lower landscape endpoint also passes all fifteen
view cases and typecheck; its visual check is `/tmp/updraft-lower-reading-hold.png`.
The earlier approved side pose is `/tmp/updraft-natural-hold-side.png`.

`Chapter.afterCamera` checks the actual eased camera, including terrain sight lines and all four paper corners.
A missed view holds recognition rather than playing its music offscreen. The motif starts from audio time
instead of waiting for the next musical pulse; an early plane release lets that melody finish without adding
a competing release phrase. Ambient music stays low through the reveal.

The existing `reunion` checkpoint resumes the approach. `drawing` now resumes the recognised, open picture
at the brow, without replaying its motif. `skipToDrawing()` starts the walk; an opening fraction starts at the
brow. `tools/ending-view-check.mjs` checks sequence, framing gates, frame rates, narrow screens, resizing,
resume, completion and audio scheduling. `tools/ending-check.mjs` captures the sequence in real Chrome.

Validation: production build and the ending sequence checks pass at 30/60/120 fps, including narrow screens,
resize and resume. GPU capture/review remains pending: the shared browser was occupied by the full playthrough.

## Arrival into the summit circuit (2026-09-20)

Jeremy found the V snapping into its circle, with too little camera context for the cygnet's wish to join.
The family now reaches the circle on a tangent and banks in at bounded speed, retaining the same thirteen
adults and their momentum. Slightly different cruising speeds open the V into a loose circuit; no bird is
pulled toward a randomly assigned station. The existing wheel also flies smoothly into the closer gathering
when the player lifts the cygnet.

A steady view from south of the hill shows the turn before the cygnet calls at fourteen seconds; the child
begins the set-down at seventeen. The camera moves closer from that same side, keeping the family beyond
the cygnet's first attempts. Portrait has its own retreat distance to hold the circuit without making the
child disappear into a distant hill. Controls: `tuning.swanArrival` and the arrival/flight values in `tuning.summit`.

Checks: `tools/flock-flight-check.mjs` covers arrival continuity, speed, turn, separation, a minute of waiting,
and the reunion at 30/60/120 fps. `tools/summit-arrival-check.mjs` captures the natural climb, arrival, call
and first attempt in desktop and portrait; `VIDEO=1` also saves the sequence.


## Full house at the unfolding (2026-09-20)

Jeremy found that the foreground hid the lower half of the house when the child began opening the plane.
The old gate checked the roof and middle of the doorway against bare terrain; foreground grass still covered
the walls. The child now stops 24 paces beyond the summit, seven farther than before. The cottage terrace
extends toward the hill, with its flat uphill reach increased from 13 to 26; the house height and seaward edge
stay unchanged. The extension is mirrored in the CPU and GPU heightfields.

The reveal gate checks the lower facade as well as the roof and leaves clearance for grass. The ending view
check independently traces through the grass canopy at the start of unfolding and at recognition; terrain
parity includes the extended terrace and its blended edges. The camera composition and fold timing are unchanged.

Validation: build and all twelve ending-view cases pass, including 30/60/120 fps, narrow screens, resize and
resume. Desktop and portrait GPU captures show the complete lower facade before unfolding and at recognition;
CPU/GPU height parity is within 0.011 units. Evidence: `/tmp/updraft-house-verified-*`.


## Sky mirror beyond the cottage (2026-09-20)

Jeremy noticed the sky mirror's doubled clouds showing as a bright patch to the left of the house.
Its special fragment shading ignored the viewer's chapter. Home now fades only that colour override away,
revealing the ordinary sea already shaded beneath it. Earlier chapters keep the exact original shader weight;
the mirror's terrain, wave flattening, props, puzzle and reflection pass are untouched.

`tools/sky-mirror-visibility-check.mjs` compares rendered water against the legacy fragment expression at the
same simulation instant in the mirror, crossing and washing, and captures the corrected ending in both orientations.


## Daylight recognition, night at home (2026-09-21)

Jeremy found that the drawing's sun did not match the dusk/night outside it. He approved holding warm
daylight through the cygnet's farewell and the unfolding, then letting sunset develop during the child's
descent and completing night after entry. The forest's night and sleeping island's return to day do not
require another night at the summit; the sky mirror suspends time between them.

The short harbour crossing now clears into afternoon. Home holds that light regardless of how long the
player spends on the updraft. The drawing keeps its sun. A lower, wider shoulder view includes the real
sun above and left of the cottage, the same relationship as the picture, with the whole paper and house
clear of each other in landscape and portrait. Home's sun direction blends in over the crossing; other
islands keep their existing light, and the final moon and stars keep their existing positions.

After the paper's release, the child heads straight home. Sunset follows their progress down the hill;
the former eleven-second seated nightfall wait is removed. The windows brighten as daylight fades, and
full night arrives after entry for the rise to the stars. Reunion and drawing saves resume in daylight;
completed saves remain at night. Controls live in `tuning.homeLight` and `tuning.homeReveal`.

The camera returns from the departing plane before the child starts down the hill, then follows close
enough to clear the foreground grass while keeping the cottage roof in frame. Verification covers both
on-screen framing and the terrain/grass sight line to the child, rather than projection alone.

Validation: production build and all fifteen ending-view cases pass, including 30/60/120 fps, portrait,
narrow screens, rotation and resumed saves. Checks cover a minute of waiting for the player's updraft,
a visible real sun above-left of the house, unobscured drawn sun and house, a continuous descent camera,
daylight held until departure, sunset during the walk and full starlight at the credits. Desktop and phone
GPU captures of unfolding through night are at `/tmp/updraft-ending-daylight-final-*`; the daylight
farewell is `/tmp/updraft-ending-daylight-farewell-waiting.png`.
The final descent camera is verified in both orientations at `/tmp/updraft-ending-descent-final-*`.

## A quieter recognition (2026-09-21)

Jeremy found the daylight reveal too bright and too far to the side. His refinement: "it's ok if some of
the drawing is hidden ... just try to see what you can do to make the reveal more emotive."

Home now has a clearer, softer afternoon palette: less gold in the horizon and reflected glare, with cool
sky light in the shadows. It blends in during the crossing and rejoins the existing sunset during descent.
The shoulder camera moves slightly towards the child's line of sight. The child reads the unfolded paper,
slowly looks up at the house, then lets their hands settle a little before refolding. The existing recognition
melody and eight-second hold remain; the moment gains a physical response rather than another pause.

Partial occlusion of the drawing is intentional. Camera checks protect the drawn house and real cottage;
they no longer require the drawn sun to be uncovered by the child's head.

Validation: production build and all fifteen ending-view cases pass. Desktop and phone compositions were
inspected using SwiftShader stills (`/tmp/updraft-reveal-soft-*-reading.png`, half render resolution).
The shared GPU was occupied by a full playthrough, so this refinement has not had another GPU motion review.

## Let the picture float (2026-09-21)

The previous composition still hid the drawn sun. Jeremy asked for the paper farther out and flatter,
with a higher camera over the shoulder: "It's ok if it's not completely connected to their hands, it
should feel a bit surreal." This supersedes the permission above to obscure that part of the drawing.

The sheet sits 2.65 units forward at a 32-degree tilt, with a higher shoulder camera in landscape and
portrait. The hands still follow the folds within their normal reach; contact is allowed to loosen as
the page opens. The look towards home, small settling gesture and softer daylight remain. Visibility
checks now sample the drawn sun's centre and edges throughout recognition, as well as both houses.

Validation: build and all fifteen ending-view cases pass. Full-resolution desktop and phone SwiftShader
stills show the drawn sun clear above the child (`/tmp/updraft-reveal-floating-soft-*-reading.png`).
GPU motion review remains unavailable while the shared browser is running a separate full playthrough.

## Held paper, matching home (2026-09-21)

After seeing the WebM, Jeremy found that the sheet looked as though it was floating away. He asked to
bring the scene closer to the drawing's composition, especially the frontal house, with a slightly
higher camera and a small shift left if needed.

The sheet is back within reach (1.7 units forward), retaining the flatter tilt. The higher shoulder view
keeps its sun visible. The cottage faces the last hill rather than an old fixed world coordinate, with
a seven-degree turn that leaves a little side visible. Jeremy approved that slight angle after asking
whether an exact frontal match would be too on the nose. The door and windows echo the drawing without
making the cottage look arranged for it. Its doorstep and chimney follow the same orientation.
Checks cover mitten contact throughout recognition, a nearly frontal cottage, both drawn landmarks,
and the existing daylight, descent and final-night behavior.

Validation: build and all fifteen ending-view cases pass. Desktop and phone GPU captures were inspected;
the updated reveal was recorded with audio at normal speed (`/tmp/updraft-paper-held-preview.webm`).

## The family washing at home (2026-09-21)

Jeremy asked for the blue, red and yellow clothes from the island of lines beside the cottage. They
represent the child's family: two adults with the small yellow jumper between them. The cygnet has
found its family; the familiar washing says the child belongs here too.

One short line stands behind the left side of the cottage, clear of the door's approach, at a domestic scale.
It uses the original garment silhouettes, colours and blue–yellow–red order. The clothes move in the
live breeze with an independent, quiet pose; the island's sleeve-reaching gesture is not replayed.
There is no new camera beat, interaction or musical cue. The detail is part of the house and becomes
clearer as the paper lowers and the child walks home. Placement and size live in `tuning.homeWashing`.

Validation: build and all fifteen ending-view cases pass. Desktop and phone GPU captures show the
three garments together from the hill and during the descent. At the phone's close doorway view,
the blue garment leaves the edge of the frame as attention settles on the house. The full reveal
and walk were recorded with audio (`/tmp/updraft-home-family-preview.webm`).

Jeremy found the first placement too prominent and asked to turn the line slightly, move it toward the
back of the house, and let the clothes flap gently. The line now sits behind the left corner, turned
sixteen degrees away. Each garment has a small, independent flutter with its top edge pinned, including
when the distant cottage is outside the local wind texture. Moving folds catch the light. The original
island's cloth and family gesture retain their existing behavior.

Validation: build and all fifteen ending-view cases pass. GPU captures checked the reveal, descent and
doorway approach on desktop and phone; the roof partially overlaps the red garment, keeping the line
behind the house. Updated recording with audio: `/tmp/updraft-home-family-refined-preview.webm`.

## Stay at the crest for goodbye (2026-09-21)

Jeremy: "The camera should stay at the hill crest and only pan to bring the house into focus as the
child walks in. The camera shouldn't follow the child because it's a good bye and we need to be in a
good position to do the pan into the rolling credits."

The release settles at the crest. When the child leaves, preserve the actual rendered eye and gaze:
the camera stays there through the walk and door entry, easing its gaze to the cottage over eight
seconds. From the same position, the existing final cue and timing turn the view to the moon and sea
for the credits. No tracking, dolly toward the house, or final upward crane. Completed-save reloads
use the same crest area. This supersedes the earlier camera-following descent.

Validation: build and all fifteen ending-view cases pass, including new assertions that the rendered
camera stays fixed from the first homeward step through credits and neither pan introduces an angular
jump. Existing child visibility, terrain clearance and reveal checks still pass. Desktop and phone GPU
captures cover the walk, doorway and final moon framing. Recording: `/tmp/updraft-crest-goodbye-preview.webm`.

## Night before the door opens (2026-09-21)

Jeremy asked to bring night forward by about five seconds, so the scene is dark and the floating lights
are already playing when the door opens. The fade now begins during the last watch of the released
plane, five seconds before the walk, and reaches its night target over 7.5 seconds with the existing
soft response. The cygnet farewell and drawing still hold daylight for as long as needed. The earlier
requirement to finish darkening after entry is superseded.

Door-opening checks include the renderer's additional light easing and require darkness with the
fireflies lit. Desktop and phone GPU captures show the floating lights already playing as the door
opens; the desktop capture measures 80% night intensity at that moment.

Build and all fifteen ending-view cases pass, including saved-game resumes. Updated recording with
audio: `/tmp/updraft-earlier-night-preview.webm`.

## Credits framing (2026-09-24)

Jeremy: "We need to refine the ending credits (do it in a worktree). move play again to bottom left,
have the rolling credits roll in from the bottom fully, the ending shot should respect rule of thirds
(one third is the water, 2 thirds sky) - currently it's half sky half water.

And give me the full credits copy that gets played. i want changes made to it"

The roll now starts below the bottom edge without a reveal mask. Play again sits in the bottom-left
safe area. The final camera pitch follows the viewport's field of view to place the horizon at the
lower third; narrow screens keep the moon to the left of the text. The score and credit start time
retain their approved timings. Jeremy approved shortening the trimmed roll to 54 seconds and making
Play again smaller (19–22px), while preserving its touch target.
After seeing the phone layout, Jeremy asked to delay the replay control. It now fades in only once
the final credit has cleared the button's area by 24px, then resumes its gentle glow.

Jeremy's attribution edits: Story lists only Fable 5.1; Music and sound and Cinematography list only
Astra; Animation lists Fable 5.1 and Astra; World and creatures lists Opus 5 twice. Visual effects,
Playtesting, Copy and the closing thank-you line are removed. Play again has larger responsive margins from both screen edges,
in addition to device safe areas. Vibe prompter guy now precedes Directed by.

Validation: build and all fifteen ending-view cases pass. Desktop (1600×900) and phone (390×844)
GPU captures confirm the full bottom entrance, bottom-left replay control and lower-third horizon.
Review frames: `/tmp/updraft-credits-review-p9OjEV/`.

## Summit pacing, the last cadence and the credits pan (2026-09-25)

Jeremy, verbatim:

> "I think we do need a look at the pacing and audio on the summit island in particular. The camera pan to the
> ending credits is a bit fast and the audio overall just isn't that cohesive."

After the review:

> "- Agreed with normalising volumes across the rooms.
> - I think it's not just the panning but the audio still feels rushed to find a conclusion before the rolling credits.
> - yea, remove the reward bells on the summit island. maybe even on the still island too
> - do you think the climb up the summit is too long? I thought it was ok - were you thinking of making the hill shorter?
> - after the updraft, we could reduce the watching them go by a second or so, but definitely not 7 seconds?
> - yes smooth all camera jolts
> - ifyou think ripples, wet shine, and sleeping island mist makes the game better, try it out in a worktree and give me before and after."

> "you have permission to adjust the fixed ending tune to fit better if you can think of better chord progressions btw. just make sure to give me comparison clips"

The climb keeps its length. What a recording of the whole summit measured, and what changed:

- **The credits pan** slid its look point in a straight line between two points 100 units away, so it hurried
  through the middle: 80 of its 92 degrees in ten seconds, peaking at 10°/s. It now pans and tilts like a tripod
  head on one sine ease, from three seconds after the child goes in to the music's fade (on the ending clock),
  and keeps the same start and final framing.
- **The last cadence** used to arrive faster and faster (5.1, 4.25, 3.75, 3.25 s) with four seconds of final
  chord. It now broadens (5.1, 5.5, 6 s) and the final chord rings seven seconds before the unchanged 0.7-second
  fade; credits follow two seconds later, at 124.85 s. Offered alongside for Jeremy's ear: the same broadening with
  a new approach home, B-flat maj9 and C6/9 over the held D in place of D/F-sharp and A9, before the approved
  Dmaj9 → Dadd9.
- **The entrance to the scripted ending** rises over four seconds from wherever the approach left the music,
  instead of stepping up by up to 5.5 dB. The shared reward bells no longer play at the updraft: their D major
  rubbed against the C-sharp on top of the ending's first chord.
- **Watching the family go** is a second shorter (`WATCHES_FOR` 15).
- **Camera jolts:** the family's arrival and the walk over the brow start from the rendered camera and ease onto
  their framing (`HANDOVER`, 5 and 8 s) instead of kicking to 10–16°/s; the goodbye view that followed the paper
  keeps its last motion for up to three seconds (`COAST`) instead of stopping dead in one frame, then holds.

`tools/summit-film.mjs` records the summit with the game's own audio on a fixed clock and logs the camera's turn
rate per frame; `tools/ending-audition.mjs` renders the ending score for side-by-side auditions.
