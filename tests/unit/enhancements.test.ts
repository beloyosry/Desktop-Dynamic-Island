import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateController, updateError } from '../../src/modules/updates/domain/controller';
import type { Distribution, UpdateState } from '../../src/modules/updates/domain/types';
import { sanitizeFeatures } from '../../src/modules/settings/domain/service';
import { searchActions } from '../../src/modules/commands/domain/search';
import { timerMinutes } from '../../src/modules/timer/domain/duration';

function updater(distribution: Distribution = 'installed', check: () => Promise<void> = async () => {}) {
  const states: UpdateState[] = [];
  let installs = 0;
  let checks = 0;
  let automatic = false;
  const controller = createUpdateController({
    version: '2.1.0',
    distribution,
    now: () => 12345,
    publish: (state) => states.push(state),
    transport: {
      check: async () => {
        checks++;
        await check();
      },
      install: () => {
        installs++;
      },
      configure: (enabled) => {
        automatic = enabled;
      },
    },
  });
  return {
    controller,
    states,
    get installs() {
      return installs;
    },
    get checks() {
      return checks;
    },
    get automatic() {
      return automatic;
    },
  };
}
test('manual update checks work with automatic updates off and concurrent checks are coalesced', async () => {
  let finish!: () => void;
  const task = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const service = updater('installed', () => task);
  service.controller.setAutomatic(false);
  const first = service.controller.check();
  const second = await service.controller.check();
  assert.equal(second.phase, 'checking');
  assert.equal(service.checks, 1);
  service.controller.receive({ type: 'current' });
  finish();
  assert.equal((await first).phase, 'current');
  assert.equal(service.controller.snapshot().lastChecked, 12345);
  assert.equal(service.automatic, false);
});
test('download progress leads to one guarded restart; repeated checks cannot interrupt it', async () => {
  const service = updater();
  service.controller.install();
  assert.equal(service.installs, 0);
  service.controller.receive({ type: 'available', version: '2.2.0' });
  service.controller.receive({
    type: 'progress',
    percent: 52.3,
    transferred: 52,
    total: 100,
    bytesPerSecond: 10,
  });
  assert.equal(service.controller.snapshot().percent, 52.3);
  await service.controller.check();
  assert.equal(service.checks, 0);
  service.controller.receive({ type: 'ready', version: '2.2.0' });
  service.controller.receive({
    type: 'progress',
    percent: 90,
    transferred: 90,
    total: 100,
    bytesPerSecond: 10,
  });
  assert.equal(service.controller.snapshot().percent, 100);
  service.controller.install();
  service.controller.install();
  assert.equal(service.installs, 1);
  assert.equal(service.controller.snapshot().phase, 'installing');
});
test('offline checks recover on retry without exposing server responses', async () => {
  let failed = true;
  const service = updater('installed', async () => {
    if (failed) throw new Error('ENOTFOUND secret headers');
  });
  assert.equal((await service.controller.check()).phase, 'error');
  assert.match(service.controller.snapshot().message, /offline/);
  assert.doesNotMatch(service.controller.snapshot().message, /secret/);
  failed = false;
  await service.controller.check();
  service.controller.receive({ type: 'current' });
  assert.equal(service.controller.snapshot().phase, 'current');
  assert.match(updateError(new Error('404 latest.yml')), /No update release/);
  assert.match(updateError(new Error('sha512 checksum')), /verified/);
});
test('development and portable distributions never check or install', async () => {
  for (const distribution of ['portable', 'development'] as const) {
    const service = updater(distribution);
    service.controller.setAutomatic(true);
    assert.equal((await service.controller.check()).phase, 'unavailable');
    service.controller.receive({ type: 'ready', version: '9.0.0' });
    service.controller.install();
    assert.equal(service.installs, 0);
    assert.equal(service.checks, 0);
  }
});
test('changing automatic mode keeps a downloaded update ready and snapshots are isolated', () => {
  const service = updater();
  service.controller.receive({ type: 'ready', version: '2.2.0' });
  service.controller.setAutomatic(false);
  const state = service.controller.snapshot();
  state.phase = 'error';
  assert.equal(service.controller.snapshot().phase, 'ready');
  assert.equal(service.automatic, false);
});
test('appearance settings reject unknown palettes and motion styles', () => {
  assert.deepEqual(sanitizeFeatures({ themePreset: 'invalid', motionPreset: 'fast', colorGlow: 'yes' }), {});
  assert.deepEqual(sanitizeFeatures({ themePreset: 'rose', motionPreset: 'reduced', colorGlow: false }), {
    themePreset: 'rose',
    motionPreset: 'reduced',
    colorGlow: false,
  });
});
test('quick action search matches all words across label, description, and keywords', () => {
  const actions = [
    { id: 'focus', label: 'Start focus', detail: '25 minutes', keywords: 'pomodoro timer' },
    { id: 'theme', label: 'Rose theme', detail: 'Color palette' },
  ];
  assert.equal(searchActions(actions, '  TIMER 25 ')[0]?.id, 'focus');
  assert.equal(searchActions(actions, 'rose palette')[0]?.id, 'theme');
  assert.equal(searchActions(actions, 'missing').length, 0);
  assert.equal(searchActions(actions, '').length, 2);
});
test('custom timers accept only whole minutes inside the supported range', () => {
  for (const value of ['', '0', '-1', '1.5', '241', 'Infinity', 'abc'])
    assert.equal(timerMinutes(value), null);
  assert.equal(timerMinutes(' 15 '), 15);
  assert.equal(timerMinutes('240'), 240);
});
