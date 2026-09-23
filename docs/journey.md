# The journey

Read this first after any context loss. It is the artistic vision and the plan, and it outranks convenient shortcuts.

Current island positions, direct distances and sailing-route lengths: [geography.md](geography.md).

## Jeremy's words (2026-09-16, verbatim)

> "I love your artistic thinking. Please explore your ideas and continue expanding ontop of this beautiful experience you've made. small cute animals and birds. I'd love to see the story you tell with the traveller. I would probably suggest getting an opus 5 sub agent to take a look at increasing the quality of the water to match the rest of the visual quality of the game. The grass visuals and effects are truly amazing, and i'd love to see the adventure go to a place where it's like those endless beautiful green rolling irish hills."
>
> "You don't have to use backlog items for this. [...] you may also use sub agents however you feel best to achieve your artistic dream of making dreamy, meditative game."

Earlier: sound is good and touch works beautifully; the core feel (wind over grass, petals, wind lines, the glider) is loved and must not regress.

## Jeremy's redirection (2026-09-16, verbatim)

This supersedes the shape of the first build. The island, the wind, the grass, the hills and the ending are kept; the arc around them is rebuilt.

> "My vision for the game is that there is a very dream like narrative. you start on the island. The player doesn't know how they got there. They touch the screen and discover the wind effect. however it's still not clear what they can do or what the game is about. They see the child following the plane around, but they don't yet know that this is the primary way of playing the game. So maybe they randomly play around with the plane. there needs to be some things on the island that the player has a good chance of accidently leading the child into which cause some kind of small effect or event to happen. However, the primary subject should be the boat and we need to set it up so that the player can intuitively learn or understand that they need to lead the child to the boat. One of the big problems right now is that the boat is BEHIND the island so the player can't see it at all. Infact, there's an issue where the plane and the child can disappear behind the island and the player has no idea what to do anymore. In terms of polish, when the child gets into the boat, the boat is filled with water (it's not floating on the water properly). It wasn't clear to me at all for example that i had to get 78% of the island alive before they climb up to the blooming tree. I do like the effect of the world coming into colour suddenly when "78% of the island" is coloured in though, see if there's a way to boost that.
>
> Everything the child does on the other side of the island, the player can't see at all, which is a shame.
>
> Along the way home, the child makes friends with some animals that keep them company. There should be simple and natural things that happen in the game that cause the bond between the child and the animal to grow stronger.
>
> The child isn't laughing and cheering when it flies high currently, thats a great idea that needs to be tastefully added. It's cool that they throw it by themselves as well. There's also an issue where the child too often stands still watching the plane while it flies instead of going after it.
>
> I like the long boat ride idea, and it's definitely something to explore, but I'm not sure about the beginning of the game (it's way too long, and the player can see the destination the whole way there so there's no surprise or delight).
>
> I'm not sure about the endless rolling hills being the destination at the beginning of the game as well. I may have over steered here when i gave this idea without letting the build agent think through the dream and waht would make most sense. The hills really do feel endless and there's no more narrative progression.
>
> At a high level in my head, I'm thinking that the journey should be filled with ups and downs, and throughout it all a profound sense of being lost and nostalgia, trying to find home with his animal friend. Maybe we can do something where the animal friend is also a little child animal that is also trying to get home, and so they have to get home together. Sort of like a heroes journey even for the child, where they get drawn into a world larger than they thought and have to face the darkness in their dream and get through it alone with just their animal friend/s. Maybe facing their fears, and then helping their animal friend face their fears. If you were dreaming as a child, how do you think your dream would play out? What would stay with you even after you woke up and make you feel like you grown up and become a different person?"

On the companion, answering the design questions: "fledgling crane. We can aim for a short 18 minutes now, but i'd eventually like to add another animal later one and make this a much more involved and immersive experience."

On the setting, rejecting both Ireland and Switzerland:

> "i mean what do you think? should it be swiss? I guess the opening theme is a bunch of islands, and that is sort of a metaphor for isolation and being lost. should we stay with that setting for a while longer? Does rolling swiss hills in full summer/spring fit with this? What other settings do you think really fit with the child's dream?"

> "on the laugh, i think there shouldn't be any voices or anything in the game. No sounds from either the child or the baby crane. There can be noises from other animals and environmental sounds, but never any voicing from the two main characters."

On the islands: "love all of these ideas, especially the island of lines! It's very surreal and dreamlike. Like the kid is dreaming of home, and it's manifesting."

On the island of lines, after it was built far too large (2026-09-17):

> "i think the island of lines is way too big now. What i really meant was it should evoke a feeling like they are
> lost and overwhelmed by everything on that island, but what ended up happening was that a massive island was
> created."

**Overwhelmed, not vast.** The feeling is being swallowed by somebody's washing, not crossing a landmass. Density
is the lever, not area: keep the lines and shrink the ground under them. **Done** (2026-09-17): `ISLES.lines` is
70 × 56, a low whaleback about 135 by 105 paces of dry land with a crown 17 up (since lowered to about 10, `tuning.world.linesDome`, after Jeremy found it too tall). The same 190 lines are packed into
a 46-unit spread over the middle of it, hung high (poles 4.2–5.9) so the hems clear the grass and the child walks
in under the sheets. The north beach is deliberately left bare, so the boat waiting on it can be seen from the
descent. The grass is only lightly grazed now (`croppedAt` takes 34% off, not 74%), which is what Jeremy asked for.

On the colt being hard to see in deep grass, when a session was busy trying to fix it:

> "It's ok if the colt is somewhat swallowed by the grass. It's somewhat clear enough that a bird landed in the
> grass. and the child going over to it and pausing does signal enough. The fact that it is difficult to see
> actually kind of helps give the feeling of a little baby bird that's lost"

So: half lost in the grass is how a fledgling that cannot fly is supposed to look. Where the child goes and where
they stop is the signal, not the bird's silhouette. Do not spend effort making it legible.

On the plane, and on never losing the thread (2026-09-17):

> "to help the player figure out where they want to go, the plane should tend to fly towards what they next need
> to do or go. e.g. if i make it fly quite high, as it's floating back down, it'll tend to steer towards where the
> player needs to go to continue the game. [...] I've found the boat on the other side of the island of lines, but
> i can't figure out how to get the child to go into it and row. The plane also tends to just get stuck in the
> water instead of steering back to land, or to a 'target', and i have to wind it back. It's a bit annoying."

> "when i say sweating the details, i mean stuff like making sure that the child and the characters are still
> legible and visible at all times. For example, at the other side of the island of lines, it's not clear how i
> get to the next island, and when the child goes down the hill on the far side, they aren't appearing in my
> camera anymore. It's not enough to think about it programmatically, we have to think about things from the
> perspective of what a child playing this game might see and feel."

On the becalmed stretch (2026-09-17):

> "maybe we can have a part where you get stuck because there's no wind, and you as the player have to be the wind
> in the sails of the boat. I think that would be cool if done well."

> "maybe not too early as part of the first crossing though. Let it auto pilot that stretch. We can do it a bit
> later maybe so it feels like things are getting a bit more 'scary' and the child needs to become braver. But
> whenever we do add the becalmed stretch, it should be visually and audibly clear to the player whats happening
> and what they need to do."

On leading the player, variety, the colt and the music (2026-09-17, verbatim):

> "I'd also like you to think more about the visual design and how we lead the player. For example, is there a way
> to very tastefully arrange the clothes lines to 'funnel' the player towards the points of interest without it
> being obvious. I'm also wondering what else we can add to the island of lines to make it more varied and
> interesting, not just the same set of clothes lines over and over again. Basically visual polish on each island
> and also ensuring that a child playing the game can actually figure out how to finish the game all the way
> through."

> "rethink the baby crane model so it's cuter, fully animated, and rides seamlessly and cohesively with the child.
> whether it's climbing ontop of the child's hoodie, or trying to fly, or animating while being held. Right now it
> looks like a plucked turkey when it falls from the sky (it needs to be improved)."

> "I'm also looking to make sure there's a part of the game where the player acting as the wind helps the baby
> crane fly down and reunite with their parents. This should be a pivotal, emotional scene."

> "I think different music for each island, or for each emotive phase of the game would be great. Right now it's
> the same music throughout the entire game (the music is great, but it gets too repetitive when its played whe
> whole way through)."

On the companion becoming a swan cygnet (2026-09-17, verbatim). This supersedes "fledgling crane" everywhere below;
the plan for it is `docs/cygnet.md`:

> "Unfortunately, the child's companion / baby crane looks too much like a chicken. is there a cuter baby bird
> species we can make it?"

> "yea i think a swan cygnet will work a lot better. Ugly duckling is exactly the feel i think this should go. As
> the child's companion, the swan cygnet is a co star in this game so all it's animations, sounds, behaviour, poses,
> how it flaps, falls/tumbles from the sky at the start, how it climbs ontop of the child, is carried by the child
> need to be super high quality, seamless and beyond reproach. It should feel like another real character with
> it's own emotions, thoughts, and liveliness. Especially with teh way it interacts with the child, it should look
> completely seamless and cohesive. This is a big piece of work that requires extreme attention to deail"

> "I'm also thinking that there could be a nice moment in the game where the little swan cygnet has their brave
> moment to swim by themselves next to the child, maybe a bit later in the game where it makes sense. Have a think
> as well about whether the swan cygnet should react to the players 'wind'"

On who does the visual work, when asked whether his model-routing rules (visual work only by Astra or Opus 5)
should bind the Fable session he gave the cygnet to: "I'm relying on you to make the right decision about what
works best. All i care about is that we get a great quality experience for the kids who will play this game. [...]
I care most about visual and animation quality, and attention to detail when it comes to this kind of stuff."

On the season: "i agree with the use of seasons. That's the heroes journey. But i dont think the still island should start in dead winter. It should be looming. thats why the cranes are migrating. It's why they have to find their way home before it gets too cold and dark."

On new rooms (2026-09-17, verbatim), answering a list of five proposals — see "Rooms still to come":

> "1. The sky mirror sounds like a cool idea to experiment with. almost like something out of spirited away.
> 2. The sleeping island is a really cool idea! and you get to play as the bird! great idea. So the child starts
> falling asleep, gets tired, weary, and the bird gets distressed and has to go and find a way to wake them up?
> flesh this idea out more.
> 3. Good idea, add this one in. You'r right, we don't have a transition from the meadows into an autumn before
> the forest.
> 4. The fog idea is cool, could this be added onto one of the other rooms? It does't feel like it'd work well as
> it's own room that you travel to on a boat
> 5. The wind harp is cool, but maybe it can be like a point of interest on the meadows level instead of it's own
> level.
> - coudl we add some pin wheels and kites to the island of lines? what do you think? or nah?"

Approving all of it, and handing over the build (2026-09-17, verbatim):

> "great direction and feedback. all approved from me with below thoughts,
>
> On the sleeping island room, i would make the paper aeroplane "disabled", whether it gets "blown into a tree and
> stuck" or the "child holds it with them", i would want something else to be blown around by teh player to guide
> the bird. You mentioned a feather, but im open to anything else that fits the theme as well. I'm also seeing the
> bed as being surrounded by fragments of a "bedroom" but in an abstract dreamlike manner (maybe even something
> upside down).
>
> And yes, it's being rebuilt as a swan cygnet.
>
> Because you seem to understand a good direction for where to take the rooms, I am giving you ownership over
> building all of this out. As you orchestrate the work, I would like you to do some quick visual inspection to
> ensure quality, otherwise opus 5 is just doing who knows what without any oversight."

And: "Anything you want to prototype and explore, go ahead. we can always iterate or trim what doesn't work."

After playing the cygnet, the swans and the rooms on `main` (2026-09-18, verbatim). Work from this is tracked in
`docs/cygnet.md` Status and in "Rooms still to come":

> "- What colour is the cygnet supposed to be? It is showing up as darkish grey / slate from what i can tell. I think
> it would also be really cute if the cygnet kind of fit into the child's backback more so it looked a bit more
> "comfy" and "snuggled" in.
> - I do agree that the raft of swans on a pond is better. And they shouldn't just "appear" like the wheeling family
> does. The player should see them as a point of interest. Whether you make the special interaction here with the
> cygnett something else related to swimming, or keep it to helping it fly i leave up to you, but if you keep it to
> trying to help it fly, make sure that it actually works (i was twirling my mouse and it wasn't flying - instead it
> kept wandering away).
> - The cygnet sounds great, the piano doesn't sound like a piano.
>
> Coming to the piano, as a player it wasn't intuitive. The child just sort of stands on it and then as a player you
> can move your mouse around and the piano makes some sounds, but nothing else happens and the player has no way of
> exiting either. If it's interactable, any ideas of making it more of a puzzle?
>
> On the autumn island of leaves, the leaves on the ground are behaving like the grass (when you blow them, they
> kind of just stick to the ground and move in place). I think this island could be a bit longer as well. It should
> be a bit "fun" as well with the cygnet jumping into a bundle of leaves and so on.
>
> The sequence on the forest island is a bit confusing, im not sure whats supposed to happen. As a player, when i
> move my mouse around, it causes the cygnet to fly up in an updraft.
>
> When i move my mouse over the water, the wind from my mouse makes the water look really oily and weird. My
> thinking is that the players wind should still draw the wind lines, and it should affect the wave geometry a
> little maybe, as well as make the boats sails flap more noticeably, but it shouldn't cause the water to look too
> much different otherwise."

On the meadow's opening (2026-09-18, verbatim, with a screenshot of the landing: green shore, grey interior):

> "we need to rethink two things on the meadows stage. 1) the shore being colourful and then the interior being grey,
> and then suddenly turning completely colourful when the level starts is a bit odd. Any ideas how to make this
> better? Should we keep the colouring mechanic here? or keep it auto coloured? Or any other ideas that fit within
> the theme of the game? 2) we have to be careful of the paddock / stone fences crossing perpendicular to the
> player's path. It reads to the player as "you can't cross here, go around", but they actually can go through. The
> level needs to be mindful about how it unconsciously communicates the direction the player needs to go."

Offered (a) the meadow already alive, with the first gust sending one great visible wave of WIND across it. His answer:

> "yea i think option (a) makes the most sense. I think we should also be a bit more careful about how we do the
> camera leading up to the meadows island, and also maybe have it so the child has to climb up a bit to see more of
> the meadow, otherwise there's no surprise left by the time they reach the island since they saw the whole thing
> from the boat already.
>
> Alternatively, im wondering if we can use the piano as the key. So the whole island is gray, but the piano is in a
> patch of colour, which draws the player there. As you complete each part of the piano challenge, colour starts
> returning to the whole island, or maybe all at the end of the challenge?"

**Built and revised (2026-09-20): the piano is the key.** The island is grey, shore included, and the
landing bank hides the meadow until the child climbs it. A green patch marks the piano on the west rise.
A shallow saddle opens the sightline from the beach crest; the initial patch has radius 13 and a soft edge.
The child follows the plane to the stool and plays the meadow awake with the player's wind.

**Standing rule for every room: nothing long and straight lies across the route without a visible way through ON
the route.** A wall, fence, hedge or line across the path says "stop, go round"; one running along it says "this
way". Walls near a walk run with it or funnel toward it (a drove road), and any that must cross has a gap, stile or
open gate exactly where the path goes, readable from where the player first sees it. The worn path, the plane's
lean, flowers and gaps all agree.

On the piano as a puzzle (2026-09-18): "yea good idea for the piano as a puzzle, approved". The approved
**call and response** remains: rising, falling, then rising and falling together. The September 20 redesign
replaces invisible terrain-based input with a persistent outline above the keys, a ring at its starting end
and a repeated directional sweep. Trace that visible path with mouse or touch. Notes and the child's hands
follow progress along it; partial progress is retained, with no rhythm or exact-pitch requirement. Idle
players keep the invitation and a quiet demonstration; there is no automatic timeout or silent completion.

**Music brings colour.** The piano now stands at sculpted (-40, -830), overlooking falling ground. The playing
camera holds the child, keys and field together and sits slightly farther back after Jeremy's crest-view
feedback. The child's first note sends a wind trace into the grass; the player's answers plant colour as
their notes travel. Repeated quiet demonstrations do not spend the field's colour. Every answered sweep
sends a broad musical front from the piano: radii 45, 85 and 125, then the whole island.
The camera opens over the field for each answer and returns to the keys before the next invitation. Loose curling gusts, overlapping soft blooms and an uneven front of moving grass travel with the colour; the final lullaby restores the island while the
cygnet walks the keys. The final camera rises and widens with that wave, retaining the piano and child.
The meadow's grey hold is released only after the front covers it. The pond retains its later close reveal.
Competing wind sounds and gesture chimes are hushed during the duet; the piano remains present as the camera
pulls away. A completed piano checkpoint resumes beyond the puzzle.

Validation: `tools/piano-logic-check.mjs` checks gesture credit; `tools/piano-check.mjs` plays four real
mouse/touch sweeps and checks idle behaviour, guide visibility, the travelling wave and departure.

## Paper-plane routing audit (2026-09-21)

Jeremy found the child repeatedly chasing the plane past the visible boat beyond the washing door.
The shore already aimed throws and homing toward the boat's inland approach. The failures were shared:
low-altitude steering faded almost to nothing against the prevailing breeze, and most departure checks
(including their fallback timers) ran only after a successful pickup. Restoring the hidden shore also
left its fallback clock unstarted.

Walking flights now recover a definite course when a gesture settles, and spill outward speed at their
flight boundary so sustained wind cannot send them indefinitely out to sea. At a completed exit, reaching the
boat's approach commits the arrival: the child stops chasing, the paper flies down to a reachable spot,
the child collects it, then boards. Continuous wind cannot interrupt this pickup, and paper is never
teleported back from a distant flight. Required encounters still gate departure.

| Room | Audited destination / arrival |
| --- | --- |
| Still island | Free catch, then tree; companion rescue precedes committed boat arrival. |
| Lines | Paper held through curtains and door; inland boat target beyond the door; fresh and restored arrival. |
| Little boats | Paper stowed; fleet encounters and scripted boarding own navigation. |
| Meadow | Pending piano, route/crest, pond, then departure shore; throws and homing share the same target. |
| Birches | All four pending scarf stops take precedence over later route markers; completed scarf permits departure. |
| Drowned / wood | Paper stowed or storm-driven; ember path, snag recovery and drying own progress. |
| Sleeping | Paper held; companion and feather own the encounter and departure. |
| Mirror | Initial throw toward the wand bowl uses committed pickup on arrival; paper stays stowed between stars and at departure. |
| Home / crossings | Authored walks and sailing; final paper release remains free of guidance and arrival constraints. |

`tools/plane-routing-check.mjs` exercises real actors and flight at 30/60/120 fps, four shore wind bearings,
a gust, sustained-wind arrivals, offshore recovery, every scarf route cursor and required-encounter gates.
`tools/meadow-route-check.mjs`, `tools/meadow-plane-check.mjs` and `tools/sky-mirror-logic-check.mjs`
cover the long walk, pond recovery, playable flight bounds and mirror progression.
The production build passes. Browser review of the new pickup movement remains pending; another full
playthrough held the shared capture slot during this audit.

## Island visibility and relocation (2026-09-21)

Crossings now show their departure and destination rooms only, including their reflections. Little Boats,
its portal shore, the mirror and Home have moved; Home is beyond the mirror and clear of the wood.
Ordinary crossings measure about 59 seconds to Meadow, 38 from Wood to Sleeping, 93–96 through the sea
encounter and 39 from Mirror to Home. Jeremy’s follow-up caps the sea at 100 seconds: the swim is now
14 seconds, and the mirror and Home moved together to preserve the final crossing’s distance and pacing. Dolphins arrive later in small groups and dive forward before
the mirror develops gradually. Existing saves migrate to the new geography. Details, exact coordinates,
route distances and verification are in [geography.md](geography.md); its older recommendations are superseded.

## Crossing and companion polish (2026-09-20)

September 22 camera follow-up: Jeremy found changes of attention too fast and occasionally jarring.
The shared rig now eases into focus, distance and height changes as well as turns, with a calmer speed
limit and continuous velocity between staged views and orbits. Optional angle corrections wait longer
and require a sustained benefit. Boat tracking remains immediate, so gentler framing does not trail the
travellers. The authored encounters and exact doorway path keep their destinations and story timing.

Jeremy's follow-up sets the sailing language: normally behind the sailboat, panning toward meaningful
things, with the still island held through the departure corner. The drowned village should feel like
travelling through its streets. Ordinary crossings now stay close to astern; the first farewell looks
back at the island before a fourteen-second return to the route. The village keeps its travelling position
behind the boat and pans up to the approaching church. After the becalmed sail interaction it continues
down the channel instead of replaying the church reveal. The open sea starts astern too, opening beside
the boat only for the cygnet's swim; the whale retains its distinct encounter pan.

His portrait screenshot exposed a remaining failure: roof clearance lifted the camera into a steep view
down at the child, with a large empty-water foreground. The lens now eases beside foreground scenery;
remaining rises are constrained by the angle down to the traveller. The final-camera checks cover this
angle as well as visibility. The intended view stays near the water, with the horizon present and buildings
rising around the journey, rather than surveying the village from above.

Jeremy then asked for every island to be checked, especially the feeling of walking through a dark forest.
The wood now follows lower beneath the canopy, with less shoulder offset and a steady look toward the next
coal; lighting a coal no longer kicks the camera forward. Returning from the shelter follows an arc around
the child instead of crossing through them, and the extra room for a newly visible coal opens more slowly.
The fright, search and warm shelter reveal keep their staging.
The sleeping island's first glide stays on the bedside camera side through waking, removing two reversals.
The mirror eases its framing throughout the star sequence, including changes of walking destination.
Smoothed framing also keeps the primary subject inside an outer safety frame while secondary coverage settles.

September 21 cinematography direction, Jeremy's words:

> "it'd need to feel really nice and seamless throughout the entire game. Almost like there wasn't an
> authored system in place. We must maintain the seamless, dreamlike state as much as possible while also
> making sure we try to frame beautiful moments, scenes, and camera angles"

The shared camera now interprets attention and framing constraints beneath the chapter choreography.
Subject-relative turns ease around the travellers, retain their distance, and carry movement across rooms.
Small composition corrections need a sustained, meaningful benefit; idle time alone never triggers a pan.
Interactions settle onto their intended view. Placed views and delicate paths such as the pond, drawing
and doorway retain their staging. The whale and church name their focus through the shared attention
contract. Technical behavior and its bounded CPU work are documented in [engine.md](engine.md#cinematography-srccamerats-srccamera-directionts).

September 21 camera playtest: Jeremy found sailing, particularly the drowned village, held one angle for too
long. The shared rig was still running; ordinary crossings had used a close boat-relative composition since
`cbb7f88` (September 16), and the village drift likewise had no camera response to its church. The child's gaze
noticed landmarks that the lens did not. No recent global camera-disable change was found.

Ordinary crossings now open on departure, arc closer alongside the companions and widen toward shore, driven
by route progress. The whale gets a true pan and bounded coverage of both travellers and its body; swimming
takes priority. After the pod leaves, the sea camera turns toward the approach. The farewell joins the actual
sailing bearing. Boat translation uses a physical carry anchor, independent of changes of focus, and camera
side response uses elapsed time. The village descends among the roofs, turns toward the church and frames its
base and spire with the child before handing over to the lighthouse. Becalming keeps the current camera side
while bringing the sail closer, avoiding a swing through the boat. Knobs: `tuning.crossingCamera` and
`tuning.drownedCamera`. Focused checks: `tools/crossing-camera-check.mjs`, `tools/drowned-camera-check.mjs`;
their `*-browser-check.mjs` companions capture real passages, including pointer-driven sail recovery.

Jeremy's ordering review keeps the chapter sequence. He wants little boats to meadow under 60 seconds,
shorter open sea before the mirror and a short final ride home. He rejected per-crossing speed boosts.
Ordinary sailing is now 4.5–5.5 units/s with a top speed of 10; the meadow, sea and home breeze multipliers
are removed. No islands or routes changed in this speed-normalisation pass. [Geography and pacing](geography.md)
records measured timings and proposed physical changes, still awaiting a layout pass. The earlier route
edits remain; the underwater home channel still matches in both terrain implementations.

The family now begins its departure while the child is still standing on the meadow rise. The camera
holds the whole flock before the child approaches. The cygnet calls after the migration has begun; the
child neither frightens them off nor watches them knowingly reject their young. At the mirror, the cygnet
explores beside lights and bubbles and stretches its healed wings; see `rooms.md`.

The secret shore beyond the washing door is visible only in that chapter and its outgoing crossing.
The home jetty is withheld until `toHarbour`, legacy `toHome`, or `home`, including during the wood's exit.

At the approved speed, controlled checks measure little boats to meadow at 99 seconds, sleeping to
mirror at 152, and mirror to home at 122. Recommended targets are 50–60, 135–145 and 40–50 respectively;
these are not implemented route timings. The sea target now explicitly includes the post-swim dolphin
nudge, omitted from the earlier 115–125-second recommendation. Strong-wind simulation currently skips
that nudge; correcting the encounter departure gate is part of the proposed route work.
The dolphin leap and full 32-second swim remain; preparation
cannot start before 32 seconds, so strong wind does not skip the leap. Checks cover all eight current
passages, 30/60 fps, varied wind bearings, storm pacing and dolphin/swimmer camera projection.

## The storm passage (2026-09-19)

September 21: Jeremy asked for a bigger, more imposing lighthouse, as a child might imagine it in a dream.
It now stands 35.7 units above the water (2.6 times its former height), with a base 1.85 times wider.
The low boat view holds its crown and the travellers together; the raised lantern sweeps down toward the water.

Jeremy first requested 25–30 seconds from storm to forest. After playing that version, he revised the direction:

> "the storm doesn't last for long enough and the lighthouse is off to the side instead of being a central part
> of the journey. I'd be looking to increase the journey through the storm by 10-15 seconds. It should get really
> dark and scary by the time they get to the forrest island."

Then: "yea, you are the creative director here, do your best".

The passage now takes about 40–42 seconds. Weather starts 210 paces from shore, among the last roofs. The channel
bows east toward the lighthouse, passes its flooded base, then turns toward the forest; the added time is real
travel. The camera follows the lighthouse during the approach. Its warm beam sweeps rain, water, sail and
travellers, falters slowly, and goes out at nineteen seconds. The plane is taken at twenty-two seconds, with
roughly eighteen seconds of exposed water left. By the beach, the last sunset colour is gone: black trees, cold
rain and clouded moonlight. Nearby figures retain soft scattered light; lightning briefly opens the distant veil.

The boat spills excess drive above 5.8 units/s. Ambient wind still moves it; the earlier becalmed passage remains.
Lightning waits for established rain and darkness, with no flash in the first seventeen seconds of the preview.
Three delayed thunder reports build through the final stretch, with a stronger low rumble and audible midrange. The cygnet shakes as the rain sets
in, flinches at thunder, and nuzzles under the child's chin when the lighthouse goes out. The sail spills and flaps harder while rain slants across it.
The lighthouse cannot light embers or bypass the forest's light mechanic.

Crossings recognise a waypoint passed within its channel, and the boat eases its speed in tight turns and on the
approach to a mooring. The last village waypoint no longer remains a target while a timer runs. `toWood` is kept
only to resume old saves; new journeys go directly from `drowned` to `wood`. Navigation and pacing checks:
`node tools/boat-check.mjs` (real boat/chapter code, controlled wind, 30/60fps). Visual capture:
`node tools/storm-check.mjs /tmp/updraft-storm`, with `W=390 H=844` for portrait. Live captures reach the beach
in about 41.6 seconds; the plane disappears into the weather before the final approach.

## The dream

A dreamy, meditative game about being the wind. A Ghibli afternoon: soft light, slow time, small kindnesses. The player never fails, never waits on a timer, never reads a word. Every gesture is answered by the world.

What the journey is *about*: **something small trusted the child, and the child went into the dark first so it wouldn't have to.** That is the moment a kid feels changed — not being brave for yourself, but being brave in front of someone smaller. And then letting go of what you loved and being glad.

Principles:
- **Beauty first, and beauty from simulation.** Light, colour and motion come from shaders and the live wind, not from a pile of assets. Every new thing must match the grass and the golden light; if it doesn't, it isn't finished.
- **Wordless, and almost voiceless.** No text on screen, ever. The child never makes a sound at all. The cygnet is
  silent too, **except at a handful of critical moments** — when it is in distress, or when it is warning the child
  and the player of something. Because everything else is silent, those few small cries land like nothing else in
  the game. They are the only voice in the story, so they are never spent on anything ordinary. Other animals and
  the world are as loud as they like. Meaning is carried by light, colour, music, the child's body language, where the child looks, and the drawing on the paper plane.
- **The player pushes what they see.** Wind reaches what is under the cursor on screen.
- **Never let the player lose the thread.** The subject is always in frame, and this is enforced, not hoped for.
  `CameraRig` measures the ground along its own line of sight and answers it — coming in closer first, and rising
  only if that is not enough, because a camera that solves every hill by climbing ends up looking down on the game
  from somewhere over it. The washing on the island of lines dissolves where it stands between the camera and the
  child, for the same reason. A player who stops understanding what to do is the only real failure state this game
  has.
- **The plane is the signpost.** It leans toward wherever the story wants the player next — the current waypoint,
  the tree, the boat — and leans harder the higher it is, so a throw that goes up comes down nearer whatever there
  is to do. Over water it turns for land whatever height it is at, and a plane that does come down on the sea
  picks itself up on a gust of its own and flies back. Nothing the player has to go and retrieve, ever.
- **Nothing is lost, nothing is failed.** Things drift home, the child waits, the world only grows more alive.
- **Teach by accident.** The player should discover that they lead the child, rather than be shown it. Everywhere the child arrives, something small and delightful happens.
- **Calm pacing.** Beats wait for the player; transitions are slow and continuous; the camera glides.
- **Dream logic, not explanation.** You never learn how you got here. Things recur in the wrong place, and nobody remarks on it.
- **The dream is manifesting home.** Every island holds a piece of home, out of place and with nobody in it: washing on the line, chimneys with no house, a village under the water, a bed in the grass. The child is dreaming their way toward it and the dream keeps handing them fragments. That is where the nostalgia comes from, and it is why the real cottage at the end lands.
- **Nowhere real.** No country is ever named or recognisable. Ireland and Switzerland were the same mistake in different accents: the moment a player can place it, the dream becomes a travelogue. Rolling green, yes; dry-stone walls and chalets, no.

## The spine

**The child isn't travelling home. The child is taking a lost fledgling to its family — and only at the very end does the player find out they were walking home the whole time.**

When the island comes back to life, a skein of white swans crosses the eastern slope toward the north. One small one can't keep up and comes down in the grass. The flock goes on. The child picks it up, looks at the boat, and pushes off.

This carries the whole game:
- It gives the player a legible, wordless goal without a word of text.
- It gives the boat a reason to exist that the player understands, so leading the child to it is intuitive.
- It makes north mean something.
- It makes the ending a real reveal. You thought you were on the bird's errand; then the drawing opens and it is a white cottage with a red door, and it is in the valley below you. The child never told you what they wanted.

Two lost children: one who can't find home, one who can't fly. Both fears are faced, and the player is the answer to both — because flight is the player's verb. The fledgling flaps and drops on the island; glides a few metres on an updraft in the hills; is too frightened to come out in the dark; and at the end, one updraft and it goes, and the flock comes down through the afternoon light for it.

## The year

Winter is **coming**, not gone. That is why the swans are flying, why the fledgling has to catch up, and why the journey has a clock without ever having a timer. The light and the warmth are draining out of the world ahead of them, and home has to be reached before the cold closes in.

The season deepens island by island and never goes back: late autumn, a bright windy day, the last warm afternoon of the year, deep autumn, the first winter storm, a clear frozen night. The child leaves in autumn and arrives in winter, a year older, in one dream. Light can return without reversing the season: the sleeping island earns morning, the sky mirror suspends time, and home holds afternoon until the child walks down to the door.

The grass keeps the green it is loved for — it just ages. Colour returns to the still island as green going gold, not spring green, and each island afterwards is a little further through the turn.

## The story: the islands

Every room is an island, bounded by sea on every side, so you can always see its edges and always know you are
getting somewhere. Home is an island too: not a continent to arrive at, just a small place with the light on.

**Crossings vary.** There is no rule that each one is shorter than the last — that was a tidy idea that cost the
sea its best sequence. Some are short blind hops between islands that are almost touching. At least one is long
and open and full of life, and it earns its length by being the exhale after the worst part of the journey.

**The player must never be able to see the next island.** A veil (`uVeil` in `world/atmosphere.ts`) dissolves the
world past a distance each chapter chooses, and it ignores height, unlike the ground mist. From the first island
the second is a smudge on the horizon and nothing more. Chapters set `haze`: about 0.85 on the small islands,
0.55 on the meadow.

1. **The still island** (`story/island.ts`) — grey, dawn, late autumn, no wind. The child and the paper plane, the
   boat in the cove. The first gesture is the first breeze in a long time; colour comes back wherever the wind
   goes; everywhere the child arrives something small happens; and when the island is whole the whole frame lifts
   at once. Then the skein comes over and the cygnet falls — see below. **Built.**
2. **The island of lines** (`story/lines.ts`, `world/lines.ts`, `world/lines-passage.ts`) — a green
   whaleback swallowed in washing, the first impossible fragment of home. **Reworked on Jeremy's September 19
   playtest:** he could not see the family among all the other lines, the camera pan gave way to chasing the plane,
   and the island felt too small. He asked for about 15% more physical length and approved opening a way through
   hanging sheets: “capture that perspective of that child like feeling of being sort of lost in another world
   within all of the hanging clothes”.
   The island is **15% longer north–south**, with the south landing and width retained. Dense washing follows the
   longer, winding alley; the camera travels beneath it, near the child's height. The paper stays in the child's
   hand through three curtains across the path. Broad sweeps lift a hem; several small sweeps add up, with no
   direction test or lost progress. The cygnet approaches, goes through first, and looks back for the child. At
   the second curtain two sheets overlap. A completed sheet remains overhead until both are safely through.
   **No automatic opening:** Jeremy asked for an invitation instead of a timeout. The first sheet repeats warm
   sideways brushstrokes across its face, distinct from the updraft coils. They fade during a real cursor/touch
   sweep and return if needed; they generate no wind or progress. All three sheets wait for the player's wind.
   The final sheet reveals a clearing, one low line with two adult garments and the small yellow jumper, and
   **the red door**. The released breeze brings their sleeves together, and the door opens.
   After Jeremy found the reach creepy, the gesture uses soft fullness and small, broad cuff movements:
   blue begins, red follows and yellow answers. The cloth stays pegged, without pointed arms or an inflated
   torso, and the door waits until the sleeves have nearly met. It plays the opening island's completion phrase
   once at that moment; the individual sheets retain their smaller response.
   This is the reward, with its own held view; finding three garments in the crowd is no longer the puzzle.
   On seeing the first build Jeremy still found the line too easy to miss. **Colour identifies it:** rich blue,
   warm red and the child's yellow belong to these three; nearby laundry stays pale linen, and pinwheels stay
   outside the clearing. The passage sheets share a red sewn hem so their distinction is learned on the way.
   Daylight stays across the island; the piano's dimmed-world technique is not repeated.
   **The door is the only way onward.** Jeremy's next brief: the round island makes walking around the sheets
   seem possible; opening the door onto another place would feel “like alice in wonderland almost”. Beyond it
   he originally wanted only the special family clothes, the kite and the boat. `world/doorway.ts` renders that separate shore
   inside the opening. Outside the frame there is sea, with no departure boat or onward land. The cygnet and child
   pass through first; the camera follows continuously, then the forest of washing is gone. **September 21:**
   Jeremy approved removing the repeated family line from the destination. The family stays beside the red door;
   beyond it is an open grassy landing, the kite and the waiting boat. The child throws the plane and the voyage resumes.
   Safe checkpoints follow the first and second curtains and the completed threshold crossing; the existing `family`
   checkpoint migrates older north-beach saves to this shore. Feel and crossing timings: `tuning.linesPassage`.
   Verified with `tools/lines-check.mjs`: full mouse passage through all three curtains, doorway and boat departure;
   portrait doorway/resume; migration of the old family checkpoint. Render checks cover the boat's exclusion from
   the washing island, ordinary laundry's exclusion from the shore, and matching reflections. Doorway frame times
   in local Chrome: median 16.7 ms, p95 18.2 ms. Curtain tests cover touch and holding the first sheet closed beyond 50 seconds without input.
   Landscape and portrait captures inspected; typecheck and production build pass.
3. **The meadow** (`story/meadow.ts`) — the last warm afternoon of the year, and the island is asleep. The boat
   lands in a bay under a bank; the child climbs it, and the first sight over the top is a grey meadow with one
   patch of colour in it and a piano standing there, on the way and about a minute off. Every note the wind finds
   on it sends a trace up the hill that greens the grass it runs over; the lullaby wakes the rest in waves, and the
   camera rises off the piano to watch the last of it roll toward the crest. The long walk follows the plane
   through a sun shower, over the brow, where the pond is revealed lying on the open slope below, and down to it.
   **Built**, and still needs the cygnet's first glide on the player's updraft.
4. **The drowned village** (`story/drowned.ts`, `world/drowned.ts`) — the long dusk drift between rooftops, a
   spire, treetops, a turning weathervane, herons on chimneys, autumn leaves on black water. Homes the water took.
   A third of the way through **the air dies**: the boat loses way between two gable ends, the sail hangs dead off
   the boom, the water goes to glass and the world goes quiet, and nothing moves again until the player puts wind
   in the sail themselves. It is the first time the journey needs them rather than answering them, and it is the
   held breath before the weather. Then the storm gathers and takes the paper plane out of the child's hand, and
   they reach after it and it is gone. **Built.** The drift *is* the crossing: there is no separate one before it.
5. **The dark wood** (`story/wood.ts`, `world/wood.ts`, `fx/embers.ts`) — the first winter storm, at night. There
   is no grass to bend and nothing to throw, so the wind does the only other thing it can do: it breathes on fire.
   The player fans embers awake out of the leaf litter and the child walks on for exactly as long as there is
   light, and stops the moment it goes out. Halfway up, the storm frightens the cygnet out of the satchel; it goes to
   ground off the path and calls, and the only way to find it is to put light on it. The plane is found sodden in
   a branch further on, loosened by wind strokes, collected after it falls and dried in the wind. **Built.**
   **September 19 polish:** no waiting timer lights an ember, finds the cygnet or dries the plane. After five
   seconds, warm sweep traces demonstrate the gesture at the waiting ember (and later the held plane). These
   traces never write wind or progress. Ignition requires deliberate motion across the visible ember; residual
   gusts and decorative sparks cannot complete it. Ember steps are 20.25 units along the path, 35% farther apart.
   The approved ember is an abstract orb of living light: a warm heart wrapped in translucent golden wisps.
   It breathes quietly, stretches with a gust and opens as it wakes. See `docs/polish.md` and
   `assets/art-direction/wood-ember.png`; literal fire and scattered fragments were rejected.
   Under the trees, 240 small green-gold fireflies occupy a 25-unit radius; the storm no longer hides them all.
   The points of interest remain the first ember, the lost cygnet, the wet plane and the waiting boat. The rescue
   is the central gate, followed by repairing the plane; there is no separate combination or order puzzle.
   **September 20 local review:** the wet plane is caught in an exposed tree fork. Deliberate strokes slip it
   loose, echoing the scarf knots. It flutters down and stays on the ground until pickup; ordinary flight physics
   previously let ember-fanning blow it away and strand the child. Jeremy approved the moonlight level and requested one
   scripted flash and clap to frighten the cygnet into a visible jump and run to a nearby rock shelter. The ember
   waits concealed inside the rock gap until the camera turns toward it. The child coaxes the bird outside
   before picking it up; the reunion has no completion jingle. See [wood.md](wood.md) for the staging,
   “Care becomes courage” and validation.
6. **The long crossing** (`story/crossing.ts` with `dolphins` and `duskTo`) — the intermission, and the only
   crossing that takes its time. They come out of the dark wood and stand a long way out into open water; the
   night ends somewhere along it, and the sea is alive: whales, a pod of dolphins running with the boat, fish,
   birds. Nothing is asked of the player except to sail. **Built** — `fx/sealife/dolphin.ts`.
7. **Home** (`story/home.ts`) — warm afternoon for the farewell and drawing, night after the child returns indoors. **The reunion**, staged in four beats: the child stands the
   cygnet in the grass and steps back; it **tries twice by itself and drops both times**, so the player is shown
   rather than told that nobody else can do this; it calls north and nothing answers; and then the player raises
   the wind under it and holds it there. The moment it has the air, **the family comes down through the sunlight and
   wheels low over the hill** — a short, close thermal column a little to the north, framed from the child's
   shoulder so the sky is most of the frame — and the music, held back since the wood, comes back with it. The
   player is still holding the updraft through the whole reunion: they do not watch it happen, they are the reason
   it happens. Then they go north together. The child walks on, sees the house, and unfolds the plane. The drawing and
   real house share the frame with a visible sun matching the picture when the motif begins. After the release,
   sunset begins while the child watches the plane depart; night and fireflies arrive before the red door opens. Beside the cottage hangs
   the family washing from the island of lines: blue and red adults, the small yellow jumper between them.
   The cygnet found its family, and the child belongs here too. See [ending.md](ending.md). **Built.**

Crossings between them are all one class (`story/crossing.ts`) taking a route, a haze, what to look back at, a
whale, a pod of dolphins, a storm, and where the time of day ends up. `story/journey.ts` runs the order:
island → toLines → lines → toBoats → boats → toMeadow → meadow → toBirches → birches → drowned → wood → toSleeping → sleeping →
toMirror → mirror → toHarbour → home. The drowned chapter includes the storm passage and forest landing; it has no separate crossing.

**Only the first island was ever grey.** Everything north of `LIVING_BEYOND` (`world/atmosphere.ts`) is already
living before the child reaches it, so nothing snaps into colour underfoot when a chapter starts — that pop was a
real bug and it is what `uLivingBeyond` exists to prevent. The meadow is the one island held back from it
(`life.regions.waiting`), because its green wave is a beat the player causes. In the same spirit, `main.ts` eases
the time of day, the haze and the rain toward whatever the current chapter asks for rather than taking them from
it, so a chapter change is never a cut in the sky.

## Rooms still to come

**September 19 additions:** Jeremy selected the island of little boats, the sky mirror and the stairs in the
clouds. Their ranked concepts and the authorised little-boats build are recorded in [rooms.md](rooms.md).
The little boats are implemented after the washing, before the meadow, including three sheltered swims
alongside the toys. The sky mirror is implemented locally; the stairs remain planned.

Jeremy approved all of this on 2026-09-17 and gave the orchestrating session ownership of building it. How it is
being built: each piece is one bounded parcel given to an Opus agent in its own worktree under `/private/tmp`
(`updraft-birches`, `updraft-linestoys`, `updraft-piano`, later `updraft-sleep` and `updraft-mirror`); the
orchestrator looks at a handful of screenshots from each before accepting it, and merges to `main` itself. The
sleeping island waits for the swan cygnet rebuild to land, because it is built on the companion; the sky mirror
waits for the water-shading session, because it is built on the sea.

| piece | state |
| --- | --- |
| *all three below* | on `main` (2026-09-18, merged from `rooms-trial`). Left over for the next brief: from the birches' crest the drowned village's roofs ghost through the haze, which breaks "never see the next island" — raise that chapter's `haze`. |
| the autumn birches | **built** and accepted on a look at its screenshots (`world/birches.ts`, `fx/leaves.ts`, `story/birches.ts`, `?chapter=birches`). Known weak spot: a gust lands where the cursor meets the ground, which from the walking camera is often far up the ride, so the cloud it tears off can be small in frame. |
| kite and pinwheels on the island of lines | **built** and accepted (`world/kite.ts`, `world/pinwheels.ts`): a red-footed paper diamond with a bow tail tied off beside the boat, and rows of two-tone paper wheels a gust runs down. The kite flies leaning rather than upright, because its spine lies along its string. |
| the piano on the meadow | **built** and now the key to the room (`world/piano.ts`, `story/piano.ts`, `?chapter=piano`): it stands on the walk in the one patch of colour on a sleeping island, the child sits at the stool, the duet wakes the meadow phrase by phrase, and on the whole lullaby the cygnet climbs out onto the keys and walks them while the island wakes to the hills. **Nobody has heard it yet** — the tone was synthesised blind and needs Jeremy's ear. |
| the sleeping island | **built; polish approved September 20** (`?chapter=sleeping`). The child sleeps, the cygnet tries to wake them, and the player brushes a feather free after its unanswered call. The feather leads the assisted climb; gentle circles at the summit lift the healed bird into its first glide. Morning follows it to the bed. Neither feather release nor takeoff happens on a timer. A physical ribbon tug releases morning from the summit window; the winter ascent includes a snow-choked notch and fog passage. The bed, framing, winter ground and mist have a local polish pass; see `docs/contracts/world.md`. |
| the sky mirror | **implemented locally (2026-09-20)**: wind blows bubbles across fallen star reflections, then lifts the lights back into the sky; the plane leads the walk to the far pier; see `rooms.md`. |

The companion is now **a swan cygnet** (Jeremy, 2026-09-17), not a crane colt; wherever this document says colt or
crane, read cygnet and swans. The order the rooms would give:
island → lines → meadow → **birches** → drowned → wood → **the sleeping island** → the long crossing, with **the
sky mirror** as a stop on it → home. About two minutes each, so the whole runs nearer 24 minutes than 18.

**The autumn birches** — approved by Jeremy, between the meadow and the drowned village. Deep autumn: the step
from the last warm afternoon to the dusk and the storm, which the arc did not have. An island of gold birches, and
the player's gusts strip the leaves off in clouds. The trees stay bare afterwards. On the first island the player's
wind brought the colour back; here it takes the last of the year away, and nothing the player does can avoid it,
because every gesture is a gust. The fragment of home is **a swing on a branch with nobody on it**: the wind pushes
it, the child climbs on, and the player finds they are pushing a child on a swing. The fledgling chases leaves
(bond). This is also where a second companion would join, later.

**Built** (2026-09-17): `ISLES.birches` at (0, −1120), 60 × 50, a low crest with a bare beach at each end;
`world/birches.ts` (about 170 instanced birches on a tree table the strip is written into, a canopy of gold tufts
that the wind takes off tuft by tuft, a leaf floor that runs before a gust and bursts up round the child's knees,
and the swing), `fx/leaves.ts` (the leaves themselves: on the branch, in the air, down, and up again on the next
gust, never back on the tree) and `story/birches.ts`. Every tree's strip only rises; the prevailing breeze alone
trickles. The crossing `toBirches` is a short blind hop off the meadow's far shore, and the drowned village's
drift now begins from the birches' north beach. Music mood `birches`: slower than the meadow, falling a step each
chord and never coming back up.

**Rebuilt** (2026-09-18, `fb-birches2`, after Jeremy's playtest: the floor behaved like grass, the room was over
too soon, and it wanted to be fun). `ISLES.birches` is now at (0, −1128), 60 × 80: half again as long, with a rise
under the swing tree and a hollow beyond it (`BIRCH_RISE`, `BIRCH_HOLLOW` in `heightfield.ts`), so the walk has a
rhythm — arrival under the gold, the first heap against a fallen birch, the swing, the leaf play in the hollow, the
last thick stand, the bare north beach. The floor is no longer a fixed carpet: `LitterField` in `fx/leaves.ts` keeps
how deep the leaves lie everywhere on the island, and the wind lifts depth off it where it blows and lays it down
downwind, so the play leaves swept bare ground and new drifts behind it, heaps stand at an angle of repose and
settle lower and wider when they are burst, and feet scuff a track. The simulated leaves are taken by anything much
over the breeze (`tuning.birches.litterTakes`), skitter along the ground, stand up in the player's circles, rock as
they come down, never rest on bare sand, and are quietly moved back round the player when they settle far behind.
Four heaps (`BIRCH_PILES`). In the hollow the child sets the cygnet down at the deep one and it finds out what a
heap of leaves is: a look, a run, a dive in on its breast with the leaves up round it, a rummage (the new `delve`
act), a shake, and again — and it drops the lot to chase anything the player blows past it. It never flies here
(`mayFly`), the play has its own held shot, and it can never stop the walk. `haze` raised to 0.97 so the drowned
village no longer ghosts through from the rise, which was the note left over above.

**Birches polish (2026-09-19).** Jeremy finds the leaf-play sequence too scripted and wants the
cygnet to jump out of the backpack and play while the player carries on. `story/birches-play.ts` now makes local
decisions during the walk: hop down near a heap, run after gusts, scuff leaves, pause to rummage or shake, and
follow when the child moves away. There is no leaf-play chapter beat or camera cut; they gather before boarding.
Shore litter uses irregular patches and scattered strays, with a gradual distance fade.

Jeremy chose **an impossibly long red scarf**: “Think about it carefully, make it really beautiful.” One
continuous wool strip leads from the arrival beach through the gold canopy to the departure boat
(`world/birch-scarf.ts`). The existing island accommodates it, with a small glade around the middle tangle.
Lift a loop off a fork, circle the coils up and off a broken birch, draw a slipped loop sideways,
then draw the final bow outward. The child waits
at each tangle while the cygnet remains free to play. Partial progress holds; the ambient breeze cannot solve
them. Once freed, the scarf draws along its own length into the boat and becomes a red sail, carried onward.
Its stitched edges, tassels, folds and warm backlighting belong to the same continuous strip. The chapter's
veil is thickened to keep the drowned village out of the departure view.

Jeremy's first visual review: it looked like a curved ribbon, and should be much more tangled back and forth
among the trees. The revised scarf has thick closed hems, folded front and back surfaces, stockinette yarn
relief, and delayed, damped movement. Ten additional support birches carry irregular wraps at different
heights; the connecting lengths sag under gravity, double back across the grove and settle near the ground.
The middle interaction moves the camera closer, beneath the crossing lengths.

**First release physics (2026-09-19).** Jeremy found the released loop floating in mid-air. The curve morph
had no gravity; the authored sag and wool surface were not a cloth simulation. The first length now uses
`world/scarf-cloth.ts`: two connected edges, fixed 120 Hz steps, stretch/shear/bend constraints, gravity,
momentum, wind and contact with the terrain, nearby trunks, branch and fallen log. It extends from the free
beach tassel to the next tree attachment. Gestures slide the two fork supports toward the tip; completing
the lift carries the whole loop past the tip and down its outside before removing them, preserving the cloth's motion. Merely unpinning at the tip let the solved loop settle back onto the branch; the release now
keeps branch collisions active and is checked for re-catching for 20 seconds and after checkpoint restore. The scarf falls and settles instead of adopting a
second curve. Checkpoint restore settles released lengths before showing them. The other released
lengths now use the same solver, pinned at their neighbouring tree attachments (the last at the boat).
Their unthreading is guided: the second keeps its winding around a short broken birch, lifts every coil
above the cut top, then slips sideways clear before gravity takes over. The bow draws its loops inward
and down before releasing. The final gathering remains an authored movement along the strip. `PHYSICS=1 node tools/scarf-check.mjs` checks falling, settling, stretch, ground contact
and equal motion at 30/60 Hz, alongside the existing puzzle and departure tests.
`node tools/scarf-geometry-check.mjs` checks branch contact throughout partial progress, full-width clearance
around the broken birch throughout the lift, and the second released length’s settling.
Airborne leaves and detached canopy clusters are now thinned to roughly 40%, with a wider near-camera
fade and less enlargement in the distance, so gusts leave the puzzles visible. The resting carpet remains.

**Interaction polish.** Jeremy found canvas-like yarn, a skipped swing, a floating first support and a
second tangle passing through its tree. Yarn relief and colour contrast are softer, with a broad wool nap.
The first supports now slide on the visible branch until release. Gesture distance drives eased progress;
quiet wind traces demonstrate an upward sweep, a circle, a sideways pull and an outward pull. They never supply wind.

**Late scarf supports (September 21).** Jeremy found the knot near the end floating in mid-air, then asked
for variety after the first fix repeated the same fork and put a tree in the way. The slipped loop catches
on the upturned limb of a fallen birch lying beside the ride; its added standing tree is removed. The final
bow hangs from a low limb on a standing birch. Heavy loops droop below both collars. Visible supports share
their endpoints with cloth collision, and hems stay outside the wood during partial pulls. The slipped
loop's tails pass in front of the fallen limb so they drop clear after release. The four-stop order,
sideways/outward gestures and saved progress are unchanged.

**Wind invitations (September 20).** Jeremy approved one shared family of travelling gusts: a clear leading
wisp, uneven trailing strands, curling dispersal, readable width and brightness, and immediate handover to
the player's wind. The scarf uses those same sweeps for lift, sideways and outward gestures. His specific
direction for the wrapped trunk: “should actually require an updraft motion (circling motions)”. It now
requires sustained circles building the regular updraft charge and shows the same rising invitation as the
cygnet. Straight strokes across the trunk do not loosen it. See `docs/contracts/wind.md`, Invitations.

The swing stays optional and can be ridden only once. The child approaches the empty swing and lingers nearby; brushing
the visible seat invites the ride and pushes it directly, independent of the ground projection. Ignoring the
invitation continues the walk.
Keep making gusts to continue; leave the air quiet for 2.6 seconds to finish. The swing brakes, and the child
steps off near the bottom of its arc. There is no fixed ride duration. Completed tangles and the used swing
are checkpointed. `tools/scarf-check.mjs` exercises actual pointer gestures, idle gates, checkpoint restore,
the red sail and the swing's controlled exit; `NATURAL=1` also checks the walking route between tangles.

**The sleeping island** — approved by Jeremy, including the one call that nothing answers. After the dark wood,
before dawn. **The one room where the player leads the bird.**

September 20: Jeremy approved the [narrative repair](sleeping.md): “yep sounds good. approved. proceed
with implementing this”. It replaces the automatic curtain opening and walkable flight destination.

- The exhausted child yawns, sits, resists sleep, reclines and draws up the quilt on an open grassy terrace.
  The bird tries to wake them and calls once; nothing answers. This is the previously approved exception to
  the two protagonists' silence. The plane stays tucked away through bedtime and the reunion.
- A pillow stroke frees the white feather. Broad strokes encourage it along an assisted route, up the side
  of the hill; it stays near the bird. The winter follow-up adds a snow-choked notch between rock and drop, followed by a bank of
  mist across the grass shoulder, both cleared by broad wind sweeps. Faint wind wisps guide the ascent;
  natural rock exposures never form a marked road. Frost closes around the bed and its alarm clock stops.
  A brief shaft through the curtain slit makes the child stir, establishing why the bird seeks morning.
- The window holds a seam of morning above an exposed shoulder. Its curtains are tied with a ribbon whose
  loose end hangs beyond the lip. A side view shows the safe ledge, ribbon and drop. The bird reaches,
  hesitates, looks back and tests its healed wing; the bandage unwinds before flight is possible.
- Real circles lift the bird into a short reach for the ribbon. Beak contact and the physical tug release
  the knot. Wind alone cannot open the curtains. Having left the ledge to free the ribbon, it has no footing
  beneath it and glides home on the player's wind. Continued input supports the glide; letting go is safe.
- Morning spills from the opened window, clears frost and turns the island green along the return route,
  then spreads across the island. The bird lands; light reaches the pillow; the child wakes and gathers it
  into their lap. The long crossing begins in the sunrise the bird brought.

The role reversal remains: in the wood the child carries light to the bird; here the bird brings light to
the child. Its first flight *to* the child gives weight to flying *away* at the ending. See `sleeping.md` for
staging and comprehension criteria, and `contracts/world.md` for the curtain/contact and feather contracts.

**The sky mirror** — implemented locally; see `rooms.md`. After the dolphins and the brave swim, the boat
reaches a flat under a thin film of water. A child-sized soap hoop makes bubbles in the player's wind.
Sweeps skim bubbles across fallen star reflections; circles lift the captured lights back into the sky.
The paper leads walks between discoveries and the cygnet explores beside the child. The last light returns
them to the far pier, where their boat arrives through the deep outer channel. This replaces the rejected
stillness and moon puzzles: waiting cannot solve the room, the paper stays present, and the whole surface
remains an open mirror. The home drawing and the swan reunion still belong to the ending.

**Points of interest, not rooms:**
- *The wind harp, on the meadow* (Jeremy: not its own level). A piano standing in the grass before the crest,
  which the wind plays, on the meadow mood's own chime scale so it cannot sound wrong; the room's music pulls
  back near it so the player hears themselves. The bird hops along the keys. It replaces "a piano at the tide
  line".
- *The departure kite, first seen beside the opening boat.* Jeremy approved extending the Lines motif to
  every boat departure (2026-09-20): “the player learns to look for the kite flying in the sky as the location
  of the boat.” The same paper diamond, faded red foot and bow tail waits beside the boat on the opening
  island, Lines, little boats, meadow, birches, wood, sleeping island and mirror. No kite marks an arrival
  beach or the final home landing. Lines keeps its doorway reveal; little boats introduces it at the final
  bend, the wood at the opening, sleeping after the child wakes, and the mirror marks its far jetty throughout
  star play. The completed constellation still brings the boat in.
  It responds to wind without becoming another puzzle. `story/departure-kites.ts` places the tie-offs;
  `Chapter.departureKite` controls a room's reveal; `world/kite.ts` gives each kite independent wind and tail
  motion. Shore posts and tether lengths keep the marker in the desktop and portrait departure views.
  Pinwheels remain particular to Lines: a gust runs down their rows along the washing alley.
  Checks: `tools/kite-logic-check.mjs` and `tools/kite-check.mjs` (desktop or `TOUCH=1`).
- *The fog and the bells* were folded into the sleeping island (the fog) and dropped (the bells).

Other fragments of home for the dream to manifest: a red door standing in the grass with nothing behind it;
chimneys smoking with no house; a line strung between two rocks at sea. (The bed and the piano have places now:
see "Rooms still to come".) None of it makes sense and none of it is explained. That is the point.

## The crest: where the player is told what they are doing

Two thirds of the way across the meadow, past the piano and the rise beyond it, the walk comes over a brow and
this is the one moment the dream orientates you. The child tops the brow and stops. Below them, sixty paces on,
the ground falls away to a **pond** on a shelf of the open north slope (`POND` in `heightfield.ts`, drawn by
`world/pond.ts`) with the cygnet's family **resting** on it: a raft of white swans on still dark water, heads up,
one or two asleep, before they go on, and beyond them only sea and sky. (Cranes wheel up thermals; swans do not.
This was Jeremy's pick of three.) The pond was in a closed bowl nearer the piano until 2026-09-19; the family
lifting north flew through its rim, and Jeremy wanted it further from the piano, so it was moved out onto the
slope (`docs/polish.md`). **The veil stands thick here** (`tuning.crest.haze`, held from the brow all the way to
the boat) because everything north of the pond is open water with the next island behind it.

Nothing about it appears: the swans are on the water from the chapter's first frame, and the grown birds are heard
bugling on the walk. As the child approaches the bank, the nearest birds notice them, paddle away and start a
staggered takeoff north. The child reaches the water and sets the bandaged cygnet down. It paddles out after the
family, pauses to watch them leave, then returns to the child's waiting hands. Being gathered and stowed ends the
encounter; the paper leads them onward. There is no meadow flight practice or hidden retry timer.

**Jeremy's September 20 direction supersedes the earlier flight arc:** the child wraps the wing after the starting
island's fall. Gradually freer stretches show it healing through the early islands. At the sleeping hilltop it
looks back for the child, opens both wings, and the loose wrap comes away in the wind. The updraft then carries its
first glide back to its friend. The bandage's removal is a story beat, not a puzzle or an instant cure. See
`docs/cygnet.md`, “The recovering wing”.

No words, no marker, no objective text: you simply now know where you are going and what you are carrying. And
because the gathering lies the same way as home, it quietly sets up the ending, where it turns out you were
walking the child home the whole time.

## The fall, beat by beat

Opening polish approved by Jeremy, 2026-09-19: a beautiful hilltop view before the swans, a gradual camera move,
the actual cygnet visibly struggling in the V, minimal marks accompanying its ground calls, and a drooped sail
that answers cursor wind until a soft breeze carries the boat away.

1. The restored island draws the child up beside the tree. The camera rounds the eastern side during the climb, then
   looks across the slope with the child and tree on the right and open sky and water to the left. Hold this outlook for 3.5 seconds.
2. Eight adults and the cygnet cross the open sky toward the north, establishing the direction the boat will
   follow. Their flight lane is positioned from the eventual landing, so the baby has not passed that patch
   of grass when it loses height. The camera stays near the child, gradually tilting to hold the family before
   favouring the baby. The music pulls back; a quiet rising fourth accompanies the entrance, keeping the
   descending phrase for the fall itself.
   The distant haze conceals the next island throughout the aerial shot.
3. The companion's own body occupies the last station from the beginning. Over five seconds its faster wingbeats
   win one small recovery, then fade as it falls further behind and lower. The adult renderer reserves that station;
   separation never swaps one model for another.
4. The cygnet loses the formation and descends for five seconds, travelling forward onto the near slope while
   the family continues north. Its landing remains ahead along the flock's bearing, and its descent curve
   cannot overshoot and double back. The camera eases along the slope to follow the descent, keeping the island
   as a reference. No camera snap at separation. The descending music starts on separation without waiting
   for a musical beat and falls into the low register over five seconds. A final low D sounds on actual
   touchdown, then fades for 1.8 seconds. Distress calls
   begin with the fall; the impact sound is emitted on touchdown.
5. In the grass it tries to get up and calls. Three small cream strokes briefly echo each call above its position,
   fading between calls. The grass can still hide much of the bird; its call remains locatable. The same marks accompany the
   cygnet's calls throughout the journey, including while carried, swimming or flying; they fade with the call.
6. The child waits 3.4 seconds, runs toward it, slows for the last steps, kneels and offers their hands. Then they
   carry it toward the boat. The rescue is viewed from the side, and their shared patch of grass stays pressed
   through the lift so the hands and cygnet remain visible. The music returns at sea.
7. The cove shelters the sail from prevailing wind throughout the opening. Cursor gusts still fill and flutter
   it; without them it hangs in deeper folds. A small travelling gust brushes the cove as the child pushes off,
   and the shelter gradually releases once the boat is afloat. Cloth fills before the hull gathers speed.

The opening shots preserve their horizontal composition in portrait viewports by drawing the camera back.
Pacing, flight height and sheltered-sail controls live in `tuning.opening`; shared voice marks use `tuning.cygnetCalls`.
`tools/opening-check.mjs` supplies timed checkpoints to `tools/play.mjs`; it skips colouring only, then runs the
climb, flight, descent and rescue normally, recording framing, camera movement, northbound flight and forward travel through the
fall. `tools/opening-sail-check.mjs` checks real cursor strokes, relaxation and
the departure gust with a held opening-camera fixture. Screenshots belong in `/tmp`.

## The companion

Built as a general **companion** system, not a one-off swan, because more animals join later and the experience is meant to grow more involved.

A companion has: a body and gait, a place it rides on the child (arms, satchel, at heel), a bond value that only rises, and a set of shared moments that raise it. The bond shows in behaviour, never in a meter: distance kept, how often it looks at the child, whether it rides or walks, whether it sleeps against them at night, whether it comes when the child stops.

Things that raise the bond, all of them things the player causes or witnesses:
- The child picks it up, carries it, sets it down somewhere safe.
- It is fed, warmed, dried, or sheltered from the sun shower under the coat.
- It chases the plane and is cheered for.
- It is lifted by the player's updraft and lands safely.
- It is frightened and the child stays.
- It is lost and found.

The cygnet's arc is flight: flaps and drops, then glides, then cannot help in the dark, then flies. It has a second
bond, with the wind, which is the player: afraid of it, then curious, then asking for it, and at the end trusting
it to hold it up. And it has one brave thing of its own, the swim on the long crossing. Where it rides matters as
much: **in the satchel on the child's back** on the walks, where the camera behind them always sees it and it can
look back at the wind (cygnets ride on their parents' backs); **across the chest in both arms** for the tender
moments and in the boat; at heel on the short bare island of lines. It gets into the child's hands by itself:
they kneel and hold them out low and still, and it hops up. Later companions get their own single arc of the
same shape: one fear, faced once, caused by the player. The build is described in `docs/cygnet.md`.

## World layout (one coordinate space; the camera looks roughly north, −z)

The chain is in `ISLES` in `world/heightfield.ts`, written twice (TypeScript and GLSL) like the rest of the terrain.
Each island lies further north than the last with sea between, and the stretches shrink as home gets nearer.

| room | centre | size | sea before it |
| --- | --- | --- | --- |
| the still island | (−6, −14) | 60 × 44, its own hand-made shape | — |
| the island of lines | (14, −368.4) | 70 × 64.4, a low whaleback under its washing | 246 |
| the meadow | (10, −780) | 227 × 200, the old rolling pasture, now bounded: a two-thirds scale model of the 340 × 300 it was sculpted as (`tuning.world.meadowLength`, `meadowPoint` in `world/heightfield.ts`) | 196 |
| the drowned village | (−10, −1440) | 210 × 175, all of it well under water | 285 |
| the dark wood | (−30, −1800) | 130 × 115, the smallest of them, on a long shelving shore | 70 |
| the sleeping island | (−175, −1922) | 42 × 46, an open bedside terrace and a winter hill with a grassy shoulder above the fog, out west on the crossing home | 113 by boat round the wood's north shore |
| home | (−45, −2120) | 190 × 165, one long hill and the cottage beyond | 40 |

The still island keeps the south-east cove at (8.5, 21.5). The last hill is at (−30, −2060) and the cottage at
(−70, −2124), so the sun now sets into open sea past the cottage: home is an island like all the others.

Home is only 40 units of sea past the wood, which is nowhere near enough water for the long crossing to feel long.
Rather than move home, the route stands a long way out west and comes back (`ROUTES.toHome` in `story/journey.ts`,
about 650 units). The veil hides everything either side of it, so it reads as open ocean and not as a detour.

## Systems this needs

- **Moving world window.** The wind field, height texture, baked shadows, grass and petals cover a square that follows the camera. The terrain height is one function written twice, in TypeScript and GLSL, on integer-hashed noise so both agree.
- **Life.** A field over the window records how alive the land is, 0 (grey) to 1. Wind over land raises it; it spreads slowly and never falls.
- **Time of day.** Sun height and sky colours follow the story: pale dawn, bright fogged morning, golden afternoon, bruised dusk, storm dark, clear night.
- **The traveller.** A procedural child with a wind-simulated scarf, walking, running, throwing, sitting, sailing, carrying, driven by a story director. Silent.
- **Cloth on the wind.** Lines, sheets and hanging things that read the wind field and fill, snap and flutter: the sail's shader generalised. The island of lines is built on it, and it pays for sheets, flags and laundry anywhere else.
- **Companions.** The system above; the cygnet first.
- **The boat.** A small boat whose patchwork sail catches the wind field. Used twice: the crossing, and the drift through the wood.
- **Creatures.** Songbirds, gulls, rabbits, butterflies, sheep, goats, fish, a whale, herons, a murmuration, fireflies, and the swans.
- **Distance that reads.** Open ground with nothing on the horizon looked flat and streamed in badly. Every island wants a far silhouette with atmospheric perspective — the next island in the chain, standing out of the haze — and verticals in the middle distance. Being able to see where you are going next is the point of an archipelago.
- **Light on the wind.** In the dark room, gusts and updrafts fan embers and fireflies into brightness and carry them.
- **Music.** Layers join as the world comes back, fuller in the hills, thin and low in the wood, almost gone in
  the dark, whole at the end. Chapters can pull it back entirely with `hush` so a moment is heard on its own; the
  fall does this, and the music returns on the crossing that follows.
- **A room, a mood.** Every chapter names a `music` mood (`audio/audio.ts`) and each one has its own chords, its
  own pace, its own brightness, its own weight in the mix and its own scale for the chimes the player's gestures
  ring: open fifths that decide nothing on the still island, the brightest thing in the game on the island of
  lines, the fullest on the meadow, suspended and hollow over the drowned village, a drone and the semitone above
  it in the wood, a climbing bass at sea, and the only chords that come home at the end. The voices glide between
  moods over three and a half seconds, so a room change is a modulation and never a new track starting. One piece
  of music for eighteen minutes was the complaint; this is the answer.
- **The cygnet's voice.** `peep()` in `audio/audio.ts`, fired by the `distress` and `calling` cues. Distress is high
  and panicky; calling out to the flock is lower, longer and hopeful. Kept for those moments and nothing else.
  Where they are spent: `calling` at the meadow crest when the family is wheeling and nothing answers, and again at
  the very end when something does; `distress` only in the dark wood, where the calling out of the dark *is* how
  the player finds it. Nowhere else.
- **Light on the wind.** `fx/embers.ts`. Gust energy is breath on a coal: it wakes sparks in the leaf litter, they
  ride the wind and go out again. `uEmberLight` in `atmosphere.ts` carries the hot centroid, so creatures and the
  wood are genuinely lit by it — which is what makes finding the cygnet in the dark a thing the player does rather
  than a thing they watch.
- **Trodden grass.** `uTrodden`: a soft, noise-warped patch pressed flat where somebody sat down in it, so a
  fledgling in a meadow three feet deep is not swallowed whole. Used for the cygnet's first flight and the last one.
- **Being the wind in the sails.** `Boat.becalmed` takes away the steady drive the boat otherwise sails on, so
  only what the player puts into the sail moves it. The drowned village spends it (`STILL_AT`, `FILL_NEEDED`): the
  chapter eases its own `breeze` to nothing so the sea, the grass and the sound go with it, hushes the music to
  almost nothing, holds the sail slack in the middle of the frame and has the child look up at it. About six good
  gusts gets them under way; after 90 seconds the air comes back on its own, because nobody is ever stranded.
- **The player's wind stops during a scripted beat.** Chapters expose `scripted` for the beats the story plays out
  on its own. While it is set, `PointerInput.muted` puts nothing into the wind field at all: no chimes, no whoosh,
  no ripples on the water, no wind lines, and nothing the player does can blow the paper plane out of the scene.
  The pointer still tracks, and control returns the instant the beat ends. A scripted moment has to be allowed to
  land without the player accidentally performing over the top of it.

## What the first build got wrong (fixed)

- The boat sat at (−15, −61.5), behind a 13-unit ridge, and was never once on screen. It is now in the cove, in the opening frame. **Fixed.**
- Throws aimed at the island centre, so play drifted over the ridge and out of sight. Throws stay in the southern half and are reflected back at z = −24. **Fixed.**
- The child only chased the plane past 26 units, so they stood and watched. They chase from 8 and run when it is far or high. **Fixed.**
- `cheer()` was a pose only and was silently dropped whenever another action ran. It now interrupts, hops higher, and fires sooner. **Fixed.**
- The hull bottom sat below the sea plane, so the sea rendered inside the boat. Floorboards at local −0.24, draft 0.42, less bob. **Fixed.**
- The 78% life threshold was invisible and the restoration a 1.8-second fade. Global warmth is now held back until the island is whole, then released. **Fixed.**
- The player was never led to the boat. A `leaving` beat now frames it, the child glances at it, throws bias toward it, and landing the plane nearby boards them. **Fixed.**
- A laugh was added and then removed: the two travellers are silent. **Reverted.**
- Still open: the crossing is too long with the destination visible the whole way, and the hills are an endless unbounded mainland. Both are answered by the island chain.

## Build order

1. Engine: shared noise, world height function, moving window, GPU grass. **Done.**
2. The traveller and the paper plane. **Done.**
3. Life and the grey start. **Done.**
4. The boat, the crossing, the sea (surf, swash, seabed, glitter, mirror), whale and fish. **Done.**
5. The hills: terrain, the green wave, creatures, wildflowers, sheep, the sun shower, the murmuration. **Done**, to be reworked into the meadow.
6. Time of day, the drawing, the release, night, the cottage, music. **Done.**
7. **The island, made legible.** **Done.**
8. **Cloth on the wind, and the island of lines: built.** `world/lines.ts` and `story/lines.ts`; the island is
   cropped short so the washing is the only thing standing on it. Still to do: a billow curve so a lifted sheet
   keeps a belly instead of going edge-on, baskets and pegs and other things nobody left there, and a sun angle
   that does not leave the camera-facing slope in shadow. Original prototype note: the generalised cloth shader, poles and catenary lines, hung sheets that fill and snap, pieces that tear loose and fly. **Prototyped** (`src/world/lines.ts`, `?lines` hangs it over the still island). What it proved: a gust visibly lifts a whole *band* of washing as it rolls through, which is the effect the room is for. What it still needs: colours desaturated toward linen (the current palette reads as bunting, not laundry), a billow curve so a lifted sheet keeps a belly instead of going edge-on and disappearing, and above all its own island — over the still island's tall grass the lines are half-buried decoration, and they need bare, short-cropped slopes to be the subject.
9. **The island chain: built.** `ISLES` in the heightfield, the chapters sequenced in `story/journey.ts`
   (island → toLines → lines → toMeadow → meadow → toHome → home), the crossing generalised to take a route and a
   haze, the old hills chapter split into `story/meadow.ts` and `story/home.ts`, the dry-stone walls deleted.
10. **Superseded the same day by the swan cygnet (`docs/cygnet.md`); kept for what it learned about the crane chick.** **The cygnet: rebuilt (2026-09-17).** `creatures/cygnet.ts` with `creatures/cygnet/body.ts` (geometry, 18 bones)
    and `creatures/cygnet/shader.ts`. It is drawn the way a child would draw a cygnet: a round downy body, a big
    round head on a soft two-segment neck, large dark eyes with lids that blink, a short pink bill with a jaw that
    opens on each call, a cowlick on the crown that trails on a spring, stubby wings whose hand carries the first
    scalloped quills, and pink legs too long for it. Albedos are linear and it is never greyed with the land (it
    only exists after the island is whole, and the sea has no life field). What it does: breathes, blinks,
    glances (at the child more often as the bond rises), preens, pecks, shakes after landing, begs with a flutter
    when the child comes back or stands over it, sits down when left standing, tucks its head to rest, dozes off
    on a long calm carry, shivers and folds its head into its shoulders when frightened and only calms down when
    the child is near. It rides **on** the child: tucked under the right arm against the coat (visible from behind,
    where the camera lives), or perched on the right shoulder beside the hood, jostled by the child's starts and
    stops and bobbing with their gait; it is lifted from the ground, climbs over the shoulder into the hood, and
    hops down again, never teleported. The fall keeps the flock's line first, then flaps in bursts that pitch it
    up and sags between them, loses control in the last stretch and goes into the grass on its side; three tries
    to get up right it and fail. `tryToFly` is a crouch, three rising hops and a stumble; `soar` glides with the
    wings held and flares into a run on landing; `leave` climbs out with a beat that slows as it finds its
    strength.

10b. **Superseded note from when it was half built:** `creatures/cygnet.ts` is a rigged cygnet (body, neck, head and bill, folded wings,
    two-jointed legs) driven by bone matrices, with fallen / carried / hooded / following states and a bond that
    only rises. `creatures/flock.ts` is the skein that goes over. The island chapter now runs the beat: the flock
    crosses once the island is whole, one bird cannot hold formation and comes down, and the child gathers it up
    and carries it from there. Still to do: the first glide on an updraft, the flight at the end, riding in the
    satchel on the walks, and tuning — the cygnet still reads cream rather than cinnamon when backlit.

    **The fall is the moment the whole game turns on, so it is staged deliberately.** The skein comes over the
    child's head low enough to read as birds. The camera plants itself at their shoulder and looks up past them,
    so the player watches the sky *with* them rather than instead of them. The bird at the back of the V is the one
    that goes, and it goes when it is directly overhead, so none of it happens off screen. It takes eight and a
    half seconds to come down, wings going the whole way, sagging each time it tries to climb and cannot. It lands
    on the near side of the ridge. Then it tries three times to get up, each try weaker, and stops. The child
    stands still for two seconds and then runs. Music marks both: a thin high phrase going away for the skein, the
    same shape turned downward for the fall, and it does not resolve.
11. **The drowned village: built.** `world/drowned.ts` (27 houses on a drowned street grid, a spire with a
    weathervane that spins up in the squall, five herons that flush off the chimneys as the boat comes by, drowned
    tree crowns, leaves riding the water) and `story/drowned.ts` (the drift, the gathering storm, the plane taken).
    The island's seabed was dropped to about 7 units down: the sea shader paints sand and caustics wherever it can
    see the bottom, and a drowned village over turquoise shallows reads as a holiday.
12. **The dark wood: built.** `world/wood.ts` (about 2,700 instanced bare winter trees whose every branch is one
    camera-facing ribbon, a wet leaf floor, deadfall, all of it heaving on the live wind), `fx/embers.ts` (the
    light the player makes) and `story/wood.ts`. Grass is cropped to nothing over the island or it grows straight
    through the room. The wood's coast was shelved out because the first version came out of the sea as a cliff
    and a child in the dark could not get off the boat.
12b. **The long crossing: built.** `fx/sealife/dolphin.ts` — a pod that surges fore and aft of the boat in
    desynchronised lanes, porpoises in real ballistic arcs, and puts two riders on the bow wave. The route stands
    a long way out west into open water and comes back, because after the wood the point of it is not to arrive.
    The September 19 polish gives that relief room: a roughly 900-unit offshore route, about three and a half
    minutes in the current breeze. Larger dolphins spend longer swimming beneath the surface, with one near-side
    leap and a gentler nudge. The camera sees the child's face and holds the whole featured animal even in portrait.
    The pod moves ahead while the cygnet chooses a 32-second swim; the boat slows to stay beside it, and both remain
    in view. Dolphins, foam, wake and swimmer follow the same swell. The paper stays stowed while sailing. Distant
    land dissolves into the sky until the pod leaves and the approach to home begins. Feel knobs: `tuning.seaPassage`
    and `tuning.dolphins`. Verification: `tools/sea-check.mjs` (full GPU passage, desktop or `W=390 H=844`) and
    `tools/sea-logic-check.mjs` (wind, frame rate, framing, completion and old swim checkpoints).
12c. **The cygnet's arc: built.** The glide is `Cygnet.soar`, on wind sampled **at the cygnet's own position**, so the
    player has to hold the updraft over it. The meadow stages the discovery (`try` and `glide`): the cygnet is set
    down in the grass, tries by itself and fails, the child sits down to watch, and there is nothing else on
    screen. The flight at the end is `Cygnet.leave` — the one thing in the game that is allowed to go away.
13. **More nonsense:** baskets and pegs on the island of lines; a red door standing in the grass; chimneys with no
    house; a bed made up in the meadow; a line strung between two rocks at sea; a piano at the tide line the wind
    plays. The point is that none of it makes sense and none of it is explained.
14. **The turn of the year: begun.** Every chapter names a `season`, 0 late autumn on the still island to 1 on
    the frozen night at the end, eased between rooms in `main.ts` like the sky so no room change cuts. It reaches
    the grass so far (`uSeason` in `atmosphere.ts`, `grassTint` in `grass.ts`): more of the hillside goes over to
    seed and the green that is left goes colder, while keeping the green the game is loved for. Still to age: the
    trees, the flowers, the sky palette itself, and the light.

## Testing shortcuts

`?chapter=` starts later in the story: `crossing` (or `lines`), `washing`, `meadow` (or `hills`), `birches` (or
`autumn`), `drowned` (or `village`), `wood` (or `dark`), `sea` (or `dolphins`), `summit` (or `home`). Every start past the first island puts
the cygnet in the child's arms and cuts the camera straight to the chapter's own shot. `?dusk=0..2` overrides the
time of day; `?shower=0..1` forces the rain; `?grass=0` clears the grass; `?debug=wind` draws the wind field.

`tools/play.mjs` takes its query in the `QUERY` environment variable **without a leading `?`** — it is appended
after `?shot=1&`, so a `?` there silently breaks the first parameter and you end up judging a night scene in
daylight.

## Pacing

Measured by a scripted playthrough on 2026-09-16, before this redirection: island about 3 minutes, farewell half a minute, crossing just under 2, walk inland 8, ending 2 — about 16 minutes at 59 fps average. The target for the six-room arc is about 18 minutes, with no room longer than about 5.
