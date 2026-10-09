// SVG artwork for cards, drawn from scratch so the game has no image assets.
import { RANK_LABELS, isRed } from './engine.js';

// Suit shapes drawn in a 100x100 box.
export const SUIT_PATHS = {
  H: 'M50 90 C46 84 8 60 8 33 C8 17 20 7 33 7 C42 7 47 12 50 18 C53 12 58 7 67 7 C80 7 92 17 92 33 C92 60 54 84 50 90 Z',
  D: 'M50 4 L88 50 L50 96 L12 50 Z',
  S: 'M50 6 C56 18 92 40 92 62 C92 76 81 85 69 85 C61 85 56 81 53 76 C54 84 58 90 66 94 L34 94 C42 90 46 84 47 76 C44 81 39 85 31 85 C19 85 8 76 8 62 C8 40 44 18 50 6 Z',
  C: 'M50 6 C62 6 71 15 71 27 C71 33 69 37 66 41 C70 39 73 38 77 38 C89 38 97 47 97 59 C97 71 88 80 76 80 C66 80 59 74 54 67 C54 78 58 88 66 94 L34 94 C42 88 46 78 46 67 C41 74 34 80 24 80 C12 80 3 71 3 59 C3 47 11 38 23 38 C27 38 30 39 34 41 C31 37 29 33 29 27 C29 15 38 6 50 6 Z',
};

export function suitSvg(suit, cls = '') {
  return `<svg class="suit ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="${SUIT_PATHS[suit]}"/></svg>`;
}

// Card face: one large rank with one large suit under it, sized to fill the card
// so it stays readable on a phone.
export function cardFaceHtml(card) {
  if (card.joker) {
    return `
      <div class="face joker-face">
        <svg class="joker-star" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="jg-${card.id}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ff5fa2"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#28c7fa"/>
            </linearGradient>
          </defs>
          <path fill="url(#jg-${card.id})" d="M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37 Z"/>
        </svg>
        <span class="joker-word">JOKER</span>
      </div>`;
  }
  const color = isRed(card) ? 'red' : 'black';
  const label = RANK_LABELS[card.rank];
  return `
    <div class="face ${color}">
      <b class="rank${label.length > 1 ? ' wide' : ''}">${label}</b>
      ${suitSvg(card.suit, 'big')}
    </div>`;
}
