import { motion } from 'framer-motion';
import type { SlotResult } from '../../engine/types';
import CardReadingDetail from '../cards/CardReadingDetail';

/**
 * Centered overlay showing one card's full reading breakdown, opened by tapping
 * a card in the expanded constellation wheel. Backdrop or × dismisses it.
 */
export default function CardDetailModal({ result, onClose }: { result: SlotResult; onClose: () => void }) {
  return (
    <motion.div
      style={backdropStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        style={panelStyle}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Close">×</button>
        <CardReadingDetail result={result} />
      </motion.div>
    </motion.div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 10, 18, 0.8)',
  pointerEvents: 'auto',
  padding: '1rem',
};

const panelStyle: React.CSSProperties = {
  position: 'relative',
  width: '90%',
  maxWidth: '420px',
  maxHeight: '85vh',
  overflowY: 'auto',
  background: '#070a12',
  border: '1px solid #1a2440',
  borderRadius: '8px',
  padding: '1.75rem 1.5rem 1.5rem',
  boxSizing: 'border-box',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '0.5rem',
  right: '0.6rem',
  zIndex: 1,
  background: 'transparent',
  border: 'none',
  color: '#d4a854',
  fontSize: '1.4rem',
  lineHeight: 1,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};
