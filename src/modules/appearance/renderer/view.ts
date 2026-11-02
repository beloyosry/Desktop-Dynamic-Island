import type { IslandContext } from '../../../renderer/island/context';
import type { Features } from '../../settings/domain/features';
import { THEMES, themeById } from '../domain/themes';
import { applyAppearance, motionAllowed } from './theme';
import { presentation } from '../../../shared/renderer/presentation';
import { initializeGlass } from './glass';

export function initializeAppearance({ $, bridge, island }: Pick<IslandContext, '$' | 'bridge' | 'island'>) {
  initializeGlass(island);
  const chips = $('#theme-chips');
  let features: Partial<Features> = {};
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.className = 'theme-chip';
    button.dataset.theme = theme.id;
    button.title = theme.name;
    button.setAttribute('aria-label', `${theme.name} theme`);
    button.style.background = `linear-gradient(135deg, ${theme.accent}, ${theme.secondary})`;
    button.style.color = theme.accent;
    button.addEventListener('click', () => {
      bridge.setFeatures({ themePreset: theme.id });
      presentation.playClickSound?.(1100, 0.03);
    });
    chips.append(button);
  }
  function update(next: Partial<Features>) {
    const changed = features.themePreset !== next.themePreset;
    features = next;
    applyAppearance(features);
    const theme = themeById(features.themePreset);
    $('#theme-name').textContent = theme.name;
    chips.querySelectorAll<HTMLElement>('button').forEach((button) => {
      const selected = button.dataset.theme === theme.id;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (changed && motionAllowed()) {
      island.classList.remove('theme-reveal');
      void island.offsetWidth;
      island.classList.add('theme-reveal');
    }
  }
  presentation.applyTheme = (theme) => update({ ...features, themePreset: theme });
  window.addEventListener('island:features', (event) => update(event.detail));
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => update(features));
  matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change', () => update(features));
  matchMedia('(prefers-contrast: more)').addEventListener('change', () => update(features));
  bridge.features().then(update);

  island.addEventListener('click', (event) => {
    const button = (event.target as Element).closest('button');
    if (!button || button.disabled || !motionAllowed() || features.motionPreset !== 'expressive') return;
    button.animate([{ scale: '0.94' }, { scale: '1.04', offset: 0.65 }, { scale: '1' }], {
      duration: 280,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
  });
}
