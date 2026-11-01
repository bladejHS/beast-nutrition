/* Small pieces the Fuel screens share. */
import { esc } from '../app.ts';

export const cardSrc = (k: string) => `${import.meta.env.BASE_URL}cards/${k}.webp`;

export const back = () => `<button class="backbtn" data-f="sub" data-v="home">‹ Fuel</button>`;

/** The top of a card's picture, under the screen's title. */
export const banner = (k: string, title: string, sub = '') => `<header class="banner"><img src="${cardSrc(k)}" alt="" width="580" height="808" decoding="sync" style="view-transition-name:card-${k}"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>`;
