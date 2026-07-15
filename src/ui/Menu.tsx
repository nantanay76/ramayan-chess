import { useState } from 'react';
import type { Color } from 'chess.js';
import { useGame, type Mode } from '../store';
import { LEVELS } from '../engine/difficulty';
import { GraphicsPicker } from './Settings';

export function Menu() {
  const startGame = useGame((s) => s.startGame);
  const [mode, setMode] = useState<Mode>('ai');
  const [levelIdx, setLevelIdx] = useState(1);
  const [color, setColor] = useState<Color>('w');

  return (
    <div className="menu">
      <div className="menu-card">
        <p className="menu-om">॥ श्री गणेशाय नमः ॥</p>
        <h1 className="menu-title-hi">रामायण</h1>
        <h2 className="menu-title-en">CHESS</h2>
        <p className="menu-tagline">
          The eternal war of dharma — fought on the board where chess itself was born.
        </p>

        <div className="mode-tabs">
          <button className={`tab ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
            ⚔️ Vs Computer
          </button>
          <button className={`tab ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
            🤝 Two Players
          </button>
        </div>

        {mode === 'ai' && (
          <>
            <p className="section-label">Choose your opponent's strength</p>
            <div className="level-grid">
              {LEVELS.map((lvl, i) => (
                <button
                  key={lvl.elo}
                  className={`chip ${i === levelIdx ? 'active' : ''}`}
                  onClick={() => setLevelIdx(i)}
                  title={lvl.tagline}
                >
                  <span className="chip-elo">{lvl.elo}</span>
                  <span className="chip-rank">{lvl.rank}</span>
                </button>
              ))}
            </div>
            <p className="level-tagline">
              <b>{LEVELS[levelIdx].rankHi}</b> — {LEVELS[levelIdx].tagline}
            </p>

            <p className="section-label">Fight for</p>
            <div className="side-picker">
              <button className={`side ${color === 'w' ? 'active' : ''}`} onClick={() => setColor('w')}>
                <span className="side-glyph ram">♔</span>
                <span>
                  <b>Shri Ram's Army</b>
                  <small>राम सेना · moves first</small>
                </span>
              </button>
              <button className={`side ${color === 'b' ? 'active' : ''}`} onClick={() => setColor('b')}>
                <span className="side-glyph lanka">♚</span>
                <span>
                  <b>Lanka's Army</b>
                  <small>लंका सेना</small>
                </span>
              </button>
            </div>
          </>
        )}

        {mode === 'local' && (
          <p className="local-hint">
            Two warriors, one board. Shri Ram's army moves first — pass the device between moves.
          </p>
        )}

        <p className="section-label">Graphics</p>
        <GraphicsPicker />

        <button className="start-btn" onClick={() => startGame(mode, levelIdx, color)}>
          Begin the Battle
        </button>

        <div className="legend">
          <div>
            <b>राम सेना</b>
            <span>श्रीराम King · सीता जी Queen · लक्ष्मण Knight · हनुमान जी Bishop · जामवंत Rook · वानर सेना Pawns</span>
          </div>
          <div>
            <b>लंका सेना</b>
            <span>रावण King · मंदोदरी Queen · इंद्रजीत Knight · अहिरावण Bishop · कुंभकर्ण Rook · राक्षस Pawns</span>
          </div>
        </div>
      </div>
    </div>
  );
}
