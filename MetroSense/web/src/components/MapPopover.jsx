// Pop-up card on the map for whatever was just clicked: an asset (key facts and
// "See details"), or a building or floor (its worst asset and open problems).

import { useState } from 'react';
import { RISK_COLORS, summarize, riskLevel, pct } from '../risk.js';
import { RiskBadge } from './RiskIcon.jsx';
import { AssetSummary, assetEyebrow, placeOf } from './AssetDetail.jsx';
import { plural } from './format.js';

function AreaSummary({ title, eyebrow, equipment, theme, onShowAsset, onDismiss }) {
  const colors = RISK_COLORS[theme];
  const s = summarize(equipment);
  return (
    <>
      <div className="popover-head" style={{ '--risk': colors[s.level.key] }}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onDismiss} aria-label="Close pop-up">×</button>
      </div>
      <div className="asset-summary">
        <div className="summary-badges">
          <RiskBadge level={s.level} color={colors[s.level.key]} value={pct(s.worst?.risk)} />
          <span className="chip">{plural(s.openProblems, 'open problem')}</span>
        </div>
        {s.worst && s.openProblems > 0 ? (
          <p className="summary-problem">
            <span className="summary-label">Worst</span>
            <strong>{s.worst.name}</strong>
            <span className="meta">{s.worst.fault}</span>
          </p>
        ) : (
          <p className="summary-ok">No open problems here.</p>
        )}
        {s.worst && (
          <div className="summary-actions">
            <button className="btn btn-small" onClick={() => onShowAsset(s.worst)}>Show {s.openProblems > 0 ? 'worst asset' : 'highest risk'}</button>
          </div>
        )}
      </div>
    </>
  );
}

export function MapPopover({ campus, theme, buildingId, floorLevel, equipmentId, caseByAsset, onOpenCase, onDetails, onShowAsset }) {
  const b = campus.buildings.find((x) => x.id === buildingId);
  const site = b?.kind === 'site';
  const floor = b && floorLevel ? b.floors[floorLevel - 1] : null;
  const e = equipmentId && b?.equipment.find((x) => x.id === equipmentId);
  // A closed pop-up stays closed until something else is clicked.
  const key = `${buildingId}|${floorLevel}|${equipmentId}`;
  const [dismissed, setDismissed] = useState(null);
  if (!b || dismissed === key || (site && !e)) return null;
  const dismiss = () => setDismissed(key);
  const colors = RISK_COLORS[theme];

  return (
    <section key={key} className={`map-popover ${e ? '' : 'map-popover-area'}`} aria-label="Selection" aria-live="polite">
      {e ? (
        <>
          <div className="popover-head" style={{ '--risk': colors[riskLevel(e.risk).key] }}>
            <div>
              <p className="eyebrow">{assetEyebrow(e)}</p>
              <h2>{e.name}</h2>
              <p className="meta">{placeOf(e, b)}</p>
            </div>
            <button className="icon-btn" onClick={dismiss} aria-label="Close pop-up">×</button>
          </div>
          <AssetSummary
            e={e} b={b} theme={theme} day={campus.day} variant="popover"
            openCase={caseByAsset?.get(e.id)} onOpenCase={onOpenCase} onDetails={onDetails}
          />
        </>
      ) : floor ? (
        <AreaSummary
          title={floor.label} eyebrow={b.name} equipment={floor.equipment} theme={theme}
          onShowAsset={onShowAsset} onDismiss={dismiss}
        />
      ) : (
        <AreaSummary
          title={b.name} eyebrow={`${b.floorCount} floors`} equipment={b.equipment} theme={theme}
          onShowAsset={onShowAsset} onDismiss={dismiss}
        />
      )}
    </section>
  );
}
