import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { quranFixture } from '../fixtures/quran';
function silence() {
  const rate = 8000,
    seconds = 12,
    bytes = rate * seconds * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write('RIFF');
  buffer.writeUInt32LE(36 + bytes, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(bytes, 40);
  return buffer;
}
test.describe.serial('Quran and performance', () => {
  let app: ElectronApplication, island: Page, profile: string;
  const errors: string[] = [];
  test.beforeAll(async () => {
    profile = await mkdtemp(path.join(tmpdir(), 'nova-quran-'));
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
    await writeFile(path.join(profile, 'quran-catalog.json'), JSON.stringify(quranFixture()));
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
    await expect.poll(() => readFile(path.join(profile, 'nova.log'), 'utf8')).toContain('island ready');
    await island.route('https://**.mp3quran.net/**/*.mp3', (route) => {
      const bytes = silence(),
        range = route
          .request()
          .headers()
          .range?.match(/bytes=(\d+)-(\d*)/);
      const start = range ? Number(range[1]) : 0,
        end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      return route.fulfill({
        status: range ? 206 : 200,
        contentType: 'audio/wav',
        body: bytes.subarray(start, end + 1),
        headers: {
          'accept-ranges': 'bytes',
          'content-length': String(end - start + 1),
          ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}),
        },
      });
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setAudioMuted(true),
    );
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test.afterAll(async () => {
    if (app) await app.close();
    if (profile) await rm(profile, { recursive: true, force: true });
  });
  test('Quran loads lazily, searches Arabic and English, and filters unavailable surahs', async () => {
    await expect(island.locator('#qr-reciters button')).toHaveCount(0);
    await island.locator('[data-tab="quran"]').click();
    await expect(island.locator('.qr-reciter')).toHaveCount(2);
    await expect(island.locator('#qr-audio')).not.toHaveAttribute('src');
    await island.locator('#qr-reciter-search').fill('hussary');
    await expect(island.locator('.qr-reciter')).toHaveCount(1);
    await island.locator('.qr-reciter').click();
    await expect(island.locator('#qr-selected')).toHaveText('محمود خليل الحصري');
    await island.locator('#qr-star').click();
    await expect
      .poll(() => island.evaluate(() => window.nova.quran.preferences()))
      .toMatchObject({ favorites: [2] });
    await island.locator('#qr-reciter-search').fill('');
    await island.locator('#qr-favorites').click();
    await expect(island.locator('.qr-reciter')).toHaveCount(1);
    await island.locator('#qr-favorites').click();
    await island.locator('[data-reciter="1"]').click();
    await island.locator('#qr-moshaf').selectOption('11');
    await expect(island.locator('[data-surah]')).toHaveCount(2);
    await expect(island.locator('[data-surah="2"]')).toHaveCount(0);
    await island.locator('#qr-surah-search').fill('آل عمران');
    await expect(island.locator('[data-surah]')).toHaveCount(1);
    await island.locator('#qr-surah-search').fill('');
    await island.locator('#qr-moshaf').selectOption('10');
    await island.screenshot({ path: 'artifacts/quran-library.png', animations: 'disabled' });
  });
  test('real audio element plays, seeks, pauses, advances and releases its buffer', async () => {
    await island.locator('[data-surah="1"]').click();
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => !(el as HTMLAudioElement).paused))
      .toBe(true);
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).duration))
      .toBeGreaterThan(10);
    await island.locator('#qr-play').click();
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(true);
    await island.locator('#qr-seek').fill('4');
    await expect
      .poll(() => island.evaluate(() => window.nova.quran.preferences()))
      .toMatchObject({ position: 4 });
    await island.locator('#qr-play').click();
    await island.locator('#qr-audio').evaluate((el) => {
      const a = el as HTMLAudioElement;
      a.currentTime = a.duration - 0.05;
    });
    await expect(island.locator('#qr-audio')).toHaveAttribute('src', /002\.mp3$/);
    await island.locator('#qr-repeat').selectOption('one');
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).readyState))
      .toBeGreaterThan(1);
    await island.locator('#qr-audio').evaluate((el) => {
      const a = el as HTMLAudioElement;
      a.currentTime = a.duration - 0.05;
    });
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).currentTime))
      .toBeLessThan(3);
    await island.locator('#qr-stop').click();
    await expect(island.locator('#qr-audio')).not.toHaveAttribute('src');
    await expect
      .poll(() => island.evaluate(() => window.nova.quran.preferences()))
      .toMatchObject({ position: 0 });
    await island.locator('#qr-repeat').selectOption('off');
  });
  test('background listening continues without off-tab player DOM updates', async () => {
    await island.locator('[data-surah="1"]').click();
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => !(el as HTMLAudioElement).paused))
      .toBe(true);
    await island.locator('[data-tab="tools"]').click();
    const changes = await island.evaluate(async () => {
      let n = 0;
      const observer = new MutationObserver((records) => {
        n += records.length;
      });
      observer.observe(document.querySelector('.quran-player')!, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      observer.disconnect();
      return n;
    });
    expect(changes).toBe(0);
    const time = await island.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).currentTime);
    expect(time).toBeGreaterThan(0);
    await island.evaluate(() => window.nova.performance.clean('memory'));
    await expect
      .poll(() => island.locator('#qr-audio').evaluate((el) => !(el as HTMLAudioElement).paused))
      .toBe(true);
    await island.locator('[data-tab="quran"]').click();
    await island.locator('#qr-play').click();
    await island.evaluate(() => window.nova.performance.clean('memory'));
    await expect(island.locator('#qr-audio')).not.toHaveAttribute('src');
    await expect
      .poll(() => island.evaluate(() => window.nova.quran.preferences()))
      .toMatchObject({ favorites: [2] });
  });
  test('Boost stops captures and restores preferences; cleanup preserves personal data', async () => {
    await island.evaluate(() => window.nova.notes.save({ text: 'Keep this note', todos: [] }));
    await island.evaluate(() => window.nova.performance.open());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    settings.on('pageerror', (error) => errors.push(error.message));
    await expect(settings.locator('#performance')).toBeVisible();
    await expect(settings.locator('#perf-memory')).toContainText('MiB');
    await settings.locator('[data-feature="boostMode"]').check();
    await expect(island.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'reduced');
    await expect.poll(() => island.locator('#bd').evaluate((el) => (el as HTMLCanvasElement).width)).toBe(1);
    expect((await island.evaluate(() => window.nova.features())).reduceTransparency).toBe(false);
    await settings.locator('[data-clean="memory"]').click();
    await expect(settings.locator('#perf-status')).toContainText('Unused resources released');
    await settings.screenshot({ path: 'artifacts/performance-boost.png', animations: 'disabled' });
    await settings.locator('[data-clean="cache"]').click();
    await expect(settings.locator('#perf-status')).toContainText('browser cache removed');
    expect(JSON.parse(await readFile(path.join(profile, 'quran-catalog.json'), 'utf8'))).toBeNull();
    expect((await island.evaluate(() => window.nova.quran.preferences())).favorites).toEqual([2]);
    expect((await island.evaluate(() => window.nova.notes.get())).text).toBe('Keep this note');
    await settings.locator('[data-feature="boostMode"]').uncheck();
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'glass');
    await settings.evaluate(() => window.prefs.window('close'));
    expect(errors).toEqual([]);
  });
});
