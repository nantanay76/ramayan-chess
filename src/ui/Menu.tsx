import { useState } from 'react';
import type { Color } from 'chess.js';
import { useGame, type Mode } from '../store';
import { LEVELS } from '../engine/difficulty';
import { TIME_CONTROLS } from '../game/timeControls';
import { playerRank } from '../game/profile';
import { ACHIEVEMENTS, loadUnlocked } from '../game/achievements';
import { GraphicsPicker, EnginePowerPicker } from './Settings';
import { Icon } from './Icon';

function TrophyModal({ onClose }: { onClose: () => void }) {
  const unlocked = loadUnlocked();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal trophy-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title-hi big">वीरता का मंदिर</h2>
        <h3 className="modal-title-en">Hall of Valour</h3>
        <div className="trophy-list">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.has(a.id);
            return (
              <div key={a.id} className={`trophy ${got ? 'got' : 'locked'}`}>
                <Icon name="crown" size={16} />
                <span className="trophy-text">
                  <b>
                    {a.en} <em>{a.hi}</em>
                  </b>
                  <small>{a.desc}</small>
                </span>
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function Menu() {
  const startGame = useGame((s) => s.startGame);
  const profile = useGame((s) => s.profile);
  const [mode, setMode] = useState<Mode>('ai');
  const [levelIdx, setLevelIdx] = useState(1);
  const [color, setColor] = useState<Color>('w');
  const [tcIdx, setTcIdx] = useState(0);
  const [trophies, setTrophies] = useState(false);

  const rank = playerRank(profile.rating);
  const played = profile.wins + profile.losses + profile.draws;

  return (
    <div className="menu">
      <div className="menu-card">
        <p className="menu-om">॥ श्री गणेशाय नमः ॥</p>
        <h1 className="menu-title-hi">रामायण</h1>
        <h2 className="menu-title-en">CHESS</h2>
        <p className="menu-tagline">
          The eternal war of dharma — fought on the board where chess itself was born.
        </p>

        {played > 0 && (
          <div className="profile-strip">
            <div className="ps-rank">
              <span className="ps-rank-hi">{rank.rankHi}</span>
              <span className="ps-rank-en">{rank.rank}</span>
            </div>
            <div className="ps-rating">
              <b>{profile.rating}</b>
              <small>rating</small>
            </div>
            <div className="ps-record">
              <span>
                {profile.wins}<em>W</em> · {profile.losses}<em>L</em> · {profile.draws}<em>D</em>
              </span>
              {profile.streak > 1 && (
                <span className="ps-streak">
                  <Icon name="flame" size={13} /> {profile.streak} win streak
                </span>
              )}
            </div>
            <button className="btn small trophy-btn" onClick={() => setTrophies(true)}>
              <Icon name="crown" size={13} /> Trophies
            </button>
          </div>
        )}
        {trophies && <TrophyModal onClose={() => setTrophies(false)} />}

        <div className="mode-tabs">
          <button className={`tab ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
            <Icon name="swords" size={15} /> Vs Computer
          </button>
          <button className={`tab ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
            <Icon name="users" size={15} /> Two Players
          </button>
        </div>

        {mode === 'ai' && (
          <>
            <p className="section-label">Choose your opponent's strength</p>
            <div className="level-grid">
              {LEVELS.map((lvl, i) => {
                const conquered = i <= profile.highestConquered;
                const isNext = i === profile.highestConquered + 1;
                return (
                  <button
                    key={lvl.elo}
                    className={`chip ${i === levelIdx ? 'active' : ''} ${conquered ? 'conquered' : ''} ${isNext ? 'next' : ''}`}
                    onClick={() => setLevelIdx(i)}
                    title={lvl.tagline}
                  >
                    {conquered && (
                      <span className="chip-crown" title="Conquered" aria-label="Conquered">
                        <Icon name="crown" size={12} />
                      </span>
                    )}
                    <span className="chip-elo">{lvl.elo}</span>
                    <span className="chip-rank">{lvl.rank}</span>
                  </button>
                );
              })}
            </div>
            {profile.highestConquered < LEVELS.length - 1 && (
              <p className="conquest-hint">
                <Icon name="swords" size={13} /> Next conquest: <b>{LEVELS[profile.highestConquered + 1].rank}</b> ({LEVELS[profile.highestConquered + 1].elo})
              </p>
            )}
            {profile.highestConquered >= LEVELS.length - 1 && (
              <p className="conquest-hint done">
                <Icon name="crown" size={14} /> You have conquered the entire ladder — even Brahmastra has fallen.
              </p>
            )}
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

        <p className="section-label">Time control</p>
        <div className="tc-grid">
          {TIME_CONTROLS.map((tc, i) => (
            <button
              key={tc.id}
              className={`chip tc ${i === tcIdx ? 'active' : ''}`}
              onClick={() => setTcIdx(i)}
            >
              <span className="chip-rank">{tc.label}</span>
              <span className="chip-elo tc-sub">{tc.sub}</span>
            </button>
          ))}
        </div>

        {mode === 'ai' && (
          <>
            <p className="section-label">Engine strength</p>
            <EnginePowerPicker />
          </>
        )}

        <p className="section-label">Graphics</p>
        <GraphicsPicker />

        <button className="start-btn" onClick={() => startGame(mode, levelIdx, color, TIME_CONTROLS[tcIdx])}>
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
