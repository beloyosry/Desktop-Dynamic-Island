import type { SettingsBridge } from '../../../shared/contracts/bridge';
import type { ResourceSnapshot } from '../domain/boost';
export function initializePerformanceSettings(api: SettingsBridge) {
  const root = document.querySelector<HTMLElement>('#performance')!;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(id)!;
  const status = $<HTMLElement>('#perf-status');
  let busy = false;
  const size = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MiB`;
  function draw(s: ResourceSnapshot) {
    $('#perf-memory').textContent = size(s.workingSetBytes);
    $('#perf-cache').textContent = size(s.cacheBytes);
    $('#perf-free').textContent =
      `${(s.systemFreeBytes / 1073741824).toFixed(1)} / ${(s.systemTotalBytes / 1073741824).toFixed(1)} GiB`;
    $('#perf-sampled').textContent =
      `${s.processCount} app processes · Updated ${new Date(s.sampledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  function lock(value: boolean) {
    busy = value;
    root
      .querySelectorAll<HTMLButtonElement>('[data-clean],#perf-refresh')
      .forEach((b) => (b.disabled = value));
  }
  async function refresh() {
    if (busy) return;
    lock(true);
    try {
      draw(await api.performance.snapshot());
    } catch {
      status.textContent = 'Could not read resource usage. Try Refresh.';
    } finally {
      lock(false);
    }
  }
  $('#perf-refresh').addEventListener('click', () => void refresh());
  root.querySelectorAll<HTMLButtonElement>('[data-clean]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (busy) return;
      lock(true);
      status.textContent = 'Releasing temporary resources…';
      try {
        const result = await api.performance.clean(button.dataset.clean === 'cache' ? 'cache' : 'memory');
        draw(result.after);
        status.textContent = result.ok
          ? result.action === 'cache'
            ? `${size(Math.max(0, result.before.cacheBytes - result.after.cacheBytes))} browser cache removed. The reciter catalog will refresh on next use.`
            : `Unused resources released. App working set: ${size(result.after.workingSetBytes)} (before: ${size(result.before.workingSetBytes)}).`
          : result.error || 'Cleanup could not finish. Try again.';
      } catch {
        status.textContent = 'Cleanup could not finish. Try again.';
      } finally {
        lock(false);
      }
    }),
  );
  function showBoost(enabled: boolean) {
    root.dataset.boost = String(enabled);
    $('#perf-boost-state').textContent = enabled ? 'Boost is on' : 'Room to breathe';
  }
  api.onFeatures((f) => showBoost(f.boostMode));
  void api.features().then((f) => showBoost(f.boostMode));
  document.querySelector('[data-page="performance"]')?.addEventListener('click', () => void refresh());
  api.onPage((page) => {
    if (page === 'performance') void refresh();
  });
  if (root.classList.contains('on')) void refresh();
}
