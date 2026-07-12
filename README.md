# रामायण Chess — Ramayan Chess

A 3D chess game where **Shri Ram's army faces Ravana's Lanka**, honoring chess's birthplace — India, where it began as chaturanga. Powered by real **Stockfish 18** (WebAssembly) with a difficulty ladder from **500 to 3200 ELO**.

## The Armies

| Piece | राम सेना (White) | लंका सेना (Black) |
|---|---|---|
| King | श्रीराम Shri Ram | रावण Ravana |
| Queen | सीता जी Sita Ji | मंदोदरी Mandodari |
| Knight | लक्ष्मण Lakshman | इंद्रजीत Indrajit |
| Bishop | हनुमान जी Hanuman Ji | अहिरावण Ahiravan |
| Rook | जामवंत Jamvant | कुंभकर्ण Kumbhakarna |
| Pawns | वानर सेना Vanar Sena | राक्षस Rakshasa |

## Features

- **Two modes** — Vs Computer (10 difficulty levels) and local Two Players
- **True Stockfish strength** — levels 1400–3200 use the engine's native `UCI_Elo`
  calibration; levels 500–1100 use a MultiPV blunder model (the Lichess-bot
  recipe) so beginners face believable, human-like mistakes
- **Full rules** via chess.js — castling, en passant, promotion, all draw rules
- **Hand-sculpted 3D pieces** — procedural temple-carving style, no downloaded assets
- **Dusk-over-the-ocean setting** — floating diyas, corner lamps, bloom
- **Synthesized audio** — WebAudio move/capture/check sounds + tanpura-style drone
- Mobile-friendly, works offline after first load (all assets self-hosted)

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Verify

Headless end-to-end suite (uses your installed Chrome, drives real games
including engine replies at 500 / 1700 / 3200):

```bash
node scripts/verify.mjs         # requires `npm run dev` running
node scripts/preview-test.mjs   # requires `npm run preview` running
```

## Tech

Vite · React · TypeScript · three.js / react-three-fiber · chess.js ·
Stockfish 18 lite (single-threaded WASM, vendored in `public/stockfish/`) · zustand

## Roadmap

- Online two-player with room codes
- Optional sculpted GLTF piece models
- PWA install
