import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { searchOffDe, type Loader } from './foods.ts';

// the real German shelf, read from the app's own files: what Lidl and Kaufland bring here
const dir = new URL('../../public/branded/off-de-2026-11-11/', import.meta.url);
const load: Loader = async (path) => { try { return JSON.parse(readFileSync(new URL(path, dir), 'utf8')); } catch { return null; } };

test('the German shelf finds Lidl and Kaufland house brands', async () => {
  for (const q of ['milbona skyr', 'pilos', 'k-classic']) {
    const r = await searchOffDe(q, load, 40);
    assert.ok(r.total > 0, q);
    assert.ok(r.foods.every((f) => f.cat.endsWith('Germania') && f.kcal >= 0), q);
  }
});
