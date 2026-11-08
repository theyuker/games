# הדברים של theyuker

Personal games and personal apps only. Work tools (Idan Lifts, cabin estimator etc.) never go here — they live in their own folders under `Desktop\Claude Code\` and belong in the boss's GitHub account/org.

## Layout
- Root `index.html` is "הדברים שלי": two sections, **🎮 משחקים** and **🧰 אפליקציות פרטיות**.
- When the user asks to save something: a game goes in the משחקים section, any other personal tool goes in אפליקציות פרטיות. Each new item gets a card in the right section of `index.html` and a row in the matching table in `README.md`.
- Games: one folder per game at the root (`multiplication-game/`, `snakes-ladders/`, `penalty/`, `english-vocab/`), each a self-contained `index.html` (no build step).
- Apps: one folder per app under `apps/`. An app that needs a server (hosted elsewhere, e.g. Vercel) keeps its source in `apps/<name>/src/`, and `apps/<name>/index.html` only redirects to the live URL; its card links straight to the live URL.
- UI language is Hebrew, `dir="rtl"`. Games must work on phones (Chrome on Android) as well as desktop.

## Publishing
- Repo: https://github.com/theyuker/games (public) → GitHub Pages: https://theyuker.github.io/games/
- **After every change to a game, commit and push to `main` without being asked** — the site updates in ~1 minute. Check the live URL afterwards.
- Commit identity for this repo: `theyuker` / `344089513+theyuker@users.noreply.github.com` (keeps the private email hidden). Already set in `.git/config`.
- Commit messages in Hebrew.

## Testing
- Preview server: `.claude/launch.json` → `games` (python http.server on port 8770, serves this folder).
- Voice games (Web Speech API) and phone controllers can't be fully tested in the preview pane — simulate the input, and tell the user what still needs a real device.

## App notes
- `apps/split-makdasi` (ספליט מקדאסי): runs on Vercel project `split-makdasi` (https://split-makdasi.vercel.app) with a Vercel Blob store; GitHub Pages cannot run it. Source of truth for code changes is `apps/split-makdasi/src/`; after changing it, redeploy to Vercel and bump `APP_V` in both `index.html` and `api/trip.js` (open pages auto-reload when it changes).

## Game notes
- `multiplication-game`: voice answers in Hebrew (`he-IL`); the player picks operations (×, ÷, +, −, multi-select) and a number range 0–20; one high-score board per combination in localStorage (`board:<ops>:<lo>-<hi>`). Wrong / not-understood feedback waits 1.2 s (phones split answers into several final results); correct answers count at once. Player chips = only the last 4 names that started a round on this device (no fixed players; a one-time cleanup flagged `mult-players-v2` removed the old fixed "תומר").
- `penalty`: three control modes under "איך שולטים?" (`penalty-ctl`), all must keep working: `keys` (keyboard, A S D / J K L / arrows), `phones` (this screen hosts a PeerJS room `theyuker-penalty-<CODE>`, phones open `controller.html?room=CODE`), `pass` (one device passed between players: a cover screen per pick hides the other's choice).
- `snakes-ladders`: setup chooses 1–3 dice (default 3); all dice equal (2+ dice) = extra turn; last row always 1 die.
