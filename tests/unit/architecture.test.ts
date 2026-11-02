import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

test('production source is TypeScript with no unchecked migration escape hatches', () => {
  const source = files('src');
  assert.deepEqual(
    source.filter((file) => /\.[cm]?jsx?$/.test(file)),
    [],
  );
  for (const file of source.filter((file) => file.endsWith('.ts'))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /@ts-(?:ignore|nocheck)/, file);
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    assert.doesNotMatch(code, /\bas any\b|:\s*any\b/, file);
  }
});
test('renderers cannot import main-process implementations; domains cannot import infrastructure', () => {
  for (const file of files('src').filter((file) => file.endsWith('.ts'))) {
    const normalized = file.replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/^import(?! type\b)[\s\S]*?from ['"]([^'"]+)['"]/gm)].map(
      (match) => match[1],
    );
    if (normalized.includes('/renderer/')) {
      for (const dependency of imports)
        assert.doesNotMatch(
          dependency,
          /^(?:electron|node:)|\/main\/|\/platform\//,
          `${file}: ${dependency}`,
        );
    }
    if (normalized.includes('/domain/')) {
      assert.doesNotMatch(source, /from ['"][^'"]*(?:\/main\/|\/platform\/|electron)/, file);
    }
  }
});
