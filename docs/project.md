# Updraft

A browser game where you play the wind. You sweep your hand and the air moves: every blade of grass, petal, cloud and ripple on the sea is driven by one live wind simulation, so the whole world answers your gesture. The first test for every build is the 30-second test: someone who has never seen it waves their hand and grins before they know what the goal is.

Atmosphere and visuals make or break this game. Beauty should come from simulation and light, not from a mountain of hand-made assets.

## The full game (direction, not yet built)

- A small traveller (a kid on a kite-boat, or a paper glider in the prototype) crosses a grey, lifeless archipelago. You cannot steer them directly, only the air around them.
- You restore islands with a few interacting elements: push rain clouds over dry soil, carry seeds there, fan a fire to clear deadwood or snuff it before it reaches a forest, build dunes to shelter saplings.
- The world remembers. Forests you grow become windbreaks that change how air flows, so earlier islands shape later ones. By the end, the map is a place you grew.
- Gusts play generative music: speed and direction pick pitch and chord, so skilful play sounds better.
- No harsh fail states. Challenge comes from optional trials (threading a glider through a canyon), never from losing progress.

The closest existing game is thatgamecompany's *Flower* (2009), which also has you blowing wind over grass. Updraft differs in the traveller you look after, the chain reactions between elements and a persistent world you reshape.

## Decisions (2026-09-15)

- Platform: browser, Three.js + TypeScript + Vite. Mouse, trackpad and touch.
- The wind is a real 2D fluid simulation over the ground plane (GPU stable fluids with vorticity confinement). Everything that moves reads it; nothing fakes its own wind. See `contracts/wind.md`.
- Two verbs. Moving or dragging the pointer makes a gust along the path. Pressing and holding still raises an updraft: a rising, swirling column that lifts petals and the glider.
- The player pushes what they see. A stroke over the glider carries it, even though the air under the cursor is pushed on the ground behind it.
- The glider can't be lost. Past about 50 units from the island it banks around and comes home, and it never crashes; it skims the grass or settles in it until a gust lifts it.
- First milestone is a single island at golden hour: a grass meadow, flower patches, one tree on the ridge, rocks, petals, a paper glider, wind lines and sound, with the grey archipelago in the distance. See `roadmap.md`.
- Sound is off until the player clicks or taps (browsers require a gesture). The first press anywhere turns it on; the speaker button and the M key toggle it.
- Player-facing text is drafted by Astra and approved by Jeremy (`copy/`). The game shows no text on screen. Astra's first draft (`copy/copy-1.json`) keeps the title "Updraft" and labels the sound button "Sound"; it awaits Jeremy's verdict.

## Shape

- `src/wind/`: the wind simulation and the grass lean field on the GPU, plus a CPU copy for gameplay. `contracts/wind.md`.
- `src/world/`: island shape, grass, sea, sky, clouds, the tree, rocks, distant islands, baked shadows, and the shared atmosphere shader code (`atmosphere.ts`).
- `src/fx/`: petals and wind lines.
- `src/glider/`: the paper glider.
- `src/input/`: pointer gestures and the cursor ring.
- `src/audio/`: generated soundscape and music (Web Audio, no sound files).
- `src/post/`: the image chain (scene target, resolve, bloom, grade).
- `src/gl/`: the engine layer under everything: boot (shader precompile, warm frame), non-blocking GPU readbacks, the quality governor, the simulation-pass helpers. `engine.md`.
