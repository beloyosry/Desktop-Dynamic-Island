# Architecture

The desktop application is TypeScript in strict mode. It retains Electron, vanilla DOM/CSS, the Windows C# helper, and the existing settings files. No UI framework or application-data migration is required.

```text
src/
  main/                       Application entry point and composition
  preload/                    Sandboxed APIs for the three windows
  renderer/island/            Island shell, state, and feature composition
  modules/<feature>/
    domain/                   Feature types and platform-independent rules
    main/                     Native adapters, services, windows, and IPC registration
    renderer/                 Views and presentation controllers
  platform/
    electron/                 Resource paths for development and packaged builds
    storage/                  JSON implementation of the SettingsStore port
    logging/                  Desktop diagnostics
    windows/                  Startup integration and shortcuts
  shared/
    contracts/                Window APIs, event payloads, and persistence port
    renderer/                 DOM, audio, slider, and presentation utilities
  promo/                      Separate compatibility entry for promotional scenes
scripts/                      TypeScript build tools
tests/unit/                   Domain behavior and architecture constraints
tests/e2e/                    Real Electron workflow checks
helper/                       Existing Windows helper executable and C# sources
out/                          Generated application bundles and assets (ignored)
dist/                         Installer and portable build output (ignored)
```

Folders are added only where a feature needs them. For example, reminders have domain data and a renderer; notes additionally have a native persistence adapter and IPC registration.

## Responsibilities and dependencies

- `main/index.ts` sets the existing `dynamic-island-pro` data directory before loading services. `main/application.ts` composes window, media, screenshot, and feature services and wires their lifecycle.
- The island window controller owns placement, hover, visibility, dragging, and desktop backdrop capture. Media helper management, screenshot persistence, Windows startup integration, and feature IPC adapters have separate owners.
- Domain code depends on typed ports. Settings and notes receive a `SettingsStore`; the disk implementation is selected in their main adapters. Prayer calculations and calendar expansion can run without Electron.
- Renderers receive only their declared `Pick<IslandContext, ...>` capabilities. They cannot import main-process implementations. State belongs to the island shell; media, notifications, focus timer, stopwatch, and feature views have separate controllers.
- Optional presentation capabilities (scenes, reminders, audio feedback) are explicitly registered through the typed presentation registry. Production code does not publish feature functions as window globals.
- `shared/contracts/bridge.ts` and `events.ts` define the preload API and event payloads. Preloads expose individual operations through `contextBridge`; subscriptions return cleanup functions. Context isolation and sandboxing remain enabled, and Node integration remains disabled.

These boundaries apply SOLID through focused responsibilities, small capability interfaces, and injected persistence/native-event dependencies. Existing services do not need inheritance hierarchies or a dependency-injection framework.

## Build and packaging

Quran owns a validated bilingual catalog, preferences, and audio URL rules. Its native adapter retrieves the public API on demand and caches metadata; its renderer owns one native audio element and event-driven playback. Performance owns app resource snapshots and explicit cleanup operations. Boost applies a runtime settings layer in renderer presentation and native capture scheduling, preserving raw preferences for profiles and restoration. Neither module adds a runtime dependency or OS-wide process control.

Notifications owns a storage-injected history domain, native IPC adapter, and a typed `NotificationsBridge`. The toast presenter and explicit scene/reminder metadata feed validated text into history. The renderer handles filtering, modal focus, and finite drop animations. No OS notification listener is installed. `notifications.json` has bounded retention and is excluded from personalization backups. See [notification behavior](notifications.md).

Modes owns a validated catalog, search rules, and a layered preference service with an injected `SettingsStore` and feature port. Its native adapter publishes typed `modes-state` snapshots; library, quick switcher, and Quick Actions consume the same `ModesBridge`. `modes.json` retains favorites and a restoration baseline. Modifiers overlay the current mode, and switching modes restores old overrides before applying the next layer. Customization coordinates saved-profile/import/reset boundaries so stale mode restoration cannot overwrite a newly selected profile.

Toolkit owns safe bookmarks, validated IANA clocks, arithmetic/conversion/text utilities, and a renderer with one visible tool at a time. Customization owns profiles, presets, native backup dialogs, and the Personalize screen. Both use injected storage and typed preload contracts; imports validate the complete backup before applying preferences. New files are `toolkit.json` and `profiles.json`; existing notes, app pins, and Windows startup preferences are not part of customization imports.

The original glass octopus artwork is kept in `build/brand/octopus-master.png`. Runtime PNG/ICO exports apply to windows, tray, settings, installer and shortcuts. Only the runtime icons ship; source artwork and preview tooling do not.

`npm run build` first checks all application, build, and test TypeScript, then bundles main, preload, and renderer entry points with esbuild. Each preload is a self-contained CommonJS bundle compatible with Electron's sandbox. Renderers are browser bundles with no Node imports. HTML, CSS, and the Qur'an font are copied into `out/`.

`npm start`, `npm run pack`, `npm run dist`, and `npm run dist:portable` build automatically. Both setup command files also build before launching. Packaged files are explicitly limited to generated application code, assets, the native helper, dependencies, and license. The helper remains outside ASAR; runtime paths resolve from the application root.

Saved filenames and payloads remain compatible, including `settings.json`, `features.json`, `notes.json`, `shelf.json`, application pins, calendar configuration, and caches. Unknown feature keys and mismatched value types are discarded at the settings boundary.

Appearance owns the validated theme/motion catalog and shared presentation tokens. Commands owns action search and the keyboard-driven palette. Custom timer validation lives in the timer domain. The update domain receives a transport port and emits typed snapshots; its Electron adapter owns update scheduling and electron-updater events. Settings and the island consume the same `UpdatesBridge` rather than calling update infrastructure directly. See [release delivery](releases.md) for the NSIS pipeline and verification boundaries.

The appearance module also owns `glass.css` (shared material and accessibility tokens), `island.css` and `settings.css` (page presentation), and `glass.ts` (pointer-driven highlights). Builds copy these styles alongside each page, after its structural stylesheet. Lighting schedules at most one frame per pointer event batch and stops while idle, hidden, or reduced motion/transparency is active. The shell uses `overflow: clip` so focused descendants cannot scroll its content plane. The design draws on [Apple's material guidance](https://developer.apple.com/design/human-interface-guidelines/materials) while retaining the existing Electron/DOM architecture.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run check
npm.cmd run test:promo
npm.cmd run pack
```

Unit tests cover settings validation/subscriptions, notes persistence and normalization, corrupt JSON, clipboard arithmetic/classification, prayer calculations, calendar recurrence, and module boundaries.

Electron tests use temporary user-data directories and `--test-mode` to avoid modifying login items or shortcuts. They exercise the real native helper, preload APIs, notes/todos, cross-window settings/themes, timers, Arabic rendering, and the mini-player's local HTTP server and playback handback. They do not claim to validate third-party video playback, external calendar accounts, production update downloads, or destructive OS tools.

`NOVA_USER_DATA` can select an isolated data folder for development. The mini-player test starts the production window module with copied build assets and a fixture video identifier; it verifies the window and IPC independently of YouTube playback.

Set `NOVA_E2E_EXECUTABLE` to the absolute path of a packaged executable to run `playwright test tests/e2e/desktop.spec.ts tests/e2e/toolkit.spec.ts` against that build. Tests still use temporary data and skip startup integration. Toolkit checks cover calculations, Unicode text, converters, bookmark/clock persistence, password clipboard privacy markers, profiles, layout synchronization, backups, and icon loading. Native file dialogs are stubbed to temporary paths for backup tests; clipboard contents are snapshotted and restored.

`test:promo` uses an installed Chrome or Edge browser to verify music, Arabic prayer scenes, Tools, Timer, Settings, Appearance, Toolkit, and Personalize at standard and minimum window sizes. The browser preview uses explicit mock data and synthetic desktop backgrounds for visual review; its customization storage is in memory and its external operations are simulated.

## Promotional assets

`npm run build:promo` creates a separate demo entry and stages the preview pages. `python promo/src/build.py` runs that build before rendering scenes. Historical JavaScript/Python scene-authoring tools and reference media remain under `promo/`; they are excluded from desktop packages. Their demo globals are supplied only by `src/promo/island.ts`.

## Adding a feature

Follow the [resource efficiency rules](performance.md) for animation, polling, media, and caches. Visual updates should be scoped to visible content and measured in the packaged app.

Define its types and rules under `modules/<feature>/domain`, add a native adapter and narrow IPC API if needed, then initialize its view from `renderer/island/bootstrap.ts`. Keep Node/Electron imports in main/platform code and add shared API types before exposing a new preload operation. Add behavior tests for stateful rules and an Electron workflow check when a new window or IPC path is introduced.
