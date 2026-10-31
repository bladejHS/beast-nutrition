/* Everything here follows "Fat Loss Forever" (Norton & Baker): chapters 6, 8, 9 and 11. */
export type Sex = 'm' | 'f';
export type Phase = 'cut' | 'maintain' | 'reverse';
export type Pace = 'c' | 'm' | 'a';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Body fat, percent. */
  bf: number;
  /** 1.2 to 1.9 (ch. 6). */
  activity: number;
  /** Resistance training, at least 2 hours a week. */
  lifts: boolean;
}

export interface Macros { kcal: number; p: number; c: number; f: number }

export interface Plan {
  phase: Phase;
  startDate: string;
  /** Percent of body weight lost per week. */
  ratePct: number;
  /** Share of the non-protein calories that goes to carbs, 0.5 to 0.7. */
  carbShare: number;
  maintenance: number;
  macros: Macros;
  /** Protein outside a deficit, used on break weeks and high days. */
  proteinNoDeficit: number;
  /** 0 = Monday. */
  highDays: number[];
  /** Weeks of deficit, then weeks at maintenance. */
  breaks: { on: number; off: number } | null;
  pace: Pace;
  adjustments: Adjustment[];
}

export interface Adjustment { date: string; pct: number; note: string; from: number; to: number }

export interface DayTarget extends Macros {
  fiberMin: number;
  fiberMax: number;
  kind: 'normal' | 'low' | 'high' | 'break';
  label: string;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

export const lbmKg = (p: Profile) => p.weightKg * (1 - p.bf / 100);

/** Müller equation, as used in the book. */
export function bmrMuller(p: Profile): number {
  const lbm = lbmKg(p);
  const fm = p.weightKg - lbm;
  return Math.round(13.587 * lbm + 9.613 * fm + (p.sex === 'm' ? 198 : 0) - 3.351 * p.age + 674);
}

export const predictedMaintenance = (p: Profile) => Math.round(bmrMuller(p) * p.activity);

export type BfClass = 'obese' | 'over' | 'normal' | 'lean';

export function bfClass(sex: Sex, bf: number): BfClass {
  const [lean, over, obese] = sex === 'm' ? [10, 20, 27] : [21, 33, 38];
  if (bf > obese) return 'obese';
  if (bf > over) return 'over';
  return bf < lean ? 'lean' : 'normal';
}

/** Table 2, ch. 6, for a high-protein diet: kcal of daily deficit per kg lost weekly. */
const DEFICIT: Record<BfClass, { rt: number; noRt: number }> = {
  obese: { rt: 1072, noRt: 1024 },
  over: { rt: 1024, noRt: 930 },
  normal: { rt: 930, noRt: 834 },
  lean: { rt: 834, noRt: 740 },
};

export function deficitFactor(p: Profile): number {
  const row = DEFICIT[bfClass(p.sex, p.bf)];
  return p.lifts ? row.rt : row.noRt;
}

/** Table 1, ch. 8: g of protein per kg of lean mass. */
const PROTEIN: { upTo: number; fed: [number, number]; deficit: [number, number] }[] = [
  { upTo: 30, fed: [1.8, 2.0], deficit: [2.2, 2.4] },
  { upTo: 40, fed: [2.0, 2.3], deficit: [2.4, 2.8] },
  { upTo: 50, fed: [2.3, 2.6], deficit: [2.8, 3.1] },
  { upTo: 60, fed: [2.6, 2.9], deficit: [3.1, 3.5] },
  { upTo: 200, fed: [2.9, 3.2], deficit: [3.5, 3.8] },
];

export function proteinG(p: Profile, deficit: boolean): number {
  const row = PROTEIN.find((r) => p.age <= r.upTo) ?? PROTEIN[PROTEIN.length - 1]!;
  const [lo, hi] = deficit ? row.deficit : row.fed;
  return round5(((lo + hi) / 2) * lbmKg(p));
}

/** Splits what is left after protein; the book advises keeping fat at 30% of it or more. */
export function macrosFor(kcal: number, protein: number, carbShare: number): Macros {
  const rest = Math.max(0, kcal - protein * 4);
  return { kcal: Math.round(kcal), p: protein, c: round5((rest * carbShare) / 4), f: round5((rest * (1 - carbShare)) / 9) };
}

/** Safety limit of this app, not a number from the book. */
export const kcalFloor = (sex: Sex) => (sex === 'm' ? 1500 : 1200);

export interface CutSetup { weeklyKg: number; deficit: number; kcal: number; floored: boolean }

export function cutSetup(p: Profile, maintenance: number, ratePct: number): CutSetup {
  const weeklyKg = (p.weightKg * ratePct) / 100;
  const deficit = Math.round(weeklyKg * deficitFactor(p));
  const wanted = maintenance - deficit;
  const kcal = Math.max(wanted, kcalFloor(p.sex));
  return { weeklyKg, deficit: maintenance - kcal, kcal, floored: kcal > wanted };
}

/** Ch. 11: no fat-loss phase under 75% of predicted maintenance or under 25 kcal/kg of lean mass. */
export function dietBlocked(p: Profile, maintenance: number): string | null {
  const predicted = predictedMaintenance(p);
  if (maintenance < predicted * 0.75) return `Menții sub 75% din necesarul estimat (${predicted} kcal).`;
  if (maintenance < 25 * lbmKg(p)) return `Menții sub 25 kcal pe kg de masă slabă (${Math.round(25 * lbmKg(p))} kcal).`;
  return null;
}

export function buildPlan(p: Profile, opts: {
  phase: Phase; startDate: string; ratePct: number; carbShare: number; maintenance: number;
  highDays: number[]; breaks: Plan['breaks']; pace: Pace; adjustments?: Adjustment[];
}): Plan {
  const deficit = opts.phase === 'cut';
  const kcal = deficit ? cutSetup(p, opts.maintenance, opts.ratePct).kcal : opts.maintenance;
  return {
    ...opts,
    macros: macrosFor(kcal, proteinG(p, deficit), opts.carbShare),
    proteinNoDeficit: proteinG(p, false),
    adjustments: opts.adjustments ?? [],
  };
}

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

export const weekday = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

export function isBreakWeek(plan: Plan, date: string): boolean {
  if (plan.phase !== 'cut' || !plan.breaks) return false;
  const week = Math.floor(days(plan.startDate, date) / 7);
  const cycle = plan.breaks.on + plan.breaks.off;
  return week >= 0 && week % cycle >= plan.breaks.on;
}

const withFiber = (m: Macros, kind: DayTarget['kind'], label: string): DayTarget => ({
  ...m, kind, label, fiberMin: Math.round(m.kcal / 100), fiberMax: Math.round((m.kcal / 1000) * 15),
});

/** Keeps the weekly calories, moving them onto the high days (ch. 9). */
export function targetFor(plan: Plan, date: string): DayTarget {
  const m = plan.macros;
  if (isBreakWeek(plan, date)) {
    return withFiber(macrosFor(plan.maintenance, plan.proteinNoDeficit, plan.carbShare), 'break', 'Pauză de dietă · mențineri');
  }
  const n = plan.highDays.length;
  if (plan.phase !== 'cut' || n === 0) return withFiber(m, 'normal', plan.phase === 'cut' ? 'Zi de deficit' : plan.phase === 'reverse' ? 'Reverse diet' : 'Menținere');
  const high = Math.min(plan.maintenance, m.kcal * 1.6);
  const low = (m.kcal * 7 - high * n) / (7 - n);
  if (plan.highDays.includes(weekday(date))) {
    const fat = macrosFor(low, m.p, plan.carbShare).f;
    const carbs = round5((high - plan.proteinNoDeficit * 4 - fat * 9) / 4);
    return withFiber({ kcal: Math.round(high), p: plan.proteinNoDeficit, c: carbs, f: fat }, 'high', 'Zi cu calorii mari');
  }
  return withFiber(macrosFor(low, m.p, plan.carbShare), 'low', 'Zi cu calorii mici');
}

/** Moves carbs and fat by a percentage; protein stays (ch. 10). */
export function shiftCarbsFat(m: Macros, pct: number): Macros {
  const c = round5(m.c * (1 + pct / 100));
  const f = Math.max(1, Math.round(m.f * (1 + pct / 100)));
  return { kcal: m.p * 4 + c * 4 + f * 9, p: m.p, c, f };
}
