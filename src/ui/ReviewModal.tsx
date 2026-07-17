import { useEffect, useMemo, useState } from 'react';
import type { Color } from 'chess.js';
import { useGame } from '../store';
import { ARMY, PIECE_GLYPH } from '../game/characters';
import { QUALITY_META } from '../game/moveQuality';
import { buildReview, type ReviewMove } from '../game/review';
import { Icon } from './Icon';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Parse the piece-placement field of a FEN into an 8×8 grid (rank 8 → rank 1). */
function fenToGrid(fen: string): ({ color: Color; type: string } | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map((row) => {
    const cells: ({ color: Color; type: string } | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) cells.push(null);
      } else {
        const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
        cells.push({ color, type: ch.toLowerCase() });
      }
    }
    return cells;
  });
}

function ReviewBoard({ fen, from, to }: { fen: string; from?: string; to?: string }) {
  const grid = fenToGrid(fen);
  return (
    <div className="review-board">
      {grid.map((rank, r) =>
        rank.map((cell, f) => {
          const sq = FILES[f] + (8 - r);
          const dark = (r + f) % 2 === 1;
          const moved = sq === from || sq === to;
          return (
            <div key={sq} className={`rb-sq ${dark ? 'dark' : 'light'} ${moved ? 'moved' : ''}`}>
              {cell && (
                <span className={`rb-piece ${cell.color === 'w' ? 'ram' : 'lanka'}`}>
                  {PIECE_GLYPH[cell.color][cell.type as 'p']}
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

function EvalGraph({ moves, current, onPick }: { moves: ReviewMove[]; current: number; onPick: (ply: number) => void }) {
  const W = 320;
  const H = 90;
  const mid = H / 2;
  const n = moves.length;
  // Carry the last known eval across any plies whose analysis didn't land, so a
  // gap reads as "no change" rather than a false swing to zero.
  let carried = 0;
  const pts = moves.map((m, i) => {
    if (m.mate != null) carried = m.mate > 0 ? 600 : -600;
    else if (m.cpWhite != null) carried = Math.max(-600, Math.min(600, m.cpWhite));
    const x = n <= 1 ? 0 : (i / (n - 1)) * W;
    const y = mid - (carried / 600) * (mid - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const curX = n <= 1 ? 0 : (current / (n - 1)) * W;

  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={(e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        onPick(Math.round(frac * (n - 1)));
      }}
    >
      <rect x="0" y="0" width={W} height={mid} className="eg-ram-zone" />
      <rect x="0" y={mid} width={W} height={mid} className="eg-lanka-zone" />
      <line x1="0" y1={mid} x2={W} y2={mid} className="eg-mid" />
      {pts.length > 1 && <polyline points={pts.join(' ')} className="eg-line" />}
      <line x1={curX} y1="0" x2={curX} y2={H} className="eg-cursor" />
    </svg>
  );
}

export function ReviewModal({ onClose }: { onClose: () => void }) {
  const history = useGame((s) => s.history);
  const annotations = useGame((s) => s.annotations);
  const finalFen = useGame((s) => s.fen);

  const review = useMemo(() => buildReview(history, annotations), [history, annotations]);
  const moves = review.moves;
  const [current, setCurrent] = useState(Math.max(0, moves.length - 1));

  const cur = moves[current];
  const boardFen = cur?.fen ?? finalFen;
  const fromSq = current >= 0 ? history[current]?.from : undefined;
  const toSq = current >= 0 ? history[current]?.to : undefined;

  const step = (d: number) => setCurrent((c) => Math.max(0, Math.min(moves.length - 1, c + d)));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCurrent((c) => Math.min(moves.length - 1, c + 1));
      else if (e.key === 'Home') setCurrent(0);
      else if (e.key === 'End') setCurrent(moves.length - 1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length, onClose]);

  const rows: Array<{ n: number; w?: ReviewMove; b?: ReviewMove }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }

  return (
    <div className="overlay">
      <div className="modal review">
        <button className="review-close" onClick={onClose} title="Close" aria-label="Close">
          ✕
        </button>
        <h2 className="modal-title-hi">॥ युद्ध समीक्षा ॥</h2>
        <h3 className="modal-title-en">War Review</h3>

        <div className="acc-row">
          {(['w', 'b'] as Color[]).map((c) => {
            const sr = c === 'w' ? review.w : review.b;
            return (
              <div key={c} className={`acc-card ${c === 'w' ? 'ram' : 'lanka'}`}>
                <span className="acc-army">{ARMY[c].en}</span>
                <span className="acc-pct">{sr.accuracy}%</span>
                <span className="acc-label">accuracy</span>
                <div className="acc-counts">
                  {sr.brilliant > 0 && <span className="q-brahmastra">🏹 {sr.brilliant}</span>}
                  <span className="q-mistake">? {sr.mistakes}</span>
                  <span className="q-blunder">?? {sr.blunders}</span>
                </div>
              </div>
            );
          })}
        </div>

        <EvalGraph moves={moves} current={current} onPick={(p) => setCurrent(Math.max(0, p))} />

        <div className="review-body">
          <ReviewBoard fen={boardFen} from={fromSq} to={toSq} />

          <div className="review-side">
            <div className="review-cur">
              {cur ? (
                <>
                  <span className={`review-cur-move ${cur.color === 'w' ? 'ram' : 'lanka'}`}>
                    {Math.floor(current / 2) + 1}
                    {cur.color === 'w' ? '.' : '…'} {cur.san}
                  </span>
                  {cur.quality && (
                    <span className={`review-cur-q ${QUALITY_META[cur.quality].className}`}>
                      {QUALITY_META[cur.quality].glyph} {QUALITY_META[cur.quality].label}
                      {cur.cpLoss > 20 && <em> −{(cur.cpLoss / 100).toFixed(1)}</em>}
                    </span>
                  )}
                </>
              ) : (
                <span className="review-cur-move">The opening position</span>
              )}
            </div>

            <div className="review-nav">
              <button className="btn small" onClick={() => setCurrent(0)} disabled={current <= 0} aria-label="First move">
                <Icon name="chevronFirst" size={15} />
              </button>
              <button className="btn small" onClick={() => step(-1)} disabled={current <= 0} aria-label="Previous move">
                <Icon name="chevronLeft" size={15} />
              </button>
              <button
                className="btn small"
                onClick={() => step(1)}
                disabled={current >= moves.length - 1}
                aria-label="Next move"
              >
                <Icon name="chevronRight" size={15} />
              </button>
              <button
                className="btn small"
                onClick={() => setCurrent(moves.length - 1)}
                disabled={current >= moves.length - 1}
                aria-label="Last move"
              >
                <Icon name="chevronLast" size={15} />
              </button>
            </div>

            <div className="review-moves">
              {rows.map((row) => (
                <div key={row.n} className="review-move-row">
                  <span className="rm-n">{row.n}.</span>
                  {(['w', 'b'] as const).map((side) => {
                    const m = side === 'w' ? row.w : row.b;
                    if (!m) return <span key={side} />;
                    return (
                      <button
                        key={side}
                        className={`rm-move ${m.ply === current ? 'active' : ''}`}
                        onClick={() => setCurrent(m.ply)}
                      >
                        {m.san}
                        {m.quality && <span className={`rm-dot ${QUALITY_META[m.quality].className}`}>●</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
