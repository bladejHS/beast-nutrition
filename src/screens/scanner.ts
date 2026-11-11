/* The barcode scanner: the camera in a sheet, a code confirmed over two frames, and three ways out when the camera
   cannot help (a photo, the digits typed, the label copied by hand). Chrome on Android reads codes natively; iPhone has
   no such reader, so the ZXing decoder (WebAssembly, served by the app itself) is loaded the first time it is needed. */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { ctx } from '../app.ts';
import { cleanCode, Confirm } from '../logic/scan.ts';

interface Detector { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> }
type DetectorClass = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let detector: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  return detector ??= (async (): Promise<Detector> => {
    const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (Native) {
      const ok = await Native.getSupportedFormats?.().catch(() => []) ?? [];
      if (ok.includes('ean_13')) return new Native({ formats: FORMATS });
    }
    const zx = await import('barcode-detector/ponyfill');
    zx.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
    return new zx.BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
  })().catch((e: unknown) => { detector = null; throw e; });
}

const buzz = () => { try { navigator.vibrate?.(60); } catch { /* not on iPhone */ } };

/** Opens the scanner; `found` gets a checked product code and decides what the sheet shows next. */
export function openScanner(found: (code: string) => void) {
  ctx.open(`<h2>Scanează codul</h2>
    <div class="scan" id="scan"><video id="cam" playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"><i></i></div>
      <button class="scan-torch" id="torch" hidden aria-pressed="false">Lanternă</button></div>
    <p class="hint" id="scanmsg" role="status">Pornesc camera…</p>
    <label class="field">Sau scrie cifrele de sub cod<input id="code" type="text" inputmode="numeric" autocomplete="off" placeholder="5941234567890"></label>
    <div class="btns"><button class="primary" id="find">Caută</button><button class="ghost" id="shot">Din poză</button></div>
    <input id="scanfile" type="file" accept="image/*" capture="environment" hidden>`, 'Scanează codul de bare');

  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
  const video = $<HTMLVideoElement>('#cam')!;
  const say = (t: string) => { const m = $('#scanmsg'); if (m) m.textContent = t; };
  let stream: MediaStream | null = null;
  let done = false;
  const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const hit = (code: string) => { if (done) return; done = true; stop(); buzz(); found(code); };

  $('#find')!.addEventListener('click', () => {
    const code = cleanCode($<HTMLInputElement>('#code')!.value);
    if (code) hit(code); else ctx.toast('Cifrele nu formează un cod valid. Verifică-le pe ambalaj.');
  });
  $('#shot')!.addEventListener('click', () => $<HTMLInputElement>('#scanfile')!.click());
  $<HTMLInputElement>('#scanfile')!.addEventListener('change', (ev) => void (async () => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    say('Citesc poza…');
    try {
      const bmp = await createImageBitmap(file);
      const codes = (await (await getDetector()).detect(bmp)).map((r) => cleanCode(r.rawValue)).filter((c): c is string => !!c);
      bmp.close();
      if (codes[0]) hit(codes[0]); else say('Nu văd un cod în poză. Apropie-te, fără reflexii, cu tot codul în cadru.');
    } catch { say('Nu am putut citi poza. Scrie cifrele de sub cod.'); }
  })());

  void (async () => {
    if (!navigator.mediaDevices?.getUserMedia) { $('#scan')!.hidden = true; say('Aici nu am cameră. Fă o poză codului sau scrie cifrele.'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch {
      $('#scan')!.hidden = true;
      say('Camera nu e permisă pentru aplicație. O pornești din setările telefonului, sau faci o poză codului, sau scrii cifrele.');
      return;
    }
    if (!video.isConnected || done) { stop(); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});

    const track = stream.getVideoTracks()[0];
    const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
    const torch = $<HTMLButtonElement>('#torch');
    if (track && caps.torch && torch) {
      torch.hidden = false;
      torch.addEventListener('click', () => {
        const on = torch.getAttribute('aria-pressed') !== 'true';
        void track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(() => torch.setAttribute('aria-pressed', String(on))).catch(() => {});
      });
    }

    say('Pregătesc cititorul…');
    let det: Detector;
    try { det = await getDetector(); } catch { say('Cititorul nu s-a încărcat (ai nevoie de internet prima dată). Scrie cifrele de sub cod.'); return; }
    say('Ține codul în cadru, la 10–15 cm.');
    const confirm = new Confirm();
    const started = Date.now();
    let slow = false;
    const tick = async () => {
      if (done) return;
      if (!video.isConnected) { stop(); return; }
      if (video.readyState >= 2) {
        const seen = await det.detect(video).catch(() => []);
        for (const r of seen) { const code = confirm.feed(r.rawValue); if (code) { hit(code); return; } }
        if (!slow && Date.now() - started > 9000) { slow = true; say('Nu prind codul. Mai multă lumină, fără reflexii, sau scrie cifrele de sub el.'); }
      }
      setTimeout(() => void tick(), 140);
    };
    void tick();
  })();
}
