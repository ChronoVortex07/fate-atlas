// Light's warning overlay on a tainted method card. Two shapes:
//  - seal (Light Dominant, pre-hijack): the warded pane + gestating embryo.
//    `intact` (early/mid spreading) → calm; `strain` (late spreading/early virulent) → failing.
//  - lure (virulent hijack): the seal has shattered; corruption openly beckons.
//    Layers over the existing cx-card-virulent look. `lunging` adds the near-pinnacle manic pulse.
export type WardProp =
  | { kind: 'seal'; stage: 'intact' | 'strain' }
  | { kind: 'lure'; lunging: boolean }
  | null;

const RUNES = ['ᚠ', 'ᚹ', 'ᛉ', 'ᚱ', 'ᚦ', 'ᛟ', 'ᛇ']; // scattered barrier inscription
const RUNE_POS: React.CSSProperties[] = [
  { top: 8, left: 10 }, { top: 10, right: 12 }, { top: '50%', left: 6 },
  { top: '50%', right: 6 }, { bottom: 26, left: 12 }, { bottom: 28, right: 14 }, { top: 18, left: '50%' },
];

export default function WardSeal({ ward }: { ward: WardProp }) {
  if (!ward) return null;

  if (ward.kind === 'lure') {
    return (
      <div className="cx-lure" aria-hidden>
        <span className="cx-lure-eye e1" /><span className="cx-lure-eye e2" /><span className="cx-lure-eye e3" />
        <span className="cx-lure-eye e4" /><span className="cx-lure-eye e5" />
        <span className="cx-lure-whisper w1">come closer</span>
        <span className="cx-lure-whisper w2">choose me</span>
      </div>
    );
  }

  const cls = ward.stage === 'strain' ? 'cx-ward cx-ward-strain' : 'cx-ward cx-ward-intact';
  return (
    <div className={cls} aria-hidden>
      <div className="cx-emb" />
      <span className="cx-emb-nucleus" />
      <span className="cx-emb-tendril t1" /><span className="cx-emb-tendril t2" /><span className="cx-emb-tendril t3" />
      {ward.stage === 'strain' && (
        <>
          <span className="cx-ward-crack c1" /><span className="cx-ward-crack c2" />
          <span className="cx-ward-crack c3" /><span className="cx-ward-crack c4" />
        </>
      )}
      <div className="cx-ward-ring" />
      <div className="cx-ward-lattice" /><div className="cx-ward-frame" /><div className="cx-ward-sheen" />
      {RUNES.map((r, i) => (
        <span key={i} className="cx-ward-rune" style={RUNE_POS[i]}>{r}</span>
      ))}
      <div className="cx-ward-lock"><span>✦</span></div>
    </div>
  );
}
