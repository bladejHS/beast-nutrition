import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCode, Confirm, expandUpcE, sameCode, validGtin } from './scan.ts';
import { brandRowToFood, byBarcode, offRoBarcode, offToFood, searchOffRo, type BrandRow, type Food } from './foods.ts';

test('the check digit accepts real codes and refuses a wrong digit', () => {
  assert.equal(validGtin('5449000000996'), true); // Coca-Cola, EAN-13
  assert.equal(validGtin('5449000000997'), false);
  assert.equal(validGtin('036000291452'), true); // UPC-A
  assert.equal(validGtin('96385074'), true); // EAN-8
  assert.equal(validGtin('12345'), false);
});

test('UPC-E is written out as UPC-A', () => {
  assert.equal(expandUpcE('04252614'), '042100005264');
  assert.equal(validGtin('042100005264'), true);
  assert.equal(cleanCode('04252614'), '042100005264');
  assert.equal(expandUpcE('5449000000996'), null);
});

test('cleanCode drops spaces and refuses digits that are not a product code', () => {
  assert.equal(cleanCode(' 5449 0000 00996 '), '5449000000996');
  assert.equal(cleanCode('5449000000990'), null);
  assert.equal(cleanCode(''), null);
});

test('a code needs two readings in a row', () => {
  const c = new Confirm();
  assert.equal(c.feed('5449000000996'), null);
  assert.equal(c.feed('036000291452'), null);
  assert.equal(c.feed('036000291452'), '036000291452');
  assert.equal(new Confirm().feed('5449000000990'), null);
});

test('leading zeros do not make a different product', () => {
  assert.equal(sameCode('0036000291452', '036000291452'), true);
  assert.equal(sameCode('5449000000996', '036000291452'), false);
});

test('a product saved by hand is found by its code before any database', async () => {
  const mine: Food = { id: 'm1', name: 'Iaurt de la piață', cat: 'Alimentele mele', kcal: 60, p: 4, c: 5, f: 3, fiber: 0, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'mine', code: '5449000000996' };
  assert.equal(await byBarcode('05449000000996', [mine]), mine);
});

test('an Open Food Facts product keeps its Romanian name, its serving and its pack', () => {
  const f = offToFood({ code: '5449000000996', product_name: 'Coca-Cola Original Taste', product_name_ro: 'Coca-Cola', brands: 'Coca-Cola, X', nutriments: { 'energy-kcal_100g': 42, carbohydrates_100g: 10.6, sugars_100g: 10.6 }, serving_quantity: 250, serving_quantity_unit: 'ml', product_quantity: 330, product_quantity_unit: 'ml' })!;
  assert.equal(f.name, 'Coca-Cola · Coca-Cola');
  assert.deepEqual(f.portions, [['1 porție (250 ml)', 250], ['tot pachetul (330 ml)', 330]]);
  assert.equal(f.noFiber, true);
  assert.equal(offToFood({ code: '1', product_name: 'Fără valori', nutriments: {} }), null);
});

test('a Romanian shelf row carries its barcode, its serving and its pack, and is found by code before USDA', async () => {
  const row: BrandRow = ['5941234567890', 'Iaurt grecesc · Olympus', 97, 6.4, 3.9, 6, null, 3.9, 4, 50, 150, 0, '', 400];
  const f = brandRowToFood(row);
  assert.equal(f.id, 'o5941234567890');
  assert.equal(f.source, 'off');
  assert.equal(f.code, '5941234567890');
  assert.equal(f.noFiber, true);
  assert.deepEqual(f.portions, [['1 porție (150 g)', 150], ['tot pachetul (400 g)', 400]]);
  const fake = async (path: string) => ({ 'b/890.json': { '5941234567890': 0 }, 'p/0.json': [row] } as Record<string, unknown>)[path] ?? null;
  assert.equal((await offRoBarcode('05941234567890', fake))?.id, 'o5941234567890');
  assert.equal((await searchOffRo('iaurt', async (p) => ({ 'w/ia.json': { iaurt: '0' }, 'p/0.json': [row] } as Record<string, unknown>)[p] ?? null)).foods[0]?.id, 'o5941234567890');
});
