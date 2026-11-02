<div align="center">

# Dynamic Island Pro

**An interactive, ultra-smooth Dynamic Island for your Windows desktop.**

Live music activities, instant desktop control center, sticky scratchpad & todo checklist, drag & drop file shelf, stopwatch, weather radar, prayer alerts, and Nova companion.

[![Download Installer](https://img.shields.io/badge/Download-Installer-0078d4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/beloyosry/Desktop-Dynamic-Island/releases/latest)
[![Download Portable](https://img.shields.io/badge/Download-Portable%20(.exe)-107c41?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/beloyosry/Desktop-Dynamic-Island/releases/latest)
[![GitHub Releases](https://img.shields.io/badge/Releases-Latest-8a2be2?style=for-the-badge&logo=github)](https://github.com/beloyosry/Desktop-Dynamic-Island/releases)
[![Developer](https://img.shields.io/badge/Developer-Belal%20Yosry-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/beloyosry)
[![License](https://img.shields.io/badge/License-GPL%20v3-orange?style=for-the-badge)](LICENSE)

</div>

---

## 📥 Download (Windows 10 / 11)

Get the latest official build directly:

| Package | Type | Download Link |
| :--- | :--- | :--- |
| 🚀 **Dynamic Island Pro Setup** | Standard Installer (`.exe`) | [**Get the latest Setup**](https://github.com/beloyosry/Desktop-Dynamic-Island/releases/latest) |
| 💼 **Dynamic Island Pro Portable** | Standalone Executable (Zero Install) | [**View portable releases**](https://github.com/beloyosry/Desktop-Dynamic-Island/releases/latest) |
| 🏷️ **All Releases & Notes** | GitHub Releases | [**View Release Assets**](https://github.com/beloyosry/Desktop-Dynamic-Island/releases) |

---

## New in 2.6.0 — Quran, cleanup, and Boost

The **Quran** tab streams recitations from [MP3Quran's public API](https://www.mp3quran.net/ar/api), with Arabic/English reciter search, favorites, available recitation styles, surah search, seek/volume, repeat, automatic next surah, and saved listening position. The live catalog verified on November 2, 2026 contains **244 reciters, 299 recitation collections, and 114 surahs**. Audio loads only on Play and continues while the island is collapsed. Internet is required for streaming. See [Quran player](docs/quran.md).

**Settings > Performance** adds app memory/cache snapshots, **Clear cache**, **Optimize RAM**, and reversible **Boost mode**. Boost uses solid glass, reduced motion, and fewer visual effects without replacing your saved appearance. Cleanup targets this app's disposable resources and keeps notes, settings, and Quran favorites. It does not terminate other applications or change Windows services. Memory reclaimed varies; actual before/after readings are shown. See [resource controls and measurements](docs/performance.md).

## Included in 2.5.0 — A notification tray with a little ripple

Click the bell on the expanded island to open a glass notification tray. A falling water drop and two ripples accompany the opening and new alerts. Search recent alerts, filter unread messages, mark them as read, dismiss individual items, or clear the tray. **Preview drop** lets you try the effect.

The tray collects the island's own download, timer, battery/network, privacy, prayer, water, meeting, and update alerts. It keeps up to 60 entries locally for seven days and merges rapid duplicates. Clipboard contents and transient volume/keyboard controls are excluded. This is island alert history; it does not read the Windows notification center.

Settings > Alerts & Privacy includes independent tray and water-drop switches. Reduced motion and Presentation mode are respected. Effects finish in under a second, with no new background polling or continuous animation. See [notification behavior](docs/notifications.md).

## Included in 2.4.0 — Modes & Mods

Choose from **16 modes**: Everyday, Deep focus, Creator, Light & quiet, Gaming, Coding, Study, Music lounge, Meetings, Presentation, Reading, Night owl, World traveler, Wellness, Prayer & reflection, and Cinema. Each combines useful tabs, colors, layout, and behavior. Use the new layers button on the island or Settings > Modes & Mods to search, filter, favorite, and apply them.

Mix in **eight independent mods**: Silent touch, Calm motion, Solid glass, Pocket size, Click to open, 24-hour time, No glow, and No companion effects. Mods work with any mode or your own setup. Return to my setup restores the preferences they overrode, including after restarting the app. Save combinations as named profiles in Personalize. Favorites appear in Toolkit > Modes, and modes/mods are searchable in Quick Actions.

This adds no background polling, animation loop, or runtime dependency. See [mode behavior and customization](docs/modes.md).

## Included in 2.3.0 — Your island, your way

A new glass octopus icon and a seven-part Toolkit: web shortcuts, calculator with recent results, eight-category unit converter, ten text transformations with undo, password and UUID generator, world clocks, and quick profile switching. Tools run locally; links open in your browser only when selected. Password copies carry Windows clipboard privacy markers.

Settings > Personalize gives you panel size, roundness, opacity, custom accent color, spacing, hover behavior, clock format, tab visibility/order, and a preferred starting tab. Choose Everyday, Deep focus, Creator, or Light & quiet; save up to 12 named setups. Export and import your preferences, profiles, shortcuts, and clocks as JSON.

The new tools add no runtime dependencies or continuous animation loops. World clocks refresh once a minute while visible. The Light & quiet preset uses compact solid surfaces and reduced motion. Existing media, notes, timers, desktop controls, and automatic updates remain available.

## Included in 2.2.1 — Resource efficiency

The glass interface now rests between interactions. Stationary panels stop their animation-frame loop, hidden tabs pause animation, and the stopwatch tracks time without repainting off-screen. Desktop backdrop captures use bounded resolution, refresh less often at rest and on battery, and stop when hidden, locked, suspended, or using reduced transparency. Idle audio resources are released and prayer time formatting uses bounded caches.

Run `npm run profile:performance` to measure the real Electron processes and native helper with an isolated profile. See [performance behavior and measurements](docs/performance.md). Resource usage varies with hardware and activity; Electron still has a baseline memory cost.

## Included in 2.2.0 — Liquid Glass

A Liquid Glass-inspired interface with translucent surfaces, pearl highlights, pointer-responsive reflections, a reshaped Control Center, a floating settings sidebar, and a sculpted live appearance preview. Music controls, the focus dial, quick actions, and mini-player share the new visual language. Settings > Appearance includes Interactive reflections and Reduce transparency; system reduced-motion and increased-contrast preferences are respected.

The shell now clips without scrolling, keeping text inputs and keyboard navigation from shifting the island's contents. The material is implemented with CSS, the existing captured desktop backdrop, and lightweight interaction-driven lighting. It is a Windows/Electron interpretation, not Apple's native platform renderer.

## Also included from 2.1.0

Eight coordinated color palettes, a live Appearance preview, playful button feedback, theme transitions, reduced-motion support, and a searchable quick-action panel. Click the search icon on the island; use Ctrl+K while the island has keyboard focus, arrow keys to choose, Enter to run, and Escape to close.

Settings > Updates shows checks, download progress, errors/retry, and Restart & update. Installed copies download published releases in the background. Portable users can select Get the installer once; existing notes and settings carry over. Publishing a new version is automated by the Windows release workflow. See [Releasing and updating](docs/releases.md).

Local builds: `npm run dist` creates the 2.6.0 installer; `npm run verify:release` verifies its update files. The links above open the latest published release. Building locally does not publish a release.

## 🌟 Key Features & Innovations

### 1. 🎛️ Quick Tools & Control Center (New)
Instant desktop utilities right at the top of your screen:
- **Screen Snip**: One-click screen capture directly copied to clipboard and added to Shelf.
- **Full Screen Capture**: Full display snapshot with instant feedback.
- **Pin Island**: Pin the expanded island open while multitasking.
- **Audio Mute Toggle**: Master system audio mute with 1 click.
- **Empty Recycle Bin**: Clean up temporary trash instantly with haptic feedback.
- **Lock PC**: Fast workstation lock (`Win + L`).
- **8 Color Themes**: Midnight, Cyber, Aurora, Sunset, Glacier, Rose, Nebula, and Lagoon. Personalize glow and animation style in Settings > Appearance.

### 2. 📝 Notes & Interactive Checklist Scratchpad (New)
A micro-notepad and task organizer right in your island:
- Multi-line quick notes with real-time word/character count and instant auto-save.
- Interactive To-Do list with animated checkboxes, strikethrough animations, and celebration confetti.
- "Copy All" and "Clear Completed" quick actions.

### 3. ⏱️ High-Precision Stopwatch & Focus Timer (Upgraded)
- Toggle smoothly between Pomodoro Countdown and **1/100s Precision Stopwatch**.
- Record split lap times with fastest (green) and slowest (amber) lap tracking.
- Set custom countdowns from 1 to 240 minutes, add time without restarting, and customize focus/break lengths.

### 4. 🖱️ Fluid Interactive Gestures
- **Scroll Wheel Volume Scrubbing**: Scroll your mouse wheel over the island to smoothly raise/lower system volume with real-time HUD feedback.
- **Middle-Click Quick Action**: Middle-click the island to immediately toggle Play/Pause for active media or expand/collapse.
- **Double-Click Quick Toggle**: Double-click to instantly expand or collapse.
- **Interactive Nova Petting**: Click or hover over Nova's eyes to see playful winks, floating heart particles, and motivational tips.

### 5. 🎵 Music & Media Experience
- Real-time SMTC sync with Spotify, YouTube, Chrome, Edge, and Windows media players.
- Dynamic gradient audio visualizer with ambient glow.
- Scrub bar, playback controls, and pop-out floating mini-player.

### 6. 🚀 Resource-conscious rendering
- Interaction-driven animations with no continuous repaint loop in a settled island.
- Bounded desktop captures that pause while hidden and refresh less often on battery.
- Web Audio API synthesized micro-clicks (0 KB external audio asset footprint).

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>I</kbd> | Open / Close Island |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>M</kbd> | Play / Pause Media |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd> | Quick Screen Snip |
| **Mouse Wheel on Island** | Adjust System Volume |
| **Middle Click on Island** | Toggle Play/Pause |
| **Double Click on Island** | Expand / Collapse |

---

## 📦 Release Packages

- **Setup Installer (`Dynamic-Island-Pro-Setup-<version>.exe`)**: Full Windows installer with desktop and start menu shortcuts and clean uninstaller.
- **Portable Edition (`Dynamic Island Pro <version> portable.exe`)**: Single standalone executable requiring no installation or admin rights.
- **Local Builds**: Located in the local `dist/` directory after running `npm run dist`.

---

## 🛠️ Development & Building from Source

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Type-check, run unit tests, and verify Electron workflows
npm run check

# Build a local unpacked Windows app
npm run pack

# Build portable standalone exe
npm run dist:portable

# Build NSIS installer exe
npm run dist
```

Requires Windows 10 or 11 (64-bit).

Application code uses strict TypeScript and feature modules. See [Architecture and development](docs/architecture.md) for folder responsibilities, IPC contracts, build outputs, testing, and promo tooling. `npm start` and release commands compile the app automatically; generated JavaScript lives in `out/`.

---

## 👨‍💻 Author & Developer

**Belal Yosry** — Creator & Lead Developer

- 🌐 **GitHub**: [@beloyosry](https://github.com/beloyosry)
- 📁 **Repository**: [beloyosry/Desktop-Dynamic-Island](https://github.com/beloyosry/Desktop-Dynamic-Island)
- 📱 **Phone / WhatsApp**: [+201153969065](https://wa.me/201153969065)

---

## 📄 License & Rights

Copyright © 2026 **Belal Yosry**. All rights reserved.

This project is licensed under the [GNU General Public License v3.0](LICENSE).
