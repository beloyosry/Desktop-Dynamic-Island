import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Features } from '../../src/modules/settings/domain/features';

test.describe.serial('Toolkit and personalization', () => {
  let app: ElectronApplication;
  let island: Page;
  let profile: string;
  let initial: Features;
  const errors: string[] = [];
  const openTool = async (id: string) => {
    await island.locator('.tab[data-tab="toolkit"]').click();
    await island.locator(`[data-tool-view="${id}"]`).click();
  };
  test.beforeAll(async () => {
    profile = await mkdtemp(path.join(tmpdir(), 'nova-toolkit-'));
    await writeFile(
      path.join(profile, 'features.json'),
      JSON.stringify({
        autoUpdate: false,
        morningBrief: false,
        welcomeBack: false,
        reminders: false,
        wellbeing: false,
        water: false,
        novaFocus: false,
        prayerAlerts: false,
        addrIsland: false,
        clipboardHistory: false,
        smartClipboard: false,
        screenshotToast: false,
      }),
    );
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
      NOVA_USER_DATA: profile,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const executablePath = process.env.NOVA_E2E_EXECUTABLE;
    app = await electron.launch({
      executablePath,
      args: executablePath ? ['--test-mode'] : ['.', '--test-mode'],
      env,
    });
    island = await app.firstWindow();
    island.on('pageerror', (error) => errors.push(error.message));
    await expect.poll(async () => readFile(path.join(profile, 'nova.log'), 'utf8')).toContain('island ready');
    initial = await island.evaluate(() => window.nova.features());
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test.afterAll(async () => {
    if (app) await app.close();
    if (profile) await rm(profile, { recursive: true, force: true });
  });
  test('calculator, conversions and Unicode text tools work through the visible interface', async () => {
    await openTool('calculator');
    await island.locator('#tk-expression').fill('(128 + 64) * 1.5');
    await island.locator('#tk-expression').press('Enter');
    await expect(island.locator('#tk-calc-result')).toHaveText('288');
    await island.locator('#tk-expression').fill('process.exit()');
    await island.locator('#tk-expression').press('Enter');
    await expect(island.locator('#tk-status')).toContainText('Check the expression');
    await openTool('converter');
    await island.locator('#tk-unit-group').selectOption('temperature');
    await island.locator('#tk-unit-value').fill('100');
    await expect(island.locator('#tk-unit-result')).toHaveText('212 Fahrenheit');
    await openTool('text');
    await island.locator('#tk-text').fill('مرحباً بالعالم 🌊');
    await island.locator('#tk-text-action').selectOption('encode');
    await island.locator('#tk-text-run').click();
    await expect(island.locator('#tk-text')).not.toHaveValue('مرحباً بالعالم 🌊');
    await island.locator('#tk-text-action').selectOption('decode');
    await island.locator('#tk-text-run').click();
    await expect(island.locator('#tk-text')).toHaveValue('مرحباً بالعالم 🌊');
    await island.locator('#tk-text-undo').click();
    await expect(island.locator('#tk-text')).not.toHaveValue('مرحباً بالعالم 🌊');
  });
  test('bookmarks and world clocks persist and invalid URLs and zones are rejected', async () => {
    await openTool('shortcuts');
    await island.locator('#tk-link-name').fill('Project');
    await island.locator('#tk-link-url').fill('https://example.com/docs');
    await island.locator('#tk-link-form button').click();
    await expect(island.locator('.tk-bookmark')).toHaveCount(1);
    await expect
      .poll(async () => JSON.parse(await readFile(path.join(profile, 'toolkit.json'), 'utf8')))
      .toMatchObject({ bookmarks: [{ name: 'Project', url: 'https://example.com/docs' }] });
    await openTool('clocks');
    await island.locator('#tk-clock-name').fill('Tokyo');
    await island.locator('#tk-clock-zone').fill('Fake/Zone');
    await island.locator('#tk-clock-form button').click();
    await expect(island.locator('#tk-status')).toContainText('Use a time zone');
    await island.locator('#tk-clock-zone').fill('Asia/Tokyo');
    await island.locator('#tk-clock-form button').click();
    await expect(island.locator('.tk-clock')).toHaveCount(3);
    await expect
      .poll(() => island.evaluate(() => window.nova.toolkit.get()))
      .toMatchObject({
        clocks: [
          { zone: 'Europe/London' },
          { zone: 'America/New_York' },
          { name: 'Tokyo', zone: 'Asia/Tokyo' },
        ],
      });
    await island.screenshot({ path: 'artifacts/toolkit-clocks.png', animations: 'disabled' });
  });
  test('generated passwords copy with native privacy markers and UUIDs have the expected format', async () => {
    await openTool('generator');
    const previous = await app.evaluateHandle(async ({ clipboard, ClipboardItem }) =>
      Promise.all(
        (await clipboard.read()).map(
          async (item) =>
            new ClipboardItem(
              Object.fromEntries(
                await Promise.all(item.types.map(async (type) => [type, await item.getType(type)])),
              ),
            ),
        ),
      ),
    );
    try {
      await island.locator('#tk-password').click();
      const password = await island.locator('#tk-secret').textContent();
      expect(password).toHaveLength(20);
      await island.locator('#tk-copy-secret').click();
      await expect(island.locator('#tk-status')).toHaveText('Copied');
      const result = await app.evaluate(async ({ clipboard }) => ({
        text: await clipboard.readText(),
        private: await clipboard.has(
          'electron application/osclipboard;format="ExcludeClipboardContentFromMonitorProcessing"',
        ),
        history: await clipboard.has(
          'electron application/osclipboard;format="CanIncludeInClipboardHistory"',
        ),
      }));
      expect(result).toEqual({ text: password, private: true, history: true });
      await island.locator('#tk-uuid').click();
      await expect(island.locator('#tk-secret')).toHaveText(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
      );
    } finally {
      await app.evaluate(async ({ clipboard }, items) => clipboard.write(items), previous);
      await previous.dispose();
    }
  });
  test('layout, tab order, saved profiles and the new icon synchronize between windows', async () => {
    await island.evaluate(() => window.nova.customization.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    settings.on('pageerror', (error) => errors.push(error.message));
    await expect(settings.locator('#personalize')).toBeVisible();
    await expect
      .poll(() =>
        settings.locator('.app-brand-icon').evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(512);
    await settings.locator('[data-custom-range="panelWidth"]').focus();
    await settings.locator('[data-custom-range="panelWidth"]').press('End');
    await settings.locator('[data-custom-range="panelHeight"]').focus();
    await settings.locator('[data-custom-range="panelHeight"]').press('End');
    await expect(island.locator('#island')).toHaveCSS('width', '700px');
    await expect(island.locator('#island')).toHaveCSS('height', '390px');
    await settings.getByRole('button', { name: 'Move Toolkit up', exact: true }).click();
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({ tabOrder: 'media,apps,shelf,tools,notes,prayer,quran,timer,toolkit,system' });
    await settings.locator('#profile-name').fill('My creative desk');
    await settings.locator('#profile-form button').click();
    await expect(settings.locator('#saved-profiles')).toContainText('My creative desk');
    await settings.locator('[data-custom-range="panelWidth"]').press('Home');
    await expect(island.locator('#island')).toHaveCSS('width', '600px');
    await settings.getByRole('button', { name: 'Apply My creative desk', exact: true }).click();
    await expect(island.locator('#island')).toHaveCSS('width', '700px');
    await settings.screenshot({ path: 'artifacts/personalize-settings.png', animations: 'disabled' });
    await settings.locator('[data-custom-range="panelWidth"]').press('Home');
    await settings.locator('[data-custom-range="panelHeight"]').press('Home');
    await openTool('converter');
    await expect(island.locator('#island')).toHaveCSS('width', '600px');
    expect(
      await island.locator('#v-toolkit').evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await island.screenshot({ path: 'artifacts/toolkit-compact.png', animations: 'disabled' });
    await island.evaluate((features) => window.nova.setFeatures(features), initial);
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('customization export and import round-trip through native IPC and reject malformed backups', async () => {
    await island.evaluate(() => window.nova.customization.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.waitForLoadState();
    const file = path.join(profile, 'test-backup.json');
    const originals = await app.evaluateHandle(({ dialog }) => ({
      save: dialog.showSaveDialog,
      open: dialog.showOpenDialog,
    }));
    try {
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      }, file);
      expect(await settings.evaluate(() => window.prefs.customization.backup('export'))).toEqual({
        ok: true,
      });
      const backup = JSON.parse(await readFile(file, 'utf8'));
      expect(backup.format).toBe('dynamic-island');
      expect(backup.profiles[0].name).toBe('My creative desk');
      backup.features.panelWidth = 680;
      backup.features.customAccent = '#67d7bf';
      await writeFile(file, JSON.stringify(backup));
      expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toEqual({
        ok: true,
      });
      await expect(island.locator('#island')).toHaveCSS('width', '680px');
      await expect
        .poll(() => island.evaluate(() => window.nova.features()))
        .toMatchObject({ customAccent: '#67d7bf' });
      await writeFile(file, '{"unexpected":true}');
      expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toMatchObject({
        ok: false,
      });
      expect((await island.evaluate(() => window.nova.features())).panelWidth).toBe(680);
    } finally {
      await app.evaluate(({ dialog }, originals) => {
        dialog.showSaveDialog = originals.save;
        dialog.showOpenDialog = originals.open;
      }, originals);
      await originals.dispose();
    }
    await island.evaluate((features) => window.nova.setFeatures(features), initial);
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('mode library searches, filters and remembers favorites across Settings windows', async () => {
    await island.locator('#open-modes').click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    settings.on('pageerror', (error) => errors.push(error.message));
    await expect(settings.locator('#modes')).toBeVisible();
    await expect(settings.locator('[data-mode-card]')).toHaveCount(16);
    await expect(settings.locator('[data-mod]')).toHaveCount(8);
    await settings.locator('#mode-search').fill('longer text');
    await expect(settings.locator('[data-mode-card]')).toHaveCount(1);
    await expect(settings.locator('[data-mode-card="coding"]')).toBeVisible();
    await settings.getByRole('button', { name: 'Favorite Coding', exact: true }).click();
    await settings.locator('#mode-search').fill('');
    await settings.locator('[data-mode-category="Play"]').click();
    await expect(settings.locator('[data-mode-card]')).toHaveCount(3);
    await settings.locator('[data-mode-category="All"]').click();
    await settings.locator('#mode-favorites').check();
    await expect(settings.locator('[data-mode-card]')).toHaveCount(5);
    await settings.locator('#mode-search').fill('no mode matches this');
    await expect(settings.locator('#mode-empty')).toBeVisible();
    await settings.evaluate(() => window.prefs.window('close'));
    await expect.poll(() => app.windows().length).toBe(1);
    await island.locator('#open-modes').click();
    await expect.poll(() => app.windows().length).toBe(2);
    const reopened = app.windows().find((page) => page !== island)!;
    await expect(reopened.getByRole('button', { name: 'Favorite Coding', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(async () => JSON.parse(await readFile(path.join(profile, 'modes.json'), 'utf8')))
      .toMatchObject({ favorites: ['everyday', 'focus', 'creator', 'minimal', 'coding'] });
    await reopened.screenshot({ path: 'artifacts/modes-library.png', animations: 'disabled' });
    await reopened.locator('#find').fill('Silent touch');
    await expect(reopened.locator('[data-mod="silent"]')).toBeVisible();
    await reopened.locator('#find').fill('');
    await reopened.evaluate(() => window.prefs.window('close'));
  });
  test('mode switching, layered mods and restore synchronize with the island', async () => {
    const baseline = await island.evaluate(() => window.nova.features());
    await island.locator('#open-modes').click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.locator('#mode-search').fill('coding');
    await settings.locator('[data-mode-apply="coding"]').click();
    await expect(settings.locator('#mode-current-name')).toHaveText('Coding');
    await expect(island.locator('[data-tool-panel="text"]')).toBeVisible();
    await expect(island.locator('#island')).toHaveCSS('width', '700px');
    await settings.locator('[data-mode-view="mods"]').click();
    await settings.locator('[data-mod="solid"]').check();
    await settings.locator('[data-mod="silent"]').check();
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'reduced');
    await settings.screenshot({ path: 'artifacts/modes-mods.png', animations: 'disabled' });
    await island.evaluate(() => window.nova.setFeatures({ panelWidth: 690, waterGoal: 12 }));
    await expect(settings.locator('#mode-current-detail')).toContainText('Customized');
    await settings.locator('[data-mode-view="library"]').click();
    await settings.locator('#mode-search').fill('music lounge');
    await settings.locator('[data-mode-apply="music"]').click();
    await expect(island.locator('#v-media')).toBeVisible();
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({ clock24: baseline.clock24, focusMin: baseline.focusMin, reduceTransparency: true });
    await settings.locator('[data-mode-view="mods"]').click();
    await expect(settings.locator('[data-mod="solid"]')).toBeChecked();
    await settings.locator('[data-mod="solid"]').uncheck();
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'glass');
    await settings.locator('#mode-restore').click();
    await expect(settings.locator('#mode-current-name')).toHaveText('Personal setup');
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toEqual({ ...baseline, waterGoal: 12 });
    await island.evaluate((features) => window.nova.setFeatures(features), baseline);
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('presentation suppresses island previews and command actions can restore or toggle mods', async () => {
    const baseline = await island.evaluate(() => window.nova.features());
    await island.locator('#open-modes').click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.locator('#mode-search').fill('presentation');
    await settings.locator('[data-mode-apply="presentation"]').click();
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({
        smartClipboard: false,
        clipboardHistory: false,
        screenshotToast: false,
        trackPeek: false,
        mediaPill: false,
        tabNotes: false,
        hideFullscreen: true,
      });
    await expect(island.locator('.tab[data-tab="notes"]')).toBeHidden();
    await settings.evaluate(() => window.prefs.window('close'));
    await island.locator('#open-commands').click();
    await island.locator('#command-query').fill('return to my setup');
    await island.locator('#command-query').press('Enter');
    await expect.poll(() => island.evaluate(() => window.nova.features())).toEqual(baseline);
    await island.locator('#open-commands').click();
    await island.locator('#command-query').fill('enable pocket size');
    await island.locator('#command-query').press('Enter');
    await expect(island.locator('#island')).toHaveCSS('width', '600px');
    await expect
      .poll(() => island.evaluate(() => window.nova.modes.get()))
      .toMatchObject({ activeId: null, mods: ['compact'], canRestore: true });
    await island.evaluate(async () => {
      const profiles = await window.nova.customization.profiles();
      await window.nova.customization.applyProfile(profiles[0].id);
    });
    await expect
      .poll(() => island.evaluate(() => window.nova.modes.get()))
      .toMatchObject({ activeId: null, mods: [], canRestore: false });
    await island.evaluate((features) => window.nova.setFeatures(features), baseline);
  });
  test('toolkit actions are searchable and no renderer or preload errors were logged', async () => {
    await island.locator('#open-commands').click();
    await island.locator('#command-query').fill('password');
    await island.locator('#command-query').press('Enter');
    await expect(island.locator('[data-tool-panel="generator"]')).toBeVisible();
    expect(errors).toEqual([]);
    expect(await readFile(path.join(profile, 'nova.log'), 'utf8')).not.toMatch(
      /\bCRASH\b|\bREJECT\b|\[renderer\]|\[preload-error\]/,
    );
  });
});
