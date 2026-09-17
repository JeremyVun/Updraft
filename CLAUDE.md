# Updraft

Browser game where you play the wind (Three.js + TypeScript + Vite). **Read `docs/journey.md` first: the vision, Jeremy's brief in his words, the story and the build plan.** The companion's rebuild as a swan cygnet (in progress): `docs/cygnet.md`. Overview: `docs/project.md`. Look: `docs/styles.md`. Milestones: `docs/roadmap.md`. The wind field every system reads: `docs/contracts/wind.md`; the ground, its life and what lives on it: `docs/contracts/world.md`. How a frame is produced and kept smooth (boot, frame order, readbacks, quality, post): `docs/engine.md`.

## Commands

- `npm run dev` (serves http://127.0.0.1:5230/), `npm run typecheck`, `npm run build`.
- Visual QA: `node tools/play.mjs <out-prefix> '<json steps>'` drives real pointer gestures (swipe, hold, move) in local Chrome with the GPU and saves screenshots; `VIDEO=1` also records a webm. Run it against a dev server; see the header for step syntax. Put output in `/tmp`. `node tools/playthrough.mjs` prints the steps for a whole automated playthrough (10-15 minutes; it holds the browser lock).
- Performance: `node tools/perf.mjs <frames|gl|cpu|flicker> [seconds] [query]` measures frame intervals and hitches, blocking WebGL calls, a CPU profile, or frame-to-frame image spikes (flicker) from inside the running game. Numbers are inflated while any other process uses the GPU; check for busy Chrome processes first.
- Deploy: `tools/deploy.sh` builds and uploads `dist/` as static assets of the Cloudflare Worker `updraft` (`wrangler.jsonc`), live at https://updraft.perch-admin.workers.dev. Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit), a clean tree and the `main` branch, because every deploy goes to production.

## Query params

`shot` (set by the tools: fixed 1/60 s steps, `window.__game`, `window.__stats`, `window.__ready`, hides the interface), `cam=x,y,z,tx,ty,tz`, `sun=azimuthDeg,elevationDeg`, `ratio=<pixel ratio>` (fixes render scale, disables the automatic step-down), `msaa=<samples>`, `grass=<density multiplier>`, `dusk=<0 afternoon … 1 sunset … 2 night>`, `shower=<0..1>` (forces the passing rain), `whale` (a whale surfaces near the boat every 40 s), `chapter=lines|washing|meadow|drowned|wood|sea|summit` (start later in the story; `crossing`, `hills`, `village`, `dark`, `dolphins` and `home` are aliases), `debug=wind` (draws the wind field over the island).

## Where things are

- Engine layer (boot, readbacks, quality governor, sim-pass helpers): `src/gl/`. Post chain: `src/post/post.ts`.
- Shared shader uniforms and GLSL (sky, fog, lighting, cloud shadows, domain helpers): `src/world/atmosphere.ts`. Include `ATMO_GLSL` once per shader stage.
- Island shape and height lookups: `src/world/island.ts`. Tree and rock placement: `src/world/landmarks.ts`.
- Rooms with their own world module: the island of lines `src/world/lines.ts`, the drowned village `src/world/drowned.ts`, the dark wood `src/world/wood.ts`. Each is driven by its chapter in `src/story/`.
- The light the player makes in the dark wood: `src/fx/embers.ts`, carried to every shader as `uEmberLight`.
- Player-facing text drafts and approvals: `docs/copy/`.
