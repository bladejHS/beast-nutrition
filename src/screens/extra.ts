/* 2026-11-14: the end of the diet (goal card on Corp), blood tests (a section of Mai mult) and the training
   supplement stack (on Suplimente). Kept apart from body.ts and fuel.ts, which only call in here. */
import { ctx, esc, n1, parseNum } from '../app.ts';
import { BAND, dateRo, goalView, STOP_WEEKS } from '../logic/goal.ts';
import { GROUP_NAME, history, homa, LABS, labDef, labStatus, type LabDef } from '../logic/labs.ts';
import { trendAlpha, weightTrend } from '../logic/trend.ts';
import type { Supp } from '../logic/wellness.ts';
import { shortDate } from './parts.ts';
import { latestKg, trainingTime } from './state.ts';

const kg = (v: number) => n1(v);
const minus = (time: string, min: number) => { const [h, m] = time.split(':').map(Number); const t = ((h! * 60 + m! - min) % 1440 + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// ---- Goal -----------------------------------------------------------------------------------------------------

export function goalCard(): string {
  const s = ctx.get();
  const today = ctx.today();
  const g = s.goal;
  const form = (label: string) => `<form id="goalf" class="goalf">
    <label class="field">Greutatea finală, kg<input name="kg" type="text" inputmode="decimal" required value="${g ? String(g.kg).replace('.', ',') : ''}" placeholder="de ex. 105"></label>
    <label class="field">Data selecției (dacă o știi)<input name="by" type="date" value="${g?.by ?? ''}" min="${today}"></label>
    <button class="primary wide">${label}</button></form>`;
  if (!g) return `<section class="card goal"><h2>Ținta finală</h2>
    <p class="hint">Unde se oprește slăbirea. Când trendul ajunge acolo, sau cu ${STOP_WEEKS} săptămâni înaintea selecției, aplicația îți spune să ieși din deficit și apoi păstrează greutatea într-o bandă de ±${kg(BAND)} kg.</p>${form('Salvează ținta')}</section>`;
  const v = goalView(g, weightTrend(s.weights, trendAlpha(s.plan!.phase)), s.plan!.phase, today);
  const cls = v.state === 'reached' || v.state === 'stop' || v.state === 'above' ? 'act' : v.state === 'late' ? 'warn' : 'ok';
  const bar = s.plan!.phase === 'cut' && v.now != null ? `<div class="gbar"><i class="fbar"><u style="transform:scaleX(${v.done.toFixed(3)})"></u></i><p class="gends"><span>${kg(g.from)} kg</span><b>${kg(v.now)} kg acum</b><span>${kg(g.kg)} kg</span></p></div>` : '';
  const go = v.to && s.plan!.phase === 'cut' ? `<button class="primary wide" data-phase="${v.to}" data-hold="${v.now ?? ''}">Ieși din deficit: reverse diet</button>` : '';
  const sel = g.by ? `<p class="hint">Selecția: ${esc(dateRo(g.by))}${v.weeksToBy != null ? `, peste ${Math.max(0, Math.round(v.weeksToBy))} săptămâni` : ''}. Deficitul se oprește cu ${STOP_WEEKS} săptămâni înainte.</p>` : '';
  return `<section class="card goal review ${cls}"><h2>${esc(v.title)}</h2>${bar}<p>${esc(v.text)}</p>${go}${sel}
    <details><summary class="hint">Schimbă ținta</summary>${form('Salvează')}<button class="ghost wide" data-goal="off">Șterge ținta</button></details></section>`;
}

/** Before the plan's own handler changes phase: remember where the diet ended, so the band is centred there. */
export function goalAction(el: HTMLElement): boolean {
  const s = ctx.get();
  const d = el.dataset;
  if (d['hold'] != null && s.goal) { const w = parseNum(d['hold']); if (w > 0) s.goal.hold = w; return false; }
  if (d['goal'] === 'off') { const before = s.goal; s.goal = null; ctx.commit(); ctx.render(); ctx.toast('Ținta e ștearsă.', () => { s.goal = before; ctx.commit(); ctx.render(); }); return true; }
  return false;
}

export function goalBind() {
  const f = document.querySelector<HTMLFormElement>('#goalf');
  f?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = ctx.get();
    const d = new FormData(f);
    const target = parseNum(d.get('kg'));
    const now = weightTrend(s.weights, trendAlpha(s.plan!.phase)).at(-1)?.trend ?? latestKg();
    if (!(target > 40 && target < 250)) { ctx.toast('Scrie greutatea finală în kilograme.'); return; }
    if (s.plan!.phase === 'cut' && target >= now) { ctx.toast(`Ținta trebuie să fie sub greutatea de acum (${kg(now)} kg).`); return; }
    s.goal = { kg: target, by: String(d.get('by') ?? ''), from: s.goal?.from ?? Math.round(now * 10) / 10, ...(s.goal?.hold ? { hold: s.goal.hold } : {}) };
    ctx.commit(); ctx.render(); ctx.toast('Ținta e salvată.');
  });
}

// ---- Blood tests -----------------------------------------------------------------------------------------------

const unitVal = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
const STATUS = { low: 'sub interval', ok: 'în interval', high: 'peste interval' };

export function labsHtml(back: string, head: string): string {
  const s = ctx.get();
  const groups = Object.keys(GROUP_NAME) as LabDef['group'][];
  const row = (l: LabDef) => {
    const h = history(s.labs, l.id);
    const last = h.at(-1), prev = h.at(-2);
    if (!last) return `<div class="line lab"><span><b>${esc(l.name)}</b><small class="hint">${esc(l.why)}</small></span><em class="hint">—</em></div>`;
    const st = labStatus(last);
    const diff = prev ? last.value - prev.value : null;
    const range = [last.lo ?? l.lo, last.hi ?? l.hi];
    const rangeTxt = range[0] != null && range[1] != null ? `${unitVal(range[0])}–${unitVal(range[1])}` : range[1] != null ? `sub ${unitVal(range[1])}` : `peste ${unitVal(range[0]!)}`;
    return `<details class="lab"><summary class="line"><span><b>${esc(l.name)}</b><small class="hint">${esc(shortDate(last.date))} · interval ${rangeTxt} ${esc(l.unit)}</small></span>
      <span class="lv ${st}"><b>${unitVal(last.value)}</b> <small>${esc(l.unit)}</small><small>${STATUS[st]}${diff != null && diff !== 0 ? ` · ${diff > 0 ? '+' : '−'}${unitVal(Math.abs(diff))}` : ''}</small></span></summary>
      <p class="hint">${esc(l.why)}</p>
      ${[...h].reverse().map((r) => `<div class="line"><span>${esc(r.date)}</span><b>${unitVal(r.value)} ${esc(l.unit)}</b><button class="xs" data-lab-del="${r.id}" aria-label="Șterge rezultatul din ${esc(r.date)}">×</button></div>`).join('')}</details>`;
  };
  const hm = homa(s.labs);
  return `${back}${head}
  <section class="card"><h2>Adaugă un rezultat</h2><form id="labf">
    <label class="field">Analiza<select name="marker">${groups.map((g) => `<optgroup label="${GROUP_NAME[g]}">${LABS.filter((l) => l.group === g).map((l) => `<option value="${l.id}">${esc(l.name)} (${esc(l.unit)})</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label class="field">Data recoltării<input name="date" type="date" required value="${ctx.today()}" max="${ctx.today()}"></label>
    <label class="field">Valoarea<input name="value" type="text" inputmode="decimal" required></label>
    <details><summary class="hint">Intervalul de pe buletin (opțional)</summary><div class="two"><label class="field">Minim<input name="lo" type="text" inputmode="decimal"></label><label class="field">Maxim<input name="hi" type="text" inputmode="decimal"></label></div></details>
    <button class="primary wide">Salvează</button></form>
    <p class="hint">Verifică unitatea de pe buletin: unele laboratoare dau glicemia în mmol/L sau testosteronul în nmol/L. Intervalele de aici sunt orientative pentru bărbați adulți; cele de pe buletin au prioritate.</p></section>
  ${hm ? `<section class="card"><h2>HOMA-IR: ${unitVal(hm.value)}</h2><p class="hint">Din glicemia și insulina pe nemâncate din ${esc(shortDate(hm.date))}. Peste aproximativ 2,5 sugerează rezistență la insulină; discută cifra cu medicul.</p></section>` : ''}
  ${groups.map((g) => `<section class="card"><h2>${GROUP_NAME[g]}</h2>${LABS.filter((l) => l.group === g).map(row).join('')}</section>`).join('')}
  <section class="card"><h2>Când</h2><p class="hint">La început, apoi la 3–6 luni cât timp slăbești și iei semaglutidă. Dimineața, pe nemâncate, fără antrenament greu cu o zi înainte (urcă AST-ul și creatinina). Interpretarea rămâne la medic.</p></section>`;
}

export function labsAction(el: HTMLElement): boolean {
  const id = el.dataset['labDel'];
  if (!id) return false;
  const s = ctx.get();
  const before = s.labs;
  s.labs = s.labs.filter((r) => r.id !== id);
  ctx.commit(); ctx.render();
  ctx.toast('Rezultat șters.', () => { s.labs = before; ctx.commit(); ctx.render(); });
  return true;
}

export function labsBind() {
  const f = document.querySelector<HTMLFormElement>('#labf');
  f?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = ctx.get();
    const d = new FormData(f);
    const marker = String(d.get('marker')), value = parseNum(d.get('value'));
    const loT = String(d.get('lo') ?? '').trim(), hiT = String(d.get('hi') ?? '').trim();
    if (!labDef(marker) || !(value >= 0) || String(d.get('value') ?? '').trim() === '') { ctx.toast('Scrie valoarea de pe buletin.'); return; }
    s.labs = [...s.labs, { id: crypto.randomUUID(), marker, date: String(d.get('date')), value, ...(loT ? { lo: parseNum(loT) } : {}), ...(hiT ? { hi: parseNum(hiT) } : {}) }];
    ctx.commit(); ctx.render(); ctx.toast(`${labDef(marker)!.name}: salvat.`);
  });
}

// ---- Training supplement stack ---------------------------------------------------------------------------------

interface StackItem { ingredient: string; product: string; serving: string; mg: number; time: (t: string) => string; freq: string; notes: string; match: RegExp }

/** The evidence-backed four for strength, sprints and intervals (ISSN position stands). Information, not a prescription. */
const STACK: StackItem[] = [
  { ingredient: 'Creatină', product: 'Creatină monohidrat', serving: '5 g', mg: 5000, time: () => 'Cu o masă, oricând', freq: 'Zilnic', match: /creatin/i, notes: 'Zilnic, și în zilele libere. Efectul vine din saturarea mușchilor, nu din momentul prizei.' },
  { ingredient: 'Cafeină', product: 'Cafeină (sau cafea)', serving: '200 mg', mg: 200, time: (t) => `${minus(t, 45)}, cu 30–60 min înainte de antrenament`, freq: 'Zilele de antrenament greu', match: /cafein|caffein/i, notes: 'Studiile folosesc 3–6 mg/kg, dar efectul apare și de la doze mici. Începe cu 200 mg și nu trece de 400 mg pe zi, cu cafeaua inclusă. După ora 16 îți strică somnul: în zilele cu antrenament seara, sari peste ea.' },
  { ingredient: 'Beta-alanină', product: 'Beta-alanină', serving: '1,6 g de două ori', mg: 3200, time: () => 'Cu micul dejun și cu cina', freq: 'Zilnic', match: /beta.?alanin/i, notes: 'Ajută la eforturile de 1–4 minute (runde, intervale, 1.000 m). Furnicăturile sunt normale; dozele mici, cu masă, le reduc. Efectul apare după 4 săptămâni.' },
  { ingredient: 'Nitrați', product: 'Suc de sfeclă concentrat', serving: '70 ml (~6 mmol nitrați)', mg: 0, time: (t) => `${minus(t, 150)}, cu 2–3 ore înainte de antrenament`, freq: 'Zilele cu intervale sau sprint', match: /nitra|sfecl|beet/i, notes: 'Pentru eforturile repetate de intensitate mare. Fără apă de gură antiseptică în ziua respectivă: oprește efectul. Urina roșie e inofensivă.' },
];

export function stackCard(): string {
  const s = ctx.get();
  const t = trainingTime(ctx.today());
  const has = (x: StackItem) => s.supps.some((y) => x.match.test(`${y.ingredient} ${y.product}`));
  const missing = STACK.filter((x) => !has(x));
  return `<section class="card stack"><h2>Stack-ul pentru antrenament</h2>
    <p class="hint">Cele patru cu cele mai bune dovezi pentru forță, sprint și intervale. Orele sunt calculate după antrenamentul de azi, la ${esc(t)}. Informație, nu prescripție: cu semaglutidă sau alt tratament, întreabă și medicul.</p>
    ${STACK.map((x) => `<div class="line"><span><b>${esc(x.product)}</b> · ${esc(x.serving)}<small class="hint">${esc(x.time(t))}. ${esc(x.notes)}</small></span>${has(x) ? '<em class="ok">pe listă</em>' : `<button class="ghost add" data-stack="${esc(x.ingredient)}">Adaugă</button>`}</div>`).join('')}
    ${missing.length > 1 ? `<button class="ghost wide" data-stack="*">Adaugă-le pe toate (${missing.length})</button>` : ''}</section>`;
}

export function stackAction(el: HTMLElement): boolean {
  const which = el.dataset['stack'];
  if (!which) return false;
  const s = ctx.get();
  const t = trainingTime(ctx.today());
  const before = [...s.supps];
  const add = STACK.filter((x) => (which === '*' || x.ingredient === which) && !s.supps.some((y) => x.match.test(`${y.ingredient} ${y.product}`)));
  const made: Supp[] = add.map((x) => ({ id: crypto.randomUUID(), product: x.product, brand: '', ingredient: x.ingredient, serving: x.serving, mgPerDay: x.mg, time: x.time(t), freq: x.freq, start: ctx.today(), notes: x.notes }));
  s.supps = [...s.supps, ...made];
  ctx.commit(); ctx.render();
  ctx.toast(made.length === 1 ? `${made[0]!.product}: adăugat.` : `${made.length} suplimente adăugate.`, () => { s.supps = before; ctx.commit(); ctx.render(); });
  return true;
}
