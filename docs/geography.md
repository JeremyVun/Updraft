# Current island distances

Snapshot of the local working tree on 2026-09-20, before any island relocation. This includes the recent
route edits. The distance snapshot is unchanged; the pacing section below records the subsequently
approved speed settings and a fresh simulation. No islands or routes were moved for that rerun.
This is not a measurement of the deployed build.

All distances are **horizontal world units**, not metres or seconds, rounded to one decimal place.

- **Centre spacing:** straight-line distance between the islands' layout centres. It includes their land area.
- **Direct crossing:** straight-line distance from the nominal departure berth to the arrival target.
- **Route length:** sum of the straight segments from that berth through the configured sailing waypoints.

These are not minimum shoreline gaps. Direct crossings can pass through land and are not proposed routes.
The boat rounds waypoints, moves during departure, drifts and may ground before the final target, so its
actual travelled distance differs from the route polyline. Walking and boarding are excluded.

## Sailing distances in journey order

| Passage | Direct crossing | Route length |
|---|---:|---:|
| Starting island → Lines / washing | 329.5 | 468.7 |
| Door shore → Little boats | 137.4 | 153.9 |
| Little boats → Meadow | 346.9 | 486.9 |
| Meadow → Birches | 77.4 | 77.7 |
| Birches → Drowned village channel entry | 61.0 | 61.0 |
| Through the drowned village channel | 392.0 | 457.2 |
| Drowned village channel exit → Wood | 47.4 | 47.4 |
| Wood → Sleeping | 100.3 | 112.8 |
| Sleeping → Sky mirror | 458.0 | 507.6 |
| Sky mirror → Home / summit | 525.6 | 586.6 |

Lines and washing are the same physical island. The red door transfers the travellers to a separate shore;
there is no sailed crossing between those two locations. The boat departs that shore for little boats.

The drowned village has no landing or boarding stop. The three village rows partition one continuous
passage from birches to wood: **565.6 route units**, versus **495.5 direct units** between its endpoints.
The village entry and exit are channel waypoints, not coastline intersections. The legacy `toWood` and
`toHome` routes are excluded: new journeys sail through the village to wood and visit the mirror before home.

The longest separate crossing is currently mirror → home. Little boats → meadow has about 140 units more
route than direct distance, whereas mirror → home has only about 61 extra units. That difference does not
establish which bends can safely be removed.

## Island centres and spacing

Coordinates are `(x, z)`. More negative `z` generally follows the early journey onward; the final ride from
the mirror turns back toward less negative `z` to reach the home jetty.

| Physical location | Centre `(x, z)` | Centre spacing from preceding row |
|---|---|---:|
| Starting island | (-6, -14) | — |
| Lines / washing | (14, -368.4) | 355.0 |
| Door shore | (240, -460) | 243.9 |
| Little boats | (350, -590) | 170.3 |
| Meadow | (10, -780) | 389.5 |
| Birches | (0, -1128) | 348.1 |
| Drowned village | (-10, -1440) | 312.2 |
| Wood | (-30, -1800) | 360.6 |
| Sleeping | (-175, -1922) | 189.5 |
| Sky mirror | (-455, -2310) | 478.5 |
| Home / summit | (-45, -2120) | 451.9 |

These are layout centres, not measured land centroids. The starting island uses the centre of its base
coastline ellipse; its coves and outlying rock make the shape asymmetric. The mirror is a submerged flat,
and the drowned village is submerged terrain. The meadow centre reflects the current 400-unit length,
not the older 600-unit sculpting coordinates.

Centre spacing is unsuitable for estimating sailing time: meadow → birches is 348.1 units between centres,
but only 77.7 along the sailing route from the meadow's far shore.

## Crossing endpoints

These nominal anchors define the measurements above. Values displayed here are rounded; the calculation
uses the source values at full precision.

| Passage | Departure `(x, z)` | Arrival `(x, z)` |
|---|---|---|
| Starting island → Lines | (8.5, 21.5) | (14, -308) |
| Door shore → Little boats | (240, -483.5) | (367, -536) |
| Little boats → Meadow | (353, -652) | (10, -600) |
| Meadow → Birches | (-0.7, -974.7) | (3, -1052) |
| Birches → Village channel | (-4, -1197) | (-6, -1258) |
| Through village channel | (-6, -1258) | (-4, -1650) |
| Village channel → Wood | (-4, -1650) | (-26, -1692) |
| Wood → Sleeping | (-34, -1908) | (-134, -1916) |
| Sleeping → Sky mirror | (-214.5, -1926) | (-515.7, -2271.1) |
| Sky mirror → Home | (-390, -2323) | (-45.3, -1926.3) |

## Approved speed and measured passage times

Jeremy approved ordinary sailing at **4.5–5.5 world units/s**, with a **10 units/s forward-speed ceiling**.
At the ordinary 2.6-unit breeze the sail produces 4.5, plus up to 1 with a following wind. Player gusts
can push toward 10. The earlier meadow, sea and home breeze multipliers are removed. Turns, acceleration,
beaching, mooring, the village's dramatic pacing and the cygnet's swim still slow the boat naturally;
4.5 is not a forced minimum through those moments. These settings are implemented locally.

The table uses the real boat and chapter code, starting at nominal departure berths. Walking and boarding
are excluded. Ordinary wind is steady at the usual bearing; the range checks bearings ±20 degrees.
The gust column is a sustained synthetic gust, not an estimate of a typical player's behaviour.
All eight passages complete at 30 and 60 fps; the 30 fps baseline differs by at most 0.1 seconds.
The sea rerun now includes the real dolphin pod and its boat nudge, rather than a sea-life stub.
The sea includes its full 32-second swim, preparation and recovery. The village baseline includes a
prompt wind response at the still-water interaction; no response takes about 198 seconds instead.
These CPU measurements do not reproduce every fluctuation of the live GPU wind field.

| Passage | Ordinary breeze | Wind-bearing range | Sustained gust | Recommended ordinary-breeze target |
|---|---:|---:|---:|---:|
| Starting island → Lines / washing | 96 s | 92–98 s | 47 s | Keep: 90–100 s |
| Door shore → Little boats | 27 s | 27–27 s | 17 s | Keep: 25–30 s |
| Little boats → Meadow | 99 s | 98–99 s | 62 s | **50–60 s; aim for 55** |
| Meadow → Birches | 21 s | 20–22 s | 13 s | Keep: 20–25 s |
| Birches → Drowned village → Wood | 106 s | 102–109 s | 94 s | Keep: about 100–110 s with prompt interaction |
| Wood → Sleeping | 27 s | 27–27 s | 15 s | Keep: 25–30 s |
| Sleeping → Sky mirror, including dolphin set-pieces and swim | 152 s | 151–153 s | 106 s — **misses dolphin nudge** | **135–145 s; aim for 140** |
| Sky mirror → Home | 122 s | 115–126 s | 63 s | **40–50 s; aim for 45** |

Targets are design recommendations, not achieved timings or validated replacement layouts. Size the routes
for the ordinary breeze: reaching the target must not require repeatedly blowing the sail. In particular,
meadow should stay below 60 seconds across the ordinary wind-bearing checks, with margin for live variation.
The current route still exceeds 60 seconds even in the sustained-gust fixture.

## Encounter sequences: the timing that must be protected

The earlier table included the swim and storm in its totals, but collapsed two playable chapters into
transfer rows. More importantly, the earlier 115–125-second sea recommendation omitted the dolphin's
post-swim nudge. **That recommendation is withdrawn.** Full pod simulation shows this is not 59 seconds
of expendable travel after the swim.

These are non-overlapping phases from the ordinary-breeze run. Dolphin event times vary with the pod's
random choreography. Village arrival here means rounding its first channel waypoint, not an exact
first-visible-roof time. Rounded rows may not sum exactly to rounded totals.

| Journey phase | Current time | Recommendation |
|---|---:|---|
| Birches departure → village channel entry | 11 s | Keep about 10–15 s; let roofs emerge |
| Village exploration before the wind dies | 33 s | Keep; houses, herons and spire need room |
| Becalmed interaction | 6 s with immediate sustained response | Player-paced; 6 s is a mechanical minimum, not a typical child response |
| Sail refills → storm begins among the last roofs | 14 s | Keep the moment of agency and onward discovery |
| Storm gathers; lighthouse fails at storm +19 s | 22 s | Keep the central lighthouse composition and building weather |
| Plane snatched | 4 s | Keep the child and departing plane together in frame |
| Loss and exposed approach → wood | 15 s | Keep the aftermath; do not land immediately after the loss |
| **Whole village passage, birches → wood** | **106 s with prompt response; 198 s with no response** | **Keep geometry and ~41 s storm; allow player response time** |
| Sleeping departure, dolphin arrival, bow riding and featured leap | 46 s | About 40–45 s; shorten only the gap after the complete leap |
| Cygnet anticipation, side-of-boat choice, swim and recovery | 47 s | Keep: 5 + 7 + 32 + 3.2 s |
| Dolphins resume play, nudge the boat and begin leaving | 27 s | About 25–30 s; protect contact, recovery and departure |
| Pod starts leaving → mirror mooring | 32 s | About 20–25 s; keep its fade-out and a quiet, curved arrival |
| **Whole sea chapter, sleeping → mirror** | **152 s** | **135–145 s; aim for 140** |

In the recorded ordinary run, the featured leap acts at 24 seconds and its dolphin rejoins by 30;
the cygnet's sequence starts at 46 and ends at 93. The nudge begins its approach immediately afterward,
makes contact at 108 and rejoins by 114. The pod starts leaving at 120; it fades over the following
seven seconds while the approach continues. The whale also surfaces from a 42-second trigger, overlapping
the cygnet sequence; it is not an extra additive 26-second phase. Preserve clear attention on the cygnet
rather than adding competing camera changes during its decision.

**Existing strong-wind omission:** the 106-second sea run keeps the leap and full swim but dismisses
the pod at 79 seconds, immediately when the swim sequence ends; the nudge never starts. Thus it is a
navigation-completion measurement, not a successful full-sequence benchmark. A future route edit must
gate departure on completion of the nudge as well as the swim and reserve safe water for both. Do not
call a shorter run a pacing improvement when it achieves it by losing an encounter. No game behaviour
was changed during this correction; only the measurement tool and documentation were updated.

For the village, about 100 seconds cover movement and authored story around the prompt six-second
interaction. A child taking longer to recognise or try the sail adds legitimate play time. Preserve
that room for response; do not enforce a 110-second chapter ceiling or speed up later to compensate.
The 90-second automatic fallback is not a desirable target duration.

## Route and camera recommendations — not implemented

**Keep the opening's long curve.** It has a reason to take time: leaving the cove, watching the restored
island recede, the child's farewell, the camera turning onward, then the whale and the new shore. A staged
renderer check shows the tree, kite, shoreline and foreground water sharing the farewell composition.
Keep the 30-second look back and gentle camera swing. The whale is currently triggered at 52 seconds;
the fast fixture arrives before then and misses it. A future passage edit should trigger that encounter
from route progress and leave enough distance for it to play after the farewell. Do not shorten this
crossing merely because it is longer than the others.

**Leave the door-to-boats, meadow-to-birches and wood-to-sleeping hops alone.** Their roughly 20–30 seconds
provide useful changes of rhythm. Keep the offset approach to the toy stream, the birches emerging from
haze, and the sheltered bend after the wood. Protect the hidden home jetty during that last passage.
Moving little boats will affect its incoming hop too; preserving its 25–30 seconds is a layout constraint.

**Little boats → Meadow: compress the middle water, preserve departure and arrival.** Budget roughly
10–15 seconds to leave the toy-boats shore, 20–25 for the curving transfer, and 15–20 to turn toward the
meadow bank and land. Keep the meadow's inland life concealed until the child climbs the bank. The staged
middle view at approximately (205, -569) puts the *washing island* across the horizon; hiding the separate
secret door shore has not removed that view. Avoid pointing the new passage back at that recognisable
island for a long stretch. A low bank entering obliquely, growing across the frame, then a gentle turn
into the beach gives the camera changing foreground, middle distance and destination.

Investigate moving **little boats and its local departure route toward the meadow**, preserving the
meadow's terrain and its short onward crossing to birches. Do not move the meadow independently. The
existing direct berth-to-landing distance is 347 units: even an unobstructed straight line takes 63–77
seconds at 4.5–5.5, before departure and landing. Removing bends alone cannot reliably meet 60 seconds.
A first layout study can budget roughly 240–290 route units, but the real boat simulation and view
sequence decide the result. If moving little boats spoils the short doorway approach, reposition that
separate departure shore coherently; this is a coupled layout change, not a one-island tweak.

**Sleeping → Sky mirror: treat it as a complete sea chapter.** Aim for 140 seconds rather than the
previous 120. Keep the pod's arrival, bow riding and near-side leap; then shift attention to the cygnet's
choice, full 32-second swim and return. Let dolphin play resume with the physical nudge, then release
the pod and reveal the mirror. The full simulation identifies only modest scope to tighten the opening
and roughly 7–12 seconds to remove from the final approach without abbreviating those moments.

Translate the mirror toward the final homeward approach while retaining a broad offshore arc into its
entry jetty. Its incoming arc may intentionally stay longer than the shortest safe line: the open horizon,
companionship and confidence need that distance. Judge the sea and home routes together. Do not shorten
the sea in proportion to the much larger cut justified for mirror → home. Keep the dolphin and swimmer
framing, ease attention back to the boat for the nudge, then let the mirror emerge after the pod leaves.

The existing minimum swim start at 32 seconds protects the opening leap in the strong-wind check. It
does **not** protect the later nudge, or guarantee that a shorter route leaves space for the full swim.
Use encounter completion and enough safe water, not route percentage alone, to order the next passage.

**Sky mirror → Home: keep the coastal reveal, remove most of the long approach to it.** Budget about
8–12 seconds leaving the reflected lights, 15–20 for an oblique approach and headland turn, then 15–18
along the sheltered coast to the jetty. The staged current views show a useful sequence: wide water,
then banks framing a narrowing channel, then the jetty crossing into view. Preserve that sequence and
its slow mooring. The destination should become clear late enough to feel like an arrival, with the
child and cygnet still readable beside the sail. Do not spend another minute establishing open water
after the sea chapter has already done that work.

The current 526-unit direct distance takes at least 96 seconds even at 5.5; smoothing the 587-unit route
cannot produce a 45-second homecoming. Explore the mirror nearer the **western approach to the home
channel**, retaining separation from sleeping and home and enough concealed water for its incoming
encounter. An initial homeward route budget is approximately 180–230 units, subject to mooring time and
terrain. No exact mirror coordinates are endorsed yet: fitting its full flat without colliding with
neighbouring land and preserving both approaches is the design problem.

**Keep the drowned village's channel and storm.** Its houses, spire and lighthouse are the chapter,
not excess transfer distance. The storm-to-wood sequence still measures about 40–42 seconds across
wind tests. Preserve the bends that reveal these landmarks, the beam's failure and the plane's loss.

## Evidence and acceptance of a future layout

Current recommendations combine route geometry, chapter/camera code, real CPU passage simulations and
staged renderer views at 1440×900 and 390×844. Staged captures inspect compositions; they are not continuous
playthroughs and do not validate camera transitions. Temporary captures are `/tmp/updraft-pacing-*`, with
shot positions in `/tmp/updraft-pacing-views.json`. The staged sea views disable encounters and are not
used to judge dolphin/swim framing; `tools/sea-logic-check.mjs` separately checks the real encounter's
camera projection and full swim at ordinary and strong wind, including portrait. The expanded
`tools/journey-pacing-check.mjs` runs the real pod and records each leap/nudge phase and its departure;
this is what exposed the missing strong-wind nudge.

Before accepting relocated geography:

- Translate each island's terrain, objects, paths, berths and region masks coherently. Audit absolute
  coordinates and procedural terrain sampling; keep its shape rather than reseeding it by accident.
- Measure both incoming and outgoing passages at ordinary wind, varied bearings and sustained gusts.
  Verify collision clearance, CPU/GPU height parity, checkpoint restoration and mooring.
- Watch each whole approach in landscape and portrait. Judge the sequence of views and camera turns,
  not only attractive still frames. Keep the travellers readable beside the sail, avoid early reveals
  of the door shore/home jetty, and ensure the dolphin and whale encounters have time to play.
- Save comparison captures at departure, each meaningful turn, first destination reveal and arrival.
  Prefer a few additional seconds of a changing, purposeful view over a shorter but abrupt approach.

## Sources and reproduction

Run `node tools/geography-report.mjs` from the repository root. It imports the current layout exports and
prints centres, distances, full waypoint lists and pacing settings as JSON without modifying the game or saves.
Run `node tools/journey-pacing-check.mjs` for the separate boat simulation; its JSON report is written to
`/tmp/updraft-journey-pacing.json`. The geography report itself does not run a boat simulation. For each segment it uses `sqrt((x2-x1)^2 + (z2-z1)^2)`; route length is
the sum of those segments.

- [Island centres and terrain](../src/world/heightfield.ts): `ISLES`, `DOOR_SHORE`, starting coastline ellipse.
- [Sailing routes](../src/story/journey.ts): `ROUTES`; [crossing](../src/story/crossing.ts): meadow arrival.
- [Starting berth](../src/story/island.ts), [door shore berth](../src/world/lines-passage.ts),
  [little boats layout](../src/world/little-boats-layout.ts), [meadow far shore](../src/story/meadow.ts).
- [Birches](../src/world/birches.ts), [village channel](../src/world/drowned.ts),
  [wood](../src/world/wood.ts), [sleeping](../src/world/sleeping.ts).
- [Mirror layout](../src/world/sky-mirror-layout.ts), [home mooring](../src/story/home.ts),
  [pacing settings](../src/tuning.ts).

Re-measure both adjoining routes whenever considering a moved island. These numbers describe the current
layout; they do not validate future clearance, visibility, checkpoint compatibility or chapter timing.
