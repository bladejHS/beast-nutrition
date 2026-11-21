/* Blood tests (2026-11-14): the markers worth following while losing weight on semaglutide and training hard.
   Each result is kept with its date; the app shows the trend and whether it sits inside the range. The ranges are
   common adult male reference values, only a guide: every laboratory prints its own, and when the user types those,
   they win. Reading the results stays with the doctor. */

export interface LabDef {
  id: string;
  name: string;
  unit: string;
  /** Typical adult male reference range; null where there is only one side. */
  lo: number | null;
  hi: number | null;
  why: string;
  group: 'metabolic' | 'blood' | 'hormones' | 'organs' | 'vitamins';
}

export interface LabResult {
  id: string;
  marker: string;
  date: string;
  value: number;
  /** The laboratory's own range, when typed. */
  lo?: number | null;
  hi?: number | null;
}

export const LABS: LabDef[] = [
  { id: 'hba1c', name: 'HbA1c', unit: '%', lo: null, hi: 5.6, group: 'metabolic', why: 'Glicemia medie pe 3 luni. 5,7–6,4% înseamnă prediabet.' },
  { id: 'glucose', name: 'Glicemie pe nemâncate', unit: 'mg/dL', lo: 70, hi: 99, group: 'metabolic', why: '100–125 mg/dL pe nemâncate înseamnă glicemie modificată.' },
  { id: 'insulin', name: 'Insulină pe nemâncate', unit: 'µUI/mL', lo: 2, hi: 25, group: 'metabolic', why: 'Cu glicemia, arată rezistența la insulină (HOMA-IR).' },
  { id: 'ldl', name: 'LDL colesterol', unit: 'mg/dL', lo: null, hi: 130, group: 'metabolic', why: 'Scade de obicei odată cu slăbitul.' },
  { id: 'hdl', name: 'HDL colesterol', unit: 'mg/dL', lo: 40, hi: null, group: 'metabolic', why: 'Crește cu efortul aerob.' },
  { id: 'tg', name: 'Trigliceride', unit: 'mg/dL', lo: null, hi: 150, group: 'metabolic', why: 'Sensibile la carbohidrați și alcool; scad mult cu slăbitul.' },
  { id: 'hb', name: 'Hemoglobină', unit: 'g/dL', lo: 13.5, hi: 17.5, group: 'blood', why: 'Transportul oxigenului: rezistența la efort depinde de ea.' },
  { id: 'hct', name: 'Hematocrit', unit: '%', lo: 40, hi: 50, group: 'blood', why: 'Cât din sânge sunt globule roșii. Tratamentele hormonale îl pot urca: peste 54% e de discutat imediat.' },
  { id: 'ferritin', name: 'Feritină', unit: 'ng/mL', lo: 30, hi: 400, group: 'blood', why: 'Rezerva de fier. Sub 30 aduce oboseală la efort, chiar cu hemoglobina normală.' },
  { id: 'testo', name: 'Testosteron total', unit: 'ng/dL', lo: 264, hi: 916, group: 'hormones', why: 'Obezitatea îl scade; de obicei crește când slăbești.' },
  // the axis panel (2026-11-21): what an endocrinologist reads with testosterone; ranges differ a lot between labs
  { id: 'testofree', name: 'Testosteron liber', unit: 'pg/mL', lo: 50, hi: 210, group: 'hormones', why: 'Partea activă. Contează mai ales când SHBG e în afara intervalului.' },
  { id: 'lh', name: 'LH', unit: 'mUI/mL', lo: 1.7, hi: 8.6, group: 'hormones', why: 'Semnalul de la hipofiză către testicule. Cu testosteronul arată unde e problema, dacă există.' },
  { id: 'fsh', name: 'FSH', unit: 'mUI/mL', lo: 1.5, hi: 12.4, group: 'hormones', why: 'Legat de producția de spermatozoizi: important pentru fertilitate.' },
  { id: 'e2', name: 'Estradiol', unit: 'pg/mL', lo: 10, hi: 40, group: 'hormones', why: 'Țesutul gras transformă testosteronul în estradiol; de obicei scade când slăbești.' },
  { id: 'shbg', name: 'SHBG', unit: 'nmol/L', lo: 18, hi: 54, group: 'hormones', why: 'Proteina care leagă testosteronul. Obezitatea și insulina mare o scad.' },
  { id: 'prl', name: 'Prolactină', unit: 'ng/mL', lo: 4, hi: 15.2, group: 'hormones', why: 'Mare, poate scădea testosteronul și libidoul; se ia dimineața, după odihnă.' },
  { id: 'tsh', name: 'TSH', unit: 'mUI/L', lo: 0.4, hi: 4, group: 'hormones', why: 'Tiroida: un metabolism lent poate avea aici o cauză.' },
  { id: 'alt', name: 'ALT (TGP)', unit: 'U/L', lo: null, hi: 41, group: 'organs', why: 'Ficatul. Ficatul gras îl urcă; scade cu slăbitul.' },
  { id: 'ast', name: 'AST (TGO)', unit: 'U/L', lo: null, hi: 40, group: 'organs', why: 'Ficat și mușchi: crește și după un antrenament greu, așa că nu-l face a doua zi după Leg Day.' },
  { id: 'creatinine', name: 'Creatinină', unit: 'mg/dL', lo: 0.7, hi: 1.3, group: 'organs', why: 'Rinichii. Creatina ca supliment o urcă puțin, fără să fie o problemă; spune-i medicului că o iei.' },
  { id: 'lipase', name: 'Lipază', unit: 'U/L', lo: 13, hi: 60, group: 'organs', why: 'Pancreasul: de urmărit pe semaglutidă, mai ales cu dureri de burtă.' },
  { id: 'vitd', name: 'Vitamina D (25-OH)', unit: 'ng/mL', lo: 30, hi: 100, group: 'vitamins', why: 'Sub 30 merită suplimentată, cu medicul.' },
  { id: 'b12', name: 'Vitamina B12', unit: 'pg/mL', lo: 200, hi: 900, group: 'vitamins', why: 'Scade cu metforminul și cu mesele foarte mici.' },
];

export const GROUP_NAME: Record<LabDef['group'], string> = { metabolic: 'Metabolism', blood: 'Sânge', hormones: 'Hormoni', organs: 'Ficat, rinichi, pancreas', vitamins: 'Vitamine' };

export const labDef = (id: string): LabDef | undefined => LABS.find((l) => l.id === id);

export type LabStatus = 'low' | 'ok' | 'high';

/** Inside or outside the range: the laboratory's when typed, the guide's otherwise. */
export function labStatus(r: LabResult): LabStatus {
  const d = labDef(r.marker);
  const lo = r.lo ?? d?.lo ?? null, hi = r.hi ?? d?.hi ?? null;
  if (lo != null && r.value < lo) return 'low';
  if (hi != null && r.value > hi) return 'high';
  return 'ok';
}

/** The results of one marker, oldest first. */
export const history = (all: LabResult[], marker: string): LabResult[] => all.filter((r) => r.marker === marker).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/** HOMA-IR from fasting glucose (mg/dL) and insulin (µUI/mL) taken the same day; above about 2.5 points to insulin resistance. */
export function homa(all: LabResult[]): { date: string; value: number } | null {
  const g = history(all, 'glucose'), i = history(all, 'insulin');
  for (const x of [...g].reverse()) {
    const ins = i.find((y) => y.date === x.date);
    if (ins) return { date: x.date, value: Math.round(((x.value * ins.value) / 405) * 10) / 10 };
  }
  return null;
}
