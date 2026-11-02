import type { Distribution, UpdateSignal, UpdateState, UpdateTransport } from './types';

export function updateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /ERR_INTERNET|ERR_NAME|ERR_NETWORK|ERR_CONNECTION|ERR_TIMED_OUT|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(
      message,
    )
  )
    return 'You appear to be offline. Check your connection and try again.';
  if (/404|latest\.yml|ERR_UPDATER_LATEST_VERSION_NOT_FOUND|ERR_UPDATER_NO_PUBLISHED_VERSIONS/i.test(message))
    return 'No update release is available yet. Try again later.';
  if (/sha512|checksum|signature/i.test(message))
    return 'The update could not be verified. Check again to download a fresh copy.';
  return 'Could not complete the update. Check your connection and try again.';
}

export function createUpdateController(options: {
  version: string;
  distribution: Distribution;
  transport: UpdateTransport;
  publish(state: UpdateState): void;
  now?: () => number;
}) {
  const now = options.now || Date.now;
  let checking = false;
  let state: UpdateState = {
    phase: options.distribution === 'installed' ? 'idle' : 'unavailable',
    distribution: options.distribution,
    currentVersion: options.version,
    availableVersion: null,
    automatic: false,
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
    lastChecked: null,
    message: '',
  };
  const snapshot = (): UpdateState => ({ ...state });
  function patch(next: Partial<UpdateState>) {
    state = { ...state, ...next };
    options.publish(snapshot());
  }
  function receive(signal: UpdateSignal) {
    if (state.distribution !== 'installed') return;
    switch (signal.type) {
      case 'available':
        patch({ phase: 'downloading', availableVersion: signal.version, percent: 0, message: '' });
        break;
      case 'progress':
        if (state.phase !== 'downloading') break;
        patch({
          percent: Number.isFinite(signal.percent) ? Math.max(0, Math.min(100, signal.percent)) : 0,
          transferred: Math.max(0, signal.transferred || 0),
          total: Math.max(0, signal.total || 0),
          bytesPerSecond: Math.max(0, signal.bytesPerSecond || 0),
        });
        break;
      case 'current':
        patch({ phase: 'current', lastChecked: now(), message: '' });
        break;
      case 'ready':
        patch({
          phase: 'ready',
          availableVersion: signal.version,
          percent: 100,
          lastChecked: now(),
          message: '',
        });
        break;
      case 'error':
        patch({ phase: 'error', message: updateError(signal.error) });
        break;
    }
  }
  return {
    snapshot,
    receive,
    setAutomatic(automatic: boolean) {
      options.transport.configure(automatic);
      patch({ automatic });
    },
    async check() {
      if (
        state.distribution !== 'installed' ||
        checking ||
        ['ready', 'installing', 'downloading'].includes(state.phase)
      )
        return snapshot();
      checking = true;
      patch({ phase: 'checking', message: '', percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });
      try {
        await options.transport.check();
      } catch (error) {
        receive({ type: 'error', error });
      } finally {
        checking = false;
      }
      return snapshot();
    },
    install() {
      if (state.phase !== 'ready') return;
      patch({ phase: 'installing' });
      try {
        options.transport.install();
      } catch (error) {
        receive({ type: 'error', error });
      }
    },
  };
}
