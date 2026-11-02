import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  await build({
    entryPoints: ['src/promo/island.ts', 'src/promo/settings.ts'],
    outdir: 'out/promo',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2023',
  });
  for (const [page, filename, before, after] of [
    ['island', 'island.html', ['mock.js', 'pre.js'], ['drive.js']],
    ['settings', 'prefs.html', ['pmock.js'], []],
  ] as const) {
    let html = await readFile(`out/renderer/${page}/index.html`, 'utf8');
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
    html = html.replace('<head>', '<head><base href="../../">');
    html = html.replace(/href="([^"/]+\.css)"/g, `href="out/renderer/${page}/$1"`);
    html = html.replaceAll('src="app-icon.png"', `src="out/renderer/${page}/app-icon.png"`);
    const entry = `out/promo/${page}.js`;
    html = html.replace(
      '<script src="index.js"></script>',
      [
        ...before.map((file) => `<script src="promo/src/${file}"></script>`),
        `<script src="${entry}"></script>`,
        ...after.map((file) => `<script src="promo/src/${file}"></script>`),
      ].join('\n'),
    );
    await writeFile(`promo/src/${filename}`, html);
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
