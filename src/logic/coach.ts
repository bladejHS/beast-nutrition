/* The sports-nutrition coach behind the meal plan (2026-11-21, the user: "ești un tehnician profesionist în nutriție
   sportivă și mesele vreau să fie construite ca un antrenor de top, folosind date științifice").
   What each rule rests on:
   - protein spread over the meals, ~0.4 g/kg a meal and enough leucine (~2.5–3 g) in each to start muscle protein
     synthesis: Areta 2013, Morton 2018, Schoenfeld & Aragon 2018, ISSN protein position stand 2017;
   - the meal before training light in fat and fibre, rich in easily digested carbs; after training protein + carbs:
     ISSN nutrient timing 2017, ACSM/AND/DC 2016, Burke;
   - 30–40 g of slowly digested (casein-rich dairy) protein before sleep: Trommelen & van Loon 2016, Snijders 2015;
   - carbs where the work is ("fuel for the work required"): Impey 2018, IOC consensus 2018;
   - fibre ~14 g per 1000 kcal and vegetables at the main meals: dietary guidelines, satiety in a deficit;
   - oily fish twice a week (EPA/DHA), dairy for calcium, red meat for iron: EFSA, AHA.
   Pure functions; mealplan.ts applies them. */
import type { Food } from './foods.ts';
import type { Item, Meal } from './mealplan.ts';

export const PRE_TAG = 'Înainte de antrenament';
export const POST_TAG = 'După antrenament';

/** Protein of the night meal, from slowly digested dairy. */
export const NIGHT_PROTEIN = 35;
/** The leucine threshold of a meal, in grams. */
export const LEUCINE_MIN = 2.5;
/** Fibre to aim at, per 1000 kcal. */
export const FIBRE_PER_1000 = 14;

/** Leucine as a share of a food's protein: whey ~11 %, dairy ~10 %, eggs ~8.5 %, meat and fish ~8 %, plants less. */
export function leucineShare(name: string): number {
  const n = name.toLowerCase();
  if (/whey|zer/.test(n)) return 0.11;
  if (/lapte|iaurt|skyr|brânz|branz|cottage|parmezan|telemea|cazein|quark/.test(n)) return 0.1;
  if (/\bou\b|albu|ouă/.test(n)) return 0.085;
  if (/pui|curcan|vită|vita|vițel|vitel|porc|somon|ton\b|cod|păstrăv|șalău|tilapia|macrou|hering|creve|sardin|tofu|soia/.test(n)) return 0.08;
  if (/linte|năut|fasole|mazăre/.test(n)) return 0.075;
  return 0.07;
}

export function leucine(items: Item[], db: Map<string, Food>): number {
  return items.reduce((s, it) => { const f = db.get(it.foodId); return f ? s + (f.p * it.g / 100) * leucineShare(f.name) : s; }, 0);
}

/** Casein-rich dairy: digests slowly, the protein for the night. */
export const SLOW_PROTEIN = ['Brânză de vaci', 'Brânză cottage 1%', 'Skyr natur', 'Iaurt grecesc degresat', 'Iaurt grecesc 2%'];
/** EPA and DHA. */
export const OILY_FISH = ['Somon crud', 'Macrou, crud', 'Hering, crud', 'Ton proaspăt, crud', 'Păstrăv, crud'];
/** Haem iron and zinc. */
export const RED_MEAT = ['Pulpă de vită, crudă', 'Mușchi de vită, crud', 'Carne tocată de vită 90%, crudă', 'Carne tocată de vită 95%, crudă', 'Carne de vițel, crudă'];

export type Focus = 'fish' | 'red' | null;
/** What the week needs from each day: oily fish on Tuesday and Friday, red meat on Monday and Thursday. */
export function weekFocus(date: string): Focus {
  const wd = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  return wd === 1 || wd === 4 ? 'fish' : wd === 0 || wd === 3 ? 'red' : null;
}

/** The slot a meal fills in the day: before training, after it, the last one before sleep, or an ordinary one. */
export type Slot = 'pre' | 'post' | 'night' | 'main';
export function slotOf(i: number, n: number, tags: string[]): Slot {
  if (tags[i] === PRE_TAG) return 'pre';
  // the meal after training comes first, even when it is the last one: recovery needs its carbs
  if (tags[i] === POST_TAG) return 'post';
  if (n >= 3 && i === n - 1) return 'night';
  return 'main';
}

/** One short line on why the meal is built the way it is, for its card. */
export function why(meal: Meal, i: number, meals: Meal[], db: Map<string, Food>): string {
  const n = meals.filter((m) => !m.snack).length;
  const names = meal.items.map((it) => db.get(it.foodId)?.name ?? '');
  const fish = names.some((x) => OILY_FISH.includes(x)) ? ' Pește gras: omega-3.' : '';
  const red = names.some((x) => RED_MEAT.includes(x)) ? ' Carne roșie: fier și zinc.' : '';
  const slow = names.some((x) => SLOW_PROTEIN.includes(x));
  const tags = meals.map((m) => m.tag);
  switch (meal.snack ? 'main' : slotOf(i, n, tags)) {
    case 'pre': return `Înainte de antrenament: carbohidrați ușor de digerat, grăsimi și fibre puține, ca să ajungi plin de energie.${fish}`;
    case 'post': return `După antrenament: proteină pentru refacerea mușchilor și carbohidrați pentru glicogen.${red}${fish}`;
    case 'night': return slow ? 'Înainte de somn: proteină din lactate, care se digeră încet și hrănește mușchii peste noapte.' : `Ultima masă: proteină suficientă și legume pentru sațietate.${fish}${red}`;
    default: return `Proteină suficientă ca să pornească refacerea mușchilor, legume pentru fibre și sațietate.${fish}${red}`;
  }
}
