/* Educational summaries, not recommendations. Written from the cited position stands and EFSA opinions. */
export interface Evidence { name: string; ingredient: string; purpose: string; strength: 'Puternică' | 'Moderată' | 'Limitată' | 'Doar la deficit'; dose: string; timing: string; effects: string; contra: string; interactions: string; refs: string }

export const EVIDENCE: Evidence[] = [
  { name: 'Creatină monohidrat', ingredient: 'Creatină', purpose: 'Forță, putere și masă musculară în antrenamentul de rezistență.', strength: 'Puternică', dose: '3–5 g pe zi, fără încărcare: 3 g pe zi ajung la același nivel în circa 28 de zile.', timing: 'Ora contează puțin; regularitatea contează.', effects: 'Până la 1–2 kg în plus pe cântar, mai ales apă, care nu înseamnă grăsime sau un platou; disconfort digestiv la doze mari.', contra: 'Boală renală: doar cu acordul medicului.', interactions: 'Medicamente care solicită rinichii: întreabă medicul.', refs: 'Kreider et al., ISSN position stand, 2017' },
  { name: 'Proteină din zer', ingredient: 'Whey', purpose: 'O cale comodă de a atinge proteina zilnică.', strength: 'Puternică', dose: 'Cât lipsește până la ținta zilnică; porții studiate de 20–40 g.', timing: 'Total zilnic mai important decât ora.', effects: 'Balonare la intoleranță la lactoză.', contra: 'Alergie la proteinele din lapte.', interactions: 'Fără interacțiuni comune importante.', refs: 'Jäger et al., ISSN position stand, 2017' },
  { name: 'Cafeină', ingredient: 'Cafeină', purpose: 'Performanță în efort de anduranță și forță; atenție.', strength: 'Puternică', dose: 'Studiile folosesc 3–6 mg/kg, dar limita EFSA pentru adulți e 200 mg o dată și 400 mg pe zi, deci nu urca după greutate.', timing: 'Cu 60 de minute înainte de efort, dar la cel puțin 9 ore de culcare. La sesiunile de seară, sari peste ea.', effects: 'Insomnie, neliniște, palpitații.', contra: 'Sarcină, tulburări de ritm cardiac, anxietate: cu prudență.', interactions: 'Unele medicamente îi încetinesc eliminarea, de exemplu ciprofloxacina.', refs: 'Guest et al., ISSN position stand, 2021; EFSA, 2015' },
  { name: 'Beta-alanină', ingredient: 'Beta-alanină', purpose: 'Eforturi intense de aproximativ 1–4 minute.', strength: 'Moderată', dose: '4–6 g pe zi, în doze mici, timp de 2–4 săptămâni.', timing: 'Contează încărcarea zilnică, nu ora.', effects: 'Furnicături trecătoare ale pielii.', contra: 'Date puține în sarcină.', interactions: 'Date puține.', refs: 'Trexler et al., ISSN position stand, 2015' },
  { name: 'Electroliți', ingredient: 'Electroliți', purpose: 'Înlocuirea sării pierdute în efort lung sau cu transpirație abundentă.', strength: 'Moderată', dose: 'Depinde de pierderi; ACSM menționează 0,5–0,7 g sodiu/L în efort prelungit.', timing: 'În timpul efortului lung, mai ales peste 2 ore.', effects: 'Sete și tensiune crescute la exces de sodiu.', contra: 'Hipertensiune, boală renală, boală cardiacă: cu acordul medicului.', interactions: 'Diuretice și unele tratamente pentru tensiune.', refs: 'Sawka et al., ACSM position stand, 2007' },
  { name: 'Omega-3', ingredient: 'Omega-3', purpose: 'Aport de EPA și DHA dacă mănânci rar pește gras.', strength: 'Limitată', dose: 'EFSA: până la 5 g EPA+DHA pe zi nu ridică probleme de siguranță.', timing: 'Cu masa, pentru toleranță.', effects: 'Gust de pește, disconfort digestiv.', contra: 'Alergie la pește, după produs.', interactions: 'Anticoagulante și antiagregante.', refs: 'EFSA, 2012' },
  { name: 'Vitamina D', ingredient: 'Vitamina D', purpose: 'Corectarea unui nivel scăzut; beneficiu pentru performanță neclar la nivel normal.', strength: 'Doar la deficit', dose: 'După analize și sfatul medicului. EFSA: limită de 100 µg (4.000 UI) pe zi.', timing: 'Cu o masă care conține grăsimi.', effects: 'Excesul poate crește calciul din sânge.', contra: 'Hipercalcemie, sarcoidoză.', interactions: 'Unele diuretice și corticosteroizi.', refs: 'EFSA, 2023' },
  { name: 'Magneziu', ingredient: 'Magneziu', purpose: 'Corectarea unui aport scăzut.', strength: 'Doar la deficit', dose: 'EFSA: maximum 250 mg pe zi din suplimente.', timing: 'Separat de medicamentele cu care interacționează.', effects: 'Diaree, mai ales la unele forme.', contra: 'Boală renală severă.', interactions: 'Unele antibiotice, bisfosfonați.', refs: 'EFSA, 2006; NIH ODS' },
];

export const AVOID: [string, string][] = [
  ['Arzătoare de grăsime', 'Dau rezultate mai slabe decât dieta și mișcarea, iar multe etichete sunt inexacte.'],
  ['DNP, sibutramină, efedră, DMAA', 'Substanțe periculoase sau interzise, vândute uneori online pentru slăbit.'],
  ['SARM și prohormoni', 'Substanțe de tip anabolizant, cu riscuri pentru sănătate și interzise în sport.'],
  ['Pre-workout cu doză necunoscută', 'Tratează-le ca pe o doză necunoscută de cafeină și verifică lotul înainte.'],
];

export const MINERALS: [string, string][] = [
  ['Sodiu', 'Principalul mineral pierdut prin transpirație. Pierderile diferă mult de la om la om.'],
  ['Potasiu', 'Se pierde puțin prin transpirație; vine ușor din cartofi, fasole și fructe.'],
  ['Magneziu', 'Pierderi mici prin transpirație; alimentele de bază sunt semințele, nucile și cerealele integrale.'],
];
