# New rooms

Jeremy, 2026-09-19: “I like the island of little boats idea, as well as the stairs in the clouds, and the sky
mirror.” Then: “record these three somewhere in the docs, and then proceed with building out the island of
little boats”. The priority below is the lead's recommendation; the little boats build is authorised.

## 1. The island of little boats — implemented locally

After the washing and before the meadow. A shallow pool holds wooden toy sailing boats. More pools connect
through narrow streams in the sand. A bath plug hangs from a long chain that disappears overhead into haze.
The child notices a toy on the bank, picks it up in both mittens, then carries it to the lip and puts it afloat. The player fills its sail, then discovers all the
boats answer. The child follows the bank; the cygnet paddles beside the toys through the pools and connecting shallows, with brief dry-bank pauses
between swims. Around the final bend, their own boat waits among the toys: perhaps it has been a toy all
along.

This is early, affectionate play and an introduction to putting wind into sails, before the drowned village
needs that skill. Keep the paper visibly attached to the backpack during the room so the toys take the wind. No race,
score, text, directional gesture test or penalty. The fleet responds locally to the player's wind; nearby
boats gather into the winding stream and drift to rest when the air settles. The child follows the leading
toy on a continuous dry bank, with the cygnet walking or swimming beside them. Keep the toy, the travellers
and the next stretch of water visible together in landscape and portrait. A quiet repeated sweep can invite a stalled player;
time alone does not complete the interaction.

Build: a bounded island off the eastern route, three linked pools, painted wooden hulls and linen sails,
small wakes, shared atmospheric lighting, the hanging plug, and a short chapter with arrival, launch, fleet
play, the full-sized boat reveal and boarding. Preserve previous checkpoint names and the existing islands.
Add safe pool checkpoints, a direct `?chapter=boats` start and mouse/touch, route and resume verification.
Use the existing game art language and verify the room in the real renderer.

## 2. The sky mirror — returning the fallen stars

Jeremy rejected the idle reveal, then the moon-and-tide version: the moon read as a random stone ball,
clouds on the ground hid the room's defining view, and independent ghost characters added too much complexity.
On the proposal to skim bubbles over fallen star reflections and lift their lights back into the sky:
“yes!! this is the one!!” (2026-09-20).

Keep the uninterrupted mirror and its ordinary reflections. A stool, an enamel bowl of soap and a brass
hoop are the small domestic fragment. The child sets down the cygnet near the landing. The paper leads both
across the flat to the bowl, about ten seconds farther inland than the first version. They pick up the hoop and make bubbles
with the player's wind. The paper remains visible on the backpack while the mitten holds the wand.

Four lights lie on the surface. Sweeps make and steer bubbles; a low bubble touching a light catches it,
and that patch of mirror goes dark. Circles lift a filled bubble. Once high enough it bursts gently and the
light rises into its place in the sky, now reflected naturally below. Lights may be collected in any order;
a sweep at a different fallen light asks the child to walk there with the bird. The paper leads the initial
walk to the bowl. Between lights it stays on the backpack; the child walks
directly to the next stop with the cygnet, without repeating a throw and retrieval. Empty bubbles are harmless play.
A burst carrying a light returns it to its original patch without undoing completed stars. Empty bubbles
always skim the surface, even during a curled stroke. Capture cannot inherit an already charged updraft;
a fresh lifting arc can follow immediately. Filled bubbles settle horizontally while being lifted.
The camera looks across the approach with a fixed bearing,
keeping hoop, bubble and target apart, and eases upward when a star leaves its bubble.

The arrival boat now moors in deep water alongside a separate entry jetty. The child walks its planks to
the flat before setting down the cygnet. The jetty stays about 16 units long, matching the departure pier;
placing it on the western edge adds about nine seconds on the open mirror with the cygnet (27 seconds
walking together before the bowl, previously 18). Bubble
steering follows the cursor stroke at the bubble's height,
responds promptly to reversals, and coasts after release. Destination selection is disabled while a bubble
is in play; a caught or rising star holds the child and camera until its ascent is complete.

No timers, hidden completion percentages, constellation matching, raised causeway or passive solution.
The departure kite marks the far jetty throughout star play and is reflected in the water. It identifies
the exit without unlocking it. The returned lights form a low constellation above that jetty. Each lights a stretch of broken reflection
on the deep-water approach. The last joins those stretches and lets the empty boat approach the jetty;
the camera widens for six seconds to show that connection before the child gathers the cygnet. The boat
follows the existing deep outer channel and waits offshore until all four stars return, including after
loading a partial save. Its hull never sails across the walkable flat.

The bubble film is a transparent, lightly deforming sphere with view-dependent colour and reflected sky.
It uses the existing reflection pass; there are no extra scene cameras or GPU readbacks per bubble. The
fallen lights, captured lights and restored stars use separate presentation states with a continuous ascent.
Terrain and the shared water surface remain unchanged.

Route: sleeping → `toMirror` (dolphins and brave swim) → `mirror` → `toHarbour` → home.
Checkpoint `stars4-<mask>` stores a completed-star bitmask and current destination. Restore clears transient bubbles
and rebuilds the lights already overhead. Three-star `stars`/`stars-<mask>` saves keep partial progress;
a completed mask of 7 restores all four lights so an already finished room stays finished. Legacy moon/tide/lantern checkpoints map to 0/1/2 restored lights;
reflection/window saves restart at the bowl's first star. Existing `toHome` crossings remain supported.

Code: `world/sky-mirror.ts`, `world/mirror-soap.ts`, `story/sky-mirror.ts`; geometry and positions in
`world/sky-mirror-layout.ts`, feel in `tuning.skyMirror`. Direct start: `?chapter=mirror`.
Checks: `tools/sky-mirror-logic-check.mjs` (real actors, idle, all saved subsets, legacy saves and bubble
recovery), `tools/sky-mirror-check.mjs` (real mouse/touch), `tools/startup-check.mjs` (ordinary Begin flow),
and `tools/terrain-check.mjs` (other chapters).

Camera/control pass (2026-09-20): desktop and portrait touch playthroughs returned all three stars,
reloaded the first saved star and boarded both travellers with the paper visible, without browser errors.
Logic checks cover accidental updrafts, the offshore gate and partial saves, the shared arrival walk,
rising-star framing and the final constellation from each possible last stop. Typecheck and build pass.
The entry/capture follow-up also covers the sailing approach, the deck-to-flat step, a pending destination
on the capture frame, another star returning during a capture, stroke reversal and coasting, and continuous
lifting circles. Mouse and touch gesture checks pass; the browser touch run completes all stars and boarding.

Fourth star (September 21): Jeremy found the room ended too soon after learning the first bubble.
Four lights now share the same capture and lift rules, with another nearby stop, four reflected approach
segments and a four-point kite constellation. Any light can finish the room; the boat waits for all four.
Jeremy chose a slightly crooked kite instead of the shallow arch: a short upper point, a longer lower
point, and a closed outline that appears as adjacent lights return. It echoes the departure kite below.
After all four stars reach the sky, the top-to-bottom and left-to-right lines fade in to complete the kite.
Partial saves keep those internal lines hidden; completed saves restore them.
The ascent camera has additional framing room for the higher top star.
The suggested flourish of tiny bubbles following the final released star is not implemented.
Overlapping star hit areas now choose the strongest stroke contact rather than the last array entry.
Build, 30/60 fps progression, all 16 save subsets, legacy completion, portrait framing and mouse/touch
pointer checks pass. Rendered QA remains unverified: the shared GPU was occupied by a journey run,
and the software-rendered fallback did not reach play.

## Journey pacing and the mirror companion (September 20)

Jeremy asked for shorter crossings from little boats to meadow, sleeping to mirror, and especially mirror
to home; the mirror should feel like a short way station. The earlier per-crossing speed boosts were
rejected. Ordinary sailing now shares a 4.5–5.5 units/s baseline and a top speed of 10; swimming and mooring retain their slower pace. Physical route changes
remain recommendations in [geography.md](geography.md), including which scenic approaches to preserve.
The secret doorway shore is concealed on later crossings; the home jetty appears only on the final homeward approach.

At the mirror the healed cygnet investigates beside the fallen light, follows low bubbles from the side,
and opens both wings when a bubble catches a light. It watches the ascent. These decisions follow actual
puzzle events, remain within a small radius of the child and never capture, burst or return a light for the
player. The bird stays on its feet; the farewell flight still belongs to home. Movement and attention are
cleared before gathering and on checkpoint restoration. The original three lights and gestures remain.

## 3. The stairs in the clouds — planned

Before the drowned village. A grassy island climbs into low cloud; its path becomes a household staircase
and banister without a house. Wind parts the cloud to reveal solid steps ahead. The cygnet goes a few steps
first and waits. Above is a landing, slippers and open sky; below, cloud lies over the hills like a duvet.
The emotion is going upstairs alone as a child. No maze or guessing the controls. Develop a stronger event
at the top before building, and distinguish its interaction from the sleeping island's fog and bird-led walk.

## Little-boats implementation

Jeremy's addition during the build: “looks like something where the cygnett can swim in the water along with
the little boats”. The three sheltered paddles now lead into the later, braver open-water swim.

`src/world/little-boats-layout.ts` owns the shared stream geometry; `heightfield.ts` carves its three pools
on both CPU and GPU. `src/world/little-boats.ts` draws seven wooden toys, wind-filled linen sails,
wakes and the hanging bath plug; the sea renderer also draws the stream. `src/story/little-boats.ts` runs the walk, launch, swimming, reveal
and boarding. Wind across a visible sail is written into the same wind field as every other interaction.
The channel guides the toys; it is not a steering or direction puzzle. The fleet slows for either traveller.
The cygnet uses its existing entry, paddling and scramble animations, with the pool's own water level.

The new route is washing → little boats → meadow. An existing saved crossing from the washing directly to
the meadow still finishes its original route. The two pool checkpoints restore on the dry bank; mid-swim
poses and transient gusts are not saved. `?chapter=boats` enters the room for review.

Verification tools: `tools/little-boats-logic-check.mjs` (idle/local wind, 30/60fps, three swims, dry banks,
framing, checkpoints, crossings and the actual arrival walk), `tools/little-boats-check.mjs` (real mouse
strokes; `TOUCH=1` for a phone viewport), and `ONLY=boats node tools/progress-check.mjs` (saved-game reloads).

Verified locally: typecheck and production build; complete mouse and emulated-touch playthroughs with
three swims and departure to the meadow; both saved-game reloads; crossing steering and grounding checks.
Reviewed rendered landscape and portrait views. The build retains the existing bundle-size warning.
Not deployed.


## Polish (2026-09-19)

Jeremy: “the cygnett should do more excited paddling / swimming along with the little boats”; the toys
should have “sails drooped or flapping, just like the players sail boat” and “bob up and down, side to side”;
“can the stream look more like the sea water? And have it seamlessly merge with the sea?”

- The cygnet alternates quick paddling bursts with glides, weaves closer to the toys, glances back at the
  child and flicks its wings. Its foot phase emits a few small drops. `swimPlay` is local to this room and
  resets on leaving the water. The grass visibility bias fades out afloat so feet and the lower body
  correctly disappear below the surface.
- Cloth gathers into hanging folds without wind. An arriving or dying gust shakes the free edge; the
  sail then bellies, swings on its boom and eases back to rest. Local wind also gives each hull a damped
  heel and sideways drift. Shared surface samples drive its rise, pitch and roll.
- One sea mesh now rises into the stream: the same ripples, shallow-water colour, caustics and sun glints
  continue to the ocean. The elevated pools use sky reflection; the sea-level planar mirror fades back
  in at the outlet. A shared CPU/GLSL ripple gives the toys and swimmer the same water height. The last
  channel opens below the waterline rather than ending in a sand rim.

Jeremy also liked the bath plug but found it hard to spot and asked to make it oversized, like a dream.
The plug is now roughly child-height across, raised out of the grass, with larger brass chain links.
Jeremy then asked: “try add the bathtub atleast. lets see how it looks”. An oversized enamel bathtub now
stands on the far bank near the plug, with a rolled rim, brass feet and taps. This is a visual experiment
for review; it adds no new interaction.

Polish verification: complete mouse and emulated-touch runs reach the meadow with all three swims.
The 30/60fps checks cover burst paddling, dry banks, sail droop/fill/luff, hull response, water height and
an unobstructed outlet. Reviewed rendered cloth states, swimming immersion, the enlarged props and the
stream mouth. Final typecheck/build pass with the existing bundle-size warning; not deployed.

## Pickup and longer swimming (2026-09-20)

Jeremy: “why does the child put a boat down out of nowhere? did it pick up a little boat before?” Then,
approving a visible pickup: “yea, and let the cygnett do more swimming, it's very cute.”

The first toy rests on a small bare patch from arrival. After setting the cygnet down, the child notices it,
kneels, grips the hull with both mittens, lifts it for a look, then carries it to the water and lowers it.
The close camera watches from across the pool so the child does not hide the toy. The same hull follows the
actual posed mittens; release blends continuously onto the water before the player takes over.

All three swims are longer, including the sheltered connecting shallows. The standard 30/60 fps input run
now includes about 43 seconds of swimming, previously about 30, with quick paddles, glides and wing flicks.
Short bank pauses preserve the existing pool checkpoints. Tests cover grounded pickup, both hand contacts,
continuous release, swimming within the stream, dry walking, framing, checkpoint restores and departure.

Verified the pickup in landscape and portrait renders, plus a complete emulated-touch run through all three
swims and departure to the meadow. Typecheck, production build and the 30/60 fps logic checks pass.

Jeremy clarified that `?chapter=boats` should show the paper plane attached to the child's backpack.
The plane now remains visible at its existing backpack grip throughout arrival, toy handling and the bank
walk, including both restored checkpoints. The chapter explicitly keeps it stowed even with free hands;
boarding releases that request and returns to the usual carry behaviour.

## Independent sails and the outgoing fleet (2026-09-20)

Jeremy noticed some boats only moved once they became the last boat, and asked for the fleet to sail out
of the stream into the ocean to the right. Waiting boats previously had a three-unit travel cap; joined
boats also waited for an index-based position behind the leader. Both restrictions are removed. Every toy
now accelerates from its own local gust, while nearby wind also carries the gathered fleet along.

The course continues through the mouth and makes a broad rightward turn in deep water. Once the player
has brought the first boat to the mouth, an outgoing current carries the remaining toys down and out.
This current is the farewell after the wind interaction; it cannot complete the chapter on its own.
Toys spread out, ride the sea swell and continue sailing after the travellers board and leave. Their update
stops once all seven have gone out of view. The reveal camera stays with the travellers.

Checks cover each waiting and joined toy responding independently, the complete outgoing course staying
clear of land, continuous motion at the mouth, and the fleet continuing after the chapter becomes inactive.

Verified with a complete mouse playthrough, the 30/60 fps chapter checks and rendered views of the fleet
clearing the mouth and spreading to the right offshore. Typecheck and the production build pass.

## Meadow arrival (2026-09-20)

Jeremy found the crossing landed too far along the meadow shore, leaving a long walk before the hill.
The approach now lines up offshore with the existing hill path before turning in. This applies to the
little-boats route and legacy washing-to-meadow saves. The final two legs use a speed limit of five so a
strong gust cannot carry the boat past the path during the turn; other crossings retain their own speeds.

The landing is now near x=10 instead of about x=62. The child starts climbing roughly 6–8 seconds after
landing in the CPU and rendered checks, including the existing pause to look uphill. The meadow path and
its reveal remain unchanged. The route check covers calm and gusty arrivals; the little-boats logic check
also walks the actual child from the landed boat into the climb.

### Mirror companion gait — September 21

Short investigations now use a slow planted walk rather than the running/pattering gait that looked like paddling on the reflective surface. Running wing balance follows actual speed, including the exploration pace multiplier; walks alongside the moving child keep their existing pace. Targeted real-actor checks confirm walking contacts, no swimming pose, no paddle/plunge sounds, and normal gather/departure reset. Close-up frame sequences were reviewed.
