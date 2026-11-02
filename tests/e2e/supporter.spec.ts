import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SUPPORTER_PROFILES } from '../../scripts/supporter/catalog';

async function withApp(
  run: (app: ElectronApplication, island: Page, settings: Page, folder: string) => Promise<void>,
) {
  const folder = await mkdtemp(path.join(tmpdir(), 'nova-supporter-'));
  let app: ElectronApplication | undefined;
  try {
    await writeFile(
      path.join(folder, 'features.json'),
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
        focusMin: 43,
      }),
    );
    const env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
      NOVA_USER_DATA: folder,
    };
    delete (env as Record<string, string>).ELECTRON_RUN_AS_NODE;
    const executablePath = process.env.NOVA_E2E_EXECUTABLE;
    app = await electron.launch({
      executablePath,
      args: executablePath ? ['--test-mode'] : ['.', '--test-mode'],
      env,
    });
    const island = await app.firstWindow();
    await expect.poll(() => readFile(path.join(folder, 'nova.log'), 'utf8')).toContain('island ready');
    await island.evaluate(() => window.nova.customization.openSettings());
    await expect.poll(() => app!.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await expect(settings.locator('#custom-import')).toBeAttached();
    await run(app, island, settings, folder);
  } finally {
    if (app) await app.close();
    if (
      path.resolve(folder).startsWith(path.resolve(tmpdir()) + path.sep) &&
      path.basename(folder).startsWith('nova-supporter-')
    )
      await rm(folder, { recursive: true, force: true });
  }
}
async function choose(app: ElectronApplication, file: string) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
}
for (const entry of SUPPORTER_PROFILES) {
  test(`${entry.id} pack imports on a clean profile and applies through the saved-profile UI`, async () => {
    await withApp(async (app, island, settings, folder) => {
      const file = path.join(folder, 'pack.json');
      await writeFile(
        file,
        JSON.stringify({
          format: 'dynamic-island-profile-pack',
          version: 1,
          profiles: [{ name: entry.name, features: entry.features }],
        }),
      );
      await choose(app, file);
      const before = await island.evaluate(() => window.nova.features());
      await settings.locator('#custom-import').click();
      await expect(settings.locator('#custom-status')).toHaveText('Setup imported');
      expect(await island.evaluate(() => window.nova.features())).toEqual(before);
      await settings.getByRole('button', { name: `Apply ${entry.name}`, exact: true }).click();
      await expect
        .poll(() => island.evaluate(() => window.nova.features()))
        .toEqual({ ...before, ...entry.features });
      expect((await island.evaluate(() => window.nova.features())).focusMin).toBe(43);
    });
  });
}
test('combined pack preserves user data, survives backup restore, and reports import failures', async () => {
  await withApp(async (app, island, settings, folder) => {
    await island.evaluate(async () => {
      await window.nova.notes.save({
        text: 'ملاحظاتي الخاصة',
        todos: [{ id: 'one', text: 'Keep this task', done: false }],
      });
      await window.nova.customization.saveProfile('Personal setup');
      await window.nova.toolkit.save({
        bookmarks: [{ id: 'link-0', name: 'Docs', url: 'https://example.com/' }],
        clocks: [{ id: 'clock-0', name: 'Cairo', zone: 'Africa/Cairo' }],
      });
      await window.nova.modes.favorite('coding', true);
      await window.nova.quran.save({ favorites: [1, 7], surah: 2, position: 42 });
    });
    await writeFile(path.join(folder, 'apps.json'), JSON.stringify(['saved-app-id']));
    const preserved = ['notes.json', 'toolkit.json', 'apps.json', 'quran.json', 'modes.json'];
    const before = await Promise.all(preserved.map((file) => readFile(path.join(folder, file), 'utf8')));
    const previousFeatures = await island.evaluate(() => window.nova.features());
    const file = path.join(folder, 'pack.json');
    const pack = {
      format: 'dynamic-island-profile-pack',
      version: 1,
      profiles: SUPPORTER_PROFILES.map(({ name, features }) => ({ name, features })),
    };
    await writeFile(file, JSON.stringify(pack));
    await choose(app, file);
    expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toEqual({ ok: true });
    expect(await Promise.all(preserved.map((file) => readFile(path.join(folder, file), 'utf8')))).toEqual(
      before,
    );
    expect(await island.evaluate(() => window.nova.features())).toEqual(previousFeatures);
    expect(await island.evaluate(() => window.nova.quran.preferences())).toMatchObject({
      favorites: [1, 7],
      surah: 2,
      position: 42,
    });
    await settings.evaluate(() => window.prefs.customization.backup('import'));
    expect(await island.evaluate(() => window.nova.customization.profiles())).toHaveLength(7);
    await settings.evaluate(() => window.prefs.customization.backup('export'));
    const backup = JSON.parse(await readFile(file, 'utf8'));
    expect(backup.profiles.filter((profile: { kind?: string }) => profile.kind === 'layout')).toHaveLength(6);
    await island.evaluate(async () => {
      for (const profile of await window.nova.customization.profiles())
        await window.nova.customization.removeProfile(profile.id);
    });
    await settings.evaluate(() => window.prefs.customization.backup('import'));
    expect(await island.evaluate(() => window.nova.customization.profiles())).toHaveLength(7);
    await island.evaluate(() => window.nova.setFeatures({ focusMin: 57, prayerAlerts: false }));
    await settings.getByRole('button', { name: `Apply ${SUPPORTER_PROFILES[0].name}`, exact: true }).click();
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({ focusMin: 57, prayerAlerts: false });
    const snapshot = await island.evaluate(() => window.nova.customization.profiles());
    await writeFile(
      file,
      JSON.stringify({ ...pack, profiles: [{ name: 'Personal setup', features: { panelWidth: 600 } }] }),
    );
    expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('already exists'),
    });
    expect(await island.evaluate(() => window.nova.customization.profiles())).toEqual(snapshot);
    await writeFile(file, '{bad json');
    expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toMatchObject({
      ok: false,
    });
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    });
    expect(await settings.evaluate(() => window.prefs.customization.backup('import'))).toEqual({
      ok: false,
      cancelled: true,
    });
    expect(await island.evaluate(() => window.nova.customization.profiles())).toEqual(snapshot);
    expect(await readFile(path.join(folder, 'nova.log'), 'utf8')).not.toMatch(
      /\bCRASH\b|\bREJECT\b|\[renderer\]|\[preload-error\]/,
    );
  });
});
