# The sleeping island climb

The cygnet's climb from the child's bed to the summit window, rebuilt so it stands beside the drowned village's roof run
and the room's own ribbon climax. Claude holds creative ownership (granted 2026-10-14). The room's current state and
rulings: `docs/chapters.md` § The sleeping island and `docs/contracts/world.md` § The sleeping island.

## Jeremy's brief, verbatim

2026-10-14:

> On the sleeping island, i feel like the cygnett's journey up the hill could be better designed. right now it's a bit
> too light e.g. one snow drift, and then a simple fog part. The "texture" of the encounter probably isn't at the
> desired quality bar anymore given the rest of the puzzles on the other island now. What do you think we can do to
> make it better?

Answering the first proposal (three stops, a reshaped climb, the mist turned round):

> 1. yes you can reshape the climb
> 2. I'm not sure i understand what you mean by "your strokes clear a lane back down the hill rather than up it". I
>    thought the climax here is the swan flying out to pull teh ribbon from the curtain and then gliding down to the bed?
>
> All your other suggestions are nice though, and as a polish point, i would make the feather naturally move a tiny bit
> faster as it leads the cygnet (currently it moves very slowly)
>
> If you can think of any other ways to make the climb a bit more dramatic that would be great as well. Do you
> understand what this chapter is trying to establish narratively? If so, can i leave the creative ownership of this to
> you? Any questions, ask me at any time

Rulings from this exchange:
- The route and the hill may be reshaped (2026-10-14).
- The climax stays the bird flying out to pull the ribbon and gliding down to the bed. Nothing on the climb competes
  with it; the climb builds toward it.
- The player's wind always serves the way up. The mist is not cleared back downhill (the proposal that confused him).
- The feather leads a little faster by itself.

## What the climb is for

The room is the wood turned round. All journey the child has carried and cared for the injured bird; here she falls
into a winter sleep and the room raises the fear that she might not wake, never implying she has died. The small
bandaged bird, alone for the first time, has to climb into the cold and the dark to bring the morning back to her.
The climb is where its courage is made: the night grows bigger, the bird smaller and more alone, and it chooses to
go on. Unwinding the bandage at the top is it giving up its protection for her; the light it brings down is the care
she gave it, returned. The emotional line across the climb: **hesitation, loneliness, commitment**.

What was wrong (captured 2026-10-14 from the `feather` checkpoint):
- Two stops, both the same verb (strokes), both pure removal: swipe until the obstacle is gone. Nothing is used with
  the body afterwards, as she walks the trunk, rides the sail and lets go of the swing on the roofs.
- No reveal: the window glows at the top the whole way, even "inside" the mist, so parting the mist shows nothing.
- No character: the bird walks, stops, waits, walks. The fear and the choosing are nowhere on screen.
- Nothing sets up the climax: the summit circles are new when they are needed, and the bandage has never mattered.
- The drift is a smooth white blob; the hillside a bare ramp with nothing at the bird's scale; the first climb frame
  looks nearly straight down at featureless slope.
- The feather leads at about 0.6 m/s on its own (`feather.ts`: forward speed capped at `0.6 + encouragement ×
  featherEncouragement`), so the walking drags.

## The climb, stop by stop

About two to two and a half minutes from the bed's edge to the summit with prompt input. Walking between stops
never runs much over ten seconds. Each stop is a storyboard: what the lens shows on arrival, what the bird does, what
the player does, what the bird does with it, and what the next view reveals.

**The window's rhythm.** Seen from the bedside (ruled: framed with the bed once before sleep, above the skyline with a
clear path for its light to the pillow) → hidden behind the hill's own shoulder on the lower slopes → found again from
the top of the step → lost in the fog → brought back through the fog by the player's strokes → ahead at the end of
the crest. Each return is a reveal; nothing about it is a marker on the ground.

**The stakes behind.** At three points the bird looks back: after the drift, from the top of the step, and in the
fog. Each time the bed is further below, smaller, and its lamp dimmer (the existing `cold` ramp tied to route
progress), until in the fog it is a pinprick. Each look is framed so the lamp shows beyond the bird by where the lens
already stands on that stretch, never by swinging round. Looks last about 1.5 s; they are glances, not stops.

**Weather climbs with it.** Snowfall thickens and the night's wind rises with height (route progress, never a clock):
seed heads and grass stream harder, flakes go from falling to driving, and the bird's feathers ruffle and it leans
into the gusts more as it goes. Its sound rises with it.

### 0. Leaving the bed (kept)

The existing `edge` beat: as far as the trodden grass, one look back, then the feather leads it on. The feather now
leads at a lively unhurried pace by itself (about 1.2 m/s, roughly double the current), with strokes still sending it
ahead faster (up to about twice that) and never back downhill.

### 1. The lower slope (no input)

Natural ground at the bird's scale: frosted tussocks and heather clumps, a frozen trickle it hops across by itself (a
small hop, its own decision), frost-shattered stones half buried, sheep trods across the steep face (seen from the bed
and the glide). A lone hawthorn bent by the wind stands near the drift; under it a rabbit lies curled in its form,
snow on its back, ears flat. The bird passes it; it never wakes during the climb (background life, no encounter). In
the morning, when the green reaches it, it sits up, washes its face and lopes off.

None of it marks a route (ruled: no stamped route, golden path, rock rows or kerbs).

### 2. The drift: hesitation (strokes)

A wind-carved drift fills a notch between rock and drop (ruled: the snow notch recalls the scarf). It looks like real
drifted snow: a wind crust, sastrugi ridges, a curled cornice lip on the lee side, blue shadow in its hollows and a
moonlit sparkle; never a smooth blob.

The bird tries it: walks in, sinks to its chest, struggles, backs out and shakes the snow off. Then it looks at the
drift and at the player's side of the frame, as the bird at the pillow does (no fourth wall: it looks at the obstacle
and the air, not the camera). Strokes across the drift lift spindrift off its crest in streams that run the way the
stroke went and settle downwind; the drift lowers in visible layers, each stroke taking a layer, and a grassy channel
opens between rounded banks. The bird goes through, leaving footprints in what is left. On the far side, the first
look back: the bed below, its lamp still warm but small.

### 3. The step: the wing (circles)

At a turn of the route, where the reshaped hill switches back, a frost-heaved bank: turf curling over a lip of rock,
about one and a half times the bird's standing height, too high to hop. Natural, part of the hillside, not a terrace.

The bird runs at it and hops, gets its chest to the lip, and slides back. It looks at its bandaged wing. The drawn
spiral invitation appears round it (the summit's invitation, the updraft the player mirrors). Circles build air under
it: below the threshold it rises on its toes, beating its good wing with the bandaged one stiff and half-lifted,
lopsided, and settles back (the same response as at the summit). With enough air (about two loops of a gentle circle,
`generous-wind` rules) it makes a lopsided flapping scramble up and over, lands, and shakes itself.

This is where the player first learns what circles do for the bird, and the first time the bandage costs it
anything, so at the summit the circles are known and unwinding the bandage is a choice that means something.

From the top: the reveal. The window's glow, far above over the shoulder, found again. Then the second look back:
the bed far below now, the lamp dim.

### 4. The fog: loneliness, then commitment (strokes)

On the shoulder the fog that has pooled round the bed all night climbs over the bird and closes. The window's glow
fades out behind it, the stars go, the flakes swirl in white. The bird stops, turns about, shivers, and calls once
into the white. Only the wind answers.

Then the fog thins behind it for a moment by itself (scripted, not the player's): far below, a pinprick, the bed's
lamp. The bird looks at it for a long breath (the third look back). It turns uphill.

Now the invitation. The player's strokes part the fog uphill (the existing `carve`), and the window's warm glow comes
back through the parted lane, brighter as the lane opens. The bird takes the feather into its bill (the existing
`catchFeather`, now the gesture of commitment) and goes on into the lane.

The player's wind only ever opens the way up. The fog does not hide the bird from the player; the lens stays close
enough that the bird reads in it at all times.

### 5. The crest: the wind (optional strokes)

It walks up out of the fog onto the bare crest and the fog lies below it like a sea, the bed lost under it, the
window ahead against the moonlit sky (an echo of the belfry over the drowned village's fog). The last ten to twelve
metres are a narrow rounded crest, the steep face dropping toward the bed's side and the sea beyond. The night's wind
is at its strongest: snow streams sideways, the feather in its bill streams, the bird leans into it and goes in small
braced steps.

The lens is low and to the side, the bird small against the sky and the glow ahead. Strokes up behind it give it a
tailwind (the existing `encouragement` mechanism): it straightens and quickens. Without them it still makes it,
slower and braced. It is never blown back, never slips, never in danger.

### 6. The summit (kept)

The existing `hilltop`, `unbinding`, `reachRibbon`, `pullRibbon` and `glide`, unchanged in meaning. The circles are
now familiar from the step. The bird lets the feather go at the summit as now.

## Mechanism

Builds on what exists; verify each before relying on it.

- **Route.** `SLEEP_PATH` (`src/world/sleeping-layout.ts`) grows from about 58 m to about 70–80 m with a switchback,
  keeping the bed, the window and `SLEEP_LEDGE` where they are. Stops become named indices (drift, step, fog, crest
  start) rather than `SLEEP_SNOW_STOP`/`SLEEP_MIST_STOP` alone. Walking targets only; the heightfield never imports
  the layout.
- **Ground.** `sleepingHeight` in `src/world/heightfield.ts` and its GLSL twin `hf_sleeping` (they must match
  exactly) gain the step bank, the narrow crest and the switchback's shoulder. The hill stays one continuous natural
  ridge; the bed is not in a pit; the face the bird glides down stays clear for the glide and the morning lane. The
  shoulder must hide the window from the lower slopes in the player camera while the bedside view still has it above
  the skyline with a clear path to the pillow.
- **Beats.** `SleepingChapter` gains `step` and `crest` beats between the existing ones; `snow` gains the try-and-back-out
  before input counts; `mist` becomes enclose → call → glimpse → invitation → part uphill → `catchFeather`. Every
  climb beat stays in the `climb` score phase (`get` at `story/sleeping.ts` line ~95, `tools/sleeping-score-check.mjs`
  line ~68, `docs/contracts/audio.md` `sleepingWind`). Progress persists per stop, as `snowDone`/`mistDone` do.
- **The step's lift.** The same circle reading as the summit (`twirlGain`, `k.needs`), with a lower threshold and
  `mayFly` kept false: crossing it plays a scripted lopsided flap-scramble onto the bank top rather than flight. The
  bandaged wing stays bandaged (`cygnet/bandage.ts`): the flap shows the good wing beating and the bandaged one stiff.
- **The fog.** `trail.fogEnclosure` and the shoulder bank (`uSleepMist`) must hide the window's glow at the fog stop;
  today the window shows clear above it. The glimpse is a scripted `carve` downhill toward the bed that closes again
  on its own (`carveCloses`); the player's strokes carve uphill toward the window as now.
- **The crest.** No gate. `feather.encouragement` from strokes behind the bird raises `k.pace` (already wired through
  `climbEncouragement`); the bird's lean and braced gait come from the world's wind at that height.
- **Feather pace.** Raise its unassisted forward speed in `feather.ts`/`tuning.sleeping` to about 1.2 m/s, keeping
  `featherLead` so it never runs out of sight, and `climbPace` so the bird keeps up without hurrying.
- **Invitations.** Each input stop shows the drawn invitation after idle seconds as the room does now; nothing solves
  itself on elapsed time. Wrong input is harmless (circles at the drift, strokes at the step) and never sets anything
  back.

## Rules (standing, from the room and the game)

- Cursor movement is the only verb; strokes and circles only. Nothing needs fast reactions; nothing fails; no crash or
  retry after the bird commits.
- Generous wind: random swipes near the target count; circles about two loops.
- The camera never jerks; look-backs are framed, not swung to. The child never looks to the camera; nor does the bird.
- No fourth wall; no narration; no voiced yawns.
- No snow play after this island.
- Nothing implies the child has died.

## Rejected

- **Clearing the fog back downhill to show the bed** (first proposal): confused Jeremy and sets the player's wind
  against the way up. The glimpse of the bed is the bird's own moment instead.
- **Wind piling snow into a ramp at the step:** physically nice, but circles at the step teach the summit and make the
  bandage matter, which the ramp cannot.
- **A gust stealing the feather on the crest:** reads as a loss or failure right at the commitment.
- **A robin keeping it company:** dilutes the bird being alone, which is the point of the climb.
- **A new mid-climb checkpoint:** the climb stays short enough to resume from `feather`.
