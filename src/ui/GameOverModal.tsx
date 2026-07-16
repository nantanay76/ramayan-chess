import { useState } from 'react';
import { useGame } from '../store';
import { ReviewModal } from './ReviewModal';

export function GameOverModal() {
  const gameOver = useGame((s) => s.gameOver);
  const mode = useGame((s) => s.mode);
  const levelIdx = useGame((s) => s.levelIdx);
  const playerColor = useGame((s) => s.playerColor);
  const historyLen = useGame((s) => s.history.length);
  const lastResult = useGame((s) => s.lastResult);
  const startGame = useGame((s) => s.startGame);
  const backToMenu = useGame((s) => s.backToMenu);
  const [reviewing, setReviewing] = useState(false);

  if (!gameOver) return null;

  if (reviewing) return <ReviewModal onClose={() => setReviewing(false)} />;

  let titleHi: string;
  let titleEn: string;
  let sub: string;

  if (gameOver.winner === 'w') {
    titleHi = '॥ जय श्री राम ॥';
    titleEn = "Shri Ram's army triumphs!";
    sub =
      gameOver.reason === 'resign'
        ? 'Lanka lays down its arms.'
        : gameOver.reason === 'timeout'
          ? "Lanka's hourglass runs dry — time lost."
          : 'Ravana is checkmated. Dharma prevails.';
  } else if (gameOver.winner === 'b') {
    titleHi = 'लंका की विजय';
    titleEn = "Lanka's army prevails";
    sub =
      gameOver.reason === 'resign'
        ? "Ram's army withdraws from the field."
        : gameOver.reason === 'timeout'
          ? "Ram's hourglass runs dry — time lost."
          : 'Shri Ram is checkmated. The shadow lengthens… for now.';
  } else {
    titleHi = '॥ संधि ॥';
    titleEn = 'The battle ends in truce';
    sub =
      gameOver.reason === 'stalemate'
        ? 'Stalemate — no lawful move remains.'
        : gameOver.reason === 'insufficient'
          ? 'Neither army has the strength left to win.'
          : gameOver.reason === 'threefold'
            ? 'The same position arose thrice — the war circles endlessly.'
            : 'Fifty moves without progress — the armies rest.';
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h2 className="modal-title-hi big">{titleHi}</h2>
        <h3 className="modal-title-en">{titleEn}</h3>
        <p className="modal-sub">{sub}</p>

        {lastResult && (
          <div className="result-strip">
            {lastResult.newlyConquered && (
              <div className="conquest-banner">👑 New rank conquered!</div>
            )}
            <div className="rating-line">
              <span
                className={`rating-delta ${lastResult.ratingDelta >= 0 ? 'up' : 'down'}`}
              >
                {lastResult.ratingDelta >= 0 ? '▲ +' : '▼ '}
                {lastResult.ratingDelta}
              </span>
              <span className="rating-new">rating {lastResult.newRating}</span>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="start-btn" onClick={() => startGame(mode, levelIdx, playerColor)}>
            Rematch
          </button>
          {historyLen > 0 && (
            <button className="btn" onClick={() => setReviewing(true)}>
              📜 War Review
            </button>
          )}
          <button className="btn" onClick={backToMenu}>
            Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
