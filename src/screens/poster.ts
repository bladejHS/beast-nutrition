/* A trophy as a poster to keep (2026-11-16): 1080 × 1920, the phone's story size, in the app's blue and gold,
   then shared (on the iPhone: "Salvează imaginea") or downloaded. The same drawing as Inner Beast's result poster. */

export interface PosterStat { v: number | string; label: string; unit?: string }

const BASE = import.meta.env.BASE_URL;

export interface PosterData { kicker: string; title: string; by: string; name: string; stats: PosterStat[]; date: string }

const css = (v: string, d: string): string => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d;

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

/** Text squeezed to fit `max` px wide. */
function fit(x: CanvasRenderingContext2D, text: string, size: number, weight: number, max: number): void {
  let s = size;
  do {
    x.font = `${weight} ${s}px Saira, 'Arial Narrow', sans-serif`;
    s -= 4;
  } while (x.measureText(text).width > max && s > 20);
}

export async function posterBlob(d: PosterData): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return null;
  try { await document.fonts.ready; } catch { /* the fallback font draws it */ }
  const glow = css('--glow', '47, 140, 255'), glow2 = '11, 111, 214';
  try { (x as unknown as { fontStretch: string }).fontStretch = 'extra-condensed'; } catch { /* not supported: normal width */ }

  // the arena: black, a pool of the emphasis' light at the top, a floor glow
  x.fillStyle = '#05060a';
  x.fillRect(0, 0, W, H);
  let g = x.createRadialGradient(W / 2, 380, 40, W / 2, 380, 1100);
  g.addColorStop(0, `rgba(${glow2}, .55)`);
  g.addColorStop(0.45, `rgba(${glow2}, .14)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // spotlight rays
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = -3; i <= 3; i++) {
    x.beginPath();
    x.moveTo(W / 2 + i * 30, -40);
    x.lineTo(W / 2 + i * 260 - 120, 1150);
    x.lineTo(W / 2 + i * 260 + 120, 1150);
    x.closePath();
    const r = x.createLinearGradient(0, 0, 0, 1150);
    r.addColorStop(0, `rgba(${glow}, .10)`);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r;
    x.fill();
  }
  // embers
  for (let i = 0; i < 140; i++) {
    const ex = Math.random() * W, ey = Math.random() * H, er = 1 + Math.random() * 3.5;
    x.fillStyle = `rgba(${Math.random() > 0.7 ? '255, 230, 200' : glow}, ${(0.15 + Math.random() * 0.55).toFixed(2)})`;
    x.beginPath();
    x.arc(ex, ey, er, 0, 6.2832);
    x.fill();
  }
  x.restore();

  // the wolf
  const wolf = await img(`${BASE}splash/umbra.webp`);
  if (wolf) {
    const ww = 560, wh = (wolf.height / wolf.width) * ww;
    x.save();
    x.shadowColor = `rgba(${glow}, .9)`;
    x.shadowBlur = 80;
    x.globalAlpha = 0.95;
    x.drawImage(wolf, (W - ww) / 2, 150, ww, wh);
    x.restore();
  }

  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  // the kicker
  x.fillStyle = css('--gold', '#dcb35e');
  x.font = "800 34px Saira, sans-serif";
  x.letterSpacing = '12px';
  x.fillText(d.kicker.toUpperCase(), W / 2, 920);
  x.letterSpacing = '0px';
  // the title in gold
  fit(x, d.title.toUpperCase(), 250, 900, W - 120);
  const tg = x.createLinearGradient(0, 960, 0, 1180);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.45, '#fff3d6');
  tg.addColorStop(0.7, css('--gold-2', '#f5d690'));
  tg.addColorStop(1, css('--gold', '#dcb35e'));
  x.save();
  x.shadowColor = `rgba(${glow}, .8)`;
  x.shadowBlur = 50;
  x.fillStyle = tg;
  x.fillText(d.title.toUpperCase(), W / 2, 1160);
  x.restore();
  x.fillStyle = `rgb(${glow})`;
  x.font = '800 44px Saira, sans-serif';
  x.letterSpacing = '6px';
  x.fillText(d.by.toUpperCase(), W / 2, 1240);
  x.letterSpacing = '0px';
  x.fillStyle = '#a9b2c2';
  fit(x, d.name, 40, 600, W - 160);
  x.fillText(d.name, W / 2, 1300);

  // the stat tiles
  const n = d.stats.length, gap = 24, tw = (W - 120 - gap * (n - 1)) / n, ty = 1370, th = 230;
  d.stats.forEach((s, i) => {
    const tx = 60 + i * (tw + gap);
    const tg2 = x.createLinearGradient(0, ty, 0, ty + th);
    tg2.addColorStop(0, '#1c202b');
    tg2.addColorStop(1, '#0d0f15');
    x.fillStyle = tg2;
    x.beginPath();
    x.roundRect(tx, ty, tw, th, 28);
    x.fill();
    x.strokeStyle = '#272c39';
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = `rgb(${glow})`;
    x.fillRect(tx + tw * 0.2, ty, tw * 0.6, 6);
    x.fillStyle = '#f3f5fa';
    fit(x, String(s.v), 120, 900, tw - 30);
    x.fillText(String(s.v), tx + tw / 2, ty + 130);
    x.fillStyle = '#a9b2c2';
    x.font = '800 30px Saira, sans-serif';
    if (s.unit) x.fillText(s.unit, tx + tw / 2, ty + 168);
    x.fillStyle = '#8f99ab';
    x.letterSpacing = '2px';
    fit(x, s.label.toUpperCase(), 24, 700, tw - 24 - s.label.length * 2);
    x.fillText(s.label.toUpperCase(), tx + tw / 2, ty + 206);
    x.letterSpacing = '0px';
  });

  // the signature
  x.fillStyle = '#f3f5fa';
  x.font = '900 54px Saira, sans-serif';
  x.letterSpacing = '22px';
  x.fillText('BEAST NUTRITION', W / 2 + 11, 1800);
  x.letterSpacing = '0px';
  x.fillStyle = '#7d879a';
  x.font = '700 30px Saira, sans-serif';
  x.fillText(d.date, W / 2, 1852);

  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/png'));
}

/** Shares the poster where the phone can (the iPhone offers "Salvează imaginea"), otherwise downloads it. */
export async function savePoster(d: PosterData): Promise<boolean> {
  const blob = await posterBlob(d);
  if (!blob) return false;
  const name = `beast-nutrition-${d.date.replace(/\s+/g, '-').toLowerCase()}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
