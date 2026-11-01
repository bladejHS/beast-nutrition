/* What the Azi screen works out: the order of the day and what comes next. No state, so it can be tested alone. */

const toMin = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m; };

export type DayRow =
  | { kind: 'meal'; i: number; time: string }
  | { kind: 'train'; time: string; end: string }
  | { kind: 'now'; time: string };

/** Meals and training in time order, with one "acum" marker when the day is today. */
export function dayRows(times: string[], session: { start: string; end: string } | null, now: string | null): DayRow[] {
  const rows: DayRow[] = times.map((time, i) => ({ kind: 'meal', i, time }));
  if (session) rows.push({ kind: 'train', time: session.start, end: session.end });
  rows.sort((a, b) => toMin(a.time) - toMin(b.time));
  if (now != null) {
    const at = rows.findIndex((r) => toMin(r.time) > toMin(now));
    rows.splice(at < 0 ? rows.length : at, 0, { kind: 'now', time: now });
  }
  return rows;
}

/**
 * The next meal to eat: the one after the last logged, never one long past. A skipped meal is left behind,
 * so a late start does not keep asking for breakfast. Null when the last meal of the day is logged.
 */
export function nextMeal(logged: boolean[], times: string[], nowMin: number): number | null {
  const last = logged.lastIndexOf(true);
  const due = times.findIndex((t) => toMin(t) >= nowMin - 90);
  const from = Math.max(last + 1, due < 0 ? times.length - 1 : due);
  return from < times.length ? from : null;
}

/** Inside ±15% of the day's target, the band the report and the week chart use. */
export const inBand = (eaten: number, target: number, band = 0.15) => target > 0 && Math.abs(eaten - target) <= target * band;

/** Days the band can judge, and how many are in it. A day with nothing logged is not counted against anyone. */
export function bandCount(days: { eaten: number; target: number }[]) {
  const logged = days.filter((d) => d.eaten > 0);
  return { logged: logged.length, inside: logged.filter((d) => inBand(d.eaten, d.target)).length };
}
