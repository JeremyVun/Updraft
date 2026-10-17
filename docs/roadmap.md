# Roadmap

## Where it stands

The whole journey is built and plays end to end, from the still island to the red door and the closing line, and it is
live at https://updraft.jeremyvun.com. The work now is polish before a wider release: Jeremy playtests, lists what
he finds, and each item is fixed and surgically verified. A defect needs reproducible evidence from actual play in
motion, not a sampled still: Jeremy ruled the paper plane and the grass fine as they are. Sharing plans and the proposed Steam release are in
`docs/launch.md` (local only).

## In progress

- **Startup** ([backlog/boot-veil](backlog/boot-veil/)): since the stairs, the loading veil freezes for over half a
  second while the game boots (`start-check` fails). Compilation scheduling, staged construction and the progress
  line are implemented; the original phase 4, physical-device verification and 500 ms smoothness target remain open.
- **More to do on the path** ([backlog/path-puzzles](backlog/path-puzzles/)): puzzles on the main path so players
  don't feel there is not enough to do. Choosing ideas room by room.

## Open

For Jeremy's eye, ear or hands:
- A listening pass through the whole journey on headphones and a phone speaker ([contracts/audio.md](contracts/audio.md)).
- The whale shot on the first crossing: a glance from behind the boat, small in frame.
- The child's pigtails, the hood's side line and the open bag flap, seen in a level from the play camera in motion
  ([child.md](child.md)).
- The birches: a playthrough of the squirrel's hide-and-seek; Red Door's level on the island, its fade and the quiet
  sea before the stairs song, and the stairs song's ending at a phrase end below the white (`birchesSailFade`,
  `stairsSongRest`, `stairsSongEndFade`; [contracts/audio.md](contracts/audio.md)). The island grew and gained a squirrel, heaps
  and loose leaves; its cost is for his profiling session.
- The stairs: the sail's air over the cloud, heard in the game ([stairs.md](stairs.md)).
- A playthrough on the iPad for performance: smoothness on Auto, heat and battery. It also settles whether the
  child's bone texture moves before the frame's passes ([engine.md](engine.md), Open).

Known issues:
- The sky mirror: a faint speckled patch on the water beyond the departure jetty, looking toward the sun on the way
  in. Not traced.
- The boat: boarding lifts the lead foot about 0.6 m over the side, more hop than step (`boarding.stepArc`,
  `railHeight`; [boat.md](boat.md)).
- The child: unchecked that a resumed save with the cygnet in the bag starts with the flap open.
- The stairs' wisps: a respawned rag keeps the radius it was created with (`aRadius` is fixed at creation in
  `world/stairs-puffs.ts`).
- `scarf-check`: the birches' bow (tangle 4) takes 5–9 scripted strokes, so a full run's five-stroke limit fails now
  and then; a rerun passes.
- `storm-check` can fail under heavy machine load ("Plane did not disappear into the storm"), on old and new builds.

Checks ([testing.md](testing.md)). The 2026-10-11 merge run and focused fixes leave passing results for all 63
mechanics and 19 audio checks; the inherited pond-framing and marine-audio failures are fixed
([review](backlog/path-puzzles/final-review.md)). The full browser/release suite has not been rerun. The earlier
`start-check` failure on the veil's boot freeze remains open ([backlog/boot-veil](backlog/boot-veil/)).

Engineering, not scheduled:
- The main chunk carries a bundle-size warning.
- No graphics-memory budget for older iPads (grass tables about 28 MiB, static atlases about 26 MiB).
- Startup and audio wiring could move out of `main.ts` in small steps.

## Later

- Optional secrets, one hidden per room for players who want more to do ([backlog/secrets](backlog/secrets/)).
  Seeded, not designed.
- A second companion: Jeremy would "eventually like to add another animal later one and make this a much more
  involved and immersive experience." The companion system is general for this reason
  ([journey.md](journey.md#the-companion)).
- The turn of the year could reach further: the season ages the grass, but not yet the trees, flowers, sky palette
  or light.
