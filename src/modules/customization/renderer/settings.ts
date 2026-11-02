import { $, $$ } from '../../../shared/renderer/dom';
import { DEFAULTS, type Features } from '../../settings/domain/features';
import { TABS, tabOrder } from '../../settings/domain/tabs';
import { PRESETS, type Profile } from '../domain/service';
import { themeById } from '../../appearance/domain/themes';
import type { SettingsBridge } from '../../../shared/contracts/bridge';

export function initializePersonalization(api: SettingsBridge) {
  const page = $('#personalize');
  const iconUrl = new URL('app-icon.png', $<HTMLLinkElement>('link[rel="stylesheet"]').href).href;
  page.innerHTML = `
    <div class="personalize-heading"><img src="${iconUrl}" alt="" width="80" height="80"><div><h1>Your island. Your way.</h1><p class="lead">One small space. So many possibilities.</p></div></div>
    <div class="group"><h2>Choose a starting point</h2><div id="profile-presets" class="profile-presets"></div></div>
    <div class="group"><h2>Make room for your day</h2><div class="card customize-sliders">
      ${[
        ['panelWidth', 'Panel width', 600, 700, 10, 'px'],
        ['panelHeight', 'Panel height', 330, 390, 10, 'px'],
        ['cornerRadius', 'Roundness', 20, 48, 2, 'px'],
        ['glassOpacity', 'Glass opacity', 25, 95, 5, '%'],
        ['hoverDelay', 'Hover delay', 150, 1200, 10, 'ms'],
      ]
        .map(
          ([key, label, min, max, step, unit]) =>
            `<label class="row range-row"><b>${label}</b><input type="range" data-custom-range="${key}" min="${min}" max="${max}" step="${step}" aria-label="${label}"><output data-range-value="${key}" data-unit="${unit}"></output></label>`,
        )
        .join('')}
      <label class="row"><b>Custom accent</b><div class="custom-accent"><input id="custom-accent" type="color" aria-label="Custom accent color"><button class="btn" id="accent-reset">Use theme color</button></div></label>
      <label class="row"><b>Spacing</b><select id="custom-density" aria-label="Spacing"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label class="row"><b>Start on</b><select id="custom-start-tab" aria-label="Start on tab"></select></label>
      <label class="row"><div class="txt"><b>Expand on hover</b><small>When off, click the island to open it</small></div><input class="sw" type="checkbox" data-custom-toggle="hoverExpand"></label>
      <label class="row"><b>24-hour clock</b><input class="sw" type="checkbox" data-custom-toggle="clock24"></label>
      <label class="row"><b>Show seconds</b><input class="sw" type="checkbox" data-custom-toggle="clockSeconds"></label>
    </div></div>
    <div class="group"><h2>Your navigation</h2><p class="hint">Keep what you use. Move it into your own order.</p><div class="card" id="custom-tab-order"></div></div>
    <div class="group"><h2>Saved profiles</h2><p class="hint">Save your layout, colors, tabs and feature preferences. Saving the same name updates it. Up to 12 profiles.</p><div class="card"><form id="profile-form" class="row field"><input id="profile-name" maxlength="48" required placeholder="e.g. My evening setup" aria-label="Profile name"><button class="btn accent" type="submit">Save current</button></form><div id="saved-profiles"></div></div></div>
    <div class="group"><h2>Take your setup with you</h2><div class="card"><div class="row"><div class="txt"><b>Customization backup or profile pack</b><small>Export your setup before making changes</small></div></div><div class="row backup-actions"><button class="btn" id="custom-export">Export setup</button><button class="btn" id="custom-import">Import setup</button></div></div><p class="hint">Backups replace layout, profiles, bookmarks and clocks. Profile packs only add saved profiles; choose Apply to change your look. Notes and pinned apps stay in place.</p></div>
    <p id="custom-status" class="custom-status" role="status" aria-live="polite"></p>`;
  let current: Features = { ...DEFAULTS };
  const status = (message: string) => {
    $('#custom-status').textContent = message;
  };
  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      status(message);
    } catch {
      status('Could not save this change. Try again.');
    }
  };
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.className = `profile-preset preset-${preset.id}`;
    button.dataset.profile = preset.id;
    const title = document.createElement('b');
    title.textContent = preset.name;
    const detail = document.createElement('small');
    detail.textContent = preset.description;
    button.append(title, detail);
    button.addEventListener(
      'click',
      () => void run(() => api.customization.applyProfile(preset.id), `${preset.name} applied`),
    );
    $('#profile-presets').append(button);
  }
  const allModes = document.createElement('button');
  allModes.className = 'btn';
  allModes.id = 'personalize-all-modes';
  allModes.textContent = 'Explore all 16 modes & 8 mods';
  allModes.addEventListener('click', () => api.modes.openLibrary());
  $('#profile-presets').after(allModes);
  function showTabs() {
    const container = $('#custom-tab-order');
    container.replaceChildren();
    const order = tabOrder(current.tabOrder);
    const enabledCount = TABS.filter((tab) => current[tab.feature]).length;
    const select = $<HTMLSelectElement>('#custom-start-tab');
    select.replaceChildren();
    order.forEach((id, index) => {
      const tab = TABS.find((tab) => tab.id === id)!;
      const row = document.createElement('div');
      row.className = 'row tab-order-row';
      row.dataset.orderTab = id;
      const label = document.createElement('label');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = current[tab.feature];
      toggle.disabled = enabledCount === 1 && toggle.checked;
      toggle.addEventListener('change', () => api.setFeatures({ [tab.feature]: toggle.checked }));
      label.append(toggle, document.createTextNode(tab.label));
      row.append(label);
      for (const [direction, text] of [
        [-1, '↑'],
        [1, '↓'],
      ] as const) {
        const button = document.createElement('button');
        button.className = 'btn order-button';
        button.textContent = text;
        button.setAttribute('aria-label', `Move ${tab.label} ${direction === -1 ? 'up' : 'down'}`);
        button.disabled = index + direction < 0 || index + direction >= order.length;
        button.addEventListener('click', () => {
          const next = [...order];
          [next[index], next[index + direction]] = [next[index + direction], next[index]];
          api.setFeatures({ tabOrder: next.join(',') });
        });
        row.append(button);
      }
      container.append(row);
      if (current[tab.feature]) {
        const option = new Option(tab.label, id);
        select.add(option);
      }
    });
    select.value = current.defaultTab;
    if (!select.value) select.selectedIndex = 0;
  }
  function show(features: Features) {
    current = features;
    $$<HTMLInputElement>('[data-custom-range]', page).forEach((input) => {
      const key = input.dataset.customRange as keyof Features;
      input.value = String(features[key]);
      const output = $<HTMLOutputElement>(`[data-range-value="${key}"]`, page);
      output.value = `${features[key]}${output.dataset.unit}`;
    });
    $$<HTMLInputElement>('[data-custom-toggle]', page).forEach((input) => {
      input.checked = !!features[input.dataset.customToggle as keyof Features];
    });
    $<HTMLInputElement>('#custom-accent').value =
      features.customAccent || themeById(features.themePreset).accent;
    $<HTMLSelectElement>('#custom-density').value = features.visualDensity;
    showTabs();
  }
  $$<HTMLInputElement>('[data-custom-range]', page).forEach((input) => {
    input.addEventListener('input', () => {
      const output = $<HTMLOutputElement>(`[data-range-value="${input.dataset.customRange}"]`);
      output.value = `${input.value}${output.dataset.unit}`;
    });
    input.addEventListener('change', () => {
      api.setFeatures({ [input.dataset.customRange!]: Number(input.value) });
      status('Layout updated');
    });
  });
  $$<HTMLInputElement>('[data-custom-toggle]', page).forEach((input) =>
    input.addEventListener('change', () => api.setFeatures({ [input.dataset.customToggle!]: input.checked })),
  );
  $('#custom-accent').addEventListener('change', (event) =>
    api.setFeatures({ customAccent: (event.target as HTMLInputElement).value }),
  );
  $('#accent-reset').addEventListener('click', () => api.setFeatures({ customAccent: '' }));
  $('#custom-density').addEventListener('change', (event) =>
    api.setFeatures({ visualDensity: (event.target as HTMLSelectElement).value }),
  );
  $('#custom-start-tab').addEventListener('change', (event) =>
    api.setFeatures({ defaultTab: (event.target as HTMLSelectElement).value }),
  );
  function showProfiles(profiles: Profile[]) {
    const list = $('#saved-profiles');
    list.replaceChildren();
    if (!profiles.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Your favorite setups will appear here.';
      list.append(empty);
    }
    for (const profile of profiles) {
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('b');
      name.textContent = profile.name;
      const apply = document.createElement('button');
      apply.className = 'btn';
      apply.textContent = 'Apply';
      apply.setAttribute('aria-label', `Apply ${profile.name}`);
      apply.addEventListener(
        'click',
        () => void run(() => api.customization.applyProfile(profile.id), `${profile.name} applied`),
      );
      const remove = document.createElement('button');
      remove.className = 'btn';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${profile.name}`);
      remove.addEventListener(
        'click',
        () => void run(() => api.customization.removeProfile(profile.id), 'Profile deleted'),
      );
      row.append(name, apply, remove);
      list.append(row);
    }
  }
  $('#profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $<HTMLInputElement>('#profile-name');
    if (!input.value.trim()) return status('Give this profile a name.');
    void run(() => api.customization.saveProfile(input.value).then(showProfiles), 'Profile saved');
  });
  for (const action of ['export', 'import'] as const)
    $('#custom-' + action).addEventListener('click', async () => {
      const button = $<HTMLButtonElement>('#custom-' + action);
      button.disabled = true;
      try {
        const result = await api.customization.backup(action);
        if (!result.cancelled)
          status(
            result.ok
              ? `Setup ${action === 'import' ? 'imported' : 'exported'}`
              : result.error || 'Could not complete this action.',
          );
      } catch {
        status('Could not open the file dialog. Try again.');
      } finally {
        button.disabled = false;
      }
    });
  api.onFeatures(show);
  api.customization.onProfiles(showProfiles);
  void api.features().then(show);
  void api.customization.profiles().then(showProfiles);
}
