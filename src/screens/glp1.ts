/* Semaglutide (Wegovy): the screen under "Mai mult" and the card on Azi. See logic/glp1.ts for the rules and sources. */
import { ctx, dayLong, esc, n1 } from '../app.ts';
import { addDays } from '../logic/review.ts';
import { doseMl, due, glucoseFeedback, glucoseLevel, LADDER, nextSite, onOrAfter, SITES, titration, units, vialAge, vialLeft, weeklyRate, weeksAtDose, type Glp1, type GlucoseWhen } from '../logic/glp1.ts';
import { adjustedKg, BASELINE_LABS, labsCovered, phaseOf, phaseStates, PHASE_TITLE, PHASE_WHEN, proteinFloor, rateBandKg, type PhaseId } from '../logic/glp1plan.ts';
import { goalView } from '../logic/goal.ts';
import { trendAlpha, weightTrend } from '../logic/trend.ts';
import { weightKey } from '../logic/training.ts';
import { dayRating, latestKg, training } from './state.ts';
import { back, head, heroBand } from './parts.ts';
import { countdownRing, doseStairs, glucoseChart, paceGauge, pepIn, siteMap } from './pepviz.ts';

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const NAUSEA = ['Deloc', 'Ușoară', 'Deranjantă', 'Puternică'];
const mg = (v: number) => `${String(v).replace('.', ',')}&nbsp;mg`;
const shortDay = (d: string) => dayLong(d).replace(/^\w/, (c) => c.toUpperCase());
const num = (v: number) => String(v).replace('.', ',');

/** "5 UI (0,05 ml)" for a dose, when a vial is in use. */
function draw(g: Glp1, dose: number): string {
  const v = g.vial;
  if (!v) return '';
  return `${num(units(dose, v))}&nbsp;UI pe seringa U-100 (${doseMl(dose, v).toFixed(3).replace(/0+$/, '').replace('.', ',')}&nbsp;ml)`;
}

/** The vial: how much water, what each dose is in units, what is left and how old the mix is. */
function vialCard(g: Glp1): string {
  const today = ctx.today();
  const v = g.vial;
  if (!v) {
    return `<section class="card"><h2>Flacon cu pulbere</h2><p>Dacă ai un flacon de reconstituit în loc de stilou, aplicația calculează câte unități tragi pe seringa de insulină.</p>
      <button class="ghost wide" data-g="vial-on">Folosesc flacon</button></section>`;
  }
  const left = vialLeft(g) ?? 0;
  const age = vialAge(v, today);
  const weeksLeft = g.mg > 0 ? Math.floor(left / g.mg) : 0;
  return `<section class="card"><h2>Flacon și seringă</h2>
    <div class="vial-in"><label class="field">Semaglutidă în flacon<input id="glp-vmg" type="number" inputmode="decimal" step="0.5" min="0" value="${v.mg}"><small>mg</small></label>
    <label class="field">Apă bacteriostatică<input id="glp-vml" type="number" inputmode="decimal" step="0.5" min="0" value="${v.ml}"><small>ml</small></label></div>
    <label class="field">Reconstituit pe<input id="glp-mixed" type="date" value="${esc(v.mixed)}"></label>
    <button class="primary wide" data-g="vial-save" style="margin-top:12px">Salvează</button>
    <p class="coach">Concentrația: <b>${num(Math.round((v.mg / v.ml) * 100) / 100)} mg/ml</b>. Doza de acum, ${mg(g.mg)} = <b>${draw(g, g.mg)}</b>.</p>
    <table class="units"><tr><th>Doza</th><th>UI</th><th>ml</th></tr>${LADDER.map((x) => `<tr class="${x === g.mg ? 'now' : ''}"><td>${mg(x)}</td><td>${num(units(x, v))}</td><td>${doseMl(x, v).toFixed(3).replace(/0+$/, '').replace('.', ',')}</td></tr>`).join('')}</table>
    <p class="hint">Seringa U-100: 100 UI = 1 ml, deci 1 UI = 0,01 ml. Doar seringi U-100; o seringă U-40 dă altă doză.</p>
    <p class="${left < g.mg ? 'warn' : 'hint'}">În flacon au rămas aproximativ <b>${num(Math.round(left * 100) / 100)} mg</b>${left >= g.mg ? `, cam ${weeksLeft} ${weeksLeft === 1 ? 'doză' : 'doze'} de ${mg(g.mg)}` : ': nu mai ajunge pentru doza următoare'}.</p>
    ${age > 28 ? `<p class="warn">Flaconul e amestecat de ${age} zile. Stabilitatea după reconstituire nu e garantată de producător pentru atât timp, iar fiecare înțepare în dop e un risc de contaminare.</p>` : `<p class="hint">Amestecat de ${age} ${age === 1 ? 'zi' : 'zile'}.</p>`}
    <h3>Reconstituirea</h3>
    <ol class="steps"><li>Mâini spălate, dopurile ambelor flacoane șterse cu alcool și lăsate să se usuce.</li>
      <li>Tragi ${num(v.ml)} ml apă bacteriostatică (${num(v.ml * 100)} UI, adică ${v.ml > 1 ? `${Math.ceil(v.ml)} seringi pline de 1 ml` : 'o seringă de 1 ml'}) și o lași să curgă încet pe peretele flaconului, nu direct pe pulbere.</li>
      <li>Nu agita. Rotești ușor până se limpezește complet; dacă rămâne tulbure sau cu particule, nu-l folosi.</li>
      <li>Ține-l în frigider, la 2–8 °C, ferit de lumină. Nu-l congela.</li>
      <li>Seringă nouă la fiecare injecție, ac de 29–31G, sub piele, la locul din rotație.</li></ol>
    <button class="link" data-g="vial-off">Folosesc stilou, nu flacon</button></section>`;
}

/** The line that says what to do about the next injection. */
function dueText(g: Glp1, today: string): { title: string; text: string; act: boolean } {
  const d = due(g, today);
  switch (d.kind) {
    case 'today': return { title: `Injecția de azi: ${mg(g.mg)}`, text: `${g.vial ? `Tragi ${draw(g, g.mg)}. ` : ''}Locul: ${SITES[nextSite(g)]}.`, act: true };
    case 'late': return { title: `Ai sărit doza de ${esc(dayLong(d.missed))}`, text: `Următoarea e peste mai mult de 2 zile, așa că o faci acum, ${mg(g.mg)}${g.vial ? `, adică ${draw(g, g.mg)}` : ''}. Apoi revii la ziua obișnuită, la cel puțin 3 zile distanță.`, act: true };
    case 'skip': return { title: 'Sari doza ratată', text: `Doza de ${esc(dayLong(d.missed))} nu se mai face: următoarea e ${esc(dayLong(d.next))}, la mai puțin de 2 zile. Nu dubla niciodată doza.`, act: false };
    case 'restart': return { title: 'Peste 2 săptămâni fără doză', text: 'Nu reîncepe singur de la doza de acum: medicul decide de la ce treaptă repornești, de obicei mai jos, ca să nu revină greața.', act: true };
    case 'upcoming': return { title: `Următoarea injecție: ${esc(dayLong(d.date))}`, text: `${d.days === 1 ? 'Mâine' : `Peste ${d.days} zile`}, ${mg(g.mg)}${g.vial ? `: ${draw(g, g.mg)}` : ''}.`, act: false };
    default: return { title: '', text: '', act: false };
  }
}

const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Days to the next injection for the ring: 0 today, negative when late, null before the first one. */
export function daysLeft(g: Glp1, today: string): number | null {
  const d = due(g, today);
  if (d.kind === 'today') return 0;
  if (d.kind === 'upcoming') return d.days;
  if (d.kind === 'skip') return dayGap(today, d.next);
  if (d.kind === 'late' || d.kind === 'restart') return -1;
  return null;
}

/** On Azi: only when there is something to do (inject, a missed dose, the nausea question the day after). */
export function glp1Card(today: string): string {
  const g = ctx.get().glp1;
  if (!g?.on) return '';
  const d = due(g, today);
  const last = g.shots.at(-1);
  const ask = last && last.nausea == null && today > last.date && today <= addDays(last.date, 3);
  if (d.kind === 'upcoming' && !ask) return '';
  const t = dueText(g, today);
  return `<section class="card glp" aria-label="Semaglutidă">
    ${d.kind !== 'upcoming' ? `<p class="label">Semaglutidă</p><h2>${t.title}</h2><p>${t.text}</p>${t.act ? '<button class="primary wide" data-g="shot">Am făcut injecția</button>' : ''}` : ''}
    ${ask ? `<p class="label">Semaglutidă · după doza de ${esc(dayLong(last.date))}</p><h2>Cum a fost greața?</h2><div class="chips four">${NAUSEA.map((n, i) => `<button data-g="nausea" data-v="${i}">${n}</button>`).join('')}</div>` : ''}
  </section>`;
}

function rateLine(weights: Record<string, number>): string {
  const r = weeklyRate(weights);
  if (r == null) return '<p class="hint">Ritmul apare după două săptămâni de cântăriri.</p>';
  const loss = -r;
  const kg = Object.values(weights).at(-1) ?? 0;
  const tag = loss > 1.5 ? 'warn' : loss >= 0.5 ? 'coach' : 'hint';
  return `${paceGauge(loss)}<p class="${tag}">Ritmul din ultimele 2 săptămâni: <b>${loss >= 0 ? '−' : '+'}${n1(Math.abs(loss))}% pe săptămână</b> (aproximativ ${n1(Math.abs(loss) * kg / 100)} kg). Ținta: 0,5–1%.</p>`;
}

function stepText(g: Glp1, weights: Record<string, number>): string {
  const st = titration(g, weights);
  switch (st.kind) {
    case 'wait': return `Mai rămâi ${st.weeks} ${st.weeks === 1 ? 'săptămână' : 'săptămâni'} pe doza asta: fiecare treaptă ține cel puțin 4 săptămâni.`;
    case 'data': return 'Ai 4 săptămâni pe doza asta, dar prea puține cântăriri ca să știm ritmul. Cântărește-te zilnic, dimineața.';
    case 'lowsugar': return 'Ai avut o glicemie sub 70 mg/dL în ultimele 2 săptămâni: nu urca doza până nu vorbești cu medicul, și nu sări mesele din plan.';
    case 'nausea': return 'Greața a fost deranjantă după ultimele doze: rămâi pe doza asta încă 4 săptămâni. Urci doar când stomacul s-a liniștit.';
    case 'fast': return `Slăbești ${n1(st.rate)}% pe săptămână, prea repede: crește riscul de mușchi pierdut și de calculi biliari. Nu urca doza, mănâncă toată proteina și discută cu medicul dacă doza trebuie scăzută.`;
    case 'hold': return `Slăbești ${n1(st.rate)}% pe săptămână, exact în țintă. Nu e nevoie să urci doza: rămâi aici cât timp ritmul se ține.`;
    case 'up': return `Ritmul a scăzut la ${n1(st.rate)}% pe săptămână după 4+ săptămâni bine tolerate. Poți discuta cu medicul treapta următoare: ${mg(st.to)}.`;
    case 'top': return `Ești pe doza maximă de întreținere. Ritmul de ${n1(st.rate)}% pe săptămână e normal spre final: platoul vine de obicei după 60–68 de săptămâni.`;
  }
}

function setup(g: Glp1): string {
  const today = ctx.today();
  return `<section class="card"><h2>Pornește</h2>
    <p>Doar cu rețetă și cu produsul din farmacie. Aplicația ține evidența și îți spune ce arată cântarul; doza o stabilește medicul.</p>
    <label class="field">Prima injecție<input id="glp-start" type="date" value="${esc(g.start || onOrAfter(today, g.day))}"></label>
    <p class="field">Ziua injecției</p><div class="chips seven">${DAYS.map((d, i) => `<button data-g="day" data-v="${i}" aria-pressed="${g.day === i}">${d.slice(0, 2)}</button>`).join('')}</div>
    <p class="hint">În Hybrid365 duminica e zi de recuperare: dacă alegi sâmbătă seara, după alergarea lungă, greața din prima zi cade pe ziua liniștită.</p>
    <button class="primary wide" data-g="on" style="margin-top:16px">Pornește cu ${mg(LADDER[0])}</button></section>`;
}

/* ---- The whole protocol, five phases (2026-11-21). Same look as the performance plan in Plan: gold = done,
   violet = to do, outline = the app cannot tell. Numbers are the user's own; no dose is proposed beyond the
   label's ladder. See logic/glp1plan.ts for the arithmetic and the sources. */

interface ProtoItem { ok: boolean | null; title: string; body: string; act?: string }

function protoPhases(): { id: PhaseId; items: ProtoItem[] }[] {
  const s = ctx.get();
  const g = s.glp1;
  const p = s.profile!;
  const plan = s.plan;
  const today = ctx.today();
  const kg = latestKg();
  const adj = adjustedKg(p.heightCm, kg, p.sex);
  const floor = proteinFloor(adj);
  const [lo, hi] = rateBandKg(kg);
  const covered = labsCovered(s.labs);
  const r = weeklyRate(s.weights);
  const loss = r == null ? null : -r;
  const weighs = Object.keys(s.weights).length;
  const waist = s.measures.some((m) => m.waist);
  const lifts = strengthDays(today);
  const micro = s.supps.some((x) => /multivitamin|omega|vitamina d|d3/i.test(`${x.ingredient} ${x.product}`));
  const protein = plan?.macros.p ?? 0;
  const reverse = plan?.phase === 'reverse' || plan?.phase === 'maintain';

  return [
    { id: 'before', items: [
      { ok: !!g.screened, title: 'Contraindicațiile, trecute cu medicul',
        body: g.screened
          ? `Bifat pe ${esc(shortDay(g.screened))}.`
          : 'Eliminatorii: carcinom medular tiroidian sau MEN2, la tine sau în familie; pancreatită în trecut; boală inflamatorie intestinală; gastropareză; litiază biliară. Bifează după ce medicul le-a trecut cu tine.',
        act: g.screened ? undefined : 'screen' },
      { ok: covered >= BASELINE_LABS.length - 2, title: `Analizele de start: ${covered} din ${BASELINE_LABS.length}`,
        body: 'HbA1c, glicemie, insulină, LDL, HDL, trigliceride, ALT, creatinină, lipază, TSH, vitamina D, B12. Lipaza de la început nu pune diagnostic, dar e valoarea față de care se citește una viitoare. Se repetă la 3 luni.',
        act: covered >= BASELINE_LABS.length - 2 ? undefined : 'labs' },
      { ok: weighs >= 7 && waist, title: 'Măsurătorile de referință',
        body: `${weighs >= 7 ? `${weighs} cântăriri notate` : `Doar ${weighs} ${weighs === 1 ? 'cântărire' : 'cântăriri'}: ritmul se citește din media pe 7 zile, nu dintr-o valoare`}. ${waist ? 'Talia e notată.' : 'Notează și talia: pe un deficit cu forță, ea se mișcă atunci când cântarul stă.'} Plus pozele de progres și încărcările de la care pleci.`,
        act: weighs >= 7 && waist ? undefined : 'body' },
      { ok: !!s.goal, title: 'Ținta finală',
        body: s.goal ? `${String(s.goal.kg).replace('.', ',')} kg. Aplicația oprește deficitul când trendul ajunge acolo.` : 'Fără ea nu există fază de menținere și nici ieșire: slăbitul nu are unde să se termine.',
        act: s.goal ? undefined : 'body' },
    ] },
    { id: 'titrate', items: [
      { ok: g.on ? weeksAtDose(g) >= 4 : null, title: 'Patru săptămâni pe fiecare treaptă',
        body: `${LADDER.map((x) => String(x).replace('.', ',')).join(' → ')} mg pe săptămână, minimum 4 săptămâni per treaptă. Doza de 7,2 mg există din martie 2026, dar numai după ce 2,4 mg a fost tolerată cel puțin 4 săptămâni.` },
      { ok: loss == null ? null : loss >= 0.5, title: 'Cea mai mică doză care dă ritmul',
        body: `Nu doza maximă tolerată. Ținta e ${n1(lo)}–${n1(hi)} kg pe săptămână la ${n1(kg)} kg${loss != null ? `; acum ${n1(loss * kg / 100)} kg` : ''}. Dacă o treaptă de jos ține ritmul și proteina și forța sunt la locul lor, rămâi acolo.` },
      { ok: g.shots.slice(-2).every((x) => (x.nausea ?? 0) < 2) && g.shots.length > 0 ? true : null, title: 'Greața, ținută sub control',
        body: 'Porții mici, mâncat încet, oprit la primul semn de sătul, mai puține grăsimi în ziua injecției. Dacă greața e deranjantă, treapta se repetă, nu se urcă. Regulile de mai jos.' },
    ] },
    { id: 'cut', items: [
      { ok: loss == null ? null : loss >= 0.5 && loss <= 1, title: 'Ritmul, nu viteza',
        body: `${loss == null ? 'Apare după două săptămâni de cântăriri.' : `Acum ${n1(loss)}% pe săptămână.`} Sub 0,5% e prea lent, peste 1% începi să plătești în masă slabă. Două kilograme pe săptămână nu e un succes, e semnalul că mănânci prea puțin.` },
      { ok: protein ? protein >= floor : null, title: `Proteina: ${protein ? `${protein} g` : 'de calculat'}, pragul ${floor} g`,
        body: `La ${n1(kg)} kg și ${p.bf}% grăsime, referința pentru proteină e greutatea ajustată, ${n1(adj)} kg — pe greutatea totală ai supraestima. ${protein ? protein >= floor ? 'Planul tău e peste prag.' : `Planul dă ${protein} g: sub prag pentru un deficit ținut cu GLP-1.` : ''} Proteina se mănâncă prima la fiecare masă: când apetitul e suprimat, ce rămâne în farfurie nu trebuie să fie carnea.` },
      { ok: lifts == null ? null : lifts >= 2, title: `Forță de 3 ori pe săptămână${lifts == null ? '' : `: ${lifts} în ultimele 7 zile`}`,
        body: 'Nu e „exercițiu", e tratamentul care decide dacă pierzi grăsime sau mușchi. Fără el intri în statistica de 25–40% masă slabă — care, atenție, e aceeași la dietă simplă fără haltere: nu e un efect al medicamentului.' },
      { ok: null, title: 'Indicatorul e forța, nu cântarul',
        body: 'Dacă încărcările din HYBRID FORGE se țin sau cresc în timp ce greutatea scade, pierzi grăsime. Dacă forța scade două săptămâni la rând, protocolul e rupt: mănânci prea puțin, prea puțină proteină, sau cobori prea repede. Nu se urcă doza atunci.' },
      { ok: null, title: 'Volumul nu crește în deficit',
        body: 'Instinctul e să adaugi serii și cardio. Greșit: recuperarea e deja compromisă. Încărcările rămân mari, volumul moderat, iar cardio-ul stă pe mers în pantă, bicicletă și vâslit — nu alergare, pentru genunchi.' },
      { ok: micro, title: 'Micronutrienți și fibre',
        body: 'Cu aportul tăiat de medicament, carențele devin reale. Multivitamine, vitamina D, omega-3, fibre din legume la fiecare masă, magneziu pentru constipație.',
        act: micro ? undefined : 'supp' },
    ] },
    { id: 'hold', items: [
      { ok: null, title: 'Șase până la douăsprezece luni la ținta atinsă',
        body: 'Nu oprești medicamentul când ajungi la greutatea-țintă. Greutatea nouă trebuie să devină normalul fiziologic, nu un punct prin care ai trecut. Aici se câștigă sau se pierde tot.' },
      { ok: null, title: 'Testul obiceiurilor',
        body: `Dacă ${floor} g de proteină și trei antrenamente pe săptămână încă îți cer voință, nu ești de partea cealaltă a podului — ești pe el. Obiceiurile automate sunt condiția de ieșire, nu numărul de pe cântar.` },
    ] },
    { id: 'exit', items: [
      { ok: reverse ? true : null, title: 'Caloriile urcă ÎNAINTE să coboare doza',
        body: `Ordinea contează și e contraintuitivă. Reverse diet până la mențineri, apoi se scade doza. Invers — doza jos peste un deficit — înseamnă apetit revenit peste calorii mici: exact rețeta de rebound.${reverse ? ' Ești deja în faza asta.' : ''}`,
        act: reverse ? undefined : 'plan' },
      { ok: null, title: 'Coborârea, în trepte de luni',
        body: 'Nu se întrerupe brusc. Trepte lungi, cu greutatea și apetitul urmărite la fiecare pas. Peste 2 săptămâni fără doză, medicul decide de la ce treaptă se repornește.' },
      { ok: null, title: 'Ce te așteaptă dacă oprești fără asta',
        body: 'Jumătate dintre oameni renunță în primul an, 70% în doi. După oprire se recâștigă în medie două treimi din ce s-a pierdut. Obezitatea e boală cronică: a rămâne pe tratament nu e un eșec, e o opțiune pe care o discuți cu medicul.' },
      { ok: null, title: 'Forța nu se oprește niciodată',
        body: 'Nici în menținere, nici după. E singura parte din protocol care nu are dată de final.' },
    ] },
  ];
}

/** Strength sessions done in the last 7 days, or null when the training week cannot be read. */
function strengthDays(today: string): number | null {
  try {
    const t = training();
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      const dp = dayRating(d, t);
      const hard = dp.done.some((x) => { const k = weightKey(x); return k === 'workout' || k === 'amrap'; });
      if (hard) n++;
    }
    return n;
  } catch { return null; }
}

function protocolHtml(): string {
  const g = ctx.get().glp1;
  const s = ctx.get();
  const today = ctx.today();
  let atGoal = false;
  if (s.goal && s.plan) {
    const st = goalView(s.goal, weightTrend(s.weights, trendAlpha(s.plan.phase)), s.plan.phase, today).state;
    atGoal = st === 'reached' || st === 'stop' || st === 'band';
  }
  const now = phaseOf(g, atGoal);
  const states = phaseStates(now);
  const mark = (ok: boolean | null) => (ok == null ? 'na' : ok ? 'ok' : 'todo');
  const btn: Record<string, string> = {
    screen: '<button class="ghost" data-g="screen">Medicul le-a trecut cu mine</button>',
    labs: '<button class="ghost" data-tab="fuel" data-sub="labs">Deschide Analize</button>',
    body: '<button class="ghost" data-tab="corp">Deschide Corp</button>',
    supp: '<button class="ghost" data-tab="fuel" data-sub="supp">Suplimente</button>',
    plan: '<button class="ghost" data-tab="plan">Deschide Planul meu</button>',
  };
  const phases = protoPhases();
  const totals = phases.map(({ items }) => {
    const known = items.filter((x) => x.ok != null);
    return { done: known.filter((x) => x.ok).length, of: known.length };
  });
  // only the phase in progress is open; the rest collapse, so the card is a map and not a wall
  const body = phases.map(({ id, items }, i) => {
    const st = states[id];
    const t = totals[i]!;
    const count = t.of ? `<em class="ph-n${t.done === t.of ? ' full' : ''}">${t.done}/${t.of}</em>` : '';
    const rows = items.map((x, j) => `<div class="pf ${mark(x.ok)}"><i class="pf-s" aria-hidden="true"></i><b><span>${j + 1}</span>${x.title}</b><p>${x.body}</p>${x.act ? `<div class="btns">${btn[x.act]}</div>` : ''}</div>`).join('');
    return `<details class="ph ${st}"${st === 'now' ? ' open' : ''}>
      <summary><i aria-hidden="true"></i><b>${PHASE_TITLE[id]}</b><small>${PHASE_WHEN[id]}</small>${count}${st === 'now' ? '<u class="tag">acum</u>' : ''}</summary>
      <div class="ph-b">${rows}</div>
    </details>`;
  }).join('');
  return `<section class="card perf proto"><h2>Protocolul, pe faze</h2>
    <p class="hint">Tot ce ține de semaglutidă într-o singură ordine, pe cifrele tale. Auriu: făcut. Violet: de făcut. Contur: aplicația nu poate ști. Doza rămâne a medicului — aici sunt doar treptele din prospect și ce controlezi tu.</p>
    <p class="coach">Ierarhia: proteina decide dacă pierzi grăsime sau mușchi, forța decide același lucru din altă direcție, medicamentul decide dacă ții deficitul, iar ieșirea decide dacă păstrezi rezultatul. În ordinea asta.</p>
    ${body}
    <p class="hint">Faza în care ești e deschisă; celelalte se deschid la atingere. Surse: prospectul Wegovy; STEP 1 (−14,9% la 68 de săptămâni) și substudiul DEXA; extensia STEP 1 (două treimi recâștigate la un an după oprire); SELECT (rezultate cardiovasculare); Norton despre masă slabă vs. masă musculară; ISSN 2017 și Helms 2014 pentru proteină.</p>
  </section>`;
}

const RULES = [
  ['Proteina întâi', 'La fiecare masă începi cu proteina. Pofta scade, iar ce lași în farfurie să nu fie proteina.'],
  ['Forță de 2–3 ori pe săptămână', 'Fără ea, până la 40% din kilogramele pierdute pot fi mușchi. HYBRID FORGE o are deja.'],
  ['Mic înainte de antrenament', 'Ceva ușor, cu 60–90 de minute înainte. Mesele mari și grase agravează greața.'],
  ['Apă 3–4 litri și fibre', 'Constipația și deshidratarea sunt cele mai frecvente efecte.'],
  ['Mănânci încet, te oprești la sătul', 'Semnalul de sațietate vine mai devreme. Porțiile mici, de mai multe ori, merg mai bine.'],
  ['Fără deficit în plus', 'Medicamentul face deficitul. Nu tăia mai mult decât ținta din aplicație.'],
];

export function glp1Html(): string {
  const s = ctx.get();
  const g = s.glp1;
  const today = ctx.today();
  if (!g.on) {
    return `${back('Peptide', 'data-tab="pept"')}${head('supp', 'Semaglutidă', 'Wegovy, o injecție pe săptămână, cu medicul.')}
    <div class="pep${pepIn()}">
    ${heroBand('inject')}
    ${setup(g)}
    <section class="card"><h2>Protocolul din prospect</h2>${doseStairs(LADDER, -1, 0)}<p class="hint">Fiecare treaptă cel puțin 4 săptămâni. Nu urci dacă slăbești deja 0,5–1% pe săptămână sau dacă greața e puternică.</p></section>
    ${protocolHtml()}
    ${glucoseCard(g)}
    ${redFlags()}</div>`;
  }
  const t = dueText(g, today);
  const weeks = weeksAtDose(g);
  const last = g.shots.at(-1);
  return `${back('Peptide', 'data-tab="pept"')}${head('supp', 'Semaglutidă', `${String(g.mg).replace('.', ',')} mg pe săptămână, ${DAYS[g.day]!.toLowerCase()}`)}
  <div class="pep${pepIn()}">
  ${heroBand('inject')}
  <section class="card glp${t.act ? ' hot' : ''}"><div class="glp-top">${countdownRing(daysLeft(g, today), t.title.replace(/&nbsp;/g, ' '))}<div><h2>${t.title}</h2><p>${t.text}</p></div></div>${t.act ? '<button class="primary wide pulse" data-g="shot">Am făcut injecția</button>' : ''}
    ${last ? `<p class="hint">Ultima: ${esc(shortDay(last.date))}, ${mg(last.mg)}, ${SITES[last.site]}.${last.nausea != null ? ` Greață: ${NAUSEA[last.nausea]!.toLowerCase()}.` : ''}</p>` : ''}
    ${siteMap(SITES, nextSite(g), g.shots.map((x) => x.site))}</section>
  <section class="card"><h2>Doza</h2>${doseStairs(LADDER, g.mg, weeks)}
    <p>${weeks ? `${weeks} ${weeks === 1 ? 'săptămână' : 'săptămâni'} pe ${mg(g.mg)}.` : `Încă nicio doză de ${mg(g.mg)}.`}</p>
    ${rateLine(s.weights)}
    <p class="coach">${stepText(g, s.weights)}</p>
    <p class="field">Doza prescrisă acum de medic</p><div class="chips five">${LADDER.map((x) => `<button data-g="mg" data-v="${x}" aria-pressed="${g.mg === x}">${String(x).replace('.', ',')}</button>`).join('')}</div>
    <p class="hint">Aplicația doar propune. Schimbi doza aici după ce ai vorbit cu medicul.</p></section>
  ${protocolHtml()}
  ${glucoseCard(g)}
  ${vialCard(g)}
  <section class="card"><h2>Cum mănânci pe semaglutidă</h2><div class="rules">${RULES.map(([a, b], i) => `<div class="rule" style="--i:${i}"><em>${String(i + 1).padStart(2, '0')}</em><b>${a}</b><small>${b}</small></div>`).join('')}</div></section>
  ${redFlags()}
  ${g.shots.length ? `<section class="card"><h2>Istoric</h2>${[...g.shots].reverse().slice(0, 12).map((x, k) => `<div class="line"><span>${esc(shortDay(x.date))} · ${SITES[x.site]}</span><b>${mg(x.mg)}</b><button class="link" data-g="del" data-v="${g.shots.length - 1 - k}" aria-label="Șterge">×</button></div>`).join('')}</section>` : ''}
  <section class="card"><h2>Setări</h2><p class="field">Ziua injecției</p><div class="chips seven">${DAYS.map((d, i) => `<button data-g="day" data-v="${i}" aria-pressed="${g.day === i}">${d.slice(0, 2)}</button>`).join('')}</div>
    <p class="hint">Între două doze trebuie să treacă cel puțin 3 zile; aplicația ține cont când muți ziua.</p>
    <button class="ghost wide" data-g="off" style="margin-top:14px">Opresc tratamentul</button>
    <p class="hint">La oprire, o parte mare din greutate revine de obicei în primul an. Hotărăște oprirea cu medicul și păstrează obiceiurile din aplicație.</p></section></div>`;
}

const WHEN: Record<GlucoseWhen, string> = { fasting: 'Pe nemâncate', post: 'La 2 h după masă', other: 'Altă oră' };
const LEVEL_TAG = { low: 'warn', ok: 'ok', raised: 'coach', high: 'warn' } as const;
let gWhen: GlucoseWhen = 'fasting';

/** Blood sugar from the user's meter, with the feedback (logic/glp1.ts glucoseFeedback). */
function glucoseCard(g: Glp1): string {
  const list = g.glucose ?? [];
  const fb = glucoseFeedback(list, ctx.today(), g.start);
  const cls = fb.level === 'urgent' || fb.level === 'doctor' ? 'warn' : fb.level === 'watch' ? 'coach' : '';
  return `<section class="card gluc"><h2>Glicemie</h2>
    <div class="ins ${cls}"><p><b>${esc(fb.title)}</b></p><p>${esc(fb.text)}</p></div>
    ${glucoseChart(list.slice(-12).map((x) => ({ mg: x.mg, level: glucoseLevel(x) })))}
    <div class="chips three">${(Object.keys(WHEN) as GlucoseWhen[]).map((k) => `<button data-g="gwhen" data-v="${k}" aria-pressed="${gWhen === k}">${WHEN[k]}</button>`).join('')}</div>
    <div class="row-in"><input id="glp-gl" type="text" inputmode="numeric" placeholder="mg/dL" aria-label="Glicemia, în mg/dL" style="width:110px"><button class="primary" data-g="gadd">Notează</button></div>
    <p class="hint">Pe nemâncate: 70–99 normal, 100–125 puțin crescută. La 2 ore după masă: sub 140. Glucometrul e un ghid; diagnosticul îl pune medicul, din laborator.</p>
    ${list.length ? `<h3>Ultimele</h3>${[...list].reverse().slice(0, 8).map((x) => `<div class="line"><span>${esc(shortDay(x.date))} ${x.time} · ${WHEN[x.when]}</span><b class="${LEVEL_TAG[glucoseLevel(x)]}">${x.mg}</b><button class="link" data-g="gdel" data-v="${x.id}" aria-label="Șterge">×</button></div>`).join('')}` : ''}
  </section>`;
}

function redFlags(): string {
  return `<section class="card note"><h2>Mergi imediat la medic dacă</h2>
    <p>Durere puternică sus în abdomen, care merge spre spate (pancreatită). Durere sub coaste în dreapta, febră sau piele galbenă (vezica biliară). Vărsături care nu se opresc sau nu poți ține lichidele. Umflătură la gât sau răgușeală care nu trece.</p>
    <p class="hint">Contraindicat la carcinom medular tiroidian sau MEN2, la tine sau în familie. Analize la început și la 3 luni: glicemie, HbA1c, lipide, ficat, rinichi, lipază, TSH, vitamina D și B12. Spune la evaluarea medicală SRI că iei tratamentul.</p></section>`;
}

export function glp1Action(el: HTMLElement): boolean {
  const a = el.dataset['g'];
  if (!a) return false;
  const s = ctx.get();
  const g = s.glp1;
  const today = ctx.today();
  const v = el.dataset['v'] ?? '';
  if (a === 'day') { g.day = Number(v); }
  else if (a === 'on') {
    const start = (document.querySelector<HTMLInputElement>('#glp-start')?.value || onOrAfter(today, g.day));
    Object.assign(g, { on: true, start, mg: LADDER[0] });
  } else if (a === 'off') { g.on = false; }
  else if (a === 'mg') { g.mg = Number(v); }
  else if (a === 'shot') {
    const shot = { date: today, mg: g.mg, site: nextSite(g) };
    g.shots.push(shot);
    ctx.commit(); ctx.render();
    ctx.toast(`Notat: ${String(shot.mg).replace('.', ',')} mg, ${SITES[shot.site]}.`, () => { g.shots = g.shots.filter((x) => x !== shot); ctx.commit(); ctx.render(); });
    return true;
  } else if (a === 'nausea') { const last = g.shots.at(-1); if (last) last.nausea = Number(v); }
  else if (a === 'del') { g.shots.splice(Number(v), 1); }
  else if (a === 'gwhen') { gWhen = v as GlucoseWhen; }
  else if (a === 'gadd') {
    const mgdl = Number((document.querySelector<HTMLInputElement>('#glp-gl')?.value ?? '').replace(',', '.'));
    if (!(mgdl >= 20 && mgdl <= 600)) { ctx.toast('Scrie glicemia în mg/dL, de exemplu 92.'); return true; }
    const now = new Date();
    const x = { id: `g${Date.now().toString(36)}`, date: today, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, mg: Math.round(mgdl), when: gWhen };
    (g.glucose ??= []).push(x);
    ctx.commit(); ctx.render();
    ctx.toast(`Notat: ${x.mg} mg/dL, ${WHEN[x.when].toLowerCase()}.`, () => { g.glucose = (g.glucose ?? []).filter((y) => y !== x); ctx.commit(); ctx.render(); });
    return true;
  }
  else if (a === 'gdel') { g.glucose = (g.glucose ?? []).filter((x) => x.id !== v); }
  else if (a === 'screen') {
    g.screened = today;
    ctx.commit(); ctx.render();
    ctx.toast('Notat: contraindicațiile trecute cu medicul.', () => { delete g.screened; ctx.commit(); ctx.render(); });
    return true;
  }
  else if (a === 'vial-on') { g.vial = { mg: 10, ml: 2, mixed: today }; }
  else if (a === 'vial-off') { g.vial = null; }
  else if (a === 'vial-save') {
    const val = (id: string) => Number((document.querySelector<HTMLInputElement>(id)?.value ?? '').replace(',', '.'));
    const vmg = val('#glp-vmg'), vml = val('#glp-vml');
    const mixed = document.querySelector<HTMLInputElement>('#glp-mixed')?.value || today;
    if (!(vmg > 0 && vml > 0 && vml <= 5)) { ctx.toast('Scrie miligramele din flacon și mililitrii de apă (până la 5 ml).'); return true; }
    g.vial = { mg: vmg, ml: vml, mixed };
    ctx.commit(); ctx.render();
    ctx.toast(`${num(g.mg)} mg = ${num(units(g.mg, g.vial))} UI.`);
    return true;
  }
  ctx.commit(); ctx.render();
  return true;
}
