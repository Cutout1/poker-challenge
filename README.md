# Poker Challenge (web)

A browser remake of **Poker Challenge**, a card game by NorthStar Solutions.

Find poker hands among cards that touch each other, clear them so the cards above fall, and beat the $1,000 entry fee. Everything is plain HTML, CSS and JavaScript with no build step and no image or audio files. The cards are drawn in SVG and the sound effects are synthesized in the browser.

## Play locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Host on GitHub Pages

This folder is the whole site (`index.html` at the root, plus `.nojekyll`). Push it to a repository, then in **Settings → Pages** choose **Deploy from a branch**, branch `main`, folder `/ (root)`. With the GitHub CLI:

```sh
git init && git add . && git commit -m "Poker Challenge web remake"
gh repo create poker-challenge --public --source . --push
gh api -X POST repos/{owner}/poker-challenge/pages -f "source[branch]=main" -f "source[path]=/"
```

The game will be at `https://<your-username>.github.io/poker-challenge/`.

## Rules implemented

- 8 columns × 7 rows: a 52-card deck plus 4 Jokers. Each deal has a number and can be shared as a link (`#deal=12345`).
- A play is 2–5 cards that touch left, right, above or below and form a hand. Removed cards let the cards above fall. Empty columns close up, with the columns to the right sliding left.
- Hand values: Pair $50, Two Pairs $125, Three of a Kind $175, Straight $200, Flush $200, Full House $250, Four of a Kind $500, Straight Flush $1,000, Royal Flush $2,000. Aces count high or low in straights.
- Jokers aren't wild. A Joker removes one card it touches, or any card on the table if the Joker is on the bottom row. Joker plays score nothing.
- The final score is your hands plus these bonuses, which only count if your hands total at least the $1,000 entry fee:
  - $250 for each different hand type made
  - $50 for each card removed
  - a bonus for finishing with 10 or fewer cards left
  - the timer bonus, which starts at $2,000 and drops $5 a second from the first play; each hint costs $50 of it
- Players, bankrolls, the top ten and an unfinished game are saved in `localStorage`.

The cards-left bonus for 4 cards ($750) was taken from the original. The other amounts in `CLEAR_BONUS` (`js/engine.js`) are estimates, so adjust them if you know the real values.

## Code

| File | Purpose |
| --- | --- |
| `js/engine.js` | Game rules, with no DOM access: dealing, hand evaluation, move validation, play search, scoring |
| `js/app.js` | UI, game flow, hints, dialogs, timer |
| `js/cards.js` | SVG card faces |
| `js/sound.js` | Web Audio sound effects |
| `js/storage.js` | Players, high scores and settings |
| `tests/engine.html` | Rules tests plus 200 self-played games. Open through a local server |
| `tests/ui.html` | Plays a full game through the real interface in an iframe |
