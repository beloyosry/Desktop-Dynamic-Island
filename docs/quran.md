# Quran player

Open **Quran** in the island tabs, scroll the tab strip if necessary, or search **Open Quran player** in Quick Actions. Prayer & reflection mode also includes the player. Tab visibility and order remain configurable in Personalize/Island settings.

The player uses [MP3Quran API v3](https://www.mp3quran.net/ar/api). It requests Arabic and English reciter/surah metadata without an account or API key. Live verification on November 2, 2026 returned 244 reciters, 299 recitation collections, and all 114 surahs. Availability can change and some collections have only selected surahs. The app shows the provider's complete usable catalog instead of a fixed shortlist.

- Search reciters by Arabic or English name. Arabic search ignores diacritics and normalizes common letter variants. The list renders 60 matches at a time with Show more.
- Select a reciter and available recitation style. Only that collection's available surahs appear; search by Arabic/English name or number.
- Star the selected reciter, then use the star beside reciter search to show favorites.
- Select a surah to play. Play/pause, previous/next, seeking, volume, repeat one/all, and automatic Next are available. Repeat all wraps at the end of the selected collection when Next is enabled.
- Listening continues off-tab and while collapsed. Stop unloads the audio buffer and resets the position. Pausing saves the position; the next Play resumes it, including after restarting the app. There is no automatic playback on launch.
- Refresh library retries metadata loading. Network/playback errors are visible and can be retried with Play or another reciter. MP3Quran opens the source website.

Metadata is cached locally in `quran-catalog.json` for seven days and fetched only when the player is used. Failed refreshes can fall back to the last valid catalog. Audio still requires internet; this version does not provide offline audio downloads. The native audio element uses `preload="none"`; no audio file is fetched on catalog selection alone. Volume, selected reciter/style/surah, position, repeat, Next, and up to 100 favorite IDs persist in `quran.json`. Position writes are limited to ten-second playback checkpoints and explicit pause/seek actions. These files are separate from personalization backups.

The main process validates API responses and constructs audio URLs from the selected collection and available surah. Only HTTPS CDN/numbered-server origins under `mp3quran.net` are accepted; raw renderer-supplied streaming URLs and HTML are not used. Requests have timeouts and response-size caps, duplicate catalog requests coalesce, and clearing a catalog prevents an in-flight response from repopulating the cache.

One audio element serves the player. It creates no frame loop, spectrum visualizer, or polling service. Player progress renders only while its tab is visible. Optimize RAM releases paused audio buffers and hidden library rows while keeping the listening position; active audio is preserved. Boost does not disable playback.

Deterministic tests use a clearly synthetic catalog and silent WAV responses with HTTP byte ranges; they exercise the real Electron bridge and native audio element. `npx tsx scripts/verify-quran-live.ts` is a separate opt-in live check: it creates an isolated profile, mutes only that app window, loads the real catalog, plays/pauses a real MP3, checks three reciter endpoints, and writes `artifacts/quran-live.json`. Network availability can affect this check. Browser promo pages use a small non-streaming sample catalog and do not claim live playback.
