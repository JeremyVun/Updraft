/**
 * Copied from ~/projects/analytics/client/analytics.ts. Updraft bounds payloads,
 * times out requests and omits credentials/referrers, including on page exit.
 *
 * Dependency-free and environment-neutral: it uses `fetch` when it
 * exists and degrades to a no-op otherwise, so it imports cleanly into a browser
 * bundle (or a worker, or Node ≥18). It is fire-and-forget and NEVER throws — a dead
 * analytics endpoint can't break the app.
 *
 * The wire contract is just HTTP + JSON; this is one convenient way to speak it, not
 * the only one. Any language can POST the same event shape to `/e`.
 */

/** One event in the generic contract. Only `t` or `u` need be meaningful per call. */
export interface AnalyticsEvent {
  /** Event type → increments counters[t]. */
  t?: string
  /** Unit id → live presence + the unique count. */
  u?: string
  /** Presence state → the live gauge bucket for this unit. */
  st?: string
  /** Dimensions → break counters[t] into histograms[t][dim][value]. */
  d?: Record<string, string>
  /** Increment amount (default 1, clamped ≥1 server-side). */
  n?: number
  /** Dedup key → count this event's contribution at most once within the TTL. */
  k?: string
  /** Session id (carried, not aggregated). */
  sid?: string
  /** Client ms timestamp (filled in automatically if omitted). */
  ts?: number
}

export interface AnalyticsOptions {
  /** Base URL of the analytics service, e.g. "https://analytics.example.com". */
  endpoint: string
  /** Project key — partitions all data for this app. */
  project: string
  /** Stable unit id for presence + unique counting (e.g. a pseudonymous member id). */
  unit?: string
  /**
   * Sent as the X-Analytics-Key header when the server requires one. The server can be
   * configured with a single master key (valid for every project) and/or per-project
   * keys (ANALYTICS_INGEST_KEYS) — pass whichever one this app was issued. A browser-
   * shipped key is a bot-hurdle, not a secret (see the server README).
   */
  ingestKey?: string
  /** Per-page-load session id (carried on every event). */
  session?: string
  /** Flush the batch at most this often, ms (default 5000). */
  flushIntervalMs?: number
  /** Presence heartbeat cadence, ms (default 30000). 0 disables the heartbeat. */
  beatIntervalMs?: number
  /** Max events held before forcing a flush (default 50). */
  maxBatch?: number
}

/**
 * Analytics batches events and ships them to the service. Construct one per app:
 *
 *   const a = new Analytics({ endpoint: ANALYTICS_URL, project: 'my-app', unit: memberId })
 *   a.count('session')
 *   a.beat('idle')                                   // ~every 30s, automatic if you call startHeartbeat
 *   a.count('purchase', { n: 3, d: { sku: 'gold' } })
 *   a.count('raid_end', { k: pullKey, d: { outcome: 'kill', difficulty: 'heroic' } })
 */
export class Analytics {
  private readonly o: Required<Omit<AnalyticsOptions, 'unit' | 'ingestKey' | 'session'>> &
    Pick<AnalyticsOptions, 'unit' | 'ingestKey' | 'session'>
  private queue: AnalyticsEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private beatTimer: ReturnType<typeof setInterval> | null = null
  /** Last presence state, re-sent by the heartbeat until it changes. */
  private state = 'active'
  private stateDims: Record<string, string> | undefined

  constructor(opts: AnalyticsOptions) {
    this.o = {
      endpoint: opts.endpoint.replace(/\/+$/, ''),
      project: opts.project,
      unit: opts.unit,
      ingestKey: opts.ingestKey,
      session: opts.session,
      flushIntervalMs: opts.flushIntervalMs ?? 5000,
      beatIntervalMs: opts.beatIntervalMs ?? 30000,
      maxBatch: opts.maxBatch ?? 50,
    }
    if (this.enabled()) {
      this.flushTimer = setInterval(() => this.flush(), this.o.flushIntervalMs)
      // Best-effort final flush when the page goes away (browser only).
      const g = globalThis as any
      if (typeof g.addEventListener === 'function') {
        g.addEventListener('pagehide', () => this.flush(true))
        g.addEventListener('visibilitychange', () => {
          if (g.document?.visibilityState === 'hidden') this.flush(true)
        })
      }
    }
  }

  /** Whether the client is configured to emit (endpoint + project set). */
  enabled(): boolean {
    return Boolean(this.o.endpoint && this.o.project)
  }

  /** Set/replace the stable unit id (e.g. once the member id is known). */
  setUnit(unit: string): void {
    this.o.unit = unit
  }

  /** Record a counter event (with optional dimensions, increment, and dedup key). */
  count(type: string, opts: { d?: Record<string, string>; n?: number; k?: string } = {}): void {
    this.emit({ t: type, u: this.o.unit, d: opts.d, n: opts.n, k: opts.k })
  }

  /**
   * Update this unit's live presence. Remembers the state + dims so the heartbeat can
   * keep re-sending them; the server expires a unit whose beats stop.
   */
  beat(state: string, dims?: Record<string, string>): void {
    this.state = state
    this.stateDims = dims
    this.emit({ u: this.o.unit, st: state, d: dims })
  }

  /** Start the automatic presence heartbeat (re-sends the last beat on a cadence). */
  startHeartbeat(): void {
    if (this.beatTimer || this.o.beatIntervalMs <= 0 || !this.enabled()) return
    this.beatTimer = setInterval(() => {
      if (this.o.unit) this.emit({ u: this.o.unit, st: this.state, d: this.stateDims })
    }, this.o.beatIntervalMs)
  }

  /** Queue a raw event (envelope fields are filled in automatically). */
  emit(e: AnalyticsEvent): void {
    if (!this.enabled()) return
    if (this.queue.length >= 100) return
    this.queue.push({ ...e, ts: e.ts ?? Date.now(), sid: e.sid ?? this.o.session })
    if (this.queue.length >= this.o.maxBatch) this.flush()
  }

  /** Best-effort bounded delivery. Credentials are omitted, including on page exit. */
  flush(_beacon = false): void {
    if (!this.enabled() || this.queue.length === 0) return
    const events = this.queue.splice(0, 50)
    try {
      const payload = JSON.stringify(events.map(e => ({ ...e, p: this.o.project })))
      if (new TextEncoder().encode(payload).byteLength > 60 * 1024) return
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
      if (this.o.ingestKey) headers['X-Analytics-Key'] = this.o.ingestKey
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        void fetch(`${this.o.endpoint}/e`, {
          method: 'POST', body: payload, headers, keepalive: true,
          credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
        }).catch(() => {}).finally(() => clearTimeout(timeout))
      } catch { clearTimeout(timeout) }
    } catch { /* Analytics must not escape into gameplay, even with unavailable browser APIs. */ }
  }

  /** Stop the timers and flush once (call on teardown). */
  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.beatTimer) clearInterval(this.beatTimer)
    this.flushTimer = this.beatTimer = null
    this.flush(true)
  }
}
