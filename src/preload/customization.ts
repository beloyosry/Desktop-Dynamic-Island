import { ipcRenderer } from 'electron';
import type { CustomizationBridge, ToolkitBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
export const customization: CustomizationBridge = {
  profiles: () => ipcRenderer.invoke('profiles-get'),
  saveProfile: (name) => ipcRenderer.invoke('profiles-save', name),
  removeProfile: (id) => ipcRenderer.invoke('profiles-remove', id),
  applyProfile: (id) => ipcRenderer.invoke('profiles-apply', id),
  onProfiles: subscribe('profiles'),
  backup: (action) => ipcRenderer.invoke('customization-backup', action),
  openSettings: () => ipcRenderer.send('personalize-open'),
};
export const toolkit: ToolkitBridge = {
  get: () => ipcRenderer.invoke('toolkit-get'),
  save: (state) => ipcRenderer.invoke('toolkit-save', state),
  onChange: subscribe('toolkit'),
  openBookmark: (id) => ipcRenderer.invoke('bookmark-open', id),
  copy: (text, sensitive) => ipcRenderer.invoke('toolkit-copy', text, sensitive),
};
