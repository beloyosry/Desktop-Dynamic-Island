import { THEMES } from '../domain/themes';
import type { SettingsBridge } from '../../../shared/contracts/bridge';
import type { Features } from '../../settings/domain/features';
import { $, $$ } from '../../../shared/renderer/dom';
import { applyAppearance } from './theme';
import { initializeGlass } from './glass';

export function initializeAppearanceSettings(api: SettingsBridge) {
  initializeGlass(document.body);
  const grid = $('#appearance-themes');
  let current: Partial<Features> = {};
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.className = 'theme-option';
    button.dataset.preset = theme.id;
    const sample = document.createElement('span');
    sample.className = 'theme-sample';
    sample.style.background = `linear-gradient(125deg, ${theme.base} 25%, ${theme.accent} 160%)`;
    sample.style.setProperty('--sample-accent', theme.accent);
    sample.innerHTML = '<i></i><i></i><i></i>';
    const name = document.createElement('b');
    name.textContent = theme.name;
    const description = document.createElement('small');
    description.textContent = theme.description;
    button.append(sample, name, description);
    button.addEventListener('click', () => api.setFeatures({ themePreset: theme.id }));
    grid.append(button);
  }
  $$<HTMLButtonElement>('[data-motion-preset]').forEach((button) =>
    button.addEventListener('click', () => api.setFeatures({ motionPreset: button.dataset.motionPreset })),
  );
  function show(features: Features) {
    current = features;
    applyAppearance(features);
    $$('[data-preset]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.preset === features.themePreset)),
    );
    $$('[data-motion-preset]').forEach((button) =>
      button.setAttribute('aria-checked', String(button.dataset.motionPreset === features.motionPreset)),
    );
    $('#appearance-preview-name').textContent =
      THEMES.find((theme) => theme.id === features.themePreset)?.name || 'Midnight';
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyAppearance(current));
  matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change', () =>
    applyAppearance(current),
  );
  matchMedia('(prefers-contrast: more)').addEventListener('change', () => applyAppearance(current));
  api.onFeatures(show);
  void api.features().then(show);
}
