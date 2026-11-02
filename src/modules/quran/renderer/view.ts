import type { IslandContext } from '../../../renderer/island/context';
import type { QuranCatalog, QuranMoshaf, QuranReciter } from '../domain/catalog';
import { normalizeSearch } from '../domain/catalog';
import { QURAN_DEFAULTS, type QuranPreferences } from '../domain/service';

export function initializeQuran(context: Pick<IslandContext, '$' | 'bridge' | 'state' | 'lastMode'>) {
  const { $, bridge, state } = context;
  const root = $('#v-quran');
  root.innerHTML = `<div class="quran-shell">
    <header class="quran-heading"><div><h2 lang="ar" dir="rtl">القرآن الكريم</h2><span id="qr-catalog-state">A moment of peace, at your pace.</span></div><button id="qr-refresh" title="Refresh reciter catalog">Refresh library</button></header>
    <div class="quran-library"><aside class="quran-reciters"><div class="qr-search-row"><input id="qr-reciter-search" type="search" maxlength="100" placeholder="Search قرّاء…" aria-label="Search reciters"><button id="qr-favorites" aria-label="Favorite reciters only" aria-pressed="false" title="Favorites">☆</button></div><div id="qr-reciters" class="qr-scroll" aria-label="Reciters"></div></aside>
    <section class="quran-surahs" aria-label="Surahs" aria-describedby="qr-selected"><span id="qr-selected" class="qr-sr-only" lang="ar" dir="auto">Choose a reciter</span><div class="qr-style-row"><select id="qr-moshaf" aria-label="Recitation style" dir="auto" disabled></select><button id="qr-star" aria-label="Favorite selected reciter" aria-pressed="false" title="Favorite selected reciter">☆</button></div><input id="qr-surah-search" type="search" maxlength="100" placeholder="Find a surah · اسم أو رقم السورة" aria-label="Search surahs"><div id="qr-surahs" class="qr-surah-list qr-scroll"></div></section></div>
    <footer class="quran-player"><div class="qr-now"><span id="qr-now-title" dir="auto">Choose a surah to listen</span><span id="qr-time">0:00 / 0:00</span></div><input id="qr-seek" type="range" min="0" max="1" value="0" step="1" aria-label="Playback position" disabled><div class="qr-controls"><button id="qr-prev" title="Previous surah" aria-label="Previous surah">‹</button><button id="qr-play" class="qr-play" aria-label="Play Quran">▶</button><button id="qr-next" title="Next surah" aria-label="Next surah">›</button><button id="qr-stop" title="Stop and release audio" aria-label="Stop Quran">■</button><input id="qr-volume" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="Quran volume"><select id="qr-repeat" aria-label="Repeat"><option value="off">Repeat off</option><option value="one">Repeat surah</option><option value="all">Repeat all</option></select><label class="qr-auto"><input id="qr-auto" type="checkbox" checked>Next</label><button id="qr-source" class="qr-source">MP3Quran ↗</button></div></footer>
    <div id="qr-status" role="status" aria-live="polite">Open the library to load available reciters.</div><audio id="qr-audio" preload="none"></audio>
  </div>`;
  const audio = $<HTMLAudioElement>('#qr-audio');
  const reciterQuery = $<HTMLInputElement>('#qr-reciter-search');
  const surahQuery = $<HTMLInputElement>('#qr-surah-search');
  const moshafSelect = $<HTMLSelectElement>('#qr-moshaf');
  const seek = $<HTMLInputElement>('#qr-seek');
  const play = $<HTMLButtonElement>('#qr-play');
  let catalog: QuranCatalog | null = null;
  let prefs: QuranPreferences = structuredClone(QURAN_DEFAULTS);
  let initialized = false,
    loading = false,
    favoriteOnly = false,
    limit = 60;
  let playbackGeneration = 0,
    lastSaved = 0,
    pendingSeek = 0,
    requested = false;
  let selectedReciter: QuranReciter | undefined, selectedMoshaf: QuranMoshaf | undefined;
  const visible = () =>
    state.visible && !document.hidden && context.lastMode === 'expanded' && state.tab === 'quran';
  const message = (text: string) => {
    $('#qr-status').textContent = text;
  };
  const time = (value: number) => {
    const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  };
  function save(patch: Partial<QuranPreferences> = {}) {
    prefs = { ...prefs, ...patch };
    void bridge.quran.save(patch).catch(() => message('Could not save your listening preferences.'));
  }
  function savePosition() {
    if (audio.getAttribute('src'))
      save({ position: Number.isFinite(audio.currentTime) ? audio.currentTime : 0 });
  }
  function renderPlayback() {
    if (!visible()) return;
    const active = !audio.paused && !audio.ended;
    play.textContent = active ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', active ? 'Pause Quran' : 'Play Quran');
    $('#qr-now-title').textContent = selectedReciter
      ? `${catalog?.surahs.find((s) => s.id === prefs.surah)?.name || ''} · ${selectedReciter.name}`
      : 'Choose a surah to listen';
    $('#qr-time').textContent =
      `${time(audio.getAttribute('src') ? audio.currentTime : prefs.position)} / ${time(audio.duration)}`;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    seek.disabled = !duration;
    seek.max = String(duration || 1);
    seek.value = String(audio.currentTime || 0);
    root
      .querySelectorAll<HTMLElement>('[data-surah]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(Number(button.dataset.surah) === prefs.surah)),
      );
    play.disabled = !selectedMoshaf;
    $<HTMLButtonElement>('#qr-prev').disabled =
      !selectedMoshaf || selectedMoshaf.surahs.indexOf(prefs.surah) <= 0;
    $<HTMLButtonElement>('#qr-next').disabled =
      !selectedMoshaf || selectedMoshaf.surahs.indexOf(prefs.surah) >= selectedMoshaf.surahs.length - 1;
  }
  function unload(reset = false) {
    playbackGeneration++;
    requested = false;
    if (!reset) savePosition();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (reset) save({ position: 0 });
    renderPlayback();
  }
  function renderReciters() {
    const list = $('#qr-reciters');
    list.replaceChildren();
    if (!catalog) return;
    const query = normalizeSearch(reciterQuery.value);
    const matches = catalog.reciters.filter(
      (r) =>
        (!favoriteOnly || prefs.favorites.includes(r.id)) &&
        normalizeSearch(`${r.name} ${r.english}`).includes(query),
    );
    for (const reciter of matches.slice(0, limit)) {
      const button = document.createElement('button');
      button.className = 'qr-reciter';
      button.dataset.reciter = String(reciter.id);
      button.setAttribute('aria-pressed', String(reciter.id === prefs.reciterId));
      const name = document.createElement('b');
      name.textContent = reciter.name;
      name.lang = 'ar';
      name.dir = 'rtl';
      const english = document.createElement('small');
      english.textContent = reciter.english || `${reciter.moshafs.length} recitation styles`;
      button.append(name, english);
      button.addEventListener('click', () => chooseReciter(reciter.id, true));
      list.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'qr-empty';
      empty.textContent = favoriteOnly
        ? 'Star a reciter to keep them here.'
        : 'No reciters found. Try Arabic or English.';
      list.append(empty);
    }
    if (matches.length > limit) {
      const more = document.createElement('button');
      more.className = 'qr-more';
      more.textContent = `Show more (${matches.length - limit})`;
      more.addEventListener('click', () => {
        const scroll = list.scrollTop;
        limit += 60;
        renderReciters();
        list.scrollTop = scroll;
      });
      list.append(more);
    }
  }
  function renderSurahs() {
    const list = $('#qr-surahs');
    list.replaceChildren();
    const query = normalizeSearch(surahQuery.value).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
    const matches =
      catalog?.surahs.filter(
        (s) =>
          selectedMoshaf?.surahs.includes(s.id) &&
          normalizeSearch(`${s.id} ${s.name} ${s.english}`).includes(query),
      ) || [];
    for (const surah of matches) {
      const button = document.createElement('button');
      button.dataset.surah = String(surah.id);
      button.setAttribute('aria-pressed', String(surah.id === prefs.surah));
      button.setAttribute('aria-label', `Play ${surah.name} ${surah.english}`);
      const n = document.createElement('span');
      n.textContent = String(surah.id).padStart(2, '0');
      const name = document.createElement('b');
      name.textContent = surah.name;
      name.dir = 'rtl';
      name.lang = 'ar';
      button.append(n, name);
      button.addEventListener('click', () => void start(surah.id));
      list.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'qr-empty';
      empty.textContent = 'No available surahs match your search.';
      list.append(empty);
    }
  }
  function chooseReciter(id: number, reset = false) {
    if (!catalog) return;
    if (reset) unload(true);
    selectedReciter = catalog.reciters.find((r) => r.id === id) || catalog.reciters[0];
    selectedMoshaf =
      selectedReciter.moshafs.find((m) => m.id === prefs.moshafId) || selectedReciter.moshafs[0];
    const surah = selectedMoshaf.surahs.includes(prefs.surah) ? prefs.surah : selectedMoshaf.surahs[0];
    const changed =
      selectedReciter.id !== prefs.reciterId || selectedMoshaf.id !== prefs.moshafId || surah !== prefs.surah;
    if (changed && audio.getAttribute('src')) unload(true);
    save({
      reciterId: selectedReciter.id,
      moshafId: selectedMoshaf.id,
      surah,
      ...(changed ? { position: 0 } : {}),
    });
    $('#qr-selected').textContent = selectedReciter.name;
    $('#qr-star').textContent = prefs.favorites.includes(selectedReciter.id) ? '★' : '☆';
    $('#qr-star').setAttribute('aria-pressed', String(prefs.favorites.includes(selectedReciter.id)));
    moshafSelect.replaceChildren(
      ...selectedReciter.moshafs.map((m) => {
        const option = document.createElement('option');
        option.value = String(m.id);
        option.textContent = `${m.name} · ${m.surahs.length} سورة`;
        return option;
      }),
    );
    moshafSelect.value = String(selectedMoshaf.id);
    moshafSelect.disabled = false;
    renderReciters();
    renderSurahs();
    renderPlayback();
  }
  async function load(refresh = false) {
    if (loading) return;
    loading = true;
    $<HTMLButtonElement>('#qr-refresh').disabled = true;
    message('Loading reciters…');
    try {
      if (!initialized) {
        prefs = await bridge.quran.preferences();
        initialized = true;
        audio.volume = prefs.volume;
        $<HTMLInputElement>('#qr-volume').value = String(prefs.volume);
        $<HTMLSelectElement>('#qr-repeat').value = prefs.repeat;
        $<HTMLInputElement>('#qr-auto').checked = prefs.autoNext;
      }
      catalog = await bridge.quran.catalog(refresh);
      $('#qr-catalog-state').textContent =
        `${catalog.reciters.length} reciters · 114 surahs${catalog.stale ? ' · Saved library' : ''}`;
      chooseReciter(prefs.reciterId);
      message(
        catalog.stale
          ? 'Using your saved library. Streaming still needs an internet connection.'
          : 'Choose a surah. Audio streams only when you press play.',
      );
    } catch {
      message('Could not load the library. Check your connection, then choose Refresh library.');
    } finally {
      loading = false;
      $<HTMLButtonElement>('#qr-refresh').disabled = false;
      renderPlayback();
    }
  }
  async function start(surah = prefs.surah, resume = 0) {
    if (!selectedReciter || !selectedMoshaf) return;
    const generation = ++playbackGeneration;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    save({ surah, position: resume });
    pendingSeek = resume;
    requested = true;
    message('Connecting to recitation…');
    renderPlayback();
    try {
      const url = await bridge.quran.stream(selectedReciter.id, selectedMoshaf.id, surah);
      if (generation !== playbackGeneration) return;
      audio.src = url;
      audio.load();
      await audio.play();
      if (generation !== playbackGeneration) return;
      message('Playing · يستمر التشغيل عند إغلاق الجزيرة');
    } catch {
      if (generation === playbackGeneration) {
        requested = false;
        message('Playback could not start. Check your connection and press Play to retry.');
        renderPlayback();
      }
    }
  }
  function adjacent(direction: number) {
    if (!selectedMoshaf) return;
    const next = selectedMoshaf.surahs[selectedMoshaf.surahs.indexOf(prefs.surah) + direction];
    if (next) void start(next);
  }
  play.addEventListener('click', () => {
    if (!audio.paused) {
      requested = false;
      audio.pause();
      return;
    }
    if (!audio.getAttribute('src') || audio.error || audio.ended) void start(prefs.surah, prefs.position);
    else {
      requested = true;
      void audio.play().catch(() => message('Playback is unavailable. Press Play to retry.'));
    }
  });
  $('#qr-stop').addEventListener('click', () => {
    unload(true);
    message('Stopped. Audio buffer released.');
  });
  $('#qr-prev').addEventListener('click', () => adjacent(-1));
  $('#qr-next').addEventListener('click', () => adjacent(1));
  $('#qr-refresh').addEventListener('click', () => void load(true));
  $('#qr-source').addEventListener('click', () => bridge.quran.openSource());
  reciterQuery.addEventListener('input', () => {
    limit = 60;
    renderReciters();
  });
  surahQuery.addEventListener('input', renderSurahs);
  $('#qr-favorites').addEventListener('click', () => {
    favoriteOnly = !favoriteOnly;
    $('#qr-favorites').setAttribute('aria-pressed', String(favoriteOnly));
    limit = 60;
    renderReciters();
  });
  $('#qr-star').addEventListener('click', () => {
    if (!selectedReciter) return;
    const id = selectedReciter.id;
    save({
      favorites: prefs.favorites.includes(id)
        ? prefs.favorites.filter((n) => n !== id)
        : [...prefs.favorites, id].slice(-100),
    });
    $('#qr-star').textContent = prefs.favorites.includes(id) ? '★' : '☆';
    $('#qr-star').setAttribute('aria-pressed', String(prefs.favorites.includes(id)));
    renderReciters();
  });
  moshafSelect.addEventListener('change', () => {
    unload(true);
    save({ moshafId: Number(moshafSelect.value) });
    chooseReciter(prefs.reciterId);
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value);
  });
  seek.addEventListener('change', savePosition);
  audio.addEventListener('seeked', savePosition);
  $<HTMLInputElement>('#qr-volume').addEventListener('input', (event) => {
    audio.volume = Number((event.target as HTMLInputElement).value);
  });
  $<HTMLInputElement>('#qr-volume').addEventListener('change', () => save({ volume: audio.volume }));
  $<HTMLSelectElement>('#qr-repeat').addEventListener('change', (event) =>
    save({ repeat: (event.target as HTMLSelectElement).value as QuranPreferences['repeat'] }),
  );
  $<HTMLInputElement>('#qr-auto').addEventListener('change', (event) =>
    save({ autoNext: (event.target as HTMLInputElement).checked }),
  );
  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek > 0 && pendingSeek < audio.duration) audio.currentTime = pendingSeek;
    pendingSeek = 0;
    renderPlayback();
  });
  audio.addEventListener('timeupdate', () => {
    renderPlayback();
    if (Date.now() - lastSaved >= 10000 && !audio.paused) {
      lastSaved = Date.now();
      savePosition();
    }
  });
  audio.addEventListener('play', renderPlayback);
  audio.addEventListener('playing', () => {
    message('Playing · يستمر التشغيل عند إغلاق الجزيرة');
    renderPlayback();
  });
  audio.addEventListener('pause', () => {
    savePosition();
    renderPlayback();
  });
  audio.addEventListener('durationchange', renderPlayback);
  audio.addEventListener('waiting', () => {
    if (requested) message('Buffering…');
  });
  audio.addEventListener('error', () => {
    if (audio.getAttribute('src')) {
      requested = false;
      message(
        'Recitation unavailable or connection interrupted. Press Play to retry or choose another reciter.',
      );
      renderPlayback();
    }
  });
  audio.addEventListener('ended', () => {
    save({ position: 0 });
    if (prefs.repeat === 'one') return void start();
    if (prefs.autoNext && selectedMoshaf) {
      const next = selectedMoshaf.surahs[selectedMoshaf.surahs.indexOf(prefs.surah) + 1];
      if (next) return void start(next);
      if (prefs.repeat === 'all') return void start(selectedMoshaf.surahs[0]);
    }
    requested = false;
    message('Recitation complete.');
    renderPlayback();
  });
  function sync() {
    if (visible()) {
      if (!catalog && !loading) void load();
      renderPlayback();
    }
  }
  window.addEventListener('island:tab', sync);
  window.addEventListener('island:mode', sync);
  window.addEventListener('island:visibility', sync);
  document.addEventListener('visibilitychange', sync);
  bridge.performance.onRelease(() => {
    if (audio.paused) unload();
    if (!visible()) {
      catalog = null;
      $('#qr-reciters').replaceChildren();
      $('#qr-surahs').replaceChildren();
    }
  });
  window.addEventListener('beforeunload', savePosition);
  renderPlayback();
  sync();
}
