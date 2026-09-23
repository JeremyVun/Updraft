# Release pass — 2026-09-23

The anchor for landing the production hardening and the fixes from the 09-23 review. Read this first after
any context loss. Earlier reviews: [production-review.md](production-review.md).

## Jeremy's brief (2026-09-23, verbatim)

> "I want your opinion of this game. Review it for issues, performance opportunities, gameplay issues, audio issues, rendering issues. I need this game production ready"

After the review:

> "ok thanks, can you fix them all and land the hardening branch. It's important that we get the performance improvements in.
>
> - Keyboard only players aren't supported, i wouldn't worry about adding any text about it. People with only keyboards aren't playing this game
> - Dont worry about privacy notice or reduced motion settings. This is a game
> - on the things for my eye, they are all ok. I'd like you to show me the issues you found for the sky mirror darker band, and a suggestion for what you think would work better for the cottage location."

The "things for my eye" are accepted as they are: the long crossing's quick midday-to-sunset, the dark circle
of grass around the cottage, the sky mirror's horizon band, the dark wood's brightness and the repeated
Opus credit. Nothing changes there. Jeremy wants to *see* the mirror band and a *proposal* for the cottage.

## Work

Integration branch `release-0923` in `/private/tmp/updraft-release`; `main` is untouched until the end.
Baseline for before/after comparisons: `12a220a` in `/private/tmp/updraft-base`.

| Item | Owner | Status |
| --- | --- | --- |
| Land `codex/production-hardening` (shader ramps, water textures, allocations, typed saves, check runner) | lead | merged `1fecb8b`; quick checks and 12-scene render parity pass |
| Seven stale regression checks | parcel: tests | |
| Failure paths (audio start, frame errors, entry load, WebGL2/float support), `_headers`, favicon/meta, QA clamps, mute memory | parcel: shell | |
| iOS audio interruption, piano voices on mute, pinwheel voice, deferred audio synthesis, foghorn, `sound.output` | parcel: audio | |
| Auto quality at 30 Hz and 4K, readbacks, doorway target, touch flicks, pointer picking, offscreen village, allocations | parcel: engine | |
| Petals at the camera, dark canopy underside, sail/branch/kite occlusion, credits over Play again, shader hygiene, icons | lead (visual) | |
| Show Jeremy the mirror band; propose a cottage setting | lead (visual) | |
| Integrate, full checks, playthrough, before/after performance, docs, fast-forward `main` | lead | |

Out of scope by Jeremy's decision: keyboard-only play, a privacy notice, reduced-motion support.
Not deploying: Jeremy did not ask for a deploy.
