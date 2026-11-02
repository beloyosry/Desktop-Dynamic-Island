import { ipcMain } from 'electron';
import * as store from '../../../platform/storage/json-store';
import * as features from '../../settings/main/features';
import type { EventSender } from '../../../shared/contracts/events';
import { createModeService } from '../domain/service';

export function registerModes(sender: EventSender, openSettings: (page?: string) => void) {
  const service = createModeService(store, features);
  const publish = () => {
    const value = service.get();
    sender('modes-state', value);
    return value;
  };
  features.onChange(publish);
  ipcMain.handle('modes-get', () => service.get());
  ipcMain.handle('modes-apply', (_event, id: unknown) => {
    service.apply(id);
    return publish();
  });
  ipcMain.handle('modes-mod', (_event, id: unknown, enabled: unknown) => {
    service.setMod(id, enabled);
    return publish();
  });
  ipcMain.handle('modes-favorite', (_event, id: unknown, enabled: unknown) => {
    service.favorite(id, enabled);
    return publish();
  });
  ipcMain.handle('modes-restore', () => {
    service.restore();
    return publish();
  });
  ipcMain.on('modes-open', () => openSettings('modes'));
  return { ...service, publish };
}
