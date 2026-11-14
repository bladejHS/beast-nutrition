import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lev, near, searchOffRo, type Loader } from './foods.ts';

// the real Romanian shelf, read from the app's own files
const dir = new URL('../../public/branded/off-ro-2026-11-11/', import.meta.url);
const load: Loader = async (path) => { try { return JSON.parse(readFileSync(new URL(path, dir), 'utf8')); } catch { return null; } };

test('typos: one letter off from 4 letters, two from 8', () => {
  assert.equal(lev('quark', 'qwark'), 1);
  assert.ok(near('qwark', 'quark'));
  assert.ok(near('pilso', 'pilos'));
  assert.ok(near('cascavel', 'cascaval'));
  assert.ok(!near('pui', 'pai'), 'short words stay exact');
  assert.ok(!near('quark', 'quinoa'));
});

test('"quark" also suggests the high-protein dairy, by brand (the user, 2026-11-14)', async () => {
  const r = await searchOffRo('quark', load, 40);
  const names = [...r.foods, ...r.near].map((f) => f.name.toLowerCase());
  assert.ok(r.foods.some((f) => /quark/i.test(f.name)), 'the exact quark products first');
  assert.ok(r.near.length > 0, 'and similar products after them');
  assert.ok(names.some((n) => /skyr/.test(n)), 'skyr is offered');
  assert.ok(names.some((n) => /high protein/.test(n) && /pilos/.test(n)), 'a Pilos high-protein product is offered');
});

test('a brand with a word it never uses still lands on that brand', async () => {
  const r = await searchOffRo('pilos quark', load, 40);
  assert.equal(r.total, 0);
  assert.ok(r.near.some((f) => /pilos/i.test(f.name) && /protein/i.test(f.name)), r.near.map((f) => f.name).join(' | '));
});

test('a typo in a brand still finds it', async () => {
  const r = await searchOffRo('pilso', load, 40);
  assert.ok(r.foods.some((f) => /pilos/i.test(f.name)));
});

test('a typo in the second letter still finds the word', async () => {
  const r = await searchOffRo('qwark', load, 40);
  assert.ok(r.foods.some((f) => /quark/i.test(f.name)));
});

test('the plain food list forgives a typo only when nothing matches as typed', async () => {
  const { search } = await import('./foods.ts');
  const f = (name: string) => ({ id: name, name, en: name, cat: 'x', kcal: 100, p: 1, c: 1, f: 1, fiber: 0, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda' }) as never;
  const list = [f('Quarter Pounder'), f('Quaker Oats'), f('Quark')];
  assert.deepEqual(search(list, 'quark').map((x: { name: string }) => x.name), ['Quark']);
  assert.deepEqual(search(list, 'quarck').map((x: { name: string }) => x.name), ['Quark']);
});
