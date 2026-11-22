/* Peptide (2026-11-21, the user: "un tab cu peptide în NUTRIX, să muți semaglutida acolo"). One place for the
   prescribed peptides: semaglutide (screens/glp1.ts) and any other treatment a doctor prescribes (logic/rx.ts), with
   the questions and the labs for the endocrinologist. The app proposes no dose for anything here. */
import { ctx, esc } from '../app.ts';
import { labDef } from '../logic/labs.ts';
import { CJC_NAME, cjcCycle, cjcNextIn, cjcNextSite, isCjc, RX_SITES, rxNextSite, rxSince, rxValid, type Rx } from '../logic/rx.ts';
import { back, head, listRow } from './parts.ts';
import { daysLeft } from './glp1.ts';
import { countdownRing, pepIn, siteMap } from './pepviz.ts';
import { chainArt, pmHero, pmSect, pmStats } from './premium.ts';

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

/** The tile that opens the CJC-1295 + Ipamorelin screen, like the semaglutide one. */
function cjcTile(): string {
  const today = ctx.today();
  const r = (ctx.get().rx ?? []).find(isCjc);
  const left = r ? cjcNextIn(r, today) : null;
  const c = r ? cjcCycle(r.start, today) : null;
  const line = !r ? 'Schema ta: 100 + 100 mcg seara, 5 nopți din 7' : c!.phase === 'pause' ? `Pauză între cicluri · încă ${c!.pauseLeft} zile` : `Săptămâna ${c!.week} din 8–12 · ${num(r.amount)} mcg din fiecare`;
  return `<button class="glp-tile${left === 0 ? ' hot' : ''}" data-tab="cjc">
    ${countdownRing(left, 'CJC-1295 + Ipamorelin')}
    <span class="gt-t"><small>GH · seara, înainte de culcare</small><b>CJC-1295 + Ipamorelin</b><span>${line}</span></span>
    <i class="gt-go" aria-hidden="true">›</i>
  </button>`;
}

const nextSite = (r: Rx) => (isCjc(r) ? cjcNextSite(r) : rxNextSite(r));

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
    ${siteMap(RX_SITES, nextSite(r), r.log.map((x) => x.site))}
    <p class="hint">${last ? `Ultima: ${since === 0 ? 'azi' : since === 1 ? 'ieri' : `acum ${since} zile`}, ${last.time}, ${RX_SITES[last.site]}.` : 'Nicio administrare notată.'} Locul următor: ${RX_SITES[nextSite(r)]}.</p>
    ${r.on && !isCjc(r) ? `<button class="primary wide" data-rx="dose" data-v="${r.id}">Am făcut-o acum</button>` : ''}
    ${r.log.length ? `<details class="sub"><summary>Istoric (${r.log.length})</summary>${[...r.log].reverse().slice(0, 20).map((x) => `<div class="line"><span>${esc(x.date)} ${x.time} · ${RX_SITES[x.site]}</span><b>${num(x.amount)} ${r.unit}</b><button class="link" data-rx="ddel" data-v="${r.id}" data-d="${x.id}" aria-label="Șterge">×</button></div>`).join('')}</details>` : ''}
    <div class="btns"><button class="ghost" data-rx="edit" data-v="${r.id}">Schimbă după rețetă</button><button class="ghost" data-rx="toggle" data-v="${r.id}">${r.on ? 'Opresc' : 'Repornesc'}</button><button class="ghost" data-rx="del" data-v="${r.id}">Șterge</button></div>
    <p class="hint">Mergi la medic dacă apar: durere sau umflătură mare la locul injecției, febră, palpitații, dureri de cap puternice, sânii sensibili sau umflați, schimbări mari de dispoziție.</p></section>`;
}

export function peptidesHtml(): string {
  const s = ctx.get();
  const g = s.glp1;
  const list = s.rx ?? [];
  const open = editing === 'new' ? null : list.find((r) => r.id === editing) ?? null;
  const left = g.on ? daysLeft(g, ctx.today()) : null;
  const active = list.filter((r) => r.on).length + (g.on ? 1 : 0);
  const doses = g.shots.length + list.reduce((t, r) => t + r.log.length, 0);
  return `${back()}${head('supp', 'Peptide', 'Tratamentele cu peptide, urmărite lângă nutriție și analize.')}
  <div class="pm pep${pepIn()}">
  ${pmHero({ eyebrow: 'Lanțuri scurte de aminoacizi', title: 'Peptide', sub: 'Semnale pe care corpul le înțelege. Le urmărești aici, lângă nutriție și analize.', art: chainArt() })}
  ${pmStats([[String(active), active === 1 ? 'tratament activ' : 'tratamente active'], [String(doses), 'doze notate'], [left == null ? '–' : left <= 0 ? 'AZI' : `${left}z`, 'până la semaglutidă']])}
  ${pmSect('Tratamentele tale')}
  <button class="glp-tile${left != null && left <= 0 ? ' hot' : ''}" data-tab="glp1">
    ${countdownRing(left, 'Semaglutidă')}
    <span class="gt-t"><small>GLP-1 · o dată pe săptămână</small><b>Semaglutidă</b><span>${g.on ? `${num(g.mg)} mg pe săptămână · ${g.shots.length} ${g.shots.length === 1 ? 'injecție notată' : 'injecții notate'}` : 'Wegovy cu medicul: doze, zile, ritm'}</span></span>
    <i class="gt-go" aria-hidden="true">›</i>
  </button>
  ${cjcTile()}
  ${list.filter((r) => !isCjc(r)).map((r) => (r.id === editing ? rxForm(r) : rxCard(r))).join('')}
  ${editing === 'new' ? rxForm(null) : !open ? '<button class="ghost wide" data-rx="new">Adaugă un tratament prescris</button>' : ''}
  ${pmSect('Analize și context')}
  <div class="list">
    ${listRow('data-f="sub" data-v="labs"', 'Analize', 'Hormoni, glicemie, ficat: urmărite în timp')}
  </div>
  ${doctorCard()}
  <p class="hint pad">Tratamentele prescrise le notezi exact cum a scris medicul.</p></div>`;
}

export function peptidesAction(el: HTMLElement): boolean {
  const a = el.dataset['rx'];
  if (!a) return false;
  const s = ctx.get();
  s.rx ??= [];
  const v = el.dataset['v'] ?? '';
  const r = s.rx.find((x) => x.id === v);
  if (a === 'cjc') {
    if (!s.rx.some(isCjc)) s.rx.push({ id: `rx${Date.now().toString(36)}`, name: CJC_NAME, amount: 100, unit: 'µg', how: 'fiecare (CJC + Ipamorelin), seara la culcare, pe stomacul gol, 5 zile da / 2 pauză', doctor: '', start: ctx.today(), on: true, log: [] });
  } else if (a === 'new') editing = 'new';
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
    const dose = { id: `d${Date.now().toString(36)}`, date: ctx.today(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, amount: r.amount, site: nextSite(r) };
    r.log.push(dose);
    ctx.commit(); ctx.render();
    ctx.toast(`Notat: ${num(dose.amount)} ${r.unit}, ${RX_SITES[dose.site]}.`, () => { r.log = r.log.filter((y) => y !== dose); ctx.commit(); ctx.render(); });
    return true;
  } else if (a === 'ddel' && r) r.log = r.log.filter((x) => x.id !== el.dataset['d']);
  ctx.commit(); ctx.render();
  return true;
}
