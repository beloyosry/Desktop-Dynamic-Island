import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModeService } from '../../src/modules/modes/domain/service';
import { MODES, MODIFIERS, findModes } from '../../src/modules/modes/domain/catalog';
import { createFeatureService, sanitizeFeatures } from '../../src/modules/settings/domain/service';
import { TABS } from '../../src/modules/settings/domain/tabs';
import { parseBackup } from '../../src/modules/customization/domain/service';
import type { SettingsStore } from '../../src/shared/contracts/storage';

function setup() {
  const data = new Map<string, unknown>();
  const store: SettingsStore = {
    load: <T>(name: string, fallback: T) => structuredClone(data.get(name) ?? fallback) as T,
    save: (name, value) => {
      data.set(name, structuredClone(value));
    },
  };
  const features = createFeatureService(store);
  const modes = createModeService(store, features);
  return { store, features, modes };
}
test('all 16 modes and 8 mods contain valid settings and usable starting tabs', () => {
  assert.equal(MODES.length, 16);
  assert.equal(MODIFIERS.length, 8);
  assert.equal(new Set(MODES.map((mode) => mode.id)).size, 16);
  for (const mode of MODES) {
    assert.deepEqual(sanitizeFeatures(mode.features), mode.features, mode.id);
    const tab = TABS.find((tab) => tab.id === mode.features.defaultTab)!;
    assert.equal(mode.features[tab.feature], true, mode.id);
    assert.equal(Object.hasOwn(mode.features, 'autoUpdate'), false);
  }
  for (const mod of MODIFIERS) assert.deepEqual(sanitizeFeatures(mod.features), mod.features);
});
test('switching modes restores overridden settings without leaking previous modes', () => {
  const { features, modes } = setup();
  features.set({
    clock24: false,
    soundEffects: true,
    focusMin: 40,
    customAccent: '#abc123',
    panelWidth: 680,
  });
  const original = features.get();
  modes.apply('coding');
  assert.equal(features.get().clock24, true);
  assert.equal(features.get().focusMin, 50);
  modes.apply('music');
  assert.equal(features.get().clock24, false);
  assert.equal(features.get().focusMin, 40);
  features.set({ waterGoal: 12 }); // unrelated preferences remain editable
  modes.restore();
  assert.deepEqual(features.get(), { ...original, waterGoal: 12 });
  assert.equal(modes.get().canRestore, false);
});
test('mods layer over modes and removal reveals the underlying mode or personal setting', () => {
  const { features, modes } = setup();
  const original = features.get();
  modes.setMod('solid', true);
  modes.setMod('compact', true);
  modes.apply('creator');
  assert.equal(features.get().panelWidth, 600);
  assert.equal(features.get().reduceTransparency, true);
  modes.setMod('compact', false);
  assert.equal(features.get().panelWidth, 700);
  modes.setMod('solid', false);
  assert.equal(features.get().reduceTransparency, false);
  modes.apply('minimal');
  modes.setMod('solid', true);
  modes.setMod('solid', false);
  assert.equal(features.get().reduceTransparency, true);
  modes.restore();
  assert.deepEqual(features.get(), original);
});
test('mode sessions, modifiers and restore snapshots survive reload; corrupt sessions are ignored', () => {
  const { store, features, modes } = setup();
  const original = features.get();
  modes.apply('presentation');
  modes.setMod('clock', true);
  const reloaded = createModeService(store, features);
  assert.equal(reloaded.get().activeId, 'presentation');
  assert.deepEqual(reloaded.get().mods, ['clock']);
  reloaded.restore();
  assert.deepEqual(features.get(), original);
  store.save('modes.json', {
    activeId: 'bad',
    mods: ['bad'],
    baseline: [],
    favorites: ['coding', 'coding', '<script>'],
  });
  const bad = createModeService(store, features).get();
  assert.equal(bad.canRestore, false);
  assert.deepEqual(bad.favorites, ['coding']);
});
test('customized mode status is derived from effective settings and reapply restores the preset', () => {
  const { features, modes } = setup();
  modes.apply('gaming');
  features.set({ panelWidth: 690 });
  assert.equal(modes.get().customized, true);
  const previous = modes.get().activation;
  modes.apply('gaming');
  assert.equal(modes.get().customized, false);
  assert.ok(modes.get().activation > previous);
  modes.clear();
  assert.equal(modes.get().activeId, null);
  assert.equal(modes.get().canRestore, false);
});
test('invalid mode/mod requests are inert, favorites are isolated, and backups accept old and new formats', () => {
  const { features, modes } = setup();
  const original = features.get();
  modes.apply('__proto__');
  modes.setMod('solid', 'yes');
  modes.setMod('bad', true);
  assert.deepEqual(features.get(), original);
  assert.equal(modes.get().canRestore, false);
  modes.favorite('coding', true);
  modes.favorite('coding', true);
  const state = modes.get();
  state.favorites.push('bad');
  assert.equal(modes.get().favorites.filter((id) => id === 'coding').length, 1);
  assert.equal(modes.get().favorites.includes('bad'), false);
  const base = { format: 'dynamic-island', version: 1, features: {}, profiles: [], toolkit: {} };
  assert.equal(parseBackup(base).favoriteModes, undefined);
  assert.deepEqual(parseBackup({ ...base, favoriteModes: ['coding', 'coding', 'bad'] }).favoriteModes, [
    'coding',
  ]);
});
test('mode search combines category, favorites and all search terms', () => {
  assert.deepEqual(
    findModes('longer text').map((mode) => mode.id),
    ['coding'],
  );
  assert.equal(findModes('', 'Play').length, 3);
  assert.deepEqual(
    findModes('', 'Work', ['coding', 'gaming']).map((mode) => mode.id),
    ['coding'],
  );
  assert.equal(findModes('nothing matches this').length, 0);
});
