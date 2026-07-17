import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Color } from 'chess.js';
import { useGame } from '../store';
import { ARMY, CHARACTERS, PIECE_GLYPH } from '../game/characters';
import { SettingsMenu } from './Settings';
import { Icon } from './Icon';

// Pulls in a second Canvas + drei; loads with (and shares) the 3D chunk.
const InspectModal = lazy(() => import('./InspectModal').then((m) => ({ default: m.InspectModal })));
import { EvalBar } from './EvalBar';
import { MoveToast } from './MoveToast';
import { Clocks } from './Clocks';

export function HUD() {
  const turn = useGame((s) => s.turn);
  const thinking = useGame((s) => s.thinking);
  const playerColor = useGame((s) => s.playerColor);
  const mode = useGame((s) => s.mode);
  const gameOver = useGame((s) => s.gameOver);
  const hintsLeft = useGame((s) => s.hintsLeft);
  const hintPending = useGame((s) => s.hintPending);
  const drawOffered = useGame((s) => s.drawOffered);
  const history = useGame((s) => s.history);
  const capturedByWhite = useGame((s) => s.capturedByWhite);
  const capturedByBlack = useGame((s) => s.capturedByBlack);
  const selected = useGame((s) => s.selected);
  const pieces = useGame((s) => s.pieces);
  const engineError = useGame((s) => s.engineError);
  const soundOn = useGame((s) => s.soundOn);
  const musicOn = useGame((s) => s.musicOn);
  const topDownView = useGame((s) => s.topDownView);
  const topDownSeen = useGame((s) => s.topDownSeen);
  const panelCollapsed = useGame((s) => s.panelCollapsed);

  const backToMenu = useGame((s) => s.backToMenu);
  const undoMove = useGame((s) => s.undoMove);
  const resign = useGame((s) => s.resign);
  const requestHint = useGame((s) => s.requestHint);
  const offerDraw = useGame((s) => s.offerDraw);
  const flipBoard = useGame((s) => s.flipBoard);
  const toggleSound = useGame((s) => s.toggleSound);
  const toggleMusic = useGame((s) => s.toggleMusic);
  const toggleTopDownView = useGame((s) => s.toggleTopDownView);
  const togglePanelCollapsed = useGame((s) => s.togglePanelCollapsed);

  const [panelOpen, setPanelOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const movesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = movesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  useEffect(() => {
    setInspecting(false);
  }, [selected]);

  const aiColor: Color = playerColor === 'w' ? 'b' : 'w';
  const selectedPiece = selected ? pieces.find((p) => p.square === selected) : undefined;

  let banner: React.ReactNode;
  if (gameOver) {
    banner = <span>The battle has concluded</span>;
  } else if (thinking) {
    banner = (
      <span className="thinking">
        <span className="spinner" />
        {ARMY[aiColor].en} is contemplating…
      </span>
    );
  } else {
    banner = (
      <span>
        <span className={`turn-dot ${turn === 'w' ? 'ram' : 'lanka'}`} />
        {ARMY[turn].hi} · {ARMY[turn].en} to move
      </span>
    );
  }

  const rows: Array<{ n: number; w: string; b?: string }> = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: history[i].san, b: history[i + 1]?.san });
  }

  return (
    <>
      <div className="hud-top">
        <button className="btn small" onClick={backToMenu}>
          ← Menu
        </button>
        <div className="turn-banner" role="status" aria-live="polite">{banner}</div>
        <div className="top-right">
          <button
            className="btn small icon"
            onClick={toggleSound}
            title={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-label={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-pressed={soundOn}
          >
            <Icon name={soundOn ? 'sound' : 'soundOff'} />
          </button>
          <button
            className="btn small icon"
            onClick={toggleMusic}
            title={musicOn ? 'Stop ambient music' : 'Play ambient music'}
            aria-label={musicOn ? 'Stop ambient music' : 'Play ambient music'}
            aria-pressed={musicOn}
          >
            <Icon name={musicOn ? 'music' : 'musicOff'} />
          </button>
          <button
            className={`btn small icon view-btn${topDownSeen ? '' : ' attn'}`}
            onClick={toggleTopDownView}
            title={topDownView ? 'Cinematic view' : 'Top-down view'}
            aria-label={topDownView ? 'Switch to cinematic view' : 'Switch to top-down view'}
          >
            <Icon name={topDownView ? 'camera' : 'boardTop'} />
          </button>
          <SettingsMenu />
          <button
            className="btn small icon panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            title="Battle scroll"
            aria-label="Battle scroll — moves and captures"
            aria-expanded={panelOpen}
          >
            <Icon name="scroll" />
          </button>
        </div>
      </div>

      {engineError && <div className="engine-error" role="alert">{engineError}</div>}

      <EvalBar />
      <MoveToast />
      <Clocks />

      <div className={`side-panel ${panelOpen ? 'open' : ''}`}>
        <div className="panel-section">
          <h4>Fallen — captured by {ARMY.w.en}</h4>
          <div className="captured">
            {capturedByWhite.length === 0 ? <span className="none">none yet</span> : capturedByWhite.map((t, i) => (
              <span key={i} className="cap lanka" title={CHARACTERS.b[t].en}>
                {PIECE_GLYPH.b[t]}
              </span>
            ))}
          </div>
          <h4>Fallen — captured by {ARMY.b.en}</h4>
          <div className="captured">
            {capturedByBlack.length === 0 ? <span className="none">none yet</span> : capturedByBlack.map((t, i) => (
              <span key={i} className="cap ram" title={CHARACTERS.w[t].en}>
                {PIECE_GLYPH.w[t]}
              </span>
            ))}
          </div>
        </div>
        <div className="panel-section moves-section">
          <h4>The Battle Scroll</h4>
          <div className="moves" ref={movesRef}>
            {rows.length === 0 && <span className="none">the armies stand ready…</span>}
            {rows.map((r) => (
              <div key={r.n} className="move-row">
                <span className="move-n">{r.n}.</span>
                <span>{r.w}</span>
                <span>{r.b ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* desktop only: sibling of the panel so it stays put while the panel
          slides away — collapsing hands the whole width to the battlefield */}
      <button
        className="btn small icon panel-collapse"
        onClick={togglePanelCollapsed}
        title={panelCollapsed ? 'Open the battle scroll' : 'Collapse the battle scroll'}
        aria-label={panelCollapsed ? 'Open the battle scroll panel' : 'Collapse the battle scroll panel'}
        aria-expanded={!panelCollapsed}
      >
        <Icon name={panelCollapsed ? 'chevronLeft' : 'chevronRight'} />
      </button>

      <div className="hud-bottom">
        <button className="btn" onClick={undoMove} disabled={history.length === 0 && !thinking}>
          <Icon name="undo" size={15} /> Undo
        </button>
        <button className="btn" onClick={flipBoard}>
          <Icon name="flip" size={15} /> Flip
        </button>
        {mode === 'ai' && (
          <>
            <button
              className="btn"
              onClick={requestHint}
              disabled={hintsLeft <= 0 || hintPending || !!gameOver || thinking || turn !== playerColor}
              title={`Divine counsel — ${hintsLeft} left`}
              aria-label={`Divine counsel hint, ${hintsLeft} left`}
            >
              <Icon name="lamp" size={15} /> {hintsLeft}
            </button>
            <button
              className="btn"
              onClick={offerDraw}
              disabled={drawOffered || !!gameOver}
              title={drawOffered ? 'Draw already offered' : 'Offer a draw'}
              aria-label={drawOffered ? 'Draw already offered' : 'Offer a draw'}
            >
              ½
            </button>
          </>
        )}
        <button className="btn danger" onClick={resign} disabled={!!gameOver}>
          <Icon name="flag" size={15} /> Resign
        </button>
      </div>

      {selectedPiece && (
        <div className="piece-chip">
          <div className="piece-chip-text">
            <span className="piece-chip-hi">{CHARACTERS[selectedPiece.color][selectedPiece.type].hi}</span>
            <span className="piece-chip-en">
              {CHARACTERS[selectedPiece.color][selectedPiece.type].en} ·{' '}
              {CHARACTERS[selectedPiece.color][selectedPiece.type].piece}
            </span>
          </div>
          <button
            className="inspect-btn"
            onClick={() => setInspecting(true)}
            title="Inspect this piece"
            aria-label="Inspect this piece"
          >
            <Icon name="magnifier" size={16} />
          </button>
        </div>
      )}

      {inspecting && selectedPiece && (
        <Suspense fallback={null}>
          <InspectModal
            type={selectedPiece.type}
            color={selectedPiece.color}
            onClose={() => setInspecting(false)}
          />
        </Suspense>
      )}
    </>
  );
}
