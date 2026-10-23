// What the shapes and colours on the 3D map mean. Collapsible so it stays out of
// the way once learned.

import { LEVELS, BEYOND_RANGE, RISK_COLORS } from '../risk.js';
import { RiskIcon } from './RiskIcon.jsx';

export function MapLegend({ theme, offset }) {
  const colors = RISK_COLORS[theme];
  return (
    <details className={`map-legend ${offset ? 'with-back' : ''}`}>
      <summary>Legend</summary>
      <ul>
        {LEVELS.map((l) => (
          <li key={l.key}>
            <RiskIcon level={l} color={colors[l.key]} size={12} /> {l.label}
            {l.key === 'critical' && <span className="meta lg-note">: pulses to draw attention</span>}
          </li>
        ))}
        <li><RiskIcon level={BEYOND_RANGE} color={colors.none} size={12} /> Beyond forecast range, no problem yet</li>
        <li><strong className="lg-held">≥ 57%</strong> Problem past its range: stays at least this bad unless fixed</li>
        <li><span className="lg-cyl" aria-hidden="true" /> Round cylinder: live sensor (daily data)</li>
        <li><span className="lg-tile" aria-hidden="true" /> Square block: checked by hand or inspected</li>
        <li><span className="tag-reports">2 reports</span> Open reports</li>
        <li><span className="tag-work">In progress</span> Repair dispatched or under way</li>
        <li className="meta">Grey surroundings are illustrative only.</li>
      </ul>
    </details>
  );
}
