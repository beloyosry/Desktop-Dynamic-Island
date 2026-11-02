import { ipcMain } from 'electron';
import type * as Service from './service';

export function registerDownloadsIpc(downloads: typeof Service) {
  // --- IDM Nova downloads ---
  ipcMain.handle('dl-snapshot', () => downloads.snapshot());
  ipcMain.on('dl-control', (_e, id, action) =>
    downloads.control(typeof id === 'string' ? id : '', String(action)),
  );
}
