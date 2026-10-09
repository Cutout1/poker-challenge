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

// Simple crown / tiara / helm marks for the court cards.
const COURT_MARKS = {
  13: 'M10 78 L18 30 L36 52 L50 18 L64 52 L82 30 L90 78 Z M10 84 H90 V92 H10 Z',
  12: 'M14 80 C14 56 26 40 50 40 C74 40 86 56 86 80 Z M50 12 A10 10 0 1 1 49.9 12 Z M22 28 A7 7 0 1 1 21.9 28 Z M78 28 A7 7 0 1 1 77.9 28 Z M10 86 H90 V93 H10 Z',
  11: 'M20 88 V50 C20 28 34 14 50 14 C66 14 80 28 80 50 V88 Z M30 52 H70 V60 H30 Z M46 22 H54 V48 H46 Z',
};

const COURT_TINT = { 11: 'jack', 12: 'queen', 13: 'king' };

// Card face for a regular card or joker.
export function cardFaceHtml(card) {
  if (card.joker) {
    return `
      <div class="face joker-face">
        <span class="corner"><b>★</b></span>
        <svg class="joker-art" viewBox="0 0 100 140" aria-hidden="true">
          <defs>
            <linearGradient id="jg-${card.id}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ff5fa2"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#28c7fa"/>
            </linearGradient>
          </defs>
          <path fill="url(#jg-${card.id})" d="M50 22 L60 52 L92 52 L66 71 L76 102 L50 83 L24 102 L34 71 L8 52 L40 52 Z"/>
          <circle cx="50" cy="64" r="9" fill="#fff" opacity=".85"/>
          <text x="50" y="128" text-anchor="middle" class="joker-word">JOKER</text>
        </svg>
      </div>`;
  }
  const red = isRed(card) ? 'red' : 'black';
  const label = RANK_LABELS[card.rank];
  let center;
  if (card.rank >= 11) {
    center = `
      <div class="court ${COURT_TINT[card.rank]}">
        <svg class="court-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="${COURT_MARKS[card.rank]}"/></svg>
        ${suitSvg(card.suit, 'court-suit')}
      </div>`;
  } else if (card.rank === 1) {
    center = `<div class="pip ace">${suitSvg(card.suit)}</div>`;
  } else {
    center = `<div class="pip">${suitSvg(card.suit)}</div>`;
  }
  return `
    <div class="face ${red}">
      <span class="corner"><b>${label}</b>${suitSvg(card.suit, 'mini')}</span>
      ${center}
    </div>`;
}
