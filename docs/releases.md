# Releasing and updating

## Using the app

Use the **Setup installer** for automatic updates. Install it once, then use Settings > Updates to check for new versions, watch download progress, and select **Restart & update**. With Automatic updates enabled, checks run one minute after launch and every six hours. Downloads happen in the background; a downloaded update also installs when you quit. Failed checks retry after the computer wakes or reconnects.

Switching Automatic updates off stops scheduled checks and installation on quit. An explicit Check for updates still downloads an available release, which you can install using Restart & update. An already-running download may finish; it will wait for your action.

The portable edition cannot update itself using the NSIS updater. Its update center offers **Get the installer**. Quit the portable copy before starting the installed copy. Both use `%APPDATA%/dynamic-island-pro`, preserving notes, preferences, and pinned apps. Development runs display their build type and never fetch installers.

An app restart is required to apply packaged code. No uninstall or repeated setup wizard is needed for updates to the installed edition.

## Preparing a version

1. Bump the version without creating a Git tag: `npm version patch --no-git-tag-version` (use `minor` for a feature release).
2. Run `npm run check` and `npm run test:promo`.
3. Build with `npm run dist`, then run `npm run verify:release`.
4. Review changes and commit them through the normal repository process. Create and push a `v<package.json version>` tag when ready to publish.

The tag-triggered `.github/workflows/release.yml` runs the checks on Windows, builds an x64 NSIS installer, verifies the version and SHA-512 metadata, and uploads all assets to a draft release. It publishes only after all uploads succeed. Re-running a failed draft release is supported; published releases must use a new version. No publication occurs from local `dist`, `pack`, or `dist:portable` commands.

Required release files:

- `Dynamic-Island-Pro-Setup-<version>.exe`
- `Dynamic-Island-Pro-Setup-<version>.exe.blockmap`
- `latest.yml`

Keep all three on the same public, stable GitHub release in `beloyosry/Desktop-Dynamic-Island`. The installer and manifest are required; the blockmap enables differential downloads, with a full-download fallback handled by electron-updater. Keep older release artifacts available for existing clients. Never reuse a version or edit an already-published installer in place.

The workflow uses GitHub's repository token with `contents: write`. Signing is optional in the workflow: configure `CSC_LINK` and `CSC_KEY_PASSWORD` repository secrets for your Windows certificate. No credentials are embedded in the application. Local unsigned builds may show Windows SmartScreen prompts; signing and public release delivery must be verified with the production certificate/environment before claiming that path has been tested.

`appId`, executable name, update repository, and user-data path are unchanged. A newer published installer can be delivered by the updater already present in installed 2.0.0 copies. This depends on the existing copy being installed, automatic updates being enabled, and the release assets being public and complete.

## Implementation and verification boundaries

The update controller lives in `modules/updates/domain`, receives a transport port, and guards duplicate checks/restarts. Electron and electron-updater remain in the main adapter. Both windows use the same typed `UpdatesBridge` and state snapshot. Release links are fixed in main; renderers cannot select an arbitrary installer or feed URL.

Unit tests exercise progress, ready/install guards, disabled automatic mode, concurrency, error recovery, and unsupported distributions. Electron tests exercise real IPC/status queries and render simulated download/error/ready events; they do not download or install a production release. `verify:release` checks the actual local installer checksum and manifest. Full end-to-end update delivery requires two published versions and an installed copy on a disposable Windows environment.

References: [electron-builder v26 auto-update documentation](https://www.electron.build/v26/docs/features/auto-update/). The project currently uses electron-updater 6; its API differs from version 7.
