# Rotary washing line

Status: design prototype in `codex/lines-rotary`, isolated from the shared main checkout. Nothing approved for release.
Parent: [more to do on the path](../path-puzzles/design.md). Story authority: [journey](../../journey.md).

## Jeremy's brief, verbatim

2026-10-11:

> I'm looking to make the main island of lines a bit longer. any ideas?

> yea, the only thing i can think of is that the red, blue, yellow shirts on the clothes line just sort of appear out of nowhere.
>
> The rotary washing line is probably the best one i think? the laundry basket land boat is too similar to the challenge on the little boats island

After the proposal to put it between the second and third curtains and glimpse the family's existing garments through the turning washing:

> yea, think carefully about how to design the puzzle beautifully. work in a worktree

During the prototype:

> make sure that as you're designing it that you really think about the aesthetics of the scene from the perspective of the player camera and how the scenes are composed

After seeing the first prototype:

> note: doesn't the island itself feel a bit short now? i dont remember the door being on the beach in the original island of lines

The family and door must remain an inland clearing, enclosed by washing. Extend the island itself to fit the extra
encounter; moving the door down the existing slope was the wrong tradeoff.

## Intent

A domestic object made enormous, with the child small beneath it. The player has learned to push sheets; now that
same air moves the thing the sheets hang on. All three existing curtain encounters remain, as do the family gesture,
red door and far-shore pulley. No laundry-basket boat, updraft requirement, instructions, timer or losing progress to
an idle return. The extra time comes from a new encounter and a winding approach, never slower walking.

## Physical design to prove

Four arms, concentric sagging clotheslines, a weathered mast and bearing. Pale linen occupies one half; the other
half has empty lines and spare pegs. The path passes around the mast, through the outer half of its canopy. An empty
quarter alone would not make a passage through both sides, so the empty HALF and the offset path are essential.
Broad sweeps of visible cloth turn the assembly in either direction. It has inertia and friction; leaving it alone
lets it coast to rest where it has reached. Once the empty half faces the path a physical stop catches the bearing,
leaving the passage open. The child and bird wait outside its swept envelope until it has settled, then walk through.

The third curtain moves farther north and slightly west; the family and door move farther north together. This
leaves space for a clearing around the rotary. Following Jeremy's correction, the northern part of the island also
extends 40 metres; its arrival beach and first approach retain their exact heights. More washing fills the extension,
so the door remains deep inside the laundry rather than against the beach and sea. The camera looks obliquely
through the turning sheets, past the side of the third curtain, at the same coloured garments the child later
reaches. No duplicate shirts, spawning, teleporting, or premature sleeve gesture. The final curtain still earns the
complete family composition. Keep the final door approach physically coherent with the moved threshold.

## Prototype plan

1. Lay out the rotary, offset route and moved final clearing with the existing materials. Establish a view with
   both travellers, the useful sheet, mast, and open half readable in landscape and portrait.
2. Add inertia, screen-local wind response, forgiving catch and quiet drawn invitation. Integrate the extra beat
   between curtains two and three; preserve old saves and add a checkpoint before the rotary.
3. Drive real gestures through the whole encounter, continuing to the family and shore. Check idle and unrelated
   gestures do not solve it, either direction works, the stop holds, and travellers never enter moving laundry.
4. Review captures of the approach, turning, first glimpse, open passage, final curtain and family in both aspects.
   Iterate on what those captures actually show; record evidence and remaining owner decisions here.

## Build invariants

- The player's gesture reaches the cloth under the cursor and contributes to the shared wind field.
- The bare half, pole and physical path agree; do not route a character through the mast or hanging sheets.
- All active geometry and both whole character silhouettes remain readable on a phone.
- Partial rotation stays put after coasting; success stays earned even if the player keeps sweeping.
- The family's blue, red and yellow garments are present before, during and after the rotary encounter.
- Worn grass and scenery layout are fixed; solving the puzzle does not reshape the clearing.
- Legacy curtain-2 saves resume after the added encounter. New rotary saves resume before it.
- The moved red door's geometry, portal clipping and walking thresholds use the same location.

## Evidence and decisions

The first side view exposed the family as a separate tableau and left too much open grass. The final view looks
along the child's approach: child and cygnet low right, rotary across the middle, dense fixed washing around its
edges, and the real family beyond it. A slight rise lets the four arms read without making the view an overhead
map. The camera holds this direction while the player works; turning laundry opens a window onto the colours.

Portrait uses its own bounded distance, with the same direction and subjects. Preserving the whole desktop width
by retreating exposed unrelated foreground washing and made the child too small, so that approach was discarded.
The final portrait view keeps the full canopy, useful cloth, companions and all three colours in frame. Real touch
swipes in the opposite direction have played through to the shore without errors.

Moving the family exposed a second composition problem: the old low camera looked through tall grass and the last
sheet hung across the red garment. The fixed worn clearing now includes that view's foreground, the camera clears
the grass, and the sheet's receiving line stands farther east. The changes are permanent layout, never scenery
fading or moving in response to puzzle progress. The final curtain, reaching sleeves and door still play in order. Jeremy then rejected the exposed shore behind
this view; the later northern extension restores the inland setting and supersedes those first family captures.

The rotary takes several deliberate sweeps (about 4–10 in the captured playtests, depending on direction and gesture),
then settles for 1.6 seconds and gives a 2.2-second look at the family before the walk. The waiting places lie beyond
its 7.6-metre sweep; the path passes 5.5 metres east of the mast through the bare half. The half-turn catches in either
direction. Neither idle time nor off-target wind contributes; partial turns coast to rest without returning.

Evidence is under `/tmp/updraft-lines-rotary.Okl0Yk/`. After Jeremy's inland-setting correction,
`inland-landscape/` records the complete route from landing through all three curtains, the rotary, family and
doorway to the shore. `inland-portrait/` records the 390×844 touch replay in the opposite direction from the rotary
to the shore. These supersede `final-landscape/` and `final-portrait/`, which show the earlier beach setting.
`/tmp/updraft-lines-resume-*` records the full chapter with checkpoint reloads before the terrain extension.
A 304-point comparison confirms unchanged arrival heights; the door is 7.42 m above sea level, against 7.35 m
at its original location (it had fallen to 1.99 m in the beach prototype). The browser checks save video/stills and
fail on console errors; mechanical checks cover both directions at
30/60/120 Hz. The new rotary checkpoint starts before the encounter; old `curtain-2` saves start after it.

The extended terrain passes geography and shader checks. The full terrain-atlas check passes every visible-height
and normal gate, but fails its sea-floor comparison at `(194, -1750)`, away from Lines. The committed baseline has
the identical height at that point: this existing failure is not fixed by the prototype. A separate 0.5 m sweep
around Lines and its atlas edge samples 157,528 points outside the atlas interior, with exactly zero change from
the baseline. Reports: `terrain-heights.json` and `terrain-lines-scope.json` in the evidence folder.

This is a playable design prototype for Jeremy's review. No merge, deploy, physical iPad check or full release
performance comparison has been done. The worktree preview runs at `http://127.0.0.1:5243/?chapter=rotary&progress=0`.

Main has concurrent uncommitted changes; this worktree begins at main's committed
revision and carries only the already verified Lines bird-arrival correction needed to avoid the inherited stall.
