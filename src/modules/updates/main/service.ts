import { app, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { EventSender } from '../../../shared/contracts/events';
import { createUpdateController } from '../domain/controller';
import * as log from '../../../platform/logging/logger';

const FIRST_CHECK_MS = 60_000;
const EVERY_MS = 6 * 60 * 60_000;
const RELEASES = 'https://github.com/beloyosry/Desktop-Dynamic-Island/releases/latest';
let updater: import('electron-updater').AppUpdater | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let send: EventSender = () => {};
let scheduleGeneration = 0;
let lastReady: string | null = null;
const distribution = !app.isPackaged
  ? 'development'
  : process.env.PORTABLE_EXECUTABLE_FILE || !existsSync(path.join(process.resourcesPath, 'app-update.yml'))
    ? 'portable'
    : 'installed';
const controller = createUpdateController({
  version: app.getVersion(),
  distribution,
  publish(state) {
    send('update-state', state);
    if (state.phase === 'ready' && state.availableVersion && state.availableVersion !== lastReady) {
      lastReady = state.availableVersion;
      send('update', { version: state.availableVersion });
    }
  },
  transport: {
    async check() {
      if (!updater) throw new Error('Updater not initialized');
      const result = await updater.checkForUpdates();
      if (!result) throw new Error('Updater is not active');
      // The discovery promise alone does not report download failures.
      await result.downloadPromise;
    },
    configure(automatic) {
      if (updater) updater.autoInstallOnAppQuit = automatic;
    },
    install() {
      updater?.quitAndInstall(true, true);
    },
  },
});

export function start(sendFn: EventSender, automatic: boolean) {
  send = sendFn;
  if (distribution === 'installed' && !updater) {
    updater = (require('electron-updater') as typeof import('electron-updater')).autoUpdater;
    updater.autoDownload = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.logger = null;
    updater.on('update-available', ({ version }) => controller.receive({ type: 'available', version }));
    updater.on('update-not-available', () => controller.receive({ type: 'current' }));
    updater.on('download-progress', (progress) => controller.receive({ type: 'progress', ...progress }));
    updater.on('update-downloaded', ({ version }) => {
      log.info(`update ${version} ready`);
      controller.receive({ type: 'ready', version });
    });
    updater.on('error', (error) => controller.receive({ type: 'error', error }));
  }
  setEnabled(automatic);
}
export function setEnabled(automatic: boolean) {
  const generation = ++scheduleGeneration;
  controller.setAutomatic(automatic);
  clearTimeout(timer);
  clearTimeout(retry);
  if (!automatic || !updater) return;
  const schedule = (delay: number) => {
    timer = setTimeout(async () => {
      await controller.check();
      if (generation === scheduleGeneration && controller.snapshot().automatic) schedule(EVERY_MS);
    }, delay);
  };
  schedule(FIRST_CHECK_MS);
}
export function retrySoon() {
  if (!controller.snapshot().automatic || controller.snapshot().phase !== 'error') return;
  clearTimeout(retry);
  retry = setTimeout(() => {
    void controller.check();
  }, FIRST_CHECK_MS);
}
export const snapshot = controller.snapshot;
export const check = controller.check;
export const install = controller.install;
export function openReleases() {
  void shell.openExternal(RELEASES);
}
export function stop() {
  scheduleGeneration++;
  clearTimeout(timer);
  clearTimeout(retry);
}
