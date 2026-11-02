import { ipcRenderer } from 'electron';
import type { ModesBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
export const modes: ModesBridge = {
  get: () => ipcRenderer.invoke('modes-get'),
  apply: (id) => ipcRenderer.invoke('modes-apply', id),
  setMod: (id, enabled) => ipcRenderer.invoke('modes-mod', id, enabled),
  favorite: (id, enabled) => ipcRenderer.invoke('modes-favorite', id, enabled),
  restore: () => ipcRenderer.invoke('modes-restore'),
  onChange: subscribe('modes-state'),
  openLibrary: () => ipcRenderer.send('modes-open'),
};
