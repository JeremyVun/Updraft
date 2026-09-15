# Updraft

Browser game where you play the wind (Three.js + TypeScript + Vite). Overview: `docs/project.md`. Look: `docs/styles.md`. Milestones: `docs/roadmap.md`. The wind field every system reads: `docs/contracts/wind.md`.

## Commands

- `npm run dev` (serves http://127.0.0.1:5230/), `npm run typecheck`, `npm run build`.
- Visual QA: `node tools/play.mjs <out-prefix> '<json steps>'` drives real pointer gestures (swipe, hold, move) in local Chrome with the GPU and saves screenshots; `VIDEO=1` also records a webm. Run it against a dev server; see the header for step syntax. Put output in `/tmp`.
- Deploy: `tools/deploy.sh` builds and uploads `dist/` as static assets of the Cloudflare Worker `updraft` (`wrangler.jsonc`), live at https://updraft.perch-admin.workers.dev. Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit), a clean tree and the `main` branch, because every deploy goes to production.

## Query params

`shot` (set by the tools: fixed 1/60 s steps, `window.__game`, `window.__stats`, `window.__ready`, hides the interface), `cam=x,y,z,tx,ty,tz`, `sun=azimuthDeg,elevationDeg`, `ratio=<pixel ratio>` (fixes render scale, disables the automatic step-down), `msaa=<samples>`, `grass=<density multiplier>`, `noglider`, `debug=wind` (draws the wind field over the island).

## Where things are

- Shared shader uniforms and GLSL (sky, fog, lighting, cloud shadows, domain helpers): `src/world/atmosphere.ts`. Include `ATMO_GLSL` once per shader stage.
- Island shape and height lookups: `src/world/island.ts`. Tree and rock placement: `src/world/landmarks.ts`.
- Player-facing text drafts and approvals: `docs/copy/`.
