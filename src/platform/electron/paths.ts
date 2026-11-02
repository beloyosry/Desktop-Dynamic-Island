import { app } from 'electron';
import path from 'node:path';

/** Paths are relative to the application, never a module's source/build directory. */
export const appPath = (...parts: string[]) => path.join(app.getAppPath(), ...parts);
export const rendererPath = (page: 'island' | 'settings' | 'mini-player', file = 'index.html') =>
  appPath('out', 'renderer', page, file);
export const preloadPath = (page: 'island' | 'settings' | 'mini-player') =>
  appPath('out', 'preload', `${page}.js`);
export const helperPath = () => appPath('helper', 'nova-helper.exe').replace('app.asar', 'app.asar.unpacked');
