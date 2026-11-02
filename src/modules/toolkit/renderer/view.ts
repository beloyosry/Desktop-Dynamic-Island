import type { IslandContext } from '../../../renderer/island/context';
import type { ToolkitState } from '../domain/types';
import { safeWebUrl, validZone } from '../domain/service';
import { calc } from '../../clipboard/domain/classify';
import {
  convertUnit,
  UNIT_GROUPS,
  TEXT_ACTIONS,
  transformText,
  generatePassword,
  type UnitGroup,
} from '../domain/utilities';
import type { Profile } from '../../customization/domain/service';
import { initializeModePicker } from '../../modes/renderer/island';

export const TOOL_VIEWS = [
  ['shortcuts', 'Shortcuts', '↗'],
  ['calculator', 'Calculator', '±'],
  ['converter', 'Converter', '⇄'],
  ['text', 'Text studio', 'Aa'],
  ['generator', 'Generator', '✦'],
  ['clocks', 'World clocks', '◷'],
  ['profiles', 'Modes', '◈'],
] as const;
type Context = Pick<IslandContext, '$' | 'bridge' | 'state' | 'lastMode' | 'selectTab'>;
export function initializeToolkit(context: Context) {
  const { $, bridge, state } = context;
  const root = $('#v-toolkit');
  const iconUrl = new URL('app-icon.png', $<HTMLLinkElement>('link[rel="stylesheet"]').href).href;
  root.innerHTML = `<div class="toolkit-shell">
    <aside class="toolkit-nav" aria-label="Toolkit categories"><div class="toolkit-brand"><img src="${iconUrl}" width="32" height="32" alt=""><b>Toolkit</b></div>
      ${TOOL_VIEWS.map(([id, label, icon]) => `<button data-tool-view="${id}" aria-pressed="false"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}
      <button id="tk-personalize" class="toolkit-personalize">Personalize ↗</button>
    </aside><div class="toolkit-main">
      <section data-tool-panel="shortcuts"><div class="tk-heading"><h2>Your shortcuts</h2><small>Favorite places, one click away.</small></div><div id="tk-bookmarks" class="tk-bookmarks"></div><form id="tk-link-form" class="tk-form tk-link-form"><input id="tk-link-name" maxlength="48" required placeholder="Name" aria-label="Shortcut name"><input id="tk-link-url" type="url" maxlength="2048" required placeholder="https://example.com" aria-label="Shortcut URL"><button class="tk-button primary" type="submit">Add</button></form></section>
      <section data-tool-panel="calculator" hidden><div class="tk-heading"><h2>A little number magic.</h2><small>Arithmetic, powers, percentages and parentheses.</small></div><form id="tk-calc-form" class="tk-form"><input id="tk-expression" maxlength="256" required placeholder="(128 + 64) × 1.5" aria-label="Calculation"><button class="tk-button primary">Calculate</button></form><div class="tk-result"><output id="tk-calc-result" aria-live="polite">0</output><button class="tk-button" id="tk-copy-calc">Copy</button></div><div id="tk-calc-history" class="tk-history" aria-label="Recent calculations"></div></section>
      <section data-tool-panel="converter" hidden><div class="tk-heading"><h2>From this to that.</h2><small>Eight categories. No tabs to open.</small></div><label class="tk-label">Category<select id="tk-unit-group"></select></label><div class="tk-form tk-units"><label class="tk-label">Value<input id="tk-unit-value" type="number" value="1" step="any"></label><label class="tk-label">From<select id="tk-unit-from"></select></label><label class="tk-label">To<select id="tk-unit-to"></select></label></div><div class="tk-result"><output id="tk-unit-result" aria-live="polite"></output><button class="tk-button" id="tk-copy-unit">Copy</button></div></section>
      <section data-tool-panel="text" hidden><div class="tk-heading"><h2>Make words work.</h2><small id="tk-text-count">0 words · 0 characters</small></div><textarea id="tk-text" maxlength="200000" placeholder="Paste text here…" aria-label="Text to transform" spellcheck="false"></textarea><div class="tk-form"><select id="tk-text-action" aria-label="Text action"></select><button id="tk-text-run" class="tk-button primary">Transform</button><button id="tk-text-copy" class="tk-button">Copy</button><button id="tk-text-undo" class="tk-button" disabled>Undo</button></div></section>
      <section data-tool-panel="generator" hidden><div class="tk-heading"><h2>Something entirely new.</h2><small>Generate a password or a unique identifier locally.</small></div><label class="tk-generator-length">Length <input id="tk-password-length" aria-label="Password length" type="range" min="12" max="64" value="20"><output id="tk-length">20</output></label><label class="tk-check"><input type="checkbox" id="tk-symbols" checked> Include symbols</label><div class="tk-form"><button class="tk-button primary" id="tk-password">New password</button><button class="tk-button" id="tk-uuid">New UUID</button></div><div class="tk-result tk-secret"><output id="tk-secret" aria-live="polite">Ready when you are.</output><button class="tk-button" id="tk-copy-secret" disabled>Copy</button></div><small class="tk-note">Passwords are not saved. The Copy button excludes them from clipboard history.</small></section>
      <section data-tool-panel="clocks" hidden><div class="tk-heading"><h2>Here. There. Everywhere.</h2><small>Keep your people in time. Up to eight clocks.</small></div><div id="tk-clocks" class="tk-clocks"></div><form id="tk-clock-form" class="tk-form"><input id="tk-clock-name" maxlength="32" placeholder="City label" aria-label="Clock name"><input id="tk-clock-zone" list="tk-zones" maxlength="80" required placeholder="Time zone" aria-label="Time zone"><datalist id="tk-zones">${['Africa/Cairo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'].map((zone) => `<option value="${zone}"></option>`).join('')}</datalist><button class="tk-button primary">Add</button></form></section>
      <section data-tool-panel="profiles" hidden><div class="tk-heading"><h2>Change your rhythm.</h2><small id="tk-mode-state">Your favorite modes, one click away.</small></div><div class="tk-form"><button id="tk-mode-library" class="tk-button primary">All modes &amp; mods</button><button id="tk-mode-restore" class="tk-button" disabled>Restore setup</button></div><div id="tk-presets" class="tk-presets"></div><div id="tk-profiles" class="tk-profile-list"></div><button id="tk-manage-profiles" class="tk-button">Save and manage profiles ↗</button></section>
      <p id="tk-status" class="tk-status" role="status" aria-live="polite"></p>
    </div></div>`;
  let data: ToolkitState = { bookmarks: [], clocks: [] };
  let currentView = 'shortcuts';
  let clockTimer: ReturnType<typeof setTimeout> | undefined;
  const clockFormats = new Map<string, Intl.DateTimeFormat>();
  const message = (text: string) => {
    $('#tk-status').textContent = text;
  };
  async function copy(text: string, sensitive = false) {
    try {
      const result = await bridge.toolkit.copy(text, sensitive);
      message(result.ok ? 'Copied' : result.error || 'Could not copy.');
    } catch {
      message('Could not copy. Try again.');
    }
  }
  function selectView(id: string) {
    if (!TOOL_VIEWS.some(([key]) => key === id)) return;
    currentView = id;
    message('');
    root.querySelectorAll<HTMLElement>('[data-tool-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.toolPanel !== id;
    });
    root
      .querySelectorAll<HTMLElement>('[data-tool-view]')
      .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.toolView === id)));
    syncClocks();
  }
  root
    .querySelectorAll<HTMLButtonElement>('[data-tool-view]')
    .forEach((button) => button.addEventListener('click', () => selectView(button.dataset.toolView!)));
  for (const id of ['#tk-personalize', '#tk-manage-profiles'])
    $(id).addEventListener('click', () => bridge.customization.openSettings());
  window.addEventListener('island:tool', (event) => {
    context.selectTab('toolkit');
    selectView(event.detail);
  });
  async function save(next: ToolkitState) {
    try {
      showData(await bridge.toolkit.save(next));
      message('Saved');
    } catch {
      message('Could not save. Try again.');
    }
  }
  function showData(next: ToolkitState) {
    data = next;
    clockFormats.clear();
    renderBookmarks();
    renderClocks();
    syncClocks();
  }
  function renderBookmarks() {
    const list = $('#tk-bookmarks');
    list.replaceChildren();
    if (!data.bookmarks.length) {
      const empty = document.createElement('p');
      empty.className = 'tk-empty';
      empty.textContent = 'A home for your favorite links. Add your first shortcut below.';
      list.append(empty);
    }
    for (const bookmark of data.bookmarks) {
      const tile = document.createElement('div');
      tile.className = 'tk-bookmark';
      const open = document.createElement('button');
      open.className = 'tk-bookmark-open';
      const name = document.createElement('b');
      name.textContent = bookmark.name;
      const url = document.createElement('small');
      url.textContent = new URL(bookmark.url).hostname;
      open.append(name, url);
      open.title = bookmark.url;
      open.addEventListener('click', async () => {
        try {
          const result = await bridge.toolkit.openBookmark(bookmark.id);
          if (!result.ok) message(result.error || 'Could not open link.');
        } catch {
          message('Could not open link.');
        }
      });
      const remove = document.createElement('button');
      remove.className = 'tk-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${bookmark.name}`);
      remove.addEventListener(
        'click',
        () => void save({ ...data, bookmarks: data.bookmarks.filter((item) => item.id !== bookmark.id) }),
      );
      tile.append(open, remove);
      list.append(tile);
    }
  }
  $('#tk-link-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $<HTMLInputElement>('#tk-link-name');
    const url = $<HTMLInputElement>('#tk-link-url');
    if (!name.value.trim()) return message('Give this shortcut a name.');
    const safe = safeWebUrl(url.value);
    if (!safe) return message('Use an HTTP or HTTPS link without a username or password.');
    if (data.bookmarks.length >= 24) return message('You can keep up to 24 shortcuts.');
    if (data.bookmarks.some((link) => link.url === safe))
      return message('That link is already in your shortcuts.');
    void save({ ...data, bookmarks: [...data.bookmarks, { id: '', name: name.value, url: safe }] });
    name.value = '';
    url.value = '';
  });
  let calcValue = '0';
  const history: { expression: string; result: string }[] = [];
  $('#tk-calc-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $<HTMLInputElement>('#tk-expression');
    try {
      if (input.value.length > 256) throw new Error();
      const value = calc(input.value);
      if (!Number.isFinite(value)) throw new Error();
      calcValue = String(Number(value.toPrecision(12)));
      $('#tk-calc-result').textContent = calcValue;
      history.unshift({ expression: input.value, result: calcValue });
      history.splice(5);
      const list = $('#tk-calc-history');
      list.replaceChildren();
      for (const item of history) {
        const button = document.createElement('button');
        button.textContent = `${item.expression} = ${item.result}`;
        button.addEventListener('click', () => {
          input.value = item.expression;
        });
        list.append(button);
      }
      message('');
    } catch {
      message('Check the expression. Use numbers, + − × ÷ ^ % and parentheses.');
    }
  });
  $('#tk-copy-calc').addEventListener('click', () => void copy(calcValue));
  const group = $<HTMLSelectElement>('#tk-unit-group');
  const from = $<HTMLSelectElement>('#tk-unit-from');
  const to = $<HTMLSelectElement>('#tk-unit-to');
  let converted = '';
  for (const [key, category] of Object.entries(UNIT_GROUPS)) group.add(new Option(category.label, key));
  function convert() {
    const raw = $<HTMLInputElement>('#tk-unit-value').value;
    try {
      if (!raw.trim()) throw new Error();
      converted = String(
        Number(convertUnit(Number(raw), group.value as UnitGroup, from.value, to.value).toPrecision(12)),
      );
      $('#tk-unit-result').textContent = `${converted} ${to.selectedOptions[0]?.text || ''}`;
      message('');
    } catch {
      converted = '';
      $('#tk-unit-result').textContent = 'Enter a valid value';
    }
  }
  function populateUnits() {
    from.replaceChildren();
    to.replaceChildren();
    for (const [key, unit] of Object.entries(UNIT_GROUPS[group.value as UnitGroup].units)) {
      from.add(new Option(unit[0], key));
      to.add(new Option(unit[0], key));
    }
    to.selectedIndex = 1;
    convert();
  }
  group.addEventListener('change', populateUnits);
  from.addEventListener('change', convert);
  to.addEventListener('change', convert);
  $('#tk-unit-value').addEventListener('input', convert);
  $('#tk-copy-unit').addEventListener('click', () => {
    if (converted) void copy(converted);
  });
  populateUnits();
  const text = $<HTMLTextAreaElement>('#tk-text');
  const action = $<HTMLSelectElement>('#tk-text-action');
  let previousText: string | null = null;
  for (const [key, label] of Object.entries(TEXT_ACTIONS)) action.add(new Option(label, key));
  const countText = () => {
    $('#tk-text-count').textContent =
      `${text.value.trim() ? text.value.trim().split(/\s+/u).length : 0} words · ${Array.from(text.value).length} characters`;
  };
  text.addEventListener('input', countText);
  $('#tk-text-run').addEventListener('click', () => {
    try {
      const result = transformText(text.value, action.value as keyof typeof TEXT_ACTIONS);
      previousText = text.value;
      text.value = result;
      $<HTMLButtonElement>('#tk-text-undo').disabled = false;
      countText();
      message('Text transformed');
    } catch {
      message('Could not transform this text. Check the input and encoding.');
    }
  });
  $('#tk-text-undo').addEventListener('click', () => {
    if (previousText !== null) text.value = previousText;
    previousText = null;
    $<HTMLButtonElement>('#tk-text-undo').disabled = true;
    countText();
  });
  $('#tk-text-copy').addEventListener('click', () => void copy(text.value));
  let generated = '';
  let secret = false;
  const length = $<HTMLInputElement>('#tk-password-length');
  length.addEventListener('input', () => {
    $('#tk-length').textContent = length.value;
  });
  function showGenerated(value: string, sensitive: boolean) {
    generated = value;
    secret = sensitive;
    $('#tk-secret').textContent = value;
    $<HTMLButtonElement>('#tk-copy-secret').disabled = false;
    message('');
  }
  $('#tk-password').addEventListener('click', () =>
    showGenerated(generatePassword(Number(length.value), $<HTMLInputElement>('#tk-symbols').checked), true),
  );
  $('#tk-uuid').addEventListener('click', () => showGenerated(crypto.randomUUID(), false));
  $('#tk-copy-secret').addEventListener('click', () => void copy(generated, secret));
  function renderClocks() {
    const list = $('#tk-clocks');
    list.replaceChildren();
    for (const clock of data.clocks) {
      const card = document.createElement('div');
      card.className = 'tk-clock';
      const name = document.createElement('b');
      name.textContent = clock.name;
      const time = document.createElement('strong');
      let formatter = clockFormats.get(clock.zone);
      if (!formatter) {
        formatter = new Intl.DateTimeFormat(undefined, {
          timeZone: clock.zone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: !state.features.clock24,
        });
        clockFormats.set(clock.zone, formatter);
      }
      time.textContent = formatter.format(new Date());
      const zone = document.createElement('small');
      zone.textContent = clock.zone.replaceAll('_', ' ');
      const remove = document.createElement('button');
      remove.className = 'tk-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${clock.name} clock`);
      remove.addEventListener(
        'click',
        () => void save({ ...data, clocks: data.clocks.filter((item) => item.id !== clock.id) }),
      );
      card.append(name, time, zone, remove);
      list.append(card);
    }
    if (!data.clocks.length) {
      const empty = document.createElement('p');
      empty.className = 'tk-empty';
      empty.textContent = 'Add a city or any IANA time zone below.';
      list.append(empty);
    }
  }
  function syncClocks() {
    clearTimeout(clockTimer);
    if (
      !state.visible ||
      document.hidden ||
      context.lastMode !== 'expanded' ||
      state.tab !== 'toolkit' ||
      currentView !== 'clocks'
    )
      return;
    renderClocks();
    clockTimer = setTimeout(syncClocks, 60000 - (Date.now() % 60000) + 50);
  }
  for (const event of ['island:mode', 'island:tab', 'island:visibility'] as const)
    window.addEventListener(event, syncClocks);
  document.addEventListener('visibilitychange', syncClocks);
  window.addEventListener('island:features', () => {
    clockFormats.clear();
    syncClocks();
  });
  $('#tk-clock-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $<HTMLInputElement>('#tk-clock-name');
    const zone = $<HTMLInputElement>('#tk-clock-zone');
    if (!validZone(zone.value)) return message('Use a time zone such as Europe/London or Asia/Tokyo.');
    if (data.clocks.length >= 8) return message('You can keep up to eight world clocks.');
    if (data.clocks.some((clock) => clock.zone === zone.value))
      return message('That time zone is already here.');
    void save({
      ...data,
      clocks: [
        ...data.clocks,
        {
          id: '',
          name: name.value.trim() || zone.value.split('/').pop()!.replaceAll('_', ' '),
          zone: zone.value,
        },
      ],
    });
    name.value = '';
    zone.value = '';
  });
  async function applyProfile(id: string) {
    try {
      await bridge.customization.applyProfile(id);
      message('Profile applied');
    } catch {
      message('Could not apply this profile.');
    }
  }
  initializeModePicker(context, selectView);
  function showProfiles(profiles: Profile[]) {
    const list = $('#tk-profiles');
    list.replaceChildren();
    for (const profile of profiles) {
      const button = document.createElement('button');
      button.className = 'tk-button';
      button.textContent = profile.name;
      button.addEventListener('click', () => void applyProfile(profile.id));
      list.append(button);
    }
  }
  bridge.toolkit.onChange(showData);
  bridge.customization.onProfiles(showProfiles);
  void bridge.toolkit
    .get()
    .then(showData)
    .catch(() => message('Could not load your toolkit.'));
  void bridge.customization
    .profiles()
    .then(showProfiles)
    .catch(() => message('Could not load profiles.'));
  selectView('shortcuts');
}
