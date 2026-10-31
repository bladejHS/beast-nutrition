// Builds public/foods.json from USDA FoodData Central (SR Legacy, public domain / CC0).
// Usage: node scripts/build-foods.mjs <FoodData_Central_sr_legacy_food_json.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { RO } from './ro-foods.mjs';

const CATS = {
  'Beef Products': 'Vită', 'Vegetables and Vegetable Products': 'Legume', 'Baked Products': 'Panificație',
  'Lamb, Veal, and Game Products': 'Miel, vițel, vânat', 'Poultry Products': 'Pasăre', Beverages: 'Băuturi',
  Sweets: 'Dulciuri', 'Fruits and Fruit Juices': 'Fructe', 'Baby Foods': 'Copii', 'Pork Products': 'Porc',
  'Fast Foods': 'Fast-food', 'Dairy and Egg Products': 'Lactate și ouă',
  'Legumes and Legume Products': 'Leguminoase', 'Finfish and Shellfish Products': 'Pește și fructe de mare',
  'Soups, Sauces, and Gravies': 'Supe și sosuri', 'Fats and Oils': 'Grăsimi și uleiuri',
  'Breakfast Cereals': 'Cereale mic dejun', 'Cereal Grains and Pasta': 'Cereale și paste', Snacks: 'Gustări',
  'Sausages and Luncheon Meats': 'Mezeluri', 'American Indian/Alaska Native Foods': 'Tradițional american',
  'Nut and Seed Products': 'Nuci și semințe', 'Restaurant Foods': 'Restaurant',
  'Meals, Entrees, and Side Dishes': 'Mâncăruri gata', 'Spices and Herbs': 'Condimente',
};
const UNITS = [[/^tbsp\b/i, 'lingură'], [/^tsp\b/i, 'linguriță'], [/^cups?\b/i, 'cană'], [/^slices?\b/i, 'felie'],
  [/^pieces?\b/i, 'bucată'], [/^large\b/i, 'mare'], [/^medium\b/i, 'mediu'], [/^small\b/i, 'mic'],
  [/^serving\b/i, 'porție'], [/^fruit\b/i, 'bucată'], [/^egg\b/i, 'ou'], [/^bar\b/i, 'baton'], [/^scoop\b/i, 'măsură']];

// Order must match MICRO_KEYS in src/logic/micros.ts; null = USDA has no value.
const MICROS = ['320', '401', '328', '323', '430', '404', '405', '406', '415', '418', '417', '301', '304', '306', '307', '303', '309', '317', '305'];

const src = JSON.parse(readFileSync(process.argv[2], 'utf8')).SRLegacyFoods;
const round = (n, d = 1) => Math.round((n ?? 0) * 10 ** d) / 10 ** d;
const cats = [...new Set(Object.values(CATS))];
const nut = (f, id) => f.foodNutrients.find((n) => n.nutrient.number === id)?.amount;

function portions(f) {
  const out = [];
  for (const p of f.foodPortions ?? []) {
    const raw = String(p.modifier || p.measureUnit?.name || '').split(',')[0].trim();
    if (!p.gramWeight || !raw || raw === 'undetermined') continue;
    const hit = UNITS.find(([re]) => re.test(raw));
    const label = hit ? raw.replace(hit[0], hit[1]) : raw;
    out.push([`${p.amount && p.amount !== 1 ? `${round(p.amount, 2)} ` : ''}${label}`.slice(0, 26), round(p.gramWeight)]);
    if (out.length === 3) break;
  }
  return out;
}

const norm = (s) => s.toLowerCase();
const foods = src.map((f) => {
  const p = nut(f, '203') ?? 0, c = nut(f, '205') ?? 0, g = nut(f, '204') ?? 0;
  const kcal = nut(f, '208') ?? p * 4 + c * 4 + g * 9;
  return {
    desc: f.description,
    row: [f.ndbNumber, f.description, cats.indexOf(CATS[f.foodCategory.description]), round(kcal, 0), round(p), round(c),
      round(g), round(nut(f, '291')), round(nut(f, '269')), round(nut(f, '606')), round(nut(f, '307'), 0), portions(f),
      MICROS.map((id) => { const v = nut(f, id); return v == null ? null : round(v, 2); })],
  };
});

const missing = [];
const curated = [];
for (const [ro, must, not] of RO) {
  const hits = foods
    .filter((f) => must.every((t) => norm(f.desc).includes(t)) && !(not ?? []).some((t) => norm(f.desc).includes(t)))
    .sort((a, b) => a.desc.length - b.desc.length);
  if (!hits[0]) { missing.push(ro); continue; }
  curated.push([hits[0].row[0], ro]);
  if (process.env.SHOW) console.log(`${ro} <- ${hits[0].desc} | ${hits[0].row.slice(3, 8)}`);
}
if (missing.length) console.log('NEGĂSITE:', missing.join('; '));
writeFileSync('public/foods.json', JSON.stringify({ cats, ro: curated, foods: foods.map((f) => f.row) }));
console.log(`${foods.length} alimente, ${curated.length} cu nume românesc`);
