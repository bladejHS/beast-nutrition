/* Alimentele mele (2026-11-11, user: "vreau să mă lași pe mine să adaug macronutrienții și alimentele ... să rămână
   și salvat"): foods the user types in from the label, kept on the phone in State.custom (and in the backup). Values
   can be given per 100 g or per portion; calories, when left empty, come from 4/4/9. A food can be offered in the
   meal plan as a swap for its role, and carries the pack it is bought in, for the shopping list. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import type { Food, FoodRole } from '../logic/foods.ts';
import { pantry } from './state.ts';

const ROLES: [FoodRole | '', string][] = [['', 'Nu'], ['protein', 'Proteină'], ['carb', 'Carbohidrați'], ['fat', 'Grăsime'], ['veg', 'Legumă sau fruct']];
const ROLE_LABEL: Record<FoodRole, string> = { protein: 'proteină', carb: 'carbohidrați', fat: 'grăsime', veg: 'legumă sau fruct' };

/** Per 100 g from what the label says, for a base of `base` grams. Null when the numbers cannot be a food. */
export function fromLabel(v: { kcal?: number; p: number; c: number; f: number; fiber?: number; sugar?: number }, base: number) {
  if (!(base > 0) || [v.p, v.c, v.f].some((x) => !(x >= 0))) return null;
  const k = 100 / base;
  const r = (x: number) => Math.round(x * k * 10) / 10;
  const p = r(v.p), c = r(v.c), f = r(v.f);
  if (p + c + f > 101) return null;
  const kcal = v.kcal && v.kcal > 0 ? Math.round(v.kcal * k) : Math.round(4 * p + 4 * c + 9 * f);
  if (kcal > 950) return null;
  return { kcal, p, c, f, fiber: v.fiber != null && v.fiber >= 0 ? r(v.fiber) : null, sugar: v.sugar != null && v.sugar >= 0 ? r(v.sugar) : 0 };
}

let back: ((f: Food) => void) | null = null;

/** The list of the user's own foods. */
export function openMine() {
  const list = ctx.get().custom;
  ctx.open(`<h2>Alimentele mele</h2>
    <p class="hint">Le găsești la căutare și la scanare, le poți folosi ca înlocuiri în planul de mese și intră în lista de cumpărături cu pachetul lor. Rămân salvate pe telefon și în backup.</p>
    <button class="primary wide" data-mine="new">Adaugă un aliment</button>
    <div class="list">${list.map((f) => `<button class="row" data-mine="edit" data-v="${esc(f.id)}"><span><b>${esc(f.name)}</b><small>${nb(n0(f.p), 'g')} proteine, ${nb(n0(f.c), 'g')} carbo, ${nb(n0(f.f), 'g')} grăsimi la 100 g${f.role ? ` · în plan: ${ROLE_LABEL[f.role]}` : ''}${f.pack ? ` · pachet ${f.pack} g` : ''}</small></span><em>${nb(n0(f.kcal), 'kcal')}<small>Modifică</small></em></button>`).join('') || '<p class="hint pad">Niciun aliment încă.</p>'}</div>`, 'Alimentele mele');
}

/** The form: a new food, or one of the user's to change. `then` decides what follows the save (default: the list). */
export function openFoodEditor(o: { food?: Food; code?: string; then?: (f: Food) => void } = {}) {
  const f = o.food;
  back = o.then ?? null;
  const v = (x: number | undefined | null) => (x == null ? '' : String(x).replace('.', ','));
  const portion = f?.portions[0]?.[1];
  const num = (name: string, label: string, val: string, req = false) => `<label class="field">${label}<input name="${name}" type="text" inputmode="decimal" value="${esc(val)}" ${req ? 'required' : ''} autocomplete="off"></label>`;
  ctx.open(`<h2>${f ? 'Modifică alimentul' : 'Aliment propriu'}</h2>
    <form id="mine">
      <label class="field">Nume<input name="name" required autocomplete="off" value="${esc(f?.name ?? '')}" placeholder="Iaurt grecesc Olympus 2%"></label>
      <fieldset class="pick5"><legend>Valorile de pe etichetă sunt</legend><div>
        <label><input type="radio" name="basis" value="100" checked><span>La 100 g</span></label>
        <label><input type="radio" name="basis" value="portion"><span>Pe porție</span></label></div></fieldset>
      ${num('portion', 'Porția, în grame (pentru „pe porție” și ca porție rapidă la adăugare)', v(portion))}
      <div class="grid2">
        ${num('p', 'Proteine, g', f ? v(f.p) : '', true)}${num('c', 'Carbohidrați, g', f ? v(f.c) : '', true)}
        ${num('f', 'Grăsimi, g', f ? v(f.f) : '', true)}${num('kcal', 'Calorii (gol = calculate)', f ? v(f.kcal) : '')}
        ${num('fiber', 'Fibre, g (opțional)', f && !f.noFiber ? v(f.fiber) : '')}${num('sugar', 'Zahăr, g (opțional)', f?.sugar ? v(f.sugar) : '')}
      </div>
      <p class="hint" id="mine-kcal"></p>
      <label class="field">În planul de mese, ca înlocuire pentru<select name="role">${ROLES.map(([r, l]) => `<option value="${r}" ${(f?.role ?? '') === r ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="sweet" ${f?.sweet ? 'checked' : ''}><span>E dulce (merge doar în mesele dulci, cum e ovăzul cu whey)</span></label>
      ${num('pack', 'Pachetul de la raft, în grame (pentru lista de cumpărături)', v(f?.pack))}
      <label class="field">Cod de bare (opțional)<input name="code" type="text" inputmode="numeric" autocomplete="off" value="${esc(f?.code ?? o.code ?? '')}"></label>
      <button class="primary wide">Salvează</button>
      ${f ? `<button type="button" class="ghost wide" data-mine="del" data-v="${esc(f.id)}">Șterge alimentul</button>` : ''}
    </form>`, f ? 'Modifică alimentul' : 'Aliment propriu');
  const form = document.querySelector<HTMLFormElement>('#mine')!;
  const read = () => {
    const d = new FormData(form);
    const n = (k: string) => { const x = parseNum(d.get(k)); return Number.isFinite(x) ? x : undefined; };
    const base = d.get('basis') === 'portion' ? n('portion') ?? 0 : 100;
    return { d, base, vals: fromLabel({ kcal: n('kcal'), p: n('p') ?? NaN, c: n('c') ?? NaN, f: n('f') ?? NaN, fiber: n('fiber'), sugar: n('sugar') }, base), portion: n('portion'), pack: n('pack') };
  };
  const hint = () => {
    const { vals, base } = read();
    document.querySelector('#mine-kcal')!.textContent = vals ? `La 100 g: ${n0(vals.kcal)} kcal, ${n1(vals.p)} g proteine, ${n1(vals.c)} g carbo, ${n1(vals.f)} g grăsimi.` : base > 0 ? '' : 'Scrie porția în grame.';
  };
  form.addEventListener('input', hint);
  hint();
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const { d, vals, portion, pack } = read();
    if (!vals) { ctx.toast('Valorile nu se potrivesc: verifică dacă sunt la 100 g sau pe porție.'); return; }
    const code = String(d.get('code') ?? '').replace(/\D/g, '');
    const role = String(d.get('role') ?? '') as FoodRole | '';
    const next: Food = {
      id: f?.id ?? `m${crypto.randomUUID()}`, name: String(d.get('name')).trim(), cat: 'Alimentele mele',
      kcal: vals.kcal, p: vals.p, c: vals.c, f: vals.f, fiber: vals.fiber ?? 0, sugar: vals.sugar, sat: 0, sodium: 0,
      portions: portion && portion > 0 ? [[`1 porție (${n0(portion)} g)`, Math.round(portion)]] : [], source: 'mine',
      ...(vals.fiber == null ? { noFiber: true } : {}), ...(role ? { role } : {}), ...(d.get('sweet') ? { sweet: true } : {}),
      ...(pack && pack > 0 ? { pack: Math.round(pack) } : {}), ...(code.length >= 8 ? { code } : {}),
    };
    saveFood(next);
    ctx.toast(f ? 'Alimentul e actualizat.' : 'Salvat în Alimentele mele.');
    const then = back;
    back = null;
    if (then) then(next); else openMine();
  });
}

/** Adds or replaces a food of the user's, everywhere a copy of it is kept. */
export function saveFood(f: Food) {
  const s = ctx.get();
  const at = s.custom.findIndex((x) => x.id === f.id);
  if (at >= 0) s.custom[at] = f; else s.custom.unshift(f);
  s.recent = s.recent.map((r) => (r.id === f.id ? f : r));
  pantry.map.set(f.id, f);
  ctx.commit();
}

export function mineAction(el: HTMLElement): boolean {
  const a = el.dataset['mine'];
  if (!a) return false;
  const s = ctx.get();
  const id = el.dataset['v'] ?? '';
  if (a === 'list') openMine();
  if (a === 'new') openFoodEditor();
  if (a === 'edit') { const f = s.custom.find((x) => x.id === id); if (f) openFoodEditor({ food: f }); }
  if (a === 'del') {
    const today = ctx.today();
    const used = Object.entries(s.fuel.plan).some(([d, ms]) => d >= today && ms.some((m) => !m.done && m.items.some((i) => i.foodId === id)));
    if (used) { ctx.toast('E în planul de mese: schimbă-l acolo întâi.'); return true; }
    const before = { custom: [...s.custom], recent: [...s.recent] };
    s.custom = s.custom.filter((x) => x.id !== id);
    s.recent = s.recent.filter((x) => x.id !== id);
    ctx.commit();
    openMine();
    ctx.toast('Aliment șters. Ce ai notat deja în jurnal rămâne.', () => { s.custom = before.custom; s.recent = before.recent; ctx.commit(); openMine(); });
  }
  return true;
}
