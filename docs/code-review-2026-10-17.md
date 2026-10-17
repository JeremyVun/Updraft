# Codebase review — 2026-10-17

Jeremy's brief, verbatim:

> Review the codebase for bugs, gaps, issues, documentation drift

Review of the shared working tree starting at `de334914`. It already contained other sessions' edits, and
those sessions continued working during the review. This is an audit, not a release certification or a claim
that every line was inspected. The initial review changed only this report and its AGENTS.md pointer.
The explicitly requested fixes below followed the review; other sessions' changes were left alone.

The game vision remains [journey.md](journey.md). Preserve the settled look, camera and story; none of these
findings calls for a redesign. The review mapped the contracts, inspected startup/save/audio/input/render
boundaries, ran mechanics and build checks, reproduced suspected faults, and compared documentation with code.

## Requested fixes — 2026-10-17

Jeremy's follow-up, verbatim:

> Fix below,
> - title screen retained discarded UI
> - Disabling analytics breaks build. analytics url should be optional
> - Stairs telemetry is missing
> - sleeping test fixture
> Explain the rest to me in more detail

Findings **1, 2, 3, 4, 5, 6, 7 and 9 are resolved**. Finding **8 remains open**. The descriptions preserve the
original evidence and line numbers; subsequent verification below supersedes the earlier browser blockage.

- Title disposal releases its UI, painting, wind and callback references. The picker shares the title's abort
  signal; disposal removes listeners, clears image sources and cancels pending backdrop frames. The existing
  fade remains the point at which cleanup happens.
- Optional `VITE_ANALYTICS_URL`: omission retains the public default, while empty/whitespace values disable delivery.
  CSP uses Vite's resolved environment and emits only `'self'` for a disabled endpoint, matching the runtime.
- Telemetry includes `toStairs` and `stairs`. Its registry is exhaustive over `ChapterName`, so adding a chapter
  without adding telemetry coverage now fails type checking.
- Sleeping's fixture supplies `dressing` and `wind.calm`, and checks finite camera/actor coordinates and primary
  projections before accumulating framing statistics.

Validation after these changes:

- `npm run typecheck`: passed.
- `node tools/start-disposal-check.mjs`: passed for Begin, chapter selection, pending image decoding and disabled
  title mode. Uses the real DOM modules without the WebGL game; checks released references, zero pending frames,
  zero window resize listeners, safe late notifications and the enabled canvas.
- `node tools/analytics-check.mjs`: passed, including every chapter and stairs performance/error attribution from
  both a direct start and the Birches approach.
- `node tools/analytics-config-check.mjs`: passed. Builds real telemetry and headers for default, empty, whitespace
  and custom URLs, then verifies emitted delivery against CSP with a fake transport.
- `node tools/sleeping-logic-check.mjs`: passed, including its 30/60 fps runs and subsequent restoration/terrain
  checks. Log: `/tmp/updraft-sleeping-fix-20261017.log`.
- Full production build with `VITE_ANALYTICS_URL=''`: passed; generated `connect-src` is exactly `'self'`.
  Output: `/var/folders/2w/krx53_8d0wz9bnc02rvllb8w0000gn/T/updraft-disabled-analytics-build-qTX0Qt/`.

The new analytics configuration check is in the quick/mechanics/release groups; title disposal is in the
browser/release groups and starts its own isolated server. The full mechanics/browser suites were not repeated
for these focused fixes. Later verification and the remaining mill-contact finding are recorded below.

Jeremy's next follow-up, verbatim:

> 2. yea ok fix the music loading test expecting outdated behaviour.
> 3. are you saying that the child is actually walking in mid air 3.8cm off the ground?
> 4. Is the issue here that the testing docs just need to be updated? Or something else?
> 5. oh, yea recently I have started adding sound files. alot of those other issues you listed sound like they are not outdated too

The music-loading check now derives the permitted attempt count from `musicRetryAfter`, keeps single-download
reuse checks for the other modes, and verifies that playback resumes with a missing recorded buffer and nonzero
audio output after all retries fail. The failure-mode wait follows the configured preparation deadline; the other
modes retain their five-second post-Begin bound. Optional mode arguments and startup diagnostics make focused
verification possible.

Syntax and whitespace checks passed. A direct run of the real `decodeMusic` with HTTP 503 exhausted exactly three
attempts, matching the updated assertion. Browser runs against an isolated dev server with HMR/watch disabled
could not reach the test assertions: both Metal and SwiftShader stopped at “Preparing the graphics” until the
unchanged 60-second readiness wait expired, with no JavaScript errors reported. The full browser gate is therefore
**not verified**; this is not a passing browser result or a diagnosis of that graphics warm-up stall. No game code
was changed for this follow-up.

## Findings

Jeremy's closeout instruction, verbatim:

> ok, think carefully, i just dont want any regressions

Closeout scope: replace the foghorn check's obsolete loader with the existing shared loader; correct only the
verified documentation mismatches; complete music-loading verification; establish whether the mill contact
failure reflects the rendered surface before changing movement or tolerances. Preserve the settled look, camera,
story, retry policy and existing test limits.

- Foghorn now uses `tools/lib/typescript.mjs`; all existing timing, checkpoint and inactive-audio assertions pass.
- The release instructions run mechanics, browser and audio groups against a stable dev revision, then the long
  playthrough against that revision's QA build. They no longer prescribe running source-import probes on a preview.
- The overview describes recorded and procedural audio. Roadmap edits distinguish completed start-path/veil work
  and the existing Cloud stairs tile from unfinished polish and device verification. The save contract now includes
  Rotary, both Echoes checkpoints, and geography revisions 10 and 11. No save or migration code changed.
- Type checking and the four title-disposal cases passed again; all 17 music-mute checks passed.
- The complete current mechanics group passed **74 of 75** checks. The only failure is the pre-existing mill
  contact gate (3.7 cm on its first 30 Hz case). Its later chimney, cat, other child-route and rescue cases also
  passed when run separately, since the first assertion otherwise prevents them from executing.
  Results: `/tmp/updraft-review-closeout-p9XEAy/mechanics/results.json`.
- An isolated browser run of the real `Soundscape` exhausted exactly three HTTP 503 attempts, completed preparation
  with no recording buffer, and continued producing nonzero audio. This verifies failed-download recovery without
  the 3D startup; it does not replace the full Begin/veil browser gate.
- The full browser check waited for the shared GPU, including an attempt with exclusive access; those waiting
  processes were stopped. A separate software-rendering diagnostic allowed 180 s for startup and recorded shader
  settlement followed by 73% graphics preparation until timeout, with no page errors. It still never reached Begin.
  The repository test retains its original 60 s readiness limit. The cause of this startup stall remains unresolved,
  and the full music-loading gate is **not verified**. Diagnostic copies live only in the temporary evidence folder.

The mill diagnostic used the existing route and posed boot vertices at 30/60/120 Hz with four initial stride
phases and a fixed random seed. Comparing against triangles from the actual `buildHouse` roof builder confirms
brief separations up to 3.7 cm on the slope; cases with the existing query failure spend about 0.05–0.10 s above its
2.5 cm limit. Near the ridge, the floor query deliberately follows the slate plane beneath the raised cap, so a
reported query gap can instead overlap that visible cap. Chimneys were excluded from the downward roof rays to
avoid mistaking an overhead obstruction for the supporting surface. This is geometry evidence, not a reviewed
player-camera animation. Movement and tolerances remain unchanged.
Probe and seeded results: `/tmp/updraft-review-closeout-p9XEAy/mill-probe.mjs` and `mill-contact.json`.

This closeout changed only the foghorn test loader and documentation. The previous runtime fixes remain as
verified above; no additional movement, camera, rendering, music policy or test tolerance changes were made.
Syntax, diff whitespace and local links in all five edited docs passed. The shared checkout continued to receive
other sessions' changes; these results do not certify an immutable release. All owned checks, browsers and the
isolated dev server have stopped. No commit or deployment was made.

Jeremy's visual-verification follow-up, verbatim:

> wat do you mean pending visual review
>
> and why not?

The previous closeout stopped too early: a startup timeout did not justify treating the visual check as finished.
Verification resumed without changing movement, camera or tolerances. A temporary Vite transform logged the
startup passes: the software browser continued drawing batches and waiting on GPU fences rather than remaining
deadlocked. A fresh dev server with an isolated dependency cache and the normal Chrome for Testing/Metal browser
reached graphics-ready at 25.1 s and produced a real roof-scene capture. This clears the immediate blocker, but
does not isolate which difference caused the earlier timeout. The logging transform was then removed before
the player-camera contact capture and full music-loading check. Evidence: `/tmp/updraft-contact-review-ib834p/`.

The full music-loading browser gate now passes all five modes: parallel download/decode, HTTP failure, timeout,
cancellation and music disabled. Reaching the assertions exposed a second fixture problem: holding the prefetched
download throughout a long graphics boot could expire its 20-second deadline, legitimately causing a retry and
failing the single-download assertion. The test still checks that the original prefetch starts before shader
compilation, then resets its deliberately held fixture immediately before Begin. Download-reuse assertions count
from that reset. The timeout case applies its existing 700 ms fixture deadline before starting that request.
Neither production deadlines/retries nor the test's 60-second graphics readiness limit changed. The existing
`MUTATE=skip` control correctly fails at the music-wait assertion when preparation is bypassed. Logs:
`music-loading-rerun.log` and `music-loading-mutation.log` in the evidence directory above.

Rendered contact investigation uses the real story walker and camera after seeding the completed tree/sheet
encounters and starting before the mill-wall approach. The first diagnostic omitted the tree camera handoff and
produced invalid framing; those images are rejected. Corrected captures preserve that completed handoff and let
whole game frames run, pausing only between frames. No production state, camera or movement code was edited.
Two 480-frame approaches, at initial gaits 0 and 2.24, reached the mill through the story walker. Across the 68
slope/ridge frames in each, maximum queried sole separations were 6.8 and 6.6 mm, with no frames above the existing
25 mm gate. Inspected player-camera frames do not show a constant hover; fog and the character's small screen size
limit visual precision. Evidence: `player-camera/capture.json`, `player-camera-stride/capture.json` and their
`frames/` folders. The latter's `0448.png` was opened in Preview for Jeremy.
These are inspected still frames from a seeded approach, **not** a motion review or a complete natural playthrough.
They do not reproduce or invalidate the isolated contact check's failing stride/timing cases. Finding 8 therefore
remains open for reconciling the isolated fixture with the story walker; movement and test tolerances stay unchanged.
Syntax and diff-whitespace checks passed. All owned test browsers and the diagnostic server were stopped after
these runs. This follow-up changed only the music-loading test and this report; no commit or deploy was made.

### 1. P2 — Release the title's painting tree when play starts

[`StartScreen.dispose`](../src/start-screen.ts), lines 277–285, removes the veil from the document but retains it
through the exported singleton's `veil`, `button`, painting and other element fields. The detached veil still
contains the chapter picker. Additionally, [`offerChapters`](../src/chapter-select/chapter-select.ts), line 131,
registers a window resize listener without a cleanup or the start screen's abort signal; its closure also retains
the picker and its backdrop.

An isolated Chrome for Testing probe using the actual transpiled classes opened the picker and disposed the
screen. The screen was disposed and absent from the document, but `startScreen.veil` still contained **25 image
elements and 15 buttons**. A resize after disposal still measured a detached chapter tile. A control that aborted
the resize listener stopped that access. The probe stubbed unrelated startup dependencies and did not measure
decoded-image or GPU memory; the established defect is continued reachability of the discarded UI and images.

Give the picker a disposal path, remove its window listener, and release the image tree and retained element
references from the long-lived start screen. Merely removing the listener does not fix the singleton's references.
Evidence: `/tmp/updraft-code-audit-w3UNw5/startup-disposal-probe.json` and `chapter-picker-probe.json`.

### 2. P2 — Repair the Sleeping mechanics fixture so its later gates execute

[`tools/sleeping-logic-check.mjs`](../tools/sleeping-logic-check.mjs), line 44, constructs a partial Sleeping world
without `dressing`. [`SleepingChapter.board`](../src/story/sleeping.ts) now assigns
`this.cast.sleeping.dressing.walker = c.position` (line 1504 at review time). The real `SleepingIsland` creates
`dressing`; the test fixture does not.

The mechanics suite failed with `TypeError: Cannot set properties of undefined (setting 'walker')` on its first
30 fps run, before the boarding assertions, the 60 fps run and subsequent restoration coverage. This is a stale
test fixture, not evidence that the real game crashes there.

An in-memory-only fixture correction exposed a second missing field: the fake wind lacks `calm`. Its 30 fps
tailwind scenario contaminates the boat's wind spring with NaNs; boarding then produces non-finite child and camera
coordinates. The existing check still passes, printing `maxTurn: null`, because its framing accumulator ignores
NaN comparisons and only asserts turn rates for two earlier beats. Supplying `dressing` and `wind.calm = 0` in
memory, and asserting finite camera position/quaternion every frame, lets the whole check pass at 30 and 60 fps.
Update both fixture dependencies and reject non-finite state explicitly; keep the production requirements intact.
Evidence: `/tmp/updraft-mechanics-1792162414068/sleeping-logic.log`.

### 3. P2 — Update the music-loading gate for the intentional retry policy

[`tools/music-loading-browser-check.mjs`](../tools/music-loading-browser-check.mjs), line 82, requires exactly one
`still.ogg` request in every enabled scenario, including `failure`, where every request receives HTTP 503.
[`decodeMusic`](../src/audio/music-loading.ts), lines 73–82, retries after 1 s and 3 s according to
`tuning.audio.musicRetryAfter`. An isolated run of the actual loader with all fetches returning 503 made **three
requests**, then rejected with `HTTP 503`.

The browser/release gate therefore rejects the current intended recovery behavior when it reaches that assertion.
Make the failure scenario assert the bounded retries and eventual ambience fallback; retain the single-request
assertion for successful reuse. This diagnosis reproduces the loader behavior and checks the gate's assertion;
the complete GPU browser test was not run in this audit.

### 4. P2 — Allow the documented empty analytics URL during builds

[`vite.config.ts`](../vite.config.ts), line 30, unconditionally calls
`new URL(process.env.VITE_ANALYTICS_URL ?? publicConfig.analyticsUrl)`. An empty string is the documented off switch
in [contracts/analytics.md](contracts/analytics.md), but `new URL('')` throws while generating deployment headers.

Calling the actual Vite plugin's `closeBundle` against the successful build with `VITE_ANALYTICS_URL=''` reproduced
`ERR_INVALID_URL`. This prevents building the supported analytics-disabled variant. Emit only `'self'` in
`connect-src` when analytics is disabled and derive enabled runtime/CSP configuration from the same resolved value.

### 5. P2 — Include the stairs in telemetry's chapter registry

[`src/analytics/telemetry.ts`](../src/analytics/telemetry.ts), line 20, omits `toStairs` and `stairs`, although both
are in the journey order. `telemetry.chapter` silently ignores them. Replaying
`birches → toStairs → stairs → drowned` through the actual telemetry module emitted no stairs entry events and
labelled a performance sample and runtime failure in the stairs as `birches`. Starting directly in the stairs
instead labels it `unknown`.

Share or exhaustively type the valid chapter registry and cover the whole journey order in the analytics check.
The existing analytics check passes because it exercises only a small subset of chapter transitions.

### 6. P2 — Make the documented release procedure runnable on its prescribed servers

[testing.md](testing.md), lines 45–51, prescribes `BASE=<QA preview> npm run check:release`, then lists an audio group
and four exceptions to rerun on a dev server. The list omits newer checks that also import source modules:
`sky-mirror-star`, `lantern-fog`, `fog-lookup`, `music-loading-browser` and `still-phrases-browser`, for example.
These are included in [`tools/check.mjs`](../tools/check.mjs), lines 23–25.

A fresh QA build's Vite preview returned **HTTP 200, `text/html`** for `/src/audio/audio.ts`, confirming that the
music-loading test's dynamic import cannot work there. Its `/assets/music/**` interception also expects dev asset
paths rather than emitted hashed assets. Following the documented fallback therefore still leaves failures
caused by the harness rather than the game. Split the groups by server requirements or make these probes work
against the instrumented bundle, then document commands that can actually produce a green release result.
Evidence: `/tmp/updraft-code-audit-w3UNw5/preview-import-probe.json`.

Clarification: corrected commands in the testing docs are sufficient to resolve these wrong-server failures.
Source-importing checks should use a stable dev server; build-specific checks and the long playthrough should use
the built QA version. The runner currently takes one `BASE`; teaching it two server URLs would automate that split
but is optional. This finding does not require a game-code change.

### 7. P2 — Use the asset-aware loader for the foghorn mechanics check

[`tools/foghorn-story-check.mjs`](../tools/foghorn-story-check.mjs), lines 7–8, installs its own TypeScript loader
without Vite `?url` handling. Importing `Soundscape` now reaches the recorded music imports. The check fails before
its assertions with `belfry_ending.ogg?url` not providing a default export.

Preloading the existing [`tools/lib/typescript.mjs`](../tools/lib/typescript.mjs) makes the unchanged check pass,
including timing, stale-event suppression and restored-checkpoint assertions. Use that shared loader instead of
the obsolete local hook. This is a harness failure, not a demonstrated foghorn playback bug.
Evidence: `/tmp/updraft-mechanics-1792162414068/foghorn-story.log`.

### 8. P2 — Resolve the mill approach's failed foot-contact gate

[`tools/drowned-contact-check.mjs`](../tools/drowned-contact-check.mjs), lines 35–51, measures the posed boot soles
against the child's floor query while following `millWall → millWallUp → millWallOn → millSlope → millRidge`.
The unmodified mechanics run fails on its first 30 Hz case: **0.038 m** above the surface against the existing
**0.025 m** limit. The early assertion also prevents its chimney, cat, other child routes and rescue cases running.

A diagnostic run retaining the original motion and measurements but logging instead of stopping at that gap
assertion found violations at 30, 60 and 120 Hz, reaching 0.048 m. They occur on the mill slope and its turn into
the ridge; the child's root is at its queried floor, so a root-height check would miss them. Exact gaps vary with
the unseeded actor setup. The test uses real `Traveller` skinned vertices, but this audit did not compare them with
rendered roof geometry or review the motion from the player camera. Treat the numerical contact failure as
confirmed and its visible severity as unresolved. Check the leg planting and surface agreement before changing
the threshold. The chimney, cat, other child-route and rescue cases all passed when run individually with `ONLY`.
Evidence: `/tmp/updraft-mechanics-1792162414068/drowned-contact.log`.

Clarification: 3.8 cm is the worst sampled separation of the lowest measured boot sole from the queried floor,
so both measured soles are above that floor at that instant. It is not a constant offset throughout the walk.
It remains unverified against the rendered roof and player camera; the numerical test alone does not establish
visible walking in mid-air.

### 9. P3 — Reconcile the project overview, roadmap and save contract

This finding concerns specific descriptions, not a claim that all the named work items are finished or obsolete.
The recent addition of recordings explains the audio mismatch. Startup's 500 ms target and its original phase 4
remain open, as does unfinished artistic review; only the description of all startup work as “In design” is stale.

- [project.md](project.md), lines 33–34, says all sound is generated and there are no sound files. Runtime
  `music-loading.ts` imports supplied recordings; the production build emits 15 Ogg assets. The audio contract
  already describes the mixed recorded/procedural architecture.
- [roadmap.md](roadmap.md), lines 25–26, says chapter selection in place is ready to build. Its build plan records
  phases 1 and 2 complete on October 3, and `main.ts` calls `story.start(choice)` without navigation. The remaining
  artwork work must be distinguished from the already built start path.
- The roadmap's stairs entry still says it needs a chapter-select name and still. The picker already contains
  `Cloud stairs` and `src/chapter-select/stills/stairs.webp`. The startup entry says “In design” despite the
  boot-veil plan recording multiple implemented phases. Update status without implying unresolved performance,
  device or artistic sign-offs are complete.
- [contracts/progress.md](contracts/progress.md), lines 23–27, omits the `rotary`, `echoes-1` and `echoes-2`
  checkpoints present in `checkpoint-data.ts`. Its geography description stops at revision 9, while the current
  version is 11 and migrations include moving Still and separating the door shore.

## Verification and limits

- `npm run typecheck`: passed.
- Production build to `/tmp/updraft-audit-production-20261017`: passed, with the already documented chunk warning.
- `node tools/production-build-check.mjs`: passed for production and QA, including override exclusion and mist
  parity. Evidence: `/var/folders/2w/krx53_8d0wz9bnc02rvllb8w0000gn/T/updraft-production-check-gZYdpr/`.
- `npm run check:mechanics`: **70 of 73 passed**. Failures: `sleeping-logic`, `foghorn-story`, `drowned-contact`,
  diagnosed above. Full results: `/tmp/updraft-mechanics-1792162414068/results.json`.
- Focused in-memory harness corrections let Sleeping and foghorn checks pass without editing repository files.
  The mill contact failure was reproduced separately; the other contact subgroups passed individually.
- Focused probes established the retained UI, retry mismatch, disabled-analytics build failure, missing telemetry
  chapters and QA-preview source-import incompatibility.
- Local Markdown links in the root project docs and contracts resolved at review time.

This review does not replace a full browser playthrough, listening pass, motion review, or physical iPad/Safari
test. Other sessions were using the machine and GPU, so no performance or visual-regression verdict is made.
The six principal startup/telemetry/loading/build files were hash-checked and unchanged between their probes and
the final report. Other sessions changed additional source files during the run, so passing results describe the
code each check loaded, not an immutable final commit. Existing roadmap issues are not treated as new discoveries.
Temporary probe files and source hashes are in
`/tmp/updraft-code-audit-w3UNw5/`; the findings above retain the meaningful results if those files expire.
