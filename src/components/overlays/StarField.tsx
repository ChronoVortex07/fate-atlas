import { useMemo } from 'react';

interface Star {
  left: number;
  top: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
}

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1, // 1–3px
      opacity: Math.random() * 0.7 + 0.2, // 0.2–0.9
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2, // 2–5s
    });
  }
  return stars;
}

export default function StarField() {
  const stars = useMemo(() => generateStars(100), []);

  return (
    <div style={containerStyle}>
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            ...starStyle,
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: star.size > 2
              ? `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite alternate`
              : undefined,
          }}
        />
      ))}
      <style>{twinkleKeyframes}</style>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
  overflow: 'hidden',
};

const starStyle: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  background: '#c8d8f0',
};

const twinkleKeyframes = `
@keyframes twinkle {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}
`;
