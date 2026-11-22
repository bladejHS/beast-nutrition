/* The rails of the automatic coaching (2026-11-22). Written from the research notes in
   research_notes/Carb cycling si coaching automat/, and deliberately separate from the plan's maths: calc.ts decides
   what the day should be, this file decides what must never happen whatever the maths says.

   Three things the evidence is clear about for this user — 134 kg, over 30% fat, lifting, in a deficit, on semaglutide:

   1. Protein is a floor, not a target. The three usual denominators converge here: 2.3 g/kg of fat-free mass
      (Helms 2014, lean athletes) ≈ 209 g, 1.6 g/kg of total mass (clinical GLP-1 guidance) ≈ 214 g, 2.0 g/kg of goal
      weight ≈ 210 g. The naive "2.4 g/kg of total mass" = 322 g is unsupported and, on a drug that cuts intake by a
      quarter, impossible. Real GLP-1 users average 77 g a day and only 43% reach 1.2 g/kg, while lean tissue is about
      40% of everything they lose (STEP 1: −9.7% lean mass at week 68). So the app watches the floor, loudly.

   2. The cap on how fast to lose depends on how much fat there is. The only randomised test in trained lifters
      (Garthe 2011, 0.7%/week vs 1.4%/week) favoured the slow arm for lean mass (+2.1% vs −0.2%), but those were lean
      athletes, and at twelve months the difference was gone. In obesity the picture is kinder: MATADOR's 33% deficit
      cost 1.2–1.8 kg of fat-free mass against 9–14 kg lost, without lifting. So the cap scales with body fat, and
      losing faster than the cap is an alert to eat more — on this drug the likely failure is too big a deficit, not
      too small.

   3. Metabolic adaptation is small (80–180 kcal a day during restriction), halves once weight is stable and is gone
      at a year (Martins et al.). It is smaller than the error of any prediction formula, so nothing here applies an
      "adaptation correction": the measured maintenance in tdee.ts replaces the formula instead. */
import { lbmKg, type Profile } from './calc.ts';

/** The protein the day must not fall below, in grams. */
export function proteinFloor(p: Profile, goalKg?: number): number {
  const byLean = 2.3 * lbmKg(p);
  const byTotal = 1.6 * p.weightKg;
  const byGoal = goalKg && goalKg > 0 ? 2.0 * goalKg : byLean;
  // the lowest of the three, so the floor is the one every denominator agrees on
  return Math.round(Math.min(byLean, byTotal, byGoal) / 5) * 5;
}

/** Under this, the day is a problem whatever else happened: 1.2 g/kg of total mass, the clinical minimum. */
export const proteinRedLine = (p: Profile): number => Math.round((1.2 * p.weightKg) / 5) * 5;

/** The fastest sensible weekly loss, in % of body mass, by how much fat there is to lose. */
export function rateCap(bf: number): number {
  if (bf >= 30) return 1.2;
  if (bf >= 25) return 1.0;
  if (bf >= 15) return 0.7;
  return 0.5;
}

/** The rate to aim for: comfortably under the cap, so a normal week never trips the alert. */
export const rateTarget = (bf: number) => Math.round(rateCap(bf) * 0.75 * 100) / 100;

export type Flag =
  | { id: 'protein-low'; level: 'warn'; got: number; need: number }
  | { id: 'protein-red'; level: 'stop'; got: number; need: number }
  | { id: 'too-fast'; level: 'warn'; rate: number; cap: number }
  | { id: 'too-slow'; level: 'info'; rate: number; target: number }
  | { id: 'kcal-floor'; level: 'stop'; kcal: number; floor: number };

export interface Check {
  profile: Profile;
  goalKg?: number;
  /** Mean protein actually eaten over the window, grams a day; null when too little was logged. */
  proteinG: number | null;
  /** Weekly change of the trend, in % of body mass: negative when losing. */
  ratePct: number | null;
  kcal: number;
  kcalFloor: number;
}

/**
 * Everything that is off, worst first. Nothing here is advice about food; it is the list of limits the automatic
 * coaching must respect before it is allowed to change anything.
 */
export function checkSafety(x: Check): Flag[] {
  const out: Flag[] = [];
  const floor = proteinFloor(x.profile, x.goalKg);
  const red = proteinRedLine(x.profile);
  if (x.proteinG != null) {
    if (x.proteinG < red) out.push({ id: 'protein-red', level: 'stop', got: Math.round(x.proteinG), need: red });
    else if (x.proteinG < floor * 0.9) out.push({ id: 'protein-low', level: 'warn', got: Math.round(x.proteinG), need: floor });
  }
  if (x.kcal < x.kcalFloor) out.push({ id: 'kcal-floor', level: 'stop', kcal: Math.round(x.kcal), floor: x.kcalFloor });
  if (x.ratePct != null) {
    const cap = rateCap(x.profile.bf);
    const loss = -x.ratePct;
    if (loss > cap) out.push({ id: 'too-fast', level: 'warn', rate: Math.round(loss * 100) / 100, cap });
    else if (loss >= 0 && loss < rateTarget(x.profile.bf) * 0.4) out.push({ id: 'too-slow', level: 'info', rate: Math.round(loss * 100) / 100, target: rateTarget(x.profile.bf) });
  }
  const order = { stop: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** What each flag means, in the app's voice. */
export function flagText(f: Flag): { title: string; body: string } {
  switch (f.id) {
    case 'protein-red':
      return {
        title: 'Proteina e periculos de mică',
        body: `${f.got} g pe zi, sub minimul de ${f.need} g. Pe semaglutidă, aproape jumătate din ce slăbești poate fi masă musculară dacă proteina stă jos. Pune proteina în prima masă a zilei, înainte să scadă pofta.`,
      };
    case 'protein-low':
      return {
        title: 'Proteina sub țintă',
        body: `${f.got} g pe zi față de ${f.need} g. Ținta nu e un maxim, e un prag: sub el pierzi mai mult mușchi la aceeași slăbire.`,
      };
    case 'too-fast':
      return {
        title: 'Slăbești prea repede',
        body: `${f.rate}% pe săptămână, peste limita de ${f.cap}% pentru grăsimea ta corporală. Pe semaglutidă deficitul poate deveni prea mare fără să-ți dai seama. Se adaugă mâncare, nu se taie.`,
      };
    case 'too-slow':
      return {
        title: 'Aproape nimic nu s-a mișcat',
        body: `${f.rate}% pe săptămână față de ${f.target}% propuse. O săptămână nu înseamnă platou; două la rând, da.`,
      };
    case 'kcal-floor':
      return {
        title: 'Sub limita de calorii',
        body: `${f.kcal} kcal, sub limita de ${f.floor} kcal a aplicației. Nu se mai taie nimic: de aici se merge pe pauză de dietă sau pe mai multă mișcare.`,
      };
  }
}
