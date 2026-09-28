# Roadmap

## Where it stands

The whole journey is built and plays end to end, from the still island to the red door and the credits, and it is
live at https://updraft.jeremyvun.com. The work now is polish before a wider release: Jeremy playtests, lists what
he finds, and each item is fixed and surgically verified. Sharing plans and the proposed Steam release are in
`docs/launch.md` (local only).

## In progress

- **The stairs in the clouds** ([stairs.md](stairs.md)): the sail over the cloud and the way down into the mist are
  being redone to Jeremy's 09-28 notes (a view of the whole cloud sea and a less straight course, clouds that don't
  read as snow, no boat popping in as the camera breaks through, the boat nearer the jetty, no cloud changing state
  as it comes into range, no player wind needed while the pair enjoy the ride). The room also needs a still and an
  approved name for the chapter select, and its sound awaits Jeremy's audition.
- **Performance** ([backlog/perf-bakes](backlog/perf-bakes/)): every approved phase is merged. Phase 6 (baking the
  fine ground grain and noise, which changes the look) waits for Jeremy's approval; then the backlog's close stage.

## Open

For Jeremy's eye, ear or hands:
- A listening pass through the whole journey on headphones and a phone speaker ([contracts/audio.md](contracts/audio.md)).
- The whale shot on the first crossing: now a glance from behind the boat, smaller in frame than the old broadside.
- The child's pigtails, the hood's side line and the open bag flap, seen in a level from the play camera in motion
  ([child.md](child.md)).
- On a physical iPad: battery drain, warmth and sustained frame intervals on High against Auto, and Safari's
  fullscreen-dismiss swipe ([engine.md](engine.md)).

Known issues:
- The sky mirror: a faint speckled patch on the water beyond the departure jetty, looking toward the sun on the way
  in. Not traced.
- The boat: boarding lifts the lead foot about 0.6 m over the side, more hop than step (`boarding.stepArc`,
  `railHeight`; [boat.md](boat.md)).
- The child: unchecked that a resumed save with the cygnet in the bag starts with the flap open, and the lap pose at
  the summit.
- `cygnet-gates` misses its limits by a few thousandths from run to run (the gather's jerk and turn); nothing visible.
- The meadow, birches and sea `*-score-browser-check`s wait for a cursor chime those rooms no longer have, so they
  time out ([testing.md](testing.md)).

Engineering, not scheduled:
- Startup builds and warms the whole archipelago before Begin, and the main chunk carries a bundle-size warning.
- No graphics-memory budget for older iPads (grass tables about 28 MiB, static atlases about 26 MiB).
- Startup and audio wiring could move out of `main.ts` in small steps.

## Later

- A second companion, which Jeremy wants eventually "to make this a much more involved and immersive experience".
  The companion system is general for this reason ([journey.md](journey.md#the-companion)); the birches were once
  proposed as where one would join.
- The turn of the year could reach further: the season ages the grass, but not yet the trees, flowers, sky palette
  or light.
