// Top-down campus plan for the guest form: tap where the problem is. SVG units
// are campus metres (x across, z down the page, north up), same as the 3D view.

import { useRef } from 'react';

export function PlanMap({ campus, point, highlightId, onPick }) {
  const ref = useRef(null);
  const site = campus.buildings.find((b) => b.kind === 'site');
  const buildings = campus.buildings.filter((b) => b.kind !== 'site');

  const pick = (ev) => {
    const svg = ref.current;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    onPick({ x: Math.round(p.x * 10) / 10, z: Math.round(p.y * 10) / 10 });
  };

  return (
    <svg
      ref={ref} className="plan-map" viewBox="-74 -60 148 128" onClick={pick}
      role="img" aria-label="Campus plan. Tap or click where the problem is."
    >
      <rect x="-70" y="-56" width="140" height="120" rx="2" className="pm-pad" />
      <rect x="-3" y="-56" width="6" height="120" className="pm-path" />
      <rect x="-70" y="3" width="140" height="6" className="pm-path" />
      {buildings.map((b) => (
        <g key={b.id}>
          <rect x={b.x - b.footprintW / 2} y={b.z - b.footprintD / 2} width={b.footprintW} height={b.footprintD} rx="1" className="pm-building" />
          <text x={b.x} y={b.z + 1.5} className="pm-label">{b.name}</text>
        </g>
      ))}
      {site.equipment.map((e) => {
        const on = e.id === highlightId ? ' is-match' : '';
        if (e.type === 'drain') {
          const w = e.axis === 'x' ? e.length : 2;
          const h = e.axis === 'z' ? e.length : 2;
          return <rect key={e.id} x={e.wx - w / 2} y={e.wz - h / 2} width={w} height={h} className={`pm-asset pm-drain${on}`} />;
        }
        if (e.type === 'waste_point' || e.type === 'playground') {
          const s = e.type === 'playground' ? 7 : 4;
          return <rect key={e.id} x={e.wx - s / 2} y={e.wz - s / 2} width={s} height={s} className={`pm-asset pm-${e.type}${on}`} />;
        }
        return <circle key={e.id} cx={e.wx} cy={e.wz} r="1.6" className={`pm-asset pm-streetlight${on}`} />;
      })}
      {point && (
        <g transform={`translate(${point.x} ${point.z})`} className="pm-pin">
          <circle r="4" />
          <circle r="1.4" className="pm-pin-dot" />
        </g>
      )}
    </svg>
  );
}
