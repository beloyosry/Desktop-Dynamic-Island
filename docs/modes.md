# Modes & Mods

Open the layers button next to Quick Actions, or **Settings > Modes & Mods**. Choose Modes or Mix-in mods. The library supports keyword search, Work/Play/Quiet/Life filters, and favorites. Toolkit > Modes shows up to six favorites; the full library always contains all 16. Quick Actions can apply any mode, toggle a mod, or restore your setup.

| Mode | Main behavior |
| --- | --- |
| Everyday | All nine tabs and balanced glass |
| Deep focus | Timer, notes, quiet reminders, 25/5 focus settings |
| Creator | Roomy lilac layout, shortcuts, shelf, and notes |
| Light & quiet | Small solid panel, reduced motion, no reflections/glow |
| Gaming | System stats first, quieter alerts, hide in full screen |
| Coding | Text studio, notes, 50/10 focus settings, 24-hour time |
| Study | Timer, notes, calculator, 50/10 focus settings |
| Music lounge | Media controls first and soft rose glass |
| Meetings | World clocks, notes, quiet reminders, clipboard previews off |
| Presentation | Timer first, private-content previews suppressed, hide in full screen |
| Reading | Notes first, warm colors, calm motion, 45-minute focus setting |
| Night owl | Muted lilac surface, reduced movement and glow |
| World traveler | World clocks first, compact controls, 24-hour time |
| Wellness | Hourly water reminders, wellbeing prompts, short focus settings |
| Prayer & reflection | Prayer times first, prayer alerts, reflection reminders |
| Cinema | Quiet media controls, solid compact panel, hide in full screen |

Modes configure Dynamic Island. They do not launch applications, change Windows power plans, start a timer, or modify other applications' notifications. Presentation suppresses this application's listed previews; it is not a screen-sharing privacy guarantee. Focus duration preferences apply to future sessions; an existing countdown is not restarted.

## Mix-in mods

Silent touch disables interface sounds; Calm motion reduces animations; Solid glass removes transparency and backdrop capture; Pocket size sets a compact 600 × 330 panel; Click to open disables hover expansion; 24-hour time changes clock formatting and hides seconds; No glow removes ambient color; No companion effects hides Nova eyes and scene/celebration effects.

Mods override the chosen mode. Disabling a mod reveals the mode's own setting, so disabling Solid glass while using Cinema still leaves Cinema's solid surface. They can also be used with your personal setup, without selecting a mode.

The first mode or mod saves a baseline. Switching modes restores settings owned only by the previous mode, then applies the new mode and active mods. **Return to my setup** restores the settings owned by those layers and preserves unrelated preference edits. Changing an overridden preference manually marks the mode **Customized**; Reapply mode reinstates its values. Applying a saved profile, importing a setup, or resetting preferences ends the mode session. Profile saves capture the current effective preferences.

Mode selection, mods, favorites, and the restoration baseline persist in `modes.json`. Favorites also travel in customization backups. Older version-1 backups remain readable; imported settings become a personal setup without a stale restoration baseline. Notes, pinned apps, Windows startup preferences, and automatic-update preferences are not changed by the built-in mode definitions.

## Performance and boundaries

The library and quick switcher render in response to actions and preference events. Inactive modes run no code or timers. The catalog contains data, and modifiers reuse existing settings. No executable third-party mod loader, extra dependency, background scheduler, or continuous animated preview was introduced. Existing reduced-motion and contrast preferences remain in effect.
