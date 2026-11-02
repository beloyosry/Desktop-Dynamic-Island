import { ipcMain } from 'electron';
import * as store from '../../../platform/storage/json-store';
import * as features from '../../settings/main/features';
import type { EventSender } from '../../../shared/contracts/events';
import { createNotificationHistory } from '../domain/history';

export function registerNotificationHistory(sender: EventSender) {
  const history = createNotificationHistory(store);
  const publish = (arrivalId?: string) => {
    const snapshot = history.get();
    sender('notifications', { ...snapshot, ...(arrivalId ? { arrivalId } : {}) });
    return snapshot;
  };
  ipcMain.handle('notifications-get', () => history.get());
  ipcMain.handle('notifications-record', (_event, input: unknown) => {
    const id = history.add(input, features.get());
    return id ? publish(id) : history.get();
  });
  ipcMain.handle('notifications-read', (_event, id: unknown) => {
    history.read(id);
    return publish();
  });
  ipcMain.handle('notifications-read-all', () => {
    history.readAll();
    return publish();
  });
  ipcMain.handle('notifications-dismiss', (_event, id: unknown) => {
    history.dismiss(id);
    return publish();
  });
  ipcMain.handle('notifications-clear', () => {
    history.clear();
    return publish();
  });
}
