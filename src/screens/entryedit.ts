/* Editing a food already logged on Azi (2026-11-28, the user: "să pot edita ce produse adaug în azi"). A tap on the
   food opens it: the amount (the values follow it, the way they were computed when it was added), the name, and the
   meal it sits in. A food brought from MyFitnessPal has no weight, so there the numbers themselves are edited. */
import { ctx, esc, n0, n1, nb, parseNum } from '../app.ts';
import { dayMeals, MEALS, type Entry } from '../logic/store.ts';

/** The entry at another amount: every value scales with the grams, the micronutrients too. */
export function rescale(e: Entry, g: number): Entry {
  if (!(e.g > 0) || !(g > 0)) return e;
  const k = g / e.g;
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  const m = e.m ? Object.fromEntries(Object.entries(e.m).map(([key, v]) => [key, Math.round((v ?? 0) * k * 100) / 100])) as Entry['m'] : undefined;
  return { ...e, g: Math.round(g * 10) / 10, kcal: Math.round(e.kcal * k), p: r1(e.p), c: r1(e.c), f: r1(e.f), fiber: r1(e.fiber), ...(m ? { m } : {}) };
}

export function openEntryEdit(day: string, slot: number, id: string) {
  const s = ctx.get();
  const e = dayMeals(s, day)[slot]?.find((x) => x.id === id);
  if (!e) return;
  const byWeight = e.g > 0;
  const field = (name: string, label: string, v: number) => `<label class="field">${label}<input name="${name}" type="text" inputmode="decimal" value="${n1(v).replace(/,0$/, '')}" autocomplete="off"></label>`;
  ctx.open(`<h2>${esc(e.name)}</h2>
    <form id="entf">
      <label class="field">Nume<input name="name" value="${esc(e.name)}" autocomplete="off"></label>
      ${byWeight
        ? `<div class="amount"><button type="button" class="step" data-estep="-10" aria-label="Scade 10 grame">−</button><label><span class="sr">Cantitate în grame</span><input id="eg" name="g" type="text" inputmode="decimal" value="${n1(e.g).replace(/,0$/, '')}" autocomplete="off"></label><span class="unit">g</span><button type="button" class="step" data-estep="10" aria-label="Crește cu 10 grame">+</button></div>
           <div id="epv" class="preview"></div>`
        : `<p class="hint">Adus din MyFitnessPal, fără gramaj: schimbi direct valorile.</p><div class="grid2">${field('kcal', 'Calorii', e.kcal)}${field('p', 'Proteine, g', e.p)}${field('c', 'Carbohidrați, g', e.c)}${field('f', 'Grăsimi, g', e.f)}</div>`}
      <label class="field">Masa<select name="slot" ${e.from ? 'disabled' : ''}>${MEALS.slice(0, 4).map((m, i) => `<option value="${i}" ${i === slot ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      ${e.from ? '<p class="hint">Face parte dintr-o masă din plan, așa că rămâne la masa ei.</p>' : ''}
      <button class="primary wide">Salvează</button>
    </form>
    <button class="ghost wide" id="entdel" data-del="${slot}:${esc(e.id)}">Șterge alimentul</button>`, esc(e.name));

  // the delete itself is Azi's (today.ts, with its undo); the sheet only closes first
  document.querySelector('#entdel')!.addEventListener('click', () => ctx.close());
  const form = document.querySelector<HTMLFormElement>('#entf')!;
  const g = form.querySelector<HTMLInputElement>('#eg');
  const paint = () => {
    if (!g) return;
    const x = rescale(e, parseNum(g.value) || 0);
    document.querySelector('#epv')!.innerHTML = `<b>${n0(x.kcal)}</b><span>kcal</span><span>${nb(n1(x.p), 'g')} proteine</span><span>${nb(n1(x.c), 'g')} carbo</span><span>${nb(n1(x.f), 'g')} grăsimi</span>`;
  };
  paint();
  g?.addEventListener('input', paint);
  form.querySelectorAll<HTMLButtonElement>('[data-estep]').forEach((b) => b.addEventListener('click', () => {
    if (!g) return;
    g.value = String(Math.max(1, Math.round((parseNum(g.value) || 0) + Number(b.dataset['estep']))));
    paint();
  }));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const name = String(d.get('name') ?? '').trim() || e.name;
    let next: Entry;
    if (byWeight) {
      const grams = parseNum(d.get('g'));
      if (!(grams > 0 && grams < 5000)) { ctx.toast('Scrie cantitatea în grame.'); return; }
      next = { ...rescale(e, grams), name };
    } else {
      const n = (k: string) => Math.max(0, parseNum(d.get(k)) || 0);
      next = { ...e, name, kcal: Math.round(n('kcal')), p: n('p'), c: n('c'), f: n('f') };
    }
    const to = e.from ? slot : Number(d.get('slot') ?? slot);
    const before = s.days[day];
    s.days[day] = dayMeals(s, day).map((list, k) => {
      const kept = list.filter((x) => x.id !== e.id);
      if (k === slot && k === to) return list.map((x) => (x.id === e.id ? next : x));
      return k === to ? [...kept, next] : kept;
    });
    ctx.close(); ctx.commit(); ctx.render();
    ctx.toast(`${name} salvat.`, () => { if (before) s.days[day] = before; else delete s.days[day]; ctx.commit(); ctx.render(); });
  });
}
