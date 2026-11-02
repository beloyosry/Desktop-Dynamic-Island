import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test.describe.serial('Notification tray', () => {
  let app: ElectronApplication;
  let island: Page;
  let profile: string;
  const errors: string[] = [];
  test.beforeAll(async () => {
    profile = await mkdtemp(path.join(tmpdir(), 'nova-notifications-'));
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
        reduceTransparency: true,
        motionPreset: 'expressive',
        notificationTray: true,
        notificationDrop: true,
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
    await island.emulateMedia({ reducedMotion: 'no-preference' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test.afterAll(async () => {
    if (app) await app.close();
    if (profile) await rm(profile, { recursive: true, force: true });
  });
  test('native alert events reach persisted history while clipboard and HUD events are excluded', async () => {
    await island.evaluate(() => window.nova.notifications.clear());
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('network', {
        link: 'none',
        internet: false,
        prev: { link: 'wifi', internet: true },
      }),
    );
    await expect
      .poll(() => island.evaluate(() => window.nova.notifications.get()))
      .toMatchObject({
        unread: 1,
        items: [{ title: 'No connection', category: 'system', count: 1 }],
      });
    await expect(island.locator('#notification-count')).toHaveText('1');
    await island.evaluate(async () => {
      await window.nova.notifications.record({ kind: 'clip-text', title: 'Private clipboard' });
      await window.nova.notifications.record({ kind: 'done', title: 'Copied', detail: 'Private clipboard' });
      await window.nova.notifications.record({ kind: 'vol', title: 'Volume 50%' });
    });
    const saved = JSON.parse(await readFile(path.join(profile, 'notifications.json'), 'utf8'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'No connection', read: false });
  });
  test('search, unread filters, read and dismiss controls work with safe Unicode text', async () => {
    await island.evaluate(async () => {
      await window.nova.notifications.clear();
      await window.nova.notifications.record({
        kind: 'focus',
        title: 'Focus complete',
        detail: 'Take a five-minute break.',
      });
      await window.nova.notifications.record({
        kind: 'update',
        title: 'مرحباً 🌊',
        detail: '<img src=x onerror=alert(1)>',
      });
    });
    await island.locator('#open-notifications').click();
    await expect(island.locator('#notification-query')).toBeFocused();
    await expect(island.locator('.notification-item')).toHaveCount(2);
    await expect(island.locator('.notification-detail').first()).toHaveText('<img src=x onerror=alert(1)>');
    await expect(island.locator('#notification-list img')).toHaveCount(0);
    await island.locator('#notification-query').fill('مرحباً');
    await expect(island.locator('.notification-item')).toHaveCount(1);
    await island.locator('.notification-content').click();
    await expect(island.locator('#notification-count')).toHaveText('1');
    await island.locator('#notification-query').fill('');
    await island.locator('[data-notification-filter="unread"]').click();
    await expect(island.locator('.notification-content b')).toHaveText('Focus complete');
    await island.locator('.notification-dismiss').click();
    await expect(island.locator('#notification-empty-title')).toHaveText('All caught up');
    await island.locator('[data-notification-filter="all"]').click();
    await expect(island.locator('.notification-item')).toHaveCount(1);
    await island.locator('#notification-preview').click();
    await expect(island.locator('.notification-content b').first()).toHaveText('Water-drop preview');
    await island.locator('#notification-read-all').click();
    await expect(island.locator('#notification-count')).toBeHidden();
    await island.screenshot({ path: 'artifacts/notifications-tray.png', animations: 'disabled' });
    await island.locator('#notification-clear').click();
    await expect(island.locator('#notification-empty-title')).toHaveText('A quiet little inbox');
    await expect
      .poll(() => island.evaluate(() => window.nova.notifications.get()))
      .toEqual({ items: [], unread: 0 });
    await island.locator('#notification-close').click();
  });
  test('keyboard focus stays in the tray and transfers cleanly to Quick Actions', async () => {
    await island.locator('#open-notifications').click();
    await island.locator('#notification-preview').focus();
    await island.keyboard.press('Tab');
    await expect(island.locator('#notification-close')).toBeFocused();
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocusable()))
      .toBe(true);
    await island.keyboard.press('Shift+Tab');
    await expect(island.locator('#notification-preview')).toBeFocused();
    await island.keyboard.press('Control+k');
    await expect(island.locator('#notification-center')).toBeHidden();
    await expect(island.locator('#command-query')).toBeFocused();
    await island.locator('#command-query').fill('Open notifications');
    await island.keyboard.press('Enter');
    await expect(island.locator('#command-panel')).toBeHidden();
    await expect(island.locator('#notification-query')).toBeFocused();
    await island.keyboard.press('Escape');
    await expect(island.locator('#notification-center')).toBeHidden();
    await expect(island.locator('#open-notifications')).toBeFocused();
    expect(await island.locator('.l-expanded > [inert]').count()).toBe(0);
    await island.locator('#open-notifications').click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#notification-center')).toBeHidden();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await expect(island.locator('#island')).toHaveClass(/expanded/);
  });
  test('water-drop motion finishes, respects accessibility and adds no idle frame loop', async () => {
    await island.locator('#open-notifications').click();
    await expect(island.locator('#notification-center')).toHaveClass(/water-open/);
    const animations = await island.locator('.notification-water').evaluate((element) => {
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 400;
      }
      return animations.map((animation) => animation.effect?.getTiming().iterations);
    });
    expect(animations).toEqual([1, 1, 1]);
    await island.locator('.notification-panel').evaluate((element) => {
      for (const animation of element.getAnimations()) animation.finish();
    });
    await island.screenshot({ path: 'artifacts/notifications-water-drop.png' });
    await expect(island.locator('#notification-center')).not.toHaveClass(/water-open/);
    await island.waitForTimeout(1200);
    const frames = await island.evaluate(async () => {
      const original = window.requestAnimationFrame;
      let count = 0;
      window.requestAnimationFrame = (callback) => {
        count++;
        return original(callback);
      };
      await new Promise((resolve) => setTimeout(resolve, 400));
      window.requestAnimationFrame = original;
      return count;
    });
    expect(frames).toBe(0);
    await island.evaluate(() => window.nova.setFeatures({ notificationDrop: false }));
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({ notificationDrop: false });
    await island.locator('#notification-preview').click();
    await expect(island.locator('#notification-center')).not.toHaveClass(/water-open/);
    await island.evaluate(() => window.nova.setFeatures({ notificationDrop: true, motionPreset: 'reduced' }));
    await expect(island.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await island.locator('#notification-close').click();
    await island.locator('#open-notifications').click();
    await expect(island.locator('#notification-center')).not.toHaveClass(/water-open/);
    await island.evaluate(() => window.nova.setFeatures({ motionPreset: 'expressive' }));
    await island.emulateMedia({ reducedMotion: 'reduce' });
    await island.locator('#notification-close').click();
    await island.locator('#open-notifications').click();
    await expect(island.locator('#notification-center')).not.toHaveClass(/water-open/);
    await island.emulateMedia({ reducedMotion: 'no-preference' });
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('lock-screen'));
    await expect(island.locator('#notification-center')).toBeHidden();
    await island.evaluate(() => window.nova.notifications.record({ kind: 'focus', title: 'While hidden' }));
    await expect(island.locator('#island')).not.toHaveClass(/notification-arrival/);
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('unlock-screen'));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()))
      .toBe(true);
    await expect(island.locator('#notification-center')).toBeHidden();
  });
  test('presentation mode pauses capture and restores the tray without deleting history', async () => {
    const before = await island.evaluate(() => window.nova.notifications.get());
    await island.evaluate(() => window.nova.modes.apply('presentation'));
    await expect(island.locator('#open-notifications')).toBeHidden();
    await island.evaluate(() => window.nova.notifications.record({ kind: 'focus', title: 'Do not capture' }));
    expect(await island.evaluate(() => window.nova.notifications.get())).toEqual(before);
    await island.evaluate(() => window.nova.modes.restore());
    await expect(island.locator('#open-notifications')).toBeVisible();
    expect(await island.evaluate(() => window.nova.notifications.get())).toEqual(before);
    await island.locator('#open-notifications').click();
    await island.evaluate(() => window.nova.setFeatures({ notificationTray: false }));
    await expect(island.locator('#notification-center')).toBeHidden();
    expect(await island.locator('.l-expanded > [inert]').count()).toBe(0);
    await island.evaluate(() => window.nova.openSettings());
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((page) => page !== island)!;
    settings.on('pageerror', (error) => errors.push(error.message));
    await settings.locator('[data-page="alerts"]').click();
    await expect(settings.locator('[data-feature="notificationTray"]')).not.toBeChecked();
    await settings.locator('[data-feature="notificationTray"]').check();
    await expect(island.locator('#open-notifications')).toBeVisible();
    await settings.locator('[data-feature="notificationDrop"]').uncheck();
    await expect
      .poll(() => island.evaluate(() => window.nova.features()))
      .toMatchObject({ notificationDrop: false });
    await settings.evaluate(() => window.prefs.window('close'));
    expect(errors).toEqual([]);
  });
});
