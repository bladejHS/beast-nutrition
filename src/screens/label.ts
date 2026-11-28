/* Scanning the nutrition label (2026-11-28): for a product no database knows. A photo of the table, read by Claude
   when the user has an AI key (any layout, any language), else by OCR on the phone (tesseract.js, loaded the first
   time; it needs the internet once for its files). The values then fill "Aliment propriu" for a check: nothing is
   saved before the user presses Salvează. */
import { ctx, esc } from '../app.ts';
import { aiKey, MODEL } from '../logic/ai.ts';
import { cleanLabelAnswer, LABEL_SCHEMA, LABEL_SYSTEM, parseLabel, type LabelVals } from '../logic/label.ts';
import { haptic } from './motion.ts';

/** The photo, shrunk to 1600 px on its long side: enough for the small print, light enough for a phone upload. */
async function shrink(file: File): Promise<{ blob: Blob; data: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('photo'))), 'image/jpeg', 0.9));
  const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.readAsDataURL(blob); });
  return { blob, data };
}

async function byClaude(data: string): Promise<LabelVals | null> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 });
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: LABEL_SCHEMA } },
    system: LABEL_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }, { type: 'text', text: 'Citește tabelul nutrițional.' }] }],
  });
  const text = msg.content.find((b) => b.type === 'text');
  return text && 'text' in text ? cleanLabelAnswer(JSON.parse(text.text)) : null;
}

async function byOcr(blob: Blob, say: (t: string) => void): Promise<LabelVals | null> {
  // the package is CommonJS: depending on the bundler its functions sit on the module or on its default export
  const T = await import('tesseract.js') as unknown as { createWorker?: typeof import('tesseract.js').createWorker; default?: { createWorker: typeof import('tesseract.js').createWorker } };
  const createWorker = T.createWorker ?? T.default!.createWorker;
  const worker = await createWorker(['ron', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') say(`Citesc eticheta… ${Math.round(m.progress * 100)}%`); },
  });
  try { return parseLabel((await worker.recognize(blob)).data.text); }
  finally { void worker.terminate(); }
}

/** The sheet: a photo of the table, then the form filled in. `code` stays on the food so the next scan finds it. */
export function openLabelScan(code: string, done: (vals: LabelVals | null) => void) {
  const ai = !!aiKey();
  ctx.open(`<h2>Scanează eticheta</h2>
    <p class="hint">Fă o poză doar tabelului cu valori nutriționale, drept, cu lumină bună și fără reflexii. ${ai ? 'O citește AI-ul tău (Claude).' : 'O citește telefonul; prima dată descarcă cititorul (câțiva MB).'}</p>
    ${code ? `<p class="hint">Cod ${esc(code)}</p>` : ''}
    <p class="hint" id="lblmsg" role="status"></p>
    <button class="primary wide" id="lblshot">Fotografiază tabelul</button>
    <button class="ghost wide" id="lblpick">Alege o poză</button>
    <button class="ghost wide" data-manual-code>Scriu valorile eu</button>
    <input id="lblcam" type="file" accept="image/*" capture="environment" hidden><input id="lblfile" type="file" accept="image/*" hidden>`, 'Scanează eticheta');
  const say = (t: string) => { const m = document.querySelector('#lblmsg'); if (m) m.textContent = t; };
  const go = async (file: File | undefined) => {
    if (!file) return;
    document.querySelectorAll<HTMLButtonElement>('#lblshot, #lblpick').forEach((b) => { b.disabled = true; });
    say('Citesc eticheta…');
    let vals: LabelVals | null = null;
    try {
      const { blob, data } = await shrink(file);
      vals = ai ? await byClaude(data).catch(() => byOcr(blob, say)) : await byOcr(blob, say);
    } catch { vals = null; }
    if (!document.querySelector('#lblmsg')) return;
    if (!vals) {
      say('N-am putut citi tabelul. Încearcă o poză mai aproape, dreaptă, doar cu tabelul, sau scrie valorile.');
      document.querySelectorAll<HTMLButtonElement>('#lblshot, #lblpick').forEach((b) => { b.disabled = false; });
      return;
    }
    haptic('success');
    done(vals);
  };
  document.querySelector('#lblshot')!.addEventListener('click', () => document.querySelector<HTMLInputElement>('#lblcam')!.click());
  document.querySelector('#lblpick')!.addEventListener('click', () => document.querySelector<HTMLInputElement>('#lblfile')!.click());
  for (const id of ['#lblcam', '#lblfile']) document.querySelector<HTMLInputElement>(id)!.addEventListener('change', (ev) => void go((ev.target as HTMLInputElement).files?.[0]));
}
