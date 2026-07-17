import { useEffect, useRef, useState } from 'react';
import { useGame, type GraphicsPref, type EnginePower } from '../store';
import { maxEngineAvailable } from '../engine/ai';
import { Icon } from './Icon';

interface Preset {
  id: GraphicsPref;
  label: string;
  hi: string;
  hint: string;
  /** filled gold pips out of 5 — a quick read of the fidelity/cost trade. */
  pips: number;
}

// order runs highest-fidelity → smoothest, with Auto leading as the safe default
const PRESETS: Preset[] = [
  { id: 'auto', label: 'Auto', hi: 'स्वतः', hint: 'Tunes itself to your device', pips: 0 },
  { id: 'ultra', label: 'Ultra', hi: 'भव्य', hint: 'Full resolution · every effect', pips: 5 },
  { id: 'high', label: 'High', hi: 'उच्च', hint: 'Rich visuals, crisp edges', pips: 4 },
  { id: 'balanced', label: 'Balanced', hi: 'संतुलित', hint: 'Smooth with the full scene', pips: 3 },
  { id: 'performance', label: 'Performance', hi: 'तीव्र', hint: 'Lightest — smoothest FPS', pips: 2 },
];

/** The preset chips. Shared by the in-game popover and the start Menu so both
 *  entry points read identically. */
export function GraphicsPicker() {
  const graphicsPref = useGame((s) => s.graphicsPref);
  const setGraphicsPref = useGame((s) => s.setGraphicsPref);

  return (
    <div className="gfx-grid" role="radiogroup" aria-label="Graphics quality">
      {PRESETS.map((p) => {
        const active = graphicsPref === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`gfx-chip ${active ? 'active' : ''}`}
            onClick={() => setGraphicsPref(p.id)}
            title={p.hint}
          >
            <span className="gfx-chip-head">
              <span className="gfx-name">{p.label}</span>
              <span className="gfx-hi">{p.hi}</span>
            </span>
            <span className="gfx-pips" aria-hidden="true">
              {p.id === 'auto' ? (
                <span className="gfx-auto">⟳</span>
              ) : (
                Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`gfx-pip ${i < p.pips ? 'on' : ''}`} />
                ))
              )}
            </span>
            <span className="gfx-hint">{p.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

interface EngineOpt {
  id: EnginePower;
  label: string;
  hi: string;
  hint: string;
}

const ENGINE_OPTS: EngineOpt[] = [
  { id: 'standard', label: 'Standard', hi: 'मानक', hint: 'Single-core · lightest & smoothest' },
  { id: 'max', label: 'Max', hi: 'प्रचंड', hint: 'Multi-core · deeper, fiercer search' },
];

/** Opt-in engine strength. 'Max' needs cross-origin isolation (SharedArrayBuffer);
 *  where that isn't available the option is disabled and Standard is used. */
export function EnginePowerPicker() {
  const enginePower = useGame((s) => s.enginePower);
  const setEnginePower = useGame((s) => s.setEnginePower);
  const canMax = maxEngineAvailable();

  return (
    <div className="gfx-grid" role="radiogroup" aria-label="Engine strength">
      {ENGINE_OPTS.map((o) => {
        const active = enginePower === o.id;
        const disabled = o.id === 'max' && !canMax;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={`gfx-chip ${active ? 'active' : ''}`}
            onClick={() => setEnginePower(o.id)}
            title={disabled ? 'Not available in this browser' : o.hint}
          >
            <span className="gfx-chip-head">
              <span className="gfx-name">{o.label}</span>
              <span className="gfx-hi">{o.hi}</span>
            </span>
            <span className="gfx-hint">{disabled ? 'Unavailable in this browser' : o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleChip({ label, hi, hint, on, onClick }: { label: string; hi: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`gfx-chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="gfx-chip-head">
        <span className="gfx-name">{label}</span>
        <span className="gfx-hi">{hi}</span>
      </span>
      <span className="gfx-hint">{hint}</span>
      <span className="gfx-auto" aria-hidden="true">{on ? '✓' : ''}</span>
    </button>
  );
}

/** Board-display preferences (legal-move dots, coordinates). */
export function BoardPrefs() {
  const showMoveDots = useGame((s) => s.showMoveDots);
  const showCoords = useGame((s) => s.showCoords);
  const toggleMoveDots = useGame((s) => s.toggleMoveDots);
  const toggleCoords = useGame((s) => s.toggleCoords);

  return (
    <>
      <ToggleChip
        label="Move hints"
        hi="संकेत"
        hint="Dots on legal target squares"
        on={showMoveDots}
        onClick={toggleMoveDots}
      />
      <ToggleChip
        label="Coordinates"
        hi="निर्देशांक"
        hint="File & rank labels on the board"
        on={showCoords}
        onClick={toggleCoords}
      />
    </>
  );
}

/** Fullscreen toggle chip — hidden where the Fullscreen API isn't available
 *  (e.g. iPhone Safari). */
export function FullscreenChip() {
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  if (!document.documentElement.requestFullscreen) return null;

  return (
    <button
      type="button"
      className="gfx-chip"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
    >
      <span className="gfx-chip-head">
        <span className="gfx-name">{fs ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        <span className="gfx-hi">पूर्ण दृश्य</span>
      </span>
      <span className="gfx-hint">{fs ? 'Return to the window' : 'Immerse — hide the browser'}</span>
      <Icon name={fs ? 'fullscreenExit' : 'fullscreen'} size={16} />
    </button>
  );
}

/** Gear button + heritage popover for the in-game HUD. Closes on Escape or an
 *  outside click; the trigger sits inside the same wrapper so clicking it just
 *  toggles instead of double-firing an outside-close. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div className="settings-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`btn small icon gear ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Settings">
          <div className="settings-title">
            <span className="settings-orn">॥</span>
            <span>Settings</span>
            <span className="settings-title-hi">समायोजन</span>
          </div>
          <GraphicsPicker />
          <BoardPrefs />
          <FullscreenChip />
          <p className="settings-foot">Auto adapts to your device. Ultra looks grandest on a strong GPU.</p>
        </div>
      )}
    </div>
  );
}
