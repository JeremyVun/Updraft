# Game analytics

The shared analytics service at `https://analytics.jeremyvun.com` receives project `updraft`. `src/analytics/client.ts`
is a copy of the shared dependency-free client (bounded batches, five-second timeout); `src/analytics/telemetry.ts`
owns the game's events. There is no separate backend or database.

| Event | Source | Additional dimensions |
| --- | --- | --- |
| `loading_finished` | World compilation and warm-up finish | duration and worst frame-stall buckets |
| `game_started` | Begin or Continue | new/continued |
| `chapter_entered` | Start or chapter change | none |
| `quality_changed` | Initial level or governor change | detail, scale bucket, samples, initial/changed |
| `performance_sampled` | Each minute of visible play; shorter windows at chapter/quality changes or exit if at least ten seconds | FPS bucket, count of frames over 50 ms, detail, composite chapter.detail, chapter.fps and detail.fps |
| `game_completed` | First completion in this playthrough | none; reopening the completed ending does not count again |
| `game_failed` | Startup rejection, uncaught error or rejection, a frame-loop exception, a failed audio start, WebGL loss | phase (`boot`, `runtime`, `promise`, `graphics`, `audio`) and coarse error kind, once per pair per page |
| `recovery_requested` | Graphics recovery button | none |

Every event carries build revision, environment (`production` or `qa`) and chapter. Dimensions are bounded
categories. FPS is the average over the sample window, not a percentile; windows reset on hide, chapter and quality
changes. Counts describe page loads and chapter visits, not unique people or a deduplicated funnel.

No persistent player identifier, session ID, presence heartbeat, URLs, pointer coordinates, error messages, stacks or
user text are sent. Requests omit credentials and referrers. Nothing is queued offline. Batches hold at most 50 events
or 60 KiB; failed requests are dropped without delaying or interrupting play.

## Configuration

Public defaults live in `src/public-config.ts`. Build-time `VITE_ANALYTICS_URL` overrides the host; an empty value
disables analytics. Optional `VITE_ANALYTICS_KEY` supplies an ingest key if the service requires one; never commit it.
The service currently accepts this project's events without a key, but it switches every project to keyed ingestion
once any ingest key is configured, so keeping this static site anonymous beside keyed server clients would need a
per-project public-ingest allowlist on the service. Read/operator credentials never go in the browser client.

Development, `?shot` and `?chapter=` disable delivery unless `?analytics=1` is given; those events are labelled `qa`.
`?analytics=0` or Do Not Track disables delivery even with that override.

## Checks

- `node tools/analytics-check.mjs`: failures, payload privacy, lifecycle dedup and QA isolation, without a GPU.
- `node tools/analytics-browser-check.mjs`: QA events from the real app accepted with HTTP 204, play continuing with
  analytics blocked, and no requests in default QA mode. `BASE` selects a build.

Dashboard readback (`/ui` or `/stats?project=updraft`) needs the service's read authorisation.
