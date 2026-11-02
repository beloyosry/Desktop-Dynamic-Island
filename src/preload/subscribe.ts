import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Events, Subscribe } from '../shared/contracts/events';

export function subscribe<K extends keyof Events>(channel: K): Subscribe<Events[K]> {
  return (callback) => {
    const listener = (_event: IpcRendererEvent, data: Events[K]) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
}
