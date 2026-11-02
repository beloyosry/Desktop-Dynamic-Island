import { _electron as electron } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import path from 'node:path';

// Real Electron + native helper, isolated settings. This diagnostic never ships in the app.
const exec = promisify(execFile);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const profile = await mkdtemp(path.join(tmpdir(), 'nova-performance-'));
  await writeFile(
    path.join(profile, 'features.json'),
    JSON.stringify({
      autoUpdate: false,
      morningBrief: false,
      welcomeBack: false,
      reminders: false,
      wellbeing: false,
      water: false,
      prayerAlerts: false,
      novaEyes: false,
      addrIsland: false,
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
  type Sample = { id: number; name: string; cpu: number; workingMB: number; privateMB: number };
  const results: object[] = [];
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.nova);
    for (let i = 0; i < 30; i++) {
      if ((await readFile(path.join(profile, 'nova.log'), 'utf8')).includes('island ready')) break;
      await delay(500);
    }
    await page.evaluate(() => {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        document.documentElement.dataset.profileFrames = String(
          Number(document.documentElement.dataset.profileFrames || 0) + 1,
        );
        return request(callback);
      };
    });
    const mainPid = await app.evaluate(() => process.pid);
    await app.evaluate(({ desktopCapturer }) => {
      const host = globalThis as typeof globalThis & { novaProfileCaptures: number };
      host.novaProfileCaptures = 0;
      const getSources = desktopCapturer.getSources.bind(desktopCapturer);
      desktopCapturer.getSources = (options) => {
        host.novaProfileCaptures++;
        return getSources(options);
      };
    });
    const { stdout } = await exec(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `@(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${mainPid}" | Where-Object Name -eq 'nova-helper.exe' | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress`,
      ],
      { windowsHide: true },
    );
    const helperIds = JSON.parse(stdout || '[]') as number | number[];
    if (![helperIds].flat().length) throw new Error('Native helper missing from performance sample');
    async function sample() {
      const metrics = await app.evaluate(({ app }) => app.getAppMetrics());
      const ids = [...metrics.map((m) => m.pid), ...[helperIds].flat()];
      const { stdout } = await exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `@(Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ id=$_.Id; name=$_.ProcessName; cpu=$_.TotalProcessorTime.TotalSeconds; workingMB=$_.WorkingSet64 / 1MB; privateMB=$_.PrivateMemorySize64 / 1MB } }) | ConvertTo-Json -Compress`,
        ],
        { windowsHide: true },
      );
      return { at: performance.now(), processes: JSON.parse(stdout) as Sample[] };
    }
    async function measure(scenario: string) {
      await delay(4000);
      const start = await sample();
      const capturesBefore = await app.evaluate(
        () => (globalThis as typeof globalThis & { novaProfileCaptures: number }).novaProfileCaptures,
      );
      const framesBefore = await page.evaluate(() =>
        Number(document.documentElement.dataset.profileFrames || 0),
      );
      await delay(Number(process.env.NOVA_PROFILE_SECONDS || 12) * 1000);
      const end = await sample();
      const captures =
        (await app.evaluate(
          () => (globalThis as typeof globalThis & { novaProfileCaptures: number }).novaProfileCaptures,
        )) - capturesBefore;
      const frames =
        (await page.evaluate(() => Number(document.documentElement.dataset.profileFrames || 0))) -
        framesBefore;
      const visualState = await page.evaluate(() => ({
        mode: document.querySelector('#island')!.className,
        animations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      }));
      const seconds = (end.at - start.at) / 1000;
      const processes = end.processes.map((p) => ({
        ...p,
        cpuOneCorePercent: +(
          (100 * Math.max(0, p.cpu - (start.processes.find((s) => s.id === p.id)?.cpu ?? p.cpu))) /
          seconds
        ).toFixed(2),
      }));
      const result = {
        scenario,
        seconds: +seconds.toFixed(1),
        logicalProcessors: cpus().length,
        cpuMachinePercent: +(
          processes.reduce((sum, p) => sum + p.cpuOneCorePercent, 0) / cpus().length
        ).toFixed(2),
        workingMB: +processes.reduce((sum, p) => sum + p.workingMB, 0).toFixed(1),
        privateMB: +processes.reduce((sum, p) => sum + p.privateMB, 0).toFixed(1),
        rendererFrameRequests: frames,
        desktopCaptures: captures,
        visualState,
        processes,
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    // Pin the island to make expanded measurements independent of the physical cursor.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('toggle'));
    await page.locator('.tab[data-tab="tools"]').click();
    await measure('expanded-tools');
    await page.evaluate(() => window.nova.setFeatures({ boostMode: true }));
    await measure('boost-tools');
    await page.evaluate(() => window.nova.performance.clean('memory'));
    await measure('boost-after-cleanup');
    await page.evaluate(() => window.nova.setFeatures({ boostMode: false }));
    await page.locator('.tab[data-tab="toolkit"]').click();
    await page.locator('[data-tool-view="clocks"]').click();
    await measure('toolkit-clocks');
    await page.locator('.tab[data-tab="timer"]').click();
    await page.locator('#tm-mode-sw').click();
    await page.locator('#sw-start').click();
    await page.locator('.tab[data-tab="tools"]').click();
    await measure('stopwatch-off-tab');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('hover', false);
      win.webContents.send('toggle');
    });
    await measure('collapsed');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await measure('hidden');
    await mkdir('artifacts', { recursive: true });
    const label = (process.env.NOVA_PROFILE_LABEL || 'current').replace(/[^a-z0-9-]/gi, '');
    await writeFile(
      `artifacts/performance-${label}.json`,
      JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
    );
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
