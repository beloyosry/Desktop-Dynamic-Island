import type { UpdatesBridge } from '../../../shared/contracts/bridge';
import type { UpdateState } from '../domain/types';
import { $ } from '../../../shared/renderer/dom';

export function initializeUpdateSettings(api: UpdatesBridge) {
  const check = $<HTMLButtonElement>('#update-check');
  const install = $<HTMLButtonElement>('#update-restart');
  const releases = $<HTMLButtonElement>('#update-releases');
  const progress = $<HTMLProgressElement>('#update-progress');
  function show(state: UpdateState) {
    const busy = ['checking', 'downloading', 'installing'].includes(state.phase);
    $('#update-card').dataset.phase = state.phase;
    $('#update-version').textContent = `Version ${state.currentVersion}`;
    const titles: Record<UpdateState['phase'], string> = {
      idle: 'Ready for what’s next',
      checking: 'Looking for updates…',
      current: 'You’re up to date',
      downloading: `Downloading ${state.availableVersion || 'update'}`,
      ready: `${state.availableVersion} is ready`,
      installing: 'Restarting your island…',
      error: 'Update interrupted',
      unavailable: state.distribution === 'portable' ? 'Make updates effortless' : 'Development build',
    };
    const descriptions: Record<UpdateState['phase'], string> = {
      idle: 'Check for the latest improvements to your island.',
      checking: 'Checking the latest published release.',
      current: 'You have the latest published version. Enjoy your island.',
      downloading: `${Math.round(state.percent)}% · ${(state.transferred / 1048576).toFixed(1)} of ${(state.total / 1048576).toFixed(1)} MB${state.bytesPerSecond ? ` · ${(state.bytesPerSecond / 1048576).toFixed(1)} MB/s` : ''}`,
      ready: state.automatic
        ? 'Restart now, or the update will install when you quit the app.'
        : 'Restart when you’re ready to install the update.',
      installing: 'The app will reopen automatically. Your settings stay with you.',
      error: state.message,
      unavailable:
        state.distribution === 'portable'
          ? 'Install the setup version once to get future updates here. Your notes and settings will carry over.'
          : 'Automatic updates are available in the installed Windows app.',
    };
    $('#update-title').textContent = titles[state.phase];
    $('#update-description').textContent = descriptions[state.phase];
    $('#update-checked').textContent = state.lastChecked
      ? `Last checked ${new Date(state.lastChecked).toLocaleString()}`
      : 'Stable release channel';
    progress.hidden = state.phase !== 'downloading';
    progress.value = state.percent;
    check.hidden = state.phase === 'unavailable';
    check.disabled = busy || state.phase === 'ready';
    check.textContent =
      state.phase === 'error' ? 'Try again' : state.phase === 'checking' ? 'Checking…' : 'Check for updates';
    install.hidden = state.phase !== 'ready' && state.phase !== 'installing';
    install.disabled = state.phase === 'installing';
    releases.textContent = state.distribution === 'portable' ? 'Get the installer' : 'Release notes';
  }
  check.addEventListener('click', async () => {
    check.disabled = true;
    try {
      show(await api.check());
    } catch {
      $('#update-description').textContent = 'Could not reach the update service. Try again.';
      check.disabled = false;
    }
  });
  install.addEventListener('click', () => api.install());
  releases.addEventListener('click', () => api.openReleases());
  api.onState(show);
  void api.status().then(show);
}
