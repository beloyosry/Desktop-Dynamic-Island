import type { EventSender } from '../../../shared/contracts/events';
import { appPath, rendererPath, preloadPath } from '../../../platform/electron/paths';
// The Settings window: a normal, focusable window (the island itself never takes focus).

import { BrowserWindow, ipcMain } from 'electron';

let win: BrowserWindow | null = null;

function open(page?: string) {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (page) send('settings-page', page);
    return;
  }
  win = new BrowserWindow({
    width: 840,
    height: 660,
    minWidth: 640,
    minHeight: 480,
    frame: false,
    show: false,
    backgroundColor: '#0f0f15',
    title: 'Dynamic Island Pro Settings',
    icon: appPath('build', 'icon.ico'),
    webPreferences: {
      preload: preloadPath('settings'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(rendererPath('settings'), page ? { hash: page } : undefined);
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => {
    win = null;
  });
}

const send: EventSender = (channel, data?) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
};

ipcMain.on('prefs-window', (e, action) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w !== win) return;
  if (action === 'close') w.close();
  else if (action === 'minimize') w.minimize();
});

export { open };
export { send };
