/* Progress photos (2026-11-16, the user: the photos from the side, the front and the back, and to compare them with
   the last ones taken). Each photo carries its pose; the comparison puts this pose's latest photo against an earlier
   one, with a slider across the two or side by side, and the weight of each day under it. The pictures stay in this
   browser's IndexedDB ('bn-photos'), as before; they are not in the backup. */
import { ctx, esc, n1 } from '../app.ts';

export type Pose = 'front' | 'side' | 'back';
export const POSES: Array<[Pose, string]> = [['front', 'Față'], ['side', 'Profil'], ['back', 'Spate']];
const POSE_NAME: Record<Pose, string> = { front: 'Față', side: 'Profil', back: 'Spate' };

interface Photo { id: string; url: string; pose?: Pose }
const dateOf = (p: Photo) => p.id.slice(0, 10);

const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('bn-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function put(p: Photo) {
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put(p); t.oncomplete = res; t.onerror = rej; });
}
async function drop(id: string) {
  const d = await db();
  await new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').delete(id); t.oncomplete = res; t.onerror = rej; });
}
async function all(): Promise<Photo[]> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction('p').objectStore('p').getAll(); r.onsuccess = () => res((r.result as Photo[]).sort((a, b) => a.id.localeCompare(b.id))); r.onerror = rej; });
}

let photos: Photo[] = [];
let pose: Pose = 'front';
let vs = '';
let mode: 'slide' | 'side' = 'slide';
let cut = 50;

const dayRo = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
/** The weighing of that day, or the closest one before it. */
function kgOn(d: string): number | null {
  const w = ctx.get().weights;
  const k = Object.keys(w).filter((x) => x <= d).sort().at(-1);
  return k ? w[k]! : null;
}

/** The card's frame; the photos fill it after they load (photosBind). */
export function photosCard(): string {
  return `<section class="card pp"><h2>Poze de progres</h2>
    <p class="hint">Față, profil și spate, o dată la 2 săptămâni: aceeași oră (dimineața, după baie), același loc și aceeași lumină, telefonul la nivelul pieptului, de la 2–3 m. Stau doar pe acest telefon și nu intră în backup.</p>
    <div class="pp-add">${POSES.map(([k, l]) => `<label class="pp-b" data-pose="${k}"><input type="file" accept="image/*" data-pp-file="${k}"><i class="pp-ic pp-${k}" aria-hidden="true"></i><b>${l}</b><span class="pp-st"></span></label>`).join('')}</div>
    <div id="pp"><p class="hint">Se încarcă pozele…</p></div></section>`;
}

function silhouette(k: Pose) {
  // a tiny outline for the three buttons: the pose to stand in
  const body = k === 'side'
    ? '<circle cx="12" cy="5" r="2.6"/><path d="M11 8.5c-1.6 1.4-1.8 4.8-1.2 7.5l.6 5.5M12.5 8.5c1.6 1.6 1.4 4.6.4 7l-.2 5.5"/>'
    : '<circle cx="12" cy="5" r="2.6"/><path d="M7 9.5h10l-1 6.5h-2l-.5 5h-3l-.5-5H8z"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${body}${k === 'back' ? '<path d="M12 9.5v5" stroke-dasharray="1.5 1.5"/>' : ''}</svg>`;
}

function paint() {
  const box = document.querySelector('#pp');
  if (!box) return;
  const today = ctx.today();
  document.querySelectorAll<HTMLElement>('.pp-b').forEach((b) => {
    const k = b.dataset['pose'] as Pose;
    const ic = b.querySelector('.pp-ic')!;
    if (!ic.innerHTML) ic.innerHTML = silhouette(k);
    const has = photos.some((p) => p.pose === k && dateOf(p) === today);
    b.classList.toggle('ok', has);
    b.querySelector('.pp-st')!.textContent = has ? 'Făcută azi' : 'Adaugă';
  });
  const dates = [...new Set(photos.map(dateOf))].sort().reverse();
  const last = dates.find((d) => d !== today) ?? null;
  const next = last ? Math.max(0, 14 - Math.round((Date.parse(today) - Date.parse(dates[0]!)) / 864e5)) : 0;
  const mine = photos.filter((p) => (p.pose ?? 'front') === pose);
  const now = mine.at(-1);
  const older = mine.filter((p) => now && dateOf(p) < dateOf(now));
  const before = older.find((p) => dateOf(p) === vs) ?? older.at(-1);
  if (before) vs = dateOf(before);
  const kgA = before ? kgOn(dateOf(before)) : null, kgB = now ? kgOn(dateOf(now)) : null;
  const diff = kgA != null && kgB != null ? kgB - kgA : null;
  const days = before && now ? Math.round((Date.parse(dateOf(now)) - Date.parse(dateOf(before))) / 864e5) : 0;
  const tabs = `<div class="seg pp-pose">${POSES.map(([k, l]) => `<button data-pp-pose="${k}" class="${k === pose ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let cmp = '';
  if (!now) cmp = `<p class="hint pad">Nicio poză din ${POSE_NAME[pose].toLowerCase()} încă. Fă prima: ea devine punctul de plecare.</p>`;
  else if (!before) cmp = `<figure class="pp-one"><img src="${now.url}" alt="${POSE_NAME[pose]}, ${esc(dayRo(dateOf(now)))}"><figcaption>${esc(dayRo(dateOf(now)))}${kgB != null ? ` · ${n1(kgB)} kg` : ''}</figcaption></figure><p class="hint">Punctul de plecare. Comparația apare la următoarea poză din ${POSE_NAME[pose].toLowerCase()}.</p>`;
  else {
    const cap = (p: Photo, kg: number | null, k: string) => `<span class="pp-tag ${k}"><b>${k === 'a' ? 'Înainte' : 'Acum'}</b>${esc(dayRo(dateOf(p)))}${kg != null ? ` · ${n1(kg)} kg` : ''}</span>`;
    cmp = `<div class="seg pp-mode"><button data-pp-mode="slide" class="${mode === 'slide' ? 'on' : ''}">Glisor</button><button data-pp-mode="side" class="${mode === 'side' ? 'on' : ''}">Alăturat</button></div>
      ${mode === 'slide'
        ? `<div class="pp-cmp" style="--x:${cut}%"><img src="${before.url}" alt="Înainte, ${esc(dayRo(dateOf(before)))}"><img class="pp-top" src="${now.url}" alt="Acum, ${esc(dayRo(dateOf(now)))}"><i class="pp-line" aria-hidden="true"><u></u></i>${cap(before, kgA, 'a')}${cap(now, kgB, 'b')}
            <input type="range" min="0" max="100" value="${cut}" data-pp-cut aria-label="Glisează între înainte și acum"></div>`
        : `<div class="pp-two"><figure><img src="${before.url}" alt="Înainte">${cap(before, kgA, 'a')}</figure><figure><img src="${now.url}" alt="Acum">${cap(now, kgB, 'b')}</figure></div>`}
      <p class="pp-sum"><b>${days} ${days === 1 ? 'zi' : 'zile'}</b> între ele${diff != null ? ` · <b class="${diff < 0 ? 'down' : 'up'}">${diff < 0 ? '−' : '+'}${n1(Math.abs(diff))} kg</b>` : ''}</p>
      ${older.length > 1 ? `<p class="label">Compară cu</p><div class="chips pp-vs">${older.slice().reverse().map((p) => `<button data-pp-vs="${dateOf(p)}" class="${dateOf(p) === vs ? 'on' : ''}">${esc(dayRo(dateOf(p)))}</button>`).join('')}</div>` : ''}`;
  }
  const sessions = dates.map((d) => `<div class="pp-day"><p><b>${esc(dayRo(d))}</b>${kgOn(d) != null ? ` · ${n1(kgOn(d)!)} kg` : ''}</p><div class="pp-row">${POSES.map(([k, l]) => {
    const p = photos.filter((x) => dateOf(x) === d && (x.pose ?? 'front') === k).at(-1);
    return p ? `<figure><img src="${p.url}" alt="${l}, ${esc(dayRo(d))}"><figcaption>${l}<button class="xs" data-pp-del="${esc(p.id)}" aria-label="Șterge poza ${l} din ${esc(dayRo(d))}">×</button></figcaption></figure>` : `<figure class="none"><span>${l}</span></figure>`;
  }).join('')}</div></div>`).join('');
  box.innerHTML = `${dates.length ? `<p class="pp-next">${next > 0 ? `Următoarea serie: peste ${next} ${next === 1 ? 'zi' : 'zile'}` : 'E timpul pentru o serie nouă: față, profil, spate'}</p>` : ''}
    ${tabs}${cmp}
    ${dates.length ? `<details class="pp-all"><summary>Toate seriile (${dates.length})</summary>${sessions}</details>` : ''}`;
}

/** Loads the photos after the card is on screen, and wires the three file inputs. */
export function photosBind() {
  if (!document.querySelector('#pp') || !('indexedDB' in window)) return;
  void all().then((l) => { photos = l; paint(); }).catch(() => { const b = document.querySelector('#pp'); if (b) b.innerHTML = '<p class="hint">Pozele nu s-au putut citi în acest browser.</p>'; });
  document.querySelectorAll<HTMLInputElement>('[data-pp-file]').forEach((input) => input.addEventListener('change', () => {
    const file = input.files?.[0];
    const k = input.dataset['ppFile'] as Pose;
    input.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      // 1080 px on the long side: enough to see the change, small enough for the phone's storage
      const s = Math.min(1, 1080 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      const p: Photo = { id: `${ctx.today()}-${Date.now()}`, url: c.toDataURL('image/jpeg', 0.82), pose: k };
      void put(p).then(() => { photos.push(p); pose = k; vs = ''; paint(); ctx.toast(`Poza din ${POSE_NAME[k].toLowerCase()} salvată.`); }).catch(() => ctx.toast('Poza nu s-a putut salva: spațiul telefonului e plin?'));
    };
    img.onerror = () => ctx.toast('Fișierul nu e o poză.');
    img.src = URL.createObjectURL(file);
  }));
}

export function photosAction(el: HTMLElement): boolean {
  const d = el.dataset;
  if (d['ppPose']) { pose = d['ppPose'] as Pose; vs = ''; paint(); return true; }
  if (d['ppMode']) { mode = d['ppMode'] as typeof mode; paint(); return true; }
  if (d['ppVs']) { vs = d['ppVs']; paint(); return true; }
  if (d['ppDel']) {
    const id = d['ppDel'];
    void drop(id).then(() => { photos = photos.filter((p) => p.id !== id); paint(); ctx.toast('Poză ștearsă.'); });
    return true;
  }
  return false;
}

/** The slider between before and now: moves the line without redrawing the photos. */
export function photosInput(t: HTMLInputElement): boolean {
  if (t.dataset['ppCut'] == null) return false;
  cut = Number(t.value);
  t.closest<HTMLElement>('.pp-cmp')?.style.setProperty('--x', `${cut}%`);
  return true;
}
