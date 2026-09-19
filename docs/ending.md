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

## Status (2026-09-18)

On `main`: the shelving shore and the shorter route; the jetty's deck and mooring (`HOME_JETTY`, `HOME_MOORING` in
`story/home.ts`, `Boat.mooring`, `Traveller.decks`; `?chapter=jetty` starts moored with the walk in to do) — the
jetty itself is not built yet, the child walks in on an invisible deck; the dolphins (merged from `end-dolphins`:
`tuning.dolphins`, `Boat.nudge`, `Dolphins.spotlight`); the cygnet's `fledging` state and `join`; the restructured
beats, cameras and timings in `home.ts`; the lush home grass; the finale (`Soundscape.finale`, cue `finale`,
`SoundState.silence`, everything musical on one `musicBus`) and the credits (`#credits`, `#again` in `index.html`,
copy in `docs/copy/copy-2.json`, awaiting Jeremy's verdict).

The fledging's visual pass is merged (`tuning.fledge`, `Cygnet.circuit`/`turnBack`, `SwanFlock.nextSlot`). In flight: the jetty model
(Opus 5 parcel: piles, planks, a post, something left on it that says somebody lives here; the boat comes
alongside its end bow to the east), then one full run from `?chapter=sea` through the credits to check the whole.
