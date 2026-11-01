<div align="center">

# Dynamic Island Pro

**An interactive, ultra-smooth Dynamic Island for your Windows desktop.**

Live music activities, instant desktop control center, sticky scratchpad & todo checklist, drag & drop file shelf, stopwatch, weather radar, prayer alerts, and Nova companion.

[![Build](https://img.shields.io/badge/Build-Passing-30d158?style=for-the-badge&logo=windows&logoColor=white)](#install)
[![Version](https://img.shields.io/badge/Version-2.0.0-3b82f6?style=for-the-badge)](#features)
[![License](https://img.shields.io/badge/License-GPL%20v3-orange?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Key Features & Innovations

### 1. 🎛️ Quick Tools & Control Center (New)
Instant desktop utilities right at the top of your screen:
- **Screen Snip**: One-click screen capture directly copied to clipboard and added to Shelf.
- **Full Screen Capture**: Full display snapshot with instant feedback.
- **Pin Island**: Pin the expanded island open while multitasking.
- **Audio Mute Toggle**: Master system audio mute with 1 click.
- **Empty Recycle Bin**: Clean up temporary trash instantly with haptic feedback.
- **Lock PC**: Fast workstation lock (`Win + L`).
- **5 Glass Themes**: Switch instantly between *Midnight Obsidian*, *Cyber Neon*, *Aurora Mist*, *Sunset Glow*, and *Frosted Glacier*.

### 2. 📝 Notes & Interactive Checklist Scratchpad (New)
A micro-notepad and task organizer right in your island:
- Multi-line quick notes with real-time word/character count and instant auto-save.
- Interactive To-Do list with animated checkboxes, strikethrough animations, and celebration confetti.
- "Copy All" and "Clear Completed" quick actions.

### 3. ⏱️ High-Precision Stopwatch & Focus Timer (Upgraded)
- Toggle smoothly between Pomodoro Countdown and **1/100s Precision Stopwatch**.
- Record split lap times with fastest (green) and slowest (amber) lap tracking.

### 4. 🖱️ Fluid Interactive Gestures
- **Scroll Wheel Volume Scrubbing**: Scroll your mouse wheel over the island to smoothly raise/lower system volume with real-time HUD feedback.
- **Middle-Click Quick Action**: Middle-click the island to immediately toggle Play/Pause for active media or expand/collapse.
- **Double-Click Quick Toggle**: Double-click to instantly expand or collapse.
- **Interactive Nova Petting**: Click or hover over Nova's eyes to see playful winks, floating heart particles, and motivational tips.

### 5. 🎵 Music & Media Experience
- Real-time SMTC sync with Spotify, YouTube, Chrome, Edge, and Windows media players.
- Dynamic gradient audio visualizer with ambient glow.
- Scrub bar, playback controls, and pop-out floating mini-player.

### 6. 🚀 Ultra-Lightweight & Blazing Fast
- GPU-accelerated compositing (`will-change`, CSS subpixel rendering, fluid bezier springs).
- Optimized backdrop blur canvas throttling for near-zero idle CPU usage.
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

## 📦 Executables Ready in `dist/`

The application has been packaged and is ready for use:
- **Portable Version**: `dist/Dynamic Island Pro 2.0.0 portable.exe` *(Run directly with zero installation!)*
- **Setup Installer**: `dist/Dynamic-Island-Pro-Setup-2.0.0.exe` *(Full Windows installer with shortcuts)*
- **Unpacked Folder**: `dist/win-unpacked/Dynamic Island Pro.exe`

---

## 🛠️ Development & Building from Source

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Build portable standalone exe
npm run dist:portable

# Build NSIS installer exe
npm run dist
```

Requires Windows 10 or 11 (64-bit).
