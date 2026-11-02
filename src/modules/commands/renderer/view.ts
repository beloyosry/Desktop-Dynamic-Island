import type { IslandContext } from '../../../renderer/island/context';
import { THEMES } from '../../appearance/domain/themes';
import { searchActions, type SearchableAction } from '../domain/search';
import { TOOL_VIEWS } from '../../toolkit/renderer/view';
import { MODES, MODIFIERS } from '../../modes/domain/catalog';
import type { ModeState } from '../../modes/domain/service';
import { presentation } from '../../../shared/renderer/presentation';
interface Action extends SearchableAction {
  run(): void;
}

export function initializeCommands({
  $,
  $$,
  bridge,
  state,
  selectTab,
  render,
}: Pick<IslandContext, '$' | '$$' | 'bridge' | 'state' | 'selectTab' | 'render'>) {
  const panel = $('#command-panel');
  const input = $<HTMLInputElement>('#command-query');
  const results = $('#command-results');
  let selected = 0;
  let matches: Action[] = [];
  let previousFocus: HTMLElement | null = null;
  let wasPinned = false;
  let modes: ModeState | undefined;
  bridge.modes.onChange((value) => {
    modes = value;
  });
  void bridge.modes
    .get()
    .then((value) => {
      modes = value;
    })
    .catch(() => {});
  const siblings = [...$$('.l-expanded > :not(#command-panel)')];

  function actions(): Action[] {
    const tabs = [...$$<HTMLButtonElement>('.tab:not([hidden])')].map((tab) => ({
      id: `tab-${tab.dataset.tab}`,
      label: `Open ${tab.textContent.trim()}`,
      detail: 'Go to tab',
      run: () => selectTab(tab.dataset.tab!),
    }));
    return [
      {
        id: 'performance',
        label: 'Open Performance',
        detail: 'App RAM, cache cleanup and Boost mode',
        run: () => bridge.performance.open(),
      },
      {
        id: 'boost',
        label: `${state.features.boostMode ? 'Disable' : 'Enable'} Boost mode`,
        detail: 'Reduce effects and desktop capture without replacing your preferences',
        run: () => bridge.setFeatures({ boostMode: !state.features.boostMode }),
      },
      {
        id: 'quran-player',
        label: 'Open Quran player',
        detail: 'القرآن الكريم · Reciters, surahs and favorites',
        run: () => {
          if (!state.features.tabQuran) bridge.setFeatures({ tabQuran: true });
          selectTab('quran');
        },
      },
      ...(state.features.notificationTray !== false
        ? [
            {
              id: 'notifications',
              label: 'Open notifications',
              detail: 'Recent island alerts and unread messages',
              run: () => presentation.openNotifications?.(),
            },
          ]
        : []),
      ...tabs,
      ...TOOL_VIEWS.map(([id, label]) => ({
        id: `toolkit-${id}`,
        label: `Open ${label}`,
        detail: 'Toolkit',
        keywords:
          id === 'generator'
            ? 'password uuid random'
            : id === 'converter'
              ? 'units temperature length weight'
              : id === 'text'
                ? 'base64 uppercase lowercase encode decode'
                : '',
        run: () => {
          if (!state.features.tabToolkit) bridge.setFeatures({ tabToolkit: true });
          selectTab('toolkit');
          window.dispatchEvent(new CustomEvent('island:tool', { detail: id }));
        },
      })),
      ...MODES.map((profile) => ({
        id: `profile-${profile.id}`,
        label: `${profile.name} mode`,
        detail: profile.description,
        run: () => {
          void bridge.modes.apply(profile.id).catch(() => {});
        },
      })),
      ...MODIFIERS.map((mod) => ({
        id: `mod-${mod.id}`,
        label: `${modes?.mods.includes(mod.id) ? 'Disable' : 'Enable'} ${mod.name}`,
        detail: mod.description,
        keywords: 'mod modifier',
        run: () => {
          void bridge.modes.setMod(mod.id, !modes?.mods.includes(mod.id)).catch(() => {});
        },
      })),
      {
        id: 'mode-library',
        label: 'Open Modes & Mods',
        detail: '16 modes, favorites and mix-in mods',
        run: () => bridge.modes.openLibrary(),
      },
      ...(modes?.canRestore
        ? [
            {
              id: 'mode-restore',
              label: 'Return to my setup',
              detail: 'Remove active mode and mods',
              run: () => {
                void bridge.modes.restore().catch(() => {});
              },
            },
          ]
        : []),
      {
        id: 'personalize',
        label: 'Personalize your island',
        detail: 'Layout, navigation, profiles and backup',
        run: () => bridge.customization.openSettings(),
      },
      {
        id: 'focus',
        label: 'Start focus session',
        detail: `${state.features.focusMin || 25} minutes of deep work`,
        keywords: 'pomodoro timer',
        run: () => {
          if (!state.features.tabTimer) bridge.setFeatures({ tabTimer: true });
          selectTab('timer');
          $('#tm-mode-timer').click();
          $('#tm-focus').click();
        },
      },
      {
        id: 'snip',
        label: 'Take a screenshot',
        detail: 'Open Windows snipping tool',
        run: () => {
          void bridge.tools.snip();
        },
      },
      { id: 'mute', label: 'Toggle mute', detail: 'System audio', run: () => bridge.mediaCmd('mute') },
      {
        id: 'settings',
        label: 'Open settings',
        detail: 'Personalize your island',
        run: () => bridge.openSettings(),
      },
      {
        id: 'updates',
        label: 'Check for updates',
        detail: 'Open update center',
        run: () => bridge.updates.openCenter(),
      },
      ...THEMES.map((theme) => ({
        id: `theme-${theme.id}`,
        label: `${theme.name} theme`,
        detail: theme.description,
        keywords: 'color appearance',
        run: () => bridge.setFeatures({ themePreset: theme.id }),
      })),
    ];
  }
  function highlight() {
    results.querySelectorAll<HTMLElement>('[role="option"]').forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === selected));
      if (index === selected) {
        input.setAttribute('aria-activedescendant', button.id);
        button.scrollIntoView({ block: 'nearest' });
      }
    });
    if (!matches.length) input.removeAttribute('aria-activedescendant');
  }
  function draw() {
    matches = searchActions(actions(), input.value);
    selected = 0;
    results.replaceChildren();
    for (const [index, action] of matches.entries()) {
      const button = document.createElement('button');
      button.id = `command-${action.id}`;
      button.role = 'option';
      button.tabIndex = -1;
      const label = document.createElement('b');
      label.textContent = action.label;
      const detail = document.createElement('span');
      detail.textContent = action.detail;
      button.append(label, detail);
      button.addEventListener('click', () => run(action));
      button.addEventListener('pointermove', () => {
        selected = index;
        highlight();
      });
      results.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'command-empty';
      empty.textContent = 'No actions found. Try “timer”, “notes”, or “theme”.';
      results.append(empty);
    }
    highlight();
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    if (state.overlay === 'commands') state.overlay = null;
    siblings.forEach((element) => {
      element.inert = false;
    });
    state.pinned = wasPinned;
    previousFocus?.focus({ preventScroll: true });
    bridge.focusInput(false);
    render();
  }
  function run(action: Action) {
    close();
    action.run();
  }
  function open() {
    if (!panel.hidden) {
      close();
      return;
    }
    window.dispatchEvent(new CustomEvent('island:overlay-open', { detail: 'commands' }));
    previousFocus = document.activeElement as HTMLElement | null;
    wasPinned = state.pinned;
    state.pinned = true;
    state.overlay = 'commands';
    render();
    panel.hidden = false;
    siblings.forEach((element) => {
      element.inert = true;
    });
    input.value = '';
    draw();
    bridge.focusInput(true);
    input.focus();
  }
  $('#open-commands').addEventListener('click', open);
  window.addEventListener('island:overlay-open', (event) => {
    if (event.detail !== 'commands') close();
  });
  window.addEventListener('island:overlay-close', close);
  window.addEventListener('island:visibility', (event) => {
    if (!event.detail) close();
  });
  $('#command-close').addEventListener('click', close);
  input.addEventListener('input', draw);
  window.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
        return;
      }
      if (panel.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (matches.length)
          selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        highlight();
      } else if (event.key === 'Enter' && document.activeElement === input) {
        event.preventDefault();
        if (matches[selected]) run(matches[selected]);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === input ? $('#command-close') : input).focus();
      }
    },
    true,
  );
}
