// Builds public/foods.json from USDA FoodData Central (public domain / CC0): SR Legacy, Foundation and FNDDS.
// Usage: python -I scripts/usda-extract.py <zip> <dir>, then node scripts/build-foods.mjs <dir>/generic.json
// SR Legacy keeps its NDB number as id and its Romanian names, because the meal planner is built on them.
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
// FNDDS uses the WWEIA survey categories; the order matters, the first match wins.
const WWEIA = [
  [/^baby|^formula|human milk/i, 'Copii'],
  [/sandwich|burger|burrito|nachos|mexican|pizza|egg rolls/i, 'Fast-food'],
  [/mixed dishes|macaroni|fried rice|stir-fry|ramen/i, 'Mâncăruri gata'],
  [/^soups|sauce|gravies|condiment/i, 'Supe și sosuri'],
  [/chips|popcorn|pretzels|bars|crackers/i, 'Gustări'],
  [/ice cream|candy|cookies|cakes|doughnuts|gelatins|jams|sugar|pudding/i, 'Dulciuri'],
  [/water|coffee|^tea$|soft drinks|energy drinks|diet drinks|fruit drinks|juice|liquor|^beer|^wine|smoothies|nutritional/i, 'Băuturi'],
  [/milk|yogurt|cheese|cream|^eggs/i, 'Lactate și ouă'],
  [/chicken|turkey/i, 'Pasăre'],
  [/beef/i, 'Vită'],
  [/^pork|^bacon/i, 'Porc'],
  [/^lamb/i, 'Miel, vițel, vânat'],
  [/frankfurters|sausages|cold cuts|liver/i, 'Mezeluri'],
  [/^fish|shellfish/i, 'Pește și fructe de mare'],
  [/beans, peas|bean, pea|soy and meat/i, 'Leguminoase'],
  [/nuts and seeds/i, 'Nuci și semințe'],
  [/^butter|margarine|mayonnaise|salad dressings/i, 'Grăsimi și uleiuri'],
  [/breads|rolls|bagels|biscuits|tortillas|pancakes|turnovers/i, 'Panificație'],
  [/cereal|oatmeal/i, 'Cereale mic dejun'],
  [/^rice|pasta, noodles/i, 'Cereale și paste'],
  [/apples|bananas|berries|fruits|grapes|mango|melons|peaches|pears|pineapple/i, 'Fructe'],
  [/vegetable|broccoli|cabbage|carrots|^corn|lettuce|onions|potato|spinach|string beans|tomatoes|olives|coleslaw/i, 'Legume'],
];
const OTHER = 'Mâncăruri gata';
const UNITS = [[/^(tbsp|tablespoons?)\b/i, 'lingură'], [/^(tsp|teaspoons?)\b/i, 'linguriță'], [/^cups?\b/i, 'cană'], [/^slices?\b/i, 'felie'],
  [/^pieces?\b/i, 'bucată'], [/^large\b/i, 'mare'], [/^medium\b/i, 'mediu'], [/^small\b/i, 'mic'],
  [/^serving\b/i, 'porție'], [/^fruit\b/i, 'bucată'], [/^egg\b/i, 'ou'], [/^bar\b/i, 'baton'], [/^scoop\b/i, 'măsură']];

const round = (n, d = 1) => Math.round((n ?? 0) * 10 ** d) / 10 ** d;
const cats = [...new Set([...Object.values(CATS), ...WWEIA.map((w) => w[1])])];
const SKIP = /^(undetermined|quantity not specified|guideline amount)/i;

/** FNDDS writes the whole measure in the description; SR and Foundation split it in amount and unit. */
function portions(f) {
  const out = [];
  for (const p of f.portions) {
    let amount = p.amount, raw;
    if (f.type === 'survey_fndds_food') {
      const m = /^([\d./]+)\s+(.+)$/.exec(p.desc);
      if (!m) continue;
      amount = Number(m[1]) || 1; raw = m[2];
    } else raw = p.mod || p.unit;
    raw = String(raw).split(',')[0].trim();
    if (!raw || SKIP.test(raw)) continue;
    const hit = UNITS.find(([re]) => re.test(raw));
    const label = hit ? raw.replace(hit[0], hit[1]) : raw;
    out.push([`${amount && amount !== 1 ? `${round(amount, 2)} ` : ''}${label}`.slice(0, 26), round(p.g)]);
    if (out.length === 3) break;
  }
  return out;
}

function category(f) {
  if (f.type === 'survey_fndds_food') return WWEIA.find(([re]) => re.test(f.cat))?.[1] ?? OTHER;
  return f.cat === 'Alcoholic Beverages' ? 'Băuturi' : CATS[f.cat] ?? OTHER;
}

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const TYPE = { sr_legacy_food: 0, foundation_food: 1, survey_fndds_food: 2 };
src.sort((a, b) => TYPE[a.type] - TYPE[b.type] || Number(a.ndb ?? a.fdc) - Number(b.ndb ?? b.fdc));

const seen = new Set();
const dropped = { 'date incomplete': 0, 'nume dublat': 0, 'doar ingredient': 0 };
const foods = [];
for (const f of src) {
  let [kcal, p, c, g, fiber, sugar, sat, sodium] = f.v;
  // Foundation leaves protein and carbs empty for pure fats.
  if (g >= 80) { p ??= 0; c ??= 0; }
  if (p == null || c == null || g == null) { dropped['date incomplete']++; continue; }
  if (/ as ingredient in /i.test(f.desc)) { dropped['doar ingredient']++; continue; }
  if (seen.has(f.desc)) { dropped['nume dublat']++; continue; }
  seen.add(f.desc);
  kcal ??= p * 4 + c * 4 + g * 9;
  foods.push({
    desc: f.desc, sr: f.type === 'sr_legacy_food',
    row: [Number(f.ndb ?? f.fdc), f.desc, cats.indexOf(category(f)), round(kcal, 0), round(p), round(c), round(g),
      round(fiber), round(sugar), round(sat), round(sodium, 0), portions(f), f.micro.map((v) => (v == null ? null : round(v, 2)))],
  });
}

const norm = (s) => s.toLowerCase();
const missing = [];
const curated = [];
const legacy = foods.filter((f) => f.sr);
for (const [ro, must, not] of RO) {
  const hits = legacy
    .filter((f) => must.every((t) => norm(f.desc).includes(t)) && !(not ?? []).some((t) => norm(f.desc).includes(t)))
    .sort((a, b) => a.desc.length - b.desc.length);
  if (!hits[0]) { missing.push(ro); continue; }
  curated.push([hits[0].row[0], ro]);
  if (process.env.SHOW) console.log(`${ro} <- ${hits[0].desc} | ${hits[0].row.slice(3, 8)}`);
}
if (missing.length) console.log('NEGĂSITE:', missing.join('; '));
writeFileSync('public/foods.json', JSON.stringify({ cats, ro: curated, foods: foods.map((f) => f.row) }));
console.log(`${foods.length} alimente (${legacy.length} SR Legacy), ${curated.length} cu nume românesc, renunțate:`, dropped);
