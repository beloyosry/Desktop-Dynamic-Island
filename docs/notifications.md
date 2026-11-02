# Notification tray

Open the expanded island and select the bell, or search for **Open notifications** in Quick Actions (Ctrl+K while the island has keyboard focus). Opening the tray does not mark anything as read.

- **All / Unread** filters recent entries; search matches title, detail, and category.
- Select an entry to mark it as read. The checkmark in the header marks all entries read.
- Select an entry's × to dismiss it, or the trash button to clear all history.
- **Preview drop** adds a clearly labeled preview notification and plays the effect when motion is enabled. Rapid duplicate previews merge into one entry.
- Tab stays inside the tray, Escape closes it, and focus returns to the previous control. Quick Actions and the tray share one modal surface at a time.

## What is collected

History contains alerts emitted by this app: download start/completion/failure, focus and timer completion, breaks, battery/network changes, microphone/camera activity, screenshots, prayer and religious reminders, water reminders, upcoming meetings, and updates. Each source still follows its existing feature switch. User clipboard text, clipboard suggestions, volume/brightness adjustments, and keyboard/Caps Lock feedback never enter history. History items are plain text, with no replayable external actions or HTML.

This feature does not subscribe to Windows Action Center or collect notifications from other applications. It requires no new Windows notification permission or background process.

## Preferences and storage

Settings > Alerts & Privacy has **Notification tray** and **Water-drop effect**. Disabling the tray hides the bell and pauses new capture; it preserves existing history. Presentation mode also pauses capture and hides the tray, restoring the previous preference when leaving the mode. **Clear all** deletes the saved entries.

History is saved in `notifications.json` in the existing application data directory. It retains at most 60 entries and removes entries older than seven days on startup and subsequent history reads/writes. Identical events within 15 seconds merge and become unread again, with a count capped at 99. Titles and details are limited to 160 and 260 characters. Notification contents are excluded from personalization backup exports.

## Motion and resource use

The existing island window renders the tray. The water drop, two expanding rings, and opening transition use finite CSS transform/opacity animations. Arrival effects are limited to one per 1.5 seconds, and a one-shot cleanup removes animation classes after 900 milliseconds. No particle engine, additional blur capture, continuous frame loop, polling, or runtime dependency was added.

The effect stops when the island is hidden, locked, suspended, or motion is disabled. Both the app's reduced-motion preference and the operating system preference are respected. Reduced transparency uses a solid panel. Only the open tray renders its list; unread badges update from events. Dates use cached formatters and do not run a live relative-time timer.

Unit tests cover validation, source preferences, duplicate merging, persistence, read/dismiss/clear, limits, expiry and corrupt storage. Electron tests cover real IPC, simulated source events, keyboard focus, settings synchronization, Presentation mode, hidden-window behavior, motion cleanup, and zero settled animation-frame requests. Browser previews use explicit sample alerts, not live notifications.
