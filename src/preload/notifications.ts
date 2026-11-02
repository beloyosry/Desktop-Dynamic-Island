import { ipcRenderer } from 'electron';
import type { NotificationsBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
export const notifications: NotificationsBridge = {
  get: () => ipcRenderer.invoke('notifications-get'),
  record: (input) => ipcRenderer.invoke('notifications-record', input),
  read: (id) => ipcRenderer.invoke('notifications-read', id),
  readAll: () => ipcRenderer.invoke('notifications-read-all'),
  dismiss: (id) => ipcRenderer.invoke('notifications-dismiss', id),
  clear: () => ipcRenderer.invoke('notifications-clear'),
  onChange: subscribe('notifications'),
};
