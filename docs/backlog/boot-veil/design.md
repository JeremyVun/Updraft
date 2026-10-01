# Boot and the loading veil after the stairs

## Jeremy's brief (2026-09-29, verbatim)

> yea after we added the stairs level, i need another pass to find performance optimisation opportunities. I'm
> wondering if we've outlived the short and sweet loading veil as well

> what i want to avoid though it having the gameplay itself freeze setting up the stairs. and yea, create a separate
> backlog item for the veil issue

## What is wrong

`node tools/start-check.mjs` fails: the worst gap between painted frames of the veil while the game boots is 533 to
583 ms against `BOOT_MAX_MS` 500, on the dev server and on a production build (`vite preview`), on a quiet machine.
For that half second the start screen stops painting; it looks hung. The ring cursor keeps moving, because it is a
browser-owned SVG cursor (`src/entry.ts`), so the freeze shows in everything else on the screen.

Bisected on production builds (2026-09-29): 250 to 300 ms up to the child rebuild (fea312e); 517 to 533 ms from the
stairs merge (60767a5, 2026-09-28 02:58); 533 to 567 ms after. The stairs added a `CloudStairs` world built at
startup (`src/main.ts`, `new CloudStairs()`, between two `yieldBoot()` calls) and about 150 lines of cloud-deck GLSL in
`src/world/atmosphere.ts`, which every shader includes through `ATMO_GLSL`. So the cost is one of: building
`CloudStairs` in one unbroken step; compiling the larger shaders (every program grew, not only the stairs'); or the
first draw of the stairs in `warmRender`. Not yet known which.

**perf-final's effect (2026-10-02, dev server, 12 fresh loads each).** At 9557d73 (perf-final phase 1: the indexed
stairs mesh, 787k → 179k vertices) `start-check`'s worst gap read 383 to 400 ms and passed; the worst gap is a world
construction long task about 0.42 s after navigation, before `boot()`. Phase 2 (8929eec, deck-free shader variants)
adds about 75 to 80 ms to the time to ready (2413 → 2487 ms mean) and leaves the worst gap at 393 to 404 ms (mean
394.5 → 399, not significant); its variant compiles add no long task. Re-measure on a production build before
treating the freeze as gone.

## Constraints

- **Play never freezes to set up the stairs (Jeremy, 2026-09-29).** Anything moved out of boot must not cost a
  visible hitch during play. This is the boot contract in `docs/engine.md` ("Nothing heavy may happen in the first
  frames of play ... Anything that appears later in the story is already compiled and uploaded"), and it stays.
- So the first remedy is to keep the work behind the veil and break it up so the veil keeps painting (yield inside
  the step that blocks, as `prepareInBatches` does for the birches scarf; compile with `KHR_parallel_shader_compile`
  rather than a blocking first draw). Moving work into play is acceptable only if frame-time checks show no hitch at
  the moment it runs.

## The veil itself (open, for Jeremy after the profile)

"Short and sweet" assumed a short boot. Whether it has been outgrown depends on how long the page now takes to reach
Begin, which has not been measured since the stairs: on this laptop, on an iPad or phone, cold and warm cache. The
freeze and the length are separate problems: a longer or richer veil does not hide a freeze (it would freeze too),
and removing the freeze does not shorten the wait. Once the numbers are in, the options are:

- (a) keep the veil as it is, if the wait stays short once the freeze is gone;
- (b) keep its look but show that loading is progressing (the boot steps are already discrete);
- (c) give it more to be (a scene or motion that makes a longer wait part of the game).

(b) and (c) are visual work (allowed visual model, stills for Jeremy); any text on it follows the `user-facing-copy`
skill.

## Wider pass

Jeremy also asked for "another pass to find performance optimisation opportunities" after the stairs. This item
covers boot and the veil. The in-play cost of the stairs (the cloud deck, the towers, the sail over the cloud) is a
separate pass; ask Jeremy whether to fold it in here or open it apart, before planning.

## Next (design, not yet ready to build)

1. Profile a cold boot on a production build with `tools/boot-profile.mjs` (long tasks, blocking GL calls, CPU
   profile), at 60767a5^ and at current `main`, back to back, with no other Chrome capture running (check `ps` for
   Chrome over 20% CPU). Name the step that blocks.
2. Measure time to Begin (page open to the button enabled), laptop and a touch device, cold and warm.
3. Bring Jeremy the numbers, the fix for the freeze, and the veil question with the numbers behind it; then write
   `build_plan.md`.
