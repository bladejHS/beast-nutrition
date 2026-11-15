/* How to cook a planned meal so it comes out good (2026-11-16, the user: "la mese spune-mi și modul de preparare ca
   să iasă bune"). The meal's foods are matched by name to a technique: the times, the temperatures, the doneness
   signs and the one trick that keeps each food juicy or crisp. The steps start with what takes longest, then the
   protein, the vegetables, and end at the plate. Every quantity is the raw weight the plan gives. */

export interface PrepItem { name: string; g: number }
export interface Prep { steps: string[]; tips: string[]; min: number; flavor: string }

type Kind = 'slow' | 'carb' | 'protein' | 'veg' | 'raw' | 'fat';
interface Tech { re: RegExp; kind: Kind; min: number; say: (g: number, boil: boolean, hot: boolean) => string; tip?: string }

const r10 = (v: number) => Math.max(10, Math.round(v / 10) * 10);
const salt = (g: number) => Math.max(1, Math.round(g / 100)); // about 1 % of the meat's weight
const tsp = (g: number) => { const t = g / 4.5; return t < 0.75 ? 'jumătate de linguriță' : t < 1.25 ? 'o linguriță' : t < 1.75 ? 'o linguriță și jumătate' : `${Math.round(t)} lingurițe`; };

/** First match wins: the specific names before the general ones. */
const TECH: Tech[] = [
  // ---- what takes longest ----
  { re: /fasole (neagr|alb|boabe)|năut usc|fasole usc/i, kind: 'slow', min: 75, say: (g) => `Leguminoasele (${g} g uscate) le pui la înmuiat de cu seară, în apă de trei ori cât ele. Le scurgi, le pui în apă proaspătă și le fierbi la foc mic 60–90 de minute, până se strivesc ușor între degete. Sarea abia în ultimele 10 minute, altfel rămân tari.` },
  { re: /linte/i, kind: 'slow', min: 25, say: (g) => `Clătește lintea (${g} g) și fierbe-o în ${r10(g * 3)} ml apă 20–25 de minute (lintea roșie 12–15), fără sare până la final. O frunză de dafin în apă îi dă gust.` },
  { re: /orez brun/i, kind: 'slow', min: 40, say: (g) => `Clătește orezul brun (${g} g), pune-l cu ${r10(g * 2.2)} ml apă și un praf de sare; după ce clocotește, capac și foc mic 35–40 de minute, apoi 10 minute acoperit, de pe foc.` },
  { re: /orz perlat/i, kind: 'slow', min: 35, say: (g) => `Fierbe orzul (${g} g) în ${r10(g * 3)} ml apă cu sare 30–35 de minute, până e moale dar cu bob, apoi scurge-l.` },
  { re: /sfecl/i, kind: 'slow', min: 50, say: (g) => `Sfecla (${g} g) se coace înfășurată în folie la 200 °C, 45–60 de minute, până intră cuțitul ușor; o cojești caldă. Mai repede: sfeclă gata fiartă, din vid.` },
  { re: /cartofi dulci/i, kind: 'slow', min: 30, say: (g) => `Taie cartofii dulci (${g} g) cuburi de 2–3 cm, amestecă-i cu sare, boia și o parte din ulei; cuptor la 200 °C, 25–30 de minute, întorși la jumătate (air fryer: 190 °C, 18 minute).` },
  { re: /cartofi/i, kind: 'slow', min: 35, say: (g, boil) => boil
    ? `Pune cartofii (${g} g) în apă rece cu sare, dă-i în clocot și fierbe-i 15–20 de minute, până intră furculița fără efort.`
    : `Taie cartofii (${g} g) cuburi de 2–3 cm, clătește-i de amidon și usucă-i bine cu un prosop. Amestecă-i cu sare, boia și o parte din ulei; cuptor la 220 °C, 30–35 de minute, întorși la jumătate, sau air fryer la 200 °C, 20 de minute. Uscați înainte = crocanți după.` },
  // ---- the carbs ----
  { re: /basmati/i, kind: 'carb', min: 22, say: (g) => `Clătește orezul basmati (${g} g) de 3–4 ori, până apa iese limpede. Pune-l cu ${r10(g * 1.5)} ml apă și un praf de sare; la clocot pui capacul, foc mic 12 minute, apoi 10 minute de pe foc, acoperit. Îl afânezi cu furculița: bob lângă bob, nelipit.` },
  { re: /orez/i, kind: 'carb', min: 22, say: (g) => `Clătește orezul (${g} g) până apa iese limpede. Pune-l cu ${r10(g * 1.6)} ml apă și un praf de sare; la clocot, capac și foc mic 12–14 minute, apoi 10 minute de pe foc, acoperit, ca să se termine în aburi. Nu-l amesteca cât fierbe.` },
  { re: /quinoa/i, kind: 'carb', min: 20, say: (g) => `Clătește bine quinoa (${g} g), altfel e amară. Pune-o cu ${r10(g * 2)} ml apă și sare, 15 minute la foc mic cu capac, apoi 5 minute de pe foc.` },
  { re: /bulgur/i, kind: 'carb', min: 15, say: (g) => `Bulgurul (${g} g) îl rumenești 1 minut în cratiță, adaugi ${r10(g * 2)} ml apă fierbinte cu sare și-l lași 12 minute la foc mic, acoperit.` },
  { re: /hrișc/i, kind: 'carb', min: 18, say: (g) => `Prăjește hrișca (${g} g) 2 minute în cratița uscată, până miroase a nucă, apoi ${r10(g * 2)} ml apă cu sare, 15 minute la foc mic, acoperit.` },
  { re: /mei/i, kind: 'carb', min: 22, say: (g) => `Clătește meiul (${g} g) cu apă fierbinte, apoi fierbe-l în ${r10(g * 2.5)} ml apă cu sare 20 de minute, acoperit.` },
  { re: /cuscus/i, kind: 'carb', min: 6, say: (g) => `Toarnă peste cuscus (${g} g) ${r10(g * 1.2)} ml apă clocotită cu sare și o picătură de ulei, acoperă 5 minute, apoi afânează-l cu furculița.` },
  { re: /paste/i, kind: 'carb', min: 12, say: (g) => `Fierbe pastele (${g} g) în ${r10(Math.max(1000, g * 10))} ml apă la clocot cu ${Math.max(8, Math.round(g / 10))} g sare, cu un minut mai puțin decât scrie pe pachet (al dente). Păstrează o cană din apa lor: leagă sosul.` },
  { re: /mălai/i, kind: 'carb', min: 20, say: (g) => `Pune ${r10(g * 4)} ml apă cu sare la fiert; când clocotește, toarnă mălaiul (${g} g) în ploaie, amestecând continuu ca să nu facă cocoloașe, apoi 15–20 de minute la foc mic, amestecând des.` },
  { re: /ovăz/i, kind: 'carb', min: 5, say: (g) => `Fierbe ovăzul (${g} g) în ${r10(g * 3)} ml apă sau lapte 3–5 minute, amestecând, cu un praf de sare (scoate dulceața în față).` },
  { re: /lipie|tortilla/i, kind: 'carb', min: 2, say: () => 'Încălzește lipia 20 de secunde pe fiecare parte într-o tigaie uscată: devine moale și nu se rupe la rulat.' },
  { re: /pâine/i, kind: 'carb', min: 3, say: (g) => `Pâinea (${g} g) o prăjești 1–2 minute, în prăjitor sau în tigaia uscată.` },
  { re: /porumb/i, kind: 'carb', min: 4, say: (g) => `Porumbul (${g} g) îl rumenești 3–4 minute în tigaia uscată, până prinde pete aurii: devine dulce și afumat.` },
  { re: /curmale|miere/i, kind: 'raw', min: 0, say: () => 'Mierea sau curmalele le pui la final, peste.' },
  // ---- the protein ----
  { re: /piept de pui/i, kind: 'protein', min: 20, say: (g) => `Pieptul de pui (${g} g): bate-l la grosime egală, cam 2 cm, și sărează-l cu ${salt(g)} g sare cu 15–30 de minute înainte, plus boia și usturoi granulat. Tigaie încinsă cu puțin ulei: 5–6 minute pe o parte, 4–5 pe cealaltă (sau cuptor la 200 °C, 18–22 de minute). E gata la 74 °C în centru sau când sucul iese limpede. Lasă-l 5 minute înainte să-l tai.`, tip: 'Pieptul de pui se usucă în ultimul minut: scoate-l imediat ce e gata și lasă-l să se odihnească, sucul rămâne în carne.' },
  { re: /pulp[ăe] de pui/i, kind: 'protein', min: 25, say: (g) => `Pulpele dezosate (${g} g), sărate cu ${salt(g)} g sare și condimentate: cuptor la 200 °C, 25 de minute, sau tigaie 6–7 minute pe fiecare parte. Pulpa iartă: rămâne suculentă chiar dacă stă un minut în plus.` },
  { re: /piept de curcan/i, kind: 'protein', min: 18, say: (g) => `Pieptul de curcan (${g} g), feliat de 2 cm și sărat cu ${salt(g)} g sare: tigaie încinsă, 4–5 minute pe fiecare parte, până la 72 °C. 5 minute de odihnă.` },
  { re: /pulp[ăe] de curcan/i, kind: 'protein', min: 30, say: (g) => `Pulpa de curcan (${g} g), sărată cu ${salt(g)} g sare: cuptor la 200 °C, 30 de minute, acoperită primele 15.` },
  { re: /carne tocat/i, kind: 'protein', min: 10, say: (g) => `Carnea tocată (${g} g): tigaie foarte încinsă, o întinzi și o lași 2 minute nemișcată, să facă crustă, abia apoi o spargi cu spatula. Sarea după ce s-a rumenit; 7–8 minute în total.`, tip: 'Carnea tocată fiartă în propria zeamă e gri și fără gust: tigaie încinsă, nu o îngrămădi, las-o să se rumenească.' },
  { re: /mușchi de vită/i, kind: 'protein', min: 12, say: (g) => `Mușchiul de vită (${g} g): scoate-l din frigider cu 20 de minute înainte, usucă-l cu un prosop, sare și piper. Tigaie fumegândă, 2–3 minute pe fiecare parte pentru medium (55–57 °C), 5 minute de odihnă, apoi feliezi perpendicular pe fibră.` },
  { re: /pulp[ăe] de vit|vițel/i, kind: 'protein', min: 10, say: (g) => `Carnea de vită (${g} g) o tai fâșii subțiri, perpendicular pe fibră, și o sărezi. Tigaie foarte încinsă, în două tranșe ca să nu fiarbă: 3–4 minute, doar cât se rumenește.` },
  { re: /mușchi de porc/i, kind: 'protein', min: 20, say: (g) => `Mușchiul de porc (${g} g), sărat cu ${salt(g)} g sare: rumenește-l pe toate părțile 6–8 minute, apoi cuptor la 200 °C 8–10 minute, până la 63 °C în centru. 5 minute de odihnă: rămâne roz-pal și suculent.` },
  { re: /cotlet de porc/i, kind: 'protein', min: 12, say: (g) => `Cotletul (${g} g), sărat dinainte: tigaie încinsă, 4–5 minute pe fiecare parte, până la 63 °C, apoi 5 minute de odihnă.` },
  { re: /pulp[ăe] de porc/i, kind: 'protein', min: 40, say: (g) => `Pulpa de porc (${g} g), tăiată bucăți și sărată cu ${salt(g)} g sare, cu usturoi și cimbru: cuptor la 190 °C, 35–40 de minute, acoperită primele 20.` },
  { re: /ton proaspăt/i, kind: 'protein', min: 5, say: (g) => `Tonul proaspăt (${g} g): usucă-l, sare și susan pe margini; tigaie fumegândă, 1–2 minute pe fiecare parte. Rămâne roz în mijloc; gătit de tot devine sec ca tonul din conservă.` },
  { re: /somon/i, kind: 'protein', min: 14, say: (g) => `Somonul (${g} g): usucă-l, sare. Cu pielea în jos în tigaia încinsă, 4–5 minute fără să-l miști, apoi 1–2 minute pe cealaltă parte (sau cuptor la 200 °C, 12–14 minute). E gata când se desface în foi și e încă ușor rozaliu în mijloc.` },
  { re: /ton la conserv/i, kind: 'raw', min: 0, say: (g) => `Tonul (${g} g) îl scurgi foarte bine și îl desfaci cu furculița, cu zeamă de lămâie și piper.` },
  { re: /creveți/i, kind: 'protein', min: 5, say: (g) => `Creveții (${g} g), decongelați și uscați: 1–2 minute pe fiecare parte în tigaia încinsă, cu usturoi, până devin roz și se curbează în C. În formă de O sunt deja prea făcuți, cauciucoși.` },
  { re: /cod|păstrăv|șalău|tilapia|macrou/i, kind: 'protein', min: 15, say: (g) => `Peștele (${g} g): sare, lămâie, usturoi și mărar; cuptor la 200 °C, 12–15 minute (păstrăvul întreg 18–20), pe hârtie de copt. E gata când devine opac și se desface în foi la furculiță.` },
  { re: /tofu/i, kind: 'protein', min: 15, say: (g) => `Tofu-ul (${g} g): presează-l 15 minute între două prosoape cu ceva greu deasupra, taie-l cuburi, amestecă-l cu o linguriță de amidon și sos de soia. Tigaie încinsă, 8–10 minute, întors pe toate fețele (air fryer: 200 °C, 15 minute). Fără apă în el, devine crocant.` },
  { re: /^ou |ou întreg/i, kind: 'protein', min: 10, say: (g, boil) => boil
    ? `Ouăle (${Math.max(1, Math.round(g / 55))}): în apă clocotită, 9 minute pentru tari (7 pentru gălbenuș moale), apoi direct în apă rece, se curăță ușor.`
    : `Ouăle (${Math.max(1, Math.round(g / 55))}) le bați cu un praf de sare.` },
  { re: /albuș/i, kind: 'protein', min: 6, say: (g) => `Albușurile (${g} g) le gătești la foc mediu-mic, amestecând încet; le iei de pe foc când sunt încă lucioase, se termină singure. Focul mare le face cauciucoase.` },
  { re: /whey/i, kind: 'raw', min: 0, say: (g, _b, hot) => hot ? `Whey-ul (${g} g) îl amesteci doar după ce ai luat totul de pe foc și a stat un minut: la fierbere se brânzește și face cocoloașe.` : `Whey-ul (${g} g) cu 250–300 ml apă sau lapte rece: întâi lichidul în shaker, apoi pudra, ca să nu se lipească de fund.` },
  { re: /iaurt|brânz[ăa] de vaci|cottage|skyr|telemea/i, kind: 'raw', min: 0, say: (g) => `Iaurtul sau brânza (${g} g) se servesc reci, nu se gătesc.` },
  // ---- the vegetables ----
  { re: /broccoli|conopid/i, kind: 'veg', min: 6, say: (g) => `Broccoli sau conopida (${g} g) în buchețele: 4–5 minute la abur, cât rămân verzi-aprinse și crocante (sau cuptor la 220 °C, 15 minute, cu cartofii).` },
  { re: /fasole verde/i, kind: 'veg', min: 7, say: (g) => `Fasolea verde (${g} g): 5 minute în apă clocotită cu sare, apoi 1–2 minute în tigaie cu usturoi.` },
  { re: /ciuperci/i, kind: 'veg', min: 6, say: (g) => `Ciupercile (${g} g) feliate, în tigaia uscată și foarte încinsă: 5 minute, până lasă apa și se rumenesc; sare abia la final, altfel fierb.` },
  { re: /dovlecei|ardei|sparanghel/i, kind: 'veg', min: 6, say: (g) => `Legumele (${g} g) tăiate la fel de mari: sotează-le 5–6 minute la foc mare, să rămână crocante și cu margini rumene.` },
  { re: /vinete/i, kind: 'veg', min: 25, say: (g) => `Vinetele (${g} g) tăiate cuburi, sărate și lăsate 10 minute, apoi uscate cu prosopul: cuptor la 220 °C, 20–25 de minute, cu puțin din ulei, până se rumenesc. Sărate înainte, nu sug uleiul.` },
  { re: /mazăre/i, kind: 'veg', min: 7, say: (g) => `Mazărea (${g} g): 5–7 minute în apă clocotită cu sare (congelată, 3 minute), apoi un strop din ulei și mărar.` },
  { re: /praz/i, kind: 'veg', min: 8, say: (g) => `Prazul (${g} g) tăiat rondele și spălat bine de nisip: călit 6–8 minute la foc mediu, devine dulce.` },
  { re: /kale/i, kind: 'veg', min: 3, say: (g) => `Kale-ul (${g} g) fără cotoare: masează-l 1 minut cu sare și lămâie dacă îl mănânci crud, sau 3 minute în tigaie cu usturoi.` },
  { re: /țelin/i, kind: 'raw', min: 0, say: (g) => `Țelina (${g} g) tăiată subțire, crudă în salată, sau sotată 4 minute cu celelalte legume.` },
  { re: /spanac/i, kind: 'veg', min: 2, say: (g) => `Spanacul (${g} g): 1 minut în tigaie, până scade. Se strânge mult: e normal.` },
  { re: /morcov/i, kind: 'veg', min: 8, say: (g) => `Morcovii (${g} g) în rondele: 8 minute la abur, sau la cuptor alături de cartofi.` },
  { re: /varză/i, kind: 'veg', min: 12, say: (g) => `Varza (${g} g) tăiată fideluță: călește-o 10–12 minute cu ceapa și un strop de apă, la final boia, cimbru și o lingură de oțet sau zeamă de lămâie.` },
  { re: /ceap/i, kind: 'veg', min: 6, say: (g) => `Ceapa (${g} g): călită 5–6 minute la foc mediu, până se înmoaie și se aurește; dă dulceață la toată masa.` },
  { re: /salat|roșii|castrave|rucola/i, kind: 'raw', min: 0, say: (g) => `Salata și legumele crude (${g} g): spălate, tăiate, cu sare, zeamă de lămâie sau oțet și uleiul, chiar înainte de servit, ca să nu se înmoaie.` },
  { re: /afine|căpșuni|zmeur|banan|măr|fruct|mango|mure|cireș|caise|par[ăa]|stafide|strugur|mandarin|piersic|kiwi|portocal|ananas/i, kind: 'raw', min: 0, say: (g) => `Fructele (${g} g) spălate și tăiate, la final, peste.` },
  // ---- the fat, last ----
  { re: /ulei/i, kind: 'fat', min: 0, say: (g) => `Uleiul (${g} g, adică ${tsp(g)}) îl măsori cu lingurița, nu din sticlă: o parte în tigaie, restul crud, peste farfurie, la final.` },
  { re: /parmezan/i, kind: 'fat', min: 0, say: (g) => `Parmezanul (${g} g) ras fin, peste mâncarea fierbinte, ca să se topească.` },
  { re: /unt de arahide/i, kind: 'fat', min: 0, say: (g) => `Untul de arahide (${g} g) cântărit pe cântar: din ochi iese dublu.` },
  { re: /nuci|migdale|semințe|susan|chia|fistic|caju|alune|arahide/i, kind: 'fat', min: 0, say: (g) => `Nucile sau semințele (${g} g) la final, presărate; prăjite 1–2 minute în tigaia uscată au gust dublu (chia nu, ea se înmoaie direct).` },
  { re: /avocado/i, kind: 'fat', min: 0, say: (g) => `Avocado (${g} g) tăiat chiar înainte de masă, cu sare și lămâie, ca să nu se înnegrească.` },
];

/** The seasoning by the dish's name: what makes this plate taste like a dish, not like diet food. */
const FLAVOR: Array<[RegExp, string]> = [
  [/mexican/i, 'chimion, boia afumată, usturoi, zeamă de lime și coriandru verde la final'],
  [/tofu/i, 'sos de soia, ghimbir ras, usturoi și ceapă verde'],
  [/somon|ton proaspăt/i, 'lămâie, mărar, usturoi și piper'],
  [/creveți/i, 'usturoi, fulgi de chili, lămâie și pătrunjel'],
  [/cod|păstrăv/i, 'lămâie, usturoi, mărar sau pătrunjel'],
  [/vită cu paste/i, 'usturoi, oregano, busuioc și un vârf de chili'],
  [/vită|vițel/i, 'piper negru, usturoi, rozmarin sau cimbru'],
  [/porc/i, 'cimbru, chimion, usturoi și boia'],
  [/curcan/i, 'rozmarin, boia dulce, usturoi și lămâie'],
  [/mămăligă/i, 'usturoi, cimbru, boia, plus un mujdei din iaurt cu usturoi pisat'],
  [/pui/i, 'boia dulce, usturoi granulat, oregano și lămâie la final'],
  [/ovăz|iaurt|shake|banană/i, 'scorțișoară, vanilie sau un praf de sare'],
  [/omlet|ouă/i, 'sare, piper, ceapă verde și boia'],
];

/** `base`: the dish's own short steps, which lead the way for a plate with nothing to cook (a shake, a bowl). */
export function prepFor(name: string, items: PrepItem[], base = ''): Prep {
  const boil = /fierbe (ouăle|cartofii)|ouă cu cartofi/i.test(name);
  const rows = items.map((it) => {
    const t = TECH.find((x) => x.re.test(it.name));
    return t ? { t, it } : null;
  }).filter((x): x is { t: Tech; it: PrepItem } => !!x);
  const order: Kind[] = ['slow', 'carb', 'protein', 'veg', 'raw', 'fat'];
  rows.sort((a, b) => order.indexOf(a.t.kind) - order.indexOf(b.t.kind) || b.t.min - a.t.min);
  // something on the fire: not a slice of bread in the toaster
  const hot = rows.some((x) => x.t.kind === 'slow' || x.t.kind === 'protein' || x.t.kind === 'veg' || (x.t.kind === 'carb' && x.t.min >= 5));
  const steps = rows.map(({ t, it }, i) => {
    const text = t.say(Math.round(it.g), boil, hot);
    return i === 0 && t.min >= 15 ? `Pornește întâi asta, durează cel mai mult (${t.min} min). ${text}` : text;
  });
  // nothing to cook: the dish's own way of putting it together first, then the notes worth having
  if (!hot && base) {
    const keep = rows.map(({ t, it }) => (t.kind === 'fat' || t.kind === 'carb' || /whey/i.test(it.name) ? t.say(Math.round(it.g), boil, hot) : '')).filter(Boolean);
    steps.splice(0, steps.length, base, ...keep);
  }
  const flavor = FLAVOR.find(([re]) => re.test(name))?.[1] ?? 'sare, piper, usturoi granulat și boia';
  if (hot) steps.push(`Asamblează în farfurie și gustă: ${flavor}. Un strop de lămâie sau oțet la final „trezește” toată masa.`);
  const tips = [...new Set(rows.map((x) => x.t.tip).filter((x): x is string => !!x))];
  if (rows.some((x) => x.t.kind === 'protein')) tips.push('Carnea și peștele: tigaia bine încinsă înainte, bucățile uscate cu un prosop și puse cu spațiu între ele. Înghesuite, fierb în loc să se rumenească.');
  if (rows.some((x) => x.t.kind === 'slow' || (x.t.kind === 'carb' && x.t.min >= 10))) tips.push('Gătește garnitura pentru 2–3 zile odată: ține 3 zile la frigider, iar cântărită crud, porțiile rămân exacte.');
  const min = rows.reduce((a, x) => Math.max(a, x.t.min), 0) + (rows.filter((x) => x.t.kind === 'protein' || x.t.kind === 'veg').length > 1 ? 5 : 0);
  return { steps, tips, min, flavor };
}
