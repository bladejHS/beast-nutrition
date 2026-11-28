import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { offWorldBarcode, searchOffWorld, type Loader } from './foods.ts';

// every other country (2026-11-28, the user: "toate țările"), read from the app's own files
const dir = new URL('../../public/branded/off-world-2026-11-11/', import.meta.url);
const load: Loader = async (path) => { try { return JSON.parse(readFileSync(new URL(path, dir), 'utf8')); } catch { return null; } };

test('the world shelf finds brands from outside Europe', async () => {
  for (const q of ['mercadona', 'tesco', 'migros', 'kirkland', 'hacendado']) {
    const r = await searchOffWorld(q, load, 40);
    assert.ok(r.total > 0, q);
    assert.ok(r.foods.every((f) => f.cat.endsWith('restul lumii') && f.kcal >= 0), q);
  }
});

test('a barcode from the world shelf comes back as its product', async () => {
  const meta = JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')) as { products: number };
  assert.ok(meta.products > 1000000, String(meta.products));
  const first = JSON.parse(readFileSync(new URL('p/0.json', dir), 'utf8')) as [string, string][];
  const f = await offWorldBarcode(first[0]![0], load);
  assert.equal(f?.name, first[0]![1]);
});
