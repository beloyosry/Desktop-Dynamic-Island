import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/modules/settings/domain/features';

async function main() {
  const root = process.cwd();
  const server = createServer(async (req, res) => {
    const requested = path.resolve(root, '.' + new URL(req.url || '/', 'http://localhost').pathname);
    if (!requested.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const mime: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ttf': 'font/ttf',
      };
      res.setHeader('Content-Type', mime[path.extname(requested)] || 'application/octet-stream');
      res.end(await readFile(requested));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as import('node:net').AddressInfo;
  const executablePath = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const scenario of [
      'music',
      'scene-prayer',
      'settings',
      'tools',
      'timer',
      'appearance',
      'appearance-small',
      'toolkit',
      'toolkit-calculator',
      'toolkit-clocks',
      'toolkit-text',
      'personalize',
      'personalize-small',
      'modes',
      'modes-small',
      'modes-mods',
      'toolkit-profiles',
      'notifications',
      'notifications-small',
      'notifications-empty',
      'quran',
      'quran-small',
      'performance',
      'performance-small',
    ]) {
      if (process.argv[2] && !scenario.startsWith(process.argv[2])) continue;
      const settingsPage = [
        'settings',
        'appearance',
        'appearance-small',
        'personalize',
        'personalize-small',
        'modes',
        'modes-small',
        'modes-mods',
        'performance',
        'performance-small',
      ].includes(scenario);
      const toolkitPage = scenario.startsWith('toolkit');
      const notificationsPage = scenario.startsWith('notifications');
      const quranPage = scenario.startsWith('quran');
      const page = await browser.newPage({
        viewport: {
          width: settingsPage ? (scenario.endsWith('-small') ? 640 : 840) : 760,
          height: settingsPage ? (scenario.endsWith('-small') ? 480 : 660) : 440,
        },
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const url = settingsPage
        ? `prefs.html?sec=${scenario.startsWith('performance') ? 'performance' : scenario.startsWith('modes') ? 'modes' : scenario.startsWith('personalize') ? 'personalize' : scenario.startsWith('appearance') ? 'appearance' : 'general'}`
        : `island.html?state=${quranPage || toolkitPage || notificationsPage || scenario === 'tools' || scenario === 'timer' ? 'music' : scenario}&ax=380&ay=40`;
      await page.goto(`http://127.0.0.1:${port}/promo/src/${url}`);
      if (settingsPage) await page.locator('#version').waitFor();
      else await page.locator('html[data-ready="1"]').waitFor();
      // Browser-only desktop backgrounds exercise glass contrast without changing the real desktop.
      if (!settingsPage && scenario !== 'scene-prayer') {
        await page.evaluate(
          ({ features, light }) => {
            const demo = window as Window & { fire?: (name: string, value: unknown) => void };
            if (!demo.fire) throw new Error('Missing browser preview bridge');
            demo.fire('onFeatures', features);
            document.body.style.background = light
              ? 'radial-gradient(ellipse at 80% 5%, #f5dbc9, transparent 60%), linear-gradient(130deg, #b7cde7, #efedf6 52%, #9ab5d7)'
              : 'radial-gradient(ellipse at 20% 85%, #557baf, transparent 60%), radial-gradient(ellipse at 95% 10%, #917faa, transparent 60%), #1c2c46';
          },
          {
            features: { ...DEFAULTS, themePreset: 'glacier', novaFocus: false, novaEyes: false },
            light: scenario === 'tools',
          },
        );
      }
      if (scenario === 'tools' || scenario === 'timer')
        await page.locator(`.tab[data-tab="${scenario}"]`).click();
      if (scenario === 'timer') await page.locator('[data-min="25"]').click();
      if (quranPage) {
        if (scenario.endsWith('-small'))
          await page.evaluate(() => window.nova.setFeatures({ panelWidth: 600, panelHeight: 330 }));
        await page.locator('[data-tab="quran"]').click();
        await page.locator('.qr-reciter').first().waitFor();
      }
      if (scenario.startsWith('performance')) {
        await page.locator('[data-feature="boostMode"]').check();
        await page.locator('#content').evaluate((element) => {
          element.scrollTop = 0;
        });
      }
      if (notificationsPage) {
        await page.evaluate(async (scenario) => {
          if (scenario.endsWith('-small')) window.nova.setFeatures({ panelWidth: 600, panelHeight: 330 });
          await window.nova.notifications.clear();
          if (!scenario.endsWith('-empty')) {
            for (const item of [
              {
                kind: 'update',
                title: 'A fresh update is ready',
                detail: 'Restart when you are ready to explore.',
              },
              {
                kind: 'water',
                title: 'A moment to recharge',
                detail: 'Your next glass of water is waiting.',
              },
              {
                kind: 'dl-done',
                title: 'Brand assets.zip',
                detail: 'Download complete · Ready for your next idea.',
              },
              {
                kind: 'focus',
                title: 'Beautiful work. Take a breather.',
                detail: 'Your 25-minute focus session is complete.',
              },
            ])
              await window.nova.notifications.record(item);
          }
        }, scenario);
        await page.locator('#open-notifications').click();
      }
      if (scenario.startsWith('modes')) {
        await page.locator('#mode-grid').waitFor();
        if (scenario === 'modes-mods') {
          await page.locator('[data-mode-view="mods"]').click();
          await page.locator('[data-mod="solid"]').check();
          await page.locator('[data-mod="silent"]').check();
          await page.locator('.mod-grid').scrollIntoViewIfNeeded();
        }
      }
      if (toolkitPage) {
        await page.locator('.tab[data-tab="toolkit"]').click();
        const tool = scenario.split('-')[1];
        if (tool) await page.locator(`[data-tool-view="${tool}"]`).click();
        if (tool === 'calculator') {
          await page.locator('#tk-expression').fill('(128 + 64) * 1.5');
          await page.locator('#tk-expression').press('Enter');
        }
        if (tool === 'text')
          await page
            .locator('#tk-text')
            .fill('A little space for big ideas.\nMake your desktop feel like you.');
      }
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
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      assert.deepEqual(errors, [], scenario);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${scenario}: horizontal overflow`,
      );
      await page.screenshot({ path: `artifacts/promo-${scenario}.png` });
      console.log(`PASS promo ${scenario}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
