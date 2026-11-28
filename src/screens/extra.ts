/* 2026-11-14: the end of the diet (goal card on Corp), blood tests (a section of Mai mult) and the training
   supplement stack (on Suplimente). Kept apart from body.ts and fuel.ts, which only call in here. */
import { ctx, esc, n0, n1, parseNum } from '../app.ts';
import { BAND, dateRo, goalView, milestones, STOP_WEEKS, type GoalPace } from '../logic/goal.ts';
import { deficitFactor, kcalFloor, shiftCarbsFat } from '../logic/calc.ts';
import { currentPace, decision, keepFatFloor, shiftPct } from './pilot.ts';
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
  return `<section class="card goal review ${cls}"><h2>${esc(v.title)}</h2>${bar}<p>${esc(v.text)}</p>${paceLine(currentPace())}${go}${sel}
    <details><summary class="hint">Schimbă ținta</summary>${form('Salvează')}<button class="ghost wide" data-goal="off">Șterge ținta</button></details></section>
  ${roadCard()}`;
}

/** What the date asks for and what the calories aim at (2026-11-28). */
function paceLine(p: GoalPace | null): string {
  if (!p) return '';
  const s = ctx.get();
  const want = `Ca să ajungi la ${kg(s.goal!.kg)} kg până pe ${esc(dateRo(p.deadline))} îți trebuie ${kg(p.needKg)} kg pe săptămână (${n1(p.needPct)}% din greutate).`;
  if (p.capped) return `<p class="warn">${want} E peste limita sigură de ${n1(p.pct)}% pe săptămână pentru grăsimea ta, așa că ținta de calorii merge la limită: la ritmul ăsta ajungi pe ${esc(dateRo(p.deadline))} în jur de ${kg(p.at)} kg. Ca să prinzi ținta, mută data mai târziu.</p>`;
  return `<p class="hint">${want} Caloriile sunt calculate pentru ritmul ăsta${s.pilot?.on ? ', iar pilotul le recalculează din întreținerea măsurată, o dată pe săptămână' : '; pornește pilotul (Carb Cycling → Reguli) ca să le recalculeze singur din întreținerea măsurată'}.</p>`;
}

/** The weight the road asks for on each date, and the trend on the dates already passed. */
function roadCard(): string {
  const s = ctx.get();
  const g = s.goal;
  if (!g?.by || s.plan!.phase !== 'cut') return '';
  const points = weightTrend(s.weights, trendAlpha(s.plan!.phase));
  const rows = milestones(g, points, ctx.today());
  if (!rows.length) return '';
  const now = rows.find((r) => r.kind === 'now' || r.kind === 'stop');
  const head = now ? `<p class="big"><b>${kg(now.kg)}</b> kg până pe ${esc(shortDate(now.date))}</p><p class="hint">Atât ar trebui să arate tendința la următorul reper ca să fii pe drum. ${points.length ? `Acum e ${kg(points.at(-1)!.trend)} kg.` : ''}</p>` : '';
  const row = (m: (typeof rows)[number]) => {
    const diff = m.got != null ? m.got - m.kg : null;
    const mark = m.kind === 'by' ? '<em>selecția, la menținere</em>' : m.kind === 'stop' ? '<em>se oprește deficitul</em>' : diff == null ? '' : `<em class="${diff <= 0.2 ? 'ok' : 'off'}">${diff <= 0.2 ? '✓' : '+'}${diff <= 0.2 ? '' : kg(diff)} ${diff <= 0.2 ? `${kg(m.got!)} kg` : 'kg peste'}</em>`;
    return `<div class="line ms ${m.kind}"><span>${esc(shortDate(m.date))}</span><b>${kg(m.kg)} kg</b>${mark}</div>`;
  };
  return `<section class="card road-ms"><h2>Greutatea pe date</h2>${head}
    <p class="hint">Drumul de la ${kg(g.line?.kg ?? g.from)} kg la ${kg(g.kg)} kg, cu același procent pe săptămână. ✓ = tendința a fost sub reper în ziua aceea.</p>
    ${rows.map(row).join('')}</section>`;
}

/**
 * The calories the date asks for, applied when the goal is saved: from the measured maintenance when the pilot has
 * one, else from the plan's. Protein stays, carbs and fat move, never under the floor (same rules as the pilot).
 */
function applyPace(): string | null {
  const s = ctx.get();
  const plan = s.plan!, profile = s.profile!;
  const p = currentPace();
  if (!p) return null;
  const t = decision()?.tdee;
  const maint = t?.usable ? t.kcal : plan.maintenance;
  const now = weightTrend(s.weights, trendAlpha(plan.phase)).at(-1)?.trend ?? profile.weightKg;
  const deficit = Math.round(((now * p.pct) / 100) * deficitFactor({ ...profile, weightKg: now }));
  const kcal = Math.max(kcalFloor(profile.sex), Math.round((maint - deficit) / 10) * 10);
  plan.ratePct = p.pct;
  const delta = kcal - plan.macros.kcal;
  if (Math.abs(delta) < 40) return null;
  const pct = shiftPct(plan.macros.kcal, plan.macros.p, delta);
  const next = keepFatFloor(shiftCarbsFat(plan.macros, pct), now);
  plan.adjustments = [...plan.adjustments, { date: ctx.today(), pct: Math.round(pct * 10) / 10, note: `Ținta: ${n1(p.pct)}%/săpt până pe ${p.deadline}`, from: plan.macros.kcal, to: next.kcal }];
  plan.macros = next;
  return `Noua țintă: ${n0(next.kcal)} kcal, pentru ${n1(p.pct)}% pe săptămână.`;
}

/** Keeps the plan's rate on what the date asks for, so the weekly review and the chart judge by it. Once a render. */
export function goalSync(): boolean {
  const s = ctx.get();
  const g = s.goal;
  if (!g || !s.plan || s.plan.phase !== 'cut') return false;
  let changed = false;
  if (g.by && !g.line) {
    const now = weightTrend(s.weights, trendAlpha(s.plan.phase)).at(-1)?.trend;
    if (now != null) { g.line = { date: ctx.today(), kg: Math.round(now * 10) / 10 }; changed = true; }
  }
  const p = currentPace();
  if (p && Math.abs(s.plan.ratePct - p.pct) >= 0.01) { s.plan.ratePct = p.pct; changed = true; }
  return changed;
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
    const by = String(d.get('by') ?? '');
    const before = { goal: s.goal ? { ...s.goal } : null, macros: s.plan!.macros, ratePct: s.plan!.ratePct, adjustments: s.plan!.adjustments };
    // a new weight or a new date starts a new road from today's trend
    const fresh = !s.goal || s.goal.kg !== target || s.goal.by !== by;
    const line = fresh || !s.goal?.line ? { date: ctx.today(), kg: Math.round(now * 10) / 10 } : s.goal.line;
    s.goal = { kg: target, by, from: s.goal?.from ?? Math.round(now * 10) / 10, ...(s.goal?.hold ? { hold: s.goal.hold } : {}), ...(by ? { line } : {}) };
    const moved = s.plan!.phase === 'cut' ? applyPace() : null;
    ctx.commit(); ctx.render();
    ctx.toast(moved ? `Ținta e salvată. ${moved}` : 'Ținta e salvată.', () => { s.goal = before.goal; Object.assign(s.plan!, { macros: before.macros, ratePct: before.ratePct, adjustments: before.adjustments }); ctx.commit(); ctx.render(); });
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
