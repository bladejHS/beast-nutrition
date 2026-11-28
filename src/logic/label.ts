/* The nutrition label (2026-11-28, the user: "o opțiune să scaneze valorile nutriționale când nu are alimentul băgat,
   ca să nu mai trebuiască să îl bag eu manual"). A photo of the table becomes the values per 100 g, which then fill
   the "Aliment propriu" form for a check before anything is saved.

   Two readers: Claude, when the user has set an AI key (it reads any layout and any language), and the text that
   on-device OCR gives, parsed here. Both end in `LabelVals`, cleaned by the same rules. Pure, so it is tested. */

export interface LabelVals {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number | null;
  sugar: number | null;
  /** The portion printed on the label, grams, when there is one. */
  portion: number | null;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/**
 * The values a line's first amount may be. OCR often reads the unit "g" as a 9 ("9,5 g" → "959", "10 g" → "109"),
 * so an amount ending in 9 without its g also offers itself without that 9, and, when the comma was lost too, with
 * the decimal put back. When the next column ends in 9 as well, the 9 is surely a g and goes first.
 */
export function amounts(rest: string): number[] {
  const toks = rest.replace(/(\d)[oO](?=\d|\b)/g, '$10').replace(/<\s*/g, '').match(/\d+(?:[.,]\d+)?(?:\s*g\b)?/gi) ?? [];
  const first = toks[0]?.replace(/\s+/g, '');
  if (!first) return [];
  const val = (t: string) => Number(t.replace(',', '.'));
  if (/g$/i.test(first)) return [val(first.slice(0, -1))];
  const out: number[] = [];
  const raw = val(first);
  const stripped = /9$/.test(first) && first.length > 1 ? first.slice(0, -1) : null;
  const moreNines = toks.length > 1 && /9$/.test(toks[1]!.replace(/\s+/g, ''));
  const lost = stripped && !/[.,]/.test(stripped) && stripped.length >= 2 ? val(`${stripped.slice(0, -1)}.${stripped.slice(-1)}`) : null;
  if (stripped && moreNines) out.push(val(stripped));
  if (raw <= 100) out.push(raw);
  if (stripped && !moreNines) out.push(val(stripped));
  if (lost != null) out.push(lost);
  return [...new Set(out.filter((x) => Number.isFinite(x) && x <= 100))];
}


/** Each nutrient: the words that start its line on Romanian, English, German, French and Italian labels. */
const KEYS: [keyof Pick<LabelVals, 'p' | 'c' | 'f' | 'fiber' | 'sugar'>, RegExp][] = [
  ['sugar', /\b(zaharuri|zahar|sugars?|zucker|sucres|zuccheri)\b/],
  ['fiber', /\b(fibre|fibra|fibres|fiber|dietary fibre|ballaststoffe|fibres alimentaires|fibre alimentari)\b/],
  ['p', /\b(proteine|proteina|protein|proteins|eiweiss|proteines)\b/],
  ['c', /\b(glucide|carbohidrati|hidrati de carbon|carbohydrates?|kohlenhydrate|glucides|carboidrati)\b/],
  ['f', /\b(grasimi|grasime|lipide|fat|fats|fett|matieres grasses|grassi)\b/],
];
/** The "of which" lines: saturates and sugars must not be read as fat or carbohydrate. */
const SUB = /\b(din care|of which|davon|dont|di cui|saturat|saturates|saturated|gesattigte|satures|saturi|mononesatur|polinesatur)\b/;

/**
 * Values per 100 g from OCR text. The first number after a nutrient's name is taken: on a two-column table (per
 * 100 g, per portion) that is the 100 g column. Null when protein, carbohydrate or fat is missing.
 */
export function parseLabel(text: string): LabelVals | null {
  const lines = fold(text).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const got: Partial<Record<'p' | 'c' | 'f' | 'fiber' | 'sugar', number[]>> = {};
  let kcal: number | null = null, kj: number | null = null, portion: number | null = null;
  lines.forEach((line, i) => {
    // energy: "1569 kj / 375 kcal", or the kcal on the next line
    if (/\b(energie|energy|valoare energetica|valoarea energetica|brennwert|energia)\b|\bkcal\b|\bkj\b/.test(line)) {
      const both = `${line} ${lines[i + 1] ?? ''}`;
      const kc = both.match(/(\d+(?:[.,]\d+)?)\s*kcal/);
      const kjm = both.match(/(\d+(?:[.,]\d+)?)\s*kj/);
      if (kc && kcal == null) kcal = Number(kc[1]!.replace(',', '.'));
      if (kjm && kj == null) kj = Number(kjm[1]!.replace(',', '.'));
    }
    const per = line.match(/(?:portie|portia|portion|serving|porzione)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(g|ml)\b/);
    if (per && portion == null) portion = Number(per[1]!.replace(',', '.'));
    for (const [key, re] of KEYS) {
      const m = re.exec(line);
      if (!m) continue;
      // "din care zaharuri" is sugar, but "din care acizi grași saturați" is neither fat nor anything we keep
      if (key !== 'sugar' && SUB.test(line)) break;
      if (got[key] != null) break;
      let cand = amounts(line.slice(m.index + m[0].length));
      if (!cand.length) cand = amounts(lines[i + 1] ?? '');
      if (cand.length) got[key] = cand;
      break;
    }
  });
  if (!got.p || !got.c || !got.f) return null;
  const energy = kcal ?? (kj != null ? kj / 4.184 : null);
  // the reading of protein, carbs and fat that agrees best with the printed energy; without one, the first of each
  let best = { p: got.p[0]!, c: got.c[0]!, f: got.f[0]!, miss: Infinity };
  if (energy) {
    got.p.forEach((p, a) => got.c!.forEach((c, b) => got.f!.forEach((f, d) => {
      const miss = Math.abs(4 * p + 4 * c + 9 * f - energy) + (a + b + d) * 4;
      if (miss < best.miss) best = { p, c, f, miss };
    })));
  }
  const sugar = got.sugar?.find((x) => x <= best.c) ?? null;
  return clean({ name: '', kcal: energy ?? 0, p: best.p, c: best.c, f: best.f, fiber: got.fiber?.[0] ?? null, sugar, portion });
}

const fin = (v: unknown, max: number): number | null => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null; };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Within what food can be; calories from the macros when the printed ones are missing or far from them. */
export function clean(v: { name?: unknown; kcal?: unknown; p?: unknown; c?: unknown; f?: unknown; fiber?: unknown; sugar?: unknown; portion?: unknown }): LabelVals | null {
  const p = fin(v.p, 100), c = fin(v.c, 100), f = fin(v.f, 100);
  if (p == null || c == null || f == null || p + c + f > 105) return null;
  const macros = 4 * p + 4 * c + 9 * f;
  let kcal = fin(v.kcal, 950) ?? 0;
  if (!kcal || (macros > 0 && (kcal < macros * 0.6 || kcal > macros * 1.4 + 30))) kcal = macros;
  const sugar = fin(v.sugar, 100), fiber = fin(v.fiber, 100), portion = fin(v.portion, 2000);
  return {
    name: String(v.name ?? '').trim().slice(0, 80),
    kcal: Math.round(kcal), p: r1(p), c: r1(c), f: r1(f),
    fiber: fiber == null ? null : r1(fiber), sugar: sugar == null || sugar > c + 0.5 ? null : r1(sugar),
    portion: portion && portion > 0 ? Math.round(portion) : null,
  };
}

// ---- Claude reads the photo -------------------------------------------------------------------------------------
const num = { type: 'number' } as const;
export const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'name', 'kcal_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'fiber_100g', 'sugar_100g', 'portion_g'],
  properties: {
    found: { type: 'boolean' }, name: { type: 'string' },
    kcal_100g: num, protein_100g: num, carbs_100g: num, fat_100g: num, fiber_100g: num, sugar_100g: num, portion_g: num,
  },
} as const;

export const LABEL_SYSTEM = `You read the nutrition table on a food package photo for a Romanian nutrition app.
Return the values per 100 g (or per 100 ml) exactly as printed in the "100 g" column. When the table only gives values per portion, convert them to 100 g using the portion weight.
kcal_100g: the kcal figure (convert from kJ by dividing by 4.184 only if no kcal is printed). carbs_100g is total carbohydrate, not "of which sugars". fiber_100g and sugar_100g: -1 when not printed. portion_g: the portion weight in grams if printed, else -1.
name: the product name and brand if visible on the photo, in the package's own words, else an empty string.
found: false when there is no readable nutrition table in the photo; then put 0 everywhere.`;

/** The model's answer as LabelVals; null when it saw no table. */
export function cleanLabelAnswer(raw: unknown): LabelVals | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (o['found'] !== true) return null;
  const opt = (k: string) => { const n = Number(o[k]); return Number.isFinite(n) && n >= 0 ? n : null; };
  return clean({ name: o['name'], kcal: o['kcal_100g'], p: o['protein_100g'], c: o['carbs_100g'], f: o['fat_100g'], fiber: opt('fiber_100g'), sugar: opt('sugar_100g'), portion: opt('portion_g') });
}
