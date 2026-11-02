import { ipcRenderer } from 'electron';
import type { QuranBridge } from '../shared/contracts/bridge';
export const quran: QuranBridge = {
  catalog: (refresh) => ipcRenderer.invoke('quran-catalog', refresh),
  preferences: () => ipcRenderer.invoke('quran-preferences'),
  save: (patch) => ipcRenderer.invoke('quran-save', patch),
  stream: (reciter, moshaf, surah) => ipcRenderer.invoke('quran-stream', reciter, moshaf, surah),
  openSource: () => ipcRenderer.send('quran-source'),
};
