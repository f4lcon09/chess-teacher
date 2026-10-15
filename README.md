# Chess Teacher

A personal chess teacher that runs entirely in the browser (no backend).

- Imports your games from the public chess.com API
- Analyzes them move by move with Stockfish (WASM, lite single-threaded)
- Classifies moves (best / good / inaccuracy / mistake / blunder) and gives rule-based explanations
- All data lives in your browser (IndexedDB)

Planned: opening statistics, bots to play against, a "mirror" bot that plays like you, puzzles.

## Run

```bash
npm install
npm run dev
```

## Stack

Vite, React, TypeScript, chess.js, react-chessboard, Dexie, Recharts, Stockfish.js.

## License notes

`public/stockfish/` contains an unmodified build of [Stockfish.js](https://github.com/nmrugg/stockfish.js)
(GPL-3.0, see `Copying.txt` in the npm package). Stockfish is a trademark of its authors.
