import { initializeAppearanceSettings } from '../../appearance/renderer/settings';
import { initializePerformanceSettings } from '../../performance/renderer/settings';
import { initializePersonalization } from '../../customization/renderer/settings';
import { initializeModeLibrary } from '../../modes/renderer/settings';
import { initializeUpdateSettings } from '../../updates/renderer/settings';
type NumberFeature = { [K in keyof Features]: Features[K] extends number ? K : never }[keyof Features];
import { DEFAULTS, type Features } from '../domain/features';
import type { GeneralState } from '../../../shared/contracts/events';
import type { LocationInfo } from '../../system/domain/types';
import type { CalendarSnapshot } from '../../calendar/domain/types';
import type { DownloadFolder } from '../../downloads/domain/types';
import { $, $$ } from '../../../shared/renderer/dom';
const api = window.prefs;

let features: Features = { ...DEFAULTS };

// ---- saved hint ----
let savedTimer: ReturnType<typeof setTimeout> | undefined;
function saved(text = 'Saved') {
  $('#saved').textContent = text;
  $('#saved').classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('#saved').classList.remove('on'), 1300);
}

function nope(el: HTMLElement) {
  el.classList.remove('nope');
  void el.offsetWidth;
  el.classList.add('nope');
}

// ---- feature switches ----
function showFeatures(f: Features) {
  features = f;
  $$<HTMLInputElement>('[data-feature]').forEach((el) => {
    el.checked = !!f[el.dataset.feature as keyof Features];
  });
  // child settings show only while every switch they depend on is on
  $$('[data-needs]').forEach((el) =>
    el.classList.toggle('off', !el.dataset.needs!.split(' ').every((k) => f[k as keyof Features])),
  );
  showSteppers();
}

$$<HTMLInputElement>('[data-feature]').forEach((el) =>
  el.addEventListener('change', () => {
    const key = el.dataset.feature as keyof Features;
    // at least one reminder kind stays on
    if (
      el.hasAttribute('data-kind') &&
      !el.checked &&
      ![...$$<HTMLInputElement>('[data-kind]')].some((k) => k.checked)
    ) {
      el.checked = true;
      nope(el);
      return;
    }
    if (
      el.hasAttribute('data-tab') &&
      !el.checked &&
      ![...$$<HTMLInputElement>('[data-tab]')].some((t) => t.checked)
    ) {
      el.checked = true;
      nope(el.closest<HTMLElement>('.chip')!);
      $('#tabs-warn').hidden = false;
      setTimeout(() => {
        $('#tabs-warn').hidden = true;
      }, 2600);
      return;
    }
    api.setFeatures({ [key]: el.checked });
    saved();
  }),
);

// ---- number steppers (fixed list of sensible values) ----
const TIME_STEPS = Array.from({ length: 48 }, (_, i) => i * 30);
const stepsOf = (st: HTMLElement) =>
  st.dataset.steps === 'time' ? TIME_STEPS : st.dataset.steps!.split(',').map(Number);
function unitText(n: number, unit: string | undefined) {
  if (unit === 'glass') return `${n} glasses`;
  if (unit === 'day')
    return n === 0 ? 'None' : `${n > 0 ? '+' : '−'}${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;
  if (unit === 'time') {
    const d = new Date(2000, 0, 1, Math.floor(n / 60), n % 60);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (unit === 'min') return n >= 60 && n % 60 === 0 ? `${n / 60} h` : `${n} min`;
  return `${n} s`;
}
function showSteppers() {
  $$('.stepper').forEach((st) => {
    const v = features[st.dataset.num as NumberFeature];
    st.querySelector<HTMLElement>('output')!.textContent = unitText(v, st.dataset.unit);
    const steps = stepsOf(st);
    const wraps = st.dataset.steps === 'time';
    st.querySelector<HTMLButtonElement>('[data-dir="-1"]')!.disabled = !wraps && v <= steps[0];
    st.querySelector<HTMLButtonElement>('[data-dir="1"]')!.disabled = !wraps && v >= steps[steps.length - 1];
  });
}
$$('.stepper').forEach((st) =>
  st.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    const steps = stepsOf(st);
    const v = features[st.dataset.num as NumberFeature];
    let next = b.dataset.dir === '1' ? steps.find((s) => s > v) : [...steps].reverse().find((s) => s < v);
    // clock times go round the day
    if (next == null && st.dataset.steps === 'time')
      next = b.dataset.dir === '1' ? steps[0] : steps[steps.length - 1];
    if (next == null) return;
    features[st.dataset.num as NumberFeature] = next;
    showSteppers();
    api.setFeatures({ [st.dataset.num!]: next });
    saved();
  }),
);
$<HTMLButtonElement>('#rm-preview').addEventListener('click', () => api.previewReminder());

// ---- general (lives in the main process) ----
function showGeneral(g: GeneralState) {
  $$<HTMLInputElement>('[data-general]').forEach((el) => {
    el.checked = !!g[el.dataset.general as keyof GeneralState];
  });
  $$('[data-orient]').forEach((b) =>
    b.setAttribute('aria-checked', String((b.dataset.orient === 'v') === !!g.vertical)),
  );
  if (g.version)
    $('#version').innerHTML =
      `Version ${g.version} &bull; <b style="color:var(--txt,#fff);">by Belal Yosry</b>`;
}
$$('[data-support]').forEach((b) => b.addEventListener('click', () => api.openSupport(b.dataset.support!)));
$$<HTMLInputElement>('[data-general]').forEach((el) =>
  el.addEventListener('change', () => {
    api.setGeneral(el.dataset.general!, el.checked);
    saved();
  }),
);
$$('[data-orient]').forEach((b) =>
  b.addEventListener('click', () => {
    api.setGeneral('vertical', b.dataset.orient === 'v');
    saved();
  }),
);
$$('[data-general-action]').forEach((b) =>
  b.addEventListener('click', () => {
    api.setGeneral(b.dataset.generalAction!, true);
    saved('Done');
  }),
);

// ---- location ----
function showLocation(info: LocationInfo) {
  const manual = info?.mode === 'manual';
  $('#loc-now').textContent = manual
    ? `${info.name}${info.country ? `, ${info.country}` : ''}`
    : `Auto${info?.name ? ` · ${info.name}` : ''}`;
  $<HTMLButtonElement>('#loc-auto').hidden = !manual;
}
async function searchCity() {
  const q = $<HTMLInputElement>('#loc-q').value.trim();
  const box = $('#loc-results');
  if (q.length < 2) return;
  box.hidden = false;
  box.innerHTML = '<div class="none">Searching…</div>';
  const res = await api.searchCity(q);
  if (!res) {
    box.innerHTML = '<div class="none">Search failed. Check your connection.</div>';
    return;
  }
  if (!res.length) {
    box.innerHTML = '<div class="none">No results</div>';
    return;
  }
  box.innerHTML = '';
  res.forEach((r) => {
    const b = document.createElement('button');
    b.innerHTML = '<b></b><span></span>';
    b.querySelector<HTMLElement>('b')!.textContent = r.name;
    b.querySelector<HTMLElement>('span')!.textContent = [r.admin, r.country].filter(Boolean).join(', ');
    b.addEventListener('click', () => {
      api.setLocation(r);
      box.hidden = true;
      $<HTMLInputElement>('#loc-q').value = '';
      saved();
    });
    box.append(b);
  });
}
$<HTMLButtonElement>('#loc-go').addEventListener('click', searchCity);
$<HTMLInputElement>('#loc-q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchCity();
});
$<HTMLButtonElement>('#loc-auto').addEventListener('click', () => {
  api.setLocation(null);
  saved();
});
api.onLocation(showLocation);
api.location().then(showLocation);

// ---- calendar ----
function showCalendar(c: CalendarSnapshot) {
  const el = $('#cal-status');
  if (!c?.hasUrl && !c?.updated && !c?.error) {
    el.textContent = 'Not linked';
    return;
  }
  if (c.error) {
    el.textContent = `Can't read it (${c.error})`;
    return;
  }
  const next = c.events?.find((e) => e.end > Date.now());
  el.textContent = next
    ? `Linked · next: ${next.title} ${new Date(next.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : 'Linked · nothing in the next 24 h';
}
$<HTMLButtonElement>('#cal-save').addEventListener('click', async () => {
  const res = await api.setCalendar($<HTMLInputElement>('#cal-url').value);
  if (!res?.ok) {
    $('#cal-status').textContent = 'Use an https:// or webcal:// link';
    return;
  }
  $<HTMLInputElement>('#cal-url').value = '';
  $('#cal-status').textContent = 'Connecting…';
  saved();
});
api.onCalendar((c) => showCalendar({ ...c, hasUrl: true }));
api.calendar().then(showCalendar);

// ---- download folders (browser downloads) ----
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function showFolders(list: DownloadFolder[]) {
  $('#dl-folders').innerHTML = (list || [])
    .map(
      (f) =>
        `<div class="row folder"><small class="path" title="${esc(f.path)}">${esc(f.path)}</small>${
          f.fixed
            ? '<small class="val">Windows Downloads</small>'
            : `<button class="btn" data-folder="${esc(f.path)}" aria-label="Remove folder">✕</button>`
        }</div>`,
    )
    .join('');
}
$('#dl-folders').addEventListener('click', async (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-folder]');
  if (!b) return;
  showFolders(await api.removeDownloadFolder(b.dataset.folder!));
  saved();
});
$<HTMLButtonElement>('#dl-folder-add').addEventListener('click', async () => {
  showFolders(await api.addDownloadFolder());
});
api.downloadFolders().then(showFolders);

// ---- media bridge health ----
async function showBridge() {
  if (document.hidden) return;
  const s = await api.bridgeStatus();
  const el = $('#bridge-state');
  el.className = `status ${s.state}`;
  el.textContent = s.state === 'ok' ? 'Running' : s.state === 'starting' ? 'Starting…' : 'Stopped';
  const detail = $('#bridge-detail');
  detail.hidden = s.state !== 'failed';
  detail.textContent = 'Allow Nova Island in your antivirus, then restart it';
}
showBridge();
setInterval(showBridge, 4000);

$<HTMLButtonElement>('#open-log').addEventListener('click', () => api.openLog());
$<HTMLButtonElement>('#copy-report').addEventListener('click', async () => {
  await api.copyReport();
  saved('Report copied');
});

$<HTMLButtonElement>('#reset-all').addEventListener('click', () => {
  api.resetFeatures();
  saved('Reset to defaults');
});

// ---- window buttons ----
$$('[data-win]').forEach((b) => b.addEventListener('click', () => api.window(b.dataset.win!)));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($<HTMLInputElement>('#find').value) clearSearch();
  else api.window('close');
});

// ---- pages: one at a time, the last one opened is remembered ----
const PAGE_KEY = 'prefs-page';
function remembered() {
  try {
    return localStorage.getItem(PAGE_KEY) || 'general';
  } catch {
    return 'general';
  }
}
const links = [...$$('.side a')];
function showPage(id: string) {
  if (!document.getElementById(id)) id = 'general';
  $$('.page').forEach((p) => p.classList.toggle('on', p.id === id));
  links.forEach((a) => a.classList.toggle('on', a.dataset.page === id));
  $('#content').scrollTop = 0;
  try {
    localStorage.setItem(PAGE_KEY, id);
  } catch {}
}
links.forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    clearSearch();
    showPage(a.dataset.page!);
  }),
);
showPage(location.hash.slice(1) || remembered());
api.onPage((page) => {
  clearSearch();
  showPage(page);
});

// ---- search: rows from every page whose title matches ----
// rows without a title (the city and calendar link fields) stay on their own page
const title = (el: HTMLElement) => el.querySelector<HTMLElement>('b')?.textContent.toLowerCase() || '';
function search(q: string) {
  q = q.trim().toLowerCase();
  modeLibrary.search(q);
  document.body.classList.toggle('searching', !!q);
  links.forEach((a) => a.classList.toggle('on', !q && a.dataset.page === remembered()));
  if (!q) {
    $$('.miss, .empty').forEach((el) => el.classList.remove('miss', 'empty'));
    $('#no-results').hidden = true;
    showPage(remembered());
    return;
  }
  for (const el of $$('.row, .chip')) el.classList.toggle('miss', !title(el).includes(q));
  // a group's own heading matches too
  $$('.group').forEach((g) => {
    const head = g.querySelector<HTMLElement>('h2')?.textContent.toLowerCase().includes(q);
    if (head)
      g.querySelectorAll<HTMLElement>('.miss').forEach((el) => {
        if (title(el)) el.classList.remove('miss');
      });
    g.classList.toggle(
      'empty',
      !g.querySelector<HTMLElement>('.row:not(.miss):not(.off), .chip:not(.miss)')!,
    );
  });
  let any = false;
  $$('.page').forEach((p) => {
    const empty = !p.querySelector<HTMLElement>('.group:not(.empty)')!;
    p.classList.toggle('empty', empty);
    any ||= !empty;
  });
  $('#no-results').hidden = any;
}
function clearSearch() {
  if (!$<HTMLInputElement>('#find').value) return;
  $<HTMLInputElement>('#find').value = '';
  search('');
}
$<HTMLInputElement>('#find').addEventListener('input', (e) => search((e.target as HTMLInputElement).value));

api.onFeatures(showFeatures);
api.onGeneral(showGeneral);
api.features().then(showFeatures);
api.general().then(showGeneral);

initializePersonalization(api);
const modeLibrary = initializeModeLibrary(api.modes);
initializeAppearanceSettings(api);
initializeUpdateSettings(api.updates);
initializePerformanceSettings(api);
