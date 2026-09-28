# Updraft

A browser game where you play the wind. You sweep your hand and the air moves: every blade of grass, petal, cloud and
ripple on the sea is driven by one live wind simulation, so the whole world answers your gesture. The first test for
every build is the 30-second test: someone who has never seen it waves their hand and grins before they know what the
goal is.

Atmosphere and visuals make or break this game. Beauty should come from simulation and light, not from a mountain of
hand-made assets. The nearest existing game is thatgamecompany's *Flower*; Updraft differs in the child and the cygnet
you look after and the wordless story you lead them through.

## The game

A child and an injured swan cygnet travel home through a dream archipelago: the still island, the island of lines, the
little boats, the meadow and its piano, the birches, the stairs in the clouds, the drowned village and the storm, the
dark wood, the sleeping island, the sea, the sky mirror and home, with crossings between them. Wind gestures restore
each place, help the companion and carry the boat onward. Checkpoints save locally; once the game is finished, the
title screen offers a chapter select. It is live at https://updraft.jeremyvun.com.

The vision and story: [journey.md](journey.md). Each room: [chapters.md](chapters.md). What is left:
[roadmap.md](roadmap.md). The look: [styles.md](styles.md).

## Decisions

- Browser, Three.js + TypeScript + Vite. Mouse, trackpad and touch.
- The wind is a real 2D fluid simulation over the ground plane (GPU stable fluids with vorticity confinement).
  Everything that moves reads it; nothing fakes its own wind ([contracts/wind.md](contracts/wind.md)).
- Cursor movement is the only verb: moving makes a gust; tracing circles raises an updraft. Holding still does not
  charge anything.
- The player pushes what they see: a stroke over something on screen moves it, even though the ray meets the ground
  behind it.
- No failure states, no timers that solve a beat, nothing that can be lost for good.
- Sound starts from Begin or Continue after a click, tap or key. The speaker button and M toggle it, and the choice
  persists. All sound is generated with Web Audio; there are no sound files.
- Player-facing text drafts and Jeremy's choices on them are in [copy/](copy/). Gameplay has no instructional text;
  the start screen, chapter select, controls, recovery dialog and closing line do.
- Out of scope, by Jeremy's ruling: keyboard-only play, a privacy notice and reduced-motion settings.
- Accepted as they are, by Jeremy's ruling: the long crossing's quick turn from midday to sunset, the darker circle of
  grass around the cottage and the dark wood's brightness.

## Shape

- `src/wind/`: the wind simulation and the grass lean and sway fields on the GPU, plus a CPU copy for gameplay.
- `src/world/`: terrain, grass, sea, sky, clouds and every room's world module; shared shader code in `atmosphere.ts`.
- `src/story/`: the chapters, the journey that runs them in order, checkpoints and progress.
- `src/traveller/`: the child, the boat and the drawing. `src/creatures/`: the cygnet, the swans and the island
  wildlife. `src/companion/`: what the child and the cygnet do with each other.
- `src/glider/`: the paper plane. `src/fx/`: petals, leaves, embers, wind lines, invitations and other effects.
- `src/input/`: pointer gestures and the cursor. `src/audio/`: the generated scores, foley and ambience.
- `src/gl/`: the engine layer: boot, readbacks, the quality governor, context recovery ([engine.md](engine.md)).
  `src/post/`: the image chain. `src/chapter-select/`: the finished player's chapter picker.
- Feel knobs: `src/tuning.ts`. Release checks: [testing.md](testing.md).
