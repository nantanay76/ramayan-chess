import { useGame } from '../store';

/**
 * The dharma-vs-adharma meter: a slim vertical bar showing who stands better.
 * Ram's gold fills from the top, Ravana's shadow from the bottom. It reads the
 * objective analysis eval (White's-perspective centipawns) already flowing into
 * the store, so it costs nothing extra to render.
 */
export function EvalBar() {
  const cp = useGame((s) => s.evalCp);
  const mate = useGame((s) => s.evalMate);
  const flipped = useGame((s) => s.flipped);

  // Fraction of the bar that belongs to Ram (White). Logistic squashing keeps a
  // decisive-but-not-mating advantage from pinning the bar to the very end.
  let ramFrac: number;
  if (mate != null) ramFrac = mate > 0 ? 1 : 0;
  else ramFrac = 1 / (1 + Math.exp(-(cp ?? 0) / 380));

  const label = mate != null ? `M${Math.abs(mate)}` : formatCp(cp ?? 0);
  const ramLeads = mate != null ? mate > 0 : (cp ?? 0) >= 0;

  const ramPct = Math.round(ramFrac * 100);

  // The dark container is Lanka; the gold fill is Ram. It anchors to whichever
  // edge Ram's army sits on — bottom by default, top when the board is flipped.
  return (
    <div className="eval-bar" title="Balance of dharma — who stands better">
      <div className={`eval-fill ${flipped ? 'flipped' : ''}`} style={{ height: `${ramPct}%` }} />
      <div className={`eval-num ${ramLeads ? 'ram' : 'lanka'}`}>{label}</div>
    </div>
  );
}

function formatCp(cp: number): string {
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : pawns < 0 ? '−' : '';
  return `${sign}${Math.abs(pawns).toFixed(1)}`;
}
