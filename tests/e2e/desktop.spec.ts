import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

async function captureSettled(page: Page, filename: string) {
  await page.evaluate(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: filename });
}

test.describe.serial('Electron application', () => {
  let app: ElectronApplication;
  let island: Page;
  let profile: string;
  const errors: string[] = [];
  test.beforeAll(async () => {
    profile = await mkdtemp(path.join(tmpdir(), 'nova-e2e-'));
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
    await writeFile(path.join(profile, 'notes.json'), JSON.stringify({ text: '', todos: [] }));
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
    app.on('window', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    island = await app.firstWindow();
    island.on('pageerror', (error) => errors.push(error.message));
    await expect.poll(async () => readFile(path.join(profile, 'nova.log'), 'utf8')).toContain('island ready');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test.afterAll(async () => {
    if (app) await app.close();
    if (profile) await rm(profile, { recursive: true, force: true });
  });
  test('loads sandboxed preload and live native bridge', async () => {
    expect(await island.evaluate(() => typeof (window as Window & { require?: unknown }).require)).toBe(
      'undefined',
    );
    expect(await island.evaluate(() => typeof window.nova.notes.get)).toBe('function');
    await expect(island.locator('#v-media')).toBeVisible();
    await island.evaluate(() => window.nova.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.waitForLoadState();
    await expect
      .poll(() => settings.evaluate(() => window.prefs.bridgeStatus()), { timeout: 20_000 })
      .toMatchObject({ state: 'ok', engine: 'helper' });
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('notes and todo actions persist through IPC', async () => {
    await island.locator('.tab[data-tab="notes"]').click();
    await island.locator('#notes-text').fill('TypeScript migration\nمرحبا بالعالم');
    await expect
      .poll(() => island.evaluate(() => window.nova.notes.get()))
      .toMatchObject({ text: 'TypeScript migration\nمرحبا بالعالم' });
    await island.locator('[data-notes-view="todos"]').click();
    await island.locator('#todo-input').fill('Verify module boundaries');
    await island.locator('#todo-input').press('Enter');
    await expect(island.locator('.todo-label')).toHaveText('Verify module boundaries');
    await island.locator('.todo-chk').click();
    await expect
      .poll(() => island.evaluate(() => window.nova.notes.get()))
      .toMatchObject({ todos: [{ text: 'Verify module boundaries', done: true }] });
    expect(JSON.parse(await readFile(path.join(profile, 'notes.json'), 'utf8')).todos[0].done).toBe(true);
  });
  test('themes and settings synchronize between windows', async () => {
    await island.locator('.tab[data-tab="tools"]').click();
    const theme = island.locator('.theme-chip').nth(1);
    const preset = await theme.getAttribute('data-theme');
    await theme.click();
    await expect(island.locator('html')).toHaveAttribute('data-theme', preset!);
    await island.evaluate(() => window.nova.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.waitForLoadState();
    await settings.evaluate(() => window.prefs.setFeatures({ tabNotes: false, themePreset: 'midnight' }));
    await expect(island.locator('.tab[data-tab="notes"]')).toBeHidden();
    await expect(island.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await expect(settings.locator('[data-feature="tabNotes"]')).not.toBeChecked();
    await settings.evaluate(() => window.prefs.setFeatures({ tabNotes: true }));
    await expect(island.locator('.tab[data-tab="notes"]')).toBeVisible();
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('timer and stopwatch controls retain state', async () => {
    await island.locator('.tab[data-tab="timer"]').click();
    await island.locator('[data-min="5"]').click();
    await island.locator('#tm-start').click();
    await expect(island.locator('#tm-start')).toHaveText('Pause');
    await island.locator('#tm-start').click();
    await expect(island.locator('#tm-state')).toHaveText('Paused');
    await island.locator('#tm-reset').click();
    await island.locator('#tm-mode-sw').click();
    await island.locator('#sw-start').click();
    await expect(island.locator('#sw-start')).toHaveText('Pause');
    await island.locator('#sw-lap').click();
    await expect(island.locator('.sw-lap-row')).toHaveCount(1);
    await island.locator('#sw-start').click();
    await island.locator('#sw-reset').click();
    await expect(island.locator('.sw-lap-row')).toHaveCount(0);
  });
  test('custom timers can be extended and reset', async () => {
    await island.locator('.tab[data-tab="timer"]').click();
    await island.locator('#tm-mode-timer').click();
    await island.locator('#tm-minutes').click();
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocusable()))
      .toBe(true);
    await island.locator('#tm-minutes').fill('17');
    await island.locator('#tm-custom button').click();
    await expect(island.locator('#tm-digits')).toHaveText('17:00');
    await island.locator('[data-extend="5"]').click();
    await expect(island.locator('#tm-digits')).toHaveText('22:00');
    await island.locator('#tm-start').click();
    await expect(island.locator('#island')).toHaveClass(/timer-running/);
    await island.locator('[data-extend="1"]').click();
    await expect(island.locator('#tm-digits')).toHaveText(/2[23]:/);
    await island.locator('#tm-start').click();
    await expect(island.locator('#tm-start')).toHaveText('Resume');
    await captureSettled(island, 'artifacts/enhanced-timer.png');
    expect(
      await island.locator('.clip').evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop })),
    ).toEqual({ x: 0, y: 0 });
    await island.locator('#tm-reset').click();
    await expect(island.locator('[data-extend="5"]')).toBeDisabled();
  });
  test('quick actions support search, keyboard selection, empty results, and focus restoration', async () => {
    await island.locator('#open-commands').click();
    await expect(island.locator('#command-query')).toBeFocused();
    await island.locator('#command-query').fill('lagoon theme');
    await expect(island.locator('#command-results [role="option"]')).toHaveCount(1);
    await island.locator('#command-query').press('Enter');
    await expect(island.locator('#command-panel')).toBeHidden();
    await expect(island.locator('html')).toHaveAttribute('data-theme', 'lagoon');
    await expect(island.locator('#open-commands')).toBeFocused();
    await island.locator('#open-commands').click();
    await island.locator('#command-query').fill('no-such-action');
    await expect(island.locator('.command-empty')).toBeVisible();
    await island.locator('#command-query').fill('theme');
    await island.locator('#command-query').press('ArrowDown');
    await expect(island.locator('#command-theme-cyber')).toHaveAttribute('aria-selected', 'true');
    await captureSettled(island, 'artifacts/quick-actions.png');
    await island.locator('#command-query').press('Escape');
    await expect(island.locator('#command-panel')).toBeHidden();
    await expect(island.locator('.topbar')).not.toHaveAttribute('inert');
  });
  test('appearance controls synchronize and respect system reduced motion', async () => {
    await island.evaluate(() => window.nova.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.waitForLoadState();
    await settings.locator('[data-page="appearance"]').click();
    await settings.locator('[data-preset="rose"]').click();
    await expect(island.locator('html')).toHaveAttribute('data-theme', 'rose');
    await expect(settings.locator('[data-preset="rose"]')).toHaveAttribute('aria-pressed', 'true');
    await settings.locator('[data-motion-preset="reduced"]').click();
    await expect(island.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await settings.locator('[data-feature="colorGlow"]').uncheck();
    await expect(island.locator('html')).toHaveAttribute('data-glow', 'false');
    await settings.locator('[data-motion-preset="expressive"]').click();
    await island.emulateMedia({ reducedMotion: 'reduce' });
    await expect(island.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await island.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(island.locator('html')).toHaveAttribute('data-motion', 'expressive');
    await settings.locator('[data-feature="colorGlow"]').check();
    await settings.locator('#content').evaluate((element) => {
      element.scrollTop = 0;
    });
    await captureSettled(settings, 'artifacts/appearance-settings.png');
    await settings.evaluate(() => window.prefs.window('close'));
    await island.locator('.tab[data-tab="tools"]').click();
    await expect(island.locator('.theme-chip')).toHaveCount(8);
    await captureSettled(island, 'artifacts/enhanced-tools.png');
  });
  test('glass reflections pause when disabled and transparency follows accessibility preferences', async () => {
    await island.locator('#tool-snip').hover();
    await expect
      .poll(() =>
        island
          .locator('#island')
          .evaluate((element) => (element as HTMLElement).style.getPropertyValue('--light-x')),
      )
      .not.toBe('');
    await island.evaluate(() => window.nova.setFeatures({ liquidReflections: false }));
    await expect(island.locator('html')).toHaveAttribute('data-reflections', 'false');
    await expect
      .poll(() =>
        island
          .locator('#island')
          .evaluate((element) => (element as HTMLElement).style.getPropertyValue('--light-x')),
      )
      .toBe('');
    await island.evaluate(() => window.nova.setFeatures({ reduceTransparency: true }));
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'reduced');
    await expect(island.locator('.tint')).toHaveCSS('backdrop-filter', 'none');
    await island.evaluate(() =>
      window.nova.setFeatures({ reduceTransparency: false, liquidReflections: true }),
    );
    await island.emulateMedia({ contrast: 'more' });
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'reduced');
    await island.emulateMedia({ contrast: 'no-preference' });
    await expect(island.locator('html')).toHaveAttribute('data-transparency', 'glass');
  });
  test('update center opens directly and renders simulated progress, retry, and restart states', async () => {
    await island.evaluate(() => window.nova.updates.openCenter());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    await settings.waitForLoadState();
    await expect(settings.locator('#updates')).toBeVisible();
    const status = await settings.evaluate(() => window.prefs.updates.status());
    const packageInfo = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
    expect(status.currentVersion).toBe(packageInfo.version);
    if (status.distribution === 'development') {
      await expect(settings.locator('#update-title')).toHaveText('Development build');
      await expect(settings.locator('#update-check')).toBeHidden();
      expect((await settings.evaluate(() => window.prefs.updates.check())).phase).toBe('unavailable');
    }
    const simulated = {
      ...status,
      distribution: 'installed' as const,
      phase: 'downloading' as const,
      availableVersion: '2.2.0',
      percent: 42,
      transferred: 42 * 1048576,
      total: 100 * 1048576,
      bytesPerSecond: 2 * 1048576,
    };
    await app.evaluate(({ BrowserWindow }, data) => {
      BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('update-state', data));
    }, simulated);
    await expect(settings.locator('#update-progress')).toHaveAttribute('value', '42');
    await expect(settings.locator('#update-description')).toContainText('42%');
    await expect(settings.locator('#update-check')).toBeDisabled();
    await app.evaluate(({ BrowserWindow }, data) => {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-state', {
          ...data,
          phase: 'error',
          message: 'You appear to be offline. Check your connection and try again.',
        }),
      );
    }, simulated);
    await expect(settings.locator('#update-check')).toHaveText('Try again');
    await expect(settings.locator('#update-check')).toBeEnabled();
    await app.evaluate(({ BrowserWindow }, data) => {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-state', { ...data, phase: 'ready', percent: 100 }),
      );
    }, simulated);
    await expect(settings.locator('#update-restart')).toBeVisible();
    await expect(island.locator('#open-commands')).toHaveClass(/update-ready/);
    await settings.screenshot({ path: 'artifacts/simulated-update-ready.png', animations: 'disabled' });
    await app.evaluate(({ BrowserWindow }, data) => {
      BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('update-state', data));
    }, status);
    await settings.evaluate(() => window.prefs.window('close'));
  });
  test('idle panels stop repainting and an off-tab stopwatch keeps accurate elapsed time', async () => {
    await island.evaluate(() => window.nova.setFeatures({ reduceTransparency: true }));
    await island.locator('.tab[data-tab="timer"]').click();
    await island.locator('#tm-mode-sw').click();
    await island.locator('#sw-reset').click();
    await island.locator('#sw-start').click();
    await expect(island.locator('#sw-digits')).not.toHaveText('00:00.00');
    await island.locator('.tab[data-tab="tools"]').click();
    await captureSettled(island, 'artifacts/performance-tools.png');
    // Observe behavior, without tying the test to a scheduler implementation or machine CPU speed.
    const result = await island.evaluate(async () => {
      let frames = 0;
      let stopwatchMutations = 0;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        frames++;
        return request(callback);
      };
      const observer = new MutationObserver((records) => {
        stopwatchMutations += records.length;
      });
      observer.observe(document.querySelector('#sw-digits')!, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 1600));
      frames = 0;
      stopwatchMutations = 0;
      await new Promise((resolve) => setTimeout(resolve, 2200));
      observer.disconnect();
      window.requestAnimationFrame = request;
      return { frames, stopwatchMutations };
    });
    expect(result).toEqual({ frames: 0, stopwatchMutations: 0 });
    await island.locator('.tab[data-tab="timer"]').click();
    await island.locator('#sw-start').click();
    const seconds = await island.locator('#sw-digits').evaluate((el) => {
      const [minutes, seconds] = el.textContent!.split(':').map(Number);
      return minutes * 60 + seconds;
    });
    expect(seconds).toBeGreaterThan(3.8);
    await island.locator('#sw-reset').click();
    await island.locator('#tm-mode-timer').click();
    await island.evaluate(() => window.nova.setFeatures({ reduceTransparency: false }));
  });
  test('lock and sleep pause the overlay until both conditions are cleared', async () => {
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('lock-screen'));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()))
      .toBe(false);
    await expect(island.locator('html')).toHaveAttribute('data-page-hidden', 'true');
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()))
      .toBe(false);
    await expect(island.locator('html')).toHaveAttribute('data-page-hidden', 'true');
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('unlock-screen'));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()))
      .toBe(true);
    await expect(island.locator('html')).toHaveAttribute('data-page-hidden', 'false');
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test('renders Arabic, keeps errors clear, and captures the migrated UI', async () => {
    await island.locator('.tab[data-tab="prayer"]').click();
    await expect(island.locator('#pr-list .pr-row')).toHaveCount(6);
    await expect(island.locator('#pr-list')).toContainText('الفجر');
    await island.screenshot({ path: 'artifacts/electron-prayer.png', animations: 'disabled' });
    await island.locator('.tab[data-tab="notes"]').click();
    await island.screenshot({ path: 'artifacts/electron-notes.png', animations: 'disabled' });
    const log = await readFile(path.join(profile, 'nova.log'), 'utf8');
    expect(log).not.toMatch(/\bCRASH\b|\bREJECT\b|\[renderer\]|\[preload-error\]/);
    expect(errors).toEqual([]);
  });
  test('a stationary cursor still opens the island after hover intent and leaving collapses it', async () => {
    const original = await app.evaluateHandle(({ screen }) => screen.getCursorScreenPoint);
    try {
      await app.evaluate(({ screen, BrowserWindow }) => {
        screen.getCursorScreenPoint = () => ({ x: -100000, y: -100000 });
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('hover', false);
        win.webContents.send('toggle');
      });
      await expect(island.locator('#island')).not.toHaveClass(/expanded/);
      await captureSettled(island, 'artifacts/performance-idle.png');
      const rect = await island.locator('#island').boundingBox();
      expect(rect).not.toBeNull();
      await app.evaluate(({ screen, BrowserWindow }, rect) => {
        const bounds = BrowserWindow.getAllWindows()[0].getBounds();
        const point = {
          x: Math.round(bounds.x + rect!.x + rect!.width / 2),
          y: Math.round(bounds.y + rect!.y + rect!.height / 2),
        };
        screen.getCursorScreenPoint = () => point;
      }, rect);
      await expect(island.locator('#island')).toHaveClass(/expanded/);
      await app.evaluate(({ screen }) => {
        screen.getCursorScreenPoint = () => ({ x: -100000, y: -100000 });
      });
      await expect(island.locator('#island')).not.toHaveClass(/expanded/);
    } finally {
      await app.evaluate(({ screen }, original) => {
        screen.getCursorScreenPoint = original;
      }, original);
      await original.dispose();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    }
  });
});
