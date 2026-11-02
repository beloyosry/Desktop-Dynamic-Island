# Supporter layout pack

The optional $9 one-time offer contains six editable layouts, preview images, a bilingual guide and seven calendar days of installation/import help at **Byosry@gmail.com**. The app stays free. Equivalent layouts can be made manually; there is no account system, license key, subscription or runtime payment dependency.

## Compatibility and safe import

Requires **Dynamic Island Pro 2.6.1+**. The [free installer and corresponding source](https://github.com/beloyosry/Desktop-Dynamic-Island/releases/tag/v2.6.1) are public. The [optional $9 pack](https://byosrydevkits.gumroad.com/l/dynamic-island-supporter) is available on Gumroad.

Packs use `format: "dynamic-island-profile-pack"`, `version: 1`, and 1–12 `{ name, features }` entries. The complete file is validated before writing: unique nonempty names, canonical tab order, bounded values and an appearance/navigation allowlist. Unknown or behavioral settings are rejected. The existing 500 KB file limit applies. No new IPC or preload methods were added.

Import appends saved profiles without activating one or replacing current settings, profiles, notes, pinned apps, Quran preferences, bookmarks, clocks or mode state. Exact reimports do nothing. Name conflicts and insufficient space cancel the entire import; individual files let users fit the existing 12-profile limit.

Imported profiles retain `kind: "layout"` and partial features. Apply changes only those appearance/navigation fields, preserving even later changes to privacy settings, reminders, sounds and timer durations. Every supplied profile keeps all ten tabs enabled. Meeting and Quiet are visual styles, not privacy or notification suppression modes. Applying a profile exits the mode/mod session using the existing behavior.

Personal profiles retain full-snapshot behavior. Standard version-1 backups remain supported and preserve layout scope when exported/restored with 2.6.1+. Older apps do not understand layout scope: restore a pre-upgrade backup if downgrading. No data migration is required.

## Reproducible delivery

- `npm run build:supporter` validates the catalog and writes the six individual JSONs, combined JSON, guide, terms and SHA-256 manifest to `artifacts/supporter/customer`.
- `npm run media:supporter` builds the existing promo renderer and creates six previews, two covers, a thumbnail, guide QA screenshots and three short video scenarios in both English and Arabic. Requires Playwright's recording binary (`npx playwright install ffmpeg`) and an H.264 encoder; see `supporter/launch-playbook.md`.
- `powershell -NoProfile -File scripts/package-supporter.ps1` validates checksums and six previews, then archives the customer and marketing folders separately.
- `npm run check`, `npm run test:promo`, `npm run dist`, `npm run verify:release` run the standard app checks and build/verify a local Windows installer.

Catalog and media code are development-only. Customer JSON is the editable source, licensed under GPLv3. Marketing uses the real renderer with explicitly staged data; it is not evidence of live OS drag/drop, music-provider integration, publication or revenue. Videos are silent portrait H.264 MP4 with on-screen text.

## Launch handoff

The listing is in `supporter/gumroad-listing.md`; generated captions are in `artifacts/supporter/marketing/captions.md`; the two-week schedule, reporting sheet and support replies are in `supporter/launch-playbook.md`. The owner's support email and live product URL are in `supporter/launch-config.json`. Marketing videos and captions have been regenerated for the live store. The original customer ZIP verified through test checkout is retained unchanged.

Publication and creator test checkout are verified in `supporter/gumroad-status.md`. The test purchase downloaded the exact customer ZIP without a real charge. Actual payouts, revenue and the two-week campaign results have not been tested. Social channels/community destinations have not been supplied, so promotional posts have not been published.
