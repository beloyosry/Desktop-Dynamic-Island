import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { SUPPORTER_PROFILES } from './supporter/catalog';
import { parseProfilePack } from '../src/modules/customization/domain/profile-pack';

async function main() {
  const root = 'artifacts/supporter';
  const dest = `${root}/customer`;
  await mkdir(`${dest}/profiles`, { recursive: true });
  const profiles = SUPPORTER_PROFILES.map(({ name, features }) => ({ name, features }));
  const pack = (items: typeof profiles) =>
    parseProfilePack({ format: 'dynamic-island-profile-pack', version: 1, profiles: items });
  const write = (file: string, value: unknown) =>
    writeFile(`${dest}/${file}`, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await write('supporter-all.json', pack(profiles));
  for (const [index, profile] of SUPPORTER_PROFILES.entries())
    await write(`profiles/${profile.id}.json`, pack([profiles[index]]));
  for (const file of ['START-HERE.html', 'LICENSE.txt']) await cp(`supporter/${file}`, `${dest}/${file}`);
  await cp('LICENSE', `${dest}/GPL-3.0.txt`);
  const files = [
    'supporter-all.json',
    ...SUPPORTER_PROFILES.map((profile) => `profiles/${profile.id}.json`),
    'START-HERE.html',
    'LICENSE.txt',
    'GPL-3.0.txt',
    ...SUPPORTER_PROFILES.map((profile) => `previews/${profile.id}.png`).filter((file) =>
      existsSync(`${dest}/${file}`),
    ),
  ];
  const manifest = await Promise.all(
    files.map(async (file) => ({
      file,
      sha256: createHash('sha256')
        .update(await readFile(`${dest}/${file}`))
        .digest('hex'),
    })),
  );
  await write('manifest.json', {
    packVersion: '1.0.0',
    minimumAppVersion: '2.6.1',
    priceUSD: 9,
    files: manifest,
  });
  console.log(`Built ${profiles.length} profiles at ${dest}; previews and videos: npm run media:supporter`);
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
