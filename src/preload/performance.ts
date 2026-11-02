import { ipcRenderer, webFrame } from 'electron';
import type { PerformanceBridge } from '../shared/contracts/bridge';
import { subscribe } from './subscribe';
// Only an explicit memory-release operation clears Blink's disposable resource cache.
ipcRenderer.on('memory-release', () => {
  webFrame.clearCache();
});
export const performance: PerformanceBridge = {
  snapshot: () => ipcRenderer.invoke('performance-snapshot'),
  clean: (action) => ipcRenderer.invoke('performance-clean', action),
  open: () => ipcRenderer.send('performance-open'),
  onRelease: subscribe('memory-release'),
};
