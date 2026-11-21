import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { offEuBarcode, searchOffEu, type Loader } from './foods.ts';

// the real European shelf (2026-11-21), read from the app's own files: Carrefour, Auchan, Delhaize (Mega Image), Italy
const dir = new URL('../../public/branded/off-eu-2026-11-11/', import.meta.url);
const load: Loader = async (path) => { try { return JSON.parse(readFileSync(new URL(path, dir), 'utf8')); } catch { return null; } };

test('the European shelf finds the house brands sold in Romania', async () => {
  for (const q of ['carrefour', 'auchan', 'delhaize', 'barilla', 'mutti']) {
    const r = await searchOffEu(q, load, 40);
    assert.ok(r.total > 0, q);
    assert.ok(r.foods.every((f) => f.cat.endsWith('Europa') && f.kcal >= 0), q);
  }
});

test('a European barcode comes back as its product', async () => {
  const meta = JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')) as { products: number };
  assert.ok(meta.products > 500000, String(meta.products));
  const first = JSON.parse(readFileSync(new URL('p/0.json', dir), 'utf8')) as [string, string][];
  const f = await offEuBarcode(first[0]![0], load);
  assert.equal(f?.name, first[0]![1]);
});
