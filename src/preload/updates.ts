import { ipcRenderer } from 'electron';
import type { UpdatesBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
export const updates: UpdatesBridge = {
  status: () => ipcRenderer.invoke('update-status'),
  check: () => ipcRenderer.invoke('update-check'),
  install: () => ipcRenderer.send('update-install'),
  openReleases: () => ipcRenderer.send('update-releases'),
  openCenter: () => ipcRenderer.send('update-center'),
  onState: subscribe('update-state'),
};
