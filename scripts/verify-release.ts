import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

async function main() {
  const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
  const directory = process.argv[2] || 'dist';
  const installer = `Dynamic-Island-Pro-Setup-${version}.exe`;
  const manifest = await readFile(path.join(directory, 'latest.yml'), 'utf8');
  assert.match(manifest, new RegExp(`^version: ${version.replaceAll('.', '\\.')}\\s*$`, 'm'));
  assert.ok(manifest.includes(installer), 'latest.yml must point to this installer');
  const bytes = await readFile(path.join(directory, installer));
  assert.equal(bytes.subarray(0, 2).toString(), 'MZ', 'Installer must be a Windows executable');
  const checksum = createHash('sha512').update(bytes).digest('base64');
  assert.ok(manifest.includes(`sha512: ${checksum}`), 'Installer checksum must match latest.yml');
  assert.ok(
    (await readFile(path.join(directory, `${installer}.blockmap`))).length > 0,
    'Blockmap is required for differential updates',
  );
  console.log(`Verified ${installer}, SHA-512 manifest, and differential blockmap`);
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
