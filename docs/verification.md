# Version 2.6.0 verification — 2026-11-02

Verified locally on Windows with Node 24.14.1 and Electron 44.7.2.

| Check | Result |
| --- | --- |
| Prettier, strict TypeScript, unused imports/parameters | Passed |
| Domain and architecture unit tests | 51 passed |
| Development Electron workflows, including mini-player, Toolkit, modes, notifications, Quran and Performance | 32 passed |
| Chrome/Edge previews, including light/dark backgrounds and minimum window size | 24 passed |
| Windows x64 NSIS installer and unpacked build | Passed |
| Installer SHA-512, latest.yml, differential blockmap | Passed |
| Desktop, Toolkit, modes, notifications, Quran and Performance against the packaged executable | 31 passed |
| ASAR contents and unpacked native helper | Passed |
| Live Quran API and native MP3 playback | Passed in development and packaged builds |
| Resource regression checks | Settled panel, off-tab stopwatch/Quran, finite drop cleanup, Boost restoration, paused buffer release and visibility checks passed |

`npm run check` runs the formatting, type, unit, and development Electron checks. `npm run test:promo` verifies the standalone promo previews.

The current installer is `dist/Dynamic-Island-Pro-Setup-2.6.0.exe` (113,276,362 bytes). Its companion blockmap and `latest.yml` were generated and verified using `npm run verify:release`. The packaged test executable is `dist/win-unpacked/Dynamic Island Pro.exe`. Its native helper started successfully in both development and packaged tests. The GitHub release workflow has not been run remotely.

Quran domain checks cover validated audio origins and available surahs, bilingual and normalized Arabic search, bounded preferences, cached/coalesced requests, offline fallback, and clearing an in-flight catalog. Electron checks exercise lazy loading, favorites, recording styles, playback, seeking, pause/resume, automatic Next, repeat, Stop, and zero off-tab progress DOM writes. Deterministic audio tests use a synthetic catalog and silent WAV streams with real byte-range responses. They exercise the native audio element without contacting the provider.

The separate live check loaded 244 reciters, 299 recitation collections, and 114 surahs from MP3Quran. The packaged player decoded and played 1.17 seconds of Ibrahim Al-Akhdar's real Al-Fatihah recording, then paused; the media element reported a seekable 61.12-second track. Al-Akhdar, Mahmoud Khalil Al-Hussary, and Mishary Alafasi endpoints returned HTTP 206 with `audio/mpeg`. Only the isolated test window was muted. This verifies those samples, not every catalog recording. Evidence: `artifacts/quran-live.json` and `quran-live.png`.

Performance checks verify that Boost applies reduced effects without overwriting saved preferences, and that disabling it restores the latest preferences. Explicit cleanup keeps active audio running, unloads paused audio, clears HTTP/Quran metadata caches, and preserves notes and favorites. These controls operate on this app; they do not clear other programs' caches or force an OS memory trim. See [performance measurements](performance.md) for the packaged seven-scenario diagnostic and its limits.

New browser previews cover the Quran panel at 660 × 350 and 600 × 330 and Performance settings at 840 × 660 and 640 × 480. These use explicit sample data, including the displayed memory figures. Screenshots are `promo-quran.png`, `promo-quran-small.png`, `promo-performance.png`, and `promo-performance-small.png`. Arabic text, scrollable lists, player controls, and compact layouts were visually reviewed. ASAR inspection confirmed version 2.6.0, Quran/Performance styles, both preloads, and exclusion of promo assets.

Notification checks cover persistence, source switches, duplicate merging, bounded history, seven-day expiry, corrupt records, and Unicode/plain-text rendering. Real Electron IPC tests inject a network event, verify the resulting saved notification, and reject clipboard/HUD entries. UI checks exercise search, unread filtering, read/dismiss/clear, preview, Tab/Escape focus, Quick Actions transfer, global toggle, native keyboard focus, Settings synchronization, Presentation mode restoration, lock/unlock, and both application/system reduced motion. The open, settled tray requested zero animation frames over 400 ms with reduced transparency enabled; this is a rendering regression check, not a new CPU/RAM benchmark.

Notification previews were reviewed at 660 × 350 and 600 × 330 panel sizes, including empty history and a paused real CSS drop/ripple frame. Screenshots are `promo-notifications.png`, `promo-notifications-small.png`, `promo-notifications-empty.png`, `notifications-tray.png`, and `notifications-water-drop.png`. Browser history uses explicit sample data. The installed application's own alerts are supported; Windows Action Center integration was not added. The earlier 2.5.0 ASAR inspection also verified `notifications.css` and the island renderer/preload.

Modes checks cover all 16 catalog entries and eight modifiers, layer precedence, switching without stale overrides, preserving unrelated edits on restore, persisted restoration after service reload, invalid IDs and corrupt session data, favorites, customized-state detection, and backward-compatible backup parsing. Electron checks exercise gallery search/categories/favorites, reopening Settings, global settings search, Coding/Text studio routing, modifier stacking, cross-window material changes, Presentation preview suppression, Quick Actions, and saved-profile boundaries. The gallery and quick switcher introduce no timers, frame loops, or runtime dependencies. No fresh CPU/RAM benchmark was run for 2.4.0.

New screenshots: `modes-library.png`, `modes-mods.png`, `promo-modes.png`, `promo-modes-small.png`, `promo-modes-mods.png`, and `promo-toolkit-profiles.png`. Review covered the library at 840 × 660 and 640 × 480, the separate modifier view, keyboard focus, active-state labels, and the compact quick switcher. The packaged version and `modes.css` were also verified inside ASAR.

The Toolkit checks exercise arithmetic and invalid expressions, temperature conversion, Arabic/emoji Base64 round trips and undo, persisted shortcuts and clocks, rejected time zones, password generation and native clipboard privacy markers, and UUID format. Personalization checks verify live panel resizing, tab reordering, named profile save/apply, icon loading, the 600 × 330 panel, and backup export/import with malformed-file rejection. Backup dialogs are stubbed to a temporary file; production IPC and persistence run normally. Existing clipboard contents are materialized into new ClipboardItems before testing and restored afterward.

The new glass octopus icon was checked at 32 pixels and extracted from the packaged executable. Packaged ASAR checks verified the new Toolkit/Personalize styles and icon copies; source artwork and promo tooling are excluded. Screenshots include `promo-toolkit.png`, `promo-toolkit-clocks.png`, `promo-personalize.png`, `promo-personalize-small.png`, `toolkit-compact.png`, and `packaged-icon.png` in `artifacts/`.

The additional hover regression holds the simulated cursor stationary over the collapsed island, verifies that hover intent opens it, then moves the simulated cursor away and verifies collapse. The host cursor position is not changed.

Tests used isolated data directories and did not change startup shortcuts or login items. External video playback, calendar accounts, production update downloads/restarts, destructive OS utilities, and installation through the NSIS wizard were not exercised. The local Windows package is unsigned because no signing certificate is configured.

The update controller tests cover concurrent checks, offline recovery, download progress, guarded installation, disabled automatic mode, and unsupported distributions. Desktop tests query the actual update IPC, then inject explicitly simulated progress/error/ready events to verify both windows. This is UI/state-machine evidence, not live update-delivery proof.

The earlier updater pass inspected the public `v2.0.0` GitHub release read-only and found Setup and portable executables without `latest.yml` or the installer blockmap. Public release state was not refreshed during this feature pass. The new release workflow supplies all three required assets before publishing a stable release. No release was published during this work.

Screenshots under `artifacts/` include `enhanced-tools.png`, `enhanced-timer.png`, `quick-actions.png`, `appearance-settings.png`, `simulated-update-ready.png`, Arabic prayer times, notes, and standalone promotional scenes. Visual review checked the timer's horizontal mode selector, theme palette, command panel, Arabic rendering, and update center. Reduced-motion behavior was also exercised through both the saved preference and the emulated OS setting.

The Liquid Glass pass also verified reflection disabling, high-contrast solid surfaces, keyboard-focus clipping (the shell must not scroll), and all four packaged material stylesheets. Browser previews use mock data and synthetic backgrounds; Electron screenshots use the native application and captured desktop backdrop. The redesigned settings window was reviewed at 840 x 660 and its minimum 640 x 480 size.

The resource efficiency pass adds regression checks for zero animation-frame requests in a settled panel, zero off-tab stopwatch DOM updates with accurate elapsed time on return, and native lock/suspend/resume/unlock handling. Power events are simulated through Electron's event emitter; the host PC is not actually locked or suspended. Timezone cache tests cover multiple zones, seasonal offsets, invalid zones, date mutation safety, and cache eviction. Screenshot settling ignores paused animations, since inactive layers now deliberately pause them. See [performance methodology and results](performance.md) for resource usage and its measurement limits.
