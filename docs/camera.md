# Camera direction: every move has an intention

Jeremy's brief, 2026-09-25, in his words:

> Every time the camera moves (pans, zooms etc). It must have an "intention". What i mean is that as i play the
> game, i notice the camera sometimes moving back and forward, or suddenly coming to a stop and then moving again
> (like when the child rounds the corner of the smaller rock next to the still island, the camera stops and zooms
> out instead of staying with the child), being indecisive about it's framing and it's subject. It needs to feel
> cinematic and incredibly polished in terms of the camera direction the whole way through the game. Please
> identify all areas of teh game like this that need to be fixed and fix them

Earlier direction still stands: "make sure we don't make it nauseating with the camera jerking in and out all the
time" (piano, September 19) and "it'd need to feel really nice and seamless throughout the entire game. Almost like
there wasn't an authored system in place" (September 21). How the rig works: [engine.md](engine.md#cinematography-srccamerats-srccamera-directionts).

## What intention means here

- **A move commits.** Room made for a subject (a thrown plane, the island in a farewell, a whale) opens on an eased
  curve and stays while the need may return. It settles back only after the need has stayed smaller for a while,
  and slowly. Nothing pumps in and out with each throw, gust or flap.
- **The lens stays with the child.** It travels with what it follows, so a child who walks and pauses does not
  stretch and squash the shot, and a boat that runs aground does not stop the lens dead.
- **A side is chosen, not flipped.** The sailing camera rides the quarter away from the sail, but a boom swinging
  across has to stay there for seconds before the view changes quarter, and the look back never changes side.
- **A look toward something is a glance, not a chase.** The whale is watched from within an arc of the travelling
  view; the lens never circles the boat to keep it.
- **Reveals ratchet.** Each piano answer steps the view back and up and it stays; the finale carries on from there.

## How it was found

`TRACE=1 node tools/playthrough.mjs <prefix>` records every camera step of a real journey (Begin to credits,
real pointer gestures). `node tools/camera-intent-report.mjs <prefix>` lists, by chapter and beat:

- **stalls**: the lens nearly stops while the child keeps moving, then goes again;
- **in-then-out / out-then-in**: the distance to the child swings more than 10% one way and back within 12 s;
- **pan reversals**: the view turns more than 7° one way and back within 10 s;
- **jerks**: sudden changes of acceleration (moves that start or stop without easing).

Each finding names the rig correction that moved across it (subject fit, occlusion pull or lift, scenery rise,
composition offset) and any beat, chapter or staging handover inside it.

## Findings and fixes (2026-09-25)

| Where | What the trace showed | Cause | Fix |
| --- | --- | --- | --- |
| Farewell from the still island, rounding the rock (Jeremy's example) | Lens speed fell from 5.6 to about 1 while the boat held 5.3, then a 10-unit pull-back and return | The look-back's side followed the sail; as the boat turned the corner the boom crossed and the camera orbited backwards round the boat. The island's centre was a framing subject through the swing home | The look back keeps its side until it has swung home; the island's claim on the frame lets go as the swing begins (`crossingCamera.farewellLetGo`) |
| Every crossing and the drowned village | Small side swings whenever the boom crossed | Camera quarter eased straight to the sail side | The sail must stay across `crossingCamera.sideCommit` seconds before the lens changes quarter |
| Whale on the first crossing | 140° orbit round the boat and back within 35 s, fit punching out 9 to 12 units twice | Encounter bearing kept the whale beyond the boat as they passed it | Watched within `crossingCamera.whaleArc` of the travelling view |
| Still island play | Distance 41, 48, 44, 58, 47, 55 within 25 s | Distance followed the plane's spread directly | Room for the longest recent throw, kept while play goes on (`cinematography.reach*`) |
| Every shot with subjects (meadow walk, flock departure, drowned storm, wood exit, sleeping climb, mirror) | Out-and-in swings of 5 to 25 units; single-frame pops of up to 1.8 units at handovers | Subject fitting jumped out at once and drifted back | `Commitment`: eased opening, `fitHold` seconds held, slow settle; the primary's safety frame still applies at once |
| Hills between lens and child | Quick dolly in, slow drift back | Occlusion pull and lift jumped to stepped targets | Same commitment (`occlusion*`) |
| Walking beats (lines shore, meadow, birches, wood, home) | Distance to the child breathing 8 to 10 units as they walk and pause | Follow lag of 2v/ω | The lens carries half of its target's smoothed travel (`followShare`, `followSmoothing`) |
| Every landing | Lens speed 4.5 to 0.8 in one frame | Carry stopped when the hull stopped on the sand | Carried motion brakes at `carryBrake` |
| Piano puzzle | Three out-and-back pumps (19 to 34/46/58 and back to the keys) | Per-answer response framing returned to the keys | Ratchet: 24, 29, 34 back and it stays (`piano.rest*`) |
| Sleeping island climb | Pan reversals of 55 to 70° at route markers | Camera side taken straight from the current route segment | The climb direction is eased like the other headings |

Left as authored, because each is one deliberate move rather than indecision: the doorway's continuous threshold
path, the little-boats close-up while the child handles a toy, the birches' close-up for the circling snag, the
sleeping bedroom's glance to the window when the cygnet calls, and the summit's push-in for the goodbye.

## Result

Measured with the same real-gesture play-through before and after (runs differ in gusts and timing):

RESULTS_TABLE
