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
- **Performance** ([backlog/perf-bakes](backlog/perf-bakes/)): every phase is built and merged, including phase 6
  (the sleeping island's baked noise tile), the sea round (S1, S3, S4) and one reverb (X3). What remains is the
  backlog's close stage (phase 7).

## Open

For Jeremy's eye, ear or hands:
- A listening pass through the whole journey on headphones and a phone speaker ([contracts/audio.md](contracts/audio.md)).
- The whale shot on the first crossing: a glance from behind the boat, small in frame.
- The child's pigtails, the hood's side line and the open bag flap, seen in a level from the play camera in motion
  ([child.md](child.md)).

Known issues:
- The storm reaches the dark wood about 15 s late (56 s from the weather's start, against 38 to 44): since the
  beach landings, the boat sheds its way about 10 m out from the wood's shelving shore and drifts sideways in the
  breeze before its forefoot finds the bottom. `boat-check` and `drowned-camera-check` fail on it.
- The little boats: the orange toy loses its way abruptly at a pool handoff (`little-boats-logic-check`, 30 fps from
  arrival), since commit 1e0d470.
- Home: a departing adult swan passes 1.73 m from the cygnet against the check's 1.8 m (`flock-flight-check`), since
  the pigtails commit shifted the start.
- The season stays at 0.92 to 1 after the sleeping island, so home's grass is still aged, although the curtains
  opening is meant to turn winter to spring.
- The meadow swans lift off by themselves from the far end of the raft while the child is on the rise. Jeremy's note
  asked for the camera to show them "getting skittish and flying away"; worth a look that it still reads that way
  (`Flock.lift` has an unused `startledBy`).
- The stairs loop sounds the questioning peep and a distress call together each time round.
- The sky mirror: a faint speckled patch on the water beyond the departure jetty, looking toward the sun on the way
  in. Not traced.
- The boat: boarding lifts the lead foot about 0.6 m over the side, more hop than step (`boarding.stepArc`,
  `railHeight`; [boat.md](boat.md)).
- The child: unchecked that a resumed save with the cygnet in the bag starts with the flap open.

Checks ([testing.md](testing.md)). On `main`, 11 of the 49 mechanics checks fail and 2 of the 17 audio checks; the
browser group has not been run. Branch `checks-fix` (not merged) brings the stale ones up to date: `shader`
(the child shader's six descending `smoothstep`s, rewritten as exact equivalents), `progress-schema` (baseline moved
to the last save change), `chapter-view`, `kite-logic` and `plane-routing` (the stairs and the Lines shore),
`journey-pacing` and `wood-logic` (embers light in about two seconds), and the meadow, birches and sea
`*-score-browser-check`s (those rooms have no cursor chimes). Still failing for real: `boat`, `drowned-camera`,
`little-boats-logic` and `flock-flight` (above). Not yet looked into: `audio-check` ("player wind is 3 dB softer
after departure") and `birches-score-check` (its fixture has no cygnet). `cygnet-gates` passes three runs in three.

Engineering, not scheduled:
- Startup builds and warms the whole archipelago before Begin, and the main chunk carries a bundle-size warning.
- No graphics-memory budget for older iPads (grass tables about 28 MiB, static atlases about 26 MiB).
- Startup and audio wiring could move out of `main.ts` in small steps.

## Later

- A second companion: Jeremy would "eventually like to add another animal later one and make this a much more
  involved and immersive experience." The companion system is general for this reason
  ([journey.md](journey.md#the-companion)).
- The turn of the year could reach further: the season ages the grass, but not yet the trees, flowers, sky palette
  or light.
