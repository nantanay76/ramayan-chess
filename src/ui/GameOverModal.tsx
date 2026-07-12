import { useGame } from '../store';

export function GameOverModal() {
  const gameOver = useGame((s) => s.gameOver);
  const mode = useGame((s) => s.mode);
  const levelIdx = useGame((s) => s.levelIdx);
  const playerColor = useGame((s) => s.playerColor);
  const startGame = useGame((s) => s.startGame);
  const backToMenu = useGame((s) => s.backToMenu);

  if (!gameOver) return null;

  let titleHi: string;
  let titleEn: string;
  let sub: string;

  if (gameOver.winner === 'w') {
    titleHi = '॥ जय श्री राम ॥';
    titleEn = "Shri Ram's army triumphs!";
    sub = gameOver.reason === 'resign' ? 'Lanka lays down its arms.' : 'Ravana is checkmated. Dharma prevails.';
  } else if (gameOver.winner === 'b') {
    titleHi = 'लंका की विजय';
    titleEn = "Lanka's army prevails";
    sub = gameOver.reason === 'resign' ? "Ram's army withdraws from the field." : 'Shri Ram is checkmated. The shadow lengthens… for now.';
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
        <div className="modal-actions">
          <button className="start-btn" onClick={() => startGame(mode, levelIdx, playerColor)}>
            Rematch
          </button>
          <button className="btn" onClick={backToMenu}>
            Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
