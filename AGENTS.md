# Updraft

Browser game where you play the wind (Three.js + TypeScript + Vite). **Read `docs/journey.md` first: the vision, Jeremy's brief in his words, the story and the build plan.** The companion's rebuild as a swan cygnet (in progress): `docs/cygnet.md`. The ending's polish pass, with Jeremy's brief and the plan: `docs/ending.md`. The play-through polish round (sail, washing, wind feel, piano, pond), with Jeremy's words and the status: `docs/polish.md`. New room concepts and the little-boats chapter: `docs/rooms.md`. Overview: `docs/project.md`. Look: `docs/styles.md`. Milestones: `docs/roadmap.md`. The wind field every system reads: `docs/contracts/wind.md`; the ground, its life and what lives on it: `docs/contracts/world.md`. Checkpoint saves and hidden-page audio: `docs/contracts/progress.md`. How a frame is produced and kept smooth (boot, frame order, readbacks, quality, post): `docs/engine.md`.

## Commands

- `npm run dev` (serves http://127.0.0.1:5230/), `npm run typecheck`, `npm run build`.
- Visual QA: `node tools/play.mjs <out-prefix> '<json steps>'` drives real pointer gestures (swipe, hold, move) in local Chrome with the GPU and saves screenshots; `VIDEO=1` also records a webm. Run it against a dev server; see the header for step syntax. Put output in `/tmp`. `node tools/playthrough.mjs /tmp/updraft-journey` runs Begin through every chapter, credits, completed-save reload and Play again with real gestures (up to an hour; it holds the browser lock). Local release checks: `docs/testing.md`.
- The cygnet and the child up close: `?chapter=stage` (`src/story/stage.ts`) stands them on open ground with a free camera; from a `play.mjs` eval step, `__game.story.current.play('<name>')` plays any state, act (`act:<name>`) or shared moment, `.look('<view>')` picks a view, `__game.probe.report()` gives the worst pop, turn, hand gap and foot slip since `probe.reset()`. `node tools/cygnet-gates.mjs` runs them all against limits.
- Performance: `node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query]` measures frame intervals and hitches, blocking WebGL calls, a CPU profile, or frame-to-frame image spikes (flicker) from inside the running game. Numbers are inflated while any other process uses the GPU; check for busy Chrome processes first.
- Deploy: `tools/deploy.sh` builds and uploads `dist/` as static assets of the Cloudflare Worker `updraft` (`wrangler.jsonc`), live at https://updraft.perch-admin.workers.dev. Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit), a clean tree and the `main` branch, because every deploy goes to production.

## Query params

`shot` (set by the tools: fixed 1/60 s steps, `window.__game`, `window.__stats`, `window.__ready`, hides the interface), `cam=x,y,z,tx,ty,tz`, `sun=azimuthDeg,elevationDeg`, `ratio=<pixel ratio>` (fixes render scale, disables the automatic step-down), `msaa=<samples>`, `grass=<density multiplier>`, `dusk=<0 afternoon … 1 sunset … 2 night>`, `shower=<0..1>` (forces the passing rain), `whale` (a whale surfaces near the boat every 40 s), `chapter=lines|washing|boats|meadow|birches|drowned|wood|sleeping|sea|mirror|jetty|summit|stage` (start later in the story, or the QA stage; `jetty` is moored at home with the walk in still to do; `crossing`, `hills`, `autumn`, `village`, `dark`, `dolphins` and `home` are aliases), `debug=wind` (draws the wind field over the island).

## Where things are

- Feel knobs (gust strength, wind decay, grass spring, washing sensitivity, petal counts): `src/tuning.ts`. Put new player-feel numbers there rather than inline; GLSL takes them through `glsl()`.
- Engine layer (boot, readbacks, quality governor, sim-pass helpers): `src/gl/`. Post chain: `src/post/post.ts`.
- Shared shader uniforms and GLSL (sky, fog, lighting, cloud shadows, domain helpers): `src/world/atmosphere.ts`. Include `ATMO_GLSL` once per shader stage.
- Island shape and height lookups: `src/world/island.ts`. Tree and rock placement: `src/world/landmarks.ts`.
- Rooms with their own world module: the little boats `src/world/little-boats.ts`, the island of lines `src/world/lines.ts`, the autumn birches `src/world/birches.ts`, the drowned village `src/world/drowned.ts`, the dark wood `src/world/wood.ts`, the sleeping island `src/world/sleeping.ts`. Each is driven by its chapter in `src/story/`.
- The sea: `src/world/water.ts` (a grid centred on the camera, fine where the swell is geometry and opening out to the horizon). The swell is `src/world/water/swell.ts`, the one place its waves are defined: the shader displaces the mesh by them and `swellAt` gives anything that floats the same surface.
- The gold the player takes off the birches: `src/fx/leaves.ts`, a leaf that leaves its branch and never goes back.
- The companion: `src/creatures/cygnet.ts` (states and mechanics) with `src/creatures/cygnet/` (`mind` what it notices, feels and does; `pose` drives in, bones out; `gait` planted feet; `ride` where it sits on the child; `body`, `shader`, `wings` the look). What the child and the cygnet do with their hands on each other: `src/companion/`. Its sounds: `src/audio/foley.ts`.
- The light the player makes in the dark wood: `src/fx/embers.ts`, carried to every shader as `uEmberLight`.
- The piano the wind plays, standing in the meadow: `src/world/piano.ts` (case, keys, wind sampling, the notes it finds), with the child's optional stop at it in `src/story/piano.ts` and its tone in `audio/audio.ts` (`PianoStrings`).
- Player-facing text drafts and approvals: `docs/copy/`.
- Audio feedback, cue timing, habitat and physical sounds: `docs/contracts/audio.md`. Review and pending score decisions: `docs/audio-review.md`.
