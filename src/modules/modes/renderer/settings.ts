import { $, $$ } from '../../../shared/renderer/dom';
import type { ModesBridge } from '../../../shared/contracts/bridge';
import { MODES, MODIFIERS, CATEGORIES, findModes, modeById } from '../domain/catalog';
import type { ModeState } from '../domain/service';

export function initializeModeLibrary(api: ModesBridge) {
  const root = $('#modes');
  root.innerHTML = `<div class="modes-heading"><div><h1>Change your rhythm.</h1><p class="lead">16 modes. Eight mix-in mods. One island that feels like you.</p></div><div class="mode-mini-island" aria-hidden="true"><span>✦</span><i></i><i></i><i></i></div></div>
    <div class="modes-current"><div><small>Your setup</small><b id="mode-current-name">Personal setup</b><span id="mode-current-detail">Choose a mode or add a mod below.</span></div><button id="mode-restore" class="btn" disabled>Return to my setup</button></div>
    <div class="mode-library-views" aria-label="Library views"><button data-mode-view="library" aria-pressed="true">Modes <span>16</span></button><button data-mode-view="mods" aria-pressed="false">Mix-in mods <span>8</span></button></div>
    <div class="group" data-mode-section="library"><h2>Find your mode</h2><div class="mode-search"><input type="search" id="mode-search" maxlength="100" placeholder="Search modes, tools, or a mood…" aria-label="Search modes"><label><input type="checkbox" id="mode-favorites"> Favorites</label></div><div class="mode-filters" aria-label="Mode categories">${['All', ...CATEGORIES].map((category) => `<button data-mode-category="${category}" aria-pressed="${category === 'All'}">${category}</button>`).join('')}</div><div id="mode-grid" class="mode-grid"></div><p id="mode-empty" class="hint" hidden>No modes match. Try another search or turn off Favorites.</p><p class="mode-count" id="mode-count" role="status"></p></div>
    <div class="group" data-mode-section="mods" hidden><h2>Mix in a few mods</h2><p class="hint">Layer these over any mode or your personal setup. Turning one off restores the underlying choice.</p><div class="mod-grid">${MODIFIERS.map((mod) => `<label class="mod-switch row"><span><b>${mod.name}</b><small>${mod.description}</small></span><input type="checkbox" class="sw" data-mod="${mod.id}" aria-label="${mod.name}"></label>`).join('')}</div></div>
    <p class="hint mode-footnote">Modes apply immediately. Save your favorite combination as a named profile in Personalize.</p>
    <p id="mode-status" class="custom-status" role="status" aria-live="polite"></p>`;
  let state: ModeState = {
    activeId: null,
    mods: [],
    favorites: [],
    customized: false,
    canRestore: false,
    activation: 0,
  };
  let category = 'All';
  let globalQuery = '';
  let busy = false;
  const status = (value: string) => {
    $('#mode-status').textContent = value;
  };
  async function run(action: () => Promise<ModeState>, success: string) {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    try {
      show(await action());
      status(success);
    } catch {
      status('Could not update your setup. Try again.');
      show(state);
    } finally {
      busy = false;
      root.removeAttribute('aria-busy');
    }
  }
  function renderCards() {
    const focused =
      document.activeElement instanceof HTMLElement ? document.activeElement.dataset.modeFocus : undefined;
    const matches = findModes(
      globalQuery || $<HTMLInputElement>('#mode-search').value,
      globalQuery ? 'All' : category,
      !globalQuery && $<HTMLInputElement>('#mode-favorites').checked ? state.favorites : undefined,
    );
    const grid = $('#mode-grid');
    grid.replaceChildren();
    for (const mode of matches) {
      const active = mode.id === state.activeId;
      const card = document.createElement('article');
      card.className = 'mode-card row';
      card.dataset.modeCard = mode.id;
      card.dataset.active = String(active);
      card.style.setProperty('--mode-color', mode.accent);
      const mark = document.createElement('span');
      mark.className = 'mode-symbol';
      mark.textContent = mode.symbol;
      mark.ariaHidden = 'true';
      const title = document.createElement('b');
      title.textContent = mode.name;
      const favorite = document.createElement('button');
      favorite.className = 'mode-favorite';
      favorite.textContent = state.favorites.includes(mode.id) ? '★' : '☆';
      favorite.setAttribute('aria-label', `Favorite ${mode.name}`);
      favorite.setAttribute('aria-pressed', String(state.favorites.includes(mode.id)));
      favorite.dataset.modeFocus = `favorite-${mode.id}`;
      favorite.addEventListener(
        'click',
        () => void run(() => api.favorite(mode.id, !state.favorites.includes(mode.id)), 'Favorites updated'),
      );
      const description = document.createElement('p');
      description.textContent = mode.description;
      const details = document.createElement('ul');
      for (const highlight of mode.highlights) {
        const item = document.createElement('li');
        item.textContent = highlight;
        details.append(item);
      }
      const button = document.createElement('button');
      button.className = 'mode-apply';
      button.textContent = active ? (state.customized ? 'Reapply mode' : 'Active mode') : 'Use mode';
      button.setAttribute('aria-label', `${active ? 'Reapply' : 'Use'} ${mode.name}`);
      button.dataset.modeApply = mode.id;
      button.dataset.modeFocus = `apply-${mode.id}`;
      button.addEventListener('click', () => void run(() => api.apply(mode.id), `${mode.name} applied`));
      card.append(mark, title, favorite, description, details, button);
      grid.append(card);
    }
    $('#mode-empty').hidden = !!matches.length;
    $('#mode-count').textContent = `${matches.length} of ${MODES.length} modes`;
    if (focused)
      root.querySelector<HTMLElement>(`[data-mode-focus="${focused}"]`)?.focus({ preventScroll: true });
  }
  function show(next: ModeState) {
    state = next;
    $('#mode-current-name').textContent =
      modeById(state.activeId)?.name || (state.mods.length ? 'Personal setup + mods' : 'Personal setup');
    $('#mode-current-detail').textContent = state.canRestore
      ? `${state.mods.length} active mod${state.mods.length === 1 ? '' : 's'}${state.customized ? ' · Customized' : ''} · Your previous setup is saved`
      : 'Choose a mode or add a mod below.';
    $<HTMLButtonElement>('#mode-restore').disabled = !state.canRestore;
    $$<HTMLInputElement>('[data-mod]', root).forEach((input) => {
      input.checked = state.mods.includes(input.dataset.mod!);
    });
    renderCards();
  }
  $('#mode-search').addEventListener('input', renderCards);
  $$<HTMLButtonElement>('[data-mode-view]', root).forEach((button) =>
    button.addEventListener('click', () => {
      $$<HTMLButtonElement>('[data-mode-view]', root).forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      );
      $$('[data-mode-section]', root).forEach((section) => {
        section.hidden = section.dataset.modeSection !== button.dataset.modeView;
      });
    }),
  );
  $('#mode-favorites').addEventListener('change', renderCards);
  $$<HTMLButtonElement>('[data-mode-category]', root).forEach((button) =>
    button.addEventListener('click', () => {
      category = button.dataset.modeCategory!;
      $$<HTMLButtonElement>('[data-mode-category]', root).forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      );
      renderCards();
    }),
  );
  $$<HTMLInputElement>('[data-mod]', root).forEach((input) =>
    input.addEventListener('change', () => {
      if (busy) {
        input.checked = state.mods.includes(input.dataset.mod!);
        return;
      }
      void run(
        () => api.setMod(input.dataset.mod!, input.checked),
        `${MODIFIERS.find((mod) => mod.id === input.dataset.mod)!.name} updated`,
      );
    }),
  );
  $('#mode-restore').addEventListener(
    'click',
    () => void run(() => api.restore(), 'Your previous setup restored'),
  );
  api.onChange(show);
  void api
    .get()
    .then(show)
    .catch(() => status('Could not load modes. Reopen Settings to try again.'));
  return {
    search(query: string) {
      globalQuery = query;
      const view = root.querySelector<HTMLElement>('[data-mode-view][aria-pressed="true"]')?.dataset.modeView;
      $$('[data-mode-section]', root).forEach((section) => {
        section.hidden = !query && section.dataset.modeSection !== view;
      });
      renderCards();
    },
  };
}
