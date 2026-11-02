import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioUrl,
  normalizeCatalog,
  normalizeSearch,
  restoreCatalog,
  safeAudioServer,
  CATALOG_TTL,
} from '../../src/modules/quran/domain/catalog';
import { createQuranService, sanitizeQuranPreferences } from '../../src/modules/quran/domain/service';
import { effectiveFeatures } from '../../src/modules/performance/domain/boost';
import { DEFAULTS } from '../../src/modules/settings/domain/features';
import { createFeatureService } from '../../src/modules/settings/domain/service';
import type { SettingsStore } from '../../src/shared/contracts/storage';
import { apiFixture, quranFixture } from '../fixtures/quran';
function storage() {
  const data = new Map<string, unknown>();
  const store: SettingsStore = {
    load: <T>(key: string, fallback: T) => structuredClone(data.get(key) ?? fallback) as T,
    save: (key, value) => {
      data.set(key, structuredClone(value));
    },
  };
  return { store, data };
}
test('Quran catalog validates recording origins, surah availability and malformed cache', () => {
  const fixture = quranFixture();
  assert.equal(restoreCatalog(fixture)?.reciters.length, 2);
  assert.equal(restoreCatalog({ ...fixture, surahs: [] }), null);
  for (const url of [
    'http://server1.mp3quran.net/a/',
    'https://mp3quran.net.evil.com/a/',
    'file:///a/',
    'https://user@cdn.mp3quran.net/a/',
    'https://cdn.mp3quran.net/a/?q=x',
    'https://cdn.mp3quran.net/a/../bad.mp3',
  ])
    assert.equal(safeAudioServer(url), null, url);
  assert.equal(audioUrl(fixture, 1, 10, 2), 'https://cdn.mp3quran.net/audio/test/r1/002.mp3');
  assert.throws(() => audioUrl(fixture, 1, 11, 2));
  assert.throws(() => audioUrl(fixture, 2, 10, 1));
  assert.throws(() => audioUrl(fixture, 1, 10, '../001'));
});
test('Quran catalog supports missing translations and Arabic diacritic-insensitive search', () => {
  const catalog = normalizeCatalog(
    apiFixture('reciters?language=ar'),
    null,
    apiFixture('suwar?language=ar'),
    null,
    100,
  );
  assert.equal(catalog.reciters[0].english, '');
  assert.equal(catalog.surahs.length, 114);
  assert.equal(normalizeSearch('إِبْرَاهِيم الـأخضر'), 'ابراهيم الاخضر');
});
test('Quran preferences reject invalid values and bound history-independent favorites and positions', () => {
  const p = sanitizeQuranPreferences({
    volume: 9,
    position: -100,
    surah: 200,
    reciterId: NaN,
    repeat: 'bad',
    autoNext: 'yes',
    favorites: [1, 1, 2, -1, '3', Infinity],
  });
  assert.equal(p.volume, 1);
  assert.equal(p.position, 0);
  assert.equal(p.surah, 114);
  assert.equal(p.repeat, 'off');
  assert.deepEqual(p.favorites, [1, 2]);
});
test('Quran requests coalesce and a valid cache avoids network after reload and memory release', async () => {
  const { store } = storage();
  let calls = 0;
  const request = async (endpoint: string) => {
    calls++;
    return apiFixture(endpoint);
  };
  const service = createQuranService(store, request);
  await Promise.all([service.catalog(), service.catalog()]);
  assert.equal(calls, 4);
  const snapshot = await service.catalog();
  snapshot.reciters.length = 0;
  assert.equal((await service.catalog()).reciters.length, 2);
  service.releaseMemory();
  await service.catalog();
  await createQuranService(store, request).catalog();
  assert.equal(calls, 4);
});
test('offline Quran uses stale metadata and cache cleanup preserves favorites and listening progress', async () => {
  const { store } = storage();
  const now = Date.now();
  store.save('quran-catalog.json', quranFixture(now - CATALOG_TTL - 1));
  const service = createQuranService(
    store,
    async () => {
      throw Error('offline');
    },
    () => now,
  );
  service.savePreferences({ favorites: [2], position: 42 });
  assert.equal((await service.catalog()).stale, true);
  service.clearCache();
  await assert.rejects(service.catalog(), /Could not load reciters/);
  assert.deepEqual(service.getPreferences().favorites, [2]);
  assert.equal(service.getPreferences().position, 42);
});
test('clearing the Quran catalog during a request prevents an in-flight response from repopulating disk', async () => {
  const { store, data } = storage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = createQuranService(store, async (endpoint) => {
    await gate;
    return apiFixture(endpoint);
  });
  const pending = service.catalog();
  service.clearCache();
  release();
  await pending;
  assert.equal(data.get('quran-catalog.json'), null);
});
test('Boost is a reversible runtime layer that preserves saved edits and functional features', () => {
  const { store } = storage();
  const features = createFeatureService(store);
  features.set({ boostMode: true, themePreset: 'rose', liquidReflections: true, notificationDrop: true });
  const active = effectiveFeatures(features.get());
  assert.equal(active.reduceTransparency, true);
  assert.equal(active.motionPreset, 'reduced');
  assert.equal(active.notificationDrop, false);
  assert.equal(active.tabQuran, true);
  assert.equal(active.reminders, DEFAULTS.reminders);
  assert.equal(features.get().liquidReflections, true);
  features.set({ themePreset: 'lagoon', boostMode: false });
  const restored = effectiveFeatures(features.get());
  assert.equal(restored.themePreset, 'lagoon');
  assert.equal(restored.notificationDrop, true);
  assert.equal(restored.reduceTransparency, false);
});
