import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfileService, parseBackup } from '../../src/modules/customization/domain/service';
import { parseProfilePack, ProfilePackError } from '../../src/modules/customization/domain/profile-pack';
import { createFeatureService } from '../../src/modules/settings/domain/service';
import { SUPPORTER_PROFILES } from '../../scripts/supporter/catalog';
import { MODES } from '../../src/modules/modes/domain/catalog';
import type { SettingsStore } from '../../src/shared/contracts/storage';

const pack = {
  format: 'dynamic-island-profile-pack',
  version: 1,
  profiles: SUPPORTER_PROFILES.map(({ name, features }) => ({ name, features })),
};
function setup() {
  const values = new Map<string, unknown>();
  const store: SettingsStore = {
    load: <T>(key: string, fallback: T) => structuredClone(values.get(key) ?? fallback) as T,
    save: (key, value) => {
      values.set(key, structuredClone(value));
    },
  };
  const features = createFeatureService(store);
  const profiles = createProfileService(store, features);
  return { values, store, features, profiles };
}
test('all six deliverables validate and differ from each other and built-in layouts', () => {
  assert.equal(parseProfilePack(pack).profiles.length, 6);
  assert.equal(new Set(pack.profiles.map((profile) => profile.features.tabOrder)).size, 6);
  for (const profile of pack.profiles) {
    assert.ok(
      !MODES.some(
        (mode) =>
          mode.features.customAccent === profile.features.customAccent &&
          mode.features.tabOrder === profile.features.tabOrder,
      ),
    );
  }
});
test('pack import adds profiles without changing any other saved data; repeat imports are idempotent', () => {
  const { values, features, profiles } = setup();
  features.set({ autoUpdate: false, prayerAlerts: false, focusMin: 42, customAccent: '#abcdef' });
  profiles.save('My original');
  for (const key of ['notes.json', 'toolkit.json', 'apps.json', 'quran.json', 'modes.json'])
    values.set(key, { sentinel: key });
  const before = structuredClone(values);
  profiles.importPack(pack);
  assert.equal(profiles.get().length, 7);
  assert.deepEqual(profiles.get()[0], (before.get('profiles.json') as unknown[])[0]);
  for (const [key, value] of before) if (key !== 'profiles.json') assert.deepEqual(values.get(key), value);
  const imported = structuredClone(values);
  profiles.importPack(pack);
  assert.deepEqual(values, imported);
});
test('layout-only scope survives reload and backup; applying preserves later privacy and timer edits', () => {
  const { store, features, profiles } = setup();
  profiles.importPack(pack);
  features.set({
    autoUpdate: false,
    prayerAlerts: false,
    clipboardHistory: false,
    focusMin: 43,
    soundEffects: false,
  });
  const backup = parseBackup({
    format: 'dynamic-island',
    version: 1,
    features: features.get(),
    profiles: profiles.get(),
    toolkit: {},
  });
  profiles.replace(backup.profiles);
  const reloaded = createProfileService(store, features);
  for (const profile of reloaded.get()) {
    const before = features.get();
    reloaded.apply(profile.id);
    assert.deepEqual(features.get(), { ...before, ...profile.features });
    assert.equal(features.get().focusMin, 43);
    assert.equal(features.get().autoUpdate, false);
    assert.equal(features.get().prayerAlerts, false);
  }
});
test('capacity and name collisions reject atomically, with single-profile imports still available', () => {
  const { values, profiles } = setup();
  for (let i = 0; i < 7; i++) profiles.save(`Existing ${i}`);
  const before = structuredClone(values);
  assert.throws(() => profiles.importPack(pack), /6 free profile slots; 5 available/);
  assert.deepEqual(values, before);
  profiles.importPack({ ...pack, profiles: [pack.profiles[0]] });
  assert.equal(profiles.get().length, 8);
  const conflict = structuredClone(values);
  assert.throws(
    () =>
      profiles.importPack({
        ...pack,
        profiles: [pack.profiles[1], { ...pack.profiles[0], features: { panelWidth: 700 } }],
      }),
    /already exists/,
  );
  assert.deepEqual(values, conflict);
});
test('invalid or service-changing packs fail without writes', () => {
  const { values, profiles } = setup();
  const bad = [
    null,
    {},
    { ...pack, version: 2 },
    { ...pack, profiles: [] },
    { ...pack, profiles: [pack.profiles[0], pack.profiles[0]] },
    ...[
      [],
      {},
      { autoUpdate: true },
      { customAccent: 'red' },
      { panelWidth: 1 },
      { tabOrder: 'unknown' },
      { motionPreset: 'invalid' },
    ].map((features) => ({ ...pack, profiles: [{ name: 'Bad', features }] })),
  ];
  for (const input of bad) assert.throws(() => profiles.importPack(input), ProfilePackError);
  assert.equal(values.size, 0);
});
