import { ipcMain } from 'electron';
import type * as Service from './service';

export function registerAppsIpc(apps: typeof Service) {
  // --- apps ---
  ipcMain.handle('apps-list', () => apps.list());
  ipcMain.handle('apps-all', () => apps.all());
  ipcMain.on('apps-add', (_e, id) => apps.add(id));
  ipcMain.on('apps-remove', (_e, id) => apps.remove(id));
  ipcMain.on('apps-launch', (_e, id) => apps.launch(id));
  ipcMain.on('apps-reorder', (_e, ids) => apps.reorder(ids));
}
