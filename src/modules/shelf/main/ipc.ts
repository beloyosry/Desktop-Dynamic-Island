import { ipcMain } from 'electron';
import type { EventSender } from '../../../shared/contracts/events';
import type * as Service from './service';

export function registerShelfIpc(shelf: typeof Service, send: EventSender) {
  // --- shelf ---
  const shelfChanged = async () => send('shelf', await shelf.list());
  ipcMain.handle('shelf-list', () => shelf.list());
  ipcMain.on('shelf-add', (_e, paths) => {
    if (Array.isArray(paths)) shelf.add(paths);
    shelfChanged();
  });
  ipcMain.on('shelf-remove', (_e, p) => {
    shelf.remove(p);
    shelfChanged();
  });
  ipcMain.on('shelf-clear', () => {
    shelf.clear();
    shelfChanged();
  });
  ipcMain.on('shelf-open', (_e, p) => shelf.open(p));
  ipcMain.on('shelf-reveal', (_e, p) => shelf.reveal(p));
  ipcMain.on('shelf-drag', (e, p) => shelf.startDrag(e.sender, p));
}
