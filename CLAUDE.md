# המשחקים של theyuker

Personal games only. Work tools (Idan Lifts, cabin estimator etc.) never go here — they live in their own folders under `Desktop\Claude Code\` and belong in the boss's GitHub account/org.

## Layout
- One folder per game (`multiplication-game/`, `snakes-ladders/`, `penalty/`), each a self-contained `index.html` (no build step).
- Root `index.html` is the games menu: every new game gets a card there, and a row in `README.md`.
- UI language is Hebrew, `dir="rtl"`. Games must work on phones (Chrome on Android) as well as desktop.

## Publishing
- Repo: https://github.com/theyuker/games (public) → GitHub Pages: https://theyuker.github.io/games/
- **After every change to a game, commit and push to `main` without being asked** — the site updates in ~1 minute. Check the live URL afterwards.
- Commit identity for this repo: `theyuker` / `344089513+theyuker@users.noreply.github.com` (keeps the private email hidden). Already set in `.git/config`.
- Commit messages in Hebrew.

## Testing
- Preview server: `.claude/launch.json` → `games` (python http.server on port 8770, serves this folder).
- Voice games (Web Speech API) and phone controllers can't be fully tested in the preview pane — simulate the input, and tell the user what still needs a real device.

## Game notes
- `multiplication-game`: voice answers in Hebrew (`he-IL`); the player picks operations (×, ÷, +, −, multi-select) and a number range 0–20; one high-score board per combination in localStorage (`board:<ops>:<lo>-<hi>`). Wrong / not-understood feedback waits 1.2 s (phones split answers into several final results); correct answers count at once. No fixed players.
- `penalty`: keyboard mode must keep working. Phone mode = this screen hosts a PeerJS room (`theyuker-penalty-<CODE>`), phones open `controller.html?room=CODE`.
