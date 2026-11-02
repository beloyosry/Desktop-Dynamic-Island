# Resource efficiency

The app keeps its glass appearance but avoids continuous rendering when nothing is changing. It cannot have zero impact: Electron, the native helper, active media, and desktop effects all use resources.

## Runtime behavior

Version 2.6.0 adds **Settings > Performance**. Refresh samples Electron process working sets, the default session's HTTP cache, and system free/total memory on demand. These figures do not run a new background polling loop. Shared pages can be counted in multiple process working sets; the native helper is excluded from this UI metric and included in the separate diagnostic below.

**Boost mode** is an effective-settings layer: it disables screen backdrop captures, shrinks the two glass canvases, uses solid surfaces/reduced motion, and suppresses reflections, glow, droplet animations, companion eyes/focus/prayer scenes, celebrations, and clock seconds. It preserves timers, notifications, Quran playback, and the raw appearance preferences. Disabling it reveals the latest saved preferences, including edits made while Boost was active. Reduced-motion geometry updates settle within a brief frame window.

**Clear cache** clears Electron's default-session HTTP cache and the Quran metadata cache. It does not clear cookies, local storage, application preferences, notes, notification history, favorites, or pinned files. No user-selected directory or arbitrary path is deleted. The UI reports the measured browser-cache difference; metadata-file bytes are not included in that number.

**Optimize RAM** releases the app's Blink resource caches, glass canvases, idle sound context, paused Quran buffers, and hidden Quran lists/catalog references. Active playback stays running, and normal glass redraws on the next capture when Boost is off. The operation runs on request only, with concurrent cleanup calls coalesced. It does not force garbage collection, trim other processes, or promise a fixed RAM reduction. The UI reports actual before/after working sets, which can also rise due to unrelated activity.

- Notification history holds at most 60 entries, prunes seven-day-old records on access, and redraws the list only when open. Drop/ripple effects use finite transform/opacity animations with a 900 ms cleanup and arrival throttling. They stop while hidden or with reduced motion. The tray adds no polling, continuous frame loop, native process, or runtime dependency; its settled Electron test records zero animation-frame requests over 400 ms with backdrop capture disabled through reduced transparency.
- Island animation frames run during transitions, movement, and a changed backdrop fade. Keeping a panel open does not keep a frame loop alive. Hit-test bounds are reported during these transitions instead of polling DOM layout every 50 ms.
- Media progress refreshes twice per second only while its panel is visible. The stopwatch paints at most 20 times per second while visible and stops painting on other tabs, when collapsed, or when hidden. Elapsed time comes from the clock rather than the number of display updates.
- Invisible layers pause CSS animation and release permanent compositor hints. Native window visibility is used alongside browser visibility because an attached debugger can leave `document.hidden` reporting visible after a native hide.
- Glass captures refresh approximately every 1.5 seconds during interaction, every 15 seconds at rest, and at twice those intervals on battery. Showing, moving, or expanding the island requests a fresh image. Hidden, locked, suspended, and reduced-transparency states disable capture scheduling. An in-flight capture cannot start another polling chain after cancellation.
- Capture thumbnails are at most one quarter display resolution, with a 960-pixel longest-edge cap. Both blurred canvases use half resolution (75% fewer pixels). Existing screen captures for the user's screenshot tools retain their full quality.
- Cursor detection uses 80 ms while visible and 1 second while hidden, skips repeated native bounds lookups for a stationary cursor, and still completes hover intent. Glass refreshes settle back to the idle rate even when the pointer remains over the island. Drag tracking remains responsive. Reduced-motion and reduced-transparency preferences remain available.
- Sounds reuse a context while playing, disconnect completed nodes, and close the context after five quiet seconds. Countdown controls avoid unchanged DOM writes. Prayer timezone formatters and converted instants use bounded caches.
- System monitoring, download detection, alerts, and update delivery retain their background functionality; they are not presented as free work.
- Toolkit operations run on demand, with bounded lists (24 shortcuts, 8 clocks, 12 profiles, 5 calculations) and bounded text input. World clocks reuse formatters and schedule one minute-boundary update only while their panel is visible. No animation library, polling service, or runtime dependency was added for these tools. The main clock checks once per second but changes the DOM only when the displayed time changes; showing seconds is optional.

## Reproducible measurement

```powershell
npm.cmd run profile:performance
# Against the local packaged executable, after npm run dist:
$env:NOVA_E2E_EXECUTABLE = Join-Path (Get-Location) 'dist/win-unpacked/Dynamic Island Pro.exe'
$env:NOVA_PROFILE_LABEL = 'packaged'
npx.cmd tsx scripts/profile-performance.ts
```

The diagnostic runs seven scenarios in a disposable profile: expanded Tools, Boost, Boost after explicit memory cleanup, Toolkit world clocks, a running stopwatch on another tab, collapsed with that stopwatch still running, and hidden. Boost is disabled again before the Toolkit sample. It disables unsolicited greetings/reminders and automatic update checks for a stable sample; native system/media monitoring remains enabled, and glass remains enabled outside Boost. It does not alter the user's settings or login items. Each scenario settles for four seconds and samples for twelve seconds by default; set `NOVA_PROFILE_SECONDS` for longer samples. JSON reports are written to `artifacts/performance-<label>.json`.

Electron's [app metrics](https://www.electronjs.org/docs/latest/api/app#appgetappmetrics) identify its process IDs. The script also finds the native helper and samples Windows process CPU time, working sets, and private bytes. CPU is normalized across the machine's logical processors. Summed working sets can double-count shared pages; private bytes are committed private memory, not necessarily resident RAM. Short-lived registry/shell commands, GPU memory/power, external media players, and system services are outside these totals. These are short local observations, not guarantees for every PC or a long-run leak test.

## Local packaged measurements — 2026-11-02

Windows, Electron 44.7.2, 16 logical processors, approximately 12.3 seconds per sample. Both versions used the same isolated settings and the same diagnostic flow. Baseline: packaged 2.2.0. Optimized: packaged 2.2.1. Figures include the native helper.

| Scenario | CPU 2.2.0 | CPU 2.2.1 | Private MiB 2.2.0 | Private MiB 2.2.1 | Frame requests before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Expanded Tools, stationary | 0.82% | 0.65% | 386.8 | 346.8 | 738 → 0 |
| Running stopwatch on another tab | 0.76% | 0.67% | 415.0 | 393.8 | 1472 → 0 |
| Collapsed, stopwatch still running | 0.87% | 0.95% | 411.0 | 347.0 | 736 → 0 |
| Hidden | 0.30% | 0.32% | 340.8 | 332.9 | 0 → 0 |

CPU results are mixed and sensitive to background activity; these short samples do not establish a universal CPU improvement. The deterministic improvement is eliminating continuous idle/off-tab painting, which the regression tests also verify. Total private memory was lower in all four observations. The 2.2.1 summed working sets ranged from 524.9 to 657.2 MiB; shared-page accounting makes that different from unique physical RAM. Captures during the four 2.2.1 sample windows were 0, 1, 0, and 0 respectively.

The raw local reports are `artifacts/performance-baseline.json` and `artifacts/performance-packaged.json`. They are generated diagnostics, excluded from the installer and source control. Re-run the diagnostic on target hardware when evaluating future changes.

## Version 2.3.0 Toolkit measurement — 2026-11-02

The same Windows PC and packaged diagnostic sampled five states for 12.3 seconds each. Glass and the native helper were enabled. Raw report: `artifacts/performance-octopus.json`.

| Scenario | Machine CPU | Private MiB | Summed working MiB | Frame requests | Desktop captures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Expanded Tools | 0.79% | 404.7 | 575.2 | 12 | 1 |
| Toolkit world clocks | 0.90% | 402.7 | 586.1 | 55 | 2 |
| Stopwatch on another tab | 0.65% | 364.9 | 634.1 | 12 | 1 |
| Collapsed | 0.66% | 354.8 | 625.4 | 0 | 0 |
| Hidden | 0.24% | 353.8 | 624.8 | 0 | 0 |

The visible glass samples include brief redraws around native backdrop refreshes; they are not a continuous frame loop. The automated settled-panel regression disables backdrop captures and still observes zero frame requests, and the off-tab stopwatch test observes zero DOM updates while preserving elapsed time. The new clocks use a minute-boundary timeout that stops when their view is hidden.

These readings do not establish lower memory usage than 2.2.1: Electron process allocation and desktop captures vary, and the new version still has a substantial baseline memory footprint. No runtime dependency was added for Toolkit or Personalize. Use Light & quiet to turn off transparency/reflections and reduce motion; its resource usage was not separately benchmarked here.

## Version 2.6.0 Boost measurement — 2026-11-02

The packaged 2.6.0 executable ran all seven scenarios on the same 16-logical-processor Windows PC, with 12.3-second samples after settling. Figures include the native helper; playback was inactive. Raw report: `artifacts/performance-boost-2-6.json`.

| Scenario | Machine CPU | Private MiB | Summed working MiB | Frame requests | Desktop captures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Expanded Tools | 0.64% | 349.9 | 521.8 | 0 | 0 |
| Boost | 0.13% | 321.7 | 497.6 | 0 | 0 |
| Boost after Optimize RAM | 0.18% | 312.3 | 488.5 | 0 | 0 |
| Toolkit world clocks, Boost off | 0.62% | 340.0 | 517.3 | 12 | 1 |
| Stopwatch on another tab | 0.49% | 357.5 | 623.2 | 12 | 1 |
| Collapsed | 0.65% | 338.1 | 603.4 | 0 | 0 |
| Hidden | 0.17% | 338.2 | 604.2 | 0 | 0 |

Boost had zero running CSS animations in both sampled states. The ordinary glass samples can have brief redraws around backdrop refreshes; no capture happened within the first 12.3-second sample, which is shorter than the resting capture interval. Private committed memory fell by 37.6 MiB between expanded Tools and Boost after cleanup in this run. This is a short sequential observation, not a guaranteed saving or a controlled long-run CPU comparison. Electron retains a substantial baseline memory footprint. An additional Electron process appeared in the later stopwatch samples and contributed approximately 95 MiB to summed working sets but only 10 MiB to private bytes; working-set totals therefore should not be read as unique physical RAM.

The native Quran test separately confirms real streaming and the deterministic tests confirm that off-tab playback does not repaint progress, active audio survives cleanup, and paused buffers unload. Continuous Quran playback was not included in this CPU/RAM diagnostic.

## Keep future changes lightweight

Version 2.4.0 adds a data-only catalog of 16 modes and eight modifiers. Its library and quick switcher update on user actions or preference events, with no new timer, animation frame loop, or runtime dependency. The previous 2.3.0 CPU/memory samples above are historical measurements, not measurements of 2.4.0. The existing idle-frame, off-tab stopwatch, and visibility regression checks continue to run for the new version.

Use event-driven rendering and bounded caches. Do not add a permanent animation frame loop, high-frequency background timer, full-screen canvas, repeated formatter creation, or unbounded history without a measured need. Keep clocks accurate independently of refresh rate. Pause visual work when its view is hidden, retain Electron's background throttling and hardware acceleration, and check both battery and normal operation when changing capture scheduling. Run the idle/stopwatch and lock/sleep regression tests plus this diagnostic when changing animation or polling behavior.
