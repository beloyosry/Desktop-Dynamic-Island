import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { appPath } from '../electron/paths';
import { errorMessage } from '../../shared/errors';

// --- start with Windows / setup ---
// Start with Windows = a shortcut in the user's Startup folder (works for both the dev
// launch "electron.exe <folder>" and a packaged build).
function startupLink() {
  return path.join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
    'Dynamic Island Pro.lnk',
  );
}

function shortcutOptions() {
  return {
    target: process.execPath,
    args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
    cwd: app.getAppPath(),
    icon: appPath('build', 'icon.ico'),
    iconIndex: 0,
    description: 'Dynamic Island Pro',
  };
}

// Installed builds use the system login item; a dev run ("electron.exe <folder>") keeps the
// shortcut in the Startup folder, since the login item would only start bare Electron.
function startsWithWindows() {
  return app.isPackaged ? app.getLoginItemSettings().openAtLogin : fs.existsSync(startupLink());
}

function setStartWithWindows(on: boolean) {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: on });
    return on;
  }
  const link = startupLink();
  if (!on) {
    try {
      fs.unlinkSync(link);
    } catch {}
    return false;
  }
  return shell.writeShortcutLink(link, 'create', shortcutOptions());
}

// "Setup Nova Island.cmd" launches the app with --setup: create the desktop icon and the
// startup entry, and write what happened to setup-log.txt next to the app.
function runSetup() {
  const lines = [`Nova Island setup - ${new Date().toLocaleString()}`];
  const desktop = path.join(app.getPath('desktop'), 'Nova Island.lnk');
  try {
    const ok = shell.writeShortcutLink(desktop, 'create', shortcutOptions());
    lines.push(`${ok && fs.existsSync(desktop) ? 'OK  ' : 'FAIL'} desktop shortcut: ${desktop}`);
  } catch (err) {
    lines.push(`FAIL desktop shortcut: ${errorMessage(err)}`);
  }
  try {
    const ok = setStartWithWindows(true);
    lines.push(
      `${ok && fs.existsSync(startupLink()) ? 'OK  ' : 'FAIL'} start with Windows: ${startupLink()}`,
    );
  } catch (err) {
    lines.push(`FAIL start with Windows: ${errorMessage(err)}`);
  }
  lines.push(`app: ${process.execPath} ${app.getAppPath()}`);
  const logDir = app.getAppPath();
  try {
    fs.writeFileSync(path.join(logDir, 'setup-log.txt'), lines.join('\r\n') + '\r\n');
  } catch {}
  console.log(lines.join('\n'));
}

app.on('second-instance', (_e, argv) => {
  if (argv.includes('--setup')) runSetup();
});

// The installed app replaces a dev setup's Startup-folder shortcut with the system login item.
// Builds from before the rename ("Dynamic Nova") left their own login item and shortcuts.
function migrateStartup() {
  const startup = path.dirname(startupLink());
  const oldLinks = [
    path.join(startup, 'Dynamic Nova.lnk'),
    path.join(app.getPath('desktop'), 'Dynamic Nova.lnk'),
  ];
  let wasOn = fs.existsSync(oldLinks[0]);
  for (const f of oldLinks) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
  if (!app.isPackaged) {
    if (wasOn) setStartWithWindows(true);
    return;
  }
  const link = startupLink();
  if (fs.existsSync(link)) {
    wasOn = true;
    try {
      fs.unlinkSync(link);
    } catch {}
  }
  // The old login item runs the removed "Dynamic Nova.exe", which Electron can't see once that
  // file is gone, so the first run after the rename removes it blind. An existing data folder
  // means the old build was installed with start-with-Windows on, so the new item takes over.
  const renamed = path.join(app.getPath('userData'), 'renamed');
  if (!fs.existsSync(renamed)) {
    if (fs.existsSync(path.join(app.getPath('userData'), 'settings.json'))) wasOn = true;
    app.setLoginItemSettings({ name: 'electron.app.Dynamic Nova', openAtLogin: false });
    try {
      fs.writeFileSync(renamed, '');
    } catch {}
  }
  if (wasOn) app.setLoginItemSettings({ openAtLogin: true });
}

export { startsWithWindows, setStartWithWindows, runSetup, migrateStartup };
