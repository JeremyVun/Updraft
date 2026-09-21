# The dark wood

## Jeremy's brief (September 20, 2026)

> “There's some issue with some of the later embers where the player can light them up, but then the game still somehow gets "stuck" and the child doesn't keep moving.”
>
> “When the cygnet runs away away, it basically teleports out of the player's arms into the darkness somewhere. It's very unnatural.”
>
> “Rethinking and redesigning how we better communicate "Care becomes courage", both as a design element but also how it's executed within the game and experienced from the perspective of the player.”

## Authored fright and rescue

Jeremy rejected the voluntary set-down: “it's still not clear why the child suddenly lets the cygnet down and
it runs away and then an ember appears.” His direction: “one very loud and scripted lightning flash and thunder
clap that causes the cygnet to get scared and jump out (feathers and all) and run away under some rocks or something.”

Jeremy's next review found trees blocking the child, a jump too fast to read, inaudible feathers, no real gap
under the rocks, and an ember visible before the reveal. He also asked to remove the happy completion sound
after retrieval and have the child coax the bird outside before picking it up, avoiding the rock clipping.

The camera first settles on the child in a cleared glade; foreground branches dissolve where they obscure
either character. Only then does one close flash fire. Its clap follows after 0.16 seconds, startling the
cygnet. The recoil lasts until 1.65 seconds; the sideways jump then takes 1.3 seconds, with a louder, longer
feather scramble and loose down. Its landing stays fixed, clear of the child. After a short landing pause,
the bird runs to the entrance before turning into the hollow. The child turns and reaches after it.
The camera retains both characters, then swings around to look into the shelter.
There is no deliberate lowering or handover. Ambient lightning is suppressed throughout this chapter so the
fright has one unmistakable cause; the authored event cannot repeat during an idle or checkpoint restore.

The shelter is an uneven cluster of partly buried boulders beneath a tilted slab, with a low west-facing
crevice. Broken chips, broad weathered facets and patches of moss tie it to the forest floor. Its ember is inside, concealed during
the approach and fright. It becomes visible only when the camera has turned toward the entrance after the
jump. The player fans it awake, revealing the frightened bird. The child hesitates, then crosses to a spot
outside the rock, kneels and offers a still hand. After 2.2 seconds the cygnet walks out to them. The pickup
begins only once the bird is outside too. The reunion has no level-complete musical cue.
The child first needed light for their own next step; now they use it to help their companion. Care gives them
a reason to enter the dark. They continue with the cygnet against their chest.

Jeremy's next screenshot found that “the rocks look a bit unnatural” and “there are two embers close by”.
The symmetrical tunnel mesh is replaced by separate stones. The last approach ember sits back along the
path, behind the rescue camera, and no further path ember is offered beside the shelter before the rescue.
Lighting it earns the short walk into the clearing. Existing lights stay in place and burn normally while
the camera turns toward the concealed refuge ember. Jeremy rejected fading the earned light at the thunder:
“the ember that I had just lit disappeared”. Scene focus must come from placement and framing, not erasing
the player's work.

The approach ember sits on the west verge, and lighting it keeps the child on the walking line rather than
steering into the orb. The first ember after pickup is 12 path units ahead instead of 20.25. The walking
camera shifts farther to the shoulder after rescue, separating the next light from the child's silhouette;
unlit path embers also receive the same foreground-branch clearance as the rescue subjects.

Camera continuity: walking orientation follows the next route point or a waiting ember ahead, never an
earned fire behind the child. The rescue holds that walking heading while its authored camera plays.
Subject fitting eases at `cameraFitResponse`, and the camera carries the child's physical displacement
through `Shot.carryAnchor`; selecting a new ember changes focus without translating the camera instantly.
The September 20 full-game baseline exposed a 12.67-unit one-frame retreat at the first ignition, which
the earlier isolated-scene checks had missed.

Controls live in `tuning.wood`; the sequence is in `src/story/wood.ts`. The rescue waits indefinitely for player
ignition. Neither scripted weather nor a waiting timer lights an ember.

## Paper caught in the tree (September 20 follow-up)

Jeremy asked for the paper plane to be stuck in a tree at the end, freed by the player's wind like the scarf
knots. The last ember now reveals it on an exposed fork above the child's reach. The child waits below and
looks up. Strokes across the paper rock it and slide it along the fork; progress stays between strokes.
Ambient storm wind, a stationary pointer, and strokes elsewhere cannot free it. The existing wind invitation
appears at the plane while it waits. The already-lit ember keeps smouldering during this interaction, so
taking time does not hide the paper again.

The caught paper rocks gently before any input. Its fork and anchor share a slow sway driven by the breeze
direction and local wind strength, at the forest's passing-gust rhythm. The paper adds a small rotation as
the branch moves; deliberate player strokes produce the faster, stronger flutter and actual slipping.
The five-second wind trace remains at the moving plane. Ambient motion never adds release progress.

Once loose, the wet paper pitches and flutters down over 1.8 seconds to clear ground beside the child. The
child settles the cygnet into the satchel, approaches the landed paper, picks it up and walks onward. The fall and
ground placement remain authored, so the gust that releases it cannot carry it away and stall retrieval.
The camera includes the child, fork and paper, with the same foreground-tree clearance used for the rescue.
The path ends at this same ember. The last two path intervals are balanced to avoid a second fire beside
the tree, and reaching the paper reuses the earned fire instead of spawning another. Existing fires stay
where they were lit and burn normally.
`tuning.wood` holds the snag height, required stroke distance, response and fall duration. Checkpoint names
and save data are unchanged; the legacy `dry` checkpoint still resumes after retrieval.

## Retrieval without a second puzzle (September 21)

Jeremy found the child apparently stuck after pickup, with a wind indicator still showing. The old drying
interaction was targeting paper stowed on the backpack because the child was holding the cygnet. He rejected
the mechanic itself: “that's too abstract for a child to understand” and “we should remove the drying mechanic.”

Freeing the plane from the branch is the complete paper interaction. The cygnet climbs into the satchel before
pickup, freeing the child's hands; collecting the plane immediately resumes the route to the boat. The held
paper never requests wind. Its wet shading fades during the walk, with no input or progression gate.
One more forest ember guides the remaining path; the final ember by the shore is removed. After lighting
that preceding ember, the child continues to the boat even if the light fades. The legacy `dry` save key is
retained for compatibility, and old saves near the shore do not recreate the removed ember.

## Earlier progression defect

The plane's wetness previously changed only its shader. At the plane ember, `reachPlane` waited for the real
glider to report a settled landing. Fanning nearby could lift the paper and keep that gate closed even with
the ember fully lit. A deterministic run with sustained wind reproduced the child still waiting after
180 seconds while the paper had drifted away. The old chapter test hid this by using a plane substitute whose
launch immediately set `landed = true`.

The wet plane now uses `Glider.layDown`: it remains a ground object until the child picks it up. The gust used
to reveal it cannot carry it away. Holding or launching clears the ground placement. Normal flight physics
still apply to the plane elsewhere.

## Moonlight correction

Jeremy's September 20 screenshot showed almost no ground or trees: “the forest was maybe a touch too dark”
and “there's not even a sliver of moonlight.” The storm already reduced the moon to 20%; the canopy then
multiplied that remaining directional light by the ambient setting of 6%.

The local lighting pass separates directional moonlight from canopy fill. The canopy retains 85% of the
already cloud-dimmed moon, 28% of scattered fill and 40% of the cold sky. The intended result is legible
silhouettes, wet edges and a sense of ground, with warm embers still providing the principal reveal.
Lighting does not contribute to ignition or the child's movement gate. Jeremy approved this darkness level.

## Verification

- `tools/wood-logic-check.mjs`: actual child, cygnet, carry, camera and glider; full wind against the wet paper;
  full route and both checkpoint restores; ignition/idle gates at 30/60/120 fps; separation continuity;
  a fixed landing before running; exactly one close clap and feather scramble; hidden ember before the
  reveal and through ember-pool reuse; coaxing and pickup outside the rock; no restored cue during the reunion;
  the caught plane waits for input, falls before pickup, and remains retrievable under full wind.
- `tools/wood-scene-check.mjs [portrait]`: focused SwiftShader render using the actual chapter, camera,
  forest trees, shelter, terrain shader and post chain. Captures the approach through pickup and measures
  the scramble's audio output. Calm wind and direct fixture ignition; not a full pointer playthrough.
- Add `plane` to the scene check for the tree interaction: actual screen-space brush hit testing, missed
  strokes, retained partial progress, fall and retrieval. Its material-owned atmosphere uniforms avoid stale
  lighting when Vite has versioned dependencies during another task's edits.
- `VIDEO=1 node tools/wood-check.mjs [portrait]`: real pointer/touch strokes from landing through boarding;
  long-idle gates, captures of the fright, run, rescue and plane. Evidence stays under `/tmp/updraft-wood-*`.
  `NATURAL=1` skips synthetic clock jumps for a continuous playthrough; `BASE` pins a production preview,
  and `PREFIX` keeps before/after captures separate. Reports include render-loop camera positions and spikes.
- `npm run typecheck` and `npm run build`.

Latest mechanics checks pass: both full routes and checkpoint restores, both characters in frame throughout
the escape, a maximum rendered separation step of 0.153 units at 30 fps, and exactly one clap at 30/60/120 fps.
The coaxing, outside pickup and absent completion cue assertions pass on both routes, including a check
that the bird crosses through the opening rather than a side wall. Typecheck and production build pass.
Desktop and portrait forest fixtures pass without shader errors. The inspected renders show unobstructed
jump/feathers, the ember inside the opening, and the cygnet emerging beside the child. The reunion camera
moves to the other side so the child's back does not hide its exit. Audio rendering measures the scramble
at roughly eleven times the ordinary handling flutter's RMS, with one event after the thunder's initial crack.
Evidence: `/tmp/updraft-wood-scene-{desktop,portrait}-*.png` and their `-report.json` files.
The early fixture pass checked staging and audio output without the full rain/wind/audio mix. The later
camera-regression pass below runs the complete chapter through the real GPU game and gesture handling.

Tree follow-up: both full mechanics routes and checkpoint restores pass, including portrait framing of the
last ember during approach. Desktop and portrait tree renders pass: no input or missed strokes leave it
caught; aimed sweeps visibly loosen the paper, followed by a continuous fall and successful retrieval.
Evidence: `/tmp/updraft-wood-scene-{desktop,portrait}-plane-*.png` and their reports. This pass also fixes
the coal pool reusing a concealed rescue ember when all ten slots were occupied.

Idle-motion follow-up: desktop and portrait scene checks verify visible rocking, matching branch/plane
anchor movement, zero release progress over nine idle seconds, and the invitation trace. Direct strokes
still release the plane and retrieval completes. The production build passes.

Shelter follow-up: desktop and portrait renders verify the broken-stone opening and outside pickup.
The reveal shot has more framing room for the child in portrait. Regression checks require the earned
approach light to remain lit in its original position through the thunder and reveal, outside the rescue
composition, while the hidden refuge ember remains the next interaction.
Both scene checks and full mechanics routes pass after that correction, along with the build/typecheck.

Camera and plane-ember regression pass: complete desktop pointer and portrait touch playthroughs reach
`toSleeping` from the forest landing on the same fixed production build, without clock jumps or staged
chapter transitions. Both have zero browser errors. The largest recorded forest camera step is 0.355 units
on desktop and 0.399 in portrait; at the first ignition it is 0.232 and 0.170 respectively, versus the
12.67-unit desktop baseline jump. The approach faces the refuge, and the plane captures show one ember.
Mechanics checks cover the reused plane ember, 6.50-unit approach clearance, saves and boarding; build passes.
Evidence: `/tmp/updraft-camera-final-{desktop,portrait}.webm`, their screenshots and `-report.json` files.

Retrieval simplification: mechanics checks pass for desktop, portrait and legacy checkpoint restores; the
production build passes. The full desktop gesture run reaches `toSleeping` without a drying beat or wind
cue on held paper. With no input for three seconds after pickup, the child walks 8.40 units onward. The
largest forest camera step is 0.364 units, with zero browser errors.
Evidence: `/tmp/updraft-paper-retrieval-desktop.webm`, screenshots and `-report.json`.
The full portrait touch run also reaches `toSleeping`, walks onward without a post-pickup gesture, and
passes the camera continuity assertions with zero browser errors. Both walking captures show the cygnet
in the satchel and the plane held beside the child. Portrait evidence uses
`/tmp/updraft-paper-retrieval-portrait` with the same suffixes.
