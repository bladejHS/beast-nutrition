/* Peptide (2026-11-21, the user: "un tab cu peptide în NUTRIX, să muți semaglutida acolo"). One place for the
   prescribed peptides: semaglutide (screens/glp1.ts) and any other treatment a doctor prescribes (logic/rx.ts), with
   the questions and the labs for the endocrinologist. The app proposes no dose for anything here. */
import { ctx, esc } from '../app.ts';
import { labDef } from '../logic/labs.ts';
import { RX_SITES, rxNextSite, rxSince, rxValid, type Rx } from '../logic/rx.ts';
import { back, head, heroBand, listRow } from './parts.ts';

const UNITS: Rx['unit'][] = ['µg', 'mg', 'UI', 'ml'];
const HORMONES = ['testo', 'testofree', 'lh', 'fsh', 'e2', 'shbg', 'prl', 'hct'];
let editing: string | null = null;
const num = (v: number) => String(v).replace('.', ',');

/** The latest result of each hormone marker, as a small table. */
function hormoneTable(): string {
  const s = ctx.get();
  const rows = HORMONES.map((id) => { const r = s.labs.filter((x) => x.marker === id).sort((a, b) => a.date.localeCompare(b.date)).at(-1); const d = labDef(id)!; return `<div class="line"><span>${esc(d.name)}</span><b>${r ? `${num(r.value)} ${esc(d.unit)}` : '–'}</b></div>`; });
  return rows.join('');
}

function doctorCard(): string {
  return `<details class="card"><summary><b>Pentru consultul la endocrinolog</b></summary>
    <h3>Analizele de cerut</h3><p>Testosteron total și liber, LH, FSH, estradiol, SHBG, prolactină, hematocrit (hemoleucogramă). Pe lângă ele: glicemie, HbA1c, lipide, ficat.</p>
    <p class="hint">Dimineața între 7 și 10, pe nemâncate, după o noapte dormită. Nu a doua zi după un antrenament greu. Un testosteron scăzut se confirmă cu a doua recoltare.</p>
    <h3>Întrebări</h3>
    <ol class="ticks"><li>Testosteronul meu e scăzut sau doar la limită, ținând cont de greutate?</li><li>Problema e la testicule sau la semnalul din creier (LH, FSH)?</li><li>Cât ar crește doar din slăbit, cu semaglutida pe care o fac?</li><li>Ce tratamente aprobate există pentru mine și cum îmi afectează fertilitatea?</li><li>Ce părere aveți despre kisspeptină, dat fiind că nu e aprobată ca tratament?</li><li>Ce analize de control și la ce interval, dacă pornim ceva?</li></ol>
    <h3>Ultimele valori din Analize</h3>${hormoneTable()}
    <button class="ghost wide" data-f="sub" data-v="labs">Adaugă rezultate în Analize</button></details>`;
}

function rxForm(r: Rx | null): string {
  return `<section class="card"><h2>${r ? 'Schimbă tratamentul' : 'Tratament prescris'}</h2>
    <p class="hint">Scrii exact ce a scris medicul. Aplicația nu propune doze și nu le ajustează.</p>
    <label class="field">Numele<input id="rx-name" value="${esc(r?.name ?? '')}" placeholder="ex. Kisspeptină" maxlength="40"></label>
    <div class="grid2"><label class="field">Doza din prescripție<input id="rx-amt" type="text" inputmode="decimal" value="${r ? num(r.amount) : ''}"></label>
      <label class="field">Unitatea<select id="rx-unit">${UNITS.map((u) => `<option ${r?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
    <label class="field">Cât de des, cum a scris medicul<input id="rx-how" value="${esc(r?.how ?? '')}" placeholder="ex. cum e pe rețetă" maxlength="80"></label>
    <label class="field">Medicul<input id="rx-doc" value="${esc(r?.doctor ?? '')}" placeholder="opțional" maxlength="60"></label>
    <button class="primary wide" data-rx="save" data-v="${r?.id ?? ''}">Salvează</button>
    ${r ? `<button class="ghost wide" data-rx="cancel">Renunță</button>` : ''}</section>`;
}

function rxCard(r: Rx): string {
  const today = ctx.today();
  const since = rxSince(r, today);
  const last = r.log.at(-1);
  return `<section class="card rx"><div class="ch"><h2>${esc(r.name)}</h2>${r.on ? '' : '<span class="hint">oprit</span>'}</div>
    <p><b>${num(r.amount)} ${r.unit}</b> · ${esc(r.how)}${r.doctor ? ` · ${esc(r.doctor)}` : ''}</p>
    <p class="hint">${last ? `Ultima: ${since === 0 ? 'azi' : since === 1 ? 'ieri' : `acum ${since} zile`}, ${last.time}, ${RX_SITES[last.site]}.` : 'Nicio administrare notată.'} Locul următor: ${RX_SITES[rxNextSite(r)]}.</p>
    ${r.on ? `<button class="primary wide" data-rx="dose" data-v="${r.id}">Am făcut-o acum</button>` : ''}
    ${r.log.length ? `<details class="sub"><summary>Istoric (${r.log.length})</summary>${[...r.log].reverse().slice(0, 20).map((x) => `<div class="line"><span>${esc(x.date)} ${x.time} · ${RX_SITES[x.site]}</span><b>${num(x.amount)} ${r.unit}</b><button class="link" data-rx="ddel" data-v="${r.id}" data-d="${x.id}" aria-label="Șterge">×</button></div>`).join('')}</details>` : ''}
    <div class="btns"><button class="ghost" data-rx="edit" data-v="${r.id}">Schimbă după rețetă</button><button class="ghost" data-rx="toggle" data-v="${r.id}">${r.on ? 'Opresc' : 'Repornesc'}</button><button class="ghost" data-rx="del" data-v="${r.id}">Șterge</button></div>
    <p class="hint">Mergi la medic dacă apar: durere sau umflătură mare la locul injecției, febră, palpitații, dureri de cap puternice, sânii sensibili sau umflați, schimbări mari de dispoziție.</p></section>`;
}

export function peptidesHtml(): string {
  const s = ctx.get();
  const g = s.glp1;
  const list = s.rx ?? [];
  const open = editing === 'new' ? null : list.find((r) => r.id === editing) ?? null;
  return `${back()}${head('supp', 'Peptide', 'Tratamentele cu peptide, urmărite lângă nutriție și analize.')}
  ${heroBand('inject')}
  <div class="list">
    ${listRow('data-tab="glp1"', 'Semaglutidă', g.on ? `${num(g.mg)} mg pe săptămână · ${g.shots.length} ${g.shots.length === 1 ? 'injecție notată' : 'injecții notate'}` : 'Wegovy cu medicul: doze, zile, ritm')}
    ${listRow('data-f="sub" data-v="labs"', 'Analize', 'Hormoni, glicemie, ficat: urmărite în timp')}
  </div>
  ${list.map((r) => (r.id === editing ? rxForm(r) : rxCard(r))).join('')}
  ${editing === 'new' ? rxForm(null) : !open ? '<button class="ghost wide" data-rx="new">Adaugă un tratament prescris</button>' : ''}
  ${doctorCard()}
  <p class="hint pad">Doar tratamente prescrise. Doza, pornirea și oprirea le stabilește medicul.</p>`;
}

export function peptidesAction(el: HTMLElement): boolean {
  const a = el.dataset['rx'];
  if (!a) return false;
  const s = ctx.get();
  s.rx ??= [];
  const v = el.dataset['v'] ?? '';
  const r = s.rx.find((x) => x.id === v);
  if (a === 'new') editing = 'new';
  else if (a === 'cancel') editing = null;
  else if (a === 'edit') editing = v;
  else if (a === 'toggle' && r) r.on = !r.on;
  else if (a === 'del' && r) {
    const before = [...s.rx];
    s.rx = s.rx.filter((x) => x !== r);
    ctx.commit(); ctx.render();
    ctx.toast(`${r.name} șters, cu istoricul lui.`, () => { s.rx = before; ctx.commit(); ctx.render(); });
    return true;
  }
  else if (a === 'save') {
    const val = (id: string) => document.querySelector<HTMLInputElement>(id)?.value ?? '';
    const x = { name: val('#rx-name').trim(), amount: Number(val('#rx-amt').replace(',', '.')), unit: (val('#rx-unit') || 'µg') as Rx['unit'], how: val('#rx-how').trim(), doctor: val('#rx-doc').trim() };
    const bad = rxValid(x);
    if (bad) { ctx.toast(bad); return true; }
    if (r) Object.assign(r, x);
    else s.rx.push({ id: `rx${Date.now().toString(36)}`, ...x, start: ctx.today(), on: true, log: [] });
    editing = null;
  } else if (a === 'dose' && r) {
    const now = new Date();
    const dose = { id: `d${Date.now().toString(36)}`, date: ctx.today(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, amount: r.amount, site: rxNextSite(r) };
    r.log.push(dose);
    ctx.commit(); ctx.render();
    ctx.toast(`Notat: ${num(dose.amount)} ${r.unit}, ${RX_SITES[dose.site]}.`, () => { r.log = r.log.filter((y) => y !== dose); ctx.commit(); ctx.render(); });
    return true;
  } else if (a === 'ddel' && r) r.log = r.log.filter((x) => x.id !== el.dataset['d']);
  ctx.commit(); ctx.render();
  return true;
}
