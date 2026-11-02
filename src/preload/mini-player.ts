import type { MiniBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
import { contextBridge, ipcRenderer } from 'electron';

const api: MiniBridge = {
  onHover: subscribe('mini-hover'),
  time: (t) => ipcRenderer.send('mini-time', t),
  close: (time, resume) => ipcRenderer.send('mini-close', { time, resume }),
  resizeStart: (corner) => ipcRenderer.send('mini-resize-start', corner),
  resizeEnd: () => ipcRenderer.send('mini-resize-end'),
};
contextBridge.exposeInMainWorld('mini', api);
