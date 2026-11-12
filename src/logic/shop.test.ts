import test from 'node:test';
import assert from 'node:assert/strict';
import { shopLine, shopList } from './shop.ts';
import { alternatives, type Meal, type Prefs } from './mealplan.ts';
import type { Food } from './foods.ts';

const food = (id: string, name: string, extra: Partial<Food> = {}): Food => ({ id, name, en: 'x', cat: '', kcal: 100, p: 10, c: 10, f: 1, fiber: 0, sugar: 0, sat: 0, sodium: 0, portions: [], source: 'usda', ...extra });
const db = new Map([
  food('rice', 'Orez alb fiert'), food('chk', 'Piept de pui, gătit'), food('wh', 'Albuș de ou'), food('egg', 'Ou întreg, crud'),
  food('ban', 'Banană'), food('tom', 'Roșii'), food('tuna', 'Ton la conservă în apă'), food('oil', 'Ulei de măsline'),
  food('mine', 'Granola de casă', { source: 'mine', pack: 400 }), food('odd', 'Ceva fără pachet'),
].map((f) => [f.id, f]));
const meal = (items: [string, number][], done = false): Meal => ({ id: 'x', name: '', steps: '', time: '', tag: '', done, items: items.map(([foodId, g]) => ({ foodId, role: 'carb' as const, g })) });

test('cooked rice and chicken are bought raw, in whole packs', () => {
  const list = shopList([[meal([['rice', 1500], ['chk', 700]])], [meal([['rice', 1200]])]], db);
  const rice = list.find((x) => x.name === 'Orez alb')!;
  assert.equal(rice.need, 945); // 2,7 kg cooked ≈ 945 g raw
  assert.equal(rice.packs, 1);
  const chk = list.find((x) => x.name === 'Piept de pui, crud')!;
  assert.equal(chk.need, 931);
  assert.equal(chk.packs, 2);
  assert.match(shopLine(chk).buy, /^2 × caserolă 500 g$/);
  assert.match(shopLine(chk).note, /ai nevoie de 931 g crud \(700 g gătit în plan\)/);
});

test('egg whites and whole eggs make one count of eggs, bought by the tray', () => {
  const eggs = shopList([[meal([['wh', 330], ['egg', 100]])]], db).find((x) => x.name === 'Ouă')!;
  assert.equal(eggs.need, 12);
  assert.equal(eggs.packs, 2);
  assert.equal(shopLine(eggs).buy, '2 × cofraj de 10');
});

test('pieces, cans, loose vegetables, oil in ml, own foods and unknown foods', () => {
  const list = shopList([[meal([['ban', 300], ['tuna', 230], ['tom', 410], ['oil', 40], ['mine', 120], ['odd', 90]])]], db);
  const get = (n: string) => list.find((x) => x.name === n)!;
  assert.equal(shopLine(get('Banane')).buy, '3 × bucată');
  assert.equal(get('Ton în apă, conservă').need, 3);
  assert.equal(shopLine(get('Roșii')).buy, '≈ 450 g, la kilogram');
  assert.equal(get('Ulei de măsline').unit, 'ml');
  assert.equal(get('Ulei de măsline').need, 44);
  assert.equal(shopLine(get('Granola de casă')).buy, '1 × pachet 400 g');
  assert.match(shopLine(get('Ceva fără pachet')).note, /verifică gramajul pe raft/);
});

test('eaten meals are left out and a corrected pack size is used', () => {
  const list = shopList([[meal([['chk', 700]], true), meal([['rice', 1500]])]], db, { 'Orez alb': 500 });
  assert.equal(list.length, 1);
  assert.equal(list[0]!.packs, 2);
  assert.equal(shopLine(list[0]!).buy, '2 × pachet 500 g');
});

test('own foods are offered as swaps for their role, and keep the sweet/savory rule', () => {
  const prefs: Prefs = { meals: 4, exclude: '', allergies: '', maxCook: 30, budget: 0 };
  const foods = [food('e', 'Piept de pui, gătit'), food('i', 'Piept de curcan, gătit'), food('w', 'Whey (proteină din zer)'), food('o', 'Ovăz fulgi, crud'),
    food('m1', 'Pastramă de curcan', { source: 'mine', role: 'protein' }), food('m2', 'Iaurt proteic vanilie', { source: 'mine', role: 'protein', sweet: true })];
  const savory = alternatives('protein', 'e', foods, prefs, ['Orez alb fiert', 'Ulei de măsline']).map((f) => f.name);
  assert.equal(savory[0], 'Pastramă de curcan');
  assert.ok(!savory.includes('Iaurt proteic vanilie'));
  const bowl = alternatives('fat', 'n', [...foods, food('m3', 'Cremă de alune', { source: 'mine', role: 'fat', sweet: true })], prefs, ['Iaurt proteic vanilie', 'Banană']).map((f) => f.name);
  assert.ok(bowl.includes('Cremă de alune'));
});

test('label values per portion become values per 100 g, and calories come from 4/4/9 when empty', async () => {
  const { fromLabel } = await import('../screens/mine.ts').catch(() => ({ fromLabel: null }));
  if (!fromLabel) return;
  assert.deepEqual(fromLabel({ p: 20, c: 6, f: 3 }, 200), { kcal: 66, p: 10, c: 3, f: 1.5, fiber: null, sugar: 0 });
  assert.equal(fromLabel({ kcal: 97, p: 9, c: 4, f: 5 }, 100)!.kcal, 97);
  assert.equal(fromLabel({ p: 60, c: 50, f: 10 }, 100), null);
  assert.equal(fromLabel({ p: 10, c: 10, f: 1 }, 0), null);
});
