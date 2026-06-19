interface OrnamentalBorderProps {
  width?: string | number;
  color?: string;
  margin?: string;
}

export default function OrnamentalBorder({
  width = '60px',
  color = '#d4a854',
  margin = '0.25rem 0',
}: OrnamentalBorderProps) {
  return (
    <div
      style={{
        width,
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        margin,
      }}
    />
  );
}
