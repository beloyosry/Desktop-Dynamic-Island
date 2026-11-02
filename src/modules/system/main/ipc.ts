import { ipcMain } from 'electron';
import type * as Service from './service';

export function registerSystemIpc(system: typeof Service) {
  // --- system ---
  ipcMain.handle('system-snapshot', () => system.snapshot());
  ipcMain.on('clip-copy', (_e, i) => system.copyClip(i));
  ipcMain.on('clip-clear', () => system.clearClips());
}
