# Updraft

This is the canonical project instruction file. `CLAUDE.md` is a symlink here. Local setup and the repository overview are in [README.md](README.md).

Browser game where you play the wind (Three.js + TypeScript + Vite). **Read `docs/journey.md` first: the vision, Jeremy's brief in his words, the story and the principles.** Then `docs/roadmap.md` for what is open.

- Overview and standing decisions: `docs/project.md`. Look: `docs/styles.md`.
- Every room, how it plays and Jeremy's rulings for it: `docs/chapters.md`. The stairs in the clouds (work in progress, Jeremy's brief verbatim): `docs/stairs.md`.
- The characters: the child `docs/child.md`, the cygnet `docs/cygnet.md`, the boat `docs/boat.md`.
- Contracts: the wind field every system reads `docs/contracts/wind.md`; the ground, its life, the islands and what lives on them `docs/contracts/world.md`; sound `docs/contracts/audio.md`; checkpoint saves, chapter select and hidden-page audio `docs/contracts/progress.md`; analytics `docs/contracts/analytics.md`.
- How a frame is produced and kept smooth (boot, frame order, camera direction, readbacks, quality, post): `docs/engine.md`. Local release checks: `docs/testing.md`.
- The loading veil: no freezing while shaders compile (Safari compiles each at first use) and a stage-and-percent line: `docs/backlog/boot-veil/`.

## Commands

- `npm run dev` (serves http://127.0.0.1:5230/), `npm run typecheck`, `npm run build` (production, without QA switches). Instrumented builds: `npm run build:qa` then `npm run preview:qa` (`dist-qa/`).
- Visual QA: `node tools/play.mjs <out-prefix> '<json steps>'` drives real pointer gestures (swipe, hold, move) in local Chrome with the GPU and saves screenshots; `VIDEO=1` also records a webm. Run it against a dev server; see the header for step syntax. Its `QUERY` takes params without a leading `?` (it is appended after `?shot=1&`). Put output in `/tmp`. `node tools/playthrough.mjs /tmp/updraft-journey` runs Begin through every chapter, credits, completed-save reload and Play again with real gestures (up to an hour; it holds the browser lock; run long captures against `npm run preview:qa` after `npm run build:qa`, because a dev server reloads the page on any `src` edit, your own included). `TRACE=1` records the camera for `tools/camera-intent-report.mjs`. Local release checks: `docs/testing.md`.
- The cygnet and the child up close: `?chapter=stage` (`src/story/stage.ts`) stands them on open ground with a free camera; from a `play.mjs` eval step, `__game.story.current.play('<name>')` plays any state, act (`act:<name>`) or shared moment, `.look('<view>')` picks a view, `__game.probe.report()` gives the worst pop, turn, hand gap and foot slip since `probe.reset()`. `node tools/cygnet-gates.mjs` runs them all against limits.
- Performance: `node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query]` measures frame intervals and hitches, blocking WebGL calls, a CPU profile, or frame-to-frame image spikes (flicker) from inside the running game. Numbers are inflated while any other process uses the GPU; check for busy Chrome processes first.
- Deploy: `tools/deploy.sh` builds and uploads `dist/` as static assets of the Cloudflare Worker `updraft` (`wrangler.jsonc`), live at https://updraft.jeremyvun.com (also https://updraft.perch-admin.workers.dev). Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit), a clean tree and the `main` branch, because every deploy goes to production.

## Query params

Available only in development and explicit QA builds; production ignores them and excludes QA tools. Use the QA preview for long captures so source edits cannot reload them.

`shot` (set by the tools: fixed 1/60 s steps, `window.__game`, `window.__stats`, `window.__ready`, hides the interface), `cam=x,y,z,tx,ty,tz`, `sun=azimuthDeg,elevationDeg`, `ratio=<pixel ratio>` (fixes render scale, disables the automatic step-down), `msaa=<samples>`, `grass=<density multiplier>`, `dusk=<0 afternoon … 1 sunset … 2 night>`, `shower=<0..1>` (forces the passing rain), `whale` (a whale surfaces near the boat every 40 s), `chapter=lines|washing|boats|meadow|piano|birches|stairs|drowned|wood|sleeping|sea|mirror|jetty|summit|stage` (start later in the story, or the QA stage; `jetty` is moored at home with the walk in still to do; `crossing`, `hills`, `autumn`, `clouds`, `village`, `dark`, `dolphins` and `home` are aliases), `debug=wind` (draws the wind field over the island), `coldshaders` (every fragment shader gets a never-taken line unique to the load, so no browser or driver cache holds a program and each load compiles as a first visit does).

## Where things are

- Sharing with friends, promotional assets and the proposed Steam release: `docs/launch.md`. The promo videos (trailer, short, gameplay take), with Jeremy's brief, the shot plan and status: `docs/promo.md`; both files are local only (ignored by git), as is the finished media in `assets/promo/`. They are made with `tools/promo-film.mjs`, `promo-score.mjs`, `promo-text.mjs` and `promo-edit.mjs` (shots, cards and edits in `tools/promo/`).
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
- Audio feedback, cue timing, the scores, habitat and physical sounds: `docs/contracts/audio.md`.
