/* The weight trend: a smoothed line through a noisy daily scale, for the chart on Corp. Decisions stay on the weekly averages. */
import type { Phase } from './calc.ts';

export interface TrendPoint { date: string; kg: number; trend: number }

/** A stronger reaction during a cut, where a slow line would read high; a calm one when weight should hold still. */
export const trendAlpha = (phase: Phase) => (phase === 'cut' ? 0.25 : 0.1);

const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Exponential smoothing that knows about missed days: nothing is filled in, a gap simply counts for more. */
export function weightTrend(weights: Record<string, number>, alpha: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const date of Object.keys(weights).sort()) {
    const kg = weights[date]!;
    const prev = out.at(-1);
    const trend = prev ? prev.trend + (1 - (1 - alpha) ** dayGap(prev.date, date)) * (kg - prev.trend) : kg;
    out.push({ date, kg, trend });
  }
  return out;
}

/** The chart's vertical range, never narrower than `span` kg, so a small change does not fill the screen. */
export function chartRange(values: number[], span = 3): [number, number] {
  const lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo >= span) return [lo, hi];
  const mid = (hi + lo) / 2;
  return [mid - span / 2, mid + span / 2];
}

/** Change of the trend over `days`, or null when there is no point that old. */
export function trendChange(points: TrendPoint[], days = 7): number | null {
  const last = points.at(-1);
  if (!last) return null;
  const then = [...points].reverse().find((p) => dayGap(p.date, last.date) >= days);
  return then ? last.trend - then.trend : null;
}
