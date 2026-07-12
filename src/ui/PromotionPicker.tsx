import type { PieceSymbol } from 'chess.js';
import { useGame } from '../store';
import { CHARACTERS, PIECE_GLYPH } from '../game/characters';

const CHOICES: PieceSymbol[] = ['q', 'r', 'b', 'n'];

export function PromotionPicker() {
  const pending = useGame((s) => s.promotionPending);
  const turn = useGame((s) => s.turn);
  const choose = useGame((s) => s.choosePromotion);
  const cancel = useGame((s) => s.cancelPromotion);

  if (!pending) return null;

  return (
    <div className="overlay" onClick={cancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title-hi">{turn === 'w' ? 'वानर का वरदान' : 'राक्षस का उत्थान'}</h3>
        <p className="modal-sub">
          {turn === 'w'
            ? 'Your vanar has crossed the battlefield! Choose the blessing it receives.'
            : 'Your rakshasa has crossed the battlefield! Choose its risen form.'}
        </p>
        <div className="promo-row">
          {CHOICES.map((t) => (
            <button key={t} className="promo-btn" onClick={() => choose(t)}>
              <span className="promo-glyph">{PIECE_GLYPH[turn][t]}</span>
              <b>{CHARACTERS[turn][t].en}</b>
              <small>{CHARACTERS[turn][t].piece}</small>
            </button>
          ))}
        </div>
        <button className="btn small" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
