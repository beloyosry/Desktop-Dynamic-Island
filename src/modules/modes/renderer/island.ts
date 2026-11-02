import type { IslandContext } from '../../../renderer/island/context';
import { MODES, modeById } from '../domain/catalog';
import type { ModeState } from '../domain/service';

export function initializeModePicker(
  { $, bridge, selectTab }: Pick<IslandContext, '$' | 'bridge' | 'selectTab'>,
  selectTool: (id: string) => void,
) {
  let activation = -1;
  const status = (text: string) => {
    $('#tk-status').textContent = text;
  };
  async function run(action: () => Promise<ModeState>) {
    try {
      show(await action());
    } catch {
      status('Could not change mode. Try again.');
    }
  }
  function show(state: ModeState) {
    const mode = modeById(state.activeId);
    $('#tk-mode-state').textContent =
      `${mode?.name || 'Personal setup'}${state.customized ? ' · Customized' : ''}${state.mods.length ? ` · ${state.mods.length} mods` : ''}`;
    $<HTMLButtonElement>('#tk-mode-restore').disabled = !state.canRestore;
    const list = $('#tk-presets');
    list.replaceChildren();
    const favorites = MODES.filter((item) => state.favorites.includes(item.id));
    for (const item of (favorites.length ? favorites : MODES).slice(0, 6)) {
      const button = document.createElement('button');
      button.className = 'tk-preset';
      button.dataset.quickMode = item.id;
      button.style.setProperty('--mode-color', item.accent);
      button.setAttribute('aria-pressed', String(item.id === state.activeId));
      const title = document.createElement('b');
      title.textContent = `${item.symbol} ${item.name}`;
      const detail = document.createElement('small');
      detail.textContent = item.highlights[0];
      button.append(title, detail);
      button.addEventListener('click', () => void run(() => bridge.modes.apply(item.id)));
      list.append(button);
    }
    if (activation !== state.activation) {
      activation = state.activation;
      if (mode) {
        selectTab(mode.features.defaultTab!);
        if (mode.tool) selectTool(mode.tool);
      }
    }
  }
  $('#tk-mode-library').addEventListener('click', () => bridge.modes.openLibrary());
  $('#tk-mode-restore').addEventListener('click', () => void run(() => bridge.modes.restore()));
  $('#open-modes').addEventListener('click', () => bridge.modes.openLibrary());
  bridge.modes.onChange(show);
  void bridge.modes
    .get()
    .then(show)
    .catch(() => status('Could not load modes.'));
}
