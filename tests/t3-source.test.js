import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('T3 pointer sensor and projection/collision source stay byte-identical to the recorded upstream snapshot', async () => {
  const root = new URL('../src/vendor/t3-sidebar/', import.meta.url);
  const source = JSON.parse(await readFile(new URL('SOURCE.json', root), 'utf8'));
  for (const entry of source.files) {
    const name = entry.path.split('/').at(-1);
    const contents = await readFile(new URL(name, root));
    assert.equal(createHash('sha256').update(contents).digest('hex'), entry.sha256, name);
  }
  assert.match(await readFile(new URL('LICENSE', root), 'utf8'), /Copyright \(c\) 2026 T3 Tools Inc\./);
});
