import { motion } from 'framer-motion';
import type { ReactNode, MouseEvent } from 'react';

interface MysticButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function MysticButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  style,
}: MysticButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <motion.button
      style={{
        ...baseButtonStyle,
        ...(isPrimary ? primaryStyle : secondaryStyle),
        ...style,
      }}
      whileHover={
        disabled
          ? undefined
          : {
              boxShadow: isPrimary
                ? '0 0 30px rgba(212, 168, 84, 0.5)'
                : '0 0 20px rgba(212, 168, 84, 0.3)',
            }
      }
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}

const baseButtonStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  letterSpacing: '0.25em',
  background: 'transparent',
  padding: '0.75rem 2.2rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
  border: 'none',
};

const primaryStyle: React.CSSProperties = {
  color: '#d4a854',
  border: '1px solid #d4a854',
};

const secondaryStyle: React.CSSProperties = {
  color: '#7b9ec7',
  border: '1px solid #1a2440',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.75rem, 1.5vw, 0.85rem)',
  letterSpacing: '0.1em',
  padding: '0.6rem 1.4rem',
};
