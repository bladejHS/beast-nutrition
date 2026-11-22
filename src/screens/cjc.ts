/* CJC-1295 no DAC + Ipamorelin (2026-11-21): its own screen under Peptide, like Semaglutidă. The user set the schema
   and asked for tracking with the rules applied by the app: 5 nights on / 2 off, 12 weeks then 4 off, fasted 2 hours
   before and nothing 30 minutes after, +50 mcg after 2 tolerated weeks (automatically up to 200, by hand to 300), back
   50 when an increase brings side effects, abdomen left/right. The logic lives in logic/rx.ts. */
import { ctx, esc } from '../app.ts';
import { addDays, avgSleep, CJC_AUTO_MAX, CJC_FX, CJC_SCHEMA, cjcAdherence, cjcCycle, cjcNextIn, cjcNextSite, cjcRaise, cjcTonight, cycleGrid, isCjc, recentFx, RX_SITES, type Rx } from '../logic/rx.ts';
import { bestWater, daysOfVial, dosesIn, mcgPerUnit, mlFor, U_PER_ML, unit, unitsFor, VIAL_MG, vialWarning, WATER_ML, type Vial } from '../logic/vial.ts';
import { back, head } from './parts.ts';
import { countdownRing, pepIn, siteMap } from './pepviz.ts';

const num = (v: number) => String(v).replace('.', ',');
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const plus30 = (t: string) => { const m = (Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + 30) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const latestLab = (id: string) => ctx.get().labs.filter((x) => x.marker === id).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
const cjc = () => (ctx.get().rx ?? []).find(isCjc);

function weightSince(from: string): [number, number] | null {
  const w = Object.entries(ctx.get().weights).sort(([a], [b]) => a.localeCompare(b));
  if (w.length < 2) return null;
  const before = [...w].reverse().find(([d]) => d <= from) ?? w[0]!;
  return [before[1], w.at(-1)![1]];
}

const PEP: Array<['cjc' | 'ipa', string]> = [['cjc', 'CJC-1295 no DAC'], ['ipa', 'Ipamorelin']];
const vialOf = (r: Rx, k: 'cjc' | 'ipa'): Vial | null => r.vials?.[k] ?? null;

/** The two vials, ready only when both are mixed. */
function syringe(r: Rx, mcg: number): string {
  const a = vialOf(r, 'cjc'), b = vialOf(r, 'ipa');
  if (!a || !b) return `<p class="hint">Spune mai jos ce flacoane ai, ca să îți arăt câte unități tragi.</p>`;
  const ua = unitsFor(a, mcg), ub = unitsFor(b, mcg);
  const ml = mlFor(a, mcg) + mlFor(b, mcg);
  return `<div class="syr">
    <div class="syr-n"><b>${num(ua)}</b><span>unități CJC</span></div>
    <i>+</i>
    <div class="syr-n"><b>${num(ub)}</b><span>unități Ipamorelin</span></div>
    <i>=</i>
    <div class="syr-n tot"><b>${num(Math.round((ua + ub) * 10) / 10)}</b><span>unități în seringă</span></div>
  </div>
  <p class="hint">Pe seringa de insulină U-100: tragi CJC până la gradația ${num(ua)}, apoi Ipamorelin până ajungi la ${num(Math.round((ua + ub) * 10) / 10)}. În total ${num(Math.round(ml * 1000) / 1000)} ml.</p>
  ${[['CJC-1295', a, ua], ['Ipamorelin', b, ub]].map(([n, v, u]) => { const w = vialWarning(v as Vial, mcg); return w ? `<p class="hint bad-t">${n}: ${esc(w)}</p>` : ''; }).join('')}`;
}

/** Building a vial: what is in it, how much water, and what a unit is worth afterwards. */
function vialCard(r: Rx): string {
  const mcg = cjcTonight(r, ctx.today()).amount;
  const blocks = PEP.map(([k, name]) => {
    const v = vialOf(r, k);
    const rec = bestWater(v?.mg ?? 5, mcg);
    const chips = (list: number[], cur: number | undefined, attr: string, suffix: string) => `<div class="chips vial-ch">${list.map((x) => `<button class="${cur === x ? 'on' : ''}" data-cj="${attr}" data-k="${k}" data-d="${x}">${num(x)}${suffix}</button>`).join('')}</div>`;
    const w = v ? vialWarning(v, mcg) : null;
    return `<div class="vial"><h3>${name}</h3>
      <p class="hint">Cât scrie pe flacon</p>${chips(VIAL_MG, v?.mg, 'vmg', ' mg')}
      <p class="hint">Apă bacteriostatică de pus${v ? `, recomandat ${num(rec?.ml ?? 2)} ml` : ''}</p>${chips(WATER_ML, v?.ml, 'vml', ' ml')}
      ${v ? `<div class="line"><span>1 unitate</span><b>${num(Math.round(mcgPerUnit(v) * 10) / 10)} mcg</b></div>
        <div class="line"><span>Pentru ${mcg} mcg</span><b>${unit(unitsFor(v, mcg))} · ${num(mlFor(v, mcg))} ml</b></div>
        <div class="line"><span>Îți ajunge pentru</span><b>${dosesIn(v, mcg)} injecții · cam ${daysOfVial(v, mcg)} zile</b></div>
        ${w ? `<p class="hint bad-t">${esc(w)}</p>` : ''}` : '<p class="hint">Alege mărimea flaconului și apa, ca să calculez unitățile.</p>'}</div>`;
  }).join('');
  return `<section class="card"><h2>Construirea flacoanelor</h2>
    <p class="hint">Seringă de insulină U-100: ${U_PER_ML} unități = 1 ml, deci o unitate = 0,01 ml.</p>
    ${blocks}
    <details class="sub"><summary>Cum se reconstituie</summary>
      <ol class="ticks"><li>Șterge dopul fiecărui flacon cu alcool și lasă-l să se usuce.</li><li>Trage apa bacteriostatică în seringă și las-o să curgă încet pe peretele flaconului, nu direct pe pulbere.</li><li>Nu agita. Rotește ușor sau lasă-l să se dizolve singur, câteva minute.</li><li>Lichidul trebuie să fie limpede. Dacă rămâne tulbure sau are particule, nu îl folosi.</li><li>Ține flacoanele la frigider, 2–8 °C, la întuneric. Pulberea nedesfăcută stă la congelator.</li><li>Scrie pe flacon data amestecării. Odată reconstituit, se folosește în 3–4 săptămâni.</li></ol>
      <p class="hint">Apa bacteriostatică (cu alcool benzilic) ține flaconul bun câteva săptămâni. Apa sterilă simplă e doar pentru o singură folosire.</p></details></section>`;
}

const schema = () => `<dl class="sch">${CJC_SCHEMA.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

/** Tonight, decided by the rules. */
function tonight(r: Rx): string {
  const t = cjcTonight(r, ctx.today());
  if (t.state === 'done') {
    const d = r.log.find((x) => x.date === ctx.today())!;
    return `<section class="card trk-done"><b>Făcută azi: ${num(d.amount)} mcg din fiecare, la ${d.time}</b>
      <span>${RX_SITES[d.site]} · poți mânca de la ${plus30(d.time)}</span></section>`;
  }
  if (t.state !== 'on') return `<section class="card trk-off"><b>${t.state === 'rest' ? 'Azi: pauză' : 'Pauză între cicluri'}</b><span>${esc(t.why)}</span></section>`;
  return `<section class="card trk-form"><h2>Diseară: ${t.amount} mcg CJC + ${t.amount} mcg Ipamorelin</h2>
    ${t.why ? `<p class="trk-auto">${esc(t.why)}</p>` : ''}
    <label class="field">Când ai mâncat ultima dată?<select id="cjc-fast"><option value="">alege</option><option value="3">acum peste 3 ore</option><option value="2">acum 2–3 ore</option><option value="1">acum mai puțin de 2 ore</option></select></label>
    ${syringe(r, t.amount)}
    <p class="hint">Locul: ${RX_SITES[cjcNextSite(r)]}. Subcutanat, înainte de culcare.</p>
    <button class="primary wide" data-cj="dose">Notez injecția de acum</button></section>`;
}

function morning(r: Rx): string {
  const today = ctx.today();
  if (!r.log.some((x) => x.date === addDays(today, -1) || x.date === today)) return '';
  const c = r.checks?.[today] ?? { fx: [] };
  return `<section class="card"><h2>Dimineața: cum a fost noaptea?</h2>
    <div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button class="${c.sleep === n ? 'on' : ''}" data-cj="sleep" data-d="${n}">${n}</button>`).join('')}</div>
    <p class="hint">1 = foarte prost, 5 = excelent. Ce ai observat (contează pentru creșterea dozei):</p>
    <div class="chips trk-fx">${CJC_FX.map((f, i) => `<button class="${c.fx.includes(i) ? 'on' : ''}" data-cj="fx" data-d="${i}">${esc(f)}</button>`).join('')}</div></section>`;
}

function grid(r: Rx): string {
  const rows = cycleGrid(r, ctx.today()).map((w, i) => `<div class="trk-row"><span>S${i + 1}</span>${w.map((c) => `<i class="${c.state}" title="${c.date}${c.amount ? ` · ${c.amount} mcg` : ''}">${c.amount && c.amount !== 100 ? c.amount : ''}</i>`).join('')}</div>`).join('');
  return `<section class="card trk"><h2>Ciclul</h2><div class="trk-grid" aria-label="Calendarul ciclului">${rows}</div>
    <p class="hint trk-key"><i class="done"></i> făcută <i class="rest"></i> pauză 5/2 <i class="miss"></i> sărită <i class="today"></i> azi <i class="pause"></i> pauză de ciclu</p></section>`;
}

function stats(r: Rx): string {
  const today = ctx.today();
  const ad = cjcAdherence(r, today);
  const sl = avgSleep(r, today);
  const w = weightSince(r.start);
  return `<div class="trk-stats">
    <div><b>${ad.pct}%</b><small>${ad.done} ${ad.done === 1 ? "noapte făcută" : "nopți făcute"}</small></div>
    <div><b>${sl == null ? '–' : num(Math.round(sl * 10) / 10)}</b><small>somn, 7 zile</small></div>
    <div><b>${w ? `${w[1] - w[0] > 0 ? '+' : ''}${num(Math.round((w[1] - w[0]) * 10) / 10)}` : '–'}</b><small>kg de la start</small></div>
    <div><b>${r.amount}</b><small>mcg acum</small></div></div>`;
}

function dose(r: Rx): string {
  const today = ctx.today();
  const up = cjcRaise(r, today);
  const auto = up.ok && up.next <= Math.min(r.cap ?? CJC_AUTO_MAX, CJC_AUTO_MAX);
  const fx = recentFx(r, today);
  return `<section class="card"><h2>Doza</h2>
    <p>${r.amount < CJC_AUTO_MAX && !(r.cap != null && r.amount >= r.cap) ? 'Crește singură cu 50 mcg după 2 săptămâni la aceeași doză, dacă nu ai notat efecte în 7 zile, până la 200 mcg.' : r.cap != null && r.amount >= r.cap ? `Plafonată la ${r.cap} mcg: o creștere a adus efecte.` : 'Creșterea automată s-a oprit la 200 mcg.'}</p>
    <p class="hint">${esc(up.why)}</p>
    ${up.ok && !auto ? `<button class="ghost wide" data-cj="raise" data-d="${up.next}">Cresc manual la ${up.next} mcg</button>` : ''}
    ${fx.size ? `<h3>Efecte în ultimele 7 zile</h3>${[...fx].map(([i, n]) => `<div class="line"><span>${esc(CJC_FX[i]!)}</span><b>${n}×</b></div>`).join('')}` : ''}</section>`;
}

function labs(r: Rx): string {
  const row = (name: string, id: string, unit: string) => { const x = latestLab(id); return `<div class="line"><span>${name}</span><b>${x ? `${num(x.value)} ${unit} · ${x.date < r.start ? 'înainte de start' : x.date}` : '–'}</b></div>`; };
  return `<section class="card"><h2>Analize de urmărit</h2>${row('IGF-1', 'igf1', 'ng/mL')}${row('Glicemie pe nemâncate', 'glucose', 'mg/dL')}${row('HbA1c', 'hba1c', '%')}
    <p class="hint">Înainte de start și la 6–8 săptămâni. La greutatea ta, sensibilitatea la insulină poate scădea.</p>
    <button class="ghost wide" data-f="sub" data-v="labs">Adaugă în Analize</button></section>`;
}

export function cjcHtml(): string {
  const r = cjc();
  const today = ctx.today();
  const top = `${back('Peptide', 'data-tab="pept"')}${head('supp', 'CJC-1295 + Ipamorelin', 'No DAC, în aceeași seringă, seara înainte de culcare.')}`;
  const note = '<p class="hint pad">Schema e aleasă de tine, nu prescrisă. Nu e un medicament aprobat și e pe lista interzisă WADA. Ipamorelinul poate crește foamea, ceea ce lucrează contra deficitului.</p>';
  if (!r) return `${top}<div class="pep${pepIn()}"><section class="card"><h2>Schema ta</h2>${schema()}
    <button class="primary wide" data-rx="cjc">Pornesc schema de azi</button></section>${note}</div>`;
  const c = cjcCycle(r.start, today);
  return `${top}<div class="pep${pepIn()}">
    <div class="glp-tile static">${countdownRing(cjcNextIn(r, today), 'Următoarea injecție')}
      <span class="gt-t"><small>${c.phase === 'pause' ? `Pauză · încă ${c.pauseLeft} zile` : `Săptămâna ${c.week} din 8–12`}</small><b>${r.amount} + ${r.amount} mcg</b><span>${r.log.length} ${r.log.length === 1 ? 'injecție notată' : 'injecții notate'}</span></span></div>
    ${stats(r)}
    ${tonight(r)}
    ${morning(r)}
    ${grid(r)}
    <section class="card"><h2>Locul injecției</h2>${siteMap(RX_SITES, cjcNextSite(r), r.log.map((x) => x.site))}<p class="hint">Alternează singur: abdomen stânga, abdomen dreapta.</p></section>
    ${dose(r)}
    ${vialCard(r)}
    ${labs(r)}
    <details class="card"><summary><b>Schema ta</b></summary>${schema()}</details>
    ${r.log.length ? `<details class="card"><summary><b>Istoric (${r.log.length})</b></summary>${[...r.log].reverse().slice(0, 40).map((x) => `<div class="line"><span>${esc(x.date)} ${x.time} · ${RX_SITES[x.site]}</span><b>${num(x.amount)} mcg</b><button class="link" data-rx="ddel" data-v="${r.id}" data-d="${x.id}" aria-label="Șterge">×</button></div>`).join('')}</details>` : ''}
    <div class="btns"><button class="ghost" data-rx="del" data-v="${r.id}">Șterg schema și istoricul</button></div>
    <p class="hint">Mergi la medic dacă apar: amorțeli care nu trec, umflături mari, palpitații, dureri de cap puternice sau glicemia peste 100 pe nemâncate.</p>
    ${note}</div>`;
}

export function cjcAction(el: HTMLElement): boolean {
  const a = el.dataset['cj'];
  if (!a) return false;
  const r = cjc();
  if (!r) return true;
  const today = ctx.today();
  if (a === 'dose') {
    const t = cjcTonight(r, today);
    if (t.state !== 'on') { ctx.toast(t.why || 'Azi e notată deja.'); return true; }
    const fast = document.querySelector<HTMLSelectElement>('#cjc-fast')?.value ?? '';
    if (!fast) { ctx.toast('Spune când ai mâncat ultima dată.'); return true; }
    if (fast === '1') { ctx.toast('Schema cere stomacul gol: așteaptă să treacă 2 ore de la masă.'); return true; }
    const prev = { amount: r.amount, cap: r.cap };
    r.amount = t.amount;
    if (t.cap != null) r.cap = t.cap;
    const time = hhmm(new Date());
    const d = { id: `d${Date.now().toString(36)}`, date: today, time, amount: t.amount, site: cjcNextSite(r), fasted: Number(fast) };
    r.log.push(d);
    ctx.commit(); ctx.render();
    ctx.toast(`Notat: ${t.amount} mcg, ${RX_SITES[d.site]}. Poți mânca de la ${plus30(time)}.`, () => {
      r.log = r.log.filter((y) => y !== d); r.amount = prev.amount;
      if (prev.cap == null) delete r.cap; else r.cap = prev.cap;
      ctx.commit(); ctx.render();
    });
    return true;
  }
  if (a === 'vmg' || a === 'vml') {
    const k = el.dataset['k'] as 'cjc' | 'ipa';
    const n = Number(el.dataset['d']);
    r.vials ??= {};
    const had = r.vials[k];
    const cur = had ?? { mg: 5, ml: 2 };
    const next = a === 'vmg' ? { ...cur, mg: n } : { ...cur, ml: n };
    // The first time a vial size is picked, start from the water that makes the dose easiest to read.
    if (a === 'vmg' && !had) { const b = bestWater(n, cjcTonight(r, today).amount); if (b) next.ml = b.ml; }
    r.vials[k] = next;
  } else if (a === 'sleep' || a === 'fx') {
    const n = Number(el.dataset['d']);
    r.checks ??= {};
    const c = (r.checks[today] ??= { fx: [] });
    if (a === 'sleep') { if (c.sleep === n) delete c.sleep; else c.sleep = n; }
    else c.fx = c.fx.includes(n) ? c.fx.filter((x) => x !== n) : [...c.fx, n];
  } else if (a === 'raise') {
    const up = cjcRaise(r, today);
    if (up.ok) { r.amount = up.next; ctx.toast(`De diseară: ${up.next} mcg din fiecare.`); }
  }
  ctx.commit(); ctx.render();
  return true;
}
