# Toward the room paintings

Work in progress: cheap changes that bring the game's look closer to the room paintings
(`docs/images/updraft-chapters.jpg`) than the in-game screens (`docs/images/updraft-screenshots.jpg`).

## Jeremy's brief

> Looking at the screens in `docs/images/updraft-screenshots.jpg` compared to `docs/images/updraft-chapters.jpg`, i
> feel like we could make the game look better in terms of contrast and colour grading?
>
> also, maybe it's the angle of the camera shot, but the top right one with the little boats makes it look like the
> grass is on patchy black ground?

> work in a worktree and see what you can do to make the game's colours pop more, without incurring much of a perf
> cost.

> keep working to see what cheap things you can do to get the game feeling more like `images/updraft-chapters.jpg`.
> For the little boats island, from the screenshots, it looks like we might actually need a bit more grass density on
> the little boats island honestly, not just a regrade of the ground colour (the colour you did actually makes the
> little boats island look a bit too garish green on its own)

> Don't just blindly make it look like the updraft-chapters.jpg though - i need you to apply artistic judgement based
> on an understanding of what each chapter is trying to do. But do try to make the game look better where you can
> without hurting perf too much (you can do a perf profile at the end if you want, but just use common sense for the
> most part).

## Plan

Judge each room by what it is for (`docs/chapters.md`), not by its painting: the still island and the asleep meadow
stay grey, the wood and the sleeping island stay dark, home stays clear rather than gold-veiled.

- Done: the grade gains vibrance, a gentle contrast curve, blue shadows that leave black alone and a lighter vignette
  (`src/post/post.ts`).
- Done: the little boats' cropped blades are broader (`tuning.littleBoats.turfWidth`), so the bank reads as turf seen
  from its high camera; the ground between blades is a shaded grass green rather than soil, toned down so it is not
  garish (`src/world/terrain.ts`).
- Done: a broad warm glow round the sun (`skyColor`), which warms the haze toward it too, and a warmer afternoon
  horizon (`ALIVE.horizon`).
- Tried and left: a stronger home sun (the arrival hill faces away from it, so it changes little and home is meant to
  be clear); deeper zeniths and stronger sun-side horizons (too small to matter).
- Each change must cost next to nothing per frame; judged by before/after stills of the same held frame.
