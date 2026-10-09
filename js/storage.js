// Players, high scores and settings, saved in the browser's localStorage.

const KEY = 'poker-challenge:v1';

function blank() {
  return { players: {}, current: null, topTen: [], settings: { sound: true, introSeen: false } };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    return { ...blank(), ...data, settings: { ...blank().settings, ...(data.settings || {}) } };
  } catch {
    return blank();
  }
}

let data = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode); the game still works for this session.
  }
}

function newPlayer(name) {
  return { name, bankroll: 0, games: 0, totalScore: 0, best: 0, wins: 0, handCounts: {}, created: Date.now() };
}

export const store = {
  get settings() { return data.settings; },
  setSetting(key, value) { data.settings[key] = value; save(); },

  players() {
    return Object.values(data.players).sort((a, b) => a.name.localeCompare(b.name));
  },
  player(name = data.current) { return name ? data.players[name] || null : null; },
  currentName() { return data.current && data.players[data.current] ? data.current : null; },
  addPlayer(name) {
    name = name.trim().slice(0, 24);
    if (!name) return { ok: false, reason: 'Please enter a name.' };
    const clash = Object.keys(data.players).find(n => n.toLowerCase() === name.toLowerCase());
    if (clash) return { ok: false, reason: `A player named “${clash}” already exists.` };
    data.players[name] = newPlayer(name);
    save();
    return { ok: true, name };
  },
  deletePlayer(name) {
    delete data.players[name];
    if (data.current === name) data.current = null;
    save();
  },
  selectPlayer(name) { data.current = name; save(); },

  chargeEntryFee(amount) {
    const p = this.player(); if (!p) return;
    p.bankroll -= amount;
    save();
  },
  // Record a finished (or forfeited) game for the current player.
  recordGame({ final, won, handCounts, seed }) {
    const p = this.player(); if (!p) return null;
    p.bankroll += final;
    p.games += 1;
    p.totalScore += final;
    p.best = Math.max(p.best, final);
    if (won) p.wins += 1;
    for (const [id, n] of Object.entries(handCounts || {})) p.handCounts[id] = (p.handCounts[id] || 0) + n;
    let rank = null;
    if (final > 0) {
      const entry = { name: p.name, score: final, date: Date.now(), seed };
      data.topTen.push(entry);
      data.topTen.sort((a, b) => b.score - a.score || a.date - b.date);
      data.topTen = data.topTen.slice(0, 10);
      const i = data.topTen.indexOf(entry);
      rank = i === -1 ? null : i + 1;
    }
    save();
    return rank;
  },
  topTen() { return data.topTen; },
  clearTopTen() { data.topTen = []; save(); },
};
