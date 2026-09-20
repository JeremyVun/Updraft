# Game analytics

The shared analytics service at `https://analytics.jeremyvun.com` receives project `updraft`.
`src/analytics/client.ts` copies the shared dependency-free client with bounded delivery and a five-second timeout.
`src/analytics/telemetry.ts` owns the game taxonomy. There is no separate backend or database.

| Event | Source | Additional dimensions |
| --- | --- | --- |
| `loading_finished` | World compilation and warm-up finish | duration and worst RAF stall buckets |
| `game_started` | Begin or Continue | new/continued |
| `chapter_entered` | Start or chapter change | none |
| `quality_changed` | Initial level or governor change | detail, scale bucket, samples, initial/changed |
| `performance_sampled` | Each minute of visible play; shorter windows at chapter/quality changes or exit if at least ten seconds | FPS bucket, count of frames over 50 ms, detail, composite chapter.detail, chapter.fps and detail.fps |
| `game_completed` | First completion in this playthrough | none; reopening completed credits does not count again |
| `game_failed` | Startup rejection, uncaught error/rejection, WebGL loss | phase and coarse error kind, once per pair per page |
| `recovery_requested` | Graphics recovery button | none |

Every event carries build revision, environment (`production` or `qa`) and chapter. Dimensions are bounded
categories. FPS is the average over the sample window, not a percentile; windows reset on hide, chapter and
quality changes. Counts describe page loads and chapter visits, not unique people or a deduplicated player funnel.

No persistent player identifier, session ID, presence heartbeat, URLs, pointer coordinates, error messages,
stacks or user text are sent. Requests omit credentials and referrers. No offline queue is persisted.
Batches contain at most 50 events / 60 KiB; failed requests are dropped without delaying or interrupting play.

## Configuration and verification

Public defaults live in `src/public-config.ts`. Build-time `VITE_ANALYTICS_URL` overrides the host; an empty
value disables analytics. Optional `VITE_ANALYTICS_KEY` supplies an ingest key if the service enables one;
never commit the key. The current service accepts this project's events without an ingest key.
The current server switches all projects to keyed ingestion once any ingest keys are configured. Keeping a
static project anonymous alongside protected server clients would require a per-project public-ingest allowlist.
Read/operator credentials are independent and must never be included in this browser client.

Development, `?shot` and `?chapter=` disable delivery unless explicitly enabled with `?analytics=1`;
those events remain labelled `qa`. `?analytics=0` or Do Not Track disables delivery even with that override.

`node tools/analytics-check.mjs` checks failures, payload privacy, lifecycle dedup and QA isolation without a GPU.
`node tools/analytics-browser-check.mjs` sends QA events from the actual app, checks HTTP 204 acceptance,
then verifies continued play with blocked analytics and no requests in default QA mode. `BASE` selects a build.
Dashboard readback at `/ui` or `/stats?project=updraft` requires the service's read authorization.
