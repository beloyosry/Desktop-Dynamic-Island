import { clipboard } from 'electron';
import { registerQuran } from '../modules/quran/main/service';
import { registerPerformance } from '../modules/performance/main/service';
import { createIslandWindow } from '../modules/island/main/window';
import { registerCustomization } from '../modules/customization/main/service';
import { registerNotificationHistory } from '../modules/notifications/main/service';
import { createMediaBridge } from '../modules/media/main/bridge';
import { createScreenshotService } from '../modules/screenshot/main/service';
import {
  startsWithWindows,
  setStartWithWindows,
  runSetup,
  migrateStartup,
} from '../platform/windows/startup';
import { registerAppsIpc } from '../modules/apps/main/ipc';
import { registerShelfIpc } from '../modules/shelf/main/ipc';
import { registerSystemIpc } from '../modules/system/main/ipc';
import { registerDownloadsIpc } from '../modules/downloads/main/ipc';
import { registerNotesIpc } from '../modules/notes/main/ipc';
import { registerToolsIpc } from '../modules/tools/main/ipc';

import { appPath } from '../platform/electron/paths';
import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  shell,
  dialog,
  powerMonitor,
} from 'electron';
import * as fs from 'fs';

// User data directory for Dynamic Island Pro
import * as log from '../platform/logging/logger';
log.init();

import * as settings from '../platform/storage/json-store';
import * as apps from '../modules/apps/main/service';
import * as shelf from '../modules/shelf/main/service';
import * as system from '../modules/system/main/service';

import * as prayer from '../modules/prayer/main/service';
import * as downloads from '../modules/downloads/main/service';
import * as features from '../modules/settings/main/features';
import * as privacy from '../modules/privacy/main/service';
import * as calendar from '../modules/calendar/main/service';
import * as network from '../modules/network/main/service';
import * as notes from '../modules/notes/main/service';
import * as tools from '../modules/tools/main/service';
import * as prefsWindow from '../modules/settings/main/window';
import * as updater from '../modules/updates/main/service';

// Keep our own windows (the mini player) out of Windows' media sessions, so the island and
// the per-app commands keep targeting the browser tab rather than the mini player.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

const islandWindow = createIslandWindow({ settings, features, onGeneralChange: () => notifyGeneral() });
const { send, createWindow, layout, setVertical, resetPosition, pollCursor, scheduleCapture } = islandWindow;
const prefs = islandWindow.prefs;
const screenshots = createScreenshotService({ send, features, system, shelf });
const mediaBridge = createMediaBridge({
  send,
  onClipboardSeq: screenshots.onClipboardSeq,
  onOmni: islandWindow.onOmni,
  onFullscreen: islandWindow.setFullscreen,
});
const startMedia = mediaBridge.start;
const mediaWrite = mediaBridge.write;
const bridgeStatus = mediaBridge.status;
let tray: Tray | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | undefined;
registerAppsIpc(apps);
registerShelfIpc(shelf, send);
registerSystemIpc(system);
registerDownloadsIpc(downloads);
registerNotesIpc(notes);
registerToolsIpc(tools);
registerNotificationHistory(send);
const quran = registerQuran();
registerPerformance({
  clearCatalog: quran.clearCache,
  releaseCatalog: quran.releaseMemory,
  refreshBackdrop: islandWindow.invalidateBackdrop,
  openSettings: prefsWindow.open,
});
const customization = registerCustomization((channel, ...args) => {
  send(channel, ...args);
  prefsWindow.send(channel, ...args);
}, prefsWindow.open);
ipcMain.handle('prayer-snapshot', () => prayer.snapshot());

// --- menus ---
function appMenu() {
  return Menu.buildFromTemplate([
    { label: 'Nova Island', enabled: false },
    { type: 'separator' },
    {
      label: 'Show island',
      type: 'checkbox',
      checked: !islandWindow.hidden,
      click: (item) => {
        islandWindow.setHidden(!item.checked);
        notifyGeneral();
      },
    },
    {
      label: 'Vertical (dock left / right)',
      type: 'checkbox',
      checked: prefs.vertical,
      click: (item) => setVertical(item.checked),
    },
    { label: 'Reset position', click: resetPosition },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: startsWithWindows(),
      click: (item) => {
        setStartWithWindows(item.checked);
        notifyGeneral();
      },
    },
    { label: 'Expand / collapse   Ctrl+Alt+I', click: () => send('toggle') },
    { label: 'Settings…', click: () => prefsWindow.open() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

ipcMain.on('context-menu', () => appMenu().popup({ window: islandWindow.window ?? undefined }));

// --- Settings window ---
// General options live in main (position, startup); feature switches live in features.js.
function generalState() {
  return {
    shown: !islandWindow.hidden,
    vertical: !!prefs.vertical,
    startWithWindows: startsWithWindows(),
    version: app.getVersion(),
  };
}
function notifyGeneral() {
  prefsWindow.send('general', generalState());
}
ipcMain.on('open-settings', () => prefsWindow.open());
// the island page reports once all its scripts ran (an early error would stop it before this)
ipcMain.on('island-ready', () => log.info('island ready'));
ipcMain.on('update-install', () => updater.install());
ipcMain.handle('update-status', () => updater.snapshot());
ipcMain.handle('update-check', () => updater.check());
ipcMain.on('update-releases', () => updater.openReleases());
ipcMain.on('update-center', () => prefsWindow.open('updates'));
ipcMain.handle('features-get', () => features.get());
ipcMain.on('features-set', (_e, patch) => features.set(patch));
ipcMain.on('features-reset', () => {
  customization.clearModes();
  features.reset();
});
ipcMain.on('reminder-preview', () => send('reminder-now'));
ipcMain.handle('general-get', () => generalState());
// Settings > Support: the page names a link, main holds the addresses
const SUPPORT_LINKS: Record<string, string> = {
  kofi: 'https://ko-fi.com/binamer',
  instapay: 'https://ipn.eg/S/binamerbm/instapay/38txJO',
  github: 'https://github.com/beloyosry/Desktop-Dynamic-Island',
  whatsapp: 'https://wa.me/201153969065',
  developer: 'https://github.com/beloyosry',
};
ipcMain.on('open-support', (_e, key) => {
  if (Object.hasOwn(SUPPORT_LINKS, key)) shell.openExternal(SUPPORT_LINKS[key]);
});
ipcMain.handle('bridge-status', () => bridgeStatus());
ipcMain.on('open-log', () => {
  if (log.logPath() && fs.existsSync(log.logPath()!)) shell.openPath(log.logPath()!);
});
ipcMain.handle('copy-report', async () => {
  const f = features.get();
  const on = Object.values(f).filter((value) => value === true).length;
  const report = log.report({
    bridge: bridgeStatus(),
    location: system.locationInfo().mode,
    features: `${on} on`,
    vertical: !!prefs.vertical,
    calendar: calendar.hasUrl() ? 'linked' : 'none',
  });
  await clipboard.writeText(report);
  return true;
});
ipcMain.handle('loc-get', () => system.locationInfo());
ipcMain.handle('net-get', () => network.snapshot());
// smart clipboard: act on what main itself recognised, never on data from the page
const VIDEO_HOSTS =
  /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|facebook\.com|fb\.watch|vimeo\.com|reddit\.com|soundcloud\.com|dailymotion\.com)$/i;
ipcMain.on('clip-action', async (_e, action) => {
  const s = system.lastSmart();
  if (!s) return;
  if (s.type === 'url' && action === 'open' && /^https?:\/\//i.test(s.url)) shell.openExternal(s.url);
  else if (s.type === 'url' && action === 'download') {
    try {
      const r = await fetch('http://127.0.0.1:17890/add', {
        method: 'POST',
        headers: downloads.novaHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ url: s.url, media: VIDEO_HOSTS.test(new URL(s.url).hostname) }),
        signal: AbortSignal.timeout(4000),
      });
      if (r.status === 403) downloads.forgetToken();
      if (!r.ok) throw new Error(`IDM Nova answered ${r.status}`);
    } catch {
      shell.openExternal(s.url);
    }
  } else if (s.type === 'math' && action === 'copy') system.writeQuiet(s.result);
});
// download folders watched for browser downloads (Settings > Connections)
import * as folderDownloads from '../modules/downloads/main/folder-watcher';
ipcMain.handle('dl-folders', () => folderDownloads.folderList());
ipcMain.handle('dl-folder-add', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win!, {
    title: 'Add a download folder',
    properties: ['openDirectory'],
  });
  return r.canceled || !r.filePaths[0]
    ? folderDownloads.folderList()
    : folderDownloads.addFolder(r.filePaths[0]);
});
ipcMain.handle('dl-folder-remove', (_e, p) => folderDownloads.removeFolder(p));
ipcMain.handle('cal-get', () => ({ ...calendar.snapshot(), hasUrl: calendar.hasUrl() }));
ipcMain.handle('cal-set', (_e, url) => calendar.setUrl(url));
// only meeting links the calendar itself produced (Meet / Teams / Zoom / Webex, https)
ipcMain.on('open-meeting', (_e, link) => {
  if (calendar.isJoinLink(link)) shell.openExternal(link);
});
ipcMain.handle('loc-search', async (_e, q) => {
  try {
    return await system.searchCity(q);
  } catch {
    return null;
  }
});
ipcMain.on('loc-set', (_e, loc) => system.setLocation(loc));
system.onLocationChange((info) => {
  prayer.refresh();
  prefsWindow.send('location', info);
});
ipcMain.on('general-set', (_e, key, value) => {
  const on = !!value;
  if (key === 'shown') {
    islandWindow.setHidden(!on);
  } else if (key === 'vertical') setVertical(on);
  else if (key === 'startWithWindows') setStartWithWindows(on);
  else if (key === 'resetPosition') resetPosition();
  notifyGeneral();
});
let prayerCalc = `${features.get().asrHanafi}|${features.get().hijriAdjust}`;
let autoUpdate = features.get().autoUpdate;
features.onChange((f) => {
  const calc = `${f.asrHanafi}|${f.hijriAdjust}`;
  if (calc !== prayerCalc) {
    prayerCalc = calc;
    prayer.refresh();
  }
  send('features', f);
  prefsWindow.send('features', f);
  downloads.setEnabled(f.downloads);
  downloads.setFolders(f.folderDownloads);
  privacy.setEnabled(f.privacyDots);
  network.setEnabled(f.netToasts);
  if (f.autoUpdate !== autoUpdate) {
    autoUpdate = f.autoUpdate;
    updater.setEnabled(autoUpdate);
  }
  if (!f.clipboardHistory) system.clearClips();
  islandWindow.updateFeatures();
});

function trayIcon() {
  const img = nativeImage.createFromPath(appPath('build', 'icon.png'));
  if (!img.isEmpty()) return img.resize({ width: 16, height: 16, quality: 'best' });
  // fallback: white pill
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(Math.max(x + 0.5, 4), 12);
      const inPill = Math.hypot(x + 0.5 - cx, y + 0.5 - 8) <= 3.2;
      const o = (y * size + x) * 4;
      buf[o] = buf[o + 1] = buf[o + 2] = 255;
      buf[o + 3] = inPill ? 255 : 0;
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Dynamic Island Pro');
  tray.on('click', () => tray?.popUpContextMenu(appMenu()));
  tray.on('right-click', () => tray?.popUpContextMenu(appMenu()));
}

app.whenReady().then(() => {
  // Automated runs use isolated data and must not change the user's login items/shortcuts.
  const isolatedTest = process.argv.includes('--test-mode') && !!process.env.NOVA_USER_DATA;
  if (!isolatedTest) migrateStartup();
  if (process.argv.includes('--setup')) runSetup();
  createWindow();
  buildTray();
  startMedia();
  system.start(send);
  prayer.start(send, system.getLocation);
  downloads.start(send, features.get().downloads, features.get().folderDownloads);
  privacy.start(send, features.get().privacyDots);
  network.start(send, features.get().netToasts);
  updater.start((channel, ...args) => {
    send(channel, ...args);
    prefsWindow.send(channel, ...args);
  }, autoUpdate);
  // waking from sleep or getting the internet back: weather, prayer times and a failed update
  // check catch up at once instead of waiting for their next timer (5 s for Wi-Fi to reconnect)
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;
  const wake = () => {
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => {
      system.refreshNow();
      prayer.retry();
      updater.retrySoon();
    }, 5000);
  };
  powerMonitor.on('resume', wake);
  let suspended = false;
  let locked = false;
  const syncPowerState = () => islandWindow.setSystemPaused(suspended || locked);
  powerMonitor.on('suspend', () => {
    suspended = true;
    syncPowerState();
  });
  powerMonitor.on('resume', () => {
    suspended = false;
    syncPowerState();
  });
  powerMonitor.on('lock-screen', () => {
    locked = true;
    syncPowerState();
  });
  powerMonitor.on('unlock-screen', () => {
    locked = false;
    syncPowerState();
  });
  islandWindow.setOnBattery(powerMonitor.isOnBatteryPower());
  powerMonitor.on('on-battery', () => islandWindow.setOnBattery(true));
  powerMonitor.on('on-ac', () => islandWindow.setOnBattery(false));
  network.onBack(wake);
  calendar.start((ch, ...args) => {
    send(ch, ...args);
    prefsWindow.send(ch, ...args);
  });
  apps.init(async () => send('apps', await apps.list()));
  shelf.start(async () => send('shelf', await shelf.list()));
  // Keep hover responsive, with no high-frequency wakeups while the island is hidden.
  const cursorPoll = () => {
    pollCursor();
    cursorTimer = setTimeout(cursorPoll, islandWindow.window?.isVisible() ? 80 : 1000);
  };
  cursorPoll();
  scheduleCapture(300);
  globalShortcut.register('CommandOrControl+Alt+I', () => send('toggle'));
  try {
    globalShortcut.register('CommandOrControl+Alt+M', () => mediaWrite('toggle'));
    globalShortcut.register('CommandOrControl+Alt+S', () => tools.takeSnip());
  } catch {}
  screen.on('display-metrics-changed', () => layout());
  screen.on('display-added', () => layout());
  screen.on('display-removed', () => layout());
});

app.on('before-quit', () => {
  clearTimeout(cursorTimer);
  updater.stop();
  globalShortcut.unregisterAll();
  mediaBridge.stop();
});

app.on('window-all-closed', () => app.quit());
