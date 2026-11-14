/* "Cu AI": a photo or a few words about the meal, sent to Claude with the user's own key; the foods come back with
   grams and are shown for a check before they are logged. Nothing is logged without the tap on "Adaugă".
   The photo is shrunk on the phone, sent once and not kept. The request and the cleaning are in logic/ai.ts. */
import { ctx, esc, n0, nb, parseNum } from '../app.ts';
import { aiKey, buildRequest, looksLikeKey, readAnswer, setAiKey, type AiItem, type AiMeal, type Photo } from '../logic/ai.ts';
import { entryFrom, type Entry } from '../logic/store.ts';

interface Host { meal: string; add: (entries: Entry[]) => void; back: () => void }

let host: Host;
let text = '';
let photo: Photo | null = null;
let thumb = '';

export function openAi(h: Host) {
  host = h; text = ''; photo = null; thumb = '';
  if (aiKey()) ask(); else keySheet();
}

const on = (sel: string, fn: (el: HTMLElement) => void) => document.querySelector<HTMLElement>(sel)?.addEventListener('click', (ev) => fn(ev.currentTarget as HTMLElement));

/** The key is asked for once. A plain text field on purpose: it is an API key, shown as what it is. */
function keySheet() {
  const has = !!aiKey();
  ctx.open(`<h2>Cheia ta de AI</h2>
    <p class="hint">Aplicația e un site public, așa că nu poate avea o cheie a ei. Folosești cheia ta de la Anthropic: rămâne doar pe acest telefon, nu intră în backup și pleacă doar spre Anthropic, odată cu cererea.</p>
    <ol class="steps"><li>Intră pe <b>platform.claude.com</b>, fă un cont și adaugă câțiva dolari credit.</li><li>La <b>API keys</b> apasă <b>Create key</b> și copiază cheia (începe cu sk-ant-).</li><li>Tot acolo, la <b>Limits</b>, pune o limită lunară de cheltuieli. O masă analizată costă cam 1–3 cenți.</li></ol>
    <label class="field">Cheia API Anthropic<input id="ai-key" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="sk-ant-…" value=""></label>
    <button class="primary wide" id="ai-key-save">Salvează cheia</button>
    ${has ? '<button class="ghost wide" id="ai-key-del">Șterge cheia de pe telefon</button>' : ''}
    <button class="ghost wide" id="ai-back">Înapoi la căutare</button>`, 'Cheia ta de AI');
  on('#ai-key-save', () => {
    const k = (document.querySelector<HTMLInputElement>('#ai-key')?.value ?? '').trim();
    if (!looksLikeKey(k)) { ctx.toast('Asta nu arată a cheie Anthropic. Trebuie să înceapă cu sk-ant-.'); return; }
    if (!setAiKey(k)) { ctx.toast('Telefonul n-a lăsat salvarea cheii.'); return; }
    ctx.toast('Cheia e salvată pe telefon.');
    ask();
  });
  on('#ai-key-del', () => { setAiKey(''); ctx.toast('Cheia a fost ștearsă.'); host.back(); });
  on('#ai-back', () => host.back());
}

/** What was eaten: words, a photo, or both. */
function ask(err = '') {
  ctx.open(`<h2>${esc(host.meal)}, cu AI</h2>
    <p class="hint">Scrie ce ai mâncat, fă o poză, sau amândouă. Dacă știi gramele, scrie-le: sunt mai sigure decât orice estimare din poză.</p>
    ${err ? `<p class="warn">${esc(err)}</p>` : ''}
    <label class="sr" for="ai-t">Ce ai mâncat</label><textarea id="ai-t" rows="3" placeholder="200 g piept de pui la grătar, orez, salată cu ulei">${esc(text)}</textarea>
    <div class="btns"><label class="ghost filebtn">Fă o poză<input type="file" id="ai-cam" accept="image/*" capture="environment" hidden></label><label class="ghost filebtn">Din galerie<input type="file" id="ai-pick" accept="image/*" hidden></label></div>
    <div id="ai-thumb">${thumb ? `<img src="${thumb}" alt="Poza mesei"><button class="link" id="ai-nophoto">Scoate poza</button>` : ''}</div>
    <button class="primary wide" id="ai-go">Analizează</button>
    <div class="btns"><button class="ghost" id="ai-back">Înapoi la căutare</button><button class="ghost" id="ai-keybtn">Cheia AI</button></div>
    <p class="hint">Textul și poza merg la Anthropic pentru analiză. Restul datelor rămân pe telefon.</p>`, `${host.meal}, cu AI`);
  const area = document.querySelector<HTMLTextAreaElement>('#ai-t')!;
  area.addEventListener('input', () => { text = area.value; });
  for (const id of ['#ai-cam', '#ai-pick']) document.querySelector<HTMLInputElement>(id)?.addEventListener('change', (ev) => void takePhoto((ev.target as HTMLInputElement).files?.[0]));
  on('#ai-nophoto', () => { photo = null; thumb = ''; ask(); });
  on('#ai-go', () => void analyse());
  on('#ai-back', () => host.back());
  on('#ai-keybtn', keySheet);
}

/** Shrinks the photo to 1280 px on its long side, as JPEG: enough to see a plate, small enough to send on mobile data. */
async function takePhoto(file?: File) {
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    photo = { type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
    thumb = url;
    ask();
  } catch {
    ctx.toast('N-am putut citi poza. Încearcă alta sau descrie masa în cuvinte.');
  }
}

async function analyse() {
  if (!text.trim() && !photo) { ctx.toast('Scrie ce ai mâncat sau adaugă o poză.'); return; }
  if (!navigator.onLine) { ask('Nu ai internet. Analiza cu AI are nevoie de conexiune; restul aplicației merge și fără.'); return; }
  ctx.open(`<h2>${esc(host.meal)}, cu AI</h2><p class="ai-wait" role="status">${photo ? 'Mă uit la farfurie…' : 'Citesc ce ai scris…'}</p><p class="hint">Durează de obicei 5–20 de secunde.</p>`, 'Analizez');
  // the SDK is loaded only now, so the app's first load doesn't carry it
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  try {
    // the key is the user's own and stays on their phone: that is the case the browser flag exists for
    const client = new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
    const meal = readAnswer(await client.beta.messages.create(buildRequest(text, photo)));
    if (!meal.items.length) { ask(meal.note || 'N-am găsit nicio mâncare de notat. Descrie masa în cuvinte.'); return; }
    review(meal);
  } catch (e) {
    ask(explain(e, Anthropic));
  }
}

type SDK = typeof import('@anthropic-ai/sdk').default;
function explain(e: unknown, A: SDK): string {
  if (e instanceof A.AuthenticationError) return 'Cheia nu e acceptată de Anthropic. Verific-o la „Cheia AI”.';
  if (e instanceof A.PermissionDeniedError) return 'Cheia nu are voie să folosească modelul. Verifică workspace-ul și limitele în consola Anthropic.';
  if (e instanceof A.RateLimitError) return 'Prea multe cereri într-un timp scurt. Mai încearcă peste un minut.';
  if (e instanceof A.APIConnectionTimeoutError) return 'A durat prea mult. Încearcă din nou, eventual fără poză.';
  if (e instanceof A.APIConnectionError) return 'N-am ajuns la Anthropic. Verifică internetul și încearcă din nou.';
  if (e instanceof A.BadRequestError) return `Anthropic a respins cererea: ${e.message}. Dacă scrie de credit, adaugă credit în consolă.`;
  if (e instanceof A.APIError) return `Eroare de la Anthropic (${e.status ?? '?'}). Încearcă din nou peste puțin.`;
  if (e instanceof Error && e.message === 'refusal') return 'Modelul a refuzat cererea. Descrie masa în cuvinte simple și încearcă din nou.';
  return 'Răspunsul n-a putut fi citit. Încearcă din nou.';
}

const SURE: Record<AiItem['sure'], string> = { high: 'cantitate dată de tine', medium: 'estimare bună', low: 'estimare slabă: verifică' };

/** The check before logging: every row can be unticked and its grams corrected. */
function review(meal: AiMeal) {
  const rows = meal.items.map((it, i) => `<li class="ai-row ${it.sure}"><label class="ai-on"><input type="checkbox" data-i="${i}" checked><span class="sr">Păstrează ${esc(it.name)}</span></label>
    <div><b>${esc(it.name)}</b><small>${nb(n0(it.kcal), 'kcal')} la 100 g · ${SURE[it.sure]}</small></div>
    <label class="ai-g"><span class="sr">Grame, ${esc(it.name)}</span><input type="text" inputmode="decimal" data-g="${i}" value="${it.g}" autocomplete="off"><span>g</span></label></li>`).join('');
  ctx.open(`<h2>Verifică și adaugă</h2>
    <p class="hint">Valorile sunt estimări. Corectează gramele unde știi mai bine și scoate ce nu e al tău.</p>
    <ul class="ai-list">${rows}</ul>
    ${meal.note ? `<p class="hint">${esc(meal.note)}</p>` : ''}
    <div id="ai-sum" class="preview"></div>
    <button class="primary wide" id="ai-add">Adaugă la ${esc(host.meal)}</button>
    <div class="btns"><button class="ghost" id="ai-again">Încearcă din nou</button><button class="ghost" id="ai-back">Înapoi la căutare</button></div>`, 'Verifică și adaugă');
  const picked = (): Entry[] => meal.items.flatMap((it, i) => {
    const keep = document.querySelector<HTMLInputElement>(`[data-i="${i}"]`)?.checked;
    const g = parseNum(document.querySelector<HTMLInputElement>(`[data-g="${i}"]`)?.value);
    return keep && g > 0 ? [entryFrom(it, Math.min(g, 3000))] : [];
  });
  const paint = () => {
    const es = picked();
    const t = es.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
    document.querySelector('#ai-sum')!.innerHTML = `<b>${n0(t.kcal)}</b><span>kcal</span><span>${nb(n0(t.p), 'g')} proteine</span><span>${nb(n0(t.c), 'g')} carbo</span><span>${nb(n0(t.f), 'g')} grăsimi</span>`;
  };
  paint();
  document.querySelectorAll('.ai-list input').forEach((el) => el.addEventListener('input', paint));
  on('#ai-add', () => {
    const es = picked();
    if (!es.length) { ctx.toast('Nimic bifat de adăugat.'); return; }
    host.add(es);
  });
  on('#ai-again', () => ask());
  on('#ai-back', () => host.back());
}
