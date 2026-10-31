import { ctx, esc } from '../app.ts';
import { mondayOf } from '../logic/review.ts';
import { fatMass, monthly, movingAverage, type Measure } from '../logic/wellness.ts';

const FIELDS: [keyof Measure, string][] = [['waist', 'Talie'], ['hips', 'Șolduri'], ['chest', 'Piept'], ['arm', 'Braț'], ['thigh', 'Coapsă'], ['bf', 'Grăsime %']];

/** Axis never tighter than 4 kg or cm, so small changes do not look dramatic. */
function line(points: [string, number][], label: string, unit: string) {
  if (points.length < 2) return `<p class="hint pad">${esc(label)}: graficul apare după două măsurători.</p>`;
  const W = 340, H = 130;
  const vals = points.map((p) => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 4) { const mid = (hi + lo) / 2; lo = mid - 2; hi = mid + 2; }
  const x = (i: number) => 8 + (i / (points.length - 1)) * (W - 16);
  const y = (v: number) => H - 12 - ((v - lo) / (hi - lo)) * (H - 24);
  const d = points.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart draw" role="img" aria-label="${esc(label)}"><polyline pathLength="1" points="${d}"/><text x="8" y="11">${hi.toFixed(1)} ${unit}</text><text x="8" y="${H - 2}">${lo.toFixed(1)} ${unit}</text></svg>`;
}

const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('bn-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function putPhoto(id: string, url: string) {
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put({ id, url }); t.oncomplete = res; t.onerror = rej; });
}
async function allPhotos(): Promise<{ id: string; url: string }[]> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction('p').objectStore('p').getAll(); r.onsuccess = () => res(r.result as { id: string; url: string }[]); r.onerror = rej; });
}

export function bodyHtml() {
  const s = ctx.get();
  const avg = movingAverage(s.weights);
  const last = [...s.measures].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const kg = avg.at(-1)?.[1];
  const est = kg != null && last?.bf != null ? fatMass(kg, last.bf) : null;
  const waist = s.measures.filter((m) => m.waist != null).map((m): [string, number] => [m.date, m.waist!]).sort();
  return `<section class="card"><h2>Compoziție corporală</h2>
    <h3>Media pe 7 zile</h3>${line(avg.slice(-60), 'Greutate, media pe 7 zile', 'kg')}
    <h3>Talie</h3>${line(waist.slice(-30), 'Talie', 'cm')}
    ${monthly(s.weights).slice(-6).reverse().map((m) => `<div class="line"><span>${esc(m.month)}</span><b>${m.avg.toFixed(1)} kg</b></div>`).join('')}
    ${est ? `<p class="hint">Estimare, nu măsurătoare: ${est.fat.toFixed(1)} kg grăsime, ${est.lean.toFixed(1)} kg masă slabă, din grăsimea de ${last!.bf}% pe care ai notat-o.</p>` : ''}
    <form id="mf2"><div class="grid3">${FIELDS.map(([k, l]) => `<label class="field">${l}<input name="${k}" type="number" step="0.1" inputmode="decimal" value="${last?.[k] ?? ''}"></label>`).join('')}</div>
    <button class="primary wide">Salvează măsurătorile</button></form>
    <p class="hint">Talia și grăsimea ajung și în check-in-ul săptămânii, unde le citește verificarea de platou. Calculul caloriilor nu se schimbă.</p></section>
  <section class="card"><h2>Fotografii</h2><p class="hint">Opțional. Stau doar pe acest dispozitiv și nu intră în backup.</p>
    <label class="ghost file wide">Adaugă o fotografie<input type="file" id="ph" accept="image/*"></label><div id="phs" class="photos"></div></section>`;
}

export function bodyAction(_: HTMLElement) { return false; }

export function bodyBind() {
  const s = ctx.get();
  const form = document.querySelector<HTMLFormElement>('#mf2');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const today = ctx.today();
    const m: Measure = { date: today };
    for (const [k] of FIELDS) { const v = d.get(k); if (v) (m as unknown as Record<string, number>)[k] = Number(v); }
    s.measures = [...s.measures.filter((x) => x.date !== today), m];
    const week = mondayOf(today);
    s.checkins[week] = { ...s.checkins[week], ...(m.waist != null ? { waist: m.waist } : {}), ...(m.hips != null ? { hips: m.hips } : {}), ...(m.bf != null ? { bf: m.bf } : {}) };
    ctx.commit(); ctx.render(); ctx.toast('Măsurători salvate.');
  });
  const box = document.querySelector('#phs');
  if (box && 'indexedDB' in window) {
    void allPhotos().then((list) => { box.innerHTML = list.slice(-6).reverse().map((p) => `<figure><img src="${p.url}" alt="Fotografie din ${esc(p.id)}"><figcaption>${esc(p.id.slice(0, 10))}</figcaption></figure>`).join(''); }).catch(() => {});
  }
  document.querySelector<HTMLInputElement>('#ph')?.addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      void putPhoto(`${ctx.today()}-${Date.now()}`, c.toDataURL('image/jpeg', 0.8)).then(() => ctx.render());
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
