import { test, expect, _electron as electron } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

test('mini-player serves compiled assets and returns playback position through its preload', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'nova-mini-e2e-'));
  const entry = path.join(profile, 'main.cjs');
  await cp('out/renderer/mini-player', path.join(profile, 'out/renderer/mini-player'), { recursive: true });
  await mkdir(path.join(profile, 'out/preload'), { recursive: true });
  await cp('out/preload/mini-player.js', path.join(profile, 'out/preload/mini-player.js'));
  await build({
    entryPoints: ['tests/fixtures/mini-main.ts'],
    outfile: entry,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    NOVA_USER_DATA: profile,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [entry], env });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.locator('#title')).toHaveText('Mini-player regression');
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index.html/);
    expect(await page.evaluate(() => typeof window.mini.close)).toBe('function');
    const origin = new URL(page.url()).origin;
    expect((await fetch(`${origin}/index.js`)).status).toBe(200);
    expect((await fetch(`${origin}/preload.js`)).status).toBe(404);
    expect((await fetch(`${origin}/package.json`)).status).toBe(404);
    await page.evaluate(() => {
      window.mini.time(42.25);
      window.mini.close(42.25, true);
    });
    await expect
      .poll(async () => JSON.parse(await readFile(path.join(profile, 'returned.json'), 'utf8')))
      .toEqual({ time: 42.25, resume: true });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
