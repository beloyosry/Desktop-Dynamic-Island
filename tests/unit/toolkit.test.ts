import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeatureService, sanitizeFeatures } from '../../src/modules/settings/domain/service';
import { DEFAULTS } from '../../src/modules/settings/domain/features';
import { TABS } from '../../src/modules/settings/domain/tabs';
import { createProfileService, parseBackup } from '../../src/modules/customization/domain/service';
import { createToolkitService, safeWebUrl, sanitizeToolkit } from '../../src/modules/toolkit/domain/service';
import { convertUnit, transformText, generatePassword } from '../../src/modules/toolkit/domain/utilities';
import type { SettingsStore } from '../../src/shared/contracts/storage';

const memory = (): SettingsStore => {
  const values = new Map<string, unknown>();
  return {
    load: <T>(key: string, fallback: T) => structuredClone(values.get(key) ?? fallback) as T,
    save: (key, value) => {
      values.set(key, structuredClone(value));
    },
  };
};
test('layout values are bounded, accent and tab IDs are validated, and navigation cannot become empty', () => {
  const values = sanitizeFeatures({
    panelWidth: 9999,
    panelHeight: 2,
    glassOpacity: Infinity,
    customAccent: 'url(https://bad)',
    defaultTab: 'unknown',
    visualDensity: 'invalid',
    tabOrder: 'toolkit,toolkit,unknown,notes',
  });
  assert.equal(values.panelWidth, 700);
  assert.equal(values.panelHeight, 330);
  assert.equal(values.glassOpacity, undefined);
  assert.equal(values.customAccent, undefined);
  assert.equal(values.defaultTab, undefined);
  assert.equal(values.visualDensity, undefined);
  assert.equal(values.tabOrder?.split(',').length, TABS.length);
  assert.ok(values.tabOrder?.startsWith('toolkit,notes,'));
  const store = memory();
  const service = createFeatureService(store);
  service.set(Object.fromEntries(TABS.map((tab) => [tab.feature, false])));
  assert.equal(service.get().tabTools, true);
  assert.equal(createFeatureService(store).get().tabTools, true);
});
test('profiles survive reload, capture independent snapshots, update by name, apply and delete', () => {
  const store = memory();
  const features = createFeatureService(store);
  const profiles = createProfileService(store, features);
  features.set({ panelWidth: 700, themePreset: 'lagoon', customAccent: '#aabbcc' });
  profiles.save('Evening');
  features.set({ panelWidth: 600 });
  const reloaded = createProfileService(store, features);
  reloaded.apply(reloaded.get()[0].id);
  assert.equal(features.get().panelWidth, 700);
  const snapshot = reloaded.get();
  snapshot[0].features.panelWidth = 1;
  assert.equal(reloaded.get()[0].features.panelWidth, 700);
  features.set({ panelWidth: 620 });
  reloaded.save('evening');
  assert.equal(reloaded.get().length, 1);
  assert.equal(reloaded.get()[0].features.panelWidth, 620);
  for (let i = 0; i < 11; i++) reloaded.save(`Extra ${i}`);
  assert.throws(() => reloaded.save('Too many'));
  reloaded.remove(reloaded.get()[0].id);
  assert.equal(reloaded.get().length, 11);
});
test('shortcuts only accept safe web URLs and clocks reject invalid time zones', () => {
  for (const url of [
    'javascript:alert(1)',
    'file:///C:/Windows',
    'data:text/html,test',
    'https://user:pass@example.com',
  ])
    assert.equal(safeWebUrl(url), null);
  assert.equal(safeWebUrl('https://example.com'), 'https://example.com/');
  const store = memory();
  const toolkit = createToolkitService(store);
  toolkit.save({
    bookmarks: [
      { name: 'Docs', url: 'https://example.com' },
      { name: 'Duplicate', url: 'https://example.com/' },
      { name: 'Bad', url: 'javascript:x' },
    ],
    clocks: [
      { name: 'Tokyo', zone: 'Asia/Tokyo' },
      { name: 'Invalid', zone: 'Fake/Zone' },
    ],
  });
  const state = createToolkitService(store).get();
  assert.equal(state.bookmarks.length, 1);
  assert.equal(state.clocks.length, 1);
  assert.equal(state.clocks[0].zone, 'Asia/Tokyo');
  const capped = sanitizeToolkit({
    bookmarks: Array.from({ length: 100 }, (_, index) => ({
      name: `Link ${index}`,
      url: `https://example.com/${index}`,
    })),
  });
  assert.equal(capped.bookmarks.length, 24);
});
test('backup validation rejects unrelated or incomplete files and sanitizes nested content', () => {
  assert.throws(() => parseBackup({}));
  assert.throws(() => parseBackup({ format: 'dynamic-island', version: 99 }));
  assert.throws(() => parseBackup({ format: 'dynamic-island', version: 1, features: {} }));
  const result = parseBackup({
    format: 'dynamic-island',
    version: 1,
    features: { ...DEFAULTS, panelWidth: 10000, startWithWindows: true },
    profiles: [{ name: 'Imported', features: { customAccent: 'bad' } }],
    toolkit: { bookmarks: [{ name: 'Bad', url: 'file:///secret' }], clocks: [] },
  });
  assert.equal(result.features.panelWidth, 700);
  assert.equal(Object.hasOwn(result.features, 'startWithWindows'), false);
  assert.equal(result.profiles[0].features.customAccent, '');
  assert.deepEqual(result.toolkit.bookmarks, []);
});
test('converter handles offsets, exact units, binary data, and invalid values', () => {
  assert.equal(convertUnit(0, 'temperature', 'c', 'f'), 32);
  assert.equal(convertUnit(32, 'temperature', 'f', 'c'), 0);
  assert.equal(convertUnit(100, 'temperature', 'c', 'k'), 373.15);
  assert.equal(convertUnit(1, 'length', 'mi', 'm'), 1609.344);
  assert.equal(convertUnit(1, 'data', 'mib', 'b'), 1048576);
  assert.equal(convertUnit(1, 'time', 'h', 's'), 3600);
  assert.throws(() => convertUnit(NaN, 'mass', 'kg', 'g'));
  assert.throws(() => convertUnit(Number.MAX_VALUE, 'length', 'mi', 'cm'));
  assert.throws(() => convertUnit(1, 'mass', '__proto__', 'g'));
});
test('text tools preserve Unicode, round-trip encodings and do not evaluate input', () => {
  const original = 'مرحباً بالعالم 🌊';
  assert.equal(transformText(transformText(original, 'encode'), 'decode'), original);
  assert.equal(transformText(transformText(original, 'urlEncode'), 'urlDecode'), original);
  const long = '深'.repeat(20000);
  assert.equal(transformText(transformText(long, 'encode'), 'decode'), long);
  assert.equal(transformText(transformText(long, 'urlEncode'), 'urlDecode'), long);
  assert.equal(transformText('a\nb\na', 'unique'), 'a\nb');
  assert.equal(transformText('  hello   world  \n next ', 'trim'), 'hello world\nnext');
  assert.equal(transformText('<script>1</script>', 'upper'), '<SCRIPT>1</SCRIPT>');
  assert.throws(() => transformText('not base64!!!', 'decode'));
});
test('passwords use requested lengths and alphabets with independent random values', () => {
  const a = generatePassword(24, false),
    b = generatePassword(24, false);
  assert.match(a, /^[A-Za-z2-9]{24}$/);
  assert.notEqual(a, b);
  assert.equal(generatePassword(64, true).length, 64);
  assert.throws(() => generatePassword(1, true));
  assert.throws(() => generatePassword(Infinity, true));
});
