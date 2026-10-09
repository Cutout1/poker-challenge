// Pure game logic for Poker Challenge: dealing, hand evaluation, moves, scoring.
// No DOM access here so it can be tested in isolation.

export const COLS = 8;
export const ROWS = 7;
export const ENTRY_FEE = 1000;
export const TIMER_START = 2000;
export const TIMER_RATE = 5;          // dollars lost per second
export const HINT_COST = 50;          // taken from the timer bonus
export const DIFFERENT_HAND_BONUS = 250;
export const CARD_REMOVED_BONUS = 50;

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_NAMES = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
export const RANK_LABELS = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK_NAMES = [null, 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];

export const HANDS = [
  { id: 'pair', name: '1 Pair', value: 50, size: 2 },
  { id: 'twoPair', name: '2 Pairs', value: 125, size: 4 },
  { id: 'trips', name: '3 of a Kind', value: 175, size: 3 },
  { id: 'straight', name: 'Straight', value: 200, size: 5 },
  { id: 'flush', name: 'Flush', value: 200, size: 5 },
  { id: 'fullHouse', name: 'Full House', value: 250, size: 5 },
  { id: 'quads', name: '4 of a Kind', value: 500, size: 4 },
  { id: 'straightFlush', name: 'Straight Flush', value: 1000, size: 5 },
  { id: 'royalFlush', name: 'Royal Flush', value: 2000, size: 5 },
];
export const HAND_BY_ID = Object.fromEntries(HANDS.map(h => [h.id, h]));
export const JOKER_PLAY = { id: 'joker', name: 'Joker Play', value: 0 };

// Bonus for finishing with 10 or fewer cards on the table, indexed by cards left.
export const CLEAR_BONUS = [3000, 2000, 1500, 1000, 750, 600, 500, 400, 300, 200, 100];

export function isRed(card) {
  return card.suit === 'H' || card.suit === 'D';
}

export function cardName(card) {
  return card.joker ? 'Joker' : `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

// Small seeded PRNG so a deal number always reproduces the same layout.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${RANK_LABELS[rank]}${suit}`, rank, suit, joker: false });
    }
  }
  for (let i = 1; i <= 4; i++) deck.push({ id: `JK${i}`, rank: 0, suit: null, joker: true });
  return deck;
}

// Returns columns of cards, each listed bottom (index 0) to top.
export function deal(seed) {
  const rand = mulberry32(seed);
  const deck = makeDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const cols = [];
  for (let c = 0; c < COLS; c++) cols.push(deck.slice(c * ROWS, (c + 1) * ROWS));
  return cols;
}

export function locate(cols, id) {
  for (let c = 0; c < cols.length; c++) {
    const r = cols[c].findIndex(card => card.id === id);
    if (r !== -1) return { c, r, card: cols[c][r] };
  }
  return null;
}

export function cardAt(cols, c, r) {
  return (cols[c] && cols[c][r]) || null;
}

function neighbors(cols, c, r) {
  const out = [];
  for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const card = cardAt(cols, c + dc, r + dr);
    if (card) out.push({ c: c + dc, r: r + dr, card });
  }
  return out;
}

export function areAdjacent(a, b) {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;
}

function isConnected(positions) {
  if (positions.length === 0) return false;
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop();
    positions.forEach((p, j) => {
      if (!seen.has(j) && areAdjacent(positions[i], p)) {
        seen.add(j);
        stack.push(j);
      }
    });
  }
  return seen.size === positions.length;
}

function isStraight(ranks) {
  const sorted = [...ranks].sort((a, b) => a - b);
  if (new Set(sorted).size !== 5) return false;
  if (sorted.join() === '1,10,11,12,13') return true;   // Ace high
  return sorted[4] - sorted[0] === 4;                    // includes Ace low
}

// Classify a set of regular (non-joker) cards. Returns a hand id or null.
export function classify(cards) {
  const counts = {};
  for (const card of cards) counts[card.rank] = (counts[card.rank] || 0) + 1;
  const groups = Object.values(counts).sort((a, b) => b - a).join('');
  const ranks = cards.map(card => card.rank);
  const flush = cards.length === 5 && cards.every(card => card.suit === cards[0].suit);

  switch (cards.length) {
    case 2: return groups === '2' ? 'pair' : null;
    case 3: return groups === '3' ? 'trips' : null;
    case 4:
      if (groups === '4') return 'quads';
      if (groups === '22') return 'twoPair';
      return null;
    case 5: {
      const straight = isStraight(ranks);
      if (straight && flush) {
        return [...ranks].sort((a, b) => a - b).join() === '1,10,11,12,13' ? 'royalFlush' : 'straightFlush';
      }
      if (groups === '32') return 'fullHouse';
      if (flush) return 'flush';
      if (straight) return 'straight';
      return null;
    }
    default: return null;
  }
}

// Check whether the selected card ids form a legal play on the current table.
// Returns { ok: true, hand } or { ok: false, reason }.
export function evaluatePlay(cols, ids) {
  const picks = ids.map(id => locate(cols, id));
  if (picks.some(p => !p)) return { ok: false, reason: 'Some of those cards are no longer on the table.' };
  if (picks.length < 2) return { ok: false, reason: 'Select at least two cards.' };

  const jokers = picks.filter(p => p.card.joker);
  if (jokers.length) {
    if (picks.length !== 2) {
      return { ok: false, reason: 'Jokers aren’t wild — a Joker can only remove one other card.' };
    }
    const [a, b] = picks;
    const bottomJoker = (a.card.joker && a.r === 0) || (b.card.joker && b.r === 0);
    if (areAdjacent(a, b) || bottomJoker) return { ok: true, hand: JOKER_PLAY };
    return { ok: false, reason: 'A Joker can only take a card it touches — unless the Joker is on the bottom row.' };
  }

  if (picks.length > 5) return { ok: false, reason: 'A poker hand has at most five cards.' };
  if (!isConnected(picks)) {
    return { ok: false, reason: 'The cards must touch each other (left, right, above or below).' };
  }
  const handId = classify(picks.map(p => p.card));
  if (!handId) return { ok: false, reason: 'Those cards don’t make a poker hand.' };
  return { ok: true, hand: HAND_BY_ID[handId] };
}

// Remove cards, let the rest fall, and close any empty columns by sliding left.
// Returns the new columns and how many columns disappeared.
export function removeCards(cols, ids) {
  const gone = new Set(ids);
  const fallen = cols.map(col => col.filter(card => !gone.has(card.id)));
  const next = fallen.filter(col => col.length > 0);
  return { cols: next, columnsCleared: fallen.length - next.length };
}

// Enumerate every connected group of 2-5 regular cards (each group once).
function* connectedGroups(cols) {
  const cells = [];
  cols.forEach((col, c) => col.forEach((card, r) => { if (!card.joker) cells.push({ c, r, card }); }));
  const index = new Map(cells.map((p, i) => [`${p.c},${p.r}`, i]));
  const adj = cells.map(p => neighbors(cols, p.c, p.r)
    .filter(n => !n.card.joker)
    .map(n => index.get(`${n.c},${n.r}`)));

  // Standard connected-subgraph enumeration: grow from each root using only
  // vertices with a larger index than the root, never revisiting candidates.
  function* extend(subset, extension, root, excluded) {
    if (subset.length >= 2) yield subset;
    if (subset.length === 5) return;
    const ext = [...extension];
    while (ext.length) {
      const w = ext.pop();
      const nextExt = [...ext];
      const nextExcluded = new Set(excluded);
      for (const u of adj[w]) {
        if (u > root && !nextExcluded.has(u)) {
          nextExt.push(u);
          nextExcluded.add(u);
        }
      }
      yield* extend([...subset, w], nextExt, root, nextExcluded);
    }
  }

  for (let v = 0; v < cells.length; v++) {
    const ext = adj[v].filter(u => u > v);
    const excluded = new Set([v, ...ext]);
    for (const subset of extend([v], ext, v, excluded)) {
      yield subset.map(i => cells[i]);
    }
  }
}

// All legal poker-hand plays on the table (jokers excluded), best first.
export function findHandPlays(cols) {
  const plays = [];
  for (const group of connectedGroups(cols)) {
    const handId = classify(group.map(p => p.card));
    if (handId) plays.push({ hand: HAND_BY_ID[handId], ids: group.map(p => p.card.id) });
  }
  plays.sort((a, b) => b.hand.value - a.hand.value || b.ids.length - a.ids.length);
  return plays;
}

export function findJokerPlay(cols) {
  const all = cols.flatMap((col, c) => col.map((card, r) => ({ c, r, card })));
  for (const p of all) {
    if (!p.card.joker) continue;
    if (p.r === 0) {
      const other = all.find(q => q.card.id !== p.card.id);
      if (other) return { hand: JOKER_PLAY, ids: [p.card.id, other.card.id] };
    }
    const n = neighbors(cols, p.c, p.r)[0];
    if (n) return { hand: JOKER_PLAY, ids: [p.card.id, n.card.id] };
  }
  return null;
}

export function hasAnyPlay(cols) {
  if (findJokerPlay(cols)) return true;
  // Stop at the first hand found instead of building the full list.
  for (const group of connectedGroups(cols)) {
    if (classify(group.map(p => p.card))) return true;
  }
  return false;
}

export function cardsLeft(cols) {
  return cols.reduce((n, col) => n + col.length, 0);
}

export function finalScore({ handCounts, cardsRemoved, timerBonus, cardsRemaining }) {
  const rows = HANDS.map(h => ({ ...h, count: handCounts[h.id] || 0, total: (handCounts[h.id] || 0) * h.value }));
  const gameScore = rows.reduce((s, r) => s + r.total, 0);
  const differentHands = rows.filter(r => r.count > 0).length;
  // Bonuses only count once the hands themselves cover the entry fee.
  const qualified = gameScore >= ENTRY_FEE;
  const differentBonus = qualified ? differentHands * DIFFERENT_HAND_BONUS : 0;
  const removedBonus = qualified ? cardsRemoved * CARD_REMOVED_BONUS : 0;
  const clearBonus = qualified && cardsRemaining <= 10 ? CLEAR_BONUS[cardsRemaining] : 0;
  if (!qualified) timerBonus = 0;
  const final = gameScore + differentBonus + removedBonus + clearBonus + timerBonus;
  return { rows, gameScore, qualified, differentHands, differentBonus, removedBonus, clearBonus, timerBonus, final };
}
