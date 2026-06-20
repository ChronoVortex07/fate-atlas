import type { InteractionEvent } from '../../../engine/types';

interface Props {
  event: InteractionEvent;
  onComplete: () => void;
}

export default function FoolsRerollAnimation({ event, onComplete }: Props) {
  return (
    <div
      style={{
        background: 'rgba(7, 10, 18, 0.85)',
        borderRadius: 12,
        padding: '2rem 3rem',
        textAlign: 'center',
        color: '#c8a96e',
        border: '1px solid #3a2a1a',
        cursor: 'pointer',
      }}
      onClick={onComplete}
    >
      <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
        {event.description}
      </p>
    </div>
  );
}
