import { useState, useCallback, useMemo } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { bandOf } from '../../data/affinities';
import type { AggregatedReading, SynthesisResult, AffinityEffects } from '../../engine/types';

// ── Helper: human-readable readingDetail label ──
function detailLabel(rd: number): string {
  if (rd >= 1) return '+1 illuminated';
  if (rd <= -1) return '−1 eclipsed';
  return '0 neutral';
}

// ── Helper: human-readable hintClarity label ──
function clarityLabel(hc: number): string {
  const abs = Math.abs(hc);
  const prefix = hc >= 0 ? '+' : '−';
  if (abs >= 2) return `${prefix}2 forces name themselves`;
  if (abs >= 1) return `${prefix}1 subtle influence`;
  return '0 neutral';
}

// ── Mini bar visualization for dimension values (−2 to +2) ──
function DimBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, ((value + 2) / 4) * 100));
  const sign = value >= 0 ? '+' : '−';
  return (
    <div style={dimRowStyle}>
      <span style={dimLabelStyle}>{label}</span>
      <div style={dimBarTrackStyle}>
        <div style={{ ...dimBarFillStyle, width: `${pct}%` }} />
      </div>
      <span style={dimValueStyle}>{sign}{Math.abs(value).toFixed(1)}</span>
    </div>
  );
}

// ── Main component ──
export default function SynthesisPreview() {
  const { state, engine } = useGameEngine();
  const [live, setLive] = useState(true);
  const [cachedSynth, setCachedSynth] = useState<SynthesisResult | null>(null);

  // Always compute aggregated (pure function, no side effects)
  const aggregated: AggregatedReading | null = useMemo(() => {
    const results = state.turnResults.filter((r) => r.type !== 'happening');
    if (results.length === 0) return null;
    return engine.getReadingPlanner().aggregate(
      state.turnResults,
      state.questionType ?? 'self',
    );
  }, [state.turnResults, state.questionType, engine]);

  // Synthesis: live = compute every render; frozen = use cache
  const synthesis: SynthesisResult | null = live
    ? (state.turnResults.length > 0 ? engine.previewSynthesis() : null)
    : cachedSynth;

  const handleToggleLive = useCallback(() => {
    setLive((prev) => {
      if (prev) {
        // Freezing: snapshot current result
        setCachedSynth(engine.previewSynthesis());
      }
      return !prev;
    });
  }, [engine]);

  const handleRefresh = useCallback(() => {
    setCachedSynth(engine.previewSynthesis());
  }, [engine]);

  const eff: AffinityEffects = state.affinityEffects;

  const hasTurnData = state.turnResults.length > 0;

  // Determine affinity note preview from current Chaos/Order bands
  const chaosBand = bandOf(state.affinities.chaos);
  const orderBand = bandOf(state.affinities.order);
  let affinityNotePreview: string | null = null;
  if (chaosBand === 'ascendant' || chaosBand === 'dominant') {
    affinityNotePreview = 'The currents of chaos run strong…';
  } else if (orderBand === 'ascendant' || orderBand === 'dominant') {
    affinityNotePreview = 'Order shapes this reading with unusual clarity…';
  }

  return (
    <div style={containerStyle}>
      {/* ── Affinity Modifiers ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Affinity Modifiers</div>
        <div style={modifierRowStyle}>
          <span style={modLabelStyle}>Reading Detail</span>
          <span style={modValueStyle(eff.readingDetail)}>
            {detailLabel(eff.readingDetail)}
          </span>
        </div>
        <div style={modifierRowStyle}>
          <span style={modLabelStyle}>Hint Clarity</span>
          <span style={modValueStyle(eff.hintClarity)}>
            {clarityLabel(eff.hintClarity)}
          </span>
        </div>
        {affinityNotePreview && (
          <div style={modifierRowStyle}>
            <span style={modLabelStyle}>Affinity Note</span>
            <span style={notePreviewStyle}>"{affinityNotePreview}"</span>
          </div>
        )}
      </div>

      {/* ── Turn Stats ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Turn Stats ({state.turnResults.filter((r) => r.type !== 'happening').length}/{state.minigamesCompleted} committed)
        </div>
        {!hasTurnData ? (
          <div style={emptyStyle}>No results committed yet</div>
        ) : aggregated ? (
          <>
            <div style={themeRowStyle}>
              <span style={modLabelStyle}>Dominant Theme</span>
              <span style={themeValueStyle}>{aggregated.dominantTheme}</span>
            </div>
            {aggregated.secondaryTheme && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Secondary</span>
                <span style={themeSecondaryStyle}>{aggregated.secondaryTheme}</span>
              </div>
            )}
            <DimBar label="Favorability" value={aggregated.dimensionProfile.favorability} />
            <DimBar label="Certainty" value={aggregated.dimensionProfile.certainty} />
            <DimBar label="Volatility" value={aggregated.dimensionProfile.volatility} />
            {aggregated.hasTension && (
              <div style={tensionRowStyle}>
                <span style={modLabelStyle}>Tension</span>
                <span style={tensionValueStyle}>
                  {aggregated.tensionPair
                    ? `${aggregated.tensionPair[0]} vs ${aggregated.tensionPair[1]}`
                    : 'high variance'}
                </span>
              </div>
            )}
            {aggregated.strongestFavor && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Strongest +</span>
                <span style={signalValueStyle}>
                  {aggregated.strongestFavor.label} (+{aggregated.strongestFavor.value})
                </span>
              </div>
            )}
            {aggregated.strongestAdverse && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Strongest −</span>
                <span style={signalAdverseStyle}>
                  {aggregated.strongestAdverse.label} ({aggregated.strongestAdverse.value})
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── Live Synthesis ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderRowStyle}>
          <div style={sectionTitleStyle}>Live Synthesis</div>
          <div style={toggleRowStyle}>
            <button
              style={live ? toggleOnStyle : toggleOffStyle}
              onClick={handleToggleLive}
              title={live ? 'Live — click to freeze' : 'Frozen — click to resume live'}
            >
              {live ? '⟳ Live' : '⟳ Off'}
            </button>
            {!live && (
              <button style={refreshBtnStyle} onClick={handleRefresh}>
                Refresh
              </button>
            )}
          </div>
        </div>
        {synthesis ? (
          <div style={synthBodyStyle}>
            <div style={headlineStyle}>{synthesis.headline}</div>
            {synthesis.paragraphs.map((p, i) => (
              <p key={i} style={paragraphStyle}>{p}</p>
            ))}
            {synthesis.tensionNote && (
              <div style={tensionBoxStyle}>{synthesis.tensionNote}</div>
            )}
            {synthesis.affinityNote && (
              <div style={affinityNoteStyle}>{synthesis.affinityNote}</div>
            )}
          </div>
        ) : (
          <div style={emptyStyle}>
            {state.turnResults.length === 0
              ? 'Complete at least one reading to preview synthesis'
              : 'No synthesis available'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  overflow: 'auto',
  height: '100%',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid rgba(26, 36, 64, 0.5)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.35rem',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  alignItems: 'center',
};

const toggleOnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'rgba(212, 168, 84, 0.15)',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.15rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const toggleOffStyle: React.CSSProperties = {
  ...toggleOnStyle,
  color: '#7b9ec7',
  background: 'rgba(123, 158, 199, 0.1)',
  border: '1px solid #7b9ec7',
};

const refreshBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.15rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const modifierRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.15rem 0',
};

const modLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#7b9ec7',
};

const modValueStyle = (val: number): React.CSSProperties => ({
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: val > 0 ? '#d4a854' : val < 0 ? '#7b9ec7' : '#c8d8f0',
});

const notePreviewStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  color: '#c8d8f0',
  fontStyle: 'italic',
  maxWidth: '180px',
  textAlign: 'right',
};

const themeRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.1rem 0',
};

const themeValueStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#d4a854',
  fontWeight: 600,
};

const themeSecondaryStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
};

const signalValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#d4a854',
};

const signalAdverseStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#7b9ec7',
};

const dimRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.1rem 0',
};

const dimLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  color: '#7b9ec7',
  width: '70px',
  flexShrink: 0,
};

const dimBarTrackStyle: React.CSSProperties = {
  flex: 1,
  height: '6px',
  background: 'rgba(26, 36, 64, 0.6)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const dimBarFillStyle: React.CSSProperties = {
  height: '100%',
  background: '#d4a854',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
};

const dimValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#c8d8f0',
  width: '32px',
  textAlign: 'right',
};

const tensionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.15rem 0',
};

const tensionValueStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#e74c3c',
  fontWeight: 500,
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  padding: '0.25rem 0',
};

const synthBodyStyle: React.CSSProperties = {
  maxHeight: '400px',
  overflow: 'auto',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#d4a854',
  marginBottom: '0.4rem',
  lineHeight: 1.3,
};

const paragraphStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  lineHeight: 1.45,
  margin: '0 0 0.35rem 0',
};

const tensionBoxStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#e74c3c',
  fontStyle: 'italic',
  borderLeft: '2px solid #d4a854',
  paddingLeft: '0.5rem',
  margin: '0.35rem 0',
  lineHeight: 1.4,
};

const affinityNoteStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  fontStyle: 'italic',
  textAlign: 'center',
  marginTop: '0.35rem',
  lineHeight: 1.4,
};
