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

## Visual polish review — 2026-10-01

Jeremy's brief:

> "have a look at the game and see if you can see anything we can make better. For one, i noticed that on the stairs chapter, the secont step from the top for the flights that the player moves has some kind of z level collision, causing flashing of the textures"

He clarified: "Vertical front of the step".

The first pass sampled chapter entrances rather than reviewing complete interactions. Jeremy rejected the
paper-plane and grass criticisms: "do you see them as being an issue? I don't...?" Leave both as they are;
neither still demonstrated a problem. The review now follows actual play in motion and requires reproducible
evidence before calling something a defect. Preserve the journey's readable companions and uninterrupted
atmosphere (`journey.md`). The stairs' landing-mist intersection is covered by the focused fix (`stairs.md`).

The continuous replay also exposed a camera reversal at the piano's final answer: the third response's wide
view reset to the close playing view before widening again. The handoff now starts at the already earned view;
`piano-frame-check` covers the fourth answer and the start of the final reveal, not just subjects staying in frame.
The corrected desktop replay passed four real sweeps, idle non-completion, colour rewards and departure;
chronological frames confirm that the finale widens from the third response without pulling inward first.
The focused camera regression also passes in landscape and portrait; typecheck and the production build pass.

The desktop review followed real pointer gestures through every chapter, with video, chronological frames and
camera traces. The first recording's browser closed during the drowned village; Continue resumed its saved
checkpoint and completed the remaining journey, the closing screen, completed-save reload and Play again with
no reported game errors. All three movable stair flights docked and all four mirror stars returned. This is
coverage across two runs, not one uninterrupted pass. The driver knows puzzle targets, so it does not establish
first-time discoverability; this pass also does not cover listening or performance on other devices.
Evidence is in `/private/tmp/updraft-motion-review-Sww9sA/` (`journey` and `continued`).

## Later

- A second companion: Jeremy would "eventually like to add another animal later one and make this a much more
  involved and immersive experience." The companion system is general for this reason
  ([journey.md](journey.md#the-companion)).
- The turn of the year could reach further: the season ages the grass, but not yet the trees, flowers, sky palette
  or light.
