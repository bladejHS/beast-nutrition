/* Semaglutide (Wegovy): the screen under "Mai mult" and the card on Azi. See logic/glp1.ts for the rules and sources. */
import { ctx, dayLong, esc, n1 } from '../app.ts';
import { addDays } from '../logic/review.ts';
import { doseMl, due, LADDER, nextSite, onOrAfter, SITES, titration, units, vialAge, vialLeft, weeklyRate, weeksAtDose, type Glp1 } from '../logic/glp1.ts';
import { back, head } from './parts.ts';

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
  return `<p class="${tag}">Ritmul din ultimele 2 săptămâni: <b>${loss >= 0 ? '−' : '+'}${n1(Math.abs(loss))}% pe săptămână</b> (aproximativ ${n1(Math.abs(loss) * kg / 100)} kg). Ținta: 0,5–1%.</p>`;
}

function stepText(g: Glp1, weights: Record<string, number>): string {
  const st = titration(g, weights);
  switch (st.kind) {
    case 'wait': return `Mai rămâi ${st.weeks} ${st.weeks === 1 ? 'săptămână' : 'săptămâni'} pe doza asta: fiecare treaptă ține cel puțin 4 săptămâni.`;
    case 'data': return 'Ai 4 săptămâni pe doza asta, dar prea puține cântăriri ca să știm ritmul. Cântărește-te zilnic, dimineața.';
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
    <p class="hint">Miercurea e zi de recuperare în Inner Beast: greața din primele 1–2 zile nu cade pe zilele de sac și de forță.</p>
    <button class="primary wide" data-g="on" style="margin-top:16px">Pornește cu ${mg(LADDER[0])}</button></section>`;
}

function ladder(g: Glp1): string {
  const i = LADDER.findIndex((x) => x === g.mg);
  return `<ol class="ladder">${LADDER.map((x, k) => `<li class="${k < i ? 'past' : k === i ? 'now' : ''}"><b>${mg(x)}</b><small>${k === LADDER.length - 1 ? 'întreținere' : `săpt. ${k * 4 + 1}–${k * 4 + 4}`}</small></li>`).join('')}</ol>`;
}

const RULES = [
  ['Proteina întâi', 'La fiecare masă începi cu proteina. Pofta scade, iar ce lași în farfurie să nu fie proteina.'],
  ['Forță de 2–3 ori pe săptămână', 'Fără ea, până la 40% din kilogramele pierdute pot fi mușchi. Inner Beast o are deja.'],
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
    return `${back()}${head('supp', 'Semaglutidă', 'Wegovy, o injecție pe săptămână, cu medicul.')}
    ${setup(g)}
    <section class="card"><h2>Protocolul din prospect</h2>${ladder({ ...g, mg: -1 })}<p class="hint">Fiecare treaptă cel puțin 4 săptămâni. Nu urci dacă slăbești deja 0,5–1% pe săptămână sau dacă greața e puternică.</p></section>
    ${redFlags()}`;
  }
  const t = dueText(g, today);
  const weeks = weeksAtDose(g);
  const last = g.shots.at(-1);
  return `${back()}${head('supp', 'Semaglutidă', `${String(g.mg).replace('.', ',')} mg pe săptămână, ${DAYS[g.day]!.toLowerCase()}`)}
  <section class="card glp"><h2>${t.title}</h2><p>${t.text}</p>${t.act ? '<button class="primary wide" data-g="shot">Am făcut injecția</button>' : ''}
    ${last ? `<p class="hint">Ultima: ${esc(shortDay(last.date))}, ${mg(last.mg)}, ${SITES[last.site]}.${last.nausea != null ? ` Greață: ${NAUSEA[last.nausea]!.toLowerCase()}.` : ''}</p>` : ''}</section>
  <section class="card"><h2>Doza</h2>${ladder(g)}
    <p>${weeks ? `${weeks} ${weeks === 1 ? 'săptămână' : 'săptămâni'} pe ${mg(g.mg)}.` : `Încă nicio doză de ${mg(g.mg)}.`}</p>
    ${rateLine(s.weights)}
    <p class="coach">${stepText(g, s.weights)}</p>
    <p class="field">Doza prescrisă acum de medic</p><div class="chips five">${LADDER.map((x) => `<button data-g="mg" data-v="${x}" aria-pressed="${g.mg === x}">${String(x).replace('.', ',')}</button>`).join('')}</div>
    <p class="hint">Aplicația doar propune. Schimbi doza aici după ce ai vorbit cu medicul.</p></section>
  ${vialCard(g)}
  <section class="card"><h2>Cum mănânci pe semaglutidă</h2>${RULES.map(([a, b]) => `<div class="line"><span><b>${a}</b><br><small>${b}</small></span></div>`).join('')}</section>
  ${redFlags()}
  ${g.shots.length ? `<section class="card"><h2>Istoric</h2>${[...g.shots].reverse().slice(0, 12).map((x, k) => `<div class="line"><span>${esc(shortDay(x.date))} · ${SITES[x.site]}</span><b>${mg(x.mg)}</b><button class="link" data-g="del" data-v="${g.shots.length - 1 - k}" aria-label="Șterge">×</button></div>`).join('')}</section>` : ''}
  <section class="card"><h2>Setări</h2><p class="field">Ziua injecției</p><div class="chips seven">${DAYS.map((d, i) => `<button data-g="day" data-v="${i}" aria-pressed="${g.day === i}">${d.slice(0, 2)}</button>`).join('')}</div>
    <p class="hint">Între două doze trebuie să treacă cel puțin 3 zile; aplicația ține cont când muți ziua.</p>
    <button class="ghost wide" data-g="off" style="margin-top:14px">Opresc tratamentul</button>
    <p class="hint">La oprire, o parte mare din greutate revine de obicei în primul an. Hotărăște oprirea cu medicul și păstrează obiceiurile din aplicație.</p></section>`;
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
