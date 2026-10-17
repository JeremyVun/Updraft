# Rendering continuity audit — 2026-10-17

Jeremy's brief (verbatim):

> Please audit the game for what I can only describe as rendering discontinuities. For example, then the state of the water suddenly changes while the child is entering or existing an island. I think i saw a few on some islands but I can't remember which ones

The journey requires slow, continuous transitions and an uninterrupted dream. This is an audit of visible
rendering changes, particularly island arrivals and departures; it does not change the settled appearance.

## Fixes and verification

Jeremy's follow-up (verbatim):

> good catches, they all need to be fixed.

The correction keeps ordinary reflections active across the journey, gives outgoing water its own continuous
visibility, admits the mirror kite during the approach, and blends sheltered fireflies and visual storm cover.
Land concealment and lightning triggers retain their story rules. Verification replays the four affected
handoffs from before they occur, follows the fades through completion, and checks the shared rendering paths.
The four affected desktop replays pass, including twelve seconds after each handoff. Sleeping arrival also
passes at 390×844. Home passes its High landscape/portrait, Medium and Low reflection checks. Meadow's
departure also retains continuous water and reflection. The findings below describe the original audit build.

- **Sleeping departure:** `Water.update` no longer uses the meadow's south-coast position as a global reflection
  cutoff. Ordinary reflections remain active at their quality tier's cadence. Across the original frame 389,
  reflection stays on; only its target resolution changes. The adjacent images retain the same sheen.
- **Sleeping arrival:** `WaterRooms` (`src/world/water/rooms.ts`) retains outgoing water and eases its contribution
  away over six seconds, separately from land and props. It starts at 0.99999976 on the landing frame, rather than
  dropping to zero. The camera has moved on before the contribution finishes receding. The shader's hidden-land
  early exit is disabled for these retained shallows, so concealed terrain cannot leave black water.
- **Sky mirror arrival:** the destination kite is enabled on `toMirror`, under the same room and mist cover as its
  stage. It is already flying in the approach and remains visible at frame 1097. Its earlier activation on the
  departing sea remains concealed; those adjacent frames were inspected too.
- **Wood departure:** the sheltered firefly appearance, population and movement blend toward open-country
  values. Shelter changes from 1 to 0.9917 at the handoff instead of to 0. `StormWeather` takes the eased squall
  for visual cover and light, while its authored/ambient strike logic retains raw chapter weather. The sun-light
  change on the reproduced frame is about 0.3%, previously about 14%.

Corrected build and captures: `/tmp/updraft-render-fixes-LyH8LZ/` (`dist/`, port 5242 during verification).
The `arrival/`, `departure/`, `mirror/` and `wood/` folders retain adjacent frames, full per-frame traces and
one-second follow-up stills. `portrait-arrival/`, `home/` and `meadow/` contain the additional coverage.
`evidence.html` compares the four original and corrected handoffs, one adjacent frame at a time.

Passed: `npm run typecheck`, `npm run build`, QA build, `production-build-check`, `shader-check`,
`journey-reveal-check`, `boat-check`, `wood-logic-check`, and the new `rendering-continuity-check` at 10–120 Hz.
The new check also gates the saved browser traces for reflection continuity, outgoing water retention,
the kite preceding landing, and bounded firefly/lighting changes. All 8,710 frames across the six focused
replays pass, with no browser/GLSL errors. Home's four quality/viewport cases pass independently.
These checks and chronological stills cover the reproduced changes, not a full motion, Safari or device-performance review.

## Plan and evidence

1. Trace shared water, atmosphere, room visibility, reflection, and simulation-window state.
2. Exercise suspected handoffs from before they occur and inspect chronological frames at the changes.
3. Distinguish reproduced defects from code risks, existing fixes, and transitions not visually covered.

Frozen QA build `de334914-dirty` and disposable evidence: `/tmp/updraft-render-audit-u1Ejuq/`; the audit used port 5241.
The shared checkout already contained unrelated edits; the original audit made no game source changes.
Repository Chrome for Testing capture workflow applies. Frame sequences establish discrete jumps; they do
not substitute for reviewing motion or a complete player journey.

## Original findings

Four visible discontinuities were reproduced: two water changes at the sleeping island, a kite appearing
at the sky mirror, and fireflies changing appearance at the dark wood. The wood's lighting also cuts on
that frame. The two water changes most directly match Jeremy's description and should be corrected first.

### Confirmed: water reflection switches on leaving the sleeping island

`sleeping-departure.json`, frames 388 → 389, `sleeping-departure-events-02-{before,after}.jpg`.
The boat has just left the beach. A broad area of water changes from a relatively even blue surface to
visible reflected sky and shore in one frame, 72 frames (1.2 seconds) after the chapter becomes `toMirror`.

`Water.update` (`src/world/water.ts:727–738`) enables reflections for either a visible Mirror room or its
nearby flat, otherwise only south of the meadow-coast cutoff (or at Home). The sleeping shore is outside
that cutoff. `JourneyReveal` admits the Mirror room after its 1.2-second cover interval, changing
`uJourneyRooms` from `[9,-2]` to `[9,10]`, `uMirrorOn` from 0 to 1, and the reflection target from 1×1 to
960×600. The quality stays fixed and the sea-effects reflection weight is already 1, so it cannot soften
this switch. This is separate from the intended gradual increase in wave strength. A second run in
`sleeping-control/` reproduced the same frame and re-rendered it with only `uMirrorOn` restored to zero;
`sleeping-departure-events-02-withoutReflection.jpg` removes the new sheen at the identical camera/time.

Suggested correction: scope the inland reflection optimization to the meadow, or otherwise retain/fade
ordinary coastal reflections continuously. Enabling the distant Mirror room should not change nearby sea.

### Confirmed: a water-region boundary appears on arriving at the sleeping island

`toSleeping.json`, frames 1308 → 1309, `toSleeping-events-05-{before,after}.jpg`.
At the crossing-to-island handoff, a curved patch on the left becomes dark open water and loses its surf.
The camera moves only about 8 mm. Reflection remains off, swell stays 0.25, and sea state stays 1.

The visible rooms change from wood + sleeping (`[8,9]`) to sleeping alone (`[9,-2]`).
`visibleRooms` and `JourneyReveal` (`src/world/journey-rooms.ts`) drop outgoing rooms immediately;
the reveal veil only covers incoming rooms. `roomHides` then switches the water's `inside` weight to zero
(`src/world/water.ts:300–311`), replacing local seabed depth and shore distance with deep-sea defaults
throughout the removed room's coast-distance partition. That partition extends into visible open water.

Suggested correction: preserve or blend the outgoing water contribution until it is concealed, including
its offshore boundary; hiding land must not instantaneously recolour a visible region of sea.

### Confirmed: the sky mirror's departure kite pops into an already visible view

`toMirror.json`, frames 1096 → 1097, `toMirror-events-15-{before,after}.jpg`.
The far landing stage is already visible on the approach. Its kite and reflected kite appear together on
the first `mirror` frame. The water surface itself stays continuous at this handoff.

`DepartureKites.update` enables the current chapter's marker, whereas the incoming crossing only enables
the marker belonging to the shore behind it (`src/story/departure-kites.ts`). The Mirror chapter declares
`departureKite = true`; `Kite.update` changes `group.visible` directly. This is a smaller scenery pop, with
a clear cause, rather than a sea-state change.

Suggested correction: introduce the destination marker during its approach under the same visibility
conditions as its landing stage, or make its later appearance a continuous reveal.

### Confirmed: fireflies change size and brightness on leaving the dark wood

`wood-final/wood-departure.json`, frames 251 → 252, `wood-departure-events-00-{before,after}.jpg`.
At the `wood` → `toSleeping` handoff, numerous conspicuous bright fireflies appear around the boat and
shore. The camera moves about 2 cm. The corrected replay starts with the boarding camera already settled;
the earlier `wood-departure.json` run is excluded from visual evidence because its setup camera was moving.

Main passes `story.name === 'wood'` directly as the fireflies' sheltered flag (`src/main.ts:1122–1124`).
`Fireflies.update` changes `uShelter` from 1 to 0 immediately (`src/fx/fireflies.ts:95`), switching the
vertex shader from small, distance-capped points to roughly three-times-larger open-country sprites.
Their colour, intensity, population and roaming range also switch immediately. The presence fade does
not smooth this change in appearance.

At the same handoff, raw storm cover cuts from 0.15 to 0 and the sun-light uniform increases about 14%,
while the eased squall barely changes (0.3027 → 0.3002). The wood's storm approaches 0.15 while leaving;
`toSleeping` starts with storm 0. Main eases `squall` for palette and swell but passes raw `storm` to
`StormWeather.update` (`src/main.ts:930`, `src/fx/storm.ts:28`). This produces a separate abrupt lighting
change. Its visible contribution is subtler than the fireflies and has not been isolated by a control render.

Suggested correction: blend sheltered firefly appearance and population as the boat leaves the wood,
and use continuous weather state for visual storm cover and lighting. Keep authored lightning triggers
separate from that smoothing.

### Other relevant changes

- Arriving at Little Boats changes the ambient sea-state target from 1 to 0.5; arriving at the stairs
  changes it from 1 to 0.35. Leaving the sleeping island changes it from 0.3 to 1. They affect the whole
  visible sea, but ease at 0.45/s (about 5.1 seconds for 90% of the change). Their broad change in character
  could contribute to Jeremy's impression; it is distinct from the confirmed one-frame defects above.
- The separately recorded cloud descent discontinuity is in
  [the fog diagnosis](backlog/path-puzzles/fog-diagnosis.md). Its continuous replay establishes fog/light,
  camera-pocket and sail changes at the hidden relocation before `drowned:enter`. Another active session
  is correcting that handoff; this audit does not duplicate its source edits or claim its final result.

## Coverage and reproduction

`tools/rendering-continuity-audit.mjs` seeds a late approach or a pre-boarding state, then records the real
boat/chapter/render loop. Every frame logs water/atmosphere state and a 160×100 image difference; discrete
switches save adjacent 1280×800 images. Whole-image scores are screening aids, not defect verdicts:
the sleeping arrival and distant kite are locally visible changes with small whole-frame averages.
Early camera/window settling after a seeded placement is excluded from findings.

```sh
npx vite preview --mode qa --outDir /tmp/updraft-render-audit-u1Ejuq/dist --port 5241 --strictPort
# In another terminal:
BASE=http://127.0.0.1:5241/ CASE=toSleeping OUT=/tmp/<audit-dir> node tools/rendering-continuity-audit.mjs
BASE=http://127.0.0.1:5241/ CASE=sleeping MODE=departure OUT=/tmp/<audit-dir> node tools/rendering-continuity-audit.mjs
```

| Transition | Result in the inspected view |
| --- | --- |
| Arrivals at Lines, Little Boats, Meadow and Birches | No comparable water cut at the handoff. |
| Stairs arrival | Corrected replay retained the handoff (frames 731 → 732); no comparable water cut. |
| Sleeping arrival | Visible water partition cut, described above. |
| Sleeping departure | Reflection switches on; independently repeated and isolated with a control render. |
| Sky mirror arrival | Kite and its reflection appear abruptly. |
| Dark wood departure | Firefly appearance switches; storm lighting also changes abruptly. |
| Meadow departure | No reflection switch in the corrected camera replay. |
| Home arrival and disembark | Existing reflection regression passed; stills inspected. |

The initial Meadow departure replay crossed the reflection cutoff while its camera settled from an
incorrect setup pose. `meadow-final/` starts from the boarding shot and retains `uMirrorOn = 0` throughout;
the earlier toggle is excluded from findings. Its artificial setup also bypassed the normal plane return
and allowed a throw before boarding, so the plane's disappearance in that run is not a gameplay finding.
The capture tool now holds the plane through setup. Every completed capture has no page errors.

These are focused desktop captures at a fixed render scale, with the full sea effects enabled. They do
not establish whole-journey motion continuity, all camera angles, portrait/Safari behavior or every possible
player gust. `home-water-check` passed its High/1440×900 approach-and-disembark case, retaining fresh
reflections through the target-size change; its stills were inspected. The original audit made no gameplay
or rendering source changes; the corrections and expanded verification are recorded above.

Existing `journey-reveal-check` verifies incoming concealment, but explicitly expects immediate removal
of the outgoing room at landing. It does not inspect the visible offshore water affected by that removal.
The sleeping-region regression needs local image coverage, not just an average across the whole frame; the
new continuity check and retained arrival images provide that complementary coverage.

The four original findings are now corrected. The shared room-mask and reflection paths were also
checked on Meadow's departure and Home's arrival and disembark.
