import {
  COLS, ROWS, ENTRY_FEE, TIMER_START, TIMER_RATE, HINT_COST, HANDS, HAND_BY_ID, CLEAR_BONUS,
  deal, evaluatePlay, removeCards, findHandPlays, findJokerPlay, hasAnyPlay, cardsLeft,
  finalScore, cardName, locate,
} from './engine.js';
import { cardFaceHtml } from './cards.js';
import { sfx, setSoundEnabled } from './sound.js';
import { store } from './storage.js';

const $ = sel => document.querySelector(sel);
const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
const GAME_KEY = 'poker-challenge:game';

const els = {
  board: $('#board'), table: $('#table'), timer: $('#timer'), score: $('#score'), scoreStat: $('#scoreStat'),
  timerStat: $('#timerStat'), dealNo: $('#dealNo'), selectionInfo: $('#selectionInfo'), playBtn: $('#playBtn'),
  clearBtn: $('#clearBtn'), hands: $('#hands'), playerName: $('#playerName'), bankroll: $('#bankroll'),
  toast: $('#toast'), pausedCover: $('#pausedCover'), menu: $('#menu'), menuBtn: $('#menuBtn'),
  undoBtn: $('#undoBtn'), pauseBtn: $('#pauseBtn'), hintBtn: $('#hintBtn'),
};

const HAND_INFO = {
  pair: { desc: 'Two cards of the same rank.', example: ['5H', '5C'] },
  twoPair: { desc: 'Two different pairs played together as one group of four cards.', example: ['JS', 'JD', '5H', '5C'] },
  trips: { desc: 'Three cards of the same rank.', example: ['7S', '7H', '7D'] },
  straight: { desc: 'Five cards in sequence, any suits. Aces can be high (10-J-Q-K-A) or low (A-2-3-4-5).', example: ['3C', '4H', '5S', '6D', '7C'] },
  flush: { desc: 'Any five cards of the same suit.', example: ['2S', '6S', '9S', 'JS', 'KS'] },
  fullHouse: { desc: 'A three of a kind and a pair together.', example: ['QS', 'QH', 'QD', '5C', '5D'] },
  quads: { desc: 'Four cards of the same rank.', example: ['KS', 'KH', 'KD', 'KC'] },
  straightFlush: { desc: 'Five cards in sequence, all of the same suit.', example: ['3C', '4C', '5C', '6C', '7C'] },
  royalFlush: { desc: 'Ten, Jack, Queen, King and Ace, all of the same suit. The best hand there is.', example: ['10H', 'JH', 'QH', 'KH', 'AH'] },
};

const RIDDLES = {
  pair: 'Two of a kind are sitting side by side, like twins who never learned to hide.',
  twoPair: 'Two couples have come out for the night, standing close and holding tight.',
  trips: 'A trio sings in perfect tune, three matching voices: find them soon!',
  straight: 'Five in a row, step after step, climbing a ladder rung by rung.',
  flush: 'Five friends all wearing the very same suit. Spot that crowd and you’ll earn the loot.',
  fullHouse: 'Three plus two under one roof: the house is full, and here’s your proof.',
  quads: 'Four of a kind stand shoulder to shoulder. Find them before your clock gets older.',
  straightFlush: 'A ladder of five in a single suit. Rare and lovely, and worth the pursuit!',
  royalFlush: 'Ten up to Ace, all dressed the same. Royalty is waiting to win you this game!',
  joker: 'No poker hand is showing now, but a Joker can help you anyhow.',
};

const CLEAR_MESSAGES = [
  'Incredible! You cleared every card!', 'Amazing! Only 1 card left!', 'Brilliant! Only 2 cards left!',
  'Fantastic! Only 3 cards left!', 'Superb! Only 4 cards left!', 'Excellent! Only 5 cards left!',
  'Great job! Only 6 cards left!', 'Very nice! Only 7 cards left!', 'Nicely done! Only 8 cards left!',
  'Good work! Only 9 cards left!', 'Not bad! Only 10 cards left!',
];

let game = null;          // current game state
let undoState = null;     // snapshot before the last play
const cardEls = new Map(); // card id -> element
let layoutSize = { w: 60, h: 84, gap: 6 };

// ---------- Game lifecycle ----------

function randomSeed() {
  return 1 + Math.floor(Math.random() * 999999);
}

function newGameState(seed) {
  return {
    seed,
    cols: deal(seed),
    selected: [],
    handCounts: {},
    score: 0,
    cardsRemoved: 0,
    elapsed: 0,        // seconds the timer has run
    hintPenalty: 0,
    started: false,    // timer starts on the first play
    paused: false,
    over: false,
    feeCovered: false,
  };
}

function timerBonus() {
  if (!game) return TIMER_START;
  return Math.max(0, TIMER_START - game.hintPenalty - Math.floor(game.elapsed) * TIMER_RATE);
}

function inProgress() {
  return game && !game.over && game.started;
}

function startGame(seed, { chargeFee = true } = {}) {
  if (!store.currentName()) { openPlayers(); return; }
  if (chargeFee) store.chargeEntryFee(ENTRY_FEE);
  game = newGameState(seed);
  undoState = null;
  history.replaceState(null, '', `#deal=${seed}`);
  buildBoard();
  sfx.deal();
  saveGame();
  updateAll();
}

function forfeitCurrent() {
  if (game && !game.over) {
    // The entry fee is already gone; record the game as played with no winnings.
    store.recordGame({ final: 0, won: false, handCounts: game.handCounts, seed: game.seed });
    game.over = true;
    clearSavedGame();
  }
}

function requestNewGame(seed = randomSeed()) {
  if (inProgress()) {
    confirmBox('Start a new game?', `You'll forfeit this game and its ${money(ENTRY_FEE)} entry fee. There are still plays left.`, [
      { label: 'Keep playing' },
      { label: 'New game', primary: true, action: () => { forfeitCurrent(); startGame(seed); } },
    ]);
  } else {
    if (game && !game.over) clearSavedGame(); // untouched deal: fee was already charged, so reuse it
    startGame(seed, { chargeFee: !(game && !game.over && !game.started) });
  }
}

function requestRestart() {
  if (!game) return;
  if (game.over) { startGame(game.seed); return; }
  confirmBox('Restart this deal?', 'The same cards will be dealt again from the start. You keep the entry fee you already paid, but your score and timer reset.', [
    { label: 'Cancel' },
    { label: 'Restart', primary: true, action: () => startGame(game.seed, { chargeFee: false }) },
  ]);
}

// ---------- Saving an unfinished game ----------

function saveGame() {
  if (!game || game.over) return;
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ player: store.currentName(), game: { ...game, selected: [] } }));
  } catch { /* storage unavailable */ }
}

function clearSavedGame() {
  try { localStorage.removeItem(GAME_KEY); } catch { /* storage unavailable */ }
}

function loadSavedGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY));
    if (saved && saved.player === store.currentName() && saved.game && !saved.game.over) return saved.game;
  } catch { /* ignore */ }
  return null;
}

// ---------- Board rendering ----------

function buildBoard({ animate = true } = {}) {
  els.board.innerHTML = '';
  cardEls.clear();
  measure();
  // Position cards before they enter the page so they never slide in from the corner.
  const frag = document.createDocumentFragment();
  game.cols.forEach(col => col.forEach(card => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'card' + (card.joker ? ' joker' : '');
    el.dataset.id = card.id;
    el.setAttribute('aria-label', cardName(card));
    el.setAttribute('aria-pressed', 'false');
    el.innerHTML = cardFaceHtml(card);
    frag.appendChild(el);
    cardEls.set(card.id, el);
  }));
  positionCards();
  els.board.appendChild(frag);
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) dealAnimation();
}

// Size cards to fit the table area.
function measure() {
  const rect = els.table.getBoundingClientRect();
  const gap = Math.max(3, Math.min(8, rect.width / 140));
  const pad = 8;
  const maxW = (rect.width - pad * 2 - gap * (COLS - 1)) / COLS;
  const maxH = (rect.height - pad * 2 - gap * (ROWS - 1)) / ROWS;
  const w = Math.max(20, Math.floor(Math.min(maxW, maxH * 5 / 7, 120)));
  const h = Math.floor(w * 7 / 5);
  layoutSize = { w, h, gap };
  els.board.style.width = `${COLS * w + (COLS - 1) * gap}px`;
  els.board.style.height = `${ROWS * h + (ROWS - 1) * gap}px`;
  document.documentElement.style.setProperty('--cw', `${w}px`);
  document.documentElement.style.setProperty('--ch', `${h}px`);
}

function layout() {
  measure();
  positionCards();
}

function cellPosition(c, r) {
  const { w, h, gap } = layoutSize;
  return { x: c * (w + gap), y: (ROWS - 1 - r) * (h + gap) };
}

function positionCards() {
  if (!game) return;
  game.cols.forEach((col, c) => col.forEach((card, r) => {
    const el = cardEls.get(card.id);
    if (!el) return;
    const { x, y } = cellPosition(c, r);
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
  }));
}

// Cards fly in from a deck above the table, column by column.
function dealAnimation() {
  const { w, h } = layoutSize;
  const deckX = (COLS * (w + layoutSize.gap)) / 2 - w / 2;
  game.cols.forEach((col, c) => col.forEach((card, r) => {
    const { x, y } = cellPosition(c, r);
    cardEls.get(card.id).animate([
      { transform: `translate(${deckX}px, ${-h * 1.5}px) rotate(-12deg)`, opacity: 0 },
      { transform: `translate(${x}px, ${y}px)`, opacity: 1 },
    ], {
      duration: 420, delay: (c * ROWS + (ROWS - 1 - r)) * 14,
      easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)', fill: 'backwards',
    });
  }));
}

function syncSelection() {
  const sel = new Set(game ? game.selected : []);
  cardEls.forEach((el, id) => {
    const on = sel.has(id);
    el.classList.toggle('selected', on);
    el.setAttribute('aria-pressed', String(on));
  });
}

// ---------- HUD ----------

function updateAll() {
  updateHud();
  updateHands();
  updateSelectionInfo();
  syncSelection();
  updatePlayer();
}

function updateHud() {
  const bonus = timerBonus();
  els.timer.textContent = bonus > 0 ? money(bonus) : 'None';
  els.timerStat.classList.toggle('running', !!(game && game.started && !game.paused && !game.over));
  els.timerStat.classList.toggle('low', bonus <= 300);
  els.score.textContent = money(game ? game.score : 0);
  els.scoreStat.classList.toggle('covered', !!(game && game.score >= ENTRY_FEE));
  els.dealNo.textContent = game ? `Deal #${game.seed}` : 'Deal #—';
  els.undoBtn.disabled = !undoState || !game || game.over;
  els.pauseBtn.disabled = !game || game.over;
  els.hintBtn.disabled = !game || game.over || game.paused;
  els.pausedCover.hidden = !(game && game.paused);
  els.table.classList.toggle('is-paused', !!(game && game.paused));
}

function updateHands() {
  const counts = game ? game.handCounts : {};
  els.hands.innerHTML = '';
  for (const h of HANDS) {
    const n = counts[h.id] || 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hand' + (n ? ' made' : '');
    b.dataset.hand = h.id;
    b.title = n ? `Made ${n}× this game. Click for details.` : 'Click for details';
    b.innerHTML = `<span class="hand-name">${h.name}</span><span class="hand-value">${money(h.value)}</span>${n ? `<span class="hand-count">×${n}</span>` : ''}`;
    els.hands.appendChild(b);
  }
}

function updateSelectionInfo() {
  const sel = game ? game.selected : [];
  els.clearBtn.disabled = sel.length === 0;
  if (!game || game.over) {
    els.selectionInfo.innerHTML = game && game.over ? 'Game over. Deal again to keep playing.' : 'Choose a player to start';
    els.playBtn.disabled = true;
    els.playBtn.textContent = 'Play hand';
    return;
  }
  if (sel.length === 0) {
    els.selectionInfo.textContent = 'Click cards to build a hand';
    els.playBtn.disabled = true;
    els.playBtn.textContent = 'Play hand';
    return;
  }
  const result = evaluatePlay(game.cols, sel);
  if (result.ok) {
    const h = result.hand;
    els.selectionInfo.innerHTML = `<span class="ok">${h.name}</span>${h.value ? ` <span class="pts">+${money(h.value)}</span>` : ' <span class="muted">(no points)</span>'}`;
    els.playBtn.disabled = false;
    els.playBtn.textContent = h.value ? `Play ${h.name}` : 'Play Joker';
  } else {
    els.selectionInfo.innerHTML = `<span class="muted">${sel.length} card${sel.length > 1 ? 's' : ''} selected</span>`;
    els.playBtn.disabled = sel.length < 2;
    els.playBtn.textContent = 'Play hand';
  }
}

function updatePlayer() {
  const p = store.player();
  els.playerName.textContent = p ? p.name : 'Choose player';
  els.bankroll.textContent = money(p ? p.bankroll : 0);
  els.bankroll.classList.toggle('neg', !!(p && p.bankroll < 0));
}

let toastTimer = null;
function toast(html, kind = '') {
  els.toast.innerHTML = html;
  els.toast.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 1800);
}

// ---------- Playing ----------

function toggleCard(id) {
  if (!game || game.over || game.paused) return;
  const i = game.selected.indexOf(id);
  if (i === -1) {
    game.selected.push(id);
    sfx.select();
  } else {
    game.selected.splice(i, 1);
    sfx.deselect();
  }
  cardEls.forEach(el => el.classList.remove('hinted'));
  syncSelection();
  updateSelectionInfo();
}

function clearSelection() {
  if (!game || !game.selected.length) return;
  game.selected = [];
  syncSelection();
  updateSelectionInfo();
}

function snapshot() {
  return JSON.parse(JSON.stringify({ ...game, selected: [] }));
}

function playSelection() {
  if (!game || game.over || game.paused) return;
  const ids = [...game.selected];
  if (ids.length === 0) return;
  const result = evaluatePlay(game.cols, ids);
  if (!result.ok) {
    sfx.error();
    toast(result.reason, 'error');
    ids.forEach(id => {
      const el = cardEls.get(id);
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    });
    return;
  }

  undoState = snapshot();
  const { hand } = result;
  const wasCovered = game.score >= ENTRY_FEE;
  game.started = true;
  game.selected = [];
  const { cols, columnsCleared } = removeCards(game.cols, ids);
  game.cols = cols;
  game.cardsRemoved += ids.length;
  if (hand.value) {
    game.score += hand.value;
    game.handCounts[hand.id] = (game.handCounts[hand.id] || 0) + 1;
  }

  // Animate the played cards away, then let the rest fall.
  ids.forEach(id => {
    const el = cardEls.get(id);
    cardEls.delete(id);
    el.classList.remove('selected');
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 380);
  });
  setTimeout(() => positionCards(), 120);

  if (hand.value) {
    sfx.hand(hand.value);
    toast(`<b>${hand.name}</b> +${money(hand.value)}`, hand.value >= 500 ? 'big' : 'good');
  } else {
    sfx.joker();
    toast('Joker play');
  }
  if (columnsCleared) setTimeout(() => sfx.columnCleared(), 250);
  if (!wasCovered && game.score >= ENTRY_FEE) {
    game.feeCovered = true;
    setTimeout(() => { sfx.cashRegister(); toast(`Entry fee covered! You're winning.`, 'big'); }, 600);
  }

  updateAll();
  saveGame();

  if (!hasAnyPlay(game.cols)) {
    game.over = true;
    updateAll();
    setTimeout(endGame, 900);
  }
}

function undo() {
  if (!undoState || !game || game.over) return;
  // The clock keeps running: undo restores the cards and score, not the time.
  const { elapsed, hintPenalty } = game;
  game = { ...undoState, elapsed, hintPenalty, paused: false };
  undoState = null;
  buildBoard({ animate: false });
  updateAll();
  saveGame();
  toast('Move undone');
}

function togglePause(force) {
  if (!game || game.over) return;
  game.paused = force ?? !game.paused;
  if (game.paused) clearSelection();
  updateHud();
  saveGame();
}

// ---------- Hints ----------

function bestPlay() {
  return findHandPlays(game.cols)[0] || findJokerPlay(game.cols);
}

let pendingHint = null;
function showHint() {
  if (!game || game.over || game.paused) return;
  const play = bestPlay();
  if (!play) return;
  game.hintPenalty += HINT_COST;
  pendingHint = play;
  $('#hintText').textContent = RIDDLES[play.hand.id] || RIDDLES.joker;
  sfx.hint();
  updateHud();
  saveGame();
  $('#hintDlg').showModal();
}

function revealHint() {
  if (!pendingHint || !game) return;
  game.hintPenalty += HINT_COST;
  const ids = pendingHint.ids.filter(id => locate(game.cols, id));
  cardEls.forEach((el, id) => el.classList.toggle('hinted', ids.includes(id)));
  pendingHint = null;
  updateHud();
  saveGame();
  $('#hintDlg').close();
}

// ---------- End of game ----------

function endGame() {
  const left = cardsLeft(game.cols);
  const result = finalScore({
    handCounts: game.handCounts, cardsRemoved: game.cardsRemoved, timerBonus: timerBonus(), cardsRemaining: left,
  });
  const won = game.score >= ENTRY_FEE;
  const rank = store.recordGame({ final: result.final, won, handCounts: game.handCounts, seed: game.seed });
  clearSavedGame();
  undoState = null;
  updateAll();
  sfx.gameOver(won);

  $('#scoreTitle').textContent = won ? 'You won!' : 'No more plays';
  const banner = [];
  if (left <= 10) banner.push(`${CLEAR_MESSAGES[left]} That's a ${money(CLEAR_BONUS[left])} bonus.`);
  else banner.push(won ? `Your hands beat the ${money(ENTRY_FEE)} entry fee.` : `Your hands didn't cover the ${money(ENTRY_FEE)} entry fee, but the bonuses still count.`);
  if (rank) banner.push(`New high score: #${rank} on the top ten!`);
  $('#scoreBanner').textContent = banner.join(' ');

  const rows = result.rows.map(r => `
    <tr class="${r.count ? 'made' : ''}"><td>${r.name}</td><td class="num">${r.count}</td><td class="num muted">× ${money(r.value)}</td><td class="num">${money(r.total)}</td></tr>`).join('');
  $('#scoreTable').innerHTML = `
    <tbody>${rows}</tbody>
    <tbody class="sub">
      <tr><th colspan="3">Game score</th><td class="num">${money(result.gameScore)}</td></tr>
      <tr><td colspan="3">Different hands (${result.differentHands}) × ${money(250)}</td><td class="num">${money(result.differentBonus)}</td></tr>
      <tr><td colspan="3">Cards removed (${game.cardsRemoved}) × ${money(50)}</td><td class="num">${money(result.removedBonus)}</td></tr>
      ${result.clearBonus ? `<tr><td colspan="3">Only ${left} card${left === 1 ? '' : 's'} left</td><td class="num">${money(result.clearBonus)}</td></tr>` : ''}
      <tr><td colspan="3">Timer bonus</td><td class="num">${money(result.timerBonus)}</td></tr>
    </tbody>
    <tfoot><tr><th colspan="3">Final score</th><td class="num final">${money(result.final)}</td></tr></tfoot>`;
  $('#scoreDlg').showModal();
}

// ---------- Dialogs ----------

function confirmBox(title, text, buttons) {
  const dlg = $('#confirmDlg');
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  const actions = $('#confirmActions');
  actions.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${b.primary ? 'primary' : 'ghost'}${b.danger ? ' danger' : ''}`;
    btn.textContent = b.label;
    btn.addEventListener('click', () => { dlg.close(); b.action?.(); });
    actions.appendChild(btn);
  }
  dlg.showModal();
}

function openPlayers() {
  const list = $('#playerList');
  const players = store.players();
  const current = store.currentName();
  $('#playersNote').textContent = inProgress()
    ? 'A game is in progress. Switching players will forfeit it.'
    : players.length ? 'Pick who’s playing, or add a new player.' : 'Add a player to get started. Your bankroll and scores are saved in this browser.';
  list.innerHTML = '';
  for (const p of players) {
    const li = document.createElement('li');
    li.className = p.name === current ? 'current' : '';
    const avg = p.games ? Math.round(p.totalScore / p.games) : 0;
    li.innerHTML = `
      <button type="button" class="pick">
        <span class="pname"></span>
        <span class="pstats">Bankroll <b class="${p.bankroll < 0 ? 'neg' : ''}">${money(p.bankroll)}</b> · Avg ${money(avg)} · ${p.games} game${p.games === 1 ? '' : 's'}</span>
      </button>
      <button type="button" class="del" title="Delete player" aria-label="Delete player">✕</button>`;
    li.querySelector('.pname').textContent = p.name;
    li.querySelector('.pick').addEventListener('click', () => choosePlayer(p.name));
    li.querySelector('.del').addEventListener('click', () => {
      confirmBox(`Delete ${p.name}?`, `This removes ${p.name} and their ${money(p.bankroll)} bankroll for good.`, [
        { label: 'Cancel', action: openPlayers },
        { label: 'Delete', primary: true, danger: true, action: () => {
          if (p.name === current && game && !game.over) { clearSavedGame(); game = null; els.board.innerHTML = ''; cardEls.clear(); }
          store.deletePlayer(p.name);
          updateAll();
          openPlayers();
        } },
      ]);
    });
    list.appendChild(li);
  }
  $('#playerError').textContent = '';
  $('#playersClose').hidden = !current;
  const dlg = $('#playersDlg');
  if (!dlg.open) dlg.showModal();
  if (!players.length) setTimeout(() => $('#newPlayerName').focus(), 50);
}

function choosePlayer(name) {
  const current = store.currentName();
  const go = () => {
    store.selectPlayer(name);
    $('#playersDlg').close();
    updatePlayer();
    const saved = loadSavedGame();
    if (saved) resumeGame(saved);
    else startGame(randomSeed());
    maybeShowIntro();
  };
  if (name === current && game && !game.over) { $('#playersDlg').close(); return; }
  if (inProgress()) {
    confirmBox('Switch players?', `${current}'s game is still in progress. Switching now forfeits it and its entry fee.`, [
      { label: 'Cancel', action: openPlayers },
      { label: 'Switch', primary: true, action: () => { forfeitCurrent(); go(); } },
    ]);
  } else {
    // An untouched deal was paid for by the previous player; keep it simple and let it go.
    if (game && !game.over && current !== name) clearSavedGame();
    go();
  }
}

function resumeGame(saved) {
  game = { ...saved, selected: [], paused: saved.started };
  undoState = null;
  history.replaceState(null, '', `#deal=${game.seed}`);
  buildBoard();
  updateAll();
  if (game.started) toast('Welcome back! Your game is paused.');
}

function openTopTen() {
  const list = $('#toptenList');
  const rows = store.topTen();
  list.innerHTML = rows.length ? '' : '<li class="empty">No scores yet. Finish a game to get on the board.</li>';
  rows.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="tname"></span><span class="tdate">${new Date(r.date).toLocaleDateString()}</span><span class="tscore">${money(r.score)}</span>`;
    li.querySelector('.tname').textContent = r.name;
    list.appendChild(li);
  });
  $('#toptenDlg').showModal();
}

function openStats() {
  const p = store.player();
  const body = $('#statsBody');
  if (!p) { body.innerHTML = '<p class="muted">Choose a player first.</p>'; $('#statsDlg').showModal(); return; }
  const avg = p.games ? Math.round(p.totalScore / p.games) : 0;
  const current = game && !game.over ? `
    <h3>This game</h3>
    <dl class="kv">
      <dt>Deal</dt><dd>#${game.seed}</dd>
      <dt>Score</dt><dd>${money(game.score)}</dd>
      <dt>Cards removed</dt><dd>${game.cardsRemoved}</dd>
      <dt>Cards left</dt><dd>${cardsLeft(game.cols)}</dd>
      <dt>Different hands</dt><dd>${Object.keys(game.handCounts).length}</dd>
      <dt>Possible hands on the table now</dt><dd>${findHandPlays(game.cols).length}</dd>
    </dl>` : '';
  const handRows = HANDS.map(h => `<dt>${h.name}</dt><dd>${p.handCounts[h.id] || 0}</dd>`).join('');
  body.innerHTML = `
    ${current}
    <h3>${escapeHtml(p.name)}</h3>
    <dl class="kv">
      <dt>Bankroll</dt><dd class="${p.bankroll < 0 ? 'neg' : ''}">${money(p.bankroll)}</dd>
      <dt>Games played</dt><dd>${p.games}</dd>
      <dt>Games won</dt><dd>${p.wins}</dd>
      <dt>Average score</dt><dd>${money(avg)}</dd>
      <dt>Best score</dt><dd>${money(p.best)}</dd>
    </dl>
    <h3>Hands made (all games)</h3>
    <dl class="kv cols2">${handRows}</dl>`;
  $('#statsDlg').showModal();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function miniCards(ids) {
  return ids.map(id => {
    const joker = id.startsWith('JK');
    const rank = joker ? 0 : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(id.slice(0, -1)) + 1;
    const card = { id: `ex-${id}`, rank, suit: joker ? null : id.slice(-1), joker };
    return `<div class="card mini">${cardFaceHtml(card)}</div>`;
  }).join('');
}

function openHandInfo(id) {
  const h = HAND_BY_ID[id];
  const info = HAND_INFO[id];
  $('#handTitle').textContent = `${h.name} · ${money(h.value)}`;
  $('#handDesc').textContent = info.desc;
  $('#handExample').innerHTML = miniCards(info.example);
  $('#handDlg').showModal();
}

function maybeShowIntro() {
  if (!store.settings.introSeen) {
    store.setSetting('introSeen', true);
    $('#helpDlg').showModal();
  }
}

// ---------- Events ----------

els.board.addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (el) toggleCard(el.dataset.id);
});
els.table.addEventListener('contextmenu', e => {
  if (!game || game.over) return;
  e.preventDefault();
  if (game.selected.length) playSelection();
});
els.playBtn.addEventListener('click', playSelection);
els.clearBtn.addEventListener('click', clearSelection);
els.undoBtn.addEventListener('click', undo);
els.pauseBtn.addEventListener('click', () => togglePause());
$('#resumeBtn').addEventListener('click', () => togglePause(false));
els.hintBtn.addEventListener('click', showHint);
$('#revealBtn').addEventListener('click', revealHint);
$('#newBtn').addEventListener('click', () => requestNewGame());
$('#playerChip').addEventListener('click', openPlayers);
$('#newDealBtn').addEventListener('click', () => { $('#scoreDlg').close(); startGame(randomSeed()); });
$('#sameDealBtn').addEventListener('click', () => { $('#scoreDlg').close(); startGame(game.seed); });
$('#clearTopTenBtn').addEventListener('click', () => {
  $('#toptenDlg').close();
  confirmBox('Reset high scores?', 'This clears the top ten list for everyone on this browser.', [
    { label: 'Cancel', action: openTopTen },
    { label: 'Reset', primary: true, danger: true, action: () => { store.clearTopTen(); openTopTen(); } },
  ]);
});
els.hands.addEventListener('click', e => {
  const b = e.target.closest('.hand');
  if (b) openHandInfo(b.dataset.hand);
});
els.dealNo.addEventListener('click', async () => {
  if (!game) return;
  const url = `${location.origin}${location.pathname}#deal=${game.seed}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link to this deal copied');
  } catch {
    toast(`Deal #${game.seed}`);
  }
});

$('#addPlayerForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#newPlayerName');
  const res = store.addPlayer(input.value);
  if (!res.ok) { $('#playerError').textContent = res.reason; return; }
  input.value = '';
  choosePlayer(res.name);
});

document.querySelectorAll('dialog').forEach(dlg => {
  dlg.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) dlg.close();
    else if (e.target === dlg && dlg.id !== 'playersDlg') dlg.close(); // click on backdrop
  });
});
// Without a player there's nothing to play, so keep the player list open.
$('#playersDlg').addEventListener('cancel', e => { if (!store.currentName()) e.preventDefault(); });
$('#playersDlg').addEventListener('close', () => { if (!store.currentName()) setTimeout(openPlayers, 0); });

// Menu
function setMenu(open) {
  els.menu.hidden = !open;
  els.menuBtn.setAttribute('aria-expanded', String(open));
}
els.menuBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(els.menu.hidden); });
document.addEventListener('click', e => { if (!els.menu.hidden && !els.menu.contains(e.target)) setMenu(false); });
els.menu.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  setMenu(false);
  ({
    restart: requestRestart, players: openPlayers, topten: openTopTen, stats: openStats,
    help: () => $('#helpDlg').showModal(),
  })[action]();
});
const soundToggle = $('#soundToggle');
soundToggle.checked = store.settings.sound;
setSoundEnabled(store.settings.sound);
soundToggle.addEventListener('change', () => {
  store.setSetting('sound', soundToggle.checked);
  setSoundEnabled(soundToggle.checked);
});

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.target.matches('input, textarea')) return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (key === 'enter') { e.preventDefault(); playSelection(); }
  else if (key === 'escape') { clearSelection(); setMenu(false); }
  else if (key === 'h') showHint();
  else if (key === 'p') togglePause();
  else if (key === 'n') requestNewGame();
  else if (key === 'u') undo();
});

// Pause automatically when the tab is hidden so the timer doesn't run away.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.started && !game.over) togglePause(true);
});

window.addEventListener('resize', () => layout());
window.addEventListener('hashchange', () => {
  const seed = dealFromHash();
  if (seed && (!game || seed !== game.seed)) requestNewGame(seed);
});

// Timer
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (game && game.started && !game.paused && !game.over) {
    const before = timerBonus();
    game.elapsed += dt;
    if (timerBonus() !== before) {
      updateHud();
      if (Math.floor(game.elapsed) % 10 === 0) saveGame();
    }
  }
}, 250);

function dealFromHash() {
  const m = location.hash.match(/deal=(\d{1,7})/);
  return m ? Number(m[1]) : null;
}

// ---------- Start ----------

function init() {
  updateHands();
  updatePlayer();
  if (!store.currentName()) {
    updateAll();
    openPlayers();
    return;
  }
  const saved = loadSavedGame();
  const hashSeed = dealFromHash();
  if (saved && (!hashSeed || hashSeed === saved.seed)) resumeGame(saved);
  else {
    if (saved) {
      // A link to a different deal: the unfinished game counts as forfeited.
      game = { ...saved, selected: [] };
      forfeitCurrent();
    }
    startGame(hashSeed || randomSeed());
  }
  maybeShowIntro();
}

init();
