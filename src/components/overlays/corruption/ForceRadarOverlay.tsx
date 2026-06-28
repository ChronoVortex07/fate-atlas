// The glimpse: a hex force-radar of the six affinities (polar pairs opposite),
// corruption a soft haze BEHIND the web, the lie betrayed only by an off-beat pulse.
import type { CSSProperties } from 'react';
import type { ForbiddenGlimpse, AffinityId } from '../../../engine/types';

const C = 130, CY = 132, R = 95;
// id, unit vector (y-down), label position, text-anchor
const AXES: { id: AffinityId; ux: number; uy: number; lx: number; ly: number; anchor: 'start'|'middle'|'end'; name: string }[] = [
  { id: 'chaos',  ux: 0,      uy: -1,   lx: 130, ly: 24,  anchor: 'middle', name: 'Chaos'  },
  { id: 'will',   ux: 0.866,  uy: -0.5, lx: 224, ly: 82,  anchor: 'start',  name: 'Will'   },
  { id: 'shadow', ux: 0.866,  uy: 0.5,  lx: 224, ly: 190, anchor: 'start',  name: 'Shadow' },
  { id: 'order',  ux: 0,      uy: 1,    lx: 130, ly: 250, anchor: 'middle', name: 'Order'  },
  { id: 'fate',   ux: -0.866, uy: 0.5,  lx: 36,  ly: 190, anchor: 'end',    name: 'Fate'   },
  { id: 'light',  ux: -0.866, uy: -0.5, lx: 36,  ly: 82,  anchor: 'end',    name: 'Light'  },
];
const pt = (ux: number, uy: number, r: number) => `${(C + ux * r).toFixed(1)},${(CY + uy * r).toFixed(1)}`;
const hexAt = (r: number) => AXES.map((a) => pt(a.ux, a.uy, r)).join(' ');

export default function ForceRadarOverlay({ glimpse, onDismiss }: { glimpse: ForbiddenGlimpse; onDismiss: () => void }) {
  const web = AXES.map((a) => pt(a.ux, a.uy, R * Math.max(0, Math.min(100, glimpse.forces[a.id])) / 100)).join(' ');
  return (
    <div style={scrimStyle} onClick={onDismiss}>
      <svg width="280" height="280" viewBox="0 0 260 270" onClick={(e) => e.stopPropagation()}>
        <defs>
          <radialGradient id="cx-rhaze"><stop offset="0%" stopColor="#4a0614"/><stop offset="55%" stopColor="#1c0309"/><stop offset="100%" stopColor="rgba(28,3,9,0)"/></radialGradient>
        </defs>
        <ellipse className="cx-haze" cx={C} cy={CY} rx={74} ry={70} fill="url(#cx-rhaze)" />
        <polygon points={hexAt(R)} fill="none" stroke="#9b6bb0" strokeOpacity={0.19} />
        <polygon points={hexAt(R / 2)} fill="none" stroke="#9b6bb0" strokeOpacity={0.13} />
        <g stroke="#9b6bb0" strokeOpacity={0.13}>
          {AXES.map((a) => <line key={a.id} x1={C} y1={CY} x2={C + a.ux * R} y2={CY + a.uy * R} />)}
        </g>
        <polygon points={web} fill="#ff2d4a" fillOpacity={0.13} stroke="#ff2d4a" strokeWidth={1.5} />
        {AXES.map((a) => (
          <text key={a.id} className={`cx-glitch-text${a.id === glimpse.lieId ? ' cx-desync' : ''}`}
                x={a.lx} y={a.ly} textAnchor={a.anchor} fontSize={13} fontFamily="'Cormorant Garamond', serif">
            {a.name}
          </text>
        ))}
      </svg>
    </div>
  );
}

const scrimStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(4,6,12,0.82)', cursor: 'pointer',
};
