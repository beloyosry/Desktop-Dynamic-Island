import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const root = process.cwd();
  const common = { bundle: true, sourcemap: true, logLevel: 'info' as const, target: 'es2023' };
  await build({
    ...common,
    entryPoints: ['src/main/index.ts'],
    outfile: 'out/main/index.js',
    platform: 'node',
    format: 'cjs',
    packages: 'external',
  });
  await build({
    ...common,
    entryPoints: ['src/preload/island.ts', 'src/preload/settings.ts', 'src/preload/mini-player.ts'],
    outdir: 'out/preload',
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
  const pages = {
    island: 'src/renderer/island',
    settings: 'src/modules/settings/renderer',
    'mini-player': 'src/modules/mini-player/renderer',
  };
  for (const [name, source] of Object.entries(pages)) {
    const dest = path.join(root, 'out', 'renderer', name);
    await mkdir(dest, { recursive: true });
    await build({
      ...common,
      entryPoints: [`${source}/index.ts`],
      outfile: path.join(dest, 'index.js'),
      platform: 'browser',
      format: 'iife',
    });
    await cp(`${source}/index.html`, path.join(dest, 'index.html'));
    if (name !== 'mini-player') await cp('build/icon.png', path.join(dest, 'app-icon.png'));
    if (name === 'island')
      await cp('src/modules/toolkit/renderer/toolkit.css', path.join(dest, 'toolkit.css'));
    if (name === 'island')
      await cp('src/modules/notifications/renderer/tray.css', path.join(dest, 'notifications.css'));
    if (name === 'settings')
      await cp('src/modules/customization/renderer/personalize.css', path.join(dest, 'personalize.css'));
    if (name === 'settings') await cp('src/modules/modes/renderer/modes.css', path.join(dest, 'modes.css'));
    if (name === 'settings')
      await cp('src/modules/performance/renderer/performance.css', path.join(dest, 'performance.css'));
    if (name === 'island') await cp('src/modules/quran/renderer/quran.css', path.join(dest, 'quran.css'));
    if (name !== 'mini-player') {
      await cp('src/modules/appearance/renderer/glass.css', path.join(dest, 'glass.css'));
      await cp(`src/modules/appearance/renderer/${name}.css`, path.join(dest, 'glass-page.css'));
    }
    await cp(
      `${source}/${name === 'island' ? 'style' : name === 'settings' ? 'prefs' : 'mini'}.css`,
      path.join(dest, name === 'island' ? 'style.css' : name === 'settings' ? 'prefs.css' : 'mini.css'),
    );
  }
  await cp('fonts', 'out/renderer/island/fonts', { recursive: true });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
