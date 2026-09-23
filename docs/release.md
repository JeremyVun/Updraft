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

After seeing them:

> "- `The credits no longer scroll behind Play again` how did you fix this?
> - The dark band on sky mirror is fine right? Was that a deliberate artistic decision, or would you recommend fixing it and think there's a better visual look that we can have here?
> - On the cottage, i dont understand why this is an improvement unless you show me two webm recordings of this moment in the game to compare and contrast"

Then, on the before/after recordings: "yea good call. removing the dark band is approved". The band was not
deliberate (the Sky Mirror brief keeps an uninterrupted mirror), so it is removed; the cottage stays as it is.

## Work

Integration branch `release-0923` in `/private/tmp/updraft-release`; `main` is untouched until the end.
Baseline for before/after comparisons: `12a220a` in `/private/tmp/updraft-base`.

| Item | Owner | Status |
| --- | --- | --- |
| Land `codex/production-hardening` (shader ramps, water textures, allocations, typed saves, check runner) | lead | merged `1fecb8b`; 12-scene render parity against `12a220a` passes |
| Stale regression checks | tests parcel + lead | nine stale fixtures updated (boat-ground, sea-logic, sea/lines/meadow/birches score, gesture-harmony, audio-continuity, audio-browser, progress companion); `audio` check group added |
| Failure paths, `_headers`, metadata, QA clamps, sound preference | shell parcel | audio start cannot block Begin; frame errors open the recovery dialog; entry-load watchdog; WebGL2/float capability gate; build-generated CSP + immutable assets; OG tags; clamped `ratio`/`msaa`/`grass`; sound choice persists |
| iOS interruptions, piano voices, pinwheel voice, deferred synthesis, foghorn, `sound.output` | audio parcel | cues held through interruptions (≤3 s replayed); reservations survive mute; pinwheel voice released; `start()` 59 → 12 ms; foghorn cue frame 26–107 → 1.2 ms |
| Auto at 30 Hz and 4K, readbacks, doorway target, touch flicks, pointer picking, offscreen village, allocations | engine parcel | proven 30 fps cap judged as such; 4K budget rung; pooled/sliced readbacks and no forced blocking map (saturated max frame 100–117 → 50 ms); doorway frees 61.8 MiB after the crossing; flicks keep their full stroke; picks 3–10× faster; village rests while the boat is far |
| Petals at the lens, canopy underside, sail/branch/kite occlusion, credits over Play again, shader hygiene, icons | lead | petals shrink within 1.5–5 m; daylight through the crown from beneath; kite/sail fade near the lens; the sail thins where it covers the child; birch branches dissolve at the lens; credits fade above Play again; rim/Fresnel clamps, guarded half vectors/bearings/rainbow angle, derivatives before early returns; favicon, touch icon, manifest |
| Mirror band; cottage proposal | lead | band removed: seen from the flat, the open sea turns to glass 40–110 m from the camera, so the mirror runs on to the horizon (render parity: only the mirror's horizon changes, 5.3% of pixels; other 11 scenes pass). Cottage proposal withdrawn: with a smaller pad the house sinks behind the slope from the brow and the ending waits there |

Out of scope by Jeremy's decision: keyboard-only play, a privacy notice, reduced-motion support.
Not deploying: Jeremy did not ask for a deploy.

## Verification (2026-09-23, integrated `release-0923`)

- Typecheck and production build pass. Check groups: quick 14/14, mechanics 50/50, audio 17/17, browser 8/8;
  also failure-paths, game-loop audio, power, and the full progress suite (48 cases). Render parity passes
  in all 12 frozen scenes; the only intended differences are the near-lens fades and the sail giving way.
- Full frozen-build journey: all 17 chapters, 43 checkpoints, credits, completed-save reload and Play again,
  no page or console errors. Chronological frames reviewed for petals, the canopy, landings, the birch walk,
  the kite and the ending.
- `wrangler dev` serves the CSP and security headers on every path and `immutable` caching on `/assets/*`;
  icons and the manifest are served with the right types.
- Back-to-back frame timing against `12a220a` (1440×900 at DSF 2, Auto chose 1.25× with 2× MSAA, 12 s each):
  Birches went from 11 hitched frames (p99 33.3 ms, worst 49.9 ms) to none (p99 16.8 ms); the sea's worst
  frame fell from 150 ms to 50 ms; the other nine chapters held 16.7 ms p50 / 16.8 ms p99 in both builds.
  Boot to ready is unchanged within noise (worst boot frame 267 vs 283 ms); whole-world construction before
  Begin remains the main startup cost. Desktop Chrome/Metal measurements, not an iPad result.
- Not verified here: a physical iPad (Low Power Mode quality, interruptions, touch flicks, Home Screen launch)
  and a listening pass.
