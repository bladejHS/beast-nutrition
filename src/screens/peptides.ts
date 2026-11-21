/* Peptide (2026-11-21, the user: "un tab cu peptide în NUTRIX, să muți semaglutida acolo"). One place for the
   prescribed peptides; semaglutide (screens/glp1.ts) lives under it. */
import { ctx } from '../app.ts';
import { back, head, heroBand, listRow } from './parts.ts';

export function peptidesHtml(): string {
  const s = ctx.get();
  const g = s.glp1;
  return `${back()}${head('supp', 'Peptide', 'Tratamentele cu peptide, urmărite lângă nutriție și analize.')}
  ${heroBand('inject')}
  <div class="list">
    ${listRow('data-tab="glp1"', 'Semaglutidă', g.on ? `${String(g.mg).replace('.', ',')} mg pe săptămână · ${g.shots.length} ${g.shots.length === 1 ? 'injecție notată' : 'injecții notate'}` : 'Wegovy cu medicul: doze, zile, ritm')}
    ${listRow('data-f="sub" data-v="labs"', 'Analize', 'Hormoni, glicemie, ficat: urmărite în timp')}
  </div>
  <p class="hint pad">Doar tratamente prescrise. Doza, pornirea și oprirea le stabilește medicul.</p>`;
}
