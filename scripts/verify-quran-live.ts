// Opt-in live verification. Never part of deterministic CI or the shipped application.
import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
async function main() {
  const profile = await mkdtemp(path.join(tmpdir(), 'nova-quran-live-'));
  await writeFile(
    path.join(profile, 'features.json'),
    JSON.stringify({
      autoUpdate: false,
      morningBrief: false,
      welcomeBack: false,
      reminders: false,
      water: false,
      wellbeing: false,
      prayerAlerts: false,
      addrIsland: false,
      smartClipboard: false,
      clipboardHistory: false,
      screenshotToast: false,
    }),
  );
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    NOVA_USER_DATA: profile,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.NOVA_E2E_EXECUTABLE;
  const app = await electron.launch({
    executablePath,
    args: executablePath ? ['--test-mode'] : ['.', '--test-mode'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await expect
      .poll(() => readFile(path.join(profile, 'nova.log'), 'utf8'), { timeout: 15000 })
      .toContain('island ready');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.setAudioMuted(true);
      win.webContents.send('toggle');
    });
    await page.locator('[data-tab="quran"]').click();
    await expect(page.locator('.qr-reciter').first()).toBeVisible({ timeout: 25000 });
    const catalog = await page.evaluate(() => window.nova.quran.catalog());
    if (catalog.reciters.length < 100 || catalog.surahs.length !== 114 || catalog.stale)
      throw Error('Incomplete or stale live catalog');
    const sample = catalog.reciters[0];
    await page.locator(`[data-reciter="${sample.id}"]`).click();
    await page.locator('[data-surah="1"]').click();
    await expect
      .poll(() => page.locator('#qr-audio').evaluate((el) => (el as HTMLAudioElement).currentTime), {
        timeout: 25000,
      })
      .toBeGreaterThan(0.3);
    await page.locator('#qr-play').click();
    const audio = await page.locator('#qr-audio').evaluate((el) => {
      const a = el as HTMLAudioElement;
      return {
        url: a.currentSrc,
        duration: a.duration,
        playedSeconds: a.currentTime,
        paused: a.paused,
        seekable: a.seekable.length > 0,
      };
    });
    await page.screenshot({ path: 'artifacts/quran-live.png', animations: 'disabled' });
    const samples = [];
    for (const reciter of [
      sample,
      ...catalog.reciters.filter((r) => /alafasi|hussary/i.test(r.english)).slice(0, 2),
    ]) {
      const moshaf = reciter.moshafs.find((m) => m.surahs.includes(1));
      if (!moshaf) continue;
      const url = await page.evaluate(({ reciter, moshaf }) => window.nova.quran.stream(reciter, moshaf, 1), {
        reciter: reciter.id,
        moshaf: moshaf.id,
      });
      const response = await fetch(url, {
        headers: { Range: 'bytes=0-1023' },
        signal: AbortSignal.timeout(15000),
      });
      samples.push({
        reciter: reciter.name,
        status: response.status,
        type: response.headers.get('content-type'),
        range: response.headers.get('content-range'),
      });
      await response.body?.cancel();
      if (!response.ok) throw Error(`Live audio HTTP ${response.status}`);
    }
    const report = {
      date: new Date().toISOString(),
      reciters: catalog.reciters.length,
      recordings: catalog.reciters.reduce((n, r) => n + r.moshafs.length, 0),
      surahs: catalog.surahs.length,
      reciter: sample.name,
      audio,
      samples,
    };
    await mkdir('artifacts', { recursive: true });
    await writeFile('artifacts/quran-live.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
