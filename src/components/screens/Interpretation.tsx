import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import RunicBand from '../shared/RunicBand';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import MysticButton from '../shared/MysticButton';
import type { SlotResult } from '../../engine/types';

export default function Interpretation() {
  const { state, engine } = useGameEngine();

  if (state.screen !== 'interpretation') return null;

  const synthesis = state.synthesis;
  if (!synthesis) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const prompt = engine.generateLLMPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed — silently ignore
    }
  }, [engine]);

  const handleContinue = useCallback(() => {
    engine.triggerHappening();
  }, [engine]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={scrollContentStyle}>
        <div style={contentStyle}>
          {/* Runic band */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            style={{ textAlign: 'center', width: '100%' }}
          >
            <RunicBand opacity={0.3} />
          </motion.div>

          {/* Headline */}
          <motion.h1
            style={headlineStyle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {synthesis.headline}
          </motion.h1>

          <OrnamentalBorder margin="0.25rem 0" />

          {/* Paragraphs */}
          <div style={paragraphsStyle}>
            {synthesis.paragraphs.map((para, i) => (
              <motion.p
                key={i}
                style={paragraphStyle}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
              >
                {para}
              </motion.p>
            ))}
          </div>

          {/* Tension note */}
          {synthesis.tensionNote && (
            <motion.div
              style={tensionBoxStyle}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div style={tensionBorderStyle} />
              <p style={tensionTextStyle}>{synthesis.tensionNote}</p>
            </motion.div>
          )}

          {/* Affinity note */}
          {synthesis.affinityNote && (
            <motion.p
              style={affinityNoteStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {synthesis.affinityNote}
            </motion.p>
          )}

          {/* Expandable slot details */}
          <motion.div
            style={detailsSectionStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <SlotDetails slots={state.slots} />
          </motion.div>

          {/* Bottom runic band */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            style={{ marginTop: '0.5rem', textAlign: 'center', width: '100%' }}
          >
            <RunicBand opacity={0.2} />
          </motion.div>

          {/* Action buttons */}
          <motion.div
            style={actionsStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <MysticButton
              variant="secondary"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy LLM Prompt'}
            </MysticButton>

            <MysticButton
              variant="primary"
              onClick={handleContinue}
            >
              CONTINUE
            </MysticButton>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Slot Details Accordion ──

function SlotDetails({ slots }: { slots: (SlotResult | null)[] }) {
  const nonEmpty = slots.filter((s): s is SlotResult => s !== null);

  if (nonEmpty.length === 0) return null;

  return (
    <div style={accordionContainerStyle}>
      <h2 style={detailsHeadingStyle}>Divination Details</h2>
      {nonEmpty.map((slot, i) => (
        <SlotAccordionItem key={i} slot={slot} defaultOpen={false} />
      ))}
    </div>
  );
}

function SlotAccordionItem({
  slot,
  defaultOpen,
}: {
  slot: SlotResult;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <div style={accordionItemStyle}>
      <button style={accordionHeaderStyle} onClick={toggle}>
        <span style={accordionLabelStyle}>
          {slot.type === 'tarot'
            ? slot.name
            : slot.type === 'd20'
              ? `Dice Roll — ${slot.result}`
              : slot.type === 'iching'
                ? `Hexagram ${slot.hexagramNumber} — ${slot.name}`
                : slot.type === 'happening'
                  ? 'Happening'
                  : 'Unknown'}
        </span>
        <motion.span
          style={chevronStyle}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          &#x25BC;
        </motion.span>
      </button>

      <motion.div
        style={accordionBodyStyle}
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div style={accordionContentStyle}>
          <SlotDetailContent slot={slot} />
        </div>
      </motion.div>
    </div>
  );
}

function SlotDetailContent({ slot }: { slot: SlotResult }) {
  switch (slot.type) {
    case 'tarot':
      return (
        <div style={detailContentInnerStyle}>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Symbol</span>
            <span style={detailValueStyle}>{slot.symbol}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Card</span>
            <span style={detailValueStyle}>{slot.name} (No. {slot.number})</span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Orientation</span>
            <span style={{
              ...detailValueStyle,
              color: slot.orientation === 'upright' ? '#7b9ec7' : '#d4a854',
            }}>
              {slot.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
            </span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Meaning</span>
            <span style={detailValueStyle}>
              {slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}
            </span>
          </div>
        </div>
      );

    case 'd20':
      return (
        <div style={detailContentInnerStyle}>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Result</span>
            <span style={detailValueStyle}>{slot.result}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Threshold</span>
            <span style={detailValueStyle}>{formatThreshold(slot.threshold)}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Interpretation</span>
            <span style={detailValueStyle}>{slot.interpretation}</span>
          </div>
        </div>
      );

    case 'iching':
      return (
        <div style={detailContentInnerStyle}>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Hexagram</span>
            <span style={detailValueStyle}>
              {slot.symbol} #{slot.hexagramNumber} — {slot.name}
            </span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Judgment</span>
            <span style={detailValueStyle}>{slot.judgment}</span>
          </div>
          {slot.changingLines.length > 0 && (
            <div style={detailRowStyle}>
              <span style={detailLabelStyle}>Changing Lines</span>
              <span style={detailValueStyle}>{slot.changingLines.join(', ')}</span>
            </div>
          )}
        </div>
      );

    case 'happening':
      return (
        <div style={detailContentInnerStyle}>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>Scene</span>
            <span style={detailValueStyle}>{slot.scene}</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function formatThreshold(threshold: string): string {
  switch (threshold) {
    case 'critical-low': return 'Critical Low';
    case 'low': return 'Low';
    case 'neutral': return 'Neutral';
    case 'high': return 'High';
    case 'critical-high': return 'Critical High';
    default: return threshold;
  }
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  background: '#070a12',
  overflow: 'hidden',
};

const scrollContentStyle: React.CSSProperties = {
  overflowY: 'auto',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.25rem',
  padding: '3rem 2rem',
  maxWidth: '680px',
  width: '100%',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
  margin: 0,
  textAlign: 'center',
  lineHeight: 1.3,
};

const paragraphsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
};

const paragraphStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
  color: '#7b9ec7',
  lineHeight: 1.7,
  margin: 0,
};

const tensionBoxStyle: React.CSSProperties = {
  position: 'relative',
  background: '#0d1220',
  borderRadius: '6px',
  padding: '1rem 1.25rem',
  width: '100%',
  boxSizing: 'border-box',
};

const tensionBorderStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '3px',
  background: '#d4a854',
  borderRadius: '3px 0 0 3px',
};

const tensionTextStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.6vw, 0.95rem)',
  color: '#c8d8f0',
  lineHeight: 1.6,
  margin: 0,
  fontStyle: 'italic',
};

const affinityNoteStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.6vw, 0.95rem)',
  color: '#7b9ec7',
  lineHeight: 1.6,
  margin: 0,
  fontStyle: 'italic',
  textAlign: 'center',
};

// ── Accordion Styles ──

const detailsSectionStyle: React.CSSProperties = {
  width: '100%',
};

const accordionContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const detailsHeadingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
  color: '#d4a854',
  letterSpacing: '0.15em',
  margin: 0,
  marginBottom: '0.25rem',
};

const accordionItemStyle: React.CSSProperties = {
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  overflow: 'hidden',
};

const accordionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#c8d8f0',
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.05em',
  textAlign: 'left',
  outline: 'none',
};

const accordionLabelStyle: React.CSSProperties = {
  flex: 1,
};

const chevronStyle: React.CSSProperties = {
  color: '#d4a854',
  fontSize: '0.7rem',
  display: 'inline-block',
};

const accordionBodyStyle: React.CSSProperties = {
  overflow: 'hidden',
};

const accordionContentStyle: React.CSSProperties = {
  padding: '0 1rem 0.75rem',
};

const detailContentInnerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const detailLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.75rem',
  color: '#d4a854',
  minWidth: '100px',
  flexShrink: 0,
};

const detailValueStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.75rem',
  color: '#7b9ec7',
  lineHeight: 1.5,
};

// ── Action Button Styles ──

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginTop: '0.5rem',
};

