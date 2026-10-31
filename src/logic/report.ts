/* The weekly report: averages of saved data and plain rules. Correlations are shown, never called causes. */
export interface DayFacts {
  date: string; kcal: number; p: number; c: number; f: number; fiber: number;
  tKcal: number; tP: number; tC: number; demand: string; plannedSessions: number; doneSessions: number; water: number; suppsTaken: number; fastKept: boolean | null;
}

export interface Report {
  week: string;
  logged: number;
  avg: { kcal: number; p: number; c: number; f: number; fiber: number; water: number };
  target: { kcal: number; p: number };
  demand: Record<string, number>;
  planned: number;
  done: number;
  carbFit: number | null;
  suppDays: number;
  fastKept: number;
  fastKnown: number;
  weight: number | null;
  weightChange: number | null;
  waist: number | null;
  recs: string[];
}

const mean = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

export function buildReport(week: string, days: DayFacts[], weight: number | null, prevWeight: number | null, waist: number | null): Report {
  const logged = days.filter((d) => d.kcal > 0);
  const avgOf = (f: (d: DayFacts) => number) => Math.round(mean(logged.map(f)));
  const demand: Record<string, number> = { high: 0, moderate: 0, low: 0, rest: 0 };
  for (const d of days) demand[d.demand] = (demand[d.demand] ?? 0) + 1;
  const fits = logged.filter((d) => d.tC > 0).map((d) => Math.abs(d.c - d.tC) / d.tC <= 0.15);
  const known = days.filter((d) => d.fastKept != null);
  const r: Report = {
    week, logged: logged.length,
    avg: { kcal: avgOf((d) => d.kcal), p: avgOf((d) => d.p), c: avgOf((d) => d.c), f: avgOf((d) => d.f), fiber: avgOf((d) => d.fiber), water: Math.round(mean(days.filter((d) => d.water > 0).map((d) => d.water))) },
    target: { kcal: Math.round(mean(days.map((d) => d.tKcal))), p: Math.round(mean(days.map((d) => d.tP))) },
    demand, planned: days.reduce((s, d) => s + d.plannedSessions, 0), done: days.reduce((s, d) => s + d.doneSessions, 0),
    carbFit: fits.length ? Math.round((fits.filter(Boolean).length / fits.length) * 100) : null,
    suppDays: days.filter((d) => d.suppsTaken > 0).length, fastKept: known.filter((d) => d.fastKept).length, fastKnown: known.length,
    weight, weightChange: weight != null && prevWeight != null ? weight - prevWeight : null, waist, recs: [],
  };
  const recs: string[] = [];
  if (logged.length < 4) recs.push(`Ai notat mâncarea în ${logged.length} zile din 7. Cu mai multe zile notate, mediile devin de încredere.`);
  if (logged.length && r.avg.p < r.target.p * 0.9) recs.push(`Proteina a fost în medie ${r.avg.p} g, sub ținta de ${r.target.p} g. Adaugă o sursă de proteine la masa cea mai slabă.`);
  const fiberTarget = (r.avg.kcal / 1000) * 10;
  if (logged.length && r.avg.fiber < fiberTarget) recs.push(`Fibrele au fost în medie ${r.avg.fiber} g, sub minimul de ${Math.round(fiberTarget)} g pentru caloriile tale. Adaugă legume, leguminoase sau fructe.`);
  if (logged.length && Math.abs(r.avg.kcal - r.target.kcal) <= r.target.kcal * 0.05) recs.push('Media caloriilor a fost la 5% de plan. Continuă la fel.');
  if (r.planned && r.done < r.planned * 0.6) recs.push(`Ai făcut ${r.done} din ${r.planned} sesiuni planificate. Zilele sărite au fost trecute automat la odihnă în distribuția de carbohidrați.`);
  r.recs = recs.slice(0, 3);
  return r;
}
