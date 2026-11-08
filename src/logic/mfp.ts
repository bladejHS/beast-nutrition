/* MyFitnessPal, both ways (asked for on 2026-11-08; the user has Premium).
   MyFitnessPal has no public API: nothing can write its goals or read its diary on its own. So:
   - to MyFitnessPal: the day targets, ready to type into Premium's goals by day (see the Plan screen);
   - from MyFitnessPal: Premium's data export (Reports → Export Data, or Export on the Progress and Nutrition
     screens), a ZIP sent by e-mail with three CSV files: Nutrition Summary (one row per meal), Progress Summary
     (weight and measurements) and Exercise Summary. What was eaten goes into the journal and the weigh-ins into the
     weights, so the app's own maintenance from data (Fat Loss Forever, ch. 11) runs on the real numbers.
   MyFitnessPal does not publish the columns, so they are found by name, not by position, and dates in ISO, US and
   Romanian order are read. Importing again replaces what an earlier import put in, never what was logged here. */
import { MEALS, type Entry, type State } from './store.ts';

export interface MfpMeal { meal: string; kcal: number; p: number; c: number; f: number; fiber: number }
export interface MfpData {
  /** date → the meals of that day, in the export's order. */
  meals: Record<string, MfpMeal[]>;
  /** date → kg. */
  weights: Record<string, number>;
  /** Files that were recognised. */
  read: number;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** A number as an export writes it: 1234.5, 1,234.5 or 12,5. */
export function num(v: string | undefined): number {
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/** 2026-11-02, 11/2/2026 (month first, as the American export writes it) or 02.11.2026. */
export function isoDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return ymd(+m[3]!, +m[1]!, +m[2]!);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return ymd(+m[3]!, +m[2]!, +m[1]!);
  return null;
}

const find = (head: string[], re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h.trim()) && !(not && not.test(h)));
const DATE = /^(date|data)\b/i;

/** Reads the CSV files of an export; `bodyKg` tells pounds from kilograms when the header doesn't say. */
export function readMfp(files: { name: string; text: string }[], bodyKg = 0): MfpData {
  const out: MfpData = { meals: {}, weights: {}, read: 0 };
  for (const file of files) {
    const rows = parseCsv(file.text);
    const hi = rows.slice(0, 6).findIndex((r) => r.some((c) => DATE.test(c.trim())));
    if (hi < 0) continue;
    const head = rows[hi]!;
    const body = rows.slice(hi + 1);
    const d = find(head, DATE);
    const kcal = find(head, /^(calories|calorii|energy|energie)/i);
    const p = find(head, /^protein/i);
    if (kcal >= 0 && p >= 0) {
      const meal = find(head, /^(meal|mas[aă])/i);
      const c = find(head, /^(carbohydrat|carbohidra|carbs)/i);
      const f = find(head, /^(fat|gr[aă]sim)/i, /sat|trans|poly|mono/i);
      const fiber = find(head, /^(fiber|fibre|fibr)/i);
      for (const r of body) {
        const date = isoDate(r[d] ?? '');
        if (!date) continue;
        const name = (meal >= 0 ? r[meal] : '')?.trim() || 'Masă';
        const list = (out.meals[date] ??= []);
        const same = list.find((x) => x.meal === name);
        const add = { kcal: num(r[kcal]), p: num(r[p]), c: c >= 0 ? num(r[c]) : 0, f: f >= 0 ? num(r[f]) : 0, fiber: fiber >= 0 ? num(r[fiber]) : 0 };
        if (same) { same.kcal += add.kcal; same.p += add.p; same.c += add.c; same.f += add.f; same.fiber += add.fiber; }
        else list.push({ meal: name, ...add });
      }
      out.read++;
      continue;
    }
    const w = find(head, /weight|greutate/i);
    const type = find(head, /^(measurement|type|tip)/i), value = find(head, /^(value|valoare)/i);
    if (w < 0 && (type < 0 || value < 0)) continue;
    const found: Record<string, number> = {};
    for (const r of body) {
      const date = isoDate(r[d] ?? '');
      if (!date) continue;
      const v = w >= 0 ? num(r[w]) : /weight|greutate/i.test(r[type] ?? '') ? num(r[value]) : 0;
      if (v > 0) found[date] = v;
    }
    const vals = Object.values(found).sort((a, b) => a - b);
    const mid = vals[Math.floor(vals.length / 2)] ?? 0;
    const lbs = /\blb/i.test(w >= 0 ? head[w]! : '') || (bodyKg > 0 && mid > bodyKg * 1.6);
    for (const [date, v] of Object.entries(found)) out.weights[date] = Math.round((lbs ? v * 0.45359237 : v) * 10) / 10;
    out.read++;
  }
  return out;
}

/** The app's meal slot for an export's meal: breakfast, lunch, dinner, snacks, or the order they came in. */
export function mealSlot(name: string, order: string[]): number {
  const n = name.toLowerCase();
  if (/breakfast|mic dejun/.test(n)) return 0;
  if (/lunch|pr[aâ]nz/.test(n)) return 1;
  if (/dinner|cin[aă]/.test(n)) return 2;
  if (/snack|gust[aă]r/.test(n)) return 3;
  const i = order.indexOf(name);
  return Math.min(MEALS.length - 1, i < 0 ? 3 : i);
}

export const isMfp = (e: Entry) => e.id.startsWith('mfp:');

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Puts an export into the state: the days it covers lose only their earlier imported entries. */
export function mergeMfp(s: State, d: MfpData): { days: number; weighIns: number } {
  let days = 0;
  for (const [date, meals] of Object.entries(d.meals)) {
    if (!meals.some((m) => m.kcal > 0)) continue;
    const day: Entry[][] = MEALS.map((_, i) => (s.days[date]?.[i] ?? []).filter((e) => !isMfp(e)));
    const order = meals.map((m) => m.meal);
    meals.forEach((m, k) => {
      if (m.kcal <= 0) return;
      const slot = mealSlot(m.meal, order);
      day[slot]!.push({ id: `mfp:${date}:${k}`, name: `MyFitnessPal · ${m.meal}`, g: 0, kcal: Math.round(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fiber: r1(m.fiber) });
    });
    s.days[date] = day;
    days++;
  }
  for (const [date, kg] of Object.entries(d.weights)) s.weights[date] = kg;
  return { days, weighIns: Object.keys(d.weights).length };
}

/** The files of a ZIP archive (stored or deflated), through the browser's own DecompressionStream. */
export async function unzip(buf: ArrayBuffer): Promise<{ name: string; data: Uint8Array }[]> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let end = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Fișierul nu e o arhivă ZIP.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out: { name: string; data: Uint8Array }[] = [];
  for (let k = 0; k < count && v.getUint32(p, true) === 0x02014b50; k++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), note = v.getUint16(p + 32, true), at = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + note;
    if (name.endsWith('/')) continue;
    const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true);
    const raw = u8.slice(start, start + size);
    if (method === 0) out.push({ name, data: raw });
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out.push({ name, data: new Uint8Array(await new Response(stream).arrayBuffer()) });
    }
  }
  return out;
}

/** What a picked file holds: the CSV files inside a ZIP, or the CSV itself. */
export async function exportFiles(files: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }[]): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  const dec = new TextDecoder();
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const zip = buf.byteLength > 4 && new DataView(buf).getUint32(0, true) === 0x04034b50;
    if (zip) for (const x of await unzip(buf)) { if (/\.csv$/i.test(x.name)) out.push({ name: x.name, text: dec.decode(x.data) }); }
    else out.push({ name: f.name, text: dec.decode(buf) });
  }
  return out;
}
