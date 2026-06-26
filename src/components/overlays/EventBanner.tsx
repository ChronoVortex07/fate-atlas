import { AnimatePresence, motion } from 'framer-motion';

export interface BannerMessage {
  text: string;
  affinity?: 'will' | 'fate' | 'shadow' | 'light' | 'chaos' | 'order';
}

const AFFINITY_COLOR: Record<NonNullable<BannerMessage['affinity']>, string> = {
  will: '#5b8c5a', fate: '#d4a854', shadow: '#9b6bb0',
  light: '#e6d8a8', chaos: '#c75b4a', order: '#5b7ec7',
};

export default function EventBanner({ message }: { message: BannerMessage | null }) {
  const color = message?.affinity ? AFFINITY_COLOR[message.affinity] : '#d4a854';
  return (
    <div style={anchorStyle}>
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message.text}
            style={{ ...bannerStyle, borderColor: color + '66', color }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const anchorStyle: React.CSSProperties = {
  position: 'absolute', top: '18px', left: 0, right: 0,
  display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 14,
};

const bannerStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500,
  fontSize: 'clamp(0.85rem, 2vw, 1.05rem)', letterSpacing: '0.04em', textAlign: 'center',
  background: 'rgba(13,18,32,0.92)', border: '1px solid', borderRadius: '6px',
  padding: '0.5rem 1.25rem', maxWidth: 'min(440px, 90vw)',
};
