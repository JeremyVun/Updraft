# Roadmap

## Where it stands

The whole journey is built and plays end to end, from the still island to the red door and the closing line, and it is
live at https://updraft.jeremyvun.com. The work now is polish before a wider release: Jeremy playtests, lists what
he finds, and each item is fixed and surgically verified. Sharing plans and the proposed Steam release are in
`docs/launch.md` (local only).

## In progress

- **The stairs in the clouds** ([stairs.md](stairs.md)): the sail over the cloud and the way down into the mist are
  being redone to Jeremy's 09-28 notes (a view of the whole cloud sea and a less straight course, clouds that don't
  read as snow, no boat popping in as the camera breaks through, the boat nearer the jetty, no cloud changing state
  as it comes into range, no player wind needed while the pair enjoy the ride). Then the room needs a still and a
  name for the chapter select.
- **Performance, final pass** ([backlog/perf-final](backlog/perf-final/)): a fresh profile of the whole journey and
  savings wherever they can be found, so the game plays on more devices. In design; profiling comes first.
- **Startup** ([backlog/boot-veil](backlog/boot-veil/)): since the stairs, the loading veil freezes for over half a
  second while the game boots (`start-check` fails); and whether the veil has outgrown itself. In design.

## Open

For Jeremy's eye, ear or hands:
- A listening pass through the whole journey on headphones and a phone speaker ([contracts/audio.md](contracts/audio.md)).
- The whale shot on the first crossing: a glance from behind the boat, small in frame.
- The child's pigtails, the hood's side line and the open bag flap, seen in a level from the play camera in motion
  ([child.md](child.md)).

Known issues:
- The sky mirror: a faint speckled patch on the water beyond the departure jetty, looking toward the sun on the way
  in. Not traced.
- The boat: boarding lifts the lead foot about 0.6 m over the side, more hop than step (`boarding.stepArc`,
  `railHeight`; [boat.md](boat.md)).
- The child: unchecked that a resumed save with the cygnet in the bag starts with the flap open.

Checks ([testing.md](testing.md)). On `main` every mechanics (49) and audio (17) check passes, and 7 of the 8 browser
checks; `start-check` fails on the veil's boot freeze ([backlog/boot-veil](backlog/boot-veil/)). `cygnet-gates`
passes three runs in three.

Engineering, not scheduled:
- The main chunk carries a bundle-size warning.
- No graphics-memory budget for older iPads (grass tables about 28 MiB, static atlases about 26 MiB).
- Startup and audio wiring could move out of `main.ts` in small steps.

## Later

- A second companion: Jeremy would "eventually like to add another animal later one and make this a much more
  involved and immersive experience." The companion system is general for this reason
  ([journey.md](journey.md#the-companion)).
- The turn of the year could reach further: the season ages the grass, but not yet the trees, flowers, sky palette
  or light.
